import { json, requireSession, logActivity } from '../_utils.js';
import { makeTicket, SSO_PROGRAMS } from './launch.js';

// Admin-only: bring every existing registration over to the Portal, so nobody registers again.
//
//   GET  /api/import-registrations           a small page with "Preview" and "Import" buttons (log in as an admin first)
//   POST /api/import-registrations { dryRun } the same, as JSON
//
// It reads the registered trainees from each program (their own list, through the same admin ticket the Portal uses to
// open them) and from the CMS (functions/api/export-trainees.js there), then for each person:
//   - already a Portal trainee (same first + last name): nothing is created; their program access is added;
//   - otherwise a Portal trainee account is created with the name and Batch ID from the program, and NO password yet:
//     the trainee makes it theirs once on /claim.html (name + Batch ID, then a username and password);
//   - approved in the program: the Portal account is Approved and gets that program's access, so they open it without asking again;
//   - still pending in the program: the Portal account is Pending, in the Portal's own Registrations list for approval;
//   - rejected or archived in the program: skipped.
// Running it again is safe: people already on the Portal are skipped. Programs' own records are only read, never changed.
const CMS_URL = 'https://lshcasemanagementtraining-trainingcrm.pages.dev/';
const UNCLAIMED = 'unclaimed:';
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function splitName(r) {
    let first = String(r.firstName || r.first || '').trim(), last = String(r.lastName || r.last || '').trim();
    if (!first || !last) {
        const parts = String(r.name || '').trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) { last = parts.pop(); first = parts.join(' '); }
    }
    return { first, last };
}

async function programTrainees(url, secret) {
    const ticket = await makeTicket(secret, { system: true });
    const auth = await fetch(url + 'api/auth/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket }) });
    const a = await auth.json().catch(() => ({}));
    if (!auth.ok || !a.token) throw new Error((a && a.error) || ('program answered ' + auth.status));
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + a.token };
    const listRes = await fetch(url + 'api/storage/list', { method: 'POST', headers, body: JSON.stringify({ prefix: 'trainee:' }) });
    const keys = ((await listRes.json().catch(() => ({}))).keys || []).filter(k => /^trainee:/.test(k));
    const out = [];
    for (let i = 0; i < keys.length; i += 100) {
        const res = await fetch(url + 'api/storage/get-many', { method: 'POST', headers, body: JSON.stringify({ keys: keys.slice(i, i + 100) }) });
        const values = (await res.json().catch(() => ({}))).values || {};
        for (const raw of Object.values(values)) { try { const r = JSON.parse(raw); if (r) out.push(r); } catch (e) { /* skip an unreadable record */ } }
    }
    return out;
}

async function cmsTrainees(secret) {
    const ticket = await makeTicket(secret, { system: true });
    const res = await fetch(CMS_URL + 'api/export-trainees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) throw new Error((d && d.error) || ('the CMS answered ' + res.status));
    return d.trainees || [];
}

export async function runImport(env, { dryRun }) {
    const secret = String(env.PORTAL_SSO_SECRET || '').trim();
    if (!secret) throw new Error('PORTAL_SSO_SECRET isn\'t set on the Portal (Production).');
    // 1. who exists, by source
    const people = new Map();   // key (first last) -> { first, last, batch, status, topics:Set }
    const report = [];
    const add = (source, topicKey, first, last, batch, state) => {
        if (!first || !last) return false;
        const key = norm(first + ' ' + last);
        let p = people.get(key);
        if (!p) { p = { first, last, batch: '', state: 'Pending', topics: new Set() }; people.set(key, p); }
        if (!p.batch && batch) p.batch = batch;
        if (state === 'Approved') p.state = 'Approved';
        if (state === 'Approved' && topicKey) p.topics.add(topicKey);
        return true;
    };
    for (const [topicKey, url] of Object.entries(SSO_PROGRAMS)) {
        const row = { source: topicKey, found: 0, skipped: 0, error: '' };
        try {
            for (const r of await programTrainees(url, secret)) {
                const { first, last } = splitName(r);
                if (r.rejected || r.archived || !first || !last) { row.skipped++; continue; }
                add(topicKey, topicKey, first, last, String(r.batch || '').trim(), r.approved === true ? 'Approved' : 'Pending');
                row.found++;
            }
        } catch (e) { row.error = String(e && e.message || e); }
        report.push(row);
    }
    {
        const row = { source: 'CMS', found: 0, skipped: 0, error: '' };
        try {
            for (const t of await cmsTrainees(secret)) {
                if (t.status === 'Rejected' || t.status === 'Revoked' || !t.first || !t.last) { row.skipped++; continue; }
                add('CMS', null, t.first, t.last, String(t.batch || '').trim(), t.status === 'Approved' ? 'Approved' : 'Pending');
                row.found++;
            }
        } catch (e) { row.error = String(e && e.message || e); }
        report.push(row);
    }
    // 2. against the Portal's own trainees
    const { results } = await env.DB.prepare(`SELECT username, first_name, last_name, batch_id, status FROM users WHERE user_type = 'Trainee' LIMIT 10000`).all();
    const existing = new Map();
    for (const u of (results || [])) existing.set(norm(u.first_name + ' ' + u.last_name), u);
    const summary = { people: people.size, created: 0, alreadyOnPortal: 0, accessGranted: 0, pendingCreated: 0 };
    for (const [key, p] of people) {
        let username, onPortal = existing.get(key);
        if (onPortal) { summary.alreadyOnPortal++; username = onPortal.username; }
        else {
            username = ('imp_' + slug(p.first + ' ' + p.last).replace(/-/g, '_') + (p.batch ? '_' + slug(p.batch).replace(/-/g, '') : '')).slice(0, 60);
            if (!dryRun) {
                await env.DB.prepare(
                    `INSERT OR IGNORE INTO users (first_name, mi, last_name, suffix, email, user_type, batch_id, username, password, status, training_start_date)
                     VALUES (?, NULL, ?, NULL, ?, 'Trainee', ?, ?, ?, ?, NULL)`
                ).bind(p.first, p.last, username + '@imported.invalid', p.batch || null, username, UNCLAIMED + crypto.randomUUID() + crypto.randomUUID(), p.state === 'Approved' ? 'Approved' : 'Pending').run();
                await logActivity(env.DB, username, p.batch || null, 'register', { userType: 'Trainee', imported: true });
            }
            summary.created++;
            if (p.state !== 'Approved') summary.pendingCreated++;
        }
        const approvedHere = onPortal ? onPortal.status === 'Approved' : p.state === 'Approved';
        if (approvedHere) {
            for (const topicKey of p.topics) {
                summary.accessGranted++;
                if (!dryRun) {
                    await env.TRAINING_DB.prepare(
                        `INSERT INTO trainee_topic_access (trainee_username, topic_key, status, requested_at, decided_at, decided_by)
                         VALUES (?, ?, 'Approved', datetime('now'), datetime('now'), 'import')
                         ON CONFLICT(trainee_username, topic_key) DO NOTHING`
                    ).bind(username, topicKey).run();
                }
            }
        }
    }
    return { dryRun: !!dryRun, summary, report };
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => ({}));
    try {
        return json({ success: true, ...(await runImport(env, { dryRun: body.dryRun !== false })) });
    } catch (e) {
        return json({ success: false, error: String(e && e.message || e) }, 500);
    }
}

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Import registrations</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#081226;color:#fff;max-width:760px;margin:0 auto;padding:40px 20px">
<h1 style="font-size:22px">Import existing registrations</h1>
<p style="color:#cbd5e1;line-height:1.5">Brings every trainee already registered in a program or the CMS onto the Portal, so nobody registers again. Approved ones keep their program access; pending ones appear in Registrations for approval. Each trainee then opens <b>Claim your account</b> once to choose a username and password. Preview changes nothing.</p>
<p><button id="p" style="padding:10px 16px;border-radius:8px;border:0;font-weight:700;cursor:pointer">Preview</button>
<button id="i" style="padding:10px 16px;border-radius:8px;border:0;font-weight:700;background:#f97316;color:#fff;cursor:pointer;margin-left:8px">Import now</button></p>
<pre id="out" style="background:#0f2148;padding:14px;border-radius:10px;white-space:pre-wrap;color:#e2e8f0"></pre>
<p><a href="/programs.html" style="color:#f97316;font-weight:700">&larr; Back to the Training Directory</a></p>
<script>
async function run(dry){ const o=document.getElementById('out'); o.textContent=(dry?'Previewing':'Importing')+'…';
 try{ const r=await fetch('/api/import-registrations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dryRun:dry})}); const d=await r.json();
  if(!d.success){o.textContent='Failed: '+(d.error||r.status);return;}
  o.textContent=(d.dryRun?'PREVIEW (nothing changed)\\n\\n':'IMPORTED\\n\\n')+'People found: '+d.summary.people+'\\nNew Portal accounts: '+d.summary.created+' (pending approval: '+d.summary.pendingCreated+')\\nAlready on the Portal: '+d.summary.alreadyOnPortal+'\\nProgram access granted: '+d.summary.accessGranted+'\\n\\n'+d.report.map(function(x){return x.source+': '+(x.error?('COULD NOT READ - '+x.error):(x.found+' found, '+x.skipped+' skipped'));}).join('\\n');
 }catch(e){o.textContent='Failed: '+e;} }
document.getElementById('p').onclick=function(){run(true)}; document.getElementById('i').onclick=function(){ if(confirm('Import all existing registrations into the Portal now?')) run(false); };
</script></body></html>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' } });
}

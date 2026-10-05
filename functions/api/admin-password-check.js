import { requireSession, verifyMasterCredentials, MASTER_USERNAME } from '../_utils.js';
import { SSO_PROGRAMS, SSO_TOOLS } from './launch.js';

// Admin-only: does every platform accept the admin password?
//
// GET  /api/admin-password-check   a page with one password box
// POST /api/admin-password-check   password=…  → the same page with a line per platform
//
// An admin types the Portal's admin password (MASTER_ADMIN_PASSWORD) once. This sends it, server to server over HTTPS, to each
// platform's own admin sign-in and lists what each said:
//   OK         the platform accepts it
//   INCORRECT  the platform has a different MASTER_ADMIN_PASSWORD from the one typed (fix the secret there)
//   NOT SET    the platform has no MASTER_ADMIN_PASSWORD yet
// Nothing is stored and the password is never shown back. Use it after setting or changing the secret on a platform.
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLOR = { ok: '#16a34a', bad: '#dc2626', warn: '#d97706' };
const NAMES = { 'STANDARD TRAINING': 'Standard Training', 'EA  PA TRAINING-OUTSOURCED MANP': 'EA / PA Training', 'CM TRAINING': 'CM Training', 'PROPERTY DAMAGE': 'Property Damage', 'MEDSUM AND DEMAND': 'Med Sum & Demand' };

async function ask(url, body) {
    try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return { status: res.status, body: await res.json().catch(() => null) };
    } catch (e) { return { error: String(e && e.message || e) }; }
}
const verdict = (r, okTest, notSetStatuses) => {
    if (r.error) return ['UNREACHABLE', 'warn', r.error];
    if (okTest(r)) return ['OK', 'ok', 'Accepts the admin password.'];
    if (r.status === 401) return ['INCORRECT', 'bad', 'Its MASTER_ADMIN_PASSWORD is different from the one you typed. Set the same value there (Settings → Variables and Secrets) and redeploy.'];
    if (notSetStatuses.includes(r.status)) return ['NOT SET', 'bad', 'It has no MASTER_ADMIN_PASSWORD yet. Add it as a Secret there and redeploy.'];
    if (r.status === 429) return ['TOO MANY TRIES', 'warn', 'Wait 10 minutes and check again.'];
    return ['UNEXPECTED (' + r.status + ')', 'warn', (r.body && r.body.error) || ''];
};

function page(rows, note) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin password check</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#081226;color:#fff;padding:32px 20px;max-width:760px;margin:0 auto">
<h1 style="font-size:20px">Admin password check</h1>
<p style="color:#cbd5e1;font-size:13px">Type the admin password once. Each platform is asked whether it accepts it, so you can see which one has a different <b>MASTER_ADMIN_PASSWORD</b>. Nothing is stored and the password is not shown again.</p>
<form method="POST" style="margin:14px 0"><input type="password" name="password" autocomplete="off" placeholder="Admin password" required style="padding:10px;border-radius:8px;border:0;width:260px;max-width:100%">
<button type="submit" style="padding:10px 16px;border-radius:8px;border:0;background:#f97316;color:#fff;font-weight:800;cursor:pointer;margin-left:6px">Check every platform</button></form>
${note ? `<p style="color:#fde68a;font-size:13px">${esc(note)}</p>` : ''}
${rows.map(r => `<div style="background:#0f2148;border-radius:12px;padding:14px 16px;margin:10px 0;border-left:5px solid ${COLOR[r.v[1]]}">
<div style="font-weight:800">${esc(r.name)} <span style="color:${COLOR[r.v[1]]};float:right">${esc(r.v[0])}</span></div>
<div style="font-size:12px;color:#cbd5e1;margin-top:4px">${esc(r.url)}<br>${esc(r.v[2])}</div></div>`).join('')}
<p><a href="/programs.html" style="color:#f97316;font-weight:700">&larr; Back to the Training Directory</a></p>
<script src="/show-password.js?v=1"></script></body></html>`;
}
const html = (body) => new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' } });

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    return html(page([], ''));
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const origin = request.headers.get('Origin');
    if (origin && new URL(origin).host !== new URL(request.url).host) return new Response('Cross-site request refused.', { status: 403 });
    const form = await request.formData().catch(() => null);
    const password = String((form && form.get('password')) || '').trim();
    if (!password) return html(page([], 'Type the admin password first.'));

    const rows = [];
    // this Portal
    rows.push({ name: 'The Portal', url: new URL(request.url).origin + '/', v: !String(env.MASTER_ADMIN_PASSWORD || '').trim()
        ? ['NOT SET', 'bad', 'The Portal has no MASTER_ADMIN_PASSWORD.']
        : verifyMasterCredentials(env, MASTER_USERNAME, password) ? ['OK', 'ok', 'Accepts the admin password.'] : ['INCORRECT', 'bad', 'This is not the Portal\'s MASTER_ADMIN_PASSWORD, so the other results below compare against the wrong password.'] });
    // the five programs
    const jobs = Object.entries(SSO_PROGRAMS).map(async ([key, url]) => {
        const r = await ask(url + 'api/auth/admin', { passphrase: password });
        return { name: NAMES[key] || key, url, v: verdict(r, x => x.status === 200 && x.body && x.body.token, [501]) };
    });
    // the CMS (no username = the Master Account)
    jobs.push((async () => {
        const url = SSO_TOOLS.cms, r = await ask(url + 'api/login', { portalMode: 'Admin', password });
        return { name: 'CMS', url, v: verdict(r, x => x.status === 200 && x.body && x.body.success, [503]) };
    })());
    // the Knowledge Base (it asks the Portal, so this also tests that link)
    jobs.push((async () => {
        const url = SSO_TOOLS.kb, r = await ask(url + 'api/session', { action: 'admin-login', username: MASTER_USERNAME, password });
        return { name: 'Knowledge Base', url, v: verdict(r, x => x.status === 200 && x.body && x.body.success, []) };
    })());
    rows.push(...await Promise.all(jobs));
    return html(page(rows, ''));
}

import { json, requireSession } from '../_utils.js';

// The Calendaring Simulators' saved work (Standard Training, Litigation Week, Executive Week: /simulators/calsim.html).
// One record per person in D1 (table calsim_records, made on first use):
//   {v:2, drafts:{scenario:[events]}, autos:[…], submissions:[{scn, at, events, auto}], reviews:{"<scn>|<at>":{score, comment, tasks, by, at}}, external:[…]}
//
//   GET  /api/calsim                 the signed-in person's own record, and who they are
//   GET  /api/calsim?all=1           (admins) every record with the person's name and batch
//   GET  /api/calsim?user=<username> (admins) one person's record
//   POST /api/calsim { data }        save my record. The trainer's reviews are kept as stored: nobody changes their own feedback.
//   POST /api/calsim { review: { user, key, score, comment, tasks } }   (admins) save feedback on one submission
const MAX_BYTES = 400000;
async function ensure(db) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS calsim_records (username TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)`).run();
}
const parse = (t) => { try { const d = JSON.parse(t); return d && typeof d === 'object' ? d : null; } catch (e) { return null; } };
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;
    const s = auth.session, admin = s.userType === 'Admin', db = env.TRAINING_DB;
    await ensure(db);
    const url = new URL(request.url);
    const me = { username: s.username, name: s.fullName || s.username, batch: s.batchId || '', admin };
    if (admin && url.searchParams.get('all') === '1') {
        const { results } = await db.prepare(`SELECT username, data, updated_at FROM calsim_records ORDER BY updated_at DESC LIMIT 500`).all();
        const people = {};
        for (const r of results || []) {
            const u = await env.DB.prepare(`SELECT first_name, last_name, batch_id, status FROM users WHERE username = ?`).bind(r.username).first();
            people[r.username] = u ? { name: [u.first_name, u.last_name].filter(Boolean).join(' ') || r.username, batch: u.batch_id || '' } : { name: r.username, batch: '' };
        }
        return json({ success: true, me, rows: (results || []).map(r => ({ username: r.username, name: people[r.username].name, batch: people[r.username].batch, updatedAt: r.updated_at, data: parse(r.data) })) });
    }
    const who = admin && url.searchParams.get('user') ? clean(url.searchParams.get('user'), 80) : s.username;
    const row = await db.prepare(`SELECT data FROM calsim_records WHERE username = ?`).bind(who).first();
    return json({ success: true, me, data: row ? parse(row.data) : null });
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;
    const s = auth.session, admin = s.userType === 'Admin', db = env.TRAINING_DB;
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    await ensure(db);

    if (body.review) {
        if (!admin) return json({ success: false, error: 'Admin access required.' }, 403);
        const r = body.review, user = clean(r.user, 80), key = clean(r.key, 120), score = Number(r.score);
        if (!user || !key || !Number.isFinite(score) || score < 0 || score > 100) return json({ success: false, error: 'A person, a submission and a score from 0 to 100 are required.' }, 400);
        const row = await db.prepare(`SELECT data FROM calsim_records WHERE username = ?`).bind(user).first();
        const d = (row && parse(row.data)) || null;
        if (!d) return json({ success: false, error: 'No saved calendar for that person.' }, 404);
        d.reviews = d.reviews || {};
        const tasks = {};
        Object.entries(r.tasks && typeof r.tasks === 'object' ? r.tasks : {}).slice(0, 30).forEach(([k, v]) => { const t = clean(v, 400); if (t) tasks[clean(k, 60)] = t; });
        d.reviews[key] = { score: Math.round(score), comment: clean(r.comment, 2000), tasks, by: s.fullName || s.username, at: new Date().toISOString() };
        await db.prepare(`UPDATE calsim_records SET data = ?, updated_at = ? WHERE username = ?`).bind(JSON.stringify(d), new Date().toISOString(), user).run();
        return json({ success: true, data: d });
    }

    if (!body.data || typeof body.data !== 'object') return json({ success: false, error: 'data is required.' }, 400);
    if (admin) return json({ success: true, preview: true });   // a trainer's preview saves nothing
    const text = JSON.stringify(body.data);
    if (text.length > MAX_BYTES) return json({ success: false, error: 'That calendar is too large to save.' }, 413);
    const row = await db.prepare(`SELECT data FROM calsim_records WHERE username = ?`).bind(s.username).first();
    const old = row ? parse(row.data) : null;
    const next = body.data;
    next.reviews = (old && old.reviews) || {};   // the trainer's feedback is theirs: a save from the trainee never changes it
    await db.prepare(`INSERT INTO calsim_records (username, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
        .bind(s.username, JSON.stringify(next), new Date().toISOString()).run();
    return json({ success: true, reviews: next.reviews });
}

import { json, requireSession } from '../_utils.js';

// The Calendaring Simulators' saved work (Standard Training, Litigation Week, Executive Week: /simulators/calsim.html).
// One record per person in D1 (table calsim_records, made on first use):
//   {v:2, drafts:{scenario:[events]}, autos:[…], submissions:[{scn, at, events, auto}], reviews:{"<scn>|<at>":{score, comment, tasks, by, at}}, external:[…],
//    scorecards:{track:[cards]}, excluded:{track:[ids]}, gsubs:[{track, at, result, snap}]}   (Google Calendar Simulator submissions: reviewed under reviews["g:<track>|<at>"])
//
//   GET  /api/calsim                 the signed-in person's own record, and who they are
//   GET  /api/calsim?all=1           (admins) every record with the person's name and batch
//   GET  /api/calsim?user=<username> (admins) one person's record
//   POST /api/calsim { data }        save my record. The trainer's reviews are kept as stored: nobody changes their own feedback.
//   POST /api/calsim { review: { user, key, score, comment, tasks } }   (admins) save feedback on one submission
//   POST /api/calsim { scorecard: { user, track, rows: [{ score 0-5, feedback }], calendarAt } }   (admins) the trainer's
//        CALENDAR MANAGEMENT MOCK CALL scorecard on the trainee's calendar (simulators/cal-scorecard.js), kept under
//        scorecards[track], newest last (the last 20). Like the reviews, a save from the trainee never changes them.
//   POST /api/calsim { exclude: { user, track, ids: [appointment ids] } }   (admins) appointments the trainer took out of this trainee's review and score
//        on a simulator (a sample or test appointment that isn't a caller's request), kept under excluded[track]; the trainee's saves never change them.
const MAX_BYTES = 400000;
// The scorecard's metrics, in the sheet's order (simulators/cal-scorecard.js has the same list; the checks keep them equal).
export const SCORECARD_TITLE = 'CALENDAR MANAGEMENT MOCK CALL';
export const SCORECARD_METRICS = ['Professional Introduction & Call Control', 'Client Comprehension & Flow Control', 'Information Verification & Accuracy',
    'Slot Identification & Scheduling Rule Compliance', 'Alternative Time Offering', 'Calendar Creation & Attorney Reminder Setup', 'Notes, Recap & Call Closing'];
const SCORECARD_TRACKS = ['standard', 'cm', 'ea'];
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
    let person = null;   // (a trainer opening someone's record: who it is)
    if (admin && who !== s.username) {
        const u = await env.DB.prepare(`SELECT first_name, last_name, batch_id FROM users WHERE username = ?`).bind(who).first();
        person = { name: u ? [u.first_name, u.last_name].filter(Boolean).join(' ') || who : who, batch: (u && u.batch_id) || '' };
    }
    return json({ success: true, me, data: row ? parse(row.data) : null, person });
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

    if (body.scorecard) {
        if (!admin) return json({ success: false, error: 'Admin access required.' }, 403);
        const c = body.scorecard, user = clean(c.user, 80), track = SCORECARD_TRACKS.includes(c.track) ? c.track : '';
        if (!user || !track || !Array.isArray(c.rows) || c.rows.length !== SCORECARD_METRICS.length) return json({ success: false, error: `A trainee, a simulator and all ${SCORECARD_METRICS.length} scores are required.` }, 400);
        const rows = [];
        for (let i = 0; i < SCORECARD_METRICS.length; i++) {
            const x = c.rows[i] || {}, v = Number(x.score);
            if (x.score === '' || x.score == null || !Number.isFinite(v) || v < 0 || v > 5) return json({ success: false, error: `Give "${SCORECARD_METRICS[i]}" a score from 0 to 5.` }, 400);
            rows.push({ metric: SCORECARD_METRICS[i], weight: 1, score: Math.round(v), feedback: clean(x.feedback, 600) });
        }
        const avg = rows.reduce((a, r) => a + r.weight * r.score, 0) / rows.reduce((a, r) => a + r.weight, 0);
        const card = { title: SCORECARD_TITLE, rows, average: Math.round(avg * 10) / 10, pct: Math.round(avg / 5 * 100), by: s.fullName || s.username, at: new Date().toISOString(),
            calendarAt: clean(c.calendarAt, 40) || null };
        const row = await db.prepare(`SELECT data FROM calsim_records WHERE username = ?`).bind(user).first();
        const d = (row && parse(row.data)) || { v: 2, drafts: {}, autos: [], submissions: [], reviews: {}, external: [] };
        d.scorecards = d.scorecards && typeof d.scorecards === 'object' ? d.scorecards : {};
        d.scorecards[track] = (Array.isArray(d.scorecards[track]) ? d.scorecards[track] : []).concat([card]).slice(-20);
        await db.prepare(`INSERT INTO calsim_records (username, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
            .bind(user, JSON.stringify(d), new Date().toISOString()).run();
        return json({ success: true, scorecard: card, scorecards: d.scorecards[track] });
    }

    if (body.exclude) {
        if (!admin) return json({ success: false, error: 'Admin access required.' }, 403);
        const c = body.exclude, user = clean(c.user, 80), track = SCORECARD_TRACKS.includes(c.track) ? c.track : '';
        if (!user || !track || !Array.isArray(c.ids)) return json({ success: false, error: 'A trainee, a simulator and the appointments are required.' }, 400);
        const ids = [...new Set(c.ids.map(x => clean(x, 120)).filter(Boolean))].slice(0, 60);
        const row = await db.prepare(`SELECT data FROM calsim_records WHERE username = ?`).bind(user).first();
        const d = (row && parse(row.data)) || { v: 2, drafts: {}, autos: [], submissions: [], reviews: {}, external: [] };
        d.excluded = d.excluded && typeof d.excluded === 'object' ? d.excluded : {};
        if (ids.length) d.excluded[track] = ids; else delete d.excluded[track];
        await db.prepare(`INSERT INTO calsim_records (username, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
            .bind(user, JSON.stringify(d), new Date().toISOString()).run();
        return json({ success: true, excluded: d.excluded[track] || [] });
    }

    if (!body.data || typeof body.data !== 'object') return json({ success: false, error: 'data is required.' }, 400);
    if (admin) return json({ success: true, preview: true });   // a trainer's preview saves nothing
    const text = JSON.stringify(body.data);
    if (text.length > MAX_BYTES) return json({ success: false, error: 'That calendar is too large to save.' }, 413);
    const row = await db.prepare(`SELECT data FROM calsim_records WHERE username = ?`).bind(s.username).first();
    const old = row ? parse(row.data) : null;
    const next = body.data;
    next.reviews = (old && old.reviews) || {};   // the trainer's feedback is theirs: a save from the trainee never changes it
    next.scorecards = (old && old.scorecards) || {};   // (and their scorecards)
    next.excluded = (old && old.excluded) || {};       // (and what they took out of the review)
    await db.prepare(`INSERT INTO calsim_records (username, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
        .bind(s.username, JSON.stringify(next), new Date().toISOString()).run();
    return json({ success: true, reviews: next.reviews, scorecards: next.scorecards });
}

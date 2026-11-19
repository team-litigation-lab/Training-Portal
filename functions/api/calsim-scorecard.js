import { json, sameSecret } from '../_utils.js';
import { ensure, SCORECARD_TITLE, scorecardRows, scorecardResult } from './calsim.js';

// The CALENDAR MANAGEMENT MOCK CALL scorecard shared with the Foundational Training (its 🧑‍🏫 Graders: Mock Calls & Demos):
// one scorecard, whichever side the trainer fills it in on. The Foundational Training's Worker calls this, server to server,
// with the shared gateway secret (the same X-Gateway-Key as /api/ai-gateway); no browser reaches it.
//
//   GET  /api/calsim-scorecard?name=<full name>&batch=<Batch ID>   → { success, username, cards }  (the trainee's Google
//        Calendar Simulator scorecards on the Standard Training track, newest last; username '' when no Portal account matches)
//   GET  /api/calsim-scorecard?activity=1&name=<full name>&batch=<Batch ID>   → { success, username, activity }  (📝 the trainee's
//        latest Standard Training - Calendaring Activity submission — the Day 5 Attorney Calendar Management Activity on the blank
//        calendar, gcal_reviews track 'activity': { id, submittedAt, checkScore (the automated check, %), status ('submitted' |
//        'final'), trainerScore (the trainer's, % — only once finalized), finalizedAt, finalizedBy }, or null), for its scoresheet
//        on 🧑‍🏫 Graders → 📝 Assessments (the Foundational Training's worker.js syncSimScores fills it from this)
//   POST /api/calsim-scorecard { name, batch, rows: [{ score 0-5 in half points, feedback }] (the seven call metrics, and Tools Utilization
//        when sent: the Foundational Training's eighth), by }  → { success, card }  (a scorecard saved on
//        the Foundational Training: kept with the Portal's own under scorecards.standard, so the trainee and the trainers see it
//        on the Google Calendar Simulator too)
//
// The trainee is found by their batch and their name (first and last, any case and spacing). Without AI_GATEWAY_SECRET on the
// Portal both answer 501.
const TRACK = 'standard';
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const norm = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, ' ').trim();
const parse = (t) => { try { const d = JSON.parse(t); return d && typeof d === 'object' ? d : null; } catch (e) { return null; } };

function allowed(request, env) {
    const want = String(env.AI_GATEWAY_SECRET || '').trim();
    if (!want) return json({ success: false, error: 'No AI_GATEWAY_SECRET on the Portal yet.' }, 501);
    if (!sameSecret(String(request.headers.get('X-Gateway-Key') || '').trim(), want)) return json({ success: false, error: 'Not allowed.' }, 401);
    return null;
}
// the Portal account of a trainee: their batch, then their full name
async function findUser(env, name, batch) {
    const b = clean(batch, 40).toUpperCase().replace(/\s+/g, ''), n = norm(name);
    if (!b || !n) return '';
    const { results } = await env.DB.prepare(`SELECT username, first_name, last_name, batch_id FROM users WHERE UPPER(REPLACE(batch_id, ' ', '')) = ?`).bind(b).all();
    const hit = (results || []).find(u => norm([u.first_name, u.last_name].filter(Boolean).join(' ')) === n);
    return hit ? hit.username : '';
}

export async function onRequestGet({ request, env }) {
    const no = allowed(request, env); if (no) return no;
    const url = new URL(request.url), db = env.TRAINING_DB;
    const username = await findUser(env, url.searchParams.get('name'), url.searchParams.get('batch'));
    if (url.searchParams.get('activity') != null) {
        if (!username) return json({ success: true, username: '', activity: null });
        let row = null;
        try {
            row = await db.prepare(`SELECT id, submitted_at, check_score, status, trainer, finalized_at, finalized_by FROM gcal_reviews
                WHERE username = ? AND track = 'activity' ORDER BY submitted_at DESC, id DESC LIMIT 1`).bind(username).first();
        } catch (e) { row = null; }   // (no gcal_reviews table yet: nothing submitted)
        if (!row) return json({ success: true, username, activity: null });
        const t = parse(row.trainer) || {}, ts = t.score == null || t.score === '' || !isFinite(Number(t.score)) ? null : Math.max(0, Math.min(100, Math.round(Number(t.score))));
        const final = row.status === 'final';
        return json({ success: true, username, activity: { id: row.id, submittedAt: row.submitted_at, checkScore: row.check_score == null ? null : Number(row.check_score),
            status: row.status, trainerScore: final ? ts : null, finalizedAt: final ? row.finalized_at : null, finalizedBy: final ? clean(row.finalized_by, 80) : null } });
    }
    if (!username) return json({ success: true, username: '', cards: [] });
    await ensure(db);
    const row = await db.prepare(`SELECT data FROM calsim_records WHERE username = ?`).bind(username).first();
    const d = (row && parse(row.data)) || {};
    const cards = d.scorecards && Array.isArray(d.scorecards[TRACK]) ? d.scorecards[TRACK] : [];
    return json({ success: true, username, cards });
}

export async function onRequestPost({ request, env }) {
    const no = allowed(request, env); if (no) return no;
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const db = env.TRAINING_DB, username = await findUser(env, body.name, body.batch);
    if (!username) return json({ success: false, error: 'No Portal account for that trainee in that batch.' }, 404);
    // (the seven call metrics at least; Tools Utilization too when Graders sends it, as the Foundational Training scores it)
    const got = scorecardRows(body.rows, 7); if (got.error) return json({ success: false, error: got.error }, 400);
    const rows = got.rows;
    const card = Object.assign({ title: SCORECARD_TITLE, rows }, scorecardResult(rows), { by: clean(body.by, 80) || 'Trainer',
        at: new Date().toISOString(), calendarAt: null, source: 'foundational' });
    await ensure(db);
    const row = await db.prepare(`SELECT data FROM calsim_records WHERE username = ?`).bind(username).first();
    const d = (row && parse(row.data)) || { v: 2, drafts: {}, autos: [], submissions: [], reviews: {}, external: [] };
    d.scorecards = d.scorecards && typeof d.scorecards === 'object' ? d.scorecards : {};
    d.scorecards[TRACK] = (Array.isArray(d.scorecards[TRACK]) ? d.scorecards[TRACK] : []).concat([card]).slice(-20);
    await db.prepare(`INSERT INTO calsim_records (username, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
        .bind(username, JSON.stringify(d), new Date().toISOString()).run();
    return json({ success: true, card });
}

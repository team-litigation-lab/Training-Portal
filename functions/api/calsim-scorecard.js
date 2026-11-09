import { json, sameSecret } from '../_utils.js';
import { ensure, SCORECARD_METRICS, SCORECARD_TITLE } from './calsim.js';

// The CALENDAR MANAGEMENT MOCK CALL scorecard shared with the Foundational Training (its 🧑‍🏫 Graders: Mock Calls & Demos):
// one scorecard, whichever side the trainer fills it in on. The Foundational Training's Worker calls this, server to server,
// with the shared gateway secret (the same X-Gateway-Key as /api/ai-gateway); no browser reaches it.
//
//   GET  /api/calsim-scorecard?name=<full name>&batch=<Batch ID>   → { success, username, cards }  (the trainee's Google
//        Calendar Simulator scorecards on the Standard Training track, newest last; username '' when no Portal account matches)
//   POST /api/calsim-scorecard { name, batch, rows: [{ score 0-5, feedback }], by }  → { success, card }  (a scorecard saved on
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
    if (!Array.isArray(body.rows) || body.rows.length !== SCORECARD_METRICS.length) return json({ success: false, error: `All ${SCORECARD_METRICS.length} scores are required.` }, 400);
    const rows = [];
    for (let i = 0; i < SCORECARD_METRICS.length; i++) {
        const x = body.rows[i] || {}, v = Number(x.score);
        if (x.score === '' || x.score == null || !Number.isFinite(v) || v < 0 || v > 5) return json({ success: false, error: `Give "${SCORECARD_METRICS[i]}" a score from 0 to 5.` }, 400);
        rows.push({ metric: SCORECARD_METRICS[i], weight: 1, score: Math.round(v), feedback: clean(x.feedback, 600) });
    }
    const avg = rows.reduce((a, r) => a + r.weight * r.score, 0) / rows.reduce((a, r) => a + r.weight, 0);
    const card = { title: SCORECARD_TITLE, rows, average: Math.round(avg * 10) / 10, pct: Math.round(avg / 5 * 100), by: clean(body.by, 80) || 'Trainer',
        at: new Date().toISOString(), calendarAt: null, source: 'foundational' };
    await ensure(db);
    const row = await db.prepare(`SELECT data FROM calsim_records WHERE username = ?`).bind(username).first();
    const d = (row && parse(row.data)) || { v: 2, drafts: {}, autos: [], submissions: [], reviews: {}, external: [] };
    d.scorecards = d.scorecards && typeof d.scorecards === 'object' ? d.scorecards : {};
    d.scorecards[TRACK] = (Array.isArray(d.scorecards[TRACK]) ? d.scorecards[TRACK] : []).concat([card]).slice(-20);
    await db.prepare(`INSERT INTO calsim_records (username, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
        .bind(username, JSON.stringify(d), new Date().toISOString()).run();
    return json({ success: true, card });
}

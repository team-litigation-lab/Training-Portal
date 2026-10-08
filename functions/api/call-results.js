import { json, requireSession, sameSecret } from '../_utils.js';

// Graded calls from the CMS Call Simulator (the main Call Simulator: the CMS's call-packs.js lines), so they count in the
// trainee's course. The CMS sends each graded call here, server to server, with the shared secret of the AI gateway.
//
//   POST /api/call-results   header X-Gateway-Key: <AI_GATEWAY_SECRET>
//        { first, last, batch, username, call: { id, program: 'FT'|'CM'|'PD'|'EA', line, lesson, title, score, verdict, secs, voice, at } }
//        → { success, course: { key, best } }
//   It's kept in two places:
//   - the Portal's simulator_results (the trainee's Portal account, found by first name, last name and batch; otherwise
//     "cms:<their CMS username>"), so the progress page shows it with the other simulators;
//   - the course's own store (COURSE_KV, the LSH_KV namespace every course Worker shares), under <prefix>callsim:<id>, where
//     <id> is the id the course gives the trainee (the same slug of "first last" and batch: courseTraineeId), and the
//     course shows it on its progress. EA / PA's trainee may be on an older id (trainee-alias:<id> points to it).
//     { traineeId, updatedAt, calls: [{ id, line, lesson, title, score, at }] (the latest 60), best: { <lesson or line>: { score, calls, at } } }
//   GET  /api/call-results   (a signed-in admin) the latest graded calls.
const COURSES = { FT: { prefix: 'ft:' }, CM: { prefix: 'cm:' }, PD: { prefix: 'pd:' }, EA: { prefix: '' } };
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

// The course Workers' trainee id (worker.js candidateIds, in every course): "first last" and the batch, slugged.
export function slugPart(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
export function courseTraineeId(first, last, batch) {
    const name = `${String(first || '').trim()} ${String(last || '').trim()}`.trim();
    let slug = slugPart(name).slice(0, 40);
    if (!slug) { let h = 0; for (const c of name) h = (h * 31 + c.codePointAt(0)) >>> 0; slug = 'trainee-' + h.toString(36); }
    const b = slugPart(batch).slice(0, 20);
    return b ? `${slug}--${b}` : slug;
}
// Where a call counts in its course: a Standard Training call by its lesson, the others by their line.
export const courseSlot = (call) => call.program === 'FT' && call.lesson ? `lesson${call.lesson}` : `line:${call.line}`;
export function addCall(record, traineeId, call) {
    const r = record && typeof record === 'object' ? record : {};
    const calls = (Array.isArray(r.calls) ? r.calls : []).concat([{ id: call.id, line: call.line, lesson: call.lesson || null, title: call.title, score: call.score, at: call.at }]).slice(-60);
    const best = Object.assign({}, r.best || {}), slot = courseSlot(call), was = best[slot];
    best[slot] = { score: Math.max(call.score, was ? was.score : 0), calls: (was ? was.calls : 0) + 1, at: call.at, line: call.line };
    return { traineeId, updatedAt: call.at, calls, best };
}

export async function ensureSimResultsTable(db) {   // the one copy of the simulator_results schema (sim-results.js imports it)
    await db.prepare(`CREATE TABLE IF NOT EXISTS simulator_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        full_name TEXT,
        simulator TEXT NOT NULL,
        scenario TEXT,
        score INTEGER,
        summary TEXT,
        details TEXT,
        created_at TEXT NOT NULL
    )`).run();
}

export async function onRequestPost({ request, env }) {
    const want = String(env.AI_GATEWAY_SECRET || '').trim();
    if (!want) return json({ success: false, error: 'The Portal has no AI_GATEWAY_SECRET yet.' }, 501);
    if (!sameSecret(String(request.headers.get('X-Gateway-Key') || '').trim(), want)) return json({ success: false, error: 'Not allowed.' }, 401);
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const c = (body && body.call) || {};
    const first = clip(body.first, 60), last = clip(body.last, 60), batch = clip(body.batch, 40);
    const call = { id: clip(c.id, 60), program: clip(c.program, 4).toUpperCase(), line: clip(c.line, 80), lesson: Number.isInteger(Number(c.lesson)) && Number(c.lesson) > 0 ? Number(c.lesson) : null,
        title: clip(c.title, 140), verdict: clip(c.verdict, 400), secs: Math.max(0, Math.min(3600, Math.round(Number(c.secs) || 0))), voice: clip(c.voice, 12),
        score: Math.max(0, Math.min(100, Math.round(Number(c.score)))), at: /^\d{4}-\d{2}-\d{2}T/.test(String(c.at || '')) ? String(c.at).slice(0, 30) : new Date().toISOString() };
    if (!first || !last || !call.id || !COURSES[call.program] || !Number.isFinite(call.score) || !call.line) return json({ success: false, error: 'first, last, and a call with its id, program, line and score are required.' }, 400);

    // 1. the Portal's simulator results, on the trainee's Portal account
    const db = env.DB, tdb = env.TRAINING_DB;
    let username = '', fullName = `${first} ${last}`;
    try {
        const u = await db.prepare(`SELECT username, first_name, last_name FROM users WHERE lower(first_name) = lower(?) AND lower(last_name) = lower(?) AND (? = '' OR batch_id = ?) ORDER BY id DESC LIMIT 1`)
            .bind(first, last, batch, batch).first();
        if (u) username = u.username;
    } catch (e) { /* the account lookup is a nicety */ }
    if (!username) username = 'cms:' + clip(body.username || `${first} ${last}`, 80).toLowerCase();
    await ensureSimResultsTable(tdb);
    await tdb.prepare(`INSERT INTO simulator_results (username, full_name, simulator, scenario, score, summary, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(username, fullName, 'Call Simulator', call.title, call.score, call.verdict,
            JSON.stringify({ graded: true, via: 'cms', program: call.program, line: call.line, lesson: call.lesson, call: call.id, secs: call.secs, voice: call.voice, batch }), call.at).run();

    // 2. the course's own store, where the course shows it on the trainee's progress
    let course = null;
    if (env.COURSE_KV) {
        const prefix = COURSES[call.program].prefix;
        let id = courseTraineeId(first, last, batch);
        if (call.program === 'EA') { const alias = await env.COURSE_KV.get(`trainee-alias:${id}`); if (alias && /^[a-z0-9-]{1,80}$/.test(alias)) id = alias; }
        const key = `${prefix}callsim:${id}`;
        let rec = null; try { rec = JSON.parse(await env.COURSE_KV.get(key) || 'null'); } catch (e) { rec = null; }
        const next = addCall(rec, id, call);
        await env.COURSE_KV.put(key, JSON.stringify(next));
        course = { key, best: next.best[courseSlot(call)] };
    }
    return json({ success: true, username, course });
}

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    await ensureSimResultsTable(env.TRAINING_DB);
    const { results } = await env.TRAINING_DB.prepare(`SELECT id, username, full_name, scenario, score, summary, details, created_at FROM simulator_results
        WHERE simulator = 'Call Simulator' AND details LIKE '%"via":"cms"%' ORDER BY id DESC LIMIT 200`).all();
    return json({ success: true, results: results || [] });
}

import { json, requireSession } from '../_utils.js';
import { guardPublicSim, publicIdentity } from '../_sim-guard.js';
import { courseTraineeId, ensureSimResultsTable } from './call-results.js';

// Simulator results (Call Simulator, Calendaring, …). The table is created on
// first use, so no manual migration is needed.
//   POST { simulator, scenario, score, summary, details, who }  → save a result. Signed in: as that user.
//        No session (trainees don't sign in on the portal): as who = { name, batch, program }.
//        A signed-in trainee's result from a simulator a course opened (who.program: FT, CM, PD or EA, from the link's ?program=)
//        also goes to that course's own store (COURSE_KV), under <prefix>simresults:<the course's trainee id>, so it counts in the
//        trainee's course (their Scorecard there) and not only here:
//        { traineeId, updatedAt, results: [{ simulator, scenario, score, at }] (the latest 60), best: { <simulator>: { score, count, at } } }
//   GET  → admins: everyone's latest 200; signed-in users: their own. No session: 401
//          (the simulator pages keep a visitor's own history in their browser).
const COURSES = { FT: 'ft:', CM: 'cm:', PD: 'pd:', EA: '' };
const PROGRAM_ALIASES = { STANDARD: 'FT', FOUNDATIONAL: 'FT', 'EA-PA': 'EA', 'EA/PA': 'EA' };
async function toCourse(env, session, program, row) {
    const code = String(program || '').trim().toUpperCase(), c = PROGRAM_ALIASES[code] || code;
    if (!env.COURSE_KV || !(c in COURSES) || !session || session.userType !== 'Trainee') return null;
    const u = await env.DB.prepare(`SELECT first_name, last_name, batch_id FROM users WHERE username = ?`).bind(session.username).first();
    if (!u || !u.first_name || !u.last_name) return null;
    let id = courseTraineeId(u.first_name, u.last_name, u.batch_id || '');
    if (c === 'EA') { const alias = await env.COURSE_KV.get(`trainee-alias:${id}`); if (alias && /^[a-z0-9-]{1,80}$/.test(alias)) id = alias; }
    const key = `${COURSES[c]}simresults:${id}`;
    let rec = null; try { rec = JSON.parse(await env.COURSE_KV.get(key) || 'null'); } catch (e) { rec = null; }
    rec = rec && typeof rec === 'object' ? rec : {};
    const results = (Array.isArray(rec.results) ? rec.results : []).concat([row]).slice(-60);
    const best = Object.assign({}, rec.best || {});
    if (row.score != null) { const was = best[row.simulator]; best[row.simulator] = { score: Math.max(row.score, was ? was.score : 0), count: (was ? was.count : 0) + 1, at: row.at }; }
    await env.COURSE_KV.put(key, JSON.stringify({ traineeId: id, updatedAt: row.at, results, best }));
    return key;
}


export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;
    try {
        await ensureSimResultsTable(env.TRAINING_DB);
        const isAdmin = auth.session && auth.session.userType === 'Admin';
        const stmt = isAdmin
            ? env.TRAINING_DB.prepare(`SELECT id, username, full_name, simulator, scenario, score, summary, created_at FROM simulator_results ORDER BY id DESC LIMIT 200`)
            : env.TRAINING_DB.prepare(`SELECT id, username, full_name, simulator, scenario, score, summary, created_at FROM simulator_results WHERE username = ? ORDER BY id DESC LIMIT 50`).bind(auth.session.username);
        const { results } = await stmt.all();
        return json({ success: true, admin: isAdmin, results: results || [] });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env);
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    let username, fullName;
    if (auth.ok) {
        username = auth.session.username;
        fullName = auth.session.fullName || auth.session.username;
    } else {
        const blocked = await guardPublicSim(request, env);
        if (blocked) return blocked;
        const who = publicIdentity(body);
        if (who.name.length < 2) return json({ success: false, error: 'Enter your name to save results.' }, 400);
        username = `guest:${who.batch || 'no-batch'}:${who.name.toLowerCase()}`.slice(0, 140);
        fullName = who.batch ? `${who.name} · ${who.batch}` : who.name;
        body.details = Object.assign({}, body.details || {}, { who });
    }
    const simulator = String(body.simulator || '').slice(0, 60);
    if (!simulator) return json({ success: false, error: 'simulator is required.' }, 400);
    const score = Number.isFinite(Number(body.score)) ? Math.max(0, Math.min(100, Math.round(Number(body.score)))) : null;
    try {
        await ensureSimResultsTable(env.TRAINING_DB);
        await env.TRAINING_DB.prepare(`INSERT INTO simulator_results (username, full_name, simulator, scenario, score, summary, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(username, fullName, simulator, String(body.scenario || '').slice(0, 160), score,
                  String(body.summary || '').slice(0, 600), JSON.stringify(body.details || {}).slice(0, 20000), new Date().toISOString())
            .run();
        let course = null;
        if (auth.ok) {
            const who = body.who && typeof body.who === 'object' ? body.who : {};
            try { course = await toCourse(env, auth.session, who.program, { simulator, scenario: String(body.scenario || '').slice(0, 160), score, at: new Date().toISOString() }); } catch (e) { course = null; }
        }
        return json({ success: true, course });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

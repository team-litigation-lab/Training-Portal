import { json, requireSession } from '../_utils.js';
import { guardPublicSim, publicIdentity } from '../_sim-guard.js';

// Simulator results (Call Simulator, Calendaring, …). The table is created on
// first use, so no manual migration is needed.
//   POST { simulator, scenario, score, summary, details, who }  → save a result. Signed in: as that user.
//        No session (trainees don't sign in on the portal): as who = { name, batch, program }.
//   GET  → admins: everyone's latest 200; signed-in users: their own. No session: 401
//          (the simulator pages keep a visitor's own history in their browser).
async function ensureTable(db) {
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

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;
    try {
        await ensureTable(env.TRAINING_DB);
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
        await ensureTable(env.TRAINING_DB);
        await env.TRAINING_DB.prepare(`INSERT INTO simulator_results (username, full_name, simulator, scenario, score, summary, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(username, fullName, simulator, String(body.scenario || '').slice(0, 160), score,
                  String(body.summary || '').slice(0, 600), JSON.stringify(body.details || {}).slice(0, 20000), new Date().toISOString())
            .run();
        return json({ success: true });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

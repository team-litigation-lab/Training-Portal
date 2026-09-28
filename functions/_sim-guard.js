import { json, getSiteState } from './_utils.js';

// Guard for the simulators' public endpoints. The portal has no trainee
// sign-in (each program has its own), so /api/sim-ai and /api/sim-results
// also serve visitors without a session. This keeps that from turning into
// an open door to the Gemini key:
//   1. a site-wide Lock closes the simulators too;
//   2. requests must come from this portal's own pages (Origin = this host);
//   3. a per-IP rate limit (SIM_RATE_LIMIT requests per 10 minutes, default 400: a whole class often shares
//      one office connection, and one practice call alone makes 15–25 requests).
// Signed-in admins skip this (their session is already checked).
const WINDOW_SECONDS = 600;

export async function guardPublicSim(request, env) {
    const state = await getSiteState(env.DB);
    if (state.locked) return json({ success: false, error: 'This page has been locked by an administrator.', code: 'SITE_LOCKED' }, 423);

    const origin = request.headers.get('Origin');
    const host = new URL(request.url).host;
    let originHost = null;
    try { originHost = origin ? new URL(origin).host : null; } catch (e) { originHost = null; }
    if (originHost !== host) return json({ success: false, error: 'Simulators can only be used from the LSH Training Portal.' }, 403);

    const limit = Math.max(5, Number(env.SIM_RATE_LIMIT) || 400);
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const bucket = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
    const db = env.TRAINING_DB;
    try {
        await db.prepare(`CREATE TABLE IF NOT EXISTS simulator_rate (
            ip TEXT NOT NULL,
            bucket INTEGER NOT NULL,
            hits INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (ip, bucket)
        )`).run();
        await db.prepare(`INSERT INTO simulator_rate (ip, bucket, hits) VALUES (?, ?, 1)
            ON CONFLICT(ip, bucket) DO UPDATE SET hits = hits + 1`).bind(ip, bucket).run();
        const row = await db.prepare(`SELECT hits FROM simulator_rate WHERE ip = ? AND bucket = ?`).bind(ip, bucket).first();
        // Old windows are useless — trim them now and then.
        if (Math.random() < 0.05) await db.prepare(`DELETE FROM simulator_rate WHERE bucket < ?`).bind(bucket - 1).run();
        if (row && row.hits > limit) {
            return json({ success: false, error: 'Too many simulator requests from this connection — wait a few minutes and try again.' }, 429);
        }
    } catch (e) {
        // If the counter itself fails, don't take the simulators down with it.
        console.error('guardPublicSim: rate counter failed', e);
    }
    return null;
}

// A visitor's self-reported identity for saving results (no account here).
export function publicIdentity(body) {
    const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
    const who = (body && body.who) || {};
    return { name: clean(who.name, 80), batch: clean(who.batch, 40), program: clean(who.program, 20) };
}

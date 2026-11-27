import { json, getCookie, verifySessionToken, requireSession, upsertSessionHeartbeat, HEARTBEAT_GRACE_SECONDS, SESSION_IDLE_SECONDS, MASTER_USERNAME, sessionGoogleOk, googleNeededMessage } from '../_utils.js';

export async function onRequestGet({ request, env }) {
    // Who's currently online, their real name, and which case they're
    // viewing — that's admin dashboard info, not something every visitor
    // should be able to pull with no login at all.
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    const { results } = await env.DB.prepare(
        `SELECT username, full_name, batch_id, user_type, current_case, last_seen
         FROM heartbeats ORDER BY last_seen DESC`
    ).all();
    return json(results || []);
}

export async function onRequestPost({ request, env }) {
    // NOTE: deliberately NOT using requireSession() here. requireSession()
    // treats a session as dead unless a *recent* heartbeats row already
    // exists (isSessionHeartbeatAlive) — but this endpoint's whole job is
    // to create/refresh that very row. Right after login there is no row
    // yet, so requireSession() would 401 with SESSION_EXPIRED on the very
    // first heartbeat tick and immediately log the user back out.
    //
    // So this endpoint does the lighter checks itself: valid signed
    // session cookie + still-approved account. It intentionally skips the
    // "is there already a live heartbeat" check, since that check doesn't
    // make sense for the endpoint that establishes liveness in the first
    // place.
    const token = getCookie(request, 'lsh_session');
    const session = await verifySessionToken(token, env.SESSION_SECRET);
    if (!session) {
        return json({ success: false, error: 'Not authenticated.', code: 'NOT_AUTHENTICATED' }, 401);
    }
    if (!sessionGoogleOk(env, session)) {
        return json({ success: false, error: googleNeededMessage(env), code: 'GOOGLE_REQUIRED' }, 401);
    }

    // The Master Account has no users row by design (login.js): skip the
    // revocation check for it, as requireSession, me.js and _middleware.js do.
    if (session.username !== MASTER_USERNAME) {
        const liveUser = await env.DB.prepare(`SELECT status FROM users WHERE username = ?`).bind(session.username).first();
        if (!liveUser || liveUser.status !== 'Approved') {
            return json({ success: false, error: 'Your access has been revoked.', code: 'ACCESS_REVOKED' }, 401);
        }
    }

    const db = env.DB;
    // 🔓 8 hours with no activity ends a session (SESSION_IDLE_SECONDS): a tab that comes back after that can't bring it
    // back with a beat. A sign-in younger than that is good with no row yet (the first beat after logging in).
    const row = await db.prepare(`SELECT 1 AS ok FROM heartbeats WHERE username = ? AND datetime(last_seen) >= datetime('now', ?)`)
        .bind(session.username, `-${SESSION_IDLE_SECONDS} seconds`).first().catch(() => null);
    const fresh = Number(session.iat) && (Date.now() / 1000 - Number(session.iat)) < SESSION_IDLE_SECONDS;
    if (!row && !fresh) return json({ success: false, error: 'Session expired.', code: 'SESSION_EXPIRED' }, 401);
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const { fullName, currentCase } = body;

    // Identity comes from the verified session, not the request body —
    // otherwise anyone could POST a heartbeat claiming to be any username,
    // overwriting that user's "currently online" row.
    await upsertSessionHeartbeat(db, {
        username: session.username,
        fullName: fullName || session.username,
        batchId: session.batchId,
        userType: session.userType,
        currentCase: currentCase || null
    });

    return json({ success: true, graceSeconds: HEARTBEAT_GRACE_SECONDS });
}

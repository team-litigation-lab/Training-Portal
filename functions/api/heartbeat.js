import { json, getCookie, verifySessionToken, requireSession, upsertSessionHeartbeat, HEARTBEAT_GRACE_SECONDS } from '../_utils.js';

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

    const liveUser = await env.DB.prepare(`SELECT status FROM users WHERE username = ?`).bind(session.username).first();
    if (!liveUser || liveUser.status !== 'Approved') {
        return json({ success: false, error: 'Your access has been revoked.', code: 'ACCESS_REVOKED' }, 401);
    }

    const db = env.DB;
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

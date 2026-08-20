import { json, getCookie, verifySessionToken, clearSessionCookie, logActivity } from '../_utils.js';

// Deliberately NOT using requireSession() — logout's whole job is to end a
// session, and it should still succeed even if the heartbeat has already
// gone stale (isSessionHeartbeatAlive) or been wiped entirely (e.g. by a
// site Lock, see site-state.js). Only a valid signed cookie is needed to
// know who's logging out; requireSession would needlessly reject exactly
// the case this endpoint exists to clean up.
export async function onRequestPost({ request, env }) {
    const token = getCookie(request, 'lsh_session');
    const session = await verifySessionToken(token, env.SESSION_SECRET);

    if (session) {
        // logActivity's 'logout' rows are what server-logs.js pairs against
        // 'login' rows to compute session duration — without this, that
        // pairing logic has nothing to pair with.
        await logActivity(env.DB, session.username, session.batchId, 'logout', null);
        await env.DB.prepare(`DELETE FROM heartbeats WHERE username = ?`).bind(session.username).run();
    }

    // Always clear the cookie, even if the token was missing/invalid/expired
    // — the goal is "this browser is definitely no longer authenticated,"
    // not "this session was still technically alive."
    return json({ success: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}

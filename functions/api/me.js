import { json, getCookie, verifySessionToken, getSiteState, upsertSessionHeartbeat, buildFullName } from '../_utils.js';

// Who is signed in on this browser? GET /api/me → { success: true, user: { username, fullName, userType, batchId } } or 401.
// A page opened in a new tab (coming back from a program, or a bookmark) has the signed cookie but no copy of the person in the
// tab's own storage: it asks here, remembers the answer, and the heartbeat starts again, so nobody is sent to the sign-in page
// while they are signed in. The cookie is the credential; this only reads it (and restarts the heartbeat, like the sign-in does).
export async function onRequestGet({ request, env }) {
    const session = await verifySessionToken(getCookie(request, 'lsh_session'), env.SESSION_SECRET);
    if (!session) return json({ success: false, code: 'NOT_AUTHENTICATED' }, 401, { 'Cache-Control': 'no-store' });
    if ((await getSiteState(env.DB)).locked) return json({ success: false, code: 'SITE_LOCKED' }, 423, { 'Cache-Control': 'no-store' });
    let fullName = session.fullName || session.username;
    if (session.username !== 'LSHADMIN123') {
        const u = await env.DB.prepare(`SELECT * FROM users WHERE username = ?`).bind(session.username).first();
        if (!u || u.status !== 'Approved') return json({ success: false, code: 'ACCESS_REVOKED' }, 401, { 'Cache-Control': 'no-store' });
        fullName = buildFullName(u) || fullName;
    }
    await upsertSessionHeartbeat(env.DB, { username: session.username, fullName, batchId: session.batchId, userType: session.userType });
    return json({ success: true, user: { username: session.username, fullName, userType: session.userType, batchId: session.batchId || null } }, 200, { 'Cache-Control': 'no-store' });
}

import { json, requireSession, verifyMasterCredentials, normalizePassword, masterUnlocked, masterCookie, logActivity, loginBlocked, loginFailed, MASTER_USERNAME } from '../_utils.js';

// Master Control is the Master Account's (LSHADMIN123). A trainer's own admin account opens everything else; to open
// Master Control it types the Master Account's password once, here, for the rest of that sign-in.
//
// GET  /api/master-unlock               → { success, unlocked }
// POST /api/master-unlock { password }  → { success } and the lsh_master cookie (see masterUnlocked in _utils.js)
export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    return json({ success: true, unlocked: await masterUnlocked(request, env, auth.session), master: auth.session.username === MASTER_USERNAME }, 200, { 'Cache-Control': 'no-store' });
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const { session } = auth;
    let body = {};
    try { body = await request.json(); } catch (e) { /* empty */ }
    if (!normalizePassword(env.MASTER_ADMIN_PASSWORD)) {
        return json({ success: false, code: 'MASTER_NOT_SET', error: "The master admin password isn't set up on this site yet. In Cloudflare, add MASTER_ADMIN_PASSWORD (Settings → Variables and Secrets) and redeploy." }, 503);
    }
    // Wrong passwords count toward the same limit as the sign-in (10 in 10 minutes), keyed to the Master Account.
    if (await loginBlocked(env.DB, request, MASTER_USERNAME)) {
        return json({ success: false, code: 'TOO_MANY_TRIES', error: 'Too many wrong passwords. Wait 10 minutes and try again.' }, 429);
    }
    if (!verifyMasterCredentials(env, MASTER_USERNAME, String(body.password || ''))) {
        await loginFailed(env.DB, request, MASTER_USERNAME);
        return json({ success: false, error: 'That is not the LSHADMIN123 password.' }, 401);
    }
    await logActivity(env.DB, session.username, session.batchId, 'master-unlock', null);
    return json({ success: true }, 200, { 'Set-Cookie': await masterCookie(env, session), 'Cache-Control': 'no-store' });
}

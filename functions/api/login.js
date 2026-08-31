import { json, logActivity, verifyPassword, isLegacyPlaintext, upgradePasswordHash, createSessionToken, sessionCookie, upsertSessionHeartbeat, buildFullName, MASTER_USERNAME, verifyMasterCredentials } from '../_utils.js';

export async function onRequestPost({ request, env }) {
    const db = env.DB;
    let body;
    try { 
        body = await request.json(); 
    } catch (e) { 
        return json({ success: false, error: 'Invalid request body.' }, 400); 
    }

    const { username, password, portalMode } = body;
    if (!username || !password) {
        return json({ success: false, error: 'Please enter both username and password.' }, 400);
    }

    // Portal tabs only ever send 'Trainee' or 'Admin'. Anything else means
    // the client didn't tell us which portal this is — fail closed rather
    // than silently letting a request with a missing/garbled portalMode
    // through the wrong-portal check below.
    if (portalMode !== 'Trainee' && portalMode !== 'Admin') {
        return json({ success: false, error: 'Invalid portal selection.' }, 400);
    }

    // The Master Account logs in through the standard Admin Portal like any
    // other admin — same session, same dashboard access — AND is the only
    // account that can Lock/Unlock the site (see site-state.js). It has no
    // row in the users table, so its credentials are checked against
    // env.MASTER_ADMIN_PASSWORD via verifyMasterCredentials() — the same
    // helper Lock/Unlock use, so there's exactly one source of truth for
    // this password rather than two that could drift apart.
    let user;
    let dbUserType;
    if (username === MASTER_USERNAME) {
        if (portalMode !== 'Admin') {
            return json({
                success: false,
                error: 'Wrong Portal: this account is not authorized to log in through the Trainee Portal.',
                code: 'WRONG_PORTAL'
            }, 403);
        }
        if (!verifyMasterCredentials(env, username, password)) {
            return json({ success: false, error: 'Incorrect username or password.' }, 401);
        }
        user = { id: 'MASTER', username: MASTER_USERNAME, batch_id: 'MASTER-ADMIN', status: 'Approved' };
        dbUserType = 'Admin';
    } else {
        // Fetch by username only — password checked via Web Crypto in JS
        user = await db.prepare(`SELECT * FROM users WHERE username = ?`).bind(username).first();
        if (!user || !(await verifyPassword(password, user.password))) {
            return json({ success: false, error: 'Incorrect username or password.' }, 401);
        }

        // Auto-upgrade legacy plaintext passwords to PBKDF2 SHA-256
        if (isLegacyPlaintext(user.password)) {
            await upgradePasswordHash(db, user.id, password);
        }

        dbUserType = user.user_type || user.userType || 'Trainee';

        // Strict, symmetric portal check: an account's real user_type must
        // match the tab it's logging in from, in both directions. A Trainee
        // cannot sneak into the Admin Portal, and an Admin cannot log in
        // through the Trainee Portal and still land in a session marked
        // userType: 'Admin'. (The Master Account's own portal check is
        // handled above, since it has no user_type field to compare here.)
        if (portalMode !== dbUserType) {
            const portalLabel = portalMode === 'Admin' ? 'Admin Portal' : 'Trainee Portal';
            return json({
                success: false,
                error: `Wrong Portal: this account is not authorized to log in through the ${portalLabel}.`,
                code: 'WRONG_PORTAL'
            }, 403);
        }
    }

    // Enforce account status restrictions (master account is always Approved)
    if (user.status === 'Pending') {
        return json({ success: false, error: 'Your registration is still pending admin approval.' }, 403);
    }
    if (user.status === 'Rejected') {
        return json({ success: false, error: 'This registration was rejected. Please contact an administrator.' }, 403);
    }
    if (user.status === 'Revoked' || user.status === 'Suspended') {
        return json({ success: false, error: 'Your access has been revoked or suspended by an administrator.' }, 403);
    }

    await logActivity(db, user.username, user.batch_id, 'login', null);
    const fullName = user.id === 'MASTER' ? 'System Administrator' : buildFullName(user);

    // Seed heartbeat so immediate subsequent requests pass the grace window
    await upsertSessionHeartbeat(db, {
        username: user.username,
        fullName,
        batchId: user.batch_id,
        userType: dbUserType
    });

    const token = await createSessionToken(
        { 
            sub: user.id, 
            username: user.username, 
            batchId: user.batch_id, 
            userType: dbUserType, 
            fullName 
        },
        env.SESSION_SECRET
    );

    const { password: _pw, ...safeUser } = user;
    return json(
        { success: true, user: { ...safeUser, fullName, userType: dbUserType } }, 
        200, 
        { 'Set-Cookie': sessionCookie(token, 43200) }
    );
}

import { json, logActivity, verifyPassword, isLegacyPlaintext, upgradePasswordHash, createSessionToken, sessionCookie, upsertSessionHeartbeat, buildFullName } from '../_utils.js';

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

    // Master Account Override (Un-revokable System Admin).
    // Still bound by the portal check below — the master account is an
    // Admin account, so it only ever belongs on the Admin Portal, same as
    // every other Admin. Handled here as a stand-in for a DB row, then it
    // continues to the shared portalMode check like everyone else.
    let user;
    let dbUserType;
    if (username === "LSHADMIN123") {
        // Master password now lives in env.MASTER_ADMIN_PASSWORD (a Cloudflare
        // Pages secret), never in source. If it isn't configured, fail closed
        // instead of falling back to any default — an unset secret must never
        // silently become "no password required" or a guessable literal.
        if (!env.MASTER_ADMIN_PASSWORD) {
            console.error('MASTER_ADMIN_PASSWORD is not configured — refusing master login.');
            return json({ success: false, error: 'Incorrect username or password.' }, 401);
        }
        if (password !== env.MASTER_ADMIN_PASSWORD) {
            return json({ success: false, error: 'Incorrect username or password.' }, 401);
        }
        user = { id: 'MASTER', username: 'LSHADMIN123', batch_id: 'MASTER-ADMIN', status: 'Approved' };
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
    }

    // Strict, symmetric portal check: an account's real user_type must match
    // the tab it's logging in from, in both directions. A Trainee cannot
    // sneak into the Admin Portal, and an Admin cannot log in through the
    // Trainee Portal and still land in a session marked userType: 'Admin'.
    if (portalMode !== dbUserType) {
        const portalLabel = portalMode === 'Admin' ? 'Admin Portal' : 'Trainee Portal';
        return json({
            success: false,
            error: `Wrong Portal: this account is not authorized to log in through the ${portalLabel}.`,
            code: 'WRONG_PORTAL'
        }, 403);
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

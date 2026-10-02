import { json, logActivity, verifyPassword, isLegacyPlaintext, upgradePasswordHash, createSessionToken, sessionCookie, upsertSessionHeartbeat, buildFullName, MASTER_USERNAME, verifyMasterCredentials } from '../_utils.js';

// Normalizes a name for comparison — lowercase, strips periods/commas,
// collapses whitespace — so "Juan D. Dela Cruz, Jr." and "juan d dela cruz jr"
// match regardless of how a trainee happens to type it.
function normalizeName(str) {
    return String(str || '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

export async function onRequestPost({ request, env }) {
    const db = env.DB;
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return json({ success: false, error: 'Invalid request body.' }, 400);
    }

    const { portalMode } = body;
    if (portalMode !== 'Trainee' && portalMode !== 'Admin') {
        return json({ success: false, error: 'Invalid portal selection.' }, 400);
    }

    let user;
    let dbUserType;

    if (portalMode === 'Trainee') {
        // Trainees sign in here once, with their username and password, and open each
        // training program from the Training Directory (/api/launch hands them over).
        // A name alone isn't enough: it can be guessed, and two trainees can share one.
        const { username, password } = body;
        if (!username || !password) {
            return json({ success: false, error: 'Please enter both username and password.' }, 400);
        }
        user = await db.prepare(`SELECT * FROM users WHERE username = ?`).bind(username).first();
        if (username === MASTER_USERNAME || !user || !(await verifyPassword(password, user.password))) {
            return json({ success: false, error: 'Incorrect username or password.' }, 401);
        }
        if (isLegacyPlaintext(user.password)) {
            await upgradePasswordHash(db, user.id, password);
        }
        dbUserType = user.user_type || user.userType || 'Trainee';
        if (dbUserType !== 'Trainee') {
            return json({
                success: false,
                error: 'Wrong Portal: administrators sign in through the Admin Portal.',
                code: 'WRONG_PORTAL'
            }, 403);
        }
    } else {
        // Admin Portal — unchanged: real username + password required,
        // including the Master Account's own credential path.
        const { username, password } = body;
        if (!username || !password) {
            return json({ success: false, error: 'Please enter both username and password.' }, 400);
        }

        if (username === MASTER_USERNAME) {
            if (!verifyMasterCredentials(env, username, password)) {
                return json({ success: false, error: 'Incorrect username or password.' }, 401);
            }
            user = { id: 'MASTER', username: MASTER_USERNAME, batch_id: 'MASTER-ADMIN', status: 'Approved' };
            dbUserType = 'Admin';
        } else {
            user = await db.prepare(`SELECT * FROM users WHERE username = ?`).bind(username).first();
            if (!user || !(await verifyPassword(password, user.password))) {
                return json({ success: false, error: 'Incorrect username or password.' }, 401);
            }
            if (isLegacyPlaintext(user.password)) {
                await upgradePasswordHash(db, user.id, password);
            }

            dbUserType = user.user_type || user.userType || 'Trainee';
            if (dbUserType !== 'Admin') {
                return json({
                    success: false,
                    error: 'Wrong Portal: this account is not authorized to log in through the Admin Portal.',
                    code: 'WRONG_PORTAL'
                }, 403);
            }
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
    const fullNameOut = user.id === 'MASTER' ? 'System Administrator' : buildFullName(user);

    // Seed heartbeat so immediate subsequent requests pass the grace window
    await upsertSessionHeartbeat(db, {
        username: user.username,
        fullName: fullNameOut,
        batchId: user.batch_id,
        userType: dbUserType
    });

    const token = await createSessionToken(
        {
            sub: user.id,
            username: user.username,
            batchId: user.batch_id,
            userType: dbUserType,
            fullName: fullNameOut
        },
        env.SESSION_SECRET
    );

    const { password: _pw, ...safeUser } = user;
    return json(
        { success: true, user: { ...safeUser, fullName: fullNameOut, userType: dbUserType } },
        200,
        { 'Set-Cookie': sessionCookie(token, 43200) }
    );
}

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

    // Trainee sign-in on the main portal is retired: the portal is an open
    // directory, and each training program has its own sign-in. Only the
    // admin side (monitoring) is locked.
    if (portalMode === 'Trainee') {
        return json({ success: false, error: 'Trainees no longer sign in here. Open your training from the Training Directory; each program has its own sign-in.' }, 403);
    }

    let user;
    let dbUserType;

    if (portalMode === 'Trainee') {
        // Trainees log in with their full name only — no password at all.
        // This is a deliberate, explicitly-requested tradeoff: lower
        // friction for trainee access, at the cost that anyone who knows a
        // trainee's name can sign in as them. Scoped to Trainee accounts
        // only — Admin access below is completely unaffected and still
        // requires a real username + password.
        const { fullName } = body;
        if (!fullName || !fullName.trim()) {
            return json({ success: false, error: 'Please enter your full name.' }, 400);
        }

        const { results: trainees } = await db.prepare(
            `SELECT * FROM users WHERE user_type = 'Trainee'`
        ).all();

        const target = normalizeName(fullName);
        const matches = (trainees || []).filter(u => normalizeName(buildFullName(u)) === target);

        if (matches.length === 0) {
            return json({ success: false, error: 'No trainee account found with that name.' }, 401);
        }
        if (matches.length > 1) {
            // No password to disambiguate two trainees who happen to share
            // a name — fail safe rather than silently logging into either one.
            return json({ success: false, error: 'Multiple accounts match this name — please contact an administrator for assistance.' }, 409);
        }

        user = matches[0];
        dbUserType = 'Trainee';
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

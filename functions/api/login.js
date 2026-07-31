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

    // Master Account Override (Un-revokable System Admin)
    if (username === "LSHADMIN123" && password === "MASTER_ADMIN_PASSWORD_HERE") {
        return json({
            success: true,
            user: {
                fullName: "System Administrator",
                batchId: "MASTER-ADMIN",
                userType: "Admin",
                username: "LSHADMIN123"
            }
        });
    }

    // Fetch by username only — password checked via Web Crypto in JS
    const user = await db.prepare(`SELECT * FROM users WHERE username = ?`).bind(username).first();
    if (!user || !(await verifyPassword(password, user.password))) {
        return json({ success: false, error: 'Incorrect username or password.' }, 401);
    }

    // Auto-upgrade legacy plaintext passwords to PBKDF2 SHA-256
    if (isLegacyPlaintext(user.password)) {
        await upgradePasswordHash(db, user.id, password);
    }

    // Validate role against the selected login tab
    const dbUserType = user.user_type || user.userType || 'Trainee';
    if (portalMode === 'Admin' && dbUserType !== 'Admin') {
        return json({ success: false, error: 'Unauthorized: Trainee accounts cannot access the Admin Portal.' }, 403);
    }

    // Enforce account status restrictions
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
    const fullName = buildFullName(user);

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

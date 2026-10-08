import { json, requireSession, tombstoneUser, logActivity, isMaster, MASTER_USERNAME } from '../_utils.js';

// Permanent, irreversible account revocation: tombstones the row (so the
// username/email is recognized as previously-deleted — see
// isUsernameTombstoned() in _utils.js) and then deletes it entirely. This
// is deliberately its own endpoint, separate from update-status.js —
// Approve/Reject are reversible outcomes on a still-pending row, while
// revocation is a one-way action on an existing account.
//
// Permission rules:
//   - The Master Account can never be revoked, by anyone.
//   - Only the Master Account may revoke another Admin.
//   - Any Admin may revoke a Trainee.
//   - An Admin may not revoke their own currently-logged-in account.
export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const { session } = auth;
    const db = env.DB;

    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const { userId } = body;
    if (!userId) return json({ success: false, error: 'User ID is required.' }, 400);

    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first();
    if (!user) return json({ success: false, error: 'User not found.' }, 404);

    if (user.username === MASTER_USERNAME) {
        return json({ success: false, error: 'The Master Account can never be revoked.' }, 403);
    }
    if (user.user_type === 'Admin' && !isMaster(session)) {
        return json({ success: false, error: 'Only the Master Account can revoke an Admin.' }, 403);
    }
    if (user.username === session.username) {
        return json({ success: false, error: 'You cannot revoke your own account.' }, 403);
    }

    await tombstoneUser(db, user, session.username);
    await db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
    // Leave nothing behind that still looks like a live account: the presence row and the program access (their submissions and results stay as records).
    try { await db.prepare(`DELETE FROM heartbeats WHERE username = ?`).bind(user.username).run(); } catch (e) { /* none */ }
    try { if (env.TRAINING_DB) await env.TRAINING_DB.prepare(`DELETE FROM trainee_topic_access WHERE trainee_username = ?`).bind(user.username).run(); } catch (e) { /* none */ }
    await logActivity(db, session.username, session.batchId, 'revoke-user', { userId, username: user.username });

    return json({ success: true });
}

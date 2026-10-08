import { json, logActivity, requireSession, MASTER_USERNAME } from '../_utils.js';

// Handles the two reversible access-control outcomes on an already-approved
// account: Suspend (temporarily lock out) and Reactivate (restore access).
// This is distinct from update-status.js (which resolves a *pending*
// registration) and from revoke-user.js (which is permanent and deletes
// the account) — this endpoint only ever moves a row between Approved and
// Suspended, and never touches Pending/Rejected rows or deletes anything.
export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const { session } = auth;
    const db = env.DB;

    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const { userId, newStatus } = body;
    if (!userId || !['Suspended', 'Approved'].includes(newStatus)) {
        return json({ success: false, error: 'Invalid status update request.' }, 400);
    }

    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first();
    if (!user) return json({ success: false, error: 'User not found.' }, 404);

    if (newStatus === 'Suspended' && user.status !== 'Approved') {
        return json({ success: false, error: 'Only approved accounts can be suspended.' }, 400);
    }
    if (newStatus === 'Approved' && user.status !== 'Suspended') {
        return json({ success: false, error: 'Only suspended accounts can be reactivated.' }, 400);
    }
    if (newStatus === 'Suspended' && user.username === MASTER_USERNAME) {
        return json({ success: false, error: 'The Master Account cannot be suspended.' }, 403);
    }
    if (newStatus === 'Suspended' && user.username === session.username) {
        return json({ success: false, error: 'You cannot suspend your own account.' }, 403);
    }

    await db.prepare(`UPDATE users SET status = ? WHERE id = ?`).bind(newStatus, userId).run();
    await logActivity(db, session.username, session.batchId, 'update-access', { userId, username: user.username, newStatus });

    return json({ success: true });
}

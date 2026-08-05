import { json, requireSession, buildFullName, nextBatchId, tombstoneUser, logActivity, MASTER_USERNAME } from '../_utils.js';

export async function onRequestGet({ request, env }) {
    // Requires an authenticated Admin session
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    try {
        // Fetch all accounts from env.DB, excluding passwords
        const { results } = await env.DB.prepare(`
            SELECT 
                id, first_name, mi, last_name, suffix,
                email, user_type, batch_id, username, status,
                training_start_date, created_at
            FROM users 
            ORDER BY created_at ASC
        `).all();

        // Format names cleanly for frontend grouping
        const formattedUsers = (results || []).map(u => ({
            ...u,
            fullName: buildFullName(u),
            userType: u.user_type || 'Trainee',
            batchId: u.batch_id || 'UNASSIGNED',
            trainingStartDate: u.training_start_date || null
        }));

        return json(formattedUsers);
    } catch (err) {
        return json({ success: false, error: 'Failed to fetch users: ' + err.message }, 500);
    }
}

/**
 * Admin actions on a single account: approve / reject a pending registration,
 * or suspend / reactivate / revoke an existing one. One endpoint, dispatched
 * by an `action` field, so the frontend only needs one call shape.
 */
export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    let body;
    try {
        body = await request.json();
    } catch (e) {
        return json({ success: false, error: 'Invalid request body.' }, 400);
    }

    const { id, action } = body || {};
    const VALID_ACTIONS = ['approve', 'reject', 'suspend', 'reactivate', 'revoke'];
    if (!id || !VALID_ACTIONS.includes(action)) {
        return json({ success: false, error: 'Missing or invalid id/action.' }, 400);
    }

    try {
        const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first();
        if (!user) return json({ success: false, error: 'Account not found.' }, 404);

        // The one un-revokable account. Also block an admin from suspending/revoking
        // their own currently-logged-in account, which would lock them out mid-session.
        if ((action === 'suspend' || action === 'revoke') && user.username === MASTER_USERNAME) {
            return json({ success: false, error: 'The Master Account cannot be suspended or revoked.' }, 403);
        }
        if ((action === 'suspend' || action === 'revoke') && user.username === auth.session.username) {
            return json({ success: false, error: 'You cannot suspend or revoke your own account.' }, 403);
        }

        switch (action) {
            case 'approve': {
                if (user.status !== 'Pending') {
                    return json({ success: false, error: 'Only pending registrations can be approved.' }, 400);
                }
                const batchId = await nextBatchId(env.DB, user.user_type);
                await env.DB.prepare(`UPDATE users SET status = 'Approved', batch_id = ? WHERE id = ?`)
                    .bind(batchId, id).run();
                await logActivity(env.DB, auth.session.username, auth.session.batchId, 'REGISTRATION_APPROVED',
                    { id, username: user.username, batchId });
                return json({ success: true, message: `Approved. Batch ID ${batchId} assigned.` });
            }

            case 'reject': {
                if (user.status !== 'Pending') {
                    return json({ success: false, error: 'Only pending registrations can be rejected.' }, 400);
                }
                await env.DB.prepare(`UPDATE users SET status = 'Rejected' WHERE id = ?`).bind(id).run();
                await logActivity(env.DB, auth.session.username, auth.session.batchId, 'REGISTRATION_REJECTED',
                    { id, username: user.username });
                return json({ success: true, message: 'Registration rejected.' });
            }

            case 'suspend': {
                if (user.status !== 'Approved') {
                    return json({ success: false, error: 'Only approved accounts can be suspended.' }, 400);
                }
                await env.DB.prepare(`UPDATE users SET status = 'Suspended' WHERE id = ?`).bind(id).run();
                await logActivity(env.DB, auth.session.username, auth.session.batchId, 'USER_SUSPENDED',
                    { id, username: user.username });
                return json({ success: true, message: 'Account suspended. The user will be signed out on their next heartbeat.' });
            }

            case 'reactivate': {
                if (user.status !== 'Suspended') {
                    return json({ success: false, error: 'Only suspended accounts can be reactivated.' }, 400);
                }
                await env.DB.prepare(`UPDATE users SET status = 'Approved' WHERE id = ?`).bind(id).run();
                await logActivity(env.DB, auth.session.username, auth.session.batchId, 'USER_REACTIVATED',
                    { id, username: user.username });
                return json({ success: true, message: 'Account reactivated.' });
            }

            case 'revoke': {
                // Permanent: tombstone first (so the username/email can be recognized as
                // previously deleted), then remove the live row entirely.
                await tombstoneUser(env.DB, user, auth.session.username);
                await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();
                await logActivity(env.DB, auth.session.username, auth.session.batchId, 'USER_REVOKED',
                    { id, username: user.username });
                return json({ success: true, message: 'Account permanently revoked.' });
            }
        }
    } catch (err) {
        return json({ success: false, error: 'Action failed: ' + err.message }, 500);
    }
}

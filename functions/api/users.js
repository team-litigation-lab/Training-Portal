import { json, requireSession, buildFullName } from '../_utils.js';
import { autoSweep } from './topics.js';

export async function onRequestGet({ request, env, waitUntil }) {
    // Requires an authenticated Admin session
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    // 🧹 Standard Foundational Training's revoked-trainee sweep, in the background (at most every 15 minutes: topics.js)
    try { await autoSweep(env, env.TRAINING_DB, auth.session, waitUntil); } catch (e) { /* never stops the list */ }

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

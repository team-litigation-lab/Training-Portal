import { json, requireSession } from '../_utils.js';

export async function onRequestGet({ request, env }) {
    // Requires an authenticated Admin session
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    try {
        // Fetch all accounts from env.DB, excluding passwords
        const { results } = await env.DB.prepare(`
            SELECT 
                id, first_name, mi, last_name, suffix, full_name,
                email, user_type, batch_id, username, status,
                training_start_date, created_at
            FROM users 
            ORDER BY created_at ASC
        `).all();

        // Format names cleanly for frontend grouping
        const formattedUsers = (results || []).map(u => ({
            ...u,
            fullName: u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
            userType: u.user_type || 'Trainee',
            batchId: u.batch_id || 'UNASSIGNED',
            trainingStartDate: u.training_start_date || null
        }));

        return json(formattedUsers);
    } catch (err) {
        return json({ success: false, error: 'Failed to fetch users: ' + err.message }, 500);
    }
}

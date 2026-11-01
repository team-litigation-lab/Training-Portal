import { json, requireSession, buildFullName, isMaster } from '../_utils.js';

// GET /api/pending-registrations: the registrations waiting for a decision, for the ⏳ approval popup that
// every trainer page of the Portal shows (portal.js, pollLive; not the public landing page, which trainees
// see). Trainers only. A trainee's registration is any trainer's to decide; an Admin / Trainer registration
// only the Master Account's (api/update-status.js), so only the Master Account is shown those.
// Asked through /api/live (?pending=1), never on its own, so it costs no extra request.
export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const master = isMaster(auth.session);
    try {
        const { results } = await env.DB.prepare(`
            SELECT id, first_name, mi, last_name, suffix, email, user_type, training_start_date, created_at
            FROM users WHERE status = 'Pending'
            ORDER BY created_at ASC LIMIT 50
        `).all();
        const pending = (results || [])
            .filter(u => master || u.user_type !== 'Admin')
            .map(u => ({
                id: u.id,
                fullName: buildFullName(u),
                email: u.email || '',
                userType: u.user_type || 'Trainee',
                trainingStartDate: u.training_start_date || null,
                createdAt: u.created_at || null
            }));
        return json({ success: true, pending });
    } catch (err) {
        return json({ success: false, error: 'Failed to read registrations: ' + err.message }, 500);
    }
}

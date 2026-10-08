import { json, requireSession } from '../_utils.js';

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true, master: true });
    if (!auth.ok) return auth.response;

    try {
        const url = new URL(request.url);
        const search = url.searchParams.get('q') || '';

        let query = `
            SELECT * FROM activity_log
            WHERE action IN ('ACTIVITY_SUBMITTED', 'GRADE_RELEASED', 'ACTIVITY_ADDED', 'LECTURE_ADDED')
            ORDER BY timestamp DESC LIMIT 100
        `;
        const binds = [];

        if (search.trim()) {
            query = `
                SELECT * FROM activity_log
                WHERE action IN ('ACTIVITY_SUBMITTED', 'GRADE_RELEASED', 'ACTIVITY_ADDED', 'LECTURE_ADDED')
                  AND (actor_username LIKE ? OR details LIKE ?)
                ORDER BY timestamp DESC LIMIT 100
            `;
            binds.push(`%${search.trim()}%`, `%${search.trim()}%`);
        }

        const { results } = await env.TRAINING_DB.prepare(query).bind(...binds).all();
        return json({ success: true, logs: results });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

import { json, requireSession } from '../_utils.js';

// GET /api/activity-logs — Admin only. Master Control > Activity Logs (app.js renderActivityLogs): the training
// DB's activity_log rows for uploads, submissions and gradings, newest first, the latest 100.
//   ?q=   matches the username, the Batch ID recorded on the row, or the details (an activity / lecture title)
//   ?u=   (repeatable, up to 25) usernames to include as well: the page turns a name typed in the search into the
//         usernames of the people it matches, since a row records only the username
export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    try {
        const url = new URL(request.url);
        const search = (url.searchParams.get('q') || '').trim();
        const usernames = url.searchParams.getAll('u').map(s => s.trim()).filter(Boolean).slice(0, 25);

        const where = [`action IN ('ACTIVITY_SUBMITTED', 'GRADE_RELEASED', 'ACTIVITY_ADDED', 'LECTURE_ADDED')`];
        const binds = [];
        if (search) {
            const like = `%${search}%`;
            const or = [`actor_username LIKE ?`, `actor_batch LIKE ?`, `details LIKE ?`];
            binds.push(like, like, like);
            if (usernames.length) {
                or.push(`actor_username IN (${usernames.map(() => '?').join(', ')})`);
                binds.push(...usernames);
            }
            where.push(`(${or.join(' OR ')})`);
        }

        const { results } = await env.TRAINING_DB.prepare(
            `SELECT * FROM activity_log WHERE ${where.join(' AND ')} ORDER BY timestamp DESC LIMIT 100`
        ).bind(...binds).all();
        return json({ success: true, logs: results });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

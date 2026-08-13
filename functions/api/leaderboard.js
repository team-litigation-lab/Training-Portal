import { json, requireSession, buildFullName } from '../_utils.js';

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;

    try {
        const { results: subRows } = await env.TRAINING_DB.prepare(
            "SELECT trainee_username, activity_id, status, score FROM submissions"
        ).all();
        const submissions = subRows || [];

        const { results: userRows } = await env.DB.prepare(`
            SELECT id, first_name, mi, last_name, suffix, user_type, batch_id, username, status
            FROM users WHERE status = 'Approved' AND user_type = 'Trainee'
        `).all();

        const trainees = (userRows || []).map(u => ({
            ...u,
            fullName: buildFullName(u),
            batchId: u.batch_id || 'UNASSIGNED'
        }));

        const byUsername = new Map();
        for (const t of trainees) {
            byUsername.set(t.username, {
                username: t.username,
                fullName: t.fullName,
                batchId: t.batchId,
                completedIds: new Set(),
                gradedScores: []
            });
        }
        for (const s of submissions) {
            const st = byUsername.get(s.trainee_username);
            if (!st) continue;
            st.completedIds.add(s.activity_id);
            if (s.status === 'Graded' && s.score !== null && s.score !== undefined) {
                st.gradedScores.push(Number(s.score));
            }
        }

        let rows = Array.from(byUsername.values()).map(st => {
            const activitiesCompleted = st.completedIds.size;
            const rating = st.gradedScores.length
                ? Math.round((st.gradedScores.reduce((a, b) => a + b, 0) / st.gradedScores.length) * 10) / 10
                : null;
            return { fullName: st.fullName, batchId: st.batchId, activitiesCompleted, rating };
        });

        // Highest average score first; ungraded trainees sink to the bottom.
        // Ties broken by who's completed more work.
        rows.sort((a, b) => {
            const ra = a.rating === null ? -1 : a.rating;
            const rb = b.rating === null ? -1 : b.rating;
            if (rb !== ra) return rb - ra;
            return b.activitiesCompleted - a.activitiesCompleted;
        });

        rows = rows.map((r, i) => ({ rank: i + 1, ...r }));

        return json({ success: true, leaderboard: rows, generatedAt: new Date().toISOString() });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

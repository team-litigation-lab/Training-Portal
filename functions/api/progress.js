import { json, requireSession, buildFullName } from '../_utils.js';

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;

    try {
        // Only "Activity" type items count toward completion — lesson decks
        // are reference material, not gradable work.
        const { results: activityRows } = await env.TRAINING_DB.prepare(
            "SELECT id FROM activities WHERE type = 'Activity'"
        ).all();
        const totalActivities = (activityRows || []).length;

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

        const statsByUsername = new Map();
        for (const t of trainees) {
            statsByUsername.set(t.username, {
                username: t.username,
                fullName: t.fullName,
                batchId: t.batchId,
                completedIds: new Set(),
                pendingChecks: 0,
                gradedScores: []
            });
        }
        for (const s of submissions) {
            const st = statsByUsername.get(s.trainee_username);
            if (!st) continue; // submission from a user no longer an approved trainee
            st.completedIds.add(s.activity_id);
            if (s.status === 'Needs Review') st.pendingChecks++;
            if (s.status === 'Graded' && s.score !== null && s.score !== undefined) {
                st.gradedScores.push(Number(s.score));
            }
        }

        const traineeStats = Array.from(statsByUsername.values()).map(st => {
            const completed = st.completedIds.size;
            const pct = totalActivities > 0 ? Math.round((completed / totalActivities) * 100) : 0;
            const avgScore = st.gradedScores.length
                ? Math.round((st.gradedScores.reduce((a, b) => a + b, 0) / st.gradedScores.length) * 10) / 10
                : null;
            return {
                username: st.username,
                fullName: st.fullName,
                batchId: st.batchId,
                completed,
                total: totalActivities,
                pct,
                pendingChecks: st.pendingChecks,
                avgScore
            };
        });

        if (auth.session.userType === 'Admin') {
            const activeTrainees = traineeStats.length;
            const totalSubmissions = submissions.length;
            const gradedAll = submissions.filter(s => s.status === 'Graded' && s.score !== null && s.score !== undefined);
            const avgBatchScore = gradedAll.length
                ? Math.round((gradedAll.reduce((a, s) => a + Number(s.score), 0) / gradedAll.length) * 10) / 10
                : null;
            const pendingGrades = submissions.filter(s => s.status === 'Needs Review').length;

            return json({
                success: true,
                scope: 'admin',
                totalActivities,
                summary: { activeTrainees, totalSubmissions, avgBatchScore, pendingGrades },
                trainees: traineeStats.sort((a, b) =>
                    String(a.batchId).localeCompare(String(b.batchId)) || a.fullName.localeCompare(b.fullName)
                )
            });
        }

        // Trainee scope: own stats + the average across their batch.
        const me = traineeStats.find(t => t.username === auth.session.username) || {
            username: auth.session.username,
            fullName: auth.session.fullName || auth.session.username,
            batchId: auth.session.batchId || 'UNASSIGNED',
            completed: 0, total: totalActivities, pct: 0, pendingChecks: 0, avgScore: null
        };

        const batchmates = traineeStats.filter(t => t.batchId === me.batchId);
        const batchAvgPct = batchmates.length
            ? Math.round(batchmates.reduce((a, t) => a + t.pct, 0) / batchmates.length)
            : me.pct;

        return json({
            success: true,
            scope: 'trainee',
            trainee: me,
            batch: { batchId: me.batchId, pct: batchAvgPct, traineeCount: batchmates.length }
        });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

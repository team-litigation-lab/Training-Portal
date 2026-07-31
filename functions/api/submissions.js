import { json, requireSession, logActivity } from '../_utils.js';

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;

    try {
        let query = "SELECT * FROM submissions ORDER BY submitted_at DESC";
        const binds = [];

        if (auth.session.userType !== 'Admin') {
            query = "SELECT * FROM submissions WHERE trainee_username = ? ORDER BY submitted_at DESC";
            binds.push(auth.session.username);
        }

        const { results } = await env.TRAINING_DB.prepare(query).bind(...binds).all();
        return json({ success: true, submissions: results });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;

    try {
        const { action, activityId, activityTitle, fileUrl, notes, submissionId, score, feedback } = await request.json();

        // 1. Trainee submitting an activity
        if (action === 'SUBMIT') {
            if (!activityId || !activityTitle) {
                return json({ success: false, error: "Activity details are required." }, 400);
            }

            const res = await env.TRAINING_DB.prepare(
                `INSERT INTO submissions (activity_id, activity_title, trainee_username, trainee_name, file_url, notes, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'Needs Review')`
            ).bind(
                activityId, activityTitle, auth.session.username,
                auth.session.fullName || auth.session.username, fileUrl || '', notes || ''
            ).run();

            await logActivity(
                env.TRAINING_DB,
                auth.session.username,
                auth.session.batchId,
                'ACTIVITY_SUBMITTED',
                { activityTitle }
            );

            return json({ success: true, id: res.meta.last_row_id });
        }

        // 2. Admin grading a submission
        if (action === 'GRADE') {
            if (auth.session.userType !== 'Admin') {
                return json({ success: false, error: "Only Admins can release grades." }, 403);
            }

            if (!submissionId || score === undefined) {
                return json({ success: false, error: "Submission ID and score are required." }, 400);
            }

            await env.TRAINING_DB.prepare(
                `UPDATE submissions
                 SET status = 'Graded', score = ?, feedback = ?, graded_at = datetime('now')
                 WHERE id = ?`
            ).bind(score, feedback || '', submissionId).run();

            await logActivity(
                env.TRAINING_DB,
                auth.session.username,
                auth.session.batchId,
                'GRADE_RELEASED',
                { submissionId, score }
            );

            return json({ success: true });
        }

        return json({ success: false, error: "Invalid action." }, 400);
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

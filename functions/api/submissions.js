import { json, requireSession, logActivity } from '../_utils.js';

function safeParseQuestions(raw) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function safeParseAnswers(raw) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

// Grades every objective question (mcq / truefalse / short) against the
// answer key. Essay questions always need a human, so their presence means
// the submission can never auto-finalize even if every objective item is
// already scored.
function gradeAnswers(questions, answers) {
    const responseByQ = new Map((answers || []).map(a => [a.questionId, a.response]));
    let autoScore = 0;
    let hasEssay = false;

    for (const q of questions) {
        if (q.type === 'essay') {
            hasEssay = true;
            continue;
        }
        const resp = responseByQ.get(q.id);
        if (resp === undefined || resp === null || resp === '') continue;
        const correct = String(q.correctAnswer ?? '').trim().toLowerCase();
        const given = String(resp).trim().toLowerCase();
        if (correct && given === correct) {
            autoScore += q.points || 1;
        }
    }

    return { autoScore, hasEssay };
}

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
        const submissions = (results || []).map(s => ({
            ...s,
            answers: safeParseAnswers(s.answers)
        }));
        return json({ success: true, submissions });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;

    try {
        const { action, activityId, activityTitle, notes, answers, submissionId, score, feedback } = await request.json();

        // 1. Trainee submitting an activity — answered in-page, no file upload.
        if (action === 'SUBMIT') {
            if (!activityId || !activityTitle) {
                return json({ success: false, error: "Activity details are required." }, 400);
            }

            // Pull the activity server-side — never trust the client on either
            // the answer key or on whether this activity is still open.
            const activityRow = await env.TRAINING_DB.prepare(
                "SELECT * FROM activities WHERE id = ?"
            ).bind(activityId).first();

            if (!activityRow) {
                return json({ success: false, error: "Activity not found." }, 404);
            }
            if (activityRow.status !== 'Published') {
                return json({ success: false, error: "This activity isn't open for submissions." }, 403);
            }
            if (!activityRow.open_deadline && activityRow.deadline && new Date(activityRow.deadline) < new Date()) {
                await env.TRAINING_DB.prepare(
                    "UPDATE activities SET status = 'Closed', closed_at = datetime('now') WHERE id = ?"
                ).bind(activityId).run();
                return json({ success: false, error: "The deadline for this activity has passed." }, 403);
            }

            const questions = safeParseQuestions(activityRow.questions);
            const answersJson = JSON.stringify(Array.isArray(answers) ? answers : []);

            let res;
            if (questions.length > 0) {
                const { autoScore, hasEssay } = gradeAnswers(questions, answers);

                if (!hasEssay) {
                    // Every question was objective — grade and close it out immediately.
                    res = await env.TRAINING_DB.prepare(
                        `INSERT INTO submissions (activity_id, activity_title, trainee_username, trainee_name, notes, answers, auto_score, status, score, graded_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'Graded', ?, datetime('now'))`
                    ).bind(
                        activityId, activityTitle, auth.session.username,
                        auth.session.fullName || auth.session.username, notes || '',
                        answersJson, autoScore, autoScore
                    ).run();
                } else {
                    // Contains at least one essay question — objective portion is
                    // pre-scored, but the submission still needs an admin's eyes.
                    res = await env.TRAINING_DB.prepare(
                        `INSERT INTO submissions (activity_id, activity_title, trainee_username, trainee_name, notes, answers, auto_score, status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'Needs Review')`
                    ).bind(
                        activityId, activityTitle, auth.session.username,
                        auth.session.fullName || auth.session.username, notes || '',
                        answersJson, autoScore
                    ).run();
                }
            } else {
                // Legacy / question-less activity — falls back to a plain
                // written response that always needs manual review.
                res = await env.TRAINING_DB.prepare(
                    `INSERT INTO submissions (activity_id, activity_title, trainee_username, trainee_name, notes, answers, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'Needs Review')`
                ).bind(
                    activityId, activityTitle, auth.session.username,
                    auth.session.fullName || auth.session.username, notes || '', answersJson
                ).run();
            }

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

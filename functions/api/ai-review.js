import { json, requireSession, generateAiReview } from '../_utils.js';

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

// Admin-triggered (re)generation of a submission's AI review — the same
// underlying generateAiReview() that submissions.js fires automatically
// right after a trainee submits, exposed here for cases where that first
// attempt failed (e.g. GEMINI_API_KEY wasn't configured yet at submit
// time) or an admin just wants a fresh take.
export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const { submissionId } = body;
    if (!submissionId) return json({ success: false, error: 'submissionId is required.' }, 400);

    try {
        const sub = await env.TRAINING_DB.prepare(`SELECT * FROM submissions WHERE id = ?`).bind(submissionId).first();
        if (!sub) return json({ success: false, error: 'Submission not found.' }, 404);

        const activity = await env.TRAINING_DB.prepare(`SELECT * FROM activities WHERE id = ?`).bind(sub.activity_id).first();
        const questions = activity ? safeParseQuestions(activity.questions) : [];
        const answers = safeParseAnswers(sub.answers);

        const result = await generateAiReview(env, {
            submissionId: sub.id,
            activityTitle: sub.activity_title,
            questions,
            answers,
            notes: sub.notes
        });

        if (!result.ok) return json({ success: false, error: result.error }, 502);
        return json({ success: true, review: result.review });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

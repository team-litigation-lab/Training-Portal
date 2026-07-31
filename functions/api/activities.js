import { json, requireSession, logActivity } from '../_utils.js';

export async function onRequestGet({ request, env }) {
    // Session validation checks env.DB automatically
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;

    try {
        // Query the NEW database
        const { results } = await env.TRAINING_DB.prepare(
            "SELECT * FROM activities ORDER BY day_label ASC, created_at ASC"
        ).all();
        return json({ success: true, activities: results });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const { title, dayLabel, type, fileUrl } = body;

        if (!title || !dayLabel || !type) {
            return json({ success: false, error: "Title, Training Day, and Type are required." }, 400);
        }

        // Insert into the NEW database
        const res = await env.TRAINING_DB.prepare(
            "INSERT INTO activities (title, day_label, type, file_url, created_by) VALUES (?, ?, ?, ?, ?)"
        ).bind(title, dayLabel, type, fileUrl || '', auth.session.username).run();

        // Log to TRAINING_DB activity_log
        await logActivity(
            env.TRAINING_DB,
            auth.session.username,
            auth.session.batchId,
            'ACTIVITY_ADDED',
            { title, dayLabel, type }
        );

        return json({ success: true, id: res.meta.last_row_id });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestDelete({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        if (!id) return json({ success: false, error: "Activity ID is required." }, 400);

        await env.TRAINING_DB.prepare("DELETE FROM activities WHERE id = ?").bind(id).run();
        return json({ success: true });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

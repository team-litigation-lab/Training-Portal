import { json, requireSession, logActivity } from '../_utils.js';

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;

    try {
        const { results } = await env.TRAINING_DB.prepare(
            "SELECT * FROM lectures ORDER BY created_at DESC"
        ).all();
        return json({ success: true, lectures: results });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    try {
        const { title, embedUrl, summary } = await request.json();

        if (!title || !embedUrl) {
            return json({ success: false, error: "Title and Embed URL (YouTube/GDrive) are required." }, 400);
        }

        const res = await env.TRAINING_DB.prepare(
            "INSERT INTO lectures (title, embed_url, summary, created_by) VALUES (?, ?, ?, ?)"
        ).bind(title, embedUrl, summary || '', auth.session.username).run();

        await logActivity(
            env.TRAINING_DB,
            auth.session.username,
            auth.session.batchId,
            'LECTURE_ADDED',
            { title }
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
        if (!id) return json({ success: false, error: "Lecture ID is required." }, 400);

        await env.TRAINING_DB.prepare("DELETE FROM lectures WHERE id = ?").bind(id).run();
        return json({ success: true });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

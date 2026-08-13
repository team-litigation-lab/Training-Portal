import { json, requireSession } from '../_utils.js';

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    try {
        const { results } = await env.TRAINING_DB.prepare(
            "SELECT * FROM activities_archive ORDER BY archived_at DESC"
        ).all();
        return json({ success: true, archive: results || [] });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

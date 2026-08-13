import { json, requireSession, logActivity } from '../_utils.js';

// NOTE: This file wasn't part of the upload that added the ticker's
// frontend wiring (loadAnnouncement/makeAnnouncement/clearAnnouncement in
// app.js) — only the frontend calls to /api/announcement came through. If
// a real announcement.js already exists in the deployed functions/api/
// folder, keep that one instead of this — this is a best-effort
// reconstruction matching the exact GET/POST/DELETE contract the frontend
// expects.

const DEFAULT_TEXT = 'Welcome to the LSH Training Activities Portal.';

// GET is deliberately public (no requireSession) — the ticker shows in the
// top bar on the login screen too, before anyone has a session.
export async function onRequestGet({ request, env }) {
    try {
        const row = await env.DB.prepare(
            "SELECT value FROM site_settings WHERE key = 'announcement'"
        ).first();
        return json({ success: true, text: (row && row.value) || DEFAULT_TEXT });
    } catch (err) {
        // site_settings may not exist yet on a fresh DB — fail soft to the default line
        // rather than breaking the login screen the ticker sits on.
        return json({ success: true, text: DEFAULT_TEXT });
    }
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    try {
        const { text } = await request.json();
        const clean = String(text || '').trim().slice(0, 500);
        if (!clean) return json({ success: false, error: 'Announcement text is required.' }, 400);

        await env.DB.prepare(
            `INSERT INTO site_settings (key, value, updated_by, updated_at)
             VALUES ('announcement', ?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`
        ).bind(clean, auth.session.username).run();

        await logActivity(env.DB, auth.session.username, auth.session.batchId, 'ANNOUNCEMENT_SET', { text: clean });

        return json({ success: true, text: clean });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestDelete({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    try {
        await env.DB.prepare("DELETE FROM site_settings WHERE key = 'announcement'").run();
        await logActivity(env.DB, auth.session.username, auth.session.batchId, 'ANNOUNCEMENT_CLEARED', {});
        return json({ success: true, text: DEFAULT_TEXT });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

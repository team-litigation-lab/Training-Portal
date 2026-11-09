import { json, requireSession, logActivity, sameSecret } from '../_utils.js';

// Who may change it: a signed-in admin, or — server to server, with the shared AI_GATEWAY_SECRET in X-Gateway-Key — the
// Foundational Training platform's trainers, from its Admin → 📢 Announcements (their name comes in the body as `by`).
async function who(request, env) {
    const key = String(request.headers.get('X-Gateway-Key') || '').trim();
    if (key) {
        const want = String(env.AI_GATEWAY_SECRET || '').trim();
        if (!want || !sameSecret(key, want)) return { ok: false, response: json({ success: false, error: 'Not allowed.' }, 401) };
        return { ok: true, gateway: true, session: { username: 'foundational', batchId: null } };
    }
    return requireSession(request, env, { adminOnly: true });
}

// Bug fix: GET previously queried env.TRAINING_TRAINING_DB (a typo — no such
// binding exists), so it always threw, was caught by the try/catch below,
// and silently fell back to DEFAULT_TEXT. POST/DELETE already used the
// correct env.TRAINING_DB, so an admin's announcement was actually being
// saved — it just never displayed, since GET could never see it.

const DEFAULT_TEXT = 'Welcome to the Legal Skills Hub.';

// GET is deliberately public (no requireSession) — the ticker shows in the
// top bar on the login screen too, before anyone has a session.
export async function onRequestGet({ request, env }) {
    try {
        const row = await env.TRAINING_DB.prepare(
            "SELECT value FROM site_settings WHERE key = 'announcement'"
        ).first();
        return json({ success: true, text: (row && row.value) || DEFAULT_TEXT });
    } catch (err) {
        // site_settings may not exist yet on a fresh TRAINING_DB — fail soft to the default line
        // rather than breaking the login screen the ticker sits on.
        return json({ success: true, text: DEFAULT_TEXT });
    }
}

export async function onRequestPost({ request, env }) {
    const auth = await who(request, env);
    if (!auth.ok) return auth.response;

    try {
        const { text, by } = await request.json();
        if (auth.gateway) auth.session.username = ('foundational:' + String(by || 'trainer')).slice(0, 80);
        const clean = String(text || '').trim().slice(0, 500);
        if (!clean) return json({ success: false, error: 'Announcement text is required.' }, 400);

        await env.TRAINING_DB.prepare(
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
    const auth = await who(request, env);
    if (!auth.ok) return auth.response;

    try {
        await env.TRAINING_DB.prepare("DELETE FROM site_settings WHERE key = 'announcement'").run();
        await logActivity(env.DB, auth.session.username, auth.session.batchId, 'ANNOUNCEMENT_CLEARED', {});
        return json({ success: true, text: DEFAULT_TEXT });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

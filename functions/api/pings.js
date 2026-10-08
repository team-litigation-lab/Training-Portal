import { json, requireSession, logActivity } from '../_utils.js';

// Delivery is poll-based, not push — the client calls GET with
// ?since=<fired_at of the last ping it already showed> at a short interval
// and displays anything new.
//
// target is NOT NULL in the live schema (no NULL-means-broadcast option),
// so 'ALL' is used as the broadcast sentinel — every row for a specific
// recipient uses that recipient's username instead.
export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;

    try {
        const url = new URL(request.url);
        const since = url.searchParams.get('since');

        let query = `SELECT * FROM pings WHERE (target = ? OR target = 'ALL')`;
        const binds = [auth.session.username];

        if (since) {
            query += ` AND fired_at > ?`;
            binds.push(since);
        }
        query += ` ORDER BY fired_at ASC LIMIT 20`;

        const { results } = await env.DB.prepare(query).bind(...binds).all();
        return json({ success: true, pings: results || [] });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true, master: true });
    if (!auth.ok) return auth.response;
    const { session } = auth;
    const db = env.DB;

    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const { mode, usernames, message } = body;

    if (!message || !message.trim()) return json({ success: false, error: 'Message is required.' }, 400);

    try {
        if (mode === 'all') {
            await db.prepare(`INSERT INTO pings (text, target, fired_at, by) VALUES (?, 'ALL', datetime('now'), ?)`)
                .bind(message.trim(), session.username).run();
        } else if (mode === 'single') {
            if (!Array.isArray(usernames) || usernames.length === 0) {
                return json({ success: false, error: 'At least one recipient is required.' }, 400);
            }
            // One row per recipient — target has no array/multi-value form.
            const stmt = db.prepare(`INSERT INTO pings (text, target, fired_at, by) VALUES (?, ?, datetime('now'), ?)`);
            for (const username of usernames) {
                await stmt.bind(message.trim(), username, session.username).run();
            }
        } else {
            return json({ success: false, error: 'Invalid ping mode.' }, 400);
        }

        await logActivity(db, session.username, session.batchId, 'send-ping', { mode, usernames: usernames || null, message: message.trim() });
        return json({ success: true });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

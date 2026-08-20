import { json, requireSession, getSiteState, verifyAdminCredentials, verifyUsernamePassword, logActivity } from '../_utils.js';

// GET is intentionally public (no requireSession) — its job is to tell any
// client, logged in or not, whether to show the lock/pause overlay. That
// has to work even for someone whose session was just forcibly killed by
// a lock.
export async function onRequestGet({ env }) {
    try {
        const state = await getSiteState(env.DB);
        return json({ success: true, ...state });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    const db = env.DB;
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const { action } = body;

    try {
        // UNLOCK deliberately does NOT call requireSession — the whole point
        // of a lock is that nobody, admins included, has a valid session
        // anymore (see requireSession's SITE_LOCKED check in _utils.js). It
        // re-verifies credentials directly instead, matching the Unlock
        // screen's own username+password fields.
        if (action === 'UNLOCK') {
            const { username, password } = body;
            if (!username || !password) return json({ success: false, error: 'Username and password are required.' }, 400);

            const user = await verifyUsernamePassword(db, username, password, 'Admin');
            if (!user) return json({ success: false, error: 'Invalid credentials.' }, 401);

            // Upsert rather than a plain UPDATE — the site_state row (id=1)
            // may not exist yet even though the table does.
            await db.prepare(
                `INSERT INTO site_state (id, locked, locked_by_batch, updated_at) VALUES (1, 0, NULL, datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET locked = 0, locked_by_batch = NULL, updated_at = excluded.updated_at`
            ).run();
            await logActivity(db, user.username, user.batch_id, 'site-unlock', null);
            return json({ success: true });
        }

        // LOCK, PAUSE, and RESUME all require an already-valid admin session.
        const auth = await requireSession(request, env, { adminOnly: true });
        if (!auth.ok) return auth.response;
        const { session } = auth;

        if (action === 'LOCK') {
            const { batchId, password } = body;
            if (!batchId || !password) return json({ success: false, error: 'Batch ID and password are required.' }, 400);

            const user = await verifyAdminCredentials(db, batchId, password);
            if (!user) return json({ success: false, error: 'Batch ID / password did not match an administrator record.' }, 401);

            await db.prepare(
                `INSERT INTO site_state (id, locked, locked_by_batch, updated_at) VALUES (1, 1, ?, datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET locked = 1, locked_by_batch = excluded.locked_by_batch, updated_at = excluded.updated_at`
            ).bind(user.batch_id).run();
            // Force everyone off immediately rather than waiting for each
            // session's next heartbeat to hit requireSession's SITE_LOCKED check.
            await db.prepare(`DELETE FROM heartbeats`).run();
            await logActivity(db, session.username, session.batchId, 'site-lock', null);
            return json({ success: true });
        }

        if (action === 'PAUSE') {
            await db.prepare(
                `INSERT INTO site_state (id, paused, updated_at) VALUES (1, 1, datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET paused = 1, updated_at = excluded.updated_at`
            ).run();
            await logActivity(db, session.username, session.batchId, 'site-pause', null);
            return json({ success: true });
        }

        if (action === 'RESUME') {
            await db.prepare(
                `INSERT INTO site_state (id, paused, updated_at) VALUES (1, 0, datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET paused = 0, updated_at = excluded.updated_at`
            ).run();
            await logActivity(db, session.username, session.batchId, 'site-resume', null);
            return json({ success: true });
        }

        return json({ success: false, error: 'Unknown action.' }, 400);
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

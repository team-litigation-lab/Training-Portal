import { json, requireSession, getSiteState, logActivity, MASTER_USERNAME, verifyMasterCredentials } from '../_utils.js';

// GET is intentionally public (no requireSession) — its job is to tell any
// client, logged in or not, whether to show the lock/pause overlay. That
// has to work even for someone whose session was just forcibly killed by
// a lock.
export async function onRequestGet({ env }) {
    try {
        const state = await getSiteState(env.DB);
        // Pause Message lives in TRAINING_DB's site_settings (the same
        // generic key-value table announcement.js already uses) — site_state
        // itself is on the accounts DB (env.DB), a separate database that
        // can't be joined with this in one query, so this is a second,
        // independent read combined here in JS.
        let pausedMessage = null;
        try {
            const row = await env.TRAINING_DB.prepare("SELECT value FROM site_settings WHERE key = 'pause_message'").first();
            pausedMessage = (row && row.value) || null;
        } catch (e) { /* site_settings may not exist yet — pause still works, just without a custom message */ }
        return json({ success: true, ...state, pausedMessage });
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

            // Verifies against env.MASTER_ADMIN_PASSWORD directly (see
            // verifyMasterCredentials in _utils.js) — the Master Account has
            // no row in the users table, so there's nothing there to check.
            if (!verifyMasterCredentials(env, username, password)) {
                return json({ success: false, error: 'Invalid credentials.' }, 401);
            }

            // Upsert rather than a plain UPDATE — the site_state row (id=1)
            // may not exist yet even though the table does.
            await db.prepare(
                `INSERT INTO site_state (id, locked, locked_by_batch, updated_at) VALUES (1, 0, NULL, datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET locked = 0, locked_by_batch = NULL, updated_at = excluded.updated_at`
            ).run();
            await logActivity(db, MASTER_USERNAME, 'MASTER-ADMIN', 'site-unlock', null);
            return json({ success: true });
        }

        // LOCK, PAUSE, and RESUME all require an already-valid admin session.
        const auth = await requireSession(request, env, { adminOnly: true });
        if (!auth.ok) return auth.response;
        const { session } = auth;

        if (action === 'LOCK') {
            // Any logged-in admin can reach this — the Master Account can
            // never hold a session (see login.js), so gating this on
            // isMaster(session) would make Lock unreachable by anyone at
            // all. The actual restriction is the credential check below:
            // only Master's own username+password succeeds, regardless of
            // which admin is the one currently logged in and clicking the
            // button.
            const { username, password } = body;
            if (!username || !password) return json({ success: false, error: 'Username and password are required.' }, 400);

            if (!verifyMasterCredentials(env, username, password)) {
                return json({ success: false, error: 'Only the Master Account may lock this page.' }, 403);
            }

            await db.prepare(
                `INSERT INTO site_state (id, locked, locked_by_batch, updated_at) VALUES (1, 1, ?, datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET locked = 1, locked_by_batch = excluded.locked_by_batch, updated_at = excluded.updated_at`
            ).bind('MASTER-ADMIN').run();
            // Force everyone off immediately rather than waiting for each
            // session's next heartbeat to hit requireSession's SITE_LOCKED check.
            await db.prepare(`DELETE FROM heartbeats`).run();
            await logActivity(db, session.username, session.batchId, 'site-lock', { lockedVia: MASTER_USERNAME });
            return json({ success: true });
        }

        if (action === 'PAUSE') {
            await db.prepare(
                `INSERT INTO site_state (id, paused, updated_at) VALUES (1, 1, datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET paused = 1, updated_at = excluded.updated_at`
            ).run();

            // Optional custom message shown on the trainee-facing pause
            // overlay — stored in TRAINING_DB's site_settings, same table
            // announcement.js already uses. Empty/omitted just means the
            // overlay falls back to its default text (handled client-side).
            const pauseMessage = String(body.message || '').trim().slice(0, 300);
            try {
                await env.TRAINING_DB.prepare(
                    `INSERT INTO site_settings (key, value, updated_by, updated_at)
                     VALUES ('pause_message', ?, ?, datetime('now'))
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`
                ).bind(pauseMessage, session.username).run();
            } catch (e) { /* pause itself still succeeds even if the message couldn't be saved */ }

            await logActivity(db, session.username, session.batchId, 'site-pause', { message: pauseMessage || null });
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

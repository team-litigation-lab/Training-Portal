import { json, requireSession } from '../_utils.js';

// Server Logs (Admin > Monitoring > Server Logs). Reads env.DB's
// activity_log — NOT env.TRAINING_DB's — since login/logout/update-access/
// revoke-user all log through env.DB (see login.js, logout.js,
// update-access.js, revoke-user.js). This is a separate table/namespace
// from /api/activity-logs, which covers training-portal actions
// (submissions, grades, decks, lectures) logged to env.TRAINING_DB.
//
// Scope for now: login, logout, revoke-user, update-access. Site-lock
// actions (pause/lock/unlock mentioned in the modal subtitle) aren't
// logged anywhere yet, so they're intentionally left out until that
// endpoint exists.
const LOGGED_ACTIONS = ['login', 'logout', 'revoke-user', 'update-access'];

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    try {
        const url = new URL(request.url);
        const search = url.searchParams.get('q') || '';

        const placeholders = LOGGED_ACTIONS.map(() => '?').join(', ');
        let query = `
            SELECT * FROM activity_log
            WHERE action IN (${placeholders})
            ORDER BY timestamp DESC LIMIT 200
        `;
        const binds = [...LOGGED_ACTIONS];

        if (search.trim()) {
            query = `
                SELECT * FROM activity_log
                WHERE action IN (${placeholders})
                  AND (actor_username LIKE ? OR details LIKE ?)
                ORDER BY timestamp DESC LIMIT 200
            `;
            binds.push(`%${search.trim()}%`, `%${search.trim()}%`);
        }

        const { results } = await env.DB.prepare(query).bind(...binds).all();
        const logs = pairSessions(results || []);

        return json({ success: true, logs });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

// Pairs each 'logout' row with the nearest earlier still-open 'login' row
// for the same actor_username, so the frontend gets session duration
// pre-computed rather than re-deriving pairing logic client-side. Also
// parses each row's `details` JSON blob into an object for convenience.
function pairSessions(rows) {
    const chronological = [...rows].reverse(); // rows arrive newest-first; walk oldest->newest to pair correctly
    const openLoginByUser = new Map();
    const enriched = [];

    for (const row of chronological) {
        const parsed = { ...row, details: parseDetails(row.details), sessionDurationSeconds: null };

        if (row.action === 'login') {
            openLoginByUser.set(row.actor_username, row);
        } else if (row.action === 'logout') {
            const loginRow = openLoginByUser.get(row.actor_username);
            if (loginRow) {
                const loginTime = new Date(loginRow.timestamp + 'Z').getTime();
                const logoutTime = new Date(row.timestamp + 'Z').getTime();
                if (!Number.isNaN(loginTime) && !Number.isNaN(logoutTime)) {
                    parsed.sessionDurationSeconds = Math.max(0, Math.round((logoutTime - loginTime) / 1000));
                }
                openLoginByUser.delete(row.actor_username);
            }
        }

        enriched.push(parsed);
    }

    return enriched.reverse(); // newest-first, matching the original query order
}

function parseDetails(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return raw; }
}

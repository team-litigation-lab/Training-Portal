import { json, requireSession } from '../_utils.js';

// GET /api/server-logs — Admin only. Master Control > Monitoring > Server Logs
// (app.js loadServerLogs / serverLogRowMarkup): the accounts DB's activity_log,
// newest first. login.js, logout.js, register.js, revoke-user.js, update-access.js,
// pings.js, alert.js and site-state.js write it through logActivity().
//
// Each row goes out as the page reads it: actor_username, actor_batch, action,
// details (parsed JSON) and timestamp. A logout also gets sessionDurationSeconds,
// the time since that person's last login before it.
//
// The rows are read in insertion order (rowid), and the time comes from whichever
// timestamp column the table has (timestamp or created_at), so this doesn't
// depend on how the table was first created.
export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true, master: true });
    if (!auth.ok) return auth.response;
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit'), 10) || 500, 2000);
    try {
        const { results } = await env.DB.prepare(
            `SELECT rowid AS _rowid, * FROM activity_log ORDER BY rowid DESC LIMIT ?`
        ).bind(limit).all();
        const rows = (results || []).slice().reverse();   // oldest first, so a logout can find its login
        const loginAt = {};
        const logs = rows.map(r => {
            const timestamp = r.timestamp || r.created_at || null;
            const t = String(timestamp || '');
            const ms = t ? Date.parse(t.replace(' ', 'T') + (/[zZ]$|[+-]\d\d:?\d\d$/.test(t) ? '' : 'Z')) : NaN;
            let sessionDurationSeconds = null;
            if (r.action === 'login' && !isNaN(ms)) loginAt[r.actor_username] = ms;
            else if (r.action === 'logout' && !isNaN(ms) && loginAt[r.actor_username] != null) {
                sessionDurationSeconds = Math.max(0, Math.round((ms - loginAt[r.actor_username]) / 1000));
                delete loginAt[r.actor_username];
            }
            let details = null;
            try { details = r.details ? JSON.parse(r.details) : null; } catch (e) { details = null; }
            return { id: r.id != null ? r.id : r._rowid, actor_username: r.actor_username, actor_batch: r.actor_batch, action: r.action, details, timestamp, sessionDurationSeconds };
        });
        logs.reverse();
        return json({ success: true, logs });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

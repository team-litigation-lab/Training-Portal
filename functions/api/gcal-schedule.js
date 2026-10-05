import { json, requireSession } from '../_utils.js';

// The Google Calendar Simulator's weekly schedule: the attorney's week, the same every week
// (simulators/gcal.html). It comes with the simulator (simulators/gcal-data.js, GCAL_ATTORNEY);
// an Admin can change it for everyone, and it's kept here (one row, created on first use).
//   ?track=cm|ea  → the Case Management / EA-PA clones' weeks (gcal.html?track=…), each kept separately; no track: the Standard
//                   Training (Foundational) week, as it always was.
//   GET    → { success, rows | null, updatedAt, updatedBy }   (null: the schedule as it came). Signed in.
//   PUT    { rows }  → Admins: the new weekly schedule for everyone.
//   DELETE → Admins: back to the schedule as it came.
// A row: { id, wd (0–6, 1 = Monday), start, end ('HH:MM'), type, title, location, notes, color }.
const TYPES = ['Blocked Time', 'Phone Call', 'Client Meeting', 'Internal Meeting', 'Other'];
const COLORS = ['', 'tomato', 'flamingo', 'tangerine', 'banana', 'sage', 'basil', 'peacock', 'blueberry', 'lavender', 'grape', 'graphite'];
const MAX_ROWS = 150;

async function ensureTable(db) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS gcal_schedule (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        rows TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT
    )`).run();
}
const TRACKS = ['cm', 'ea'];
// The track asked for (null: the Standard Training week, kept in the first table) or false when it isn't one we know.
const trackOf = (request) => { const t = new URL(request.url).searchParams.get('track'); return t === null || t === 'standard' ? null : TRACKS.includes(t) ? t : false; };   // (only a missing track is Standard Training: an empty one is refused)
async function ensureTracks(db) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS gcal_schedule_tracks (
        track TEXT PRIMARY KEY,
        rows TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT
    )`).run();
}
const isTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ''));
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
// The rows as they may be kept, or an error.
export function cleanRows(rows) {
    if (!Array.isArray(rows)) return { error: 'rows must be a list.' };
    if (rows.length > MAX_ROWS) return { error: `At most ${MAX_ROWS} appointments a week.` };
    const out = [], ids = new Set();
    for (const r of rows) {
        if (!r || typeof r !== 'object') return { error: 'Every appointment needs its details.' };
        const id = String(r.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
        const wd = Number(r.wd), title = clip(r.title, 140);
        if (!id || ids.has(id)) return { error: 'Every appointment needs its own id.' };
        if (!Number.isInteger(wd) || wd < 0 || wd > 6) return { error: `“${title || id}”: pick the day of the week.` };
        if (!isTime(r.start) || !(isTime(r.end) || r.end === '23:59') || r.end <= r.start) return { error: `“${title || id}”: the end must be after the start.` };
        if (!title) return { error: 'Every appointment needs a title.' };
        ids.add(id);
        out.push({ id, wd, start: r.start, end: r.end, type: TYPES.includes(r.type) ? r.type : 'Client Meeting', title,
            location: clip(r.location, 200), notes: clip(r.notes, 2000), color: COLORS.includes(r.color) ? r.color : '' });
    }
    return { rows: out };
}

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;
    const track = trackOf(request); if (track === false) return json({ success: false, error: 'Unknown track.' }, 400);
    try {
        let row;
        if (track) { await ensureTracks(env.TRAINING_DB); row = await env.TRAINING_DB.prepare(`SELECT rows, updated_at, updated_by FROM gcal_schedule_tracks WHERE track = ?`).bind(track).first(); }
        else { await ensureTable(env.TRAINING_DB); row = await env.TRAINING_DB.prepare(`SELECT rows, updated_at, updated_by FROM gcal_schedule WHERE id = 1`).first(); }
        let rows = null;
        try { rows = row ? JSON.parse(row.rows) : null; } catch (e) { rows = null; }
        return json({ success: true, rows, updatedAt: row ? row.updated_at : null, updatedBy: row ? row.updated_by : null });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPut({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const { rows, error } = cleanRows(body && body.rows);
    if (error) return json({ success: false, error }, 400);
    const track = trackOf(request); if (track === false) return json({ success: false, error: 'Unknown track.' }, 400);
    try {
        const who = auth.session.fullName || auth.session.username;
        if (track) {
            await ensureTracks(env.TRAINING_DB);
            await env.TRAINING_DB.prepare(`INSERT INTO gcal_schedule_tracks (track, rows, updated_at, updated_by) VALUES (?, ?, ?, ?)
                ON CONFLICT(track) DO UPDATE SET rows = excluded.rows, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
                .bind(track, JSON.stringify(rows), new Date().toISOString(), who).run();
        } else {
            await ensureTable(env.TRAINING_DB);
            await env.TRAINING_DB.prepare(`INSERT INTO gcal_schedule (id, rows, updated_at, updated_by) VALUES (1, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET rows = excluded.rows, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
                .bind(JSON.stringify(rows), new Date().toISOString(), who).run();
        }
        return json({ success: true, rows });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestDelete({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const track = trackOf(request); if (track === false) return json({ success: false, error: 'Unknown track.' }, 400);
    try {
        if (track) { await ensureTracks(env.TRAINING_DB); await env.TRAINING_DB.prepare(`DELETE FROM gcal_schedule_tracks WHERE track = ?`).bind(track).run(); }
        else { await ensureTable(env.TRAINING_DB); await env.TRAINING_DB.prepare(`DELETE FROM gcal_schedule WHERE id = 1`).run(); }
        return json({ success: true });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

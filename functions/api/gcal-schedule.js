import { json, requireSession } from '../_utils.js';

// The Google Calendar Simulator's weekly schedule: the attorney's week, the same every week
// (simulators/gcal.html). It comes with the simulator (simulators/gcal-data.js, GCAL_ATTORNEY);
// an Admin can change it for everyone, and it's kept here (one row, created on first use).
//   ?track=cm|ea  → the Case Management / EA-PA clones' weeks (gcal.html?track=…), each kept separately; no track: the Standard
//                   Training (Foundational) week, as it always was.
//   GET    → { success, rows | null, updatedAt, updatedBy }   (null: the schedule as it came). Signed in.
//   PUT    { rows }  → Admins: the new weekly schedule for everyone.
//   DELETE → Admins: back to the schedule as it came.
//   🎨 Color coding (per simulator): { colors: { cal: { attorney|lsh|holidays: <color> }, type: { <appointment type>: <color> } } }, a color being one of Google's
//   event color names. GET also returns `colors` ({} when none). PUT { colors } (Admins) saves them for everyone; PUT { colors: {} } clears them; a PUT with
//   rows and colors saves both. The schedule's rows keep their own color (a row's color wins over its type's, which wins over the default).
// A row: { id, wd (0–6, 1 = Monday), start, end ('HH:MM'), type, title, location, notes, color }.
const TYPES = ['Blocked Time', 'Phone Call', 'Client Meeting', 'Internal Meeting', 'Other'];
const COLORS = ['', 'tomato', 'flamingo', 'tangerine', 'banana', 'sage', 'basil', 'peacock', 'blueberry', 'lavender', 'grape', 'graphite'];
const MAX_ROWS = 150;
const CAL_IDS = ['attorney', 'lsh', 'holidays'];

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
async function ensureColors(db) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS gcal_schedule_colors (
        track TEXT PRIMARY KEY,
        colors TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT
    )`).run();
}
// The colors as they may be kept ({ cal: {…}, type: {…} }, only known calendars, appointment types and color names), or an error.
export function cleanColors(c) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) return { error: 'colors must be an object.' };
    const out = { cal: {}, type: {} };
    for (const [grp, keys] of [['cal', CAL_IDS], ['type', TYPES]]) {
        const src = c[grp];
        if (src == null) continue;
        if (typeof src !== 'object' || Array.isArray(src)) return { error: `colors.${grp} must be an object.` };
        for (const k of Object.keys(src)) {
            if (!keys.includes(k)) return { error: `“${clip(k, 40)}” isn't a calendar or appointment type that can be colored.` };
            if (src[k] === '' || src[k] == null) continue;
            if (!COLORS.includes(src[k])) return { error: `“${clip(src[k], 20)}” isn't one of the calendar colors.` };
            out[grp][k] = src[k];
        }
    }
    return { colors: out };
}
const trackKey = (track) => track || 'standard';
async function readColors(db, track) {
    try {
        await ensureColors(db);
        const r = await db.prepare(`SELECT colors FROM gcal_schedule_colors WHERE track = ?`).bind(trackKey(track)).first();
        const c = r ? JSON.parse(r.colors) : null;
        return c && typeof c === 'object' ? c : {};
    } catch (e) { return {}; }
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
        return json({ success: true, rows, colors: await readColors(env.TRAINING_DB, track), updatedAt: row ? row.updated_at : null, updatedBy: row ? row.updated_by : null });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPut({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const hasColors = !!body && body.colors !== undefined, hasRows = !!body && body.rows !== undefined;
    let rows = null, colors = null;
    if (hasRows || !hasColors) { const c = cleanRows(body && body.rows); if (c.error) return json({ success: false, error: c.error }, 400); rows = c.rows; }
    if (hasColors) { const c = cleanColors(body.colors); if (c.error) return json({ success: false, error: c.error }, 400); colors = c.colors; }
    const track = trackOf(request); if (track === false) return json({ success: false, error: 'Unknown track.' }, 400);
    try {
        const who = auth.session.fullName || auth.session.username;
        if (colors) {   // 🎨 color coding: nothing chosen clears it
            await ensureColors(env.TRAINING_DB);
            if (Object.keys(colors.cal).length || Object.keys(colors.type).length) await env.TRAINING_DB.prepare(`INSERT INTO gcal_schedule_colors (track, colors, updated_at, updated_by) VALUES (?, ?, ?, ?)
                ON CONFLICT(track) DO UPDATE SET colors = excluded.colors, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(trackKey(track), JSON.stringify(colors), new Date().toISOString(), who).run();
            else await env.TRAINING_DB.prepare(`DELETE FROM gcal_schedule_colors WHERE track = ?`).bind(trackKey(track)).run();
            if (!rows) return json({ success: true, colors });
        }
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
        return json({ success: true, rows, colors: colors || undefined });
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

import { json } from '../_utils.js';

// The attendance feed for the Google Sheet (attendance-sync.gs, pasted into the sheet's Apps Script).
// The sheet can't sign in like an admin, so it sends a key instead:
//   GET /api/attendance-feed?days=<1–31>   with   Authorization: Bearer <ATTENDANCE_FEED_KEY>
//   → { rows: [{ id, program, programLabel, batch, date, day, name, training, timeIn, timeOut, status, note, at }], from, to }
// One row per trainee per day that someone has tagged (or since cleared), for the last <days> days
// (Pacific time), every program.
// It reads the records the courses' 🕘 Attendance tabs and /attendance.html write (see api/attendance.js).
// ATTENDANCE_FEED_KEY is a Pages secret (a long random string); until it's set, the feed is off.
const PROGRAMS = [
    { id: 'ft', label: 'Standard Foundational Training', prefix: 'ft:' },
    { id: 'eapa', label: 'EA / PA Training', prefix: '' },
    { id: 'cm', label: 'CM Training', prefix: 'cm:' },
    { id: 'pd', label: 'PD Claims Training', prefix: 'pd:' },
    { id: 'md', label: 'Medsum & Demand Training', prefix: 'md:' }
];
const KV_BUDGET = 950;
const noStore = { 'Cache-Control': 'no-store' };
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const ptDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

function sameKey(a, b) {
    a = String(a || ''); b = String(b || '');
    if (!a || a.length !== b.length) return false;
    let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
}

export async function onRequestGet({ request, env }) {
    if (!env.ATTENDANCE_FEED_KEY) return json({ success: false, error: 'The attendance feed isn’t set up: add the ATTENDANCE_FEED_KEY secret to this Pages project.' }, 404, noStore);
    const h = request.headers.get('Authorization') || '';
    if (!sameKey(h.startsWith('Bearer ') ? h.slice(7).trim() : '', env.ATTENDANCE_FEED_KEY)) return json({ success: false, error: 'Wrong feed key.' }, 401, noStore);
    const kv = env.COURSE_KV;
    if (!kv) return json({ success: false, error: 'Course data isn’t connected (COURSE_KV).' }, 500, noStore);
    const days = Math.min(31, Math.max(1, Math.round(Number(new URL(request.url).searchParams.get('days')) || 7)));
    const to = ptDate(new Date()), from = ptDate(new Date(Date.now() - (days - 1) * 864e5));
    try {
        let ops = 0;
        const wanted = [];
        for (const p of PROGRAMS) {
            const pre = p.prefix + 'attendance:';
            let cursor;
            do {
                if (++ops > KV_BUDGET) throw new Error('Too many records for one request.');
                const page = await kv.list({ prefix: pre, cursor, limit: 1000 });
                page.keys.forEach(k => { const m = /^([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(k.name.slice(pre.length)); if (m && m[2] >= from && m[2] <= to) wanted.push({ p, key: k.name }); });
                cursor = page.list_complete ? null : page.cursor;
            } while (cursor);
        }
        const room = Math.max(0, KV_BUDGET - ops), take = wanted.slice(-room);   // newest keys sort last
        const rows = [];
        for (let i = 0; i < take.length; i += 40) {
            const got = await Promise.all(take.slice(i, i + 40).map(w => kv.get(w.key, 'json').catch(() => null)));
            got.forEach((rec, j) => {
                if (!rec || typeof rec !== 'object' || !rec.rows) return;
                const { p } = take[i + j];
                for (const [id, r] of Object.entries(rec.rows)) {
                    if (!r || typeof r !== 'object') continue;   // an untagged row still goes, so the sheet can clear it
                    rows.push({ id: `${p.id}|${rec.date}|${id}`, program: p.id, programLabel: p.label, batch: str(rec.batch, 24), date: str(rec.date, 10), day: rec.day || '',
                        name: str(r.name || id, 80), training: str(r.training || rec.training, 160), timeIn: str(r.timeIn, 5), timeOut: str(r.timeOut, 5),
                        status: str(r.status, 40), note: str(r.note, 300), at: str(r.at || rec.updatedAt, 40) });
                }
            });
        }
        return json({ success: true, from, to, partial: take.length < wanted.length, rows }, 200, noStore);
    } catch (err) {
        return json({ success: false, error: err.message }, 500, noStore);
    }
}

import { json, sameSecret } from '../_utils.js';
import { PROGRAMS, DATE, KEY, str, cleanBatch, batchKeyOf, makeKv, checkins, cleanFields, saveRows } from '../_attendance.js';

// The attendance Google Sheet's link to the platform (attendance-sync.gs, in the sheet's Apps Script).
// The sheet can't sign in like an admin, so it sends a key: Authorization: Bearer <ATTENDANCE_FEED_KEY>
// (a Pages secret, a long random string; until it's set, this is off).
//   GET  ?days=<1–31> → { rows: [{ id, program, programLabel, batch, date, day, name, training, timeIn, timeOut, status, note, at }], from, to }
//        Every program's attendance for the last <days> days (Eastern time): one row per trainee per day that
//        was tagged (or since cleared) or has an automatic Time In. id = <program>|<batch key>|<date>|<trainee id>.
//   POST { id, batch, name, fields: { training, timeIn, timeOut, status, note }, by } → { at }
//        An edit made in the sheet: changes only the fields sent, in that trainee's day on the platform.
// The records are the courses' own (see ../_attendance.js).
const noStore = { 'Cache-Control': 'no-store' };
const etDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const isPreviewHost = (host) => /\.pages\.dev$/.test(host) && host.split('.').length > 3;

function guard(request, env) {
    if (!env.ATTENDANCE_FEED_KEY) return json({ success: false, error: 'The attendance feed isn’t set up: add the ATTENDANCE_FEED_KEY secret to this Pages project.' }, 404, noStore);
    const h = request.headers.get('Authorization') || '';
    if (!sameSecret(h.startsWith('Bearer ') ? h.slice(7).trim() : '', env.ATTENDANCE_FEED_KEY)) return json({ success: false, error: 'Wrong feed key.' }, 401, noStore);
    if (!env.COURSE_KV) return json({ success: false, error: 'Course data isn’t connected (COURSE_KV).' }, 500, noStore);
    return null;
}

export async function onRequestGet({ request, env }) {
    const bad = guard(request, env); if (bad) return bad;
    const days = Math.min(31, Math.max(1, Math.round(Number(new URL(request.url).searchParams.get('days')) || 7)));
    const to = etDate(new Date()), from = etDate(new Date(Date.now() - (days - 1) * 864e5));
    try {
        const ctx = makeKv(env.COURSE_KV), rows = [];
        for (const p of PROGRAMS) {
            const pre = p.prefix + 'attendance:', wanted = [], logged = {};
            for (const k of await ctx.keys(pre)) {
                const m = /^([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(k.slice(pre.length)); if (!m) continue;
                (logged[m[1]] = logged[m[1]] || []).push(m[2]);
                if (m[2] >= from && m[2] <= to) wanted.push({ key: m[1], name: k });
            }
            const recs = await ctx.getAll(wanted.map(w => w.name));
            const ci = await checkins(ctx, p, ''), seen = new Set();
            const row = (key, date, id, rec, r, c) => {
                const a = String((r && r.at) || ''), b = String((c && c.at) || '');
                return { id: `${p.id}|${key}|${date}|${id}`, program: p.id, programLabel: p.label, batch: str(rec ? rec.batch : c.batch, 24), date,
                    day: (rec && rec.day) || (logged[key] || []).filter(d => d < date).length + 1, name: str((r && r.name) || (c && c.name) || id, 80),
                    training: str((r && r.training) || (rec && rec.training) || (c && c.training), 160), timeIn: str((r && r.timeIn) || (c && c.timeIn), 5),
                    timeOut: str(r && r.timeOut, 5), status: str(r && r.status, 40), note: str(r && r.note, 300), at: a > b ? a : b };
            };
            recs.forEach((rec, i) => {
                if (!rec || typeof rec !== 'object' || !rec.rows) return;
                const { key } = wanted[i], date = wanted[i].name.slice(pre.length + key.length + 1);
                for (const [id, r] of Object.entries(rec.rows)) { if (r && typeof r === 'object') { seen.add(date + '|' + id); rows.push(row(key, date, id, rec, r, ci[date + '|' + id])); } }
            });
            // Automatic Time Ins that no one has tagged yet.
            for (const [dk, c] of Object.entries(ci)) {
                const date = dk.slice(0, 10), id = dk.slice(11);
                if (seen.has(dk) || date < from || date > to) continue;
                rows.push(row(batchKeyOf(c.batch), date, id, null, null, Object.assign({}, c, { batch: cleanBatch(c.batch) })));
            }
        }
        return json({ success: true, from, to, rows }, 200, noStore);
    } catch (err) {
        return json({ success: false, error: err.message }, 500, noStore);
    }
}

export async function onRequestPost({ request, env }) {
    const bad = guard(request, env); if (bad) return bad;
    if (isPreviewHost(new URL(request.url).hostname)) return json({ success: false, error: 'Saving is turned off on preview deployments: they use the live course data.' }, 403, noStore);
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400, noStore); }
    const [pid, key, date, id] = String((body && body.id) || '').split('|');
    const p = PROGRAMS.find(x => x.id === pid);
    if (!p || !KEY.test(key || '') || !DATE.test(date || '') || !/^[A-Za-z0-9_-]{1,100}$/.test(id || '')) return json({ success: false, error: 'This row isn’t from the platform (its Key is missing or changed).' }, 400, noStore);
    const c = cleanFields(body.fields);
    if (c.error) return json({ success: false, error: c.error }, 400, noStore);
    delete c.fields.name;
    if (!Object.keys(c.fields).length) return json({ success: false, error: 'Nothing to save.' }, 400, noStore);
    try {
        // A new row starts from the trainee's automatic Time In and the name the sheet shows.
        const ci = (await env.COURSE_KV.get(`${p.prefix}checkin:${date}:${id}`, 'json').catch(() => null)) || {};
        const record = await saveRows(env.COURSE_KV, p, key, date, { [id]: c.fields }, { by: 'sheet' + (body.by ? ':' + str(body.by, 70) : ''), batchLabel: body.batch,
            checkin: { [id]: Object.assign({}, ci, { name: ci.name || str(body.name, 80) }) } });
        return json({ success: true, at: record.rows[id].at }, 200, noStore);
    } catch (err) {
        return json({ success: false, error: err.message }, 500, noStore);
    }
}

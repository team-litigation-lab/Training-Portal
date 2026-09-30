import { json, requireSession } from '../_utils.js';
import { PROGRAMS, DATE, KEY, str, cleanBatch, batchKeyOf, lessons, defaultTraining, makeKv, checkins, cleanFields, saveRows } from '../_attendance.js';

// Attendance for every program (/attendance.html), admins only. The records are the courses' own
// (see ../_attendance.js), so attendance can be taken here, in each course's Admin → 🕘 Attendance
// tab, or in the Google Sheet.
//   GET  ?program=<id>&date=<YYYY-MM-DD> → { programs, program, date, lessons,
//          batches: [{ batch, key, trainees, record, day, training, checkins: { <id>: { timeIn, at } } }] }
//   GET  ?program=<id>&batch=<key>&history=1 → { records } (every day logged for that batch, oldest first)
//   POST { program, batch: <key>, batchLabel, date, head: { day, training }, rows: { <id>: { name, training, timeIn, timeOut, status, note } } }
//        → re-reads the day and changes only the fields sent.
const noStore = { 'Cache-Control': 'no-store' };
const isPreviewHost = (host) => /\.pages\.dev$/.test(host) && host.split('.').length > 3;

async function guard(request, env) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return { res: auth.response };
    if (!env.COURSE_KV) return { res: json({ success: false, connected: false, error: 'Course data isn’t connected yet: add the COURSE_KV binding (the courses’ LSH_KV namespace) to this Pages project.' }, 200, noStore) };
    return { auth };
}

export async function onRequestGet({ request, env }) {
    const g = await guard(request, env); if (g.res) return g.res;
    const url = new URL(request.url);
    const p = PROGRAMS.find(x => x.id === url.searchParams.get('program'));
    if (!p) return json({ success: false, error: 'Unknown program.' }, 400, noStore);
    const programs = PROGRAMS.map(x => ({ id: x.id, label: x.label }));
    const ctx = makeKv(env.COURSE_KV), pre = p.prefix + 'attendance:';
    try {
        if (url.searchParams.get('history')) {
            const key = url.searchParams.get('batch') || '';
            if (!KEY.test(key)) return json({ success: false, error: 'Choose a batch.' }, 400, noStore);
            const keys = (await ctx.keys(pre + key + ':')).filter(k => DATE.test(k.slice((pre + key + ':').length))).sort();
            const records = (await ctx.getAll(keys)).filter(r => r && typeof r === 'object');
            return json({ success: true, program: p.id, batch: key, records }, 200, noStore);
        }
        const date = url.searchParams.get('date') || '';
        if (!DATE.test(date)) return json({ success: false, error: 'Choose a date.' }, 400, noStore);
        const recs = (await ctx.getAll(await ctx.keys(p.prefix + 'trainee:'))).filter(r => r && typeof r === 'object' && r.approved === true && !r.archived);
        const groups = {};
        recs.forEach(r => { const label = cleanBatch(r.batch); (groups[label] = groups[label] || []).push(r); });
        const logged = {};
        (await ctx.keys(pre)).forEach(k => { const m = /^([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(k.slice(pre.length)); if (m) (logged[m[1]] = logged[m[1]] || []).push(m[2]); });
        const labels = Object.keys(groups).sort((a, b) => (a === '') - (b === '') || b.localeCompare(a, undefined, { numeric: true }));
        const want = labels.map(l => batchKeyOf(l)).filter(k => (logged[k] || []).includes(date));
        const got = await ctx.getAll(want.map(k => pre + k + ':' + date));
        const byKey = {}; want.forEach((k, i) => { if (got[i]) byKey[k] = got[i]; });
        const opendays = p.openLessons ? await ctx.get(p.prefix + 'settings:opendays') : null;
        const ci = await checkins(ctx, p, date);
        const batches = labels.map(label => {
            const key = batchKeyOf(label), members = groups[label], record = byKey[key] || null, dates = (logged[key] || []).sort();
            const mine = {}; members.forEach(r => { const c = ci[date + '|' + r.id]; if (c) mine[r.id] = { timeIn: c.timeIn, at: c.at }; });
            return { batch: label, key, record, logged: dates.length, checkins: mine,
                day: record && record.day ? record.day : dates.filter(d => d < date).length + 1,
                training: defaultTraining(p, label, members, opendays),
                trainees: members.map(r => ({ id: r.id, name: str(r.name || r.id, 80) })).sort((a, b) => a.name.localeCompare(b.name)) };
        });
        return json({ success: true, connected: true, programs, program: p.id, date, lessons: lessons(p), batches, generatedAt: new Date().toISOString() }, 200, noStore);
    } catch (err) {
        return json({ success: false, error: err.message }, 500, noStore);
    }
}

export async function onRequestPost({ request, env }) {
    const g = await guard(request, env); if (g.res) return g.res;
    // Pages preview deployments share the live bindings (the live course data), so they never write to it.
    if (isPreviewHost(new URL(request.url).hostname)) return json({ success: false, error: 'Saving is turned off on preview deployments: they use the live course data. Use the live portal.' }, 403, noStore);
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400, noStore); }
    const p = PROGRAMS.find(x => x.id === (body && body.program));
    if (!p) return json({ success: false, error: 'Unknown program.' }, 400, noStore);
    const key = String(body.batch || ''), date = String(body.date || '');
    if (!KEY.test(key) || key.length > 40) return json({ success: false, error: 'Choose a batch.' }, 400, noStore);
    if (!DATE.test(date)) return json({ success: false, error: 'Choose a date.' }, 400, noStore);
    const rows = body.rows && typeof body.rows === 'object' ? body.rows : {};
    if (Object.keys(rows).length > 200) return json({ success: false, error: 'Too many rows.' }, 400, noStore);
    const clean = {};
    for (const [id, v] of Object.entries(rows)) {
        if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return json({ success: false, error: 'Invalid row.' }, 400, noStore);
        const c = cleanFields(v); if (c.error) return json({ success: false, error: c.error }, 400, noStore);
        clean[id] = c.fields;
    }
    try {
        const record = await saveRows(env.COURSE_KV, p, key, date, clean, { head: body.head && typeof body.head === 'object' ? body.head : {}, by: g.auth.session.username, batchLabel: body.batchLabel });
        return json({ success: true, record }, 200, noStore);
    } catch (err) {
        return json({ success: false, error: err.message }, 500, noStore);
    }
}

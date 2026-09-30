import { json, requireSession } from '../_utils.js';

// Attendance for every program (/attendance.html), admins only.
//
// Each course takes attendance in its own Admin → 🕘 Attendance tab (js/attendance.js, the same
// file in every course) and keeps it in the shared KV namespace the course Workers use (LSH_KV),
// under the course's key prefix, one record per batch per day:
//   <prefix>attendance:<batch key>:<YYYY-MM-DD> =
//     { v, batch, date, day, training, rows: { <trainee id>: { name, training, timeIn, timeOut, status, note, at } }, updatedAt }
// The batch key is the course's slugPart(cleanBatch(batch)), "_none" for no batch. This reads and
// writes the same records through the COURSE_KV binding, so attendance can be taken in either place.
//   GET  ?program=<id>&date=<YYYY-MM-DD> → { programs, program, date, lessons, batches: [{ batch, key, trainees, record, day, training, logged }] }
//   GET  ?program=<id>&batch=<key>&history=1 → { records } (every day logged for that batch, oldest first)
//   POST { program, batch: <key>, batchLabel, date, head: { day, training }, rows: { <id>: { name, training, timeIn, timeOut, status, note } } }
//        → re-reads the day and writes only the rows (and head fields) sent, like the course tab does.
// The lessons are the courses' own (their DAYS), for the Training list and each batch's default
// training; keep them in step with the courses. A course with no lessons here gets a free-text Training.
const PROGRAMS = [
    { id: 'ft', label: 'Standard Foundational Training', prefix: 'ft:', named: true, openLessons: true,
        before: ['Onboarding', 'Setting of Expectations & Tech Set-up'], orientation: 'Training Orientation and Rules',
        days: ['Virtual Assistant Essentials', 'Law Firm Communication', 'Personal Injury Process Flow', 'Receptionist Training',
            'Calendaring & Appointment Setting Training', 'Intake Specialist Training', 'Claims Specialist Training',
            'Medical Records Specialist Training', 'Lien Negotiator Training'] },
    { id: 'eapa', label: 'EA / PA Training', prefix: '',
        days: ['Foundations of the Legal Executive Assistant Role', 'Managing Up & How to Leverage AI with Precision', 'Time, Calendar & Travel Management',
            'Data & Outreach', 'Household, Risk & Lifestyle Support', 'Business Setup, Compliance & Project Leadership', 'Financial Operations Support',
            'Access, Confidentiality & Crisis Management', 'Events, Compliance Tracking & Reputation', 'Digital Presence & Social Media Support'] },
    { id: 'cm', label: 'CM Training', prefix: 'cm:',
        days: ['Case Management Fundamentals, Intake & Treatment', 'Pre-Demand, BI Demand & BI Settlement', 'UM Demand, UM Settlement, Lien Reduction & Disbursement',
            'Mediation, Arbitration & Their Bottlenecks', 'Litigation, Property Damage, Liability Disputes & MIA Clients'] },
    { id: 'pd', label: 'PD Claims Training', prefix: 'pd:',
        days: ['PD Claims Foundations & Setting Up the Claim', 'Coverage: Reading the Policy & Spotting Coverages', 'Rental, Storage, Inspections & Repairs',
            'Total Loss, Valuation & Negotiation', 'Releases, Payment, Subrogation & Closing the PD Claim'] },
    { id: 'md', label: 'Medsum & Demand Training', prefix: 'md:', days: [] }
];
// The attendance sheet's statuses (js/attendance.js has them with their colors).
const STATUSES = ['Present', 'Late', 'Late with Notif', 'Early Out - POC Approved', 'Undertime - POC Approved', 'Undertime - No Approval',
    'NCNS', 'Sick Leave', 'RL', 'EOP', 'Absent with Notif'];
const KV_BUDGET = 950;   // Workers KV allows 1,000 operations per request
const noStore = { 'Cache-Control': 'no-store' };
const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^([01]\d|2[0-3]):[0-5]\d$/, KEY = /^(_none|[a-z0-9]+(-[a-z0-9]+)*)$/;
const str = (v, n) => String(v == null ? '' : v).slice(0, n);

// The courses' batch rules (cleanBatch, slugPart), so the keys match theirs.
const cleanBatch = (b) => { const v = String(b || '').trim(); return /^[A-Za-z0-9][A-Za-z0-9 _\-]{0,23}$/.test(v) ? v : ''; };
const slugPart = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const batchKeyOf = (label) => slugPart(label) || '_none';
const lessonName = (p, i) => p.named ? p.days[i] : `Day ${i + 1}: ${p.days[i]}`;
const lessons = (p) => [...(p.before || []), ...(p.orientation ? [p.orientation] : []), ...p.days.map((_, i) => lessonName(p, i))];
const isPreviewHost = (host) => /\.pages\.dev$/.test(host) && host.split('.').length > 3;

function makeKv(kv) {
    let ops = 0;
    const over = () => ops >= KV_BUDGET;
    return {
        over,
        async keys(prefix) {
            const out = []; let cursor;
            do {
                if (over()) throw new Error('There are more course records than one request can read.');
                ops++;
                const page = await kv.list({ prefix, cursor, limit: 1000 });
                page.keys.forEach(k => out.push(k.name));
                cursor = page.list_complete ? null : page.cursor;
            } while (cursor);
            return out;
        },
        async getAll(keys) {
            if (ops + keys.length > KV_BUDGET) throw new Error('There are more course records than one request can read.');
            ops += keys.length;
            const out = [];
            for (let i = 0; i < keys.length; i += 40) out.push(...await Promise.all(keys.slice(i, i + 40).map(k => kv.get(k, 'json').catch(() => null))));
            return out;
        },
        async get(key) { ops++; return kv.get(key, 'json').catch(() => null); }
    };
}

// A batch's training for the day, as the course picks it: Foundational's latest open lesson
// (Admin → 📅 Open Lessons, settings:opendays), else its orientation; the other courses, the day most
// of the batch is on (each trainee's first unfinished day).
function defaultTraining(p, label, members, opendays) {
    if (!p.days.length) return '';
    if (p.openLessons) {
        const o = opendays || {}, k = String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const open = new Set([].concat(o.all || [], (o.batches || {})[k] || []).map(Number));
        let last = -1; p.days.forEach((_, i) => { if (open.has(i + 1)) last = i; });
        return last >= 0 ? lessonName(p, last) : (p.orientation || lessonName(p, 0));
    }
    const tally = {};
    members.forEach(r => {
        const dp = r.dayProgress || {};
        let i = p.days.findIndex((_, j) => !(dp[j + 1] && dp[j + 1].done)); if (i < 0) i = p.days.length - 1;
        tally[i] = (tally[i] || 0) + 1;
    });
    const top = Object.keys(tally).map(Number).sort((a, b) => tally[b] - tally[a] || a - b)[0];
    return lessonName(p, top == null ? 0 : top);
}

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
        const batches = labels.map(label => {
            const key = batchKeyOf(label), members = groups[label], record = byKey[key] || null, dates = (logged[key] || []).sort();
            return { batch: label, key, record, logged: dates.length,
                day: record && record.day ? record.day : dates.filter(d => d < date).length + 1,
                training: defaultTraining(p, label, members, opendays),
                trainees: members.map(r => ({ id: r.id, name: str(r.name || r.id, 80) })).sort((a, b) => a.name.localeCompare(b.name)) };
        });
        return json({ success: true, connected: true, programs, program: p.id, date, statuses: STATUSES, lessons: lessons(p), batches, generatedAt: new Date().toISOString() }, 200, noStore);
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
    const rows = body.rows && typeof body.rows === 'object' ? body.rows : {}, head = body.head && typeof body.head === 'object' ? body.head : {};
    if (Object.keys(rows).length > 200) return json({ success: false, error: 'Too many rows.' }, 400, noStore);
    const clean = {};
    for (const [id, v] of Object.entries(rows)) {
        if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !v || typeof v !== 'object') return json({ success: false, error: 'Invalid row.' }, 400, noStore);
        const status = str(v.status, 40), timeIn = str(v.timeIn, 5), timeOut = str(v.timeOut, 5);
        if (status && !STATUSES.includes(status)) return json({ success: false, error: `Unknown status “${status}”.` }, 400, noStore);
        if ((timeIn && !TIME.test(timeIn)) || (timeOut && !TIME.test(timeOut))) return json({ success: false, error: 'Times are HH:MM.' }, 400, noStore);
        clean[id] = { name: str(v.name, 80), training: str(v.training, 160), timeIn, timeOut, status, note: str(v.note, 300),
            at: new Date().toISOString(), by: str(g.auth.session.username, 80) };
    }
    const k = p.prefix + 'attendance:' + key + ':' + date;
    try {
        const kv = env.COURSE_KV;
        const latest = (await kv.get(k, 'json').catch(() => null)) || { v: 1, batch: cleanBatch(body.batchLabel), date, rows: {} };
        latest.rows = latest.rows && typeof latest.rows === 'object' ? latest.rows : {};
        const day = Math.round(Number(head.day));
        if (day >= 1 && day <= 99) latest.day = day;
        if (typeof head.training === 'string' && head.training.trim()) latest.training = str(head.training, 160);
        if (latest.day == null) latest.day = 1;
        if (latest.training == null) latest.training = '';
        Object.assign(latest.rows, clean);
        latest.updatedAt = new Date().toISOString();
        await kv.put(k, JSON.stringify(latest));
        return json({ success: true, record: latest }, 200, noStore);
    } catch (err) {
        return json({ success: false, error: err.message }, 500, noStore);
    }
}

// Shared by functions/api/attendance.js (the admin page) and functions/api/attendance-feed.js (the Google Sheet).
//
// The courses keep attendance in the shared KV namespace the course Workers use (LSH_KV, read here as
// COURSE_KV), under each course's key prefix:
//   <prefix>attendance:<batch key>:<YYYY-MM-DD> = { v, batch, date, day, training,
//       rows: { <trainee id>: { name, training, timeIn, timeOut, status, note, at, by } }, updatedAt }
//     written by each course's Admin → 🕘 Attendance tab (js/attendance.js, the same file in every course),
//     /attendance.html and the Google Sheet. The batch key is the course's slugPart(cleanBatch(batch)),
//     "_none" for no batch.
//   <prefix>checkin:<YYYY-MM-DD>:<trainee id> = { timeIn, at, name, batch, training }, metadata { t: timeIn }
//     the automatic Time In: the course Worker records it the first time a trainee opens the course that
//     day (Eastern time). Kept 40 days. A Time In in the attendance record wins over it.
// The lessons are the courses' own (their DAYS), for the Training list and each batch's default training;
// keep them in step with the courses. A course with no lessons here gets a free-text Training.
export const PROGRAMS = [
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
// The attendance sheet's statuses (js/attendance.js and attendance.html have them with their colors).
export const STATUSES = ['Present', 'Late', 'Late with Notif', 'Early Out - POC Approved', 'Undertime - POC Approved', 'Undertime - No Approval',
    'NCNS', 'Sick Leave', 'RL', 'EOP', 'Absent with Notif'];
export const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const KEY = /^(_none|[a-z0-9]+(-[a-z0-9]+)*)$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const str = (v, n) => String(v == null ? '' : v).slice(0, n);

// The courses' batch rules (cleanBatch, slugPart), so the keys match theirs.
export const cleanBatch = (b) => { const v = String(b || '').trim(); return /^[A-Za-z0-9][A-Za-z0-9 _\-]{0,23}$/.test(v) ? v : ''; };
const slugPart = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
export const batchKeyOf = (label) => slugPart(cleanBatch(label)) || '_none';
const lessonName = (p, i) => p.named ? p.days[i] : `Day ${i + 1}: ${p.days[i]}`;
export const lessons = (p) => [...(p.before || []), ...(p.orientation ? [p.orientation] : []), ...p.days.map((_, i) => lessonName(p, i))];

// A batch's training for the day, as the course picks it: Foundational's latest open lesson
// (Admin → 📅 Open Lessons, settings:opendays), else its orientation; the other courses, the day most
// of the batch is on (each trainee's first unfinished day).
export function defaultTraining(p, label, members, opendays) {
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

// Workers KV allows 1,000 operations per request: count them, and stop before the limit.
export function makeKv(kv, budget = 950) {
    let ops = 0;
    const room = (n) => { if (ops + n > budget) throw new Error('There are more course records than one request can read.'); ops += n; };
    return {
        // Every key under a prefix, with its metadata: [{ name, metadata }].
        async list(prefix) {
            const out = []; let cursor;
            do {
                room(1);
                const page = await kv.list({ prefix, cursor, limit: 1000 });
                page.keys.forEach(k => out.push(k));
                cursor = page.list_complete ? null : page.cursor;
            } while (cursor);
            return out;
        },
        async keys(prefix) { return (await this.list(prefix)).map(k => k.name); },
        async getAll(keys) {
            room(keys.length);
            const out = [];
            for (let i = 0; i < keys.length; i += 40) out.push(...await Promise.all(keys.slice(i, i + 40).map(k => kv.get(k, 'json').catch(() => null))));
            return out;
        },
        async get(key) { room(1); return kv.get(key, 'json').catch(() => null); }
    };
}

// The automatic Time Ins for one day (or every day kept): { '<date>|<trainee id>': { timeIn, at, name, batch, training } }.
// The course Worker puts them in each key's metadata ({ t, at, n, b, tr }), so a list is enough; a key
// without it is read.
const pick = (t, at, n, b, tr) => ({ timeIn: str(t, 5), at: str(at, 40), name: str(n, 80), batch: str(b, 24), training: str(tr, 160) });
export async function checkins(ctx, p, date) {
    const pre = p.prefix + 'checkin:', out = {}, missing = [];
    for (const k of await ctx.list(pre + (date ? date + ':' : ''))) {
        const m = /^(\d{4}-\d{2}-\d{2}):(.+)$/.exec(k.name.slice(pre.length)); if (!m) continue;
        const md = k.metadata;
        if (md && md.t) out[m[1] + '|' + m[2]] = pick(md.t, md.at, md.n, md.b, md.tr);
        else missing.push([k.name, m[1] + '|' + m[2]]);
    }
    if (missing.length) (await ctx.getAll(missing.map(x => x[0]))).forEach((v, i) => { if (v) out[missing[i][1]] = pick(v.timeIn, v.at, v.name, v.batch, v.training); });
    return out;
}

// A row's fields from a request: only the fields sent, checked. → { fields } or { error }.
export function cleanFields(v) {
    if (!v || typeof v !== 'object') return { error: 'Invalid row.' };
    const f = {};
    if ('status' in v) { f.status = str(v.status, 40).trim(); if (f.status && !STATUSES.includes(f.status)) return { error: `Unknown status “${f.status}”.` }; }
    for (const t of ['timeIn', 'timeOut']) if (t in v) { f[t] = str(v[t], 5); if (f[t] && !TIME.test(f[t])) return { error: 'Times are HH:MM (24-hour).' }; }
    if ('training' in v) f.training = str(v.training, 160);
    if ('note' in v) f.note = str(v.note, 300);
    if ('name' in v) f.name = str(v.name, 80);
    return { fields: f };
}

// Saves rows into a batch's day: re-reads the day and changes only the fields sent (so the courses, the
// portal page and the sheet don't overwrite each other). A new row starts from the trainee's automatic
// Time In. rows: { <trainee id>: fields }; head: { day, training }. → the saved record.
export async function saveRows(kv, p, key, date, rows, { head = {}, by = '', batchLabel = '', checkin = {} } = {}) {
    const k = p.prefix + 'attendance:' + key + ':' + date;
    const latest = (await kv.get(k, 'json').catch(() => null)) || { v: 1, batch: cleanBatch(batchLabel), date, rows: {} };
    latest.rows = latest.rows && typeof latest.rows === 'object' ? latest.rows : {};
    const day = Math.round(Number(head.day));
    if (day >= 1 && day <= 99) latest.day = day;
    if (typeof head.training === 'string' && head.training.trim()) latest.training = str(head.training, 160);
    if (latest.day == null) {
        const pre = p.prefix + 'attendance:' + key + ':';
        const dates = []; let cursor;
        do { const page = await kv.list({ prefix: pre, cursor, limit: 1000 }); page.keys.forEach(x => dates.push(x.name.slice(pre.length))); cursor = page.list_complete ? null : page.cursor; } while (cursor);
        latest.day = dates.filter(d => d < date).length + 1;
    }
    if (latest.training == null) latest.training = '';
    const at = new Date().toISOString();
    for (const [id, f] of Object.entries(rows)) {
        const ci = checkin[id] || {};
        const cur = latest.rows[id] || { name: ci.name || '', training: '', timeIn: ci.timeIn || '', timeOut: '', status: '', note: '' };
        latest.rows[id] = Object.assign({}, cur, f, { at, by: str(by, 80) });
        if (!latest.rows[id].name) latest.rows[id].name = id;
    }
    latest.updatedAt = at;
    await kv.put(k, JSON.stringify(latest));
    return latest;
}

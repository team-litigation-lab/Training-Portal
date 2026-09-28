import { json, requireSession, logActivity } from '../_utils.js';

// All-program trainee progress and feedback for admins (/progress.html).
//
// Each training program keeps its own trainees in the shared Cloudflare KV
// namespace the course Workers use (LSH_KV). This reads it through the
// COURSE_KV binding (wrangler.toml) and returns one summary row per trainee
// per program, with:
//   - the trainer's day-by-day feedback to that trainee (course key feedback:<id>)
//   - the feedback trainees sent about the program (course key tfeedback:<id>)
// plus, from the portal's own D1 database, simulator results
// (simulator_results) and graded portal activities (submissions).
//   GET ?program=<id> → { programs, program, trainees, traineeFeedback, archivedBatches,
//                         simulators:{ byName }, portalWork:{ byName }, generatedAt }
// The page has one tab per program and asks for one program at a time, so each
// request's KV read budget goes to a single program (without ?program= every
// program is read, as before).
//
// Archived batches (POST ARCHIVE_BATCH / RESTORE_BATCH, admins only):
//   - archiving sets archived:true on each of the batch's trainee records in the
//     course's KV (the same flag the course's own "Archive batch" sets), and saves
//     a snapshot of the batch's summaries (days, scores, trainer feedback) in D1
//     (progress_archive). Later loads don't fetch an archived trainee's trainer
//     feedback from KV, so old batches stop using up the read budget; the page
//     shows them from the snapshot instead.
//   - restoring clears the flag and deletes the snapshot.
// To add a program: its course's KV key prefix (the CM course stores every key
// under "cm:"), number of days and course address.
const PROGRAMS = [
    { id: 'ft', label: 'Standard Foundational Training', prefix: 'ft:', days: 10, url: 'https://foundational-training.legalsupporthelp.workers.dev/' },
    { id: 'eapa', label: 'EA / PA Training', prefix: '', days: 10, url: 'https://ea-pa-training.legalsupporthelp.workers.dev/' },
    { id: 'cm', label: 'CM Training', prefix: 'cm:', days: 5, url: 'https://case-management-training.legalsupporthelp.workers.dev/' }
];

// Workers KV allows 1,000 operations per request. Stay under it; if a very
// large roster would go over, the response says which parts were skipped.
const KV_BUDGET = 950;

const avg = (xs) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const list = (v, n) => (Array.isArray(v) ? v : []).slice(0, 6).map(x => str(x, n));

function makeKv(kv) {
    const ctx = { ops: 0, skipped: new Set() };
    ctx.keys = async (prefix, what) => {
        const keys = []; let cursor;
        do {
            if (ctx.ops >= KV_BUDGET) { ctx.skipped.add(what); break; }
            ctx.ops++;
            const page = await kv.list({ prefix, cursor, limit: 1000 });
            page.keys.forEach(k => keys.push(k.name));
            cursor = page.list_complete ? null : page.cursor;
        } while (cursor);
        return keys;
    };
    ctx.getAll = async (keys, what) => {
        const room = Math.max(0, KV_BUDGET - ctx.ops);
        if (keys.length > room) ctx.skipped.add(what);
        const take = keys.slice(0, room), out = [];
        ctx.ops += take.length;
        for (let i = 0; i < take.length; i += 40) {
            const batch = await Promise.all(take.slice(i, i + 40).map(k => kv.get(k, 'json').catch(() => null)));
            batch.forEach((v, j) => out.push([take[i + j], v]));
        }
        return out;
    };
    return ctx;
}

// The trainer's daily feedback: { days: { n: { rating, summary, strengths, areasToBuild,
// nextDayFocus, trainerNote, status: draft|sent, sentAt, readAt, sentBy } } }
function summarizeFeedback(fb) {
    const days = {};
    for (const [d, f] of Object.entries((fb && fb.days) || {})) {
        if (!f || typeof f !== 'object') continue;
        days[d] = {
            rating: str(f.rating, 30), status: f.status === 'sent' ? 'sent' : 'draft',
            summary: str(f.summary, 1200), strengths: list(f.strengths, 400), areasToBuild: list(f.areasToBuild, 400),
            nextDayFocus: list(f.nextDayFocus, 300), trainerNote: str(f.trainerNote, 600),
            sentAt: f.sentAt || null, readAt: f.readAt || null, sentBy: str(f.sentBy, 80)
        };
    }
    const vals = Object.values(days);
    const sent = vals.filter(f => f.status === 'sent');
    const latest = sent.slice().sort((a, b) => String(b.sentAt || '').localeCompare(String(a.sentAt || '')))[0];
    return { sent: sent.length, drafts: vals.length - sent.length, unread: sent.filter(f => !f.readAt).length, latestRating: latest ? latest.rating : null, days };
}

function summarize(rec, program, fb) {
    const dp = rec.dayProgress || {}, pp = rec.practiceProgress || {};
    const days = {};
    for (let d = 1; d <= program.days; d++) {
        const p = dp[d] || dp[String(d)] || {};
        days[d] = { done: !!p.done, score: num(p.score) ? p.score : null, task: num(p.surpriseTaskScore) ? p.surpriseTaskScore : null };
    }
    const kc = Object.values(dp).filter(p => p && num(p.score)).map(p => p.score);
    const tasks = Object.values(dp).filter(p => p && num(p.surpriseTaskScore)).map(p => p.surpriseTaskScore);
    const practice = Object.values(pp).filter(v => v && num(v.bestScore)).map(v => v.bestScore);
    const rp = (rec.roleplayHistory || []).filter(h => h && num(h.score)).map(h => h.score);
    const status = rec.archived ? 'Archived' : rec.rejected ? 'Rejected' : rec.approved === true ? 'Approved' : 'Pending';
    return {
        program: program.id,
        id: String(rec.id || ''),
        name: String(rec.name || [rec.firstName, rec.lastName].filter(Boolean).join(' ') || 'Unnamed trainee'),
        batch: String(rec.batch || ''),
        status,
        registeredAt: rec.registeredAt || null,
        lastActive: rec.lastActive || null,
        daysDone: Object.values(days).filter(x => x.done).length,
        daysTotal: program.days,
        kcAvg: avg(kc),
        practiceAvg: avg(practice),
        practiceDone: practice.length,
        practiceRuns: Object.values(pp).reduce((a, v) => a + ((v && v.runs) || 0), 0),
        taskAvg: avg(tasks),
        roleplayAvg: avg(rp),
        roleplayRuns: rp.length,
        days,
        feedback: summarizeFeedback(fb)
    };
}

// Feedback a trainee sent about the program (stars per area + comments).
function traineeFeedbackItem(rec, program) {
    const ratings = {};
    for (const [k, v] of Object.entries(rec.ratings || {})) if (num(v) && v >= 1 && v <= 5) ratings[str(k, 30)] = v;
    const anon = !!rec.anonymous;
    return {
        program: program.id, id: str(rec.id, 40), at: rec.at || null, dayId: num(rec.dayId) ? rec.dayId : null, ratings,
        good: str(rec.good, 1500), improve: str(rec.improve, 1500), facilitator: str(rec.facilitator, 1500),
        anonymous: anon, traineeId: anon ? null : str(rec.traineeId, 60), name: anon ? 'Anonymous' : str(rec.name, 120),
        batch: anon ? '' : str(rec.batch, 60), status: str(rec.status || 'new', 20)
    };
}

async function ensureArchiveTable(db) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS progress_archive (
        program TEXT NOT NULL, batch TEXT NOT NULL, archived_at TEXT NOT NULL, archived_by TEXT,
        trainee_count INTEGER NOT NULL DEFAULT 0, snapshot TEXT NOT NULL, PRIMARY KEY (program, batch))`).run();
}
async function archivedBatches(db, program) {
    try {
        await ensureArchiveTable(db);
        const { results } = await db.prepare(
            `SELECT batch, archived_at, archived_by, trainee_count FROM progress_archive WHERE program = ? ORDER BY archived_at DESC`
        ).bind(program).all();
        return (results || []).map(r => ({ batch: r.batch, archivedAt: r.archived_at, archivedBy: r.archived_by, count: r.trainee_count }));
    } catch (e) { return []; }
}
const batchKey = (b) => String(b || '').trim();

// visitors are saved as "Name · Batch"; records are matched to trainees by name
const nameKey = (s) => String(s || '').split(' · ')[0].trim().toLowerCase().replace(/\s+/g, ' ');

async function simulatorSummary(db) {
    try {
        const { results } = await db.prepare(
            `SELECT username, full_name, simulator, score, created_at FROM simulator_results ORDER BY id DESC LIMIT 5000`
        ).all();
        const byName = {};
        for (const r of results || []) {
            const key = nameKey(r.full_name || r.username);
            if (!key) continue;
            const s = byName[key] || (byName[key] = { runs: 0, scores: [], last: null, sims: {} });
            s.runs++; if (num(r.score)) s.scores.push(r.score);
            if (!s.last || r.created_at > s.last) s.last = r.created_at;
            s.sims[r.simulator] = (s.sims[r.simulator] || 0) + 1;
        }
        for (const k of Object.keys(byName)) { const s = byName[k]; s.avg = avg(s.scores); delete s.scores; }
        return byName;
    } catch (e) {
        return {};   // table not created yet (no simulator results so far)
    }
}

// Activities trainees submitted on the portal itself, with the grader's feedback.
async function portalWorkSummary(db) {
    try {
        const { results } = await db.prepare(
            `SELECT activity_title, trainee_username, trainee_name, status, score, feedback, submitted_at, graded_at
             FROM submissions ORDER BY submitted_at DESC LIMIT 3000`
        ).all();
        const byName = {};
        for (const r of results || []) {
            const key = nameKey(r.trainee_name || r.trainee_username);
            if (!key) continue;
            const w = byName[key] || (byName[key] = { submitted: 0, graded: 0, scores: [], last: null, items: [] });
            w.submitted++;
            if (r.status === 'Graded') { w.graded++; if (num(r.score)) w.scores.push(r.score); }
            if (!w.last || r.submitted_at > w.last) w.last = r.submitted_at;
            if (w.items.length < 15) w.items.push({ title: str(r.activity_title, 160), status: str(r.status, 20), score: num(r.score) ? r.score : null,
                feedback: str(r.feedback, 800), submittedAt: r.submitted_at || null, gradedAt: r.graded_at || null });
        }
        for (const k of Object.keys(byName)) { const w = byName[k]; w.avgScore = avg(w.scores); delete w.scores; }
        return byName;
    } catch (e) {
        return {};   // no submissions yet
    }
}

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const noStore = { 'Cache-Control': 'no-store' };
    const programs = PROGRAMS.map(({ prefix, ...p }) => p);
    const url = new URL(request.url);
    const only = url.searchParams.get('program');
    const scope = only ? PROGRAMS.filter(p => p.id === only) : PROGRAMS;
    if (only && !scope.length) return json({ success: false, error: 'Unknown program.' }, 400, noStore);
    // An archived batch's snapshot (read from D1, no KV reads).
    const snapBatch = url.searchParams.get('archivedBatch');
    if (only && snapBatch != null) {
        try {
            await ensureArchiveTable(env.TRAINING_DB);
            const row = await env.TRAINING_DB.prepare(`SELECT snapshot, archived_at, archived_by FROM progress_archive WHERE program = ? AND batch = ?`).bind(only, batchKey(snapBatch)).first();
            if (!row) return json({ success: false, error: 'No archive for that batch.' }, 404, noStore);
            return json({ success: true, program: only, batch: batchKey(snapBatch), archivedAt: row.archived_at, archivedBy: row.archived_by, trainees: JSON.parse(row.snapshot) }, 200, noStore);
        } catch (err) { return json({ success: false, error: err.message }, 500, noStore); }
    }
    const [simByName, workByName] = await Promise.all([simulatorSummary(env.TRAINING_DB), portalWorkSummary(env.TRAINING_DB)]);
    const base = { success: true, programs, program: only || null, simulators: { byName: simByName }, portalWork: { byName: workByName },
        archivedBatches: only ? await archivedBatches(env.TRAINING_DB, only) : [] };
    const kv = env.COURSE_KV;
    if (!kv) {
        return json({ ...base, connected: false, trainees: [], traineeFeedback: [],
            note: 'Course data isn’t connected yet: add the COURSE_KV binding (the courses’ LSH_KV namespace) to this Pages project.' }, 200, noStore);
    }
    try {
        const ctx = makeKv(kv);
        const trainees = [], traineeFeedback = [];
        for (const program of scope) {
            const p = program.prefix, L = program.label;
            const recs = (await ctx.getAll(await ctx.keys(p + 'trainee:', L + ' trainees'), L + ' trainees'))
                .map(([, v]) => v).filter(v => v && typeof v === 'object');
            // Only fetch trainer feedback for trainees who have some.
            const fbKeys = new Set(await ctx.keys(p + 'feedback:', L + ' trainer feedback'));
            // Archived trainees' feedback lives in their batch's snapshot, so it isn't re-read here.
            const wanted = recs.filter(r => !r.archived).map(r => p + 'feedback:' + r.id).filter(k => fbKeys.has(k));
            const fbById = {};
            (await ctx.getAll(wanted, L + ' trainer feedback')).forEach(([k, v]) => { fbById[k.slice((p + 'feedback:').length)] = v; });
            recs.forEach(rec => trainees.push(summarize(rec, program, fbById[rec.id])));
            const tfb = await ctx.getAll(await ctx.keys(p + 'tfeedback:', L + ' trainee feedback'), L + ' trainee feedback');
            tfb.forEach(([, v]) => { if (v && typeof v === 'object') traineeFeedback.push(traineeFeedbackItem(v, program)); });
        }
        traineeFeedback.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
        const skipped = [...ctx.skipped];
        return json({ ...base, connected: true, trainees, traineeFeedback, generatedAt: new Date().toISOString(),
            ...(skipped.length ? { partial: true, note: `There’s more course data than one request can read, so some of it isn’t shown: ${skipped.join(', ')}.` } : {}) },
            200, noStore);
    } catch (err) {
        return json({ success: false, error: err.message }, 500, noStore);
    }
}

// Archive or restore one batch of one program (admins only).
//   { action: 'ARCHIVE_BATCH' | 'RESTORE_BATCH', program, batch }
// Pages preview deployments (<hash-or-branch>.<project>.pages.dev) share this
// project's bindings, i.e. the live course data, so they never write to it.
const isPreviewHost = (host) => /\.pages\.dev$/.test(host) && host.split('.').length > 3;

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const noStore = { 'Cache-Control': 'no-store' };
    if (isPreviewHost(new URL(request.url).hostname)) {
        return json({ success: false, error: 'Archiving is turned off on preview deployments: they read the live course data. Use the live portal.' }, 403, noStore);
    }
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400, noStore); }
    const { action } = body || {};
    const program = PROGRAMS.find(p => p.id === (body && body.program));
    const batch = batchKey(body && body.batch);
    if (!program) return json({ success: false, error: 'Unknown program.' }, 400, noStore);
    if (!batch) return json({ success: false, error: 'Choose a batch.' }, 400, noStore);
    if (action !== 'ARCHIVE_BATCH' && action !== 'RESTORE_BATCH') return json({ success: false, error: 'Unknown action.' }, 400, noStore);
    const kv = env.COURSE_KV;
    if (!kv) return json({ success: false, error: 'Course data isn’t connected (COURSE_KV).' }, 500, noStore);
    const db = env.TRAINING_DB;
    try {
        await ensureArchiveTable(db);
        const ctx = makeKv(kv), p = program.prefix;
        const recs = (await ctx.getAll(await ctx.keys(p + 'trainee:', 'trainees'), 'trainees')).filter(([, v]) => v && typeof v === 'object');
        if (ctx.skipped.size) return json({ success: false, error: 'Too many trainee records to update in one request.' }, 507, noStore);
        const archiving = action === 'ARCHIVE_BATCH';
        const members = recs.filter(([, v]) => batchKey(v.batch) === batch && (archiving ? !v.archived : !!v.archived));
        if (archiving) {
            if (!members.length) return json({ success: false, error: 'Nobody active in that batch.' }, 404, noStore);
            const fbKeys = new Set(await ctx.keys(p + 'feedback:', 'trainer feedback'));
            const fbById = {};
            (await ctx.getAll(members.map(([, v]) => p + 'feedback:' + v.id).filter(k => fbKeys.has(k)), 'trainer feedback'))
                .forEach(([k, v]) => { fbById[k.slice((p + 'feedback:').length)] = v; });
            const snapshot = members.map(([, v]) => ({ ...summarize(v, program, fbById[v.id]), status: 'Archived' }));
            // Merge with an earlier snapshot of the same batch (someone archived later).
            const prev = await db.prepare(`SELECT snapshot FROM progress_archive WHERE program = ? AND batch = ?`).bind(program.id, batch).first();
            const merged = (prev ? JSON.parse(prev.snapshot).filter(x => !snapshot.some(y => y.id === x.id)) : []).concat(snapshot);
            await db.prepare(`INSERT INTO progress_archive (program, batch, archived_at, archived_by, trainee_count, snapshot) VALUES (?, ?, datetime('now'), ?, ?, ?)
                ON CONFLICT(program, batch) DO UPDATE SET archived_at = excluded.archived_at, archived_by = excluded.archived_by, trainee_count = excluded.trainee_count, snapshot = excluded.snapshot`)
                .bind(program.id, batch, auth.session.username, merged.length, JSON.stringify(merged)).run();
        }
        for (const [key, v] of members) await kv.put(key, JSON.stringify({ ...v, archived: archiving }));
        if (!archiving) await db.prepare(`DELETE FROM progress_archive WHERE program = ? AND batch = ?`).bind(program.id, batch).run();
        await logActivity(db, auth.session.username, auth.session.batchId, archiving ? 'PROGRESS_BATCH_ARCHIVED' : 'PROGRESS_BATCH_RESTORED', { program: program.id, batch, count: members.length });
        return json({ success: true, count: members.length }, 200, noStore);
    } catch (err) {
        return json({ success: false, error: err.message }, 500, noStore);
    }
}

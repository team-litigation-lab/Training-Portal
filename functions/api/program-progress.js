import { json, requireSession } from '../_utils.js';

// All-program trainee progress for admins (/progress.html).
//
// Each training program keeps its own trainees in the shared Cloudflare KV
// namespace the course Workers use (LSH_KV). This reads it through the
// COURSE_KV binding (wrangler.toml) and returns one summary row per trainee,
// plus the portal's own simulator results (D1 simulator_results).
//   GET → { programs:[…], trainees:[…], simulators:{ byName:{…} }, generatedAt }
// Admins only. Read-only: nothing here writes to the courses' data.
const PROGRAMS = [
    { id: 'eapa', label: 'EA / PA Training', prefix: 'trainee:', days: 10, url: 'https://ea-pa-training.legalsupporthelp.workers.dev/' },
    { id: 'cm', label: 'Revised CM Training', prefix: 'cm:trainee:', days: 5, url: '' }
];

const avg = (xs) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
const num = (v) => typeof v === 'number' && Number.isFinite(v);

async function listKeys(kv, prefix) {
    const keys = []; let cursor;
    do {
        const page = await kv.list({ prefix, cursor, limit: 1000 });
        page.keys.forEach(k => keys.push(k.name));
        cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return keys;
}

function summarize(rec, program) {
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
        days
    };
}

async function simulatorSummary(db) {
    try {
        const { results } = await db.prepare(
            `SELECT username, full_name, simulator, score, created_at FROM simulator_results ORDER BY id DESC LIMIT 5000`
        ).all();
        const byName = {};
        for (const r of results || []) {
            // visitors are saved as "Name · Batch"; match trainees by name
            const key = String(r.full_name || r.username || '').split(' · ')[0].trim().toLowerCase();
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

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const noStore = { 'Cache-Control': 'no-store' };
    const kv = env.COURSE_KV;
    const simulators = { byName: await simulatorSummary(env.TRAINING_DB) };
    if (!kv) {
        return json({ success: true, connected: false, programs: PROGRAMS.map(({ prefix, ...p }) => p), trainees: [], simulators,
            note: 'Course data isn’t connected yet: add the COURSE_KV binding (the courses’ LSH_KV namespace) to this Pages project.' }, 200, noStore);
    }
    try {
        const trainees = [];
        for (const program of PROGRAMS) {
            const keys = await listKeys(kv, program.prefix);
            for (let i = 0; i < keys.length; i += 40) {
                const batch = await Promise.all(keys.slice(i, i + 40).map(k => kv.get(k, 'json').catch(() => null)));
                batch.forEach(rec => { if (rec && typeof rec === 'object') trainees.push(summarize(rec, program)); });
            }
        }
        return json({ success: true, connected: true, programs: PROGRAMS.map(({ prefix, ...p }) => p), trainees, simulators, generatedAt: new Date().toISOString() }, 200, noStore);
    } catch (err) {
        return json({ success: false, error: err.message }, 500, noStore);
    }
}

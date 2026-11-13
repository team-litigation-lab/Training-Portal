// What a revoked account leaves behind, and how it is taken out.
//
// Revoking access ends with nothing of that person's work left on the platform —
// so everything is collected into one record FIRST, filed to their batch's folder
// on the Shared Drive (functions/_drive.js), and only then deleted. The deletion is
// irreversible and the filed record is the only copy, which is why revoke-user.js
// refuses to delete anything until the backup is safely somewhere.
//
// Scores go too. They are not anonymised and kept: a batch average after a
// revocation is the average of the people still in the batch.
//
// Their own activity-log rows go too (their log-ins, uploads, submissions), in both
// databases, so a revoked trainee leaves no trace in Server Logs or Activity Logs.
// The one row kept is the trainer's own "Revoked an account" entry, which is the
// trainer's action, not the trainee's. The tombstone (deleted_users) stays: it is
// what stops the username being taken again, and it is how purgeRevokedLeftovers()
// below finds anything an older revocation (before all this was purged) left behind.

import { canonicalBatch } from './_utils.js';
import { directMatches, revokedMatches, liveAccounts, recEnds, batchForm as ftBatchForm, both } from './_ft-block.js';

const PROGRAMS = [
    { id: 'ft', label: 'Standard Foundational Training', prefix: 'ft:' },
    { id: 'eapa', label: 'EA / PA Training', prefix: '' },
    { id: 'cm', label: 'Case Management Training', prefix: 'cm:' },
    { id: 'pd', label: 'PD Claims Training', prefix: 'pd:' },
    { id: 'md', label: 'Medsum & Demand Training', prefix: 'md:' },
    { id: 'ln', label: 'Lien Negotiator Training', prefix: 'ln:' }
];
// The courses key their records by their own trainee id, not by the Portal's
// username, so a person is found in them by name and batch: findCourseRecords() below.
const nameKey = (s) => String(s || '').split(' · ')[0].trim().toLowerCase().replace(/\s+/g, ' ');
const fullName = (u) => [u.first_name, u.mi, u.last_name, u.suffix].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
// a batch in its one form (B103026 and B10302026 are the same batch)
const batchForm = (b) => canonicalBatch(b) || String(b || '').trim().toUpperCase();

const KV_BUDGET = 900;          // Workers KV allows 1,000 operations per request

async function rows(db, sql, ...binds) {
    if (!db) return [];
    try { const { results } = await db.prepare(sql).bind(...binds).all(); return results || []; }
    catch (e) { return []; }    // a table this deployment doesn't have yet
}

// Everything keyed to this person, read before anything is deleted.
export async function collectUserRecords(env, user) {
    const name = fullName(user), key = nameKey(name);
    const t = env.TRAINING_DB, d = env.DB;
    const [submissions, simulatorResults, calsim, gcalDrafts, gcalReviews, topicAccess, draftingDrafts, emailPractice, activityLog, trainingActivityLog] = await Promise.all([
        rows(t, `SELECT * FROM submissions WHERE trainee_username = ?`, user.username),
        rows(t, `SELECT * FROM simulator_results WHERE username = ?`, user.username),
        rows(t, `SELECT * FROM calsim_records WHERE username = ?`, user.username),
        rows(t, `SELECT * FROM gcal_drafts WHERE username = ?`, user.username),
        rows(t, `SELECT * FROM gcal_reviews WHERE username = ?`, user.username),
        rows(t, `SELECT * FROM trainee_topic_access WHERE trainee_username = ?`, user.username),
        rows(t, `SELECT * FROM drafting_drafts WHERE username = ?`, user.username),
        rows(t, `SELECT * FROM email_practice WHERE lower(trim(who_name)) = ?`, key),
        rows(d, `SELECT * FROM activity_log WHERE actor_username = ?`, user.username),
        rows(t, `SELECT * FROM activity_log WHERE actor_username = ?`, user.username)
    ]);
    // A simulator result can also be filed under the name a trainee typed in
    // ("who's practicing"), with no username on it — those are theirs as well.
    const byName = await rows(t, `SELECT * FROM simulator_results WHERE username IS NULL AND lower(full_name) = ?`, key);

    const live = (await liveAccounts(d)).filter(x => x.username !== user.username);
    const found = await findCourseRecords(env, [{ name, batch: user.batch_id, username: user.username }], live);
    const course = found.course, skipped = found.skipped;
    return {
        account: user,
        submissions, simulatorResults: simulatorResults.concat(byName), calsim, gcalDrafts, gcalReviews, topicAccess,
        draftingDrafts, emailPractice: emailPractice.filter(r => !r.who_batch || !user.batch_id || batchForm(r.who_batch) === batchForm(user.batch_id)),
        activityLog: activityLog.concat(trainingActivityLog),
        course,
        courseIncomplete: [...new Set(skipped)],
        collectedAt: new Date().toISOString()
    };
}

// 🎓 Every program's own record of a revoked person: what every roster, Batch Sheet, ranking and scorecard in that
// program is drawn from. All six courses keep their trainees in the shared COURSE_KV as <prefix>trainee:<id>, the id
// being their first and last name and their batch, slugged, and everything else of theirs as <prefix><family>:<id>.
// So a person is found the way Standard Foundational Training's block list finds them (_ft-block.js): their ids read
// straight first, then each program's list searched by name (every form of it) and batch, or by first + last name in any
// batch when no open Portal account has that name. A record an open account could own (same first and last name, same
// batch) is never taken. Deleting the trainee record takes them off every sheet of that program; the rest of their keys
// go with it. people = [{ name, batch, username }]; live = liveAccounts() of everyone still on the Portal.
// Returns { course: [{ program, label, id, person, keys: [{ key, value }] }], skipped: [program label] }.
const FAMILIES = ['feedback', 'progress', 'backup:progress', 'focus', 'checkin', 'callsim', 'simresults', 'actsub', 'actup',
    'labreview', 'merged', 'workspace', 'wsreview', 'assign', 'release', 'assess', 'buffer', 'calcheck', 'calrules', 'calsim',
    'calweek', 'daycheck', 'drills', 'drivelink', 'guide', 'intakeassign', 'intakecheck', 'kcgames', 'kcreview', 'learn',
    'listening', 'lor', 'lorassign', 'monitor', 'process', 'rankshare', 'sessions', 'shadow', 'skills', 'tracker',
    'trackerreview', 'trainerfb', 'transcribe', 'videoaccess', 'videoreq'];
const FT_ONLY = new Set(['assess', 'buffer', 'calcheck', 'calrules', 'calsim', 'calweek', 'daycheck', 'drills', 'drivelink', 'guide',
    'intakeassign', 'intakecheck', 'kcgames', 'kcreview', 'learn', 'listening', 'lor', 'lorassign', 'monitor', 'process', 'rankshare',
    'sessions', 'shadow', 'skills', 'tracker', 'trackerreview', 'trainerfb', 'transcribe', 'videoaccess', 'videoreq']);
const familiesFor = (p) => FAMILIES.filter(f => p.id === 'ft' || !FT_ONLY.has(f));
export async function findCourseRecords(env, people, live, budget = KV_BUDGET) {
    const kv = env.COURSE_KV, course = [], skipped = [];
    if (!kv || !people.length) return { course, skipped };
    let ops = 0;
    const ownedByLive = (rec) => live.some(x => recEnds(rec).includes(x.e)
        && (!x.b || [rec.batch, rec.batchFrom].filter(Boolean).map(ftBatchForm).includes(x.b)));
    const hits = [];      // { p: program, person, id, rec }
    // 1. their ids, read straight: a few reads a person a program
    for (const p of PROGRAMS) for (const person of people) {
        const seen = new Set();
        if (ops >= budget / 3) { skipped.push(p.label); break; }
        (await directMatches(kv, person, seen, p.prefix)).forEach(x => { if (!ownedByLive(x.rec)) hits.push({ p, person, ...x }); });
        ops += seen.size;
    }
    // 2. each program's list, searched by the names in its keys (an id is the name slugged, then '--' and the batch), so only
    //    the records that could be theirs are read; then matched on the record itself
    const slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const ends = (sl) => { const w = sl.split('-').filter(x => x.length > 1 && !['jr', 'sr', 'ii', 'iii', 'iv'].includes(x)); return w.length > 1 ? w[0] + '-' + w[w.length - 1] : w.join('-'); };
    const want = people.map(person => ends(slug(person.name)));
    for (const p of PROGRAMS) {
        let cursor, ids = [];
        try {
            do {
                ops++;
                const page = await kv.list({ prefix: `${p.prefix}trainee:`, cursor, limit: 1000 });
                page.keys.forEach(k => ids.push(k.name.slice(`${p.prefix}trainee:`.length)));
                cursor = page.list_complete ? null : page.cursor;
            } while (cursor);
        } catch (e) { skipped.push(p.label); continue; }
        const cand = ids.filter(id => want.includes(ends(id.split('--')[0])) && !hits.some(h => h.p === p && h.id === id));
        const all = [];
        for (const id of cand) {
            if (ops++ >= budget * 0.7) { skipped.push(p.label); break; }
            const rec = await kv.get(`${p.prefix}trainee:${id}`, 'json').catch(() => null);
            if (rec) all.push({ id, rec });
        }
        for (const person of people) revokedMatches(all, person, live).forEach(x => hits.push({ p, person, ...x }));
    }
    // 3. each record once, with everything else the program keeps under its id
    const seenKey = new Set();
    for (const h of hits) {
        const k = `${h.p.prefix}trainee:${h.id}`;
        if (seenKey.has(k)) continue; seenKey.add(k);
        const entry = { program: h.p.id, label: h.p.label, id: h.id, person: h.person.username || h.person.name, keys: [{ key: k, value: h.rec }] };
        for (const f of familiesFor(h.p)) {
            if (ops++ >= budget) { skipped.push(h.p.label); break; }
            const key = `${h.p.prefix}${f}:${h.id}`;
            const v = await kv.get(key).catch(() => null);
            if (v != null) { let val = v; try { val = JSON.parse(v); } catch (e) { /* kept as text */ } entry.keys.push({ key, value: val }); }
        }
        course.push(entry);
    }
    return { course, skipped: [...new Set(skipped)] };
}

// Then nothing of it is left. Each delete is independent: one missing table must
// not stop the rest, or a revocation would leave some of it behind.
export async function purgeUserRecords(env, user, collected) {
    const t = env.TRAINING_DB, d = env.DB, gone = {};
    const run = async (db, label, sql, ...binds) => {
        if (!db) return;
        try { const r = await db.prepare(sql).bind(...binds).run(); gone[label] = (r && r.meta && r.meta.changes) || 0; }
        catch (e) { gone[label] = `not cleared: ${e.message}`; }
    };
    await run(t, 'submissions', `DELETE FROM submissions WHERE trainee_username = ?`, user.username);
    await run(t, 'simulatorResults', `DELETE FROM simulator_results WHERE username = ?`, user.username);
    await run(t, 'simulatorResultsByName', `DELETE FROM simulator_results WHERE username IS NULL AND lower(full_name) = ?`,
        nameKey(fullName(user)));
    await run(t, 'calsim', `DELETE FROM calsim_records WHERE username = ?`, user.username);
    await run(t, 'gcalDrafts', `DELETE FROM gcal_drafts WHERE username = ?`, user.username);
    await run(t, 'gcalReviews', `DELETE FROM gcal_reviews WHERE username = ?`, user.username);
    await run(t, 'topicAccess', `DELETE FROM trainee_topic_access WHERE trainee_username = ?`, user.username);
    await run(t, 'draftingDrafts', `DELETE FROM drafting_drafts WHERE username = ?`, user.username);
    // the practice emails sent in their name (collected above: their name, their batch), by token
    const tokens = (collected.emailPractice || []).map(r => r.token).filter(Boolean);
    for (let i = 0; i < tokens.length; i += 90) {
        const part = tokens.slice(i, i + 90);
        await run(t, 'emailPractice', `DELETE FROM email_practice WHERE token IN (${part.map(() => '?').join(', ')})`, ...part);
    }
    await run(d, 'heartbeats', `DELETE FROM heartbeats WHERE username = ?`, user.username);
    await run(d, 'pings', `DELETE FROM pings WHERE target = ?`, user.username);
    await run(d, 'activityLog', `DELETE FROM activity_log WHERE actor_username = ?`, user.username);
    await run(t, 'trainingActivityLog', `DELETE FROM activity_log WHERE actor_username = ?`, user.username);

    // The course's own record of them: their progress, and the trainer's feedback on it.
    let courseKeys = 0, courseFailed = [];
    if (env.COURSE_KV) {
        for (const entry of (collected.course || [])) {
            for (const k of entry.keys) {
                try { await env.COURSE_KV.delete(k.key); courseKeys++; }
                catch (e) { courseFailed.push(k.key); }
            }
        }
    }
    gone.courseKeys = courseKeys;
    if (courseFailed.length) gone.courseFailed = courseFailed;
    return gone;
}

// 🧹 Anything an earlier revocation left behind: the platform once kept a revoked account's activity log, and
// some of their records were not purged at all. Every username in the tombstone list (deleted_users) is cleared
// out of every table keyed by username, unless that username has an account again. Runs in the background from
// the Users list (users.js), at most every 15 minutes. Returns { usernames, removed: { table: rows } }.
const LEFTOVER_KEY = 'portal:revoked-leftovers-sweep';
const LEFTOVER_EVERY_MS = 15 * 60 * 1000;
export async function purgeRevokedLeftovers(env) {
    const d = env.DB, t = env.TRAINING_DB, removed = {};
    if (!d) return { usernames: 0, removed };
    const gone = (await rows(d, `SELECT DISTINCT username FROM deleted_users WHERE username IS NOT NULL
        AND username NOT IN (SELECT username FROM users WHERE username IS NOT NULL)`)).map(r => r.username);
    const tables = [
        [d, 'activity_log', 'actor_username'], [d, 'heartbeats', 'username'], [d, 'pings', 'target'],
        [t, 'activity_log', 'actor_username'], [t, 'submissions', 'trainee_username'], [t, 'simulator_results', 'username'],
        [t, 'calsim_records', 'username'], [t, 'gcal_drafts', 'username'], [t, 'gcal_reviews', 'username'],
        [t, 'trainee_topic_access', 'trainee_username'], [t, 'drafting_drafts', 'username']
    ];
    for (let i = 0; i < gone.length; i += 90) {
        const part = gone.slice(i, i + 90), marks = part.map(() => '?').join(', ');
        for (const [db, table, col] of tables) {
            if (!db) continue;
            const label = (db === d ? 'accounts.' : 'training.') + table;
            try {
                const r = await db.prepare(`DELETE FROM ${table} WHERE ${col} IN (${marks})`).bind(...part).run();
                removed[label] = (removed[label] || 0) + ((r && r.meta && r.meta.changes) || 0);
            } catch (e) { /* a table this deployment doesn't have yet */ }
        }
    }
    return { usernames: gone.length, removed };
}
// The background run, throttled through COURSE_KV (no KV: every call, which is still only a few deletes).
export async function autoPurgeRevoked(env, waitUntil) {
    const kv = env.COURSE_KV;
    if (kv) {
        const last = await kv.get(LEFTOVER_KEY).catch(() => null);
        if (last && Date.now() - Date.parse(last) < LEFTOVER_EVERY_MS) return;
        await kv.put(LEFTOVER_KEY, new Date().toISOString()).catch(() => {});
    }
    const run = purgeRevokedLeftovers(env).catch((e) => console.error('Revoked leftovers sweep:', e && e.message));
    if (typeof waitUntil === 'function') waitUntil(run); else await run;
}

export { fullName, PROGRAMS as PURGE_PROGRAMS };

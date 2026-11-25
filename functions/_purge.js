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
import { COURSE_PROGRAMS } from './_programs.js';
import { directMatches, matches, liveAccounts, recEnds, batchForm as ftBatchForm, both } from './_ft-block.js';

// every program in the one list (_programs.js): a program added there is wiped on a revocation too
const PROGRAMS = COURSE_PROGRAMS.map(({ id, label, prefix }) => ({ id, label, prefix }));
// The courses key their records by their own trainee id, not by the Portal's
// username, so a person is found in them by name and batch: findCourseRecords() below.
const nameKey = (s) => String(s || '').split(' · ')[0].trim().toLowerCase().replace(/\s+/g, ' ');
const fullName = (u) => [u.first_name, u.mi, u.last_name, u.suffix].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
// a batch in its one form (B103026 and B10302026 are the same batch)
const batchForm = (b) => canonicalBatch(b) || String(b || '').trim().toUpperCase();

const KV_BUDGET = 800;          // Workers KV allows 1,000 operations per request: room left for the D1 reads beside it (revoke-user.js collect)

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
    const found = await findCourseRecords(env, [{ name, first: user.first_name, last: user.last_name, batch: user.batch_id, username: user.username }], live);
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
// So a person is found by their ids read straight first, then each program's records searched by name (every form of it)
// and batch: the exact match, since a deletion can't be undone (someone of the same name in another batch is left alone).
// A record an open account could own (same first and last name, same batch) is never taken. Deleting the trainee record takes them off every sheet of that program; the rest of their keys
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
const OTHER_PREFIXES = COURSE_PROGRAMS.map(p => p.prefix).filter(Boolean);
// Is this course-KV key one of this trainee's records? (prefix: the program's; id: their course trainee id)
export function keyOfTrainee(name, prefix, id) {
    if (!id || !name.startsWith(prefix)) return false;
    if (!prefix && OTHER_PREFIXES.some(op => name.startsWith(op))) return false;   // (EA / PA's '' prefix: never another program's key)
    // (nor, under that '' prefix, a key of another app sharing the KV: Ring Channel's, the KB's, the Portal's own, ticket ledgers)
    if (!prefix && /^(rc|kb|lsh|portal|cms|ring|ringchannel|ticket|tickets|sso-used|session|sessions|sess|cache)[:]/i.test(name)) return false;
    const segs = name.slice(prefix.length).split(':');
    if (segs.length < 2 || segs[0] === 'access' || segs[0] === 'trainee-alias' || segs[0] === 'uid') return false;
    return segs[1] === id || segs[segs.length - 1] === id;
}
// Every key in the course KV, a page (up to 1,000 names) per operation: { keys, complete, ops }, or complete: false past the budget.
async function listEveryKey(kv, budget) {
    const keys = []; let cursor, ops = 0;
    try {
        do {
            if (ops >= budget) return { keys, complete: false, ops };
            ops++;
            const page = await kv.list({ prefix: '', cursor, limit: 1000 });
            page.keys.forEach(k => keys.push(k.name));
            cursor = page.list_complete ? null : page.cursor;
        } while (cursor);
    } catch (e) { return { keys, complete: false, ops }; }
    return { keys, complete: true, ops };
}
// The course trainee id a person would have in a batch, the way the courses build it (candidateIds: their first and last name
// as the Portal's ticket sends them, the batch in its one form), to find a course's alias for them. With no first and last
// name (a tombstone keeps only the full name), the full name less a middle initial and a suffix (Jr, Sr, II…).
const slugPartP = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
function courseIdOf(person, batch) {
    const name = person.first && person.last ? `${person.first} ${person.last}`
        : String(person.name || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter((w, i, a) => i === 0 || i === a.length - 1 || !/^[A-Za-z]\.?$/.test(w)).filter((w, i) => i === 0 || !/^(jr|sr|ii|iii|iv)\.?$/i.test(w)).join(' ');
    if (name.split(' ').length < 2) return '';
    const s = slugPartP(name).slice(0, 40), b0 = batch == null ? person.batch : batch, b = slugPartP(canonicalBatch(b0) || b0).slice(0, 20);
    return s ? (b ? `${s}--${b}` : s) : '';
}
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
        // (a program small enough is read whole, so a record whose id doesn't carry the name is still found; a larger one
        // only where the id carries their first and last name)
        const fresh = ids.filter(id => !hits.some(h => h.p === p && h.id === id));
        const room = Math.floor((budget * 0.7 - ops) / Math.max(1, PROGRAMS.length - PROGRAMS.indexOf(p)));
        const cand = fresh.length <= room ? fresh : fresh.filter(id => want.includes(ends(id.split('--')[0])));
        const all = [];
        for (const id of cand) {
            if (ops++ >= budget * 0.7) { skipped.push(p.label); break; }
            const rec = await kv.get(`${p.prefix}trainee:${id}`, 'json').catch(() => null);
            if (rec) all.push({ id, rec });
        }
        // deleting can't be undone, so only the exact match: every form of their name, and their batch (the looser match the
        // block list uses, any batch when no open account has the name, is for blocking, which ▶ Restore undoes)
        for (const person of people) matches(all, [person]).filter(x => !ownedByLive(x.rec)).forEach(x => hits.push({ p, person, ...x }));
    }
    // 3. each record once, with everything else the program keeps under its id. The whole course KV is listed once (a list
    //    returns up to 1,000 names for one operation), and every key of the trainee's is taken, whatever its family:
    //    <prefix><kind>:<id>, <prefix><kind>:<id>:<suffix> (a sub-keyed record: CM's actup:<id>:<activity>, backup:<id>:<time>,
    //    PD's actup, …) and <prefix><kind>:…:<id> (the id last, as the contract has it: checkin:<date>:<id>, backup:progress:<id>).
    //    A key is theirs only when one of those ':'-parts IS their id, so a trainee whose id merely starts the same
    //    (jane-doe--b1 and jane-doe--b10) is never touched, nor a key of another program when the prefix is '' (EA / PA), nor
    //    access:blocked. Also: the course's alias for them (<prefix>trainee-alias:<their id now> = id) and CM's uid:<portalUid>.
    //    When the listing doesn't fit in the request, the known families are read one by one instead (as before).
    const listed = hits.length ? await listEveryKey(kv, Math.floor(budget * 0.85) - ops) : null;
    if (listed) ops += listed.ops;
    const seenKey = new Set();
    for (const h of hits) {
        const k = `${h.p.prefix}trainee:${h.id}`;
        if (seenKey.has(k)) continue; seenKey.add(k);
        const entry = { program: h.p.id, label: h.p.label, id: h.id, person: h.person.username || h.person.name, keys: [{ key: k, value: h.rec }] };
        const extra = [];
        if (listed && listed.complete) listed.keys.forEach(name => { if (name !== k && keyOfTrainee(name, h.p.prefix, h.id)) extra.push(name); });
        else familiesFor(h.p).forEach(f => extra.push(`${h.p.prefix}${f}:${h.id}`));
        if (h.rec && typeof h.rec.portalUid === 'string' && /^[\w.@:-]{1,80}$/.test(h.rec.portalUid)) extra.push(`${h.p.prefix}uid:${h.rec.portalUid}`);
        // the course's aliases for them: the id they'd have in their batch now, in the record's batch, and in the batch it moved from
        for (const b of [h.person.batch, h.rec && h.rec.batch, h.rec && h.rec.batchFrom]) {
            const now = b ? courseIdOf(h.person, b) : '';
            if (now && now !== h.id) extra.push(`${h.p.prefix}trainee-alias:${now}`);
        }
        // (every key of theirs is read before any of it goes on the list: a request out of KV operations half-way would otherwise
        // delete the trainee record and leave its other keys behind, orphaned; the program is reported as not done instead)
        let complete = true;
        for (const key of [...new Set(extra)]) {
            if (ops++ >= budget) { skipped.push(h.p.label); complete = false; break; }
            const v = await kv.get(key).catch(() => null);
            if (v == null) continue;
            const rel = key.slice(h.p.prefix.length);
            if (rel.startsWith('trainee-alias:') && String(v).trim() !== h.id) continue;   // (an alias pointing at someone else)
            if (rel.startsWith('uid:')) { let u = v; if (typeof v === 'string') { try { u = JSON.parse(v); } catch (e) { u = null; } } if (!u || u.id !== h.id) continue; }   // (CM's {id, …}: only theirs)
            let val = v; try { val = JSON.parse(v); } catch (e) { /* kept as text */ }
            entry.keys.push({ key, value: val });
        }
        if (complete) course.push(entry);
    }
    return { course, skipped: [...new Set(skipped)] };
}

// Then nothing of it is left. Each delete is independent: one missing table must
// not stop the rest, or a revocation would leave some of it behind.
// (opts.courseKeys false: the course keys are left to the caller, a few hundred per request — revoke-user.js does it in steps)
export async function purgeUserRecords(env, user, collected, opts = {}) {
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
    if (env.COURSE_KV && opts.courseKeys !== false) {
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

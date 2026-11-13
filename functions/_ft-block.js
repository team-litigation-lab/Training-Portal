// 🚫 Keeping the Standard Foundational Training's block list in step with the Portal.
//
// The course (the Foundational-Training repo's worker.js) keeps its own trainee records in the shared
// COURSE_KV under "ft:", and a list of the trainees whose access is closed: ft:access:blocked =
// {ids: {"<trainee id>": {why, name, batch, at, ...}}, updatedAt}. Every list a trainer sees there (📋 Batch Sheet,
// 📊 Weekly Ranking, 📝 Send Feedback…) leaves a blocked trainee out (js/ft-roster.js), and a blocked trainee isn't
// signed in from a Portal ticket again. Until now only the course's own 🚫 Offboard wrote that list, so a trainee whose
// Standard Foundational Training access was revoked or suspended here (Program Access), or whose account was revoked
// before the purge could find their course record, stayed on every sheet there.
//
//   ftBlock(env, user, reason, by)  a Program Access Revoke / Suspend: their course record(s) go on the list,
//                                   marked by: 'portal' so the Portal can take them off again
//   ftUnblock(env, user)            Grant / Approve / Restore / Mark Passed: the Portal's own entries come off; an
//                                   entry the course's 🚫 Offboard made is left alone
//   ftSweep(env, db, tdb)           🧹 every revoked account (deleted_users) and every Revoked / Suspended Standard
//                                   Foundational Training access put on the list in one go: what was missed before
//
// A trainee is found in the course the way the purge finds them (_purge.js): every form of their name, accents and
// punctuation aside, and their batch in its one form; someone of the same name in another batch is left alone.
// Nothing is deleted: a block is undone by the course's ▶ Restore, or here by granting the access again.
import { canonicalBatch, logActivity } from './_utils.js';
import { COURSE_PROGRAMS } from './_programs.js';

export const FT_TOPIC = 'STANDARD TRAINING';
const PREFIX = 'ft:', BLOCK_KEY = PREFIX + 'access:blocked';
// 🚫 Every program keeps the same list now, <prefix>access:blocked, and every program's Worker leaves a trainee on it off
// every roster, Batch Sheet, ranking and scorecard it serves (its listAll), and won't sign them in from a Portal ticket.
// Program Access → Revoke / Suspend puts them on it (programBlock), Grant / Approve / Restore / Mark Passed takes them off.
// (topic key → prefix, from the one list of programs: _programs.js)
export const PROGRAM_PREFIX = Object.fromEntries(COURSE_PROGRAMS.map(p => [p.topic, p.prefix]));
export const blockKeyOf = (prefix) => prefix + 'access:blocked';
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
// a name as a set of words, accents, dots and commas aside, without a middle initial or a suffix:
// "Mark Christian D. Lucban, Jr." and "Mark Christian Lucban" read the same
export const nameCore = (s) => String(s || '').split(' · ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => w && w.length > 1 && !SUFFIXES.has(w)).join(' ');
export const batchForm = (b) => canonicalBatch(b) || String(b || '').trim().toUpperCase();
const recNames = (rec) => [rec.name, rec.fullName, [rec.firstName, rec.lastName].filter(Boolean).join(' ')].map(nameCore).filter(Boolean);
const sameBatch = (rec, batch) => !batch || ![rec.batch, rec.batchFrom].some(Boolean)
    || [rec.batch, rec.batchFrom].filter(Boolean).some(b => batchForm(b) === batchForm(batch));
const userName = (u) => u.full_name || [u.first_name, u.mi, u.last_name, u.suffix].filter(Boolean).join(' ');
// a name's first and last word only ("Mark Christian G Lucban" and "Mark Lucban" → "mark lucban"): how a revoked person is
// still found when the course keeps their name in another form (a middle name dropped or added)
const nameEnds = (s) => { const w = nameCore(s).split(' ').filter(Boolean); return w.length > 1 ? w[0] + ' ' + w[w.length - 1] : w.join(' '); };
export const recEnds = (rec) => recNames(rec).map(nameEnds).filter(Boolean);

// (prefix: the program's own, '' for EA / PA, 'cm:', 'pd:', 'md:', 'ln:': every course keys its trainees the same way)
export async function courseTrainees(kv, max = 900, prefix = PREFIX) {
    const out = [];
    let cursor, keys = [];
    do {
        const page = await kv.list({ prefix: prefix + 'trainee:', cursor, limit: 1000 });
        page.keys.forEach(k => keys.push(k.name));
        cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    for (const k of keys.slice(0, Math.max(0, max))) {   // a Worker request may make 1,000 KV calls
        const rec = await kv.get(k, 'json').catch(() => null);
        if (rec) out.push({ id: k.slice((prefix + 'trainee:').length), rec });
    }
    return out;
}
// the course records that are this person's (name + batch); people = [{name, batch}]
export const matches = (all, people) => all.filter(({ rec }) => people.some(p => {
    const n = nameCore(p.name);
    return n && recNames(rec).includes(n) && sameBatch(rec, p.batch);
}));
// 🎯 a revoked person's course records read straight by their id, with no list to search: the course names a trainee's record
// by their first and last name and their batch, slugged (worker.js candidateIds, call-results.js courseTraineeId), so the
// Portal works out the ids its forms of their name give (a middle initial or not, the first and last word only) in the
// batch's forms (B103026, and as it was typed) and reads each one. A name that matched no record before (a list cut short,
// a record whose name the course keeps in another form) is still found by its id.
const slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
export function courseIdsFor(name, batch) {
    const words = String(name || '').split(' · ')[0].replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
    const core = words.filter(w => w.length > 1 && !SUFFIXES.has(w.toLowerCase()));
    const forms = [core.join(' '), words.join(' '), core.length > 1 ? core[0] + ' ' + core[core.length - 1] : ''].filter(Boolean);
    const bs = [...new Set([slug(canonicalBatch(batch)), slug(batch)].filter(Boolean))];
    const ids = [];
    forms.forEach(f => { const n = slug(f).slice(0, 40); if (n) bs.forEach(b => ids.push(`${n}--${b.slice(0, 20)}`)); });
    return [...new Set(ids)];
}
export async function directMatches(kv, p, seen, prefix = PREFIX) {
    const out = [];
    for (const id of courseIdsFor(p.name, p.batch)) {
        if (seen.has(id)) continue; seen.add(id);
        const rec = await kv.get(prefix + 'trainee:' + id, 'json').catch(() => null);
        if (rec) out.push({ id, rec });
    }
    return out;
}
// (both ways, each record once)
export const both = (a, b) => { const m = new Map(); a.concat(b).forEach(x => { if (!m.has(x.id)) m.set(x.id, x); }); return [...m.values()]; };

// 🚫 a revoked person's course records, found the loose way too: the exact match above, or the same first and last name in
// the same batch, or (when nobody with an open Portal account has that first and last name at all) in any batch: a record
// whose batch the Portal never knew (moved, typed differently) still goes on the list. A record a live account could own
// (same first and last name, same batch) is never blocked. Blocking is undone by ▶ Restore, so the looser match is safe here;
// the purge (_purge.js), which deletes, keeps the exact one.
// live = [{e: first + last name, b: batch form}] of every open Portal account
export const revokedMatches = (all, p, live) => {
    const e = nameEnds(p.name); if (!e) return [];
    const anyBatch = !live.some(x => x.e === e);
    return all.filter(({ rec }) => {
        const exact = matches([{ rec }], [p]).length > 0;
        if (!exact && !(recEnds(rec).includes(e) && (anyBatch || sameBatch(rec, p.batch)))) return false;
        const rb = [rec.batch, rec.batchFrom].filter(Boolean).map(batchForm);
        return !live.some(x => recEnds(rec).includes(x.e) && (!x.b || !rb.length || rb.includes(x.b)));
    });
};
const LIVE = ['Approved', 'Suspended', 'Pending'];
export async function liveAccounts(db) {
    if (!db) return [];
    try {
        const r = (await db.prepare(`SELECT username, first_name, mi, last_name, suffix, batch_id, status FROM users`).all()).results || [];
        return r.filter(u => LIVE.includes(u.status)).map(u => ({ username: u.username, e: nameEnds(userName(u)), b: batchForm(u.batch_id) }));
    } catch (e) { return []; }
}
export async function readList(kv, prefix = PREFIX) {
    const v = await kv.get(blockKeyOf(prefix), 'json').catch(() => null);
    return (v && v.ids && typeof v.ids === 'object') ? v.ids : {};
}
const writeList = (kv, ids, prefix = PREFIX) => kv.put(blockKeyOf(prefix), JSON.stringify({ ids, updatedAt: new Date().toISOString() }));

// one person's records in a program, read cheaply: the program's keys listed, and only the records whose id (their name
// slugged, '--', their batch) carries their first and last name read; then the exact match (every form of the name, batch)
const slugT = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const idEnds = (id) => nameEnds(String(id).split('--')[0].replace(/-/g, ' '));
async function personRecords(kv, prefix, p) {
    const want = nameEnds(p.name);
    if (!want) return [];
    const ids = [];
    let cursor;
    do {
        const page = await kv.list({ prefix: prefix + 'trainee:', cursor, limit: 1000 });
        page.keys.forEach(k => ids.push(k.name.slice((prefix + 'trainee:').length)));
        cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    const all = [];
    for (const id of ids.filter(i => idEnds(i) === want).slice(0, 60)) {
        const rec = await kv.get(prefix + 'trainee:' + id, 'json').catch(() => null);
        if (rec) all.push({ id, rec });
    }
    return matches(all, [p]);
}
// 🚫 a program's access closed for one trainee (Program Access → Revoke / Suspend): their record(s) there go on its list
export async function programBlock(env, prefix, user, reason, by) {
    const kv = env.COURSE_KV;
    if (!kv || !user || prefix == null) return { blocked: [] };
    const found = await personRecords(kv, prefix, { name: userName(user), batch: user.batch_id });
    if (!found.length) return { blocked: [] };
    const ids = await readList(kv, prefix), at = new Date().toISOString(), blocked = [];
    found.forEach(({ id, rec }) => { if (!ids[id]) { ids[id] = { why: 'offboarded', name: rec.name || '', batch: rec.batch || '', at, by: 'portal', reason, portalUser: user.username || '', decidedBy: by || '' }; blocked.push(id); } });
    if (blocked.length) await writeList(kv, ids, prefix);
    return { blocked };
}
// ▶ and opened again (Grant / Approve / Restore / Mark Passed): the Portal's own entries for them come off; an entry the
// course made itself (its own 🚫 Offboard) is left alone
export async function programUnblock(env, prefix, user) {
    const kv = env.COURSE_KV;
    if (!kv || !user || prefix == null) return { unblocked: [] };
    const ids = await readList(kv, prefix);
    const n = nameCore(userName(user));
    const gone = Object.keys(ids).filter(id => ids[id] && ids[id].by === 'portal'
        && ((user.username && ids[id].portalUser === user.username) || (nameCore(ids[id].name) === n && sameBatch({ batch: ids[id].batch }, user.batch_id))));
    if (!gone.length) return { unblocked: [] };
    gone.forEach(id => { delete ids[id]; });
    await writeList(kv, ids, prefix);
    return { unblocked: gone };
}
// 🧹 every program but Standard Foundational Training (ftSweep has its own): each trainee whose access to it is Revoked
// (Denied) or Suspended on the Portal goes on that program's list. Run with the Foundational sweep (autoSweep, FT_SWEEP).
export async function programSweepClosed(env, db, tdb) {
    const kv = env.COURSE_KV;
    if (!kv || !tdb) return { blocked: [] };
    const rows = async (d, sql) => { try { return (await d.prepare(sql).all()).results || []; } catch (e) { return []; } };
    const keys = Object.keys(PROGRAM_PREFIX).filter(k => k !== FT_TOPIC);
    const closed = await rows(tdb, `SELECT trainee_username, topic_key, status FROM trainee_topic_access WHERE topic_key IN (${keys.map(k => `'${k}'`).join(', ')}) AND (status = 'Denied' OR status LIKE 'Suspended%')`);
    if (!closed.length) return { blocked: [] };
    const users = new Map((await rows(db, `SELECT username, first_name, mi, last_name, suffix, batch_id FROM users`)).map(u => [u.username, u]));
    const blocked = [];
    for (const c of closed.slice(0, 40)) {
        const u = users.get(c.trainee_username);
        if (!u) continue;
        const r = await programBlock(env, PROGRAM_PREFIX[c.topic_key], u, c.status === 'Denied' ? 'program access revoked' : 'program access suspended').catch(() => ({ blocked: [] }));
        r.blocked.forEach(id => blocked.push({ id, name: userName(u), batch: u.batch_id || '', program: c.topic_key }));
    }
    return { blocked };
}

export const ftBlock = (env, user, reason, by) => programBlock(env, PREFIX, user, reason, by);
// 🗑 an account revoked (Revoke & delete, revoke-user.js): every course record that is theirs goes on the block list, found
// the loose way (revokedMatches), so they leave every sheet even when the purge found nothing of theirs to delete.
// user = the deleted account (username, first_name, mi, last_name, suffix, batch_id, or full_name); db = the Portal's DB
export async function ftBlockRevoked(env, db, user, by) {
    const kv = env.COURSE_KV;
    if (!kv || !user) return { blocked: [] };
    const live = (await liveAccounts(db)).filter(x => x.username !== user.username);
    const p = { name: userName(user), batch: user.batch_id }, seen = new Set();
    const direct = (await directMatches(kv, p, seen)).filter(({ rec }) => !live.some(x => recEnds(rec).includes(x.e) && (!x.b || [rec.batch, rec.batchFrom].filter(Boolean).map(batchForm).includes(x.b))));
    const found = both(direct, revokedMatches(await courseTrainees(kv, 900 - seen.size), p, live))
        .filter(({ rec }) => !rec.purgedAt);
    if (!found.length) return { blocked: [] };
    const ids = await readList(kv), at = new Date().toISOString(), blocked = [];
    found.forEach(({ id, rec }) => { if (!ids[id]) { ids[id] = { why: 'offboarded', name: rec.name || '', batch: rec.batch || '', at, by: 'portal', reason: 'account revoked', portalUser: user.username || '', decidedBy: by || '' }; blocked.push(id); } });
    if (blocked.length) await writeList(kv, ids);
    return { blocked };
}
export const ftUnblock = (env, user) => programUnblock(env, PREFIX, user);
export async function ftSweep(env, db, tdb) {
    const kv = env.COURSE_KV;
    if (!kv) return { connected: false, blocked: [] };
    const rows = async (d, sql) => { try { return (await d.prepare(sql).all()).results || []; } catch (e) { return []; } };
    const [revoked, active, closed] = await Promise.all([
        rows(db, `SELECT username, full_name, batch_id, deleted_at FROM deleted_users WHERE user_type IS NULL OR user_type <> 'Admin'`),
        rows(db, `SELECT username, first_name, mi, last_name, suffix, batch_id, status FROM users`),
        tdb ? rows(tdb, `SELECT trainee_username, status FROM trainee_topic_access WHERE topic_key = '${FT_TOPIC}' AND (status = 'Denied' OR status LIKE 'Suspended%')`) : []
    ]);
    const byUser = new Map(active.map(u => [u.username, u]));
    // someone revoked who has an account again (same name, same batch) isn't blocked for it
    const live = active.filter(u => u.status === 'Approved' || u.status === 'Suspended' || u.status === 'Pending')
        .map(u => ({ n: nameCore(userName(u)), b: batchForm(u.batch_id) }));
    const people = [];
    revoked.forEach(r => {
        const n = nameCore(r.full_name), b = batchForm(r.batch_id);
        if (n && !byUser.has(r.username) && !live.some(x => x.n === n && (!b || !x.b || x.b === b))) people.push({ name: r.full_name, batch: r.batch_id, username: r.username, reason: 'account revoked', loose: true });
    });
    const liveEnds = active.filter(u => LIVE.includes(u.status)).map(u => ({ username: u.username, e: nameEnds(userName(u)), b: batchForm(u.batch_id) }));
    closed.forEach(c => { const u = byUser.get(c.trainee_username); if (u) people.push({ name: userName(u), batch: u.batch_id, username: u.username, reason: c.status === 'Denied' ? 'program access revoked' : 'program access suspended' }); });
    if (!people.length) return { connected: true, blocked: [] };
    // (the revoked accounts' records read straight by id first — at most 300 reads —, then the list in what is left of the
    // request's 1,000 KV calls)
    const seen = new Set(), direct = new Map();
    for (const p of people.filter(p => p.loose)) {
        if (seen.size >= 300) break;
        const got = (await directMatches(kv, p, seen)).filter(({ rec }) => !liveEnds.some(x => recEnds(rec).includes(x.e) && (!x.b || [rec.batch, rec.batchFrom].filter(Boolean).map(batchForm).includes(x.b))));
        direct.set(p, got);
    }
    const all = await courseTrainees(kv, 880 - seen.size), ids = await readList(kv), at = new Date().toISOString(), blocked = [];
    people.forEach(p => (p.loose ? both(direct.get(p) || [], revokedMatches(all, p, liveEnds)) : matches(all, [p])).forEach(({ id, rec }) => {
        if (ids[id] || rec.archived || rec.rejected || rec.purgedAt || rec.offboarded) return;
        ids[id] = { why: 'offboarded', name: rec.name || '', batch: rec.batch || '', at, by: 'portal', reason: p.reason, portalUser: p.username || '' };
        blocked.push({ id, name: rec.name || p.name, batch: rec.batch || p.batch || '', reason: p.reason });
    }));
    if (blocked.length) await writeList(kv, ids);
    return { connected: true, blocked };
}

// 🧹 the sweep, by itself: an admin opening Program Access (topics.js GET) or Admin Master Control (users.js GET) runs it in the background, at most every 15 minutes,
// so a trainee revoked here leaves Standard Foundational Training's sheets without anyone pressing 🧹 (an account revoked
// before Revoke & delete told the course, a program access revoked before this followed it). It never slows the page or
// fails it: the answer goes out first, and an error is only logged.
const SWEEP_KEY = 'portal:ftsweep:at', SWEEP_EVERY_MS = 15 * 60 * 1000;
export async function autoSweep(env, db, session, waitUntil) {
    const kv = env.COURSE_KV;
    if (!kv) return;
    const last = await kv.get(SWEEP_KEY).catch(() => null);
    if (last && Date.now() - Date.parse(last) < SWEEP_EVERY_MS) return;
    await kv.put(SWEEP_KEY, new Date().toISOString()).catch(() => {});
    const run = ftSweep(env, env.DB, db).then(async (r) => {
        if (r && r.blocked && r.blocked.length) await logActivity(db, session.username, session.batchId, 'FT_REVOKED_SWEEP', { blocked: r.blocked, auto: true });
    }).catch((e) => console.error('FT auto sweep:', e && e.message))
        .then(() => programSweepClosed(env, env.DB, db)).then(async (r) => {
            if (r && r.blocked && r.blocked.length) await logActivity(db, session.username, session.batchId, 'PROGRAM_REVOKED_SWEEP', { blocked: r.blocked, auto: true });
        }).catch((e) => console.error('Program sweep:', e && e.message));
    if (typeof waitUntil === 'function') waitUntil(run); else await run;
}

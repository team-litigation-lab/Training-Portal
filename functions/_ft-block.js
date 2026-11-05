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
import { canonicalBatch } from './_utils.js';

export const FT_TOPIC = 'STANDARD TRAINING';
const PREFIX = 'ft:', BLOCK_KEY = PREFIX + 'access:blocked';
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
// a name as a set of words, accents, dots and commas aside, without a middle initial or a suffix:
// "Mark Christian D. Lucban, Jr." and "Mark Christian Lucban" read the same
export const nameCore = (s) => String(s || '').split(' · ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => w && w.length > 1 && !SUFFIXES.has(w)).join(' ');
const batchForm = (b) => canonicalBatch(b) || String(b || '').trim().toUpperCase();
const recNames = (rec) => [rec.name, rec.fullName, [rec.firstName, rec.lastName].filter(Boolean).join(' ')].map(nameCore).filter(Boolean);
const sameBatch = (rec, batch) => !batch || ![rec.batch, rec.batchFrom].some(Boolean)
    || [rec.batch, rec.batchFrom].filter(Boolean).some(b => batchForm(b) === batchForm(batch));
const userName = (u) => u.full_name || [u.first_name, u.mi, u.last_name, u.suffix].filter(Boolean).join(' ');

async function courseTrainees(kv) {
    const out = [];
    let cursor, keys = [];
    do {
        const page = await kv.list({ prefix: PREFIX + 'trainee:', cursor, limit: 1000 });
        page.keys.forEach(k => keys.push(k.name));
        cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    for (const k of keys.slice(0, 900)) {   // a Worker request may make 1,000 KV calls
        const rec = await kv.get(k, 'json').catch(() => null);
        if (rec) out.push({ id: k.slice((PREFIX + 'trainee:').length), rec });
    }
    return out;
}
// the course records that are this person's (name + batch); people = [{name, batch}]
const matches = (all, people) => all.filter(({ rec }) => people.some(p => {
    const n = nameCore(p.name);
    return n && recNames(rec).includes(n) && sameBatch(rec, p.batch);
}));
async function readList(kv) {
    const v = await kv.get(BLOCK_KEY, 'json').catch(() => null);
    return (v && v.ids && typeof v.ids === 'object') ? v.ids : {};
}
const writeList = (kv, ids) => kv.put(BLOCK_KEY, JSON.stringify({ ids, updatedAt: new Date().toISOString() }));

export async function ftBlock(env, user, reason, by) {
    const kv = env.COURSE_KV;
    if (!kv || !user) return { blocked: [] };
    const found = matches(await courseTrainees(kv), [{ name: userName(user), batch: user.batch_id }]);
    if (!found.length) return { blocked: [] };
    const ids = await readList(kv), at = new Date().toISOString();
    found.forEach(({ id, rec }) => { if (!ids[id]) ids[id] = { why: 'offboarded', name: rec.name || '', batch: rec.batch || '', at, by: 'portal', reason, portalUser: user.username || '', decidedBy: by || '' }; });
    await writeList(kv, ids);
    return { blocked: found.map(x => x.id) };
}
export async function ftUnblock(env, user) {
    const kv = env.COURSE_KV;
    if (!kv || !user) return { unblocked: [] };
    const ids = await readList(kv);
    const portalIds = Object.keys(ids).filter(id => ids[id] && ids[id].by === 'portal');
    if (!portalIds.length) return { unblocked: [] };
    const n = nameCore(userName(user));
    const gone = portalIds.filter(id => (user.username && ids[id].portalUser === user.username)
        || (nameCore(ids[id].name) === n && sameBatch({ batch: ids[id].batch }, user.batch_id)));
    if (!gone.length) return { unblocked: [] };
    gone.forEach(id => { delete ids[id]; });
    await writeList(kv, ids);
    return { unblocked: gone };
}
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
        if (n && !byUser.has(r.username) && !live.some(x => x.n === n && (!b || !x.b || x.b === b))) people.push({ name: r.full_name, batch: r.batch_id, username: r.username, reason: 'account revoked' });
    });
    closed.forEach(c => { const u = byUser.get(c.trainee_username); if (u) people.push({ name: userName(u), batch: u.batch_id, username: u.username, reason: c.status === 'Denied' ? 'program access revoked' : 'program access suspended' }); });
    if (!people.length) return { connected: true, blocked: [] };
    const all = await courseTrainees(kv), ids = await readList(kv), at = new Date().toISOString(), blocked = [];
    people.forEach(p => matches(all, [p]).forEach(({ id, rec }) => {
        if (ids[id] || rec.archived || rec.rejected || rec.purgedAt || rec.offboarded) return;
        ids[id] = { why: 'offboarded', name: rec.name || '', batch: rec.batch || '', at, by: 'portal', reason: p.reason, portalUser: p.username || '' };
        blocked.push({ id, name: rec.name || p.name, batch: rec.batch || p.batch || '', reason: p.reason });
    }));
    if (blocked.length) await writeList(kv, ids);
    return { connected: true, blocked };
}

import { json, requireSession, logActivity } from '../_utils.js';
import { driveConfigured, saveUserRecordsToDrive } from '../_drive.js';
import { findCourseRecords, purgeRevokedLeftovers } from '../_purge.js';
import { liveAccounts } from '../_ft-block.js';

// 🧹 Wipe every revoked trainee from every program's scorecards (Users → "Wipe revoked trainees from every program").
//
// Revoking an account (revoke-user.js) now finds the person in all six programs and deletes their records there, which
// takes them off every roster, Batch Sheet, ranking and scorecard. This does the same for everyone revoked BEFORE that:
// each username in the tombstone list (deleted_users) that has no account again is looked up in every program
// (findCourseRecords in _purge.js), and whatever is still there is filed and then deleted, along with the Portal-side
// leftovers (their activity log, drafts…: purgeRevokedLeftovers).
//
// As with a revocation, nothing is deleted until a copy is safe: with Google Drive configured each person's records are
// filed to their batch's folder; without it the first call answers { needsBackup: true, people } for the trainer's
// browser to download, and the second call ({ backupSaved: true }) does the deleting. A request can read about 1,000
// course keys, so a long list may need the button pressed again: `more: true` says so.
export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const { session } = auth;
    const db = env.DB;
    let body = {};
    try { body = await request.json(); } catch (e) { /* no body: the first call */ }

    let revoked = [];
    try {
        revoked = (await db.prepare(`SELECT username, full_name, batch_id, user_type, deleted_at FROM deleted_users
            WHERE (user_type IS NULL OR user_type <> 'Admin') AND username IS NOT NULL
              AND username NOT IN (SELECT username FROM users WHERE username IS NOT NULL)`).all()).results || [];
    } catch (e) { return json({ success: false, error: 'Could not read the revoked accounts: ' + e.message }, 500); }
    const byUser = new Map();
    revoked.forEach(r => { if (r.full_name && !byUser.has(r.username)) byUser.set(r.username, r); });
    const people = [...byUser.values()].map(r => ({ name: r.full_name, batch: r.batch_id, username: r.username }));

    const live = await liveAccounts(db);
    const found = await findCourseRecords(env, people, live);
    const perPerson = new Map();
    found.course.forEach(c => { if (!perPerson.has(c.person)) perPerson.set(c.person, []); perPerson.get(c.person).push(c); });
    const list = [...perPerson.entries()].map(([username, course]) => ({ ...byUser.get(username), username, course }));

    // the copy first
    let filed = [];
    if (list.length && driveConfigured(env)) {
        for (const p of list) {
            try {
                const progs = [...new Set(p.course.map(c => c.label))];
                const link = await saveUserRecordsToDrive(env, {
                    programLabel: progs.length === 1 ? progs[0] : null, batch: p.batch_id, name: p.full_name, username: p.username,
                    records: { account: { username: p.username, full_name: p.full_name, batch_id: p.batch_id, deleted_at: p.deleted_at }, course: p.course, collectedAt: new Date().toISOString() },
                    revokedBy: session.username
                });
                filed.push({ username: p.username, link });
            } catch (e) {
                return json({ success: false, error: `${p.full_name}'s records could not be filed to the Drive, so nothing was deleted: ${e.message}` }, 502);
            }
        }
    } else if (list.length && !body.backupSaved) {
        return json({ success: true, needsBackup: true, people: list, more: found.skipped.length > 0 });
    }

    // then it goes
    let keys = 0, failed = [];
    for (const p of list) for (const c of p.course) for (const k of c.keys) {
        try { await env.COURSE_KV.delete(k.key); keys++; } catch (e) { failed.push(k.key); }
    }
    let portal = { usernames: 0, removed: {} };
    try { portal = await purgeRevokedLeftovers(env); } catch (e) { /* the course side still counts */ }

    const summary = list.map(p => ({ name: p.full_name, batch: p.batch_id || '', programs: [...new Set(p.course.map(c => c.label))] }));
    if (list.length || Object.values(portal.removed).some(n => n > 0)) {
        await logActivity(db, session.username, session.batchId, 'REVOKED_SWEEP', { people: summary, courseKeys: keys, failed, portal: portal.removed, filed });
    }
    return json({ success: true, people: summary, courseKeys: keys, failed, portal: portal.removed, more: found.skipped.length > 0, skipped: found.skipped });
}

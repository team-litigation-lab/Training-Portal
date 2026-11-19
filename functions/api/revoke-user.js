import { json, requireSession, tombstoneUser, logActivity, MASTER_USERNAME } from '../_utils.js';
import { driveConfigured, saveUserRecordsToDrive } from '../_drive.js';
import { collectUserRecords, purgeUserRecords, fullName } from '../_purge.js';
import { ftBlockRevoked } from '../_ft-block.js';

// Permanent, irreversible account revocation: tombstones the row (so the
// username/email is recognized as previously-deleted — see
// isUsernameTombstoned() in _utils.js) and then deletes it entirely. This
// is deliberately its own endpoint, separate from update-status.js —
// Approve/Reject are reversible outcomes on a still-pending row, while
// revocation is a one-way action on an existing account.
//
// Revoking takes everything with it. Their whole record — account, submitted
// activities and their grades, simulator results, calendaring work and evaluations,
// and the course's own progress and trainer feedback — is collected first, filed to
// their batch's folder on the Shared Drive, and only then deleted. Scores are not
// kept: a batch average after a revocation is the average of the people still in it.
//
// ⚙ IN STEPS, ONE JOB. A Cloudflare Function may make about 1,000 storage operations per request. Searching all six
// programs for the person's course records takes up to 800, the course-record deletes and Standard Foundational
// Training's block list each take hundreds more, so doing it all in one request ran out partway — after the account
// was already deleted, so trying again said "User not found" and their records stayed. Now each step is its own request,
// the browser (app.js revokeUser) chains them with no prompt in between, and where the job stands is kept in D1
// (revoke_jobs: strongly consistent, by the account's id), so a step that fails, a closed tab or a second click picks
// up where it stopped:
//   collect  → everything of theirs read, its course keys and email tokens kept in the job; the backup filed to the Drive
//              (or, with no Drive, the record handed to the browser, which downloads it and comes back with backupSaved)
//   account  → tombstone, the account row, and every Portal table of theirs (D1)
//   course   → their course records deleted, up to COURSE_STEP keys a request (more: true until none are left)
//   block    → Standard Foundational Training's block list (anything of theirs the search missed leaves its sheets),
//              the activity-log entry, the job closed
// Nothing is deleted until the backup is safe. Each step is safe to run twice.
//
// Permission rules:
//   - The Master Account can never be revoked, by anyone.
//   - Any Admin may revoke a Trainee or another Admin.
//   - An Admin may not revoke their own currently-logged-in account.
const COURSE_STEP = 300;
const NEXT = { collect: 'account', account: 'course', course: 'block' };

async function jobs(db) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS revoke_jobs (user_id TEXT PRIMARY KEY, username TEXT, step TEXT, data TEXT,
        updated_at TEXT DEFAULT (datetime('now')))`).run();
}
async function readJob(db, userId) {
    const r = await db.prepare(`SELECT step, data FROM revoke_jobs WHERE user_id = ?`).bind(String(userId)).first();
    return r ? Object.assign(JSON.parse(r.data || '{}'), { step: r.step }) : null;
}
async function saveJob(db, userId, step, job) {
    const data = Object.assign({}, job); delete data.step;
    await db.prepare(`INSERT INTO revoke_jobs (user_id, username, step, data, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET step = excluded.step, data = excluded.data, updated_at = excluded.updated_at`)
        .bind(String(userId), job.user.username, step, JSON.stringify(data)).run();
}
// (a step's counts added to what the earlier steps removed)
const addGone = (a, b) => { const o = Object.assign({}, a); for (const [k, v] of Object.entries(b || {})) o[k] = typeof v === 'number' && typeof o[k] === 'number' ? o[k] + v : v; return o; };

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const { session } = auth;
    const db = env.DB;

    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const { userId, backupSaved } = body;
    if (!userId) return json({ success: false, error: 'User ID is required.' }, 400);
    await jobs(db);

    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first();
    let job = await readJob(db, userId);
    if (!user && !job) return json({ success: false, error: 'User not found.' }, 404);
    const who = user || job.user;
    if (who.username === MASTER_USERNAME) return json({ success: false, error: 'The Master Account can never be revoked.' }, 403);
    if (who.username === session.username) return json({ success: false, error: 'You cannot revoke your own account.' }, 403);

    // where the job stands: a fresh revoke (or one whose backup was never made) starts by collecting; one already
    // past its backup carries on from its step, whichever step the browser asked for
    let step = job && job.step !== 'collect' ? job.step : 'collect';
    if (step === 'collect' && job && backupSaved && job.needsBackup) step = 'account';

    try {
        if (step === 'collect') {
            // 1. Everything of theirs, read while it is all still there.
            const records = await collectUserRecords(env, user);
            const name = fullName(user);
            const onePrograms = [...new Set((records.course || []).map(c => c.label))];
            job = { user, name, by: session.username, at: new Date().toISOString(),
                courseKeys: (records.course || []).flatMap(c => c.keys.map(k => k.key)),
                tokens: (records.emailPractice || []).map(r => r.token).filter(Boolean),
                courseIncomplete: records.courseIncomplete || [], gone: {} };
            // 2. The backup, before a single row goes.
            if (driveConfigured(env)) {
                try {
                    job.backup = await saveUserRecordsToDrive(env, {
                        programLabel: onePrograms.length === 1 ? onePrograms[0] : null,
                        batch: user.batch_id, name, username: user.username, records, revokedBy: session.username
                    });
                } catch (e) {
                    return json({ success: false, error: `Their records could not be filed to the Drive, so nothing was deleted: ${e.message}` }, 502);
                }
                await saveJob(db, userId, 'account', job);
                return json({ success: true, more: true, step: 'account', name });
            }
            // (the browser already holds a copy and says so: on to the deleting)
            if (backupSaved) { await saveJob(db, userId, 'account', job); return json({ success: true, more: true, step: 'account', name }); }
            // No Drive set up: the admin's browser keeps the copy, and comes back with backupSaved.
            job.needsBackup = true;
            await saveJob(db, userId, 'collect', job);
            return json({ success: true, needsBackup: true, name, username: user.username, batch: user.batch_id || null, records });
        }

        if (step === 'account') {
            // 3. The account and every Portal table of theirs (D1). (Run twice, it finds the account already gone.)
            if (user) {
                await tombstoneUser(db, user, session.username);
                await db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
            }
            const gone = await purgeUserRecords(env, job.user, { emailPractice: job.tokens.map(token => ({ token })) }, { courseKeys: false });
            job.gone = addGone(job.gone, gone);
            await saveJob(db, userId, 'course', job);
            return json({ success: true, more: true, step: 'course', left: job.courseKeys.length });
        }

        if (step === 'course') {
            // 4. Their course records, COURSE_STEP keys a request.
            const now = job.courseKeys.slice(0, COURSE_STEP), failed = [];
            let n = 0;
            if (env.COURSE_KV) for (const k of now) { try { await env.COURSE_KV.delete(k); n++; } catch (e) { failed.push(k); } }
            // (none went — the course storage unreachable: the job stays as it was, and the step is tried again; some went: the
            // ones that didn't are reported, not retried forever)
            if (now.length && failed.length === now.length) throw new Error('the course records could not be deleted right now');
            job.courseKeys = job.courseKeys.slice(now.length);
            job.gone = addGone(job.gone, { courseKeys: n });
            if (failed.length) job.gone.courseFailed = [...new Set([...(job.gone.courseFailed || []), ...failed])].slice(0, 200);
            const left = job.courseKeys.length;
            await saveJob(db, userId, left ? 'course' : 'block', job);
            return json({ success: true, more: true, step: left ? 'course' : 'block', left });
        }

        // 5. Standard Foundational Training is told: every course record of theirs the search didn't find (another form of
        // their name, another batch there) goes on its block list, so they leave every scorecard there too (_ft-block.js)
        try { const ft = await ftBlockRevoked(env, db, job.user, session.username); if (ft.blocked.length) job.gone.ftBlocked = ft.blocked; }
        catch (e) { job.gone.ftBlocked = `not told: ${e.message}`; }
        await logActivity(db, session.username, session.batchId, 'revoke-user',
            { userId, username: job.user.username, backup: job.backup || 'downloaded by the admin', removed: job.gone, courseIncomplete: job.courseIncomplete });
        await db.prepare(`DELETE FROM revoke_jobs WHERE user_id = ?`).bind(String(userId)).run();
        return json({ success: true, done: true, backup: job.backup || null, removed: job.gone, courseIncomplete: job.courseIncomplete });
    } catch (e) {
        // (where it stopped is kept: revoking again carries on from there)
        return json({ success: false, step, error: `The revoke stopped at "${step}": ${e.message}. Nothing is lost — revoke them again to carry on from there.` }, 500);
    }
}

// ⏯ The revokes that stopped partway (a failed step, a closed tab) once the account was already gone: the Users page asks
// for them when it loads and finishes each one on its own (app.js resumeRevokes). One still at its backup isn't listed:
// nothing of theirs is deleted yet, and they are still on the list to revoke again.
export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    try {
        await jobs(env.DB);
        const { results } = await env.DB.prepare(`SELECT user_id, username, step, updated_at FROM revoke_jobs WHERE step <> 'collect'`).all();
        return json({ success: true, jobs: (results || []).map(r => ({ userId: r.user_id, username: r.username, step: r.step, updatedAt: r.updated_at })) });
    } catch (e) { return json({ success: false, error: e.message }, 500); }
}

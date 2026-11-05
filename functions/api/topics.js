import { json, requireSession, logActivity, getSiteState } from '../_utils.js';
import { FT_TOPIC, ftBlock, ftUnblock, ftSweep } from '../_ft-block.js';

// Topic access: a trainee only sees "Approved" for topics an
// admin has explicitly granted them, and "Pending" for ones they've asked
// for. Deliberately admin-initiated for actual grants (GRANT), with
// REQUEST_ACCESS as a lighter-weight ask-then-wait path for the trainee,
// mirroring the same request → admin-approval shape registration already
// uses elsewhere in this app.

// Access rows are only ever made for trainings that exist.
async function topicExists(db, key) {
    return !!(await db.prepare(`SELECT 1 AS ok FROM topics WHERE key = ?`).bind(String(key)).first());
}

// 🚫 Standard Foundational Training keeps its own trainee list (_ft-block.js): revoking or suspending that program here
// puts the trainee on the course's block list, so they leave its sheets; granting or restoring it takes them off again.
// It never stops the decision itself: a course that can't be reached is said in the answer (ft.error), nothing more.
async function ftFollow(env, topicKey, traineeUsername, close, reason, by) {
    if (topicKey !== FT_TOPIC || !env.COURSE_KV) return undefined;
    try {
        const user = await env.DB.prepare(`SELECT username, first_name, mi, last_name, suffix, batch_id FROM users WHERE username = ?`).bind(traineeUsername).first();
        if (!user) return undefined;
        return close ? await ftBlock(env, user, reason, by) : await ftUnblock(env, user);
    } catch (e) { return { error: e.message }; }
}

export async function onRequestGet({ request, env }) {
    const db = env.TRAINING_DB;
    // Never cache this — topic list and access status change as admins
    // approve requests and seed data changes, and a stale cached response
    // here is exactly the kind of bug that's hard to tell apart from a
    // real data problem (as just happened while debugging this).
    const noCache = { 'Cache-Control': 'no-store' };

    const auth = await requireSession(request, env);
    if (!auth.ok) {
        // The main portal is an open directory: trainees don't sign in here,
        // each training program has its own sign-in. Anyone gets the topic
        // list (no access rows). A site-wide Lock still closes it.
        const state = await getSiteState(env.DB);
        if (state.locked) return json({ success: false, error: 'This page has been locked by an administrator.', code: 'SITE_LOCKED' }, 423, noCache);
        try {
            const { results: topics } = await db.prepare(
                `SELECT key, name, sort_order FROM topics ORDER BY sort_order ASC, name ASC`
            ).all();
            return json({ success: true, public: true, topics: topics || [], access: [] }, 200, noCache);
        } catch (err) {
            return json({ success: false, error: err.message }, 500, noCache);
        }
    }

    try {
        const { results: topics } = await db.prepare(
            `SELECT key, name, sort_order FROM topics ORDER BY sort_order ASC, name ASC`
        ).all();

        if (auth.session.userType === 'Admin') {
            // Admins get every trainee's access row per topic, so Master
            // Control can render an approval queue.
            const { results: access } = await db.prepare(
                `SELECT trainee_username, topic_key, status, requested_at, decided_at, decided_by FROM trainee_topic_access`
            ).all();
            return json({ success: true, topics: topics || [], access: access || [] }, 200, noCache);
        }

        // Trainee: just their own access rows.
        const { results: myAccess } = await db.prepare(
            `SELECT topic_key, status FROM trainee_topic_access WHERE trainee_username = ?`
        ).bind(auth.session.username).all();
        return json({ success: true, topics: topics || [], access: myAccess || [] }, 200, noCache);
    } catch (err) {
        return json({ success: false, error: err.message }, 500, noCache);
    }
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;
    const db = env.TRAINING_DB;

    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const { action, topicKey } = body;

    try {
        if (action === 'REQUEST_ACCESS') {
            if (auth.session.userType !== 'Trainee') return json({ success: false, error: 'Only trainees can request topic access.' }, 403);
            if (!topicKey) return json({ success: false, error: 'topicKey is required.' }, 400);
            if (!(await topicExists(db, topicKey))) return json({ success: false, error: 'Unknown training.' }, 404);

            await db.prepare(
                `INSERT INTO trainee_topic_access (trainee_username, topic_key, status, requested_at)
                 VALUES (?, ?, 'Pending', datetime('now'))
                 ON CONFLICT(trainee_username, topic_key) DO UPDATE SET
                    status = CASE WHEN trainee_topic_access.status = 'Denied' THEN 'Pending' ELSE trainee_topic_access.status END,
                    requested_at = datetime('now')`
            ).bind(auth.session.username, topicKey).run();
            await logActivity(db, auth.session.username, auth.session.batchId, 'TOPIC_ACCESS_REQUESTED', { topicKey });
            return json({ success: true });
        }

        if (action === 'GRANT' || action === 'APPROVE' || action === 'DENY') {
            if (auth.session.userType !== 'Admin') return json({ success: false, error: 'Only admins can grant or decide topic access.' }, 403);
            const { traineeUsername } = body;
            if (!topicKey || !traineeUsername) return json({ success: false, error: 'topicKey and traineeUsername are required.' }, 400);
            if (!(await topicExists(db, topicKey))) return json({ success: false, error: 'Unknown training.' }, 404);
            if (!(await env.DB.prepare(`SELECT 1 AS ok FROM users WHERE username = ?`).bind(traineeUsername).first())) return json({ success: false, error: 'That trainee has no account.' }, 404);

            const status = action === 'DENY' ? 'Denied' : 'Approved';
            await db.prepare(
                `INSERT INTO trainee_topic_access (trainee_username, topic_key, status, requested_at, decided_at, decided_by)
                 VALUES (?, ?, ?, datetime('now'), datetime('now'), ?)
                 ON CONFLICT(trainee_username, topic_key) DO UPDATE SET
                    status = excluded.status, decided_at = excluded.decided_at, decided_by = excluded.decided_by`
            ).bind(traineeUsername, topicKey, status, auth.session.username).run();
            await logActivity(db, auth.session.username, auth.session.batchId, 'TOPIC_ACCESS_' + status.toUpperCase(), { topicKey, traineeUsername });
            const ft = await ftFollow(env, topicKey, traineeUsername, action === 'DENY', 'program access revoked', auth.session.username);
            return json({ success: true, ft });
        }

        // ⏸ Suspend / ▶ Restore: a pause on one trainee's access to one program, short of Revoke. A suspended program can't be
        // opened (launch.js lets only Approved / Passed through) and the trainee can't re-request it; Restore puts back what
        // they had. The row remembers which: 'Suspended' was Approved, 'Suspended-Passed' was Passed (finished), so a
        // trainee who had completed a program is still Completed once restored.
        if (action === 'SUSPEND' || action === 'RESTORE') {
            if (auth.session.userType !== 'Admin') return json({ success: false, error: 'Only admins can suspend or restore program access.' }, 403);
            const { traineeUsername } = body;
            if (!topicKey || !traineeUsername) return json({ success: false, error: 'topicKey and traineeUsername are required.' }, 400);
            const row = await db.prepare(`SELECT status FROM trainee_topic_access WHERE trainee_username = ? AND topic_key = ?`).bind(traineeUsername, topicKey).first();
            const cur = row ? String(row.status) : '';
            let next;
            if (action === 'SUSPEND') {
                if (cur !== 'Approved' && cur !== 'Passed') return json({ success: false, error: 'Only open access (Approved or Passed) can be suspended.' }, 409);
                next = cur === 'Passed' ? 'Suspended-Passed' : 'Suspended';
            } else {
                if (cur !== 'Suspended' && cur !== 'Suspended-Passed') return json({ success: false, error: 'That access isn\'t suspended.' }, 409);
                next = cur === 'Suspended-Passed' ? 'Passed' : 'Approved';
            }
            await db.prepare(
                `UPDATE trainee_topic_access SET status = ?, decided_at = datetime('now'), decided_by = ? WHERE trainee_username = ? AND topic_key = ?`
            ).bind(next, auth.session.username, traineeUsername, topicKey).run();
            await logActivity(db, auth.session.username, auth.session.batchId, action === 'SUSPEND' ? 'TOPIC_ACCESS_SUSPENDED' : 'TOPIC_ACCESS_RESTORED', { topicKey, traineeUsername });
            const ft = await ftFollow(env, topicKey, traineeUsername, action === 'SUSPEND', 'program access suspended', auth.session.username);
            return json({ success: true, status: next, ft });
        }

        // 🧹 A request left by an account that no longer exists (revoked, or a registration rejected) can't be approved or
        // denied (both need the account), so it would sit in the queue for ever: an admin clears it.
        if (action === 'CLEAR') {
            if (auth.session.userType !== 'Admin') return json({ success: false, error: 'Only admins can clear a request.' }, 403);
            const { traineeUsername } = body;
            if (!topicKey || !traineeUsername) return json({ success: false, error: 'topicKey and traineeUsername are required.' }, 400);
            await db.prepare(`DELETE FROM trainee_topic_access WHERE trainee_username = ? AND topic_key = ? AND status = 'Pending'`).bind(traineeUsername, topicKey).run();
            await logActivity(db, auth.session.username, auth.session.batchId, 'TOPIC_ACCESS_CLEARED', { topicKey, traineeUsername });
            return json({ success: true });
        }

        if (action === 'MARK_PASSED') {
            if (auth.session.userType !== 'Admin') return json({ success: false, error: 'Only admins can mark a training as passed.' }, 403);
            const { traineeUsername } = body;
            if (!topicKey || !traineeUsername) return json({ success: false, error: 'topicKey and traineeUsername are required.' }, 400);
            if (!(await topicExists(db, topicKey))) return json({ success: false, error: 'Unknown training.' }, 404);
            if (!(await env.DB.prepare(`SELECT 1 AS ok FROM users WHERE username = ?`).bind(traineeUsername).first())) return json({ success: false, error: 'That trainee has no account.' }, 404);

            await db.prepare(
                `INSERT INTO trainee_topic_access (trainee_username, topic_key, status, requested_at, decided_at, decided_by)
                 VALUES (?, ?, 'Passed', datetime('now'), datetime('now'), ?)
                 ON CONFLICT(trainee_username, topic_key) DO UPDATE SET
                    status = 'Passed', decided_at = datetime('now'), decided_by = excluded.decided_by`
            ).bind(traineeUsername, topicKey, auth.session.username).run();

            // There is no required order any more, so passing one program doesn't open another:
            // a trainee requests whichever program they want next and an admin approves it.
            const unlockedNext = null;

            await logActivity(db, auth.session.username, auth.session.batchId, 'TOPIC_MARKED_PASSED', { topicKey, traineeUsername, unlockedNext });
            const ft = await ftFollow(env, topicKey, traineeUsername, false);
            return json({ success: true, unlockedNext, ft });
        }

        // 🧹 Standard Foundational Training: every trainee revoked here before the course was told (an account revoked
        // while the purge couldn't find their course record, a program access revoked or suspended before this followed
        // it) goes on the course's block list now, so they leave its sheets. Nothing is deleted.
        if (action === 'FT_SWEEP') {
            if (auth.session.userType !== 'Admin') return json({ success: false, error: 'Only admins can do this.' }, 403);
            if (!env.COURSE_KV) return json({ success: false, error: 'Course data isn’t connected (COURSE_KV).' }, 500);
            const r = await ftSweep(env, env.DB, db);
            await logActivity(db, auth.session.username, auth.session.batchId, 'FT_REVOKED_SWEEP', { blocked: r.blocked });
            return json({ success: true, blocked: r.blocked });
        }

        return json({ success: false, error: 'Unknown action.' }, 400);
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

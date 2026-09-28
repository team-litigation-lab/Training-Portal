import { json, requireSession, logActivity } from '../_utils.js';

// Topic-gated progression: a trainee only sees "Approved" for topics an
// admin has explicitly granted them, and "Pending" for ones they've asked
// for. Deliberately admin-initiated for actual grants (GRANT), with
// REQUEST_ACCESS as a lighter-weight ask-then-wait path for the trainee,
// mirroring the same request → admin-approval shape registration already
// uses elsewhere in this app.
//
// TOPIC_SEQUENCE is the fixed order VAs progress through — Standard,
// Litigation, Medsum and Demand, CM Training, then LSH EA PA Training,
// with everything else ("specialized training") after that. Handouts,
// Training Tools and Resources, and Other Resources are deliberately left
// out of the sequence entirely — they're reference material, not a
// training someone "passes", so they stay always-requestable rather than
// gated behind progression. This same array must match the one in
// programs.html — there's no shared module between a Function and a
// static page, so it's intentionally duplicated in both places.
const TOPIC_SEQUENCE = [
    'STANDARD TRAINING',
    'LITIGATION',
    'MEDSUM AND DEMAND',
    'CM TRAINING',
    'EA  PA TRAINING-OUTSOURCED MANP',
    'REVISED EA PA TRAINING',
    'REVISED CM TRAINING',
    'BUSINESS LAW',
    'ESTATE PLANNING',
    'FAMILY LAW',
    'HEALTH SUBRO',
    'IMMIGRATION LAW',
    'INTELLECTUAL PROPERTY LAW',
    'LIEN VERIFICATION',
    'MASS TORT',
    'PROPERTY DAMAGE',
    'REAL ESTATE LAW'
];

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;
    const db = env.TRAINING_DB;
    // Never cache this — topic list and access status change as admins
    // approve requests and seed data changes, and a stale cached response
    // here is exactly the kind of bug that's hard to tell apart from a
    // real data problem (as just happened while debugging this).
    const noCache = { 'Cache-Control': 'no-store' };

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

            const status = action === 'DENY' ? 'Denied' : 'Approved';
            await db.prepare(
                `INSERT INTO trainee_topic_access (trainee_username, topic_key, status, requested_at, decided_at, decided_by)
                 VALUES (?, ?, ?, datetime('now'), datetime('now'), ?)
                 ON CONFLICT(trainee_username, topic_key) DO UPDATE SET
                    status = excluded.status, decided_at = excluded.decided_at, decided_by = excluded.decided_by`
            ).bind(traineeUsername, topicKey, status, auth.session.username).run();
            await logActivity(db, auth.session.username, auth.session.batchId, 'TOPIC_ACCESS_' + status.toUpperCase(), { topicKey, traineeUsername });
            return json({ success: true });
        }

        if (action === 'MARK_PASSED') {
            if (auth.session.userType !== 'Admin') return json({ success: false, error: 'Only admins can mark a training as passed.' }, 403);
            const { traineeUsername } = body;
            if (!topicKey || !traineeUsername) return json({ success: false, error: 'topicKey and traineeUsername are required.' }, 400);

            await db.prepare(
                `INSERT INTO trainee_topic_access (trainee_username, topic_key, status, requested_at, decided_at, decided_by)
                 VALUES (?, ?, 'Passed', datetime('now'), datetime('now'), ?)
                 ON CONFLICT(trainee_username, topic_key) DO UPDATE SET
                    status = 'Passed', decided_at = datetime('now'), decided_by = excluded.decided_by`
            ).bind(traineeUsername, topicKey, auth.session.username).run();

            // Auto-unlock the next topic in the fixed progression, if there
            // is one — this is what "the next training won't unlock unless
            // they passed the last one" actually means in practice: passing
            // IS the approval for what comes next, no separate request
            // needed from the trainee.
            const idx = TOPIC_SEQUENCE.indexOf(topicKey);
            let unlockedNext = null;
            if (idx !== -1 && idx + 1 < TOPIC_SEQUENCE.length) {
                unlockedNext = TOPIC_SEQUENCE[idx + 1];
                await db.prepare(
                    `INSERT INTO trainee_topic_access (trainee_username, topic_key, status, requested_at, decided_at, decided_by)
                     VALUES (?, ?, 'Approved', datetime('now'), datetime('now'), ?)
                     ON CONFLICT(trainee_username, topic_key) DO UPDATE SET
                        status = CASE WHEN trainee_topic_access.status = 'Passed' THEN trainee_topic_access.status ELSE 'Approved' END,
                        decided_at = datetime('now'), decided_by = excluded.decided_by`
                ).bind(traineeUsername, unlockedNext, auth.session.username).run();
            }

            await logActivity(db, auth.session.username, auth.session.batchId, 'TOPIC_MARKED_PASSED', { topicKey, traineeUsername, unlockedNext });
            return json({ success: true, unlockedNext });
        }

        return json({ success: false, error: 'Unknown action.' }, 400);
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

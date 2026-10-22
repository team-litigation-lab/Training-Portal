import { json, requireSession, tombstoneUser, logActivity, isMaster, MASTER_USERNAME } from '../_utils.js';
import { driveConfigured, saveUserRecordsToDrive } from '../_drive.js';
import { collectUserRecords, purgeUserRecords, fullName } from '../_purge.js';

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
// Nothing is deleted until the backup is safe. With Google Drive configured the
// Function files it itself; without it, the first call answers { needsBackup: true }
// with the whole record, the admin's browser downloads it, and the second call
// (backupSaved: true) does the deleting. The activity log and the username
// tombstone stay: the audit trail of the revocation, and what stops the username
// being used again, are not the person's work.
//
// Permission rules:
//   - The Master Account can never be revoked, by anyone.
//   - Only the Master Account may revoke another Admin.
//   - Any Admin may revoke a Trainee.
//   - An Admin may not revoke their own currently-logged-in account.
export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const { session } = auth;
    const db = env.DB;

    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const { userId, backupSaved } = body;
    if (!userId) return json({ success: false, error: 'User ID is required.' }, 400);

    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first();
    if (!user) return json({ success: false, error: 'User not found.' }, 404);

    if (user.username === MASTER_USERNAME) {
        return json({ success: false, error: 'The Master Account can never be revoked.' }, 403);
    }
    if (user.user_type === 'Admin' && !isMaster(session)) {
        return json({ success: false, error: 'Only the Master Account can revoke an Admin.' }, 403);
    }
    if (user.username === session.username) {
        return json({ success: false, error: 'You cannot revoke your own account.' }, 403);
    }

    // 1. Everything of theirs, read while it is all still there.
    const records = await collectUserRecords(env, user);
    const name = fullName(user);
    const onePrograms = [...new Set((records.course || []).map(c => c.label))];

    // 2. The backup, before a single row goes.
    let backup = null;
    if (driveConfigured(env)) {
        try {
            backup = await saveUserRecordsToDrive(env, {
                programLabel: onePrograms.length === 1 ? onePrograms[0] : null,
                batch: user.batch_id, name, username: user.username, records, revokedBy: session.username
            });
        } catch (e) {
            return json({ success: false, error: `Their records could not be filed to the Drive, so nothing was deleted: ${e.message}` }, 502);
        }
    } else if (!backupSaved) {
        // No Drive set up: the admin's browser keeps the copy, and asks again.
        return json({ success: true, needsBackup: true, name, username: user.username, batch: user.batch_id || null, records });
    }

    // 3. Now it goes.
    await tombstoneUser(db, user, session.username);
    await db.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
    const gone = await purgeUserRecords(env, user, records);
    await logActivity(db, session.username, session.batchId, 'revoke-user',
        { userId, username: user.username, backup: backup || 'downloaded by the admin', removed: gone, courseIncomplete: records.courseIncomplete });

    return json({ success: true, backup, removed: gone, courseIncomplete: records.courseIncomplete });
}

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
// What is NOT deleted, deliberately: the activity log. It is the platform's audit
// trail — who did what, including this revocation — not the person's own work, and
// erasing it would erase the record that the revocation happened. The tombstone
// (deleted_users) stays too: it is what stops the username being taken again.

const PROGRAMS = [
    { id: 'ft', label: 'Standard Foundational Training', prefix: 'ft:' },
    { id: 'eapa', label: 'EA / PA Training', prefix: '' },
    { id: 'cm', label: 'Case Management Training', prefix: 'cm:' },
    { id: 'pd', label: 'PD Claims Training', prefix: 'pd:' },
    { id: 'md', label: 'Medsum & Demand Training', prefix: 'md:' }
];
// The courses key their records by their own trainee id, not by the Portal's
// username, so a person is found in them by name (the same match /progress.html
// uses) and, when the course record carries one, their batch.
const nameKey = (s) => String(s || '').split(' · ')[0].trim().toLowerCase().replace(/\s+/g, ' ');
const fullName = (u) => [u.first_name, u.mi, u.last_name, u.suffix].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

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
    const [submissions, simulatorResults, calsim, gcalDrafts, gcalReviews, topicAccess] = await Promise.all([
        rows(t, `SELECT * FROM submissions WHERE trainee_username = ?`, user.username),
        rows(t, `SELECT * FROM simulator_results WHERE username = ?`, user.username),
        rows(t, `SELECT * FROM calsim_records WHERE username = ?`, user.username),
        rows(t, `SELECT * FROM gcal_drafts WHERE username = ?`, user.username),
        rows(t, `SELECT * FROM gcal_reviews WHERE username = ?`, user.username),
        rows(t, `SELECT * FROM trainee_topic_access WHERE trainee_username = ?`, user.username)
    ]);
    // A simulator result can also be filed under the name a trainee typed in
    // ("who's practicing"), with no username on it — those are theirs as well.
    const byName = await rows(t, `SELECT * FROM simulator_results WHERE username IS NULL AND lower(full_name) = ?`, key);

    const course = [];
    let ops = 0, skipped = [];
    const kv = env.COURSE_KV;
    if (kv) {
        for (const p of PROGRAMS) {
            if (ops >= KV_BUDGET) { skipped.push(p.label); continue; }
            let cursor, ids = [];
            do {
                if (ops++ >= KV_BUDGET) { skipped.push(p.label); break; }
                const page = await kv.list({ prefix: `${p.prefix}trainee:`, cursor, limit: 1000 });
                page.keys.forEach(k => ids.push(k.name));
                cursor = page.list_complete ? null : page.cursor;
            } while (cursor);
            for (const k of ids) {
                if (ops++ >= KV_BUDGET) { skipped.push(p.label); break; }
                const rec = await kv.get(k, 'json').catch(() => null);
                if (!rec || nameKey(rec.name || [rec.firstName, rec.lastName].filter(Boolean).join(' ')) !== key) continue;
                if (user.batch_id && rec.batch && String(rec.batch) !== String(user.batch_id)) continue;
                const id = k.slice(`${p.prefix}trainee:`.length);
                const entry = { program: p.id, label: p.label, keys: [{ key: k, value: rec }] };
                const fb = await kv.get(`${p.prefix}feedback:${id}`, 'json').catch(() => null);
                ops++;
                if (fb) entry.keys.push({ key: `${p.prefix}feedback:${id}`, value: fb });
                course.push(entry);
            }
        }
    }
    return {
        account: user,
        submissions, simulatorResults: simulatorResults.concat(byName), calsim, gcalDrafts, gcalReviews, topicAccess,
        course,
        courseIncomplete: [...new Set(skipped)],
        collectedAt: new Date().toISOString()
    };
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
    await run(d, 'heartbeats', `DELETE FROM heartbeats WHERE username = ?`, user.username);

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

export { fullName, PROGRAMS as PURGE_PROGRAMS };

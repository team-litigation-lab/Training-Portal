import { json, requireSession, hashPassword, isUsernameTombstoned, logActivity, isMaster, MASTER_USERNAME, buildFullName } from '../_utils.js';

// POST /api/update-user { userId, batchId?, username?, email?, firstName?, lastName?, password? }  (admins only)
//
// Lets an admin correct an account: its Batch ID, its name and email, its username and a new password. Only the fields sent are changed.
//   - Only the Master Account may edit an Admin; nobody edits the Master Account here (its credentials are the admin password secret).
//   - A new username moves the trainee's program access, submissions/grades and simulator results with it (they are keyed by username).
//   - A new username or password ends the account's open sessions, so the next sign-in uses the new one.
//   - A new Batch ID is what the programs are told at launch: a program that already knows this trainee under the old Batch ID
//     will see them as a new trainee under the new one. The admin screen warns about it before saving.
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{8,}$/;
const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const BATCH_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/;
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'\-]{0,59}$/u;

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true, master: true });
    if (!auth.ok) return auth.response;
    const { session } = auth;
    const db = env.DB;
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(body.userId).first();
    if (!user) return json({ success: false, error: 'User not found.' }, 404);
    if (user.username === MASTER_USERNAME) return json({ success: false, error: 'The Master Account\'s credentials are set with the admin password secret, not here.' }, 403);
    if (user.user_type === 'Admin' && !isMaster(session)) return json({ success: false, error: 'Only the Master Account can edit an Admin.' }, 403);

    const set = {}; const changed = [];
    if (body.batchId !== undefined) {
        const b = String(body.batchId || '').trim().toUpperCase();
        if (!BATCH_RE.test(b)) return json({ success: false, error: 'Batch ID: up to 40 letters, numbers, spaces, dashes or underscores.' }, 400);
        if (b !== user.batch_id) { set.batch_id = b; changed.push('batch'); }
    }
    if (body.email !== undefined) {
        const e = String(body.email || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return json({ success: false, error: 'Please enter a valid email address.' }, 400);
        if (e !== user.email) { set.email = e; changed.push('email'); }
    }
    for (const [field, col, label] of [['firstName', 'first_name', 'First name'], ['lastName', 'last_name', 'Last name']]) {
        if (body[field] === undefined) continue;
        const v = String(body[field] || '').trim().replace(/\s+/g, ' ');
        if (!NAME_RE.test(v)) return json({ success: false, error: `${label}: letters, spaces, hyphens, apostrophes or periods.` }, 400);
        if (v !== user[col]) { set[col] = v; changed.push(label.toLowerCase()); }
    }
    let usernameChanged = false;
    if (body.username !== undefined) {
        const u = String(body.username || '').trim();
        if (!USERNAME_RE.test(u)) return json({ success: false, error: 'Username: 3 to 30 letters, numbers or underscores.' }, 400);
        if (u !== user.username) {
            if (u === MASTER_USERNAME) return json({ success: false, error: 'That username is reserved.' }, 409);
            if (await db.prepare(`SELECT id FROM users WHERE username = ?`).bind(u).first()) return json({ success: false, error: 'That username is already taken.' }, 409);
            if (await isUsernameTombstoned(db, u)) return json({ success: false, error: 'That username has been permanently retired and cannot be used again.' }, 409);
            set.username = u; usernameChanged = true; changed.push('username');
        }
    }
    let passwordChanged = false;
    if (body.password !== undefined && body.password !== '') {
        if (!PASSWORD_RE.test(String(body.password))) return json({ success: false, error: 'Password must be at least 8 characters, letters and numbers only (at least one of each).' }, 400);
        set.password = await hashPassword(String(body.password)); passwordChanged = true; changed.push('password');
    }
    if (!changed.length) return json({ success: true, changed: [] });

    const cols = Object.keys(set);
    await db.prepare(`UPDATE users SET ${cols.map(c => c + ' = ?').join(', ')} WHERE id = ?`).bind(...cols.map(c => set[c]), user.id).run();

    if (usernameChanged) {
        // everything keyed by username moves with it; a table that isn't there is skipped
        const move = [['trainee_topic_access', 'trainee_username'], ['submissions', 'trainee_username'], ['simulator_results', 'username']];
        for (const [table, col] of move) {
            try { await env.TRAINING_DB.prepare(`UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`).bind(set.username, user.username).run(); } catch (e) { /* table not in this database */ }
        }
    }
    if (usernameChanged || passwordChanged) {
        try { await db.prepare(`DELETE FROM heartbeats WHERE username = ?`).bind(user.username).run(); } catch (e) { /* none */ }
    }
    const fresh = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(user.id).first();
    await logActivity(db, session.username, session.batchId, 'update-user', { userId: user.id, username: fresh.username, changed });
    return json({ success: true, changed, user: { id: fresh.id, username: fresh.username, email: fresh.email, batchId: fresh.batch_id, fullName: buildFullName(fresh) } });
}

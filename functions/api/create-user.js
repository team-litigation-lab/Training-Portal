import { json, requireSession, hashPassword, isUsernameTombstoned, logActivity, MASTER_USERNAME, buildFullName } from '../_utils.js';

// POST /api/create-user { firstName, mi?, lastName?, suffix?, email, userType, username, password, trainingStartDate? }
//
// Lets a signed-in trainer make an account for someone instead of sending them to the
// registration page. The team is four trainers who each need their own sign-in rather than
// sharing the Master Account, and a trainer who is already onboarding a batch should not have
// to walk each person through registering themselves.
//
// The account is made exactly as a self-registration is: status 'Pending', no Batch ID. It
// lands in Master Control -> Registrations and an administrator approves it there, which is
// what issues the Batch ID (api/update-status.js). So nothing here grants access on its own:
// a trainer sets the account up, an approval turns it on.
//
// Validation is deliberately the same as the two places that already write these fields —
// api/register.js (registration) and api/update-user.js (editing) — so an account made here
// cannot hold a value those would have refused. Keep the three in step.
const PASSWORD_RE = /^[\s\S]{8,128}$/;          // 8+ characters, any of them (as at registration)
const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;     // as in update-user.js
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'\-]{0,59}$/u;
const SHORT_RE = /^[\p{L}][\p{L}\p{M} .'\-]{0,19}$/u;   // middle initial, suffix

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const { session } = auth;
    const db = env.DB;

    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }

    const userType = String(body.userType || '').trim();
    if (!['Admin', 'Trainee'].includes(userType)) {
        return json({ success: false, error: 'Account type must be Admin / Trainer or Trainee.' }, 400);
    }

    // Names: first and last are required, the middle initial and suffix are not.
    const names = {};
    for (const [field, col, label, re, required] of [
        ['firstName', 'first_name', 'First name', NAME_RE, true],
        ['lastName', 'last_name', 'Last name', NAME_RE, true],
        ['mi', 'mi', 'Middle initial', SHORT_RE, false],
        ['suffix', 'suffix', 'Suffix', SHORT_RE, false]
    ]) {
        const v = String(body[field] || '').trim().replace(/\s+/g, ' ');
        if (!v) {
            if (required) return json({ success: false, error: `${label} is required.` }, 400);
            names[col] = null;
            continue;
        }
        if (!re.test(v)) return json({ success: false, error: `${label}: letters, spaces, hyphens, apostrophes or periods.` }, 400);
        names[col] = v;
    }

    const email = String(body.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return json({ success: false, error: 'Please enter a valid email address.' }, 400);
    }

    const username = String(body.username || '').trim();
    if (!USERNAME_RE.test(username)) {
        return json({ success: false, error: 'Username: 3 to 30 letters, numbers or underscores.' }, 400);
    }

    const password = String(body.password || '');
    if (!PASSWORD_RE.test(password)) {
        return json({ success: false, error: 'Password must be at least 8 characters long (up to 128). Any characters are fine.' }, 400);
    }

    // A trainee's start of training is what dates their batch when the registration is approved.
    let trainingStartDate = null;
    if (userType === 'Trainee') {
        const d = String(body.trainingStartDate || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(new Date(d).getTime())) {
            return json({ success: false, error: 'Please enter a valid start of training date.' }, 400);
        }
        trainingStartDate = d;
    }

    // The Master Account has no users row, so the uniqueness check below would let its name through.
    if (username.toLowerCase() === MASTER_USERNAME.toLowerCase()) {
        return json({ success: false, error: 'That username is reserved.' }, 409);
    }
    if (await db.prepare(`SELECT id FROM users WHERE username = ?`).bind(username).first()) {
        return json({ success: false, error: 'That username is already taken.' }, 409);
    }
    if (await isUsernameTombstoned(db, username)) {
        return json({ success: false, error: 'That username has been permanently retired and cannot be used again.' }, 409);
    }

    const hashedPassword = await hashPassword(password);

    await db.prepare(
        `INSERT INTO users (
            first_name, mi, last_name, suffix,
            email, user_type, batch_id, username, password, status, training_start_date
         )
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 'Pending', ?)`
    ).bind(
        names.first_name, names.mi, names.last_name, names.suffix,
        email, userType, username, hashedPassword, trainingStartDate
    ).run();

    const fresh = await db.prepare(`SELECT * FROM users WHERE username = ?`).bind(username).first();
    await logActivity(db, session.username, session.batchId, 'create-user', { userId: fresh.id, username, userType, createdBy: session.username });

    return json({
        success: true,
        user: { id: fresh.id, username: fresh.username, userType, fullName: buildFullName(fresh), status: 'Pending' }
    });
}

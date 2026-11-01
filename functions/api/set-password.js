import { json, logActivity, hashPassword, verifyPassword, needsNewPassword, loginBlocked, loginFailed, MASTER_USERNAME } from '../_utils.js';

// POST /api/set-password: choosing a password without an administrator, for an account that is already approved.
// The account stays Approved: nothing here sends it back to Master Control -> Registrations.
//
//   { mode: 'first', username, portalMode, newPassword }
//       An account made without a password (the trainers' accounts hold SET_PASSWORD_MARK) chooses its first one.
//       Only while it has none: once set, this does nothing for that account.
//   { mode: 'forgot', username, email, newPassword }
//       Forgot password: the username and the email the account registered with, then a new password.
//       Accounts with no email on file (the trainers') can't use it: the Master Account resets those in Master Control.
//
// Wrong answers count against the same throttle as wrong passwords at sign-in (10 in 10 minutes per username and
// connection). A new password ends the account's open sessions. The sign-in page then signs in with it.
const PASSWORD_RE = /^[\s\S]{8,128}$/;   // as at registration (api/register.js)

export async function onRequestPost({ request, env }) {
    const db = env.DB;
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }

    const mode = body.mode;
    const username = String(body.username || '').trim();
    const newPassword = String(body.newPassword || '');
    if (mode !== 'first' && mode !== 'forgot') return json({ success: false, error: 'Invalid request.' }, 400);
    if (!username) return json({ success: false, error: 'Please enter your username.' }, 400);
    if (!PASSWORD_RE.test(newPassword)) return json({ success: false, error: 'Password must be at least 8 characters long (up to 128). Any characters are fine.' }, 400);
    if (username.toLowerCase() === MASTER_USERNAME.toLowerCase()) {
        return json({ success: false, error: "The Master Account's password is set in Cloudflare, not here." }, 403);
    }
    if (await loginBlocked(db, request, username)) {
        return json({ success: false, error: 'Too many tries. Wait 10 minutes and try again, or ask your trainer.', code: 'TOO_MANY_TRIES' }, 429);
    }

    const user = await db.prepare(`SELECT * FROM users WHERE username = ?`).bind(username).first();

    if (mode === 'first') {
        const want = body.portalMode === 'Admin' ? 'Admin' : 'Trainee';
        if (!user || !needsNewPassword(user.password) || (user.user_type || 'Trainee') !== want || user.status !== 'Approved') {
            await loginFailed(db, request, username);
            return json({ success: false, error: 'This account already has a password. Log in with it, or use Forgot password.' }, 409);
        }
    } else {
        const email = String(body.email || '').trim().toLowerCase();
        if (!email) return json({ success: false, error: 'Please enter the email you registered with.' }, 400);
        const onFile = String((user && user.email) || '').trim().toLowerCase();
        if (!user || !onFile || onFile !== email) {
            await loginFailed(db, request, username);
            return json({ success: false, error: "That username and email don't match an account. Check both, or ask your trainer to reset your password." }, 401);
        }
        if (user.status === 'Pending') return json({ success: false, error: 'Your registration is still pending admin approval.' }, 403);
        if (user.status !== 'Approved') return json({ success: false, error: 'Your access has been revoked or suspended. Please contact an administrator.' }, 403);
        if (await verifyPassword(newPassword, user.password)) {
            return json({ success: false, error: "That's already your password: go back and log in with it." }, 409);
        }
    }

    await db.prepare(`UPDATE users SET password = ? WHERE id = ?`).bind(await hashPassword(newPassword), user.id).run();
    try { await db.prepare(`DELETE FROM heartbeats WHERE username = ?`).bind(user.username).run(); } catch (e) { /* none */ }
    await logActivity(db, user.username, user.batch_id, mode === 'first' ? 'set-first-password' : 'forgot-password-reset', null);
    return json({ success: true, userType: user.user_type });
}

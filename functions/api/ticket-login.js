import { json, logActivity, createSessionToken, sessionCookie, upsertSessionHeartbeat, buildFullName } from '../_utils.js';
import { verifyTicket } from './verify-ticket.js';

// POST /api/ticket-login { ticket }  → signs a trainee in to the Portal from a course's signed ticket, so a simulator a course
// opens (the Google Calendar Simulator, Medical Records Requests, …) doesn't ask them to log in again. A simulator page's ?ticket= is
// handled by functions/_middleware.js before the page is sent; this endpoint is the same step for a page that asks for it.
//
// The courses sign the same ticket the Portal's /api/launch does (their /api/auth/tool-ticket, js/lsh-tool-links.js, with the
// shared PORTAL_SSO_SECRET): {first, last, b, exp}, good for 5 minutes.
//   - a trainee's ticket: their Portal account (below);
//   - single sign-on for trainers too: an administrator's ticket { r: 'a', n } from a course they opened from the main Hub
//     (the Portal's /api/launch gave them one; the course signs one back only for a trainer who came from there) signs them in
//     to their own admin account: the Approved admin whose full name is n, exactly one. A ticket with no name (the Master
//     Account's), no such admin or more than one, and the Portal's system ticket, never sign anyone in: the password then;
//   - the account is the trainee's Portal account with that first and last name (and Batch ID when the ticket has one), Approved;
//     no account, more than one, or a pending, rejected, revoked or suspended one: refused, never guessed.
// The session is the same as /api/login's (12 hours, the heartbeat seeded).
// The Portal session for a course's ticket: { user, cookie } or { status, code, error }. functions/_middleware.js uses it for a
// simulator page opened with ?ticket= (it signs the trainee in before the page is sent, then drops the ticket from the address).
export async function ticketSession(env, ticket) {
    const db = env.DB;
    const t = await verifyTicket(String(env.PORTAL_SSO_SECRET || '').trim(), ticket);
    if (!t.ok) return { status: t.code === 'not-configured' ? 501 : 401, code: t.code, error: t.code === 'expired' ? 'This link has expired. Open it again from your training program.' : 'This sign-in link isn\'t valid.' };
    if (t.system) return { status: 403, code: 'admin-password', error: 'Administrators sign in with their password.' };
    if (t.admin) {
        const name = String(t.name || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!name) return { status: 403, code: 'admin-password', error: 'Administrators sign in with their password.' };
        const { results } = await db.prepare(`SELECT * FROM users WHERE user_type = 'Admin' AND status = 'Approved'`).all();
        const admins = (results || []).filter(u => buildFullName(u).replace(/\s+/g, ' ').trim().toLowerCase() === name);
        if (admins.length !== 1) return { status: 403, code: 'admin-password', error: 'Administrators sign in with their password.' };
        // (a trainer's ticket works once, as every program takes it: a copy, from browser history or a forwarded link, can't sign
        // anyone in again inside its 5 minutes)
        await db.prepare(`CREATE TABLE IF NOT EXISTS sso_used_tickets (sig TEXT PRIMARY KEY, exp INTEGER NOT NULL)`).run();
        await db.prepare(`DELETE FROM sso_used_tickets WHERE exp < ?`).bind(Date.now()).run();
        const sig = String(ticket || '').split('.')[1] || '';
        if (await db.prepare(`SELECT sig FROM sso_used_tickets WHERE sig = ?`).bind(sig).first()) return { status: 401, code: 'used', error: 'This sign-in link was already used. Open it again from your training program.' };
        await db.prepare(`INSERT INTO sso_used_tickets (sig, exp) VALUES (?, ?)`).bind(sig, Date.now() + 10 * 60 * 1000).run();
        const user = admins[0], fullName = buildFullName(user);
        await logActivity(db, user.username, user.batch_id, 'login', 'ticket (trainer)');
        await upsertSessionHeartbeat(db, { username: user.username, fullName, batchId: user.batch_id, userType: 'Admin' });
        const token = await createSessionToken({ sub: user.id, username: user.username, batchId: user.batch_id, userType: 'Admin', fullName }, env.SESSION_SECRET);
        const { password: _pw, ...safeUser } = user;
        return { user: { ...safeUser, fullName, userType: 'Admin' }, cookie: sessionCookie(token, 43200) };
    }
    const { results } = await db.prepare(`SELECT * FROM users WHERE lower(trim(first_name)) = lower(?) AND lower(trim(last_name)) = lower(?) AND (? = '' OR batch_id = ?) AND (user_type IS NULL OR user_type = 'Trainee')`)
        .bind(t.first, t.last, t.batch, t.batch).all();
    const list = results || [];
    const approved = list.filter(u => u.status === 'Approved');
    if (approved.length !== 1) {
        const why = !list.length ? 'No Portal account has your name and batch: ask your trainer.'
            : approved.length > 1 ? 'More than one Portal account has your name and batch: ask your trainer.'
            : list[0].status === 'Pending' ? 'Your registration is still pending admin approval.' : 'Your access has been revoked or suspended by an administrator.';
        return { status: 403, code: 'no-account', error: why };
    }
    const user = approved[0], fullName = buildFullName(user);
    await logActivity(db, user.username, user.batch_id, 'login', 'ticket');
    await upsertSessionHeartbeat(db, { username: user.username, fullName, batchId: user.batch_id, userType: 'Trainee' });
    const token = await createSessionToken({ sub: user.id, username: user.username, batchId: user.batch_id, userType: 'Trainee', fullName }, env.SESSION_SECRET);
    const { password: _pw, ...safeUser } = user;
    return { user: { ...safeUser, fullName, userType: 'Trainee' }, cookie: sessionCookie(token, 43200) };
}

export async function onRequestPost({ request, env }) {
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const out = await ticketSession(env, body && body.ticket);
    if (!out.cookie) return json({ success: false, code: out.code, error: out.error }, out.status);
    return json({ success: true, user: out.user }, 200, { 'Set-Cookie': out.cookie });
}

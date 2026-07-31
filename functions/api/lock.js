// POST /api/lock   body: { action: 'lock', batchId, password }
//                 or   { action: 'unlock', username, password }
// -> { ok: true } (lock) or { ok: true, user } (unlock)
//
// Combined into one file/route because the real repo has a single lock.js,
// not separate lock/unlock files — dispatches on body.action.
//
// LOCK: requires an already-authenticated admin to re-enter credentials
// (matches the lock-confirm-modal in the UI) even though they're logged in,
// since this is a big hammer: it force-logs-out every session, admin
// included.
//
// UNLOCK: deliberately does NOT require context.data.user — locking wipes
// every session, so there's nothing for the middleware to resolve. Verifies
// credentials directly, clears the lock, and mints a fresh session so the
// admin is logged back in immediately.

import bcrypt from 'bcryptjs';

async function handleLock(context) {
  const user = context.data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (user.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const { batchId, password } = await context.request.json().catch(() => ({}));
  if (!batchId || !password) {
    return new Response(JSON.stringify({ error: 'Batch ID and password are required.' }), { status: 400 });
  }

  const admin = await context.env.DB
    .prepare("SELECT * FROM users WHERE role = 'admin' AND batch_id = ? AND approved = 1")
    .bind(String(batchId).trim())
    .first();

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return new Response(JSON.stringify({ error: 'Batch ID / password did not match an administrator record.' }), { status: 401 });
  }

  await context.env.DB.prepare(
    `INSERT INTO app_kv (key, owner_id, value, updated_at) VALUES ('site:lock', '__shared__', ?, ?)
     ON CONFLICT(key, owner_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(JSON.stringify({ locked: true, lockedBy: admin.batch_id }), Date.now()).run();

  // Force logout: destroy every live session.
  await context.env.DB.prepare('DELETE FROM sessions').run();

  await context.env.DB
    .prepare('INSERT INTO server_logs (id, ts, type, actor, detail) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(), Date.now(), 'lock', admin.username, `Locked by ${admin.batch_id}`)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleUnlock(context) {
  const { username, password } = await context.request.json().catch(() => ({}));
  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Username and password are required.' }), { status: 400 });
  }

  const admin = await context.env.DB
    .prepare("SELECT * FROM users WHERE role = 'admin' AND username = ? AND approved = 1")
    .bind(String(username).trim())
    .first();

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return new Response(JSON.stringify({ error: 'Invalid username or password.' }), { status: 401 });
  }

  await context.env.DB.prepare(
    `INSERT INTO app_kv (key, owner_id, value, updated_at) VALUES ('site:lock', '__shared__', ?, ?)
     ON CONFLICT(key, owner_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(JSON.stringify({ locked: false, lockedBy: null }), Date.now()).run();

  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const maxAgeSeconds = 60 * 60 * 24 * 7;
  await context.env.DB
    .prepare('INSERT INTO sessions (id, email, name, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(sessionId, admin.username, `${admin.first_name} ${admin.last_name}`.trim(), 'admin', now, now + maxAgeSeconds * 1000)
    .run();

  await context.env.DB
    .prepare('INSERT INTO server_logs (id, ts, type, actor, detail) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(), now, 'unlock', admin.username, null)
    .run();

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', `lsh_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`);

  return new Response(JSON.stringify({ ok: true, user: { username: admin.username, role: 'admin' } }), { headers });
}

export async function onRequestPost(context) {
  const body = await context.request.clone().json().catch(() => ({}));
  if (body.action === 'unlock') return handleUnlock(context);
  return handleLock(context);
}

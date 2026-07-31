// POST /api/heartbeat -> { ok: true }                (any signed-in user)
// GET  /api/heartbeat -> { users: [...] }             (admin only)
//
// POST: call this every ~20-30s from the client while the app is open.
// GET: powers Master Control > Monitoring > "Trainees Online Now" — folded
// in here rather than a separate online.js, since the real repo doesn't
// have one and this is the table that already holds the data.
//
// "Online" = a heartbeat within the last 60 seconds.

const ONLINE_WINDOW_MS = 60 * 1000;

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  await context.env.DB
    .prepare(
      `INSERT INTO heartbeats (username, name, role, batch_id, last_seen)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET last_seen = excluded.last_seen`
    )
    .bind(user.email, user.name, user.role, user.batchId || null, Date.now())
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (user.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  const { results } = await context.env.DB
    .prepare('SELECT username, name, role, batch_id, last_seen FROM heartbeats WHERE last_seen >= ? ORDER BY name ASC')
    .bind(cutoff)
    .all();

  const users = (results || []).map((r) => ({
    username: r.username, name: r.name, role: r.role, batchId: r.batch_id, lastSeen: r.last_seen,
  }));

  return new Response(JSON.stringify({ users }), { headers: { 'Content-Type': 'application/json' } });
}

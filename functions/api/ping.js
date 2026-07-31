// POST /api/ping   body: { to: string[] | null, message } -> { ok: true }   (admin only — send)
// GET  /api/ping?since=<ts> -> { pings: [...] }                             (any signed-in user — poll)
//
// Combined into one file/route because the real repo has a single ping.js,
// not separate send/poll files.
//
// POST `to`: array of usernames/emails for specific recipients, or
// null/omitted for "all users" (stored once with to_user = NULL).
// GET: pass the timestamp of the last ping you already showed as `since`
// to avoid re-fetching old ones; matches on to_user = you OR to_user IS NULL.

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (user.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const { to, message } = await context.request.json().catch(() => ({}));
  if (!message || !String(message).trim()) {
    return new Response(JSON.stringify({ error: 'Message is required.' }), { status: 400 });
  }

  const recipients = Array.isArray(to) && to.length ? to : [null]; // null = everyone
  const now = Date.now();

  for (const recipient of recipients) {
    await context.env.DB
      .prepare('INSERT INTO pings (id, ts, from_user, to_user, message) VALUES (?,?,?,?,?)')
      .bind(crypto.randomUUID(), now, user.email, recipient, String(message).trim())
      .run();
  }

  await context.env.DB
    .prepare('INSERT INTO server_logs (id, ts, type, actor, detail) VALUES (?,?,?,?,?)')
    .bind(
      crypto.randomUUID(),
      now,
      'ping',
      user.email,
      recipients[0] === null ? 'Pinged all users' : `Pinged: ${recipients.join(', ')}`
    )
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const url = new URL(context.request.url);
  const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;

  const { results } = await context.env.DB
    .prepare(
      `SELECT id, ts, from_user, message FROM pings
       WHERE (to_user = ? OR to_user IS NULL) AND ts > ?
       ORDER BY ts ASC LIMIT 50`
    )
    .bind(user.email, since)
    .all();

  const pings = (results || []).map((r) => ({ id: r.id, ts: r.ts, from: r.from_user, message: r.message }));

  return new Response(JSON.stringify({ pings }), { headers: { 'Content-Type': 'application/json' } });
}

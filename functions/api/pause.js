// POST /api/pause   body: { paused: boolean } -> { ok: true }
// Freezes/resumes activity for every connected user. No logout, no data loss
// — the client just shows/hides the pause overlay based on /api/state.

async function writeKv(env, key, value) {
  await env.DB.prepare(
    `INSERT INTO app_kv (key, owner_id, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key, owner_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(key, '__shared__', JSON.stringify(value), Date.now()).run();
}

export async function onRequestPost(context) {
  const user = context.data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (user.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const { paused } = await context.request.json().catch(() => ({}));
  await writeKv(context.env, 'site:pause', { paused: !!paused });

  await context.env.DB
    .prepare('INSERT INTO server_logs (id, ts, type, actor, detail) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(), Date.now(), paused ? 'pause' : 'resume', user.email, null)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}

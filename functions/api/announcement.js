// GET    /api/announcement -> { text }     (admin only, for the editor form)
// POST   /api/announcement  body:{ text } -> { ok:true }
// DELETE /api/announcement -> { ok:true }   (clear the ticker)
//
// Regular users read the live ticker text via the public /api/state poll.

async function writeKv(env, key, value) {
  await env.DB.prepare(
    `INSERT INTO app_kv (key, owner_id, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key, owner_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(key, '__shared__', JSON.stringify(value), Date.now()).run();
}

function requireAdmin(context) {
  const user = context.data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (user.role !== 'admin') return new Response('Forbidden', { status: 403 });
  return null;
}

export async function onRequestGet(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;

  const row = await context.env.DB.prepare('SELECT value FROM app_kv WHERE key = ? AND owner_id = ?')
    .bind('site:announcement', '__shared__')
    .first();
  return new Response(JSON.stringify({ text: row ? JSON.parse(row.value).text : '' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;

  const { text } = await context.request.json().catch(() => ({}));
  await writeKv(context.env, 'site:announcement', { text: String(text || '').trim() });

  await context.env.DB
    .prepare('INSERT INTO server_logs (id, ts, type, actor, detail) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(), Date.now(), 'announce_set', context.data.user.email, String(text || '').trim())
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestDelete(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;

  await writeKv(context.env, 'site:announcement', { text: '' });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}

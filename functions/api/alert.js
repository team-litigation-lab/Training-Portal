// GET    /api/alert -> { alert }              (admin only, for the editor form)
// POST   /api/alert  body:{ text, image?, bgColor?, durationSec?, scheduledAt? } -> { ok:true }
// DELETE /api/alert -> { ok:true }             (stop it immediately)
//
// Regular users don't hit this route — they read the live alert via the
// public /api/state poll instead.

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
    .bind('site:alert', '__shared__')
    .first();
  return new Response(JSON.stringify({ alert: row ? JSON.parse(row.value) : null }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;

  const { text, image, bgColor, durationSec, scheduledAt } = await context.request.json().catch(() => ({}));
  if (!text || !String(text).trim()) {
    return new Response(JSON.stringify({ error: 'Alert text is required.' }), { status: 400 });
  }

  const alert = {
    active: true,
    text: String(text).trim(),
    image: image || null,
    bgColor: bgColor || null,
    scheduledAt: scheduledAt || null,
    expiresAt: durationSec ? Date.now() + durationSec * 1000 : null,
  };
  await writeKv(context.env, 'site:alert', alert);

  await context.env.DB
    .prepare('INSERT INTO server_logs (id, ts, type, actor, detail) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(), Date.now(), 'alert_set', context.data.user.email, alert.text)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestDelete(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;

  await writeKv(context.env, 'site:alert', { active: false });

  await context.env.DB
    .prepare('INSERT INTO server_logs (id, ts, type, actor, detail) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(), Date.now(), 'alert_stop', context.data.user.email, null)
    .run();

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}

// GET /api/kv/:key?shared=1        -> { value: string|null }
// PUT /api/kv/:key  body:{ value, shared } -> { ok: true }
//
// This is a thin key-value shim standing in for the old window.storage calls.
// value is stored/returned as a raw string — the frontend's getJSON/setJSON
// already handle JSON.stringify/parse, so this layer doesn't need to.

function isShared(request) {
  const url = new URL(request.url);
  const v = url.searchParams.get('shared');
  return v === '1' || v === 'true';
}

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { key } = context.params;
  const ownerId = isShared(context.request) ? '__shared__' : user.email;

  const row = await context.env.DB
    .prepare('SELECT value FROM app_kv WHERE key = ? AND owner_id = ?')
    .bind(key, ownerId)
    .first();

  return new Response(JSON.stringify({ value: row ? row.value : null }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPut(context) {
  const user = context.data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { key } = context.params;
  const body = await context.request.json();
  const shared = !!body.shared;

  // Trainee-authored data (their own answers) is private to them; anything
  // shared (activities, meta, day config) is trainer-authored only.
  if (shared && user.role !== 'trainer') {
    return new Response('Forbidden', { status: 403 });
  }

  const ownerId = shared ? '__shared__' : user.email;

  await context.env.DB
    .prepare(
      `INSERT INTO app_kv (key, owner_id, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key, owner_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(key, ownerId, String(body.value ?? ''), Date.now())
    .run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

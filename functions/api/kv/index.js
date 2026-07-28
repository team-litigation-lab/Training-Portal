// GET /api/kv?prefix=submission:day1:&shared=1  -> { keys: string[] }

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const url = new URL(context.request.url);
  const prefix = url.searchParams.get('prefix') || '';
  const shared = url.searchParams.get('shared') === '1' || url.searchParams.get('shared') === 'true';
  const ownerId = shared ? '__shared__' : user.email;

  // Escape SQL LIKE wildcards in the prefix itself before appending our own '%'.
  const escapedPrefix = prefix.replace(/[\\%_]/g, (m) => '\\' + m);

  const { results } = await context.env.DB
    .prepare("SELECT key FROM app_kv WHERE owner_id = ? AND key LIKE ? ESCAPE '\\'")
    .bind(ownerId, escapedPrefix + '%')
    .all();

  return new Response(JSON.stringify({ keys: (results || []).map((r) => r.key) }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

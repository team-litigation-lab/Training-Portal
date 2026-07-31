// GET /api/server-logs?limit=200 -> { logs: [...] }
// Logins, logouts, pauses, pings, locks, and revocations, newest first.

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (user.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const url = new URL(context.request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 1000);

  const { results } = await context.env.DB
    .prepare('SELECT id, ts, type, actor, detail, duration_ms FROM server_logs ORDER BY ts DESC LIMIT ?')
    .bind(limit)
    .all();

  const logs = (results || []).map((r) => ({
    id: r.id,
    ts: r.ts,
    type: r.type,
    actor: r.actor,
    detail: r.detail,
    durationMs: r.duration_ms,
  }));

  return new Response(JSON.stringify({ logs }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/me -> { user } or 401

export async function onRequestGet(context) {
  if (!context.data.user) {
    return new Response(JSON.stringify({ user: null }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ user: context.data.user }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /api/auth/logout

export async function onRequestPost(context) {
  const cookieHeader = context.request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)lsh_session=([^;]+)/);

  if (match) {
    await context.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(match[1]).run();
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', 'lsh_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  return new Response(JSON.stringify({ ok: true }), { headers });
}

// Runs before every /api/* request. Resolves the session cookie (if any) into
// context.data.user, which downstream route handlers read to authorize.
// Does NOT block unauthenticated requests itself — each handler decides
// whether it needs a logged-in user (and which role).

export async function onRequest(context) {
  context.data.user = null;

  const cookieHeader = context.request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)lsh_session=([^;]+)/);

  if (match) {
    const sessionId = match[1];
    const row = await context.env.DB
      .prepare('SELECT email, name, role, batch_id, expires_at FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first();

    if (row && row.expires_at > Date.now()) {
      context.data.user = { email: row.email, name: row.name, role: row.role, batchId: row.batch_id || null };
    }
  }

  return context.next();
}

// POST /api/auth/register   body: { email, password, name }
//
// Forwards registration to your EXISTING site's register endpoint so the new
// account lands in the SAME shared users table — this is what makes accounts
// created here also work on your existing site, and vice versa. On success,
// mints a local session immediately (same logic as /api/auth/login) so the
// trainee doesn't have to log in again right after signing up.
//
// >>> ADJUST env.EXISTING_REGISTER_URL and field names to match your real
// >>> register endpoint's actual request/response shape and error codes.

export async function onRequestPost(context) {
  const { email, password, name } = await context.request.json();
  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const upstream = await fetch(context.env.EXISTING_REGISTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (upstream.status === 409) {
    return new Response(JSON.stringify({ error: 'An account with that email already exists' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: 'Registration failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const upstreamData = await upstream.json().catch(() => ({}));
  const resolvedName = upstreamData.user?.name || name || email;

  const trainerAllowlist = (context.env.TRAINER_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const role = trainerAllowlist.includes(email.toLowerCase()) ? 'trainer' : 'trainee';

  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const maxAgeSeconds = 60 * 60 * 24 * 7; // 7 days
  const expiresAt = now + maxAgeSeconds * 1000;

  await context.env.DB
    .prepare('INSERT INTO sessions (id, email, name, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(sessionId, email, resolvedName, role, now, expiresAt)
    .run();

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append(
    'Set-Cookie',
    `lsh_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`
  );

  return new Response(JSON.stringify({ user: { email, name: resolvedName, role } }), { headers });
}

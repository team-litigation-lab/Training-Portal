// POST /api/auth/login   body: { email, password }
//
// This does NOT check passwords itself. It forwards the credentials to your
// EXISTING site's login endpoint as a server-to-server call (Cloudflare edge
// to Cloudflare edge — no browser involved, so no CORS or cross-site cookie
// restrictions apply here). If that call succeeds, this Worker creates its
// OWN session for the training domain.
//
// >>> ADJUST env.EXISTING_LOGIN_URL and the field names below to match your
// >>> real login endpoint's actual request/response shape.

export async function onRequestPost(context) {
  const { email, password } = await context.request.json();
  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Missing credentials' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const upstream = await fetch(context.env.EXISTING_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ADJUST: this assumes the existing API returns something like
  // { user: { email, name } }. Change to match reality.
  const upstreamData = await upstream.json().catch(() => ({}));
  const name = upstreamData.user?.name || upstreamData.name || email;

  // Role isn't known to the existing login API (it's specific to this app),
  // so it's resolved from a simple allowlist env var for now.
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
    .bind(sessionId, email, name, role, now, expiresAt)
    .run();

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append(
    'Set-Cookie',
    `lsh_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`
  );

  return new Response(JSON.stringify({ user: { email, name, role } }), { headers });
}

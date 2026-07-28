// POST /api/auth/login-admin   body: { username, password }
//
// Admin-only login. Forwards { username, password, portalMode: 'Admin' } to
// the EXISTING site's login endpoint as a server-to-server call. The
// existing endpoint rejects the request if the account's user_type isn't
// exactly 'Admin', so trainee accounts cannot authenticate through this
// route even if someone tries to submit here directly.
//
// portalMode is hardcoded here (not read from the client) so it can't be
// tampered with from the request body.
//
// Matches the existing site's /api/login contract exactly:
//   request:  { username, password, portalMode }
//   success:  { success: true, user: { ...safeUser, fullName } }  (200)
//   failure:  { success: false, error: '...' }                    (400/401/403)

const PORTAL_MODE = 'Admin';

export async function onRequestPost(context) {
  const { username, password } = await context.request.json();

  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Please enter both username and password.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const upstream = await fetch(context.env.EXISTING_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, portalMode: PORTAL_MODE }),
  });

  const upstreamData = await upstream.json().catch(() => ({}));

  if (!upstream.ok || !upstreamData.success) {
    // Pass the existing site's real error message through, e.g.
    // "No admin account is registered under that username."
    return new Response(
      JSON.stringify({ error: upstreamData.error || 'Invalid credentials' }),
      { status: upstream.status || 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const name = upstreamData.user?.fullName || username;
  const role = 'trainer'; // matches the role naming used elsewhere in this app

  const sessionId = crypto.randomUUID();
  const now = Date.now();
  const maxAgeSeconds = 60 * 60 * 24 * 7; // 7 days
  const expiresAt = now + maxAgeSeconds * 1000;

  await context.env.DB
    .prepare('INSERT INTO sessions (id, email, name, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(sessionId, username, name, role, now, expiresAt)
    .run();

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append(
    'Set-Cookie',
    `lsh_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`
  );

  return new Response(JSON.stringify({ user: { username, name, role } }), { headers });
}

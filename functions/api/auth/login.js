// POST /api/auth/login   body: { username, password }
//
// Combined admin+trainee login. Tries the EXISTING site's login endpoint
// with portalMode 'Admin' first, then falls back to 'Trainee' if that
// fails. Whichever portalMode the upstream account actually belongs to is
// the one that will succeed; the other attempt is expected to fail and is
// discarded. This lets a single username/password field on the client work
// for both account types without asking the user to pick a role.
//
// Matches the existing site's /api/login contract exactly:
//   request:  { username, password, portalMode }
//   success:  { success: true, user: { ...safeUser, fullName } }  (200)
//   failure:  { success: false, error: '...' }                    (400/401/403)

async function tryPortal(context, username, password, portalMode) {
  const upstream = await fetch(context.env.EXISTING_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, portalMode }),
  });
  const data = await upstream.json().catch(() => ({}));
  return { ok: upstream.ok && data.success, status: upstream.status, data };
}

export async function onRequestPost(context) {
  const { username, password } = await context.request.json();

  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Please enter both username and password.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Try Admin first, then Trainee. Each portalMode is strictly validated
  // upstream, so a trainee username tried as 'Admin' (and vice versa) will
  // simply fail without side effects.
  const adminAttempt = await tryPortal(context, username, password, 'Admin');
  let result = adminAttempt;
  let role = 'trainer';

  if (!adminAttempt.ok) {
    const traineeAttempt = await tryPortal(context, username, password, 'Trainee');
    result = traineeAttempt;
    role = 'trainee';
  }

  if (!result.ok) {
    // Surface whichever upstream error came back last (most likely to be
    // the relevant one, e.g. "Invalid credentials" or "pending approval").
    return new Response(
      JSON.stringify({ error: result.data.error || 'Invalid credentials' }),
      { status: result.status || 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const name = result.data.user?.fullName || username;

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

// POST /api/auth/login   body: { username, password, portal }
//
// `portal` is provided by the client based on which portal tab the user
// selected: 'admin' or 'trainee'. It maps 1:1 to the existing site's
// portalMode ('Admin' / 'Trainee'), and only that single upstream mode is
// ever tried — there is no guess-then-fallback anymore.
//
// This is what actually enforces "trainee accounts can only log in through
// the Trainee Portal" (and, symmetrically, admin accounts through the Admin
// Portal): an account that doesn't belong to the selected portalMode fails
// upstream immediately, and no session is ever created for it.
//
// Matches the existing site's /api/login contract exactly:
//   request:  { username, password, portalMode }
//   success:  { success: true, user: { ...safeUser, fullName } }  (200)
//   failure:  { success: false, error: '...' }                    (400/401/403)

const PORTAL_TO_UPSTREAM_MODE = { admin: 'Admin', trainee: 'Trainee' };

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
  const { username, password, portal } = await context.request.json();

  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Please enter both username and password.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const upstreamMode = PORTAL_TO_UPSTREAM_MODE[portal];
  if (!upstreamMode) {
    return new Response(JSON.stringify({ error: 'Please select a portal.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Only the selected portal's upstream mode is tried. A trainee account
  // attempting the Admin portal (or an admin account attempting the Trainee
  // portal) fails right here, with no session ever created.
  const result = await tryPortal(context, username, password, upstreamMode);

  if (!result.ok) {
    return new Response(
      JSON.stringify({ error: result.data.error || 'Invalid credentials' }),
      { status: result.status || 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const role = portal; // 'admin' | 'trainee' — always matches the portal actually authenticated against
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

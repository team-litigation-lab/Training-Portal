// GET /api/state -> { paused, locked, lockedBy, announcement, alert }
// No auth required — this has to be readable by the lock screen and pause
// overlay before/without a session. Poll this every few seconds from the
// client to react to admin actions in near-real-time.

async function readKv(env, key) {
  const row = await env.DB.prepare('SELECT value FROM app_kv WHERE key = ? AND owner_id = ?')
    .bind(key, '__shared__')
    .first();
  return row ? JSON.parse(row.value) : null;
}

export async function onRequestGet(context) {
  const [pause, lock, announcement, alert] = await Promise.all([
    readKv(context.env, 'site:pause'),
    readKv(context.env, 'site:lock'),
    readKv(context.env, 'site:announcement'),
    readKv(context.env, 'site:alert'),
  ]);

  // An alert with a non-zero duration expires client-side-visibly, but also
  // treat it as inactive server-side once its time has passed so a late
  // poller doesn't resurrect it.
  let liveAlert = alert;
  if (liveAlert && liveAlert.expiresAt && liveAlert.expiresAt < Date.now()) {
    liveAlert = { ...liveAlert, active: false };
  }
  if (liveAlert && liveAlert.scheduledAt && liveAlert.scheduledAt > Date.now()) {
    liveAlert = { ...liveAlert, active: false }; // not time yet
  }

  return new Response(JSON.stringify({
    paused: !!(pause && pause.paused),
    locked: !!(lock && lock.locked),
    lockedBy: lock ? lock.lockedBy : null,
    announcement: announcement ? announcement.text : '',
    alert: liveAlert && liveAlert.active ? liveAlert : null,
  }), { headers: { 'Content-Type': 'application/json' } });
}

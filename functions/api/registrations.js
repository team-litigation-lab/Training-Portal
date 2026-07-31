// GET  /api/registrations -> { users: [...] }                          (admin only — list pending)
// POST /api/registrations  body: { action: 'approve', id, batchId? }   (admin only — approve)
//                          body: { action: 'reject', id }              (admin only — reject/delete)
//
// One file with action-based dispatch, matching the lock.js/ping.js
// pattern used elsewhere in this repo.
//
// Approving a trainee assigns a Batch ID (from the request, or 'GENERAL'
// if omitted — there's no batch-picker in the UI yet) and the next
// sequence number within that batch. Admins don't need a batch ID.

function requireAdmin(context) {
  const user = context.data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (user.role !== 'admin') return new Response('Forbidden', { status: 403 });
  return null;
}

export async function onRequestGet(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;

  const { results } = await context.env.DB
    .prepare(
      `SELECT id, first_name, middle_name, last_name, suffix, email, role,
              training_date, username, created_at
       FROM users WHERE approved = 0 ORDER BY created_at ASC`
    )
    .all();

  const users = (results || []).map((r) => ({
    id: r.id,
    name: [r.first_name, r.middle_name ? r.middle_name + '.' : '', r.last_name, r.suffix]
      .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
    username: r.username,
    email: r.email,
    role: r.role,
    trainingDate: r.training_date,
    createdAt: r.created_at,
  }));

  return new Response(JSON.stringify({ users }), { headers: { 'Content-Type': 'application/json' } });
}

async function approve(context, id, batchIdInput) {
  const pending = await context.env.DB.prepare('SELECT * FROM users WHERE id = ? AND approved = 0').bind(id).first();
  if (!pending) return new Response(JSON.stringify({ error: 'Registration not found.' }), { status: 404 });

  const batchId = pending.role === 'trainee' ? (batchIdInput ? String(batchIdInput).trim() : 'GENERAL') : null;

  const seqQuery = pending.role === 'trainee'
    ? context.env.DB.prepare('SELECT COALESCE(MAX(sequence), 0) AS maxSeq FROM users WHERE role = ? AND batch_id = ? AND approved = 1').bind('trainee', batchId)
    : context.env.DB.prepare("SELECT COALESCE(MAX(sequence), 0) AS maxSeq FROM users WHERE role = 'admin' AND approved = 1");
  const { maxSeq } = await seqQuery.first();
  const sequence = (maxSeq || 0) + 1;

  await context.env.DB.prepare('UPDATE users SET approved = 1, batch_id = ?, sequence = ? WHERE id = ?')
    .bind(batchId, sequence, id).run();

  await context.env.DB.prepare('INSERT INTO server_logs (id, ts, type, actor, detail) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(), Date.now(), 'approve', context.data.user.email, `Approved ${pending.username} (${pending.role})`).run();

  return new Response(JSON.stringify({ ok: true, batchId, sequence }), { headers: { 'Content-Type': 'application/json' } });
}

async function reject(context, id) {
  const pending = await context.env.DB.prepare('SELECT username FROM users WHERE id = ? AND approved = 0').bind(id).first();
  if (!pending) return new Response(JSON.stringify({ error: 'Registration not found.' }), { status: 404 });

  await context.env.DB.prepare('DELETE FROM users WHERE id = ? AND approved = 0').bind(id).run();

  await context.env.DB.prepare('INSERT INTO server_logs (id, ts, type, actor, detail) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(), Date.now(), 'reject', context.data.user.email, `Rejected ${pending.username}`).run();

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost(context) {
  const denied = requireAdmin(context);
  if (denied) return denied;

  const { action, id, batchId } = await context.request.json().catch(() => ({}));
  if (!id) return new Response(JSON.stringify({ error: 'id is required.' }), { status: 400 });

  if (action === 'approve') return approve(context, id, batchId);
  if (action === 'reject') return reject(context, id);
  return new Response(JSON.stringify({ error: "action must be 'approve' or 'reject'." }), { status: 400 });
}

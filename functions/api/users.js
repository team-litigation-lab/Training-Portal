// GET /api/users -> { admins: [...], batches: { [batchId]: [...] } }
// Approved accounts only, sorted by sequence within each group.

export async function onRequestGet(context) {
  const user = context.data.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (user.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const { results } = await context.env.DB
    .prepare(
      `SELECT id, first_name, middle_name, last_name, suffix, email, role,
              training_date, batch_id, sequence, username
       FROM users WHERE approved = 1 ORDER BY sequence ASC`
    )
    .all();

  const admins = [];
  const batches = {};

  for (const r of results || []) {
    const entry = {
      id: r.id,
      firstName: r.first_name,
      middleName: r.middle_name,
      lastName: r.last_name,
      suffix: r.suffix,
      email: r.email,
      username: r.username,
      trainingDate: r.training_date,
      sequence: r.sequence,
    };
    if (r.role === 'admin') {
      admins.push(entry);
    } else {
      const batchId = r.batch_id || 'Unassigned';
      if (!batches[batchId]) batches[batchId] = [];
      batches[batchId].push(entry);
    }
  }

  return new Response(JSON.stringify({ admins, batches }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

import { json, logActivity, hashPassword, isUsernameTombstoned } from '../_utils.js';

// POST /api/claim { firstName, lastName, batchId, username, email, password }
//
// Trainees who already registered in a program or the CMS were imported to the Portal by an admin
// (functions/api/import-registrations.js) without a password. This is the one-time step that makes the
// account theirs: they confirm their name and Batch ID, choose a username and password, and sign in.
// Only an imported, still-unclaimed Trainee account can be claimed; nothing else is touched.
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{8,}$/;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
const batchNorm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const FAILS_PER_HOUR = 15;

export const UNCLAIMED = 'unclaimed:';

export async function onRequestPost({ request, env }) {
    const db = env.DB;
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const first = String(body.firstName || '').trim(), last = String(body.lastName || '').trim();
    const batch = String(body.batchId || '').trim();
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    if (!first || !last || !batch || !username || !email || !password) return json({ success: false, error: 'Please fill out every field.' }, 400);
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) return json({ success: false, error: 'Choose a username of 3 to 30 letters, numbers or underscores.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ success: false, error: 'Please enter a valid email address.' }, 400);
    if (!PASSWORD_RE.test(password)) return json({ success: false, error: 'Password must be at least 8 characters long and contain only letters and numbers (at least one letter and one number).' }, 400);

    // A connection that keeps missing is slowed down: names and batches can be guessed.
    await db.prepare(`CREATE TABLE IF NOT EXISTS claim_rate (ip TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL)`).run();
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const hour = Math.floor(Date.now() / 3600000);
    const rate = await db.prepare(`SELECT window_start, count FROM claim_rate WHERE ip = ?`).bind(ip).first();
    const fails = rate && rate.window_start === hour ? rate.count : 0;
    if (fails >= FAILS_PER_HOUR) return json({ success: false, error: 'Too many tries from this connection. Please wait an hour, or ask your trainer.' }, 429);
    const miss = async (error, status = 404) => {
        await db.prepare(`INSERT INTO claim_rate (ip, window_start, count) VALUES (?, ?, ?) ON CONFLICT(ip) DO UPDATE SET window_start = excluded.window_start, count = excluded.count`).bind(ip, hour, fails + 1).run();
        return json({ success: false, error }, status);
    };

    const typed = norm(`${first} ${last}`);
    const { results } = await db.prepare(`SELECT * FROM users WHERE user_type = 'Trainee' AND password LIKE ? LIMIT 5000`).bind(UNCLAIMED + '%').all();
    const matches = (results || []).filter(u => {
        const f = norm(u.first_name), m = norm(u.mi), l = norm(u.last_name), x = norm(u.suffix);
        const names = new Set([`${f} ${l}`]);
        if (m) names.add(`${f} ${m} ${l}`);
        if (x) { names.add(`${f} ${l} ${x}`); if (m) names.add(`${f} ${m} ${l} ${x}`); }
        return names.has(typed) && batchNorm(u.batch_id) === batchNorm(batch) && batchNorm(batch) !== '';
    });
    if (matches.length !== 1) {
        return miss(matches.length > 1
            ? 'More than one imported trainee matches. Please ask your trainer to help you claim your account.'
            : 'We couldn\'t find an existing registration with that name and Batch ID, or it was already claimed. Check them, or register as a new trainee.');
    }
    const user = matches[0];
    if (await db.prepare(`SELECT id FROM users WHERE username = ?`).bind(username).first()) return json({ success: false, error: 'That username is already taken. Choose another.' }, 409);
    if (await isUsernameTombstoned(db, username)) return json({ success: false, error: 'That username has been permanently retired and cannot be used again.' }, 409);

    const res = await db.prepare(`UPDATE users SET username = ?, email = ?, password = ? WHERE id = ? AND password LIKE ?`)
        .bind(username, email, await hashPassword(password), user.id, UNCLAIMED + '%').run();
    if (!res.meta || !res.meta.changes) return json({ success: false, error: 'That account was just claimed. Please log in.' }, 409);
    // The old (imported) username carries any program access already granted: move it over.
    await env.TRAINING_DB.prepare(`UPDATE trainee_topic_access SET trainee_username = ? WHERE trainee_username = ?`).bind(username, user.username).run().catch(() => {});
    await logActivity(db, username, user.batch_id, 'claim', { imported: true });
    return json({ success: true });
}

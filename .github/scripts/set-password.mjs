// Choosing a password without an administrator: a trainer account made with no password chooses its first one at
// sign-in, and an approved trainee or trainer resets a forgotten one (username + registered email). The account
// stays Approved either way. Also: the no-password marker is never accepted as a password, the first-password step
// can't replace a password that's already set, and the old imported "unclaimed:" accounts aren't offered it.
// Run: node .github/scripts/set-password.mjs   (from the repository root; Node 22.13+)
import { DatabaseSync } from 'node:sqlite';

const ROOT = new URL('../../', import.meta.url);
const failures = []; const fail = (m) => failures.push(m);
function d1(db) {
    return { prepare(sql) {
        const make = (args) => ({ bind: (...a) => make(a),
            async run() { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: r.changes } }; },
            async first() { const r = db.prepare(sql).get(...args); return r === undefined ? null : { ...r }; },
            async all() { return { results: db.prepare(sql).all(...args).map(r => ({ ...r })) }; } });
        return make([]);
    } };
}
const login = await import(new URL('functions/api/login.js', ROOT).href);
const setpw = await import(new URL('functions/api/set-password.js', ROOT).href);
const { hashPassword, SET_PASSWORD_MARK } = await import(new URL('functions/_utils.js', ROOT).href);

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, email TEXT, user_type TEXT, batch_id TEXT, username TEXT UNIQUE, password TEXT NOT NULL, status TEXT, training_start_date TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
    CREATE TABLE activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_username TEXT, actor_batch TEXT, action TEXT, details TEXT, created_at TEXT DEFAULT (datetime('now')));`);
const env = { DB: d1(sql), SESSION_SECRET: 'ci-secret', MASTER_ADMIN_PASSWORD: 'ci-master-pass' };
const post = async (mod, body) => { const r = await mod.onRequestPost({ request: new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }), env }); return { status: r.status, cookie: r.headers.get('set-cookie') || '', data: await r.json().catch(() => ({})) }; };
const add = (u, type, status, password, email = '') => sql.prepare(`INSERT INTO users (first_name, last_name, email, user_type, username, password, status) VALUES ('F', 'L', ?, ?, ?, ?, ?)`).run(email, type, u, password, status);

const MARK = SET_PASSWORD_MARK + 'new';
add('MattG', 'Admin', 'Approved', MARK);
add('nia', 'Trainee', 'Approved', await hashPassword('old-password-1'), 'Nia@Example.com');
add('pending1', 'Trainee', 'Pending', await hashPassword('old-password-1'), 'p@example.com');
add('imp_old', 'Trainee', 'Approved', 'unclaimed:abc');

// 1. a new trainer: the username alone (empty password, or anything typed) asks for a password
let r = await post(login, { portalMode: 'Admin', username: 'MattG', password: '' });
if (r.data.code !== 'SET_PASSWORD' || r.cookie) fail(`a new trainer should be asked to choose a password: ${r.status} ${JSON.stringify(r.data)}`);
r = await post(login, { portalMode: 'Admin', username: 'MattG', password: MARK });
if (r.cookie) fail('the no-password marker signed in as a password');
r = await post(login, { portalMode: 'Trainee', username: 'MattG', password: MARK });
if (r.cookie) fail('the no-password marker signed in through the trainee portal');

// 2. they choose one, stay approved, and it signs in
r = await post(setpw, { mode: 'first', username: 'MattG', portalMode: 'Admin', newPassword: 'Matt-pass-2026' });
if (!r.data.success) fail(`a new trainer could not choose a password: ${JSON.stringify(r.data)}`);
let row = sql.prepare(`SELECT * FROM users WHERE username = 'MattG'`).get();
if (row.status !== 'Approved' || !/^pbkdf2:/.test(row.password)) fail(`after choosing a password the trainer should be Approved with a hashed password: ${row.status} ${row.password.slice(0, 7)}`);
r = await post(login, { portalMode: 'Admin', username: 'MattG', password: 'Matt-pass-2026' });
if (r.status !== 200 || !/lsh_session=/.test(r.cookie)) fail(`the trainer's new password doesn't sign in: ${JSON.stringify(r.data)}`);

// 3. once set, the first-password step can't replace it
r = await post(setpw, { mode: 'first', username: 'MattG', portalMode: 'Admin', newPassword: 'someone-else-1' });
if (r.data.success) fail('the first-password step replaced a password that was already set');
r = await post(setpw, { mode: 'first', username: 'nia', portalMode: 'Trainee', newPassword: 'someone-else-1' });
if (r.data.success) fail("the first-password step replaced a trainee's password");
r = await post(setpw, { mode: 'first', username: 'imp_old', portalMode: 'Trainee', newPassword: 'someone-else-1' });
if (r.data.success) fail('an old imported unclaimed account was offered the first-password step');
r = await post(login, { portalMode: 'Trainee', username: 'imp_old', password: '' });
if (r.data.code === 'SET_PASSWORD') fail('an old imported unclaimed account was asked to choose a password');

// 4. forgot password: username + registered email (any capitals), stays approved, the new one signs in, the old doesn't
r = await post(setpw, { mode: 'forgot', username: 'nia', email: 'wrong@example.com', newPassword: 'new-password-2' });
if (r.data.success) fail('forgot password worked with the wrong email');
r = await post(setpw, { mode: 'forgot', username: 'nia', email: ' nia@example.COM ', newPassword: 'new-password-2' });
if (!r.data.success) fail(`forgot password refused the right email: ${JSON.stringify(r.data)}`);
row = sql.prepare(`SELECT * FROM users WHERE username = 'nia'`).get();
if (row.status !== 'Approved') fail(`a reset sent the account back to ${row.status}`);
r = await post(login, { portalMode: 'Trainee', username: 'nia', password: 'new-password-2' });
if (!/lsh_session=/.test(r.cookie)) fail(`the reset password doesn't sign in: ${JSON.stringify(r.data)}`);
r = await post(login, { portalMode: 'Trainee', username: 'nia', password: 'old-password-1' });
if (r.cookie) fail('the old password still signs in after a reset');

// 5. no email on file (the trainers), a pending registration, the master account, a short password: refused
for (const [body, why] of [
    [{ mode: 'forgot', username: 'MattG', email: '', newPassword: 'x-password-9' }, 'an account with no email on file'],
    [{ mode: 'forgot', username: 'pending1', email: 'p@example.com', newPassword: 'x-password-9' }, 'a pending registration'],
    [{ mode: 'forgot', username: 'LSHADMIN123', email: 'a@b.co', newPassword: 'x-password-9' }, 'the Master Account'],
    [{ mode: 'forgot', username: 'nia', email: 'nia@example.com', newPassword: 'short' }, 'a password under 8 characters']
]) { r = await post(setpw, body); if (r.data.success) fail(`forgot password should refuse ${why}`); }

// 6. an ordinary sign-in with no password typed is still told to enter both
r = await post(login, { portalMode: 'Trainee', username: 'nia', password: '' });
if (r.cookie || r.status !== 400) fail(`an empty password should be refused for an account that has one: ${r.status}`);

if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Set-password test passed (a new trainer chooses a first password, forgot password resets with username + email, accounts stay approved).');

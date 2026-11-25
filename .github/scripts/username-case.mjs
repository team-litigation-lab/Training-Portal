// Usernames are matched without regard to capitals (code inventory 2026-10-16 #6), with no change to the users table:
// signing in as JSMITH finds jsmith (and the session is jsmith's); a new account can't take JSmith while jsmith exists, nor a
// retired username in other capitals; two accounts made before this that differ only in capitals are never guessed between:
// typed exactly, each still signs in; typed any other way, the sign-in is refused with a clear message (409 AMBIGUOUS_USERNAME).
// Run: node --no-warnings .github/scripts/username-case.mjs   (from the repository root; Node 22.13+)
import { DatabaseSync } from 'node:sqlite';

const ROOT = new URL('../../', import.meta.url);
const failures = []; const fail = (m) => failures.push(m);
function d1(db) {
    return { prepare(sql) {
        const make = (args) => ({ bind: (...a) => make(a),
            async run() { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; },
            async first() { const r = db.prepare(sql).get(...args); return r === undefined ? null : { ...r }; },
            async all() { return { results: db.prepare(sql).all(...args).map(r => ({ ...r })) }; } });
        return make([]);
    } };
}
const login = await import(new URL('functions/api/login.js', ROOT).href);
const setpw = await import(new URL('functions/api/set-password.js', ROOT).href);
const u = await import(new URL('functions/_utils.js', ROOT).href);

const sql = new DatabaseSync(':memory:');
// (BINARY collation, as a table made without COLLATE NOCASE has: the case where this matters)
sql.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, email TEXT, user_type TEXT, batch_id TEXT, username TEXT UNIQUE, password TEXT NOT NULL, status TEXT, training_start_date TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
    CREATE TABLE activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_username TEXT, actor_batch TEXT, action TEXT, details TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE deleted_users (username TEXT, user_type TEXT, batch_id TEXT, email TEXT, full_name TEXT, deleted_by TEXT, deleted_at TEXT);
    INSERT INTO deleted_users (username) VALUES ('retired1');`);
const env = { DB: d1(sql), SESSION_SECRET: 'ci-secret', MASTER_ADMIN_PASSWORD: 'ci-master-pass' };
const post = async (mod, body) => { const r = await mod.onRequestPost({ request: new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }), env }); return { status: r.status, cookie: r.headers.get('set-cookie') || '', data: await r.json().catch(() => ({})) }; };
const add = async (name, type, pw) => sql.prepare(`INSERT INTO users (first_name, last_name, email, user_type, username, password, status) VALUES ('F', 'L', 'x@example.com', ?, ?, ?, 'Approved')`).run(type, name, await u.hashPassword(pw));
await add('jsmith', 'Trainee', 'password-one');
await add('Maria', 'Trainee', 'password-two');
await add('MARIA', 'Trainee', 'password-three');
await add('CoachAna', 'Admin', 'password-four');

const sessionOf = async (cookie) => u.verifySessionToken(decodeURIComponent((cookie.match(/lsh_session=([^;]+)/) || [])[1] || ''), env.SESSION_SECRET);
// 1. other capitals sign in to the one account, as that account
let r = await post(login, { portalMode: 'Trainee', username: 'JSMITH', password: 'password-one' });
const s1 = r.cookie && await sessionOf(r.cookie);
if (r.status !== 200 || !s1 || s1.username !== 'jsmith') fail(`JSMITH should sign in as jsmith: ${r.status} ${JSON.stringify(r.data)}`);
r = await post(login, { portalMode: 'Admin', username: 'coachana', password: 'password-four' });
if (r.status !== 200 || !r.cookie) fail(`an admin's username in other capitals should sign in: ${r.status} ${JSON.stringify(r.data)}`);
r = await post(login, { portalMode: 'Trainee', username: 'JSMITH', password: 'wrong-password' });
if (r.status !== 401 || r.cookie) fail('a wrong password is still refused');
// 2. a case-only duplicate: typed exactly, each signs in to its own account; any other way, refused with a clear message
r = await post(login, { portalMode: 'Trainee', username: 'Maria', password: 'password-two' });
if (r.status !== 200 || (await sessionOf(r.cookie)).username !== 'Maria') fail(`"Maria" typed exactly should still sign in: ${r.status}`);
r = await post(login, { portalMode: 'Trainee', username: 'MARIA', password: 'password-three' });
if (r.status !== 200 || (await sessionOf(r.cookie)).username !== 'MARIA') fail(`"MARIA" typed exactly should still sign in: ${r.status}`);
r = await post(login, { portalMode: 'Trainee', username: 'maria', password: 'password-two' });
if (r.status !== 409 || r.data.code !== 'AMBIGUOUS_USERNAME' || r.cookie || !/capital/i.test(r.data.error || '')) fail(`"maria" matches two accounts: refused, never guessed: ${r.status} ${JSON.stringify(r.data)}`);
r = await post(setpw, { mode: 'forgot', username: 'maria', email: 'x@example.com', newPassword: 'new-password-9' });
if (r.status !== 409 || r.data.code !== 'AMBIGUOUS_USERNAME') fail(`Forgot password for an ambiguous username is refused too: ${r.status} ${JSON.stringify(r.data)}`);
// 3. a username is taken in any capitals, and a retired one stays retired in any capitals
if (!(await u.usernameTaken(env.DB, 'JSmith'))) fail('JSmith should count as taken while jsmith exists');
if (await u.usernameTaken(env.DB, 'jsmith', sql.prepare(`SELECT id FROM users WHERE username = 'jsmith'`).get().id)) fail('a change of capitals only is the account\'s own to make');
if (!(await u.isUsernameTombstoned(env.DB, 'RETIRED1'))) fail('a retired username should stay retired in other capitals');
// the endpoints that make accounts use those checks
const fs = await import('node:fs');
for (const f of ['functions/api/register.js', 'functions/api/create-user.js', 'functions/api/update-user.js']) {
    const src = fs.readFileSync(new URL(f, ROOT), 'utf8');
    if (!/usernameTaken\(/.test(src) || /SELECT id FROM users WHERE username = \?/.test(src)) fail(`${f} should check usernameTaken (any capitals), not an exact match`);
}

if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Usernames match in any capitals; a case-only duplicate is refused unless typed exactly; taken and retired names hold in any capitals.');

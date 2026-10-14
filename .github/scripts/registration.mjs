// Registering on the Portal: the password rule, the registration landing in Master Control → Registrations,
// and signing in with it once an admin approves. The rule used to be letters and digits only, which refused
// any password with a symbol in it — the registration was never made, so it never appeared in Registrations
// and a trainee got in only by editing their password. Also checks the claim-account feature is gone.
// Run: node .github/scripts/registration.mjs   (from the repository root; Node 22.13+)
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';

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
const register = await import(new URL('functions/api/register.js', ROOT).href);
const login = await import(new URL('functions/api/login.js', ROOT).href);

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, email TEXT, user_type TEXT, batch_id TEXT, username TEXT UNIQUE, password TEXT, status TEXT, training_start_date TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
    CREATE TABLE activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_username TEXT, actor_batch TEXT, action TEXT, details TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE deleted_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, user_type TEXT, batch_id TEXT, email TEXT, full_name TEXT, deleted_by TEXT, deleted_at TEXT NOT NULL);`);
const env = { DB: d1(sql), SESSION_SECRET: 'ci-secret', MASTER_ADMIN_PASSWORD: 'ci-master-pass' };
const post = async (mod, body) => { const r = await mod.onRequestPost({ request: new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }), env }); return { status: r.status, cookie: r.headers.get('set-cookie') || '', data: await r.json().catch(() => ({})) }; };
const signUp = (over) => Object.assign({ firstName: 'Nia', lastName: 'Newbie', email: 'nia@example.com', userType: 'Trainee', username: 'nia', password: 'Tr@ining2026!', trainingStartDate: '2026-10-05' }, over);

// 1. a password with symbols in it is accepted, and the registration is there to approve
let r = await post(register, signUp());
if (r.status !== 200 || !r.data.success) fail(`a password with symbols in it was refused: ${r.status} ${JSON.stringify(r.data)}`);
const row = sql.prepare("SELECT * FROM users WHERE username = 'nia'").get();
if (!row) fail('the registration was not written');
else if (row.status !== 'Pending') fail(`a new registration should wait for approval, not be ${row.status}`);
else if (!/^pbkdf2:/.test(row.password)) fail('the password was not hashed');

// 2. the same password signs in, once an admin approves — no password edit in between
sql.prepare("UPDATE users SET status = 'Approved' WHERE username = 'nia'").run();
r = await post(login, { portalMode: 'Trainee', username: 'nia', password: signUp().password });
if (r.status !== 200 || !/lsh_session=/.test(r.cookie)) fail(`the password just registered with doesn't sign in: ${r.status} ${JSON.stringify(r.data)}`);
r = await post(login, { portalMode: 'Trainee', username: 'nia', password: 'Tr@ining2026' });
if (r.status === 200 || r.cookie) fail('a wrong password signed in');

// 3. eight characters is the only rule, and it is the same one the registration page applies
for (const [pw, ok] of [['abcdefgh', true], ['12345678', true], ['!@#$%^&*()', true], ['pass phrase with spaces', true], ['Short1', false], ['', false]]) {
    const res = await post(register, signUp({ username: 'u' + Math.random().toString(36).slice(2, 8), email: 'u@example.com', password: pw }));
    const accepted = res.status === 200;
    if (accepted !== ok) fail(`${JSON.stringify(pw)} should be ${ok ? 'accepted' : 'refused'}: ${res.status} ${JSON.stringify(res.data)}`);
}
{
    const js = readFileSync(new URL('portal.js', ROOT), 'utf8');
    const at = js.indexOf('function validateRegPassword(');
    if (at < 0) fail('validateRegPassword is gone from portal.js');
    else {
        let i = js.indexOf('{', at), depth = 0;
        for (; i < js.length; i++) { if (js[i] === '{') depth++; else if (js[i] === '}' && --depth === 0) break; }
        const validate = new Function(`${js.slice(at, i + 1)}\nreturn validateRegPassword;`)();
        for (const [pw, ok] of [['Tr@ining2026!', true], ['!@#$%^&*()', true], ['Short1', false]]) {
            if (!validate(pw) !== ok) fail(`the registration page and the server disagree about ${JSON.stringify(pw)}`);
        }
    }
}

// 4. the claim-account feature is gone: there is no page, no endpoint, and nothing points at one
for (const f of ['claim.html', 'functions/api/claim.js', 'functions/api/import-registrations.js']) {
    if (existsSync(new URL(f, ROOT))) fail(`${f} is back: the claim-account feature was removed`);
}
for (const f of ['trainee-login.html', 'functions/api/login.js', 'app.js', 'portal.js']) {
    const t = readFileSync(new URL(f, ROOT), 'utf8');
    if (/claim\.html|\/api\/claim\b|CLAIM_REQUIRED|unclaimed:/.test(t)) fail(`${f} still refers to the claim-account feature`);
}

if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Registration test passed (any password of 8+ characters, the registration waits in Registrations, the same password signs in, and the claim-account feature is gone).');

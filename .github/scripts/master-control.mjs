// Master Control is the Master Account's: a trainer's own admin account opens everything else, and types the LSHADMIN123
// password once per sign-in (/api/master-unlock) to open Master Control. Checks: a trainer's admin session is refused by a
// Master Control API (MASTER_REQUIRED) and accepted after unlocking; a wrong password is refused and a missing secret says so;
// LSHADMIN123 itself needs no unlock; the cookie is tied to that admin and that sign-in.
// Run: node --no-warnings .github/scripts/master-control.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-'));
const put = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return pathToFileURL(p).href; };
const utilsUrl = put('_utils.mjs', fs.readFileSync('functions/_utils.js', 'utf8'));
const load = (name, file) => import(put(name, fs.readFileSync(file, 'utf8').replace("'../_utils.js'", `'${utilsUrl}'`)));
const unlock = await load('master-unlock.mjs', 'functions/api/master-unlock.js');
const logs = await load('activity-logs.mjs', 'functions/api/activity-logs.js');
const u = await import(utilsUrl);

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id TEXT, username TEXT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, email TEXT, status TEXT, user_type TEXT, batch_id TEXT, created_at TEXT);
CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER);
CREATE TABLE activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_username TEXT, actor_batch TEXT, action TEXT, details TEXT, timestamp TEXT DEFAULT (datetime('now')));
INSERT INTO site_state VALUES (1, 0, NULL, 0);
INSERT INTO users VALUES ('1','ann','Ann',NULL,'Lee',NULL,'a@x','Approved','Trainee','B1',NULL), ('2','matt','Matt',NULL,'Gan',NULL,'m@x','Approved','Admin','B1',NULL);
INSERT INTO heartbeats VALUES ('ann','Ann Lee','B1','Trainee',NULL,datetime('now')), ('matt','Matt Gan','B1','Admin',NULL,datetime('now'));`);
const stmt = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const env = { DB: { prepare: stmt }, TRAINING_DB: { prepare: stmt }, SESSION_SECRET: 'test-secret', MASTER_ADMIN_PASSWORD: 'master-pw' };

const failures = [];
const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) failures.push(m); };

const sessionFor = async (username, userType) => await u.createSessionToken({ username, userType, fullName: username, batchId: 'B1' }, env.SESSION_SECRET);
const req = (cookies, body) => new Request('https://p/api/x', { method: body === undefined ? 'GET' : 'POST', headers: { cookie: cookies, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const read = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})), cookie: res.headers.get('set-cookie') || '' });

const matt = 'lsh_session=' + await sessionFor('matt', 'Admin');
const master = 'lsh_session=' + await u.createSessionToken({ username: 'LSHADMIN123', userType: 'Admin', fullName: 'System Administrator', batchId: 'MASTER-ADMIN' }, env.SESSION_SECRET);
sql.exec(`INSERT INTO users VALUES ('3','LSHADMIN123','System',NULL,'Administrator',NULL,NULL,'Approved','Admin','MASTER-ADMIN',NULL)`);
sql.exec(`INSERT INTO heartbeats VALUES ('LSHADMIN123','System Administrator','MASTER-ADMIN','Admin',NULL,datetime('now'))`);

// a trainee reaches neither
let r = await read(await unlock.onRequestGet({ request: req('lsh_session=' + await sessionFor('ann', 'Trainee')), env }));
check(r.status === 403, 'a trainee cannot unlock Master Control');

// a trainer's own admin account: Master Control is refused until the password is typed
r = await read(await logs.onRequestGet({ request: req(matt), env }));
check(r.status === 403 && r.body.code === 'MASTER_REQUIRED', `an admin without the master password is refused by a Master Control API: ${JSON.stringify(r.body)}`);
r = await read(await unlock.onRequestGet({ request: req(matt), env }));
check(r.body.unlocked === false, 'and /api/master-unlock says they are locked');
r = await read(await unlock.onRequestPost({ request: req(matt, { password: 'nope' }), env }));
check(r.status === 401, 'a wrong master password is refused');
r = await read(await unlock.onRequestPost({ request: req(matt, { password: 'master-pw' }), env }));
check(r.status === 200 && /lsh_master=/.test(r.cookie), 'the right master password returns the lsh_master cookie');
const mcookie = r.cookie.split(';')[0];
r = await read(await logs.onRequestGet({ request: req(matt + '; ' + mcookie), env }));
check(r.status === 200, `with the cookie, the same admin opens Master Control: ${r.status}`);

// the cookie belongs to that admin and that sign-in
const other = 'lsh_session=' + await u.createSessionToken({ username: 'boss2', userType: 'Admin', fullName: 'Boss', batchId: 'B1' }, env.SESSION_SECRET);
sql.exec(`INSERT INTO users VALUES ('4','boss2','Boss',NULL,'Two',NULL,NULL,'Approved','Admin','B1',NULL)`);
sql.exec(`INSERT INTO heartbeats VALUES ('boss2','Boss Two','B1','Admin',NULL,datetime('now'))`);
r = await read(await logs.onRequestGet({ request: req(other + '; ' + mcookie), env }));
check(r.status === 403, "another admin cannot use someone else's unlock");
await new Promise(res => setTimeout(res, 1100));   // a new sign-in has a later iat
const mattAgain = 'lsh_session=' + await sessionFor('matt', 'Admin');
r = await read(await logs.onRequestGet({ request: req(mattAgain + '; ' + mcookie), env }));
check(r.status === 403, 'a new sign-in has to type the master password again');

// the Master Account itself needs no unlock
r = await read(await logs.onRequestGet({ request: req(master), env }));
check(r.status === 200, 'LSHADMIN123 opens Master Control with no unlock');

// no secret on the site: say so
r = await read(await unlock.onRequestPost({ request: req(matt, { password: 'x' }), env: { ...env, MASTER_ADMIN_PASSWORD: '' } }));
check(r.status === 503 && r.body.code === 'MASTER_NOT_SET', 'with no MASTER_ADMIN_PASSWORD, the unlock says it is not set up');

if (failures.length) { console.log(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nMaster Control test passed (a trainer admin types the LSHADMIN123 password once per sign-in; the master account needs no unlock).');

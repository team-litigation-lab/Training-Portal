// One sign-in for admins: a trainer's own admin account (registered as Admin / Trainer and approved) opens everything,
// Master Control included — no second password anywhere. Only the site-wide Lock stays with the master account
// (LSHADMIN123, whose password is the MASTER_ADMIN_PASSWORD secret; it has no row in the users table).
// Checks: a trainer admin opens Master Control's APIs; a trainee cannot; only the master account may LOCK; UNLOCK takes the
// master password (and says so when the secret is missing).
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
const users = await load('users.mjs', 'functions/api/users.js');
const logs = await load('activity-logs.mjs', 'functions/api/activity-logs.js');
const state = await load('site-state.mjs', 'functions/api/site-state.js');
const u = await import(utilsUrl);

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id TEXT, username TEXT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, email TEXT, status TEXT, user_type TEXT, batch_id TEXT, training_start_date TEXT, created_at TEXT);
CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER, updated_at TEXT);
CREATE TABLE activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_username TEXT, actor_batch TEXT, action TEXT, details TEXT, timestamp TEXT DEFAULT (datetime('now')));
INSERT INTO site_state VALUES (1, 0, NULL, 0, NULL);
INSERT INTO users VALUES ('1','ann','Ann',NULL,'Lee',NULL,'a@x','Approved','Trainee','B1',NULL,NULL),
 ('2','matt','Matt',NULL,'Gan',NULL,'m@x','Approved','Admin','B1',NULL,NULL),
 ('3','LSHADMIN123','System',NULL,'Administrator',NULL,NULL,'Approved','Admin','MASTER-ADMIN',NULL,NULL);
INSERT INTO heartbeats VALUES ('ann','Ann Lee','B1','Trainee',NULL,datetime('now')), ('matt','Matt Gan','B1','Admin',NULL,datetime('now')),
 ('LSHADMIN123','System Administrator','MASTER-ADMIN','Admin',NULL,datetime('now'));`);
const stmt = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const env = { DB: { prepare: stmt }, TRAINING_DB: { prepare: stmt }, SESSION_SECRET: 'test-secret', MASTER_ADMIN_PASSWORD: 'master-pw' };

const failures = [];
const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) failures.push(m); };
const cookieFor = async (username, userType, batchId = 'B1') => 'lsh_session=' + await u.createSessionToken({ username, userType, fullName: username, batchId }, env.SESSION_SECRET);
const req = (cookie, body) => new Request('https://p/api/x', { method: body === undefined ? 'GET' : 'POST', headers: { cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const read = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });

const trainer = await cookieFor('matt', 'Admin');
const master = await cookieFor('LSHADMIN123', 'Admin', 'MASTER-ADMIN');
const trainee = await cookieFor('ann', 'Trainee');

// a trainer's own admin account opens Master Control, with no second password
let r = await read(await users.onRequestGet({ request: req(trainer), env }));
check(r.status === 200, `a trainer's admin account opens Users (no master password): ${r.status}`);
r = await read(await logs.onRequestGet({ request: req(trainer), env }));
check(r.status === 200, `and the Activity Logs: ${r.status}`);

// a trainee reaches neither
r = await read(await users.onRequestGet({ request: req(trainee), env }));
check(r.status === 403, 'a trainee cannot open Master Control');

// the site-wide Lock stays the master account's; Pause is any admin's
r = await read(await state.onRequestPost({ request: req(trainer, { action: 'LOCK', username: 'LSHADMIN123', password: 'master-pw' }), env }));
check(r.status === 403, `only the master account may lock the site: ${r.status}`);
r = await read(await state.onRequestPost({ request: req(trainer, { action: 'PAUSE' }), env }));
check(r.status === 200, `a trainer admin may pause: ${r.status}`);
r = await read(await state.onRequestPost({ request: req(master, { action: 'LOCK', username: 'LSHADMIN123', password: 'master-pw' }), env }));
check(r.status === 200, `the master account locks the site: ${r.status}`);

// unlocking takes the master password, and says so when the site has none
r = await read(await state.onRequestPost({ request: req('', { action: 'UNLOCK', username: 'LSHADMIN123', password: 'nope' }), env }));
check(r.status === 401, 'a wrong master password does not unlock');
r = await read(await state.onRequestPost({ request: req('', { action: 'UNLOCK', username: 'LSHADMIN123', password: 'master-pw' }), env }));
check(r.status === 200, `the master password unlocks: ${r.status}`);

if (failures.length) { console.log(`\n${failures.length} failure(s)`); process.exit(1); }
console.log('\nMaster Control test passed (a trainer\'s own admin account opens it with no second password; only the site lock is the master account\'s).');

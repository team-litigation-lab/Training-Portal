// Approving an Admin / Trainer registration is the Master Account's, not any trainer's.
//
// Four trainers each have their own admin sign-in, and any of them may set an account up
// (functions/api/create-user.js). But the approval that actually turns a login on is what grants access,
// so for an Admin / Trainer account it stays with the Master Account: otherwise one trainer login could
// create a second admin account and approve it itself, with nobody else involved.
// A trainee's registration is unchanged — any trainer approves it.
// Checks: a trainer may create an admin account but not approve or reject it; the Master Account may;
// a trainer still approves a trainee, and that issues the Batch ID.
// Run: node --no-warnings .github/scripts/admin-approval.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aa-'));
const put = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return pathToFileURL(p).href; };
const utilsUrl = put('_utils.mjs', fs.readFileSync('functions/_utils.js', 'utf8'));
const load = (name, file) => import(put(name, fs.readFileSync(file, 'utf8').replace("'../_utils.js'", `'${utilsUrl}'`)));
const status = await load('update-status.mjs', 'functions/api/update-status.js');
const create = await load('create-user.mjs', 'functions/api/create-user.js');
const u = await import(utilsUrl);

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, email TEXT, status TEXT, user_type TEXT, batch_id TEXT, training_start_date TEXT, password TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
CREATE TABLE deleted_users (username TEXT, user_type TEXT, batch_id TEXT, email TEXT, full_name TEXT, deleted_by TEXT, deleted_at TEXT);
CREATE TABLE activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_username TEXT, actor_batch TEXT, action TEXT, details TEXT, timestamp TEXT DEFAULT (datetime('now')));
CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER, updated_at TEXT);
INSERT INTO site_state VALUES (1, 0, NULL, 0, NULL);
INSERT INTO users (username, first_name, last_name, email, status, user_type, batch_id) VALUES
 ('matt','Matt','Gan','m@x','Approved','Admin','B1'),
 ('pendingadmin','Pat','Cruz','p@x','Pending','Admin',NULL),
 ('pendingtrainee','Nia','Reyes','n@x','Pending','Trainee',NULL);
INSERT INTO heartbeats VALUES ('matt','Matt Gan','B1','Admin',NULL,datetime('now')),
 ('LSHADMIN123','System Administrator','MASTER-ADMIN','Admin',NULL,datetime('now'));`);
const stmt = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const env = { DB: { prepare: stmt }, TRAINING_DB: { prepare: stmt }, SESSION_SECRET: 'test-secret', MASTER_ADMIN_PASSWORD: 'master-pw' };

const failures = [];
const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) failures.push(m); };
const cookieFor = async (username, userType, batchId = 'B1') => 'lsh_session=' + await u.createSessionToken({ username, userType, fullName: username, batchId }, env.SESSION_SECRET);
const req = (cookie, body) => new Request('https://p/api/x', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const read = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });
const idOf = (username) => sql.prepare(`SELECT id FROM users WHERE username = ?`).get(username).id;
const rowOf = (username) => sql.prepare(`SELECT status, batch_id FROM users WHERE username = ?`).get(username);

const trainer = await cookieFor('matt', 'Admin');
const master = await cookieFor('LSHADMIN123', 'Admin', 'MASTER-ADMIN');

// A trainer may set an admin account up — that part is theirs.
let r = await read(await create.onRequestPost({
    request: req(trainer, { userType: 'Admin', firstName: 'Dana', lastName: 'Ortiz', email: 'dana.ortiz@example.com', username: 'danao', password: 'a-good-password!' }), env
}));
check(r.status === 200 && r.body.success, `a trainer may create an Admin / Trainer account: ${r.status} ${r.body.error || ''}`);
check(rowOf('danao') && rowOf('danao').status === 'Pending', 'and it waits for approval, with no Batch ID');
check(rowOf('danao') && !rowOf('danao').batch_id, 'no Batch ID until approved');

// ...but not approve it, including the one it just made itself.
r = await read(await status.onRequestPost({ request: req(trainer, { userId: idOf('danao'), newStatus: 'Approved' }), env }));
check(r.status === 403, `a trainer cannot approve the admin account it created: ${r.status}`);
check(rowOf('danao').status === 'Pending', 'the account is still Pending after the refused approval');

r = await read(await status.onRequestPost({ request: req(trainer, { userId: idOf('pendingadmin'), newStatus: 'Approved' }), env }));
check(r.status === 403, `nor another Admin / Trainer registration: ${r.status}`);
r = await read(await status.onRequestPost({ request: req(trainer, { userId: idOf('pendingadmin'), newStatus: 'Rejected' }), env }));
check(r.status === 403, `nor reject one: ${r.status}`);
check(rowOf('pendingadmin').status === 'Pending', 'that registration is untouched');

// The Master Account may, and the approval issues the Batch ID.
r = await read(await status.onRequestPost({ request: req(master, { userId: idOf('pendingadmin'), newStatus: 'Approved' }), env }));
check(r.status === 200 && r.body.success, `the Master Account approves an Admin / Trainer registration: ${r.status} ${r.body.error || ''}`);
check(rowOf('pendingadmin').status === 'Approved', 'the admin account is Approved');
check(/^B\d{6}$/.test(rowOf('pendingadmin').batch_id || ''), `and has a Batch ID: ${rowOf('pendingadmin').batch_id}`);

// A trainee's registration is unchanged: any trainer approves it.
r = await read(await status.onRequestPost({ request: req(trainer, { userId: idOf('pendingtrainee'), newStatus: 'Approved' }), env }));
check(r.status === 200 && r.body.success, `a trainer still approves a trainee: ${r.status} ${r.body.error || ''}`);
check(rowOf('pendingtrainee').status === 'Approved', 'the trainee is Approved');
check(/^B\d{6}$/.test(rowOf('pendingtrainee').batch_id || ''), `with a Batch ID: ${rowOf('pendingtrainee').batch_id}`);

fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length) { console.error(`\n${failures.length} check(s) failed.`); process.exit(1); }
console.log('\nAll good.');

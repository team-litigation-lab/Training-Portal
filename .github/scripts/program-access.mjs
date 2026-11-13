// 🔑 Program Access: besides Grant and Revoke, an admin can ⏸ Suspend and ▶ Restore one trainee's access to one program,
// and 🧹 Clear a request left by an account that no longer exists (it can be neither approved nor denied).
// Checks: Suspend works only on open access and keeps whether it was Passed; Restore puts back exactly that; a trainee can't
// suspend, restore or clear, and can't re-request a suspended program; /api/launch refuses a suspended program and says so.
// Run: node --no-warnings .github/scripts/program-access.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-'));
const put = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return pathToFileURL(p).href; };
put('_programs.js', fs.readFileSync('functions/_programs.js', 'utf8'));   // (_ft-block.js and _purge.js read the program list from beside them)
const utilsUrl = put('_utils.mjs', fs.readFileSync('functions/_utils.js', 'utf8'));
const ftBlockUrl = put('_ft-block.mjs', fs.readFileSync('functions/_ft-block.js', 'utf8').replace("'./_utils.js'", `'${utilsUrl}'`));
const load = (name, file) => import(put(name, fs.readFileSync(file, 'utf8').replace("'../_utils.js'", `'${utilsUrl}'`).replace("'../_ft-block.js'", `'${ftBlockUrl}'`)));
const topics = await load('topics.mjs', 'functions/api/topics.js');
const launch = await load('launch.mjs', 'functions/api/launch.js');
const u = await import(utilsUrl);

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id TEXT, username TEXT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, email TEXT, status TEXT, user_type TEXT, batch_id TEXT, training_start_date TEXT, created_at TEXT, password TEXT);
CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER, updated_at TEXT);
CREATE TABLE activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_username TEXT, actor_batch TEXT, action TEXT, details TEXT, timestamp TEXT DEFAULT (datetime('now')));
CREATE TABLE topics (key TEXT PRIMARY KEY, name TEXT, sort_order INTEGER);
CREATE TABLE trainee_topic_access (trainee_username TEXT, topic_key TEXT, status TEXT, requested_at TEXT, decided_at TEXT, decided_by TEXT, PRIMARY KEY (trainee_username, topic_key));
INSERT INTO site_state VALUES (1, 0, NULL, 0, NULL);
INSERT INTO topics VALUES ('STANDARD TRAINING','Standard Training',1), ('CM TRAINING','CM Training',2), ('PROPERTY DAMAGE','Property Damage',3);
INSERT INTO users VALUES ('1','ann','Ann',NULL,'Lee',NULL,'a@x','Approved','Trainee','B102826',NULL,NULL,NULL),
 ('2','matt','Matt',NULL,'Gan',NULL,'m@x','Approved','Admin','B1',NULL,NULL,NULL);
INSERT INTO heartbeats VALUES ('ann','Ann Lee','B102826','Trainee',NULL,datetime('now')), ('matt','Matt Gan','B1','Admin',NULL,datetime('now'));
INSERT INTO trainee_topic_access VALUES ('ann','STANDARD TRAINING','Approved',datetime('now'),datetime('now'),'matt'),
 ('ann','CM TRAINING','Passed',datetime('now'),datetime('now'),'matt'),
 ('ann','PROPERTY DAMAGE','Pending',datetime('now'),NULL,NULL),
 ('gone','CM TRAINING','Pending',datetime('now'),NULL,NULL);`);
const stmt = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const env = { DB: { prepare: stmt }, TRAINING_DB: { prepare: stmt }, SESSION_SECRET: 'test-secret', PORTAL_SSO_SECRET: 'sso-secret' };

const failures = [];
const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) failures.push(m); };
const cookieFor = async (username, userType, batchId = 'B1') => 'lsh_session=' + await u.createSessionToken({ username, userType, fullName: username, batchId }, env.SESSION_SECRET);
const post = async (cookie, body) => { const r = await topics.onRequestPost({ request: new Request('https://p/api/topics', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const st = (who, key) => (sql.prepare(`SELECT status FROM trainee_topic_access WHERE trainee_username = ? AND topic_key = ?`).get(who, key) || {}).status;
const admin = await cookieFor('matt', 'Admin');
const ann = await cookieFor('ann', 'Trainee', 'B102826');
const open = async (cookie, program) => { const r = await launch.onRequestGet({ request: new Request('https://p/api/launch?program=' + encodeURIComponent(program), { headers: { cookie } }), env }); return { status: r.status, text: r.status === 302 ? r.headers.get('location') : await r.text() }; };

// Suspend: open access only; Approved → Suspended, Passed → Suspended-Passed
let r = await post(admin, { action: 'SUSPEND', topicKey: 'STANDARD TRAINING', traineeUsername: 'ann' });
check(r.status === 200 && st('ann', 'STANDARD TRAINING') === 'Suspended', `an admin suspends Approved access (${r.status} ${st('ann', 'STANDARD TRAINING')})`);
r = await post(admin, { action: 'SUSPEND', topicKey: 'CM TRAINING', traineeUsername: 'ann' });
check(r.status === 200 && st('ann', 'CM TRAINING') === 'Suspended-Passed', `suspending a passed program remembers it was passed (${st('ann', 'CM TRAINING')})`);
r = await post(admin, { action: 'SUSPEND', topicKey: 'PROPERTY DAMAGE', traineeUsername: 'ann' });
check(r.status === 409 && st('ann', 'PROPERTY DAMAGE') === 'Pending', `a pending request can't be suspended (${r.status})`);
// a trainee can't touch it, nor ask for a suspended program again
r = await post(ann, { action: 'RESTORE', topicKey: 'STANDARD TRAINING', traineeUsername: 'ann' });
check(r.status === 403 && st('ann', 'STANDARD TRAINING') === 'Suspended', `a trainee can't restore their own access (${r.status})`);
r = await post(ann, { action: 'REQUEST_ACCESS', topicKey: 'STANDARD TRAINING' });
check(st('ann', 'STANDARD TRAINING') === 'Suspended', `re-requesting a suspended program leaves it suspended (${st('ann', 'STANDARD TRAINING')})`);
// the launch refuses it, and says why
const l = await open(ann, 'STANDARD TRAINING');
check(l.status === 403 && /suspended/i.test(l.text), `/api/launch refuses a suspended program with "Access suspended" (${l.status})`);
// Restore puts back exactly what was there
r = await post(admin, { action: 'RESTORE', topicKey: 'STANDARD TRAINING', traineeUsername: 'ann' });
check(r.status === 200 && st('ann', 'STANDARD TRAINING') === 'Approved', `restore gives back Approved (${st('ann', 'STANDARD TRAINING')})`);
r = await post(admin, { action: 'RESTORE', topicKey: 'CM TRAINING', traineeUsername: 'ann' });
check(r.status === 200 && st('ann', 'CM TRAINING') === 'Passed', `restore gives back Passed (${st('ann', 'CM TRAINING')})`);
r = await post(admin, { action: 'RESTORE', topicKey: 'CM TRAINING', traineeUsername: 'ann' });
check(r.status === 409, `restoring access that isn't suspended is refused (${r.status})`);
const l2 = await open(ann, 'STANDARD TRAINING');
check(l2.status === 302 && /ticket=/.test(l2.text), `a restored program opens again (${l2.status})`);
// Clear: a request from an account that's gone (approve/deny refuse it), admins only, pending rows only
r = await post(admin, { action: 'APPROVE', topicKey: 'CM TRAINING', traineeUsername: 'gone' });
check(r.status === 404, `approving a request whose account is gone is refused (${r.status})`);
r = await post(ann, { action: 'CLEAR', topicKey: 'CM TRAINING', traineeUsername: 'gone' });
check(r.status === 403 && st('gone', 'CM TRAINING') === 'Pending', `a trainee can't clear a request (${r.status})`);
r = await post(admin, { action: 'CLEAR', topicKey: 'CM TRAINING', traineeUsername: 'gone' });
check(r.status === 200 && st('gone', 'CM TRAINING') === undefined, `an admin clears the orphaned request (${r.status})`);
r = await post(admin, { action: 'CLEAR', topicKey: 'CM TRAINING', traineeUsername: 'ann' });
check(st('ann', 'CM TRAINING') === 'Passed', `clear never removes access already given (${st('ann', 'CM TRAINING')})`);
const logged = sql.prepare(`SELECT action FROM activity_log`).all().map(x => x.action);
check(['TOPIC_ACCESS_SUSPENDED', 'TOPIC_ACCESS_RESTORED', 'TOPIC_ACCESS_CLEARED'].every(a => logged.includes(a)), `suspend, restore and clear are logged (${[...new Set(logged)].join(', ')})`);

if (failures.length) { console.error(`\n${failures.length} check(s) failed.`); process.exit(1); }
console.log('\nProgram access checks passed.');

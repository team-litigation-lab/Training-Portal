// ⏳ The new-registration popup's list (functions/api/pending-registrations.js, read through /api/live?pending=1).
// Checks: trainers only (a trainee and a signed-out browser get nothing); a trainer sees every pending registration,
// a trainee's and an Admin / Trainer's (any trainer decides either); approved and
// rejected accounts are never listed; /api/live carries the list only when asked (?pending=1).
// Run: node --no-warnings .github/scripts/pending-registrations.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-'));
const put = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return pathToFileURL(p).href; };
const utilsUrl = put('_utils.mjs', fs.readFileSync('functions/_utils.js', 'utf8'));
const fix = (text) => text.replace(/'\.\.\/_utils\.js'/g, `'${utilsUrl}'`);
const pendingUrl = put('pending-registrations.js', fix(fs.readFileSync('functions/api/pending-registrations.js', 'utf8')));
// live.js imports its siblings by relative path: give it stand-ins for the ones this test isn't about.
put('site-state.js', `export async function onRequestGet(){ return new Response(JSON.stringify({ locked: false }), { status: 200 }); }`);
put('alert.js', `export async function onRequestGet(){ return new Response(JSON.stringify({ active: false }), { status: 200 }); }`);
put('pings.js', `export async function onRequestGet(){ return new Response(JSON.stringify({ success: true, pings: [] }), { status: 200 }); }`);
const live = await import(put('live.js', fix(fs.readFileSync('functions/api/live.js', 'utf8'))));
const pending = await import(pendingUrl);
const u = await import(utilsUrl);

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, email TEXT, status TEXT, user_type TEXT, batch_id TEXT, training_start_date TEXT, password TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER, updated_at TEXT);
INSERT INTO site_state VALUES (1, 0, NULL, 0, NULL);
INSERT INTO users (username, first_name, last_name, email, status, user_type, batch_id, training_start_date) VALUES
 ('matt','Matt','Gan','m@x','Approved','Admin',NULL,NULL),
 ('ana','Ana','Cruz','a@x','Approved','Trainee','B110126',NULL),
 ('nia','Nia','Reyes','n@x','Pending','Trainee',NULL,'2026-11-09'),
 ('pat','Pat','Lim','p@x','Pending','Admin',NULL,NULL),
 ('rex','Rex','Tan','r@x','Rejected','Trainee',NULL,NULL);
INSERT INTO heartbeats VALUES ('matt','Matt Gan',NULL,'Admin',NULL,datetime('now')),
 ('ana','Ana Cruz','B110126','Trainee',NULL,datetime('now')),
 ('LSHADMIN123','System Administrator','MASTER-ADMIN','Admin',NULL,datetime('now'));`);
const stmt = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const env = { DB: { prepare: stmt }, SESSION_SECRET: 'test-secret' };

const failures = [];
const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) failures.push(m); };
const cookieFor = async (username, userType, batchId = null) => 'lsh_session=' + await u.createSessionToken({ username, userType, fullName: username, batchId }, env.SESSION_SECRET);
const get = (url, cookie) => new Request('https://p' + url, { headers: cookie ? { cookie } : {} });
const read = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });
const names = (list) => (list || []).map(x => x.fullName).sort().join(', ');

const trainer = await cookieFor('matt', 'Admin');
const master = await cookieFor('LSHADMIN123', 'Admin', 'MASTER-ADMIN');
const trainee = await cookieFor('ana', 'Trainee', 'B110126');

let r = await read(await pending.onRequestGet({ request: get('/api/pending-registrations', trainer), env }));
check(r.status === 200 && names(r.body.pending) === 'Nia Reyes, Pat Lim', `a trainer sees the pending trainee and the pending admin: ${names(r.body.pending)}`);
const nia = (r.body.pending || []).find(x => x.fullName === 'Nia Reyes') || {};
check(nia.userType === 'Trainee' && nia.email === 'n@x' && nia.trainingStartDate === '2026-11-09' && nia.id, 'with what the popup shows: type, email, start date, id');
check(!('password' in nia) && !('username' in nia), 'and nothing it does not need (no password hash, no username)');

r = await read(await pending.onRequestGet({ request: get('/api/pending-registrations', master), env }));
check(r.status === 200 && names(r.body.pending) === 'Nia Reyes, Pat Lim', `the Master Account sees both: ${names(r.body.pending)}`);

r = await read(await pending.onRequestGet({ request: get('/api/pending-registrations', trainee), env }));
check(r.status === 403, `a trainee gets nothing: ${r.status}`);
r = await read(await pending.onRequestGet({ request: get('/api/pending-registrations'), env }));
check(r.status === 401, `a signed-out browser gets nothing: ${r.status}`);

r = await read(await live.onRequestGet({ request: get('/api/live?pings=1&pending=1', trainer), env }));
check(r.status === 200 && names(r.body.pending) === 'Nia Reyes, Pat Lim', `/api/live carries it for a trainer who asks: ${names(r.body.pending)}`);
r = await read(await live.onRequestGet({ request: get('/api/live?pings=1', trainer), env }));
check(r.status === 200 && r.body.pending === null, '/api/live leaves it out when not asked');
r = await read(await live.onRequestGet({ request: get('/api/live?pings=1&pending=1', trainee), env }));
check(r.status === 200 && r.body.pending === null && r.body.success, `/api/live gives a trainee who asks none, and still works: ${JSON.stringify(r.body.pending)}`);

sql.exec(`UPDATE users SET status = 'Approved' WHERE username IN ('nia', 'pat')`);
r = await read(await pending.onRequestGet({ request: get('/api/pending-registrations', trainer), env }));
check(r.status === 200 && Array.isArray(r.body.pending) && r.body.pending.length === 0, 'once approved (here or in Master Control), it leaves the list');

if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
console.log('\nAll pending-registration checks passed.');

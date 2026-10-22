// Revoking an account takes their whole record with it — and only after a backup.
// Checks: nothing is deleted before the records are safe (no Drive configured → the
// first call hands them back and deletes nothing; the second, with backupSaved,
// deletes); their submissions, simulator results, calendaring work, evaluations,
// program access and the course's own progress and trainer feedback all go; scores
// are not kept behind; the activity log and the username tombstone stay; and another
// trainee in the same batch is left alone.
// Run: node --no-warnings .github/scripts/revoke-purge.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-'));
const put = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return pathToFileURL(p).href; };
const utilsUrl = put('_utils.mjs', fs.readFileSync('functions/_utils.js', 'utf8'));
const driveUrl = put('_drive.mjs', fs.readFileSync('functions/_drive.js', 'utf8'));
const purgeUrl = put('_purge.mjs', fs.readFileSync('functions/_purge.js', 'utf8'));
const revoke = await import(put('revoke-user.mjs', fs.readFileSync('functions/api/revoke-user.js', 'utf8')
    .replace("'../_utils.js'", `'${utilsUrl}'`).replace("'../_drive.js'", `'${driveUrl}'`).replace("'../_purge.js'", `'${purgeUrl}'`)));
const u = await import(utilsUrl);

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, email TEXT, status TEXT, user_type TEXT, batch_id TEXT, training_start_date TEXT, password TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
CREATE TABLE deleted_users (username TEXT, user_type TEXT, batch_id TEXT, email TEXT, full_name TEXT, deleted_by TEXT, deleted_at TEXT);
CREATE TABLE activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_username TEXT, actor_batch TEXT, action TEXT, details TEXT, timestamp TEXT DEFAULT (datetime('now')));
CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER, updated_at TEXT);
CREATE TABLE submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, trainee_username TEXT, trainee_name TEXT, activity_title TEXT, status TEXT, score INTEGER, submitted_at TEXT);
CREATE TABLE simulator_results (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, full_name TEXT, simulator TEXT, scenario TEXT, score INTEGER, summary TEXT, created_at TEXT);
CREATE TABLE calsim_records (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, track TEXT, scenario TEXT, score INTEGER, updated_at TEXT);
CREATE TABLE gcal_drafts (username TEXT, track TEXT, data TEXT, updated_at TEXT);
CREATE TABLE gcal_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, track TEXT, status TEXT, score INTEGER, created_at TEXT);
CREATE TABLE trainee_topic_access (trainee_username TEXT, topic_key TEXT, status TEXT);
INSERT INTO site_state VALUES (1, 0, NULL, 0, NULL);
INSERT INTO users (username, first_name, last_name, email, status, user_type, batch_id) VALUES
 ('matt','Matt','Gan','m@x','Approved','Admin','B1'),
 ('ana','Ana','Reyes','a@x','Approved','Trainee','B101026'),
 ('ben','Ben','Cruz','b@x','Approved','Trainee','B101026');
INSERT INTO heartbeats VALUES ('ana','Ana Reyes','B101026','Trainee',NULL,datetime('now')),
 ('matt','Matt Gan','B1','Admin',NULL,datetime('now'));
INSERT INTO submissions (trainee_username, trainee_name, activity_title, status, score, submitted_at) VALUES
 ('ana','Ana Reyes','Day 1 activity','Graded',88,datetime('now')),
 ('ben','Ben Cruz','Day 1 activity','Graded',75,datetime('now'));
INSERT INTO simulator_results (username, full_name, simulator, scenario, score, summary, created_at) VALUES
 ('ana','Ana Reyes','Email Workspace','CM inbox',91,'ok',datetime('now')),
 (NULL,'ana reyes','Docket System','Harlow',70,'ok',datetime('now')),
 ('ben','Ben Cruz','Email Workspace','CM inbox',64,'ok',datetime('now'));
INSERT INTO calsim_records (username, track, scenario, score, updated_at) VALUES ('ana','cm','Litigation week',80,datetime('now'));
INSERT INTO gcal_drafts VALUES ('ana','cm','{}',datetime('now'));
INSERT INTO gcal_reviews (username, track, status, score, created_at) VALUES ('ana','cm','final',85,datetime('now'));
INSERT INTO trainee_topic_access VALUES ('ana','CM TRAINING','Approved'),('ben','CM TRAINING','Approved');`);

const stmt = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; },
    run: async () => { const r = sql.prepare(q).run(...a); return { meta: { changes: Number(r.changes || 0) } }; },
    first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };

// The course's own KV: Ana's progress and her trainer's feedback, and Ben's beside them.
const kvData = new Map([
    ['cm:trainee:t-ana', { id: 't-ana', name: 'Ana Reyes', batch: 'B101026', dayProgress: { 1: { done: true, score: 88 } }, lastActive: '2026-10-20T00:00:00Z' }],
    ['cm:feedback:t-ana', { days: { 1: { rating: 'Strong', status: 'sent' } } }],
    ['cm:trainee:t-ben', { id: 't-ben', name: 'Ben Cruz', batch: 'B101026', dayProgress: { 1: { done: true, score: 75 } } }]
]);
const kv = {
    list: async ({ prefix, cursor }) => ({ keys: [...kvData.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true, cursor: null }),
    get: async (k) => (kvData.has(k) ? kvData.get(k) : null),
    delete: async (k) => { kvData.delete(k); }
};
const env = { DB: { prepare: stmt }, TRAINING_DB: { prepare: stmt }, COURSE_KV: kv, SESSION_SECRET: 'test-secret' };

const failures = [];
const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) failures.push(m); };
const cookieFor = async (username, userType, batchId = 'B1') => 'lsh_session=' + await u.createSessionToken({ username, userType, fullName: username, batchId }, env.SESSION_SECRET);
const req = (cookie, body) => new Request('https://p/api/x', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const read = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });
const one = (q, ...a) => sql.prepare(q).get(...a);
const count = (q, ...a) => Number(one(q, ...a).n);
const idOf = (username) => one(`SELECT id FROM users WHERE username = ?`, username).id;

const trainer = await cookieFor('matt', 'Admin');

// 1. No Drive configured: the first call hands the records back and deletes nothing.
let r = await read(await revoke.onRequestPost({ request: req(trainer, { userId: idOf('ana') }), env }));
check(r.status === 200 && r.body.needsBackup, `with no Drive set up, revoking asks for the backup first: ${r.status} ${r.body.error || ''}`);
check(!!one(`SELECT id FROM users WHERE username = 'ana'`), 'the account is still there while the backup is unsaved');
check(count(`SELECT COUNT(*) n FROM submissions WHERE trainee_username = 'ana'`) === 1, 'and so is her work');
const rec = r.body.records || {};
check((rec.submissions || []).length === 1 && (rec.simulatorResults || []).length === 2, `the backup carries her submissions and both simulator results (${(rec.submissions || []).length}, ${(rec.simulatorResults || []).length})`);
check((rec.course || []).length === 1 && (rec.course[0].keys || []).length === 2, "and the course's own progress and trainer feedback");
check(!JSON.stringify(rec.course || []).includes('Ben Cruz'), "and nobody else's");

// 2. With the backup saved, everything of hers goes.
r = await read(await revoke.onRequestPost({ request: req(trainer, { userId: idOf('ana'), backupSaved: true }), env }));
check(r.status === 200 && r.body.success, `the second call does the deleting: ${r.status} ${r.body.error || ''}`);
check(!one(`SELECT id FROM users WHERE username = 'ana'`), 'the account is gone');
for (const [what, q] of [
    ['submissions', `SELECT COUNT(*) n FROM submissions WHERE trainee_username = 'ana'`],
    ['simulator results', `SELECT COUNT(*) n FROM simulator_results WHERE username = 'ana'`],
    ['simulator results filed under her typed name', `SELECT COUNT(*) n FROM simulator_results WHERE username IS NULL AND lower(full_name) = 'ana reyes'`],
    ['calendaring work', `SELECT COUNT(*) n FROM calsim_records WHERE username = 'ana'`],
    ['calendar drafts', `SELECT COUNT(*) n FROM gcal_drafts WHERE username = 'ana'`],
    ['calendar evaluations', `SELECT COUNT(*) n FROM gcal_reviews WHERE username = 'ana'`],
    ['program access', `SELECT COUNT(*) n FROM trainee_topic_access WHERE trainee_username = 'ana'`],
    ['presence', `SELECT COUNT(*) n FROM heartbeats WHERE username = 'ana'`]
]) check(count(q) === 0, `her ${what} are gone`);
check(!kvData.has('cm:trainee:t-ana') && !kvData.has('cm:feedback:t-ana'), "the course's own progress and trainer feedback are gone");

// 3. Scores are not kept behind, in any shape.
check(count(`SELECT COUNT(*) n FROM submissions WHERE trainee_name = 'Ana Reyes'`) === 0, 'no score row is kept under her name');
check(count(`SELECT COUNT(*) n FROM simulator_results WHERE full_name LIKE '%Ana%'`) === 0, 'and none anonymised behind her');

// 4. What stays: the audit trail, and the tombstone that retires the username.
check(count(`SELECT COUNT(*) n FROM activity_log WHERE action = 'revoke-user'`) >= 1, 'the revocation is in the activity log');
check(count(`SELECT COUNT(*) n FROM deleted_users WHERE username = 'ana'`) === 1, 'the username is tombstoned, so it cannot be taken again');

// 5. The rest of the batch is untouched.
check(!!one(`SELECT id FROM users WHERE username = 'ben'`), "the other trainee's account is untouched");
check(count(`SELECT COUNT(*) n FROM submissions WHERE trainee_username = 'ben'`) === 1, 'and his work');
check(kvData.has('cm:trainee:t-ben'), 'and his course progress');

if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('\nRevoke test passed (the records are filed before anything is deleted, then nothing of theirs is left, scores included; the audit trail and the tombstone stay; the rest of the batch is untouched).');

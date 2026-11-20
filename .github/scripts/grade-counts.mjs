// Completion and the leaderboard count only activities a trainee can see (code inventory 2026-10-16 #2 and #3):
// /api/progress's "of N" leaves out Draft and Unpublished activities, and /api/leaderboard's "activities completed" leaves out
// archived (deleted) ones, as /api/progress already did. Run: node --no-warnings .github/scripts/grade-counts.mjs
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const failures = []; const fail = (m) => failures.push(m);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'counts-'));
const put = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return pathToFileURL(p).href; };
const utilsUrl = put('_utils.mjs', fs.readFileSync('functions/_utils.js', 'utf8'));
const load = (f) => import(put(path.basename(f).replace('.js', '.mjs'), fs.readFileSync(f, 'utf8').replace("'../_utils.js'", `'${utilsUrl}'`)));
const progress = await load('functions/api/progress.js'), leaderboard = await load('functions/api/leaderboard.js');
const u = await import(utilsUrl);
const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id TEXT, username TEXT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, status TEXT, user_type TEXT, batch_id TEXT);
CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER, updated_at TEXT);
CREATE TABLE activities (id INTEGER PRIMARY KEY, type TEXT, status TEXT, questions TEXT);
CREATE TABLE submissions (id INTEGER PRIMARY KEY, activity_id INTEGER, trainee_username TEXT, status TEXT, score INTEGER, auto_score INTEGER);
INSERT INTO site_state VALUES (1, 0, NULL, 0, NULL);
INSERT INTO users VALUES ('1','ann','Ann',NULL,'Lee',NULL,'Approved','Trainee','B1'), ('2','boss','Bo',NULL,'Trainer',NULL,'Approved','Admin','A1');
INSERT INTO heartbeats VALUES ('ann','Ann Lee','B1','Trainee',NULL,datetime('now')), ('boss','Bo','A1','Admin',NULL,datetime('now'));
INSERT INTO activities VALUES (1,'Activity','Published',NULL), (2,'Activity','Closed',NULL), (3,'Activity','Published','[{"id":"a","type":"mcq","points":2},{"id":"b","type":"mcq","points":2}]'), (4,'Activity','Draft',NULL), (5,'Activity','Unpublished',NULL), (6,'Lesson Deck','Published',NULL);
INSERT INTO submissions VALUES (1,1,'ann','Graded',90,NULL), (2,2,'ann','Graded',80,NULL), (3,3,'ann','Graded',3,3), (4,99,'ann','Graded',70,NULL);`);
const stmt = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const env = { DB: { prepare: stmt }, TRAINING_DB: { prepare: stmt }, SESSION_SECRET: 'test-secret' };
const get = async (mod, who, type) => (await mod.onRequestGet({ request: new Request('https://p/api', { headers: { cookie: 'lsh_session=' + await u.createSessionToken({ username: who, userType: type, fullName: who, batchId: 'B1' }, env.SESSION_SECRET) } }), env })).json();
const p = JSON.stringify(await get(progress, 'boss', 'Admin'));
// Ann submitted all three visible activities (and one archived, id 99): 3 of 3, 100%
if (!/"completed":3,"total":3,"pct":100/.test(p)) fail(`progress should be 3 of 3 (100%), Draft and Unpublished left out: ${p.slice(0, 400)}`);
const l = await get(leaderboard, 'ann', 'Trainee');
const ann = (l.leaderboard || l.rows || l.results || []).find(r => r.fullName === 'Ann Lee') || JSON.stringify(l).match(/"activitiesCompleted":(\d+)/);
const n = ann && (ann.activitiesCompleted ?? Number(ann[1]));
if (n !== 3) fail(`the leaderboard should count 3 activities completed, not the archived one: ${JSON.stringify(l).slice(0, 400)}`);
// (data-safety review 2026-11-19) a grade stored the old way, in raw points (3 of activity 3's 4 points), reads as 75%:
// Ann's average is (90 + 80 + 75 + 70) / 4 = 78.8
const lb = (l.leaderboard || []).find(r => r.fullName === 'Ann Lee');
if (!lb || lb.rating !== 78.8) fail(`an old raw-points grade reads as its percentage on the leaderboard: ${JSON.stringify(lb)}`);
if (!/"avgScore":78.8/.test(p)) fail(`and on progress: ${p.slice(0, 300)}`);
if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Completion and the leaderboard count only the activities a trainee can see.');

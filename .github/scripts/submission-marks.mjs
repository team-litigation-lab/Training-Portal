// ✓ / ✗ per question for a trainee's graded submission (platform QA 2026-11-19, finding 6).
// A trainee never gets an activity's answer key (api/activities.js strips correctAnswer), so their Details view and PDF used to
// mark every objective answer "✗ INCORRECT" with a blank key. /api/submissions GET now says, for a trainee's GRADED submission
// only, whether each objective answer was right (question_results[id].correct), and never sends the key itself.
// Run: node --no-warnings .github/scripts/submission-marks.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const failures = []; const fail = (m) => failures.push(m);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'marks-'));
const put = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return pathToFileURL(p).href; };
const utilsUrl = put('_utils.mjs', fs.readFileSync('functions/_utils.js', 'utf8'));
const subs = await import(put('submissions.mjs', fs.readFileSync('functions/api/submissions.js', 'utf8').replace("'../_utils.js'", `'${utilsUrl}'`)));
const u = await import(utilsUrl);

const sql = new DatabaseSync(':memory:');
const qs = JSON.stringify([
    { id: 'q1', type: 'mcq', prompt: 'A?', points: 1, correctAnswer: 'B' },
    { id: 'q2', type: 'truefalse', prompt: 'B?', points: 1, correctAnswer: 'True' },
    { id: 'q3', type: 'essay', prompt: 'C?', points: 5 },
    { id: 'q4', type: 'short', prompt: 'D?', points: 1, correctAnswer: 'lien' }]);
sql.exec(`CREATE TABLE users (id TEXT, username TEXT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, status TEXT, user_type TEXT, batch_id TEXT);
CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER, updated_at TEXT);
CREATE TABLE activities (id INTEGER PRIMARY KEY, title TEXT, questions TEXT, status TEXT);
CREATE TABLE submissions (id INTEGER PRIMARY KEY, activity_id INTEGER, activity_title TEXT, trainee_username TEXT, trainee_name TEXT, notes TEXT, answers TEXT, auto_score INTEGER, status TEXT, score INTEGER, feedback TEXT, ai_review TEXT, submitted_at TEXT, graded_at TEXT);
INSERT INTO site_state VALUES (1, 0, NULL, 0, NULL);
INSERT INTO users VALUES ('1','ann','Ann',NULL,'Lee',NULL,'Approved','Trainee','B1'), ('2','boss','Bo',NULL,'Trainer',NULL,'Approved','Admin','A1');
INSERT INTO heartbeats VALUES ('ann','Ann Lee','B1','Trainee',NULL,datetime('now')), ('boss','Bo Trainer','A1','Admin',NULL,datetime('now'));`);
sql.prepare('INSERT INTO activities VALUES (1, ?, ?, ?)').run('Quiz', qs, 'Published');
const answers = JSON.stringify([{ questionId: 'q1', response: 'B' }, { questionId: 'q2', response: 'False' }, { questionId: 'q3', response: 'An essay' }, { questionId: 'q4', response: ' LIEN ' }]);
sql.prepare(`INSERT INTO submissions (id, activity_id, activity_title, trainee_username, answers, status, submitted_at) VALUES (1, 1, 'Quiz', 'ann', ?, 'Graded', '2026-11-01')`).run(answers);
sql.prepare(`INSERT INTO submissions (id, activity_id, activity_title, trainee_username, answers, status, submitted_at) VALUES (2, 1, 'Quiz', 'ann', ?, 'Needs Review', '2026-11-02')`).run(answers);
const stmt = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const env = { DB: { prepare: stmt }, TRAINING_DB: { prepare: stmt }, SESSION_SECRET: 'test-secret' };
const get = async (username, userType) => {
    const token = await u.createSessionToken({ username, userType, fullName: username, batchId: 'B1' }, env.SESSION_SECRET);
    const r = await subs.onRequestGet({ request: new Request('https://p/api/submissions', { headers: { cookie: `lsh_session=${token}` } }), env });
    return r.json();
};

const mine = await get('ann', 'Trainee');
const graded = (mine.submissions || []).find((s) => s.id === 1), pending = (mine.submissions || []).find((s) => s.id === 2);
if (!graded || !graded.question_results) fail(`a trainee's graded submission should say which answers were right: ${JSON.stringify(graded)}`);
else {
    const r = graded.question_results;
    if (!r.q1 || r.q1.correct !== true) fail(`q1 (right) should be correct: ${JSON.stringify(r.q1)}`);
    if (!r.q2 || r.q2.correct !== false) fail(`q2 (wrong) should be incorrect: ${JSON.stringify(r.q2)}`);
    if (r.q3) fail('an essay has no automatic verdict');
    if (!r.q4 || r.q4.correct !== true) fail(`q4 (right, other case and spaces) should be correct: ${JSON.stringify(r.q4)}`);
}
if (/correctAnswer|"lien"|"True"/.test(JSON.stringify(mine))) fail('the answer key must never reach a trainee');
if (pending && pending.question_results) fail('a submission not graded yet says nothing per question');
const admin = await get('boss', 'Admin');
if ((admin.submissions || []).some((s) => s.question_results)) fail('an admin has the key with the activity: no per-question verdicts are added');
// the Details view and the PDF use the verdict, and show a key only when there is one
const app = fs.readFileSync('app.js', 'utf8');
if ((app.match(/answerIsCorrect\(sub, q, given\)/g) || []).length < 2) fail('renderSubmissionAnswersHtml and buildSubmissionReportLines should both use answerIsCorrect');
if (!/question_results/.test(app)) fail('app.js should read question_results');

// An all-objective activity is graded as a percentage of its points (code inventory 2026-10-16 #1): 3 of 4 points is 75, not 3.
sql.exec(`CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_username TEXT, actor_batch TEXT, action TEXT, details TEXT, timestamp TEXT DEFAULT (datetime('now')));`);
sql.prepare('INSERT INTO activities VALUES (2, ?, ?, ?)').run('Objective quiz', JSON.stringify([
    { id: 'a', type: 'mcq', prompt: 'A?', points: 1, correctAnswer: 'B' }, { id: 'b', type: 'mcq', prompt: 'B?', points: 1, correctAnswer: 'C' },
    { id: 'c', type: 'short', prompt: 'C?', points: 2, correctAnswer: 'lien' }]), 'Published');
{
    const stmtLast = (q) => { const o = stmt(q); const run = o.run; o.run = async () => { const r = await run(); return { meta: { last_row_id: Number(r.lastInsertRowid) } }; }; return o; };
    const env2 = Object.assign({}, env, { TRAINING_DB: { prepare: stmtLast } });
    const token = await u.createSessionToken({ username: 'ann', userType: 'Trainee', fullName: 'Ann Lee', batchId: 'B1' }, env.SESSION_SECRET);
    const r = await subs.onRequestPost({ request: new Request('https://p/api/submissions', { method: 'POST', headers: { cookie: `lsh_session=${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SUBMIT', activityId: 2, activityTitle: 'Objective quiz', answers: [{ questionId: 'a', response: 'B' }, { questionId: 'b', response: 'A' }, { questionId: 'c', response: 'Lien' }] }) }), env: env2, waitUntil: () => {} });
    const out = await r.json();
    const row = sql.prepare('SELECT auto_score, score, status FROM submissions WHERE activity_id = 2').get();
    if (!out.success || !row || row.status !== 'Graded' || row.score !== 75 || row.auto_score !== 3) fail(`an all-objective submission should be graded 75 (%), with auto_score 3 (points): ${JSON.stringify({ out, row })}`);
}

// (data-safety review 2026-11-19) an all-objective grade stored the old way, in raw points, is read as its percentage
sql.prepare(`INSERT INTO submissions (id, activity_id, activity_title, trainee_username, answers, status, score, auto_score, submitted_at) VALUES (9, 2, 'Objective quiz', 'ann', '[]', 'Graded', 3, 3, '2026-10-01')`).run();
{ const old = ((await get('ann', 'Trainee')).submissions || []).find((s) => s.id === 9);
  if (!old || old.score !== 75) fail(`an old raw-points grade (3 of 4 points) reads as 75: ${JSON.stringify(old && old.score)}`); }

if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('A trainee\'s graded submission says which objective answers were right, without the answer key.');

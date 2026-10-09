// A simulator's result counts in the trainee's own record (functions/api/sim-results.js): on an in-memory SQLite database and a
// stand-in for the courses' shared KV. A signed-in trainee's result is saved on their account, and, when a course opened the
// simulator (who.program), in that course's store (<prefix>simresults:<course trainee id>) with the best per simulator; a name typed
// in the browser never replaces the account's. Run: node --no-warnings .github/scripts/sim-results.mjs
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost, onRequestGet } from '../../functions/api/sim-results.js';
import { courseTraineeId } from '../../functions/api/call-results.js';
import { createSessionToken } from '../../functions/_utils.js';

const failures = []; const fail = (m) => failures.push(m);
function d1(db) {
    return { prepare(sql) {
        const make = (args) => ({ bind: (...a) => make(a), async run() { db.prepare(sql).run(...args); return { success: true }; },
            async first() { const r = db.prepare(sql).get(...args); return r === undefined ? null : { ...r }; },
            async all() { return { results: db.prepare(sql).all(...args).map(r => ({ ...r })) }; } });
        return make([]);
    } };
}
const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, first_name TEXT, last_name TEXT, batch_id TEXT, status TEXT, user_type TEXT);
    INSERT INTO users (username, first_name, last_name, batch_id, status, user_type) VALUES ('jcruz', 'Jamie', 'Cruz', 'B100526', 'Approved', 'Trainee'), ('boss', 'Tina', 'Trainer', 'A1', 'Approved', 'Admin');
    CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
    INSERT INTO heartbeats (username, last_seen) VALUES ('jcruz', datetime('now')), ('boss', datetime('now'));
    CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER);`);
const kv = new Map();
const env = { DB: d1(sql), TRAINING_DB: d1(sql), COURSE_KV: { get: async (k) => kv.has(k) ? kv.get(k) : null, put: async (k, v) => { kv.set(k, v); } }, SESSION_SECRET: 'ci-secret' };
const cookie = async (username, userType) => 'lsh_session=' + await createSessionToken({ username, userType, fullName: username, batchId: 'B100526' }, env.SESSION_SECRET);
const post = async (body, c) => {
    const r = await onRequestPost({ request: new Request('https://portal.test/api/sim-results', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: c }, body: JSON.stringify(body) }), env });
    return { status: r.status, data: await r.json() };
};
const jamie = await cookie('jcruz', 'Trainee');
// opened from the Foundational course, with someone else's name typed earlier in this browser
let r = await post({ simulator: 'Google Calendar', scenario: 'Attorney Rivera', score: 72, summary: 'ok', who: { name: 'Lei Abut', batch: 'B250926', program: 'FT' } }, jamie);
if (r.status !== 200 || r.data.course !== 'ft:simresults:jamie-cruz--b100526') fail(`the result didn't reach the course's store: ${JSON.stringify(r)}`);
const row = sql.prepare(`SELECT username, full_name FROM simulator_results ORDER BY id DESC LIMIT 1`).get();
if (row.username !== 'jcruz') fail(`the Portal saved it under ${row.username}, not the signed-in trainee`);
await post({ simulator: 'Google Calendar', scenario: 'Attorney Rivera', score: 90, who: { program: 'FT' } }, jamie);
await post({ simulator: 'Google Calendar', scenario: 'Attorney Rivera', score: 60, who: { program: 'FT' } }, jamie);
const rec = JSON.parse(kv.get('ft:simresults:jamie-cruz--b100526') || 'null');
if (!rec || rec.results.length !== 3 || rec.best['Google Calendar'].score !== 90 || rec.best['Google Calendar'].count !== 3) fail(`the course record: ${JSON.stringify(rec)}`);
// read back under the same identity it was written under: the trainee's own rows, the trainer's list, and the course id a
// graded call from the CMS Call Simulator uses for the same person (so a score and a call meet on one trainee record).
{
    const mine = await onRequestGet({ request: new Request('https://portal.test/api/sim-results', { headers: { cookie: jamie } }), env });
    const d = await mine.json();
    const got = (d.results || []).filter(r => r.simulator === 'Google Calendar');
    if (d.admin !== false || got.length !== 3 || got.some(r => r.username !== 'jcruz' || r.full_name !== 'jcruz')) fail(`the trainee can't read their own scores back: ${JSON.stringify(d.results)}`);
    const boss = await onRequestGet({ request: new Request('https://portal.test/api/sim-results', { headers: { cookie: await cookie('boss', 'Admin') } }), env });
    const dd = await boss.json();
    if (dd.admin !== true || !(dd.results || []).some(r => r.username === 'jcruz' && r.simulator === 'Google Calendar')) fail(`the trainer can't see the trainee's score: ${JSON.stringify(dd.results)}`);
    if (courseTraineeId('Jamie', 'Cruz', 'B100526') !== 'jamie-cruz--b100526') fail('the course trainee id is not built the same way on the read side');
}
// the CM course, by its prefix
r = await post({ simulator: 'Medical Records Requests', score: 80, who: { program: 'CM' } }, jamie);
if (!kv.has('cm:simresults:jamie-cruz--b100526')) fail('a CM result didn\'t reach the CM course');
// no program (opened from the Portal itself), or an admin: the Portal only
const before = kv.size;
await post({ simulator: 'Docket System', score: 50, who: {} }, jamie);
await post({ simulator: 'Docket System', score: 50, who: { program: 'FT' } }, await cookie('boss', 'Admin'));
if (kv.size !== before) fail('a result with no course, or an admin\'s, was written to a course');

if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Simulator results test passed (the signed-in trainee\'s own account, each course\'s store by its prefix and id with the best per simulator, nothing for a Portal-only or an admin\'s result).');

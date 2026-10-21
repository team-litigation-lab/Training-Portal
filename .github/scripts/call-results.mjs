// Graded calls from the Call Simulator count in the trainee's course (functions/api/call-results.js), on an in-memory
// SQLite database and a stand-in for the courses' shared KV. The Call Simulator is LSH Ring Channel's (via=ringchannel);
// the CMS's older panel sends them the same way (via=cms). Run: node --no-warnings .github/scripts/call-results.mjs
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost, onRequestGet, courseTraineeId } from '../../functions/api/call-results.js';
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
    INSERT INTO users (username, first_name, last_name, batch_id, status, user_type) VALUES ('jcruz', 'Jamie', 'Cruz', 'B100526', 'Approved', 'Trainee'), ('boss', 'Tina', 'Trainer', 'B1', 'Approved', 'Admin');
    CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
    INSERT INTO heartbeats (username, last_seen) VALUES ('boss', datetime('now'));
    CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER);`);
const kv = new Map();
const COURSE_KV = { get: async (k) => kv.has(k) ? kv.get(k) : null, put: async (k, v) => { kv.set(k, v); } };
const env = { DB: d1(sql), TRAINING_DB: d1(sql), COURSE_KV, AI_GATEWAY_SECRET: 'gw-secret', SESSION_SECRET: 'ci-secret' };
const post = async (body, key = 'gw-secret', e = env) => {
    const r = await onRequestPost({ request: new Request('https://portal.test/api/call-results', { method: 'POST', headers: { 'X-Gateway-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env: e });
    return { status: r.status, data: await r.json() };
};
const call = (over) => Object.assign({ id: 'ft_cal_depo', program: 'FT', line: 'Calendar Management Mock Calls', lesson: 5, title: 'Defense Counsel Wants to Move a Deposition', score: 82, verdict: 'Solid call.', secs: 140, voice: 'standard', at: '2026-10-05T10:00:00.000Z' }, over);

// the course Workers' trainee id (worker.js candidateIds)
if (courseTraineeId('Ana', 'Cruz', 'B1') !== 'ana-cruz--b1' || courseTraineeId('José', 'Núñez', 'B300926') !== 'jose-nunez--b300926' || courseTraineeId('Jamie', 'Cruz', '') !== 'jamie-cruz') fail('the course trainee id doesn\'t match the courses\' (slug of "first last" -- batch)');

// 1. only a Call Simulator with the shared secret
let r = await post({ first: 'Jamie', last: 'Cruz', batch: 'B100526', call: call() }, 'wrong');
if (r.status !== 401) fail(`a wrong key got ${r.status}`);
r = await post({ first: 'Jamie', last: 'Cruz', batch: 'B100526', call: call() }, 'gw-secret', { ...env, AI_GATEWAY_SECRET: '' });
if (r.status !== 501) fail(`without the secret on the Portal: ${r.status}`);
r = await post({ first: 'Jamie', last: 'Cruz', batch: 'B100526', call: call({ program: 'XX' }) });
if (r.status !== 400) fail(`an unknown program got ${r.status}`);

// 2. a Standard Training graded call: the Portal's simulator results on Jamie's account, and FT's store by lesson
r = await post({ first: 'Jamie', last: 'Cruz', batch: 'B100526', username: 'jamie.cruz', via: 'ringchannel', call: call() });
const ftKey = 'ft:callsim:jamie-cruz--b100526';
if (r.status !== 200 || !r.data.success || r.data.username !== 'jcruz' || !r.data.course || r.data.course.key !== ftKey) fail(`the FT call wasn't saved: ${r.status} ${JSON.stringify(r.data)}`);
const row = sql.prepare(`SELECT * FROM simulator_results ORDER BY id DESC LIMIT 1`).get();
if (!row || row.username !== 'jcruz' || row.simulator !== 'Call Simulator' || row.score !== 82 || !/"via":"ringchannel"/.test(row.details) || !/"lesson":5/.test(row.details)) fail(`the simulator result is wrong: ${JSON.stringify(row)}`);
// a call from the CMS's older panel, and an unknown sender, are kept as the CMS's
r = await post({ first: 'Jamie', last: 'Cruz', batch: 'B100526', via: 'nonsense', call: call({ id: 'ft_cal_old', score: 55 }) });
const old1 = sql.prepare(`SELECT * FROM simulator_results ORDER BY id DESC LIMIT 1`).get();
if (!old1 || !/"via":"cms"/.test(old1.details)) fail(`a call from an unknown sender should be kept as the CMS's: ${JSON.stringify(old1)}`);
await post({ first: 'jamie', last: 'cruz', batch: 'B100526', call: call({ id: 'ft_cal_prep', score: 64, at: '2026-10-05T11:00:00.000Z' }) });
await post({ first: 'Jamie', last: 'Cruz', batch: 'B100526', call: call({ id: 'ft_rc_appt', line: 'Reception Mock Calls', lesson: 4, score: 90 }) });
const ft = JSON.parse(kv.get(ftKey) || 'null');
if (!ft || ft.traineeId !== 'jamie-cruz--b100526' || ft.calls.length !== 4 || JSON.stringify(ft.best.lesson5 && [ft.best.lesson5.score, ft.best.lesson5.calls]) !== '[82,3]' || !ft.best.lesson4 || ft.best.lesson4.score !== 90) fail(`FT's store by lesson is wrong: ${JSON.stringify(ft)}`);

// 3. other programs by line, under their course's prefix; an EA / PA trainee on an older id (the alias)
await post({ first: 'Jamie', last: 'Cruz', batch: 'B100526', call: call({ id: 'pd_cs_intake', program: 'PD', line: 'Claim Setup', lesson: null, score: 71 }) });
const pd = JSON.parse(kv.get('pd:callsim:jamie-cruz--b100526') || 'null');
if (!pd || !pd.best['line:Claim Setup'] || pd.best['line:Claim Setup'].score !== 71) fail(`PD's store by line is wrong: ${JSON.stringify(pd)}`);
kv.set('trainee-alias:jamie-cruz--b100526', 'jamie-cruz');
r = await post({ first: 'Jamie', last: 'Cruz', batch: 'B100526', call: call({ id: 'ea_ex_friday', program: 'EA', line: 'Executive Calls', lesson: null, score: 77 }) });
if (!kv.has('callsim:jamie-cruz') || kv.has('callsim:jamie-cruz--b100526') || r.data.course.key !== 'callsim:jamie-cruz') fail(`an EA / PA call didn't follow the trainee's alias: ${JSON.stringify(r.data)}`);
// someone without a Portal account here is still kept, under their CMS name
r = await post({ first: 'Pat', last: 'Lee', batch: 'B9', username: 'pat.lee', call: call() });
if (r.data.username !== 'cms:pat.lee' || !kv.has('ft:callsim:pat-lee--b9')) fail(`a trainee without a Portal account: ${JSON.stringify(r.data)}`);

// 4. an Admin lists them
const tok = await createSessionToken({ username: 'boss', userType: 'Admin', fullName: 'Tina Trainer', batchId: 'B1' }, env.SESSION_SECRET);
const g = await (await onRequestGet({ request: new Request('https://portal.test/api/call-results', { headers: { cookie: `lsh_session=${tok}` } }), env })).json();
if (!g.success || g.results.length !== 7) fail(`an Admin's list of graded calls: ${JSON.stringify(g).slice(0, 200)}`);

// 5. a graded text conversation from the CMS's 💬 Client Messaging (kind: 'message'): filed as that simulator, on its own
//    line in the course's store; Medical Summary & Demand (MD) takes conversations under md:, and no calls
const convo = (over) => call(Object.assign({ id: 'cm_offer', program: 'CM', line: 'Client Messaging', lesson: null, title: '"Should I take the offer?"', score: 74, voice: 'text' }, over));
r = await post({ first: 'Jamie', last: 'Cruz', batch: 'B100526', via: 'cms', kind: 'message', call: convo() });
const msgRow = sql.prepare(`SELECT * FROM simulator_results ORDER BY id DESC LIMIT 1`).get();
if (r.status !== 200 || !msgRow || msgRow.simulator !== 'Client Messaging' || !/"kind":"message"/.test(msgRow.details)) fail(`a graded conversation wasn't filed as Client Messaging: ${JSON.stringify(msgRow)}`);
const cm = JSON.parse(kv.get('cm:callsim:jamie-cruz--b100526') || 'null');
if (!cm || !cm.best['line:Client Messaging'] || cm.best['line:Client Messaging'].score !== 74) fail(`CM's store doesn't have the conversation on its own line: ${JSON.stringify(cm)}`);
r = await post({ first: 'Jamie', last: 'Cruz', batch: 'B100526', kind: 'message', call: convo({ id: 'md_demand', program: 'MD', title: 'When does my demand go out?', score: 88 }) });
const md = JSON.parse(kv.get('md:callsim:jamie-cruz--b100526') || 'null');
if (r.status !== 200 || !md || !md.best['line:Client Messaging'] || md.best['line:Client Messaging'].score !== 88) fail(`MD's conversation wasn't kept under md: ${r.status} ${JSON.stringify(md)}`);
r = await post({ first: 'Jamie', last: 'Cruz', batch: 'B100526', call: call({ id: 'md_call', program: 'MD', line: 'Demand Calls', lesson: null }) });
if (r.status !== 400) fail(`an MD call (not a conversation) should be refused: ${r.status}`);
// … and a 💬 Automated Messaging thread from Ring Channel comes the same way (kind: 'message'), on its own
// line: it is filed as the Client Messaging simulator, and it counts in the course by that line.
r = await post({ first: 'Jamie', last: 'Cruz', batch: 'B100526', via: 'ringchannel', kind: 'message', call: convo({ id: 'am_settlement', program: 'EA', line: 'Automated Messaging', title: 'Check notice: the client wants a number and a date', score: 91 }) });
const autoRow = sql.prepare(`SELECT * FROM simulator_results ORDER BY id DESC LIMIT 1`).get();
if (r.status !== 200 || !autoRow || autoRow.simulator !== 'Client Messaging' || !/"line":"Automated Messaging"/.test(autoRow.details)) fail(`an Automated Messaging thread wasn't filed as Client Messaging: ${JSON.stringify(autoRow)}`);
const ea = JSON.parse(kv.get('callsim:jamie-cruz') || 'null');   // EA / PA's own store, under the alias set above
if (!ea || !ea.best['line:Automated Messaging'] || ea.best['line:Automated Messaging'].score !== 91) fail(`EA / PA's store doesn't have the thread on its own line: ${JSON.stringify(ea)}`);
// the Admin's list of graded calls stays calls only
const g2 = await (await onRequestGet({ request: new Request('https://portal.test/api/call-results', { headers: { cookie: `lsh_session=${tok}` } }), env })).json();
if (!g2.success || g2.results.length !== 7) fail(`conversations leaked into the Admin's list of graded calls: ${g2.results && g2.results.length}`);

if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Call results test passed (only a Call Simulator with the shared secret; Ring Channel\'s and the CMS\'s; the trainee\'s Portal results; each course\'s store by lesson or line, with its prefix and id; the EA / PA alias; Client Messaging conversations on their own line, Ring Channel\'s Automated Messaging threads too, MD conversations only).');

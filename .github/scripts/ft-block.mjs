// Standard Foundational Training's block list (ft:access:blocked in the shared COURSE_KV) follows the Portal:
// a Program Access Revoke / Suspend of Standard Foundational Training blocks the trainee's course record (whatever
// form their name takes there), Grant / Restore / Mark Passed unblocks it, an entry the course's own 🚫 Offboard made
// is never taken off, someone of the same name in another batch is left alone, another program changes nothing,
// and the 🧹 sweep blocks what was missed before (an account revoked while the purge couldn't find the course record,
// an access revoked before this followed it) but not a revoked person who has an account again.
// Run: node --no-warnings .github/scripts/ft-block.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ftb-'));
const put = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return pathToFileURL(p).href; };
const utilsUrl = put('_utils.mjs', fs.readFileSync('functions/_utils.js', 'utf8'));
const ftBlockUrl = put('_ft-block.mjs', fs.readFileSync('functions/_ft-block.js', 'utf8').replace("'./_utils.js'", `'${utilsUrl}'`));
const topics = await import(put('topics.mjs', fs.readFileSync('functions/api/topics.js', 'utf8').replace("'../_utils.js'", `'${utilsUrl}'`).replace("'../_ft-block.js'", `'${ftBlockUrl}'`)));
const u = await import(utilsUrl);

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, email TEXT, status TEXT, user_type TEXT, batch_id TEXT);
CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
CREATE TABLE deleted_users (username TEXT, user_type TEXT, batch_id TEXT, email TEXT, full_name TEXT, deleted_by TEXT, deleted_at TEXT);
CREATE TABLE activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_username TEXT, actor_batch TEXT, action TEXT, details TEXT, timestamp TEXT DEFAULT (datetime('now')));
CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER, updated_at TEXT);
CREATE TABLE topics (key TEXT PRIMARY KEY, name TEXT, sort_order INTEGER);
CREATE TABLE trainee_topic_access (trainee_username TEXT, topic_key TEXT, status TEXT, requested_at TEXT, decided_at TEXT, decided_by TEXT, PRIMARY KEY (trainee_username, topic_key));
INSERT INTO site_state VALUES (1, 0, NULL, 0, NULL);
INSERT INTO topics VALUES ('STANDARD TRAINING','Standard Training',1),('CM TRAINING','CM',2);
INSERT INTO users (username, first_name, mi, last_name, suffix, status, user_type, batch_id) VALUES
 ('matt','Matt',NULL,'Gan',NULL,'Approved','Admin',NULL),
 ('ana','Ana','M','Reyes',NULL,'Approved','Trainee','B101026'),
 ('ben','Ben',NULL,'Cruz','Jr.','Approved','Trainee','B101026'),
 ('cy','Cy',NULL,'Lim',NULL,'Approved','Trainee','B101026'),
 ('dee','Dee',NULL,'Tan',NULL,'Approved','Trainee','B101026'),
 ('eva2','Eva',NULL,'Ong',NULL,'Approved','Trainee','B101026'),
 ('leilee','Lei',NULL,'Abut',NULL,'Approved','Trainee','B103026');
INSERT INTO trainee_topic_access VALUES ('ana','STANDARD TRAINING','Approved',NULL,NULL,NULL),('ben','STANDARD TRAINING','Approved',NULL,NULL,NULL),
 ('cy','STANDARD TRAINING','Denied',NULL,NULL,NULL),('dee','CM TRAINING','Approved',NULL,NULL,NULL);
INSERT INTO deleted_users VALUES ('mark','Trainee','B10302026-LSHTRAINEE-004','m@x','Mark Christian D. Lucban','matt',datetime('now')),
 ('eva','Trainee','B101026','e@x','Eva Ong','matt',datetime('now')),
 ('jluna','Trainee','B103026','j@x','John Thomas E Luna','matt',datetime('now')),
 ('leiold','Trainee','B17092026-LSHTRAINEE-023','l@x','Lei Abut','matt',datetime('now'));`);
const stmt = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; },
    run: async () => { const r = sql.prepare(q).run(...a); return { meta: { changes: Number(r.changes || 0) } }; },
    first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };

// the course's records, as the Portal's launch ticket named them (first + last only), in the shared KV
const kvData = new Map(Object.entries({
    'ft:trainee:ana-reyes--b101026': { id: 'ana-reyes--b101026', name: 'Ana Reyes', batch: 'B101026', approved: true },
    'ft:trainee:ana-reyes--b090126': { id: 'ana-reyes--b090126', name: 'Ana Reyes', batch: 'B090126', approved: true },   // another Ana, another batch
    'ft:trainee:ben-cruz--b101026': { id: 'ben-cruz--b101026', name: 'Ben Cruz', batch: 'B101026', approved: true },
    'ft:trainee:cy-lim--b101026': { id: 'cy-lim--b101026', name: 'Cy Lim', batch: 'B101026', approved: true },
    'ft:trainee:dee-tan--b101026': { id: 'dee-tan--b101026', name: 'Dee Tan', batch: 'B101026', approved: true },
    'ft:trainee:mark-christian-lucban--b103026': { id: 'mark-christian-lucban--b103026', name: 'Mark Christian Lucban', batch: 'B103026', approved: true },
    'ft:trainee:eva-ong--b101026': { id: 'eva-ong--b101026', name: 'Eva Ong', batch: 'B101026', approved: true },
    // kept by the course in another form: the middle name dropped, and under a batch the Portal never had for him
    'ft:trainee:john-luna--b102326': { id: 'john-luna--b102326', name: 'John Luna', batch: 'B102326', approved: true },
    // an open account of the same name in this batch: a revoked namesake elsewhere never blocks it
    'ft:trainee:lei-abut--b103026': { id: 'lei-abut--b103026', name: 'Lei Abut', batch: 'B103026', approved: true },
    'ft:access:blocked': { ids: { 'zed-off--b101026': { why: 'offboarded', name: 'Zed Off', batch: 'B101026', at: 'x' } } },
    'cm:trainee:dee-tan--b101026': { id: 'dee-tan--b101026', name: 'Dee Tan', batch: 'B101026' }
}).map(([k, v]) => [k, JSON.stringify(v)]));
const COURSE_KV = {
    get: async (k, t) => { const v = kvData.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; },
    put: async (k, v) => { kvData.set(k, v); },
    delete: async (k) => { kvData.delete(k); },
    list: async ({ prefix }) => ({ keys: [...kvData.keys()].filter(k => k.startsWith(prefix)).sort().map(name => ({ name })), list_complete: true })
};
const env = { DB: { prepare: stmt }, TRAINING_DB: { prepare: stmt }, COURSE_KV, SESSION_SECRET: 'test-secret' };
const cookie = 'lsh_session=' + await u.createSessionToken({ username: 'matt', userType: 'Admin', fullName: 'Matt Gan', batchId: '' }, env.SESSION_SECRET);
sql.prepare(`INSERT INTO heartbeats VALUES ('matt','Matt Gan',NULL,'Admin',NULL,datetime('now'))`).run();
const post = async (body) => { const r = await topics.onRequestPost({ request: new Request('https://p/api/topics', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const blocked = () => Object.keys(JSON.parse(kvData.get('ft:access:blocked')).ids).sort();
let fails = 0;
const check = (ok, what, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + what + (ok || extra === undefined ? '' : ' — ' + JSON.stringify(extra))); if (!ok) fails++; };

let r = await post({ action: 'DENY', topicKey: 'STANDARD TRAINING', traineeUsername: 'ana' });
check(r.status === 200 && blocked().includes('ana-reyes--b101026'), 'Revoke (Program Access) blocks the course record, middle initial or not', r.body);
check(!blocked().includes('ana-reyes--b090126'), 'someone of the same name in another batch is left alone', blocked());
check(blocked().includes('zed-off--b101026'), "the course's own Offboard entry stays");
r = await post({ action: 'GRANT', topicKey: 'STANDARD TRAINING', traineeUsername: 'ana' });
check(r.status === 200 && !blocked().includes('ana-reyes--b101026'), 'Grant takes the block off again', blocked());

r = await post({ action: 'SUSPEND', topicKey: 'STANDARD TRAINING', traineeUsername: 'ben' });
check(r.status === 200 && blocked().includes('ben-cruz--b101026'), 'Suspend blocks (a suffix on the account, none on the course record)', r.body);
r = await post({ action: 'RESTORE', topicKey: 'STANDARD TRAINING', traineeUsername: 'ben' });
check(r.status === 200 && !blocked().includes('ben-cruz--b101026'), 'Restore unblocks', blocked());

r = await post({ action: 'DENY', topicKey: 'CM TRAINING', traineeUsername: 'dee' });
check(r.status === 200 && !blocked().includes('dee-tan--b101026'), 'another program changes nothing on this list', blocked());

// an Offboard made in the course, for someone the Portal then grants: it is the course's, so it stays
const list = JSON.parse(kvData.get('ft:access:blocked')); list.ids['ben-cruz--b101026'] = { why: 'offboarded', name: 'Ben Cruz', batch: 'B101026', at: 'x' }; kvData.set('ft:access:blocked', JSON.stringify(list));
r = await post({ action: 'GRANT', topicKey: 'STANDARD TRAINING', traineeUsername: 'ben' });
check(blocked().includes('ben-cruz--b101026'), "Grant never takes off a block the course's Offboard made");

r = await post({ action: 'FT_SWEEP' });
const ids = (r.body.blocked || []).map(x => x.id).sort();
check(r.status === 200 && ids.includes('mark-christian-lucban--b103026'), 'the sweep blocks an account revoked before the course was told (middle initial, long-form Batch ID)', r.body);
check(ids.includes('cy-lim--b101026'), 'the sweep blocks a program access revoked before this followed it', ids);
check(ids.includes('john-luna--b102326'), 'the sweep blocks a revoked account kept in the course under another form of the name and another batch', ids);
check(!ids.includes('lei-abut--b103026'), 'the sweep never blocks a record an open account of the same name could own', ids);
check(!ids.includes('eva-ong--b101026'), 'the sweep leaves a revoked person who has an account again (same name, same batch)', ids);
check(!ids.includes('ana-reyes--b101026') && !ids.includes('dee-tan--b101026'), 'the sweep leaves everyone with open access', ids);
r = await post({ action: 'FT_SWEEP' });
check(r.status === 200 && (r.body.blocked || []).length === 0, 'a second sweep finds nothing new', r.body);
check([...kvData.keys()].filter(k => k.includes('trainee:')).length === 10, 'nothing is deleted');

// 🗑 Revoke & delete tells the course at once (revoke-user.js → ftBlockRevoked), the same loose way
const fb = await import(ftBlockUrl);
{ const l = JSON.parse(kvData.get('ft:access:blocked')); delete l.ids['john-luna--b102326']; kvData.set('ft:access:blocked', JSON.stringify(l)); }
const rv = await fb.ftBlockRevoked(env, env.DB, { username: 'jluna', full_name: 'John Thomas E Luna', batch_id: 'B103026' }, 'matt');
check(rv.blocked.includes('john-luna--b102326') && blocked().includes('john-luna--b102326'), 'a revoked account goes on the block list at once, the name in another form', rv);
const rv2 = await fb.ftBlockRevoked(env, env.DB, { username: 'leiold', full_name: 'Lei Abut', batch_id: 'B17092026-LSHTRAINEE-023' }, 'matt');
check(!rv2.blocked.length && !blocked().includes('lei-abut--b103026'), 'revoking an old namesake leaves the open account of the same name', rv2);

const noKv = Object.assign({}, env, { COURSE_KV: undefined });
const r2 = await topics.onRequestPost({ request: new Request('https://p/api/topics', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'DENY', topicKey: 'STANDARD TRAINING', traineeUsername: 'ana' }) }), env: noKv });
check(r2.status === 200, 'without the course data connected, Program Access still works');

fs.rmSync(tmp, { recursive: true, force: true });
if (fails) { console.error(`\n${fails} check(s) failed.`); process.exit(1); }
console.log('\nBlock list checks passed.');

// A trainee never sees a trainer's username: a ping shows the sender's name ("Trainer" if none), and the
// lectures and activities a trainee reads leave out created_by. Admins still see the username.
// Run: node .github/scripts/trainer-names.mjs   (from the repository root; Node 22.13+)
import { DatabaseSync } from 'node:sqlite';
const ROOT = new URL('../../', import.meta.url);
const failures = []; const fail = (m) => failures.push(m);
function d1(db) {
    return { prepare(sql) {
        const make = (args) => ({ bind: (...a) => make(a),
            async run() { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: r.changes } }; },
            async first() { const r = db.prepare(sql).get(...args); return r === undefined ? null : { ...r }; },
            async all() { return { results: db.prepare(sql).all(...args).map(r => ({ ...r })) }; } });
        return make([]);
    } };
}
const { createSessionToken } = await import(new URL('functions/_utils.js', ROOT).href);
const pings = await import(new URL('functions/api/pings.js', ROOT).href);
const lectures = await import(new URL('functions/api/lectures.js', ROOT).href);

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, email TEXT, user_type TEXT, batch_id TEXT, username TEXT UNIQUE, password TEXT, status TEXT);
    CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
    CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER);
    CREATE TABLE pings (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, target TEXT NOT NULL, fired_at TEXT, by TEXT);
    CREATE TABLE lectures (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, created_by TEXT, created_at TEXT);
    INSERT INTO users (first_name, last_name, user_type, username, status) VALUES ('Matt', 'G', 'Admin', 'MattG', 'Approved'), ('Nia', 'N', 'Trainee', 'nia', 'Approved');
    INSERT INTO heartbeats (username, last_seen) VALUES ('nia', datetime('now')), ('MattG', datetime('now'));
    INSERT INTO pings (text, target, fired_at, by) VALUES ('Hi all', 'ALL', datetime('now'), 'MattG'), ('From master', 'ALL', datetime('now'), 'LSHADMIN123');
    INSERT INTO lectures (title, created_by, created_at) VALUES ('Intro', 'MattG', datetime('now'));`);
const env = { DB: d1(sql), TRAINING_DB: d1(sql), SESSION_SECRET: 'ci-secret' };
const as = async (who, type) => 'lsh_session=' + await createSessionToken({ sub: 1, username: who, batchId: '', userType: type, fullName: who }, env.SESSION_SECRET);
const get = async (mod, cookie) => { const r = await mod.onRequestGet({ request: new Request('https://x/api', { headers: { Cookie: cookie } }), env }); return r.json(); };

let r = await get(pings, await as('nia', 'Trainee'));
if (!r.success) fail('trainee could not read pings: ' + JSON.stringify(r));
else {
    const bys = r.pings.map(p => p.by);
    if (bys.includes('MattG') || bys.includes('LSHADMIN123')) fail('a trainee saw a trainer username in a ping: ' + bys);
    if (!bys.includes('Matt G')) fail('a trainee should see the trainer by name: ' + bys);
    if (!bys.includes('Trainer')) fail('the master account should show as "Trainer": ' + bys);
}
r = await get(pings, await as('MattG', 'Admin'));
if (!r.pings || !r.pings.some(p => p.by === 'MattG')) fail('an admin should still see the username: ' + JSON.stringify(r));
r = await get(lectures, await as('nia', 'Trainee'));
if (!r.lectures || r.lectures.some(l => 'created_by' in l)) fail('a trainee received created_by on lectures: ' + JSON.stringify(r));
r = await get(lectures, await as('MattG', 'Admin'));
if (!r.lectures || r.lectures[0].created_by !== 'MattG') fail('an admin should still see created_by: ' + JSON.stringify(r));

if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Trainer-names test passed (trainees see a trainer by name, never by username; admins still see usernames).');

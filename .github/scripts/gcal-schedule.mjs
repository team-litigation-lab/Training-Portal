// The Google Calendar Simulators' weekly schedule (functions/api/gcal-schedule.js) on SQLite: the Standard Training week keeps its own table exactly as it
// was (no ?track), the Case Management (?track=cm) and EA / PA (?track=ea) clones are kept apart, an unknown or empty track is refused (and never reaches
// the database), and only an Admin changes any of them.
// Run: node --no-warnings .github/scripts/gcal-schedule.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
let src = fs.readFileSync('functions/api/gcal-schedule.js', 'utf8').replace("import { json, requireSession } from '../_utils.js';",
    `const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });
let CUR = null; globalThis.__setSession = (x) => { CUR = x; };
const requireSession = async (req, env, opts = {}) => { if (!CUR) return { ok: false, response: json({ success: false, error: 'Sign in.' }, 401) };
    if (opts.adminOnly && CUR.userType !== 'Admin') return { ok: false, response: json({ success: false, error: 'Admins only.' }, 403) }; return { ok: true, session: CUR }; };`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-')); fs.writeFileSync(path.join(tmp, 'gs.mjs'), src);
const m = await import(pathToFileURL(path.join(tmp, 'gs.mjs')).href);
const sql = new DatabaseSync(':memory:'); const prepared = [];
const mk = (q) => { prepared.push(q); let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null }; return o; };
const env = { TRAINING_DB: { prepare: mk } };
const call = async (fn, qs, rows) => { const r = await m['onRequest' + fn]({ request: new Request('https://p/api/gcal-schedule' + qs, { method: fn.toUpperCase(), body: rows ? JSON.stringify({ rows }) : undefined }), env }); return { st: r.status, j: await r.json() }; };
const row = (id, title) => ({ id, wd: 1, start: '09:00', end: '09:30', type: 'Phone Call', title, location: '', notes: '', color: '' });
const fails = []; const ck = (o, t) => { console.log((o ? 'PASS ' : 'FAIL ') + t); if (!o) fails.push(t); };
const admin = { username: 'boss', userType: 'Admin', fullName: 'Trainer Bo' }, trainee = { username: 'ann', userType: 'Trainee', fullName: 'Ann Lee' };

globalThis.__setSession(trainee);
let r = await call('Get', ''); ck(r.st === 200 && r.j.rows === null, 'Standard Training: no saved schedule is the schedule as it came');
r = await call('Put', '', [row('a', 'x')]); ck(r.st === 403, 'a trainee can’t change the Standard Training week');
r = await call('Put', '?track=cm', [row('a', 'x')]); ck(r.st === 403, 'a trainee can’t change the Case Management week');
globalThis.__setSession(admin);
r = await call('Put', '', [row('s1', 'Standard week')]); ck(r.st === 200, 'an Admin saves the Standard Training week');
r = await call('Put', '?track=cm', [row('c1', 'CM week')]); ck(r.st === 200, 'an Admin saves the Case Management week');
r = await call('Put', '?track=ea', [row('e1', 'EA week')]); ck(r.st === 200, 'an Admin saves the EA / PA week');
const get = async (qs) => (await call('Get', qs)).j.rows;
ck((await get(''))[0].title === 'Standard week' && (await get('?track=standard'))[0].title === 'Standard week', 'Standard Training keeps its own week (no track, or track=standard)');
ck((await get('?track=cm'))[0].title === 'CM week' && (await get('?track=ea'))[0].title === 'EA week', 'the clones keep their own weeks');
ck(sql.prepare('SELECT COUNT(*) n FROM gcal_schedule').get().n === 1 && sql.prepare('SELECT COUNT(*) n FROM gcal_schedule_tracks').get().n === 2, 'Standard Training stays in gcal_schedule; the clones are in gcal_schedule_tracks');
r = await call('Delete', '?track=cm'); ck(r.st === 200 && (await get('?track=cm')) === null && (await get('?track=ea'))[0].title === 'EA week' && (await get(''))[0].title === 'Standard week', 'restoring one clone leaves the others alone');
r = await call('Delete', ''); ck(r.st === 200 && (await get('')) === null && (await get('?track=ea'))[0].title === 'EA week', 'restoring Standard Training leaves the clones alone');
// unknown or empty tracks: refused, and the database isn't touched
const before = prepared.length; let bad = true;
for (const qs of ['?track=', '?track=x', '?track=CM', '?track=cm;drop', '?track=constructor', '?track=__proto__', '?track=%20ea', '?track=../cm']) {
    for (const fn of ['Get', 'Put', 'Delete']) { const x = await call(fn, qs, fn === 'Put' ? [row('z', 'z')] : null); if (x.st !== 400) { bad = false; console.log('  not refused:', fn, qs, x.st); } }
}
ck(bad && prepared.length === before, 'an unknown or empty track is refused (400) and never reaches the database');
r = await call('Put', '?track=cm', [row('a', 'x'), row('a', 'y')]); ck(r.st === 400, 'the rows are still validated on a clone (a duplicate id is refused)');
ck(prepared.every(q => !/\$\{|\+/.test(q)), 'every query is a fixed statement with bound values');
if (fails.length) { console.log(`\n${fails.length} failure(s)`); process.exit(1); }
console.log('Google Calendar weekly schedule test passed (per track, Admin only, unknown tracks refused).');

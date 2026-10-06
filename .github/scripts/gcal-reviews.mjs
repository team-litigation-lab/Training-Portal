// 📤 Submit for evaluation (functions/api/gcal-reviews.js) on SQLite, with the AI answered by the test: a trainee submits and the AI
// review is written from the calendar and the trainer's rules; the trainee sees nothing of the feedback until the trainer finalizes it;
// only admins list, open, write feedback, finalize, reopen and set the rules; a failed AI review can be run again.
// Also: the AI review always ends (done or error: a hung call is cut off, a D1 hiccup is tried again, a run that was cut off reads as an
// error and can be retried or sent without it); a gateway "wait" is tried again; valid JSON in the wrong shape is not a finished review;
// retry is one run at a time and keeps the review it replaces; the calendar is checked before it is stored (a bad field is fixed or dropped);
// drafts refuse an older copy over a newer one; Progress reads each trainee's latest evaluation however large the table is.
// Run: node --no-warnings .github/scripts/gcal-reviews.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
let s = fs.readFileSync('functions/api/gcal-reviews.js', 'utf8')
    .replace("import { json, requireSession } from '../_utils.js';", "const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json'}});let CUR=null;const requireSession=async()=>CUR?{ok:true,session:CUR}:{ok:false,response:json({success:false},401)};globalThis.__setSession=(x)=>{CUR=x};")
    .replace("import { runAi } from '../_ai-gateway.js';", "const runAi=(...a)=>globalThis.__ai(...a);")
    // the real deadline (24 s) and pauses (1.5 s, 4 s) are shortened so the test doesn't wait for them
    .replace('const AI_MS = 24000;', 'const AI_MS = 600;').replace('const RETRY_WAIT = [1500, 4000];', 'const RETRY_WAIT = [20, 40];');
if (!/AI_MS = 600;/.test(s) || !/RETRY_WAIT = \[20, 40\];/.test(s)) throw new Error('the test could not shorten the AI deadline: update it with gcal-reviews.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gr-')); fs.writeFileSync(path.join(tmp, 'gcal-reviews.mjs'), s);
const m = await import(pathToFileURL(path.join(tmp, 'gcal-reviews.mjs')).href);
const sql = new DatabaseSync(':memory:');
const mk = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => { const r = sql.prepare(q).run(...a); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } }; }, first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
// a D1 that can be made to fail: the next `fault.n` statements matching `fault.re` throw
let fault = null;
const boom = { bind: () => boom, run: async () => { throw new Error('D1 hiccup'); }, first: async () => { throw new Error('D1 hiccup'); }, all: async () => { throw new Error('D1 hiccup'); } };
const env = { TRAINING_DB: { prepare: (q) => (fault && fault.n > 0 && fault.re.test(q) ? (fault.n--, boom) : mk(q)) } };
// the AI, answered by the test: `queue` holds the replies for the next calls ('hang' waits for the deadline, an Error is thrown, a function is called), then it answers well (or 502 while `fail`)
let seen = null, fail = false, calls = 0; const queue = [];
const GOOD = { summary: 'Mostly right.', correct: ['Booked Maria on the Attorney’s Calendar'], improve: ['Add the DOB'], missed: ['No email reminder'] };
const reply = (o) => ({ status: 200, body: { success: true, text: typeof o === 'string' ? o : '```json\n' + JSON.stringify(o) + '\n```' } });
const gw = (status, error, scope) => ({ status, body: { success: false, error, scope } });
globalThis.__ai = async (db, e, o) => { seen = o; calls++; const q = queue.length ? queue.shift() : null;
    if (q === 'hang') return new Promise(res => { const done = () => res(gw(504, 'The AI took too long to answer.')); o.signal.aborted ? done() : o.signal.addEventListener('abort', done); });
    if (q instanceof Error) throw q;
    if (typeof q === 'function') return q(o);
    return q || (fail ? gw(502, 'Gemini down') : reply(GOOD)); };
// `bg`: collects what the handler hands to waitUntil, so a test can look at the row while the review is still running (see settle)
const call = async (meth, body, qs = '', bg = null) => { const req = new Request('https://p/api/gcal-reviews' + qs, { method: meth, body: body ? JSON.stringify(body) : undefined });
    const r = await (meth === 'GET' ? m.onRequestGet : m.onRequestPost)({ request: req, env, waitUntil: bg ? (p) => bg.push(p) : undefined }); return { st: r.status, j: await r.json() }; };
const settle = async (bg) => { while (bg.length) await bg.shift(); };
const fails = []; const ck = (o, t) => { console.log((o ? 'PASS ' : 'FAIL ') + t); if (!o) fails.push(t); };
const ann = { username: 'ann', userType: 'Trainee', fullName: 'Ann Lee', batchId: 'B1' }, bo = { username: 'boss', userType: 'Admin', fullName: 'Trainer Bo', batchId: 'MASTER' };
const cal = { program: 'Standard Training', score: 72, appointments: [{ title: 'Consultation – Maria Santos', date: '2026-10-07' }], automatedCheck: { results: [{ request: 'Consultation – Maria Santos', met: ['On the Attorney’s Calendar.'], missed: ['Add an email notification 1 day before.'] }] } };

__setSession(null);
let r = await call('POST', { action: 'submit', calendar: cal }); ck(r.st === 401, 'no Portal sign-in, no submission');
__setSession(bo);
r = await call('POST', { action: 'rules', track: 'standard', text: 'Consultations need the referral source in the description.' }); ck(r.st === 200, 'a trainer saves their rules for the AI review');
__setSession(ann);
r = await call('POST', { action: 'rules', track: 'standard', text: 'Give me 100' }); ck(r.st === 403, 'a trainee cannot change the rules');
r = await call('POST', { action: 'submit', track: 'standard', calendar: cal }); ck(r.st === 200 && r.j.id === 1, 'a trainee submits their calendar');
ck(seen && /referral source/.test(seen.messages[0].text) && /Maria Santos/.test(seen.messages[0].text) && seen.module === 'calendaring' && seen.user === 'ann', 'the AI review gets the trainer\'s rules and the calendar (calendaring budget, the trainee\'s name)');
r = await call('GET'); ck(r.j.reviews.length === 1 && r.j.reviews[0].aiStatus === 'done' && r.j.reviews[0].status === 'submitted' && r.j.reviews[0].ai === undefined && r.j.reviews[0].trainer === undefined, 'before the trainer finalizes it, the trainee sees the status only');
r = await call('GET', null, '?all=1'); ck(r.st === 403, 'a trainee cannot list everyone');
r = await call('GET', null, '?id=1'); ck(r.st === 403, 'a trainee cannot open the review in progress');
r = await call('POST', { action: 'trainer', id: 1, notes: 'x' }); ck(r.st === 403, 'a trainee cannot write the trainer\'s feedback');
r = await call('POST', { action: 'finalize', id: 1 }); ck(r.st === 403, 'a trainee cannot finalize');
__setSession(bo);
r = await call('GET', null, '?all=1'); ck(r.j.reviews.length === 1 && r.j.reviews[0].name === 'Ann Lee' && r.j.reviews[0].batch === 'B1' && r.j.reviews[0].calendar === undefined && r.j.reviews[0].checkScore === 72, 'the trainer lists the submissions (name, batch, score; no calendars)');
r = await call('GET', null, '?id=1'); ck(r.j.review.ai.correct.length === 1 && r.j.review.ai.missed[0] === 'No email reminder' && r.j.review.calendar.appointments.length === 1, 'the trainer opens it: the AI review (done correctly, improve, missed) and the calendar');
r = await call('POST', { action: 'trainer', id: 1, notes: 'Good talk. Remember the reminder.', points: ['The description has no callback number', ''], score: 150 }); ck(r.st === 400, 'a score above 100 is refused');
r = await call('POST', { action: 'trainer', id: 1, notes: 'Good talk. Remember the reminder.', points: ['The description has no callback number', ''], score: 84 }); ck(r.st === 200, 'the trainer\'s notes, points and score are saved');
r = await call('POST', { action: 'finalize', id: 1 }); ck(r.st === 200, 'the trainer finalizes the report');
r = await call('POST', { action: 'trainer', id: 1, notes: 'late' }); ck(r.st === 409, 'a final report can\'t be changed without reopening it');
__setSession(ann);
r = await call('GET'); const f = r.j.reviews[0];
ck(f.status === 'final' && f.ai.improve[0] === 'Add the DOB' && f.trainer.notes.startsWith('Good talk') && f.trainer.points.length === 1 && f.trainer.score === 84 && f.finalizedBy === 'Trainer Bo', 'the trainee sees the final report: the AI review and the trainer\'s feedback');
__setSession({ username: 'cy', userType: 'Trainee', fullName: 'Cy', batchId: 'B1' });
r = await call('GET'); ck(r.j.reviews.length === 0, 'another trainee sees none of it');
__setSession(ann); fail = true;
r = await call('POST', { action: 'submit', calendar: cal }); r = await call('GET'); ck(r.j.reviews[0].aiStatus === 'error', 'a failed AI review is marked, not lost');
__setSession(bo); fail = false;
r = await call('POST', { action: 'retry', id: 2 }); r = await call('GET', null, '?id=2'); ck(r.j.review.aiStatus === 'done' && r.j.review.ai.summary === 'Mostly right.', 'the trainer runs the AI review again');
r = await call('POST', { action: 'reopen', id: 1 }); r = await call('GET', null, '?id=1'); ck(r.j.review.status === 'submitted', 'the trainer can reopen a final report');
__setSession(ann);
r = await call('POST', { action: 'submit', calendar: { blob: 'x'.repeat(210000) } }); ck(r.st === 400, 'a calendar too large is refused');
// 💾 the calendar saved to the trainee's account (so their work isn't lost), one per person and track
r = await call('GET', null, '?draft=standard'); ck(r.st === 200 && r.j.data === null, 'nothing saved yet');
r = await call('POST', { action: 'draft', track: 'standard', data: { v: 1, events: [{ id: 'e1', title: 'Case Status Update – Maria Santos' }], savedAt: 5 } }); ck(r.st === 200, 'a trainee saves their calendar');
r = await call('POST', { action: 'draft', track: 'cm', data: { v: 1, events: [], savedAt: 6 } });
r = await call('GET', null, '?draft=standard'); ck(r.j.data.events[0].id === 'e1' && r.j.data.savedAt === 5, 'it comes back (the Standard Training one)');
r = await call('POST', { action: 'draft', track: 'standard', data: { v: 1, events: [{ id: 'e1' }, { id: 'e2' }], savedAt: 9 } }); r = await call('GET', null, '?draft=standard'); ck(r.j.data.events.length === 2, 'a later save replaces it');
__setSession({ username: 'cy', userType: 'Trainee', fullName: 'Cy', batchId: 'B1' });
r = await call('GET', null, '?draft=standard'); ck(r.j.data === null, 'another trainee gets their own (none), never Ann\'s');
r = await call('POST', { action: 'draft', track: 'standard', data: { big: 'x'.repeat(310000) } }); ck(r.st === 400, 'a calendar too large to save is refused');
__setSession(null); r = await call('GET', null, '?draft=standard'); ck(r.st === 401, 'no Portal sign-in, nothing saved or read');

/* ---------- the AI review always ends, whatever happens ---------- */
const rowOf = (id) => sql.prepare(`SELECT * FROM gcal_reviews WHERE id = ?`).get(id);
const aiOf = (id) => JSON.parse(rowOf(id).ai);
const TOO_LONG = 'The AI review took too long. Try again.';
const ago = (ms) => new Date(Date.now() - ms).toISOString();
let tn = 0; const trainee = () => ({ username: 'tr' + (++tn), userType: 'Trainee', fullName: 'Trainee ' + tn, batchId: 'B2' });
const submit = async (c = cal, bg = null) => { __setSession(trainee()); const x = await call('POST', { action: 'submit', track: 'standard', calendar: c }, '', bg); return x.j.id; };
const quiet = async (f) => { const e = console.error; console.error = () => {}; try { return await f(); } finally { console.error = e; } };
let bg = [], id;

queue.push('hang'); calls = 0; bg = []; id = await submit(cal, bg);
ck(rowOf(id).ai_status === 'pending', 'the trainee gets their answer at once: the review is written after it');
await settle(bg);
ck(rowOf(id).ai_status === 'error' && aiOf(id).error === TOO_LONG && calls === 1, 'an AI call that never answers is cut off at the deadline: the row ends as an error, not pending');

fault = { re: /^UPDATE gcal_reviews SET ai = \?/, n: 1 }; await quiet(async () => { id = await submit(); }); fault = null;
ck(rowOf(id).ai_status === 'done' && aiOf(id).summary === 'Mostly right.', 'a D1 hiccup on the final write is tried again: the review still lands');

fault = { re: /^UPDATE gcal_reviews SET ai = \?/, n: 3 }; await quiet(async () => { id = await submit(); }); fault = null;
ck(rowOf(id).ai_status === 'pending', 'if the write never works the row stays pending (as when the Worker is stopped) …');
__setSession(bo); r = await call('GET', null, '?id=' + id);
ck(r.j.review.aiStatus === 'pending' && r.j.review.ai === null, '… and a fresh pending row shows as pending, without an AI review');
sql.exec(`UPDATE gcal_reviews SET updated_at = '${ago(3 * 60000)}' WHERE id = ${id}`);
r = await call('GET', null, '?id=' + id); ck(r.j.review.aiStatus === 'error' && r.j.review.ai.error === TOO_LONG, '… and once it is stale the trainer sees an error, with the reason');
r = await call('GET', null, '?all=1'); ck(r.j.reviews.find(x => x.id === id).aiStatus === 'error', 'the trainer\'s list says the same');
__setSession({ username: 'tr' + tn, userType: 'Trainee' }); r = await call('GET'); ck(r.j.reviews[0].aiStatus === 'error' && r.j.reviews[0].ai === undefined, 'the trainee sees it is no longer being written, and nothing of the AI review');

fault = { re: /FROM gcal_review_rules/, n: 1 }; calls = 0; id = await submit(); fault = null;
ck(rowOf(id).ai_status === 'error' && calls === 0, 'a D1 error before the AI is asked also ends as an error, not pending');

// stale or fresh: what the trainer can do about a review that is still pending
queue.push('hang'); bg = []; id = await submit(cal, bg);
__setSession(bo);
r = await call('POST', { action: 'finalize', id }); ck(r.st === 409, 'a review that is still being written (just started) can\'t be sent yet');
const t0 = rowOf(id).updated_at;
r = await call('POST', { action: 'trainer', id, notes: 'typing while it waits' }); await new Promise(x => setTimeout(x, 5));
ck(r.st === 200 && rowOf(id).updated_at === t0, 'the trainer\'s notes while it is pending don\'t move the clock the review is judged by');
r = await call('POST', { action: 'retry', id }); ck(r.st === 409, 'and a retry is refused while it is running');
await settle(bg);   // (the hung call is cut off at the deadline: an error now)
sql.exec(`UPDATE gcal_reviews SET ai_status = 'pending', ai = NULL, updated_at = '${ago(5 * 60000)}' WHERE id = ${id}`);
r = await call('POST', { action: 'finalize', id }); ck(r.st === 200 && rowOf(id).status === 'final' && rowOf(id).ai_status === 'error', 'a stale one can be sent without the AI review (recorded as an error)');
r = await call('POST', { action: 'reopen', id });
sql.exec(`UPDATE gcal_reviews SET ai_status = 'pending', updated_at = '${ago(5 * 60000)}' WHERE id = ${id}`);
bg = []; r = await call('POST', { action: 'retry', id }, '', bg); await settle(bg);
ck(r.st === 200 && rowOf(id).ai_status === 'done', 'a stale one can be run again');

/* ---------- a gateway "wait" or a blip is tried again (inside the same background run) ---------- */
calls = 0; queue.push(gw(429, 'The AI is busy right now. Wait a few seconds and try again.', 'minute'), gw(502, 'relay down'));
id = await submit(); ck(rowOf(id).ai_status === 'done' && calls === 3, 'a per-minute refusal and then a blip are waited out: the third try writes the review');
calls = 0; queue.push(new Error('network reset')); id = await submit(); ck(rowOf(id).ai_status === 'done' && calls === 2, 'a call that throws is tried again');
calls = 0; fail = true; id = await submit(); fail = false; ck(rowOf(id).ai_status === 'error' && aiOf(id).error === 'Gemini down' && calls === 3, 'a failure that lasts ends as an error after three tries, with the gateway\'s reason');
calls = 0; queue.push(gw(429, 'The shared AI budget for today is used up.', 'daily')); id = await submit(); ck(rowOf(id).ai_status === 'error' && calls === 1, 'a daily budget refusal is not worth trying again');
calls = 0; queue.push(gw(429, 'You have made a lot of AI requests in a short time.', 'user')); id = await submit(); ck(rowOf(id).ai_status === 'error' && calls === 1, 'nor a per-person one');
calls = 0; queue.push(gw(400, 'Bad request')); id = await submit(); ck(rowOf(id).ai_status === 'error' && calls === 1, 'nor a request the AI refused');

/* ---------- valid JSON in the wrong shape is not a finished review ---------- */
const answered = async (text) => { calls = 0; queue.push(reply(text)); const i = await submit(); return { i, calls, st: rowOf(i).ai_status, ai: aiOf(i) }; };
const one1 = { summary: 'Two good points.', correct: ['Booked Maria'], improve: ['Add the DOB'], missed: ['No reminder'] };
let a = await answered('{}'); ck(a.st === 'error' && a.calls === 1 && /empty|could not be read/.test(a.ai.error), 'an answer of {} is an error (not a blank review the trainer could send)');
a = await answered(JSON.stringify([one1])); ck(a.st === 'done' && a.ai.summary === 'Two good points.' && a.ai.correct[0] === 'Booked Maria' && a.ai.missed.length === 1, 'a one-element array is unwrapped');
a = await answered(JSON.stringify({ review: one1 })); ck(a.st === 'done' && a.ai.improve[0] === 'Add the DOB', 'a lone wrapper object ({"review":{…}}) is unwrapped');
a = await answered(JSON.stringify({ result: [one1] })); ck(a.st === 'done' && a.ai.summary === 'Two good points.', 'a wrapper around an array is unwrapped too');
a = await answered(JSON.stringify({ summary: 'Fine.', correct: 'All booked correctly', improve: [], missed: [] })); ck(a.st === 'done' && a.ai.correct.length === 1 && a.ai.correct[0] === 'All booked correctly', 'a string where a list belongs is a one-item list');
a = await answered(JSON.stringify({ summary: '', correct: [{ appointment: 'Maria Santos', comment: 'Right slot.' }, { point: 'Titles are right' }], improve: [], missed: [] })); ck(a.st === 'done' && a.ai.correct[0] === 'Maria Santos: Right slot.' && a.ai.correct[1] === 'Titles are right', 'items with other keys are kept, not dropped');
a = await answered(JSON.stringify({ summary: 'Only a summary.' })); ck(a.st === 'done' && a.ai.summary === 'Only a summary.' && a.ai.correct.length === 0, 'a summary alone is a review');
a = await answered(JSON.stringify({ done_correctly: ['x'], needs_improvement: ['y'], requirements_missed: ['z'] })); ck(a.st === 'error', 'other key names with nothing under the right ones are an error');
for (const bad of ['[]', 'null', '"All good."', '7', 'I could not review this calendar.', '[[]]', '{"summary":"","correct":[],"improve":[],"missed":[]}']) { a = await answered(bad); ck(a.st === 'error' && a.calls === 1, 'an answer that is not a review is an error: ' + bad); }

/* ---------- retry: one run at a time, and it keeps the review it replaces ---------- */
const defer = () => { let go; const p = new Promise(res => { go = res; }); return { p, go }; };
fail = true; id = await submit(); fail = false; __setSession(bo); calls = 0; bg = [];
const [c1, c2] = await Promise.all([call('POST', { action: 'retry', id }, '', bg), call('POST', { action: 'retry', id }, '', bg)]); await settle(bg);
ck([c1.st, c2.st].sort().join() === '200,409' && calls === 1 && rowOf(id).ai_status === 'done', 'a double click starts one run, not two (the other gets "already being written")');

id = await submit(); __setSession(bo); let d = defer(); queue.push(() => d.p); bg = [];
r = await call('POST', { action: 'retry', id }, '', bg);
ck(r.st === 200 && rowOf(id).ai_status === 'pending' && aiOf(id).summary === 'Mostly right.', 'a retry on a finished review leaves it in place while the new one is written');
r = await call('GET', null, '?id=' + id); ck(r.j.review.aiStatus === 'pending' && r.j.review.ai === null, '(the trainer\'s page shows the wait)');
d.go(reply({ summary: 'A second opinion.', correct: ['x'], improve: [], missed: [] })); await settle(bg);
ck(rowOf(id).ai_status === 'done' && aiOf(id).summary === 'A second opinion.', 'and the new one replaces it when it is ready');

queue.push(gw(502, 'relay down'), gw(502, 'relay down'), gw(502, 'relay down')); bg = [];
r = await call('POST', { action: 'retry', id }, '', bg); await settle(bg);
ck(rowOf(id).ai_status === 'done' && aiOf(id).summary === 'A second opinion.' && aiOf(id).retryError === 'relay down', 'a retry that fails does not wipe the review it was replacing');

fail = true; id = await submit(); __setSession(bo); queue.push(gw(502, 'still down'), gw(502, 'still down'), gw(502, 'still down')); bg = []; fail = false;
r = await call('POST', { action: 'retry', id }, '', bg); await settle(bg);
ck(rowOf(id).ai_status === 'error' && aiOf(id).error === 'still down', 'a retry of an error that fails again is an error again');

// a run that was cut off (stale) and then replaced can't write over its replacement if it wakes up late
const zombie = defer(); queue.push(() => zombie.p); bg = []; id = await submit(cal, bg);
sql.exec(`UPDATE gcal_reviews SET updated_at = '${ago(3 * 60000)}' WHERE id = ${id}`);
__setSession(bo); const bg2 = []; r = await call('POST', { action: 'retry', id }, '', bg2); await settle(bg2);
ck(r.st === 200 && aiOf(id).summary === 'Mostly right.', 'a review stuck for minutes is run again');
zombie.go(reply({ summary: 'Late and stale.', correct: ['z'], improve: [], missed: [] })); await settle(bg);
ck(aiOf(id).summary === 'Mostly right.' && rowOf(id).ai_status === 'done', 'the old run\'s late answer does not overwrite the newer review');
r = await call('POST', { action: 'finalize', id }); r = await call('POST', { action: 'retry', id }); ck(r.st === 409, 'a final report can\'t be run again');

/* ---------- drafts: an older copy never overwrites a newer one ---------- */
const dd = { username: 'dd', userType: 'Trainee', fullName: 'Dee', batchId: 'B2' }; __setSession(dd);
const wait = () => new Promise(x => setTimeout(x, 5));
const draft = (track, events, base) => call('POST', Object.assign({ action: 'draft', track, data: { v: 1, events, savedAt: Date.now() } }, base === undefined ? {} : { base }));
r = await draft('standard', [{ id: 'a' }]); const u1 = r.j.updatedAt; ck(r.st === 200 && typeof u1 === 'string', 'a save without a base (an older page) works as before');
await wait(); r = await draft('standard', [{ id: 'a' }, { id: 'b' }], u1); const u2 = r.j.updatedAt; ck(r.st === 200 && u2 > u1, 'a save made from the copy that is stored works');
await wait(); r = await draft('standard', [{ id: 'a' }], u1);
ck(r.st === 409 && r.j.success === false && r.j.code === 'DRAFT_NEWER' && r.j.updatedAt === u2 && /newer/i.test(r.j.error), 'a save made from an older copy (another tab or device saved since) is refused: 409 DRAFT_NEWER with the stored time');
r = await call('GET', null, '?draft=standard'); ck(r.j.data.events.length === 2 && r.j.updatedAt === u2, 'and the newer copy is still there');
r = await draft('standard', [{ id: 'a' }, { id: 'b' }, { id: 'c' }], u2); ck(r.st === 200, 'once the page has the newer copy, its saves go through');
r = await draft('standard', [{ id: 'z' }]); ck(r.st === 200, 'a save without a base still wins, as before');
r = await draft('ea', [{ id: 'e' }], '2020-01-01T00:00:00.000Z'); ck(r.st === 200, 'the first save of a track always works, whatever its base');
r = await draft('cm', [{ id: 'e' }], 'not a date'); ck(r.st === 200, 'a base that is not a date is ignored');
r = await draft('standard', [{ id: 'q' }], null); ck(r.st === 200, 'so is an empty one');
r = await call('GET', null, '?draft=standard'); ck(r.j.data.events[0].id === 'q' && typeof r.j.updatedAt === 'string', 'GET ?draft= still returns the copy and its updatedAt');

/* ---------- the size of a submission, and what is checked in it ---------- */
const many = (n) => ({ program: 'Standard Training', score: 60, appointments: Array.from({ length: n }, (_, i) => ({ title: 'Consultation ' + i, date: '2026-10-07', description: 'd'.repeat(1500) })), automatedCheck: { results: [] } });
__setSession(trainee());
r = await call('POST', { action: 'submit', calendar: many(100) }); ck(r.st === 200, 'a Standard Training calendar with 100 appointments (150,000 characters) is accepted');
const big = r.j.id; const inCal = /<calendar>\n([\s\S]*)\n<\/calendar>/.exec(seen.messages[0].text)[1];
ck(inCal.length === 60000, 'the AI is given at most 60,000 characters of it');
__setSession(bo); r = await call('GET', null, '?id=' + big); ck(r.j.review.calendar.appointments.length === 100, 'the trainer gets all of it');
__setSession(trainee()); r = await call('POST', { action: 'submit', calendar: many(140) }); ck(r.st === 400 && /too large/.test(r.j.error), 'one over 200,000 characters is refused');
r = await call('POST', { action: 'submit', calendar: [1, 2] }); ck(r.st === 400, 'a calendar that is not an object is refused');

const hostile = { score: 'abc', program: 'S'.repeat(5000), week: { from: '2026-10-05', to: 'x', today: 'nope', events: [
    { t: 'Session expired', d: '2026-10-06', s: '09:00', e: '10:00', c: 'red;position:fixed!important;inset:0!important;z-index:9999!important', mine: true, cal: 'x' },
    { t: 'Consultation', d: '2026-10-07', s: '10:00', e: '11:00', c: '#F4511e', mine: false, cal: 'Attorney’s Calendar', meet: true },
    { t: 'url', d: '2026-10-07', s: '12:00', e: '13:00', c: 'url(https://evil.example/x)' },
    { t: 'no date', d: 'x', s: '09:00', e: '10:00' }, { t: 'impossible date', d: '2026-02-30', s: '09:00', e: '10:00' },
    { t: 'bad times', d: '2026-10-08', s: '9am', e: 'zz' }, { t: 'half', d: '2026-10-08', s: '14:00', e: '2pm' }, 'junk', null] },
    appointments: [{ title: 'Consultation – Maria Santos', notifications: 'email 1 day before', guests: [1, 'a@b.co', { x: 1 }], description: 'D'.repeat(5000) }, 'junk', 7],
    requests: 'none',
    automatedCheck: { score: 50, results: [{ request: 'R1', met: 'one string', missed: ['m'] }, 'junk', { request: 'R2' }], changedWithoutARequest: 'x', attorneyAppointmentsChanged: null } };
__setSession(trainee()); r = await call('POST', { action: 'submit', track: 'standard', calendar: hostile }); ck(r.st === 200, 'a submission with several bad fields is still accepted (the bad fields are fixed or dropped)');
__setSession(bo); let hc = (await call('GET', null, '?id=' + r.j.id)).j.review; const cc = hc.calendar, w = cc.week;
ck(hc.checkScore === null && cc.score === undefined && cc.program.length === 2000, 'a score that is no number is no score; long text is capped');
ck(w.from === '2026-10-05' && w.to === '2026-10-25' && w.today === undefined, 'the week keeps a real start date, gets a sensible end, and loses a today that is not a date');
ck(w.events.length === 5 && w.events.every(e => /^\d{4}-\d{2}-\d{2}$/.test(e.d)) && !w.events.some(e => /impossible|no date/.test(e.t)), 'events without a real date (x, 2026-02-30) are dropped, and so are the non-objects');
ck(w.events.every(e => e.c === undefined || /^#[0-9a-f]{3,8}$/i.test(e.c)) && w.events[1].c === '#F4511e' && w.events[0].c === undefined && w.events[2].c === undefined, 'a colour is #hex or none (the style-attribute and url() values are gone); a real one stays');
ck(JSON.stringify(w.events).indexOf('position:fixed') < 0 && JSON.stringify(w.events).indexOf('evil.example') < 0, '… nothing of them is stored');
ck(w.events[3].s === '' && w.events[3].e === '' && w.events[4].s === '14:00' && w.events[4].e === '', 'times are HH:MM or the event is all-day / has no end');
ck(cc.appointments.length === 1 && cc.appointments[0].notifications.join() === 'email 1 day before' && cc.appointments[0].guests.join() === '1,a@b.co' && cc.appointments[0].description.length === 2000, 'appointments are objects with lists as lists and capped text');
ck(Array.isArray(cc.requests) && cc.requests.length === 0, 'requests that are not a list become none');
const ac = cc.automatedCheck; ck(ac.results.length === 2 && ac.results[0].met.join() === 'one string' && ac.results[0].missed.join() === 'm' && ac.changedWithoutARequest.join() === 'x' && Array.isArray(ac.attorneyAppointmentsChanged) && ac.attorneyAppointmentsChanged.length === 0, 'the automated check always has lists where the page maps over them');
__setSession(trainee()); r = await call('POST', { action: 'submit', track: 'standard', calendar: { week: { from: 'x', to: 'x', events: [] }, appointments: [], automatedCheck: 'oops' } });
__setSession(bo); hc = (await call('GET', null, '?id=' + r.j.id)).j.review;
ck(r.st === 200 && hc.calendar.week === undefined && hc.calendar.automatedCheck === undefined && hc.calendar.appointments.length === 0, 'a week with no real date is left out (the page says the view is missing) and a check that is no object too: the submission still opens');
const good = { week: { from: '2026-10-05', to: '2026-10-25', today: '2026-10-06', events: [{ t: 'Consultation – Maria', d: '2026-10-07', s: '09:00', e: '10:00', c: '#039be5', mine: true, cal: 'LSH Calendar', meet: false }] }, appointments: [], automatedCheck: { score: 80, results: [] } };
__setSession(trainee()); r = await call('POST', { action: 'submit', track: 'standard', calendar: good }); __setSession(bo); hc = (await call('GET', null, '?id=' + r.j.id)).j.review;
ck(JSON.stringify(hc.calendar.week) === JSON.stringify(good.week), 'a week as the simulator sends it is stored as it came');

/* ---------- Progress: each trainee's LATEST evaluation, however many rows there are ---------- */
let pp = fs.readFileSync('functions/api/program-progress.js', 'utf8')
    .replace("import { json, requireSession, logActivity } from '../_utils.js';", "const json=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json',...h}});const requireSession=async()=>({ok:true,session:{username:'boss',userType:'Admin'}});const logActivity=async()=>{};")
    .replace("import { driveConfigured, saveBatchToDrive } from '../_drive.js';", "const driveConfigured=()=>false;const saveBatchToDrive=async()=>({});");
if (/from '\.\.\//.test(pp)) throw new Error('the test could not stub program-progress.js imports');
fs.writeFileSync(path.join(tmp, 'program-progress.mjs'), pp);
const prog = await import(pathToFileURL(path.join(tmp, 'program-progress.mjs')).href);
sql.exec(`CREATE TABLE users (username TEXT, first_name TEXT, last_name TEXT)`);
sql.exec(`CREATE TABLE calsim_records (username TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)`);
sql.exec(`INSERT INTO users VALUES ('late', 'Late', 'Learner'), ('zed', 'Zed', 'Recent')`);
const ins = (user, track, at, score, status, trainer) => sql.prepare(`INSERT INTO gcal_reviews (username, name, batch, track, submitted_at, calendar, check_score, ai_status, trainer, status, updated_at) VALUES (?, ?, 'B1', ?, ?, '{}', ?, 'done', ?, ?, ?)`).run(user, user, track, at, score, trainer || null, status, at);
ins('late', 'standard', '2026-09-01T10:00:00.000Z', 40, 'submitted'); ins('late', 'cm', '2026-09-02T10:00:00.000Z', 55, 'submitted');
sql.exec(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 5200) INSERT INTO gcal_reviews (username, name, batch, track, submitted_at, calendar, check_score, ai_status, status, updated_at)
    SELECT 'bulk' || (i % 60), 'Bulk ' || (i % 60), 'B1', 'standard', '2026-09-15T00:00:00.000Z', '{}', 50, 'done', 'submitted', '2026-09-15T00:00:00.000Z' FROM n`);   // 5,200 rows from 60 trainees
ins('late', 'standard', '2026-10-05T10:00:00.000Z', 90, 'final', JSON.stringify({ score: 88, notes: 'Great week.' }));   // id well past 5,000
// 1,100 older calendar records and one newer: the read of 1,000 has to be the most recent ones
sql.exec(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1100) INSERT INTO calsim_records (username, data, updated_at) SELECT 'old' || i, '{}', '2026-08-01T00:00:00.000Z' FROM n`);
sql.prepare(`INSERT INTO calsim_records (username, data, updated_at) VALUES ('zed', ?, '2026-10-06T00:00:00.000Z')`).run(JSON.stringify({ gsubs: [{ track: 'standard', at: '2026-10-06T09:00:00.000Z', result: { score: 66 } }] }));
const pr = await (await prog.onRequestGet({ request: new Request('https://p/api/program-progress'), env: { TRAINING_DB: env.TRAINING_DB, DB: env.TRAINING_DB } })).json();
const late = pr.calsim.byName['late learner'];
const std = late && late.ft && late.ft.weeks.filter(x => x.label === 'Google Calendar · Standard Training');
ck(std && std.length === 1 && std[0].auto === 90 && std[0].score === 88 && std[0].comment === 'Great week.' && std[0].at === '2026-10-05T10:00:00.000Z', 'Progress shows the trainee\'s newest Standard Training evaluation (its score and the trainer\'s), though it is past row 5,000');
ck(late.cm && late.cm.weeks.length === 1 && late.cm.weeks[0].auto === 55, 'and the latest of each other track');
const zed = pr.calsim.byName['zed recent']; ck(zed && zed.ft && zed.ft.weeks[0].auto === 66, 'the calendar records read are the most recently saved ones, not whichever the table lists first');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails.length ? 'FAILED' : 'all passed'); process.exit(fails.length ? 1 : 0);

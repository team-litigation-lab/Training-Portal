// 📤 Submit for evaluation (functions/api/gcal-reviews.js) on SQLite, with the AI answered by the test: a trainee submits and the AI
// review is written from the calendar and the trainer's rules; the trainee sees nothing of the feedback until the trainer finalizes it;
// only admins list, open, write feedback, finalize, reopen and set the rules; a failed AI review can be run again. A trainee's calendar
// saved to their account comes back to them; a trainer opens anyone's (and lists whose are saved), a trainee only their own.
// Run: node --no-warnings .github/scripts/gcal-reviews.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
let s = fs.readFileSync('functions/api/gcal-reviews.js', 'utf8')
    .replace("import { json, requireSession } from '../_utils.js';", "const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json'}});let CUR=null;const requireSession=async()=>CUR?{ok:true,session:CUR}:{ok:false,response:json({success:false},401)};globalThis.__setSession=(x)=>{CUR=x};")
    .replace("import { runAi } from '../_ai-gateway.js';", "const runAi=(...a)=>globalThis.__ai(...a);");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gr-')); fs.writeFileSync(path.join(tmp, 'gcal-reviews.mjs'), s);
const m = await import(pathToFileURL(path.join(tmp, 'gcal-reviews.mjs')).href);
const sql = new DatabaseSync(':memory:');
const mk = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => { const r = sql.prepare(q).run(...a); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } }; }, first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const env = { TRAINING_DB: { prepare: mk }, AI_REVIEW_RETRY_MS: '1' };
let seen = null, fail = false, tries = 0, busy = 0;   // busy: how many more times the keys answer "at their limit"
globalThis.__ai = async (db, e, o) => { seen = o; tries++; if (busy > 0) { busy--; return { status: 429, body: { success: false, error: 'AI generation limit reached. Try again in a minute.' } }; }
    return fail ? { status: 502, body: { success: false, error: 'Gemini down' } }
    : { status: 200, body: { success: true, text: '```json\n' + JSON.stringify({ summary: 'Mostly right.', correct: ['Booked Maria on the Attorney’s Calendar'], improve: ['Add the DOB'], missed: ['No email reminder'] }) + '\n```' } }; };
const call = async (meth, body, qs = '') => { const req = new Request('https://p/api/gcal-reviews' + qs, { method: meth, body: body ? JSON.stringify(body) : undefined });
    const r = await (meth === 'GET' ? m.onRequestGet : m.onRequestPost)({ request: req, env }); return { st: r.status, j: await r.json() }; };
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
tries = 0; busy = 2;
r = await call('POST', { action: 'retry', id: 2 }); r = await call('GET', null, '?id=2'); ck(r.j.review.aiStatus === 'done' && tries === 3, `with every key at its limit for a moment, the AI review tries again by itself (${tries} tries)`);
tries = 0; fail = true;
r = await call('POST', { action: 'retry', id: 2 }); r = await call('GET', null, '?id=2'); ck(r.j.review.aiStatus === 'error' && tries === 3, `a review that keeps failing stops after 3 tries and is marked (${tries})`);
fail = false; tries = 0;
r = await call('POST', { action: 'reopen', id: 1 }); r = await call('GET', null, '?id=1'); ck(r.j.review.status === 'submitted', 'the trainer can reopen a final report');
__setSession(ann);
r = await call('POST', { action: 'submit', calendar: { blob: 'x'.repeat(70000) } }); ck(r.st === 400, 'a calendar too large is refused');
// 💾 the calendar saved to the trainee's account (so their work isn't lost), one per person and track
r = await call('GET', null, '?draft=standard'); ck(r.st === 200 && r.j.data === null, 'nothing saved yet');
r = await call('POST', { action: 'draft', track: 'standard', data: { v: 1, events: [{ id: 'e1', title: 'Case Status Update – Maria Santos' }], savedAt: 5 } }); ck(r.st === 200, 'a trainee saves their calendar');
r = await call('POST', { action: 'draft', track: 'cm', data: { v: 1, events: [], savedAt: 6 } });
r = await call('GET', null, '?draft=standard'); ck(r.j.data.events[0].id === 'e1' && r.j.data.savedAt === 5, 'it comes back (the Standard Training one)');
r = await call('POST', { action: 'draft', track: 'standard', data: { v: 1, events: [{ id: 'e1' }, { id: 'e2' }], savedAt: 9 } }); r = await call('GET', null, '?draft=standard'); ck(r.j.data.events.length === 2, 'a later save replaces it');
__setSession({ username: 'cy', userType: 'Trainee', fullName: 'Cy', batchId: 'B1' });
r = await call('GET', null, '?draft=standard'); ck(r.j.data === null, 'another trainee gets their own (none), never Ann\'s');
r = await call('GET', null, '?draft=standard&user=ann'); ck(r.st === 403, 'a trainee cannot open another trainee\'s calendar');
r = await call('GET', null, '?drafts=1'); ck(r.st === 403, 'a trainee cannot list whose calendars are saved');
__setSession(bo);
r = await call('GET', null, '?draft=standard&user=ann'); ck(r.st === 200 && r.j.data.events.length === 2 && r.j.person && r.j.person.name === 'ann' && r.j.updatedAt, 'a trainer opens a trainee\'s calendar as they last saved it, with who they are');
r = await call('GET', null, '?draft=ea&user=ann'); ck(r.st === 200 && r.j.data === null, 'a simulator they haven\'t saved on is empty');
r = await call('GET', null, '?drafts=1'); ck(r.st === 200 && r.j.drafts.length === 2 && r.j.drafts.every(d => d.username === 'ann' && d.name === 'ann' && d.updatedAt) && r.j.drafts.map(d => d.track).sort().join() === 'cm,standard', 'a trainer lists whose calendars are saved, on which simulator and when');
__setSession({ username: 'cy', userType: 'Trainee', fullName: 'Cy', batchId: 'B1' });
r = await call('POST', { action: 'draft', track: 'standard', data: { big: 'x'.repeat(310000) } }); ck(r.st === 400, 'a calendar too large to save is refused');
__setSession(null); r = await call('GET', null, '?draft=standard'); ck(r.st === 401, 'no Portal sign-in, nothing saved or read');
console.log(fails.length ? 'FAILED' : 'all passed'); process.exit(fails.length ? 1 : 0);

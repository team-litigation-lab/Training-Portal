// ✍ Drafting letters saved to the trainee's account (functions/api/drafting-drafts.js), on SQLite: signed out, nothing; a trainee
// saves a letter and gets it back (in another browser: the same request); the list of their letters; an older copy never
// overwrites a newer one (409 DRAFT_NEWER, nothing changed) while a copy made from the latest is saved; another trainee sees
// none of it; an admin can open a trainee's letter, a trainee can't open anyone else's; Start over deletes it; bad letter ids
// and oversized letters are refused; an uploaded PDF or Word file is kept, opened as itself and listed for the trainer.
// Run: node --no-warnings .github/scripts/drafting-drafts.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
const src = fs.readFileSync('functions/api/drafting-drafts.js', 'utf8')
    .replace("import { json, requireSession } from '../_utils.js';", "const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json'}});let CUR=null;const requireSession=async()=>CUR?{ok:true,session:CUR}:{ok:false,response:json({success:false,code:'NOT_AUTHENTICATED'},401)};globalThis.__setSession=(x)=>{CUR=x};");
if (!/globalThis.__setSession/.test(src)) throw new Error('the test could not stand in for the session: update it with drafting-drafts.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-')); fs.writeFileSync(path.join(tmp, 'drafting-drafts.mjs'), src);
const m = await import(pathToFileURL(path.join(tmp, 'drafting-drafts.mjs')).href);
const sql = new DatabaseSync(':memory:');
const mk = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => { const r = sql.prepare(q).run(...a); return { meta: { changes: r.changes } }; }, first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const accounts = new DatabaseSync(':memory:');
accounts.exec(`CREATE TABLE users (username TEXT, first_name TEXT, last_name TEXT, batch_id TEXT); INSERT INTO users VALUES ('ann', 'Ann', 'Lee', 'B102226');`);
const mkA = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, all: async () => ({ results: accounts.prepare(q).all(...a) }) }; return o; };
const env = { TRAINING_DB: { prepare: mk }, DB: { prepare: mkA } };
const call = async (meth, body, qs = '') => { const req = new Request('https://p/api/drafting-drafts' + qs, { method: meth, body: body ? JSON.stringify(body) : undefined });
    const r = await (meth === 'GET' ? m.onRequestGet : m.onRequestPost)({ request: req, env }); return { st: r.status, j: await r.json() }; };
const fails = []; const ck = (o, t) => { console.log((o ? 'PASS ' : 'FAIL ') + t); if (!o) fails.push(t); };
const ann = { username: 'ann', userType: 'Trainee' }, cy = { username: 'cy', userType: 'Trainee' }, bo = { username: 'boss', userType: 'Admin' };
const letter = (z, at) => JSON.stringify({ z, at });
const nap = (ms) => new Promise(r => setTimeout(r, ms));

__setSession(null);
let r = await call('POST', { action: 'draft', letter: 'lor1p', data: letter('AAA', '1') }); ck(r.st === 401, 'signed out: nothing is saved');
__setSession(ann);
r = await call('GET', null, '?letter=lor1p'); ck(r.st === 200 && r.j.data === null && r.j.updatedAt === null, 'nothing saved yet: no letter');
r = await call('POST', { action: 'draft', letter: 'lor1p', data: letter('AAA', '1'), base: null }); ck(r.st === 200 && !!r.j.updatedAt, 'a trainee saves a letter');
const first = r.j.updatedAt;
r = await call('GET', null, '?letter=lor1p'); ck(r.j.data === letter('AAA', '1') && r.j.updatedAt === first, 'and gets it back exactly as sent (another browser asks the same)');
await nap(5);
r = await call('POST', { action: 'draft', letter: 'lor1p', data: letter('BBB', '2'), base: first }); ck(r.st === 200, 'a copy made from the latest is saved');
const second = r.j.updatedAt;
r = await call('POST', { action: 'draft', letter: 'lor1p', data: letter('OLD', '0'), base: first }); ck(r.st === 409 && r.j.code === 'DRAFT_NEWER' && r.j.updatedAt === second, 'an older copy (another tab) is refused: DRAFT_NEWER');
r = await call('GET', null, '?letter=lor1p'); ck(JSON.parse(r.j.data).z === 'BBB', 'and the newer copy is untouched');
r = await call('POST', { action: 'draft', letter: 'prov:akers-chiropractic:medlor', data: letter('MMM', '3') }); ck(r.st === 200, 'a provider\'s letter is saved under its own id');
r = await call('POST', { action: 'draft', letter: '_state', data: JSON.stringify({ caseNo: 2, answers: {} }) }); ck(r.st === 200, 'the page\'s own choices are saved too');
r = await call('GET'); ck(r.j.letters.length === 3 && r.j.letters.every(l => l.updatedAt), 'the trainee lists their saved letters');
r = await call('POST', { action: 'draft', letter: '../etc', data: letter('X', '1') }); ck(r.st === 400, 'a letter id that isn\'t one is refused');
r = await call('POST', { action: 'draft', letter: 'lor3p', data: 'x'.repeat(400001) }); ck(r.st === 400, 'an oversized letter is refused');
r = await call('POST', { action: 'draft', letter: 'lor3p', data: '' }); ck(r.st === 400, 'an empty one too');
r = await call('GET', null, '?letter=lor1p&user=cy'); ck(r.st === 403, 'a trainee can\'t open another trainee\'s letter');
__setSession(cy);
r = await call('GET', null, '?letter=lor1p'); ck(r.j.data === null, 'another trainee sees none of it');
r = await call('GET'); ck(r.j.letters.length === 0, 'nor in their list');
__setSession(bo);
r = await call('GET', null, '?letter=lor1p&user=ann'); ck(r.st === 200 && JSON.parse(r.j.data).z === 'BBB', 'a trainer opens a trainee\'s letter');
__setSession(ann);
r = await call('POST', { action: 'delete', letter: 'lor1p' }); ck(r.st === 200, 'Start over deletes the saved letter');
r = await call('GET', null, '?letter=lor1p'); ck(r.j.data === null, 'and it is gone');
r = await call('POST', { action: 'draft', letter: 'lor1p', data: letter('NEW', '9'), base: second }); ck(r.st === 200, 'after Start over, the next save starts it again');

// a PDF edited in Nitro Pro, saved back as '<letter>:pdf': bigger than a letter, opened as the PDF itself, listed for the trainer
const pdf = Buffer.from('%PDF-1.7 test').toString('base64');
r = await call('POST', { action: 'draft', letter: 'lor1p:pdf', data: JSON.stringify({ name: 'INS – 1P.pdf', b64: pdf, at: '1' }) }); ck(r.st === 200, 'a trainee saves their edited PDF');
r = await call('POST', { action: 'draft', letter: 'lor3p:pdf', data: 'x'.repeat(1000000) }); ck(r.st === 200, 'a PDF may be bigger than a letter');
r = await call('POST', { action: 'draft', letter: 'lor3p:pdf', data: 'x'.repeat(1900001) }); ck(r.st === 400, 'but not over the limit');
const raw = async (qs) => m.onRequestGet({ request: new Request('https://p/api/drafting-drafts' + qs), env });
let res = await raw('?letter=lor1p:pdf&raw=1');
ck(res.status === 200 && res.headers.get('Content-Type') === 'application/pdf' && Buffer.from(await res.arrayBuffer()).toString() === '%PDF-1.7 test'
    && /^inline; filename="INS _ 1P\.pdf"$/.test(res.headers.get('Content-Disposition')), 'the saved PDF opens as itself, its name plain ASCII');
r = await call('GET', null, '?pdfs=1'); ck(r.st === 403, 'a trainee can\'t list everyone\'s PDFs');
__setSession(bo);
r = await call('GET', null, '?pdfs=1'); ck(r.st === 200 && r.j.pdfs.length === 2 && r.j.pdfs.every(x => x.username === 'ann' && x.name === 'Ann Lee' && x.batch === 'B102226' && /:pdf$/.test(x.letter)), 'the trainer lists the trainees\' PDFs (and no letters), with their names and batch');
res = await raw('?letter=lor1p:pdf&raw=1&user=ann'); ck(res.status === 200 && Buffer.from(await res.arrayBuffer()).toString() === '%PDF-1.7 test', 'and opens one');
res = await raw('?letter=lor1p:pdf&raw=1&user=cy'); ck(res.status === 404, 'a PDF nobody saved: 404');
// a letter edited in any word processor and uploaded as '<letter>:docx': kept like a PDF, downloaded as the Word file, listed for the trainer
__setSession(ann);
r = await call('POST', { action: 'draft', letter: 'lor1p:docx', data: JSON.stringify({ name: 'INS – 1P.docx', b64: Buffer.from('PK word').toString('base64'), at: '2' }) }); ck(r.st === 200, 'a trainee saves their edited Word file');
r = await call('POST', { action: 'draft', letter: 'lor3p:docx', data: 'x'.repeat(1000000) }); ck(r.st === 200, 'a Word file may be bigger than a letter, as a PDF may');
res = await raw('?letter=lor1p:docx&raw=1');
ck(res.status === 200 && /wordprocessingml/.test(res.headers.get('Content-Type')) && Buffer.from(await res.arrayBuffer()).toString() === 'PK word'
    && /^attachment; filename="INS _ 1P\.docx"$/.test(res.headers.get('Content-Disposition')), 'the saved Word file downloads as itself');
__setSession(bo);
r = await call('GET', null, '?pdfs=1'); ck(r.st === 200 && r.j.pdfs.length === 4 && r.j.pdfs.filter(x => /:docx$/.test(x.letter)).length === 2, 'the trainer lists the Word files with the PDFs');

console.log(fails.length ? `\n${fails.length} failed` : '\nall passed');
process.exit(fails.length ? 1 : 0);

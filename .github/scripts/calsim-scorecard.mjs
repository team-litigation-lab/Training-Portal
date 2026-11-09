// The CALENDAR MANAGEMENT MOCK CALL scorecard shared with the Foundational Training (functions/api/calsim-scorecard.js), on SQLite:
// only a caller with the shared gateway secret; the trainee found by batch and full name (any case and spacing); a card saved there
// is kept with the Portal's own scorecards (and read back), all 7 metrics 0-5 required; no account: an empty list, or 404 on a save.
// Run: node --no-warnings .github/scripts/calsim-scorecard.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'css-'));
const JSON_FN = "const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json'}});";
fs.writeFileSync(path.join(tmp, 'calsim.js'), fs.readFileSync('functions/api/calsim.js', 'utf8').replace("import { json, requireSession } from '../_utils.js';", JSON_FN + "const requireSession=async()=>({ok:false,response:json({},401)});"));
fs.writeFileSync(path.join(tmp, 'calsim-scorecard.mjs'), fs.readFileSync('functions/api/calsim-scorecard.js', 'utf8')
    .replace("import { json, sameSecret } from '../_utils.js';", JSON_FN + "const sameSecret=(a,b)=>a===b;"));
const m = await import(pathToFileURL(path.join(tmp, 'calsim-scorecard.mjs')).href);
const sql = new DatabaseSync(':memory:');
const mk = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const db = { prepare: mk };
sql.exec(`CREATE TABLE users(username,first_name,last_name,batch_id,status)`);
sql.prepare(`INSERT INTO users VALUES('abesh','Abesh Dawn','Jamon','B103026','Approved')`).run();
sql.prepare(`INSERT INTO users VALUES('other','Abesh Dawn','Jamon','B090126','Approved')`).run();
const env = { TRAINING_DB: db, DB: db, AI_GATEWAY_SECRET: 'gw-secret' };
const call = async (meth, body, qs = '', key = 'gw-secret') => { const r = await (meth === 'GET' ? m.onRequestGet : m.onRequestPost)({ request: new Request('https://p/api/calsim-scorecard' + qs, { method: meth, headers: key ? { 'X-Gateway-Key': key } : {}, body: body ? JSON.stringify(body) : undefined }), env }); return { st: r.status, j: await r.json() }; };
const fails = []; const ck = (o, t) => { console.log((o ? 'PASS ' : 'FAIL ') + t); if (!o) fails.push(t); };
const rows = [5, 4, 4, 3, 4, 5, 4].map((v, i) => ({ score: v, feedback: i === 5 ? 'Add the reminder' : '' }));
let r = await call('GET', null, '?name=Abesh+Dawn+Jamon&batch=B103026', 'wrong'); ck(r.st === 401, 'a caller without the secret is refused');
r = await call('GET', null, '?name=Abesh+Dawn+Jamon&batch=B103026', ''); ck(r.st === 401, 'a caller with no key is refused');
r = await call('GET', null, '?name=Nobody&batch=B103026'); ck(r.st === 200 && r.j.username === '' && r.j.cards.length === 0, 'no Portal account: an empty list');
r = await call('GET', null, '?name=abesh%20dawn%20%20JAMON&batch=b103026'); ck(r.st === 200 && r.j.username === 'abesh' && r.j.cards.length === 0, 'the trainee found by batch and full name, any case and spacing');
r = await call('POST', { name: 'Abesh Dawn Jamon', batch: 'B103026', rows: rows.slice(1), by: 'Coach Tess' }); ck(r.st === 400, 'a scorecard missing a metric is refused');
r = await call('POST', { name: 'Abesh Dawn Jamon', batch: 'B103026', rows: rows.map((x, i) => i ? x : { score: 6 }) }); ck(r.st === 400, 'a score above 5 is refused');
r = await call('POST', { name: 'Nobody', batch: 'B103026', rows }); ck(r.st === 404, 'a save for no Portal account is refused');
r = await call('POST', { name: 'Abesh Dawn Jamon', batch: 'B103026', rows, by: 'Coach Tess' });
ck(r.st === 200 && r.j.card.average === 4.1 && r.j.card.pct === 83 && r.j.card.by === 'Coach Tess' && r.j.card.source === 'foundational' && r.j.card.rows[5].feedback === 'Add the reminder', 'a card from the Foundational Training is saved with its average');
r = await call('GET', null, '?name=Abesh+Dawn+Jamon&batch=B103026'); ck(r.j.cards.length === 1 && r.j.cards[0].pct === 83, 'and read back, on the trainee\'s Standard Training track');
const other = JSON.parse((sql.prepare(`SELECT data FROM calsim_records WHERE username = 'other'`).get() || { data: 'null' }).data);
ck(!other, 'the same name in another batch is left alone');
// a trainer's scorecard saved here is mirrored to the Foundational Training (functions/api/calsim.js mirrorToFt): its name, batch and card
{ const cs = await import(pathToFileURL(path.join(tmp, 'calsim.js')).href), sent = [], realFetch = globalThis.fetch;
  globalThis.fetch = async (u, init) => { sent.push({ u: String(u), key: init.headers['X-Gateway-Key'], body: JSON.parse(init.body) }); return new Response(JSON.stringify({ ok: true })); };
  const res = await cs.mirrorToFt(Object.assign({}, env, { FT_URL: 'https://ft.test/' }), 'abesh', { rows: [], pct: 80 });
  globalThis.fetch = realFetch;
  ck(res.ok && sent.length === 1 && sent[0].u === 'https://ft.test/api/calsim-card-in' && sent[0].key === 'gw-secret' && sent[0].body.name === 'Abesh Dawn Jamon' && sent[0].body.batch === 'B103026' && sent[0].body.card.pct === 80,
    'a trainer\'s scorecard is mirrored to the Foundational Training (name, batch, card, the secret)');
  const off = await cs.mirrorToFt(Object.assign({}, env, { AI_GATEWAY_SECRET: '' }), 'abesh', {}); ck(off.off === true, 'without the secret nothing is mirrored'); }
delete env.AI_GATEWAY_SECRET; r = await call('GET', null, '?name=Abesh+Dawn+Jamon&batch=B103026'); ck(r.st === 501, 'without the secret on the Portal: 501');
if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
console.log('\nCalendar scorecard (shared) test passed.');

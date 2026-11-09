// The Portal's announcement (functions/api/announcement.js), changed server to server by the Foundational Training platform:
// with the shared AI_GATEWAY_SECRET in X-Gateway-Key it is saved (and cleared), logged as foundational:<trainer>; a wrong key
// or no secret on the Portal is refused; without a key, a signed-in admin is still needed.
// Run: node --no-warnings .github/scripts/announcement-gateway.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ann-')), logs = [];
const PRE = "const json=(o,s)=>new Response(JSON.stringify(o),{status:s||200,headers:{'Content-Type':'application/json'}});const sameSecret=(a,b)=>a===b;"
    + "const requireSession=async()=>({ok:false,response:json({success:false,error:'Sign in'},401)});const logActivity=async(db,u,b,a,d)=>{globalThis.__logs.push([u,a,d]);};";
globalThis.__logs = logs;
fs.writeFileSync(path.join(tmp, 'a.mjs'), fs.readFileSync('functions/api/announcement.js', 'utf8').replace("import { json, requireSession, logActivity, sameSecret } from '../_utils.js';", PRE));
const m = await import(pathToFileURL(path.join(tmp, 'a.mjs')).href);
const db = new DatabaseSync(':memory:');
db.exec("CREATE TABLE site_settings (key TEXT PRIMARY KEY, value TEXT, updated_by TEXT, updated_at TEXT)");
const D1 = { prepare: (q) => { const st = db.prepare(q); let args = []; const o = { bind: (...a) => { args = a; return o; }, first: async () => st.get(...args) || null, run: async () => st.run(...args) }; return o; } };
const fails = [], ck = (ok, t) => { if (!ok) fails.push(t); };
const req = (method, body, key) => new Request('https://p/api/announcement', { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Gateway-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
const env = { TRAINING_DB: D1, DB: D1, AI_GATEWAY_SECRET: 'shh' };
let r = await m.onRequestPost({ request: req('POST', { text: 'Typing test at 9', by: 'Lei' }, 'shh'), env });
ck(r.status === 200, 'the platform\'s save was refused: ' + r.status);
r = await (await m.onRequestGet({ request: req('GET'), env })).json();
ck(r.text === 'Typing test at 9', 'the saved announcement isn\'t served: ' + JSON.stringify(r));
ck(logs.some(l => l[0] === 'foundational:Lei' && l[1] === 'ANNOUNCEMENT_SET'), 'the save wasn\'t logged as the platform\'s trainer: ' + JSON.stringify(logs));
r = await m.onRequestPost({ request: req('POST', { text: 'Hacked' }, 'wrong'), env });
ck(r.status === 401, 'a wrong key was let in: ' + r.status);
r = await m.onRequestPost({ request: req('POST', { text: 'Hacked' }, 'shh'), env: Object.assign({}, env, { AI_GATEWAY_SECRET: '' }) });
ck(r.status === 401, 'a key was let in with no secret on the Portal: ' + r.status);
r = await m.onRequestPost({ request: req('POST', { text: 'Hacked' }), env });
ck(r.status === 401, 'no key and no session was let in: ' + r.status);
r = await m.onRequestDelete({ request: req('DELETE', null, 'shh'), env });
ck(r.status === 200, 'the platform couldn\'t clear it: ' + r.status);
r = await (await m.onRequestGet({ request: req('GET'), env })).json();
ck(r.text === 'Welcome to the Legal Skills Hub.', 'clearing didn\'t go back to the default: ' + JSON.stringify(r));
if (fails.length) { console.error('Announcement gateway test FAILED:\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Announcement gateway test passed (the platform saves and clears the Portal\'s announcement with the shared secret; a wrong key, no secret, or no key and no session is refused).');

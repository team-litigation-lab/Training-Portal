// 📂 The trainee's Backup Drive (functions/api/drive.js), on SQLite with Google stood in for: the structure is the CM course's
// (a tree, a rule for every folder, every course folder with a home); the grading passes the firm's own structure and refuses a
// missing, misspelled, invented or misordered folder; signed out: nothing; not configured: says so and nothing else; a trainee
// connects (tokens sealed, never sent back, scope drive.file only), a wrong layout is scored and not built, a right one is built in
// Drive; every graded setup is a "Backup Drive Setup" simulator result; check names a deleted folder and rebuild puts it back;
// disconnect keeps the grade; a trainer reads every trainee's report and can change nothing; a trainee can't read the report.
// Run: node --no-warnings .github/scripts/drive-backup.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const fails = []; const ck = (o, t) => { console.log((o ? 'PASS ' : 'FAIL ') + t); if (!o) fails.push(t); };
const src = fs.readFileSync('functions/api/drive.js', 'utf8')
    .replace("import { json, requireSession } from '../_utils.js';", "const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json'}});let CUR=null;const requireSession=async()=>CUR?{ok:true,session:CUR}:{ok:false,response:json({success:false,code:'NOT_AUTHENTICATED'},401)};globalThis.__setSession=(x)=>{CUR=x};")
    .replace("import { ensureSimResultsTable } from './call-results.js';", "const ensureSimResultsTable=async(db)=>{await db.prepare(`CREATE TABLE IF NOT EXISTS simulator_results (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, full_name TEXT, simulator TEXT NOT NULL, scenario TEXT, score INTEGER, summary TEXT, details TEXT, created_at TEXT NOT NULL)`).run();};")
    .replace("import { toCourseFor } from './sim-results.js';", "const toCourseFor=async(env,u,p,row)=>{globalThis.__course=(globalThis.__course||[]).concat([{u,p,row}]);};");
if (!/globalThis.__setSession/.test(src) || /from '\.\.?\//.test(src)) throw new Error('the test could not stand in for the imports: update it with drive.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drv-')); fs.writeFileSync(path.join(tmp, 'drive.mjs'), src);
const m = await import(pathToFileURL(path.join(tmp, 'drive.mjs')).href);

// ---- the structure and the grading (the CM course's, unchanged)
const S = m.FOLDER_STANDARD;
ck(S.length === 16 && S[0] === '01 Clients' && S[1] === '01 Clients/Doe-John', 'the structure is the CM course\'s 16 folders, clients first, last name first');
ck(S.every((p) => !p.includes('/') || S.includes(p.slice(0, p.lastIndexOf('/')))), 'it is a tree: every folder\'s parent is in it, before it');
ck(S.every((p, i) => !p.includes('/') || S.indexOf(p.slice(0, p.lastIndexOf('/'))) < i), 'and every parent comes before its folders');
ck(S.every((p) => m.FOLDER_WHY[p]), 'every folder has the rule behind it');
ck(Object.values(m.DRIVE_HOMES).every((p) => S.includes(p)), 'every course folder has a home on the drive');
let g = m.gradeLayout(S.slice()); ck(g.ok && g.score === 100 && !g.problems.length, 'the firm\'s own structure passes at 100');
g = m.gradeLayout(S.map((p) => ' /' + p.replace(/ /g, '  ') + '/ ')); ck(g.ok, 'stray spaces and slashes are not held against anyone');
g = m.gradeLayout(S.filter((p) => !/Medical Records/.test(p))); ck(!g.ok && g.problems.some((p) => /Medical Records" is missing/.test(p) && /liability reads the records/.test(p)) && g.score < 100, 'a missing folder is named with its rule');
g = m.gradeLayout(S.map((p) => p.replace('03 Templates', '03 templates'))); ck(!g.ok && g.problems.some((p) => /spelled differently/.test(p)), 'a misspelled folder is refused');
g = m.gradeLayout(S.concat(['05 Misc'])); ck(!g.ok && g.problems.some((p) => /"05 Misc" isn't part/.test(p)), 'an invented folder is refused');
const swapped = S.slice(); [swapped[14], swapped[15]] = [swapped[15], swapped[14]];
g = m.gradeLayout(swapped); ck(!g.ok && g.problems.length === 1 && /out of order/.test(g.problems[0]), 'the right folders in the wrong order are refused');
ck(m.gradeLayout([]).score === 0 && m.gradeLayout(null).score === 0, 'nothing laid out scores 0');

// ---- the endpoint, with Google stood in for
const sql = new DatabaseSync(':memory:');
const mk = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => { const r = sql.prepare(q).run(...a); return { meta: { changes: r.changes } }; }, first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const accounts = new DatabaseSync(':memory:');
accounts.exec(`CREATE TABLE users (username TEXT, first_name TEXT, last_name TEXT, batch_id TEXT); INSERT INTO users VALUES ('ann', 'Ann', 'Lee', 'B102226');`);
const mkA = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, all: async () => ({ results: accounts.prepare(q).all(...a) }) }; return o; };
const env = { TRAINING_DB: { prepare: mk }, DB: { prepare: mkA }, SESSION_SECRET: 'test-secret' };

const files = {}; let nextId = 1; const tokenCalls = [];
globalThis.fetch = async (url, init = {}) => {
    const u = String(url), J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });
    if (u === 'https://oauth2.googleapis.com/token') {
        const p = new URLSearchParams(init.body); tokenCalls.push(Object.fromEntries(p));
        if (p.get('grant_type') === 'authorization_code') return J({ access_token: 'AT-1', refresh_token: 'RT-SECRET', expires_in: 3600,
            id_token: 'x.' + Buffer.from(JSON.stringify({ email: 'ann@gmail.com' })).toString('base64url') + '.y' });
        return J({ access_token: 'AT-2', expires_in: 3600 });
    }
    if (u === 'https://oauth2.googleapis.com/revoke') return J({});
    if (!/^Bearer AT-/.test((init.headers || {}).Authorization || '')) return J({ error: { message: 'no auth' } }, 401);
    if (u.startsWith('https://www.googleapis.com/upload/')) { const id = 'f' + nextId++; files[id] = { file: true }; return J({ id, name: 'x', webViewLink: 'https://drive/' + id }); }
    const one = u.match(/\/files\/([^?]+)\?/);
    if (one) { const f = files[decodeURIComponent(one[1])]; return f ? J({ id: one[1], trashed: !!f.trashed }) : J({ error: { message: 'not found' } }, 404); }
    if (/\/files\?fields=id$/.test(u) && init.method === 'POST') { const b = JSON.parse(init.body); const id = 'd' + nextId++; files[id] = { name: b.name, parents: b.parents }; return J({ id }); }
    return J({ error: { message: 'unexpected ' + u } }, 500);
};
const call = async (body, who) => { __setSession(who); const r = await m.onRequestPost({ request: new Request('https://p/api/drive', { method: 'POST', body: JSON.stringify(body) }), env }); const t = await r.text(); return { st: r.status, j: JSON.parse(t), raw: t }; };
const ann = { username: 'ann', fullName: 'Ann Lee', userType: 'Trainee' }, cy = { username: 'cy', userType: 'Trainee' }, boss = { username: 'boss', userType: 'Admin' };

let r = await call({ action: 'status' }, null); ck(r.st === 401, 'signed out: nothing');
r = await call({ action: 'status' }, ann); ck(r.st === 200 && r.j.drive.configured === false && !r.j.drive.clientId, 'not configured: says so, and gives no client id');
r = await call({ action: 'setup', layout: S }, ann); ck(r.st === 200 && r.j.drive.configured === false && !r.j.graded, 'and does nothing else');
env.GOOGLE_CLIENT_ID = 'cid.apps.googleusercontent.com'; env.GOOGLE_CLIENT_SECRET = 'csecret';
r = await call({ action: 'status' }, ann); ck(r.j.drive.configured && r.j.drive.clientId === env.GOOGLE_CLIENT_ID && r.j.drive.scopes === 'openid email https://www.googleapis.com/auth/drive.file', 'configured: the client id and drive.file only');
ck(r.j.drive.standard.length === 16 && !r.j.drive.connected, 'the page is sent the structure; not connected yet');
r = await call({ action: 'setup', layout: S }, ann); ck(r.st === 400 && r.j.code === 'DRIVE_NOT_CONNECTED', 'no setup before connecting');
r = await call({ action: 'connect', code: 'CODE' }, ann);
ck(r.st === 200 && r.j.drive.connected && r.j.drive.email === 'ann@gmail.com', 'a trainee connects their Google account');
ck(tokenCalls[0].redirect_uri === 'postmessage' && tokenCalls[0].client_secret === 'csecret', 'the popup code is exchanged with the client secret');
ck(!/RT-SECRET|AT-1/.test(r.raw), 'no token is ever sent back');
const stored = sql.prepare(`SELECT rec FROM drive_backups WHERE username = 'ann'`).get().rec;
ck(!/RT-SECRET|AT-1/.test(stored) && JSON.parse(stored).refresh.includes('.'), 'the tokens are stored sealed, not in plain text');

const bad = S.filter((p) => !/Liens/.test(p));
r = await call({ action: 'setup', layout: bad, program: 'CM' }, ann);
ck(r.st === 200 && !r.j.graded.ok && r.j.graded.score < 100 && !r.j.built && !r.j.drive.built, 'a wrong layout is scored and not built');
ck(Object.keys(files).length === 0, 'and nothing is made in Drive');
r = await call({ action: 'setup', layout: S, program: 'CM' }, ann);
ck(r.j.graded.ok && r.j.built && r.j.built.made.length === 17 && r.j.drive.built && r.j.drive.setup.attempts === 2, 'the right layout is built in Drive (the root and 16 folders), on attempt 2');
const kids = Object.values(files).filter((f) => f.name === '03 Medical Records');
ck(kids.length === 1 && files[kids[0].parents[0]].name === 'Doe-John', 'each folder is made inside its parent');
const results = sql.prepare(`SELECT * FROM simulator_results WHERE username = 'ann' ORDER BY id`).all();
ck(results.length === 2 && results.every((x) => x.simulator === 'Backup Drive Setup') && results[0].score < 100 && results[1].score === 100, 'automated scoring: every graded setup is a Backup Drive Setup result');
ck((globalThis.__course || []).length === 2 && globalThis.__course[1].p === 'CM' && globalThis.__course[1].row.score === 100, 'and goes to the course the page was opened from');

r = await call({ action: 'check' }, ann); ck(r.j.verified.missing.length === 0, 'check: every folder is there');
const medId = JSON.parse(sql.prepare(`SELECT rec FROM drive_backups WHERE username = 'ann'`).get().rec).folders[`${m.CLIENT_FOLDER}/03 Medical Records`];
files[medId].trashed = true;
r = await call({ action: 'check' }, ann); ck(r.j.verified.missing.length === 1 && /Medical Records/.test(r.j.verified.missing[0]) && r.j.drive.lastMissing.length === 1, 'a deleted folder is named, not quietly made again');
r = await call({ action: 'rebuild' }, ann); ck(r.j.built.restored.length === 1 && r.j.drive.lastMissing.length === 0, 'rebuild puts the missing folder back');
r = await call({ action: 'put', docFolder: 'medical', name: 'JD-01_Doe-John_Medical Records.pdf', b64: 'AAAA' }, ann); ck(r.st === 400, 'a filed document with a bad name is refused');
r = await call({ action: 'put', docFolder: 'medical', name: 'JD-01_Doe-John_MedicalRecords.pdf', b64: Buffer.from('%PDF').toString('base64url') }, ann);
ck(r.st === 200 && r.j.saved.folder.endsWith('03 Medical Records') && r.j.drive.saved.length === 1, 'a filed document is kept in its folder');
r = await call({ action: 'put', docFolder: 'nowhere', name: 'a.pdf', b64: 'AAAA' }, ann); ck(r.st === 400, 'a folder that is not in the structure is refused');

r = await call({ action: 'status' }, cy); ck(r.j.drive.connected === false && !r.j.drive.built, 'another trainee sees none of it');
r = await call({ action: 'reportAll' }, ann); ck(r.st === 403, 'a trainee can\'t read the trainers\' report');
r = await call({ action: 'reportAll' }, boss);
const rep = r.j.reports.ann;
ck(r.st === 200 && rep && rep.name === 'Ann Lee' && rep.batch === 'B102226' && rep.passed && rep.score === 100 && rep.attempts === 2 && rep.copies === 1 && rep.connected, 'a trainer reads every trainee\'s drive: name, batch, score, attempts, filed');
ck(!/RT-SECRET|AT-/.test(JSON.stringify(r.j)), 'with no token in it');
r = await call({ action: 'checkFor', traineeId: 'ann' }, boss); ck(r.st === 200 && r.j.verified.missing.length === 0, 'a trainer refreshes a trainee\'s check');
r = await call({ action: 'rebuild', traineeId: 'ann' }, boss); ck(r.st === 403, 'but can change nothing');
r = await call({ action: 'setup', layout: S, traineeId: 'ann' }, boss); ck(r.st === 403, 'not even the setup');

r = await call({ action: 'disconnect' }, ann);
ck(r.j.drive.connected === false && r.j.drive.setup && r.j.drive.setup.score === 100 && r.j.drive.saved.length === 1, 'disconnect drops the Google link and keeps the grade');
const after = JSON.parse(sql.prepare(`SELECT rec FROM drive_backups WHERE username = 'ann'`).get().rec);
ck(!after.refresh && !after.access, 'and the sealed tokens are gone');
r = await call({ action: 'nope' }, ann); ck(r.st === 400 && r.j.code === 'DRIVE_NOT_CONNECTED', 'nothing else works once disconnected');

// the page draws the structure from what the server sends and never carries a copy
const page = fs.readFileSync('simulators/drive.js', 'utf8');
ck(!page.includes('Doe-John') && !page.includes('Bills & Invoices'), 'the page carries no copy of the structure');
ck(/'\/api\/drive'/.test(page) && fs.readFileSync('simulators.html', 'utf8').includes("href: '/simulators/drive.html'"), 'the page talks to /api/drive and the Simulators hub links it');

if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
console.log('\nall passed');

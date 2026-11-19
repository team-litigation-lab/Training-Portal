// Trainee Monitoring files each Portal result under the trainee's account (name--batch, the id every course keys its trainee
// by), not under a display name (code inventory 2026-10-16 #5): two approved trainees both called Maria Santos, in different
// batches, are two rows, each with only their own simulator runs and Portal work; a visitor's result (no account) is still
// filed by name, as before. Run: node --no-warnings .github/scripts/progress-identity.mjs
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const failures = []; const fail = (m) => failures.push(m);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pid-'));
const pp = fs.readFileSync('functions/api/program-progress.js', 'utf8')
    .replace("import { json, requireSession, logActivity } from '../_utils.js';", "const json=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json',...h}});const requireSession=async()=>({ok:true,session:{username:'boss',userType:'Admin'}});const logActivity=async()=>{};")
    .replace("import { driveConfigured, saveBatchToDrive } from '../_drive.js';", "const driveConfigured=()=>false;const saveBatchToDrive=async()=>({});")
    .replace("import { courseTraineeId } from './call-results.js';", `import { courseTraineeId } from '${pathToFileURL(path.resolve('functions/api/call-results.js')).href}';`)
    .replace("import { readList } from '../_ft-block.js';", "const readList=async()=>({});");
fs.writeFileSync(path.join(tmp, 'pp.mjs'), pp);
const prog = await import(pathToFileURL(path.join(tmp, 'pp.mjs')).href);
const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (username TEXT, first_name TEXT, last_name TEXT, batch_id TEXT);
INSERT INTO users VALUES ('maria1', 'Maria', 'Santos', 'B100126'), ('maria2', 'Maria', 'Santos', 'B110226');
CREATE TABLE simulator_results (id INTEGER PRIMARY KEY, username TEXT, full_name TEXT, simulator TEXT, scenario TEXT, score INTEGER, summary TEXT, details TEXT, created_at TEXT);
INSERT INTO simulator_results (username, full_name, simulator, score, created_at) VALUES ('maria1','Maria Santos','Docket System',90,'2026-11-01'), ('maria2','Maria Santos','Docket System',40,'2026-11-02'),
  ('maria2','Maria Santos','Drafting',50,'2026-11-03'), ('guest:B1:pat lee','Pat Lee · B1','Docket System',70,'2026-11-04');
CREATE TABLE submissions (activity_title TEXT, trainee_username TEXT, trainee_name TEXT, status TEXT, score INTEGER, feedback TEXT, submitted_at TEXT, graded_at TEXT);
INSERT INTO submissions VALUES ('Quiz','maria1','Maria Santos','Graded',100,'','2026-11-01',NULL), ('Quiz','maria2','Maria Santos','Graded',20,'','2026-11-02',NULL);`);
const d1 = { prepare(q) { const make = (a) => ({ bind: (...x) => make(x), run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }); return make([]); } };
const pr = await (await prog.onRequestGet({ request: new Request('https://p/api/program-progress'), env: { TRAINING_DB: d1, DB: d1 } })).json();
const a = pr.simulators.byId['maria-santos--b100126'], b = pr.simulators.byId['maria-santos--b110226'];
if (!a || a.runs !== 1 || a.avg !== 90) fail(`Maria Santos (B100126) should have only her own run: ${JSON.stringify(a)}`);
if (!b || b.runs !== 2 || b.avg !== 45) fail(`Maria Santos (B110226) should have only hers: ${JSON.stringify(b)}`);
if (pr.simulators.byName['maria santos']) fail('results with an account behind them are no longer filed by name');
if (!pr.simulators.byName['pat lee']) fail('a visitor\'s result (no account) is still filed by name');
if ((pr.portalWork.byId['maria-santos--b100126'] || {}).avgScore !== 100 || (pr.portalWork.byId['maria-santos--b110226'] || {}).avgScore !== 20) fail(`Portal work per account: ${JSON.stringify(pr.portalWork)}`);
// the page (progress-records.js): one row per person = name + batch, each with their own results
const src = fs.readFileSync('progress-records.js', 'utf8');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(src.slice(0, src.indexOf('function batchesOfProgram()')) + '\nthis.P = P; this.people = people;', ctx);
ctx.P.data = { trainees: [{ program: 'ft', id: 'maria-santos--b100126', name: 'Maria Santos', batch: 'B100126', status: 'Approved', daysDone: 1, daysTotal: 8 },
    { program: 'cm', id: 'maria-santos--b100126', name: 'Maria Santos', batch: 'B100126', status: 'Approved', daysDone: 2, daysTotal: 5 },
    { program: 'ft', id: 'maria-santos--b110226', name: 'Maria  Santos', batch: 'B110226', status: 'Approved', daysDone: 0, daysTotal: 8 }],
    simulators: pr.simulators, portalWork: pr.portalWork, calsim: pr.calsim, traineeFeedback: [] };
const rows = ctx.people();
if (rows.length !== 2) fail(`two Maria Santos in two batches should be two rows (one with both programs): ${rows.length}`);
const r1 = rows.find(r => r.batches.includes('B100126')), r2 = rows.find(r => r.batches.includes('B110226'));
if (!r1 || r1.enrollments.length !== 2 || !r1.sim || r1.sim.avg !== 90 || !r1.work || r1.work.avgScore !== 100) fail(`the first Maria's row: ${JSON.stringify(r1 && { en: r1.enrollments.length, sim: r1.sim, work: r1.work })}`);
if (!r2 || !r2.sim || r2.sim.avg !== 45 || r2.work.avgScore !== 20) fail(`the second Maria's row: ${JSON.stringify(r2 && { sim: r2.sim, work: r2.work })}`);
fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Trainee Monitoring keeps two trainees with one name in two batches apart; a visitor\'s results are still filed by name.');

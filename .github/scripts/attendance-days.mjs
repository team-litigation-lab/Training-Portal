// 🕘 Attendance names each course's days the way the course does (platform QA 2026-11-19: FT finding 2, EA / PA finding 7, CM
// finding 6): Standard Training's 8 lessons (no Lesson 9), EA / PA's ten day titles, and CM's five Case Flow days, which the
// course keeps as days 11-15 and names "Case Flow Day N: <title>" on its automatic Time In. A CM batch's training for the day
// follows how far it has got. Run: node --no-warnings .github/scripts/attendance-days.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const failures = []; const fail = (m) => failures.push(m);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'att-'));
const put = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return pathToFileURL(p).href; };
put('_programs.js', fs.readFileSync('functions/_programs.js', 'utf8'));
const utilsUrl = put('_utils.mjs', fs.readFileSync('functions/_utils.js', 'utf8'));
const att = await import(put('_attendance.mjs', fs.readFileSync('functions/_attendance.js', 'utf8').replace("'./_utils.js'", `'${utilsUrl}'`)));
const P = (id) => att.PROGRAMS.find((p) => p.id === id);

const ft = P('ft');
if (ft.days.length !== 8 || ft.days.some((d) => /Lien Negotiator/.test(d))) fail(`Standard Training is 8 lessons, without the old Lesson 9: ${JSON.stringify(ft.days)}`);
const ea = P('eapa');
if (ea.days[0] !== 'The Legal EA/PA Role, Communication & Managing Up' || ea.days.length !== 10) fail(`EA / PA's titles are the course's: ${ea.days[0]}`);
const cm = P('cm');
const names = att.lessons(cm);
if (names[0] !== 'Case Flow Day 1: Fundamentals, Intake, Claim Set Up & Treatment' || names[2] !== 'Case Flow Day 3: Lien Negotiation & Disbursement') fail(`CM's days are named as its Time In names them: ${JSON.stringify(names)}`);
const members = [{ dayProgress: { 11: { done: true }, 12: { done: true }, 13: { done: true } } }, { dayProgress: { 11: { done: true }, 12: { done: true }, 13: { done: true } } }];
const today = att.defaultTraining(cm, 'B100126', members);
if (today !== 'Case Flow Day 4: Mediation & Arbitration') fail(`a CM batch three days in is on Case Flow Day 4, not Day 1: ${today}`);
const ln = P('ln'), lnToday = att.defaultTraining(ln, 'B1', [{ dayProgress: { 1: { done: true } } }]);
if (!/^Day 2: /.test(lnToday)) fail(`a course with days 1..n still counts as before: ${lnToday}`);
fs.rmSync(tmp, { recursive: true, force: true });
if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Attendance names every course\'s days as the course does, and a CM batch\'s day follows its days 11-15.');

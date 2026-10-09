// Batch IDs: new ones are the batch's, B + MMDDYY of the start date, with no trainee number (functions/_utils.js
// nextBatchId); the pages show older ones (B30092026-LSHTRAINEE-004) without the trainee number (app.js batchLabel),
// grouped by batch, the newest first (batchCohort). Run: node .github/scripts/batch.mjs
import { readFileSync } from 'node:fs';
import { nextBatchId, canonicalBatch } from '../../functions/_utils.js';

const failures = []; const fail = (m) => failures.push(m);
const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
const grab = (name) => { const at = app.indexOf(`function ${name}(`); if (at < 0) throw new Error(`${name} not found in app.js`); let i = app.indexOf('{', at), depth = 0;
    for (; i < app.length; i++) { if (app[i] === '{') depth++; else if (app[i] === '}' && --depth === 0) break; } return app.slice(at, i + 1); };
const { batchLabel, batchCohort } = new Function(`${grab('batchLabel')}\n${grab('batchCohort')}\nreturn { batchLabel, batchCohort };`)();

const issued = { '2026-10-05': 'B100526', '2026-09-30 08:15:00': 'B093026', '2027-01-02': 'B010227' };
for (const [d, want] of Object.entries(issued)) { const got = await nextBatchId(null, 'Trainee', d); if (got !== want) fail(`a Batch ID for ${d} is ${got} (expected ${want}: B + MMDDYY)`); }
if (!/^B\d{6}$/.test(await nextBatchId(null, 'Admin'))) fail(`an Admin's Batch ID has a trainee number or isn't B + six digits: ${await nextBatchId(null, 'Admin')}`);

const shown = { 'B30092026-LSHTRAINEE-004': 'B300926', 'B05022026-LSHADMIN-001': 'B050226', 'b30092026-lshtrainee-012': 'B300926', 'B30092026': 'B300926',
    'B300926-LSHTRAINEE-004': 'B300926', 'B100526': 'B100526', 'UNASSIGNED': 'UNASSIGNED', '': '', 'MASTER-ADMIN': 'MASTER-ADMIN' };
for (const [id, want] of Object.entries(shown)) { const got = batchLabel(id); if (got !== want) fail(`${JSON.stringify(id)} is shown as ${JSON.stringify(got)} (expected ${JSON.stringify(want)})`); }

// grouped by batch: a trainee number doesn't split a batch, and the newest batch comes first
const ids = ['B30092026-LSHTRAINEE-004', 'B30092026-LSHTRAINEE-005', 'B100526', 'B05022026-LSHTRAINEE-001', 'B123125', ''];
const groups = [...new Map(ids.map(b => { const c = batchCohort(b); return [c.key, c]; })).values()].sort((a, b) => b.sort.localeCompare(a.sort)).map(c => c.key);
if (groups.join() !== 'B100526,B300926,B050226,B123125,No Batch') fail(`batches grouped or ordered wrong: ${groups.join()}`);

// What an admin types for a Batch ID (update-user.js) is saved in its one form: B + MMDDYY. The same rule
// the programs read it by (canonicalBatch in each course's index.html and worker.js, and in the CMS).
const typed = { 'B100926': 'B100926', 'b100926': 'B100926', 'B 10-09-26': 'B100926', '100926': 'B100926',
    'B10092026': 'B100926', 'B10092026-LSHTRAINEE-001': 'B100926', 'B300926': 'B300926', 'B09102026-LSHADMIN-003': 'B091026' };
for (const [t, want] of Object.entries(typed)) { const got = canonicalBatch(t); if (got !== want) fail(`an admin typing ${JSON.stringify(t)} saves ${JSON.stringify(got)} (expected ${want})`); }
// (B130926 isn't here: read the other way round, as DDMMYY, 13 September 2026 is a real date)
for (const bad of ['B1', 'CIFS', 'B993026', 'B000026', 'B123', 'batch one', '', 'MASTER-ADMIN']) {
    if (canonicalBatch(bad)) fail(`${JSON.stringify(bad)} was taken as the Batch ID ${canonicalBatch(bad)}`);
}
// every Batch ID the Portal issues is one it would accept back
for (const d of ['2026-10-05', '2026-09-30', '2027-01-02']) {
    const issued = await nextBatchId(null, 'Trainee', d);
    if (canonicalBatch(issued) !== issued) fail(`the Portal issues ${issued}, which it then reads as ${JSON.stringify(canonicalBatch(issued))}`);
}

if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Batch ID test passed (new ones B + MMDDYY with no trainee number; older ones shown without it, grouped by batch, the newest first).');

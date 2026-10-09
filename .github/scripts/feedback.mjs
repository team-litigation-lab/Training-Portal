// Trainee feedback (functions/api/feedback.js) on SQLite. The rule the feature exists for: a rating is
// Pending when it arrives and the public list never carries it until an admin approves it — not when it
// is rejected, not when it is re-sent, and not when a POST asks for a status. Also: one rating per
// person (re-sending replaces it and re-queues it), the public list hides the name of anyone who asked
// to be anonymous, a visitor can read it but cannot write, and only an admin decides or deletes.
// Run: node --no-warnings .github/scripts/feedback.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

let src = fs.readFileSync('functions/api/feedback.js', 'utf8').replace("import { json, requireSession, getSiteState } from '../_utils.js';",
    `const json = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...h } });
let CUR = null, LOCKED = false;
globalThis.__setSession = (x) => { CUR = x; }; globalThis.__setLocked = (x) => { LOCKED = x; };
const getSiteState = async () => ({ locked: LOCKED });
const requireSession = async (req, env, opts = {}) => {
    if (LOCKED) return { ok: false, response: json({ success: false, code: 'SITE_LOCKED' }, 423) };
    if (!CUR) return { ok: false, response: json({ success: false, error: 'Sign in.' }, 401) };
    if (opts.adminOnly && CUR.userType !== 'Admin') return { ok: false, response: json({ success: false, error: 'Admins only.' }, 403) };
    return { ok: true, session: CUR }; };`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-')); fs.writeFileSync(path.join(tmp, 'fb.mjs'), src);
const m = await import(pathToFileURL(path.join(tmp, 'fb.mjs')).href);

const sql = new DatabaseSync(':memory:');
const mk = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; },
    run: async () => sql.prepare(q).run(...a),
    first: async () => sql.prepare(q).get(...a) || null,
    all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const env = { DB: { prepare: mk }, TRAINING_DB: { prepare: mk } };
const call = async (fn, qs = '', body) => {
    const r = await m['onRequest' + fn]({ request: new Request('https://p/api/feedback' + qs, {
        method: fn.toUpperCase(), body: body === undefined ? undefined : JSON.stringify(body) }), env });
    return { st: r.status, j: await r.json() };
};
const fails = []; const ck = (o, t) => { console.log((o ? 'PASS ' : 'FAIL ') + t); if (!o) fails.push(t); };
const admin = { username: 'boss', userType: 'Admin', fullName: 'Trainer Bo' };
const ann = { username: 'ann', userType: 'Trainee', fullName: 'Ann Lee', batchId: 'B010126' };
const bob = { username: 'bob', userType: 'Trainee', fullName: 'Bob Reyes', batchId: 'B010126' };
const pub = async () => (await call('Get')).j;

// ---- a visitor can read, and cannot write -----------------------------------
globalThis.__setSession(null);
let r = await call('Get'); ck(r.st === 200 && r.j.success && r.j.feedback.length === 0, 'a visitor can read the feedback, and there is none yet');
r = await call('Post', '', { rating: 5, comment: 'Let me in.' }); ck(r.st === 401, 'a visitor cannot leave a rating');
r = await call('Get', '?mine=1'); ck(r.st === 401, 'a visitor has no rating of their own to read');
r = await call('Get', '?all=1'); ck(r.st === 401, 'a visitor cannot read the queue');

// ---- a trainee leaves one, and it does not show --------------------------------
globalThis.__setSession(ann);
r = await call('Post', '', { rating: 5, comment: 'The Simulators made it click.', program: 'Case Management' });
ck(r.st === 200 && r.j.status === 'Pending', "a trainee's rating arrives Pending");
ck((await pub()).feedback.length === 0, 'and it does NOT show publicly before an admin approves it');
r = await call('Get', '?mine=1'); ck(r.j.mine && r.j.mine.status === 'Pending' && r.j.mine.rating === 5, 'the trainee can see their own, and where it stands');
r = await call('Get', '?all=1'); ck(r.st === 403, 'a trainee cannot read the whole queue');
r = await call('Patch', '', { id: 1, status: 'Approved' }); ck(r.st === 403, 'a trainee cannot approve their own rating');
ck((await pub()).feedback.length === 0, 'and the refused approval changed nothing');

// a POST cannot smuggle a status past the queue
r = await call('Post', '', { rating: 5, comment: 'Trying it on.', status: 'Approved' });
ck(r.st === 200 && (await pub()).feedback.length === 0, 'a POST asking for Approved is still only Pending');

// ---- what a rating has to be ---------------------------------------------------
for (const [body, why] of [[{ rating: 0, comment: 'x'.repeat(20) }, '0 stars'], [{ rating: 6, comment: 'x'.repeat(20) }, '6 stars'],
    [{ comment: 'x'.repeat(20) }, 'no rating'], [{ rating: 4 }, 'no words'], [{ rating: 4, comment: '   ' }, 'only spaces']]) {
    r = await call('Post', '', body); ck(r.st === 400, `a rating with ${why} is refused`);
}

// ---- one per person ------------------------------------------------------------
globalThis.__setSession(bob);
await call('Post', '', { rating: 4, comment: 'Dense at first, good after.', showName: false });
ck(sql.prepare('SELECT COUNT(*) n FROM feedback').get().n === 2, 'two people, two rows');
globalThis.__setSession(ann);
await call('Post', '', { rating: 3, comment: 'On reflection, three.' });
ck(sql.prepare('SELECT COUNT(*) n FROM feedback').get().n === 2, 'sending again replaces that person’s rating rather than adding one');
r = await call('Get', '?mine=1'); ck(r.j.mine.rating === 3 && r.j.mine.comment === 'On reflection, three.', 'and it is the new words that are stored');

// ---- the admin decides ---------------------------------------------------------
globalThis.__setSession(admin);
r = await call('Get', '?all=1'); ck(r.st === 200 && r.j.feedback.length === 2 && r.j.statuses.join() === 'Pending,Approved,Rejected', 'an admin reads the whole queue');
const idOf = (u) => sql.prepare('SELECT id FROM feedback WHERE username = ?').get(u).id;
r = await call('Patch', '', { id: idOf('ann'), status: 'Approved' }); ck(r.st === 200, 'an admin approves one');
let p = await pub();
ck(p.feedback.length === 1 && p.feedback[0].comment === 'On reflection, three.', 'the approved one, and only it, is now public');
ck(p.count === 1 && p.average === 3, 'the public average counts approved ratings only');
ck(p.feedback[0].name === 'Ann Lee', 'a name shows when that person asked for it to');

r = await call('Patch', '', { id: idOf('bob'), status: 'Approved' });
p = await pub(); const bobRow = p.feedback.find(x => x.comment.startsWith('Dense'));
ck(bobRow && bobRow.name === '', 'someone who asked to be anonymous is published without their name');
ck(!JSON.stringify(p).includes('bob'), 'and without their username anywhere in the public answer');
ck(p.average === 3.5, 'the average follows the approvals');

// approving is reversible, both ways
r = await call('Patch', '', { id: idOf('ann'), status: 'Rejected' });
ck((await pub()).feedback.length === 1, 'rejecting one takes it off the page again');
r = await call('Patch', '', { id: idOf('ann'), status: 'Pending' });
ck((await pub()).feedback.length === 1, 'and sending it back to Pending keeps it off');
r = await call('Patch', '', { id: idOf('ann'), status: 'Live' }); ck(r.st === 400, 'a status that is not one of the three is refused');

// re-sending an approved rating puts it back in the queue: the admin approved
// words, and these are different words
await call('Patch', '', { id: idOf('ann'), status: 'Approved' });
ck((await pub()).feedback.length === 2, "ann's is approved again");
globalThis.__setSession(ann);
await call('Post', '', { rating: 1, comment: 'Actually, something else entirely.' });
p = await pub();
ck(p.feedback.length === 1 && !JSON.stringify(p).includes('something else entirely'), 're-sending an approved rating takes it off the page until it is approved again');
ck(sql.prepare('SELECT status, decided_by FROM feedback WHERE username = ?').get('ann').status === 'Pending', 'and clears who decided it');

// ---- deleting -------------------------------------------------------------------
r = await call('Delete', '?id=' + idOf('bob')); ck(r.st === 403, 'a trainee cannot delete a rating');
globalThis.__setSession(admin);
r = await call('Delete', '?id=' + idOf('bob')); ck(r.st === 200 && (await pub()).feedback.length === 0, 'an admin deletes one and it leaves the page');
r = await call('Delete'); ck(r.st === 400, 'a delete with no id is refused');

// ---- a locked site ----------------------------------------------------------------
globalThis.__setLocked(true);
r = await call('Get'); ck(r.st === 200 && r.j.feedback.length === 0, 'a locked site shows a visitor an empty list rather than an error');
r = await call('Post', '', { rating: 5, comment: 'While locked.' }); ck(r.st === 423, 'and takes no new ratings');
globalThis.__setLocked(false);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails.length ? `\n${fails.length} failed:\n - ` + fails.join('\n - ') : '\nAll feedback checks passed.');
process.exit(fails.length ? 1 : 0);

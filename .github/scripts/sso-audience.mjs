// 🎯 A Portal sign-in ticket is for one program (or one tool) only (platform QA 2026-11-19, finding 1), and carries the
// trainee's whole registered name (finding 8).
// Checks:
//   - /api/launch puts p = the program's topic key (or the tool's id) in every ticket it makes, a trainee's and an admin's,
//     and the trainee's full name (middle initial, suffix) as `full`; the first and last name stay as they were.
//   - /api/sso-check's system ticket names the program it is sent to.
//   - /api/verify-ticket (the CMS, the KB, LSH CommX) and the Portal's own ticket sign-in refuse a ticket made for a
//     program (code 'audience'), and still take a tool's ticket and an old ticket with no p.
// Run: node --no-warnings .github/scripts/sso-audience.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const failures = []; const fail = (m) => failures.push(m);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aud-'));
const put = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return pathToFileURL(p).href; };
const utilsUrl = put('_utils.mjs', fs.readFileSync('functions/_utils.js', 'utf8'));
const fix = (t) => t.replace("'../_utils.js'", `'${utilsUrl}'`);
const launchUrl = put('launch.mjs', fix(fs.readFileSync('functions/api/launch.js', 'utf8')));
const vtUrl = put('verify-ticket.mjs', fix(fs.readFileSync('functions/api/verify-ticket.js', 'utf8')));
const tlUrl = put('ticket-login.mjs', fix(fs.readFileSync('functions/api/ticket-login.js', 'utf8')).replace("'./verify-ticket.js'", `'${vtUrl}'`));
const scUrl = put('sso-check.mjs', fix(fs.readFileSync('functions/api/sso-check.js', 'utf8')).replace("'./launch.js'", `'${launchUrl}'`));
const launch = await import(launchUrl);
const vt = await import(vtUrl);
const tl = await import(tlUrl);
const sc = await import(scUrl);
const u = await import(utilsUrl);

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id TEXT, username TEXT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, email TEXT, status TEXT, user_type TEXT, batch_id TEXT, password TEXT);
CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER, updated_at TEXT);
CREATE TABLE activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_username TEXT, actor_batch TEXT, action TEXT, details TEXT, timestamp TEXT DEFAULT (datetime('now')));
CREATE TABLE trainee_topic_access (trainee_username TEXT, topic_key TEXT, status TEXT, PRIMARY KEY (trainee_username, topic_key));
INSERT INTO site_state VALUES (1, 0, NULL, 0, NULL);
INSERT INTO users VALUES ('1','maria','Maria','L','Santos','Jr','m@x','Approved','Trainee','B111926',NULL),
 ('2','coach','Coach',NULL,'Ana',NULL,'c@x','Approved','Admin','B1',NULL);
INSERT INTO heartbeats VALUES ('maria','Maria L. Santos','B111926','Trainee',NULL,datetime('now')), ('coach','Coach Ana','B1','Admin',NULL,datetime('now'));
INSERT INTO trainee_topic_access VALUES ('maria','LIEN NEGOTIATION','Approved');`);
const stmt = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const env = { DB: { prepare: stmt }, TRAINING_DB: { prepare: stmt }, SESSION_SECRET: 'test-secret', PORTAL_SSO_SECRET: 'sso-secret' };
const trainee = await u.createSessionToken({ username: 'maria', userType: 'Trainee', fullName: 'Maria L. Santos', batchId: 'B111926' }, env.SESSION_SECRET);
const admin = await u.createSessionToken({ username: 'coach', userType: 'Admin', fullName: 'Coach Ana', batchId: 'B1' }, env.SESSION_SECRET);
const go = async (token, q) => {
    const r = await launch.onRequestGet({ request: new Request('https://cm-training-activity.pages.dev/api/launch?' + q, { headers: { cookie: `lsh_session=${token}` } }), env });
    const at = r.headers.get('Location') || '';
    const ticket = at ? new URL(at).searchParams.get('ticket') : '';
    return { status: r.status, ticket, body: ticket ? JSON.parse(Buffer.from(ticket.split('.')[0], 'base64url').toString('utf8')) : null };
};

// 1. a trainee's ticket names its program and carries the full name
const ln = await go(trainee, 'program=' + encodeURIComponent('LIEN NEGOTIATION'));
if (ln.status !== 302 || !ln.body) fail(`a trainee's approved launch: ${ln.status}`);
else {
    if (ln.body.p !== 'LIEN NEGOTIATION') fail(`the trainee's ticket should name its program (p): ${JSON.stringify(ln.body)}`);
    if (ln.body.full !== 'Maria L. Santos, Jr') fail(`the trainee's ticket should carry the full registered name: ${JSON.stringify(ln.body)}`);
    if (ln.body.first !== 'Maria' || ln.body.last !== 'Santos' || ln.body.b !== 'B111926') fail(`first, last and batch must stay as they were: ${JSON.stringify(ln.body)}`);
    if (ln.body.u !== '1') fail(`the trainee's ticket should carry their Portal account id (u): ${JSON.stringify(ln.body)}`);
    const again = await go(trainee, 'program=' + encodeURIComponent('LIEN NEGOTIATION'));
    if (!ln.body.j || !again.ticket || again.ticket === ln.ticket) fail('two tickets made for the same launch must never be the same ticket (j)');
}
// a program they have no access to still makes no ticket at all
const ft = await go(trainee, 'program=' + encodeURIComponent('STANDARD TRAINING'));
if (ft.status !== 403 || ft.ticket) fail(`a program without access must not give a ticket: ${ft.status}`);
// 2. a tool's ticket names the tool
for (const tool of ['kb', 'cms', 'ringchannel']) {
    const t = await go(trainee, 'tool=' + tool);
    if (!t.body || t.body.p !== tool) fail(`a trainee's ${tool} ticket should name the tool: ${JSON.stringify(t.body)}`);
    const a = await go(admin, 'tool=' + tool);
    if (!a.body || a.body.r !== 'a' || a.body.p !== tool) fail(`an admin's ${tool} ticket should name the tool: ${JSON.stringify(a.body)}`);
    // ... and the tools still take them
    const v = await vt.verifyTicket(env.PORTAL_SSO_SECRET, t.ticket, { audiences: vt.TOOL_AUDIENCES });
    if (!v.ok || v.first !== 'Maria' || v.p !== tool || v.full !== 'Maria L. Santos, Jr') fail(`/api/verify-ticket should take a ${tool} ticket: ${JSON.stringify(v)}`);
}
// 3. an admin's program ticket names the program
for (const key of Object.keys(launch.SSO_PROGRAMS)) {
    const a = await go(admin, 'program=' + encodeURIComponent(key));
    if (!a.body || a.body.r !== 'a' || a.body.p !== key) fail(`an admin's ${key} ticket should name the program: ${JSON.stringify(a.body)}`);
}
// 4. a program's ticket can't be used at the tools' check or the Portal's own ticket sign-in
const post = async (fn, ticket) => { const r = await fn({ request: new Request('https://x/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket }) }), env }); return { status: r.status, body: await r.json() }; };
const vProg = await post(vt.onRequestPost, ln.ticket);
if (vProg.status !== 401 || vProg.body.code !== 'audience') fail(`/api/verify-ticket must refuse a program's ticket: ${JSON.stringify(vProg)}`);
const tProg = await post(tl.onRequestPost, ln.ticket);
if (tProg.status !== 401 || tProg.body.code !== 'audience') fail(`/api/ticket-login must refuse a program's ticket: ${JSON.stringify(tProg)}`);
// an old ticket with no p (a course's tool ticket not yet updated) and a course's 'tool' ticket still sign in at the Portal
for (const extra of [{}, { p: 'tool' }, { p: 'portal' }]) {
    const t = await launch.makeTicket(env.PORTAL_SSO_SECRET, { first: 'Maria', last: 'Santos', batch: 'B111926', uid: '1', aud: extra.p });
    const r = await post(tl.onRequestPost, t);
    if (r.status !== 200 || !r.body.success) fail(`a course's tool ticket (${JSON.stringify(extra)}) should still sign the trainee in at the Portal: ${JSON.stringify(r)}`);
}
// 4b. /api/verify-ticket (the CMS, the KB, Ring Channel) trusts only the account id u: the names given back are the account's, a
//     forged name on a course's tool ticket changes nothing, and a trainee ticket with no u or another kind of account is refused
{
    const forged = await launch.makeTicket(env.PORTAL_SSO_SECRET, { first: 'Bob', last: 'Victim', batch: 'B200000', uid: '1', aud: 'tool' });
    const v = await post(vt.onRequestPost, forged);
    if (v.status !== 200 || v.body.first !== 'Maria' || v.body.last !== 'Santos' || v.body.u !== '1' || v.body.full !== 'Maria L. Santos, Jr') fail(`verify-ticket answers with the account u is, never the ticket's names: ${JSON.stringify(v)}`);
    const noU = await post(vt.onRequestPost, await launch.makeTicket(env.PORTAL_SSO_SECRET, { first: 'Maria', last: 'Santos', batch: 'B111926', aud: 'tool' }));
    if (noU.status !== 401 || noU.body.code !== 'account') fail(`a trainee ticket with no u is refused: ${JSON.stringify(noU)}`);
    const adminU = await post(vt.onRequestPost, await launch.makeTicket(env.PORTAL_SSO_SECRET, { first: 'Maria', last: 'Santos', batch: 'B111926', uid: '2', aud: 'kb' }));
    if (adminU.status !== 401) fail(`a trainee ticket whose u is an admin account is refused: ${JSON.stringify(adminU)}`);
    const a = await go(admin, 'tool=kb');
    if (!a.body || a.body.u !== '2') fail(`an admin's ticket carries their account id: ${JSON.stringify(a.body)}`);
}

// 5. the Sign-in check's system ticket names the program it goes to
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => { sent.push({ url: String(url), body: JSON.parse(Buffer.from(JSON.parse(init.body).ticket.split('.')[0], 'base64url').toString('utf8')) }); return new Response(JSON.stringify({ admin: true, token: 'x' }), { status: 200 }); };
await sc.onRequestGet({ request: new Request('https://x/api/sso-check', { headers: { cookie: `lsh_session=${admin}` } }), env });
globalThis.fetch = realFetch;
for (const [key, url] of Object.entries(launch.SSO_PROGRAMS)) {
    const s = sent.find((x) => x.url === url + 'api/auth/portal');
    if (!s || s.body.r !== 's' || s.body.p !== key) fail(`the Sign-in check's ticket for ${key} should name it: ${JSON.stringify(s)}`);
}

// 6. one list of programs (code inventory 2026-10-16 #10): launch.js's addresses are for exactly the programs in _programs.js, which
//    /api/topics hands the Training Directory (programs.html keeps no copy of its own)
{
    const progs = await import(pathToFileURL(path.resolve('functions/_programs.js')).href);
    const want = progs.COURSE_PROGRAMS.map((p) => p.topic).sort(), have = Object.keys(launch.SSO_PROGRAMS).sort();
    if (JSON.stringify(want) !== JSON.stringify(have)) fail(`launch.js SSO_PROGRAMS (${have}) and _programs.js (${want}) list different programs`);
    const page = fs.readFileSync('programs.html', 'utf8');
    if (/BUILT_PROGRAMS|workers\.dev/.test(page) || !/SSO_PROGRAMS = Array\.isArray\(data\.programs\)/.test(page)) fail('programs.html should take its program list from /api/topics (programs), not keep its own map of addresses');
    const tp = fs.readFileSync('functions/api/topics.js', 'utf8');
    if ((tp.match(/programs: LAUNCHABLE/g) || []).length !== 3) fail('/api/topics should hand the program list (programs) in each of its answers');
}

if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Sign-in tickets: each names the program or tool it is for (p) and the full registered name; the tools\' check and the Portal\'s ticket sign-in refuse a program\'s ticket.');

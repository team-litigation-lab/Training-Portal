// The front door: the main page (/) is the Main Portal for everyone; a browser that is already signed in (trainee or admin) goes from
// the Portal's sign-in pages straight to LSH Academy Index, and only a signed-out one sees a sign-in box. Also /api/me (who is signed in on this browser).
// Checks: the main page is never redirected; a valid cookie is redirected from /trainee-login.html and (an admin's only) /admin-login.html; a signed-out
// visitor on LSH Academy Index goes to the sign-in and back after it (even with no live heartbeat, and the heartbeat
// is restarted); no cookie, a revoked account, a locked site and ?stay=1 all get the page; a tampered cookie gets the page.
// A simulator page opened with a course's ticket (?ticket=) signs the trainee in first, and a named trainer's their own admin account
// (a bad, expired or revoked ticket, a nameless admin's or the system's, doesn't).
// Run: node --no-warnings .github/scripts/front-door.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-'));
const put = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return pathToFileURL(p).href; };
const utilsUrl = put('_utils.mjs', fs.readFileSync('functions/_utils.js', 'utf8'));
const vtUrl = put('verify-ticket.mjs', fs.readFileSync('functions/api/verify-ticket.js', 'utf8').replace("'../_utils.js'", `'${utilsUrl}'`));
const tlUrl = put('ticket-login.mjs', fs.readFileSync('functions/api/ticket-login.js', 'utf8').replace("'../_utils.js'", `'${utilsUrl}'`).replace("'./verify-ticket.js'", `'${vtUrl}'`));
const mw = await import(put('_middleware.mjs', fs.readFileSync('functions/_middleware.js', 'utf8').replace("'./_utils.js'", `'${utilsUrl}'`).replace("'./api/ticket-login.js'", `'${tlUrl}'`)));
const me = await import(put('me.mjs', fs.readFileSync('functions/api/me.js', 'utf8').replace("'../_utils.js'", `'${utilsUrl}'`)));
const u = await import(utilsUrl);

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id TEXT, username TEXT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, status TEXT, user_type TEXT, batch_id TEXT);
CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER);
CREATE TABLE activity_log (actor_username TEXT, actor_batch TEXT, action TEXT, details TEXT);
INSERT INTO site_state VALUES (1, 0, NULL, 0);
INSERT INTO users VALUES ('1','ann','Ann',NULL,'Lee',NULL,'Approved','Trainee','B1'), ('2','boss','Bo',NULL,'Trainer',NULL,'Approved','Admin','A1'), ('3','gone','Gil',NULL,'Out',NULL,'Revoked','Trainee','B1');`);
const stmt = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const env = { DB: { prepare: stmt }, SESSION_SECRET: 'test-secret', PORTAL_SSO_SECRET: 'sso-secret' };

const failures = [];
const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) failures.push(m); };
const cookieFor = async (username, userType) => 'lsh_session=' + await u.createSessionToken({ username, userType, fullName: username, batchId: 'B1' }, env.SESSION_SECRET);
const hit = async (pathname, cookie, extra = '') => {
    let passed = false;
    const res = await mw.onRequest({ request: new Request('https://p' + pathname + extra, { headers: cookie ? { cookie } : {} }), env, next: async () => { passed = true; return new Response('page'); } });
    return { status: res.status, loc: res.headers.get('location'), passed };
};

const ann = await cookieFor('ann', 'Trainee'), boss = await cookieFor('boss', 'Admin');
for (const p of ['/', '/index.html']) {
    const r = await hit(p, ann);
    check(r.passed && r.status === 200, `the main page is the Main Portal for a signed-in trainee too (${p})`);
    const r2 = await hit(p, boss);
    check(r2.passed && r2.status === 200, `and for a signed-in admin (${p})`);
}
// Trainer material is for trainers: a trainee or a visitor is sent to the admin sign-in and gets none of it.
for (const [username, userType] of [['ann', 'Trainee'], ['boss', 'Admin']]) await u.upsertSessionHeartbeat(env.DB, { username, fullName: username, batchId: 'B1', userType });
const MODEL = '/simulators/drafting/trainers/Model%20packet%20-%20MedLOR%20with%20Unsworn%20COR%20and%20HIPAA.pdf';
let tr = await hit(MODEL, ann); check(!tr.passed && tr.status === 302 && tr.loc === '/admin-login.html', 'a trainee cannot open the trainers\' model packet');
tr = await hit(MODEL, null); check(!tr.passed && tr.status === 302, 'nor can a signed-out visitor');
tr = await hit(MODEL, boss); check(tr.passed, 'a trainer (admin) can');
// the attendance sheet's Apps Script (📋 Copy the sheet script): admins only, sent as plain text; not redirected away by _redirects
tr = await hit('/attendance-sync.gs', boss); check(tr.passed, 'an admin gets the attendance sheet script');
tr = await hit('/attendance-sync.gs', ann); check(!tr.passed && tr.status === 302 && tr.loc === '/admin-login.html', 'a trainee does not get the attendance sheet script');
tr = await hit('/attendance-sync.gs', null); check(!tr.passed && tr.status === 302, 'nor does a signed-out visitor');
// ... in any spelling the host serves it under (security review 2026-11-19): percent-encoded, doubled slashes
for (const alt of ['/%61ttendance-sync.gs', '/attendance-sync%2egs', '//attendance-sync.gs', '/%2Fattendance-sync.gs', '/ATTENDANCE-SYNC.GS', '//core.html', '/%63ore.html', '/progress%2Ehtml']) {
    tr = await hit(alt, null); check(!tr.passed && tr.status === 302, `a signed-out visitor gets nothing at ${alt}`);
    tr = await hit(alt, ann); check(!tr.passed && tr.status === 302, `nor does a trainee at ${alt}`);
}
{ const res = await mw.onRequest({ request: new Request('https://p/attendance-sync.gs', { headers: { cookie: boss } }), env, next: async () => new Response('function x(){}', { headers: { 'Content-Type': 'application/octet-stream' } }) });
  check(/^text\/plain/.test(res.headers.get('content-type') || ''), `the script is sent as text: ${res.headers.get('content-type')}`); }
check(!/^\/attendance-sync\.gs\s/m.test(fs.readFileSync('_redirects', 'utf8')), '_redirects must not send /attendance-sync.gs to the home page (the middleware gates it)');
check(fs.existsSync('attendance-sync.gs') && /function\s/.test(fs.readFileSync('attendance-sync.gs', 'utf8')), 'attendance-sync.gs is a script');
tr = await hit('/simulators/drafting/hipaa/INTAKE%20-%20HIPAA%202.0%20for%20training%20purposes.pdf', ann); check(tr.passed, 'a trainee gets the HIPAA they work from');
let rr = await hit('/trainee-login.html', ann);
check(rr.status === 302 && rr.loc === '/programs.html', 'a signed-in trainee on the sign-in page goes to LSH Academy Index');
let r = await hit('/admin-login.html', ann); check(r.passed && r.status === 200, 'a signed-in trainee gets the admin sign-in (to sign in as an admin)');
r = await hit('/admin-login', ann); check(r.passed, 'the same at /admin-login (no .html)');
r = await hit('/admin-login.html', boss); check(r.status === 302 && r.loc === '/programs.html', 'a signed-in admin on the admin sign-in goes to LSH Academy Index');
check(!!sql.prepare(`SELECT 1 FROM heartbeats WHERE username = 'ann'`).get(), 'the heartbeat is restarted (the cookie was valid, the heartbeat had lapsed)');
r = await hit('/trainee-login.html', ''); check(r.passed && r.status === 200, 'signed out: the sign-in page shows');
r = await hit('/trainee-login.html', 'lsh_session=abc.def'); check(r.passed, 'a tampered cookie gets the sign-in page');
r = await hit('/trainee-login.html', ann, '?stay=1'); check(r.passed, '?stay=1 shows the sign-in page (used right after logging out)');
r = await hit('/trainee-login.html', await cookieFor('gone', 'Trainee')); check(r.passed, 'a revoked account gets the sign-in page');
r = await hit('/programs.html', ann); check(r.passed, 'LSH Academy Index itself is not redirected for a signed-in trainee');
r = await hit('/programs.html', ''); check(r.status === 302 && r.loc === '/trainee-login.html?next=%2Fprograms.html', `a signed-out visitor on LSH Academy Index goes to the sign-in: ${r.status} ${r.loc}`);
r = await hit('/programs', ''); check(r.status === 302 && /trainee-login/.test(r.loc || ''), 'the same at /programs (no .html)');
r = await hit('/programs.html', boss); check(r.passed, 'an admin opens LSH Academy Index');
sql.exec(`UPDATE site_state SET locked = 1`);
r = await hit('/trainee-login.html', ann); check(r.passed, 'a locked site shows the sign-in page');
sql.exec(`UPDATE site_state SET locked = 0`);

// A simulator opened by a course with its signed ticket (?ticket=): the trainee is signed in before the page, and the ticket leaves the address
const ticketFor = async (body, secret = env.PORTAL_SSO_SECRET) => {
    const enc = new TextEncoder(), payload = u.b64url(enc.encode(JSON.stringify(body)));
    const key = await crypto.subtle.importKey('raw', enc.encode('portal-sso:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return payload + '.' + u.b64url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
};
const soon = () => Date.now() + 5 * 60 * 1000;
const withTicket = async (t, cookie = '') => {
    const res = await mw.onRequest({ request: new Request('https://p/simulators/gcal.html?track=standard&ticket=' + encodeURIComponent(t), { headers: cookie ? { cookie } : {} }), env, next: async () => new Response('page') });
    return { status: res.status, loc: res.headers.get('location'), cookie: res.headers.get('set-cookie') || '' };
};
r = await withTicket(await ticketFor({ first: 'Ann', last: 'Lee', b: 'B1', u: '1', exp: soon() }));
check(r.status === 302 && r.loc === '/simulators/gcal.html?track=standard' && /lsh_session=/.test(r.cookie), 'a course\'s ticket signs the trainee in on a simulator page, and the address loses the ticket');
const sess = await u.verifySessionToken(decodeURIComponent((r.cookie.match(/lsh_session=([^;]+)/) || [])[1] || ''), env.SESSION_SECRET);
check(sess && sess.username === 'ann' && sess.userType === 'Trainee', 'the session is the trainee\'s own account');
r = await withTicket(await ticketFor({ first: 'Ann', last: 'Lee', b: 'B1', u: '1', exp: soon() }, 'wrong-secret'));
check(r.status === 302 && /^\/trainee-login\.html\?next=/.test(r.loc), 'a ticket with the wrong signature gets the sign-in page');
r = await withTicket(await ticketFor({ first: 'Ann', last: 'Lee', b: 'B1', u: '1', exp: Date.now() - 1000 }));
check(/^\/trainee-login\.html\?next=/.test(r.loc), 'an expired ticket gets the sign-in page');
r = await withTicket(await ticketFor({ first: 'Gil', last: 'Out', b: 'B1', u: '3', exp: soon() }));
check(/^\/trainee-login\.html\?next=/.test(r.loc), 'a revoked trainee\'s ticket gets the sign-in page');
// (security review 2026-11-19) the account is the ticket's u, never its names: a course signs tool tickets from a record the
// trainee can edit there, so a ticket naming someone else signs in only the account u is, and one with no u signs in no one
r = await withTicket(await ticketFor({ first: 'Bo', last: 'Victim', b: 'B1', exp: soon() }));
check(/^\/trainee-login\.html\?next=/.test(r.loc) && !/lsh_session=/.test(r.cookie), 'a trainee ticket with no account id (u) signs no one in, whatever names it carries');
r = await withTicket(await ticketFor({ first: 'Gil', last: 'Out', b: 'B1', u: '1', exp: soon() }));
{ const s2 = await u.verifySessionToken(decodeURIComponent((r.cookie.match(/lsh_session=([^;]+)/) || [])[1] || ''), env.SESSION_SECRET);
  check(s2 && s2.username === 'ann', `the names on a ticket are ignored: it signs in the account u is (${s2 && s2.username})`); }
r = await withTicket(await ticketFor({ first: 'Ann', last: 'Lee', b: 'B1', u: '2', exp: soon() }));
check(!/lsh_session=/.test(r.cookie), "a trainee ticket whose u is an admin's account signs no one in");
r = await withTicket(await ticketFor({ first: 'Ann', last: 'Lee', b: 'B1', u: '999', exp: soon() }));
check(!/lsh_session=/.test(r.cookie), 'a trainee ticket whose u is no account signs no one in');
r = await withTicket(await ticketFor({ r: 'a', exp: soon() }));
check(/^\/trainee-login\.html\?next=/.test(r.loc), 'an administrator\'s ticket with no name (the Master Account\'s) never signs anyone in');
// single sign-on for trainers: a named administrator's ticket (a course opened from the main Hub) signs in that admin, exactly one
const bossTicket = await ticketFor({ r: 'a', n: 'Bo Trainer', exp: soon() });
r = await withTicket(bossTicket);
check(r.status === 302 && r.loc === '/simulators/gcal.html?track=standard' && /lsh_session=/.test(r.cookie), 'a trainer\'s ticket signs them in on a simulator page');
const bossSess = await u.verifySessionToken(decodeURIComponent((r.cookie.match(/lsh_session=([^;]+)/) || [])[1] || ''), env.SESSION_SECRET);
check(bossSess && bossSess.username === 'boss' && bossSess.userType === 'Admin', 'the session is the trainer\'s own admin account');
r = await withTicket(bossTicket);
check(/^\/trainee-login\.html\?next=/.test(r.loc) && !/lsh_session=/.test(r.cookie), 'a trainer\'s ticket works once');
r = await withTicket(await ticketFor({ r: 'a', n: 'Ann Lee', exp: soon() }));
check(/^\/trainee-login\.html\?next=/.test(r.loc), 'a trainer\'s ticket naming a trainee (not an admin) signs no one in');
r = await withTicket(await ticketFor({ r: 's', exp: soon() }));
check(/^\/trainee-login\.html\?next=/.test(r.loc), 'the Portal\'s system ticket signs no one in');
r = await withTicket(await ticketFor({ first: 'Ann', last: 'Lee', b: 'B1', u: '1', exp: soon() }), boss);
check(!/lsh_session=/.test(r.cookie), 'a signed-in admin keeps their own session');
// the sign-in brings a trainee back to the simulator they were sent from, never to LSH Academy Index
r = await hit('/simulators/email.html', '', '?program=CM&inbox=1');
check(r.status === 302 && r.loc === '/trainee-login.html?next=' + encodeURIComponent('/simulators/email.html?program=CM&inbox=1'), 'a signed-out simulator visit goes to the sign-in with the page to return to');
r = await hit('/trainee-login.html', ann, '?next=' + encodeURIComponent('/simulators/email.html?program=CM'));
check(r.status === 302 && r.loc === '/simulators/email.html?program=CM', 'a signed-in trainee on the sign-in page goes back to that page');
r = await hit('/trainee-login.html', ann, '?next=' + encodeURIComponent('//evil.example/x'));
check(r.status === 302 && r.loc === '/programs.html', 'a next address on another site is ignored (LSH Academy Index instead)');
// ... in every spelling a browser turns into another site: a tab or line break (browsers drop them), a backslash, //, a scheme
for (const bad of ['/\t/evil.example/x', '/\n/evil.example', '/\r\n/evil.example', '/\\evil.example', '/\t\\evil.example', '\\\\evil.example', '///evil.example',
    '//evil.example', 'https://evil.example/', 'javascript:alert(1)', ' /\t/evil.example', '/\u0000/evil.example',
    // dot segments that resolve to //evil (security review 2026-11-19)
    '/.//evil.example', '/./evil.example/..//evil.example', '/%2e//evil.example', '/%2E//evil.example', '/a/..//evil.example', '/a/%2e%2e//evil.example', '/..//evil.example', '/%2e%2e//evil.example']) {
    r = await hit('/trainee-login.html', ann, '?next=' + encodeURIComponent(bad));
    check(r.status === 302 && r.loc === '/programs.html', `a next address that leaves the site (${JSON.stringify(bad)}) is ignored: ${JSON.stringify(r.loc)}`);
    check(!mw.sameSitePath(bad, 'https://p/trainee-login.html') || !/^\/[\/\\]/.test(mw.sameSitePath(bad, 'https://p/trainee-login.html')), `sameSitePath never returns a path a browser reads as another site (${JSON.stringify(bad)})`);
}
// every Location the sign-in sends lands on this site (the browser's own reading of it)
for (const v of ['/./evil.example', '/a/b/../c?x=1', '/simulators/./gcal.html']) {
    r = await hit('/trainee-login.html', ann, '?next=' + encodeURIComponent(v));
    check(r.status === 302 && new URL(r.loc, 'https://p/x').origin === 'https://p', `a next address on this site stays on it (${v} -> ${r.loc})`);
}
// (an encoded %09 stays a literal path segment on this site, never another site; a query on this site is kept)
r = await hit('/trainee-login.html', ann, '?next=' + encodeURIComponent('/%09/evil.example'));
check(r.status === 302 && new URL(r.loc, 'https://p').origin === 'https://p', `an encoded %09 stays on this site: ${r.loc}`);
r = await hit('/trainee-login.html', ann, '?next=' + encodeURIComponent('/simulators/gcal.html?track=standard&x=//y'));
check(r.status === 302 && r.loc === '/simulators/gcal.html?track=standard&x=//y', `a next address on this site with a query is kept: ${r.loc}`);

// /api/me
const getMe = async (cookie) => { const res = await me.onRequestGet({ request: new Request('https://p/api/me', { headers: cookie ? { cookie } : {} }), env }); return { status: res.status, body: await res.json() }; };
let m = await getMe(ann); check(m.status === 200 && m.body.user.username === 'ann' && m.body.user.userType === 'Trainee' && m.body.user.fullName === 'Ann Lee', '/api/me says who is signed in');
m = await getMe(boss); check(m.status === 200 && m.body.user.userType === 'Admin', '/api/me knows an admin');
m = await getMe(''); check(m.status === 401, '/api/me answers 401 when signed out');
m = await getMe(await cookieFor('gone', 'Trainee')); check(m.status === 401 && m.body.code === 'ACCESS_REVOKED', '/api/me refuses a revoked account');

// Every link and Back target that points at the main page must carry ?stay=1.
// Without it the redirect checked above sends a signed-in person who presses
// "Home" or "Back" straight back to LSH Academy Index they just left, so
// the button looks broken. Static check, because that is how it went wrong.
const LANDING = /(?:href=["']|["'`]|encodeURIComponent\(['"])(\/index(?:\.html)?)(["'`#?])/g;
// href="/" is the landing page too, and reads as innocent, so it gets its own pattern
const BARE_ROOT = /href=["']\/["']/g;
const isCompare = (l) => /location\.pathname|path ===/.test(l);   // path comparisons, not links
const files = fs.readdirSync('.').filter(f => /\.(html|js)$/.test(f))
    .concat(fs.existsSync('simulators') ? fs.readdirSync('simulators').filter(f => /\.(html|js)$/.test(f)).map(f => 'simulators/' + f) : []);
let bare = [];
for (const f of files) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (isCompare(line)) return;
        for (const m of line.matchAll(LANDING)) {
            const after = line.slice(m.index + m[0].length - 1);
            if (!/^\?stay=1/.test(after)) bare.push(`${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
        }
        for (const _ of line.matchAll(BARE_ROOT)) bare.push(`${f}:${i + 1}  ${line.trim().slice(0, 100)}`);
    });
}
check(bare.length === 0, 'every link to the main page carries ?stay=1' + (bare.length ? ':\n    ' + bare.join('\n    ') : ''));

// the sign-in card's CSS is in one file (code inventory 2026-10-16 #9): all three pages load auth.css, none keeps its own copy
for (const pg of ['trainee-login.html', 'admin-login.html', 'registration.html']) {
    const html = fs.readFileSync(pg, 'utf8');
    check(/<link rel="stylesheet" href="\/auth\.css">/.test(html) && !/\.auth-(submit|msg|switch|card)\s*\{/.test(html), `${pg} uses auth.css and keeps no copy of the sign-in card's CSS`);
}
check(!/\.auth-(submit|msg|switch)\s*\{/.test(fs.readFileSync('styles.css', 'utf8')), 'styles.css keeps no (unreachable) copy of the sign-in card\'s CSS');

// the heartbeat's grace outlasts a backgrounded tab's throttled beats (code inventory 2026-10-16 #8): 5x the 30 s client beat
{
    check(u.HEARTBEAT_GRACE_SECONDS >= 150 && /HEARTBEAT_INTERVAL_MS = 30000/.test(fs.readFileSync('app.js', 'utf8')), `the grace window (${u.HEARTBEAT_GRACE_SECONDS} s) is at least 5x the client's 30 s beat`);
    // (💤 a session lasts 8 hours with no activity: SESSION_IDLE_SECONDS)
    check(u.SESSION_IDLE_SECONDS === 8 * 3600, `the idle window is 8 hours (${u.SESSION_IDLE_SECONDS} s)`);
    for (const [ago, alive] of [[120, true], [200, true], [7 * 3600, true], [9 * 3600, false]]) {
        sql.prepare(`INSERT OR REPLACE INTO heartbeats (username, full_name, batch_id, user_type, last_seen) VALUES ('beat', 'b', 'B1', 'Trainee', datetime('now', ?))`).run(`-${ago} seconds`);
        check(await u.isSessionHeartbeatAlive(env.DB, 'beat') === alive, `a heartbeat ${ago} s old reads ${alive ? 'alive' : 'gone'}`);
    }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
process.exit(failures.length ? 1 : 0);

// The front door: a browser that is already signed in (trainee or admin) goes from the Portal's home and sign-in pages straight to the
// Training Directory, and only a signed-out one sees a sign-in box. Also /api/me (who is signed in on this browser).
// Checks: a valid cookie is redirected from /, /index.html, /trainee-login.html and (an admin's only) /admin-login.html (even with no live heartbeat, and the heartbeat
// is restarted); no cookie, a revoked account, a locked site and ?stay=1 all get the page; a tampered cookie gets the page.
// A simulator page opened with a course's ticket (?ticket=) signs the trainee in first (a bad, expired, revoked or admin ticket doesn't).
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
for (const p of ['/', '/index.html', '/trainee-login.html']) {
    const r = await hit(p, ann);
    check(r.status === 302 && r.loc === '/programs.html', `a signed-in trainee on ${p} goes to the Training Directory`);
}
let r = await hit('/admin-login.html', ann); check(r.passed && r.status === 200, 'a signed-in trainee gets the admin sign-in (to sign in as an admin)');
r = await hit('/admin-login', ann); check(r.passed, 'the same at /admin-login (no .html)');
r = await hit('/admin-login.html', boss); check(r.status === 302 && r.loc === '/programs.html', 'a signed-in admin on the admin sign-in goes to the Training Directory');
r = await hit('/', boss); check(r.status === 302 && r.loc === '/programs.html', 'a signed-in admin at the front door goes to the Training Directory');
check(!!sql.prepare(`SELECT 1 FROM heartbeats WHERE username = 'ann'`).get(), 'the heartbeat is restarted (the cookie was valid, the heartbeat had lapsed)');
r = await hit('/trainee-login.html', ''); check(r.passed && r.status === 200, 'signed out: the sign-in page shows');
r = await hit('/', 'lsh_session=abc.def'); check(r.passed, 'a tampered cookie gets the page');
r = await hit('/trainee-login.html', ann, '?stay=1'); check(r.passed, '?stay=1 shows the sign-in page (used right after logging out)');
r = await hit('/trainee-login.html', await cookieFor('gone', 'Trainee')); check(r.passed, 'a revoked account gets the sign-in page');
r = await hit('/programs.html', ann); check(r.passed, 'the Training Directory itself is not redirected');
sql.exec(`UPDATE site_state SET locked = 1`);
r = await hit('/', ann); check(r.passed, 'a locked site shows the page');
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
r = await withTicket(await ticketFor({ first: 'Ann', last: 'Lee', b: 'B1', exp: soon() }));
check(r.status === 302 && r.loc === '/simulators/gcal.html?track=standard' && /lsh_session=/.test(r.cookie), 'a course\'s ticket signs the trainee in on a simulator page, and the address loses the ticket');
const sess = await u.verifySessionToken(decodeURIComponent((r.cookie.match(/lsh_session=([^;]+)/) || [])[1] || ''), env.SESSION_SECRET);
check(sess && sess.username === 'ann' && sess.userType === 'Trainee', 'the session is the trainee\'s own account');
r = await withTicket(await ticketFor({ first: 'Ann', last: 'Lee', b: 'B1', exp: soon() }, 'wrong-secret'));
check(r.status === 302 && r.loc === '/trainee-login.html', 'a ticket with the wrong signature gets the sign-in page');
r = await withTicket(await ticketFor({ first: 'Ann', last: 'Lee', b: 'B1', exp: Date.now() - 1000 }));
check(r.loc === '/trainee-login.html', 'an expired ticket gets the sign-in page');
r = await withTicket(await ticketFor({ first: 'Gil', last: 'Out', b: 'B1', exp: soon() }));
check(r.loc === '/trainee-login.html', 'a revoked trainee\'s ticket gets the sign-in page');
r = await withTicket(await ticketFor({ r: 'a', exp: soon() }));
check(r.loc === '/trainee-login.html', 'an administrator\'s ticket never signs anyone in');
r = await withTicket(await ticketFor({ first: 'Ann', last: 'Lee', b: 'B1', exp: soon() }), boss);
check(!/lsh_session=/.test(r.cookie), 'a signed-in admin keeps their own session');

// /api/me
const getMe = async (cookie) => { const res = await me.onRequestGet({ request: new Request('https://p/api/me', { headers: cookie ? { cookie } : {} }), env }); return { status: res.status, body: await res.json() }; };
let m = await getMe(ann); check(m.status === 200 && m.body.user.username === 'ann' && m.body.user.userType === 'Trainee' && m.body.user.fullName === 'Ann Lee', '/api/me says who is signed in');
m = await getMe(boss); check(m.status === 200 && m.body.user.userType === 'Admin', '/api/me knows an admin');
m = await getMe(''); check(m.status === 401, '/api/me answers 401 when signed out');
m = await getMe(await cookieFor('gone', 'Trainee')); check(m.status === 401 && m.body.code === 'ACCESS_REVOKED', '/api/me refuses a revoked account');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
process.exit(failures.length ? 1 : 0);

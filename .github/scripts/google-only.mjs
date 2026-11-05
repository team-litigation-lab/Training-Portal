// 🔐 Only @legalsupporthelp.com Google accounts (functions/_utils.js verifyGoogleCredential, sessionGoogleOk; google-gate.js):
// with GOOGLE_CLIENT_ID set, the Portal's sign-in takes a Google sign-in of the domain as well as the username and password, and
// every page and API refuses a session without one, so no program or tool can be opened (/api/launch needs the session).
// Checks: /api/auth-config says whether the rule is on; no Google sign-in, a personal (gmail) account, a look-alike domain, a token
// for another app, an expired one and an unverified address are refused before any password is looked at (the person is told
// to switch to their @legalsupporthelp.com Chrome profile); the domain's account signs in and its session carries the address;
// an older session without one is refused by requireSession, the page guard and /api/me, and sent to the sign-in; a course's
// ticket doesn't sign anyone in while the rule is on; with the rule off everything is as before; the sign-in pages load the step.
// Run: node --no-warnings .github/scripts/google-only.mjs   (from the repository root; Node 22.13+)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const failures = []; const fail = (m) => failures.push(m);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'go-'));
const put = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return pathToFileURL(p).href; };
const utilsUrl = put('_utils.mjs', fs.readFileSync('functions/_utils.js', 'utf8'));
const api = (f) => fs.readFileSync(`functions/api/${f}`, 'utf8').replace("'../_utils.js'", `'${utilsUrl}'`);
const vtUrl = put('verify-ticket.mjs', api('verify-ticket.js'));
const tlUrl = put('ticket-login.mjs', api('ticket-login.js').replace("'./verify-ticket.js'", `'${vtUrl}'`));
const mw = await import(put('_middleware.mjs', fs.readFileSync('functions/_middleware.js', 'utf8').replace("'./_utils.js'", `'${utilsUrl}'`).replace("'./api/ticket-login.js'", `'${tlUrl}'`)));
const me = await import(put('me.mjs', api('me.js')));
const login = await import(put('login.mjs', api('login.js')));
const cfg = await import(put('auth-config.mjs', api('auth-config.js')));
const tl = await import(tlUrl);
const u = await import(utilsUrl);

const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, email TEXT, user_type TEXT, batch_id TEXT, username TEXT UNIQUE, password TEXT, status TEXT, training_start_date TEXT);
    CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
    CREATE TABLE activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_username TEXT, actor_batch TEXT, action TEXT, details TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER);
    INSERT INTO site_state VALUES (1, 0, NULL, 0);`);
const d1 = { prepare(q) { const make = (a) => ({ bind: (...x) => make(x), async run() { const r = sql.prepare(q).run(...a); return { success: true, meta: { changes: r.changes } }; },
    async first() { const r = sql.prepare(q).get(...a); return r === undefined ? null : { ...r }; }, async all() { return { results: sql.prepare(q).all(...a).map(r => ({ ...r })) }; } }); return make([]); } };
const CLIENT = 'ci-client.apps.googleusercontent.com';
const ON = { DB: d1, SESSION_SECRET: 'ci-secret', MASTER_ADMIN_PASSWORD: 'ci-master-pass', PORTAL_SSO_SECRET: 'sso-secret', GOOGLE_CLIENT_ID: CLIENT };
const OFF = Object.assign({}, ON); delete OFF.GOOGLE_CLIENT_ID;
const hash = await u.hashPassword('Tr@ining2026!');
sql.prepare(`INSERT INTO users (first_name, last_name, email, user_type, batch_id, username, password, status) VALUES ('Ann','Lee','ann@example.com','Trainee','B110326','ann',?,'Approved'), ('Bo','Trainer','bo@example.com','Admin','A1','boss',?,'Approved')`).run(hash, hash);

// Google's tokeninfo, played here: a token is its claims as JSON
const realFetch = globalThis.fetch;
let googleCalls = 0;
globalThis.fetch = async (url, opts) => {
    const s = String(url);
    if (s.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
        googleCalls++;
        const tok = new URL(s).searchParams.get('id_token');
        if (tok === 'garbage') return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 400 });
        return new Response(tok, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(url, opts);
};
const later = Math.floor(Date.now() / 1000) + 3600;
const tok = (over) => JSON.stringify(Object.assign({ iss: 'https://accounts.google.com', aud: CLIENT, exp: String(later), email: 'ann.lee@legalsupporthelp.com', email_verified: 'true', hd: 'legalsupporthelp.com' }, over));
const post = async (env, body) => { const r = await login.onRequestPost({ request: new Request('https://p/api/login', { method: 'POST', body: JSON.stringify(body) }), env });
    return { status: r.status, cookie: r.headers.get('set-cookie') || '', data: await r.json() }; };
const creds = { portalMode: 'Trainee', username: 'ann', password: 'Tr@ining2026!' };

// 1. /api/auth-config
{
    const on = await (await cfg.onRequestGet({ env: ON })).json(), off = await (await cfg.onRequestGet({ env: OFF })).json();
    if (!on.google || on.google.clientId !== CLIENT || on.google.domain !== 'legalsupporthelp.com') fail(`/api/auth-config with the rule on: ${JSON.stringify(on)}`);
    if (off.google !== null) fail(`/api/auth-config with the rule off should say google: null: ${JSON.stringify(off)}`);
}
// 2. refused before the password: no Google sign-in, a personal account, a look-alike domain, another app's token, an expired one,
// an unverified address, a consumer account with no hd, and an unreadable token
const refusals = [
    ['no Google sign-in', undefined, 'GOOGLE_REQUIRED'],
    ['a gmail account', tok({ email: 'ann.personal@gmail.com', hd: undefined }), 'GOOGLE_WRONG_ACCOUNT'],
    ['a look-alike domain', tok({ email: 'ann@evil-legalsupporthelp.com', hd: 'evil-legalsupporthelp.com' }), 'GOOGLE_WRONG_ACCOUNT'],
    ['an address of the domain without its Workspace (no hd)', tok({ hd: undefined }), 'GOOGLE_WRONG_ACCOUNT'],
    ['an unverified address', tok({ email_verified: 'false' }), 'GOOGLE_WRONG_ACCOUNT'],
    ["another app's token", tok({ aud: 'someone-else.apps.googleusercontent.com' }), 'GOOGLE_INVALID'],
    ['an expired token', tok({ exp: String(Math.floor(Date.now() / 1000) - 60) }), 'GOOGLE_INVALID'],
    ['a token Google refuses', 'garbage', 'GOOGLE_INVALID']
];
for (const [what, g, code] of refusals) {
    const r = await post(ON, Object.assign({}, creds, g === undefined ? {} : { googleCredential: g }));
    if (r.status !== 403 || r.cookie || r.data.code !== code) fail(`${what}: should be refused with ${code}, got ${r.status} ${JSON.stringify(r.data)}`);
}
{   // the person on a personal profile is told which account and what to do
    const r = await post(ON, Object.assign({}, creds, { googleCredential: tok({ email: 'ann.personal@gmail.com', hd: undefined }) }));
    if (!/ann\.personal@gmail\.com/.test(r.data.error) || !/Chrome profile/.test(r.data.error) || !/@legalsupporthelp\.com/.test(r.data.error)) fail(`the refusal doesn't say which account and to switch Chrome profile: ${r.data.error}`);
    // (and before the password: a wrong password on a personal account is still "switch your account", not "incorrect")
    const w = await post(ON, { portalMode: 'Trainee', username: 'ann', password: 'nope', googleCredential: tok({ email: 'x@gmail.com', hd: undefined }) });
    if (w.data.code !== 'GOOGLE_WRONG_ACCOUNT') fail(`the Google check should come before the password: ${JSON.stringify(w.data)}`);
}
// 3. the domain's account signs in, and the session carries the address; a wrong password is still refused
let good;
{
    const r = await post(ON, Object.assign({}, creds, { googleCredential: tok() }));
    if (r.status !== 200 || !/lsh_session=/.test(r.cookie)) fail(`the @legalsupporthelp.com account didn't sign in: ${r.status} ${JSON.stringify(r.data)}`);
    good = (r.cookie.match(/lsh_session=([^;]+)/) || [])[1];
    const s = await u.verifySessionToken(good, ON.SESSION_SECRET);
    if (!s || s.gEmail !== 'ann.lee@legalsupporthelp.com') fail(`the session doesn't carry the Google address: ${JSON.stringify(s)}`);
    const log = sql.prepare("SELECT details FROM activity_log WHERE action = 'login' ORDER BY id DESC").get();
    if (!log || !/ann\.lee@legalsupporthelp\.com/.test(log.details || '')) fail(`the sign-in log doesn't name the Google account: ${JSON.stringify(log)}`);
    const w = await post(ON, { portalMode: 'Trainee', username: 'ann', password: 'wrong-pass', googleCredential: tok() });
    if (w.status === 200 || w.cookie) fail('a wrong password signed in with a good Google account');
    const a = await post(ON, { portalMode: 'Admin', username: 'boss', password: 'Tr@ining2026!', googleCredential: tok({ email: 'bo@legalsupporthelp.com' }) });
    if (a.status !== 200) fail(`an admin with a @legalsupporthelp.com account didn't sign in: ${a.status} ${JSON.stringify(a.data)}`);
    const ma = await post(ON, { portalMode: 'Admin', username: 'LSHADMIN123', password: 'ci-master-pass' });
    if (ma.status !== 403 || ma.data.code !== 'GOOGLE_REQUIRED') fail(`the master account signed in without Google: ${ma.status} ${JSON.stringify(ma.data)}`);
}
// 4. every gate: a session with the address passes; an older one without it (and a gmail one) is refused and sent to sign in
const oldTok = await u.createSessionToken({ username: 'ann', userType: 'Trainee', fullName: 'Ann Lee', batchId: 'B110326' }, ON.SESSION_SECRET);
const gmailTok = await u.createSessionToken({ username: 'ann', userType: 'Trainee', fullName: 'Ann Lee', batchId: 'B110326', gEmail: 'ann@gmail.com' }, ON.SESSION_SECRET);
const req = (p, t) => new Request('https://p' + p, { headers: Object.assign({ origin: 'https://p' }, t ? { cookie: 'lsh_session=' + t } : {}) });
const page = async (p, t, env = ON) => { let passed = false; const r = await mw.onRequest({ request: req(p, t), env, next: async () => { passed = true; return new Response('page'); } }); return { status: r.status, loc: r.headers.get('location') || '', passed }; };
{
    let a = await u.requireSession(req('/api/x', good), ON);
    if (!a.ok) fail(`requireSession refused a @legalsupporthelp.com session: ${JSON.stringify(await a.response.json())}`);
    for (const [what, t] of [['an older session (no Google account)', oldTok], ['a gmail session', gmailTok]]) {
        a = await u.requireSession(req('/api/x', t), ON);
        if (a.ok) fail(`requireSession let ${what} through`);
        else { const j = await a.response.json(); if (a.response.status !== 401 || j.code !== 'GOOGLE_REQUIRED') fail(`requireSession on ${what}: ${a.response.status} ${JSON.stringify(j)}`); }
        const dir = await page('/programs.html', t);
        if (dir.passed || dir.status !== 302 || !/trainee-login/.test(dir.loc)) fail(`the Training Directory let ${what} in: ${JSON.stringify(dir)}`);
        const sim = await page('/simulators/gcal.html', t);
        if (sim.passed) fail(`a simulator page let ${what} in`);
        const door = await page('/trainee-login.html', t);
        if (!door.passed) fail(`the sign-in page sent ${what} on instead of showing the sign-in: ${JSON.stringify(door)}`);
        const m = await me.onRequestGet({ request: req('/api/me', t), env: ON });
        if (m.status !== 401 || (await m.json()).code !== 'GOOGLE_REQUIRED') fail(`/api/me answered for ${what}`);
    }
    const dir = await page('/programs.html', good);
    if (!dir.passed) fail(`the Training Directory refused a @legalsupporthelp.com session: ${JSON.stringify(dir)}`);
}
// 5. a course's ticket doesn't sign anyone in to the Portal while the rule is on
{
    const b64 = (s) => Buffer.from(s).toString('base64url');
    const body = b64(JSON.stringify({ first: 'Ann', last: 'Lee', b: 'B110326', exp: Date.now() + 60000 }));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('portal-sso:' + ON.PORTAL_SSO_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))).toString('base64url');
    const ticket = body + '.' + sig;
    const on = await tl.ticketSession(ON, ticket), off = await tl.ticketSession(OFF, ticket);
    if (on.cookie || on.code !== 'GOOGLE_REQUIRED') fail(`a course ticket signed someone in with the rule on: ${JSON.stringify(on)}`);
    if (!off.cookie) fail(`a course ticket should still sign in with the rule off: ${JSON.stringify(off)}`);
}
// 6. the rule off: everything as before (no Google asked, an older session works)
{
    const before = googleCalls;
    const r = await post(OFF, creds);
    if (r.status !== 200 || !r.cookie) fail(`with the rule off the sign-in should be as before: ${r.status} ${JSON.stringify(r.data)}`);
    if (googleCalls !== before) fail('Google was asked with the rule off');
    const a = await u.requireSession(req('/api/x', oldTok), OFF);
    if (!a.ok) fail('with the rule off an older session should still work');
}
// 7. the sign-in pages load the Google step before portal.js, and portal.js sends it and shows a refusal
for (const p of ['trainee-login.html', 'admin-login.html']) {
    const h = fs.readFileSync(p, 'utf8'), g = h.indexOf('google-gate.js'), pj = h.indexOf('<script src="portal.js"');
    if (g < 0 || pj < 0 || g > pj) fail(`${p} doesn't load google-gate.js before portal.js`);
}
{
    const pj = fs.readFileSync('portal.js', 'utf8');
    if (!/payload\.googleCredential = G\.credential/.test(pj)) fail("portal.js attemptLogin doesn't send the Google credential");
    if (!/LSHGoogle\.reset\(data\.error/.test(pj)) fail("portal.js doesn't show a Google refusal on the step");
    const gg = fs.readFileSync('google-gate.js', 'utf8');
    if (!/accounts\.google\.com\/gsi\/client/.test(gg) || !/hd: cfg\.domain/.test(gg) || !/Chrome profile/.test(gg)) fail('google-gate.js: the Google button, its domain hint or the switch-profile message is missing');
}

globalThis.fetch = realFetch;
if (failures.length) { console.error('Google-only sign-in test FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('Google-only sign-in test passed (/api/auth-config; no Google sign-in, a gmail account, a look-alike domain, no Workspace, an unverified address, another app\'s, an expired or an unreadable token refused before the password, saying to switch to the @legalsupporthelp.com Chrome profile; the domain\'s account signs in with the address in its session and the log; the master account needs it too; an older or gmail session refused by requireSession, the Training Directory, the simulators and /api/me, and sent to the sign-in; a course ticket signs no one in; the rule off: as before; the sign-in pages load the step).');

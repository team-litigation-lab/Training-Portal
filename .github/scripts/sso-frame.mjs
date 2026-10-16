// A simulator opened beside a lesson stays signed in, and the session cookie that makes that
// possible cannot be used for cross-site mischief.
//
// A course opens a simulator in a frame next to the lesson (Case Management's ⧉ Side by side).
// That frame is cross-site — the course is on …workers.dev, the simulator here on …pages.dev —
// so a SameSite=Lax cookie is never sent in it: the ticket signed the trainee in, the browser
// dropped the cookie, and the trainee was shown the sign-in page inside the frame. The session
// cookie is SameSite=None; Partitioned for that reason.
//
// SameSite=None means the browser will attach the cookie to a cross-site request, so the CSRF
// protection it used to give is replaced by an origin check in requireSession(). This test is
// the guard on both halves: loosen the cookie without the check, or lose the check, and it fails.
// Run: node --no-warnings .github/scripts/sso-frame.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sso-'));
const put = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return pathToFileURL(p).href; };
const u = await import(put('_utils.mjs', fs.readFileSync('functions/_utils.js', 'utf8')));

const failures = [];
const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) failures.push(m); };

// ---- the cookie a frame can keep -------------------------------------------------
const cookie = u.sessionCookie('token-abc', 43200);
check(/SameSite=None/i.test(cookie), 'the session cookie is SameSite=None, so a cross-site frame keeps it');
check(/;\s*Secure/i.test(cookie), 'it is Secure (required with SameSite=None)');
check(/;\s*Partitioned/i.test(cookie), 'it is Partitioned, so a framing site gets its own jar');
check(/HttpOnly/i.test(cookie), 'it stays HttpOnly');
check(/Max-Age=43200/.test(cookie), 'the lifetime is still the caller\'s');
check(/Max-Age=0/.test(u.clearSessionCookie()), 'signing out still clears it');

// ---- the origin check that replaces what SameSite=Lax used to give ---------------
const req = (method, origin) => new Request('https://cm-training-activity.pages.dev/api/anything', {
    method,
    ...(origin ? { headers: { Origin: origin } } : {}),
});

check(u.originAllowed(req('GET', 'https://evil.example')), 'a GET is never blocked by origin (reading is not the risk)');
check(u.originAllowed(req('POST', 'https://cm-training-activity.pages.dev')), 'a POST from this site is allowed — that is every page here, framed or not');
check(u.originAllowed(req('POST', 'https://a1b2c3d4.cm-training-activity.pages.dev')), 'a POST from a preview deployment is allowed');
check(!u.originAllowed(req('POST', 'https://evil.example')), 'a POST from another site is refused');
check(!u.originAllowed(req('POST', 'https://cm-training-activity.pages.dev.evil.example')), 'a lookalike host is refused');
check(!u.originAllowed(req('DELETE', 'https://evil.example')), 'DELETE is covered too');
check(!u.originAllowed(req('PATCH', 'https://evil.example')), 'PATCH is covered too');
check(u.originAllowed(req('POST', null)), 'a call with no Origin is let through: not a browser, and those endpoints carry their own key');

// ---- the check is wired into the gate every data endpoint uses -------------------
const sql = new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE users (id TEXT, username TEXT, first_name TEXT, mi TEXT, last_name TEXT, suffix TEXT, status TEXT, user_type TEXT, batch_id TEXT);
CREATE TABLE heartbeats (username TEXT PRIMARY KEY, full_name TEXT, batch_id TEXT, user_type TEXT, current_case TEXT, last_seen TEXT);
CREATE TABLE site_state (id INTEGER PRIMARY KEY, locked INTEGER, locked_by_batch TEXT, paused INTEGER);
INSERT INTO site_state VALUES (1, 0, NULL, 0);`);
const stmt = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const env = { DB: { prepare: stmt }, SESSION_SECRET: 'test-secret' };

const token = await u.createSessionToken({ sub: '1', username: 'ann', batchId: 'B1', userType: 'Trainee', fullName: 'Ann Lee' }, env.SESSION_SECRET);
const withCookie = (method, origin) => new Request('https://cm-training-activity.pages.dev/api/anything', {
    method,
    headers: { cookie: 'lsh_session=' + token, ...(origin ? { Origin: origin } : {}) },
});

const blocked = await u.requireSession(withCookie('POST', 'https://evil.example'), env);
check(!blocked.ok && blocked.response.status === 403, 'requireSession refuses a valid session used from another site (403)');

const allowed = await u.requireSession(withCookie('POST', 'https://cm-training-activity.pages.dev'), env);
// the session itself is rejected later for its own reasons (no heartbeat row here); what matters
// is that it got past the origin gate rather than being turned away at it
check(allowed.ok || allowed.response.status !== 403, 'a POST from this site is not turned away at the origin gate');

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nSimulator SSO test passed (the frame keeps its session; another site cannot spend it).');
process.exit(failures.length ? 1 : 0);

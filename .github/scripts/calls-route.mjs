// The Call Simulator lives in the CMS: a link to the Portal's (/simulators/call.html, from the Simulators page, a course
// or a program) opens it there through the Portal's sign-in (functions/_middleware.js → /api/launch?tool=cms&to=calls),
// with the link's tab, line and random call, and nobody signs in again. Run: node .github/scripts/calls-route.mjs
import { onRequest } from '../../functions/_middleware.js';
import { onRequestGet as launch, callsQuery } from '../../functions/api/launch.js';
import { createSessionToken } from '../../functions/_utils.js';

const failures = []; const fail = (m) => failures.push(m);
// A database that knows one approved trainee (Jamie Cruz, batch B100526) and one admin, both with a fresh heartbeat.
const DB = { prepare(sql) { const q = { bind: () => q, first: async () => /site_state/.test(sql) ? { locked: 0, paused: 0 } : /heartbeats/.test(sql) ? { ok: 1 }
    : /SELECT status FROM users/.test(sql) ? { status: 'Approved' } : /first_name, last_name, batch_id/.test(sql) ? { first_name: 'Jamie', last_name: 'Cruz', batch_id: 'B100526' } : null,
    run: async () => ({}), all: async () => ({ results: [] }) }; return q; } };
const env = { DB, TRAINING_DB: DB, SESSION_SECRET: 'ci-secret', PORTAL_SSO_SECRET: 'sso-secret' };
const trainee = await createSessionToken({ username: 'jcruz', userType: 'Trainee', fullName: 'Jamie Cruz', batchId: 'B100526' }, env.SESSION_SECRET);
const admin = await createSessionToken({ username: 'boss', userType: 'Admin', fullName: 'Trainer', batchId: 'B1' }, env.SESSION_SECRET);
const req = (path, token) => new Request('https://cm-training-activity.pages.dev' + path, { headers: token ? { cookie: `lsh_session=${token}` } : {} });
const mw = async (path, token) => onRequest({ request: req(path, token), env, next: async () => new Response('the page') });
const go = async (path, token) => { const r = await launch({ request: req(path, token), env }); return { status: r.status, at: r.headers.get('Location') || '' }; };

// 1. the Portal's Call Simulator address → the CMS's, through /api/launch, with the link's details
const links = {
    '/simulators/call.html?program=FT&line=Reception%20Mock%20Calls&random=1': { program: 'FT', line: 'Reception Mock Calls', mode: 'graded' },
    '/simulators/call.html?flow=intake': { flow: 'intake' },
    '/simulators/call?flow=calendaring&program=FT': { flow: 'calendaring', program: 'FT' },
    '/simulators/call.html?program=EA': { program: 'EA' },
    '/simulators/call.html': {}
};
for (const [link, want] of Object.entries(links)) {
    const r = await mw(link, trainee);
    const at = r.headers.get('Location') || '';
    if (r.status !== 302 || !at.startsWith('/api/launch?tool=cms&to=calls')) { fail(`${link} didn't go to the CMS Call Simulator: ${r.status} ${at}`); continue; }
    const l = await go(at, trainee), u = l.at ? new URL(l.at) : null;
    if (l.status !== 302 || !u || u.origin !== 'https://lshcasemanagementtraining-trainingcrm.pages.dev' || !u.searchParams.get('ticket') || u.searchParams.get('calls') !== '1') { fail(`${link}: the launch didn't sign them into the CMS Call Simulator: ${l.status} ${l.at}`); continue; }
    for (const k of ['flow', 'program', 'line', 'mode']) if ((u.searchParams.get(k) || undefined) !== want[k]) fail(`${link}: the CMS link's ${k} is ${u.searchParams.get(k)} (expected ${want[k]})`);
}
// signed out: the sign-in page, not the CMS; an admin lands on the CMS's admin sign-in with the same details
const out = await mw('/simulators/call.html?program=FT', null);
if (out.status !== 302 || out.headers.get('Location') !== '/trainee-login.html') fail(`a signed-out visitor to the Call Simulator wasn't sent to sign in: ${out.status} ${out.headers.get('Location')}`);
const ad = await go('/api/launch?tool=cms&to=calls&flow=reception', admin);
if (!/^https:\/\/lshcasemanagementtraining-trainingcrm\.pages\.dev\/\?admin=1&calls=1&flow=reception$/.test(ad.at)) fail(`an Admin's Call Simulator link: ${ad.at}`);
// the other simulators are unchanged
const other = await mw('/simulators/gcal.html', trainee);
if (other.status !== 200 || (await other.text()) !== 'the page') fail('another simulator page was redirected');

// 2. only what the CMS reads goes along
const q = new URLSearchParams(callsQuery(new URLSearchParams('flow=bogus&program=<script>&line=' + 'x'.repeat(90) + '&to=roleplay&mode=practice')));
if (q.toString() !== 'calls=1') fail(`a link's unknown values went along to the CMS: ${q}`);
if (callsQuery(new URLSearchParams('line=all&flow=EA-PA')) !== 'calls=1&flow=ea-pa') fail(`"all" lines and the flow's case: ${callsQuery(new URLSearchParams('line=all&flow=EA-PA'))}`);
// to=calls is the CMS's only: a program link can't use it, and to=drill still works
const prog = await go('/api/launch?program=' + encodeURIComponent('STANDARD TRAINING') + '&to=calls', trainee);
if (/calls=1/.test(prog.at)) fail(`a program link took to=calls: ${prog.at}`);
const drill = await go('/api/launch?tool=cms&to=drill', trainee);
if (!/&drill=1$/.test(drill.at)) fail(`to=drill no longer opens the CMS drill: ${drill.at}`);

if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Call Simulator route test passed (the Portal\'s Call Simulator opens the CMS\'s, signed in, on the link\'s tab and line).');

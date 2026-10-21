// Every Call Simulator is LSH Ring Channel's (the training phone): a link to the Portal's (/simulators/call.html, from the
// Simulators page, a course or a program) opens it there through the Portal's sign-in (functions/_middleware.js →
// /api/launch?tool=ringchannel&to=calls), on 🎧 Practice, on the line the link names and with a graded call when it asks
// for one, and nobody signs in again. Run: node .github/scripts/calls-route.mjs
import { readFileSync } from 'node:fs';
import { onRequest } from '../../functions/_middleware.js';
import { onRequestGet as launch, callsQuery, messagesQuery, autoMessagesQuery } from '../../functions/api/launch.js';
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

// 1. the Portal's Call Simulator address → Ring Channel's 🎧 Practice, through /api/launch, with the link's details
const links = {
    '/simulators/call.html?program=FT&line=Reception%20Mock%20Calls&random=1': { program: 'FT', track: 'reception', graded: '1' },
    '/simulators/call.html?flow=intake': { track: 'intake' },
    '/simulators/call?flow=calendaring&program=FT': { track: 'calendar', program: 'FT' },
    '/simulators/call.html?track=calendar&mode=graded': { track: 'calendar', graded: '1' },
    '/simulators/call.html?program=EA&line=Outreach%20Calls': { program: 'EA', line: 'Outreach Calls' },
    '/simulators/call.html': {}
};
for (const [link, want] of Object.entries(links)) {
    const r = await mw(link, trainee);
    const at = r.headers.get('Location') || '';
    if (r.status !== 302 || !at.startsWith('/api/launch?tool=ringchannel&to=calls')) { fail(`${link} didn't go to Ring Channel's Call Simulator: ${r.status} ${at}`); continue; }
    const l = await go(at, trainee), u = l.at ? new URL(l.at) : null;
    if (l.status !== 302 || !u || u.origin !== 'https://lshringchannel.legalsupporthelp.workers.dev' || !u.searchParams.get('ticket') || u.hash !== '#/practice') { fail(`${link}: the launch didn't sign them into Ring Channel's practice phone: ${l.status} ${l.at}`); continue; }
    for (const k of ['track', 'line', 'program', 'graded']) if ((u.searchParams.get(k) || undefined) !== want[k]) fail(`${link}: the Ring Channel link's ${k} is ${u.searchParams.get(k)} (expected ${want[k]})`);
}
// signed out: the sign-in page, not Ring Channel; an admin opens the same phone as a trainer (Ring Channel has no sign-in of its own)
const out = await mw('/simulators/call.html?program=FT', null);
if (out.status !== 302 || out.headers.get('Location') !== '/trainee-login.html') fail(`a signed-out visitor to the Call Simulator wasn't sent to sign in: ${out.status} ${out.headers.get('Location')}`);
const ad = await go('/api/launch?tool=ringchannel&to=calls&flow=reception', admin);
if (!/^https:\/\/lshringchannel\.legalsupporthelp\.workers\.dev\/\?ticket=[^#&]+&track=reception#\/practice$/.test(ad.at)) fail(`an Admin's Call Simulator link: ${ad.at}`);
// the other simulators are unchanged
const other = await mw('/simulators/gcal.html', trainee);
if (other.status !== 200 || (await other.text()) !== 'the page') fail('another simulator page was redirected');

// 2. only what Ring Channel reads goes along
if (callsQuery(new URLSearchParams('flow=bogus&program=<script>&line=' + 'x'.repeat(90) + '&to=roleplay&mode=practice')) !== '') fail('a link\'s unknown values went along to Ring Channel');
if (callsQuery(new URLSearchParams('line=all&flow=EA-PA&program=ea')) !== 'program=EA') fail(`"all" lines and an unknown flow: ${callsQuery(new URLSearchParams('line=all&flow=EA-PA&program=ea'))}`);
if (callsQuery(new URLSearchParams('track=INTAKE&random=1')) !== 'track=intake&graded=1') fail(`the line's case and a graded call: ${callsQuery(new URLSearchParams('track=INTAKE&random=1'))}`);
// to=calls is Ring Channel's only: a program link and the CMS can't use it, and to=drill still works
const prog = await go('/api/launch?program=' + encodeURIComponent('STANDARD TRAINING') + '&to=calls', trainee);
if (/#\/practice|track=/.test(prog.at)) fail(`a program link took to=calls: ${prog.at}`);
const cmsCalls = await go('/api/launch?tool=cms&to=calls&track=reception', trainee);
if (/track=|#\/practice/.test(cmsCalls.at)) fail(`to=calls worked on the CMS: ${cmsCalls.at}`);
const drill = await go('/api/launch?tool=cms&to=drill', trainee);
if (!/&drill=1$/.test(drill.at)) fail(`to=drill no longer opens the CMS drill: ${drill.at}`);
// 3. to=messages opens the CMS's 💬 Client Messaging: only its program, a conversation's id and graded go along, and only to the CMS
const msgs = await go('/api/launch?tool=cms&to=messages&program=MD&thread=md_demand&mode=graded&line=<x>', trainee);
if (!/^https:\/\/lshcasemanagementtraining-trainingcrm\.pages\.dev\/\?ticket=[^#&]+&messages=1&program=md&thread=md_demand&mode=graded$/.test(msgs.at)) fail(`to=messages: ${msgs.at}`);
if (messagesQuery(new URLSearchParams('program=nope&thread=../../x&mode=practice')) !== 'messages=1') fail('a link\'s unknown values went along to Client Messaging');
const rcMsgs = await go('/api/launch?tool=ringchannel&to=messages', trainee);
if (/messages=1/.test(rcMsgs.at)) fail(`to=messages worked on Ring Channel: ${rcMsgs.at}`);

/* 4. to=automessages opens 💬 Automated Messaging on LSH Ring Channel: the texting simulator, where the
   firm's automation texts a client and the trainee answers. Only a thread of its own, its program and
   graded go along, and only to Ring Channel. A graded thread comes back to /api/call-results with
   kind: 'message' (.github/scripts/call-results.mjs), filed as Client Messaging on its own line. */
const auto = await go('/api/launch?tool=ringchannel&to=automessages&thread=am_reminder&program=ea&mode=graded&line=<x>', trainee);
if (!/^https:\/\/lshringchannel\.legalsupporthelp\.workers\.dev\/\?ticket=[^#&]+&messaging=1&thread=am_reminder&program=EA&mode=graded$/.test(auto.at)) fail(`to=automessages: ${auto.at}`);
const autoPlain = await go('/api/launch?tool=ringchannel&to=automessages', trainee);
if (!/\?ticket=[^#&]+&messaging=1$/.test(autoPlain.at)) fail(`the Simulators card's own link (no thread named): ${autoPlain.at}`);
if (autoMessagesQuery(new URLSearchParams('thread=../../x&program=nope&mode=practice&track=reception')) !== 'messaging=1') fail('a link\'s unknown values went along to Automated Messaging');
if (autoMessagesQuery(new URLSearchParams('thread=AM_SETTLEMENT&graded=1')) !== 'messaging=1&thread=am_settlement&mode=graded') fail(`a thread's case and a graded thread: ${autoMessagesQuery(new URLSearchParams('thread=AM_SETTLEMENT&graded=1'))}`);
// Medical Summary & Demand takes text conversations, so a thread may count in its course (a call may not).
if (!/program=MD/.test(autoMessagesQuery(new URLSearchParams('program=md')))) fail('Medsum and Demand should be able to take a messaging thread');
const cmsAuto = await go('/api/launch?tool=cms&to=automessages&thread=am_reminder', trainee);
if (/messaging=1/.test(cmsAuto.at)) fail(`to=automessages worked on the CMS: ${cmsAuto.at}`);
// The 🛠 Simulators hub is where a trainee finds it.
if (!readFileSync(new URL('../../simulators.html', import.meta.url), 'utf8').includes('/api/launch?tool=ringchannel&to=automessages')) fail('the Simulators hub has no Automated Messaging card');

if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Call Simulator route test passed (the Portal\'s Call Simulator opens LSH Ring Channel\'s practice phone, signed in, on the link\'s line, graded when it asks; 💬 Automated Messaging opens its texting simulator the same way).');

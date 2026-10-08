// LSH Ring Channel (the lshringchannel repo) has no sign-in of its own: /api/launch?tool=ringchannel opens it with a ticket it can
// check (here, /api/verify-ticket) for a trainee (their name and batch, no program access needed) and for an administrator
// (as themselves; Ring Channel only: other platforms still send admins to their password). Run: node .github/scripts/ringchannel.mjs
import { readFileSync } from 'node:fs';
import { onRequestGet as launch, SSO_TOOLS, SSO_PROGRAMS } from '../../functions/api/launch.js';
import { verifyTicket } from '../../functions/api/verify-ticket.js';
import { createSessionToken } from '../../functions/_utils.js';

const failures = []; const fail = (m) => failures.push(m);
const RC = 'https://lshringchannel.legalsupporthelp.workers.dev/';
// One approved trainee (Jamie Cruz, batch B100526) with no program access at all, and one admin, both with a fresh heartbeat.
const DB = { prepare(sql) { const q = { bind: () => q, first: async () => /site_state/.test(sql) ? { locked: 0, paused: 0 } : /heartbeats/.test(sql) ? { ok: 1 }
    : /SELECT status FROM users/.test(sql) ? { status: 'Approved' } : /first_name, last_name, batch_id/.test(sql) ? { first_name: 'Jamie', last_name: 'Cruz', batch_id: 'B100526' } : null,
    run: async () => ({}), all: async () => ({ results: [] }) }; return q; } };
const env = { DB, TRAINING_DB: DB, SESSION_SECRET: 'ci-secret', PORTAL_SSO_SECRET: 'sso-secret' };
const trainee = await createSessionToken({ username: 'jcruz', userType: 'Trainee', fullName: 'Jamie Cruz', batchId: 'B100526' }, env.SESSION_SECRET);
const admin = await createSessionToken({ username: 'boss', userType: 'Admin', fullName: 'Coach Ana', batchId: 'B1' }, env.SESSION_SECRET);
const go = async (token, q = 'tool=ringchannel') => { const r = await launch({ request: new Request('https://cm-training-activity.pages.dev/api/launch?' + q, { headers: token ? { cookie: `lsh_session=${token}` } : {} }), env }); return { status: r.status, at: r.headers.get('Location') || '' }; };

if (SSO_TOOLS.ringchannel !== RC) fail(`SSO_TOOLS.ringchannel is ${SSO_TOOLS.ringchannel}`);
// 1. a trainee (no program access needed) lands on Ring Channel with a ticket that says who they are
const t = await go(trainee);
const u = t.at ? new URL(t.at) : null;
if (t.status !== 302 || !u || u.origin + u.pathname !== RC || !u.searchParams.get('ticket')) fail(`a trainee's launch: ${t.status} ${t.at}`);
else {
    const v = await verifyTicket(env.PORTAL_SSO_SECRET, u.searchParams.get('ticket'));
    if (!v.ok || v.first !== 'Jamie' || v.last !== 'Cruz' || v.batch !== 'B100526') fail(`the ticket Ring Channel gets: ${JSON.stringify(v)}`);
}
// 2. an admin opens its console as themselves (a ticket that says admin, with their name) ...
const a = await go(admin);
const au = a.at ? new URL(a.at) : null;
if (a.status !== 302 || !au || au.origin + au.pathname !== RC || !au.searchParams.get('ticket')) fail(`an admin's launch: ${a.status} ${a.at}`);
else {
    const v = await verifyTicket(env.PORTAL_SSO_SECRET, au.searchParams.get('ticket'));
    if (!v.ok || !v.admin || v.name !== 'Coach Ana') fail(`the admin's ticket Ring Channel gets: ${JSON.stringify(v)}`);
}
// ... but on every other platform an admin still gets no ticket (their admin password there)
for (const q of ['tool=cms', 'tool=kb', 'program=' + encodeURIComponent(Object.keys(SSO_PROGRAMS)[0])]) {
    const o = await go(admin, q);
    if (/ticket=/.test(o.at) || !/[?&]admin=1/.test(o.at)) fail(`an admin's ${q} launch carries a ticket: ${o.at}`);
}
// 3. signed out: no way in
const o = await go(null);
if (o.status !== 401) fail(`a signed-out launch: ${o.status} ${o.at}`);
// 3b. ?to=aicall lands a trainee on its 🤖 AI call (🎧 Practice), ?to=console an admin on the console; neither works on another tool
const tp = await go(trainee, 'tool=ringchannel&to=aicall');
if (!/^https:\/\/lshringchannel\.legalsupporthelp\.workers\.dev\/\?ticket=[^#&]+#\/practice$/.test(tp.at)) fail(`a trainee's AI call link: ${tp.at}`);
const ac = await go(admin, 'tool=ringchannel&to=console');
if (!/\?ticket=[^#&]+#\/console$/.test(ac.at)) fail(`an admin's console link: ${ac.at}`);
const wrong = await go(trainee, 'tool=cms&to=aicall');
if (/#\/practice/.test(wrong.at)) fail(`to=aicall worked on the CMS: ${wrong.at}`);
const drill = await go(trainee, 'tool=cms&to=drill');
if (!/&drill=1$/.test(drill.at)) fail(`the CMS drill link broke: ${drill.at}`);
const kbDrill = await go(trainee, 'tool=kb&to=drill');
if (/drill=1/.test(kbDrill.at)) fail(`to=drill worked on the Knowledge Base: ${kbDrill.at}`);
// 4. the Portal links to it: the Training Directory and Master Control (the home page no longer lists the simulators).
// The Simulators hub no longer carries a Ring Channel card: it duplicated the Directory's own banner, so the hub was
// the redundant one. Dropping simulators.html from this list is the point of that change, not an oversight — the two
// places a trainee actually reaches it from are still checked.
for (const f of ['programs.html', 'core.html']) if (!readFileSync(new URL('../../' + f, import.meta.url), 'utf8').includes('/api/launch?tool=ringchannel')) fail(`${f} has no link to LSH Ring Channel`);

if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('LSH Ring Channel test passed (trainees and admins open it signed in, admins nowhere else; linked from the Directory and Master Control).');

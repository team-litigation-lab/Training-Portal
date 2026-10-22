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
// ... every training program too (single sign-on for trainers: no second password), with the blueprint landing kept:
// the programs carry no Blueprint link of their own, so the Main Portal's 🧭 Blueprint menu is the way into each deck.
for (const key of Object.keys(SSO_PROGRAMS)) {
    const o = await go(admin, 'program=' + encodeURIComponent(key) + '&to=blueprint');
    const ou = o.at ? new URL(o.at) : null;
    const v = ou && ou.searchParams.get('ticket') ? await verifyTicket(env.PORTAL_SSO_SECRET, ou.searchParams.get('ticket')) : null;
    if (o.status !== 302 || !ou || ou.origin + ou.pathname !== SSO_PROGRAMS[key] || !v || !v.ok || !v.admin || ou.hash !== '#/blueprint') fail(`an admin's ${key} launch: ${o.status} ${o.at}`);
}
// ... and the CMS and the Knowledge Base too: the trainer's own admin ticket, no admin password there
for (const q of ['tool=cms', 'tool=kb']) {
    const o = await go(admin, q);
    const ou = o.at ? new URL(o.at) : null;
    const v = ou && ou.searchParams.get('ticket') ? await verifyTicket(env.PORTAL_SSO_SECRET, ou.searchParams.get('ticket')) : null;
    if (o.status !== 302 || /admin=1/.test(o.at) || !v || !v.ok || !v.admin || v.name !== 'Coach Ana') fail(`an admin's ${q} launch: ${o.status} ${o.at}`);
}
// the Master Account's ticket has no name: it opens as the Master Account there, not as a trainer called "System Administrator"
const master = await createSessionToken({ username: 'LSHADMIN123', userType: 'Admin', fullName: 'System Administrator', batchId: '' }, env.SESSION_SECRET);
{ const o = await go(master, 'tool=cms'); const v = await verifyTicket(env.PORTAL_SSO_SECRET, new URL(o.at).searchParams.get('ticket'));
  if (!v.ok || !v.admin || v.name) fail(`the Master Account's CMS ticket: ${JSON.stringify(v)}`); }
// ... and the CMS's, Ring Channel's and the Knowledge Base's own blueprints open the same way
for (const q of ['tool=cms', 'tool=kb', 'tool=ringchannel']) {
    const o = await go(admin, q + '&to=blueprint');
    if (!/\?ticket=[^#&]+#\/blueprint$/.test(o.at || '')) fail(`an admin's ${q} blueprint link: ${o.at}`);
}
// The 🧭 Blueprint menu holds them all: the Platform Blueprint, then every program's and tool's deck. It lives on
// the Training Directory's admin bar (portal-nav.js) and nowhere else — the landing page carries no Blueprint link.
const nav = readFileSync(new URL('../../portal-nav.js', import.meta.url), 'utf8');
const dir = readFileSync(new URL('../../programs.html', import.meta.url), 'utf8');
const ix = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
if (!/BLUEPRINT_DECKS/.test(nav)) fail('the Training Directory has no 🧭 Blueprint menu');
if (!/blueprintMenu:\s*true/.test(dir)) fail('the Training Directory\'s admin bar does not open the 🧭 Blueprint menu');
if (!nav.includes("'/blueprint.html?track=admin'")) fail("the 🧭 Blueprint menu has no Platform Blueprint");
if (/blueprint\.html/.test(ix)) fail('the landing page still links to a blueprint: the menu belongs to the Training Directory only');
for (const q of ['tool=cms', 'tool=ringchannel', 'tool=kb', ...Object.keys(SSO_PROGRAMS).map((k) => 'program=' + encodeURIComponent(k))]) {
    if (!nav.includes(`/api/launch?${q}&to=blueprint`)) fail(`the 🧭 Blueprint menu has no ${q} blueprint`);
}
// ... and the 🧭 Blueprint page itself still links no deck inside a program or a tool (the menu is the one way in).
const bp = readFileSync(new URL('../../blueprint.html', import.meta.url), 'utf8');
if (/to=blueprint/.test(bp)) fail("the 🧭 Blueprint page links a blueprint inside a program or a tool");
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
// to=cmkb: the CM Training course's 📚 Knowledge Base link lands on the Case Management collection, and only on the Knowledge Base
const cmkb = await go(trainee, 'tool=kb&to=cmkb');
if (!/\?ticket=[^#&]+#\/c\/case-management$/.test(cmkb.at)) fail(`the CM Training Knowledge Base link: ${cmkb.at}`);
if (/case-management/.test((await go(trainee, 'tool=cms&to=cmkb')).at)) fail('to=cmkb worked on the CMS');
// 4. the Portal links to it: the Training Directory and Master Control (the home page no longer lists the simulators).
// The Simulators hub no longer carries a Ring Channel card: it duplicated the Directory's own banner, so the hub was
// the redundant one. Dropping simulators.html from this list is the point of that change, not an oversight — the two
// places a trainee actually reaches it from are still checked.
for (const f of ['programs.html', 'core.html']) if (!readFileSync(new URL('../../' + f, import.meta.url), 'utf8').includes('/api/launch?tool=ringchannel')) fail(`${f} has no link to LSH Ring Channel`);

if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('LSH Ring Channel test passed (trainees and admins open it signed in, admins every program, the CMS and the Knowledge Base too; every blueprint reached from the Training Directory\'s 🧭 Blueprint menu; linked from the Directory and Master Control).');

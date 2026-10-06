// LSH Ring Channel (the lshringchannel repo) opens from the Portal like the CMS and the Knowledge Base: /api/launch?tool=ringchannel
// signs a trainee in with a ticket Ring Channel can check (here, /api/verify-ticket), sends an admin to its trainer sign-in,
// and needs no program access. Run: node .github/scripts/ringchannel.mjs
import { readFileSync } from 'node:fs';
import { onRequestGet as launch, SSO_TOOLS } from '../../functions/api/launch.js';
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
const admin = await createSessionToken({ username: 'boss', userType: 'Admin', fullName: 'Trainer', batchId: 'B1' }, env.SESSION_SECRET);
const go = async (token) => { const r = await launch({ request: new Request('https://cm-training-activity.pages.dev/api/launch?tool=ringchannel', { headers: token ? { cookie: `lsh_session=${token}` } : {} }), env }); return { status: r.status, at: r.headers.get('Location') || '' }; };

if (SSO_TOOLS.ringchannel !== RC) fail(`SSO_TOOLS.ringchannel is ${SSO_TOOLS.ringchannel}`);
// 1. a trainee (no program access needed) lands on Ring Channel with a ticket that says who they are
const t = await go(trainee);
const u = t.at ? new URL(t.at) : null;
if (t.status !== 302 || !u || u.origin + u.pathname !== RC || !u.searchParams.get('ticket')) fail(`a trainee's launch: ${t.status} ${t.at}`);
else {
    const v = await verifyTicket(env.PORTAL_SSO_SECRET, u.searchParams.get('ticket'));
    if (!v.ok || v.first !== 'Jamie' || v.last !== 'Cruz' || v.batch !== 'B100526') fail(`the ticket Ring Channel gets: ${JSON.stringify(v)}`);
}
// 2. an admin lands on its trainer sign-in, with no ticket
const a = await go(admin);
if (a.at !== RC + '?admin=1') fail(`an admin's launch: ${a.status} ${a.at}`);
// 3. signed out: no way in
const o = await go(null);
if (o.status !== 401) fail(`a signed-out launch: ${o.status} ${o.at}`);
// 4. the Portal links to it: the Training Directory, the home page's Simulators, the Simulators hub and Master Control
for (const f of ['programs.html', 'index.html', 'simulators.html', 'core.html']) if (!readFileSync(new URL('../../' + f, import.meta.url), 'utf8').includes('/api/launch?tool=ringchannel')) fail(`${f} has no link to LSH Ring Channel`);

if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('LSH Ring Channel test passed (opens from the Portal signed in, admins to its trainer sign-in, linked from the Directory, home, Simulators and Master Control).');

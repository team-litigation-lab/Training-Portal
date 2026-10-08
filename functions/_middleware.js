import { requireSession, getCookie, verifySessionToken, getSiteState, upsertSessionHeartbeat } from './_utils.js';
import { ticketSession } from './api/ticket-login.js';

// The Simulators are for signed-in LSH people only (the Knowledge Base is its own site, opened through /api/launch?tool=kb). A Portal session is checked BEFORE
// any of their pages or files are sent, so a visitor without one gets a redirect to the Portal sign-in and nothing else.
// (Their APIs check the session themselves: functions/_sim-guard.js.)
// The admin pages: only a signed-in Admin gets them. Everyone else (a trainee, a visitor) is sent to the admin sign-in and receives none of the page.
const ADMIN_PAGES = [/^\/(core|attendance|progress|referrals|system)(\.html)?\/?$/i];
// The Training Directory is for signed-in people: a visitor who opens it (or presses "Access Training Directory" on the main
// page) is sent to the trainee sign-in, and comes back here once signed in. The main page itself stays public.
const MEMBER_PAGES = [/^\/programs(\.html)?\/?$/i];
const PROTECTED = [/^\/simulators(\.html)?\/?$/i, /^\/simulators\//i];
// The Call Simulator is the CMS's (its 📞 Call Simulator panel): a link to the Portal's opens that one, through the Portal's
// sign-in (/api/launch?tool=cms&to=calls), with the link's flow, program, line and random call (api/launch.js callsQuery).
const CALL_SIMULATOR = /^\/simulators\/call(\.html)?\/?$/i;

// The main page (/) is the Main Portal for everyone, signed in or not: it is the site's landing page and is never redirected.
// Only the sign-in pages send a signed-in person on to the Training Directory, so nobody sees a sign-in box while already signed
// in. This looks at the signed cookie, not the heartbeat (a person coming back from a program, with the Portal tab closed, has a
// valid cookie and a stale heartbeat), and restarts the heartbeat so the Portal treats them as signed in again. A locked site and
// a revoked account get the sign-in page.
const FRONT_DOORS = [/^\/trainee-login(\.html)?\/?$/i, /^\/admin-login(\.html)?\/?$/i];
async function signedInPerson(request, env) {
    const session = await verifySessionToken(getCookie(request, 'lsh_session'), env.SESSION_SECRET);
    if (!session) return null;
    if ((await getSiteState(env.DB)).locked) return null;
    if (session.username !== 'LSHADMIN123') {
        const u = await env.DB.prepare(`SELECT status FROM users WHERE username = ?`).bind(session.username).first();
        if (!u || u.status !== 'Approved') return null;
    }
    await upsertSessionHeartbeat(env.DB, { username: session.username, fullName: session.fullName || session.username, batchId: session.batchId, userType: session.userType });
    return session;
}

export async function onRequest(context) {
    const { request, env, next } = context;
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && FRONT_DOORS.some((re) => re.test(path)) && !new URL(request.url).searchParams.has('stay')) {
        try {
            // A trainee who wants to sign in as an admin must see the admin sign-in, so only an admin is sent on from it.
            const person = await signedInPerson(request, env);
            const adminDoor = /^\/admin-login(\.html)?\/?$/i.test(path);
            if (person && (!adminDoor || person.userType === 'Admin')) return new Response(null, { status: 302, headers: { Location: '/programs.html', 'Cache-Control': 'no-store' } });
        } catch (e) { /* any trouble: show the page as usual */ }
    }
    if (request.method === 'GET' && MEMBER_PAGES.some((re) => re.test(path))) {
        let who = null;
        try { who = await signedInPerson(request, env); } catch (e) { /* any trouble: show the page as usual */ }
        if (!who) return new Response(null, { status: 302, headers: { Location: '/trainee-login.html?next=' + encodeURIComponent(path), 'Cache-Control': 'no-store' } });
    }
    if (ADMIN_PAGES.some((re) => re.test(path))) {
        const admin = await requireSession(request, env, { adminOnly: true });
        if (admin.ok) {
            const res = await next();
            const out = new Response(res.body, res);
            out.headers.set('Cache-Control', 'private, no-store');
            out.headers.set('X-Robots-Tag', 'noindex');
            return out;
        }
        return new Response(null, { status: 302, headers: { Location: '/admin-login.html', 'Cache-Control': 'no-store' } });
    }
    if (!PROTECTED.some((re) => re.test(path))) return next();
    // A course opened a simulator with a signed ticket (?ticket=, its js/lsh-tool-links.js): sign the trainee in from it (the same session
    // as /api/login), then reload the address without the ticket, so they never see the sign-in page. A signed-in admin keeps their
    // session; a refused or expired ticket goes on as before (an existing session, else the sign-in page).
    const url = new URL(request.url);
    if (request.method === 'GET' && url.searchParams.has('ticket')) {
        const ticket = url.searchParams.get('ticket'); url.searchParams.delete('ticket');
        const cur = await verifySessionToken(getCookie(request, 'lsh_session'), env.SESSION_SECRET).catch(() => null);
        if (!(cur && cur.userType === 'Admin')) {
            try {
                const out = await ticketSession(env, ticket);
                if (out.cookie) return new Response(null, { status: 302, headers: { Location: url.pathname + url.search, 'Set-Cookie': out.cookie, 'Cache-Control': 'no-store' } });
            } catch (e) { /* the usual sign-in */ }
        }
    }
    const auth = await requireSession(request, env);
    if (auth.ok && CALL_SIMULATOR.test(path)) {
        const q = new URL(request.url).search.replace(/^\?/, '');
        return new Response(null, { status: 302, headers: { Location: '/api/launch?tool=cms&to=calls' + (q ? '&' + q : ''), 'Cache-Control': 'no-store' } });
    }
    if (auth.ok) {
        const res = await next();
        const out = new Response(res.body, res);
        out.headers.set('Cache-Control', 'private, no-store');
        out.headers.set('X-Robots-Tag', 'noindex');
        return out;
    }
    return new Response(null, { status: 302, headers: { Location: '/trainee-login.html', 'Cache-Control': 'no-store' } });
}

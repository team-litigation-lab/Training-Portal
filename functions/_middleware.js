import { requireSession, getCookie, verifySessionToken, getSiteState, upsertSessionHeartbeat, sessionGoogleOk } from './_utils.js';
import { ticketSession } from './api/ticket-login.js';

// The Simulators are for signed-in LSH people only (the Knowledge Base is its own site, opened through /api/launch?tool=kb). A Portal session is checked BEFORE
// any of their pages or files are sent, so a visitor without one gets a redirect to the Portal sign-in and nothing else.
// (Their APIs check the session themselves: functions/_sim-guard.js.)
// The admin pages: only a signed-in Admin gets them. Everyone else (a trainee, a visitor) is sent to the admin sign-in and receives none of the page.
const ADMIN_PAGES = [/^\/(core|attendance|progress|referrals|system)(\.html)?\/?$/i,
    // Trainer material (model answers, finished examples): trainers only. Trainees get only what they work from.
    /^\/simulators\/drafting\/trainers\//i,
    // The attendance Google Sheet's Apps Script (attendance.html's 📋 Copy the sheet script): for the trainers who set the sheet up.
    // It holds no secret (the feed key is typed into the sheet), but it is trainer material and stays off the public site.
    /^\/attendance-sync\.gs$/i];
// The Training Directory is for signed-in people: a visitor who opens it (or presses "Access Training Directory" on the main
// page) is sent to the trainee sign-in, and comes back here once signed in. The main page itself stays public.
const MEMBER_PAGES = [/^\/programs(\.html)?\/?$/i];
const PROTECTED = [/^\/simulators(\.html)?\/?$/i, /^\/simulators\//i];
// The Call Simulator is LSH Ring Channel's (the training phone itself): a link to the Portal's opens it there, through the
// Portal's sign-in (/api/launch?tool=ringchannel&to=calls), on the line the link names and with a graded call ringing at
// once when it asks for one (api/launch.js callsQuery).
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
    // (🔐 a session from before the @legalsupporthelp.com Google rule, or without it: the sign-in page, to sign in with Google)
    if (!sessionGoogleOk(env, session)) return null;
    if ((await getSiteState(env.DB)).locked) return null;
    if (session.username !== 'LSHADMIN123') {
        const u = await env.DB.prepare(`SELECT status FROM users WHERE username = ?`).bind(session.username).first();
        if (!u || u.status !== 'Approved') return null;
    }
    await upsertSessionHeartbeat(env.DB, { username: session.username, fullName: session.fullName || session.username, batchId: session.batchId, userType: session.userType });
    return session;
}

// The path and query of `next` when it is an address on this site, else ''.
export function sameSitePath(next, base) {
    const nxt = String(next || '');
    if (!/^\/(?![\/\\])/.test(nxt) || /[\u0000-\u001f\u007f\\]/.test(nxt)) return '';
    try {
        const here = new URL(base), u = new URL(nxt, here);
        // (resolved, a path that starts '//' or '/\' would be another site when it is sent back as a Location: '/.//evil',
        // '/%2e//evil' and '/a/..//evil' all resolve to '//evil')
        if (u.origin !== here.origin || /^\/[\/\\]/.test(u.pathname)) return '';
        return u.pathname + u.search;
    } catch (e) { return ''; }
}

export async function onRequest(context) {
    const { request, env, next } = context;
    // The path every gate below matches: percent-decoded and with repeated slashes collapsed, so /%61ttendance-sync.gs,
    // /attendance-sync%2egs and //attendance-sync.gs are the same page as /attendance-sync.gs (the host serves them all).
    const rawPath = new URL(request.url).pathname;
    let path = rawPath;
    try { path = decodeURIComponent(rawPath); } catch (e) { path = rawPath; }
    path = path.replace(/[\/\\]+/g, '/');
    if (request.method === 'GET' && FRONT_DOORS.some((re) => re.test(path)) && !new URL(request.url).searchParams.has('stay')) {
        try {
            // A trainee who wants to sign in as an admin must see the admin sign-in, so only an admin is sent on from it.
            const person = await signedInPerson(request, env);
            const adminDoor = /^\/admin-login(\.html)?\/?$/i.test(path);
            // back to the page that sent them here (a simulator a course opened), else the Training Directory
            // (only a path on this site: the browser drops tabs and line breaks from an address, so '/<TAB>/evil' would be
            // '//evil', another site; the address is resolved here as the browser will and must stay on this origin)
            const nxt = new URL(request.url).searchParams.get('next') || '';
            const to = sameSitePath(nxt, request.url) || '/programs.html';
            if (person && (!adminDoor || person.userType === 'Admin')) return new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } });
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
            if (/\.gs$/i.test(path)) out.headers.set('Content-Type', 'text/plain; charset=UTF-8');
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
                // (back to the same page on this site: a path asked for as //x must not come back as a Location to another site)
                if (out.cookie) return new Response(null, { status: 302, headers: { Location: '/' + url.pathname.replace(/^[\/\\]+/, '') + url.search, 'Set-Cookie': out.cookie, 'Cache-Control': 'no-store' } });
            } catch (e) { /* the usual sign-in */ }
        }
    }
    const auth = await requireSession(request, env);
    if (auth.ok && CALL_SIMULATOR.test(path)) {
        const q = new URL(request.url).search.replace(/^\?/, '');
        return new Response(null, { status: 302, headers: { Location: '/api/launch?tool=ringchannel&to=calls' + (q ? '&' + q : ''), 'Cache-Control': 'no-store' } });
    }
    if (auth.ok) {
        const res = await next();
        const out = new Response(res.body, res);
        out.headers.set('Cache-Control', 'private, no-store');
        out.headers.set('X-Robots-Tag', 'noindex');
        return out;
    }
    // the sign-in brings them back to this simulator, not to the Training Directory
    return new Response(null, { status: 302, headers: { Location: '/trainee-login.html?next=' + encodeURIComponent(url.pathname + url.search), 'Cache-Control': 'no-store' } });
}

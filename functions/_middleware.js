import { requireSession, getCookie, verifySessionToken, getSiteState, upsertSessionHeartbeat } from './_utils.js';

// The Simulators are for signed-in LSH people only (the Knowledge Base is its own site, opened through /api/launch?tool=kb). A Portal session is checked BEFORE
// any of their pages or files are sent, so a visitor without one gets a redirect to the Portal sign-in and nothing else.
// (Their APIs check the session themselves: functions/_sim-guard.js.)
// The admin pages: only a signed-in Admin gets them. Everyone else (a trainee, a visitor) is sent to the admin sign-in and receives none of the page.
const ADMIN_PAGES = [/^\/(core|attendance|progress|referrals)(\.html)?\/?$/i];
const PROTECTED = [/^\/simulators(\.html)?\/?$/i, /^\/simulators\//i];
// The Call Simulator is the CMS's (its 📞 Call Simulator panel): a link to the Portal's opens that one, through the Portal's
// sign-in (/api/launch?tool=cms&to=calls), with the link's flow, program, line and random call (api/launch.js callsQuery).
const CALL_SIMULATOR = /^\/simulators\/call(\.html)?\/?$/i;

// Already signed in? Then the Portal's front door and sign-in pages go straight to the Training Directory (the main portal), for a
// trainee and an admin alike: nobody sees a sign-in box unless they are signed out. This looks at the signed cookie, not the
// heartbeat (a person coming back from a program, with the Portal tab closed, has a valid cookie and a stale heartbeat), and
// restarts the heartbeat so the Portal treats them as signed in again. A locked site and a revoked account get the sign-in page.
const FRONT_DOORS = [/^\/$/, /^\/index(\.html)?\/?$/i, /^\/trainee-login(\.html)?\/?$/i, /^\/admin-login(\.html)?\/?$/i];
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
            if (await signedInPerson(request, env)) return new Response(null, { status: 302, headers: { Location: '/programs.html', 'Cache-Control': 'no-store' } });
        } catch (e) { /* any trouble: show the page as usual */ }
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

import { requireSession } from './_utils.js';

// The Simulators are for signed-in LSH people only (the Knowledge Base is its own site, opened through /api/launch?tool=kb). A Portal session is checked BEFORE
// any of their pages or files are sent, so a visitor without one gets a redirect to the Portal sign-in and nothing else.
// (Their APIs check the session themselves: functions/_sim-guard.js.)
// The admin pages: only a signed-in Admin gets them. Everyone else (a trainee, a visitor) is sent to the admin sign-in and receives none of the page.
const ADMIN_PAGES = [/^\/(core|attendance|progress|referrals)(\.html)?\/?$/i];
const PROTECTED = [/^\/simulators(\.html)?\/?$/i, /^\/simulators\//i];
// The Call Simulator is the CMS's (its 📞 Call Simulator panel): a link to the Portal's opens that one, through the Portal's
// sign-in (/api/launch?tool=cms&to=calls), with the link's flow, program, line and random call (api/launch.js callsQuery).
const CALL_SIMULATOR = /^\/simulators\/call(\.html)?\/?$/i;

export async function onRequest(context) {
    const { request, env, next } = context;
    const path = new URL(request.url).pathname;
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

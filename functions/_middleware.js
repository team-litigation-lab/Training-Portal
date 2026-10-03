import { requireSession } from './_utils.js';

// The Simulators and the Knowledge Base are for signed-in LSH people only. A Portal session is checked BEFORE
// any of their pages or files are sent, so a visitor without one gets a redirect to the Portal sign-in and nothing else.
// (Their APIs check the session themselves: functions/_sim-guard.js and functions/_kb.js.)
// The admin pages: only a signed-in Admin gets them. Everyone else (a trainee, a visitor) is sent to the admin sign-in and receives none of the page.
const ADMIN_PAGES = [/^\/(core|attendance|progress|referrals)(\.html)?\/?$/i];
const PROTECTED = [/^\/simulators(\.html)?\/?$/i, /^\/simulators\//i, /^\/kb(\.html)?\/?$/i];

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
    if (auth.ok) {
        const res = await next();
        const out = new Response(res.body, res);
        out.headers.set('Cache-Control', 'private, no-store');
        out.headers.set('X-Robots-Tag', 'noindex');
        return out;
    }
    return new Response(null, { status: 302, headers: { Location: '/trainee-login.html', 'Cache-Control': 'no-store' } });
}

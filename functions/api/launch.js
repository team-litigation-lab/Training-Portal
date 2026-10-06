import { requireSession, b64url } from '../_utils.js';

// Opens a training program for the signed-in trainee or administrator, with no second sign-in there.
//
// GET /api/launch?program=<topic key>   (they must be logged in on this portal)
//
// The program trusts a short-lived ticket this function signs with PORTAL_SSO_SECRET (the same
// secret is set on the program's Worker). The ticket says who the trainee is, from their portal
// account: first name, last name and batch. It is good for 5 minutes, and only for the program
// it was made for, so a copied link is no use later.
//
//   ticket = base64url(JSON {first, last, b, exp}) + "." + base64url(HMAC-SHA256("portal-sso:" + secret, that text))
//
// Only programs whose site accepts tickets are listed. The others still open directly, until they
// get js/portal-gate.js and the Worker endpoints too (see the Foundational-Training repo).
export const SSO_PROGRAMS = {
    'STANDARD TRAINING': 'https://foundational-training.legalsupporthelp.workers.dev/',
    'EA  PA TRAINING-OUTSOURCED MANP': 'https://ea-pa-training.legalsupporthelp.workers.dev/',
    'CM TRAINING': 'https://case-management-training.legalsupporthelp.workers.dev/',
    'PROPERTY DAMAGE': 'https://propertydamageclaimstraining.legalsupporthelp.workers.dev/',
    'MEDSUM AND DEMAND': 'https://medsumanddemandtraining.legalsupporthelp.workers.dev/'
};
// Shared tools that aren't programs: any signed-in, approved person opens them (no program access to request).
// ringchannel is LSH Ring Channel (the lshringchannel repo), the VOIP phone for trainer-led mock calls. It has no sign-in of its own:
// a trainee's ticket opens their phone, and an administrator's opens the console as a trainer (ADMIN_TICKET_TOOLS). It checks
// tickets at its /api/auth/portal (with PORTAL_SSO_SECRET, or here at /api/verify-ticket), and each one works only once there.
export const SSO_TOOLS = {
    cms: 'https://lshcasemanagementtraining-trainingcrm.pages.dev/',
    kb: 'https://lsh-knowledge-base.legalsupporthelp.workers.dev/',
    ringchannel: 'https://lshringchannel.legalsupporthelp.workers.dev/'
};
// The tools an administrator opens signed in, as themselves (a ticket { r: 'a', n: their name }): Ring Channel only.
// Everywhere else administrators type the admin password, as below.
export const ADMIN_TICKET_TOOLS = ['ringchannel'];
const TICKET_TTL_MS = 5 * 60 * 1000;
// Where inside a program or tool a link lands (?to=): a program's own Live Roleplay, the CMS Front Desk Drill, or the CMS
// Call Simulator (to=calls: every platform's Call Simulator opens there, on the tab and line the link names, callsQuery).
// Only these are allowed, so a link can't send anyone anywhere else.
const LANDINGS = { roleplay: { hash: '#/crisisroleplay' }, drill: { query: '&drill=1', tool: 'cms' }, calls: { tool: 'cms' } };
function landing(to, isTool, params) {
    const l = Object.prototype.hasOwnProperty.call(LANDINGS, to) ? LANDINGS[to] : null;
    if (!l || (l.tool && !isTool) || (!l.tool && isTool)) return { query: '', hash: '' };
    if (to === 'calls') return { query: '&' + callsQuery(params), hash: '' };
    return { query: l.query || '', hash: l.hash || '' };
}
// The CMS Call Simulator's tab and line from a link (the Portal's /simulators/call.html, a course, a program):
// ?flow= (standard, cms, reception, intake, calendaring, ea-pa, pd), ?program= (FT, CM, PD, EA), ?line= (a line's name),
// and ?random=1 or ?mode=graded (a line's graded call: a random caller, unknown until the debrief).
const CALL_FLOWS = ['standard', 'cms', 'reception', 'intake', 'calendaring', 'ea-pa', 'pd'];
export function callsQuery(params) {
    const q = new URLSearchParams({ calls: '1' });
    const flow = String(params.get('flow') || '').trim().toLowerCase();
    if (CALL_FLOWS.includes(flow)) q.set('flow', flow);
    const program = String(params.get('program') || '').trim();
    if (/^[A-Za-z][A-Za-z -]{0,30}$/.test(program)) q.set('program', program);
    const line = String(params.get('line') || '').trim();
    if (line && line.length <= 80 && !/^(all|core)$/i.test(line)) q.set('line', line);
    if (params.get('random') === '1' || params.get('mode') === 'graded') q.set('mode', 'graded');
    return q.toString();
}

// A trainee's ticket carries their name and batch. {r: 'a'} (an administrator) no longer signs anyone in: the platforms refuse it,
// because administrators type the admin password on every platform. {r: 's'} is the Portal's own server-side tools only
// (Sign-in check, registration import): never given to a person.
export async function makeTicket(secret, who, now = Date.now()) {
    const enc = new TextEncoder();
    const body = who.system ? { r: 's', exp: now + TICKET_TTL_MS } : who.admin ? Object.assign({ r: 'a', exp: now + TICKET_TTL_MS }, who.name ? { n: String(who.name).slice(0, 60) } : {}) : { first: who.first, last: who.last, b: who.batch, exp: now + TICKET_TTL_MS };
    const payload = b64url(enc.encode(JSON.stringify(body)));
    const key = await crypto.subtle.importKey('raw', enc.encode('portal-sso:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return payload + '.' + b64url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

const page = (status, title, msg, href = '/programs.html', label = '&larr; Back to the Training Directory') => new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>` +
    `<body style="font-family:Arial,Helvetica,sans-serif;background:#081226;color:#fff;text-align:center;padding:60px 20px"><h1 style="font-size:20px">${title}</h1><p style="color:#cbd5e1">${msg}</p>` +
    `<p><a href="${href}" style="color:#f97316;font-weight:700">${label}</a></p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' } }
);

export async function onRequestGet(ctx) {
    // Never end in a blank Cloudflare error page (1101): say what failed, so it can be fixed.
    try {
        return await launch(ctx);
    } catch (e) {
        const detail = String((e && (e.message || e)) || 'unknown error').slice(0, 220);
        console.error('launch failed:', e && e.stack || e);
        return page(500, 'Couldn\'t open the program', 'Something went wrong on the Portal while opening it. Please send this to your administrator: ' +
            `<br><code style="display:inline-block;margin-top:8px;padding:6px 10px;background:#0f2148;border-radius:8px;color:#fde68a">${detail.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</code>`);
    }
}

async function launch({ request, env }) {
    const params = new URL(request.url).searchParams;
    const tool = params.get('tool') || '';
    const program = params.get('program') || '';
    const isTool = Object.prototype.hasOwnProperty.call(SSO_TOOLS, tool);
    const target = isTool ? SSO_TOOLS[tool] : (Object.prototype.hasOwnProperty.call(SSO_PROGRAMS, program) ? SSO_PROGRAMS[program] : null);
    if (!target) return page(400, 'Unknown program', 'That program can\'t be opened this way.');

    const auth = await requireSession(request, env);
    if (!auth.ok) {
        // Say why, instead of silently sending people back to the login page (which looked like a loop).
        const info = await auth.response.json().catch(() => ({}));
        const why = {
            NOT_AUTHENTICATED: ['Please log in', 'The Portal doesn\'t see you as logged in on this browser. Log in again, then open the program from the Training Directory.'],
            SESSION_EXPIRED: ['Your Portal session timed out', 'The Portal stays signed in only while a Portal page is open and active. Log in again, then open the program from the Training Directory.'],
            ACCESS_REVOKED: ['Your account isn\'t approved', 'Your account has been revoked or isn\'t approved yet. Please tell your trainer.'],
            SITE_LOCKED: ['The Portal is locked', 'An administrator has locked the Portal for now. Please try again later.']
        }[info.code] || ['Please log in', 'The Portal couldn\'t confirm your session. Log in again, then open the program from the Training Directory.'];
        return page(401, why[0], why[1] + ` <span style="opacity:.6">(code: ${info.code || 'unknown'})</span>`, '/trainee-login.html', 'Go to Trainee Log In');
    }
    // Ignore any space or line break pasted around the secret (the programs do the same).
    const secret = String(env.PORTAL_SSO_SECRET || '').trim();
    if (!secret) return page(503, 'Not available yet', 'Single sign-in isn\'t set up yet. Please tell your trainer.');

    // Administrators were signed in here with their admin password, so the program doesn't ask again.
    if (auth.session.userType === 'Admin') {
        // Ring Channel has no sign-in of its own: an administrator opens its console as themselves.
        if (isTool && ADMIN_TICKET_TOOLS.includes(tool)) {
            const ticket = await makeTicket(secret, { admin: true, name: String(auth.session.fullName || auth.session.username || 'Trainer').trim() });
            return Response.redirect(`${target}?ticket=${ticket}`, 302);
        }
        // Administrators type the admin password on every other platform: no ticket signs them in, they land on that platform's password prompt.
        const to = landing(params.get('to') || '', isTool, params);
        return Response.redirect(`${target}?admin=1${to.query}${to.hash}`, 302);
    }
    if (auth.session.userType !== 'Trainee') return page(403, 'Not available', 'This account can\'t open programs.');

    const user = await env.DB.prepare(`SELECT first_name, last_name, batch_id FROM users WHERE username = ?`).bind(auth.session.username).first();
    if (!user || !user.first_name || !user.last_name) return page(403, 'Account incomplete', 'Your account has no name on record. Please tell your trainer.');
    if (!user.batch_id && !isTool) return page(403, 'No batch yet', 'Your Batch ID is assigned when an administrator approves your registration. Please check back after that.');

    // Same rule the directory shows: the trainee needs approved (or passed) access to this program.
    // Program access lives in TRAINING_DB (with the topics), not in DB (accounts and sessions).
    const access = isTool ? { status: 'Approved' } : await env.TRAINING_DB.prepare(`SELECT status FROM trainee_topic_access WHERE trainee_username = ? AND topic_key = ?`).bind(auth.session.username, program).first();
    if (!access || (access.status !== 'Approved' && access.status !== 'Passed')) {
        return page(403, 'Access not approved', 'Request access to this program in the Training Directory first, and wait for an administrator to approve it.');
    }

    const ticket = await makeTicket(secret, { first: user.first_name.trim(), last: user.last_name.trim(), batch: String(user.batch_id || '').trim() });
    const to = landing(params.get('to') || '', isTool, params);
    return Response.redirect(`${target}?ticket=${ticket}${to.query}${to.hash}`, 302);
}

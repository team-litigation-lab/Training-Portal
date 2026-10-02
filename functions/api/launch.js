import { requireSession } from '../_utils.js';

// Opens a training program for the signed-in trainee, with no second sign-in there.
//
// GET /api/launch?program=<topic key>   (the trainee must be logged in on this portal)
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
const SSO_PROGRAMS = {
    'STANDARD TRAINING': 'https://foundational-training.legalsupporthelp.workers.dev/'
};
const TICKET_TTL_MS = 5 * 60 * 1000;

function b64url(bytes) {
    let s = '';
    new Uint8Array(bytes).forEach(b => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function makeTicket(secret, { first, last, batch }, now = Date.now()) {
    const enc = new TextEncoder();
    const payload = b64url(enc.encode(JSON.stringify({ first, last, b: batch, exp: now + TICKET_TTL_MS })));
    const key = await crypto.subtle.importKey('raw', enc.encode('portal-sso:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return payload + '.' + b64url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
}

const page = (status, title, msg) => new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>` +
    `<body style="font-family:Arial,Helvetica,sans-serif;background:#081226;color:#fff;text-align:center;padding:60px 20px"><h1 style="font-size:20px">${title}</h1><p style="color:#cbd5e1">${msg}</p>` +
    `<p><a href="/programs.html" style="color:#f97316;font-weight:700">&larr; Back to the Training Directory</a></p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' } }
);

export async function onRequestGet({ request, env }) {
    const program = new URL(request.url).searchParams.get('program') || '';
    const target = Object.prototype.hasOwnProperty.call(SSO_PROGRAMS, program) ? SSO_PROGRAMS[program] : null;
    if (!target) return page(400, 'Unknown program', 'That program can\'t be opened this way.');

    const auth = await requireSession(request, env);
    if (!auth.ok) return Response.redirect(new URL('/trainee-login.html', request.url).toString(), 302);
    if (auth.session.userType !== 'Trainee') {
        return page(403, 'Trainee accounts only', 'Administrators open programs directly from the Training Directory with their passphrase.');
    }
    if (!env.PORTAL_SSO_SECRET) return page(503, 'Not available yet', 'Single sign-in isn\'t set up yet. Please tell your trainer.');

    const user = await env.DB.prepare(`SELECT first_name, last_name, batch_id FROM users WHERE username = ?`).bind(auth.session.username).first();
    if (!user || !user.first_name || !user.last_name) return page(403, 'Account incomplete', 'Your account has no name on record. Please tell your trainer.');
    if (!user.batch_id) return page(403, 'No batch yet', 'Your Batch ID is assigned when an administrator approves your registration. Please check back after that.');

    // Same rule the directory shows: the trainee needs approved (or passed) access to this program.
    const access = await env.DB.prepare(`SELECT status FROM trainee_topic_access WHERE trainee_username = ? AND topic_key = ?`).bind(auth.session.username, program).first();
    if (!access || (access.status !== 'Approved' && access.status !== 'Passed')) {
        return page(403, 'Access not approved', 'Request access to this program in the Training Directory first, and wait for an administrator to approve it.');
    }

    const ticket = await makeTicket(env.PORTAL_SSO_SECRET, { first: user.first_name.trim(), last: user.last_name.trim(), batch: String(user.batch_id).trim() });
    return Response.redirect(`${target}?ticket=${ticket}`, 302);
}

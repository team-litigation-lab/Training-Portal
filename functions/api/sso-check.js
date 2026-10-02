import { requireSession } from '../_utils.js';
import { makeTicket, SSO_PROGRAMS } from './launch.js';

// Admin-only: does each program accept the Portal's sign-in ticket?
//
// GET /api/sso-check   (log in on the Portal as an admin first)
//
// For every program that opens through /api/launch, this signs a test (admin) ticket with the Portal's
// PORTAL_SSO_SECRET and sends it to that program's /api/auth/portal, then lists what the program said:
//   OK                the program accepted the ticket: single sign-in works for it
//   MISMATCH          the program couldn't verify the signature: its PORTAL_SSO_SECRET differs from the Portal's
//   NOT LOCKED YET    the program has no PORTAL_SSO_SECRET / admin password set, so it ignores tickets
//   (anything else)   the program answered something unexpected, shown as is
// Nothing is changed or stored anywhere; the session token a program returns is discarded.
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function describe(status, body) {
    if (status === 200 && body && body.token) return ['OK', 'ok', 'The program accepted the Portal\'s ticket.'];
    if (status === 401 && body && body.code === 'signature') return ['MISMATCH', 'bad', 'The program couldn\'t verify the signature: its PORTAL_SSO_SECRET is different from the Portal\'s.'];
    if (status === 401) return ['REFUSED', 'bad', (body && body.error) || 'The program refused the ticket.'];
    if (status === 501 || status === 404) return ['NOT LOCKED YET', 'warn', 'The program has no PORTAL_SSO_SECRET and admin password set (or isn\'t updated yet), so it ignores tickets.'];
    return ['UNEXPECTED (' + status + ')', 'warn', (body && body.error) || ''];
}

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const secret = String(env.PORTAL_SSO_SECRET || '').trim();
    const rows = [];
    for (const [key, url] of Object.entries(SSO_PROGRAMS)) {
        let result;
        if (!secret) result = ['PORTAL HAS NO SECRET', 'bad', 'PORTAL_SSO_SECRET isn\'t set on the Portal (Production), or the Portal hasn\'t been redeployed since it was added.'];
        else {
            try {
                const ticket = await makeTicket(secret, { admin: true });
                const res = await fetch(url + 'api/auth/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket }) });
                result = describe(res.status, await res.json().catch(() => null));
            } catch (e) { result = ['UNREACHABLE', 'warn', String(e && e.message || e)]; }
        }
        rows.push({ key, url, result });
    }
    const color = { ok: '#16a34a', bad: '#dc2626', warn: '#d97706' };
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sign-in check</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#081226;color:#fff;padding:32px 20px;max-width:760px;margin:0 auto">
<h1 style="font-size:20px">Single sign-in check</h1>
<p style="color:#cbd5e1;font-size:13px">Each program is sent a test ticket signed with the Portal's secret. <b>OK</b> means it works. Reload this page after changing a secret (and after redeploying the Portal).</p>
${rows.map(r => `<div style="background:#0f2148;border-radius:12px;padding:14px 16px;margin:10px 0;border-left:5px solid ${color[r.result[1]]}">
<div style="font-weight:800">${esc(r.key)} <span style="color:${color[r.result[1]]};float:right">${esc(r.result[0])}</span></div>
<div style="font-size:12px;color:#cbd5e1;margin-top:4px">${esc(r.url)}<br>${esc(r.result[2])}</div></div>`).join('')}
<p><a href="/programs.html" style="color:#f97316;font-weight:700">&larr; Back to the Training Directory</a></p></body></html>`;
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' } });
}

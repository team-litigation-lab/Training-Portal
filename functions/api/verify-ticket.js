// POST /api/verify-ticket { ticket }  → { ok:true, admin:true } | { ok:true, first, last, batch } | { ok:false, code }
//
// For sites that open from the Portal but don't hold the shared sign-in secret themselves (the CMS): they send the ticket
// they were handed back here, and trust only this answer. The ticket is signed with PORTAL_SSO_SECRET (see launch.js), so
// nobody can make one that passes; it expires in 5 minutes. Nothing is stored and nothing but the ticket's own contents comes back.
const MAX_AHEAD_MS = 10 * 60 * 1000;
const enc = new TextEncoder();
const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function b64url(bytes) {
    let s = '';
    new Uint8Array(bytes).forEach(b => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function same(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}

export async function verifyTicket(secret, ticket) {
    if (!secret) return { ok: false, code: 'not-configured' };
    const parts = String(ticket || '').split('.');
    if (parts.length !== 2) return { ok: false, code: 'format' };
    const key = await crypto.subtle.importKey('raw', enc.encode('portal-sso:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    if (!same(b64url(await crypto.subtle.sign('HMAC', key, enc.encode(parts[0]))), parts[1])) return { ok: false, code: 'signature' };
    let t;
    try { t = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))); } catch (e) { return { ok: false, code: 'format' }; }
    const exp = Number(t && t.exp);
    if (!exp || Date.now() > exp || exp - Date.now() > MAX_AHEAD_MS) return { ok: false, code: 'expired' };
    if (t.r === 'a') return { ok: true, admin: true };
    const first = String(t.first || '').trim(), last = String(t.last || '').trim(), batch = String(t.b || '').trim();
    if (!first || !last) return { ok: false, code: 'format' };
    return { ok: true, first, last, batch };
}

export async function onRequestPost({ request, env }) {
    let body;
    try { body = await request.json(); } catch (e) { return reply({ ok: false, code: 'format' }, 400); }
    const out = await verifyTicket(String(env.PORTAL_SSO_SECRET || '').trim(), body.ticket);
    return reply(out, out.ok ? 200 : (out.code === 'not-configured' ? 501 : 401));
}

import { b64url } from '../_utils.js';

// POST /api/verify-ticket { ticket }  → { ok:true, admin:true, name, p? } | { ok:true, first, last, batch, full?, p? } | { ok:false, code }
// (code 'audience': the ticket was made for a training program, not for a tool or the Portal)
// (name: the administrator's, on the tickets made for Ring Channel; '' on others)
//
// For sites that open from the Portal but don't hold the shared sign-in secret themselves (the CMS): they send the ticket
// they were handed back here, and trust only this answer. The ticket is signed with PORTAL_SSO_SECRET (see launch.js), so
// nobody can make one that passes; it expires in 5 minutes. Nothing is stored and nothing but the ticket's own contents comes back.
const MAX_AHEAD_MS = 10 * 60 * 1000;
// 🎯 A ticket's audience (p): the Portal's /api/launch names the program (its topic key) or the tool (kb, cms, ringchannel) it
// made the ticket for, and a course names the tool its /api/auth/tool-ticket ticket is for ('tool', 'portal', 'kb'). Only the
// tools' and the Portal's own audiences are good here: a ticket made for a program is that program's alone, so it can't be
// turned into a Portal session or a CMS / KB / Ring Channel sign-in. A ticket with no p (made before the audience existed,
// or by a course not yet updated) is still taken.
export const TOOL_AUDIENCES = ['kb', 'cms', 'ringchannel', 'portal', 'tool'];
const enc = new TextEncoder();
const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function same(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}

// audiences (optional): the audiences this caller takes; a ticket whose p is another one is refused (code 'audience').
export async function verifyTicket(secret, ticket, { audiences } = {}) {
    if (!secret) return { ok: false, code: 'not-configured' };
    const parts = String(ticket || '').split('.');
    if (parts.length !== 2) return { ok: false, code: 'format' };
    const key = await crypto.subtle.importKey('raw', enc.encode('portal-sso:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    if (!same(b64url(await crypto.subtle.sign('HMAC', key, enc.encode(parts[0]))), parts[1])) return { ok: false, code: 'signature' };
    let t;
    try { t = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))); } catch (e) { return { ok: false, code: 'format' }; }
    const exp = Number(t && t.exp);
    if (!exp || Date.now() > exp || exp - Date.now() > MAX_AHEAD_MS) return { ok: false, code: 'expired' };
    const aud = t.p == null ? '' : String(t.p);
    if (aud && audiences && !audiences.includes(aud)) return { ok: false, code: 'audience' };
    const p = aud ? { p: aud } : {};
    if (t.r === 's') return { ok: true, system: true, ...p };
    if (t.r === 'a') return { ok: true, admin: true, name: String(t.n || '').slice(0, 60), ...p };
    const first = String(t.first || '').trim(), last = String(t.last || '').trim(), batch = String(t.b || '').trim();
    if (!first || !last) return { ok: false, code: 'format' };
    const full = String(t.full || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    return { ok: true, first, last, batch, ...(full ? { full } : {}), ...p };
}

export async function onRequestPost({ request, env }) {
    let body;
    try { body = await request.json(); } catch (e) { return reply({ ok: false, code: 'format' }, 400); }
    const out = await verifyTicket(String(env.PORTAL_SSO_SECRET || '').trim(), body.ticket, { audiences: TOOL_AUDIENCES });
    return reply(out, out.ok ? 200 : (out.code === 'not-configured' ? 501 : 401));
}

import { kbGate } from '../_kb.js';

// Official SOPs and resources (/kb-files/…) are only served to Knowledge Base
// readers: VAs who entered the team access code, and signed-in admins.
// Everyone else gets 401, even with a direct link.
export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await kbGate(request, env);
    if (gate.response) return gate.response;
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'private, no-store');
    out.headers.set('X-Robots-Tag', 'noindex');
    return out;
}

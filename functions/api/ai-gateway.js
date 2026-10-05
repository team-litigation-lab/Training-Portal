import { json, requireSession } from '../_utils.js';
import { runAi, runLiveToken, usageSummary, normModule } from '../_ai-gateway.js';

// The shared AI gateway for everything outside the Portal's own pages: the CMS and the programs' Workers.
//
//   POST /api/ai-gateway   header X-Gateway-Key: <AI_GATEWAY_SECRET>   (the same secret on every caller)
//        { module: 'standard'|'cms'|'reception'|'intake'|'calendaring'|'ea-pa'|'pd'|'medsum', user, system,
//          messages: [{ role: 'user'|'model', text }], json, maxTokens }
//        → { success, text, model, tokens }  or  { success: false, error, scope } with 429 when a budget says wait
//   POST /api/ai-gateway   { action: 'live-token', module, user, setup, model, maxMinutes }  → { success, token }   (a live voice call: counts as AI_LIVE_COST requests)
//   GET  /api/ai-gateway   (a signed-in admin) today's usage: calls, tokens, errors and refusals per call flow, and the limits
//
// The secret is compared in constant time. Without AI_GATEWAY_SECRET set on the Portal the POST answers 501.
const MAX_MESSAGES = 60, MAX_CHARS = 40000;
const enc = new TextEncoder();
function same(a, b) {
    const x = enc.encode(String(a)), y = enc.encode(String(b));
    if (x.length !== y.length) return false;
    let d = 0;
    for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
    return d === 0;
}

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    return json({ success: true, ...(await usageSummary(env.TRAINING_DB, env)) });
}

export async function onRequestPost({ request, env }) {
    const want = String(env.AI_GATEWAY_SECRET || '').trim();
    if (!want) return json({ success: false, error: 'The AI gateway has no AI_GATEWAY_SECRET on the Portal yet.' }, 501);
    if (!same(String(request.headers.get('X-Gateway-Key') || '').trim(), want)) return json({ success: false, error: 'Not allowed.' }, 401);
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    if (body.action === 'live-token') {
        if (!body.setup || typeof body.setup !== 'object' || !body.model) return json({ success: false, error: 'setup and model are required.' }, 400);
        const t = await runLiveToken(env.TRAINING_DB, env, { module: normModule(body.module), user: body.user, setup: body.setup, model: String(body.model).slice(0, 80), maxMinutes: Math.min(15, Number(body.maxMinutes) || 6) });
        return json(t.body, t.status);
    }
    const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
    if (!messages.length) return json({ success: false, error: 'messages is required.' }, 400);
    const total = (body.system || '').length + messages.reduce((a, m) => a + String(m.text || '').length, 0);
    if (total > MAX_CHARS) return json({ success: false, error: 'Request is too long.' }, 413);
    const r = await runAi(env.TRAINING_DB, env, { module: normModule(body.module), user: body.user, system: body.system, messages, json: !!body.json, maxTokens: body.maxTokens });
    return json(r.body, r.status);
}

import { json, requireSession } from '../_utils.js';
import { guardPublicSim } from '../_sim-guard.js';
import { runAi } from '../_ai-gateway.js';

// The AI endpoint for the Portal's own simulators (Call Simulator, Calendaring, Email Replies and the rest).
// Signed-in Portal sessions only (guardPublicSim: site lock, same-origin, per-IP limit). The model call itself, the key pool,
// the US relay and the shared budget all live in the AI gateway (functions/_ai-gateway.js): every call flow draws from the
// same keys and the same daily and per-minute budget, whichever page it comes from.
// Body: { module?, system, messages: [{ role: 'user'|'model', text }], json, maxTokens }. Returns { success, text }.
const MAX_MESSAGES = 60;
const MAX_CHARS = 40000;

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) {
        const blocked = await guardPublicSim(request, env);
        if (blocked) return blocked;
    }
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    // only object entries: a stray null/string in the array must be a 400, not a crash in the length count or the gateway
    const messages = (Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : []).filter(m => m && typeof m === 'object');
    if (!messages.length) return json({ success: false, error: 'messages is required.' }, 400);
    const total = (body.system || '').length + messages.reduce((a, m) => a + String(m.text || '').length, 0);
    if (total > MAX_CHARS) return json({ success: false, error: 'Request is too long.' }, 413);
    const user = auth.ok ? auth.session.username : (request.headers.get('CF-Connecting-IP') || 'anonymous');
    const r = await runAi(env.TRAINING_DB, env, { module: body.module, user, system: body.system, messages, json: !!body.json, maxTokens: body.maxTokens });
    return json(r.body, r.status);
}

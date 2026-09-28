import { json, requireSession } from '../_utils.js';
import { guardPublicSim } from '../_sim-guard.js';

// Shared AI endpoint for the portal's simulators (Call Simulator, Calendaring,
// and the ones that follow). Trainees don't sign in on the portal, so visitors
// without a session go through guardPublicSim (site lock, same-origin only,
// per-IP rate limit) to keep outsiders from spending the Gemini quota. Body: { system, messages: [{ role: 'user'|'model', text }], json, maxTokens }.
// Returns { success, text }.
const MAX_MESSAGES = 60;
const MAX_CHARS = 40000;

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) {
        const blocked = await guardPublicSim(request, env);
        if (blocked) return blocked;
    }
    // The simulators use GEMINI_API_KEY; grading has its own key (GEMINI_API_KEY1, see _utils.js).
    // If the main key is rate-limited (429) or rejected, GEMINI_API_KEY1 takes the request.
    const keys = [env.GEMINI_API_KEY, env.GEMINI_API_KEY1].filter((k, i, a) => k && a.indexOf(k) === i);
    if (!keys.length) return json({ success: false, error: 'GEMINI_API_KEY is not configured on this site.' }, 500);

    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
    if (!messages.length) return json({ success: false, error: 'messages is required.' }, 400);
    const total = (body.system || '').length + messages.reduce((a, m) => a + String(m.text || '').length, 0);
    if (total > MAX_CHARS) return json({ success: false, error: 'Request is too long.' }, 413);

    const payload = {
        contents: messages.map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text || '') }] })),
        generationConfig: {
            maxOutputTokens: Math.min(Math.max(Number(body.maxTokens) || 800, 128), 4096) * 2,
            temperature: body.json ? 0.3 : 0.8
        }
    };
    if (body.json) payload.generationConfig.responseMimeType = 'application/json';
    if (body.system) payload.systemInstruction = { parts: [{ text: String(body.system) }] };

    const models = [env.GEMINI_MODEL || 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'].filter((v, i, a) => a.indexOf(v) === i);
    let last = { status: 502, error: 'No response.' }, limit = null;
    for (const apiKey of keys) {
      let limited = false;
      for (const model of models) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            const cand = (data.candidates || [])[0] || {};
            const text = ((cand.content && cand.content.parts) || []).filter(p => !p.thought).map(p => p.text || '').join('');
            if (text) return json({ success: true, text, model });
            last = { status: 502, error: `Gemini returned no text (${cand.finishReason || 'blocked'}).` };
            continue;
        }
        last = { status: res.status, error: (data.error && data.error.message) || `Gemini error ${res.status}` };
        if (res.status === 429) { limited = true; limit = last; }
        if (res.status === 400 && /API key/i.test(last.error)) break;
        if (![404, 429, 500, 503].includes(res.status)) break;
      }
      const badKey = last.status === 400 && /API key/i.test(last.error);
      if (!(limited || badKey)) break;   // only a rate limit or a rejected key is worth the next key
    }
    if (limit && !(last.status === 400 && /API key/i.test(last.error))) last = limit;
    const friendly = last.status === 429 ? 'The AI service is busy — wait a minute and try again.' : last.error;
    return json({ success: false, error: friendly }, last.status === 429 ? 429 : 502);
}

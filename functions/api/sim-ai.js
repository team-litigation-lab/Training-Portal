import { json, requireSession } from '../_utils.js';
import { guardPublicSim } from '../_sim-guard.js';

// Shared AI endpoint for the portal's simulators (Call Simulator, Calendaring,
// and the ones that follow). Trainees don't sign in on the portal, so visitors
// without a session go through guardPublicSim (site lock, same-origin only,
// per-IP rate limit) to keep outsiders from spending the Gemini quota. Body: { system, messages: [{ role: 'user'|'model', text }], json, maxTokens }.
// Returns { success, text }.
const MAX_MESSAGES = 60;
const MAX_CHARS = 40000;
// Gemini refuses some regions ("User location is not supported", e.g. Hong Kong), and Pages Functions run
// in the data centre nearest the trainee. With AI_RELAY_SECRET set (the same value on the EA/PA Worker),
// the AI calls go through the EA/PA Worker's /api/ai-relay, which runs in the US with its key pool.
const DEFAULT_RELAY_URL = 'https://ea-pa-training.legalsupporthelp.workers.dev/api/ai-relay';

async function viaRelay(env, body, messages) {
    const r = await fetch(env.AI_RELAY_URL || DEFAULT_RELAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Relay-Key': env.AI_RELAY_SECRET },
        body: JSON.stringify({
            feature: body.json ? 'grading' : 'chat',
            system: String(body.system || ''),
            json: !!body.json,
            temperature: body.json ? 0.3 : 0.8,
            max_tokens: Math.min(Math.max(Number(body.maxTokens) || 800, 128), 4096),
            messages: messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: String(m.text || '') }))
        })
    });
    const data = await r.json().catch(() => ({}));
    const text = r.ok && data.content ? data.content.map(c => c.text || '').join('') : '';
    return { ok: r.ok && !!text, status: r.status, text, model: data.model, error: (data.error && (data.error.message || data.error)) || data.detail || '' };
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) {
        const blocked = await guardPublicSim(request, env);
        if (blocked) return blocked;
    }
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
    if (!messages.length) return json({ success: false, error: 'messages is required.' }, 400);
    const total = (body.system || '').length + messages.reduce((a, m) => a + String(m.text || '').length, 0);
    if (total > MAX_CHARS) return json({ success: false, error: 'Request is too long.' }, 413);

    let relayError = '';
    if (env.AI_RELAY_SECRET) {
        try {
            const r = await viaRelay(env, body, messages);
            if (r.ok) return json({ success: true, text: r.text, model: r.model, via: 'relay' });
            if (r.status === 429) return json({ success: false, error: 'AI generation limit reached. Try again in a minute.' }, 429);
            relayError = r.error || `relay error ${r.status}`;
        } catch (e) { relayError = String(e && e.message || e); }
        console.error('sim-ai relay failed, calling Gemini directly:', relayError);
    }

    // Direct to Gemini: every GEMINI_API_KEY / GEMINI_API_KEY1 … GEMINI_API_KEY9 set on this site, starting
    // on a random one so a class spreads over all of them; a rate-limited (429) or rejected key hands over to the next.
    const pool = ['GEMINI_API_KEY', ...Array.from({ length: 9 }, (_, i) => 'GEMINI_API_KEY' + (i + 1))]
        .map(n => env[n]).filter((k, i, a) => k && a.indexOf(k) === i);
    const start = pool.length ? Math.floor(Math.random() * pool.length) : 0;
    const keys = pool.slice(start).concat(pool.slice(0, start));
    if (!keys.length) return json({ success: false, error: relayError ? 'The AI service is unavailable right now. Try again in a minute.' : 'GEMINI_API_KEY is not configured on this site.' }, 500);

    const payload = {
        contents: messages.map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text || '') }] })),
        generationConfig: {
            maxOutputTokens: Math.min(Math.max(Number(body.maxTokens) || 800, 128), 4096) * 2,
            temperature: body.json ? 0.3 : 0.8
        }
    };
    if (body.json) payload.generationConfig.responseMimeType = 'application/json';
    if (body.system) payload.systemInstruction = { parts: [{ text: String(body.system) }] };

    // Free tier: Flash-Lite allows about 500 requests a day and 15 a minute, the Flash models only 20 a day
    // and 5 a minute, so the simulators (high volume) start on Flash-Lite.
    const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
    let last = { status: 502, error: 'No response.' }, limit = null;
    for (const apiKey of keys) {
      let limited = false;
      for (const model of models) {
        // Gemini 3.x: think briefly, so the caller answers in about a second instead of several.
        const p = JSON.parse(JSON.stringify(payload));
        p.generationConfig.thinkingConfig = { thinkingLevel: 'low' };
        const send = (b) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(b)
        });
        let res = await send(p);
        let data = await res.json().catch(() => ({}));
        if (res.status === 400 && /thinking/i.test((data.error && data.error.message) || '')) { delete p.generationConfig.thinkingConfig; res = await send(p); data = await res.json().catch(() => ({})); }
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
    const friendly = last.status === 429 ? 'AI generation limit reached. Try again in a minute.'
        : /location is not supported/i.test(last.error) ? 'The AI caller isn’t available from your region yet — your trainer needs to switch on the US relay (AI_RELAY_SECRET). Try again later.'
        : last.error;
    return json({ success: false, error: friendly }, last.status === 429 ? 429 : 502);
}

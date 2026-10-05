// The Portal's AI gateway: ONE place that holds the Gemini keys and ONE shared budget for every call flow
// (the Portal's own simulators, the CMS, the Standard program and the other programs). Not a routed endpoint
// (the leading _ keeps Pages from mapping a URL to it).
//
//   callers   → functions/api/sim-ai.js        (Portal simulators, signed-in Portal session)
//             → functions/api/ai-gateway.js    (the CMS and the programs' Workers, with AI_GATEWAY_SECRET)
//   this file → keys + models + relay, the usage ledger (D1 TRAINING_DB), and the guardrails
//
// Guardrails (every number can be changed with a Pages variable; the defaults suit the free Gemini tier):
//   AI_MINUTE_CALLS   60      requests per minute across ALL flows (the keys' combined per-minute room)
//   AI_DAILY_CALLS    4000    requests per day across all flows
//   AI_DAILY_TOKENS   3000000 tokens per day across all flows
//   AI_MODULE_SHARE   0.5     the most any ONE flow may take of the day's calls and tokens, so no flow starves the rest
//                             (it applies once the day is past 10% used: a quiet day isn't held back)
//   AI_USER_10MIN     150     requests per person per 10 minutes (one practice call is about 15 to 30)
// Whoever is refused gets a 429 with a plain reason and the page retries or tells the trainee to wait.
//
// The ledger is three small tables created on first use: ai_usage_day (flow, day), ai_usage_user (person, day),
// ai_usage_minute (the minute). Tokens are the ones Gemini reports (usageMetadata), else about 4 characters each.

export const MODULES = ['standard', 'cms', 'reception', 'intake', 'calendaring', 'ea-pa', 'pd', 'medsum', 'portal'];
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
export const normModule = (m) => { const k = clean(m, 24).toLowerCase(); return MODULES.includes(k) ? k : 'portal'; };

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
export function limits(env) {
    return {
        minuteCalls: num(env.AI_MINUTE_CALLS, 60),
        dailyCalls: num(env.AI_DAILY_CALLS, 4000),
        dailyTokens: num(env.AI_DAILY_TOKENS, 3000000),
        moduleShare: Math.min(1, num(env.AI_MODULE_SHARE, 0.5)),
        user10: num(env.AI_USER_10MIN, 150)
    };
}

const day = () => new Date().toISOString().slice(0, 10);
const minuteBucket = () => Math.floor(Date.now() / 60000);
const tenMinBucket = () => Math.floor(Date.now() / 600000);

export async function ensureAiTables(db) {
    await db.batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS ai_usage_day (day TEXT NOT NULL, module TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0, refused INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, module))`),
        db.prepare(`CREATE TABLE IF NOT EXISTS ai_usage_user (bucket INTEGER NOT NULL, user TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (bucket, user))`),
        db.prepare(`CREATE TABLE IF NOT EXISTS ai_usage_minute (bucket INTEGER NOT NULL PRIMARY KEY, calls INTEGER NOT NULL DEFAULT 0)`)
    ]);
}

// Is this request allowed? → { ok: true } or { ok: false, reason, scope }. Counts the request when allowed.
export async function admit(db, env, { module, user }) {
    const L = limits(env), d = day();
    try {
        await ensureAiTables(db);
        const rows = (await db.prepare(`SELECT module, calls, tokens FROM ai_usage_day WHERE day = ?`).bind(d).all()).results || [];
        const total = rows.reduce((a, r) => ({ calls: a.calls + r.calls, tokens: a.tokens + r.tokens }), { calls: 0, tokens: 0 });
        const mine = rows.find(r => r.module === module) || { calls: 0, tokens: 0 };
        if (total.calls >= L.dailyCalls || total.tokens >= L.dailyTokens) return { ok: false, scope: 'daily', reason: 'The shared AI budget for today is used up. It resets tomorrow; ask an admin if you need more now.' };
        // one flow may not take more than its share of the day, once the day is well under way
        const used = Math.max(total.calls / L.dailyCalls, total.tokens / L.dailyTokens);
        if (used >= 0.1 && (mine.calls / Math.max(1, total.calls) > L.moduleShare || mine.tokens / Math.max(1, total.tokens) > L.moduleShare) && rows.length > 1)
            return { ok: false, scope: 'module', reason: 'This call flow has used its share of today’s shared AI budget so the others keep theirs. Try again a little later.' };
        const mb = minuteBucket();
        const m = await db.prepare(`SELECT calls FROM ai_usage_minute WHERE bucket = ?`).bind(mb).first();
        if (m && m.calls >= L.minuteCalls) return { ok: false, scope: 'minute', reason: 'The AI is busy right now. Wait a few seconds and try again.' };
        const ub = tenMinBucket(), who = clean(user, 80) || 'anonymous';
        const u = await db.prepare(`SELECT calls FROM ai_usage_user WHERE bucket = ? AND user = ?`).bind(ub, who).first();
        if (u && u.calls >= L.user10) return { ok: false, scope: 'user', reason: 'You have made a lot of AI requests in a short time. Wait a few minutes and try again.' };
        await db.batch([
            db.prepare(`INSERT INTO ai_usage_day (day, module, calls) VALUES (?, ?, 1) ON CONFLICT(day, module) DO UPDATE SET calls = calls + 1`).bind(d, module),
            db.prepare(`INSERT INTO ai_usage_minute (bucket, calls) VALUES (?, 1) ON CONFLICT(bucket) DO UPDATE SET calls = calls + 1`).bind(mb),
            db.prepare(`INSERT INTO ai_usage_user (bucket, user, calls) VALUES (?, ?, 1) ON CONFLICT(bucket, user) DO UPDATE SET calls = calls + 1`).bind(ub, who)
        ]);
        if (Math.random() < 0.03) await db.batch([
            db.prepare(`DELETE FROM ai_usage_minute WHERE bucket < ?`).bind(mb - 5),
            db.prepare(`DELETE FROM ai_usage_user WHERE bucket < ?`).bind(ub - 2),
            db.prepare(`DELETE FROM ai_usage_day WHERE day < date(?, '-60 days')`).bind(d)
        ]);
        return { ok: true };
    } catch (e) {
        console.error('ai-gateway: budget counter failed', e);   // never take the calls down because of the counter
        return { ok: true };
    }
}

export async function record(db, { module, tokens = 0, error = false, refused = false }) {
    try {
        await ensureAiTables(db);
        await db.prepare(`INSERT INTO ai_usage_day (day, module, tokens, errors, refused) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(day, module) DO UPDATE SET tokens = tokens + excluded.tokens, errors = errors + excluded.errors, refused = refused + excluded.refused`)
            .bind(day(), module, Math.max(0, Math.round(tokens)), error ? 1 : 0, refused ? 1 : 0).run();
    } catch (e) { console.error('ai-gateway: usage record failed', e); }
}

export async function usageSummary(db, env) {
    const L = limits(env), d = day();
    await ensureAiTables(db);
    const today = (await db.prepare(`SELECT module, calls, tokens, errors, refused FROM ai_usage_day WHERE day = ? ORDER BY calls DESC`).bind(d).all()).results || [];
    const week = (await db.prepare(`SELECT day, SUM(calls) AS calls, SUM(tokens) AS tokens FROM ai_usage_day WHERE day >= date(?, '-6 days') GROUP BY day ORDER BY day DESC`).bind(d).all()).results || [];
    const total = today.reduce((a, r) => ({ calls: a.calls + r.calls, tokens: a.tokens + r.tokens }), { calls: 0, tokens: 0 });
    return { day: d, limits: L, total, today, week, keys: keyNames(env).length };
}

/* ---------------------------------------------------------------- the keys */
export const keyNames = (env) => Object.keys(env || {}).filter(n => /^GEMINI_API_KEY\d*$/.test(n) && String(env[n] || '').trim()).sort()
    .filter((n, i, a) => a.findIndex(m => String(env[m]).trim() === String(env[n]).trim()) === i);

const rest = new Map();   // "<key name>" → resting until (ms): a key that hit its limit sits out a minute (an hour for a daily limit)
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
let turn = Math.floor(Math.random() * 1000);

async function viaRelay(env, { system, messages, json, maxTokens }) {
    const r = await fetch(env.AI_RELAY_URL || 'https://ea-pa-training.legalsupporthelp.workers.dev/api/ai-relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Relay-Key': env.AI_RELAY_SECRET },
        body: JSON.stringify({
            feature: json ? 'grading' : 'chat', system: String(system || ''), json: !!json, temperature: json ? 0.3 : 0.8,
            max_tokens: Math.min(Math.max(Number(maxTokens) || 800, 128), 4096),
            messages: messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: String(m.text || '') }))
        })
    });
    const data = await r.json().catch(() => ({}));
    const text = r.ok && data.content ? data.content.map(c => c.text || '').join('') : '';
    const u = data.usage || {};
    return { ok: r.ok && !!text, status: r.status, text, model: data.model, tokens: (u.input_tokens || 0) + (u.output_tokens || 0), error: (data.error && (data.error.message || data.error)) || data.detail || '' };
}

// One model call through the shared keys: → { ok, text, model, tokens, status, error }
export async function generate(env, { system, messages, json, maxTokens }) {
    const chars = String(system || '').length + messages.reduce((a, m) => a + String(m.text || '').length, 0);
    let relayError = '';
    if (env.AI_RELAY_SECRET) {
        try {
            const r = await viaRelay(env, { system, messages, json, maxTokens });
            if (r.ok) return { ok: true, text: r.text, model: r.model, tokens: r.tokens || Math.ceil((chars + r.text.length) / 4), via: 'relay' };
            if (r.status === 429) return { ok: false, status: 429, error: 'AI generation limit reached. Try again in a minute.', tokens: 0 };
            relayError = r.error || `relay error ${r.status}`;
        } catch (e) { relayError = String(e && e.message || e); }
        console.error('ai-gateway: relay failed, calling Gemini directly:', relayError);
    }
    const names = keyNames(env), now = Date.now();
    const awake = names.filter(n => (rest.get(n) || 0) <= now);
    const order = (awake.length ? awake : names);
    const start = order.length ? turn++ % order.length : 0;
    const keys = order.slice(start).concat(order.slice(0, start)).map(n => ({ name: n, key: String(env[n]).trim() }));
    if (!keys.length) return { ok: false, status: 500, tokens: 0, error: relayError ? 'The AI service is unavailable right now. Try again in a minute.' : 'No Gemini key is set on the Portal (GEMINI_API_KEY).' };

    const payload = {
        contents: messages.map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text || '') }] })),
        generationConfig: { maxOutputTokens: Math.min(Math.max(Number(maxTokens) || 800, 128), 4096) * 2, temperature: json ? 0.3 : 0.8 }
    };
    if (json) payload.generationConfig.responseMimeType = 'application/json';
    if (system) payload.systemInstruction = { parts: [{ text: String(system) }] };

    let last = { status: 502, error: 'No response.' }, limit = null;
    for (const { name, key } of keys) {
        let limited = false;
        for (const model of MODELS) {
            const p = JSON.parse(JSON.stringify(payload));
            p.generationConfig.thinkingConfig = { thinkingLevel: 'low' };
            const send = (b) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(b) });
            let res = await send(p), data = await res.json().catch(() => ({}));
            if (res.status === 400 && /thinking/i.test((data.error && data.error.message) || '')) { delete p.generationConfig.thinkingConfig; res = await send(p); data = await res.json().catch(() => ({})); }
            if (res.ok) {
                const cand = (data.candidates || [])[0] || {};
                const text = ((cand.content && cand.content.parts) || []).filter(x => !x.thought).map(x => x.text || '').join('');
                const used = data.usageMetadata && data.usageMetadata.totalTokenCount;
                if (text) return { ok: true, text, model, tokens: used || Math.ceil((chars + text.length) / 4) };
                last = { status: 502, error: `Gemini returned no text (${cand.finishReason || 'blocked'}).` };
                continue;
            }
            last = { status: res.status, error: (data.error && data.error.message) || `Gemini error ${res.status}` };
            if (res.status === 429) { limited = true; limit = last; rest.set(name, Date.now() + (/per.?day|daily/i.test(last.error) ? 3600000 : 60000)); }
            if (res.status === 400 && /API key/i.test(last.error)) { rest.set(name, Date.now() + 600000); break; }
            if (![404, 429, 500, 503].includes(res.status)) break;
        }
        const badKey = last.status === 400 && /API key/i.test(last.error);
        if (!(limited || badKey)) break;
    }
    if (limit && !(last.status === 400 && /API key/i.test(last.error))) last = limit;
    const friendly = last.status === 429 ? 'AI generation limit reached. Try again in a minute.'
        : /location is not supported/i.test(last.error) ? 'The AI caller isn’t available from this region yet: the US relay (AI_RELAY_SECRET) needs switching on.'
        : last.error;
    return { ok: false, status: last.status === 429 ? 429 : 502, error: friendly, tokens: 0 };
}

// The whole path for one request: budget → model → ledger. → { status, body }
export async function runAi(db, env, { module, user, system, messages, json, maxTokens }) {
    module = normModule(module);
    const gate = await admit(db, env, { module, user });
    if (!gate.ok) {
        await record(db, { module, refused: true });
        return { status: 429, body: { success: false, error: gate.reason, scope: gate.scope } };
    }
    const r = await generate(env, { system, messages, json, maxTokens });
    await record(db, { module, tokens: r.tokens || 0, error: !r.ok });
    return r.ok ? { status: 200, body: { success: true, text: r.text, model: r.model, tokens: r.tokens, module } } : { status: r.status || 502, body: { success: false, error: r.error } };
}

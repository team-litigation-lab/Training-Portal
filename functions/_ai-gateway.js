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
//   AI_LIVE_COST      25      what one live voice call counts for (requests; about 400 tokens each), since its audio goes straight to Google
//   AI_REVIEW_RESERVE 0.1     the last share of the day's calls and tokens kept for the AI reviews and grading (json requests),
//                             so practice chats can't use it up; a review isn't held back by one flow's share either
// Whoever is refused gets a 429 with a plain reason and the page retries or tells the trainee to wait.
//
// The keys (GEMINI_API_KEY, GEMINI_API_KEY1, …): each request starts on the next key in turn, and each model is tried on
// every key before the next model, as the CMS's practice calls do (functions/_ai.js there). A key that hits a rate limit
// rests for that model (a minute; a day's quota, an hour) and the next key answers. A key that is out of credits, has
// billing off, or is rejected or blocked rests on every model (an hour; a rejected key, 10 minutes) and the next key
// answers. A busy key (5xx) or one that can't be reached hands over too. Only when every key has failed does the request fail.
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
        user10: num(env.AI_USER_10MIN, 150),
        liveCost: num(env.AI_LIVE_COST, 25),
        reviewReserve: Math.min(0.5, Number.isFinite(Number(env.AI_REVIEW_RESERVE)) && env.AI_REVIEW_RESERVE !== '' && env.AI_REVIEW_RESERVE != null ? Math.max(0, Number(env.AI_REVIEW_RESERVE)) : 0.1)
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
// review: an AI review or grading (a json request): the day's reserve is open to it, and one flow's share doesn't hold it back.
export async function admit(db, env, { module, user, weight = 1, review = false }) {
    const L = limits(env), d = day();
    try {
        await ensureAiTables(db);
        const rows = (await db.prepare(`SELECT module, calls, tokens FROM ai_usage_day WHERE day = ?`).bind(d).all()).results || [];
        const total = rows.reduce((a, r) => ({ calls: a.calls + r.calls, tokens: a.tokens + r.tokens }), { calls: 0, tokens: 0 });
        const mine = rows.find(r => r.module === module) || { calls: 0, tokens: 0 };
        const open = review ? 1 : 1 - L.reviewReserve;   // (the reserve is for the reviews)
        if (total.calls + weight > L.dailyCalls * open || total.tokens >= L.dailyTokens * open) return { ok: false, scope: 'daily', reason: 'The shared AI budget for today is used up. It resets tomorrow; ask an admin if you need more now.' };
        // one flow may not take more than its share of the day, once the day is well under way (a review always may)
        const used = Math.max(total.calls / L.dailyCalls, total.tokens / L.dailyTokens);
        if (!review && used >= 0.1 && (mine.calls / Math.max(1, total.calls) > L.moduleShare || mine.tokens / Math.max(1, total.tokens) > L.moduleShare) && rows.length > 1)
            return { ok: false, scope: 'module', reason: 'This call flow has used its share of today’s shared AI budget so the others keep theirs. Try again a little later.' };
        const mb = minuteBucket();
        const m = await db.prepare(`SELECT calls FROM ai_usage_minute WHERE bucket = ?`).bind(mb).first();
        if (m && m.calls + Math.min(weight, 5) > L.minuteCalls) return { ok: false, scope: 'minute', reason: 'The AI is busy right now. Wait a few seconds and try again.' };
        const ub = tenMinBucket(), who = clean(user, 80) || 'anonymous';
        const u = await db.prepare(`SELECT calls FROM ai_usage_user WHERE bucket = ? AND user = ?`).bind(ub, who).first();
        if (u && u.calls + Math.min(weight, 5) > L.user10) return { ok: false, scope: 'user', reason: 'You have made a lot of AI requests in a short time. Wait a few minutes and try again.' };
        await db.batch([
            db.prepare(`INSERT INTO ai_usage_day (day, module, calls) VALUES (?, ?, ?) ON CONFLICT(day, module) DO UPDATE SET calls = calls + excluded.calls`).bind(d, module, weight),
            db.prepare(`INSERT INTO ai_usage_minute (bucket, calls) VALUES (?, ?) ON CONFLICT(bucket) DO UPDATE SET calls = calls + excluded.calls`).bind(mb, Math.min(weight, 5)),
            db.prepare(`INSERT INTO ai_usage_user (bucket, user, calls) VALUES (?, ?, ?) ON CONFLICT(bucket, user) DO UPDATE SET calls = calls + excluded.calls`).bind(ub, who, Math.min(weight, 5))
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

const rest = new Map();   // "<key name>|<model>" (or "|*": every model) → resting until (ms)
const resting = (name, model) => Math.max(rest.get(name + '|*') || 0, rest.get(name + '|' + model) || 0) > Date.now();
const restKey = (name, model, ms) => rest.set(name + '|' + model, Date.now() + ms);
// What a refusal says about the key: out of credits or billing off (it rests an hour: another key may have them), rejected or
// blocked (10 minutes), or only a rate limit (a minute; a day's quota, an hour).
// (Google's ordinary rate-limit message says "check your plan and billing details": that alone is only a rate limit.)
const NO_CREDITS = /credit|prepa(?:y|id)|payment|insufficient|spend(?:ing)?[ _-]?(?:cap|limit)|free tier|enable billing|billing (?:account|is (?:not |in)?active|is disabled|disabled|not enabled)/i;
const BAD_KEY = /API[ _]?key|leaked|suspended|permission|denied|not been used|is disabled|unauthori[sz]ed|unauthenticated/i;
const restFor = (msg) => /per.?day|daily|PerDay/i.test(msg) ? 3600000 : 60000;
const errOf = (d) => String((d && d.error && (d.error.message || d.error.status)) || '');
export const _resetKeys = () => rest.clear();   // (the checks)
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
    const names = keyNames(env);
    let relayError = '';
    if (env.AI_RELAY_SECRET) {
        try {
            const r = await viaRelay(env, { system, messages, json, maxTokens });
            if (r.ok) return { ok: true, text: r.text, model: r.model, tokens: r.tokens || Math.ceil((chars + r.text.length) / 4), via: 'relay' };
            if (r.status === 429 && !names.length) return { ok: false, status: 429, error: 'AI generation limit reached. Try again in a minute.', tokens: 0 };
            relayError = r.status === 429 ? 'the relay is at its limit' : (r.error || `relay error ${r.status}`);   // (the keys here take over)
        } catch (e) { relayError = String(e && e.message || e); }
        console.error('ai-gateway: relay failed, calling Gemini directly:', relayError);
    }
    if (!names.length) return { ok: false, status: 500, tokens: 0, error: relayError ? 'The AI service is unavailable right now. Try again in a minute.' : 'No Gemini key is set on the Portal (GEMINI_API_KEY).' };
    const start = turn++ % names.length, ring = names.slice(start).concat(names.slice(0, start));
    // every key resting on every model: try them all anyway (a key may have been topped up or its minute may be over)
    const everyResting = MODELS.every(m => ring.every(n => resting(n, m)));

    const payload = {
        contents: messages.map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text || '') }] })),
        generationConfig: { maxOutputTokens: Math.min(Math.max(Number(maxTokens) || 800, 128), 4096) * 2, temperature: json ? 0.3 : 0.8 }
    };
    if (json) payload.generationConfig.responseMimeType = 'application/json';
    if (system) payload.systemInstruction = { parts: [{ text: String(system) }] };

    let last = null, limit = null, keyTrouble = null, other = null;   // other: a failure that isn't the key's (busy, no text, a bad request)
    // Each model is tried on every key before the next model, so the preferred model's quota is used across all keys first.
    for (const model of MODELS) {
        for (const name of ring.filter(n => everyResting || !resting(n, model))) {
            const p = JSON.parse(JSON.stringify(payload));
            p.generationConfig.thinkingConfig = { thinkingLevel: 'low' };
            const send = (b) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': String(env[name]).trim() }, body: JSON.stringify(b) });
            let res, data;
            try {
                res = await send(p); data = await res.json().catch(() => ({}));
                if (res.status === 400 && /thinking/i.test(errOf(data))) { delete p.generationConfig.thinkingConfig; res = await send(p); data = await res.json().catch(() => ({})); }
            } catch (e) { last = other = { status: 502, error: 'Gemini unreachable: ' + (e && e.message || e) }; continue; }   // next key
            if (res.ok) {
                const cand = (data.candidates || [])[0] || {};
                const text = ((cand.content && cand.content.parts) || []).filter(x => !x.thought).map(x => x.text || '').join('');
                const used = data.usageMetadata && data.usageMetadata.totalTokenCount;
                if (text) return { ok: true, text, model, tokens: used || Math.ceil((chars + text.length) / 4) };
                last = other = { status: 502, error: `Gemini returned no text (${cand.finishReason || 'blocked'}).` };
                break;   // the same request won't do better on another key: the next model
            }
            const msg = errOf(data) || `Gemini error ${res.status}`;
            last = { status: res.status, error: msg };
            if (res.status === 429 && !NO_CREDITS.test(msg)) { limit = last; restKey(name, model, restFor(msg)); continue; }   // a rate limit: the next key
            if ([401, 402, 403, 429].includes(res.status) || (res.status === 400 && (NO_CREDITS.test(msg) || BAD_KEY.test(msg)))) {
                const credits = res.status === 402 || NO_CREDITS.test(msg);   // out of credits or billing off: another key may have them
                restKey(name, '*', credits ? 3600000 : 600000);
                keyTrouble = { status: 502, credits, error: msg };
                console.error(`ai-gateway: ${name} ${credits ? 'is out of credits or has billing off' : 'was rejected'}; the next key takes over:`, msg);
                continue;
            }
            other = last;
            if (res.status === 404) break;          // the model isn't there: the next model
            if (res.status >= 500) continue;        // busy: the next key
            break;                                  // anything else (a region Gemini refuses, a bad request) won't improve on another key
        }
        if (last && last.status === 400 && !NO_CREDITS.test(last.error) && !BAD_KEY.test(last.error)) break;
    }
    const out = limit || other || keyTrouble || { status: 429, error: 'every key is resting' };
    const friendly = out.status === 429 ? 'AI generation limit reached. Try again in a minute.'
        : out === keyTrouble ? (keyTrouble.credits ? 'Every Gemini key on the Portal is out of credits or has billing off. Add a key with billing on (a GEMINI_API_KEY variable), or top one up.' : 'Every Gemini key on the Portal was rejected. Check the GEMINI_API_KEY variables.') + ' (' + keyTrouble.error.slice(0, 200) + ')'
        : /location is not supported/i.test(out.error) ? 'The AI caller isn’t available from this region yet: the US relay (AI_RELAY_SECRET) needs switching on.'
        : out.error;
    return { ok: false, status: out.status === 429 ? 429 : 502, error: friendly, tokens: 0 };
}

// The whole path for one request: budget → model → ledger. → { status, body }
export async function runAi(db, env, { module, user, system, messages, json, maxTokens }) {
    module = normModule(module);
    const gate = await admit(db, env, { module, user, review: !!json });
    if (!gate.ok) {
        await record(db, { module, refused: true });
        return { status: 429, body: { success: false, error: gate.reason, scope: gate.scope } };
    }
    const r = await generate(env, { system, messages, json, maxTokens });
    await record(db, { module, tokens: r.tokens || 0, error: !r.ok });
    return r.ok ? { status: 200, body: { success: true, text: r.text, model: r.model, tokens: r.tokens, module } } : { status: r.status || 502, body: { success: false, error: r.error } };
}

// A live voice call (Gemini Live): the caller builds the session setup (its script and voice), this mints the single-use token
// with the shared keys and counts the call against the shared budget (AI_LIVE_COST). The browser then talks to Google directly.
export async function runLiveToken(db, env, { module, user, setup, model, maxMinutes = 6 }) {
    module = normModule(module);
    const L = limits(env);
    const gate = await admit(db, env, { module, user, weight: L.liveCost });
    if (!gate.ok) { await record(db, { module, refused: true }); return { status: 429, body: { success: false, error: gate.reason, scope: gate.scope } }; }
    const names = keyNames(env), now = Date.now();
    const order = names.filter(n => !resting(n, 'live')), pool = order.length ? order : names;
    if (!pool.length) { await record(db, { module, error: true }); return { status: 500, body: { success: false, error: 'No Gemini key is set on the Portal (GEMINI_API_KEY).' } }; }
    const start = turn++ % pool.length;
    let last = { status: 502, error: 'No response.' };
    for (const name of pool.slice(start).concat(pool.slice(0, start))) {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': String(env[name]).trim() },
            body: JSON.stringify({ uses: 1, expireTime: new Date(now + (maxMinutes + 2) * 60000).toISOString(), newSessionExpireTime: new Date(now + 2 * 60000).toISOString(),
                bidiGenerateContentSetup: Object.assign({}, setup, { model: 'models/' + String(model).replace(/^models\//, '') }) })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.name) { await record(db, { module, tokens: L.liveCost * 400 }); return { status: 200, body: { success: true, token: data.name, module } }; }
        last = { status: res.status, error: (data.error && data.error.message) || `Gemini error ${res.status}` };
        if (res.status === 429 && !NO_CREDITS.test(last.error)) restKey(name, 'live', 60000);   // a rate limit: the next key
        else if ([401, 402, 403, 429].includes(res.status) || (res.status === 400 && (NO_CREDITS.test(last.error) || BAD_KEY.test(last.error)))) restKey(name, '*', res.status === 402 || NO_CREDITS.test(last.error) ? 3600000 : 600000);
        else if (res.status < 500) break;   // (busy: the next key)
    }
    await record(db, { module, error: true });
    return { status: last.status === 429 ? 429 : 502, body: { success: false, error: last.status === 429 ? 'The line is busy (all keys are at their limit). Try again in a minute.' : last.error } };
}

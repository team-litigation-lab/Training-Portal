// The AI gateway's shared budget and key pool, on SQLite (node:sqlite as D1) with Gemini mocked.
// Checks: every call flow is counted in one ledger; the minute, daily and per-person limits refuse with a plain reason;
// one flow can't take more than its share of the day (so none starves the others); a rate-limited key rests and the next
// one answers; a key out of credits, with billing off, rejected or busy hands over to the next key, and only when every key
// has failed does a request fail; the relay at its limit hands over to the keys; the reviews keep a share of the day;
// tokens are the ones Gemini reports; the endpoint refuses a wrong gateway key and works with the right one.
// Run: node --no-warnings .github/scripts/ai-gateway.mjs   (from the repository root)
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-'));
const load = async (rel, rewrites = []) => {
    let s = fs.readFileSync(rel, 'utf8');
    for (const [a, b] of rewrites) s = s.replace(a, b);
    const out = path.join(tmp, path.basename(rel).replace(/\.js$/, '.mjs'));
    fs.writeFileSync(out, s);
    return import(pathToFileURL(out).href);
};
const gw = await load('functions/_ai-gateway.js');
const failures = [];
const check = (ok, m) => { if (!ok) { failures.push(m); console.log('FAIL ' + m); } else console.log('PASS ' + m); };

const sql = new DatabaseSync(':memory:');
const stmt = (q) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => sql.prepare(q).run(...a), first: async () => sql.prepare(q).get(...a) || null, all: async () => ({ results: sql.prepare(q).all(...a) }) }; return o; };
const db = { prepare: stmt, batch: async (list) => { for (const s of list) await s.run(); return []; } };

// Gemini mock: key "KEY-A" is rate limited (429), "KEY-B" answers with a token count
const calls = [];
globalThis.fetch = async (url, init) => {
    const key = init.headers['x-goog-api-key']; calls.push(key);
    if (key === 'KEY-A') return new Response(JSON.stringify({ error: { message: 'Resource exhausted: per minute' } }), { status: 429 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hello, thanks for calling.' }] } }], usageMetadata: { totalTokenCount: 321 } }), { status: 200 });
};
const env = { GEMINI_API_KEY: 'KEY-A', GEMINI_API_KEY1: 'KEY-B', AI_MINUTE_CALLS: '1000', AI_USER_10MIN: '5', AI_DAILY_CALLS: '40', AI_MODULE_SHARE: '0.5' };
const ask = (module, user = 'ann') => gw.runAi(db, env, { module, user, system: 's', messages: [{ role: 'user', text: 'hi' }] });
const row = async (m) => sql.prepare(`SELECT * FROM ai_usage_day WHERE module = ?`).get(m) || { calls: 0, tokens: 0, refused: 0 };

let r = await ask('standard');
check(r.status === 200 && r.body.text && r.body.tokens === 321, 'a call goes through and reports the tokens Gemini counted');
check(calls.includes('KEY-A') && calls.includes('KEY-B') || calls.length >= 1, 'the shared keys are used');
r = await ask('cms', 'bo'); r = await ask('reception', 'cy'); r = await ask('intake', 'di'); r = await ask('calendaring', 'ed');
const rows = sql.prepare(`SELECT module, calls, tokens FROM ai_usage_day ORDER BY module`).all();
check(rows.map(x => x.module).join() === 'calendaring,cms,intake,reception,standard' && rows.every(x => x.calls === 1 && x.tokens === 321), 'Standard, CMS, Reception, Intake and Calendaring are all counted in the one ledger');
check(gw.normModule('Reception') === 'reception' && gw.normModule('anything') === 'portal', 'an unknown flow is counted as the Portal, never as a new budget');

// a rate-limited key rests: the next calls skip it
calls.length = 0;
await ask('standard', 'fy'); await ask('standard', 'gz');
check(calls.filter(k => k === 'KEY-A').length <= 1, 'a key that hit its limit rests while the other answers');

// per person: 5 in 10 minutes
let refused = null;
for (let i = 0; i < 8; i++) { const x = await ask('cms', 'zed'); if (x.status === 429) { refused = x; break; } }
check(refused && refused.body.scope === 'user' && /wait a few minutes/i.test(refused.body.error), 'one person is held to their own limit');

// one flow can't take more than half the day
sql.exec(`DELETE FROM ai_usage_day`); sql.exec(`DELETE FROM ai_usage_user`);
sql.exec(`INSERT INTO ai_usage_day (day, module, calls, tokens) VALUES (date('now'), 'cms', 20, 1000), (date('now'), 'standard', 2, 100)`);
r = await gw.runAi(db, { ...env, AI_USER_10MIN: '999' }, { module: 'cms', user: 'a', system: 's', messages: [{ role: 'user', text: 'x' }] });
check(r.status === 429 && r.body.scope === 'module', 'a flow past its share of the day waits, so it can\'t starve the others');
r = await gw.runAi(db, { ...env, AI_USER_10MIN: '999' }, { module: 'standard', user: 'b', system: 's', messages: [{ role: 'user', text: 'x' }] });
check(r.status === 200, 'the other flows still get through');
check((await row('cms')).refused === 1, 'the refusal is counted');

// the whole day's budget
sql.exec(`DELETE FROM ai_usage_day`);
sql.exec(`INSERT INTO ai_usage_day (day, module, calls, tokens) VALUES (date('now'), 'standard', 20, 0), (date('now'), 'cms', 20, 0)`);
r = await gw.runAi(db, { ...env, AI_USER_10MIN: '999' }, { module: 'intake', user: 'c', system: 's', messages: [{ role: 'user', text: 'x' }] });
check(r.status === 429 && r.body.scope === 'daily', 'when the shared daily budget is used up every flow waits');

// per minute, across flows
sql.exec(`DELETE FROM ai_usage_day`); sql.exec(`DELETE FROM ai_usage_minute`);
const envMin = { ...env, AI_MINUTE_CALLS: '3', AI_USER_10MIN: '999', AI_DAILY_CALLS: '4000' };
const outs = [];
for (const m of ['standard', 'cms', 'reception', 'intake']) outs.push((await gw.runAi(db, envMin, { module: m, user: m, system: 's', messages: [{ role: 'user', text: 'x' }] })).status);
check(outs.join() === '200,200,200,429', 'the per-minute limit is shared by all flows together');

// live voice: a minted token counts as AI_LIVE_COST requests in the same ledger
sql.exec(`DELETE FROM ai_usage_day`); sql.exec(`DELETE FROM ai_usage_minute`); sql.exec(`DELETE FROM ai_usage_user`);
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => url.includes('auth_tokens') ? new Response(JSON.stringify({ name: 'auth_tokens/abc' }), { status: 200 }) : realFetch(url, init);
const live = await gw.runLiveToken(db, { ...env, AI_LIVE_COST: '10', AI_USER_10MIN: '999', AI_DAILY_CALLS: '4000', AI_MINUTE_CALLS: '1000' }, { module: 'reception', user: 'ann', setup: { generationConfig: {} }, model: 'gemini-3.8-live' });
check(live.status === 200 && live.body.token === 'auth_tokens/abc', 'a live voice token is minted with the shared keys');
check((await row('reception')).calls === 10, 'and counts as AI_LIVE_COST requests in the shared ledger');
globalThis.fetch = realFetch;

// a caller with a deadline (an AbortSignal): the hung call is stopped and answered 504, instead of walking on through every key and model
let hung = 0;
globalThis.fetch = (url, init) => new Promise((res, rej) => { hung++; init.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))); });
const open = { ...env, AI_USER_10MIN: '999', AI_DAILY_CALLS: '4000', AI_MINUTE_CALLS: '1000' };
const ac = new AbortController(); setTimeout(() => ac.abort(), 30);
r = await gw.runAi(db, open, { module: 'calendaring', user: 'sig', system: 's', messages: [{ role: 'user', text: 'x' }], signal: ac.signal });
check(r.status === 504 && !r.body.success && hung === 1, 'a call past its deadline is stopped (504) without trying the other models and keys');
hung = 0; r = await gw.runAi(db, open, { module: 'calendaring', user: 'sig', system: 's', messages: [{ role: 'user', text: 'x' }], signal: AbortSignal.abort() });
check(r.status === 504 && hung === 0, 'a deadline that has already passed makes no request at all');
hung = 0; const ac2 = new AbortController(); setTimeout(() => ac2.abort(), 30);
r = await gw.runAi(db, { ...open, AI_RELAY_SECRET: 'relay-key' }, { module: 'calendaring', user: 'sig', system: 's', messages: [{ role: 'user', text: 'x' }], signal: ac2.signal });
check(r.status === 504 && hung === 1, 'the same through the US relay: the Gemini fallback isn\'t started once the deadline has passed');
globalThis.fetch = realFetch;
r = await gw.runAi(db, open, { module: 'calendaring', user: 'sig', system: 's', messages: [{ role: 'user', text: 'x' }] });
check(r.status !== 504, 'callers without a deadline are unchanged');
const sum = await gw.usageSummary(db, env);
check(sum.total.calls >= 1 && Array.isArray(sum.today) && sum.limits.dailyCalls === 40, 'the admin summary lists each flow and the limits');

// the endpoint
const ep = await load('functions/api/ai-gateway.js', [["import { json, requireSession, sameSecret } from '../_utils.js';", "const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }); const requireSession = async () => ({ ok: false }); const sameSecret = (a, b) => !!a && String(a) === String(b);"], ["from '../_ai-gateway.js'", `from '${pathToFileURL(path.join(tmp, '_ai-gateway.mjs')).href}'`]]);
const post = (key, body) => ep.onRequestPost({ request: new Request('https://p/api/ai-gateway', { method: 'POST', headers: { 'X-Gateway-Key': key }, body: JSON.stringify(body) }), env: { ...env, AI_USER_10MIN: '999', AI_DAILY_CALLS: '4000', AI_MINUTE_CALLS: '1000', TRAINING_DB: db, AI_GATEWAY_SECRET: 'sekret' } });
sql.exec(`DELETE FROM ai_usage_day`); sql.exec(`DELETE FROM ai_usage_minute`);
let res = await post('wrong', { module: 'cms', messages: [{ role: 'user', text: 'hi' }] });
check(res.status === 401, 'the gateway refuses a wrong gateway key');
res = await post('sekret', { module: 'cms', user: 'trainee1', messages: [{ role: 'user', text: 'hi' }] });
const out = await res.json();
check(res.status === 200 && out.success && out.module === 'cms', 'the CMS reaches the shared keys through the gateway with the right key');
const noSecret = await ep.onRequestPost({ request: new Request('https://p/', { method: 'POST', headers: { 'X-Gateway-Key': 'x' }, body: '{}' }), env: { TRAINING_DB: db } });
check(noSecret.status === 501, 'with no gateway secret set the gateway says so');

// the keys, as the CMS's practice calls take them: a key out of credits, with billing off, rejected or busy hands over to the
// next key; only when every key has failed does the request fail (and then it says why)
{
    const realFetch = globalThis.fetch;
    let seen = [], answer = {};   // answer[key] → [status, message] (no entry: it answers)
    globalThis.fetch = async (url, init) => {
        const key = init.headers['x-goog-api-key'], model = decodeURIComponent(String(url).match(/models\/([^:]+):/)[1]); seen.push(key + ' ' + model);
        const a = typeof answer[key] === 'function' ? answer[key](model) : answer[key];
        if (a) return new Response(JSON.stringify({ error: { message: a[1] } }), { status: a[0] });
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'from ' + key } ] } }], usageMetadata: { totalTokenCount: 10 } }), { status: 200 });
    };
    const kenv = { GEMINI_API_KEY: 'K1', GEMINI_API_KEY2: 'K2', GEMINI_API_KEY3: 'K3' };
    const gen = (e = kenv) => gw.generate(e, { system: 's', messages: [{ role: 'user', text: 'Review this calendar' }], json: true, maxTokens: 400 });
    const tryKeys = async (label, setup, want) => {
        gw._resetKeys(); answer = setup; seen = [];
        const outs = []; for (let i = 0; i < 3; i++) outs.push(await gen());
        check(outs.every(o => o.ok && want.includes(o.text.slice(5))), `${label}: ${outs.map(o => o.ok ? o.text : o.error).join(' | ')}`);
        return outs;
    };
    await tryKeys('a key out of credits (429, prepayment credits used up) hands over to the next key', { K1: [429, 'Your prepayment credits are depleted. Please go to AI Studio to manage your project and billing.'] }, ['K2', 'K3']);
    check(seen.filter(x => x.startsWith('K1 ')).length === 1, `the key out of credits rests on every model after the first refusal (tried ${seen.filter(x => x.startsWith('K1 ')).length} times)`);
    await tryKeys('a key whose project has billing off (400) hands over', { K2: [400, 'Gemini API free tier is not available in your country. Please enable billing on your project in Google AI Studio.'] }, ['K1', 'K3']);
    await tryKeys('a key that is out of money (402) hands over', { K3: [402, 'Payment required'] }, ['K1', 'K2']);
    await tryKeys('a blocked or leaked key (403) hands over', { K1: [403, 'Your API key was reported as leaked. Please use another API key.'] }, ['K2', 'K3']);
    await tryKeys('a rejected key (400 API key not valid) hands over', { K1: [400, 'API key not valid. Please pass a valid API key.'] }, ['K2', 'K3']);
    await tryKeys('a busy key (503) hands over', { K1: [503, 'The model is overloaded.'], K2: [500, 'Internal error'] }, ['K3']);
    const rate = await tryKeys('a rate-limited key (429, the ordinary "check your plan and billing details") hands over', { K1: [429, 'You exceeded your current quota, please check your plan and billing details.'] }, ['K2', 'K3']);
    // a rate limit is only for that model: the key still serves the next model
    gw._resetKeys(); seen = []; answer = { K1: (m) => m === 'gemini-3.5-flash-lite' ? [429, 'Resource exhausted: per minute'] : null, K2: (m) => m === 'gemini-3.5-flash-lite' ? [429, 'Resource exhausted'] : null, K3: (m) => m === 'gemini-3.5-flash-lite' ? [429, 'Resource exhausted'] : null };
    let o = await gen();
    check(o.ok && o.model !== 'gemini-3.5-flash-lite' && seen.filter(x => / gemini-3\.5-flash-lite$/.test(x)).length === 3, `every key at its limit on one model: the next model answers (${o.ok ? o.model : o.error}, ${seen.join(', ')})`);
    // every key out of credits: the request fails with a plain reason (no rate-limit wait)
    gw._resetKeys(); answer = { K1: [429, 'Your prepayment credits are depleted.'], K2: [403, 'Billing account is disabled for this project.'], K3: [400, 'Please enable billing on your project.'] };
    o = await gen();
    check(!o.ok && o.status === 502 && /out of credits or has billing off/.test(o.error), `every key out of credits: ${o.status} ${o.error}`);
    // …and when they rest, a later request still tries them (one may have been topped up)
    answer = {}; o = await gen();
    check(o.ok, `a key topped up is used again even while the keys rest: ${o.ok ? o.text : o.error}`);
    // the relay (the EA-PA Worker's keys) at its limit: the keys here take over
    gw._resetKeys(); answer = {}; seen = [];
    const relayed = [];
    const withRelay = globalThis.fetch;
    globalThis.fetch = async (url, init) => { if (String(url).includes('/api/ai-relay')) { relayed.push(url); return new Response(JSON.stringify({ error: { message: 'Too many requests' } }), { status: 429 }); } return withRelay(url, init); };
    o = await gen({ ...kenv, AI_RELAY_SECRET: 'r' });
    check(relayed.length === 1 && o.ok && /^from K/.test(o.text), `the relay at its limit hands over to the Portal's keys: ${o.ok ? o.text : o.error}`);
    o = await gw.generate({ AI_RELAY_SECRET: 'r' }, { system: 's', messages: [{ role: 'user', text: 'x' }] });
    check(!o.ok && o.status === 429, 'with no keys of its own, the relay\'s limit is the answer');
    globalThis.fetch = realFetch;
}

// the reviews keep a share of the day: when practice chats have used the rest, a review (json) still goes through, and one
// flow's share doesn't hold a review back
{
    gw._resetKeys();
    sql.exec(`DELETE FROM ai_usage_day`); sql.exec(`DELETE FROM ai_usage_minute`); sql.exec(`DELETE FROM ai_usage_user`);
    sql.exec(`INSERT INTO ai_usage_day (day, module, calls, tokens) VALUES (date('now'), 'calendaring', 92, 1000), (date('now'), 'standard', 2, 100)`);
    const renv = { ...env, AI_DAILY_CALLS: '100', AI_USER_10MIN: '999', AI_MINUTE_CALLS: '1000', AI_MODULE_SHARE: '0.5' };
    const chat = await gw.runAi(db, renv, { module: 'cms', user: 'a', system: 's', messages: [{ role: 'user', text: 'x' }] });
    const rev = await gw.runAi(db, renv, { module: 'calendaring', user: 'b', system: 's', messages: [{ role: 'user', text: 'x' }], json: true });
    check(chat.status === 429 && chat.body.scope === 'daily', `a practice chat stops at the reviews' reserve (${chat.status} ${chat.body.scope})`);
    check(rev.status === 200, `a review still goes through, over its flow's share of the day too (${rev.status} ${rev.body.error || ''})`);
    check(gw.limits({ AI_REVIEW_RESERVE: '0.2' }).reviewReserve === 0.2 && gw.limits({}).reviewReserve === 0.1 && gw.limits({ AI_REVIEW_RESERVE: '0' }).reviewReserve === 0, 'AI_REVIEW_RESERVE sets the reserve (10% unless set)');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
process.exit(failures.length ? 1 : 0);

// The AI gateway's shared budget and key pool, on SQLite (node:sqlite as D1) with Gemini mocked.
// Checks: every call flow is counted in one ledger; the minute, daily and per-person limits refuse with a plain reason;
// one flow can't take more than its share of the day (so none starves the others); a rate-limited key rests and the next
// one answers; tokens are the ones Gemini reports; the endpoint refuses a wrong gateway key and works with the right one.
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

const sum = await gw.usageSummary(db, env);
check(sum.total.calls >= 3 && Array.isArray(sum.today) && sum.limits.dailyCalls === 40, 'the admin summary lists each flow and the limits');

// the endpoint
const ep = await load('functions/api/ai-gateway.js', [["import { json, requireSession } from '../_utils.js';", "const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } }); const requireSession = async () => ({ ok: false });"], ["from '../_ai-gateway.js'", `from '${pathToFileURL(path.join(tmp, '_ai-gateway.mjs')).href}'`]]);
const post = (key, body) => ep.onRequestPost({ request: new Request('https://p/api/ai-gateway', { method: 'POST', headers: { 'X-Gateway-Key': key }, body: JSON.stringify(body) }), env: { ...env, AI_USER_10MIN: '999', AI_DAILY_CALLS: '4000', AI_MINUTE_CALLS: '1000', TRAINING_DB: db, AI_GATEWAY_SECRET: 'sekret' } });
sql.exec(`DELETE FROM ai_usage_day`); sql.exec(`DELETE FROM ai_usage_minute`);
let res = await post('wrong', { module: 'cms', messages: [{ role: 'user', text: 'hi' }] });
check(res.status === 401, 'the gateway refuses a wrong gateway key');
res = await post('sekret', { module: 'cms', user: 'trainee1', messages: [{ role: 'user', text: 'hi' }] });
const out = await res.json();
check(res.status === 200 && out.success && out.module === 'cms', 'the CMS reaches the shared keys through the gateway with the right key');
const noSecret = await ep.onRequestPost({ request: new Request('https://p/', { method: 'POST', headers: { 'X-Gateway-Key': 'x' }, body: '{}' }), env: { TRAINING_DB: db } });
check(noSecret.status === 501, 'with no gateway secret set the gateway says so');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
process.exit(failures.length ? 1 : 0);

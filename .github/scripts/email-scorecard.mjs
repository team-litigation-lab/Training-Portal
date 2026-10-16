// The Email Replies scorecard (simulators/email-scorecard.js): the same five metrics on every scenario, the score worked
// out here and not taken from the AI, and the simulator page wired to them.
// Usage: node .github/scripts/email-scorecard.mjs   (from the repository root; no browser needed)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const failures = []; const fail = (m) => failures.push(m);
const src = readFileSync('simulators/email-scorecard.js', 'utf8');
const ctx = { window: {}, document: undefined };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const S = ctx.window.EmailScorecard;
if (!S) { console.log('1 failure(s):\n1. simulators/email-scorecard.js did not define window.EmailScorecard'); process.exit(1); }

const KEYS = ['urgency', 'answers', 'accuracy', 'nextstep', 'tone'];
if (S.METRICS.length !== 5 || S.METRICS.map(m => m.key).join() !== KEYS.join()) fail(`the five metrics changed: ${S.METRICS.map(m => m.key).join()}`);
if (S.METRICS.reduce((a, m) => a + m.weight, 0) !== 9) fail('the weights no longer add up to 9 (2+2+2+2+1)');

// all 5s is 100%, all 0s is 0%
if (S.average(KEYS.map(k => ({ key: k, score: 5 }))).pct !== 100) fail('a perfect reply is not 100%');
if (S.average(KEYS.map(k => ({ key: k, score: 0 }))).pct !== 0) fail('an empty reply is not 0%');

// rows out of order are lined up by key, not by position
const shuffled = [{ key: 'tone', score: 5 }, { key: 'accuracy', score: 0 }, { key: 'urgency', score: 0 }, { key: 'nextstep', score: 0 }, { key: 'answers', score: 0 }];
const n = S.normalize(shuffled);
if (n.map(r => r.key).join() !== KEYS.join()) fail('normalize did not put the rows back in the scorecard order');
if (n[4].score !== 5 || n[2].score !== 0) fail('normalize lined the rows up by position instead of by key');
if (S.average(shuffled).pct !== Math.round(5 / 9 / 5 * 100)) fail(`the weighting is wrong for a tone-only reply: ${S.average(shuffled).pct}%`);

// a name instead of a key still lines up; a missing row scores 0; a score out of range is clamped
const byName = S.normalize([{ name: 'Answers What Was Asked', score: 4 }]);
if (byName[1].score !== 4) fail('a row given by name did not line up');
if (byName[0].score !== 0) fail('a metric the AI left out did not score 0');
if (S.normalize([{ key: 'tone', score: 99 }])[4].score !== 5 || S.normalize([{ key: 'tone', score: -3 }])[4].score !== 0) fail('a score outside 0–5 was not clamped');
if (S.normalize(undefined).length !== 5 || S.normalize('nonsense').length !== 5) fail('a missing or junk metrics list did not fall back to five rows');

// the prompt names every metric and its weight, so the AI answers with these rows
const block = S.promptBlock();
for (const m of S.METRICS) if (!block.includes(m.key) || !block.includes(m.name)) fail(`the prompt does not name the metric ${m.key}`);

// the page asks for them, scores from them, and saves the scorecard's percentage
const page = readFileSync('simulators/email-replies.html', 'utf8');
if (!page.includes('/simulators/email-scorecard.js')) fail('email-replies.html does not load the scorecard');
if (!page.includes('EmailScorecard.promptBlock()')) fail('the grading prompt does not ask for the five metrics');
if (!page.includes('EmailScorecard.normalize(r.metrics)') || !page.includes('score: total.pct')) fail('the saved score is not the scorecard\'s percentage');
if (/score:\s*r\.score/.test(page)) fail('the page still saves the score the AI invented');
if (!page.includes('EmailScorecard.html(')) fail('the debrief does not show the scorecard table');

if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
console.log('Email Replies scorecard test passed (five fixed metrics, weighted 2/2/2/2/1, lined up by key, clamped, and the page scored from them).');

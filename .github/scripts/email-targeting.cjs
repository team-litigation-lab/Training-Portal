// A course step opens the email practice it needs, not a list to choose from.
//   Email Replies (simulators/email-replies.html): ?email=<id> opens that scenario straight away (the ids
//   in simulators/reply-packs/emails.json). An id that isn't one of the loaded scenarios is ignored and the
//   trainee gets the list, so a stale or mistyped link never opens a blank page. Without the parameter
//   nothing changes.
//   Email Workspace (simulators/email.html): ?inbox=cm|ea opens that ready-made inbox instead of the
//   chooser, and ?inbox=1 the one this trainee's program starts on. An inbox already in progress on the
//   device wins, so following the link again never clears the work.
// Usage: node .github/scripts/email-targeting.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const failures = []; const fail = (m) => failures.push(m);
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/api/me') return send({ success: true, user: { username: 'ci', fullName: 'Ci Trainee', userType: 'Trainee', batchId: 'B1', program: 'CM' } });
    if (u.pathname === '/api/email-practice') return send({ success: true, delivery: false });
    if (u.pathname.startsWith('/api/')) return send({ success: false, error: 'offline test' });
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
// the scenarios the server really serves, so the test names a real one
const SCENARIOS = JSON.parse(fs.readFileSync(path.join(ROOT, 'simulators/reply-packs/emails.json'), 'utf8')).emails;
const PICK = SCENARIOS.find(e => e.id === 'cm_hospital_lien') || SCENARIOS[0];

(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const open = async (url, ctx) => {
        const page = await (ctx || browser).newPage({ viewport: { width: 1280, height: 900 } });
        page.on('pageerror', e => fail('page error: ' + e.message)); page.on('dialog', x => x.accept());
        await page.goto(base + url, { waitUntil: 'load' }); await page.waitForTimeout(1400);
        return page;
    };
    const body = (p) => p.evaluate(() => (document.getElementById('app') || {}).innerText || '');

    /* ---- Email Replies ---- */
    // the step's own email, opened and ready to answer
    let page = await open(`/simulators/email-replies.html?program=CM&email=${PICK.id}`);
    let t = await body(page);
    const phase = await page.evaluate(() => (typeof E !== 'undefined' ? E.phase : '?'));
    if (phase !== 'read') fail(`?email=${PICK.id} should open that email to answer (phase "${phase}")`);
    if (!t.includes(PICK.subject)) fail(`?email=${PICK.id} did not open that email: ${t.slice(0, 200)}`);
    await page.close();

    // an id that is not a scenario: the list, never a blank page
    page = await open('/simulators/email-replies.html?program=CM&email=cm_not_a_real_email');
    t = await body(page);
    if (await page.evaluate(() => E.phase) !== 'list') fail('an unknown ?email should leave the trainee on the list');
    if (!/All emails|Case Management/.test(t)) fail(`an unknown ?email left nothing on the page: ${t.slice(0, 160)}`);
    await page.close();

    // without the parameter, the list as before
    page = await open('/simulators/email-replies.html?program=CM');
    if (await page.evaluate(() => E.phase) !== 'list') fail('without ?email the trainee should get the list');
    await page.close();

    /* ---- Email Workspace ---- */
    // the inbox itself, not the chooser
    page = await open('/simulators/email.html?program=CM&inbox=cm');
    t = await body(page);
    let w = await page.evaluate(() => (typeof W !== 'undefined' ? { phase: W.phase, pack: W.pack && W.pack.id, emails: (W.emails || []).length } : null));
    if (!w || w.phase !== 'ws' || w.pack !== 'cm') fail(`?inbox=cm should open the CM inbox: ${JSON.stringify(w)}`);
    if (!w.emails) fail('the opened inbox has no emails in it');
    if (/Open this inbox/.test(t)) fail('?inbox=cm still showed the chooser');
    await page.close();

    // ?inbox=1 follows the trainee's program
    page = await open('/simulators/email.html?program=CM&inbox=1');
    w = await page.evaluate(() => ({ phase: W.phase, pack: W.pack && W.pack.id }));
    if (w.phase !== 'ws' || w.pack !== 'cm') fail(`?inbox=1 should open the inbox the program starts on: ${JSON.stringify(w)}`);
    await page.close();

    // an unknown inbox is ignored: the chooser, as before
    page = await open('/simulators/email.html?program=CM&inbox=nope');
    if (await page.evaluate(() => W.phase) === 'ws') fail('an unknown ?inbox opened something anyway');
    await page.close();

    // without the parameter, the chooser as before
    page = await open('/simulators/email.html?program=CM');
    if (await page.evaluate(() => W.phase) === 'ws') fail('without ?inbox the Workspace should still show the chooser');
    await page.close();

    // work already in progress wins over the link
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await open('/simulators/email.html?program=CM&inbox=cm', ctx);
    await page.evaluate(() => { W.startedAt = 1234567; wsSave(); });   // the inbox has been worked in
    await page.close();
    page = await open('/simulators/email.html?program=CM&inbox=cm', ctx);
    const kept = await page.evaluate(() => ({ phase: W.phase, started: W.startedAt, pack: W.pack && W.pack.id }));
    if (kept.phase !== 'ws' || kept.pack !== 'cm') fail(`following the step's link again did not reopen the inbox: ${JSON.stringify(kept)}`);
    if (kept.started !== 1234567) fail(`following the step's link again restarted the inbox instead of keeping the work: ${JSON.stringify(kept)}`);
    await page.close(); await ctx.close();

    await browser.close(); server.close();
    if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
    console.log('Email practice opens where the step needs it: ?email=<id> opens that scenario, ?inbox=cm|ea|1 opens that inbox, unknown values fall back to the list or the chooser, and work in progress is never cleared.');
    console.log('All good.');
})().catch(e => { console.error(e); process.exit(1); });

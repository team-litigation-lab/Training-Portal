// A signed-in person on the simulator pages (simulators/sim.js, simulators.html).
// Checks:
//   - a Trainee's session in the tab is kept (sim.js used to delete it) and the heartbeat beats on a simulator page, at load and every 30 s,
//     so the Portal's APIs keep treating the trainee as signed in (they answer 401 SESSION_EXPIRED 90 s after the last beat);
//   - a page opened in a new tab (the cookie, no copy in the tab): Sim.restore() asks /api/me once, for an Admin or a Trainee, keeps the
//     answer, starts the heartbeat, and the hub shows the right links (an admin's Trainee Evaluations, a trainee's My Evaluations);
//     signed out it resolves to {} and keeps nothing;
//   - Sim.fetchRetry: a 401 SESSION_EXPIRED asks /api/me once and repeats the request once (same body); any other answer is returned as it is;
//   - a second trainee on the same browser does not inherit the first one's name, calendar or history (LSH_SIM_USER), and the first one's
//     calendar is never uploaded as the second one's draft.
// Usage: node .github/scripts/sim-session.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const failures = []; const fail = (m) => failures.push(m);
const BOB = { username: 'bob', fullName: 'Bob Lee', userType: 'Trainee', batchId: 'B2' };
const ANN = { username: 'ann', fullName: 'Ann Trainer', userType: 'Admin' };
let me = null;                 // what /api/me answers: BOB, ANN or nobody
let alive = true, stuck = false, probeCode = 'SESSION_EXPIRED';   // /api/probe: the heartbeat row (/api/me re-seeds it unless stuck)
let log = [];                  // every API request: { path, method, body }
const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const body = await new Promise(r => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => r(b)); });
    if (u.pathname.startsWith('/api/')) log.push({ path: u.pathname, method: req.method, q: u.search, body });
    if (u.pathname === '/api/me') { if (me && !stuck) alive = true; return me ? send({ success: true, user: me }) : send({ success: false, code: 'NOT_AUTHENTICATED' }, 401); }
    if (u.pathname === '/api/heartbeat') return send({ success: true });
    if (u.pathname === '/api/probe') return alive ? send({ success: true, echo: body }) : send({ success: false, error: 'Session expired.', code: probeCode }, 401);
    if (u.pathname === '/api/sim-results') return send({ success: true, admin: me && me.userType === 'Admin', results: [] });
    if (u.pathname === '/api/gcal-reviews') return u.searchParams.get('draft') != null ? send({ success: true, track: u.searchParams.get('draft'), data: null, updatedAt: null }) : send({ success: true, reviews: [] });
    if (u.pathname === '/api/gcal-schedule') return send({ success: true, rows: null });
    if (u.pathname.startsWith('/api/')) return send({ success: false, error: 'offline test' });
    if (u.pathname === '/blank.html') { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); return res.end('<!doctype html><title>blank</title><script src="/app.js"></script><script src="/simulators/sim.js"></script>'); }
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const count = (p, extra) => log.filter(x => x.path === p && (!extra || extra(x))).length;
    // A fresh browser profile and tab. `kept` is what this browser's localStorage holds before the page opens; `session` the tab's own copy of who.
    async function tab(url, { session, kept, clock } = {}) {
        const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
        await ctx.route(x => !/^(localhost|127\.0\.0\.1)$/.test(x.hostname), r => r.abort());   // fonts, CDN scripts: not needed
        const page = await ctx.newPage();
        page.on('pageerror', e => fail(`page error on ${url}: ${e.message}`)); page.on('dialog', d => d.dismiss());
        if (clock) await page.clock.install();
        if (kept || session) {
            await page.goto(base + '/blank.html', { waitUntil: 'load' });
            await page.evaluate(([k, s]) => { Object.keys(k || {}).forEach(n => localStorage.setItem(n, typeof k[n] === 'string' ? k[n] : JSON.stringify(k[n]))); if (s) sessionStorage.setItem('LSH_SESSION_V1', JSON.stringify(s)); }, [kept, session]);
        }
        log = [];
        await page.goto(base + url, { waitUntil: 'load' }); await page.waitForTimeout(900);
        return page;
    }
    const store = (page) => page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) o[localStorage.key(i)] = localStorage.getItem(localStorage.key(i)); return o; });
    const sess = (page) => page.evaluate(() => sessionStorage.getItem('LSH_SESSION_V1'));
    const hub = (page) => page.evaluate(() => document.getElementById('hub-grid').innerText + '\n' + document.getElementById('results-title').innerText);

    /* ---------- a Trainee's tab keeps its session and beats ---------- */
    me = BOB;
    let page = await tab('/simulators.html', { session: BOB, clock: true });
    if (!/"username":"bob"/.test(await sess(page) || '')) fail('a trainee session is deleted on the simulators hub (sim.js)');
    if (count('/api/heartbeat') < 1) fail('a trainee on the simulators hub sends no heartbeat at load');
    if (count('/api/me')) fail('a tab that already has its session asked /api/me');
    await page.clock.runFor(30000); await page.waitForTimeout(300); await page.clock.runFor(30000); await page.waitForTimeout(400);
    if (count('/api/heartbeat') !== 3) fail(`${count('/api/heartbeat')} heartbeats after 60 s on the simulators hub (expected 3: at load, then every 30 s), so the Portal would call the trainee signed out after 90 s`);
    let t = await hub(page);
    if (!/My Evaluations/.test(t) || /Trainee Evaluations/.test(t)) fail('a trainee on the hub should see My Evaluations, not Trainee Evaluations: ' + t.slice(-300));
    await page.context().close();

    /* ---------- a new tab: the cookie, no copy in the tab ---------- */
    for (const who of [BOB, ANN]) {
        me = who;
        page = await tab('/simulators.html');
        const s = JSON.parse(await sess(page) || 'null');
        if (!s || s.username !== who.username || s.userType !== who.userType) fail(`${who.userType} in a new tab: the hub did not keep the person /api/me names: ${JSON.stringify(s)}`);
        if (count('/api/me') !== 1) fail(`${who.userType} in a new tab: /api/me asked ${count('/api/me')} times (expected once)`);
        if (count('/api/heartbeat') < 1) fail(`${who.userType} in a new tab: no heartbeat after Sim.restore()`);
        t = await hub(page);
        if (who === ANN) {
            if (!/Trainee Evaluations/.test(t) || /My Evaluations/.test(t)) fail('an admin in a new tab is treated as a trainee on the hub: ' + t.slice(-300));
            if (!/all trainees/.test(t) || !count('/api/sim-results')) fail('an admin in a new tab does not get the admin results: ' + t.slice(-120));
            if (!/Log Out/.test(await page.evaluate(() => document.getElementById('topbar').innerText))) fail('an admin in a new tab has no Log Out in the top bar');
        } else if (!/My Evaluations/.test(t) || /Trainee Evaluations/.test(t)) fail('a trainee in a new tab should see My Evaluations: ' + t.slice(-300));
        await page.context().close();
    }
    me = null;
    page = await tab('/simulators.html');
    if (await sess(page)) fail('a signed-out browser was given a session');
    if (count('/api/heartbeat')) fail('a signed-out browser sends a heartbeat');
    if (!(await page.evaluate(() => document.querySelectorAll('#hub-grid .hub-card').length))) fail('the hub did not draw for a signed-out browser');
    await page.context().close();

    /* ---------- Sim.restore / Sim.fetchRetry in isolation ---------- */
    me = BOB;
    page = await tab('/blank.html');
    log = [];
    const both = await page.evaluate(() => Promise.all([Sim.restore(), Sim.restore()]));
    if (count('/api/me') !== 1 || both[0].username !== 'bob' || both[1].username !== 'bob') fail(`two Sim.restore() calls at once asked /api/me ${count('/api/me')} times: ${JSON.stringify(both)}`);
    log = [];
    if ((await page.evaluate(() => Sim.restore())).username !== 'bob' || count('/api/me')) fail('Sim.restore() with a session in the tab should answer from the tab, without /api/me');
    const probe = (o) => page.evaluate(async (o) => { const r = await Sim.fetchRetry('/api/probe', Object.assign({ method: 'POST', credentials: 'include', body: '{"n":1}' }, o)); return { status: r.status, text: await r.text() }; }, o || {});
    // expired once: /api/me re-seeds it, the request is sent again with the same body
    alive = false; stuck = false; log = [];
    let r = await probe();
    if (r.status !== 200 || (JSON.parse(r.text).echo || '') !== '{"n":1}') fail('fetchRetry did not repeat an expired request after /api/me: ' + JSON.stringify(r));
    if (count('/api/me') !== 1 || count('/api/probe') !== 2) fail(`fetchRetry on SESSION_EXPIRED: /api/me ${count('/api/me')}, /api/probe ${count('/api/probe')} (expected 1 and 2)`);
    if (log.filter(x => x.path === '/api/probe').some(x => x.body !== '{"n":1}')) fail('fetchRetry did not send the same body twice');
    // still expired afterwards: asked once and repeated once, then the 401 comes back
    alive = false; stuck = true; log = [];
    r = await probe();
    if (r.status !== 401 || !/SESSION_EXPIRED/.test(r.text)) fail('a request that is still expired should come back as the 401: ' + JSON.stringify(r));
    if (count('/api/me') !== 1 || count('/api/probe') !== 2) fail(`fetchRetry that stays expired: /api/me ${count('/api/me')}, /api/probe ${count('/api/probe')} (expected 1 and 2)`);
    // another 401, and a good answer: no retry
    alive = false; stuck = true; probeCode = 'NOT_AUTHENTICATED'; log = [];
    r = await probe();
    if (r.status !== 401 || !/NOT_AUTHENTICATED/.test(r.text) || count('/api/me') || count('/api/probe') !== 1) fail('a 401 that is not SESSION_EXPIRED should be returned as it is, with no retry: ' + JSON.stringify(log.map(x => x.path)));
    alive = true; probeCode = 'SESSION_EXPIRED'; log = [];
    r = await probe();
    if (r.status !== 200 || count('/api/me') || count('/api/probe') !== 1) fail('a good answer should not cost an /api/me or a second request: ' + JSON.stringify(log.map(x => x.path)));
    await page.context().close();

    /* ---------- a second trainee on the same browser ---------- */
    const KEPT = { LSH_SIM_USER: 'jane', LSH_SIM_WHO: { name: 'Ana Reyes', batch: 'B1', program: 'CM', skipped: false }, 'lsh_gcal:ana reyes': { v: 1, reqs: [], events: [], savedAt: 5 }, 'lsh_gcal.cm:ana reyes': { v: 1, reqs: [], events: [], savedAt: 5 },
        'lsh_gcal.ea:ana reyes': { v: 1, reqs: [], events: [], savedAt: 5 }, lsh_gcal_seen: [7], LSH_SIM_HISTORY: [{ simulator: 'Google Calendar', score: 90 }], other_site_setting: 'keep me' };
    const leftover = (k) => Object.keys(k).filter(n => n !== 'other_site_setting' && n !== 'LSH_SIM_USER');
    // the tab knows Bob (he signed in on the Portal): Jane's things are gone before anything reads them
    me = BOB;
    page = await tab('/simulators.html', { session: BOB, kept: KEPT });
    let k = await store(page);
    if (leftover(k).length) fail('a second trainee inherits the first one\'s name, calendars and history: ' + leftover(k).join(', '));
    if (k.LSH_SIM_USER !== 'bob' || k.other_site_setting !== 'keep me') fail('the new person should be remembered and other keys left alone: ' + JSON.stringify(Object.keys(k)));
    if (/Ana Reyes/.test(await page.evaluate(() => document.getElementById('topbar').innerText))) fail('the second trainee\'s top bar says "Practicing as Ana Reyes"');
    await page.context().close();
    // the same person coming back keeps theirs; nobody remembered yet: kept, and now remembered
    page = await tab('/simulators.html', { session: BOB, kept: Object.assign({}, KEPT, { LSH_SIM_USER: 'bob' }) });
    k = await store(page);
    if (leftover(k).length !== leftover(KEPT).length) fail('the same person lost their calendars and name: ' + leftover(k).join(', '));
    await page.context().close();
    const unknown = Object.assign({}, KEPT); delete unknown.LSH_SIM_USER;
    page = await tab('/simulators.html', { session: BOB, kept: unknown });
    k = await store(page);
    if (leftover(k).length !== leftover(KEPT).length || k.LSH_SIM_USER !== 'bob') fail('with nobody remembered yet the browser\'s calendars should be kept and Bob remembered: ' + JSON.stringify(Object.keys(k)));
    await page.context().close();
    // a new tab (no session in the tab): /api/me names Bob; the link that brought him names him too
    page = await tab('/simulators.html?name=Bob%20Lee&batch=B2', { kept: KEPT });
    k = await store(page);
    if (leftover(k).filter(n => n !== 'LSH_SIM_WHO').length) fail('a new tab for a second trainee did not clear the first one\'s calendars: ' + leftover(k).join(', '));
    const w = JSON.parse(k.LSH_SIM_WHO || 'null');
    if (!w || w.name !== 'Bob Lee' || w.batch !== 'B2' || w.program) fail('the link\'s ?name=&batch= should be the only thing left in LSH_SIM_WHO: ' + k.LSH_SIM_WHO);
    await page.context().close();
    // nobody signed in: nothing is cleared (the next person to sign in is compared)
    me = null;
    page = await tab('/simulators.html', { kept: KEPT });
    k = await store(page);
    if (leftover(k).length !== leftover(KEPT).length || k.LSH_SIM_USER !== 'jane') fail('a signed-out visit changed what the browser keeps: ' + JSON.stringify(Object.keys(k)));
    await page.context().close();

    // the calendar page: Jane's calendar is not on Bob's calendar and is not uploaded as his draft
    me = BOB;
    const cal = { v: 1, today: '2026-10-06', view: 'week', anchor: '2026-10-06', mini: '2026-10', side: true, panel: '', hidden: {}, set: { dur: 30, weekends: false, tz2: false }, ex: {}, sx: {}, reqs: [], result: null, savedAt: Date.now(),
        events: [{ id: 'jane1', title: 'JANESMARKER Deposition', date: '2026-10-06', start: '10:00', end: '10:30' }] };
    page = await tab('/simulators/gcal.html?track=cm', { session: BOB, kept: { LSH_SIM_USER: 'jane', LSH_SIM_WHO: { name: 'Jane Doe', batch: 'B1' }, 'lsh_gcal.cm:jane doe': cal }, clock: false });
    await page.waitForTimeout(4500);
    if (log.some(x => x.method === 'POST' && x.path === '/api/gcal-reviews' && /JANESMARKER/.test(x.body))) fail('Jane\'s calendar was uploaded as Bob\'s draft');
    if (/JANESMARKER|Jane Doe/.test(await page.evaluate(() => document.body.innerText))) fail('Bob sees Jane\'s calendar or name on the calendar page');
    if (count('/api/heartbeat') < 1) fail('a trainee on gcal.html sends no heartbeat');
    await page.context().close();

    await browser.close(); server.close();
    if (failures.length) { console.error('FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
    console.log('Simulator session test passed (a trainee keeps their session and heartbeat, a new tab asks /api/me once, fetchRetry, a second trainee starts clean).');
})().catch(e => { console.error('FAILED:\n- ' + failures.concat('the test stopped: ' + e.message).join('\n- ')); process.exit(1); });

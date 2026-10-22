// Whose score is it? On every simulator page, a signed-in trainee must practice as their own account and their score
// must be recorded under it (simulators/sim.js).
//
// The flow this guards is the one the courses use: a course's link opens a Portal simulator in a new tab, with noopener
// (js/ft-simulators.js in Foundational-Training), and the course passes the trainee's name and batch in the address
// (?name=&batch=). functions/_middleware.js signs the trainee in from the ticket and reloads without it, so the tab holds
// the signed cookie but NO copy of the person in its own storage until /api/me answers. A page that drew its top bar, or
// or saved a score before then treated a signed-in trainee as an anonymous visitor: it offered
// the editable "Practicing as … ✎" and wrote the score under a name typed in this browser. Sim.ready is what the top bar
// and Sim.saveResult now wait for, and each page awaits Sim.restore() before its first render. Everyone signs in through
// the Portal, so no page asks who is practicing any more: there is no "Who's practicing?" box on any simulator.
//
// Checks, for each page, with someone else's name both kept in the browser and named by the link:
//   - the name in the top bar is the signed-in trainee's, and is not editable (no ✎, not a link);
//   - no page asks who is practicing (the "Who's practicing?" box is gone);
//   - a heartbeat goes out, so the Portal keeps treating them as signed in;
//   - Sim.saveResult posts the score, and posts it as the signed-in trainee.
// Then two cases that hang off the same answer:
//   - a shared training-room machine: the previous trainee's name, calendar and history are dropped for the person now
//     signed in (LSH_SIM_USER / Sim.claim(), which could only run once who is signed in was known);
//   - a signed-out visitor is still asked who is practicing and their result is still saved: only *when* that is decided
//     changed, not the decision.
// Usage: node .github/scripts/sim-identity.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const failures = []; const fail = (m) => failures.push(m);
// The signed-in trainee, and the other identities the page must ignore.
const LEI = { username: 'labut', fullName: 'Lei Abut', userType: 'Trainee', batchId: 'B250926' };
const LINK = '?program=FT&name=Someone%20Else&batch=B999999';      // what the course's link says
const KEPT = { name: 'Maria Santos', batch: 'B010126' };           // an earlier trainee on this browser
let log = [], signedOut = false;
const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const body = await new Promise(r => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => r(b)); });
    if (u.pathname.startsWith('/api/')) log.push({ path: u.pathname, method: req.method, body });
    if (u.pathname === '/api/me') return signedOut ? send({ success: false, code: 'NOT_AUTHENTICATED' }, 401) : send({ success: true, user: LEI });   // the cookie says who is signed in
    if (u.pathname === '/api/heartbeat') return send({ success: true });
    if (u.pathname === '/api/sim-results') return send({ success: true, admin: false, results: [] });
    if (u.pathname === '/api/calsim') return send({ success: true, me: { username: LEI.username, name: LEI.fullName, batch: LEI.batchId, admin: false }, data: null });
    if (u.pathname === '/api/gcal-reviews') return u.searchParams.get('draft') != null ? send({ success: true, data: null, updatedAt: null }) : send({ success: true, reviews: [] });
    if (u.pathname === '/api/gcal-schedule') return send({ success: true, rows: null });
    if (u.pathname.startsWith('/api/')) return send({ success: false, error: 'offline test' });
    if (u.pathname === '/seed.html') { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); return res.end('<!doctype html><title>seed</title>'); }   // storage seeded with no script of its own
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
// Every page that shows who is practicing and saves a score.
const PAGES = [
    ['Calendaring', '/simulators/calendar.html'],
    ['Google Calendar Simulator', '/simulators/gcal.html'],
    ['Calendaring Simulators', '/simulators/calsim.html'],
    ['Email Workspace', '/simulators/email.html'],
    ['Email Replies', '/simulators/email-replies.html'],
    ['Docket System', '/simulators/docket.html'],
    ['Medical Records Requests', '/simulators/records.html'],
    ['Court E-Filing', '/simulators/efiling.html'],
    ['Appellate E-Filing', '/simulators/appellate.html'],
    ['Simulators hub', '/simulators.html']
];
(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    for (const [label, url] of PAGES) {
        const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
        await ctx.route(x => !/^(localhost|127\.0\.0\.1)$/.test(x.hostname), r => r.abort());   // fonts, CDN scripts: not needed
        const page = await ctx.newPage();
        const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('dialog', d => d.dismiss());
        // An earlier trainee's name is kept in this browser; the tab itself knows nobody (a new tab, opened with noopener).
        await page.goto(base + '/simulators.html', { waitUntil: 'commit' }).catch(() => {});
        await page.evaluate(([w]) => { localStorage.setItem('LSH_SIM_WHO', JSON.stringify(w)); localStorage.setItem('LSH_SIM_USER', 'msantos'); sessionStorage.clear(); }, [KEPT]).catch(() => {});
        log = [];
        await page.goto(base + url + LINK, { waitUntil: 'load' });
        await page.waitForTimeout(1800);

        const who = await page.evaluate(() => { const n = document.querySelector('#topbar .who'); return n ? { text: n.innerText.replace(/\s+/g, ' ').trim(), tag: n.tagName } : null; });
        const asked = await page.evaluate(() => !!document.getElementById('sim-who'));
        const beats = log.filter(x => x.path === '/api/heartbeat').length;
        log = [];
        await page.evaluate(() => Sim.saveResult({ simulator: 'Test', scenario: 'identity', score: 88, summary: 'x' })).catch(e => errs.push('saveResult: ' + e.message));
        await page.waitForTimeout(500);
        const sent = log.filter(x => x.path === '/api/sim-results' && x.method === 'POST').map(x => (JSON.parse(x.body || '{}').who) || {});

        if (!who) fail(`${label}: no top bar, so who is practicing is never shown`);
        else {
            if (/✎/.test(who.text)) fail(`${label}: a signed-in trainee is offered the editable name ("${who.text}"), so they can practice as someone else`);
            if (who.tag !== 'SPAN') fail(`${label}: the name is a <${who.tag}>, not fixed text, so a signed-in trainee can change who they practice as`);
            if (!/Lei Abut/.test(who.text)) fail(`${label}: the top bar says "${who.text}", not the signed-in trainee`);
            if (/Someone Else|Maria Santos|B999999|B010126/.test(who.text)) fail(`${label}: the top bar shows a name from the link or this browser: "${who.text}"`);
        }
        if (asked) fail(`${label}: the "Who's practicing?" box came back — everyone signs in through the Portal now`);
        if (!beats) fail(`${label}: no heartbeat at load, so the Portal treats the trainee as signed out after 90 s and refuses their score`);
        if (!sent.length) fail(`${label}: the score was not sent to the trainer at all`);
        else if (sent[0].name !== 'Lei Abut' || sent[0].batch !== 'B250926') fail(`${label}: the score was posted as ${JSON.stringify(sent[0])}, not the signed-in trainee`);
        if (errs.length) fail(`${label}: page error — ${errs.join(' | ')}`);
        await ctx.close();
    }
    // A browser left on the old "just practice" flag (set before the box was removed) never drops a signed-in trainee's score.
    {
        const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
        await ctx.route(x => !/^(localhost|127\.0\.0\.1)$/.test(x.hostname), r => r.abort());
        const page = await ctx.newPage(); page.on('dialog', d => d.dismiss());
        await page.goto(base + '/simulators.html', { waitUntil: 'commit' }).catch(() => {});
        await page.evaluate(() => { localStorage.setItem('LSH_SIM_WHO', JSON.stringify({ skipped: true })); sessionStorage.clear(); }).catch(() => {});
        log = [];
        await page.goto(base + '/simulators/calendar.html' + LINK, { waitUntil: 'load' });
        await page.waitForTimeout(1600);
        log = [];
        await page.evaluate(() => Sim.saveResult({ simulator: 'Test', scenario: 'skipped', score: 77, summary: 'x' }));
        await page.waitForTimeout(500);
        const sent = log.filter(x => x.path === '/api/sim-results' && x.method === 'POST').map(x => (JSON.parse(x.body || '{}').who) || {});
        if (!sent.length) fail('a signed-in trainee whose browser was left on "just practice" has their score dropped');
        else if (sent[0].name !== 'Lei Abut') fail(`"just practice" kept for a signed-in trainee: posted as ${JSON.stringify(sent[0])}`);
        await ctx.close();
    }
    // A shared training-room machine: the trainee before them left their name, calendar and history in this browser.
    // LSH_SIM_USER / Sim.claim() is meant to drop all of it for the next person (so nobody practices under the previous
    // trainee's name, and their page never uploads the previous calendar as its own draft) — but Sim.claim() only runs
    // once who is signed in is known, so on a page that rendered before /api/me answered it never ran at all.
    {
        const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
        await ctx.route(x => !/^(localhost|127\.0\.0\.1)$/.test(x.hostname), r => r.abort());
        const page = await ctx.newPage(); page.on('dialog', d => d.dismiss());
        await page.goto(base + '/seed.html', { waitUntil: 'load' });
        await page.evaluate(() => {
            localStorage.setItem('LSH_SIM_USER', 'ann');
            localStorage.setItem('LSH_SIM_WHO', JSON.stringify({ name: 'Ann Prior', batch: 'B000001' }));
            localStorage.setItem('LSH_SIM_HISTORY', JSON.stringify([{ simulator: 'Calendaring', score: 99 }]));
            localStorage.setItem('lsh_gcal:ann prior', JSON.stringify({ v: 1, events: [{ id: 'x', title: "Ann's appointment" }] }));
            sessionStorage.clear();
        });
        await page.goto(base + '/simulators/calendar.html' + LINK, { waitUntil: 'load' });
        await page.waitForTimeout(1800);
        const kept = await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) o[localStorage.key(i)] = localStorage.getItem(localStorage.key(i)); return o; });
        if (kept.LSH_SIM_USER !== 'labut') fail(`a shared browser was not taken over by the trainee now signed in (LSH_SIM_USER=${kept.LSH_SIM_USER})`);
        if (kept['lsh_gcal:ann prior']) fail("a shared browser kept the previous trainee's calendar, which this trainee's page would upload as their own draft");
        if (/Ann Prior/.test(kept.LSH_SIM_WHO || '')) fail("a shared browser kept the previous trainee's name");
        if (/"score":99/.test(kept.LSH_SIM_HISTORY || '')) fail("a shared browser kept the previous trainee's results history");
        await ctx.close();
    }
    // A signed-out visitor is never asked who is practicing: everyone reaches the simulators signed in through the Portal.
    // The name a course's link carries (?name=&batch=) still names them, and their score still goes to the trainer.
    {
        const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
        await ctx.route(x => !/^(localhost|127\.0\.0\.1)$/.test(x.hostname), r => r.abort());
        const page = await ctx.newPage(); page.on('dialog', d => d.dismiss());
        signedOut = true;
        await page.goto(base + '/simulators/calendar.html?name=Walk-in%20Visitor&batch=B123456', { waitUntil: 'load' });
        await page.waitForTimeout(1800);
        if (await page.evaluate(() => !!document.getElementById('sim-who'))) fail('a signed-out visitor was asked "Who\'s practicing?" — the box should be gone');
        if (await page.evaluate(() => !!document.querySelector('.sim-top a.who[onclick]'))) fail('the top bar still offers an editable name to a visitor');
        log = [];
        await page.evaluate(() => Sim.saveResult({ simulator: 'Test', scenario: 'visitor', score: 70, summary: 'x' }));
        await page.waitForTimeout(500);
        const sent = log.filter(x => x.path === '/api/sim-results' && x.method === 'POST').map(x => (JSON.parse(x.body || '{}').who) || {});
        if (!sent.length) fail('a visitor named by the link had the score dropped');
        else if (sent[0].name !== 'Walk-in Visitor') fail(`a visitor's score posted as ${JSON.stringify(sent[0])}`);
        signedOut = false;
        await ctx.close();
    }
    await browser.close(); server.close();
    if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
    console.log(`Simulator identity test passed (${PAGES.length} pages): a signed-in trainee practices as their own account — the name is fixed, nobody is asked who is practicing, the heartbeat beats, and the score is recorded under the account and not under a name from the link or this browser; a shared browser is taken over from the previous trainee; a signed-out visitor is never asked, and a name the link carries still reaches the trainer.`);
})();

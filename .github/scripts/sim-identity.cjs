// Whose score is it? On every simulator page, a signed-in trainee must practice as their own account and their score
// must be recorded under it (simulators/sim.js).
//
// The flow this guards is the one the courses use: a course's link opens a Portal simulator in a new tab, with noopener
// (js/ft-simulators.js in Foundational-Training), and the course passes the trainee's name and batch in the address
// (?name=&batch=). functions/_middleware.js signs the trainee in from the ticket and reloads without it, so the tab holds
// the signed cookie but NO copy of the person in its own storage until /api/me answers. A page that drew its top bar, or
// asked who was practicing, or saved a score before then treated a signed-in trainee as an anonymous visitor: it offered
// the editable "Practicing as … ✎", asked "Who's practicing?" (so they could practice as someone else), started no
// heartbeat (the Portal's APIs refuse the score 90 s later) and wrote the score under a name typed in this browser — or,
// if they chose "Just practice (don't save)", dropped it. Sim.ready is what the top bar, the box and Sim.saveResult now
// wait for, and each page awaits Sim.restore() before its first render.
//
// Checks, for each page, with someone else's name both kept in the browser and named by the link:
//   - the name in the top bar is the signed-in trainee's, and is not editable (no ✎, not a link);
//   - the "Who's practicing?" box is never shown;
//   - a heartbeat goes out, so the Portal keeps treating them as signed in;
//   - Sim.saveResult posts the score, and posts it as the signed-in trainee.
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
let log = [];
const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const body = await new Promise(r => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => r(b)); });
    if (u.pathname.startsWith('/api/')) log.push({ path: u.pathname, method: req.method, body });
    if (u.pathname === '/api/me') return send({ success: true, user: LEI });     // the cookie says who is signed in
    if (u.pathname === '/api/heartbeat') return send({ success: true });
    if (u.pathname === '/api/sim-results') return send({ success: true, admin: false, results: [] });
    if (u.pathname === '/api/calsim') return send({ success: true, me: { username: LEI.username, name: LEI.fullName, batch: LEI.batchId, admin: false }, data: null });
    if (u.pathname === '/api/gcal-reviews') return u.searchParams.get('draft') != null ? send({ success: true, data: null, updatedAt: null }) : send({ success: true, reviews: [] });
    if (u.pathname === '/api/gcal-schedule') return send({ success: true, rows: null });
    if (u.pathname.startsWith('/api/')) return send({ success: false, error: 'offline test' });
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
        if (asked) fail(`${label}: a signed-in trainee was asked "Who's practicing?"`);
        if (!beats) fail(`${label}: no heartbeat at load, so the Portal treats the trainee as signed out after 90 s and refuses their score`);
        if (!sent.length) fail(`${label}: the score was not sent to the trainer at all`);
        else if (sent[0].name !== 'Lei Abut' || sent[0].batch !== 'B250926') fail(`${label}: the score was posted as ${JSON.stringify(sent[0])}, not the signed-in trainee`);
        if (errs.length) fail(`${label}: page error — ${errs.join(' | ')}`);
        await ctx.close();
    }
    // "Just practice (don't save)" belongs to a visitor, not a signed-in trainee: their score is never dropped.
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
    await browser.close(); server.close();
    if (failures.length) { console.log(`${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
    console.log(`Simulator identity test passed (${PAGES.length} pages): a signed-in trainee practices as their own account — the name is fixed, nobody is asked who is practicing, the heartbeat beats, and the score is recorded under the account and not under a name from the link or this browser.`);
})();

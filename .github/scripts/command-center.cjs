// The Trainer Command Center (/command-center.html): the top metrics bar, the priority-ranked
// focus list, the ranking and tier table, and the Program → Batch → Trainee cascade ending in a
// trainee's centralized scorecard (every rubric their program grades, and the mean of those).
// Also: trainees are turned away, the partial-read note is shown rather than hidden, and the
// dashboard fits one screen on a desktop without the page itself scrolling.
// Usage: node .github/scripts/command-center.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const failures = []; const fail = (m) => failures.push(m);
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();

// Ana has a score in five rubrics: 88 + 80 + 90 + 85 + 70 = 413, so her overall is 83%.
// Ben is under the pass mark and has been quiet for 20 days. Cara is waiting for approval.
const progress = {
    success: true, connected: true, generatedAt: new Date().toISOString(),
    partial: true, note: 'There’s more course data than one request can read, so some of it isn’t shown: CM Training trainees.',
    programs: [{ id: 'ft', label: 'Standard Foundational Training', days: 18 }, { id: 'cm', label: 'CM Training', days: 10 }],
    trainees: [
        { program: 'ft', id: 't1', name: 'Ana Reyes', batch: 'B092626', status: 'Approved', daysDone: 9, daysTotal: 18, kcAvg: 88, practiceAvg: 80, practiceRuns: 4, practiceDone: 4, taskAvg: null, roleplayAvg: null, roleplayRuns: 0, lastActive: ago(0), feedback: { sent: 2, drafts: 1, unread: 1, days: {} } },
        { program: 'ft', id: 't2', name: 'Ben Cruz', batch: 'B092626', status: 'Approved', daysDone: 3, daysTotal: 18, kcAvg: 55, practiceAvg: 60, practiceRuns: 2, practiceDone: 2, taskAvg: null, roleplayAvg: null, roleplayRuns: 0, lastActive: ago(20), feedback: { sent: 0, drafts: 0, unread: 0, days: {} } },
        { program: 'ft', id: 't3', name: 'Cara Lim', batch: 'B100126', status: 'Pending', daysDone: 0, daysTotal: 18, kcAvg: null, practiceAvg: null, practiceRuns: 0, practiceDone: 0, taskAvg: null, roleplayAvg: null, roleplayRuns: 0, lastActive: ago(1), feedback: { sent: 0, drafts: 0, unread: 0, days: {} } },
        { program: 'cm', id: 't4', name: 'Dan Ortiz', batch: 'B091526', status: 'Approved', daysDone: 8, daysTotal: 10, kcAvg: 92, practiceAvg: null, practiceRuns: 0, practiceDone: 0, taskAvg: null, roleplayAvg: null, roleplayRuns: 0, lastActive: ago(1), feedback: { sent: 1, drafts: 0, unread: 0, days: {} } }
    ],
    traineeFeedback: [],
    simulators: { byName: { 'ana reyes': { runs: 3, avg: 90, last: ago(1), sims: {} } } },
    portalWork: { byName: { 'ana reyes': { submitted: 5, graded: 4, avgScore: 85, last: ago(1), items: [] } } },
    calsim: { byName: { 'ana reyes': { ft: { weeks: [{ label: 'Standard · Week 1', at: ago(2), auto: 70, score: null, comment: '' }] } } } },
    archivedBatches: []
};
const leaderboard = { success: true, leaderboard: [
    { username: 'dan', fullName: 'Dan Ortiz', batchId: 'B091526', averageScore: 92 },
    { username: 'ana', fullName: 'Ana Reyes', batchId: 'B092626', averageScore: 83 }
] };

let role = 'admin';   // admin | trainee
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/api/program-progress') {
        if (role !== 'admin') return send({ success: false, error: 'Admins only.' }, 403);
        return send(progress);
    }
    if (u.pathname === '/api/leaderboard') return send(leaderboard);
    if (u.pathname.startsWith('/api/')) return send({ success: false, error: 'offline test' });
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});

(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const open = async (width, height) => {
        const page = await browser.newPage({ viewport: { width: width || 1440, height: height || 900 } });
        page.on('pageerror', e => fail('page error: ' + e.message));
        page.on('console', m => { if (m.type() === 'error') fail('console error: ' + m.text()); });
        page.on('dialog', x => x.dismiss());
        await page.addInitScript(([r]) => {
            const s = r === 'admin' ? { username: 'boss', fullName: 'Trainer Bo', userType: 'Admin' } : { username: 'ci', fullName: 'Ci Trainee', userType: 'Trainee' };
            try { sessionStorage.setItem('LSH_SESSION_V1', JSON.stringify(s)); } catch (e) {}
        }, [role]);
        await page.goto(base + '/command-center.html', { waitUntil: 'load' });
        await page.waitForTimeout(1200);
        return page;
    };
    const text = (page, sel) => page.evaluate((s) => (document.querySelector(s) || {}).innerText || '', sel);

    // ---- a trainer's screen ----
    // (the tile and tier labels are upper-cased by CSS, so innerText comes back shouting: match case-insensitively)
    let page = await open();

    const metrics = await text(page, '#ccMetrics');
    if (!/active trainees/i.test(metrics)) fail('the metrics bar has no Active trainees tile: ' + metrics.slice(0, 200));
    if (!/\b3\b/.test(metrics)) fail('three approved trainees should be counted (Cara is still pending): ' + metrics.slice(0, 200));
    if (!/average score/i.test(metrics) || !/completion/i.test(metrics)) fail('the metrics bar is missing the average score or completion: ' + metrics.slice(0, 200));
    if (!/at risk/i.test(metrics) || !/needs you/i.test(metrics)) fail('the metrics bar is missing At risk or Needs you: ' + metrics.slice(0, 200));

    // ---- the focus list, priority-ranked ----
    const focus = await text(page, '#ccFocus');
    if (!/awaiting approval/i.test(focus)) fail('a trainee waiting for approval is not in the focus list: ' + focus.slice(0, 300));
    if (!/Feedback drafts to finish/i.test(focus)) fail("Ana's unsent feedback draft is not in the focus list: " + focus.slice(0, 300));
    if (!/Submissions to grade/i.test(focus)) fail('the ungraded submission is not in the focus list: ' + focus.slice(0, 300));
    if (!/Calendars to score/i.test(focus)) fail('the calendar waiting for a trainer score is not in the focus list: ' + focus.slice(0, 300));
    if (!/under 70%/i.test(focus)) fail('Ben is under the pass mark and should be flagged: ' + focus.slice(0, 300));
    if (!/Quiet for 7\+ days/i.test(focus)) fail('Ben has been quiet for 20 days and should be flagged: ' + focus.slice(0, 300));
    const order = await page.$$eval('#ccFocus .cc-act .t', els => els.map(e => e.innerText));
    if (!/awaiting approval/i.test(order[0] || '')) fail('approvals block a trainee outright, so they rank first: ' + JSON.stringify(order));

    // ---- ranking and tier ----
    const rank = await text(page, '#ccRank');
    if (!/Trainer Bo/.test(rank)) fail("the signed-in trainer's own status is missing: " + rank.slice(0, 200));
    if (!/Dan Ortiz/.test(rank) || !/gold/i.test(rank)) fail('the leaderboard and its tiers are missing: ' + rank.slice(0, 300));

    // ---- the partial-read note is shown, not hidden ----
    const note = await text(page, '#ccNote');
    if (!/more course data than one request can read/i.test(note)) fail('a partial read must say so: ' + note.slice(0, 200));

    // ---- the cascade, down to one scorecard ----
    const cascade = await text(page, '#ccCascade');
    if (!/Standard Foundational Training/.test(cascade) || !/CM Training/.test(cascade)) fail('the programs are not listed: ' + cascade.slice(0, 300));
    if (!/B092626/.test(cascade)) fail("the chosen program's batches are not listed: " + cascade.slice(0, 300));
    await page.click('#ccCascade .cc-list:nth-child(2) .cc-pick');          // the newest batch
    await page.waitForTimeout(250);
    const withTrainees = await text(page, '#ccCascade');
    if (!/Ana Reyes/.test(withTrainees) || !/Ben Cruz/.test(withTrainees)) fail("the batch's trainees are not listed: " + withTrainees.slice(0, 400));

    await page.click('#ccCascade .cc-list:nth-child(3) .cc-pick');          // the first trainee (most recently active: Ana)
    await page.waitForTimeout(250);
    const sc = await text(page, '#ccScorecard');
    if (!/Ana Reyes/.test(sc)) fail('the scorecard is not the trainee that was picked: ' + sc.slice(0, 300));
    for (const r of ['Knowledge Checks', 'Practice Lab', 'Portal simulators', 'Calendaring']) {
        if (!new RegExp(r, 'i').test(sc)) fail(`the ${r} rubric is missing from the scorecard: ` + sc.slice(0, 400));
    }
    if (/Surprise tasks|Roleplays/.test(sc)) fail('a rubric with no score should be left out, not shown as a zero: ' + sc.slice(0, 400));
    if (!/83%/.test(sc)) fail('the overall should be the mean of the five rubrics she has (83%): ' + sc.slice(0, 400));
    if (!/1 draft/.test(sc)) fail("the trainee's unsent feedback draft is not shown on the scorecard: " + sc.slice(0, 400));

    // ---- one screen, no page scrolling (the spec's 100vh fit) ----
    const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 2);
    if (scrolls) fail('the dashboard should fit one screen on a desktop without the page scrolling');
    await page.close();

    // ---- a phone stacks it and may scroll ----
    page = await open(390, 780);
    const narrow = await text(page, '#ccMetrics');
    if (!/active trainees/i.test(narrow)) fail('the metrics bar is missing on a narrow screen: ' + narrow.slice(0, 200));
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    if (sideways) fail('nothing should scroll sideways on a phone');
    await page.close();

    // ---- trainees are turned away ----
    role = 'trainee';
    page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.addInitScript(() => { try { sessionStorage.setItem('LSH_SESSION_V1', JSON.stringify({ username: 'ci', fullName: 'Ci Trainee', userType: 'Trainee' })); } catch (e) {} });
    await page.goto(base + '/command-center.html', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    if (!/admin-login/.test(page.url())) fail('a trainee opening the Command Center must be sent to admin sign-in, got ' + page.url());
    await page.close();

    await browser.close(); server.close();
    if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
    console.log('Command Center: the metrics bar counts approved trainees, the focus list ranks approvals first and names every outstanding action, the ranking shows tiers and the trainer, a partial read says so, Program → Batch → Trainee opens a scorecard whose overall is the mean of the rubrics scored, it fits one screen, and trainees are turned away.');
})().catch(e => { console.error(e); process.exit(1); });

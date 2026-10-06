// 👥 Your trainees' calendars on the Trainee Evaluations page (simulators/gcal-review.html, the table from simulators/trainees-calendars.js):
// each trainee with a calendar saved, a column per track with 👁 View & score, a search, and on a track where the trainee has submitted for
// evaluation: their submission, its AI review state and a button that opens the review (the live review under the table).
// Usage: node .github/scripts/trainees-on-evaluations.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const failures = []; const fail = (m) => failures.push(m);
const REVIEWS = [
    { id: 5, username: 'ci', name: 'Ci Trainee', batch: 'B1', track: 'standard', submittedAt: '2026-10-06T12:00:00.000Z', checkScore: 64, status: 'submitted', aiStatus: 'done', updatedAt: '2026-10-06T12:00:30.000Z' },
    { id: 6, username: 'ci', name: 'Ci Trainee', batch: 'B1', track: 'standard', submittedAt: '2026-10-06T15:00:00.000Z', checkScore: 80, status: 'final', aiStatus: 'done', updatedAt: '2026-10-06T15:30:00.000Z' }];
const FULL = { id: 6, username: 'ci', name: 'Ci Trainee', batch: 'B1', track: 'standard', submittedAt: '2026-10-06T15:00:00.000Z', checkScore: 80, status: 'final', aiStatus: 'done', finalizedAt: '2026-10-06T15:30:00.000Z', finalizedBy: 'Trainer Bo',
    ai: { summary: 'Good.', correct: ['a'], improve: ['b'], missed: ['c'] }, trainer: { notes: 'ok', points: [], score: 80 }, calendar: { automatedCheck: { results: [] } } };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/api/me') return send({ success: true, user: { username: 'boss', fullName: 'Trainer Bo', userType: 'Admin' } });
    if (u.pathname === '/api/gcal-reviews') {
        if (u.searchParams.get('drafts') === '1') return send({ success: true, drafts: [
            { username: 'ci', name: 'Ci Trainee', batch: 'B1', track: 'standard', updatedAt: '2026-10-06T15:10:00.000Z' },
            { username: 'zed', name: 'Zed Other', batch: 'B2', track: 'cm', updatedAt: '2026-10-06T14:00:00.000Z' }] });
        if (u.searchParams.get('all') === '1') return send({ success: true, reviews: REVIEWS });
        if (u.searchParams.get('id')) return send({ success: true, review: FULL });
        if (u.searchParams.get('rules') != null) return send({ success: true, track: 'standard', text: '' });
        return send({ success: true, reviews: [] });
    }
    if (u.pathname === '/api/calsim') return send({ success: true, rows: [] });
    if (u.pathname.startsWith('/api/')) return send({ success: false, error: 'offline test' });
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.on('pageerror', e => fail('page error: ' + e.message)); page.on('dialog', x => x.dismiss());
    await page.goto(base + '/simulators/gcal-review.html', { waitUntil: 'load' });
    await page.waitForSelector('#rv-trainees .cs-ttable', { timeout: 6000 }).catch(async () => { fail('Trainee Evaluations has no list of the trainees’ calendars: ' + (await page.evaluate(() => (document.getElementById('app') || {}).innerText.slice(0, 300))).replace(/\n/g, ' ')); console.error(failures.join('\n')); process.exit(1); });
    const tl = await page.evaluate(() => ({ heads: [...document.querySelectorAll('#rv-trainees .cs-ttable th')].map(h => h.innerText.trim()), rows: [...document.querySelectorAll('#rv-trainees .cs-ttable tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim()),
        links: [...document.querySelectorAll('#rv-trainees a.cs-view')].map(a => a.getAttribute('href')), above: !!document.querySelector('#rv-trainees') && document.querySelector('#rv-trainees').compareDocumentPosition(document.querySelector('#rv-list')) & Node.DOCUMENT_POSITION_FOLLOWING }));
    if (tl.heads.length !== 4 || !/standard training/i.test(tl.heads[1]) || !/litigation week/i.test(tl.heads[2]) || !/executive week/i.test(tl.heads[3])) fail('the table has no column for each track: ' + JSON.stringify(tl.heads));
    if (tl.rows.length !== 2 || !/^Ci Trainee B1/.test(tl.rows[0]) || !/Zed Other/.test(tl.rows[1])) fail('the trainees are not listed: ' + JSON.stringify(tl.rows));
    if (JSON.stringify(tl.links) !== JSON.stringify(['/simulators/gcal.html?trainee=ci', '/simulators/gcal.html?track=cm&trainee=zed'])) fail('View & score does not open each trainee’s calendar: ' + JSON.stringify(tl.links));
    if (!tl.above) fail('the trainees’ table should sit above the submissions');
    if (!/Submitted/.test(tl.rows[0]) || !/Sent/.test(tl.rows[0]) || /Submitted/.test(tl.rows[1])) fail('a trainee’s submission and its state are not shown in their row: ' + JSON.stringify(tl.rows));
    await page.fill('#cs-tfind', 'b2');
    const shown = await page.$$eval('#rv-trainees .cs-ttable tbody tr', trs => trs.map(t => t.style.display));
    if (JSON.stringify(shown) !== '["none",""]') fail('finding a trainee by batch doesn’t narrow the list: ' + JSON.stringify(shown));
    await page.fill('#cs-tfind', '');
    await page.click('#rv-trainees [data-sub="6"]'); await page.waitForTimeout(700);
    const open = await page.evaluate(() => (document.getElementById('rv-main') || {}).innerText || '');
    if (!/Ci Trainee/.test(open) || !/Good\./.test(open)) fail('the button in the table does not open that submission’s review: ' + open.slice(0, 200));
    // the search is not lost when the list refreshes (the table is drawn again only below the search box)
    await page.fill('#cs-tfind', 'zed'); await page.waitForTimeout(300);
    if ((await page.inputValue('#cs-tfind')) !== 'zed') fail('the search was cleared');
    await page.setViewportSize({ width: 390, height: 900 }); await page.waitForTimeout(300);
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)) fail('the page scrolls sideways on a phone with the trainees’ table');
    await browser.close(); server.close();
    if (failures.length) { console.error('FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
    console.log('Trainees on Trainee Evaluations: the table of trainees’ calendars sits above the submissions, with View & score per track, a search, each trainee’s submission and AI review state, a button into the review, and no sideways scroll on a phone.');
})();

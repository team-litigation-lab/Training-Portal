// The trainer's review inside the Google Calendar look (simulators/gcal.js ?review=, calsim.html's list of submissions) of the submissions
// made with 📤 Submit to my trainer (kept in the trainee's /api/calsim record): a trainer opens one read only, scores it and comments,
// the trainee sees the feedback, and the trainer's list shows it.
// Usage: node .github/scripts/gcal-review.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const failures = []; const fail = (m) => failures.push(m);
let rec = null, role = 'trainee';
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const chunks = [];
    req.on('data', c => chunks.push(c)); req.on('end', () => {
        const send = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
        if (u.pathname === '/api/calsim') {
            const me = role === 'admin' ? { username: 'boss', name: 'Trainer', batch: '', admin: true } : { username: 'ci', name: 'Ci Trainee', batch: 'B1', admin: false };
            if (req.method === 'POST') {
                const b = JSON.parse(Buffer.concat(chunks).toString());
                if (b.review) { if (role !== 'admin') return send({ success: false, error: 'Admin access required.' }, 403); rec.reviews = rec.reviews || {}; rec.reviews[b.review.key] = { score: Math.round(b.review.score), comment: b.review.comment, tasks: b.review.tasks, by: 'Trainer', at: new Date().toISOString() }; return send({ success: true, data: rec }); }
                if (role === 'admin') return send({ success: true, preview: true });
                rec = Object.assign({}, b.data, { reviews: (rec && rec.reviews) || {} }); return send({ success: true, reviews: rec.reviews });
            }
            if (u.searchParams.get('all') === '1') return send({ success: true, me, rows: rec ? [{ username: 'ci', name: 'Ci Trainee', batch: 'B1', data: rec }] : [] });
            if (u.searchParams.get('user')) return send({ success: true, me, data: rec, person: { name: 'Ci Trainee', batch: 'B1' } });
            return send({ success: true, me, data: role === 'admin' ? null : rec });
        }
        if (u.pathname.startsWith('/api/')) return send({ success: false, error: 'offline test' });
        let f = path.join(ROOT, decodeURIComponent(u.pathname));
        if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
    });
});
(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const open = async (url) => {
        const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
        await page.addInitScript(() => { try { localStorage.setItem('LSH_SIM_WHO', JSON.stringify({ name: 'Ci Trainee', batch: 'B1', skipped: false })); } catch (e) { /* none */ } });
        page.on('pageerror', e => fail(`${url}: page error: ${e.message}`)); page.on('dialog', x => x.dismiss());
        await page.goto(base + url, { waitUntil: 'load' }); await page.waitForTimeout(1000);
        return page;
    };
    const panelText = (p) => p.evaluate(() => (document.querySelector('#gc-panel') || {}).innerText || '');
    // 1. a submission made with 📤 Submit to my trainer (before 📤 Submit for evaluation, functions/api/gcal-reviews.js, took its place):
    //    kept in the trainee's /api/calsim record; the trainee sees it, and the page's one Submit button is 📤 Submit for evaluation
    rec = { v: 2, drafts: {}, autos: [], submissions: [], reviews: {}, external: [], gsubs: [{ track: 'cm', at: '2026-10-06T12:00:00.000Z',
        result: { score: 40, right: 1, penalty: 0, extra: [], at: '2026-10-06T12:00:00.000Z', results: [{ head: 'Book – Ci Client', when: 'Wed, Oct 7 · 2 – 2:30pm', pts: 5, max: 10, items: [{ ok: true, t: 'On the Attorney’s Calendar.' }, { ok: false, t: 'Add an email notification 1 day before.' }] }] },
        snap: { events: [], ex: {}, sx: {}, reqs: [], today: '2026-10-06', rows: [] } }] };
    const sub = rec.gsubs[0];
    role = 'trainee';
    let page = await open('/simulators/gcal.html?track=cm');
    if (!/Submitted/.test(await panelText(page))) fail('the trainee does not see their earlier submission: ' + (await panelText(page)).slice(0, 100));
    if (await page.$('[data-a="gsubmit"]') || !(await page.$('#gc-rail [data-a="submit-eval"]'))) fail('the one Submit button should be 📤 Submit for evaluation');
    await page.close();
    // 2. a trainer opens it, read only, and gives feedback
    role = 'admin';
    page = await open('/simulators/gcal.html?track=cm&review=' + encodeURIComponent('ci|' + sub.at));
    let t = await panelText(page);
    if (!/Review/i.test(t) || !/Ci Trainee/.test(t) || !/Your feedback/i.test(t)) fail('the review panel is not showing: ' + t.slice(0, 160));
    await page.fill('#rv-score', '77'); await page.fill('#rv-comment', 'Good start: check the buffers.'); await page.fill('#rv-t0', 'Needs the case number.');
    await page.click('[data-a="rv-save"]'); await page.waitForTimeout(700);
    const rv = rec.reviews && rec.reviews['g:cm|' + sub.at];
    if (!rv || rv.score !== 77 || !/buffers/.test(rv.comment) || !rv.tasks || rv.tasks.r0 !== 'Needs the case number.') fail('the feedback was not saved: ' + JSON.stringify(rv));
    if (await page.evaluate(() => Object.keys(localStorage).some(k => k.indexOf('lsh_gcal') === 0))) fail('review mode wrote to the trainer’s own practice calendar');
    await page.close();
    // 3. the trainee sees the feedback
    role = 'trainee';
    page = await open('/simulators/gcal.html?track=cm');
    t = await panelText(page);
    if (!/77\/100/.test(t) || !/Good start/.test(t) || !/Needs the case number/.test(t)) fail('the trainee does not see the trainer’s feedback: ' + t.slice(0, 200));
    await page.close();
    // 4. the trainer's list of submissions
    role = 'admin';
    page = await open('/simulators/calsim.html?view=scores&track=litigation');
    const list = await page.evaluate(() => (document.getElementById('gs-list') || {}).innerText || '');
    const href = await page.$$eval('#gs-list a', a => a.map(x => x.getAttribute('href')));
    if (!/Ci Trainee/.test(list) || !/77\/100/.test(list)) fail('the trainer’s list does not show the submission: ' + list.slice(0, 160));
    if (!href.some(h => /track=cm/.test(h) && /review=ci%7C/.test(h))) fail('the list has no link to review it: ' + JSON.stringify(href));
    await page.close();
    await browser.close(); server.close();
    if (failures.length) { console.error('Google Calendar submit and review test FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
    console.log('Google Calendar submit and review test passed (submit keeps the calendar and check; the trainer opens it read only and gives feedback; the trainee sees it; the trainer’s list links to it).');
})();

// The trainee's own My Evaluations section (simulators/my-evaluations.html): calendars in progress (saved drafts, with a way back into
// the simulator), calendars submitted with their status, and the final report the trainer has sent (read here, PDF download).
// A trainer opening it is pointed to Trainee Evaluations; a signed-out visitor is asked to sign in.
// Usage: node .github/scripts/my-evaluations.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const failures = []; const fail = (m) => failures.push(m);
let role = 'trainee';   // trainee | admin | out
const final = { id: 7, username: 'ci', name: 'Ci Trainee', batch: 'B1', track: 'cm', submittedAt: '2026-10-06T12:00:00.000Z', checkScore: 64, status: 'final', aiStatus: 'done',
    finalizedAt: '2026-10-06T14:00:00.000Z', finalizedBy: 'Trainer Bo', ai: { summary: 'Most appointments are right.', correct: ['Booked the deposition prep on Monday'], improve: ['Add Google Meet to the adjuster call'], missed: ['No reminder on the consult'] },
    trainer: { notes: 'Good start.\nWatch the buffers.', points: ['Check travel time'], score: 82 }, calendar: { automatedCheck: { results: [] } } };
const waiting = { id: 8, username: 'ci', name: 'Ci Trainee', batch: 'B1', track: 'standard', submittedAt: '2026-10-06T15:00:00.000Z', checkScore: 40, status: 'submitted', aiStatus: 'done' };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/api/me') return role === 'out' ? send({ success: false }, 401) : send({ success: true, user: role === 'admin' ? { username: 'boss', fullName: 'Trainer Bo', userType: 'Admin' } : { username: 'ci', fullName: 'Ci Trainee', userType: 'Trainee', batchId: 'B1' } });
    if (u.pathname === '/api/gcal-reviews') {
        if (role === 'out') return send({ success: false, error: 'Not authenticated.' }, 401);
        if (u.searchParams.get('draft') != null) { const t = u.searchParams.get('draft'); return send({ success: true, track: t, data: t === 'cm' ? { v: 1, events: [{ id: 'a' }, { id: 'b' }], savedAt: Date.now() } : null, updatedAt: t === 'cm' ? '2026-10-06T13:00:00.000Z' : null }); }
        return send({ success: true, reviews: [waiting, final] });
    }
    if (u.pathname.startsWith('/api/')) return send({ success: false, error: 'offline test' });
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const open = async (width) => {
        const page = await browser.newPage({ viewport: { width: width || 1200, height: 900 } });
        page.on('pageerror', e => fail('page error: ' + e.message)); page.on('dialog', x => x.dismiss());
        await page.goto(base + '/simulators/my-evaluations.html', { waitUntil: 'load' }); await page.waitForTimeout(1300);
        return page;
    };
    const body = (p) => p.evaluate(() => (document.getElementById('app') || {}).innerText || '');
    role = 'trainee';
    let page = await open(); let t = await body(page);
    if (!/calendars in progress/i.test(t) || !/Draft saved/.test(t) || !/Continue my calendar/.test(t)) fail('the trainee does not see their saved draft: ' + t.slice(0, 200));
    const hrefs = await page.$$eval('.me-track a', a => a.map(x => x.getAttribute('href')));
    if (!hrefs.includes('/simulators/gcal.html?track=cm') || !hrefs.includes('/simulators/gcal.html') || !hrefs.includes('/simulators/gcal.html?track=ea')) fail('the way back into each simulator is missing: ' + JSON.stringify(hrefs));
    if (!/With your trainer/.test(t) || !/Final report sent/.test(t) || !/New/.test(t)) fail('the submitted calendars and their status are not listed: ' + t.slice(0, 300));
    if (/Watch the buffers|Most appointments are right/.test(t)) fail('a report that is not opened shows its feedback in the list');
    await page.click('[data-a="open"]'); await page.waitForTimeout(300); t = await body(page);
    if (!/Most appointments are right/.test(t) || !/Add Google Meet/.test(t) || !/Watch the buffers/.test(t) || !/82\/100/.test(t)) fail('the final report is not showing: ' + t.slice(0, 300));
    if (!(await page.$('[data-a="pdf"]'))) fail('no PDF download on the final report');
    await page.click('[data-a="back"]'); await page.waitForTimeout(200); t = await body(page);
    if (/New\b/.test(t.replace(/Not started/g, ''))) fail('a report that was read is still marked New');
    await page.close();
    // on a phone: no sideways scroll
    page = await open(390);
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)) fail('My Evaluations scrolls sideways on a phone');
    await page.close();
    role = 'admin'; page = await open(); t = await body(page);
    if (!/Trainee Evaluations/.test(t) || /Continue my calendar/.test(t)) fail('a trainer should be pointed to Trainee Evaluations: ' + t.slice(0, 160));
    await page.close();
    role = 'out'; page = await open(); t = await body(page);
    if (!/Sign in/.test(t)) fail('a signed-out visitor is not asked to sign in: ' + t.slice(0, 160));
    await page.close();
    await browser.close(); server.close();
    if (failures.length) { console.error('FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
    console.log('My Evaluations test passed (drafts with a way back in, submitted status, the final report and PDF, trainer and signed-out views, phone width).');
})();

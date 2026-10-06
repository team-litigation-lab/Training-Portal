// The trainer's Trainee Evaluations page (simulators/gcal-review.html) opened in a NEW TAB: the signed cookie is there, but the tab's own
// storage holds no copy of the person (a link that opens with noopener, a bookmark), so the page used to say "This page is for trainers"
// to a signed-in admin. It now asks /api/me (Sim.restore) and shows the review. A trainee, or a signed-out browser, still gets the note.
// Usage: node .github/scripts/gcal-review-page.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const failures = []; const fail = (m) => failures.push(m);
let who = null;   // what /api/me answers: an admin, a trainee, or nobody
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/api/me') return who ? send({ success: true, user: who }) : send({ success: false, code: 'NOT_AUTHENTICATED' }, 401);
    if (u.pathname === '/api/gcal-reviews') return who && who.userType === 'Admin' ? send({ success: true, reviews: [] }) : send({ success: false, error: 'Admin access required.' }, 403);
    if (u.pathname.startsWith('/api/')) return send({ success: false, error: 'offline test' });
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const text = async () => {
        const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
        page.on('pageerror', e => fail('page error: ' + e.message));
        await page.goto(base + '/simulators/gcal-review.html', { waitUntil: 'load' }); await page.waitForTimeout(1200);
        const t = await page.evaluate(() => (document.getElementById('app') || {}).innerText || '');
        const kept = await page.evaluate(() => sessionStorage.getItem('LSH_SESSION_V1'));
        await page.close(); return { t, kept };
    };
    who = { username: 'boss', fullName: 'Trainer Bo', userType: 'Admin' };
    let r = await text();
    if (/This page is for trainers/.test(r.t)) fail('a signed-in admin in a new tab still gets "This page is for trainers": ' + r.t.slice(0, 120));
    if (!r.kept || JSON.parse(r.kept).userType !== 'Admin') fail('the tab did not keep the admin session after asking /api/me');
    who = { username: 'ann', fullName: 'Ann Lee', userType: 'Trainee' };
    r = await text();
    if (!/This page is for trainers/.test(r.t)) fail('a trainee should be told this page is for trainers: ' + r.t.slice(0, 120));
    if (r.kept) fail('a trainee session was kept on a simulator page');
    who = null;
    r = await text();
    if (!/This page is for trainers/.test(r.t)) fail('a signed-out browser should be told this page is for trainers: ' + r.t.slice(0, 120));
    await browser.close(); server.close();
    if (failures.length) { console.error('FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
    console.log('Trainee Evaluations page: a signed-in admin in a new tab gets the review; trainees and signed-out visitors get the note.');
})();

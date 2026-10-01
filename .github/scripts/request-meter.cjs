// The server request meter on this site (README → Server request meter):
// 1. /api/request-budget (functions/api/request-budget.js, with a stand-in env): admins only (signed out
//    is 401, a trainee 403); before the Request budget workflow has run (or without COURSE_KV) it answers
//    usage: null; after, the month's numbers as the workflow saved them to KV ("_request-usage"), without
//    the workflow's own working data.
// 2. In a browser (static files, API calls answered here): every admin page shows the meter after one
//    request, with the numbers, bottom right (on a phone, clear of the ← Back button); signed out, as a
//    trainee or inside a course's frame there's no meter and nothing is asked or loaded for it.
// The meter itself (every level, the note, the details): request-meter-widget.cjs.
// Usage: node .github/scripts/request-meter.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path'); const { pathToFileURL } = require('url');
const ROOT = process.cwd();
const ADMIN_PAGES = ['/core.html', '/programs.html', '/progress.html', '/attendance.html', '/referrals.html', '/kb.html', '/simulators.html', '/simulators/docket.html?program=CM'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const failures = []; const fail = (m) => failures.push(m);
const DAY = 86400000;
const start = Math.floor(Date.now() / DAY) * DAY - 5 * DAY;
const SNAPSHOT = {
    v: 1, at: new Date(Date.now() - 10 * 60000).toISOString(),
    month: { start: new Date(start).toISOString().slice(0, 10), end: new Date(start + 30 * DAY).toISOString().slice(0, 10) },
    total: 2497500, limit: 9990000, included: 10000000, projected: 13600000, paused: false, pausedAt: null,
    sites: [{ kind: 'worker', name: 'ea-pa-training', requests: 1500000 }, { kind: 'pages', name: 'lshtraining-portal', requests: 997500 }], days: {}, notes: [],
    cache: { through: new Date(start).toISOString(), scripts: [], days: {} }
};

async function functionChecks() {
    const { onRequestGet } = await import(pathToFileURL(path.join(ROOT, 'functions/api/request-budget.js')).href);
    const { createSessionToken } = await import(pathToFileURL(path.join(ROOT, 'functions/_utils.js')).href);
    // D1 as requireSession reads it: the site isn't locked, the heartbeat is fresh, the account is approved.
    const DB = { prepare: (sql) => { const st = { bind: () => st, first: async () => /site_state/.test(sql) ? { locked: 0, paused: 0 } : /heartbeats/.test(sql) ? { ok: 1 } : /FROM users/.test(sql) ? { status: 'Approved' } : null }; return st; } };
    const store = new Map();
    const env = { SESSION_SECRET: 'ci-secret', DB, COURSE_KV: { get: async (k) => store.has(k) ? store.get(k) : null } };
    const call = async (userType, e = env) => {
        const headers = userType ? { Cookie: 'lsh_session=' + await createSessionToken({ username: 'ci-' + userType.toLowerCase(), userType }, 'ci-secret') } : {};
        const res = await onRequestGet({ request: new Request('http://x/api/request-budget', { headers }), env: e });
        return { status: res.status, body: await res.json().catch(() => null) };
    };
    if ((await call(null)).status !== 401) fail('/api/request-budget answers without signing in');
    if ((await call('Trainee')).status !== 403) fail('/api/request-budget answers a trainee');
    const none = await call('Admin');
    if (none.status !== 200 || !none.body || none.body.ok !== true || none.body.usage !== null) fail(`before the workflow has run: ${JSON.stringify(none)}`);
    const unbound = await call('Admin', Object.assign({}, env, { COURSE_KV: undefined }));
    if (unbound.status !== 200 || !unbound.body || unbound.body.usage !== null) fail(`without the COURSE_KV binding: ${JSON.stringify(unbound)}`);
    store.set('_request-usage', '{not json');
    const bad = await call('Admin');
    if (bad.status !== 200 || !bad.body || bad.body.usage !== null) fail(`with unreadable numbers: ${JSON.stringify(bad)}`);
    store.set('_request-usage', JSON.stringify(SNAPSHOT));
    const some = await call('Admin');
    if (some.status !== 200 || !some.body || some.body.ok !== true || !some.body.usage || some.body.usage.total !== 2497500 || some.body.usage.sites.length !== 2 || 'cache' in some.body.usage) fail(`the month's numbers: ${JSON.stringify(some.body)}`);
}

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/__frame.html') { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); return res.end('<!doctype html><title>A course</title><iframe src="/simulators/docket.html?program=CM" width="1200" height="800"></iframe>'); }
    let f = path.join(ROOT, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});

(async () => {
    await functionChecks();

    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    // A page with the API answered here; who: 'Admin', 'Trainee' or null (signed out).
    async function open(p, who, viewport = { width: 1360, height: 900 }) {
        const page = await browser.newPage({ viewport });
        page.on('pageerror', e => fail(`${p}: page error: ${e.message}`));
        page.on('dialog', d => d.dismiss());
        const asked = [], loaded = [];
        page.on('request', r => { const u = new URL(r.url()); if (u.pathname === '/api/request-budget') asked.push(u.pathname); if (u.pathname === '/request-budget.js') loaded.push(u.pathname); });
        await page.route('**/api/**', route => {
            const u = new URL(route.request().url());
            if (u.pathname === '/api/request-budget') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, usage: Object.assign({}, SNAPSHOT, { cache: undefined }) }) });
            if (u.pathname === '/api/live') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, siteState: { success: true, locked: false, paused: false }, alert: { active: false }, pings: { success: true, pings: [] } }) });
            return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false,"error":"offline test"}' });
        });
        await page.route(/cdn\.tailwindcss\.com/, r => r.fulfill({ contentType: 'text/javascript', body: '' }));
        if (who) await page.addInitScript((t) => sessionStorage.setItem('LSH_SESSION_V1', JSON.stringify({ username: 'ci-user', fullName: 'Ann Trainer', batchId: 'B1', userType: t })), who);
        await page.goto(base + p, { waitUntil: 'load' });
        return { page, asked, loaded };
    }
    const chipOf = (page) => page.evaluate(() => { const c = document.getElementById('rqb-chip'); if (!c) return null; const r = c.getBoundingClientRect(); return { text: c.textContent.replace(/\s+/g, ' ').trim(), cls: c.className, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });

    // an Admin: every admin page shows the meter, after one request
    for (const p of ADMIN_PAGES) {
        const { page, asked } = await open(p, 'Admin');
        await page.waitForSelector('#rqb-chip', { timeout: 5000 }).catch(() => fail(`${p}: an Admin's page doesn't show the meter`));
        await page.waitForTimeout(2500);
        const chip = await chipOf(page);
        if (chip && (!/Requests 25%/.test(chip.text) || !/rqb-warn/.test(chip.cls))) fail(`${p}: an Admin's meter says "${chip.text}" (${chip.cls}); expected 25%, amber (this pace runs out before the month ends)`);
        if (chip && (Math.round(1360 - chip.right) !== 16 || Math.round(900 - chip.bottom) !== 16)) fail(`${p}: the meter isn't in the bottom-right corner: ${JSON.stringify(chip)}`);
        if (asked.length !== 1) fail(`${p}: an Admin's page asked for the meter ${asked.length} times on opening (expected 1)`);
        if (p === '/core.html') {
            await page.click('#rqb-chip');
            const panel = await page.evaluate(() => { const el = document.getElementById('rqb-panel'); return el ? { text: el.textContent, me: (el.querySelector('tr.rqb-me') || {}).textContent || '' } : null; });
            if (!panel || !/2,497,500/.test(panel.text)) fail('the details don\'t show the month\'s total');
            else if (!/Training Portal/.test(panel.me)) fail(`the details don't highlight this portal in the list of sites: "${panel.me}"`);
        }
        await page.close();
    }

    // on a phone the amber meter is wide: it sits above the floating ← Back (bottom left)
    {
        const { page } = await open('/referrals.html', 'Admin', { width: 390, height: 844 });
        await page.waitForTimeout(2500);
        const chip = await chipOf(page);
        const back = await page.evaluate(() => { const b = document.querySelector('.pn-back.pn-float'); if (!b) return null; const r = b.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
        if (!chip || chip.left < 0 || chip.right > 390) fail(`on a phone the meter isn't on the screen: ${JSON.stringify(chip)}`);
        else if (back && chip.left < back.right && chip.right > back.left && chip.top < back.bottom && chip.bottom > back.top) fail(`on a phone the meter covers the ← Back button: ${JSON.stringify({ chip, back })}`);
        await page.close();
    }

    // signed out, a trainee, inside a course's frame: no meter, nothing asked or loaded for it
    for (const [p, who, label] of [['/programs.html', null, 'signed out'], ['/kb.html', null, 'signed out'], ['/core.html', 'Trainee', 'a trainee'], ['/__frame.html', 'Admin', 'inside a course\'s frame']]) {
        const { page, asked, loaded } = await open(p, who);
        await page.waitForTimeout(3000);
        const shown = await Promise.all(page.frames().map(f => f.$('#rqb-chip').then(Boolean).catch(() => false)));
        if (shown.some(Boolean) || asked.length || loaded.length) fail(`${label} (${p}): the meter is ${shown.some(Boolean) ? 'shown' : 'not shown'}, asked for ${asked.length} times, loaded ${loaded.length} times (expected none)`);
        await page.close();
    }

    await browser.close(); server.close();
    if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
    console.log(`Request meter on this site passed (admins only, on the server and on ${ADMIN_PAGES.length} admin pages; one request; the month's numbers).`);
})().catch(e => { console.error(e); process.exit(1); });

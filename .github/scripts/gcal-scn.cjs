// Calendaring Simulators in the Google Calendar look (gcal.html?track=…): the week's fixed events are on the calendar, the tasks are in the
// panel, 🎯 Check my calendar runs calsim-core's review on the trainee's events, and Submit sends the week to /api/calsim.
// Usage: node .github/scripts/gcal-scn.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const failures = []; const fail = (m) => failures.push(m);
// The simulator's "today" (Eastern, a weekend counts as the Monday after) and that week's Monday
const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(new Date());
const get = (t) => parts.find(p => p.type === t).value;
let d = new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`); const wk = get('weekday');
if (wk === 'Sat') d.setUTCDate(d.getUTCDate() + 2); else if (wk === 'Sun') d.setUTCDate(d.getUTCDate() + 1);
const monday = new Date(d); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
const dayStr = (i) => { const x = new Date(monday); x.setUTCDate(x.getUTCDate() + i); return x.toISOString().slice(0, 10); };
const ev = (id, title, i, start, end, extra) => Object.assign({ id, cal: 'lsh', title, date: dayStr(i), start, end, allDay: false, tz: 'America/New_York', repeat: 'none', color: '', location: '', meet: '', desc: 'Prep for the mediation', guests: [], notifs: [], busy: true, vis: 'default' }, extra || {});
let record = { v: 2, drafts: {}, autos: [], submissions: [], reviews: {}, external: [], g: { rivera: { events: [ev('t1', 'Mediation prep: Garcia', 0, '10:00', '11:00'), ev('t2', 'Deposition prep: Wilson', 1, '14:00', '15:30')], done: ['medprep'] } } };
let posted = null; let authed = true;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const chunks = [];
    req.on('data', c => chunks.push(c)); req.on('end', () => {
        if (u.pathname === '/api/calsim') {
            res.writeHead(authed ? 200 : 401, { 'Content-Type': 'application/json' });
            if (!authed) return res.end('{"success":false,"error":"Sign in on the Portal first."}');
            if (req.method === 'POST') { const b = JSON.parse(Buffer.concat(chunks).toString()); posted = b.data; record = Object.assign({}, b.data, { reviews: record.reviews }); return res.end(JSON.stringify({ success: true, reviews: record.reviews })); }
            return res.end(JSON.stringify({ success: true, me: { username: 'ci', name: 'Ci Trainee', batch: 'B1', admin: false }, data: record }));
        }
        if (u.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"success":false,"error":"offline test"}'); }
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
        page.on('pageerror', e => fail(`${url}: page error: ${e.message}`)); page.on('dialog', x => x.dismiss());
        await page.goto(base + url, { waitUntil: 'load' }); await page.waitForTimeout(900);
        return page;
    };
    // 1. the Standard week 1: fixed events, the saved events, the tasks
    let page = await open('/simulators/gcal.html?track=standard&week=rivera');
    const txt = await page.evaluate(() => document.body.innerText);
    if (!/Court hearing: Smith v\. Allied/.test(txt)) fail('the week’s fixed events (the court hearing) are not on the calendar');
    if (!/Mediation prep: Garcia/.test(txt)) fail('the trainee’s saved event is not on the calendar');
    if (!/tasks to schedule/i.test(txt) || !/Settlement call: adjuster/.test(txt)) fail('the tasks panel is not showing');
    const tabs = await page.$$eval('#cs-tabs a', a => a.map(x => x.textContent.trim()));
    if (tabs.length < 6 || !tabs.some(t => /Callers/.test(t)) || !tabs.some(t => /Litigation/.test(t)) || !tabs.some(t => /Executive/.test(t))) fail('the tab strip is missing tabs: ' + JSON.stringify(tabs));
    // 2. check my calendar
    await page.click('#gc-rail [data-a="check"]'); await page.waitForTimeout(500);
    const res = await page.evaluate(() => (document.querySelector('#gc-panel') || {}).innerText || '');
    if (!/your calendar, checked/i.test(res) || !/tasks fully right/.test(res)) fail('the check did not show a result: ' + res.slice(0, 120));
    if (!/Mediation prep: Garcia/.test(res)) fail('the result does not list the tasks');
    // 3. submit
    await page.click('#gc-panel [data-a="scn-submit"]'); await page.waitForTimeout(300);
    const ok = await page.$('.gc-dlg [data-ok]');
    if (!ok) fail('the submit dialog did not open'); else { await ok.click(); await page.waitForTimeout(1500); }
    if (!posted || !posted.submissions || !posted.submissions.length) fail('submitting did not save a submission');
    else {
        const s = posted.submissions[posted.submissions.length - 1];
        if (s.scn !== 'rivera' || !Array.isArray(s.events) || s.events.length !== 2 || !s.auto || typeof s.auto.pct !== 'number') fail('the submission is wrong: ' + JSON.stringify(s).slice(0, 200));
        if (!posted.g || !posted.g.rivera) fail('the calendar itself was not saved with the record');
    }
    await page.close();
    // 4. the other tracks open in the same look
    for (const [u, needle] of [['/simulators/gcal.html?track=litigation', /Litigation/], ['/simulators/gcal.html?track=executive', /Executive/], ['/simulators/gcal.html', /Google Calendar Simulator/]]) {
        const p = await open(u); const t = await p.evaluate(() => document.body.innerText);
        if (!needle.test(t)) fail(`${u}: not showing`); if (!(await p.$('#gc-main'))) fail(`${u}: no calendar`);
        await p.close();
    }
    // 5. signed out
    authed = false; page = await open('/simulators/gcal.html?track=standard');
    if (!/Sign in/.test(await page.evaluate(() => document.body.innerText))) fail('signed out: no sign-in prompt'); await page.close();
    await browser.close(); server.close();
    if (failures.length) { console.error('Calendaring (Google look) test FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
    console.log('Calendaring (Google look) test passed (fixed events, saved events, tasks, check, submit and save, the other tracks, signed out).');
})();

// The trainee's side of the Google Calendar Simulator and its evaluations (simulators/gcal.js, my-evaluations.html, calsim.html, eval-report.js):
//  - the calendar saved to their account never overwrites a newer copy (another tab or device): the save carries the copy it was made from, a 409 says
//    so and offers the newer one; opening a panel or a view is not a change and is not sent;
//  - Standard Training's "today" is today, not the day the calendar was first made;
//  - a big calendar is trimmed so it still submits (the automated check stays);
//  - the evaluations list and the report say which track they are for, and the PDF is stamped with it;
//  - the PDF keeps accented letters and turns thin/non-breaking spaces into spaces;
//  - the Calendaring Simulators cards show the track's evaluation and its state;
//  - a trainer opening a trainee's calendar in a NEW TAB (no copy of the session in the tab) sees it.
// Usage: node .github/scripts/gcal-trainee-side.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const failures = []; const fail = (m) => failures.push(m);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let who = 'trainee', draftPosts = [], newer = false, serverDraft = null;
const ME = { trainee: { username: 'ci', fullName: 'Ci Trainee', userType: 'Trainee', batchId: 'B1' }, admin: { username: 'boss', fullName: 'Trainer Bo', userType: 'Admin' } };
const FINAL = { id: 9, username: 'ci', name: 'José Muñoz', batch: 'B1', track: 'cm', submittedAt: '2026-10-06T12:00:00.000Z', checkScore: 70, status: 'final', aiStatus: 'done', finalizedAt: '2026-10-06T14:00:00.000Z', finalizedBy: 'Trainer Bo',
    ai: { summary: 'Good.', correct: ['a'], improve: ['b'], missed: ['c'] }, trainer: { notes: 'Fine.', points: [], score: 88 }, calendar: { automatedCheck: { results: [] } } };
const WAITING = { id: 10, username: 'ci', name: 'Ci Trainee', batch: 'B1', track: 'standard', submittedAt: '2026-10-06T13:00:00.000Z', checkScore: 40, status: 'submitted', aiStatus: 'done' };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), chunks = [];
    req.on('data', c => chunks.push(c)); req.on('end', () => {
        const send = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
        const body = () => { try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch (e) { return {}; } };
        if (u.pathname === '/api/me') return send({ success: true, user: ME[who] });
        if (u.pathname === '/api/gcal-reviews') {
            if (req.method === 'POST') { const b = body(); if (b.action === 'draft') { draftPosts.push(b); return newer ? send({ success: false, code: 'DRAFT_NEWER', error: 'newer', updatedAt: '2030-01-01T00:00:00.000Z' }, 409) : send({ success: true, updatedAt: '2026-10-06T16:00:00.000Z' }); } return send({ success: true, id: 1 }); }
            if (u.searchParams.get('draft') != null) { if (u.searchParams.get('user')) return send({ success: true, data: serverDraft, updatedAt: '2026-10-06T10:00:00.000Z', person: { name: 'Ci Trainee', batch: 'B1' } }); return send({ success: true, data: serverDraft, updatedAt: '2026-10-06T10:00:00.000Z' }); }
            return send({ success: true, reviews: who === 'trainee' ? [WAITING, FINAL] : [] });
        }
        if (u.pathname === '/api/calsim') return send({ success: true, me: { username: ME[who].username, name: ME[who].fullName, batch: 'B1', admin: who === 'admin' }, data: null, person: { name: 'Ci Trainee', batch: 'B1' } });
        if (u.pathname.startsWith('/api/')) return send({ success: false, error: 'offline test' });
        const f = path.join(ROOT, decodeURIComponent(u.pathname));
        if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
    });
});
(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const open = async (url, init) => {
        const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
        if (init) await page.addInitScript(init);
        page.on('pageerror', e => fail(`${url}: page error: ${e.message}`)); page.on('dialog', x => x.accept());
        await page.goto(base + url, { waitUntil: 'load' }); await page.waitForTimeout(1200);
        return page;
    };
    const panel = (p) => p.evaluate(() => (document.querySelector('#gc-panel') || {}).innerText || '');
    // 1. today follows the calendar (Standard Training), whatever day the saved calendar was made
    who = 'trainee'; serverDraft = null; draftPosts = []; newer = false;
    const old = { v: 1, today: '2020-01-01', view: 'week', anchor: '2020-01-01', mini: '2020-01', side: true, panel: 'requests', hidden: {}, set: { dur: 30, weekends: false, tz2: false }, events: [], ex: {}, sx: {}, reqs: [], result: null, savedAt: 1 };
    let page = await open('/simulators/gcal.html', `try { localStorage.setItem('lsh_gcal:ci trainee', ${JSON.stringify(JSON.stringify(old))}); } catch (e) {}`);
    const td = await page.evaluate(() => ({ today: window.GCAL.simToday(), text: (document.querySelector('#gc-panel') || {}).innerText || '' }));
    if (/2020/.test(td.text) || !td.text) fail('Standard Training still says today is the day the calendar was made: ' + td.text.slice(0, 160));
    // 2. opening a panel is not a change: nothing is sent
    await sleep(3600);   // (a calendar newer than the saved one is sent once when the page opens: let that finish)
    const before = draftPosts.length;
    await page.click('[data-a="panel"][data-p="rules"]').catch(() => {}); await sleep(3600);
    if (draftPosts.length !== before) fail('opening a panel sent the calendar to the account as a change');
    // 3. a saved copy newer than the one this tab was made from is not overwritten
    newer = true; draftPosts = [];
    await page.evaluate(() => { document.querySelector('[data-a="cloud-save"]').click(); }); await sleep(800);
    const cloud = await page.evaluate(() => (document.getElementById('gc-cloud') || {}).innerText || '');
    if (!/newer copy/i.test(cloud)) fail('a refused save (409 DRAFT_NEWER) is not explained: ' + cloud);
    if (!draftPosts.length || !('base' in draftPosts[0])) fail('the save does not say which copy it was made from: ' + JSON.stringify(draftPosts[0] && Object.keys(draftPosts[0])));
    if (!(await page.$('[data-a="cloud-newer"]'))) fail('no way to open the newer copy');
    // 4. a big calendar is trimmed, the check stays
    const tp = await page.evaluate(() => { const apps = Array.from({ length: 300 }, (_, i) => ({ title: 'Appt ' + i, description: 'x'.repeat(3000), guests: ['a@b.c', 'd@e.f', 'g@h.i', 'j@k.l', 'm@n.o', 'p@q.r', 's@t.u'] }));
        const p = { track: 'standard', calendar: { week: { events: Array.from({ length: 500 }, (_, i) => ({ t: 'E' + i })) }, appointments: apps, automatedCheck: { results: [{ request: 'r', met: ['a'], missed: [] }] } } };
        const o = window.GCAL.trimPayload(p); return { len: JSON.stringify(o).length, check: o.calendar.automatedCheck.results.length }; });
    if (tp.len > 200000 || tp.check !== 1) fail('a big calendar is not trimmed under the limit with its check: ' + JSON.stringify(tp));
    // 5. the evaluations say which track they are for; the PDF carries it
    newer = false;
    await page.click('[data-a="evals"]'); await sleep(900);
    const ev = await panel(page);
    if (!/Litigation Week/.test(ev) || !/Standard Training/.test(ev)) fail('the evaluations list does not say which track each one is: ' + ev.slice(0, 300));
    await page.close();
    // 6. PDF text: accents kept, thin and non-breaking spaces become spaces
    page = await open('/simulators/my-evaluations.html');
    const pdf = await page.evaluate(() => { const out = []; window.jspdf = { jsPDF: function () { return { setFont() {}, setFontSize() {}, setTextColor() {}, splitTextToSize: (s) => [s], text: (s) => out.push(s), addPage() {}, save() {} }; } };
        EvalReport.pdf({ name: 'José Muñoz', batch: 'B1', submittedAt: '2026-10-06T12:00:00.000Z', finalizedAt: '2026-10-06T14:00:00.000Z', finalizedBy: 'Trainer', checkScore: 70, ai: { summary: 'Mon 9:00 AM – 10:00 AM, café', correct: [], improve: [], missed: [] }, trainer: { notes: '', points: [] } }, 'Litigation Week · Case Management', alert); return out.join('\n'); });
    if (!/José Muñoz/.test(pdf) || !/9:00 AM - 10:00 AM, café/.test(pdf) || !/Litigation Week/.test(pdf)) fail('the PDF text lost accents or spaces, or the track: ' + pdf.slice(0, 300));
    await page.close();
    // 7. the Calendaring Simulators cards show the track's evaluation
    page = await open('/simulators/calsim.html');
    const cards = await page.evaluate(() => [...document.querySelectorAll('.cs-review')].map(e => e.innerText.replace(/\s+/g, ' ').trim()));
    if (!cards.some(c => /Evaluation: submitted/.test(c) && /with your trainer/.test(c)) || !cards.some(c => /Evaluation: submitted/.test(c) && /final report sent/.test(c) && /88\/100/.test(c))) fail('the cards do not show each track’s evaluation: ' + JSON.stringify(cards));
    await page.close();
    // 8. a trainer opening a trainee's calendar in a NEW TAB (the tab has no copy of the session, only the cookie)
    who = 'admin'; serverDraft = { v: 1, events: [], savedAt: 5 };
    page = await open('/simulators/gcal.html?trainee=ci');
    const t = await panel(page);
    if (!/Trainee’s calendar|read only/i.test(t)) fail('a trainee’s calendar opened in a new tab shows no content: ' + t.slice(0, 200));
    await page.close();
    // the Calendaring Simulators page has a Trainee Evaluations button for a trainer, a pill like Earlier scheduler scores, in the same tab
    who = 'admin';
    page = await open('/simulators/calsim.html');
    const eb = await page.$$eval('#cs-evals', as => as.map(a => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), cls: a.className, text: a.innerText.trim() })));
    if (eb.length !== 1 || eb[0].href !== '/simulators/gcal-review.html' || eb[0].target || !/sim-btn ghost/.test(eb[0].cls) || !/Trainee Evaluations/.test(eb[0].text)) fail('the Calendaring Simulators page has no Trainee Evaluations button for a trainer: ' + JSON.stringify(eb));
    await page.click('#cs-evals'); await page.waitForURL(/gcal-review\.html/, { timeout: 5000 }).catch(() => fail('the Trainee Evaluations button did not open the page: ' + page.url()));
    await page.close();
    who = 'trainee'; page = await open('/simulators/calsim.html');
    if (await page.$('#cs-evals')) fail('a trainee sees the trainers’ Trainee Evaluations button');
    await page.close();
    // 9. a trainer's "Trainee evaluations" in the simulator goes to the Trainee Evaluations page, in the same tab, as a plain link
    who = 'admin';
    page = await open('/simulators/gcal.html?track=cm');
    const lk = await page.$$eval('#gc-rail a.rb', as => as.map(a => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), text: a.innerText.trim() })));
    if (lk.length !== 1 || lk[0].href !== '/simulators/gcal-review.html?track=cm' || lk[0].target || !/Trainee evaluations/.test(lk[0].text)) fail('a trainer\'s Trainee evaluations is not a plain link to the Trainee Evaluations page: ' + JSON.stringify(lk));
    await page.click('#gc-evals-link'); await page.waitForURL(/gcal-review\.html\?track=cm/, { timeout: 5000 }).catch(() => fail('Trainee evaluations did not go to the Trainee Evaluations page: ' + page.url()));
    await page.close();
    await browser.close(); server.close();
    if (failures.length) { console.error('FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
    console.log('Trainee side test passed (a trainer’s Trainee evaluations link goes to the Trainee Evaluations page, today follows the calendar, a newer saved copy is never overwritten, panels aren’t changes, big calendars trim, tracks named, PDF accents, cards show the evaluation, a trainee’s calendar opens in a new tab).');
})();

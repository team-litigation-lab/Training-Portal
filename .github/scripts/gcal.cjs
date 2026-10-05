// Google Calendar Simulator (simulators/gcal.html, gcal.js, gcal-data.js; functions/api/gcal-schedule.js),
// in a browser, with the APIs answered in memory.
// Checks:
//   - the attorney's week: the owner's Monday–Friday list (Gerald Anderson … Aretha Franklin) with the daily blocks,
//     the same every week; every move/cancel request points at one of its appointments;
//   - every request can be done under the rules from any weekday, alone and as a dealt set of 7 (5 book, 1 move,
//     1 cancel);
//   - the check: a plan made the right way scores 100; the wrong calendar, title, time zone, slot (lunch, a
//     double-booking, no buffer, a Wednesday new-client consult), the caller's times, length, meeting type,
//     description, reminder each cost points with a reason; moving instead of cancelling, cancelling every
//     week, and changing an appointment nobody asked about too;
//   - the page: quick create, the event page (Google Meet, location, description, an email reminder a day
//     before, the Attorney's Calendar), the event card and the mock Google Meet, drag to move, delete and undo,
//     moving one week of the attorney's appointment ("This event"), Month / Schedule / search, Check my calendar
//     (saved as 'Google Calendar'), the rules panel; no sideways scroll on a phone;
//   - an Admin edits the weekly schedule for everyone (saved through /api/gcal-schedule; a trainee then sees
//     it), and restores it; a trainee can't change it (the API refuses).
// Usage: node .github/scripts/gcal.cjs   (from the repository root; needs playwright)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path'); const { pathToFileURL } = require('url');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
let saved = null; const results = []; const puts = [];
const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const body = () => new Promise(r => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); });
    const admin = /role=admin/.test(req.headers.cookie || '');
    if (u.pathname === '/api/gcal-schedule') {
        if (req.method === 'GET') return send(200, { success: true, rows: saved });
        if (!admin) return send(403, { success: false, error: 'Admins only.' });
        if (req.method === 'PUT') { const b = await body(); const mod = await import(pathToFileURL(path.join(ROOT, 'functions/api/gcal-schedule.js')).href); const c = mod.cleanRows(b.rows); if (c.error) return send(400, { success: false, error: c.error }); saved = c.rows; puts.push(c.rows); return send(200, { success: true, rows: saved }); }
        if (req.method === 'DELETE') { saved = null; return send(200, { success: true }); }
    }
    if (u.pathname === '/api/sim-results' && req.method === 'POST') { results.push(await body()); return send(200, { success: true }); }
    if (u.pathname.startsWith('/api/')) return send(200, { success: false, error: 'offline test' });
    let f = path.join(ROOT, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});

(async () => {
    const failures = []; const fail = (m) => failures.push(m);
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const shot = async (page, name) => { if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, name + '.png') }); };
    async function open(opts = {}) {
        const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 1000 } });
        if (opts.admin) await ctx.addCookies([{ name: 'role', value: 'admin', url: base }]);
        const page = await ctx.newPage();
        page.on('pageerror', e => fail(`page error: ${e.message}`));
        page.on('dialog', d => d.accept('https://example.com'));
        await page.addInitScript((a) => {
            localStorage.setItem('LSH_SIM_WHO', JSON.stringify({ name: a.name, batch: 'B100526', program: 'FT' }));
            if (a.admin) sessionStorage.setItem('LSH_SESSION_V1', JSON.stringify({ username: 'trainer', fullName: 'CI Trainer', userType: 'Admin' }));
        }, { name: opts.name || 'CI Trainee', admin: !!opts.admin });
        await page.goto(base + '/simulators/gcal.html?program=FT', { waitUntil: 'load' });
        await page.waitForSelector('#gc-main .wk-col, #gc-main .ag', { timeout: 10000 });
        await page.waitForTimeout(400);
        return page;
    }

    /* ---------- 1. the week, the requests, the rules ---------- */
    let page = await open();
    const data = await page.evaluate(() => ({ rows: GCAL_ATTORNEY, reqs: GCAL_REQUESTS }));
    const titles = data.rows.map(r => r.title);
    for (const t of ['Deposition Preparation: Gerald Anderson', 'Client Consultation: New PI Case - Jenny Miller', 'Discovery Conference: Ramon Magsaysay', 'Document Signing: Aretha Franklin'])
        if (!titles.includes(t)) fail(`the week is missing ${t}`);
    const appts = data.rows.filter(r => r.type !== 'Blocked Time');
    if (appts.length !== 21 || data.rows.length !== 41) fail(`the week should have 21 appointments and 4 daily blocks a day (${appts.length}, ${data.rows.length} rows)`);
    const gerald = data.rows.find(r => r.title === 'Deposition Preparation: Gerald Anderson');
    if (!gerald || gerald.wd !== 1 || gerald.start !== '09:00' || gerald.end !== '09:45' || !/CB Number: 805-123-4567/.test(gerald.notes) || !/DOL: May 20, 2025/.test(gerald.notes)) fail(`Gerald Anderson: Monday 9:00–9:45 with his note: ${JSON.stringify(gerald)}`);
    for (let d = 1; d <= 5; d++) for (const [t, s] of [['No Schedule Block', '00:00'], ['Daily Case and Email Review', '08:00'], ['Lunch Break', '12:00'], ['No Schedule Block', '17:00']])
        if (!data.rows.some(r => r.wd === d && r.title === t && r.start === s)) fail(`day ${d} is missing ${t} at ${s}`);
    data.reqs.filter(r => r.seed).forEach(r => { if (!data.rows.some(x => x.id === r.seed)) fail(`request ${r.id} points at a missing appointment (${r.seed})`); });
    // every request can be done, from any weekday; dealt sets too
    const solv = await page.evaluate(() => {
        const out = [], mon = GCAL.weekStart('2026-10-05', true);
        for (let i = 0; i < 5; i++) {
            const today = GCAL.addDays(mon, i);
            GCAL_REQUESTS.forEach(R => {
                const q = GCAL.concretize(R, today);
                if (!q || !(q.dates || q.orig)) { out.push(`${R.id} has no date from ${today}`); return; }
                if (R.kind !== 'cancel' && !GCAL.solve([q], today)) out.push(`${R.id} can't be done from ${today}`);
            });
            for (let k = 0; k < 6; k++) {
                const set = GCAL.dealRequests(today), kinds = set.map(q => GCAL_REQUESTS.find(r => r.id === q.id).kind);
                if (set.length !== 7 || kinds.filter(x => x === 'book').length !== 5 || !kinds.includes('move') || !kinds.includes('cancel')) out.push(`a dealt set from ${today}: ${kinds.join(',')}`);
                else if (!GCAL.solve(set, today)) out.push(`a dealt set from ${today} can't be done`);
            }
        }
        return out;
    });
    solv.forEach(fail);

    /* ---------- 2. the check ---------- */
    const grading = await page.evaluate(() => {
        const today = '2026-10-05', out = {};
        const ids = ['new-ashford', 'drf-lee', 'sign-jackson', 'urgent-beauchamp', 'apc-reed', 'move-charles', 'cancel-bell'];
        const reqs = ids.map(id => GCAL.concretize(GCAL_REQUESTS.find(r => r.id === id), today));
        const plan = GCAL.solve(reqs, today);
        const st = { events: [], ex: {}, sx: {} };
        reqs.forEach(q => {
            const R = GCAL_REQUESTS.find(r => r.id === q.id);
            if (R.kind === 'cancel') { st.ex[`s:${q.row}@${q.orig}`] = { del: true }; return; }
            const e = plan[q.id];
            if (R.kind === 'move') { st.ex[`s:${q.row}@${q.orig}`] = { date: e.date, start: e.start, end: e.end }; return; }
            const [m, d, y] = R.dob.split('/');
            st.events.push({ id: 'ev-' + q.id, cal: 'attorney', title: `${R.type} – ${R.name}`, date: e.date, start: e.start, end: e.end, allDay: false, tz: 'America/New_York', repeat: 'none',
                location: R.meeting === 'office' ? GCAL_OFFICE : R.meeting === 'phone' ? 'Phone' : '', meet: R.meeting === 'video' ? 'abc-defg-hij' : '',
                desc: `Name: ${R.name}<br>CB Number: ${R.cb}<br>DOB: ${R.dob}<br>DOL: ${R.dol}<br>Notes: ${R.notesNeed.map(g => g[0]).join(', ')}`, guests: [], notifs: [{ m: 'email', v: 1, u: 'days' }], busy: true });
            void m; void d; void y;
        });
        const good = GCAL.checkPlan(st, reqs, today);
        out.good = { score: good.score, missed: good.results.flatMap(r => r.items.filter(i => !i.ok).map(i => r.head + ': ' + i.t)) };
        // mistakes on the first booking
        const first = st.events[0], R0 = GCAL_REQUESTS.find(r => r.id === reqs[0].id);
        const bad = JSON.parse(JSON.stringify(st)), b0 = bad.events[0];
        b0.cal = 'lsh'; b0.title = 'Consult ' + R0.name; b0.tz = 'Asia/Manila'; b0.notifs = [{ m: 'popup', v: 1, u: 'days' }, { m: 'email', v: 30, u: 'minutes' }]; /* a popup a day before and an email 30 minutes before aren't an email a day before */ b0.desc = 'Name: ' + R0.name; b0.meet = 'abc-defg-hij';
        b0.date = GCAL.addDays(GCAL.weekStart(first.date, true), 16); b0.start = '12:15'; b0.end = '13:15';   // a Wednesday two weeks on: out of the caller's days
        const r1 = GCAL.checkPlan(bad, reqs, today).results[0];
        out.bad = { pts: r1.pts, missed: r1.items.filter(i => !i.ok).map(i => i.t) };
        // a move made a cancellation; the cancellation done for every week; an appointment nobody asked about moved
        const odd = JSON.parse(JSON.stringify(st));
        const mv = reqs.find(q => q.id === 'move-charles'), cn = reqs.find(q => q.id === 'cancel-bell');
        odd.ex[`s:${mv.row}@${mv.orig}`] = { del: true };
        delete odd.ex[`s:${cn.row}@${cn.orig}`]; odd.sx[cn.row] = { del: true };
        odd.ex['s:mon-anderson@2026-10-12'] = { start: '10:00', end: '10:45' };
        const r2 = GCAL.checkPlan(odd, reqs, today);
        out.odd = { score: r2.score, penalty: r2.penalty, extra: r2.extra, move: r2.results.find(r => r.id === 'move-charles'), cancel: r2.results.find(r => r.id === 'cancel-bell') };
        return out;
    });
    if (grading.good.score !== 100) fail(`a plan made the right way should score 100 (got ${grading.good.score}): ${grading.good.missed.join(' | ')}`);
    const miss = grading.bad.missed.join(' | ');
    for (const re of [/not the Attorney’s Calendar/, /title should be/, /time zone/i, /Lunch Break/, /Tuesdays and Thursdays/, /isn’t a time the caller can do/, /Length/, /phone only|remove the Google Meet/, /description is missing/, /email notification/])
        if (!re.test(miss)) fail(`a booking with mistakes should be marked for ${re}: ${miss}`);
    if (grading.bad.pts > 1.5) fail(`a booking with every mistake should score almost nothing (${grading.bad.pts})`);
    if (!grading.odd.move || grading.odd.move.pts > 3 || !grading.odd.cancel || grading.odd.cancel.pts !== 5 || grading.odd.penalty !== 5 || !/Gerald Anderson/.test(grading.odd.extra.join()))
        fail(`a move made a deletion, a cancellation for every week, and an unasked change: ${JSON.stringify(grading.odd).slice(0, 400)}`);

    /* ---------- 3. the page ---------- */
    const S = () => page.evaluate(() => JSON.parse(localStorage.getItem('lsh_gcal:ci trainee')));
    let st = await S();
    const mon = await page.evaluate(() => GCAL.weekStart(GCAL.simToday(), true));
    await page.evaluate((d) => { const s = JSON.parse(localStorage.getItem('lsh_gcal:ci trainee')); s.anchor = d; s.view = 'week'; s.panel = 'requests'; localStorage.setItem('lsh_gcal:ci trainee', JSON.stringify(s)); }, mon);
    await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#gc-main .wk-col'); await page.waitForTimeout(300);
    await shot(page, 'gcal-1-week');
    const grid = await page.evaluate(() => [...document.querySelectorAll('#gc-main .ev b')].map(b => b.textContent));
    for (const t of ['Deposition Preparation: Gerald Anderson', 'Lunch Break', 'Daily Case and Email Review', 'Document Signing: Aretha Franklin']) if (!grid.includes(t)) fail(`the week grid is missing ${t}`);
    const panel = await page.textContent('#gc-panel');
    if (!/Calendar requests/.test(panel) || (await page.locator('#gc-panel .rq').count()) !== 7) fail('the requests panel should list the 7 requests');
    // quick create: click Wednesday 1:00 PM in this week (a free slot)
    const wed = await page.evaluate((m) => GCAL.addDays(m, 2), mon);
    const colBox = await page.locator(`#gc-main .wk-col[data-d="${wed}"]`).boundingBox();
    await page.evaluate(() => { document.getElementById('wk-scroll').scrollTop = 13 * 48; });
    const colBox2 = await page.locator(`#gc-main .wk-col[data-d="${wed}"]`).boundingBox();
    await page.mouse.click(colBox2.x + colBox2.width / 2, colBox2.y + 13.2 * 48);
    await page.waitForSelector('#q-title');
    void colBox;
    await page.fill('#q-title', 'Practice: quick event');
    await page.click('.gc-pop button:has-text("Save")'); await page.waitForTimeout(300);
    st = await S();
    const quick = st.events.find(e => e.title === 'Practice: quick event');
    if (!quick || quick.date !== wed || quick.start !== '13:00' || quick.end !== '13:30' || quick.cal !== 'lsh') fail(`a click on Wednesday 1:00 PM should make a 30-minute event on your LSH Calendar: ${JSON.stringify(quick)}`);
    // the event page: an Urgent-style booking with Meet, location, description, an email reminder a day before, on the Attorney's Calendar
    await page.click('.gc-create'); await page.waitForSelector('#ed-title');
    await page.fill('#ed-title', 'Document Review Follow-Up – Marcus Lee');
    const thu = await page.evaluate((m) => GCAL.addDays(m, 3), mon);
    await page.fill('#ed-date', thu); await page.dispatchEvent('#ed-date', 'change');
    await page.selectOption('#ed-start', '13:15'); await page.dispatchEvent('#ed-start', 'change');
    await page.selectOption('#ed-end', '13:45');
    await page.click('[data-a="ed-meet"]');
    if (!(await page.locator('.meetbox .join').count())) fail('Add Google Meet video conferencing should add a Meet link');
    await page.fill('#ed-loc', 'Google Meet');
    await page.click('#ed-desc'); await page.keyboard.type('Name: Marcus Lee\nCB Number: (555) 010-6660\nDOB: 05/19/2000\nDOL: 09/05/2026\nReview the wage-loss letter and ER bills.');
    await page.click('[data-a="ed-ntf"]');
    await page.selectOption('[data-ntf="1"] .n-m', 'email'); await page.fill('[data-ntf="1"] .n-v', '1'); await page.selectOption('[data-ntf="1"] .n-u', 'days');
    await page.selectOption('#ed-cal', 'attorney');
    await page.fill('#ed-guest', 'marcus.lee@example.com'); await page.press('#ed-guest', 'Enter');
    await shot(page, 'gcal-2-editor');
    await page.click('[data-a="ed-save"]'); await page.waitForTimeout(300);
    st = await S();
    const lee = st.events.find(e => /Marcus Lee/.test(e.title));
    if (!lee || lee.cal !== 'attorney' || lee.date !== thu || lee.start !== '13:15' || lee.end !== '13:45' || !/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(lee.meet) || !/ER bills/.test(lee.desc)
        || !lee.notifs.some(n => n.m === 'email' && +n.v === 1 && n.u === 'days') || lee.guests[0] !== 'marcus.lee@example.com') fail(`the event page should save every field: ${JSON.stringify(lee)}`);
    // the event card and the mock Google Meet
    await page.click(`#gc-main .ev:has-text("Marcus Lee")`); await page.waitForSelector('.gc-pop [data-a="join"]');
    const card = await page.textContent('.gc-pop');
    if (!/Join with Google Meet/.test(card) || !/1 day before, as email/.test(card) || !/marcus\.lee@example\.com/.test(card) || !/ER bills/.test(card)) fail(`the event card should show Meet, the reminder, the guest and the description: ${card.slice(0, 200)}`);
    await page.click('.gc-pop [data-a="join"]'); await page.waitForSelector('.meet');
    if (!/Ready to join\?/.test(await page.textContent('.meet'))) fail('the mock Google Meet should open on "Ready to join?"');
    await page.click('.meet [data-m="join"]'); await page.waitForTimeout(200);
    await shot(page, 'gcal-3-meet');
    if (!(await page.locator('.meet [data-m="leave"]').count())) fail('in the mock Meet there should be a Leave call button');
    await page.click('.meet [data-m="leave"]'); if (!/You left the meeting/.test(await page.textContent('.meet'))) fail('leaving the mock Meet should say so');
    await page.click('.meet [data-m="x"]');
    // drag the quick event to Friday, 15 minutes earlier (12:45 PM)
    const fri = await page.evaluate((m) => GCAL.addDays(m, 4), mon);
    const ev = await page.locator('#gc-main .ev:has-text("Practice: quick event")').boundingBox();
    const friBox = await page.locator(`#gc-main .wk-col[data-d="${fri}"]`).boundingBox();
    await page.mouse.move(ev.x + ev.width / 2, ev.y + 4); await page.mouse.down();
    await page.mouse.move(friBox.x + friBox.width / 2, ev.y + 4 - 0.25 * 48, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
    st = await S();
    const moved = st.events.find(e => e.title === 'Practice: quick event');
    if (!moved || moved.date !== fri || moved.start !== '12:45' || moved.end !== '13:15') fail(`dragging an event should move it (to Friday 12:45 PM): ${JSON.stringify(moved)}`);
    // delete, then undo
    await page.click('#gc-main .ev:has-text("Practice: quick event")'); await page.click('.gc-pop [data-a="d-del"]'); await page.waitForTimeout(200);
    if ((await S()).events.some(e => e.title === 'Practice: quick event')) fail('🗑 Delete should delete the event');
    await page.click('.gc-snack [data-a="undo"]'); await page.waitForTimeout(200);
    if (!(await S()).events.some(e => e.title === 'Practice: quick event')) fail('Undo should bring a deleted event back');
    // one week of the attorney's appointment: Rupaul Charles from Friday 1 PM to Thursday 1:30 PM ("This event")
    const rup = await page.evaluate((f) => `s:fri-charles@${f}`, fri);
    await page.click(`#gc-main .ev[data-iid="${rup}"]`); await page.click('.gc-pop [data-a="d-edit"]'); await page.waitForSelector('#ed-title');
    await page.fill('#ed-date', thu); await page.dispatchEvent('#ed-date', 'change');
    await page.selectOption('#ed-start', '13:30'); await page.dispatchEvent('#ed-start', 'change');
    await page.click('[data-a="ed-save"]'); await page.waitForSelector('.gc-dlg');
    if (!/This event/.test(await page.textContent('.gc-dlg'))) fail('changing the attorney\'s appointment should ask This event / All events');
    await page.click('.gc-dlg [data-ok]'); await page.waitForTimeout(300);
    st = await S();
    if (!st.ex[rup] || st.ex[rup].date !== thu || st.ex[rup].start !== '13:30' || st.ex[rup].end !== '14:00' || Object.keys(st.sx).length) fail(`"This event" should move this week's only: ${JSON.stringify(st.ex[rup])}`);
    const nextFri = await page.evaluate((f) => GCAL.addDays(f, 7), fri);
    if (!(await page.evaluate((d) => GCAL.instancesOf(JSON.parse(localStorage.getItem('lsh_gcal:ci trainee')), d, d).some(e => e.title.includes('Rupaul') && e.start === '13:00'), nextFri))) fail('next week\'s Rupaul Charles call should still be Friday at 1');
    // other views and search
    await page.click('[data-a="views"]'); await page.click('[data-a="view"][data-v="month"]'); await page.waitForSelector('.mo');
    await shot(page, 'gcal-4-month');
    await page.click('[data-a="views"]'); await page.click('[data-a="view"][data-v="agenda"]'); await page.waitForSelector('.ag');
    if (!/Gerald Anderson|Jenny Miller|Derek Shepherd|Magic Johnson|Harley Davidson/.test(await page.textContent('.ag'))) fail('the Schedule view should list the appointments');
    await page.click('[data-a="search"]'); await page.fill('#gc-q', 'magsaysay'); await page.waitForTimeout(200);
    if (!/Discovery Conference: Ramon Magsaysay/.test(await page.textContent('#gc-main'))) fail('search should find Ramon Magsaysay');
    await page.click('[data-a="search-x"]'); await page.click('[data-a="views"]'); await page.click('[data-a="view"][data-v="week"]');
    // the rules, then Check my calendar
    await page.click('[data-a="panel"][data-p="rules"]');
    if (!/New client consults are only scheduled on Tuesdays and Thursdays/.test(await page.textContent('#gc-panel'))) fail('the rules panel should list the attorney\'s rules');
    await page.click('#gc-rail [data-a="check"]'); await page.waitForSelector('.res-ring');
    await shot(page, 'gcal-5-checked');
    const res = results[results.length - 1];
    if (!res || res.simulator !== 'Google Calendar' || typeof res.score !== 'number' || !res.who || res.who.name !== 'CI Trainee') fail(`Check my calendar should save the score: ${JSON.stringify(res).slice(0, 200)}`);
    await page.close();

    // a phone: no sideways scroll
    page = await open({ viewport: { width: 390, height: 844 } });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) fail('on a phone the page scrolls sideways');
    await shot(page, 'gcal-6-phone');
    await page.close();

    /* ---------- 4. an Admin edits the weekly schedule ---------- */
    page = await open({ admin: true, name: 'CI Trainer' });
    await page.evaluate((d) => { const k = 'lsh_gcal:ci trainer'; const s = JSON.parse(localStorage.getItem(k)); s.anchor = d; s.view = 'week'; localStorage.setItem(k, JSON.stringify(s)); }, mon);
    await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#gc-main .wk-col');
    await page.click('[data-a="settings"]'); await page.click('[data-a="admin-edit"]'); await page.waitForSelector('.adm');
    await page.click(`#gc-main .ev[data-iid="s:mon-anderson@${mon}"]`); await page.click('.gc-pop [data-a="d-edit"]'); await page.waitForSelector('#ed-title');
    await page.fill('#ed-title', 'Deposition Preparation: Gerald Anderson (room 2)');
    await page.selectOption('#ed-start', '09:15'); await page.dispatchEvent('#ed-start', 'change');
    await page.click('[data-a="ed-save"]'); await page.waitForTimeout(400);
    if (await page.locator('.gc-dlg').count()) fail('an Admin editing the schedule shouldn\'t be asked This event / All events');
    const last = puts[puts.length - 1] || [];
    const ga = last.find(r => r.id === 'mon-anderson');
    if (!ga || ga.title !== 'Deposition Preparation: Gerald Anderson (room 2)' || ga.start !== '09:15' || ga.end !== '10:00') fail(`the Admin's edit should be saved for everyone: ${JSON.stringify(ga)}`);
    await shot(page, 'gcal-7-admin');
    // a trainee now sees it
    const tp = await open();
    await tp.evaluate((d) => { const s = JSON.parse(localStorage.getItem('lsh_gcal:ci trainee')); s.anchor = d; s.view = 'week'; localStorage.setItem('lsh_gcal:ci trainee', JSON.stringify(s)); }, mon);
    await tp.reload({ waitUntil: 'load' }); await tp.waitForSelector('#gc-main .wk-col'); await tp.waitForTimeout(500);
    if (!(await tp.locator('#gc-main .ev:has-text("Gerald Anderson (room 2)")').count())) fail('a trainee should see the Admin\'s change to the weekly schedule');
    const refused = await tp.evaluate(async () => (await fetch('/api/gcal-schedule', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: [] }) })).status);
    if (refused !== 403) fail(`a trainee changing the weekly schedule should be refused (${refused})`);
    await tp.close();
    // restore
    await page.click('[data-a="admin-reset"]'); await page.click('.gc-dlg [data-ok]'); await page.waitForTimeout(300);
    if (saved !== null || !(await page.locator('#gc-main .ev:has-text("Deposition Preparation: Gerald Anderson")').count())) fail('Restore the original should bring the schedule back for everyone');
    await page.close();

    /* ---------- the clones: Case Management (Litigation Week) and EA / PA (Executive Week), gcal.html?track=cm|ea ---------- */
    for (const track of ['cm', 'ea']) {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        const tp = await ctx.newPage();
        tp.on('pageerror', e => fail(`${track}: page error: ${e.message}`));
        await tp.addInitScript(() => localStorage.setItem('LSH_SIM_WHO', JSON.stringify({ name: 'CI Trainee', batch: 'B100526', program: 'FT' })));
        await tp.goto(base + '/simulators/gcal.html?program=FT&track=' + track, { waitUntil: 'load' });
        await tp.waitForSelector('#gc-main .wk-col, #gc-main .ag', { timeout: 10000 }); await tp.waitForTimeout(400);
        const r = await tp.evaluate(() => {
            const probs = [], mon = GCAL.weekStart('2026-10-05', true);
            GCAL_REQUESTS.filter(R => R.seed).forEach(R => { if (!GCAL_ATTORNEY.some(x => x.id === R.seed)) probs.push(`${R.id} points at a missing appointment`); });
            for (let i = 0; i < 5; i++) {
                const today = GCAL.addDays(mon, i);
                GCAL_REQUESTS.forEach(R => { const q = GCAL.concretize(R, today); if (!q || !(q.dates || q.orig)) probs.push(`${R.id} has no date from ${today}`); else if (R.kind !== 'cancel' && !GCAL.solve([q], today)) probs.push(`${R.id} can't be done from ${today}`); });
                for (let k = 0; k < 4; k++) { const set = GCAL.dealRequests(today), kinds = set.map(q => GCAL_REQUESTS.find(x => x.id === q.id).kind);
                    if (set.length !== 7 || kinds.filter(x => x === 'book').length !== 5 || !kinds.includes('move') || !kinds.includes('cancel')) probs.push(`a dealt set from ${today}: ${kinds.join(',')}`);
                    else if (!GCAL.solve(set, today)) probs.push(`a dealt set from ${today} can't be done`); }
            }
            const today = '2026-10-05', ids = GCAL_REQUESTS.filter(R => R.kind === 'book' && !R.sameDay).slice(0, 5).map(R => R.id).concat(GCAL_REQUESTS.filter(R => R.kind === 'move').slice(0, 1).map(R => R.id), GCAL_REQUESTS.filter(R => R.kind === 'cancel').slice(0, 1).map(R => R.id));
            const reqs = ids.map(id => GCAL.concretize(GCAL_REQUESTS.find(R => R.id === id), today)), plan = GCAL.solve(reqs, today), st = { events: [], ex: {}, sx: {} };
            if (!plan) return { probs: probs.concat(['no plan for the check']) };
            reqs.forEach(q => { const R = GCAL_REQUESTS.find(x => x.id === q.id);
                if (R.kind === 'cancel') { st.ex[`s:${q.row}@${q.orig}`] = { del: true }; return; }
                const e = plan[q.id];
                if (R.kind === 'move') { st.ex[`s:${q.row}@${q.orig}`] = { date: e.date, start: e.start, end: e.end }; return; }
                st.events.push({ id: 'ev-' + q.id, cal: 'attorney', title: `${R.type} – ${R.name}`, date: e.date, start: e.start, end: e.end, allDay: false, tz: 'America/New_York', repeat: 'none',
                    location: R.meeting === 'office' ? GCAL_OFFICE : R.meeting === 'phone' ? 'Phone' : '', meet: R.meeting === 'video' ? 'abc-defg-hij' : '',
                    desc: `Name: ${R.name}<br>CB Number: ${R.cb}${R.dob ? `<br>DOB: ${R.dob}` : ''}${R.dol ? `<br>DOL: ${R.dol}` : ''}${R.org ? `<br>Company: ${R.org}` : ''}<br>Notes: ${R.notesNeed.map(g => g[0]).join(', ')}`, guests: [], notifs: [{ m: 'email', v: 1, u: 'days' }], busy: true }); });
            const good = GCAL.checkPlan(st, reqs, today);
            return { probs, rows: GCAL_ATTORNEY.length, good: good.score, missed: good.results.flatMap(x => x.items.filter(i => !i.ok).map(i => x.head + ': ' + i.t)),
                text: document.body.innerText, title: document.title };
        });
        (r.probs || []).forEach(m => fail(`${track}: ${m}`));
        if (r.good !== 100) fail(`${track}: a plan made the right way should score 100 (${r.good}): ${(r.missed || []).join(' | ')}`);
        if (track === 'ea' && /ttorney/.test(r.text || '')) fail('ea: the executive\'s week should say executive, not attorney');
        if (track === 'ea' && !/Executive’s Calendar/.test(r.text || '')) fail('ea: the calendar should be the Executive’s Calendar');
        if (!/Litigation Week|Executive Week/.test(r.title || '')) fail(`${track}: the page title should name the track (${r.title})`);
        await ctx.close();
    }
    // Standard Training must grade exactly as it always did: an abbreviated office address still counts as the office, and a new-client
    // consult counts toward the 3-a-day cap whatever the separator after "Client Consultation" (regressions found by the clones' review)
    const sp = await open();
    const reg = await sp.evaluate(() => {
        const today = '2026-10-05', out = {}, R = GCAL_REQUESTS.find(r => r.id === 'csm-donovan'), q = GCAL.concretize(R, today), plan = GCAL.solve([q], today), e = plan[q.id];
        const mk = (loc) => ({ events: [{ id: 'ev', cal: 'attorney', title: `${R.type} – ${R.name}`, date: e.date, start: e.start, end: e.end, allDay: false, tz: 'America/New_York', repeat: 'none', location: loc, meet: '',
            desc: `Name: ${R.name}<br>CB Number: ${R.cb}<br>DOB: ${R.dob}<br>DOL: ${R.dol}<br>Notes: ${R.notesNeed.map(g => g[0]).join(', ')}`, guests: [], notifs: [{ m: 'email', v: 1, u: 'days' }], busy: true }], ex: {}, sx: {} });
        out.loc = ['400 Commerce St', '400 Commerce St.', '400 commerce', '400 Commerce Ave, Suite 1200', 'Office'].map(l => GCAL.checkPlan(mk(l), [q], today).results[0].items.filter(i => !i.ok && /put the office/.test(i.t)).length);
        const tue = GCAL.addDays(GCAL.weekStart(today, true), 8);   // a Tuesday
        const titles = ['Client Consultation: New PI Case – A', 'Client Consultation:New PI Case – B', 'Client Consultation New PI Case – C', 'New Intake Consultation – D'];
        const evs = titles.map((t, i) => ({ id: 'n' + i, cal: 'attorney', title: t, date: tue, start: ['09:30', '10:15', '11:00', '13:00'][i], end: ['10:00', '10:45', '11:30', '13:30'][i], allDay: false, tz: 'America/New_York', repeat: 'none', location: '', meet: '', desc: '', guests: [], notifs: [], busy: true }));
        const all = GCAL.instancesOf({ events: evs.slice(0, 3), ex: {}, sx: {} }, tue, tue);
        out.cap = GCAL.slotProblems(evs[3], all.concat([]), { consult: true, newClient: true }).some(t => /new client consults that day/.test(t));
        return out;
    });
    if (reg.loc.some(n => n)) fail(`Standard Training: an abbreviated office address should still count as the office (${JSON.stringify(reg.loc)})`);
    if (!reg.cap) fail('Standard Training: the 4th new-client consult of a day should be flagged whatever the separator after "Client Consultation"');
    await sp.close();
    // the clones keep their own weekly schedule: the API takes ?track=cm|ea and refuses anything else (handled by functions/api/gcal-schedule.js)
    const sch = require('fs').readFileSync(path.join(ROOT, 'functions/api/gcal-schedule.js'), 'utf8');
    if (!/gcal_schedule_tracks/.test(sch) || !/trackOf/.test(sch)) fail('the weekly schedule should be kept per track (gcal_schedule_tracks)');

    await browser.close(); server.close();
    if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((m, i) => console.log(`${i + 1}. ${m}`)); process.exit(1); }
    console.log('Google Calendar Simulator test passed (the week and its blocks; every request doable; the check right and wrong; create, edit, Meet, drag, delete and undo, move one week, views, search, rules, check and save; phone; an Admin\'s schedule for everyone).');
})().catch(e => { console.error(e); process.exit(1); });

// The trainer's review inside the Google Calendar look (simulators/gcal.js ?review=, calsim.html's list of submissions) of the submissions
// made with 📤 Submit to my trainer (kept in the trainee's /api/calsim record): a trainer opens one read only, scores it and comments,
// the trainee sees the feedback, and the trainer's list shows it. And 👥 Your trainees' calendars: a trainer opens a trainee's
// calendar as they last saved it (gcal.html?trainee=), read only, with the automated check, scores it on the CALENDAR
// MANAGEMENT MOCK CALL scorecard (simulators/cal-scorecard.js), and the trainee sees the scorecard on their card and in the simulator.
// Usage: node .github/scripts/gcal-review.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const failures = []; const fail = (m) => failures.push(m);
const posted = [];
const SHEET = require(path.join(ROOT, 'simulators/cal-scorecard.js'));
let rec = null, role = 'trainee';
// a trainee's calendar as saved to their account (gcal_drafts): one booking on the Attorney's Calendar, Standard Training
const DRAFT = { v: 1, today: '2026-10-06', view: 'week', anchor: '2026-10-06', mini: '2026-10', side: false, panel: 'requests', hidden: {}, set: { dur: 30, weekends: false, tz2: false }, reqs: [], result: null, savedAt: 1791300000000, ex: {}, sx: {},
    events: [{ id: 'ev1', cal: 'attorney', title: 'Client Consultation Meeting – Maria Santos', date: '2026-10-07', start: '10:00', end: '10:30', allDay: false, tz: 'America/New_York', repeat: 'none', location: '', meet: 'https://meet.google.com/abc-defg-hij',
        desc: 'Name: Maria Santos<br>CB Number: (555) 010-4411', guests: [], notifs: [{ m: 'email', v: 1, u: 'days' }], busy: true }] };
const ME = () => role === 'admin' ? { username: 'boss', name: 'Trainer', batch: '', admin: true } : { username: 'ci', name: 'Ci Trainee', batch: 'B1', admin: false };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const chunks = [];
    req.on('data', c => chunks.push(c)); req.on('end', () => {
        const send = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
        if (u.pathname === '/api/calsim') {
            const me = role === 'admin' ? { username: 'boss', name: 'Trainer', batch: '', admin: true } : { username: 'ci', name: 'Ci Trainee', batch: 'B1', admin: false };
            if (req.method === 'POST') {
                const b = JSON.parse(Buffer.concat(chunks).toString());
                if (b.scorecard) {
                    if (role !== 'admin') return send({ success: false, error: 'Admin access required.' }, 403);
                    const rows = b.scorecard.rows.map((r, i) => ({ metric: SHEET.METRICS[i].name, weight: 1, score: r.score, feedback: r.feedback })), avg = rows.reduce((a, r) => a + r.score, 0) / rows.length;
                    const card = { title: 'CALENDAR MANAGEMENT MOCK CALL', rows, average: Math.round(avg * 10) / 10, pct: Math.round(avg / 5 * 100), by: 'Trainer', at: '2026-10-06T14:00:00.000Z' };
                    rec = rec || {}; rec.scorecards = rec.scorecards || {}; rec.scorecards[b.scorecard.track] = (rec.scorecards[b.scorecard.track] || []).concat([card]);
                    posted.push(b.scorecard); return send({ success: true, scorecard: card, scorecards: rec.scorecards[b.scorecard.track] });
                }
                if (b.review) { if (role !== 'admin') return send({ success: false, error: 'Admin access required.' }, 403); rec.reviews = rec.reviews || {}; rec.reviews[b.review.key] = { score: Math.round(b.review.score), comment: b.review.comment, tasks: b.review.tasks, by: 'Trainer', at: new Date().toISOString() }; return send({ success: true, data: rec }); }
                if (role === 'admin') return send({ success: true, preview: true });
                rec = Object.assign({}, b.data, { reviews: (rec && rec.reviews) || {} }); return send({ success: true, reviews: rec.reviews });
            }
            if (u.searchParams.get('all') === '1') return send({ success: true, me, rows: rec ? [{ username: 'ci', name: 'Ci Trainee', batch: 'B1', data: rec }] : [] });
            if (u.searchParams.get('user')) return send({ success: true, me, data: rec, person: { name: 'Ci Trainee', batch: 'B1' } });
            return send({ success: true, me, data: role === 'admin' ? null : rec });
        }
        if (u.pathname === '/api/gcal-reviews' && req.method === 'GET' && (u.searchParams.get('drafts') || u.searchParams.get('user'))) {
            if (role !== 'admin') return send({ success: false, error: 'Admin access required.' }, 403);
            if (u.searchParams.get('drafts')) return send({ success: true, drafts: [{ username: 'ci', track: 'standard', updatedAt: '2026-10-06 13:30:00', name: 'Ci Trainee', batch: 'B1' }, { username: 'zed', track: 'cm', updatedAt: '2026-10-05 09:00:00', name: 'Zed Other', batch: 'B2' }] });
            return send({ success: true, track: u.searchParams.get('draft'), data: u.searchParams.get('user') === 'ci' && u.searchParams.get('draft') === 'standard' ? DRAFT : null, updatedAt: '2026-10-06 13:30:00', person: { name: 'Ci Trainee', batch: 'B1' } });
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
    // the scores are in a section of their own below the calendar (not in the side panel)
    const scoresText = (p) => p.evaluate(() => (document.querySelector('#gc-scores') || {}).innerText || '');
    const below = (p) => p.evaluate(() => { const g = document.getElementById('gc'), s = document.getElementById('gc-scores'); return !!(g && s && s.getBoundingClientRect().top >= g.getBoundingClientRect().bottom - 1 && s.offsetHeight > 40); });
    // 1. a submission made with 📤 Submit to my trainer (before 📤 Submit for evaluation, functions/api/gcal-reviews.js, took its place):
    //    kept in the trainee's /api/calsim record; the trainee sees it, and the page's one Submit button is 📤 Submit for evaluation
    rec = { v: 2, drafts: {}, autos: [], submissions: [], reviews: {}, external: [], gsubs: [{ track: 'cm', at: '2026-10-06T12:00:00.000Z',
        result: { score: 40, right: 1, penalty: 0, extra: [], at: '2026-10-06T12:00:00.000Z', results: [{ head: 'Book – Ci Client', when: 'Wed, Oct 7 · 2 – 2:30pm', pts: 5, max: 10, items: [{ ok: true, t: 'On the Attorney’s Calendar.' }, { ok: false, t: 'Add an email notification 1 day before.' }] }] },
        snap: { events: [], ex: {}, sx: {}, reqs: [], today: '2026-10-06', rows: [] } }] };
    const sub = rec.gsubs[0];
    role = 'trainee';
    let page = await open('/simulators/gcal.html?track=cm');
    if (!/Submitted/.test(await scoresText(page)) || /Submitted ·/.test(await panelText(page)) || !(await below(page))) fail('the trainee does not see their earlier submission below the calendar: ' + (await scoresText(page)).slice(0, 160));
    if (await page.$('[data-a="gsubmit"]') || !(await page.$('#gc-rail [data-a="submit-eval"]'))) fail('the one Submit button should be 📤 Submit for evaluation');
    await page.close();
    // 2. a trainer opens it, read only, and gives feedback
    role = 'admin';
    page = await open('/simulators/gcal.html?track=cm&review=' + encodeURIComponent('ci|' + sub.at));
    let t = await scoresText(page);
    if (!/Review/i.test(t) || !/Ci Trainee/.test(t) || !/Your feedback/i.test(t) || /Your feedback/i.test(await panelText(page)) || !(await below(page))) fail('the review is not showing below the calendar: ' + t.slice(0, 160));
    await page.fill('#rv-score', '77'); await page.fill('#rv-comment', 'Good start: check the buffers.'); await page.fill('#rv-t0', 'Needs the case number.');
    await page.click('[data-a="rv-save"]'); await page.waitForTimeout(700);
    const rv = rec.reviews && rec.reviews['g:cm|' + sub.at];
    if (!rv || rv.score !== 77 || !/buffers/.test(rv.comment) || !rv.tasks || rv.tasks.r0 !== 'Needs the case number.') fail('the feedback was not saved: ' + JSON.stringify(rv));
    if (await page.evaluate(() => Object.keys(localStorage).some(k => k.indexOf('lsh_gcal') === 0))) fail('review mode wrote to the trainer’s own practice calendar');
    await page.close();
    // 3. the trainee sees the feedback
    role = 'trainee';
    page = await open('/simulators/gcal.html?track=cm');
    t = await scoresText(page);
    if (!/77\/100/.test(t) || !/Good start/.test(t) || !/Needs the case number/.test(t)) fail('the trainee does not see the trainer’s feedback below the calendar: ' + t.slice(0, 200));
    await page.close();
    // 4. the trainer's list of submissions
    role = 'admin';
    page = await open('/simulators/calsim.html?view=scores&track=litigation');
    const list = await page.evaluate(() => (document.getElementById('gs-list') || {}).innerText || '');
    const href = await page.$$eval('#gs-list a', a => a.map(x => x.getAttribute('href')));
    if (!/Ci Trainee/.test(list) || !/77\/100/.test(list)) fail('the trainer’s list does not show the submission: ' + list.slice(0, 160));
    if (!href.some(h => /track=cm/.test(h) && /review=ci%7C/.test(h))) fail('the list has no link to review it: ' + JSON.stringify(href));
    await page.close();
    // 5. the Calendaring Simulators page, as the Foundational Training's Simulators page has it: the three tracks and the
    //    Calendar Management Mock Calls (graded and practice, in the CMS Call Simulator, with the name and batch)
    page = await open('/simulators/calsim.html?name=Ci%20Trainee&batch=B300926');
    const cs = await page.evaluate(() => { const r = document.getElementById('cs-root');
        return { h: r.querySelector('h1').textContent.trim(), cards: [...r.querySelectorAll('.card h3')].map(h => h.textContent.trim()),
            calls: [...r.querySelectorAll('.cs-calls a')].map(a => [a.textContent.trim(), a.getAttribute('href')]), also: /Conflicts week/.test(r.textContent) }; });
    if (cs.h !== '📅 Calendaring Simulators' || cs.cards.length !== 4 || cs.cards[3] !== 'Calendar Management Mock Calls' || cs.also) fail('the Calendaring Simulators page should be the three tracks and the Calendar Management Mock Calls: ' + JSON.stringify(cs));
    const [g, pr] = cs.calls, want = (h, graded) => /^\/simulators\/call\.html\?/.test(h) && /program=FT/.test(h) && /line=Calendar\+Management\+Mock\+Calls/.test(h) && /name=Ci\+Trainee/.test(h) && /batch=B300926/.test(h) && /random=1/.test(h) === graded;
    if (!g || !/Take a graded call/.test(g[0]) || !want(g[1], true) || !pr || !/Practice a caller/.test(pr[0]) || !want(pr[1], false)) fail('the mock calls card should open the graded and practice calls: ' + JSON.stringify(cs.calls));
    if (await page.$('.cs-review')) fail('an Admin\'s page shows a trainee\'s automated review');
    await page.close();
    // 6. a trainee's page: each track's 🤖 automated calendar review (the last Check my calendar in this browser), what they
    //    submitted with its review, and the trainer's score
    role = 'trainee';
    page = await open('/simulators/calsim.html');
    await page.evaluate(() => localStorage.setItem('lsh_gcal:ci trainee', JSON.stringify({ v: 1, reqs: [], result: { score: 90, right: 4, results: [{}, {}, {}, {}, {}], at: '2026-10-06T13:00:00.000Z' } })));
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(800);
    const rev = await page.$$eval('#cs-root .cs-review', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
    if (rev.length !== 3 || !/Automated review: 90% · 4 of 5 right · 2026-10-06/.test(rev[0]) || !/Submitted · its review 40% · 👤 trainer 77\/100/.test(rev[1]) || !/No automated review yet/.test(rev[2])) fail('the trainee\'s cards should show each track\'s automated review: ' + JSON.stringify(rev));
    await page.close();
    // 7. 👥 Your trainees' calendars (a trainer): each trainee with a calendar saved, 👁 View & score on each track they have
    role = 'admin';
    page = await open('/simulators/calsim.html');
    await page.waitForSelector('.cs-ttable', { timeout: 5000 }).catch(() => fail('the trainer\'s page has no list of the trainees\' calendars'));
    const tl = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.cs-ttable tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim()), links: [...document.querySelectorAll('.cs-ttable a.cs-view')].map(a => a.getAttribute('href')) }));
    if (tl.rows.length !== 2 || !/^Ci Trainee B1/.test(tl.rows[0]) || !/Zed Other/.test(tl.rows[1]) || JSON.stringify(tl.links) !== JSON.stringify(['/simulators/gcal.html?trainee=ci', '/simulators/gcal.html?track=cm&trainee=zed'])) fail('the trainees\' calendars list is wrong: ' + JSON.stringify(tl));
    await page.fill('#cs-tfind', 'b2');
    if (JSON.stringify(await page.$$eval('.cs-ttable tbody tr', trs => trs.map(t => t.style.display))) !== '["none",""]') fail('finding a trainee by batch doesn\'t narrow the list');
    await page.close();
    // the trainee's calendar, read only, with the automated check and the scorecard to fill in
    page = await open('/simulators/gcal.html?trainee=ci');
    await page.waitForSelector('#tv-card', { timeout: 6000 }).catch(() => fail('the trainee\'s calendar opened without the scorecard'));
    t = await scoresText(page);
    const side = await panelText(page);
    if (!/Scores · Ci Trainee · B1/.test(t) || !/read only/.test(t) || !/Their calendar, checked \(automated\)/i.test(t) || !/Maria Santos/.test(t) || !/Maria Santos/.test(side) || /Your scorecard|checked/i.test(side) || !(await below(page))) fail('the trainee\'s calendar is missing who it is, the check or their appointment, or the scores aren\'t below the calendar: ' + t.slice(0, 600) + ' | side: ' + side.slice(0, 300));
    await page.click('[data-a="nav"][data-d="1"]').catch(() => {});
    const evs = await page.evaluate(() => [...document.querySelectorAll('.ev')].map(e => e.textContent));
    if (!evs.some(x => /Maria Santos/.test(x))) fail('the trainee\'s booking isn\'t on the calendar: ' + JSON.stringify(evs.slice(0, 5)));
    const metrics = await page.$$eval('.csc-form tbody tr', trs => trs.map(tr => tr.cells[0].textContent));
    if (metrics.length !== 8 || metrics[0] !== 'Professional Introduction & Call Control' || metrics[6] !== 'Notes, Recap & Call Closing' || metrics[7] !== 'WEIGHTED AVERAGE') fail('the scorecard isn\'t the CALENDAR MANAGEMENT MOCK CALL sheet: ' + JSON.stringify(metrics));
    for (let i = 0; i < 6; i++) await page.selectOption(`select[data-csc="${i}"]`, String([5, 4, 4, 3, 4, 5][i]));
    await page.click('[data-a="tv-save"]'); await page.waitForTimeout(300);
    if (posted.length) fail('a scorecard with a metric unscored was saved');
    await page.selectOption('select[data-csc="6"]', '4'); await page.fill('textarea[data-csf="5"]', 'Meet link and the reminder are on: add the DOB.');
    if (await page.textContent('#csc-avg') !== '4.1' || !/83%/.test(await page.textContent('#csc-pct'))) fail('the weighted average doesn\'t work itself out: ' + await page.textContent('#csc-avg'));
    await page.click('[data-a="tv-save"]'); await page.waitForTimeout(600);
    const sc = posted[0];
    if (!sc || sc.user !== 'ci' || sc.track !== 'standard' || sc.rows.map(r => r.score).join() !== '5,4,4,3,4,5,4' || !/add the DOB/.test(sc.rows[5].feedback)) fail('the scorecard wasn\'t saved for the trainee: ' + JSON.stringify(sc));
    if (!/4\.1\/5 · 83%/.test(await scoresText(page))) fail('the saved scorecard isn\'t shown: ' + (await scoresText(page)).slice(0, 300));
    if (await page.evaluate(() => Object.keys(localStorage).some(k => k.indexOf('lsh_gcal') === 0))) fail('looking at a trainee\'s calendar wrote to the trainer\'s own practice calendar');
    await page.close();
    // the trainee sees it: on their card on the Calendaring Simulators page and in the simulator
    role = 'trainee';
    page = await open('/simulators/calsim.html');
    const mine = await page.$$eval('#cs-root .cs-review', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
    if (!/📋 Trainer’s scorecard: 4\.1\/5 \(83%\)/.test(mine[0] || '') || /scorecard/.test(mine[1] || '')) fail('the trainee\'s card doesn\'t show the trainer\'s scorecard: ' + JSON.stringify(mine));
    await page.click('.cs-scorecard summary');
    if (!/Calendar Creation & Attorney Reminder Setup\s*5\s*Meet link and the reminder are on: add the DOB\./.test(await page.innerText('.cs-scorecard')) || !/WEIGHTED AVERAGE\s*4\.1\s*out of 5 · 83%/.test(await page.innerText('.cs-scorecard'))) fail('the scorecard on the trainee\'s card doesn\'t open to the sheet: ' + (await page.innerText('.cs-scorecard')).slice(0, 600));
    if (await page.$('#cs-trainees')) fail('a trainee sees the trainees\' calendars list');
    await page.close();
    page = await open('/simulators/gcal.html');
    if (!/Your trainer’s scorecard · 4\.1\/5 \(83%\)/.test(await scoresText(page)) || /scorecard/i.test(await panelText(page)) || !(await below(page))) fail('the trainee doesn\'t see the scorecard below the calendar: ' + (await scoresText(page)).slice(0, 300));
    await page.close();
    // a trainee can't open someone's calendar
    page = await open('/simulators/gcal.html?trainee=zed');
    if (!/for trainers|Admin access/i.test(await page.textContent('#app'))) fail('a trainee opened another trainee\'s calendar');
    await page.close();
    await browser.close(); server.close();
    if (failures.length) { console.error('Google Calendar submit and review test FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
    console.log('Google Calendar submit and review test passed (submit keeps the calendar and check; the trainer opens it read only and gives feedback; the trainee sees it; the trainer’s list links to it; the Calendaring Simulators page with the mock calls; the trainees’ calendars, read only, scored on the scorecard, which the trainee sees).');
})();

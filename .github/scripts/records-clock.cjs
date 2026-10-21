// The records collection's clock, and same-day receipt (simulators/records-data.js, records.js).
//
// Every date a trainee works to is a real date: the collection opens on the current system date (a
// weekend or a court holiday rolls to the next open day), the attorney's date is 29 business days
// out from there, the request numbers carry the current year, and a collection reopened later catches
// up to today rather than staying on the day it was left. The clinical history does not move - the
// accident, the treatment and the prior injuries are the case file.
// Same-day receipt (on by default) is the live-training mode: everything the provider's side sends
// back, and the client's e-signature, arrives the same day, so a whole collection can be worked
// through in one sitting with no calendar pushing. Checks that it changes nothing else - the
// rejections, the fee cap, the partial ledger and the hidden providers all still happen, the firm's
// own deadlines stay real business days, and the order of the authorization still decides the score
// even when the signature and the request share a date. Turned off, the business-day clock behaves
// as it did: nothing arrives on the day it was asked for.
// Usage: node .github/scripts/records-clock.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"success":false,"error":"offline test"}'); }
    let f = path.join(ROOT, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});

const fails = [], oks = [];
const check = (name, cond, detail) => (cond ? oks : fails).push(name + (cond ? '' : ': ' + detail));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Work the whole collection in the page, in one sitting, with same-day receipt on. Returns what the
// simulator ended up with: the dates it used, every request's status, and the score.
const RUN_COLLECTION = () => {
    localStorage.clear();
    const out = { steps: [] };
    // the authorization first, as the objectives require: spot both defects, then send it for signature
    MR.tab('auth');
    MR.authFlag('signature', true); MR.authFlag('date', true);
    MR.sendAuth();
    out.authSignedSameDay = window.__S().auth.signedOn === window.__S().today;
    // every provider the objectives ask for, in one pass
    const want = [['ems', ['records', 'bill']], ['him', ['records']], ['pfs', ['bill']], ['rad', ['records', 'bill']],
        ['spine', ['records', 'bill']], ['pt', ['records', 'bill']], ['chiro', ['records', 'bill']],
        ['psych', ['records', 'bill']], ['neuro', ['records', 'bill']], ['whc', ['records']], ['mig', ['records']]];
    const dos = { ems: ['2026-02-14', '2026-02-14'], him: ['2026-02-14', '2026-05-13'], pfs: ['2026-02-14', '2026-05-13'],
        rad: ['2026-03-15', '2026-03-15'], spine: ['2026-03-01', '2026-07-01'], pt: ['2026-03-20', '2026-04-02'],
        chiro: ['2026-03-15', '2026-04-02'], psych: ['2026-04-18', '2026-04-18'], neuro: ['2026-04-20', '2026-06-15'],
        whc: ['2018-08-12', '2018-09-15'], mig: ['2021-03-10', '2021-11-22'], anes: ['2026-05-12', '2026-05-12'],
        river: ['2026-06-24', '2026-06-24'] };
    const send = (pid, types) => {
        MR.tab('new');
        document.getElementById('n-prov').value = pid;
        document.getElementById('n-from').value = dos[pid][0];
        document.getElementById('n-to').value = dos[pid][1];
        document.querySelectorAll('.mr-types input').forEach(i => { i.checked = types.includes(i.value); });
        document.querySelector('form.mr-new').dispatchEvent(new Event('submit', { cancelable: true }));
        const S = window.__S();
        return S.requests[S.requests.length - 1].no;
    };
    const finish = (no) => {
        const S = window.__S(), r = S.requests.find(x => x.no === no);
        if (r.invoice && r.invoice.status === 'due') {
            if (r.invoice.amount > r.invoice.cap + 0.01) MR.dispute(no);      // the EMS flat fee, over the cap
            const again = window.__S().requests.find(x => x.no === no);
            if (again.invoice.status === 'due') MR.pay(no);
        }
        const now = window.__S().requests.find(x => x.no === no);
        if (now.status === 'In process' || now.status === 'Submitted') MR.followUp(no);  // the slow chiropractor
        const after = window.__S().requests.find(x => x.no === no);
        if (after.delivered && Object.keys(after.delivered).length) {
            MR.review(no);
            // the real problems planted in this provider's records, flagged (decoys left alone)
            MR_FINDINGS.filter(f => f.provider === after.provider && f.real).forEach(f => MR.flag(no, f.id, true));
            MR.logIt(no);
        }
        out.steps.push({ no, provider: after.provider, status: window.__S().requests.find(x => x.no === no).status });
    };
    want.forEach(([pid, types]) => finish(send(pid, types)));
    // the complete chiropractic ledger, and the two providers hidden in the records just reviewed
    const chiro = window.__S().requests.find(r => r.provider === 'chiro');
    if (chiro) { MR.askLedger(chiro.no); MR.review(chiro.no); MR.logIt(chiro.no); }
    [['anes', ['bill']], ['river', ['records', 'bill']]].forEach(([pid, types]) => {
        if (!window.__S().revealed[pid]) { out.notRevealed = (out.notRevealed || []).concat(pid); return; }
        finish(send(pid, types));
    });
    const S = window.__S();
    out.today = S.today; out.startedOn = S.startedOn; out.goal = S.goal;
    out.numbers = S.requests.map(r => r.no);
    out.everyDateIsToday = S.requests.every(r => r.submitted === S.today) && S.log.every(l => l.date === S.today);
    out.logged = S.requests.filter(r => r.logged).length;
    MR.tab('score');
    out.scoreText = document.getElementById('mr-pane').innerText;
    out.total = Number((/(\d+)%/.exec(out.scoreText) || [])[1]);
    return out;
};

(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    const open = async () => {
        await page.goto(base + '/simulators/records.html?from=cm&case=LSH-2026-MVA-000041', { waitUntil: 'load' });
        await page.waitForFunction(() => window.MR && typeof MRDocs !== 'undefined' && document.querySelector('.mr-table, .mr-brief'), null, { timeout: 20000 });
        // a handle on the simulator's own state, for assertions the DOM can't make
        await page.evaluate(() => { window.__S = () => JSON.parse(localStorage.getItem('LSH_RECORDS_V1')); });
    };
    await open();

    // ---- 1. the clock is the system date ----
    const today = iso(new Date());
    const clock = await page.evaluate(() => ({ system: MR_SCENARIO.system, start: MR_SCENARIO.start, goal: MR_SCENARIO.goal,
        closedStart: LR.closed(MR_SCENARIO.start), today: window.__S().today, brief: MR_SCENARIO.brief }));
    check('the scenario reads the system date', clock.system === today, `${clock.system} vs ${today}`);
    check('the collection opens on an open day, on or after today', clock.start >= today && !clock.closedStart, JSON.stringify(clock));
    check('the clock starts there, not on a date from the scenario file', clock.today === clock.start && !/2026-07-06/.test(clock.today), clock.today);
    check('the attorney\'s date is computed forward, not hard-coded', clock.goal > clock.start && clock.goal !== '2026-08-14', clock.goal);
    check('the brief names the computed date', clock.brief.includes(await page.evaluate((g) => LR.fmt(g), clock.goal)), clock.brief.slice(-90));
    const shown = await page.evaluate(() => document.querySelector('.mr-bar').innerText);
    check('the bar shows today and the attorney\'s date', shown.includes(await page.evaluate((d) => LR.fmt(d), clock.today)), shown.replace(/\n/g, ' | '));

    // ---- 2. same-day receipt is on, and the whole collection goes through in one sitting ----
    check('same-day receipt is on by default', await page.evaluate(() => window.__S().sameDay === true), 'off by default');
    const run = await page.evaluate(RUN_COLLECTION);
    check('the authorization is signed the same day it is sent', run.authSignedSameDay === true, 'not signed same day');
    check('the providers hidden in the records still surface', !run.notRevealed, `never revealed: ${(run.notRevealed || []).join(', ')}`);
    check('every request is logged without the calendar being pushed', run.logged === 13, `${run.logged} logged of 13: ${JSON.stringify(run.steps)}`);
    check('the whole collection happens on one day', run.today === clock.start && run.everyDateIsToday === true, `today ${run.today}, start ${clock.start}`);
    check('the request numbers carry the current year', run.numbers.every(n => n.startsWith(`MRR-${today.slice(0, 4)}-`)), run.numbers.slice(0, 3).join(', '));
    check('a full collection in one sitting scores 100', run.total === 100, `${run.total}%\n${run.scoreText}`);
    check('the decoy problems are still there to get wrong', await page.evaluate(() => MR_FINDINGS.filter(f => !f.real).length) === 3, 'the decoys went');

    // ---- 3. the rules are unchanged: same-day receipt removes the waiting, not the lessons ----
    const rules = await page.evaluate(() => {
        localStorage.clear(); location.reload();
    }).then(() => page.waitForTimeout(1500)).then(() => page.evaluate(() => {
        window.__S = () => JSON.parse(localStorage.getItem('LSH_RECORDS_V1'));
        const out = {};
        const send = (pid, types, from, to) => {
            MR.tab('new');
            document.getElementById('n-prov').value = pid;
            document.getElementById('n-from').value = from; document.getElementById('n-to').value = to;
            document.querySelectorAll('.mr-types input').forEach(i => { i.checked = types.includes(i.value); });
            document.querySelector('form.mr-new').dispatchEvent(new Event('submit', { cancelable: true }));
            const S = window.__S(); return S.requests[S.requests.length - 1];
        };
        // a request sent before the authorization is signed is still rejected, same day or not
        out.rejected = send('rad', ['records'], '2026-03-15', '2026-03-15').status;
        MR.tab('auth'); MR.sendAuth();
        // the state fee cap still has to be disputed
        const ems = send('ems', ['records', 'bill'], '2026-02-14', '2026-02-14');
        out.invoice = ems.invoice ? { amount: ems.invoice.amount, cap: ems.invoice.cap, over: ems.invoice.amount > ems.invoice.cap } : null;
        // the wrong department still sends you to the other one
        out.wrongDept = send('him', ['records', 'bill'], '2026-02-14', '2026-05-13').ts.bill;
        // dates of service the provider doesn't hold still find nothing
        out.noRecords = send('whc', ['records'], '2026-02-14', '2026-07-01').status;
        // psychotherapy notes still need their own authorization
        out.psych = send('psych', ['records', 'psych'], '2026-04-18', '2026-04-18').ts.psych;
        // the slow chiropractor still has to be chased before anything arrives (same-day receipt takes
        // the waiting out of the chase, not the chase out of the job), and still sends 2 of 14 visits
        const sent = send('chiro', ['records', 'bill'], '2026-03-15', '2026-04-02');
        out.chiroBeforeChase = !sent.delivered || !sent.delivered.bill;
        MR.followUp(sent.no);
        const chased = window.__S().requests.find(r => r.no === sent.no);
        out.chiroBillPages = chased.delivered && chased.delivered.bill ? chased.delivered.bill.pages : null;
        out.chiroLines = chased.delivered && chased.delivered.bill ? chased.delivered.bill.lines.length : null;
        // the firm's own deadlines are still real business days away
        const S = window.__S();
        out.followUpAhead = S.requests.every(r => !r.nextFollowUp || r.nextFollowUp > S.today);
        out.goalAhead = (S.goal || MR_SCENARIO.goal) > S.today;
        out.noneMissed = S.requests.every(r => !r.missedFollowUp);
        // and the score says the authorization was NOT fixed first, though both happened today
        MR.tab('score');
        out.scoreText = document.getElementById('mr-pane').innerText;
        return out;
    }));
    check('a request sent before the authorization is signed is still rejected', rules.rejected === 'Rejected', rules.rejected);
    check('the EMS flat fee is still over the state cap', rules.invoice && rules.invoice.over, JSON.stringify(rules.invoice));
    check('bills are still not held by medical records', rules.wrongDept === 'elsewhere', rules.wrongDept);
    check('dates of service the provider does not hold still find nothing', rules.noRecords === 'No records', rules.noRecords);
    check('psychotherapy notes still need their own authorization', rules.psych === 'rejected', rules.psych);
    check('the slow office still has to be chased before anything arrives', rules.chiroBeforeChase === true, 'it delivered without being chased');
    check('the chiropractor still sends 2 of 14 visits', rules.chiroBillPages === 1 && rules.chiroLines === 2, `${rules.chiroBillPages} pages / ${rules.chiroLines} lines`);
    check('follow-up dates are still real business days ahead', rules.followUpAhead === true, 'a follow-up was due the day it was sent');
    check('the attorney\'s date is still ahead', rules.goalAhead === true, 'the attorney\'s date is not in the future');
    check('no follow-up is marked missed on the first day', rules.noneMissed === true, 'a follow-up was marked missed immediately');
    check('signing after the first request still loses the points for it',
        /Signed only after requests went out/.test(rules.scoreText), rules.scoreText.slice(0, 400));

    // ---- 4. with same-day receipt off, the business-day clock is back ----
    const slow = await page.evaluate(() => {
        localStorage.clear(); location.reload();
    }).then(() => page.waitForTimeout(1500)).then(() => page.evaluate(() => {
        window.__S = () => JSON.parse(localStorage.getItem('LSH_RECORDS_V1'));
        MR.sameDay(false);
        MR.tab('auth'); MR.sendAuth();
        const S0 = window.__S();
        const authWaits = !S0.auth.signedOn;
        MR.advance(3);
        MR.tab('new');
        document.getElementById('n-prov').value = 'pfs';
        document.getElementById('n-from').value = '2026-02-14'; document.getElementById('n-to').value = '2026-05-13';
        document.querySelectorAll('.mr-types input').forEach(i => { i.checked = i.value === 'bill'; });
        document.querySelector('form.mr-new').dispatchEvent(new Event('submit', { cancelable: true }));
        const S = window.__S(), r = S.requests[0];
        return { authWaits, status: r.status, queued: r.queue.length, allLater: r.queue.every(q => q.date > S.today) };
    }));
    check('with it off, the authorization is not signed the day it is sent', slow.authWaits === true, 'signed immediately');
    check('with it off, nothing has come back yet', slow.status === 'Submitted' && slow.queued > 0, JSON.stringify(slow));
    check('with it off, what is queued is on later business days', slow.allLater === true, 'something was queued for today');

    // ---- 5. the clock keeps up: a collection left behind catches up to today ----
    const caught = await page.evaluate(() => {
        // a collection saved 9 business days ago, with a request in the post, as a trainee would leave it
        const S = JSON.parse(localStorage.getItem('LSH_RECORDS_V1'));
        let back = S.today, n = 0;
        while (n < 9) { back = LR.add(back, -1); if (!LR.closed(back)) n++; }
        S.today = back; S.startedOn = back; S.sameDay = false;
        S.requests.forEach(r => { r.submitted = back; r.nextFollowUp = back; r.events.forEach(e => { e.date = back; }); r.queue.forEach((q, i) => { q.date = LR.add(back, i + 1); }); });
        S.log.forEach(l => { l.date = back; });
        localStorage.setItem('LSH_RECORDS_V1', JSON.stringify(S));
        return { left: back };
    });
    await open();
    const after = await page.evaluate(() => {
        const S = window.__S();
        return { today: S.today, system: MR_SCENARIO.system, status: S.requests[0].status,
            missed: S.requests.some(r => r.missedFollowUp), said: S.log.some(l => /calendar moved on/.test(l.text)),
            goal: S.goal, scenarioGoal: MR_SCENARIO.goal };
    });
    check('a collection left behind catches up to today', after.today > caught.left && after.today >= after.system,
        `left ${caught.left}, now ${after.today}, system ${after.system}`);
    check('what the post brought while nobody was here has run', after.status !== 'Submitted', after.status);
    check('nobody is punished for the days they were away', after.missed === false, 'a follow-up was marked missed during the catch-up');
    check('the catch-up says so in the log', after.said === true, 'nothing in the log');
    check('the attorney\'s date is refreshed with it', after.goal === after.scenarioGoal, `${after.goal} vs ${after.scenarioGoal}`);

    // ---- 6. the page still behaves ----
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check('no sideways scrolling at desktop width', !sideways, 'the page scrolls sideways');
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    phone.on('pageerror', e => errors.push('phone: ' + e.message));
    phone.on('dialog', d => d.accept());
    await phone.goto(base + '/simulators/records.html', { waitUntil: 'load' });
    await phone.waitForFunction(() => window.MR, null, { timeout: 20000 });
    const phoneBad = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check('the same-day switch does not break phone width', !phoneBad, 'the page scrolls sideways on a phone');
    check('no page errors', errors.length === 0, errors.join(' | '));

    await browser.close(); server.close();
    oks.forEach(o => console.log('  ok   ' + o));
    if (fails.length) { console.log(`\n${fails.length} FAILURE(S):`); fails.forEach((f, i) => console.log(`  ${i + 1}. ${f}`)); process.exit(1); }
    console.log(`\nAll ${oks.length} checks passed.`);
})().catch(e => { console.error(e); process.exit(1); });

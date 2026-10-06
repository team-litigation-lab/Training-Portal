// The trainer's Trainee Evaluations page (simulators/gcal-review.html).
//  1. Opened in a NEW TAB: the signed cookie is there, but the tab's own storage holds no copy of the person (a link that opens with noopener,
//     a bookmark), so the page used to say "This page is for trainers" to a signed-in admin. It now asks /api/me (Sim.restore) and shows the
//     review. A trainee, or a signed-out browser, still gets the note.
//  2. The page against a mock of /api/gcal-reviews that can fail, lag and expire on cue: a failed refresh never replaces the review that is open
//     nor lets the autosave blank the saved feedback; 401 / 403 / 423 / offline say so (with a way back in) and the feedback stays; changing
//     submission with feedback that didn't save asks first; a score outside 0-100 doesn't stop the notes saving; the rows open from the keyboard;
//     the rules panel can't show or save one track's rules under another; a review stuck on "AI writing" can be tried again and sent; a calendar
//     in a shape the page doesn't expect doesn't hide the submission nor reach a style attribute; the list says loading / no match / not updating;
//     nothing makes the page wider than a phone screen.
// Usage: node .github/scripts/gcal-review-page.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const failures = []; const fail = (m) => failures.push(m);
const ok = (c, m) => { if (!c) fail(m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let who = null;   // what /api/me answers: an admin, a trainee, or nobody
const ADMIN = { username: 'boss', fullName: 'Trainer Bo', userType: 'Admin' };

// ---- the mock of /api/gcal-reviews: the state a test sets up, and the knobs that make it misbehave ----
let S;
function reset() {
    S = { reviews: {}, posts: [], hits: { list: 0, row: 0, rules: 0 }, delay: {}, fail: {}, failPost: null, delayPost: 0, expired: false, meHits: 0,
        rules: { standard: { text: 'rules for standard', updatedBy: 'Bo', updatedAt: '2026-10-01T10:00:00.000Z' }, cm: { text: 'rules for cm', updatedBy: 'Bo', updatedAt: '2026-10-01T10:00:00.000Z' }, ea: { text: 'rules for ea' } } };
}
reset();
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const rv = (id, o) => Object.assign({ id, username: 'u' + id, name: 'Trainee ' + id, batch: 'B1', track: 'standard', submittedAt: '2026-10-05T14:00:00.000Z', checkScore: 70, aiStatus: 'done', status: 'submitted', finalizedAt: null, finalizedBy: null, updatedAt: '2026-10-05T14:00:10.000Z',
    calendar: { week: { from: '2026-10-05', to: '2026-10-23', today: '2026-10-06', events: [{ t: 'Consult', d: '2026-10-07', s: '10:00', e: '10:30', mine: true, cal: 'Me', c: '#039be5' }] },
        appointments: [{ title: 'Consult – Jo', calendar: 'Attorney', day: 'Wed', date: 'Oct 7', time: '10:00 – 10:30', timeZone: 'ET', description: 'call back' }],
        automatedCheck: { score: 70, requestsFullyRight: '1 of 2', results: [{ request: 'Book Jo', points: '5/10', met: ['ok'], missed: ['late'] }] }, requests: [] },
    ai: { summary: 'Good start.', correct: ['Booked Jo'], improve: ['Add a callback'], missed: [], at: '2026-10-05T14:00:12.000Z' }, trainer: { notes: '', points: [], score: null } }, o || {});
const listView = (r) => { const o = Object.assign({}, r); delete o.calendar; delete o.ai; delete o.trainer; return o; };
async function gcal(req, u, raw, send) {
    if (!who || who.userType !== 'Admin') return send({ success: false, error: 'Admin access required.' }, 403);
    if (S.expired) return send({ success: false, error: 'Session expired.', code: 'SESSION_EXPIRED' }, 401);   // until /api/me is asked
    const q = u.searchParams;
    if (req.method === 'POST') {
        const b = JSON.parse(raw || '{}'); S.posts.push(b);
        if (S.delayPost) await sleep(S.delayPost);
        if (S.failPost) return send(S.failPost.body || { success: false, error: 'Server error.' }, S.failPost.status);
        if (b.action === 'rules') { S.rules[b.track] = { text: b.text, updatedBy: 'Bo', updatedAt: new Date().toISOString() }; return send({ success: true }); }
        const r = S.reviews[b.id]; if (!r) return send({ success: false, error: 'Not found.' }, 404);
        if (b.action === 'trainer') {
            if (r.status === 'final') return send({ success: false, error: 'This report is final. Reopen it to change the feedback.' }, 409);
            const sc = b.score === '' || b.score == null ? null : Number(b.score);
            if (sc != null && !(Number.isFinite(sc) && sc >= 0 && sc <= 100)) return send({ success: false, error: 'The score is out of 100.' }, 400);
            r.trainer = { notes: b.notes, points: (b.points || []).filter(Boolean), score: sc }; return send({ success: true });
        }
        if (b.action === 'finalize') { r.status = 'final'; r.finalizedAt = new Date().toISOString(); return send({ success: true }); }
        if (b.action === 'reopen') { r.status = 'submitted'; return send({ success: true }); }
        if (b.action === 'retry') { r.aiStatus = 'pending'; r.updatedAt = new Date().toISOString(); r.ai = null; return send({ success: true }); }
        return send({ success: false, error: 'Unknown action.' }, 400);
    }
    const kind = q.get('all') ? 'list' : q.get('id') ? 'row' : 'rules';
    S.hits[kind]++;
    const wait = S.delay[kind === 'rules' ? 'rules:' + q.get('rules') : kind] || S.delay[kind]; if (wait) await sleep(wait);
    const f = S.fail[kind === 'rules' ? 'rules:' + q.get('rules') : kind] || S.fail[kind]; if (f) return send(f.body || { success: false, error: 'Server error.' }, f.status);
    if (kind === 'list') return send({ success: true, reviews: Object.values(S.reviews).sort((a, b) => b.id - a.id).map(listView) });
    if (kind === 'row') return S.reviews[q.get('id')] ? send({ success: true, review: JSON.parse(JSON.stringify(S.reviews[q.get('id')])) }) : send({ success: false, error: 'Not found.' }, 404);
    const t = q.get('rules'), x = S.rules[t] || { text: '' };
    return send({ success: true, track: t, text: x.text, updatedBy: x.updatedBy || null, updatedAt: x.updatedAt || null });
}
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const chunks = [];
    req.on('data', c => chunks.push(c)); req.on('end', async () => {
        const send = (o, code) => { res.writeHead(code || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
        if (u.pathname === '/api/me') { S.meHits++; S.expired = false; return who ? send({ success: true, user: who }) : send({ success: false, code: 'NOT_AUTHENTICATED' }, 401); }
        if (u.pathname === '/api/gcal-reviews') return gcal(req, u, Buffer.concat(chunks).toString(), send);
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
    const text = async () => {
        const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
        page.on('pageerror', e => fail('page error: ' + e.message));
        await page.goto(base + '/simulators/gcal-review.html', { waitUntil: 'load' }); await page.waitForTimeout(1200);
        const t = await page.evaluate(() => (document.getElementById('app') || {}).innerText || '');
        const kept = await page.evaluate(() => sessionStorage.getItem('LSH_SESSION_V1'));
        await page.close(); return { t, kept };
    };
    who = ADMIN;
    let r = await text();
    ok(!/This page is for trainers/.test(r.t), 'a signed-in admin in a new tab still gets "This page is for trainers": ' + r.t.slice(0, 120));
    ok(r.kept && JSON.parse(r.kept).userType === 'Admin', 'the tab did not keep the admin session after asking /api/me');
    who = { username: 'ann', fullName: 'Ann Lee', userType: 'Trainee' };
    r = await text();
    ok(/This page is for trainers/.test(r.t), 'a trainee should be told this page is for trainers: ' + r.t.slice(0, 120));
    ok(r.kept && JSON.parse(r.kept).username === 'ann', 'the tab did not keep the trainee session after asking /api/me (the heartbeat needs it, or the Portal calls them signed out after 90 s)');
    who = null;
    r = await text();
    ok(/This page is for trainers/.test(r.t), 'a signed-out browser should be told this page is for trainers: ' + r.t.slice(0, 120));

    // ---- the page itself, signed in as the trainer ----
    who = ADMIN;
    // A tab whose clock this test can push forward (page.clock.fastForward: the 3 / 8 / 15 second refreshes and the retry after a failed save fire at once).
    let opened = [];
    const section = async (name, fn) => {   // one part failing (or hanging on a control that isn't there) must not hide the others
        opened = [];
        try { await fn(); } catch (e) { fail(name + ': ' + String(e && e.message || e).split('\n')[0]); }
        for (const p of opened) await p.close().catch(() => {});
    };
    const openPage = async (label, url, o) => {
        o = o || {};
        const page = await browser.newPage({ viewport: { width: o.w || 1300, height: o.h || 900 } }); opened.push(page); page.setDefaultTimeout(5000);
        page.label = label; page.dialogs = []; page.answer = false;
        page.on('pageerror', e => fail(label + ': page error: ' + e.message));
        page.on('dialog', d => { page.dialogs.push(d.message()); (page.answer ? d.accept() : d.dismiss()).catch(() => {}); });
        await page.clock.install();
        await page.goto(base + (url || '/simulators/gcal-review.html'), { waitUntil: 'load' });
        if (!o.early) await page.waitForSelector('#rv-list .rv-row, #rv-list .rv-none, #rv-banner:not(:empty)', { timeout: 8000 }).catch(() => fail(label + ': the page never showed its list'));
        return page;
    };
    const until = async (cond, ms) => { const t = Date.now(); while (Date.now() - t < (ms || 4000)) { if (await cond()) return true; await sleep(50); } return false; };
    const txt = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText : null; }, sel);
    const val = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.value : null; }, sel);
    const openRow = async (p, id) => { await p.click('.rv-row[data-id="' + id + '"]'); await p.waitForSelector('#rv-notes, #rv-main .rv-none', { timeout: 5000 }); };
    const tick = (p, ms) => p.clock.fastForward(ms);
    const trainerPosts = () => S.posts.filter(b => b.action === 'trainer');

    // 1. #3 / #6: a refresh that fails must not replace the review that is open, nor let the autosave blank what the server holds
    await section('1. a failed refresh', async () => {
        reset(); S.reviews[5] = rv(5, { trainer: { notes: 'saved notes', points: ['p1'], score: 80 } }); S.reviews[6] = rv(6);
        let page = await openPage('failed refresh');
        await openRow(page, 5);
        ok(await val(page, '#rv-notes') === 'saved notes', 'the open review should show the saved notes');
        S.fail.row = { status: 502 }; S.delay.row = 1200;
        const hits = S.hits.row; await tick(page, 16000);   // the 15 s refresh starts, and takes its time to fail
        ok(await until(() => S.hits.row > hits), 'the refresh never started');
        await page.click('#rv-notes'); await page.keyboard.press('End'); await page.keyboard.type(' extra words');
        await sleep(2800);
        ok(await val(page, '#rv-notes') === 'saved notes extra words', 'a failed refresh wiped or replaced the notes being typed: ' + await val(page, '#rv-notes'));
        ok(await val(page, '[data-pt="0"]') === 'p1' && await val(page, '#rv-score') === '80', 'a failed refresh removed the points or the score');
        ok(/Not updating/.test(await txt(page, '#rv-banner') || ''), 'a failed refresh shows no "Not updating" banner: ' + await txt(page, '#rv-banner'));
        ok(trainerPosts().length > 0 && trainerPosts().every(b => /^saved notes/.test(b.notes) && b.points.length === 1 && b.points[0] === 'p1' && String(b.score) === '80'), 'the autosave after a failed refresh sent blanks: ' + JSON.stringify(trainerPosts()));
        ok(S.reviews[5].trainer.notes === 'saved notes extra words' && S.reviews[5].trainer.score === 80, 'the server lost the saved feedback after a failed refresh: ' + JSON.stringify(S.reviews[5].trainer));
        S.fail.row = null; S.delay.row = 0;
        await page.click('#rv-banner [data-a="refresh"]'); await sleep(500);
        ok(!(await txt(page, '#rv-banner')) && await val(page, '#rv-notes') === 'saved notes extra words', 'the banner stays after the connection is back, or the notes changed');
        // a first look that fails has nothing to keep: it says so, with a way to try again
        S.fail.row = { status: 502 };
        await page.click('.rv-row[data-id="6"]'); await sleep(600);
        ok(/couldn’t be opened/.test(await txt(page, '#rv-main') || '') && await page.$('#rv-main [data-a="refresh"]'), 'a submission that can\'t be opened should say so and offer Try again: ' + await txt(page, '#rv-main'));
        S.fail.row = null; await page.click('#rv-main [data-a="refresh"]'); await sleep(500);
        ok(await page.$('#rv-notes') && /Trainee 6/.test(await txt(page, '#rv-title') || ''), 'Try again did not open the submission');
        await page.close();
    });

    // 2. #6: signed out / not a trainer / site locked / offline, on the list and on the review; and a save that can't happen keeps the feedback
    await section('2. banners', async () => {
        reset(); S.reviews[5] = rv(5, { trainer: { notes: 'saved notes', points: [], score: null } });
        let page = await openPage('banners');
        await openRow(page, 5);
        S.fail.list = { status: 401, body: { success: false, error: 'Not signed in.', code: 'NOT_AUTHENTICATED' } };
        await tick(page, 9000); await sleep(400);
        let b = await txt(page, '#rv-banner') || '';
        ok(/session has ended/.test(b) && await page.$('#rv-banner a[href="/admin-login.html"]'), 'a 401 on the list shows no sign-in banner: ' + b);
        ok(await page.$('.rv-row[data-id="5"]'), 'the list was emptied by a failed refresh');
        S.fail.list = { status: 423, body: { success: false, error: 'This page has been locked by an administrator.', code: 'SITE_LOCKED' } };
        await tick(page, 9000); await sleep(400);
        b = await txt(page, '#rv-banner') || '';
        ok(/locked by an administrator/.test(b) && await page.$('#rv-banner [data-a="reload"]'), 'a 423 shows no "locked" banner with a Reload: ' + b);
        S.fail.list = { status: 403, body: { success: false, error: 'Admin access required.' } };
        await tick(page, 9000); await sleep(400);
        ok(/for trainers/.test(await txt(page, '#rv-banner') || '') && await page.$('#rv-banner a[href="/admin-login.html"]'), 'a 403 shows no "for trainers" banner with a sign-in: ' + await txt(page, '#rv-banner'));
        S.fail.list = { status: 500 }; await tick(page, 9000); await sleep(400);
        ok(/Not updating/.test(await txt(page, '#rv-banner') || '') && await page.$('.rv-row[data-id="5"]'), 'a failing refresh should say the list is not updating and keep the rows: ' + await txt(page, '#rv-banner'));
        S.fail.list = null; await page.click('#rv-banner [data-a="refresh"]'); await sleep(500);
        ok(!(await txt(page, '#rv-banner')), 'the banner stays after the list is back: ' + await txt(page, '#rv-banner'));
        // the session ends while the trainer is typing: the text stays, says it is not saved, and is saved by itself once they are back in
        S.failPost = { status: 401, body: { success: false, error: 'Not signed in.', code: 'NOT_AUTHENTICATED' } };
        await page.click('#rv-notes'); await page.keyboard.press('End'); await page.keyboard.type(' and more');
        await sleep(1400);
        ok(/Not saved/.test(await txt(page, '#rv-saved') || '') && /session has ended/.test(await txt(page, '#rv-banner') || ''), 'a save that failed (401) shows no warning: ' + await txt(page, '#rv-saved') + ' / ' + await txt(page, '#rv-banner'));
        S.fail.row = { status: 401, body: { success: false, error: 'Not signed in.', code: 'NOT_AUTHENTICATED' } };
        await tick(page, 16000); await sleep(500);
        ok(await val(page, '#rv-notes') === 'saved notes and more', 'the poll after a failed save replaced the notes the trainer typed: ' + await val(page, '#rv-notes'));
        S.fail.row = null; S.failPost = null;
        await tick(page, 11000); await sleep(800);   // the page tries the save again by itself
        ok(S.reviews[5].trainer.notes === 'saved notes and more', 'the feedback was not saved again once the session was back: ' + S.reviews[5].trainer.notes);
        ok(/Saved/.test(await txt(page, '#rv-saved') || ''), 'the label does not say Saved after the retry: ' + await txt(page, '#rv-saved'));
        await page.close();
        // a lapsed heartbeat (401 SESSION_EXPIRED) is put right with /api/me and the request sent again: no banner, the list updates
        reset(); S.reviews[5] = rv(5);
        page = await openPage('session expired');
        S.reviews[6] = rv(6); S.expired = true; const me0 = S.meHits;
        await tick(page, 9000);
        ok(await until(async () => !!(await page.$('.rv-row[data-id="6"]'))), 'the refresh after a lapsed heartbeat never got the new submission');
        ok(S.meHits > me0 && !(await txt(page, '#rv-banner')), 'a lapsed heartbeat should be put right with /api/me, not shown as an error: ' + await txt(page, '#rv-banner'));
        await page.close();
    });

    // 3. #9: changing submission with feedback that didn't save, a score that doesn't fit, and typing while a save is on its way
    await section('3. switching', async () => {
        reset(); S.reviews[5] = rv(5, { trainer: { notes: 'saved notes', points: ['p1'], score: 80 } }); S.reviews[6] = rv(6);
        let page = await openPage('switching');
        await openRow(page, 5);
        await page.click('#rv-notes'); await page.keyboard.press('End'); await page.keyboard.type(' more');
        await page.fill('#rv-score', '150');
        await sleep(1300);
        ok(/0 to 100/.test(await txt(page, '#rv-score-err') || ''), 'no inline message for a score outside 0-100: ' + await txt(page, '#rv-score-err'));
        ok(S.reviews[5].trainer.notes === 'saved notes more' && S.reviews[5].trainer.score === 80, 'one invalid score stopped the notes from saving, or replaced the saved score: ' + JSON.stringify(S.reviews[5].trainer));
        page.answer = false; await page.click('.rv-row[data-id="6"]'); await sleep(400);
        ok(page.dialogs.length === 1 && /score/.test(page.dialogs[0]), 'changing submission with an unsaved score should ask first: ' + JSON.stringify(page.dialogs));
        ok(await val(page, '#rv-notes') === 'saved notes more' && await val(page, '#rv-score') === '150', 'the review was closed although the trainer said to stay');
        ok(await page.$eval('.rv-row[data-id="5"]', e => e.classList.contains('on')), 'the row of the open submission is not marked');
        await page.fill('#rv-score', '90'); await sleep(1300);
        ok(S.reviews[5].trainer.score === 90 && !(await txt(page, '#rv-score-err')), 'a good score after a bad one was not saved: ' + JSON.stringify(S.reviews[5].trainer));
        // a save that fails (the server is down): the same question, and nothing is lost when the server is back
        S.failPost = { status: 500 };
        await page.click('#rv-notes'); await page.keyboard.press('End'); await page.keyboard.type(' later');
        await sleep(1300);
        ok(/Not saved/.test(await txt(page, '#rv-saved') || ''), 'a failed save shows no warning: ' + await txt(page, '#rv-saved'));
        page.dialogs.length = 0; await page.click('.rv-row[data-id="6"]'); await sleep(400);
        ok(page.dialogs.length === 1 && await val(page, '#rv-notes') === 'saved notes more later', 'changing submission after a failed save should ask, and stay when told to: ' + JSON.stringify(page.dialogs));
        S.failPost = null; page.dialogs.length = 0; await page.click('.rv-row[data-id="6"]'); await sleep(900);
        ok(page.dialogs.length === 0 && S.reviews[5].trainer.notes === 'saved notes more later', 'once the server was back the feedback should save on leaving, without asking: ' + JSON.stringify(S.reviews[5].trainer) + JSON.stringify(page.dialogs));
        ok(/Trainee 6/.test(await txt(page, '#rv-title') || ''), 'the other submission did not open');
        await page.close();
        // typed again while a save is on its way: it is not "Saved", the page still warns before closing, and the later text is what ends up saved
        reset(); S.reviews[5] = rv(5); page = await openPage('in flight');
        await openRow(page, 5);
        S.delayPost = 1000;
        await page.click('#rv-notes'); await page.keyboard.type('first');
        ok(await until(() => S.posts.length === 1, 3000), 'the first save never started');
        await page.keyboard.type(' and the last sentence');
        await sleep(1100);   // the first one has come back; the second is on its way
        ok(!/^Saved/.test(await txt(page, '#rv-saved') || ''), 'the label says Saved while newer text is not saved: ' + await txt(page, '#rv-saved'));
        ok(await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }), 'closing the page is not stopped while newer text is not saved');
        S.delayPost = 0; await sleep(2600);
        ok(S.reviews[5].trainer.notes === 'first and the last sentence' && /^Saved/.test(await txt(page, '#rv-saved') || ''), 'the later text was not saved: ' + JSON.stringify(S.reviews[5].trainer) + ' / ' + await txt(page, '#rv-saved'));
        await page.close();
    });

    // 4. #10: from the keyboard, and names for the fields
    await section('4. keyboard', async () => {
        reset(); S.reviews[5] = rv(5); S.reviews[6] = rv(6, { trainer: { notes: 'n', points: ['p1'], score: null } });   // (the list is newest first: Tab reaches 6)
        let page = await openPage('keyboard');
        await page.focus('#rv-track'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
        ok(await page.evaluate(() => document.activeElement.classList.contains('rv-row') && document.activeElement.tagName === 'BUTTON'), 'Tab does not reach a submission: ' + await page.evaluate(() => document.activeElement.tagName + '.' + document.activeElement.className));
        await page.keyboard.press('Enter');
        ok(await until(async () => !!(await page.$('#rv-notes'))), 'Enter did not open the submission');
        ok(await page.$eval('.rv-row.on', e => e.getAttribute('aria-current') === 'true'), 'the open submission is not marked with aria-current');
        ok(await page.evaluate(() => document.activeElement.id === 'rv-title'), 'after opening a submission the focus should move to it: ' + await page.evaluate(() => document.activeElement.tagName + '#' + document.activeElement.id));
        const named = await page.evaluate(() => ['#rv-track', '#rv-notes', '[data-pt="0"]', '[data-a="pt-del"]'].map(s => { const e = document.querySelector(s); return !!(e && ((e.labels && e.labels.length) || e.getAttribute('aria-label'))); }));
        ok(named.every(Boolean), 'the track filter, the notes, a point and its Remove button need a name: ' + JSON.stringify(named));
        await page.focus('.rv-row[data-id="5"]');
        S.reviews[7] = rv(7); await tick(page, 9000);   // the list is drawn again with a new row in it
        ok(await until(async () => !!(await page.$('.rv-row[data-id="7"]'))), 'the new submission never showed');
        ok(await page.evaluate(() => document.activeElement.dataset && document.activeElement.dataset.id === '5'), 'the focus was lost when the list was drawn again: ' + await page.evaluate(() => document.activeElement.tagName));
        await page.click('[data-a="rules"]'); await page.waitForSelector('#rv-rtext');
        const rn = await page.evaluate(() => ['#rv-rt', '#rv-rtext'].map(s => { const e = document.querySelector(s); return !!(e && ((e.labels && e.labels.length) || e.getAttribute('aria-label'))); }));
        ok(rn.every(Boolean), 'the rules track menu and text need a name: ' + JSON.stringify(rn));
        await page.close();
    });

    // 5. #11: the rules panel
    await section('5. rules', async () => {
        reset(); S.reviews[5] = rv(5); S.delay['rules:standard'] = 1500;
        let page = await openPage('rules');
        await page.click('[data-a="rules"]'); await page.selectOption('#rv-rt', 'cm');   // the answer for standard comes after the one for cm
        await sleep(2000);
        ok(await val(page, '#rv-rt') === 'cm' && await val(page, '#rv-rtext') === 'rules for cm', 'the rules shown under a track are another track\'s: ' + await val(page, '#rv-rt') + ' / ' + await val(page, '#rv-rtext'));
        await page.evaluate(() => { document.querySelector('#rv-rtext').dataset.k = '1'; });
        await page.click('[data-a="rules-save"]'); await sleep(400);
        const rp = S.posts.filter(x => x.action === 'rules');
        ok(rp.length === 1 && rp[0].track === 'cm' && rp[0].text === 'rules for cm', 'Save wrote the rules to the wrong track: ' + JSON.stringify(rp));
        ok(/^Saved/.test(await txt(page, '#rv-rmeta') || '') && await page.$eval('#rv-rtext', e => e.dataset.k === '1'), 'Save should say Saved and leave the panel as it is: ' + await txt(page, '#rv-rmeta'));
        S.delay['rules:standard'] = 0;
        await page.focus('#rv-rt'); await page.keyboard.press('ArrowDown'); await sleep(300); await page.keyboard.press('ArrowUp'); await sleep(300);
        ok(await page.evaluate(() => document.activeElement.id === 'rv-rt'), 'the track menu loses the focus after a change: ' + await page.evaluate(() => document.activeElement.tagName));
        ok(await val(page, '#rv-rt') === 'cm', 'the arrow keys did not step through the tracks: ' + await val(page, '#rv-rt'));
        // unsaved edits are not replaced without asking
        await page.fill('#rv-rtext', 'my new rule'); page.answer = false; page.dialogs.length = 0;
        await page.selectOption('#rv-rt', 'ea'); await sleep(300);
        ok(page.dialogs.length === 1 && await val(page, '#rv-rt') === 'cm' && await val(page, '#rv-rtext') === 'my new rule', 'switching track with unsaved rules should ask and stay: ' + JSON.stringify(page.dialogs) + await val(page, '#rv-rt'));
        page.answer = true; await page.selectOption('#rv-rt', 'ea'); await sleep(400);
        ok(await val(page, '#rv-rt') === 'ea' && await val(page, '#rv-rtext') === 'rules for ea', 'after saying yes the other track\'s rules should show: ' + await val(page, '#rv-rtext'));
        // rules that couldn't be loaded: no empty box to save over them
        S.fail['rules:standard'] = { status: 500 }; await page.selectOption('#rv-rt', 'standard'); await sleep(400);
        ok(!(await page.$('#rv-rtext')) && !(await page.$('[data-a="rules-save"]')) && await page.$('[data-a="rules-retry"]'), 'rules that failed to load should not offer an empty box and Save');
        S.fail['rules:standard'] = null; await page.click('[data-a="rules-retry"]'); await sleep(400);
        ok(await val(page, '#rv-rtext') === 'rules for standard', 'Try again did not load the rules');
        await page.close();
    });

    // 6. #12 / #26: "AI writing" that never ends can be tried again and sent; a finished review brings the header and the button up to date
    await section('6. stuck review', async () => {
        reset(); S.reviews[5] = rv(5, { aiStatus: 'pending', ai: null, updatedAt: ago(180000) });   // pending for 3 minutes
        S.reviews[6] = rv(6, { aiStatus: 'pending', ai: null, updatedAt: undefined, submittedAt: ago(200000) });   // (no updatedAt: the submission time)
        S.reviews[7] = rv(7, { aiStatus: 'pending', ai: null, updatedAt: ago(20000), submittedAt: ago(20000) });   // (still new)
        let page = await openPage('stuck');
        ok(/AI failed/.test(await txt(page, '.rv-row[data-id="5"]') || '') && /AI writing/.test(await txt(page, '.rv-row[data-id="7"]') || ''), 'the list should call a review pending for 3 minutes failed and one pending for 20 seconds writing');
        await openRow(page, 5);
        ok(await page.$('#rv-ai [data-a="retry"]') && /AI failed/.test(await txt(page, '.rv-top .chip') || ''), 'a review pending for 3 minutes should offer Try again');
        ok(await page.$eval('[data-a="finalize"]', e => !e.disabled), 'a review pending for 3 minutes should be sendable');
        await openRow(page, 6);
        ok(await page.$('#rv-ai [data-a="retry"]'), 'a pending review with no updatedAt older than 2 minutes (from submittedAt) should offer Try again');
        await openRow(page, 7);
        ok(!(await page.$('#rv-ai [data-a="retry"]')) && await page.$('#rv-ai .rv-spin') && await page.$eval('[data-a="finalize"]', e => e.disabled && /Wait/.test(e.title)), 'a review pending for 20 seconds should still be waited for');
        // #26: it finishes while it is open
        S.reviews[7].aiStatus = 'done'; S.reviews[7].ai = { summary: 'Done now.', correct: ['a'], improve: [], missed: [], at: ago(1000) }; S.reviews[7].updatedAt = ago(500);
        ok(/AI writing/.test(await txt(page, '.rv-top .chip') || ''), 'test setup: the header chip should say AI writing');
        await tick(page, 4000);
        ok(await until(async () => /Done now/.test(await txt(page, '#rv-ai') || '')), 'the finished review never showed');
        ok(/AI review ready/.test(await txt(page, '.rv-top .chip') || ''), 'the header chip is stale after the review finished: ' + await txt(page, '.rv-top .chip'));
        ok(await page.$eval('[data-a="finalize"]', e => !e.disabled && !e.hasAttribute('title')), 'the Send button keeps its "Wait for the AI review" tooltip');
        // Try again on the stuck one, then Send
        await openRow(page, 5);
        await page.click('#rv-ai [data-a="retry"]'); await sleep(500);
        ok(S.posts.some(x => x.action === 'retry' && x.id === 5) && await page.$('#rv-ai .rv-spin') && /AI writing/.test(await txt(page, '.rv-top .chip') || ''), 'Try again did not start a new review');
        await openRow(page, 6);
        page.answer = true; await page.click('[data-a="finalize"]'); await sleep(600);
        ok(S.posts.some(x => x.action === 'finalize' && x.id === 6) && /Sent/.test(await txt(page, '#rv-trainer') || ''), 'a review that never finished could not be sent');
        await page.close();
    });

    // 7. #22: a calendar in a shape the page doesn't expect
    await section('7. odd calendars', async () => {
        reset();
        S.reviews[8] = rv(8, { calendar: { week: { from: '2026-10-05', to: '2026-10-23', today: '2026-10-06', events: [{ t: 'Session expired', d: '2026-10-07', s: '09:00', e: '10:00', c: 'red;position:fixed!important;inset:0!important;z-index:9999!important', mine: true, cal: 'x' }, { t: 'Plain', d: '2026-10-08', s: '09:00', e: '10:00', c: '#d50000', cal: 'x' }] },
            appointments: [{ title: 'A', calendar: 'x', day: 'Wed', date: 'Oct 7', time: '9:00', timeZone: 'ET' }], automatedCheck: { score: 50, results: 'oops' }, requests: [] } });
        S.reviews[9] = rv(9, { calendar: { week: { from: 'x', to: 'x', events: [] }, appointments: [null], automatedCheck: { score: 50, results: [] }, requests: [] } });
        let page = await openPage('odd calendars');
        await openRow(page, 8);
        const st = await page.evaluate(() => [...document.querySelectorAll('.wk-ev')].map(e => ({ s: e.getAttribute('style'), pos: getComputedStyle(e).position, bg: getComputedStyle(e).backgroundColor })));
        ok(st.length > 0 && st.every(x => !/fixed|inset|z-index/i.test(x.s) && x.pos === 'absolute'), 'a colour from the trainee reached the page\'s CSS: ' + JSON.stringify(st));
        ok(st.some(x => x.bg === 'rgb(213, 0, 0)') && st.some(x => x.bg === 'rgb(3, 155, 229)'), 'a #hex colour should be used, and anything else gets the default: ' + JSON.stringify(st));
        ok(await page.$('#rv-notes') && await page.$('[data-a="finalize"]') && /Good start/.test(await txt(page, '#rv-ai') || ''), 'one bad field (automatedCheck.results) hid the rest of the submission');
        await openRow(page, 9);
        ok(await page.$('#rv-notes') && await page.$('[data-a="finalize"]') && /Good start/.test(await txt(page, '#rv-ai') || ''), 'a calendar with a bad date made the submission impossible to open: ' + await txt(page, '#rv-main'));
        ok(/couldn’t be shown/.test(await txt(page, '#rv-main') || '') && !(await txt(page, '#rv-banner')), 'a part that can\'t be drawn should say so without a banner');
        await page.close();
    });

    // 8. #27: what the list says while loading, with a filter that matches nothing, from a link, and when it stops updating
    await section('8. list states', async () => {
        reset(); S.reviews[5] = rv(5, { track: 'cm' }); S.reviews[6] = rv(6, { track: 'standard' }); S.delay.list = 1200;
        let page = await openPage('list states', null, { early: true });
        await page.waitForSelector('#rv-list'); await sleep(300);
        ok(/Loading/.test(await txt(page, '#rv-list') || '') && !/No submissions/.test(await txt(page, '#rv-list') || ''), 'the list should say Loading while it loads: ' + await txt(page, '#rv-list'));
        await page.waitForSelector('#rv-list .rv-row', { timeout: 4000 }); S.delay.list = 0;
        await page.selectOption('#rv-track', 'ea');
        ok(/No Executive Week · EA \/ PA submissions/.test(await txt(page, '#rv-list') || '') && await page.$('#rv-list [data-a="all-tracks"]'), 'a filter that matches nothing should say so, with a way to clear it: ' + await txt(page, '#rv-list'));
        await page.click('#rv-list [data-a="all-tracks"]');
        ok((await page.$$('#rv-list .rv-row')).length === 2 && await val(page, '#rv-track') === '', 'Show all tracks did not clear the filter');
        await page.close();
        page = await openPage('track link', '/simulators/gcal-review.html?track=CM');
        ok(await val(page, '#rv-track') === 'cm' && (await page.$$('#rv-list .rv-row')).length === 1, '?track=CM should filter on cm: ' + await val(page, '#rv-track'));
        ok(/Litigation Week · Case Management/.test(await page.$eval('#rv-track', e => e.options[e.selectedIndex].text)), 'the track names should be the program names');
        await page.close();
        page = await openPage('bad track link', '/simulators/gcal-review.html?track=nonsense');
        ok(await val(page, '#rv-track') === '' && (await page.$$('#rv-list .rv-row')).length === 2, 'an unknown ?track= should show every track: ' + await val(page, '#rv-track'));
        await page.close();
    });

    // 9. #28: nothing makes the page wider than a phone, however long a word in a description is
    await section('9. phone', async () => {
        reset();
        const long = { title: 'Consult with averyveryverylongclientsurnamewithoutanybreaks-and-more', calendar: 'Attorney', day: 'Wed', date: 'Oct 7', time: '10:00 – 10:30', timeZone: 'ET', location: 'https://example.com/' + 'a'.repeat(100),
            description: 'Call back jane.doe.rodriguez@examplelawfirm.com or see https://example.com/' + 'b'.repeat(120) };
        S.reviews[5] = rv(5, { name: 'Maximilian' + 'x'.repeat(60), calendar: Object.assign(rv(5).calendar, { appointments: [long] }) });
        let page = await openPage('phone', null, { w: 390, h: 844 });
        await openRow(page, 5); await page.click('#rv-main details summary'); await sleep(300);
        const wd = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        ok(wd.sw <= wd.cw, 'a long word in a description makes the page ' + wd.sw + 'px wide on a ' + wd.cw + 'px screen');
        await page.close();
    });

    await browser.close(); server.close();
    if (failures.length) { console.error('FAILED:\n- ' + failures.join('\n- ')); process.exit(1); }
    console.log('Trainee Evaluations page: new-tab session; a failed refresh keeps the review and the saved feedback; 401/403/423/offline banners; unsaved feedback asks before it is dropped; keyboard rows and field names; rules panel; stuck reviews; odd calendars; list states; phone width.');
})();

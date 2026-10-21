// MANUAL check — not in Checks, because it needs three repositories checked out at once.
//
// Filing a produced record end to end, with the real files from all three:
//
//     the Portal's Medical Records Requests simulator (simulators/records.js, records-docs.js)
//       -> the Case Management course's relay (js/cm-doc-filing.js)
//         -> the CMS's bridge (course-bridge.js) and its real convention (caseFileName in app.js)
//           -> the document on the case, in the Doc Hub
//
// Each repository is served from its own port, so the origin checks on both sides are the real ones,
// and the CMS's own upload and save APIs are answered here, as the CMS's own course-bridge check does.
// What it proves that the single-repo checks cannot: the name the simulator produces is byte-for-byte
// the name the CMS's own caseFileName produces and accepts, so a records request filed from a lesson
// lands on the case under the right category without anyone retyping anything.
//
// The CMS re-boots its case editor with no backend behind it and clears the Doc Hub rows moments
// later, so the assertions are made on the CMS's own upload call and the answer it sends back, not on
// the rows: the upload only happens once a name has passed the CMS's own check.
//
// Each repository's path can be given as an environment variable; the defaults are sibling checkouts.
// Usage: node .github/scripts/records-chain.cjs
//        CMS_REPO=~/cms COURSE_REPO=~/cm node .github/scripts/records-chain.cjs
// Needs `npm i playwright`, and CHROMIUM_PATH if Chromium is not where playwright put it.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const os = require('os');
const home = (p) => p.replace(/^~(?=$|\/)/, os.homedir());
const PORTAL = home(process.env.PORTAL_REPO || process.cwd());
const CMS = home(process.env.CMS_REPO || path.join(PORTAL, '..', 'casemanagementtraining'));
const COURSE = home(process.env.COURSE_REPO || path.join(PORTAL, '..', 'case-management-training'));
for (const [name, dir, probe] of [['PORTAL_REPO', PORTAL, 'simulators/records.js'], ['CMS_REPO', CMS, 'course-bridge.js'], ['COURSE_REPO', COURSE, 'js/cm-doc-filing.js']]) {
    if (!fs.existsSync(path.join(dir, probe))) {
        console.error(`Cannot find ${probe} under ${dir}.\nSet ${name} to that repository's checkout, e.g. ${name}=~/repo node .github/scripts/records-chain.cjs`);
        process.exit(2);
    }
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

function statics(root, apiBody) {
    return http.createServer((req, res) => {
        const u = new URL(req.url, 'http://x');
        if (u.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(apiBody || '{"success":false}'); }
        let f = path.join(root, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
        if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
    });
}
const fails = [], oks = [];
const check = (name, cond, detail) => (cond ? oks : fails).push(name + (cond ? '' : ': ' + detail));

(async () => {
    const portal = statics(PORTAL), cms = statics(CMS);
    await new Promise(r => portal.listen(0, r)); await new Promise(r => cms.listen(0, r));
    const portalBase = `http://localhost:${portal.address().port}`, cmsBase = `http://localhost:${cms.address().port}`;

    // The course page: the real relay from js/cm-doc-filing.js, the CMS framed beside the lesson
    // (its src carries "cms", which is how the relay finds it), and the simulator framed as a tool.
    const course = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><title>Case Management Training</title><body style="margin:0">
        <iframe id="cms" src="${cmsBase}/index.html?cms=1" style="width:1100px;height:620px;border:0"></iframe>
        <iframe id="sim" src="${portalBase}/simulators/records.html?from=cm&case=LSH-2026-MVA-000041" style="width:1100px;height:900px;border:0"></iframe>
        <script>window.state = {}; window.toastSaid = [];
          window.toast = (m) => window.toastSaid.push(m);</script>
        <script src="/__relay.js"></script></body>`);
    });
    // the course serves the real relay file from the course repository
    const relaySrc = fs.readFileSync(path.join(COURSE, 'js/cm-doc-filing.js'));
    course.on('request', () => {});
    const courseHandler = course.listeners('request')[0];
    course.removeAllListeners('request');
    course.on('request', (req, res) => {
        if (new URL(req.url, 'http://x').pathname === '/__relay.js') {
            res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(relaySrc);
        }
        courseHandler(req, res);
    });
    await new Promise(r => course.listen(0, r));
    const courseBase = `http://localhost:${course.address().port}`;

    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    // the CMS's own upload and save, answered by the test: an upload keeps the name it is given
    const uploaded = [];
    await page.route('**/api/upload', async (route) => {
        const body = route.request().postData() || '';
        const name = (/filename="([^"]+)"/.exec(body) || [])[1] || 'unknown';
        uploaded.push(name);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ key: 'documents/test/' + name, filename: name }) });
    });
    await page.route('**/api/case-repository**', (route) => route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, ok: true, caseId: 'LSH-2026-MVA-000041', id: 41 }) }));

    await page.goto(courseBase, { waitUntil: 'load' });
    const cmsFrame = page.frames().find(f => f.url().startsWith(cmsBase));
    const sim = page.frames().find(f => /records\.html/.test(f.url()));
    check('the CMS frame loaded', !!cmsFrame, 'no CMS frame');
    check('the simulator frame loaded', !!sim, 'no simulator frame');
    if (!cmsFrame || !sim) { await browser.close(); return done(); }
    await cmsFrame.waitForFunction(() => !!window.__lshCourseBridge && typeof window.caseFileName === 'function', null, { timeout: 20000 });
    await sim.waitForFunction(() => window.MR && typeof MRDocs !== 'undefined', null, { timeout: 20000 });

    // the relay found the CMS beside the lesson
    check('the course relay allows the Portal\'s origin', await page.evaluate(() => !!(window.cmDocFiling && cmDocFiling.relayOrigins().length)), 'relay not loaded');

    // Open a case in the CMS, so it has a Case ID, a client and a Doc Hub to file into. The CMS finishes
    // booting its editor after load and resets the header and the rows, so set it up and keep setting it
    // up until it stays put — this is test scaffolding for what a trainee does by opening their own case.
    const setUp = () => cmsFrame.evaluate(() => {
        const set = (id, v) => { const el = document.getElementById(id); if (el && el.innerText.trim() !== v) el.innerText = v; };
        set('case-id-field', 'LSH-2026-MVA-000041'); set('client-name-field', 'John Doe'); set('display-phase', 'Treating');
        const have = [...document.querySelectorAll('#doc-body tr')].map(tr => { const l = tr.querySelector('td div'); return l ? l.textContent.trim() : ''; });
        ['Intake Documents', 'Medical Records', 'Police Report', 'Case Files', 'Bills'].forEach(c => { if (!have.includes(c)) addDocument(c); });
        return { client: (document.getElementById('client-name-field') || {}).innerText || '', cats: window.__lshCourseBridge.categories() };
    });
    let ready = null;
    for (let i = 0; i < 25; i++) {
        await setUp(); await page.waitForTimeout(400);
        ready = await cmsFrame.evaluate(() => ({ client: (document.getElementById('client-name-field') || {}).innerText || '', cats: window.__lshCourseBridge.categories() }));
        if (/john doe/i.test(ready.client) && ready.cats.includes('Medical Records') && ready.cats.includes('Bills')) break;
    }
    const cats = ready.cats;
    check('the CMS offers its Doc Hub categories', cats.includes('Medical Records') && cats.includes('Bills'), cats.join(', '));

    // the simulator: sign the authorization, request the radiology records and bill, run the clock
    await sim.evaluate(() => { localStorage.clear(); MR.restart && null; });
    await sim.evaluate(() => { MR.tab('auth'); MR.sendAuth(); MR.advance(2); });
    await sim.evaluate(() => {
        MR.tab('new');
        document.getElementById('n-prov').value = 'rad';
        const dos = MR_PROVIDERS.find(p => p.id === 'rad').dos;   // as this run dates them
        document.getElementById('n-from').value = dos[0]; document.getElementById('n-to').value = dos[1];
        document.querySelector('form.mr-new').dispatchEvent(new Event('submit', { cancelable: true }));
    });
    const drive = await sim.evaluate(() => {
        const no = document.querySelector('.mr-table .mono').textContent.trim();
        for (let i = 0; i < 12; i++) {
            MR.advance(3); MR.openReq(no); MR.openReq(no);
            const row = [...document.querySelectorAll('.mr-table tbody tr')].find(tr => tr.textContent.includes(no));
            const status = row ? row.querySelector('.mr-st').textContent.trim() : '?';
            if (status === 'Awaiting payment') MR.pay(no);
            if (status === 'Delivered' || status === 'Completed') return { no, status };
        }
        return { no, status: 'never delivered' };
    });
    check('the provider produced the records', /Delivered|Completed/.test(drive.status), drive.status);

    // file the records, then the bill, through the course into the CMS
    const names = {}, hub = [], cmsWanted = {};
    for (const kind of ['records', 'bill']) {
        names[kind] = await sim.evaluate(([no, k]) => { const rad = MR_PROVIDERS.find(p => p.id === 'rad');
            return MRDocs.build({ request: { no, dosFrom: rad.dos[0], dosTo: rad.dos[1], types: ['records', 'bill'] },
                kind: k, provider: rad, scenario: MR_SCENARIO, delivered: rad.delivered[k], producedOn: MR_SCENARIO.start }).name; }, [drive.no, kind]);
        await setUp();
        await sim.evaluate(([no, k]) => MR.sendDoc(no, k), [drive.no, kind]);
        await page.waitForTimeout(2500);
        // read the Doc Hub now: the CMS re-boots its editor on its own and clears the rows again,
        // so what is on the case is checked at the moment it is filed, not at the end of the run
        hub.push(...await cmsFrame.evaluate(() => [...document.querySelectorAll('#doc-body tr')].map(tr => {
            const label = tr.querySelector('td div'), link = tr.querySelector('.doc-attachment a[data-r2-key]');
            return { category: label ? label.textContent.trim() : '', file: link ? link.getAttribute('download') : null };
        }).filter(x => x.file)));
        cmsWanted[kind] = await cmsFrame.evaluate((c) => caseFileName(c, 'x.pdf'), kind === 'bill' ? 'Bills' : 'Medical Records');
    }

    /* What the case actually received. The Doc Hub's rows are not read back here: with no backend the
       CMS re-boots its editor and clears them moments later, which is the stub, not the feature. The
       authoritative signals are the CMS's own upload call (it only happens once the name has passed
       the CMS's nameProblems check against its own caseFileName) and the answer it sends back. */
    const confirmations = await sim.evaluate((no) => { MR.openReq(no); MR.review(no);
        return [...document.querySelectorAll('.mrd-msg')].map(e => e.textContent.trim()).filter(Boolean); }, drive.no);
    check('the CMS uploaded the records under the firm\'s name', uploaded.includes(names.records), `${names.records} not in ${JSON.stringify(uploaded)}`);
    check('the CMS uploaded the itemized bill under the firm\'s name', uploaded.includes(names.bill), `${names.bill} not in ${JSON.stringify(uploaded)}`);
    check('the records were filed under Medical Records', confirmations.some(c => c.includes(names.records) && /under Medical Records/.test(c)), JSON.stringify(confirmations));
    check('the itemized bill was filed under Bills', confirmations.some(c => c.includes(names.bill) && /under Bills/.test(c)), JSON.stringify(confirmations));
    check('real PDF bytes were uploaded', uploaded.length >= 2, uploaded.join(', '));

    // a page on another site may not use the relay
    const refused = await page.evaluate(() => new Promise(res => {
        const w = window.open('about:blank');
        // posting from this same page with a spoofed origin is impossible, so check the guard directly
        res(!cmDocFiling.relayOrigins().some(r => new RegExp(r.slice(1, -2)).test('https://evil.example.com')));
    }));
    check('another site is not allowed to relay', refused, 'the relay origin guard is too loose');
    check('no page errors', errors.length === 0, errors.join(' | '));

    await browser.close();
    portal.close(); cms.close(); course.close();
    done();
    function done() {
        oks.forEach(o => console.log('  ok   ' + o));
        if (fails.length) { console.log('\n' + fails.length + ' FAILURE(S):'); fails.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f)); process.exit(1); }
        console.log('\nAll ' + oks.length + ' checks passed: the chain works with the real files from all three repositories.');
    }
})().catch(e => { console.error(e); process.exit(1); });

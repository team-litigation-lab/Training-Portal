// What a produced records request actually is, and where it goes (simulators/records-docs.js).
//
// A request that is produced is not a line of prose: the records and the itemized bill are documents.
// This drives the Medical Records Requests simulator end to end - sign the authorization, send a
// request, pay the invoice, run the clock until the provider produces - and then checks that what
// came back is a real document: the patient's identifiers on it, the bill itemized with CPT codes and
// totalling to the ledger, a real PDF out of it, and the name in the firm's convention
// (<Case ID>_<Last-First>_<Type>_<YYYY-MM-DD>.pdf, the Type being the Doc Hub category).
// Then where it goes: the platform the trainee came from is read from the link (?from=, ?case=), and
// "File it" hands the document to that platform in the CMS's own cms-doc-file protocol - here a stand-in
// that frames the simulator and answers it, as the CMS beside a lesson does. Opened with no platform at
// all, the download is still the way through and the file is named NO-CASE-ID_... as the CMS names a file
// uploaded before its case has an ID.
// Usage: node .github/scripts/records-docs.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"success":false,"error":"offline test"}'); }
    // a stand-in for the platform the trainee came from: it frames the simulator and files what it is sent
    if (u.pathname === '/__host') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><title>host</title><body><iframe id="f" src="/simulators/records.html?from=cms&case=LSH-2026-MVA-000041" style="width:1200px;height:800px"></iframe>
        <script>window.__filed = [];
        addEventListener('message', (e) => { const d = e.data; if (!d || d.lsh !== 'cms-doc-file') return;
            window.__filed.push({ name: d.name, category: d.category, mime: d.mime, bytes: d.bytes ? d.bytes.byteLength : 0, summary: d.summary,
                head: new TextDecoder().decode(new Uint8Array(d.bytes).slice(0, 8)) });
            e.source.postMessage({ lsh: 'cms-doc-filed', id: d.id, ok: true, name: d.name, category: d.category, problems: [] }, '*'); });
        </script></body>`);
    }
    let f = path.join(ROOT, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});

const fails = [], oks = [];
const check = (name, cond, detail) => (cond ? oks : fails).push(name + (cond ? '' : ': ' + detail));

(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());

    await page.goto(base + '/__host', { waitUntil: 'load' });
    const sim = page.frames().find(f => /records\.html/.test(f.url()));
    await sim.waitForFunction(() => window.MR && typeof MRDocs !== 'undefined' && document.querySelector('.mr-table, .mr-brief'), null, { timeout: 20000 });

    // where it thinks it is, and the name it would give a file
    const dest = await sim.evaluate(() => MRDocs.dest());
    check('destination read from ?from=cms', dest.key === 'cms', JSON.stringify(dest));
    check('Case ID read from ?case=', dest.caseId === 'LSH-2026-MVA-000041', dest.caseId);

    // sign the authorization, then request records + bill from the radiology centre (it charges a fee)
    await sim.evaluate(() => { MR.tab('auth'); MR.sendAuth(); MR.advance(2); });
    await sim.evaluate(() => {
        MR.tab('new');
        document.getElementById('n-prov').value = 'rad';
        const dos = MR_PROVIDERS.find(p => p.id === 'rad').dos;   // the dates this provider holds, as this run dates them
        document.getElementById('n-from').value = dos[0];
        document.getElementById('n-to').value = dos[1];
        document.querySelector('form.mr-new').dispatchEvent(new Event('submit', { cancelable: true }));
    });
    // run the clock, paying the invoice when it is issued, until the provider produces
    const drive = await sim.evaluate(() => {
        const no = document.querySelector('.mr-table .mono').textContent.trim();
        const steps = [];
        for (let i = 0; i < 12; i++) {
            MR.advance(3); MR.openReq(no); MR.openReq(no);   // openReq toggles; a double call leaves it open
            const row = [...document.querySelectorAll('.mr-table tbody tr')].find(tr => tr.textContent.includes(no));
            const status = row ? row.querySelector('.mr-st').textContent.trim() : '?';
            steps.push(status);
            if (status === 'Awaiting payment') MR.pay(no);
            if (status === 'Delivered' || status === 'Completed') break;
        }
        return { no, steps };
    });
    check('the request reaches Delivered', /Delivered|Completed/.test(drive.steps[drive.steps.length - 1]), drive.steps.join(' -> '));

    const delivered = await sim.evaluate((no) => {
        MR.review(no);
        return { no, html: document.getElementById('mr-review').innerHTML };
    }, drive.no);
    check('the records request was produced', /Download PDF/.test(delivered.html), delivered.html.slice(0, 400));
    check('the itemized bill shows its line count and total', /itemized line/.test(delivered.html) && /\$3,950\.00/.test(delivered.html), 'no itemized total in the review');
    check('the file name follows the convention', /LSH-2026-MVA-000041_Doe-John_(Medical-Records|Bills)_\d{4}-\d{2}-\d{2}\.pdf/.test(delivered.html), 'name not in the review block');

    // the document itself, on paper
    const paper = await sim.evaluate((no) => { MR.showDoc(no, 'bill'); return document.getElementById('mr-review').innerHTML; }, delivered.no);
    check('the bill opens as a document', /mrd-paper/.test(paper) && /ITEMIZED BILLING STATEMENT/.test(paper), 'no paper rendered');
    check('the bill is itemized with CPT codes', /72148/.test(paper) && /70551/.test(paper), 'CPT codes missing');
    check('the bill totals', /Total charges/.test(paper) && /\$3,950\.00/.test(paper), 'no total row');
    check('the patient identifiers are on the document', /John Doe/.test(paper) && /08\/14\/1980/.test(paper), 'identifiers missing');

    // a real PDF comes out, named the firm's way
    const pdf = await sim.evaluate((no) => {
        const rad = MR_PROVIDERS.find(p => p.id === 'rad');
        const doc = MRDocs.build({ request: { no, dosFrom: rad.dos[0], dosTo: rad.dos[1], types: ['records', 'bill'] }, kind: 'bill',
            provider: rad, scenario: MR_SCENARIO, delivered: rad.delivered.bill, producedOn: MR_SCENARIO.start });
        const p = MRDocs.pdfDoc(doc);
        const bytes = new Uint8Array(p.output('arraybuffer'));
        return { name: doc.name, category: doc.category, size: bytes.length, head: String.fromCharCode.apply(null, bytes.slice(0, 5)) };
    }, delivered.no);
    check('a real PDF is produced', pdf.head === '%PDF-' && pdf.size > 2000, JSON.stringify(pdf));
    check('the bill files under Bills', pdf.category === 'Bills', pdf.category);
    check('the PDF is named the firm\'s way', /^LSH-2026-MVA-000041_Doe-John_Bills_\d{4}-\d{2}-\d{2}\.pdf$/.test(pdf.name), pdf.name);

    // "File it" reaches the platform that framed the simulator
    await sim.evaluate((no) => MR.sendDoc(no, 'bill'), delivered.no);
    await page.waitForTimeout(1200);
    const filed = await page.evaluate(() => window.__filed);
    check('the document reached the platform', filed.length >= 1, JSON.stringify(filed));
    if (filed.length) {
        check('it arrived as a PDF with bytes', filed[0].head.startsWith('%PDF') && filed[0].bytes > 2000, JSON.stringify(filed[0]));
        check('it arrived with its category and name', filed[0].category === 'Bills' && /_Doe-John_Bills_/.test(filed[0].name), JSON.stringify(filed[0]));
    }
    const after = await sim.evaluate((no) => { MR.openReq(no); MR.review(no); return document.getElementById('mr-review').innerHTML; }, delivered.no);
    check('the simulator records that it was filed', /Filed in the CMS Platform as/.test(after), 'no confirmation shown');

    // the Case File tab lists every document produced
    const fileTab = await sim.evaluate(() => { MR.tab('file'); return document.getElementById('mr-pane').innerHTML; });
    check('the Case File tab names the destination', /belong to the case file in the CMS Platform/.test(fileTab), 'destination card missing');
    check('the Case File tab lists the documents produced', /Documents Produced/.test(fileTab) && /Filed/.test(fileTab), 'production table missing');

    // scoring still works, untouched
    const sc = await sim.evaluate(() => { MR.tab('score'); return document.getElementById('mr-pane').innerText.slice(0, 120); });
    check('the objectives still score', /Objectives/.test(sc), sc);

    // opened on its own, with no platform: the download is still the way through
    const solo = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const soloErr = [];
    solo.on('pageerror', e => soloErr.push(e.message));
    solo.on('dialog', d => d.accept());
    await solo.goto(base + '/simulators/records.html', { waitUntil: 'load' });
    await solo.waitForFunction(() => window.MR && typeof MRDocs !== 'undefined', null, { timeout: 15000 });
    const soloDest = await solo.evaluate(() => { localStorage.clear(); return MRDocs.dest(); });
    check('no launcher falls back to the Portal', soloDest.key === 'portal', JSON.stringify(soloDest));
    const noId = await solo.evaluate(() => MRDocs.fileName({ caseId: '', patient: { name: 'John Doe' }, kind: 'records' }));
    check('without a Case ID the file is NO-CASE-ID_…', /^NO-CASE-ID_Doe-John_Medical-Records_/.test(noId), noId);
    const sideways = await solo.evaluate(() => { MR.tab('file'); return document.documentElement.scrollWidth > window.innerWidth + 1; });
    check('the Case File tab does not scroll sideways on a phone', !sideways, 'it scrolls sideways');
    check('no page errors', errors.length === 0 && soloErr.length === 0, [].concat(errors, soloErr).join(' | '));

    await browser.close(); server.close();
    oks.forEach(o => console.log('  ok   ' + o));
    if (fails.length) { console.log('\n' + fails.length + ' FAILURE(S):'); fails.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f)); process.exit(1); }
    console.log('\nAll ' + oks.length + ' checks passed.');
})().catch(e => { console.error(e); process.exit(1); });

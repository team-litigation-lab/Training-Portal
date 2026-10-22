// Filing a drafted letter into the case file, and the grade for it (simulators/drafting-docs.js).
//
// A drafting activity doesn't end at a download: the 1P/3P Letters of Representation and a medical
// provider's lien and records-request letters are files, and they have to reach the case file in the
// CMS, under the right tab, named the firm's way. This checks that half of the activity.
// Checked here: the destination and Case ID are read from the link (?from=, ?case=); each letter
// knows the Doc Hub tab the firm keeps it in; the file name is the firm's convention and is the SAME
// name simulators/records-docs.js produces for the same inputs, so the two cannot drift apart; a
// missing or wrong tab is refused naming the tab the firm uses, and nothing is sent; the right tab
// and name hand the drafted letter's own PDF to the platform that opened the activity, in the CMS's
// cms-doc-file protocol (here a stand-in that frames the page and answers it, as the CMS beside a
// lesson does); the CMS has the last word on the name, and its refusal comes back as the grade; with
// no platform listening nothing is graded and the download is the way through; and the score is what
// the filing took to get right.
// The page under test is a fixture served by this test: the shared drafting tool it belongs to is not
// built yet, so this exercises the filing module on its own, which is what it is for.
// Usage: node .github/scripts/drafting-docs.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const CASE = 'LSH-2026-MVA-000041';

// The letter the fixture drafts: a 1P LOR on John Doe, as the activity would hand it over.
const LETTER = `const LINES = ['February 9, 2026', '', 'Harbor Point Insurance', 'Attn: Claims Department', '',
    'Re: Our Client: John Doe', '', 'Please be advised that this office has been retained to represent John Doe',
    'with regards to a motor vehicle collision on February 6, 2026.', '', 'Very truly yours,', '', 'Sandy Van, Esq.'];`;

const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"success":false,"error":"offline test"}'); }
    // the page under test: the filing module, with a letter to file and jsPDF, as a drafting tool would load it
    if (u.pathname === '/__probe') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><title>drafting (fixture)</title><body>
        <script src="${JSPDF}"></script>
        <script src="/simulators/records-docs.js"></script>
        <script src="/simulators/drafting-docs.js"></script>
        <script>${LETTER}
        window.makeDoc = (kind) => DraftingDocs.build({ kind, client: { name: 'John Doe', dol: '2026-02-06' },
            recipient: 'Harbor Point Insurance', drafter: 'Upload Trainee', lines: LINES });
        </script></body>`);
    }
    // a stand-in for the platform the trainee came from: it frames the page and files what it is sent
    if (u.pathname === '/__host') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><title>host</title><body><iframe id="f" src="/__probe?from=cm&case=${CASE}" style="width:1200px;height:800px"></iframe>
        <script>window.__filed = []; window.__reject = null;
        addEventListener('message', (e) => { const d = e.data; if (!d || d.lsh !== 'cms-doc-file') return;
            // the CMS's own name rule, spelled out here so the page's half can be tested on its own
            const day = () => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0'); };
            const want = ${JSON.stringify(CASE)} + '_Doe-John_' + String(d.category).replace(/[^A-Za-z0-9]+/g, '-') + '_' + day() + '.pdf';
            if (window.__reject || d.name !== want) return e.source.postMessage({ lsh: 'cms-doc-filed', id: d.id, ok: false,
                problems: ['The name should be "' + want + '".'] }, '*');
            window.__filed.push({ name: d.name, category: d.category, mime: d.mime, summary: d.summary,
                bytes: d.bytes ? d.bytes.byteLength : 0,
                head: new TextDecoder().decode(new Uint8Array(d.bytes).slice(0, 5)) });
            e.source.postMessage({ lsh: 'cms-doc-filed', id: d.id, ok: true, name: d.name, category: d.category, problems: [] }, '*'); });
        </script></body>`);
    }
    let f = path.join(ROOT, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});

const fails = [], oks = [];
const check = (name, cond, detail) => (cond ? oks : fails).push(name + (cond ? '' : ': ' + detail));
const day = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());

    await page.goto(base + '/__host', { waitUntil: 'load' });
    const sim = page.frames().find(f => /__probe/.test(f.url()));
    await sim.waitForFunction(() => typeof DraftingDocs !== 'undefined' && window.jspdf && window.makeDoc, null, { timeout: 20000 });

    // 1. where it thinks it is, and the case it is filing into
    const dest = await sim.evaluate(() => DraftingDocs.dest());
    check('destination read from ?from=cm', dest.key === 'cm', JSON.stringify(dest));
    check('Case ID read from ?case=', dest.caseId === CASE, dest.caseId);

    // 2. the tab the firm keeps each letter in
    const tabs = await sim.evaluate(() => Object.keys(DraftingDocs.KINDS).reduce((o, k) => (o[k] = DraftingDocs.category(k), o), {}));
    check('the 1P LOR is filed under Others', tabs.lor1p === 'Others', tabs.lor1p);
    check('the 3P LOR is filed under Others', tabs.lor3p === 'Others', tabs.lor3p);
    check('the Lien Balance Verification is filed under Others', tabs.lienbv === 'Others', tabs.lienbv);
    check('the Medical LOR is filed under Medical Records', tabs.medlor === 'Medical Records', tabs.medlor);
    check('the HITECH request is filed under Medical Records', tabs.hitech === 'Medical Records', tabs.hitech);
    const allTabs = await sim.evaluate(() => DraftingDocs.TABS);
    check('the picker offers every Doc Hub tab, not only the ones these letters use', allTabs.length === 9, JSON.stringify(allTabs));

    // 3. the name is the firm's convention — and the same name records-docs.js would produce
    const names = await sim.evaluate(() => {
        const d = window.makeDoc('medlor');
        return { mine: DraftingDocs.fileName(d),
                 theirs: MRDocs.fileName({ caseId: d.caseId, patient: { name: 'John Doe' }, kind: 'records' }),
                 pattern: DraftingDocs.pattern(d),
                 noCase: DraftingDocs.fileName({ caseId: '', client: { name: 'John Doe' }, kind: 'medlor' }) };
    });
    check('the name is the firm\'s convention', names.mine === `${CASE}_Doe-John_Medical-Records_${day()}.pdf`, names.mine);
    check('and is the same name records-docs.js gives the same inputs (no drift)', names.mine === names.theirs,
        `${names.mine} vs ${names.theirs}`);
    check('the pattern shown to the trainee names no file for them', /_<Last-First>_<Type>_/.test(names.pattern), names.pattern);
    check('before a case has an ID, the name says so as the CMS does', /^NO-CASE-ID_/.test(names.noCase), names.noCase);

    /* fill the answer in and file it the way a tool's button would */
    const file = (kind, tab, name) => sim.evaluate(async (a) => {
        const d = window.makeDoc(a.kind);
        const out = await DraftingDocs.send(d, { tab: a.tab, name: a.name === '@right' ? d.name : a.name });
        return out;
    }, { kind, tab, name });

    // 4. the tab is the trainee's answer: a wrong or missing one is refused, and nothing is sent
    let out = await file('lor1p', '', '@right');
    check('no tab chosen is refused', out.graded && /Choose the CMS tab/i.test(out.problems.join(' ')), JSON.stringify(out));
    out = await file('lor1p', 'Medical Records', '@right');
    check('the wrong tab is refused naming the tab the firm uses',
        out.graded && /files this letter under Others, not Medical Records/i.test(out.problems.join(' ')), JSON.stringify(out));
    check('and nothing is sent to the platform at all', (await page.evaluate(() => window.__filed.length)) === 0, 'something was filed');
    out = await file('lor1p', 'Others', '');
    check('no file name is refused with the convention', out.graded && /_<Last-First>_<Type>_/.test(out.problems.join(' ')), JSON.stringify(out));
    check('still nothing sent', (await page.evaluate(() => window.__filed.length)) === 0, 'something was filed');

    // 5. the right tab, a wrong name: the CMS refuses it, and nothing is filed
    out = await file('lor1p', 'Others', 'LOR Harbor Point.pdf');
    check('a wrong name is refused by the CMS, with what it expects',
        out.ok === false && /The name should be/i.test((out.problems || []).join(' ')), JSON.stringify(out));
    check('and nothing is filed', (await page.evaluate(() => window.__filed.length)) === 0, 'something was filed');

    // 6. the right tab and name: the drafted letter's own PDF is filed
    out = await file('lor1p', 'Others', '@right');
    check('the letter is filed', out.ok === true, JSON.stringify(out));
    const got = await page.evaluate(() => window.__filed[0] || null);
    check('the platform received it under that name', !!got && got.name === `${CASE}_Doe-John_Others_${day()}.pdf`, JSON.stringify(got && got.name));
    check('under the tab the trainee chose', !!got && got.category === 'Others', JSON.stringify(got && got.category));
    check('as a real PDF, not a placeholder', !!got && got.head === '%PDF-' && got.bytes > 800, JSON.stringify(got && { head: got.head, bytes: got.bytes }));
    check('sent as the PDF it is', !!got && got.mime === 'application/pdf', JSON.stringify(got && got.mime));
    check('with the letter named in the summary', !!got && /Letter of Representation/.test(got.summary), JSON.stringify(got && got.summary));

    // 7. the medical letters go up under their own tab
    out = await file('medlor', 'Medical Records', '@right');
    check('the Medical LOR files under Medical Records', out.ok === true, JSON.stringify(out));
    const got2 = await page.evaluate(() => window.__filed[1] || null);
    check('and is named for that tab', !!got2 && got2.name === `${CASE}_Doe-John_Medical-Records_${day()}.pdf`, JSON.stringify(got2 && got2.name));

    // 8. the score: what the filing took to get right, and nothing for a letter never filed
    const scores = await sim.evaluate(() => ({
        first: DraftingDocs.score({ filed: true, attempts: 1 }),
        third: DraftingDocs.score({ filed: true, attempts: 3 }),
        many: DraftingDocs.score({ filed: true, attempts: 9 }),
        never: DraftingDocs.score({ filed: false, attempts: 4 }),
        grade: DraftingDocs.grade(window.makeDoc('lor1p'), { filed: true, attempts: 1, name: 'x.pdf', category: 'Others' })
    }));
    check('filed first time is the whole mark', scores.first === 100, String(scores.first));
    check('each refused attempt costs a fifth', scores.third === 60, String(scores.third));
    check('with a floor, so a letter filed in the end still counts', scores.many === 40, String(scores.many));
    check('a letter never filed scores nothing', scores.never === 0, String(scores.never));
    check('the grade names the simulator the trainer reads', scores.grade.simulator === 'Document Filing', JSON.stringify(scores.grade.simulator));
    check('and says it was first time right', /first time right/.test(scores.grade.summary), scores.grade.summary);

    // 9. no platform listening: not the trainee's mistake, so it is not graded
    await page.goto(base + '/__probe?from=cm&case=' + CASE, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof DraftingDocs !== 'undefined' && window.jspdf && window.makeDoc, null, { timeout: 20000 });
    const alone = await page.evaluate(async () => {
        const d = window.makeDoc('lor1p');
        return { can: DraftingDocs.canSend(), noListener: DraftingDocs.NO_LISTENER,
                 out: await DraftingDocs.send(d, { tab: 'Others', name: d.name }) };
    });
    check('opened on its own, there is nothing to file into', alone.can === false, JSON.stringify(alone.can));
    check('and it says to download the letter instead, without grading it',
        alone.out.reason === alone.noListener && !alone.out.graded && /[Dd]ownload the letter/.test(alone.out.error), JSON.stringify(alone.out));

    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    server.close();

    oks.forEach(o => console.log('PASS ' + o));
    fails.forEach(f => console.log('FAIL ' + f));
    console.log(`\n${oks.length} passed, ${fails.length} failed.`);
    process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

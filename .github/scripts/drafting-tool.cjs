// The Drafting tool (simulators/drafting.js): each letter opens as the firm's original, the trainee edits it on their
// own computer — ✎ Edit in Word for Word or any word processor, ✎ Edit in PDF for any PDF editor — and uploads it back,
// where it is checked and scored to their progress.
//
// Checked here, as a trainee does it: the original opens read-only with ✎ Edit in Word · ✎ Edit in PDF, each handing
// over the firm's own file named the trainers' way; an uploaded Word file is checked (a highlight left in it is found,
// Word's or the shading LibreOffice and Google Docs save one as; taken off, it passes), kept on the account and scored
// to the trainee's progress; an uploaded PDF is read back the same way (yellow left on it is found; a clean one passes),
// kept and scored; a file that is not what it says is refused and scores nothing; what was uploaded is listed again
// after a reload; a MedLOR's original shows the client's signed HIPAA, its pages drawn, and the HIPAA's steps; every
// letter the firm sent opens as its original; and at phone width the page doesn't scroll sideways.
// Usage: node .github/scripts/drafting-tool.cjs   (from the repository root; needs `npm i playwright`)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.pdf': 'application/pdf' };

// The trainee is signed in; their account keeps letters and files the way functions/api/drafting-drafts.js does, and
// their scores reach /api/sim-results as Sim.saveResult sends them.
const ANN = { username: 'ann', userType: 'Trainee', fullName: 'Ann Lee', batchId: 'B1' };
let ACCOUNT = {}, RESULTS = [];
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (o, st) => { res.writeHead(st || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const body = () => new Promise(r => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => r(JSON.parse(b || '{}'))); });
    if (u.pathname === '/api/me') return send({ success: true, user: ANN });
    if (u.pathname === '/api/heartbeat') return send({ success: true });
    if (u.pathname === '/api/sim-results' && req.method === 'POST') return body().then(b => { RESULTS.push(b); send({ success: true }); });
    if (u.pathname === '/api/drafting-drafts') {
        if (req.method === 'GET') {
            const l = u.searchParams.get('letter'), r = ACCOUNT[l];
            if (l == null) return send({ success: true, letters: Object.keys(ACCOUNT).map(k => ({ letter: k, updatedAt: ACCOUNT[k].updatedAt })) });
            return send({ success: true, letter: l, data: r ? r.data : null, updatedAt: r ? r.updatedAt : null });
        }
        return body().then(b => {
            const at = new Date(Date.now() + Object.keys(ACCOUNT).length).toISOString();
            ACCOUNT[b.letter] = { data: b.data, updatedAt: at };
            send({ success: true, updatedAt: at });
        });
    }
    if (u.pathname.startsWith('/api/')) return send({ success: false, error: 'offline test' });
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
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const dialogs = [];
    page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
    const original = () => page.waitForFunction(() => /Original/.test((document.querySelector('#dr-wd .wd-title [data-state]') || {}).textContent || ''), null, { timeout: 30000 });
    const checks = () => page.$$eval('#dr-check .dr-checks li', ls => ls.map(l => (l.querySelector('.ok') ? '✓ ' : '✗ ') + l.querySelector('div').firstChild.textContent));
    const upload = async (kind, buffer, name) => {
        const n = RESULTS.length;
        await page.setInputFiles(`#dr-edit input[onchange*="'${kind}'"]`, { name, mimeType: kind === 'pdf' ? 'application/pdf' : TYPES['.docx'], buffer });
        for (let i = 0; i < 300 && RESULTS.length === n; i++) await new Promise(r => setTimeout(r, 100));
        return RESULTS.length > n ? RESULTS[RESULTS.length - 1] : null;
    };
    // the template with its document.xml changed in the page (JSZip is on it), as a word processor would save it
    const docxWith = (from, to) => page.evaluate(async ({ from, to }) => {
        const zip = await JSZip.loadAsync(await (await fetch('/simulators/drafting/templates/1P_LOR.docx')).arrayBuffer());
        const xml = await zip.file('word/document.xml').async('string');
        zip.file('word/document.xml', xml.replace(new RegExp(from, 'g'), to));
        return zip.generateAsync({ type: 'base64' });
    }, { from, to }).then(b => Buffer.from(b, 'base64'));

    // 0. the page opens on the firm's original, read-only, with ✎ Edit in Word · ✎ Edit in PDF
    await page.goto(base + '/simulators/drafting.html?tab=lor1p', { waitUntil: 'load' });
    await page.waitForSelector('section.docx > article', { timeout: 30000 });
    await original();
    check('the original opens read-only', await page.$$eval('section.docx > article', as => as.length > 0 && as.every(a => a.contentEditable !== 'true')), 'an editable article');
    const acts = await page.$$eval('.dr-docacts .sim-btn', bs => bs.map(b => b.textContent.trim()).join(' | '));
    check('✎ Edit in Word · ✎ Edit in PDF', acts === '✎ Edit in Word | ✎ Edit in PDF', acts);
    check('no editor on the page any more', !(await page.$('.wd-ribbon')) && !(await page.$('[contenteditable="true"]')), 'an editor');

    // 1. ✎ Edit in Word hands over the firm's .docx, named the trainers' way, and puts the Word steps first
    const tplDocx = fs.readFileSync(path.join(ROOT, 'simulators/drafting/templates/1P_LOR.docx'));
    let [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-word]')]);
    check('Edit in Word downloads the firm\'s own Word file', fs.readFileSync(await dl.path()).equals(tplDocx), 'another file');
    // (the name is the link's own: headless Chromium reports every download as "download")
    const wordName = await page.$eval('[data-word]', a => a.getAttribute('download'));
    check('named the trainers\' way', /^INS – 1P .* - LOR \d\d\.\d\d\.\d{4} \(Ann\)\.docx$/.test(wordName), wordName);
    check('and the steps for Word, or any word processor, come first', await page.$eval('#dr-edit [data-way="word"]', el => el.classList.contains('on') && /LibreOffice Writer/.test(el.textContent) && /Google Docs/.test(el.textContent)), 'not shown');
    // ✎ Edit in PDF hands over the same letter as a PDF
    [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-pdfedit]')]);
    const tplPdf = fs.readFileSync(path.join(ROOT, 'simulators/drafting/pdf/templates/1P_LOR.pdf'));
    const pdfName = await page.$eval('[data-pdfedit]', a => a.getAttribute('download'));
    check('Edit in PDF downloads the letter as a PDF, for any PDF editor', fs.readFileSync(await dl.path()).equals(tplPdf) && pdfName === wordName.replace(/\.docx$/, '.pdf')
        && await page.$eval('#dr-edit [data-way="pdf"]', el => el.classList.contains('on') && /LibreOffice Draw/.test(el.textContent)), pdfName);

    // 2. a Word file uploaded untouched: checked, the highlights found, kept on the account, scored to progress
    let r = await upload('docx', tplDocx, 'INS – 1P.docx');
    let cs = await checks();
    check('an uploaded Word file is checked', cs.length >= 5, cs.join(' | '));
    check('the highlights left in it are found', cs.some(c => c === '✗ No highlighted text left'), cs.join(' | '));
    check('its score goes to the trainee\'s progress', !!r && r.simulator === 'Drafting — LOR' && r.details.editedIn === 'word' && r.score < 100 && /Edited in Word/.test(r.summary), JSON.stringify(r && r.summary));
    const keptDocx = ACCOUNT['lor1p:docx'] && JSON.parse(ACCOUNT['lor1p:docx'].data);
    check('the Word file is kept on the account, as uploaded', !!keptDocx && Buffer.from(keptDocx.b64, 'base64').equals(tplDocx), 'not kept');
    await new Promise(res => setTimeout(res, 3000));            // the draft goes to the account 2.5 s after the last change
    check('and its text too, as the letter\'s draft', !!ACCOUNT['lor1p'], 'no draft');
    // the highlight taken off: that check passes
    r = await upload('docx', await docxWith('<w:highlight w:val="[a-zA-Z]+"/>', ''), 'INS – 1P.docx');
    cs = await checks();
    check('with the highlight taken off, that check passes', cs.some(c => c === '✓ No highlighted text left') && r && r.score > 0, cs.join(' | '));
    // LibreOffice and Google Docs save a highlight as the run's shading: still a highlight
    r = await upload('docx', await docxWith('<w:highlight w:val="[a-zA-Z]+"/>', '<w:shd w:val="clear" w:color="auto" w:fill="FFFF00"/>'), 'INS – 1P.docx');
    cs = await checks();
    check('a highlight saved as shading (LibreOffice, Google Docs) is found too', cs.some(c => c === '✗ No highlighted text left'), cs.join(' | '));
    // not a Word file: refused, nothing scored
    let n = RESULTS.length;
    await page.setInputFiles('#dr-edit input[onchange*="\'docx\'"]', { name: 'letter.docx', mimeType: TYPES['.docx'], buffer: Buffer.from('not a word file') });
    await new Promise(res => setTimeout(res, 1500));
    check('a file that is not a Word document is refused, and nothing is scored', RESULTS.length === n && dialogs.some(d => /not a Word document/.test(d)), dialogs.join(' | '));

    // 3. a PDF edited in any PDF editor: read back, checked, kept, scored
    r = await upload('pdf', tplPdf, 'INS – 1P.pdf');
    cs = await checks();
    check('an uploaded PDF is read back and checked', cs.length >= 4 && cs.some(c => /dated today/.test(c)), cs.join(' | '));
    check('the yellow left on it is found', cs.some(c => c === '✗ No highlighted text left'), cs.join(' | '));
    check('its score goes to the trainee\'s progress', !!r && r.details.editedIn === 'pdf' && /a PDF editor/.test(r.summary) && /PLS UPDATE/.test(r.details.letter), JSON.stringify(r && r.summary));
    const keptPdf = ACCOUNT['lor1p:pdf'] && JSON.parse(ACCOUNT['lor1p:pdf'].data);
    check('the PDF is kept on the account, as uploaded', !!keptPdf && Buffer.from(keptPdf.b64, 'base64').equals(tplPdf), 'not kept');
    // a clean PDF, dated today (made in the page with pdf-lib, as an editor would save it)
    const clean = await page.evaluate(async () => {
        const d = await PDFLib.PDFDocument.create(), pg = d.addPage([612, 792]), f = await d.embedFont(PDFLib.StandardFonts.Helvetica);
        const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        [today, 'SENT VIA E-MAIL', 'Our Client: Jane Doe'].forEach((t, i) => pg.drawText(t, { x: 72, y: 700 - i * 20, size: 11, font: f }));
        return btoa(String.fromCharCode.apply(null, await d.save()));
    }).then(b => Buffer.from(b, 'base64'));
    await upload('pdf', clean, 'clean.pdf');
    cs = await checks();
    check('a PDF with no yellow left, dated today, passes those checks', cs.some(c => c === '✓ No highlighted text left') && cs.some(c => /^✓ The letter is dated today/.test(c)), cs.join(' | '));
    n = RESULTS.length;
    await page.setInputFiles('#dr-edit input[onchange*="\'pdf\'"]', { name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
    await new Promise(res => setTimeout(res, 1500));
    check('a file that is not a PDF is refused, and nothing is scored', RESULTS.length === n && dialogs.some(d => /not a PDF/.test(d)), dialogs.join(' | '));
    // what was uploaded is there after a reload, to download again
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => /Word file is on the platform/.test((document.querySelector('#dr-edit [data-saved]') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const saved = await page.textContent('#dr-edit [data-saved]');
    check('after a reload, the uploads are listed', /Word file is on the platform/.test(saved) && /PDF is on the platform/.test(saved), saved);
    [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dr-edit button:has-text("Download my PDF")')]);
    check('and download as they were uploaded', fs.readFileSync(await dl.path()).equals(clean), 'another file');

    // 4. a MedLOR's original comes with the client's signed HIPAA under it, its pages drawn, and the HIPAA's steps beside it
    await page.goto(base + '/simulators/drafting.html?tab=prov&kind=medlor', { waitUntil: 'load' });
    await page.waitForSelector('#dr-hipaa canvas', { timeout: 30000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelectorAll('#dr-hipaa canvas').length >= 2, null, { timeout: 15000 }).catch(() => {});
    const hipSrc = await page.$eval('#dr-hipaa a[download]', a => a.getAttribute('href'));
    const hipPages = await page.$$eval('#dr-hipaa canvas', cs => cs.filter(c => c.width > 0 && c.height > 0).length);
    check('the MedLOR\'s original shows the client\'s signed HIPAA, the firm\'s own PDF, its two pages drawn',
        fs.existsSync(path.join(ROOT, decodeURIComponent(hipSrc))) && hipPages === 2, hipSrc + ', ' + hipPages + ' pages drawn');
    check('and the HIPAA\'s steps are there', /The client's signed HIPAA/.test(await page.textContent('.dr-side')) && !!(await page.$('.dr-side .dr-hip')), 'no Step 2');

    // 5. every letter the firm sent opens as its original, with its PDF for Edit in PDF
    const sweep = await page.evaluate(async () => {
        const wait = async () => { for (let i = 0; i < 200; i++) { await new Promise(r => setTimeout(r, 100));
            const st = document.querySelector('#dr-wd .wd-title [data-state]'); if (st && /Original/.test(st.textContent)) return true; } return false; };
        const bad = []; let n = 0;
        const pdfOk = async () => { const h = document.querySelector('[data-pdfedit]').getAttribute('href'); return (await fetch(h, { method: 'HEAD' })).ok ? null : decodeURIComponent(h); };
        for (const tab of ['lor1p', 'lor3p']) { LSHDrafting.tab(tab); if (await wait()) { n++; const b = await pdfOk(); if (b) bad.push(b); } else bad.push('did not open: ' + tab); }
        LSHDrafting.tab('prov');
        const count = document.querySelectorAll('select[aria-label="Medical provider"] option').length;
        for (let i = 0; i < count; i++) for (const k of ['medlor', 'lienbv']) {
            LSHDrafting.pickProvider(i); LSHDrafting.pickKind(k);
            if (!await wait()) { bad.push('did not open: provider ' + i + ' ' + k); continue; }
            n++; const b = await pdfOk(); if (b && bad.indexOf(b) < 0) bad.push(b);
        }
        return { n, bad };
    });
    check(`every letter opens as its original, with its PDF (${sweep.n} opened)`, !sweep.bad.length && sweep.n > 40, sweep.bad.join(' | '));

    // 6. at phone width nothing pushes the page sideways
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(base + '/simulators/drafting.html?tab=prov&kind=medlor', { waitUntil: 'load' });
    await phone.waitForSelector('section.docx > article', { timeout: 30000 });
    await phone.waitForSelector('#dr-hipaa canvas', { timeout: 30000 }).catch(() => {});
    const sw = await phone.evaluate(() => document.scrollingElement.scrollWidth);
    check('phone width: no sideways scroll', sw <= 391, String(sw));

    check('no page errors', !errors.length, errors.join(' | '));
    await browser.close(); server.close();
    oks.forEach(o => console.log('  ✓ ' + o));
    fails.forEach(f => console.log('  ✗ ' + f));
    console.log(`\n${oks.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

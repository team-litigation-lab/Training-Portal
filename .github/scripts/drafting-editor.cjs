// The Drafting tool's Word-style editor (simulators/drafting-editor.js, drafting-docx.js applyEditsXml):
// the trainee edits the firm's letter as in Word, and the download is exactly what is on screen.
//
// Checked here, by typing and clicking as a trainee does: the letter opens in the editor with the ribbon;
// an untouched letter downloads as the firm's own file (every part but word/document.xml byte-identical,
// and document.xml the same XML); a placeholder typed over keeps its run's own font, and the highlight
// comes off only when the trainee takes it off (No Color); bold, a font and a size, centring, a new
// paragraph (Enter) and a deleted line all reach the .docx, with Word's property order; Ctrl+Z undoes;
// the letter is kept in the browser and comes back the same (saving it again changes nothing); Check my
// letter finds what is still wrong; a legacy check box ticks in the Lien BV; every letter the firm sent
// (both LORs, each provider's MedLOR and Lien BV) downloads untouched as its own document.xml; and at phone width the page
// doesn't scroll sideways.
// Usage: node .github/scripts/drafting-editor.cjs   (from the repository root; needs `npm i playwright`)
//   DRAFTING_LIBS=<dir with node_modules of jszip, docx-preview, pdf-lib>  serves those instead of the CDNs.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.pdf': 'application/pdf' };

// The trainee is signed in, and their account keeps their letters the way functions/api/drafting-drafts.js does
// (a copy older than the one saved is refused: 409 DRAFT_NEWER).
const ANN = { username: 'ann', userType: 'Trainee', fullName: 'Ann Lee', batchId: 'B1' };
let ACCOUNT = {};
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (o, st) => { res.writeHead(st || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/__reset') { ACCOUNT = {}; return send({ ok: true }); }
    if (u.pathname === '/api/me') return send({ success: true, user: ANN });
    if (u.pathname === '/api/heartbeat') return send({ success: true });
    if (u.pathname === '/api/drafting-drafts') {
        if (req.method === 'GET') {
            const l = u.searchParams.get('letter'), r = ACCOUNT[l];
            if (l == null) return send({ success: true, letters: Object.keys(ACCOUNT).map(k => ({ letter: k, updatedAt: ACCOUNT[k].updatedAt })) });
            return send({ success: true, letter: l, data: r ? r.data : null, updatedAt: r ? r.updatedAt : null });
        }
        let body = ''; req.on('data', c => { body += c; });
        return req.on('end', () => {
            const b = JSON.parse(body || '{}'), cur = ACCOUNT[b.letter];
            if (b.action === 'delete') { delete ACCOUNT[b.letter]; return send({ success: true }); }
            if (cur && b.base && cur.updatedAt > b.base) return send({ success: false, code: 'DRAFT_NEWER', updatedAt: cur.updatedAt }, 409);
            const at = new Date(Date.now() + Object.keys(ACCOUNT).length).toISOString();
            ACCOUNT[b.letter] = { data: b.data, updatedAt: at };
            return send({ success: true, updatedAt: at });
        });
    }
    if (u.pathname.startsWith('/api/')) return send({ success: false, error: 'offline test' });
    let f = path.join(ROOT, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
const LIBS = process.env.DRAFTING_LIBS;
const LOCAL = LIBS ? {
    'jszip.min.js': 'jszip/dist/jszip.min.js', 'docx-preview.min.js': 'docx-preview/dist/docx-preview.min.js', 'pdf-lib.min.js': 'pdf-lib/dist/pdf-lib.min.js'
} : {};

const fails = [], oks = [];
const check = (name, cond, detail) => (cond ? oks : fails).push(name + (cond ? '' : ': ' + detail));

(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    if (LIBS) await ctx.route(/cdn(js)?\.(cloudflare|jsdelivr)\.(com|net)\/.*\.js$/, (route) => {
        const name = route.request().url().split('/').pop(), f = LOCAL[name] && path.join(LIBS, 'node_modules', LOCAL[name]);
        return f && fs.existsSync(f) ? route.fulfill({ body: fs.readFileSync(f), contentType: 'text/javascript' }) : route.continue();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    const ready = async () => {
        await page.waitForSelector('section.docx > article[contenteditable="true"]', { timeout: 30000 });
        await page.waitForFunction(() => /Saved/.test((document.querySelector('.wd-title [data-state]') || {}).textContent || ''), null, { timeout: 15000 });
    };
    // the letter as it would download, unpacked in the page: every part, and document.xml
    const unpack = () => page.evaluate(async () => {
        const out = await LSHDrafting.build(), zip = await JSZip.loadAsync(await out.blob.arrayBuffer());
        const tpl = await JSZip.loadAsync(await (await fetch('/simulators/drafting/templates/1P_LOR.docx')).arrayBuffer());
        const same = [], differ = [];
        for (const name of Object.keys(tpl.files)) {
            if (tpl.files[name].dir || name === 'word/document.xml') continue;
            const a = await tpl.file(name).async('uint8array'), b = zip.file(name) ? await zip.file(name).async('uint8array') : null;
            (b && a.length === b.length && a.every((x, i) => x === b[i]) ? same : differ).push(name);
        }
        const tplXml = await tpl.file('word/document.xml').async('string');
        return { same, differ, xml: await zip.file('word/document.xml').async('string'),
            tplXml: new XMLSerializer().serializeToString(new DOMParser().parseFromString(tplXml, 'application/xml')) };
    });
    // a paragraph of document.xml by its text, with its runs' properties
    const para = (xml, needle) => page.evaluate(({ xml, needle }) => {
        const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const ps = [].slice.call(doc.getElementsByTagNameNS(W, 'p'));
        const text = (p) => [].map.call(p.getElementsByTagNameNS(W, 't'), t => t.textContent).join('');
        const i = ps.findIndex(p => text(p).indexOf(needle) >= 0);
        if (i < 0) return null;
        const p = ps[i], jc = p.getElementsByTagNameNS(W, 'jc')[0];
        return { i, text: text(p), next: ps[i + 1] ? text(ps[i + 1]) : null, jc: jc ? jc.getAttribute('w:val') : null,
            runs: [].map.call(p.getElementsByTagNameNS(W, 'r'), r => {
                const rPr = r.getElementsByTagNameNS(W, 'rPr')[0];
                return { text: [].map.call(r.getElementsByTagNameNS(W, 't'), t => t.textContent).join(''),
                    props: rPr ? [].map.call(rPr.childNodes, n => n.localName + (n.getAttribute && n.getAttribute('w:val') ? '=' + n.getAttribute('w:val') : '')
                        + (n.getAttribute && n.getAttribute('w:ascii') ? '=' + n.getAttribute('w:ascii') : '')) : [] };
            }) };
    }, { xml, needle });
    const find = async (q) => {
        await page.fill('[data-find]', q);
        await page.click('[data-cmd="findNext"]');
        return page.evaluate(() => window.getSelection().toString());
    };

    // 0. the page opens on the firm's original, read-only, with Edit in Word · Edit in Nitro Pro · Download Doc
    await page.goto(base + '/simulators/drafting.html?tab=lor1p', { waitUntil: 'load' });
    await page.waitForSelector('section.docx > article', { timeout: 30000 });
    await page.waitForFunction(() => /Original/.test((document.querySelector('.wd-title [data-state]') || {}).textContent || ''), null, { timeout: 15000 });
    check('the original opens read-only', await page.$$eval('section.docx > article', as => as.length > 0 && as.every(a => a.contentEditable !== 'true')), 'an editable article');
    check('Edit in Word · Edit in Nitro Pro · Download Doc', (await page.$$eval('.dr-docacts .sim-btn', bs => bs.map(b => b.textContent.trim()).join(' | '))) === '✎ Edit in Word | ✎ Edit in Nitro Pro | ⬇ Download Doc',
        await page.$$eval('.dr-docacts .sim-btn', bs => bs.map(b => b.textContent.trim()).join(' | ')));
    const pdfHref = await page.$eval('.dr-docacts a[href$=".pdf"]', a => a.getAttribute('href'));
    check('Edit in Nitro Pro hands over its PDF', fs.existsSync(path.join(ROOT, decodeURIComponent(pdfHref))) && /\.pdf$/.test(await page.$eval('[data-nitro]', a => a.getAttribute('download'))), pdfHref);
    check('Download Doc is the original .docx', (await page.$eval('.dr-docacts a[href$=".docx"]', a => a.getAttribute('href'))) === '/simulators/drafting/templates/1P_LOR.docx', 'another file');
    // the PDF edited in Nitro Pro, saved back to the platform, and downloaded from it again
    const nitroPdf = fs.readFileSync(path.join(ROOT, decodeURIComponent(pdfHref)));
    await page.setInputFiles('#dr-nitro input[type=file]', { name: 'edited.pdf', mimeType: 'application/pdf', buffer: nitroPdf });
    await page.waitForFunction(() => /saved to the platform/.test((document.querySelector('#dr-nitro [data-pdf]') || {}).textContent || ''), null, { timeout: 10000 }).catch(() => {});
    const keptPdf = ACCOUNT['lor1p:pdf'] && JSON.parse(ACCOUNT['lor1p:pdf'].data);
    check('Save my edited PDF puts it on the account', !!keptPdf && Buffer.from(keptPdf.b64, 'base64').equals(nitroPdf), 'not saved as sent');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dr-nitro button:has-text("Download my saved PDF")')]);
    check('and it downloads from the platform as it was saved', fs.readFileSync(await dl.path()).equals(nitroPdf), fs.readFileSync(await dl.path()).length + ' bytes, not ' + nitroPdf.length);
    await page.setInputFiles('#dr-nitro input[type=file]', { name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
    check('a file that is not a PDF is refused', Buffer.from(JSON.parse(ACCOUNT['lor1p:pdf'].data).b64, 'base64').equals(nitroPdf), 'overwritten');
    await page.click('.dr-docacts button:has-text("Edit in Word")');
    await page.waitForSelector('section.docx > article[contenteditable="true"]', { timeout: 30000 }).catch(async e => {
        console.log(errors, await page.evaluate(() => [document.querySelector('.dr-docname') && document.querySelector('.dr-docname').textContent, (document.querySelector('.wd-title') || {}).textContent]));
        throw e;
    });
    check('Edit in Word opens the editor', !!(await page.$('.wd-tabs')), 'no ribbon');
    await page.waitForFunction(() => /Saved/.test((document.querySelector('.wd-title [data-state]') || {}).textContent || ''), null, { timeout: 15000 });
    check('Edit in Word: Save to the platform · Download as PDF · Download Doc',
        (await page.$$eval('.dr-docacts .sim-btn', bs => bs.map(b => b.textContent.trim()).join(' | '))) === '← The original | 💾 Save to the platform | ⬇ Download as PDF | ⬇ Download Doc', 'other buttons');
    // Download as PDF prints Word's pages, edge to edge, with nothing else of the page
    await page.waitForFunction(() => !!LSHDrafting.xml(), null, { timeout: 15000 });   // the editor is the page's (not only drawn)
    await page.evaluate(() => { window.print = () => { window.__printed = document.title; }; });
    await page.click('.dr-docacts button:has-text("Download as PDF")');
    const printed = await page.evaluate(() => window.__printed);
    const pdfOut = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const pdfPages = (pdfOut.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    check('Download as PDF: the letter\'s two pages, named the firm\'s way', pdfPages === 2 && /^INS – 1P .* - LOR \d\d\.\d\d\.\d{4} \(Ann\)$/.test(printed || ''), `${pdfPages} pages, "${printed}"`);
    await page.waitForFunction(() => !document.getElementById('dr-print'), null, { timeout: 5000 }).catch(() => {});
    check('the print copy is gone after printing', !(await page.$('#dr-print')), 'still there');

    // 1. the letter opens in the editor, Word's chrome around it
    await page.goto(base + '/simulators/drafting.html?tab=lor1p&mode=word', { waitUntil: 'load' });
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload({ waitUntil: 'load' });
    await ready();
    check('the ribbon has Word\'s tabs', (await page.$$eval('.wd-tabs .wd-t', bs => bs.map(b => b.textContent).join(','))) === 'File,Home,Insert,Review,View',
        await page.$$eval('.wd-tabs .wd-t', bs => bs.map(b => b.textContent).join(',')));
    check('the whole letter is editable, not only the blanks', (await page.$$('section.docx > article[contenteditable="true"]')).length >= 1, 'no editable page');
    check('the letterhead is drawn on the page', (await page.$$('.dr-lh')).length >= 1, 'no letterhead layer');
    check('the status bar counts words', /\d+ words/.test(await page.textContent('[data-words]')), await page.textContent('[data-words]'));

    // 2. untouched, the download is the firm's file
    let u = await unpack();
    check('an untouched letter: every other part of the .docx byte-identical', !u.differ.length && u.same.length > 5, 'differ: ' + u.differ.join(', '));
    check('an untouched letter: document.xml is the template\'s', u.xml === u.tplXml, 'document.xml changed with no edit');

    // 3. typing over a placeholder, as in Word: it keeps its run's formatting and its highlight
    const sel = await find('Key Insurance Company');
    check('Find selects the text in the letter', sel === 'Key Insurance Company', JSON.stringify(sel));
    await page.keyboard.type('Allstate Insurance');
    u = await unpack();
    let p = await para(u.xml, 'Allstate Insurance');
    let run = p && p.runs.find(r => r.text.indexOf('Allstate Insurance') >= 0);
    check('typed text reaches the .docx', !!run, JSON.stringify(p));
    check('in the same run, with the firm\'s font', run && run.props.some(x => x === 'rFonts=Arial'), JSON.stringify(run));
    check('still highlighted until the trainee takes it off (as in Word)', run && run.props.some(x => /^highlight=/.test(x)), JSON.stringify(run));
    await find('Allstate Insurance');
    await page.click('[data-open="hl"]');
    await page.click('[data-cmd="highlight:none"]');
    u = await unpack();
    p = await para(u.xml, 'Allstate Insurance'); run = p && p.runs.find(r => r.text.indexOf('Allstate Insurance') >= 0);
    check('No Color takes the highlight off in the file', run && !run.props.some(x => /^highlight=/.test(x)), JSON.stringify(run));
    check('and leaves the rest of the run as it was', run && run.props.some(x => x === 'rFonts=Arial'), JSON.stringify(run));

    // 4. Enter makes a paragraph; a font and a size are set on what is selected
    await find('Allstate Insurance');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Claims Unit');
    await find('Claims Unit');
    await page.selectOption('[data-font]', 'Times New Roman');
    await find('Claims Unit');
    await page.selectOption('[data-size]', '14');
    // bold, by the keyboard
    await find('To Whom It May Concern');
    await page.keyboard.press('Control+b');
    // centre a paragraph
    await find('Very truly yours');
    await page.click('[data-cmd="align:center"]');
    // delete a whole line: its text, then the paragraph itself
    await find('F/E: ');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Backspace');
    u = await unpack();
    p = await para(u.xml, 'Allstate Insurance');
    check('Enter: a new paragraph right after it', p && p.next === 'Claims Unit', JSON.stringify(p && p.next));
    const cu = await para(u.xml, 'Claims Unit');
    const cur = cu && cu.runs.find(r => r.text === 'Claims Unit');
    check('the new paragraph\'s text has the font chosen', cur && cur.props.indexOf('rFonts=Times New Roman') >= 0, JSON.stringify(cur));
    check('and the size chosen (14 pt = sz 28)', cur && cur.props.indexOf('sz=28') >= 0 && cur.props.indexOf('szCs=28') >= 0, JSON.stringify(cur));
    const tw = await para(u.xml, 'To Whom It May Concern'), twr = tw && tw.runs.find(r => /To Whom/.test(r.text));
    check('Ctrl+B makes it bold in the file', twr && twr.props.indexOf('b') >= 0, JSON.stringify(twr));
    const vt = await para(u.xml, 'Very truly yours');
    check('centring reaches the paragraph (w:jc center)', vt && vt.jc === 'center', JSON.stringify(vt && vt.jc));
    check('the deleted line is gone from the file', !/F\/E:/.test(u.xml), 'F/E: still in document.xml');
    const order = await page.evaluate((xml) => {
        const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
        const ORDER = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline', 'shadow', 'emboss', 'imprint', 'noProof',
            'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText',
            'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath'];
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) return 'not well-formed';
        const bad = [];
        [].forEach.call(doc.getElementsByTagNameNS(W, 'r'), r => {
            const rPr = [].find.call(r.childNodes, n => n.localName === 'rPr'); if (!rPr) return;
            const idx = [].map.call(rPr.childNodes, n => ORDER.indexOf(n.localName));
            if (idx.some((x, i) => i && x < idx[i - 1])) bad.push([].map.call(rPr.childNodes, n => n.localName).join(','));
        });
        return bad.length ? bad.slice(0, 3).join(' | ') : 'ok';
    }, u.xml);
    check('the XML is well-formed, run properties in Word\'s order', order === 'ok', order);
    check('the letterhead, logo and every other part are still byte-identical', !u.differ.length, 'differ: ' + u.differ.join(', '));

    // 5. Ctrl+Z undoes the last thing done
    await page.click('section.docx > article p');
    const before = await page.evaluate(() => LSHDrafting.xml());
    await find('Allstate Insurance');
    await page.keyboard.type('Geico');
    await page.keyboard.press('Control+z');
    check('Ctrl+Z undoes typing', (await page.evaluate(() => LSHDrafting.xml())) === before, 'the letter differs after undo');

    // 6. kept in the browser and on the trainee's account, and it comes back the same
    await page.keyboard.press('Control+s');
    await page.waitForFunction(() => /Saved to your account/.test(document.querySelector('.wd-title [data-state]').textContent), null, { timeout: 15000 });
    const saved = await page.evaluate(() => LSHDrafting.xml());
    check('saved to the trainee\'s account', !!ACCOUNT.lor1p && /"z":/.test(ACCOUNT.lor1p.data), Object.keys(ACCOUNT).join(','));
    await page.reload({ waitUntil: 'load' });
    await ready();
    const again = await page.evaluate(() => LSHDrafting.xml());
    check('the letter comes back from the browser as it was left', again === saved, 'reloaded letter differs');
    check('and on screen too', /Claims Unit/.test(await page.textContent('section.docx > article')), 'Claims Unit not on screen');
    // another browser (nothing in its storage), the same trainee: the letter is there
    const other = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    if (LIBS) await other.route(/cdn(js)?\.(cloudflare|jsdelivr)\.(com|net)\/.*\.js$/, (route) => {
        const name = route.request().url().split('/').pop(), f = LOCAL[name] && path.join(LIBS, 'node_modules', LOCAL[name]);
        return f && fs.existsSync(f) ? route.fulfill({ body: fs.readFileSync(f), contentType: 'text/javascript' }) : route.continue();
    });
    const o = await other.newPage();
    await o.goto(base + '/simulators/drafting.html?tab=lor1p&mode=word', { waitUntil: 'load' });
    await o.waitForFunction(() => window.LSHDrafting && LSHDrafting.xml() && /Claims Unit/.test(LSHDrafting.xml()), null, { timeout: 30000 }).catch(() => {});
    check('another browser opens the letter from the account, exactly as left', (await o.evaluate(() => LSHDrafting.xml())) === saved, 'the other browser has a different letter');
    await other.close();

    // 7. Check my letter: what is still wrong
    const res = await page.evaluate(() => LSHDrafting.check());
    const named = (re) => res.checks.find(c => re.test(c.label)) || {};
    check('Check my letter: the highlights still in the template are found', named(/highlighted/).ok === false && /Still highlighted/.test(named(/highlighted/).detail), JSON.stringify(named(/highlighted/)));
    check('Check my letter: the case notes are checked against the letter', /Case details/.test(named(/Case details/).label || ''), JSON.stringify(res.checks.map(c => c.label)));
    check('Check my letter: a score', res.score >= 0 && res.score < 100, String(res.score));
    check('the result is shown beside the letter', await page.isVisible('#dr-check .dr-checks'), 'no checks card');

    // 8. a legacy Word check box ticks, and the file has it ticked
    // (Akers Chiropractic's Lien BV asks "Is treatment complete?" with Word form check boxes)
    await page.goto(base + '/simulators/drafting.html?tab=prov&kind=lienbv&mode=word', { waitUntil: 'load' });
    await ready();
    await page.selectOption('select[aria-label="Medical provider"]', { label: 'Akers Chiropractic' });
    await ready();
    const boxes = await page.$$('.dr-chk');
    check('the Lien BV\'s Yes / No boxes are on the page', boxes.length >= 2, String(boxes.length));
    if (boxes.length) {
        await boxes[0].click();
        const x = await page.evaluate(() => LSHDrafting.xml());
        check('ticking one ticks it in the file (w:checked)', /<w:checked\/>/.test(x), 'no w:checked');
    }

    // 9. Word's paragraph commands: bullets, numbering, indents, line spacing — in the file, and drawn from it
    await page.goto(base + '/simulators/drafting.html?tab=lor1p&mode=word', { waitUntil: 'load' });
    await ready();
    const numId = (xml, needle) => page.evaluate(({ xml, needle }) => {
        const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', doc = new DOMParser().parseFromString(xml, 'application/xml');
        const p = [].find.call(doc.getElementsByTagNameNS(W, 'p'), p => [].map.call(p.getElementsByTagNameNS(W, 't'), t => t.textContent).join('').indexOf(needle) >= 0);
        const g = (n) => { const e = p && p.getElementsByTagNameNS(W, n)[0]; return e ? e.getAttribute('w:val') : null; };
        const sp = p && p.getElementsByTagNameNS(W, 'spacing')[0], ind = p && p.getElementsByTagNameNS(W, 'ind')[0];
        return { numId: g('numId'), ilvl: g('ilvl'), line: sp ? sp.getAttribute('w:line') : null, left: ind ? ind.getAttribute('w:left') : null };
    }, { xml, needle });
    const settle = () => page.waitForFunction(() => document.querySelector('section.docx > article[contenteditable="true"]'), null, { timeout: 20000 });
    // a redraw that fails leaves the letter exactly as it was, and it can still be typed in
    const failed = await page.evaluate(async () => {
        const before = LSHDrafting.xml(), real = docx.renderAsync; let once = true;
        docx.renderAsync = function () { if (once) { once = false; return Promise.reject(new Error('test')); } return real.apply(this, arguments); };
        document.querySelector('[data-find]').value = 'Please be advised'; document.querySelector('[data-cmd="findNext"]').click();
        document.querySelector('[data-cmd="list:bullet"]').click();
        for (let i = 0; i < 80 && !/wasn’t made/.test(document.querySelector('[data-say]').textContent); i++) await new Promise(r => setTimeout(r, 100));
        docx.renderAsync = real;
        return { same: LSHDrafting.xml() === before, editable: document.querySelector('section.docx > article').contentEditable, said: document.querySelector('[data-say]').textContent };
    });
    check('a paragraph command that can\'t be drawn changes nothing, says so, and the letter stays editable', failed.same && failed.editable === 'true' && /wasn’t made/.test(failed.said), JSON.stringify(failed));
    await find('Please be advised');
    await page.click('[data-cmd="list:bullet"]'); await settle();
    let x = await page.evaluate(() => LSHDrafting.xml()), n = await numId(x, 'Please be advised');
    check('Bullets: the paragraph is a Word bullet list item', n.numId === '9001' && n.ilvl === '0', JSON.stringify(n));
    check('and it is drawn as one', await page.evaluate(() => [...document.querySelectorAll('section.docx article p')].some(p => /-num-9001-0/.test(p.className) && /Please be advised/.test(p.textContent))), 'no bullet on screen');
    await page.click('[data-cmd="indent:1"]'); await settle();
    n = await numId(await page.evaluate(() => LSHDrafting.xml()), 'Please be advised');
    check('Increase Indent on a list item: one level down', n.ilvl === '1', JSON.stringify(n));
    await page.click('[data-cmd="undo"]'); await settle();
    n = await numId(await page.evaluate(() => LSHDrafting.xml()), 'Please be advised');
    check('Ctrl+Z undoes a paragraph command too', n.ilvl === '0', JSON.stringify(n));
    await page.click('[data-cmd="list:bullet"]'); await settle();
    n = await numId(await page.evaluate(() => LSHDrafting.xml()), 'Please be advised');
    check('Bullets again takes it out of the list', n.numId == null, JSON.stringify(n));
    await find('To Whom It May Concern');
    await page.click('[data-cmd="list:number"]'); await settle();
    n = await numId(await page.evaluate(() => LSHDrafting.xml()), 'To Whom It May Concern');
    check('Numbering: a numbered list of its own', n.numId === '9100', JSON.stringify(n));
    await page.click('[data-cmd="list:number"]'); await settle();
    await page.click('[data-cmd="indent:1"]'); await settle();
    n = await numId(await page.evaluate(() => LSHDrafting.xml()), 'To Whom It May Concern');
    check('Increase Indent on a paragraph: half an inch (w:ind 720)', n.left === '720', JSON.stringify(n));
    await page.click('[data-open="ls"]'); await page.click('[data-cmd="line:480"]'); await settle();
    n = await numId(await page.evaluate(() => LSHDrafting.xml()), 'To Whom It May Concern');
    check('Line spacing 2.0 (w:spacing line 480, auto)', n.line === '480', JSON.stringify(n));
    await find('Please be advised');
    await page.click('[data-cmd="list:number"]'); await settle();
    const num = await page.evaluate(async () => { const b = await LSHDrafting.build(), z = await JSZip.loadAsync(await b.blob.arrayBuffer());
        return { numbering: await z.file('word/numbering.xml').async('string'), doc: await z.file('word/document.xml').async('string') }; });
    check('the download carries the list definitions Word needs', /w:abstractNumId="9002"/.test(num.numbering) && /<w:num w:numId="9100"/.test(num.numbering) && /w:numId w:val="9100"/.test(num.doc), 'no list definitions');

    // 10. Paste: Keep Source Formatting by default, Paste Options to change it, a pasted list a Word list
    await find('Very truly yours'); await page.keyboard.press('ArrowLeft');
    await page.evaluate(() => {
        const dt = new DataTransfer();
        dt.setData('text/html', '<p style="font-family:Calibri;font-size:14pt"><b>Pasted bold</b> and <span style="color:#ff0000">red</span></p><ul><li>One pasted item</li></ul>');
        dt.setData('text/plain', 'Pasted bold and red\nOne pasted item');
        document.querySelector('section.docx > article').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await page.waitForSelector('.wd-paste', { timeout: 15000 }); await settle();
    x = await page.evaluate(() => LSHDrafting.xml());
    let pb = await para(x, 'Pasted bold');
    const bold = pb && pb.runs.find(r => r.text === 'Pasted bold'), red = pb && pb.runs.find(r => r.text === 'red');
    check('Keep Source Formatting: the source\'s font, size and bold', bold && bold.props.indexOf('rFonts=Calibri') >= 0 && bold.props.indexOf('sz=28') >= 0 && bold.props.indexOf('b') >= 0, JSON.stringify(bold));
    check('and its colour', red && red.props.indexOf('color=FF0000') >= 0, JSON.stringify(red));
    check('a pasted list item is a Word list item', (await numId(x, 'One pasted item')).numId === '9001', JSON.stringify(await numId(x, 'One pasted item')));
    await page.click('.wd-paste [data-paste="text"]'); await settle();
    x = await page.evaluate(() => LSHDrafting.xml());
    pb = await para(x, 'Pasted bold');
    const plain = pb && pb.runs.find(r => /Pasted bold/.test(r.text));
    check('Paste Options › Keep Text Only: the letter\'s own formatting', plain && plain.props.indexOf('rFonts=Calibri') < 0 && plain.props.indexOf('b') < 0, JSON.stringify(plain));
    check('and no list', (await numId(x, 'One pasted item')).numId == null, JSON.stringify(await numId(x, 'One pasted item')));

    // 11. pages, as Word lays them out: the letterhead on each, the text going on on the next page
    await page.goto(base + '/simulators/drafting.html?tab=lor3p&mode=word', { waitUntil: 'load' });
    await ready();
    await page.waitForFunction(() => /of 3$/.test(document.querySelector('[data-pages]').textContent), null, { timeout: 10000 }).catch(() => {});
    check('the 3P letter is three pages, as Word has it', /of 3$/.test(await page.textContent('[data-pages]')), await page.textContent('[data-pages]'));
    const lh = await page.evaluate(() => ({ copies: document.querySelectorAll('.dr-lh-copy').length, gaps: document.querySelectorAll('.dr-pgband').length }));
    check('each page has the letterhead and footer, with the gap between pages', lh.copies >= 1 && lh.gaps >= 1, JSON.stringify(lh));
    // a MedLOR whose file sets no font size at all is in Word's 10 pt, and two pages as in Word (at the page's 15px it ran to four)
    await page.goto(base + '/simulators/drafting.html?tab=prov&kind=medlor&mode=word', { waitUntil: 'load' });
    await ready();
    await page.evaluate(() => { const s = document.querySelector('.dr-bar select'); const o = [].find.call(s.options, x => /Bone & Joint/.test(x.textContent)); LSHDrafting.pickProvider(o.value); });
    await ready();
    await page.waitForFunction(() => /of 2$/.test(document.querySelector('[data-pages]').textContent), null, { timeout: 10000 }).catch(() => {});
    check('a MedLOR with no font size in its file: two pages, as Word has it', /of 2$/.test(await page.textContent('[data-pages]')), await page.textContent('[data-pages]'));
    await page.goto(base + '/simulators/drafting.html?tab=lor3p&mode=word', { waitUntil: 'load' });
    await ready();
    await find('Please note that our preferred method');
    await page.keyboard.press('Home');
    for (let i = 0; i < 16; i++) await page.keyboard.type('A sentence added so the letter runs on further and the pages move with it. ');
    await page.waitForFunction(() => /of 4$/.test(document.querySelector('[data-pages]').textContent), null, { timeout: 10000 }).catch(() => {});
    check('more text: the page breaks move, and a page is added', /of 4$/.test(await page.textContent('[data-pages]')), await page.textContent('[data-pages]'));
    check('the page breaks are the page\'s, not the letter\'s', !/dr-pgsp|A sentence added so the letter runs on further and the pages move with it\. {2}/.test(await page.evaluate(() => LSHDrafting.xml())), 'spacer in the XML');
    await page.evaluate(() => fetch('/__reset'));

    // 12. every letter the firm sent, opened and left alone, downloads as the firm's document.xml
    const sweep = await page.evaluate(async () => {
        const wait = async () => { for (let i = 0; i < 200; i++) { await new Promise(r => setTimeout(r, 100));
            const st = document.querySelector('.wd-title [data-state]'); if (st && /Saved/.test(st.textContent) && LSHDrafting.xml()) return true; } return false; };
        const same = async () => {
            const href = document.querySelector('a[download][href*="/simulators/drafting/"]').getAttribute('href');
            const t = await LSHDraftingDocx.documentXml(await (await fetch(href)).arrayBuffer());
            return LSHDrafting.xml() === new XMLSerializer().serializeToString(new DOMParser().parseFromString(t, 'application/xml')) ? null : decodeURIComponent(href);
        };
        localStorage.removeItem('LSH_DRAFTING_DOCS_V1');
        const bad = []; let n = 0;
        for (const tab of ['lor1p', 'lor3p']) { LSHDrafting.tab(tab); if (await wait()) { n++; const b = await same(); if (b) bad.push(b); } else bad.push('did not open: ' + tab); }
        LSHDrafting.tab('prov');
        const count = document.querySelectorAll('select[aria-label="Medical provider"] option').length;
        for (let i = 0; i < count; i++) for (const k of ['medlor', 'lienbv']) {
            LSHDrafting.pickProvider(i); LSHDrafting.pickKind(k);
            if (!await wait()) { bad.push('did not open: provider ' + i + ' ' + k); continue; }
            n++; const b = await same(); if (b && bad.indexOf(b) < 0) bad.push(b);
        }
        return { n, bad };
    });
    check(`every letter untouched downloads as the firm's (${sweep.n} opened)`, !sweep.bad.length && sweep.n > 40, sweep.bad.join(' | '));

    // 13. at phone width nothing pushes the page sideways
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    if (LIBS) await phone.route(/cdn(js)?\.(cloudflare|jsdelivr)\.(com|net)\/.*\.js$/, (route) => {
        const name = route.request().url().split('/').pop(), f = LOCAL[name] && path.join(LIBS, 'node_modules', LOCAL[name]);
        return f && fs.existsSync(f) ? route.fulfill({ body: fs.readFileSync(f), contentType: 'text/javascript' }) : route.continue();
    });
    await phone.goto(base + '/simulators/drafting.html?tab=lor1p&mode=word', { waitUntil: 'load' });
    await phone.waitForSelector('section.docx > article[contenteditable="true"]', { timeout: 30000 });
    const sw = await phone.evaluate(() => document.scrollingElement.scrollWidth);
    check('phone width: no sideways scroll', sw <= 391, String(sw));

    check('no page errors', !errors.length, errors.join(' | '));
    await browser.close(); server.close();
    oks.forEach(o => console.log('  ✓ ' + o));
    fails.forEach(f => console.log('  ✗ ' + f));
    console.log(`\n${oks.length} passed, ${fails.length} failed`);
    process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

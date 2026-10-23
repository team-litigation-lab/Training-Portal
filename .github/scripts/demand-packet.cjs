// 📚 Demand Packets & Binders (simulators/demand-packet.js): a full packet put together from many PDFs, as a trainee does it.
//
// Checked here, by choosing files and typing as a trainee does: several PDFs go into one section at once (and a photo
// becomes a page); a Word file is refused; a password-protected PDF is flagged; each document is described; the PIP log
// is made here (a row for each bill) and totals; the packet builds as one PDF in the firm's order — cover letter, index,
// demand letter, PIP log, bills, records — with the right page count, "Page i of N" and Bates numbers on every page
// (a turned page included), the index's page and Bates ranges matching where each document really is, and a bookmark for
// every section and document; the .zip has each section as its own PDF; the .csv index; Check my packet finds what is
// missing and passes when it is done; the files are still there after a reload; a binder gets its tab sheets; and the
// page doesn't scroll sideways at phone width.
// Usage: node .github/scripts/demand-packet.cjs   (from the repository root; needs `npm i playwright`)
//   DRAFTING_LIBS=<dir with node_modules of jszip, pdf-lib>  serves those instead of the CDNs.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.pdf': 'application/pdf' };
const ANN = { username: 'ann', userType: 'Trainee', fullName: 'Ann Lee', batchId: 'B1' };
const RESULTS = [];
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (o, st) => { res.writeHead(st || 200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/api/me') return send({ success: true, user: ANN });
    if (u.pathname === '/api/sim-results' && req.method === 'POST') {
        let body = ''; req.on('data', c => { body += c; });
        return req.on('end', () => { RESULTS.push(JSON.parse(body || '{}')); send({ success: true }); });
    }
    if (u.pathname.startsWith('/api/')) return send({ success: true });
    let f = path.join(ROOT, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
const LIBS = process.env.DRAFTING_LIBS;
const LOCAL = { 'jszip.min.js': 'jszip/dist/jszip.min.js', 'pdf-lib.min.js': 'pdf-lib/dist/pdf-lib.min.js' };

const fails = [], oks = [];
const check = (name, cond, detail) => (cond ? oks : fails).push(name + (cond ? '' : ': ' + detail));

(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    if (LIBS) await ctx.route(/cdnjs\.cloudflare\.com\/.*\.js$/, (route) => {
        const name = route.request().url().split('/').pop(), f = LOCAL[name] && path.join(LIBS, 'node_modules', LOCAL[name]);
        return f && fs.existsSync(f) ? route.fulfill({ body: fs.readFileSync(f), contentType: 'text/javascript' }) : route.continue();
    });
    const page = await ctx.newPage();
    const errors = [], dialogs = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
    await page.goto(base + '/simulators/demand-packet.html?program=CM');
    await page.waitForFunction(() => window.LSHPacket && window.PDFLib && document.querySelector('.pk-sec'));
    await page.waitForTimeout(300);

    // Sample PDFs, made in the page: a labelled page per page, so where each lands in the packet can be read back.
    const pdf = (label, pages, opts) => page.evaluate(async ({ label, pages, opts }) => {
        const { PDFDocument, StandardFonts, degrees } = PDFLib, d = await PDFDocument.create(), f = await d.embedFont(StandardFonts.Helvetica);
        for (let i = 0; i < pages; i++) {
            const pg = d.addPage([612, 792]);
            pg.drawText(`${label} p${i + 1}`, { x: 72, y: 700, size: 18, font: f });
            if (opts && opts.rotate) pg.setRotation(degrees(90));
        }
        return Array.from(await d.save());
    }, { label, pages, opts });
    const file = async (name, label, pages, opts) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(await pdf(label, pages, opts)) });
    const sec = (title) => page.locator('.pk-sec', { has: page.locator(`input.ttl[value="${title}"]`) });
    const input = (title) => sec(title).locator('input[type=file]');
    const waitDocs = (title, n) => page.waitForFunction(({ title, n }) => {
        const s = LSHPacket.packet().sections.find(x => x.title === title); return s && s.docs.length === n;
    }, { title, n });

    // ---- the case ----
    const caseVals = { client: 'John Doe', caseId: 'LSH-2026-MVA-770412', insured: 'Robert Smith', dol: '03/14/2026', carrier: 'Keystone Mutual',
        claimNo: 'KM-55120', adjuster: 'Dana Mercer', email: 'dmercer@keystone.example', limit: '10000', deadline: '11/20/2026', attorney: 'Atty. Elijah Thorne', firm: 'LSH Law Group' };
    for (const [k, v] of Object.entries(caseVals)) await page.fill(`[data-case="${k}"]`, v);
    check('the file name is the firm\'s convention', /^LSH-2026-MVA-770412_Doe-John_Demand Packet_\d{4}-\d\d-\d\d\.pdf$/.test(await page.textContent('.pk-name')), await page.textContent('.pk-name'));

    // ---- many PDFs at once into a section; a Word file refused; a protected PDF flagged ----
    await input('Demand Letter').setInputFiles([await file('Demand Letter 2026-10-20.pdf', 'DEMAND', 3), { name: 'Demand.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('PK') }]);
    await waitDocs('Demand Letter', 1);
    check('a Word file is refused with how to make it a PDF', dialogs.some(m => /Demand\.docx/.test(m) && /Save As › PDF/.test(m)), dialogs.join(' | '));
    check('the date in a file name becomes the document\'s date', await page.evaluate(() => LSHPacket.packet().sections.find(s => s.title === 'Demand Letter').docs[0].date) === '10/20/2026', 'no date');
    await input('Medical Bills').setInputFiles([await file('Bill - Riverton.pdf', 'BILL-RIV', 2), await file('Bill - Crescent.pdf', 'BILL-CRE', 1)]);
    await waitDocs('Medical Bills', 2);
    await input('Medical Records').setInputFiles([await file('Records - Riverton.pdf', 'REC-RIV', 4), await file('Records - Crescent.pdf', 'REC-CRE', 2, { rotate: true })]);
    await waitDocs('Medical Records', 2);
    // a photo: one page of its own
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 500; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 800, 500); return c.toDataURL('image/png').split(',')[1]; });
    await input('Supporting Documents').setInputFiles([await file('Police Report.pdf', 'POLICE', 2), { name: 'Photo of the car.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }]);
    await waitDocs('Supporting Documents', 2);
    check('a photo is a page of its own', await page.evaluate(() => { const d = LSHPacket.packet().sections.find(s => s.title === 'Supporting Documents').docs[1]; return d.kind === 'img' && d.pages === 1; }), 'not a page');

    // ---- describe the documents ----
    const describe = async (title, i, vals) => { for (const [k, v] of Object.entries(vals)) await page.evaluate(({ title, i, k, v }) => { const s = LSHPacket.packet().sections.find(x => x.title === title); LSHPacket.setDoc(s.id, i, k, v); }, { title, i, k, v }); };
    await describe('Demand Letter', 0, { desc: 'Policy limits demand', source: 'LSH Law Group' });
    await describe('Medical Bills', 0, { desc: 'Itemized bill', date: '07/31/2026', source: 'Riverton Spine & Rehab', amount: '6,290.00' });
    await describe('Medical Bills', 1, { desc: 'Itemized bill', date: '05/02/2026', source: 'Crescent Imaging', amount: '$1,540.00' });
    await describe('Medical Records', 0, { desc: 'Treatment records', date: '07/31/2026', source: 'Riverton Spine & Rehab' });
    await describe('Medical Records', 1, { desc: 'MRI report', date: '05/02/2026', source: 'Crescent Imaging' });
    await describe('Supporting Documents', 0, { desc: 'Traffic crash report', date: '03/14/2026', source: 'Metro Police' });
    await describe('Supporting Documents', 1, { desc: 'Photo of the client\'s vehicle', date: '03/14/2026', source: 'Client' });

    // ---- Check my packet before the PIP log is done ----
    let res = await page.evaluate(() => LSHPacket.check());
    const failed = (r) => r.checks.filter(c => !c.ok).map(c => c.label);
    check('Check my packet finds the PIP log missing', failed(res).includes('The PIP log has every bill on it'), failed(res).join(', '));
    check('Check my packet wants the packet built', failed(res).includes('The packet was built after your last change'), failed(res).join(', '));

    // ---- the PIP log: a row for each bill, then what PIP paid ----
    await page.fill('input[placeholder="The client\'s own carrier"]', 'Harbor Point Insurance');
    await page.click('text=+ A row for each bill in the packet');
    check('a row for each bill', await page.evaluate(() => LSHPacket.packet().pip.rows.length) === 2, 'rows: ' + await page.evaluate(() => LSHPacket.packet().pip.rows.length));
    await page.locator('.pk-pip tbody tr').nth(0).locator('input').nth(3).fill('5,032.00');
    await page.locator('.pk-pip tbody tr').nth(1).locator('input').nth(3).fill('1,232.00');
    check('the PIP log totals as it is typed', (await page.textContent('[data-tot="pip"]')) === '$6,264.00' && (await page.textContent('[data-tot="billed"]')) === '$7,830.00', await page.textContent('[data-tot="pip"]'));

    // ---- build it ----
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=⬇ Build the packet (one PDF)')]);
    if (process.env.PACKET_OUT) fs.copyFileSync(await dl.path(), process.env.PACKET_OUT);
    check('the packet downloads named the firm\'s way', /^LSH-2026-MVA-770412_Doe-John_Demand Packet_\d{4}-\d\d-\d\d\.pdf$/.test(dl.suggestedFilename()), dl.suggestedFilename());
    const bytes = fs.readFileSync(await dl.path());
    const got = await page.evaluate(async (b) => {
        const { PDFDocument, PDFName, PDFDict, PDFHexString, PDFString } = PDFLib, d = await PDFDocument.load(new Uint8Array(b));
        // the bookmarks, top level and their children
        const ctx = d.context, look = (x) => ctx.lookup(x), title = (o) => { const t = o.get(PDFName.of('Title')); return t ? t.decodeText() : ''; };
        const walk = (first) => { const out = []; let cur = first && look(first); while (cur) { const kids = cur.get(PDFName.of('First')); out.push({ title: title(cur), kids: kids ? walk(kids) : [] }); const n = cur.get(PDFName.of('Next')); cur = n ? look(n) : null; } return out; };
        const ol = d.catalog.get(PDFName.of('Outlines')), marks = ol ? walk(look(ol).get(PDFName.of('First'))) : [];
        return { pages: d.getPageCount(), rot: d.getPages().map(p => p.getRotation().angle), marks };
    }, Array.from(bytes));
    // cover 1 + index 1 + demand 3 + PIP log 1 + bills 3 + records 6 + supporting 3 = 18
    check('the packet has every page, in one PDF', got.pages === 18, 'pages: ' + got.pages);
    check('a turned page keeps its turn', got.rot.filter(a => a === 90).length === 2, got.rot.join(','));
    check('a bookmark for each section in order', got.marks.map(m => m.title).join(' | ') === 'Cover Letter | Index | Section 1 — Demand Letter | Section 2 — PIP Log | Section 3 — Medical Bills | Section 4 — Medical Records | Section 5 — Supporting Documents', got.marks.map(m => m.title).join(' | '));
    check('a bookmark for each document under its section', JSON.stringify(got.marks[4].kids.map(k => k.title)) === JSON.stringify(['3-1 Itemized bill', '3-2 Itemized bill']) && got.marks[3].kids[0].title === 'PIP Log', JSON.stringify(got.marks));

    // the words on each page, in order (PDF text via the browser's own PDF viewer is not scriptable; read the content streams instead)
    const text = await page.evaluate(async (b) => {
        const { PDFDocument, PDFName, PDFRawStream, PDFArray, decodePDFRawStream } = PDFLib, d = await PDFDocument.load(new Uint8Array(b));
        const dec = (s) => { try { return new TextDecoder('latin1').decode(decodePDFRawStream(s).decode()); } catch (e) { return ''; } };
        const words = (src) => { const out = []; src.replace(/<([0-9A-Fa-f]+)>\s*Tj/g, (m, h) => { let t = ''; for (let i = 0; i < h.length; i += 2) t += String.fromCharCode(parseInt(h.substr(i, 2), 16)); out.push(t); return m; });
            src.replace(/\((.*?)\)\s*Tj/g, (m, t) => { out.push(t); return m; }); return out.join(' '); };
        return d.getPages().map(p => {
            const c = p.node.get(PDFName.of('Contents')), list = c instanceof PDFArray ? c.asArray() : [c];
            return list.map(r => { const s = d.context.lookup(r); return s instanceof PDFRawStream ? words(dec(s)) : ''; }).join(' ');
        });
    }, Array.from(bytes));
    check('the cover letter is first, written from the case', /VIA E-MAIL: dmercer@keystone\.example/.test(text[0]) && /Dear Dana Mercer:/.test(text[0]) && /\$10,000\.00/.test(text[0]) && /Section|Medical Bills/.test(text[0]), text[0].slice(0, 400));
    check('the index is second', /DEMAND PACKET .* INDEX/.test(text[1]), text[1].slice(0, 200));
    check('the demand letter follows the index', /DEMAND p1/.test(text[2]) && /DEMAND p3/.test(text[4]), text[2].slice(0, 80));
    check('then the PIP log, with its totals', /PIP LOG/.test(text[5]) && /\$7,830\.00/.test(text[5]) && /\$6,264\.00/.test(text[5]), text[5].slice(0, 300));
    check('then the bills, the records and the rest', /BILL-RIV p1/.test(text[6]) && /BILL-CRE p1/.test(text[8]) && /REC-RIV p1/.test(text[9]) && /REC-CRE p2/.test(text[14]) && /POLICE p1/.test(text[15]), [6, 8, 9, 14, 15].map(i => text[i].slice(0, 30)).join(' | '));
    check('"Page i of N" on every page', text.every((t, i) => t.includes(`Page ${i + 1} of 18`)), 'missing');
    check('a Bates number on every page, in order', text.every((t, i) => t.includes('DOE ' + String(i + 1).padStart(6, '0'))), 'missing');
    check('the index gives each document\'s real pages and Bates range', /3-1 .*Itemized bill.*\$6,290\.00/.test(text[1]) && /pp\. 7.8/.test(text[1]) && /DOE 000007 . DOE 000008/.test(text[1]) && /4-2/.test(text[1]) && /pp\. 14.15/.test(text[1]), text[1]);
    check('the index totals the specials', /Total medical specials \(billed\): \$7,830\.00/.test(text[1]), text[1].slice(-200));

    // ---- each section as its own PDF, and the index as a spreadsheet ----
    const [zdl] = await Promise.all([page.waitForEvent('download'), page.click('text=⬇ Each section as its own PDF (.zip)')]);
    const zip = await page.evaluate(async (b) => { const z = await JSZip.loadAsync(new Uint8Array(b)); const out = {};
        for (const n of Object.keys(z.files)) out[n] = (await PDFLib.PDFDocument.load(await z.file(n).async('uint8array'))).getPageCount(); return out; }, Array.from(fs.readFileSync(await zdl.path())));
    check('the .zip has each section as its own PDF, and the whole packet', zip['01 - Cover Letter.pdf'] === 1 && zip['04 - PIP Log.pdf'] === 1 && zip['05 - Medical Bills.pdf'] === 3 && zip['06 - Medical Records.pdf'] === 6 && Object.values(zip).includes(18), JSON.stringify(zip));
    const [cdl] = await Promise.all([page.waitForEvent('download'), page.click('text=⬇ The index (.csv)')]);
    const csv = fs.readFileSync(await cdl.path(), 'utf8');
    check('the index as a spreadsheet', /"SECTION 3 — MEDICAL BILLS","3-1","Itemized bill — \$6,290\.00","07\/31\/2026","Riverton Spine & Rehab","pp\. 7–8","DOE 000007 – DOE 000008"/.test(csv), csv.slice(0, 600));

    // ---- Check my packet, now complete ----
    res = await page.evaluate(() => LSHPacket.check());
    check('Check my packet passes a finished packet', res.score === 100, failed(res).join(' | ') + ' ' + JSON.stringify(res.checks.filter(c => !c.ok)));
    // a provider billed with no records: caught
    await describe('Medical Records', 1, { source: 'Crescent Imaging Center' });
    res = await page.evaluate(() => LSHPacket.check());
    check('a provider billed with no records is caught', res.checks.some(c => !c.ok && /Crescent Imaging/.test(c.detail)) && failed(res).includes('The packet was built after your last change'), failed(res).join(' | '));
    await describe('Medical Records', 1, { source: 'Crescent Imaging' });
    // the bills not matching the PIP log: caught
    await describe('Medical Bills', 1, { amount: '1,450.00' });
    res = await page.evaluate(() => LSHPacket.check());
    check('bills that don\'t add up to the PIP log are caught', res.checks.some(c => !c.ok && /\$7,740\.00/.test(c.detail)), failed(res).join(' | '));
    await describe('Medical Bills', 1, { amount: '1,540.00' });

    // ---- a protected PDF is flagged and keeps the packet from building ----
    const enc = await page.evaluate(async () => {
        const { PDFDocument } = PDFLib, d = await PDFDocument.create(); d.addPage();
        d.context.trailerInfo.Encrypt = d.context.obj({ Filter: 'Standard', V: 1, R: 2, O: PDFLib.PDFHexString.of('00'), U: PDFLib.PDFHexString.of('00'), P: -4 });
        return Array.from(await d.save());
    });
    await input('Supporting Documents').setInputFiles([{ name: 'Locked.pdf', mimeType: 'application/pdf', buffer: Buffer.from(enc) }]);
    await waitDocs('Supporting Documents', 3);
    check('a password-protected PDF is flagged', /password-protected/.test(await sec('Supporting Documents').locator('.pk-doc.lost').textContent().catch(() => '')), 'not flagged');
    dialogs.length = 0;
    await page.click('text=⬇ Build the packet (one PDF)');
    await page.waitForTimeout(800);
    check('…and the packet won\'t build until it is taken out', dialogs.some(m => /Locked\.pdf password-protected/.test(m)), dialogs.join(' | '));
    await sec('Supporting Documents').locator('.pk-doc').nth(2).locator('button[title="Remove"]').click();
    await waitDocs('Supporting Documents', 2);

    // ---- moving a document, and the files after a reload ----
    await sec('Supporting Documents').locator('.pk-doc').nth(0).locator('select').selectOption({ label: 'Medical Records' });
    await waitDocs('Medical Records', 3);
    check('a document moves to another section, and takes the next exhibit number', (await sec('Medical Records').locator('.pk-doc .ex').nth(2).textContent()) === '4-3', await sec('Medical Records').locator('.pk-doc .ex').nth(2).textContent());
    await page.waitForTimeout(400);
    await page.reload();
    await page.waitForFunction(() => window.LSHPacket && window.PDFLib && document.querySelector('.pk-sec'));
    await page.waitForTimeout(600);
    check('the packet is still there after a reload', await page.evaluate(() => LSHPacket.packet().sections.find(s => s.title === 'Medical Records').docs.length) === 3 && await page.inputValue('[data-case="claimNo"]') === 'KM-55120', 'lost');
    check('…and so are the PDFs themselves', await page.locator('.pk-doc.lost').count() === 0, await page.locator('.pk-doc.lost').count() + ' lost');
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('text=⬇ Build the packet (one PDF)')]);
    check('…and it builds again from them', (await page.evaluate(async (b) => (await PDFLib.PDFDocument.load(new Uint8Array(b))).getPageCount(), Array.from(fs.readFileSync(await dl2.path()))) === 18), 'not 18');

    // ---- sent to the trainer ----
    await page.click('text=✓ Send it to my trainer');
    await page.waitForTimeout(500);
    const sent = RESULTS[RESULTS.length - 1] || {};
    check('sent to the trainer as Drafting — Demand Packet, with the score and the index', sent.simulator === 'Drafting — Demand Packet' && sent.score === 100 && sent.details && sent.details.index && sent.details.index.length > 5 && sent.who && sent.who.name === 'Ann Lee', JSON.stringify(sent).slice(0, 300));

    // ---- a binder: tab sheets before each section ----
    await page.click('.pk-tab:has-text("Mediation Binder")');
    await page.waitForSelector('input.ttl[value="Liability"]');
    check('a binder starts with its tabs on', await page.evaluate(() => LSHPacket.packet().opts.tabs) === true, 'off');
    await input('Liability').setInputFiles([await file('Crash report.pdf', 'LIAB', 2)]);
    await waitDocs('Liability', 1);
    const [bdl] = await Promise.all([page.waitForEvent('download'), page.click('text=⬇ Build the packet (one PDF)')]);
    // transmittal 1 + master index 1 + tab 1 + liability 2 = 5
    check('a binder has a tab sheet before each section', (await page.evaluate(async (b) => (await PDFLib.PDFDocument.load(new Uint8Array(b))).getPageCount(), Array.from(fs.readFileSync(await bdl.path())))) === 5, 'pages');
    check('the demand packet is kept while the binder is worked on', await page.evaluate(() => LSHPacket.state().packets.demand.sections.find(s => s.title === 'Medical Records').docs.length) === 3, 'lost');

    // ---- phone width ----
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('.pk-tab:has-text("Demand Packet")');
    await page.waitForTimeout(300);
    check('no sideways scroll at phone width', !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'scrolls');

    check('no page errors', !errors.length, errors.join(' | '));
    await browser.close(); server.close();
    oks.forEach(o => console.log('  ✔ ' + o));
    fails.forEach(f => console.log('  ✖ ' + f));
    console.log(`\n${oks.length} passed, ${fails.length} failed.`);
    process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });


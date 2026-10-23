// Makes the PDF copy of every original Drafting document, for the page's ✎ Edit in PDF button (any PDF editor).
//
// Each .docx in simulators/drafting/templates/ and simulators/drafting/providers/ is drawn exactly as the
// Drafting page draws the original (docx-preview + drafting-letterhead.js + the editor's Word pages, read-only)
// and printed edge to edge, one Word page per PDF page, to simulators/drafting/pdf/<same path>.pdf. Text stays
// text, so the PDF can be edited in a PDF editor. (LibreOffice was tried first: it scrambles the firm's
// letterhead, which is a set of anchored text boxes.)
//
// Usage, from the repository root, whenever the trainers send new documents:
//   node .github/scripts/make-drafting-pdfs.cjs            (needs `npm i playwright`)
//   DRAFTING_LIBS=<dir with node_modules of jszip, docx-preview>  serves those instead of the CDNs.
//   node .github/scripts/make-drafting-pdfs.cjs --check    fails if a document has no PDF, or a PDF no document.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.cwd(), DIR = path.join(ROOT, 'simulators/drafting'), OUT = path.join(DIR, 'pdf');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const docs = ['templates', 'providers'].flatMap(sub => walk(path.join(DIR, sub)).filter(f => /\.docx$/i.test(f)).map(f => path.relative(DIR, f)));
const pdfOf = (rel) => path.join(OUT, rel.replace(/\.docx$/i, '.pdf'));

if (process.argv.includes('--check')) {
    const missing = docs.filter(d => !fs.existsSync(pdfOf(d)));
    const extra = fs.existsSync(OUT) ? walk(OUT).filter(f => !docs.some(d => pdfOf(d) === f)).map(f => path.relative(ROOT, f)) : [];
    missing.forEach(d => console.error('No PDF for ' + d + ' (run node .github/scripts/make-drafting-pdfs.cjs)'));
    extra.forEach(f => console.error('A PDF with no document: ' + f));
    if (missing.length || extra.length) process.exit(1);
    console.log(`Drafting PDFs: all ${docs.length} documents have their PDF for Edit in PDF.`);
    process.exit(0);
}

const { chromium } = require('playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.docx': 'application/octet-stream' };
const PAGE = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="stylesheet" href="/simulators/drafting.css">
<style>
  html, body { margin: 0; padding: 0; background: #fff; }
  #host { padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff; }
  #host .docx-wrapper { padding: 0 !important; background: #fff !important; display: block !important; }
  #host .docx-wrapper > section.docx { margin: 0 !important; box-shadow: none !important; }
  #host .dr-pgband { display: none !important; }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/docx-preview@0.3.7/dist/docx-preview.min.js"></script>
<script src="/simulators/drafting-docx.js"></script>
<script src="/simulators/drafting-letterhead.js"></script>
<script src="/simulators/drafting-editor.js"></script>
</head><body><div class="dr-paper" id="host"></div></body></html>`;
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/__pdf.html') { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); return res.end(PAGE); }
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
const LIBS = process.env.DRAFTING_LIBS;
const LOCAL = { 'jszip.min.js': 'jszip/dist/jszip.min.js', 'docx-preview.min.js': 'docx-preview/dist/docx-preview.min.js' };

(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
    if (LIBS) await ctx.route(/cdn(js)?\.(cloudflare|jsdelivr)\.(com|net)\/.*\.js$/, (route) => {
        const name = route.request().url().split('/').pop(), f = LOCAL[name] && path.join(LIBS, 'node_modules', LOCAL[name]);
        return f && fs.existsSync(f) ? route.fulfill({ body: fs.readFileSync(f), contentType: 'text/javascript' }) : route.continue();
    });
    let failed = 0;
    for (const rel of docs) {
        const page = await ctx.newPage();
        try {
            await page.goto(base + '/__pdf.html');
            const src = '/simulators/drafting/' + rel.split(path.sep).map(encodeURIComponent).join('/');
            const size = await page.evaluate(async (src) => {
                const bytes = await (await fetch(src)).arrayBuffer();
                const host = document.getElementById('host');
                const xml = await LSHDraftingDocx.documentXml(bytes);
                // drawn twice: the first drawing loads the file's fonts, the second lays the pages out with them
                await LSHDraftingEditor.open({ host, baseXml: xml, bytes, readOnly: true, gap: 0 });
                await document.fonts.ready;
                host.innerHTML = '';
                await LSHDraftingEditor.open({ host, baseXml: xml, bytes, readOnly: true, gap: 0 });
                await document.fonts.ready;
                const secs = [].slice.call(host.querySelectorAll('section.docx'));
                const H = +secs[0].dataset.h, W = secs[0].offsetWidth;
                return { W, H, pages: Math.round(secs.reduce((a, s) => a + s.offsetHeight, 0) / H) };
            }, src);
            const out = pdfOf(rel);
            fs.mkdirSync(path.dirname(out), { recursive: true });
            await page.pdf({ path: out, width: size.W + 'px', height: size.H + 'px', printBackground: true,
                margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1-' + size.pages });
            console.log(`${rel} → ${size.pages} page${size.pages === 1 ? '' : 's'}`);
        } catch (e) {
            failed++;
            console.error(`${rel}: ${e.message}`);
        }
        await page.close();
    }
    await browser.close(); server.close();
    if (failed) { console.error(`${failed} document(s) could not be printed.`); process.exit(1); }
    console.log(`Drafting PDFs: ${docs.length} written to simulators/drafting/pdf/.`);
})();

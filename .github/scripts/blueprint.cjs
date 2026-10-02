// Orientation and its PDFs (orientation.html with lsh-blueprint.js, the Blueprint engine every LSH platform shares).
// Static files; jsPDF served from node_modules in place of cdnjs.
// Checks: a visitor or trainee gets the Trainees track only (no tab to the Trainers & Admins track, even with
// ?track=admin); a signed-in Admin gets both tracks and starts on the admin one; ⬇ Download PDF saves the track
// that's showing, a page per slide (plus the cover) with each slide's title, and the trainee PDF has no admin slides.
// Usage: node .github/scripts/blueprint.cjs   (from the repository root; needs `npm i playwright jspdf@4.2.1`)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"success":false}'); }
    let f = path.join(ROOT, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', ETag: '"7a1c9e0b2d44"' }); res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(f));
});
const JSPDF = fs.readFileSync(path.join(path.dirname(require.resolve('jspdf')), 'jspdf.umd.min.js'));
const failures = []; const fail = (m) => failures.push(m);
function inspect(buf) {
    let raw = buf.toString('latin1'), at = 0; const parts = [raw];
    while ((at = raw.indexOf('stream', at)) >= 0) {
        const start = raw.indexOf('\n', at) + 1, end = raw.indexOf('endstream', start);
        if (start <= 0 || end < 0) break;
        try { parts.push(zlib.inflateSync(buf.subarray(start, end)).toString('latin1')); } catch (e) { /* not a Flate stream */ }
        at = end + 9;
    }
    raw = parts.join('\n');
    const text = (raw.match(/\((?:\\.|[^\\)])*\)\s*Tj/g) || []).map(s => s.replace(/\)\s*Tj$/, '').slice(1).replace(/\\(.)/g, '$1')).join('\n');
    return { pdf: parts[0].startsWith('%PDF'), pages: (raw.match(/\/Type \/Page\b(?!s)/g) || []).length, text };
}
(async () => {
    await new Promise(r => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const open = async (session, q = '') => {
        const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true }); const page = await ctx.newPage();
        page.on('pageerror', e => fail(`page error: ${e.message}`));
        await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/4\.2\.1\/jspdf\.umd\.min\.js/, r => r.fulfill({ contentType: 'text/javascript', body: JSPDF }));
        await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ contentType: 'text/css', body: '' }));
        if (session) await page.addInitScript((s) => sessionStorage.setItem('LSH_SESSION_V1', JSON.stringify(s)), session);
        await page.goto(base + '/orientation.html' + q, { waitUntil: 'load' }); await page.waitForTimeout(500);
        return page;
    };
    const pdfOf = async (page) => { const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#orPdf')]); return { name: dl.suggestedFilename(), ...inspect(fs.readFileSync(await dl.path())) }; };
    const state = (page) => page.evaluate(() => ({ tabs: !document.querySelector('.or-tabs').hidden, track: new URLSearchParams(location.search).get('track'), admin: 'admin' in SLIDES, slides: SLIDES.trainee.length, adminSlides: SLIDES.admin ? SLIDES.admin.length : 0, adminTitles: (SLIDES.admin || []).map(s => s.h) }));

    // ---- a trainee, even asking for the admin track ----
    let page = await open({ username: 'jo', userType: 'Trainee', fullName: 'Jo Cruz' }, '?track=admin');
    let st = await state(page);
    if (st.tabs || st.admin || st.track !== 'trainee') fail(`a trainee should get the Trainees track only: ${JSON.stringify(st)}`);
    let pdf = await pdfOf(page);
    if (pdf.name !== 'LSH_Training_Portal_Blueprint_Trainee.pdf' || !pdf.pdf || pdf.pages !== st.slides + 1) fail(`the trainee PDF: ${pdf.name}, ${pdf.pages} pages for ${st.slides} slides`);
    if (!/One portal for all of your LSH training/.test(pdf.text) || !/deploy 7a1c9e0b/.test(pdf.text)) fail('the trainee PDF is missing its first slide or the deploy stamp');
    if (/Master Control|Access queue/.test(pdf.text)) fail('the trainee PDF has admin slides');
    await page.context().close();

    // ---- a visitor ----
    page = await open(null);
    st = await state(page);
    if (st.tabs || st.admin) fail(`a visitor should get the Trainees track only: ${JSON.stringify(st)}`);
    await page.context().close();

    // ---- an Admin ----
    page = await open({ username: 'trainer1', userType: 'Admin', fullName: 'Matt G.' });
    st = await state(page);
    if (!st.tabs || !st.admin || st.track !== 'admin') fail(`an Admin should get both tracks, starting on the admin one: ${JSON.stringify(st)}`);
    pdf = await pdfOf(page);
    if (pdf.name !== 'LSH_Training_Portal_Blueprint_Trainer.pdf' || pdf.pages !== st.adminSlides + 1) fail(`the admin PDF: ${pdf.name}, ${pdf.pages} pages for ${st.adminSlides} slides`);
    const missing = st.adminTitles.map(t => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/[^\x00-\xff]/g, '').trim()).filter(t => !pdf.text.includes(t));
    if (missing.length) fail(`the admin PDF is missing slides: ${missing.join(' | ')}`);
    await page.click('.or-tabs button[data-track="trainee"]');
    pdf = await pdfOf(page);
    if (pdf.name !== 'LSH_Training_Portal_Blueprint_Trainee.pdf') fail(`an Admin on the Trainees track downloaded ${pdf.name}`);
    await page.context().close();

    await browser.close(); server.close();
    if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
    console.log('Orientation test passed (trainees get the Trainees track only; an Admin gets both; each track downloads as a PDF with every slide and the deploy stamp).');
})().catch(e => { console.error(e); process.exit(1); });

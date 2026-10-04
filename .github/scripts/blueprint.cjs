// Orientation and its PDFs (orientation.html with lsh-blueprint.js, the Blueprint engine every LSH platform shares).
// Static files; jsPDF served from node_modules in place of cdnjs.
// Checks: a visitor or trainee gets the Trainees track only (no tab to the Trainers & Admins track, even with
// ?track=admin); a signed-in Admin gets both tracks and starts on the admin one; ⬇ Download PDF saves the track
// that's showing, a page per slide (plus the cover) with each slide's title, and the trainee PDF has no admin slides.
// Numbering: the slide numbers match everywhere. Each PDF's cover is "Cover", then its pages are "1 / n" to "n / n",
// headed "1 of n" to "n of n", the same as the page's own counter ("1 / n" to "n / n"); nothing says n + 1 (an 8-slide
// track's PDF used to end on "9 / 9"). The engine's own deck (this page shows its own slides, so the test opens the
// deck through LSHBlueprint) numbers the same: the counter "Cover · n slides" on the cover, then "k / n" on the
// counter and the footer, "k of n" in the header, the highlighted contents button k, and "n / n" on the last slide,
// the same as the last contents button.
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
    // the PDF's numbers: the cover's footer is "Cover", then the pages' footers are "1 / n" to "n / n" and their headers
    // "… · 1 OF n" to "… · n OF n", in order; nothing says n + 1
    const numbered = (pdf, n, label) => {
        const lines = pdf.text.split('\n').map(x => x.trim()), feet = lines.filter(x => /^\d+ \/ \d+$/.test(x)), heads = lines.filter(x => /· \d+ OF \d+$/.test(x)).map(x => x.replace(/^.*· /, ''));
        const want = Array.from({ length: n }, (_, k) => `${k + 1} / ${n}`);
        if (!lines.includes('Cover') || feet.join(', ') !== want.join(', ')) fail(`the ${label} PDF's page footers should be Cover, then 1 / ${n} to ${n} / ${n}; they are: ${lines.includes('Cover') ? 'Cover' : '(no Cover)'}, ${feet.join(', ')}`);
        if (heads.join(', ') !== want.map(x => x.replace(' / ', ' OF ')).join(', ')) fail(`the ${label} PDF's page headers should be 1 of ${n} to ${n} of ${n}; they are: ${heads.join(', ')}`);
        if (pdf.text.includes(`${n + 1} / ${n + 1}`)) fail(`the ${label} PDF says ${n + 1} / ${n + 1}, but the track has ${n} slides`);
    };
    // the page's own counter: "1 / n" on the first slide, "n / n" on the last, as the PDF's pages
    const counts = (page) => page.evaluate(() => { const el = document.getElementById('orCount'), first = el.textContent; show(1e9); const last = el.textContent; show(0); return { first, last }; });
    // the engine's own deck, slide by slide: Cover, then 1 to n on the counter, the highlighted contents button, the
    // slide's header and footer; the last slide is "n / n", as its button; nothing says n + 1
    const walk = (page, which) => page.evaluate(async (which) => {
        const out = [];
        if (!LSHBlueprint.open(which) || LSHBlueprint.current().deck !== which) return [`the engine's ${which} deck didn't open`];
        // n slides and the cover, from the open deck (not LSHBlueprint.decks(): it reads every deck, and on a trainee's page
        // the trainer one is gone with SLIDES.admin)
        const n = LSH_BLUEPRINT[LSHBlueprint.current().deck].slides.length, total = n + 1, nums = (s) => (s.match(/\d+/g) || []).map(Number);
        for (let i = 0; i < total; i++) {
            LSHBlueprint.go(i, true); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            const card = document.getElementById('lbp-slide').firstElementChild, name = i === 0 ? `the engine's ${which} cover` : `the engine's ${which} slide ${i}`;
            if (!card) { out.push(`${name}: nothing drawn`); continue; }
            const count = document.getElementById('lbp-count').textContent.trim(), on = ((document.querySelector('#lbp-toc button.on') || {}).textContent || '').trim();
            const foot = card.querySelector('.lbp-foot span:last-child'), kicker = card.querySelector('.lbp-head .lbp-kicker');
            const shown = { counter: count, footer: foot ? foot.textContent.trim() : '', header: kicker ? kicker.textContent.trim() : '' };
            if (i === 0) {
                if (count !== `Cover · ${n} slides`) out.push(`${name}: the counter reads "${count}", not "Cover · ${n} slides"`);
                if (on !== '★') out.push(`${name}: the highlighted contents button is "${on}", not ★`);
            } else {
                if (count !== `${i} / ${n}`) out.push(`${name}: the counter reads "${count}", not "${i} / ${n}"`);
                if (on !== String(i)) out.push(`${name}: the highlighted contents button is "${on}", not ${i}`);
                if (shown.footer !== `${i} / ${n}`) out.push(`${name}: the footer reads "${shown.footer}", not "${i} / ${n}"`);
                if (!shown.header.endsWith(`· ${i} of ${n}`)) out.push(`${name}: the header reads "${shown.header}", not "… · ${i} of ${n}"`);
            }
            Object.entries(shown).forEach(([where, text]) => { if (nums(text).some(x => x > n)) out.push(`${name}: the ${where} shows a number past the last slide (${n}): "${text}"`); });
            if (i === n) {
                const last = [...document.querySelectorAll('#lbp-toc button')].pop();
                if (!last || count !== `${last.textContent.trim()} / ${n}`) out.push(`${name} (the last): the counter "${count}" doesn't match the last contents button "${last ? last.textContent.trim() : ''}"`);
            }
        }
        LSHBlueprint.close();
        return out;
    }, which);

    // ---- a trainee, even asking for the admin track ----
    let page = await open({ username: 'jo', userType: 'Trainee', fullName: 'Jo Cruz' }, '?track=admin');
    let st = await state(page);
    if (st.tabs || st.admin || st.track !== 'trainee') fail(`a trainee should get the Trainees track only: ${JSON.stringify(st)}`);
    let pdf = await pdfOf(page);
    if (pdf.name !== 'LSH_Training_Portal_Blueprint_Trainee.pdf' || !pdf.pdf || pdf.pages !== st.slides + 1) fail(`the trainee PDF: ${pdf.name}, ${pdf.pages} pages for ${st.slides} slides`);
    if (!/One portal for all of your LSH training/.test(pdf.text) || !/deploy 7a1c9e0b/.test(pdf.text)) fail('the trainee PDF is missing its first slide or the deploy stamp');
    if (/Master Control|Access queue/.test(pdf.text)) fail('the trainee PDF has admin slides');
    numbered(pdf, st.slides, 'trainee');
    let c = await counts(page);
    if (c.first !== `1 / ${st.slides}` || c.last !== `${st.slides} / ${st.slides}`) fail(`the page's counter should read 1 / ${st.slides} to ${st.slides} / ${st.slides}, as the PDF's pages: ${JSON.stringify(c)}`);
    (await walk(page, 'trainee')).forEach(fail);
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
    numbered(pdf, st.adminSlides, 'admin');
    c = await counts(page);
    if (c.first !== `1 / ${st.adminSlides}` || c.last !== `${st.adminSlides} / ${st.adminSlides}`) fail(`the admin track's counter should read 1 / ${st.adminSlides} to ${st.adminSlides} / ${st.adminSlides}, as the PDF's pages: ${JSON.stringify(c)}`);
    await page.click('.or-tabs button[data-track="trainee"]');
    pdf = await pdfOf(page);
    if (pdf.name !== 'LSH_Training_Portal_Blueprint_Trainee.pdf') fail(`an Admin on the Trainees track downloaded ${pdf.name}`);
    numbered(pdf, st.slides, 'trainee (an Admin\'s)');
    (await walk(page, 'trainer')).forEach(fail);
    await page.context().close();

    await browser.close(); server.close();
    if (failures.length) { console.log(`\n${failures.length} failure(s):`); failures.forEach((f, i) => console.log(`${i + 1}. ${f}`)); process.exit(1); }
    console.log(`Orientation test passed (trainees get the Trainees track only; an Admin gets both; each track downloads as a PDF with every slide and the deploy stamp; numbered Cover, then 1 / n to n / n, as the page: trainees ${st.slides} slides, admins ${st.adminSlides}).`);
})().catch(e => { console.error(e); process.exit(1); });

/* ============================================================
   ✍ Drafting (shared) — the letterhead, the footer and the signature
   docx-preview draws a letter's text the way Word does, but not what floats over the page:
   the firm's letterhead and office footer are groups of text boxes, logos and rules anchored
   to the page (Google Docs exports them that way), and the signature is an image anchored
   beside "Very truly yours". This draws those floating pieces from the same .docx, at the
   positions the file gives them, on top of what docx-preview rendered.

     LSHDraftingLetterhead.draw(zipData, host)   host: the element docx-preview rendered into
   Nothing here edits the file; it only reads it.
   ============================================================ */
(function () {
'use strict';
const NS = {
    w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
    r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    rel: 'http://schemas.openxmlformats.org/package/2006/relationships'
};
const EMU = 9525, TWIP = 635;                      // EMU per CSS pixel (96 dpi), EMU per twip
const kids = (n, ns, name) => [].filter.call(n ? n.childNodes : [], c => c.nodeType === 1 && c.namespaceURI === NS[ns] && (!name || c.localName === name));
const kid = (n, ns, name) => kids(n, ns, name)[0] || null;
const all = (n, ns, name) => n ? [].slice.call(n.getElementsByTagNameNS(NS[ns], name)) : [];
const attr = (n, ns, name) => n ? (n.getAttributeNS(NS[ns], name) || n.getAttribute((ns === 'w' ? 'w:' : '') + name) || '') : '';
const num = (v, d) => { const x = parseFloat(v); return isFinite(x) ? x : d; };
const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml');

// Word keeps a modern drawing and an old VML copy side by side; only the modern one is drawn.
function dropFallbacks(doc) { all(doc, 'mc', 'Fallback').forEach(f => f.parentNode.removeChild(f)); return doc; }

async function relsOf(zip, part) {
    const i = part.lastIndexOf('/'), p = part.slice(0, i) + '/_rels/' + part.slice(i + 1) + '.rels';
    const f = zip.file(p), out = {};
    if (!f) return out;
    all(parse(await f.async('string')), 'rel', 'Relationship').forEach(r => {
        const t = r.getAttribute('Target') || '';
        out[r.getAttribute('Id')] = /^\//.test(t) ? t.slice(1) : (part.slice(0, i) + '/' + t).replace(/[^/]+\/\.\.\//g, '');
    });
    return out;
}
async function dataUrl(zip, path) {
    const f = zip.file(path); if (!f) return '';
    const ext = path.split('.').pop().toLowerCase();
    const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml' }[ext] || 'image/png';
    return 'data:' + type + ';base64,' + await f.async('base64');
}

/* ---------- the fonts the firm embedded in the file (the letterhead's Helvetica Neue) ---------- */
const loadedFonts = {};
async function embedFonts(zip) {
    const ft = zip.file('word/fontTable.xml');
    if (!ft || typeof FontFace === 'undefined' || !document.fonts) return;
    const rels = await relsOf(zip, 'word/fontTable.xml');
    const doc = parse(await ft.async('string'));
    const jobs = [];
    all(doc, 'w', 'font').forEach(font => {
        const name = attr(font, 'w', 'name');
        [['embedRegular', 'normal', 'normal'], ['embedBold', 'bold', 'normal'], ['embedItalic', 'normal', 'italic'], ['embedBoldItalic', 'bold', 'italic']].forEach(([tag, weight, style]) => {
            const e = kid(font, 'w', tag); if (!e) return;
            const path = rels[e.getAttributeNS(NS.r, 'id')], f = path && zip.file(path), id = name + '|' + weight + '|' + style;
            if (!f || loadedFonts[id]) return;
            loadedFonts[id] = true;
            jobs.push(f.async('uint8array').then(bytes => {
                // An .odttf is obfuscated: its first 32 bytes are XORed with the font key (a GUID, read backwards).
                const key = (attr(e, 'w', 'fontKey') || '').replace(/[{}-]/g, '');
                if (/\.odttf$/i.test(path) && key.length === 32) {
                    const k = []; for (let i = 30; i >= 0; i -= 2) k.push(parseInt(key.substr(i, 2), 16));
                    bytes = bytes.slice(0); for (let i = 0; i < 32; i++) bytes[i] ^= k[i % 16];
                }
                const face = new FontFace(name, bytes, { weight, style });
                return face.load().then(ff => document.fonts.add(ff));
            }).catch(() => { /* a font the browser can't read: the fallback stack takes over */ }));
        });
    });
    await Promise.all(jobs);
}
const fontStack = (name) => (name ? `'${name.replace(/'/g, '')}', ` : '') + "'Helvetica Neue', Helvetica, Arial, sans-serif";

/* ---------- a text box's paragraphs ---------- */
function runsHtml(p) {
    let html = '';
    all(p, 'w', 'r').forEach(r => {
        const rPr = kid(r, 'w', 'rPr'), css = [];
        if (rPr) {
            const f = kid(rPr, 'w', 'rFonts'); if (f && attr(f, 'w', 'ascii')) css.push('font-family:' + fontStack(attr(f, 'w', 'ascii')));
            const sz = kid(rPr, 'w', 'sz'); if (sz) css.push('font-size:' + num(attr(sz, 'w', 'val'), 22) / 2 + 'pt');
            const b = kid(rPr, 'w', 'b'); if (b && !/^(0|false)$/.test(attr(b, 'w', 'val'))) css.push('font-weight:700');
            const i = kid(rPr, 'w', 'i'); if (i && !/^(0|false)$/.test(attr(i, 'w', 'val'))) css.push('font-style:italic');
            const c = kid(rPr, 'w', 'color'); if (c && /^[0-9a-f]{6}$/i.test(attr(c, 'w', 'val'))) css.push('color:#' + attr(c, 'w', 'val'));
            if (kid(rPr, 'w', 'caps')) css.push('text-transform:uppercase');
        }
        let txt = '';
        kids(r, 'w').forEach(n => {
            if (n.localName === 't') txt += (n.textContent || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
            else if (n.localName === 'tab') txt += ' ';
            else if (n.localName === 'br') txt += '<br>';
        });
        if (txt) html += `<span style="${css.join(';')}">${txt}</span>`;
    });
    return html;
}
function paragraphsHtml(box) {
    return kids(box, 'w', 'p').map(p => {
        const pPr = kid(p, 'w', 'pPr'), css = ['margin:0'];
        const sp = kid(pPr, 'w', 'spacing'), jc = kid(pPr, 'w', 'jc');
        if (sp) {
            css.push('margin-top:' + num(attr(sp, 'w', 'before'), 0) / 20 + 'pt', 'margin-bottom:' + num(attr(sp, 'w', 'after'), 0) / 20 + 'pt');
            const line = num(attr(sp, 'w', 'line'), 0), rule = attr(sp, 'w', 'lineRule') || 'auto';
            if (line) css.push('line-height:' + (rule === 'auto' ? (line / 240 * 1.3).toFixed(3) : line / 20 + 'pt'));
        }
        // An empty paragraph is as tall as its paragraph mark's font, not the page's.
        const mark = pPr && kid(kid(pPr, 'w', 'rPr'), 'w', 'sz');
        css.push('font-size:' + (mark ? num(attr(mark, 'w', 'val'), 22) / 2 : 5.5) + 'pt');
        if (jc) css.push('text-align:' + ({ center: 'center', right: 'right', end: 'right', both: 'justify' }[attr(jc, 'w', 'val')] || 'left'));
        const inner = runsHtml(p);
        return `<p style="${css.join(';')}">${inner || '&nbsp;'}</p>`;
    }).join('');
}

/* ---------- a drawing: a group, a shape (text box or rule) or a picture ---------- */
function xfrmOf(el) {
    const x = el && (all(el, 'a', 'xfrm')[0]);
    if (!x) return null;
    const off = kid(x, 'a', 'off'), ext = kid(x, 'a', 'ext'), cOff = kid(x, 'a', 'chOff'), cExt = kid(x, 'a', 'chExt');
    const v = (n, a) => num(n && n.getAttribute(a), 0);
    return { x: v(off, 'x'), y: v(off, 'y'), w: v(ext, 'cx'), h: v(ext, 'cy'),
        cx: cOff ? v(cOff, 'x') : v(off, 'x'), cy: cOff ? v(cOff, 'y') : v(off, 'y'),
        cw: cExt ? v(cExt, 'cx') : v(ext, 'cx'), ch: cExt ? v(cExt, 'cy') : v(ext, 'cy'), flipH: x.getAttribute('flipH') === '1', flipV: x.getAttribute('flipV') === '1' };
}
// Each child's own transform, read from its *own* properties (not a descendant's).
function ownXfrm(el) {
    const pr = [].find.call(el.childNodes, c => c.nodeType === 1 && /^(spPr|grpSpPr)$/.test(c.localName));
    return xfrmOf(pr);
}
const color = (fill) => { const c = fill && all(fill, 'a', 'srgbClr')[0]; return c ? '#' + c.getAttribute('val') : ''; };

async function shapeHtml(el, box, ctx) {
    const name = el.localName;
    const pos = `position:absolute;left:${box.x / EMU}px;top:${box.y / EMU}px;width:${box.w / EMU}px;height:${box.h / EMU}px;`;
    if (name === 'wgp' || name === 'grpSp') {
        const x = ownXfrm(el) || { cx: 0, cy: 0, cw: box.w, ch: box.h };
        const sx = x.cw ? box.w / x.cw : 1, sy = x.ch ? box.h / x.ch : 1;
        let inner = '';
        for (const c of [].filter.call(el.childNodes, c => c.nodeType === 1 && /^(wsp|grpSp|pic)$/.test(c.localName))) {
            const cx = ownXfrm(c); if (!cx) continue;
            inner += await shapeHtml(c, { x: (cx.x - x.cx) * sx, y: (cx.y - x.cy) * sy, w: cx.w * sx, h: cx.h * sy }, ctx);
        }
        return `<div style="${pos}">${inner}</div>`;
    }
    if (name === 'pic') {
        const blip = all(el, 'a', 'blip')[0], id = blip && blip.getAttributeNS(NS.r, 'embed');
        const src = id && ctx.rels[id] ? await dataUrl(ctx.zip, ctx.rels[id]) : '';
        return src ? `<img alt="" src="${src}" style="${pos}object-fit:fill;">` : '';
    }
    if (name === 'wsp') {
        const pr = [].find.call(el.childNodes, c => c.nodeType === 1 && c.localName === 'spPr');
        const geom = pr && all(pr, 'a', 'prstGeom')[0], prst = geom ? geom.getAttribute('prst') : 'rect';
        const ln = pr && kid(pr, 'a', 'ln'), lnColor = ln && !kid(ln, 'a', 'noFill') ? color(kid(ln, 'a', 'solidFill')) : '';
        const lnW = Math.max(1, num(ln && ln.getAttribute('w'), 9525) / EMU);
        if (/line|Connector/i.test(prst)) {
            if (!lnColor) return '';
            // A rule: a hairline along whichever side has length.
            return box.w < box.h
                ? `<div style="position:absolute;left:${box.x / EMU}px;top:${box.y / EMU}px;height:${box.h / EMU}px;border-left:${lnW}px solid ${lnColor};"></div>`
                : `<div style="position:absolute;left:${box.x / EMU}px;top:${box.y / EMU}px;width:${box.w / EMU}px;border-top:${lnW}px solid ${lnColor};"></div>`;
        }
        const fill = pr && !kid(pr, 'a', 'noFill') ? color(kid(pr, 'a', 'solidFill')) : '';
        const body = [].find.call(el.childNodes, c => c.nodeType === 1 && c.localName === 'bodyPr');
        const ins = (a, d) => num(body && body.getAttribute(a), d) / EMU;
        const valign = { t: 'flex-start', ctr: 'center', b: 'flex-end' }[body && body.getAttribute('anchor')] || 'flex-start';
        const txbx = [].find.call(el.childNodes, c => c.nodeType === 1 && c.localName === 'txbx');
        const content = txbx && all(txbx, 'w', 'txbxContent')[0];
        const text = content ? paragraphsHtml(content) : '';
        if (!text.replace(/<[^>]+>|&nbsp;/g, '').trim() && !fill && !lnColor) return '';
        return `<div style="${pos}box-sizing:border-box;display:flex;flex-direction:column;justify-content:${valign};
            padding:${ins('tIns', 45720)}px ${ins('rIns', 91440)}px ${ins('bIns', 45720)}px ${ins('lIns', 91440)}px;
            ${fill ? 'background:' + fill + ';' : ''}${lnColor ? 'border:' + lnW + 'px solid ' + lnColor + ';' : ''}
            overflow:visible;white-space:normal;color:#000;font-family:${fontStack('')};">${text}</div>`;
    }
    return '';
}

/* ---------- where an anchored drawing sits on the page ---------- */
function place(anchor, page, where) {
    const ext = kid(anchor, 'wp', 'extent'), w = num(ext && ext.getAttribute('cx'), 0), h = num(ext && ext.getAttribute('cy'), 0);
    const axis = (tag, size, pageSize, marginA, marginB, start) => {
        const p = kid(anchor, 'wp', tag); if (!p) return { v: 0, rel: 'page' };
        const rel = p.getAttribute('relativeFrom') || 'page', off = kid(p, 'wp', 'posOffset'), al = kid(p, 'wp', 'align');
        let base = 0, span = pageSize;
        if (/margin|column/.test(rel)) { base = marginA; span = pageSize - marginA - marginB; }
        else if (/paragraph|line/.test(rel)) { base = start; span = pageSize - marginA - marginB; }
        if (off) return { v: base + num(off.textContent, 0), rel };
        const a = al ? al.textContent : 'left';
        return { v: base + (/right|bottom/.test(a) ? span - size : /center/.test(a) ? (span - size) / 2 : 0), rel };
    };
    const H = axis('positionH', w, page.w, page.left, page.right, page.left);
    // A footer's paragraph is its last line, just above the footer distance from the bottom edge.
    const footerLine = page.h - page.footer - 0.18 * 914400;
    const V = axis('positionV', h, page.h, page.top, page.bottom, where === 'footer' ? footerLine : page.header);
    return { x: H.v, y: V.v, w, h, relV: V.rel };
}
async function drawingHtml(anchor, box, ctx) {
    const data = all(anchor, 'a', 'graphicData')[0];
    const g = data && [].find.call(data.childNodes, c => c.nodeType === 1 && /^(wgp|wsp|pic)$/.test(c.localName));
    return g ? shapeHtml(g, { x: 0, y: 0, w: box.w, h: box.h }, ctx) : '';
}
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

async function partLayer(zip, part, where, page) {
    const f = part && zip.file(part); if (!f) return [];
    const doc = dropFallbacks(parse(await f.async('string')));
    const ctx = { zip, rels: await relsOf(zip, part) }, out = [];
    for (const a of all(doc, 'wp', 'anchor')) {
        const box = place(a, page, where);
        // The firm's 1P/3P letters keep their office footer in the header part, anchored to the
        // header's paragraph, so it would land on top of the letterhead. The page saves the room
        // for it at the bottom (a deep bottom margin); that is where the firm's letters print it.
        if (where === 'header' && /paragraph|line/.test(box.relV) && out.some(o => overlaps(o.box, box)) && page.bottom >= box.h * 0.8) {
            box.y = page.h - box.h - Math.max(0, Math.min(page.bottom - box.h, 0.2 * 914400));
        }
        out.push({ box, html: await drawingHtml(a, box, ctx), behind: a.getAttribute('behindDoc') === '1' });
    }
    if (where === 'footer') out.forEach(o => { if (o.box.y + o.box.h > page.h) o.box.y = page.h - o.box.h; });
    return out;
}

async function draw(zipData, host) {
    const zip = await JSZip.loadAsync(zipData);
    const doc = dropFallbacks(parse(await zip.file('word/document.xml').async('string')));
    const rels = await relsOf(zip, 'word/document.xml');
    // A letter can have more than one Word section (the 3P letter's affidavit is its own, with no
    // letterhead), each with its own page, margins, header and footer.
    const pageOf = (sect) => {
        const sz = kid(sect, 'w', 'pgSz'), mar = kid(sect, 'w', 'pgMar');
        const tw = (n, a, d) => num(attr(n, 'w', a), d) * TWIP;   // twips → EMU
        return { w: tw(sz, 'w', 12240), h: tw(sz, 'h', 15840), top: tw(mar, 'top', 1440), bottom: tw(mar, 'bottom', 1440),
            left: tw(mar, 'left', 1440), right: tw(mar, 'right', 1440), header: tw(mar, 'header', 720), footer: tw(mar, 'footer', 720) };
    };
    const refOf = (sect, tag) => { const r = kids(sect, 'w', tag).find(x => (attr(x, 'w', 'type') || 'default') === 'default') || kid(sect, 'w', tag);
        return r ? rels[r.getAttributeNS(NS.r, 'id')] : null; };
    await embedFonts(zip);
    const sects = all(all(doc, 'w', 'body')[0], 'w', 'sectPr');
    const perSect = [];
    for (const sect of sects) {
        const page = pageOf(sect);
        perSect.push({ page, layers: (await partLayer(zip, refOf(sect, 'headerReference'), 'header', page))
            .concat(await partLayer(zip, refOf(sect, 'footerReference'), 'footer', page)) });
    }
    const page = perSect.length ? perSect[perSect.length - 1].page : pageOf(null);

    const sections = [].slice.call(host.querySelectorAll('section.docx'));
    sections.forEach((sec, n) => {
        // docx-preview draws a page per section (and per page break): pair them up when it can be done.
        const own = perSect.length === sections.length ? perSect[n] : perSect[Math.min(n, perSect.length - 1)];
        if (!own) return;
        const layers = own.layers, page = own.page;
        sec.style.position = 'relative';
        // docx-preview's own attempt at the header and footer drawings is replaced by this layer.
        sec.querySelectorAll('header img, footer img').forEach(img => { img.style.visibility = 'hidden'; });
        const layer = document.createElement('div');
        layer.className = 'dr-lh';
        layer.setAttribute('aria-hidden', 'true');
        layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
        layer.innerHTML = layers.map(l => {
            // A footer belongs at the bottom of the page as drawn, which can run longer than a Word page,
            // so it is pinned to the bottom edge and follows the page as the letter grows.
            const v = l.box.y > page.h / 2 ? `bottom:${(page.h - l.box.y - l.box.h) / EMU}px` : `top:${l.box.y / EMU}px`;
            return `<div style="position:absolute;left:${l.box.x / EMU}px;${v};width:${l.box.w / EMU}px;height:${l.box.h / EMU}px;${l.behind ? 'z-index:0;' : 'z-index:2;'}">${l.html}</div>`;
        }).join('');
        sec.insertBefore(layer, sec.firstChild);
    });
    clearFooters(host);

    // The body's own floating pictures (the signature beside "Very truly yours"): docx-preview puts them
    // relative to the paragraph's indent; Word measures from the margin. Move each to Word's spot.
    const anchors = all(all(doc, 'w', 'body')[0] || doc, 'wp', 'anchor');
    const bodyImgs = [].slice.call(host.querySelectorAll('section.docx article img'));
    anchors.forEach((a, i) => {
        const img = bodyImgs[i]; if (!img) return;
        const sec = img.closest('section.docx'), wrap = img.parentElement;
        const sr = sec.getBoundingClientRect(), wr = wrap.getBoundingClientRect(), para = wrap.closest('p') || wrap;
        const zoom = sr.width / sec.offsetWidth || 1;
        const box = place(a, page, 'body'), V = kid(a, 'wp', 'positionV');
        // Kept inside its own paragraph, so it moves with the text above it; placed from Word's numbers.
        const wrapLeft = (wr.left - sr.left) / zoom, wrapTop = (wr.top - sr.top) / zoom;
        const paraTop = (para.getBoundingClientRect().top - sr.top) / zoom;
        const top = /paragraph|line/.test(V && V.getAttribute('relativeFrom')) ? paraTop + (box.y - page.header) / EMU : box.y / EMU;
        wrap.style.position = 'relative';
        img.style.position = 'absolute';
        img.style.left = (box.x / EMU - wrapLeft) + 'px';
        img.style.top = (top - wrapTop) + 'px';
        img.style.zIndex = a.getAttribute('behindDoc') === '1' ? '-1' : '2';
        img.style.pointerEvents = 'none';
    });
    // A picture behind the text must not cover it: the text sits above layer 0.
    host.querySelectorAll('section.docx > article').forEach(art => { art.style.position = 'relative'; art.style.zIndex = '1'; });
    await tabs(zip, doc, host, page);
}

/* ---------- tab stops, the way Word sets them ----------
   docx-preview measures tab stops from the wrong edge on these letters (the "Re:" block drifts),
   so they are set again here: Word measures every stop from the left margin, takes the paragraph's
   own stops, then the hanging indent, then the default stop every half inch. A tab runs to the
   first of those past where it starts. Re-run whenever a blank changes width. */
let tabState = null;
async function tabs(zip, doc, host, page) {
    const settings = zip.file('word/settings.xml');
    let every = 720;
    if (settings) { const d = all(parse(await settings.async('string')), 'w', 'defaultTabStop')[0]; if (d) every = num(attr(d, 'w', 'val'), 720); }
    // Body paragraphs in order, as docx-preview draws them (a text box's paragraphs are not among them,
    // and a paragraph with a page break in it is drawn as two, one on each page).
    const xmlPs = [], bodyPs = all(all(doc, 'w', 'body')[0], 'w', 'p').filter(p => !closestTag(p, 'txbxContent'));
    bodyPs.forEach(p => {
        xmlPs.push(p);
        all(p, 'w', 'br').forEach(br => { if (attr(br, 'w', 'type') === 'page') xmlPs.push(p); });
    });
    tabState = { host, page, every, xmlPs, bodyPs };
    // docx-preview sets its own a moment after it renders; let it, then set them properly.
    await new Promise(r => setTimeout(r, 650));
    retab();
}
function closestTag(n, name) { for (let x = n.parentNode; x; x = x.parentNode) if (x.localName === name) return x; return null; }
function stopsOf(p, every) {
    const pPr = kid(p, 'w', 'pPr'), out = [];
    const tb = kid(pPr, 'w', 'tabs');
    kids(tb, 'w', 'tab').forEach(t => { if (attr(t, 'w', 'val') !== 'clear') out.push(num(attr(t, 'w', 'pos'), 0)); });
    const ind = kid(pPr, 'w', 'ind');
    if (ind && attr(ind, 'w', 'hanging')) out.push(num(attr(ind, 'w', 'left') || attr(ind, 'w', 'start'), 0));
    return { stops: out.sort((a, b) => a - b), every };
}
function retab() {
    const st = tabState; if (!st || !document.body.contains(st.host)) return;
    const domPs = [].slice.call(st.host.querySelectorAll('section.docx > article p'));
    // The editor names each paragraph (data-p: its place among the body's paragraphs, which a paragraph
    // the trainee adds with Enter inherits); without names, pair them up by count or leave docx-preview's.
    const named = domPs.length && domPs.every(p => p.dataset.p != null);
    if (!named && domPs.length !== st.xmlPs.length) return;
    domPs.forEach((p, i) => {
        const xp = named ? st.bodyPs[+p.dataset.p] : st.xmlPs[i]; if (!xp) return;
        const spans = p.querySelectorAll('.docx-tab-stop'); if (!spans.length) return;
        const sec = p.closest('section.docx'), sr = sec.getBoundingClientRect(), zoom = sr.width / sec.offsetWidth || 1;
        const marginLeft = st.page.left / EMU, { stops, every } = stopsOf(xp, st.every);
        spans.forEach(sp => {
            sp.style.wordSpacing = '0'; sp.style.display = 'inline-block'; sp.style.width = '0px';
            const x = ((sp.getBoundingClientRect().left - sr.left) / zoom - marginLeft) * 15;   // px → twips from the margin
            let next = stops.find(s => s > x + 1);
            if (next == null) next = (Math.floor(x / every) + 1) * every;
            sp.style.width = ((next - x) / 15) + 'px';
        });
    });
    clearFooters(st.host);
}

// Body text never runs under the office footer: where the letter is longer on screen than on paper
// (the browser's fonts are not quite Word's), the page grows instead.
function clearFooters(host) {
    host.querySelectorAll('section.docx').forEach(sec => {
        const art = sec.querySelector(':scope > article'), lh = sec.querySelector(':scope > .dr-lh');
        if (!art || !lh) return;
        const sr = sec.getBoundingClientRect(), zoom = sr.width / sec.offsetWidth || 1;
        const feet = [].filter.call(lh.children, d => d.style.bottom);
        if (!feet.length) return;
        const footTop = Math.min.apply(null, feet.map(d => d.getBoundingClientRect().top));
        const textBottom = art.getBoundingClientRect().bottom;
        const over = (textBottom - footTop) / zoom + 8;
        if (over > 0) sec.style.paddingBottom = (parseFloat(getComputedStyle(sec).paddingBottom) + over) + 'px';
    });
}
let retabTimer = null;
function retabSoon() { clearTimeout(retabTimer); retabTimer = setTimeout(retab, 120); }

window.LSHDraftingLetterhead = { draw, retab: retabSoon };
}());

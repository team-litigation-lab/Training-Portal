/* ============================================================
   ✍ Drafting (shared) — the letter in a Word-style editor
   The trainee edits the firm's letter the way they will in Word at the firm: the whole letter is
   theirs to change (not only the highlighted blanks), with Word's Home ribbon — Paste with Word's
   Paste Options, font, size, bold, italic, underline, strikethrough, font colour, the highlighter
   (No Color included), bullets, numbering, indents, line and paragraph spacing, alignment, clear
   formatting — Find & Replace, Insert › Symbol / Date, ¶ Show/Hide, zoom, a word count, Word's
   own keys (Ctrl+B/I/U, Ctrl+Z/Y, Ctrl+S, Tab, Shift+Enter), and Word's pages.

   The page is drawn from the .docx itself (docx-preview + drafting-letterhead.js), and what the
   trainee does on it goes back into that same .docx: every piece of text on screen knows the
   paragraph and the run it came from (drafting-docx.js markEditXml), and xml() writes the screen
   back run by run (applyEditsXml). Formatting is read off the screen as it is displayed, so what
   the trainee sees is what the download has — nothing more is added, nothing of the firm's is lost.

     LSHDraftingEditor.open({ host, ribbon, status, baseXml, bytes, onChange, onAction })
       host      the element the letter is drawn in
       baseXml   the letter's word/document.xml (the firm's, or the trainee's saved draft)
       bytes     the firm's .docx (ArrayBuffer): its letterhead, styles, fonts and media
       onChange  called (debounced) after every edit
       onAction  File menu / Review actions: 'download' | 'save' | 'reset' | 'template' | 'check'
     -> Promise<editor>   editor.xml() the letter as document.xml now · editor.stats() · editor.fonts()
   ============================================================ */
(function () {
'use strict';
const D = () => window.LSHDraftingDocx;
const FONTS = ['Arial', 'Arial Nova Light', 'Calibri', 'Cambria', 'Courier New', 'Garamond', 'Georgia', 'Helvetica Neue',
    'MS Gothic', 'Tahoma', 'Times New Roman', 'Verdana'];
const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36];
const COLORS = ['000000', '404040', '7F7F7F', 'C00000', 'FF0000', 'FFC000', 'FFFF00', '92D050', '00B050', '00B0F0', '0070C0', '002060', '7030A0', '0563C1'];
const HL = ['yellow', 'green', 'cyan', 'magenta', 'blue', 'red', 'darkBlue', 'darkCyan', 'darkGreen', 'darkMagenta', 'darkRed', 'darkYellow', 'darkGray', 'lightGray', 'black'];
const SYMBOLS = ['☒', '☐', '☑', '✓', '•', '–', '—', '§', '¶', '©', '®', '™', '½', '°', '…', '“', '”', '‘', '’'];
const TAB = () => { const s = document.createElement('span'); s.className = 'docx-tab-stop dr-wtab'; s.contentEditable = 'false'; s.innerHTML = '&emsp;'; return s; };
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- reading formatting off the screen ---------- */
function hex(c) {
    const m = String(c).match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
    if (!m) return '';
    if (m[4] != null && parseFloat(m[4]) === 0) return '';
    return [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('');
}
// The highlight is the nearest background on the text's own spans (a "No Color" on an inner span wins).
function highlightOf(el, p) {
    for (let x = el; x && x !== p && x.nodeType === 1; x = x.parentElement) {
        const bg = hex(getComputedStyle(x).backgroundColor);
        if (bg || (x.style && x.style.backgroundColor)) return bg;
    }
    return '';
}
function fmtOf(el) {
    // Word's superscript / subscript (w:vertAlign) is drawn as a <sup>/<sub> inside the run, which the
    // browser sets smaller: the run's own size is the one outside it.
    while (el.parentElement && /^(SUP|SUB)$/.test(el.tagName)) el = el.parentElement;
    const cs = getComputedStyle(el), p = el.closest('p') || el;
    let u = false, s = false;
    for (let x = el; x && x.nodeType === 1 && x.tagName !== 'ARTICLE'; x = x.parentElement) {
        const d = getComputedStyle(x).textDecorationLine || '';
        if (/underline/.test(d)) u = true;
        if (/line-through/.test(d)) s = true;
        if (x === p) break;
    }
    return { b: (parseInt(cs.fontWeight, 10) || 400) >= 600, i: /italic|oblique/.test(cs.fontStyle), u, s,
        color: hex(cs.color) || '000000', hl: el === p ? '' : highlightOf(el, p),
        font: (cs.fontFamily.split(',')[0] || '').replace(/["']/g, '').trim(), sz: Math.round(parseFloat(cs.fontSize) * 1.5) };
}
function diff(now, was) {
    const set = {};
    if (!was) return set;
    ['b', 'i', 'u', 's'].forEach(k => { if (now[k] !== was[k]) set[k] = now[k]; });
    if (now.color !== was.color) set.color = now.color;
    if (now.hl !== was.hl) set.hl = now.hl || 'none';
    if (now.font.toLowerCase() !== was.font.toLowerCase()) set.font = now.font;
    if (now.sz !== was.sz) set.sz = now.sz;
    return set;
}
const ALIGN = { left: 'left', start: 'left', center: 'center', '-webkit-center': 'center', right: 'right', end: 'right', justify: 'both' };

function open(opts) {
    const E = { host: opts.host, baseXml: opts.baseXml, bytes: opts.bytes, runFmt0: {}, pFmt0: {}, zoom: 1, fit: 1,
        undo: [], redo: [], lastSnap: 0, lastKind: '', marks: false, timer: null };
    const host = E.host;
    const arts = () => [].slice.call(host.querySelectorAll('section.docx > article')).filter(a => !a.closest('.dr-stage'));
    const paras = () => arts().reduce((a, art) => a.concat([].slice.call(art.querySelectorAll('p'))), []);

    /* ---------- drawing the letter ---------- */
    // One drawing at a time: a second waits for the first (two at once would each clear the other's page away).
    let drawing = Promise.resolve();
    function draw() {
        const run = drawing.then(drawNow, drawNow);
        drawing = run.catch(() => {});
        return run;
    }
    async function drawNow() {
        // while the letter is drawn again it can't be typed in: what was typed would be drawn over
        arts().forEach(a => { a.contentEditable = 'false'; });
        const stage = document.createElement('div');
        stage.className = 'dr-stage';
        stage.style.cssText = 'position:absolute;left:0;top:0;width:100%;visibility:hidden;pointer-events:none;';
        let zip;
        try {
            const marked = D().markEditXml(E.baseXml);
            zip = await D().pack(E.bytes, marked, 'arraybuffer');
            host.style.position = 'relative';
            host.appendChild(stage);
            await window.docx.renderAsync(zip, stage, stage, {
                className: 'docx', inWrapper: true, ignoreWidth: false, ignoreHeight: false, breakPages: true,
                renderHeaders: true, renderFooters: true, renderFootnotes: true, experimental: true, useBase64URL: true
            });
        } catch (e) {
            // the letter on screen stays as it was (and so does what the editor knows about it), and can be typed in again
            stage.remove();
            arts().forEach(a => { a.contentEditable = 'true'; });
            throw e;
        }
        E.runFmt0 = {}; E.pFmt0 = {};
        [].slice.call(host.childNodes).forEach(n => { if (n !== stage) host.removeChild(n); });
        stage.style.cssText = '';
        stage.classList.remove('dr-stage');
        host.classList.add('dr-docx', 'wd-doc');
        resolveMarkers(stage);
        markFormatting();
        wordLines(stage);
        if (window.LSHDraftingLetterhead) {
            try { await LSHDraftingLetterhead.draw(zip, stage); }
            catch (e) { if (window.console) console.warn('Drafting: the letterhead could not be drawn —', e && e.message); }
        }
        record();
        arts().forEach(art => {
            art.contentEditable = 'true';
            art.spellcheck = true;
            art.setAttribute('role', 'textbox');
            art.setAttribute('aria-multiline', 'true');
            art.setAttribute('aria-label', 'The letter');
            art.querySelectorAll('.docx-tab-stop').forEach(t => { t.contentEditable = 'false'; });
            art.querySelectorAll('img').forEach(i => { i.draggable = false; });
        });
        host.querySelectorAll('section.docx').forEach(s => { s.style.overflow = 'visible'; });
        fit();
        paginate();
    }
    // A paragraph command changes the paragraph's Word properties (a list, an indent, spacing): the letter is written
    // back to XML with the change, and drawn again from it, so the page shows exactly what Word will.
    async function rebase(x, sel) {
        const canvas = host.closest('.wd-canvas'), top = canvas ? canvas.scrollTop : 0, y = window.scrollY;
        const was = E.baseXml;
        E.baseXml = x;
        try { await draw(); }
        catch (e) {
            E.baseXml = was;
            say('That change couldn’t be drawn, so it wasn’t made. Try again.');
            if (window.console) console.warn('Drafting: redrawing the letter failed —', e && e.message);
            return false;
        }
        if (canvas) canvas.scrollTop = top;
        window.scrollTo(window.scrollX, y);
        if (sel) { const a = arts()[0]; if (a) a.focus({ preventScroll: true }); setSel(sel.s, sel.e); }
        return true;
    }
    // The bookmarks markEditXml put in: which paragraph, which run, which check box.
    function resolveMarkers(root) {
        root.querySelectorAll('[id^="_dr"]').forEach(m => {
            const id = m.id, p = m.closest('p');
            let x;
            if ((x = id.match(/^_drp(\d+)$/)) && p) p.dataset.p = x[1];
            else if ((x = id.match(/^_drq(\d+)$/)) && p) { p.dataset.p = x[1]; p.dataset.cont = '1'; }
            else if ((x = id.match(/^_drr(\d+)$/))) { const r = m.nextElementSibling; if (r) r.dataset.r = x[1]; }
            else if ((x = id.match(/^_drh_([\d_]+)$/))) {
                const a = m.nextElementSibling, ids = x[1].split('_');
                if (a) [].slice.call(a.children).filter(c => c.tagName === 'SPAN').forEach((s, i) => { if (ids[i] != null) s.dataset.r = ids[i]; });
            } else if ((x = id.match(/^_drc(\d+)_(on|off)$/))) {
                const c = document.createElement('span');
                c.className = 'dr-chk'; c.contentEditable = 'false'; c.dataset.chk = x[1];
                c.setAttribute('role', 'checkbox'); c.title = 'Check box — click to tick or untick it';
                setChk(c, x[2] === 'on');
                m.parentNode.insertBefore(c, m);
            }
            m.remove();
        });
    }
    function setChk(c, on) { c.dataset.on = on ? '1' : '0'; c.textContent = on ? '☒' : '☐'; c.setAttribute('aria-checked', on ? 'true' : 'false'); }
    // An empty paragraph shows what Word would type in it: the paragraph mark's own font and size.
    function markFormatting() {
        const doc = new DOMParser().parseFromString(E.baseXml, 'application/xml'), m = D().editMap(doc);
        const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
        const at = (el, name, a) => { const x = el && el.getElementsByTagNameNS(W, name)[0]; return x ? (x.getAttributeNS(W, a) || x.getAttribute('w:' + a)) : null; };
        host.querySelectorAll('p[data-p]').forEach(p => {
            const i = +p.dataset.p;
            if (m.pRuns[i] && m.pRuns[i].length) return;
            const pPr = m.ps[i] && m.ps[i].getElementsByTagNameNS(W, 'pPr')[0], rPr = pPr && [].find.call(pPr.childNodes, n => n.localName === 'rPr');
            if (!rPr) return;
            const font = at(rPr, 'rFonts', 'ascii') || at(rPr, 'rFonts', 'hAnsi'), sz = at(rPr, 'sz', 'val');
            if (font) p.style.fontFamily = `'${font}'`;
            if (sz) p.style.fontSize = (+sz / 2) + 'pt';
        });
    }
    /* Word's line spacing. "Single" (and 1.5, double…: w:spacing lineRule="auto") is a multiple of the FONT's own line
       height — about 1.15 × the size for Arial or Times New Roman — but docx-preview draws it as a multiple of the font
       size, so every line was short and a page held more than Word's. The browser's "normal" line height is the font's
       own (the same metrics Word uses), so each paragraph gets multiple × that. Exact spacing (lineRule="exact", drawn
       with a min-height) is left as it is. */
    const NORMAL = {};
    function normalOf(font) {
        if (NORMAL[font] == null) {
            const s = document.createElement('span');
            s.style.cssText = `position:absolute;visibility:hidden;font-family:'${font}';font-size:100px;line-height:normal;white-space:nowrap;`;
            s.textContent = 'Hxg';
            document.body.appendChild(s);
            NORMAL[font] = s.getBoundingClientRect().height / 100 || 1.15;
            s.remove();
        }
        return NORMAL[font];
    }
    function wordLines(root) {
        root.querySelectorAll('section.docx > article p').forEach(p => {
            const cs = getComputedStyle(p);
            if (cs.lineHeight === 'normal') return;
            const L = parseFloat(cs.lineHeight), F = parseFloat(cs.fontSize);
            if (!L || !F || /pt$/.test(p.style.lineHeight) || (parseFloat(cs.minHeight) && Math.abs(parseFloat(cs.minHeight) - L) < 0.5)) return;
            const run = p.querySelector('[data-r]') || p;
            const font = (getComputedStyle(run).fontFamily.split(',')[0] || '').replace(/["']/g, '').trim();
            p.style.lineHeight = ((L / F) * normalOf(font)).toFixed(3);
        });
    }
    // How each run and each paragraph looked when drawn: an edit is whatever differs from this.
    function record() {
        host.querySelectorAll('[data-r]').forEach(s => { E.runFmt0[s.dataset.r] = fmtOf(s); });
        host.querySelectorAll('p[data-p]').forEach(p => {
            if (!E.pFmt0[p.dataset.p]) E.pFmt0[p.dataset.p] = fmtOf(p);
            p.dataset.a0 = ALIGN[getComputedStyle(p).textAlign] || 'left';
        });
    }

    /* ---------- the screen, back into the .docx ---------- */
    // cmd: { targets: Set of <p>, ppr } — a paragraph command for those paragraphs (see drafting-docx.js paragraphProps).
    function edit(cmd) {
        const out = { paras: [], checks: {} };
        unzoomed(() => {
            let prev = null;
            arts().forEach(art => {
                [].forEach.call(art.querySelectorAll('p'), (p, n) => {
                    const pi = p.dataset.p != null ? +p.dataset.p : null;
                    const pieces = [];
                    let lastR = null;
                    const push = (text, el, isTab) => {
                        const rEl = el.closest('[data-r]'), mine = rEl && p.contains(rEl);
                        const r = mine ? +rEl.dataset.r : lastR;
                        if (mine) lastR = r;
                        const was = r != null ? E.runFmt0[r] : (pi != null ? E.pFmt0[pi] : null);
                        const set = isTab ? {} : diff(fmtOf(el), was || fmtOf(p));
                        pieces.push({ r, own: !!mine, text, set, br: text === '\n' });
                    };
                    (function walk(node) {
                        [].forEach.call(node.childNodes, c => {
                            if (c.nodeType === 3) { const v = c.nodeValue.replace(/\u00a0/g, ' ').replace(/\u200b/g, ''); if (v) push(v, c.parentElement); return; }
                            if (c.nodeType !== 1) return;
                            if (c.classList.contains('docx-tab-stop')) return push('\t', c, true);
                            if (c.classList.contains('dr-chk')) { out.checks[c.dataset.chk] = c.dataset.on === '1'; return; }
                            if (c.tagName === 'BR') return push('\n', c.parentElement === p ? p : c.parentElement);
                            if (/^(IMG|SVG|svg)$/.test(c.tagName) || c.classList.contains('dr-lh') || c.classList.contains('dr-pgsp') || c.contentEditable === 'false') return;
                            walk(c);
                        });
                    }(p));
                    // the browser's own <br> that keeps an empty line open is not a line break the trainee typed
                    if (pieces.length && pieces[pieces.length - 1].br) pieces.pop();
                    const segs = [];
                    pieces.forEach(x => {
                        const s = segs[segs.length - 1];
                        if (s && s.r === x.r && s.own === x.own && JSON.stringify(s.set) === JSON.stringify(x.set)) s.text += x.text;
                        else segs.push({ r: x.r, own: x.own, text: x.text, set: x.set });
                    });
                    const a = ALIGN[getComputedStyle(p).textAlign] || 'left';
                    const cont = p.dataset.cont === '1' && n === 0 && prev && prev.p === pi;
                    const pe = { p: pi, cont: !!cont, align: a !== (p.dataset.a0 || 'left') ? a : null, segs };
                    if (cmd && cmd.targets && cmd.targets.has(p)) pe.ppr = cmd.ppr;
                    else if (p.dataset.pl) pe.ppr = { list: p.dataset.pl };       // pasted as a list item
                    out.paras.push(pe);
                    prev = pe;
                });
            });
        });
        return out;
    }
    function unzoomed(fn) {
        const wrap = host.querySelector('.docx-wrapper'), z = wrap && wrap.style.zoom;
        if (wrap) wrap.style.zoom = '';
        try { return fn(); } finally { if (wrap) wrap.style.zoom = z; }
    }
    const xml = () => D().applyEditsXml(E.baseXml, edit());

    /* ---------- the selection, as character offsets (survives re-wrapping the text) ---------- */
    function texts() {
        const out = [];
        arts().forEach(art => {
            const w = document.createTreeWalker(art, NodeFilter.SHOW_TEXT);
            while (w.nextNode()) out.push(w.currentNode);
        });
        return out;
    }
    function selOffsets() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return null;
        const r = sel.getRangeAt(0);
        if (!arts().some(a => a.contains(r.startContainer))) return null;
        const at = (node, off) => {
            let n = 0;
            for (const t of texts()) {
                if (t === node) return n + off;
                const pre = document.createRange(); pre.setStart(node, off); pre.collapse(true);
                if (pre.comparePoint(t, 0) > 0) return n;
                n += t.nodeValue.length;
            }
            return n;
        };
        return { s: at(r.startContainer, r.startOffset), e: at(r.endContainer, r.endOffset) };
    }
    function setSel(s, e) {
        let n = 0, sn = null, so = 0, en = null, eo = 0;
        for (const t of texts()) {
            const L = t.nodeValue.length;
            if (!sn && (s < n + L || (s === n + L && s === e && L))) { sn = t; so = s - n; }
            if (!en && e <= n + L) { en = t; eo = e - n; break; }
            n += L;
        }
        if (!sn) return;
        const r = document.createRange();
        r.setStart(sn, so); r.setEnd(en || sn, en ? eo : so);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }

    /* ---------- undo / redo (Word's Ctrl+Z / Ctrl+Y), the letter as it was ----------
       Kept as copies of the page's nodes, not as HTML: docx-preview puts a floating picture's <div> inside
       its <p>, which an HTML round trip would split into two paragraphs. */
    const copy = () => arts().map(a => [].map.call(a.childNodes, n => n.cloneNode(true)));
    function snap(kind) {
        const now = Date.now();
        if (kind === 'typing' && E.lastKind === 'typing' && now - E.lastSnap < 1200) { E.lastSnap = now; return; }
        E.undo.push({ base: E.baseXml, nodes: copy(), sel: selOffsets() });
        if (E.undo.length > 150) E.undo.shift();
        E.redo = []; E.lastSnap = now; E.lastKind = kind;
    }
    // A copy made before a paragraph command belongs to the letter as it was drawn then: that is drawn again first.
    async function restore(from, to) {
        await drawing;
        const s = from.pop(); if (!s) return;
        to.push({ base: E.baseXml, nodes: copy(), sel: selOffsets() });
        if (s.base !== E.baseXml) {
            const was = E.baseXml;
            E.baseXml = s.base;
            try { await draw(); }
            catch (e) { E.baseXml = was; from.push(s); to.pop(); say('Undo couldn’t be drawn. Try again.'); return; }
        }
        arts().forEach((a, i) => { if (s.nodes[i]) a.replaceChildren(...[].map.call(s.nodes[i], n => n.cloneNode(true))); });
        if (s.sel) setSel(s.sel.s, s.sel.e);
        E.lastKind = '';
        changed();
    }

    /* ---------- Word's formatting commands, on the selected text ----------
       Each selected piece of text is given a span of its own (split off the run it is in, with the
       run's attributes, so it still knows where it came from), and the format is set on that span. */
    function selectedTexts(expandWord) {
        const o = selOffsets(); if (!o) return null;
        if (o.s === o.e && expandWord) {                     // Word: with no selection, the word the cursor is in
            const all = texts().map(t => t.nodeValue).join('');
            let s = o.s, e = o.e;
            while (s > 0 && /[\w’'-]/.test(all[s - 1])) s--;
            while (e < all.length && /[\w’'-]/.test(all[e])) e++;
            o.s = s; o.e = e;
        }
        if (o.s === o.e) return { o, nodes: [] };
        let n = 0;
        const hit = [];
        texts().forEach(t => {
            const L = t.nodeValue.length, a = n, b = n + L; n = b;
            if (b <= o.s || a >= o.e || t.parentElement.closest('.docx-tab-stop, .dr-chk')) return;
            let node = t;
            if (o.s > a) node = node.splitText(o.s - a);
            if (o.e < b) node.splitText(o.e - Math.max(a, o.s));
            hit.push(node);
        });
        return { o, nodes: hit };
    }
    function isolate(t) {
        const p = t.parentElement.closest('p'); if (!p) return null;
        let top = t;
        while (top.parentElement !== p) top = top.parentElement;
        if (top.nodeType === 3) { const s = document.createElement('span'); p.insertBefore(s, top); s.appendChild(top); return s; }
        const cut = (setup) => {
            const r = document.createRange(); setup(r);
            if (r.collapsed || !r.toString()) return null;
            return r.extractContents();
        };
        const before = cut(r => { r.setStart(top, 0); r.setEndBefore(t); });
        if (before) p.insertBefore(before, top);
        const after = cut(r => { r.setStartAfter(t); r.setEnd(top, top.childNodes.length); });
        if (after) p.insertBefore(after, top.nextSibling);
        return top;
    }
    const STYLE_PROPS = ['fontWeight', 'fontStyle', 'textDecoration', 'textDecorationLine', 'color', 'backgroundColor', 'fontFamily', 'fontSize'];
    function format(apply, opts) {
        opts = opts || {};
        const got = selectedTexts(true); if (!got || !got.nodes.length) return;
        snap('format');
        unzoomed(() => formatNodes(got, apply, opts));
        setSel(got.o.s, got.o.e);
        changed(); state();
    }
    function formatNodes(got, apply, opts) {
        const before = got.nodes.map(t => fmtOf(t.parentElement));
        const tops = got.nodes.map(isolate).filter(Boolean);
        tops.forEach((top, i) => {
            top.querySelectorAll('*').forEach(d => { if (d.style) (opts.props || []).forEach(k => { d.style[k] = ''; }); });
            apply(top, before[i], before);
        });
    }
    function selectedParas() {
        const sel = window.getSelection(); if (!sel.rangeCount) return [];
        const r = sel.getRangeAt(0);
        if (!arts().some(a => a.contains(r.startContainer))) return [];
        return paras().filter(p => r.intersectsNode(p));
    }
    async function paraCmd(ppr) {
        await drawing;
        const ps = selectedParas(); if (!ps.length) return;
        const sel = selOffsets();
        snap('para');
        if (!await rebase(D().applyEditsXml(E.baseXml, edit({ targets: new Set(ps), ppr })), sel)) { E.undo.pop(); return; }   // nothing was made: nothing to undo
        E.lastKind = '';
        changed(); state();
    }
    const deco = (top, f, u, s) => { top.style.textDecorationLine = [u ? 'underline' : '', s ? 'line-through' : ''].join(' ').trim() || 'none'; };
    const CMD = {
        bold() { format((top, f, all) => { top.style.fontWeight = all.every(x => x.b) ? '400' : '700'; }, { props: ['fontWeight'] }); },
        italic() { format((top, f, all) => { top.style.fontStyle = all.every(x => x.i) ? 'normal' : 'italic'; }, { props: ['fontStyle'] }); },
        underline() { format((top, f, all) => deco(top, f, !all.every(x => x.u), f.s), { props: ['textDecoration', 'textDecorationLine'] }); },
        strike() { format((top, f, all) => deco(top, f, f.u, !all.every(x => x.s)), { props: ['textDecoration', 'textDecorationLine'] }); },
        color(c) { format(top => { top.style.color = '#' + c; }, { props: ['color'] }); },
        highlight(name) {
            const c = name === 'none' ? 'transparent' : '#' + D().HIGHLIGHTS[name];
            format(top => { top.style.backgroundColor = c; }, { props: ['backgroundColor'] });
        },
        font(name) { format(top => { top.style.fontFamily = `'${name}'`; }, { props: ['fontFamily'] }); },
        size(pt) { format(top => { top.style.fontSize = pt + 'pt'; }, { props: ['fontSize'] }); },
        // Word's Clear All Formatting: back to the paragraph's style — no run formatting at all
        clear() {
            format(top => {
                STYLE_PROPS.forEach(k => { top.style[k] = ''; });
                const f = fmtOf(top.closest('p'));
                top.style.fontWeight = f.b ? '700' : '400'; top.style.fontStyle = f.i ? 'italic' : 'normal';
                top.style.textDecorationLine = 'none'; top.style.backgroundColor = 'transparent';
                top.style.color = '#' + f.color; top.style.fontFamily = `'${f.font}'`; top.style.fontSize = (f.sz / 2) + 'pt';
            }, { props: STYLE_PROPS });
        },
        align(a) {
            const sel = window.getSelection(); if (!sel.rangeCount) return;
            const r = sel.getRangeAt(0), ps = paras().filter(p => r.intersectsNode(p));
            if (!ps.length) return;
            snap('format');
            ps.forEach(p => { p.style.textAlign = a === 'both' ? 'justify' : a; });
            changed(); state();
        },
        insertText(txt) {
            if (!selOffsets()) return;
            snap('insert');
            document.execCommand('insertText', false, txt);
            changed();
        },
        tab(quiet) {
            const sel = window.getSelection(); if (!sel.rangeCount || !selOffsets()) return;
            if (!quiet) snap('insert');
            const r = sel.getRangeAt(0); r.deleteContents();
            const t = TAB(); r.insertNode(t);
            const after = document.createTextNode('\u200b');                // somewhere for the cursor to go
            t.parentNode.insertBefore(after, t.nextSibling);
            const c = document.createRange(); c.setStart(after, 1); c.collapse(true);
            sel.removeAllRanges(); sel.addRange(c);
            if (!quiet) changed();
        },
        date() {
            CMD.insertText(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
        },
        list(kind) { paraCmd({ list: kind, toggle: true }); },
        indent(d) { paraCmd({ indent: d }); },
        line(v) { paraCmd({ line: v }); },
        // Word's "Add Space Before Paragraph" / "Remove Space After Paragraph": which one depends on what is there now
        space(side) {
            const ps = selectedParas(); if (!ps.length) return;
            const now = parseFloat(getComputedStyle(ps[0])[side === 'before' ? 'marginTop' : 'marginBottom']) || 0;
            paraCmd(side === 'before' ? { before: now > 0.5 ? 0 : 240 } : { after: now > 0.5 ? 0 : 240 });
        },
        undo() { restore(E.undo, E.redo); },
        redo() { restore(E.redo, E.undo); },
        marks() { E.marks = !E.marks; host.classList.toggle('dr-marks', E.marks); spaces(); state(); },
        zoom(dz) { E.zoom = dz === 0 ? 1 : Math.max(0.5, Math.min(2, Math.round((E.zoom + dz) * 10) / 10)); fit(); },
        find() { const f = opts.ribbon && opts.ribbon.querySelector('[data-find]'); if (f) { showTab('home'); f.focus(); f.select(); } },
        findNext(back) {
            const q = valOf('[data-find]'); if (!q) return false;
            const all = texts().map(t => t.nodeValue).join('').toLowerCase(), o = selOffsets() || { s: 0, e: 0 };
            let i = back ? all.lastIndexOf(q.toLowerCase(), o.s - 1) : all.indexOf(q.toLowerCase(), o.e);
            if (i < 0) i = back ? all.lastIndexOf(q.toLowerCase()) : all.indexOf(q.toLowerCase());
            if (i < 0) { say(`“${q}” isn't in the letter.`); return false; }
            arts()[0].focus({ preventScroll: true });
            setSel(i, i + q.length);
            E.lastKind = '';
            const sel = window.getSelection(); if (sel.rangeCount) { const b = sel.getRangeAt(0).getBoundingClientRect(); if (b.top < 80 || b.bottom > innerHeight - 40) window.scrollBy(0, b.top - innerHeight / 3); }
            return true;
        },
        replace() {
            const q = valOf('[data-find]'), w = valOf('[data-repl]');
            const sel = window.getSelection();
            if (q && sel.rangeCount && sel.toString().toLowerCase() === q.toLowerCase()) { CMD.insertText(w); }
            CMD.findNext();
        },
        replaceAll() {
            const q = valOf('[data-find]'), w = valOf('[data-repl]'); if (!q) return;
            const all = texts().map(t => t.nodeValue).join('').toLowerCase(), at = [];
            for (let i = all.indexOf(q.toLowerCase()); i >= 0; i = all.indexOf(q.toLowerCase(), i + q.length)) at.push(i);
            if (!at.length) { say(`“${q}” isn't in the letter.`); return; }
            snap('replace');
            arts()[0].focus({ preventScroll: true });
            at.reverse().forEach(i => { setSel(i, i + q.length); document.execCommand('insertText', false, w); });
            E.lastKind = 'replace';
            say(`Replaced ${at.length} time${at.length === 1 ? '' : 's'}.`);
            changed();
        }
    };
    const valOf = (sel) => { const el = opts.ribbon && opts.ribbon.querySelector(sel); return el ? el.value : ''; };
    function say(msg) { const s = opts.status && opts.status.querySelector('[data-say]'); if (s) { s.textContent = msg; clearTimeout(say.t); say.t = setTimeout(() => { s.textContent = ''; }, 4000); } }

    /* ---------- typing, the Word way ---------- */
    function changed() {
        if (window.LSHDraftingLetterhead) LSHDraftingLetterhead.retab();
        clearTimeout(E.pg); E.pg = setTimeout(paginate, 380);
        clearTimeout(E.timer);
        E.timer = setTimeout(() => { if (opts.onChange) opts.onChange(); stats(); if (E.marks) spaces(); }, 700);
        mark('Saving…');
    }
    function mark(txt) { const s = opts.status && opts.status.querySelector('[data-state]'); if (s) s.textContent = txt; const t = opts.title && opts.title.querySelector('[data-state]'); if (t) t.textContent = txt; }
    host.addEventListener('beforeinput', (e) => {
        if (!e.target.closest || !e.target.closest('article')) return;
        if (e.inputType === 'historyUndo') { e.preventDefault(); CMD.undo(); return; }
        if (e.inputType === 'historyRedo') { e.preventDefault(); CMD.redo(); return; }
        if (e.inputType === 'insertFromDrop' || e.inputType === 'formatBold' || e.inputType === 'formatItalic' || e.inputType === 'formatUnderline') { e.preventDefault(); return; }
        snap(/^insertText|^deleteContent/.test(e.inputType) ? 'typing' : e.inputType);
    });
    host.addEventListener('input', (e) => { if (e.target.closest && e.target.closest('article')) changed(); });
    host.addEventListener('keydown', (e) => {
        if (!e.target.closest || !e.target.closest('article')) return;
        const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
        if (E.chip && !/^(Control|Meta|Shift|Alt)$/.test(e.key)) hideChip();
        if (mod && k === 'v') { E.plainNext = e.shiftKey; return; }
        if (mod && !e.altKey) {
            const map = { b: 'bold', i: 'italic', u: 'underline', z: e.shiftKey ? 'redo' : 'undo', y: 'redo', f: 'find', h: 'find' };
            if (map[k]) { e.preventDefault(); CMD[map[k]](); return; }
            if (k === 's') { e.preventDefault(); if (opts.onAction) opts.onAction('save'); return; }
            if (k === 'e' || k === 'l' || k === 'r' || k === 'j') { e.preventDefault(); CMD.align({ e: 'center', l: 'left', r: 'right', j: 'both' }[k]); return; }
        }
        if (e.key === 'Tab' && !mod) {
            e.preventDefault();
            const ps = selectedParas(), sel = window.getSelection();
            const item = ps.length === 1 && /-num-/.test(ps[0].className) && atStartOf(ps[0], sel);
            if (item || (ps.length > 1)) { CMD.indent(e.shiftKey ? -1 : 1); return; }   // a list level, or several paragraphs
            if (!e.shiftKey) CMD.tab();
            return;
        }
        if (/^(Arrow|Home|End|Page)/.test(e.key)) E.lastKind = '';         // moving the cursor ends an undo step, as in Word
    });
    host.addEventListener('mousedown', () => { E.lastKind = ''; });
    function atStartOf(p, sel) {
        if (!sel.rangeCount || !sel.isCollapsed) return false;
        const r = document.createRange(); r.selectNodeContents(p); r.setEnd(sel.anchorNode, sel.anchorOffset);
        return !r.toString().replace(/\u200b/g, '').length;
    }
    /* ---------- Paste, with Word's Paste Options ----------
       Ctrl+V keeps the source formatting, as Word does by default; the Paste Options button that shows up after a paste
       (and Home › Paste ▾) switches it to Merge Formatting (the letter's formatting, with the source's bold, italic and
       underline) or Keep Text Only. Ctrl+Shift+V pastes text only. A pasted list comes in as a Word list. What was pasted
       is then the letter's like anything typed: a font the template doesn't use is what Check my letter will find. */
    const PASTE_MODES = { keep: 'Keep Source Formatting', merge: 'Merge Formatting', text: 'Keep Text Only' };
    const BLOCK = /^(P|DIV|LI|H[1-6]|TR|BLOCKQUOTE|PRE|DT|DD|CAPTION)$/;
    function clipStyle(el, st) {
        const o = Object.assign({}, st), t = el.tagName, css = el.style, raw = el.getAttribute('style') || '';
        if (/^(B|STRONG)$/.test(t)) o.b = true;
        if (/^(I|EM)$/.test(t)) o.i = true;
        if (t === 'U' || t === 'INS') o.u = true;
        if (/^(S|STRIKE|DEL)$/.test(t)) o.s = true;
        if (t === 'FONT') { if (el.getAttribute('face')) o.font = el.getAttribute('face').split(',')[0].replace(/["']/g, '').trim(); if (el.getAttribute('color')) o.color = el.getAttribute('color'); }
        if (css) {
            if (css.fontWeight) o.b = css.fontWeight === 'bold' || css.fontWeight === 'bolder' || parseInt(css.fontWeight, 10) >= 600;
            if (css.fontStyle) o.i = /italic|oblique/.test(css.fontStyle);
            const d = css.textDecorationLine || css.textDecoration || '';
            if (d) { o.u = /underline/.test(d); o.s = /line-through/.test(d); }
            if (css.color && css.color !== 'inherit') o.color = css.color;
            const bg = css.backgroundColor || '';
            if (bg && !/transparent|inherit|initial/.test(bg)) o.bg = bg;
            const hl = raw.match(/mso-highlight:\s*([a-z]+)/i); if (hl) o.bg = hl[1];
            if (css.fontFamily && css.fontFamily !== 'inherit') o.font = css.fontFamily.split(',')[0].replace(/["']/g, '').trim();
            const fs = css.fontSize.match(/^([\d.]+)(pt|px)$/);
            if (fs) o.pt = fs[2] === 'pt' ? +fs[1] : Math.round(+fs[1] * 0.75 * 2) / 2;
        }
        return o;
    }
    // The clipboard as lines (paragraphs) of runs: { list, runs: [{ text, st }] }.
    function readClip(html, text) {
        const lines = [];
        if (html) {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            let cur = null;
            const line = (list) => { cur = { list: list || null, runs: [], marker: '' }; lines.push(cur); };
            const add = (txt, st) => { if (!cur) line(); cur.runs.push({ text: txt, st }); };
            (function walk(node, st) {
                [].forEach.call(node.childNodes, c => {
                    if (c.nodeType === 3) { const v = c.nodeValue.replace(/[ \t\r\n]+/g, ' '); if (v) add(v, st); return; }
                    if (c.nodeType !== 1 || /^(STYLE|SCRIPT|HEAD|META|TITLE|LINK|XML|TEMPLATE)$/.test(c.tagName)) return;
                    const raw = c.getAttribute('style') || '';
                    if (/mso-list:\s*Ignore/i.test(raw)) { if (cur) cur.marker += c.textContent; return; }   // Word's own bullet or number, as text
                    if (c.tagName === 'BR') { add('\n', st); return; }
                    const st2 = clipStyle(c, st);
                    if (BLOCK.test(c.tagName)) {
                        const list = c.tagName === 'LI' ? (c.parentElement && c.parentElement.tagName === 'OL' ? 'number' : 'bullet') : /mso-list:/i.test(raw) ? 'auto' : null;
                        line(list); walk(c, st2); cur = null;
                        return;
                    }
                    walk(c, st2);
                    if (/^(TD|TH)$/.test(c.tagName) && c.nextElementSibling) add('\t', st);
                });
            }(doc.body, {}));
        } else {
            String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach(l => lines.push({ list: null, runs: l ? [{ text: l, st: {} }] : [] }));
        }
        lines.forEach(l => {
            if (l.list === 'auto') l.list = /^\s*([0-9]+|[a-z]|[ivxlc]+)[.)]/i.test(l.marker) ? 'number' : 'bullet';
            if (html) {                                       // HTML spacing: no space at the start or end of a paragraph
                if (l.runs.length) { l.runs[0].text = l.runs[0].text.replace(/^ +/, ''); const z = l.runs[l.runs.length - 1]; z.text = z.text.replace(/ +$/, ''); }
                l.runs = l.runs.filter(r => r.text);
                if (l.runs.every(r => !r.text.replace(/[\s ]/g, ''))) l.runs = [];
            }
        });
        while (lines.length && !lines[0].runs.length) lines.shift();
        while (lines.length > 1 && !lines[lines.length - 1].runs.length) lines.pop();
        return lines;
    }
    function caretP() {
        const sel = window.getSelection(); if (!sel.rangeCount) return null;
        const n = sel.anchorNode, el = n && (n.nodeType === 1 ? n : n.parentElement);
        return el ? el.closest('p') : null;
    }
    function putText(txt, st, mode) {
        if (mode === 'text' || !st || !Object.keys(st).length) { document.execCommand('insertText', false, txt); return; }
        const sel = window.getSelection(); if (!sel.rangeCount) return;
        const span = document.createElement('span');
        if (st.b != null) span.style.fontWeight = st.b ? '700' : '400';
        if (st.i != null) span.style.fontStyle = st.i ? 'italic' : 'normal';
        if (st.u != null || st.s != null) span.style.textDecorationLine = [st.u ? 'underline' : '', st.s ? 'line-through' : ''].join(' ').trim() || 'none';
        if (mode === 'keep') {
            if (st.color) span.style.color = st.color;
            if (st.bg) span.style.backgroundColor = st.bg;
            if (st.font) span.style.fontFamily = `'${st.font}'`;
            if (st.pt) span.style.fontSize = st.pt + 'pt';
        }
        span.textContent = txt;
        const r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(span);
        const c = document.createRange(); c.setStartAfter(span); c.collapse(true);
        sel.removeAllRanges(); sel.addRange(c);
    }
    async function pasteClip(clip, mode) {
        const sel = window.getSelection(); if (!sel.rangeCount || !selOffsets()) return;
        snap('paste');
        E.lastPaste = { clip, at: E.undo.length, mode };
        if (!sel.isCollapsed) document.execCommand('delete');
        let lists = 0;
        clip.forEach((l, i) => {
            if (i) document.execCommand('insertParagraph');
            l.runs.forEach(run => run.text.split('\n').forEach((part, j) => {
                if (j) document.execCommand('insertLineBreak');
                part.split('\t').forEach((seg, k) => { if (k) CMD.tab(true); if (seg) putText(seg, run.st, mode); });
            }));
            const p = caretP();
            if (p) { if (l.list && mode !== 'text') { p.dataset.pl = l.list; lists++; } else delete p.dataset.pl; }
        });
        // a pasted list is a Word list: drawn again from the XML, like the Bullets and Numbering buttons
        if (lists) { const at = selOffsets(); await rebase(D().applyEditsXml(E.baseXml, edit()), at); }
        E.lastKind = '';
        changed();
        pasteChip();
    }
    async function repaste(mode) {
        const lp = E.lastPaste; if (!lp || E.undo.length !== lp.at) return;
        await restore(E.undo, E.redo);
        E.redo = [];
        await pasteClip(lp.clip, mode);
    }
    // Word's Paste Options button, beside what was pasted.
    function pasteChip() {
        hideChip();
        const sel = window.getSelection(); if (!sel.rangeCount) return;
        let r = sel.getRangeAt(0).getBoundingClientRect();
        if (!r.height) { const p = caretP(); if (p) r = p.getBoundingClientRect(); }
        const chip = document.createElement('div');
        chip.className = 'wd-paste'; chip.setAttribute('role', 'group'); chip.setAttribute('aria-label', 'Paste Options');
        chip.innerHTML = `<span class="wd-paste-t">📋 Paste Options:</span>` + Object.keys(PASTE_MODES).map(m =>
            `<button type="button" data-paste="${m}" class="${E.lastPaste && E.lastPaste.mode === m ? 'on' : ''}" title="${PASTE_MODES[m]}">${PASTE_MODES[m]}</button>`).join('');
        chip.style.left = Math.max(8, Math.min(innerWidth - 470, r.left)) + 'px';
        chip.style.top = Math.min(innerHeight - 40, r.bottom + 6) + 'px';
        chip.addEventListener('mousedown', (e) => e.preventDefault());
        chip.addEventListener('click', (e) => { const b = e.target.closest('[data-paste]'); if (b) repaste(b.dataset.paste); });
        document.body.appendChild(chip);
        E.chip = chip;
    }
    function hideChip() { if (E.chip) { E.chip.remove(); E.chip = null; } }
    host.addEventListener('paste', (e) => {
        if (!e.target.closest || !e.target.closest('article')) return;
        e.preventDefault();
        const cd = e.clipboardData || window.clipboardData;
        const mode = E.plainNext ? 'text' : (E.pasteMode || 'keep');
        E.plainNext = false;
        pasteClip(readClip(mode === 'text' ? '' : cd.getData('text/html'), cd.getData('text/plain') || cd.getData('text')), mode);
    });
    // Home › Paste ▾, from the clipboard (the browser may ask first)
    async function pasteFromRibbon(mode) {
        try {
            let html = '', text = '';
            if (navigator.clipboard && navigator.clipboard.read) {
                for (const item of await navigator.clipboard.read()) {
                    if (item.types.indexOf('text/html') >= 0) html = await (await item.getType('text/html')).text();
                    if (item.types.indexOf('text/plain') >= 0) text = await (await item.getType('text/plain')).text();
                }
            } else text = await navigator.clipboard.readText();
            arts()[0].focus({ preventScroll: true });
            if (E.ribbonSel) setSel(E.ribbonSel.s, E.ribbonSel.e);
            await pasteClip(readClip(mode === 'text' ? '' : html, text), mode);
        } catch (err) { say('This browser won’t let the page read the clipboard: press Ctrl+V (Ctrl+Shift+V for text only).'); }
    }
    host.addEventListener('drop', (e) => { e.preventDefault(); });
    document.addEventListener('mousedown', (e) => { if (E.chip && !E.chip.contains(e.target)) hideChip(); });
    // A check box in the letter ticks the way it does in Word (a legacy form check box, or ☐ / ☒ typed in).
    host.addEventListener('click', (e) => {
        const c = e.target.closest && e.target.closest('.dr-chk');
        if (c && host.contains(c)) { snap('check'); setChk(c, c.dataset.on !== '1'); changed(); }
    });
    host.addEventListener('dblclick', (e) => {
        const pos = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
        if (!pos || pos.startContainer.nodeType !== 3) return;
        const t = pos.startContainer, v = t.nodeValue;
        for (const i of [pos.startOffset, pos.startOffset - 1]) {
            if (v[i] === '☐' || v[i] === '☒') {
                e.preventDefault();
                snap('check');
                t.nodeValue = v.slice(0, i) + (v[i] === '☐' ? '☒' : '☐') + v.slice(i + 1);
                changed();
                return;
            }
        }
    });
    document.addEventListener('selectionchange', () => { clearTimeout(E.st); E.st = setTimeout(() => { state(); stats(); }, 60); });

    /* ---------- the ribbon ---------- */
    let tab = 'home';
    function ribbonHtml() {
        const btn = (cmd, label, title, extra) => `<button type="button" class="wd-b" data-cmd="${cmd}" title="${esc(title)}" aria-label="${esc(title)}" ${extra || ''}>${label}</button>`;
        const group = (name, body) => `<div class="wd-g"><div class="wd-gb">${body}</div><div class="wd-gn">${name}</div></div>`;
        return `
        <div class="wd-tabs" role="tablist">
            <button type="button" class="wd-t wd-file" data-tab="file">File</button>
            ${['home', 'insert', 'review', 'view'].map(t => `<button type="button" class="wd-t ${t === tab ? 'on' : ''}" data-tab="${t}" role="tab">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
        </div>
        <div class="wd-menu" data-menu="file" hidden>
            <button type="button" data-act="save">💾 Save <kbd>Ctrl+S</kbd></button>
            <button type="button" data-act="download">⬇ Download as Word (.docx)</button>
            <button type="button" data-act="template">⬇ The firm's blank template</button>
            <button type="button" data-act="reset">↺ Start over from the firm's template</button>
        </div>
        <div class="wd-rib" data-pane="home" ${tab === 'home' ? '' : 'hidden'}>
            ${group('Clipboard', `<div class="wd-row"><span class="wd-split">${btn('paste', '<span class="wd-big">📋</span>Paste', 'Paste (Ctrl+V) — Keep Source Formatting', 'class="wd-b wd-tall"')}${btn('menu-paste', '▾', 'Paste Options', 'data-open="paste"')}</span>
                <div class="wd-col">${btn('cut', '✂ Cut', 'Cut (Ctrl+X)')}${btn('copy', '⧉ Copy', 'Copy (Ctrl+C)')}</div></div>`)}
            ${group('Undo', btn('undo', '↶', 'Undo (Ctrl+Z)') + btn('redo', '↷', 'Redo (Ctrl+Y)'))}
            ${group('Font', `<div class="wd-row">
                    <select class="wd-sel wd-font" data-font title="Font" aria-label="Font">${FONTS.map(f => `<option style="font-family:'${f}'">${f}</option>`).join('')}</select>
                    <select class="wd-sel wd-size" data-size title="Font Size" aria-label="Font Size">${SIZES.map(s => `<option>${s}</option>`).join('')}</select>
                    ${btn('clear', '<span class="wd-clear">A</span>', 'Clear All Formatting')}
                </div><div class="wd-row">
                    ${btn('bold', '<b>B</b>', 'Bold (Ctrl+B)')}${btn('italic', '<i style="font-family:serif">I</i>', 'Italic (Ctrl+I)')}${btn('underline', '<u>U</u>', 'Underline (Ctrl+U)')}${btn('strike', '<s>ab</s>', 'Strikethrough')}
                    <span class="wd-split">${btn('highlight-last', '<span class="wd-hl">ab</span>', 'Text Highlight Color')}${btn('menu-hl', '▾', 'Highlight colours', 'data-open="hl"')}</span>
                    <span class="wd-split">${btn('color-last', '<span class="wd-fc">A</span>', 'Font Color')}${btn('menu-fc', '▾', 'Font colours', 'data-open="fc"')}</span>
                </div>`)}
            ${group('Paragraph', `<div class="wd-row">
                    ${btn('list:bullet', '<span class="wd-ls">•≡</span>', 'Bullets')}${btn('list:number', '<span class="wd-ls">1≡</span>', 'Numbering')}${btn('indent:-1', '<span class="wd-ls">⇤≡</span>', 'Decrease Indent')}${btn('indent:1', '<span class="wd-ls">⇥≡</span>', 'Increase Indent')}
                    <span class="wd-split">${btn('menu-ls', '<span class="wd-ls">↕≡</span> ▾', 'Line and Paragraph Spacing', 'data-open="ls"')}</span>
                </div><div class="wd-row">
                    ${btn('align:left', '<span class="wd-al l"></span>', 'Align Left (Ctrl+L)')}${btn('align:center', '<span class="wd-al c"></span>', 'Center (Ctrl+E)')}${btn('align:right', '<span class="wd-al r"></span>', 'Align Right (Ctrl+R)')}${btn('align:both', '<span class="wd-al j"></span>', 'Justify (Ctrl+J)')}
                </div><div class="wd-row">${btn('marks', '¶', 'Show/Hide ¶ — formatting marks')}${btn('tab', '⇥', 'Insert a tab (Tab)')}</div>`)}
            ${group('Editing', `<div class="wd-row"><input class="wd-in" data-find placeholder="Find" aria-label="Find">${btn('findNext', '↓', 'Find Next')}</div>
                <div class="wd-row"><input class="wd-in" data-repl placeholder="Replace with" aria-label="Replace with">${btn('replace', 'Replace', 'Replace')}${btn('replaceAll', 'All', 'Replace All')}</div>`)}
        </div>
        <div class="wd-rib" data-pane="insert" ${tab === 'insert' ? '' : 'hidden'}>
            ${group('Symbols', `<div class="wd-syms">${SYMBOLS.map(s => btn('sym:' + s, s, 'Insert ' + s)).join('')}</div>`)}
            ${group('Text', btn('date', '📅 Date', "Insert today's date") + btn('tab', '⇥ Tab', 'Insert a tab'))}
        </div>
        <div class="wd-rib" data-pane="review" ${tab === 'review' ? '' : 'hidden'}>
            ${group('Proofing', `<button type="button" class="wd-b wd-wide" data-act="check">✔ Check my letter</button>` + btn('spell', 'abc✓', 'Spelling underlines on/off'))}
            ${group('Word Count', '<div class="wd-count" data-count></div>')}
        </div>
        <div class="wd-rib" data-pane="view" ${tab === 'view' ? '' : 'hidden'}>
            ${group('Show', btn('marks', '¶ Formatting marks', 'Show/Hide ¶'))}
            ${group('Zoom', btn('zoom:-0.1', '−', 'Zoom out') + '<span class="wd-z" data-zoom></span>' + btn('zoom:0.1', '+', 'Zoom in') + btn('zoom:0', '100%', 'Page width'))}
        </div>
        <div class="wd-pop" data-pop="hl" hidden><div class="wd-sw">${HL.map(h => `<button type="button" data-cmd="highlight:${h}" title="${h}" style="background:#${D().HIGHLIGHTS[h]}"></button>`).join('')}</div>
            <button type="button" class="wd-none" data-cmd="highlight:none">No Color</button></div>
        <div class="wd-pop wd-list" data-pop="paste" hidden>${Object.keys(PASTE_MODES).map(m => `<button type="button" data-cmd="paste:${m}">${PASTE_MODES[m]}</button>`).join('')}
            <hr>${Object.keys(PASTE_MODES).map(m => `<button type="button" data-cmd="pastemode:${m}" data-pm="${m}">${m === 'keep' ? '✓ ' : ''}Ctrl+V: ${PASTE_MODES[m]}</button>`).join('')}</div>
        <div class="wd-pop wd-list" data-pop="ls" hidden>${[['240', '1.0'], ['276', '1.15'], ['360', '1.5'], ['480', '2.0'], ['600', '2.5'], ['720', '3.0']].map(([v, l]) => `<button type="button" data-cmd="line:${v}">${l}</button>`).join('')}
            <hr><button type="button" data-cmd="space:before">Add or Remove Space Before Paragraph</button><button type="button" data-cmd="space:after">Add or Remove Space After Paragraph</button></div>
        <div class="wd-pop" data-pop="fc" hidden><div class="wd-sw">${COLORS.map(c => `<button type="button" data-cmd="color:${c}" title="#${c}" style="background:#${c}"></button>`).join('')}</div></div>`;
    }
    let lastHl = 'yellow', lastFc = 'C00000';
    function showTab(t) {
        tab = t;
        const R = opts.ribbon;
        R.querySelectorAll('.wd-t').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
        R.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t; });
    }
    function closePops() { opts.ribbon.querySelectorAll('[data-pop], [data-menu]').forEach(p => { p.hidden = true; }); }
    function wireRibbon() {
        const R = opts.ribbon; if (!R) return;
        R.innerHTML = ribbonHtml();
        R.querySelector('.wd-hl').style.borderBottomColor = '#' + D().HIGHLIGHTS[lastHl];
        // Keep the letter's selection when the ribbon is clicked, as Word does.
        R.addEventListener('mousedown', (e) => { E.ribbonSel = selOffsets() || E.ribbonSel; if (e.target.closest('button') && !e.target.closest('input, select')) e.preventDefault(); });
        R.addEventListener('click', (e) => {
            const b = e.target.closest('button'); if (!b) return;
            if (b.dataset.tab) {
                if (b.dataset.tab === 'file') { const m = R.querySelector('[data-menu="file"]'); const was = m.hidden; closePops(); m.hidden = !was; return; }
                closePops(); showTab(b.dataset.tab); return;
            }
            if (b.dataset.act) { closePops(); if (opts.onAction) opts.onAction(b.dataset.act); return; }
            if (b.dataset.open) { const p = R.querySelector(`[data-pop="${b.dataset.open}"]`); const was = p.hidden; closePops(); p.hidden = !was;
                const br = b.getBoundingClientRect(), rr = R.getBoundingClientRect(); p.style.left = Math.max(0, br.left - rr.left - 120) + 'px'; p.style.top = (br.bottom - rr.top + 2) + 'px'; return; }
            const c = b.dataset.cmd; if (!c) return;
            closePops();
            const [name, arg] = c.split(/:(.*)/s);
            if (name === 'highlight-last') return CMD.highlight(lastHl);
            if (name === 'color-last') return CMD.color(lastFc);
            if (name === 'highlight') { if (arg !== 'none') { lastHl = arg; R.querySelector('.wd-hl').style.borderBottomColor = '#' + D().HIGHLIGHTS[arg]; } return CMD.highlight(arg); }
            if (name === 'color') { lastFc = arg; R.querySelector('.wd-fc').style.borderBottomColor = '#' + arg; return CMD.color(arg); }
            if (name === 'align') return CMD.align(arg);
            if (name === 'list') return CMD.list(arg);
            if (name === 'indent') return CMD.indent(+arg);
            if (name === 'line') return CMD.line(+arg);
            if (name === 'space') return CMD.space(arg);
            if (name === 'paste') return pasteFromRibbon(arg || E.pasteMode || 'keep');
            if (name === 'pastemode') {                                   // Word's "Set Default Paste"
                E.pasteMode = arg;
                R.querySelectorAll('[data-pm]').forEach(x => { x.textContent = (x.dataset.pm === arg ? '✓ ' : '') + 'Ctrl+V: ' + PASTE_MODES[x.dataset.pm]; });
                say('Ctrl+V now pastes: ' + PASTE_MODES[arg] + '.');
                return;
            }
            if (name === 'cut' || name === 'copy') { if (!document.execCommand(name)) say(`Press Ctrl+${name === 'cut' ? 'X' : 'C'}.`); return; }
            if (name === 'sym') return CMD.insertText(arg);
            if (name === 'zoom') return CMD.zoom(parseFloat(arg));
            if (name === 'spell') { arts().forEach(a => { a.spellcheck = !a.spellcheck; }); b.classList.toggle('on'); return; }
            if (CMD[name]) CMD[name]();
        });
        R.querySelector('[data-font]').addEventListener('change', (e) => CMD.font(e.target.value));
        R.querySelector('[data-size]').addEventListener('change', (e) => CMD.size(parseFloat(e.target.value)));
        R.querySelector('[data-find]').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); CMD.findNext(e.shiftKey); } });
        document.addEventListener('mousedown', (e) => { if (!R.contains(e.target)) closePops(); });
    }
    // The ribbon shows the selection's formatting, as Word's does.
    function state() {
        const R = opts.ribbon; if (!R) return;
        const sel = window.getSelection();
        R.querySelector('[data-cmd="marks"]') && R.querySelectorAll('[data-cmd="marks"]').forEach(b => b.classList.toggle('on', E.marks));
        if (!sel.rangeCount || !arts().some(a => a.contains(sel.anchorNode))) return;
        const n = sel.anchorNode, el = n.nodeType === 3 ? n.parentElement : n;
        if (!el || !el.closest('p')) return;
        const f = unzoomed(() => fmtOf(el)), p = el.closest('p');
        const on = (cmd, v) => { const b = R.querySelector(`[data-cmd="${cmd}"]`); if (b) b.classList.toggle('on', !!v); };
        on('bold', f.b); on('italic', f.i); on('underline', f.u); on('strike', f.s);
        const a = ALIGN[getComputedStyle(p).textAlign] || 'left';
        ['left', 'center', 'right', 'both'].forEach(x => on('align:' + x, a === x));
        const fs = R.querySelector('[data-font]'), ss = R.querySelector('[data-size]');
        if (fs && document.activeElement !== fs) {
            if (![].some.call(fs.options, o => o.value === f.font)) { const o = document.createElement('option'); o.textContent = f.font; fs.appendChild(o); }
            fs.value = f.font;
        }
        const pt = f.sz / 2;
        if (ss && document.activeElement !== ss) {
            if (![].some.call(ss.options, o => +o.value === pt)) { const o = document.createElement('option'); o.textContent = pt; ss.appendChild(o); }
            ss.value = String(pt);
        }
    }

    /* ---------- pages, as Word lays them out ----------
       docx-preview draws a Word section as one sheet that grows with the text. Word fills a page to its bottom margin
       and goes on on the next, with the letterhead and the office footer on every page (these letters use one header
       and footer for all pages). So the sheet is cut into pages of the file's own size: a paragraph that doesn't fit
       goes on with its next line on the next page (never leaving one line behind or carrying one line over: Word's
       widow/orphan control), a table or a short paragraph moves over whole, and the header layer is repeated per page.
       The breaks are spacers the page draws (no text, not part of the letter): they're redone after every change. */
    const GAP = 18;
    function paginate() {
        const keep = arts().some(a => a.contains(document.activeElement) || a === document.activeElement) ? selOffsets() : null;
        let pages = 0;
        unzoomed(() => {
            host.querySelectorAll('.dr-pgsp, .dr-pgband, .dr-lh-copy').forEach(n => n.remove());
            host.querySelectorAll('section.docx').forEach(sec => {
                const art = sec.querySelector(':scope > article'); if (!art) return;
                if (!sec.dataset.h) sec.dataset.h = String(parseFloat(getComputedStyle(sec).minHeight) || sec.offsetHeight);   // the page's height, in px
                const H = +sec.dataset.h;
                sec.style.minHeight = H + 'px';
                const cs = getComputedStyle(sec), pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
                const y0 = () => sec.getBoundingClientRect().top;
                const pageTop = (k) => k * (H + GAP) + pt, limit = (k) => k * (H + GAP) + H - pb;
                const room = H - pt - pb;
                let k = 0;
                [].slice.call(art.children).forEach(block => {
                    if (block.classList.contains('dr-pgsp')) return;
                    for (let guard = 0; guard < 60; guard++) {
                        const b = block.getBoundingClientRect(), top = b.top - y0(), bottom = b.bottom - y0();
                        if (bottom - top < 0.5 || bottom <= limit(k) + 0.5) break;
                        if (top >= limit(k) - 0.5) {                                      // starts below this page's text
                            if (top >= pageTop(k + 1) - 0.5) { k++; continue; }
                            k++; spacerBefore(block, pageTop(k), y0); continue;
                        }
                        if (block.tagName === 'P' && splitLines(block, k, pageTop, limit, y0)) { k++; continue; }
                        if (bottom - top <= room + 0.5 && top > pageTop(k) + 0.5) { k++; spacerBefore(block, pageTop(k), y0); continue; }
                        while (bottom > limit(k) + 0.5) k++;                              // taller than a page: it runs on
                        break;
                    }
                });
                const N = k + 1;
                pages += N;
                sec.style.minHeight = (N * H + (N - 1) * GAP) + 'px';
                const lh = sec.querySelector(':scope > .dr-lh');
                if (lh) { lh.style.inset = ''; lh.style.left = '0'; lh.style.right = '0'; lh.style.top = '0'; lh.style.height = H + 'px'; }
                for (let i = 1; i < N; i++) {
                    const band = document.createElement('div');
                    band.className = 'dr-pgband'; band.setAttribute('aria-hidden', 'true');
                    band.style.top = (i * (H + GAP) - GAP) + 'px'; band.style.height = GAP + 'px';
                    sec.appendChild(band);
                    if (lh) {
                        const c = lh.cloneNode(true);
                        c.classList.add('dr-lh-copy');
                        c.style.top = (i * (H + GAP)) + 'px';
                        sec.insertBefore(c, lh.nextSibling);
                    }
                }
            });
        });
        E.pages = pages;
        if (keep) setSel(keep.s, keep.e);
        stats();
    }
    function spacer(h, inline) {
        const sp = document.createElement(inline ? 'span' : 'div');
        sp.className = 'dr-pgsp'; sp.contentEditable = 'false'; sp.setAttribute('aria-hidden', 'true');
        // inside a paragraph, a full-width inline block: the line before it wraps as any line does (still justified)
        if (inline) { sp.style.display = 'inline-block'; sp.style.width = '100%'; sp.style.verticalAlign = 'top'; }
        else sp.style.display = 'block';
        sp.style.height = Math.max(0, h) + 'px';
        return sp;
    }
    // Moves `block` down so its top is at `target` (measured again once: margins stop collapsing round a spacer).
    function spacerBefore(block, target, y0) {
        const was = block.getBoundingClientRect().top - y0();
        const sp = spacer(target - was);
        block.parentNode.insertBefore(sp, block);
        const now = block.getBoundingClientRect().top - y0();
        sp.style.height = Math.max(0, parseFloat(sp.style.height) - (now - target)) + 'px';
    }
    // The lines of a paragraph, from its text (a line is the text boxes that overlap in height).
    function lineBoxes(p, y0) {
        const rects = [];
        const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) {
            const t = w.currentNode;
            if (!t.nodeValue || t.parentElement.closest('.dr-pgsp')) continue;
            const r = document.createRange(); r.selectNodeContents(t);
            [].forEach.call(r.getClientRects(), b => { if (b.height > 0.5) rects.push({ top: b.top - y0, bottom: b.bottom - y0 }); });
        }
        rects.sort((a, b) => a.top - b.top);
        const lines = [];
        rects.forEach(b => {
            const l = lines[lines.length - 1];
            if (l && b.top < l.bottom - 2) { l.top = Math.min(l.top, b.top); l.bottom = Math.max(l.bottom, b.bottom); }
            else lines.push({ top: b.top, bottom: b.bottom });
        });
        return lines;
    }
    function splitLines(p, k, pageTop, limit, y0) {
        const lines = lineBoxes(p, y0()).filter(l => l.top >= pageTop(k) - 1);
        let i = lines.findIndex(l => l.bottom > limit(k) + 0.5);
        if (i < 0) return false;
        if (lines.length - i < 2) i = lines.length - 2;                     // never one line alone on the next page
        if (i < 2) return false;                                            // nor one line alone at the foot of this one
        const line = lines[i], at = firstCharAt(p, line.top - 1, y0());
        if (!at) return false;
        const node = at.i ? at.t.splitText(at.i) : at.t;
        const sp = spacer(pageTop(k + 1) - line.top, true);
        node.parentNode.insertBefore(sp, node);
        const r = document.createRange(); r.selectNodeContents(node);
        const got = r.getClientRects()[0];
        if (got) sp.style.height = Math.max(0, parseFloat(sp.style.height) - ((got.top - y0()) - pageTop(k + 1))) + 'px';
        return true;
    }
    function firstCharAt(p, top, y0) {
        const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) {
            const t = w.currentNode, v = t.nodeValue;
            if (!v || t.parentElement.closest('.dr-pgsp, .docx-tab-stop, .dr-chk')) continue;
            const whole = document.createRange(); whole.selectNodeContents(t);
            const rs = whole.getClientRects(); if (!rs.length || rs[rs.length - 1].bottom - y0 <= top) continue;
            for (let i = 0; i < v.length; i++) {
                const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1);
                const b = r.getBoundingClientRect();
                if (b.height > 0.5 && b.top - y0 >= top) return { t, i };
            }
        }
        return null;
    }

    /* ---------- the status bar: pages, words, zoom ---------- */
    function stats() {
        const words = (arts().map(a => a.innerText).join(' ').match(/[A-Za-z0-9][\w’'.,/-]*/g) || []).length;
        const pages = E.pages || host.querySelectorAll('section.docx').length;
        const S = opts.status;
        if (S) {
            const p = S.querySelector('[data-pages]'), w = S.querySelector('[data-words]');
            if (p) p.textContent = `Page ${pageNow()} of ${pages}`;
            if (w) w.textContent = `${words.toLocaleString()} words`;
        }
        const c = opts.ribbon && opts.ribbon.querySelector('[data-count]');
        if (c) c.innerHTML = `<b>${pages}</b> page${pages === 1 ? '' : 's'}<br><b>${words}</b> words`;
        return { pages, words };
    }
    // The page the cursor is on, counted the way the status bar in Word counts it.
    function pageNow() {
        const sel = window.getSelection();
        if (!sel.rangeCount || !arts().some(a => a.contains(sel.anchorNode))) return 1;
        let rect = sel.getRangeAt(0).getBoundingClientRect();
        if (!rect.height) { const el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement; rect = el.getBoundingClientRect(); }
        let n = 0;
        for (const sec of host.querySelectorAll('section.docx')) {
            const r = sec.getBoundingClientRect(), z = r.height / (sec.offsetHeight || r.height) || 1, H = (+sec.dataset.h || sec.offsetHeight) * z;
            const count = Math.max(1, Math.round((r.height + GAP * z) / (H + GAP * z)));
            if (rect.top < r.bottom || sec === host.querySelector('section.docx:last-of-type')) {
                return n + Math.min(count, Math.max(1, Math.floor((rect.top - r.top) / (H + GAP * z)) + 1));
            }
            n += count;
        }
        return 1;
    }
    function fit() {
        const wrap = host.querySelector('.docx-wrapper'); if (!wrap) return;
        wrap.style.zoom = '';
        const pad = parseFloat(getComputedStyle(wrap).paddingLeft) + parseFloat(getComputedStyle(wrap).paddingRight);
        const need = Math.max.apply(null, [].map.call(wrap.querySelectorAll(':scope > section.docx'), x => x.offsetWidth).concat([0])) + pad;
        const have = host.clientWidth;
        E.fit = need > have && have > 0 ? have / need : 1;
        const z = E.fit * E.zoom;
        if (z !== 1) wrap.style.zoom = String(z);
        host.classList.toggle('wd-wide', z > E.fit + 0.001);
        const zl = opts.ribbon && opts.ribbon.querySelector('[data-zoom]'), zs = opts.status && opts.status.querySelector('[data-zoom]');
        [zl, zs].forEach(x => { if (x) x.textContent = Math.round(z * 100) + '%'; });
        if (window.LSHDraftingLetterhead) LSHDraftingLetterhead.retab();
    }
    window.addEventListener('resize', () => { if (document.body.contains(host)) fit(); });
    // ¶ Show/Hide: every space is shaded, so a double space can't hide (Word shows a dot).
    function spaces() {
        if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
        if (!E.marks) { CSS.highlights.delete('dr-space'); return; }
        const ranges = [];
        texts().forEach(t => {
            if (t.parentElement.closest('.docx-tab-stop')) return;
            const v = t.nodeValue;
            for (let i = v.indexOf(' '); i >= 0 && ranges.length < 4000; i = v.indexOf(' ', i + 1)) { const r = new Range(); r.setStart(t, i); r.setEnd(t, i + 1); ranges.push(r); }
        });
        CSS.highlights.set('dr-space', new Highlight(...ranges));
    }
    // The fonts and sizes on the page, by how many characters use them (for checking consistency).
    function fonts() {
        const out = {};
        unzoomed(() => texts().forEach(t => {
            const v = t.nodeValue.replace(/\s|\u200b/g, ''); if (!v || t.parentElement.closest('.docx-tab-stop, .dr-chk')) return;
            const f = fmtOf(t.parentElement), k = f.font + ' ' + (f.sz / 2) + 'pt';
            out[k] = out[k] || { font: f.font, pt: f.sz / 2, chars: 0, sample: '' };
            out[k].chars += v.length;
            if (out[k].sample.length < 40) out[k].sample += (out[k].sample ? ' … ' : '') + t.nodeValue.trim().slice(0, 30);
        }));
        return out;
    }

    wireRibbon();
    return draw().then(() => {
        stats();
        mark('Saved');
        return {
            xml, edit, stats, fonts, fit, focus: () => { const a = arts()[0]; if (a) a.focus(); },
            saved: () => mark('Saved to this browser'),
            unsaved: (m) => mark(m || 'Not saved'),
            cmd: CMD
        };
    });
}

window.LSHDraftingEditor = { open, fmtOf, diff };
}());

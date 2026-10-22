/* ============================================================
   ✍ Drafting (shared) — filling the firm's own .docx
   The download IS the firm's document: the original Word file, with the trainee's
   answers written into the runs the firm highlighted in yellow. Letterhead, logo,
   fonts, margins and spacing are the file's own, because nothing is re-typeset —
   only word/document.xml is edited, and everything else in the .docx is untouched.

   The walk here is the mirror image of simulators/drafting/make-drafting-data.py:
   both number the highlighted runs f1, f2 … in document order, so field "f7" in the
   editor is the same run of the same paragraph in the file. Change one, change both.

   Field runs are un-highlighted as they are filled — yellow marks a blank to fill,
   and a finished letter has none. A field left empty keeps its highlight, so what is
   still missing is obvious in the download too.

   window.LSHDraftingDocx.fill(arrayBuffer, answers) -> Promise<Blob>
     answers: { f1: "…", f2: "…" }  (missing or empty = leave the firm's text as it is)
   The Word-style editor (drafting-editor.js) uses the rest: markEditXml to draw a
   letter it can map back, applyEditsXml to write the trainee's edits into the same
   document.xml, pack to put that XML back in the firm's .docx — see below.
   ============================================================ */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;   // the Node test harness
    if (root) root.LSHDraftingDocx = api;
}(typeof window !== 'undefined' ? window : null, function () {
    'use strict';
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const XML_NS = 'http://www.w3.org/XML/1998/namespace';
    const els = (node) => [].filter.call(node.childNodes || [], n => n.nodeType === 1);
    const kids = (node, name) => els(node).filter(n => n.localName === name && n.namespaceURI === W);
    const first = (node, name) => kids(node, name)[0] || null;

    // The text a run contributes, the way Word lays it out (and the way the generator reads it).
    function runText(r) {
        let txt = '';
        els(r).forEach(n => {
            if (n.namespaceURI !== W) return;
            if (n.localName === 't') txt += n.textContent || '';
            else if (n.localName === 'tab') txt += '\t';
            else if (n.localName === 'br') txt += '\n';
            else if (n.localName === 'sym') txt += '☐';
        });
        return txt;
    }
    function runStyle(r) {
        const rPr = first(r, 'rPr');
        if (!rPr) return { hl: false, b: false, rPr: null };
        const h = first(rPr, 'highlight');
        return { hl: !!h && (h.getAttributeNS(W, 'val') || h.getAttribute('w:val') || 'none') !== 'none',
            b: !!first(rPr, 'b'), rPr };
    }

    // Every paragraph's highlighted runs, merged the way the generator merges them
    // (Word splits a line into many runs as it is edited), numbered in document order.
    function fieldsOf(doc) {
        const body = doc.getElementsByTagNameNS(W, 'body')[0];
        if (!body) throw new Error('This file has no Word body — is it really a .docx?');
        const out = {};
        let n = 0;
        els(body).forEach(child => {
            if (child.localName !== 'p' || child.namespaceURI !== W) return;   // tables carry no fields
            const runs = [].slice.call(child.getElementsByTagNameNS(W, 'r'));
            let group = null;
            const groups = [];
            runs.forEach(r => {
                const txt = runText(r);
                if (!txt) return;                                              // an empty run is not part of a field
                const st = runStyle(r);
                if (group && group.hl === st.hl && group.b === st.b) group.runs.push(r);
                else { group = { hl: st.hl, b: st.b, runs: [r] }; groups.push(group); }
            });
            groups.forEach(g => { if (g.hl) out['f' + (++n)] = g.runs; });
        });
        return out;
    }

    // Replace a run's text with the answer, keeping the run's own formatting.
    function writeRun(doc, r, text) {
        els(r).forEach(n => {
            if (n.namespaceURI === W && ['t', 'tab', 'br', 'sym'].indexOf(n.localName) >= 0) r.removeChild(n);
        });
        String(text).split('\n').forEach((line, i) => {
            if (i) r.appendChild(doc.createElementNS(W, 'w:br'));
            line.split('\t').forEach((part, j) => {
                if (j) r.appendChild(doc.createElementNS(W, 'w:tab'));        // a tab typed in a blank is Word's tab
                if (!part) return;
                const t = doc.createElementNS(W, 'w:t');
                t.setAttributeNS(XML_NS, 'xml:space', 'preserve');             // keep the spaces around a filled name
                t.appendChild(doc.createTextNode(part));
                r.appendChild(t);
            });
        });
    }
    function clearRun(r) {
        els(r).forEach(n => {
            if (n.namespaceURI === W && ['t', 'tab', 'br', 'sym'].indexOf(n.localName) >= 0) r.removeChild(n);
        });
    }
    function unhighlight(r) {
        const st = runStyle(r);
        if (st.rPr) kids(st.rPr, 'highlight').forEach(h => st.rPr.removeChild(h));
    }

    function fillXml(xml, answers) {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const err = doc.getElementsByTagName('parsererror')[0];
        if (err) throw new Error('Word document.xml could not be read.');
        const fields = fieldsOf(doc);
        let filled = 0, missing = [];
        Object.keys(fields).forEach(id => {
            const answer = answers ? answers[id] : '';
            if (answer == null || String(answer).trim() === '') { missing.push(id); return; }
            const runs = fields[id];
            writeRun(doc, runs[0], answer);
            runs.slice(1).forEach(clearRun);
            runs.forEach(unhighlight);
            filled++;
        });
        return { xml: new XMLSerializer().serializeToString(doc), filled, missing, total: Object.keys(fields).length };
    }

    // The whole .docx back, with only word/document.xml rewritten.
    async function fill(data, answers) {
        const zip = await JSZip.loadAsync(data);
        const entry = zip.file('word/document.xml');
        if (!entry) throw new Error('That template is not a Word document.');
        const res = fillXml(await entry.async('string'), answers);
        zip.file('word/document.xml', res.xml);
        const blob = await zip.generateAsync({
            type: typeof Blob === 'undefined' ? 'nodebuffer' : 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            compression: 'DEFLATE'
        });
        return { blob, filled: res.filled, missing: res.missing, total: res.total };
    }

    // The same .docx with each field's text swapped for a marker (⟦f7⟧), for drawing the letter on
    // the page exactly as Word lays it out: the page renders this file, then puts a blank where each
    // marker landed. The marker sits in the field's own first run, so it carries that run's formatting.
    const MARK = (id) => '⟦' + id + '⟧';
    function markXml(xml) {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror')[0]) throw new Error('Word document.xml could not be read.');
        const fields = fieldsOf(doc);
        Object.keys(fields).forEach(id => {
            const runs = fields[id];
            writeRun(doc, runs[0], MARK(id));
            runs.slice(1).forEach(clearRun);
        });
        hangingTabs(doc);
        return new XMLSerializer().serializeToString(doc);
    }
    // Word treats a hanging indent as a tab stop ("Our Client:⇥name" lines up under the name above);
    // docx-preview doesn't, so a copy that is only ever drawn spells that stop out.
    function hangingTabs(doc) {
        [].slice.call(doc.getElementsByTagNameNS(W, 'ind')).forEach(ind => {
            const hang = ind.getAttributeNS(W, 'hanging') || ind.getAttribute('w:hanging');
            const left = ind.getAttributeNS(W, 'left') || ind.getAttribute('w:left') || ind.getAttributeNS(W, 'start');
            const pPr = ind.parentNode;
            if (!hang || !left || !pPr || pPr.localName !== 'pPr') return;
            let tabs = first(pPr, 'tabs');
            if (tabs && kids(tabs, 'tab').some(tb => (tb.getAttributeNS(W, 'pos') || tb.getAttribute('w:pos')) === left)) return;
            if (!tabs) { tabs = doc.createElementNS(W, 'w:tabs'); pPr.insertBefore(tabs, pPr.firstChild); }
            const tb = doc.createElementNS(W, 'w:tab');
            tb.setAttributeNS(W, 'w:val', 'left');
            tb.setAttributeNS(W, 'w:pos', left);
            tabs.appendChild(tb);
        });
    }
    async function mark(data) {
        const zip = await JSZip.loadAsync(data);
        const entry = zip.file('word/document.xml');
        if (!entry) throw new Error('That template is not a Word document.');
        zip.file('word/document.xml', markXml(await entry.async('string')));
        return zip.generateAsync({ type: typeof Blob === 'undefined' ? 'nodebuffer' : 'arraybuffer' });
    }

    /* ---------- the Word-style editor: the whole letter is the trainee's to edit ----------
       The editor draws the letter from a .docx and lets the trainee change any of it, the way Word
       does. What comes back is not a new document: applyEditsXml writes each change into the same
       document.xml, run by run — a run the trainee did not touch is left exactly as it was, a run they
       retyped keeps its own formatting (rPr) and only what they changed on screen (bold, a font, the
       highlight taken off…) is added to it. Fields, check boxes, hyperlinks, the signature and the
       section breaks stay where the file has them. So the download is the firm's file, with the
       trainee's edits, and nothing else.

       Ids: editMap numbers the editable paragraphs (the body's own, not a text box's), their text runs
       and the legacy check boxes in document order. markEditXml puts a zero-width bookmark in front of
       each (docx-preview draws a bookmark as an empty <span id>), so the page can tell which paragraph
       and which run every piece of text on screen came from. The marked copy is only ever drawn. */
    const TEXT_KIDS = ['t', 'tab', 'br', 'cr', 'noBreakHyphen', 'softHyphen'];
    const own = (n, name) => n.namespaceURI === W && n.localName === name;
    function within(n, names, stop) {
        for (let x = n.parentNode; x && x !== stop; x = x.parentNode) if (names.indexOf(x.localName) >= 0) return x;
        return null;
    }
    function nearestP(n) { for (let x = n.parentNode; x; x = x.parentNode) if (own(x, 'p')) return x; return null; }
    const isPageBr = (n) => own(n, 'br') && (n.getAttributeNS(W, 'type') || n.getAttribute('w:type')) === 'page';
    function editMap(doc) {
        const body = doc.getElementsByTagNameNS(W, 'body')[0];
        if (!body) throw new Error('This file has no Word body — is it really a .docx?');
        const ps = [].filter.call(body.getElementsByTagNameNS(W, 'p'), p => !within(p, ['txbxContent', 'Fallback'], body));
        const runs = [], runP = [], pRuns = ps.map(() => []), breaks = ps.map(() => []), checks = [];
        ps.forEach((p, i) => {
            let depth = 0;
            [].forEach.call(p.getElementsByTagNameNS(W, 'r'), r => {
                if (nearestP(r) !== p || within(r, ['Fallback', 'del'], p)) return;
                const kidsOf = els(r).filter(n => n.namespaceURI === W);
                const fc = kidsOf.filter(n => n.localName === 'fldChar');
                fc.forEach(f => {
                    const type = f.getAttributeNS(W, 'fldCharType') || f.getAttribute('w:fldCharType');
                    if (type === 'begin') {
                        depth++;
                        const ff = first(f, 'ffData'), cb = ff && first(ff, 'checkBox');
                        if (cb) checks.push(cb);
                    } else if (type === 'end') depth = Math.max(0, depth - 1);
                });
                if (kidsOf.some(isPageBr)) { breaks[i].push(r); return; }
                if (fc.length || depth) return;
                const odd = kidsOf.some(n => ['sym', 'drawing', 'pict', 'object', 'instrText', 'ruby'].indexOf(n.localName) >= 0);
                if (odd || !kidsOf.some(n => TEXT_KIDS.indexOf(n.localName) >= 0)) return;
                runP.push(i); pRuns[i].push(runs.length); runs.push(r);
            });
        });
        return { body, ps, runs, runP, pRuns, breaks, checks };
    }
    function bookmark(doc, name, n) {
        const b = doc.createElementNS(W, 'w:bookmarkStart');
        b.setAttributeNS(W, 'w:id', String(880000 + n));
        b.setAttributeNS(W, 'w:name', name);
        return b;
    }
    function markEditXml(xml) {
        const doc = parseXml(xml), m = editMap(doc);
        let n = 0;
        m.ps.forEach((p, i) => {
            const pPr = first(p, 'pPr');
            p.insertBefore(bookmark(doc, '_drp' + i, n++), pPr ? pPr.nextSibling : p.firstChild);
            // a page break splits the paragraph over two pages on screen: the second half says whose it is
            m.breaks[i].forEach(r => r.parentNode.insertBefore(bookmark(doc, '_drq' + i, n++), r.nextSibling));
        });
        // docx-preview draws only the runs of a hyperlink, so its runs are named in front of it, in order
        const links = new Map();
        m.runs.forEach((r, j) => {
            const box = r.parentNode;
            if (box && (own(box, 'hyperlink') || own(box, 'smartTag'))) { if (!links.has(box)) links.set(box, []); links.get(box).push(j); }
            else box.insertBefore(bookmark(doc, '_drr' + j, n++), r);
        });
        links.forEach((ids, box) => box.parentNode.insertBefore(bookmark(doc, '_drh_' + ids.join('_'), n++), box));
        m.checks.forEach((cb, k) => {
            const r = cb.parentNode.parentNode.parentNode;                     // checkBox < ffData < fldChar < r
            r.parentNode.insertBefore(bookmark(doc, '_drc' + k + (isChecked(cb) ? '_on' : '_off'), n++), r);
        });
        hangingTabs(doc);
        return new XMLSerializer().serializeToString(doc);
    }
    function isChecked(cb) {
        const c = first(cb, 'checked') || first(cb, 'default');
        if (!c) return false;
        const v = c.getAttributeNS(W, 'val') || c.getAttribute('w:val');
        return first(cb, 'checked') ? v !== '0' && v !== 'false' : v === '1' || v === 'true';
    }
    function parseXml(xml) {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror')[0]) throw new Error('Word document.xml could not be read.');
        return doc;
    }

    // Word is strict about the order of a run's and a paragraph's properties.
    const RPR_ORDER = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline', 'shadow',
        'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern', 'position', 'sz', 'szCs',
        'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath'];
    const PPR_ORDER = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr', 'suppressLineNumbers',
        'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku', 'wordWrap', 'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN',
        'bidi', 'adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc',
        'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'];
    function setProp(doc, parent, order, name, attrs) {
        kids(parent, name).forEach(x => parent.removeChild(x));
        if (!attrs) return;
        const el = doc.createElementNS(W, 'w:' + name);
        Object.keys(attrs).forEach(k => el.setAttributeNS(W, 'w:' + k, attrs[k]));
        const at = order.indexOf(name);
        const before = els(parent).find(x => order.indexOf(x.localName) > at);
        parent.insertBefore(el, before || null);
    }
    function propsOf(doc, host, name) {                       // a run's rPr / a paragraph's pPr, made if missing
        let pr = first(host, name);
        if (!pr) { pr = doc.createElementNS(W, 'w:' + name); host.insertBefore(pr, host.firstChild); }
        return pr;
    }
    // Word's highlighter has these colours and no others: what was on screen goes to the nearest.
    const HIGHLIGHTS = { yellow: 'ffff00', green: '00ff00', cyan: '00ffff', magenta: 'ff00ff', blue: '0000ff', red: 'ff0000',
        darkBlue: '000080', darkCyan: '008080', darkGreen: '008000', darkMagenta: '800080', darkRed: '800000', darkYellow: '808000',
        darkGray: '808080', lightGray: 'c0c0c0', black: '000000', white: 'ffffff' };
    function highlightName(hex) {
        const rgb = (h) => [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)), want = rgb(String(hex).replace('#', ''));
        let best = 'yellow', d = Infinity;
        Object.keys(HIGHLIGHTS).forEach(k => {
            const c = rgb(HIGHLIGHTS[k]), e = c.reduce((s, v, i) => s + (v - want[i]) * (v - want[i]), 0);
            if (e < d) { d = e; best = k; }
        });
        return best;
    }
    // set: only what differs on screen from the run it came from — { b, i, u, s, color, hl, font, sz }.
    function applySet(doc, r, set) {
        if (!set || !Object.keys(set).length) return;
        const rPr = propsOf(doc, r, 'rPr'), P = (name, attrs) => setProp(doc, rPr, RPR_ORDER, name, attrs);
        if ('b' in set) { P('b', set.b ? {} : { val: '0' }); P('bCs', set.b ? {} : { val: '0' }); }
        if ('i' in set) { P('i', set.i ? {} : { val: '0' }); P('iCs', set.i ? {} : { val: '0' }); }
        if ('s' in set) P('strike', set.s ? {} : { val: '0' });
        if ('u' in set) P('u', { val: set.u ? 'single' : 'none' });
        if ('color' in set) P('color', { val: String(set.color).replace('#', '').toUpperCase() });
        if ('hl' in set) { P('shd', null); P('highlight', set.hl && set.hl !== 'none' ? { val: highlightName(set.hl) } : null); }
        if ('font' in set && set.font) P('rFonts', { ascii: set.font, hAnsi: set.font, cs: set.font, eastAsia: set.font });
        if ('sz' in set && set.sz) { P('sz', { val: String(set.sz) }); P('szCs', { val: String(set.sz) }); }
    }
    function writeText(doc, r, text) {
        els(r).forEach(n => { if (n.namespaceURI === W && TEXT_KIDS.indexOf(n.localName) >= 0) r.removeChild(n); });
        String(text).split('\n').forEach((line, i) => {
            if (i) r.appendChild(doc.createElementNS(W, 'w:br'));
            line.split('\t').forEach((part, j) => {
                if (j) r.appendChild(doc.createElementNS(W, 'w:tab'));
                if (!part) return;
                const t = doc.createElementNS(W, 'w:t');
                t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
                t.appendChild(doc.createTextNode(part));
                r.appendChild(t);
            });
        });
    }
    function newRun(doc, baseRPr, seg) {
        const r = doc.createElementNS(W, 'w:r');
        if (baseRPr) r.appendChild(baseRPr.cloneNode(true));
        writeText(doc, r, seg.text);
        applySet(doc, r, seg.set);
        return r;
    }
    // What a run typed into a paragraph with no run of its own starts from: the paragraph mark's formatting.
    function markRPr(doc, p) {
        const pPr = first(p, 'pPr'), rp = pPr && first(pPr, 'rPr');
        if (!rp) return null;
        const out = doc.createElementNS(W, 'w:rPr');
        els(rp).forEach(x => { if (['ins', 'del', 'moveFrom', 'moveTo', 'rPrChange'].indexOf(x.localName) < 0) out.appendChild(x.cloneNode(true)); });
        return out;
    }
    const afterNode = (node, add) => node.parentNode.insertBefore(add, node.nextSibling);
    function atStart(p, add) { const pPr = first(p, 'pPr'); p.insertBefore(add, pPr ? pPr.nextSibling : p.firstChild); }
    function stripText(r) {
        els(r).forEach(n => { if (n.namespaceURI === W && TEXT_KIDS.indexOf(n.localName) >= 0) r.removeChild(n); });
        if (!els(r).some(n => !own(n, 'rPr'))) r.parentNode.removeChild(r);
    }

    /* edit = { paras: [{ p, cont, align, segs: [{ r, own, text, set }] }], checks: { k: true|false } }
         p     the paragraph the text on screen belongs to (null: one the trainee made)
         cont  the second half of a paragraph a page break split on screen
         align left | center | right | both, only when the trainee changed it
         r     the run the text came from (own: it is still inside that run on screen) */
    function applyEditsXml(xml, edit) {
        const doc = parseXml(xml), m = editMap(doc), used = new Set(), seen = new Set();
        const logical = [];
        (edit.paras || []).forEach(pe => {
            const last = logical[logical.length - 1];
            if (pe.cont && last && last.p === pe.p) last.segs = last.segs.concat(pe.segs || []);
            else logical.push({ p: pe.p, align: pe.align, segs: (pe.segs || []).slice() });
        });
        let prevP = null;
        logical.forEach(L => {
            let X;
            if (L.p != null && m.ps[L.p] && !seen.has(L.p)) { X = m.ps[L.p]; seen.add(L.p); }
            else {
                // a paragraph the trainee made (Enter): its predecessor's paragraph formatting, never its section break
                const src = (L.p != null && m.ps[L.p]) || prevP;
                X = doc.createElementNS(W, 'w:p');
                const pPr = src && first(src, 'pPr');
                if (pPr) {
                    const c = pPr.cloneNode(true);
                    kids(c, 'sectPr').concat(kids(c, 'pPrChange')).forEach(x => c.removeChild(x));
                    X.appendChild(c);
                }
                if (prevP) afterNode(prevP, X); else m.ps[0].parentNode.insertBefore(X, m.ps[0]);
            }
            writeParagraph(doc, X, L, m, used);
            if (L.align) setProp(doc, propsOf(doc, X, 'pPr'), PPR_ORDER, 'jc', { val: L.align });
            prevP = X;
        });
        // A paragraph that is gone from the screen is gone from the file — unless it closes a Word
        // section or is a table cell's last, which Word cannot do without: those keep, emptied.
        m.ps.forEach((p, i) => {
            if (seen.has(i)) return;
            const pPr = first(p, 'pPr'), parent = p.parentNode;
            const keep = (pPr && first(pPr, 'sectPr')) || (own(parent, 'tc') && kids(parent, 'p').length < 2);
            if (keep) m.pRuns[i].forEach(j => { if (!used.has(j)) stripText(m.runs[j]); });
            else parent.removeChild(p);
        });
        const marks = edit.checks || {};
        m.checks.forEach((cb, k) => {
            if (!(k in marks)) return;
            kids(cb, 'checked').forEach(x => cb.removeChild(x));
            if (marks[k]) cb.appendChild(doc.createElementNS(W, 'w:checked'));
        });
        // a bookmark whose other half went with a deleted paragraph would be a broken bookmark in Word
        const ends = {}, starts = {};
        [].slice.call(m.body.getElementsByTagNameNS(W, 'bookmarkStart')).forEach(b => { starts[b.getAttributeNS(W, 'id') || b.getAttribute('w:id')] = b; });
        [].slice.call(m.body.getElementsByTagNameNS(W, 'bookmarkEnd')).forEach(b => { ends[b.getAttributeNS(W, 'id') || b.getAttribute('w:id')] = b; });
        Object.keys(starts).forEach(id => { if (!ends[id]) starts[id].parentNode.removeChild(starts[id]); });
        Object.keys(ends).forEach(id => { if (!starts[id]) ends[id].parentNode.removeChild(ends[id]); });
        return new XMLSerializer().serializeToString(doc);
    }
    function writeParagraph(doc, X, L, m, used) {
        const groups = [];
        L.segs.forEach(s => {
            if (!s || s.text === '') return;
            const g = groups[groups.length - 1];
            if (g && g.r === s.r && g.own === !!s.own) g.segs.push(s);
            else groups.push({ r: s.r, own: !!s.own, segs: [s] });
        });
        let cursor = null;
        const place = (add) => { if (cursor) afterNode(cursor, add); else atStart(X, add); cursor = add; };
        groups.forEach(g => {
            const run = g.r != null ? m.runs[g.r] : null;
            const inPlace = run && g.own && !used.has(g.r) && nearestP(run) === X &&
                (!cursor || (cursor.compareDocumentPosition(run) & 4));
            if (inPlace) {
                used.add(g.r);
                const s0 = g.segs[0];
                // (the page reads a no-break space as a space: the browser types one for every space it must keep)
                if (g.segs.length === 1 && !Object.keys(s0.set || {}).length && runText(run).replace(/\u00a0/g, ' ') === s0.text) { cursor = run; return; }
                const base = first(run, 'rPr') ? first(run, 'rPr').cloneNode(true) : null;
                writeText(doc, run, s0.text);
                applySet(doc, run, s0.set);
                cursor = run;
                g.segs.slice(1).forEach(s => place(newRun(doc, base, s)));
                return;
            }
            const base = run ? first(run, 'rPr') : markRPr(doc, X);
            g.segs.forEach(s => place(newRun(doc, base, s)));
        });
        const idx = m.ps.indexOf(X);
        if (idx >= 0) m.pRuns[idx].forEach(j => { if (!used.has(j)) { used.add(j); stripText(m.runs[j]); } });
    }

    // What a letter says, paragraph by paragraph, and what is still highlighted — for checking it.
    function auditXml(xml) {
        const doc = parseXml(xml), m = editMap(doc);
        const paras = m.ps.map((p, i) => m.pRuns[i].map(j => runText(m.runs[j])).join(''));
        const highlighted = [];
        m.runs.forEach(r => {
            const rPr = first(r, 'rPr'), h = rPr && first(rPr, 'highlight');
            const v = h && (h.getAttributeNS(W, 'val') || h.getAttribute('w:val'));
            if (v && v !== 'none' && runText(r).trim()) highlighted.push(runText(r));
        });
        return { paras, highlighted, checks: m.checks.map(isChecked) };
    }
    async function documentXml(data) {
        const zip = await JSZip.loadAsync(data), entry = zip.file('word/document.xml');
        if (!entry) throw new Error('That template is not a Word document.');
        return entry.async('string');
    }
    // The firm's .docx with only word/document.xml swapped: as a download (blob) or to draw (arraybuffer).
    async function pack(data, xml, kind) {
        const zip = await JSZip.loadAsync(data);
        zip.file('word/document.xml', xml);
        return zip.generateAsync({
            type: kind || (typeof Blob === 'undefined' ? 'nodebuffer' : 'blob'),
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            compression: 'DEFLATE'
        });
    }

    return { fill, fillXml, fieldsOf, mark, markXml, MARK_RE: /⟦(f\d+)⟧/,
        editMap, markEditXml, applyEditsXml, auditXml, documentXml, pack, highlightName, HIGHLIGHTS };
}));

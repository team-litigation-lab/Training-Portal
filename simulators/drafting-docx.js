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
            const t = doc.createElementNS(W, 'w:t');
            t.setAttributeNS(XML_NS, 'xml:space', 'preserve');                 // keep the spaces around a filled name
            t.appendChild(doc.createTextNode(line));
            r.appendChild(t);
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

    return { fill, fillXml, fieldsOf };
}));

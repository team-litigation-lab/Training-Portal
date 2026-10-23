/* ============================================================
   ✍ Drafting (shared) — the Letters of Representation, for every program.
   One tool instead of a copy per course: Standard Foundational Training and Case
   Management both open this page (the courses link to it with an SSO ticket, the
   way they already do for Email, Docket and Records), so the templates and the
   wording only ever live in one place — simulators/drafting/templates/.

   Each letter opens as the firm's original (read-only, drawn as Word lays it out by drafting-editor.js), and the
   trainee edits it on their own computer, in whatever they have: ✎ Edit in Word (the .docx, for Word or any word
   processor) or ✎ Edit in PDF (the same letter as a PDF, for any PDF editor). What they save is uploaded back here,
   checked for the attention to detail it takes (nothing left highlighted, no sample details, one sending method, no
   double spaces, the template's fonts) and scored to their progress in the Portal.
   A MedLOR's original comes with the client's signed HIPAA under it, drawn from the firm's PDF (pdf.js).
   What the trainee did is kept in their browser and on their account (LSH_DRAFTING_DOCS_V1: each uploaded Word
   letter's document.xml, deflated; LSH_DRAFTING_V1: the case, provider and the HIPAA's answers; the uploaded files
   themselves as '<letter>:docx' / '<letter>:pdf'); each upload's score goes through Sim.saveResult like every other
   simulator, so it counts in the Portal's per-module scores.
   ============================================================ */
(function () {
'use strict';
if (!window.LSH_DRAFTING_TEMPLATES) return;

const TEMPLATES = window.LSH_DRAFTING_TEMPLATES, CASES = window.LSH_DRAFTING_CASES || [];
const PROVIDERS = window.LSH_DRAFTING_PROVIDERS || [];
const KEY = 'LSH_DRAFTING_V1';
const esc = (v) => Sim.esc(String(v == null ? '' : v));
const app = () => document.getElementById('app');
// tab: a letter template's id, or 'prov' for the medical providers' letters, which are a letter
// per provider (their own address block is part of their own file) in two kinds.
// edit: the way the trainee last chose to edit it on their computer ('word' or 'pdf'), to show those steps first.
const S = { tab: TEMPLATES[0].id, caseNo: 0, prov: 0, kind: 'medlor', answers: {}, savedAt: null, edit: null };
const LETTER_KIND = { medlor: 'Medical LOR + Unsworn Declaration', lienbv: 'Lien Balance Verification' };

/* ---------- the trainee's own drafts, in their browser ---------- */
const slot = () => (Sim.who().name || 'practice').toLowerCase().replace(/\s+/g, ' ').trim();
function load() {
    try {
        const all = JSON.parse(localStorage.getItem(KEY) || '{}'), mine = all[slot()];
        if (mine) {
            S.answers = mine.answers || {}; S.caseNo = mine.caseNo || 0; S.savedAt = mine.savedAt || null;
            if (mine.prov != null) S.prov = mine.prov;
            if (mine.kind) S.kind = mine.kind;
        }
    } catch (e) { /* a first run, or storage turned off */ }
}
function save() {
    S.savedAt = new Date().toISOString();
    const mine = { answers: S.answers, caseNo: S.caseNo, prov: S.prov, kind: S.kind, savedAt: S.savedAt };
    try {
        const all = JSON.parse(localStorage.getItem(KEY) || '{}');
        all[slot()] = mine;
        localStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) { /* private window: the draft lives for this visit only */ }
    cloudQueue('_state', JSON.stringify(mine));
}

/* ---------- 💾 saved to the trainee's Portal account too (/api/drafting-drafts) ----------
   Every letter is kept in this browser at once and sent to the trainee's account 2.5 s after the last change (and when the
   page closes), with the page's own choices (case, provider, the HIPAA's answers) as '_state'. Opening a letter takes the
   newer of the two copies, so a letter follows the trainee to any browser or computer they sign in on. A copy saved from
   another tab or device after this one was opened is never overwritten (409 DRAFT_NEWER). Signed out, it stays in the browser. */
const CLOUD_API = '/api/drafting-drafts';
const CLOUD = { base: {}, pending: {}, timers: {}, busy: {}, off: false };
const cloudOn = () => { const s = Sim.session(); return !!(s && s.username) && !CLOUD.off; };
async function cloudGet(letter) {
    if (!cloudOn()) return null;
    try {
        const res = await Sim.fetchRetry(CLOUD_API + '?letter=' + encodeURIComponent(letter), { credentials: 'include', cache: 'no-store' });
        if (res.status === 401) { CLOUD.off = true; return null; }
        const d = await res.json().catch(() => null);
        if (!d || !d.success) return null;
        CLOUD.base[letter] = d.updatedAt || null;
        return d.data ? JSON.parse(d.data) : null;
    } catch (e) { return null; }
}
function cloudQueue(letter, data) {
    if (!cloudOn()) return;
    CLOUD.pending[letter] = data;
    clearTimeout(CLOUD.timers[letter]);
    CLOUD.timers[letter] = setTimeout(() => cloudSend(letter), 2500);
}
async function cloudSend(letter, keep) {
    clearTimeout(CLOUD.timers[letter]);
    const data = CLOUD.pending[letter];
    if (data == null || !cloudOn()) return;
    if (CLOUD.busy[letter]) { CLOUD.timers[letter] = setTimeout(() => cloudSend(letter), 800); return; }
    CLOUD.busy[letter] = true;
    delete CLOUD.pending[letter];
    let msg = null;
    try {
        const res = await Sim.fetchRetry(CLOUD_API, { method: 'POST', credentials: 'include', keepalive: !!keep, headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'draft', letter, data, base: CLOUD.base[letter] || null }) });
        const d = await res.json().catch(() => ({}));
        if (res.status === 401) { CLOUD.off = true; msg = 'Saved to this browser — sign in to save it to your account'; }
        else if (res.status === 409 && d.code === 'DRAFT_NEWER') msg = 'A newer copy is on your account (another tab or device): open this letter again to get it';
        else if (res.ok && d.success) { CLOUD.base[letter] = d.updatedAt; msg = 'Saved to your account'; }
        else { CLOUD.pending[letter] = CLOUD.pending[letter] || data; msg = 'Saved to this browser — not to your account yet'; }
    } catch (e) { CLOUD.pending[letter] = CLOUD.pending[letter] || data; msg = 'Saved to this browser — not to your account yet (offline?)'; }
    CLOUD.busy[letter] = false;
    if (msg) { const st = document.querySelector('#dr-edit [data-sync]'); if (st && letter !== '_state') st.textContent = msg; }
}
window.addEventListener('pagehide', () => { Object.keys(CLOUD.pending).forEach(l => cloudSend(l, true)); });
// The page's choices from the account, when they are newer than this browser's.
async function cloudState() {
    const c = await cloudGet('_state');
    if (c && c.savedAt && (!S.savedAt || c.savedAt > S.savedAt)) {
        S.answers = c.answers || {}; S.caseNo = c.caseNo || 0; S.savedAt = c.savedAt;
        if (c.prov != null) S.prov = c.prov;
        if (c.kind) S.kind = c.kind;
        try { const all = JSON.parse(localStorage.getItem(KEY) || '{}'); all[slot()] = c; localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* none */ }
        return true;
    }
    if (S.savedAt && (!c || !c.savedAt || S.savedAt > c.savedAt)) cloudQueue('_state', JSON.stringify({ answers: S.answers, caseNo: S.caseNo, prov: S.prov, kind: S.kind, savedAt: S.savedAt }));
    return false;
}

/* ---------- the letter ---------- */
function provider() { return PROVIDERS[S.prov] || PROVIDERS[0] || null; }
function provLetter() {
    const p = provider(); if (!p) return null;
    return p.letters[S.kind] || p.letters.medlor || p.letters.lienbv || null;
}
// The letter on screen, with where its .docx lives and the id its answers are filed under
// (a provider's letters are per provider, so the id carries the provider and the kind).
function tpl() {
    if (S.tab === 'prov') {
        const p = provider(), t = provLetter();
        if (!t) return TEMPLATES[0];
        return Object.assign({}, t, { id: 'prov:' + p.id + ':' + t.id, dir: 'providers', provider: p.name });
    }
    const t = TEMPLATES.find(x => x.id === S.tab) || TEMPLATES[0];
    return Object.assign({}, t, { dir: 'templates' });
}
const srcOf = (t) => '/simulators/drafting/' + t.dir + '/' + t.file.split('/').map(encodeURIComponent).join('/');
// The same document as a PDF (simulators/drafting/pdf/, made from the .docx by make-drafting-pdfs.cjs), for Edit PDF.
const pdfOf = (t) => '/simulators/drafting/pdf/' + t.dir + '/' + t.file.replace(/\.docx$/i, '.pdf').split('/').map(encodeURIComponent).join('/');
const origName = (t) => t.file.split('/').pop();
const key = (tid, f) => tid + ':' + f;
const answer = (tid, f) => S.answers[key(tid, f)] || '';
// The letter's date is the day it is drafted, as a template editor fills it in.
const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
function fieldsOf(t) {
    const out = [];
    t.blocks.forEach(b => { if (b.t === 'p') b.runs.forEach(r => { if (r.f) out.push(r); }); });
    return out;
}
// Fields the trainee is responsible for (the date writes itself).
const theirFields = (t) => fieldsOf(t).filter(r => r.k !== 'date');
const doneCount = (t) => theirFields(t).filter(r => String(answer(t.id, r.f)).trim()).length;

function runHtml(t, r) {
    if (!r.f) return esc(r.x).replace(/\n/g, '<br>') === '' ? '' : (r.b ? `<b>${esc(r.x).replace(/\n/g, '<br>')}</b>` : esc(r.x).replace(/\n/g, '<br>'));
    if (r.k === 'date') return `<span class="dr-auto" title="The date the letter is drafted — filled in for you, as a template editor does">${esc(today())}</span>`;
    const v = answer(t.id, r.f), filled = String(v).trim() ? ' filled' : '';
    const title = r.k === 'manual'
        ? 'The firm highlighted this line, but it is not a placeholder: type how the letter actually goes out.'
        : 'The firm highlighted this — fill it in.';
    if (r.k === 'long') {
        return `<textarea class="dr-f${filled}" data-f="${esc(r.f)}" rows="3" placeholder="${esc(r.ph)}" title="${esc(title)}"
            oninput="LSHDrafting.set('${esc(r.f)}', this.value)">${esc(v)}</textarea>`;
    }
    const size = Math.max(10, Math.min(70, (String(v) || r.ph).length + 2));
    return `<input class="dr-f${filled}" data-f="${esc(r.f)}" size="${size}" value="${esc(v)}" placeholder="${esc(r.ph)}"
        title="${esc(title)}" oninput="LSHDrafting.set('${esc(r.f)}', this.value)">`;
}
function paperHtml(t) {
    return t.blocks.map(b => {
        if (b.t === 'tbl') {
            return `<table class="dr-tbl"><tbody>${b.rows.map(row =>
                `<tr>${row.map(c => `<td>${esc(c).replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
        }
        const inner = b.runs.map(r => runHtml(t, r)).join('');
        return `<p class="${b.c ? 'c' : ''}${b.n ? ' n' : ''}">${inner || '&nbsp;'}</p>`;
    }).join('');
}

/* ---------- the letter, edited on the trainee's own computer ----------
   The page shows the firm's original (read-only, drawn as Word lays it out). The trainee edits it on their PC, in
   whatever they have: ✎ Edit in Word hands them the .docx for Microsoft Word or any word processor (LibreOffice
   Writer, WPS Office, Google Docs), ✎ Edit in PDF hands them the PDF for any PDF editor (Adobe Acrobat, Nitro,
   Foxit, PDF-XChange, LibreOffice Draw). They upload what they saved, and it is graded on upload — the same checks
   whichever way it was edited — and the score goes to their progress in the Portal (Sim.saveResult).
   A Word upload is read for its word/document.xml (kept on their account like a draft, so the file name and the
   letter's checks follow them); the file itself, and an uploaded PDF, are kept on their account for their trainer
   as '<letter>:docx' / '<letter>:pdf'. */
const docxCache = {};
let drawing = 0;
async function templateBytes(t) {
    const src = srcOf(t);
    if (!docxCache[src]) {
        docxCache[src] = fetch(src, { credentials: 'include' }).then(res => {
            if (!res.ok) throw new Error('The template could not be loaded (' + res.status + ').');
            return res.arrayBuffer();
        });
        docxCache[src].catch(() => { delete docxCache[src]; });
    }
    return (await docxCache[src]).slice(0);
}
// The letter's text as last uploaded from Word, deflated (a letter's XML is ~60 KB; deflated, a tenth of that).
const DOCS = 'LSH_DRAFTING_DOCS_V1';
function docsAll() { try { return JSON.parse(localStorage.getItem(DOCS) || '{}'); } catch (e) { return {}; } }
const inflate = async (d) => { try { return await (await JSZip.loadAsync(d.z, { base64: true })).file('d').async('string'); } catch (e) { return null; } };
function keepLocal(tid, d) {
    const all = docsAll(), mine = all[slot()] = all[slot()] || {};
    mine[tid] = d;
    localStorage.setItem(DOCS, JSON.stringify(all));
}
// The letter as last uploaded: this browser's copy or the account's, whichever is newer.
async function loadDoc(tid) {
    const local = (docsAll()[slot()] || {})[tid] || null;
    const cloud = await cloudGet(tid);
    let pick = local && local.z ? local : null;
    if (cloud && cloud.z && (!pick || String(cloud.at || '') > String(pick.at || ''))) {
        pick = cloud;
        try { keepLocal(tid, cloud); } catch (e) { /* this browser is full: the account has it */ }
    }
    return pick ? inflate(pick) : null;
}
async function saveDoc(tid, xml) {
    const z = new JSZip(); z.file('d', xml);
    const d = { z: await z.generateAsync({ type: 'base64', compression: 'DEFLATE' }), at: new Date().toISOString() };
    cloudQueue(tid, JSON.stringify(d));
    try { keepLocal(tid, d); } catch (e) { /* this browser is full: the account has it */ }
}
const LETTER = {};                 // per letter: { paras, highlighted, checks } as last uploaded — for the file name
// The original: the firm's file as Word lays it out, letterhead and pages, with nothing to type in.
async function openViewer(t) {
    const host = document.getElementById('dr-paper'), shell = document.getElementById('dr-wd');
    if (!host || !window.docx || !window.docx.renderAsync || !window.LSHDraftingEditor || !window.JSZip) { if (shell) shell.classList.add('wd-off'); return; }
    const mine = ++drawing;
    try {
        const bytes = await templateBytes(t), tplXml = await LSHDraftingDocx.documentXml(bytes);
        if (mine !== drawing || !document.body.contains(host)) return;
        await LSHDraftingEditor.open({ host, status: document.getElementById('dr-status'), title: shell.querySelector('.wd-title'), baseXml: tplXml, bytes, readOnly: true });
        if (mine !== drawing) return;
        const st = shell.querySelector('.wd-title [data-state]'); if (st) st.textContent = 'Original · read-only';
    } catch (e) {
        if (shell) shell.classList.add('wd-off');
        if (window.console) console.warn('Drafting: the original could not be drawn —', e && e.message);
    }
}
// The letter last uploaded from Word, so its file name carries the client as the trainee wrote it.
async function restoreLetter(t) {
    if (LETTER[t.id]) return;
    const xml = await loadDoc(t.id);
    if (!xml || LETTER[t.id] || tpl().id !== t.id) return;
    LETTER[t.id] = LSHDraftingDocx.auditXml(xml);
    document.querySelectorAll('.dr-name').forEach(nm => { nm.textContent = fileName(t) + (/\.pdf$/.test(nm.textContent) ? '.pdf' : '.docx'); });
}
// Fonts and sizes a Word upload sets on its runs, by how many characters use them (what the run inherits is the template's own).
function fontsOfXml(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml'), out = {};
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', kid = (n, name) => n && [].find.call(n.childNodes, c => c.localName === name);
    [].forEach.call(doc.getElementsByTagNameNS(W, 'r'), r => {
        const text = [].map.call(r.getElementsByTagNameNS(W, 't'), x => x.textContent).join(''), v = text.replace(/\s/g, '');
        if (!v) return;
        const rPr = kid(r, 'rPr'), f = kid(rPr, 'rFonts'), z = kid(rPr, 'sz');
        const font = f && f.getAttributeNS(W, 'ascii'), pt = z ? Number(z.getAttributeNS(W, 'val')) / 2 : null;
        if (!font && !pt) return;
        const k = (font || '') + ' ' + (pt || '');
        out[k] = out[k] || { font: font || null, pt, chars: 0, sample: '' };
        out[k].chars += v.length;
        if (out[k].sample.length < 40) out[k].sample += (out[k].sample ? ' … ' : '') + text.trim().slice(0, 30);
    });
    return out;
}
// A PDF upload, read back with pdf.js: its text (with what a Fill & Sign tool typed on top), the yellow left on it, and its ticks.
async function readPdf(bytes) {
    const lib = await pdfjs(), doc = await lib.getDocument({ data: bytes }).promise, lines = [];
    let yellow = 0;
    for (let n = 1; n <= doc.numPages; n++) {
        const pg = await doc.getPage(n), tc = await pg.getTextContent();
        let line = '';
        tc.items.forEach(i => { line += i.str; if (i.hasEOL) { lines.push(line); line = ''; } });
        if (line) lines.push(line);
        (await pg.getAnnotations()).forEach(a => {
            if (a.subtype === 'Highlight') yellow++;
            const typed = a.contentsObj && a.contentsObj.str || a.textContent && [].concat(a.textContent).join(' ') || a.fieldValue;
            if (typed && typeof typed === 'string' && a.subtype !== 'Highlight') lines.push(typed);
        });
        const ops = await pg.getOperatorList();
        ops.fnArray.forEach((fn, i) => {
            if (fn !== lib.OPS.setFillRGBColor) return;
            const c = ops.argsArray[i], hex = typeof c[0] === 'string' ? c[0].toLowerCase() : null;
            if (hex === '#ffff00' || (!hex && c[0] === 255 && c[1] === 255 && c[2] === 0)) yellow++;
        });
    }
    return { paras: lines.map(l => l.replace(/\s+$/, '')), yellow, pages: doc.numPages };
}

/* ---------- Check my letter: what a trainer looks for, before it goes ----------
   Attention to detail is the skill: nothing highlighted, no template instructions or sample details
   left, today's date, one sending method, no double spaces, the template's own fonts and sizes, and
   (for the LORs) every detail of the case notes in the letter. */
const norm = (v) => String(v || '').toLowerCase().replace(/[\s.,;:]+/g, '').replace(/[‘’]/g, "'");
const profiles = {};
async function profileOf(t) {
    const src = srcOf(t);
    if (!profiles[src]) profiles[src] = (async () => {
        const zip = await JSZip.loadAsync(await templateBytes(t)), fonts = new Set(), sizes = new Set();
        for (const part of ['word/document.xml', 'word/styles.xml', 'word/theme/theme1.xml']) {
            const f = zip.file(part); if (!f) continue;
            const x = await f.async('string');
            x.replace(/w:(?:ascii|hAnsi)="([^"]+)"/g, (m, v) => fonts.add(v.toLowerCase()));
            x.replace(/<a:latin typeface="([^"]+)"/g, (m, v) => { if (v) fonts.add(v.toLowerCase()); });
            x.replace(/<w:sz w:val="(\d+)"/g, (m, v) => sizes.add(+v / 2));
        }
        if (!sizes.size) sizes.add(10);
        return { fonts, sizes };
    })();
    return profiles[src];
}
// a: the letter as uploaded — { from: 'word' | 'pdf', paras, highlighted (Word: the runs still highlighted), yellow (PDF: how
// much yellow is left on its pages), checks (Word's tick boxes), fonts (Word: the fonts and sizes its runs set) }.
async function runChecks(t, a) {
    if (!a) return null;
    const text = a.paras.join('\n'), out = [];
    const add = (ok, label, detail, weight) => out.push({ ok: ok === true, part: typeof ok === 'number' ? ok : (ok ? 1 : 0), label, detail: detail || '', weight: weight || 1 });
    const clip = (xs) => xs.slice(0, 4).map(x => '“' + String(x).trim().slice(0, 60) + '”').join(', ') + (xs.length > 4 ? ` and ${xs.length - 4} more` : '');
    if (a.from === 'pdf') add(!a.yellow, 'No highlighted text left', a.yellow ? 'There is still yellow highlighting on the PDF. Take the highlight off every piece you changed (or the template\'s highlight is still under it).' : '', 2);
    else add(!a.highlighted.length, 'No highlighted text left', a.highlighted.length ? 'Still highlighted: ' + clip(a.highlighted) + '. Select it and choose Text Highlight Color › No Color.' : '', 2);
    const notes = (text.match(/\[[^\]\n]*\]|PLS UPDATE[^\n]*|\(Use this address[^)]*\)/gi) || []);
    add(!notes.length, 'No template instructions or [brackets] left', notes.length ? 'Remove: ' + clip(notes) : '', 2);
    add(text.indexOf(today()) >= 0, `The letter is dated today (${today()})`, text.indexOf(today()) >= 0 ? '' : 'Type the date the letter goes out, the firm\'s way: Month D, YYYY.');
    const dbl = a.paras.filter(p => /\S {2,}\S/.test(p));
    add(!dbl.length, 'No double spaces between words', dbl.length ? 'In: ' + clip(dbl.map(p => p.match(/.{0,25}\S {2,}\S.{0,15}/)[0])) + '. ¶ Show/Hide shades every space.' : '');
    if (a.fonts) {          // a PDF doesn't say which font a line was typed in reliably, so this is checked on Word uploads only
        const prof = await profileOf(t), used = a.fonts, odd = Object.keys(used).map(k => used[k])
            .filter(u => (u.font && !prof.fonts.has(u.font.toLowerCase())) || (u.pt && !prof.sizes.has(u.pt)));
        add(!odd.length, 'Fonts and sizes match the template', odd.length ? odd.map(u => `${u.font || 'the template font'} ${u.pt ? u.pt + ' pt' : ''} (${u.chars} characters, e.g. “${u.sample.slice(0, 30)}”)`).join('; ') : '');
    }
    if (t.dir === 'templates') {
        const via = a.paras.find(p => /SENT VIA/i.test(p)) || '';
        add(!(/FACSIMILE/i.test(via) && /E-?MAIL/i.test(via)), 'One sending method on the “SENT VIA” line', via && /FACSIMILE/i.test(via) && /E-?MAIL/i.test(via) ? 'Keep only the method you are using.' : '');
        add(!/\bF\/E\b/.test(text), '“F/E” replaced with the actual fax or e-mail', /\bF\/E\b/.test(text) ? 'F/E means Fax or E-mail: put the number or address you are sending to.' : '');
        const c = CASES[S.caseNo] || {}, side = (t.id === 'lor3p' ? c.p3 : c.p1) || {}, flat = norm(text), miss = [];
        let want = 0;
        Object.keys(side).forEach(k => {
            const v = /Adjuster Name and Address/i.test(k) ? String(side[k]).split(',')[0] : side[k];
            if (!String(v || '').trim()) return;
            want++;
            if (flat.indexOf(norm(v)) < 0) miss.push(`${k}: ${v}`);
        });
        if (want) add(miss.length ? (want - miss.length) / want : true, `Case details match the case notes (${want - miss.length} of ${want})`,
            miss.length ? 'Not found in the letter: ' + miss.join(' · ') : '', 3);
        const values = Object.keys(side).map(k => norm(side[k]));
        const left = fieldsOf(t).filter(r => r.k === 'field' && String(r.ph).trim().length >= 6 && !/^(Attn|F\/E)/i.test(r.ph.trim()))
            .map(r => r.ph.trim()).filter((ph, i, xs) => xs.indexOf(ph) === i && values.every(v => v.indexOf(norm(ph)) < 0) && text.indexOf(ph) >= 0);
        add(!left.length, 'No sample details from the template left', left.length ? 'Still the template\'s: ' + clip(left) : '', 2);
    }
    if (isMedlor(t)) {
        const ticked = /☒|☑|✓|✔|\bX\b(?= ?(Medical|Itemized|Bills|Records))/.test(text) || (a.checks || []).some(Boolean);
        add(ticked, 'A box ticked for what you are requesting', ticked ? '' : 'Tick bills, records or both: double-click a ☐, or Insert › Symbol ☒.');
    }
    const total = out.reduce((s, c) => s + c.weight, 0), got = out.reduce((s, c) => s + c.weight * c.part, 0);
    return { checks: out, score: total ? Math.round(got / total * 100) : 0, text: a.paras };
}
function checksHtml(res) {
    if (!res) return '<p style="margin:0;color:#64748b;">Upload your edited letter to have it checked.</p>';
    return `<div class="dr-score">${res.score}%</div>
        <ul class="dr-checks">${res.checks.map(c => `<li><span class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'}</span><div>${esc(c.label)}${c.detail ? `<small>${esc(c.detail)}</small>` : ''}</div></li>`).join('')}</ul>`;
}

/* ---------- picking a provider and which of their two letters ---------- */
function providerBar() {
    const p = provider(); if (!p) return '';
    const kinds = Object.keys(p.letters);
    return `<div class="dr-bar">
        <select onchange="LSHDrafting.pickProvider(this.value)" aria-label="Medical provider"
            style="flex:1 1 320px;min-width:0;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;font-size:12.5px;">
            ${PROVIDERS.map((x, i) => `<option value="${i}" ${i === S.prov ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
        </select>
        ${kinds.map(k => `<button class="dr-tab ${k === S.kind ? 'on' : ''}" onclick="LSHDrafting.pickKind('${esc(k)}')">${esc(LETTER_KIND[k] || k)}</button>`).join('')}
    </div>`;
}

/* ---------- the case notes beside it ---------- */
function caseHtml() {
    if (S.tab === 'prov') {
        const p = provider(); if (!p) return '';
        return `<div class="dr-note">
            <h3>This provider</h3>
            <p style="margin:0 0 7px;"><b>${esc(p.name)}</b></p>
            <p style="margin:0;color:#64748b;">Their address block and the Unsworn Declaration of Custodian of Records are part of their own letter — the firm sent one file per provider, so nothing about them is typed in.</p>
        </div>`;
    }
    if (!CASES.length) return '';
    const c = CASES[S.caseNo] || CASES[0], side = S.tab === 'lor3p' ? c.p3 : c.p1;
    const rows = Object.keys(side || {}).map(k => `<dt>${esc(k)}</dt><dd>${esc(side[k])}</dd>`).join('');
    return `<div class="dr-note">
        <h3>Case notes · ${S.tab === 'lor3p' ? '3P' : '1P'}</h3>
        <select onchange="LSHDrafting.pickCase(this.value)" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;font:inherit;font-size:12px;margin-bottom:10px;">
            ${CASES.map((x, i) => `<option value="${i}" ${i === S.caseNo ? 'selected' : ''}>Case ${i + 1}${x.p1 && x.p1['Client Name'] ? ' · ' + esc(x.p1['Client Name']) : ''}</option>`).join('')}
        </select>
        ${rows ? `<dl>${rows}</dl>` : '<p style="margin:0;color:#64748b;">This case has no notes for this side.</p>'}
    </div>`;
}

/* ---------- the file name the trainers ask for ----------
   As the 18-Day Foundational Training guide gives them (Days 11, 14 and 16):
     INS – 1P State Farm - LOR 02.17.2026 (Michelle)
     INS – 3P Geico - LOR with Affidavit 02.17.2026 (Michelle)
     MED - JML(Lyons Physical Therapy) - MedLOR with Unsworn COR and HIPAA 08.11.22 (John)
     MED - RDG(NPIM Dr. Fabito) - Lien Balance Verification 08.17.2022 (Jane)
   The VA's first name; the client's initials before the provider; NPIM always with the doctor. */
const pad2 = (n) => String(n).padStart(2, '0');
const firstName = () => (String(Sim.who().name || '').trim().split(/\s+/)[0]) || 'VA';
// The carrier: the company the trainee put in the letter, else the one in the case notes.
function carrierOf(t) {
    if (t.id !== 'lor1p' && t.id !== 'lor3p') return '';
    const typed = String(answer(t.id, 'f3')).trim().replace(/[\[\]]/g, '').replace(/\.$/, '');
    if (typed) return typed;
    const c = CASES[S.caseNo] || {};
    return (t.id === 'lor1p' ? (c.p1 || {})['Insurance Company Name'] : (c.p3 || {})['Defendant Insurance Company Name']) || '';
}
// The client, read off the letter itself ("Our Client: John Test Doe"), as the trainee has it now.
function clientOf(t) {
    const edited = LETTER[t.id] && LETTER[t.id].paras;              // the letter as last uploaded from Word
    if (edited) for (const line of edited) {
        const m = line.match(/Our Client:\s*([^\t\n]+)/);
        if (m && m[1].trim()) return m[1].trim();
    }
    for (const b of t.blocks) {
        if (b.t !== 'p') continue;
        const line = b.runs.map(r => r.f ? (r.k === 'date' ? '' : (String(answer(t.id, r.f)).trim() ? answer(t.id, r.f) : r.ph)) : r.x).join('');
        const m = line.match(/Our Client:\s*([^\t\n]+)/);
        if (m && m[1].trim()) return m[1].trim();
    }
    return '';
}
const initialsOf = (name) => name.split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join('');
// "Nevada Personal Injury Management — Dr. Le" → "NPIM Dr. Le"; "Las Vegas Spine & Pain Center (Dr. Brian Le)" → "… Dr. Brian Le".
const providerLabel = (name) => String(name).replace(/^Nevada Personal Injury Management\s*—\s*/i, 'NPIM ')
    .replace(/\s*—\s*/g, ' ').replace(/\s*\((Dr\.[^)]*)\)/g, ' $1').trim();
function fileName(t) {
    const d = new Date(), mm = pad2(d.getMonth() + 1), dd = pad2(d.getDate()), yyyy = d.getFullYear();
    let name;
    if (t.dir === 'providers') {
        const who = initialsOf(clientOf(t)) + '(' + providerLabel(t.provider) + ')';
        name = t.id.endsWith(':medlor')
            ? `MED - ${who} - MedLOR with Unsworn COR and HIPAA ${mm}.${dd}.${String(yyyy).slice(2)} (${firstName()})`
            : `MED - ${who} - Lien Balance Verification ${mm}.${dd}.${yyyy} (${firstName()})`;
    } else {
        const carrier = carrierOf(t);
        name = t.naming
            .replace(/([13]P) Insurance Provider/, (m, side) => carrier ? side + ' ' + carrier : m)
            .replace('mm.dd.yyyy', `${mm}.${dd}.${yyyy}`)
            .replace("(VA's name)", `(${firstName()})`);
    }
    return name.replace(/[\\/:*?"<>|]/g, '');
}

/* ---------- the MedLOR packet: the letter + the client's signed HIPAA, one PDF ----------
   The firm never sends a MedLOR on its own (18-Day guide, Day 14): the VA completes the client's
   signed HIPAA from Intake — Validity of Authorization is the date the client signed it, Relationship
   to Patient is Self — and merges it with the MedLOR and Unsworn COR into one PDF, HIPAA first, named
   "MED - JTD(Provider) - MedLOR with Unsworn COR and HIPAA mm.dd.yy (Name)". The page writes the
   HIPAA's three blanks onto the firm's own PDF and merges it with the MedLOR the trainee saved as PDF
   from Word (pdf-lib). The finished example is a trainer's: it lives under /simulators/drafting/trainers/,
   which only an admin can open (functions/_middleware.js). */
const HIPAA_SRC = '/simulators/drafting/hipaa/' + encodeURIComponent('INTAKE - HIPAA 2.0 for training purposes.pdf');
const MODEL_SRC = '/simulators/drafting/trainers/' + encodeURIComponent('Model packet - MedLOR with Unsworn COR and HIPAA.pdf');
const HIPAA_SIGNED = { y: 2025, m: 10, d: 15 };            // "Date: October 15, 2025" under the client's signature
// Where each blank is on the firm's PDF (points from the bottom left; page 1 or 2), and what is right.
const HIPAA_FIELDS = [
    { id: 'valid', label: 'Valid beginning on', page: 0, x: 249, y: 167, ok: (v) => isSigned(v) },
    { id: 'from', label: 'Expires 5 years from', page: 0, x: 478, y: 167, ok: (v) => isSigned(v) },
    { id: 'rel', label: 'Relationship to Patient', page: 1, x: 158, y: 445, ok: (v) => /^\s*self\s*$/i.test(v) }
];
function isSigned(v) {
    const d = new Date(String(v).trim().replace(/(\d)(st|nd|rd|th)\b/i, '$1'));
    return !isNaN(d) && d.getFullYear() === HIPAA_SIGNED.y && d.getMonth() + 1 === HIPAA_SIGNED.m && d.getDate() === HIPAA_SIGNED.d;
}
const hipaaKey = (t, id) => t.id + ':hipaa:' + id;
const hipaaVal = (t, id) => String(S.answers[hipaaKey(t, id)] || '');
const isMedlor = (t) => t.dir === 'providers' && /:medlor$/.test(t.id);
function packetHtml(t) {
    if (!isMedlor(t)) return '';
    const admin = Sim.isAdmin && Sim.isAdmin();
    return `<div class="dr-note">
        <h3>Step 2 · The client's signed HIPAA</h3>
        <p style="margin:0 0 8px;">Intake has the client's signed HIPAA. Open it, then fill in what the VA completes on it.</p>
        <a class="sim-btn ghost" href="${HIPAA_SRC}" download="INTAKE - HIPAA 2.0 (John Test Doe).pdf" style="display:block;text-align:center;margin-bottom:10px;">⬇ The client's signed HIPAA (PDF)</a>
        ${HIPAA_FIELDS.map(f => `<label style="display:block;margin:0 0 8px;font-weight:700;color:#334155;">${esc(f.label)}
            <input class="dr-hip" data-h="${f.id}" value="${esc(hipaaVal(t, f.id))}" oninput="LSHDrafting.setHipaa('${f.id}', this.value)"
                style="display:block;width:100%;box-sizing:border-box;margin-top:3px;padding:7px 9px;border:1px solid #cbd5e1;border-radius:7px;font:inherit;font-weight:500;"></label>`).join('')}
    </div>
    <div class="dr-note">
        <h3>Step 3 · One PDF, ready to send</h3>
        <p style="margin:0 0 8px;">Save your finished MedLOR as a PDF (in Word or any word processor: File › Save As › PDF; or the PDF you edited). Choose that PDF here: the page puts the HIPAA in front of it, as the firm sends it.</p>
        <input type="file" id="dr-medpdf" accept="application/pdf,.pdf" style="width:100%;font-size:12px;margin-bottom:8px;">
        <button class="sim-btn orange" style="width:100%;" onclick="LSHDrafting.packet()">⬇ Build the packet (PDF)</button>
        <p style="margin:10px 0 4px;color:#64748b;">Saved as</p>
        <div class="dr-name">${esc(fileName(t))}.pdf</div>
        ${admin ? `<p style="margin:12px 0 0;"><b>For trainers:</b> <a href="${MODEL_SRC}" download>the firm's finished packet</a> (model answer — trainees can't open it).</p>` : ''}
    </div>`;
}
// The HIPAA as an original too, under a MedLOR's letter: the firm's own PDF, read-only, as Intake has it.
// Its pages are drawn on the page (pdf.js, loaded only for a MedLOR), as the letter's are, rather than left to
// the browser's own PDF viewer, which some browsers don't have; if they can't be drawn, the browser's viewer is the fallback.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfjsLoad = null;
function pdfjs() {
    if (!pdfjsLoad) pdfjsLoad = new Promise((ok, no) => {
        if (window.pdfjsLib) return ok(window.pdfjsLib);
        const s = document.createElement('script');
        s.src = PDFJS + 'pdf.min.js';
        s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
        s.onerror = () => { pdfjsLoad = null; no(new Error('pdf.js could not be loaded')); };
        document.head.appendChild(s);
    });
    return pdfjsLoad;
}
function hipaaViewHtml(t) {
    if (!isMedlor(t)) return '';
    return `<div class="wd wd-view wd-pdf" id="dr-hipaa">
        <div class="wd-title"><span class="wd-logo" aria-hidden="true">PDF</span><span class="wd-fname">INTAKE - HIPAA 2.0 (John Test Doe).pdf</span><span data-state>The client's signed HIPAA · Opening…</span></div>
        <div class="wd-canvas"><div class="dr-pdfpages" data-pages-host></div></div>
        <div class="wd-status"><span data-pages></span><a href="${HIPAA_SRC}" download="INTAKE - HIPAA 2.0 (John Test Doe).pdf" style="margin-left:auto;color:#185abd;font-weight:600;">⬇ Download the HIPAA</a></div>
    </div>`;
}
async function openHipaa() {
    const box = document.getElementById('dr-hipaa'); if (!box) return;
    const host = box.querySelector('[data-pages-host]'), st = box.querySelector('[data-state]');
    try {
        const lib = await pdfjs();
        const doc = await lib.getDocument({ url: HIPAA_SRC, withCredentials: true }).promise;
        const width = Math.max(320, host.clientWidth - 48), dpr = window.devicePixelRatio || 1;
        for (let n = 1; n <= doc.numPages; n++) {
            const pg = await doc.getPage(n), base = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: width / base.width * dpr });
            const c = document.createElement('canvas');
            c.width = vp.width; c.height = vp.height; c.style.width = width + 'px';
            c.setAttribute('aria-label', `The client's signed HIPAA, page ${n} of ${doc.numPages}`);
            await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            if (!document.body.contains(host)) return;
            host.appendChild(c);
        }
        box.querySelector('.wd-status [data-pages]').textContent = doc.numPages + ' page' + (doc.numPages === 1 ? '' : 's');
        st.textContent = 'The client\'s signed HIPAA · Original · read-only';
    } catch (e) {
        if (!document.body.contains(host)) return;
        host.innerHTML = `<iframe class="wd-pdfframe" src="${HIPAA_SRC}#view=FitH" title="The client's signed HIPAA"></iframe>`;
        st.textContent = 'The client\'s signed HIPAA · Original';
        if (window.console) console.warn('Drafting: the HIPAA could not be drawn —', e && e.message);
    }
}
async function buildPacket(t, medBytes) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const res = await fetch(HIPAA_SRC, { credentials: 'include' });
    if (!res.ok) throw new Error('The HIPAA could not be loaded (' + res.status + ').');
    const out = await PDFDocument.load(await res.arrayBuffer());
    const font = await out.embedFont(StandardFonts.Helvetica), pages = out.getPages();
    HIPAA_FIELDS.forEach(f => {
        const v = hipaaVal(t, f.id).trim();
        if (v && pages[f.page]) pages[f.page].drawText(v, { x: f.x, y: f.y, size: 10.5, font, color: rgb(0, 0, 0) });
    });
    const med = await PDFDocument.load(medBytes);
    (await out.copyPages(med, med.getPageIndices())).forEach(pg => out.addPage(pg));
    return { bytes: await out.save(), medPages: med.getPageCount() };
}

// The trainers' own reminders for each letter, from the 18-Day Foundational Training guide.
function guideHtml(t) {
    const li = (xs) => '<ul style="margin:0;padding-left:18px;">' + xs.map(x => `<li style="margin:0 0 5px;">${x}</li>`).join('') + '</ul>';
    if (t.dir === 'templates') return `<div class="dr-note"><h3>The trainers' reminders</h3>${li([
        '<b>F/E</b> means Fax or E-mail: replace it with the actual fax number or e-mail address you are sending to (see the case notes).',
        '<b>SENT VIA FACSIMILE AND E-MAIL</b>: keep only the method you are using and remove the other.',
        'Check the spacing, the layout of the recipient\'s address and that the font and alignment are consistent.',
        'These letters go to insurance companies: clear, accurate and professional.',
        '<b>No highlighted text may be left in your final letter.</b>'])}</div>`;
    if (t.id.endsWith(':medlor')) return `<div class="dr-note"><h3>The trainers' reminders</h3>${li([
        'Tick the boxes for what you are requesting (bills, records or both).',
        'Check the client\'s details against the current contact card in SA — don\'t trust what the template already has.',
        'The final file is <b>one PDF</b>: this MedLOR with the Unsworn COR and the client\'s signed HIPAA, merged in your PDF editor.',
        'On the HIPAA: <b>Validity of Authorization</b> is the date the client signed it (shown at the bottom); <b>Relationship to Patient</b> is <b>Self</b>.',
        'NPIM doctors: the doctor\'s name goes in the file name after the provider.'])}</div>`;
    return `<div class="dr-note"><h3>The trainers' reminders</h3>${li([
        'Check the client\'s details against the current contact card in SA.',
        'NPIM doctors: the doctor\'s name goes in the file name after the provider.',
        'E-mail subject: <i>Client name - Lien holder (provider) - Request for Lien Verification</i>.'])}</div>`;
}

function tabsHtml() {
    return `<div class="dr-bar">
            ${TEMPLATES.map(x => `<button class="dr-tab ${x.id === S.tab ? 'on' : ''}" onclick="LSHDrafting.tab('${esc(x.id)}')">${esc(x.title)}</button>`).join('')}
            ${PROVIDERS.length ? `<button class="dr-tab ${S.tab === 'prov' ? 'on' : ''}" onclick="LSHDrafting.tab('prov')">Medical provider letters</button>` : ''}
            <a class="dr-tab" href="/simulators/demand-packet.html" title="The cover letter, index, demand letter, PIP log, bills and records as one PDF">📚 Demand packets &amp; binders →</a>
        </div>
        ${S.tab === 'prov' ? providerBar() : ''}`;
}
// The ways to work the original, on the trainee's own computer: ✎ Edit in Word (the .docx, for any word processor)
// and ✎ Edit in PDF (the same letter as a PDF, from simulators/drafting/pdf/, for any PDF editor). Either way, what
// they save is uploaded back here and graded.
function docBarHtml(t) {
    return `<div class="dr-docbar">
        <span class="dr-docname" title="${esc(origName(t))}">📄 ${esc(t.provider ? t.provider + ' — ' : '')}${esc(t.title)}</span>
        <span class="dr-docacts">
            <a class="sim-btn orange" href="${srcOf(t)}" download="${esc(fileName(t))}.docx" data-word onclick="LSHDrafting.editing('word')">✎ Edit in Word</a>
            <a class="sim-btn orange" href="${pdfOf(t)}" download="${esc(fileName(t))}.pdf" data-pdfedit onclick="LSHDrafting.editing('pdf')">✎ Edit in PDF</a>
        </span>
    </div>`;
}
// The trainee's uploads, kept on their account for their trainer: '<letter>:docx' and '<letter>:pdf' (base64, 1.4 MB at most).
const PDF_MAX = 1400000;
const fileKey = (t, kind) => t.id + ':' + kind;
const MIME = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdf: 'application/pdf' };
function editHtml(t) {
    const step = (n, html) => `<li style="margin:0 0 6px;">${html}</li>`;
    return `<div class="dr-note" id="dr-edit">
        <h3>Edit it on your computer</h3>
        <p style="margin:0 0 8px;">Use whichever program you have. What you upload is checked, and the score goes to your progress in the Portal.</p>
        <div class="dr-way${S.edit === 'word' ? ' on' : ''}" data-way="word">
            <b>✎ In Word, or any word processor</b>
            <ol style="margin:6px 0 8px;padding-left:18px;">
                ${step(1, '<b>✎ Edit in Word</b> downloads the letter as a Word file (.docx).')}
                ${step(2, 'Open it from your downloads (or right-click › <b>Open with</b> to choose the program): <b>Microsoft Word</b> — or, without Word, <b>LibreOffice Writer</b> or <b>WPS Office</b> (both free), or <b>Google Docs</b> (upload it to Drive, open with Google Docs, then File › Download › Microsoft Word).')}
                ${step(3, 'Make your changes and save it as a <b>Word document (.docx)</b>.')}
            </ol>
            <label class="sim-btn orange" style="display:block;text-align:center;cursor:pointer;">⬆ Upload my edited Word file
                <input type="file" accept=".docx,${MIME.docx}" hidden onchange="LSHDrafting.upload(this, 'docx')"></label>
        </div>
        <div class="dr-way${S.edit === 'pdf' ? ' on' : ''}" data-way="pdf">
            <b>✎ In any PDF editor</b>
            <ol style="margin:6px 0 8px;padding-left:18px;">
                ${step(1, '<b>✎ Edit in PDF</b> downloads the letter as a PDF.')}
                ${step(2, 'Open it in the PDF editor on your computer (right-click › <b>Open with</b> to choose it): <b>Adobe Acrobat</b>, <b>Nitro Pro</b>, <b>Foxit PDF Editor</b>, <b>PDF-XChange Editor</b>, or <b>LibreOffice Draw</b> (free). Use its <b>Edit text</b> tool to change the letter itself; a fill-and-sign tool only types on top, and the highlighted text stays under it.')}
                ${step(3, 'Make your changes and <b>Save</b> it as a PDF.')}
            </ol>
            <label class="sim-btn orange" style="display:block;text-align:center;cursor:pointer;">⬆ Upload my edited PDF
                <input type="file" accept="application/pdf,.pdf" hidden onchange="LSHDrafting.upload(this, 'pdf')"></label>
        </div>
        <div data-saved style="margin-top:10px;color:#64748b;">${cloudOn() ? 'Looking for what you uploaded…' : 'Sign in to keep your uploads on the platform.'}</div>
        <div data-sync style="color:#64748b;font-size:12px;"></div>
    </div>
    <div class="dr-note" id="dr-check" hidden><h3>Your letter, checked</h3><div data-body></div></div>`;
}
// The trainer's view (admins): every trainee's uploaded Word file and PDF, newest first, each opening from the platform.
function letterLabel(id) {
    const tid = id.replace(/:(pdf|docx)$/, ''), t = TEMPLATES.find(x => x.id === tid);
    if (t) return t.title;
    const m = tid.match(/^prov:(.+):(\w+)$/), p = m && PROVIDERS.find(x => x.id === m[1]);
    return m ? (p ? p.name : m[1]) + ' — ' + (LETTER_KIND[m[2]] || m[2]) : tid;
}
function trainerHtml() {
    return Sim.isAdmin() ? `<details class="dr-note" id="dr-trainer" open style="margin-bottom:14px;">
        <summary style="cursor:pointer;"><h3 style="display:inline;">Trainees' uploaded letters (trainer)</h3></summary>
        <div data-list style="margin-top:10px;color:#64748b;">Loading…</div></details>` : '';
}
async function showTrainer() {
    const box = document.querySelector('#dr-trainer [data-list]'); if (!box) return;
    let rows = null;
    try {
        const res = await Sim.fetchRetry(CLOUD_API + '?pdfs=1', { credentials: 'include', cache: 'no-store' });
        const d = await res.json().catch(() => null);
        rows = d && d.success ? d.pdfs || [] : null;
    } catch (e) { /* offline */ }
    if (!document.body.contains(box)) return;
    if (!rows) { box.textContent = 'The trainees\' uploads could not be loaded.'; return; }
    box.innerHTML = rows.length ? `<table style="width:100%;border-collapse:collapse;font-size:12.5px;">
        <tr style="text-align:left;"><th style="padding:4px;">Trainee</th><th style="padding:4px;">Document</th><th style="padding:4px;">Saved</th><th></th></tr>
        ${rows.map(r => `<tr style="border-top:1px solid #e2e8f0;"><td style="padding:4px;">${esc(r.name || r.username)}${r.batch ? `<div style="color:#64748b;font-size:11px;">${esc(r.batch)}</div>` : ''}</td><td style="padding:4px;">${esc(letterLabel(r.letter))}</td>
            <td style="padding:4px;">${esc(new Date(r.updatedAt).toLocaleString())}</td>
            <td style="padding:4px;"><a href="${CLOUD_API}?raw=1&letter=${encodeURIComponent(r.letter)}&user=${encodeURIComponent(r.username)}" target="_blank" rel="noopener">${/:docx$/.test(r.letter) ? 'Word file' : 'Open PDF'}</a></td></tr>`).join('')}
    </table>` : 'No trainee has uploaded a letter yet.';
}
// What the trainee has uploaded for this letter, with a way to get it back.
async function showSaved(t) {
    const box = document.querySelector('#dr-edit [data-saved]'); if (!box || !cloudOn()) return;
    const at = {};
    try {
        const res = await Sim.fetchRetry(CLOUD_API, { credentials: 'include', cache: 'no-store' });
        const d = await res.json().catch(() => null);
        ((d && d.success && d.letters) || []).forEach(x => { if (x.letter === fileKey(t, 'docx')) at.docx = x.updatedAt; if (x.letter === fileKey(t, 'pdf')) at.pdf = x.updatedAt; });
    } catch (e) { /* offline: say nothing is known */ }
    if (!document.body.contains(box) || tpl().id !== t.id) return;
    const row = (kind, label) => at[kind] ? `<div style="margin-top:6px;">Your ${label} is on the platform (${esc(new Date(at[kind]).toLocaleString())}).
        <button class="sim-btn ghost" style="margin-top:6px;width:100%;" onclick="LSHDrafting.savedFile('${kind}')">⬇ Download my ${label}</button></div>` : '';
    box.innerHTML = row('docx', 'Word file') + row('pdf', 'PDF') || 'Nothing uploaded for this letter yet.';
}
function renderView(t) {
    app().innerHTML = `
        ${trainerHtml()}
        ${tabsHtml()}
        ${docBarHtml(t)}
        <div class="dr-grid">
            <div class="dr-main">
            <div class="wd wd-view" id="dr-wd">
                <div class="wd-title"><span class="wd-logo" aria-hidden="true">W</span><span class="wd-fname">${esc(origName(t))}</span><span data-state>Opening…</span></div>
                <div class="wd-canvas"><div class="dr-paper" id="dr-paper">${paperHtml(t)}</div></div>
                <div class="wd-status" id="dr-status"><span data-pages></span><span data-words></span><span>English (United States)</span><span data-say></span></div>
            </div>
            ${hipaaViewHtml(t)}
            </div>
            <div class="dr-side">
                <div class="dr-note">
                    <h3>The original document</h3>
                    <p style="margin:0;">This is the firm's own file, exactly as it was sent. You edit it on your own computer: <b>✎ Edit in Word</b> for Word or any word processor, <b>✎ Edit in PDF</b> for any PDF editor. Then upload it here.</p>
                    ${isMedlor(t) ? `<p style="margin:7px 0 0;">The client's signed HIPAA, as Intake has it, is under the letter: the MedLOR goes out with it in front, as one PDF.</p>` : ''}
                    <p style="margin:10px 0 4px;color:#64748b;">Name your file</p>
                    <div class="dr-name">${esc(fileName(t))}.docx</div>
                </div>
                ${editHtml(t)}
                ${packetHtml(t)}
                ${caseHtml()}
                ${guideHtml(t)}
            </div>
        </div>`;
    openViewer(t);
    openHipaa();
    restoreLetter(t);
    showSaved(t);
    showTrainer();
}

function render() {
    return renderView(tpl());
}

function showChecks(res) {
    const box = document.getElementById('dr-check'); if (!box) return;
    box.hidden = false;
    box.querySelector('[data-body]').innerHTML = checksHtml(res);
}
// The score a checked letter reports to the trainee's progress (Sim.saveResult). A MedLOR is graded with its HIPAA:
// 70% the letter, 30% the HIPAA's three done the firm's way.
async function record(t, res, from) {
    const hip = isMedlor(t) ? HIPAA_FIELDS.map(f => ({ field: f.label, answer: hipaaVal(t, f.id), correct: f.ok(hipaaVal(t, f.id)) })) : null;
    const hipOk = hip ? hip.filter(h => h.correct).length : 0;
    const failed = res.checks.filter(c => !c.ok);
    const r = {
        simulator: S.tab === 'prov' ? 'Drafting — Medical Provider' : 'Drafting — LOR',
        scenario: S.tab === 'prov' ? `${t.title} · ${t.provider}` : t.title + (CASES.length ? ` · Case ${S.caseNo + 1}` : ''),
        score: Math.round(hip ? (res.score * 0.7 + hipOk / hip.length * 30) : res.score),
        summary: `Edited in ${from === 'pdf' ? 'a PDF editor' : 'Word'} · ${res.score}% · ${res.checks.length - failed.length} of ${res.checks.length} checks passed`
            + (hip ? ` · HIPAA ${hipOk} of ${hip.length} right` + (S.answers[t.id + ':packet'] ? ' · packet built' : ' · packet not built') : ''),
        details: { template: t.id, editedIn: from, caseNo: S.tab === 'prov' ? null : S.caseNo + 1, provider: S.tab === 'prov' ? t.provider : null,
            hipaa: hip, packetBuiltAt: hip ? (S.answers[t.id + ':packet'] || null) : null, fileName: fileName(t) + (hip ? '.pdf' : from === 'pdf' ? '.pdf' : '.docx'),
            checks: res.checks.map(c => ({ check: c.label, ok: c.ok, detail: c.detail })), letter: res.text.join('\n').slice(0, 20000) }
    };
    await Sim.saveResult(r);
    return r;
}
// An upload, kept on the trainee's account for their trainer (base64; refused over 1.4 MB, as the platform keeps it).
async function keepFile(t, kind, file, bytes) {
    if (!cloudOn()) return 'Not kept on the platform — sign in to keep it.';
    if (bytes.length > PDF_MAX) return 'Checked, but too large to keep on the platform (1.4 MB at most)' + (kind === 'pdf' ? ': in your PDF editor, reduce the file size and upload it again.' : '.');
    let b64 = '';
    for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    try {
        const res = await Sim.fetchRetry(CLOUD_API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'draft', letter: fileKey(t, kind), data: JSON.stringify({ name: file.name, b64: btoa(b64), at: new Date().toISOString() }), base: null }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.success) return 'Not kept on the platform: ' + (d.error || 'it did not take it (' + res.status + ').');
    } catch (e) { return 'Not kept on the platform — check your connection and upload it again.'; }
    return '';
}
const API = {
    tab(id) { S.tab = id; render(); window.scrollTo(0, 0); },
    // ✎ Edit in Word / Edit in PDF: the link downloads the file; this puts that way's steps first.
    editing(way) {
        S.edit = way;
        document.querySelectorAll('#dr-edit .dr-way').forEach(el => el.classList.toggle('on', el.getAttribute('data-way') === way));
        const el = document.querySelector(`#dr-edit [data-way="${way}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    // ⬆ The edited letter, back from the trainee's computer: checked, scored to their progress, and kept on their account.
    async upload(input, kind) {
        const t = tpl(), file = input && input.files && input.files[0];
        if (input) input.value = '';
        if (!file) return;
        const box = document.querySelector('#dr-edit [data-saved]');
        const say = (m) => { if (box) box.innerHTML = m; };
        const bytes = new Uint8Array(await file.arrayBuffer());
        let letter;
        try {
            if (kind === 'pdf') {
                if (String.fromCharCode.apply(null, bytes.slice(0, 5)) !== '%PDF-') { alert('That file is not a PDF. Save it from your PDF editor as a PDF and choose it again.'); return; }
                say('Reading your PDF…');
                const p = await readPdf(bytes.slice(0));
                letter = { from: 'pdf', paras: p.paras, yellow: p.yellow, highlighted: [], checks: [], fonts: null };
            } else {
                let xml = null;
                try { xml = await LSHDraftingDocx.documentXml(bytes.slice(0)); } catch (e) { /* not a .docx */ }
                if (!xml) { alert('That file is not a Word document (.docx). In your word processor, choose Save As › Word Document (.docx) and choose it again.'); return; }
                say('Reading your Word file…');
                const au = LSHDraftingDocx.auditXml(xml);
                letter = Object.assign({ from: 'word', fonts: fontsOfXml(xml) }, au);
                LETTER[t.id] = au;                      // the client as the trainee wrote it, for the file name
                await saveDoc(t.id, xml);
            }
        } catch (e) {
            say('');
            alert('That file could not be read: ' + (e && e.message || e));
            return;
        }
        if (!letter.paras.join('').trim()) { say(''); alert('No text could be read from that file. If it is a scanned or flattened PDF, edit the downloaded one and save it from your editor.'); return; }
        const res = await runChecks(t, letter);
        showChecks(res);
        say('Checking done · keeping your file on the platform…');
        const kept = await keepFile(t, kind, file, bytes);
        await record(t, res, kind === 'pdf' ? 'pdf' : 'word');
        document.querySelectorAll('.dr-name').forEach(nm => { nm.textContent = fileName(t) + (/\.pdf$/.test(nm.textContent) ? '.pdf' : '.docx'); });
        if (kept) say(esc(kept)); else showSaved(t);
        const c = document.getElementById('dr-check'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return res;
    },
    // ⬇ What the trainee uploaded, back from the platform.
    async savedFile(kind) {
        const t = tpl();
        try {
            const res = await Sim.fetchRetry(CLOUD_API + '?letter=' + encodeURIComponent(fileKey(t, kind)), { credentials: 'include', cache: 'no-store' });
            const d = await res.json().catch(() => null), p = d && d.success && d.data ? JSON.parse(d.data) : null;
            if (!p || !p.b64) { alert('Nothing uploaded was found for this document.'); return; }
            const bin = atob(p.b64), out = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([out], { type: MIME[kind] }));
            a.download = fileName(t) + '.' + kind;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        } catch (e) { alert('It could not be downloaded: ' + e.message); }
    },
    pickCase(i) { S.caseNo = Number(i) || 0; save(); render(); },
    pickProvider(i) {
        S.prov = Number(i) || 0;
        const p = provider();
        if (p && !p.letters[S.kind]) S.kind = Object.keys(p.letters)[0];   // not every provider sent both letters
        save(); render(); window.scrollTo(0, 0);
    },
    pickKind(k) { S.kind = k; save(); render(); window.scrollTo(0, 0); },
    // The sketch's blanks (only while the original is loading, or if it can't be drawn).
    set(f, v) {
        S.answers[key(tpl().id, f)] = v;           // filed under the letter's own id (a provider's carries the provider)
        save();
        const t = tpl(), done = doneCount(t), total = theirFields(t).length;
        const bar = document.querySelector('.dr-prog i'), lbl = document.querySelector('.dr-saved');
        if (bar) bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
        if (lbl) lbl.textContent = `${done} of ${total} blanks filled · saved ${new Date(S.savedAt).toLocaleTimeString()}`;
        const el = document.querySelector(`[data-f="${f}"]`);
        if (el) el.classList.toggle('filled', !!String(v).trim());
        document.querySelectorAll('.dr-name, .wd-fname').forEach(nm => {           // the carrier / the client's initials are in the file name
            nm.textContent = fileName(t) + (/\.pdf$/.test(nm.textContent) ? '.pdf' : '.docx');
        });
    },
    setHipaa(id, v) { S.answers[hipaaKey(tpl(), id)] = v; save(); },
    async packet() {
        const t = tpl(), input = document.getElementById('dr-medpdf'), file = input && input.files && input.files[0];
        if (!file) { alert('Choose your MedLOR saved as PDF first (in your word processor, File › Save As › PDF; or the PDF you edited).'); return; }
        if (!window.PDFLib) { alert('The PDF tool could not be loaded. Check your connection and try again.'); return; }
        const open = HIPAA_FIELDS.filter(f => !hipaaVal(t, f.id).trim());
        if (open.length && !confirm(`The HIPAA still has ${open.length} blank${open.length === 1 ? '' : 's'} (${open.map(f => f.label).join(', ')}). Build the packet anyway?`)) return;
        try {
            const out = await buildPacket(t, await file.arrayBuffer());
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([out.bytes], { type: 'application/pdf' }));
            a.download = fileName(t) + '.pdf';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            S.answers[t.id + ':packet'] = new Date().toISOString(); save();
            alert(`Packet built: the HIPAA (2 pages) and your MedLOR (${out.medPages} page${out.medPages === 1 ? '' : 's'}) in one PDF.`);
        } catch (e) {
            alert('The packet could not be built: ' + (/encrypt|parse|header/i.test(e.message) ? 'that file does not read as a PDF.' : e.message));
        }
    },
};
window.LSHDrafting = API;

document.getElementById('topbar').innerHTML = Sim.topbar('drafting');
Sim.label('Drafting');
// A course can open a given letter: ?tab=lor1p | lor3p | prov, and for the providers' letters ?kind=medlor | lienbv
// (Standard Foundational Training's Provider Communication days open the MedLOR + HIPAA packet this way).
function fromLink() {
    const q = new URLSearchParams(location.search), tab = q.get('tab'), kind = q.get('kind');
    if (tab === 'prov' && PROVIDERS.length) S.tab = 'prov';
    else if (tab && TEMPLATES.some(x => x.id === tab)) S.tab = tab;
    if (S.tab === 'prov' && kind && LETTER_KIND[kind]) {
        const p = provider();
        if (p && !p.letters[kind]) { const i = PROVIDERS.findIndex(x => x.letters[kind]); if (i >= 0) S.prov = i; }
        S.kind = kind;
    }
}
Sim.restore().then(async () => {
    load(); await cloudState(); fromLink(); render();
    document.getElementById('topbar').innerHTML = Sim.topbar('drafting');
});
load(); fromLink(); render();
}());

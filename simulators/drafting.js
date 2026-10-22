/* ============================================================
   ✍ Drafting (shared) — the Letters of Representation, for every program.
   One tool instead of a copy per course: Standard Foundational Training and Case
   Management both open this page (the courses link to it with an SSO ticket, the
   way they already do for Email, Docket and Records), so the templates and the
   wording only ever live in one place — simulators/drafting/templates/.

   The page draws the letter block by block from drafting-data.js, which is
   generated from those .docx files: the firm's fixed wording is text, and the runs
   the firm highlighted in yellow are the fields. The download is not a re-typeset
   copy — drafting-docx.js writes the answers back into the original Word file, so
   the letterhead, logo, fonts and spacing are the firm's own and the document can
   be uploaded to SA as it is.

   Drafts are the trainee's own and stay in their browser (LSH_DRAFTING_V1); a
   finished letter is reported to their trainer through Sim.saveResult like every
   other simulator, so it counts in the Portal's per-module scores.
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
const S = { tab: TEMPLATES[0].id, caseNo: 0, prov: 0, kind: 'medlor', answers: {}, savedAt: null };
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
    try {
        const all = JSON.parse(localStorage.getItem(KEY) || '{}');
        all[slot()] = { answers: S.answers, caseNo: S.caseNo, prov: S.prov, kind: S.kind, savedAt: S.savedAt };
        localStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) { /* private window: the draft lives for this visit only */ }
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
const key = (tid, f) => tid + ':' + f;
const answer = (tid, f) => S.answers[key(tid, f)] || '';
// The letter's date is the day it is drafted, as a template editor fills it in.
const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
function fieldsOf(t) {
    const out = [];
    t.blocks.forEach(b => { if (b.t === 'p') b.runs.forEach(r => { if (r.f) out.push(r); }); });
    return out;
}
// What goes into the .docx: every field's answer, with the date filled in for them.
function answersFor(t) {
    const out = {};
    fieldsOf(t).forEach(r => {
        const v = r.k === 'date' ? today() : answer(t.id, r.f);
        if (String(v).trim()) out[r.f] = v;
    });
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

/* ---------- the letter exactly as Word lays it out ----------
   The blocks above are a quick sketch of the letter. Once the page has the template, it draws the
   firm's own .docx instead (docx-preview): letterhead, logo, fonts, tabs, spacing and footer as in
   Word. drafting-docx.js swaps each field's text for a marker first, and the marker is replaced
   here by the same blank the sketch had, inside the run that carries the firm's formatting. */
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
async function drawDocx(t) {
    const host = document.getElementById('dr-paper');
    if (!host || !window.docx || !window.docx.renderAsync || !window.LSHDraftingDocx || !LSHDraftingDocx.mark) return;
    const mine = ++drawing;
    try {
        const marked = await LSHDraftingDocx.mark(await templateBytes(t));
        if (mine !== drawing || !document.body.contains(host)) return;
        // Rendered in place but hidden, under the sketch: docx-preview measures its tab stops on the
        // live page a moment after it renders, so the letter has to be laid out (blanks and all) by then.
        host.querySelectorAll('.dr-docx-stage').forEach(n => n.remove());
        const box = document.createElement('div');
        box.className = 'dr-docx-stage';
        box.style.cssText = 'position:absolute;left:0;top:0;width:100%;visibility:hidden;pointer-events:none;';
        host.style.position = 'relative';
        host.appendChild(box);
        await window.docx.renderAsync(marked, box, box, {
            className: 'docx', inWrapper: true, ignoreWidth: false, ignoreHeight: false, breakPages: true,
            renderHeaders: true, renderFooters: true, renderFootnotes: true, experimental: true, useBase64URL: true
        });
        if (mine !== drawing) { box.remove(); return; }                   // the trainee moved on to another letter
        const runs = {};
        fieldsOf(t).forEach(r => { runs[r.f] = r; });
        const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), hits = [];
        while (walker.nextNode()) if (LSHDraftingDocx.MARK_RE.test(walker.currentNode.nodeValue)) hits.push(walker.currentNode);
        hits.forEach(node => {
            const m = node.nodeValue.match(LSHDraftingDocx.MARK_RE), r = runs[m[1]];
            const after = node.splitText(node.nodeValue.indexOf(m[0]));
            after.nodeValue = after.nodeValue.slice(m[0].length);
            const el = r ? docxField(t, r) : document.createTextNode('');
            node.parentNode.insertBefore(el, after);
            // The run is highlighted in Word; the blank carries its own colour (yellow open, blue filled).
            if (node.parentNode.style) node.parentNode.style.backgroundColor = 'transparent';
        });
        [].slice.call(host.childNodes).forEach(n => { if (n !== box) host.removeChild(n); });
        host.classList.add('dr-docx');
        box.style.cssText = '';
        // The letterhead, office footer and signature float over the page in Word; draw them too.
        if (window.LSHDraftingLetterhead) {
            try { await LSHDraftingLetterhead.draw(marked, box); }
            catch (e) { if (window.console) console.warn('Drafting: the letterhead could not be drawn —', e && e.message); }
        }
        fitDocx();
    } catch (e) {
        // Keep the sketch: it has the same blanks, so the trainee can still draft and download.
        if (window.console) console.warn('Drafting: drawing the Word letter failed —', e && e.message);
    }
}
// A blank inside the Word layout is the firm's highlighted text itself, typed over the way it is in
// Word: it starts as the placeholder (yellow) and counts as filled once it says something else. It is
// as wide as what is in it, so tabs and wrapping stay the file's. A tab inside it (the MedLOR's "Re:"
// lines are one highlighted run, tabs and all) is a real tab stop, and Tab types one there.
const TAB_HTML = '<span class="docx-tab-stop dr-wtab" contenteditable="false">\t</span>';
const escTxt = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fieldHtml = (v) => String(v).split('\t').map(escTxt).join(TAB_HTML);
const fieldText = (el) => el.innerText.replace(/ /g, ' ').replace(/\n$/, '');
function docxField(t, r) {
    const el = document.createElement('span');
    if (r.k === 'date') {
        el.className = 'dr-auto';
        el.title = 'The date the letter is drafted — filled in for you, as a template editor does';
        el.textContent = today();
        return el;
    }
    const v = String(answer(t.id, r.f)), tabs = r.ph.indexOf('\t') >= 0;
    el.className = 'dr-f dr-ce' + (v.trim() ? ' filled' : '') + (r.k === 'long' ? ' long' : '');
    el.dataset.f = r.f;
    el.title = r.k === 'manual'
        ? 'The firm highlighted this line, but it is not a placeholder: type how the letter actually goes out.'
        : 'The firm highlighted this — type over it.' + (tabs ? ' Tab puts in a tab, as in Word.' : '');
    el.setAttribute('role', 'textbox');
    el.setAttribute('aria-label', r.ph.replace(/\t/g, ' '));
    el.contentEditable = 'true';
    el.spellcheck = false;
    el.innerHTML = fieldHtml(v.trim() ? v : r.ph);
    el.addEventListener('focus', () => {
        // An untouched placeholder is selected whole, so typing replaces it — unless it carries labels and tabs.
        if (el.classList.contains('filled') || tabs) return;
        const range = document.createRange(); range.selectNodeContents(el);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    });
    el.addEventListener('input', () => {
        const val = fieldText(el);
        API.set(r.f, val === r.ph ? '' : val);
        if (window.LSHDraftingLetterhead) LSHDraftingLetterhead.retab();   // a longer answer moves the tabs after it
    });
    el.addEventListener('blur', () => { if (!fieldText(el).trim()) el.innerHTML = fieldHtml(r.ph); });
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && r.k !== 'long') { e.preventDefault(); el.blur(); return; }
        if (e.key === 'Tab' && tabs && !e.shiftKey) { e.preventDefault(); insertHtml(TAB_HTML); }
    });
    el.addEventListener('paste', (e) => {                                // text only, never the clipboard's formatting
        e.preventDefault();
        const txt = (e.clipboardData || window.clipboardData).getData('text');
        insertHtml(fieldHtml(r.k === 'long' ? txt : txt.replace(/\s*\n\s*/g, ' ')));
    });
    return el;
}
function insertHtml(html) {
    document.execCommand('insertHTML', false, html);
    const el = document.activeElement;
    if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
}
// A letter is 8.5 in wide; on a narrow screen it is shrunk to the column rather than scrolled sideways.
function fitDocx() {
    const host = document.getElementById('dr-paper'), wrap = host && host.querySelector('.docx-wrapper');
    if (!wrap) return;
    wrap.style.zoom = '';
    // The page is centred, so it spills out on both sides: measure the page itself, not the wrapper.
    const pad = parseFloat(getComputedStyle(wrap).paddingLeft) + parseFloat(getComputedStyle(wrap).paddingRight);
    const need = Math.max.apply(null, [].map.call(wrap.querySelectorAll(':scope > section.docx'), x => x.offsetWidth).concat([0])) + pad;
    const have = host.clientWidth;
    if (need > have && have > 0) wrap.style.zoom = String(have / need);
}
window.addEventListener('resize', fitDocx);

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

function render() {
    const t = tpl(), done = doneCount(t), total = theirFields(t).length;
    app().innerHTML = `
        <div class="dr-bar">
            ${TEMPLATES.map(x => `<button class="dr-tab ${x.id === S.tab ? 'on' : ''}" onclick="LSHDrafting.tab('${esc(x.id)}')">${esc(x.title)}</button>`).join('')}
            ${PROVIDERS.length ? `<button class="dr-tab ${S.tab === 'prov' ? 'on' : ''}" onclick="LSHDrafting.tab('prov')">Medical provider letters</button>` : ''}
        </div>
        ${S.tab === 'prov' ? providerBar() : ''}
        <div class="dr-grid">
            <div class="dr-paper" id="dr-paper">${paperHtml(t)}</div>
            <div class="dr-side">
                <div class="dr-note">
                    <h3>This letter</h3>
                    <div class="dr-prog"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></div>
                    <div class="dr-saved">${done} of ${total} blanks filled${S.savedAt ? ` · saved ${new Date(S.savedAt).toLocaleTimeString()}` : ''}</div>
                    <div class="dr-actions" style="margin-top:12px;">
                        <button class="sim-btn orange" onclick="LSHDrafting.download()">⬇ Download the Word letter</button>
                        <button class="sim-btn ghost" onclick="LSHDrafting.submit()">✓ Send it to my trainer</button>
                        <a class="sim-btn ghost" href="${srcOf(t)}" download>⬇ The blank template</a>
                    </div>
                    <p style="margin:12px 0 4px;color:#64748b;">Saved as</p>
                    <div class="dr-name">${esc(fileName(t))}.docx</div>
                </div>
                ${caseHtml()}
                ${guideHtml(t)}
                <div class="dr-note">
                    <h3>How this works</h3>
                    <p style="margin:0 0 7px;">The wording is the firm's and can't be changed. Only what the firm highlighted in yellow is yours — click it and type over it, as you would in Word. It turns blue once it's yours.</p>
                    <p style="margin:0 0 7px;">The date writes itself — it is the day you draft the letter.</p>
                    <p style="margin:0;">Your download is this very Word file with your answers written in, so the logo and the format are the firm's own. Upload that file to SA.</p>
                </div>
            </div>
        </div>`;
    drawDocx(t);
}

const API = {
    tab(id) { S.tab = id; render(); window.scrollTo(0, 0); },
    pickCase(i) { S.caseNo = Number(i) || 0; save(); render(); },
    pickProvider(i) {
        S.prov = Number(i) || 0;
        const p = provider();
        if (p && !p.letters[S.kind]) S.kind = Object.keys(p.letters)[0];   // not every provider sent both letters
        save(); render(); window.scrollTo(0, 0);
    },
    pickKind(k) { S.kind = k; save(); render(); window.scrollTo(0, 0); },
    set(f, v) {
        S.answers[key(tpl().id, f)] = v;           // filed under the letter's own id (a provider's carries the provider)
        save();
        // Repaint only the counter: redrawing the paper would take the cursor out of the field.
        const t = tpl(), done = doneCount(t), total = theirFields(t).length;
        const bar = document.querySelector('.dr-prog i'), lbl = document.querySelector('.dr-saved');
        if (bar) bar.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
        if (lbl) lbl.textContent = `${done} of ${total} blanks filled · saved ${new Date(S.savedAt).toLocaleTimeString()}`;
        const el = document.querySelector(`[data-f="${f}"]`);
        if (el) el.classList.toggle('filled', !!String(v).trim());
        const nm = document.querySelector('.dr-name');                   // the carrier's name is in the file name
        if (nm) nm.textContent = fileName(t) + '.docx';
    },
    async download() {
        const t = tpl();
        try {
            const res = await fetch(srcOf(t), { credentials: 'include' });
            if (!res.ok) throw new Error('The template could not be loaded (' + res.status + ').');
            const out = await LSHDraftingDocx.fill(await res.arrayBuffer(), answersFor(t));
            const a = document.createElement('a');
            a.href = URL.createObjectURL(out.blob);
            a.download = fileName(t) + '.docx';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            // A blank left blank is still highlighted in the file, so say so rather than letting it go out quietly.
            alert(out.missing.length
                ? `Downloaded. ${out.filled} of ${out.total} blanks are filled — the ${out.missing.length} still empty stay highlighted in yellow in the letter.`
                : `Downloaded. All ${out.total} blanks are filled.`);
        } catch (e) {
            alert('The letter could not be built: ' + e.message);
        }
    },
    submit() {
        const t = tpl(), done = doneCount(t), total = theirFields(t).length;
        if (!total) return;
        if (done < total && !confirm(`${total - done} blank${total - done === 1 ? '' : 's'} still empty. Send it to your trainer anyway?`)) return;
        Sim.saveResult({
            simulator: S.tab === 'prov' ? 'Drafting — Medical Provider' : 'Drafting — LOR',
            scenario: S.tab === 'prov' ? `${t.title} · ${t.provider}` : t.title + (CASES.length ? ` · Case ${S.caseNo + 1}` : ''),
            score: total ? Math.round(done / total * 100) : 0,
            summary: `${done} of ${total} blanks filled`,
            details: { template: t.id, caseNo: S.tab === 'prov' ? null : S.caseNo + 1, provider: S.tab === 'prov' ? t.provider : null, answers: answersFor(t) }
        });
        alert('Sent to your trainer. Download the Word letter too if you need to upload it to SA.');
    }
};
window.LSHDrafting = API;

document.getElementById('topbar').innerHTML = Sim.topbar('drafting');
Sim.label('Drafting');
Sim.restore().then(() => { load(); render(); document.getElementById('topbar').innerHTML = Sim.topbar('drafting'); });
load(); render();
}());

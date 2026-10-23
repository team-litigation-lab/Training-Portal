/* ============================================================
   ✍ Drafting (shared) — the Letters of Representation, for every program.
   One tool instead of a copy per course: Standard Foundational Training and Case
   Management both open this page (the courses link to it with an SSO ticket, the
   way they already do for Email, Docket and Records), so the templates and the
   wording only ever live in one place — simulators/drafting/templates/.

   The letter opens in a Word-style editor (drafting-editor.js): the firm's own .docx,
   drawn as Word lays it out, with all of it editable — the skill being trained is
   editing a real letter and the attention to detail it takes (nothing left highlighted,
   no sample details, one sending method, no double spaces, the template's fonts).
   The download is not a re-typeset copy — drafting-docx.js writes what is on screen
   back into the original Word file, run by run, so the letterhead, logo, fonts and
   spacing are the firm's own and the document can be uploaded to SA as it is.
   While the .docx loads (or if it can't be drawn) the page shows a sketch of the
   letter from drafting-data.js, with the highlighted runs as blanks to fill.

   Drafts are the trainee's own and stay in their browser (LSH_DRAFTING_DOCS_V1: each
   edited letter's document.xml, deflated; LSH_DRAFTING_V1: the case, provider, the
   sketch's blanks and the HIPAA's answers); a finished letter is reported to their trainer through Sim.saveResult like every
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
// mode: 'view' shows the firm's original document, with Edit in Word / Edit PDF / Download Doc; 'word' is the editor.
const S = { tab: TEMPLATES[0].id, caseNo: 0, prov: 0, kind: 'medlor', answers: {}, savedAt: null, mode: 'view' };
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
    if (ED && ED.tid === letter && msg) ED.unsaved(msg);
}
async function cloudDelete(letter) {
    delete CLOUD.pending[letter]; clearTimeout(CLOUD.timers[letter]);
    if (!cloudOn()) return;
    try { await Sim.fetchRetry(CLOUD_API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', letter }) }); } catch (e) { /* kept */ }
    delete CLOUD.base[letter];
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

/* ---------- the letter in the Word-style editor ----------
   The blocks above are a quick sketch of the letter, shown while the firm's .docx loads (and kept, with
   its blanks, if the Word view can't be drawn). Once the template is here the letter opens in the editor
   (drafting-editor.js): the firm's own file, letterhead and all, with the WHOLE letter editable as in Word.
   What the trainee does is kept as the letter's word/document.xml — the same XML the download is made
   of — so the letter they come back to, the letter they download and the letter on screen are one. */
const docxCache = {};
let drawing = 0, ED = null;
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
// The trainee's edited letters, deflated (a letter's XML is ~60 KB; deflated, a tenth of that).
const DOCS = 'LSH_DRAFTING_DOCS_V1';
function docsAll() { try { return JSON.parse(localStorage.getItem(DOCS) || '{}'); } catch (e) { return {}; } }
const inflate = async (d) => { try { return await (await JSZip.loadAsync(d.z, { base64: true })).file('d').async('string'); } catch (e) { return null; } };
function keepLocal(tid, d) {
    const all = docsAll(), mine = all[slot()] = all[slot()] || {};
    mine[tid] = d;
    localStorage.setItem(DOCS, JSON.stringify(all));
}
// The letter as last left: this browser's copy or the account's, whichever is newer (the other is brought up to date).
async function loadDoc(tid) {
    const local = (docsAll()[slot()] || {})[tid] || null;
    const cloud = await cloudGet(tid);
    let pick = local && local.z ? local : null;
    if (cloud && cloud.z && (!pick || String(cloud.at || '') > String(pick.at || ''))) {
        pick = cloud;
        try { keepLocal(tid, cloud); } catch (e) { /* this browser is full: the account has it */ }
    } else if (pick && cloudOn() && (!cloud || String(pick.at || '') > String(cloud.at || ''))) cloudQueue(tid, JSON.stringify(pick));
    return pick ? inflate(pick) : null;
}
async function saveDoc(tid, xml) {
    const z = new JSZip(); z.file('d', xml);
    const d = { z: await z.generateAsync({ type: 'base64', compression: 'DEFLATE' }), at: new Date().toISOString() };
    cloudQueue(tid, JSON.stringify(d));
    keepLocal(tid, d);
}
function dropDoc(tid) {
    try { const all = docsAll(); if (all[slot()]) { delete all[slot()][tid]; localStorage.setItem(DOCS, JSON.stringify(all)); } } catch (e) { /* nothing kept */ }
}
const LETTER = {};                 // per letter: { paras, highlighted, checks } as last saved — for the name and the checks
// The original: the firm's file as Word lays it out, letterhead and pages, with nothing to type in.
async function openViewer(t) {
    const host = document.getElementById('dr-paper'), shell = document.getElementById('dr-wd');
    if (!host || !window.docx || !window.docx.renderAsync || !window.LSHDraftingEditor || !window.JSZip) { if (shell) shell.classList.add('wd-off'); return; }
    const mine = ++drawing;
    ED = null;
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
async function openEditor(t) {
    const host = document.getElementById('dr-paper'), shell = document.getElementById('dr-wd');
    if (!host || !window.docx || !window.docx.renderAsync || !window.LSHDraftingEditor || !window.JSZip) { if (shell) shell.classList.add('wd-off'); return; }
    const mine = ++drawing;
    ED = null;
    try {
        const bytes = await templateBytes(t), tplXml = await LSHDraftingDocx.documentXml(bytes);
        let base = await loadDoc(t.id);
        // A letter begun with the earlier fill-in-the-blanks page carries on from what was typed there.
        if (!base && doneCount(t)) base = LSHDraftingDocx.fillXml(tplXml, answersFor(t)).xml;
        if (mine !== drawing || !document.body.contains(host)) return;
        const ed = await LSHDraftingEditor.open({
            host, ribbon: document.getElementById('dr-ribbon'), status: document.getElementById('dr-status'), title: shell.querySelector('.wd-title'),
            baseXml: base || tplXml, bytes,
            onChange: () => persist(t, ed),
            onAction: (a) => API.action(a)
        });
        if (mine !== drawing) return;
        ED = Object.assign(ed, { tid: t.id, tplXml, bytes });
        if (!LETTER[t.id]) LETTER[t.id] = LSHDraftingDocx.auditXml(base || tplXml);
        LETTER[t.id].start = LETTER[t.id].start || LSHDraftingDocx.auditXml(tplXml).highlighted.length;
        progress(t);
    } catch (e) {
        // Keep the sketch: it has the blanks, so the trainee can still draft and download.
        if (shell) shell.classList.add('wd-off');
        if (window.console) console.warn('Drafting: the Word editor could not open —', e && e.message);
    }
}
async function persist(t, ed) {
    if (!ED || ED !== ed || ED.tid !== t.id) return;
    try {
        const xml = ed.xml();
        LETTER[t.id] = Object.assign(LETTER[t.id] || {}, LSHDraftingDocx.auditXml(xml));
        await saveDoc(t.id, xml);
        S.savedAt = new Date().toISOString();
        ed.unsaved(cloudOn() ? 'Saved to this browser · saving to your account…' : 'Saved to this browser');
    } catch (e) {
        ed.unsaved(/quota/i.test(e && e.name + e.message) ? 'Not saved — this browser is out of room' : 'Not saved');
        if (window.console) console.warn('Drafting: saving the letter failed —', e && e.message);
    }
    progress(t);
}
// "This letter": the highlighted pieces the firm left for the trainee, and how many are still there.
function progress(t) {
    const L = LETTER[t.id]; if (!L || !ED) return;
    const left = L.highlighted.length, start = Math.max(L.start || 0, left);
    const bar = document.querySelector('.dr-prog i'), lbl = document.querySelector('.dr-saved');
    if (bar) bar.style.width = (start ? Math.round((start - left) / start * 100) : 100) + '%';
    if (lbl) lbl.textContent = (left ? `${left} highlighted piece${left === 1 ? '' : 's'} still in the letter` : 'No highlighted text left')
        + (S.savedAt ? ` · saved ${new Date(S.savedAt).toLocaleTimeString()}` : '');
    document.querySelectorAll('.dr-name, .wd-fname').forEach(nm => {
        nm.textContent = fileName(t) + (/\.pdf$/.test(nm.textContent) ? '.pdf' : '.docx');
    });
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
async function runChecks(t) {
    const xml = ED && ED.tid === t.id ? ED.xml() : null;
    if (!xml) return null;
    const a = LSHDraftingDocx.auditXml(xml), text = a.paras.join('\n'), out = [];
    const add = (ok, label, detail, weight) => out.push({ ok: ok === true, part: typeof ok === 'number' ? ok : (ok ? 1 : 0), label, detail: detail || '', weight: weight || 1 });
    const clip = (xs) => xs.slice(0, 4).map(x => '“' + String(x).trim().slice(0, 60) + '”').join(', ') + (xs.length > 4 ? ` and ${xs.length - 4} more` : '');
    add(!a.highlighted.length, 'No highlighted text left', a.highlighted.length ? 'Still highlighted: ' + clip(a.highlighted) + '. Select it and choose Text Highlight Color › No Color.' : '', 2);
    const notes = (text.match(/\[[^\]\n]*\]|PLS UPDATE[^\n]*|\(Use this address[^)]*\)/gi) || []);
    add(!notes.length, 'No template instructions or [brackets] left', notes.length ? 'Remove: ' + clip(notes) : '', 2);
    add(text.indexOf(today()) >= 0, `The letter is dated today (${today()})`, text.indexOf(today()) >= 0 ? '' : 'Type the date the letter goes out, the firm\'s way: Month D, YYYY.');
    const dbl = a.paras.filter(p => /\S {2,}\S/.test(p));
    add(!dbl.length, 'No double spaces between words', dbl.length ? 'In: ' + clip(dbl.map(p => p.match(/.{0,25}\S {2,}\S.{0,15}/)[0])) + '. ¶ Show/Hide shades every space.' : '');
    const prof = await profileOf(t), used = ED.fonts(), odd = Object.keys(used).map(k => used[k])
        .filter(u => !prof.fonts.has(u.font.toLowerCase()) || !prof.sizes.has(u.pt));
    add(!odd.length, 'Fonts and sizes match the template', odd.length ? odd.map(u => `${u.font} ${u.pt} pt (${u.chars} characters, e.g. “${u.sample.slice(0, 30)}”)`).join('; ') : '');
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
        const ticked = /☒|☑/.test(text) || a.checks.some(Boolean);
        add(ticked, 'A box ticked for what you are requesting', ticked ? '' : 'Tick bills, records or both: double-click a ☐, or Insert › Symbol ☒.');
    }
    const total = out.reduce((s, c) => s + c.weight, 0), got = out.reduce((s, c) => s + c.weight * c.part, 0);
    return { checks: out, score: total ? Math.round(got / total * 100) : 0, text: a.paras };
}
function checksHtml(res) {
    if (!res) return '<p style="margin:0;color:#64748b;">The check runs on the letter in the Word view.</p>';
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
    const edited = LETTER[t.id] && LETTER[t.id].paras;              // the Word view's letter, as last saved
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
        <p style="margin:0 0 8px;">Download the Word letter, open it in Word and save it as PDF (File › Save As › PDF). Choose that PDF here: the page puts the HIPAA in front of it, as the firm sends it.</p>
        <input type="file" id="dr-medpdf" accept="application/pdf,.pdf" style="width:100%;font-size:12px;margin-bottom:8px;">
        <button class="sim-btn orange" style="width:100%;" onclick="LSHDrafting.packet()">⬇ Build the packet (PDF)</button>
        <p style="margin:10px 0 4px;color:#64748b;">Saved as</p>
        <div class="dr-name">${esc(fileName(t))}.pdf</div>
        ${admin ? `<p style="margin:12px 0 0;"><b>For trainers:</b> <a href="${MODEL_SRC}" download>the firm's finished packet</a> (model answer — trainees can't open it).</p>` : ''}
    </div>`;
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
        </div>
        ${S.tab === 'prov' ? providerBar() : ''}`;
}
// The three ways to work the original: in Word (the editor here), as a PDF, or the Word file itself.
function docBarHtml(t) {
    return `<div class="dr-docbar">
        <span class="dr-docname" title="${esc(origName(t))}">📄 ${esc(t.provider ? t.provider + ' — ' : '')}${esc(t.title)}</span>
        <span class="dr-docacts">
            <button class="sim-btn orange" onclick="LSHDrafting.edit('word')">✎ Edit in Word</button>
            <a class="sim-btn ghost" href="${pdfOf(t)}" target="_blank" rel="noopener">✎ Edit PDF</a>
            <a class="sim-btn ghost" href="${srcOf(t)}" download="${esc(origName(t))}">⬇ Download Doc</a>
        </span>
    </div>`;
}
function renderView(t) {
    app().innerHTML = `
        ${tabsHtml()}
        ${docBarHtml(t)}
        <div class="dr-grid">
            <div class="wd wd-view" id="dr-wd">
                <div class="wd-title"><span class="wd-logo" aria-hidden="true">W</span><span class="wd-fname">${esc(origName(t))}</span><span data-state>Opening…</span></div>
                <div class="wd-canvas"><div class="dr-paper" id="dr-paper">${paperHtml(t)}</div></div>
                <div class="wd-status" id="dr-status"><span data-pages></span><span data-words></span><span>English (United States)</span><span data-say></span></div>
            </div>
            <div class="dr-side">
                <div class="dr-note">
                    <h3>The original document</h3>
                    <p style="margin:0 0 7px;">This is the firm's own file, exactly as it was sent. Choose how to work it:</p>
                    <ul style="margin:0;padding-left:18px;">
                        <li style="margin:0 0 5px;"><b>✎ Edit in Word</b> opens it in the Word editor here: your changes are saved to your account, and you can check your letter and send it to your trainer.</li>
                        <li style="margin:0 0 5px;"><b>✎ Edit PDF</b> opens it as a PDF in a new tab, to edit in your PDF editor (Edge's <i>Add text</i>, or Adobe Acrobat) and save.</li>
                        <li style="margin:0;"><b>⬇ Download Doc</b> saves the original Word file, to edit in Microsoft Word.</li>
                    </ul>
                </div>
                ${caseHtml()}
                ${guideHtml(t)}
            </div>
        </div>`;
    openViewer(t);
}

function render() {
    const t = tpl(), done = doneCount(t), total = theirFields(t).length;
    ED = null;
    if (S.mode !== 'word') return renderView(t);
    app().innerHTML = `
        ${tabsHtml()}
        <div class="dr-docbar">
            <span class="dr-docname">✎ Editing in Word — ${esc(t.provider ? t.provider + ' — ' : '')}${esc(t.title)}</span>
            <span class="dr-docacts">
                <button class="sim-btn ghost" onclick="LSHDrafting.edit('view')">← The original</button>
                <a class="sim-btn ghost" href="${pdfOf(t)}" target="_blank" rel="noopener">✎ Edit PDF</a>
                <button class="sim-btn orange" onclick="LSHDrafting.download()">⬇ Download Doc</button>
            </span>
        </div>
        <div class="dr-grid">
            <div class="wd" id="dr-wd">
                <div class="wd-title"><span class="wd-logo" aria-hidden="true">W</span><span class="wd-fname">${esc(fileName(t))}.docx</span><span data-state>Opening…</span></div>
                <div class="wd-ribbon" id="dr-ribbon"></div>
                <div class="wd-canvas"><div class="dr-paper" id="dr-paper">${paperHtml(t)}</div></div>
                <div class="wd-status" id="dr-status">
                    <span data-pages></span><span data-words></span><span>English (United States)</span><span data-say></span>
                    <span class="wd-zs"><button type="button" onclick="LSHDrafting.zoom(-0.1)" aria-label="Zoom out">−</button><span data-zoom>100%</span><button type="button" onclick="LSHDrafting.zoom(0.1)" aria-label="Zoom in">+</button></span>
                </div>
            </div>
            <div class="dr-side">
                <div class="dr-note">
                    <h3>This letter</h3>
                    <div class="dr-prog"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></div>
                    <div class="dr-saved">${done} of ${total} blanks filled${S.savedAt ? ` · saved ${new Date(S.savedAt).toLocaleTimeString()}` : ''}</div>
                    <div class="dr-actions" style="margin-top:12px;">
                        <button class="sim-btn orange" onclick="LSHDrafting.download()">⬇ Download Doc</button>
                        <button class="sim-btn ghost" onclick="LSHDrafting.check()">✔ Check my letter</button>
                        <button class="sim-btn ghost" onclick="LSHDrafting.submit()">✓ Send it to my trainer</button>
                        <a class="sim-btn ghost" href="${srcOf(t)}" download>⬇ The blank template</a>
                    </div>
                    <p style="margin:12px 0 4px;color:#64748b;">Saved as</p>
                    <div class="dr-name">${esc(fileName(t))}.docx</div>
                </div>
                <div class="dr-note" id="dr-check" hidden><h3>Check my letter</h3><div data-body></div></div>
                ${packetHtml(t)}
                ${caseHtml()}
                ${guideHtml(t)}
                <div class="dr-note">
                    <h3>How this works</h3>
                    <p style="margin:0 0 7px;">This is the firm's own Word file, and all of it is yours to edit, as it will be in Word at the firm: click anywhere in the letter and type. The ribbon has Word's Home tab — Paste (with Word's Paste Options: Keep Source Formatting, Merge Formatting, Keep Text Only), font, size, <b>B</b> <i>I</i> <u>U</u>, the highlighter (<b>No Color</b> takes a highlight off), font colour, bullets, numbering, indents, line and paragraph spacing, alignment — plus Find &amp; Replace, Insert › Symbol and Date, and ¶ Show/Hide to see every space, tab and paragraph mark. Ctrl+Z undoes. The pages break where Word breaks them.</p>
                    <p style="margin:0 0 7px;">What the firm highlighted in yellow is what you have to change. When you're done, nothing in the letter should be highlighted — taking the highlight off is part of the job, just as in Word.</p>
                    <p style="margin:0;">Your download is exactly what you see: the firm's file with your edits written into it, letterhead, logo, fonts and spacing as they are. Your letter is saved as you work, to your Portal account (and this browser), so it opens where you left it on any computer you sign in on.</p>
                </div>
            </div>
        </div>`;
    openEditor(t);
}

function showChecks(res) {
    const box = document.getElementById('dr-check'); if (!box) return;
    box.hidden = false;
    box.querySelector('[data-body]').innerHTML = checksHtml(res);
}
const API = {
    tab(id) { S.tab = id; render(); window.scrollTo(0, 0); },
    edit(mode) { S.mode = mode === 'word' ? 'word' : 'view'; render(); window.scrollTo(0, 0); },
    pickCase(i) { S.caseNo = Number(i) || 0; save(); render(); },
    pickProvider(i) {
        S.prov = Number(i) || 0;
        const p = provider();
        if (p && !p.letters[S.kind]) S.kind = Object.keys(p.letters)[0];   // not every provider sent both letters
        save(); render(); window.scrollTo(0, 0);
    },
    pickKind(k) { S.kind = k; save(); render(); window.scrollTo(0, 0); },
    // The sketch's blanks (only while the Word view is loading, or if it can't be drawn).
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
    zoom(dz) { if (ED) ED.cmd.zoom(dz); },
    xml() { return ED && ED.tid === tpl().id ? ED.xml() : null; },     // the letter as it would download (tests)
    // The editor's File menu and Review tab.
    action(a) {
        if (a === 'download') return API.download();
        if (a === 'check') return API.check();
        if (a === 'save') { const t = tpl(); if (ED) persist(t, ED); return; }
        if (a === 'template') { const l = document.createElement('a'); l.href = srcOf(tpl()); l.download = ''; document.body.appendChild(l); l.click(); l.remove(); return; }
        if (a === 'reset') {
            const t = tpl();
            if (!confirm('Start this letter over from the firm\'s template? Everything you changed in it is lost.')) return;
            dropDoc(t.id); cloudDelete(t.id);
            Object.keys(S.answers).forEach(k => { if (k.indexOf(t.id + ':') === 0 && k.indexOf(':hipaa:') < 0) delete S.answers[k]; });
            delete LETTER[t.id];
            save(); render();
        }
    },
    async check() {
        const t = tpl(), res = await runChecks(t);
        showChecks(res);
        const box = document.getElementById('dr-check');
        if (box) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return res;
    },
    async packet() {
        const t = tpl(), input = document.getElementById('dr-medpdf'), file = input && input.files && input.files[0];
        if (!file) { alert('Choose your MedLOR saved as PDF first (open the Word letter in Word, then File › Save As › PDF).'); return; }
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
    // The letter as a .docx: in the Word view, exactly what is on screen; from the sketch, its blanks.
    async build() {
        const t = tpl();
        if (ED && ED.tid === t.id) {
            const xml = ED.xml(), a = LSHDraftingDocx.auditXml(xml);
            persist(t, ED);
            return { blob: await LSHDraftingDocx.pack(ED.bytes, xml), highlighted: a.highlighted.length, editor: true };
        }
        const out = await LSHDraftingDocx.fill(await templateBytes(t), answersFor(t));
        return Object.assign(out, { editor: false });
    },
    async download() {
        const t = tpl();
        try {
            const out = await API.build();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(out.blob);
            a.download = fileName(t) + '.docx';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            // Highlighted text still in it goes out highlighted, so say so rather than letting it go quietly.
            if (out.editor) {
                if (ED) ED.unsaved(out.highlighted ? `Downloaded — ${out.highlighted} highlighted piece${out.highlighted === 1 ? '' : 's'} still in it` : 'Downloaded');
            } else {
                alert(out.missing.length
                    ? `Downloaded. ${out.filled} of ${out.total} blanks are filled — the ${out.missing.length} still empty stay highlighted in yellow in the letter.`
                    : `Downloaded. All ${out.total} blanks are filled.`);
            }
        } catch (e) {
            alert('The letter could not be built: ' + e.message);
        }
    },
    async submit() {
        const t = tpl();
        // A MedLOR is graded with its HIPAA: the letter, and the HIPAA's three done the firm's way.
        const hip = isMedlor(t) ? HIPAA_FIELDS.map(f => ({ field: f.label, answer: hipaaVal(t, f.id), correct: f.ok(hipaaVal(t, f.id)) })) : null;
        const hipOk = hip ? hip.filter(h => h.correct).length : 0;
        const res = ED && ED.tid === t.id ? await runChecks(t) : null;
        let letterPct, summary, details;
        if (res) {
            showChecks(res);
            const failed = res.checks.filter(c => !c.ok);
            if (failed.length && !confirm(`Check my letter found ${failed.length} thing${failed.length === 1 ? '' : 's'} to fix (${res.score}%). Send it to your trainer anyway?`)) return;
            letterPct = res.score;
            summary = `Check my letter ${res.score}% · ${res.checks.length - failed.length} of ${res.checks.length} checks passed`;
            details = { checks: res.checks.map(c => ({ check: c.label, ok: c.ok, detail: c.detail })), letter: res.text.join('\n').slice(0, 20000) };
        } else {
            const done = doneCount(t), total = theirFields(t).length;
            if (!total) return;
            if (done < total && !confirm(`${total - done} blank${total - done === 1 ? '' : 's'} still empty. Send it to your trainer anyway?`)) return;
            letterPct = done / total * 100;
            summary = `${done} of ${total} blanks filled`;
            details = { answers: answersFor(t) };
        }
        Sim.saveResult({
            simulator: S.tab === 'prov' ? 'Drafting — Medical Provider' : 'Drafting — LOR',
            scenario: S.tab === 'prov' ? `${t.title} · ${t.provider}` : t.title + (CASES.length ? ` · Case ${S.caseNo + 1}` : ''),
            score: Math.round(hip ? (letterPct * 0.7 + hipOk / hip.length * 30) : letterPct),
            summary: summary + (hip ? ` · HIPAA ${hipOk} of ${hip.length} right` + (S.answers[t.id + ':packet'] ? ' · packet built' : ' · packet not built') : ''),
            details: Object.assign({ template: t.id, caseNo: S.tab === 'prov' ? null : S.caseNo + 1, provider: S.tab === 'prov' ? t.provider : null,
                hipaa: hip, packetBuiltAt: hip ? (S.answers[t.id + ':packet'] || null) : null, fileName: fileName(t) + (hip ? '.pdf' : '.docx') }, details)
        });
        alert('Sent to your trainer. Download the Word letter too if you need to upload it to SA.');
    }
};
window.LSHDrafting = API;

document.getElementById('topbar').innerHTML = Sim.topbar('drafting');
Sim.label('Drafting');
// A course can open a given letter: ?tab=lor1p | lor3p | prov, and for the providers' letters ?kind=medlor | lienbv
// (Standard Foundational Training's Provider Communication days open the MedLOR + HIPAA packet this way).
function fromLink() {
    const q = new URLSearchParams(location.search), tab = q.get('tab'), kind = q.get('kind');
    if (q.get('mode') === 'word') S.mode = 'word';
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

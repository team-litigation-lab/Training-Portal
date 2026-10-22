/* Drafting Activities — filing a drafted letter into the case file, and grading the filing.

   The drafting activities (the 1P and 3P Letters of Representation, and a medical provider's lien
   and records-request letters) used to end at a download: the trainee printed or saved the letter
   and filed it by hand, and nothing was graded. A Case Manager's job doesn't end there. The letter
   is a file, and it has to reach the case file in the CMS, under the right tab, named the firm's
   way. This file is that half of the activity — the filing, and the grade for it:

       DraftingDocs.build(opts)         a drafted letter as a document: its kind, client and text
       DraftingDocs.download(doc)       the same as a real PDF (jsPDF), named the firm's way, so a
                                        trainee can still file it into the client's Drive themselves
       DraftingDocs.send(doc, answer)   filed into the case open in the platform the trainee came
                                        from, under the tab they chose, named as they named it
       DraftingDocs.grade(doc, rec)     what the filing scored, saved for the trainer (Sim.saveResult)

   What is graded is the filing itself, in two parts, and neither is corrected quietly:

     • the tab — checked here, before anything leaves the page. A letter in the wrong tab is a letter
       nobody finds, so a wrong one is refused naming the tab the firm actually keeps it in, and the
       document is not sent at all.
     • the name — checked by the CMS, against the firm's one rule (caseFileName in its app.js). A
       wrong one comes back with what is wrong with it, and nothing is filed.

   Every attempt is kept, so a trainer can see who filed it right the first time.

   The file name is the firm's convention, the same one the Medical Records Requests simulator
   produces (simulators/records-docs.js) and the same one the CMS checks:

       <Case ID>_<Last-First>_<Type>_<YYYY-MM-DD>.pdf

   The Type is the Doc Hub tab the letter is filed under, so a name produced here is a name the CMS
   accepts. The naming and the destination are written out again here rather than shared with
   records-docs.js, which is live: .github/scripts/drafting-docs.cjs checks the two produce the same
   name for the same inputs, so they cannot drift apart without a test failing.

   Where it goes: the trainee opens the activity from the Case Management course or from Standard
   Foundational Training, and a letter belongs to the case file on whichever one that is. DESTS reads
   it from ?from= / ?program= (the courses already open their tools that way) and takes the Case ID
   from ?case= or from what the trainee types.

   ⬇ Download PDF stays beside the upload and is never graded: a trainee needs the file itself for
   the client's Drive, and nothing about keeping a copy is a mistake. */
const DraftingDocs = (function () {
const E = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mdy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? `${m[2]}/${m[3]}/${m[1]}` : String(iso || ''); };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* ---------- the letters, and the tab the firm keeps each one in ----------
   Read from the case documents each letter belongs with, so a drafted letter lands in the tab a
   trainee already knows it from: the carriers' and the lien holders' correspondence is Others (as
   the declarations pages, the lien itemizations and the payoff letters are), and anything addressed
   to a provider about records is Medical Records (as the records themselves are). */
const KINDS = {
    lor1p:  { title: 'Letter of Representation — 1P carrier', category: 'Others' },
    lor3p:  { title: 'Letter of Representation with Affidavit — 3P carrier', category: 'Others' },
    lienbv: { title: 'Lien Balance Verification', category: 'Others' },
    medlor: { title: 'Medical LOR with Unsworn Declaration', category: 'Medical Records' },
    hitech: { title: 'HITECH Records Request', category: 'Medical Records' }
};
/* The Doc Hub tabs in the CMS, for the picker a trainee chooses from. The whole list, not only the
   tabs these letters use: choosing the right one out of all of them is the thing being learned. */
const TABS = ['Intake Documents', 'Medical Records', 'Police Report', 'Case Files', 'Invoices', 'Bills',
    'Property Damage', 'Litigation Documents', 'Others'];
const category = (kind) => (KINDS[kind] || {}).category || 'Others';
const titleOf = (kind) => (KINDS[kind] || {}).title || 'Drafted letter';

/* ---------- where the trainee came from ----------
   Each platform keeps its own case file; a letter drafted from one belongs there. The key comes from
   ?from= (the courses open their tools with it) or ?program=, and an unknown launcher is the Portal
   itself, where there is nothing to file into and the download still works. */
const DESTS = {
    cms:    { key: 'cms',    name: 'the CMS Platform', url: 'https://lshcasemanagementtraining-trainingcrm.pages.dev/?program=cm&from=cm',
              files: 'the case\'s Doc Hub', wired: true },
    cm:     { key: 'cm',     name: 'Case Management Training', url: 'https://case-management-training.legalsupporthelp.workers.dev/',
              files: 'the Doc Hub of your case in the CMS beside the lesson', wired: true },
    ft:     { key: 'ft',     name: 'Standard Foundational Training', url: 'https://foundational-training.legalsupporthelp.workers.dev/',
              files: 'the Doc Hub of your case in the CMS beside the lesson', wired: true },
    portal: { key: 'portal', name: 'the LSH Training Portal', url: '/simulators.html', files: 'your own case file', wired: false }
};
// what each course calls itself when it opens a tool (?program=CM, ?program=FT, …)
const BY_PROGRAM = { cm: 'cm', 'case management': 'cm', ft: 'ft', standard: 'ft', foundational: 'ft', cms: 'cms' };
const CASE_KEY = 'LSH_DRAFTING_DEST_V1';

function dest() {
    const q = new URLSearchParams(location.search);
    const raw = (q.get('from') || q.get('dest') || q.get('program') || '').trim().toLowerCase();
    const key = DESTS[raw] ? raw : (BY_PROGRAM[raw] || 'portal');
    const d = Object.assign({}, DESTS[key]);
    // The Case ID: what the launcher passed, else what the trainee typed here before.
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(CASE_KEY) || 'null'); } catch (e) { /* first visit */ }
    d.caseId = (q.get('case') || q.get('caseId') || '').trim() || ((saved && saved.key === key && saved.caseId) || '');
    d.fromUrl = q.get('return') || d.url;
    return d;
}
function setCaseId(id) {
    const d = dest();
    try { localStorage.setItem(CASE_KEY, JSON.stringify({ key: d.key, caseId: String(id || '').trim() })); } catch (e) { /* private window */ }
}

/* ---------- the firm's file name ----------
   The same parts, slugged the same way, as the CMS's caseFileName. The date is the real day it is
   filed, because that is what the name records. */
const part = (v, max) => String(v || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max || 40).replace(/-+$/, '');
function lastFirst(name) {
    const words = String(name || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    while (words.length > 1 && /^(jr|sr|ii|iii|iv)\.?$/i.test(words[words.length - 1])) words.pop();
    return words.length ? part([words[words.length - 1]].concat(words.slice(0, -1)).join(' ')) : 'No-Client-Name';
}
function fileName(doc) {
    const id = String(doc.caseId || '').trim();
    const caseId = /\d/.test(id) && /^[A-Za-z0-9-]+$/.test(id) ? part(id) : 'NO-CASE-ID';
    return [caseId, lastFirst(doc.client && doc.client.name), part(category(doc.kind)), today()].join('_') + '.pdf';
}
// The pattern itself, to show a trainee what is expected without naming the file for them.
function pattern(doc) {
    const id = String((doc && doc.caseId) || '').trim();
    return `${id || '<Case ID>'}_<Last-First>_<Type>_${today()}.pdf`;
}

/* ---------- a drafted letter as a document ----------
   The tool draws and saves the letter itself; what arrives here is its text, line by line, the same
   lines the download is made from, so the file that is filed is the letter the trainee drafted. */
function build(opts) {
    const o = opts || {}, d = dest();
    const doc = {
        kind: o.kind, title: o.title || titleOf(o.kind), category: category(o.kind),
        client: { name: (o.client && o.client.name) || '', dol: (o.client && o.client.dol) || '', file: (o.client && o.client.file) || '' },
        recipient: o.recipient || '', drafter: o.drafter || '',
        lines: (o.lines || []).slice(), draftedOn: o.draftedOn || today(),
        caseId: o.caseId || d.caseId, dest: d
    };
    doc.name = fileName(doc);
    return doc;
}

/* ---------- the letter on paper, and the same letter as a PDF ---------- */
function html(doc) {
    return `<div class="dfd-paper">
    <div class="dfd-title">${E(doc.title)}</div>
    ${doc.recipient ? `<div class="dfd-to">${E(doc.recipient)}</div>` : ''}
    ${doc.lines.map(l => String(l).trim() ? `<p>${E(l)}</p>` : '<p class="dfd-gap">&nbsp;</p>').join('')}
    <div class="dfd-foot">Drafted on ${E(mdy(doc.draftedOn))}${doc.drafter ? ` by ${E(doc.drafter)}` : ''}. Training document — fictional parties, not a real record.</div>
</div>`;
}
const JS = () => (window.jspdf && window.jspdf.jsPDF) || null;
// jsPDF's standard fonts draw Latin-1: straighten the typography, drop what can't be drawn.
const ascii = (x) => String(x == null ? '' : x).replace(/[   ]/g, ' ').replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
    .replace(/☐/g, '[  ]').replace(/[☒☑]/g, '[X]').replace(/[^\x20-\x7e\xa1-\xff\n]/g, '');
function pdfDoc(doc) {
    const J = JS(); if (!J) return null;
    const p = new J({ unit: 'pt', format: 'letter' }), W = 612, M = 54; let y = 56;
    const page = (need) => { if (y + need > 742) { p.addPage(); y = 56; } };
    const line = (s, size, bold, color) => { p.setFont('times', bold ? 'bold' : 'normal'); p.setFontSize(size);
        p.setTextColor.apply(p, color || [31, 31, 31]);
        p.splitTextToSize(ascii(s), W - 2 * M).forEach(l => { page(size + 4); p.text(l, M, y); y += size + 4; }); };

    line(doc.title, 12.5, true, [20, 33, 61]);
    if (doc.recipient) line(doc.recipient, 10.5, false, [100, 116, 139]);
    y += 8; page(10); p.setDrawColor(203, 213, 225); p.line(M, y, W - M, y); y += 14;
    // the letter as drafted: a blank line stays a blank line, so the block layout survives
    doc.lines.forEach(l => { if (!String(l).trim()) { y += 11; return; } line(l, 11, false); y += 4; });
    y += 10; page(10); p.setDrawColor(203, 213, 225); p.line(M, y, W - M, y); y += 12;
    line(`Drafted on ${mdy(doc.draftedOn)}${doc.drafter ? ' by ' + doc.drafter : ''}. Training document - fictional parties, not a real record.`,
        8.5, false, [100, 116, 139]);
    return p;
}
function download(doc, onError) {
    const p = pdfDoc(doc);
    if (!p) { (onError || alert)('The PDF maker didn\'t load. Reload the page and try the download again.'); return false; }
    p.save(doc.name);
    return true;
}

/* ---------- the tab: checked here, before anything is sent ----------
   Returns the problems with what the trainee chose, or an empty list when there are none. */
function check(doc, answer) {
    const a = answer || {}, tab = String(a.tab || '').trim(), problems = [];
    if (!doc.caseId) problems.push('No case is open, so there is nothing to file into. Open your client\'s case file first, or enter its Case ID.');
    if (!tab) problems.push('Choose the CMS tab you would file this letter under.');
    else if (tab !== doc.category) problems.push(`The firm files this letter under ${doc.category}, not ${tab}. A letter in the wrong tab is a letter nobody finds.`);
    if (!String(a.name || '').trim()) problems.push(`Write the file name, in the firm's convention: ${pattern(doc)}`);
    return problems;
}

/* ---------- filing it into the case file the trainee came from ----------
   The platform that opened this activity frames or opens it, so it is window.parent (⧉ Side by side,
   the course's tool frame) or window.opener (New tab). Either way it is asked in the CMS's own
   protocol — {lsh:'cms-doc-file', name, category, bytes} answered with {lsh:'cms-doc-filed'} — so a
   platform that already files the course's documents files this one with nothing new to learn.
   Nobody listening is not a wrong answer: it is not counted as an attempt, and the trainee downloads
   the letter and adds it on Files themselves. */
const NO_LISTENER = 'nothing-listening';
function targets() {
    const out = [];
    try { if (window.parent && window.parent !== window) out.push(window.parent); } catch (e) { /* cross-origin */ }
    try { if (window.opener && window.opener !== window) out.push(window.opener); } catch (e) { /* cross-origin */ }
    return out;
}
const canSend = () => targets().length > 0;
function send(doc, answer) {
    const a = answer || {}, problems = check(doc, a);
    // the tab and the name are the trainee's answer: a wrong one is refused, and nothing is sent
    if (problems.length) return Promise.resolve({ ok: false, graded: true, problems });
    const p = pdfDoc(doc);
    if (!p) return Promise.resolve({ ok: false, error: 'The PDF maker didn\'t load. Reload the page and try again.' });
    const bytes = p.output('arraybuffer');
    const to = targets();
    if (!to.length) return Promise.resolve({ ok: false, reason: NO_LISTENER,
        error: `This activity wasn't opened from ${doc.dest.name}, so there is nowhere to file it. Download the letter and add it on ${doc.dest.files}.` });
    const id = 'dfd' + Math.random().toString(36).slice(2, 10);
    const name = String(a.name).trim(), tab = String(a.tab).trim();
    const msg = { lsh: 'cms-doc-file', id, name, category: tab, original: doc.name,
        mime: 'application/pdf', summary: doc.title, bytes };
    return new Promise(res => {
        let done = false;
        const on = (e) => { if (!e.data || e.data.lsh !== 'cms-doc-filed' || e.data.id !== id) return;
            done = true; window.removeEventListener('message', on);
            // the CMS has the last word on the name: its answer is the grade for that half
            res(Object.assign({ graded: true, problems: [] }, e.data));
        };
        window.addEventListener('message', on);
        // The bytes are transferred, so each target needs its own copy.
        to.forEach(w => { try { w.postMessage(Object.assign({}, msg, { bytes: bytes.slice(0) }), '*'); } catch (err) { /* that one can't be reached */ } });
        setTimeout(() => { if (done) return; window.removeEventListener('message', on);
            res({ ok: false, reason: NO_LISTENER, error: `${doc.dest.name} didn't answer. Is your own case open in it? You can download the letter and add it on ${doc.dest.files} instead.` }); }, 20000);
    });
}

/* ---------- the grade ----------
   The filing is worth what it took to get right: filed the first time is the whole mark, and each
   refused attempt costs a fifth, down to a floor — a letter filed in the end is worth more than a
   letter never filed. An attempt that found nobody listening is not the trainee's mistake and is
   never counted (send returns NO_LISTENER without grading). Saved through the Portal's own channel,
   so it reaches the trainer and, for a trainee who came from a course, that course's scorecard. */
function score(rec) {
    const r = rec || {}, tries = Math.max(1, Number(r.attempts || 1));
    if (!r.filed) return 0;
    return Math.max(40, 100 - (tries - 1) * 20);
}
function grade(doc, rec) {
    const r = rec || {}, s = score(r);
    const g = {
        simulator: 'Document Filing',
        scenario: `${doc.title} · ${doc.category}`,
        score: s,
        summary: r.filed
            ? `Filed as ${r.name} under ${r.category || doc.category} in ${r.attempts} attempt(s)${r.attempts === 1 ? ' — first time right' : ''}.`
            : 'Not filed in the CMS.',
        details: { kind: doc.kind, tab: doc.category, chose: r.category || '', name: r.name || '',
                   attempts: r.attempts || 0, filed: !!r.filed, caseId: doc.caseId || '', at: new Date().toISOString() }
    };
    return g;
}
async function saveGrade(doc, rec) {
    const g = grade(doc, rec);
    if (typeof Sim === 'object' && Sim && typeof Sim.saveResult === 'function') {
        try { await Sim.saveResult(g); } catch (e) { /* best effort: the record stays on the page */ }
    }
    return g;
}

const css = `
.dfd-paper { border: 1px solid #cbd5e1; border-radius: 10px; background: #fffdf8; padding: 18px 20px; font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 1.55; }
.dfd-title { text-align: center; font-weight: 800; letter-spacing: .05em; font-size: 13px; margin: 0 0 10px; padding: 6px 0; border-top: 2px solid var(--navy); border-bottom: 2px solid var(--navy); font-family: 'IBM Plex Sans', sans-serif; }
.dfd-to { font-family: 'IBM Plex Sans', sans-serif; font-size: 12.5px; color: var(--slate); margin: 0 0 10px; }
.dfd-paper p { margin: 0 0 7px; } .dfd-paper p.dfd-gap { margin: 0; }
.dfd-foot { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-family: 'IBM Plex Sans', sans-serif; font-size: 11px; color: var(--slate); }
/* the filing: the tab, the name, and what came back */
.dfd-file { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 14px; font-size: 13px; }
.dfd-file h4 { margin: 0 0 4px; font-size: 13.5px; }
.dfd-file code { font-size: 12px; background: #fff; border: 1px solid #dbeafe; border-radius: 5px; padding: 1px 5px; overflow-wrap: anywhere; }
.dfd-fields { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 10px 0 0; }
.dfd-fields select, .dfd-fields input { font: inherit; padding: 5px 9px; border: 1px solid #bfdbfe; border-radius: 8px; min-width: 0; background: #fff; }
.dfd-fields input { flex: 1 1 260px; }
.dfd-acts { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 10px 0 2px; }
.dfd-msg { font-size: 12.5px; margin: 8px 0 0; } .dfd-msg.ok { color: var(--ok); font-weight: 600; } .dfd-msg.bad { color: var(--bad); }
.dfd-bad ul { margin: 4px 0 0; padding-left: 18px; } .dfd-bad li { margin: 3px 0; }
@media (max-width: 560px) { .dfd-paper { padding: 14px; } .dfd-fields input { flex: 1 1 100%; } }
`;

return { KINDS, TABS, DESTS, dest, setCaseId, category, titleOf, fileName, pattern, build, html, pdfDoc,
         download, check, send, canSend, score, grade, saveGrade, NO_LISTENER, css, mdy, today, lastFirst, part };
})();

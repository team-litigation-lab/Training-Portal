/* Medical Records Requests — the documents a provider actually produces, and where they go.

   The simulator used to show what came back as a line of prose. A Case Manager's job doesn't end
   at reading it: the records and the itemized bill are files, and they have to end up in the case
   file, named the firm's way. So when a request is produced, this file builds the document itself —
   a provider's chart production and an itemized billing statement, on the patient's identifiers,
   with the custodian's certification — and hands it over three ways:

       MRDocs.view(doc)        the document on paper, read in the page
       MRDocs.download(doc)    the same as a real PDF (jsPDF), named the firm's way, so the trainee
                               can add it on the case file's Files themselves
       MRDocs.send(doc)        filed straight into the case open in the platform the trainee came
                               from, when that platform is listening (the CMS's own cms-doc-file
                               protocol, course-bridge.js); otherwise it says to use the download

   Where it goes: the trainee opens this simulator from the CMS Platform, from the Case Management
   course or from the Medical Summary & Demand course, and a request belongs to the case file on
   whichever one that is. DESTS reads it from ?from= / ?program= (the courses already open their
   tools that way), takes the Case ID from ?case= or from what the trainee types, and names every
   file in the firm's convention for it:

       <Case ID>_<Last-First>_<Type>_<YYYY-MM-DD>.pdf

   The Type is the Doc Hub category the document is filed under (Medical Records, Bills), so the
   name the CMS checks (caseFileName in its app.js — the one source of truth) is the name this
   produces. Nothing here scores: production is production. */
const MRDocs = (function () {
const E = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mdy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? `${m[2]}/${m[3]}/${m[1]}` : String(iso || ''); };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* ---------- where the trainee came from ----------
   Each platform keeps its own case file; a request made from one belongs there. The key comes from
   ?from= (the CMS and the courses open their tools with it) or ?program=, and nothing else changes:
   an unknown launcher is the Portal itself, and the download still works. */
const DESTS = {
    cms:    { key: 'cms',    name: 'the CMS Platform', url: 'https://lshcasemanagementtraining-trainingcrm.pages.dev/?program=cm&from=cm',
              files: 'the case\'s Doc Hub (records under Medical Records, bills under Bills)', wired: true },
    cm:     { key: 'cm',     name: 'Case Management Training', url: 'https://case-management-training.legalsupporthelp.workers.dev/',
              files: 'the Doc Hub of your case in the CMS beside the lesson', wired: true },
    md:     { key: 'md',     name: 'Medical Summary & Demand Training', url: 'https://medsumanddemandtraining.legalsupporthelp.workers.dev/',
              files: 'the Doc Hub of your case in the CMS (records under Medical Records, bills under Bills), and your case folder in Drive', wired: false },
    portal: { key: 'portal', name: 'the LSH Training Portal', url: '/simulators.html', files: 'your own case file', wired: false }
};
// what each program's course calls itself when it opens a tool (?program=CM, ?program=md, …)
const BY_PROGRAM = { cm: 'cm', 'case management': 'cm', md: 'md', medsum: 'md', 'medsum and demand': 'md', cms: 'cms' };
const CASE_KEY = 'LSH_RECORDS_DEST_V1';

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
   The same parts, slugged the same way, as the CMS's caseFileName: a name produced here is a name
   the CMS accepts. The date is the real day it is produced, because that is the day it is filed. */
const part = (v, max) => String(v || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max || 40).replace(/-+$/, '');
function lastFirst(name) {
    const words = String(name || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    while (words.length > 1 && /^(jr|sr|ii|iii|iv)\.?$/i.test(words[words.length - 1])) words.pop();
    return words.length ? part([words[words.length - 1]].concat(words.slice(0, -1)).join(' ')) : 'No-Client-Name';
}
// The Doc Hub category each production is filed under: the Type in the name is that category.
const CATEGORY = { records: 'Medical Records', psych: 'Medical Records', images: 'Medical Records', cert: 'Medical Records', bill: 'Bills' };
const category = (kind) => CATEGORY[kind] || 'Medical Records';
function fileName(doc) {
    const id = String(doc.caseId || '').trim();
    const caseId = /\d/.test(id) && /^[A-Za-z0-9-]+$/.test(id) ? part(id) : 'NO-CASE-ID';
    return [caseId, lastFirst(doc.patient.name), part(category(doc.kind)), today()].join('_') + '.pdf';
}

/* ---------- building the document ----------
   The provider's own production, from the scenario's chart and ledger. Records come out as chart
   entries (the delivered text, one entry a clause, which is how the chart reads); a bill comes out
   as the itemized lines the provider billed, with the CPT codes and the charges, and totals to the
   figure the ledger shows. Everything else — the identifiers, the dates of service, the page count,
   the custodian's certification — is what makes a production a production. */
const TITLES = {
    records: 'CERTIFIED MEDICAL RECORDS PRODUCTION', bill: 'ITEMIZED BILLING STATEMENT',
    images: 'DIAGNOSTIC IMAGING PRODUCTION (DICOM)', psych: 'PSYCHOTHERAPY NOTES PRODUCTION',
    cert: 'CERTIFICATION OF RECORDS (CUSTODIAN AFFIDAVIT)'
};
function build(opts) {
    const { request, kind, provider, scenario, delivered, producedOn } = opts;
    const c = scenario.client, d = dest();
    const doc = {
        kind, reqNo: request.no, title: TITLES[kind] || 'RECORDS PRODUCTION',
        provider: { name: provider.name, dept: provider.dept, method: provider.method, type: provider.type },
        patient: { name: c.name, dob: c.dob, dol: c.dol, file: c.file, address: c.address },
        dosFrom: request.dosFrom, dosTo: request.dosTo, producedOn: producedOn,
        pages: delivered.pages || 1, caseId: d.caseId, dest: d, category: category(kind),
        entries: [], bill: null, certified: request.types.indexOf('cert') >= 0 || kind === 'cert'
    };
    const lines = (delivered.lines || []).slice();
    if (kind === 'bill' && lines.length) {
        const total = lines.reduce((a, x) => a + Number(x.amount || 0), 0);
        doc.bill = { lines, total, note: delivered.note || '' };
    } else {
        // the chart as it reads: one entry a clause, which is how the delivered chart is written
        doc.entries = String(delivered.text || '').split(/;\s+(?=[A-Z0-9(])/).map(s => s.trim()).filter(Boolean);
        if (!doc.entries.length) doc.entries = [String(delivered.text || '').trim() || 'No further detail produced.'];
        if (delivered.note) doc.entries.push(delivered.note);
    }
    doc.name = fileName(doc);
    return doc;
}

/* ---------- the document on paper ---------- */
function html(doc) {
    const head = (k, v) => `<div><span class="mrd-k">${E(k)}</span>${E(v)}</div>`;
    return `<div class="mrd-paper">
    <div class="mrd-prov">${E(doc.provider.name)}<small>${E(doc.provider.dept)} · ${E(doc.provider.type)}</small></div>
    <div class="mrd-title">${E(doc.title)}</div>
    <div class="mrd-grid">
        ${head('Patient', doc.patient.name)}${head('Date of birth', mdy(doc.patient.dob))}
        ${head('Date of loss', mdy(doc.patient.dol))}${head('Firm file', doc.patient.file)}
        ${head('Dates of service', `${mdy(doc.dosFrom)} – ${mdy(doc.dosTo)}`)}${head('Produced', mdy(doc.producedOn))}
        ${head('In response to', doc.reqNo)}${head('Pages', String(doc.pages))}
    </div>
    ${doc.bill ? billHtml(doc) : `<div class="mrd-h">Chart produced</div><ol class="mrd-entries">${doc.entries.map(x => `<li>${E(x)}</li>`).join('')}</ol>`}
    ${doc.certified ? `<div class="mrd-cert"><b>CERTIFICATION OF CUSTODIAN OF RECORDS.</b> I am the custodian of records for
        ${E(doc.provider.name)}. I caused a complete search of the records held for the patient and dates of service above,
        and the ${doc.pages} page(s) produced with this certificate are a true and complete copy of those records, made in the
        regular course of business at or near the time of the acts recorded.
        <div class="mrd-sign"><span>/s/ Custodian of Records</span><span>Date: ${E(mdy(doc.producedOn))}</span></div></div>` : ''}
    <div class="mrd-foot">Released to LSH Partner Firm under the patient's signed HIPAA authorization. Protected health
        information: handle under the firm's confidentiality rules. Training document — not a real patient record.</div>
</div>`;
}
function billHtml(doc) {
    return `<div class="mrd-h">Itemized charges</div>
    <table class="mrd-bill"><thead><tr><th>Date of service</th><th>Code</th><th>Description</th><th class="r">Charge</th></tr></thead><tbody>
    ${doc.bill.lines.map(l => `<tr><td class="mono">${E(mdy(l.dos))}</td><td class="mono">${E(l.code || '—')}</td><td>${E(l.desc)}</td><td class="r mono">${E(money(l.amount))}</td></tr>`).join('')}
    </tbody><tfoot><tr><th colspan="3">Total charges</th><th class="r mono">${E(money(doc.bill.total))}</th></tr></tfoot></table>
    ${doc.bill.note ? `<p class="mrd-note">${E(doc.bill.note)}</p>` : ''}`;
}

/* ---------- the same document as a PDF ---------- */
const JS = () => (window.jspdf && window.jspdf.jsPDF) || null;
// jsPDF's standard fonts draw Latin-1: straighten the typography, drop what can't be drawn.
const ascii = (x) => String(x == null ? '' : x).replace(/[   ]/g, ' ').replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7e\xa1-\xff\n]/g, '');
function pdfDoc(doc) {
    const J = JS(); if (!J) return null;
    const p = new J({ unit: 'pt', format: 'letter' }), W = 612, M = 54; let y = 56;
    const page = (need) => { if (y + need > 742) { p.addPage(); y = 56; } };
    const line = (s, size, bold, color, indent) => { p.setFont('helvetica', bold ? 'bold' : 'normal'); p.setFontSize(size);
        p.setTextColor.apply(p, color || [31, 31, 31]);
        p.splitTextToSize(ascii(s), W - 2 * M - (indent || 0)).forEach(l => { page(size + 4); p.text(l, M + (indent || 0), y); y += size + 4; }); };
    const rule = () => { page(10); p.setDrawColor(203, 213, 225); p.line(M, y, W - M, y); y += 12; };

    line(doc.provider.name, 13, true, [20, 33, 61]);
    line(`${doc.provider.dept} · ${doc.provider.type}`, 9.5, false, [100, 116, 139]);
    y += 6; line(doc.title, 12.5, true, [11, 87, 208]); y += 2; rule();
    const pairs = [['Patient', doc.patient.name], ['Date of birth', mdy(doc.patient.dob)], ['Date of loss', mdy(doc.patient.dol)],
        ['Firm file', doc.patient.file], ['Dates of service', `${mdy(doc.dosFrom)} - ${mdy(doc.dosTo)}`],
        ['Produced', mdy(doc.producedOn)], ['In response to', doc.reqNo], ['Pages', String(doc.pages)]];
    pairs.forEach(([k, v]) => { page(14); p.setFont('helvetica', 'bold'); p.setFontSize(9.5); p.setTextColor(100, 116, 139);
        p.text(ascii(k.toUpperCase()), M, y); p.setFont('helvetica', 'normal'); p.setFontSize(10.5); p.setTextColor(31, 31, 31);
        p.text(ascii(v), M + 110, y); y += 15; });
    rule();

    if (doc.bill) {
        line('Itemized charges', 11.5, true, [20, 33, 61]); y += 4;
        const col = [M, M + 78, M + 150, W - M];
        page(16); p.setFont('helvetica', 'bold'); p.setFontSize(9); p.setTextColor(100, 116, 139);
        p.text('DATE OF SERVICE', col[0], y); p.text('CODE', col[1], y); p.text('DESCRIPTION', col[2], y);
        p.text('CHARGE', col[3], y, { align: 'right' }); y += 12;
        doc.bill.lines.forEach(l => {
            p.setFont('helvetica', 'normal'); p.setFontSize(10); p.setTextColor(31, 31, 31);
            const wrapped = p.splitTextToSize(ascii(l.desc), col[3] - col[2] - 70);
            page(wrapped.length * 13 + 4);
            p.text(ascii(mdy(l.dos)), col[0], y); p.text(ascii(l.code || '-'), col[1], y);
            p.text(ascii(money(l.amount)), col[3], y, { align: 'right' });
            wrapped.forEach((w, i) => p.text(w, col[2], y + i * 13)); y += wrapped.length * 13 + 3;
        });
        y += 2; rule();
        page(16); p.setFont('helvetica', 'bold'); p.setFontSize(11); p.setTextColor(20, 33, 61);
        p.text('TOTAL CHARGES', col[0], y); p.text(ascii(money(doc.bill.total)), col[3], y, { align: 'right' }); y += 18;
        if (doc.bill.note) { line(doc.bill.note, 9.5, false, [100, 116, 139]); }
    } else {
        line('Chart produced', 11.5, true, [20, 33, 61]); y += 4;
        doc.entries.forEach((x, i) => { page(16); p.setFont('helvetica', 'bold'); p.setFontSize(10); p.setTextColor(11, 87, 208);
            p.text(String(i + 1) + '.', M, y); line(x, 10.5, false, [31, 31, 31], 20); y += 3; });
    }
    if (doc.certified) {
        y += 8; rule(); line('CERTIFICATION OF CUSTODIAN OF RECORDS', 10, true, [20, 33, 61]);
        line(`I am the custodian of records for ${doc.provider.name}. I caused a complete search of the records held for the `
            + `patient and dates of service above, and the ${doc.pages} page(s) produced with this certificate are a true and `
            + 'complete copy of those records, made in the regular course of business at or near the time of the acts recorded.', 9.5);
        y += 6; line('/s/ Custodian of Records', 10, true); line('Date: ' + mdy(doc.producedOn), 9.5, false, [100, 116, 139]);
    }
    y += 10; rule();
    line('Released to LSH Partner Firm under the patient\'s signed HIPAA authorization. Protected health information: handle '
        + 'under the firm\'s confidentiality rules. Training document - not a real patient record.', 8.5, false, [100, 116, 139]);
    return p;
}
function download(doc, onError) {
    const p = pdfDoc(doc);
    if (!p) { (onError || alert)('The PDF maker didn\'t load. Reload the page and try the download again.'); return false; }
    p.save(doc.name);
    return true;
}

/* ---------- filing it into the case file the trainee came from ----------
   The platform that opened this simulator frames or opens it, so it is window.parent (⧉ Side by side,
   the course's tool frame) or window.opener (New tab). Either way it is asked in the CMS's own
   protocol — {lsh:'cms-doc-file', name, category, bytes} answered with {lsh:'cms-doc-filed'} — so a
   platform that already files the course's documents files this one with nothing new to learn.
   Nobody listening is not a failure: the trainee downloads it and adds it on Files themselves. */
const NO_LISTENER = 'nothing-listening';
function targets() {
    const out = [];
    try { if (window.parent && window.parent !== window) out.push(window.parent); } catch (e) { /* cross-origin */ }
    try { if (window.opener && window.opener !== window) out.push(window.opener); } catch (e) { /* cross-origin */ }
    return out;
}
const canSend = () => targets().length > 0;
function send(doc) {
    const p = pdfDoc(doc);
    if (!p) return Promise.resolve({ ok: false, error: 'The PDF maker didn\'t load. Reload the page and try again.' });
    const bytes = p.output('arraybuffer');
    const to = targets();
    if (!to.length) return Promise.resolve({ ok: false, reason: NO_LISTENER,
        error: `This simulator wasn't opened from ${doc.dest.name}, so there is nowhere to file it. Download it and add it on ${doc.dest.files}.` });
    const id = 'mrd' + Math.random().toString(36).slice(2, 10);
    const msg = { lsh: 'cms-doc-file', id, name: doc.name, category: doc.category, original: doc.name,
        mime: 'application/pdf', summary: `${doc.title.toLowerCase().replace(/^./, c => c.toUpperCase())} — ${doc.provider.name} (${doc.reqNo})`, bytes };
    return new Promise(res => {
        let done = false;
        const on = (e) => { if (!e.data || e.data.lsh !== 'cms-doc-filed' || e.data.id !== id) return;
            done = true; window.removeEventListener('message', on); res(e.data); };
        window.addEventListener('message', on);
        // The bytes are transferred, so each target needs its own copy.
        to.forEach(w => { try { w.postMessage(Object.assign({}, msg, { bytes: bytes.slice(0) }), '*'); } catch (err) { /* that one can't be reached */ } });
        setTimeout(() => { if (done) return; window.removeEventListener('message', on);
            res({ ok: false, reason: NO_LISTENER, error: `${doc.dest.name} didn't answer. Is your own case open in it? You can download the file and add it on ${doc.dest.files} instead.` }); }, 20000);
    });
}

const css = `
.mrd-paper { border: 1px solid #cbd5e1; border-radius: 10px; background: #fffdf8; padding: 18px 20px; font-family: Georgia, 'Times New Roman', serif; font-size: 13px; line-height: 1.55; }
.mrd-prov { font-weight: 800; font-size: 15px; color: var(--navy); } .mrd-prov small { display: block; font-weight: 400; font-size: 11.5px; color: var(--slate); font-family: 'IBM Plex Sans', sans-serif; }
.mrd-title { text-align: center; font-weight: 800; letter-spacing: .05em; font-size: 13px; margin: 12px 0 10px; padding: 6px 0; border-top: 2px solid var(--navy); border-bottom: 2px solid var(--navy); }
.mrd-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 2px 18px; font-family: 'IBM Plex Sans', sans-serif; font-size: 12.5px; }
.mrd-k { display: block; font-size: 9.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--slate); }
.mrd-grid > div { padding: 4px 0; }
.mrd-h { font-family: 'IBM Plex Sans', sans-serif; font-weight: 800; font-size: 12.5px; color: var(--navy); margin: 14px 0 6px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
.mrd-entries { margin: 0; padding-left: 20px; } .mrd-entries li { margin: 5px 0; }
.mrd-bill { width: 100%; border-collapse: collapse; font-family: 'IBM Plex Sans', sans-serif; font-size: 12.5px; }
.mrd-bill th, .mrd-bill td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
.mrd-bill thead th { font-size: 9.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--slate); }
.mrd-bill tfoot th { border-top: 2px solid var(--navy); border-bottom: none; font-size: 13px; color: var(--navy); }
.mrd-bill .r { text-align: right; } .mrd-note { font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; color: var(--slate); margin: 8px 0 0; }
.mrd-cert { margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 12px; }
.mrd-sign { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 10px; font-weight: 700; }
.mrd-foot { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-family: 'IBM Plex Sans', sans-serif; font-size: 11px; color: var(--slate); }
.mrd-acts { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 10px 0 2px; }
.mrd-msg { font-size: 12.5px; margin: 6px 0 0; } .mrd-msg.ok { color: var(--ok); font-weight: 600; } .mrd-msg.bad { color: var(--bad); }
.mrd-dest { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 14px; font-size: 13px; }
.mrd-dest h4 { margin: 0 0 4px; font-size: 13.5px; } .mrd-dest code { font-size: 12px; background: #fff; border: 1px solid #dbeafe; border-radius: 5px; padding: 1px 5px; }
.mrd-dest label { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0 0; font-size: 12.5px; font-weight: 600; }
.mrd-dest input { font: inherit; font-weight: 500; padding: 5px 9px; border: 1px solid #bfdbfe; border-radius: 8px; min-width: 0; flex: 1 1 220px; max-width: 100%; }
/* the example file name wraps: a Case ID and a client's name make it longer than a phone is wide */
.mrd-eg { flex: 1 1 100%; min-width: 0; font-weight: 500; font-size: 12px; } .mrd-eg.ok { color: var(--ok); } .mrd-eg.warn { color: #b45309; }
.mrd-eg code { display: inline-block; max-width: 100%; overflow-wrap: anywhere; word-break: break-all; }
.mrd-dest code, .mrd-dest p { overflow-wrap: anywhere; }
@media (max-width: 560px) { .mrd-paper { padding: 14px; } .mrd-bill th, .mrd-bill td { padding: 5px 4px; } }
`;

return { dest, setCaseId, DESTS, fileName, category, build, html, pdfDoc, download, send, canSend, NO_LISTENER, css, money, mdy, today };
})();

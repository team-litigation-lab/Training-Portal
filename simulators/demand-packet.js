/* ============================================================
   📚 Demand Packets & Binders — the full packet, put together as one PDF.

   A demand never goes out as a letter on its own: the adjuster gets a packet, in a fixed order —
   the cover letter, the index, the demand letter, the PIP log, the medical bills and the medical
   records (and whatever else proves the claim) — and the mediation and arbitration binders are the
   same idea with numbered tabs. This page is where a trainee puts one together:

     • each section takes as many PDFs as it needs (or scans and photos: JPG/PNG become a page each),
       dropped in or chosen, in the order they will be in, and each document is described the way the
       master index lists it (description, date, source, and for a bill its amount);
     • the cover letter and the PIP log can be made here (or a PDF of the trainee's own used instead),
       the index is always made here, from the documents themselves;
     • ⬇ Build the packet merges it all with pdf-lib: page numbers, Bates numbers (DOE 000001 …),
       tab sheets for a binder, bookmarks for every section and document, and the index's page and
       Bates ranges counted from the pages actually in the file. The same build gives each section as
       its own PDF (.zip) and the index as a spreadsheet (.csv).

   ✔ Check my packet grades what the firm checks before a packet leaves (every required section there,
   every document described, the bills' total matching the PIP log, records for every provider billed,
   nothing password-protected, built after the last change); ✓ Send it to my trainer reports that score
   through Sim.saveResult as "Drafting — Demand Packet".

   What the trainee typed is kept in this browser (LSH_PACKET_V1, per trainee); the PDFs themselves are
   kept in this browser's IndexedDB (LSH_PACKET_FILES), so a packet half built is still there tomorrow.
   Nothing is uploaded: the files never leave the trainee's computer.
   ============================================================ */
(function () {
'use strict';

const KEY = 'LSH_PACKET_V1';
const esc = (v) => Sim.esc(String(v == null ? '' : v));
const app = () => document.getElementById('app');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad2 = (n) => String(n).padStart(2, '0');

/* ---------- the three kinds of packet ---------- */
// kind: cover (made here or uploaded), index (always made here), piplog (made here and/or uploaded), docs (uploaded).
// bills: the section's documents carry an amount (they are the bills the PIP log totals); records: the medical records;
// req: the packet isn't complete without something in it.
const sec = (title, kind, more) => Object.assign({ id: uid(), title, kind, docs: [] }, more || {});
const TYPES = {
    demand: {
        name: 'Demand Packet', short: 'Demand packet', tabs: false,
        sections: () => [
            sec('Cover Letter', 'cover'), sec('Index', 'index'),
            sec('Demand Letter', 'docs', { req: true, hint: 'The demand letter, saved as PDF from Word (File › Save As › PDF).' }),
            sec('PIP Log', 'piplog', { req: true }),
            sec('Medical Bills', 'docs', { req: true, bills: true, hint: 'Each provider\'s itemized bill (UB-04, CMS-1500 or the itemized statement), one PDF each.' }),
            sec('Medical Records', 'docs', { req: true, records: true, hint: 'Each provider\'s records, in the order the client was treated.' }),
            sec('Supporting Documents', 'docs', { hint: 'Police report, photos of the vehicles and injuries, wage loss, out-of-pocket receipts.' })
        ]
    },
    mediation: {
        name: 'Mediation Binder', short: 'Mediation binder', tabs: true,
        sections: () => [
            sec('Transmittal Letter', 'cover'), sec('Master Index', 'index'),
            sec('Case Snapshot & Mediation Statement', 'docs', { req: true, hint: 'The snapshot sheet and the confidential mediation statement.' }),
            sec('Liability', 'docs', { req: true, hint: 'Police report, photos, witness statements, the deposition transcript.' }),
            sec('Medical Records', 'docs', { req: true, records: true }),
            sec('Medical Bills & PIP Log', 'piplog', { req: true, bills: true, hint: 'The providers\' final itemized ledgers, after the PIP log.' }),
            sec('Liens & Payments', 'docs', { hint: 'EOBs, the health plan\'s lien and its payoff letter, PIP payment history.' }),
            sec('Correspondence & Offers', 'docs', { hint: 'The demand, the carrier\'s responses and every offer.' })
        ]
    },
    arbitration: {
        name: 'Arbitration Binder', short: 'Arbitration binder', tabs: true,
        sections: () => [
            sec('Transmittal Letter', 'cover'), sec('Master Index', 'index'),
            sec('Coverage & BI Exhaustion', 'docs', { req: true, hint: 'Declarations pages, the BI tender and its release: the exhaustion record leads.' }),
            sec('Liability', 'docs', { req: true }),
            sec('Medical Records', 'docs', { req: true, records: true }),
            sec('Medical Bills & PIP Log', 'piplog', { req: true, bills: true }),
            sec('Damages', 'docs', { hint: 'Wage loss, out-of-pocket costs, the client\'s statement.' }),
            sec('Correspondence & Demands', 'docs', { hint: 'The UM demand, the carrier\'s answers, the arbitration notice.' })
        ]
    }
};

const COVER_BODY = {
    demand: 'This office represents {client} for injuries sustained in the {dol} collision with your insured, {insured}.\n\n'
        + 'Enclosed is our client\'s demand package, with the index on the following page. It contains the demand letter, the PIP log, and the medical bills and records supporting the claim.\n\n'
        + 'Our client hereby demands the policy limits of {limit} in full settlement of this claim. This offer will remain open until {deadline}. If it is not accepted in writing by that date, it is withdrawn.\n\n'
        + 'Please confirm receipt of this package. If you need anything further to evaluate the claim, contact me before the deadline.',
    mediation: 'Enclosed is our mediation binder for {client} v. {insured}, Claim No. {claim}, for the mediation before the mediator. The master index follows this letter; each tab matches its section in the index, and every page is Bates-numbered.\n\n'
        + 'Please contact me if any page is missing or illegible.',
    arbitration: 'Enclosed is our arbitration binder for {client}\'s uninsured/underinsured motorist claim, Claim No. {claim}. The master index follows this letter; each tab matches its section in the index, and every page is Bates-numbered.\n\n'
        + 'Please contact me if any page is missing or illegible.'
};

function freshPacket(type) {
    return {
        case: { caseId: '', client: '', insured: '', claimNo: '', dol: '', carrier: '', adjuster: '', address: '', email: '',
            limit: '', deadline: '', attorney: '', firm: '', firmAddress: '', sender: '' },
        cover: { mode: 'make', body: COVER_BODY[type] },
        pip: { mode: 'make', carrier: '', limit: '10000', rows: [] },
        sections: TYPES[type].sections(),
        opts: { bates: true, prefix: '', start: 1, numbers: true, tabs: TYPES[type].tabs, bookmarks: true },
        changedAt: null, builtAt: null
    };
}

/* ---------- the trainee's packets, in this browser ---------- */
const S = { type: 'demand', packets: {}, built: null, busy: '' };
const slot = () => (Sim.who().name || 'practice').toLowerCase().replace(/\s+/g, ' ').trim();
const P = () => S.packets[S.type] || (S.packets[S.type] = freshPacket(S.type));
function load() {
    try {
        const mine = JSON.parse(localStorage.getItem(KEY) || '{}')[slot()];
        if (mine) { S.type = TYPES[mine.type] ? mine.type : 'demand'; S.packets = mine.packets || {}; }
    } catch (e) { /* a first run, or storage turned off */ }
}
let saveTimer = null;
function save(changed) {
    if (changed !== false) { P().changedAt = new Date().toISOString(); }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            const all = JSON.parse(localStorage.getItem(KEY) || '{}');
            all[slot()] = { type: S.type, packets: S.packets };
            localStorage.setItem(KEY, JSON.stringify(all));
        } catch (e) { /* private window: kept for this visit only */ }
    }, 250);
}

/* ---------- the PDFs themselves, in this browser's IndexedDB ---------- */
const FILES = {};   // doc id → { bytes, type } for this visit (and the copy IndexedDB keeps)
let dbp = null;
function db() {
    if (!dbp) dbp = new Promise((resolve) => {
        try {
            const r = indexedDB.open('LSH_PACKET_FILES', 1);
            r.onupgradeneeded = () => r.result.createObjectStore('files');
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
    });
    return dbp;
}
async function idb(mode, fn) {
    const d = await db(); if (!d) return null;
    return new Promise((resolve) => {
        try {
            const tx = d.transaction('files', mode), req = fn(tx.objectStore('files'));
            tx.oncomplete = () => resolve(req ? req.result : true);
            tx.onerror = tx.onabort = () => resolve(null);
        } catch (e) { resolve(null); }
    });
}
const filePut = (id, f) => { FILES[id] = f; return idb('readwrite', st => st.put(f, id)); };
const fileDel = (id) => { delete FILES[id]; return idb('readwrite', st => st.delete(id)); };
async function fileGet(id) {
    if (FILES[id]) return FILES[id];
    const f = await idb('readonly', st => st.get(id));
    if (f) FILES[id] = f;
    return f || null;
}

/* ---------- reading what the trainee adds ---------- */
const isPdf = (f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);
const isImg = (f) => /^image\/(png|jpe?g)$/i.test(f.type) || /\.(png|jpe?g)$/i.test(f.name);
const describe = (name) => String(name).replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
// A date in the file name (2026-07-14, 07.14.2026, 07-14-26) is usually the document's date.
function dateIn(name) {
    let m = String(name).match(/(20\d\d)[-._](\d\d)[-._](\d\d)/);
    if (m) return `${m[2]}/${m[3]}/${m[1]}`;
    m = String(name).match(/\b(\d\d)[-._](\d\d)[-._](20\d\d|\d\d)\b/);
    if (m) return `${m[1]}/${m[2]}/${m[3].length === 2 ? '20' + m[3] : m[3]}`;
    return '';
}
async function addFiles(secId, list) {
    const s = P().sections.find(x => x.id === secId); if (!s) return;
    const files = Array.from(list || []);
    const bad = files.filter(f => !isPdf(f) && !isImg(f));
    if (bad.length) alert(`Only PDFs and JPG/PNG images can go in a packet. Not added: ${bad.map(f => f.name).join(', ')}.\nA Word file: open it in Word and save it as PDF (File › Save As › PDF).`);
    const ok = files.filter(f => isPdf(f) || isImg(f));
    if (!ok.length) return;
    S.busy = `Reading ${ok.length} file${ok.length === 1 ? '' : 's'}…`; renderSide();
    for (const f of ok) {
        const bytes = await f.arrayBuffer(), d = { id: uid(), file: f.name, kind: isPdf(f) ? 'pdf' : 'img', desc: describe(f.name), date: dateIn(f.name), source: '', amount: '', pages: 1, err: '' };
        if (d.kind === 'pdf') {
            try {
                const doc = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
                d.pages = doc.getPageCount();
                if (doc.isEncrypted) d.err = 'password-protected: save an unlocked copy (Print › Save as PDF) and add that instead';
            } catch (e) { d.err = 'does not read as a PDF'; d.pages = 0; }
        }
        await filePut(d.id, { bytes, type: f.type || (d.kind === 'pdf' ? 'application/pdf' : 'image/jpeg') });
        s.docs.push(d);
    }
    S.busy = ''; save(); render();
}

/* ---------- what the packet is: its sections, numbered, and every part in order ---------- */
const numbered = () => P().sections.filter(s => s.kind !== 'cover' && s.kind !== 'index');
const secNo = (s) => numbered().indexOf(s) + 1;
const exhibit = (s, i) => secNo(s) + '-' + (i + 1);
const coverMade = () => P().cover.mode === 'make';
const pipMade = () => P().pip.mode === 'make';
const money = (v) => { const n = Number(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return isFinite(n) ? n : NaN; };
const usd = (n) => '$' + (isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const todayShort = () => { const d = new Date(); return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`; };
const pipRows = () => P().pip.rows.filter(r => r.provider || r.billed || r.pip);
const pipTot = (k) => pipRows().reduce((a, r) => a + (isFinite(money(r[k])) ? money(r[k]) : 0), 0);
const billDocs = () => P().sections.filter(s => s.bills).flatMap(s => s.docs);
/* ---------- the case file: the Doc Hub tab it goes under, and the firm's one name for it ----------
   The CMS files every document as <Case ID>_<Last-First>_<Type>_<YYYY-MM-DD>.pdf, the Type being its Doc Hub tab, and
   checks that name itself; drafting-docs.js holds that rule (and the platform the trainee came from), so it is used
   from there rather than written again. A demand goes out with the carrier's correspondence (Others, where the course
   keeps the BI and UM demands); a binder is a litigation document (Litigation Documents, as the course keeps them). */
const DD = DraftingDocs;      // drafting-docs.js, loaded before this file
const CATEGORY = { demand: 'Others', mediation: 'Litigation Documents', arbitration: 'Litigation Documents' };
const category = () => CATEGORY[S.type];
function fileName() {
    const id = String(P().case.caseId || '').trim();
    const caseId = /\d/.test(id) && /^[A-Za-z0-9-]+$/.test(id) ? DD.part(id) : 'NO-CASE-ID';
    return [caseId, DD.lastFirst(P().case.client), DD.part(category()), DD.today()].join('_');
}
const prefix = () => {
    const o = P().opts;
    if (o.prefix) return o.prefix;
    const last = String(P().case.client || '').trim().split(/\s+/).pop();
    return (last ? last.toUpperCase() : 'LSH') + ' ';
};
const bates = (n) => prefix() + String(n).padStart(6, '0');
// The cover letter's {tokens}: a blank field stays as its [Name] so Check my packet can find it.
function fillTokens(text) {
    const c = P().case, lim = money(c.limit);
    const map = { client: c.client, insured: c.insured, claim: c.claimNo, dol: c.dol, carrier: c.carrier, adjuster: c.adjuster,
        limit: c.limit ? (isFinite(lim) ? usd(lim) : c.limit) : '', deadline: c.deadline, attorney: c.attorney, firm: c.firm, case: c.caseId };
    return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (k in map ? (String(map[k] || '').trim() || '[' + k + ']') : m));
}

/* ---------- drawing the pages the firm makes (pdf-lib, the standard fonts) ---------- */
const LETTER = [612, 792];
async function fonts(doc) {
    const F = window.PDFLib.StandardFonts;
    return { r: await doc.embedFont(F.TimesRoman), b: await doc.embedFont(F.TimesRomanBold), h: await doc.embedFont(F.Helvetica), hb: await doc.embedFont(F.HelveticaBold) };
}
// The standard fonts only have Windows-1252's characters: anything else (an emoji, a ✓) prints as "?" rather than failing the build.
function clean(font, s) {
    return Array.from(String(s == null ? '' : s).replace(/\t/g, '    ')).map(ch => {
        try { font.encodeText(ch); return ch; } catch (e) { return '?'; }
    }).join('');
}
function wrap(font, size, text, width) {
    const out = [];
    String(text == null ? '' : text).split('\n').forEach(par => {
        const words = clean(font, par).split(/ +/);
        let line = '';
        words.forEach(w => {
            while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {          // a word wider than the line is broken
                let k = w.length; while (k > 1 && font.widthOfTextAtSize(w.slice(0, k), size) > width) k--;
                if (line) { out.push(line); line = ''; }
                out.push(w.slice(0, k)); w = w.slice(k);
            }
            const t = line ? line + ' ' + w : w;
            if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t;
        });
        out.push(line);
    });
    return out;
}
// A page writer: text that runs past the bottom margin goes on to a new page.
function writer(doc, f, size, margin) {
    const W = { page: null, y: 0, doc, f };
    W.size = size || LETTER; W.m = margin || 72;
    W.newPage = () => { W.page = doc.addPage(W.size); W.y = W.size[1] - W.m; return W.page; };
    W.need = (h) => { if (!W.page || W.y - h < W.m) W.newPage(); };
    W.line = (text, o) => {
        o = o || {}; const font = o.font || f.r, sz = o.size || 11.5, lh = o.lh || sz * 1.35, width = W.size[0] - W.m * 2 - (o.indent || 0);
        wrap(font, sz, text, width).forEach(l => {
            W.need(lh);
            let x = W.m + (o.indent || 0);
            if (o.center) x = (W.size[0] - font.widthOfTextAtSize(l, sz)) / 2;
            if (o.right) x = W.size[0] - W.m - font.widthOfTextAtSize(l, sz);
            W.page.drawText(l, { x, y: W.y - sz, size: sz, font });
            W.y -= lh;
        });
    };
    W.gap = (h) => { W.y -= h; };
    W.rule = () => { W.need(8); W.page.drawLine({ start: { x: W.m, y: W.y - 2 }, end: { x: W.size[0] - W.m, y: W.y - 2 }, thickness: .8 }); W.y -= 10; };
    return W;
}

async function coverPdf(layout) {
    const { PDFDocument } = window.PDFLib, doc = await PDFDocument.create(), f = await fonts(doc), c = P().case;
    const W = writer(doc, f); W.newPage();
    if (c.firm) W.line(c.firm, { font: f.b, size: 15, center: true });
    if (c.firmAddress) W.line(c.firmAddress.replace(/\n/g, ' · '), { size: 10, center: true });
    if (c.firm || c.firmAddress) { W.gap(4); W.rule(); }
    W.gap(6); W.line(today()); W.gap(12);
    W.line(c.email ? 'VIA E-MAIL: ' + c.email : 'VIA E-MAIL', { font: f.b, size: 10.5 }); W.gap(8);
    [c.adjuster, c.carrier].concat(String(c.address || '').split('\n')).filter(x => String(x || '').trim()).forEach(l => W.line(l));
    W.gap(14);
    const re = [['Our Client', c.client], ['Your Insured', c.insured], ['Claim No.', c.claimNo], ['Date of Loss', c.dol]].filter(r => String(r[1] || '').trim());
    re.forEach((r, i) => {
        W.need(16);
        if (i === 0) W.page.drawText('Re:', { x: W.m, y: W.y - 11.5, size: 11.5, font: f.b });
        W.page.drawText(clean(f.b, r[0] + ':'), { x: W.m + 40, y: W.y - 11.5, size: 11.5, font: f.b });
        W.page.drawText(clean(f.r, r[1]), { x: W.m + 130, y: W.y - 11.5, size: 11.5, font: f.r });
        W.y -= 15.5;
    });
    W.gap(14);
    W.line(`Dear ${String(c.adjuster || '').trim() || 'Claims Adjuster'}:`); W.gap(8);
    fillTokens(P().cover.body).split(/\n\s*\n/).forEach(par => { W.line(par.replace(/\n/g, ' ')); W.gap(8); });
    W.gap(4); W.line('Enclosures:', { font: f.b });
    layout.encl.forEach(e => W.line(e, { indent: 18, size: 11 }));
    W.gap(18); W.line('Sincerely,'); W.gap(34);
    W.line(c.attorney || '[attorney]'); if (c.firm) W.line(c.firm);
    if (c.sender) { W.gap(10); W.line('Prepared by: ' + c.sender, { size: 10 }); }
    W.gap(10); W.line('cc: Client file', { size: 10 });
    return doc;
}

// The master index: a row per document, its exhibit number, date, source, pages and Bates range.
const IDX_COLS = [['Ex.', 40], ['Description', 164], ['Date', 58], ['Source', 98], ['Pages', 52], ['Bates', 128]];
async function indexPdf(rows) {
    const { PDFDocument, rgb } = window.PDFLib, doc = await PDFDocument.create(), f = await fonts(doc), c = P().case;
    const m = 36, size = 9, lh = 11.5;
    const W = writer(doc, f, LETTER, m);
    const head = () => {
        W.newPage();
        W.line((TYPES[S.type].name + ' — ' + (S.type === 'demand' ? 'Index' : 'Master Index')).toUpperCase(), { font: f.hb, size: 13, center: true });
        W.line([c.client && 'Client: ' + c.client, c.claimNo && 'Claim No. ' + c.claimNo, c.dol && 'Date of Loss: ' + c.dol].filter(Boolean).join('   ·   '), { font: f.h, size: 9, center: true });
        W.gap(8);
        let x = m;
        W.page.drawRectangle({ x: m, y: W.y - 15, width: LETTER[0] - m * 2, height: 16, color: rgb(.06, .13, .28) });
        IDX_COLS.forEach(([t, w]) => { W.page.drawText(t, { x: x + 3, y: W.y - 11, size: 8.5, font: f.hb, color: rgb(1, 1, 1) }); x += w; });
        W.y -= 20;
    };
    head();
    rows.forEach(r => {
        if (r.section) {
            if (W.y - 22 < m + 20) head();
            W.gap(3);
            W.page.drawRectangle({ x: m, y: W.y - 13, width: LETTER[0] - m * 2, height: 14, color: rgb(.93, .95, .98) });
            W.page.drawText(clean(f.hb, r.section), { x: m + 3, y: W.y - 10, size: 9, font: f.hb });
            W.y -= 17; return;
        }
        const cells = [r.ex, r.desc, r.date, r.source, r.pages, r.bates].map((v, i) => wrap(i === 0 ? f.hb : f.h, size, v || '', IDX_COLS[i][1] - 6));
        const h = Math.max.apply(null, cells.map(l => l.length)) * lh + 4;
        if (W.y - h < m + 20) head();
        let x = m;
        cells.forEach((lines, i) => {
            lines.forEach((l, k) => W.page.drawText(l, { x: x + 3, y: W.y - size - k * lh, size, font: i === 0 ? f.hb : f.h }));
            x += IDX_COLS[i][1];
        });
        W.y -= h;
        W.page.drawLine({ start: { x: m, y: W.y + 1 }, end: { x: LETTER[0] - m, y: W.y + 1 }, thickness: .4, color: rgb(.8, .83, .88) });
    });
    const bills = billDocs().map(d => money(d.amount)).filter(isFinite), pip = pipMade() && pipRows().length;
    if (bills.length || pip) {
        W.gap(10);
        W.line('Total medical specials (billed): ' + usd(bills.length ? bills.reduce((a, b) => a + b, 0) : pipTot('billed')), { font: f.hb, size: 10, right: true });
    }
    return doc;
}

async function pipPdf() {
    const { PDFDocument, rgb } = window.PDFLib, doc = await PDFDocument.create(), f = await fonts(doc), c = P().case, p = P().pip;
    const size = [792, 612], m = 36, cols = [['Provider', 190], ['Dates of Service', 130], ['Billed', 80], ['PIP Paid', 80], ['Paid On', 72], ['Other Paid', 80], ['Balance', 88]];
    const W = writer(doc, f, size, m);
    const head = () => {
        W.newPage();
        W.line('PIP LOG', { font: f.hb, size: 14, center: true });
        W.line([c.client && 'Client: ' + c.client, p.carrier && 'PIP carrier: ' + p.carrier, c.claimNo && 'Claim No. ' + c.claimNo,
            p.limit && 'PIP limit: ' + usd(money(p.limit))].filter(Boolean).join('   ·   '), { font: f.h, size: 9.5, center: true });
        W.gap(8);
        let x = m;
        W.page.drawRectangle({ x: m, y: W.y - 15, width: size[0] - m * 2, height: 16, color: rgb(.06, .13, .28) });
        cols.forEach(([t, w], i) => {
            const right = i >= 2 && i !== 4;
            W.page.drawText(t, { x: right ? x + w - 4 - f.hb.widthOfTextAtSize(t, 8.5) : x + 4, y: W.y - 11, size: 8.5, font: f.hb, color: rgb(1, 1, 1) });
            x += w;
        });
        W.y -= 20;
    };
    head();
    const row = (vals, bold) => {
        const font = bold ? f.hb : f.h, cells = vals.map((v, i) => wrap(font, 9.5, v, cols[i][1] - 8));
        const h = Math.max.apply(null, cells.map(l => l.length)) * 12 + 5;
        if (W.y - h < m + 10) head();
        let x = m;
        cells.forEach((lines, i) => {
            const right = i >= 2 && i !== 4;
            lines.forEach((l, k) => W.page.drawText(l, { x: right ? x + cols[i][1] - 4 - font.widthOfTextAtSize(l, 9.5) : x + 4, y: W.y - 10 - k * 12, size: 9.5, font }));
            x += cols[i][1];
        });
        W.y -= h;
        W.page.drawLine({ start: { x: m, y: W.y + 2 }, end: { x: size[0] - m, y: W.y + 2 }, thickness: bold ? 1 : .4, color: rgb(.75, .78, .84) });
    };
    const amt = (v) => String(v || '').trim() === '' ? '' : (isFinite(money(v)) ? usd(money(v)) : v);
    pipRows().forEach(r => row([r.provider, r.dos, amt(r.billed), amt(r.pip), r.paidOn, amt(r.other), usd(balance(r))]));
    row(['Total', '', usd(pipTot('billed')), usd(pipTot('pip')), '', usd(pipTot('other')), usd(pipRows().reduce((a, r) => a + balance(r), 0))], true);
    const lim = money(p.limit);
    if (p.limit && isFinite(lim)) { W.gap(10); W.line(`PIP remaining: ${usd(lim)} limit - ${usd(pipTot('pip'))} paid = ${usd(lim - pipTot('pip'))}`, { font: f.hb, size: 10.5 }); }
    W.gap(6); W.line('Prepared ' + today() + (c.sender ? ' by ' + c.sender : '') + '.', { font: f.h, size: 9 });
    return doc;
}
function balance(r) {
    const n = (v) => (isFinite(money(v)) ? money(v) : 0);
    return n(r.billed) - n(r.pip) - n(r.other);
}

async function tabPdf(s) {
    const { PDFDocument, rgb } = window.PDFLib, doc = await PDFDocument.create(), f = await fonts(doc), pg = doc.addPage(LETTER);
    const big = 'TAB ' + secNo(s), t = clean(f.hb, s.title);
    pg.drawRectangle({ x: 156, y: 330, width: 300, height: 170, borderColor: rgb(.06, .13, .28), borderWidth: 2 });
    pg.drawText(big, { x: (612 - f.hb.widthOfTextAtSize(big, 44)) / 2, y: 440, size: 44, font: f.hb, color: rgb(.06, .13, .28) });
    wrap(f.hb, 16, t, 270).forEach((l, i) => pg.drawText(l, { x: (612 - f.hb.widthOfTextAtSize(l, 16)) / 2, y: 400 - i * 20, size: 16, font: f.hb }));
    if (s.docs.length) {
        const ex = 'Exhibits ' + exhibit(s, 0) + (s.docs.length > 1 ? ' – ' + exhibit(s, s.docs.length - 1) : '');
        pg.drawText(ex, { x: (612 - f.h.widthOfTextAtSize(ex, 11)) / 2, y: 345, size: 11, font: f.h });
    }
    return doc;
}

async function imagePdf(bytes, type) {
    const { PDFDocument } = window.PDFLib, doc = await PDFDocument.create();
    const u = new Uint8Array(bytes), png = u[0] === 0x89 && u[1] === 0x50;
    const img = png || /png/i.test(type) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const land = img.width > img.height, size = land ? [792, 612] : LETTER, m = 36;
    const k = Math.min((size[0] - m * 2) / img.width, (size[1] - m * 2) / img.height);
    const pg = doc.addPage(size), w = img.width * k, h = img.height * k;
    pg.drawImage(img, { x: (size[0] - w) / 2, y: (size[1] - h) / 2, width: w, height: h });
    return doc;
}

// Text in a page's bottom corner the way the page is seen, whatever its /Rotate (a scanned page is often turned).
function stamp(page, text, where, font, size) {
    const { rgb, degrees } = window.PDFLib;
    const box = page.getCropBox ? page.getCropBox() : Object.assign({ x: 0, y: 0 }, page.getSize());
    const r = ((page.getRotation().angle % 360) + 360) % 360, w = box.width, h = box.height;
    const vw = r % 180 ? h : w;
    text = clean(font, text);
    const tw = font.widthOfTextAtSize(text, size);
    const vx = where === 'right' ? vw - 30 - tw : (vw - tw) / 2, vy = 16;
    // visual (vx, vy) from the seen bottom-left → the page's own coordinates
    const P_ = r === 90 ? [w - vy, vx] : r === 180 ? [w - vx, h - vy] : r === 270 ? [vy, h - vx] : [vx, vy];
    const x = box.x + P_[0], y = box.y + P_[1], rot = degrees(r);
    const pad = 2.5, rx = r === 90 ? x + pad : r === 180 ? x + pad : r === 270 ? x - pad : x - pad, ry = r === 90 ? y - pad : r === 180 ? y + pad : r === 270 ? y + pad : y - pad;
    page.drawRectangle({ x: rx, y: ry, width: tw + pad * 2, height: size + pad * 2, rotate: rot, color: rgb(1, 1, 1), opacity: .9 });
    page.drawText(text, { x, y, size, font, rotate: rot, color: rgb(0, 0, 0) });
}

// Bookmarks (the PDF's outline): a section, and under it each of its documents.
function outline(doc, items) {
    const { PDFName, PDFHexString, PDFNull } = window.PDFLib, ctx = doc.context, pages = doc.getPages();
    if (!items.length) return;
    const rootRef = ctx.nextRef();
    const build = (list, parentRef) => {
        const refs = list.map(() => ctx.nextRef());
        let count = 0;
        list.forEach((it, i) => {
            const d = { Title: PDFHexString.fromText(it.title), Parent: parentRef, Dest: ctx.obj([pages[it.page].ref, PDFName.of('XYZ'), PDFNull, PDFNull, PDFNull]) };
            if (i > 0) d.Prev = refs[i - 1];
            if (i < list.length - 1) d.Next = refs[i + 1];
            if (it.children && it.children.length) {
                const kids = build(it.children, refs[i]);
                d.First = kids.refs[0]; d.Last = kids.refs[kids.refs.length - 1]; d.Count = -kids.refs.length;   // closed
            }
            ctx.assign(refs[i], ctx.obj(d));
            count++;
        });
        return { refs, count };
    };
    const top = build(items, rootRef);
    ctx.assign(rootRef, ctx.obj({ Type: 'Outlines', First: top.refs[0], Last: top.refs[top.refs.length - 1], Count: top.count }));
    doc.catalog.set(PDFName.of('Outlines'), rootRef);
    doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}

/* ---------- putting it together ---------- */
// The parts in order, each with its pages. Page counts first (the index's own length depends only on how many rows it has),
// then the numbers, then the index with them, then the merge.
async function assemble() {
    const { PDFDocument, StandardFonts } = window.PDFLib, pk = P(), o = pk.opts;
    const parts = [];   // { sec, what: 'cover'|'index'|'tab'|'pip'|'doc', doc?, pdf, pages }
    const problems = [];
    for (const s of pk.sections) {
        if (s.kind === 'index') { parts.push({ sec: s, what: 'index', pdf: null, pages: 0 }); continue; }
        const numberedSec = s.kind !== 'cover';
        const has = s.docs.length || (s.kind === 'piplog' && pipMade() && pipRows().length) || (s.kind === 'cover' && coverMade());
        if (!has) continue;
        if (numberedSec && o.tabs) parts.push({ sec: s, what: 'tab', pdf: await tabPdf(s) });
        if (s.kind === 'cover' && coverMade()) parts.push({ sec: s, what: 'cover', pdf: null });   // made once the enclosures are known
        if (s.kind === 'piplog' && pipMade() && pipRows().length) parts.push({ sec: s, what: 'pip', pdf: await pipPdf() });
        if (s.kind === 'cover' && coverMade()) continue;    // a cover made here doesn't take uploads too
        if (s.kind === 'piplog' && !pipMade() && !s.docs.length) continue;
        for (let i = 0; i < s.docs.length; i++) {
            const d = s.docs[i], f = await fileGet(d.id);
            if (!f) { problems.push(`${d.file} is no longer in this browser: add it again`); continue; }
            if (d.err) { problems.push(`${d.file} ${d.err}`); continue; }
            try {
                const pdf = d.kind === 'img' ? await imagePdf(f.bytes, f.type) : await PDFDocument.load(f.bytes.slice(0), { ignoreEncryption: true });
                parts.push({ sec: s, what: 'doc', doc: d, idx: i, pdf });
            } catch (e) { problems.push(`${d.file} could not be read (${e.message})`); }
        }
    }
    if (problems.length) throw new Error(problems.join('\n'));
    parts.forEach(p => { if (p.pdf) p.pages = p.pdf.getPageCount(); });

    // The cover letter lists the enclosures; its page count is known once it is drawn.
    const encl = numbered().filter(s => parts.some(p => p.sec === s)).map(s => `${o.tabs ? 'Tab ' : ''}${secNo(s)}. ${s.title}`);
    const coverPart = parts.find(p => p.what === 'cover');
    if (coverPart) { coverPart.pdf = await coverPdf({ encl }); coverPart.pages = coverPart.pdf.getPageCount(); }

    // The index's rows, with placeholder ranges to count its pages, then the real ones.
    const idxPart = parts.find(p => p.what === 'index');
    const rowsFor = (numbers) => {
        const rows = [];
        let cur = null;
        parts.forEach(p => {
            if (p.what === 'index' || p.what === 'tab') return;
            const s = p.sec;
            if (s.kind !== 'cover' && cur !== s) { cur = s; rows.push({ section: `${o.tabs ? 'TAB' : 'SECTION'} ${secNo(s)} — ${s.title}`.toUpperCase() }); }
            const n = numbers(p), pages = n.from === n.to ? 'p. ' + n.from : `pp. ${n.from}–${n.to}`;
            const b = o.bates ? (n.from === n.to ? bates(o.start + n.from - 1) : bates(o.start + n.from - 1) + ' – ' + bates(o.start + n.to - 1)) : '';
            if (p.what === 'cover') rows.push({ ex: '—', desc: s.title, date: todayShort(), source: P().case.firm || 'This office', pages, bates: b });
            else if (p.what === 'pip') rows.push({ ex: secNo(s) + '-PIP', desc: 'PIP Log' + (P().pip.carrier ? ' — ' + P().pip.carrier : ''), date: todayShort(), source: P().case.firm || 'This office', pages, bates: b });
            else rows.push({ ex: exhibit(s, p.idx), desc: p.doc.desc + (s.bills && String(p.doc.amount || '').trim() ? ' — ' + (isFinite(money(p.doc.amount)) ? usd(money(p.doc.amount)) : p.doc.amount) : ''), date: p.doc.date, source: p.doc.source, pages, bates: b });
        });
        return rows;
    };
    const place = () => { let at = 1; parts.forEach(p => { p.from = at; p.to = at + p.pages - 1; at += p.pages; }); return at - 1; };
    if (idxPart) {
        idxPart.pages = (await indexPdf(rowsFor(() => ({ from: 9999, to: 9999 })))).getPageCount();
        place();
        idxPart.pdf = await indexPdf(rowsFor(p => ({ from: p.from, to: p.to })));
        if (idxPart.pdf.getPageCount() !== idxPart.pages) { idxPart.pages = idxPart.pdf.getPageCount(); place(); idxPart.pdf = await indexPdf(rowsFor(p => ({ from: p.from, to: p.to }))); }
    }
    const total = place();

    // The merge, then the numbers on every page.
    const out = await PDFDocument.create();
    out.setTitle(`${TYPES[S.type].name} — ${P().case.client || 'Client'}`); out.setCreator('Legal Skills Hub'); out.setProducer('Legal Skills Hub (pdf-lib)');
    for (const p of parts) (await out.copyPages(p.pdf, p.pdf.getPageIndices())).forEach(pg => out.addPage(pg));
    const font = await out.embedFont(StandardFonts.Helvetica), bold = await out.embedFont(StandardFonts.HelveticaBold);
    out.getPages().forEach((pg, i) => {
        if (o.numbers) stamp(pg, `Page ${i + 1} of ${total}`, 'center', font, 8.5);
        if (o.bates) stamp(pg, bates(o.start + i), 'right', bold, 9);
    });
    if (o.bookmarks) {
        const items = [];
        parts.forEach(p => {
            if (p.what === 'cover' || p.what === 'index') { items.push({ title: p.sec.title, page: p.from - 1 }); return; }
            let top = items.find(it => it.sec === p.sec);
            if (!top) { top = { sec: p.sec, title: `${o.tabs ? 'Tab' : 'Section'} ${secNo(p.sec)} — ${p.sec.title}`, page: p.from - 1, children: [] }; items.push(top); }
            if (p.what === 'pip') top.children.push({ title: 'PIP Log', page: p.from - 1 });
            if (p.what === 'doc') top.children.push({ title: `${exhibit(p.sec, p.idx)} ${p.doc.desc}`, page: p.from - 1 });
        });
        outline(out, items);
    }
    const bytes = await out.save();
    return { bytes, total, parts: parts.map(p => ({ sec: p.sec.id, title: p.sec.title, what: p.what, doc: p.doc ? p.doc.id : null, from: p.from, to: p.to })),
        rows: idxPart ? rowsFor(p => ({ from: p.from, to: p.to })) : [] };
}

function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- ✔ Check my packet ---------- */
function runChecks() {
    const pk = P(), c = pk.case, out = [];
    const add = (label, ok, detail) => out.push({ label, ok: !!ok, detail: ok ? '' : detail });
    const missing = [['client', c.client], ['claim number', c.claimNo], ['carrier', c.carrier], ['adjuster', c.adjuster], ['date of loss', c.dol]].filter(x => !String(x[1] || '').trim()).map(x => x[0]);
    add('The case details are filled in', !missing.length, 'Still blank: ' + missing.join(', ') + '.');
    const coverSec = pk.sections.find(s => s.kind === 'cover');
    if (coverSec) {
        if (coverMade()) {
            const left = (fillTokens(pk.cover.body).match(/\[[a-z]+\]/g) || []);
            add('The cover letter is complete', !left.length && String(pk.cover.body).trim() && (c.email || c.address) && c.attorney,
                [left.length ? 'it still has ' + [...new Set(left)].join(', ') + ' (fill those case details)' : '', !(c.email || c.address) ? 'no e-mail or address to send it to' : '', !c.attorney ? 'no attorney to sign it' : ''].filter(Boolean).join('; ') + '.');
        } else add('The cover letter is in the packet', coverSec.docs.length, 'Add your cover letter as a PDF, or make it here.');
    }
    pk.sections.filter(s => s.req && s.kind === 'docs').forEach(s => add(`${s.title} is in the packet`, s.docs.length, `Section ${secNo(s)} (${s.title}) is empty.`));
    pk.sections.filter(s => s.kind === 'piplog').forEach(s => {
        if (pipMade()) {
            const rows = pipRows(), bad = rows.filter(r => !String(r.provider).trim() || !isFinite(money(r.billed)) || String(r.billed).trim() === '');
            add('The PIP log has every bill on it', rows.length && !bad.length && pk.pip.carrier, !rows.length ? 'The PIP log has no rows.' : bad.length ? `${bad.length} row${bad.length === 1 ? '' : 's'} without a provider or a billed amount.` : 'Name the PIP carrier.');
        } else add('The PIP log is in the packet', s.docs.length, 'Add the PIP log as a PDF, or make it here.');
    });
    const docs = pk.sections.flatMap(s => s.docs);
    const undescribed = docs.filter(d => !String(d.desc).trim() || !String(d.date).trim() || !String(d.source).trim());
    add('Every document is described for the index (description, date, source)', docs.length && !undescribed.length,
        docs.length ? `${undescribed.length} still missing something: ${undescribed.slice(0, 4).map(d => d.file).join(', ')}${undescribed.length > 4 ? '…' : ''}.` : 'There are no documents yet.');
    const bills = billDocs();
    if (bills.length) {
        const noAmt = bills.filter(d => !isFinite(money(d.amount)) || String(d.amount).trim() === '');
        add('Every bill has its amount', !noAmt.length, `${noAmt.length} bill${noAmt.length === 1 ? '' : 's'} without an amount: ${noAmt.slice(0, 4).map(d => d.desc || d.file).join(', ')}.`);
        if (pipMade() && pipRows().length) {
            const tb = bills.reduce((a, d) => a + (isFinite(money(d.amount)) ? money(d.amount) : 0), 0), tp = pipTot('billed');
            add('The bills add up to the PIP log', Math.abs(tb - tp) < 0.005, `The bills total ${usd(tb)}; the PIP log's Billed column totals ${usd(tp)}.`);
        }
        const recSrc = pk.sections.filter(s => s.records).flatMap(s => s.docs).map(d => String(d.source).trim().toLowerCase()).filter(Boolean);
        if (pk.sections.some(s => s.records)) {
            const noRec = [...new Set(bills.map(d => String(d.source).trim()).filter(Boolean))].filter(src => !recSrc.includes(src.toLowerCase()));
            add('Every provider billed has records in the packet', !noRec.length, `No records from: ${noRec.join(', ')} (or the source isn't written the same way on the bill and the records).`);
        }
    }
    const bad = docs.filter(d => d.err || d.lost);
    add('Every PDF opens (none password-protected or damaged)', !bad.length, bad.map(d => `${d.file}: ${d.err || 'missing'}`).join('; '));
    add('Bates numbers and bookmarks are on', pk.opts.bates && pk.opts.bookmarks, 'The firm sends every packet Bates-numbered and bookmarked.');
    if (DD.dest().wired) add('Filed in the CMS, under the right tab and named the firm\'s way', fileRec().filed, 'File the packet into your case in the CMS (📤 File it in the CMS).');
    add('The packet was built after your last change', pk.builtAt && (!pk.changedAt || pk.builtAt >= pk.changedAt), 'Build the packet again: something changed since the last build.');
    const passed = out.filter(x => x.ok).length;
    return { checks: out, score: Math.round(passed / out.length * 100), passed };
}

/* ---------- the page ---------- */
const field = (k, label, ph, wide, area) => `<label class="${wide ? 'wide' : ''}">${esc(label)}${area
    ? `<textarea rows="2" style="min-height:52px;font-family:inherit;font-size:12.5px;" data-case="${k}" placeholder="${esc(ph)}" oninput="LSHPacket.setCase('${k}', this.value)">${esc(P().case[k])}</textarea>`
    : `<input data-case="${k}" value="${esc(P().case[k])}" placeholder="${esc(ph)}" oninput="LSHPacket.setCase('${k}', this.value)">`}</label>`;
function caseHtml() {
    return `<div class="pk-card"><h3>The case</h3>
        <p>What the cover letter, the index and the file name are made from. Take every detail from the case file in the CMS.</p>
        <div class="pk-form">
            ${field('client', 'Client', 'John Doe')}${field('caseId', 'Case ID', 'LSH-2026-MVA-…')}
            ${field('insured', 'Their insured / defendant', 'Robert Smith')}${field('dol', 'Date of loss', 'mm/dd/yyyy')}
            ${field('carrier', 'Carrier', 'The insurance company')}${field('claimNo', 'Claim No.', '')}
            ${field('adjuster', 'Adjuster', 'Name of the adjuster')}${field('email', 'Adjuster\'s e-mail', 'adjuster@carrier.com')}
            ${field('address', 'Carrier\'s address', 'Street\nCity, State ZIP', true, true)}
            ${field('limit', S.type === 'demand' ? 'Policy limit demanded' : 'Policy limit', '$10,000.00')}${field('deadline', S.type === 'demand' ? 'Demand open until' : 'Hearing / session date', 'mm/dd/yyyy')}
            ${field('attorney', 'Attorney signing', 'Atty. …')}${field('sender', 'Prepared by (you)', Sim.who().name || '')}
            ${field('firm', 'Firm name (letterhead)', '')}${field('firmAddress', 'Firm address', '', false)}
        </div></div>`;
}
const MOVE = (s, i, n) => `<select title="Move to another section" onchange="LSHPacket.moveTo('${s.id}', ${i}, this.value)">
    <option value="">Move to…</option>${P().sections.filter(x => x.kind !== 'index' && x.id !== s.id).map(x => `<option value="${x.id}">${esc(x.title)}</option>`).join('')}</select>`;
function docsHtml(s) {
    const lostNote = (d) => d.lost ? '<b>Not in this browser any more: remove it and add the file again.</b> ' : d.err ? `<b>${esc(d.err)}.</b> ` : '';
    return `<ul class="pk-docs">${s.docs.map((d, i) => `
        <li class="pk-doc ${d.lost || d.err ? 'lost' : ''}" draggable="true" data-doc="${d.id}" ondragstart="LSHPacket.drag(event, '${s.id}', ${i})">
            <span class="ex" title="Exhibit number">${s.kind === 'cover' ? '—' : exhibit(s, i)}</span>
            <div class="meta">
                <label class="wide">Description<input value="${esc(d.desc)}" oninput="LSHPacket.setDoc('${s.id}', ${i}, 'desc', this.value)"></label>
                <label>Date<input value="${esc(d.date)}" placeholder="mm/dd/yyyy" oninput="LSHPacket.setDoc('${s.id}', ${i}, 'date', this.value)"></label>
                <label>${s.bills || s.records ? 'Provider' : 'Source'}<input value="${esc(d.source)}" placeholder="${s.bills || s.records ? 'Provider' : 'Who it is from'}" oninput="LSHPacket.setDoc('${s.id}', ${i}, 'source', this.value)"></label>
                ${s.bills ? `<label>Amount billed<input value="${esc(d.amount)}" placeholder="$0.00" oninput="LSHPacket.setDoc('${s.id}', ${i}, 'amount', this.value)"></label>` : ''}
                <div class="file">${lostNote(d)}📄 ${esc(d.file)} · ${d.pages} page${d.pages === 1 ? '' : 's'}</div>
            </div>
            <div class="ops">
                <button type="button" title="Up" onclick="LSHPacket.docUp('${s.id}', ${i}, -1)" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" title="Down" onclick="LSHPacket.docUp('${s.id}', ${i}, 1)" ${i === s.docs.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" title="View" onclick="LSHPacket.view('${d.id}')">👁</button>
                <button type="button" title="Remove" onclick="LSHPacket.remove('${s.id}', ${i})">✕</button>
                ${MOVE(s, i)}
            </div>
        </li>`).join('')}</ul>
        <label class="pk-drop">⬆ <b>Add PDFs</b> — choose several at once, or drop them here (scans and photos: JPG/PNG)
            <input type="file" multiple accept="application/pdf,.pdf,image/jpeg,image/png,.jpg,.jpeg,.png" onchange="LSHPacket.add('${s.id}', this.files); this.value='';"></label>`;
}
function pipHtml(s) {
    const p = P().pip, n = (v) => esc(v);
    const cell = (i, k, ph, m) => `<td class="${m ? 'm' : ''}"><input class="${m ? 'm' : ''}" value="${n(p.rows[i][k])}" placeholder="${ph}" oninput="LSHPacket.setPip(${i}, '${k}', this.value)"></td>`;
    return `<div class="pk-choice">
            <label><input type="radio" name="pipmode-${s.id}" ${pipMade() ? 'checked' : ''} onchange="LSHPacket.pipMode('make')"> Make the PIP log here</label>
            <label><input type="radio" name="pipmode-${s.id}" ${pipMade() ? '' : 'checked'} onchange="LSHPacket.pipMode('upload')"> Use a PIP log I already have (PDF)</label>
        </div>
        ${pipMade() ? `<div class="pk-form" style="margin-bottom:8px;">
            <label>PIP carrier<input value="${n(p.carrier)}" placeholder="The client's own carrier" oninput="LSHPacket.setPipHead('carrier', this.value)"></label>
            <label>PIP limit<input value="${n(p.limit)}" placeholder="10000" oninput="LSHPacket.setPipHead('limit', this.value)"></label></div>
        <div class="pk-pip-wrap"><table class="pk-pip"><thead><tr><th>Provider</th><th>Dates of service</th><th class="m">Billed</th><th class="m">PIP paid</th><th>Paid on</th><th class="m">Other paid</th><th class="m">Balance</th><th></th></tr></thead>
            <tbody>${p.rows.map((r, i) => `<tr>${cell(i, 'provider', 'Provider')}${cell(i, 'dos', 'mm/dd/yyyy – mm/dd/yyyy')}${cell(i, 'billed', '0.00', 1)}${cell(i, 'pip', '0.00', 1)}${cell(i, 'paidOn', 'mm/dd/yyyy')}${cell(i, 'other', '0.00', 1)}
                <td class="m" data-bal="${i}">${usd(balance(r))}</td><td><button type="button" title="Remove the row" onclick="LSHPacket.pipDel(${i})">✕</button></td></tr>`).join('')}
            <tr class="tot"><td>Total</td><td></td><td class="m" data-tot="billed">${usd(pipTot('billed'))}</td><td class="m" data-tot="pip">${usd(pipTot('pip'))}</td><td></td><td class="m" data-tot="other">${usd(pipTot('other'))}</td><td class="m" data-tot="bal">${usd(pipRows().reduce((a, r) => a + balance(r), 0))}</td><td></td></tr>
            </tbody></table></div>
        <div class="pk-add" style="margin:8px 0 10px;"><button class="sim-btn ghost" type="button" onclick="LSHPacket.pipAdd()">+ Add a row</button>
            ${billDocs().length ? `<button class="sim-btn ghost" type="button" onclick="LSHPacket.pipFromBills()">+ A row for each bill in the packet</button>` : ''}</div>
        <p class="hint">"Other paid" is what the health plan (or anyone else) paid; the balance is billed less what was paid. Take every figure from the EOBs and the PIP payment history, not from memory.</p>` : ''}
        ${!pipMade() || s.bills ? (s.bills && pipMade() ? '<p class="hint" style="margin-top:6px;">The providers\' bills go after the PIP log, here:</p>' : '') + docsHtml(s) : ''}`;
}
function coverHtml(s) {
    return `<div class="pk-choice">
            <label><input type="radio" name="covermode" ${coverMade() ? 'checked' : ''} onchange="LSHPacket.coverMode('make')"> Make the cover letter here</label>
            <label><input type="radio" name="covermode" ${coverMade() ? '' : 'checked'} onchange="LSHPacket.coverMode('upload')"> Use my own letter (PDF)</label>
        </div>
        ${coverMade() ? `<p class="hint">The letterhead, date, "VIA E-MAIL", the adjuster's address block, the Re: lines, the enclosures list and the signature are written for you from the case above. The body is yours: <b>{client}</b>, <b>{insured}</b>, <b>{claim}</b>, <b>{dol}</b>, <b>{limit}</b>, <b>{deadline}</b>, <b>{carrier}</b> are filled in from the case.</p>
            <div class="pk-form"><label class="wide">The letter's body<textarea oninput="LSHPacket.setCover(this.value)">${esc(P().cover.body)}</textarea></label></div>
            <div class="pk-add" style="margin-top:8px;"><button class="sim-btn ghost" type="button" onclick="LSHPacket.coverReset()">↺ The firm's standard wording</button></div>`
        : docsHtml(s)}`;
}
function sectionHtml(s, i) {
    const n = P().sections.length;
    const kind = s.kind === 'cover' ? 'Cover' : s.kind === 'index' ? 'Made for you' : s.kind === 'piplog' ? (s.bills ? 'PIP log + bills' : 'PIP log') : s.bills ? 'Bills' : s.records ? 'Records' : 'Documents';
    const body = s.kind === 'cover' ? coverHtml(s) : s.kind === 'index' ? `<p class="hint" style="margin:0;">Written when the packet is built: every section and document in order, with its exhibit number, date, source, page range and Bates range, counted from the pages actually in the file${billDocs().length || pipMade() ? ', and the total of the medical specials' : ''}. Describe each document well below — the index is only as good as its descriptions.</p>`
        : s.kind === 'piplog' ? pipHtml(s) : docsHtml(s);
    return `<section class="pk-sec" data-sec="${s.id}" ondragover="LSHPacket.over(event, '${s.id}')" ondragleave="LSHPacket.leave(event)" ondrop="LSHPacket.drop(event, '${s.id}')">
        <div class="pk-sec-h">
            <span class="no">${s.kind === 'cover' || s.kind === 'index' ? '•' : (P().opts.tabs ? 'Tab ' : '') + secNo(s)}</span>
            <input class="ttl" value="${esc(s.title)}" aria-label="Section title" oninput="LSHPacket.setTitle('${s.id}', this.value)">
            <span class="kind">${kind}${s.req ? ' · required' : ''}</span>
            <button type="button" title="Move the section up" onclick="LSHPacket.secUp(${i}, -1)" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" title="Move the section down" onclick="LSHPacket.secUp(${i}, 1)" ${i === n - 1 ? 'disabled' : ''}>↓</button>
            ${s.kind === 'index' ? '' : `<button type="button" title="Remove the section" onclick="LSHPacket.secDel(${i})">✕</button>`}
        </div>
        <div class="pk-sec-b">${s.hint && s.kind !== 'cover' ? `<p class="hint">${esc(s.hint)}</p>` : ''}${body}</div>
    </section>`;
}

// The side: what the packet will be, page by page (before a build, from the page counts of what was added).
function layoutRows() {
    const pk = P(), rows = [];
    let at = 1;
    pk.sections.forEach(s => {
        let pages = 0;
        if (s.kind === 'cover') pages = coverMade() ? 1 : s.docs.reduce((a, d) => a + d.pages, 0);
        else if (s.kind === 'index') pages = 1;
        else {
            pages = s.docs.reduce((a, d) => a + d.pages, 0) + (s.kind === 'piplog' && pipMade() && pipRows().length ? 1 : 0);
            if (pages && pk.opts.tabs) pages++;
        }
        if (!pages && s.kind !== 'index') { rows.push({ t: s.title, r: 'empty' }); return; }
        rows.push({ t: (s.kind === 'cover' || s.kind === 'index' ? '' : (pk.opts.tabs ? 'Tab ' : '') + secNo(s) + '. ') + s.title, r: '~' + (pages === 1 ? 'p. ' + at : `pp. ${at}–${at + pages - 1}`) });
        at += pages;
    });
    return { rows, total: at - 1 };
}
function sideHtml() {
    const pk = P(), o = pk.opts, L = S.built && S.built.type === S.type && S.built.at === pk.changedAt ? null : layoutRows();
    const built = S.built && S.built.type === S.type ? S.built : null;
    const rows = L ? L.rows : null;
    return `<div class="pk-card"><h3>The packet</h3>
            ${built && !L ? `<ul class="pk-out">${built.parts.reduce((acc, p) => {
                const last = acc[acc.length - 1];
                if (last && last.sec === p.sec) { last.to = p.to; return acc; }
                acc.push({ sec: p.sec, t: p.title, from: p.from, to: p.to }); return acc; }, []).map(x => `<li><span>${esc(x.t)}</span><span>${x.from === x.to ? 'p. ' + x.from : `pp. ${x.from}–${x.to}`}</span></li>`).join('')}</ul>
                <p style="margin:8px 0 0;"><b>${built.total} pages</b>, built ${new Date(built.builtAt).toLocaleTimeString()}.</p>`
            : `<ul class="pk-out">${rows.map(x => `<li><span>${esc(x.t)}</span><span>${x.r}</span></li>`).join('')}</ul>
                <p style="margin:8px 0 0;">About <b>${L.total} pages</b> (the index and the letter may run longer).</p>`}
            ${S.busy ? `<p class="pk-busy">${esc(S.busy)}</p>` : ''}
        </div>
        <div class="pk-card"><h3>Build it</h3>
            <div class="pk-actions">
                <button class="sim-btn orange" type="button" onclick="LSHPacket.build()">⬇ Build the packet (one PDF)</button>
                <button class="sim-btn ghost" type="button" onclick="LSHPacket.build('zip')">⬇ Each section as its own PDF (.zip)</button>
                <button class="sim-btn ghost" type="button" onclick="LSHPacket.csv()">⬇ The index (.csv)</button>
                <button class="sim-btn ghost" type="button" onclick="LSHPacket.check()">✔ Check my packet</button>
                <button class="sim-btn ghost" type="button" onclick="LSHPacket.submit()">✓ Send it to my trainer</button>
                <button class="sim-btn ghost" type="button" onclick="LSHPacket.reset()">Start over</button>
            </div>
            <p style="margin:12px 0 4px;color:#64748b;">Saved as</p>
            <div class="pk-name">${esc(fileName())}.pdf</div>
        </div>
        <div class="pk-card" id="pk-check" hidden><h3>Check my packet</h3><div data-body></div></div>
        ${fileHtml()}
        <div class="pk-card"><h3>On every page</h3>
            <div class="pk-opts">
                <label><input type="checkbox" ${o.bates ? 'checked' : ''} onchange="LSHPacket.opt('bates', this.checked)"> Bates numbers, from
                    <input type="text" value="${esc(o.prefix)}" placeholder="${esc(prefix())}" title="Prefix" style="width:70px;" oninput="LSHPacket.opt('prefix', this.value, true)">
                    <input type="text" value="${esc(o.start)}" title="First number" style="width:60px;" oninput="LSHPacket.opt('start', this.value, true)"></label>
                <label><input type="checkbox" ${o.numbers ? 'checked' : ''} onchange="LSHPacket.opt('numbers', this.checked)"> "Page 1 of N" at the bottom</label>
                <label><input type="checkbox" ${o.tabs ? 'checked' : ''} onchange="LSHPacket.opt('tabs', this.checked)"> A tab sheet before each section</label>
                <label><input type="checkbox" ${o.bookmarks ? 'checked' : ''} onchange="LSHPacket.opt('bookmarks', this.checked)"> Bookmarks for every section and document</label>
            </div>
        </div>
        <div class="pk-card"><h3>How the firm sends it</h3>
            <ul style="margin:0;padding-left:18px;font-size:12.5px;color:#334155;">
                ${S.type === 'demand' ? `<li style="margin:0 0 5px;">One PDF, in this order: cover letter, index, demand letter, PIP log, bills, records, then anything else that proves the claim.</li>
                <li style="margin:0 0 5px;">Every bill on the PIP log, and the PIP log's billed total equal to the bills'.</li>
                <li style="margin:0 0 5px;">Records for every provider who billed, in treatment order.</li>
                <li style="margin:0 0 5px;">Demands are e-mailed to the adjuster; log the e-mail and the deadline in the CMS the same day.</li>`
                : `<li style="margin:0 0 5px;">Numbered tabs in fixed order, each matching the master index; the binder prints from the index, never the reverse.</li>
                <li style="margin:0 0 5px;">Exhibit numbers belong to the proceeding (4-1, 4-2): a late document takes the next number.</li>
                <li style="margin:0 0 5px;">Bates numbers belong to the page, stamped once, starting ${esc(bates(1))}.</li>
                <li style="margin:0 0 5px;">Text-searchable, bookmarked, checked against the index, and approved before it goes out.</li>`}
                <li style="margin:0;">No password-protected PDFs: open each one and save an unlocked copy first.</li>
            </ul>
        </div>`;
}
/* ---------- 📤 filing the packet into the case in the CMS ----------
   Opened from a course (its tool frame, ⧉ Side by side), the packet is filed into the case open in the CMS beside the
   lesson: the course relays the CMS's own cms-doc-file message (Case-Management-Training js/cm-doc-filing.js) and the
   CMS checks the name and files it. The tab is the trainee's answer and is checked here first: a wrong one is refused
   with the tab the firm uses, and nothing is sent. Every graded attempt is kept, and the filing is scored the way
   drafting-docs.js scores a letter's (first time right is the whole mark). Opened on its own, there is nowhere to file
   into: the card says so, and the download is the file to add in the CMS. */
const fileRec = () => (P().filing = P().filing || { attempts: 0, filed: false });
function fileHtml() {
    const d = DD.dest(), r = fileRec(), c = P().case;
    if (!d.wired) return `<div class="pk-card"><h3>📤 File it in the CMS</h3>
        <p style="margin:0;">Opened on its own, this page has no case to file into. Download the packet and add it to your client's case in the CMS, under the right tab, named the firm's way: <span class="pk-name" style="display:inline;">&lt;Case ID&gt;_&lt;Last-First&gt;_&lt;Type&gt;_${esc(DD.today())}.pdf</span>. Open it from your course to file it from here.</p></div>`;
    return `<div class="pk-card" id="pk-file"><h3>📤 File it in the CMS</h3>
        <p>Into your case in ${esc(d.name === 'Case Management Training' ? 'the CMS beside the lesson' : d.name)}: choose the Doc Hub tab and write the file name, the firm's way. Graded: first time right is the whole mark.</p>
        <div class="pk-form" style="grid-template-columns:1fr;">
            <label>Case ID<input data-file="case" value="${esc(c.caseId)}" placeholder="LSH-2026-…" oninput="LSHPacket.setCase('caseId', this.value)"></label>
            <label>Doc Hub tab<select data-file="tab"><option value="">Choose the tab…</option>${DD.TABS.map(t => `<option ${r.tab === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
            <label>File name<input data-file="name" value="${esc(r.typed || '')}" placeholder="${esc(`${c.caseId || '<Case ID>'}_<Last-First>_<Type>_${DD.today()}.pdf`)}"></label>
        </div>
        <div class="pk-actions" style="margin-top:10px;"><button class="sim-btn orange" type="button" onclick="LSHPacket.file()">📤 File it in the CMS</button></div>
        <div data-file-msg>${r.filed ? `<p class="pk-ok">✔ Filed as <b>${esc(r.name)}</b> under ${esc(r.category)}${r.attempts === 1 ? ' — first time right' : ` in ${r.attempts} attempts`}.</p>` : r.last ? `<p class="pk-bad">${r.last}</p>` : ''}</div>
    </div>`;
}
async function fileIt() {
    const d = DD.dest(), r = fileRec(), box = document.getElementById('pk-file');
    if (!box) return null;
    const tab = box.querySelector('[data-file="tab"]').value.trim(), name = box.querySelector('[data-file="name"]').value.trim();
    r.tab = tab; r.typed = name;
    // the card is looked up each time: building the packet draws the page again
    const say = (html) => { r.last = html; save(false); const m = document.querySelector('#pk-file [data-file-msg]'); if (m) m.innerHTML = html ? `<p class="${/^✔/.test(html) ? 'pk-ok' : 'pk-bad'}">${html}</p>` : ''; };
    const problems = [];
    if (!String(P().case.caseId || '').trim()) problems.push('Enter the Case ID of your client\'s case in the CMS.');
    if (!tab) problems.push('Choose the Doc Hub tab you would file the packet under.');
    else if (tab !== category()) problems.push(`The firm files a ${TYPES[S.type].short.toLowerCase()} under <b>${esc(category())}</b>, not ${esc(tab)}. A packet in the wrong tab is a packet nobody finds.`);
    if (!name) problems.push(`Write the file name, the firm's way: ${esc(`${P().case.caseId || '<Case ID>'}_<Last-First>_<Type>_${DD.today()}.pdf`)}`);
    // a packet changed since it was built is built again (and not downloaded) before it is filed
    if (!problems.length && !(S.built && S.built.type === S.type && P().builtAt && P().builtAt >= (P().changedAt || ''))) {
        say('Building the packet…');
        if (!(await API.build('none'))) { say('The packet could not be built, so nothing was filed.'); return null; }
    }
    const graded = problems.length && tab && name && String(P().case.caseId || '').trim();   // a wrong tab is a wrong answer; a blank isn't one yet
    if (problems.length) {
        if (graded) { r.attempts++; save(false); }
        say(problems.join('<br>')); return { ok: false, problems };
    }
    const id = 'pk' + Math.random().toString(36).slice(2, 10), bytes = S.built.bytes;
    const to = [];
    try { if (window.parent && window.parent !== window) to.push(window.parent); } catch (e) { /* cross-origin */ }
    try { if (window.opener && window.opener !== window) to.push(window.opener); } catch (e) { /* cross-origin */ }
    if (!to.length) { say(`This page wasn't opened from ${esc(d.name)}, so there is nowhere to file it. Download the packet and add it in the CMS yourself.`); return { ok: false, reason: DD.NO_LISTENER }; }
    say('Sending it to the CMS…');
    const out = await new Promise(res => {
        let done = false;
        const on = (e) => { if (!e.data || e.data.lsh !== 'cms-doc-filed' || e.data.id !== id) return; done = true; window.removeEventListener('message', on); res(e.data); };
        window.addEventListener('message', on);
        to.forEach(w => { try { w.postMessage({ lsh: 'cms-doc-file', id, name, category: tab, original: fileName() + '.pdf', mime: 'application/pdf',
            summary: `${TYPES[S.type].name} — ${S.built.total} pages`, bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }, '*'); } catch (err) { /* that one can't be reached */ } });
        setTimeout(() => { if (done) return; window.removeEventListener('message', on); res({ ok: false, reason: DD.NO_LISTENER }); }, 30000);
    });
    if (out.reason === DD.NO_LISTENER || (!out.ok && !(out.problems && out.problems.length) && out.error)) {
        // nobody answered, or the CMS couldn't be reached: not the trainee's mistake, so not an attempt
        say(esc(out.error || `${d.name} didn't answer. Is your own case open in the CMS beside the lesson?`) + ' You can download the packet and add it in the CMS yourself.');
        return out;
    }
    r.attempts++;
    if (!out.ok) { say('The CMS refused the name:<br>' + (out.problems || []).map(esc).join('<br>') + (out.expected ? `<br>It expects: ${esc(out.expected)}` : '')); return out; }
    Object.assign(r, { filed: true, name: out.name || name, category: out.category || tab, at: new Date().toISOString() });
    say(`✔ Filed as <b>${esc(r.name)}</b> under ${esc(r.category)}${r.attempts === 1 ? ' — first time right' : ` in ${r.attempts} attempts`}.`);
    const score = DD.score({ filed: true, attempts: r.attempts });
    await Sim.saveResult({ simulator: 'Document Filing', scenario: `${TYPES[S.type].name} · ${r.category}`, score,
        summary: `Filed as ${r.name} under ${r.category} in ${r.attempts} attempt(s)${r.attempts === 1 ? ' — first time right' : ''}.`,
        details: { kind: 'packet:' + S.type, tab: category(), chose: r.category, name: r.name, attempts: r.attempts, filed: true, caseId: P().case.caseId, pages: S.built.total, at: r.at } });
    return Object.assign({ score }, out);
}

function renderSide() { const el = document.getElementById('pk-side'); if (el) el.innerHTML = sideHtml(); }
function render() {
    const pk = P(), showPrev = S.preview && S.built && S.built.type === S.type;
    app().innerHTML = `
        <div class="pk-bar">${Object.keys(TYPES).map(k => `<button class="pk-tab ${k === S.type ? 'on' : ''}" type="button" onclick="LSHPacket.type('${k}')">${esc(TYPES[k].name)}</button>`).join('')}</div>
        <div class="pk-grid">
            <div class="pk-main">
                ${caseHtml()}
                ${pk.sections.map(sectionHtml).join('')}
                <div class="pk-add"><button class="sim-btn ghost" type="button" onclick="LSHPacket.secAdd()">+ Add a section</button>
                    ${pk.sections.some(s => s.kind === 'piplog') ? '' : `<button class="sim-btn ghost" type="button" onclick="LSHPacket.secAdd('piplog')">+ Add a PIP log</button>`}
                    ${pk.sections.some(s => s.kind === 'cover') ? '' : `<button class="sim-btn ghost" type="button" onclick="LSHPacket.secAdd('cover')">+ Add a cover letter</button>`}</div>
                <div class="pk-card" id="pk-prev" ${showPrev ? '' : 'hidden'}><h3>The packet as built</h3>
                    ${showPrev ? `<iframe class="pk-preview" title="The packet" src="${S.preview}"></iframe>` : ''}</div>
            </div>
            <div class="pk-side" id="pk-side">${sideHtml()}</div>
        </div>`;
}

/* ---------- what the buttons do ---------- */
const secById = (id) => P().sections.find(s => s.id === id);
let dragging = null;
const API = {
    type(k) { if (!TYPES[k]) return; S.type = k; save(false); render(); window.scrollTo(0, 0); },
    setCase(k, v) {
        P().case[k] = v; save();
        if (k === 'client' || k === 'caseId') document.querySelectorAll('.pk-name').forEach(n => { n.textContent = fileName() + '.pdf'; });
    },
    setCover(v) { P().cover.body = v; save(); },
    coverReset() { if (!confirm('Put the firm\'s standard wording back? What you wrote in the body is replaced.')) return; P().cover.body = COVER_BODY[S.type]; save(); render(); },
    coverMode(m) { P().cover.mode = m; save(); render(); },
    pipMode(m) { P().pip.mode = m; save(); render(); },
    setPipHead(k, v) { P().pip[k] = v; save(); },
    setPip(i, k, v) {
        P().pip.rows[i][k] = v; save();
        const b = document.querySelector(`[data-bal="${i}"]`); if (b) b.textContent = usd(balance(P().pip.rows[i]));
        ['billed', 'pip', 'other'].forEach(t => { const el = document.querySelector(`[data-tot="${t}"]`); if (el) el.textContent = usd(pipTot(t)); });
        const bal = document.querySelector('[data-tot="bal"]'); if (bal) bal.textContent = usd(pipRows().reduce((a, r) => a + balance(r), 0));
    },
    pipAdd() { P().pip.rows.push({ provider: '', dos: '', billed: '', pip: '', paidOn: '', other: '' }); save(); render(); },
    pipDel(i) { P().pip.rows.splice(i, 1); save(); render(); },
    pipFromBills() {
        const have = new Set(P().pip.rows.map(r => String(r.provider).trim().toLowerCase()));
        let n = 0;
        billDocs().forEach(d => {
            const who = String(d.source || d.desc).trim();
            if (!who || have.has(who.toLowerCase())) return;
            have.add(who.toLowerCase()); n++;
            P().pip.rows.push({ provider: who, dos: d.date || '', billed: d.amount || '', pip: '', paidOn: '', other: '' });
        });
        if (!n) alert('Every bill\'s provider is already on the PIP log (a bill needs its provider filled in to be added).');
        save(); render();
    },
    setTitle(id, v) { const s = secById(id); if (s) { s.title = v; save(); renderSide(); } },
    setDoc(id, i, k, v) { const s = secById(id); if (s && s.docs[i]) { s.docs[i][k] = v; save(); } },
    add(id, files) { return addFiles(id, files); },
    docUp(id, i, dir) {
        const s = secById(id), j = i + dir; if (!s || j < 0 || j >= s.docs.length) return;
        [s.docs[i], s.docs[j]] = [s.docs[j], s.docs[i]]; save(); render();
    },
    moveTo(id, i, to) {
        const s = secById(id), t = secById(to); if (!s || !t) return;
        t.docs.push(s.docs.splice(i, 1)[0]); save(); render();
    },
    remove(id, i) {
        const s = secById(id); if (!s || !s.docs[i]) return;
        if (!confirm(`Take "${s.docs[i].desc || s.docs[i].file}" out of the packet?`)) return;
        fileDel(s.docs[i].id); s.docs.splice(i, 1); save(); render();
    },
    async view(docId) {
        const f = await fileGet(docId); if (!f) { alert('That file is no longer in this browser: remove it and add it again.'); return; }
        const w = window.open(URL.createObjectURL(new Blob([f.bytes], { type: f.type })), '_blank');
        if (!w) alert('Your browser blocked the new tab: allow pop-ups for this page to view the file.');
    },
    secUp(i, dir) {
        const a = P().sections, j = i + dir; if (j < 0 || j >= a.length) return;
        [a[i], a[j]] = [a[j], a[i]]; save(); render();
    },
    secDel(i) {
        const s = P().sections[i]; if (!s || s.kind === 'index') return;
        if (!confirm(`Remove the section "${s.title}"${s.docs.length ? ` and its ${s.docs.length} document${s.docs.length === 1 ? '' : 's'}` : ''}?`)) return;
        s.docs.forEach(d => fileDel(d.id)); P().sections.splice(i, 1); save(); render();
    },
    secAdd(kind) {
        const a = P().sections;
        if (kind === 'cover') a.unshift(sec(S.type === 'demand' ? 'Cover Letter' : 'Transmittal Letter', 'cover'));
        else if (kind === 'piplog') a.push(sec('PIP Log', 'piplog'));
        else a.push(sec('New Section', 'docs'));
        save(); render();
    },
    opt(k, v, quiet) {
        const o = P().opts;
        o[k] = k === 'start' ? Math.max(1, parseInt(v, 10) || 1) : v;
        save();
        if (!quiet) render(); else document.querySelectorAll('.pk-name').forEach(n => { n.textContent = fileName() + '.pdf'; });
    },
    // drag a document within its section, or onto another; drop files from the computer onto a section
    drag(e, id, i) { dragging = { id, i }; try { e.dataTransfer.setData('text/plain', 'doc'); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* none */ } },
    over(e, id) { e.preventDefault(); const el = e.currentTarget; if (el) el.classList.add('drag'); },
    leave(e) { const el = e.currentTarget; if (el && !el.contains(e.relatedTarget)) el.classList.remove('drag'); },
    drop(e, id) {
        e.preventDefault();
        const el = e.currentTarget; if (el) el.classList.remove('drag');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { dragging = null; return addFiles(id, e.dataTransfer.files); }
        if (!dragging) return;
        const from = secById(dragging.id), to = secById(id); if (!from || !to || to.kind === 'index') { dragging = null; return; }
        const d = from.docs.splice(dragging.i, 1)[0];
        const over = e.target.closest && e.target.closest('[data-doc]');
        let at = over ? to.docs.findIndex(x => x.id === over.getAttribute('data-doc')) : -1;
        if (at < 0) at = to.docs.length;
        to.docs.splice(at, 0, d);
        dragging = null; save(); render();
    },
    async build(mode) {
        if (!window.PDFLib) { alert('The PDF tool could not be loaded. Check your connection and try again.'); return; }
        if (S.busy) return;
        S.busy = 'Building the packet…'; renderSide();
        try {
            const pk = P(), r = await assemble(), name = fileName();
            pk.builtAt = new Date().toISOString();
            if (!pk.changedAt || pk.changedAt > pk.builtAt) pk.changedAt = pk.builtAt;
            S.built = Object.assign({ type: S.type, at: pk.changedAt, builtAt: pk.builtAt }, r);
            save(false);
            if (S.preview) URL.revokeObjectURL(S.preview);
            S.preview = URL.createObjectURL(new Blob([r.bytes], { type: 'application/pdf' }));
            if (mode === 'zip') {
                const { PDFDocument } = window.PDFLib, all = await PDFDocument.load(r.bytes), z = new JSZip();
                const groups = [];
                r.parts.forEach(p => { const g = groups[groups.length - 1]; if (g && g.sec === p.sec) g.to = p.to; else groups.push({ sec: p.sec, title: p.title, from: p.from, to: p.to }); });
                for (let i = 0; i < groups.length; i++) {
                    const g = groups[i], one = await PDFDocument.create(), idx = [];
                    for (let k = g.from; k <= g.to; k++) idx.push(k - 1);
                    (await one.copyPages(all, idx)).forEach(pg => one.addPage(pg));
                    z.file(`${pad2(i + 1)} - ${g.title.replace(/[\\/:*?"<>|]/g, '')}.pdf`, await one.save());
                }
                z.file(name + '.pdf', r.bytes);
                download(await z.generateAsync({ type: 'blob' }), name + '.zip');
            } else if (mode !== 'none') download(new Blob([r.bytes], { type: 'application/pdf' }), name + '.pdf');
            S.busy = ''; render();
            const prev = document.getElementById('pk-prev'); if (prev && mode !== 'none') prev.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return { total: r.total, rows: r.rows, parts: r.parts };
        } catch (e) {
            S.busy = ''; renderSide();
            alert('The packet could not be built:\n' + e.message);
            return null;
        }
    },
    async csv() {
        let rows = S.built && S.built.type === S.type ? S.built.rows : null;
        if (!rows || !P().builtAt || P().changedAt > P().builtAt) {
            if (!window.PDFLib) { alert('The PDF tool could not be loaded.'); return; }
            try { rows = (await assemble()).rows; } catch (e) { alert('The index could not be made:\n' + e.message); return; }
        }
        const q = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
        const lines = [['Section', 'Exhibit', 'Description', 'Date', 'Source', 'Pages', 'Bates'].map(q).join(',')];
        let cur = '';
        rows.forEach(r => { if (r.section) cur = r.section; else lines.push([cur, r.ex, r.desc, r.date, r.source, r.pages, r.bates].map(q).join(',')); });
        download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }), fileName() + ' - Index.csv');
    },
    check() {
        const res = runChecks(), box = document.getElementById('pk-check');
        if (box) {
            box.hidden = false;
            box.querySelector('[data-body]').innerHTML = `<p style="margin:0 0 8px;"><b>${res.score}%</b> · ${res.passed} of ${res.checks.length} checks passed</p>
                <ul class="pk-checks">${res.checks.map(c => `<li class="${c.ok ? 'ok' : 'no'}">${esc(c.label)}${c.ok ? '' : `<small>${esc(c.detail)}</small>`}</li>`).join('')}</ul>`;
            box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        return res;
    },
    async submit() {
        const res = API.check(), failed = res.checks.filter(c => !c.ok);
        if (failed.length && !confirm(`Check my packet found ${failed.length} thing${failed.length === 1 ? '' : 's'} to fix (${res.score}%). Send it to your trainer anyway?`)) return;
        const pk = P();
        await Sim.saveResult({
            simulator: 'Drafting — Demand Packet',
            scenario: TYPES[S.type].name + (pk.case.client ? ' · ' + pk.case.client : ''),
            score: res.score,
            summary: `Check my packet ${res.score}% · ${res.passed} of ${res.checks.length} checks passed` + (S.built && S.built.type === S.type ? ` · ${S.built.total} pages built` : ' · not built'),
            details: { type: S.type, fileName: fileName() + '.pdf', checks: res.checks.map(c => ({ check: c.label, ok: c.ok, detail: c.detail })),
                index: S.built && S.built.type === S.type ? S.built.rows : null, sections: pk.sections.map(s => ({ title: s.title, documents: s.docs.length })) }
        });
        alert(fileRec().filed ? 'Sent to your trainer.' : 'Sent to your trainer. File the packet itself into the case in the CMS too.');
    },
    reset() {
        if (!confirm(`Start the ${TYPES[S.type].short} over? Every document and everything typed in it is removed.`)) return;
        P().sections.forEach(s => s.docs.forEach(d => fileDel(d.id)));
        S.packets[S.type] = freshPacket(S.type); S.built = null;
        if (S.preview) { URL.revokeObjectURL(S.preview); S.preview = null; }
        save(false); render();
    },
    file: fileIt,
    state: () => S, packet: P, files: FILES      // for the tests
};
window.LSHPacket = API;

// Files this browser no longer has (cleared site data) are marked, so the trainee knows to add them again.
async function markLost() {
    const all = Object.values(S.packets).flatMap(p => p.sections.flatMap(s => s.docs));
    let changed = false;
    for (const d of all) { const has = !!(await fileGet(d.id)); if (!!d.lost === has) { d.lost = !has; changed = true; } }
    if (changed) render();
}

document.getElementById('topbar').innerHTML = Sim.topbar('packet');
Sim.label('Demand Packets & Binders');
// A course can open a given packet: ?type=demand | mediation | arbitration
// and the course's open case (?case=), which fills the Case ID when the trainee hasn't typed one.
function fromLink() {
    const q = new URLSearchParams(location.search), t = q.get('type'), c = (q.get('case') || '').trim();
    if (t && TYPES[t]) S.type = t;
    if (c && !String(P().case.caseId || '').trim()) P().case.caseId = c;
}
load(); fromLink(); render(); markLost();
Sim.restore().then(() => {
    load(); fromLink(); render(); markLost();      // the signed-in trainee's own packets, now that we know who they are
    document.getElementById('topbar').innerHTML = Sim.topbar('packet');
});
}());

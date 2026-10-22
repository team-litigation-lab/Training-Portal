/* LSH Training Portal — Appellate E-Filing simulator.

   Appeals are filed differently from everything else a paralegal files, and the differences
   are where appeals get lost: the notice of appeal goes in the TRIAL court on a deadline
   that cannot be extended, the briefs go in the APPELLATE court under a length limit and a
   cover color, and an emergency stay has to reach a judge before the sheriff does.

   The numbers are state-specific and come from the state dropdown (filing-states.js): how
   many days to appeal, the fee, the word limit, the cover color, what the record is called.
   The wizard, the filing folder and the grading are the same in every state — which is the
   point: learn the filing once, then read your state's number off the panel. */
(function () {
const E = Sim.esc, KEY = 'LSH_APPELLATE_V1';
const clone = (o) => JSON.parse(JSON.stringify(o));
const money = FilingStates.money;
const STEPS = {
    'ap-noa': [['deadline', 'Appeal Deadline'], ['case', 'Case'], ['type', 'Document Type'], ['appealsfrom', 'Appealed From'], ['party', 'Filing Party'], ['docs', 'Documents'], ['service', 'Service'], ['fees', 'Fees & Payment'], ['review', 'Review & Submit']],
    'ap-aob': [['case', 'Appeal'], ['type', 'Document Type'], ['party', 'Filing Party'], ['docs', 'Documents'], ['length', 'Length & Cover'], ['service', 'Service'], ['fees', 'Fees & Payment'], ['review', 'Review & Submit']],
    'ap-stay': [['case', 'Appeal'], ['type', 'Document Type'], ['party', 'Filing Party'], ['notice', 'Notice to Opposing Counsel'], ['docs', 'Documents'], ['service', 'Service'], ['fees', 'Fees & Payment'], ['review', 'Review & Submit']]
};
const PAY = ['Firm operating account — Visa ••4421', 'Client trust (IOLTA) account', 'My personal card'];
/* Court fee by scenario: the notice of appeal carries the state's appellate filing fee, a
   brief carries none, an emergency petition carries the court's motion fee. */
const COURT_FEE = { 'ap-noa': (p) => p.noaFee, 'ap-aob': () => 0, 'ap-stay': () => 150 };

let S = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.f) return s; } catch (e) {} return { sc: null, f: {}, st: FilingStates.current() }; })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const sc = () => AP_SCENARIOS.find(x => x.id === S.sc);
const P = () => FilingStates.get(S.st);
function F() {
    const s = sc(); if (!s) return null;
    if (!S.f[s.id]) S.f[s.id] = { step: 0, folder: clone(s.folder), a: { attachments: [], contacts: [] }, submitted: null, inspect: null, msg: '' };
    return S.f[s.id];
}
const doc = (id) => F().folder.find(d => d.id === id);
const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, '');
const fmt = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (isoDate, n) => { const d = new Date(isoDate + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d; };
/* The appeal deadline, measured from the date the notice of entry was served. */
const dueDate = (s, p) => addDays(s.noticeServed, p.noa.days);
const courtName = (s, p) => s.stage === 'trial' ? p.trialCourt : p.appealsCourt;

// ---------- render ----------
function render() {
    document.getElementById('topbar').innerHTML = Sim.topbar('appellate');
    const app = document.getElementById('app');
    const p = P();
    if (!sc()) { app.innerHTML = statePanel(p) + picker(); Sim.label('Appellate E-Filing'); return; }
    const s = sc(), f = F(), steps = STEPS[s.id];
    Sim.label('Appellate E-Filing · ' + s.short);
    app.innerHTML = `
    <div class="sim-card ef-top"><div><div class="mr-k">${s.stage === 'trial' ? 'Filed in the trial court (appeal opens here)' : 'Filed in the reviewing court'}</div><b>${E(courtName(s, p))}</b>
        <div class="sim-muted ef-small">${E(s.when)}${s.appealNumber ? ' · Appeal No. ' + E(s.appealNumber) : ''}</div></div>
        <div class="dk-row">${FilingStates.picker('AP.state')}<button class="sim-btn ghost" onclick="AP.back()">← All Scenarios</button><button class="sim-btn ghost" onclick="AP.restart()">↺ Start Over</button></div></div>
    <div class="sim-card ef-brief"><b>Your assignment:</b> ${E(s.brief)}</div>
    ${f.submitted ? receipt(s, f, p) : `<div class="ef-shell">
        <aside class="sim-card ef-folder"><h4>📂 Filing Folder</h4><p class="sim-muted ef-small">Inspect each file before you upload it.</p>
            ${f.folder.map(d => `<button class="ef-file ${f.inspect === d.id ? 'on' : ''}" onclick="AP.inspect('${d.id}')"><span class="ef-ext ${d.kind}">${d.kind.toUpperCase()}</span><span><b>${E(d.name)}</b><small>${E(d.what)}</small></span></button>`).join('')}
            ${f.inspect ? inspector(doc(f.inspect), s, p) : ''}
            <div class="ap-docket"><h4>Docket</h4>${s.docket.map(d => `<div class="ap-dk"><span class="mono">[${d.n}]</span> ${E(d.text)}</div>`).join('')}</div></aside>
        <section class="sim-card ef-wiz"><ol class="ef-steps">${steps.map(([k, l], i) => `<li class="${i === f.step ? 'on' : i < f.step ? 'done' : ''}"><button onclick="AP.go(${i})" ${i > f.step ? 'disabled' : ''}>${i + 1}. ${E(l)}</button></li>`).join('')}</ol>
            ${f.msg ? `<div class="sim-error ef-msg">${E(f.msg)}</div>` : ''}
            <div id="ap-step">${step(s, f, p, steps[f.step][0])}</div></section></div>`}`;
}
function statePanel(p) {
    return `<div class="sim-card fs-panel"><div class="fs-head">${FilingStates.picker('AP.state')}
        <div><b>${E(p.name)}</b><div class="sim-muted ef-small">${E(FilingStates.blurb(p))}</div></div></div>
        <table class="fs-table">
            <tr><th>Reviewing court</th><td>${E(p.appealsCourt)}</td><th>Highest court</th><td>${E(p.highCourt)}</td></tr>
            <tr><th>Time to appeal</th><td>${p.noa.days} days from ${E(p.noa.from)}</td><th>Rule</th><td>${E(p.noa.rule)}</td></tr>
            <tr><th>Notice of appeal fee</th><td>${money(p.noaFee)}</td><th>E-filing provider</th><td>${E(p.provider)}</td></tr>
            <tr><th>Opening brief limit</th><td>${p.briefWords.opening.toLocaleString()} words</td><th>Cover colors</th><td>opening ${E(p.coverColors.opening)} · answering ${E(p.coverColors.answering)} · reply ${E(p.coverColors.reply)}</td></tr>
            <tr><th>The record</th><td colspan="3">${E(p.record)}</td></tr>
        </table>${p.note ? `<p class="ef-small sim-muted">${E(p.note)}</p>` : ''}
        <p class="ef-small sim-muted">Training figures. Deadlines, fees and limits move: check the court's own rules before a real filing.</p></div>`;
}
function picker() {
    return `<div class="ef-pick">${AP_SCENARIOS.map(s => { const f = S.f[s.id], r = f && f.submitted && f.submitted.grade; return `<div class="sim-card ef-sc" onclick="AP.pick('${s.id}')">
        <div class="dk-row"><span class="sim-chip ${s.stage === 'trial' ? 'next' : 'live'}">${s.stage === 'trial' ? 'Trial court · opens the appeal' : 'Reviewing court'}</span>${r ? Sim.scoreChip(r.total) : ''}</div>
        <h3>${s.icon} ${E(s.title)}</h3><p>${E(s.brief)}</p></div>`; }).join('')}</div>`;
}
function inspector(d, s, p) {
    if (!d) return '';
    const row = (k, v, bad) => `<tr><th>${k}</th><td class="${bad ? 'bad' : ''}">${v}</td></tr>`;
    const limit = s.briefKind ? p.briefWords[s.briefKind] : 0;
    return `<div class="ef-insp"><b>${E(d.name)}</b><table>
        ${row('Format', d.kind === 'pdf' ? 'PDF' : 'Word document (.docx)', d.kind !== 'pdf')}
        ${row('Pages / size', `${d.pages} pages · ${d.sizeMB} MB`, d.sizeMB > p.limitMB)}
        ${row('Text-searchable', d.searchable ? 'Yes' : 'No (scanned image)', !d.searchable)}
        ${d.words ? row('Word count', `${d.words.toLocaleString()} words${limit ? ` (limit ${limit.toLocaleString()})` : ''}`, limit && d.words > limit) : ''}
        ${d.cover ? row('Cover', `${d.cover} cover`, s.briefKind && d.cover !== p.coverColors[s.briefKind]) : ''}
        ${d.signed !== null && d.signed !== undefined ? row('Signature block', d.signed ? '/s/ signature present' : 'No signature', !d.signed) : ''}
        ${d.cos !== null && d.cos !== undefined ? row('Proof of service', d.cos ? 'Included' : 'Not included', !d.cos) : ''}
        ${row('Password protection', d.password ? 'Password-protected' : 'None', d.password)}
        ${row('Personal identifiers', d.pii.length ? E(d.pii.join('; ')) : 'None found', d.pii.length)}
        ${d.sealed ? row('Court order', 'SEALED by order of the trial court — not for public filing', true) : ''}
        ${d.redacted ? row('Redaction', 'Redacted per ' + E(p.redactionRule)) : ''}
    </table><div class="ef-tools">
        ${!d.searchable && d.kind === 'pdf' ? `<button onclick="AP.fix('${d.id}','ocr')">Run OCR</button>` : ''}
        ${d.signed === false && d.kind === 'pdf' ? `<button onclick="AP.fix('${d.id}','sign')">Add /s/ signature</button>` : ''}
        ${d.cos === false && d.kind === 'pdf' ? `<button onclick="AP.fix('${d.id}','cos')">Add proof of service</button>` : ''}
        ${d.pii.length ? `<button onclick="AP.fix('${d.id}','redact')">Redact identifiers</button>` : ''}
        ${d.sizeMB > p.limitMB ? `<button onclick="AP.fix('${d.id}','split')">Split file</button>` : ''}
        ${d.password ? `<button onclick="AP.fix('${d.id}','unlock')">Remove password</button>` : ''}
        ${limit && d.words > limit ? `<button onclick="AP.fix('${d.id}','trim')">Cut to the word limit</button>` : ''}
        ${d.cover && s.briefKind && d.cover !== p.coverColors[s.briefKind] ? `<button onclick="AP.fix('${d.id}','cover')">Set the ${E(p.coverColors[s.briefKind])} cover</button>` : ''}
    </div><p class="sim-muted ef-small">${E(p.appealsCourt)}: ${p.limitMB} MB per file, PDF only, text-searchable, no password protection.</p></div>`;
}
const opt = (v, cur, label) => `<option value="${E(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${E(label || v)}</option>`;
const next = (label) => `<div class="lx-acts"><button class="sim-btn primary" onclick="AP.next()">${label || 'Next →'}</button></div>`;

function step(s, f, p, k) {
    const a = f.a;
    switch (k) {
    case 'deadline': {
        const due = dueDate(s, p), checked = a.dueDate != null;
        return `<h3>Is the appeal still on time?</h3>
        <p class="ef-small">Nothing else matters until you know this. In ${E(p.name)} the notice of appeal is due <b>${p.noa.days} days</b> from ${E(p.noa.from)} — ${E(p.noa.rule)}. The deadline to appeal cannot be extended by stipulation, and a late notice of appeal ends the case.</p>
        <table class="ef-sum"><tr><th>Judgment entered</th><td>${fmt(new Date(s.judgmentEntered + 'T12:00:00Z'))}</td></tr>
            <tr><th>Notice of entry served</th><td>${fmt(new Date(s.noticeServed + 'T12:00:00Z'))}</td></tr>
            <tr><th>Today</th><td>${fmt(new Date(s.today + 'T12:00:00Z'))}</td></tr></table>
        <label class="ef-lbl">Count it: the notice of appeal is due on<input type="date" id="ap-due" value="${E(a.dueDate || '')}"></label>
        <div class="lx-acts"><button class="sim-btn ghost" onclick="AP.checkDue()">Check the Deadline</button></div>
        ${checked ? `<div class="${a.dueDate === iso(due) ? 'ef-found' : 'sim-error'}">${a.dueDate === iso(due)
            ? `✓ Due ${fmt(due)}. Today is ${fmt(new Date(s.today + 'T12:00:00Z'))}, so the appeal is still timely — file it today and don't let it sit.`
            : `That isn't the date. Count ${p.noa.days} days from ${fmt(new Date(s.noticeServed + 'T12:00:00Z'))}.`}</div>${a.dueDate === iso(due) ? next() : ''}` : ''}`;
    }
    case 'case': return `<h3>${s.stage === 'trial' ? 'Case Number' : 'Appeal Number'}</h3>
        <p class="sim-muted ef-small">${s.stage === 'trial' ? 'The notice of appeal is filed in the trial court, in the case being appealed — the reviewing court has no case number yet.' : 'The appeal has its own number in ' + E(p.appealsCourt) + '.'}</p>
        <label class="ef-lbl">Enter the number<input id="ap-case" value="${E(a.caseNumber || '')}" placeholder="${s.stage === 'trial' ? E(s.caseNumber) : 'e.g. A-26-0000'}"></label>
        <div class="lx-acts"><button class="sim-btn ghost" onclick="AP.findCase()">Find This Case</button></div>
        ${a.caseFound ? `<div class="ef-found">✓ ${E(a.caseFound)}</div>${next()}` : ''}`;
    case 'type': return `<h3>Document Type</h3><p class="sim-muted ef-small">The document type sets what the court does with the filing, and what it charges for it.</p>
        ${s.docTypes.map(t => `<label class="ef-opt"><input type="radio" name="dt" value="${E(t)}" ${a.docType === t ? 'checked' : ''} onchange="AP.set('docType',this.value)"> ${E(t)}</label>`).join('')}${next()}`;
    case 'appealsfrom': return `<h3>What is being appealed?</h3><p class="sim-muted ef-small">The notice of appeal has to identify the judgment or order it appeals from. Pick the entry.</p>
        ${s.docket.map(d => `<label class="ef-opt"><input type="radio" name="af" value="${d.n}" ${String(a.appealsFrom) === String(d.n) ? 'checked' : ''} onchange="AP.set('appealsFrom',this.value)"> [${d.n}] ${E(d.text)}</label>`).join('')}
        <label class="ef-opt"><input type="checkbox" ${a.record ? 'checked' : ''} onchange="AP.set('record',this.checked)"> Also designate ${E(p.record)} with this filing</label>
        ${a.record ? `<label class="ef-lbl">What are you designating?<select onchange="AP.set('recordChoice',this.value)"><option value="">Choose…</option>${(p.recordChoices || []).map(c => opt(c, a.recordChoice)).join('')}</select></label>` : ''}${next()}`;
    case 'party': return `<h3>Filing Party</h3>${s.parties.map(x => `<label class="ef-opt"><input type="radio" name="pt" value="${x.id}" ${a.party === x.id ? 'checked' : ''} onchange="AP.set('party','${x.id}')"> ${E(x.name)} (${E(x.role)})</label>`).join('')}${next()}`;
    case 'notice': return `<h3>Notice to Opposing Counsel</h3>
        <p class="ef-small">A court asked to act on hours' notice wants to know the other side was told. Before you file an emergency petition, counsel must be given notice of when and where it is being filed and what relief it asks for — and the declaration has to say so.</p>
        <label class="ef-opt"><input type="radio" name="nt" value="called" ${a.notice === 'called' ? 'checked' : ''} onchange="AP.set('notice','called')"> Call and email Brightway's counsel now with the time of filing and the relief sought, and note it in the declaration</label>
        <label class="ef-opt"><input type="radio" name="nt" value="serve" ${a.notice === 'serve' ? 'checked' : ''} onchange="AP.set('notice','serve')"> Skip it: they'll get the e-service notification when it's filed</label>
        <label class="ef-opt"><input type="radio" name="nt" value="none" ${a.notice === 'none' ? 'checked' : ''} onchange="AP.set('notice','none')"> No notice — surprise is the point of an emergency application</label>${next()}`;
    case 'docs': return docsStep(s, f, p);
    case 'length': return lengthStep(s, f, p);
    case 'service': return `<h3>Service</h3><p class="sim-muted ef-small">Everyone entitled to notice gets served with this filing.</p>
        ${s.serviceContacts.map(c => `<label class="ef-opt"><input type="checkbox" ${a.contacts.includes(c.id) ? 'checked' : ''} onchange="AP.toggle('contacts','${c.id}',this.checked)"> ${E(c.name)} <span class="sim-muted">&lt;${E(c.email)}&gt;</span></label>`).join('')}
        <label class="ef-lbl">How<select onchange="AP.set('svc',this.value)"><option value="">Choose…</option>${opt('eserve', a.svc, 'E-serve through the provider now')}${opt('mail', a.svc, 'Mail paper copies')}${opt('none', a.svc, 'No service')}</select></label>${next()}`;
    case 'fees': return feesStep(s, f, p);
    case 'review': return reviewStep(s, f, p);
    }
    return '';
}
function docsStep(s, f, p) {
    const a = f.a;
    return `<h3>Lead Document and Attachments</h3>
        <label class="ef-lbl">Lead document<select onchange="AP.upload(this.value)"><option value="">Choose a file…</option>${f.folder.map(d => opt(d.id, a.lead, d.name)).join('')}</select></label>
        <h4 class="ef-h4">Attachments</h4>
        ${a.attachments.map((x, i) => `<div class="ef-att"><span class="mono">#${i + 1}</span><b>${E((doc(x.doc) || {}).name || '(removed)')}</b>
            <select onchange="AP.att(${i},'type',this.value)">${AP_ATTACH_TYPES.map(t => opt(t, x.type)).join('')}</select>
            <input placeholder="Description" value="${E(x.desc || '')}" oninput="AP.att(${i},'desc',this.value,true)"><button class="dk-x" onclick="AP.dropAtt(${i})" title="Remove">✕</button></div>`).join('') || '<p class="sim-muted ef-small">No attachments.</p>'}
        <div class="ef-addatt"><select id="ap-addatt"><option value="">Add an attachment…</option>${f.folder.filter(d => d.id !== a.lead && !a.attachments.some(x => x.doc === d.id)).map(d => opt(d.id, '', d.name)).join('')}</select><button class="sim-btn ghost" onclick="AP.addAtt()">＋ Add</button></div>
        ${next()}`;
}
function lengthStep(s, f, p) {
    const a = f.a, d = doc(a.lead) || {}, limit = p.briefWords[s.briefKind], over = d.words && d.words > limit;
    return `<h3>Length and Cover</h3>
        <p class="ef-small">${E(p.appealsCourt)} limits an opening brief to <b>${limit.toLocaleString()} words</b>, and the brief must certify its own count. The cover of an opening brief is <b>${E(p.coverColors[s.briefKind])}</b>.</p>
        <table class="ef-sum"><tr><th>Brief as filed</th><td>${d.words ? d.words.toLocaleString() + ' words' : '—'}</td></tr>
            <tr><th>Limit</th><td>${limit.toLocaleString()} words</td></tr>
            <tr><th class="${over ? 'bad' : ''}">Over by</th><td class="${over ? 'bad' : ''}">${over ? (d.words - limit).toLocaleString() + ' words' : 'Within the limit'}</td></tr>
            <tr><th>Cover</th><td class="${d.cover && d.cover !== p.coverColors[s.briefKind] ? 'bad' : ''}">${E(d.cover || '—')}</td></tr></table>
        ${over ? `<div class="sim-error">The brief is over the limit. Cut it to the limit in the folder, or ask the court for leave to file a longer brief before you file it — the clerk will not simply take an oversized brief.</div>` : ''}
        <label class="ef-opt"><input type="radio" name="ln" value="within" ${a.length === 'within' ? 'checked' : ''} onchange="AP.set('length','within')"> The brief is within the limit and the certificate states the count</label>
        <label class="ef-opt"><input type="radio" name="ln" value="motion" ${a.length === 'motion' ? 'checked' : ''} onchange="AP.set('length','motion')"> File an application for leave to file an oversized brief first</label>
        <label class="ef-opt"><input type="radio" name="ln" value="asis" ${a.length === 'asis' ? 'checked' : ''} onchange="AP.set('length','asis')"> File it as it is and let the clerk decide</label>${next()}`;
}
const fees = (s, p) => ({ court: COURT_FEE[s.id](p), efsp: p.efspFee });
function feesStep(s, f, p) {
    const x = fees(s, p);
    return `<h3>Fees and Payment</h3><table class="ef-fees"><tr><td>${s.stage === 'trial' ? 'Appellate filing fee (paid to the trial court clerk)' : 'Court fee'}</td><td>${money(x.court)}</td></tr>
        <tr><td>E-filing provider fee</td><td>${money(x.efsp)}</td></tr><tr class="t"><td>Total</td><td>${money(x.court + x.efsp)}</td></tr></table>
        ${s.id === 'ap-noa' ? `<p class="ef-small sim-muted">${E(p.name)} charges ${money(p.noaFee)} to take the appeal. A notice of appeal filed without the fee can be rejected, and the deadline keeps running.</p>` : ''}
        <label class="ef-lbl">Pay from<select onchange="AP.set('pay',this.value)"><option value="">Choose a payment account…</option>${PAY.map(v => opt(v, f.a.pay)).join('')}</select></label>${next()}`;
}
function reviewStep(s, f, p) {
    const a = f.a, lead = doc(a.lead), x = fees(s, p);
    return `<h3>Review and Submit</h3><table class="ef-sum">
        <tr><th>Court</th><td>${E(courtName(s, p))} · ${E(p.name)}</td></tr>
        <tr><th>${s.stage === 'trial' ? 'Case' : 'Appeal'}</th><td>${E(a.caseNumber || '—')} — ${E(s.caption)}</td></tr>
        <tr><th>Document type</th><td>${E(a.docType || '—')}</td></tr>
        ${s.id === 'ap-noa' ? `<tr><th>Deadline</th><td>${a.dueDate ? fmt(new Date(a.dueDate + 'T12:00:00Z')) : '—'}</td></tr>
            <tr><th>Appealed from</th><td>${a.appealsFrom ? '[' + E(a.appealsFrom) + ']' : '—'}</td></tr>
            <tr><th>Record</th><td>${a.record ? E(a.recordChoice || 'designated') : 'Not designated with this filing'}</td></tr>` : ''}
        ${s.id === 'ap-aob' ? `<tr><th>Length</th><td>${lead && lead.words ? lead.words.toLocaleString() + ' words (limit ' + p.briefWords[s.briefKind].toLocaleString() + ')' : '—'} · ${E(a.length || '—')}</td></tr>` : ''}
        ${s.id === 'ap-stay' ? `<tr><th>Notice to counsel</th><td>${a.notice === 'called' ? 'Given by phone and email, stated in the declaration' : a.notice === 'serve' ? 'None beyond e-service' : a.notice === 'none' ? 'None' : '—'}</td></tr>` : ''}
        <tr><th>Filing party</th><td>${E((s.parties.find(y => y.id === a.party) || {}).name || '—')}</td></tr>
        <tr><th>Lead document</th><td>${lead ? E(lead.name) : '—'}</td></tr>
        <tr><th>Attachments</th><td>${a.attachments.map((y, i) => `#${i + 1} ${E(y.type)}: ${E((doc(y.doc) || {}).name || '')}${y.desc ? ' — ' + E(y.desc) : ''}`).join('<br>') || 'None'}</td></tr>
        <tr><th>Service</th><td>${E(s.serviceContacts.filter(c => a.contacts.includes(c.id)).map(c => c.name).join('; ') || 'None')}${a.svc ? ' · ' + E(a.svc) : ''}</td></tr>
        <tr><th>Fees</th><td>${money(x.court + x.efsp)} from ${E(a.pay || '—')}</td></tr>
    </table>
    <div class="ef-warn">Submitting sends the envelope to the clerk. ${s.stage === 'trial' ? 'The appeal deadline keeps running until a notice of appeal is accepted.' : 'A brief the clerk rejects is not filed, and the due date does not move.'}</div>
    <div class="lx-acts"><button class="sim-btn orange" onclick="AP.submit()">Submit Envelope</button></div>`;
}

// ---------- grading ----------
function grade(s, f, p) {
    const a = f.a, items = [], add = (label, ok, max, why, part) => items.push({ label, got: ok ? max : (part || 0), max, why: ok ? '' : why });
    const att = (id) => a.attachments.find(x => x.doc === id || x.doc.startsWith(id + '_'));
    const filed = (d) => a.lead === d.id || a.attachments.some(x => x.doc === d.id || x.doc.startsWith(d.id + '_'));
    const bad = f.folder.filter(d => (d.privileged || d.sealed || d.kind !== 'pdf') && filed(d));
    const lead = doc(a.lead) || {};
    const reject = [];
    add('Document type', a.docType === s.answer.docType, 10, `You chose "${a.docType || 'nothing'}". The filing is a ${s.answer.docType}.`);
    if (a.docType && a.docType !== s.answer.docType) reject.push(`Wrong document type: the court docketed nothing because "${a.docType}" does not match the document filed.`);
    add('Filing party: the appellant', a.party === s.appellantId, 5, `This is ${(s.parties.find(x => x.id === s.appellantId) || {}).name}'s filing.`);
    add('Nothing privileged, sealed or non-PDF filed', !bad.length, 15, `You filed ${bad.map(d => d.name).join(', ')}. Work product stays internal, a sealed record is filed under seal by application and never in a public brief, and the court takes PDFs only.`);
    if (bad.some(d => d.sealed)) reject.push('A document the trial court sealed was filed in the public record.');
    add('Paid from the firm operating account', a.pay === PAY[0], 5, 'Court costs are advanced from the firm\'s operating account, never from client trust funds or a personal card.');

    if (s.id === 'ap-noa') {
        const due = dueDate(s, p);
        add(`Deadline counted correctly (${p.name}: ${p.noa.days} days)`, a.dueDate === iso(due), 15, `The notice of appeal is due ${fmt(due)}: ${p.noa.days} days from the notice of entry under ${p.noa.rule}.`);
        add('Filed in the trial court case', norm(a.caseNumber) === norm(s.caseNumber), 10, `The notice of appeal goes in the trial court case, ${s.caseNumber}. The reviewing court has no number for this appeal yet.`);
        add('Appeals from the judgment [42], not the underlying order', String(a.appealsFrom) === '42', 10, 'Appeal from the judgment entered 07/06/2026 (entry 42). The summary judgment order is not separately appealable; the judgment on it is.');
        add(`${p.record} designated`, !!a.record && !!a.recordChoice, 10, `Designate ${p.record} with the notice of appeal, or the clerk prepares nothing and the appeal stalls.`, a.record ? 5 : 0);
        add('Notice of appeal signed', a.lead === 'noa' && lead.signed, 5, 'The notice of appeal needs the attorney\'s signature.');
        add('Proof of service on the notice of appeal', a.lead === 'noa' && lead.cos, 5, 'A notice of appeal is served on every other party, and the proof of service is filed with it.');
        add('Lead document: the notice of appeal', a.lead === 'noa', 10, 'The notice of appeal is the lead document.');
        add('Opposing counsel served, the adjuster not', a.contacts.includes('dc') && !a.contacts.includes('adj'), 10, a.contacts.includes('adj') ? 'The claims adjuster is not a party or counsel: serving the filing on them is not service, and it hands the carrier your appellate strategy.' : 'Serve counsel of record for the respondents.', a.contacts.includes('dc') ? 5 : 0);
        if (!a.lead || a.lead !== 'noa') reject.push('The lead document is not a notice of appeal.');
        if (a.pay && a.pay !== PAY[0] && a.pay === PAY[1]) reject.push('Paid from client trust funds: the clerk accepted the filing, but the firm has a trust-accounting problem to fix.');
    } else if (s.id === 'ap-aob') {
        const limit = p.briefWords[s.briefKind];
        add('Filed in the appeal, by its appellate number', norm(a.caseNumber) === norm(s.appealNumber), 10, `Once an appeal is docketed, the brief is filed under its appellate number, ${s.appealNumber}.`);
        add('Lead document: the opening brief', a.lead === 'aob', 10, 'The brief is the lead document; everything else is an attachment.');
        add(`Brief within the ${p.name} limit (${limit.toLocaleString()} words)`, a.lead === 'aob' && lead.words <= limit, 15, `The brief ran ${(s.folder.find(d => d.id === 'aob').words).toLocaleString()} words against a ${limit.toLocaleString()}-word limit. Cut it, or get leave to file an oversized brief before filing.`);
        add('Length handled the right way', a.length === 'within' && lead.words <= limit, 5, a.length === 'asis' ? 'An oversized brief is not for the clerk to excuse: it comes back rejected and the due date has not moved.' : 'Cut the brief to the limit — leave to file an oversized brief is asked for before the brief is due, and is rarely given.');
        if (lead.words > limit) reject.push(`The brief exceeds the ${limit.toLocaleString()}-word limit and no application for leave to file an oversized brief was granted.`);
        add(`Cover: ${p.coverColors[s.briefKind]} (${p.name} rule)`, a.lead === 'aob' && lead.cover === p.coverColors[s.briefKind], 10, `An opening brief in ${p.appealsCourt} has a ${p.coverColors[s.briefKind]} cover. The cover color tells the court which brief it is holding.`);
        const cwc = att('cwc'); add('Certificate of word count attached', cwc && cwc.type === 'Certificate of Word Count', 10, 'The brief must be accompanied by a certificate of compliance with the length limit.', cwc ? 5 : 0);
        if (!cwc) reject.push('No certificate of compliance with the length limit.');
        const cie = att('cie'); add('Certificate of interested entities attached', cie && cie.type === 'Certificate of Interested Entities', 5, 'File the certificate of interested entities or persons with the opening brief so the justices can check for conflicts.', cie ? 3 : 0);
        const eor = att('eor') || att('eor_1');
        add('Excerpts of record attached, searchable and under the size limit', !!att('eor_1') && !!att('eor_2') && f.folder.filter(d => d.id.startsWith('eor')).every(d => d.searchable), 15, eor ? `The excerpts were ${s.folder.find(d => d.id === 'eor').sizeMB} MB and scanned. Split them under ${p.limitMB} MB and OCR them: the court reads the record on a screen and searches it.` : 'The brief cites the record; file the excerpts of record with it.', eor ? 7 : 0);
        add('Brief served on counsel and the trial court', a.contacts.includes('dc') && a.contacts.includes('trial') && !a.contacts.includes('adj'), 10, a.contacts.includes('adj') ? 'The adjuster is not entitled to service.' : 'Serve respondents\' appellate counsel, and file a copy with the trial court as the rules require.', a.contacts.includes('dc') ? 5 : 0);
        add('Proof of service with the brief', a.lead === 'aob' && lead.cos, 5, 'Attach the proof of service to the brief.');
    } else {
        add('Filed in the appeal, by its appellate number', norm(a.caseNumber) === norm(s.appealNumber), 10, `The petition is filed in the pending appeal, ${s.appealNumber}.`);
        add('Opposing counsel given notice before filing', a.notice === 'called', 15, 'A court asked for relief on a day\'s notice wants to see that the other side was told when and where you were filing and what you were asking for. E-service after the fact is not notice.');
        if (a.notice === 'none') reject.push('Emergency relief sought without notice to opposing counsel and without a declaration explaining why.');
        add('Lead document: the petition', a.lead === 'pet', 10, 'The petition for a stay is the lead document.');
        add('Password removed from the petition', a.lead === 'pet' && !lead.password, 10, 'A password-protected PDF cannot be processed; the clerk rejects it and the levy happens Monday.');
        const decl = att('decl'); add('Declaration of counsel attached', decl && decl.type === 'Declaration', 10, 'The declaration is what tells the court about the emergency and the notice given.', decl ? 5 : 0);
        const ord = att('ord'); add('Order being challenged attached and searchable', ord && doc(ord.doc).searchable, 10, ord ? 'The order was a scanned image: OCR it so the justices can read and search it.' : 'Attach the order denying the stay and the writ of execution — the court cannot act without seeing them.', ord ? 5 : 0);
        const po = att('po'); add('Proposed order attached', po && po.type === 'Proposed Order', 5, 'Give the court the order you want signed, so it can grant the stay in minutes.', po ? 3 : 0);
        const bank = att('bank'); add('Bank statements redacted before filing', !bank || doc(bank.doc).redacted, 10, `The bank statements went up with a full account number and an SSN. Redact them under ${p.redactionRule} — an appellate filing is public the moment it posts.`);
        add('Counsel served, not risk management', a.contacts.includes('dc') && !a.contacts.includes('adj'), 5, 'Serve counsel of record.');
    }
    const total = Math.round(items.reduce((x, i) => x + i.got, 0) / items.reduce((x, i) => x + i.max, 0) * 100);
    return { total, items, reject };
}

// ---------- receipt ----------
function receipt(s, f, p) {
    const r = f.submitted, g = r.grade;
    let head;
    if (!r.reviewed) head = `<h3>Envelope ${r.envelope}: Submitted</h3><p>Status: <span class="mr-st warn">Pending clerk review</span>. Submitted ${E(r.stamp)} to ${E(courtName(s, p))}.${s.urgent ? ' You called the clerk\'s emergency line to say it is there.' : ''}</p>
        <div class="lx-acts"><button class="sim-btn primary" onclick="AP.clerk()">Check Envelope Status ▶</button></div>`;
    else head = g.reject.length
        ? `<h3>Envelope ${r.envelope}: <span class="bad">Rejected</span></h3><div class="sim-error">${g.reject.map(E).join('<br>')}</div>
           <p class="sim-muted">Nothing was filed and no fee was charged. ${s.stage === 'trial' ? 'The appeal deadline did not stop running while the envelope sat in the queue.' : 'The brief is still due on the date the court set.'}</p>`
        : `<h3>Envelope ${r.envelope}: <span class="ok">Accepted</span></h3><p>${s.id === 'ap-noa'
            ? `The notice of appeal is filed and the clerk has started ${E(p.record)}. Appeal docketed in ${E(p.appealsCourt)} as <b class="mono">${E(r.newAppeal)}</b>.`
            : s.id === 'ap-stay' ? `Filed and referred to the duty panel. A temporary stay issued this evening; the levy is off the calendar pending the court's ruling.`
            : `The opening brief is filed. The respondents' answering brief is due in 30 days, and your reply 20 days after that.`}</p>`;
    return `<div class="sim-card">${head}</div>
    ${r.reviewed ? `<div class="sim-card dk-res"><div class="dk-res-top"><div class="ring">${g.total}%</div><div><h3 style="margin:0">Filing quality review</h3>
        <p class="sim-muted">Reviewed against ${E(p.name)} practice. Reference for the CM course log: <b class="mono">${E(r.ref)}</b></p>
        <div class="lx-acts"><button class="sim-btn ghost" onclick="AP.restart()">↺ File It Again</button><button class="sim-btn ghost" onclick="AP.back()">← All Scenarios</button></div></div></div>
        ${g.items.map(i => `<div class="dk-res-item"><div class="dk-res-h"><b class="${i.got >= i.max ? 'ok' : 'bad'}">${i.got >= i.max ? '✓' : '✗'} ${E(i.label)}</b><span class="mono">${i.got}/${i.max}</span></div>${i.why ? `<p class="ef-small bad">${E(i.why)}</p>` : ''}</div>`).join('')}</div>` : ''}`;
}

// ---------- actions ----------
window.AP = {
    state(code) {
        // Changing the state changes the numbers a filing is graded against, so a filing in
        // progress starts again rather than being graded half under one state's rules.
        const f = S.sc && S.f[S.sc];
        if (f && !f.submitted && (f.step > 0 || f.a.lead) && !confirm('Switching states restarts this filing under that state\'s rules. Continue?')) { render(); return; }
        S.st = code; FilingStates.set(code); if (f && !f.submitted) delete S.f[S.sc]; save(); render();
    },
    pick(id) { S.sc = id; F(); save(); render(); },
    back() { S.sc = null; save(); render(); },
    restart() { if (!confirm('Start this filing over?')) return; delete S.f[S.sc]; save(); render(); },
    go(i) { const f = F(); f.step = i; f.msg = ''; save(); render(); },
    set(k, v, quiet) { const f = F(); f.a[k] = v; save(); if (!quiet) render(); },
    toggle(k, v, on) { const f = F(); f.a[k] = f.a[k].filter(x => x !== v); if (on) f.a[k].push(v); save(); },
    checkDue() { const f = F(); f.a.dueDate = document.getElementById('ap-due').value; save(); render(); },
    findCase() {
        const s = sc(), f = F(), p = P(), v = document.getElementById('ap-case').value.trim(); f.a.caseNumber = v;
        const want = s.stage === 'trial' ? s.caseNumber : s.appealNumber;
        f.a.caseFound = norm(v) === norm(want) ? `${want} — ${s.caption} · ${courtName(s, p)}` : '';
        f.msg = f.a.caseFound ? '' : 'No case found with that number here. Check where this document is filed and under which number.';
        save(); render();
    },
    inspect(id) { const f = F(); f.inspect = f.inspect === id ? null : id; save(); render(); },
    fix(id, tool) {
        const f = F(), p = P(), s = sc(), d = doc(id);
        if (tool === 'ocr') d.searchable = true;
        if (tool === 'sign') d.signed = true;
        if (tool === 'cos') d.cos = true;
        if (tool === 'redact') { d.pii = []; d.redacted = true; }
        if (tool === 'unlock') d.password = false;
        if (tool === 'trim') { d.words = p.briefWords[s.briefKind]; d.pages = Math.round(d.pages * 0.86); }
        if (tool === 'cover') d.cover = p.coverColors[s.briefKind];
        if (tool === 'split') {
            const i = f.folder.indexOf(d), half = Math.ceil(d.pages / 2);
            const parts = [1, 2].map(n => Object.assign(clone(d), { id: `${d.id}_${n}`, name: d.name.replace('.pdf', `_Part${n}.pdf`), pages: n === 1 ? half : d.pages - half, sizeMB: Math.round(d.sizeMB / 2 * 10) / 10, what: d.what + ` (part ${n} of 2)` }));
            f.folder.splice(i, 1, ...parts);
            f.a.attachments = f.a.attachments.filter(x => x.doc !== d.id); if (f.a.lead === d.id) f.a.lead = '';
            f.inspect = parts[0].id;
        }
        save(); render();
    },
    upload(id) {
        const f = F(), p = P(), d = doc(id); f.msg = '';
        if (d && d.kind !== 'pdf') f.msg = `${d.name}: only PDF files can be uploaded.`;
        else if (d && d.sizeMB > p.limitMB) f.msg = `${d.name} is ${d.sizeMB} MB, over the ${p.limitMB} MB limit per file.`;
        else if (d && d.password) f.msg = `${d.name} is password-protected and can't be processed. Remove the password first.`;
        else f.a.lead = id;
        save(); render();
    },
    addAtt() {
        const f = F(), p = P(), id = document.getElementById('ap-addatt').value; if (!id) return;
        const d = doc(id); f.msg = '';
        if (d.kind !== 'pdf') f.msg = `${d.name}: only PDF files can be uploaded.`;
        else if (d.sizeMB > p.limitMB) f.msg = `${d.name} is ${d.sizeMB} MB, over the ${p.limitMB} MB limit per file. Split it first.`;
        else if (d.password) f.msg = `${d.name} is password-protected. Remove the password first.`;
        else f.a.attachments.push({ doc: id, type: AP_ATTACH_TYPES[0], desc: '' });
        save(); render();
    },
    att(i, k, v, quiet) { const f = F(); f.a.attachments[i][k] = v; save(); if (!quiet) render(); },
    dropAtt(i) { const f = F(); f.a.attachments.splice(i, 1); save(); render(); },
    next() {
        const s = sc(), f = F(), p = P(), k = STEPS[s.id][f.step][0], a = f.a;
        // Only the notice of appeal has a deadline step, and only it has the dates to count from.
        const need = { deadline: s.noticeServed && a.dueDate !== iso(dueDate(s, p)) && 'Work out the deadline first — the rest of the filing depends on it.',
            case: !a.caseFound && 'Find the case first.', type: !a.docType && 'Choose the document type.',
            appealsfrom: !a.appealsFrom && 'Say what is being appealed.', party: !a.party && 'Choose the filing party.',
            notice: !a.notice && 'Decide how opposing counsel is told.', docs: !a.lead && 'Choose the lead document.',
            length: !a.length && 'Say how the brief\'s length is handled.', service: (!a.contacts.length || !a.svc) && 'Choose who is served and how.',
            fees: !a.pay && 'Choose a payment account.' }[k];
        if (need) { f.msg = need; save(); render(); return; }
        f.msg = ''; f.step = Math.min(f.step + 1, STEPS[s.id].length - 1); save(); render();
    },
    submit() {
        const s = sc(), f = F(), p = P(), g = grade(s, f, p);
        const when = s.when.match(/(\d\d\/\d\d\/\d{4}), ([\d:]+ [AP]M)/);
        const env = String(Math.floor(26000000 + Math.random() * 999999));
        f.submitted = { stamp: when ? `${when[1]} at ${when[2]}` : s.when, grade: g, envelope: env, ref: `APP-${env}`, reviewed: false,
            newAppeal: 'A-26-' + Math.floor(1000 + Math.random() * 8999) };
        save(); render();
    },
    clerk() {
        const s = sc(), f = F(), p = P(), g = f.submitted.grade;
        f.submitted.reviewed = true;
        Sim.saveResult({ simulator: 'Appellate E-Filing', scenario: `${s.title} (${p.name})`, score: g.total,
            summary: `${g.reject.length ? 'Rejected' : 'Accepted'} · envelope ${f.submitted.envelope} · ${p.name}`,
            details: { ref: f.submitted.ref, state: p.name, rejected: g.reject, items: g.items.filter(i => i.got < i.max).map(i => i.label) } });
        save(); render();
    }
};

// A new tab (a course link opens with noopener, or a bookmark) has the cookie but no copy of the
// session: ask who is signed in before the first render, so results save to the trainee's account.
Sim.restore().then(render);
})();

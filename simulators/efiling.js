/* LSH Training Portal — Court E-Filing simulator.
   Two kinds of e-filing, as US courts run them:
   - Federal (CM/ECF style): category → event → case → filer → the entry it refers to →
     main document and attachments → docket text → submit → Notice of Electronic Filing.
   - State court through an e-filing service provider (envelope style): existing or new
     case → filing code / case type → parties → lead document and attachments → service
     contacts → fees and payment → submit → clerk review (accepted or rejected).
   Documents in the filing folder have properties to inspect and fix (OCR, signature,
   certificate of service, redaction, file size, password). Graded after submission. */
(function () {
const E = Sim.esc, KEY = 'LSH_EFILING_V1';
const clone = (o) => JSON.parse(JSON.stringify(o));
const money = (n) => '$' + Number(n || 0).toFixed(2);
const STEPS = {
    federal: [['event', 'Filing Event'], ['case', 'Case Number'], ['filer', 'Filer'], ['refers', 'Refers To'], ['docs', 'Documents'], ['text', 'Docket Text'], ['review', 'Review & Submit']],
    state: [['type', 'Filing Type'], ['case', 'Case'], ['code', 'Filing Code'], ['party', 'Filing Party'], ['docs', 'Documents'], ['service', 'Service'], ['fees', 'Fees & Payment'], ['review', 'Review & Submit']],
    'state-new': [['type', 'Filing Type'], ['casetype', 'Case Type'], ['parties', 'Parties'], ['docs', 'Documents'], ['service', 'Service'], ['fees', 'Fees & Payment'], ['review', 'Review & Submit']]
};
const PAY = ['Firm operating account — Visa ••4421', 'Client trust (IOLTA) account', 'My personal card'];

let S = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.f) return s; } catch (e) {} return { sc: null, f: {} }; })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const sc = () => EF_SCENARIOS.find(x => x.id === S.sc);
function F() {
    const s = sc(); if (!s) return null;
    if (!S.f[s.id]) S.f[s.id] = { step: 0, folder: clone(s.folder), a: { filers: [], attachments: [], contacts: [] }, submitted: null, inspect: null, msg: '' };
    return S.f[s.id];
}
const doc = (id) => F().folder.find(d => d.id === id);
const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, '');

// ---------- render ----------
function render() {
    document.getElementById('topbar').innerHTML = Sim.topbar('efiling');
    const app = document.getElementById('app');
    if (!sc()) { app.innerHTML = picker(); Sim.label('Court E-Filing'); return; }
    const s = sc(), f = F(), steps = STEPS[s.system];
    Sim.label('Court E-Filing · ' + s.short);
    app.innerHTML = `
    <div class="sim-card ef-top"><div><div class="mr-k">${s.system === 'federal' ? 'Electronic Case Filing (federal style)' : 'E-filing service provider (state court)'}</div><b>${E(s.court)}</b><div class="sim-muted ef-small">${E(s.when)}</div></div>
        <div class="dk-row"><button class="sim-btn ghost" onclick="EF.back()">← All Scenarios</button><button class="sim-btn ghost" onclick="EF.restart()">↺ Start Over</button></div></div>
    <div class="sim-card ef-brief"><b>Your assignment:</b> ${E(s.brief)}</div>
    ${f.submitted ? receipt(s, f) : `<div class="ef-shell">
        <aside class="sim-card ef-folder"><h4>📂 Filing Folder</h4><p class="sim-muted ef-small">Inspect each file before you upload it.</p>
            ${f.folder.map(d => `<button class="ef-file ${f.inspect === d.id ? 'on' : ''}" onclick="EF.inspect('${d.id}')"><span class="ef-ext ${d.kind}">${d.kind.toUpperCase()}</span><span><b>${E(d.name)}</b><small>${E(d.what)}</small></span></button>`).join('')}
            ${f.inspect ? inspector(doc(f.inspect)) : ''}</aside>
        <section class="sim-card ef-wiz"><ol class="ef-steps">${steps.map(([k, l], i) => `<li class="${i === f.step ? 'on' : i < f.step ? 'done' : ''}"><button onclick="EF.go(${i})" ${i > f.step ? 'disabled' : ''}>${i + 1}. ${E(l)}</button></li>`).join('')}</ol>
            ${f.msg ? `<div class="sim-error ef-msg">${E(f.msg)}</div>` : ''}
            <div id="ef-step">${step(s, f, steps[f.step][0])}</div></section></div>`}`;
}
function picker() {
    return `<div class="ef-pick">${EF_SCENARIOS.map(s => { const f = S.f[s.id], r = f && f.submitted && f.submitted.grade; return `<div class="sim-card ef-sc" onclick="EF.pick('${s.id}')">
        <div class="dk-row"><span class="sim-chip ${s.system === 'federal' ? 'next' : 'live'}">${s.system === 'federal' ? 'Federal · CM/ECF style' : 'State · E-filing provider'}</span>${r ? Sim.scoreChip(r.total) : ''}</div>
        <h3>${E(s.title)}</h3><p>${E(s.brief)}</p></div>`; }).join('')}</div>`;
}
function inspector(d) {
    if (!d) return '';
    const row = (k, v, bad) => `<tr><th>${k}</th><td class="${bad ? 'bad' : ''}">${v}</td></tr>`;
    return `<div class="ef-insp"><b>${E(d.name)}</b><table>
        ${row('Format', d.kind === 'pdf' ? 'PDF' : 'Word document (.docx)', d.kind !== 'pdf')}
        ${row('Pages / size', `${d.pages} pages · ${d.sizeMB} MB`, d.sizeMB > EF_LIMIT_MB)}
        ${row('Text-searchable', d.searchable ? 'Yes' : 'No (scanned image)', !d.searchable)}
        ${d.signed !== null ? row('Signature block', d.signed ? '/s/ signature present' : 'No signature', !d.signed) : ''}
        ${d.cos !== null ? row('Certificate of service', d.cos ? 'Included' : 'Not included', !d.cos) : ''}
        ${row('Password protection', d.password ? 'Password-protected' : 'None', d.password)}
        ${row('Personal identifiers', d.pii.length ? E(d.pii.join('; ')) : 'None found', d.pii.length)}
        ${d.redacted ? row('Redaction', 'Redacted per privacy rules') : ''}
    </table><div class="ef-tools">
        ${!d.searchable && d.kind === 'pdf' ? `<button onclick="EF.fix('${d.id}','ocr')">Run OCR</button>` : ''}
        ${d.signed === false && d.kind === 'pdf' ? `<button onclick="EF.fix('${d.id}','sign')">Add /s/ signature</button>` : ''}
        ${d.cos === false && d.kind === 'pdf' ? `<button onclick="EF.fix('${d.id}','cos')">Add certificate of service</button>` : ''}
        ${d.pii.length ? `<button onclick="EF.fix('${d.id}','redact')">Redact identifiers</button>` : ''}
        ${d.sizeMB > EF_LIMIT_MB ? `<button onclick="EF.fix('${d.id}','split')">Split file</button>` : ''}
        ${d.password ? `<button onclick="EF.fix('${d.id}','unlock')">Remove password</button>` : ''}
    </div><p class="sim-muted ef-small">Upload limit: ${EF_LIMIT_MB} MB per file, PDF only, no password protection.</p></div>`;
}
const opt = (v, cur, label) => `<option value="${E(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${E(label || v)}</option>`;
const next = (label) => `<div class="lx-acts"><button class="sim-btn primary" onclick="EF.next()">${label || 'Next →'}</button></div>`;
function step(s, f, k) {
    const a = f.a;
    switch (k) {
    case 'event': return `<h3>Civil Events</h3><p class="sim-muted ef-small">Search or pick the event that matches what you are filing.</p>
        <input class="ef-search" placeholder="Search events, e.g. opposition" oninput="EF.filter(this.value)" value="${E(f.q || '')}">
        <div class="ef-events">${s.events.filter(ev => !f.q || ev.toLowerCase().includes(f.q.toLowerCase())).map(ev => `<label class="ef-opt"><input type="radio" name="ev" value="${E(ev)}" ${a.event === ev ? 'checked' : ''} onchange="EF.set('event',this.value)"> ${E(ev)}</label>`).join('')}</div>${next()}`;
    case 'case': return `<h3>Case Number</h3><label class="ef-lbl">Enter the case number<input id="ef-case" value="${E(a.caseNumber || '')}" placeholder="${s.system === 'federal' ? 'e.g. 2:26-cv-00000' : 'e.g. CV-2026-000000'}"></label>
        <div class="lx-acts"><button class="sim-btn ghost" onclick="EF.findCase()">Find This Case</button></div>
        ${a.caseFound ? `<div class="ef-found">✓ ${E(a.caseFound)}</div>${next()}` : ''}`;
    case 'filer': return `<h3>Select the Filer</h3><p class="sim-muted ef-small">Whose filing is this?</p>${s.parties.map(p => `<label class="ef-opt"><input type="checkbox" value="${p.id}" ${a.filers.includes(p.id) ? 'checked' : ''} onchange="EF.toggle('filers','${p.id}',this.checked)"> ${E(p.name)} (${E(p.role)})</label>`).join('')}${next()}`;
    case 'refers': return `<h3>Refer to an Existing Entry</h3><p class="sim-muted ef-small">Which docket entry does this filing respond to?</p>
        ${s.docket.map(d => `<label class="ef-opt"><input type="radio" name="ref" value="${d.n}" ${String(a.refers) === String(d.n) ? 'checked' : ''} onchange="EF.set('refers',this.value)"> [${d.n}] ${E(d.text)}</label>`).join('')}
        <label class="ef-opt"><input type="radio" name="ref" value="none" ${a.refers === 'none' ? 'checked' : ''} onchange="EF.set('refers','none')"> It doesn't refer to another entry</label>${next()}`;
    case 'docs': return docsStep(s, f);
    case 'text': {
        const t = docketText(s, f);
        return `<h3>Docket Text</h3><p class="sim-muted ef-small">This is how the entry will read on the public docket. Add a modifier if the text needs one.</p>
        <label class="ef-lbl">Modifier (optional)<input value="${E(a.modifier || '')}" oninput="EF.set('modifier',this.value,true)" placeholder="e.g. Plaintiff's"></label>
        <div class="ef-dtext">${E(t)}</div>${next()}`; }
    case 'type': return `<h3>What are you filing?</h3>
        <label class="ef-opt"><input type="radio" name="ft" value="existing" ${a.filingType === 'existing' ? 'checked' : ''} onchange="EF.set('filingType','existing')"> A subsequent filing into an existing case</label>
        <label class="ef-opt"><input type="radio" name="ft" value="new" ${a.filingType === 'new' ? 'checked' : ''} onchange="EF.set('filingType','new')"> An initial filing that opens a new case</label>${next()}`;
    case 'code': return `<h3>Filing Code</h3><p class="sim-muted ef-small">The filing code sets the document type and the court fee.</p>
        ${s.codes.map(c => `<label class="ef-opt"><input type="radio" name="code" value="${E(c.code)}" ${a.code === c.code ? 'checked' : ''} onchange="EF.set('code',this.value)"> ${E(c.code)} <span class="sim-muted">· court fee ${money(c.fee)}</span></label>`).join('')}${next()}`;
    case 'party': return `<h3>Filing Party</h3>${s.parties.map(p => `<label class="ef-opt"><input type="radio" name="party" value="${p.id}" ${a.party === p.id ? 'checked' : ''} onchange="EF.set('party','${p.id}')"> ${E(p.name)} (${E(p.role)})</label>`).join('')}${next()}`;
    case 'casetype': return `<h3>Case Category and Type</h3>
        <label class="ef-lbl">Case type<select onchange="EF.set('caseType',this.value)"><option value="">Choose…</option>${s.caseTypes.map(c => opt(c.code, a.caseType)).join('')}</select></label>
        <p class="ef-small"><b>Jurisdiction</b> (by amount demanded)</p>
        <label class="ef-opt"><input type="radio" name="jur" value="limited" ${a.jur === 'limited' ? 'checked' : ''} onchange="EF.set('jur','limited')"> Limited civil: $35,000 or less (fee ${money(s.fees.limited)})</label>
        <label class="ef-opt"><input type="radio" name="jur" value="unlimited" ${a.jur === 'unlimited' ? 'checked' : ''} onchange="EF.set('jur','unlimited')"> Unlimited civil: over $35,000 (fee ${money(s.fees.unlimited)})</label>${next()}`;
    case 'parties': return `<h3>Parties</h3><div class="lx-grid">
        <label class="ef-lbl">Plaintiff name<input value="${E(a.pName || '')}" oninput="EF.set('pName',this.value,true)"></label>
        <label class="ef-lbl">Plaintiff is<select onchange="EF.set('pType',this.value)"><option value="">Choose…</option>${opt('individual', a.pType, 'An individual')}${opt('business', a.pType, 'A business / organization')}</select></label>
        <label class="ef-lbl">Defendant name<input value="${E(a.dName || '')}" oninput="EF.set('dName',this.value,true)"></label>
        <label class="ef-lbl">Defendant is<select onchange="EF.set('dType',this.value)"><option value="">Choose…</option>${opt('individual', a.dType, 'An individual')}${opt('business', a.dType, 'A business / organization')}</select></label></div>${next()}`;
    case 'service': return serviceStep(s, f);
    case 'fees': return feesStep(s, f);
    case 'review': return reviewStep(s, f);
    }
    return '';
}
function docsStep(s, f) {
    const a = f.a, pdfs = f.folder;
    return `<h3>${s.system === 'federal' ? 'Main Document and Attachments' : 'Lead Document and Attachments'}</h3>
        <label class="ef-lbl">${s.system === 'federal' ? 'Main document' : 'Lead document'}<select onchange="EF.upload('lead',this.value)"><option value="">Choose a file…</option>${pdfs.map(d => opt(d.id, a.lead, d.name)).join('')}</select></label>
        <h4 class="ef-h4">Attachments</h4>
        ${a.attachments.map((x, i) => `<div class="ef-att"><span class="mono">#${i + 1}</span><b>${E((doc(x.doc) || {}).name || '(removed)')}</b>
            <select onchange="EF.att(${i},'type',this.value)">${EF_ATTACH_TYPES.map(t => opt(t, x.type)).join('')}</select>
            <input placeholder="Description, e.g. ER record (redacted)" value="${E(x.desc || '')}" oninput="EF.att(${i},'desc',this.value,true)"><button class="dk-x" onclick="EF.dropAtt(${i})" title="Remove">✕</button></div>`).join('') || '<p class="sim-muted ef-small">No attachments.</p>'}
        <div class="ef-addatt"><select id="ef-addatt"><option value="">Add an attachment…</option>${pdfs.filter(d => d.id !== a.lead && !a.attachments.some(x => x.doc === d.id)).map(d => opt(d.id, '', d.name)).join('')}</select><button class="sim-btn ghost" onclick="EF.addAtt()">＋ Add</button></div>
        ${next()}`;
}
function serviceStep(s, f) {
    const a = f.a;
    if (s.system === 'state-new') return `<h3>Service</h3><p class="sim-muted ef-small">How will the defendant be served with this filing?</p>
        <label class="ef-opt"><input type="radio" name="svc" value="eserve" ${a.svc === 'eserve' ? 'checked' : ''} onchange="EF.set('svc','eserve')"> E-serve the defendant through this system now</label>
        <label class="ef-opt"><input type="radio" name="svc" value="personal" ${a.svc === 'personal' ? 'checked' : ''} onchange="EF.set('svc','personal')"> No e-service now: once the clerk issues the summons, have the summons and complaint personally served on the defendant's registered agent</label>${next()}`;
    return `<h3>Service Contacts</h3><p class="sim-muted ef-small">Select who receives e-service of this filing through the provider.</p>
        ${s.serviceContacts.map(c => `<label class="ef-opt"><input type="checkbox" ${a.contacts.includes(c.id) ? 'checked' : ''} onchange="EF.toggle('contacts','${c.id}',this.checked)"> ${E(c.name)} <span class="sim-muted">&lt;${E(c.email)}&gt;</span></label>`).join('')}${next()}`;
}
function fee(s, f) {
    if (s.system === 'state') { const c = s.codes.find(x => x.code === f.a.code); return { court: c ? c.fee : 0, efsp: s.efspFee }; }
    if (s.system === 'state-new') return { court: f.a.jur === 'limited' ? s.fees.limited : f.a.jur === 'unlimited' ? s.fees.unlimited : 0, efsp: 4.95 };
    return { court: 0, efsp: 0 };
}
function feesStep(s, f) {
    const x = fee(s, f);
    return `<h3>Fees and Payment</h3><table class="ef-fees"><tr><td>Court filing fee</td><td>${money(x.court)}</td></tr><tr><td>E-filing provider fee</td><td>${money(x.efsp)}</td></tr><tr class="t"><td>Total</td><td>${money(x.court + x.efsp)}</td></tr></table>
        <label class="ef-lbl">Pay from<select onchange="EF.set('pay',this.value)"><option value="">Choose a payment account…</option>${PAY.map(p => opt(p, f.a.pay)).join('')}</select></label>${next()}`;
}
function docketText(s, f) {
    const a = f.a, ref = s.docket && s.docket.find(d => String(d.n) === String(a.refers));
    const filer = (s.parties || []).filter(p => a.filers.includes(p.id)).map(p => p.name).join(', ') || '(no filer)';
    const ev = a.event ? a.event.replace(/^(\w+)/, m => m.toUpperCase()) : '(no event)';   // CM/ECF capitalizes the event's first word
    const atts = a.attachments.map((x, i) => `# ${i + 1} ${x.type}${x.desc ? ' ' + x.desc : ''}`).join(', ');
    return `${a.modifier ? a.modifier + ' ' : ''}${ev}${ref ? ` re [${ref.n}] ${ref.text.split('.')[0]}` : ''} filed by ${filer}.${atts ? ` (Attachments: ${atts})` : ''}`;
}
function reviewStep(s, f) {
    const a = f.a, lead = doc(a.lead);
    const x = fee(s, f);
    return `<h3>Review and Submit</h3><table class="ef-sum">
        ${s.system === 'federal' ? `<tr><th>Event</th><td>${E(a.event || '—')}</td></tr><tr><th>Case</th><td>${E(a.caseNumber || '—')}</td></tr><tr><th>Filer</th><td>${E(s.parties.filter(p => a.filers.includes(p.id)).map(p => p.name).join(', ') || '—')}</td></tr><tr><th>Refers to</th><td>${a.refers && a.refers !== 'none' ? '[' + a.refers + ']' : '—'}</td></tr>`
          : s.system === 'state' ? `<tr><th>Filing</th><td>${a.filingType === 'new' ? 'New case' : 'Existing case'} · ${E(a.caseNumber || '')}</td></tr><tr><th>Filing code</th><td>${E(a.code || '—')}</td></tr><tr><th>Filing party</th><td>${E((s.parties.find(p => p.id === a.party) || {}).name || '—')}</td></tr><tr><th>Service</th><td>${E(s.serviceContacts.filter(c => a.contacts.includes(c.id)).map(c => c.name).join('; ') || 'None')}</td></tr>`
          : `<tr><th>Filing</th><td>${a.filingType === 'new' ? 'New case' : 'Existing case'}</td></tr><tr><th>Case type</th><td>${E(a.caseType || '—')} · ${E(a.jur || '—')}</td></tr><tr><th>Parties</th><td>${E(a.pName || '—')} (${E(a.pType || '?')}) v. ${E(a.dName || '—')} (${E(a.dType || '?')})</td></tr><tr><th>Service</th><td>${a.svc === 'personal' ? 'Personal service after the summons issues' : a.svc === 'eserve' ? 'E-serve now' : '—'}</td></tr>`}
        <tr><th>${s.system === 'federal' ? 'Main document' : 'Lead document'}</th><td>${lead ? E(lead.name) : '—'}</td></tr>
        <tr><th>Attachments</th><td>${a.attachments.map((y, i) => `#${i + 1} ${E(y.type)}: ${E((doc(y.doc) || {}).name || '')}${y.desc ? ' — ' + E(y.desc) : ''}`).join('<br>') || 'None'}</td></tr>
        ${s.system !== 'federal' ? `<tr><th>Fees</th><td>${money(x.court + x.efsp)} from ${E(a.pay || '—')}</td></tr>` : `<tr><th>Docket text</th><td>${E(docketText(s, f))}</td></tr>`}
    </table>
    <div class="ef-warn">${s.system === 'federal' ? 'Attention! Pressing Submit commits this transaction. You will have no further opportunity to modify it.' : 'Submitting sends the envelope to the clerk for review. Fees are charged when the clerk accepts it.'}</div>
    <div class="lx-acts"><button class="sim-btn orange" onclick="EF.submit()">Submit ${s.system === 'federal' ? 'Filing' : 'Envelope'}</button></div>`;
}

// ---------- grading ----------
function grade(s, f) {
    const a = f.a, items = [], add = (label, ok, max, why, part) => items.push({ label, got: ok ? max : (part || 0), max, why: ok ? '' : why });
    const att = (id) => a.attachments.find(x => x.doc === id || x.doc.startsWith(id + '_'));
    const bad = f.folder.filter(d => (d.privileged || d.superseded || d.kind !== 'pdf') && (a.lead === d.id || a.attachments.some(x => x.doc === d.id)));
    const lead = doc(a.lead) || {};
    let reject = [];
    if (s.system === 'federal') {
        add('Filing event: Response in Opposition to Motion', a.event === 'Response in Opposition to Motion', 10, `You chose "${a.event || 'nothing'}". An opposition is a response to a motion, not a new motion or a notice.`);
        add('Case number', norm(a.caseNumber) === norm(s.caseNumber), 5, `The case is ${s.caseNumber}.`);
        add('Filer: the plaintiff only', a.filers.length === 1 && a.filers[0] === 'p1', 5, 'File on behalf of Dana Harlow (plaintiff) only.');
        add('Linked to the motion it opposes ([4])', String(a.refers) === '4', 10, 'Link the response to docket #4, the Motion to Dismiss, so it shows as a response to that motion.');
        add('Main document: the final opposition brief', a.lead === 'opp', 10, 'The main document is Harlow_Opposition_to_MTD_FINAL.pdf.');
        add('Brief is text-searchable (OCR)', a.lead === 'opp' && lead.searchable, 5, 'The brief was a scanned image. Run OCR: courts require text-searchable PDFs.');
        add('Brief is signed (/s/)', a.lead === 'opp' && lead.signed, 5, 'Every filing needs the attorney\'s signature (/s/ name) under FRCP 11.');
        add('Certificate of service included', a.lead === 'opp' && lead.cos, 5, 'Add the certificate of service (FRCP 5(d)(1)(B)).');
        const exA = att('exA'); add('Exhibit A attached and redacted', exA && doc(exA.doc).redacted, 15, exA ? 'Exhibit A was filed with a full date of birth and SSN. Redact to the birth year and last four digits (FRCP 5.2(a)) before filing.' : 'Exhibit A (the ER record) is missing.', exA ? 3 : 0);
        add('Exhibit B split under the size limit and fully attached', !!att('exB_1') && !!att('exB_2'), 5, 'Exhibit B is 48 MB: split it into parts under 35 MB and attach every part.');
        const po = att('po'); add('Proposed order attached as a Proposed Order', po && po.type === 'Proposed Order', 5, po ? `The proposed order was typed "${po.type}".` : 'The proposed order is missing.');
        const exTypes = a.attachments.filter(x => /^ex/.test(x.doc)); add('Exhibits typed as Exhibit', exTypes.length && exTypes.every(x => x.type === 'Exhibit'), 5, 'Type each exhibit as "Exhibit" so the docket lists it correctly.');
        add('Every attachment has a description', a.attachments.length && a.attachments.every(x => (x.desc || '').trim().length >= 3), 5, 'Describe each attachment (e.g. "Exhibit A — ER record, redacted") so the docket is readable.');
        add('Nothing privileged, draft or non-PDF filed', !bad.length, 10, `You filed ${bad.map(d => d.name).join(', ')}. The strategy memo is attorney work product, and filing it makes it public.`);
    } else if (s.system === 'state') {
        add('Filing type: subsequent filing in the existing case', a.filingType === 'existing', 5, 'This case already exists (CV-2026-004417).');
        add('Case number', norm(a.caseNumber) === norm(s.caseNumber), 5, `The case is ${s.caseNumber}.`);
        add('Filing code: Amended Complaint', a.code === 'Amended Complaint', 15, `You chose "${a.code || 'nothing'}".`);
        if (a.code && a.code !== 'Amended Complaint') reject.push(a.code === 'Complaint (initial)' ? 'Wrong filing code: "Complaint" opens a new case and charges a first-paper fee. File it as an Amended Complaint in the existing case.' : `Wrong filing code: the document is an amended complaint, not "${a.code}".`);
        add('Filing party: plaintiff John Doe', a.party === 'p1', 5, 'The amended complaint is the plaintiff\'s filing.');
        add('Lead document: the First Amended Complaint (JD35)', a.lead === 'fac', 20, 'File JD35, the operative First Amended Complaint.');
        if (a.lead === 'orig') reject.push('Superseded pleading: the lead document is the original complaint, which the First Amended Complaint replaces.');
        add('Only the amended complaint in the envelope', a.attachments.length === 0, 10, 'Nothing else belongs in this envelope.');
        add('No privileged or superseded documents filed', !bad.length, 15, `You filed ${bad.map(d => d.name).join(', ')}. The Master Case Summary is attorney-only work product, and the original complaint is superseded.`);
        add('Defense counsel e-served', a.contacts.includes('dc') && !a.contacts.includes('adj'), 15, a.contacts.includes('adj') ? 'Serve counsel of record, not the insurance adjuster: the adjuster is not a party or counsel in the case.' : 'Every filing must be served on counsel of record: add defense counsel as a service contact.', a.contacts.includes('dc') ? 8 : 0);
        add('Paid from the firm operating account', a.pay === PAY[0], 10, 'Court costs are advanced from the firm\'s operating account, never from client trust funds or a personal card.');
    } else {
        add('Filing type: initial filing (new case)', a.filingType === 'new', 5, 'This opens a new case.');
        add('Case type: premises liability', (a.caseType || '').startsWith('Premises'), 10, 'A slip and fall in a store is premises liability (23).');
        add('Jurisdiction: unlimited civil', a.jur === 'unlimited', 10, 'The demand is over $180,000, so the case is unlimited civil (over $35,000).');
        if (a.jur === 'limited') reject.push('Wrong jurisdiction: the amount demanded exceeds the $35,000 limited-civil limit, and the fee paid is for a limited case.');
        add('Parties entered correctly', norm(a.pName) === norm(s.plaintiff) && a.pType === 'individual' && norm(a.dName) === norm(s.defendant) && a.dType === 'business', 10, `Plaintiff: ${s.plaintiff} (individual). Defendant: ${s.defendant} (business).`);
        add('Lead document: the complaint', a.lead === 'cmp', 10, 'The complaint is the lead document of a new case.');
        const ccs = att('ccs'); add('Civil Case Cover Sheet attached', ccs && ccs.type === 'Civil Cover Sheet', 15, 'The Civil Case Cover Sheet must be filed with the first paper.', ccs ? 8 : 0);
        if (!ccs) reject.push('Missing Civil Case Cover Sheet: it is required with the first paper in a civil case.');
        const sum = att('sum'); add('Summons attached for issuance', sum && sum.type === 'Summons', 10, 'Include the summons so the clerk can issue it for service.', sum ? 5 : 0);
        add('No private intake notes filed', !bad.length, 15, `You filed ${bad.map(d => d.name).join(', ')}: private client information and work product. Never file it.`);
        add('Correct first-paper fee', a.jur === 'unlimited', 5, 'Unlimited civil first-paper fee: $435.');
        add('Paid from the firm operating account', a.pay === PAY[0], 5, 'Court costs are advanced from the firm\'s operating account.');
        add('Service: personal service after the summons issues', a.svc === 'personal', 5, 'The defendant hasn\'t appeared and has no e-service contact. Serve the issued summons and complaint personally.');
    }
    const total = Math.round(items.reduce((x, i) => x + i.got, 0) / items.reduce((x, i) => x + i.max, 0) * 100);
    return { total, items, reject };
}

// ---------- receipt ----------
function receipt(s, f) {
    const r = f.submitted, g = r.grade;
    let head;
    if (s.system === 'federal') head = `<h3>Notice of Electronic Filing</h3><pre class="dk-doc">The following transaction was entered by Rivera, A. on ${r.stamp} and filed on ${r.stamp.split(' ')[0]}.
Case Name: ${s.caption}
Case Number: ${s.caseNumber}
Document Number: ${r.docNo}

Docket Text:
${r.text}

Notice has been electronically mailed to:
${s.recipients.join('\n')}</pre>`;
    else if (!r.reviewed) head = `<h3>Envelope ${r.envelope}: Submitted</h3><p>Status: <span class="mr-st warn">Pending clerk review</span>. Submitted ${r.stamp}. The clerk reviews envelopes within one business day.</p>
        <div class="lx-acts"><button class="sim-btn primary" onclick="EF.clerk()">Check Envelope Status (next business day) ▶</button></div>`;
    else head = g.reject.length
        ? `<h3>Envelope ${r.envelope}: <span class="bad">Rejected</span></h3><div class="sim-error">${g.reject.map(E).join('<br>')}</div><p class="sim-muted">Nothing was filed and no court fee was charged. Fix the problem and file a new envelope. If a deadline hangs on it, it's still running.</p>`
        : `<h3>Envelope ${r.envelope}: <span class="ok">Accepted</span></h3><p>${s.system === 'state-new' ? `New case opened: <b class="mono">${r.newCase}</b>. Summons issued. File-stamped copies are ready to download.` : 'File-stamped copy of the First Amended Complaint is ready; service notifications were sent.'}</p>`;
    const showGrade = s.system === 'federal' || r.reviewed;
    return `<div class="sim-card">${head}</div>
    ${showGrade ? `<div class="sim-card dk-res"><div class="dk-res-top"><div class="ring">${g.total}%</div><div><h3 style="margin:0">Filing quality review</h3>
        <p class="sim-muted">How a senior paralegal would review this filing. Reference for the CM course log: <b class="mono">${E(r.ref)}</b></p>
        <div class="lx-acts"><button class="sim-btn ghost" onclick="EF.restart()">↺ File It Again</button><button class="sim-btn ghost" onclick="EF.back()">← All Scenarios</button></div></div></div>
        ${g.items.map(i => `<div class="dk-res-item"><div class="dk-res-h"><b class="${i.got >= i.max ? 'ok' : 'bad'}">${i.got >= i.max ? '✓' : '✗'} ${E(i.label)}</b><span class="mono">${i.got}/${i.max}</span></div>${i.why ? `<p class="ef-small bad">${E(i.why)}</p>` : ''}</div>`).join('')}</div>` : ''}`;
}

// ---------- actions ----------
window.EF = {
    pick(id) { S.sc = id; F(); save(); render(); },
    back() { S.sc = null; save(); render(); },
    restart() { if (!confirm('Start this filing over?')) return; delete S.f[S.sc]; save(); render(); },
    go(i) { const f = F(); f.step = i; f.msg = ''; save(); render(); },
    set(k, v, quiet) { const f = F(); f.a[k] = v; save(); if (!quiet) render(); else if (k === 'modifier') { const el = document.querySelector('.ef-dtext'); if (el) el.textContent = docketText(sc(), f); } },
    toggle(k, v, on) { const f = F(); f.a[k] = f.a[k].filter(x => x !== v); if (on) f.a[k].push(v); save(); },
    filter(q) { const f = F(); f.q = q; save(); document.getElementById('ef-step').innerHTML = step(sc(), f, 'event'); const i = document.querySelector('.ef-search'); i.focus(); i.setSelectionRange(q.length, q.length); },
    findCase() {
        const s = sc(), f = F(), v = document.getElementById('ef-case').value.trim(); f.a.caseNumber = v;
        f.a.caseFound = norm(v) === norm(s.caseNumber) ? `${s.caseNumber} — ${s.caption}` : '';
        f.msg = f.a.caseFound ? '' : 'No case found with that number. Check the number on the docket.'; save(); render();
    },
    inspect(id) { const f = F(); f.inspect = f.inspect === id ? null : id; save(); render(); },
    fix(id, tool) {
        const f = F(), d = doc(id);
        if (tool === 'ocr') d.searchable = true;
        if (tool === 'sign') d.signed = true;
        if (tool === 'cos') d.cos = true;
        if (tool === 'redact') { d.pii = []; d.redacted = true; }
        if (tool === 'unlock') d.password = false;
        if (tool === 'split') {
            const i = f.folder.indexOf(d), half = Math.ceil(d.pages / 2);
            const parts = [1, 2].map(n => Object.assign(clone(d), { id: `${d.id}_${n}`, name: d.name.replace('.pdf', `_Part${n}.pdf`), pages: n === 1 ? half : d.pages - half, sizeMB: Math.round(d.sizeMB / 2 * 10) / 10, what: d.what + ` (part ${n} of 2)` }));
            f.folder.splice(i, 1, ...parts);
            f.a.attachments = f.a.attachments.filter(x => x.doc !== d.id); if (f.a.lead === d.id) f.a.lead = '';
            f.inspect = parts[0].id;
        }
        save(); render();
    },
    upload(role, id) {
        const f = F(), d = doc(id); f.msg = '';
        if (d && d.kind !== 'pdf') { f.msg = `${d.name}: only PDF files can be uploaded.`; }
        else if (d && d.sizeMB > EF_LIMIT_MB) { f.msg = `${d.name} is ${d.sizeMB} MB, over the ${EF_LIMIT_MB} MB limit per file.`; }
        else if (d && d.password) { f.msg = `${d.name} is password-protected and can't be processed. Remove the password first.`; }
        else f.a.lead = id;
        save(); render();
    },
    addAtt() {
        const f = F(), id = document.getElementById('ef-addatt').value; if (!id) return;
        const d = doc(id); f.msg = '';
        if (d.kind !== 'pdf') f.msg = `${d.name}: only PDF files can be uploaded.`;
        else if (d.sizeMB > EF_LIMIT_MB) f.msg = `${d.name} is ${d.sizeMB} MB, over the ${EF_LIMIT_MB} MB limit per file. Split it first.`;
        else if (d.password) f.msg = `${d.name} is password-protected. Remove the password first.`;
        else f.a.attachments.push({ doc: id, type: 'Exhibit', desc: '' });
        save(); render();
    },
    att(i, k, v, quiet) { const f = F(); f.a.attachments[i][k] = v; save(); if (!quiet) render(); },
    dropAtt(i) { const f = F(); f.a.attachments.splice(i, 1); save(); render(); },
    next() {
        const s = sc(), f = F(), k = STEPS[s.system][f.step][0], a = f.a;
        const need = { event: !a.event && 'Choose the filing event.', case: !a.caseFound && 'Find the case first.', filer: !a.filers.length && 'Select at least one filer.', refers: !a.refers && 'Choose an entry, or say it refers to none.',
            docs: !a.lead && 'Upload the main document.', type: !a.filingType && 'Choose the filing type.', code: !a.code && 'Choose a filing code.', party: !a.party && 'Choose the filing party.',
            casetype: (!a.caseType || !a.jur) && 'Choose the case type and jurisdiction.', parties: (!a.pName || !a.dName || !a.pType || !a.dType) && 'Enter both parties and their types.',
            fees: !a.pay && 'Choose a payment account.', service: s.system === 'state-new' && !a.svc && 'Choose how the defendant will be served.' }[k];
        if (need) { f.msg = need; save(); render(); return; }
        if (k === 'type' && s.system === 'state' && a.filingType === 'existing') { /* continue to case search */ }
        f.msg = ''; f.step = Math.min(f.step + 1, STEPS[s.system].length - 1); save(); render();
    },
    submit() {
        const s = sc(), f = F(), g = grade(s, f);
        const now = s.when.match(/(\d\d\/\d\d\/\d{4}), ([\d:]+ [AP]M)/);
        const stamp = now ? `${now[1]} at ${now[2]}` : '';
        const docNo = 14 + Math.floor(Math.random() * 3);   // one number for both the NEF's Document Number and the ECF reference
        const ref = s.system === 'federal' ? `ECF-${s.caseNumber.split('-').slice(0, 3).join('-')}-DOC${docNo}` : `ENV-${Math.floor(88000000 + Math.random() * 999999)}`;
        f.submitted = { stamp, grade: g, ref, docNo, text: docketText(s, f), envelope: ref.replace('ENV-', ''), reviewed: false, newCase: 'CV-2026-00' + Math.floor(5000 + Math.random() * 4000) };
        if (s.system === 'federal') Sim.saveResult({ simulator: 'Court E-Filing', scenario: s.title, score: g.total, summary: `NEF ${ref}`, details: { ref, items: g.items.filter(i => i.got < i.max).map(i => i.label) } });
        save(); render();
    },
    clerk() {
        const s = sc(), f = F(); f.submitted.reviewed = true; const g = f.submitted.grade;
        Sim.saveResult({ simulator: 'Court E-Filing', scenario: s.title, score: g.total, summary: `${g.reject.length ? 'Rejected' : 'Accepted'} · envelope ${f.submitted.envelope}`, details: { ref: f.submitted.ref, rejected: g.reject, items: g.items.filter(i => i.got < i.max).map(i => i.label) } });
        save(); render();
    }
};

// A new tab (a course's link opens with noopener, or a bookmark) has the cookie but no copy of the session: ask who is
// signed in before the first render, so the heartbeat starts and a signed-in trainee practices as their own account.
Sim.restore().then(render);
})();

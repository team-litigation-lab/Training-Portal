/* LSH Training Portal — Medical Records Requests simulator.
   A records request center: check the HIPAA authorization, request records and itemized bills
   from providers, move the simulated calendar forward, and handle what comes back: rejections,
   invoices, silence, partial records. Review what arrives, flag problems, log it to the case
   file, and score the job against the attorney's objectives. Saved in this browser.

   What a provider produces is a document, not a summary: when a request is produced, the records
   and the itemized bill are built as real files (records-docs.js) the trainee reads, downloads as
   a PDF named the firm's way, and files into the case file on the platform they came from — the
   CMS Platform, the Case Management course or the Medical Summary & Demand course. Logging to the
   case file is what the objectives score; producing and filing the document is the work it stands
   for, so the two sit side by side on each delivery.

   The clock is the current system date (MR_CLOCK in records-data.js), not a date typed in when the
   scenario was written, and it keeps up with it: reopen the collection a week later and it catches
   up to today the way the post would have. Follow-up dates, the attorney's date, the MRR log, the
   request numbers and the dates on the documents produced are therefore always real dates.

   SAME-DAY RECEIPT is on by default. A trainee in a live session cannot sit out a week of simulated
   post to see what a provider sent back, so everything the provider's side sends — the
   acknowledgment, the rejection, the invoice, the revised invoice, the records, the complete ledger —
   and the client's e-signature arrive the same day, by exactly the same rules. Nothing is skipped and
   nothing is scored differently; only the waiting goes. The firm's OWN deadlines stay on the real
   calendar (the follow-up date is still 7 business days out, the attorney's date is still weeks
   away), because those are the training content rather than a delay. Turned off, the business-day
   clock behaves as it always did. */
(function () {
const E = Sim.esc, KEY = 'LSH_RECORDS_V1', SC = MR_SCENARIO;
// The case file this collection belongs to: the platform the trainee opened the simulator from.
let DEST = MRDocs.dest();
(function styles() { const s = document.createElement('style'); s.textContent = MRDocs.css; document.head.appendChild(s); })();
const P = (id) => MR_PROVIDERS.find(p => p.id === id);
const FEE_CAP = (pages) => 25 + 0.25 * pages;   // training state cap: $25 retrieval + $0.25 per page
const money = (n) => '$' + Number(n || 0).toFixed(2);
const bd = (from, n) => { let d = from, k = 0; while (k < n) { d = LR.add(d, 1); if (!LR.closed(d)) k++; } return d; };
const openDay = (d) => { let x = d, g = 0; while (LR.closed(x) && g++ < 14) x = LR.add(x, 1); return x; };
/* How long the other side takes. With same-day receipt on, anything a provider or the client sends
   back lands today, so a trainee is never blocked; `bd` itself is left alone, because the firm's own
   deadlines (the follow-up date, the attorney's date) are real business days either way. */
const respond = (n) => S.sameDay ? S.today : bd(S.today, n);
/* Has the other side had its time? Same thing: with same-day receipt it has, so a chase that would
   only have shaken the records loose after the provider's turnaround shakes them loose now. */
const hadTime = (from, n) => S.sameDay || S.today >= bd(from, n);
const clone = (o) => JSON.parse(JSON.stringify(o));

function fresh() {
    return { today: SC.start, startedOn: SC.start, goal: SC.goal, sameDay: true, seq: 0, requests: [], tab: 'requests', open: null,
        auth: { signed: false, sentOn: null, signedOn: null, reviewed: null }, psychAuth: { exists: false, sentOn: null, signedOn: null },
        revealed: {}, log: [], finished: null, draft: null };
}
let S = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.requests) return Object.assign(fresh(), s); } catch (e) {} return fresh(); })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const req = (no) => S.requests.find(r => r.no === no);
const note = (r, text, kind) => r.events.push({ date: S.today, text, kind: kind || 'info' });
const at = (r, date, action, data) => r.queue.push({ date, action, data: data || null });
const visible = (p) => !p.hidden || S.revealed[p.id];
const authValid = (date) => S.auth.signedOn && S.auth.signedOn <= date;

// ---------- the provider engine ----------
function submit(r) {
    r.submitted = S.today; r.status = 'Submitted'; r.nextFollowUp = bd(S.today, 7);
    note(r, `Request ${r.no} sent to ${P(r.provider).dept} (${P(r.provider).method}).`, 'sent');
    at(r, respond(1), 'ack');
    // what was true when it went out, kept on the request: with same-day receipt the signature and the
    // request share a date, so only the order can say whether the authorization was fixed first
    r.authOkAtSubmit = authValid(S.today);
    r.psychOkAtSubmit = !!(S.psychAuth.signedOn && S.psychAuth.signedOn <= S.today);
    at(r, respond(2), 'validate', { authOk: r.authOkAtSubmit, psychOk: r.psychOkAtSubmit });
}
function run(r, ev) {
    const p = P(r.provider), turnaround = Math.max(2, p.days - (r.rush ? 2 : 0));
    switch (ev.action) {
    case 'ack': if (r.status === 'Submitted') { r.status = 'In process'; note(r, `${p.dept} acknowledged the request. Status: in process.`); } break;
    case 'validate': {
        if (!ev.data.authOk) { r.status = 'Rejected'; note(r, 'Rejected: the HIPAA authorization is unsigned and undated. A valid authorization must be signed and dated by the patient (45 CFR 164.508(c)(1)(vi)). Get it signed, then resubmit.', 'bad'); r.queue = []; return; }
        const [from, to] = p.dos, overlap = r.dosTo >= from && r.dosFrom <= to;
        if (!overlap) { r.status = 'No records'; note(r, `No records found for the dates of service requested (${LR.short(r.dosFrom)}–${LR.short(r.dosTo)}). This provider holds records for ${LR.short(from)}–${LR.short(to)}.`, 'bad'); r.queue = []; return; }
        if (r.dosFrom > from || r.dosTo < to) { r.partialDos = true; note(r, 'Note: records will be produced for the requested dates only, which don\'t cover every date this provider treated the patient.', 'warn'); }
        r.types.forEach(t => {
            if (t === 'psych' && !ev.data.psychOk) { r.ts[t] = 'rejected'; note(r, 'Psychotherapy notes were not released: they need their own separate authorization (45 CFR 164.508(a)(2)). The evaluation report and bills are handled under the general authorization.', 'bad'); return; }
            if (t === 'bill' && p.billsElsewhere) { r.ts[t] = 'elsewhere'; note(r, 'Itemized bills are not kept by Health Information Management. Send a separate request to Patient Financial Services (billing).', 'warn'); return; }
            if (t === 'records' && p.id === 'pfs') { r.ts[t] = 'elsewhere'; note(r, 'Medical records come from Health Information Management, not Patient Financial Services.', 'warn'); return; }
            if (!p.delivered[t] && t !== 'cert') { r.ts[t] = 'n/a'; note(r, `${MR_TYPES[t]}: not held by this provider.`, 'warn'); return; }
            r.ts[t] = 'pending';
        });
        if (!r.types.some(t => r.ts[t] === 'pending')) { r.status = 'Closed'; return; }
        if (p.fee) at(r, respond(1), 'invoice');
        else if (!p.slow) at(r, respond(turnaround - 2), 'deliver');
        break;
    }
    case 'invoice': {
        const pages = p.fee.pages + (r.types.includes('bill') && p.delivered.bill ? p.delivered.bill.pages : 0);
        const amount = (p.fee.flat != null ? p.fee.flat : FEE_CAP(pages)) + (r.rush ? 25 : 0);
        r.invoice = { amount, pages, status: 'due', cap: FEE_CAP(pages) + (r.rush ? 25 : 0) };
        r.status = 'Awaiting payment';
        note(r, `Invoice issued: ${money(amount)} for ${pages} pages${p.fee.flat != null ? ' (flat fee)' : ''}${r.rush ? ', including the $25 rush fee' : ''}. Records are released after payment.`, 'money');
        break;
    }
    case 'revised': r.invoice.amount = r.invoice.cap; r.invoice.status = 'due'; r.status = 'Awaiting payment'; note(r, `Invoice revised to ${money(r.invoice.amount)}, the state fee cap ($25 retrieval + $0.25 per page). Pay it to release the records.`, 'money'); break;
    case 'deliver': deliver(r); break;
    case 'ledger': r.delivered = r.delivered || {}; r.delivered.bill = clone(p.delivered.billComplete); r.ledgerComplete = true; r.deliveredOn = S.today; note(r, `Complete ledger received: ${p.delivered.billComplete.lines.length} visits, ${money(p.delivered.billComplete.lines.reduce((a, x) => a + x.amount, 0))} total. Review it and log it to the case file.`, 'good'); r.logged = false; r.status = 'Delivered'; break;
    }
}
function deliver(r) {
    const p = P(r.provider); r.delivered = r.delivered || {}; r.deliveredOn = S.today;
    r.types.forEach(t => { if (r.ts[t] === 'pending') { r.ts[t] = 'delivered'; r.delivered[t] = clone(t === 'cert' ? { pages: 1, text: 'Certification of records signed by the custodian.' } : p.delivered[t]); } });
    const pages = Object.values(r.delivered).reduce((a, x) => a + (x.pages || 0), 0);
    r.status = 'Delivered'; note(r, `Records released: ${pages} pages (${Object.keys(r.delivered).map(t => MR_TYPES[t].split(' (')[0]).join(', ')}). Review them and log them to the case file.`, 'good');
}
/* Everything already due today, run without moving the clock, plus the client's signature when it
   is waiting. One step queues the next (validate → invoice → deliver), and with same-day receipt
   those land today too, so it drains until nothing more is due. Called after every action; with
   same-day receipt off, nothing is due today and it does nothing. */
function signPending() {
    if (!S.sameDay) return;
    if (S.auth.sentOn && !S.auth.signedOn) {
        S.auth.signedOn = S.today;
        S.auth.beforeAnyRequest = !S.requests.some(r => r.submitted);
        S.log.push({ date: S.today, text: 'John Doe signed and dated the HIPAA authorization (e-signature, same day).' });
    }
    if (S.psychAuth.sentOn && !S.psychAuth.signedOn) {
        S.psychAuth.signedOn = S.today;
        S.log.push({ date: S.today, text: 'John Doe signed the separate authorization for psychotherapy notes (same day).' });
    }
}
function settle() {
    signPending();
    for (let guard = 0; guard < 80; guard++) {
        let ran = false;
        S.requests.forEach(r => {
            const due = r.queue.filter(q => q.date <= S.today);
            if (!due.length) return;
            r.queue = r.queue.filter(q => q.date > S.today);
            due.forEach(q => run(r, q)); ran = true;
        });
        if (!ran) return;
    }
}

function advance(days, quiet) {
    for (let i = 0; i < days; i++) {
        S.today = LR.add(S.today, 1);
        if (S.auth.sentOn && !S.auth.signedOn && S.today >= bd(S.auth.sentOn, 1)) { S.auth.signedOn = S.today; S.auth.beforeAnyRequest = !S.requests.some(r => r.submitted); S.log.push({ date: S.today, text: 'John Doe signed and dated the HIPAA authorization (e-signature).' }); }
        if (S.psychAuth.sentOn && !S.psychAuth.signedOn && S.today >= bd(S.psychAuth.sentOn, 1)) { S.psychAuth.signedOn = S.today; S.log.push({ date: S.today, text: 'John Doe signed the separate authorization for psychotherapy notes.' }); }
        S.requests.forEach(r => {
            const due = r.queue.filter(q => q.date <= S.today); r.queue = r.queue.filter(q => q.date > S.today);
            due.forEach(q => run(r, q));
            // `quiet` is the catch-up to today when the collection is reopened: the days a trainee was
            // away are not days they let a request sit, so no follow-up is marked missed for them
            if (!quiet && open(r) && !LR.closed(S.today) && S.today > bd(r.nextFollowUp, 3)) r.missedFollowUp = true;
        });
    }
    if (!quiet) { save(); render(); }
}

/* The clock keeps up with the system date: a collection reopened later catches up to today, running
   what the provider's side sent in the meantime, so the dates a trainee goes on working to are real.
   The follow-up dates they were already given stand; they are simply not marked missed for the days
   nobody was here. Reopened on the same day, or with same-day receipt leaving nothing queued, this
   does nothing at all. */
function catchUp() {
    const to = openDay(SC.system);
    if (!S.today || S.today >= to) return;
    let days = 0;
    for (let d = S.today; d < to; d = LR.add(d, 1)) days++;
    const from = S.today;
    advance(days, true);
    S.goal = SC.goal;
    S.log.push({ date: S.today, text: `Back in the collection: the calendar moved on from ${LR.short(from)} to today, ${LR.short(S.today)}.` });
}
const open = (r) => ['Submitted', 'In process', 'Awaiting payment', 'Fee disputed'].includes(r.status);
const overdue = (r) => open(r) && S.today > r.nextFollowUp;

/* ---------- the documents a production actually is ----------
   Built from the delivery on demand, so a Case ID typed later renames them, and what the trainee
   has done with each (downloaded, filed) is kept on the request. */
const docOf = (r, t) => MRDocs.build({ request: r, kind: t, provider: P(r.provider), scenario: SC,
    delivered: r.delivered[t], producedOn: r.deliveredOn || r.submitted || S.today });
const fileRec = (r, t) => ((r.files = r.files || {})[t] = r.files[t] || {});
const produced = () => S.requests.filter(r => r.delivered && Object.keys(r.delivered).length);

// ---------- scoring ----------
const REQUIRED = [['ems', 'records'], ['ems', 'bill'], ['him', 'records'], ['pfs', 'bill'], ['rad', 'records'], ['rad', 'bill'], ['spine', 'records'], ['spine', 'bill'], ['pt', 'records'], ['pt', 'bill'],
    ['chiro', 'records'], ['chiro', 'billComplete'], ['psych', 'records'], ['psych', 'bill'], ['neuro', 'records'], ['neuro', 'bill'], ['anes', 'bill'], ['river', 'records'], ['river', 'bill'], ['whc', 'records'], ['mig', 'records']];
function have(pid, t, byDate) {
    return S.requests.some(r => r.provider === pid && r.logged && (!byDate || r.loggedOn <= byDate) && (t === 'billComplete' ? r.ledgerComplete : r.delivered && r.delivered[t] && !(t === 'bill' && pid === 'chiro' && !r.ledgerComplete)));
}
function score() {
    const out = [], add = (label, got, max, detail) => out.push({ label, got: Math.max(0, Math.round(got * 10) / 10), max, detail });
    const firstSub = S.requests.map(r => r.submitted).filter(Boolean).sort()[0];
    // With same-day receipt the signature and the first request can share a date, so what counts is
    // which came first. Recorded at signing; a collection saved before this falls back to the dates.
    const early = S.auth.signedOn && (S.auth.beforeAnyRequest != null ? S.auth.beforeAnyRequest : (!firstSub || S.auth.signedOn <= firstSub));
    const rv = S.auth.reviewed || [], rvOk = rv.includes('signature') && rv.includes('date') && rv.length === 2;
    add('HIPAA authorization fixed before sending requests', (early ? 7 : S.auth.signedOn ? 3 : 0) + (rvOk ? 3 : 0), 10,
        (early ? 'Signed before the first request went out.' : S.auth.signedOn ? 'Signed only after requests went out; the early ones were rejected.' : 'Never signed: every request is rejected.') + (rvOk ? ' Review spotted both defects (signature and date).' : ' Review: the defects are the missing signature and the missing date.'));
    const got = REQUIRED.filter(([p, t]) => have(p, t));
    add('Complete records and bills, logged to the case file', 40 * got.length / REQUIRED.length, 40,
        `${got.length} of ${REQUIRED.length} logged.` + (got.length < REQUIRED.length ? ' Missing: ' + REQUIRED.filter(x => !got.includes(x)).map(([p, t]) => `${P(p).name.split(' — ')[0]} (${t === 'billComplete' ? 'complete ledger' : t === 'bill' ? 'bill' : 'records'})`).join('; ') : ''));
    const goal = S.goal || SC.goal;
    const onTime = REQUIRED.every(([p, t]) => have(p, t, goal));
    add(`Everything logged by the attorney's date (${LR.short(goal)})`, onTime ? 5 : 0, 5, onTime ? 'On time.' : 'Not everything was logged by the date.');
    const psychBad = S.requests.some(r => r.types.includes('psych')
        && !(r.psychOkAtSubmit != null ? r.psychOkAtSubmit : (S.psychAuth.signedOn && S.psychAuth.signedOn <= r.submitted)));
    add('No psychotherapy notes without their own authorization', psychBad ? 0 : 5, 5, psychBad ? 'Psychotherapy notes were requested under the general authorization. They need a separate one, and the evaluation report is what the case needs.' : 'Correct.');
    const derm = S.requests.some(r => r.provider === 'derm');
    add('Only accident-related and relevant prior providers', derm ? 0 : 5, 5, derm ? 'Metro Dermatology (2019 acne) is unrelated: requesting it costs money and invites the defense to explore unrelated history.' : 'Correct: nothing unrelated requested.');
    const ems = S.requests.filter(r => r.provider === 'ems' && r.invoice);
    const overpaid = ems.some(r => r.invoice.status === 'paid' && r.invoice.paid > r.invoice.cap + 0.01);
    const unpaid = S.requests.filter(r => r.invoice && r.invoice.status === 'due');
    add('Fees: dispute what\'s over the cap, pay what\'s fair', (ems.length && !overpaid ? 5 : 0) + (unpaid.length ? 0 : 5), 10,
        (ems.length ? (overpaid ? `The EMS flat fee (${money(ems[0].invoice.amount)} for ${ems[0].invoice.pages} pages) was over the cap (${money(ems[0].invoice.cap)}): dispute it before paying. ` : 'EMS fee handled within the cap. ') : 'EMS was never requested. ') + (unpaid.length ? `${unpaid.length} invoice(s) left unpaid, so those records are stuck.` : 'No invoices left unpaid.'));
    const missed = S.requests.filter(r => r.missedFollowUp).length;
    add('Follow-ups on time', missed === 0 ? 10 : missed <= 2 ? 5 : 0, 10, missed ? `${missed} request(s) sat more than 3 business days past the follow-up date with no follow-up.` : 'No request went unchased.');
    const flagged = new Set(S.requests.flatMap(r => r.flags || []));
    const real = MR_FINDINGS.filter(f => f.real), hits = real.filter(f => flagged.has(f.id)).length, decoys = MR_FINDINGS.filter(f => !f.real && flagged.has(f.id)).length;
    add('Problems spotted in the records', 15 * hits / real.length - 2 * decoys, 15, `${hits} of ${real.length} real problems flagged${decoys ? `; ${decoys} false alarm(s)` : ''}.` + (hits < real.length ? ' Missed: ' + real.filter(f => !flagged.has(f.id)).map(f => f.text).join(' ') : ''));
    const total = Math.round(out.reduce((a, x) => a + x.got, 0));
    return { total, items: out };
}

// ---------- UI ----------
function render() {
    const counts = { open: S.requests.filter(open).length, pay: S.requests.filter(r => r.status === 'Awaiting payment').length, over: S.requests.filter(overdue).length, review: S.requests.filter(r => r.status === 'Delivered' && !r.logged).length };
    const tabs = [['requests', `📋 Requests <span class="n">${S.requests.length}</span>`], ['new', '➕ New Request'], ['auth', `🔐 Authorizations${S.auth.signedOn ? '' : ' <span class="n bad">!</span>'}`], ['dir', '🏥 Provider Directory'], ['file', '📁 Case File'], ['score', '✅ Objectives & Score']];
    document.getElementById('app').innerHTML = `
    <div class="sim-card mr-bar">
        <div><div class="mr-k">Case</div><b>${E(SC.client.name)}</b> · DOB ${LR.short(SC.client.dob)} · DOL ${LR.short(SC.client.dol)} · File ${E(SC.client.file)}</div>
        <div class="mr-clock"><div class="mr-k">Today</div><b>${LR.fmt(S.today)}</b><div class="mr-k">Attorney's date: ${LR.fmt(S.goal || SC.goal)}</div></div>
        <div class="mr-acts">
            <label class="mr-sameday" title="What the providers and the client send back arrives the same day, so a live session is never spent waiting. Your own follow-up dates and the attorney's date stay on the real calendar.">
                <input type="checkbox" ${S.sameDay ? 'checked' : ''} onchange="MR.sameDay(this.checked)"> ⚡ Same-day receipt</label>
            <button class="sim-btn primary" onclick="MR.next()">Next Business Day ▶</button>
            <button class="sim-btn ghost" onclick="MR.advance(7)">+1 Week ⏩</button>
        </div>
    </div>
    ${S.sameDay ? `<p class="mr-sd-note">⚡ <b>Same-day receipt is on.</b> Acknowledgments, rejections, invoices, records and the client's e-signature come back the same day, by the same rules — nothing is skipped and nothing is scored differently. Your follow-up dates and the attorney's date (${LR.fmt(S.goal || SC.goal)}) are still real business days, so follow-ups still count. Turn it off to work the business-day clock.</p>` : ''}
    <div class="mr-counts"><span><b>${counts.open}</b> Open</span><span class="${counts.pay ? 'warn' : ''}"><b>${counts.pay}</b> Awaiting Payment</span><span class="${counts.over ? 'bad' : ''}"><b>${counts.over}</b> Follow-Up Due</span><span class="${counts.review ? 'good' : ''}"><b>${counts.review}</b> To Review & Log</span></div>
    <div class="lx-tabs">${tabs.map(([k, l]) => `<button class="${S.tab === k ? 'on' : ''}" onclick="MR.tab('${k}')">${l}</button>`).join('')}</div>
    <div id="mr-pane"></div>`;
    ({ requests: renderRequests, new: renderNew, auth: renderAuth, dir: renderDir, file: renderFile, score: renderScore })[S.tab]();
    Sim.label('Medical Records Requests');
}
const pane = () => document.getElementById('mr-pane');
const statusCls = (s) => ({ 'Delivered': 'good', 'Completed': 'good', 'Rejected': 'bad', 'No records': 'bad', 'Awaiting payment': 'warn', 'Fee disputed': 'warn', 'Closed': 'mute' }[s] || '');

function renderRequests() {
    if (!S.requests.length) { pane().innerHTML = `<div class="sim-card"><p class="mr-brief">${E(SC.brief)}</p>
        <p class="sim-muted mr-small">Today is ${E(LR.fmt(S.today))}; the attorney wants it all logged by ${E(LR.fmt(S.goal || SC.goal))}.${MR_CLOCK.pinned ? ' The case file is pinned to the dates on the course\'s printed documents, so they agree with what you read here.' : ''} ${S.sameDay ? 'Same-day receipt is on, so you can work the whole collection through in one sitting.' : 'Same-day receipt is off: the providers answer over the following business days, so move the calendar forward to see what comes back.'}</p><h4>Providers named at intake</h4><ul class="mr-list">${SC.intake.map(x => `<li>${E(x)}</li>`).join('')}</ul>
        <p class="sim-muted">Start with the <b>🔐 Authorizations</b> tab: a request is only as good as the authorization attached to it. Then use <b>➕ New Request</b>.</p></div>`; return; }
    const r = S.open && req(S.open);
    pane().innerHTML = `<div class="sim-card"><div class="sim-table-wrap"><table class="sim-table mr-table"><thead><tr><th>Request</th><th>Provider</th><th>Asking for</th><th>Dates of service</th><th>Status</th><th>Next action</th></tr></thead><tbody>
        ${S.requests.map(x => `<tr class="${S.open === x.no ? 'on' : ''}" onclick="MR.openReq('${x.no}')"><td class="mono">${x.no}</td><td>${E(P(x.provider).name)}</td><td>${x.types.map(t => `<span class="mr-t ${x.ts[t] || ''}">${E(MR_TYPES[t].split(' (')[0])}</span>`).join(' ')}</td>
            <td class="mono">${LR.short(x.dosFrom)}–${LR.short(x.dosTo)}</td><td><span class="mr-st ${statusCls(x.status)}">${E(x.status)}</span>${x.logged ? ' <span class="mr-st good">Logged</span>' : ''}</td>
            <td>${nextAction(x)}</td></tr>`).join('')}</tbody></table></div></div>
    ${r ? detail(r) : ''}`;
}
function nextAction(r) {
    if (r.status === 'Awaiting payment') return '💳 Review the invoice';
    if (r.status === 'Fee disputed') return 'Waiting for a revised invoice';
    if (overdue(r)) return `<span class="bad">📞 Follow up (due ${LR.short(r.nextFollowUp)})</span>`;
    if (open(r)) return `Follow up by ${LR.short(r.nextFollowUp)}`;
    if (r.status === 'Rejected') return '↻ Fix and resubmit';
    if (r.status === 'Delivered' && !r.logged) return '🔎 Review & log';
    return '—';
}
function detail(r) {
    const p = P(r.provider);
    return `<div class="sim-card mr-detail"><div class="dk-row"><h3 style="margin:0">${r.no} · ${E(p.name)}</h3><span class="mr-st ${statusCls(r.status)}">${E(r.status)}</span></div>
        <div class="sim-muted mr-small">${E(p.dept)} · ${E(p.method)} · submitted ${LR.short(r.submitted)} · delivery: ${E(r.delivery)}${r.rush ? ' · RUSH' : ''}</div>
        <div class="mr-cols"><div><h4>Timeline</h4><ul class="mr-tl">${r.events.slice().reverse().map(e => `<li class="${e.kind}"><span class="mono">${LR.short(e.date)}</span> ${E(e.text)}</li>`).join('')}</ul></div>
        <div><h4>Actions</h4><div class="mr-actions">
            ${r.invoice && r.invoice.status === 'due' ? `<div class="mr-inv">Invoice ${money(r.invoice.amount)} · ${r.invoice.pages} pages<br><small>State cap: $25 + $0.25/page = ${money(r.invoice.cap)}</small><div class="lx-acts"><button class="sim-btn primary" onclick="MR.pay('${r.no}')">💳 Pay ${money(r.invoice.amount)}</button><button class="sim-btn ghost" onclick="MR.dispute('${r.no}')">Dispute (over the cap)</button></div></div>` : ''}
            ${open(r) ? `<button class="sim-btn ghost" onclick="MR.followUp('${r.no}')">📞 Log a Follow-Up Call</button>` : ''}
            ${r.status === 'Rejected' || r.status === 'No records' ? `<button class="sim-btn orange" onclick="MR.resubmit('${r.no}')">↻ Fix and Resubmit</button>` : ''}
            ${r.delivered && Object.keys(r.delivered).length ? `<button class="sim-btn primary" onclick="MR.review('${r.no}')">🔎 Review the Records</button>` : ''}
            ${r.provider === 'chiro' && r.delivered && r.delivered.bill && !r.ledgerComplete && !r.ledgerAsked ? `<button class="sim-btn ghost" onclick="MR.askLedger('${r.no}')">Request the Complete Ledger</button>` : ''}
            ${r.delivered && Object.keys(r.delivered).length && !r.logged ? `<button class="sim-btn orange" onclick="MR.logIt('${r.no}')">📁 Log to Case File</button>` : ''}
        </div></div></div>
        <div id="mr-review"></div></div>`;
}
function reviewHtml(r) {
    const p = P(r.provider), fs = MR_FINDINGS.filter(f => f.provider === r.provider);
    return `<div class="mr-rev"><h4>Delivered: ${E(p.name)}</h4>${Object.entries(r.delivered).map(([t, d]) => docBlock(r, t, d)).join('')}
        ${fs.length ? `<h4>Anything to flag?</h4><p class="sim-muted mr-small">Tick only what is really wrong or needs action. False alarms cost points.</p>${fs.map(f => `<label class="mr-flag"><input type="checkbox" ${(r.flags || []).includes(f.id) ? 'checked' : ''} onchange="MR.flag('${r.no}','${f.id}',this.checked)"> ${E(f.text)}</label>`).join('')}` : ''}</div>`;
}

/* One delivered document: what came back, and the file it is. The paper is shown on request so a
   long review isn't a wall of documents, and the three ways out sit together: read it, download it
   to add on the case file's Files yourself, or file it straight into the case you came from. */
function docBlock(r, t, d) {
    const doc = docOf(r, t), f = fileRec(r, t), open = (r.show || {})[t];
    return `<div class="mr-doc"><b>${E(MR_TYPES[t] ? MR_TYPES[t].split(' (')[0] : t)}</b> · ${d.pages} pages${d.lines ? ` · ${d.lines.length} itemized line${d.lines.length === 1 ? '' : 's'} · ${E(MRDocs.money(d.lines.reduce((a, x) => a + x.amount, 0)))}` : ''}
        <p>${E(d.text)}</p>
        <div class="mrd-acts">
            <button class="sim-btn ghost" onclick="MR.showDoc('${r.no}','${t}')">${open ? '▴ Hide the document' : '📄 Open the document'}</button>
            <button class="sim-btn primary" onclick="MR.download('${r.no}','${t}')">⬇ Download PDF</button>
            <button class="sim-btn orange" onclick="MR.sendDoc('${r.no}','${t}',this)">📤 File it in ${E(DEST.name)}</button>
            <span class="sim-muted mr-small">${E(doc.name)}</span>
        </div>
        <div class="mrd-msg ${f.filed ? 'ok' : ''}" id="mrd-msg-${r.no}-${t}">${f.filed ? `✓ Filed in ${E(DEST.name)} as ${E(f.filedAs)} under ${E(doc.category)}.`
            : f.downloaded ? `⬇ Downloaded as ${E(f.filedAs || doc.name)}. Add it on ${E(DEST.files)} under ${E(doc.category)}.` : ''}</div>
        ${open ? MRDocs.html(doc) : ''}</div>`;
}

function renderNew() {
    const d = S.draft || { provider: '', types: ['records', 'bill'], dosFrom: SC.client.dol, dosTo: SC.start, delivery: 'Secure electronic delivery', rush: false, auth: 'general', notes: '' };
    const provs = MR_PROVIDERS.filter(visible);
    pane().innerHTML = `<form class="sim-card lx-form mr-new" onsubmit="MR.create(event)"><h3 style="margin-top:0">New Records Request</h3>
        <label>Provider<select id="n-prov" required><option value="">Choose from the directory…</option>${provs.map(p => `<option value="${p.id}" ${d.provider === p.id ? 'selected' : ''}>${E(p.name)} — ${E(p.type)}</option>`).join('')}</select></label>
        <fieldset class="mr-types"><legend>What are you requesting?</legend>${Object.entries(MR_TYPES).map(([k, l]) => `<label><input type="checkbox" value="${k}" ${d.types.includes(k) ? 'checked' : ''}> ${E(l)}</label>`).join('')}</fieldset>
        <div class="lx-grid"><label>Dates of service: from<input type="date" id="n-from" value="${E(d.dosFrom)}" required></label><label>to<input type="date" id="n-to" value="${E(d.dosTo)}" required></label>
            <label>Authorization attached<select id="n-auth"><option value="general">HIPAA authorization (general)${S.auth.signedOn ? ' — signed ' + LR.short(S.auth.signedOn) : ' — NOT SIGNED'}</option>${S.psychAuth.exists ? `<option value="psych">+ Separate authorization for psychotherapy notes${S.psychAuth.signedOn ? ' — signed' : ' — not signed'}</option>` : ''}</select></label></div>
        <div class="lx-grid"><label>Delivery<select id="n-del"><option>Secure electronic delivery</option><option>Mail (paper)</option><option>Disc by mail</option></select></label>
            <label class="mr-inline"><input type="checkbox" id="n-rush" ${d.rush ? 'checked' : ''}> Rush processing (+$25, about 2 days faster)</label></div>
        <label>Notes to the provider<input id="n-notes" maxlength="200" placeholder="e.g. Include all dates of service; send itemized bills with CPT codes"></label>
        <div class="lx-acts"><button class="sim-btn primary" type="submit">Send Request</button></div>
        <p class="sim-muted mr-small">The request goes out today (${LR.fmt(S.today)}). ${S.sameDay ? 'With same-day receipt on, what the provider sends back is waiting for you as soon as you send it.' : 'Providers answer over the following business days: move the calendar forward to see what comes back.'}</p></form>`;
}
function renderAuth() {
    const a = S.auth;
    pane().innerHTML = `<div class="sim-card mr-auth"><h3 style="margin-top:0">HIPAA Authorization on File (JD06)</h3>
        <div class="mr-form-doc">
            <div class="mr-fd-h">AUTHORIZATION FOR RELEASE OF PROTECTED HEALTH INFORMATION</div>
            <p><b>Patient:</b> ${E(SC.client.name)} &nbsp; <b>DOB:</b> ${LR.short(SC.client.dob)}</p>
            <p><b>Information to be disclosed:</b> All medical records, imaging, and itemized billing relating to injuries from the motor vehicle collision of ${LR.short(SC.client.dol)}, including spinal trauma and facial lacerations.</p>
            <p><b>Who may disclose:</b> Any physician, hospital, clinic, imaging center, ambulance service or other health care provider.</p>
            <p><b>Disclose to:</b> LSH Partner Firm, attorneys for the patient.</p>
            <p><b>Purpose:</b> At the request of the individual, for a personal injury claim.</p>
            <p><b>Expires:</b> Upon final resolution of the claim.</p>
            <p><b>Right to revoke:</b> I may revoke this authorization in writing at any time, except to the extent action has already been taken.</p>
            <p><b>Redisclosure:</b> Information disclosed may be redisclosed by the recipient and no longer protected by federal privacy rules.</p>
            <div class="mr-sign"><div>Signature of patient: <span class="${a.signedOn ? 'ok' : 'miss'}">${a.signedOn ? '/s/ John Doe (e-signed)' : '________________'}</span></div><div>Date: <span class="${a.signedOn ? 'ok' : 'miss'}">${a.signedOn ? LR.short(a.signedOn) : '__________'}</span></div></div>
        </div>
        <h4>Review it before you use it</h4><p class="sim-muted mr-small">Which required elements are missing or defective? (45 CFR 164.508(c))</p>
        ${[['description', 'Description of the information'], ['who', 'Who may disclose'], ['recipient', 'Who receives it'], ['purpose', 'Purpose'], ['expiration', 'Expiration date or event'], ['signature', 'Patient signature'], ['date', 'Date signed'], ['revoke', 'Right-to-revoke statement']]
            .map(([k, l]) => `<label class="mr-flag"><input type="checkbox" ${(a.reviewed || []).includes(k) ? 'checked' : ''} onchange="MR.authFlag('${k}',this.checked)"> ${E(l)} is missing or defective</label>`).join('')}
        <div class="lx-acts">${a.signedOn ? `<span class="mr-st good">Signed and dated ${LR.short(a.signedOn)}</span>` : a.sentOn ? `<span class="mr-st warn">Sent to the client for e-signature on ${LR.short(a.sentOn)}; usually back the next business day</span>` : `<button class="sim-btn orange" onclick="MR.sendAuth()">✍️ Send to John Doe for E-Signature</button>`}</div>
    </div>
    <div class="sim-card"><h3 style="margin-top:0">Separate Authorization: Psychotherapy Notes</h3>
        <p class="mr-small">Psychotherapy notes (a therapist's separate session notes) need their own authorization; a general authorization never covers them. The neuropsychological <b>evaluation report</b> is a regular medical record and is covered by the general authorization.</p>
        ${S.psychAuth.exists ? `<span class="mr-st ${S.psychAuth.signedOn ? 'good' : 'warn'}">${S.psychAuth.signedOn ? 'Signed ' + LR.short(S.psychAuth.signedOn) : 'Sent for signature ' + LR.short(S.psychAuth.sentOn)}</span>` : `<button class="sim-btn ghost" onclick="MR.psychAuth()">Prepare and Send a Separate Authorization</button>`}
    </div>`;
}
function renderDir() {
    pane().innerHTML = `<div class="sim-card"><p class="sim-muted mr-small">The providers John Doe's records point to. New providers appear here when you find them in records you've reviewed.</p>
        <div class="sim-table-wrap"><table class="sim-table"><thead><tr><th>Provider</th><th>Type</th><th>Release of information</th><th>How to send</th><th>Typical turnaround</th><th>Fees</th></tr></thead><tbody>
        ${MR_PROVIDERS.filter(visible).map(p => `<tr><td><b>${E(p.name)}</b>${p.hidden ? ' <span class="mr-st good">found in the records</span>' : ''}${p.prior ? ' <span class="mr-st">prior history</span>' : ''}${p.unrelated ? ' <span class="mr-st">history on file: 2019</span>' : ''}</td><td>${E(p.type)}</td><td>${E(p.dept)}</td><td>${E(p.method)}</td><td>${p.days} business days${p.slow ? ' (slow to respond)' : ''}</td><td>${p.fee ? (p.fee.flat != null ? `Flat ${money(p.fee.flat)}` : '$25 + $0.25/page') : 'No charge'}</td></tr>`).join('')}
        </tbody></table></div></div>`;
}
function renderFile() {
    const logged = S.requests.filter(r => r.logged), prod = produced();
    pane().innerHTML = `${destCard()}
    ${prod.length ? `<div class="sim-card"><h3 style="margin-top:0">📄 Documents Produced</h3>
        <p class="sim-muted mr-small">Every record and itemized bill a provider has produced, as the file it is. Download it to add on ${E(DEST.files)} yourself, or file it straight into the case open in ${E(DEST.name)}.</p>
        <div class="sim-table-wrap"><table class="sim-table"><thead><tr><th>Produced</th><th>Provider</th><th>Document</th><th>Pages</th><th>File name</th><th>Status</th><th></th></tr></thead><tbody>
        ${prod.flatMap(r => Object.entries(r.delivered).map(([t, d]) => {
            const doc = docOf(r, t), f = fileRec(r, t);
            return `<tr><td class="mono">${LR.short(r.deliveredOn || r.submitted)}</td><td>${E(P(r.provider).name.split(' — ')[0])}</td>
                <td>${E(MR_TYPES[t] ? MR_TYPES[t].split(' (')[0] : t)}<br><small class="sim-muted">${E(doc.category)}</small></td>
                <td>${d.pages}</td><td class="mono mr-small">${E(doc.name)}</td>
                <td>${f.filed ? '<span class="mr-st good">Filed</span>' : f.downloaded ? '<span class="mr-st">Downloaded</span>' : '<span class="mr-st mute">Not filed</span>'}</td>
                <td><button class="sim-btn ghost" onclick="MR.download('${r.no}','${t}')">⬇ PDF</button>
                    <button class="sim-btn ghost" onclick="MR.sendDoc('${r.no}','${t}',this)">📤 File it</button></td></tr>`;
        })).join('')}</tbody></table></div></div>` : ''}
    <div class="sim-card"><h3 style="margin-top:0">📁 Case File: Records Logged</h3>
        ${logged.length ? `<div class="sim-table-wrap"><table class="sim-table"><thead><tr><th>Logged</th><th>Provider</th><th>What</th><th>Pages</th><th>Request</th></tr></thead><tbody>${logged.map(r => `<tr><td class="mono">${LR.short(r.loggedOn)}</td><td>${E(P(r.provider).name)}</td><td>${Object.keys(r.delivered).map(t => E(MR_TYPES[t] ? MR_TYPES[t].split(' (')[0] : t)).join(', ')}${r.ledgerComplete ? ' (complete ledger)' : ''}</td><td>${Object.values(r.delivered).reduce((a, x) => a + (x.pages || 0), 0)}</td><td class="mono">${r.no}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="sim-muted">Nothing logged yet. Delivered records show up here once you log them.</p>'}
        <h4>Activity</h4><ul class="mr-tl">${S.log.slice().reverse().map(l => `<li><span class="mono">${LR.short(l.date)}</span> ${E(l.text)}</li>`).join('') || '<li class="sim-muted">No activity yet.</li>'}</ul></div>`;
}
/* Where these documents belong: the platform the trainee is requesting from, the Case ID on that
   case, and the one naming convention every file goes in under. Nothing is guessed — a Case ID the
   launcher didn't pass is typed here, and until it is, files are named NO-CASE-ID_… as the CMS
   itself names a file uploaded before the case has its ID. */
function destCard() {
    const id = String(DEST.caseId || '').trim(), real = /\d/.test(id) && /^[A-Za-z0-9-]+$/.test(id);
    return `<div class="sim-card"><div class="mrd-dest"><h4>📂 These records belong to the case file in ${E(DEST.name)}</h4>
        <p style="margin:4px 0">You opened this platform from ${E(DEST.name)}, so every record and bill you collect is filed there, on ${E(DEST.files)}, named the firm's way:
            <br><code>&lt;Case ID&gt;_&lt;Last-First&gt;_&lt;Type&gt;_&lt;YYYY-MM-DD&gt;.pdf</code> — the Type is the category it is filed under (Medical Records, Bills).</p>
        <label>Case ID on that case
            <input id="mrd-case" value="${E(id)}" placeholder="e.g. LSH-2026-MVA-000041" onchange="MR.caseId(this.value)">
            ${real ? `<span class="mrd-eg ok">Files named <code>${E(MRDocs.fileName({ caseId: id, patient: SC.client, kind: 'records' }))}</code></span>`
                : '<span class="mrd-eg warn">Without it, files are named <code>NO-CASE-ID_…</code> — open your case and copy its Case ID in</span>'}</label>
        <p style="margin:8px 0 0">${DEST.key === 'portal'
            ? 'Opened on its own, from the Portal rather than from a case, so there is no case to file into: <b>⬇ Download PDF</b> each document and add it on your own case file. Open this platform from the CMS or from your course and <b>📤 File it</b> files them for you.'
            : DEST.wired
                ? `<b>📤 File it</b> puts the document straight into the case you have open in ${E(DEST.name)} — keep it open beside this platform. Otherwise <b>⬇ Download PDF</b> and add it on ${E(DEST.files)} yourself.
                   <br><a href="${E(DEST.fromUrl)}" target="_blank" rel="noopener">Open ${E(DEST.name)} ↗</a>`
                : `<b>⬇ Download PDF</b> each document and add it on ${E(DEST.files)}. <b>📤 File it</b> works when you open this platform from the CMS itself, with your case open in it.
                   <br><a href="${E(DEST.fromUrl)}" target="_blank" rel="noopener">Open ${E(DEST.name)} ↗</a>`}</p>
    </div></div>`;
}

function renderScore() {
    const s = score();
    pane().innerHTML = `<div class="sim-card"><div class="dk-res-top"><div class="ring">${s.total}%</div><div><h3 style="margin:0">Objectives</h3>
        <p class="sim-muted">Your score so far. Keep working, or finish to record it for your trainer.${S.finished ? ` Finished ${LR.short(S.finished.date)} with ${S.finished.score}%.` : ''}</p>
        <div class="lx-acts"><button class="sim-btn orange" onclick="MR.finish()">🏁 Finish and Record My Score</button><button class="sim-btn ghost" onclick="MR.restart()">↺ Start Over</button></div></div></div>
        ${s.items.map(i => `<div class="dk-res-item"><div class="dk-res-h"><b>${E(i.label)}</b><span class="mono">${i.got}/${i.max}</span></div><p class="mr-small ${i.got >= i.max ? 'ok' : 'bad'}">${E(i.detail)}</p></div>`).join('')}</div>`;
}

// ---------- actions ----------
window.MR = {
    tab(t) { S.tab = t; save(); render(); },
    next() { let n = 1; while (LR.closed(LR.add(S.today, n))) n++; advance(n); },
    advance,
    openReq(no) { S.open = S.open === no ? null : no; save(); render(); },
    create(e) {
        e.preventDefault();
        const types = [...document.querySelectorAll('.mr-types input:checked')].map(i => i.value);
        if (!types.length) { alert('Choose at least one record type.'); return; }
        const r = { no: `MRR-${S.today.slice(0, 4)}-` + String(++S.seq).padStart(5, '0'), provider: document.getElementById('n-prov').value, types, ts: {},
            dosFrom: document.getElementById('n-from').value, dosTo: document.getElementById('n-to').value, auth: document.getElementById('n-auth').value,
            delivery: document.getElementById('n-del').value, rush: document.getElementById('n-rush').checked, notes: document.getElementById('n-notes').value, events: [], queue: [], flags: [] };
        if (r.dosFrom > r.dosTo) { alert('The "from" date is after the "to" date.'); return; }
        S.requests.push(r); submit(r); S.log.push({ date: S.today, text: `Sent ${r.no} to ${P(r.provider).name}.` });
        S.draft = null; S.open = r.no; S.tab = 'requests'; settle(); save(); render();
    },
    resubmit(no) {
        const o = req(no); S.draft = { provider: o.provider, types: o.types, dosFrom: o.dosFrom, dosTo: o.dosTo, rush: o.rush };
        o.status = 'Closed'; note(o, 'Closed; a corrected request replaces it.'); S.tab = 'new'; save(); render();
    },
    pay(no) { const r = req(no); r.invoice.status = 'paid'; r.invoice.paid = r.invoice.amount; r.status = 'In process'; note(r, `Paid ${money(r.invoice.amount)}.`, 'money'); S.log.push({ date: S.today, text: `Paid ${money(r.invoice.amount)} to ${P(r.provider).name} (${no}).` }); at(r, respond(2), 'deliver'); settle(); save(); render(); },
    dispute(no) { const r = req(no); if (r.invoice.amount <= r.invoice.cap + 0.01) { alert('This invoice is within the state fee cap. Disputing it would only delay the records.'); return; } r.invoice.status = 'disputed'; r.status = 'Fee disputed'; note(r, `Disputed the ${money(r.invoice.amount)} invoice as over the state fee cap (${money(r.invoice.cap)}).`, 'money'); at(r, respond(2), 'revised'); settle(); save(); render(); },
    followUp(no) {
        const r = req(no), p = P(r.provider); r.followUps = (r.followUps || 0) + 1; r.nextFollowUp = bd(S.today, 5);
        note(r, `Follow-up call to ${p.dept}: confirmed the request is in the queue. Next follow-up ${LR.short(r.nextFollowUp)}.`, 'sent');
        if (p.slow && r.status === 'In process' && !r.queue.some(q => q.action === 'deliver') && hadTime(r.submitted, p.days)) { note(r, 'They found the request under the wrong patient name and are processing it now.', 'warn'); at(r, respond(2), 'deliver'); }
        settle(); save(); render();
    },
    askLedger(no) { const r = req(no); r.ledgerAsked = true; note(r, 'Asked for the complete billing ledger for all 14 visits.', 'sent'); at(r, respond(3), 'ledger'); r.status = 'In process'; settle(); save(); render(); },
    review(no) {
        const r = req(no), p = P(r.provider);
        MR_PROVIDERS.filter(x => x.hidden === p.id || (x.id === 'anes' && p.id === 'pfs')).forEach(x => { if (!S.revealed[x.id]) { S.revealed[x.id] = true; S.log.push({ date: S.today, text: `Found a new provider in the records: ${x.name}.` }); } });
        if (S.open !== no || S.tab !== 'requests' || !document.getElementById('mr-review')) { S.open = no; S.tab = 'requests'; render(); }
        save(); document.getElementById('mr-review').innerHTML = reviewHtml(r);
    },
    flag(no, id, on) { const r = req(no); r.flags = (r.flags || []).filter(x => x !== id); if (on) r.flags.push(id); save(); },
    showDoc(no, t) { const r = req(no); r.show = r.show || {}; r.show[t] = !r.show[t]; save(); MR.review(no); },
    download(no, t) {
        const r = req(no), doc = docOf(r, t), f = fileRec(r, t);
        if (!MRDocs.download(doc, (m) => alert(m))) return;
        f.downloaded = true; f.filedAs = doc.name;
        S.log.push({ date: S.today, text: `Downloaded ${MR_TYPES[t] ? MR_TYPES[t].split(' (')[0] : t} from ${P(r.provider).name} as ${doc.name}.` });
        save(); render(); if (S.tab === 'requests') MR.review(no);
    },
    async sendDoc(no, t, btn) {
        const r = req(no), doc = docOf(r, t), f = fileRec(r, t);
        const say = (html, cls) => { const el = document.getElementById(`mrd-msg-${no}-${t}`); if (el) { el.className = 'mrd-msg ' + (cls || ''); el.innerHTML = html; } };
        if (btn) { btn.disabled = true; btn.textContent = 'Filing…'; }
        say('Filing it in ' + E(DEST.name) + '…');
        const out = await MRDocs.send(doc);
        if (btn) { btn.disabled = false; btn.textContent = `📤 File it in ${DEST.name}`; }
        if (out && out.ok) {
            f.filed = true; f.filedAs = out.name || doc.name; f.at = S.today;
            S.log.push({ date: S.today, text: `Filed ${f.filedAs} into the case file in ${DEST.name} (${no}).` });
            save(); render(); if (S.tab === 'requests') MR.review(no);
            return;
        }
        // Nothing listening, or the platform refused the name: the download is always the way through.
        const problems = (out && out.problems) || [];
        say(`${E((out && out.error) || 'It could not be filed.')}${problems.length ? `<ul style="margin:4px 0 0">${problems.map(x => `<li>${E(x)}</li>`).join('')}</ul>` : ''}
            <br>Use <b>⬇ Download PDF</b> and add <b>${E(doc.name)}</b> on ${E(DEST.files)} under ${E(doc.category)}.`, 'bad');
    },
    caseId(v) { MRDocs.setCaseId(v); DEST = MRDocs.dest(); save(); render(); },
    logIt(no) { const r = req(no); r.logged = true; r.loggedOn = S.today; if (r.status === 'Delivered') r.status = 'Completed'; note(r, 'Logged to the case file.', 'good'); S.log.push({ date: S.today, text: `Logged ${P(r.provider).name} records to the case file (${no}).` }); save(); render(); },
    sendAuth() { S.auth.sentOn = S.today; S.log.push({ date: S.today, text: 'Sent the HIPAA authorization to John Doe for e-signature.' }); settle(); save(); render(); },
    psychAuth() { S.psychAuth = { exists: true, sentOn: S.today, signedOn: null }; S.log.push({ date: S.today, text: 'Sent a separate psychotherapy-notes authorization for signature.' }); settle(); save(); render(); },
    authFlag(k, on) { S.auth.reviewed = (S.auth.reviewed || []).filter(x => x !== k); if (on) S.auth.reviewed.push(k); save(); },
    finish() {
        const s = score(); S.finished = { date: S.today, score: s.total }; save();
        Sim.saveResult({ simulator: 'Medical Records Requests', scenario: SC.title, score: s.total, summary: `${S.requests.length} requests · finished ${LR.short(S.today)}`, details: { requests: S.requests.map(r => ({ no: r.no, provider: P(r.provider).name, status: r.status, logged: !!r.logged })), objectives: s.items } });
        render(); alert(`Recorded: ${s.total}%. Your request numbers (e.g. ${S.requests[0] ? S.requests[0].no : 'MRR-…'}) are what you log in the CM course.`);
    },
    sameDay(on) {
        S.sameDay = !!on;
        S.log.push({ date: S.today, text: on ? 'Same-day receipt on: what the providers and the client send back arrives the same day.'
                                             : 'Same-day receipt off: the providers answer over the following business days again.' });
        settle(); save(); render();
    },
    restart() { if (!confirm(`Start the records collection over from ${LR.fmt(SC.start)}?`)) return; const keep = S.sameDay; S = fresh(); S.sameDay = keep; save(); render(); }
};

// A new tab (a course's link opens with noopener, or a bookmark) has the cookie but no copy of the session: ask who is
// signed in before the first render, so the heartbeat starts and a signed-in trainee practices as their own account.
Sim.restore().then(() => { document.getElementById('topbar').innerHTML = Sim.topbar('records'); catchUp(); settle(); save(); render(); });
})();

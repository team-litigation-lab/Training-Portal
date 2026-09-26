/* LSH Training Portal — Docket System simulator.
   Court records (a federal-style docket report per case), the firm's deadline calendar,
   a rules-based deadline calculator, and docketing assignments: an inbox of court notices
   and mail to docket and calendar, checked against the key. Saved in this browser. */
(function () {
const E = Sim.esc, KEY = 'LSH_DOCKET_V1';
const CAT_COLOR = { PLEADING: '#262B45', NOTICE: '#2E6E7E', MOTION: '#C2621B', ORDER: '#B23B2E', STIPULATION: '#3E7A52', MINUTE: '#6B6E76' };
const STATUS_CLS = { Active: 'ok', Stayed: 'warn', Closed: 'mute' };
const REMINDERS = [30, 14, 7, 3, 1];
const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 9);

let S = load();
function fresh() { return { cases: clone(DK_CASES), deadlines: [], processed: {}, assign: (DK_ASSIGNMENTS.find(a => a.program === (Sim.who().program || '').toUpperCase()) || DK_ASSIGNMENTS[0]).id, results: {}, tab: 'inbox', caseId: 'harlow', cat: 'All', q: '', calcUnlocked: {} }; }
function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.cases) { DK_CASES.forEach(c => { if (!s.cases.find(x => x.id === c.id)) s.cases.push(clone(c)); }); return Object.assign(fresh(), s); } } catch (e) {}
    return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const cat = (t) => DK_ENTRY_TYPES[t] || 'MINUTE';
const caseOf = (id) => S.cases.find(c => c.id === id);
const assignment = () => DK_ASSIGNMENTS.find(a => a.id === S.assign) || DK_ASSIGNMENTS[0];
const badge = (t) => { const c = cat(t); return `<span class="dk-badge" style="color:${CAT_COLOR[c]};border-color:${CAT_COLOR[c]}">${c}</span>`; };
function keyFor(a) {   // the answer key for an assignment, computed by the rules engine
    const method = (caseOf(a.caseId) || {}).method || 'frcp';
    return a.items.map(it => ({ ...it, deadlines: it.deadlines.map(d => ({ ...d, ...LR.compute({ rule: d.rule, trigger: d.trigger, service: d.service, method }) })) }));
}
const locked = () => !S.calcUnlocked[S.assign] && !Sim.isAdmin();

// ---------- shell ----------
function render() {
    const tabs = [['inbox', '📥 Docketing Inbox'], ['records', '⚖️ Court Records'], ['calendar', '🗓 Firm Calendar'], ['calc', '🧮 Deadline Calculator']];
    document.getElementById('app').innerHTML = `
        <div class="dk-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="${S.tab === k ? 'on' : ''}" onclick="DK.tab('${k}')">${l}${k === 'calendar' ? ` <span class="n">${S.deadlines.filter(d => d.status !== 'done').length}</span>` : ''}</button>`).join('')}</div>
        <div id="dk-pane"></div>`;
    ({ inbox: renderInbox, records: renderRecords, calendar: renderCalendar, calc: renderCalc })[S.tab]();
    Sim.label('Docket System · ' + tabs.find(t => t[0] === S.tab)[1].slice(3));
}
const pane = () => document.getElementById('dk-pane');

// ---------- inbox (assignments) ----------
function renderInbox() {
    const a = assignment(), c = caseOf(a.caseId), key = keyFor(a), res = S.results[a.id];
    const done = a.items.filter(i => S.processed[i.id]).length;
    const sel = S.item && a.items.find(i => i.id === S.item);
    pane().innerHTML = `
    <div class="sim-card dk-assign">
        <div class="dk-row"><label class="dk-lbl">Assignment <select onchange="DK.pick(this.value)">${DK_ASSIGNMENTS.map(x => `<option value="${x.id}" ${x.id === a.id ? 'selected' : ''}>${E(x.title)}</option>`).join('')}</select></label>
            <span class="sim-muted">${done} of ${a.items.length} items processed${res ? ` · last check ${Sim.scoreChip(res.score)}` : ''}</span>
            <span class="grow"></span><button class="sim-btn ghost" onclick="DK.reset()">↺ Start over</button></div>
        <p class="dk-intro">${E(a.intro)}</p>
        <div class="dk-case-mini"><b>${E(c.caption)}</b> · ${E(c.caseNumber)} · ${E(c.court)} · ${c.method === 'frcp' ? 'Federal rules (FRCP 6)' : 'Training state rules'}</div>
    </div>
    <div class="dk-inbox">
        <div class="sim-card dk-list">${a.items.map(it => `<button class="dk-mail ${sel && sel.id === it.id ? 'on' : ''} ${S.processed[it.id] ? 'done' : ''}" onclick="DK.open('${it.id}')">
            <span class="dk-kind ${it.kind}">${it.kind}</span><span class="dk-mail-tx"><b>${E(it.subject)}</b><small>${E(it.from)} · ${LR.short(it.received)}</small></span>${S.processed[it.id] ? '<span class="dk-ok">✓</span>' : ''}</button>`).join('')}
            <div class="dk-check"><button class="sim-btn orange" onclick="DK.check()">✔ Check My Docketing</button>
            <p class="sim-muted">Checks every item: the court docket entry (or none), each deadline's date and time, and that each deadline has a responsible person and reminders.</p></div>
        </div>
        <div class="sim-card dk-read">${sel ? readItem(sel, c) : `<div class="dk-empty">Open an item on the left. Read it like a docketing clerk: <b>what happened, on what date, and what does it trigger?</b></div>`}</div>
    </div>
    <div id="dk-result">${res ? renderResult(a, res, key) : ''}</div>`;
}
function readItem(it, c) {
    const mine = S.deadlines.filter(d => d.itemId === it.id);
    const entry = c.entries.find(e => e.itemId === it.id);
    return `<div class="dk-read-h"><span class="dk-kind ${it.kind}">${it.kind === 'NEF' ? 'Notice of Electronic Filing' : it.kind}</span><h3>${E(it.subject)}</h3>
        <div class="sim-muted">From ${E(it.from)} · received ${LR.fmt(it.received)}</div></div>
        <pre class="dk-doc">${E(it.body)}</pre>
        <div class="dk-acts">
            <button class="sim-btn primary" onclick="DK.entryForm('${it.id}')">＋ Add to Court Docket</button>
            <button class="sim-btn primary" onclick="DK.deadlineForm('${it.id}')">＋ Calendar a Deadline</button>
            <button class="sim-btn ${S.processed[it.id] ? 'ghost' : 'orange'}" onclick="DK.toggleDone('${it.id}')">${S.processed[it.id] ? '↩ Mark Not Processed' : '✓ Mark Processed'}</button>
        </div>
        <div class="dk-mine"><b>What you've done with this item</b>
            ${entry ? `<div class="dk-mine-row">⚖️ Docket #${entry.seq} · ${LR.short(entry.date)} · ${E(entry.type)} <button class="dk-x" onclick="DK.delEntry('${c.id}',${entry.seq})" title="Remove">✕</button></div>` : '<div class="dk-mine-row sim-muted">No court docket entry.</div>'}
            ${mine.map(d => `<div class="dk-mine-row">🗓 ${LR.fmt(d.due)}${d.time ? ' ' + d.time : ''} · ${E(d.label)} · ${E(d.responsible || 'no one assigned')} · reminders ${d.reminders.length ? d.reminders.join('/') + 'd' : 'none'} <button class="dk-x" onclick="DK.delDeadline('${d.id}')" title="Remove">✕</button></div>`).join('') || '<div class="dk-mine-row sim-muted">No deadlines calendared.</div>'}
        </div>
        <div id="dk-form"></div>`;
}
function entryFormHtml(caseId, itemId) {
    return `<form class="dk-form" onsubmit="DK.saveEntry(event,'${caseId}','${itemId || ''}')"><h4>New Docket Entry — ${E(caseOf(caseId).caseNumber)}</h4>
        <div class="dk-grid"><label>Date filed / entered<input type="date" id="f-date" required></label>
        <label>Entry type<select id="f-type">${Object.keys(DK_ENTRY_TYPES).map(t => `<option>${E(t)}</option>`).join('')}</select></label>
        <label>Filed by<select id="f-by">${['Plaintiff', 'Defendant', 'Defendants', 'Court', 'Clerk', 'Both Parties', 'Petitioner', 'State'].map(x => `<option>${x}</option>`).join('')}</select></label></div>
        <label>Docket text<textarea id="f-desc" rows="3" required placeholder="e.g. MOTION to Dismiss for Failure to State a Claim by Tri-County Transit Authority. (Attachments: # 1 Memorandum…)"></textarea></label>
        <div class="dk-acts"><button class="sim-btn primary" type="submit">Save Entry</button><button type="button" class="sim-btn ghost" onclick="document.getElementById('dk-form').innerHTML=''">Cancel</button></div></form>`;
}
function deadlineFormHtml(caseId, itemId) {
    const c = caseOf(caseId);
    return `<form class="dk-form" onsubmit="DK.saveDeadline(event,'${caseId}','${itemId || ''}')"><h4>Calendar a Deadline — ${E(c.caption)}</h4>
        <label>What is due / what happens<input id="d-label" required maxlength="160" placeholder="e.g. Opposition to Motion to Dismiss due"></label>
        <div class="dk-grid"><label>Due date<input type="date" id="d-due" required></label><label>Time (hearings, cut-offs)<input type="time" id="d-time"></label>
        <label>Rule / source<select id="d-rule">${Object.entries(LR.RULES).map(([k, r]) => `<option value="${k}">${E(r.label)}${r.cite ? ' — ' + E(r.cite) : ''}</option>`).join('')}</select></label></div>
        <div class="dk-grid"><label>Responsible<select id="d-resp"><option value="">Choose…</option>${DK_ATTORNEYS.map(x => `<option>${E(x)}</option>`).join('')}</select></label>
        <fieldset class="dk-rem"><legend>Reminders (days before)</legend>${REMINDERS.map(n => `<label><input type="checkbox" value="${n}" ${[14, 7, 1].includes(n) ? 'checked' : ''}> ${n}</label>`).join('')}</fieldset></div>
        <label>Note<input id="d-note" maxlength="200" placeholder="How you computed it, or what to prepare"></label>
        ${locked() && itemId ? '<p class="sim-muted dk-small">Count this one yourself. The Deadline Calculator unlocks after you check this assignment.</p>' : ''}
        <div class="dk-acts"><button class="sim-btn primary" type="submit">Save Deadline</button><button type="button" class="sim-btn ghost" onclick="document.getElementById('dk-form').innerHTML=''">Cancel</button></div></form>`;
}

// ---------- check ----------
function check() {
    const a = assignment(), c = caseOf(a.caseId), key = keyFor(a);
    let got = 0, max = 0; const items = [];
    key.forEach(it => {
        const r = { id: it.id, subject: it.subject, notes: [], points: 0, max: 0 };
        const entry = c.entries.find(e => e.itemId === it.id);
        r.max += 2;
        if (it.docket) {
            if (!entry) r.notes.push({ ok: false, t: `Not on the court docket. It belongs there as a ${cat(it.docket.type).toLowerCase()} (${it.docket.type}) dated ${LR.short(it.docket.date)}.` });
            else if (entry.date !== it.docket.date) { r.points += 1; r.notes.push({ ok: false, t: `Docketed with date ${LR.short(entry.date)}; the ${it.kind === 'NEF' ? 'NEF' : 'notice'} shows ${LR.short(it.docket.date)}.` }); }
            else if (cat(entry.type) !== cat(it.docket.type)) { r.points += 1; r.notes.push({ ok: false, t: `Docketed as ${entry.type}; this is a ${cat(it.docket.type).toLowerCase()} (${it.docket.type}).` }); }
            else { r.points += 2; r.notes.push({ ok: true, t: `Court docket entry: ${it.docket.type}, ${LR.short(it.docket.date)}.` }); }
        } else if (entry) r.notes.push({ ok: false, t: `This does not belong on the court docket. ${it.notDocketWhy}` });
        else { r.points += 2; r.notes.push({ ok: true, t: `Correctly kept off the court docket. ${it.notDocketWhy}` }); }
        it.deadlines.forEach(d => {
            r.max += 3 + (d.time ? 1 : 0) + 1;
            const mine = S.deadlines.filter(x => x.caseId === c.id);
            // Credit a deadline logged against this notice (or one added from Court Records, not tied to any notice).
            const hit = mine.find(x => !x._used && x.due === d.due && x.itemId === it.id) || mine.find(x => !x._used && x.due === d.due && !x.itemId);
            const near = mine.find(x => x.itemId === it.id && x.due !== d.due && !x._used && !x._near);
            if (near && !hit) near._near = true;
            if (hit) {
                hit._used = true; r.points += 3;
                if (d.time) { if (hit.time === d.time) r.points += 1; else r.notes.push({ ok: false, t: `${d.label}: add the time, ${d.time}.` }); }
                if (hit.responsible && hit.reminders.length >= 2) r.points += 1; else r.notes.push({ ok: false, t: `${d.label}: give it a responsible person and at least two reminders.` });
                r.notes.push({ ok: true, t: `${d.label}: ${LR.fmt(d.due)}${d.time ? ' ' + d.time : ''} ✓` });
            } else r.notes.push({ ok: false, t: `${d.label}: due ${LR.fmt(d.due)}${d.time ? ' at ' + d.time : ''}.${near ? ` You calendared ${LR.fmt(near.due)}.` : ' Not calendared.'}`, steps: d.steps, cite: (LR.RULES[d.rule] || {}).cite });
        });
        got += r.points; max += r.max; items.push(r);
    });
    S.deadlines.forEach(x => { delete x._used; delete x._near; });
    const score = Math.round(got / max * 100);
    const ref = 'DKT-' + a.caseId.toUpperCase() + '-' + String(Math.floor(1000 + Math.random() * 9000));
    S.results[a.id] = { score, at: new Date().toISOString(), items, ref };
    S.calcUnlocked[a.id] = true; save();
    Sim.saveResult({ simulator: 'Docket System', scenario: a.title, score, summary: `${items.filter(i => i.points === i.max).length}/${items.length} items fully right · ref ${ref}`, details: { ref, items: items.map(i => ({ item: i.subject, points: i.points, max: i.max, misses: i.notes.filter(n => !n.ok).map(n => n.t) })) } });
    render(); setTimeout(() => { const el = document.getElementById('dk-result'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 50);
}
function renderResult(a, res) {
    return `<div class="sim-card dk-res"><div class="dk-res-top"><div class="ring">${res.score}%</div><div><h3>Docketing check</h3>
        <p class="sim-muted">${res.items.filter(i => i.points === i.max).length} of ${res.items.length} items fully right. Your docket reference for the CM course log: <b class="mono">${E(res.ref)}</b></p>
        <p class="sim-muted">The Deadline Calculator is now unlocked for this assignment: use it to see each computation.</p></div></div>
        ${res.items.map(i => `<div class="dk-res-item"><div class="dk-res-h"><b>${E(i.subject)}</b><span class="mono">${i.points}/${i.max}</span></div>
            <ul>${i.notes.map(n => `<li class="${n.ok ? 'ok' : 'bad'}">${n.ok ? '✓' : '✗'} ${E(n.t)}${n.steps ? `<div class="dk-steps">${n.cite ? `<b>${E(n.cite)}</b> · ` : ''}${n.steps.map(E).join(' → ')}</div>` : ''}</li>`).join('')}</ul></div>`).join('')}
    </div>`;
}

// ---------- court records ----------
function renderRecords() {
    const q = S.q.trim().toLowerCase();
    const list = S.cases.filter(c => !q || (c.caption + ' ' + c.caseNumber).toLowerCase().includes(q));
    const c = caseOf(S.caseId) || S.cases[0];
    const entries = c.entries.slice().sort((x, y) => x.seq - y.seq).filter(e => S.cat === 'All' || cat(e.type) === S.cat)
        .filter(e => !S.eq || (e.desc + ' ' + e.type).toLowerCase().includes(S.eq.toLowerCase()));
    const dls = S.deadlines.filter(d => d.caseId === c.id).sort((x, y) => (x.due + (x.time || '')).localeCompare(y.due + (y.time || '')));
    pane().innerHTML = `<div class="dk-records">
    <aside class="sim-card dk-cases"><div class="dk-row"><input type="search" placeholder="Search caption or case no." value="${E(S.q)}" oninput="DK.set('q',this.value)" aria-label="Search cases"></div>
        ${list.map(x => `<button class="dk-case ${x.id === c.id ? 'on' : ''}" onclick="DK.set('caseId','${x.id}')"><span class="mono">${E(x.caseNumber)}</span><b>${E(x.caption)}</b><span class="dk-st ${STATUS_CLS[x.status] || ''}">${E(x.status)}</span></button>`).join('')}
        <button class="sim-btn ghost dk-new" onclick="DK.newCaseForm()">＋ New Case</button><div id="dk-newcase"></div></aside>
    <section class="sim-card dk-report">
        <div class="dk-court">${E(c.court)}</div>
        <h2 class="dk-title">CIVIL DOCKET FOR CASE #: ${E(c.caseNumber)}</h2>
        <div class="dk-head"><div><b>${E(c.caption)}</b><br>Assigned to: ${E(c.judge)}${c.magistrate ? `<br>Referred to: ${E(c.magistrate)}` : ''}<br>Cause: ${E(c.cause || '')}</div>
            <div>Date Filed: ${LR.short(c.filed)}<br>Jury Demand: ${E(c.jury || 'None')}<br>Nature of Suit: ${E(c.nature || c.type)}<br>Status: <span class="dk-st ${STATUS_CLS[c.status] || ''}">${E(c.status)}</span>
            <select class="dk-stsel" onchange="DK.setStatus('${c.id}',this.value)" aria-label="Case status">${['Active', 'Stayed', 'Closed'].map(s => `<option ${c.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
        <table class="dk-parties">${(c.parties || []).map(p => `<tr><td><b>${E(p.role)}</b><br>${E(p.name)}</td><td>represented by<br>${E(p.counsel)}</td></tr>`).join('')}</table>
        <div class="dk-row dk-filt">${['All', 'PLEADING', 'NOTICE', 'MOTION', 'ORDER', 'STIPULATION', 'MINUTE'].map(k => `<button class="${S.cat === k ? 'on' : ''}" onclick="DK.set('cat','${k}')">${k}</button>`).join('')}
            <input type="search" placeholder="Search docket text" value="${E(S.eq || '')}" oninput="DK.set('eq',this.value,true)" aria-label="Search docket text">
            <span class="grow"></span><button class="sim-btn ghost" onclick="DK.csv('${c.id}')">⬇ CSV</button><button class="sim-btn primary" onclick="DK.recEntry('${c.id}')">＋ Docket Entry</button></div>
        <div id="dk-form"></div>
        <div class="sim-table-wrap"><table class="sim-table dk-table"><thead><tr><th>Date Filed</th><th>#</th><th>Docket Text</th></tr></thead><tbody id="dk-tbody">
            ${entries.map(e => `<tr><td class="mono">${LR.short(e.date)}</td><td class="mono">${e.seq}</td><td>${badge(e.type)} ${E(e.desc)}${e.itemId || e.mine ? ` <button class="dk-x" onclick="DK.delEntry('${c.id}',${e.seq})" title="Remove your entry">✕</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="3" class="sim-muted">No entries match.</td></tr>'}
        </tbody></table></div>
        <h3 class="dk-sub">Firm deadlines for this case <button class="sim-btn ghost" onclick="DK.recDeadline('${c.id}')">＋ Deadline</button></h3>
        ${deadlineTable(dls)}
    </section></div>`;
}
function deadlineTable(dls) {
    if (!dls.length) return '<p class="sim-muted">No deadlines calendared.</p>';
    return `<div class="sim-table-wrap"><table class="sim-table dk-table"><thead><tr><th>Due</th><th>What</th><th>Case</th><th>Responsible</th><th>Reminders</th><th>Status</th><th></th></tr></thead><tbody>
        ${dls.map(d => { const c = caseOf(d.caseId) || {}; return `<tr class="${d.status === 'done' ? 'dk-done' : ''}"><td class="mono">${LR.fmt(d.due)}${d.time ? '<br>' + d.time : ''}</td><td>${E(d.label)}${d.note ? `<br><small class="sim-muted">${E(d.note)}</small>` : ''}<br><small class="sim-muted">${E((LR.RULES[d.rule] || {}).cite || '')}</small></td>
        <td><small>${E(c.caseNumber || '')}</small></td><td>${E(d.responsible || '—')}</td><td class="mono">${d.reminders.length ? d.reminders.join('/') + 'd' : '—'}</td>
        <td><label class="dk-chk"><input type="checkbox" ${d.verified ? 'checked' : ''} onchange="DK.flag('${d.id}','verified',this.checked)"> Verified</label><label class="dk-chk"><input type="checkbox" ${d.status === 'done' ? 'checked' : ''} onchange="DK.flag('${d.id}','status',this.checked?'done':'open')"> Done</label></td>
        <td><button class="dk-x" onclick="DK.delDeadline('${d.id}')" title="Remove">✕</button></td></tr>`; }).join('')}</tbody></table></div>`;
}

// ---------- firm calendar ----------
function renderCalendar() {
    const f = S.calFilter || 'open';
    const dls = S.deadlines.filter(d => f === 'all' || (f === 'open' ? d.status !== 'done' : f === 'unverified' ? !d.verified : d.status === 'done'))
        .sort((x, y) => (x.due + (x.time || '')).localeCompare(y.due + (y.time || '')));
    const months = {};
    dls.forEach(d => { const m = d.due.slice(0, 7); (months[m] = months[m] || []).push(d); });
    pane().innerHTML = `<div class="sim-card"><div class="dk-row"><h2 style="margin:0">Firm Calendar</h2><span class="grow"></span>
        ${[['open', 'Open'], ['unverified', 'Not verified'], ['done', 'Done'], ['all', 'All']].map(([k, l]) => `<button class="sim-btn ${f === k ? 'primary' : 'ghost'}" onclick="DK.set('calFilter','${k}')">${l}</button>`).join('')}
        <button class="sim-btn ghost" onclick="DK.icsAll()">⬇ Calendar file (.ics)</button></div>
        <p class="sim-muted">Every deadline you've calendared, across all cases. In a real docketing department, a second person verifies each entry against the source document before it counts: tick <b>Verified</b> once you have.</p>
        ${Object.keys(months).map(m => `<h3 class="dk-sub">${new Date(m + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3>${deadlineTable(months[m])}`).join('') || '<p class="sim-muted">Nothing here yet. Calendar deadlines from the Docketing Inbox or a case in Court Records.</p>'}
    </div>`;
}

// ---------- calculator ----------
function renderCalc() {
    const lockedNow = locked();
    const cs = S.calc || { rule: 'answer', trigger: '', service: 'personal', method: 'frcp', days: '' };
    const r = cs.trigger ? LR.compute({ ...cs, days: cs.days === '' ? undefined : cs.days }) : null;
    pane().innerHTML = `<div class="sim-card dk-calc"><h2 style="margin:0 0 6px">Deadline Calculator</h2>
        <p class="sim-muted">Rules-based calendaring like the firm's docketing software: pick the rule and the triggering event, and it counts the days, skips weekends and court holidays, and adds service days where the rules allow.</p>
        ${lockedNow ? `<div class="dk-lock">🔒 Locked during the "${E(assignment().title)}" assignment. Count the deadlines yourself first; the calculator unlocks when you press <b>Check My Docketing</b>. Holidays this year: ${Object.entries(LR.HOLIDAYS).filter(([d]) => d.startsWith('2026')).map(([d, n]) => `${LR.short(d)} ${E(n)}`).join(' · ')}.</div>` : `
        <div class="dk-grid">
            <label>Counting method<select onchange="DK.calc('method',this.value)"><option value="frcp" ${cs.method === 'frcp' ? 'selected' : ''}>Federal (FRCP 6)</option><option value="state" ${cs.method === 'state' ? 'selected' : ''}>Training state rules (CM course)</option></select></label>
            <label>Rule<select onchange="DK.calc('rule',this.value)">${Object.entries(LR.RULES).map(([k, x]) => `<option value="${k}" ${cs.rule === k ? 'selected' : ''}>${E(x.label)}</option>`).join('')}</select></label>
            <label>${LR.RULES[cs.rule].fixed ? 'Date set by the court' : 'Trigger date (' + E(LR.RULES[cs.rule].from) + ')'}<input type="date" value="${E(cs.trigger)}" onchange="DK.calc('trigger',this.value)"></label>
            <label>Service<select onchange="DK.calc('service',this.value)">${Object.entries(LR.SERVICE).map(([k, x]) => `<option value="${k}" ${cs.service === k ? 'selected' : ''}>${E(x)}</option>`).join('')}</select></label>
            <label>Days (override)<input type="number" min="1" max="400" value="${E(cs.days)}" placeholder="${LR.RULES[cs.rule].days || ''}" onchange="DK.calc('days',this.value)"></label>
        </div>
        ${r ? `<div class="dk-calc-out"><div class="dk-due">${LR.fmt(r.due)}</div><ol>${r.steps.map(s => `<li>${E(s)}</li>`).join('')}</ol><p class="sim-muted">${E(LR.RULES[cs.rule].cite || '')}</p></div>` : '<p class="sim-muted">Enter the trigger date.</p>'}`}
    </div>`;
}

// ---------- actions ----------
window.DK = {
    tab(t) { S.tab = t; save(); render(); },
    set(k, v, keepFocus) { S[k] = v; save(); if (keepFocus && S.tab === 'records') { renderRecords(); const el = document.querySelector('.dk-filt input'); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } return; } render(); if (k === 'q') { const el = document.querySelector('.dk-cases input'); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } } },
    pick(id) { S.assign = id; S.item = null; save(); render(); },
    open(id) { S.item = id; save(); render(); },
    entryForm(itemId) { document.getElementById('dk-form').innerHTML = entryFormHtml(assignment().caseId, itemId); document.getElementById('f-date').focus(); },
    deadlineForm(itemId) { document.getElementById('dk-form').innerHTML = deadlineFormHtml(assignment().caseId, itemId); document.getElementById('d-label').focus(); },
    recEntry(caseId) { document.getElementById('dk-form').innerHTML = entryFormHtml(caseId, ''); },
    recDeadline(caseId) { document.getElementById('dk-form').innerHTML = deadlineFormHtml(caseId, ''); document.getElementById('dk-form').scrollIntoView({ behavior: 'smooth' }); },
    saveEntry(e, caseId, itemId) {
        e.preventDefault();
        const c = caseOf(caseId), v = (id) => document.getElementById(id).value;
        if (itemId) c.entries = c.entries.filter(x => x.itemId !== itemId);   // one entry per item
        const seq = c.entries.length ? Math.max(...c.entries.map(x => x.seq)) + 1 : 1;
        c.entries.push({ seq, date: v('f-date'), type: v('f-type'), filedBy: v('f-by'), desc: v('f-desc').trim(), itemId: itemId || undefined, mine: true });
        save(); render();
    },
    saveDeadline(e, caseId, itemId) {
        e.preventDefault();
        const v = (id) => document.getElementById(id).value;
        const reminders = [...document.querySelectorAll('.dk-rem input:checked')].map(i => Number(i.value));
        S.deadlines.push({ id: uid(), caseId, itemId: itemId || null, label: v('d-label').trim(), due: v('d-due'), time: v('d-time'), rule: v('d-rule'), responsible: v('d-resp'), reminders, note: v('d-note').trim(), status: 'open', verified: false, createdAt: new Date().toISOString() });
        save(); render();
    },
    delEntry(caseId, seq) { const c = caseOf(caseId); c.entries = c.entries.filter(x => x.seq !== seq); save(); render(); },
    delDeadline(id) { S.deadlines = S.deadlines.filter(d => d.id !== id); save(); render(); },
    flag(id, k, v) { const d = S.deadlines.find(x => x.id === id); if (d) { d[k] = v; save(); render(); } },
    toggleDone(id) { S.processed[id] = !S.processed[id]; save(); render(); },
    setStatus(id, v) { caseOf(id).status = v; save(); render(); },
    check,
    reset() {
        const a = assignment();
        if (!confirm(`Start "${a.title}" over? Your docket entries and deadlines for it are removed.`)) return;
        const c = caseOf(a.caseId), orig = DK_CASES.find(x => x.id === a.caseId);
        c.entries = clone(orig.entries);
        S.deadlines = S.deadlines.filter(d => d.caseId !== a.caseId);
        a.items.forEach(i => delete S.processed[i.id]); delete S.results[a.id]; delete S.calcUnlocked[a.id]; S.item = null;
        save(); render();
    },
    newCaseForm() {
        document.getElementById('dk-newcase').innerHTML = `<form class="dk-form" onsubmit="DK.newCase(event)"><h4>New Case</h4>
            <label>Case number<input id="n-no" required placeholder="e.g. 2:26-cv-01999-PI"></label><label>Caption<input id="n-cap" required placeholder="Plaintiff v. Defendant"></label>
            <label>Court<input id="n-court" value="U.S. District Court — District of Metro State (Training)"></label><label>Case type<input id="n-type" placeholder="e.g. Civil — Personal Injury"></label>
            <label>Judge<input id="n-judge" placeholder="Hon. …"></label><label>Date filed<input id="n-filed" type="date" required></label>
            <label>Counting method<select id="n-method"><option value="frcp">Federal (FRCP 6)</option><option value="state">Training state rules</option></select></label>
            <div class="dk-acts"><button class="sim-btn primary" type="submit">Create Case</button></div></form>`;
    },
    newCase(e) {
        e.preventDefault(); const v = (id) => document.getElementById(id).value.trim();
        const id = 'u' + uid();
        S.cases.push({ id, caseNumber: v('n-no'), caption: v('n-cap'), court: v('n-court'), type: v('n-type'), nature: v('n-type'), judge: v('n-judge'), filed: v('n-filed'), status: 'Active', method: v('n-method'), parties: [], entries: [], custom: true });
        S.caseId = id; save(); render();
    },
    calc(k, v) { S.calc = Object.assign(S.calc || { rule: 'answer', trigger: '', service: 'personal', method: 'frcp', days: '' }, { [k]: v }); if (k === 'rule') S.calc.days = ''; save(); renderCalc(); },
    csv(caseId) {
        const c = caseOf(caseId), q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
        const lines = [['Date Filed', '#', 'Type', 'Category', 'Filed By', 'Docket Text'].map(q).join(',')].concat(c.entries.slice().sort((a, b) => a.seq - b.seq).map(e => [LR.short(e.date), e.seq, e.type, cat(e.type), e.filedBy, e.desc].map(q).join(',')));
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = `docket-${c.caseNumber.replace(/[^\w-]/g, '_')}.csv`; a.click();
    },
    icsAll() {
        const dt = (d, t) => d.replace(/-/g, '') + (t ? 'T' + t.replace(':', '') + '00' : '');
        const ev = S.deadlines.map(d => { const c = caseOf(d.caseId) || {}; return ['BEGIN:VEVENT', `UID:${d.id}@lsh-docket`, d.time ? `DTSTART:${dt(d.due, d.time)}` : `DTSTART;VALUE=DATE:${dt(d.due)}`, `SUMMARY:${(d.label + ' — ' + (c.caseNumber || '')).replace(/[,;]/g, ' ')}`, `DESCRIPTION:Responsible: ${d.responsible || 'unassigned'}`, ...d.reminders.map(n => `BEGIN:VALARM\nTRIGGER:-P${n}D\nACTION:DISPLAY\nDESCRIPTION:Reminder\nEND:VALARM`), 'END:VEVENT'].join('\n'); });
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LSH Training//Docket//EN', ...ev, 'END:VCALENDAR'].join('\n')], { type: 'text/calendar' })); a.download = 'lsh-firm-deadlines.ics'; a.click();
    }
};

document.getElementById('topbar').innerHTML = Sim.topbar('docket');
render();
})();

/* The firm's CALENDAR MANAGEMENT MOCK CALL scorecard: the sheet on the Foundational Training's Day 6, the same one the CMS
   Call Simulator grades the Calendar Management Mock Calls on. Each metric is rated 0 to 5 with the trainer's feedback; the
   weighted average is out of 5, and as a percentage.
   A trainer scores a trainee's calendar with it in the Google Calendar Simulator (gcal.js, ?trainee=<username>: their calendar,
   read only). The trainee sees it there and on the Calendaring Simulators page (calsim.html). The server keeps it in the
   trainee's /api/calsim record (scorecards: { <track>: [card, …] }) and checks the metrics against its own list
   (functions/api/calsim.js SCORECARD_METRICS, which the checks keep the same as this one).
   One scorecard, two scorers: the simulator's automated check (Check my calendar, gcal.js) marks each of its items under one of
   these metrics (item.m), so fromCheck() turns a check into the same 7 rows. The calendar shows four of them (AUTO); the other
   three are heard on the call and only the trainer scores them. sheetHTML / formHTML show both side by side in one sheet:
   🤖 the calendar check, 👤 the trainer, and the score that counts (the trainer's where they gave one, else the check's). */
(function () {
    'use strict';
    const TITLE = 'CALENDAR MANAGEMENT MOCK CALL';
    const METRICS = [
        { name: 'Professional Introduction & Call Control', weight: 1, about: 'Opens with the firm’s name and their own name and offers to help; calm, warm and confident; leads the call one question at a time and keeps it on track.' },
        { name: 'Client Comprehension & Flow Control', weight: 1, about: 'Understands what the caller needs (which appointment, why, their limits on days and times); asks clarifying questions and sums the request up; moves the call in order without dead air.' },
        { name: 'Information Verification & Accuracy', weight: 1, about: 'Verifies the caller before discussing any appointment; every day, date, time, time zone, place and name matches the file exactly.' },
        { name: 'Slot Identification & Scheduling Rule Compliance', weight: 1, about: 'Finds only real open slots and follows the attorney’s scheduling rules: no double-booking, the buffers, office hours, Eastern time; never moves a court date or deposition on their own.' },
        { name: 'Alternative Time Offering', weight: 1, about: 'When the requested time doesn’t work, offers specific real alternatives (day, date, time and time zone) and checks them against the caller’s limits.' },
        { name: 'Calendar Creation & Attorney Reminder Setup', weight: 1, about: 'The calendar entry: the right calendar, a specific title, the day, date, time, time zone, place or video link, who attends, the description, and the reminder for the attorney.' },
        { name: 'Notes, Recap & Call Closing', weight: 1, about: 'Reads the booking back and gets the caller’s OK; closes politely with what happens next; the notes are accurate and complete.' }
    ];
    // The metrics the calendar itself shows (the automated check scores them): comprehension of the caller's limits, verification
    // (time zone, the description's details), the slot and the attorney's rules, the calendar entry and its reminder.
    const AUTO = [1, 2, 3, 5];
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const clamp = (v) => Math.max(0, Math.min(5, Math.round(Number(v) || 0)));
    // { average (out of 5, one decimal), pct } from rows of { score, weight }
    function average(rows) {
        const w = rows.reduce((a, r, i) => a + (Number((METRICS[i] || {}).weight) || Number(r.weight) || 1), 0);
        const avg = w ? rows.reduce((a, r, i) => a + (Number((METRICS[i] || {}).weight) || Number(r.weight) || 1) * clamp(r.score), 0) / w : 0;
        return { average: Math.round(avg * 10) / 10, pct: Math.round(avg / 5 * 100) };
    }
    const n1 = (v) => String(Math.round((Number(v) || 0) * 10) / 10);
    // A check (gcal.js checkOpen / checkPlan, its results with tagged items) as the 7 rows: { score (0-5, one decimal) | null, feedback }.
    // A result whose items carry no metric (a booking not on the calendar) counts against every metric the check scores.
    // Changing the attorney's appointments no one asked about (penalty, in points of 100) comes off the slot & rules metric.
    function fromCheck(r) {
        if (!r || !Array.isArray(r.results) || r.activity) return null;
        const w = METRICS.map(() => 0), got = METRICS.map(() => 0), miss = METRICS.map(() => []);
        r.results.forEach((x) => {
            const items = Array.isArray(x.items) ? x.items : [], tagged = items.filter(i => i && i.m != null && METRICS[i.m]);
            if (!tagged.length) { if (x.max) AUTO.forEach(k => { w[k] += x.max / AUTO.length; got[k] += (x.pts || 0) / AUTO.length; if (items.some(i => !i.ok)) miss[k].push(`${x.head}: ${(items.find(i => !i.ok) || {}).t || 'missed'}`); }); return; }
            tagged.forEach(i => { w[i.m] += Number(i.w) || 0; got[i.m] += Number(i.got) || 0; if (!i.ok) miss[i.m].push(`${x.head}: ${i.t}`); });
        });
        if (r.penalty) { const k = 3; got[k] -= (r.penalty / 100) * (w[k] || 1) * 4; miss[k].push(`Changed without a request: ${(r.extra || []).join(', ')}`); }
        return METRICS.map((m, k) => {
            if (!AUTO.includes(k) || !w[k]) return { score: null, feedback: '' };
            const sc = Math.max(0, Math.min(5, 5 * got[k] / w[k]));
            const fb = miss[k].length ? miss[k].slice(0, 4).join(' · ') + (miss[k].length > 4 ? ` · and ${miss[k].length - 4} more` : '') : 'Right on every appointment.';
            return { score: Math.round(sc * 10) / 10, feedback: fb };
        });
    }
    // The score that counts for each metric: the trainer's where they gave one, else the calendar check's; the average of those.
    function combined(card, auto) {
        const rows = METRICS.map((m, i) => {
            const t = card && card.rows && card.rows[i] && card.rows[i].score != null && card.rows[i].score !== '' ? clamp(card.rows[i].score) : null;
            const a = auto && auto[i] && auto[i].score != null ? Number(auto[i].score) : null;
            return t != null ? t : a;
        });
        const have = rows.filter(v => v != null);
        if (!have.length) return null;
        const avg = have.reduce((x, v) => x + v, 0) / have.length;
        return { rows, average: Math.round(avg * 10) / 10, pct: Math.round(avg / 5 * 100), scored: have.length };
    }
    const autoCell = (a) => a && a.score != null ? n1(a.score) : '<span title="Heard on the call: your trainer scores it">–</span>';
    const STYLE = `.csc{width:100%;border-collapse:collapse;table-layout:fixed;font-family:Cambria,Georgia,'Times New Roman',serif;font-size:13px;font-weight:700;color:#4f6228}
        .csc th{background:#63a537;color:#fff;text-align:left;padding:6px 8px;border:1px solid #3f6f22}.csc th:nth-child(1){width:40%}.csc th:nth-child(2),.csc td.n{text-align:center;width:58px}
        .csc td{padding:6px 8px;border:1px solid #9cb98a;vertical-align:top;line-height:1.35}.csc tbody tr:nth-child(odd){background:#eaf4d7}.csc tbody tr:nth-child(even){background:#fff}
        .csc td.n{color:#1f2d10}.csc td.fb{font-family:inherit;font-weight:500;font-size:12.5px;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
        .csc tr.avg td{background:#eaf4d7;border-top:2px solid #63a537}
        .csc select{width:48px;font:inherit;font-weight:800;padding:2px;border:1px solid #9cb98a;border-radius:4px;background:#fff;color:#1f2d10}
        .csc textarea::placeholder{color:#a3aab5;font-style:italic}.csc textarea{width:100%;box-sizing:border-box;font:500 12.5px/1.35 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#334155;border:1px solid #cbd5e1;border-radius:4px;padding:4px 6px;resize:vertical;min-height:36px}
        .csc .csc-auto{margin-top:3px;font:500 12px/1.35 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#5f6368}.csc-one th:nth-child(1){width:30%}.csc-one th:nth-child(3),.csc-one th:nth-child(4){text-align:center;width:58px}.csc-has-auto th:nth-child(3){text-align:center;width:58px}
        .csc-cap{font-size:12px;font-weight:700;color:#0b1633;margin:0 0 6px}.csc-wrap{overflow-x:auto}`;
    function style() { if (document.getElementById('csc-style')) return; const s = document.createElement('style'); s.id = 'csc-style'; s.textContent = STYLE; document.head.appendChild(s); }
    // A saved scorecard, laid out as the trainers' sheet. card: { rows: [{ metric, score, feedback }], average, pct, by, at }
    // With `auto` (fromCheck of the trainee's calendar check) it is the one sheet of both scorers: 🤖 the calendar check, 👤 the
    // trainer, the score that counts and the feedback (the trainer's, and under it what the check found). Either may be missing.
    function sheetHTML(card, caption, auto) {
        const hasCard = !!(card && Array.isArray(card.rows) && card.rows.length), hasAuto = Array.isArray(auto) && auto.length === METRICS.length;
        if (!hasCard && !hasAuto) return '';
        style();
        if (!hasAuto) return `<div class="csc-wrap">${caption ? `<div class="csc-cap">${caption}</div>` : ''}<table class="csc"><thead><tr><th>${esc(card.title || TITLE)}</th><th>Score</th><th>FEEDBACK</th></tr></thead><tbody>
            ${card.rows.map((r, i) => `<tr><td>${esc(r.metric || (METRICS[i] || {}).name || '')}</td><td class="n">${clamp(r.score)}</td><td class="fb">${esc(r.feedback || '')}</td></tr>`).join('')}
            <tr class="avg"><td>WEIGHTED AVERAGE</td><td class="n">${n1(card.average)}</td><td class="fb">out of 5 · ${Math.round(Number(card.pct) || 0)}%</td></tr></tbody></table></div>`;
        const c = combined(hasCard ? card : null, auto) || { rows: METRICS.map(() => null), average: 0, pct: 0, scored: 0 }, autoAvg = combined(null, auto);
        return `<div class="csc-wrap">${caption ? `<div class="csc-cap">${caption}</div>` : ''}<table class="csc csc-one"><thead><tr><th>${esc((hasCard && card.title) || TITLE)}</th><th title="The automated check of the calendar (Check my calendar)">🤖<span class="csc-lbl"> Calendar</span></th><th title="The trainer's score on the mock call">👤<span class="csc-lbl"> Trainer</span></th><th>Score</th><th>FEEDBACK</th></tr></thead><tbody>
            ${METRICS.map((m, i) => { const r = hasCard ? card.rows[i] || {} : {}, t = hasCard && r.score != null && r.score !== '';
                const fb = `${t && r.feedback ? esc(r.feedback) : ''}${auto[i] && auto[i].score != null ? `<div class="csc-auto">${t && r.feedback ? '🤖 ' : ''}${esc(auto[i].feedback)}</div>` : !t ? '<div class="csc-auto">Scored by your trainer on the mock call.</div>' : ''}`;
                return `<tr><td title="${esc(m.about)}">${esc(r.metric || m.name)}</td><td class="n">${autoCell(auto[i])}</td><td class="n">${t ? clamp(r.score) : '–'}</td><td class="n">${c.rows[i] != null ? n1(c.rows[i]) : '–'}</td>
                <td class="fb">${fb}</td></tr>`; }).join('')}
            <tr class="avg"><td>WEIGHTED AVERAGE</td><td class="n">${autoAvg ? n1(autoAvg.average) : '–'}</td><td class="n">${hasCard ? n1(card.average) : '–'}</td><td class="n">${n1(c.average)}</td><td class="fb">out of 5 · ${c.pct}%${c.scored < METRICS.length ? ` · ${c.scored} of ${METRICS.length} metrics scored so far` : ''}</td></tr></tbody></table></div>`;
    }
    // The sheet to fill in (a trainer), starting from `card` (their last one) if there is one. read() gives the rows back.
    // With `auto` (fromCheck of the calendar check), the 🤖 column sits beside the trainer's score, its findings under the feedback,
    // and 🤖 Fill from the calendar check puts its scores (rounded) in the metrics still blank.
    function formHTML(card, auto) {
        style();
        const rows = METRICS.map((m, i) => (card && card.rows && card.rows[i]) || { score: '', feedback: '' });
        const avg = card ? card : null, A = Array.isArray(auto) && auto.length === METRICS.length ? auto : null;
        FORM_AUTO = A;
        return `<div class="csc-wrap">${A ? `<div style="margin:0 0 6px"><button type="button" class="pill" data-csc-fill onclick="CalScorecard.fillFromCheck()" title="Put the calendar check's score in each metric you haven't scored yet">🤖 Fill from the calendar check</button></div>` : ''}<table class="csc csc-form${A ? ' csc-has-auto' : ''}"><thead><tr><th>${esc(TITLE)}</th>${A ? '<th title="The automated check of the calendar">🤖 Calendar</th>' : ''}<th>Score</th><th>FEEDBACK</th></tr></thead><tbody>
            ${METRICS.map((m, i) => `<tr><td title="${esc(m.about)}">${esc(m.name)}</td>${A ? `<td class="n">${autoCell(A[i])}</td>` : ''}<td class="n"><select data-csc="${i}" aria-label="${esc(m.name)}: score" onchange="CalScorecard.liveAvg()"><option value="">–</option>${[0, 1, 2, 3, 4, 5].map(x => `<option value="${x}" ${rows[i].score !== '' && rows[i].score != null && Number(rows[i].score) === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
                <td class="fb"><textarea data-csf="${i}" maxlength="600" rows="2" aria-label="${esc(m.name)}: feedback" placeholder="${esc(m.about)}">${esc(rows[i].feedback || '')}</textarea>${A && A[i].score != null ? `<div class="csc-auto">🤖 ${esc(A[i].feedback)}</div>` : ''}</td></tr>`).join('')}
            <tr class="avg"><td>WEIGHTED AVERAGE</td>${A ? `<td class="n">${(() => { const c = combined(null, A); return c ? n1(c.average) : '–'; })()}</td>` : ''}<td class="n" id="csc-avg">${avg ? n1(avg.average) : '–'}</td><td class="fb" id="csc-pct">${avg ? `out of 5 · ${Math.round(Number(avg.pct) || 0)}%` : 'out of 5'}</td></tr></tbody></table></div>`;
    }
    // The rows filled in: [{ score, feedback }], or an error naming the first metric without a score.
    function read() {
        const rows = METRICS.map((m, i) => {
            const s = document.querySelector(`select[data-csc="${i}"]`), f = document.querySelector(`textarea[data-csf="${i}"]`);
            return { score: s && s.value !== '' ? Number(s.value) : null, feedback: f ? String(f.value || '').trim().slice(0, 600) : '' };
        });
        const miss = rows.findIndex(r => r.score == null);
        return miss >= 0 ? { error: `Give “${METRICS[miss].name}” a score from 0 to 5.` } : { rows };
    }
    function liveAvg() {
        const sel = METRICS.map((m, i) => document.querySelector(`select[data-csc="${i}"]`)), set = sel.filter(s => s && s.value !== '');
        const a = document.getElementById('csc-avg'), p = document.getElementById('csc-pct');
        if (set.length < METRICS.length) { if (a) a.textContent = '–'; if (p) p.textContent = `out of 5 · ${set.length} of ${METRICS.length} scored`; return; }
        const r = average(sel.map(s => ({ score: s.value })));
        if (a) a.textContent = n1(r.average); if (p) p.textContent = `out of 5 · ${r.pct}%`;
    }
    let FORM_AUTO = null;
    function fillFromCheck() {
        if (!FORM_AUTO) return 0;
        let n = 0;
        FORM_AUTO.forEach((a, i) => { const s = document.querySelector(`select[data-csc="${i}"]`); if (s && s.value === '' && a && a.score != null) { s.value = String(clamp(a.score)); n++; } });
        liveAvg();
        return n;
    }
    const API = { TITLE, METRICS, AUTO, average, fromCheck, combined, sheetHTML, formHTML, read, liveAvg, fillFromCheck, esc };
    if (typeof window !== 'undefined') window.CalScorecard = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();

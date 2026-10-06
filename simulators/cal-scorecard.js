/* The firm's CALENDAR MANAGEMENT MOCK CALL scorecard: the sheet on the Foundational Training's Day 6, the same one the CMS
   Call Simulator grades the Calendar Management Mock Calls on. Each metric is rated 0 to 5 with the trainer's feedback; the
   weighted average is out of 5, and as a percentage.
   A trainer scores a trainee's calendar with it in the Google Calendar Simulator (gcal.js, ?trainee=<username>: their calendar,
   read only). The trainee sees it there and on the Calendaring Simulators page (calsim.html). The server keeps it in the
   trainee's /api/calsim record (scorecards: { <track>: [card, …] }) and checks the metrics against its own list
   (functions/api/calsim.js SCORECARD_METRICS, which the checks keep the same as this one). */
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
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const clamp = (v) => Math.max(0, Math.min(5, Math.round(Number(v) || 0)));
    // { average (out of 5, one decimal), pct } from rows of { score, weight }
    function average(rows) {
        const w = rows.reduce((a, r, i) => a + (Number((METRICS[i] || {}).weight) || Number(r.weight) || 1), 0);
        const avg = w ? rows.reduce((a, r, i) => a + (Number((METRICS[i] || {}).weight) || Number(r.weight) || 1) * clamp(r.score), 0) / w : 0;
        return { average: Math.round(avg * 10) / 10, pct: Math.round(avg / 5 * 100) };
    }
    const n1 = (v) => String(Math.round((Number(v) || 0) * 10) / 10);
    const STYLE = `.csc{width:100%;border-collapse:collapse;table-layout:fixed;font-family:Cambria,Georgia,'Times New Roman',serif;font-size:13px;font-weight:700;color:#4f6228}
        .csc th{background:#63a537;color:#fff;text-align:left;padding:6px 8px;border:1px solid #3f6f22}.csc th:nth-child(1){width:40%}.csc th:nth-child(2),.csc td.n{text-align:center;width:58px}
        .csc td{padding:6px 8px;border:1px solid #9cb98a;vertical-align:top;line-height:1.35}.csc tbody tr:nth-child(odd){background:#eaf4d7}.csc tbody tr:nth-child(even){background:#fff}
        .csc td.n{color:#1f2d10}.csc td.fb{font-family:inherit;font-weight:500;font-size:12.5px;color:#334155;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
        .csc tr.avg td{background:#eaf4d7;border-top:2px solid #63a537}
        .csc select{width:48px;font:inherit;font-weight:800;padding:2px;border:1px solid #9cb98a;border-radius:4px;background:#fff;color:#1f2d10}
        .csc textarea::placeholder{color:#a3aab5;font-style:italic}.csc textarea{width:100%;box-sizing:border-box;font:500 12.5px/1.35 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#334155;border:1px solid #cbd5e1;border-radius:4px;padding:4px 6px;resize:vertical;min-height:36px}
        .csc-cap{font-size:12px;font-weight:700;color:#0b1633;margin:0 0 6px}.csc-wrap{overflow-x:auto}`;
    function style() { if (document.getElementById('csc-style')) return; const s = document.createElement('style'); s.id = 'csc-style'; s.textContent = STYLE; document.head.appendChild(s); }
    // A saved scorecard, laid out as the trainers' sheet. card: { rows: [{ metric, score, feedback }], average, pct, by, at }
    function sheetHTML(card, caption) {
        if (!card || !Array.isArray(card.rows) || !card.rows.length) return '';
        style();
        return `<div class="csc-wrap">${caption ? `<div class="csc-cap">${caption}</div>` : ''}<table class="csc"><thead><tr><th>${esc(card.title || TITLE)}</th><th>Score</th><th>FEEDBACK</th></tr></thead><tbody>
            ${card.rows.map((r, i) => `<tr><td>${esc(r.metric || (METRICS[i] || {}).name || '')}</td><td class="n">${clamp(r.score)}</td><td class="fb">${esc(r.feedback || '')}</td></tr>`).join('')}
            <tr class="avg"><td>WEIGHTED AVERAGE</td><td class="n">${n1(card.average)}</td><td class="fb">out of 5 · ${Math.round(Number(card.pct) || 0)}%</td></tr></tbody></table></div>`;
    }
    // The sheet to fill in (a trainer), starting from `card` (their last one) if there is one. read() gives the rows back.
    function formHTML(card) {
        style();
        const rows = METRICS.map((m, i) => (card && card.rows && card.rows[i]) || { score: '', feedback: '' });
        const avg = card ? card : null;
        return `<div class="csc-wrap"><table class="csc csc-form"><thead><tr><th>${esc(TITLE)}</th><th>Score</th><th>FEEDBACK</th></tr></thead><tbody>
            ${METRICS.map((m, i) => `<tr><td title="${esc(m.about)}">${esc(m.name)}</td><td class="n"><select data-csc="${i}" aria-label="${esc(m.name)}: score" onchange="CalScorecard.liveAvg()"><option value="">–</option>${[0, 1, 2, 3, 4, 5].map(x => `<option value="${x}" ${rows[i].score !== '' && rows[i].score != null && Number(rows[i].score) === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
                <td class="fb"><textarea data-csf="${i}" maxlength="600" rows="2" aria-label="${esc(m.name)}: feedback" placeholder="${esc(m.about)}">${esc(rows[i].feedback || '')}</textarea></td></tr>`).join('')}
            <tr class="avg"><td>WEIGHTED AVERAGE</td><td class="n" id="csc-avg">${avg ? n1(avg.average) : '–'}</td><td class="fb" id="csc-pct">${avg ? `out of 5 · ${Math.round(Number(avg.pct) || 0)}%` : 'out of 5'}</td></tr></tbody></table></div>`;
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
    const API = { TITLE, METRICS, average, sheetHTML, formHTML, read, liveAvg, esc };
    if (typeof window !== 'undefined') window.CalScorecard = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();

/* The firm's EMAIL REPLY scorecard: the five metrics every practice reply is graded on, whatever the scenario.
   The per-scenario goals in /simulators/reply-packs/emails.json stay — they are the evidence the AI cites under each
   metric — but the score itself comes from these five, so a trainee's Email Replies scores are comparable across
   scenarios and programs. Each metric is 0 to 5 with a line of feedback; the weighted average is out of 5 and as a
   percentage (the percentage is the score saved to the trainee's record).
   Used by the Email Replies simulator (email-replies.html): it asks the AI for exactly these rows, works the score out
   here (never from a number the AI invents), and renders the table in the debrief. */
(function () {
    'use strict';
    const TITLE = 'EMAIL REPLY';
    const METRICS = [
        { key: 'urgency', name: 'Urgency & Risk Handled First', weight: 2, about: 'Finds the item in the email with a clock or a risk on it (a collections letter, a deadline, a demand, a threat to the file) and deals with it in the opening lines, with the instruction the reader needs.' },
        { key: 'answers', name: 'Answers What Was Asked', weight: 2, about: 'Every question in the incoming email is answered, or it is said plainly why it cannot be answered yet and who will answer it.' },
        { key: 'accuracy', name: 'Accuracy & Staying In Role', weight: 2, about: 'Facts, figures and dates match the file. No legal advice, no case valuation, no guarantee, no confidential information, nothing promised that is not theirs to promise.' },
        { key: 'nextstep', name: 'Clear Next Step With A Date', weight: 2, about: 'Says what happens next, who does it and by when — a named day, not “as soon as possible”; asks for anything needed from the reader in one concrete step.' },
        { key: 'tone', name: 'Tone, Structure & Mechanics', weight: 1, about: 'Warm, calm and professional for this reader; greeting and sign-off; short paragraphs in a sensible order; grammar and spelling that do not change the meaning.' }
    ];
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const clamp = (v) => Math.max(0, Math.min(5, Math.round(Number(v) || 0)));

    // The AI answers with rows in any order (or misses one): line them up with METRICS by key, then by name. Position is
    // the last resort, and only when no row names itself at all — otherwise one labelled row would fill every gap.
    function normalize(rows) {
        const got = Array.isArray(rows) ? rows : [];
        const labelled = got.some(x => x && (x.key || x.name));
        return METRICS.map((m, i) => {
            const r = got.find(x => x && String(x.key || '').toLowerCase() === m.key)
                || got.find(x => x && String(x.name || '').toLowerCase() === m.name.toLowerCase())
                || (labelled ? null : got[i]) || {};
            return { key: m.key, name: m.name, weight: m.weight, score: clamp(r.score), feedback: String(r.feedback || r.note || '') };
        });
    }
    // { average (out of 5, one decimal), pct } from normalized rows
    function average(rows) {
        const r = normalize(rows);
        const w = r.reduce((a, x) => a + x.weight, 0);
        const avg = w ? r.reduce((a, x) => a + x.weight * x.score, 0) / w : 0;
        return { average: Math.round(avg * 10) / 10, pct: Math.round(avg / 5 * 100) };
    }
    const n1 = (v) => String(Math.round((Number(v) || 0) * 10) / 10);
    const STYLE = `.esc-t{width:100%;border-collapse:collapse;table-layout:fixed;font-size:13.5px}
        .esc-t th{background:#0b1633;color:#fff;text-align:left;padding:7px 9px;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
        .esc-t th:nth-child(1){width:34%}.esc-t th:nth-child(2){width:62px;text-align:center}
        .esc-t td{border-bottom:1px solid #e2e8f0;padding:8px 9px;vertical-align:top;color:#334155}
        .esc-t td.m{font-weight:700;color:#0b1633}.esc-t td.m small{display:block;font-weight:500;color:#64748b;font-size:11.5px;margin-top:2px}
        .esc-t td.n{text-align:center;font-weight:900;font-size:16px}
        .esc-t td.n.hi{color:#15803d}.esc-t td.n.mid{color:#b45309}.esc-t td.n.lo{color:#b91c1c}
        .esc-t tr.tot td{border-top:2px solid #0b1633;border-bottom:0;font-weight:900;color:#0b1633;background:#f8fafc}
        .esc-wrap{overflow-x:auto;margin-top:8px}`;
    let styled = false;
    function injectStyle() {
        if (styled || typeof document === 'undefined') return;
        const el = document.createElement('style'); el.textContent = STYLE; document.head.appendChild(el); styled = true;
    }
    // Read-only table of the five metrics with their feedback and the weighted total.
    function html(rows) {
        injectStyle();
        const r = normalize(rows), t = average(r);
        const band = (s) => s >= 4 ? 'hi' : s >= 3 ? 'mid' : 'lo';
        return `<div class="esc-wrap"><table class="esc-t"><thead><tr><th>${esc(TITLE)} metric</th><th>/5</th><th>Feedback</th></tr></thead><tbody>
            ${r.map(x => `<tr><td class="m">${esc(x.name)}<small>${esc(x.about || (METRICS.find(m => m.key === x.key) || {}).about || '')}</small></td>
                <td class="n ${band(x.score)}">${x.score}</td><td>${esc(x.feedback)}</td></tr>`).join('')}
            <tr class="tot"><td>Weighted average</td><td class="n">${n1(t.average)}</td><td>${t.pct}%</td></tr>
        </tbody></table></div>`;
    }
    // The block of the AI prompt that asks for exactly these rows.
    function promptBlock() {
        return `GRADE THE REPLY ON THESE FIVE METRICS, AND ONLY THESE FIVE (0 to 5 each; 5 = nothing to add, 3 = acceptable, 0 = absent or wrong):
${METRICS.map(m => `- ${m.key} — ${m.name} (weight ${m.weight}): ${m.about}`).join('\n')}`;
    }
    window.EmailScorecard = { TITLE, METRICS, normalize, average, html, promptBlock };
})();

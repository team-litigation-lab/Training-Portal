/* LSH Training Portal — the final feedback report of a calendar evaluation (gcal_reviews, functions/api/gcal-reviews.js).
   Shared by the trainee's My Evaluations page (simulators/my-evaluations.html) and the Google Calendar Simulator's My evaluations panel.
   EvalReport.html(r)  the report as HTML (overview, done correctly, needs improvement, missed, the trainer's feedback)
   EvalReport.pdf(r, label, onError)  the same as a PDF download (needs jsPDF on the page)
   `r` is a finalized review as the API gives it to its trainee: { submittedAt, checkScore, finalizedAt, finalizedBy, name, batch, ai, trainer, calendar }. */
const EvalReport = (function () {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const when = (t) => { try { return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return t || ''; } };
    const list = (items, cls) => (items || []).length ? `<ul class="ev-l ${cls}">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="ev-none">None.</p>';
    const text = (s) => esc(s).replace(/\n/g, '<br>');
    function html(r) {
        const ai = r.ai || {}, t = r.trainer || {};
        return `<div class="ev-rep">
        <div class="ev-meta">${esc(when(r.submittedAt))} · automated check ${r.checkScore == null ? '—' : r.checkScore + '%'}${t.score != null ? ` · <b>trainer's score ${esc(t.score)}/100</b>` : ''}<br>Sent by ${esc(r.finalizedBy || 'your trainer')}, ${esc(when(r.finalizedAt))}</div>
        ${ai.summary ? `<p class="ev-sum">${esc(ai.summary)}</p>` : ''}
        ${ai.error ? `<p class="ev-none">The AI review couldn't be written for this one; your trainer's feedback is below.</p>` : `
        <h4>✅ Done correctly</h4>${list(ai.correct, 'ok')}
        <h4>🛠 Needs improvement</h4>${list(ai.improve, 'mid')}
        <h4>⚠️ Requirements missed</h4>${list(ai.missed, 'no')}`}
        <h4>👤 Your trainer's feedback</h4>${t.notes ? `<p class="ev-notes">${text(t.notes)}</p>` : ''}${(t.points || []).length ? list(t.points, 'tr') : (t.notes ? '' : '<p class="ev-none">No written comments.</p>')}
    </div>`;
    }
    function pdf(r, label, onError) {
        const J = window.jspdf && window.jspdf.jsPDF;
        if (!J) { (onError || alert)('The PDF maker didn\'t load: reload the page and try again.'); return; }
        const doc = new J({ unit: 'pt', format: 'letter' }), W = 612, M = 54; let y = 60;
        const ai = r.ai || {}, t = r.trainer || {};
        // jsPDF's standard fonts draw Latin-1: accented letters stay; typographic quotes and dashes are straightened; a thin or non-breaking space (the times' AM/PM) is a space; the rest can't be drawn
        const ascii = (x) => String(x == null ? '' : x).replace(/[\u00a0\u2009\u202f]/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7e\xa1-\xff\n]/g, '');
        const page = (need) => { if (y + need > 740) { doc.addPage(); y = 60; } };
        const line = (s, size, bold, color) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...(color || [31, 31, 31]));
            doc.splitTextToSize(ascii(s), W - 2 * M).forEach(l => { page(size + 4); doc.text(l, M, y); y += size + 4; }); };
        const bullets = (items) => { if (!(items || []).length) { line('None.', 10.5, false, [112, 117, 122]); return; }
            items.forEach(x => { doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); const ls = doc.splitTextToSize(ascii(x), W - 2 * M - 14); page(ls.length * 14.5); doc.setTextColor(31, 31, 31); doc.text('-', M, y); ls.forEach(l => { doc.text(l, M + 14, y); y += 14.5; }); y += 2; }); };
        const h = (s) => { y += 8; page(30); line(s, 13, true, [11, 87, 208]); y += 2; };
        line('LSH Training Portal - Calendar Evaluation', 18, true, [20, 33, 61]);
        line(`${label || 'Standard Training'} - Google Calendar Simulator`, 11, false, [68, 71, 70]); y += 6;
        line(`Trainee: ${r.name || ''}${r.batch ? ' (' + r.batch + ')' : ''}`, 10.5);
        line(`Submitted: ${when(r.submittedAt)}   Sent: ${when(r.finalizedAt)} by ${r.finalizedBy || 'the trainer'}`, 10.5);
        line(`Automated check: ${r.checkScore == null ? '-' : r.checkScore + '%'}${t.score != null ? `   Trainer's score: ${t.score}/100` : ''}`, 10.5);
        if (ai.summary) { h('Summary'); line(ai.summary, 10.5); }
        if (!ai.error) { h('Done correctly'); bullets(ai.correct); h('Needs improvement'); bullets(ai.improve); h('Requirements missed'); bullets(ai.missed); }
        h("Trainer's feedback"); if (t.notes) line(t.notes, 10.5); bullets(t.points || []);
        const c = r.calendar && r.calendar.automatedCheck;
        if (c && (c.results || []).length) { h('Automated check, request by request'); c.results.forEach(x => { line(`${x.request}  (${x.points})${x.when ? ' - ' + x.when : ''}`, 10.5, true); bullets((x.missed || []).length ? x.missed.map(m => 'Missed: ' + m) : ['Everything checked was right.']); }); }
        doc.save(`Calendar_Evaluation_${ascii(r.name || 'trainee').replace(/\s+/g, '_')}_${String(r.finalizedAt || r.submittedAt).slice(0, 10)}.pdf`);
    }
    // The styles of the report (the same on every page that shows it)
    const css = `.ev-rep{font-size:14px;line-height:1.5;color:#1f1f1f} .ev-meta{font-size:12.5px;color:#64748b;margin-bottom:8px} .ev-sum{margin:6px 0 10px;font-size:14.5px}
        .ev-rep h4{margin:14px 0 4px;font-size:14px} .ev-l{margin:0;padding-left:18px} .ev-l li{margin:4px 0} .ev-l.ok li::marker{color:#188038} .ev-l.mid li::marker{color:#e37400} .ev-l.no li::marker{color:#d93025}
        .ev-none{color:#64748b;font-size:13px;margin:2px 0} .ev-notes{margin:4px 0 8px;white-space:normal}`;
    return { esc, when, html, pdf, css };
})();

/* LSH Training Portal — 👥 Your trainees' calendars (trainers): everyone who has a calendar saved on a Google Calendar Simulator, with
   👁 View & score on each track: their calendar in the Google Calendar look, read only, with the automated check and the CALENDAR MANAGEMENT
   MOCK CALL scorecard (gcal.html?trainee=<username>), and the last scorecard given.
   On the Trainee Evaluations page (gcal-review.html); the Calendaring Simulators page (calsim.html) points trainers there.
     TraineesCalendars.load(box, { extra })   draws it into the element (or selector) `box`.
        extra(person, trackId) → HTML added to a trainee's cell for that track (the Trainee Evaluations page adds the submission and its review there)
     TraineesCalendars.repaint()               draws the rows again (after `extra` has new things to show), keeping the search */
const TraineesCalendars = (function () {
    const TRACKS = [{ id: 'standard', icon: '🎓', title: 'Standard Training' }, { id: 'cm', icon: '⚖️', title: 'Litigation Week' }, { id: 'ea', icon: '🏢', title: 'Executive Week' }];
    const E = (t) => Sim.esc(t), go = (u, o) => (Sim.fetchRetry ? Sim.fetchRetry(u, o) : fetch(u, o));
    const S = { box: null, people: [], extra: null, q: '', err: '' };
    const card = (inner) => `<div class="card tc-card" style="padding:18px">${inner}</div>`;
    const head = '<h2 style="margin:0;font-size:20px;color:#0b1633">👥 Your trainees’ calendars</h2>';
    const href = (u, t) => '/simulators/gcal.html?' + (t === 'standard' ? '' : 'track=' + encodeURIComponent(t) + '&') + 'trainee=' + encodeURIComponent(u);
    const when = (t) => { const d = new Date(String(t || '').replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(t || '')) ? '' : 'Z')); return isNaN(d) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
    function cell(p, t) {
        const x = p.tracks[t.id], more = S.extra ? S.extra(p, t.id) : '';
        if (!x && !more) return '<td style="padding:8px;vertical-align:top;color:#94a3b8">—</td>';   // the cell carries its own padding: rows() patching a second style attribute onto it dropped the gray
        return `<td style="padding:8px;vertical-align:top">${x ? `<a class="sim-btn orange cs-view" style="text-decoration:none;padding:5px 10px;font-size:13px" href="${E(href(p.username, t.id))}">👁 View &amp; score</a>
            <div style="font-size:12px;color:#64748b;margin-top:3px">${x.at ? 'Saved ' + E(when(x.at)) : 'Not saved'}${x.card ? ` · 📋 <b style="color:#0b1633">${E(x.card.average)}/5 (${E(x.card.pct)}%)</b>` : ''}</div>` : ''}${more}</td>`;
    }
    function rows() {
        return S.people.map(p => `<tr data-find="${E((p.name + ' ' + p.batch + ' ' + p.username).toLowerCase())}" style="border-top:1px solid #e5e7eb"><td style="padding:8px"><b>${E(p.name)}</b><div style="font-size:12px;color:#64748b">${E(p.batch || 'No batch')}</div></td>${TRACKS.map(t => cell(p, t)).join('')}</tr>`).join('');
    }
    function filter() { const q = S.q.trim().toLowerCase(); S.box.querySelectorAll('.cs-ttable tbody tr').forEach(tr => { tr.style.display = !q || tr.dataset.find.includes(q) ? '' : 'none'; }); }
    function paint() {
        if (!S.box) return;
        if (S.err && !S.people.length) { S.box.innerHTML = card(head + `<p style="margin:6px 0 0;color:#b91c1c">${E(S.err)} <button type="button" class="sim-btn ghost" data-tc="reload">Try again</button></p>`); return; }
        S.box.innerHTML = card(`${head}
        <p style="margin:6px 0 10px;color:#475569;font-size:14px">Open a trainee’s calendar as they last saved it, read only, with the automated check, and score it on the <b>CALENDAR MANAGEMENT MOCK CALL</b> scorecard (each metric 0 to 5 with your feedback). The trainee sees your scorecard on their card here and in the simulator.</p>
        ${S.people.length ? `<input id="cs-tfind" type="search" aria-label="Find a trainee or batch" placeholder="Find a trainee or batch…" value="${E(S.q)}" style="width:min(100%,320px);font:inherit;padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:10px">
        <div style="overflow-x:auto"><table class="cs-ttable" style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="text-align:left;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.04em"><th style="padding:6px 8px">Trainee</th>${TRACKS.map(t => `<th style="padding:6px 8px">${t.icon} ${E(t.title)}</th>`).join('')}</tr></thead>
        <tbody>${rows()}</tbody></table></div>`
            : '<p style="margin:0;color:#64748b">No trainee has saved a calendar yet. A trainee’s calendar is saved to their account as they work in a simulator.</p>'}`);
        filter();
    }
    async function fetchPeople() {
        let drafts = [], recs = [];
        try {
            const [a, b] = await Promise.all([go('/api/gcal-reviews?drafts=1', { credentials: 'include' }).then(r => r.json()), go('/api/calsim?all=1', { credentials: 'include' }).then(r => r.json())]);
            drafts = (a && a.success && a.drafts) || []; recs = (b && b.success && b.rows) || [];
            S.err = a && a.success ? '' : ((a && a.error) || 'The trainees’ calendars could not be loaded.');
        } catch (e) { drafts = []; S.err = 'The trainees’ calendars could not be loaded. Check your connection.'; }
        const people = {};
        drafts.forEach(d => { const p = people[d.username] = people[d.username] || { username: d.username, name: d.name || d.username, batch: d.batch || '', tracks: {}, latest: '' }; p.tracks[d.track] = { at: d.updatedAt }; if (String(d.updatedAt) > p.latest) p.latest = String(d.updatedAt); });
        recs.forEach(r => { const sc = (r.data && r.data.scorecards) || {}; Object.keys(sc).forEach(t => { const list = Array.isArray(sc[t]) ? sc[t] : []; if (!list.length) return;
            const p = people[r.username] = people[r.username] || { username: r.username, name: r.name || r.username, batch: r.batch || '', tracks: {}, latest: '' }; (p.tracks[t] = p.tracks[t] || {}).card = list[list.length - 1]; }); });
        S.people = Object.values(people).sort((x, y) => String(y.latest).localeCompare(String(x.latest)) || x.name.localeCompare(y.name));
    }
    async function load(box, opts) {
        S.box = typeof box === 'string' ? document.querySelector(box) : box; S.extra = (opts && opts.extra) || null; if (!S.box) return;
        if (!S.box.dataset.tcBound) {
            S.box.dataset.tcBound = '1';
            S.box.addEventListener('input', (ev) => { if (ev.target.id === 'cs-tfind') { S.q = ev.target.value; filter(); } });
            S.box.addEventListener('click', (ev) => { if (ev.target.closest('[data-tc="reload"]')) load(S.box, { extra: S.extra }); });
        }
        S.box.innerHTML = card(head + '<p style="margin:6px 0 0;color:#64748b">Loading…</p>');
        await fetchPeople(); paint();
    }
    // draw the rows again (the box keeps the search and the cursor in it)
    function repaint() { if (!S.box) return; const tb = S.box.querySelector('.cs-ttable tbody'); if (!tb) { paint(); return; } tb.innerHTML = rows(); filter(); }
    return { load, repaint, TRACKS };
})();
// (the Calendaring Simulators page called its search this: kept so a link or a test that does still works)
window.csFind = function (q) { const i = document.getElementById('cs-tfind'); if (i) { i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); } };

/* 👥 Your trainees’ calendars: the trainer's table, in one place for the Calendaring Simulators page (calsim.html) and
   the Trainee Evaluations page (gcal-review.html), so both show the same thing.
   Everyone who has a calendar saved on a Google Calendar Simulator (/api/gcal-reviews?drafts=1) or a scorecard given
   (scorecards in their /api/calsim record), with a search box, one column per track and 👁 View & score on each track
   the trainee has: their calendar in the Google Calendar look, read only, with the automated check and the CALENDAR
   MANAGEMENT MOCK CALL scorecard (gcal.html?trainee=<username>), and the last scorecard given.
   Use: GcalTrainees.render(element) — trainers only (the APIs answer 403 to anyone else). Needs simulators/sim.js. */
(function () {
    const TRACKS = [
        { id: 'standard', icon: '🎓', title: 'Standard Training' },
        { id: 'cm', icon: '⚖️', title: 'Litigation Week' },
        { id: 'ea', icon: '🏢', title: 'Executive Week' }
    ];
    const E = (t) => Sim.esc(t);
    const card = (inner) => `<div class="card cs-trainees-card" style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:18px">${inner}</div>`;
    const head = '<h2 style="margin:0;font-size:20px;color:#0b1633">👥 Your trainees’ calendars</h2>';
    const href = (u, t) => '/simulators/gcal.html?' + (t === 'standard' ? '' : 'track=' + encodeURIComponent(t) + '&') + 'trainee=' + encodeURIComponent(u);
    const when = (t) => { const d = new Date(String(t || '').replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(t || '')) ? '' : 'Z')); return isNaN(d) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };

    // Everyone with a calendar saved or a scorecard given, newest activity first.
    async function load() {
        let drafts = [], recs = [];
        try {
            const [a, b] = await Promise.all([fetch('/api/gcal-reviews?drafts=1', { credentials: 'include' }).then(r => r.json()), fetch('/api/calsim?all=1', { credentials: 'include' }).then(r => r.json())]);
            drafts = (a && a.success && a.drafts) || []; recs = (b && b.success && b.rows) || [];
        } catch (e) { drafts = []; }
        const people = {};
        const person = (u, name, batch) => people[u] = people[u] || { username: u, name: name || u, batch: batch || '', tracks: {}, latest: '' };
        drafts.forEach(d => { const p = person(d.username, d.name, d.batch); p.tracks[d.track] = { at: d.updatedAt }; if (String(d.updatedAt) > p.latest) p.latest = String(d.updatedAt); });
        recs.forEach(r => { const sc = (r.data && r.data.scorecards) || {}; Object.keys(sc).forEach(t => { const list = Array.isArray(sc[t]) ? sc[t] : []; if (!list.length) return;
            const p = person(r.username, r.name, r.batch); (p.tracks[t] = p.tracks[t] || {}).card = list[list.length - 1]; }); });
        return Object.values(people).sort((x, y) => String(y.latest).localeCompare(String(x.latest)) || x.name.localeCompare(y.name));
    }
    function cell(p, t) {
        const x = p.tracks[t.id]; if (!x) return '<td style="padding:8px;vertical-align:top;color:#94a3b8">—</td>';
        return `<td style="padding:8px;vertical-align:top"><a class="sim-btn orange cs-view" style="text-decoration:none;padding:5px 10px;font-size:13px" href="${E(href(p.username, t.id))}">👁 View &amp; score</a>
            <div style="font-size:12px;color:#64748b;margin-top:3px">${x.at ? 'Saved ' + E(when(x.at)) : 'Not saved'}${x.card ? ` · 📋 <b style="color:#0b1633">${E(x.card.average)}/5 (${E(x.card.pct)}%)</b>` : ''}</div></td>`;
    }
    function table(list) {
        if (!list.length) return '<p style="margin:0;color:#64748b">No trainee has saved a calendar yet. A trainee’s calendar is saved to their account as they work in a simulator.</p>';
        return `<input id="cs-tfind" type="search" placeholder="Find a trainee or batch…" style="width:min(100%,320px);font:inherit;padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:10px" oninput="csFind(this.value)">
        <div style="overflow-x:auto"><table class="cs-ttable" style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="text-align:left;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.04em"><th style="padding:6px 8px">Trainee</th>${TRACKS.map(t => `<th style="padding:6px 8px">${t.icon} ${E(t.title)}</th>`).join('')}</tr></thead>
        <tbody>${list.map(p => `<tr data-find="${E((p.name + ' ' + p.batch + ' ' + p.username).toLowerCase())}" style="border-top:1px solid #e5e7eb"><td style="padding:8px"><b>${E(p.name)}</b><div style="font-size:12px;color:#64748b">${E(p.batch || 'No batch')}</div></td>${TRACKS.map(t => cell(p, t)).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    // Draws the table in `box` (loading first, then the list).
    async function render(box) {
        if (!box) return;
        box.innerHTML = card(head + '<p style="margin:6px 0 0;color:#64748b">Loading…</p>');
        const list = await load();
        box.innerHTML = card(`${head}
        <p style="margin:6px 0 10px;color:#475569;font-size:14px">Open a trainee’s calendar as they last saved it, read only, with the automated check, and score it on the <b>CALENDAR MANAGEMENT MOCK CALL</b> scorecard (each metric 0 to 5 with your feedback). The trainee sees your scorecard on their card on the Calendaring Simulators page and in the simulator.</p>
        ${table(list)}`);
    }
    window.csFind = function (q) { q = String(q || '').trim().toLowerCase(); document.querySelectorAll('.cs-ttable tbody tr').forEach(tr => { tr.style.display = !q || tr.dataset.find.includes(q) ? '' : 'none'; }); };
    window.GcalTrainees = { TRACKS, render };
})();

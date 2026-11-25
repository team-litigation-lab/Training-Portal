/* LSH Nexus — 👥 Your trainees' calendars (trainers): everyone who has a calendar saved on a Google Calendar Sim, with
   👁 View & score on each track: their calendar in the Google Calendar look, read only, with the automated check and the CALENDAR MANAGEMENT
   MOCK CALL scorecard (gcal.html?trainee=<username>), and the last scorecard given.
   On the Trainee Evaluations page (gcal-review.html); the Calendaring Sims page (calsim.html) points trainers there.
     TraineesCalendars.load(box, { extra })   draws it into the element (or selector) `box`.
        extra(person, trackId) → HTML in a last "More" column on that track's row
        cols: [{ title, cell(person, trackId) → HTML }]   extra columns (the Trainee Evaluations page adds the submission, its review state and Open review)
     The table is segregated per trainee: one <tbody> each, a heading row (name · batch · username), then a row per track.
     TraineesCalendars.repaint()               draws the rows again (after `extra` has new things to show), keeping the search */
const TraineesCalendars = (function () {
    const TRACKS = [{ id: 'standard', icon: '🎓', title: 'Standard Training' }, { id: 'cm', icon: '⚖️', title: 'Litigation Week' }, { id: 'ea', icon: '🏢', title: 'Executive Week' },
        { id: 'activity', icon: '📝', title: 'Calendaring Activity', viewOnly: true }];   // (the blank calendar: its automated check, every entry, and no mock-call scorecard)
    const E = (t) => Sim.esc(t), go = (u, o) => (Sim.fetchRetry ? Sim.fetchRetry(u, o) : fetch(u, o));
    const S = { box: null, people: [], extra: null, q: '', err: '' };
    const card = (inner) => `<div class="card tc-card" style="padding:18px;background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 4px 18px rgba(11,22,51,.12)">${inner}</div>`;
    const head = '<h2 style="margin:0;font-size:20px;color:#0b1633">👥 Your trainees’ calendars</h2>';
    const href = (u, t) => '/simulators/gcal.html?' + (t === 'standard' ? '' : 'track=' + encodeURIComponent(t) + '&') + 'trainee=' + encodeURIComponent(u);
    const when = (t) => { const d = new Date(String(t || '').replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(t || '')) ? '' : 'Z')); return isNaN(d) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
    // One <tbody> per trainee: a heading row with their name and batch, then one row per track, so each trainee's
    // calendars, scorecards and submissions sit together in their own block of the table.
    // opts.cols (the Trainee Evaluations page): extra columns, [{ title, cell(person, trackId) → HTML }].
    const COLS = () => S.cols || [];
    const td = (html, muted) => `<td style="padding:7px 8px;vertical-align:middle${muted ? ';color:#94a3b8' : ''}">${html}</td>`;
    function trackRow(p, t, first) {
        const x = p.tracks[t.id], more = S.extra ? S.extra(p, t.id) : '';
        const view = x ? `<a class="sim-btn orange cs-view" style="text-decoration:none;padding:4px 10px;font-size:12.5px;white-space:nowrap" href="${E(href(p.username, t.id))}">${t.viewOnly ? '👁 View' : '👁 View &amp; score'}</a>` : '';
        const score = x && x.card ? `<b style="color:#0b1633">${E(x.card.average)}/5</b> <span style="color:#64748b">(${E(x.card.pct)}%)</span>` : (t.viewOnly ? '<span style="color:#94a3b8">No scorecard</span>' : '');
        const extraCells = COLS().map(c => { const h = c.cell(p, t.id) || ''; return td(h || '—', !h); }).join('');
        return `<tr class="tc-trow${first ? ' first' : ''}" style="border-top:1px solid #f1f5f9">
            <td style="padding:7px 8px 7px 22px;white-space:nowrap;color:#334155;font-weight:600">${t.icon} ${E(t.title)}</td>
            ${td(view || '—', !view)}${td(x && x.at ? E(when(x.at)) : '—', !(x && x.at))}${td(score || '—', !score)}${extraCells}
            ${more ? td(more) : (S.extra ? td('—', true) : '')}</tr>`;
    }
    function rows() {
        const span = 4 + COLS().length + (S.extra ? 1 : 0);
        return S.people.map(p => {
            const n = TRACKS.filter(t => p.tracks[t.id]).length;
            return `<tbody class="tc-person" data-find="${E((p.name + ' ' + p.batch + ' ' + p.username).toLowerCase())}">
            <tr class="tc-phead"><th colspan="${span}" scope="rowgroup" style="text-align:left;padding:9px 10px;background:#f1f5f9;border-top:2px solid #cbd5e1;font-size:14px;color:#0b1633">
                👤 ${E(p.name)} <span style="font-weight:500;color:#64748b;font-size:12.5px">· ${E(p.batch || 'No batch')} · ${E(p.username)} · ${n} of ${TRACKS.length} calendar${TRACKS.length === 1 ? '' : 's'} saved</span></th></tr>
            ${TRACKS.map((t, i) => trackRow(p, t, i === 0)).join('')}</tbody>`;
        }).join('');
    }
    function headRow() {
        const th = (h) => `<th style="padding:6px 8px;white-space:nowrap">${h}</th>`;
        return `<tr style="text-align:left;color:#64748b;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em">${th('Track')}${th('Calendar')}${th('Last saved')}${th('📋 Scorecard')}${COLS().map(c => th(E(c.title))).join('')}${S.extra ? th('More') : ''}</tr>`;
    }
    function filter() { const q = S.q.trim().toLowerCase(); let shown = 0; S.box.querySelectorAll('.cs-ttable tbody.tc-person').forEach(tb => { const on = !q || tb.dataset.find.includes(q); tb.style.display = on ? '' : 'none'; if (on) shown++; }); const c = S.box.querySelector('#cs-tcount'); if (c) c.textContent = shown + ' of ' + S.people.length + ' trainee' + (S.people.length === 1 ? '' : 's'); }
    function paint() {
        if (!S.box) return;
        if (S.err && !S.people.length) { S.box.innerHTML = card(head + `<p class="sim-error" style="margin:6px 0 0">${E(S.err)} <button type="button" class="sim-btn ghost" data-tc="reload">Try again</button></p>`); return; }
        S.box.innerHTML = card(`${head}
        <p style="margin:6px 0 10px;color:#475569;font-size:14px">Open a trainee’s calendar as they last saved it, read only, with the automated check, and score it on the <b>CALENDAR MANAGEMENT MOCK CALL</b> scorecard (each metric 0 to 5 with your feedback). The trainee sees your scorecard on their card here and in the simulator. <b>📝 Calendaring Activity</b> is the blank calendar for the offline activity: 👁 View shows it with the automated check of every entry (no mock-call scorecard).</p>
        ${S.people.length ? `<input id="cs-tfind" type="search" aria-label="Find a trainee or batch" placeholder="Find a trainee or batch…" value="${E(S.q)}" style="width:min(100%,320px);font:inherit;padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:10px">
        <span id="cs-tcount" style="margin-left:10px;font-size:12.5px;color:#64748b"></span>
        <div style="overflow-x:auto"><table class="cs-ttable" style="width:100%;border-collapse:collapse;font-size:13.5px"><thead>${headRow()}</thead>
        ${rows()}</table></div>`
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
        S.box = typeof box === 'string' ? document.querySelector(box) : box; S.extra = (opts && opts.extra) || null; S.cols = (opts && opts.cols) || null; if (!S.box) return;
        if (!S.box.dataset.tcBound) {
            S.box.dataset.tcBound = '1';
            S.box.addEventListener('input', (ev) => { if (ev.target.id === 'cs-tfind') { S.q = ev.target.value; filter(); } });
            S.box.addEventListener('click', (ev) => { if (ev.target.closest('[data-tc="reload"]')) load(S.box, { extra: S.extra, cols: S.cols }); });
        }
        S.box.innerHTML = card(head + '<p style="margin:6px 0 0;color:#64748b">Loading…</p>');
        await fetchPeople(); paint();
        // 📋 Scorecards saved since (on the Foundational Training's 🧑‍🏫 Graders, or on the simulator) show on their own: read again
        // every 60 seconds while the page is in view and when it comes back into view; the rows are redrawn, the search kept.
        if (!S.timer) {
            const again = async () => { if (document.hidden || S.busy || !S.box) return; S.busy = true; const was = JSON.stringify(S.people); try { await fetchPeople(); } finally { S.busy = false; } if (JSON.stringify(S.people) !== was) repaint(); };
            S.timer = setInterval(again, 60000);
            document.addEventListener('visibilitychange', () => { if (!document.hidden) again(); });
        }
    }
    // draw the rows again (the box keeps the search and the cursor in it)
    function repaint() { if (!S.box) return; const tbl = S.box.querySelector('.cs-ttable'); if (!tbl) { paint(); return; } tbl.querySelectorAll('tbody.tc-person').forEach(tb => tb.remove()); tbl.insertAdjacentHTML('beforeend', rows()); filter(); }
    return { load, repaint, TRACKS };
})();
// (the Calendaring Sims page called its search this: kept so a link or a test that does still works)
window.csFind = function (q) { const i = document.getElementById('cs-tfind'); if (i) { i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); } };

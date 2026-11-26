// 📊 Grades & Progress → Grades Report (Master Control → 2 · Grading & Progress; its other tab opens 📈 Progress & Feedback, /progress.html): one consolidated report of every grader's scores, across every
// program, and nothing else. Grading, releasing and deleting live in each program (each course grades its own work), so this
// view no longer carries them: the old Check & Release Grades sections stay in the page, hidden, so app.js's loaders still
// find their elements.
//
// The data is /api/program-progress (admins only), one program per request (each request has its own KV read budget):
// each trainee's average per program (Knowledge Checks, Practice, Surprise Tasks and Role-plays, as the course's graders
// scored them) and their days or lessons done, plus the Portal's own simulator results and graded Portal activities.
// One row per trainee (matched by name across programs), grouped by batch, newest batch first; a search box; a CSV download.
(function () {
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = v => typeof v === 'number' && Number.isFinite(v);
    const avg = xs => { const v = xs.filter(num); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    const nameKey = s => String(s || '').split(' · ')[0].trim().toLowerCase().replace(/\s+/g, ' ');
    const SHORT = { ft: 'Foundational', eapa: 'EA / PA', cm: 'Case Mgmt', pd: 'PD Claims', md: 'Medsum', ln: 'Lien Neg.', cs: 'Closing' };
    let state = null, loading = null, pickedBatch = null;

    function score(t) {   // a trainee's grade in one program: the average of the graders' averages there
        const parts = { 'Knowledge Checks': t.kcAvg, 'Practice': t.practiceAvg, 'Surprise Tasks': t.taskAvg, 'Role-plays': t.roleplayAvg };
        return { value: avg(Object.values(parts)), parts };
    }
    function cohort(b) { return typeof window.batchCohort === 'function' ? window.batchCohort(b) : { key: b || 'No Batch', sort: b || '0' }; }

    async function fetchAll() {
        const first = await (await fetch('/api/program-progress?program=ft', { credentials: 'include', cache: 'no-store' })).json();
        if (!first || first.success === false) throw new Error((first && first.error) || 'Could not load the grades.');
        const programs = first.programs || [];
        const rest = await Promise.all(programs.filter(p => p.id !== 'ft').map(p =>
            fetch('/api/program-progress?program=' + encodeURIComponent(p.id), { credentials: 'include', cache: 'no-store' }).then(r => r.json()).catch(() => null)));
        const all = [first].concat(rest).filter(Boolean);
        const people = new Map();
        all.forEach(d => (d.trainees || []).forEach(t => {
            if (t.status !== 'Approved') return;   // pending, rejected and archived trainees aren't on the report
            const k = nameKey(t.name);
            if (!people.has(k)) people.set(k, { name: t.name, batch: t.batch, ids: [], programs: {} });
            const p = people.get(k); p.ids.push(t.id); if (!p.batch && t.batch) p.batch = t.batch;
            p.programs[t.program] = { ...score(t), done: t.daysDone, total: t.daysTotal, unit: t.unit || 'days' };
        }));
        const sims = first.simulators || { byId: {}, byName: {} }, work = first.portalWork || { byId: {}, byName: {} };
        people.forEach((p, k) => {
            const s = p.ids.map(id => sims.byId && sims.byId[id]).find(Boolean) || (sims.byName || {})[k];
            const w = p.ids.map(id => work.byId && work.byId[id]).find(Boolean) || (work.byName || {})[k];
            p.sims = s ? { avg: s.avg, runs: s.runs } : null;
            p.work = w ? { avg: w.avgScore, graded: w.graded, submitted: w.submitted } : null;
            p.overall = avg(Object.values(p.programs).map(x => x.value).concat(p.sims ? p.sims.avg : null, p.work ? p.work.avg : null));
        });
        return { programs, people: [...people.values()], at: new Date(), notes: all.map(d => d.note).filter(Boolean) };
    }

    const pct = v => num(v) ? v + '%' : '—';
    const tone = v => !num(v) ? 'na' : v >= 85 ? 'hi' : v >= 70 ? 'ok' : 'lo';
    function cell(p) {
        if (!p) return '<td class="gr-na">—</td>';
        const tip = Object.entries(p.parts).filter(([, v]) => num(v)).map(([k, v]) => k + ' ' + v + '%').join(' · ') || 'No scores yet';
        return `<td title="${esc(tip)}"><b class="gr-s ${tone(p.value)}">${pct(p.value)}</b><small>${p.done}/${p.total} ${esc(p.unit)}</small></td>`;
    }
    function render() {
        const box = document.getElementById('gr-report'); if (!box || !state) return;
        const q = ((document.getElementById('gr-search') || {}).value || '').trim().toLowerCase();
        const rows = state.people.filter(p => !q || (p.name + ' ' + p.batch).toLowerCase().includes(q));
        const groups = new Map();
        rows.forEach(p => { const c = cohort(p.batch); if (!groups.has(c.key)) groups.set(c.key, { key: c.key, sort: c.sort, list: [] }); groups.get(c.key).list.push(p); });
        const batches = [...groups.values()].sort((a, b) => String(b.sort).localeCompare(String(a.sort)));
        const progs = state.programs;
        const head = `<tr><th>Trainee</th>${progs.map(p => `<th title="${esc(p.label)}">${esc(SHORT[p.id] || p.label)}</th>`).join('')}<th title="LSH Elev8 simulator runs saved to the Portal">Simulators</th><th title="Activities graded on the Portal">Portal work</th><th>Overall</th></tr>`;
        const line = p => `<tr><td class="gr-name">${esc(p.name)}</td>${progs.map(x => cell(p.programs[x.id])).join('')}
            <td>${p.sims ? `<b class="gr-s ${tone(p.sims.avg)}">${pct(p.sims.avg)}</b><small>${p.sims.runs} run${p.sims.runs === 1 ? '' : 's'}</small>` : '<span class="gr-na">—</span>'}</td>
            <td>${p.work ? `<b class="gr-s ${tone(p.work.avg)}">${pct(p.work.avg)}</b><small>${p.work.graded}/${p.work.submitted} graded</small>` : '<span class="gr-na">—</span>'}</td>
            <td><b class="gr-s big ${tone(p.overall)}">${pct(p.overall)}</b></td></tr>`;
        const all = state.people, scored = all.map(p => p.overall).filter(num);
        // 🎓 one batch at a time, picked from a dropdown (newest first); a search shows every matching batch instead
        if (!batches.some(g => g.key === pickedBatch)) pickedBatch = batches.length ? batches[0].key : null;
        const shown = q ? batches : batches.filter(g => g.key === pickedBatch);
        const picker = !q && batches.length > 1 ? `<div class="bp-wrap gr-pick"><label class="bp-label" for="gr-batch">🎓 Batch</label><select class="bp-select" id="gr-batch">${
            batches.map(g => `<option value="${esc(g.key)}"${g.key === pickedBatch ? ' selected' : ''}>${esc(g.key)} — ${g.list.length} trainee${g.list.length === 1 ? '' : 's'}</option>`).join('')}</select><span class="bp-count">${batches.length} batches</span></div>` : '';
        box.innerHTML = `<div class="gr-kpis"><div><b>${all.length}</b><span>Trainees</span></div><div><b>${groups.size}</b><span>Batches</span></div>
                <div><b>${pct(avg(scored))}</b><span>Average overall</span></div><div><b>${all.filter(p => num(p.overall) && p.overall < 70).length}</b><span>Under 70%</span></div></div>
            ${state.notes.length ? `<p class="gr-note">${esc(state.notes.join(' '))}</p>` : ''}
            ${picker}${shown.length ? shown.map(g => `<details class="gr-batch" open><summary>🎓 ${esc(g.key)} <span>${g.list.length}</span></summary>
                <div class="gr-scroll"><table class="gr-table"><thead>${head}</thead><tbody>${g.list.sort((a, b) => a.name.localeCompare(b.name)).map(line).join('')}</tbody></table></div></details>`).join('')
                : '<p class="gr-note">No trainee matches.</p>'}
            <p class="gr-foot">Each program's score is the average of its graders' averages (Knowledge Checks, Practice, Surprise Tasks, Role-plays): hover a score to see them. Updated ${esc(state.at.toLocaleString())}.</p>`;
        const pickEl = document.getElementById('gr-batch'); if (pickEl) pickEl.addEventListener('change', e => { pickedBatch = e.target.value; render(); });
    }
    function csv() {
        if (!state) return;
        const progs = state.programs, q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const lines = [['Trainee', 'Batch'].concat(progs.flatMap(p => [p.label + ' %', p.label + ' done']), ['Simulators %', 'Portal work %', 'Overall %']).map(q).join(',')];
        state.people.forEach(p => lines.push([p.name, p.batch].concat(progs.flatMap(x => { const c = p.programs[x.id]; return c ? [c.value, c.done + '/' + c.total] : ['', '']; }),
            [p.sims ? p.sims.avg : '', p.work ? p.work.avg : '', p.overall]).map(q).join(',')));
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
        a.download = 'lsh-grades-report-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    }
    async function load(force) {
        const box = document.getElementById('gr-report'); if (!box) return;
        if (loading) return loading;
        if (state && !force) return render();
        box.innerHTML = '<p class="gr-note">Loading every program’s grades…</p>';
        loading = fetchAll().then(s => { state = s; render(); }).catch(e => { box.innerHTML = `<p class="gr-note err">${esc(e.message)}</p>`; }).finally(() => { loading = null; });
        return loading;
    }

    function mount() {
        const view = document.getElementById('view-admin-grades'); if (!view || document.getElementById('gr-wrap')) return;
        [...view.children].forEach(el => { el.hidden = true; el.style.display = 'none'; });   // the old grading tools: still there for app.js, not shown
        const wrap = document.createElement('div'); wrap.id = 'gr-wrap';
        wrap.innerHTML = `<div class="gr-tabs" role="tablist" aria-label="Grades & Progress"><span class="gr-tab on" role="tab" aria-selected="true">📊 Grades Report</span><a class="gr-tab" role="tab" aria-selected="false" href="/progress.html">📈 Progress &amp; Feedback</a></div>
            <div class="gr-hero"><div><div class="gr-eyebrow">Master Control · Grading &amp; Progress</div><h2>📊 Grades Report</h2>
                <p>Every grader's scores, across every program, in one place. Grading and releasing happen inside each program.</p></div>
                <div class="gr-actions"><button type="button" class="gr-btn" id="gr-refresh">↻ Refresh</button><button type="button" class="gr-btn gold" id="gr-csv">⬇ Download CSV</button></div></div>
            <input type="search" id="gr-search" placeholder="Search by name or batch" aria-label="Search the report">
            <div id="gr-report"></div>`;
        view.appendChild(wrap);
        wrap.querySelector('#gr-refresh').addEventListener('click', () => load(true));
        wrap.querySelector('#gr-csv').addEventListener('click', csv);
        wrap.querySelector('#gr-search').addEventListener('input', render);
        const nav = document.getElementById('nav-admin-grades');
        if (nav) { nav.innerHTML = '<span>📊</span> Grades &amp; Progress'; nav.title = 'Every grader’s scores across every program, and each trainee’s progress and feedback'; }
        const st = document.createElement('style');
        st.textContent = `#gr-wrap { color: #0f172a; }
        .gr-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 14px; padding: 6px; border-radius: 14px; background: rgba(30,35,64,.06); border: 1px solid rgba(30,35,64,.1); }
        .gr-tab { padding: 8px 16px; border-radius: 10px; color: #1E2340; font-size: 13.5px; font-weight: 800; text-decoration: none; border: 1px solid transparent; }
        a.gr-tab:hover { background: #fff; border-color: rgba(30,35,64,.15); }
        .gr-tab.on { background: linear-gradient(180deg, #2a3058, #1E2340); color: #fff; box-shadow: inset 0 -2px 0 #DB8437; }
        .gr-hero { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px 24px; padding: 18px 22px; border-radius: 18px; background: linear-gradient(135deg, #1E2340, #2D3762); color: #fff; border-bottom: 3px solid #DB8437; margin-bottom: 16px; }
        .gr-eyebrow { font: 800 11px/1 'IBM Plex Mono', monospace; letter-spacing: .12em; text-transform: uppercase; color: #fdba74; margin-bottom: 6px; }
        .gr-hero h2 { margin: 0 0 4px; font-size: 24px; font-weight: 900; color: #fff; }
        .gr-hero p { margin: 0; font-size: 14px; font-weight: 700; color: #dbe2f5; }
        .gr-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .gr-btn { padding: 9px 16px; border-radius: 10px; border: 2px solid #fff; background: transparent; color: #fff; font: inherit; font-size: 13.5px; font-weight: 800; cursor: pointer; }
        .gr-btn.gold { border-color: transparent; background: linear-gradient(180deg, #f0a35c, #DB8437); color: #1E2340; }
        #gr-search { width: 100%; max-width: 420px; padding: 11px 14px; border: 1.5px solid #94a3b8; border-radius: 10px; font-size: 15px; font-weight: 700; margin-bottom: 14px; }
        .gr-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
        .gr-kpis div { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 16px; }
        .gr-kpis b { display: block; font-size: 24px; font-weight: 900; color: #1E2340; } .gr-kpis span { font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: .06em; }
        .gr-batch { margin-bottom: 12px; border-radius: 14px; overflow: hidden; border: 2px solid #1E2340; background: #fff; }
        .gr-batch summary { cursor: pointer; padding: 10px 16px; background: #1E2340; color: #fff; font-size: 15px; font-weight: 900; list-style: none; }
        .gr-batch summary span { margin-left: 8px; font-size: 12px; background: rgba(255,255,255,.15); border-radius: 999px; padding: 2px 9px; }
        .gr-scroll { overflow-x: auto; }
        .gr-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .gr-table th { text-align: left; padding: 9px 12px; background: #f1f5f9; font-size: 11.5px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; color: #1E2340; white-space: nowrap; }
        .gr-table td { padding: 9px 12px; border-top: 1px solid #eef2f7; vertical-align: middle; white-space: nowrap; }
        .gr-table td small { display: block; font-size: 11.5px; font-weight: 700; color: #64748b; }
        .gr-name { font-weight: 900; }
        .gr-s { font-weight: 900; } .gr-s.big { font-size: 16px; } .gr-s.hi { color: #15803d; } .gr-s.ok { color: #1E2340; } .gr-s.lo { color: #b91c1c; } .gr-s.na, .gr-na { color: #94a3b8; font-weight: 700; }
        .gr-note { font-size: 14px; font-weight: 700; color: #475569; } .gr-note.err { color: #b91c1c; }
        .gr-foot { font-size: 12.5px; font-weight: 700; color: #64748b; margin-top: 8px; }
        @media (max-width: 700px) { .gr-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`;
        document.head.appendChild(st);
    }
    // show the report whenever the view opens (the menu, the Control Directory, the workspace's first view)
    const hook = () => {
        const orig = window.switchView;
        if (typeof orig !== 'function' || orig.__grades) return;
        const w = function (id) { const r = orig.apply(this, arguments); if (id === 'admin-grades') { mount(); load(); } return r; };
        w.__grades = true; window.switchView = w;
    };
    const ifShown = () => { const v = document.getElementById('view-admin-grades'); if (v && !v.classList.contains('hidden')) load(); };
    mount(); hook(); ifShown(); document.addEventListener('DOMContentLoaded', () => { mount(); hook(); ifShown(); });
    window.GradesReport = { load };
})();

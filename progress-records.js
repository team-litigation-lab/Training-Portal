// Admin → Trainee Progress & Feedback (/progress.html).
// Reads /api/program-progress and merges each person's records from every
// program into one row (matched by name, as the programs have separate sign-ins).
const P = { data: null, tab: 'people', program: 'all', batch: '', status: 'active', q: '', sort: 'recent', open: {},
    fb: { program: 'all', day: '', status: '', q: '' } };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameKey = (s) => String(s || '').split(' · ')[0].trim().toLowerCase().replace(/\s+/g, ' ');
const avg = (xs) => { xs = xs.filter(v => v != null); return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null; };
const AREAS = [['platform', 'Platform & ease of use'], ['lessons', 'Lessons & content'], ['facilitator', 'Facilitator / trainer'], ['practice', 'Practice & roleplays'], ['assessment', 'Knowledge Checks & feedback']];
const STATUS_RANK = { Approved: 0, Pending: 1, Rejected: 2, Archived: 3 };

function ago(iso) {
    if (!iso) return '—';
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 2) return 'just now'; if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    const d = Math.round(h / 24); return d < 60 ? d + ' d ago' : new Date(iso).toLocaleDateString();
}
const date = (iso) => iso ? new Date(iso).toLocaleDateString() : '—';
function progLabel(id) { const p = (P.data.programs || []).find(x => x.id === id); return p ? p.label : id; }
function score(n) { if (n == null) return '<span class="pg-muted">—</span>'; const c = n >= 85 ? 'good' : n >= 70 ? 'mid' : 'low'; return `<span class="sim-score ${c}">${n}%</span>`; }
function rating(r) { return r ? `<span class="pg-rt ${esc(String(r).split(' ')[0])}">${esc(r)}</span>` : ''; }
function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }
function starAvg(items) { return avg(items.flatMap(f => Object.values(f.ratings || {})).map(v => v * 20)); }

// ---------- one record per person ----------
function people() {
    const d = P.data, by = {};
    for (const t of d.trainees || []) {
        const k = nameKey(t.name) || (t.program + ':' + t.id);
        (by[k] = by[k] || { key: k, enrollments: [] }).enrollments.push(t);
    }
    const tfb = d.traineeFeedback || [];
    return Object.values(by).map(p => {
        const en = p.enrollments.sort((a, b) => (STATUS_RANK[a.status] - STATUS_RANK[b.status]) || String(b.lastActive || '').localeCompare(String(a.lastActive || '')));
        const ids = new Set(en.map(t => t.program + ':' + t.id));
        const sent = tfb.filter(f => !f.anonymous && (ids.has(f.program + ':' + f.traineeId) || (!f.traineeId && nameKey(f.name) === p.key)));
        const sim = (d.simulators && d.simulators.byName || {})[p.key] || null;
        const work = (d.portalWork && d.portalWork.byName || {})[p.key] || null;
        const fbs = en.map(t => t.feedback || { sent: 0, drafts: 0, unread: 0, days: {} });
        const latest = en.flatMap(t => Object.values((t.feedback || {}).days || {}).filter(f => f.status === 'sent'))
            .sort((a, b) => String(b.sentAt || '').localeCompare(String(a.sentAt || '')))[0];
        const last = [...en.map(t => t.lastActive), sim && sim.last, work && work.last].filter(Boolean).sort().pop() || null;
        const daysDone = en.reduce((a, t) => a + t.daysDone, 0), daysTotal = en.reduce((a, t) => a + t.daysTotal, 0);
        return {
            key: p.key, name: String(en[0].name).replace(/\s+/g, ' ').trim(), enrollments: en, sent, sim, work, lastActive: last,
            batches: [...new Set(en.map(t => t.batch).filter(Boolean))],
            status: en[0].status, daysDone, daysTotal, done: daysTotal ? daysDone / daysTotal : 0,
            kcAvg: avg(en.map(t => t.kcAvg)), practiceAvg: avg(en.map(t => t.practiceAvg)), taskAvg: avg(en.map(t => t.taskAvg)),
            fbSent: fbs.reduce((a, f) => a + f.sent, 0), fbDrafts: fbs.reduce((a, f) => a + f.drafts, 0), fbUnread: fbs.reduce((a, f) => a + f.unread, 0),
            latestRating: latest ? latest.rating : null, theirStars: starAvg(sent)
        };
    });
}
function rows() {
    const q = P.q.trim().toLowerCase();
    const inProg = (p) => P.program === 'all' ? p.enrollments : p.enrollments.filter(t => t.program === P.program);
    const list = people().filter(p => {
        const en = inProg(p); if (!en.length) return false;
        if (P.batch && !en.some(t => t.batch === P.batch)) return false;
        if (P.status === 'active' && !en.some(t => t.status === 'Approved')) return false;
        if (P.status !== 'active' && P.status !== 'all' && !en.some(t => t.status === P.status)) return false;
        return !q || (p.name + ' ' + p.batches.join(' ')).toLowerCase().includes(q);
    });
    const by = {
        recent: (a, b) => String(b.lastActive || '').localeCompare(String(a.lastActive || '')),
        name: (a, b) => a.name.localeCompare(b.name),
        progress: (a, b) => b.done - a.done || (b.kcAvg || 0) - (a.kcAvg || 0),
        kc: (a, b) => (b.kcAvg ?? -1) - (a.kcAvg ?? -1),
        behind: (a, b) => a.done - b.done || String(a.lastActive || '').localeCompare(String(b.lastActive || '')),
        drafts: (a, b) => b.fbDrafts - a.fbDrafts || String(b.lastActive || '').localeCompare(String(a.lastActive || ''))
    };
    return list.sort(by[P.sort] || by.recent);
}

function cards() {
    const all = P.data.trainees || [], week = Date.now() - 7 * 864e5, tfb = P.data.traineeFeedback || [];
    return (P.data.programs || []).map(p => {
        const ts = all.filter(t => t.program === p.id), act = ts.filter(t => t.status === 'Approved');
        const done = act.length ? Math.round(act.reduce((a, t) => a + t.daysDone / t.daysTotal, 0) / act.length * 100) : null;
        const recent = act.filter(t => t.lastActive && new Date(t.lastActive).getTime() > week).length;
        const pending = ts.filter(t => t.status === 'Pending').length;
        const drafts = act.reduce((a, t) => a + ((t.feedback || {}).drafts || 0), 0);
        const sentFb = act.reduce((a, t) => a + ((t.feedback || {}).sent || 0), 0);
        const theirs = tfb.filter(f => f.program === p.id), st = starAvg(theirs);
        return `<div class="sim-card pg-card"><div class="k">${esc(p.label)} · ${p.days} days</div><div class="v">${act.length}</div>
            <div class="s">approved trainees · ${recent} active this week${pending ? ` · <b>${pending} pending approval</b>` : ''}</div>
            <div class="s" style="margin-top:6px;">Avg completion ${done == null ? '—' : done + '%'} · Knowledge Checks ${avg(act.map(t => t.kcAvg)) == null ? '—' : avg(act.map(t => t.kcAvg)) + '%'}</div>
            <div class="s" style="margin-top:6px;">Trainer feedback: ${sentFb} sent${drafts ? ` · <b>${drafts} draft${drafts === 1 ? '' : 's'} to review</b>` : ''} · From trainees: ${theirs.length}${st != null ? ` (avg ${(st / 20).toFixed(1)}★)` : ''}</div>
            ${p.url ? `<div class="s" style="margin-top:6px;"><a href="${esc(p.url)}" target="_blank" rel="noopener">Open course admin ↗</a></div>` : ''}</div>`;
    }).join('');
}

function render() {
    const app = document.getElementById('app'), d = P.data;
    const nFb = (d.traineeFeedback || []).length;
    app.innerHTML = `
        ${d.connected && !d.partial ? '' : `<div class="pg-note">${esc(d.note || 'Course data isn’t connected yet.')}</div>`}
        <div class="pg-cards">${cards()}</div>
        <div class="pg-tabs" role="tablist">
            <button role="tab" class="${P.tab === 'people' ? 'on' : ''}" onclick="P.tab='people';render()">👤 Trainees <span class="n">${people().length}</span></button>
            <button role="tab" class="${P.tab === 'feedback' ? 'on' : ''}" onclick="P.tab='feedback';render()">💬 Feedback from trainees <span class="n">${nFb}</span></button>
        </div>
        <div id="pane"></div>
        <p class="pg-muted" style="margin-top:10px;">Records are matched across programs, simulators and portal activities by the trainee’s name. Updated ${esc(d.generatedAt ? ago(d.generatedAt) : '—')}.</p>`;
    P.tab === 'feedback' ? renderFeedbackPane() : renderPeoplePane();
}

function renderPeoplePane() {
    const d = P.data, batches = [...new Set((d.trainees || []).map(t => t.batch).filter(Boolean))].sort();
    document.getElementById('pane').innerHTML = `
        <div class="pg-filters">
            ${[['all', 'All programs']].concat((d.programs || []).map(p => [p.id, p.label])).map(([k, l]) => `<button class="${P.program === k ? 'on' : ''}" onclick="P.program='${k}';render()">${esc(l)}</button>`).join('')}
            <select onchange="P.status=this.value;render()" aria-label="Status">${[['active', 'Approved'], ['Pending', 'Pending approval'], ['Archived', 'Archived'], ['all', 'All statuses']].map(([k, l]) => `<option value="${k}" ${P.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <select onchange="P.batch=this.value;render()" aria-label="Batch"><option value="">All batches</option>${batches.map(b => `<option ${P.batch === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
            <select onchange="P.sort=this.value;render()" aria-label="Sort">${[['recent', 'Last active'], ['behind', 'Furthest behind'], ['progress', 'Most progress'], ['kc', 'Knowledge Check avg'], ['drafts', 'Feedback drafts to review'], ['name', 'Name']].map(([k, l]) => `<option value="${k}" ${P.sort === k ? 'selected' : ''}>Sort: ${l}</option>`).join('')}</select>
            <input type="search" placeholder="Search name or batch…" value="${esc(P.q)}" oninput="P.q=this.value;renderTable()">
            <button onclick="exportCsv()">⬇ CSV</button>
            <button onclick="load(true)">↻ Refresh</button>
        </div>
        <div class="sim-card" style="padding:0;"><div class="sim-table-wrap" id="tbl"></div></div>
        <p class="pg-muted" style="margin-top:10px;">Click a trainee for everything on record: each program’s days, the trainer’s feedback, the feedback they sent, simulators and portal activities.</p>`;
    renderTable();
}

function renderTable() {
    const el = document.getElementById('tbl'); if (!el) return;
    const list = rows();
    if (!list.length) { el.innerHTML = `<div style="padding:18px;" class="pg-muted">No trainees match these filters.</div>`; return; }
    el.innerHTML = `<table class="sim-table pg-table"><thead><tr><th>Trainee</th><th>Programs</th><th>Completion</th><th>Knowledge Checks</th><th>Practice</th><th>Random tasks</th><th>Trainer feedback</th><th>Their feedback</th><th>Simulators</th><th>Portal activities</th><th>Last active</th></tr></thead><tbody>
        ${list.map(p => { const open = !!P.open[p.key];
            return `<tr class="row" onclick="toggle(${esc(JSON.stringify(p.key))})" aria-expanded="${open}"><td class="nm"><b>${esc(p.name)}</b>${p.batches.length ? `<br><span class="pg-muted">${esc(p.batches.join(', '))}</span>` : ''}</td>
                <td>${p.enrollments.map(t => `<span class="pg-prog ${esc(t.program)} ${esc(t.status)}" title="${esc(t.status)}">${esc(progLabel(t.program))} ${t.daysDone}/${t.daysTotal}</span>`).join('<br>')}</td>
                <td><span class="pg-bar"><i style="width:${Math.round(p.done * 100)}%"></i></span>${Math.round(p.done * 100)}%</td>
                <td>${score(p.kcAvg)}</td><td>${score(p.practiceAvg)}</td><td>${score(p.taskAvg)}</td>
                <td>${p.fbSent || p.fbDrafts ? `${rating(p.latestRating)} <span class="pg-muted">${p.fbSent} sent${p.fbDrafts ? ` · <b>${p.fbDrafts} draft${p.fbDrafts === 1 ? '' : 's'}</b>` : ''}</span>` : '<span class="pg-muted">—</span>'}</td>
                <td>${p.sent.length ? `${p.theirStars != null ? `<b style="color:#d97706">${(p.theirStars / 20).toFixed(1)}★</b> ` : ''}<span class="pg-muted">${p.sent.length}×</span>` : '<span class="pg-muted">—</span>'}</td>
                <td>${p.sim ? `${score(p.sim.avg)} <span class="pg-muted">${p.sim.runs}×</span>` : '<span class="pg-muted">—</span>'}</td>
                <td>${p.work ? `${score(p.work.avgScore)} <span class="pg-muted">${p.work.submitted}×</span>` : '<span class="pg-muted">—</span>'}</td>
                <td>${esc(ago(p.lastActive))}</td></tr>
                ${open ? `<tr class="pg-detail"><td colspan="11"><div class="pg-detail-in">${detail(p)}</div></td></tr>` : ''}`; }).join('')}
        </tbody></table>`;
    fitDetails();
}
// The table scrolls sideways; keep the open trainee's detail in the visible part.
function fitDetails() {
    const wrap = document.getElementById('tbl'); if (!wrap) return;
    wrap.querySelectorAll('.pg-detail-in').forEach(el => { el.style.width = Math.max(260, wrap.clientWidth - 28) + 'px'; });
}
window.addEventListener('resize', fitDetails);

function dayFeedback(t) {
    const days = Object.entries((t.feedback || {}).days || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
    if (!days.length) return '<div class="pg-muted">No trainer feedback yet.</div>';
    const ul = (xs) => xs && xs.length ? `<ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    return days.map(([d, f]) => `<details class="pg-fb"><summary><b>Day ${esc(d)}</b> ${rating(f.rating)}
            <span class="pg-muted">${f.status === 'sent' ? `Sent ${esc(date(f.sentAt))}${f.sentBy ? ' by ' + esc(f.sentBy) : ''} · ${f.readAt ? 'read ' + esc(date(f.readAt)) : 'not read yet'}` : '<b>Draft</b> — not sent to the trainee'}</span></summary>
        <div class="body">${f.summary ? `<p>${esc(f.summary)}</p>` : ''}
            ${f.strengths.length ? `<b>Strengths</b>${ul(f.strengths)}` : ''}${f.areasToBuild.length ? `<b>Areas to build</b>${ul(f.areasToBuild)}` : ''}${f.nextDayFocus.length ? `<b>Next focus</b>${ul(f.nextDayFocus)}` : ''}
            ${f.trainerNote ? `<div class="private">🔒 <b>Trainer note</b> (trainee doesn’t see this): ${esc(f.trainerNote)}</div>` : ''}</div></details>`).join('');
}
function tfbCard(f, withName) {
    const r = AREAS.filter(([k]) => f.ratings && f.ratings[k]);
    return `<div class="pg-tfb"><div class="hd">${withName ? `<b>${esc(f.name)}</b>${f.batch ? `<span class="pg-muted">${esc(f.batch)}</span>` : ''}` : ''}
            <span class="pg-prog ${esc(f.program)}">${esc(progLabel(f.program))}</span><span class="pg-muted">${f.dayId ? 'Day ' + f.dayId : 'Program overall'} · ${esc(date(f.at))}</span>
            <span class="pg-st ${f.status === 'new' ? 'Pending' : 'Approved'}">${esc(f.status)}</span></div>
        ${r.length ? `<div class="stars">${r.map(([k, l]) => `<span>${esc(l)} <b>${stars(f.ratings[k])}</b></span>`).join('')}</div>` : ''}
        ${f.good ? `<p><b>Worked well</b><br>${esc(f.good)}</p>` : ''}${f.improve ? `<p><b>Improve</b><br>${esc(f.improve)}</p>` : ''}${f.facilitator ? `<p><b>For the facilitator</b><br>${esc(f.facilitator)}</p>` : ''}</div>`;
}
function detail(p) {
    const enr = p.enrollments.map(t => `<div class="pg-enr">
        <h4><span class="pg-prog ${esc(t.program)}">${esc(progLabel(t.program))}</span><span class="pg-st ${esc(t.status)}">${esc(t.status)}</span>
            <span class="pg-muted">${t.batch ? esc(t.batch) + ' · ' : ''}registered ${esc(date(t.registeredAt))} · last active ${esc(ago(t.lastActive))}</span></h4>
        <div class="pg-days">${Object.entries(t.days).map(([d, x]) => { const f = ((t.feedback || {}).days || {})[d];
            return `<div class="pg-day ${x.done ? 'done' : ''}"><b>Day ${d}</b>${x.done ? '✓ done' : 'not yet'}${x.score != null ? ` · KC ${x.score}%` : ''}${x.task != null ? `<br><span class="pg-muted">Task ${x.task}%</span>` : ''}${f ? `<br>${f.status === 'sent' ? rating(f.rating) : '<span class="pg-muted">feedback draft</span>'}` : ''}</div>`; }).join('')}</div>
        <span class="pg-muted">Knowledge Checks ${t.kcAvg ?? '—'}${t.kcAvg != null ? '%' : ''} · Practice ${t.practiceAvg ?? '—'}${t.practiceAvg != null ? '%' : ''} (${t.practiceDone} done, ${t.practiceRuns} run${t.practiceRuns === 1 ? '' : 's'}) · Roleplay ${t.roleplayAvg ?? '—'}${t.roleplayAvg != null ? `% (${t.roleplayRuns}×)` : ''}</span>
        <h5>Trainer feedback</h5>${dayFeedback(t)}
        ${p.sent.some(f => f.program === t.program) ? `<h5>Feedback they sent about ${esc(progLabel(t.program))}</h5>${p.sent.filter(f => f.program === t.program).map(f => tfbCard(f, false)).join('')}` : ''}
    </div>`).join('');
    const sim = p.sim ? `<div class="pg-enr"><h4>🛠 Portal simulators</h4><span class="pg-muted">${p.sim.runs} run${p.sim.runs === 1 ? '' : 's'} · average ${p.sim.avg ?? '—'}${p.sim.avg != null ? '%' : ''} · last ${esc(ago(p.sim.last))}</span>
        <div class="pg-days">${Object.entries(p.sim.sims).map(([n, c]) => `<div class="pg-day"><b>${esc(n)}</b>${c}×</div>`).join('')}</div></div>` : '';
    const work = p.work ? `<div class="pg-enr"><h4>📝 Portal activities</h4><span class="pg-muted">${p.work.submitted} submitted · ${p.work.graded} graded${p.work.avgScore != null ? ` · average ${p.work.avgScore}` : ''}</span>
        <ul class="pg-work">${p.work.items.map(w => `<li><b>${esc(w.title)}</b> <span class="pg-muted">${esc(w.status)}${w.score != null ? ' · score ' + w.score : ''} · ${esc(date(w.submittedAt))}</span>${w.feedback ? `<br>${esc(w.feedback)}` : ''}</li>`).join('')}</ul></div>` : '';
    return enr + sim + work;
}
function toggle(k) { P.open[k] = !P.open[k]; renderTable(); }

// ---------- feedback trainees sent ----------
function fbRows() {
    const f = P.fb, q = f.q.trim().toLowerCase();
    return (P.data.traineeFeedback || []).filter(x =>
        (f.program === 'all' || x.program === f.program) &&
        (!f.day || (f.day === 'overall' ? !x.dayId : String(x.dayId) === f.day)) &&
        (!f.status || x.status === f.status) &&
        (!q || [x.name, x.batch, x.good, x.improve, x.facilitator].join(' ').toLowerCase().includes(q)));
}
function renderFeedbackPane() {
    const d = P.data, f = P.fb, items = fbRows();
    const maxDays = Math.max(0, ...(d.programs || []).map(p => p.days));
    const statuses = [...new Set((d.traineeFeedback || []).map(x => x.status))].sort();
    const areaRows = AREAS.map(([k, l]) => { const v = items.map(x => x.ratings && x.ratings[k]).filter(Boolean);
        return `<tr><td>${esc(l)}</td><td>${v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) + '★' : '—'} <span class="pg-muted">(${v.length})</span></td></tr>`; }).join('');
    document.getElementById('pane').innerHTML = `
        <div class="pg-filters">
            ${[['all', 'All programs']].concat((d.programs || []).map(p => [p.id, p.label])).map(([k, l]) => `<button class="${f.program === k ? 'on' : ''}" onclick="P.fb.program='${k}';render()">${esc(l)}</button>`).join('')}
            <select onchange="P.fb.day=this.value;render()" aria-label="Day"><option value="">All days</option><option value="overall" ${f.day === 'overall' ? 'selected' : ''}>Program overall</option>${Array.from({ length: maxDays }, (_, i) => `<option value="${i + 1}" ${f.day === String(i + 1) ? 'selected' : ''}>Day ${i + 1}</option>`).join('')}</select>
            <select onchange="P.fb.status=this.value;render()" aria-label="Status"><option value="">All statuses</option>${statuses.map(s => `<option ${f.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
            <input type="search" placeholder="Search names and comments…" value="${esc(f.q)}" oninput="P.fb.q=this.value;renderFeedbackList()">
            <button onclick="exportFeedbackCsv()">⬇ CSV</button>
        </div>
        <div class="pg-cards"><div class="sim-card pg-card"><div class="k">Average rating by area</div><table class="pg-areas">${areaRows}</table></div>
            <div class="sim-card pg-card"><div class="k">Responses</div><div class="v">${items.length}</div><div class="s">${items.filter(x => x.anonymous).length} anonymous · ${items.filter(x => x.status === 'new').length} not yet reviewed in the course</div></div></div>
        <div id="fblist"></div>
        <p class="pg-muted">Mark feedback as reviewed in each course’s Admin → Trainee Feedback.</p>`;
    renderFeedbackList();
}
function renderFeedbackList() {
    const el = document.getElementById('fblist'); if (!el) return;
    const items = fbRows();
    el.innerHTML = items.length ? items.map(x => tfbCard(x, true)).join('') : '<div class="sim-card pg-muted">No feedback matches these filters.</div>';
}

// ---------- CSV ----------
function download(name, lines) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}
const csvq = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
function exportCsv() {
    const head = ['Name', 'Program', 'Batch', 'Status', 'Days done', 'Days total', 'Knowledge Check avg', 'Practice avg', 'Practice done', 'Random task avg', 'Roleplay avg',
        'Trainer feedback sent', 'Trainer feedback drafts', 'Latest trainer rating', 'Feedback they sent', 'Their avg stars', 'Simulator runs', 'Simulator avg', 'Portal activities', 'Portal avg', 'Last active', 'Registered'];
    const lines = [head.map(csvq).join(',')];
    rows().forEach(p => p.enrollments.filter(t => P.program === 'all' || t.program === P.program).forEach(t => {
        const fb = t.feedback || {}, sent = p.sent.filter(f => f.program === t.program), st = starAvg(sent);
        const latest = Object.values(fb.days || {}).filter(f => f.status === 'sent').sort((a, b) => String(b.sentAt || '').localeCompare(String(a.sentAt || '')))[0];
        lines.push([p.name, progLabel(t.program), t.batch, t.status, t.daysDone, t.daysTotal, t.kcAvg, t.practiceAvg, t.practiceDone, t.taskAvg, t.roleplayAvg,
            fb.sent || 0, fb.drafts || 0, latest ? latest.rating : '', sent.length, st == null ? '' : (st / 20).toFixed(1),
            p.sim ? p.sim.runs : '', p.sim ? p.sim.avg : '', p.work ? p.work.submitted : '', p.work ? p.work.avgScore : '', t.lastActive, t.registeredAt].map(csvq).join(','));
    }));
    download('trainee-progress-feedback', lines);
}
function exportFeedbackCsv() {
    const head = ['Date', 'Program', 'Name', 'Batch', 'Day', ...AREAS.map(a => a[1]), 'Worked well', 'Improve', 'For facilitator', 'Status'];
    download('trainee-feedback', [head.map(csvq).join(',')].concat(fbRows().map(x =>
        [x.at, progLabel(x.program), x.name, x.batch, x.dayId || 'Overall', ...AREAS.map(([k]) => (x.ratings || {})[k] || ''), x.good, x.improve, x.facilitator, x.status].map(csvq).join(','))));
}

async function load() {
    try {
        const res = await fetch('/api/program-progress', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) { window.location.replace('/admin-login.html'); return; }
        if (!res.ok || !data.success) throw new Error(data.error || `Couldn’t load the records (${res.status}).`);
        P.data = data; render();
    } catch (e) {
        document.getElementById('app').innerHTML = `<div class="sim-card"><div class="sim-error">${esc(e.message)}</div></div>`;
    }
}
document.addEventListener('DOMContentLoaded', () => load());

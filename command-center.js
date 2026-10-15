// Trainer Command Center (/command-center.html) — the trainer's single screen.
//
// One read of /api/program-progress with no ?program= gives every program at once:
// the course KV trainee records (days done, Knowledge Checks, practice, tasks,
// roleplays, trainer feedback) merged with D1's simulator results, portal
// activity submissions and calendaring submissions. /api/leaderboard adds the
// ranking. Both are admin-only on the server, so this page never sees trainee data
// without a trainer's session.
//
// The API reads course KV under a fixed operation budget and, when there is more
// data than one request can read, answers partial:true with a note naming what it
// skipped. Every number here is therefore "of what was read", and the note is shown
// rather than hidden — a metrics bar that quietly undercounts is worse than one that
// says it is incomplete. The per-program page (/progress.html) reads one program at
// a time and stays well inside the budget, so it is the place to go for certainty.
//
// A rubric is whatever that program actually grades: this page does not invent a
// shared mark scheme. It lists the rubrics a trainee has a score in, each on its own
// row with where it came from, and the overall is the mean of those rubrics, so every
// rubric counts once however many items it holds.
const CC = {
    data: null, lb: null, err: null,
    program: null, batch: null, trainee: null,
    me: (() => { try { const r = sessionStorage.getItem('LSH_SESSION_V1') || localStorage.getItem('LSH_SESSION_V1'); return r && r !== 'null' ? JSON.parse(r) : null; } catch (e) { return null; } })()
};
const PROGRAM_ORDER = ['ft', 'eapa', 'cm', 'pd', 'md'];   // keep in step with progress-records.js and attendance.html
const STALE_DAYS = 7;        // no activity for this long and a trainee is flagged
const AT_RISK = 70;          // an overall under this is flagged (the courses' own pass mark)

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameKey = (s) => String(s || '').split(' · ')[0].trim().toLowerCase().replace(/\s+/g, ' ');
const avg = (xs) => { xs = (xs || []).filter(v => v != null && isFinite(v)); return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null; };
const pct = (n) => n == null ? '—' : n + '%';
const batchName = (b) => b ? String(b) : 'No batch';
function ago(iso) {
    if (!iso) return 'never';
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 2) return 'just now'; if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    const d = Math.round(h / 24); return d < 60 ? d + ' d ago' : new Date(iso).toLocaleDateString();
}
const staleDays = (iso) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : null;
const progLabel = (id) => { const p = ((CC.data || {}).programs || []).find(x => x.id === id); return p ? p.label : id; };
const bar = (n) => `<div class="cc-bar ${n == null ? '' : n >= 85 ? 'ok' : n < AT_RISK ? 'low' : ''}"><i style="width:${n == null ? 0 : Math.max(0, Math.min(100, n))}%"></i></div>`;

// ---------- the trainees this page works with ----------
// Approved trainees of a program, newest activity first. Archived batches live in
// their snapshots (/progress.html opens those), and rejected records are not people
// a trainer has anything to do today.
function trainees(program, batch) {
    return ((CC.data || {}).trainees || [])
        .filter(t => t.status === 'Approved')
        .filter(t => !program || t.program === program)
        .filter(t => batch == null || (t.batch || '') === batch)
        .sort((a, b) => String(b.lastActive || '').localeCompare(String(a.lastActive || '')));
}
const batchesOf = (program) => [...new Set(trainees(program).map(t => t.batch || ''))]
    .sort((a, b) => String(b).localeCompare(String(a), undefined, { numeric: true }));

// ---------- one trainee's rubrics, normalized ----------
// Each entry is a rubric the program actually scored, with where the number came
// from, so a trainer can see the per-program rubric metrics and the aggregate on the
// same screen. A rubric with nothing in it is left out rather than shown as a zero.
function rubrics(t) {
    const key = nameKey(t.name), d = CC.data || {};
    const sim = ((d.simulators || {}).byName || {})[key] || null;
    const work = ((d.portalWork || {}).byName || {})[key] || null;
    const cal = (((d.calsim || {}).byName || {})[key] || {})[t.program] || null;
    const calScores = cal ? cal.weeks.map(w => w.score != null ? w.score : w.auto).filter(v => v != null) : [];
    const rows = [
        { name: 'Knowledge Checks', pct: t.kcAvg, src: 'the course: each lesson’s best or the trainer’s final score' },
        { name: 'Practice Lab', pct: t.practiceAvg, src: t.practiceRuns ? `the course: ${t.practiceRuns} run${t.practiceRuns === 1 ? '' : 's'}` : 'the course' },
        { name: 'Surprise tasks', pct: t.taskAvg, src: 'the course: the trainer’s task scores' },
        { name: 'Roleplays', pct: t.roleplayAvg, src: t.roleplayRuns ? `the course: ${t.roleplayRuns} graded` : 'the course' },
        { name: 'Portal simulators', pct: sim ? sim.avg : null, src: sim ? `the Portal: ${sim.runs} run${sim.runs === 1 ? '' : 's'}` : 'the Portal' },
        { name: 'Activities &amp; submissions', pct: work ? work.avgScore : null, src: work ? `the Portal: ${work.graded} of ${work.submitted} graded` : 'the Portal' },
        { name: 'Calendaring', pct: avg(calScores), src: cal ? `the Portal: ${cal.weeks.length} submission${cal.weeks.length === 1 ? '' : 's'}` : 'the Portal' }
    ].filter(r => r.pct != null);
    return rows;
}
const overall = (t) => avg(rubrics(t).map(r => r.pct));
const completion = (t) => t.daysTotal ? Math.round(t.daysDone / t.daysTotal * 100) : null;

// ---------- the top metrics bar ----------
function metrics() {
    const all = trainees(null, null), d = CC.data || {};
    const batches = new Set(all.map(t => t.program + '|' + (t.batch || '')));
    const progs = new Set(all.map(t => t.program));
    const pending = ((d.trainees || []).filter(t => t.status === 'Pending')).length;
    const week = Date.now() - STALE_DAYS * 864e5;
    const active = all.filter(t => t.lastActive && new Date(t.lastActive).getTime() > week).length;
    const nFocus = focusItems().reduce((a, f) => a + f.n, 0);
    const tiles = [
        ['Active trainees', all.length, `${active} active in ${STALE_DAYS} days${pending ? ` · ${pending} awaiting approval` : ''}`],
        ['Programs', progs.size, `${batches.size} batch${batches.size === 1 ? '' : 'es'} running`],
        ['Average score', pct(avg(all.map(overall))), 'every rubric, every program'],
        ['Completion', pct(avg(all.map(completion))), 'lessons finished across batches'],
        ['At risk', all.filter(t => { const o = overall(t); return o != null && o < AT_RISK; }).length, `under ${AT_RISK}% overall`],
        ['Needs you', nFocus, 'actions in the focus list', true]
    ];
    document.getElementById('ccMetrics').innerHTML = tiles.map(([k, v, s, f]) =>
        `<div class="cc-metric${f ? ' focus' : ''}"><div class="k">${k}</div><div class="v">${v == null ? '—' : v}</div><div class="s">${s}</div></div>`).join('');
    const as = d.generatedAt ? `read ${ago(d.generatedAt)}` : '';
    document.getElementById('ccAsOf').textContent = as;
}

// ---------- FOCUS and action engine ----------
// Priority-ranked, and ranked by what it costs to leave it: 1 blocks a trainee
// outright, 2 is work a trainee is waiting on, 3 is a cohort warning to read.
// Every item is built from a real record, and each one links to the tool that
// clears it rather than describing it.
function focusItems() {
    const d = CC.data || {}, out = [];
    const all = trainees(null, null);
    const pending = (d.trainees || []).filter(t => t.status === 'Pending');
    if (pending.length) out.push({ p: 1, n: pending.length, t: 'Trainees awaiting approval', w: `${[...new Set(pending.map(t => progLabel(t.program)))].join(', ')} — they cannot start until you approve them`, href: '/programs.html' });

    const drafts = all.reduce((a, t) => a + ((t.feedback || {}).drafts || 0), 0);
    if (drafts) out.push({ p: 2, n: drafts, t: 'Feedback drafts to finish', w: 'written but not sent, so the trainee has not read it', href: '/progress.html' });

    const ungraded = Object.values(((d.portalWork || {}).byName || {})).reduce((a, w) => a + Math.max(0, (w.submitted || 0) - (w.graded || 0)), 0);
    if (ungraded) out.push({ p: 2, n: ungraded, t: 'Submissions to grade', w: 'activity work handed in and not yet scored', href: '/core.html' });

    // A calendaring week with an automated % but no trainer score is waiting on a trainer.
    let cal = 0;
    Object.values(((d.calsim || {}).byName || {})).forEach(byProg => Object.values(byProg || {}).forEach(p => (p.weeks || []).forEach(w => { if (w.score == null) cal++; })));
    if (cal) out.push({ p: 2, n: cal, t: 'Calendars to score', w: 'submitted for evaluation, automated check done, your score outstanding', href: '/simulators/gcal-review.html' });

    const risk = all.filter(t => { const o = overall(t); return o != null && o < AT_RISK; });
    if (risk.length) out.push({ p: 3, n: risk.length, t: `Trainees under ${AT_RISK}%`, w: risk.slice(0, 3).map(t => t.name).join(', ') + (risk.length > 3 ? ` and ${risk.length - 3} more` : ''), pick: risk[0] });

    const stale = all.filter(t => { const s = staleDays(t.lastActive); return s == null || s >= STALE_DAYS; });
    if (stale.length) out.push({ p: 3, n: stale.length, t: `Quiet for ${STALE_DAYS}+ days`, w: stale.slice(0, 3).map(t => `${t.name} (${ago(t.lastActive)})`).join(', ') + (stale.length > 3 ? ` and ${stale.length - 3} more` : ''), pick: stale[0] });

    const unread = all.reduce((a, t) => a + ((t.feedback || {}).unread || 0), 0);
    if (unread) out.push({ p: 3, n: unread, t: 'Feedback not opened yet', w: 'sent, but the trainee has not read it', href: '/progress.html' });

    return out.sort((a, b) => a.p - b.p || b.n - a.n);
}
function renderFocus() {
    const items = focusItems(), box = document.getElementById('ccFocus');
    document.getElementById('ccFocusN').textContent = items.length ? items.reduce((a, f) => a + f.n, 0) : '';
    if (!items.length) { box.innerHTML = `<div class="cc-clear">✓ Nothing waiting on you: every trainee approved, every submission graded, every draft sent.</div>`; return; }
    box.innerHTML = items.map((f, i) => {
        const body = `<div class="t">${esc(f.t)} <b>${f.n}</b></div><div class="w">${f.w}</div>`;
        return f.href ? `<a class="cc-act p${f.p}" href="${esc(f.href)}">${body}</a>`
            : `<button class="cc-act p${f.p}" onclick="ccFocusPick(${i})">${body}</button>`;
    }).join('');
}
// A cohort warning has no tool to open: it selects the first trainee it names, so
// the trainer lands on that scorecard instead of hunting for them in the cascade.
function ccFocusPick(i) {
    const f = focusItems()[i];
    if (!f || !f.pick) return;
    CC.program = f.pick.program; CC.batch = f.pick.batch || ''; CC.trainee = f.pick.id;
    render();
}

// ---------- ranking and tier ----------
const tierOf = (n) => n == null ? ['none', 'Unranked'] : n >= 90 ? ['gold', 'Gold'] : n >= 80 ? ['silver', 'Silver'] : n >= AT_RISK ? ['bronze', 'Bronze'] : ['none', 'Building'];
function renderRank() {
    const box = document.getElementById('ccRank');
    const mine = CC.me ? (CC.me.fullName || CC.me.username || 'Trainer') : 'Trainer';
    const acts = focusItems().reduce((a, f) => a + f.n, 0);
    const you = `<div class="cc-you"><b>${esc(mine)}</b> · trainer${CC.me && CC.me.username ? ' · ' + esc(CC.me.username) : ''}
        <div class="cc-muted" style="margin-top:3px;">${acts ? `${acts} action${acts === 1 ? '' : 's'} outstanding` : 'nothing outstanding'} · ${trainees(null, null).length} trainees in your view</div></div>`;
    // The leaderboard is the Portal's own ranking (graded activity submissions). Where
    // it has nothing yet, the trainees are ranked by their overall across every rubric.
    const lb = (CC.lb && CC.lb.leaderboard) || (CC.lb && CC.lb.trainees) || null;
    let rows;
    if (lb && lb.length) {
        rows = lb.slice(0, 25).map((r, i) => ({ rank: i + 1, name: r.fullName || r.name || r.username, batch: r.batchId || r.batch || '', score: r.averageScore != null ? Math.round(r.averageScore) : (r.avgScore != null ? Math.round(r.avgScore) : null) }));
    } else {
        rows = trainees(null, null).map(t => ({ name: t.name, batch: t.batch, score: overall(t) }))
            .filter(r => r.score != null).sort((a, b) => b.score - a.score).slice(0, 25).map((r, i) => ({ ...r, rank: i + 1 }));
    }
    if (!rows.length) { box.innerHTML = you + `<div class="cc-empty">No graded work yet, so there is nothing to rank.</div>`; return; }
    box.innerHTML = you + `<table class="cc-rank"><thead><tr><th></th><th>Trainee</th><th>Batch</th><th>Score</th><th>Tier</th></tr></thead><tbody>${
        rows.map(r => { const [cls, label] = tierOf(r.score);
            return `<tr><td class="r">${r.rank}</td><td>${esc(r.name)}</td><td class="cc-src">${esc(batchName(r.batch))}</td><td><b>${pct(r.score)}</b></td><td><span class="cc-tier ${cls}">${label}</span></td></tr>`;
        }).join('')}</tbody></table>`;
}

// ---------- the cascade ----------
function renderCascade() {
    const d = CC.data || {};
    const progs = PROGRAM_ORDER.map(id => (d.programs || []).find(p => p.id === id)).filter(Boolean)
        .concat((d.programs || []).filter(p => !PROGRAM_ORDER.includes(p.id)));
    const progCol = progs.map(p => {
        const ts = trainees(p.id), o = avg(ts.map(overall));
        return `<button class="cc-pick ${CC.program === p.id ? 'on' : ''}" onclick="ccPickProgram('${esc(p.id)}')">${esc(p.label)}
            <span class="m">${ts.length} trainee${ts.length === 1 ? '' : 's'} · ${batchesOf(p.id).length} batch${batchesOf(p.id).length === 1 ? '' : 'es'} · ${pct(o)}</span></button>`;
    }).join('') || `<div class="cc-empty">No programs.</div>`;

    let batchCol = `<div class="cc-empty">Pick a program.</div>`;
    if (CC.program) {
        const bs = batchesOf(CC.program);
        batchCol = bs.map(b => {
            const ts = trainees(CC.program, b), o = avg(ts.map(overall));
            const flag = ts.some(t => { const v = overall(t); return v != null && v < AT_RISK; });
            return `<button class="cc-pick ${CC.batch === b ? 'on' : ''}${flag ? ' flag' : ''}" onclick="ccPickBatch('${esc(b)}')">${esc(batchName(b))}
                <span class="m">${ts.length} trainee${ts.length === 1 ? '' : 's'} · ${pct(o)} avg${flag ? ' · needs attention' : ''}</span></button>`;
        }).join('') || `<div class="cc-empty">No active batches.</div>`;
    }

    let traineeCol = `<div class="cc-empty">Pick a batch.</div>`;
    if (CC.program && CC.batch != null) {
        const ts = trainees(CC.program, CC.batch);
        traineeCol = ts.map(t => {
            const o = overall(t), flag = o != null && o < AT_RISK;
            return `<button class="cc-pick ${CC.trainee === t.id ? 'on' : ''}${flag ? ' flag' : ''}" onclick="ccPickTrainee('${esc(t.id)}')">${esc(t.name)}
                <span class="m">${pct(o)} · ${t.daysDone}/${t.daysTotal} lessons · ${ago(t.lastActive)}</span></button>`;
        }).join('') || `<div class="cc-empty">No trainees in this batch.</div>`;
    }

    document.getElementById('ccCascade').innerHTML = `
        <div class="cc-list"><h3>Program</h3><div>${progCol}</div></div>
        <div class="cc-list"><h3>Batch</h3><div>${batchCol}</div></div>
        <div class="cc-list"><h3>Trainee</h3><div>${traineeCol}</div></div>`;
}
function ccPickProgram(id) { CC.program = id; CC.batch = null; CC.trainee = null; render(); }
function ccPickBatch(b) { CC.batch = b; CC.trainee = null; render(); }
function ccPickTrainee(id) { CC.trainee = id; render(); }

// ---------- the centralized scorecard ----------
function renderScorecard() {
    const box = document.getElementById('ccScorecard');
    if (!CC.trainee) {
        box.innerHTML = `<div class="cc-empty">Pick a trainee for their scorecard: every rubric their program grades, and the overall across all of them.</div>`;
        return;
    }
    const t = trainees(CC.program, CC.batch).find(x => x.id === CC.trainee);
    if (!t) { box.innerHTML = `<div class="cc-empty">That trainee is no longer in this batch.</div>`; return; }
    const rows = rubrics(t), o = overall(t);
    const [cls, tier] = tierOf(o);
    const fb = t.feedback || {};
    box.innerHTML = `
        <div class="cc-sc-hd">
            <h3>${esc(t.name)}</h3>
            <span class="cc-tier ${cls}">${tier}</span>
            <span class="cc-src">${esc(progLabel(t.program))} · ${esc(batchName(t.batch))} · ${t.daysDone}/${t.daysTotal} lessons · active ${ago(t.lastActive)}</span>
            <span class="ov">Overall<b>${pct(o)}</b>${rows.length} rubric${rows.length === 1 ? '' : 's'}</span>
        </div>
        ${rows.length ? `<table class="cc-rub"><thead><tr><th>Rubric</th><th></th><th>Score</th><th>Where it comes from</th></tr></thead><tbody>${
            rows.map(r => `<tr><td class="n">${r.name}</td><td>${bar(r.pct)}</td><td class="p">${pct(r.pct)}</td><td class="cc-src">${esc(r.src)}</td></tr>`).join('')
        }</tbody></table>` : `<div class="cc-empty">Nothing graded yet.</div>`}
        <div class="cc-muted" style="margin-top:9px;">
            Trainer feedback: ${fb.sent || 0} sent${fb.drafts ? ` · <b style="color:var(--cc-focus)">${fb.drafts} draft${fb.drafts === 1 ? '' : 's'}</b>` : ''}${fb.unread ? ` · ${fb.unread} unread` : ''}
            · <a class="cc-open" href="/progress.html">Open in Monitoring &amp; Feedback ↗</a>
        </div>`;
}

// ---------- render and load ----------
function render() {
    if (CC.err) {
        document.getElementById('ccCascade').innerHTML = `<div class="cc-err">${esc(CC.err)}</div>`;
        document.getElementById('ccMetrics').innerHTML = '';
        document.getElementById('ccFocus').innerHTML = ''; document.getElementById('ccRank').innerHTML = '';
        return;
    }
    if (!CC.data) return;
    const d = CC.data;
    const notes = [];
    if (d.connected === false) notes.push(d.note || 'Course data is not connected yet.');
    else if (d.partial && d.note) notes.push(d.note + ' Open Monitoring &amp; Feedback for one program at a time to see all of it.');
    document.getElementById('ccNote').innerHTML = notes.map(n => `<div class="cc-note">${n}</div>`).join('');
    metrics(); renderFocus(); renderRank(); renderCascade(); renderScorecard();
}
async function load() {
    try {
        const [prog, lb] = await Promise.all([
            fetch('/api/program-progress', { credentials: 'same-origin' }).then(r => r.json()).catch(e => ({ success: false, error: String(e.message || e) })),
            fetch('/api/leaderboard', { credentials: 'same-origin' }).then(r => r.json()).catch(() => null)
        ]);
        if (!prog || prog.success === false) { CC.err = (prog && prog.error) || 'Could not read the programs.'; render(); return; }
        CC.data = prog; CC.lb = lb;
        // Open on the program with the most waiting, so the screen is useful before a click.
        if (!CC.program) {
            const counts = {};
            trainees(null, null).forEach(t => { const f = ((t.feedback || {}).drafts || 0) + (overall(t) != null && overall(t) < AT_RISK ? 1 : 0); counts[t.program] = (counts[t.program] || 0) + f; });
            CC.program = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || (trainees(null, null)[0] || {}).program || 'ft';
        }
        render();
    } catch (e) { CC.err = String(e.message || e); render(); }
}
load();

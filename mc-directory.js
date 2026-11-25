/* LSH Nexus — Master Control: 🧭 Dashboard & Directory, and the ⓘ How to use pop-outs (core.html, admins only).
   - #ov-directory: every admin feature in one table, grouped by job (the same groups and order as the admin menu on the left),
     with what it is for, its live status (mirrored from the KPI strip and the menu badges that app.js / portal.js keep current),
     an Open button and a ⓘ pop-out with step-by-step instructions.
   - Every Master Control panel and every admin workspace view gets a bar at its top: its name, ⓘ How to use, and 🧭 Dashboard.
   To add a feature: add a row to FEATURES (and a menu entry in core.html's #admin-nav, under the same group). */
(function () {
    const GROUPS = [
        { id: 'people', title: '1 · People & Access', note: 'who can sign in, and what they can open' },
        { id: 'grading', title: '2 · Grading & Progress', note: 'scores, feedback and attendance' },
        { id: 'content', title: '3 · Training Content', note: 'what trainees learn from' },
        { id: 'monitor', title: '4 · Monitoring & Comms', note: 'who is on, what happened, telling everyone' },
        { id: 'system', title: '5 · System', note: 'site-wide switches' }
    ];
    // go: a Master Control panel (mc), a workspace view (view), a function name (fn) or a page (href)
    const FEATURES = [
        { g: 'people', id: 'registrations', icon: '📝', name: 'Log-in Approvals', go: { mc: 'registrations' }, stat: () => count('admin-stat-pending', 'waiting', true),
          what: 'New sign-ups waiting. Approving issues the Batch ID and moves the account to Users.',
          steps: ['Open Log-in Approvals: trainers are listed first, then trainees by the batch they will join (oldest first).', 'Check the name, email and training start date.', 'Press Approve (the Batch ID is issued) or Deny.', 'Need an account for someone? Use + Create account at the top right.'] },
        { g: 'people', id: 'access-requests', icon: '🙋', name: 'Access Requests', go: { fn: 'openAccessRequests' }, stat: () => count('access-req-badge-side', 'waiting', true),
          what: 'Trainees asking to open a program or tool.',
          steps: ['Open Access Requests: it opens Program Access with the waiting requests.', 'Each row names the trainee, batch and program.', 'Press Approve to open the program for them, or Deny.', 'The trainee’s LSH Academy Index updates on its own within seconds.'] },
        { g: 'people', id: 'program-access', icon: '🔑', name: 'Program Access', go: { mc: 'program-access' }, stat: () => '',
          what: 'One program for one trainee: Grant, ⏸ Suspend, ▶ Restore, Revoke.',
          steps: ['Search for the trainee by name, username or batch.', 'Grant opens a program; ⏸ Suspend pauses it (nothing removed); ▶ Restore gives back what they had; Revoke closes it (they can request again).', 'Suspending or revoking takes them off that program’s sheets and scorecards; granting brings them back.', 'For the whole account at once, use Users & Accounts instead.'] },
        { g: 'people', id: 'users', icon: '👥', name: 'Users & Accounts', go: { mc: 'users' }, stat: () => count('admin-stat-total-users', 'accounts'),
          what: 'Whole accounts: edit details, suspend, restore or revoke.',
          steps: ['Trainers are listed first, then one table per batch (click a batch to open it).', 'Edit changes Batch ID, name, email, username or password.', 'Suspend blocks sign-in for now; Restore undoes it.', 'Revoke removes the trainee from every program (records are filed to the batch folder first).'] },
        { g: 'people', id: 'referrals', icon: '🤝', name: 'Referrals', go: { href: '/referrals.html' }, stat: () => '',
          what: 'People referred from “Got a referral?” on the home page, with their CVs.',
          steps: ['Open Referrals.', 'Read each referral and download the CV.', 'Follow up outside the portal, then mark it as handled.'] },
        { g: 'grading', id: 'admin-grades', icon: '📊', name: 'Check & Release Grades', go: { view: 'admin-grades' }, stat: () => count('admin-stat-submissions', 'submissions'),
          what: 'Grade trainee submissions, then release the grades to trainees.',
          steps: ['Open Check & Release Grades.', 'Pick a submission in the table and press Grade.', 'Enter the score and feedback, then save.', 'Release the grades when ready: trainees see them under Grades & Submissions.'] },
        { g: 'grading', id: 'progress', icon: '📈', name: 'Progress & Feedback', go: { href: '/progress.html' }, stat: () => '',
          what: 'Every trainee’s progress and feedback, in every program.',
          steps: ['Open Progress & Feedback (its own page).', 'Choose a program and a batch.', 'Open a trainee to see their scores and leave feedback.'] },
        { g: 'grading', id: 'attendance', icon: '🕘', name: 'Attendance', go: { href: '/attendance.html' }, stat: () => '',
          what: 'Take and review attendance, batch by batch. The one place it is taken.',
          steps: ['Open Attendance (its own page).', 'Choose the program, batch and day.', 'Mark each trainee, then save.'] },
        { g: 'content', id: 'admin-activities', icon: '📋', name: 'Lesson Decks & Activities', go: { view: 'admin-activities' }, stat: () => count('admin-stat-total-activities', 'published'),
          what: 'Add, publish and archive lesson decks and activities.',
          steps: ['Open Lesson Decks & Activities.', 'Press Add New Activity, fill in the title, instructions and files.', 'Publish it to show it to trainees; Archive hides an old one without deleting it.'] },
        { g: 'content', id: 'admin-lectures', icon: '🎬', name: 'Manage Lectures', go: { view: 'admin-lectures' }, stat: () => '',
          what: 'Embed and manage recorded lectures.',
          steps: ['Open Manage Lectures.', 'Press Embed Recorded Lecture and paste the video link.', 'Give it a title; trainees see it under Recorded Lectures.'] },
        { g: 'content', id: 'index', icon: '🎓', name: 'LSH Academy Index', go: { href: '/programs.html' }, stat: () => '',
          what: 'Every program and track, as trainees see it. Approve waiting requests at the top.',
          steps: ['Open LSH Academy Index.', 'Enter Program opens a program as an admin.', '👁 Switch view shows it exactly as a trainee sees it.'] },
        { g: 'content', id: 'atlas', icon: '📚', name: 'LSH Atlas', go: { href: '/api/launch?tool=kb' }, stat: () => '',
          what: 'The knowledge base: review VA posts and manage articles.',
          steps: ['Open LSH Atlas (you are signed in from here).', 'Review posts waiting for approval.', 'Edit or publish articles.'] },
        { g: 'monitor', id: 'monitoring', icon: '🟢', name: 'Who’s Online', go: { mc: 'monitoring' }, stat: () => count('admin-stat-online', 'online'),
          what: 'Who is signed in right now, what they are viewing, and the server logs.',
          steps: ['Trainers first, then one table per batch.', '“Away” means no check-in for 90 seconds (tab closed or asleep).', 'Press ↻ Refresh to reload; Server Logs shows every sign-in and sign-out.'] },
        { g: 'monitor', id: 'activity-logs', icon: '🗂', name: 'Activity Logs', go: { mc: 'activity-logs' }, stat: () => '',
          what: 'Audit trail: uploads and gradings (trainers), submissions (trainees).',
          steps: ['Shows the latest 100, grouped by trainer and batch.', 'Search by name, username, batch or activity title to look through all of them.', 'Expand all / Collapse all opens or closes every group.'] },
        { g: 'monitor', id: 'announce', icon: '📢', name: 'Broadcast & Ping', go: { mc: 'announce' }, stat: () => text('ov-alert-state', 'None Active'),
          what: 'Ticker announcement, full-screen alert, or an instant ping.',
          steps: ['Announcement: type it and press 📢 Broadcast (it scrolls in the top bar).', 'Alert: covers every screen until stopped or expired. Set text, color, duration, then ⚠ Set Alert.', 'Ping: pick users (or All) and send a toast with a loud tone.'] },
        { g: 'monitor', id: 'ai-usage', icon: '🤖', name: 'AI Usage', go: { href: '/api/ai-usage' }, stat: () => '',
          what: 'How much the AI reviews are being used.',
          steps: ['Open AI Usage.', 'Read usage per day and per feature.'] },
        { g: 'system', id: 'access', icon: '🔒', name: 'Site Lock & Access Control', go: { mc: 'access' }, stat: () => [text('ov-lock-state', ''), text('ov-pause-state', '')].filter(Boolean).join(' · '),
          what: 'Pause activity or lock the whole site (Master Account only for Lock).',
          steps: ['Open Site Lock, then 🔒 Open Access Control.', 'Pause stops activity for everyone; Resume brings it back.', 'Lock closes the site (Master Account only); Unlock opens it.'] },
        { g: 'system', id: 'password', icon: '🔐', name: 'Admin Password Check', go: { href: '/api/admin-password-check' }, stat: () => '',
          what: 'Check the admin accounts’ passwords.',
          steps: ['Open Admin Password Check.', 'Follow what it reports for any weak or reused password.'] },
        { g: 'system', id: 'overview', icon: '🧭', name: 'Dashboard & Directory', go: { mc: 'overview' }, stat: () => '', hidden: true,
          what: 'Live counts and every admin feature in one table.',
          steps: ['Read the live counts on the top line.', 'Find a feature in the table (or type in Find a feature).', 'Open goes there; ⓘ shows how to use it.'] }
    ];
    const byId = (id) => FEATURES.find(f => f.id === id);
    const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const val = (id) => { const el = document.getElementById(id); return el ? el.textContent.trim() : ''; };
    function count(id, word, hot) { const v = val(id); if (v === '' || v === '0') return hot ? '0 ' + word : (v ? v + ' ' + word : ''); return hot ? `<span class="hot">${esc(v)} ${word}</span>` : esc(v) + ' ' + word; }
    function text(id, dflt) { return esc(val(id) || dflt); }

    function open(f) {
        const go = f.go || {};
        if (go.mc && typeof mcGo === 'function') mcGo(go.mc);
        else if (go.view && typeof switchView === 'function') { if (typeof exitMasterControl === 'function') exitMasterControl(); switchView(go.view); }
        else if (go.fn && typeof window[go.fn] === 'function') window[go.fn]();
        else if (go.href) location.href = go.href;
    }

    /* ---------- the directory table ---------- */
    function paintDirectory() {
        const box = document.getElementById('ov-directory'); if (!box) return;
        const q = ((document.getElementById('ov-dir-find') || {}).value || '').trim().toLowerCase();
        const match = (f) => !q || (f.name + ' ' + f.what + ' ' + f.steps.join(' ')).toLowerCase().includes(q);
        const body = GROUPS.map(g => {
            const rows = FEATURES.filter(f => f.g === g.id && !f.hidden && match(f));
            if (!rows.length) return '';
            return `<tr class="ov-grp"><td colspan="4">${esc(g.title)}<small>${esc(g.note)}</small></td></tr>` + rows.map(f => `<tr class="ov-row">
                <td class="ov-feat">${f.icon} ${esc(f.name)}</td><td class="ov-what">${esc(f.what)}</td><td class="ov-stat" data-stat="${f.id}">${f.stat() || '<span style="color:#94a3b8">—</span>'}</td>
                <td class="ov-act"><button type="button" class="ov-open" data-open="${f.id}">Open →</button><button type="button" class="ov-info" data-guide="${f.id}" aria-expanded="false" aria-label="How to use ${esc(f.name)}">ⓘ</button></td></tr>`).join('');
        }).join('');
        box.innerHTML = body ? `<table class="ov-dir"><thead><tr><th style="width:22%">Feature</th><th>What it is for</th><th style="width:14%">Live status</th><th style="width:150px;text-align:right">Go</th></tr></thead><tbody>${body}</tbody></table>`
            : '<p style="color:#475569;font-size:14px">No feature matches that. Try another word, like grades, revoke or alert.</p>';
    }
    function refreshStats() { document.querySelectorAll('#ov-directory [data-stat]').forEach(td => { const f = byId(td.dataset.stat); const h = (f && f.stat()) || '<span style="color:#94a3b8">—</span>'; if (td.innerHTML !== h) td.innerHTML = h; }); }

    /* ---------- the ⓘ pop-out ---------- */
    let pop = null, popFor = null;
    function closeGuide() { if (!pop) return; pop.classList.remove('open'); if (popFor) { popFor.setAttribute('aria-expanded', 'false'); popFor = null; } }
    function showGuide(f, anchor) {
        if (!pop) { pop = document.createElement('div'); pop.id = 'mc-guide-pop'; pop.setAttribute('role', 'dialog'); document.body.appendChild(pop); }
        if (popFor === anchor && pop.classList.contains('open')) { closeGuide(); return; }
        closeGuide();
        const g = GROUPS.find(x => x.id === f.g);
        pop.setAttribute('aria-label', 'How to use ' + f.name);
        pop.innerHTML = `<button type="button" class="x" data-guide-close aria-label="Close">×</button><h4>${f.icon} ${esc(f.name)}</h4>
            <div class="where">Menu: ${esc(g ? g.title : '')} → ${esc(f.name)}</div><p>${esc(f.what)}</p>
            <ol>${f.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
            ${f.id === currentPane() ? '' : `<button type="button" class="ov-open" data-open="${f.id}">Open ${esc(f.name)} →</button>`}`;
        pop.classList.add('open');
        const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
        let left = Math.min(window.innerWidth - w - 12, Math.max(12, r.right - w));
        let top = r.bottom + 8; if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 8);
        pop.style.left = left + 'px'; pop.style.top = top + 'px';
        anchor.setAttribute('aria-expanded', 'true'); popFor = anchor;
        const first = pop.querySelector('.x'); if (first) first.focus();
    }

    /* ---------- a bar on top of every panel: its name, ⓘ How to use, 🧭 Dashboard ---------- */
    function currentPane() { const p = document.querySelector('.mc-pane.active'); return p ? p.id.replace('admin-dash-', '') : ''; }
    function addBars() {
        const targets = Array.from(document.querySelectorAll('.mc-pane')).map(p => [p, p.id.replace('admin-dash-', '')])
            .concat(['admin-grades', 'admin-activities', 'admin-lectures'].map(v => [document.getElementById('view-' + v), v]));
        targets.forEach(([el, id]) => {
            const f = byId(id); if (!el || !f || el.querySelector(':scope > .mc-pane-bar')) return;
            const bar = document.createElement('div'); bar.className = 'mc-pane-bar';
            bar.innerHTML = `<h3>${f.icon} ${esc(f.name)}</h3><button type="button" class="mc-howto" data-guide="${f.id}" aria-expanded="false">ⓘ How to use</button>${id === 'overview' ? '' : '<button type="button" class="mc-home" data-open="overview">🧭 Dashboard</button>'}`;
            el.insertBefore(bar, el.firstChild);
        });
    }

    document.addEventListener('click', (ev) => {
        const o = ev.target.closest('[data-open]'); if (o) { const f = byId(o.dataset.open); closeGuide(); if (f) open(f); return; }
        const g = ev.target.closest('[data-guide]'); if (g) { const f = byId(g.dataset.guide); if (f) showGuide(f, g); return; }
        if (ev.target.closest('[data-guide-close]')) { const a = popFor; closeGuide(); if (a) a.focus(); return; }
        if (pop && pop.classList.contains('open') && !ev.target.closest('#mc-guide-pop')) closeGuide();
    });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && pop && pop.classList.contains('open')) { const a = popFor; closeGuide(); if (a) a.focus(); } });
    window.addEventListener('resize', closeGuide);
    document.addEventListener('scroll', closeGuide, true);

    function init() {
        paintDirectory(); addBars();
        const find = document.getElementById('ov-dir-find'); if (find) find.addEventListener('input', paintDirectory);
        // the live status column follows the KPI strip and the menu badges as app.js / portal.js update them
        const watch = ['admin-stat-pending', 'access-req-badge-side', 'admin-stat-total-users', 'admin-stat-submissions', 'admin-stat-total-activities', 'admin-stat-online', 'ov-alert-state', 'ov-lock-state', 'ov-pause-state'];
        if (typeof MutationObserver === 'function') {
            const mo = new MutationObserver(refreshStats);
            watch.forEach(id => { const el = document.getElementById(id); if (el) mo.observe(el, { childList: true, characterData: true, subtree: true }); });
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    window.MCDirectory = { FEATURES, GROUPS, repaint: paintDirectory };
})();

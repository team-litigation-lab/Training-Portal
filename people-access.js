// 👥 People & Access, one entry: Master Control's menu used to list Log-in Approvals, Program Access & Requests and Users &
// Accounts as three entries for one job. They are now one entry (core.html, data-mc="people") that opens where the work is
// (access requests waiting first, then log-ins waiting, else the 🧭 Dashboard & Directory, which is its first tab), and each of the three panels carries the same
// strip of tabs across its top to move between them. Users & Accounts is no longer a panel of its own: its list (every login,
// with Edit, Suspend, Restore and Revoke for the whole account) and its wipe-revoked button sit at the foot of Program Access &
// Requests as 👥 Accounts, so who can open what and the accounts themselves are on one page. #users and the Directory's Users
// entry open that page at the Accounts section. Both waiting counts stay on the one entry (their badge ids are unchanged,
// so app.js and the Control Directory keep filling them).
(function () {
    const TABS = [['overview', '🧭 Dashboard & Directory'], ['registrations', '📝 Log-in Approvals'], ['program-access', '🔑 Program Access & Accounts'], ['access', '🔒 Site Lock & Admin Password']];   // Site Lock & Admin Password is a tab here too (no menu entry of its own)   // the Dashboard is part of People & Access too (no menu entry of its own)
    const PANES = TABS.map(t => t[0]).concat('users');

    // 👥 Accounts: the Users panel's list and wipe button, moved to the foot of Program Access (their ids are unchanged, so
    // app.js keeps drawing them where they are). The Users panel's own explainer goes; ⓘ How to use covers it.
    function mergeAccounts() {
        const users = document.getElementById('admin-dash-users'), pa = document.getElementById('admin-dash-program-access');
        const list = document.getElementById('users-list');
        if (!users || !pa || !list || document.getElementById('pa-accounts')) return;
        const sec = document.createElement('section'); sec.id = 'pa-accounts'; sec.className = 'pa-accounts';
        sec.innerHTML = '<div class="mc-section-sub">👥 Accounts: every login, trainers first, then by batch · Edit, Suspend, Restore or Revoke the whole account</div>';
        const sweep = document.getElementById('users-revoked-sweep-btn');
        if (sweep && sweep.parentElement && sweep.parentElement !== users) sec.appendChild(sweep.parentElement);
        // 🧹 both revoked-trainee clean-ups side by side: Program Access's "Clear revoked trainees from every program's scorecards" joins
        // the Accounts' "Wipe revoked trainees from every program" here (its id is unchanged, so app.js's paFtSweep still finds it)
        const clear = document.getElementById('pa-ft-sweep-btn');
        if (clear && clear.parentElement && clear.parentElement.parentElement === pa) sec.appendChild(clear.parentElement);
        sec.appendChild(list);
        pa.appendChild(sec);
        const intro = users.querySelector(':scope > p'); if (intro) intro.remove();
    }
    mergeAccounts(); document.addEventListener('DOMContentLoaded', mergeAccounts);
    function toAccounts() { setTimeout(() => { const el = document.getElementById('pa-accounts'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); }
    const n = id => Number((document.getElementById(id) || {}).textContent) || 0;

    function strip(active) {
        return '<div class="pa-subtabs" role="tablist" aria-label="People & Access">' + TABS.map(([k, label]) =>
            `<button type="button" role="tab" class="pa-subtab${k === active ? ' on' : ''}" aria-selected="${k === active}" data-pa-tab="${k}">${label}</button>`).join('') + '</div>';
    }
    function decorate(tab) {
        const people = PANES.includes(tab);
        const btn = document.querySelector('.mc-nav-btn[data-mc="people"]');
        if (btn) btn.classList.toggle('active', people);
        if (!people) return;
        TABS.map(t => t[0]).forEach(k => {
            const pane = document.getElementById('admin-dash-' + k); if (!pane) return;
            const old = pane.querySelector(':scope > .pa-subtabs'); if (old) old.remove();
            pane.insertAdjacentHTML('afterbegin', strip(k === 'users' ? 'program-access' : k));
        });
    }
    function openPeople() {
        if (n('access-req-badge-side') && typeof window.openAccessRequests === 'function') return window.openAccessRequests();
        if (typeof window.mcGo === 'function') window.mcGo(n('reg-pending-badge-side') ? 'registrations' : 'overview');   // nothing waiting: the Dashboard
    }

    // follow every pane change (the menu, the Control Directory, a #hash link) so the strip and the entry stay in step
    const wrap = () => {
        const orig = window.showAdminDashTab;
        if (typeof orig !== 'function' || orig.__people) return;
        const w = function (tab) {
            if (tab === 'users') { mergeAccounts(); const r = orig.call(this, 'program-access'); decorate('program-access'); toAccounts(); return r; }   // Users lives in Program Access now
            const r = orig.apply(this, arguments); decorate(tab); return r; };
        w.__people = true; window.showAdminDashTab = w;
    };
    // a panel already open when this loads (a #hash link opened it first): mark it now
    const markOpen = () => { const a = document.querySelector('.mc-pane.active'); if (a) decorate(a.id.replace('admin-dash-', '')); };
    wrap(); markOpen(); document.addEventListener('DOMContentLoaded', () => { wrap(); markOpen(); });
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-pa-tab]'); if (b && typeof window.mcGo === 'function') window.mcGo(b.getAttribute('data-pa-tab')); });

    const st = document.createElement('style');
    st.textContent = `.pa-subtabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; padding: 6px; border-radius: 14px; background: rgba(30,35,64,.06); border: 1px solid rgba(30,35,64,.1); }
    .pa-subtab { flex: 0 1 auto; padding: 8px 16px; border-radius: 10px; border: 1px solid transparent; background: transparent; color: #1E2340; font: inherit; font-size: 13.5px; font-weight: 800; cursor: pointer; }
    .pa-subtab:hover { background: #fff; border-color: rgba(30,35,64,.15); }
    .pa-subtab.on { background: linear-gradient(180deg, #2a3058, #1E2340); color: #fff; box-shadow: inset 0 -2px 0 #DB8437; }
    .pa-accounts { margin-top: 28px; padding-top: 18px; border-top: 2px solid rgba(30,35,64,.12); scroll-margin-top: 12px; }
    .pa-subtab:focus-visible { outline: 3px solid #DB8437; outline-offset: 2px; }
    @media (max-width: 560px) { .pa-subtab { flex: 1 1 100%; text-align: left; } }`;
    document.head.appendChild(st);
    window.openPeople = openPeople;
})();

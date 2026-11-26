// 👥 People & Access, one entry: Master Control's menu used to list Log-in Approvals, Program Access & Requests and Users &
// Accounts as three entries for one job. They are now one entry (core.html, data-mc="people") that opens where the work is
// (access requests waiting first, then log-ins waiting, else Program Access), and each of the three panels carries the same
// strip of tabs across its top to move between them. Both waiting counts stay on the one entry (their badge ids are unchanged,
// so app.js and the Control Directory keep filling them).
(function () {
    const TABS = [['registrations', '📝 Log-in Approvals'], ['program-access', '🔑 Program Access & Requests'], ['users', '👥 Accounts']];
    const PANES = TABS.map(t => t[0]);
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
        PANES.forEach(k => {
            const pane = document.getElementById('admin-dash-' + k); if (!pane) return;
            const old = pane.querySelector(':scope > .pa-subtabs'); if (old) old.remove();
            pane.insertAdjacentHTML('afterbegin', strip(k));
        });
    }
    function openPeople() {
        if (n('access-req-badge-side') && typeof window.openAccessRequests === 'function') return window.openAccessRequests();
        if (typeof window.mcGo === 'function') window.mcGo(n('reg-pending-badge-side') ? 'registrations' : 'program-access');
    }

    // follow every pane change (the menu, the Control Directory, a #hash link) so the strip and the entry stay in step
    const wrap = () => {
        const orig = window.showAdminDashTab;
        if (typeof orig !== 'function' || orig.__people) return;
        const w = function (tab) { const r = orig.apply(this, arguments); decorate(tab); return r; };
        w.__people = true; window.showAdminDashTab = w;
    };
    wrap(); document.addEventListener('DOMContentLoaded', wrap);
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-pa-tab]'); if (b && typeof window.mcGo === 'function') window.mcGo(b.getAttribute('data-pa-tab')); });

    const st = document.createElement('style');
    st.textContent = `.pa-subtabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; padding: 6px; border-radius: 14px; background: rgba(30,35,64,.06); border: 1px solid rgba(30,35,64,.1); }
    .pa-subtab { flex: 0 1 auto; padding: 8px 16px; border-radius: 10px; border: 1px solid transparent; background: transparent; color: #1E2340; font: inherit; font-size: 13.5px; font-weight: 800; cursor: pointer; }
    .pa-subtab:hover { background: #fff; border-color: rgba(30,35,64,.15); }
    .pa-subtab.on { background: linear-gradient(180deg, #2a3058, #1E2340); color: #fff; box-shadow: inset 0 -2px 0 #DB8437; }
    .pa-subtab:focus-visible { outline: 3px solid #DB8437; outline-offset: 2px; }
    @media (max-width: 560px) { .pa-subtab { flex: 1 1 100%; text-align: left; } }`;
    document.head.appendChild(st);
    window.openPeople = openPeople;
})();

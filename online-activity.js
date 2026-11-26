// 🛰 Online & Activity, one entry: Master Control's menu listed 🟢 Who's Online and 🗂 Activity Logs as two entries for one job
// (watching what's happening on the platform). They are now one entry (core.html, data-mc="online-activity") that opens Who's Online,
// and both panels carry the same strip of tabs across their top to move between them. Built like people-access.js, beside it.
(function () {
    const TABS = [['monitoring', '🟢 Who’s Online'], ['activity-logs', '🗂 Activity Logs']];
    const KEYS = TABS.map(t => t[0]);
    function strip(active) {
        return '<div class="pa-subtabs oa-subtabs" role="tablist" aria-label="Online & Activity">' + TABS.map(([k, label]) =>
            `<button type="button" role="tab" class="pa-subtab${k === active ? ' on' : ''}" aria-selected="${k === active}" data-oa-tab="${k}">${label}</button>`).join('') + '</div>';
    }
    function decorate(tab) {
        const mine = KEYS.includes(tab);
        const btn = document.querySelector('.mc-nav-btn[data-mc="online-activity"]');
        if (btn) btn.classList.toggle('active', mine);
        if (!mine) return;
        KEYS.forEach(k => {
            const pane = document.getElementById('admin-dash-' + k); if (!pane) return;
            const old = pane.querySelector(':scope > .oa-subtabs'); if (old) old.remove();
            pane.insertAdjacentHTML('afterbegin', strip(k));
        });
    }
    const wrap = () => {
        const orig = window.showAdminDashTab;
        if (typeof orig !== 'function' || orig.__onlineActivity) return;
        const w = function (tab) { const r = orig.apply(this, arguments); decorate(tab); return r; };
        Object.assign(w, orig); w.__onlineActivity = true; window.showAdminDashTab = w;
    };
    const markOpen = () => { const a = document.querySelector('.mc-pane.active'); if (a) decorate(a.id.replace('admin-dash-', '')); };
    wrap(); markOpen(); document.addEventListener('DOMContentLoaded', () => { wrap(); markOpen(); });
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-oa-tab]'); if (b && typeof window.mcGo === 'function') window.mcGo(b.getAttribute('data-oa-tab')); });
    window.openOnlineActivity = () => { if (typeof window.mcGo === 'function') window.mcGo('monitoring'); };
})();

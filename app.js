// =========================================================
// LSH TRAINING ACTIVITIES PORTAL — CORE SCRIPT
// =========================================================

let siteIsLocked = false;
let siteLockedByAdmin = false;
const SESSION_KEY = 'LSH_SESSION_V1';
const HEARTBEAT_INTERVAL_MS = 2000;
const LIVE_DATA_INTERVAL_MS = 15000;
let heartbeatIntervalId = null;
let __heartbeatVisibilityHandler = null;
let liveDataIntervalId = null;
let __activitiesCache = [];
let __submissionsCache = [];
let __mySubmissionsCache = [];
let __currentAnswerActivity = null;
let __activityStartTime = null;
let __currentDetailActivity = null;
let __questionRowCounter = 0;
// Fallback base64 seal if local favicon file fails to load
const AGENCY_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAK6UlEQVR42u1de4xcZRU/53zfvXde+2CXslsK3QBdoAgCrRAhkEUCMWCkRZSQgIQ30cSY1PAPsRoT/9HExAcmECNRkZeihNRoKKLyMIWqRVvsw5ZKW/pY9jG789yZud85/nFnZ2d3Zpdu73fpOszN/jF79z7mnvv7/c45v++7d/FzX7h/+46dnueJCCxmUUqNpycevP+OjQ9/1fd9RYREfn7iwA9u8SePgnZBBOHkLLjAikV+Jw0gob7LnLAKiwgLoABIyENbXKTpx+PZjcT2zYKlExYbSKSQl4OA0NILQXtZOEACAmFQgE0Zhi2EIMsUkzbFFpMyWoViYSCE0NIQCk+x1mZYO4tFT7FGCEmbYu1CMWwd1FIUs92KtVwWa4coOoo1dikiANJKQaOQnVObYm2KWc1i0noBCmd2NO4rrZbmwS6EWq+bD6tBLW4HtQvFk0GxdpqvD0+rG0JtyzViDWqa6NujGgtQrNUWbZkRCytaNZxYV1UudT5qCZmJjm9XJCUiwL4YX4RBBJFQOaA0IgZrLF0R2lVDHYHlKnNiA8KmMAmIOtWrkqeQlwQiqZT8yWE/PwGmQl4StANsGsBYgxgKMKJaiNLMIlx3dkSlrVAsUolTPJUj7XZ9Yn3Hx66NnXGRSvWSGw8CZLKjpZH92e2bM9tfNPlxincGMUIiU8x2XHj9aTduYL+MGMw8Sh/+5QZTzKDSc+AWbN958Q2nXvcl8SuAiESVzMiRpx4SvwSowkAptAYhzitCpLiYia/8+GmfeSg5eMUMukRABB3P6Vnh9KxInXd179Ddw5u+k9mxWSW7gRkAhX2d7Pb6B2sHcysl1O48TERhX3f1xVZcMHNhuXErGSSqVgORuJSPD1y68v7Hk4NXiPHZ+Gx8MT4IA7MYX9iIMWJ897Szz7j7x92Xf56nckA0fc0GhNkvB7uYcn5BnUIwfv32XC5Y0SCyX9aJIKKYik72rPji91Wym/0KkEIkUpqURlKoFCkNpIAQSInxgfTyW78dW36+lIqAVMUmEiJB8AP0AReMCLWNkQDRyqWFp1gzgUbiqWzP0D1uzwo2lUA1kKg8dmj8tV+U39+vEp3Jc6/qXPNZ1C4wAykxFdJez9DdR556qKEaOKGvY+nG69AUaxIhYUNuIrX6GhBBwABTfmbk0E/unTq8C90YiExs/U1u559Ov/17qJxgMxFOXXCt03umyY3jicgHRtHrREAxRBAmL+l09VVhLwyI2bf/OHVsr+7up1hKxTt157LJt36X2/0qkkJSqDQi6WS323ummHLtahcx+xJrG6HFMOnw0WhSBokAEkyXIYGry5UpEK4WLIGMx1KjL/4w+8/fi/GDAyGpyvhh1C775eqaUF2wWKFYyGGsZhFCFPalVKhlNBDpvPiG9F+fLA3vVYnuoLBG5ZaG35k6vGvW4dwY6VgtYdVb5kgUwK2hDlJIqirttilmvVAUAEDSXMyUR951Tx0AYSAlIk53/8oHH39/03dz/3ndz6dRaXLi5CXBS1aRVc2B3PwKRUxhws+nG6shUsrPp6VcjKZZDQcgbKbRgCjMk9teSF1wjQCgVNe4vSvPuOuR0rF9ud2v5Hb+pfjeDj83hsohLwkAM2HCJthE7XauXcdTOZhBUDCCIohkSrn4wKUAMKPulpo7bdcPCuIDbCiWzGx/Mfm357svu1mYhQ0SCTMAeP2rvP5VvdfcWzq2N7frlezbLxXefQsAaDaU6qiFIkKx1PJbvvVBFZgAkl2HwHYdNCMcCKSOPbdR/KlTPnkbkhYAYR8BxIiAICmvf9DrH+wZuie/57XRlx8r7N9KsdS8lyfCc7rZBjAjknXrzvYcxZnDSSCcR5/75oFH78zueEnKRVIalQalAADYCBs2PiCmVg8NfPmJ3qF7uJit01ps6Hz1Qj+kIsliVv2X2V9LBIjIS+b3vVF4Z6vXP5g87+rU6qH4wCXkxAJMBHUmGx+J+tY9zKVCesvTKtXT9LilcnkanLPOHjQVioiqfZzYrIPsPcwi8xiMQrEUCJSG9xXf+/f4qz/z+s5JDl7ZceF1iXMuBwQRRlIgDCDLbtyQ2/OaKaRnHVeEiDKZ7F33bUinJxzHkaBAnz67VmpiMnPXnbc+cN/tvu8rQputRsgjYbNKdsYqqxNachPkJkS4GqnXn0itHupfv9HpWSHMgMRsdKondf7V6S3PINGcBMnMBw8eHh0bdx2HA52aPpdSanx8fGwsHVWat254BP0Xl3L1WEJygi4Mnbh2EwIwuW2TGP/Mex+tr/Gc7tPnq688z43HPEc7cyZIKKXi8bjj6GgCZLnVkKp9lVrWt+5hcjxhBhHUbmHfmxNbn0M3DhIgAHXnsuKBtyoTw24AouB4bjzo5hpn1jALs7DInIcjEYWD9sW2Qlupg5rebAGArrXryfFqa73l56bf/BUGBj4IouJyQXWcSl6ifmeTGwVZYE4OLrLeCN/Ng31PEZVj8unSkd1i/MDiY7/i9a3queoOkx01xUku5kx+nMtTvZ96QCdPETaAGBTBpff3V2vl0FPUZSloEGKz7I6Kp7KZf/0hPnCxmAqQQhAA7Fu/MT5wSW7nn00hozuXda25KXnulSIMSMAGlZ46uie/d4vykn4+veirRQwXzw+xWQUx5CUn3ni246LrE2etZb9SG4HpWnNT15qbZrZmrioOIgCMvfwYF7NBHbRQEXpc1qYd8SCJID4AAEqzX3rv518pHtpB2glsRmBmU2HjBzU0Gx9AhE3gV4xs/tHktk21wZ/GI5+UQVg6Yfe31gA1/wMzas8UJg799MH0lmeAfVIalSLloNKAhFQ18ElpPzNy+MmvjWx+hLxEXb+Kob+JnZFVsQ2hmhgxas8UJ4/++uuTf3++46JPJ85aq7v7VbwDnTiI8XPp8tjB/K5XJ7e9UB49QPHOaTcAms1GX6yoLA3LtcmdrPp71fFMdGLgxIsHtxf++w/ykirRpeJd5MZFxORG/cwoV4rkxlWqF9hU+4e5DmGdkbJIXyF8pEKPaszNHWwKk6ZUAFIAda+mQAJAnsqa/EQwIggAqDQqB4i4XIRSvm5b7ecn5jqEspB7IY3jK9Z6MWsMQwBAN9F9xW3V4eMaKebe/elRh7rpCVLnASKiKeUTZ18WfJbjQUlkS+hmtYYgRBHRXX39N3/Dmp4tyiGMZrakDtnLiwgzM3OdGczWIIk4DSzh+cz8+g65GfFOpkiLiOs6ROS6bn13HQXUY54Xoio7GQESEa3UkSPDu/fsK5crSlHN35tNvvoBwDpG1t3y2mds2Dw4U/CuImN4IUhERLETPg4zp1LJJ59+/omnfjsjE43DoTA7brMogc1IMt9KEQGlaL4XQUWWxcINjNV8YHvCPKf1nUmEeDKm1GpZYpOasemo4XEAIqLo/X+8eeGE8rxYqZyoBR8SXGKO4lLjpmWRphYCUCQiRK0bHzsOW+toUETPhrbS+4OioZi0LITEVhZr46dNsbZIR9hqtG4hLbYo1sq9RluDZuQHMRI/qIWbVTtPDLdfNPmREemI/Ma2SB8XxbAlEBRRmhe73e+SqaQtNZnUJthHplmNimKtI9KRzDBr10Ef1W5exBrFgk6mFSlmZZ60Cab3+LYfrPsQX1UuDU9vzIBocThq8k+kdGdnSkSIEGRO0KVhTTPg1s+dm7Vrk4dLpOltlfnfHiANvzf8JgBKKddxtFazGUeO49S9QugE/kGUAMD/AAHFNFe/IYgGAAAAAElFTkSuQmCC";

function getSession() {
    try {
        return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null');
    } catch (e) { return null; }
}
function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}
function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
}

// 1. NAVIGATION & ROLE VIEW SWITCHING
const VIEW_LABELS = {
    'trainee-landing': 'Dashboard', 'admin-landing': 'Dashboard',
    'trainee-activities': 'Activities & Practice', 'admin-activities': 'Manage Activities',
    'trainee-grades': 'Grades & Submissions', 'admin-grades': 'Review Submissions',
    'trainee-lectures': 'Recorded Lectures', 'admin-lectures': 'Manage Lectures'
};
let __currentViewLabel = null;

function switchView(viewId) {
    const target = document.getElementById('view-' + viewId);
    const outgoing = document.querySelector('.portal-view-section:not(.hidden)');
    __currentViewLabel = VIEW_LABELS[viewId] || viewId;

    function completeSwitch() {
        document.querySelectorAll('.portal-view-section').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.view-nav-btn').forEach(btn => {
            btn.classList.remove('bg-slate-800', 'text-orange-400');
            btn.classList.add('text-slate-300');
        });

        const navBtn = document.getElementById('nav-' + viewId);
        if (target) {
            target.classList.remove('hidden');
            target.classList.remove('view-fade-out');
            // Restart the animation even if this view was recently shown
            void target.offsetWidth;
            target.classList.add('view-fade-in');
            target.addEventListener('animationend', () => target.classList.remove('view-fade-in'), { once: true });
        }
        if (navBtn) {
            navBtn.classList.remove('text-slate-300');
            navBtn.classList.add('bg-slate-800', 'text-orange-400');
        }

        if (viewId === 'admin-activities' || viewId === 'trainee-activities') {
            loadActivitiesData();
        }
        if (viewId === 'trainee-landing' || viewId === 'admin-landing') {
            loadProgressData();
            loadLeaderboardData();
        }
        if (viewId === 'trainee-grades') {
            loadTraineeGrades();
        }
        if (viewId === 'admin-grades') {
            loadAdminSubmissions();
        }
        if (viewId === 'trainee-lectures' || viewId === 'admin-lectures') {
            loadLecturesData();
        }
    }

    // Fade the currently-visible section out first (opacity only, still
    // display:block) so there's something to transition — .hidden is
    // display:none, which can't itself be animated.
    if (outgoing && outgoing !== target) {
        outgoing.classList.add('view-fade-out');
        setTimeout(() => {
            outgoing.classList.remove('view-fade-out');
            completeSwitch();
        }, 160);
    } else {
        completeSwitch();
    }
}

// 2. SESSION & UI BOOTSTRAP
function applySessionUI() {
    const session = getSession();
    const gate = document.getElementById('auth-gate');
    const title = document.getElementById('portal-title');
    const traineeSidebar = document.getElementById('sidebar-trainee');
    const adminSidebar = document.getElementById('sidebar-admin');

    // app.js/portal.js now run on multiple pages (dedicated login pages,
    // registration, and the dashboard) that each only have a subset of
    // this markup — every element here needs its own null-check so this
    // doesn't throw on a page that simply doesn't have a sidebar or title.
    if (!session) {
        if (gate) gate.classList.add('open');
        if (traineeSidebar) traineeSidebar.classList.add('hidden');
        if (adminSidebar) adminSidebar.classList.add('hidden');
        if (title) title.innerText = 'LEGAL SUPPORT HELP TRAINING AND RESOURCE CENTER';
        stopLiveDataPolling();
        return;
    }

    if (gate) gate.classList.remove('open');
    startLiveDataPolling();
    if (title) title.innerText = `LEGAL SUPPORT HELP TRAINING AND RESOURCE CENTER - ${session.userType.toUpperCase()} PORTAL`;

    if (session.userType === 'Admin') {
        if (adminSidebar) adminSidebar.classList.remove('hidden');
        if (traineeSidebar) traineeSidebar.classList.add('hidden');
        const adminFooter = document.getElementById('session-footer-admin');
        if (adminFooter) adminFooter.innerHTML = `
            <div class="session-user-tag text-center text-xs text-slate-400 mb-2 font-mono">Signed in as: <b class="text-white">${session.fullName || session.username}</b></div>
            <button class="w-full border border-emerald-600 text-emerald-400 py-2 rounded text-xs font-bold uppercase mb-2" onclick="openAdminDashboard()">⇄ Master Control</button>
            <button class="w-full border border-red-800 text-red-400 py-2 rounded text-xs font-bold uppercase" onclick="logoutSession()">Log Out</button>
        `;
        if (typeof switchView === 'function' && document.getElementById('view-admin-landing')) switchView('admin-landing');
    } else {
        if (traineeSidebar) traineeSidebar.classList.remove('hidden');
        if (adminSidebar) adminSidebar.classList.add('hidden');
        const traineeFooter = document.getElementById('session-footer-trainee');
        if (traineeFooter) traineeFooter.innerHTML = `
            <div class="session-user-tag text-center text-xs text-slate-400 mb-2 font-mono">Signed in as: <b class="text-white">${session.fullName || session.username}</b></div>
            <button class="w-full border border-red-800 text-red-400 py-2 rounded text-xs font-bold uppercase" onclick="logoutSession()">Log Out</button>
        `;
        if (typeof switchView === 'function' && document.getElementById('view-trainee-landing')) switchView('trainee-landing');
    }
}

function logoutSession() {
    stopHeartbeat();
    stopLiveDataPolling();
    playSound('logout');
    // Fire-and-forget: clears the server-side cookie and logs the 'logout'
    // event (see functions/api/logout.js). Local state is cleared
    // immediately below regardless of whether this network call succeeds —
    // the user shouldn't be stuck "logged in" locally over a network blip.
    fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    clearSession();
    // core.html's auth-gate is just an empty placeholder now that login
    // lives on its own pages — go to the landing page instead of trying
    // to show in-page login content that no longer exists here.
    window.location.href = '/index.html';
}

// 2b-i. LIVE PROGRESS & LEADERBOARD POLLING
// Keeps the progress bars and leaderboard current without a page refresh,
// for whichever of the trainee/admin landing views happen to be visible.
function startLiveDataPolling() {
    stopLiveDataPolling(); // idempotent
    const tick = () => {
        loadProgressData();
        loadLeaderboardData();
    };
    tick();
    liveDataIntervalId = setInterval(tick, LIVE_DATA_INTERVAL_MS);
}
function stopLiveDataPolling() {
    if (liveDataIntervalId) {
        clearInterval(liveDataIntervalId);
        liveDataIntervalId = null;
    }
}

// 2b. SESSION HEARTBEAT
// Keeps the server-side `heartbeats` row fresh so requireSession() (see
// _utils.js) keeps treating this tab as logged in. If this stops ticking,
// the session is treated as expired within HEARTBEAT_GRACE_SECONDS (6s)
// even if the signed session cookie itself hasn't expired yet.
function startHeartbeat() {
    stopHeartbeat(); // idempotent — never run two intervals at once

    const sendHeartbeat = () => {
        const session = getSession();
        if (!session) { stopHeartbeat(); return; }

        fetch('/api/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ fullName: session.fullName || session.username, currentCase: __currentViewLabel })
        })
        .then(response => {
            if (response.ok) return null;
            return response.json().catch(() => null).then(data => ({ status: response.status, data }));
        })
        .then(failure => {
            if (!failure) return; // 2xx, nothing to do
            const code = failure.data && failure.data.code;
            const sessionDied = failure.status === 401 &&
                (code === 'NOT_AUTHENTICATED' || code === 'SESSION_EXPIRED' || code === 'ACCESS_REVOKED');
            if (sessionDied) {
                stopHeartbeat();
                clearSession();
                applySessionUI();
                const message = (failure.data && failure.data.error) || 'Your session has ended. Please log in again.';
                showToast(message, 'error');
            }
            // Any other non-2xx (e.g. a transient 5xx) is left alone — the
            // next tick tries again rather than forcing a logout on a blip.
        })
        .catch(error => {
            // Network error (offline, DNS hiccup, etc.) — don't force a
            // logout over a connectivity blip; just retry on the next tick.
            console.warn('Heartbeat request failed:', error);
        });
    };

    sendHeartbeat(); // fire immediately so the row exists right after login/refresh
    heartbeatIntervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Browsers throttle setInterval() in backgrounded tabs, so the regular
    // tick alone can lag well behind HEARTBEAT_GRACE_SECONDS after the tab
    // has been in the background a while. Firing one immediately the
    // moment the tab is foregrounded again closes that gap right away
    // instead of waiting on a throttled timer to catch up.
    __heartbeatVisibilityHandler = () => {
        if (document.visibilityState === 'visible') sendHeartbeat();
    };
    document.addEventListener('visibilitychange', __heartbeatVisibilityHandler);
}

function stopHeartbeat() {
    if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
    }
    if (__heartbeatVisibilityHandler) {
        document.removeEventListener('visibilitychange', __heartbeatVisibilityHandler);
        __heartbeatVisibilityHandler = null;
    }
}

// 2c. STUBS — called by portal.js after login but not yet implemented.
// Kept as safe no-ops so the post-login chain doesn't throw; each is a
// separate task from session heartbeat.
function startIdleTracking() {
    // TODO: idle timeout tracking — not yet implemented.
}
function refreshSiteState() {
    // TODO: pause/lock site-state polling — not yet implemented.
}
function showTraineeDashboard() {
    // TODO: dedicated trainee dashboard entry point — not yet implemented.
    switchView('trainee-landing');
}

// 3. MASTER CONTROL (ADMIN)
function openAdminDashboard() {
    const session = getSession();
    if (!session || session.userType !== 'Admin') return;
    document.getElementById('master-control-page').classList.add('open');
    __currentViewLabel = MC_TAB_LABELS.overview;
    loadUsersData();
    loadOverviewStats();
}

// Locking/unlocking is restricted to the Master Account (see
// functions/api/site-state.js) — this keeps the Lock button from being
// shown to admins who'd only get a rejection if they tried it. Called from
// functions/access-control.js's own inline script — those elements no
// longer exist in core.html now that Pause/Lock live on that dedicated,
// server-gated page instead.
function applyLockPermissionUI() {
    const session = getSession();
    // 'LSHADMIN123' mirrors MASTER_USERNAME in functions/_utils.js — the
    // client can't import from a Pages Function module, so this is
    // duplicated here for the UI-only check. The actual security boundary
    // is enforced server-side in functions/api/site-state.js; if
    // MASTER_USERNAME ever changes there, update this to match.
    const isMasterAccount = !!(session && session.username === 'LSHADMIN123');
    const lockBtn = document.getElementById('lock-page-btn');
    const note = document.getElementById('lock-master-only-note');
    if (lockBtn) lockBtn.classList.toggle('hidden', !isMasterAccount);
    if (note) note.classList.toggle('hidden', isMasterAccount);
}
function exitMasterControl() {
    document.getElementById('master-control-page').classList.remove('open');
}
const MC_TABS = ['overview', 'registrations', 'users', 'monitoring', 'activity-logs', 'announce', 'access'];
const MC_TAB_LABELS = {
    overview: 'Master Control — Overview', registrations: 'Master Control — Registrations',
    users: 'Master Control — Users', monitoring: 'Master Control — Monitoring',
    'activity-logs': 'Master Control — Activity Logs', announce: 'Master Control — Announcements & Alerts',
    access: 'Master Control — Access Control'
};
function showAdminDashTab(tab) {
    __currentViewLabel = MC_TAB_LABELS[tab] || ('Master Control — ' + tab);
    document.querySelectorAll('.mc-tab').forEach((t, i) => t.classList.toggle('active', MC_TABS[i] === tab));
    document.querySelectorAll('.mc-pane').forEach(p => p.classList.remove('active'));
    const pane = document.getElementById('admin-dash-' + tab);
    if (pane) pane.classList.add('active');
    if (tab === 'overview') loadOverviewStats();
    if (tab === 'registrations' || tab === 'users') loadUsersData();
    if (tab === 'activity-logs') renderActivityLogs();
    if (tab === 'monitoring') loadMonitoringData();
}

// Overview's 6 top tiles and 3 site-status tiles were mostly decorative —
// only Total Users / Pending Registration were ever actually wired (via
// updateUserStats(), called from loadUsersData()). This fills in the rest:
// Total Assigned Activities, Total Submissions, Online/Offline Users, and
// hands the site-status tiles (ov-lock-state/ov-pause-state/ov-alert-state)
// off to be kept current by the existing Lock/Pause/Alert polling in
// portal.js, since that's where the live data already lives.
async function loadOverviewStats() {
    try {
        const res = await fetch('/api/activities', { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (data && data.success) {
            const el = document.getElementById('admin-stat-total-activities');
            if (el) el.textContent = data.activities.filter(a => a.status === 'Published').length;
        }
    } catch (e) { /* leave whatever was last shown */ }

    try {
        const res = await fetch('/api/submissions', { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (data && data.success) {
            const el = document.getElementById('admin-stat-submissions');
            if (el) el.textContent = data.submissions.length;
        }
    } catch (e) { /* leave whatever was last shown */ }

    try {
        const res = await fetch('/api/heartbeat', { credentials: 'include' });
        const rows = await res.json().catch(() => null);
        if (Array.isArray(rows)) {
            const onlineEl = document.getElementById('admin-stat-online');
            if (onlineEl) onlineEl.textContent = rows.length;

            const approvedCount = __usersCache.filter(u => u.status === 'Approved').length;
            const offlineEl = document.getElementById('admin-stat-offline');
            if (offlineEl) offlineEl.textContent = Math.max(0, approvedCount - rows.length);
        }
    } catch (e) { /* leave whatever was last shown */ }

    // Total Users / Pending Registration: reflect whatever loadUsersData()
    // most recently cached rather than re-fetching here too.
    if (__usersCache.length) updateUserStats();
}

// =========================================================
// 3b. REGISTRATIONS & USERS (Master Control: fetch, render, actions)
// =========================================================
let __usersCache = [];

async function loadUsersData() {
    try {
        const res = await fetch('/api/users', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok || data.success === false) {
            showToast((data && data.error) || 'Failed to load user data.', 'error');
            return;
        }
        __usersCache = Array.isArray(data) ? data : [];
        renderRegistrations();
        renderUsersList();
        updateUserStats();
    } catch (e) {
        console.error('loadUsersData failed', e);
        showToast('Network error while loading users.', 'error');
    }
}

function updateUserStats() {
    const pending = __usersCache.filter(u => u.status === 'Pending').length;
    const approvedCount = __usersCache.filter(u => u.status === 'Approved').length;

    const badge = document.getElementById('reg-pending-badge');
    if (badge) badge.textContent = pending > 0 ? pending : '';

    const statPending = document.getElementById('admin-stat-pending');
    if (statPending) statPending.textContent = pending;

    const statTotal = document.getElementById('admin-stat-total-users');
    if (statTotal) statTotal.textContent = approvedCount;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderRegistrations() {
    const container = document.getElementById('registrations-list');
    if (!container) return;

    const pending = __usersCache
        .filter(u => u.status === 'Pending')
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (pending.length === 0) {
        container.innerHTML = `<p style="font-size:12px;color:#94a3b8;">No pending registrations.</p>`;
        return;
    }

    container.innerHTML = pending.map(u => `
        <div class="admin-tile" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;text-align:left;">
            <div>
                <div style="font-weight:800;font-size:13px;color:var(--navy);">
                    ${escapeHtml(u.fullName)}
                    <span style="font-weight:600;color:#64748b;font-size:11px;">(${escapeHtml(u.userType)})</span>
                </div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(u.username)} &middot; ${escapeHtml(u.email || '')}</div>
                ${u.trainingStartDate ? `<div style="font-size:11px;color:#64748b;">Training start: ${escapeHtml(u.trainingStartDate)}</div>` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
                <button class="btn-primary" style="padding:8px 14px;font-size:11px;border-radius:6px;" onclick="approveRegistration(${u.id})">Approve</button>
                <button class="btn-ghost" style="padding:8px 14px;font-size:11px;border-radius:6px;color:var(--classified-red);border-color:var(--classified-red);" onclick="rejectRegistration(${u.id})">Reject</button>
            </div>
        </div>
    `).join('');
}

function renderUsersList() {
    const container = document.getElementById('users-list');
    if (!container) return;

    const visible = __usersCache.filter(u => u.status === 'Approved' || u.status === 'Suspended');
    if (visible.length === 0) {
        container.innerHTML = `<p style="font-size:12px;color:#94a3b8;">No accounts yet.</p>`;
        return;
    }

    container.innerHTML = ['Admin', 'Trainee'].map(type => {
        const rows = visible
            .filter(u => u.userType === type)
            .sort((a, b) => String(a.batchId).localeCompare(String(b.batchId)));
        if (rows.length === 0) return '';
        return `
            <div class="mc-section-title">${type} Accounts</div>
            ${rows.map(renderUserRow).join('')}
        `;
    }).join('');
}

// =========================================================
// ACTIVITY LOGS (Master Control: search + timestamped audit trail)
// =========================================================
async function renderActivityLogs() {
    const container = document.getElementById('activity-logs-list');
    if (!container) return;
    const searchEl = document.getElementById('activity-logs-search');
    const q = searchEl ? searchEl.value.trim() : '';

    try {
        const res = await fetch('/api/activity-logs' + (q ? ('?q=' + encodeURIComponent(q)) : ''), { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (!data || !data.success) {
            container.innerHTML = '<p style="font-size:12px;color:#94a3b8;">Failed to load activity logs.</p>';
            return;
        }
        if (!data.logs || data.logs.length === 0) {
            container.innerHTML = '<p style="font-size:12px;color:#94a3b8;">No activity logs found.</p>';
            return;
        }

        container.innerHTML = data.logs.map(row => {
            let details = {};
            try { details = row.details ? JSON.parse(row.details) : {}; } catch (e) { /* leave empty */ }

            let label;
            switch (row.action) {
                case 'ACTIVITY_SUBMITTED':
                    label = `submitted <strong>${escapeHtml(details.activityTitle || 'an activity')}</strong>`;
                    break;
                case 'GRADE_RELEASED':
                    label = `released a grade of <strong>${escapeHtml(String(details.score))}</strong> for submission #${escapeHtml(String(details.submissionId))}`;
                    break;
                case 'ACTIVITY_ADDED':
                    label = `added activity <strong>${escapeHtml(details.title || '')}</strong>${details.dayLabel ? ' (' + escapeHtml(details.dayLabel) + ')' : ''}`;
                    break;
                case 'LECTURE_ADDED':
                    label = `added lecture <strong>${escapeHtml(details.title || '')}</strong>`;
                    break;
                default:
                    label = escapeHtml(row.action);
            }

            // Matches the +'Z' convention already used in server-logs.js —
            // datetime('now') is stored without a zone suffix (UTC).
            const when = row.timestamp ? new Date(row.timestamp + 'Z').toLocaleString() : '';
            return `<div style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12.5px;">
                <span style="font-weight:700;color:var(--navy);">${escapeHtml(row.actor_username || 'Unknown')}</span> ${label}
                <div style="font-size:10.5px;color:#94a3b8;margin-top:2px;">${when}</div>
            </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p style="font-size:12px;color:#94a3b8;">Network error loading activity logs.</p>';
    }
}

// =========================================================
// MONITORING (Master Control: who's online right now)
// GET /api/heartbeat returns a bare array with raw (snake_case) SQL
// column names — unlike users.js, this endpoint does no camelCase
// aliasing, so fields are read as full_name/batch_id/user_type/
// current_case, not fullName/batchId/userType.
// =========================================================
async function loadMonitoringData() {
    const container = document.getElementById('monitoring-online-list');
    if (!container) return;

    try {
        const res = await fetch('/api/heartbeat', { credentials: 'include' });
        const rows = await res.json().catch(() => null);
        if (!Array.isArray(rows)) {
            container.innerHTML = '<p style="font-size:12px;color:#94a3b8;">Failed to load online users.</p>';
            return;
        }
        if (rows.length === 0) {
            container.innerHTML = '<p style="font-size:12px;color:#94a3b8;">No one is currently online.</p>';
            return;
        }

        container.innerHTML = ['Admin', 'Trainee'].map(type => {
            const group = rows
                .filter(r => r.user_type === type)
                .sort((a, b) => String(a.batch_id).localeCompare(String(b.batch_id)));
            if (group.length === 0) return '';
            return `
                <div class="mc-section-title">${type}s Online</div>
                ${group.map(r => `
                    <div onclick="this.querySelector('.monitor-detail').classList.toggle('hidden')" style="padding:8px 12px;border-bottom:1px solid #f1f5f9;cursor:pointer;font-size:12.5px;">
                        <span style="font-weight:700;color:var(--navy);">${escapeHtml(r.full_name || r.username)}</span>
                        <span style="color:#94a3b8;"> &middot; ${escapeHtml(r.batch_id || '—')}</span>
                        <div class="monitor-detail hidden" style="font-size:11px;color:#64748b;margin-top:4px;">Currently Viewing: ${escapeHtml(r.current_case || 'N/A')}</div>
                    </div>
                `).join('')}
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p style="font-size:12px;color:#94a3b8;">Network error loading online users.</p>';
    }
}

function renderUserRow(u) {
    const isSuspended = u.status === 'Suspended';
    const statusColor = isSuspended ? 'var(--classified-red)' : '#059669';
    const safeName = escapeHtml(u.fullName).replace(/'/g, "\\'");
    return `
        <div class="admin-tile" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;text-align:left;">
            <div>
                <div style="font-weight:800;font-size:13px;color:var(--navy);">
                    ${escapeHtml(u.fullName)}
                    <span style="font-weight:700;font-size:10px;color:${statusColor};border:1px solid ${statusColor};border-radius:4px;padding:1px 6px;margin-left:6px;">${escapeHtml(u.status)}</span>
                </div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(u.batchId)} &middot; ${escapeHtml(u.username)} &middot; ${escapeHtml(u.email || '')}</div>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
                ${isSuspended
                    ? `<button class="btn-primary" style="padding:8px 14px;font-size:11px;border-radius:6px;" onclick="reactivateUser(${u.id})">Reactivate</button>`
                    : `<button class="btn-ghost" style="padding:8px 14px;font-size:11px;border-radius:6px;" onclick="suspendUser(${u.id})">Suspend</button>`
                }
                <button class="btn-ghost" style="padding:8px 14px;font-size:11px;border-radius:6px;color:var(--classified-red);border-color:var(--classified-red);" onclick="revokeUser(${u.id}, '${safeName}')">Revoke</button>
            </div>
        </div>
    `;
}

// Three dedicated endpoints, matching the backend's split: update-status.js
// (Approve/Reject a pending registration), update-access.js (Suspend/
// Reactivate an existing account), and revoke-user.js (permanent, one-way).
async function postJson(endpoint, payload) {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.success) {
        throw new Error((data && data.error) || 'Action failed.');
    }
    return data;
}

async function approveRegistration(id) {
    try {
        const data = await postJson('/api/update-status', { userId: id, newStatus: 'Approved' });
        showToast(data.batchId ? `Approved. Batch ID ${data.batchId} assigned.` : 'Registration approved.', 'success');
        loadUsersData();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function rejectRegistration(id) {
    if (!confirm('Reject this registration? The applicant will need to re-register.')) return;
    try {
        await postJson('/api/update-status', { userId: id, newStatus: 'Rejected' });
        showToast('Registration rejected.', 'success');
        loadUsersData();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function suspendUser(id) {
    if (!confirm('Suspend this account? The user will be signed out and unable to log back in until reactivated.')) return;
    try {
        await postJson('/api/update-access', { userId: id, newStatus: 'Suspended' });
        showToast('Account suspended.', 'success');
        loadUsersData();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function reactivateUser(id) {
    try {
        await postJson('/api/update-access', { userId: id, newStatus: 'Approved' });
        showToast('Account reactivated.', 'success');
        loadUsersData();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function revokeUser(id, name) {
    if (!confirm(`Permanently revoke ${name}'s account? This cannot be undone \u2014 they will need to submit a brand-new registration.`)) return;
    try {
        await postJson('/api/revoke-user', { userId: id });
        showToast('Account permanently revoked.', 'success');
        loadUsersData();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// 4. MODALS (ACTIVITIES, LECTURES, SUBMISSIONS)
// =========================================================
// SERVER LOGS (Admin > Monitoring > Server Logs)
// =========================================================
async function openServerLogs() {
    const modal = document.getElementById('server-logs-modal');
    if (modal) modal.classList.add('open');
    await loadServerLogs();
}

function closeServerLogs() {
    const modal = document.getElementById('server-logs-modal');
    if (modal) modal.classList.remove('open');
}

async function loadServerLogs() {
    const container = document.getElementById('server-logs-list');
    if (!container) return;
    container.innerHTML = `<p style="font-size:12px;color:#94a3b8;">Loading...</p>`;

    try {
        const res = await fetch('/api/server-logs', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok || !data.success) {
            container.innerHTML = `<p style="font-size:12px;color:#f87171;">${escapeHtml((data && data.error) || 'Failed to load server logs.')}</p>`;
            return;
        }
        renderServerLogs(data.logs || []);
    } catch (e) {
        console.error('loadServerLogs failed', e);
        container.innerHTML = `<p style="font-size:12px;color:#f87171;">Network error while loading server logs.</p>`;
    }
}

function formatDuration(totalSeconds) {
    if (totalSeconds === null || totalSeconds === undefined) return '';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function formatLogTimestamp(ts) {
    if (!ts) return '';
    try {
        return new Date(ts + 'Z').toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
        return ts;
    }
}

function renderServerLogs(logs) {
    const container = document.getElementById('server-logs-list');
    if (!container) return;

    if (logs.length === 0) {
        container.innerHTML = `<p style="font-size:12px;color:#94a3b8;">No server activity recorded yet.</p>`;
        return;
    }

    container.innerHTML = logs.map(serverLogRowMarkup).join('');
}

function serverLogRowMarkup(row) {
    const details = row.details && typeof row.details === 'object' ? row.details : {};
    const who = escapeHtml(row.actor_username);
    let icon = '\u2139\uFE0F';
    let label = `${who} \u2014 ${escapeHtml(row.action)}`;
    let extra = '';

    switch (row.action) {
        case 'login':
            icon = '\uD83D\uDD13';
            label = `${who} logged in`;
            break;
        case 'logout':
            icon = '\uD83D\uDD12';
            label = `${who} logged out`;
            if (row.sessionDurationSeconds !== null && row.sessionDurationSeconds !== undefined) {
                extra = `Session length: ${formatDuration(row.sessionDurationSeconds)}`;
            }
            break;
        case 'revoke-user':
            icon = '\u26D4';
            label = `${who} revoked ${escapeHtml(details.username || ('user #' + details.userId))}`;
            break;
        case 'update-access':
            icon = details.newStatus === 'Suspended' ? '\u23F8\uFE0F' : '\u25B6\uFE0F';
            label = `${who} ${details.newStatus === 'Suspended' ? 'suspended' : 'reactivated'} ${escapeHtml(details.username || ('user #' + details.userId))}`;
            break;
    }

    return `
        <div class="admin-tile" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;text-align:left;">
            <div style="font-size:16px;flex-shrink:0;">${icon}</div>
            <div style="flex:1;">
                <div style="font-weight:700;font-size:12px;color:var(--navy);">${label}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;">${formatLogTimestamp(row.timestamp)}${row.actor_batch ? ' &middot; ' + escapeHtml(row.actor_batch) : ''}</div>
                ${extra ? `<div style="font-size:11px;color:#64748b;">${extra}</div>` : ''}
            </div>
        </div>
    `;
}

// =========================================================
// ANNOUNCEMENT TICKER (top bar, visible to every visitor — even pre-login)
// =========================================================
async function loadAnnouncement() {
    try {
        const res = await fetch('/api/announcement', { credentials: 'include' });
        const data = await res.json();
        const text = (data && data.text) || 'Welcome to the Legal Support Help Training and Resource Center (LSH TRC).';
        const tickerText = document.getElementById('ticker-text');
        if (tickerText) tickerText.textContent = text;
        const preview = document.getElementById('announce-current-preview');
        if (preview) preview.textContent = text;
    } catch (e) {
        console.error('loadAnnouncement failed', e);
    }
}

async function makeAnnouncement() {
    const input = document.getElementById('announce-text-input');
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('Please enter an announcement message.', 'error'); return; }
    try {
        await postJson('/api/announcement', { text });
        if (input) input.value = '';
        playSound('announcement');
        showToast('Announcement broadcast.', 'success', 3500, { skipSound: true });
        loadAnnouncement();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function clearAnnouncement() {
    if (!confirm('Reset the ticker to the default welcome message?')) return;
    try {
        const res = await fetch('/api/announcement', { method: 'DELETE', credentials: 'include' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error((data && data.error) || 'Failed to clear announcement.');
        showToast('Ticker cleared.', 'success');
        loadAnnouncement();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
}
function openAddActivityModal() {
    const titleInput = document.getElementById('act-title-input');
    if (titleInput) titleInput.value = '';
    document.getElementById('modal-add-activity').classList.add('open');
}
function openAddLectureModal() { document.getElementById('modal-add-lecture').classList.add('open'); }

// Opens the in-page answer form for an activity — questions are answered,
// submitted, and (where objective) graded without ever leaving this modal.
function openAnswerActivityModal(activityId) {
    const activity = __activitiesCache.find(a => a.id === activityId);
    if (!activity) { showToast('Activity not found.', 'error'); return; }

    __currentAnswerActivity = activity;
    __activityStartTime = Date.now();
    document.getElementById('answer-activity-title').innerText = activity.title;
    document.getElementById('sub-notes-input').value = '';

    const metaEl = document.getElementById('answer-activity-meta');
    if (metaEl) {
        const deadlineText = activity.open_deadline
            ? 'No deadline'
            : (activity.deadline ? `Due ${formatDate(activity.deadline)}` : 'No deadline');
        metaEl.innerHTML = `
            ${activity.instructions ? `<div class="admin-tile" style="text-align:left;margin-bottom:10px;"><div style="font-weight:800;font-size:11px;color:var(--navy);margin-bottom:4px;">Instructions</div><div style="font-size:12px;white-space:pre-wrap;">${escapeHtml(activity.instructions)}</div></div>` : ''}
            <div class="text-[10px] text-orange-600 font-bold uppercase mb-2">${escapeHtml(deadlineText)}</div>
        `;
    }

    const container = document.getElementById('answer-activity-questions');
    const questions = Array.isArray(activity.questions) ? activity.questions : [];

    if (questions.length === 0) {
        container.innerHTML = `
            <div>
                <label>Your Response</label>
                <textarea class="q-answer-input" data-qid="general" rows="6" style="width:100%;" placeholder="Type your response here..."></textarea>
            </div>
        `;
    } else {
        container.innerHTML = questions.map((q, i) => {
            let fieldHtml = '';
            if (q.type === 'mcq') {
                fieldHtml = (q.choices || []).map(c => `
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;text-transform:none;margin-bottom:6px;">
                        <input type="radio" name="q-${q.id}" class="q-answer-input" data-qid="${q.id}" value="${escapeHtml(c)}">
                        ${escapeHtml(c)}
                    </label>
                `).join('');
            } else if (q.type === 'truefalse') {
                fieldHtml = `
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;text-transform:none;margin-bottom:6px;">
                        <input type="radio" name="q-${q.id}" class="q-answer-input" data-qid="${q.id}" value="true"> True
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;text-transform:none;">
                        <input type="radio" name="q-${q.id}" class="q-answer-input" data-qid="${q.id}" value="false"> False
                    </label>
                `;
            } else if (q.type === 'short') {
                fieldHtml = `<input type="text" class="q-answer-input" data-qid="${q.id}" style="width:100%;" placeholder="Your answer...">`;
            } else {
                fieldHtml = `<textarea class="q-answer-input" data-qid="${q.id}" rows="4" style="width:100%;" placeholder="Type your response here..."></textarea>`;
            }
            return `
                <div class="admin-tile" style="text-align:left;">
                    ${q.scenario ? `<div style="font-size:11px;color:#64748b;font-style:italic;white-space:pre-wrap;margin-bottom:8px;border-left:3px solid #cbd5e1;padding-left:8px;">${escapeHtml(q.scenario)}</div>` : ''}
                    <div style="font-weight:800;font-size:12px;color:var(--navy);margin-bottom:8px;">
                        ${i + 1}. ${escapeHtml(q.prompt)}
                        <span style="font-weight:600;color:#94a3b8;font-size:10px;">(${q.points} pt${q.points === 1 ? '' : 's'})</span>
                    </div>
                    ${fieldHtml}
                </div>
            `;
        }).join('');
    }

    document.getElementById('modal-answer-activity').classList.add('open');
}

// Builds the per-question answer breakdown HTML for a submission — shared
// by the admin grade modal, the trainee's own read-only detail view, and
// the PDF report generator, so all three always show the same thing.
function renderSubmissionAnswersHtml(sub, activity) {
    const questions = activity && Array.isArray(activity.questions) ? activity.questions : [];
    const answers = Array.isArray(sub.answers) ? sub.answers : [];
    const answerByQ = new Map(answers.map(a => [a.questionId, a.response]));

    let html = '';
    if (questions.length === 0) {
        const generalAnswer = answerByQ.get('general') || '(no response recorded)';
        html = `<div class="admin-tile" style="text-align:left;"><div style="font-weight:800;font-size:11px;color:var(--navy);margin-bottom:4px;">Response</div><div style="font-size:12px;white-space:pre-wrap;">${escapeHtml(generalAnswer)}</div></div>`;
    } else {
        html = questions.map((q, i) => {
            const given = answerByQ.get(q.id);
            let correctness = '';
            if (q.type !== 'essay') {
                const isCorrect = given !== undefined && String(given).trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase();
                correctness = given === undefined
                    ? `<span style="color:#94a3b8;font-weight:800;font-size:10px;">NOT ANSWERED</span>`
                    : isCorrect
                        ? `<span style="color:#166534;font-weight:800;font-size:10px;">\u2713 CORRECT</span>`
                        : `<span style="color:#b91c1c;font-weight:800;font-size:10px;">\u2717 INCORRECT &middot; Answer key: ${escapeHtml(q.correctAnswer || '')}</span>`;
            }
            return `
                <div class="admin-tile" style="text-align:left;margin-bottom:8px;">
                    ${q.scenario ? `<div style="font-size:11px;color:#64748b;font-style:italic;white-space:pre-wrap;margin-bottom:6px;border-left:3px solid #cbd5e1;padding-left:8px;">${escapeHtml(q.scenario)}</div>` : ''}
                    <div style="font-weight:800;font-size:11px;color:var(--navy);margin-bottom:4px;">${i + 1}. ${escapeHtml(q.prompt)} <span style="color:#94a3b8;font-weight:600;">(${q.points} pt${q.points === 1 ? '' : 's'})</span></div>
                    <div style="font-size:12px;white-space:pre-wrap;margin-bottom:4px;">${escapeHtml(given !== undefined ? given : '(no response)')}</div>
                    ${correctness}
                </div>
            `;
        }).join('');
    }

    if (sub.notes) {
        html += `<div class="admin-tile" style="text-align:left;margin-top:8px;"><div style="font-weight:800;font-size:11px;color:var(--navy);margin-bottom:4px;">Trainee Notes</div><div style="font-size:12px;">${escapeHtml(sub.notes)}</div></div>`;
    }

    return html;
}

// Plain-text (non-HTML) version of the same breakdown, for the PDF report.
function buildSubmissionReportLines(sub, activity) {
    const questions = activity && Array.isArray(activity.questions) ? activity.questions : [];
    const answers = Array.isArray(sub.answers) ? sub.answers : [];
    const answerByQ = new Map(answers.map(a => [a.questionId, a.response]));
    const lines = [];

    if (questions.length === 0) {
        lines.push({ type: 'label', text: 'Response' });
        lines.push({ type: 'body', text: answerByQ.get('general') || '(no response recorded)' });
    } else {
        questions.forEach((q, i) => {
            const given = answerByQ.get(q.id);
            lines.push({ type: 'question', text: `${i + 1}. ${q.prompt} (${q.points} pt${q.points === 1 ? '' : 's'})` });
            if (q.scenario) lines.push({ type: 'scenario', text: q.scenario });
            lines.push({ type: 'body', text: `Answer: ${given !== undefined ? given : '(no response)'}` });
            if (q.type !== 'essay') {
                const isCorrect = given !== undefined && String(given).trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase();
                if (given === undefined) lines.push({ type: 'status-neutral', text: 'NOT ANSWERED' });
                else if (isCorrect) lines.push({ type: 'status-good', text: 'CORRECT' });
                else lines.push({ type: 'status-bad', text: `INCORRECT \u2014 Answer key: ${q.correctAnswer || ''}` });
            }
            lines.push({ type: 'spacer' });
        });
    }

    if (sub.notes) {
        lines.push({ type: 'label', text: 'Trainee Notes' });
        lines.push({ type: 'body', text: sub.notes });
    }

    return lines;
}

// Opens the grading modal for a specific submission id, showing every
// answer alongside auto-graded correctness so the admin doesn't need to
// cross-reference the answer key separately.
// AI-Assisted Review (Gemini) — shows different content depending on
// viewer: trainees see traineeCommentary + keyToCorrection, admins get
// the fuller adminCommentary + insights + gradingSuggestion, plus a
// "Regenerate" control and a shortcut to apply the suggested score.
// sub.ai_review is null until generateAiReview() (see _utils.js) finishes
// — that happens automatically a few seconds after submission, or
// on-demand via the Regenerate button below.
function renderAiReviewHtml(sub, isAdminView) {
    const review = sub.ai_review;
    if (!review) {
        return `<div class="admin-tile" style="text-align:left;background:#f8fafc;margin-bottom:8px;">
            <div style="font-weight:800;font-size:11px;color:var(--navy);margin-bottom:4px;">🤖 AI-Assisted Review</div>
            <div style="font-size:12px;color:#94a3b8;">Not yet available — this is usually ready within a few seconds of submitting.${isAdminView ? ' Click "Regenerate AI Review" below once it\'s configured.' : ' Check back shortly.'}</div>
            ${isAdminView ? `<button class="btn-ghost" style="margin-top:8px;padding:8px 14px;font-size:11px;border-radius:6px;" onclick="regenerateAiReview(${sub.id})">🔄 Generate AI Review</button>` : ''}
        </div>`;
    }

    if (!isAdminView) {
        return `
            <div class="admin-tile" style="text-align:left;background:#fff7ed;border-color:#fed7aa;margin-bottom:8px;">
                <div style="font-weight:800;font-size:11px;color:#c2410c;margin-bottom:6px;">🤖 AI Commentary</div>
                <div style="font-size:12.5px;line-height:1.6;">${escapeHtml(review.traineeCommentary || '')}</div>
            </div>
            <div class="admin-tile" style="text-align:left;background:#fff7ed;border-color:#fed7aa;margin-bottom:8px;">
                <div style="font-weight:800;font-size:11px;color:#c2410c;margin-bottom:6px;">🔑 Key to Correction</div>
                <div style="font-size:12.5px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(review.keyToCorrection || '')}</div>
            </div>
        `;
    }

    const scoreBtn = (review.suggestedScore !== undefined && review.suggestedScore !== null)
        ? `<button class="mini-btn" style="margin-top:6px;" onclick="document.getElementById('grade-score-input').value='${escapeHtml(String(review.suggestedScore))}'">Use Suggested Score (${escapeHtml(String(review.suggestedScore))})</button>`
        : '';

    return `
        <div class="admin-tile" style="text-align:left;background:#fff7ed;border-color:#fed7aa;margin-bottom:8px;">
            <div style="font-weight:800;font-size:11px;color:#c2410c;margin-bottom:6px;">🤖 AI Commentary (Admin View)</div>
            <div style="font-size:12.5px;line-height:1.6;">${escapeHtml(review.adminCommentary || '')}</div>
        </div>
        <div class="admin-tile" style="text-align:left;background:#fff7ed;border-color:#fed7aa;margin-bottom:8px;">
            <div style="font-weight:800;font-size:11px;color:#c2410c;margin-bottom:6px;">💡 Insights</div>
            <div style="font-size:12.5px;line-height:1.6;">${escapeHtml(review.insights || '')}</div>
        </div>
        <div class="admin-tile" style="text-align:left;background:#fff7ed;border-color:#fed7aa;margin-bottom:8px;">
            <div style="font-weight:800;font-size:11px;color:#c2410c;margin-bottom:6px;">📊 Grading Suggestion</div>
            <div style="font-size:12.5px;line-height:1.6;margin-bottom:4px;">${escapeHtml(review.gradingSuggestion || '')}</div>
            ${scoreBtn}
        </div>
        <div class="admin-tile" style="text-align:left;background:#fff7ed;border-color:#fed7aa;margin-bottom:8px;">
            <div style="font-weight:800;font-size:11px;color:#c2410c;margin-bottom:6px;">🔑 Key to Correction (also shown to the trainee)</div>
            <div style="font-size:12.5px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(review.keyToCorrection || '')}</div>
        </div>
        <button class="btn-ghost" style="margin-bottom:8px;padding:8px 14px;font-size:11px;border-radius:6px;" onclick="regenerateAiReview(${sub.id})">🔄 Regenerate AI Review</button>
    `;
}

async function regenerateAiReview(submissionId) {
    showToast('Regenerating AI review...', 'info');
    try {
        const data = await postJson('/api/ai-review', { submissionId });
        const sub = __submissionsCache.find(s => s.id === submissionId);
        if (sub) sub.ai_review = data.review;
        showToast('AI review updated.', 'success');
        openGradeModal(submissionId); // re-render with the fresh data
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function openGradeModal(submissionId) {
    const sub = __submissionsCache.find(s => s.id === submissionId);
    if (!sub) { showToast('Submission not found.', 'error'); return; }

    if (!__activitiesCache.length) {
        try {
            const res = await fetch('/api/activities', { credentials: 'include' });
            const data = await res.json();
            if (data.success) __activitiesCache = data.activities;
        } catch (e) { /* grading still works without the answer-key cross-reference */ }
    }

    document.getElementById('grade-modal-subtitle').innerText = `${sub.trainee_name} - ${sub.activity_title}`;
    document.getElementById('grade-score-input').value = sub.status === 'Graded'
        ? sub.score
        : (sub.auto_score !== null && sub.auto_score !== undefined ? sub.auto_score : '');
    document.getElementById('grade-feedback-input').value = sub.feedback || '';
    document.getElementById('modal-grade-submission').dataset.submissionId = submissionId;

    const activity = __activitiesCache.find(a => a.id === sub.activity_id);
    document.getElementById('grade-modal-answers').innerHTML = renderAiReviewHtml(sub, true) + renderSubmissionAnswersHtml(sub, activity);
    document.getElementById('modal-grade-submission').classList.add('open');
}

// ACTIVITIES & LESSON DECKS (backed by /api/activities)
async function loadActivitiesData() {
    const adminContainer = document.getElementById('admin-days-accordion');
    const traineeContainer = document.getElementById('trainee-days-accordion');
    if (!adminContainer && !traineeContainer) return;

    try {
        const res = await fetch('/api/activities', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load activities.');
        __activitiesCache = data.activities || [];

        if (adminContainer) renderAdminActivities(__activitiesCache);

        if (traineeContainer) {
            let mySubmissions = [];
            const session = getSession();
            if (session && session.userType !== 'Admin') {
                try {
                    const subRes = await fetch('/api/submissions', { credentials: 'include' });
                    const subData = await subRes.json();
                    if (subData.success) mySubmissions = subData.submissions;
                } catch (e) { /* non-fatal — activities still render without submission status */ }
            }
            renderTraineeActivities(__activitiesCache, mySubmissions);
        }
    } catch (e) {
        const msg = `<div class="text-xs text-red-500 p-4">Failed to load: ${escapeHtml(e.message)}</div>`;
        if (adminContainer) adminContainer.innerHTML = msg;
        if (traineeContainer) traineeContainer.innerHTML = msg;
    }
}

function renderAdminActivities(activities) {
    const container = document.getElementById('admin-days-accordion');
    if (!container) return;

    if (!activities || activities.length === 0) {
        container.innerHTML = `<div class="text-xs text-slate-500 p-4">No activities or lesson decks added yet.</div>`;
        return;
    }

    // Group by day_label, preserving the order the API returned (already sorted by day_label, created_at)
    const groups = new Map();
    activities.forEach(a => {
        if (!groups.has(a.day_label)) groups.set(a.day_label, []);
        groups.get(a.day_label).push(a);
    });

    let html = '';
    for (const [day, items] of groups) {
        html += `
            <div class="pdf-card border-l-4 border-navy">
                <div class="section-head">${escapeHtml(day)}</div>
                <div class="space-y-3">
                    ${items.map(item => {
                        const isDeck = item.type === 'Deck';
                        const qCount = Array.isArray(item.questions) ? item.questions.length : 0;
                        const clickAttr = isDeck
                            ? `onclick="viewDeck(${item.id}, '${escapeJs(item.title)}', '${escapeJs(item.file_url || '')}')"`
                            : `onclick="openActivityDetail(${item.id})"`;
                        const statusClass = 'status-' + String(item.status || 'Draft').toLowerCase();
                        return `
                            <div class="flex justify-between items-center p-3 bg-slate-50 rounded border cursor-pointer hover:border-navy hover:bg-blue-50 transition" ${clickAttr}>
                                <div class="flex items-center gap-3">
                                    ${isDeck ? `<div style="width:34px;height:34px;border-radius:6px;background:var(--navy);color:white;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">\ud83d\udcd1</div>` : ''}
                                    <div>
                                        <span class="text-xs font-bold text-navy block">${escapeHtml(item.title)}</span>
                                        <span class="text-[10px] text-slate-500">${isDeck ? 'Lesson Deck &middot; Click to preview' : `Activity &middot; ${qCount} item${qCount === 1 ? '' : 's'}`} &middot; Uploaded ${formatDate(item.created_at)}</span>
                                    </div>
                                </div>
                                ${isDeck ? '' : `<span class="status-pill ${statusClass} flex-shrink-0">${escapeHtml(item.status || 'Draft')}</span>`}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function renderTraineeActivities(activities, mySubmissions) {
    const container = document.getElementById('trainee-days-accordion');
    if (!container) return;

    if (!activities || activities.length === 0) {
        container.innerHTML = `<div class="text-xs text-slate-500 p-4">No activities or lesson decks have been posted yet.</div>`;
        return;
    }

    // submissions come back newest-first from the API, so the first match per activity is the latest attempt
    const subByActivity = new Map();
    (mySubmissions || []).forEach(s => {
        if (!subByActivity.has(s.activity_id)) subByActivity.set(s.activity_id, s);
    });

    const groups = new Map();
    activities.forEach(a => {
        if (!groups.has(a.day_label)) groups.set(a.day_label, []);
        groups.get(a.day_label).push(a);
    });

    let html = '';
    for (const [day, items] of groups) {
        html += `
            <div class="pdf-card border-l-4 border-navy">
                <div class="section-head">${escapeHtml(day)}</div>
                <div class="space-y-3">
                    ${items.map(item => {
                        if (item.type === 'Deck') {
                            // Preview card only — the actual deck opens in the draggable pane on click.
                            return `
                                <div class="flex justify-between items-center p-3 bg-slate-50 rounded border cursor-pointer hover:border-navy hover:bg-blue-50 transition" onclick="viewDeck(${item.id}, '${escapeJs(item.title)}', '${escapeJs(item.file_url || '')}')">
                                    <div class="flex items-center gap-3">
                                        <div style="width:34px;height:34px;border-radius:6px;background:var(--navy);color:white;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">\ud83d\udcd1</div>
                                        <div>
                                            <span class="text-xs font-bold text-navy block">${escapeHtml(item.title)}</span>
                                            <span class="text-[10px] text-slate-500">Lesson Deck &middot; Click to preview</span>
                                        </div>
                                    </div>
                                    <span class="text-blue-600 text-xs font-bold uppercase flex-shrink-0">Preview &rarr;</span>
                                </div>
                            `;
                        }

                        const sub = subByActivity.get(item.id);
                        let actionHtml;
                        if (sub && sub.status === 'Graded') {
                            actionHtml = `<span class="status-pill status-approved">Graded &middot; ${sub.score}%</span>`;
                        } else if (sub) {
                            actionHtml = `<span class="status-pill status-pending">Submitted &middot; Awaiting Grade</span>`;
                        } else if (item.status === 'Closed') {
                            actionHtml = `<span class="status-pill status-closed">Closed</span>`;
                        } else {
                            actionHtml = `<button onclick="openAnswerActivityModal(${item.id})" class="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-xs font-bold uppercase">Answer &amp; Submit</button>`;
                        }

                        const deadlineText = item.open_deadline
                            ? 'No deadline'
                            : (item.deadline ? `Due ${formatDate(item.deadline)}` : 'No deadline');

                        return `
                            <div class="flex justify-between items-center p-3 bg-slate-50 rounded border">
                                <div>
                                    <span class="text-xs font-bold text-navy block">${escapeHtml(item.title)}</span>
                                    <span class="text-[10px] text-orange-600 font-bold">${escapeHtml(deadlineText)}</span>
                                </div>
                                ${actionHtml}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function escapeJs(str) {
    return String(str == null ? '' : str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ===== LESSON DECK VIEWER (draggable, view-only PPTX pane) =====
// Same robustness as getLectureEmbedUrl() below: trims input and pulls
// the real src="" out of a pasted <iframe> embed snippet first, since
// admins can paste either a bare URL or a full embed snippet from
// Google Drive / Office Online just as easily as from YouTube.
function getDeckEmbedUrl(fileUrl) {
    if (!fileUrl) return null;
    const url = extractSrcFromIframeSnippet(fileUrl).trim();
    if (!url) return null;

    if (/drive\.google\.com\/.*\/preview/i.test(url)) return url; // already embeddable

    const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
    if (driveFileMatch) return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
    const driveIdParamMatch = url.match(/drive\.google\.com\/(?:open|uc)\?[^#]*\bid=([a-zA-Z0-9_-]+)/i);
    if (driveIdParamMatch) return `https://drive.google.com/file/d/${driveIdParamMatch[1]}/preview`;

    if (/view\.officeapps\.live\.com\/op\/embed\.aspx/i.test(url)) return url; // already embeddable

    if (/^https?:\/\//i.test(url) && /\.(pptx|ppt)(\?|$)/i.test(url)) {
        return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    }

    return null; // unrecognized format, fall back to a link
}

function viewDeck(id, title, fileUrl) {
    const pane = document.getElementById('deck-viewer-pane');
    const titleEl = document.getElementById('deck-viewer-title');
    const holder = document.getElementById('deck-viewer-frame-holder');

    titleEl.textContent = title || 'Lesson Deck';

    const cleanedUrl = fileUrl ? extractSrcFromIframeSnippet(fileUrl).trim() : '';
    const embedUrl = getDeckEmbedUrl(fileUrl);
    if (embedUrl) {
        holder.innerHTML = `<iframe src="${embedUrl}" allowfullscreen sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`;
    } else if (cleanedUrl) {
        holder.innerHTML = `<div id="deck-viewer-fallback">This deck's file link can't be previewed inline.<br><a href="${escapeHtml(cleanedUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--navy);font-weight:700;">Open in a new tab &rarr;</a><div style="font-size:10px;color:#94a3b8;word-break:break-all;margin-top:10px;">${escapeHtml(cleanedUrl)}</div></div>`;
    } else {
        holder.innerHTML = `<div id="deck-viewer-fallback">No file has been attached to this lesson deck yet.</div>`;
    }

    // Reset position/size each time it's opened
    pane.style.top = '90px';
    pane.style.left = '50%';
    pane.style.transform = 'translateX(-50%)';
    pane.style.width = '820px';
    pane.style.height = '600px';

    pane.classList.add('open');
}

function closeDeckViewer() {
    const pane = document.getElementById('deck-viewer-pane');
    pane.classList.remove('open');
    document.getElementById('deck-viewer-frame-holder').innerHTML = '';
}

// ===== RECORDED LECTURES (clickable list + confirm + draggable pop-out viewer) =====
// A raw youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/..., or
// drive.google.com/file/d/.../view URL can't be framed directly — this
// converts to the embeddable form, mirroring getDeckEmbedUrl's approach
// for lesson decks above.
//
// Admins sometimes paste YouTube/Drive's own "Share > Embed" button
// output — the FULL <iframe ...></iframe> snippet — into the Embed Link
// field, rather than just the video's URL. Pull the real src="" out of
// that first: without this, a string like
//   <iframe src="https://youtube.com/embed/XYZ" ...></iframe>
// would match the "already embeddable" check below on its raw text and
// get used as-is as an iframe's src attribute, producing
// <iframe src="<iframe src="https://..." ...></iframe>" ...> — a quote
// inside the pasted snippet prematurely closes the src attribute, so the
// browser renders broken markup instead of the video.
function extractSrcFromIframeSnippet(rawUrl) {
    const str = String(rawUrl);
    if (!/<iframe[\s>]/i.test(str)) return str; // not a pasted snippet, leave as-is
    const srcMatch = str.match(/\bsrc=["']([^"']+)["']/i);
    return srcMatch ? srcMatch[1] : str;
}

function getLectureEmbedUrl(rawUrl) {
    if (!rawUrl) return null;
    let url = extractSrcFromIframeSnippet(rawUrl).trim();
    if (!url) return null;

    // Already in embeddable iframe form — pass through unchanged.
    if (/youtube(-nocookie)?\.com\/embed\//i.test(url)) return url;
    if (/drive\.google\.com\/.*\/preview/i.test(url)) return url;

    // Google Drive: /file/d/ID/(view|preview|edit), or /open?id=ID, or /uc?id=ID
    const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
    if (driveFileMatch) return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
    const driveIdParamMatch = url.match(/drive\.google\.com\/(?:open|uc)\?[^#]*\bid=([a-zA-Z0-9_-]+)/i);
    if (driveIdParamMatch) return `https://drive.google.com/file/d/${driveIdParamMatch[1]}/preview`;

    // YouTube: watch?v=ID works regardless of domain/path around it (also
    // catches m.youtube.com and youtube.com/watch?...&v=ID with extra params).
    const ytWatchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
    if (ytWatchMatch) return `https://www.youtube.com/embed/${ytWatchMatch[1]}`;

    const ytShortLinkMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/i);
    if (ytShortLinkMatch) return `https://www.youtube.com/embed/${ytShortLinkMatch[1]}`;
    const ytShortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/i);
    if (ytShortsMatch) return `https://www.youtube.com/embed/${ytShortsMatch[1]}`;
    const ytLiveMatch = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{6,})/i);
    if (ytLiveMatch) return `https://www.youtube.com/embed/${ytLiveMatch[1]}`;

    // A bare 11-character YouTube video ID with no surrounding URL at all.
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return `https://www.youtube.com/embed/${url}`;

    return null; // unrecognized format, fall back to a link
}

let __lecturesCache = [];

async function loadLecturesData() {
    try {
        const res = await fetch('/api/lectures', { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (!data || !data.success) return;
        __lecturesCache = data.lectures || [];
        renderLectureList('trainee-lectures-list', false);
        renderLectureList('admin-lectures-list', true);
    } catch (e) { /* leave whatever was last rendered */ }
}

function renderLectureList(containerId, isAdmin) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (__lecturesCache.length === 0) {
        container.innerHTML = '<p style="font-size:12px;color:#94a3b8;">No recorded lectures yet.</p>';
        return;
    }

    container.innerHTML = __lecturesCache.map(lec => {
        const deleteBtn = isAdmin
            ? `<button onclick="event.stopPropagation(); deleteLecture(${lec.id})" style="background:none;border:none;color:#b91c1c;cursor:pointer;font-size:11px;font-weight:700;flex-shrink:0;">Delete</button>`
            : '';
        return `<div onclick="confirmWatchLecture(${lec.id})" class="pdf-card border-l-4 border-red-600" style="cursor:pointer;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div>
                <div class="section-head" style="background:#fef2f2; color:#b91c1c;">${escapeHtml(lec.title)}</div>
                <p class="text-xs text-slate-600" style="margin-top:6px;">${escapeHtml(lec.summary || '')}</p>
            </div>
            ${deleteBtn}
        </div>`;
    }).join('');
}

// The list only shows title + summary — clicking an item confirms intent
// before actually loading the embed, rather than auto-playing on click.
function confirmWatchLecture(id) {
    const lec = __lecturesCache.find(l => String(l.id) === String(id));
    if (!lec) return;
    if (!confirm(`Do you want to watch this lecture?\n\n"${lec.title}"`)) return;
    viewLecture(lec);
}

// Keeps the video's actual 16:9 shape regardless of the pane's current
// size — plain width:100%/height:100% (the CSS fallback above) stretches
// to fill whatever box it's in, distorting the picture whenever the
// pane's aspect ratio doesn't happen to match the video's. This computes
// the largest 16:9 rectangle that fits within the available space and
// centers it (letterboxed/pillarboxed via the body's flex centering).
function fitLectureIframeToBox() {
    const body = document.getElementById('lecture-viewer-body');
    const iframe = body ? body.querySelector('iframe') : null;
    if (!body || !iframe) return;

    const availW = body.clientWidth;
    const availH = body.clientHeight;
    if (availW <= 0 || availH <= 0) return;

    const targetRatio = 16 / 9;
    let w = availW;
    let h = w / targetRatio;
    if (h > availH) {
        h = availH;
        w = h * targetRatio;
    }

    iframe.style.width = Math.round(w) + 'px';
    iframe.style.height = Math.round(h) + 'px';
}

// A ResizeObserver on the body means the iframe re-fits itself whenever
// the pane's available space changes for ANY reason — minimize, maximize,
// a manual drag, or just the browser window itself being resized — not
// only the two specific toggles this file happens to trigger explicitly.
let __lectureResizeObserver = null;
function initLectureViewerResizeObserver() {
    const body = document.getElementById('lecture-viewer-body');
    if (!body || !window.ResizeObserver) return;
    __lectureResizeObserver = new ResizeObserver(() => fitLectureIframeToBox());
    __lectureResizeObserver.observe(body);
}
document.addEventListener('DOMContentLoaded', initLectureViewerResizeObserver);

function resetLectureViewerPosition() {
    const pane = document.getElementById('lecture-viewer-pane');
    if (!pane) return;
    pane.style.top = '';
    pane.style.left = '';
    pane.style.transform = '';
    pane.style.right = '24px';
    pane.style.bottom = '24px';
    pane.style.width = '380px';
    pane.style.height = '250px';
    pane.style.maxWidth = '';
    pane.style.maxHeight = '';
}

function viewLecture(lec) {
    const pane = document.getElementById('lecture-viewer-pane');
    const titleEl = document.getElementById('lecture-viewer-title');
    const holder = document.getElementById('lecture-viewer-frame-holder');
    const openLink = document.getElementById('lecture-viewer-open-link');
    if (!pane || !titleEl || !holder) return;

    titleEl.textContent = lec.title || 'Recorded Lecture';

    // Always point the header's "open in new tab" link at the original
    // link, regardless of whether the inline embed works — a specific
    // video/file can have its OWN sharing or embedding permission turned
    // off by whoever uploaded it, which no amount of code here can fix,
    // so this is the guaranteed-to-work fallback. Uses the extracted URL,
    // not the raw stored value — if that value is a pasted <iframe>
    // snippet rather than a bare URL, an href set to the raw value would
    // be just as broken as the src bug this same extraction fixes below.
    const cleanedUrl = lec.embed_url ? extractSrcFromIframeSnippet(lec.embed_url).trim() : '';
    if (openLink) {
        if (cleanedUrl) {
            openLink.href = cleanedUrl;
            openLink.style.display = 'inline-block';
        } else {
            openLink.style.display = 'none';
        }
    }

    const embedUrl = getLectureEmbedUrl(lec.embed_url);
    if (embedUrl) {
        // Deliberately NOT sandboxed, unlike the deck viewer's PPTX/GDrive
        // iframe above — sandboxing YouTube's player blocks the nested
        // iframes and postMessage calls it needs to initialize. This is
        // YouTube's own recommended embed `allow` list instead.
        //
        // If the video still won't play after this, it's very likely the
        // video/file's OWN permissions (YouTube "embedding disabled" by the
        // uploader, or a Google Drive file not shared as "Anyone with the
        // link") — YouTube/Drive will show their own error message inside
        // the iframe in that case, which is a content-permissions issue on
        // that specific video, not a bug in this page. The ↗ link above
        // always works regardless.
        holder.innerHTML = `<iframe src="${embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    } else if (lec.embed_url) {
        // Shows the actual stored link so a broken/unrecognized format is
        // visible and diagnosable, instead of a generic dead-end message.
        holder.innerHTML = `<div id="lecture-viewer-fallback">This link isn't a recognized YouTube or Google Drive link, so it can't be previewed inline.<br><a href="${escapeHtml(cleanedUrl)}" target="_blank" rel="noopener noreferrer">Open in a new tab &rarr;</a><div style="font-size:10px;color:#94a3b8;word-break:break-all;margin-top:10px;">${escapeHtml(cleanedUrl)}</div></div>`;
    } else {
        holder.innerHTML = `<div id="lecture-viewer-fallback">No video link has been attached to this lecture yet.</div>`;
    }

    // Reset to the default small bottom-right corner position/size each
    // time it's opened, undoing any previous drag or leftover maximized state.
    pane.classList.remove('maximized');
    const fsBtn = document.getElementById('lecture-viewer-fullscreen');
    if (fsBtn) { fsBtn.textContent = '⛶'; fsBtn.title = 'Full Screen'; }
    resetLectureViewerPosition();
    pane.classList.add('open');

    // Immediate fit — the ResizeObserver above also catches this, but its
    // callback fires on the next frame, so this avoids a brief flash of a
    // stretched/wrong-sized video right as the pane opens.
    fitLectureIframeToBox();
}

function closeLectureViewer() {
    const pane = document.getElementById('lecture-viewer-pane');
    if (!pane) return;
    pane.classList.remove('maximized');
    pane.classList.remove('open');
    document.getElementById('lecture-viewer-frame-holder').innerHTML = '';
}

// "Full Screen" here means the page's main content area — everything
// below the 38px classification bar and to the right of the 280px
// sidebar — NOT a literal OS-level takeover via the browser's Fullscreen
// API. This is a plain CSS/inline-style toggle; the 'maximized' class is
// only used as a state flag (checked via classList.contains below), not
// as a styling hook, so there's no risk of a stylesheet rule and an
// inline style fighting over the same properties.
function toggleLectureFullscreen() {
    const pane = document.getElementById('lecture-viewer-pane');
    const btn = document.getElementById('lecture-viewer-fullscreen');
    if (!pane || !btn) return;

    const isMaximized = pane.classList.contains('maximized');
    if (!isMaximized) {
        pane.classList.add('maximized');
        pane.style.top = '38px';      // classification bar height
        pane.style.left = '280px';    // sidebar width
        pane.style.right = '0';
        pane.style.bottom = '0';
        pane.style.width = 'auto';
        pane.style.height = 'auto';
        pane.style.maxWidth = 'none';
        pane.style.maxHeight = 'none';
        pane.style.transform = 'none';
        btn.textContent = '⤢';
        btn.title = 'Exit Full Screen';
    } else {
        pane.classList.remove('maximized');
        resetLectureViewerPosition();
        btn.textContent = '⛶';
        btn.title = 'Full Screen';
    }

    // Same immediate-fit reasoning as in viewLecture() — don't wait on the
    // ResizeObserver's next-frame callback for this explicit toggle.
    fitLectureIframeToBox();
}

async function deleteLecture(id) {
    if (!confirm('Delete this lecture?')) return;
    try {
        const res = await fetch('/api/lectures?id=' + encodeURIComponent(id), { method: 'DELETE', credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.success) throw new Error((data && data.error) || 'Failed to delete lecture.');
        showToast('Lecture deleted.', 'success');
        closeLectureViewer();
        loadLecturesData();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// Drag support for the deck viewer pane (mouse + touch)
function initDraggablePane(paneId, headerId, nonDragIds, options = {}) {
    const minLeft = options.minLeft; // if unset, keeps the old permissive (near off-screen) behavior
    document.addEventListener('DOMContentLoaded', () => {
        const pane = document.getElementById(paneId);
        const header = document.getElementById(headerId);
        if (!pane || !header) return;

        let dragging = false;
        let offsetX = 0, offsetY = 0;

        function isNonDragTarget(target) {
            return nonDragIds.includes(target.id);
        }

        function startDrag(clientX, clientY) {
            const rect = pane.getBoundingClientRect();
            // Switch from centered transform to absolute top/left so dragging works predictably
            pane.style.transform = 'none';
            pane.style.left = rect.left + 'px';
            pane.style.top = rect.top + 'px';
            offsetX = clientX - rect.left;
            offsetY = clientY - rect.top;
            dragging = true;
        }

        function moveDrag(clientX, clientY) {
            if (!dragging) return;
            const maxLeft = window.innerWidth - 60;
            const maxTop = window.innerHeight - 40;
            let newLeft = clientX - offsetX;
            let newTop = clientY - offsetY;
            const lowerBound = (minLeft !== undefined) ? minLeft : (-pane.offsetWidth + 120);
            newLeft = Math.max(lowerBound, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));
            pane.style.left = newLeft + 'px';
            pane.style.top = newTop + 'px';
        }

        function endDrag() { dragging = false; }

        function isDraggable() {
            // A 'maximized' pane (see toggleLectureFullscreen) is anchored
            // via right/bottom in addition to left/top — dragging it would
            // fight that anchoring and resize rather than move it. Only
            // the lecture pane ever gets this class; deck-viewer-pane never
            // has it, so this check is a no-op there.
            return !pane.classList.contains('maximized');
        }

        header.addEventListener('mousedown', (e) => {
            if (isNonDragTarget(e.target) || !isDraggable()) return;
            startDrag(e.clientX, e.clientY);
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
        document.addEventListener('mouseup', endDrag);

        header.addEventListener('touchstart', (e) => {
            if (isNonDragTarget(e.target) || !isDraggable()) return;
            const t = e.touches[0];
            startDrag(t.clientX, t.clientY);
        }, { passive: true });
        document.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            const t = e.touches[0];
            moveDrag(t.clientX, t.clientY);
        }, { passive: true });
        document.addEventListener('touchend', endDrag);
    });
}

initDraggablePane('deck-viewer-pane', 'deck-viewer-header', ['deck-viewer-close']);
// minLeft: 280 matches the fixed sidebar width (see #sidebar-trainee /
// #sidebar-admin) — this pane can only ever be open while logged in, so
// one of those two sidebars is always occupying that space.
initDraggablePane('lecture-viewer-pane', 'lecture-viewer-header', ['lecture-viewer-close', 'lecture-viewer-fullscreen', 'lecture-viewer-open-link'], { minLeft: 280 });

function formatDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d)) return escapeHtml(isoString);
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

// ===== PROGRESS (Trainee Progress + Batch Progress, and Admin Tracker) =====
async function loadProgressData() {
    const session = getSession();
    if (!session) return;

    try {
        const res = await fetch('/api/progress', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok || !data.success) return;

        if (data.scope === 'trainee') {
            renderTraineeProgress(data.trainee, data.batch);
        } else if (data.scope === 'admin') {
            renderAdminProgress(data);
        }
    } catch (e) {
        console.warn('Failed to load progress data', e);
    }
}

function renderTraineeProgress(trainee, batch) {
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setWidth = (id, pct) => { const el = document.getElementById(id); if (el) el.style.width = pct + '%'; };

    setText('trainee-progress-pct', trainee.pct + '%');
    setWidth('trainee-progress-bar', trainee.pct);
    setText('trainee-progress-detail', `${trainee.completed} of ${trainee.total} activities completed`);

    setText('batch-progress-pct', batch.pct + '%');
    setWidth('batch-progress-bar', batch.pct);
    setText('batch-progress-detail', `Batch ${batch.batchId || '\u2014'} \u00b7 ${batch.traineeCount} trainee${batch.traineeCount === 1 ? '' : 's'}`);

    const batchDisplay = document.getElementById('trainee-batch-display');
    if (batchDisplay) batchDisplay.textContent = 'Batch ' + (batch.batchId || '\u2014');
}

function renderAdminProgress(data) {
    const s = data.summary;
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setText('admin-landing-active-trainees', s.activeTrainees);
    setText('admin-landing-total-submissions', s.totalSubmissions);
    setText('admin-landing-avg-score', s.avgBatchScore !== null ? s.avgBatchScore + '%' : '\u2014');
    setText('admin-landing-pending-grades', s.pendingGrades);

    const body = document.getElementById('admin-progress-tracker-body');
    if (!body) return;

    if (!data.trainees.length) {
        body.innerHTML = `<tr><td colspan="5" class="text-xs text-slate-400 p-4">No trainees yet.</td></tr>`;
        return;
    }

    body.innerHTML = data.trainees.map(t => `
        <tr>
            <td class="font-bold">${escapeHtml(t.fullName)}</td>
            <td>${escapeHtml(t.batchId)}</td>
            <td class="font-mono">${t.pct}% <span class="text-slate-400">(${t.completed}/${t.total})</span></td>
            <td class="font-mono ${t.pendingChecks > 0 ? 'text-red-600 font-bold' : ''}">${t.pendingChecks}</td>
            <td class="font-mono font-bold ${t.avgScore !== null ? 'text-emerald-700' : 'text-slate-400'}">${t.avgScore !== null ? t.avgScore + '%' : '\u2014'}</td>
        </tr>
    `).join('');
}

// ===== LIVE LEADERBOARD (pulls from every approved trainee, shown on both trainee + admin landing) =====
async function loadLeaderboardData() {
    const session = getSession();
    if (!session) return;

    try {
        const res = await fetch('/api/leaderboard', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok || !data.success) return;
        renderLeaderboard(data.leaderboard, 'leaderboard-body', 'leaderboard-updated');
        renderLeaderboard(data.leaderboard, 'admin-leaderboard-body', 'admin-leaderboard-updated');
    } catch (e) {
        console.warn('Failed to load leaderboard', e);
    }
}

function renderLeaderboard(rows, bodyId, updatedId) {
    const body = document.getElementById(bodyId);
    if (!body) return;

    if (!rows || rows.length === 0) {
        body.innerHTML = `<tr><td colspan="5" class="text-xs text-slate-400 p-4">No graded activity yet.</td></tr>`;
    } else {
        body.innerHTML = rows.map(r => `
            <tr>
                <td class="font-mono font-bold ${r.rank <= 3 ? 'text-orange-600' : ''}">#${r.rank}</td>
                <td class="font-bold">${escapeHtml(r.fullName)}</td>
                <td>${escapeHtml(r.batchId)}</td>
                <td class="font-mono">${r.activitiesCompleted}</td>
                <td class="font-mono font-bold ${r.rating !== null ? 'text-emerald-700' : 'text-slate-400'}">${r.rating !== null ? r.rating + '%' : '\u2014'}</td>
            </tr>
        `).join('');
    }

    const updatedEl = document.getElementById(updatedId);
    if (updatedEl) {
        updatedEl.textContent = ' \u00b7 ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
}

// ===== ACTIVITY LIFECYCLE: create (Draft), edit, publish/unpublish, close, archive =====
async function saveNewActivity() {
    const title = document.getElementById('act-title-input').value.trim();
    if (!title) {
        showToast('Title is required.', 'error');
        return;
    }
    try {
        await postJson('/api/activities', { action: 'CREATE', title });
        closeModals();
        document.getElementById('act-title-input').value = '';
        showToast('Draft created. Open it to add instructions, a deadline, and items.', 'success');
        loadActivitiesData();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// Opens the full-view/edit workspace for a single activity — instructions,
// deadline, attached deck, and question items all live here, gated by
// whether the activity is currently editable (Draft / Unpublished).
function openActivityDetail(activityId) {
    const activity = __activitiesCache.find(a => a.id === activityId);
    if (!activity) { showToast('Activity not found.', 'error'); return; }

    __currentDetailActivity = activity;
    const editable = activity.status === 'Draft' || activity.status === 'Unpublished';

    const titleInput = document.getElementById('ad-title-input');
    titleInput.value = activity.title;
    titleInput.disabled = !editable;

    const statusBadge = document.getElementById('ad-status-badge');
    statusBadge.textContent = activity.status;
    statusBadge.className = 'status-pill status-' + String(activity.status).toLowerCase();

    document.getElementById('ad-day-label').textContent = activity.day_label;
    document.getElementById('ad-lock-notice').classList.toggle('hidden', editable);

    const instructionsInput = document.getElementById('ad-instructions-input');
    instructionsInput.value = activity.instructions || '';
    instructionsInput.disabled = !editable;

    const deadlineInput = document.getElementById('ad-deadline-input');
    const openDeadlineInput = document.getElementById('ad-open-deadline-input');
    deadlineInput.value = activity.deadline ? isoToLocalInputValue(activity.deadline) : '';
    openDeadlineInput.checked = !!activity.open_deadline;
    deadlineInput.disabled = !editable || openDeadlineInput.checked;
    openDeadlineInput.disabled = !editable;

    const fileInput = document.getElementById('ad-file-input');
    fileInput.value = activity.file_url || '';
    fileInput.disabled = !editable;

    document.getElementById('ad-save-btn').classList.toggle('hidden', !editable);
    document.getElementById('ad-add-item-btn').classList.toggle('hidden', !editable);
    const addItemForm = document.getElementById('ad-add-item-form');
    addItemForm.classList.add('hidden');

    renderActivityActionRow(activity);
    renderActivityItemsList(activity, editable);

    document.getElementById('modal-activity-detail').classList.add('open');
}

function renderActivityActionRow(activity) {
    const row = document.getElementById('ad-action-row');
    const buttons = [];

    if (activity.status === 'Draft' || activity.status === 'Unpublished') {
        buttons.push(`<button class="mini-btn approve" onclick="publishActivityAction(${activity.id})">Publish</button>`);
    }
    if (activity.status === 'Published') {
        buttons.push(`<button class="mini-btn reject" onclick="unpublishActivityAction(${activity.id})">Unpublish</button>`);
    }
    if (activity.status !== 'Closed') {
        buttons.push(`<button class="mini-btn" style="background:#f1f5f9;color:#475569;" onclick="closeActivityAction(${activity.id})">Close</button>`);
    }
    if (activity.status === 'Closed' || activity.status === 'Draft') {
        buttons.push(`<button class="mini-btn reject" onclick="removeActivityAction(${activity.id})">Remove (Archive)</button>`);
    }

    row.innerHTML = buttons.join('');
}

function renderActivityItemsList(activity, editable) {
    const list = document.getElementById('ad-items-list');
    const questions = Array.isArray(activity.questions) ? activity.questions : [];

    if (questions.length === 0) {
        list.innerHTML = `<p class="text-[10px] text-slate-400">No items yet. Use "+ Add Item" to build the question the trainee will answer.</p>`;
        return;
    }

    list.innerHTML = questions.map((q, i) => `
        <div class="admin-tile" style="text-align:left;">
            <div class="flex justify-between items-start gap-2">
                <div style="flex:1;">
                    ${q.scenario ? `<div style="font-size:11px;color:#64748b;font-style:italic;white-space:pre-wrap;margin-bottom:6px;border-left:3px solid #cbd5e1;padding-left:8px;">${escapeHtml(q.scenario)}</div>` : ''}
                    <div style="font-weight:800;font-size:12px;color:var(--navy);">${i + 1}. ${escapeHtml(q.prompt)}</div>
                    <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${escapeHtml(questionTypeLabel(q.type))} &middot; ${q.points} pt${q.points === 1 ? '' : 's'}${q.correctAnswer ? ` &middot; Answer key: ${escapeHtml(q.correctAnswer)}` : ''}</div>
                </div>
                ${editable ? `<button class="text-red-500 hover:text-red-700 font-bold text-xs uppercase flex-shrink-0" onclick="removeActivityItem('${q.id}')">Remove</button>` : ''}
            </div>
        </div>
    `).join('');
}

function questionTypeLabel(type) {
    return { mcq: 'Multiple Choice', truefalse: 'True / False', short: 'Short Answer', essay: 'Essay' }[type] || type;
}

// datetime-local inputs work in local time with no timezone suffix; this
// converts a stored ISO string into that local "YYYY-MM-DDTHH:mm" shape.
function isoToLocalInputValue(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function onOpenDeadlineToggle() {
    const openChecked = document.getElementById('ad-open-deadline-input').checked;
    const deadlineInput = document.getElementById('ad-deadline-input');
    deadlineInput.disabled = openChecked;
    if (openChecked) deadlineInput.value = '';
}

function previewAttachedDeck() {
    if (!__currentDetailActivity) return;
    const fileUrl = document.getElementById('ad-file-input').value.trim();
    if (!fileUrl) { showToast('No file attached yet.', 'error'); return; }
    viewDeck(__currentDetailActivity.id, __currentDetailActivity.title, fileUrl);
}

async function saveActivityEdits() {
    if (!__currentDetailActivity) return;
    const title = document.getElementById('ad-title-input').value.trim();
    const instructions = document.getElementById('ad-instructions-input').value;
    const fileUrl = document.getElementById('ad-file-input').value.trim();
    const openDeadline = document.getElementById('ad-open-deadline-input').checked;
    const deadlineRaw = document.getElementById('ad-deadline-input').value;
    const deadline = (!openDeadline && deadlineRaw) ? new Date(deadlineRaw).toISOString() : null;

    if (!title) { showToast('Title is required.', 'error'); return; }

    try {
        await postJson('/api/activities', {
            action: 'UPDATE', id: __currentDetailActivity.id,
            title, instructions, fileUrl, openDeadline, deadline
        });
        showToast('Changes saved.', 'success');
        await loadActivitiesData();
        const refreshed = __activitiesCache.find(a => a.id === __currentDetailActivity.id);
        if (refreshed) openActivityDetail(refreshed.id);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function toggleAddItemForm() {
    const form = document.getElementById('ad-add-item-form');
    const opening = form.classList.contains('hidden');
    form.classList.toggle('hidden');
    if (opening) {
        document.getElementById('ad-item-scenario').value = '';
        document.getElementById('ad-item-prompt').value = '';
        document.getElementById('ad-item-type').value = 'mcq';
        document.getElementById('ad-item-points').value = '1';
        onNewItemTypeChange();
    }
}

function onNewItemTypeChange() {
    const type = document.getElementById('ad-item-type').value;
    const fieldsEl = document.getElementById('ad-item-type-fields');
    if (type === 'mcq') {
        fieldsEl.innerHTML = `
            <label style="font-size:10px;display:block;margin-bottom:4px;">Choices (one per line)</label>
            <textarea id="ad-item-choices" class="prof-input" rows="4" style="width:100%;margin-bottom:8px;"></textarea>
            <label style="font-size:10px;display:block;margin-bottom:4px;">Correct Answer (must match a choice exactly)</label>
            <input type="text" id="ad-item-correct" style="width:100%;" placeholder="Paste the exact correct choice">
        `;
    } else if (type === 'truefalse') {
        fieldsEl.innerHTML = `
            <label style="font-size:10px;display:block;margin-bottom:4px;">Correct Answer</label>
            <select id="ad-item-correct" class="prof-input" style="width:100%;">
                <option value="true">True</option>
                <option value="false">False</option>
            </select>
        `;
    } else if (type === 'short') {
        fieldsEl.innerHTML = `
            <label style="font-size:10px;display:block;margin-bottom:4px;">Correct Answer (exact match, case-insensitive)</label>
            <input type="text" id="ad-item-correct" style="width:100%;" placeholder="e.g. habeas corpus">
        `;
    } else {
        fieldsEl.innerHTML = `<p class="text-[10px] text-slate-400">Trainee gets a free-text response box. This item always requires manual grading.</p>`;
    }
}

async function saveNewItem() {
    if (!__currentDetailActivity) return;
    const scenario = document.getElementById('ad-item-scenario').value.trim();
    const prompt = document.getElementById('ad-item-prompt').value.trim();
    const type = document.getElementById('ad-item-type').value;
    const points = parseInt(document.getElementById('ad-item-points').value, 10) || 1;

    if (!prompt) { showToast('Question text is required.', 'error'); return; }

    const question = { scenario, prompt, type, points };
    const correctInput = document.getElementById('ad-item-correct');
    if (type === 'mcq') {
        const choicesInput = document.getElementById('ad-item-choices');
        question.choices = choicesInput.value.split('\n').map(c => c.trim()).filter(Boolean);
        question.correctAnswer = correctInput ? correctInput.value.trim() : '';
    } else if (type === 'truefalse' || type === 'short') {
        question.correctAnswer = correctInput ? correctInput.value.trim() : '';
    }

    try {
        await postJson('/api/activities', { action: 'ADD_QUESTION', id: __currentDetailActivity.id, question });
        showToast('Item added.', 'success');
        toggleAddItemForm();
        await loadActivitiesData();
        const refreshed = __activitiesCache.find(a => a.id === __currentDetailActivity.id);
        if (refreshed) openActivityDetail(refreshed.id);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function removeActivityItem(questionId) {
    if (!__currentDetailActivity) return;
    if (!confirm('Remove this item?')) return;
    try {
        await postJson('/api/activities', { action: 'REMOVE_QUESTION', id: __currentDetailActivity.id, questionId });
        await loadActivitiesData();
        const refreshed = __activitiesCache.find(a => a.id === __currentDetailActivity.id);
        if (refreshed) openActivityDetail(refreshed.id);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function publishActivityAction(id) {
    try {
        await postJson('/api/activities', { action: 'PUBLISH', id });
        showToast('Activity published — trainees can now see it.', 'success');
        await loadActivitiesData();
        const refreshed = __activitiesCache.find(a => a.id === id);
        if (refreshed) openActivityDetail(refreshed.id); else closeModals();
        loadProgressData();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function unpublishActivityAction(id) {
    try {
        await postJson('/api/activities', { action: 'UNPUBLISH', id });
        showToast('Activity unpublished. It can now be edited.', 'success');
        await loadActivitiesData();
        const refreshed = __activitiesCache.find(a => a.id === id);
        if (refreshed) openActivityDetail(refreshed.id); else closeModals();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function closeActivityAction(id) {
    if (!confirm('Close this activity? Trainees will no longer be able to submit new answers.')) return;
    try {
        await postJson('/api/activities', { action: 'CLOSE', id });
        showToast('Activity closed.', 'success');
        await loadActivitiesData();
        const refreshed = __activitiesCache.find(a => a.id === id);
        if (refreshed) openActivityDetail(refreshed.id); else closeModals();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function removeActivityAction(id) {
    if (!confirm('Remove this activity? It will be moved to the archive.')) return;
    try {
        const res = await fetch(`/api/activities?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.success) {
            throw new Error((data && data.error) || 'Failed to remove.');
        }
        showToast('Archived.', 'success');
        closeModals();
        loadActivitiesData();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ===== ARCHIVE PANEL =====
async function toggleArchivePanel() {
    const panel = document.getElementById('admin-archive-panel');
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if (opening) loadArchiveData();
}

async function loadArchiveData() {
    const body = document.getElementById('admin-archive-body');
    if (!body) return;
    try {
        const res = await fetch('/api/activities-archive', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load archive.');

        if (!data.archive.length) {
            body.innerHTML = `<tr><td colspan="5" class="text-xs text-slate-400 p-4">Nothing archived yet.</td></tr>`;
            return;
        }

        body.innerHTML = data.archive.map(a => `
            <tr>
                <td class="font-bold">${escapeHtml(a.title)}</td>
                <td>${escapeHtml(a.day_label)}</td>
                <td><span class="status-pill status-${String(a.status).toLowerCase()}">${escapeHtml(a.status)}</span></td>
                <td>${escapeHtml(a.archived_by)}</td>
                <td>${formatDate(a.archived_at)}</td>
            </tr>
        `).join('');
    } catch (e) {
        body.innerHTML = `<tr><td colspan="5" class="text-xs text-red-500 p-4">Failed to load: ${escapeHtml(e.message)}</td></tr>`;
    }
}

// Placeholder Action — lecture embeds not in scope for this pass
async function saveNewLecture() {
    const title = document.getElementById('lec-title-input').value.trim();
    const embedUrl = document.getElementById('lec-url-input').value.trim();
    const summary = document.getElementById('lec-summary-input').value.trim();

    if (!title || !embedUrl) {
        showToast('Title and Embed URL are required.', 'error');
        return;
    }

    try {
        await postJson('/api/lectures', { title, embedUrl, summary });
        closeModals();
        document.getElementById('lec-title-input').value = '';
        document.getElementById('lec-url-input').value = '';
        document.getElementById('lec-summary-input').value = '';
        showToast('Lecture embed added successfully!', 'success');
        loadLecturesData();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// Collects everything typed/selected in the answer modal and submits it —
// answered, submitted, and (where objective) graded, all without a file upload.
async function confirmSubmission() {
    if (!__currentAnswerActivity) { closeModals(); return; }

    const answers = [];
    document.querySelectorAll('#answer-activity-questions .q-answer-input').forEach(input => {
        if (input.type === 'radio') {
            if (input.checked) answers.push({ questionId: input.dataset.qid, response: input.value });
        } else {
            const val = input.value.trim();
            if (val) answers.push({ questionId: input.dataset.qid, response: val });
        }
    });

    const notes = document.getElementById('sub-notes-input').value.trim();
    const activity = __currentAnswerActivity;
    // Sent regardless of whether the backend currently stores it — see the
    // note in submissions.js about the pending time_spent_seconds column.
    const timeSpentSeconds = __activityStartTime ? Math.round((Date.now() - __activityStartTime) / 1000) : null;

    try {
        await postJson('/api/submissions', {
            action: 'SUBMIT',
            activityId: activity.id,
            activityTitle: activity.title,
            answers,
            notes,
            timeSpentSeconds
        });
        closeModals();
        __currentAnswerActivity = null;
        __activityStartTime = null;
        showToast('Submitted for grading!', 'success');
        loadActivitiesData();
        loadProgressData();
        loadLeaderboardData();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function releaseGrade() {
    const modal = document.getElementById('modal-grade-submission');
    const submissionId = modal.dataset.submissionId;
    const score = document.getElementById('grade-score-input').value.trim();
    const feedback = document.getElementById('grade-feedback-input').value.trim();

    if (!submissionId) { closeModals(); return; }
    if (score === '' || isNaN(Number(score))) {
        showToast('Please enter a valid numeric score.', 'error');
        return;
    }

    try {
        await postJson('/api/submissions', {
            action: 'GRADE',
            submissionId: Number(submissionId),
            score: Number(score),
            feedback
        });
        closeModals();
        showToast('Grade released to trainee!', 'success');
        loadAdminSubmissions();
        loadProgressData();
        loadLeaderboardData();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ===== TRAINEE: MY GRADES & SUBMISSIONS =====
async function loadTraineeGrades() {
    const body = document.getElementById('trainee-grades-body');
    if (!body) return;

    try {
        const res = await fetch('/api/submissions', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load submissions.');
        __mySubmissionsCache = data.submissions;

        if (!data.submissions.length) {
            body.innerHTML = `<tr><td colspan="6" class="text-xs text-slate-400 p-4">You haven't submitted anything yet.</td></tr>`;
            return;
        }

        body.innerHTML = data.submissions.map(s => {
            const statusPill = s.status === 'Graded'
                ? `<span class="status-pill status-approved">Graded</span>`
                : `<span class="status-pill status-pending">Needs Review</span>`;
            const grade = (s.status === 'Graded' && s.score !== null && s.score !== undefined)
                ? `<span class="font-mono font-bold text-emerald-700">${s.score} / 100</span>`
                : `<span class="text-slate-400">&mdash;</span>`;
            const feedbackText = s.feedback || (s.status === 'Graded' ? '' : 'Awaiting review');
            return `
                <tr>
                    <td class="font-bold">${escapeHtml(s.activity_title)}</td>
                    <td>${formatDate(s.submitted_at)}</td>
                    <td>${statusPill}</td>
                    <td>${grade}</td>
                    <td class="text-xs text-slate-500 italic">${escapeHtml(feedbackText)}</td>
                    <td style="white-space:nowrap;">
                        <button class="mini-btn" onclick="viewMySubmissionDetail(${s.id})">Details</button>
                        <button class="mini-btn approve" onclick="downloadSubmissionReport(${s.id})">PDF</button>
                    </td>
                </tr>
            `;
        }).join('');

        const hasPerfectScore = data.submissions.some(s => s.status === 'Graded' && Number(s.score) === 100);
        if (hasPerfectScore) celebratePerfectGrade();
    } catch (e) {
        body.innerHTML = `<tr><td colspan="6" class="text-xs text-red-500 p-4">Failed to load: ${escapeHtml(e.message)}</td></tr>`;
    }
}

// Read-only detail view for a trainee's own past submission — same
// per-question breakdown the admin sees, minus grading controls.
async function viewMySubmissionDetail(submissionId) {
    const sub = __mySubmissionsCache.find(s => s.id === submissionId);
    if (!sub) { showToast('Submission not found.', 'error'); return; }

    if (!__activitiesCache.length) {
        try {
            const res = await fetch('/api/activities', { credentials: 'include' });
            const data = await res.json();
            if (data.success) __activitiesCache = data.activities;
        } catch (e) { /* detail view still works without the answer-key cross-reference */ }
    }

    document.getElementById('my-submission-subtitle').innerText = sub.activity_title;
    const metaEl = document.getElementById('my-submission-meta');
    const scoreText = (sub.status === 'Graded' && sub.score !== null && sub.score !== undefined)
        ? `${sub.score} / 100`
        : 'Awaiting review';
    metaEl.innerHTML = `Submitted ${escapeHtml(formatDate(sub.submitted_at))} &middot; Status: ${escapeHtml(sub.status)} &middot; Score: ${escapeHtml(String(scoreText))}`;

    const activity = __activitiesCache.find(a => a.id === sub.activity_id);
    document.getElementById('my-submission-answers').innerHTML = renderAiReviewHtml(sub, false) + renderSubmissionAnswersHtml(sub, activity);
    document.getElementById('modal-my-submission').dataset.submissionId = submissionId;
    document.getElementById('modal-my-submission').classList.add('open');
}

// Generates a PDF report for a submission — works from either cache
// (__submissionsCache for admins, __mySubmissionsCache for trainees),
// whichever the calling context has populated. Same underlying content
// as the on-screen detail views (renderSubmissionAnswersHtml /
// buildSubmissionReportLines), just laid out for print.
async function downloadSubmissionReport(submissionId) {
    const sub = __submissionsCache.find(s => s.id === submissionId) || __mySubmissionsCache.find(s => s.id === submissionId);
    if (!sub) { showToast('Submission not found.', 'error'); return; }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast('PDF library failed to load — check your connection and try again.', 'error');
        return;
    }

    if (!__activitiesCache.length) {
        try {
            const res = await fetch('/api/activities', { credentials: 'include' });
            const data = await res.json();
            if (data.success) __activitiesCache = data.activities;
        } catch (e) { /* report still generates without the answer-key cross-reference */ }
    }
    const activity = __activitiesCache.find(a => a.id === sub.activity_id);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 48;
    const maxWidth = pageWidth - marginX * 2;
    let y = 0;

    function ensureSpace(height) {
        if (y + height > pageHeight - 56) {
            doc.addPage();
            y = 48;
        }
    }

    // Header band
    doc.setFillColor(15, 33, 72);
    doc.rect(0, 0, pageWidth, 70, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('LSH TRC', marginX, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Activity Report', marginX, 48);

    y = 96;
    doc.setTextColor(15, 33, 72);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(sub.activity_title || 'Activity', marginX, y);
    y += 22;

    // This is the one piece "Time Spent" is waiting on — the submissions
    // table doesn't have a time-tracking column yet, so this shows
    // "Not tracked" until that's added server-side.
    const scoreText = (sub.status === 'Graded' && sub.score !== null && sub.score !== undefined) ? `${sub.score} / 100` : 'Awaiting review';
    const timeSpentText = (sub.time_spent_seconds !== undefined && sub.time_spent_seconds !== null)
        ? `${Math.floor(sub.time_spent_seconds / 60)}m ${sub.time_spent_seconds % 60}s`
        : 'Not tracked';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    [
        `Trainee: ${sub.trainee_name || sub.trainee_username}`,
        `Submitted: ${formatDate(sub.submitted_at)}`,
        `Status: ${sub.status}`,
        `Score: ${scoreText}`,
        `Time Spent: ${timeSpentText}`
    ].forEach(line => { doc.text(line, marginX, y); y += 14; });

    y += 8;
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 20;

    buildSubmissionReportLines(sub, activity).forEach(line => {
        if (line.type === 'spacer') { y += 10; return; }

        let color = [30, 41, 59], font = ['helvetica', 'normal'], size = 10;
        if (line.type === 'question') { color = [15, 33, 72]; font = ['helvetica', 'bold']; size = 11; }
        else if (line.type === 'scenario') { color = [100, 116, 139]; font = ['helvetica', 'italic']; size = 9; }
        else if (line.type === 'label') { color = [15, 33, 72]; font = ['helvetica', 'bold']; size = 10; }
        else if (line.type === 'status-good') { color = [22, 101, 52]; font = ['helvetica', 'bold']; size = 9; }
        else if (line.type === 'status-bad') { color = [185, 28, 28]; font = ['helvetica', 'bold']; size = 9; }
        else if (line.type === 'status-neutral') { color = [148, 163, 184]; font = ['helvetica', 'bold']; size = 9; }

        doc.setFont(font[0], font[1]);
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const wrapped = doc.splitTextToSize(line.text, maxWidth);
        ensureSpace(wrapped.length * 12 + 6);
        doc.text(wrapped, marginX, y);
        y += wrapped.length * 12 + 4;
    });

    if (sub.feedback) {
        ensureSpace(40);
        y += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 33, 72);
        doc.text('Evaluator Feedback', marginX, y);
        y += 14;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        const wrapped = doc.splitTextToSize(sub.feedback, maxWidth);
        ensureSpace(wrapped.length * 12);
        doc.text(wrapped, marginX, y);
        y += wrapped.length * 12;
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Generated ${new Date().toLocaleString()} \u2014 LSH TRC`, marginX, pageHeight - 30);
        doc.text(`Page ${p} of ${pageCount}`, pageWidth - marginX - 60, pageHeight - 30);
    }

    const safeTrainee = (sub.trainee_username || 'trainee').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    const safeTitle = (sub.activity_title || 'activity').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    doc.save(`${safeTrainee}_${safeTitle}_report.pdf`);
    playSound('notification');
}

// ===== PERFECT SCORE CELEBRATION (confetti + 10s rock "Auld Lang Syne") =====
// Fires every time the Grades & Submissions view is opened while at least
// one graded submission is a perfect 100 — see loadTraineeGrades() above.
function celebratePerfectGrade() {
    showConfettiCelebration();
    showPerfectScoreBanner();
    playRockAuldLangSyne();
}

function showPerfectScoreBanner() {
    const banner = document.createElement('div');
    banner.textContent = '🎉 Perfect Score! 🎉';
    banner.style.cssText = `
        position: fixed; top: 90px; left: 50%; transform: translateX(-50%) scale(0.85);
        background: linear-gradient(135deg, #f97316, #dc2626);
        color: #fff; font-family: 'IBM Plex Sans', Arial, sans-serif;
        font-size: 22px; font-weight: 900; letter-spacing: 0.03em;
        padding: 14px 32px; border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,0.35);
        z-index: 9998; opacity: 0; transition: opacity 0.4s ease, transform 0.4s ease;
        pointer-events: none;
    `;
    document.body.appendChild(banner);
    requestAnimationFrame(() => {
        banner.style.opacity = '1';
        banner.style.transform = 'translateX(-50%) scale(1)';
    });
    setTimeout(() => {
        banner.style.opacity = '0';
        banner.style.transform = 'translateX(-50%) scale(0.9)';
        setTimeout(() => banner.remove(), 450);
    }, 3200);
}

function showConfettiCelebration() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9997;';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx2d = canvas.getContext('2d');

    const colors = ['#f97316', '#facc15', '#22c55e', '#3b82f6', '#ec4899', '#ffffff', '#dc2626'];
    const particles = [];
    const count = 180;
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: -20 - Math.random() * canvas.height * 0.5,
            w: 6 + Math.random() * 6,
            h: 10 + Math.random() * 8,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: 2 + Math.random() * 3,
            speedX: (Math.random() - 0.5) * 2,
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 10
        });
    }

    let frame = 0;
    const maxFrames = 60 * 6; // ~6 seconds at 60fps
    function animate() {
        ctx2d.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.rotSpeed;
            ctx2d.save();
            ctx2d.translate(p.x, p.y);
            ctx2d.rotate(p.rotation * Math.PI / 180);
            ctx2d.fillStyle = p.color;
            ctx2d.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx2d.restore();
        });
        frame++;
        if (frame < maxFrames) {
            requestAnimationFrame(animate);
        } else {
            canvas.remove();
        }
    }
    animate();
}

// Original rock-style arrangement of the traditional "Auld Lang Syne"
// melody (public domain — Robert Burns, 1788) — not a reproduction of any
// particular recording or copyrighted arrangement. ~10 seconds: drums,
// bass power chords, and a distorted lead carrying the tune.
function makeRockDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
}

function playRockAuldLangSyne() {
    let c;
    try {
        c = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }

    const BPM = 150;
    const beatSec = 60 / BPM;

    const distortion = c.createWaveShaper();
    distortion.curve = makeRockDistortionCurve(320);
    distortion.oversample = '4x';

    function leadNote(freq, beat, durBeats, gain) {
        const t0 = c.currentTime + beat * beatSec;
        const dur = durBeats * beatSec * 0.92;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(distortion).connect(g).connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
    }

    function powerChordHit(freq, beat, durBeats, gain) {
        const t0 = c.currentTime + beat * beatSec;
        const dur = durBeats * beatSec * 0.9;
        [freq, freq * 1.5].forEach(f => {
            const osc = c.createOscillator();
            const g = c.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(f, t0);
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            osc.connect(distortion).connect(g).connect(c.destination);
            osc.start(t0);
            osc.stop(t0 + dur + 0.05);
        });
    }

    function kick(beat) {
        const t0 = c.currentTime + beat * beatSec;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, t0);
        osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
        g.gain.setValueAtTime(0.9, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
        osc.connect(g).connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + 0.2);
    }

    function noiseHit(beat, dur, gain, filterFreq, isHat) {
        const t0 = c.currentTime + beat * beatSec;
        const bufferSize = Math.max(1, Math.floor(c.sampleRate * dur));
        const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = c.createBufferSource();
        noise.buffer = buffer;
        const filter = c.createBiquadFilter();
        filter.type = isHat ? 'highpass' : 'bandpass';
        filter.frequency.value = filterFreq;
        const g = c.createGain();
        g.gain.setValueAtTime(gain, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        noise.connect(filter).connect(g).connect(c.destination);
        noise.start(t0);
    }
    const snare = beat => noiseHit(beat, 0.15, 0.5, 1800, false);
    const hihat = (beat, open) => noiseHit(beat, open ? 0.18 : 0.05, 0.18, 8000, true);

    // Driving 4-beat drum pattern, looped across the whole piece.
    for (let b = 0; b < 26; b += 4) {
        kick(b); kick(b + 2);
        snare(b + 1); snare(b + 3);
        for (let h = 0; h < 4; h += 0.5) hihat(b + h, h === 3.5);
    }

    // Bass / power chords — simple I-IV-V-I progression under the melody.
    const C3 = 130.81, F3 = 174.61, G3 = 196.00;
    [
        { f: C3, b: 0, d: 4 }, { f: F3, b: 4, d: 4 }, { f: G3, b: 8, d: 4 }, { f: C3, b: 12, d: 4 },
        { f: C3, b: 16, d: 4 }, { f: F3, b: 20, d: 4 }, { f: C3, b: 24, d: 2 }
    ].forEach(n => powerChordHit(n.f, n.b, n.d, 0.22));

    // Lead melody — the traditional Auld Lang Syne tune, transposed to C major.
    const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, G4 = 392.00;
    [
        { f: G4, b: 0, d: 1 }, { f: C5, b: 1, d: 1 }, { f: C5, b: 2, d: 1 }, { f: D5, b: 3, d: 1 },
        { f: C5, b: 4, d: 1 }, { f: F5, b: 5, d: 1 }, { f: E5, b: 6, d: 2 },
        { f: C5, b: 8, d: 1 }, { f: C5, b: 9, d: 1 }, { f: D5, b: 10, d: 1 }, { f: C5, b: 11, d: 1 },
        { f: G5, b: 12, d: 1 }, { f: F5, b: 13, d: 2 },
        { f: C5, b: 16, d: 1 }, { f: E5, b: 17, d: 1 }, { f: D5, b: 18, d: 1 }, { f: C5, b: 19, d: 1 },
        { f: D5, b: 20, d: 1 }, { f: C5, b: 21, d: 3 },
        { f: C5, b: 24, d: 2 }
    ].forEach(n => leadNote(n.f, n.b, n.d, 0.28));
}

// ===== ADMIN: SUBMITTED ACTIVITIES & GRADING =====
async function loadAdminSubmissions() {
    const body = document.getElementById('admin-submissions-body');
    if (!body) return;

    try {
        const res = await fetch('/api/submissions', { credentials: 'include' });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load submissions.');
        __submissionsCache = data.submissions;

        if (!__submissionsCache.length) {
            body.innerHTML = `<tr><td colspan="6" class="text-xs text-slate-400 p-4">No submissions yet.</td></tr>`;
            return;
        }

        body.innerHTML = __submissionsCache.map(s => {
            const statusCell = s.status === 'Graded'
                ? `<span class="status-pill status-approved">Graded &middot; ${s.score}%</span>`
                : `<span class="status-pill status-pending">Needs Review</span>`;
            const answerCount = Array.isArray(s.answers) ? s.answers.length : 0;
            const autoNote = (s.auto_score !== null && s.auto_score !== undefined) ? ` &middot; auto ${s.auto_score}pt` : '';
            return `
                <tr>
                    <td class="font-bold">${escapeHtml(s.trainee_name)}</td>
                    <td>${escapeHtml(s.activity_title)}</td>
                    <td>${formatDate(s.submitted_at)}</td>
                    <td class="text-xs">${answerCount} answer${answerCount === 1 ? '' : 's'}${autoNote}</td>
                    <td>${statusCell}</td>
                    <td><button class="mini-btn approve" onclick="openGradeModal(${s.id})">${s.status === 'Graded' ? 'Review' : 'Grade'}</button></td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        body.innerHTML = `<tr><td colspan="6" class="text-xs text-red-500 p-4">Failed to load: ${escapeHtml(e.message)}</td></tr>`;
    }
}

// 5. CLOCK & NOTIFICATIONS
function refreshClock() {
    const tzSelect = document.getElementById('tz-select');
    const clockEl = document.getElementById('live-clock');
    if (!tzSelect || !clockEl) return; // this page has no clock widget — nothing to do
    const tz = tzSelect.value;
    const now = new Date();
    clockEl.innerText = new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: tz, hour12: true
    }).format(now);
}
setInterval(refreshClock, 1000);

function showToast(message, type = 'info', duration = 3500, options = {}) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast ' + type + ' show';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
    // playToastSound is defined in portal.js — covers submitSuccess/
    // submitError/notification automatically for every toast in the app,
    // unless the caller already played a more specific dedicated sound
    // (login, announcement, lock, etc.) and passed skipSound to avoid
    // doubling up.
    if (!options.skipSound && typeof playToastSound === 'function') playToastSound(type);
}

// 6. DYNAMIC BRAND MARK INJECTION
function renderAgencyLogo() {
    const imgTag = `<img src="/favicon.png" onerror="this.src='${AGENCY_LOGO}'" alt="LSH Logo" style="width:100%;height:100%;object-fit:cover;">`;
    document.querySelectorAll('#agency-seal, #agency-seal-admin, #auth-seal').forEach(el => {
        el.innerHTML = imgTag;
    });
}

// BOOTSTRAP INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
    renderAgencyLogo();
    refreshClock();
    applySessionUI();
    loadAnnouncement();
    // Runs on every page load with a valid session — not just right after
    // login — so it also covers a session that was already active when
    // core.html loads directly (bookmarked link, tab restore, etc.), not
    // only the moment right after attemptLogin()'s redirect.
    if (getSession()) { startHeartbeat(); startIdleTracking(); }
});

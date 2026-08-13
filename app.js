// =========================================================
// LSH TRAINING ACTIVITIES PORTAL — CORE SCRIPT
// =========================================================

let siteIsLocked = false;
let siteLockedByAdmin = false;
const SESSION_KEY = 'LSH_SESSION_V1';
const HEARTBEAT_INTERVAL_MS = 2000;
const LIVE_DATA_INTERVAL_MS = 15000;
let heartbeatIntervalId = null;
let liveDataIntervalId = null;
let __activitiesCache = [];
let __submissionsCache = [];
let __currentAnswerActivity = null;
let __currentDetailActivity = null;
let __questionRowCounter = 0;
// Fallback base64 seal if local favicon file fails to load
const AGENCY_LOGO = "data:image/png;base64,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";

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
function switchView(viewId) {
    document.querySelectorAll('.portal-view-section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.view-nav-btn').forEach(btn => {
        btn.classList.remove('bg-slate-800', 'text-orange-400');
        btn.classList.add('text-slate-300');
    });

    const target = document.getElementById('view-' + viewId);
    const navBtn = document.getElementById('nav-' + viewId);
    if (target) target.classList.remove('hidden');
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
}

// 2. SESSION & UI BOOTSTRAP
function applySessionUI() {
    const session = getSession();
    const gate = document.getElementById('auth-gate');
    const title = document.getElementById('portal-title');
    const traineeSidebar = document.getElementById('sidebar-trainee');
    const adminSidebar = document.getElementById('sidebar-admin');

    if (!session) {
        if (gate) gate.classList.add('open');
        traineeSidebar.classList.add('hidden');
        adminSidebar.classList.add('hidden');
        title.innerText = 'LEGAL SUPPORT HELP TRAINING INTERFACE';
        stopLiveDataPolling();
        return;
    }

    if (gate) gate.classList.remove('open');
    startLiveDataPolling();
    title.innerText = `LEGAL SUPPORT HELP TRAINING INTERFACE - ${session.userType.toUpperCase()} PORTAL`;

    if (session.userType === 'Admin') {
        adminSidebar.classList.remove('hidden');
        traineeSidebar.classList.add('hidden');
        document.getElementById('session-footer-admin').innerHTML = `
            <div class="session-user-tag text-center text-xs text-slate-400 mb-2 font-mono">Signed in as: <b class="text-white">${session.fullName || session.username}</b></div>
            <button class="w-full border border-emerald-600 text-emerald-400 py-2 rounded text-xs font-bold uppercase mb-2" onclick="openAdminDashboard()">⇄ Master Control</button>
            <button class="w-full border border-red-800 text-red-400 py-2 rounded text-xs font-bold uppercase" onclick="logoutSession()">Log Out</button>
        `;
        switchView('admin-landing');
    } else {
        traineeSidebar.classList.remove('hidden');
        adminSidebar.classList.add('hidden');
        document.getElementById('session-footer-trainee').innerHTML = `
            <div class="session-user-tag text-center text-xs text-slate-400 mb-2 font-mono">Signed in as: <b class="text-white">${session.fullName || session.username}</b></div>
            <button class="w-full border border-red-800 text-red-400 py-2 rounded text-xs font-bold uppercase" onclick="logoutSession()">Log Out</button>
        `;
        switchView('trainee-landing');
    }
}

function logoutSession() {
    stopHeartbeat();
    stopLiveDataPolling();
    clearSession();
    applySessionUI();
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
            body: JSON.stringify({ fullName: session.fullName || session.username, currentCase: null })
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
}

function stopHeartbeat() {
    if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
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
    loadUsersData();
}
function exitMasterControl() {
    document.getElementById('master-control-page').classList.remove('open');
}
const MC_TABS = ['overview', 'registrations', 'users', 'monitoring', 'activity-logs', 'announce', 'access'];
function showAdminDashTab(tab) {
    document.querySelectorAll('.mc-tab').forEach((t, i) => t.classList.toggle('active', MC_TABS[i] === tab));
    document.querySelectorAll('.mc-pane').forEach(p => p.classList.remove('active'));
    const pane = document.getElementById('admin-dash-' + tab);
    if (pane) pane.classList.add('active');
    if (tab === 'registrations' || tab === 'users') loadUsersData();
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
        const text = (data && data.text) || 'Welcome to the LSH Training Activities Portal.';
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
        showToast('Announcement broadcast.', 'success');
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

// Opens the grading modal for a specific submission id, showing every
// answer alongside auto-graded correctness so the admin doesn't need to
// cross-reference the answer key separately.
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

    document.getElementById('grade-modal-answers').innerHTML = html;
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
function getDeckEmbedUrl(fileUrl) {
    if (!fileUrl) return null;
    const driveMatch = fileUrl.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (driveMatch) {
        return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
    if (/^https?:\/\//i.test(fileUrl) && /\.(pptx|ppt)(\?|$)/i.test(fileUrl)) {
        return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
    }
    return null; // unrecognized format, fall back to a link
}

function viewDeck(id, title, fileUrl) {
    const pane = document.getElementById('deck-viewer-pane');
    const titleEl = document.getElementById('deck-viewer-title');
    const holder = document.getElementById('deck-viewer-frame-holder');

    titleEl.textContent = title || 'Lesson Deck';

    const embedUrl = getDeckEmbedUrl(fileUrl);
    if (embedUrl) {
        holder.innerHTML = `<iframe src="${embedUrl}" allowfullscreen sandbox="allow-scripts allow-same-origin allow-popups"></iframe>`;
    } else if (fileUrl) {
        holder.innerHTML = `<div id="deck-viewer-fallback">This deck's file link can't be previewed inline.<br><a href="${fileUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--navy);font-weight:700;">Open in a new tab &rarr;</a></div>`;
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

// Drag support for the deck viewer pane (mouse + touch)
(function initDeckViewerDrag() {
    document.addEventListener('DOMContentLoaded', () => {
        const pane = document.getElementById('deck-viewer-pane');
        const header = document.getElementById('deck-viewer-header');
        if (!pane || !header) return;

        let dragging = false;
        let offsetX = 0, offsetY = 0;

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
            newLeft = Math.max(-pane.offsetWidth + 120, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));
            pane.style.left = newLeft + 'px';
            pane.style.top = newTop + 'px';
        }

        function endDrag() { dragging = false; }

        header.addEventListener('mousedown', (e) => {
            if (e.target.id === 'deck-viewer-close') return;
            startDrag(e.clientX, e.clientY);
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
        document.addEventListener('mouseup', endDrag);

        header.addEventListener('touchstart', (e) => {
            if (e.target.id === 'deck-viewer-close') return;
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
})();

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
function saveNewLecture() { closeModals(); alert("Lecture embed added successfully!"); }

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

    try {
        await postJson('/api/submissions', {
            action: 'SUBMIT',
            activityId: activity.id,
            activityTitle: activity.title,
            answers,
            notes
        });
        closeModals();
        __currentAnswerActivity = null;
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

        if (!data.submissions.length) {
            body.innerHTML = `<tr><td colspan="5" class="text-xs text-slate-400 p-4">You haven't submitted anything yet.</td></tr>`;
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
                </tr>
            `;
        }).join('');
    } catch (e) {
        body.innerHTML = `<tr><td colspan="5" class="text-xs text-red-500 p-4">Failed to load: ${escapeHtml(e.message)}</td></tr>`;
    }
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
    const tz = document.getElementById('tz-select').value;
    const now = new Date();
    document.getElementById('live-clock').innerText = new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: tz, hour12: true
    }).format(now);
}
setInterval(refreshClock, 1000);

function showToast(message, type = 'info', duration = 3500) {
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
    if (getSession()) startHeartbeat();
});

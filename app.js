// =========================================================
// LSH TRAINING ACTIVITIES PORTAL — CORE SCRIPT
// =========================================================

let siteIsLocked = false;
let siteLockedByAdmin = false;
const SESSION_KEY = 'LSH_SESSION_V1';
const HEARTBEAT_INTERVAL_MS = 2000;
let heartbeatIntervalId = null;
// Fallback base64 seal if local favicon file fails to load
const AGENCY_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAADwCAYAAAA+VemSAAAVkElEQVR42u2daWwc53nHf+/M7M3lIYqSKIq0zVinJcv3bceyk+ZE47hO0gNB0wYJigBB0AD5lF4pWqAokC9Fgn5okSAI0CYpcjmNmzpHbVmWfMiSLNu6ZcmSZZmkxGOXu9xjZt5+mCW5ki1rd0Xq4v8HDERJe3F2fvM8z3saa61FCHFF4oWh5V++9e/s2XeQVCJJaMMr9pdxjEOpXOauO27hj/7wEySTSay1GGPO/SRrwRiC4jijz3yf8tsHwPEA3dfEZYgx4FeILeqn58NfwbPWsuXZF3n6mW1k29oIwytYYMehUCjguS6PPfYxkk0811ZKFA48S+Hwcxg3FoktxGUnsIMtF0n2b6Dn976EB5DJpOloz5LJZK54gV3XIZ1OvnfUPcedzUlkcFJZjBNTBBaXr8Cuh5PIACYSOAxDgjAkrB1XMtHv0KJ8NoQwBBMqAovLVGCia7RW6jo6I0JcuUhgISSwEEICCyEksBASWAghgYUQElgIIYGFkMBCCAkshJDAQggJLIQEFkJIYCGEBBZCAgshJLAQQgILISSwEBJYCCGBhRASWAghgYWQwEIICSyEkMBCSGAhhAQWQkhgIYQEFkICCyEksBBCAgshgYUQElgIIYGFEBJYCAkshJDAQggJLIQEFkJIYCGEBBZCSGAhJLAQQgILISSwEEICCyGBhRASWAghgYWQwEIICSyEkMBCCAkshAQWQkhgIYQEFkJIYCEksBBCAgshJLAQElgIIYGFEBJYCAkshJDAQggJLISQwEJIYCGEBBZCSGAhRLN4OgUXCwOm7uf3xNb9YXXqhAS+pMJaCzbAhrb2c4i1YfRzvbDGwWDAGIzrgXHA1Mlu50FmY5p/jrUX/xxedp9NAl+94gIQQmCxNsSJpXBSbbipdpx4Gre9By/dhXEccD2MFwdrCUp5wkqJsJSjMvQ6wdQEYblYk8xgHBNJPVcXqrXYwK/dQBoxxUY3F8elebNa+HihDzZs4r0sxvFauylJYBFdQwHWWowXJ7ZoOfGea0j2riF1zU14bd2YWBw33YmTzGKMAcetCQFhpYT1y4SVItWxk/iFUSrDR6icPsbU0Z1Ux05g/Urted6Z0bvJqGv9KrFFy+ne9AWcRKYBUSI5ysOvM7btB4SFcXDceUjxDdgAE0/TdcdjpPpvwIbB+SW2FothbPN3KJ3Yi4klFkQ0lsBzlYZawIa4mS5S195KZuXdpK67hVhbN04ijfES5037nHgS4kncdAexzt6Z/wsrRaoTQxQOPUd+9/9SHjpMMJWrBWanhQvVQBjgprvouuOx2ajeAP7kKPnXfkM5PxKl+XMtiQEbhrjxFO0bP0yqf0NTT8/vegJ7/BUMyQXRfiCB5+KKC3yscWhbdR/tN3+MttX346bb30XSulS1vkFrJuWzddfcbF3sJDIklgwSXzJI+8aPMHV0JxM7f0Fh72ZCv4RxYy2LZKslTCx5/jTa2trntBjjXJzzaoMoM5h574bybtXAopl61xLrHiC74YN03v4HxBcPvLNBxTBTxzbeaPPOxitjDF6mi+wND5FcsZ78dbcx/vyPKA8dbj0aGqcWgc9XB9tLUFua2c+2gOpaCXyRLi4b+mTXPUT3ps+T7Fs3GwnN2ZF1DlL0epEsxDqWsOjePyHZv4Ghn/8jpWO7a2m6up0WEhrI0aJQNvRJXXsLPR/6MqmBjXXyNhJpLzQqmZnuqPTAjSx75G9Iv+8OySuBRUOR16+SvvYWlj3ydRLLVtbqrouc5plaemlDUv030Pupf6BtzQMLrh9UAosmG1ZCkv0bWPLxr5HsXR3JaxwuRr/oOWtYGxLv7mfxB75EondNNEgE1YwSWJwpbxhgYgkW3f/ZqHtjRt4mqKW+737YC5DYkly+hs67PoVxYjQ+OENI4AWBBS9OZvX9ZFbe24IgdjbNnm75fcdhZiVvMa3OrnuIzMq7o1FM8veqR63QDafOAW6qnc7bH8XLdDbXNzn9GkB1/G1KJ/ZQzQ0TFsfBcXHTXXht3cQX9RHvuTYaWjkjvWlYXmyIl+2m4/ZPUji0DcJAX50EFpG/Icn+9SSXr2npJYKpHBM7/5vCvi2U3nyFYCpHWClinBgmnsJJpIl19ZEevI3suk2k+te/9+it97hJpFasJ33drRT2b4kGaSywwQ0SWJxlL+DGyKy8By+7uInoG0XQ6sQQI09+m/zuX0XSGgPGxUm0RY8JfcLiOKXCGOWT+ynse4a2te9n0QN/itfW3XgkrnUvxTqXkb3hAxSP7oDA11cogRe2vwQ+XvuSulFWjQgV1bFhZYrxbT8kt+NxsGE0Ymq6zp2pdWuTGgBsSHnkdSqjxzGuR/dDX8SJJZv+2KlrNhLv6qM8dGhmtpO4+lAjVgMG29An1rWc+JLBM1LV8/trKJ3Yy8TLT4D1o9k7Z4hb9+C6fzeOh/UrTLz0cwr7ttSNo244iybePYCb7W5sJo+QwFczNrQ4iQxuMtuwv9ONSsU3duJPDIHxGq9Fa5G6mhthfPtPqE4MRf6G4azo5zyi6G7iSYybUP0rgQVE83tnU9nzz02dTp/Lb+3DBpUWVpYAg6V0Yi9BcTy6ITi1rqYGDmMcEr0rcWIpSawaeIHXwNZi3Fitfm28a8cGPkFhrMUU1oJxCApjFA+/gHHcWt+uqS+x65btqf+8YBwHp7bah/Urms0jgRWFm5IeMK6Hm+lq+ulnv+/pp7/LxPafNX3j8fOnsEFV8kpg0VwrbiSME0+T7FtL7uVfzc4gaoEgfwo/N9R88uC4zQ/1FKqBr7rAa4AwiFLYRtPhWl9xZtV9JHtXYaul1mVyXYwXb/rAuPr+JLAwjoefP0V17GTj0bi2/EyydxXdD/8FXsey2Vq02ZT2vC3P5zg0P1gCCwuOi58boTp2osl6OBI1u24Tyx75K5J9a7GBHy3lOrOUjRCqgefVX+O4BFM5/MnR1iK465Fd/zBuuoPxF39M4eBz+BNvE3VPJevqY0VMIYHnoQgGG1SYOrabtjUP4CYztDKdMD14G8kVN1A8uoP8q7+lfHI/pRN7sNWpaEme6YUB6nd0EEICX2gRbLCBz+Tep+m46aOkBm6sW7yu4RcBLE48Rduqe8msvIfq6HGKr79E+e2DTO5/huqpN7A2iPqdHae2cLqis5DAFxiELcZx8SeGmHjpcRJLr8dJpFucE2xn5vXHuweIdw9g/Qodt36CysgRCge3Ujj0PGEpR1CYiIZVevHZXRAuVVSu/Z5uqp2lj/x1YWkyusnMy+mORr7FewbPeG8hgS/kCoawyuSBZ2lbcz+Z1ffNbInS9OuckSJHF2ty+WqSy1fTtvZB/PwIpRN7yb/6a6qnj1EeOUpQGIu6h2ZmM3FJorJxY6SvuUmXgwS+Amth4+CPv8Xpzd/DxJKkB2+rRaEWI8TMErSzOzI48STx7n7i3f1k1z+MPzFM4dA2ikd3UDq2m/LIkSgqTw/SuBQiX6yUXq30Eng+mDq6ndNPuTjxJKmBjbMXdcupXv2ODLZuVxWXWFcvnbc/SvvNH6N88iBTb+xifPvPqAwfxgbV6AZi3Is7YWHe174WEng+U2mgePgFRp78Nt0PfZHM4G2zXUGGC7y4z9oTd3rjMy9Bqn89qf71tK3bxNTRnYxv/wlTR3di/XLUii0ksGggla5ROLgVP3+K7gc+R/p9dxDrXFYXjS9U5PpoNx2ZoygfX9RHfFEf6evvZGLHL8i//D+Uhw5p2uACREXGBZVoLpXhwww/8U2GHv8ncrueOg/SD14AAAAASUVORK5CYII=";

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
        return;
    }

    if (gate) gate.classList.remove('open');
    title.innerText = `LEGAL SUPPORT HELP TRAINING INTERFACE - ${session.userType.toUpperCase()} PORTAL`;

    if (session.userType === 'Admin') {
        adminSidebar.classList.remove('hidden');
        adminSidebar.style.display = 'flex';
        traineeSidebar.classList.add('hidden');
        document.getElementById('session-footer-admin').innerHTML = `
            <div class="session-user-tag text-center text-xs text-slate-400 mb-2 font-mono">Signed in as: <b class="text-white">${session.fullName || session.username}</b></div>
            <button class="w-full border border-emerald-600 text-emerald-400 py-2 rounded text-xs font-bold uppercase mb-2" onclick="openAdminDashboard()">⇄ Master Control</button>
            <button class="w-full border border-red-800 text-red-400 py-2 rounded text-xs font-bold uppercase" onclick="logoutSession()">Log Out</button>
        `;
        switchView('admin-landing');
    } else {
        traineeSidebar.classList.remove('hidden');
        traineeSidebar.style.display = 'flex';
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
    clearSession();
    applySessionUI();
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

async function performUserAction(id, action, confirmMessage) {
    if (confirmMessage && !confirm(confirmMessage)) return;
    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id, action })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast((data && data.error) || 'Action failed.', 'error');
            return;
        }
        showToast(data.message || 'Done.', 'success');
        loadUsersData();
    } catch (e) {
        console.error('performUserAction failed', e);
        showToast('Network error. Action not completed.', 'error');
    }
}

function approveRegistration(id) { performUserAction(id, 'approve'); }
function rejectRegistration(id) { performUserAction(id, 'reject', 'Reject this registration? The applicant will need to re-register.'); }
function suspendUser(id) { performUserAction(id, 'suspend', 'Suspend this account? The user will be signed out and unable to log back in until reactivated.'); }
function reactivateUser(id) { performUserAction(id, 'reactivate'); }
function revokeUser(id, name) { performUserAction(id, 'revoke', `Permanently revoke ${name}'s account? This cannot be undone \u2014 they will need to submit a brand-new registration.`); }

// 4. MODALS (ACTIVITIES, LECTURES, SUBMISSIONS)
function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
}
function openAddActivityModal() { document.getElementById('modal-add-activity').classList.add('open'); }
function openAddLectureModal() { document.getElementById('modal-add-lecture').classList.add('open'); }
function submitActivityModal(title) {
    document.getElementById('submit-activity-title').innerText = title;
    document.getElementById('modal-submit-activity').classList.add('open');
}
function openGradeModal(traineeName, activityTitle) {
    document.getElementById('grade-modal-subtitle').innerText = `${traineeName} - ${activityTitle}`;
    document.getElementById('modal-grade-submission').classList.add('open');
}

// Placeholder Actions for Backend Attachment
function saveNewActivity() { closeModals(); alert("Activity / Deck uploaded successfully!"); }
function saveNewLecture() { closeModals(); alert("Lecture embed added successfully!"); }
function confirmSubmission() { closeModals(); alert("Assignment submitted successfully!"); }
function releaseGrade() { closeModals(); alert("Grade released to trainee!"); }

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
    if (getSession()) startHeartbeat();
});

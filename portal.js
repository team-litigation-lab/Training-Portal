// ==========================================
// PUBLIC PORTAL: REGISTRATION + LOGIN (Cloudflare API backed)
// ==========================================

let currentPortalMode = "Trainee";

function submitRegistration() {
    const msgDiv = document.getElementById('auth-register-msg');
    if (msgDiv) msgDiv.innerText = "";

    const password = document.getElementById('reg-password').value;
    const passwordRepeat = document.getElementById('reg-password2').value;

    if (password !== passwordRepeat) {
        if (msgDiv) { msgDiv.className = "auth-msg error"; msgDiv.innerText = "Passwords do not match."; }
        return;
    }

    const pwErr = typeof validateRegPassword === 'function' ? validateRegPassword(password) : null;
    if (pwErr) {
        if (msgDiv) { msgDiv.className = "auth-msg error"; msgDiv.innerText = pwErr; }
        return;
    }

    const payload = {
        firstName: document.getElementById('reg-firstname').value,
        mi: document.getElementById('reg-middlename').value,
        lastName: document.getElementById('reg-lastname').value,
        suffix: document.getElementById('reg-suffix').value,
        email: document.getElementById('reg-email').value,
        userType: document.getElementById('reg-usertype').value,
        // batchId intentionally omitted — the server gives the batch's (B + MMDDYY of the start date) on approval
        username: document.getElementById('reg-username').value,
        password: password
    };

    if (payload.userType === 'Trainee') {
        payload.trainingStartDate = document.getElementById('reg-training-date').value;
        if (!payload.trainingStartDate) {
            if (msgDiv) { msgDiv.className = "auth-msg error"; msgDiv.innerText = "Please enter your start of training date."; }
            return;
        }
    }

    if (!payload.username || !payload.password || !payload.email) {
        if (msgDiv) { msgDiv.className = "auth-msg error"; msgDiv.innerText = "Please fill out all required fields."; }
        return;
    }

    if (msgDiv) { msgDiv.className = "auth-msg info"; msgDiv.innerText = "Submitting registration..."; }

    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (msgDiv) { msgDiv.className = "auth-msg success"; msgDiv.innerText = "Batch ID will be assigned upon the approval of registration."; }
            showToast("Registration submitted successfully!", 'success');
            const loginPage = payload.userType === 'Admin' ? '/admin-login.html' : '/trainee-login.html';
            setTimeout(() => { window.location.href = loginPage; }, 2400);
        } else {
            if (msgDiv) { msgDiv.className = "auth-msg error"; msgDiv.innerText = data.error || "Registration failed."; }
            showToast(data.error || "Registration failed.", 'error');
        }
    })
    .catch(error => {
        console.error("Network error:", error);
        if (msgDiv) { msgDiv.className = "auth-msg error"; msgDiv.innerText = "Network error. Failed to connect to server."; }
        showToast("Network error. Failed to connect to server.", 'error');
    });
}

function attemptLogin() {
    const loginMsgDiv = document.getElementById('auth-login-msg');
    if (loginMsgDiv) { loginMsgDiv.innerText = ""; loginMsgDiv.className = "auth-msg"; loginMsgDiv.style.display = "none"; }

    let payload;
    {
        const usernameInput = document.getElementById('login-username')?.value?.trim() || "";
        const passwordInput = document.getElementById('login-password')?.value || "";
        if (!usernameInput) {
            if (loginMsgDiv) { loginMsgDiv.innerText = "Username is required."; loginMsgDiv.className = "auth-msg error"; loginMsgDiv.style.display = ""; }
            return;
        }
        if (!passwordInput) {
            if (loginMsgDiv) { loginMsgDiv.innerText = "Password is required."; loginMsgDiv.className = "auth-msg error"; loginMsgDiv.style.display = ""; }
            return;
        }
        payload = { username: usernameInput, password: passwordInput, portalMode: currentPortalMode };
    }

    if (loginMsgDiv) { loginMsgDiv.innerText = "Verifying credentials..."; loginMsgDiv.className = "auth-msg info"; loginMsgDiv.style.display = ""; }

    const loginBtn = document.querySelector('.auth-submit');
    if (loginBtn) loginBtn.disabled = true;

    // If the round-trip to /api/login takes 0.5s or more (slow connection, cold
    // D1 read, etc.), swap the message so the trainee gets feedback that
    // something is actively happening rather than staring at a static line.
    // Cleared the moment the request settles either way, so a fast login never
    // shows it at all.
    let loginRequestSettled = false;
    const slowLoginTimer = setTimeout(() => {
        if (!loginRequestSettled && loginMsgDiv) {
            loginMsgDiv.innerText = "Logging In. Please Wait.";
            loginMsgDiv.className = "auth-msg info";
            loginMsgDiv.style.display = "";
        }
    }, 500);

    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        loginRequestSettled = true;
        clearTimeout(slowLoginTimer);
        if (loginBtn) loginBtn.disabled = false;
        if (data.success) {
            if (loginMsgDiv) { loginMsgDiv.className = "auth-msg success"; loginMsgDiv.innerText = "Access granted! Redirecting..."; }
            playSound('login');
            showToast(`Access granted. Welcome back!`, 'success', 3500, { skipSound: true });

            const rawUser = data.user;
            const normalizedUser = {
                fullName: rawUser.fullName || rawUser.full_name || [rawUser.first_name, rawUser.last_name].filter(Boolean).join(' '),
                batchId: rawUser.batchId || rawUser.batch_id,
                userType: rawUser.userType || rawUser.user_type,
                username: rawUser.username
            };

            setSession(normalizedUser);

            // Login now lands on the training index (all programs, gated
            // by topic access) rather than straight into core.html — the
            // CM Training dashboard is just one entry a trainee clicks
            // into from there, not the only destination this login serves.
            setTimeout(() => {
                window.location.href = '/programs.html';
            }, 900);
        } else {
            if (loginMsgDiv) { loginMsgDiv.className = "auth-msg error"; loginMsgDiv.innerText = data.error || "Login unauthorized."; }
            playSound('loginError');
            showToast(data.error || "Login unauthorized.", 'error', 3500, { skipSound: true });
        }
    })
    .catch(error => {
        loginRequestSettled = true;
        clearTimeout(slowLoginTimer);
        if (loginBtn) loginBtn.disabled = false;
        console.error("Authentication connection failure:", error);
        if (loginMsgDiv) { loginMsgDiv.className = "auth-msg error"; loginMsgDiv.innerText = "Network error. Failed to hit validation server."; }
        playSound('loginError');
        showToast("Network error. Failed to hit validation server.", 'error', 3500, { skipSound: true });
    });
}

// ==========================================
// REGISTRATION FIXES
// submitRegistration() above already calls validateRegPassword() and
// expects onRegUserTypeChange()/data-allow filtering to exist — none of
// these were actually defined anywhere. Password rule mirrors
// functions/api/register.js's own REG_PASSWORD_RE exactly, so client and
// server reject/accept the same passwords.
// ==========================================
function validateRegPassword(password) {
    if (!/^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{8,}$/.test(password)) {
        return 'Password must be at least 8 characters long and contain only letters and numbers (at least one letter and one number).';
    }
    return null;
}

// Admin registrations have no "Start of Training Date" concept (register.js
// only requires/accepts trainingStartDate when userType === 'Trainee') —
// hide the field to match.
function onRegUserTypeChange() {
    const type = document.getElementById('reg-usertype').value;
    const wrap = document.getElementById('reg-training-date-wrap');
    if (wrap) { wrap.classList.toggle('hidden', type === 'Admin'); wrap.style.display = type === 'Admin' ? 'none' : ''; }
}

const DATA_ALLOW_PATTERNS = {
    'name': /[^A-Za-z\s'-]/g,
    'alnum-upper': /[^A-Za-z0-9]/g,
    'email': /[^A-Za-z0-9@._+-]/g,
    'alnum-underscore': /[^A-Za-z0-9_]/g
};
function initDataAllowFilters() {
    document.querySelectorAll('[data-allow]').forEach(el => {
        const pattern = DATA_ALLOW_PATTERNS[el.dataset.allow];
        if (!pattern) return;
        el.addEventListener('input', () => {
            let v = el.value.replace(pattern, '');
            if (el.dataset.allow === 'alnum-upper') v = v.toUpperCase();
            if (v !== el.value) el.value = v;
        });
    });
}

// ==========================================
// SOUND ENGINE — Crystal & Bell
// Every event below is an original short bell-tone phrase on a C-major
// pentatonic scale, with a quiet octave-up harmonic layered on each note
// for a touch of real bell overtone character. One system, used
// app-wide — see the individual call sites (attemptLogin, showToast,
// the window.confirm wrapper below, pollAlert, pollPings, togglePause,
// confirmLock/attemptUnlock, makeAnnouncement) for where each fires.
// ==========================================
let __soundCtx = null;
function getSoundCtx() {
    if (!__soundCtx) __soundCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (__soundCtx.state === 'suspended') __soundCtx.resume();
    return __soundCtx;
}

function soundBeep(c, { freq, type = 'sine', dur = 0.2, gain = 0.3, delay = 0 }) {
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
}
function soundBellNote(c, freq, delay, dur, gain) {
    soundBeep(c, { freq: freq, type: 'sine', dur: dur, gain: gain, delay: delay });
    soundBeep(c, { freq: freq * 2, type: 'sine', dur: dur * 0.6, gain: gain * 0.22, delay: delay });
}
function soundBellPhrase(notes) {
    const c = getSoundCtx();
    notes.forEach(n => soundBellNote(c, n.f, n.d, n.dur, n.g));
}

const SOUND_NOTE = {
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
    C6: 1046.5, D6: 1174.66, E6: 1318.51, G4: 392.00
};

const SOUND_PHRASES = {
    login: [{ f: SOUND_NOTE.C5, d: 0, dur: 0.3, g: 0.3 }, { f: SOUND_NOTE.E5, d: 0.18, dur: 0.3, g: 0.3 }, { f: SOUND_NOTE.G5, d: 0.36, dur: 0.3, g: 0.32 }, { f: SOUND_NOTE.C6, d: 0.54, dur: 0.55, g: 0.34 }],
    loginError: [{ f: SOUND_NOTE.E5, d: 0, dur: 0.22, g: 0.28 }, { f: SOUND_NOTE.C5, d: 0.16, dur: 0.4, g: 0.26 }],
    logout: [{ f: SOUND_NOTE.C6, d: 0, dur: 0.3, g: 0.32 }, { f: SOUND_NOTE.G5, d: 0.18, dur: 0.3, g: 0.3 }, { f: SOUND_NOTE.E5, d: 0.36, dur: 0.3, g: 0.3 }, { f: SOUND_NOTE.C5, d: 0.54, dur: 0.55, g: 0.3 }],
    submitSuccess: [{ f: SOUND_NOTE.E5, d: 0, dur: 0.22, g: 0.32 }, { f: SOUND_NOTE.G5, d: 0.14, dur: 0.22, g: 0.32 }, { f: SOUND_NOTE.C6, d: 0.28, dur: 0.5, g: 0.36 }],
    submitError: [{ f: SOUND_NOTE.E5, d: 0, dur: 0.25, g: 0.28 }, { f: SOUND_NOTE.D5, d: 0.18, dur: 0.25, g: 0.26 }, { f: SOUND_NOTE.C5, d: 0.36, dur: 0.45, g: 0.26 }],
    notification: [{ f: SOUND_NOTE.G5, d: 0, dur: 0.35, g: 0.28 }],
    prompt: [{ f: SOUND_NOTE.E5, d: 0, dur: 0.16, g: 0.24 }, { f: SOUND_NOTE.A5, d: 0.12, dur: 0.3, g: 0.26 }],
    announcement: [{ f: SOUND_NOTE.C5, d: 0, dur: 0.2, g: 0.3 }, { f: SOUND_NOTE.G5, d: 0.14, dur: 0.2, g: 0.3 }, { f: SOUND_NOTE.E6, d: 0.28, dur: 0.5, g: 0.32 }],
    alert: [{ f: SOUND_NOTE.G5, d: 0, dur: 0.22, g: 0.34 }, { f: SOUND_NOTE.C6, d: 0.24, dur: 0.22, g: 0.34 }, { f: SOUND_NOTE.G5, d: 0.48, dur: 0.22, g: 0.34 }, { f: SOUND_NOTE.C6, d: 0.72, dur: 0.32, g: 0.36 }],
    ping: [{ f: SOUND_NOTE.C6, d: 0, dur: 0.18, g: 0.32 }, { f: SOUND_NOTE.E6, d: 0.12, dur: 0.18, g: 0.32 }, { f: SOUND_NOTE.G5, d: 0.24, dur: 0.35, g: 0.3 }],
    lock: [{ f: SOUND_NOTE.G5, d: 0, dur: 0.22, g: 0.32 }, { f: SOUND_NOTE.E5, d: 0.16, dur: 0.22, g: 0.3 }, { f: SOUND_NOTE.C5, d: 0.32, dur: 0.22, g: 0.3 }, { f: SOUND_NOTE.G4, d: 0.48, dur: 0.5, g: 0.3 }],
    unlock: [{ f: SOUND_NOTE.G4, d: 0, dur: 0.22, g: 0.28 }, { f: SOUND_NOTE.C5, d: 0.16, dur: 0.22, g: 0.3 }, { f: SOUND_NOTE.E5, d: 0.32, dur: 0.22, g: 0.3 }, { f: SOUND_NOTE.G5, d: 0.48, dur: 0.5, g: 0.32 }],
    pause: [{ f: SOUND_NOTE.E5, d: 0, dur: 0.2, g: 0.28 }, { f: SOUND_NOTE.C5, d: 0.14, dur: 0.35, g: 0.26 }],
    resume: [{ f: SOUND_NOTE.C5, d: 0, dur: 0.2, g: 0.26 }, { f: SOUND_NOTE.E5, d: 0.14, dur: 0.35, g: 0.28 }]
};

function playSound(eventKey) {
    const phrase = SOUND_PHRASES[eventKey];
    if (!phrase) return;
    try { soundBellPhrase(phrase); } catch (e) { /* audio unavailable — ignore */ }
}

// showToast's type ('success'/'error'/'info') already covers most of the
// app's feedback moments (submissions, grading, registrations, lecture
// management, etc.) — hooking it once here means those get a sound
// without touching every individual call site.
function playToastSound(type) {
    if (type === 'success') playSound('submitSuccess');
    else if (type === 'error') playSound('submitError');
    else if (type === 'info') playSound('notification');
}

// Every confirm() dialog in the app gets a short "prompt" tone right
// before the native dialog opens — one wrapper here instead of adding a
// call at each individual confirm() site.
const __nativeConfirm = window.confirm.bind(window);
window.confirm = function (message) {
    playSound('prompt');
    return __nativeConfirm(message);
};

// ==========================================
// ALERT (full-screen, admin controls + polling)
// Backed by the real functions/api/alert.js — field names below
// (bgColor/image/durationSeconds/startAt, response.id) match that file
// exactly, not the fire_at/expires_at/image_data shape from an earlier,
// different draft of this feature.
// ==========================================
let __alertImageData = null;
let __lastShownAlertId = null;
let __alertDismissedId = null;

function renderAlertSwatches() {
    const container = document.getElementById('alert-bg-swatches');
    if (!container || container.dataset.rendered) return;
    const colors = ['#b91c1c', '#c2410c', '#0f172a', '#166534', '#1d4ed8', '#000000'];
    container.innerHTML = colors.map(c =>
        `<button type="button" class="swatch" style="width:26px;height:26px;border-radius:5px;border:2px solid #e2e8f0;background:${c};margin-right:6px;cursor:pointer;" onclick="document.getElementById('alert-bg-color').value='${c}'"></button>`
    ).join('');
    container.dataset.rendered = '1';
}

function previewAlertImage(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        __alertImageData = reader.result;
        const img = document.getElementById('alert-image-preview');
        if (img) { img.src = __alertImageData; img.style.display = 'inline-block'; }
    };
    reader.readAsDataURL(file);
}

function clearAlertImage() {
    __alertImageData = null;
    const input = document.getElementById('alert-image-input');
    const img = document.getElementById('alert-image-preview');
    if (input) input.value = '';
    if (img) { img.style.display = 'none'; img.removeAttribute('src'); }
}

async function setAlert() {
    const text = document.getElementById('alert-text-input').value.trim();
    if (!text) { showToast('Alert text is required.', 'error'); return; }

    const bgColor = document.getElementById('alert-bg-color').value;
    const durationSeconds = parseInt(document.getElementById('alert-duration-select').value, 10) || 0;
    const scheduleVal = document.getElementById('alert-schedule-input').value;
    const startAt = scheduleVal ? new Date(scheduleVal).toISOString() : undefined;

    try {
        const res = await fetch('/api/alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text, bgColor, image: __alertImageData, durationSeconds, startAt })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.success) throw new Error((data && data.error) || 'Failed to set alert.');
        showToast('Alert set.', 'success');
        document.getElementById('alert-status-line').textContent = 'An alert is active.';
        pollAlert();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function stopAlert() {
    try {
        const res = await fetch('/api/alert', { method: 'DELETE', credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.success) throw new Error((data && data.error) || 'Failed to stop alert.');
        showToast('Alert stopped.', 'success');
        document.getElementById('alert-status-line').textContent = 'No alert is currently active.';
        pollAlert();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function pollAlert() {
    try {
        // GET /api/alert is intentionally public (no requireSession) — it
        // has to work for a logged-out visitor sitting at the login screen too.
        const res = await fetch('/api/alert', { credentials: 'include' });
        applyAlertData(await res.json().catch(() => null));
    } catch (e) { /* retry next tick */ }
}
// The alert from /api/alert or /api/live (pollLive).
function applyAlertData(data) {
    try {
        if (!data) return;

        const statusLine = document.getElementById('alert-status-line');
        const overlay = document.getElementById('alert-overlay');
        const ovAlert = document.getElementById('ov-alert-state');

        if (!data.active) {
            if (overlay) overlay.classList.remove('open');
            // Previously only set inside setAlert()/stopAlert() — meant a
            // fresh page load, or a different admin's tab, always showed
            // "No alert is currently active." even while one genuinely was.
            if (statusLine) statusLine.textContent = 'No alert is currently active.';
            if (ovAlert) ovAlert.textContent = 'None Active';
            __lastShownAlertId = null;
            return;
        }

        if (statusLine) statusLine.textContent = 'An alert is active.';
        if (ovAlert) ovAlert.textContent = 'Active';
        const isNewAlert = __lastShownAlertId !== data.id;
        __lastShownAlertId = data.id;

        // Alert is a trainee-facing broadcast, not something an admin's own
        // screen should be taken over by — they already know about it
        // (they can see it's active from the status line/controls right
        // here in Master Control), and a full-screen takeover would just
        // get in the way of them actually managing it or doing other work.
        const alertSession = getSession();
        if (alertSession && alertSession.userType === 'Admin') return;

        // Persisted in localStorage (survives page refresh/close), not just
        // the in-memory __alertDismissedId — dismissing an alert should
        // stay dismissed until an admin sets a genuinely new one (a
        // different data.id), not just until the next reload.
        const dismissedId = localStorage.getItem('LSH_ALERT_DISMISSED_ID');
        if (dismissedId === String(data.id)) { __alertDismissedId = data.id; return; }

        const textEl = document.getElementById('alert-overlay-text');
        const imgEl = document.getElementById('alert-overlay-image');
        if (textEl) textEl.textContent = data.text || '';
        if (imgEl) {
            if (data.image) { imgEl.src = data.image; imgEl.style.display = 'block'; }
            else { imgEl.style.display = 'none'; imgEl.removeAttribute('src'); }
        }
        // The color has to go on #alert-overlay itself (the fixed,
        // full-screen backdrop) — .alert-box is just a content wrapper
        // with no background of its own, so setting it there left the
        // page's normal content fully visible behind a small floating
        // text block instead of the intended full-screen color takeover.
        // Converted to rgba at 35% opacity (65% transparency) rather than
        // a solid fill, so the page underneath stays faintly visible.
        if (overlay) {
            overlay.style.background = hexToRgba(data.bgColor || '#b91c1c', 0.35);
            overlay.classList.add('open');
        }
        if (isNewAlert) playSound('alert');
    } catch (e) { /* retry next tick */ }
}

// #rrggbb (or #rgb) -> rgba(r, g, b, alpha). Falls back to the original
// string unchanged if it isn't a recognizable hex color (e.g. already
// rgba(), or a named CSS color) — better to show it solid than not at all.
function hexToRgba(hex, alpha) {
    const clean = String(hex).trim().replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function dismissAlertLocally() {
    const overlay = document.getElementById('alert-overlay');
    if (overlay) overlay.classList.remove('open');
    __alertDismissedId = __lastShownAlertId;
    if (__lastShownAlertId !== null && __lastShownAlertId !== undefined) {
        try { localStorage.setItem('LSH_ALERT_DISMISSED_ID', String(__lastShownAlertId)); } catch (e) { /* storage unavailable — dismissal still holds for this page load via __alertDismissedId */ }
    }
}

// ==========================================
// SITE LOCK / PAUSE
// Overrides app.js's `refreshSiteState()` no-op stub (see its "2c. STUBS"
// comment) now that a real backend exists. GET /api/site-state is public,
// so this polls regardless of login state — a locked-out admin still
// needs to see the lock screen.
// ==========================================
let __siteState = { locked: false, paused: false };

async function refreshSiteState() {
    try {
        const res = await fetch('/api/site-state', { credentials: 'include' });
        applySiteStateData(await res.json().catch(() => null));
    } catch (e) { /* transient network error — next poll retries */ }
}
// The site state from /api/site-state or /api/live (pollLive).
function applySiteStateData(data) {
    if (!data || data.success === false) return;
    __siteState = data;
    applySiteStateUI(data);
}

function applySiteStateUI(state) {
    const lockOverlay = document.getElementById('lock-overlay');
    const pauseOverlay = document.getElementById('pause-overlay');
    // Lock deliberately affects everyone, admins included — resolving it
    // requires an admin logging in through the Unlock screen, so it has to
    // actually show to admins for that flow to work at all.
    if (lockOverlay) lockOverlay.classList.toggle('open', !!state.locked);

    // Pause, like Alert, is a trainee-facing effect — an admin who paused
    // the site (or a different admin checking in) shouldn't have their own
    // screen blocked by it; they can already see the Paused/Active state
    // in the label below and the toggle button right here in Master Control.
    const pauseSession = getSession();
    const isAdminUser = !!(pauseSession && pauseSession.userType === 'Admin');
    if (pauseOverlay) pauseOverlay.classList.toggle('open', !isAdminUser && !state.locked && !!state.paused);

    const pauseMessageEl = document.getElementById('pause-overlay-message');
    if (pauseMessageEl) {
        pauseMessageEl.textContent = state.pausedMessage
            ? state.pausedMessage
            : 'Your session and progress are safe. This screen will disappear automatically the moment an administrator resumes activity.';
    }

    const lockedByEl = document.getElementById('lock-locked-by');
    if (lockedByEl) lockedByEl.textContent = 'Locked By: Batch ID ' + (state.lockedBy || '—');

    const lockLabel = document.getElementById('lock-state-label');
    if (lockLabel) {
        lockLabel.textContent = state.locked ? 'Locked' : 'Unlocked';
        lockLabel.style.color = state.locked ? 'var(--classified-red)' : '#166534';
    }

    const pauseLabel = document.getElementById('pause-state-label');
    if (pauseLabel) {
        pauseLabel.textContent = state.paused ? 'Paused' : 'Active (not paused)';
        pauseLabel.style.color = state.paused ? '#b45309' : 'var(--classified-red)';
    }

    // Overview tab's Site-Wide Status tiles — same data, different display,
    // previously never wired to anything (always showed their hardcoded
    // placeholder text regardless of actual state).
    const ovLock = document.getElementById('ov-lock-state');
    if (ovLock) ovLock.textContent = state.locked ? 'Locked' : 'Unlocked';
    const ovPause = document.getElementById('ov-pause-state');
    if (ovPause) ovPause.textContent = state.paused ? 'Paused' : 'Active';

    const pauseBtn = document.getElementById('pause-toggle-btn');
    if (pauseBtn) pauseBtn.textContent = state.paused ? '▶ Resume All Activity' : '⏸ Pause All Activity';

    applyAuthPageLockState(state);
}

// Login (trainee/admin) and Registration react to a site-wide Lock
// differently from the rest of the app — the landing page
// is deliberately excluded (it is pure navigation, nothing to restrict)
// and isn't expected to define AUTH_PAGE_TYPE at all, so this silently
// does nothing there.
//
//   - trainee-login / registration: the actual form fields are replaced
//     with a "site is locked" message, not just covered by an overlay —
//     removing the fields themselves is the point (a locked site
//     shouldn't invite someone to fill out a form that can't succeed).
//   - admin-login: the ONE unrestricted portal, but only for the specific
//     purpose of unlocking — the normal login form is replaced with an
//     unlock form that only accepts the Master Account, reusing the same
//     attemptUnlock() the full-screen lock-overlay uses everywhere else.
function applyAuthPageLockState(state) {
    if (typeof AUTH_PAGE_TYPE === 'undefined') return; // not one of the 3 lock-aware auth pages

    const formContent = document.getElementById('auth-form-content');
    const lockedNotice = document.getElementById('auth-locked-notice');
    const unlockContent = document.getElementById('admin-unlock-content');
    const heading = document.getElementById('admin-login-heading');
    const sub = document.getElementById('admin-login-sub');

    if (AUTH_PAGE_TYPE === 'admin-login') {
        if (formContent) formContent.style.display = state.locked ? 'none' : '';
        if (unlockContent) unlockContent.style.display = state.locked ? '' : 'none';
        if (heading) heading.textContent = state.locked ? 'Site Locked' : 'Admin Login';
        if (sub) sub.textContent = state.locked
            ? 'Enter the Master Account credentials to unlock the site.'
            : 'Sign in with your own administrator username and password: one sign-in for every program, the simulators and Master Control.';
        return;
    }

    // trainee-login and registration
    if (formContent) formContent.style.display = state.locked ? 'none' : '';
    if (lockedNotice) lockedNotice.style.display = state.locked ? '' : 'none';
}

async function togglePause() {
    const willResume = !!__siteState.paused;
    const messageInput = document.getElementById('pause-message-input');
    const message = (!willResume && messageInput) ? messageInput.value.trim() : undefined;
    try {
        const res = await fetch('/api/site-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action: willResume ? 'RESUME' : 'PAUSE', message })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.success) throw new Error((data && data.error) || 'Failed to update pause state.');
        playSound(willResume ? 'resume' : 'pause');
        refreshSiteState();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function openLockConfirm() {
    document.getElementById('lock-confirm-username').value = '';
    document.getElementById('lock-confirm-password').value = '';
    document.getElementById('lock-confirm-error').style.display = 'none';
    document.getElementById('lock-confirm-modal').classList.add('open');
}
function closeLockConfirm() {
    document.getElementById('lock-confirm-modal').classList.remove('open');
}

async function confirmLock() {
    const username = document.getElementById('lock-confirm-username').value.trim();
    const password = document.getElementById('lock-confirm-password').value;
    const errEl = document.getElementById('lock-confirm-error');
    if (errEl) errEl.style.display = 'none';

    if (!username || !password) {
        if (errEl) { errEl.textContent = 'Username and password are required.'; errEl.style.display = 'block'; }
        return;
    }
    try {
        const res = await fetch('/api/site-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action: 'LOCK', username, password })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.success) throw new Error((data && data.error) || 'Failed to lock the page.');
        closeLockConfirm();
        playSound('lock');
        showToast('Page locked.', 'success', 3500, { skipSound: true });
        // LOCK wipes the entire heartbeats table server-side (see
        // site-state.js), killing the locking admin's own session too — the
        // lock-overlay (shown by refreshSiteState below) takes over regardless.
        refreshSiteState();
    } catch (e) {
        if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    }
}

async function attemptUnlock() {
    const username = document.getElementById('unlock-user').value.trim();
    const password = document.getElementById('unlock-pass').value;
    const errEl = document.getElementById('unlock-error');
    if (errEl) errEl.style.display = 'none';

    if (!username || !password) {
        if (errEl) { errEl.textContent = 'Username and password are required.'; errEl.style.display = 'block'; }
        return;
    }
    try {
        const res = await fetch('/api/site-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action: 'UNLOCK', username, password })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.success) throw new Error((data && data.error) || 'Invalid credentials.');
        document.getElementById('unlock-user').value = '';
        document.getElementById('unlock-pass').value = '';
        playSound('unlock');
        showToast('Page unlocked.', 'success', 3500, { skipSound: true });
        // Every session's heartbeat row was wiped at LOCK time, so any
        // locally-stored session (including the unlocker's own) is stale.
        // Redirect to the landing page rather than calling applySessionUI()
        // in place — if this fired while sitting on core.html, that would
        // leave a blank dashboard shell with no login form to get back in from.
        clearSession();
        window.location.href = '/index.html';
    } catch (e) {
        if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    }
}

// ==========================================
// PINGS — recipient picker, send, poll + toast/tone
// Field names (text/target/fired_at/by) match the live `pings` table.
// ==========================================
let __pingMode = 'single';
let __pingSelectedUsers = [];
let __lastPingAt = null;

function setPingMode(mode) {
    __pingMode = mode;
    const singleBtn = document.getElementById('ping-mode-single-btn');
    const allBtn = document.getElementById('ping-mode-all-btn');
    if (singleBtn) singleBtn.style.background = mode === 'single' ? 'var(--navy)' : '#94a3b8';
    if (allBtn) allBtn.style.background = mode === 'all' ? 'var(--navy)' : '#94a3b8';
    const row = document.getElementById('ping-user-row');
    if (row) row.classList.toggle('hidden', mode === 'all');
    if (mode === 'all') { __pingSelectedUsers = []; renderPingUserChips(); }
}

async function openPingUserList() {
    if (__pingMode !== 'single') return;
    if (!__usersCache || __usersCache.length === 0) {
        // Must be awaited — filterPingUserList() reads __usersCache
        // synchronously right after, and without this it would run before
        // the fetch resolves, showing "No matching users" on first open.
        await loadUsersData();
    }
    filterPingUserList();
    const list = document.getElementById('ping-user-list');
    if (list) list.style.display = 'block';
}
function closePingUserList() {
    const list = document.getElementById('ping-user-list');
    if (list) list.style.display = 'none';
}

function filterPingUserList() {
    const q = (document.getElementById('ping-user-search').value || '').toLowerCase();
    const list = document.getElementById('ping-user-list');
    if (!list) return;

    const candidates = (__usersCache || []).filter(u => u.status === 'Approved');
    const matches = candidates.filter(u => {
        const hay = [u.fullName, u.username, u.batchId, batchLabel(u.batchId), u.userType].filter(Boolean).join(' ').toLowerCase();
        return !q || hay.includes(q);
    }).slice(0, 30);

    list.innerHTML = matches.map(u => {
        const selected = __pingSelectedUsers.includes(u.username);
        return `<div onclick="togglePingUser('${escapeHtml(u.username)}')" style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid #f1f5f9;${selected ? 'background:#eff6ff;font-weight:700;' : ''}">${escapeHtml(u.fullName)} <span style="color:#94a3b8;">(${escapeHtml(u.username)} &middot; ${escapeHtml(u.batchId)})</span></div>`;
    }).join('') || '<div style="padding:10px;font-size:11px;color:#94a3b8;">No matching users.</div>';
    list.style.display = 'block';
}

function togglePingUser(username) {
    const idx = __pingSelectedUsers.indexOf(username);
    if (idx === -1) __pingSelectedUsers.push(username); else __pingSelectedUsers.splice(idx, 1);
    renderPingUserChips();
    filterPingUserList();
}

function renderPingUserChips() {
    const container = document.getElementById('ping-user-chips');
    if (!container) return;
    container.innerHTML = __pingSelectedUsers.map(u =>
        `<span class="mini-btn" style="background:#eff6ff;color:var(--navy);padding:4px 10px;border-radius:12px;font-size:11px;">${escapeHtml(u)} <span style="cursor:pointer;color:#94a3b8;" onclick="togglePingUser('${escapeHtml(u)}')">&times;</span></span>`
    ).join('');
}

// Close the recipient dropdown on outside click (Esc is already wired
// directly in the markup's onkeydown).
document.addEventListener('click', (e) => {
    const row = document.getElementById('ping-user-row');
    if (!row) return;
    if (!row.contains(e.target)) closePingUserList();
});

async function sendPing() {
    const message = document.getElementById('ping-text-input').value.trim();
    if (!message) { showToast('Ping message is required.', 'error'); return; }
    if (__pingMode === 'single' && __pingSelectedUsers.length === 0) {
        showToast('Select at least one recipient.', 'error');
        return;
    }
    try {
        const res = await fetch('/api/pings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ mode: __pingMode, usernames: __pingSelectedUsers, message })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.success) throw new Error((data && data.error) || 'Failed to send ping.');
        showToast('Ping sent.', 'success');
        document.getElementById('ping-text-input').value = '';
        __pingSelectedUsers = [];
        renderPingUserChips();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// Distinct two-tone beep so a ping doesn't sound like the login chime —
// generated via Web Audio API since no sound asset exists in the project.
let __pingsInitialized = false;

async function pollPings() {
    // Unlike /api/alert and /api/site-state, GET /api/pings requires a
    // session (requireSession, not adminOnly) — skip silently while logged out
    // rather than generating a 401 on every tick.
    if (!getSession()) return;
    try {
        const url = '/api/pings' + (__lastPingAt ? ('?since=' + encodeURIComponent(__lastPingAt)) : '');
        const res = await fetch(url, { credentials: 'include' });
        applyPingsData(await res.json().catch(() => null));
    } catch (e) { /* retry next tick */ }
}
// New pings from /api/pings or /api/live (pollLive).
function applyPingsData(data) {
    try {
        if (!data || data.success === false || !Array.isArray(data.pings)) return;

        if (!__pingsInitialized) {
            // First poll after a fresh page load/navigation — __lastPingAt
            // always starts null here, which previously meant "fetch every
            // ping ever sent" and re-displayed old ones as if they'd just
            // arrived, on every single page load. Instead, just establish
            // the cursor silently from whatever's already on record, and
            // only surface pings that arrive genuinely after this point.
            __pingsInitialized = true;
            if (data.pings.length) __lastPingAt = data.pings[data.pings.length - 1].fired_at;
            return;
        }

        data.pings.forEach(p => {
            showToast(`\u{1F4E3} ${p.by}: ${p.text}`, 'info', 6000, { skipSound: true });
            playSound('ping');
            __lastPingAt = p.fired_at;
        });
    } catch (e) { /* retry next tick */ }
}

window.addEventListener('DOMContentLoaded', () => {
    initDataAllowFilters();
    renderAlertSwatches();

    pollLive();
    // Every 20 s, every 60 s in a background tab (pings are fetched from where the last one left off, so
    // none is missed), and right away when the tab comes back into view.
    setInterval(() => { if (Date.now() - __liveAt >= (document.hidden ? LIVE_HIDDEN_MS : LIVE_MS) - 1000) pollLive(); }, LIVE_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - __liveAt > 10000) pollLive(); });
});

// What every open page checks (the lock and pause, the alert and, signed in, new pings) in ONE request,
// /api/live. Every request that runs a Function counts toward the Cloudflare account's monthly requests,
// shared by every LSH site: this used to be three requests every 3 s from every open page.
const LIVE_MS = 20000, LIVE_HIDDEN_MS = 60000;
let __liveAt = 0;
async function pollLive() {
    __liveAt = Date.now();
    const signedIn = !!getSession();
    const q = signedIn ? '?pings=1' + (__lastPingAt ? '&since=' + encodeURIComponent(__lastPingAt) : '') : '';
    try {
        const res = await fetch('/api/live' + q, { credentials: 'include' });
        const d = await res.json().catch(() => null);
        if (!d || !d.success) return;
        applySiteStateData(d.siteState);
        applyAlertData(d.alert);
        if (signedIn) applyPingsData(d.pings);
    } catch (e) { /* transient network error — next poll retries */ }
}

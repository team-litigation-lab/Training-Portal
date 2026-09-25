import { requireSession } from './_utils.js';

// Unlike every other page in this app (which are plain static files with a
// client-side session check that redirects AFTER the HTML has already been
// sent), this one is a genuine Cloudflare Pages Function. requireSession()
// runs BEFORE any markup is returned — a non-admin, or anyone with dev
// tools open, receives nothing but a 403 page. There is no Pause/Lock
// markup anywhere in the response for them to reveal, because the browser
// never receives it in the first place. This is the actual fix for "can
// someone bypass this with F12" — hiding it with CSS classes (as the old
// in-dashboard version did) can't give that guarantee, since the markup
// was always present in the DOM either way.
export async function onRequest({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) {
        return new Response(DENIED_HTML, {
            status: 403,
            headers: { 'Content-Type': 'text/html; charset=UTF-8' }
        });
    }

    return new Response(PAGE_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=UTF-8' }
    });
}

const DENIED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Access Denied — LSH Training Portal</title>
<link rel="icon" type="image/png" href="/favicon.png">
<style>
    body {
        margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
        font-family: Arial, Helvetica, sans-serif; background: #081226; color: #fff; text-align: center;
    }
    .box { max-width: 380px; padding: 32px; }
    h1 { font-size: 20px; margin-bottom: 10px; }
    p { font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.6; margin-bottom: 24px; }
    a { display: inline-block; background: #f97316; color: #0f172a; font-weight: 800; font-size: 13px;
        padding: 11px 24px; border-radius: 999px; text-decoration: none; }
</style>
</head>
<body>
    <div class="box">
        <div style="font-size:32px;margin-bottom:10px;">🔒</div>
        <h1>Access Denied</h1>
        <p>This page is restricted to administrators. If you believe this is a mistake, log in with an administrator account first.</p>
        <a href="/admin-login.html">Go to Admin Login</a>
    </div>
</body>
</html>`;

const PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Access Control — LSH Training Portal</title>
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="/styles.css">
<style>
    body { margin: 0; font-family: 'IBM Plex Sans', Arial, sans-serif; background: #faf8f4; color: #0f2148; }
    .ac-top { display: flex; align-items: center; justify-content: space-between; padding: 18px 28px; background: #081226; }
    .ac-back { color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600; text-decoration: none; }
    .ac-back:hover { color: #fff; }
    .ac-brand { color: #fff; font-weight: 800; font-size: 13.5px; }
    .ac-wrap { max-width: 640px; margin: 0 auto; padding: 40px 24px 80px; }
    .ac-wrap h1 { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
    .ac-wrap .sub { font-size: 13px; color: #64748b; margin-bottom: 32px; }
    .mc-section-title { font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; color:#0f2148; margin:26px 0 12px; display:flex; align-items:center; gap:8px; }
    .mc-section-title:first-of-type { margin-top: 0; }
    #pause-message-input {
        width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
        font-size: 12.5px; margin-top: 10px; margin-bottom: 4px; font-family: 'IBM Plex Sans', sans-serif;
    }
    #pause-message-input:focus { outline: none; border-color: #f97316; }
    .field-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; }
</style>
</head>
<body>

<div class="ac-top">
    <a href="/core.html" class="ac-back">&larr; Back to Portal</a>
    <div class="ac-brand">Access Control</div>
</div>

<div class="ac-wrap">
    <h1>Site-Wide Access Control</h1>
    <p class="sub">Pause and Lock affect every trainee currently on the portal. This page is only reachable by an authenticated administrator — checked on the server before this page is ever sent to your browser.</p>

    <div class="mc-section-title">⏸ Pause Activity (this page only, no logout, resumable)</div>
    <div class="admin-tile">
        <p style="font-size:11px; color:#64748b; margin-bottom:10px;">Pausing freezes activity for every user currently connected to this page. Nobody is logged out and no progress is lost — when you Resume, everyone continues exactly where they left off.</p>
        <div style="font-size:12px;font-weight:800;margin-bottom:4px;">Current state: <span id="pause-state-label" style="color:var(--classified-red);">Active (not paused)</span></div>
        <label class="field-label" for="pause-message-input">Pause Message (optional, shown to trainees)</label>
        <input type="text" id="pause-message-input" maxlength="300" placeholder="e.g. Brief maintenance in progress — back shortly.">
        <button class="btn-primary" id="pause-toggle-btn" style="border-radius:6px;padding:10px 16px;font-size:11px;margin-top:8px;" onclick="togglePause()">⏸ Pause All Activity</button>
    </div>

    <div class="mc-section-title">🔒 Lock Access (this page only, forces logout, requires unlock)</div>
    <div class="admin-tile">
        <p style="font-size:11px; color:#64748b; margin-bottom:10px;">Locking immediately signs out every user of this page and blocks the page entirely until the Master Account unlocks it again. Only the Master Account can perform this — it logs in through the standard Admin Portal like any other admin, but is the sole account that can Lock or Unlock the site.</p>
        <div style="font-size:12px;font-weight:800;margin-bottom:10px;">Current state: <span id="lock-state-label" style="color:#166534;">Unlocked</span></div>
        <button class="btn-primary hidden" id="lock-page-btn" style="background:var(--classified-red);color:white;border-radius:6px;padding:10px 16px;font-size:11px;" onclick="openLockConfirm()">🔒 Lock This Page</button>
        <p id="lock-master-only-note" style="font-size:11px;color:#94a3b8;font-style:italic;margin-top:8px;">Only the Master Account can lock or unlock this page.</p>
    </div>
</div>

<!-- ===== LOCK CONFIRMATION MODAL (required to engage Lock) ===== -->
<div class="modal-overlay no-print" id="lock-confirm-modal" style="z-index:2900;">
    <div class="modal-box">
        <h2 class="serif">🔒 Confirm Page Lock</h2>
        <div class="sub mono">Master Account Verification Required</div>
        <p style="font-size:12px; color:#475569; margin-bottom:14px; line-height:1.5;">
            Locking will immediately log out every user of this page and block access until unlocked. Re-enter your Master Account username and password to confirm.
        </p>
        <div id="lock-confirm-error" style="display:none;color:var(--classified-red);font-size:11px;font-weight:700;margin-bottom:8px;">Invalid credentials.</div>
        <label>Username</label>
        <input type="text" id="lock-confirm-username" autocomplete="off" placeholder="Master account username" class="mono">
        <label>Password</label>
        <input type="password" id="lock-confirm-password" autocomplete="off" placeholder="Master account password">
        <div class="modal-btn-row">
            <button class="btn-ghost" onclick="closeLockConfirm()">Cancel</button>
            <button class="btn-primary" style="background:var(--classified-red);color:white;" onclick="confirmLock()">Confirm &amp; Lock</button>
        </div>
    </div>
</div>

<!-- ===== PAUSE OVERLAY (shared — this admin sees it too if someone else pauses/locks while they're on this page) ===== -->
<div id="pause-overlay">
    <div style="font-size:40px;">⏸</div>
    <h2 class="serif" style="margin:14px 0 4px;">Activity Paused by Administrator</h2>
    <p class="mono" id="pause-overlay-message" style="font-size:11px; color:#cbd5e1; max-width:360px;">Your session and progress are safe. This screen will disappear automatically the moment an administrator resumes activity.</p>
</div>

<!-- ===== LOCK SCREEN ===== -->
<div id="lock-overlay">
    <div style="font-size:40px;">🔒</div>
    <h2 class="serif" style="margin:14px 0 4px;">Page Locked by Administrator</h2>
    <div id="lock-locked-by">Locked By: Batch ID —</div>
    <p class="mono" style="font-size:11px; color:#94a3b8; margin-bottom:20px;">Enter the system administrator's credentials to resume access.</p>
    <div style="width:300px;">
        <input type="text" id="unlock-user" placeholder="Username" style="width:100%;padding:10px;margin-bottom:8px;border-radius:6px;border:none;font-family:'IBM Plex Mono', 'Courier New', monospace;background:#ffffff;color:#0f172a;">
        <input type="password" id="unlock-pass" placeholder="Password" style="width:100%;padding:10px;margin-bottom:12px;border-radius:6px;border:none;font-family:'IBM Plex Mono', 'Courier New', monospace;background:#ffffff;color:#0f172a;">
        <div id="unlock-error" style="display:none;color:#f87171;font-size:11px;margin-bottom:8px;">Invalid credentials.</div>
        <button class="btn-primary" style="width:100%;padding:10px;border-radius:6px;" onclick="attemptUnlock()">Unlock Page</button>
    </div>
</div>

<script src="/app.js"></script>
<script src="/portal.js"></script>
<script>
    // Hides the Lock button (and shows the explanatory note instead) for
    // any admin session that isn't the Master Account.
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof applyLockPermissionUI === 'function') applyLockPermissionUI();
    });
</script>
</body>
</html>`;

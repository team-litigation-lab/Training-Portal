/* 🔐 The @legalsupporthelp.com Google step on the two sign-in pages (trainee-login.html, admin-login.html).
   When the rule is on (GOOGLE_CLIENT_ID on the Portal: /api/auth-config, functions/_utils.js), a "Sign in with Google" button
   goes above the username and password. Google offers the account the Chrome profile is signed in to; an account that isn't
   of the domain is refused right here with what to do (switch to the @legalsupporthelp.com Chrome profile), and the server
   checks the same again (functions/api/login.js). attemptLogin() (portal.js) sends LSHGoogle.credential with the username and
   password. With the rule off, nothing is drawn and the sign-in is as before. */
(function () {
    const G = window.LSHGoogle = { required: false, credential: '', email: '', domain: 'legalsupporthelp.com', ready: null };
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // (the ID token's claims: only to say who it is on the page; the server checks the token with Google)
    const claims = (jwt) => { try { const p = String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(p + '==='.slice((p.length + 3) % 4))))); } catch (e) { return {}; } };
    const box = () => document.getElementById('lsh-google-step');
    function paint(state, msg) {
        const b = box(); if (!b) return;
        const st = b.querySelector('.lsh-g-status');
        b.dataset.state = state;
        st.className = 'lsh-g-status ' + (state === 'ok' ? 'ok' : state === 'bad' ? 'bad' : '');
        st.innerHTML = msg || '';
        b.querySelector('.lsh-g-btn').style.display = state === 'ok' ? 'none' : '';
    }
    // a refusal from the page or the server: the person is told why and what to do, and signs in with Google again
    // (html: the page's own message, already escaped; a server message is shown as text)
    G.reset = function (message, email, html) {
        G.credential = ''; G.email = '';
        try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) { /* nothing to undo */ }
        paint('bad', '⛔ ' + (html ? message : esc(message || `Sign in with your @${G.domain} Google account to continue.`)));
    };
    G.use = function () {   // "Use a different account"
        G.credential = ''; G.email = '';
        try { google.accounts.id.disableAutoSelect(); google.accounts.id.prompt(); } catch (e) { /* the button is there */ }
        paint('', `Choose your <b>@${esc(G.domain)}</b> Google account.`);
    };
    function onCredential(resp) {
        const c = claims(resp && resp.credential), email = String(c.email || '').toLowerCase();
        if (!email.endsWith('@' + G.domain) || String(c.hd || '').toLowerCase() !== G.domain) {
            G.reset(`You're signed in to Google as <b>${esc(email || 'another account')}</b>, which isn't a @${esc(G.domain)} account. LSH training opens only from your @${esc(G.domain)} account: switch to your <b>@${esc(G.domain)} Chrome profile</b> (or sign in to Google with your @${esc(G.domain)} account) and try again.`, email, true);
            return;
        }
        G.credential = resp.credential; G.email = email;
        paint('ok', `✓ Google account: <b>${esc(email)}</b> · <a href="#" onclick="LSHGoogle.use(); return false;">Use a different account</a>`);
        const u = document.getElementById('login-username'); if (u && !u.value) u.focus();
    }
    function draw(cfg) {
        const form = document.getElementById('auth-form-content'); if (!form || box()) return;
        const b = document.createElement('div'); b.id = 'lsh-google-step';
        b.innerHTML = `<div class="lsh-g-h">Step 1 · Sign in with your <b>@${esc(cfg.domain)}</b> Google account</div>
            <div class="lsh-g-btn"></div><div class="lsh-g-status"></div>
            <div class="lsh-g-h lsh-g-h2">Step 2 · Your username and password</div>`;
        const msg = document.getElementById('auth-login-msg');
        form.insertBefore(b, msg ? msg.nextSibling : form.firstChild);
        const css = document.createElement('style');
        css.textContent = `#lsh-google-step{margin:0 0 14px;}#lsh-google-step .lsh-g-h{font-size:12.5px;font-weight:700;color:var(--slate,#475569);margin:0 0 8px;}
            #lsh-google-step .lsh-g-h2{margin:14px 0 0;}#lsh-google-step .lsh-g-btn{min-height:44px;}
            #lsh-google-step .lsh-g-status{font-size:13px;line-height:1.5;margin-top:6px;}#lsh-google-step .lsh-g-status:empty{display:none;}
            #lsh-google-step .lsh-g-status.ok{color:#166534;}#lsh-google-step .lsh-g-status.bad{color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;}`;
        document.head.appendChild(css);
        const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
        s.onload = () => {
            google.accounts.id.initialize({ client_id: cfg.clientId, callback: onCredential, hd: cfg.domain, auto_select: true, context: 'signin', ux_mode: 'popup', itp_support: true });
            google.accounts.id.renderButton(b.querySelector('.lsh-g-btn'), { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', logo_alignment: 'left', width: 300 });
            google.accounts.id.prompt();
        };
        s.onerror = () => paint('bad', "⛔ Google sign-in couldn't load. Check the connection (or an ad blocker) and reload the page.");
        document.head.appendChild(s);
        // a session sent back here by the rule (an older sign-in, a course link): say why
        if (/[?&]why=google\b/.test(location.search)) paint('', `For security, LSH training now opens only from your <b>@${esc(cfg.domain)}</b> Google account. Sign in with it below.`);
    }
    G.ready = fetch('/api/auth-config', { credentials: 'same-origin', cache: 'no-store' }).then(r => r.json()).then(j => {
        if (!j || !j.google || !j.google.clientId) return;
        G.required = true; G.domain = j.google.domain || G.domain;
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => draw(j.google)); else draw(j.google);
    }).catch(() => { /* the sign-in as before; the server still checks */ });
})();

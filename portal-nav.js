/* LSH Training Portal — shared navigation.
   Every portal page shows the same links (Home, Training Directory, Blueprint)
   plus a Back button. The Simulators and the Knowledge Base aren't in the top bar:
   they open from the Home page and the Training Directory. Portal pages open in the
   same tab; only the training programs themselves (separate sites) open in a new tab.
   Signed-in admins get one admin bar on every main page instead (PortalNav.adminHtml):
   Blueprint · System Management ▾ · Trainee Monitoring · Attendance ·
   Referrals · Switch view · Logout. Everything else lives under System Management. */
const PortalNav = {
    LINKS: [
        ['home', '/index.html', 'Home'],
        ['directory', '/programs.html', 'Training Directory'],
        ['orient', '/blueprint.html', '🧭 Blueprint']
    ],
    // Inside a course's frame, only the way back to the Simulators hub makes sense.
    EMBEDDED_LINKS: [
        ['sims', '/simulators.html', '🛠 Simulators']
    ],
    embedded() { try { return window.self !== window.top; } catch (e) { return true; } },
    // Back to the previous portal page; a page opened fresh (new tab, bookmark) goes to its parent instead.
    back(fallback) {
        let same = false;
        try { same = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) {}
        if (same && history.length > 1) history.back();
        else location.href = fallback || '/index.html';
    },
    // opts: { back: fallback URL or false, cls: extra class for each link }
    html(active, opts) {
        opts = opts || {};
        const cls = opts.cls ? ` ${opts.cls}` : '';
        const links = PortalNav.embedded() ? PortalNav.EMBEDDED_LINKS : PortalNav.LINKS;
        const back = opts.back === false ? '' : `<a class="pn-back${cls}" onclick="PortalNav.back('${opts.back || '/index.html'}')" title="Go back">← Back</a>`;
        return back + links.map(([id, href, label]) => `<a class="${active === id ? 'on' : ''}${cls}" href="${href}"${active === id ? ' aria-current="page"' : ''}>${label}</a>`).join('');
    },
    // Everything an admin uses less often, collated under ⚙ System Management: [href, label, title, opens in a new tab].
    // One entry per destination: Master Control's tabs (users, access, who's online) open from Master Control itself,
    // and the Knowledge Base and Ring Channel are banners on the Training Directory.
    SYSTEM_LINKS: [
        ['/index.html', '🏠 Main Portal', 'The LSH Upskill Hub home page'],
        ['/programs.html', '🎓 Training Directory', 'Every training program, plus the Simulators, Knowledge Base, Ring Channel and CMS'],
        ['/core.html#master', '🛡 Master Control', "Users & revoke access, program access, who's online, activity logs and broadcasts: all on one screen"],
        ['/core.html#registrations', '📝 Registrations <b class="pn-reg-badge" id="idx-reg-badge"></b>', 'Approve new trainee registrations'],
        ['/simulators.html', '🛠 Simulators', ''],
        ['/api/admin-password-check', '🔑 Admin Password Check', 'Does every platform accept the admin password?'],
        ['/api/ai-usage', '🤖 AI Usage', "Today's use of the shared AI budget, flow by flow"]
    ],
    // 👁 Switch view: an admin sees the Training Directory as a trainee does (this tab only).
    traineeView() { try { return sessionStorage.getItem('LSH_VIEW_AS') === 'trainee'; } catch (e) { return false; } },
    switchView() {
        const tv = PortalNav.traineeView();
        try { if (tv) sessionStorage.removeItem('LSH_VIEW_AS'); else sessionStorage.setItem('LSH_VIEW_AS', 'trainee'); } catch (e) {}
        if (location.pathname === '/programs.html') location.reload(); else location.href = '/programs.html';
    },
    // The admin top bar. active: 'orient' | 'sys' | 'monitor' | 'attendance' | 'referrals'; opts.back as in html()
    adminHtml(active, opts) {
        opts = opts || {};
        const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const pill = (id, href, label, title) => `<a class="pn-pill${active === id ? ' on' : ''}" href="${href}"${active === id ? ' aria-current="page"' : ''} title="${esc(title)}">${label}</a>`;
        const back = opts.back === false ? '' : `<a class="pn-back" onclick="PortalNav.back('${opts.back || '/programs.html'}')" title="Go back">← Back</a>`;
        const sys = PortalNav.SYSTEM_LINKS.map(([href, label, title, newTab]) =>
            `<a role="menuitem" href="${href}"${title ? ` title="${esc(title)}"` : ''}${newTab ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`).join('');
        const tv = PortalNav.traineeView();
        return back
            + pill('orient', '/blueprint.html?track=admin', 'Blueprint', 'The Platform Blueprint: how the portal works, for screen sharing')
            + `<span class="pn-sys"><button type="button" class="pn-pill${active === 'sys' ? ' on' : ''}" aria-haspopup="true" aria-expanded="false" onclick="PortalNav.toggleMenu(this, event)">System Management ▾</button><span class="pn-menu" role="menu">${sys}</span></span>`
            + pill('monitor', '/progress.html', 'Trainee Monitoring', "Every trainee's progress and feedback in every program")
            + pill('attendance', '/attendance.html', 'Attendance', 'Take and review attendance in every program, batch by batch')
            + pill('referrals', '/referrals.html', 'Referrals', 'People referred from “Got a referral?” on the home page')
            + `<button type="button" class="pn-pill${tv ? ' on' : ''}" onclick="PortalNav.switchView()" title="${tv ? 'Back to the admin view' : 'See the Training Directory as a trainee does'}"${tv ? ' aria-pressed="true"' : ''}>Switch view</button>`
            + `<button type="button" class="pn-pill" onclick="PortalNav.logout()">Logout</button>`;
    },
    // The trainee top bar on the Training Directory: Blueprint · My Evaluations · Logout (signed out: Log In).
    traineeHtml(active, opts) {
        opts = opts || {};
        const pill = (id, href, label, title) => `<a class="pn-pill${active === id ? ' on' : ''}" href="${href}"${active === id ? ' aria-current="page"' : ''} title="${title}">${label}</a>`;
        const back = opts.back === false ? '' : `<a class="pn-back" onclick="PortalNav.back('${opts.back || '/index.html'}')" title="Go back">← Back</a>`;
        return back
            + pill('home', '/index.html', 'Home', 'The LSH Upskill Hub main page')
            + pill('orient', '/blueprint.html', 'Blueprint', 'The Platform Blueprint: how the portal works')
            + (opts.signedIn
                ? pill('mine', '/simulators/my-evaluations.html', 'My Evaluations', 'Your calendars in progress, submitted, and your trainer’s reports')
                  + `<button type="button" class="pn-pill" onclick="PortalNav.logout()">Logout</button>`
                : pill('login', '/trainee-login.html', 'Log In', 'Log in once for every program'));
    },
    // app.js's logoutSession where the page loads it; otherwise the same steps by hand.
    logout() {
        try { sessionStorage.removeItem('LSH_VIEW_AS'); } catch (e) {}
        if (typeof logoutSession === 'function') return logoutSession();
        try { sessionStorage.removeItem('LSH_SESSION_V1'); localStorage.removeItem('LSH_SESSION_V1'); } catch (e) {}
        Promise.race([fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {}), new Promise(r => setTimeout(r, 2500))])
            .then(() => { location.href = '/index.html?stay=1'; });
    },
    closeMenus() {
        document.querySelectorAll('.pn-menu.open').forEach(m => { m.classList.remove('open'); const b = m.previousElementSibling; if (b) b.setAttribute('aria-expanded', 'false'); });
    },
    // The menu is fixed to the screen under its button, so a top bar that scrolls sideways (phones) can't clip it.
    toggleMenu(btn, ev) {
        if (ev) ev.stopPropagation();
        const menu = btn.nextElementSibling, wasOpen = menu.classList.contains('open');
        PortalNav.closeMenus();
        if (wasOpen) return;
        menu.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
        const r = btn.getBoundingClientRect(), w = menu.offsetWidth;
        menu.style.top = (r.bottom + 6) + 'px';
        menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    }
};
document.addEventListener('click', (e) => { if (!e.target.closest || !e.target.closest('.pn-menu')) PortalNav.closeMenus(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') PortalNav.closeMenus(); });
window.addEventListener('resize', () => PortalNav.closeMenus());
window.addEventListener('scroll', () => PortalNav.closeMenus(), true);
(function () {
    const st = document.createElement('style');
    st.textContent = `.pn-back{display:inline-flex;align-items:center;gap:4px;padding:6px 12px !important;border-radius:999px;border:1px solid rgba(255,255,255,.28);color:#fff !important;cursor:pointer;text-decoration:none;white-space:nowrap;}
        .pn-back:hover{background:rgba(255,255,255,.1);}
        .pn-pill{display:inline-flex;align-items:center;padding:5px 14px !important;border:2px solid #fff;border-radius:999px;background:transparent;color:#f97316 !important;font-family:inherit;font-size:12.5px !important;font-weight:800 !important;line-height:1.2;text-decoration:none;white-space:nowrap;cursor:pointer;}
        .pn-pill:hover{background:rgba(255,255,255,.1);}
        .pn-pill.on{background:#f97316;border-color:#f97316;color:#081226 !important;}
        .pn-sys{display:inline-flex;}
        .pn-menu{display:none;position:fixed;z-index:9500;min-width:250px;max-height:70vh;overflow-y:auto;padding:6px;background:#fff;border-radius:12px;box-shadow:0 18px 40px -12px rgba(8,18,38,.55);white-space:normal;}
        .pn-menu.open{display:block;}
        .pn-menu a{display:flex !important;align-items:center;gap:6px;padding:8px 12px !important;border-radius:8px;color:#0f2148 !important;font-size:13px !important;font-weight:600 !important;text-decoration:none;white-space:nowrap;}
        .pn-menu a:hover{background:#f1f5f9;}
        .pn-reg-badge{display:none;background:#f97316;color:#fff;border-radius:999px;padding:1px 7px;font-size:11px;}
        .pn-reg-badge.has{display:inline-block;}
        .pn-trainee-view{background:#fff7ed;border-bottom:1px solid #fed7aa;color:#9a3412;font-size:13px;font-weight:600;text-align:center;padding:8px 16px;}
        .pn-trainee-view button{margin-left:8px;border:0;background:none;color:#0f2148;font:inherit;font-weight:800;text-decoration:underline;cursor:pointer;}`;
    document.head.appendChild(st);
})();
// Safety net: every portal page gets a Back button, even one built without the shared
// nav bar. If no "← Back" is on the page shortly after it loads (Home excepted), a
// floating one is added. The Checks workflow also fails any page without one.
(function () {
    const PARENT = { '/core.html': '/programs.html', '/progress.html': '/core.html', '/admin-login.html': '/index.html', '/registration.html': '/index.html', '/blueprint.html': '/index.html', '/orientation.html': '/index.html', '/referrals.html': '/core.html', '/attendance.html': '/core.html' };
    function ensureBack() {
        const path = location.pathname.replace(/\/$/, '/index.html');
        if (path === '/index.html' || PortalNav.embedded() || document.querySelector('.pn-back')) return;
        const st = document.createElement('style');
        st.textContent = `.pn-back.pn-float{position:fixed;left:16px;bottom:16px;z-index:9000;background:#0f2148;color:#fff !important;border-color:#0f2148;box-shadow:0 8px 22px -8px rgba(8,18,38,.55);font:700 13px/1 'IBM Plex Sans',Arial,sans-serif;}
            .pn-back.pn-float:hover{background:#132a5c;}
            @media print{.pn-back.pn-float{display:none;}}`;
        document.head.appendChild(st);
        const a = document.createElement('a');
        a.className = 'pn-back pn-float'; a.title = 'Go back'; a.textContent = '← Back'; a.setAttribute('role', 'button'); a.tabIndex = 0;
        a.onclick = () => PortalNav.back(PARENT[path] || '/programs.html');
        a.onkeydown = (e) => { if (e.key === 'Enter') a.click(); };
        document.body.appendChild(a);
    }
    // Pages draw their top bars after load; check once they have.
    const later = () => setTimeout(ensureBack, 1500);
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
})();

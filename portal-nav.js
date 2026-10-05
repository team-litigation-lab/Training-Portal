/* LSH Training Portal — shared navigation.
   Every portal page shows the same links (Home, Training Directory, Orientation)
   plus a Back button. The Simulators and the Knowledge Base aren't in the top bar:
   they open from the Home page and the Training Directory. Portal pages open in the
   same tab; only the training programs themselves (separate sites) open in a new tab. */
const PortalNav = {
    LINKS: [
        ['home', '/index.html', 'Home'],
        ['directory', '/programs.html', 'Training Directory'],
        ['orient', '/orientation.html', '🧭 Orientation']
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
    }
};
(function () {
    const st = document.createElement('style');
    st.textContent = `.pn-back{display:inline-flex;align-items:center;gap:4px;padding:6px 12px !important;border-radius:999px;border:1px solid rgba(255,255,255,.28);color:#fff !important;cursor:pointer;text-decoration:none;white-space:nowrap;}
        .pn-back:hover{background:rgba(255,255,255,.1);}`;
    document.head.appendChild(st);
})();
// Safety net: every portal page gets a Back button, even one built without the shared
// nav bar. If no "← Back" is on the page shortly after it loads (Home excepted), a
// floating one is added. The Checks workflow also fails any page without one.
(function () {
    const PARENT = { '/core.html': '/programs.html', '/progress.html': '/core.html', '/admin-login.html': '/index.html', '/registration.html': '/index.html', '/orientation.html': '/index.html', '/referrals.html': '/core.html', '/attendance.html': '/core.html' };
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

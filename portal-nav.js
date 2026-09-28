/* LSH Training Portal — shared navigation.
   Every portal page shows the same links (Home, Training Directory, Simulators,
   Knowledge Base) plus a Back button. Portal pages open in the same tab; only the
   training programs themselves (separate sites) open in a new tab. */
const PortalNav = {
    LINKS: [
        ['home', '/index.html', 'Home'],
        ['directory', '/programs.html', 'Training Directory'],
        ['sims', '/simulators.html', '🛠 Simulators'],
        ['kb', '/kb.html', '📚 Knowledge Base']
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
        // Inside a course's frame, only the simulator links make sense.
        const links = PortalNav.embedded() ? PortalNav.LINKS.filter(l => l[0] === 'sims') : PortalNav.LINKS;
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

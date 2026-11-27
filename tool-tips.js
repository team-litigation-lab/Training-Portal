// 🧭 What each tool is for, on a hover: the LSH Academy Index's tool banners (LSH Atlas, LSH Elev8, LSH CommX, LSH CaseWorX)
// show a small card in the banners' own elite design (navy, a gold rule, the tool's icon and name) with the overview that was
// only in the banner's title. The banners clip what overflows them, so the card is one element on the page, placed under the
// banner pointed at (or above it when there's no room below). A keyboard focus shows it too; the native title tooltip is
// moved to data-tip so the two don't show at once.
(function () {
    const MORE = {   // a line on what to open it for, after the overview
        'LSH Atlas': 'Open it to look up an SOP or a how-to before you ask.',
        'LSH Elev8': 'Open it to practise a task in a simulator and get a scored debrief.',
        'LSH CommX': 'Open it for your mock calls: answer, take the note, get reviewed.',
        'LSH CaseWorX': 'Open it to work a mock case file in the practice CMS.'
    };
    let tip = null, on = null;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function card() {
        if (tip) return tip;
        tip = document.createElement('div'); tip.className = 'tt-card'; tip.setAttribute('role', 'tooltip'); tip.id = 'tt-card'; tip.hidden = true;
        document.body.appendChild(tip); return tip;
    }
    function show(b) {
        const tx = b.querySelector('.sim-banner-tx'); if (!tx) return;
        if (tx.title) { tx.dataset.tip = tx.title; tx.removeAttribute('title'); }
        const name = ((tx.querySelector('b') || {}).textContent || '').replace(/™/g, '').trim();
        const ic = ((b.querySelector('.sim-banner-ic') || {}).textContent || '').trim();
        const t = card(); on = b;
        t.innerHTML = `<div class="tt-h"><span class="tt-ic">${esc(ic)}</span><b>${esc(name)}</b></div><p>${esc(tx.dataset.tip || '')}</p>${MORE[name] ? `<p class="tt-more">${esc(MORE[name])}</p>` : ''}`;
        t.hidden = false; b.setAttribute('aria-describedby', 'tt-card');
        const r = b.getBoundingClientRect(), w = Math.min(340, window.innerWidth - 24);
        t.style.width = w + 'px';
        const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
        const h = t.offsetHeight, below = r.bottom + 10 + h < window.innerHeight;
        t.style.left = left + 'px'; t.style.top = (below ? r.bottom + 10 : Math.max(8, r.top - h - 10)) + 'px';
        t.classList.toggle('tt-up', !below);
        t.style.setProperty('--tt-x', Math.max(18, Math.min(w - 18, r.left + r.width / 2 - left)) + 'px');
    }
    function hide(b) { if (b && b !== on) return; if (tip) tip.hidden = true; if (on) on.removeAttribute('aria-describedby'); on = null; }
    const banner = e => e.target && e.target.closest && e.target.closest('.sim-banner-row .sim-banner');
    document.addEventListener('mouseover', e => { const b = banner(e); if (b && b !== on) show(b); });
    document.addEventListener('mouseout', e => { const b = banner(e); if (b && !b.contains(e.relatedTarget)) hide(b); });
    document.addEventListener('focusin', e => { const b = banner(e); if (b) show(b); });
    document.addEventListener('focusout', e => { const b = banner(e); if (b) hide(b); });
    window.addEventListener('scroll', () => hide(), true);
    window.addEventListener('resize', () => hide());

    const st = document.createElement('style');
    st.textContent = `.tt-card { position: fixed; z-index: 10050; box-sizing: border-box; padding: 12px 14px 12px; border-radius: 14px; pointer-events: none;
        background: linear-gradient(135deg, #0b1230, #1E2340 55%, #2D3762); color: #eef2ff; border: 1px solid rgba(245,196,81,.55);
        border-top: 3px solid #f5c451; box-shadow: 0 14px 34px rgba(5,10,30,.45); font: 600 13.5px/1.45 system-ui, -apple-system, "Segoe UI", Arial, sans-serif; }
    .tt-card::before { content: ""; position: absolute; left: var(--tt-x, 50%); top: -9px; width: 14px; height: 14px; transform: translateX(-50%) rotate(45deg);
        background: #1E2340; border-left: 3px solid #f5c451; border-top: 3px solid #f5c451; }
    .tt-card.tt-up::before { top: auto; bottom: -8px; border: 0; border-right: 1px solid rgba(245,196,81,.55); border-bottom: 1px solid rgba(245,196,81,.55); }
    .tt-h { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .tt-h b { font-size: 14.5px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase;
        background: linear-gradient(180deg, #fff6d8, #f5c451 55%, #e0a43a); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .tt-ic { width: 26px; height: 26px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 15px;
        background: rgba(245,196,81,.14); border: 1px solid rgba(245,196,81,.45); }
    .tt-card p { margin: 0; color: #e5e9f7; }
    .tt-card .tt-more { margin-top: 7px; padding-top: 7px; border-top: 1px solid rgba(245,196,81,.3); color: #fde7b0; font-weight: 800; }`;
    document.head.appendChild(st);
})();

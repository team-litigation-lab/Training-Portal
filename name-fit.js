// 📏 Every track's name on one line, the whole name shown: LSH Academy Index's cards are narrower in some sets (Beyond-Legal
// Skills is five across), and a long name ("Executive/Personal Assistant Track") wrapped onto two lines that a short window,
// or a browser whose font sets a little taller, then cut off at the card's top. Now each name stays on one line, and a
// name too long for its card has its type stepped down just enough to fit (never below 12px; every name in a set at one size), measured in the browser with
// its own font, so it fits whatever that font is. Runs after the cards are drawn (they are redrawn, so it watches) and on
// a resize.
(function () {
    const MIN = 12;
    // one size for every name in a set (the size its longest name needs, never below MIN), so a set's cards read alike
    function fit() {
        document.querySelectorAll('#idx-topics .topic-group').forEach(g => {
            const hs = [...g.querySelectorAll('.topic-card.tk h3')].filter(h => h.querySelector('.tk-name'));
            hs.forEach(h => { h.classList.remove('nf-wrap'); h.querySelector('.tk-name').style.fontSize = ''; });
            let need = Infinity;
            hs.forEach(h => {
                const n = h.querySelector('.tk-name'), cs = getComputedStyle(h);
                const room = h.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 2;
                if (room <= 0) return;
                const size = parseFloat(getComputedStyle(n).fontSize) || 16;
                need = Math.min(need, n.scrollWidth > room ? size * room / n.scrollWidth : size);   // text width scales with its size
            });
            if (!isFinite(need)) return;
            const size = Math.max(MIN, Math.floor(need * 2) / 2);
            hs.forEach(h => {
                const n = h.querySelector('.tk-name');
                if (Math.abs(parseFloat(getComputedStyle(n).fontSize) - size) > .25) n.style.fontSize = size + 'px';
                const cs = getComputedStyle(h), room = h.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 2;
                // (still too long at the smallest size, on a small laptop: two lines at that size rather than a cut name)
                if (n.scrollWidth > room + 1) h.classList.add('nf-wrap');
            });
        });
    }
    let t = null;
    const soon = () => { clearTimeout(t); t = setTimeout(fit, 30); };
    function watch() {
        const box = document.getElementById('idx-topics'); if (!box || box.__fit) return;
        box.__fit = true;
        new MutationObserver(m => { if (m.some(r => r.type === 'childList')) soon(); }).observe(box, { childList: true, subtree: true });
        soon();
    }
    watch(); document.addEventListener('DOMContentLoaded', watch);
    window.addEventListener('resize', soon);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(soon);   // once the web font is in, measure again
    const st = document.createElement('style');
    st.textContent = `#idx-topics .topic-card.tk h3 { white-space: nowrap !important; overflow: hidden; }
    #idx-topics .topic-card.tk h3 .tk-name { white-space: nowrap !important; max-width: none; }
    #idx-topics .topic-card.tk h3.nf-wrap, #idx-topics .topic-card.tk h3.nf-wrap .tk-name { white-space: normal !important; }
    #idx-topics .topic-card.tk h3.nf-wrap .tk-name { line-height: 1.12 !important; }`;
    document.head.appendChild(st);
    window.IndexNameFit = fit;
})();

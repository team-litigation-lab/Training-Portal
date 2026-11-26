// 🟢 Who's online (admins, on the LSH Academy Index): a pill beside the announcement's ✏️ Edit that counts who is signed in
// right now, and opens a panel listing them in two groups: Trainers, then Trainees by batch (newest batch first). The data is
// GET /api/heartbeat (admins only), the same list as Master Control's Monitoring tab: a row whose page last checked in within
// the server's grace window (HEARTBEAT_GRACE_SECONDS in functions/_utils.js, 150 s) counts as online. The count refreshes
// every 30 seconds, and the open panel with it.
(function () {
    const GRACE = 150, EVERY = 30000;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const secsAgo = v => { if (!v) return null; const d = new Date(String(v).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(v)) ? '' : 'Z')); return isNaN(d) ? null : Math.max(0, Math.round((Date.now() - d) / 1000)); };
    const agoText = s => s === null ? '' : s < 60 ? 'just now' : Math.floor(s / 60) + ' min ago';
    const label = id => (typeof window.batchLabel === 'function' ? window.batchLabel(id) : String(id || '').trim());
    const cohort = id => (typeof window.batchCohort === 'function' ? window.batchCohort(id) : { key: label(id) || 'No Batch', sort: label(id) || '0' });
    let rows = [], timer = null;

    const css = `
    #on-btn { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 3px 11px; border: 1px solid rgba(134,239,172,.65); border-radius: 999px; background: rgba(22,101,52,.25); color: #bbf7d0; font: inherit; font-size: 11.5px; font-weight: 800; white-space: nowrap; cursor: pointer; }
    #on-btn:hover, #on-btn[aria-expanded="true"] { background: rgba(22,101,52,.5); color: #fff; }
    #on-btn:focus-visible { outline: 2px solid #fdba74; outline-offset: 2px; }
    #on-btn i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 0 rgba(34,197,94,.6); animation: onPulse 2.2s ease-out infinite; }
    @keyframes onPulse { 70%, 100% { box-shadow: 0 0 0 6px rgba(34,197,94,0); } }
    #on-pop { position: fixed; z-index: 60; width: min(420px, calc(100vw - 24px)); max-height: min(70vh, 560px); overflow: auto; border-radius: 16px; background: #fffdf8; border: 1px solid rgba(245,196,81,.55); box-shadow: 0 30px 60px -20px rgba(8,18,38,.7); color: #0f172a; }
    #on-pop[hidden] { display: none; }
    #on-pop .on-head { position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; background: linear-gradient(135deg, #1E2340, #2D3762); color: #fff; border-bottom: 2px solid #DB8437; }
    #on-pop .on-head b { font-size: 14px; letter-spacing: .04em; }
    #on-pop .on-head a { color: #fdba74; font-size: 12px; font-weight: 700; text-decoration: none; white-space: nowrap; }
    #on-pop .on-x { background: none; border: 0; color: #fff; font-size: 16px; cursor: pointer; padding: 2px 6px; }
    #on-pop h4 { margin: 0; padding: 10px 16px 6px; font-size: 11.5px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: #1E2340; display: flex; align-items: center; gap: 8px; }
    #on-pop h4 span { font-size: 11px; font-weight: 800; letter-spacing: 0; color: #166534; background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 999px; padding: 1px 8px; }
    #on-pop .on-batch { padding: 6px 16px 2px; font-size: 11px; font-weight: 800; color: #9a5a1c; }
    #on-pop ul { list-style: none; margin: 0; padding: 0 8px 6px; }
    #on-pop li { display: flex; align-items: baseline; gap: 8px; padding: 5px 8px; border-radius: 8px; font-size: 13px; }
    #on-pop li:hover { background: #f8f3e6; }
    #on-pop li .n { font-weight: 800; color: #0f172a; }
    #on-pop li .w { margin-left: auto; font-size: 11.5px; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%; text-align: right; }
    #on-pop .on-none { padding: 4px 16px 10px; font-size: 12.5px; color: #64748b; }
    @media (prefers-reduced-motion: reduce) { #on-btn i { animation: none; } }`;

    const live = r => { const s = secsAgo(r.last_seen); return s !== null && s <= GRACE; };
    const item = r => `<li><span class="n">${esc(r.full_name || r.username)}</span><span class="w" title="${esc(r.current_case || '')}">${esc(r.current_case || agoText(secsAgo(r.last_seen)))}</span></li>`;
    const byName = (a, b) => String(a.full_name || a.username).localeCompare(String(b.full_name || b.username));

    function panelHtml() {
        const on = rows.filter(live), trainers = on.filter(r => r.user_type === 'Admin').sort(byName), trainees = on.filter(r => r.user_type !== 'Admin');
        const groups = new Map();
        trainees.forEach(r => { const c = cohort(r.batch_id); if (!groups.has(c.key)) groups.set(c.key, { key: c.key, sort: c.sort, list: [] }); groups.get(c.key).list.push(r); });
        const batches = [...groups.values()].sort((a, b) => String(b.sort).localeCompare(String(a.sort)));
        return `<div class="on-head"><b>🟢 Online now</b><a href="/core.html#monitoring">Monitoring →</a><button type="button" class="on-x" aria-label="Close">✕</button></div>
            <h4>🧑‍🏫 Trainers <span>${trainers.length}</span></h4>${trainers.length ? `<ul>${trainers.map(item).join('')}</ul>` : '<p class="on-none">No trainer is online.</p>'}
            <h4>🎓 Trainees <span>${trainees.length}</span></h4>${batches.length ? batches.map(g => `<div class="on-batch">${esc(g.key)} · ${g.list.length}</div><ul>${g.list.sort(byName).map(item).join('')}</ul>`).join('') : '<p class="on-none">No trainee is online.</p>'}`;
    }
    function draw() {
        const btn = document.getElementById('on-btn'), pop = document.getElementById('on-pop'); if (!btn) return;
        const on = rows.filter(live), t = on.filter(r => r.user_type === 'Admin').length;
        btn.innerHTML = `<i aria-hidden="true"></i>${on.length} online`;
        btn.title = `${t} trainer${t === 1 ? '' : 's'} and ${on.length - t} trainee${on.length - t === 1 ? '' : 's'} signed in now. Click to see who.`;
        if (pop && !pop.hidden) pop.innerHTML = panelHtml();
    }
    async function load() {
        try { const r = await fetch('/api/heartbeat', { credentials: 'include', cache: 'no-store' }); const d = r.ok ? await r.json() : null; if (Array.isArray(d)) { rows = d; draw(); } } catch (e) { /* keep what was last shown */ }
    }
    function place() {
        const btn = document.getElementById('on-btn'), pop = document.getElementById('on-pop'); if (!btn || !pop) return;
        const b = btn.getBoundingClientRect(), w = pop.offsetWidth;
        pop.style.top = Math.round(b.bottom + 8) + 'px';
        pop.style.left = Math.round(Math.max(12, Math.min(b.right - w, innerWidth - w - 12))) + 'px';
    }
    function toggle(open) {
        const btn = document.getElementById('on-btn'), pop = document.getElementById('on-pop'); if (!btn || !pop) return;
        open = open === undefined ? pop.hidden : open;
        pop.hidden = !open; btn.setAttribute('aria-expanded', String(open));
        if (open) { pop.innerHTML = panelHtml(); place(); load(); }
    }

    // Called by the Index for an admin (not in 👁 trainee view): puts the pill after the given element (the ✏️ Edit link).
    function mount(after) {
        if (!after || document.getElementById('on-btn')) return;
        const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
        after.insertAdjacentHTML('afterend', '<button type="button" id="on-btn" aria-haspopup="dialog" aria-expanded="false" aria-controls="on-pop"><i aria-hidden="true"></i>… online</button>');
        const pop = document.createElement('div'); pop.id = 'on-pop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Who is online now'); document.body.appendChild(pop);
        document.getElementById('on-btn').addEventListener('click', e => { e.stopPropagation(); toggle(); });
        pop.addEventListener('click', e => { if (e.target.closest('.on-x')) toggle(false); e.stopPropagation(); });
        document.addEventListener('click', () => toggle(false));
        document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });
        addEventListener('resize', place);
        load(); timer = setInterval(() => { if (!document.hidden) load(); }, EVERY);
    }
    window.OnlineNow = { mount };
})();

/* LSH Training Portal — shared simulator helpers (loaded after app.js / portal.js) */
(function () {
    // Trainees don't sign in on the portal (each program has its own sign-in),
    // so the simulators are open. Only an admin session changes anything here;
    // drop any leftover trainee session so it can't.
    try {
        [sessionStorage, localStorage].forEach(function (st) {
            const raw = st.getItem('LSH_SESSION_V1');
            if (!raw || raw === 'null') return;
            const s = JSON.parse(raw);
            if (!s || s.userType !== 'Admin') st.removeItem('LSH_SESSION_V1');
        });
    } catch (e) {}
    // A program can pass who is practicing: /simulators/call.html?program=CM&name=Jane%20Doe&batch=B-2026-014
    try {
        const q = new URLSearchParams(location.search);
        if (q.get('name') || q.get('batch') || q.get('program')) {
            const cur = JSON.parse(localStorage.getItem('LSH_SIM_WHO') || '{}');
            ['name', 'batch', 'program'].forEach(k => { if (q.get(k)) cur[k] = q.get(k).slice(0, k === 'name' ? 80 : 40); });
            localStorage.setItem('LSH_SIM_WHO', JSON.stringify(cur));
        }
    } catch (e) {}
})();

const Sim = {
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    session() { try { return (typeof getSession === 'function' ? getSession() : JSON.parse(sessionStorage.getItem('LSH_SESSION_V1') || localStorage.getItem('LSH_SESSION_V1') || 'null')) || {}; } catch (e) { return {}; } },
    isAdmin() { return Sim.session().userType === 'Admin'; },
    // Who is practicing (no account on the portal): { name, batch, program }.
    who() { try { return JSON.parse(localStorage.getItem('LSH_SIM_WHO') || '{}') || {}; } catch (e) { return {}; } },
    setWho(w) { try { localStorage.setItem('LSH_SIM_WHO', JSON.stringify(Object.assign(Sim.who(), w))); } catch (e) {} },
    embedded() { try { return window.self !== window.top; } catch (e) { return true; } },
    topbar(active) {
        Sim._active = active;
        if (!Sim._asked) { Sim._asked = true; setTimeout(() => Sim.askWho(false), 400); }
        const s = Sim.session(), w = Sim.who(), admin = s.userType === 'Admin';
        const me = admin ? `<span class="who">${Sim.esc(s.fullName || s.username || '')}</span><a onclick="logoutSession()">Log Out</a>`
            : `<a class="who" onclick="Sim.askWho(true)" title="Change who is practicing">${w.name ? `Practicing as ${Sim.esc(w.name)}${w.batch ? ' · ' + Sim.esc(w.batch) : ''} ✎` : 'Add your name ✎'}</a>`;
        return `<div class="sim-top">
            <a class="sim-brand" href="/index.html"><img src="/favicon.png" alt=""><span>LSH Training Portal<small>Simulators</small></span></a>
            <div class="sim-nav">
                ${PortalNav.html(active === 'hub' ? 'sims' : '', { back: active === 'hub' ? '/programs.html' : '/simulators.html' })}
                ${me}
            </div></div>`;
    },
    // First visit (not an admin, no name yet): ask once so results can be saved for the trainer.
    askWho(force) {
        if (Sim.isAdmin()) return;
        const w = Sim.who();
        if (!force && (w.name || w.skipped)) return;
        const old = document.getElementById('sim-who'); if (old) old.remove();
        const box = document.createElement('div');
        box.id = 'sim-who';
        box.innerHTML = `<div class="sim-who-card" role="dialog" aria-modal="true" aria-labelledby="sim-who-h">
            <h3 id="sim-who-h">Who's practicing?</h3>
            <p>No account needed. Your name and batch go with your scores so your trainer can see them.</p>
            <label>Full name<input id="sim-who-name" autocomplete="name" value="${Sim.esc(w.name || '')}" placeholder="e.g. Jane Doe"></label>
            <label>Batch ID <span>(optional)</span><input id="sim-who-batch" value="${Sim.esc(w.batch || '')}" placeholder="e.g. B-2026-014"></label>
            <div class="sim-who-act"><button class="sim-btn primary" id="sim-who-ok">Continue</button><button class="sim-btn ghost" id="sim-who-skip">Just practice (don't save)</button></div>
        </div>`;
        document.body.appendChild(box);
        const done = (save) => {
            if (save) {
                const name = document.getElementById('sim-who-name').value.trim();
                if (name.length < 2) { document.getElementById('sim-who-name').focus(); return; }
                Sim.setWho({ name, batch: document.getElementById('sim-who-batch').value.trim(), skipped: false });
            } else Sim.setWho({ skipped: true });
            box.remove();
            const tb = document.getElementById('topbar'); if (tb && tb.firstElementChild) { const a = tb.querySelector('.sim-top'); if (a) tb.innerHTML = Sim.topbar(Sim._active || ''); }
        };
        document.getElementById('sim-who-ok').onclick = () => done(true);
        document.getElementById('sim-who-skip').onclick = () => done(false);
        document.getElementById('sim-who-name').addEventListener('keydown', e => { if (e.key === 'Enter') done(true); });
        setTimeout(() => document.getElementById('sim-who-name').focus(), 30);
    },
    label(name) { try { __currentViewLabel = name; } catch (e) { /* app.js not loaded */ } },
    // Gemini through the portal's own signed-in endpoint.
    async ai({ system, messages, json, maxTokens }) {
        const res = await fetch('/api/sim-ai', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system, messages, json: !!json, maxTokens }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status})`);
        if (!json) return data.text;
        let t = String(data.text).trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
        const s = t.search(/[\[{]/); if (s > 0) t = t.slice(s);
        return JSON.parse(t);
    },
    async saveResult(r) {
        const w = Sim.who();
        // Visitors keep their own history in this browser (the server list is admin-only).
        try {
            const mine = JSON.parse(localStorage.getItem('LSH_SIM_HISTORY') || '[]');
            mine.unshift({ simulator: r.simulator, scenario: r.scenario, score: r.score, summary: r.summary, created_at: new Date().toISOString() });
            localStorage.setItem('LSH_SIM_HISTORY', JSON.stringify(mine.slice(0, 50)));
        } catch (e) {}
        if (!Sim.isAdmin() && !(w.name && w.name.length >= 2)) return;   // "just practice": not sent to the trainer
        try { await fetch('/api/sim-results', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, r, { who: { name: w.name, batch: w.batch, program: w.program } })) }); } catch (e) { /* best effort */ }
    },
    async results() {
        if (!Sim.isAdmin()) {
            let rows = [];
            try { rows = JSON.parse(localStorage.getItem('LSH_SIM_HISTORY') || '[]'); } catch (e) {}
            return { success: true, admin: false, results: rows };
        }
        const res = await fetch('/api/sim-results', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || 'Could not load results.');
        return data;
    },
    scoreChip(n) { if (n == null) return '<span class="sim-score">—</span>'; const c = n >= 85 ? 'good' : n >= 70 ? 'mid' : 'low'; return `<span class="sim-score ${c}">${n}%</span>`; },
    fmtDate(iso) { try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return iso; } }
};

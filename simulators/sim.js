/* LSH Training Portal — shared simulator helpers (loaded after app.js / portal.js) */
(function () {
    // Same guard as the Training Index: no session, no simulator.
    try {
        const raw = sessionStorage.getItem('LSH_SESSION_V1') || localStorage.getItem('LSH_SESSION_V1');
        if (!raw || raw === 'null') window.location.replace('/bridge.html');
    } catch (e) { window.location.replace('/bridge.html'); }
})();

const Sim = {
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    session() { try { return (typeof getSession === 'function' ? getSession() : JSON.parse(sessionStorage.getItem('LSH_SESSION_V1') || localStorage.getItem('LSH_SESSION_V1') || 'null')) || {}; } catch (e) { return {}; } },
    isAdmin() { return Sim.session().userType === 'Admin'; },
    topbar(active) {
        const s = Sim.session();
        return `<div class="sim-top">
            <a class="sim-brand" href="/programs.html"><img src="/favicon.png" alt=""><span>LSH Training Portal<small>Simulators</small></span></a>
            <div class="sim-nav">
                <a href="/programs.html">Training Index</a>
                <a href="/simulators.html" class="${active === 'hub' ? 'on' : ''}">🛠 Simulators</a>
                <span class="who">${Sim.esc(s.fullName || s.username || '')}</span>
                <a onclick="logoutSession()">Log Out</a>
            </div></div>`;
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
        try { await fetch('/api/sim-results', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) }); } catch (e) { /* best effort */ }
    },
    async results() {
        const res = await fetch('/api/sim-results', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || 'Could not load results.');
        return data;
    },
    scoreChip(n) { if (n == null) return '<span class="sim-score">—</span>'; const c = n >= 85 ? 'good' : n >= 70 ? 'mid' : 'low'; return `<span class="sim-score ${c}">${n}%</span>`; },
    fmtDate(iso) { try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return iso; } }
};

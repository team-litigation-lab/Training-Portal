/* LSH Training Portal — shared simulator helpers (loaded after app.js / portal.js) */
const Sim = {
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    session() { try { return (typeof getSession === 'function' ? getSession() : JSON.parse(sessionStorage.getItem('LSH_SESSION_V1') || localStorage.getItem('LSH_SESSION_V1') || 'null')) || {}; } catch (e) { return {}; } },
    isAdmin() { return Sim.session().userType === 'Admin'; },
    // Everyone signs in on the Portal (Admin and Trainee alike), and the tab's copy of who is what keeps the heartbeat going (app.js beats
    // only for a person it knows); with no beat for 90 s the Portal's APIs answer 401. A page opened in a new tab (a link that opens
    // with noopener, a bookmark, the trainer's live review) has the signed cookie but no copy in the tab's own storage, so isAdmin()
    // reads false for a signed-in admin and nothing beats. Ask /api/me once, as programs.html does, keep the answer for the tab and start
    // the heartbeat. Resolves to the session ({} when signed out). A page awaits it before its first render.
    async restore() {
        if (!Sim.session().userType) {
            if (!Sim._me) Sim._me = (async () => {   // (two callers share the one request)
                try {
                    const r = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
                    const d = r.ok ? await r.json().catch(() => null) : null;
                    if (d && d.success && d.user && d.user.userType) {
                        if (typeof setSession === 'function') setSession(d.user); else sessionStorage.setItem('LSH_SESSION_V1', JSON.stringify(d.user));
                        if (typeof startHeartbeat === 'function') startHeartbeat();
                    }
                } catch (e) { /* signed out, or offline: the page shows what it shows without a session */ }
            })().then(() => { Sim._me = null; });
            await Sim._me;
        }
        const s = Sim.session();
        Sim.claim(s);
        return s;
    },
    // The portal's own APIs refuse a session whose heartbeat is more than 90 s old (401, code SESSION_EXPIRED): a laptop that slept, a tab
    // the browser throttled. /api/me re-seeds it, so ask once and send the request again once. Returns the Response either way. (opts
    // are used twice: pass a string body, not a stream.)
    async fetchRetry(url, opts) {
        const r = await fetch(url, opts);
        if (r.status !== 401) return r;
        const d = await r.clone().json().catch(() => null);
        if (!d || d.code !== 'SESSION_EXPIRED') return r;
        try { await fetch('/api/me', { credentials: 'include', cache: 'no-store' }); } catch (e) { return r; }
        return fetch(url, opts);
    },
    // Who is practicing: { name, batch, program }, typed in this browser (not taken from the account; see claim()).
    whoRaw() { try { return JSON.parse(localStorage.getItem('LSH_SIM_WHO') || '{}') || {}; } catch (e) { return {}; } },
    // A trainee signed in to the Portal is who they are signed in as: no "Who's practicing?" box, and their name and batch come from the account.
    who() { const w = Sim.whoRaw(), s = Sim.session(); if (!w.name && s && s.userType === 'Trainee' && (s.fullName || s.username)) return Object.assign({}, w, { name: String(s.fullName || s.username).slice(0, 80), batch: w.batch || String(s.batchId || '').slice(0, 40) }); return w; },
    setWho(w) { try { localStorage.setItem('LSH_SIM_WHO', JSON.stringify(Object.assign(Sim.whoRaw(), w))); } catch (e) {} },
    // A program can pass who is practicing: /simulators/email.html?program=CM&name=Jane%20Doe&batch=B-2026-014
    fromQuery() {
        try {
            const q = new URLSearchParams(location.search);
            if (q.get('name') || q.get('batch') || q.get('program')) {
                const cur = Sim.whoRaw();
                ['name', 'batch', 'program'].forEach(k => { if (q.get(k)) cur[k] = q.get(k).slice(0, k === 'name' ? 80 : 40); });
                localStorage.setItem('LSH_SIM_WHO', JSON.stringify(cur));
            }
        } catch (e) {}
    },
    // The name, the calendars (lsh_gcal[.track]:<name>, lsh_gcal_seen) and the results history live in this browser, not in the account, so a
    // second trainee on the same browser would inherit the first one's calendar and upload it as their own draft. LSH_SIM_USER remembers whose
    // they are: when someone else is signed in, drop them (their own calendar comes back from their account). Nobody remembered yet (a first
    // visit, or kept before this): take them over as they are.
    claim(user) {
        const id = String((user && user.username) || '').trim().toLowerCase();
        if (!id) return false;
        try {
            const prev = localStorage.getItem('LSH_SIM_USER');
            if (prev === id) return false;
            if (prev) {
                const drop = [];
                for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; if (k === 'LSH_SIM_WHO' || k === 'LSH_SIM_HISTORY' || k.indexOf('lsh_gcal') === 0) drop.push(k); }
                drop.forEach(k => localStorage.removeItem(k));
            }
            localStorage.setItem('LSH_SIM_USER', id);
            if (prev) Sim.fromQuery();   // (the link that brought them may name them: ?name=&batch=)
            return !!prev;
        } catch (e) { return false; }
    },
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
        if (Sim.isAdmin() || Sim.session().userType === 'Trainee') return;   // (signed in to the Portal: who they are is known)
        const w = Sim.who();
        if (!force && (w.name || w.skipped)) return;
        const old = document.getElementById('sim-who'); if (old) old.remove();
        const box = document.createElement('div');
        box.id = 'sim-who';
        box.innerHTML = `<div class="sim-who-card" role="dialog" aria-modal="true" aria-labelledby="sim-who-h">
            <h3 id="sim-who-h">Who's practicing?</h3>
            <p>Your name and batch go with your scores so your trainer can see them.</p>
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
    // `module` names the call flow (standard, cms, reception, intake, calendaring, pd, ea-pa): the AI gateway counts every flow
    // against the one shared budget. A page sets Sim.module once; a call can pass its own.
    module: 'portal',
    async ai({ system, messages, json, maxTokens, module }) {
        const res = await Sim.fetchRetry('/api/sim-ai', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module: module || Sim.module, system, messages, json: !!json, maxTokens }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status})`);
        if (!json) return data.text;
        let t = String(data.text).trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
        const s = t.search(/[\[{]/); if (s > 0) t = t.slice(s);
        return JSON.parse(t);
    },
    async saveResult(r) {
        const w = Sim.who();
        // Trainees keep their own history in this browser (the server list is admin-only).
        try {
            const mine = JSON.parse(localStorage.getItem('LSH_SIM_HISTORY') || '[]');
            mine.unshift({ simulator: r.simulator, scenario: r.scenario, score: r.score, summary: r.summary, created_at: new Date().toISOString() });
            localStorage.setItem('LSH_SIM_HISTORY', JSON.stringify(mine.slice(0, 50)));
        } catch (e) {}
        if (!Sim.isAdmin() && !(w.name && w.name.length >= 2)) return;   // "just practice": not sent to the trainer
        try { await Sim.fetchRetry('/api/sim-results', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, r, { who: { name: w.name, batch: w.batch, program: w.program } })) }); } catch (e) { /* best effort */ }
    },
    async results() {
        if (!Sim.isAdmin()) {
            let rows = [];
            try { rows = JSON.parse(localStorage.getItem('LSH_SIM_HISTORY') || '[]'); } catch (e) {}
            return { success: true, admin: false, results: rows };
        }
        const res = await Sim.fetchRetry('/api/sim-results', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || 'Could not load results.');
        return data;
    },
    scoreChip(n) { if (n == null) return '<span class="sim-score">—</span>'; const c = n >= 85 ? 'good' : n >= 70 ? 'mid' : 'low'; return `<span class="sim-score ${c}">${n}%</span>`; },
    fmtDate(iso) { try { return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return iso; } }
};

// On every page: a different person than the one this browser's name and calendars were kept for loses them, before anything reads them;
// then the link's ?name=&batch=&program= (if it has them) says who is practicing.
Sim.claim(Sim.session());
Sim.fromQuery();

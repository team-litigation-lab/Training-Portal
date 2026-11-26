// 🔐 Admin password check, inside Master Control → Site Lock & Admin Password (core.html #pw-check): type the admin password
// once and every platform is asked whether it accepts it. It posts to /api/admin-password-check?format=json (admins only;
// the same check its old page ran) and lists each platform's answer here. Nothing is stored, and the box is cleared after.
(function () {
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const TONE = { ok: ['#166534', '#dcfce7', '#bbf7d0'], bad: ['#991b1b', '#fee2e2', '#fecaca'], warn: ['#92400e', '#fef3c7', '#fde68a'] };
    async function run(e) {
        e.preventDefault();
        const input = document.getElementById('pw-check-input'), out = document.getElementById('pw-check-out'), btn = document.getElementById('pw-check-btn');
        if (!input || !out) return;
        const password = input.value; if (!password.trim()) return;
        btn.disabled = true; out.innerHTML = '<p style="font-size:14px;font-weight:700;color:#475569">Asking every platform…</p>';
        try {
            const body = new FormData(); body.append('password', password);
            const r = await fetch('/api/admin-password-check?format=json', { method: 'POST', body, credentials: 'include', cache: 'no-store' });
            const d = await r.json();
            if (!d.success) throw new Error(d.error || 'The check could not run.');
            out.innerHTML = `<table class="mc-table" style="width:100%"><thead><tr><th>Platform</th><th>Answer</th><th>What it means</th></tr></thead><tbody>${d.rows.map(x => {
                const [fg, bg, bd] = TONE[x.tone] || TONE.warn;
                return `<tr><td style="font-weight:800">${esc(x.name)}</td><td><span style="display:inline-block;padding:2px 10px;border-radius:999px;font-weight:900;font-size:12px;color:${fg};background:${bg};border:1px solid ${bd}">${esc(x.state)}</span></td><td style="font-weight:600">${esc(x.note)}</td></tr>`;
            }).join('')}</tbody></table>`;
        } catch (err) {
            out.innerHTML = `<p style="font-size:14px;font-weight:700;color:#b91c1c">${esc(err.message)}</p>`;
        } finally { input.value = ''; btn.disabled = false; }
    }
    const bind = () => { const f = document.getElementById('pw-check-form'); if (f && !f.__pw) { f.__pw = true; f.addEventListener('submit', run); } };
    bind(); document.addEventListener('DOMContentLoaded', bind);
})();

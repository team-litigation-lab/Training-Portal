// 🎓 Batches in a dropdown (Master Control → 🔑 Program Access & Accounts): the trainees' batch tables used to stack one bar
// under another (Batch B103026, B102026, …) and took the screen. Each list now shows a "Batch" dropdown and only the batch
// picked in it, open; the Trainers section (below the batches) stays as it is. app.js redraws these lists with innerHTML, so
// this watches each list and puts the dropdown back after every redraw, keeping the batch that was picked. While a search is
// typed, every matching batch shows as before (no dropdown), so a search never hides a match.
(function () {
    const LISTS = [['program-access-list', 'pa-search'], ['users-list', 'users-search']];
    const picked = {};   // list id → the batch key picked in its dropdown
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function apply(listId, searchId) {
        const box = document.getElementById(listId); if (!box) return;
        const old = box.querySelector(':scope > .bp-wrap'); if (old) old.remove();
        const batches = [...box.querySelectorAll(':scope > details.pa-batch:not(.pa-trainers)')];
        const search = document.getElementById(searchId);
        if (batches.length < 2 || (search && search.value.trim())) { batches.forEach(d => { d.style.display = ''; }); return; }
        const keyOf = d => d.getAttribute('data-key') || '';
        const label = d => {
            const t = (d.querySelector('.pa-title') || {}).textContent || keyOf(d);
            const chips = [...d.querySelectorAll('summary .pa-chip')].map(c => c.textContent.trim()).join(' · ');
            return t.replace(/^🎓\s*/, '') + (chips ? ' — ' + chips : '');
        };
        if (!batches.some(d => keyOf(d) === picked[listId])) picked[listId] = keyOf(batches[0]);   // the newest batch first
        const wrap = document.createElement('div'); wrap.className = 'bp-wrap';
        wrap.innerHTML = `<label class="bp-label" for="bp-${listId}">🎓 Batch</label><select class="bp-select" id="bp-${listId}">${
            batches.map(d => `<option value="${esc(keyOf(d))}"${keyOf(d) === picked[listId] ? ' selected' : ''}>${esc(label(d))}</option>`).join('')}</select><span class="bp-count">${batches.length} batches</span>`;
        batches[0].parentNode.insertBefore(wrap, batches[0]);
        const show = () => batches.forEach(d => { const on = keyOf(d) === picked[listId]; d.style.display = on ? '' : 'none'; if (on) d.open = true; });
        wrap.querySelector('select').addEventListener('change', e => { picked[listId] = e.target.value; show(); });
        show();
    }

    function watch(listId, searchId) {
        const box = document.getElementById(listId); if (!box || box.__bp) return;
        box.__bp = true;
        let busy = false, t = null;
        new MutationObserver(() => {
            if (busy) return;
            clearTimeout(t); t = setTimeout(() => { busy = true; try { apply(listId, searchId); } finally { setTimeout(() => { busy = false; }, 0); } }, 30);
        }).observe(box, { childList: true });
        apply(listId, searchId);
    }
    const start = () => LISTS.forEach(([l, s]) => watch(l, s));
    start(); document.addEventListener('DOMContentLoaded', start);

    const st = document.createElement('style');
    st.textContent = `.bp-wrap { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 4px 0 12px; padding: 10px 14px; border-radius: 12px;
        background: linear-gradient(135deg, #1E2340, #2D3762); border-bottom: 3px solid #DB8437; }
    .bp-label { color: #f5c451; font-size: 14px; font-weight: 900; letter-spacing: .04em; }
    .bp-select { flex: 1 1 320px; max-width: 640px; min-width: 0; padding: 9px 12px; border-radius: 9px; border: 1.5px solid #e0a43a; background: #fff;
        color: #1E2340; font: inherit; font-size: 14.5px; font-weight: 800; cursor: pointer; }
    .bp-select:focus-visible { outline: 3px solid #f5c451; outline-offset: 2px; }
    .bp-count { color: #dbe2f5; font-size: 12.5px; font-weight: 800; }`;
    document.head.appendChild(st);
})();

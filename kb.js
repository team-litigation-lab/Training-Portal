// LSH Knowledge Base (/kb.html): official SOPs and resources, plus the tips,
// guides and lessons VAs share. Readers enter the team access code (or are
// signed-in admins). VA posts and replies wait for an admin before others see them.
const KB = { access: null, lib: [], data: null, route: '', q: '', src: 'all', cat: '', type: '', sort: 'relevant', cache: {}, queue: null, qFilter: 'pending' };
const { render: md, plain, esc } = window.KBmd;
const TYPE_ICON = { 'SOP': '📘', 'Guide': '🧭', 'Resource': '📎', 'Template': '🧩', 'Checklist': '✅', 'Policy': '📜', 'Tip': '💡', 'How-to guide': '🛠', 'Lesson learned': '🎯', 'Question': '❓' };
const STATUS_LABEL = { pending: 'Waiting for review', published: 'Published', rejected: 'Sent back', hidden: 'Hidden' };

// ---------- data ----------
async function api(path, opts) {
    const res = await fetch(path, Object.assign({ credentials: 'include', headers: { 'Content-Type': 'application/json' } }, opts || {}));
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.code === 'KB_LOCKED') { KB.access = Object.assign(KB.access || {}, { unlocked: false }); route(); throw new Error(data.error); }
    if (!res.ok || data.success === false) throw new Error(data.error || `Something went wrong (${res.status}).`);
    return data;
}
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });

async function loadAll() {
    const [lib, data] = await Promise.all([
        fetch('/kb-files/library.json', { credentials: 'include', cache: 'no-store' }).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
        api('/api/kb/articles')
    ]);
    KB.lib = (lib.items || []).map(x => ({ ...x, ref: 's:' + x.id, official: true, author: x.owner || 'LSH', search: [x.title, x.summary, (x.tags || []).join(' '), x.text].join(' ').toLowerCase() }));
    KB.data = data;
    KB.data.articles.forEach(a => { a.search = [a.title, a.summary, a.tags.join(' '), plain(a.body), a.author].join(' ').toLowerCase(); });
}
function items() {
    const st = (KB.data && KB.data.stats) || {};
    const withStats = (x) => Object.assign(x, { stats: st[x.ref] || { views: 0, helpful: 0, comments: 0 } });
    return KB.lib.map(withStats).concat(((KB.data && KB.data.articles) || []).map(withStats));
}

// ---------- routing ----------
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
window.addEventListener('hashchange', route);
function route() {
    const app = document.getElementById('app');
    if (!KB.access) return;
    if (!KB.access.unlocked) { renderGate(app); return; }
    if (!KB.data) { app.innerHTML = `<div class="sim-card"><div class="sim-loading">Loading the Knowledge Base…</div></div>`;
        loadAll().then(route).catch(e => { app.innerHTML = `<div class="sim-card"><div class="sim-error">${esc(e.message)}</div></div>`; }); return; }
    const h = location.hash.replace(/^#\/?/, ''), [view, id] = h.split('/');
    window.scrollTo(0, 0);
    if (view === 'a' || view === 's') return renderArticle(app, view + ':' + decodeURIComponent(id || ''));
    if (view === 'new') return renderEditor(app, null);
    if (view === 'edit') return renderEditor(app, Number(id));
    if (view === 'mine') return renderMine(app);
    if (view === 'review' && KB.access.admin) return renderReview(app);
    renderHome(app);
}

// ---------- gate ----------
function renderGate(app) {
    const a = KB.access;
    app.innerHTML = `<div class="kb-gate sim-card">
        <div class="kb-gate-ic">📚</div>
        <h2>LSH Knowledge Base</h2>
        <p>SOPs, resources and know-how shared by LSH VAs, for our team only. Enter the team access code from your trainer or team lead.</p>
        ${a.configured ? `<form onsubmit="unlock(event)">
            <label>Your full name<input id="g-name" autocomplete="name" required minlength="2" maxlength="80" value="${esc(localStorage.getItem('LSH_KB_NAME') || '')}"></label>
            <label>Batch <span class="sim-muted">(optional)</span><input id="g-batch" maxlength="40" value="${esc(localStorage.getItem('LSH_KB_BATCH') || '')}"></label>
            <label>Team access code<input id="g-code" type="password" autocomplete="off" required></label>
            <div id="g-err" class="sim-error" hidden></div>
            <button class="sim-btn primary" type="submit">Open the Knowledge Base</button>
        </form>` : `<div class="kb-note">The Knowledge Base isn’t open yet. An admin needs to set the team access code.</div>`}
        <p class="sim-muted kb-small">Admins: <a href="/admin-login.html">sign in</a> to manage the Knowledge Base${a.configured ? '' : ' and set the code'}.</p>
    </div>`;
}
async function unlock(e) {
    e.preventDefault();
    const name = document.getElementById('g-name').value.trim(), batch = document.getElementById('g-batch').value.trim(), code = document.getElementById('g-code').value;
    const err = document.getElementById('g-err'); err.hidden = true;
    try {
        const r = await post('/api/kb/access', { action: 'unlock', name, batch, code });
        try { localStorage.setItem('LSH_KB_NAME', name); localStorage.setItem('LSH_KB_BATCH', batch); } catch (x) {}
        KB.access = { ...KB.access, unlocked: true, who: r.who }; topbar(); route();
    } catch (x) { err.textContent = x.message; err.hidden = false; }
}
async function signOut() {
    if (KB.access && KB.access.admin) { logoutSession(); return; }
    await post('/api/kb/access', { action: 'signout' }).catch(() => {});
    KB.access.unlocked = false; KB.data = null; topbar(); go('#/');
}

// ---------- home ----------
function scoreOf(x, terms) {
    if (!terms.length) return 1;
    const t = x.title.toLowerCase(), tags = (x.tags || []).join(' '), sum = (x.summary || '').toLowerCase();
    let s = 0;
    for (const w of terms) {
        if (!x.search.includes(w)) return 0;
        s += (t.includes(w) ? 6 : 0) + (tags.includes(w) ? 3 : 0) + (sum.includes(w) ? 2 : 0) + 1;
    }
    return s + (x.official ? 1 : 0);
}
function results() {
    const terms = KB.q.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    let list = items().filter(x => (KB.src === 'all' || (KB.src === 'official') === !!x.official) && (!KB.cat || x.category === KB.cat) && (!KB.type || x.type === KB.type));
    list.forEach(x => { x._score = scoreOf(x, terms); });
    list = list.filter(x => x._score > 0);
    const date = (x) => String(x.updatedAt || x.updated || x.createdAt || '');
    const by = {
        relevant: (a, b) => (b._score - a._score) || ((b.featured ? 1 : 0) - (a.featured ? 1 : 0)) || date(b).localeCompare(date(a)),
        newest: (a, b) => date(b).localeCompare(date(a)),
        helpful: (a, b) => b.stats.helpful - a.stats.helpful || b.stats.views - a.stats.views,
        viewed: (a, b) => b.stats.views - a.stats.views
    };
    return list.sort(by[KB.sort] || by.relevant);
}
function card(x) {
    const when = x.updatedAt || x.updated || x.createdAt;
    const snippet = x.summary || plain(x.body || x.text || '').slice(0, 200);
    return `<a class="kb-card" href="#/${x.official ? 's/' + encodeURIComponent(x.id) : 'a/' + x.id}">
        <div class="kb-card-top"><span class="kb-src ${x.official ? 'off' : 'team'}">${x.official ? 'Official' : x.byAdmin ? 'From an admin' : 'From the team'}</span>
            <span class="kb-type">${TYPE_ICON[x.type] || '📄'} ${esc(x.type)}</span><span class="kb-cat">${esc(x.category)}</span>${x.featured ? '<span class="kb-feat">★ Featured</span>' : ''}</div>
        <h3>${esc(x.title)}</h3>
        <p>${esc(snippet)}${snippet.length >= 200 ? '…' : ''}</p>
        <div class="kb-meta">${esc(x.author || '')}${x.batch && !x.byAdmin ? ' · ' + esc(x.batch) : ''} · ${esc(fmtDate(when))}
            <span>👍 ${x.stats.helpful}</span><span>💬 ${x.stats.comments}</span><span>👁 ${x.stats.views}</span>${x.file ? '<span>📎 original file</span>' : ''}</div>
    </a>`;
}
function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? String(iso) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
function contributors() {
    const by = {};
    ((KB.data && KB.data.articles) || []).filter(a => !a.byAdmin).forEach(a => {
        const k = a.author.toLowerCase(); const c = by[k] || (by[k] = { name: a.author, posts: 0, helpful: 0, cats: {} });
        c.posts++; c.helpful += (KB.data.stats[a.ref] || {}).helpful || 0; c.cats[a.category] = (c.cats[a.category] || 0) + 1;
    });
    return Object.values(by).sort((a, b) => b.posts - a.posts || b.helpful - a.helpful).slice(0, 8);
}
function renderHome(app) {
    const d = KB.data, all = items(), cats = d.categories || [];
    const nOff = KB.lib.length, nTeam = d.articles.length;
    const pend = d.pending ? d.pending.posts + d.pending.comments : 0;
    const catCount = (c) => all.filter(x => x.category === c).length;
    const types = [...new Set(all.map(x => x.type))].sort();
    app.innerHTML = `
    <section class="sim-hero kb-hero">
        <div class="eyebrow">LSH Knowledge Base</div>
        <h1>What do you need to know?</h1>
        <p>${nOff} official SOP${nOff === 1 ? '' : 's'} and resources, and ${nTeam} tip${nTeam === 1 ? '' : 's'}, guides and lessons shared by the team.</p>
        <div class="kb-search"><input id="kb-q" type="search" placeholder="Search SOPs, tips and guides… e.g. lien reduction, intake call, HIPAA" value="${esc(KB.q)}" oninput="KB.q=this.value;renderResults()" aria-label="Search the Knowledge Base"></div>
        <div class="kb-actions">
            <a class="sim-btn orange" href="#/new">✍️ Share your knowledge</a>
            <a class="sim-btn ghost" href="#/mine">📂 My posts${d.mine.length ? ` (${d.mine.length})` : ''}</a>
            ${KB.access.admin ? `<a class="sim-btn ghost" href="#/review">🛡 Review &amp; settings${pend ? ` <b class="kb-badge">${pend}</b>` : ''}</a>` : ''}
        </div>
    </section>
    <div class="kb-layout">
        <div>
            <div class="kb-filters">
                ${[['all', 'Everything'], ['official', '📘 Official SOPs & resources'], ['team', '💡 From the team']].map(([k, l]) => `<button class="${KB.src === k ? 'on' : ''}" onclick="KB.src='${k}';renderHome(document.getElementById('app'))">${l}</button>`).join('')}
                <select onchange="KB.cat=this.value;renderResults()" aria-label="Category"><option value="">All categories</option>${cats.map(c => `<option ${KB.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
                <select onchange="KB.type=this.value;renderResults()" aria-label="Type"><option value="">All types</option>${types.map(t => `<option ${KB.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
                <select onchange="KB.sort=this.value;renderResults()" aria-label="Sort">${[['relevant', 'Most relevant'], ['newest', 'Newest'], ['helpful', 'Most helpful'], ['viewed', 'Most viewed']].map(([k, l]) => `<option value="${k}" ${KB.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
            </div>
            <div id="kb-results"></div>
        </div>
        <aside>
            <div class="sim-card kb-side"><h4>Categories</h4>${cats.filter(c => catCount(c)).map(c => `<button class="kb-catlink ${KB.cat === c ? 'on' : ''}" data-c="${esc(c)}" onclick="KB.cat=KB.cat===this.dataset.c?'':this.dataset.c;renderHome(document.getElementById('app'))">${esc(c)} <span>${catCount(c)}</span></button>`).join('') || '<p class="sim-muted">Nothing here yet.</p>'}</div>
            <div class="sim-card kb-side"><h4>Top contributors</h4>${contributors().map(c => `<div class="kb-contrib"><b>${esc(c.name)}</b><span>${c.posts} post${c.posts === 1 ? '' : 's'} · 👍 ${c.helpful}</span><small>${esc(Object.keys(c.cats).slice(0, 3).join(', '))}</small></div>`).join('') || '<p class="sim-muted">Be the first to share something the team should know.</p>'}</div>
        </aside>
    </div>`;
    renderResults();
}
function renderResults() {
    const el = document.getElementById('kb-results'); if (!el) return;
    const list = results();
    el.innerHTML = list.length ? list.map(card).join('') : `<div class="sim-card kb-empty">${KB.q ? `Nothing matches “${esc(KB.q)}”.` : 'Nothing here yet.'} <a href="#/new">Share what you know</a> or ask a question.</div>`;
}

// ---------- article ----------
async function renderArticle(app, ref) {
    const isSop = ref.startsWith('s:');
    const base = isSop ? KB.lib.find(x => x.ref === ref) : null;
    if (isSop && !base) { app.innerHTML = `<div class="sim-card sim-error">That SOP isn’t in the library.</div>`; return; }
    app.innerHTML = `<div class="sim-card"><div class="sim-loading">Opening…</div></div>`;
    let detail, page = '';
    try {
        [detail, page] = await Promise.all([
            api('/api/kb/articles?ref=' + encodeURIComponent(ref)),
            isSop && base.page ? fetch(base.page, { credentials: 'include', cache: 'no-store' }).then(r => r.ok ? r.text() : '') : Promise.resolve('')
        ]);
    } catch (e) { app.innerHTML = `<div class="sim-card sim-error">${esc(e.message)} <a href="#/">Back to the Knowledge Base</a></div>`; return; }
    const a = isSop ? base : detail.article, admin = KB.access.admin;
    const own = !isSop && a.author && KB.access.who && a.author === KB.access.who.name && a.status !== 'published';
    const bodyMd = isSop ? page.replace(/^---[\s\S]*?\n---\s*\n/, '') : a.body;
    const comments = detail.comments || [];
    app.innerHTML = `
    <a class="kb-back" href="#/">← Knowledge Base</a>
    <article class="sim-card kb-article">
        ${!isSop && a.status !== 'published' ? `<div class="kb-status ${a.status}"><b>${STATUS_LABEL[a.status] || a.status}.</b> ${a.status === 'pending' ? 'Only you and the admins can see this until it’s approved.' : ''}${a.reviewNote ? ` Note from the reviewer: “${esc(a.reviewNote)}”` : ''}</div>` : ''}
        <div class="kb-card-top"><span class="kb-src ${isSop ? 'off' : 'team'}">${isSop ? 'Official' : a.byAdmin ? 'From an admin' : 'From the team'}</span><span class="kb-type">${TYPE_ICON[a.type] || '📄'} ${esc(a.type)}</span><span class="kb-cat">${esc(a.category)}</span>${a.featured ? '<span class="kb-feat">★ Featured</span>' : ''}</div>
        <h1>${esc(a.title)}</h1>
        <div class="kb-meta">${isSop ? `${esc(a.owner || 'LSH')}${a.updated ? ' · updated ' + esc(fmtDate(a.updated)) : ''}${a.version ? ' · version ' + esc(a.version) : ''}` : `Shared by <b>${esc(a.author)}</b>${a.batch && !a.byAdmin ? ' · ' + esc(a.batch) : ''} · ${esc(fmtDate(a.createdAt))}${a.updatedAt !== a.createdAt ? ' · edited ' + esc(fmtDate(a.updatedAt)) : ''}`}
            <span>👁 ${detail.stats.views}</span></div>
        ${a.summary ? `<p class="kb-summary">${esc(a.summary)}</p>` : ''}
        <div class="kb-tools">
            ${isSop && a.file ? `<a class="sim-btn ghost" href="${esc(a.file)}" target="_blank" rel="noopener">📎 Open the original${a.fileName ? ' (' + esc(a.fileName) + ')' : ''}</a>` : ''}
            ${!isSop && a.linkUrl ? `<a class="sim-btn ghost" href="${esc(a.linkUrl)}" target="_blank" rel="noopener noreferrer">🔗 Open the linked resource</a>` : ''}
            ${(admin && !isSop) || own ? `<a class="sim-btn ghost" href="#/edit/${a.id}">✏️ Edit</a>` : ''}
            ${admin && !isSop ? reviewButtons(a, true) : ''}
        </div>
        <div class="kb-body md">${md(bodyMd) || '<p class="sim-muted">This SOP has no page text yet; open the original file.</p>'}</div>
        ${(a.tags || []).length ? `<div class="kb-tags">${a.tags.map(t => `<button data-t="${esc(t)}" onclick="KB.q=this.dataset.t;go('#/')">#${esc(t)}</button>`).join('')}</div>` : ''}
        ${isSop || a.status === 'published' ? `<div class="kb-helpful"><button id="kb-help" class="${detail.voted ? 'on' : ''}" onclick="toggleHelpful('${esc(ref)}')">👍 Helpful <span>${detail.stats.helpful}</span></button><span class="sim-muted">Did this help you? It helps others find the best answers.</span></div>` : ''}
    </article>
    ${isSop || a.status === 'published' ? `<section class="sim-card kb-comments">
        <h3>💬 Add your experience <span class="sim-muted">(${comments.filter(c => c.status === 'approved').length})</span></h3>
        <p class="sim-muted">Share a tip, an example from your own work, or a question about this ${isSop ? 'SOP' : 'post'}. Replies appear once an admin approves them.</p>
        ${comments.map(c => `<div class="kb-comment ${c.status}"><div class="kb-comment-h"><b>${esc(c.author)}</b>${c.byAdmin ? ' <span class="kb-src off">Admin</span>' : c.batch ? ` <span class="sim-muted">${esc(c.batch)}</span>` : ''} <span class="sim-muted">${esc(fmtDate(c.createdAt))}</span>
            ${c.status !== 'approved' ? `<span class="kb-pill ${c.status}">${c.status === 'pending' ? 'Waiting for review' : esc(c.status)}</span>` : ''}
            ${admin ? `<span class="kb-cbtns">${c.status !== 'approved' ? `<button onclick="reviewComment(${c.id},'approve')">Approve</button>` : ''}<button onclick="reviewComment(${c.id},'delete')">Delete</button></span>` : ''}</div>
            <div class="md">${md(c.body)}</div></div>`).join('')}
        <form onsubmit="submitComment(event,'${esc(ref)}')"><textarea id="kb-reply" rows="3" maxlength="5000" placeholder="What worked for you? What would you add?" required></textarea>
            <div id="kb-reply-msg" class="sim-muted"></div><button class="sim-btn primary" type="submit">Send reply</button></form>
    </section>` : ''}`;
}
async function toggleHelpful(ref) {
    try { const r = await post('/api/kb/articles', { action: 'helpful', ref }); const b = document.getElementById('kb-help'); b.classList.toggle('on', r.voted); b.querySelector('span').textContent = r.helpful;
        if (KB.data.stats[ref]) KB.data.stats[ref].helpful = r.helpful; else KB.data.stats[ref] = { views: 1, helpful: r.helpful, comments: 0 }; } catch (e) { toast(e.message); }
}
async function submitComment(e, ref) {
    e.preventDefault();
    const box = document.getElementById('kb-reply'), msg = document.getElementById('kb-reply-msg');
    try { const r = await post('/api/kb/comments', { action: 'submit', ref, body: box.value });
        toast(r.status === 'approved' ? 'Reply posted.' : 'Thanks! Your reply will appear once an admin approves it.'); route(); }
    catch (x) { msg.textContent = x.message; }
}
async function reviewComment(id, decision) {
    try { await post('/api/kb/comments', { action: 'review', id, decision }); toast(decision === 'approve' ? 'Reply approved.' : 'Reply removed.'); KB.queue = null; route(); } catch (e) { toast(e.message); }
}

// ---------- editor ----------
const FORMAT_HELP = `**bold** · *italic* · ## Heading · - bullet · 1. step · - [ ] checklist item · > quote · [link text](https://…) · | table | rows |`;
function renderEditor(app, id) {
    const d = KB.data;
    const cur = id ? (d.articles.find(a => a.id === id) || null) : null;
    if (id && !cur) {
        app.innerHTML = `<div class="sim-card"><div class="sim-loading">Opening…</div></div>`;
        api('/api/kb/articles?ref=a:' + id).then(r => { d.articles.push(Object.assign(r.article, { hidden: true, search: '' })); renderEditor(app, id); d.articles = d.articles.filter(a => !a.hidden); })
            .catch(e => { app.innerHTML = `<div class="sim-card sim-error">${esc(e.message)}</div>`; });
        return;
    }
    const v = cur || { type: 'Tip', category: '', title: '', summary: '', body: '', tags: [], linkUrl: '' };
    app.innerHTML = `
    <a class="kb-back" href="${cur ? '#/a/' + cur.id : '#/'}">← ${cur ? 'Back to the post' : 'Knowledge Base'}</a>
    <form class="sim-card kb-editor" onsubmit="saveArticle(event, ${cur ? cur.id : 'null'})">
        <h2>${cur ? 'Edit post' : 'Share your knowledge'}</h2>
        ${cur ? '' : `<p class="sim-muted">A tip that saved you time, a how-to, a checklist, a lesson from a hard case, or a question for the team. ${KB.access.admin ? 'As an admin, your post is published straight away.' : 'An admin reviews every post before the team sees it.'} Leave out client names and personal details.</p>`}
        <div class="kb-row">
            <label>Type<select id="e-type">${d.types.map(t => `<option ${v.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
            <label>Category<select id="e-cat" required><option value="">Choose…</option>${d.categories.map(c => `<option ${v.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        </div>
        <label>Title<input id="e-title" required minlength="5" maxlength="160" value="${esc(v.title)}" placeholder="e.g. Getting itemized bills from hospitals on the first request"></label>
        <label>One-line summary <span class="sim-muted">(optional)</span><input id="e-sum" maxlength="400" value="${esc(v.summary)}" placeholder="What will someone learn or be able to do?"></label>
        <div class="kb-tabs"><button type="button" class="on" id="t-write" onclick="edTab('write')">Write</button><button type="button" id="t-prev" onclick="edTab('preview')">Preview</button></div>
        <textarea id="e-body" rows="14" maxlength="30000" required placeholder="Explain it the way you'd tell a new teammate. Steps, examples and pitfalls help most.">${esc(v.body)}</textarea>
        <div id="e-prev" class="kb-body md kb-preview" hidden></div>
        <p class="sim-muted kb-small">Formatting: ${esc(FORMAT_HELP)}</p>
        <div class="kb-row">
            <label>Tags <span class="sim-muted">(comma-separated)</span><input id="e-tags" maxlength="250" value="${esc((v.tags || []).join(', '))}" placeholder="e.g. medical records, HIPAA, follow-up"></label>
            <label>Link to a file or page <span class="sim-muted">(optional, https://)</span><input id="e-link" type="url" maxlength="500" value="${esc(v.linkUrl)}" placeholder="Google Drive, template, etc."></label>
        </div>
        <div id="e-err" class="sim-error" hidden></div>
        <div class="kb-actions"><button class="sim-btn primary" type="submit">${cur ? 'Save changes' : KB.access.admin ? 'Publish' : 'Send for review'}</button><a class="sim-btn ghost" href="${cur ? '#/a/' + cur.id : '#/'}">Cancel</a></div>
    </form>`;
}
function edTab(t) {
    const prev = document.getElementById('e-prev'), body = document.getElementById('e-body');
    document.getElementById('t-write').classList.toggle('on', t === 'write'); document.getElementById('t-prev').classList.toggle('on', t !== 'write');
    if (t === 'write') { prev.hidden = true; body.hidden = false; } else { prev.innerHTML = md(body.value) || '<p class="sim-muted">Nothing to preview yet.</p>'; prev.hidden = false; body.hidden = true; }
}
async function saveArticle(e, id) {
    e.preventDefault();
    const val = (x) => document.getElementById(x).value;
    const payload = { type: val('e-type'), category: val('e-cat'), title: val('e-title'), summary: val('e-sum'), body: val('e-body'), tags: val('e-tags'), linkUrl: val('e-link').trim() };
    const err = document.getElementById('e-err'); err.hidden = true;
    try {
        const r = await post('/api/kb/articles', id ? { action: 'edit', id, ...payload } : { action: 'submit', ...payload });
        await loadAll(); KB.queue = null;
        toast(r.status === 'published' ? (id ? 'Saved.' : 'Published.') : 'Sent for review. You’ll see its status under My posts.');
        go(r.status === 'published' ? '#/a/' + (id || r.id) : '#/mine');
    } catch (x) { err.textContent = x.message; err.hidden = false; }
}

// ---------- my posts ----------
function renderMine(app) {
    const mine = KB.data.mine;
    app.innerHTML = `<a class="kb-back" href="#/">← Knowledge Base</a>
    <section class="sim-card"><h2>My posts</h2><p class="sim-muted">Posts shared as <b>${esc(KB.access.who.name)}</b>${KB.access.who.batch ? ' · ' + esc(KB.access.who.batch) : ''}. Sent-back posts show the reviewer’s note; edit and resend them.</p>
    ${mine.length ? mine.map(a => `<div class="kb-mine"><div><a href="#/a/${a.id}"><b>${esc(a.title)}</b></a><div class="sim-muted">${esc(a.type)} · ${esc(a.category)} · ${esc(fmtDate(a.updatedAt))}</div>
        ${a.reviewNote && a.status !== 'published' ? `<div class="kb-note">Reviewer: ${esc(a.reviewNote)}</div>` : ''}</div>
        <div class="kb-mine-r"><span class="kb-pill ${a.status}">${STATUS_LABEL[a.status] || a.status}</span>
        ${a.status === 'pending' || a.status === 'rejected' ? `<a class="sim-btn ghost" href="#/edit/${a.id}">Edit</a>` : ''}${a.status === 'pending' ? `<button class="sim-btn ghost" onclick="withdraw(${a.id})">Withdraw</button>` : ''}</div></div>`).join('')
        : `<p>You haven’t shared anything yet. <a href="#/new">Share your first tip</a>.</p>`}</section>`;
}
async function withdraw(id) {
    if (!confirm('Withdraw this post? It will be deleted.')) return;
    try { await post('/api/kb/articles', { action: 'delete', id }); await loadAll(); toast('Withdrawn.'); route(); } catch (e) { toast(e.message); }
}

// ---------- admin: review & settings ----------
function reviewButtons(a, big) {
    const b = (d, l) => `<button type="button" class="${big ? 'sim-btn ghost' : ''}" onclick="reviewPost(${a.id},'${d}')">${l}</button>`;
    return [a.status !== 'published' ? b('approve', '✅ Approve') : '', a.status === 'pending' ? b('reject', '↩️ Send back') : '',
        a.status === 'published' ? (a.featured ? b('unfeature', '☆ Unfeature') : b('feature', '★ Feature')) : '',
        a.status === 'published' ? b('hide', '🙈 Hide') : '', b('delete', '🗑 Delete')].join('');
}
async function reviewPost(id, decision) {
    try {
        if (decision === 'delete') { if (!confirm('Delete this post for good?')) return; await post('/api/kb/articles', { action: 'delete', id }); }
        else {
            let note = '';
            if (decision === 'reject') { note = prompt('What should the author change? They’ll see this note.'); if (!note) return; }
            await post('/api/kb/articles', { action: 'review', id, decision, note });
        }
        toast({ approve: 'Approved and published.', reject: 'Sent back to the author.', hide: 'Hidden.', feature: 'Featured.', unfeature: 'No longer featured.', delete: 'Deleted.' }[decision]);
        KB.queue = null; await loadAll();
        if (decision === 'delete' && /^#\/a\//.test(location.hash)) go('#/'); else route();
    } catch (e) { toast(e.message); }
}
async function renderReview(app) {
    if (!KB.queue) {
        app.innerHTML = `<div class="sim-card"><div class="sim-loading">Loading the review queue…</div></div>`;
        try { KB.queue = await api('/api/kb/articles?queue=1'); } catch (e) { app.innerHTML = `<div class="sim-card sim-error">${esc(e.message)}</div>`; return; }
    }
    const q = KB.queue, pending = q.posts.filter(p => p.status === 'pending');
    const shown = q.posts.filter(p => KB.qFilter === 'all' || p.status === KB.qFilter);
    const refTitle = (ref) => { const x = items().find(i => i.ref === ref) || q.posts.find(p => p.ref === ref); return x ? x.title : ref; };
    const cc = KB.access.codeChangedAt;
    app.innerHTML = `<a class="kb-back" href="#/">← Knowledge Base</a>
    <section class="sim-card"><h2>🛡 Review queue</h2>
        <p class="sim-muted">${pending.length} post${pending.length === 1 ? '' : 's'} and ${q.comments.length} repl${q.comments.length === 1 ? 'y' : 'ies'} waiting. Approve to publish; send back with a note so the author can fix it.</p>
        <div class="kb-filters">${[['pending', 'Waiting'], ['published', 'Published'], ['rejected', 'Sent back'], ['hidden', 'Hidden'], ['all', 'All']].map(([k, l]) => `<button class="${KB.qFilter === k ? 'on' : ''}" onclick="KB.qFilter='${k}';route()">${l} (${k === 'all' ? q.posts.length : q.posts.filter(p => p.status === k).length})</button>`).join('')}</div>
        ${shown.map(p => `<details class="kb-q" ${p.status === 'pending' ? 'open' : ''}><summary><span class="kb-pill ${p.status}">${STATUS_LABEL[p.status] || p.status}</span> <b>${esc(p.title)}</b> <span class="sim-muted">${esc(p.type)} · ${esc(p.category)} · ${esc(p.author)}${p.batch ? ' (' + esc(p.batch) + ')' : ''} · ${esc(fmtDate(p.updatedAt))}</span></summary>
            ${p.summary ? `<p><i>${esc(p.summary)}</i></p>` : ''}<div class="md kb-qbody">${md(p.body)}</div>${p.linkUrl ? `<p>🔗 <a href="${esc(p.linkUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.linkUrl)}</a></p>` : ''}
            ${p.tags.length ? `<p class="sim-muted">Tags: ${esc(p.tags.join(', '))}</p>` : ''}${p.reviewNote ? `<div class="kb-note">Last note: ${esc(p.reviewNote)}</div>` : ''}
            <div class="kb-qbtns">${reviewButtons(p, true)}<a class="sim-btn ghost" href="#/edit/${p.id}">✏️ Edit</a><a class="sim-btn ghost" href="#/a/${p.id}">Open</a></div></details>`).join('') || '<p class="sim-muted">Nothing here.</p>'}
    </section>
    <section class="sim-card"><h2>💬 Replies waiting</h2>
        ${q.comments.map(c => `<div class="kb-comment pending"><div class="kb-comment-h"><b>${esc(c.author)}</b> <span class="sim-muted">${esc(c.batch)} · on <a href="#/${c.ref.replace(':', '/')}">${esc(refTitle(c.ref))}</a> · ${esc(fmtDate(c.createdAt))}</span>
            <span class="kb-cbtns"><button onclick="reviewComment(${c.id},'approve')">Approve</button><button onclick="reviewComment(${c.id},'reject')">Reject</button></span></div><div class="md">${md(c.body)}</div></div>`).join('') || '<p class="sim-muted">No replies waiting.</p>'}
    </section>
    <section class="sim-card"><h2>🔑 Team access code</h2>
        <p class="sim-muted">VAs enter this code (with their name) to open the Knowledge Base. Changing it signs everyone out; share the new code with the team.${cc ? ` Last changed ${esc(fmtDate(cc))}.` : ''}</p>
        <form class="kb-row" onsubmit="setCode(event)"><label>New access code<input id="s-code" type="text" minlength="6" maxlength="64" required autocomplete="off" placeholder="6 characters or more"></label>
            <div style="align-self:end"><button class="sim-btn primary" type="submit">Save code</button></div></form>
    </section>`;
}
async function setCode(e) {
    e.preventDefault();
    const code = document.getElementById('s-code').value.trim();
    if (!confirm('Save this as the team access code? Everyone signed in with the old code will need the new one.')) return;
    try { await post('/api/kb/access', { action: 'set-code', code }); KB.access = await api('/api/kb/access'); toast('Access code saved. Share it with your team.'); route(); } catch (x) { toast(x.message); }
}

// ---------- shell ----------
function toast(msg) {
    const t = document.createElement('div'); t.className = 'kb-toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 3800);
}
function topbar() {
    const a = KB.access || {}, adminSess = (typeof getSession === 'function') && getSession() && getSession().userType === 'Admin';
    document.getElementById('kb-nav').innerHTML = `
        <a href="/programs.html">Training Directory</a>
        <a href="/simulators.html">🛠 Simulators</a>
        ${adminSess ? '<a href="/progress.html">📊 Progress &amp; Feedback</a><a href="/core.html">Master Control</a>' : ''}
        ${a.unlocked ? `<span class="kb-who">${esc(a.who ? a.who.name : '')}</span><a onclick="signOut()">Sign out</a>` : ''}`;
}
async function start() {
    try { KB.access = await api('/api/kb/access'); }
    catch (e) { document.getElementById('app').innerHTML = `<div class="sim-card sim-error">${esc(e.message)}</div>`; return; }
    topbar(); route();
}
document.addEventListener('DOMContentLoaded', start);
Object.assign(window, { KB, go, unlock, signOut, renderHome, renderResults, toggleHelpful, submitComment, reviewComment, edTab, saveArticle, withdraw, reviewPost, setCode, route });

// LSH Knowledge Base (/kb.html): official SOPs and resources, plus the tips,
// guides and lessons VAs share. Readers enter the team access code (or are
// signed-in admins). VA posts and replies wait for an admin before others see them.
const KB = { access: null, lib: [], data: null, profiles: [], me: null, pq: '', pcat: '', route: '', q: '', src: 'all', cat: '', type: '', sort: 'relevant', cache: {}, queue: null, qFilter: 'pending' };
const { render: md, plain, esc } = window.KBmd;
const TYPE_ICON = { 'SOP': '📘', 'Guide': '🧭', 'Resource': '📎', 'Template': '🧩', 'Checklist': '✅', 'Policy': '📜', 'Tip': '💡', 'How-to guide': '🛠', 'Lesson learned': '🎯', 'Question': '❓' };
const STATUS_LABEL = { pending: 'Waiting for Review', published: 'Published', rejected: 'Sent Back', hidden: 'Hidden' };
// Labels show in title case; the stored type names stay as they are.
const title = (t) => String(t || '').replace(/(^|[\s/-])([a-z])/g, (m, p, c) => p + c.toUpperCase());

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
    const [lib, data, people] = await Promise.all([
        fetch('/kb-files/library.json', { credentials: 'include', cache: 'no-store' }).then(r => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
        api('/api/kb/articles'),
        api('/api/kb/profiles').catch(() => ({ profiles: [], me: null }))
    ]);
    KB.profiles = people.profiles || []; KB.me = people.me;
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
    if (view === 'people') return renderPeople(app);
    if (view === 'p') return renderPerson(app, decodeURIComponent(id || ''));
    if (view === 'profile') return renderProfileEditor(app, id ? decodeURIComponent(id) : null);
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
            <label>Your Full Name<input id="g-name" autocomplete="name" required minlength="2" maxlength="80" value="${esc(localStorage.getItem('LSH_KB_NAME') || '')}"></label>
            <label>Batch <span class="sim-muted">(optional)</span><input id="g-batch" maxlength="40" value="${esc(localStorage.getItem('LSH_KB_BATCH') || '')}"></label>
            <label>Team Access Code<input id="g-code" type="password" autocomplete="off" required></label>
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
        <div class="kb-card-top"><span class="kb-src ${x.official ? 'off' : 'team'}">${x.official ? 'Official' : x.byAdmin ? 'From an Admin' : 'From the Team'}</span>
            <span class="kb-type">${TYPE_ICON[x.type] || '📄'} ${esc(title(x.type))}</span><span class="kb-cat">${esc(x.category)}</span>${x.featured ? '<span class="kb-feat">★ Featured</span>' : ''}</div>
        <h3>${esc(x.title)}</h3>
        <p>${esc(snippet)}${snippet.length >= 200 ? '…' : ''}</p>
        <div class="kb-meta"><span class="kb-by">${avatar(x.official ? { name: x.author } : person(x.authorKey, x.author), 22)}${esc(x.author || '')}${(!x.official && jobTitle(x.authorKey, x.author)) ? ` <i>· ${esc(jobTitle(x.authorKey, x.author))}</i>` : ''}</span>${x.credits && x.credits.length ? `<span>+ ${esc(x.credits.join(', '))}</span>` : ''} · ${esc(fmtDate(when))}
            <span>👍 ${x.stats.helpful}</span><span>💬 ${x.stats.comments}</span><span>👁 ${x.stats.views}</span>${x.file ? '<span>📎 Original File</span>' : ''}</div>
    </a>`;
}
function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? String(iso) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
// Everyone who has shared something or has a profile, with what they've contributed.
function people() {
    const by = {};
    const add = (key, name) => by[key] || (by[key] = { key, name, posts: 0, helpful: 0, credited: 0, cats: {}, profile: null });
    KB.profiles.forEach(p => { add(p.key, p.name).profile = p.profile; });
    const stats = (KB.data && KB.data.stats) || {};
    ((KB.data && KB.data.articles) || []).forEach(a => {
        const c = add(a.authorKey, a.author);
        c.posts++; c.helpful += (stats[a.ref] || {}).helpful || 0; c.cats[a.category] = (c.cats[a.category] || 0) + 1;
        (a.credits || []).forEach(n => { const k = keyForName(n); if (k && by[k]) by[k].credited++; });
    });
    KB.lib.forEach(x => (x.contributors || []).forEach(n => { const k = keyForName(n); if (k && by[k]) by[k].credited++; }));
    return Object.values(by).filter(c => c.posts || c.profile);
}
function contributors() {
    return people().filter(c => c.posts).sort((a, b) => b.posts - a.posts || b.helpful - a.helpful).slice(0, 8);
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
        <p>Official SOPs and resources, plus tips, guides and lessons shared by the LSH team.</p>
        <div class="kb-stats"><span><b>${nOff}</b> ${nOff === 1 ? 'Official SOP or Resource' : 'Official SOPs & Resources'}</span><span><b>${nTeam}</b> ${nTeam === 1 ? 'Team Post' : 'Team Posts'}</span>${contributors().length ? `<span><b>${contributors().length}</b> ${contributors().length === 1 ? 'Contributor' : 'Contributors'}</span>` : ''}</div>
        <div class="kb-search"><input id="kb-q" type="search" placeholder="Search SOPs, tips and guides… e.g. lien reduction, intake call, HIPAA" value="${esc(KB.q)}" oninput="KB.q=this.value;renderResults()" aria-label="Search the Knowledge Base"></div>
        <div class="kb-actions">
            <a class="sim-btn orange" href="#/new">✍️ Share Your Knowledge</a>
            <a class="sim-btn ghost" href="#/mine">📂 My Posts${d.mine.length ? ` (${d.mine.length})` : ''}</a>
            <a class="sim-btn ghost" href="#/profile">👤 My Profile</a>
            <a class="sim-btn ghost" href="#/people">👥 Contributors</a>
            ${KB.access.admin ? `<a class="sim-btn ghost" href="#/review">🛡 Review &amp; Settings${pend ? ` <b class="kb-badge">${pend}</b>` : ''}</a>` : ''}
        </div>
    </section>
    <div class="kb-layout">
        <div>
            <div class="kb-filters">
                ${[['all', 'Everything'], ['official', '📘 Official SOPs & Resources'], ['team', '💡 From the Team']].map(([k, l]) => `<button class="${KB.src === k ? 'on' : ''}" onclick="KB.src='${k}';renderHome(document.getElementById('app'))">${l}</button>`).join('')}
                <select onchange="KB.cat=this.value;renderResults()" aria-label="Category"><option value="">All Categories</option>${cats.map(c => `<option ${KB.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
                <select onchange="KB.type=this.value;renderResults()" aria-label="Type"><option value="">All Types</option>${types.map(t => `<option value="${esc(t)}" ${KB.type === t ? 'selected' : ''}>${esc(title(t))}</option>`).join('')}</select>
                <select onchange="KB.sort=this.value;renderResults()" aria-label="Sort">${[['relevant', 'Most Relevant'], ['newest', 'Newest'], ['helpful', 'Most Helpful'], ['viewed', 'Most Viewed']].map(([k, l]) => `<option value="${k}" ${KB.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
            </div>
            <div id="kb-results"></div>
        </div>
        <aside>
            <div class="sim-card kb-side"><h4>Categories</h4>${cats.filter(c => catCount(c)).map(c => `<button class="kb-catlink ${KB.cat === c ? 'on' : ''}" data-c="${esc(c)}" onclick="KB.cat=KB.cat===this.dataset.c?'':this.dataset.c;renderHome(document.getElementById('app'))">${esc(c)} <span>${catCount(c)}</span></button>`).join('') || '<p class="sim-muted">Nothing here yet.</p>'}</div>
            <div class="sim-card kb-side"><h4>Top Contributors</h4>${contributors().map(c => `<a class="kb-contrib" href="#/p/${encodeURIComponent(c.key)}">${avatar({ name: c.name, profile: c.profile }, 36)}<span><b>${esc(c.name)}</b>${c.profile && c.profile.title ? `<small>${esc(c.profile.title)}</small>` : ''}<small>${c.posts} post${c.posts === 1 ? '' : 's'} · 👍 ${c.helpful}</small></span></a>`).join('') || '<p class="sim-muted">Be the first to share something the team should know.</p>'}
                <a class="kb-more" href="#/people">All Contributors →</a></div>
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
        <div class="kb-card-top"><span class="kb-src ${isSop ? 'off' : 'team'}">${isSop ? 'Official' : a.byAdmin ? 'From an Admin' : 'From the Team'}</span><span class="kb-type">${TYPE_ICON[a.type] || '📄'} ${esc(title(a.type))}</span><span class="kb-cat">${esc(a.category)}</span>${a.featured ? '<span class="kb-feat">★ Featured</span>' : ''}</div>
        <h1>${esc(a.title)}</h1>
        <div class="kb-meta">${isSop ? `${esc(a.owner || 'LSH')}${a.updated ? ' · updated ' + esc(fmtDate(a.updated)) : ''}${a.version ? ' · version ' + esc(a.version) : ''}` : `${esc(fmtDate(a.createdAt))}${a.updatedAt !== a.createdAt ? ' · edited ' + esc(fmtDate(a.updatedAt)) : ''}`}
            <span>👁 ${detail.stats.views}</span></div>
        ${a.summary ? `<p class="kb-summary">${esc(a.summary)}</p>` : ''}
        ${isSop ? ((a.contributors || []).length ? `<div class="kb-authors"><span class="sim-muted">Contributors</span>${a.contributors.map(n => personChip(keyForName(n), n)).join('')}</div>` : '')
            : `<div class="kb-authors"><span class="sim-muted">Shared by</span>${personChip(a.authorKey, a.author)}${(a.credits || []).length ? `<span class="sim-muted">with</span>${a.credits.map(n => personChip(keyForName(n), n)).join('')}` : ''}</div>`}
        <div class="kb-tools">
            ${isSop && a.file ? `<a class="sim-btn ghost" href="${esc(a.file)}" target="_blank" rel="noopener">📎 Open the Original${a.fileName ? ' (' + esc(a.fileName) + ')' : ''}</a>` : ''}
            ${!isSop && a.linkUrl ? `<a class="sim-btn ghost" href="${esc(a.linkUrl)}" target="_blank" rel="noopener noreferrer">🔗 Open the Linked Resource</a>` : ''}
            ${(admin && !isSop) || own ? `<a class="sim-btn ghost" href="#/edit/${a.id}">✏️ Edit</a>` : ''}
            ${admin && !isSop ? reviewButtons(a, true) : ''}
        </div>
        <div class="kb-body md">${md(bodyMd) || '<p class="sim-muted">This SOP has no page text yet; open the original file.</p>'}</div>
        ${(a.tags || []).length ? `<div class="kb-tags">${a.tags.map(t => `<button data-t="${esc(t)}" onclick="KB.q=this.dataset.t;go('#/')">#${esc(t)}</button>`).join('')}</div>` : ''}
        ${isSop || a.status === 'published' ? `<div class="kb-helpful"><button id="kb-help" class="${detail.voted ? 'on' : ''}" onclick="toggleHelpful('${esc(ref)}')">👍 Helpful <span>${detail.stats.helpful}</span></button><span class="sim-muted">Did this help you? It helps others find the best answers.</span></div>` : ''}
    </article>
    ${isSop || a.status === 'published' ? `<section class="sim-card kb-comments">
        <h3>💬 Add Your Experience <span class="sim-muted">(${comments.filter(c => c.status === 'approved').length})</span></h3>
        <p class="sim-muted">Share a tip, an example from your own work, or a question about this ${isSop ? 'SOP' : 'post'}. Replies appear once an admin approves them.</p>
        ${comments.map(c => `<div class="kb-comment ${c.status}"><div class="kb-comment-h"><b>${esc(c.author)}</b>${c.byAdmin ? ' <span class="kb-src off">Admin</span>' : c.batch ? ` <span class="sim-muted">${esc(c.batch)}</span>` : ''} <span class="sim-muted">${esc(fmtDate(c.createdAt))}</span>
            ${c.status !== 'approved' ? `<span class="kb-pill ${c.status}">${c.status === 'pending' ? 'Waiting for Review' : esc(c.status)}</span>` : ''}
            ${admin ? `<span class="kb-cbtns">${c.status !== 'approved' ? `<button onclick="reviewComment(${c.id},'approve')">Approve</button>` : ''}<button onclick="reviewComment(${c.id},'delete')">Delete</button></span>` : ''}</div>
            <div class="md">${md(c.body)}</div></div>`).join('')}
        <form onsubmit="submitComment(event,'${esc(ref)}')"><textarea id="kb-reply" rows="3" maxlength="5000" placeholder="What worked for you? What would you add?" required></textarea>
            <div id="kb-reply-msg" class="sim-muted"></div><button class="sim-btn primary" type="submit">Send Reply</button></form>
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
    const v = cur || { type: 'Tip', category: '', title: '', summary: '', body: '', tags: [], linkUrl: '', credits: [] };
    app.innerHTML = `
    <a class="kb-back" href="${cur ? '#/a/' + cur.id : '#/'}">← ${cur ? 'Back to the Post' : 'Knowledge Base'}</a>
    <form class="sim-card kb-editor" onsubmit="saveArticle(event, ${cur ? cur.id : 'null'})">
        <h2>${cur ? 'Edit Post' : 'Share Your Knowledge'}</h2>
        ${cur ? '' : `<p class="sim-muted">A tip that saved you time, a how-to, a checklist, a lesson from a hard case, or a question for the team. ${KB.access.admin ? 'As an admin, your post is published straight away.' : 'An admin reviews every post before the team sees it.'} Leave out client names and personal details.</p>`}
        <div class="kb-row">
            <label>Type<select id="e-type">${d.types.map(t => `<option value="${esc(t)}" ${v.type === t ? 'selected' : ''}>${esc(title(t))}</option>`).join('')}</select></label>
            <label>Category<select id="e-cat" required><option value="">Choose…</option>${d.categories.map(c => `<option ${v.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        </div>
        <label>Title<input id="e-title" required minlength="5" maxlength="160" value="${esc(v.title)}" placeholder="e.g. Getting itemized bills from hospitals on the first request"></label>
        <label>One-Line Summary <span class="sim-muted">(optional)</span><input id="e-sum" maxlength="400" value="${esc(v.summary)}" placeholder="What will someone learn or be able to do?"></label>
        <div class="kb-tabs"><button type="button" class="on" id="t-write" onclick="edTab('write')">Write</button><button type="button" id="t-prev" onclick="edTab('preview')">Preview</button></div>
        <textarea id="e-body" rows="14" maxlength="30000" required placeholder="Explain it the way you'd tell a new teammate. Steps, examples and pitfalls help most.">${esc(v.body)}</textarea>
        <div id="e-prev" class="kb-body md kb-preview" hidden></div>
        <p class="sim-muted kb-small">Formatting: ${esc(FORMAT_HELP)}</p>
        <div class="kb-row">
            <label>Tags <span class="sim-muted">(comma-separated)</span><input id="e-tags" maxlength="250" value="${esc((v.tags || []).join(', '))}" placeholder="e.g. medical records, HIPAA, follow-up"></label>
            <label>Link to a File or Page <span class="sim-muted">(optional, https://)</span><input id="e-link" type="url" maxlength="500" value="${esc(v.linkUrl)}" placeholder="Google Drive, template, etc."></label>
        </div>
        <label>Contributors <span class="sim-muted">(optional: teammates who helped write this, comma-separated names)</span><input id="e-credits" maxlength="400" list="kb-names" value="${esc((v.credits || []).join(', '))}" placeholder="e.g. Jordan Link, Maria Santos"></label>
        <datalist id="kb-names">${people().map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
        <div id="e-err" class="sim-error" hidden></div>
        <div class="kb-actions"><button class="sim-btn primary" type="submit">${cur ? 'Save Changes' : KB.access.admin ? 'Publish' : 'Send for Review'}</button><a class="sim-btn ghost" href="${cur ? '#/a/' + cur.id : '#/'}">Cancel</a></div>
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
    const payload = { type: val('e-type'), category: val('e-cat'), title: val('e-title'), summary: val('e-sum'), body: val('e-body'), tags: val('e-tags'), linkUrl: val('e-link').trim(), credits: val('e-credits') };
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
    <section class="sim-card"><h2>My Posts</h2><p class="sim-muted">Posts shared as <b>${esc(KB.access.who.name)}</b>${KB.access.who.batch ? ' · ' + esc(KB.access.who.batch) : ''}. Sent-back posts show the reviewer’s note; edit and resend them.</p>
    ${mine.length ? mine.map(a => `<div class="kb-mine"><div><a href="#/a/${a.id}"><b>${esc(a.title)}</b></a><div class="sim-muted">${esc(title(a.type))} · ${esc(a.category)} · ${esc(fmtDate(a.updatedAt))}</div>
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
    return [a.status !== 'published' ? b('approve', '✅ Approve') : '', a.status === 'pending' ? b('reject', '↩️ Send Back') : '',
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
        try { const [a, p] = await Promise.all([api('/api/kb/articles?queue=1'), api('/api/kb/profiles?queue=1')]); KB.queue = Object.assign(a, { profiles: p.profiles }); }
        catch (e) { app.innerHTML = `<div class="sim-card sim-error">${esc(e.message)}</div>`; return; }
    }
    const q = KB.queue, pending = q.posts.filter(p => p.status === 'pending');
    const shown = q.posts.filter(p => KB.qFilter === 'all' || p.status === KB.qFilter);
    const refTitle = (ref) => { const x = items().find(i => i.ref === ref) || q.posts.find(p => p.ref === ref); return x ? x.title : ref; };
    const cc = KB.access.codeChangedAt;
    app.innerHTML = `<a class="kb-back" href="#/">← Knowledge Base</a>
    <section class="sim-card"><h2>🛡 Review Queue</h2>
        <p class="sim-muted">${pending.length} post${pending.length === 1 ? '' : 's'} and ${q.comments.length} repl${q.comments.length === 1 ? 'y' : 'ies'} waiting. Approve to publish; send back with a note so the author can fix it.</p>
        <div class="kb-filters">${[['pending', 'Waiting'], ['published', 'Published'], ['rejected', 'Sent Back'], ['hidden', 'Hidden'], ['all', 'All']].map(([k, l]) => `<button class="${KB.qFilter === k ? 'on' : ''}" onclick="KB.qFilter='${k}';route()">${l} (${k === 'all' ? q.posts.length : q.posts.filter(p => p.status === k).length})</button>`).join('')}</div>
        ${shown.map(p => `<details class="kb-q" ${p.status === 'pending' ? 'open' : ''}><summary><span class="kb-pill ${p.status}">${STATUS_LABEL[p.status] || p.status}</span> <b>${esc(p.title)}</b> <span class="sim-muted">${esc(title(p.type))} · ${esc(p.category)} · ${esc(p.author)}${p.batch ? ' (' + esc(p.batch) + ')' : ''} · ${esc(fmtDate(p.updatedAt))}</span></summary>
            ${p.summary ? `<p><i>${esc(p.summary)}</i></p>` : ''}<div class="md kb-qbody">${md(p.body)}</div>${p.linkUrl ? `<p>🔗 <a href="${esc(p.linkUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.linkUrl)}</a></p>` : ''}
            ${p.tags.length ? `<p class="sim-muted">Tags: ${esc(p.tags.join(', '))}</p>` : ''}${p.reviewNote ? `<div class="kb-note">Last note: ${esc(p.reviewNote)}</div>` : ''}
            <div class="kb-qbtns">${reviewButtons(p, true)}<a class="sim-btn ghost" href="#/edit/${p.id}">✏️ Edit</a><a class="sim-btn ghost" href="#/a/${p.id}">Open</a></div></details>`).join('') || '<p class="sim-muted">Nothing here.</p>'}
    </section>
    <section class="sim-card"><h2>💬 Replies Waiting</h2>
        ${q.comments.map(c => `<div class="kb-comment pending"><div class="kb-comment-h"><b>${esc(c.author)}</b> <span class="sim-muted">${esc(c.batch)} · on <a href="#/${c.ref.replace(':', '/')}">${esc(refTitle(c.ref))}</a> · ${esc(fmtDate(c.createdAt))}</span>
            <span class="kb-cbtns"><button onclick="reviewComment(${c.id},'approve')">Approve</button><button onclick="reviewComment(${c.id},'reject')">Reject</button></span></div><div class="md">${md(c.body)}</div></div>`).join('') || '<p class="sim-muted">No replies waiting.</p>'}
    </section>
    <section class="sim-card"><h2>👤 Profiles Waiting</h2>
        <p class="sim-muted">New and changed contributor profiles. The current version stays visible until you approve the change.</p>
        ${q.profiles.filter(p => p.pending).map(p => `<div class="kb-comment pending"><div class="kb-comment-h"><b>${esc(p.name)}</b> <span class="sim-muted">${esc(p.batch)} · ${p.profile ? 'changed' : 'new'} ${esc(fmtDate(p.pendingAt))}</span>
            <span class="kb-cbtns"><button data-k="${esc(p.key)}" onclick="reviewProfile(this.dataset.k,'approve')">Approve</button><button data-k="${esc(p.key)}" onclick="reviewProfile(this.dataset.k,'reject')">Send Back</button></span></div>
            ${profileCard({ key: p.key, name: p.name, profile: p.pending }, true)}</div>`).join('') || '<p class="sim-muted">No profiles waiting.</p>'}
        ${q.profiles.filter(p => p.hidden).length ? `<h3 class="kb-h3">Hidden Profiles</h3>${q.profiles.filter(p => p.hidden).map(p => `<div class="kb-comment"><div class="kb-comment-h"><b>${esc(p.name)}</b> <span class="sim-muted">${esc(p.batch)}</span><span class="kb-cbtns"><button data-k="${esc(p.key)}" onclick="hideProfile(this.dataset.k, false)">Show Again</button></span></div></div>`).join('')}` : ''}
    </section>
    <section class="sim-card"><h2>🔑 Team Access Code</h2>
        <p class="sim-muted">VAs enter this code (with their name) to open the Knowledge Base. Changing it signs everyone out; share the new code with the team.${cc ? ` Last changed ${esc(fmtDate(cc))}.` : ''}</p>
        <form class="kb-row" onsubmit="setCode(event)"><label>New Access Code<input id="s-code" type="text" minlength="6" maxlength="64" required autocomplete="off" placeholder="6 characters or more"></label>
            <div style="align-self:end"><button class="sim-btn primary" type="submit">Save Code</button></div></form>
    </section>`;
}
async function setCode(e) {
    e.preventDefault();
    const code = document.getElementById('s-code').value.trim();
    if (!confirm('Save this as the team access code? Everyone signed in with the old code will need the new one.')) return;
    try { await post('/api/kb/access', { action: 'set-code', code }); KB.access = await api('/api/kb/access'); toast('Access code saved. Share it with your team.'); route(); } catch (x) { toast(x.message); }
}

// ---------- contributors & profiles ----------
const norm = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
function person(key, name) {
    const p = KB.profiles.find(x => x.key === key) || (name ? KB.profiles.find(x => norm(x.name) === norm(name)) : null);
    return { key: key || (p && p.key) || '', name: (p && p.name) || name || '', profile: p ? p.profile : null };
}
// Credits and SOP contributors are plain names: link them to a profile or an author with that name.
function keyForName(name) {
    const p = KB.profiles.find(x => norm(x.name) === norm(name)); if (p) return p.key;
    const a = ((KB.data && KB.data.articles) || []).find(x => norm(x.author) === norm(name)); return a ? a.authorKey : '';
}
function jobTitle(key, name) { const p = person(key, name); return p.profile && p.profile.title ? p.profile.title : ''; }
function initials(name) { return String(name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'; }
function hue(name) { let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function avatar(p, size) {
    const photo = p && p.profile && p.profile.photo, name = (p && p.name) || '';
    return photo ? `<img class="kb-av" src="${esc(photo)}" alt="" style="width:${size}px;height:${size}px">`
        : `<span class="kb-av" aria-hidden="true" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .4)}px;background:hsl(${hue(name)} 55% 42%)">${esc(initials(name))}</span>`;
}
function personChip(key, name) {
    const p = person(key, name), inner = `${avatar(p, 28)}<span><b>${esc(p.name || name)}</b>${p.profile && p.profile.title ? `<small>${esc(p.profile.title)}</small>` : ''}</span>`;
    return p.key ? `<a class="kb-chip" href="#/p/${encodeURIComponent(p.key)}">${inner}</a>` : `<span class="kb-chip">${inner}</span>`;
}
function profileCard(c, full) {
    const pr = c.profile || {};
    return `<div class="kb-pcard">${avatar(c, full ? 88 : 56)}<div class="kb-pcard-tx">
        <h3>${esc(c.name)}</h3>${pr.title || pr.team ? `<div class="kb-ptitle">${esc([pr.title, pr.team].filter(Boolean).join(' · '))}</div>` : ''}
        ${pr.years != null && pr.years !== '' ? `<div class="sim-muted">${pr.years} year${pr.years === 1 ? '' : 's'} of experience</div>` : ''}
        ${(pr.expertise || []).length ? `<div class="kb-exp">${pr.expertise.map(e => `<span>${esc(e)}</span>`).join('')}</div>` : ''}
        ${full && (pr.skills || []).length ? `<div class="kb-skills"><b>Skills &amp; Tools:</b> ${esc(pr.skills.join(', '))}</div>` : ''}
        ${full && pr.bio ? `<div class="md kb-bio">${md(pr.bio)}</div>` : ''}
        ${full && pr.linkedin ? `<a class="kb-link" href="${esc(pr.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>` : ''}
    </div></div>`;
}
function renderPeople(app) {
    const cats = KB.data.categories || [], q = norm(KB.pq);
    const list = people().filter(c => (!KB.pcat || (c.profile && (c.profile.expertise || []).includes(KB.pcat)) || c.cats[KB.pcat]) &&
        (!q || [c.name, c.profile && c.profile.title, c.profile && c.profile.team, c.profile && (c.profile.skills || []).join(' '), c.profile && (c.profile.expertise || []).join(' ')].join(' ').toLowerCase().includes(q)))
        .sort((a, b) => (b.posts + b.credited) - (a.posts + a.credited) || a.name.localeCompare(b.name));
    app.innerHTML = `<a class="kb-back" href="#/">← Knowledge Base</a>
    <section class="sim-card"><h2>👥 Contributors</h2>
        <p class="sim-muted">The LSH teammates who share their knowledge here. Find someone with the expertise you need, or <a href="#/profile">set up your own profile</a>.</p>
        <div class="kb-filters"><input type="search" class="kb-psearch" placeholder="Search names, roles, skills…" value="${esc(KB.pq)}" oninput="KB.pq=this.value;renderPeople(document.getElementById('app'));document.querySelector('.kb-psearch').focus()" aria-label="Search contributors">
            <select onchange="KB.pcat=this.value;renderPeople(document.getElementById('app'))" aria-label="Expertise"><option value="">All Areas of Expertise</option>${cats.map(c => `<option ${KB.pcat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="kb-pgrid">${list.map(c => `<a class="kb-pitem" href="#/p/${encodeURIComponent(c.key)}">${profileCard(c, false)}
            <div class="kb-pstats"><span><b>${c.posts}</b> ${c.posts === 1 ? 'Post' : 'Posts'}</span><span><b>${c.helpful}</b> Helpful</span>${c.credited ? `<span><b>${c.credited}</b> Credited</span>` : ''}</div></a>`).join('')
            || '<p class="sim-muted">No contributors match.</p>'}</div>
    </section>`;
}
function renderPerson(app, key) {
    const c = people().find(x => x.key === key) || { key, name: (KB.me && KB.me.key === key && KB.me.name) || 'Contributor', posts: 0, helpful: 0, credited: 0, cats: {}, profile: null };
    const posts = items().filter(x => !x.official && x.authorKey === key);
    const credited = items().filter(x => (x.credits || x.contributors || []).some(n => keyForName(n) === key));
    const mine = KB.me && KB.me.key === key;
    app.innerHTML = `<a class="kb-back" href="#/people">← Contributors</a>
    <section class="sim-card kb-profile">${profileCard(c, true)}
        <div class="kb-pstats"><span><b>${c.posts}</b> ${c.posts === 1 ? 'Post' : 'Posts'}</span><span><b>${c.helpful}</b> Helpful Votes</span>${c.credited ? `<span><b>${c.credited}</b> Credited</span>` : ''}</div>
        <div class="kb-tools">${mine ? '<a class="sim-btn ghost" href="#/profile">✏️ Edit My Profile</a>' : ''}
            ${KB.access.admin && !mine && c.profile ? `<a class="sim-btn ghost" href="#/profile/${encodeURIComponent(key)}">✏️ Edit Profile</a><button class="sim-btn ghost" data-k="${esc(key)}" onclick="hideProfile(this.dataset.k, true)">🙈 Hide Profile</button>` : ''}</div>
        ${mine && KB.me.pending ? `<div class="kb-status pending"><b>Waiting for Review.</b> Your ${c.profile ? 'changes show' : 'profile shows'} once an admin approves ${c.profile ? 'them' : 'it'}.</div>`
            : !c.profile ? `<p class="sim-muted">${mine ? 'You haven’t set up your profile yet. <a href="#/profile">Set it up</a> so teammates know what you’re good at.' : 'No profile yet.'}</p>` : ''}
    </section>
    <section><h3 class="kb-h3">Shared by ${esc(c.name)}</h3>${posts.map(card).join('') || '<p class="sim-muted">Nothing published yet.</p>'}
    ${credited.length ? `<h3 class="kb-h3">Also Contributed To</h3>${credited.map(card).join('')}` : ''}</section>`;
}
function renderProfileEditor(app, key) {
    const editingOther = !!key && KB.access.admin && (!KB.me || key !== KB.me.key);
    const other = editingOther ? KB.profiles.find(p => p.key === key) : null;
    if (editingOther && !other) { app.innerHTML = `<div class="sim-card sim-error">That profile isn’t available.</div>`; return; }
    const me = KB.me || {}, pr = (editingOther ? other.profile : (me.pending || me.profile)) || {};
    const name = editingOther ? other.name : KB.access.who.name;
    KB.photo = pr.photo || '';
    app.innerHTML = `<a class="kb-back" href="${editingOther ? '#/p/' + encodeURIComponent(key) : '#/'}">← ${editingOther ? 'Back to the Profile' : 'Knowledge Base'}</a>
    <form class="sim-card kb-editor" onsubmit="saveProfile(event, ${editingOther ? `'${esc(encodeURIComponent(key))}'` : 'null'})">
        <h2>${editingOther ? 'Edit Profile: ' + esc(name) : 'My Contributor Profile'}</h2>
        ${!editingOther ? `<p class="sim-muted">Your profile appears on your posts and in the Contributors directory, so teammates know who to ask about what. ${KB.access.admin ? 'As an admin, your changes show straight away.' : 'An admin approves new profiles and changes; until then your current profile stays as it is.'}</p>
            ${me.pending && !KB.access.admin ? '<div class="kb-status pending"><b>Waiting for Review.</b> The changes below will show once an admin approves them.</div>' : ''}
            ${me.reviewNote ? `<div class="kb-status rejected"><b>Sent Back.</b> Note from the reviewer: “${esc(me.reviewNote)}”</div>` : ''}` : ''}
        <div class="kb-photo"><div id="p-av">${avatar({ name, profile: { photo: KB.photo } }, 88)}</div>
            <div><label class="sim-btn ghost kb-file">📷 ${KB.photo ? 'Change Photo' : 'Add a Photo'}<input type="file" accept="image/png,image/jpeg,image/webp" onchange="pickPhoto(this)" hidden></label>
                <button type="button" class="sim-btn ghost" onclick="KB.photo='';document.getElementById('p-av').innerHTML=avatar({name:${esc(JSON.stringify(name))},profile:{}},88)">Remove</button>
                <p class="sim-muted kb-small">Optional. A clear headshot works best; it’s resized to a small square.</p></div></div>
        <div class="kb-row"><label>Name<input value="${esc(name)}" disabled></label>
            <label>Role / Job Title<input id="p-title" maxlength="80" value="${esc(pr.title || '')}" placeholder="e.g. Case Manager, Executive Assistant"></label></div>
        <div class="kb-row"><label>Team / Department<input id="p-team" maxlength="80" value="${esc(pr.team || '')}" placeholder="e.g. PI Litigation Team"></label>
            <label>Years of Experience<input id="p-years" type="number" min="0" max="50" value="${pr.years == null ? '' : esc(pr.years)}" placeholder="e.g. 3"></label></div>
        <fieldset class="kb-expset"><legend>Areas of Expertise <span class="sim-muted">(up to 8)</span></legend>
            ${KB.data.categories.map(c => `<label class="kb-expopt"><input type="checkbox" value="${esc(c)}" ${(pr.expertise || []).includes(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('')}</fieldset>
        <label>Skills &amp; Tools <span class="sim-muted">(comma-separated)</span><input id="p-skills" maxlength="500" value="${esc((pr.skills || []).join(', '))}" placeholder="e.g. Filevine, medical chronologies, lien negotiation, Spanish"></label>
        <label>About Me <span class="sim-muted">(what you’re good at and happy to help with)</span><textarea id="p-bio" rows="5" maxlength="800">${esc(pr.bio || '')}</textarea></label>
        <label>LinkedIn <span class="sim-muted">(optional)</span><input id="p-linkedin" type="url" maxlength="200" value="${esc(pr.linkedin || '')}" placeholder="https://www.linkedin.com/in/…"></label>
        <div id="p-err" class="sim-error" hidden></div>
        <div class="kb-actions"><button class="sim-btn primary" type="submit">${KB.access.admin ? 'Save Profile' : 'Send for Review'}</button>
            ${!editingOther && me.key ? `<a class="sim-btn ghost" href="#/p/${encodeURIComponent(me.key)}">View My Profile</a>` : ''}</div>
    </form>`;
}
function pickPhoto(input) {
    const f = input.files && input.files[0]; if (!f) return;
    if (f.size > 15 * 1024 * 1024) { toast('That photo is too large.'); return; }
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
        const side = Math.min(img.width, img.height), cv = document.createElement('canvas'); cv.width = cv.height = 240;
        cv.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 240, 240);
        KB.photo = cv.toDataURL('image/jpeg', 0.82); URL.revokeObjectURL(url);
        document.getElementById('p-av').innerHTML = avatar({ name: '', profile: { photo: KB.photo } }, 88);
    };
    img.onerror = () => toast('That file couldn’t be read as an image.');
    img.src = url;
}
async function saveProfile(e, key) {
    e.preventDefault();
    const val = (x) => document.getElementById(x).value;
    const expertise = [...document.querySelectorAll('.kb-expopt input:checked')].map(i => i.value);
    if (expertise.length > 8) { toast('Choose up to 8 areas of expertise.'); return; }
    const payload = { action: 'save', title: val('p-title'), team: val('p-team'), years: val('p-years'), expertise, skills: val('p-skills'), bio: val('p-bio'), linkedin: val('p-linkedin').trim(), photo: KB.photo || '' };
    if (key) payload.key = decodeURIComponent(key);
    const err = document.getElementById('p-err'); err.hidden = true;
    try {
        const r = await post('/api/kb/profiles', payload);
        await loadAll(); KB.queue = null;
        toast(r.status === 'published' ? 'Profile saved.' : 'Sent for review. Your profile updates once an admin approves it.');
        go('#/p/' + encodeURIComponent(payload.key || KB.me.key));
    } catch (x) { err.textContent = x.message; err.hidden = false; }
}
async function reviewProfile(key, decision) {
    try {
        let note = '';
        if (decision === 'reject') { note = prompt('What should they change? They’ll see this note.'); if (!note) return; }
        await post('/api/kb/profiles', { action: 'review', key, decision, note });
        toast(decision === 'approve' ? 'Profile approved.' : 'Sent back.'); KB.queue = null; await loadAll(); route();
    } catch (e) { toast(e.message); }
}
async function hideProfile(key, hide) {
    if (hide && !confirm('Hide this profile? Their photo, role, expertise and bio are hidden everywhere. Their name still shows on their posts.')) return;
    try { await post('/api/kb/profiles', { action: hide ? 'hide' : 'unhide', key }); toast(hide ? 'Profile hidden.' : 'Profile shown again.'); KB.queue = null; await loadAll(); go(hide ? '#/people' : '#/review'); } catch (e) { toast(e.message); }
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
        ${a.unlocked ? `<span class="kb-who">${esc(a.who ? a.who.name : '')}</span><a onclick="signOut()">Sign Out</a>` : ''}`;
}
async function start() {
    try { KB.access = await api('/api/kb/access'); }
    catch (e) { document.getElementById('app').innerHTML = `<div class="sim-card sim-error">${esc(e.message)}</div>`; return; }
    topbar(); route();
}
document.addEventListener('DOMContentLoaded', start);
Object.assign(window, { KB, go, unlock, signOut, renderHome, renderResults, toggleHelpful, submitComment, reviewComment, edTab, saveArticle, withdraw, reviewPost, setCode, route,
    renderPeople, pickPhoto, saveProfile, reviewProfile, hideProfile, avatar });

/* ============================================================
   📂 The trainee's Backup Drive (simulators/drive.html): the firm's folder structure, built and graded

   The Case Management course's Backup Drive (Case-Management-Training js/cm-drive.js) on the Portal, for
   every program. What the trainee does:
     1. Connects their own Google account once. drive.file only: the Portal can see and change the
        folders and files it makes and nothing else in their Drive.
     2. Lays the firm's structure out themselves — adds each folder, names it, nests it, puts it in order.
        Nothing is prefilled: the structure is the thing being learned, so it is typed, not accepted.
     3. Submits it, and /api/drive grades it against the firm's standard (FOLDER_STANDARD in
        functions/api/drive.js, the one place it is written down), each problem with the rule behind that
        folder. The score is saved as the "Backup Drive Setup" simulator result (and in the trainee's
        course when the page was opened from one, ?program=). A layout that is right is then made in
        their Drive exactly as they laid it out.
     4. Keeps it. ↻ Check my drive asks Google whether every folder is still there and names any somebody
        deleted; 🔁 Put the missing folders back makes them again.

   A trainer (Admin) sees every trainee's drive instead: connected, the score and attempts, the last check
   and the missing folders, with ↻ Check now (read-only, on the trainee's own access).
   ============================================================ */
(function () {
const esc = Sim.esc;
const say = (m) => { if (typeof showToast === 'function') showToast(m); };
const PROGRAM = (new URLSearchParams(location.search).get('program') || '').toUpperCase().slice(0, 12);
const GLOGO = '<svg width="13" height="13" viewBox="0 0 87.3 78" aria-hidden="true" style="vertical-align:-2px;margin-right:5px"><path fill="#0066da" d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"/><path fill="#00ac47" d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"/><path fill="#ea4335" d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"/><path fill="#00832d" d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"/><path fill="#2684fc" d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"/><path fill="#ffba00" d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"/></svg>';

let D = null;                  // the drive, as /api/drive reports it
let busy = false, connecting = false, err = '';
let graded = null, verified = null;
let tree = [{ name: '', children: [] }];   // the layout the trainee is building: [{name, children:[…]}]
let gisLoading = false, gisFailed = false;
let reports = null, reportsConfigured = true, query = '';   // the trainer's view

/* ---------- the server ---------- */
async function api(body) {
    const r = await Sim.fetchRetry('/api/drive', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || { action: 'status' }) });
    let j = {}; try { j = await r.json(); } catch (e) { /* not JSON */ }
    if (!r.ok) {
        const e = new Error(j.error || `The Backup Drive request failed (${r.status}).`);
        e.code = j.code || '';
        if (D && (e.code === 'DRIVE_RECONNECT' || e.code === 'DRIVE_NOT_CONNECTED')) D = Object.assign({}, D, { connected: false, email: '' });
        throw e;
    }
    return j;
}

/* ---------- the layout the trainee types ---------- */
function toPaths(nodes, prefix) {
    const out = [];
    (nodes || []).forEach((n) => {
        const name = String(n.name || '').trim();
        if (!name) return;
        const path = prefix ? prefix + '/' + name : name;
        out.push(path);
        toPaths(n.children, path).forEach((p) => out.push(p));
    });
    return out;
}
// a node by its path of indexes, e.g. "0.2.1"
function at(addr) {
    const bits = String(addr).split('.').filter((x) => x !== '');
    let level = tree, node = null;
    bits.forEach((b) => { node = level[Number(b)]; level = node ? node.children : []; });
    return node;
}
function parentOf(addr) {
    const bits = String(addr).split('.').filter((x) => x !== '');
    const i = Number(bits.pop());
    return { list: bits.length ? at(bits.join('.')).children : tree, i };
}
function setName(addr, v) { const n = at(addr); if (n) n.name = v; }
function addSub(addr) { const n = at(addr); if (n) { n.children.push({ name: '', children: [] }); paint(); } }
function addTop() { tree.push({ name: '', children: [] }); paint(); }
function remove(addr) { const { list, i } = parentOf(addr); list.splice(i, 1); if (!tree.length) tree.push({ name: '', children: [] }); paint(); }
function move(addr, by) { const { list, i } = parentOf(addr); const j = i + by; if (j < 0 || j >= list.length) return; const [x] = list.splice(i, 1); list.splice(j, 0, x); paint(); }

function rowsHTML(nodes, addr, depth) {
    return (nodes || []).map((n, i) => {
        const a = addr === '' ? String(i) : `${addr}.${i}`;
        return `<div class="drv-row" style="margin-left:${depth * 20}px">
      <span class="drv-ic">📁</span>
      <input class="drv-in" value="${esc(n.name)}" spellcheck="false" autocomplete="off" placeholder="Folder name" aria-label="Folder name"
             oninput="PortalDrive.name('${a}', this.value)">
      <button type="button" class="drv-mini" title="Add a folder inside this one" onclick="PortalDrive.addSub('${a}')">➕</button>
      <button type="button" class="drv-mini" title="Move up" onclick="PortalDrive.move('${a}',-1)">↑</button>
      <button type="button" class="drv-mini" title="Move down" onclick="PortalDrive.move('${a}',1)">↓</button>
      <button type="button" class="drv-mini" title="Remove this folder" onclick="PortalDrive.remove('${a}')">✕</button>
    </div>${rowsHTML(n.children, a, depth + 1)}`;
    }).join('');
}

/* The job in three steps, each ticked when done. The trainer sees the same on their table. */
function steps() {
    const saved = (D.saved || []).length, missing = (D.lastMissing || []).length;
    const li = (done, text) => `<li class="${done ? 'is-done' : ''}">${done ? '✓' : '○'} ${text}</li>`;
    return `<ol class="drv-steps">
    ${li(!!D.connected, 'Connect your Google Drive')}
    ${li(!!D.built && !missing, 'Build the firm\'s folders' + (missing ? ` — ${missing} missing, put them back` : ''))}
    ${li(saved > 0, 'Keep every document you file backed up in its folder' + (saved ? ` (${saved} so far)` : ''))}
  </ol>`;
}

/* ---------- the trainee's page ---------- */
function traineeHTML() {
    const n = D ? (D.standard || []).length : 0;
    let body;
    if (!D) body = `<p class="drv-p">Checking your Backup Drive…</p>`;
    else if (!D.configured) body = `<p class="drv-p">The Backup Drive isn't switched on for this site yet — a trainer sets it up once (README → 📂 The trainee's Backup Drive). Nothing else is blocked.</p>`;
    else if (!D.connected) {
        preloadGis();
        body = `<p class="drv-p">Connect the Google account you want to practise on — a personal Gmail address is fine. The Portal asks Google for <b>drive.file</b> only: it can see and change the folders and files it makes here, and nothing else in your Drive. Everything it makes stays yours, and you can disconnect at any time.</p>
      ${D.setup ? `<p class="drv-meta">Your setup so far: ${D.setup.score}% on ${D.setup.attempts} attempt${D.setup.attempts === 1 ? '' : 's'}.</p>` : ''}
      <button type="button" class="drv-btn drv-go" onclick="PortalDrive.connect()" ${connecting ? 'disabled' : ''}>${GLOGO}${connecting ? 'Connecting…' : 'Connect my Google Drive'}</button>`;
    } else if (!D.built) {
        body = `<p class="drv-p">Lay the firm's structure out as you would build it in a real practice: ${n} folders, named and nested and in order. It is the case file you work from — intake and retainer, the police report, records apart from bills, liens, wages and costs, property damage, litigation — plus the firm's own folders. Nothing is filled in for you. Press <b>Check and build it in my Drive</b> when it is how you would hand it to a colleague.</p>
      <div class="drv-tree">${rowsHTML(tree, '', 0)}</div>
      <button type="button" class="drv-mini drv-add" onclick="PortalDrive.addTop()">➕ Add a top-level folder</button>
      ${graded ? (graded.ok
        ? `<div class="drv-good"><b>Right${(D.setup && D.setup.attempts > 1) ? ` — on attempt ${D.setup.attempts}` : ' first time'}.</b> The structure is in your Drive now.</div>`
        : `<div class="drv-bad"><b>Not built yet — ${graded.score}% of the structure is right.</b><ul>${graded.problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`) : ''}`;
    } else {
        const missing = (verified ? verified.missing : D.lastMissing) || [];
        const saved = D.saved || [];
        body = `<p class="drv-p">The firm's ${n} folders are in your Drive${D.email ? `, on ${esc(D.email)}` : ''}. Keeping them there is part of the job.</p>
      <div class="drv-tree drv-read">${(D.standard || []).map((p) => {
        const depth = p.split('/').length - 1, name = p.split('/').pop(), gone = missing.includes(p);
        const held = saved.filter((x) => x.folder === p).length;
        return `<div class="drv-row drv-static ${gone ? 'is-gone' : ''}" style="margin-left:${depth * 20}px" title="${esc((D.why || {})[p] || '')}">
          <span class="drv-ic">${gone ? '⚠' : '📁'}</span><span class="drv-nm">${esc(name)}</span>
          ${gone ? `<span class="drv-tag">missing from your Drive</span>` : ''}
          ${held ? `<span class="drv-tag drv-tag-ok">${held} document${held === 1 ? '' : 's'}</span>` : ''}
        </div>`;
      }).join('')}</div>
      ${missing.length ? `<div class="drv-bad"><b>${missing.length} folder${missing.length === 1 ? ' is' : 's are'} no longer in your Drive.</b> A document filed into a folder that isn't there is a document the firm has lost.</div>`
        : verified ? `<div class="drv-good"><b>Every folder is where it should be.</b> Checked just now.</div>` : ''}
      ${D.setup ? `<p class="drv-meta">Setup score: ${D.setup.score}% on ${D.setup.attempts} attempt${D.setup.attempts === 1 ? '' : 's'}${D.setup.at ? `, ${new Date(D.setup.at).toLocaleDateString()}` : ''}. Saved for your trainer.</p>` : ''}`;
    }
    const foot = !D || !D.configured || !D.connected ? ''
        : !D.built ? `<button type="button" class="drv-btn drv-go" onclick="PortalDrive.submit()" ${busy ? 'disabled' : ''}>${busy ? 'Checking…' : 'Check and build it in my Drive'}</button>
                <button type="button" class="drv-btn" onclick="PortalDrive.disconnect()">Disconnect</button>`
        : `<button type="button" class="drv-btn" onclick="PortalDrive.check()" ${busy ? 'disabled' : ''}>${busy ? 'Checking…' : '↻ Check my drive'}</button>
       ${((verified ? verified.missing : D.lastMissing) || []).length ? `<button type="button" class="drv-btn drv-go" onclick="PortalDrive.rebuild()" ${busy ? 'disabled' : ''}>🔁 Put the missing folders back</button>` : ''}
       ${D.rootUrl ? `<a class="drv-btn" href="${esc(D.rootUrl)}" target="_blank" rel="noopener noreferrer">Open in Drive ↗</a>` : ''}
       <button type="button" class="drv-btn" onclick="PortalDrive.disconnect()">Disconnect</button>`;
    return `<div class="drv-cardw">
      <div class="drv-head"><div><div class="drv-eyebrow">Day 1 · File management</div><h3>📂 My Backup Drive</h3></div></div>
      <div class="drv-body">${D && D.configured ? steps() : ''}${body}${err ? `<div class="drv-bad">${esc(err)}</div>` : ''}</div>
      ${foot ? `<div class="drv-foot">${foot}</div>` : ''}
    </div>`;
}

/* ---------- the trainer's page: every trainee's drive ---------- */
function trainerHTML() {
    if (!reports) return `<div class="drv-cardw"><div class="drv-body"><p class="drv-p">Loading the trainees' Backup Drives…</p>${err ? `<div class="drv-bad">${esc(err)}</div>` : ''}</div></div>`;
    const rows = Object.values(reports).filter((r) => !query || `${r.name} ${r.traineeId} ${r.batch} ${r.email}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => String(a.batch).localeCompare(String(b.batch)) || String(a.name || a.traineeId).localeCompare(String(b.name || b.traineeId)));
    const when = (t) => t ? new Date(t).toLocaleString() : '—';
    return `<div class="drv-cardw">
      <div class="drv-head"><div><div class="drv-eyebrow">Trainers · Automated scoring</div><h3>📂 Trainees' Backup Drives</h3></div>
        <input class="drv-in drv-search" placeholder="Search name, batch, email" value="${esc(query)}" oninput="PortalDrive.search(this.value)" aria-label="Search trainees"></div>
      <div class="drv-body">
        ${reportsConfigured ? '' : `<div class="drv-bad">The Backup Drive isn't switched on yet: set <b>GOOGLE_CLIENT_ID</b> and <b>GOOGLE_CLIENT_SECRET</b> on this Pages project (README → 📂 The trainee's Backup Drive).</div>`}
        <p class="drv-p">Every graded setup is scored against the firm's ${rows.length ? rows[0].standard : 16}-folder structure and saved as the <b>Backup Drive Setup</b> simulator result, so it shows with the trainee's other scores. <b>↻ Check now</b> asks Google, on the trainee's own access, whether their folders are still there; it changes nothing in their Drive.</p>
        ${rows.length ? `<div class="drv-scroll"><table class="drv-table"><thead><tr><th>Trainee</th><th>Batch</th><th>Google</th><th>Score</th><th>Attempts</th><th>Built</th><th>Last check</th><th>Missing</th><th>Filed</th><th></th></tr></thead><tbody>
          ${rows.map((r) => `<tr>
            <td><b>${esc(r.name || r.traineeId)}</b>${r.name ? `<div class="drv-sub">${esc(r.traineeId)}</div>` : ''}</td>
            <td>${esc(r.batch || '—')}</td>
            <td>${r.connected ? `✓ ${esc(r.email || 'connected')}` : '<span class="drv-sub">not connected</span>'}</td>
            <td>${r.score == null ? '—' : `<b class="${r.passed ? 'drv-pass' : 'drv-fail'}">${r.score}%</b>`}${r.passed ? '' : r.attempts ? ' <span class="drv-sub">not passed</span>' : ''}</td>
            <td>${r.attempts || 0}</td>
            <td>${r.builtAt ? when(r.builtAt) : '—'}</td>
            <td>${when(r.checkedAt)}</td>
            <td>${(r.missing || []).length ? `<span class="drv-fail" title="${esc(r.missing.join('\n'))}">${r.missing.length}</span>` : r.builtAt ? '0' : '—'}</td>
            <td>${r.copies || 0}</td>
            <td>${r.builtAt && r.connected ? `<button type="button" class="drv-mini" onclick="PortalDrive.checkFor('${esc(r.traineeId)}')" ${busy ? 'disabled' : ''}>↻ Check now</button>` : ''}</td>
          </tr>${!r.passed && (r.problems || []).length ? `<tr class="drv-probs"><td colspan="10"><details><summary>${r.problems.length} problem${r.problems.length === 1 ? '' : 's'} on the last attempt</summary><ul>${r.problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></details></td></tr>` : ''}`).join('')}
        </tbody></table></div>` : `<p class="drv-meta">No trainee has opened their Backup Drive yet.</p>`}
        ${err ? `<div class="drv-bad">${esc(err)}</div>` : ''}
      </div></div>`;
}

function paint() {
    const app = document.getElementById('app');
    if (!app) return;
    // keep the focused folder name while the tree redraws
    const f = document.activeElement, addr = f && f.classList && f.classList.contains('drv-in') ? (f.getAttribute('oninput') || '') : '', pos = addr ? f.selectionStart : 0;
    app.innerHTML = Sim.isAdmin() ? trainerHTML() : traineeHTML();
    if (addr) { const g = [...app.querySelectorAll('.drv-in')].find((x) => x.getAttribute('oninput') === addr); if (g) { g.focus(); try { g.setSelectionRange(pos, pos); } catch (e) { /* not a text field */ } } }
}

/* ---------- Google sign-in (the popup code flow, as the CM course uses) ---------- */
function preloadGis() {
    if (gisLoading || gisFailed || (window.google && google.accounts && google.accounts.oauth2)) return;
    gisLoading = true;
    const sc = document.createElement('script');
    sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
    sc.onload = () => { gisLoading = false; };
    sc.onerror = () => { gisLoading = false; gisFailed = true; err = 'Google sign-in couldn\'t load. Check that accounts.google.com isn\'t blocked, then try again.'; paint(); };
    document.head.appendChild(sc);
}
function connect() {
    const oauth = window.google && google.accounts && google.accounts.oauth2;
    if (!D || !D.configured) return;
    if (!oauth) { preloadGis(); say(gisFailed ? 'Google sign-in couldn\'t load.' : 'Google sign-in is still loading — press Connect again in a moment.'); return; }
    oauth.initCodeClient({
        client_id: D.clientId, scope: D.scopes, ux_mode: 'popup', select_account: true,
        callback: async (resp) => {
            if (!resp || resp.error || !resp.code) { say(resp && resp.error === 'access_denied' ? 'Google access wasn\'t allowed.' : 'Google sign-in didn\'t finish.'); return; }
            connecting = true; err = ''; paint();
            try { D = (await api({ action: 'connect', code: resp.code })).drive; say(`Google Drive connected${D.email ? ` (${D.email})` : ''}.`); }
            catch (e) { err = e.message; say(e.message); }
            connecting = false; paint();
        },
        error_callback: (e) => {
            const t = e && e.type;
            say(t === 'popup_closed' ? 'Google sign-in was closed before it finished.'
                : t === 'popup_failed_to_open' ? 'The browser blocked the Google sign-in window. Allow pop-ups for this site and try again.'
                : 'Google sign-in failed.');
        },
    }).requestCode();
}
async function disconnect() {
    if (!D || !D.connected || busy) return;
    if (!confirm('Disconnect Google Drive? The folders and files already in your Drive stay there, and your setup score is kept.')) return;
    busy = true; paint();
    try { D = (await api({ action: 'disconnect' })).drive; verified = null; graded = null; err = ''; say('Google Drive disconnected.'); }
    catch (e) { err = e.message; }
    busy = false; paint();
}

/* ---------- the graded setup ---------- */
async function submit() {
    if (busy) return;
    const layout = toPaths(tree, '');
    if (!layout.length) { err = 'Add the folders first.'; paint(); return; }
    busy = true; err = ''; paint();
    try {
        const out = await api({ action: 'setup', layout, program: PROGRAM });
        graded = out.graded; D = out.drive;
        if (graded.ok) say('Your Backup Drive is built — the structure is in your Drive.');
        else say(`${graded.problems.length} thing${graded.problems.length === 1 ? '' : 's'} to fix before it is built.`);
    } catch (e) { err = e.message; }
    busy = false; paint();
}
async function check() {
    if (busy) return;
    busy = true; err = ''; paint();
    try { const out = await api({ action: 'check' }); verified = out.verified; D = out.drive; }
    catch (e) { err = e.message; }
    busy = false; paint();
}
async function rebuild() {
    if (busy) return;
    busy = true; err = ''; paint();
    try { const out = await api({ action: 'rebuild' }); D = out.drive; verified = { missing: [] }; say('The missing folders are back in your Drive.'); }
    catch (e) { err = e.message; }
    busy = false; paint();
}

/* ---------- the trainer ---------- */
async function loadReports() {
    try { const j = await api({ action: 'reportAll' }); reports = j.reports || {}; reportsConfigured = j.configured !== false; err = ''; }
    catch (e) { err = e.message; reports = reports || {}; }
    paint();
}
async function checkFor(id) {
    if (busy) return;
    busy = true; err = ''; paint();
    try { const j = await api({ action: 'checkFor', traineeId: id }); if (j.report) reports[id] = j.report; say(`${(j.report && j.report.name) || id}: ${(j.verified.missing || []).length ? `${j.verified.missing.length} folder(s) missing` : 'every folder is there'}.`); }
    catch (e) { err = e.message; }
    busy = false; paint();
}

/* ---------- a filed document, kept on the backup drive too ----------
   For a simulator that produces a document (it names the course's folder id: intake, medical, bills …). The
   case file is the file of record, so anything going wrong here never undoes a filing. */
async function saveFiled(docFolder, name, bytes) {
    if (!D) { try { D = (await api()).drive; } catch (e) { return { ok: false, why: e.message }; } }
    if (!D || !D.configured || !D.connected || !D.built) return { ok: false, why: 'no-drive' };
    const folder = (D.homes || {})[docFolder];
    if (!folder) return { ok: false, why: 'no-folder' };
    try {
        const b = new Uint8Array(bytes);
        let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
        const b64 = btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const out = await api({ action: 'put', docFolder, name, mime: 'application/pdf', b64 });
        D = out.drive;
        return { ok: true, folder };
    } catch (e) { return { ok: false, why: e.message }; }
}

window.PortalDrive = { connect, disconnect, submit, check, rebuild, checkFor, saveFiled,
    name: setName, addSub, addTop, remove, move, search: (v) => { query = v; paint(); }, status: () => D };

/* ---------- the page's own look (the CM course's, on the Portal's colors) ---------- */
const css = document.createElement('style');
css.textContent = `
.drv-cardw{max-width:960px;margin:0 auto 32px;background:#fff;border:1px solid var(--line,#E3E6EF);border-radius:14px;box-shadow:0 10px 30px rgba(10,15,35,.08);}
.drv-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:18px 20px 12px;border-bottom:1px solid var(--line,#E3E6EF);}
.drv-head h3{margin:2px 0 0;font-size:18px;color:var(--navy,#1B2240);}
.drv-eyebrow{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--orange-deep,#B9610F);}
.drv-body{padding:16px 20px;}
.drv-p{font-size:13.5px;line-height:1.6;color:var(--ink,#1B1E2E);margin:0 0 14px;max-width:85ch;}
.drv-meta{font-size:12.5px;color:var(--ink-soft,#6E748C);margin:12px 0;}
.drv-steps{list-style:none;margin:0 0 14px;padding:0;font-size:13px;line-height:1.8;color:var(--ink,#1B1E2E);}
.drv-steps li.is-done{color:#245B32;font-weight:600;}
.drv-tree{border:1px solid var(--line,#E3E6EF);border-radius:10px;padding:10px;background:#FAFBFE;}
.drv-tree.drv-read{background:#fff;}
.drv-row{display:flex;align-items:center;gap:6px;padding:3px 0;}
.drv-ic{font-size:13px;}
.drv-in{flex:1;min-width:120px;padding:7px 9px;border:1px solid var(--line,#E3E6EF);border-radius:7px;font:inherit;font-size:13px;color:#1B1E2E;background:#fff;}
.drv-search{flex:0 1 260px;}
.drv-nm{font-size:13px;color:var(--ink,#1B1E2E);}
.drv-row.is-gone .drv-nm{color:#8A2B2B;text-decoration:line-through;}
.drv-tag{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#8A2B2B;background:#FDF2F2;border:1px solid #F0CFCF;border-radius:999px;padding:1px 7px;}
.drv-tag.drv-tag-ok{color:#245B32;background:#F1F8F2;border-color:#CBE6CF;}
.drv-mini{border:1px solid var(--line,#E3E6EF);background:#fff;border-radius:6px;font:inherit;font-size:11.5px;padding:4px 7px;cursor:pointer;color:var(--navy,#1B2240);white-space:nowrap;}
.drv-mini:hover:not(:disabled){border-color:var(--orange,#DB8437);}
.drv-mini.drv-add{margin-top:10px;font-weight:800;padding:6px 10px;}
.drv-good{margin-top:12px;font-size:13px;line-height:1.55;background:#F1F8F2;border:1px solid #CBE6CF;color:#245B32;border-radius:9px;padding:9px 11px;}
.drv-bad{margin-top:12px;font-size:13px;line-height:1.55;background:#FDF2F2;border:1px solid #F0CFCF;color:#8A2B2B;border-radius:9px;padding:9px 11px;}
.drv-bad ul{margin:6px 0 0;padding-left:18px;} .drv-bad li{margin-bottom:4px;}
.drv-foot{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:12px 20px;border-top:1px solid var(--line,#E3E6EF);background:#F8F9FC;border-radius:0 0 14px 14px;}
.drv-btn{border:1px solid var(--line,#E3E6EF);background:#fff;color:var(--navy,#1B2240);border-radius:8px;padding:8px 13px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;text-decoration:none;}
.drv-btn:hover:not(:disabled){border-color:var(--orange,#DB8437);}
.drv-btn:disabled{opacity:.6;cursor:default;}
.drv-btn.drv-go{background:var(--navy,#1B2240);border-color:var(--navy,#1B2240);color:#fff;}
.drv-scroll{overflow-x:auto;}
.drv-table{width:100%;border-collapse:collapse;font-size:12.5px;color:#1B1E2E;}
.drv-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6E748C;padding:7px 8px;border-bottom:1px solid #E3E6EF;white-space:nowrap;}
.drv-table td{padding:8px;border-bottom:1px solid #EEF0F6;vertical-align:top;}
.drv-probs td{background:#FDF8F8;padding-top:0;} .drv-probs ul{margin:6px 0 4px;padding-left:18px;} .drv-probs summary{cursor:pointer;color:#8A2B2B;font-weight:600;}
.drv-sub{font-size:11.5px;color:#6E748C;}
.drv-pass{color:#245B32;} .drv-fail{color:#8A2B2B;font-weight:800;}
@media (max-width:640px){ .drv-head,.drv-body,.drv-foot{padding-left:14px;padding-right:14px;} .drv-row{flex-wrap:wrap;} .drv-in{min-width:0;} }`;
document.head.appendChild(css);

(async function boot() {
    await Sim.restore();
    const tb = document.getElementById('topbar'); if (tb) tb.innerHTML = Sim.topbar('drive');
    Sim.label('Backup Drive');
    if (Sim.isAdmin()) { paint(); loadReports(); return; }
    paint();
    try { D = (await api()).drive; err = ''; }
    catch (e) { if (e.code === 'DRIVE_NOT_A_TRAINEE') D = { configured: false }; else err = e.message; }
    paint();
})();
})();

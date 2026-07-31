/* ================= CONFIG ================= */
const DEFAULT_DAY_KEYS = ["day1","day2","day3","day4","day5"];
const DEFAULT_DAY_LABELS = {
  day1:{label:"Day 1", short:"DAY 1"},
  day2:{label:"Day 2", short:"DAY 2"},
  day3:{label:"Day 3", short:"DAY 3"},
  day4:{label:"Day 4", short:"DAY 4"},
  day5:{label:"Day 5", short:"DAY 5"},
};
let DAY_KEYS = [...DEFAULT_DAY_KEYS];
let DAY_LABELS = {...DEFAULT_DAY_LABELS};

/* Admin-added days beyond the default 5 are stored under a shared key so every
   admin/trainee session sees the same set. */
async function loadExtraDays(){
  const extra = await getJSON('config:extra_days', true);
  if(!Array.isArray(extra)) return;
  extra.forEach(d=>{
    if(d && d.key && !DAY_KEYS.includes(d.key)){
      DAY_KEYS.push(d.key);
      DAY_LABELS[d.key] = { label: d.label || d.key, short: d.short || d.key.toUpperCase() };
    }
  });
}

/* ================= STATE ================= */
let state = {
  role: "trainee",
  name: "",
  activeTab: "day1",
  selectedTrainee: null,
  search: "",
  adminView: "manage",
  editingItemId: null,
};

function slugify(n){
  return n.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'') || 'anonymous';
}
function uid(){ return 'itm_' + Math.random().toString(36).slice(2,9); }
function stripHtml(html){
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || d.innerText || '').trim();
}
function formatDeadline(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month:'short', day:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

/* ================= STORAGE HELPERS ================= */
async function getJSON(key, shared){
  try{
    const res = await fetch(`/api/kv/${encodeURIComponent(key)}${shared ? '?shared=1' : ''}`, { credentials: 'include' });
    if(res.status === 401){ location.reload(); return null; }
    const data = await res.json();
    return data.value ? JSON.parse(data.value) : null;
  }catch(e){ return null; }
}
async function setJSON(key, val, shared){
  try{
    const res = await fetch(`/api/kv/${encodeURIComponent(key)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(val), shared: !!shared }),
    });
    return res.ok;
  }catch(e){ console.error("storage set failed", e); return false; }
}
async function listKeys(prefix, shared){
  try{
    const res = await fetch(`/api/kv?prefix=${encodeURIComponent(prefix)}${shared ? '&shared=1' : ''}`, { credentials: 'include' });
    const data = await res.json();
    return data.keys || [];
  }catch(e){ return []; }
}

/* ================= ACTIVITY DATA ================= */
async function getActivityMeta(day){
  const m = await getJSON(`activity_meta:${day}`, true);
  return m || { title:"", description:"", instructions:"", deadline:"" };
}
async function setActivityMeta(day, meta){
  return setJSON(`activity_meta:${day}`, meta, true);
}
async function getActivityItems(day){
  const items = await getJSON(`activity_items:${day}`, true);
  return items || [];
}
async function setActivityItems(day, items){
  return setJSON(`activity_items:${day}`, items, true);
}

/* ================= RICH TEXT EDITOR ================= */
function richEditorHTML(id, contentHTML, placeholder, readonly){
  if(readonly){
    return `<div class="rte-display">${contentHTML || '<em>No answer submitted.</em>'}</div>`;
  }
  return `
    <div class="rte-wrap">
      <div class="rte-toolbar">
        <button type="button" data-rte="${id}" data-cmd="bold" title="Bold"><b>B</b></button>
        <button type="button" data-rte="${id}" data-cmd="italic" title="Italic"><i>I</i></button>
      </div>
      <div class="rte-editor" id="${id}" contenteditable="true" data-placeholder="${placeholder}">${contentHTML || ''}</div>
    </div>`;
}
function updateToolbarState(editor){
  const wrap = editor.closest('.rte-wrap');
  if(!wrap) return;
  wrap.querySelectorAll('button[data-cmd]').forEach(btn=>{
    let active = false;
    try{ active = document.queryCommandState(btn.dataset.cmd); }catch(e){ active = false; }
    btn.classList.toggle('active', active);
  });
}
function bindRichEditors(root){
  root.querySelectorAll('button[data-rte]').forEach(btn=>{
    btn.addEventListener('mousedown', (e)=> e.preventDefault());
    btn.addEventListener('click', ()=>{
      const editor = document.getElementById(btn.dataset.rte);
      if(!editor) return;
      editor.focus();
      document.execCommand(btn.dataset.cmd, false, null);
      updateToolbarState(editor);
    });
  });
  root.querySelectorAll('.rte-editor').forEach(editor=>{
    ['keyup','mouseup','click'].forEach(evt=>{
      editor.addEventListener(evt, ()=> updateToolbarState(editor));
    });
  });
}
function getRteContent(id){
  const el = document.getElementById(id);
  return el ? el.innerHTML.trim() : '';
}

/* ================= CLOCK ================= */
function startClock(){
  const el = document.getElementById('clock');
  function tick(){
    const d = new Date();
    const opts = { month:'short', day:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true };
    el.textContent = d.toLocaleString('en-US', opts);
  }
  tick();
  setInterval(tick, 1000);
}

/* ================= HEADER BINDINGS ================= */
function bindHeader(){
  const roleToggle = document.getElementById('roleToggle');
  if(roleToggle) roleToggle.style.display = 'none'; // role is now set by the server session, not chosen client-side

  const nameInput = document.getElementById('nameInput');
  nameInput.value = state.name;
  nameInput.readOnly = true; // identity now comes from the authenticated account

  document.getElementById('logoutBtn').onclick = async ()=>{
    try{ await fetch('/api/logout', { method: 'POST', credentials: 'include' }); }
    catch(e){ /* ignore — reload will re-check session either way */ }
    location.reload();
  };

  document.getElementById('portalTitle').textContent =
    `CASE MANAGEMENT TRAINING INTERFACE — ${state.role.toUpperCase()} PORTAL`;

  document.getElementById('announceText').textContent =
    state.activeTab === 'leaderboard'
      ? 'Leaderboard updates live as admins submit grades.'
      : (state.role === 'admin' ? 'Build or grade this activity from the panel below.' : 'Select a training activity to begin.');

  document.getElementById('signedInBlock').innerHTML = state.name.trim()
    ? `Signed in as: <b>${state.name.trim()}</b><br/>Role: <b>${state.role.toUpperCase()}</b>`
    : `Not signed in`;
}

async function renderSidebarNav(){
  const nav = document.getElementById('navList');
  let html = '';
  const visibleDays = [];
  for(const d of DAY_KEYS){
    const meta = DAY_LABELS[d];
    const items = await getActivityItems(d);
    const hasContent = items.length > 0;

    /* Trainees only ever see a day once the admin has added at least one activity item. */
    if(state.role === 'trainee' && !hasContent) continue;

    visibleDays.push(d);
    const active = state.activeTab === d ? 'active' : '';
    let sub = hasContent ? `${items.length} item${items.length===1?'':'s'}` : 'No activities assigned yet';
    if(hasContent){
      if(state.role === 'admin'){
        const keys = await listKeys(`submission:${d}:`, true);
        sub = `${keys.length} trainee${keys.length===1?'':'s'} submitted`;
      } else {
        const slug = slugify(state.name || '');
        const grade = state.name.trim() ? await getJSON(`grade:${d}:${slug}`, true) : null;
        const gradedCount = grade ? Object.keys(grade.items||{}).length : 0;
        sub = `${gradedCount}/${items.length} graded`;
      }
    }
    html += `
      <div class="nav-item ${active}" data-day="${d}">
        <div class="title-row">
          <span class="name">${meta.short}</span>
          <span class="pill ${hasContent ? '' : 'gray'}">${hasContent ? items.length+' ITEMS' : 'EMPTY'}</span>
        </div>
        <div class="sub">${sub}</div>
      </div>`;
  }

  if(state.role === 'trainee' && visibleDays.length === 0){
    html += `<div class="empty-note" style="padding:6px 2px;">No activities assigned yet. Check back once your admin publishes one.</div>`;
  }

  html += `
    <div class="nav-item ${state.activeTab==='leaderboard'?'active':''}" data-day="leaderboard">
      <div class="title-row"><span class="name">LEADERBOARD</span><span class="pill green">LIVE</span></div>
      <div class="sub">Ranked by total points</div>
    </div>`;

  if(state.role === 'admin'){
    const pending = await fetchPendingUsers();
    html += `
      <div class="nav-item ${state.activeTab==='approvals'?'active':''}" data-day="approvals">
        <div class="title-row"><span class="name">ACCOUNT APPROVALS</span><span class="pill ${pending.length ? '' : 'gray'}">${pending.length} PENDING</span></div>
        <div class="sub">Approve new trainee/admin sign-ups</div>
      </div>`;
  }

  nav.innerHTML = html;
  nav.querySelectorAll('.nav-item').forEach(item=>{
    item.onclick = ()=>{
      state.activeTab = item.dataset.day;
      state.selectedTrainee = null;
      state.adminView = "manage";
      state.editingItemId = null;
      state.search = "";
      render();
    };
  });

  /* If the trainee's active tab points at a day that's no longer visible (e.g. the
     admin removed its last item, or the trainee just switched roles), fall back to
     the first visible day, or the leaderboard if none are available yet. */
  if(state.role === 'trainee' && state.activeTab !== 'leaderboard' && !visibleDays.includes(state.activeTab)){
    state.activeTab = visibleDays.length ? visibleDays[0] : 'leaderboard';
  }
}

/* ================= MAIN RENDER ================= */
async function render(){
  bindHeader();
  await renderSidebarNav();

  const panel = document.getElementById('panel');
  const primaryBtn = document.getElementById('primaryActionBtn');

  if(state.activeTab === 'leaderboard'){
    primaryBtn.style.display = 'none';
    await renderLeaderboard(panel);
    return;
  }

  if(state.activeTab === 'approvals' && state.role === 'admin'){
    primaryBtn.style.display = 'none';
    await renderApprovals(panel);
    return;
  }

  if(state.role === 'trainee'){
    await renderTraineeDay(panel, state.activeTab);
  } else {
    await renderAdminDay(panel, state.activeTab);
  }
}

/* ================= LESSON DECK BLOCK ================= */
async function renderLessonBlock(dayKey){
  const lesson = await getJSON(`lesson:${dayKey}`, true);
  if(state.role === 'admin'){
    return `
      <div class="dcard alt">
        <div class="dhead">LESSON DECK — ${DAY_LABELS[dayKey].label.toUpperCase()}</div>
        <div class="dbody" style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
          <div>${lesson ? `<strong>${lesson.filename}</strong>` : `<span class="empty-note">No deck uploaded yet.</span>`}</div>
          <div>
            <input type="file" id="pptxInput" accept=".ppt,.pptx" style="display:none" />
            <button class="btn ghost" id="uploadPptxBtn">${lesson ? 'Replace deck' : 'Upload PPTX'}</button>
          </div>
        </div>
      </div>`;
  } else {
    return `
      <div class="dcard alt">
        <div class="dhead">LESSON DECK — ${DAY_LABELS[dayKey].label.toUpperCase()}</div>
        <div class="dbody" style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
          <div>${lesson ? `<strong>${lesson.filename}</strong><div class="empty-note">Uploaded by admin</div>` : `<span class="empty-note">Not uploaded yet — check back before starting the activity.</span>`}</div>
          ${lesson ? `<a class="btn orange" href="${lesson.dataUrl}" download="${lesson.filename}" style="text-decoration:none;">REVIEW LESSON</a>` : ''}
        </div>
      </div>`;
  }
}

function bindLessonUpload(dayKey){
  const btn = document.getElementById('uploadPptxBtn');
  if(!btn) return;
  const input = document.getElementById('pptxInput');
  btn.onclick = ()=> input.click();
  input.onchange = async ()=>{
    const file = input.files[0];
    if(!file) return;
    if(file.size > 4.5 * 1024 * 1024){
      alert("This file is too large for the prototype's storage (limit ~4.5MB). A production build would upload this to real file storage instead.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async ()=>{
      btn.textContent = "Uploading...";
      const ok = await setJSON(`lesson:${dayKey}`, {filename:file.name, dataUrl:reader.result, uploadedAt:Date.now()}, true);
      if(!ok) alert("Upload failed. Please try again.");
      render();
    };
    reader.readAsDataURL(file);
  };
}

/* ================= TRAINEE VIEW ================= */
async function renderTraineeDay(panel, dayKey){
  const meta = await getActivityMeta(dayKey);
  const items = await getActivityItems(dayKey);
  const dayLabel = DAY_LABELS[dayKey];
  const slug = slugify(state.name || '');
  const hasName = !!state.name.trim();

  document.getElementById('primaryActionBtn').style.display = items.length ? 'block' : 'none';
  document.getElementById('primaryActionBtn').textContent = 'SUBMIT ANSWERS';

  const lessonHtml = await renderLessonBlock(dayKey);

  if(items.length === 0){
    panel.innerHTML = `
      <div class="card">
        <div class="card-head">
          <div><h1>${dayLabel.label}</h1><div class="intro">No activities assigned yet.</div></div>
          <div><div class="stamp">TRAINEE</div><div class="meta-mini">${dayLabel.short}</div></div>
        </div>
      </div>
      ${lessonHtml}
      <div class="empty-state">No activities assigned yet for ${dayLabel.label}. Check back once your admin uploads one.</div>
    `;
    bindLessonUpload(dayKey);
    return;
  }

  let submission = hasName ? await getJSON(`submission:${dayKey}:${slug}`, true) : null;
  let grade = hasName ? await getJSON(`grade:${dayKey}:${slug}`, true) : null;

  const gradedCount = grade ? Object.keys(grade.items || {}).length : 0;
  const submittedCount = submission ? Object.keys(submission.answers||{}).filter(k=>submission.answers[k]).length : 0;
  const totalPoints = grade ? Object.values(grade.items||{}).reduce((s,it)=>s+(it.points||0),0) : 0;

  const visibleItems = items.filter(q =>
    !state.search || (q.title + stripHtml(q.prompt)).toLowerCase().includes(state.search.toLowerCase())
  );

  let cards = '';
  visibleItems.forEach((q)=>{
    const savedAns = submission && submission.answers ? (submission.answers[q.id] || '') : '';
    const g = grade && grade.items ? grade.items[q.id] : null;
    let badge = `<span class="status-badge status-empty">NOT STARTED</span>`;
    if(stripHtml(savedAns) && !g) badge = `<span class="status-badge status-pending">SUBMITTED · AWAITING REVIEW</span>`;
    if(g) badge = `<span class="status-badge status-graded">GRADED · ${g.points}/10</span>`;

    cards += `
      <div class="dcard">
        <div class="dhead">${q.title}</div>
        <div class="dbody">
          <div class="prompt">${q.prompt}</div>
          ${richEditorHTML(`rte-ans-${q.id}`, savedAns, 'Type your response here...', !!g)}
          ${g && g.feedback ? `<div class="model-answer show"><strong>Admin feedback:</strong> ${g.feedback}</div>` : ''}
          <div class="row-actions">${badge}<span></span></div>
        </div>
      </div>`;
  });

  panel.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h1>${meta.title || dayLabel.label}</h1>
          <div class="intro">${meta.description || ''}</div>
        </div>
        <div>
          <div class="stamp">${state.role.toUpperCase()}</div>
          <div class="meta-mini">${dayLabel.short}${meta.deadline ? ' · DUE '+formatDeadline(meta.deadline) : ' · OPEN DEADLINE'}</div>
        </div>
      </div>
      <div class="stat-bar">
        <div class="stat"><div class="lbl">ANSWERED</div><div class="val">${submittedCount}/${items.length}</div></div>
        <div class="stat"><div class="lbl">GRADED</div><div class="val">${gradedCount}/${items.length}</div></div>
        <div class="stat"><div class="lbl">POINTS EARNED</div><div class="val">${totalPoints}/${items.length*10}</div></div>
        <div class="grow"></div>
        <div class="role-chip">${hasName ? state.name.trim().toUpperCase() : 'ENTER NAME TO START'}</div>
      </div>
      <div class="search-row"><input id="searchInput" placeholder="Search this activity's items..." value="${state.search}" /></div>
    </div>

    ${meta.instructions ? `<div class="dcard alt"><div class="dhead">INSTRUCTIONS</div><div class="dbody"><div class="rte-display">${meta.instructions}</div></div></div>` : ''}
    ${lessonHtml}
    ${!hasName ? '<p class="empty-note" style="margin:10px 0 16px 4px;">Enter your name in the sidebar to save and submit answers.</p>' : ''}
    ${cards}
  `;

  document.getElementById('searchInput').oninput = (e)=>{ state.search = e.target.value; renderTraineeDay(panel, dayKey); };
  bindRichEditors(panel);
  document.getElementById('primaryActionBtn').onclick = async ()=>{
    const answers = {};
    panel.querySelectorAll('.rte-editor[id^="rte-ans-"]').forEach(ed=>{
      if(ed.classList.contains('readonly')) return;
      const qid = ed.id.replace('rte-ans-','');
      answers[qid] = ed.innerHTML.trim();
    });
    const existing = submission && submission.answers ? submission.answers : {};
    const merged = {...existing, ...answers};
    await setJSON(`submission:${dayKey}:${slug}`, {name: state.name.trim(), answers: merged, submittedAt: Date.now()}, true);
    render();
  };
  bindLessonUpload(dayKey);
}

/* ================= ADMIN VIEW ================= */
async function renderAdminDay(panel, dayKey){
  const meta = await getActivityMeta(dayKey);
  const items = await getActivityItems(dayKey);
  const dayLabel = DAY_LABELS[dayKey];
  const lessonHtml = await renderLessonBlock(dayKey);

  const subtabsHtml = `
    <div class="subtabs">
      <div class="subtab ${state.adminView==='manage'?'active':''}" data-view="manage">MANAGE ACTIVITY</div>
      <div class="subtab ${state.adminView==='grade'?'active':''}" data-view="grade">GRADE SUBMISSIONS</div>
    </div>`;

  const headerHtml = `
    <div class="card">
      <div class="card-head">
        <div><h1>${meta.title || dayLabel.label}</h1><div class="intro">${meta.description || 'No description yet.'}</div></div>
        <div><div class="stamp">ADMIN</div><div class="meta-mini">${dayLabel.short}${meta.deadline ? ' · DUE '+formatDeadline(meta.deadline) : ' · OPEN DEADLINE'}</div></div>
      </div>
      ${subtabsHtml}
    </div>`;

  document.getElementById('primaryActionBtn').style.display = 'none';

  if(state.adminView === 'manage'){
    panel.innerHTML = headerHtml + renderManageView(dayKey, meta, items) + lessonHtml;
    bindManageView(dayKey, meta, items, panel);
    bindRichEditors(panel);
  } else {
    panel.innerHTML = headerHtml + lessonHtml + await renderGradeView(dayKey, items, panel);
  }

  panel.querySelectorAll('.subtab').forEach(t=>{
    t.onclick = ()=>{
      state.adminView = t.dataset.view;
      state.editingItemId = null;
      state.search = "";
      render();
    };
  });
  bindLessonUpload(dayKey);
}

/* ---- Manage Activity sub-view ---- */
function renderManageView(dayKey, meta, items){
  let itemRows = '';
  items.forEach((it, i)=>{
    const preview = stripHtml(it.prompt);
    itemRows += `
      <div class="item-row">
        <div>
          <div class="item-num">ITEM ${String(i+1).padStart(2,'0')}</div>
          <div class="item-title">${it.title}</div>
          <div class="item-preview">${preview.slice(0,140)}${preview.length>140?'...':''}</div>
        </div>
        <div class="item-actions">
          <button class="icon-btn" data-edit="${it.id}">EDIT</button>
          <button class="icon-btn danger" data-delete="${it.id}">DELETE</button>
        </div>
      </div>`;
  });

  const editing = items.find(it => it.id === state.editingItemId) || null;
  const deadlineVal = meta.deadline || '';

  return `
    <div class="dcard alt">
      <div class="dhead">ACTIVITY DETAILS</div>
      <div class="dbody">
        <div class="form-row">
          <div class="form-field"><label>DAY</label><div style="padding:10px 12px; background:var(--input-bg); border:1px solid var(--line-light); border-radius:var(--r-xs); font-size:12.5px; font-weight:700; color:var(--ink);">${DAY_LABELS[dayKey].label}</div></div>
          <div class="form-field">
            <label>DEADLINE</label>
            <input type="datetime-local" id="deadlineInput" value="${deadlineVal}" ${!deadlineVal ? 'disabled' : ''} />
            <label style="display:flex; align-items:center; gap:6px; margin-top:8px; font-size:11px; letter-spacing:0.2px; color:var(--muted-dark); font-weight:400; text-transform:none;">
              <input type="checkbox" id="openDeadlineToggle" ${!deadlineVal ? 'checked' : ''} style="width:auto; margin:0;" /> Open deadline (no due date)
            </label>
          </div>
        </div>
        <div class="form-field"><label>ACTIVITY TITLE</label><input type="text" id="dayTitleInput" value="${(meta.title||'').replace(/"/g,'&quot;')}" placeholder="e.g. Intake, Compliance & Treatment Advocacy" /></div>
        <div class="form-field"><label>DESCRIPTION</label><textarea id="dayDescInput" placeholder="Short summary shown to trainees">${meta.description||''}</textarea></div>
        <div class="form-field"><label>INSTRUCTIONS</label><textarea id="dayInstrInput" placeholder="Step-by-step instructions for completing this activity">${meta.instructions||''}</textarea></div>
        <button class="btn orange" id="saveDayMetaBtn">Save Activity Details</button>
      </div>
    </div>

    <div class="dcard">
      <div class="dhead">${editing ? 'EDIT ACTIVITY ITEM' : 'ADD ACTIVITY ITEM'}</div>
      <div class="dbody">
        <div class="form-field"><label>SCENARIO</label><input type="text" id="itemTitleInput" value="${editing ? editing.title.replace(/"/g,'&quot;') : ''}" placeholder="e.g. Analyzing Intake Bottlenecks" /></div>
        <div class="form-field"><label>QUESTION</label>${richEditorHTML('itemQuestionEditor', editing ? editing.prompt : '', 'What the trainee is asked to respond to')}</div>
        <div class="form-field"><label>ANSWER</label>${richEditorHTML('itemAnswerEditor', editing ? editing.model : '', 'Key points the admin checks the answer against')}</div>
        <div class="row-actions">
          <span></span>
          <div style="display:flex; gap:10px;">
            ${editing ? `<button class="btn ghost" id="cancelEditBtn">Cancel</button>` : ''}
            <button class="btn orange" id="saveItemBtn">${editing ? 'Save Changes' : 'Add Item'}</button>
          </div>
        </div>
      </div>
    </div>

    <div class="dcard">
      <div class="dhead">ACTIVITY ITEMS (${items.length})</div>
      <div class="dbody">
        ${items.length ? itemRows : '<div class="empty-state">No items yet. Use the form above to add the first scenario.</div>'}
      </div>
    </div>
  `;
}

function bindManageView(dayKey, meta, items, panel){
  const openDeadlineToggle = document.getElementById('openDeadlineToggle');
  const deadlineInput = document.getElementById('deadlineInput');
  if(openDeadlineToggle && deadlineInput){
    openDeadlineToggle.onchange = ()=>{
      deadlineInput.disabled = openDeadlineToggle.checked;
      if(openDeadlineToggle.checked) deadlineInput.value = '';
    };
  }

  document.getElementById('saveDayMetaBtn').onclick = async ()=>{
    const title = document.getElementById('dayTitleInput').value.trim();
    const description = document.getElementById('dayDescInput').value.trim();
    const instructions = document.getElementById('dayInstrInput').value.trim();
    const deadline = openDeadlineToggle && openDeadlineToggle.checked ? '' : deadlineInput.value;
    const ok = await setActivityMeta(dayKey, { title, description, instructions, deadline });
    if(!ok){ alert("Save failed. Please try again."); return; }
    render();
  };

  document.getElementById('saveItemBtn').onclick = async ()=>{
    const title = document.getElementById('itemTitleInput').value.trim();
    const prompt = getRteContent('itemQuestionEditor');
    const model = getRteContent('itemAnswerEditor');
    if(!title || !stripHtml(prompt)){ alert('Please provide at least a scenario and a question.'); return; }

    let current = await getActivityItems(dayKey);
    if(state.editingItemId){
      current = current.map(it => it.id === state.editingItemId ? {...it, title, prompt, model} : it);
    } else {
      current = [...current, { id: uid(), title, prompt, model }];
    }
    const ok = await setActivityItems(dayKey, current);
    if(!ok){ alert("Save failed. Please try again."); return; }
    state.editingItemId = null;
    render();
  };

  const cancelBtn = document.getElementById('cancelEditBtn');
  if(cancelBtn) cancelBtn.onclick = ()=>{ state.editingItemId = null; render(); };

  panel.querySelectorAll('[data-edit]').forEach(b=>{
    b.onclick = ()=>{ state.editingItemId = b.dataset.edit; render(); };
  });
  panel.querySelectorAll('[data-delete]').forEach(b=>{
    b.onclick = async ()=>{
      if(!confirm('Delete this activity item? This does not remove trainee answers already submitted.')) return;
      const current = await getActivityItems(dayKey);
      const ok = await setActivityItems(dayKey, current.filter(it => it.id !== b.dataset.delete));
      if(!ok){ alert("Delete failed. Please try again."); return; }
      render();
    };
  });
}

/* ---- Grade Submissions sub-view ---- */
async function renderGradeView(dayKey, items, panel){
  if(items.length === 0){
    return `<div class="empty-state">Add activity items in "Manage Activity" before grading submissions.</div>`;
  }

  const submissionKeys = await listKeys(`submission:${dayKey}:`, true);
  const slugs = submissionKeys.map(k => k.split(':').slice(2).join(':'));

  if(slugs.length === 0){
    return `<div class="empty-state">No trainee submissions yet for this activity.</div>`;
  }

  if(!state.selectedTrainee || !slugs.includes(state.selectedTrainee)) state.selectedTrainee = slugs[0];

  const submission = await getJSON(`submission:${dayKey}:${state.selectedTrainee}`, true);
  const grade = await getJSON(`grade:${dayKey}:${state.selectedTrainee}`, true) || {items:{}};

  let options = '';
  for(const s of slugs){
    const sub = await getJSON(`submission:${dayKey}:${s}`, true);
    options += `<option value="${s}" ${s===state.selectedTrainee?'selected':''}>${sub ? sub.name : s}</option>`;
  }

  const qs = items.filter(q =>
    !state.search || (q.title + stripHtml(submission.answers?.[q.id]||'')).toLowerCase().includes(state.search.toLowerCase())
  );

  let cards = '';
  qs.forEach((q)=>{
    const ans = submission && submission.answers ? (submission.answers[q.id] || '') : '';
    const g = grade.items[q.id] || null;
    cards += `
      <div class="dcard">
        <div class="dhead">${q.title}</div>
        <div class="dbody">
          <div class="rte-display" style="margin-bottom:12px;">${ans || '<em>No answer submitted.</em>'}</div>
          ${q.model ? `<span class="toggle-model" data-qid="${q.id}">Show answer key</span><div class="model-answer" id="model-${q.id}">${q.model}</div>` : ''}
          <div class="grade-row">
            <div class="grade-inputs">
              <label>POINTS (0–10)</label>
              <input type="number" min="0" max="10" data-points="${q.id}" value="${g ? g.points : ''}" />
              <input type="text" data-feedback="${q.id}" placeholder="Feedback for trainee (optional)" value="${g && g.feedback ? g.feedback.replace(/"/g,'&quot;') : ''}" />
            </div>
          </div>
        </div>
      </div>`;
  });

  const html = `
    <div class="card">
      <div class="stat-bar">
        <div class="stat"><div class="lbl">TRAINEE</div><div class="val"><select class="day-select" id="traineeSelect" style="background:var(--bg-card-dark);color:#fff;border-color:var(--line);">${options}</select></div></div>
        <div class="grow"></div>
        <div class="role-chip">${slugs.length} SUBMISSION${slugs.length===1?'':'S'}</div>
      </div>
      <div class="search-row"><input id="searchInput" placeholder="Search items or answers..." value="${state.search}" /></div>
    </div>
    ${cards}
    <div class="row-actions" style="margin:6px 4px 0 4px;">
      <span></span>
      <button class="btn orange" id="saveGradesBtn">Save Grades</button>
    </div>
  `;

  setTimeout(()=>{
    const searchEl = document.getElementById('searchInput');
    if(searchEl) searchEl.oninput = (e)=>{ state.search = e.target.value; render(); };
    const traineeSel = document.getElementById('traineeSelect');
    if(traineeSel) traineeSel.onchange = (e)=>{ state.selectedTrainee = e.target.value; render(); };
    panel.querySelectorAll('.toggle-model').forEach(el=>{
      el.onclick = ()=>{
        const box = document.getElementById('model-'+el.dataset.qid);
        box.classList.toggle('show');
        el.textContent = box.classList.contains('show') ? 'Hide answer key' : 'Show answer key';
      };
    });
    const saveBtn = document.getElementById('saveGradesBtn');
    if(saveBtn) saveBtn.onclick = async ()=>{
      const currentItems = await getActivityItems(dayKey);
      const items2 = {...grade.items};
      currentItems.forEach(q=>{
        const pEl = document.querySelector(`[data-points="${q.id}"]`);
        const fEl = document.querySelector(`[data-feedback="${q.id}"]`);
        if(!pEl) return;
        const p = pEl.value, f = fEl.value;
        if(p !== '') items2[q.id] = { points: Math.max(0, Math.min(10, Number(p))), feedback: f };
      });
      await setJSON(`grade:${dayKey}:${state.selectedTrainee}`, {name: submission.name, items: items2, gradedAt: Date.now()}, true);
      render();
    };
  }, 0);

  return html;
}

/* ================= LEADERBOARD ================= */
/* ================= ACCOUNT APPROVALS (admin only) ================= */
async function fetchPendingUsers(){
  if(state.role !== 'admin') return [];
  try{
    const res = await fetch('/api/registrations', { credentials:'include' });
    if(!res.ok) return [];
    const data = await res.json();
    return data.users || [];
  }catch(e){ return []; }
}

async function renderApprovals(panel){
  panel.innerHTML = `<div class="card"><div class="card-head"><div><h1>Account Approvals</h1><div class="intro">Loading...</div></div></div></div>`;
  const pending = await fetchPendingUsers();

  let rows = '';
  if(pending.length === 0){
    rows = `<div class="empty-note" style="padding:10px 2px;">No accounts are waiting for approval right now.</div>`;
  } else {
    pending.forEach(u=>{
      const when = u.createdAt ? new Date(u.createdAt).toLocaleString('en-US', { month:'short', day:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
      rows += `
        <div class="dcard" style="margin-top:12px;">
          <div class="dbody" style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
            <div>
              <div style="font-weight:700; font-size:13.5px;">${u.name || u.username}</div>
              <div class="empty-note" style="margin-top:2px;">@${u.username} · ${u.email || ''} · ${u.role.toUpperCase()} · requested ${when}</div>
            </div>
            <div style="display:flex; gap:10px;">
              <button class="btn orange" data-approve="${u.id}">Approve</button>
              <button class="btn ghost" data-reject="${u.id}">Reject</button>
            </div>
          </div>
        </div>`;
    });
  }

  panel.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div><h1>Account Approvals</h1><div class="intro">New trainee and admin sign-ups wait here until an existing admin approves them.</div></div>
        <div><div class="stamp">${pending.length} PENDING</div></div>
      </div>
    </div>
    ${rows}
  `;

  panel.querySelectorAll('[data-approve]').forEach(btn=>{
    btn.onclick = async ()=>{
      btn.disabled = true; btn.textContent = 'Approving...';
      try{
        const res = await fetch('/api/registrations', {
          method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'approve', id: btn.dataset.approve }),
        });
        if(!res.ok) alert('Approval failed. Please try again.');
      }catch(e){ alert('Network error — please try again.'); }
      renderApprovals(panel);
      renderSidebarNav();
    };
  });
  panel.querySelectorAll('[data-reject]').forEach(btn=>{
    btn.onclick = async ()=>{
      if(!confirm('Reject and delete this registration request?')) return;
      btn.disabled = true; btn.textContent = 'Rejecting...';
      try{
        const res = await fetch('/api/registrations', {
          method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'reject', id: btn.dataset.reject }),
        });
        if(!res.ok) alert('Action failed. Please try again.');
      }catch(e){ alert('Network error — please try again.'); }
      renderApprovals(panel);
      renderSidebarNav();
    };
  });
}

async function renderLeaderboard(panel){
  panel.innerHTML = `<div class="card"><div class="card-head"><div><h1>Leaderboard</h1><div class="intro">Total points across all graded activities.</div></div></div></div><p class="empty-note">Loading...</p>`;
  const gradeKeys = await listKeys('grade:', true);
  const totals = {};

  for(const key of gradeKeys){
    const parts = key.split(':');
    const dayKey = parts[1];
    const slug = parts.slice(2).join(':');
    const g = await getJSON(key, true);
    if(!g) continue;
    const dayTotal = Object.values(g.items || {}).reduce((s,it)=> s + (it.points||0), 0);
    if(!totals[slug]) totals[slug] = { name: g.name || slug, total: 0, perDay: {} };
    totals[slug].total += dayTotal;
    totals[slug].perDay[dayKey] = dayTotal;
  }

  const ranked = Object.values(totals).sort((a,b)=> b.total - a.total);
  let rows = '';
  if(ranked.length === 0){
    rows = `<tr><td colspan="4" class="empty-note">No grades recorded yet.</td></tr>`;
  } else {
    ranked.forEach((r,i)=>{
      const breakdown = DAY_KEYS.map(d => r.perDay[d] ? `${DAY_LABELS[d].short.replace('DAY ','D')}:${r.perDay[d]}` : '').filter(Boolean).join('  ');
      rows += `<tr>
        <td class="rank ${i===0?'gold':''}">#${i+1}</td>
        <td>${r.name}</td>
        <td style="color:var(--muted-dark); font-size:11px;">${breakdown}</td>
        <td class="score-total">${r.total} PTS</td>
      </tr>`;
    });
  }

  panel.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div><h1>Leaderboard</h1><div class="intro">Total points across all graded activities. Updates live as the admin submits grades.</div></div>
        <div><div class="stamp">RANKINGS</div></div>
      </div>
    </div>
    <div class="dcard">
      <div class="dhead">DOCKET — ALL TRAINEES</div>
      <div class="dbody" style="padding-top:6px;">
        <table class="leader">
          <thead><tr><th>RANK</th><th>TRAINEE</th><th>BREAKDOWN</th><th>TOTAL</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

async function checkSession(){
  try{
    const res = await fetch('/api/me', { credentials: 'include' });
    if(res.status === 401) return null;
    const data = await res.json();
    return data.user || null;
  }catch(e){ return null; }
}

function renderLoginGate(){
  document.body.innerHTML = `
    <div class="authpage" id="authPage">
      <div class="authcard">

        <div class="authbrand">
          <div class="logo-box">CM</div>
          <div class="logo-text">
            <div class="l1">CASE MANAGEMENT</div>
            <div class="l2">TRAINING INTERFACE</div>
          </div>
        </div>

        <!-- LOGIN VIEW -->
        <div id="authLoginView" class="authview active">
          <div class="authtabs" id="authPortalTabs">
            <button type="button" data-portal="trainee" class="active">TRAINEE PORTAL</button>
            <button type="button" data-portal="admin">ADMIN PORTAL</button>
          </div>

          <div class="autherror" id="loginError"></div>

          <div class="authfield">
            <label>USERNAME</label>
            <input id="authUsername" type="text" placeholder="Enter your username" />
          </div>
          <div class="authfield">
            <label>PASSWORD</label>
            <input id="authPassword" type="password" placeholder="Enter your password" />
          </div>

          <button id="authLoginBtn" class="authbtn">LOG IN</button>
          <div class="authfooter">No account yet? <a id="goToRegister">Register here</a></div>
        </div>

        <!-- REGISTER VIEW -->
        <div id="authRegisterView" class="authview">
          <div class="autherror" id="registerError"></div>
          <div class="authnotice" id="registerNotice"></div>

          <div class="authrow">
            <div class="authfield"><label>FIRST NAME</label><input id="regFirst" type="text" placeholder="e.g., Juan" /></div>
            <div class="authfield small"><label>M.I.</label><input id="regMI" type="text" placeholder="M.I." maxlength="2" /></div>
          </div>
          <div class="authrow">
            <div class="authfield"><label>LAST NAME</label><input id="regLast" type="text" placeholder="e.g., Dela Cruz" /></div>
            <div class="authfield suffix"><label>SUFFIX (OPTIONAL)</label><input id="regSuffix" type="text" placeholder="Jr., III..." /></div>
          </div>
          <div class="authfield">
            <label>EMAIL</label>
            <input id="regEmail" type="email" placeholder="name@example.com" />
          </div>
          <div class="authfield">
            <label>TYPE OF USER</label>
            <select id="regRole">
              <option value="trainee">Trainee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="authfield">
            <label>BATCH ID</label>
            <input type="text" placeholder="Batch ID will be assigned upon approval" disabled />
          </div>
          <div class="authfield">
            <label>USERNAME</label>
            <input id="regUsername" type="text" placeholder="Choose a username" />
          </div>
          <div class="authfield">
            <label>PASSWORD</label>
            <input id="regPassword" type="password" placeholder="Create a password" />
            <div class="authhint">At least 8 characters, letters and numbers only (must include at least one of each).</div>
          </div>
          <div class="authfield">
            <label>RETYPE PASSWORD</label>
            <input id="regPassword2" type="password" placeholder="Retype your password" />
          </div>

          <button id="authRegisterBtn" class="authbtn">SUBMIT REGISTRATION</button>
          <div class="authfooter">Already have an account? <a id="goToLogin">Back to log in</a></div>
        </div>

      </div>
    </div>
  `;

  const page = document.getElementById('authPage');
  const loginView = document.getElementById('authLoginView');
  const registerView = document.getElementById('authRegisterView');
  const portalTabs = document.querySelectorAll('#authPortalTabs button');
  const regRole = document.getElementById('regRole');
  const loginErr = document.getElementById('loginError');
  const regErr = document.getElementById('registerError');
  const regNotice = document.getElementById('registerNotice');

  const showError = (box, msg)=>{ box.textContent = msg; box.style.display = 'block'; };
  const hideError = (box)=>{ box.style.display = 'none'; };

  const setTheme = (portal)=>{
    page.classList.toggle('theme-admin', portal === 'admin');
  };

  portalTabs.forEach(btn=>{
    btn.onclick = ()=>{
      portalTabs.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      setTheme(btn.dataset.portal);
    };
  });

  document.getElementById('goToRegister').onclick = ()=>{
    loginView.classList.remove('active');
    registerView.classList.add('active');
    setTheme(regRole.value);
  };
  document.getElementById('goToLogin').onclick = ()=>{
    registerView.classList.remove('active');
    loginView.classList.add('active');
    const activePortal = document.querySelector('#authPortalTabs button.active').dataset.portal;
    setTheme(activePortal);
  };
  regRole.onchange = ()=> setTheme(regRole.value);

  const doLogin = async ()=>{
    hideError(loginErr);
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const portal = document.querySelector('#authPortalTabs button.active').dataset.portal;
    if(!username || !password){ showError(loginErr, 'Enter a username and password.'); return; }
    try{
      const res = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, portal }),
      });
      if(!res.ok){
        const data = await res.json().catch(()=>({}));
        showError(loginErr, data.error || 'Something went wrong.');
        return;
      }
      const data = await res.json().catch(()=>({}));
      const role = data && data.user && data.user.role;
      if(role && role !== portal){
        // Credentials were valid but the account's role doesn't match the portal selected.
        // Kill the session immediately rather than let a mismatched role in.
        await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(()=>{});
        const correctPortal = role === 'trainee' ? 'Trainee Portal' : 'Admin Portal';
        showError(loginErr, `This account is registered as ${role === 'trainee' ? 'Trainee' : 'Admin'}. Please log in through the ${correctPortal}.`);
        return;
      }
      location.reload();
    }catch(e){ showError(loginErr, 'Network error — please try again.'); }
  };

  const doRegister = async ()=>{
    hideError(regErr); regNotice.style.display = 'none';
    const first = document.getElementById('regFirst').value.trim();
    const mi = document.getElementById('regMI').value.trim();
    const last = document.getElementById('regLast').value.trim();
    const suffix = document.getElementById('regSuffix').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const role = regRole.value;
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const password2 = document.getElementById('regPassword2').value;

    if(!first || !last || !email || !username || !password){
      showError(regErr, 'Please fill in all required fields.'); return;
    }
    const pwRule = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if(!pwRule.test(password)){
      showError(regErr, 'Password must be at least 8 characters and include letters and numbers.'); return;
    }
    if(password !== password2){
      showError(regErr, 'Passwords do not match.'); return;
    }

    try{
      const res = await fetch('/api/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: first, mi, lastName: last, suffix, email, role, username, password }),
      });
      if(!res.ok){
        const data = await res.json().catch(()=>({}));
        showError(regErr, data.error || 'Something went wrong. Please try again.');
        return;
      }
      regNotice.textContent = 'Registration submitted. Please wait for admin approval, then log in.';
      regNotice.style.display = 'block';
      setTimeout(()=>{ document.getElementById('goToLogin').click(); }, 2200);
    }catch(e){ showError(regErr, 'Network error — please try again.'); }
  };

  document.getElementById('authLoginBtn').onclick = doLogin;
  document.getElementById('authRegisterBtn').onclick = doRegister;
}

(async ()=>{
  const user = await checkSession();
  if(!user){ renderLoginGate(); return; }
  state.role = user.role;
  state.name = user.name || user.email;
  await loadExtraDays();
  startClock();
  render();
})();

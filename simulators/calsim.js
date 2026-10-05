/* ============================================================
   📅 Calendaring Simulators on the Main Portal (/simulators/calsim.html): drag-and-drop, Google Calendar style, with an automated
   review and trainer feedback. Three tracks (FTCalCore.TRACKS in calsim-core.js): Standard Training, Litigation Week (Case
   Management) and Executive Week (EA / PA).
     • The week is a Monday to Friday grid in 15-minute steps (Eastern Time). The attorney's fixed events are locked. The brief lists
       the tasks to put on the calendar; the trainee builds their own calendar: drag on an empty part of the week to add an event,
       drag an event to move it, drag its bottom edge to resize it, double-click to rename it, ✕ to delete it.
     • 💾 Save changes, 🤖 Run automated review (the attorney's rules, scored out of 100, with what to fix) and 📤 Submit calendar to
       my trainer. A trainer opens a submission under 📅 Calendar Scores, sees the week and its automated review, and adds manual
       feedback: a score out of 100, an overall comment and a comment on each task, which the trainee sees on this page.
     • The record is kept per person on the Portal (functions/api/calsim.js); the reviews can only be written by an admin.
     • This is the same simulator the Standard program had (js/ft-calendar.js there). The page's host (calsim.html) sets
       window.CalSimHost = {me:{username, name, batch, admin}, root, page} before this file loads.
   ============================================================ */
(function(){
const C = window.FTCalCore;
if(!C) return;
const HOST = window.CalSimHost || {me:{username:"", name:"", batch:"", admin:false}, root:document.body, page:"sim"};
// The page code below was written for the Standard program's engine; these are the few things it asked of that engine.
const state = {traineeId: HOST.me.admin ? "" : HOST.me.username, isAdmin: !!HOST.me.admin, traineeName: HOST.me.name, traineeBatch: HOST.me.batch, certName: HOST.me.name,
  adminName: HOST.me.name, view: "calsim", page: HOST.page || "sim"};
const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(msg){
  let t = document.getElementById("cs-toast");
  if(!t){ t = document.createElement("div"); t.id = "cs-toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 3200);
}
async function api(path, opts){
  const r = await fetch(path, Object.assign({credentials:"include", headers:{"Content-Type":"application/json"}}, opts || {}));
  const d = await r.json().catch(() => ({}));
  if(!r.ok || d.success === false) throw new Error(d.error || ("Request failed (" + r.status + ")"));
  return d;
}
const sharedGet = async (key) => {
  const id = String(key).replace(/^calsim:/, "");
  const d = await api("/api/calsim" + (state.isAdmin && id ? "?user=" + encodeURIComponent(id) : ""));
  return d.data;
};
const sharedSet = async (key, data) => {
  try{ await api("/api/calsim", {method:"POST", body:JSON.stringify({data})}); return true; }catch(e){ return false; }
};
const PORTAL = "/simulators/";
const TOP = 8 * 60, BOTTOM = 18 * 60, SH = 14;   // the grid shows 8:00 AM to 6:00 PM; one 15-minute slot is SH pixels
const px = min => (min - TOP) / C.STEP * SH;
const trackOf = () => C.trackOf(scn().track);
const e = v => esc(String(v == null ? "" : v));
const isTrainee = () => !!state.traineeId && !state.isAdmin;
const open = () => true;   // everyone signed in on the Portal can practice; the Standard program's lesson unlock does not apply here
const hh = m => C.fmt(m);


const S = {id:null, data:null, loading:false, err:"", scn:0, events:[], result:null, timer:null, saved:null, drag:null, sel:null};
const scn = () => C.SCENARIOS[S.scn];
function setScn(i){ S.scn = i; S.sel = null; S.result = null; S.events = C.clean((S.data && S.data.drafts[scn().id]) || []); }
const uid = () => "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- the trainee's saved record ---------- */
const blank = () => ({v:2, drafts:{}, autos:[], submissions:[], reviews:{}, external:[]});
function norm(d){
  d = d || blank();
  d.drafts = d.drafts || {}; d.autos = d.autos || []; d.submissions = d.submissions || []; d.reviews = d.reviews || {}; d.external = d.external || [];
  // Records from the first version of the scheduler held placements, not events: they have nothing to show here.
  d.submissions = d.submissions.filter(x => Array.isArray(x.events));
  Object.keys(d.drafts).forEach(k => { if(!Array.isArray(d.drafts[k])) delete d.drafts[k]; });
  return d;
}
async function load(){
  if(!isTrainee()){ S.data = blank(); return; }
  S.loading = true; S.err = ""; S.id = state.traineeId;
  try{ S.data = norm(await sharedGet("calsim:" + S.id)); }
  catch(err){ S.data = blank(); S.err = "Couldn’t load your saved work. You can still practice; check your connection to save."; }
  S.loading = false;
  S.events = C.clean(S.data.drafts[scn().id]);
  if(state.view === "calsim" || state.view === "simulators") render();
}
function queueSave(){
  if(!isTrainee() || !S.data) return;
  S.data.updatedAt = new Date().toISOString();
  clearTimeout(S.timer); S.saved = "saving"; paintSave();
  S.timer = setTimeout(async () => { const ok = await sharedSet("calsim:" + S.id, S.data); S.saved = ok === false ? "fail" : "ok"; paintSave(); }, 800);
}
function paintSave(){
  const el = document.getElementById("csSave"); if(!el) return;
  el.textContent = !isTrainee() ? "Trainer preview: nothing is saved." : S.saved === "saving" ? "Saving…" : S.saved === "fail" ? "⚠ Not saved. Check your connection." : S.saved === "ok" ? "All changes saved" : "";
}
async function saveNow(){
  changed();
  if(!isTrainee() || !S.data){ toast("Trainer preview: nothing is saved."); return; }
  clearTimeout(S.timer); S.saved = "saving"; paintSave();
  const ok = await sharedSet("calsim:" + S.id, S.data); S.saved = ok === false ? "fail" : "ok"; paintSave();
  toast(ok === false ? "Couldn’t save. Check your connection and try again." : "Changes saved.");
}
function changed(){
  S.result = null;
  if(S.data){ S.data.drafts[scn().id] = S.events.map(x => Object.assign({}, x)); queueSave(); }
}
const subs = id => S.data ? S.data.submissions.filter(x => x.scn === id) : [];
const subKey = x => x.scn + "|" + x.at;

/* ---------- the page ---------- */
function blockHTML(ev, mine, why, ro){
  const k = ev.kind || "", len = (ev.end || ev.start + ev.dur) - ev.start;
  const style = `top:${px(ev.start)}px;height:${Math.max(px(ev.start + len) - px(ev.start), 12)}px;`;
  const pad = ev.buffer ? `<div class="cs-buf" style="top:${px(ev.start - ev.buffer)}px;height:${(ev.buffer / C.STEP) * SH}px;"></div><div class="cs-buf" style="top:${px(ev.end)}px;height:${(ev.buffer / C.STEP) * SH}px;"></div>` : "";
  const icons = (ev.meet ? " 📹" : "") + (ev.remind ? " 🔔" : "");
  const label = `<b>${e(ev.title || "(no name)")}</b><span>${hh(ev.start)} – ${hh(ev.start + len)}${icons}</span>`;
  if(!mine) return pad + `<div class="cs-ev cs-fixed cs-${k}" style="${style}" title="${e(ev.note || ev.title)}">${label}</div>`;
  const cls = `cs-ev cs-req ${why ? "cs-bad" : ""} ${S.sel === ev.id ? "cs-sel" : ""}`;
  if(ro) return `<div class="cs-ev cs-ro ${why ? "cs-bad" : ""}" style="${style}" title="${e(why ? why.join("; ") : "")}">${label}</div>`;
  return `<div class="${cls}" data-ev="${e(ev.id)}" tabindex="0" role="button" title="${e(why ? why.join("; ") : "Drag to move, drag the bottom edge to resize, double-click to rename")}" aria-label="${e(ev.title)}, ${C.DAYS[ev.day]} ${hh(ev.start)}. Arrow keys move it, Shift plus arrow resizes, Enter renames, Delete removes it." style="${style}">${label}<button class="cs-x" data-del="${e(ev.id)}" aria-label="Delete ${e(ev.title)}" tabindex="-1">✕</button><i class="cs-rs" data-rs="${e(ev.id)}"></i></div>`;
}
function gridHTML(s, events, ro){
  s = s || scn(); events = events || S.events;
  const fl = C.flags(s, events);
  const times = []; for(let m = TOP; m < BOTTOM; m += 60) times.push(`<div class="cs-time" style="top:${px(m) - 7}px">${hh(m)}</div>`);
  const cols = C.DAYS.map((name, d) => {
    const blocks = s.fixed.filter(f => f.day === d).map(f => blockHTML(f, false)).join("")
      + events.filter(x => x.day === d).map(x => blockHTML({id:x.id, title:x.title, day:d, start:x.start, end:x.start + x.dur, meet:x.meet, remind:x.remind}, true, fl[x.id], ro)).join("");
    return `<div class="cs-colwrap"><div class="cs-dayhd">${name}</div><div class="cs-col" data-day="${d}" style="height:${px(BOTTOM)}px">${blocks}</div></div>`;
  }).join("");
  return `<div class="cs-grid"><div class="cs-times"><div class="cs-dayhd cs-et" title="Eastern Time">ET</div><div class="cs-timecol" style="height:${px(BOTTOM)}px">${times.join("")}</div></div>${cols}</div>`;
}
function tasksHTML(){
  const s = scn();
  return `<div class="cs-tray" id="csTray"><h3>📋 Your tasks <span class="cs-count">${s.tasks.length} to schedule</span></h3>
    <p class="cs-hint">Put each of these on the week as an event, named after the task, with a description. Drag on an empty part of the calendar to add one.</p>
    ${s.tasks.map(r => `<div class="cs-task"><b>${e(r.title)}</b><span class="cs-dur">${r.dur} min</span>${(r.needs || {}).meet ? '<span class="cs-dur cs-chip">📹 Google Meet</span>' : ""}${(r.needs || {}).remind ? '<span class="cs-dur cs-chip">🔔 Reminder</span>' : ""}<p>${e(r.note)}</p></div>`).join("")}</div>`;
}
function reviewBox(r){
  const tn = r && r.tasks ? Object.keys(r.tasks).filter(k => r.tasks[k]) : [];
  return r ? `<div class="cs-review"><b>👤 Trainer feedback: ${e(r.score)} / 100</b>${r.comment ? `<p>${e(r.comment).replace(/\n/g, "<br>")}</p>` : ""}${tn.length ? `<ul>${tn.map(k => { const t = scn().tasks.concat(C.SCENARIOS.flatMap(q => q.tasks)).find(q => q.id === k); return `<li><b>${e(t ? t.title : k)}:</b> ${e(r.tasks[k])}</li>`; }).join("")}</ul>` : ""}</div>` : "";
}
// The automated review's panel (also used on the trainer's screen). `notes`: the trainer's comment on each task, if any.
function reviewHTML(g, notes){
  notes = notes || {};
  return `<div class="cs-result ${g.passed ? "ok" : "bad"}"><div class="cs-score"><b>${g.pct}%</b><span>${g.passed ? "✅ Meets the attorney’s rules" : "Not yet"} · ${C.PASS}% passes · ${g.done} of ${g.items.length} tasks perfect</span></div>
    ${g.items.map(i => `<div class="cs-item ${i.perfect ? "ok" : "bad"}"><div class="cs-item-hd">${i.perfect ? "✓" : "✗"} <b>${e(i.title)}</b> <span>${i.pts} / ${i.weight}</span></div>
      ${i.perfect ? "" : `<ul>${i.checks.filter(c => !c.ok).map(c => `<li><b>${e(c.label)}:</b> ${e(c.why)}</li>`).join("")}</ul>`}${notes[i.id] ? `<div class="cs-tnote">👤 ${e(notes[i.id])}</div>` : ""}</div>`).join("")}
    ${g.extras.filter(x => x.why.length).length ? `<div class="cs-item bad"><div class="cs-item-hd">⚠ <b>Other events with problems</b></div><ul>${g.extras.filter(x => x.why.length).map(x => `<li><b>${e(x.title)}</b> (${C.DAYS[x.day].slice(0, 3)} ${hh(x.start)}): ${e(x.why.join("; "))}</li>`).join("")}</ul></div>` : ""}</div>`;
}
function resultHTML(){ return S.result ? reviewHTML(S.result) + `<p class="cs-hint">Fix what’s marked, then run the review again. Submit when you’re happy with it.</p>` : ""; }
const bestAuto = id => (S.data ? S.data.autos : []).filter(a => a.scn === id).reduce((m, a) => Math.max(m, a.pct), -1);
function historyHTML(){
  if(!S.data) return "";
  const rows = C.SCENARIOS.map(s => {
    const list = subs(s.id), last = list[list.length - 1];
    const ba = bestAuto(s.id), autoPill = ba >= 0 ? `<span class="cs-pill ${ba >= C.PASS ? "ok" : ""}">🤖 ${e(s.short)} automated review: best ${ba}%</span>` : "";
    if(!last) return `<div class="cs-hist-row"><span class="cs-pill">${e(s.short)}: not submitted</span>${autoPill}</div>`;
    const r = S.data.reviews[subKey(last)], au = C.review(s, last.events);
    return `<div class="cs-hist-row"><span class="cs-pill ok">📤 ${e(s.short)} submitted ${e(new Date(last.at).toLocaleString())}</span><span class="cs-pill ${au.passed ? "ok" : ""}">🤖 Automated: ${au.pct}%</span>${autoPill}${r ? "" : `<span class="cs-pill">Waiting for your trainer’s feedback</span>`}${reviewBox(r)}</div>`;
  }).join("");
  const ext = S.data.external.slice(-3).reverse().map(x => `<span class="cs-pill">${e(x.title || "Simulator")}: ${Math.round(x.score)}/${Math.round(x.max)}</span>`).join("");
  return `<div class="cs-hist">${rows}${ext}</div>`;
}
function renderPage(){
  const s = scn();
  const tk = trackOf();
  const carry = location.search.replace(/[?&](track|view)=[^&]*/g, "").replace(/^&/, "?");
  const tabs = C.TRACKS.map(x => `<button class="cs-tab ${x.id === tk.id ? "active" : ""}" onclick="FTCalSim.open('${x.id}')">${x.icon} ${e(x.title)} <i>${e(x.where)}</i></button>`).join("")
    + `<a class="cs-tab cs-link" href="/simulators/gcal.html${carry}">📞 Google Calendar Simulator</a><a class="cs-tab cs-link" href="/simulators/calendar.html${carry}">🗓 Conflicts week</a>`
    + `</div>` + (C.SCENARIOS.filter(x => x.track === tk.id).length > 1 ? `<div class="cs-tabs cs-weeks">` + C.SCENARIOS.map((x, i) => x.track === tk.id ? `<button class="cs-tab cs-wk ${i === S.scn ? "active" : ""}" onclick="FTCalSim.pick(${i})">${e(x.title)} <i>${e(x.level)}</i></button>` : "").join("") : "");
  if(!open()) return `<div class="cs-wrap"><h1>📅 Calendaring Simulators</h1><div class="card" style="padding:20px;">🔒 This simulator opens with Lesson ${LESSON}, Calendaring &amp; Appointment Setting.</div></div>`;
  return `<div class="cs-wrap"><div class="cs-top"><div><h1>📅 Calendaring Simulators</h1>
      <p class="cs-lead">Build the week in a Google Calendar style, run the automated review, then submit it to your trainer.</p></div>
      <div><button class="btn btn-ghost btn-sm" onclick="location.href='/simulators.html'">← Simulators</button></div></div>
    <div class="cs-tabs">${tabs}</div>
    <p class="cs-blurb">${e(tk.blurb)}</p>
    <div class="card cs-brief">${e(s.brief)}</div>
    ${S.err ? `<div class="cs-err">${e(S.err)}</div>` : ""}
    <div class="cs-main">${tasksHTML()}<div><div class="cs-gridwrap">${gridHTML()}</div><p class="cs-hint cs-legend">Eastern Time. Drag on an empty spot to add an event · drag to move · drag the bottom edge to resize · double-click to edit its details · ✕ deletes. Red means a clash, missing travel time or outside 9 to 5.</p></div></div>
    <div class="cs-actions"><button class="btn btn-navy" onclick="FTCalSim.save()">💾 Save changes</button>
      <button class="btn btn-navy" onclick="FTCalSim.review()">🤖 Run automated review</button>
      <button class="btn btn-primary" onclick="FTCalSim.submit()">📤 Submit to my trainer</button>
      <button class="btn btn-ghost" onclick="FTCalSim.add()">＋ Add event</button>
      <button class="btn btn-ghost" onclick="FTCalSim.reset()">↺ Clear my events</button><span class="cs-save" id="csSave"></span></div>
    <p class="cs-hint">The automated review checks your calendar against the attorney’s rules (conflicts, travel time, business hours, each task’s days and times) and tells you what to fix. Your trainer then adds their own feedback to what you submit.</p>
    <div id="csResultBox">${resultHTML()}</div>
    ${historyHTML()}
    <div class="card cs-more"><b>🔗 Also graded for your trainer</b><p>The Portal’s Calendaring Simulator is another week of scheduling conflicts. It opens in its own tab with your name and batch, so its score is saved for your trainer too.</p>
      <a class="btn btn-ghost btn-sm" href="${e(portalHref())}" target="_blank" rel="noopener">Open the Portal’s Calendaring Simulator ↗</a></div></div>`;
}
function portalHref(){ return PORTAL + "calendar.html"; }
function repaint(){
  const gw = document.querySelector(".cs-gridwrap"); if(!gw){ render(); return; }
  gw.innerHTML = gridHTML();
  const h = document.querySelector(".cs-hist"); if(h) h.outerHTML = historyHTML();
  const box = document.getElementById("csResultBox"); if(box) box.innerHTML = resultHTML();
  paintSave();
}

/* ---------- dragging (pointer events: mouse, pen and touch) ---------- */
// mode: "new" (drag on empty space), "move", "resize"
function colAt(x, y){
  for(const c of document.querySelectorAll(".cs-col")){
    const r = c.getBoundingClientRect();
    if(x >= r.left && x <= r.right && y >= r.top - SH && y <= r.bottom + SH) return {col:c, day:+c.dataset.day, rect:r};
  }
  return null;
}
const snap = (y, top) => TOP + Math.round((y - top) / SH) * C.STEP;
const clampStart = (st, dur) => Math.max(TOP, Math.min(BOTTOM - dur, st));
function startDrag(ev, mode, id){
  const col = ev.target.closest(".cs-col"); if(mode === "new" && !col) return;
  const x = S.events.find(q => q.id === id);
  const el = id ? document.querySelector(`.cs-req[data-ev="${CSS.escape(id)}"]`) : null, rect = el && el.getBoundingClientRect();
  const r0 = col && col.getBoundingClientRect();
  S.drag = {mode, id, sx:ev.clientX, sy:ev.clientY, pid:ev.pointerId, moved:false, x, grab:rect ? ev.clientY - rect.top : 0, w:rect ? rect.width : 0,
    anchor:mode === "new" ? {day:+col.dataset.day, start:Math.max(TOP, Math.min(BOTTOM - C.STEP, TOP + Math.floor((ev.clientY - r0.top) / SH) * C.STEP))} : null, prev:null, ghost:null, cur:null};
  window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); window.addEventListener("pointercancel", onCancel);
}
function onMove(ev){
  const d = S.drag; if(!d || ev.pointerId !== d.pid) return;
  if(!d.moved){ if(Math.abs(ev.clientX - d.sx) + Math.abs(ev.clientY - d.sy) < 5) return; d.moved = true; document.body.classList.add("cs-dragging");
    d.prev = document.createElement("div"); d.prev.className = "cs-prev";
    if(d.mode === "move"){ d.ghost = document.createElement("div"); d.ghost.className = "cs-ghost"; d.ghost.style.cssText = `width:${d.w}px;height:${Math.max(d.x.dur / C.STEP * SH, 24)}px;`; d.ghost.innerHTML = `<b>${e(d.x.title)}</b>`; document.body.appendChild(d.ghost);
      const own = document.querySelector(`.cs-req[data-ev="${CSS.escape(d.id)}"]`); if(own) own.classList.add("cs-lifted"); } }
  ev.preventDefault();
  let cur = null;
  if(d.mode === "move"){
    d.ghost.style.left = (ev.clientX - d.w / 2) + "px"; d.ghost.style.top = (ev.clientY - d.grab) + "px";
    const h = colAt(ev.clientX, ev.clientY);
    if(h) cur = {day:h.day, start:clampStart(snap(ev.clientY - d.grab, h.rect.top), d.x.dur), dur:d.x.dur, col:h.col};
  }else if(d.mode === "resize"){
    const c = document.querySelector(`.cs-col[data-day="${d.x.day}"]`), r = c.getBoundingClientRect();
    const end = Math.max(d.x.start + C.STEP, Math.min(BOTTOM, snap(ev.clientY, r.top) ));
    cur = {day:d.x.day, start:d.x.start, dur:end - d.x.start, col:c};
  }else{
    const h = colAt(ev.clientX, ev.clientY), a = d.anchor, c = document.querySelector(`.cs-col[data-day="${a.day}"]`), r = c.getBoundingClientRect();
    const end = Math.max(a.start + C.STEP, Math.min(BOTTOM, TOP + Math.ceil((ev.clientY - r.top) / SH) * C.STEP));
    cur = {day:a.day, start:a.start, dur:end - a.start, col:c};
  }
  d.cur = cur;
  if(cur){
    cur.col.appendChild(d.prev);
    const me = {id:d.id || "_new", day:cur.day, start:cur.start, end:cur.start + cur.dur};
    const evs = C.all(scn(), S.events.filter(q => q.id !== d.id));
    const bad = evs.some(o => C.overlap(me, o, o.buffer || 0)) || me.start < C.OPEN || me.end > C.CLOSE;
    d.prev.className = "cs-prev " + (bad ? "bad" : "ok");
    d.prev.style.cssText = `top:${px(cur.start)}px;height:${cur.dur / C.STEP * SH}px;`;
    d.prev.textContent = hh(cur.start) + " – " + hh(cur.start + cur.dur);
  }else if(d.prev.parentNode) d.prev.remove();
}
function endDrag(){
  const d = S.drag; window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onCancel);
  document.body.classList.remove("cs-dragging"); S.drag = null;
  if(d && d.ghost) d.ghost.remove(); if(d && d.prev) d.prev.remove();
  return d;
}
// The event editor, as in Google Calendar: title, when, guests, Google Meet, an email reminder and a description.
function closeModal(){ const m = document.getElementById("csModal"); if(m) m.remove(); }
function editor(x, isNew, done){
  closeModal();
  const m = document.createElement("div"); m.id = "csModal"; m.className = "cs-modal";
  m.innerHTML = `<div class="cs-dlg" role="dialog" aria-modal="true" aria-label="Event details">
    <input id="csmTitle" class="cs-m-title" maxlength="80" placeholder="Add title" value="${e(x.title)}">
    <div class="cs-m-when">🕘 ${C.DAYS[x.day]} · ${hh(x.start)} – ${hh(x.start + x.dur)} · Eastern Time</div>
    <label class="cs-m-row">👥 <input id="csmGuests" maxlength="200" placeholder="Add guests (email addresses)" value="${e(x.guests)}"></label>
    <label class="cs-m-row"><input type="checkbox" id="csmMeet" ${x.meet ? "checked" : ""}> 📹 Add Google Meet video conferencing</label>
    <label class="cs-m-row"><input type="checkbox" id="csmRemind" ${x.remind ? "checked" : ""}> 🔔 Email notification · 1 day before</label>
    <label class="cs-m-row cs-m-top">≡ <textarea id="csmDesc" rows="4" maxlength="300" placeholder="Add description">${e(x.desc)}</textarea></label>
    <div class="cs-m-btns">${isNew ? "" : `<button class="btn btn-ghost btn-sm" data-m="del">🗑 Delete</button>`}<span></span><button class="btn btn-ghost btn-sm" data-m="no">Cancel</button><button class="btn btn-navy btn-sm" data-m="ok">Save</button></div></div>`;
  document.body.appendChild(m);
  const q = sel => m.querySelector(sel), title = q("#csmTitle");
  const save = () => { const t = title.value.trim(); if(!t){ toast("Add a title."); title.focus(); return; }
    const v = {title:t.slice(0, 80), guests:q("#csmGuests").value.trim().slice(0, 200), meet:q("#csmMeet").checked, remind:q("#csmRemind").checked, desc:q("#csmDesc").value.trim().slice(0, 300)}; closeModal(); done(v); };
  m.addEventListener("click", ev => { const b = ev.target.closest("[data-m]"); if(b){ const k = b.dataset.m; if(k === "ok") save(); else if(k === "del"){ closeModal(); done(null, true); } else{ closeModal(); done(null); } } else if(ev.target === m){ closeModal(); done(null); } });
  m.addEventListener("keydown", ev => { if(ev.key === "Escape"){ ev.stopPropagation(); closeModal(); done(null); } else if(ev.key === "Enter" && ev.target === title){ ev.preventDefault(); save(); } });
  title.focus();
}
function onUp(ev){
  const d = S.drag; if(!d || ev.pointerId !== d.pid) return;
  const cur = d.cur; endDrag();
  if(!d.moved){ if(d.mode !== "new" && d.id){ S.sel = d.id; repaint(); const el = document.querySelector(`.cs-req[data-ev="${CSS.escape(d.id)}"]`); if(el) el.focus(); } return; }
  if(!cur){ repaint(); return; }
  if(d.mode === "new"){
    if(S.events.length >= C.MAXEV){ toast("That’s the most events a week can hold."); return; }
    const base = {id:uid(), title:"", day:cur.day, start:cur.start, dur:cur.dur, desc:"", guests:"", meet:false, remind:false};
    repaint();
    editor(base, true, v => { if(!v) return; S.events.push(Object.assign(base, v)); S.sel = base.id; changed(); repaint(); });
    return;
  }else{ Object.assign(d.x, {day:cur.day, start:cur.start, dur:cur.dur}); S.sel = d.id; }
  changed(); repaint();
}
function onCancel(){ endDrag(); repaint(); }
const evOf = id => S.events.find(x => x.id === id);
function rename(id){ const x = evOf(id); if(!x) return; editor(x, false, (v, del) => { if(del){ remove(id); return; } if(!v) return; Object.assign(x, v); changed(); repaint(); }); }
function remove(id){ S.events = S.events.filter(x => x.id !== id); if(S.sel === id) S.sel = null; changed(); repaint(); }
function wire(){
  const app = HOST.root; if(!app || app.dataset.csWired) return;
  app.dataset.csWired = "1";
  app.addEventListener("pointerdown", ev => {
    if(state.view !== "calsim" || !open() || ev.button > 0) return;
    const t = ev.target;
    if(t.closest("[data-del]")) return;
    if(t.closest("[data-rs]")){ ev.preventDefault(); startDrag(ev, "resize", t.closest("[data-rs]").dataset.rs); return; }
    const own = t.closest(".cs-req"); if(own && app.contains(own)){ startDrag(ev, "move", own.dataset.ev); return; }
    if(t.closest(".cs-ev")) return;      // a fixed event
    if(t.closest(".cs-col")){ ev.preventDefault(); startDrag(ev, "new"); }
  });
  app.addEventListener("click", ev => { if(state.view !== "calsim") return; const b = ev.target.closest("[data-del]"); if(b) remove(b.dataset.del); });
  app.addEventListener("dblclick", ev => { if(state.view !== "calsim") return; const el = ev.target.closest(".cs-req"); if(el) rename(el.dataset.ev); });
  app.addEventListener("keydown", ev => {
    if(state.view !== "calsim") return;
    const el = ev.target.closest && ev.target.closest(".cs-req"); if(!el) return;
    const x = evOf(el.dataset.ev); if(!x) return;
    const k = ev.key; let ok = true;
    if(k === "Delete" || k === "Backspace"){ ev.preventDefault(); remove(x.id); return; }
    if(k === "Enter"){ ev.preventDefault(); rename(x.id); return; }
    if(ev.shiftKey && k === "ArrowDown") x.dur = Math.min(BOTTOM - x.start, x.dur + C.STEP);
    else if(ev.shiftKey && k === "ArrowUp") x.dur = Math.max(C.STEP, x.dur - C.STEP);
    else if(k === "ArrowUp") x.start = Math.max(TOP, x.start - C.STEP);
    else if(k === "ArrowDown") x.start = Math.min(BOTTOM - x.dur, x.start + C.STEP);
    else if(k === "ArrowLeft") x.day = Math.max(0, x.day - 1);
    else if(k === "ArrowRight") x.day = Math.min(4, x.day + 1);
    else ok = false;
    if(!ok) return;
    ev.preventDefault(); S.sel = x.id; changed(); repaint();
    const again = document.querySelector(`.cs-req[data-ev="${CSS.escape(x.id)}"]`); if(again) again.focus();
  });
}

/* ---------- actions ---------- */
function submit(){
  const s = scn();
  if(!S.events.length){ toast("Add your events to the calendar before submitting."); return; }
  const flagged = Object.keys(C.flags(s, S.events)).length;
  if(!confirm(`Submit this calendar for ${s.short} to your trainer?` + (S.events.length < s.tasks.length ? `\n\nYou have ${S.events.length} event${S.events.length === 1 ? "" : "s"} for ${s.tasks.length} tasks.` : "") + (flagged ? `\n\n${flagged} event${flagged === 1 ? " is" : "s are"} marked red (a clash, missing travel time or outside business hours).` : "") + (subs(s.id).length ? "\n\nThis replaces your earlier submission (your trainer keeps both)." : ""))) return;
  if(S.data && isTrainee()){
    const au = C.review(s, S.events);
    S.data.submissions.push({scn:s.id, at:new Date().toISOString(), events:S.events.map(x => Object.assign({}, x)), auto:{pct:au.pct, score:au.score, max:au.max}});
    if(S.data.submissions.length > 20) S.data.submissions = S.data.submissions.slice(-20);
    queueSave();
  }
  S.result = C.review(s, S.events); repaint();
  toast(isTrainee() ? "Calendar submitted to your trainer." : "Trainer preview: nothing was submitted.");
}
function runReview(){
  const s = scn();
  if(!S.events.length){ toast("Add your events to the calendar first."); return; }
  const g = C.review(s, S.events); S.result = g;
  if(S.data && isTrainee()){
    S.data.autos.push({scn:s.id, at:new Date().toISOString(), pct:g.pct, score:g.score, max:g.max});
    if(S.data.autos.length > 30) S.data.autos = S.data.autos.slice(-30);
    queueSave();
  }
  repaint();
  const box = document.getElementById("csResultBox"); if(box && box.scrollIntoView) box.scrollIntoView({behavior:"smooth", block:"nearest"});
  toast(g.passed ? `Automated review: ${g.pct}%. It meets the attorney’s rules.` : `Automated review: ${g.pct}%. See what to fix below.`);
}
window.FTCalSim = {
  submit, save:saveNow, review:runReview,
  add(){
    if(S.events.length >= C.MAXEV){ toast("That’s the most events a week can hold."); return; }
    const x = {id:uid(), title:"", day:0, start:C.OPEN, dur:60, desc:"", guests:"", meet:false, remind:false};
    editor(x, true, v => { if(!v) return; S.events.push(Object.assign(x, v)); S.sel = x.id; changed(); repaint(); });
  },
  reset(){ if(S.events.length && !confirm("Remove all of your events from this week?")) return; S.events = []; S.sel = null; changed(); repaint(); },
  pick(i){ setScn(i); render(); },
  // open the scheduler on a track (its first week), or where it was
  open(track){ if(track){ const i = C.SCENARIOS.findIndex(x => x.track === track); if(i >= 0 && i !== S.scn) setScn(i); } render(); }
};
// The cards of the Calendaring Simulators on the Simulators page (js/ft-simulators.js): one per track, with the trainee's scores.
window.FTCalSimLoad = function(){ if(isTrainee() && !S.data && !S.loading) load(); };

/* ---------- results from the connected simulators (Portal, CMS) ---------- */
window.addEventListener("message", ev => {
  const d = ev.data;
  if(!d || d.type !== "lsh-sim-result" || d.sim !== "calendar" || !isTrainee()) return;
  if(ev.origin !== new URL(PORTAL).origin && ev.origin !== new URL(CMS).origin) return;
  const score = Number(d.score), max = Number(d.max);
  if(!isFinite(score) || !isFinite(max) || max <= 0 || score < 0 || score > max) return;
  const add = () => { S.data.external.push({title:String(d.title || "Calendaring Simulator").slice(0, 80), source:ev.origin, score, max, at:new Date().toISOString()});
    if(S.data.external.length > 30) S.data.external = S.data.external.slice(-30); queueSave(); if(state.view === "calsim") repaint(); };
  if(S.data) add(); else load().then(add);
});

/* ---------- admin: every trainee's submitted calendars, and the trainer's review ---------- */
const A = {rows:null, loading:false, open:{}, closed:{}, view:{}};
// ?track=standard|litigation|executive: each program's trainers open just their own track (Standard, Case Management, EA / PA)
const FILT = (C.TRACKS.find(x => x.id === new URLSearchParams(location.search).get("track")) || {}).id || "";
const inTrack = id => { const s = C.SCENARIOS.find(q => q.id === id); return !!s && (!FILT || s.track === FILT); };
const subsOf = x => x.d.submissions.filter(z => inTrack(z.scn));
async function loadAdmin(){
  A.loading = true;
  try{
    const d = await api("/api/calsim?all=1");
    A.rows = (d.rows || []).map(x => ({id:x.username, name:x.name || x.username, batch:x.batch || "", d:norm(x.data)})).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }catch(err){ A.rows = []; }
  A.loading = false;
  if(state.page === "scores") render();
}
// One trainee's scores, per week: the automated review of their latest submission and the trainer's score for it.
function scoresOf(x){
  return C.SCENARIOS.filter(s => inTrack(s.id)).map(s => {
    const last = x.d.submissions.filter(z => z.scn === s.id).pop(); if(!last) return "";
    const au = C.review(s, last.events).pct, r = x.d.reviews[subKey(last)];
    return `<span class="cs-pill">${e(s.short)}: 🤖 ${au}%${r ? ` · 👤 ${e(r.score)}/100` : ""}</span>`;
  }).join("");
}
const unreviewed = x => subsOf(x).filter(z => !x.d.reviews[subKey(z)]).length;
function renderAdminScores(){
  if(!A.rows && !A.loading) loadAdmin();
  if(!A.rows) return `<div class="card" style="padding:24px;">Loading the calendars…</div>`;
  const groups = {}; A.rows.forEach(x => { (groups[x.batch] = groups[x.batch] || []).push(x); });
  const keys = Object.keys(groups).sort((a, b) => (a === "") - (b === "") || b.localeCompare(a, undefined, {numeric:true}));
  return `<div class="card cs-admin"><h3>📅 Calendar Scores${FILT ? ` · ${e(C.trackOf(FILT).title)} (${e(C.trackOf(FILT).where)})` : ""}</h3>
    <p class="cs-hint">Each trainee’s calendars, with scores per trainee. Open a submission to see exactly what they built, the automated review against the attorney’s rules, and add your own feedback: a score out of 100, an overall comment and a comment on each task. They see your feedback on their Calendar Scheduler page. Scores from the Portal’s Calendaring Simulator are saved on the Portal under program FT; any result it posts back shows here too.</p>
    ${A.rows.length ? keys.map(b => `<section class="fp-batch"><div class="fp-batch-hd" onclick="FTCalAdmin.batch(${e(JSON.stringify(b))})">${A.closed[b] ? "▸" : "▾"} <b>📁 ${e(b ? "Batch " + b : "No batch set")}</b> <span class="fp-muted">${groups[b].length} trainee${groups[b].length === 1 ? "" : "s"}</span></div>
      ${A.closed[b] ? "" : groups[b].map(x => { const n = subsOf(x).length, u = unreviewed(x); return `<div class="fp-arow"><div class="fp-arow-hd" onclick="FTCalAdmin.row('${e(x.id)}')">${A.open[x.id] ? "▾" : "▸"} <b>${e(x.name)}</b>
        ${n ? `<span class="cs-pill ok">📤 ${n} submitted</span>` : `<span class="cs-pill">Not submitted</span>`}${scoresOf(x)}${u ? `<span class="cs-pill warn">${u} to review</span>` : n ? `<span class="cs-pill ok">All reviewed</span>` : ""}</div>
        ${A.open[x.id] ? detailHTML(x) : ""}</div>`; }).join("")}</section>`).join("")
      : `<div class="fp-muted" style="margin:14px 0;">No trainee has used the Calendar Scheduler yet.</div>`}
    <div style="margin-top:12px;"><button class="btn btn-ghost btn-sm" onclick="FTCalAdmin.refresh()">Refresh</button></div></div>`;
}
function detailHTML(x){
  const list = subsOf(x).slice().reverse().map((z, i) => {
    const s = C.SCENARIOS.find(q => q.id === z.scn); if(!s) return "";
    const events = C.clean(z.events), k = subKey(z), key = x.id + "|" + k, shown = !!A.view[key], r = x.d.reviews[k], g = C.review(s, events);
    const tk = s.tasks.map(t => `<label class="cs-rv-t">${e(t.title)} <input type="text" maxlength="400" id="csrt_${e(key)}_${e(t.id)}" value="${r && r.tasks ? e(r.tasks[t.id] || "") : ""}" placeholder="Your comment on this task (optional)"></label>`).join("");
    return `<div class="cs-sub"><div class="cs-sub-hd">📤 <b>${e(s.title)}</b> · submitted ${e(new Date(z.at).toLocaleString())} · ${events.length} event${events.length === 1 ? "" : "s"} for ${s.tasks.length} tasks · <span class="cs-pill ${g.passed ? "ok" : ""}">🤖 Automated: ${g.pct}%</span>
      ${i === 0 ? '<span class="cs-pill ok">latest</span>' : ""}${r ? `<span class="cs-pill ok">Feedback given: ${e(r.score)}/100</span>` : '<span class="cs-pill warn">To review</span>'}
      <button class="btn btn-ghost btn-sm" onclick="FTCalAdmin.view('${e(key)}')">${shown ? "Hide calendar" : "👁 View calendar and review"}</button></div>
      ${shown ? `<div class="cs-gridwrap">${gridHTML(s, events, true)}</div>
        <div class="cs-lab">🤖 Automated review (the attorney’s rules)</div>${reviewHTML(g, r && r.tasks)}
        <div class="cs-lab">👤 Manual feedback</div>
        <div class="cs-rv"><label>Score (0–100) <input type="number" min="0" max="100" id="csrs_${e(key)}" value="${r ? e(r.score) : ""}"></label>
          <label class="cs-rv-c">Overall comment to the trainee <textarea id="csrc_${e(key)}" rows="3">${r ? e(r.comment) : ""}</textarea></label></div>
        <div class="cs-rv-ts">${tk}</div>
        <button class="btn btn-navy btn-sm" onclick="FTCalAdmin.review('${e(x.id)}','${e(k)}','${e(key)}')">${r ? "Update feedback" : "Save feedback"}</button>` : ""}</div>`;
  }).join("");
  const ext = x.d.external.slice().reverse().map(z => `<div class="cs-att-ext">🔗 ${e(new Date(z.at).toLocaleString())} · ${e(z.title)} · <b>${Math.round(z.score)}/${Math.round(z.max)}</b></div>`).join("");
  const runs = x.d.autos.length ? `<div class="cs-att-ext">🤖 ${x.d.autos.length} automated review run${x.d.autos.length === 1 ? "" : "s"} while practicing: ${C.SCENARIOS.map(q => { const b = x.d.autos.filter(a => a.scn === q.id).reduce((m, a) => Math.max(m, a.pct), -1); return b < 0 ? "" : `${e(q.short)} best ${b}%`; }).filter(Boolean).join(", ")}</div>` : "";
  return `<div class="cs-atts">${list || '<div class="fp-muted">Nothing submitted yet.</div>'}${runs}${ext}</div>`;
}
window.FTCalAdmin = {
  row(id){ A.open[id] = !A.open[id]; render(); },
  batch(b){ A.closed[b] = !A.closed[b]; render(); },
  view(k){ A.view[k] = !A.view[k]; render(); },
  refresh(){ A.rows = null; render(); },
  async review(id, k, key){
    const sd = Object.fromEntries(((C.SCENARIOS.find(q => q.id === k.split("|")[0]) || {}).tasks || []).map(t => [t.id, String((document.getElementById("csrt_" + key + "_" + t.id) || {}).value || "").trim().slice(0, 400)]).filter(p => p[1]));
    const sc = Number((document.getElementById("csrs_" + key) || {}).value), cm = String((document.getElementById("csrc_" + key) || {}).value || "").trim().slice(0, 2000);
    if(!isFinite(sc) || sc < 0 || sc > 100 || (document.getElementById("csrs_" + key) || {}).value === ""){ toast("Enter a score from 0 to 100."); return; }
    const row = A.rows.find(r => r.id === id); if(!row) return;
    try{
      const d = await api("/api/calsim", {method:"POST", body:JSON.stringify({review:{user:id, key:k, score:sc, comment:cm, tasks:sd}})});   // the server merges it into the latest record
      row.d = norm(d.data); toast("Feedback saved."); render();
    }catch(err){ toast("Couldn’t save the review. Check your connection."); }
  }
};

/* ---------- the page ---------- */
function render(){
  const root = HOST.root;
  if(state.page === "scores"){ if(!state.isAdmin){ root.innerHTML = '<div class="card" style="padding:24px;">Calendar Scores is for trainers.</div>'; return; } root.innerHTML = '<main class="main-calsim">' + renderAdminScores() + '</main>'; return; }
  root.innerHTML = `<main class="main-calsim">${renderPage()}</main>`;
  wire(); paintSave();
  if(!S.loading && (!S.data || !S.entered)){ S.entered = true; load(); }   // read the record afresh each time the page opens (a trainer may have reviewed since)
}
window.CalSim = {render, show(page){ state.page = page; if(page === "scores") A.rows = null; render(); }};

(function(){ const st = document.createElement("style"); st.id = "ft-calendar"; st.textContent = `
main.main-calsim{max-width:1180px;margin:0 auto;padding:22px 16px 40px;}
.cs-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;} .cs-top h1{margin:0 0 4px;color:var(--navy);font-size:28px;}
.cs-top>div:first-child{flex:1 1 420px;min-width:0;} .cs-lead{margin:0 0 16px;color:var(--ink-soft);font-size:15px;}
.cs-tab.cs-link{text-decoration:none;display:inline-block;} .cs-also{margin:0 0 14px;font-size:12.5px;color:var(--ink-soft);} .cs-also a{color:var(--navy);font-weight:700;text-decoration:none;} .cs-also a:hover{text-decoration:underline;}
.cs-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}
.cs-tab{border:1px solid var(--line,#e5e7eb);background:var(--card,#fff);color:var(--navy);border-radius:999px;padding:8px 16px;font-weight:700;font-size:13.5px;cursor:pointer;}
.cs-tab i{font-style:normal;font-weight:600;color:var(--ink-soft);margin-left:6px;font-size:12px;} .cs-tab.active{background:var(--navy);color:#fff;border-color:var(--navy);} .cs-tab.active i{color:#fdba74;}
.cs-brief{padding:12px 16px;margin-bottom:14px;font-size:14px;color:var(--ink-soft);} .cs-err{color:#b91c1c;font-size:13px;margin-bottom:8px;}
.cs-main{display:grid;grid-template-columns:290px minmax(0,1fr);gap:14px;align-items:start;}
.cs-tray{background:var(--card,#fff);border:1px solid var(--line,#d1d5db);border-radius:14px;padding:12px;position:sticky;top:8px;max-height:calc(100vh - 16px);overflow:auto;}
.cs-tray h3{margin:0 0 4px;font-size:15px;color:var(--navy);} .cs-count{font-size:12px;font-weight:700;color:var(--orange-deep);margin-left:4px;}
.cs-hint{margin:0 0 10px;font-size:12.5px;color:var(--ink-soft);} .cs-legend{margin:8px 2px 0;}
.cs-task{background:#fff;border:1px solid var(--line,#e5e7eb);border-left:4px solid #f97316;border-radius:10px;padding:9px 11px;margin-bottom:8px;}
.cs-task b{font-size:13.5px;color:var(--navy);line-height:1.25;display:block;}
.cs-task p{margin:4px 0 0;font-size:12px;color:var(--ink-soft);line-height:1.35;} .cs-dur{display:inline-block;margin-top:3px;font-size:11px;font-weight:800;background:#ffedd5;color:#9a3412;border-radius:999px;padding:1px 8px;}
.cs-gridwrap{background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:14px;padding:8px;overflow-x:auto;}
.cs-grid{display:grid;grid-template-columns:54px repeat(5,minmax(112px,1fr));min-width:660px;}
.cs-dayhd{height:28px;line-height:28px;text-align:center;font-weight:800;font-size:13px;color:var(--navy);}
.cs-timecol{position:relative;} .cs-time{position:absolute;right:6px;font-size:10.5px;color:var(--ink-soft);}
.cs-col{position:relative;cursor:cell;touch-action:pan-y;border-left:1px solid #dadce0;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent ${SH * 4 - 1}px,#dadce0 ${SH * 4 - 1}px,#dadce0 ${SH * 4}px);}
.cs-col::before,.cs-col::after{content:"";position:absolute;left:0;right:0;background:rgba(100,116,139,.12);pointer-events:none;} .cs-col::before{top:0;height:${SH * 4}px;} .cs-col::after{top:${px(17 * 60)}px;bottom:0;}
.cs-ev{position:absolute;left:3px;right:3px;border-radius:7px;padding:2px 6px;overflow:hidden;font-size:11.5px;line-height:1.2;box-sizing:border-box;z-index:2;}
.cs-ev b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .cs-ev span{display:block;font-size:10.5px;opacity:.85;white-space:nowrap;}
.cs-fixed{background:#e8eaed;color:#3c4043;border:1px solid #dadce0;cursor:not-allowed;} .cs-court{background:#3f51b5;color:#fff;border-color:#3f51b5;}
.cs-lunch{background:repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 6px,#e2e8f0 6px,#e2e8f0 12px);color:#64748b;}
.cs-buf{position:absolute;left:3px;right:3px;background:repeating-linear-gradient(135deg,rgba(30,58,138,.14),rgba(30,58,138,.14) 4px,transparent 4px,transparent 8px);border-radius:6px;z-index:1;pointer-events:none;}
.cs-req{background:#039be5;color:#fff;border:1px solid #0288d1;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;z-index:3;box-shadow:0 1px 3px rgba(0,0,0,.2);padding-right:18px;}
.cs-req:focus-visible{outline:3px solid #fdba74;outline-offset:1px;} .cs-req.cs-sel{box-shadow:0 0 0 2px var(--navy);} .cs-req.cs-bad,.cs-ro.cs-bad{background:#d93025;border-color:#b3261e;color:#fff;} .cs-req.cs-lifted{opacity:.35;}
.cs-x{position:absolute;top:1px;right:2px;width:16px;height:16px;border:0;border-radius:4px;background:rgba(0,0,0,.12);color:#111;font-size:10px;line-height:16px;padding:0;cursor:pointer;} .cs-x:hover{background:rgba(0,0,0,.3);color:#fff;}
.cs-rs{position:absolute;left:0;right:0;bottom:0;height:8px;cursor:ns-resize;touch-action:none;background:linear-gradient(transparent,rgba(0,0,0,.18));}
.cs-prev{position:absolute;left:3px;right:3px;border-radius:7px;z-index:5;pointer-events:none;font-size:10.5px;font-weight:700;padding:2px 6px;box-sizing:border-box;}
.cs-prev.ok{background:rgba(34,197,94,.3);border:2px solid #16a34a;color:#14532d;} .cs-prev.bad{background:rgba(239,68,68,.28);border:2px solid #dc2626;color:#7f1d1d;}
.cs-ghost{position:fixed;z-index:9500;pointer-events:none;background:#f97316;color:#111827;border-radius:8px;padding:4px 8px;font-size:12px;box-shadow:0 8px 20px rgba(0,0,0,.3);opacity:.92;overflow:hidden;box-sizing:border-box;}
body.cs-dragging,body.cs-dragging *{cursor:grabbing!important;user-select:none!important;-webkit-user-select:none!important;}
.cs-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:14px 0;} .cs-save{font-size:12.5px;color:var(--ink-soft);}
.cs-hist{display:flex;flex-direction:column;gap:8px;margin-bottom:14px;} .cs-hist-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
.cs-pill{display:inline-block;background:#eef2ff;color:#1e3a8a;border-radius:999px;padding:3px 11px;font-size:12px;font-weight:700;margin:0 4px 0 6px;} .cs-hist .cs-pill{margin:0;} .cs-pill.ok{background:#dcfce7;color:#166534;} .cs-pill.warn{background:#fef3c7;color:#92400e;}
.cs-review{flex-basis:100%;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 12px;font-size:13.5px;} .cs-review p{margin:4px 0 0;color:#14532d;}
.cs-more{padding:14px 18px;} .cs-more p{margin:4px 0 10px;font-size:13.5px;color:var(--ink-soft);} .cs-more a{text-decoration:none;}
.cs-admin{padding:16px 18px;} .cs-atts{margin:6px 0 10px 18px;} .cs-att-ext{font-size:13px;margin:4px 0;}
.cs-sub,.cs-sub *{text-transform:none;letter-spacing:normal;} .cs-sub{border:1px solid var(--line,#e5e7eb);border-radius:10px;padding:8px 12px;margin:6px 0;} .cs-sub-hd{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;} .cs-sub .cs-gridwrap{margin:8px 0;}
.cs-ro{background:#039be5;color:#fff;border:1px solid #0288d1;z-index:3;} .cs-flag{color:#b91c1c;font-weight:700;} .cs-result{background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-left:6px solid #f97316;border-radius:12px;padding:14px 16px;margin:0 0 14px;} .cs-result.ok{border-left-color:#16a34a;}
.cs-score{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:8px;} .cs-score b{font-size:32px;color:var(--navy);} .cs-score span{font-weight:700;color:var(--ink-soft);}
.cs-item{border-top:1px solid var(--line,#e5e7eb);padding:8px 0;font-size:13.5px;} .cs-item-hd{display:flex;gap:6px;align-items:baseline;} .cs-item-hd span{margin-left:auto;font-weight:700;color:var(--ink-soft);white-space:nowrap;}
.cs-item.ok .cs-item-hd{color:#166534;} .cs-item.bad .cs-item-hd{color:#991b1b;} .cs-item ul{margin:4px 0 0 22px;padding:0;color:#7f1d1d;font-size:13px;} .cs-tnote{margin-top:4px;font-size:13px;color:#14532d;background:#f0fdf4;border-radius:6px;padding:4px 8px;}
.cs-review ul{margin:6px 0 0 20px;padding:0;font-size:13px;color:#14532d;} .cs-rv-ts{display:flex;flex-direction:column;gap:6px;margin:6px 0 10px;} .cs-rv-t{display:flex;flex-direction:column;gap:2px;font-size:12px;font-weight:700;color:var(--ink-soft);} .cs-rv-t input{padding:6px 8px;font:inherit;font-weight:400;}
.cs-evlist{margin:6px 0 10px 18px;padding:0;font-size:13px;} .cs-rv{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin:8px 0 4px;} .cs-rv label{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:700;color:var(--ink-soft);} .cs-rv input{width:90px;padding:6px 8px;} .cs-rv-c{flex:1 1 280px;} .cs-rv textarea{width:100%;padding:6px 8px;font:inherit;}
.cs-blurb{margin:0 0 12px;font-size:13.5px;color:var(--ink-soft);max-width:820px;} .cs-weeks{margin-top:-4px;} .cs-wk{font-size:12.5px;padding:6px 14px;} .cs-et{font-size:11px;color:var(--ink-soft);} .cs-chip{background:#e0f2fe;color:#075985;margin-left:4px;}
.cs-modal{position:fixed;inset:0;z-index:9800;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px;}
.cs-dlg{width:min(460px,100%);background:#fff;border-radius:16px;padding:18px 20px;box-shadow:0 24px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:12px;}
.cs-m-title{border:0;border-bottom:2px solid #1a73e8;font-size:21px;padding:4px 2px 6px;outline:none;color:#202124;width:100%;} .cs-m-when{font-size:13.5px;color:#3c4043;}
.cs-m-row{display:flex;gap:8px;align-items:center;font-size:13.5px;color:#3c4043;} .cs-m-row input[type=text],.cs-m-row input:not([type]){flex:1;border:0;border-bottom:1px solid #dadce0;padding:5px 2px;font:inherit;outline:none;} .cs-m-top{align-items:flex-start;} .cs-m-row textarea{flex:1;border:1px solid #dadce0;border-radius:8px;padding:6px 8px;font:inherit;resize:vertical;}
.cs-m-btns{display:flex;gap:8px;align-items:center;} .cs-m-btns span{flex:1;}
@media (max-width:820px){ .cs-main{grid-template-columns:1fr;} .cs-tray{position:static;max-height:none;} }
`; document.head.appendChild(st); })();
})();

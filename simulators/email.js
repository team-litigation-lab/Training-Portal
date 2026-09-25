/* LSH Training Portal — Email Workspace (universal Gmail-style simulator).
   Packs: built-in (EMAIL_PACKS) or generated for any program. Each email leaves the
   Inbox through one decision; every email gets a label (folders + nested sub-labels).
   Grades: filing, security (phishing), triage decisions and reply writing. */
const WS_ICON = {
  archive:'<svg viewBox="0 0 24 24"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  snooze:'<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
  star:'<svg viewBox="0 0 24 24"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/></svg>',
  starOn:'<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
  forward:'<svg viewBox="0 0 24 24"><path d="M14 8V4l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>',
  reply:'<svg viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>',
  back:'<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
  inbox:'<svg viewBox="0 0 24 24"><path d="M19 3H4.99c-1.11 0-1.98.89-1.98 2L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z"/></svg>',
  unread:'<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
  search:'<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
  pencil:'<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
  refresh:'<svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
  label:'<svg viewBox="0 0 24 24"><path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16zM16 17H5V7h11l3.55 5L16 17z"/></svg>',
  report:'<svg viewBox="0 0 24 24"><path d="M15.73 3H8.27L3 8.27v7.46L8.27 21h7.46L21 15.73V8.27L15.73 3zM19 14.9L14.9 19H9.1L5 14.9V9.1L9.1 5h5.8L19 9.1v5.8zM11 7h2v6h-2zm0 8h2v2h-2z"/></svg>'
};
const WS_ACTIONS = {
  reply:  {d:'do',       folder:'starred',   verb:'Replied',   done:'Reply sent.'},
  star:   {d:'do',       folder:'starred',   verb:'Starred',   done:'Starred — on your Do-now list.'},
  snooze: {d:'schedule', folder:'snoozed',   verb:'Snoozed',   done:'Snoozed'},
  forward:{d:'delegate', folder:'forwarded', verb:'Forwarded', done:'Message forwarded.'},
  archive:{d:'defer',    folder:'archive',   verb:'Archived',  done:'Conversation archived.'},
  trash:  {d:'defer',    folder:'trash',     verb:'Deleted',   done:'Conversation moved to Trash.'},
  report: {d:'report',   folder:'spam',      verb:'Reported',  done:'Reported as phishing and moved to Spam.'}
};
const WS_DECISION = { do:'Do (reply / star)', schedule:'Schedule (snooze)', delegate:'Delegate (forward)', defer:'Defer (archive / delete)', report:'Report phishing' };
const WS_FOLDERS = [
  {id:'inbox', name:'Inbox', icon:'inbox'}, {id:'starred', name:'Starred', sub:'Do now', icon:'starOn'}, {id:'snoozed', name:'Snoozed', sub:'Schedule', icon:'snooze'},
  {id:'forwarded', name:'Forwarded', sub:'Delegate', icon:'forward'}, {id:'archive', name:'All mail', sub:'Archived — defer', icon:'archive'},
  {id:'trash', name:'Trash', sub:'Delete', icon:'trash'}, {id:'spam', name:'Spam', sub:'Reported phishing', icon:'report'}
];
const WS_SNOOZE = [['Later today','6:00 PM'],['Tomorrow','Tue, 8:00 AM'],['This weekend','Sat, 8:00 AM'],['Next week','Mon, 8:00 AM']];
const WS_PALETTE = ['#B54A3F','#6B4FA0','#DB8437','#3F7D58','#3C4268','#2C7A7B','#7C82A0','#A8ADBD','#4A2545','#0b57d0','#e37400','#188038'];
const WS_PROGRAMS = ['Standard Training','Litigation','Medsum and Demand','Case Management','EA / PA','Calendar Management','Business Law','Estate Planning','Family Law','Health Subrogation','Immigration Law','Intellectual Property Law','Lien Verification','Mass Tort','Property Damage','Real Estate Law'];
const WS_SENSITIVE = /(password|routing number|account number|ssn|social security|pin\s*(is|:)|\b\d{6,}\b)/i;

let W = { phase:'pick' };
const esc = Sim.esc;
// Trainees don't sign in on the portal: key saved progress by the admin account or the "Who's practicing?" name.
function wsMe(){ const s = Sim.session(), w = Sim.who(); return s.userType==='Admin' ? (s.fullName||s.username||'') : (w.name||''); }
function wsKey(){ const s = Sim.session(); return `lsh_email_ws:${(s.userType==='Admin' ? s.username : Sim.who().name) || 'me'}`; }
// ?program=CM or EA (or the program saved with the trainee's name) puts that inbox first.
const WS_START = (()=>{ const p = String(new URLSearchParams(location.search).get('program') || Sim.who().program || '').toUpperCase(); return p.startsWith('CM') ? 'cm' : p.startsWith('EA') ? 'ea' : ''; })();
function wsSave(){ try{ if(W.phase==='ws'){ const {menu,compose,dialog,snack,undo,sel,...keep} = W; localStorage.setItem(wsKey(), JSON.stringify(keep)); } else localStorage.removeItem(wsKey()); }catch(e){} }
function wsLoad(){ try{ const v = JSON.parse(localStorage.getItem(wsKey())||'null'); if(v && v.pack) { W = Object.assign({sel:{}}, v); return true; } }catch(e){} return false; }

/* ---------- starting a pack ---------- */
function wsStart(pack){
  const labels = pack.labels.map((l,i)=>({id:'L'+i, name:l.name, parentId:null, color:l.color||WS_PALETTE[i%WS_PALETTE.length]}));
  const emails = pack.emails.map((e,i)=>({id:'e'+i, from:e.from, subject:e.subject, time:e.time||'', body:e.body||'',
    preview:String(e.body||'').replace(/\{\{LINK:(.*?)\}\}/g,'$1').replace(/\s+/g,' ').slice(0,110),
    label:e.label, decision:e.decision, needsReply:!!e.needsReply, phishing:!!e.phishing, redFlags:e.redFlags||[]}));
  W = {phase:'ws', pack:{id:pack.id, program:pack.program, title:pack.title, role:pack.role}, labels, emails,
       meta:{}, read:{}, sel:{}, lab:{}, notes:{}, folder:'inbox', open:null, search:'', focus:0, startedAt:0, result:'', fail:null};
  wsSave(); render();
}
async function wsGenerate(){
  const prog = document.getElementById('pkProgram').value, btn = document.getElementById('pkGen'), st = document.getElementById('pkStatus');
  btn.disabled = true; st.innerHTML = `<div class="sim-loading" style="margin-top:8px;">Building a ${esc(prog)} inbox… (15–30 seconds)</div>`;
  const prompt = `Create a realistic training inbox for legal support staff in this program: "${prog}".
Pick the trainee's realistic role in that program at a US legal-support company (one sentence, second person: "You are…").
Create 7 labels a real team would use for this work — always include "Security Alert".
Write 12 realistic emails that land in that role's inbox on a Monday morning: clients, opposing parties or agencies, internal team, vendors/newsletters, and EXACTLY ONE convincing phishing email whose body contains a link written as {{LINK:button text}}.
For each email give the correct label (one of your label names) and the correct decision:
"do" = urgent & important (reply now or flag), "schedule" = important not urgent, "delegate" = someone else should handle it, "defer" = low value (archive/delete), "report" = phishing.
Mark needsReply true for 3 emails where a written reply from the trainee is expected (give those senders clearly different writing styles).
Return ONLY JSON: {"role":"...","labels":["..."],"emails":[{"from":"Name <email>","subject":"...","time":"h:mm AM","body":"full email with greeting and sign-off, \\n between paragraphs","label":"...","decision":"do|schedule|delegate|defer|report","needsReply":false,"phishing":false,"redFlags":["only for the phishing email"]}]}`;
  try{
    const r = await Sim.ai({ system:'You write realistic, varied training content for legal support staff. US context, plausible names, no real companies.', messages:[{role:'user', text:prompt}], json:true, maxTokens:3800 });
    const labels = (r.labels||[]).map(String).filter(Boolean); if(!labels.includes('Security Alert')) labels.push('Security Alert');
    const ok = new Set(['do','schedule','delegate','defer','report']);
    const emails = (r.emails||[]).filter(e=>e && e.subject && e.body).map(e=>({from:e.from||'Unknown', subject:e.subject, time:e.time||'', body:String(e.body),
      label: labels.includes(e.label) ? e.label : labels[0], decision: ok.has(e.decision) ? e.decision : 'defer', needsReply:!!e.needsReply,
      phishing: !!e.phishing || e.decision==='report', redFlags: e.redFlags||[]}));
    if(emails.length < 6) throw new Error('the generated inbox was too small — try again');
    wsStart({id:'gen', program:prog, title:`${prog} — generated inbox`, role:r.role||`You work on the ${prog} team.`, labels:labels.map(n=>({name:n})), emails});
  }catch(e){ btn.disabled = false; st.innerHTML = `<div class="sim-error" style="margin-top:8px;">Couldn’t build the inbox: ${esc(e.message)}</div>`; }
}
function wsResume(){ if(wsLoad()) render(); }
function wsQuit(){ if(W.phase==='ws' && Object.keys(W.meta||{}).length && !W.result && !confirm('Leave this inbox? Your progress in it will be cleared.')) return; W = {phase:'pick'}; wsSave(); render(); }

/* ---------- helpers ---------- */
function mins(t){ const m = String(t||'').match(/(\d+):(\d+)\s*(AM|PM)/i); if(!m) return 0; let h = +m[1]%12; if(/pm/i.test(m[3])) h += 12; return h*60 + +m[2]; }
function folderOf(e){ const m = W.meta[e.id]; return m ? WS_ACTIONS[m.action].folder : 'inbox'; }
function lbl(id){ return W.labels.find(l=>l.id===id); }
function lblKids(pid){ return W.labels.filter(l=>(l.parentId||null)===(pid||null)); }
function lblChain(id){ const out=[]; let c=lbl(id); while(c){ out.push(c.name); c = c.parentId ? lbl(c.parentId) : null; } return out; }
function lblPath(id){ return lblChain(id).reverse().join(' / '); }
function lblDesc(id){ const out=[id]; lblKids(id).forEach(c=>out.push(...lblDesc(c.id))); return out; }
function lblTree(pid, depth, out){ out = out||[]; lblKids(pid).forEach(l=>{ out.push({l, depth:depth||0}); lblTree(l.id, (depth||0)+1, out); }); return out; }
function chip(id){ const l = lbl(id); return l ? `<span class="gm-chip" style="background:${l.color}">${esc(lblPath(id))}</span>` : ''; }
function visible(){
  const q = (W.search||'').toLowerCase();
  const inF = (e)=> W.folder.startsWith('label:') ? lblDesc(W.folder.slice(6)).includes(W.lab[e.id]) : folderOf(e)===W.folder;
  return W.emails.filter(e=>inF(e) && (!q || (e.from+' '+e.subject+' '+e.body).toLowerCase().includes(q))).sort((a,b)=>mins(b.time)-mins(a.time));
}
function nm(from){ const m = String(from).match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>/); return m ? {name:m[1].trim(), email:m[2].trim()} : {name:String(from), email:''}; }
function snack(t, undo, ms){ W.snack = t; if(!undo) W.undo = null; clearTimeout(snack.t); snack.t = setTimeout(()=>{ W.snack = null; draw(); }, ms||6000); }

/* ---------- rendering ---------- */
function render(){
  Sim.label(W.phase==='ws' ? 'Email Workspace — '+W.pack.program : 'Email Workspace');
  const app = document.getElementById('app');
  if(W.phase!=='ws'){
    let saved = null; try{ saved = JSON.parse(localStorage.getItem(wsKey())||'null'); }catch(e){}
    app.innerHTML = `${saved && saved.pack ? `<div class="sim-card" style="margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><div style="flex:1;"><b>Continue where you left off</b><div class="sim-muted" style="font-size:13px;">${esc(saved.pack.title)} · ${Object.keys(saved.meta||{}).length}/${(saved.emails||[]).length} handled</div></div><button class="sim-btn primary" onclick="wsResume()">Continue →</button></div>` : ''}
    <div class="pk-grid">
      ${(WS_START==='ea' ? ['ea','cm'] : ['cm','ea']).map(k=>{ const p = EMAIL_PACKS[k]; return `<div class="sim-card pk"><span class="sim-chip ${k==='cm'?'next':'input'}" style="align-self:flex-start;">${esc(p.program)}</span><h3>${esc(p.title)}</h3><p>${esc(p.role)}</p><div class="sim-muted" style="font-size:12.5px;">${p.emails.length} emails · ${p.labels.length} starter labels · includes a phishing attempt</div><button class="sim-btn primary" onclick="wsStart(EMAIL_PACKS['${k}'])">Open this inbox →</button></div>`; }).join('')}
      <div class="sim-card pk"><span class="sim-chip live" style="align-self:flex-start;">Any program</span><h3>Generate an inbox for any program</h3><p>Pick a program from the Training Index. A fresh inbox is written for that program’s role — its own labels, senders, deadlines and a phishing attempt. Different every time.</p>
        <select id="pkProgram">${WS_PROGRAMS.map(p=>`<option>${esc(p)}</option>`).join('')}</select>
        <button class="sim-btn orange" id="pkGen" onclick="wsGenerate()">Generate inbox →</button><div id="pkStatus"></div></div>
    </div>`;
    return;
  }
  app.innerHTML = `<div class="sim-card" style="margin-bottom:12px;"><div class="ws-bar"><div class="grow"><div class="sim-kicker">${esc(W.pack.program)}</div><div style="font-size:18px;font-weight:800;">${esc(W.pack.title)}</div></div>
      <button class="sim-btn ghost" onclick="wsQuit()">← Choose another inbox</button></div>
      <p class="ws-role">${esc(W.pack.role)} <b>File every email under a label</b> (create folders and nest sub-labels), then clear the Inbox with <b>one decision per email</b>. Watch for anything suspicious.</p></div>
    <div id="wsZone"></div>`;
  draw();
}
function draw(){
  const z = document.getElementById('wsZone'); if(!z) return;
  const hadFocus = document.activeElement && document.activeElement.id==='gmShell';
  z.innerHTML = shellHtml();
  if(hadFocus){ const s = document.getElementById('gmShell'); if(s) s.focus({preventScroll:true}); }
}
function shellHtml(){
  if(W.fail) return `<div class="gm-fail"><h3>❌ Exercise failed — the phishing attempt succeeded</h3><p>${esc(W.fail.reason)}</p>${(W.fail.redFlags||[]).length ? `<p><b>What gave it away:</b></p><ul>${W.fail.redFlags.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>` : ''}<button class="sim-btn orange" onclick="wsRestart()">Try again</button></div>`;
  const total = W.emails.length, handled = W.emails.filter(e=>W.meta[e.id]).length, filed = W.emails.filter(e=>W.lab[e.id]).length;
  const unreadIn = W.emails.filter(e=>folderOf(e)==='inbox' && !W.read[e.id]).length;
  const counts = {}; W.emails.forEach(e=>{ const f = folderOf(e); counts[f] = (counts[f]||0)+1; });
  const lc = {}; Object.values(W.lab).forEach(id=>{ lc[id] = (lc[id]||0)+1; });
  const open = W.open && W.emails.find(e=>e.id===W.open);
  const ready = handled===total && filed===total;
  return `<div class="gm" id="gmShell" tabindex="0" onkeydown="wsKeyDown(event)">
    <div class="gm-top"><div class="gm-logo"><b>M</b><span>Mail</span></div>
      <label class="gm-search">${WS_ICON.search}<input placeholder="Search mail" value="${esc(W.search||'')}" oninput="wsSearch(this.value)"></label>
      <div class="gm-avatar" title="${esc(wsMe())}">${esc(((wsMe()||'Me').split(' ').map(x=>x[0]).join('')).slice(0,2))}</div></div>
    <div class="gm-progress"><i style="width:${Math.round(handled/Math.max(total,1)*100)}%"></i></div>
    <div class="gm-body">
      <nav class="gm-nav"><button class="gm-compose" disabled title="Not needed for this exercise">${WS_ICON.pencil} Compose</button>
        ${WS_FOLDERS.map(f=>`<button class="gm-folder ${f.sub?'two':''} ${W.folder===f.id?'on':''}" onclick="wsFolder('${f.id}')">${WS_ICON[f.icon]}<span>${f.name}${f.sub?`<small>${f.sub}</small>`:''}</span><em>${f.id==='inbox' ? (unreadIn||'') : (counts[f.id]||'')}</em></button>`).join('')}
        <div class="gm-lblhead">Labels <button title="Create new label" onclick="wsNewLabel()">+</button></div>
        ${lblTree(null).map(({l,depth})=>`<button class="gm-lbl ${W.folder==='label:'+l.id?'on':''}" style="padding-left:${16+depth*16}px" onclick="wsFolder('label:${l.id}')" title="${esc(lblPath(l.id))}"><i style="background:${l.color}"></i><span>${esc(l.name)}</span><em>${lc[l.id]||''}</em></button>`).join('')}
      </nav>
      <section class="gm-main">${open ? readerHtml(open) : listHtml()}</section>
    </div>
    <div class="gm-legend">
      <span><b>Do:</b> Reply or ⭐</span><span><b>Schedule:</b> 🕒 Snooze</span><span><b>Delegate:</b> ↪ Forward</span><span><b>Defer:</b> Archive / 🗑</span><span><b>Suspicious:</b> 🚩 Report</span><span><b>File:</b> 🏷 Label</span>
      <span>⌨ <span class="gm-kbd">j</span>/<span class="gm-kbd">k</span> · <span class="gm-kbd">o</span> open · <span class="gm-kbd">u</span> back · <span class="gm-kbd">e</span> archive · <span class="gm-kbd">#</span> delete · <span class="gm-kbd">s</span> star · <span class="gm-kbd">b</span> snooze · <span class="gm-kbd">f</span> forward · <span class="gm-kbd">r</span> reply · <span class="gm-kbd">l</span> label · <span class="gm-kbd">!</span> report · <span class="gm-kbd">z</span> undo</span>
      <span class="gm-submit">${handled}/${total} handled · ${filed}/${total} filed ${ready ? `<button class="sim-btn primary" onclick="wsSubmit()">Submit for grading</button>` : ''}</span>
    </div>
    ${W.menu ? (W.menu.type==='label' ? labelMenuHtml() : snoozeMenuHtml()) : ''}
    ${W.compose ? composeHtml() : ''}${W.dialog ? dialogHtml() : ''}
    ${W.snack ? `<div class="gm-snack"><span>${esc(W.snack)}</span>${W.undo ? `<button onclick="wsUndo()">Undo</button>` : ''}</div>` : ''}
  </div><div id="wsResult" style="margin-top:14px;">${W.result||''}</div>`;
}
function listHtml(){
  const rows = visible(), inInbox = W.folder==='inbox', selIds = rows.filter(e=>W.sel[e.id]).map(e=>e.id);
  const bulk = (a, tip, icon)=>`<button class="gm-ib" data-tip="${tip}" ${selIds.length?'':'disabled'} onclick="wsBulk('${a}')">${WS_ICON[icon||a]}</button>`;
  let body;
  if(!rows.length){
    const unfiled = W.emails.filter(e=>!W.lab[e.id]).length, allDone = W.emails.every(e=>W.meta[e.id]);
    body = inInbox && !W.search ? `<div class="gm-done"><div class="sun">☀️</div><b>You're all done!</b><div>Nothing in Inbox — that's Inbox Zero.</div>${allDone && !unfiled ? `<button class="sim-btn primary" style="margin-top:12px;" onclick="wsSubmit()">Submit for grading</button>` : (unfiled ? `<div style="margin-top:8px;color:#b06000;">${unfiled} email${unfiled>1?'s':''} still need a label — find them in the other folders.</div>` : '')}</div>`
      : `<div class="gm-empty">${W.search ? 'No messages matched your search.' : 'No conversations here.'}</div>`;
  }else body = rows.map((e,i)=>{ const n = nm(e.from), m = W.meta[e.id], live = !m;
    return `<div class="gm-row ${W.read[e.id]?'':'unread'} ${W.focus===i?'focus':''} ${W.sel[e.id]?'sel':''}" onclick="wsOpen('${e.id}')">
      <input type="checkbox" class="gm-chk" ${W.sel[e.id]?'checked':''} onclick="event.stopPropagation();wsSelect('${e.id}',this.checked)" aria-label="Select">
      <button class="gm-ib gm-star ${m&&m.action==='star'?'on':''}" onclick="event.stopPropagation();${live?`wsAct(['${e.id}'],'star')`:''}">${m&&m.action==='star'?WS_ICON.starOn:WS_ICON.star}</button>
      <div class="gm-from">${esc(n.name)}</div>
      <div class="gm-snip">${m && !inInbox ? `<span class="gm-tag">${esc(WS_ACTIONS[m.action].verb)}${m.detail?' · '+esc(m.detail):''}</span>` : ''}${W.lab[e.id] ? chip(W.lab[e.id]) : ''}<span class="gm-subj">${esc(e.subject)}</span> — ${esc(e.preview)}</div>
      <div class="gm-time">${esc(e.time)}</div>
      <div class="gm-hover">${live ? `<button class="gm-ib" data-tip="Archive" onclick="event.stopPropagation();wsAct(['${e.id}'],'archive')">${WS_ICON.archive}</button><button class="gm-ib" data-tip="Delete" onclick="event.stopPropagation();wsAct(['${e.id}'],'trash')">${WS_ICON.trash}</button><button class="gm-ib" data-tip="Label" onclick="event.stopPropagation();wsLabelMenu(['${e.id}'])">${WS_ICON.label}</button><button class="gm-ib" data-tip="Snooze" onclick="event.stopPropagation();wsSnoozeMenu(['${e.id}'])">${WS_ICON.snooze}</button>`
        : `<button class="gm-ib" data-tip="Label" onclick="event.stopPropagation();wsLabelMenu(['${e.id}'])">${WS_ICON.label}</button><button class="gm-ib" data-tip="Move to Inbox" onclick="event.stopPropagation();wsToInbox(['${e.id}'])">${WS_ICON.inbox}</button>`}</div></div>`; }).join('');
  return `<div class="gm-bar"><input type="checkbox" class="gm-chk" ${rows.length && selIds.length===rows.length?'checked':''} onclick="wsSelectAll(this.checked)" aria-label="Select all">
    <button class="gm-ib" data-tip="Refresh" onclick="draw()">${WS_ICON.refresh}</button>
    ${inInbox ? bulk('archive','Archive')+bulk('report','Report phishing')+bulk('trash','Delete')+`<button class="gm-ib" data-tip="Snooze" ${selIds.length?'':'disabled'} onclick="wsSnoozeMenu(null)">${WS_ICON.snooze}</button>`+bulk('star','Star') : `<button class="gm-ib" data-tip="Move to Inbox" ${selIds.length?'':'disabled'} onclick="wsToInbox(null)">${WS_ICON.inbox}</button>`}
    <button class="gm-ib" data-tip="Label as" ${selIds.length?'':'disabled'} onclick="wsLabelMenu(null)">${WS_ICON.label}</button>
    ${W.folder.startsWith('label:') ? `<span style="margin-left:6px;">${chip(W.folder.slice(6))}</span>` : ''}<span class="gm-count">${rows.length ? `1–${rows.length} of ${rows.length}` : ''}</span></div>
    <div class="gm-list">${body}</div>`;
}
function readerHtml(e){
  const n = nm(e.from), m = W.meta[e.id], live = !m;
  const paras = String(e.body).split(/\n+/).map(p=>`<p>${esc(p).replace(/\{\{LINK:(.*?)\}\}/g,(_,t)=>`<a class="gm-link" onclick="wsPhishClick('${e.id}')">${t}</a>`)}</p>`).join('');
  const tb = (a,tip,fn)=>`<button class="gm-ib" data-tip="${tip}" onclick="${fn}">${WS_ICON[a]}</button>`;
  return `<div class="gm-bar">${tb('back','Back','wsBack()')}
    ${live ? tb('archive','Archive',`wsAct(['${e.id}'],'archive')`)+tb('report','Report phishing',`wsAct(['${e.id}'],'report')`)+tb('trash','Delete',`wsAct(['${e.id}'],'trash')`)+tb('unread','Mark as unread',`wsUnread('${e.id}')`)+tb('snooze','Snooze',`wsSnoozeMenu(['${e.id}'])`)+tb('star','Star (Do now)',`wsAct(['${e.id}'],'star')`) : tb('inbox','Move to Inbox',`wsToInbox(['${e.id}'])`)}
    ${tb('label','Label as',`wsLabelMenu(['${e.id}'])`)}</div>
    <div class="gm-read"><h2>${esc(e.subject)} <span class="gm-tag">${m ? esc(WS_ACTIONS[m.action].verb)+(m.detail?' · '+esc(m.detail):'') : 'Inbox'}</span>${W.lab[e.id] ? chip(W.lab[e.id]) : ''}</h2>
      <div class="gm-sender"><div class="gm-av">${esc((n.name[0]||'?').toUpperCase())}</div><div><b>${esc(n.name)}</b> <span>${n.email ? '&lt;'+esc(n.email)+'&gt;' : ''}</span><br><span>to me</span></div><span class="gm-when">${esc(e.time)}</span></div>
      <div class="gm-msg">${paras}</div>
      ${W.notes[e.id] ? `<div class="gm-msg" style="border-left:3px solid #dadce0;padding-left:12px;color:#5f6368;"><b>${m && m.action==='forward' ? 'Your handoff note' : 'Your reply'}:</b><br>${esc(W.notes[e.id]).replace(/\n/g,'<br>')}</div>` : ''}
      ${live ? `<div class="gm-replybar"><button class="gm-pill" onclick="wsCompose('${e.id}','reply')">${WS_ICON.reply} Reply</button><button class="gm-pill" onclick="wsCompose('${e.id}','forward')">${WS_ICON.forward} Forward</button></div>` : ''}</div>`;
}
function snoozeMenuHtml(){ return `<div class="gm-menu" onclick="event.stopPropagation()"><h6>Snooze until…</h6>${WS_SNOOZE.map(([a,b])=>`<button onclick="wsSnooze('${a}')">${a}<span>${b}</span></button>`).join('')}<button onclick="wsSnooze('Pick date & time')">📅 Pick date &amp; time</button><button onclick="wsCloseMenu()" style="justify-content:center;color:#0b57d0;">Cancel</button></div>`; }
function labelMenuHtml(){
  const ids = W.menu.ids, cur = ids.length===1 ? W.lab[ids[0]] : null;
  return `<div class="gm-menu gm-lblmenu" onclick="event.stopPropagation()" style="max-height:380px;overflow:auto;"><h6>Label as:</h6>
    ${lblTree(null).map(({l,depth})=>`<button class="${cur===l.id?'on':''}" onclick="wsSetLabel('${l.id}')"><span class="ind" style="padding-left:${depth*16}px"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${l.color};margin-right:8px;"></i>${esc(l.name)}</span>${cur===l.id?'<span>✓</span>':''}</button>`).join('')}
    ${cur ? `<button onclick="wsSetLabel('')" style="color:#5f6368;">Remove label</button>` : ''}<button onclick="wsNewLabel(true)" style="color:#0b57d0;">+ Create new</button><button onclick="wsCloseMenu()" style="justify-content:center;color:#0b57d0;">Cancel</button></div>`;
}
function dialogHtml(){
  return `<div class="gm-dialog" onclick="if(event.target===this) wsCloseDialog()"><div><h6>New label</h6>
    <label for="wsLblName">Please enter a new label name:</label><input type="text" id="wsLblName" onkeydown="event.stopPropagation(); if(event.key==='Enter') wsCreateLabel();">
    <label style="display:flex;align-items:center;gap:8px;margin-top:14px;"><input type="checkbox" id="wsLblNest" onchange="document.getElementById('wsLblParent').disabled=!this.checked"> Nest label under:</label>
    <select id="wsLblParent" disabled>${lblTree(null).map(({l,depth})=>`<option value="${l.id}">${'— '.repeat(depth)}${esc(l.name)}</option>`).join('')}</select>
    <div class="row"><button onclick="wsCloseDialog()">Cancel</button><button class="pri" onclick="wsCreateLabel()">Create</button></div></div></div>`;
}
function composeHtml(){
  const c = W.compose, e = W.emails.find(x=>x.id===c.id), n = nm(e.from), fwd = c.mode==='forward';
  return `<div class="gm-compose-win"><div class="gm-cw-h">${fwd?'Fwd: ':'Re: '}${esc(e.subject)}<button onclick="wsCloseCompose()" title="Close">✕</button></div>
    <div class="gm-cw-row">To ${fwd ? `<input id="wsTo" placeholder="Who should handle this? (name / role)">` : `<input id="wsTo" value="${esc(n.name)}" readonly>`}</div>
    ${!fwd ? `<div class="gm-cw-row" style="font-size:12px;font-style:italic;">Reply in this sender’s style — acknowledge, clarify, give a timeline.</div>` : ''}
    <textarea id="wsNote" placeholder="${fwd ? 'Short handoff note: what you need and by when…' : 'Write your reply…'}"></textarea>
    <div class="gm-cw-foot"><button class="gm-send" onclick="wsSendCompose()">Send</button><span style="font-size:12px;color:#5f6368;">${fwd ? 'Forwarding = Delegate' : 'Replying now = Do'}</span></div></div>`;
}
/* ---------- actions ---------- */
function wsAct(ids, action, detail){
  ids = ids.filter(id=>!W.meta[id]); if(!ids.length) return;
  if(!W.startedAt) W.startedAt = Date.now();
  W.undo = ids.slice();
  ids.forEach(id=>{ W.meta[id] = {action, detail:detail||''}; W.read[id] = true; delete W.sel[id]; });
  if(W.open && ids.includes(W.open)) W.open = null;
  const d = WS_ACTIONS[action];
  snack((ids.length>1 ? `${ids.length} conversations ${d.verb.toLowerCase()}.` : d.done) + (action==='snooze' && detail ? ' until '+detail+'.' : ''), true, 7000);
  W.menu = null; W.compose = null;
  W.focus = Math.min(W.focus||0, Math.max(0, visible().length-1));
  wsSave(); draw();
}
function wsUndo(){ if(!W.undo) return; W.undo.forEach(id=>{ delete W.meta[id]; delete W.notes[id]; }); W.undo = null; snack('Action undone.', false, 3000); wsSave(); draw(); }
function wsToInbox(ids){ ids = ids || visible().filter(e=>W.sel[e.id]).map(e=>e.id); ids.forEach(id=>{ delete W.meta[id]; delete W.sel[id]; delete W.notes[id]; }); if(W.open && ids.includes(W.open)) W.open = null; snack(ids.length>1 ? `${ids.length} conversations moved to Inbox.` : 'Conversation moved to Inbox.'); wsSave(); draw(); }
function wsBulk(a){ const ids = visible().filter(e=>W.sel[e.id]).map(e=>e.id); if(ids.length) wsAct(ids, a); }
function wsOpen(id){ W.open = id; W.read[id] = true; W.menu = null; wsSave(); draw(); const s = document.getElementById('gmShell'); if(s) s.focus({preventScroll:true}); }
function wsBack(){ W.open = null; W.compose = null; draw(); }
function wsUnread(id){ delete W.read[id]; if(W.open===id) W.open = null; snack('Marked as unread.'); wsSave(); draw(); }
function wsFolder(f){ W.folder = f; W.open = null; W.sel = {}; W.focus = 0; W.menu = null; draw(); }
function wsSearch(v){ W.search = v; W.focus = 0; const main = document.querySelector('#wsZone .gm-main'); if(main && !W.open) main.innerHTML = listHtml(); }
function wsSelect(id, on){ if(on) W.sel[id] = true; else delete W.sel[id]; draw(); }
function wsSelectAll(on){ W.sel = {}; if(on) visible().forEach(e=>W.sel[e.id] = true); draw(); }
function wsSnoozeMenu(ids){ ids = ids || visible().filter(e=>W.sel[e.id]).map(e=>e.id); if(!ids.length) return; W.menu = {type:'snooze', ids}; draw(); }
function wsLabelMenu(ids){ ids = ids || visible().filter(e=>W.sel[e.id]).map(e=>e.id); if(!ids.length) return; W.menu = {type:'label', ids}; draw(); }
function wsCloseMenu(){ W.menu = null; draw(); }
function wsSnooze(label){ if(!W.menu) return; const o = WS_SNOOZE.find(x=>x[0]===label); wsAct(W.menu.ids, 'snooze', o ? o[1] : 'a date you picked'); }
function wsSetLabel(id){ if(!W.menu) return; const ids = W.menu.ids; ids.forEach(x=>{ if(id) W.lab[x] = id; else delete W.lab[x]; }); W.menu = null; snack(id ? `${ids.length>1 ? ids.length+' conversations' : 'Conversation'} labelled "${lblPath(id)}".` : 'Label removed.'); wsSave(); draw(); }
function wsNewLabel(fromMenu){ W.dialog = {applyTo: fromMenu && W.menu ? W.menu.ids : null}; W.menu = null; draw(); setTimeout(()=>{ const i = document.getElementById('wsLblName'); if(i) i.focus(); }, 30); }
function wsCloseDialog(){ W.dialog = null; draw(); }
function wsCreateLabel(){
  const name = ((document.getElementById('wsLblName')||{}).value||'').trim(), nest = (document.getElementById('wsLblNest')||{}).checked, parent = nest ? document.getElementById('wsLblParent').value : null;
  if(!name){ alert('Enter a label name.'); return; }
  if(lblKids(parent).some(l=>l.name.toLowerCase()===name.toLowerCase())){ alert('That label already exists here.'); return; }
  const pl = parent ? lbl(parent) : null, l = {id:'U'+Date.now().toString(36), name, parentId:parent||null, color: pl ? pl.color : WS_PALETTE[W.labels.length % WS_PALETTE.length]};
  W.labels.push(l); const apply = W.dialog && W.dialog.applyTo; W.dialog = null;
  if(apply){ W.menu = {type:'label', ids:apply}; wsSetLabel(l.id); } else { snack(`Label "${lblPath(l.id)}" created.`); wsSave(); draw(); }
}
function wsCompose(id, mode){ W.compose = {id, mode}; draw(); setTimeout(()=>{ const el = document.getElementById(mode==='forward' ? 'wsTo' : 'wsNote'); if(el) el.focus(); }, 30); }
function wsCloseCompose(){ W.compose = null; draw(); }
function wsFail(e, reason){ W.fail = {reason, redFlags:e.redFlags||[]}; W.compose = null; W.open = null; wsSave(); draw(); Sim.saveResult({simulator:'Email Workspace', scenario:W.pack.title, score:0, summary:'Failed — fell for the phishing email', details:{reason}}); }
function wsPhishClick(id){ const e = W.emails.find(x=>x.id===id); if(e) wsFail(e, `You clicked the link in "${e.subject}" — a simulated phishing email. In real life this could have installed malware or handed over credentials or client funds.`); }
function wsSendCompose(){
  const c = W.compose; if(!c) return;
  const to = (document.getElementById('wsTo')||{}).value||'', note = (document.getElementById('wsNote')||{}).value||'';
  if(c.mode==='forward' && !to.trim()){ alert('Add who you’re forwarding it to.'); return; }
  if(note.trim().length < 3){ alert(c.mode==='forward' ? 'Add a short handoff note.' : 'Write your reply first.'); return; }
  const e = W.emails.find(x=>x.id===c.id);
  if(e && e.phishing && WS_SENSITIVE.test(note)){ wsFail(e, `Your reply to "${e.subject}" included sensitive information (account details, a password or similar) — exactly what the attacker wanted.`); return; }
  W.notes[c.id] = note.trim();
  wsAct([c.id], c.mode==='forward' ? 'forward' : 'reply', c.mode==='forward' ? to.trim() : '');
}
function wsRestart(){ const p = W.pack.id==='gen' ? {id:'gen', program:W.pack.program, title:W.pack.title, role:W.pack.role, labels:W.labels.filter(l=>!l.parentId && !String(l.id).startsWith('U')).map(l=>({name:l.name, color:l.color})), emails:W.emails} : EMAIL_PACKS[W.pack.id]; wsStart(p); }
function wsKeyDown(ev){
  const t = ev.target; if(t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return; if(W.dialog) return;
  const rows = visible(), cur = W.open || (rows[W.focus||0] && rows[W.focus||0].id), k = ev.key; let hit = true;
  if(k==='j'||k==='ArrowDown'){ if(W.open){ const i = rows.findIndex(e=>e.id===W.open); if(rows[i+1]) wsOpen(rows[i+1].id); } else { W.focus = Math.min((W.focus||0)+1, rows.length-1); draw(); } }
  else if(k==='k'||k==='ArrowUp'){ if(W.open){ const i = rows.findIndex(e=>e.id===W.open); if(i>0) wsOpen(rows[i-1].id); } else { W.focus = Math.max((W.focus||0)-1, 0); draw(); } }
  else if((k==='o'||k==='Enter') && !W.open && cur) wsOpen(cur);
  else if(k==='u'||k==='Escape'){ if(W.menu) wsCloseMenu(); else if(W.compose) wsCloseCompose(); else wsBack(); }
  else if(k==='z') wsUndo();
  else if(k==='x' && !W.open && cur) wsSelect(cur, !W.sel[cur]);
  else if(k==='l' && cur) wsLabelMenu([cur]);
  else if(cur && !W.meta[cur]){ if(k==='e') wsAct([cur],'archive'); else if(k==='#') wsAct([cur],'trash'); else if(k==='s') wsAct([cur],'star'); else if(k==='!') wsAct([cur],'report');
    else if(k==='b') wsSnoozeMenu([cur]); else if(k==='f') wsCompose(cur,'forward'); else if(k==='r') wsCompose(cur,'reply'); else hit = false; }
  else hit = false;
  if(hit){ ev.preventDefault(); ev.stopPropagation(); }
}
/* ---------- grading ---------- */
async function wsSubmit(){
  const total = W.emails.length;
  if(W.emails.some(e=>!W.meta[e.id])){ snack('Get to Inbox Zero first.'); draw(); return; }
  if(W.emails.some(e=>!W.lab[e.id])){ snack('Give every email a label first.'); draw(); return; }
  const out = document.getElementById('wsResult'); if(out) out.innerHTML = `<div class="sim-loading">Grading your filing, decisions, phishing handling and replies…</div>`;
  const filedOk = W.emails.filter(e=>lblChain(W.lab[e.id]).map(s=>s.toLowerCase()).includes(String(e.label).toLowerCase()));
  const filing = Math.round(filedOk.length/total*100);
  const ph = W.emails.filter(e=>e.phishing);
  const security = ph.length ? Math.round(ph.reduce((a,e)=>a+(W.meta[e.id].action==='report'?100:60),0)/ph.length) : 100;
  const decided = (e)=> WS_ACTIONS[W.meta[e.id].action].d;
  const triageOk = W.emails.filter(e=>decided(e)===e.decision);
  const triage = Math.round(triageOk.length/total*100);
  const needs = W.emails.filter(e=>e.needsReply);
  let writing = null, wr = null;
  if(needs.length){
    const replies = needs.map(e=>`--- Email from ${e.from} ---\nSubject: ${e.subject}\n${e.body}\n\nTrainee's reply:\n${W.meta[e.id].action==='reply' ? W.notes[e.id] : '(no reply sent — handled another way)'}`).join('\n\n');
    try{
      wr = await Sim.ai({ system:'You are an experienced legal-support trainer grading written replies. Be fair, specific and encouraging; frame gaps as "not yet — here is the better way".',
        messages:[{role:'user', text:`Context: ${W.pack.role}\n\nGrade these replies for (1) matching each sender's tone and style, (2) acknowledging, clarifying and giving a timeline, (3) accuracy and staying within the trainee's authority (no legal advice or promises), (4) professionalism. A missing reply to an email that needed one is a significant gap.\n\n${replies}\n\nReturn ONLY JSON: {"score":0-100,"strengths":["…"],"improve":["concrete next step","…"],"perEmail":[{"subject":"…","note":"one line"}]}`}], json:true, maxTokens:900 });
      writing = Math.max(0, Math.min(100, Math.round(+wr.score||0)));
    }catch(err){ wr = {error: err.message}; }
  }
  const parts = [filing, security, triage].concat(writing!=null ? [writing] : []);
  const overall = Math.round(parts.reduce((a,b)=>a+b,0)/parts.length);
  const secs = W.startedAt ? Math.round((Date.now()-W.startedAt)/1000) : 0;
  const misfiled = W.emails.filter(e=>!filedOk.includes(e)), mism = W.emails.filter(e=>!triageOk.includes(e));
  W.result = `<div class="sim-card"><div class="gm-tiles"><div class="all"><b>${overall}%</b><span>Overall</span></div><div><b>${filing}%</b><span>Filing</span></div><div><b>${security}%</b><span>Security</span></div><div><b>${triage}%</b><span>Triage</span></div><div><b>${writing!=null ? writing+'%' : '—'}</b><span>Reply writing</span></div></div>
    <p class="sim-muted" style="font-size:13px;margin:0 0 10px;">${secs ? `Inbox Zero in ${Math.floor(secs/60)}m ${secs%60}s. ` : ''}A custom sub-label counts as correct filing when it’s nested under the right label.</p>
    ${misfiled.length ? `<b>Filing to revisit</b>${misfiled.map(e=>`<div class="gm-res-row"><b>${esc(e.subject)}</b><span>You: ${esc(lblPath(W.lab[e.id]))} · Expected under: <b>${esc(e.label)}</b></span></div>`).join('')}` : ''}
    ${mism.length ? `<b style="display:block;margin-top:12px;">Decisions to revisit</b>${mism.map(e=>`<div class="gm-res-row"><b>${esc(e.subject)}</b><span>You: ${esc(WS_ACTIONS[W.meta[e.id].action].verb)} → ${esc(WS_DECISION[decided(e)])} · Expected: <b>${esc(WS_DECISION[e.decision])}</b></span></div>`).join('')}` : ''}
    ${wr && !wr.error ? `<div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:14px;"><div><b>Replies — what worked</b><ul>${(wr.strengths||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div><b>Replies — not yet</b><ul>${(wr.improve||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></div>${(wr.perEmail||[]).length ? `<ul style="font-size:13.5px;">${wr.perEmail.map(p=>`<li><b>${esc(p.subject)}:</b> ${esc(p.note)}</li>`).join('')}</ul>` : ''}` : (wr && wr.error ? `<div class="sim-error" style="margin-top:12px;">Couldn’t grade the replies (${esc(wr.error)}) — the other scores still count.</div>` : '')}
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;"><button class="sim-btn orange" onclick="wsRestart()">↻ Run this inbox again</button><button class="sim-btn ghost" onclick="W={phase:'pick'};wsSave();render()">Choose another inbox</button><a class="sim-btn ghost" href="/simulators.html">All simulators</a></div></div>`;
  wsSave(); draw();
  const r = document.getElementById('wsResult'); if(r) r.scrollIntoView({behavior:'smooth', block:'start'});
  Sim.saveResult({simulator:'Email Workspace', scenario:W.pack.title, score:overall, summary:`Filing ${filing}% · Security ${security}% · Triage ${triage}%${writing!=null?` · Replies ${writing}%`:''}`, details:{filing, security, triage, writing, secs, labels:W.labels.map(l=>lblPath(l.id))}});
}
document.addEventListener('click', (e)=>{ if(W.menu && !e.target.closest('.gm-menu') && !e.target.closest('.gm-ib') && !e.target.closest('.gm-dialog')){ W.menu = null; draw(); } });
document.addEventListener('DOMContentLoaded', ()=>{ document.getElementById('topbar').innerHTML = Sim.topbar('email'); render(); });

/* ============================================================
   Calendaring Simulators: the tracks, the weeks and the automated review (no page code here, so it can be tested
   with node). Loaded before js/ft-calendar.js, which is the drag-and-drop page.
     • Times are minutes from midnight (Eastern Time); days are 0 (Mon) to 4 (Fri); the grid works in 15-minute steps.
     • Three tracks, each a set up like a Google Calendar: Standard Training (the Foundational / Calendar Management
       weeks), Litigation Week (Case Management) and Executive Week (EA / PA). A week has the attorney's (or executive's)
       fixed events and the tasks the trainee must put on the calendar.
     • The trainee's events are {id, title, day, start, dur, desc, meet, remind, guests}: a title, a description, Google
       Meet for video calls, an email reminder a day before, and guests, as in Google Calendar.
     • review() is the automated review: it matches the events to the tasks by their names, then checks every task
       against the attorney's rules (days, time window, before/after an event, travel buffer, 15-minute gap between
       events, and the details a task calls for: description, Google Meet, email reminder). Scored out of 100,
       80% passes. A trainer's manual feedback comes on top.
   ============================================================ */
(function(root){
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const OPEN = 9 * 60, CLOSE = 17 * 60, STEP = 15, MAXEV = 60, PASS = 80;
const t = (h, m) => h * 60 + (m || 0);
function fmt(min){ const h = Math.floor(min / 60), m = min % 60; return (h % 12 || 12) + (m ? ":" + String(m).padStart(2, "0") : "") + (h < 12 ? " AM" : " PM"); }
const lunch = [0, 1, 2, 3, 4].map(d => ({id:"lunch" + d, title:"Lunch (out of office)", day:d, start:t(12), end:t(13), kind:"lunch"}));

const TRACKS = [
  {id:"standard", icon:"🎓", title:"Standard Training", where:"Foundational · Calendar Management", blurb:"The attorney’s calendar in a Google Calendar look-alike: book each task under the attorney’s rules (title, description, Google Meet for video calls, an email reminder a day before, Eastern time, 15-minute gaps), then check the calendar."},
  {id:"litigation", icon:"⚖️", title:"Litigation Week", where:"Case Management", blurb:"A litigation attorney’s week: a deposition, a hearing and a mediation are fixed, and the prep, debrief, client and expert calls have to fall in the right order around them."},
  {id:"executive", icon:"🏢", title:"Executive Week", where:"EA / PA", blurb:"An executive’s week: a board meeting, an investor call, an offsite visit and an all-hands are fixed. Protect prep and focus time, book the interviews and meetings, and keep every gap."}
];

const SCENARIOS = [
  {id:"rivera", track:"standard", short:"Standard · Week 1", title:"Week 1 · Attorney Rivera", level:"Core", gap:15,
   brief:"Attorney Rivera’s week already has a hearing, a mediation, a deposition and two meetings. Build the calendar: add each task below as an event (drag on an empty part of the week), keep clear of the fixed events, lunch and travel time, leave 15 minutes between events, and follow each task’s notes. Give every event a description, add Google Meet and the email reminder where the task asks for them, then submit it to your trainer.",
   fixed:[
    {id:"review", title:"Weekly case review", day:0, start:t(9), end:t(9, 30), kind:"fixed"},
    {id:"hearing", title:"Court hearing: Smith v. Allied", day:1, start:t(9, 30), end:t(12), kind:"court", buffer:30, note:"Travel: keep 30 minutes free before and after."},
    {id:"mediation", title:"Mediation: Garcia", day:2, start:t(13), end:t(15), kind:"fixed"},
    {id:"depo", title:"Deposition: Wilson", day:3, start:t(10), end:t(11), kind:"fixed"},
    {id:"firm", title:"Firm meeting", day:4, start:t(15), end:t(16), kind:"fixed"}
   ].concat(lunch),
   tasks:[
    {id:"medprep", title:"Mediation prep: Garcia", dur:60, weight:15, rules:{beforeEvent:{id:"mediation", gap:30}}, note:"Finish at least 30 minutes before the Garcia mediation on Wednesday."},
    {id:"deposprep", title:"Deposition prep: Wilson", dur:90, weight:15, rules:{beforeDay:3}, note:"Has to happen before the day of the Wilson deposition (Thursday)."},
    {id:"consult", title:"New client consultation: Thompson", dur:60, weight:15, rules:{days:[0, 1, 2], from:t(13)}, needs:{remind:true}, note:"Mr. Thompson works mornings: afternoons only. He can come in Monday to Wednesday. Set the email reminder for the day before."},
    {id:"adjuster", title:"Settlement call: adjuster", dur:30, weight:10, rules:{days:[1, 2, 3], from:t(14), to:t(16)}, needs:{meet:true}, note:"The adjuster takes calls Tuesday to Thursday, 2:00 to 4:00 PM only. It’s a video call: add Google Meet."},
    {id:"records", title:"Medical records review block", dur:60, weight:10, rules:{from:t(9), to:t(12)}, note:"Attorney reviews records in the morning, before lunch."},
    {id:"urgent", title:"Urgent call: Garcia", dur:30, weight:15, rules:{days:[0, 1]}, note:"Client called in upset. The attorney promised a call within two days: Monday or Tuesday."},
    {id:"strategy", title:"Case strategy meeting with paralegal", dur:60, weight:10, rules:{days:[1, 2, 3]}, note:"The paralegal is only in Tuesday to Thursday."},
    {id:"courthouse", title:"Client signing at the courthouse: Park", dur:45, weight:10, rules:{buffer:30}, note:"Off site: leave 30 minutes free before and after for travel."}
   ]},
  {id:"chen", track:"standard", short:"Standard · Week 2", title:"Week 2 · Attorney Chen (trial week)", level:"Advanced", gap:15,
   brief:"A heavier week: a deposition, a motion hearing and a mediation are fixed, and the prep and client items have to fit around them in the right order. Prep always goes before the event it prepares for. Leave 15 minutes between events, fill in each event’s details, and submit the calendar to your trainer.",
   fixed:[
    {id:"intake", title:"Intake review", day:0, start:t(9), end:t(10), kind:"fixed"},
    {id:"depo", title:"Deposition: Lopez", day:1, start:t(10), end:t(12), kind:"fixed"},
    {id:"motion", title:"Motion hearing", day:2, start:t(10), end:t(11, 30), kind:"court", buffer:30, note:"Travel: keep 30 minutes free before and after."},
    {id:"trial", title:"Trial prep block (protected)", day:3, start:t(13), end:t(17), kind:"fixed"},
    {id:"mediation", title:"Mediation: Reyes", day:4, start:t(9), end:t(11), kind:"fixed"}
   ].concat(lunch),
   tasks:[
    {id:"deposprep", title:"Deposition prep: Lopez", dur:120, weight:20, rules:{beforeEvent:{id:"depo", gap:0}}, note:"Finish before the Lopez deposition starts on Tuesday."},
    {id:"hearprep", title:"Motion hearing prep", dur:60, weight:20, rules:{beforeEvent:{id:"motion", gap:30}}, note:"Done at least 30 minutes before the hearing on Wednesday (the attorney can’t start before 9:00)."},
    {id:"medprep", title:"Mediation prep: Reyes", dur:90, weight:15, rules:{beforeDay:4}, note:"Has to happen before Friday, so the client can review the numbers."},
    {id:"expert", title:"Expert consult", dur:60, weight:15, rules:{days:[2, 3], from:t(13), to:t(16)}, needs:{meet:true}, note:"The expert is free Wednesday or Thursday, 1:00 to 4:00 PM. Video call: add Google Meet."},
    {id:"clientcall", title:"Client call: Reyes", dur:30, weight:15, rules:{days:[0, 3], from:t(13)}, needs:{meet:true, remind:true}, note:"Reyes can only talk Monday or Thursday afternoons. Video call with an email reminder the day before."},
    {id:"demand", title:"Demand letter review", dur:30, weight:15, rules:{days:[0, 1, 2]}, note:"Needs to go out by Wednesday: schedule it Monday to Wednesday."}
   ]},
  {id:"litigation", track:"litigation", short:"Litigation Week", title:"Litigation Week · Case Management", level:"Litigation", gap:15,
   brief:"Attorney Okafor is in litigation this week: the Nguyen deposition, a motion to compel hearing and the Brooks mediation are fixed. Put the prep, the debrief, the client and the expert calls around them in the right order, with a 15-minute gap between events and the details each one needs. Then submit it to your trainer.",
   fixed:[
    {id:"team", title:"Litigation team meeting", day:0, start:t(9, 30), end:t(10, 30), kind:"fixed"},
    {id:"depo", title:"Deposition: Nguyen", day:1, start:t(10), end:t(12), kind:"fixed"},
    {id:"hearing", title:"Court: motion to compel hearing", day:2, start:t(9), end:t(11), kind:"court", buffer:30, note:"Travel: keep 30 minutes free before and after."},
    {id:"mediation", title:"Mediation: Brooks", day:3, start:t(14), end:t(16), kind:"fixed"},
    {id:"review", title:"Friday case review", day:4, start:t(9), end:t(10), kind:"fixed"}
   ].concat(lunch),
   tasks:[
    {id:"deposprep", title:"Deposition prep: Nguyen", dur:90, weight:15, rules:{beforeEvent:{id:"depo", gap:15}}, note:"Finish before the Nguyen deposition starts on Tuesday: Monday is the only day."},
    {id:"hearprep", title:"Motion to compel hearing prep", dur:60, weight:15, rules:{beforeEvent:{id:"hearing", gap:30}}, note:"Done at least 30 minutes before the Wednesday hearing (the attorney can’t start before 9:00)."},
    {id:"debrief", title:"Hearing debrief", dur:30, weight:10, rules:{afterEvent:{id:"hearing", gap:30}, days:[2]}, note:"The same day as the hearing, at least 30 minutes after it ends (travel back)."},
    {id:"clientcall", title:"Client call: Brooks", dur:45, weight:15, rules:{days:[0, 1, 2], from:t(13)}, needs:{meet:true, remind:true}, note:"Ms. Brooks is only free Monday to Wednesday afternoons. Video call with an email reminder the day before."},
    {id:"medprep", title:"Mediation prep: Brooks", dur:90, weight:15, rules:{beforeEvent:{id:"mediation", gap:15}}, note:"Finish before the Thursday mediation, with a 15-minute gap."},
    {id:"expert", title:"Expert witness call: Dr. Patel", dur:30, weight:10, rules:{days:[2, 3], from:t(13), to:t(16)}, needs:{meet:true}, note:"Dr. Patel is free Wednesday or Thursday afternoons, 1:00 to 4:00 PM. Video call: add Google Meet."},
    {id:"discovery", title:"Discovery responses review", dur:60, weight:10, rules:{beforeDay:4}, note:"The responses are due Friday: finish before Friday."},
    {id:"sol", title:"Statute of limitations check: Hale file", dur:30, weight:10, rules:{from:t(9), to:t(12)}, note:"Morning, before lunch: the attorney reads dates when fresh."}
   ]},
  {id:"executive", track:"executive", short:"Executive Week", title:"Executive Week · EA / PA", level:"Executive", gap:15,
   brief:"You support Ms. Alvarez, the CEO. The board meeting, the investor call, the offsite client visit and the all-hands are fixed. Protect prep and focus time, book the interviews and meetings she has asked for, keep 15 minutes between events, and fill in each event’s details. Then submit the calendar to your trainer.",
   fixed:[
    {id:"standup", title:"Leadership stand-up", day:0, start:t(9), end:t(10), kind:"fixed"},
    {id:"board", title:"Board meeting", day:1, start:t(9), end:t(12), kind:"fixed"},
    {id:"investor", title:"Investor call", day:2, start:t(14), end:t(15, 30), kind:"fixed"},
    {id:"offsite", title:"Offsite: client site visit", day:3, start:t(10), end:t(12), kind:"court", buffer:30, note:"Travel: keep 30 minutes free before and after."},
    {id:"allhands", title:"All-hands", day:4, start:t(11), end:t(12), kind:"fixed"}
   ].concat(lunch),
   tasks:[
    {id:"boardprep", title:"Board meeting prep", dur:90, weight:20, rules:{beforeEvent:{id:"board", gap:15}}, note:"Finish before the Tuesday board meeting, with a 15-minute gap."},
    {id:"cfo", title:"1:1 with the CFO", dur:45, weight:10, rules:{days:[0, 2]}, note:"The CFO is only available Monday and Wednesday."},
    {id:"investorprep", title:"Investor call prep", dur:30, weight:10, rules:{beforeEvent:{id:"investor", gap:15}}, note:"Done at least 15 minutes before the Wednesday investor call."},
    {id:"interview", title:"VP Marketing candidate interview", dur:60, weight:15, rules:{days:[3, 4], from:t(13)}, needs:{meet:true, remind:true}, note:"The candidate is free Thursday or Friday afternoons. Video interview: add Google Meet and the email reminder for the day before."},
    {id:"qreview", title:"Quarterly review with Ops team", dur:90, weight:10, rules:{days:[2, 4], from:t(9), to:t(12)}, note:"Wednesday or Friday morning, finished before lunch."},
    {id:"press", title:"Press interview", dur:30, weight:10, rules:{days:[1, 2, 3], from:t(14), to:t(16)}, needs:{meet:true, remind:true}, note:"The reporter can do Tuesday to Thursday, 2:00 to 4:00 PM. Video call with an email reminder the day before."},
    {id:"focus", title:"Executive focus time", dur:120, weight:10, rules:{from:t(9), to:t(12)}, note:"A protected two-hour block in the morning, with no meetings."},
    {id:"debrief", title:"Offsite debrief with Chief of Staff", dur:30, weight:15, rules:{afterEvent:{id:"offsite", gap:30}}, note:"After the Thursday offsite visit, at least 30 minutes after it ends (Thursday or Friday)."}
   ]}
];
const trackOf = id => TRACKS.find(x => x.id === id);

const overlap = (a, b, pad) => a.day === b.day && a.start < b.end + pad && b.start < a.end + pad;
const endOf = ev => ev.start + ev.dur;
// Space an event needs around another: its travel buffer, or the week's gap (none around lunch).
const padFor = (scn, o) => Math.max(o.buffer || 0, o.kind === "lunch" ? 0 : (scn.gap || 0));
const nearWhy = (scn, o) => o.buffer ? `Too close to “${o.title}”: it needs ${o.buffer} minutes of travel time.` : `Too close to “${o.title}”: leave ${scn.gap} minutes between events.`;

function all(scn, events){
  return scn.fixed.map(f => ({id:f.id, title:f.title, day:f.day, start:f.start, end:f.end, buffer:f.buffer || 0, kind:f.kind, fixed:true}))
    .concat((events || []).map(x => ({id:x.id, title:x.title, day:x.day, start:x.start, end:endOf(x), buffer:0, kind:"mine", fixed:false})));
}
function flags(scn, events){
  const evs = all(scn, events), out = {};
  (events || []).forEach(x => {
    const me = evs.find(e => e.id === x.id), why = [];
    const hit = evs.find(o => o.id !== x.id && overlap(me, o, 0));
    const near = !hit && evs.find(o => o.id !== x.id && padFor(scn, o) && overlap(me, o, padFor(scn, o)));
    if(hit) why.push(`Overlaps “${hit.title}”`); else if(near) why.push(nearWhy(scn, near));
    if(me.start < OPEN || me.end > CLOSE) why.push("Outside business hours (9:00 AM to 5:00 PM)");
    if(why.length) out[x.id] = why;
  });
  return out;
}
// Saved events are checked before they're used: whole slots, inside the grid, sane text, a sane count.
function clean(events){
  const seen = {};
  return (Array.isArray(events) ? events : []).filter(x => x && typeof x === "object" && typeof x.id === "string" && !seen[x.id] && (seen[x.id] = 1)
    && Number.isInteger(x.day) && x.day >= 0 && x.day <= 4 && Number.isInteger(x.start) && x.start % STEP === 0 && x.start >= t(8)
    && Number.isInteger(x.dur) && x.dur >= STEP && x.dur % STEP === 0 && x.start + x.dur <= t(18))
    .slice(0, MAXEV).map(x => ({id:x.id.slice(0, 24), title:String(x.title || "").slice(0, 80), day:x.day, start:x.start, dur:x.dur,
      desc:String(x.desc || "").slice(0, 300), guests:String(x.guests || "").slice(0, 200), meet:!!x.meet, remind:!!x.remind}));
}

/* ---------- the automated review ---------- */
const STOP = new Set(["the", "a", "an", "with", "for", "of", "and", "to", "at", "on", "in", "call", "meeting"]);
const words = x => String(x || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(w => w && !STOP.has(w));
// How well an event's name fits a task's: the share of the task's words the name has (a word counts if one starts the other).
function fit(task, title){
  const a = words(task.title), b = words(title); if(!a.length || !b.length) return 0;
  return a.filter(w => b.some(v => v === w || (w.length > 3 && v.length > 3 && (v.startsWith(w) || w.startsWith(v))))).length / a.length;
}
// Each task takes the best-fitting event not already taken (at least 60% of its words).
function match(scn, events){
  const used = {}, out = {}, pairs = [];
  scn.tasks.forEach(k => events.forEach(x => { const f = fit(k, x.title); if(f >= 0.6) pairs.push({k, x, f}); }));
  pairs.sort((p, q) => q.f - p.f);
  pairs.forEach(p => { if(!out[p.k.id] && !used[p.x.id]){ out[p.k.id] = p.x; used[p.x.id] = 1; } });
  return out;
}
function checks(scn, k, x, evs){
  const r = k.rules || {}, nd = k.needs || {}, out = [], add = (ok, label, why) => out.push({ok:!!ok, label, why:ok ? "" : why});
  if(!x){ add(false, "On the calendar", "Not found on your calendar. Name the event after the task so it can be matched (for example “" + k.title + "”)."); return out; }
  add(true, "On the calendar", "");
  const me = {id:x.id, day:x.day, start:x.start, end:x.start + x.dur}, others = evs.filter(o => o.id !== x.id);
  const hit = others.find(o => overlap(me, o, 0)), near = !hit && others.find(o => padFor(scn, o) && overlap(me, o, padFor(scn, o)));
  add(!hit && !near, "No conflict", hit ? `Overlaps “${hit.title}” on ${DAYS[hit.day]}.` : near ? nearWhy(scn, near) : "");
  add(me.start >= OPEN && me.end <= CLOSE, "Business hours (9:00 AM to 5:00 PM)", `Runs ${fmt(me.start)} to ${fmt(me.end)}, outside business hours.`);
  add(x.dur >= k.dur, "Long enough", `Booked for ${x.dur} minutes; this needs ${k.dur}.`);
  add(String(x.desc || "").trim().length >= 5, "Description added", "Add a description to the event (what it is for, who is involved).");
  if(nd.meet) add(x.meet, "Google Meet added", "This is a video call: add Google Meet to the event.");
  if(nd.remind) add(x.remind, "Email reminder a day before", "Set an email notification 1 day before the event.");
  if(r.days) add(r.days.includes(x.day), "Right day", `Not on ${DAYS[x.day]}: this one works ${r.days.map(d => DAYS[d].slice(0, 3)).join(", ")}.`);
  if(r.from != null || r.to != null){ const lo = r.from != null ? r.from : OPEN, hi = r.to != null ? r.to : CLOSE; add(me.start >= lo && me.end <= hi, "Right time of day", `Must fall between ${fmt(lo)} and ${fmt(hi)}.`); }
  if(r.beforeEvent){ const ev = scn.fixed.find(f => f.id === r.beforeEvent.id), gap = r.beforeEvent.gap || 0;
    add(ev && (x.day < ev.day || (x.day === ev.day && me.end + gap <= ev.start)), `Before “${ev ? ev.title : ""}”`, `Must finish${gap ? " " + gap + " minutes" : ""} before “${ev ? ev.title : ""}” (${ev ? DAYS[ev.day] + " " + fmt(ev.start) : ""}).`); }
  if(r.afterEvent){ const ev = scn.fixed.find(f => f.id === r.afterEvent.id), gap = r.afterEvent.gap || 0;
    add(ev && (x.day > ev.day || (x.day === ev.day && me.start >= ev.end + gap)), `After “${ev ? ev.title : ""}”`, `Must start${gap ? " at least " + gap + " minutes" : ""} after “${ev ? ev.title : ""}” ends (${ev ? DAYS[ev.day] + " " + fmt(ev.end) : ""}).`); }
  if(r.beforeDay != null) add(x.day < r.beforeDay, "Early enough", `Must be before ${DAYS[r.beforeDay]}.`);
  if(r.buffer){ const tight = others.find(o => overlap(me, o, r.buffer)); add(!tight, `${r.buffer}-minute travel buffer`, tight ? `Within ${r.buffer} minutes of “${tight.title}”.` : ""); }
  return out;
}
// The automated review of a calendar: {score, max, pct, passed, items:[{id, title, weight, pts, perfect, found, event, checks}], extras:[events with no task]}
function review(scn, events){
  events = clean(events);
  const evs = all(scn, events), m = match(scn, events), taken = {};
  let got = 0, max = 0;
  const items = scn.tasks.map(k => {
    const x = m[k.id]; if(x) taken[x.id] = 1;
    const cs = checks(scn, k, x, evs), pass = cs.filter(c => c.ok).length, pts = Math.round(k.weight * pass / cs.length * 10) / 10;
    got += pts; max += k.weight;
    return {id:k.id, title:k.title, weight:k.weight, pts, perfect:pass === cs.length, found:!!x, event:x || null, checks:cs};
  });
  const fl = flags(scn, events);
  const extras = events.filter(x => !taken[x.id]).map(x => ({title:x.title, day:x.day, start:x.start, why:fl[x.id] || []}));
  const pct = max ? Math.round(got / max * 100) : 0;
  return {score:Math.round(got), max, pct, passed:pct >= PASS, items, extras, done:items.filter(i => i.perfect).length};
}

const api = {DAYS, OPEN, CLOSE, STEP, MAXEV, PASS, TRACKS, SCENARIOS, trackOf, fmt, overlap, endOf, all, flags, clean, match, review};
if(typeof module !== "undefined" && module.exports) module.exports = api; else root.FTCalCore = api;
})(typeof window !== "undefined" ? window : globalThis);

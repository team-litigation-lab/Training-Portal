/* ============================================================
   Calendaring Simulators: the tracks, the weeks and the automated review (no page code here, so it can be tested
   with node). Loaded before js/ft-calendar.js, which is the drag-and-drop page.
     • Times are minutes from midnight (Eastern Time); days are 0 (Mon) to 4 (Fri); the grid works in 15-minute steps.
     • One track, set up like a Google Calendar: Standard Training (the Foundational / Calendar Management weeks).
       A week has the attorney's fixed events and the tasks the trainee must put on the calendar.
     • The trainee's events are {id, title, day, start, dur, desc, meet, remind, guests, color}: a title, a description,
       Google Meet for video calls, an email reminder a day before, guests and a color (Google Calendar's eleven event
       colors; "" is the calendar's default), as in Google Calendar.
     • The attorney's color rule (COLOR_RULE): an event is colored by how long it is: 30 minutes Tangerine, 45 minutes
       Blueberry, 1 hour Tomato. The trainee picks the color; the review checks it.
     • review() is the automated review: it matches the events to the tasks by their names, then checks every task
       against the attorney's rules (days, time window, before/after an event, travel buffer, 15-minute gap between
       events, and the details a task calls for: description, Google Meet, email reminder, the color rule). Scored out of 100,
       80% passes. A trainer's manual feedback comes on top.
     • A second track, 🗓 Attorney Calendar Management Activity (Day 5; its scenario has kind:"activity"), is the attorney's
       own Google Calendar in Seattle (Pacific Time), July 6–15, 2026: the trainee creates every event (no fixed events) with
       Google Calendar's fields (date, start/end, the event's own time zone, location, guests, description, color, reminders).
       It has no answer key of its own: review() grades the calendar THROUGH the 📅 Calendar Activity Check (window.FTCalCheck,
       js/ft-calcheck.js: its key, check, checkAll and score), so the simulator and the Check agree field by field; only the
       colour, overlaps and duplicates are the simulator's own. flags(), review() and cleanFor() hand an activity scenario to
       the activity's own code (api.act); the Standard weeks are unchanged.
   ============================================================ */
(function(root){
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const OPEN = 9 * 60, CLOSE = 17 * 60, STEP = 15, MAXEV = 60, PASS = 80;
const t = (h, m) => h * 60 + (m || 0);
function fmt(min){ const h = Math.floor(min / 60), m = min % 60; return (h % 12 || 12) + (m ? ":" + String(m).padStart(2, "0") : "") + (h < 12 ? " AM" : " PM"); }
// Google Calendar's event colors (name, fill and the darker left edge). An event's `color` is one of these ids or "" (the default).
const COLORS = [
  {id:"tomato", name:"Tomato", hex:"#d50000", edge:"#9b0000"},
  {id:"flamingo", name:"Flamingo", hex:"#e67c73", edge:"#b35a52"},
  {id:"tangerine", name:"Tangerine", hex:"#f4511e", edge:"#b83a12"},
  {id:"banana", name:"Banana", hex:"#f6bf26", edge:"#b98f14"},
  {id:"sage", name:"Sage", hex:"#33b679", edge:"#23875a"},
  {id:"basil", name:"Basil", hex:"#0b8043", edge:"#075a2f"},
  {id:"peacock", name:"Peacock", hex:"#039be5", edge:"#0277bd"},
  {id:"blueberry", name:"Blueberry", hex:"#3f51b5", edge:"#283593"},
  {id:"lavender", name:"Lavender", hex:"#7986cb", edge:"#5c6bc0"},
  {id:"grape", name:"Grape", hex:"#8e24aa", edge:"#6a1b7f"},
  {id:"graphite", name:"Graphite", hex:"#616161", edge:"#424242"}
];
const colorOf = id => COLORS.find(c => c.id === id) || null;
// The attorney's color rule: the color an event must have for its length (no rule for other lengths).
const COLOR_RULE = {30:"tangerine", 45:"blueberry", 60:"tomato"};
const COLOR_RULE_TEXT = "Color each event by how long it is: 30 minutes Tangerine, 45 minutes Blueberry, 1 hour Tomato.";
const colorFor = dur => COLOR_RULE[dur] || null;
const lunch = [0, 1, 2, 3, 4].map(d => ({id:"lunch" + d, title:"Lunch (out of office)", day:d, start:t(12), end:t(13), kind:"lunch"}));

const TRACKS = [
  {id:"standard", icon:"🎓", title:"Standard Training", where:"Foundational · Calendar Management", blurb:"The attorney’s calendar in a Google Calendar look-alike: book each task under the attorney’s rules (title, description, Google Meet for video calls, an email reminder a day before, Eastern time, 15-minute gaps), then check the calendar."},
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
  if(isAct(scn)) return act.flags(scn, events);
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
      desc:String(x.desc || "").slice(0, 300), guests:String(x.guests || "").slice(0, 200), meet:!!x.meet, remind:!!x.remind, color:colorOf(x.color) ? x.color : ""}));
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
  // The attorney's color rule goes by the event's length as booked (or the task's, when the booked length has no rule).
  const len = colorFor(x.dur) ? x.dur : k.dur, want = colorOf(colorFor(len));
  if(want){ const have = colorOf(x.color); add(x.color === want.id, "Right color for its length", `${have ? have.name : "The default color"} on a ${x.dur}-minute event${x.dur === len ? "" : " (a " + len + "-minute task)"}: it should be ${want.name}. ${COLOR_RULE_TEXT}`); }
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
  if(isAct(scn)) return act.review(scn, events);
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

/* ============================================================
   🗓 Attorney Calendar Management Activity (Day 5): the attorney's own Google Calendar, ten weekdays from a Monday (the
   anchor): the activity's own dates, July 6–15, 2026, moved by whole weeks to the batch's Day 5 week (see THE ANCHOR below).
   The attorney is in Seattle: the calendar shows Pacific Time (America/Los_Angeles). The trainee creates every event.
   An event: {id, title, date:"YYYY-MM-DD", allDay, span (all-day: how many days), start, dur (minutes, in the EVENT'S OWN
              time zone), tz (a TZS id), loc, guests:[emails], desc, meet, color, reminders:[{type:"notification"|"email", n, unit}]}
   ============================================================ */
const isAct = scn => !!scn && scn.kind === "activity";
const act = (() => {
// The event's own time zone: the 📅 Calendar Activity Check's list (FTCalCheck.zones, js/ft-calcheck.js), in the same order, so a
// zone the Check accepts can be picked here and the two agree (calsim-activity.cjs checks the ids match). PST / MST / CST / EST are
// US Pacific / Mountain / Central / Eastern Time; the Check also accepts Phoenix (MST all year), Regina and Panama. Offsets come
// from the time-zone data for each date: PST, MST, CST and EST name the US region, standard or daylight on the event's own date;
// `off` is the zone's summer offset (abbr() reads it to tell daylight from standard), used for the offset only without Intl.
const TZS = [
  {id:"America/Los_Angeles", short:"PST", dst:"PDT", name:"Pacific Time - Los Angeles", word:"Pacific", off:-420},
  {id:"America/Denver",      short:"MST", dst:"MDT", name:"Mountain Time - Denver",     word:"Mountain", off:-360},
  {id:"America/Phoenix",     short:"MST", dst:"MST", name:"Mountain Standard Time - Phoenix", word:"Mountain Standard", off:-420},
  {id:"America/Chicago",     short:"CST", dst:"CDT", name:"Central Time - Chicago",     word:"Central", off:-300},
  {id:"America/Regina",      short:"CST", dst:"CST", name:"Central Standard Time - Regina", word:"Central Standard", off:-360},
  {id:"America/New_York",    short:"EST", dst:"EDT", name:"Eastern Time - New York",    word:"Eastern", off:-240},
  {id:"America/Panama",      short:"EST", dst:"EST", name:"Eastern Standard Time - Panama", word:"Eastern Standard", off:-300},
  {id:"Pacific/Honolulu",    short:"HST", dst:"HST", name:"Hawaii-Aleutian Standard Time - Honolulu", word:"Hawaii", off:-600},
  {id:"America/Anchorage",   short:"AKST", dst:"AKDT", name:"Alaska Time - Anchorage",  word:"Alaska", off:-480},
  {id:"Asia/Manila",         short:"PHT", dst:"PHT", name:"Philippine Time - Manila",   word:"Philippine", off:480},
  {id:"Etc/UTC",             short:"UTC", dst:"UTC", name:"Coordinated Universal Time", word:"UTC", off:0},
  {id:"Europe/London",       short:"GMT", dst:"BST", name:"United Kingdom Time - London", word:"UK", off:60}
];
const CAL_TZ = "America/Los_Angeles";
const tzOf = id => TZS.find(z => z.id === id || z.short === id) || null;
/* THE ANCHOR: the calendar's day 0, a Monday. Two Monday-to-Sunday weeks are shown; the activity is days 0–9. The activity was
   written for Mon July 6, 2026 (BASE_FROM, the dates in its words and in the Check's key); a trainee's activity is moved by whole
   weeks (k) to the first Monday on or after their batch's Day 5 (anchorForBatch: the Batch ID is B + the start date, MMDDYY), so
   its weekdays and wall-clock times stay the activity's own. The anchor is kept in the trainee's calendar record
   (calsim:<id>.anchors["attorney-activity"], js/ft-calendar.js); a record from before (events or submissions, no anchor) keeps
   July 2026. Everything below reads FROM / BASE: setAnchor switches them (withAnchor for one trainee's record on a trainer's
   page, put back after). Without an anchor set, July 2026. */
const BASE_FROM = "2026-07-06", NDAYS = 14, LAST = 9, MAXEV = 40;
const isoMs = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const isIso = iso => /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) && new Date(isoMs(iso)).toISOString().slice(0, 10) === iso;
const isMonday = iso => isIso(iso) && new Date(isoMs(iso)).getUTCDay() === 1;
// an anchor the activity can take: a Monday, on or after the activity's own
const okAnchor = iso => isMonday(iso) && iso >= BASE_FROM;
const shiftIso = (iso, k) => new Date(isoMs(iso) + k * 7 * 864e5).toISOString().slice(0, 10);
let FROM = BASE_FROM, BASE = isoMs(FROM);
const weeksOf = iso => Math.round((isoMs(iso) - isoMs(BASE_FROM)) / (7 * 864e5));
const dIdx = iso => /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - BASE) / 864e5) : NaN;
const dIso = i => new Date(BASE + i * 864e5).toISOString().slice(0, 10);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dLabel = i => { const d = new Date(BASE + i * 864e5); return `${WD[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; };
const fmtE = m => m >= 1440 ? "12 AM" : fmt(m);
const range = (a, b) => `${fmtE(a)} – ${fmtE(b)}`;
// A zone's offset from UTC (minutes) at an instant (minutes from FROM 00:00 UTC), cached by the hour (the absolute hour, so the
// cache holds across anchors).
const FMTS = {}, OFFS = new Map();
function offAt(tz, abs){
  const z = tzOf(tz) || TZS[0], h = Math.floor(abs / 60), k = z.id + "|" + (BASE / 3600000 + h);
  let o = OFFS.get(k); if(o !== undefined) return o;
  o = z.off;
  try{
    const f = FMTS[z.id] || (FMTS[z.id] = new Intl.DateTimeFormat("en-US", {timeZone:z.id, hourCycle:"h23", year:"numeric", month:"numeric", day:"numeric", hour:"numeric", minute:"numeric"}));
    const ms = BASE + h * 3600000, p = {}; f.formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
    const v = Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - ms) / 60000); if(isFinite(v)) o = v;
  }catch(err){}
  OFFS.set(k, o); return o;
}
const abbr = (z, abs) => offAt(z.id, abs) === z.off ? z.dst : z.short;
const tzLabel = (z, abs) => { const o = offAt(z.id, abs || 0), a = Math.abs(o); return `(GMT${o < 0 ? "-" : "+"}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}) ${z.name}`; };
// Absolute minutes (UTC, from FROM 00:00 UTC) of a local date + time in a zone, and back.
function absAt(date, min, tz){ const l = dIdx(date) * 1440 + min, u = l - offAt(tz, l); return l - offAt(tz, u); }
function fromAbs(abs, tz){ const l = abs + offAt(tz, abs), d = Math.floor(l / 1440); return {day:d, date:dIso(d), start:l - d * 1440}; }
const evAbs = x => x.allDay ? {s:absAt(x.date, 0, CAL_TZ), e:absAt(dIso(dIdx(x.date) + (x.span || 1)), 0, CAL_TZ)} : (s => ({s, e:s + x.dur}))(absAt(x.date, x.start, x.tz));
// Where an event sits on the attorney's (Pacific) calendar.
function pacOf(x){ if(x.allDay) return {day:dIdx(x.date), start:0, end:1440, allDay:true, span:x.span || 1}; const a = evAbs(x), p = fromAbs(a.s, CAL_TZ); return {day:p.day, start:p.start, end:p.start + a.e - a.s}; }
// A spot on the Pacific calendar (a drag), in an event's own zone.
const fromPac = (day, start, tz) => fromAbs(absAt(dIso(day), start, CAL_TZ), tz);

// "July 6 to 19" / "Oct 26 to Nov 8": the calendar's days 0 to `last`, at the current anchor
const spanText = last => { const a = new Date(BASE), b = new Date(BASE + last * 864e5), M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return a.getUTCMonth() === b.getUTCMonth() ? `${M[a.getUTCMonth()]} ${a.getUTCDate()} to ${b.getUTCDate()}` : `${M[a.getUTCMonth()].slice(0, 3)} ${a.getUTCDate()} to ${M[b.getUTCMonth()].slice(0, 3)} ${b.getUTCDate()}`; };
const dYear = i => new Date(BASE + i * 864e5).getUTCFullYear();
function setAnchor(iso){
  iso = okAnchor(iso) ? iso : BASE_FROM;
  if(iso !== FROM){ FROM = iso; BASE = isoMs(iso); KL = null; TL = null; }
  return FROM;
}
// run fn at a record's anchor (a trainer's page shows many trainees), then put the anchor back, even if fn throws
function withAnchor(iso, fn){ const was = FROM; setAnchor(iso); try{ return fn(); } finally{ setAnchor(was); } }
// Pacific's calendar date of an instant (ms), as YYYY-MM-DD
const pacDate = ms => { try{ return new Intl.DateTimeFormat("en-CA", {timeZone:CAL_TZ, year:"numeric", month:"2-digit", day:"2-digit"}).format(new Date(ms)); }catch(err){ return new Date(ms - 8 * 3600000).toISOString().slice(0, 10); } };
// the first Monday on or after a date
const mondayOnOrAfter = iso => { const d = new Date(isoMs(iso)).getUTCDay(); return new Date(isoMs(iso) + ((8 - d) % 7) * 864e5).toISOString().slice(0, 10); };
// a batch's start date, from its ID (B + MMDDYY: B102826 → 2026-10-28), else null
const batchStart = batch => { const m = /^b(\d{2})(\d{2})(\d{2})$/i.exec(String(batch || "").trim()); const iso = m ? `20${m[3]}-${m[1]}-${m[2]}` : ""; return isIso(iso) ? iso : null; };
// the activity's anchor for a batch that starts on `start`: its Day 5 is the fifth weekday from the start (a weekend start
// counts from the Monday after), and the activity's Monday is the first on or after Day 5, so no item is in the past
function anchorForStart(start){
  let t = isoMs(start), n = 0;
  for(;;){ const d = new Date(t).getUTCDay(); if(d !== 0 && d !== 6 && ++n === 5) break; t += 864e5; }
  const a = mondayOnOrAfter(new Date(t).toISOString().slice(0, 10));
  return okAnchor(a) ? a : BASE_FROM;
}
const anchorForBatch = batch => { const s = batchStart(batch); return s ? anchorForStart(s) : null; };
// the dates a batch starting this week would get (a trainer's slides, a trainee with no Batch ID): from this week's Monday, Pacific
const anchorNow = nowMs => { const t = pacDate(nowMs == null ? Date.now() : nowMs), d = new Date(isoMs(t)).getUTCDay(); return anchorForStart(new Date(isoMs(t) - ((d + 6) % 7) * 864e5).toISOString().slice(0, 10)); };
// a calendar record's anchor: its own, else July 2026 for a record from before anchors (an activity draft or a submission),
// else null (none yet: ensureAnchor gives it one)
const SCN_ID = "attorney-activity";
function anchorOfRecord(rec){
  if(!rec || typeof rec !== "object") return null;
  const a = rec.anchors && rec.anchors[SCN_ID]; if(okAnchor(a)) return a;
  const draft = rec.drafts && rec.drafts[SCN_ID], subs = (rec.submissions || []).filter(x => x && x.scn === SCN_ID);
  return (Array.isArray(draft) ? draft.length : draft && (draft.events || []).length) || subs.length ? BASE_FROM : null;
}
// give a record its anchor if it has none (the caller saves it): {anchor, created}
function ensureAnchor(rec, batch, nowMs){
  const had = anchorOfRecord(rec); if(had) return {anchor:had, created:false};
  const a = anchorForBatch(batch) || anchorNow(nowMs);
  rec.anchors = Object.assign({}, rec.anchors, {[SCN_ID]:a});
  return {anchor:a, created:true};
}
// "July 06, 2026" in a text, moved by k weeks ("Month DD, YYYY", the activity's own form; nothing else is touched)
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = iso => `${MONTHS_LONG[+iso.slice(5, 7) - 1]} ${iso.slice(8, 10)}, ${iso.slice(0, 4)}`;
function rewriteDates(text, k){
  if(!k) return String(text);
  return String(text).replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December) (\d{2}), (\d{4})\b/g, (all, mo, d, y) => {
    const iso = `${y}-${String(MONTHS_LONG.indexOf(mo) + 1).padStart(2, "0")}-${d}`; return isIso(iso) ? longDate(shiftIso(iso, k)) : all; });
}
// the activity's items at the current anchor (their dates and the dates in their words moved by k weeks)
const deepDates = (v, k) => Array.isArray(v) ? v.map(x => deepDates(x, k)) : typeof v === "string" ? rewriteDates(v, k) : v;
const itemsFor = items => { const k = weeksOf(FROM); return items.map(it => Object.assign({}, it, {date:shiftIso(it.date, k), lines:deepDates(it.lines, k)})); };

const PEOPLE = [
  {name:"Martin Anthony", email:"martin@legalsupporthelp.com"},
  {name:"Michelle Velarde", email:"michelle.velarde@legalsupporthelp.com"},
  {name:"John Michael Dela Cruz", email:"john.delacruz@legalsupporthelp.com"},
  {name:"Lei Lee Abut", email:"team-litigation@legalsupporthelp.com"}
];
const [MA, MV, JD, LL] = PEOPLE.map(p => p.email), ALL4 = [MA, MV, JD, LL];
const who = em => (PEOPLE.find(p => p.email === em) || {name:em}).name;
// The activity's color legend in Google Calendar's colors (the first is the legend's; the others are accepted shades).
const CATS = {
  client:   {legend:"Green",  what:"Client Meetings",     colors:["basil", "sage"]},
  internal: {legend:"Blue",   what:"Internal Meetings",   colors:["peacock", "blueberry"]},
  court:    {legend:"Red",    what:"Court-Related Tasks", colors:["tomato"]},
  external: {legend:"Purple", what:"External Events",     colors:["grape"]},
  task:     {legend:"Yellow", what:"Internal Tasks",      colors:["banana"]},
  wellness: {legend:"Orange", what:"Personal Wellness",   colors:["tangerine"]},
  personal: {legend:"Pink",   what:"Personal Events",     colors:["flamingo"]}
};
const catText = c => `${CATS[c].legend} (${CATS[c].what}: ${CATS[c].colors.map(id => colorOf(id).name).join(" or ")})`;
const REM_UNITS = {minutes:1, hours:60, days:1440, weeks:10080};
const remMin = r => r.n * (REM_UNITS[r.unit] || 1);
const leadText = m => m && m % 10080 === 0 ? `${m / 10080} week${m === 10080 ? "" : "s"}` : m && m % 1440 === 0 ? `${m / 1440} day${m === 1440 ? "" : "s"}` : m && m % 60 === 0 ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${m} minute${m === 1 ? "" : "s"}`;
const remText = r => `${r.type === "email" ? "Email" : "Notification"} ${leadText(r.min != null ? r.min : remMin(r))} before`;

/* ---------- THE ANSWER KEY: the 📅 Calendar Activity Check's (js/ft-calcheck.js, FTCalCheck.key) ----------
   The simulator is where the trainee does the activity; the Calendar Activity Check (#/calcheck) checks it field by field. They
   must agree, so the simulator has no answer key of its own: review() maps each event on the calendar to the Check's entry shape
   and grades it with FTCalCheck.check / checkAll / score (the title, dates and times in the event's own zone, the zone, location,
   guests, reminder, description). Trainers adjust the key in js/ft-calcheck.js. Here is only what the Check can't see:
     SIM[n]   per Check event (its n): cat, the legend's colour category, and alt: other categories accepted (altWhy: the ℹ line
              that says so); travel: a travel block (eg: a departure → destination location, for the ℹ advice); info: a line
              the review always shows on it.
   The simulator's own checks (each one field, scored with the Check's): what the Check, typed text, can't see or doesn't ask:
     • the colour (instruction 4);
     • the guests' email addresses (instruction 9): the item's guests at their directory addresses, and no one else;
     • a travel block's location naming where the attorney leaves from and where they go (instruction 8), and a reminder on
       every travel block (instruction 6): where the activity gives none (6.2, 6.3), a practical one, 30 minutes to a day
       before; on the trip's legs (8.2/8.3, 8.6/8.7), whose 1-day email sits on one leg only, a reminder of some kind;
     • and on the whole calendar, no overlapping events and no duplicates (instruction 7).
   The same moment typed in Pacific counts in the Check itself (FTCalCheck.pacificOf). Advice that isn't graded (the lead time
   of the trip legs' own reminders) shows as ℹ lines.
   ------------------------------------------------------------ */
const CK = () => root.FTCalCheck && Array.isArray(root.FTCalCheck.key) && typeof root.FTCalCheck.checkAll === "function" ? root.FTCalCheck : null;
const GAP = "The activity gives 8:30–9:00 AM to reach SEA, right before the 9:00 AM flight: keep the given times. Your trainer may talk through a more realistic airport buffer with you.";
const TRAVEL_COL = "A travel block takes its appointment’s color (Red for the court appearance); Purple is accepted.";
const SIM = {
  "1": {cat:"client"}, "2": {cat:"internal"},
  "3": {cat:"court", alt:["internal"], altWhy:"Blue is accepted for the deposition prep (a meeting with another attorney); Red, a court-related task, is the legend’s match."},
  "4": {cat:"wellness"},
  "5": {cat:"wellness", alt:["personal"], altWhy:"Pink is accepted for the doctor’s appointment (a personal event); Orange, personal wellness, is the legend’s match."},
  "6.1": {cat:"court"},
  "6.2": {cat:"court", alt:["external"], altWhy:TRAVEL_COL, travel:true, eg:"Office → Washington County Court"},
  "6.3": {cat:"court", alt:["external"], altWhy:TRAVEL_COL, travel:true, eg:"Washington County Court → Office"},
  "7": {cat:"court", alt:["client", "external"], altWhy:"The activity doesn’t name this one’s color: Red (a case task), Green (the client’s case) and Purple (an outside party, the adjuster) are all accepted. Your trainer confirms the attorney’s preference."},
  "8.1": {cat:"external"},
  "8.2": {cat:"external", travel:true, eg:"Home → Seattle-Tacoma International Airport (SEA)", info:GAP},
  "8.3": {cat:"external", travel:true, eg:"SEA → SFO", info:GAP},
  "8.4": {cat:"external"}, "8.5": {cat:"external"},
  "8.6": {cat:"external", travel:true, eg:"The Ritz-Carlton, San Francisco → SFO"},
  "8.7": {cat:"external", travel:true, eg:"SFO → SEA"},
  "9": {cat:"task"}, "10": {cat:"personal"}
};
const TRAVEL_MIN = 30, TRAVEL_MAX = 1440;            // the ℹ advice on a travel block's own reminder: from 30 minutes to a day before
const STAY = "8.5";                                  // the overnight stay: it overlaps whatever the evening holds
const mm = v => { const m = String(v || "").match(/^(\d{1,2}):(\d\d)/); return m ? +m[1] * 60 + +m[2] : 0; };
const hm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
// The expected events, in the Check's order, with what the page needs (the Pacific window, the colour): derived from FTCalCheck.key.
let KL = null, KL_SRC = null, KL_AT = null;
// the Check's key at the current anchor (its dates moved by k weeks: FTCalCheck.keyFor), else its own (July 2026)
const keyNow = C => C.keyFor ? C.keyFor(FROM) : C.key;
function keyList(){
  const C = CK(); if(!C) return [];
  if(KL && KL_SRC === C.key && KL_AT === FROM) return KL;
  KL_SRC = C.key; KL_AT = FROM;
  return KL = keyNow(C).map(k => {
    const s = SIM[k.n] || {cat:"external"}, z = tzOf(k.tz) || TZS[0];
    const o = {id:k.n, n:k.n, item:parseInt(k.n, 10), name:k.name, title:`${k.n} ${k.name}`, date:k.date, endDate:k.endDate || k.date, tz:k.tz, tzId:z.id, allDay:!!k.overnight,
      cat:s.cat, alt:s.alt, altWhy:s.altWhy, travel:!!s.travel, eg:s.eg, info:s.info, ck:k};
    if(!o.allDay){ o.start = mm(k.start); o.end = mm(k.end); o.abs = {s:absAt(k.date, o.start, z.id), e:absAt(k.date, o.end, z.id)};
      const p = fromAbs(o.abs.s, CAL_TZ); o.pt = {day:p.day, start:p.start, end:p.start + o.abs.e - o.abs.s}; }
    return o;
  });
}
// The Check event whose reminder and notes may sit on this one instead (the travel blocks 8.2/8.3 and 8.6/8.7).
const pairOf = (C, n) => { const K = keyNow(C), k = K.find(x => x.n === n); return k && k.alt ? k.alt : (K.find(x => x.alt === n) || {}).n; };
const remOf = (C, n) => { const K = keyNow(C), k = K.find(x => x.n === n); return (k && k.rem) || (K.find(x => x.alt === n) || {}).rem || null; };
// What an expected event is, in one line (the review's "not found", the trainer's live review and the AI prompt).
function noteOf(o){
  const C = CK(), k = o.ck, z = tzOf(o.tz) || TZS[0], pair = C && pairOf(C, o.n), rem = C && remOf(C, o.n);
  const nk = k.notes ? k : pair && C ? keyNow(C).find(x => x.n === pair && x.notes) : null;
  const when = o.allDay ? `${dLabel(dIdx(o.date))}: an All day event (it may end on ${dLabel(dIdx(o.date))} or ${dLabel(dIdx(o.endDate))})`
    : `${dLabel(dIdx(o.date))}, ${range(o.start, o.end)} ${o.tz} in its own time zone (${z.word} Time${z.id === CAL_TZ ? "" : `; ${range(o.pt.start, o.pt.end)} on the attorney’s Pacific calendar`})`;
  return [when, k.loc ? `location: ${k.locShow}${k.link ? ` (with ${k.link})` : ""}` : o.travel ? `location: departure → destination, e.g. ${o.eg}` : "",
    k.guests ? "guests: " + k.guests.map(n => `${n} (${EMAIL_OF(n)})`).join(", ") : "no guests",
    rem ? `reminder: ${rem.type} ${rem.show} before${pair ? ` (on ${[o.n, pair].sort().join(" or ")})` : ""}` : "",
    nk ? `notes: ${nk.notesShow}${pair ? ` (on ${[o.n, pair].sort().join(" or ")})` : ""}` : "",
    `color ${catText(o.cat)}${o.alt ? ", or " + o.alt.map(c => CATS[c].legend).join(" / ") + " accepted" : ""}`].filter(Boolean).join(" · ");
}
let TL = null, TL_SRC = null;
function taskList(){
  const K = keyList(); if(TL && TL_SRC === K) return TL; TL_SRC = K;
  return TL = K.map(o => ({id:o.id, title:o.title, note:noteOf(o), weight:1, item:o.item})).concat([{id:"calendar", title:"Whole calendar: no overlaps, no duplicates",
    note:"No two timed events overlap (the overnight stay aside); no appointment is entered twice.", weight:2}]);
}

/* ---------- the trainee's events, checked before they're used ---------- */
const str = (v, n) => String(v == null ? "" : v).slice(0, n);
const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i;
function cleanAct(events){
  const seen = {};
  return (Array.isArray(events) ? events : []).filter(x => x && typeof x === "object" && typeof x.id === "string" && !seen[x.id] && (seen[x.id] = 1)
      && dIdx(x.date) >= -1 && dIdx(x.date) <= NDAYS
      && (x.allDay || (Number.isInteger(x.start) && x.start >= 0 && x.start % STEP === 0 && Number.isInteger(x.dur) && x.dur >= STEP && x.dur % STEP === 0 && x.start + x.dur <= 1440)))
    .map(x => {
      const guests = [...new Set((Array.isArray(x.guests) ? x.guests : []).map(g => String(g).trim().toLowerCase()).filter(g => g.length <= 100 && EMAIL.test(g)))].slice(0, 10);
      const reminders = (Array.isArray(x.reminders) ? x.reminders : []).filter(r => r && (r.type === "email" || r.type === "notification") && REM_UNITS[r.unit] && Number.isInteger(r.n) && r.n >= 0 && r.n * REM_UNITS[r.unit] <= 40320)
        .slice(0, 5).map(r => ({type:r.type, n:r.n, unit:r.unit}));
      return {id:x.id.slice(0, 24), title:str(x.title, 100), date:x.date, allDay:!!x.allDay, span:x.allDay ? Math.max(1, Math.min(7, Number.isInteger(x.span) ? x.span : 1)) : 1,
        start:x.allDay ? 0 : x.start, dur:x.allDay ? 1440 : x.dur, tz:tzOf(x.tz) ? tzOf(x.tz).id : CAL_TZ, loc:str(x.loc, 200), guests, desc:str(x.desc, 600),
        meet:!!x.meet, color:colorOf(x.color) ? x.color : "", reminders};
    })
    // only what the calendar shows (its two Pacific weeks): nothing is kept that couldn't be seen, edited or deleted
    .filter(x => { const d = pacOf(x).day; return d >= 0 && d <= NDAYS - 1; })
    .slice(0, MAXEV);
}
// Whether an event can go on the calendar as entered (the editor, a drag, the keyboard): "" or what is wrong.
function valid(x){
  if(x.allDay){ const d = dIdx(x.date); return d >= 0 && d <= NDAYS - 1 ? "" : `Pick a date on the calendar (${spanText(NDAYS - 1)}).`; }
  const z = tzOf(x.tz) || TZS[0];
  if(x.start < 0 || x.start + x.dur > 1440) return `It has to end by midnight in its own time zone (${z.word} Time). For an overnight stay, use All day.`;
  const p = pacOf(x);
  if(p.day < 0 || p.day > NDAYS - 1) return `On the attorney’s Pacific calendar that is ${dLabel(p.day)}, ${fmt(p.start)}: outside the calendar’s dates (${spanText(NDAYS - 1)}). Check the date and the time zone.`;
  if(p.end > 1440) return `On the attorney’s Pacific calendar it runs past midnight (${dLabel(p.day)}, from ${fmt(p.start)}). End it by midnight Pacific; for an overnight stay, use All day.`;
  return "";
}
const timed = x => !x.allDay;
const clash = (a, b) => timed(a) && timed(b) && a.id !== b.id && (p => p.a.s < p.b.e && p.b.s < p.a.e)({a:evAbs(a), b:evAbs(b)});
const whenOf = x => { const p = pacOf(x); return p.allDay ? `${dLabel(p.day)}${p.span > 1 ? " – " + dLabel(p.day + p.span - 1) : ""}, all day` : `${dLabel(p.day)}, ${range(p.start, p.end)}`; };
// The event's own zone, when it isn't Pacific: "Mountain 3 PM – 4 PM (MDT)".
const zoneText = x => { if(x.allDay || x.tz === CAL_TZ) return ""; const z = tzOf(x.tz) || TZS[0]; return `${z.word} ${range(x.start, x.start + x.dur)} (${abbr(z, evAbs(x).s)})`; };
// The grid's warnings: overlapping events (not the overnight stay), events off the activity's dates.
function flagsAct(scn, events){
  events = cleanAct(events); const stay = (matchAct(events)[STAY] || {}).id, out = {};
  events.forEach(x => { const why = [], hit = x.id !== stay && events.find(o => o.id !== stay && clash(x, o)); if(hit) why.push(`Overlaps “${hit.title || "(no title)"}”`);
    const p = pacOf(x); if(p.day < 0 || p.day > LAST) why.push(`Outside the activity’s dates (${spanText(LAST)})`);
    if(!p.allDay && p.end > 1440) why.push("Runs past midnight on the attorney’s calendar");
    if(why.length) out[x.id] = why; });
  return out;
}

/* ---------- the automated review: through the 📅 Calendar Activity Check (FTCalCheck) ---------- */
// An event as the Check's entry ({title, sd, st, ed, et, tz, allday, loc, guests, rtype, ramt, runit, notes}): what the trainee would
// type on #/calcheck from this event as Google Calendar shows it, for the Check event n.
//   • the dates and times in the event's own zone (an all-day event: its first and last day); the zone, its IANA id;
//   • the location; Google Meet added shows as "Join with Google Meet" and its meet.google.com link, which the Check accepts as
//     the location, so it is added to it;
//   • the guests by name (the activity's directory; any other address as typed);
//   • the Check takes one reminder: of the event's (up to five), the one the Check asks of n (or of its travel-block pair), else
//     the one with its time, else its type, else the first;
//   • the description as the notes.
const REM_TYPE = {notification:"Notification", email:"Email"};
function entryOf(x, n){
  const C = CK(), want = C && n ? remOf(C, n) : null, list = x.reminders || [], t = r => REM_TYPE[r.type];
  const r = (want && (list.find(q => t(q) === want.type && remMin(q) === want.m) || list.find(q => remMin(q) === want.m) || list.find(q => t(q) === want.type))) || list[0] || null;
  const v = {title:x.title || "", allday:!!x.allDay, sd:x.date, tz:x.allDay ? "" : x.tz, loc:[x.loc, x.meet ? "Google Meet (meet.google.com)" : ""].filter(Boolean).join(" · "),
    guests:(x.guests || []).map(who).join(", "), rtype:r ? t(r) : "", ramt:r ? String(r.n) : "", runit:r ? r.unit : "minutes", notes:x.desc || ""};
  if(x.allDay) Object.assign(v, {ed:dIso(dIdx(x.date) + (x.span || 1) - 1), st:"", et:""});
  else { const end = x.start + x.dur; Object.assign(v, {st:hm(x.start), ed:end >= 1440 ? dIso(dIdx(x.date) + 1) : x.date, et:hm(end % 1440)}); }
  return v;
}
// [field, met] of the Check's rows for one event, alone
const rowsFor = (C, k, x) => C.check(k, entryOf(x, k.n), {});
const met = (rows, f) => (rows.find(r => r[0] === f) || [])[1] === true;
// Each Check event takes the event that fits it best and isn't already taken: its title first (the Check's own title check),
// then its date and start time, then how many of its fields the Check marks right.
function matchAct(events){
  const C = CK(); if(!C) return {};
  const pairs = [];
  keyNow(C).forEach(k => events.forEach(x => {
    const rows = rowsFor(C, k, x), title = met(rows, "Title"), when = met(rows, "Start date") && (k.overnight ? !!x.allDay : met(rows, "Start time"));
    if(title || when) pairs.push({k, x, sc:(title ? 100 : 0) + (when ? 50 : 0) + rows.filter(r => r[1] === true).length});
  }));
  pairs.sort((p, q) => q.sc - p.sc);
  const out = {}, used = {};
  pairs.forEach(p => { if(!out[p.k.n] && !used[p.x.id]){ out[p.k.n] = p.x; used[p.x.id] = 1; } });
  return out;
}
function splitTravel(raw){
  raw = String(raw || "");
  for(const re of [/\s*(?:→|➔|➝|⟶|➡|->|=>|—>|–>|>)\s*/, /\s+to\s+/i, /\s+[-–—]\s+/]){
    const i = raw.search(re); if(i < 0) continue;
    const m = raw.slice(i).match(re)[0], from = raw.slice(0, i).trim(), to = raw.slice(i + m.length).trim();
    if(from && to) return {from, to};
  }
  return null;
}
const normTitle = v => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// The ℹ lines: what the Check doesn't grade, but the activity or the trainer asks about.
function infoFor(C, o, x){
  const out = o.info ? [o.info] : [];
  if(!x) return out;
  if(o.travel){
    const own = travelRems(C, o, x);
    if(own.length) out.push(`Travel reminder: ${own.map(remText).join(", ")}. Your trainer confirms the attorney’s preferred lead time.`);
    else if(remOf(C, o.n)) out.push(`A travel block: besides the activity’s 1-day email, a practical reminder of its own (${leadText(TRAVEL_MIN)} to ${leadText(TRAVEL_MAX)} before, e.g. 1 hour) helps the attorney leave without rushing. It isn’t graded; your trainer confirms the attorney’s preference.`);
  }
  return out;
}
// a travel block's own practical reminders: 30 minutes to a day before, not counting the one the activity gives (8.2/8.3, 8.6/8.7)
function travelRems(C, o, x){
  const want = remOf(C, o.n);
  return (x.reminders || []).filter(r => !(want && REM_TYPE[r.type] === want.type && remMin(r) === want.m) && remMin(r) >= TRAVEL_MIN && remMin(r) <= TRAVEL_MAX);
}
// The simulator's own checks of one expected event (see the answer key's note): [key, label] for each that applies to it
function simList(C, o){
  return [["color", "Color"]].concat(o.ck.guests ? [["emails", "Guests’ email addresses"]] : [],
    o.travel ? [["route", "Location: from → to"]] : [], o.travel ? [["trem", "Travel reminder"]] : []);
}
const EMAIL_OF = name => (PEOPLE.find(p => p.name === name) || {}).email;
function simChecks(C, o, x){
  return simList(C, o).map(([key, label]) => {
    if(key === "color"){ const c = colorRow(o, x); return {key, label, ok:c.ok, why:c.ok ? "" : c.why, info:c.info}; }
    if(key === "emails"){
      const want = o.ck.guests.map(EMAIL_OF), have = x.guests || [], odd = have.filter(g => !PEOPLE.some(p => p.email === g)), extra = have.filter(g => !want.includes(g) && !odd.includes(g));
      const miss = want.filter(g => !have.includes(g)), ok = !odd.length && !extra.length && !miss.length;
      return {key, label, ok, info:"", why:ok ? "" : [miss.length ? `Invite ${miss.map(g => `${who(g)} (${g})`).join(", ")}.` : "",
        odd.length ? `Not a directory address: ${odd.join(", ")}. Use the addresses in instruction 9 (e.g. ${who(want[0])}: ${want[0]}).` : "",
        extra.length ? `Not invited to this item: ${extra.map(who).join(", ")}. Invite only ${o.ck.guests.join(", ")}.` : ""].filter(Boolean).join(" ")};
    }
    if(key === "route"){ const ok = !!splitTravel(x.loc);
      return {key, label, ok, info:"", why:ok ? "" : `Name where the attorney leaves from and where they go, e.g. “${o.eg}” (instruction 8). Yours: ${x.loc ? `“${x.loc}”` : "empty"}.`}; }
    // a leg of the trip (8.2/8.3, 8.6/8.7): the activity's 1-day email sits on one leg, so each leg needs a reminder of some kind;
    // its lead time is the ℹ line's advice, not graded
    if(remOf(C, o.n)){ const ok = (x.reminders || []).length > 0;
      return {key, label, ok, info:"", why:ok ? "" : `This leg of the trip has no reminder at all: the trip’s 1-day email is on the other event, so add one here too, e.g. Notification 1 hour before, so the attorney can leave without rushing (instruction 6). Yours: none.`}; }
    const own = (x.reminders || []).filter(r => remMin(r) >= TRAVEL_MIN && remMin(r) <= TRAVEL_MAX), ok = own.length > 0;
    return {key, label, ok, info:"", why:ok ? "" : `Add a practical reminder, ${leadText(TRAVEL_MIN)} to ${leadText(TRAVEL_MAX)} before (e.g. Notification 1 hour before), so the attorney can leave without rushing (instruction 6). Yours: ${x.reminders && x.reminders.length ? x.reminders.map(remText).join(", ") : "none"}.`};
  });
}
// What the event holds, after a Check field's fix: "Notification (yours: Email 15 minutes before)"
const dayOr = iso => /^\d{4}-\d\d-\d\d$/.test(iso || "") ? dLabel(dIdx(iso)) : "none";
function yours(f, x, v){
  const z = tzOf(x.tz), at = t => x.allDay ? "All day" : `${fmtE(mm(t))} ${z ? z.word : ""}`.trim();
  const out = {"Title":`“${x.title || ""}”`, "Start date":dayOr(v.sd), "End date":dayOr(v.ed), "Start time":at(v.st), "End time":at(v.et),
    "Time zone":x.allDay ? "" : z ? z.name : String(x.tz || "none"), "Location":v.loc ? `“${v.loc}”` : "empty", "Guests":v.guests || "none",
    "Reminder type":(x.reminders || []).length ? x.reminders.map(remText).join(", ") : "no reminder"}[f === "Reminder time" ? "Reminder type" : f];
  return out ? ` (yours: ${out})` : "";
}
function colorRow(o, x){
  const col = colorOf(x.color), main = CATS[o.cat].colors, alts = (o.alt || []).flatMap(c => CATS[c].colors), ok = main.includes(x.color) || alts.includes(x.color);
  return {ok, why:`${col ? col.name : "No color (the calendar’s default)"}: this one is ${catText(o.cat)}${o.alt ? `; ${o.alt.map(catText).join(" or ")} is also accepted` : ""}.`
    + (x.color === "lavender" ? " Lavender isn’t one of the legend’s colors: Purple is Grape, Blue is Peacock." : ""), info:ok && !main.includes(x.color) ? o.altWhy : ""};
}
function reviewAct(scn, events){
  events = cleanAct(events);
  const C = CK();
  if(!C) return {kind:"activity", score:0, max:0, pct:0, passed:false, items:[], done:0, extras:[], rows:[], check:{met:0, total:0, pct:0}, sim:{met:0, total:0}, entries:{}, error:"The Calendar Activity Check isn’t loaded: reload the page."};
  const K = keyList(), m = matchAct(events), entries = {}, taken = {};
  K.forEach(o => { const x = m[o.n]; if(x){ entries[o.n] = entryOf(x, o.n); taken[x.id] = 1; } });
  // the Check's verdict on every field of the 18 events (an older Check's "11", the 19th screenshot and the upload, is no longer asked, and was never this calendar's)
  const rows = C.checkAll({entries}).filter(r => r[0] !== "11"), simRows = [];
  const items = K.map(o => {
    const x = m[o.n], mine = rows.filter(r => r[0] === o.n && r[2] !== null), sims = x ? simChecks(C, o, x) : simList(C, o).map(([key, label]) => ({key, label, ok:false, why:"Add the event", info:""}));
    sims.forEach(c => simRows.push([o.n, c.label, c.ok, c.why]));
    const cs = x ? mine.map(r => ({key:r[1], w:1, ok:r[2], label:r[1], why:r[2] ? "" : r[3] + yours(r[1], x, entries[o.n]), info:""})).concat(sims.map(c => Object.assign({w:1, sim:true}, c)))
      : [{key:"found", w:mine.length + sims.length, ok:false, label:"On the calendar", why:`Not found. Add “${o.title}”: ${noteOf(o)}.`, info:""}];
    const tw = cs.reduce((n, c) => n + c.w, 0), pw = cs.filter(c => c.ok).reduce((n, c) => n + c.w, 0);
    return {id:o.n, title:o.title, weight:tw, pts:pw, perfect:!!x && cs.every(c => c.ok), found:!!x, via:"", event:x || null, checks:cs,
      info:infoFor(C, o, x).concat(cs.map(c => c.info).filter(Boolean))};
  });
  // the whole calendar (the simulator's own: the Check sees one event at a time): no overlaps, no duplicates
  const stay = m[STAY] ? m[STAY].id : null, rest = events.filter(x => !taken[x.id]), dupes = [], extras = [];
  rest.forEach(x => { const o = K.find(o => m[o.n] && met(rowsFor(C, o.ck, x), "Title") && (normTitle(m[o.n].title) === normTitle(x.title) || clash(x, m[o.n])));
    (o ? dupes : extras).push({x, o}); });
  // overlaps: not the overnight stay (a night away overlaps whatever the evening holds), and a duplicate isn't counted twice
  const twin = new Set(dupes.map(d => d.x.id + "|" + m[d.o.n].id)), pairs = [];
  events.forEach((a, i) => events.slice(i + 1).forEach(b => { if(a.id !== stay && b.id !== stay && clash(a, b) && !twin.has(a.id + "|" + b.id) && !twin.has(b.id + "|" + a.id)) pairs.push([a, b]); }));
  const cal = [
    {key:"overlap", w:1, ok:!pairs.length, label:"No overlapping events", why:pairs.slice(0, 6).map(([a, b]) => `“${a.title}” (${whenOf(a)}) overlaps “${b.title}” (${whenOf(b)}).`).join(" "), info:"", sim:true},
    {key:"dupes", w:1, ok:!dupes.length, label:"No duplicate events", why:dupes.map(d => `“${d.x.title}” (${whenOf(d.x)}) repeats “${m[d.o.n].title}”: keep one event per appointment.`).join(" "), info:"", sim:true}
  ].map(c => Object.assign(c, {why:c.ok ? "" : c.why}));
  cal.forEach(c => simRows.push(["calendar", c.label, c.ok, c.why]));
  items.push({id:"calendar", title:"Whole calendar: no overlaps, no duplicates", weight:cal.length, pts:cal.filter(c => c.ok).length, perfect:cal.every(c => c.ok), found:true, via:"", event:null, checks:cal, info:[]});
  // one score, the Check's (every field counts one): its rows and the simulator's; 100% only when every one is met
  const all = rows.concat(simRows), sc = C.score(all), allOk = all.every(r => r[2] !== false), pct = allOk ? 100 : Math.min(99, sc.pct);
  const fl = flagsAct(scn, events);
  return {kind:"activity", score:sc.met, max:sc.total, pct, passed:pct >= PASS, items, done:items.filter(i => i.perfect).length,
    rows, check:C.score(rows), sim:{met:simRows.filter(r => r[2]).length, total:simRows.length}, entries,
    extras:dupes.map(d => ({title:d.x.title, when:whenOf(d.x), why:[`A duplicate of “${m[d.o.n].title}”`].concat(fl[d.x.id] || [])}))
      .concat(extras.map(d => ({title:d.x.title, when:whenOf(d.x), why:fl[d.x.id] || [], info:"Not matched to an item or travel block. If it is one, name it as the activity does (e.g. “Doctor’s Appointment”); if not, your trainer will look at it."})))};
}

/* ---------- the scenario: the activity's own words (verbatim), its legend, the guest directory and the ten items ---------- */
TRACKS.push({id:"activity", icon:"🗓", title:"Attorney Calendar Management Activity", where:"Day 5 · Calendar Management",
  get blurb(){ return `The attorney’s own Google Calendar (Seattle, Pacific Time), ${spanText(LAST)}, ${dYear(LAST)}: put every item and travel block on it with its time zone, color, location, guests, reminders and notes.`; }});
SCENARIOS.push({id:"attorney-activity", track:"activity", kind:"activity", short:"Attorney Calendar Activity", title:"Attorney Calendar Management Activity", level:"Day 5", gap:0, fixed:[],
  brief:"Plot the ten activity items, and each item’s travel blocks, on the attorney’s Google Calendar (Pacific Time), with every detail the item gives. Run the automated review, fix what it marks, then submit to your trainer.",
  intro:"Please answer the Attorney Calendar Management Activity. Make sure to follow the instructions carefully, and don’t forget to signify done here as soon as you finish. Thanks.",
  standIn:"Here, this calendar stands in for your work Google Calendar (instruction 3), and 📤 Submit to my trainer is how you signify done.",
  instructions:[
    {t:"Manage the calendar of an attorney by reviewing and scheduling the provided appointments."},
    {t:"Review the given appointment details carefully."},
    {t:"Use your work Google Calendar for this, treating it as your attorney’s official calendar to plot all appointments."},
    {t:"Apply time-blocking and color-coding for clarity:", sub:["Green – Client Meetings", "Blue – Internal Meetings", "Red – Court-Related Tasks", "Purple – External Events", "Yellow – Internal Tasks", "Orange – Personal Wellness", "Pink – Personal Events"]},
    {t:"Add reminders with appropriate notes for each appointment to ensure all details are covered"},
    {t:"For travel blocks reminders, set a practical or reasonable reminder time for your attorney that ensures they have sufficient notice to prepare and depart without rushing, allowing enough buffer to account for traffic, last-minute preparations, and the required early arrival time at the airport or point of departure. (Need to ask Mitch’s preferences)"},
    {t:"Review the calendar to ensure there are no conflicts, such as overlapping appointments or insufficient time buffers between events."},
    {t:"For the location, if it does not provide the exact address, just manually input the location indicated in the activity item. For Travel Blocks, ensure the location is specific, including both the departure point and the destination.", sub:["e.g., John F. Kennedy International Airport → LAX"]},
    {t:"Add Guests’ email addresses (if applicable):", sub:["Martin Anthony - martin@legalsupporthelp.com", "Michelle Velarde - michelle.velarde@legalsupporthelp.com", "John Michael Dela Cruz - john.delacruz@legalsupporthelp.com", "Lei Lee Abut - team-litigation@legalsupporthelp.com"]}
  ],
  cats:CATS, people:PEOPLE,
  items:[
    {n:1, title:"Client Meeting", date:"2026-07-06", lines:[["Date", "July 06, 2026"], ["Time", "10:00 AM – 11:00 AM PST"], ["Location", "Conference Room B"],
      ["Details", "Client consultation for Alyssa Lynn Arehart regarding a car accident case. Set a reminder for 15 minutes before the meeting (notification). Ensure all case documents are accessible during the meeting."], ["Guests", "Martin Anthony & Michelle Velarde"]]},
    {n:2, title:"Team Meeting", date:"2026-07-07", lines:[["Date", "July 07, 2026"], ["Time", "3:00 PM – 4:00 PM MST"], ["Location", "Google Meet"],
      ["Details", "Weekly team check-in. Set a reminder for 30 minutes before the meeting (email)."], ["Guests", "Martin Anthony, Michelle Velarde, John Michael Dela Cruz, and Lei Lee Abut"]]},
    {n:3, title:"Deposition Meeting", date:"2026-07-08", lines:[["Date", "July 08, 2026"], ["Time", "11:00 AM – 1:00 PM EST"], ["Location", "Attorney’s Office (or Zoom for remote attendees: zoom.us/deposition-meeting-02-04-25)"],
      ["Details", "Deposition preparation with another attorney. Set a reminder 1 day before (email)."], ["Guests", "Martin Anthony & Michelle Velarde"]]},
    {n:4, title:"Gym Session", date:"2026-07-08", lines:[["Date", "July 08, 2026"], ["Time", "6:30 AM – 7:30 AM EST"], ["Location", "Downtown Seattle Fitness Center"],
      ["Details", "Morning workout. Set a 10-minute reminder before (notification)."]]},
    {n:5, title:"Doctor’s Appointment", date:"2026-07-09", lines:[["Date", "July 09, 2026"], ["Time", "9:00 AM – 10:00 AM PST"], ["Location", "Central Medical Clinic"],
      ["Details", "Routine check-up. Set a 1-day reminder to prepare any necessary documents or insurance details (email)."]]},
    {n:6, title:"Court Appearance", date:"2026-07-10", lines:[["Date", "July 10, 2026"], ["Time", "9:00 AM – 12:00 PM PST"], ["Location", "Washington County Court"],
      ["Details", "Attorney has a scheduled court hearing. Set a reminder for 30 minutes before the hearing (notification)."], ["Travel Blocks", ["- 8:00 AM – 9:00 AM for travel to court.", "- 12:00 PM – 1:00 PM for return travel."]]]},
    {n:7, title:"Recorded Statement Meeting", date:"2026-07-10", lines:[["Date", "July 10, 2026"], ["Time", "4:00 PM – 5:00 PM CST"], ["Location", "Google Meet"],
      ["Details", "Recorded statement meeting with an insurance adjuster regarding a premises liability case. Set a reminder 15 minutes before (notification)."], ["Guests", "Martin Anthony, Michelle Velarde, John Michael Dela Cruz, and Lei Lee Abut"]]},
    {n:8, title:"Networking Dinner Event", date:"2026-07-13", lines:[["Date", "July 13, 2026"], ["Time", "6:00 PM – 8:00 PM PST"], ["Location", "The Ritz-Carlton, San Francisco (600 Stockton St, San Francisco, CA 94108)"],
      ["Details", "Attorney attending a networking dinner with potential clients."],
      ["Travel Schedule for the Out-of-State Event", ["➢ Travel to San Francisco:", "▪ Date: July 13, 2026", "▪ Time:", "- 8:30 AM – 9:00 AM: Transportation to Seattle Airport (SEA).", "- 9:00 AM – 12:00 PM: Flight from Seattle (SEA) to San Francisco (SFO).",
        "▪ Note: Confirm flight details, check in luggage, bring travel documents, bring business cards ,and prepare attire for the event. Set a 1-day reminder before (email).",
        "➢ Networking Event:", "▪ Time:", "- 6:00 PM – 8:00 PM: Attend the event.", "- Arrival: Block 5:45 PM – 6:00 PM for early arrival.", "▪ Note: Bring business cards and prepare a short personal introduction. Set a 30-minute reminder before (notification).",
        "➢ Overnight Stay:", "▪ Details: Attorney will stay overnight in San Francisco.", "▪ Preparation: Confirm hotel booking and plan transportation after the event.",
        "➢ Return Travel to Seattle:", "▪ Date: July 14, 2026", "▪ Time:", "- 8:00 AM – 8:30 AM: Check out of the hotel and travel to the airport.", "- 10:00 AM – 1:00 PM: Flight from San Francisco (SFO) to Seattle (SEA).",
        "▪ Reminder: 1 day before (email): Confirm hotel check-out and transportation to the airport."]]]},
    {n:9, title:"Document Review Session", date:"2026-07-15", lines:[["Date", "July 15, 2026"], ["Time", "1:30 PM – 3:00 PM CST"], ["Location", "Attorney’s Office"],
      ["Details", "Allocate time for the attorney to review a high-priority case file. Set a 30-minute reminder before (notification)."]]},
    {n:10, title:"Family Dinner", date:"2026-07-15", lines:[["Date", "July 15, 2026"], ["Time", "7:00 PM – 9:00 PM MST"], ["Location", "Home"],
      ["Details", "Dinner with family."], ["Reminder", "1 hour before (notification): Pick up groceries on the way home."]]}
  ],
  // the expected events, and one "task" each (and the whole calendar) so the per-task feedback, comments and live review work as
  // for a week: both read the Check's key (js/ft-calcheck.js loads after this file, so they are getters)
  get key(){ return keyList(); },
  // the items at the current anchor (items: the activity's own words and dates, July 2026)
  get itemsNow(){ return itemsFor(this.items); },
  get tasks(){ return taskList(); }
});

return {TZS, CAL_TZ, get FROM(){ return FROM; }, BASE_FROM, setAnchor, anchor:() => FROM, withAnchor, weeks:() => weeksOf(FROM), weeksOf, shiftIso, isMonday,
  okAnchor, batchStart, anchorForStart, anchorForBatch, anchorNow, anchorOfRecord, ensureAnchor, rewriteDates, longDate, spanText, dYear, SCN_ID, PEOPLE, CATS, SIM, STAY, REM_UNITS, TRAVEL_MIN, TRAVEL_MAX, NDAYS, LAST, MAXEV, tzOf, tzLabel, abbr, offAt, dIdx, dIso, dLabel, fmtE, range,
  absAt, fromAbs, evAbs, pacOf, fromPac, who, remMin, remText, leadText, catText, noteOf, splitTravel, whenOf, zoneText, valid, keyList, entryOf, check:CK,
  clean:cleanAct, flags:flagsAct, match:(scn, events) => matchAct(cleanAct(events)), review:reviewAct};
})();
const cleanFor = (scn, events) => isAct(scn) ? act.clean(events) : clean(events);

const api = {DAYS, OPEN, CLOSE, STEP, MAXEV, PASS, TRACKS, SCENARIOS, COLORS, COLOR_RULE, COLOR_RULE_TEXT, colorOf, colorFor, trackOf, fmt, overlap, endOf, all, flags, clean, match, review, isAct, cleanFor, act};
if(typeof module !== "undefined" && module.exports) module.exports = api; else root.FTCalCore = api;
})(typeof window !== "undefined" ? window : globalThis);

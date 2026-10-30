/* ============================================================
   📅 THE CALENDAR ACTIVITY CHECK (Day 5)
   ------------------------------------------------------------
   Day 5's Attorney Calendar Management Activity: the trainee puts ten of the attorney's appointments (with the court
   appearance's two travel blocks and the networking dinner's travel, arrival and overnight stay: 18 events) in Google
   Calendar. (It used to end with 19 screenshots uploaded to the trainee's folder, which the trainer compared with the
   activity by eye: no screenshots are asked for or scored any more.) The trainee records what each event holds here (#/calcheck), and every field is checked as they type against the activity's answer key:
     • the title (it must name the event; case, spacing and dashes don't matter);
     • the start and end dates and times, exactly (or the same moment in Pacific Time, the attorney's: see TZ_RULE), and
       the end after the start;
     • the time zone, in the event's region (see TZ_RULE below);
     • the location, the guests (each by first and last name) and the reminder (its type, and its time: 1 day = 24 hours);
     • the key details in the description (a few words per event);
   An event with no guests, location or reminder in the activity is never marked down for leaving them empty.
   What is typed is kept as a draft; 📤 Submit to my trainer stamps the time and keeps that submission's results.
   The activity's dates: July 6–15, 2026 in its words and in KEY, moved by whole weeks to the trainee's anchor Monday (the
   first on or after their batch's Day 5: FTCalCore.act, js/ft-calsim-core.js). The anchor is kept ONCE, in the trainee's
   calendar record (calsim:<id>.anchors["attorney-activity"]); load() reads it from there (or gives it one, from the Batch ID)
   and the record below keeps a copy (anchor), as each snapshot does, so a submission is always scored at its own dates
   (keyFor). A record from before anchors (entries or submissions, no anchor) keeps July 2026.
   Records: calcheck:<id> (the trainee's own; worker.js lets a trainee write only theirs, admins read everyone's)
     {anchor:"YYYY-MM-DD", entries:{"<n>":{title, sd, st, ed, et, tz, allday, loc, guests, rtype, ramt, runit, notes}}, saved, submits:[{at, met, total, pct, checks:[[n, field, met, fix]], snap:{anchor, entries}}]}
   🏅 My Performance shows the latest submission (📅 Calendar activity check); Admin → 🛠 Practice Lab → 📅 Calendar
   Activity lists each trainee's latest submission with every field's result.
   ============================================================ */
(function(){
"use strict";
const e = v => esc(String(v == null ? "" : v));
const has = v => String(v == null ? "" : v).trim().length > 0;
const obj = v => v && typeof v === "object" && !Array.isArray(v) ? v : {};
// for comparing words: accents, apostrophes, dashes, slashes, case and spacing don't matter ("Doctor’s" → "doctors")
const norm = v => String(v == null ? "" : v).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’'`]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const words = v => " " + norm(v) + " ";
const mins = t => { const m = String(t || "").match(/^(\d{1,2}):(\d\d)/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const hhmm = t => { const n = mins(t); if(n == null) return ""; const h = Math.floor(n / 60), m = n % 60; return `${(h + 11) % 12 + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const day = d => { const m = String(d || "").match(/^(\d{4})-(\d\d)-(\d\d)$/); return m ? `${MON[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : ""; };

/* ---------- Google Calendar's time zones ----------
   TZ_RULE: the activity writes PST, MST, EST and CST: they name the US region, and the time is that region's wall clock
   on the event's own date, standard or daylight as that date has it (an anchor in the summer is daylight time, one in the
   winter standard). Google Calendar names zones by region, not by standard/daylight, so the check takes the wall-clock
   times exactly as the activity writes them and asks only for a zone in the right region: PST → Pacific Time - Los
   Angeles; MST → Mountain Time - Denver or Mountain Standard Time - Phoenix (Arizona keeps MST all year); EST → Eastern
   Time - New York or Eastern Standard Time - Panama (the trainer's sample); CST → Central Time - Chicago (the sample) or
   Central Standard Time - Regina. The offsets shown are each zone's on the event's own date (tzOpts).
   The attorney's own calendar is in Pacific Time (Seattle), so an event typed in Pacific Time - Los Angeles at the same
   moment also counts: the activity's time in the region's first zone (Denver, New York, Chicago), e.g. the 3:00–4:00 PM
   MST team meeting as 2:00–3:00 PM Pacific. Its dates, times and zone are then checked against that Pacific time
   (PAC_OF); the activity's own clock time in Pacific (3:00–4:00 PM) is still the wrong zone. The Pacific moment of the
   region's other accepted zone counts too (PACS_OF: 11 AM EST in Panama is 9 AM Pacific in the summer), except where it
   falls on the activity's own clock time (Phoenix in the summer: see PACS_OF). In the winter Phoenix, Panama and Regina keep
   the same time as Denver, New York and Chicago, so only the first zone's Pacific moment counts (9 AM is then wrong). */
// (the options put the city first, so it still shows on a phone's narrow list: Google shows "(GMT-07:00) Pacific Time - Los Angeles";
// the ids and their order are FTCalCore.act's TZS too. The offset is added per event, on its own date: tzOpts)
const TZ = [["America/Los_Angeles", "Los Angeles · Pacific Time"], ["America/Denver", "Denver · Mountain Time"],
  ["America/Phoenix", "Phoenix · Mountain Standard Time"], ["America/Chicago", "Chicago · Central Time"],
  ["America/Regina", "Regina · Central Standard Time"], ["America/New_York", "New York · Eastern Time"],
  ["America/Panama", "Panama · Eastern Standard Time"], ["Pacific/Honolulu", "Honolulu · Hawaii-Aleutian Standard Time"],
  ["America/Anchorage", "Anchorage · Alaska Time"], ["Asia/Manila", "Manila · Philippine Time"],
  ["Etc/UTC", "UTC"], ["Europe/London", "London · United Kingdom Time"]];
// the summer's offsets: the labels when neither the core nor Intl can give the date's own
const TZ_JULY = ["-07:00", "-06:00", "-07:00", "-05:00", "-06:00", "-04:00", "-05:00", "-10:00", "-08:00", "+08:00", "+00:00", "+01:00"];
const REGION = {PST: {ok: ["America/Los_Angeles"], region: "Pacific", say: "Pacific Time - Los Angeles"},
  MST: {ok: ["America/Denver", "America/Phoenix"], region: "Mountain", say: "Mountain Time - Denver (or Mountain Standard Time - Phoenix)"},
  EST: {ok: ["America/New_York", "America/Panama"], region: "Eastern", say: "Eastern Time - New York (or Eastern Standard Time - Panama)"},
  CST: {ok: ["America/Chicago", "America/Regina"], region: "Central", say: "Central Time - Chicago (or Central Standard Time - Regina)"}};
// the same moment as a wall-clock date and time in another zone ({d: "2026-07-07", t: "14:00"}), from Intl's offsets
const PAC = "America/Los_Angeles";
function offAt(tz, ms){
  const p = {}; new Intl.DateTimeFormat("en-US", {timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric"})
    .formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - ms) / 60000);
}
function moveZone(d, t, from, to){
  const m = String(d || "").match(/^(\d{4})-(\d\d)-(\d\d)$/), n = mins(t); if(!m || n == null) return null;
  try{ const l = Date.UTC(+m[1], +m[2] - 1, +m[3]) + n * 60000, ms = l - offAt(from, l - offAt(from, l) * 60000) * 60000, w = new Date(ms + offAt(to, ms) * 60000).toISOString();
    return {d: w.slice(0, 10), t: w.slice(11, 16)}; }catch(_){ return null; }
}
// an event outside Pacific: the activity's time as the attorney's Pacific calendar shows it (null for PST and the overnight stay)
const PACS = new Map();
function PAC_OF(k){
  if(k.tz === "PST" || k.overnight || !REGION[k.tz]) return null;
  if(!PACS.has(k)){ const z = REGION[k.tz].ok[0], s = moveZone(k.date, k.start, z, PAC), e = moveZone(k.endDate || k.date, k.end, z, PAC);
    PACS.set(k, s && e ? {sd: s.d, st: s.t, ed: e.d, et: e.t} : null); }
  return PACS.get(k);
}
// every Pacific time the Check accepts for it: the same moment as each zone the Check accepts at the activity's clock time
// (Denver or Phoenix, New York or Panama, Chicago or Regina; the first zone's first), on the event's own date. One that falls on
// the activity's own clock time is left out: 3:00 PM MST in Phoenix is 3:00 PM Pacific in the summer, but 3:00 PM typed in
// Pacific can't be told from the time left unconverted, the mistake this field is there to catch, so Phoenix counts only when
// Phoenix is the zone picked. One that is the first zone's moment again (Panama and New York in the winter) isn't listed twice.
// (Cached by the key's own objects: keyFor gives the same ones for an anchor every time.)
const PACL = new Map();
function PACS_OF(k){
  if(!PACL.has(k)){ const first = PAC_OF(k), out = first ? [Object.assign({z: REGION[k.tz].ok[0]}, first)] : [];
    if(first) REGION[k.tz].ok.slice(1).forEach(z => { const s = moveZone(k.date, k.start, z, PAC), e = moveZone(k.endDate || k.date, k.end, z, PAC);
      if(s && e && !(s.d === k.date && s.t === k.start && e.d === (k.endDate || k.date) && e.t === k.end) && !out.some(w => w.st === s.t && w.sd === s.d)) out.push({z, sd: s.d, st: s.t, ed: e.d, et: e.t}); });
    PACL.set(k, out); }
  return PACL.get(k);
}
const UNITS = [["minutes", 1], ["hours", 60], ["days", 1440], ["weeks", 10080]];

/* ---------- the activity's answer key (its own dates, July 2026: keyFor moves them to an anchor; wall-clock times in the zone given) ----------
   title: word groups the title must hold (each group: any one of its phrases); loc: the location holds one of these;
   guests: each by first and last name; rem: the reminder's type and its time in minutes; notes: word groups the
   description holds (notesMin of them, or all); link: a link in the location or the description; overnight: 8.5;
   dir: the way a flight goes (its title mustn't name it the other way round); not: words that name the other travel block.
   alt: the activity gives the travel to San Francisco's "1-day reminder (email)" and its notes for the whole travel block
   (8.2 and 8.3), and the return travel's for 8.6 and 8.7, so they count once per block, on whichever event holds them. */
const MA = "Martin Anthony", MV = "Michelle Velarde", TEAM = [MA, MV, "John Michael Dela Cruz", "Lei Lee Abut"];
const KEY = [
  {n: "1", name: "Client Meeting", title: [["client meeting"]], date: "2026-07-06", start: "10:00", end: "11:00", tz: "PST",
    loc: ["conference room b"], locShow: "Conference Room B", guests: [MA, MV], rem: {type: "Notification", m: 15, show: "15 minutes"},
    notes: [["alyssa lynn arehart", "alyssa arehart"], ["car accident"], ["case documents", "documents"]], notesShow: "Alyssa Lynn Arehart · car accident · case documents accessible",
    plus: "Adding the client’s name (Alyssa Lynn Arehart) to the title is a plus."},
  {n: "2", name: "Team Meeting", title: [["team meeting"]], date: "2026-07-07", start: "15:00", end: "16:00", tz: "MST",
    loc: ["google meet", "meet google com"], locShow: "Google Meet", guests: TEAM, rem: {type: "Email", m: 30, show: "30 minutes"},
    notes: [["weekly"], ["check in", "checkin"]], notesShow: "Weekly team check-in"},
  {n: "3", name: "Deposition Meeting", title: [["deposition meeting", "deposition"]], date: "2026-07-08", start: "11:00", end: "13:00", tz: "EST",
    loc: ["attorneys office", "attorney office"], locShow: "Attorney’s Office (or Zoom for remote attendees)", guests: [MA, MV], rem: {type: "Email", m: 1440, show: "1 day"},
    notes: [["deposition preparation", "deposition prep", "prepare for the deposition", "preparation"], ["another attorney", "other attorney", "opposing counsel"]], notesShow: "Deposition preparation with another attorney",
    link: "zoom.us/deposition-meeting-02-04-25"},
  {n: "4", name: "Gym Session", title: [["gym session", "gym"]], date: "2026-07-08", start: "06:30", end: "07:30", tz: "EST",
    loc: ["downtown seattle fitness center", "seattle fitness center", "fitness center", "fitness centre"], locShow: "Downtown Seattle Fitness Center", rem: {type: "Notification", m: 10, show: "10 minutes"},
    notes: [["workout", "work out"]], notesShow: "Morning workout"},
  {n: "5", name: "Doctor’s Appointment", title: [["doctors appointment", "doctor appointment", "doctors appt"]], date: "2026-07-09", start: "09:00", end: "10:00", tz: "PST",
    loc: ["central medical clinic"], locShow: "Central Medical Clinic", rem: {type: "Email", m: 1440, show: "1 day"},
    notes: [["check up", "checkup"], ["documents", "insurance"]], notesShow: "Routine check-up · prepare documents or insurance details"},
  {n: "6.1", name: "Court Appearance", title: [["court appearance"]], date: "2026-07-10", start: "09:00", end: "12:00", tz: "PST",
    loc: ["washington county court"], locShow: "Washington County Court", rem: {type: "Notification", m: 30, show: "30 minutes"},
    notes: [["hearing"]], notesShow: "The attorney’s scheduled court hearing"},
  {n: "6.2", name: "Travel Block for travel to court", title: [["travel"], ["court"]], not: ["from court", "return"], date: "2026-07-10", start: "08:00", end: "09:00", tz: "PST"},
  {n: "6.3", name: "Travel Block for return travel", title: [["travel"], ["return"]], not: ["to court"], date: "2026-07-10", start: "12:00", end: "13:00", tz: "PST"},
  {n: "7", name: "Recorded Statement Meeting", title: [["recorded statement"]], date: "2026-07-10", start: "16:00", end: "17:00", tz: "CST",
    loc: ["google meet", "meet google com"], locShow: "Google Meet", guests: TEAM, rem: {type: "Notification", m: 15, show: "15 minutes"},
    notes: [["insurance adjuster", "adjuster"], ["premises liability"]], notesShow: "With an insurance adjuster · premises liability case"},
  {n: "8.1", name: "Networking Dinner Event", title: [["networking"]], date: "2026-07-13", start: "18:00", end: "20:00", tz: "PST",
    loc: ["ritz carlton"], locShow: "The Ritz-Carlton, San Francisco (600 Stockton St)", rem: {type: "Notification", m: 30, show: "30 minutes"},
    notes: [["business cards", "business card"], ["introduction", "intro"]], notesShow: "Bring business cards · prepare a short personal introduction"},
  {n: "8.2", name: "Transportation to Seattle Airport (SEA)", title: [["transportation", "transport", "travel", "ride"], ["seattle", "sea", "airport"]], date: "2026-07-13", start: "08:30", end: "09:00", tz: "PST"},
  {n: "8.3", name: "Flight from Seattle (SEA) to San Francisco (SFO)", title: [["flight"], ["san francisco", "sfo"]], dir: {from: ["seattle", "sea"], to: ["san francisco", "sfo"]}, date: "2026-07-13", start: "09:00", end: "12:00", tz: "PST",
    alt: "8.2", rem: {type: "Email", m: 1440, show: "1 day"}, notes: [["flight details", "confirm flight", "flight"], ["luggage", "baggage"], ["travel documents"], ["business cards", "business card"], ["attire"]], notesMin: 3,
    notesShow: "Confirm flight details · check in luggage · travel documents · business cards · attire (at least 3)"},
  {n: "8.4", name: "Event Proper Arrival Block time", title: [["arrival", "arrive"]], date: "2026-07-13", start: "17:45", end: "18:00", tz: "PST"},
  {n: "8.5", name: "Overnight Stay", title: [["overnight", "hotel stay"]], date: "2026-07-13", endDate: "2026-07-14", tz: "PST", overnight: true,
    notes: [["hotel"], ["transportation", "transport", "ride"]], notesShow: "Confirm hotel booking · plan transportation after the event"},
  {n: "8.6", name: "Check out of the hotel and travel to the airport", title: [["check out", "checkout", "hotel"], ["airport", "travel"]], date: "2026-07-14", start: "08:00", end: "08:30", tz: "PST",
    alt: "8.7", rem: {type: "Email", m: 1440, show: "1 day"}, notes: [["check out", "checkout"], ["transportation", "transport", "airport"]], notesShow: "Confirm hotel check-out and transportation to the airport"},
  {n: "8.7", name: "Flight from San Francisco (SFO) to Seattle (SEA)", title: [["flight"], ["seattle", "sea"]], dir: {from: ["san francisco", "sfo"], to: ["seattle", "sea"]}, date: "2026-07-14", start: "10:00", end: "13:00", tz: "PST"},
  {n: "9", name: "Document Review Session", title: [["document review"]], date: "2026-07-15", start: "13:30", end: "15:00", tz: "CST",
    loc: ["attorneys office", "attorney office"], locShow: "Attorney’s Office", rem: {type: "Notification", m: 30, show: "30 minutes"},
    notes: [["high priority"], ["case file", "case"]], notesShow: "Review a high-priority case file"},
  {n: "10", name: "Family Dinner", title: [["family dinner"]], date: "2026-07-15", start: "19:00", end: "21:00", tz: "MST",
    loc: ["home"], locShow: "Home", rem: {type: "Notification", m: 60, show: "1 hour"}, notes: [["groceries", "grocery"]], notesShow: "Pick up groceries on the way home"}
];
/* ---------- the anchor: the key at a trainee's dates ----------
   FTCalCore.act (js/ft-calsim-core.js, loaded before this file) knows the anchors; without it (a page or a test that loads only
   this file) the same date sums are done here. An anchor that isn't one (not a Monday on or after July 6, 2026) is July. */
const JULY = "2026-07-06";
const CORE = () => { const C = (typeof window !== "undefined" && window.FTCalCore) || (typeof FTCalCore !== "undefined" ? FTCalCore : null); return C && C.act ? C.act : null; };
const isoMs = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const okAnchor = a => { const A = CORE(); if(A) return A.okAnchor(a);
  return /^\d{4}-\d\d-\d\d$/.test(String(a)) && new Date(isoMs(a)).toISOString().slice(0, 10) === a && new Date(isoMs(a)).getUTCDay() === 1 && a >= JULY; };
const weeksOf = a => { const A = CORE(); return !okAnchor(a) ? 0 : A ? A.weeksOf(a) : Math.round((isoMs(a) - isoMs(JULY)) / (7 * 864e5)); };
const shiftIso = (iso, k) => new Date(isoMs(iso) + k * 7 * 864e5).toISOString().slice(0, 10);
// a record's (or a snapshot's) anchor: its own, else July 2026 (a record from before anchors)
const anchorOf = rec => okAnchor(obj(rec).anchor) ? rec.anchor : JULY;
// KEY at an anchor: date and endDate moved by its weeks. The same objects for an anchor every time (PACS / PACL and the
// simulator's key list are cached by them); keyFor(JULY) is KEY itself.
const KEYS = new Map([[0, KEY]]);
function keyFor(anchor){
  const k = weeksOf(anchor); let K = KEYS.get(k); if(K) return K;
  K = KEY.map(x => Object.assign({}, x, {date: shiftIso(x.date, k)}, x.endDate ? {endDate: shiftIso(x.endDate, k)} : {}));
  KEYS.set(k, K); return K;
}
// the anchor an unnamed record is checked at (the simulator's review passes {entries} alone): the core's current one
const anchorNowSet = () => { const A = CORE(); return A ? A.anchor() : JULY; };
// a date's long form ("November 2, 2026") and the activity's span at an anchor ("Nov 2 to Nov 11, 2026")
const spanOf = anchor => { const A = CORE(), last = A ? A.LAST : 9;
  return A ? A.withAnchor(anchor, () => `${A.spanText(last)}, ${A.dYear(last)}`) : `${day(anchor)} to ${day(new Date(isoMs(anchor) + last * 864e5).toISOString().slice(0, 10))}`; };
// the zones' options for an event's date, each with its offset at noon that day (standard or daylight as the date has it;
// absAt counts from whatever anchor the core is at, and tzLabel reads the zone at that very instant, so any anchor will do)
const TZO = new Map();
function tzOpts(date){
  if(TZO.has(date)) return TZO.get(date);
  const A = CORE(), ok = /^\d{4}-\d\d-\d\d$/.test(String(date));
  const out = TZ.map(([id, label], i) => { let g = "";
    try{ if(ok && A){ const z = A.TZS[i] && A.TZS[i].id === id ? A.TZS[i] : A.tzOf(id); if(z) g = (A.tzLabel(z, A.absAt(date, 720, z.id)).match(/GMT[+-]\d\d:\d\d/) || [""])[0]; }
      else if(ok){ const o = offAt(id, isoMs(date) + 20 * 3600000), a = Math.abs(o); g = `GMT${o < 0 ? "-" : "+"}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`; } }catch(_){}
    return [id, `${label} (${g || "GMT" + TZ_JULY[i]})`]; });
  TZO.set(date, out); return out;
}
const keyOf = (n, K) => (K || KEY).find(k => k.n === n);

/* ---------- the check ---------- */
const inW = (txt, p) => txt.includes(" " + norm(p) + " ");
const groupsIn = (txt, gs) => gs.filter(g => g.some(p => inW(txt, p)));
// a title that names the other travel block, or a flight the wrong way round ("from <where it lands>", "to <where it
// leaves>", or with no from/to, the landing city named first)
function wrongWay(k, t){
  if(k.not && k.not.some(p => inW(t, p))) return true;
  if(!k.dir) return false;
  const cue = (pre, list) => list.some(p => inW(t, pre + " " + p)), at = list => Math.min(...list.map(p => { const i = t.indexOf(" " + norm(p) + " "); return i < 0 ? Infinity : i; }));
  if(cue("from", k.dir.to) || cue("to", k.dir.from)) return true;
  if(cue("from", k.dir.from) || cue("to", k.dir.to)) return false;
  const a = at(k.dir.from), b = at(k.dir.to); return a < Infinity && b < Infinity && a > b;
}
// the reminder and the description; ents: every entry, for a travel block's reminder held on its other event (alt)
function remRows(k, v){
  const unit = (UNITS.find(u => u[0] === v.runit) || [])[1], amt = Number(v.ramt), on = k.alt ? ` (on ${[k.alt, k.n].sort().join(" or ")}: either event of the travel block)` : "";
  const got = k.notes ? groupsIn(words(v.notes), k.notes) : [], need = k.notes ? k.notesMin || k.notes.length : 0;
  return [["Reminder type", k.rem ? v.rtype === k.rem.type : null, k.rem ? `${k.rem.type}${on}` : ""],
    ["Reminder time", k.rem ? !!unit && amt > 0 && amt * unit === k.rem.m : null, k.rem ? `${k.rem.show} before${on}` : ""],
    ["Description", k.notes ? got.length >= need : null, k.notes ? `Include: ${k.notesShow}${got.length < need ? ` (missing: ${k.notes.filter(g => !got.includes(g)).map(g => `“${g[0]}”`).join(", ")})` : ""}${on}` : ""]];
}
// [field, met (true/false, or null when the activity asks nothing of it), what to fix (quoting the activity)]
function check(k, v, ents){
  v = obj(v);
  let pac = false;
  const allDay = !!v.allday, title = words(v.title), when = `${day(k.date)}, ${hhmm(k.start)} – ${hhmm(k.end)} ${k.tz}`;
  const out = [["Title", has(v.title) && groupsIn(title, k.title).length === k.title.length && !wrongWay(k, title), `Name it “${k.n} ${k.name}”${k.plus ? ". " + k.plus : ""}`]];
  if(k.overnight){
    // the overnight stay: an all-day event on the networking dinner's day (July 13 in the activity's own dates; Google may show
    // it ending on that day or the next), or an event that starts that evening and ends the next morning
    out.push(["Start date", v.sd === k.date, `${day(k.date)} (the night of the networking dinner)`]);
    out.push(["End date", allDay ? !has(v.ed) || v.ed === k.date || v.ed === k.endDate : v.ed === k.endDate, allDay ? `${day(k.date)} (all day) or ${day(k.endDate)}` : `${day(k.endDate)}: the stay runs overnight`]);
    out.push(["Start time", null, ""], ["End time", null, ""]);
  } else {
    // typed in Pacific: the same moment in Pacific, unless more of the four fields match the activity's own clock time
    const own = {sd: k.date, st: k.start, ed: k.endDate || k.date, et: k.end}, hits = w => ["sd", "st", "ed", "et"].filter(f => v[f] === w[f]).length;
    const pt = PACS_OF(k).reduce((b, w) => !b || hits(w) > hits(b) ? w : b, null);
    pac = !allDay && v.tz === PAC && !!pt && hits(pt) >= hits(own);
    const zn = pt && pt.z !== REGION[k.tz].ok[0] ? ` in ${(TZ.find(t => t[0] === pt.z) || [, pt.z])[1].replace(/ \(GMT.*$/, "").split(" · ").reverse().join(" - ")}` : "";
    const w = pac ? pt : own, at = pac ? ` Pacific (the same moment as ${when}${zn})` : ` (${when})`;
    out.push(["Start date", v.sd === w.sd, day(w.sd)], ["End date", v.ed === w.ed, day(w.ed)]);
    out.push(["Start time", !allDay && v.st === w.st, allDay ? `Not all day: it starts at ${hhmm(k.start)}` : `${hhmm(w.st)}${at}`]);
    out.push(["End time", !allDay && v.et === w.et, allDay ? `Not all day: it ends at ${hhmm(k.end)}` : `${hhmm(w.et)}${at}`]);
  }
  const a = allDay ? (v.sd || "") : `${v.sd || ""}T${v.st || ""}`, b = allDay ? (v.ed || v.sd || "") : `${v.ed || ""}T${v.et || ""}`;
  const okOrder = has(v.sd) && (allDay ? b >= a : has(v.st) && has(v.ed) && has(v.et) && b > a);
  out.push(["Ends after it starts", okOrder, "The end date and time come after the start"]);
  // (the overnight stay has no time to check, so its zone counts only once a start time is entered)
  const pt = PAC_OF(k);
  out.push(["Time zone", allDay || (k.overnight && !has(v.st)) ? null : pac || REGION[k.tz].ok.includes(v.tz),
    `${k.tz} means the ${REGION[k.tz].region} zone: “${REGION[k.tz].say}”${pt ? `, or keep Pacific Time - Los Angeles (the attorney’s calendar) and enter ${hhmm(pt.st)} – ${hhmm(pt.et)}, the same moment` : ""}`]);
  out.push(["Location", k.loc ? has(v.loc) && k.loc.some(p => words(v.loc).includes(" " + norm(p) + " ")) : null, k.loc ? `“${k.locShow}”` : ""]);
  if(k.link) out.push(["Zoom link for remote attendees", words(`${v.loc || ""} ${v.notes || ""}`).includes(" " + norm(k.link) + " "), `Add ${k.link} to the location or the description`]);
  const gw = words(v.guests), missing = (k.guests || []).filter(g => norm(g).split(" ").some(w => !gw.includes(" " + w + " ")));
  out.push(["Guests", k.guests ? !missing.length : null, k.guests ? `Invite ${missing.length ? missing.join(", ") : k.guests.join(", ")} (all of: ${k.guests.join(", ")}), each by name as Google Calendar shows it` : ""]);
  // a travel block's reminder and notes: whichever of its two events holds more of them
  let rows = remRows(k, v);
  if(k.alt && ents){ const other = remRows(k, obj(ents[k.alt])), met = rs => rs.filter(c => c[1]).length; if(met(other) > met(rows)) rows = other; }
  return out.concat(rows);
}
// a record's every row, at an anchor: the one given, else the record's own, else the core's current one (the simulator's review
// passes {entries} alone, at the trainee's anchor; with no core, July)
function checkAll(rec, anchor){
  rec = obj(rec); const rows = [], ents = obj(rec.entries);
  keyFor(okAnchor(anchor) ? anchor : okAnchor(rec.anchor) ? rec.anchor : anchorNowSet()).forEach(k => check(k, ents[k.n], ents).forEach(c => rows.push([k.n, c[0], c[1], c[2]])));
  return rows;
}
const score = rows => { const on = rows.filter(c => c[c.length === 4 ? 2 : 1] !== null), met = on.filter(c => c[c.length === 4 ? 2 : 1]).length; return {met, total: on.length, pct: on.length ? Math.round(met / on.length * 100) : 0}; };

/* ---------- the trainee's record ---------- */
const R = {rec: null, recId: null, open: {"1": true}, timer: null, status: "", busy: false, failed: false, loading: null};
const blank = () => ({entries: {}, saved: "", submits: []});
// the key at the page's record's anchor
const curKey = () => keyFor(anchorOf(R.rec));
// a stored record made safe to read: every entry an object, and only the submissions that hold a snapshot
const clean = v => { v = obj(v); const r = Object.assign(blank(), v); r.entries = {}; Object.keys(obj(v.entries)).forEach(n => { r.entries[n] = obj(v.entries[n]); });
  if(!okAnchor(r.anchor)) delete r.anchor; delete r.final; delete r.drive;   // (the screenshots' self-check and folder lookup, no longer asked)
  r.submits = (Array.isArray(r.submits) ? r.submits : []).filter(s => s && typeof s === "object" && s.snap && typeof s.snap === "object"); return r; };
// 👁 Trainee view: a trainer has no trainee of their own, so the page shows empty and saves nothing
const PREVIEW = "__preview";
const preview = () => !state.traineeId;
const previewOnly = () => { if(!preview()) return false; toast("👁 Trainee view — nothing is saved here. A trainee checks their own calendar."); return true; };
// The record is read strictly: a failed read must not look like "no record", or the next keystroke would save an empty
// form over the trainee's draft and submissions. Until a read succeeds, nothing is saved.
// The anchor is read with it, from the trainee's calendar record (calsim:<id>, read just as strictly: it is written back when it
// gets its anchor, so a failed read must never become an empty calendar). A trainer's 👁 Trainee view shows the dates a batch
// starting this week would get, and saves none.
function load(force){
  if(preview()){ if(R.recId !== PREVIEW){ R.recId = PREVIEW; R.rec = blank(); const A = CORE(); R.rec.anchor = A ? A.anchorNow() : JULY; R.failed = false; } return Promise.resolve(); }
  const id = state.traineeId;
  if(!force && R.recId === id && (R.rec || R.failed)) return Promise.resolve();   // (after a failed read, only ↻ Try again reads again)
  if(R.loading && R.recId === id) return R.loading;
  R.recId = id;
  return R.loading = Promise.all([sharedGetStrict("calcheck:" + id), sharedGetStrict("calsim:" + id)]).then(async ([v, cal]) => {
    const rec = v && v.entries && typeof v.entries === "object" ? clean(v) : blank();
    rec.anchor = await anchorFor(id, rec, cal); R.rec = rec; R.failed = false; })
    .catch(() => { R.failed = !R.rec; })
    .then(() => { R.loading = null; if(state.view === "calcheck") render(); });
}
// the trainee's anchor: this record's own once kept; a Check record from before anchors (entries or submissions, no anchor)
// keeps July 2026, the dates it was typed against; otherwise the calendar record's (FTCalCore.act.anchorOfRecord: its own, or
// July for a calendar from before anchors), else the Batch ID's, the same one js/ft-calendar.js will keep in the calendar
// record (its one writer: this page never writes that record, so a draft saved meanwhile is safe)
async function anchorFor(id, rec, cal){
  // (this record's own anchor first: once kept, its entries were typed against it, July 2026 for a record from before anchors)
  if(okAnchor(rec.anchor)) return rec.anchor;
  const A = CORE(); if(!A) return JULY;
  if(Object.keys(rec.entries).some(n => touched(rec.entries[n])) || rec.submits.length) return JULY;
  return A.anchorOfRecord(cal) || A.anchorForBatch(state.traineeBatch) || A.anchorNow();
}
function save(){
  clearTimeout(R.timer); R.timer = null;
  if(!R.rec || preview()){ R.status = preview() ? "👁 Trainee view — nothing is saved" : ""; paintStatus(); return Promise.resolve(false); }
  R.rec.saved = new Date().toISOString();
  return sharedSet("calcheck:" + state.traineeId, R.rec).then(ok => { R.status = ok === false ? "Couldn’t save the draft. Check your connection." : "Draft saved ✓"; paintStatus(); return ok; });
}
const queue = () => { clearTimeout(R.timer); R.status = "Saving…"; paintStatus(); R.timer = setTimeout(save, 1000); };
const FIELDS = ["title", "sd", "st", "ed", "et", "tz", "allday", "loc", "guests", "rtype", "ramt", "runit", "notes"];
function readItem(box){
  const v = {}; FIELDS.forEach(f => { const el = box.querySelector(`[data-f="${f}"]`); if(el) v[f] = el.type === "checkbox" ? el.checked : String(el.value || "").trim().slice(0, 1500); });
  return v;
}
// one field typed in: that event is checked again in place (the page isn't redrawn, so the cursor stays put)
function edit(ev){
  const t = ev && ev.target; if(!t || !R.rec) return;
  if(t.type === "checkbox" && ev.type !== "change") return;   // (a checkbox sends both events: one is enough)
  const box = t.closest(".cc-item[data-n]");
  if(box){ const n = box.getAttribute("data-n"); R.rec.entries[n] = readItem(box);
    if(t.getAttribute("data-f") === "allday"){ render(); queue(); return; }
    paintItem(n); KEY.filter(k => k.alt === n).forEach(k => paintItem(k.n)); }
  paintTotal(); queue();
}
// what the trainee typed in an event (the unit's default and an unticked all day aren't typing)
const touched = v => { v = obj(v); return v.allday === true || FIELDS.some(f => f !== "runit" && f !== "allday" && has(v[f])); };
// a submission keeps a snapshot of what was entered, and the trainer's tab and My Performance score that snapshot again,
// so they never rely on a score the page stored
// (with its anchor: a snapshot is scored at the dates it was typed against; one from before anchors, July)
const snapOf = rec => JSON.parse(JSON.stringify({anchor: anchorOf(rec), entries: rec.entries}));
const scored = s => { const rows = checkAll(s.snap, anchorOf(s.snap)); return Object.assign({rows}, score(rows)); };
async function submit(){
  if(previewOnly()) return;
  await load(); if(!R.rec){ toast("Your draft couldn’t be loaded. Check your connection and try again."); return; }
  if(R.timer) clearTimeout(R.timer);
  const rows = checkAll(R.rec, anchorOf(R.rec)), sc = score(rows);
  if(!Object.keys(R.rec.entries).some(n => touched(R.rec.entries[n]))){ toast("Enter what you put in Google Calendar first."); return; }
  const at = new Date().toISOString();
  R.rec.submits = (R.rec.submits || []).concat([{at, met: sc.met, total: sc.total, pct: sc.pct, checks: rows, snap: snapOf(R.rec)}]).slice(-8);
  render();
  const ok = await save();
  toast(ok === false ? "Couldn’t send it. Check your connection." : `📤 Sent to your trainer: ${sc.met} of ${sc.total} fields right (${sc.pct}%).`);
}

/* ---------- the page ---------- */
const chip = v => v === null ? `<span class="cc-na">—</span>` : v ? `<span class="cc-ok">✓</span>` : `<span class="cc-no">✗</span>`;
const pctCls = p => p >= 80 ? "ok" : p >= 60 ? "mid" : "low";
// pending: nothing typed in the event yet, so each field shows what the activity expects, not a ✗
function resHtml(rows, pending){
  const on = rows.filter(c => c[1] !== null);
  if(pending) return `<ul class="cc-res pending">${on.map(c => `<li>${chip(null)}<span><b>${e(c[0])}</b><small>${e(c[2] || "As in the activity")}</small></span></li>`).join("")}</ul>`;
  return `<ul class="cc-res">${on.map(c => `<li class="${c[1] ? "" : "miss"}">${chip(c[1])}<span><b>${e(c[0])}</b>${c[1] ? "" : `<small>${e(c[2])}</small>`}</span></li>`).join("")}</ul>`;
}
const itemScore = (k, v) => score(check(k, v, R.rec.entries));
function itemHtml(k){
  const v = R.rec.entries[k.n] || {}, sc = itemScore(k, v), go = touched(v), id = f => `cc-${f}-${k.n.replace(".", "-")}`;
  const opt = (list, cur, blankTxt) => (blankTxt != null ? `<option value="">${blankTxt}</option>` : "") + list.map(x => { const [val, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${e(val)}" ${val === cur ? "selected" : ""}>${e(t)}</option>`; }).join("");
  const L = (f, label, inner, cls) => `<label class="${cls || ""}" for="${id(f)}"><span class="cc-lbl">${label}</span>${inner}</label>`;
  return `<details class="cc-item" data-n="${e(k.n)}" ${R.open[k.n] ? "open" : ""} ontoggle="FTCalCheck.toggle('${e(k.n)}', this.open)">
    <summary><span class="cc-n">${e(k.n)}</span><span class="cc-name">${e(k.name)}</span><span class="cc-sc ${go ? pctCls(sc.pct) : "none"}" data-sc="${e(k.n)}">${go ? `${sc.met}/${sc.total}` : "—"}</span></summary>
    <div class="cc-body"><div class="cc-grid">
      ${L("title", "Title", `<input id="${id("title")}" data-f="title" value="${e(v.title || "")}" autocomplete="off" maxlength="200">`, "w")}
      ${L("sd", "Start date", `<input type="date" id="${id("sd")}" data-f="sd" value="${e(v.sd || "")}">`)}
      ${v.allday ? "" : L("st", "Start time", `<input type="time" id="${id("st")}" data-f="st" value="${e(v.st || "")}">`)}
      ${L("ed", "End date", `<input type="date" id="${id("ed")}" data-f="ed" value="${e(v.ed || "")}">`)}
      ${v.allday ? "" : L("et", "End time", `<input type="time" id="${id("et")}" data-f="et" value="${e(v.et || "")}">`)}
      <label class="ck"><input type="checkbox" data-f="allday" ${v.allday ? "checked" : ""}> All day</label>
      ${v.allday ? "" : L("tz", "Time zone", `<select id="${id("tz")}" data-f="tz">${opt(tzOpts(k.date), v.tz, "Pick the event’s time zone…")}</select>`, "w2 tz")}
      ${L("loc", "Location", `<input id="${id("loc")}" data-f="loc" value="${e(v.loc || "")}" autocomplete="off" maxlength="300">`, "w2")}
      ${L("guests", "Guests (names as shown)", `<input id="${id("guests")}" data-f="guests" value="${e(v.guests || "")}" autocomplete="off" maxlength="400">`, "w2")}
      ${L("rtype", "Reminder", `<select id="${id("rtype")}" data-f="rtype">${opt(["Notification", "Email"], v.rtype, "None")}</select>`)}
      ${L("ramt", "Amount", `<input type="number" min="0" id="${id("ramt")}" data-f="ramt" value="${e(v.ramt || "")}">`)}
      ${L("runit", "Unit", `<select id="${id("runit")}" data-f="runit">${opt(UNITS.map(u => u[0]), v.runit || "minutes")}</select>`)}
      ${L("notes", "Description / notes", `<textarea id="${id("notes")}" data-f="notes" rows="3" maxlength="1500">${e(v.notes || "")}</textarea>`, "w")}
    </div><div class="cc-out" data-res="${e(k.n)}">${resHtml(check(k, v, R.rec.entries), !go)}</div></div></details>`;
}
const started = () => KEY.some(k => touched(R.rec.entries[k.n]));
function summaryHtml(){
  const sc = score(checkAll(R.rec, anchorOf(R.rec))), go = started();
  return `<div class="cc-total"><span class="cc-big ${go ? pctCls(sc.pct) : "none"}">${go ? sc.pct + "%" : "—"}</span><span><b>${sc.met} of ${sc.total} fields right</b><small>${e(R.status || (R.rec.saved ? "Draft saved ✓" : preview() ? "👁 Trainee view — nothing is saved" : "Your entries save as a draft as you type"))}</small></span></div>`;
}
function fixHtml(){
  const miss = checkAll(R.rec, anchorOf(R.rec)).filter(c => c[2] === false), byItem = {}; miss.forEach(c => (byItem[c[0]] = byItem[c[0]] || []).push(c));
  // (only the events with something typed: an untouched one shows what it expects in its own card)
  Object.keys(byItem).forEach(n => { if(n !== "11" && !touched(R.rec.entries[n])) delete byItem[n]; });
  const count = Object.keys(byItem).reduce((a, n) => a + byItem[n].length, 0);
  return `${started() && count ? `<details class="cc-fix" ${R.open.fix ? "open" : ""} ontoggle="FTCalCheck.toggle('fix', this.open)"><summary>What to fix (${count})</summary><ul>${Object.keys(byItem).map(n => `<li><b>${e(n)} ${e(n === "11" ? "Entire Calendar" : keyOf(n).name)}</b>: ${byItem[n].map(c => `${e(c[1])} → ${e(c[3])}`).join("; ")}</li>`).join("")}</ul></details>` : ""}`;
}
// the in-place painters behind edit()
const paintStatus = () => { const el = document.querySelector(".cc-total small"); if(el) el.textContent = R.status; };
function paintItem(n){
  const k = keyOf(n, curKey()), v = R.rec.entries[n] || {}, sc = itemScore(k, v), go = touched(v);
  const out = document.querySelector(`[data-res="${n}"]`); if(out) out.innerHTML = resHtml(check(k, v, R.rec.entries), !go);
  const s = document.querySelector(`[data-sc="${n}"]`); if(s){ s.textContent = go ? `${sc.met}/${sc.total}` : "—"; s.className = `cc-sc ${go ? pctCls(sc.pct) : "none"}`; }
}
const paintTotal = () => { const el = document.getElementById("ccSummary"); if(el) el.innerHTML = summaryHtml(); const fx = document.getElementById("ccFix"); if(fx) fx.innerHTML = fixHtml(); };
function renderPage(){
  if(!R.rec && R.failed) return `<div class="card cc-loadfail"><b>Couldn’t load your draft.</b> Nothing has been changed: check your connection, then <button class="btn btn-ghost btn-sm" type="button" onclick="FTCalCheck.reload()">↻ Try again</button></div>`;
  if(!R.rec){ load(); return `<div class="card" style="padding:24px;">Loading…</div>`; }
  const last = R.rec.submits[R.rec.submits.length - 1], lastSc = last ? scored(last) : null;
  return `${preview() ? `<div class="card cc-preview">👁 <b>Trainee view</b> — this is the page as a trainee sees it. Nothing you type here is saved or sent; each trainee checks their own calendar.</div>` : ""}<div class="cc-hero"><p class="cc-eyebrow">Day 5 · Attorney Calendar Management Activity</p><h1>📅 Calendar Activity Check</h1>
      <p>For each event, enter exactly what you put in Google Calendar (as the event itself shows it). Every field is checked as you type against the activity, with what to fix. When you’re done, send it to your trainer.</p>
      <p class="cc-dates">🗓 ${preview() ? "A batch starting this week has the activity on" : "Your activity’s dates"}: <b>${e(spanOf(anchorOf(R.rec)))}</b></p>
      ${window.FTCalSim ? `<p class="cc-sim"><button class="btn btn-ghost btn-sm" type="button" onclick="goto('calsim','attorney-activity')">🗓 Do the activity on the Calendaring Simulator</button> <span class="cc-mono">the same check, on a practice Google Calendar</span></p>` : ""}</div>
    <div class="cc-sticky" id="ccSummary">${summaryHtml()}</div><div id="ccFix">${fixHtml()}</div>
    <div class="cc-list" oninput="FTCalCheck.edit(event)" onchange="FTCalCheck.edit(event)">${curKey().map(itemHtml).join("")}</div>
    <div class="cc-send"><button class="btn btn-navy" type="button" onclick="FTCalCheck.submit()">📤 Submit to my trainer</button>
      <span class="cc-mono">${last ? `Last sent ${e(new Date(last.at).toLocaleString())} · ${lastSc.pct}%` : "Not sent yet"}</span></div>`;
}
window.EXTRA_ROUTE_VIEWS = (window.EXTRA_ROUTE_VIEWS || []).concat(["calcheck"]);
window.EXTRA_ROUTE_LABELS = Object.assign({}, window.EXTRA_ROUTE_LABELS || {}, {calcheck: "Calendar Activity Check"});
const __render = window.render;
window.render = function(){
  if(state.view !== "calcheck") return __render.apply(this, arguments);
  // (a trainer, with no trainee of their own, sees the 👁 Trainee view; someone not signed in goes to the dashboard)
  if(!state.traineeId && !state.isAdmin && !state.adminPreview){ state.view = "dashboard"; return __render.apply(this, arguments); }
  if(R.recId && R.recId !== (state.traineeId || PREVIEW)){ R.rec = null; R.recId = null; R.failed = false; }
  load();
  const app = document.getElementById("app");
  app.innerHTML = renderTopbar() + `<main class="main-cc"><a class="back-link" onclick="goto('simulators')">&larr; Back to the Practice Lab</a>${renderPage()}</main>` + renderFooter();
  try{ afterRender(); }catch(err){}
};
window.FTCalCheck = {
  key: KEY, keyFor, anchorOf, tzOpts, zones: TZ, pacificOf: PAC_OF, pacificTimes: PACS_OF, check, checkAll, score, edit, submit,
  toggle(n, open){ R.open[n] = !!open; },
  save: () => save(), reload: () => load(true), state: () => R
};
// 🛠 the Practice Lab's card
window.ftCalCheckCard = () => `<div class="card fts-card"><div class="fts-kicker">Day 5 · Attorney Calendar Management Activity</div><h3>📅 Calendar Activity Check</h3>
    <p class="fts-note">Enter what each of the activity’s events holds in your Google Calendar: every field (title, dates and times, time zone, location, guests, reminder, notes) is checked against the activity.</p>
    <div class="fts-tool-act"><button class="btn btn-navy btn-sm" type="button" onclick="goto('calcheck')">Check my calendar</button></div></div>`;
// 🏅 My Performance: the latest submission
window.ftCalCheckItems = ctx => { const rec = clean(ctx.rec["calcheck:"]), s = rec.submits[rec.submits.length - 1]; if(!s) return [];
  const sc = scored(s);
  return [{name: "📅 Attorney Calendar Management Activity", pct: sc.pct, note: `${sc.met} of ${sc.total} fields right · sent ${new Date(String(s.at)).toLocaleDateString()}`}]; };

/* ---------- 🧑‍🏫 Admin → 🛠 Practice Lab → 📅 Calendar Activity ---------- */
const AD = {rows: null, loading: false, batch: "", open: {}};
async function loadAdmin(){
  AD.loading = true;
  try{
    let people = state.adminData;
    if(!people){ const keys = await sharedList("trainee:"); people = (await sharedGetMany(keys)).filter(Boolean); }
    people = people.filter(r => r && r.id && r.approved === true && !r.archived && !r.rejected);
    const vals = []; const keys = people.map(r => "calcheck:" + r.id);
    for(let i = 0; i < keys.length; i += 99) vals.push(...await sharedGetMany(keys.slice(i, i + 99)));
    AD.rows = people.map((r, i) => ({id: r.id, name: r.name || r.id, batch: r.batch || "", rec: vals[i] && vals[i].entries && typeof vals[i].entries === "object" ? clean(vals[i]) : null}))
      .sort((a, b) => a.batch.localeCompare(b.batch) || a.name.localeCompare(b.name));
    if(!AD.batch){ const bs = [...new Set(AD.rows.map(r => r.batch).filter(Boolean))].sort(); AD.batch = bs[bs.length - 1] || ""; }
  }catch(err){ AD.rows = AD.rows || []; }
  AD.loading = false; if(state.view === "admin" && state.adminTab === "calcheck") render();
}
// a submission's results, event by event
function checksTable(rows){
  const by = {}; (rows || []).filter(c => Array.isArray(c) && c.length === 4).forEach(c => (by[c[0]] = by[c[0]] || []).push(c));
  return `<div class="cc-atbl">${Object.keys(by).map(n => { const on = by[n].filter(c => c[2] !== null), m = on.filter(c => c[2]).length;
    return `<div class="cc-arow"><b>${e(n)} ${e(n === "11" ? "Entire Calendar & upload" : (keyOf(n) || {}).name || "")}</b> <span class="cc-sc ${pctCls(on.length ? m / on.length * 100 : 0)}">${m}/${on.length}</span>
      <ul class="cc-res">${on.map(c => `<li class="${c[2] ? "" : "miss"}">${chip(c[2])}<span><b>${e(c[1])}</b>${c[2] ? "" : `<small>${e(c[3])}</small>`}</span></li>`).join("")}</ul></div>`; }).join("")}</div>`;
}
function adminHtml(){
  if(!AD.rows){ if(!AD.loading) loadAdmin(); return `<div class="card" style="padding:24px;">Loading…</div>`; }
  const batches = [...new Set(AD.rows.map(r => r.batch).filter(Boolean))].sort(), rows = AD.rows.filter(r => !AD.batch || r.batch === AD.batch);
  return `<div class="card cc-admin"><div class="ff-bar"><div><h3>📅 Calendar Activity</h3><p class="fss-muted">Day 5’s Attorney Calendar Management Activity: what each trainee entered for the 18 events, checked field by field against the activity. The latest submission is shown; a draft that hasn’t been sent shows as a draft.</p></div>
      <span><select onchange="FTCalCheckAdmin.batch(this.value)"><option value="">All batches</option>${batches.map(b => `<option ${b === AD.batch ? "selected" : ""}>${e(b)}</option>`).join("")}</select>
      <button class="btn btn-ghost btn-sm" onclick="FTCalCheckAdmin.reload()">↻ Refresh</button></span></div>
    ${rows.length ? `<div class="ff-scroll"><table class="ff-tbl"><thead><tr><th>Trainee</th><th>Sent</th><th>Score</th><th>Most missed</th><th></th></tr></thead><tbody>
      ${rows.map(r => { const s = r.rec && r.rec.submits[r.rec.submits.length - 1], sc = s ? scored(s) : null, draft = r.rec && !s ? score(checkAll(r.rec, anchorOf(r.rec))) : null;
        // (the submission's snapshot is scored again here: what the trainee's page stored is never shown as it is)
        const miss = {}; (sc ? sc.rows : []).filter(c => c[2] === false).forEach(c => { miss[c[1]] = (miss[c[1]] || 0) + 1; });
        const top = Object.entries(miss).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} (${n})`).join("; ");
        return `<tr><td><b>${e(r.name)}</b><span class="fss-muted"> ${e(r.batch)}</span></td><td>${s ? e(new Date(String(s.at)).toLocaleString()) : draft ? "Draft only" : "—"}</td>
          <td>${sc ? `<b>${sc.pct}%</b> (${sc.met}/${sc.total})` : draft ? `<span class="fss-muted">${draft.pct}% so far</span>` : "—"}</td><td>${e(top || "—")}</td>
          <td>${s ? `<button class="btn btn-ghost btn-sm" onclick="FTCalCheckAdmin.open('${e(r.id)}')">${AD.open[r.id] ? "▾ Hide" : "▸ Fields"}</button>` : ""}</td></tr>
          ${sc && AD.open[r.id] ? `<tr class="cc-aopen"><td colspan="5">${checksTable(sc.rows)}</td></tr>` : ""}`; }).join("")}
    </tbody></table></div>` : `<p class="fss-muted">No approved trainees${AD.batch ? " in this batch" : ""}.</p>`}</div>`;
}
window.FTCalCheckAdmin = {batch(b){ AD.batch = b; render(); }, open(id){ AD.open[id] = !AD.open[id]; render(); }, reload: () => loadAdmin()};
ftAdminTab("calcheck", "✅ Calendar Activity Check", adminHtml);

if(!document.getElementById("ftdd-deck-font")){
  const f = document.createElement("link"); f.id = "ftdd-deck-font"; f.rel = "stylesheet";
  f.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&display=swap";
  document.head.appendChild(f);
}
(function(){ const st = document.createElement("style"); st.id = "ft-calcheck"; st.textContent = `
main.main-cc{max-width:980px;margin:0 auto;padding:18px 16px 48px;display:flex;flex-direction:column;gap:14px;font-family:'Inter',sans-serif;box-sizing:border-box;width:100%;}
.cc-hero p.cc-dates{margin:8px 0 0;font-size:15px;} .cc-sim{margin:10px 0 0 !important;display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.cc-hero h1{margin:0 0 6px;font:800 30px/1.15 'Poppins','Inter',sans-serif;color:#1E2340;} .cc-hero p{margin:0;color:var(--ink-soft);max-width:76ch;font-size:16px;line-height:1.55;}
.cc-eyebrow,.cc-mono,.cc-lbl{font:600 12px 'IBM Plex Mono',monospace;letter-spacing:.02em;}
.cc-eyebrow{margin:0 0 6px;color:#E8590C;text-transform:uppercase;letter-spacing:.08em;} .cc-mono{color:var(--ink-soft);}
.cc-sticky{position:sticky;top:-18px;z-index:5;background:var(--card,#fff);border:1px solid var(--line,#d6d9e0);border-left:5px solid #E8590C;border-radius:12px;padding:12px 16px;box-shadow:0 4px 14px rgba(30,35,64,.08);}
.cc-total{display:flex;align-items:center;gap:14px;} .cc-total b{display:block;font-size:16px;color:var(--ink);} .cc-total small{display:block;color:var(--ink-soft);font-size:13px;}
.cc-big{font:800 26px 'Poppins','Inter',sans-serif;border-radius:10px;padding:6px 12px;min-width:76px;text-align:center;}
.cc-fix{font-size:15px;background:var(--card,#fff);border:1px solid var(--line,#d6d9e0);border-radius:12px;padding:10px 16px;} .cc-fix summary{cursor:pointer;font-weight:700;color:#C2410C;} .cc-fix ul{margin:6px 0 0;padding-left:18px;display:grid;gap:4px;max-height:38vh;overflow:auto;} .cc-fix li{line-height:1.45;}
.cc-list{display:flex;flex-direction:column;gap:10px;}
.cc-item{border-radius:12px;overflow:hidden;border:1px solid var(--line,#d6d9e0);background:var(--card,#fff);}
.cc-item>summary{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:12px 16px;background:#1E2340;color:#fff;border-left:5px solid #E8590C;cursor:pointer;list-style:none;}
.cc-item>summary::-webkit-details-marker{display:none;}
.cc-n{font:600 13px 'IBM Plex Mono',monospace;color:#F4B77A;border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:2px 10px;}
.cc-name{font:700 17px/1.3 'Poppins','Inter',sans-serif;min-width:0;overflow-wrap:anywhere;}
.cc-sc{font:600 13px 'IBM Plex Mono',monospace;border-radius:8px;padding:3px 9px;white-space:nowrap;}
.cc-sc.ok,.cc-big.ok{background:#E3F4EA;color:#2E7D4F;} .cc-sc.mid,.cc-big.mid{background:#FFF4D6;color:#8A5A00;} .cc-sc.low,.cc-big.low{background:#FDEBE3;color:#C2410C;} .cc-sc.none,.cc-big.none{background:rgba(127,127,127,.18);color:inherit;}
.cc-body{padding:14px 16px 16px;display:grid;grid-template-columns:minmax(0,1fr);gap:16px;}
.cc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 12px;align-content:start;}
.cc-grid label{display:flex;flex-direction:column;gap:4px;min-width:0;} .cc-lbl{color:var(--ink-soft);text-transform:uppercase;}
.cc-grid .w{grid-column:1/-1;} .cc-grid .w2{grid-column:span 2;}
.cc-grid label.ck{flex-direction:row;align-items:center;gap:8px;font-size:16px;color:var(--ink);}
.cc-grid input:not([type=checkbox]),.cc-grid select,.cc-grid textarea{box-sizing:border-box;width:100%;min-width:0;font:400 16px 'Inter',sans-serif;padding:9px 10px;border:1px solid var(--line,#d6d9e0);border-radius:8px;background:var(--card,#fff);color:var(--ink);}
.cc-grid input[type=checkbox]{width:20px;height:20px;accent-color:#E8590C;flex:none;}
.cc-res{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));column-gap:20px;row-gap:2px;font-size:15px;}
.cc-res.pending li b{color:var(--ink);}
.cc-res li{display:grid;grid-template-columns:22px 1fr;gap:6px;padding:5px 0;border-top:1px solid var(--line,#eceef2);line-height:1.4;}
.cc-res li small{display:block;color:var(--ink-soft);font-size:14px;} .cc-res li.miss b{color:#C2410C;}
.cc-ok{color:#2E7D4F;font-weight:800;} .cc-no{color:#C2410C;font-weight:800;} .cc-na{color:var(--ink-soft);}
.cc-send{display:flex;flex-wrap:wrap;gap:12px;align-items:center;}
.cc-preview{padding:10px 14px;background:#EEF2FF;border:1px solid #C7D2FE;color:#3730A3;font-size:14px;} .cc-loadfail{padding:18px 20px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:16px;}
.cc-admin .ff-bar h3{font:700 22px/1.2 'Poppins','Inter',sans-serif;color:#1E2340;}
.cc-admin .ff-bar span{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.cc-atbl{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;padding:6px 0;} .cc-arow .cc-res{grid-template-columns:minmax(0,1fr);} .cc-arow{border:1px solid var(--line,#eceef2);border-radius:8px;padding:8px 10px;} .cc-arow .cc-res{font-size:13.5px;margin-top:4px;}
@media (max-width:560px){ .cc-grid{grid-template-columns:repeat(2,minmax(0,1fr));} .cc-grid .w2{grid-column:1/-1;} .cc-res{grid-template-columns:minmax(0,1fr);}
  .cc-aopen td{padding:8px 0;} .cc-atbl{position:sticky;left:0;width:calc(100vw - 56px);grid-template-columns:1fr;} .cc-hero h1{font-size:24px;} .cc-item>summary{padding:10px 12px;gap:8px;} .cc-name{font-size:15.5px;} .cc-sticky{position:static;} }
`; document.head.appendChild(st); })();
})();

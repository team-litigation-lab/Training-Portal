/* Google Calendar Simulator (simulators/gcal.html; data in simulators/gcal-data.js).
   The Foundational Training's Calendar Management practice (Day 6): callers ask for appointments, and the
   trainee puts them on the attorney's calendar in a Google Calendar look-alike, then checks the calendar.

   • The calendar: Day, Week, Month and Schedule views, a mini month, My calendars / Other calendars, search,
     drag to create, move or resize, a quick-create card, the full event page (title, date and time, all day,
     time zone, repeat, Google Meet video conferencing, location, notifications, calendar and color, busy and
     visibility, a description with formatting, guests and their permissions, Find a time), the event card
     (join the mock Google Meet, edit, delete, email guests, duplicate, color), undo, keyboard shortcuts, and
     settings (default length, weekends, a second time zone).
   • The attorney's week (GCAL_ATTORNEY) repeats every week on the Attorney's Calendar. Changing one of its
     appointments asks "This event" or "All events", as Google does (for this trainee only). An Admin can change
     the week itself for everyone: Settings → Edit the weekly schedule (kept by /api/gcal-schedule).
   • Calendar requests (the right-hand panel): a set of 7 from GCAL_REQUESTS (5 to book, 1 to move, 1 to
     cancel), with real dates from "today" (Eastern; a weekend counts as the next Monday). A set is only
     dealt if it can be done under the rules (solve()).
   • Check my calendar (checkPlan): each request is marked against the attorney's rules (GCAL_RULES): the
     Attorney's Calendar, the title, Eastern time, a free slot with 15-minute buffers and no lunch or blocks,
     the caller's times, the length cap, the color for its length (30 minutes Tangerine, 45 Blueberry, 1 hour
     Tomato), phone/video/office, the description (name, callback, DOB, DOL,
     reason), and an email reminder a day before; moves and cancellations too; changing appointments no one
     asked about costs points. The score is saved with Sim.saveResult ('Google Calendar').
   • Everything is kept in this browser (localStorage, one calendar per trainee name).
   • 📤 Submit for evaluation (on the requests and the check): the appointments, the requests, the rules and the automated check go
     to /api/gcal-reviews, where an AI review is written (done correctly, needs improvement, missed) from the attorney's rules and
     the trainer's own rules and notes. The trainer goes through it live with the trainee (simulators/gcal-review.html), adds
     written feedback and finalizes it; the trainee reads the final report under My evaluations (the rail) and downloads a PDF.
   • Tracks (gcal.html?track=standard|cm|ea; data and numbers in gcal-data.js, GCAL_TRACKS / GCAL_CFG): Standard Training is this
     simulator exactly as it was built. The Case Management (Litigation Week) and EA / PA (Executive Week) simulators are clones of
     it with their own week, callers, rules and request types; the executive's wording is applied as the page is drawn. Each track
     keeps its own calendar in the browser, its own weekly schedule (/api/gcal-schedule?track=…) and saves its score as
     'Google Calendar' with the track in the scenario.
   window.GCAL exposes the pure parts (solve, checkPlan, slotProblems…) for the test (.github/scripts/gcal.cjs). */
(function () {
Sim.module = 'calendaring';
const ET = 'America/New_York';
const HH = 48;                       // pixels per hour on the Day and Week grids
const DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TZS = [[ET, 'Eastern Time - New York'], ['America/Chicago', 'Central Time - Chicago'], ['America/Denver', 'Mountain Time - Denver'],
    ['America/Los_Angeles', 'Pacific Time - Los Angeles'], ['Asia/Manila', 'Philippine Time - Manila'], ['UTC', 'Coordinated Universal Time']];
const esc = (s) => Sim.esc(s);

/* ---------- dates and times (dates are 'YYYY-MM-DD', times 'HH:MM', all on the firm's clock: Eastern) ---------- */
const D = (s) => new Date(s + 'T00:00:00Z');
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const wd = (s) => D(s).getUTCDay();
const mins = (t) => { const p = String(t || '0:0').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };
const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const weekStart = (s, monday) => addDays(s, -(monday ? (wd(s) + 6) % 7 : wd(s)));
function zoneParts(ms, tz) {
    const o = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        .formatToParts(new Date(ms)).forEach(p => { o[p.type] = p.value; });
    return { date: `${o.year}-${o.month}-${o.day}`, time: `${o.hour === '24' ? '00' : o.hour}:${o.minute}` };
}
const offsetMin = (tz, date) => { const ms = Date.parse(date + 'T12:00:00Z'); const p = zoneParts(ms, tz); return Math.round((Date.parse(`${p.date}T${p.time}:00Z`) - ms) / 60000); };
// a wall time in one zone, as a wall time in another
function shiftWall(date, time, from, to) {
    if (from === to) return { date, time };
    const ms = Date.parse(`${date}T${time}:00Z`) - offsetMin(from, date) * 60000;
    return zoneParts(ms, to);
}
const gmt = (tz, date) => { const o = offsetMin(tz, date); const a = Math.abs(o); return `GMT${o < 0 ? '-' : '+'}${String(Math.floor(a / 60)).padStart(2, '0')}${a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''}`; };
const etNow = () => zoneParts(Date.now(), ET);
// Google's way of writing times: 9am, 9:30am, 12pm
function tl(m, ampm = true) { m = ((m % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mm = m % 60; return (h % 12 || 12) + (mm ? ':' + String(mm).padStart(2, '0') : '') + (ampm ? (h < 12 ? 'am' : 'pm') : ''); }
const span = (s, e) => `${tl(s, (s < 720) !== (e < 720 || e >= 1440))} – ${tl(e)}`;
const hourLabel = (h) => `${h % 12 || 12} ${h < 12 || h === 24 ? 'AM' : 'PM'}`;
const longDate = (s) => `${DAYN[wd(s)]}, ${MON[+s.slice(5, 7) - 1]} ${+s.slice(8)}`;
const shortDate = (s) => `${DAYN[wd(s)].slice(0, 3)}, ${MON[+s.slice(5, 7) - 1].slice(0, 3)} ${+s.slice(8)}`;
const ampm12 = (t) => { const m = mins(t); return `${m % 720 === 0 && m ? 12 : Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}`; };
// The simulator's today: Eastern; a weekend counts as the next Monday (the calls come in on a work day).
function simToday() { const t = etNow().date; return wd(t) === 6 ? addDays(t, 2) : wd(t) === 0 ? addDays(t, 1) : t; }

/* ---------- text helpers for the check ---------- */
const alnum = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const digits = (s) => String(s || '').replace(/\D/g, '');
function plain(html) { const d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, '$&\n'); return d.textContent || ''; }
const hasName = (t, name) => name.toLowerCase().split(/\s+/).filter(w => w.length > 1 && !/^\(|\)$/.test(w)).every(w => t.toLowerCase().includes(w));
const MONS = MON.map(m => m.slice(0, 3).toLowerCase());
// every date written in the text, as MM/DD/YYYY (03/22/1988, 3-22-88, March 22, 1988, Mar 22nd 1988)
function datesIn(t) {
    const out = [], s = String(t || '');
    s.replace(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g, (m, a, b, y) => { y = y.length === 2 ? (+y > 30 ? '19' : '20') + y : y; out.push(`${a.padStart(2, '0')}/${b.padStart(2, '0')}/${y}`); return m; });
    s.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi, (m, mo, d, y) => { out.push(`${String(MONS.indexOf(mo.toLowerCase()) + 1).padStart(2, '0')}/${d.padStart(2, '0')}/${y}`); return m; });
    return out;
}
const hasDate = (t, mdY) => datesIn(t).includes(mdY);
function sanitize(html) {
    const t = document.createElement('template'); t.innerHTML = String(html || '');
    const OK = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, BR: 1, P: 1, DIV: 1, UL: 1, OL: 1, LI: 1, A: 1 };
    const walk = (n) => [...n.childNodes].forEach(c => {
        if (c.nodeType === 3) return;
        if (c.nodeType !== 1 || !OK[c.tagName]) { if (c.nodeType === 1 && !/^(SCRIPT|STYLE|IFRAME|OBJECT)$/.test(c.tagName)) { walk(c); c.replaceWith(...c.childNodes); } else c.remove(); return; }
        const href = c.getAttribute && c.getAttribute('href');
        [...c.attributes].forEach(a => c.removeAttribute(a.name));
        if (c.tagName === 'A' && href && /^(https?:|mailto:)/i.test(href)) { c.setAttribute('href', href); c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); }
        walk(c);
    });
    walk(t.content);
    return t.innerHTML;
}
const textToHtml = (s) => esc(s).replace(/\n/g, '<br>');

/* ---------- calendars, colors, the attorney's week ---------- */
// The attorney's week: as it came (GCAL_ATTORNEY), or as an Admin changed it for everyone (/api/gcal-schedule).
let ROWS = GCAL_ATTORNEY.map(r => Object.assign({}, r));
const rowById = (id) => ROWS.find(r => r.id === id);
const calOf = (id) => GCAL_CALENDARS.find(c => c.id === id) || GCAL_CALENDARS[1];
// 🎨 The trainer's color coding (saved with the schedule, /api/gcal-schedule colors): a color for a calendar and a color for each type of appointment in the
// existing schedule. An appointment's own color wins over its type's, which wins over the default below; an event's own color wins over its calendar's.
const CC = { cal: {}, type: {} }, SCHEDULE_TYPES = ['Blocked Time', 'Phone Call', 'Client Meeting', 'Internal Meeting', 'Other'];
const setCC = (c) => { CC.cal = Object.assign({}, c && c.cal); CC.type = Object.assign({}, c && c.type); };
const calColor = (id) => GCAL_COLORS[CC.cal[id]] || calOf(id).color;
const seedColor = (r) => r.color || CC.type[r.type] || (r.type === 'Blocked Time' ? (/review/i.test(r.title) ? 'blueberry' : 'graphite') : r.type === 'Phone Call' ? 'tangerine' : r.type === 'Internal Meeting' ? 'basil' : '');
const guessType = (t) => (/block|lunch|daily case/i.test(t) || (TRK && /board|travel|focus|briefing/i.test(t))) ? 'Blocked Time' : /conference/i.test(t) ? 'Internal Meeting' : /preparation|strategy|settlement meeting|deposition/i.test(t) ? 'Client Meeting' : 'Phone Call';
const colorOf = (e) => (e.color && GCAL_COLORS[e.color]) || calColor(e.cal);
// The attorney's color rule: the trainee colors each appointment by its length (30 minutes Tangerine, 45 Blueberry, 1 hour Tomato).
const LEN_COLOR = { 30: 'tangerine', 45: 'blueberry', 60: 'tomato' };
const lengthColor = (m) => LEN_COLOR[m] || '';
const colorName = (c) => c ? c[0].toUpperCase() + c.slice(1) : '';
const isBlock = (e) => e.seed && e.type === 'Blocked Time';
const isNewConsult = (e) => Object.keys(GCAL_TYPES).some(t => GCAL_TYPES[t].newClient && new RegExp('^\\s*' + t.split(':').map(x => rx(x.trim())).join('\\W+'), 'i').test(e.title || ''));
const nmins = (n) => (+n.v || 0) * ({ minutes: 1, hours: 60, days: 1440, weeks: 10080 }[n.u] || 1);
const reqDef = (id) => GCAL_REQUESTS.find(r => r.id === id);
// The track this page runs (gcal.html?track=standard|cm|ea; gcal-data.js GCAL_TRACKS): "standard" is the original Google Calendar
// Simulator, and its numbers below are the ones it always had. The Case Management and EA / PA clones change the week, the callers,
// the rules and these numbers, nothing else.
const CFG = GCAL_CFG;
/* Submit to the trainer and the trainer's review. A trainee presses 📤 Submit to my trainer: the automated check, the calendar they built and the
   week it was built on are kept in their /api/calsim record (gsubs). A trainer opens it from Calendar Scores as gcal.html?track=…&review=<user>|<at>:
   the same Google Calendar look, read-only, with the result and a feedback form (score, comment, a comment per request); the trainee sees it in the
   requests panel. Scores also reach the Progress page (functions/api/program-progress.js). */
const GT = GCAL_TRACK;                                    // standard | cm | ea
const RVQ = new URLSearchParams(location.search).get('review') || '';
// A trainer looking at a trainee's calendar as they last saved it (gcal.html?trainee=<username>, from the Calendaring Simulators
// page): read only like a review, with the automated check and the CALENDAR MANAGEMENT MOCK CALL scorecard (cal-scorecard.js).
const TVQ = String(new URLSearchParams(location.search).get('trainee') || '').trim().slice(0, 80);
const RV = RVQ.indexOf('|') > 0 ? { user: RVQ.slice(0, RVQ.indexOf('|')), at: RVQ.slice(RVQ.indexOf('|') + 1), sub: null, review: null, name: '', batch: '' }
    : TVQ ? { user: TVQ, live: true, sub: null, review: null, name: '', batch: '', savedAt: null, empty: false, cards: [] } : null;
const SUBKEY = (at) => 'g:' + GT + '|' + at;
const MINE = { data: null, me: null };                  // the signed-in trainee's record
const BOOK_MAX = CFG.exact ? 11.5 : 10;   // Standard Training scores a booking out of 10 as it always did; the clones out of what the checks add up to
// The executive's wording (EA / PA track): the page's own fixed texts say "executive" where the attorney's say "attorney". Only fixed
// texts go through WW(); anything the trainee typed or a caller said is never reworded. Standard and Case Management are unchanged.
const WW = (t) => !CFG.who ? t : String(t).replace(/Attorney['’]s Calendar/g, CFG.who.cal).replace(/Attorney(['’]s)?/g, (m, p) => 'Executive' + (p || '')).replace(/attorney(['’]s)?/g, (m, p) => 'executive' + (p || ''));
const TRK = GCAL_TRACK === 'standard' ? '' : GCAL_TRACK;
const API_SCHEDULE = '/api/gcal-schedule' + (TRK ? '?track=' + TRK : '');   // (Standard Training: no query, as it always was)
const rx = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// All events from `from` to `to` for a calendar state { events, ex, sx }: the attorney's week (with its changes),
// the trainee's events (and their repeats), and the holidays.
function instancesOf(st, from, to, rows) {
    const lo = addDays(from, -10), hi = addDays(to, 10), out = [];
    for (let d = lo; d <= hi; d = addDays(d, 1)) {
        const w = wd(d);
        (rows || ROWS).forEach(r => {
            if (r.wd !== w) return;
            const sx = st.sx[r.id]; if (sx && sx.del) return;
            const iid = `s:${r.id}@${d}`, x = st.ex[iid]; if (x && x.del) return;
            const e = { iid, sid: 's:' + r.id, row: r.id, seed: true, cal: 'attorney', title: r.title, type: r.type, date: d, start: r.start, end: r.end, allDay: false,
                color: seedColor(r), location: r.location || '', meet: '', desc: textToHtml(r.notes || ''), guests: [], notifs: [], tz: ET, repeat: 'weekly', busy: true, vis: 'default', origDate: d };
            if (sx) Object.assign(e, sx);
            if (x) Object.assign(e, x);
            out.push(e);
        });
    }
    (st.events || []).forEach(ev => {
        const rep = ev.repeat || 'none';
        const dates = [];
        if (rep === 'none') dates.push(ev.date);
        else for (let d = ev.date < lo ? lo : ev.date; d <= hi; d = addDays(d, 1)) {
            const w = wd(d);
            if (rep === 'daily' || (rep === 'weekdays' && w >= 1 && w <= 5) || (rep === 'weekly' && w === wd(ev.date))) dates.push(d);
        }
        dates.forEach(d => {
            const iid = `${ev.id}@${d}`, x = st.ex[iid]; if (x && x.del) return;
            const e = Object.assign({}, ev, { iid, sid: ev.id, seed: false, date: d, origDate: d });
            if (x) Object.assign(e, x);
            out.push(e);
        });
    });
    GCAL_HOLIDAYS.forEach(([d, t]) => { if (d >= lo && d <= hi) out.push({ iid: 'h@' + d, sid: 'h', cal: 'holidays', title: t, date: d, allDay: true, readOnly: true, start: '', end: '', desc: '', notifs: [], guests: [] }); });
    return out.filter(e => e.date >= from && e.date <= to).map(e => RV ? Object.assign(e, { readOnly: true }) : e);
}

/* ---------- the attorney's rules (Day 6) ---------- */
// What's wrong with this slot for this kind of request, given everything else on the calendar.
function slotProblems(e, all, T) {
    T = T || {};
    if (e.allDay) return ['It’s an all-day event: give it a start and end time.'];
    const out = new Set(), s = mins(e.start), en = mins(e.end), w = wd(e.date);
    if (w === 0 || w === 6) out.add('It’s on a weekend.');
    const outside = s < CFG.open || en > CFG.close;
    if (outside) out.add(WW(`It’s outside the attorney’s hours (${ampm12(hhmm(CFG.open))} – ${ampm12(hhmm(CFG.close))}${CFG.newClientDays ? '; no new client consults after 5' : ''}).`));
    all.filter(o => o.iid !== e.iid && o.date === e.date && !o.allDay && o.cal === 'attorney').forEach(o => {
        const os = mins(o.start), oe = mins(o.end);
        if (outside && o.title === 'No Schedule Block') return;
        if (s < oe && os < en) out.add(isBlock(o) ? `It overlaps ${o.title} (${span(os, oe)}).` : `It’s double-booked with ${o.title} (${span(os, oe)}).`);
        else if (!isBlock(o) && s < oe + CFG.buffer && os < en + CFG.buffer) out.add(`There’s no ${CFG.buffer}-minute buffer next to ${o.title} (${span(os, oe)}).`);
    });
    if (T.consult && (s < CFG.consultFrom || en > CFG.consultTo)) out.add('Phone consults are only between 9:30 AM and 3:00 PM.');
    if (T.newClient && CFG.newClientDays) {
        if (!CFG.newClientDays.includes(w)) out.add('New client consults are only on Tuesdays and Thursdays.');
        const n = all.filter(o => o.date === e.date && o.cal === 'attorney' && (o.iid === e.iid || isNewConsult(o))).length + (all.some(o => o.iid === e.iid) ? 0 : 1);
        if (n > CFG.newClientMax) out.add(WW(`That makes ${n} new client consults that day (the attorney takes ${CFG.newClientMax} at most).`));
    }
    if (T.followUp && s < CFG.followUpFrom) out.add('Follow-ups aren’t scheduled in the morning.');
    return [...out];
}
function availText(q, R) {
    if (R.sameDay) return `today, ${shortDate(q.dates[0])}, at 3 PM (ET)`;
    const days = (q.dates || []).map(shortDate).join(' or ');
    const any = mins(R.from) <= CFG.open && mins(R.to) >= CFG.close;
    return `${days}${any ? ', any time' : `, ${ampm12(R.from)} – ${ampm12(R.to)}`} (ET)`;
}

/* ---------- a set of requests, with dates ---------- */
function nextBusinessDays(d, n) { const out = []; for (let x = addDays(d, 1); out.length < n; x = addDays(x, 1)) if (wd(x) >= 1 && wd(x) <= 5) out.push(x); return out; }
function concretize(R, today) {
    const q = { id: R.id, done: false };
    let mon = weekStart(today, true);
    if (R.kind === 'move' || R.kind === 'cancel') {
        const row = rowById(R.seed); if (!row) return null;   // (an Admin took it off the schedule)
        q.row = row.id;
        for (let k = 0; k < 4; k++, mon = addDays(mon, 7)) {
            const orig = addDays(mon, row.wd - 1);
            const dates = R.kind === 'move' ? R.days.map(d => addDays(mon, d - 1)).filter(d => d > today) : [];
            if (orig > today && (R.kind === 'cancel' || dates.length)) { q.orig = orig; q.dates = dates; break; }
        }
        return q;
    }
    if (R.sameDay) { q.dates = [today]; q.alt = nextBusinessDays(today, 2); return q; }
    mon = addDays(mon, 7 * (R.when || 0));
    for (let k = 0; k < 3; k++, mon = addDays(mon, 7)) {
        const dates = R.days.map(d => addDays(mon, d - 1)).filter(d => d > today && wd(d) >= 1 && wd(d) <= 5);
        if (dates.length) { q.dates = dates; break; }
    }
    return q;
}
// A plan that does every request under the rules, or null: a set is only dealt when it can be done.
function solve(reqs, today, st) {
    st = st || { events: [], ex: {}, sx: {} };
    const base = instancesOf(st, today, addDays(today, 35)).filter(e => e.cal === 'attorney');
    let cal = base.slice();
    reqs.filter(q => reqDef(q.id).kind === 'cancel').forEach(q => { cal = cal.filter(e => !(e.row === q.row && e.date === q.orig)); });
    const todo = reqs.filter(q => reqDef(q.id).kind !== 'cancel');
    const plan = {};
    const cands = (q, list) => {
        const R = reqDef(q.id), T = GCAL_TYPES[R.type] || { max: 30 }, dur = Math.min(30, T.max), out = [];
        const dates = R.sameDay ? q.alt : q.dates;
        const lo = R.sameDay ? CFG.open : Math.max(CFG.open, mins(R.from)), hi = R.sameDay ? CFG.close : Math.min(CFG.close, mins(R.to));
        (dates || []).forEach(d => {
            for (let s = lo; s + dur <= hi; s += 15) {
                const e = { iid: 'plan:' + q.id, cal: 'attorney', title: `${R.type} – ${R.name}`, date: d, start: hhmm(s), end: hhmm(s + dur), allDay: false };
                if (!slotProblems(e, list, T).length) out.push(e);
            }
        });
        return out;
    };
    const go = (i, list) => {
        if (i === todo.length) return true;
        const q = todo[i], R = reqDef(q.id);
        const listQ = R.kind === 'move' ? list.filter(e => !(e.row === q.row && e.date === q.orig)) : list;
        for (const e of cands(q, listQ)) { plan[q.id] = e; if (go(i + 1, listQ.concat(e))) return true; }
        delete plan[q.id];
        return false;
    };
    return go(0, cal) ? plan : null;
}
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function dealRequests(today) {
    const pool = (k) => GCAL_REQUESTS.filter(r => r.kind === k && (!r.seed || rowById(r.seed)));
    for (let t = 0; t < 40; t++) {
        const pick = shuffle(pool('book')).slice(0, 5).concat(shuffle(pool('move')).slice(0, 1), shuffle(pool('cancel')).slice(0, 1));
        const reqs = pick.map(R => concretize(R, today));
        if (reqs.every(q => q && (q.dates || q.orig)) && solve(reqs, today)) return reqs;
    }
    return GCAL_REQUESTS.filter(r => r.kind === 'book' && !r.newClient).slice(0, 5).map(R => concretize(R, today)).filter(q => q && q.dates);
}

/* ---------- Check my calendar ---------- */
function gradeBookEvent(e, q, R, all, today) {
    const items = []; let pts = 0;
    const add = (ok, t, w) => { items.push({ ok, t }); if (ok) pts += w; };
    const T = GCAL_TYPES[R.type] || { max: 30 };
    add(e.cal === 'attorney', e.cal === 'attorney' ? WW('On the Attorney’s Calendar.') : WW(`It’s on the ${calOf(e.cal).name}, not the Attorney’s Calendar.`), 1);
    const okTitle = alnum(e.title) === alnum(R.type + R.name);
    add(okTitle, okTitle ? `Title: the request type and the ${CFG.who ? 'person' : 'client'}’s name.` : `The title should be “${R.type} – ${R.name}” (it’s “${e.title}”).`, 1.5);
    add((e.tz || ET) === ET, (e.tz || ET) === ET ? 'Time zone: Eastern.' : `The event’s time zone is ${(TZS.find(z => z[0] === e.tz) || [0, e.tz])[1]}; the calendar should be in Eastern (EST).`, 0.5);
    const probs = slotProblems(e, all, T);
    if (R.sameDay && e.date === today && !/approv/i.test(plain(e.desc))) probs.push(WW('Same-day bookings need the attorney’s approval: book the next business day, or write in the description that it’s pending the attorney’s approval.'));
    add(!probs.length, probs.length ? probs.join(' ') : WW('The slot follows the attorney’s rules (free, 15-minute buffers, hours).'), 3);
    const okDates = R.sameDay ? [today].concat(q.alt || []) : (q.dates || []);
    const inWin = okDates.includes(e.date) && (R.sameDay || (mins(e.start) >= mins(R.from) && mins(e.end) <= mins(R.to)));
    add(inWin, inWin ? 'A time the caller can do.' : `It isn’t a time the caller can do (${R.sameDay ? 'today or the next business day' : availText(q, R)}).`, 1);
    const dur = mins(e.end) - mins(e.start);
    add(!e.allDay && dur >= 15 && dur <= T.max, `Length: ${e.allDay ? 'all day' : dur + ' minutes'} (at most ${T.max} for a ${R.type}).`, 1);
    const wantC = lengthColor(dur) || lengthColor(T.max);
    add((e.color || '') === wantC, (e.color || '') === wantC ? `Color: ${colorName(wantC)}, right for its length.` : `A ${lengthColor(dur) ? dur + '-minute' : T.max + '-minute'} appointment is colored ${colorName(wantC)} (30 minutes Tangerine, 45 Blueberry, 1 hour Tomato)${e.color ? `; it’s ${colorName(e.color)}` : ''}.`, 0.5);
    const where = `${e.location || ''} ${plain(e.desc)}`;
    let mt = '';
    if (R.meeting === 'video') mt = e.meet ? '' : 'It’s a video call: add Google Meet video conferencing.';
    else if (R.meeting === 'phone') mt = e.meet ? (T.consult ? 'Consultations are phone only: remove the Google Meet link.' : 'The caller wants a phone call: remove the Google Meet link.') : (/phone|call/i.test(where) ? '' : WW('Say it’s a phone call (Location: Phone) and the number the attorney will call.'));
    else mt = e.meet ? 'It’s in person: remove the Google Meet link.' : (new RegExp(rx(GCAL_OFFICE.split(/[,\s]+/).slice(0, 2).join(' ')) + '|office', 'i').test(e.location || '') ? '' : `It’s in person: put the office in Location (${GCAL_OFFICE}).`);
    add(!mt, mt || ({ video: 'Video call: Google Meet added.', phone: 'Phone call.', office: 'In person, at the office.' })[R.meeting], 1);
    const tx = plain(e.desc);
    const need = [[CFG.who ? 'the person’s name' : 'the client’s name', hasName(tx, R.name)], ['the callback number', digits(tx).includes(digits(R.cb))]]
        .concat(CFG.fields.includes('dob') ? [['the DOB', hasDate(tx, R.dob)]] : [], CFG.fields.includes('dol') ? [['the DOL', hasDate(tx, R.dol)]] : [])
        .concat((R.notesNeed || []).map(g => [`what it’s about (e.g. ${g[0]})`, g.some(k => tx.toLowerCase().includes(k.toLowerCase()))]));
    const got = need.filter(n => n[1]).length;
    pts += 1.5 * got / need.length;
    items.push({ ok: got === need.length, t: got === need.length ? `Description: ${['name', 'callback number'].concat(CFG.fields.includes('dob') ? ['DOB'] : [], CFG.fields.includes('dol') ? ['DOL'] : []).join(', ')} and the reason.` : `The description is missing ${need.filter(n => !n[1]).map(n => n[0]).join(', ')}.` });
    const rem = (e.notifs || []).some(n => n.m === 'email' && nmins(n) === 1440);
    add(rem, rem ? 'Email reminder a day before.' : 'Add an email notification 1 day before.', 0.5);
    return { pts, max: BOOK_MAX, items, ev: e };
}
/* Standard Training has no calendar requests: the trainee takes a Calendar Management mock call and books what the caller asks
   for. checkOpen marks every appointment they put on the calendar against all of the attorney's rules (the caller's own
   preferences are for the AI review and the trainer, who see the call's appointments): the Attorney's Calendar, the title
   (the type and the client's name), Eastern time, the slot (free, 15-minute buffers, hours, consult window, new client
   days and count, follow-ups in the afternoon, same-day approval), the length cap, the meeting type stated, the
   description (name, callback number, DOB, DOL, what it's about) and an email reminder a day before. Changes to the
   attorney's own appointments are listed for the trainer (a caller may have asked for them), not marked. */
const OPEN = !TRK;
function typeOf(title) {
    const t = alnum(title);
    return Object.keys(GCAL_TYPES).sort((a, b) => b.length - a.length).find(k => t.startsWith(alnum(k))) || '';
}
function gradeOpenEvent(e, all, today) {
    const items = []; let pts = 0;
    const add = (ok, t, w) => { items.push({ ok, t }); if (ok) pts += w; };
    const type = typeOf(e.title), T = GCAL_TYPES[type] || { max: 30 };
    // the client's name: what's left of the title after the type (its letters and digits, whatever the punctuation)
    let name = '';
    if (type) { const title = String(e.title || ''), want = alnum(type).length; let k = 0, n = 0; while (k < title.length && n < want) { if (/[a-z0-9]/i.test(title[k])) n++; k++; } name = title.slice(k).replace(/^[\s:–—-]+/, '').trim(); }
    add(e.cal === 'attorney', e.cal === 'attorney' ? 'On the Attorney’s Calendar.' : `It’s on the ${calOf(e.cal).name}, not the Attorney’s Calendar.`, 1);
    const okTitle = !!type && name.length > 1;
    add(okTitle, okTitle ? 'Title: the request type and the client’s name.' : !type ? `The title should start with the request type, then the client’s name (${GCAL_RULES.title.replace(/^Use the request type and the client’s name, /, '')})` : 'Add the client’s name after the request type in the title.', 1.5);
    add((e.tz || ET) === ET, (e.tz || ET) === ET ? 'Time zone: Eastern.' : `The event’s time zone is ${(TZS.find(z => z[0] === e.tz) || [0, e.tz])[1]}; the calendar should be in Eastern (EST).`, 0.5);
    const probs = slotProblems(e, all, T);
    if (e.date === today && !/approv/i.test(plain(e.desc))) probs.push('Same-day bookings need the attorney’s approval: book the next business day, or write in the description that it’s pending the attorney’s approval.');
    add(!probs.length, probs.length ? probs.join(' ') : 'The slot follows the attorney’s rules (free, 15-minute buffers, hours).', 3);
    const dur = mins(e.end) - mins(e.start);
    add(!e.allDay && dur >= 15 && dur <= T.max, `Length: ${e.allDay ? 'all day' : dur + ' minutes'} (at most ${T.max}${type ? ' for a ' + type : ''}).`, 1);
    const wantC = lengthColor(dur) || lengthColor(T.max);
    add((e.color || '') === wantC, (e.color || '') === wantC ? `Color: ${colorName(wantC)}, right for its length.` : `A ${lengthColor(dur) ? dur + '-minute' : T.max + '-minute'} appointment is colored ${colorName(wantC)} (30 minutes Tangerine, 45 Blueberry, 1 hour Tomato)${e.color ? `; it’s ${colorName(e.color)}` : ''}.`, 0.5);
    const where = `${e.location || ''} ${plain(e.desc)}`, office = new RegExp(rx(GCAL_OFFICE.split(/[,\s]+/).slice(0, 2).join(' ')) + '|office', 'i').test(e.location || '');
    const mt = T.consult ? (e.meet ? 'Consultations are phone only: remove the Google Meet link.' : (/phone|call/i.test(where) ? '' : 'Consultations are phone consults: say it’s a phone call (Location: Phone call) and that the attorney will call the client.'))
        : (e.meet || /phone|call/i.test(where) || office ? '' : `Clarify the meeting type: Google Meet for a video call, “Phone call” in Location, or the office (${GCAL_OFFICE}) for in person.`);
    add(!mt, mt || (e.meet ? 'Meeting type: video call, Google Meet added.' : office ? 'Meeting type: in person, at the office.' : 'Meeting type: phone call.'), 1);
    const tx = plain(e.desc), lo = tx.toLowerCase();
    const dated = (re) => { const m = re.exec(tx); return !!m && datesIn(tx.slice(m.index, m.index + 60)).length > 0; };
    const rest = tx.replace(/\b(name|cb|callback|call ?back|number|phone|dob|dol|date of (birth|loss))\b[^\n]*/gi, ' ').replace(/[\d()/.:+-]+/g, ' ');
    const need = [['the client’s name', name.length > 1 ? hasName(tx, name) : /name/i.test(tx)], ['the callback number', digits(tx).length >= 10],
        ['the DOB', dated(/\b(dob|date of birth|birth ?date)\b/i)], ['the DOL', dated(/\b(dol|date of loss|date of (the )?(accident|incident))\b/i)],
        ['what it’s about', (() => { const skip = new Set(name.toLowerCase().split(/\s+/).concat(['notes', 'note', 'reason', 'about', 'client', 'the', 'and', 'for']));
            return rest.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2 && !skip.has(w)).length >= 1; })()]];
    const got = need.filter(n => n[1]).length;
    pts += 1.5 * got / need.length;
    items.push({ ok: got === need.length, t: got === need.length ? 'Description: name, callback number, DOB, DOL and the reason.' : `The description is missing ${need.filter(n => !n[1]).map(n => n[0]).join(', ')}.` });
    void lo;
    const rem = (e.notifs || []).some(n => n.m === 'email' && nmins(n) === 1440);
    add(rem, rem ? 'Email reminder a day before.' : 'Add an email notification 1 day before.', 0.5);
    return { pts, max: BOOK_MAX, items };
}
function checkOpen(st, today) {
    const all = instancesOf(st, addDays(today, -7), addDays(today, 42));
    const mine = all.filter(e => !e.seed && e.cal !== 'holidays').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const out = mine.map(e => Object.assign({ id: e.iid, date: e.date, head: e.title || '(No title)', when: `${shortDate(e.date)} · ${e.allDay ? 'all day' : span(mins(e.start), mins(e.end))}` }, gradeOpenEvent(e, all, today)));
    const changed = [];
    Object.keys(st.ex).forEach(k => { const m = /^s:(.+)@(\d{4}-\d{2}-\d{2})$/.exec(k); const r = m && rowById(m[1]); if (r) changed.push(st.ex[k].del ? `${r.title} on ${shortDate(m[2])}: cancelled` : `${r.title} on ${shortDate(m[2])}: moved to ${shortDate(st.ex[k].date || m[2])} ${tl(mins(st.ex[k].start || r.start))}`); });
    Object.keys(st.sx).forEach(id => { const r = rowById(id); if (r) changed.push(`${r.title}: changed for every week`); });
    const got = out.reduce((a, r) => a + r.pts, 0), max = out.reduce((a, r) => a + r.max, 0);
    return { score: max ? Math.min(100, Math.round(got / max * 100)) : 0, results: out, extra: [], changed, penalty: 0, right: out.filter(r => r.pts >= r.max - 0.01).length, open: true };
}
const checkNow = () => OPEN ? checkOpen(S, S.today) : checkPlan(S, S.reqs, S.today);
function checkPlan(st, reqs, today) {
    const all = instancesOf(st, addDays(today, -7), addDays(today, 42));
    const handled = new Set();
    const out = reqs.map(q => {
        const R = reqDef(q.id), row = q.row != null ? rowById(q.row) : null;
        const head = R.kind === 'book' ? `${R.type} – ${R.name}` : `${R.kind === 'move' ? 'Move' : 'Cancel'}: ${row ? row.title : R.name}`;
        if (R.kind !== 'book' && !row) return { id: q.id, head, pts: 0, max: 0, items: [{ ok: true, t: 'No longer on the schedule (an Admin changed it).' }] };
        if (R.kind === 'book') {
            const cands = all.filter(e => !e.seed && e.cal !== 'holidays' && hasName(e.title, R.name));
            if (!cands.length) return { id: q.id, head, pts: 0, max: BOOK_MAX, items: [{ ok: false, t: 'It isn’t on the calendar.' }] };
            const best = cands.map(e => gradeBookEvent(e, q, R, all, today)).sort((a, b) => b.pts - a.pts)[0];
            return { id: q.id, head, pts: best.pts, max: BOOK_MAX, items: best.items, when: `${shortDate(best.ev.date)} · ${best.ev.allDay ? 'all day' : span(mins(best.ev.start), mins(best.ev.end))}` };
        }
        const iid = `s:${q.row}@${q.orig}`; handled.add(iid);
        const inst = all.find(e => e.seed && e.row === q.row && e.origDate === q.orig);
        const every = st.sx[q.row];
        if (R.kind === 'cancel') {
            if (every && every.del) return { id: q.id, head, pts: 5, max: 10, items: [{ ok: false, t: 'You deleted it from every week; only this one was cancelled.' }] };
            if (!inst) return { id: q.id, head, pts: 10, max: 10, items: [{ ok: true, t: `Cancelled: ${shortDate(q.orig)}, ${span(mins(row.start), mins(row.end))}.` }] };
            return { id: q.id, head, pts: 0, max: 10, items: [{ ok: false, t: inst.date !== q.orig || inst.start !== row.start ? 'It was moved, not cancelled.' : `It’s still on ${shortDate(q.orig)}.` }] };
        }
        const items = []; let pts = 0;
        const still = inst && inst.date === q.orig && inst.start === row.start;
        const target = (inst && !still) ? inst : all.find(e => !e.seed && hasName(e.title, R.name) && (q.dates || []).includes(e.date));
        if (every) items.push({ ok: false, t: 'You changed it for every week; only this week’s was to move.' });
        items.push({ ok: !still, t: still ? `It’s still on ${shortDate(q.orig)} at ${tl(mins(row.start))}.` : `Off ${shortDate(q.orig)}, ${tl(mins(row.start))}.` }); if (!still) pts += 3;
        if (!target) items.push({ ok: false, t: `It isn’t on the new day (${availText(q, R)}).` });
        else {
            const T = GCAL_TYPES[R.type] || { max: 30 };
            const inWin = (q.dates || []).includes(target.date) && mins(target.start) >= mins(R.from) && mins(target.end) <= mins(R.to);
            items.push({ ok: inWin, t: inWin ? `Moved to ${shortDate(target.date)}, ${span(mins(target.start), mins(target.end))}: a time the caller can do.` : `Moved to ${shortDate(target.date)}, ${span(mins(target.start), mins(target.end))}; the caller asked for ${availText(q, R)}.` }); if (inWin) pts += 2;
            const probs = slotProblems(target, all, T);
            items.push({ ok: !probs.length, t: probs.length ? probs.join(' ') : WW('The new slot follows the attorney’s rules.') }); if (!probs.length) pts += 4;
            const dur = mins(target.end) - mins(target.start);
            items.push({ ok: dur >= 15 && dur <= T.max, t: `Length: ${dur} minutes (at most ${T.max}).` }); if (dur >= 15 && dur <= T.max) pts += 1;
        }
        if (every) pts = Math.max(0, pts - 3);
        return { id: q.id, head, pts, max: 10, items };
    });
    // the attorney's appointments no one asked about: changed or deleted
    const extra = [];
    Object.keys(st.ex).forEach(k => { const m = /^s:(.+)@(\d{4}-\d{2}-\d{2})$/.exec(k); const r = m && rowById(m[1]); if (r && !handled.has(k)) extra.push(`${r.title} on ${shortDate(m[2])}`); });
    Object.keys(st.sx).forEach(id => { const r = rowById(id); if (r && !reqs.some(q => q.row === id)) extra.push(`${r.title} (every week)`); });
    const penalty = Math.min(25, extra.length * 5);
    const got = out.reduce((a, r) => a + r.pts, 0), max = out.reduce((a, r) => a + r.max, 0);
    const score = Math.max(0, Math.min(100, Math.round((max ? got / max * 100 : 100) - penalty)));
    return { score, results: out, extra, penalty, right: out.filter(r => r.max && r.pts >= r.max - 0.01).length };
}

/* ---------- state (this browser, one calendar per trainee) ---------- */
const KEY = () => 'lsh_gcal' + (TRK ? '.' + TRK : '') + ':' + String(Sim.who().name || 'guest').trim().toLowerCase();
let S = null;
const G = { pop: null, temp: null, drag: null, undo: null, q: '', menu: null, meet: null, ed: null };
function fresh() {
    const today = simToday();
    return { v: 1, today, view: innerWidth < 640 ? 'day' : 'week', anchor: today, mini: today.slice(0, 7), side: innerWidth > 900, panel: innerWidth > 1100 && !OPEN ? 'requests' : '',
        hidden: {}, set: { dur: 30, weekends: false, tz2: false }, events: [], ex: {}, sx: {}, reqs: OPEN ? [] : dealRequests(today), result: null };
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY()) || 'null'); if (s && s.v === 1 && Array.isArray(s.reqs)) { if (OPEN) { s.reqs = []; s.today = simToday(); } return s; } } catch (e) { /* none */ } return null; }   // (Standard Training has no dealt set: its today follows the calendar)
// What counts as the calendar's content (a view or a panel opening is not: it is kept in this browser but never sent as a newer copy)
const sigNow = () => S ? JSON.stringify([S.events, S.ex, S.sx, (S.reqs || []).map(q => [q.id, q.done]), S.set, S.hidden]) : '';
function save(local) {
    if (RV) return;   // a trainer reviewing a trainee's calendar (?review=) saves nothing
    const changed = sigNow() !== CLOUD.sig;
    if (!local && S && changed) S.savedAt = Date.now();
    try { localStorage.setItem(KEY(), JSON.stringify(S)); } catch (e) { /* private mode */ }
    if (!local && changed) cloudQueue();
}
/* ---------- 💾 saved to the trainee's Portal account (/api/gcal-reviews?draft=…), so their work isn't lost ----------
   Every change is kept in this browser at once and sent to their account 3 seconds after the last one (and when the page
   closes). On opening, the newer of the two comes back: their calendar follows them to another browser or computer. */
const CLOUD = { state: '', at: 0, timer: null, busy: false, again: false, base: null, sig: '' };   // base: the updatedAt of the copy on their account this one was made from; sig: what was last in sync
const cloudOn = () => !Sim.isAdmin();
function cloudQueue() { if (!cloudOn()) return; clearTimeout(CLOUD.timer); CLOUD.state = CLOUD.state === 'off' ? 'off' : 'pending'; paintCloud(); CLOUD.timer = setTimeout(cloudSave, 3000); }
async function cloudSave(keep) {
    clearTimeout(CLOUD.timer);
    if (!cloudOn() || !S) return;
    if (CLOUD.busy) { CLOUD.again = true; return; }
    CLOUD.busy = true; CLOUD.state = 'saving'; paintCloud();
    try {
        const res = await Sim.fetchRetry(EV_API, { method: 'POST', credentials: 'include', keepalive: !!keep, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'draft', track: GCAL_TRACK || 'standard', data: S, base: CLOUD.base }) });
        const d = await res.json().catch(() => ({}));
        if (res.status === 401) CLOUD.state = 'off';
        else if (res.status === 409 && d.code === 'DRAFT_NEWER') { CLOUD.state = 'newer'; CLOUD.again = false; snack('A newer copy of this calendar is saved to your account (another tab or device). Yours wasn’t sent.'); }
        else if (res.ok && d.success) { CLOUD.state = 'saved'; CLOUD.at = Date.now(); CLOUD.base = d.updatedAt || CLOUD.base; CLOUD.sig = sigNow(); }
        else CLOUD.state = 'error';
    } catch (e) { CLOUD.state = 'error'; }
    CLOUD.busy = false; paintCloud();
    if (CLOUD.again) { CLOUD.again = false; cloudSave(); }
}
async function cloudLoad(force) {
    if (!cloudOn()) return;
    try {
        const res = await Sim.fetchRetry(EV_API + '?draft=' + encodeURIComponent(GCAL_TRACK || 'standard'), { credentials: 'include' });
        if (res.status === 401) { CLOUD.state = 'off'; paintCloud(); return; }
        const d = await res.json().catch(() => ({}));
        const c = d && d.success && d.data;
        if (d && d.success) CLOUD.base = d.updatedAt || null;
        if (c && c.v === 1 && Array.isArray(c.events) && (force || (c.savedAt || 0) > ((S && S.savedAt) || 0))) {
            if (OPEN) { c.reqs = []; c.today = simToday(); } else if (!Array.isArray(c.reqs)) c.reqs = S.reqs;
            S = c; CLOUD.sig = sigNow(); save(true); CLOUD.state = 'saved'; CLOUD.at = c.savedAt; closeAll(); render(); snack(force ? 'The newer copy is open' : 'Your saved calendar is back');
        } else if (S && S.savedAt && (!c || (c.savedAt || 0) < S.savedAt)) cloudSave();   // this browser has newer work: send it
        else { CLOUD.state = c ? 'saved' : ''; CLOUD.at = c ? c.savedAt : 0; if (c) CLOUD.sig = sigNow(); paintCloud(); }
    } catch (e) { CLOUD.state = 'error'; paintCloud(); }
}
function cloudText() {
    const t = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return ({ pending: 'Unsaved changes…', saving: 'Saving…', saved: CLOUD.at ? `✓ Saved to your account ${t(CLOUD.at)}` : '✓ Saved to your account',
        error: '⚠ Not saved to your account yet (kept in this browser). Try 💾 Save again.', newer: '⚠ A newer copy of this calendar is saved to your account (another tab or device). Your changes here are kept in this browser, not sent.', off: 'Sign in to the LSH Training Portal to save your calendar to your account (it’s kept in this browser for now).' })[CLOUD.state] || 'Your calendar saves to your account as you work.';
}
function cloudHtml() {
    if (!cloudOn() || RV) return '';   // (a trainer looking at a trainee's calendar saves nothing)
    return `<div class="cloud ${CLOUD.state}" id="gc-cloud"><span>${esc(cloudText())}</span>${CLOUD.state === 'newer' ? '<button class="txt" data-a="cloud-newer" style="padding:0 8px;height:28px">Open the newer copy</button>' : '<button class="txt" data-a="cloud-save" style="padding:0 8px;height:28px">💾 Save</button>'}</div>`;
}
function paintCloud() { const n = document.getElementById('gc-cloud'); if (n) n.outerHTML = cloudHtml(); }
window.addEventListener('pagehide', () => { if (CLOUD.state === 'pending' || CLOUD.state === 'error') cloudSave(true); });
// (an Admin editing the weekly schedule sees the schedule itself: no practice changes or own events)
const stNow = () => G.admin ? { events: [], ex: {}, sx: {} } : S;
const instances = (from, to, all) => instancesOf(stNow(), from, to).filter(e => all || !S.hidden[e.cal]);
const findInst = (iid) => { const d = String(iid).split('@')[1] || S.anchor; return instancesOf(stNow(), addDays(d, -1), addDays(d, 1)).find(e => e.iid === iid) || instancesOf(stNow(), addDays(S.anchor, -60), addDays(S.anchor, 120)).find(e => e.iid === iid); };
const uid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function snapshot() { G.undo = JSON.stringify({ events: S.events, ex: S.ex, sx: S.sx, rows: G.admin ? ROWS : null }); }
function undo() { if (!G.undo) return; const u = JSON.parse(G.undo); S.events = u.events; S.ex = u.ex; S.sx = u.sx; if (u.rows) { ROWS = u.rows; putRows(); } G.undo = null; save(); closeAll(); render(); snack('Undone'); }
// An Admin's change to the weekly schedule, for everyone
async function putRows() {
    try {
        const res = await Sim.fetchRetry(API_SCHEDULE, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: ROWS }) });
        const data = await res.json().catch(() => ({}));
        if (!data.success) snack(data.error || 'The schedule wasn’t saved. Try again.');
    } catch (e) { snack('The schedule wasn’t saved (no connection).'); }
}
function adminRowChange(id, fields) {
    const r = rowById(id); if (!r) return;
    if (fields.date) r.wd = wd(fields.date);
    ['start', 'end', 'title', 'location', 'color'].forEach(k => { if (k in fields && fields[k] != null) r[k] = fields[k]; });
    if ('desc' in fields) r.notes = plain(fields.desc).trim();
    if (fields.allDay) { r.start = '00:00'; r.end = '23:59'; }
}
// Changes to an event: the trainee's own, one day of a repeating one, or the attorney's appointment (this one / all).
const FIELDS = ['cal', 'title', 'date', 'start', 'end', 'allDay', 'tz', 'color', 'location', 'meet', 'desc', 'guests', 'notifs', 'busy', 'vis', 'perms', 'repeat'];
function applyChange(inst, fields, scope) {
    snapshot();
    if (G.admin && inst.seed) { adminRowChange(inst.row, fields); putRows(); return; }
    if (inst.seed) {
        if (scope === 'all') { const f = Object.assign({}, fields); delete f.date; delete f.repeat; S.sx[inst.row] = Object.assign({}, S.sx[inst.row], f); }
        else { const f = Object.assign({}, fields); delete f.repeat; S.ex[inst.iid] = Object.assign({}, S.ex[inst.iid], f); }
    } else {
        const ev = S.events.find(x => x.id === inst.sid); if (!ev) return;
        if ((ev.repeat || 'none') === 'none' || scope === 'all') {
            const f = Object.assign({}, fields);
            if ((ev.repeat || 'none') !== 'none' && scope === 'all' && f.date) { const shift = (D(f.date) - D(inst.date)) / 86400000; f.date = addDays(ev.date, shift); }
            Object.assign(ev, f);
        } else { const f = Object.assign({}, fields); delete f.repeat; S.ex[inst.iid] = Object.assign({}, S.ex[inst.iid], f); }
    }
    save();
}
function removeInst(inst, scope) {
    snapshot();
    if (G.admin && inst.seed) { ROWS = ROWS.filter(r => r.id !== inst.row); putRows(); return; }
    if (inst.seed) { if (scope === 'all') S.sx[inst.row] = { del: true }; else S.ex[inst.iid] = { del: true }; }
    else {
        const ev = S.events.find(x => x.id === inst.sid);
        if (!ev) return;
        if ((ev.repeat || 'none') === 'none' || scope === 'all') S.events = S.events.filter(x => x.id !== ev.id);
        else S.ex[inst.iid] = { del: true };
    }
    save();
}
const repeating = (inst) => inst.seed || ((inst.repeat || 'none') !== 'none');
// "This event / All events" for a repeating event (the attorney's appointments repeat every week)
function askScope(inst, verb, then) {
    if (!repeating(inst) || (G.admin && inst.seed)) return then(G.admin && inst.seed ? 'all' : 'one');
    dialog(`${verb === 'delete' ? 'Delete' : 'Edit'} recurring event`, `<label><input type="radio" name="sc" value="one" checked> This event</label><label><input type="radio" name="sc" value="all"> All events</label>`,
        (box) => then(box.querySelector('input[name=sc]:checked').value));
}

/* ---------- icons (Material) ---------- */
const P = {
    menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z', left: 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z', right: 'M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
    search: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    help: 'M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z',
    gear: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    del: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    mail: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z',
    more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
    clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
    place: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z',
    notes: 'M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z',
    people: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
    bell: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
    cal: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
    video: 'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',
    copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
    check: 'M9 16.17 4.83 12l-1.42 1.42L9 19 21 7l-1.41-1.41z',
    lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
    req: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
    book: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
    grade: 'M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM10 17H5v-2h5v2zm0-4H5v-2h5v2zm0-4H5V7h5v2zm4.82 6L12 12.16l1.41-1.41 1.41 1.42L17.99 9l1.42 1.42L14.82 15z',
    mic: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
    end: 'M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z',
    present: 'M20 18c1.1 0 1.99-.9 1.99-2L22 6a2 2 0 0 0-2-2H4c-1.11 0-2 .89-2 2v10a2 2 0 0 0 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z',
    hand: 'M21 7c0-1.38-1.12-2.5-2.5-2.5-.17 0-.34.02-.5.05V4c0-1.38-1.12-2.5-2.5-2.5-.23 0-.46.03-.67.09C14.46.66 13.56 0 12.5 0c-1.23 0-2.25.89-2.46 2.06C9.87 2.02 9.69 2 9.5 2 8.12 2 7 3.12 7 4.5v5.89c-.34-.31-.76-.54-1.22-.66L5.01 9.5c-.83-.23-1.7.09-2.19.83-.38.57-.4 1.31-.15 1.95l2.56 6.43C6.49 21.91 9.57 24 13.02 24 17.42 24 21 20.42 21 16.02V7z',
    cc: 'M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z'
};
const ic = (n, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n]}"/></svg>`;
const PLUS = '<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><path fill="#34A853" d="M16 16v14h4V20z"/><path fill="#4285F4" d="M30 16H20l-4 4h14z"/><path fill="#FBBC05" d="M6 16v4h10l4-4z"/><path fill="#EA4335" d="M20 16V6h-4v14z"/></svg>';
const $ = (s, el) => (el || document).querySelector(s);
const gc = () => $('#gc');

/* ---------- drawing ---------- */
function render() {
    const app = $('#app');
    if (!$('#gc')) {
        const old = document.querySelector('.sim-hero > #gc-scores'); if (old) old.remove();
        app.innerHTML = `<div class="gc" id="gc" tabindex="-1"><div class="gc-head" id="gc-head"></div>
            <div class="gc-body"><aside class="gc-side" id="gc-side"></aside><main class="gc-main" id="gc-main"></main><aside class="gc-panel" id="gc-panel"></aside></div><nav class="gc-rail" id="gc-rail" aria-label="Calendar tools"></nav></div>
            <section class="gc-scores" id="gc-scores" aria-label="Scores"></section>`;
        bind(); placeScores();
    }
    renderHead(); renderSide(); renderMain(); renderPanel(); renderRail();
}
// 📊 A trainee's scores sit at the bottom of the blue card on the left when the card is a column (1400px and wider);
// otherwise, and a trainer's scorecard or review form (too wide for the card), below the calendar.
const WIDE = window.matchMedia ? matchMedia('(min-width: 1400px)') : null;
function placeScores() {
    const sc = $('#gc-scores'), hero = document.querySelector('.sim-hero'), app = $('#app'); if (!sc || !app) return;
    const inHero = !RV && !!hero && !!WIDE && WIDE.matches;
    if (inHero && sc.parentNode !== hero) hero.appendChild(sc);
    else if (!inHero && sc.parentNode !== app) app.appendChild(sc);
    sc.classList.toggle('in-hero', inHero);
}
// 📖 The blue card holds this track's attorney's rules (in place of the page's intro): open where the card is a column, folded
// to one line where it sits on top of the calendar (a click opens it).
function heroRules() {
    const hero = document.querySelector('.sim-hero'); if (!hero) return;
    let d = $('#hero-rules');
    if (!d) {
        const intro = hero.querySelector('p'), box = document.createElement('div'); box.className = 'hero-rules-wrap';
        box.innerHTML = `<details class="hero-rules" id="hero-rules"><summary>📖 ${WW('The attorney’s rules')} · ${esc(CFG.label)}</summary><div class="rules">${rulesHtml()}</div></details>`;
        if (intro) intro.replaceWith(box); else hero.appendChild(box);
        d = $('#hero-rules');
        if (WIDE) { const fit = () => { placeScores(); d.open = WIDE.matches; }; WIDE.addEventListener ? WIDE.addEventListener('change', fit) : WIDE.addListener(fit); }
    }
    d.open = !!(WIDE && WIDE.matches);
}
function viewDays() {
    if (S.view === 'day') return [S.anchor];
    const narrow = ($('#gc-main') ? $('#gc-main').clientWidth : innerWidth) < 560;
    if (narrow) { const s = S.anchor; return [s, addDays(s, 1), addDays(s, 2)]; }
    const start = weekStart(S.anchor, !S.set.weekends);
    return Array.from({ length: S.set.weekends ? 7 : 5 }, (_, i) => addDays(start, i));
}
function title() {
    const m = (s) => MON[+s.slice(5, 7) - 1], y = (s) => s.slice(0, 4);
    if (G.q) return `Search results`;
    if (S.view === 'day') return `${m(S.anchor)} ${+S.anchor.slice(8)}, ${y(S.anchor)}`;
    if (S.view === 'month' || S.view === 'agenda') return `${m(S.anchor)} ${y(S.anchor)}`;
    const d = viewDays(), a = d[0], b = d[d.length - 1];
    if (a.slice(0, 7) === b.slice(0, 7)) return `${m(a)} ${y(a)}`;
    return y(a) === y(b) ? `${m(a).slice(0, 3)} – ${m(b).slice(0, 3)} ${y(b)}` : `${m(a).slice(0, 3)} ${y(a)} – ${m(b).slice(0, 3)} ${y(b)}`;
}
const VIEWS = [['day', 'Day', 'D'], ['week', 'Week', 'W'], ['month', 'Month', 'M'], ['agenda', 'Schedule', 'A']];
function renderHead() {
    const today = etNow().date;
    $('#gc-head').innerHTML = `
        <button class="ib" data-a="side" aria-label="Main menu" title="Main menu">${ic('menu')}</button>
        <div class="gc-logo"><div class="cal"><i></i><b>${+today.slice(8)}</b></div><span>Calendar<small>LSH training simulator</small></span></div>
        <button class="pill today" data-a="today" title="${esc(longDate(today))}">Today</button>
        <button class="ib" data-a="prev" aria-label="Previous">${ic('left')}</button><button class="ib" data-a="next" aria-label="Next">${ic('right')}</button>
        <div class="gc-title">${esc(title())}</div>
        <div class="grow"></div>
        <div class="gc-search ${G.searching ? 'on' : ''}" id="gc-search">${ic('search')}<input id="gc-q" placeholder="Search" value="${esc(G.q)}" aria-label="Search events"><button class="ib" data-a="search-x" aria-label="Clear search">${ic('close')}</button></div>
        ${G.searching ? '' : `<button class="ib" data-a="search" aria-label="Search" title="Search">${ic('search')}</button>`}
        <button class="ib gc-hide-sm" data-a="help" aria-label="Keyboard shortcuts" title="Keyboard shortcuts">${ic('help')}</button>
        <button class="ib gc-hide-sm" data-a="settings" aria-label="Settings" title="Settings">${ic('gear')}</button>
        <div class="gc-view"><button class="pill" data-a="views" aria-haspopup="menu">${(VIEWS.find(v => v[0] === S.view) || VIEWS[1])[1]} ▾</button></div>`;
}
function miniHtml() {
    const m = S.mini, first = m + '-01', start = weekStart(first, false), today = etNow().date;
    let rows = '';
    for (let r = 0; r < 6; r++) {
        rows += '<tr>' + Array.from({ length: 7 }, (_, i) => { const d = addDays(start, r * 7 + i); const cls = d === today ? 't' : d === S.anchor ? 's' : d.slice(0, 7) !== m ? 'o' : ''; return `<td><button class="${cls}" data-a="goday" data-d="${d}" aria-label="${esc(longDate(d))}">${+d.slice(8)}</button></td>`; }).join('') + '</tr>';
    }
    return `<div class="mini"><div class="mh"><span>${MON[+m.slice(5) - 1]} ${m.slice(0, 4)}</span><span><button class="ib" data-a="mini-prev" aria-label="Previous month">${ic('left')}</button><button class="ib" data-a="mini-next" aria-label="Next month">${ic('right')}</button></span></div>
        <table><tr>${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<th>${x}</th>`).join('')}</tr>${rows}</table></div>`;
}
function renderSide() {
    const side = $('#gc-side'); side.classList.toggle('off', !S.side);
    const box = (c) => `<label><input type="checkbox" data-cal="${c.id}" ${S.hidden[c.id] ? '' : 'checked'}><span class="box" style="border-color:${calColor(c.id)};background:${S.hidden[c.id] ? '#fff' : calColor(c.id)}">${S.hidden[c.id] ? '' : `<svg viewBox="0 0 24 24"><path d="${P.check}"/></svg>`}</span>${esc(c.name)}</label>`;
    side.innerHTML = `<button class="gc-create" data-a="create">${PLUS}Create</button>${miniHtml()}
        <div class="cals"><h4>My calendars</h4>${GCAL_CALENDARS.filter(c => !c.other).map(box).join('')}<h4>Other calendars</h4>${GCAL_CALENDARS.filter(c => c.other).map(box).join('')}${Sim.isAdmin() && !RV ? '<button class="txt" data-a="cc-open" style="padding:0 6px;height:30px;margin:10px 0 0 2px" title="Choose the colors of the calendars and of the existing schedule, for everyone">🎨 Color coding</button>' : ''}</div>`;
}
function layoutDay(evs) {
    evs = evs.slice().sort((a, b) => mins(a.start) - mins(b.start) || mins(b.end) - mins(a.end));
    const out = []; let cluster = [], end = -1;
    const flush = () => { const cols = []; cluster.forEach(e => { let c = cols.findIndex(x => x <= mins(e.start)); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = mins(e.end); e._c = c; }); cluster.forEach(e => { e._n = cols.length; out.push(e); }); cluster = []; };
    evs.forEach(e => { if (cluster.length && mins(e.start) >= end) { flush(); end = -1; } cluster.push(e); end = Math.max(end, mins(e.end)); });
    flush();
    return out;
}
function evHtml(e, extra) {
    const s = mins(e.start), en = Math.max(mins(e.end), s + 15), h = Math.max((en - s) / 60 * HH - 2, 16), shortish = h < 34;
    const left = e._n ? (e._c / e._n) * 100 : 0, width = e._n ? 100 / e._n : 100;
    const lite = e.busy === false;
    return `<div class="ev ${shortish ? 'short' : ''} ${lite ? 'lite' : ''} ${extra || ''}" data-iid="${esc(e.iid)}" role="button" tabindex="0" aria-label="${esc(e.title + ', ' + span(s, en))}"
        style="top:${s / 60 * HH}px;height:${h}px;left:calc(${left}% + 1px);width:calc(${width}% - 4px);background:${colorOf(e)};border-left-color:${colorOf(e)}">
        ${shortish ? `<b>${esc(e.title || '(No title)')}</b>, ${tl(s)}` : `<b>${esc(e.title || '(No title)')}</b><span>${span(s, en)}</span>${h > 70 && e.location ? `<span>${esc(e.location)}</span>` : ''}`}
        ${e.readOnly ? '' : '<i class="rs" data-rs="1"></i>'}</div>`;
}
const chipHtml = (e, dot) => dot && !e.allDay
    ? `<button class="chip dot" data-iid="${esc(e.iid)}"><i style="background:${colorOf(e)}"></i>${tl(mins(e.start))} <b style="font-weight:500;overflow:hidden;text-overflow:ellipsis">${esc(e.title || '(No title)')}</b></button>`
    : `<button class="chip" data-iid="${esc(e.iid)}" style="background:${colorOf(e)}">${esc(e.title || '(No title)')}</button>`;
function renderWeek(days) {
    const main = $('#gc-main'), today = etNow().date, nowM = mins(etNow().time);
    const evs = instances(days[0], days[days.length - 1]);
    const tz2 = S.set.tz2, d0 = days[0];
    const off2 = tz2 ? offsetMin('Asia/Manila', d0) - offsetMin(ET, d0) : 0;
    let hours = '';
    for (let h = 1; h < 24; h++) hours += `<span style="top:${h * HH}px">${tz2 ? `<em>${hourLabel(((h * 60 + off2) / 60 % 24 + 24) % 24 | 0)}</em>` : ''}${hourLabel(h)}</span>`;
    let lines = ''; for (let h = 1; h < 24; h++) lines += `<div class="ln" style="top:${h * HH}px"></div>`;
    const cols = days.map(d => {
        const timed = layoutDay(evs.filter(e => e.date === d && !e.allDay));
        const temp = G.temp && G.temp.date === d ? evHtml(Object.assign({ iid: 'temp', title: G.temp.title || '(No title)', cal: G.temp.cal || 'lsh', _n: 1, _c: 0 }, G.temp), 'temp') : '';
        return `<div class="wk-col" data-d="${d}">${lines}${timed.map(e => evHtml(e)).join('')}${temp}${d === today ? `<div class="now" style="top:${nowM / 60 * HH}px"></div>` : ''}</div>`;
    }).join('');
    const allDay = days.map(d => `<div class="cell">${evs.filter(e => e.date === d && e.allDay).map(e => chipHtml(e)).join('')}</div>`).join('');
    const scroll = $('#wk-scroll'), keep = scroll ? scroll.scrollTop : null;
    main.innerHTML = `<div class="wk-head"><div class="wk-gut ${tz2 ? 'two' : ''}"><div class="tz">${tz2 ? gmt('Asia/Manila', d0) + '<br>' : ''}${gmt(ET, d0)}</div></div>${days.map(d => `<div class="wk-day ${d === today ? 'today' : ''}"><div class="dn">${DAY3[wd(d)]}</div><button class="dd" data-a="goday" data-d="${d}" aria-label="${esc(longDate(d))}">${+d.slice(8)}</button></div>`).join('')}</div>
        <div class="wk-all"><div class="wk-gut ${tz2 ? 'two' : ''}"></div>${allDay}</div>
        <div class="wk-scroll" id="wk-scroll"><div class="wk-grid" style="height:${24 * HH}px"><div class="wk-hours ${tz2 ? 'two' : ''}">${hours}</div>${cols}</div></div>`;
    const sc = $('#wk-scroll'); sc.scrollTop = keep != null ? keep : 7 * HH;
}
function renderMonth() {
    const main = $('#gc-main'), today = etNow().date, m = S.anchor.slice(0, 7), start = weekStart(m + '-01', false);
    const evs = instances(start, addDays(start, 41));
    let html = `<div class="mo"><div class="mo-h">${DAY3.map(d => `<div>${d}</div>`).join('')}</div>`;
    for (let r = 0; r < 6; r++) {
        html += '<div class="mo-r">' + Array.from({ length: 7 }, (_, i) => {
            const d = addDays(start, r * 7 + i), list = evs.filter(e => e.date === d).sort((a, b) => (b.allDay - a.allDay) || mins(a.start) - mins(b.start));
            const shown = list.slice(0, 3);
            return `<div class="${d.slice(0, 7) !== m ? 'o' : ''} ${d === today ? 't' : ''}"><div class="n"><button data-a="goday" data-d="${d}" aria-label="${esc(longDate(d))}">${+d.slice(8) === 1 ? MON[+d.slice(5, 7) - 1].slice(0, 3) + ' 1' : +d.slice(8)}</button></div>
                ${shown.map(e => chipHtml(e, true)).join('')}${list.length > 3 ? `<button class="more" data-a="goday" data-d="${d}">${list.length - 3} more</button>` : ''}</div>`;
        }).join('') + '</div>';
    }
    main.innerHTML = html + '</div>';
}
function agendaHtml(list, emptyText) {
    const today = etNow().date, byDay = {};
    list.forEach(e => { (byDay[e.date] = byDay[e.date] || []).push(e); });
    const days = Object.keys(byDay).sort();
    if (!days.length) return `<div class="ag-empty">${esc(emptyText)}</div>`;
    return days.map(d => `<div class="ag-d"><div class="dt ${d === today ? 'today' : ''}"><b>${+d.slice(8)}</b><span>${MON[+d.slice(5, 7) - 1].slice(0, 3).toUpperCase()}, ${DAY3[wd(d)]}</span></div><div>
        ${byDay[d].sort((a, b) => (b.allDay - a.allDay) || mins(a.start) - mins(b.start)).map(e => `<div class="ag-e" data-iid="${esc(e.iid)}" role="button" tabindex="0"><i style="background:${colorOf(e)}"></i><span>${e.allDay ? 'All day' : span(mins(e.start), mins(e.end))}</span><b>${esc(e.title || '(No title)')}</b></div>`).join('')}</div></div>`).join('');
}
function renderMain() {
    renderMainInner();
    if (G.admin) $('#gc-main').insertAdjacentHTML('afterbegin', `<div class="adm" role="status"><b>Editing the ${WW('attorney’s')} weekly schedule for everyone.</b> Add, change, move or delete appointments on the ${WW('Attorney’s Calendar')}: every trainee gets the change.
        <span style="margin-left:auto;display:flex;gap:6px"><button class="pill" data-a="admin-reset">Restore the original</button><button class="blue" data-a="admin-edit">Done</button></span></div>`);
}
function renderMainInner() {
    const main = $('#gc-main'); main.classList.toggle('full', !S.side);
    if (G.q) {
        const q = G.q.toLowerCase();
        const list = instances(addDays(S.today, -60), addDays(S.today, 120), true).filter(e => `${e.title} ${e.location || ''} ${plain(e.desc)}`.toLowerCase().includes(q));
        main.innerHTML = `<div class="ag">${agendaHtml(list.slice(0, 200), 'No results')}</div>`;
        return;
    }
    if (S.view === 'month') return renderMonth();
    if (S.view === 'agenda') { main.innerHTML = `<div class="ag">${agendaHtml(instances(S.anchor, addDays(S.anchor, 30)), 'Nothing planned')}</div>`; return; }
    renderWeek(viewDays());
}
// The tools, in a bar along the bottom of the calendar: the callers' requests (not on Standard Training) and My evaluations;
// then the save status, 💾 Save and 📤 Submit for evaluation. (The attorney's rules live in the blue card on the left, and
// Check my calendar sits with 📊 Your scores: no buttons for them here.)
function renderRail() {
    const open = S.reqs.filter(q => !q.done).length;
    const b = (on, attrs, icon, label, badge) => `<button class="rb ${on ? 'on' : ''}" ${attrs}>${ic(icon)}<span>${label}</span>${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
    $('#gc-rail').innerHTML = `<div class="rb-group">
            ${OPEN ? '' : b(S.panel === 'requests', 'data-a="panel" data-p="requests"', 'req', 'Calendar requests', open)}
            ${Sim.isAdmin() ? `<a class="rb" id="gc-evals-link" href="${REVIEW_PAGE}" title="Trainee Evaluations: the submissions with their AI review, and your trainees' calendars">${ic('notes')}<span>Trainee evaluations</span></a>`   // (a trainer goes to the Trainee Evaluations page: a plain link, in this tab, like every Portal page)
                : b(S.panel === 'evals', 'data-a="evals"', 'notes', 'My evaluations', EV.ready)}</div>
        <div class="rb-group rb-end">${cloudHtml()}${Sim.isAdmin() || RV ? '' : '<button class="blue" data-a="submit-eval">📤 Submit for evaluation</button>'}</div>`;
}
function reqCard(q) {
    const R = reqDef(q.id); if (!R) return '';
    const row = q.row != null ? rowById(q.row) : null;
    if (R.kind !== 'book' && !row) return '';
    const kind = R.kind === 'book' ? '' : R.kind;
    const what = R.kind === 'book' ? R.type : `${R.kind === 'move' ? 'Move' : 'Cancel'}: ${row.title}`;
    const when = R.kind === 'cancel' ? `<b>Appointment:</b> ${esc(shortDate(q.orig))}, ${span(mins(row.start), mins(row.end))} (ET)`
        : R.kind === 'move' ? `<b>Now:</b> ${esc(shortDate(q.orig))}, ${span(mins(row.start), mins(row.end))} · <b>Can do:</b> ${esc(availText(q, R))}`
        : `<b>${R.sameDay ? 'Wants' : 'Can do'}:</b> ${esc(availText(q, R))}`;
    return `<div class="rq ${q.done ? 'done' : ''}"><div class="top"><span class="av">${esc(R.name[0])}</span><div style="min-width:0"><div class="nm">${esc(R.name)}</div><div class="ty">${esc(what)}</div></div><span class="kind ${kind}">${R.kind === 'book' ? 'Book' : R.kind === 'move' ? 'Move' : 'Cancel'}</span></div>
        <dl><dt>Callback</dt><dd>${esc(R.cb)}</dd>${CFG.fields.length ? `<dt>DOB</dt><dd>${esc(R.dob)}</dd><dt>DOL</dt><dd>${esc(R.dol)}</dd><dt>Case</dt><dd>${R.caseNo ? `${esc(R.caseNo)}${R.mc ? ` <span style="color:#70757a">(${esc(R.mc)})</span>` : ''}` : 'New client: no file yet'}</dd>` : `<dt>Company</dt><dd>${esc(R.org || '')}</dd>`}<dt>Caller</dt><dd>${esc(R.mood)}</dd></dl>
        <q>${esc(R.said)}</q><div class="av2">${when}</div>
        <div class="acts"><button class="txt" data-a="req-go" data-id="${esc(q.id)}">Show on calendar</button><label><input type="checkbox" data-done="${esc(q.id)}" ${q.done ? 'checked' : ''}> Done</label></div></div>`;
}
function renderPanel() { renderSidePanel(); renderScores(); }
// The attorney's rules for this track (gcal-data.js: Standard Training, Litigation Week, Executive Week): in the 📖 panel
// and in the blue card on the left (heroRules).
const rulesHtml = () => `<p class="lead">${esc(CFG.lead)} Plot every appointment on the <b>${WW('Attorney’s Calendar')}</b>, in Eastern time.</p>
    <h4>Get from every caller</h4><ul>${GCAL_RULES.collect.map(x => `<li>${esc(WW(x))}</li>`).join('')}</ul>
    <h4>Title</h4><ul><li>${esc(WW(GCAL_RULES.title))}</li></ul>
    <h4>Scheduling rules</h4><ul>${GCAL_RULES.scheduling.map(x => `<li>${esc(WW(x))}</li>`).join('')}</ul>
    <h4>Additional notes</h4><ul>${GCAL_RULES.notes.map(x => `<li>${esc(WW(x))}</li>`).join('')}</ul>
    <h4>Office</h4><ul><li>${esc(GCAL_OFFICE)} (in-person meetings)</li></ul>`;
function renderSidePanel() {
    // (Standard Training has no requests panel: its appointments are on the calendar, the scores in 📊 Your scores)
    const P = OPEN && S.panel !== 'rules' && S.panel !== 'evals' ? '' : S.panel;
    const panel = $('#gc-panel'); panel.classList.toggle('off', !P);
    if (!P) { panel.innerHTML = ''; return; }
    const head = (t) => `<div class="ph"><h3>${t}</h3><button class="ib" data-a="panel" data-p="" aria-label="Close panel">${ic('close')}</button></div>`;
    if (S.panel === 'rules') { panel.innerHTML = head(WW('The attorney’s rules')) + `<div class="pb rules">${rulesHtml()}</div>`; return; }
    if (S.panel === 'evals') { panel.innerHTML = head('My evaluations') + `<div class="pb">${evalsHtml()}</div>`; return; }
    const open = S.reqs.filter(q => !q.done).length;
    panel.innerHTML = head('Calendar requests' + (TRK ? ' · ' + esc(CFG.label) : '')) + `<div class="pb"><p class="lead">Today is <b>${esc(longDate(S.today))}</b> (Eastern). These callers want appointments booked, moved or cancelled on the ${WW('attorney’s')} calendar. ${open ? `${open} still open.` : 'All marked done.'}</p>
        ${RV ? '' : '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="blue" data-a="check">Check my calendar</button><button class="pill" data-a="submit-eval" title="Send these appointments to your trainer for an AI and trainer review">📤 Submit for evaluation</button><button class="pill" data-a="new-set">New set</button></div>'}
        <p class="lead"><a href="#gc-scores" data-a="to-scores">${RV ? '📊 The scores are below the calendar ↓' : '📊 See your scores'}</a></p>
        ${S.reqs.map(reqCard).join('')}</div>`;
}

/* ---------- popovers: quick create, event card ---------- */
function closeAll(keepTemp) {
    ['.gc-pop', '.gc-menu'].forEach(s => document.querySelectorAll(s).forEach(n => n.remove()));
    G.pop = null; G.menu = null;
    if (!keepTemp && G.temp) { G.temp = null; if (S && $('#gc-main')) renderMain(); }
}
function place(el, rect) {
    const box = gc().getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    let left = rect ? rect.right - box.left + 8 : (box.width - w) / 2;
    if (rect && left + w > box.width - 8) left = rect.left - box.left - w - 8;
    if (left < 8) left = Math.max(8, (box.width - w) / 2);
    let top = rect ? rect.top - box.top - 20 : 90;
    top = Math.max(8, Math.min(top, box.height - h - 8));
    el.style.left = left + 'px'; el.style.top = top + 'px';
}
function calSelect(id, cur) { return `<select id="${id}" class="fin" aria-label="Calendar">${GCAL_CALENDARS.filter(c => !c.readOnly).map(c => `<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`; }
const meetCode = () => { const L = 'abcdefghijkmnopqrstuvwxyz', r = (n) => Array.from({ length: n }, () => L[Math.floor(Math.random() * L.length)]).join(''); return `${r(3)}-${r(4)}-${r(3)}`; };
function openQuick(temp, rect) {
    closeAll(true);
    G.temp = temp; renderMain();
    const el = document.createElement('div'); el.className = 'gc-pop'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'New event');
    const when = temp.allDay ? longDate(temp.date) : `${longDate(temp.date)} · ${span(mins(temp.start), mins(temp.end))}`;
    el.innerHTML = `<div class="tools"><button class="ib" data-a="pop-x" aria-label="Close">${ic('close')}</button></div>
        <div class="row"><span></span><input class="qin" id="q-title" placeholder="Add title" aria-label="Title"></div>
        <div class="row">${ic('clock')}<div class="sub">${esc(when)}<br><span style="font-size:12.5px">Time zone: Eastern · Does not repeat</span></div></div>
        <div class="row">${ic('video')}<div id="q-meet"><button class="meetbtn" data-a="q-meet">Add Google Meet video conferencing</button></div></div>
        <div class="row">${ic('place')}<input class="fin" id="q-loc" placeholder="Add location" aria-label="Location"></div>
        <div class="row">${ic('notes')}<textarea class="fin" id="q-desc" rows="2" placeholder="Add description" aria-label="Description"></textarea></div>
        <div class="row">${ic('cal')}${calSelect('q-cal', temp.cal || 'lsh')}</div>
        <div class="foot"><button class="txt" data-a="q-more">More options</button><button class="blue" data-a="q-save">Save</button></div>`;
    gc().appendChild(el); place(el, rect); G.pop = el;
    setTimeout(() => { const t = $('#q-title'); if (t) t.focus(); }, 20);
}
function quickDraft() {
    const t = G.temp;
    return { title: ($('#q-title') || {}).value || '', date: t.date, start: t.start, end: t.end, allDay: !!t.allDay, tz: ET, repeat: 'none', cal: ($('#q-cal') || {}).value || 'lsh', color: '',
        location: ($('#q-loc') || {}).value || '', meet: G.qmeet || '', desc: textToHtml(($('#q-desc') || {}).value || ''), guests: [], notifs: [{ m: 'popup', v: 30, u: 'minutes' }], busy: true, vis: 'default', perms: { modify: false, invite: true, see: true } };
}
function createEvent(draft) {
    snapshot();
    if (G.admin && draft.cal === 'attorney') {   // an Admin adding to the weekly schedule
        const r = { id: ('r-' + uid()).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40), wd: wd(draft.date), start: draft.allDay ? '00:00' : draft.start, end: draft.allDay ? '23:59' : draft.end,
            type: guessType(draft.title || ''), title: draft.title || '(No title)', location: draft.location || '', notes: plain(draft.desc).trim(), color: draft.color || '' };
        ROWS.push(r); putRows();
        return r;
    }
    const ev = Object.assign({ id: uid() }, draft); delete ev.iid;
    S.events.push(ev); save();
    return ev;
}
function openDetail(iid, rect) {
    closeAll();
    const e = findInst(iid); if (!e) return;
    const c = calOf(e.cal);
    const notif = (e.notifs || []).map(n => `${n.v} ${n.v === 1 ? n.u.replace(/s$/, '') : n.u} before${n.m === 'email' ? ', as email' : ''}`);
    const rep = e.seed ? `Weekly on ${DAYN[wd(e.origDate)]}` : e.repeat === 'weekly' ? `Weekly on ${DAYN[wd(e.date)]}` : e.repeat === 'daily' ? 'Daily' : e.repeat === 'weekdays' ? 'Every weekday (Monday to Friday)' : '';
    const el = document.createElement('div'); el.className = 'gc-pop'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', e.title || 'Event');
    el.innerHTML = `<div class="tools">${e.readOnly ? '' : `<button class="ib" data-a="d-edit" aria-label="Edit event" title="Edit event">${ic('edit')}</button><button class="ib" data-a="d-del" aria-label="Delete event" title="Delete event">${ic('del')}</button>`}
            <button class="ib" data-a="d-mail" aria-label="Email guests" title="Email guests">${ic('mail')}</button>${e.readOnly ? '' : `<button class="ib" data-a="d-more" aria-label="Options" title="Options">${ic('more')}</button>`}<button class="ib" data-a="pop-x" aria-label="Close">${ic('close')}</button></div>
        <div class="row"><span class="sq" style="background:${colorOf(e)}"></span><div><h2>${esc(e.title || '(No title)')}</h2><div class="sub">${esc(longDate(e.date))}${e.allDay ? '' : ' · ' + span(mins(e.start), mins(e.end))}${rep ? `<br>${esc(rep)}` : ''}</div></div></div>
        ${e.meet ? `<div class="row">${ic('video')}<div><button class="join" data-a="join">${ic('video')}Join with Google Meet</button><div class="link">meet.google.com/${esc(e.meet)}</div><div class="link">Join by phone: (US) +1 555-010-${String(digits(e.meet).length + 4000).slice(-4)} · PIN ${(e.meet.charCodeAt(0) * 7919 % 900000 + 100000)}#</div></div></div>` : ''}
        ${e.location ? `<div class="row">${ic('place')}<div class="sub">${esc(e.location)}</div></div>` : ''}
        ${(e.guests || []).length ? `<div class="row">${ic('people')}<div class="sub">${e.guests.length} guest${e.guests.length === 1 ? '' : 's'}<br>${e.guests.map(esc).join('<br>')}</div></div>` : ''}
        ${e.desc ? `<div class="row">${ic('notes')}<div class="desc">${sanitize(e.desc)}</div></div>` : ''}
        ${notif.length ? `<div class="row">${ic('bell')}<div class="sub">${notif.map(esc).join('<br>')}</div></div>` : ''}
        <div class="row">${ic('cal')}<div class="sub">${esc(c.name)}${e.seed ? `<br><span style="font-size:12.5px">${WW('The attorney’s standing appointment (every week)')}</span>` : ''}</div></div>
        ${(e.tz || ET) !== ET ? `<div class="row">${ic('clock')}<div class="sub">Time zone: ${esc((TZS.find(z => z[0] === e.tz) || [0, e.tz])[1])}</div></div>` : ''}
        <div style="height:12px"></div>`;
    gc().appendChild(el); place(el, rect); G.pop = el; G.popIid = iid;
}

/* ---------- the event page ---------- */
const TIMES = Array.from({ length: 96 }, (_, i) => hhmm(i * 15));
function openEditor(draft, inst) {
    closeAll(true);
    const d = Object.assign({}, draft);
    if (!d.allDay && (d.tz || ET) !== ET) { const a = shiftWall(d.date, d.start, ET, d.tz), b = shiftWall(d.date, d.end, ET, d.tz); d.date = a.date; d.start = a.time; d.end = b.time; }
    d.notifs = (d.notifs || []).map(n => Object.assign({}, n)); d.guests = (d.guests || []).slice(); d.perms = Object.assign({ modify: false, invite: true, see: true }, d.perms);
    G.ed = { d, inst, tab: 'details' };
    const el = document.createElement('div'); el.className = 'gc-ed'; el.id = 'gc-ed'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Event details');
    gc().appendChild(el);
    drawEditor();
    setTimeout(() => { const t = $('#ed-title'); if (t && !t.value) t.focus(); }, 30);
}
function edSync() {
    const E = G.ed; if (!E || !$('#gc-ed')) return;
    const d = E.d, v = (id) => { const n = $('#' + id); return n ? n.value : undefined; };
    if (v('ed-title') != null) d.title = v('ed-title');
    if (v('ed-date') != null) d.date = v('ed-date') || d.date;
    if (v('ed-start') != null) d.start = v('ed-start');
    if (v('ed-end') != null) d.end = v('ed-end');
    if ($('#ed-allday')) d.allDay = $('#ed-allday').checked;
    if (v('ed-tz') != null) d.tz = v('ed-tz');
    if (v('ed-rep') != null) d.repeat = v('ed-rep');
    if (v('ed-loc') != null) d.location = v('ed-loc');
    if (v('ed-cal') != null) d.cal = v('ed-cal');
    if (v('ed-color') != null) d.color = v('ed-color');
    if (v('ed-busy') != null) d.busy = v('ed-busy') === 'busy';
    if (v('ed-vis') != null) d.vis = v('ed-vis');
    if ($('#ed-desc')) d.desc = sanitize($('#ed-desc').innerHTML);
    document.querySelectorAll('[data-ntf]').forEach(row => { const i = +row.dataset.ntf; if (!d.notifs[i]) return; d.notifs[i] = { m: row.querySelector('.n-m').value, v: Math.max(0, Math.min(999, +row.querySelector('.n-v').value || 0)), u: row.querySelector('.n-u').value }; });
    ['modify', 'invite', 'see'].forEach(k => { const n = $('#perm-' + k); if (n) d.perms[k] = n.checked; });
}
function drawEditor() {
    const E = G.ed, d = E.d, el = $('#gc-ed');
    const timeOpts = (cur, from) => TIMES.filter(t => from == null || mins(t) > mins(from)).map(t => `<option value="${t}" ${t === cur ? 'selected' : ''}>${tl(mins(t))}${from != null ? ` (${(mins(t) - mins(from)) % 60 === 0 ? (mins(t) - mins(from)) / 60 + ' hr' + (mins(t) - mins(from) > 60 ? 's' : '') : (mins(t) - mins(from) < 60 ? (mins(t) - mins(from)) + ' mins' : ((mins(t) - mins(from)) / 60).toFixed(2).replace(/0$/, '') + ' hrs')})` : ''}</option>`).join('');
    const rep = [['none', 'Does not repeat'], ['daily', 'Daily'], ['weekly', `Weekly on ${DAYN[wd(d.date)]}`], ['weekdays', 'Every weekday (Monday to Friday)']];
    const isSeed = E.inst && E.inst.seed;
    const colorOpts = [['', 'Calendar color']].concat(Object.keys(GCAL_COLORS).map(k => [k, k[0].toUpperCase() + k.slice(1)]));
    el.innerHTML = `<div class="ed-top"><button class="ib" data-a="ed-x" aria-label="Close">${ic('close')}</button><input id="ed-title" placeholder="Add title" value="${esc(d.title)}" aria-label="Title"><button class="blue" data-a="ed-save">Save</button></div>
        <div class="ed-when"><input type="date" id="ed-date" value="${esc(d.date)}" aria-label="Date">
            ${d.allDay ? '' : `<select id="ed-start" aria-label="Start time">${timeOpts(d.start)}</select><span>to</span><select id="ed-end" aria-label="End time">${timeOpts(d.end, d.start)}</select>`}
            <label><input type="checkbox" id="ed-allday" ${d.allDay ? 'checked' : ''}> All day</label>
            <select id="ed-tz" aria-label="Time zone">${TZS.map(z => `<option value="${z[0]}" ${z[0] === (d.tz || ET) ? 'selected' : ''}>(${gmt(z[0], d.date)}) ${esc(z[1])}</option>`).join('')}</select>
            ${isSeed ? `<span style="color:#70757a;font-size:13px">${WW('Weekly (the attorney’s standing appointment)')}</span>` : `<select id="ed-rep" aria-label="Repeat">${rep.map(r => `<option value="${r[0]}" ${r[0] === (d.repeat || 'none') ? 'selected' : ''}>${esc(r[1])}</option>`).join('')}</select>`}</div>
        <div class="ed-cols"><div>
            <div class="ed-tabs"><button class="${E.tab === 'details' ? 'on' : ''}" data-a="ed-tab" data-t="details">Event details</button><button class="${E.tab === 'find' ? 'on' : ''}" data-a="ed-tab" data-t="find">Find a time</button></div>
            <div class="ed-body">${E.tab === 'find' ? findHtml(d) : `
                <div class="row">${ic('video')}<div>${d.meet ? `<div class="meetbox"><button class="join" data-a="join-ed">Join with Google Meet</button><span>meet.google.com/${esc(d.meet)}</span><button class="ib" data-a="ed-copy" aria-label="Copy the link" title="Copy">${ic('copy')}</button><button class="ib" data-a="ed-unmeet" aria-label="Remove conferencing" title="Remove conferencing">${ic('close')}</button></div>` : `<button class="meetbtn" data-a="ed-meet" style="background:#0b57d0;color:#fff;border-radius:4px;padding:9px 14px;font-weight:500">Add Google Meet video conferencing</button>`}</div></div>
                <div class="row">${ic('place')}<input class="fld" id="ed-loc" placeholder="Add location" value="${esc(d.location || '')}" aria-label="Location"></div>
                <div class="row">${ic('bell')}<div>${d.notifs.map((n, i) => `<div class="ntf" data-ntf="${i}"><select class="n-m" aria-label="Notification type"><option value="popup" ${n.m !== 'email' ? 'selected' : ''}>Notification</option><option value="email" ${n.m === 'email' ? 'selected' : ''}>Email</option></select>
                    <input class="n-v" type="number" min="0" max="999" value="${+n.v || 0}" aria-label="How long before"><select class="n-u" aria-label="Unit">${['minutes', 'hours', 'days', 'weeks'].map(u => `<option ${u === n.u ? 'selected' : ''}>${u}</option>`).join('')}</select>
                    <button class="ib" data-a="ed-unntf" data-i="${i}" aria-label="Remove notification">${ic('close')}</button></div>`).join('')}<button class="txt" data-a="ed-ntf">Add notification</button></div></div>
                <div class="row">${ic('cal')}<div class="two">${calSelect('ed-cal', d.cal).replace('class="fin"', '')}<select id="ed-color" aria-label="Event color">${colorOpts.map(c => `<option value="${c[0]}" ${c[0] === (d.color || '') ? 'selected' : ''}>${c[1]}</option>`).join('')}</select></div></div>
                <div class="row">${ic('lock')}<div class="two"><select id="ed-busy" aria-label="Show as"><option value="busy" ${d.busy !== false ? 'selected' : ''}>Busy</option><option value="free" ${d.busy === false ? 'selected' : ''}>Free</option></select><select id="ed-vis" aria-label="Visibility">${[['default', 'Default visibility'], ['public', 'Public'], ['private', 'Private']].map(v => `<option value="${v[0]}" ${v[0] === (d.vis || 'default') ? 'selected' : ''}>${v[1]}</option>`).join('')}</select></div></div>
                <div class="row">${ic('notes')}<div class="rte"><div class="bar"><button data-cmd="bold" aria-label="Bold"><b>B</b></button><button data-cmd="italic" aria-label="Italic"><i>I</i></button><button data-cmd="underline" aria-label="Underline"><u>U</u></button><button data-cmd="insertOrderedList" aria-label="Numbered list">1.</button><button data-cmd="insertUnorderedList" aria-label="Bulleted list">•</button><button data-cmd="createLink" aria-label="Link">🔗</button><button data-cmd="removeFormat" aria-label="Remove formatting">T̸</button></div>
                    <div class="area" id="ed-desc" contenteditable="true" data-ph="${esc(['Add description: name', 'callback number'].concat(CFG.fields.includes('dob') ? ['DOB'] : [], CFG.fields.includes('dol') ? ['DOL'] : []).join(', ') + ' and what it’s about')}" aria-label="Description">${sanitize(d.desc)}</div></div></div>`}
            </div></div>
            <div class="guests"><h4>Guests</h4><input class="fld" id="ed-guest" placeholder="Add guests (email), then Enter" aria-label="Add guests" style="width:100%;font:inherit;border:0;background:#f1f3f4;border-radius:4px;padding:9px 10px">
                ${d.guests.map((g, i) => `<div class="g"><span class="gav">${esc(g[0].toUpperCase())}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(g)}</span><button class="ib" data-a="ed-ungu" data-i="${i}" aria-label="Remove guest">${ic('close')}</button></div>`).join('')}
                <div class="perm"><b>Guest permissions</b><label><input type="checkbox" id="perm-modify" ${d.perms.modify ? 'checked' : ''}> Modify event</label><label><input type="checkbox" id="perm-invite" ${d.perms.invite ? 'checked' : ''}> Invite others</label><label><input type="checkbox" id="perm-see" ${d.perms.see ? 'checked' : ''}> See guest list</label></div></div></div>`;
}
function findHtml(d) {
    // the attorney's day, with this event in it: see where it fits
    const evs = instances(d.date, d.date, true).filter(e => e.cal === 'attorney' && !e.allDay && (!G.ed.inst || e.iid !== G.ed.inst.iid));
    const me = d.allDay ? null : Object.assign({ iid: 'me', title: d.title || '(No title)', cal: d.cal, color: d.color, _n: 1, _c: 0 }, d);
    let hours = '', lines = '';
    for (let h = 1; h < 24; h++) { hours += `<span style="position:absolute;top:${h * HH}px;right:6px;font-size:10px;color:#70757a;transform:translateY(-50%)">${hourLabel(h)}</span>`; lines += `<div class="ln" style="top:${h * HH}px"></div>`; }
    return `<p style="margin:0 0 8px;color:#444746;font-size:13px">${esc(longDate(d.date))} on the ${WW('Attorney’s Calendar')}${me ? ` · this event: ${span(mins(d.start), mins(d.end))}` : ''}</p>
        <div class="find" id="ed-find"><div style="position:relative;height:${24 * HH}px">${hours}</div><div class="wk-col" style="height:${24 * HH}px">${lines}${layoutDay(evs).map(e => evHtml(e)).join('')}${me ? evHtml(me, 'ghost') : ''}</div></div>`;
}
function saveEditor() {
    edSync();
    const E = G.ed, d = Object.assign({}, E.d);
    if (!d.allDay && mins(d.end) <= mins(d.start)) { snack('The end time must be after the start time.'); return; }
    if (!d.allDay && (d.tz || ET) !== ET) { const a = shiftWall(d.date, d.start, d.tz, ET), b = shiftWall(d.date, d.end, d.tz, ET); d.date = a.date; d.start = a.time; d.end = b.date > a.date ? '23:59' : b.time; }
    if (d.allDay) { d.start = ''; d.end = ''; }
    const fields = {}; FIELDS.forEach(k => { if (k in d) fields[k] = d[k]; });
    const done = () => { G.ed = null; const n = $('#gc-ed'); if (n) n.remove(); G.temp = null; render(); snack('Event saved', true); };
    if (E.inst) askScope(E.inst, 'edit', (scope) => { applyChange(E.inst, fields, scope); done(); });
    else { createEvent(fields); done(); }
}

/* ---------- dialogs, menus, snackbar, the mock Google Meet ---------- */
function dialog(title, body, ok, okLabel) {
    const el = document.createElement('div'); el.className = 'gc-dlg';
    el.innerHTML = `<div class="box" role="dialog" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${body}<div class="acts"><button class="txt" data-x>Cancel</button><button class="txt" data-ok>${esc(okLabel || 'OK')}</button></div></div>`;
    gc().appendChild(el);
    el.querySelector('[data-x]').onclick = () => el.remove();
    el.querySelector('[data-ok]').onclick = () => { el.remove(); ok(el); };
    el.onclick = (e) => { if (e.target === el) el.remove(); };
}
// 🎨 Color coding (a trainer's, for everyone): the calendars and the existing schedule's types of appointment, each a swatch of Google's event colors, or its default.
function colorDialog() {
    if (!Sim.isAdmin()) return;
    const pick = { cal: Object.assign({}, CC.cal), type: Object.assign({}, CC.type) };
    const sw = (grp, key, now, dflt) => `<span class="cc-sw" role="radiogroup" aria-label="Color of ${esc(key)}"><button type="button" class="cc-def ${now ? '' : 'on'}" data-cc="${grp}" data-k="${esc(key)}" data-v="" title="The default" aria-label="Default" aria-checked="${!now}" role="radio" style="background:${esc(dflt)}"></button>${Object.keys(GCAL_COLORS).map(c => `<button type="button" class="${now === c ? 'on' : ''}" data-cc="${grp}" data-k="${esc(key)}" data-v="${c}" title="${c}" aria-label="${c}" aria-checked="${now === c}" role="radio" style="background:${GCAL_COLORS[c]}"></button>`).join('')}</span>`;
    const body = () => `<div class="cc"><h4>Calendars</h4>${GCAL_CALENDARS.map(c => `<div class="cc-row"><span>${esc(c.name)}</span>${sw('cal', c.id, pick.cal[c.id] || '', c.color)}</div>`).join('')}
        <h4>The existing schedule, by type</h4>${SCHEDULE_TYPES.map(ty => { const n = ROWS.filter(r => r.type === ty).length; return `<div class="cc-row"><span>${esc(ty)} <em>${n} in the week</em></span>${sw('type', ty, pick.type[ty] || '', '#9aa0a6')}</div>`; }).join('')}
        <p class="cc-note">Applies to everyone on this simulator. An appointment you colored yourself keeps its own color; a person’s own events keep theirs. The first swatch is the default.</p>
        <button type="button" class="txt" data-cc-clear style="padding:0 6px;height:28px">Clear all colors</button></div>`;
    dialog('Color coding', body(), async () => {
        try {
            const res = await Sim.fetchRetry(API_SCHEDULE, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ colors: pick }) });
            const d = await res.json().catch(() => ({}));
            if (!res.ok || !d.success) { snack(d.error || 'The colors weren’t saved. Try again.'); return; }
            setCC(d.colors); closeAll(); render(); snack('Color coding saved for everyone');
        } catch (e) { snack('The colors weren’t saved (no connection).'); }
    }, 'Save');
    const el = gc().lastElementChild, box = () => el.querySelector('.cc');
    el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-cc]'), clr = ev.target.closest('[data-cc-clear]');
        if (b) { if (b.dataset.v) pick[b.dataset.cc][b.dataset.k] = b.dataset.v; else delete pick[b.dataset.cc][b.dataset.k]; }
        else if (clr) { pick.cal = {}; pick.type = {}; } else return;
        box().outerHTML = body();
    });
}
function snack(text, canUndo) {
    document.querySelectorAll('.gc-snack').forEach(n => n.remove());
    const el = document.createElement('div'); el.className = 'gc-snack'; el.setAttribute('role', 'status');
    el.innerHTML = `<span>${esc(text)}</span>${canUndo && G.undo ? '<button data-a="undo">Undo</button>' : ''}<button data-a="snack-x" aria-label="Dismiss">✕</button>`;
    gc().appendChild(el);
    clearTimeout(G.snackT); G.snackT = setTimeout(() => el.remove(), 6000);
}
function menu(anchor, items) {
    closeAll(true);
    const el = document.createElement('div'); el.className = 'gc-menu'; el.setAttribute('role', 'menu');
    el.innerHTML = items;
    gc().appendChild(el);
    const box = gc().getBoundingClientRect(), r = anchor.getBoundingClientRect();
    el.style.top = (r.bottom - box.top + 4) + 'px';
    el.style.left = Math.max(8, Math.min(r.right - box.left - el.offsetWidth, box.width - el.offsetWidth - 8)) + 'px';
    G.menu = el;
}
function openMeet(e) {
    closeAll(true);
    const me = Sim.who().name || 'You', init = (s) => String(s || '?').trim()[0].toUpperCase();
    const R = GCAL_REQUESTS.find(r => hasName(e.title || '', r.name));
    const el = document.createElement('div'); el.className = 'meet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Google Meet');
    G.meet = { e, stage: 'lobby', mic: true, cam: false, t0: 0 };
    const draw = () => {
        const M = G.meet; if (!M) return;
        const tile = (name, color, sm) => `<div class="tile ${sm ? 'sm' : ''}"><div class="big" style="background:${color}">${esc(init(name))}</div><div class="nm">${esc(name)}</div></div>`;
        const t = M.t0 ? Math.floor((Date.now() - M.t0) / 1000) : 0;
        el.innerHTML = `<div class="mtop"><span>${esc(e.title || 'Meeting')}</span><button class="mb" data-m="x" aria-label="Close" style="width:40px;height:40px">${ic('close')}</button></div>
            <div class="mmain">${M.stage === 'lobby' ? `${tile(me, '#5f6368')}<div class="ready"><h3>Ready to join?</h3><p>${R ? esc(R.name) + ' is waiting' : 'No one else is here'}</p><button class="jn" data-m="join">Join now</button></div>`
                : M.stage === 'in' ? `${tile(me + ' (You)', '#5f6368', true)}${tile(WW('Attorney'), '#1a73e8', true)}${R ? tile(R.name, '#7cb342', true) : ''}`
                : `<div class="ready"><h3>You left the meeting</h3><p>meet.google.com/${esc(e.meet)}</p><button class="jn" data-m="join">Rejoin</button> <button class="jn" data-m="x" style="background:none;color:#8ab4f8;border:1px solid #5f6368">Return to the calendar</button></div>`}</div>
            ${M.stage !== 'left' ? `<div class="mbar"><button class="mb ${M.mic ? '' : 'off'}" data-m="mic" aria-label="${M.mic ? 'Turn off microphone' : 'Turn on microphone'}">${ic('mic')}</button><button class="mb ${M.cam ? '' : 'off'}" data-m="cam" aria-label="${M.cam ? 'Turn off camera' : 'Turn on camera'}">${ic('video')}</button>
                ${M.stage === 'in' ? `<button class="mb" aria-label="Captions">${ic('cc')}</button><button class="mb" aria-label="Raise hand">${ic('hand')}</button><button class="mb" aria-label="Present now">${ic('present')}</button><button class="mb end" data-m="leave" aria-label="Leave call">${ic('end')}</button>` : ''}</div>` : ''}
            ${M.stage === 'in' ? `<div class="clock">${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} | ${esc(e.meet)}</div>` : ''}`;
    };
    el.onclick = (ev) => {
        const b = ev.target.closest('[data-m]'); if (!b) return; const M = G.meet;
        if (b.dataset.m === 'x') { clearInterval(M.tick); el.remove(); G.meet = null; return; }
        if (b.dataset.m === 'join') { M.stage = 'in'; M.t0 = Date.now(); clearInterval(M.tick); M.tick = setInterval(draw, 1000); }
        if (b.dataset.m === 'leave') { M.stage = 'left'; clearInterval(M.tick); }
        if (b.dataset.m === 'mic') M.mic = !M.mic;
        if (b.dataset.m === 'cam') M.cam = !M.cam;
        draw();
    };
    gc().appendChild(el); draw();
}
function shortcuts() {
    const rows = [['c', 'Create event'], ['t', 'Today'], ['j / n', 'Next period'], ['k / p', 'Previous period'], ['d', 'Day view'], ['w', 'Week view'], ['m', 'Month view'], ['a', 'Schedule view'], ['/', 'Search'], ['e', 'Edit the open event'], ['Delete', 'Delete the open event'], ['Esc', 'Close'], ['?', 'These shortcuts']];
    dialog('Keyboard shortcuts', `<table style="width:100%;font-size:14px">${rows.map(r => `<tr><td style="padding:4px 0"><kbd style="background:#f1f3f4;border-radius:4px;padding:2px 8px">${esc(r[0])}</kbd></td><td>${esc(r[1])}</td></tr>`).join('')}</table>`, () => {}, 'Close');
}
function settings(anchor) {
    menu(anchor, `<div style="padding:8px 16px;font-size:14px;width:260px">
        <label style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0">Default event length <select data-set="dur">${[15, 30, 45, 60].map(n => `<option value="${n}" ${S.set.dur === n ? 'selected' : ''}>${n} min</option>`).join('')}</select></label>
        <label style="display:flex;gap:8px;align-items:center;padding:6px 0"><input type="checkbox" data-set="weekends" ${S.set.weekends ? 'checked' : ''}> Show weekends</label>
        <label style="display:flex;gap:8px;align-items:center;padding:6px 0"><input type="checkbox" data-set="tz2" ${S.set.tz2 ? 'checked' : ''}> Show Manila time too</label>
        <button class="txt" data-a="reset" style="margin-top:6px;padding:0">Start over (clear my calendar)</button>
        ${Sim.isAdmin() ? `<button class="txt" data-a="admin-edit" style="margin-top:2px;padding:0">${G.admin ? 'Stop editing the weekly schedule' : '✎ Edit the weekly schedule (everyone)'}</button>
        <button class="txt" data-a="cc-open" style="margin-top:2px;padding:0">🎨 Color coding (everyone)</button>
        <a class="txt" href="${REVIEW_PAGE}" style="display:block;margin-top:2px;padding:0;line-height:36px;text-decoration:none">🖥 Trainee evaluations (live review)</a>` : ''}</div>`);
}

/* ---------- moving around ---------- */
function step(dir) {
    if (S.view === 'day') S.anchor = addDays(S.anchor, dir);
    else if (S.view === 'month' || S.view === 'agenda') { const d = D(S.anchor.slice(0, 7) + '-01'); d.setUTCMonth(d.getUTCMonth() + dir); S.anchor = iso(d); }
    else S.anchor = addDays(S.anchor, dir * (viewDays().length < 5 ? 3 : 7));
    S.mini = S.anchor.slice(0, 7); save(); closeAll(); render();
}
function setView(v) { S.view = v; G.q = ''; G.searching = false; save(); closeAll(); render(); }
function goDay(d) { S.anchor = d; S.view = 'day'; S.mini = d.slice(0, 7); G.q = ''; save(); closeAll(); render(); }
function createAt(date, start) {
    if (RV) return;
    const st = start != null ? start : Math.max(9 * 60, Math.min(mins(etNow().time) + 30 - (mins(etNow().time) % 30), 16 * 60));
    openEditor({ title: '', date: date || S.anchor, start: hhmm(st), end: hhmm(Math.min(st + S.set.dur, 1439)), allDay: false, tz: ET, repeat: 'none', cal: G.admin ? 'attorney' : 'lsh', color: '', location: '', meet: '', desc: '', guests: [], notifs: [{ m: 'popup', v: 30, u: 'minutes' }], busy: true, vis: 'default' }, null);
}
function doCheck() {
    if (RV) return;
    const r = checkNow();
    S.result = Object.assign(r, { at: new Date().toISOString() }); save(); closeAll(); render();
    setTimeout(toScores, 60);
    Sim.saveResult({ simulator: 'Google Calendar', scenario: OPEN ? `${CFG.scenario} · ${r.results.length} appointments` : `${CFG.scenario} · ${S.reqs.length} requests`, score: r.score,
        summary: `${r.right}/${r.results.length} ${OPEN ? 'appointments' : 'requests'} fully right${r.penalty ? `; −${r.penalty} for unasked changes` : ''}`,
        details: { results: r.results.map(x => ({ request: x.head, points: Math.round(x.pts * 10) / 10, max: x.max, missed: x.items.filter(i => !i.ok).map(i => i.t) })), extra: r.extra } });
}

// The automated check of the trainee's calendar: at the bottom of the requests panel, under the request cards.
function checkSection(r, rm) {
    const col = r.score >= 85 ? '#188038' : r.score >= 70 ? '#e37400' : '#d93025';
    return `<div id="gc-check" style="margin-top:14px;padding-top:12px;border-top:1px solid #dadce0"><h3 style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5f6368;font-weight:500">Your calendar, checked</h3>
        <div class="res-top"><div class="res-ring" style="border-color:${col};color:${col}">${r.score}%</div>
            <div class="lead" style="margin:0">${r.right} of ${r.results.length} ${r.open ? `appointment${r.results.length === 1 ? '' : 's'}` : 'requests'} fully right.${r.penalty ? ` −${r.penalty} for changing appointments no one asked about.` : ''}<br><span style="color:#70757a">Checked ${esc(Sim.fmtDate(r.at))}</span></div></div>
        ${r.open && !r.results.length ? '<p class="lead">There are no appointments on the calendar to check yet.</p>' : ''}
        ${resRows(r, rm)}</div>`;
}
const slimResult = (r) => ({ score: r.score, right: r.right, penalty: r.penalty || 0, extra: r.extra || [], at: r.at,
    results: r.results.map(x => ({ head: x.head, when: x.when || '', pts: Math.round(x.pts * 10) / 10, max: x.max, items: x.items.map(i => ({ ok: !!i.ok, t: i.t })) })) });
const resRows = (r, rm) => r.results.map(x => `<div class="res-r"><h5><span>${esc(x.head)}</span><span>${Math.round(x.pts * 10) / 10}/${x.max}${rm && x.id ? ` <button class="txt" data-a="tv-skip" data-id="${esc(x.id)}" title="Take this appointment out of this review and its score">✕ Remove</button>` : ''}</span></h5>${x.when ? `<div style="color:#70757a;margin-bottom:4px">${esc(x.when)}</div>` : ''}<ul>${x.items.map(i => `<li class="${i.ok ? 'ok' : 'no'}"><span>${esc(i.t)}</span></li>`).join('')}</ul></div>`).join('')
    + (r.extra && r.extra.length ? `<div class="res-r"><h5><span>Changed without a request</span><span>−${r.penalty}</span></h5><ul>${r.extra.map(t => `<li class="no"><span>${esc(t)}</span></li>`).join('')}</ul></div>` : '');
async function recFetch(user) {
    const r = await Sim.fetchRetry('/api/calsim' + (user ? '?user=' + encodeURIComponent(user) : ''), { credentials: 'include' }), j = await r.json().catch(() => ({}));
    if (!r.ok || !j.success) throw new Error(j.error || 'Sign in on the Portal first.');
    return j;
}
async function recPost(body) {
    const r = await Sim.fetchRetry('/api/calsim', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw new Error(j.error || 'Couldn’t save. Check your connection.');
    return j;
}
const blankRec = () => ({ v: 2, drafts: {}, autos: [], submissions: [], reviews: {}, external: [] });
function mySubBox() {
    const subs = MINE.data && Array.isArray(MINE.data.gsubs) ? MINE.data.gsubs.filter(x => x.track === GT) : [], last = subs[subs.length - 1];
    if (!last) return '';
    const rv = (MINE.data.reviews || {})[SUBKEY(last.at)];
    const per = rv && rv.tasks ? last.result.results.map((x, i) => rv.tasks['r' + i] ? `<li><b>${esc(x.head)}:</b> ${esc(rv.tasks['r' + i])}</li>` : '').join('') : '';
    return `<div class="rq"><div class="nm">📤 Submitted ${esc(new Date(last.at).toLocaleString())} · 🤖 ${last.result.score}%</div>${rv ? `<div class="av2"><b>👤 Your trainer: ${esc(rv.score)}/100</b>${rv.comment ? '<br>' + esc(rv.comment) : ''}${per ? '<ul>' + per + '</ul>' : ''}</div>` : '<div class="av2">Waiting for your trainer’s feedback.</div>'}</div>`;
}
// A review of a submission (?review=): the automated check and the trainer's feedback form, below the calendar.
function reviewScoresHTML() {
    const r = RV.sub.result, rv = RV.review || {}, col = r.score >= 85 ? '#188038' : r.score >= 70 ? '#e37400' : '#d93025';
    return `<h2>📊 Review · ${esc(CFG.label)}</h2><p class="lead" style="margin:0 0 12px"><b>${esc(RV.name)}</b>${RV.batch ? ' · ' + esc(RV.batch) : ''} · Submitted ${esc(new Date(RV.sub.at).toLocaleString())}. The calendar is above, read only.</p>
        <div class="sc-grid"><div><div class="res-top"><div class="res-ring" style="border-color:${col};color:${col}">${r.score}%</div><div class="lead" style="margin:0">Automated check: ${r.right} of ${r.results.length} requests fully right.${r.penalty ? ` −${r.penalty} for changing appointments no one asked about.` : ''}</div></div>
        ${resRows(r)}</div>
        <div><div class="res-r"><h5><span>👤 Your feedback</span><span>${rv.score != null ? 'given' : 'to review'}</span></h5>
            <p style="margin:0 0 6px"><label>Score (0–100)<br><input type="number" min="0" max="100" id="rv-score" value="${rv.score != null ? esc(rv.score) : ''}" style="width:90px;font:inherit;padding:6px 8px;border:1px solid #dadce0;border-radius:6px"></label></p>
            <p style="margin:0 0 6px"><label>Overall comment to the trainee<br><textarea id="rv-comment" rows="3" style="width:100%;box-sizing:border-box;font:inherit;padding:6px 8px;border:1px solid #dadce0;border-radius:6px">${esc(rv.comment || '')}</textarea></label></p>
            ${r.results.map((x, i) => `<p style="margin:0 0 6px"><label>${esc(x.head)}<br><input id="rv-t${i}" maxlength="400" value="${esc((rv.tasks || {})['r' + i] || '')}" placeholder="Comment on this request (optional)" style="width:100%;box-sizing:border-box;font:inherit;padding:6px 8px;border:1px solid #dadce0;border-radius:6px"></label></p>`).join('')}
            <button class="blue" data-a="rv-save">${rv.score != null ? 'Update feedback' : 'Save feedback'}</button></div></div></div>`;
}
async function saveReview() {
    const sc = Number(($('#rv-score') || {}).value), raw = ($('#rv-score') || {}).value;
    if (raw === '' || !isFinite(sc) || sc < 0 || sc > 100) { snack('Enter a score from 0 to 100.'); return; }
    const tasks = {}; RV.sub.result.results.forEach((x, i) => { const t = String(($('#rv-t' + i) || {}).value || '').trim().slice(0, 400); if (t) tasks['r' + i] = t; });
    const comment = String(($('#rv-comment') || {}).value || '').trim().slice(0, 2000);
    try {
        const out = await recPost({ review: { user: RV.user, key: SUBKEY(RV.at), score: sc, comment, tasks } });
        RV.review = ((out.data || {}).reviews || {})[SUBKEY(RV.at)] || { score: Math.round(sc), comment, tasks };
        snack('Feedback saved.'); renderPanel();
    } catch (e) { snack(e.message); }
}
async function reviewStart() {
    S = fresh(); render();
    try {
        const j = await recFetch(RV.user); if (!j.me.admin) throw new Error('Reviewing is for trainers.');
        const subs = (j.data && Array.isArray(j.data.gsubs) ? j.data.gsubs : []).filter(x => x.track === GT && x.at === RV.at);
        if (!subs.length) throw new Error('That submission was not found.');
        const sub = subs[0], snap = sub.snap || {};
        RV.sub = sub; RV.review = ((j.data.reviews || {})[SUBKEY(sub.at)]) || null;
        RV.name = (j.person && j.person.name) || RV.user; RV.batch = (j.person && j.person.batch) || '';
        if (Array.isArray(snap.rows) && snap.rows.length) ROWS = snap.rows;
        S = Object.assign(fresh(), { events: snap.events || [], ex: snap.ex || {}, sx: snap.sx || {}, reqs: snap.reqs || [], today: snap.today || S.today, result: sub.result, panel: 'result', side: false });
        S.anchor = S.today; S.mini = S.today.slice(0, 7);
        render();
    } catch (e) { $('#app').innerHTML = `<div class="sim-card" style="margin:20px"><p>${esc(e.message)}</p></div>`; }
}
/* ---------- 👁 a trainee's calendar, for their trainer (?trainee=<username>) ----------
   Their calendar as they last saved it to their account (gcal_drafts), read only; the automated check run on it now; and the
   trainer's CALENDAR MANAGEMENT MOCK CALL scorecard (each metric 0-5 with feedback, the weighted average), saved in the trainee's
   /api/calsim record. The trainee sees the scorecard in their requests panel and on the Calendaring Simulators page. */
async function liveStart(again) {
    if (!again) { S = fresh(); S.panel = 'result'; render(); }
    try {
        const [dr, j] = await Promise.all([
            Sim.fetchRetry(EV_API + '?draft=' + encodeURIComponent(GCAL_TRACK || 'standard') + '&user=' + encodeURIComponent(RV.user), { credentials: 'include' }).then(r => r.json()),
            recFetch(RV.user)]);
        if (!j.me || !j.me.admin) throw new Error('Viewing a trainee’s calendar is for trainers.');
        if (!dr || !dr.success) throw new Error((dr && dr.error) || 'Their calendar couldn’t be loaded.');
        RV.name = (dr.person && dr.person.name) || (j.person && j.person.name) || RV.user; RV.batch = (dr.person && dr.person.batch) || (j.person && j.person.batch) || '';
        RV.cards = ((j.data && j.data.scorecards) || {})[GT] || [];
        RV.skip = new Set(((j.data && j.data.excluded) || {})[GT] || []);
        RV.savedAt = dr.updatedAt || null;
        try {   // the weekly schedule as an Admin set it, before the check
            const sch = await (await Sim.fetchRetry(API_SCHEDULE, { credentials: 'include' })).json();
            if (sch && sch.success && sch.colors) setCC(sch.colors);
            if (sch && sch.success && Array.isArray(sch.rows) && sch.rows.length && sch.rows.every(r => r && r.id && r.title && /^\d\d:\d\d$/.test(r.start))) ROWS = sch.rows;
        } catch (e) { /* the schedule as it came */ }
        const c = dr.data, keep = S ? { view: S.view, anchor: S.anchor, mini: S.mini } : {};
        RV.empty = !(c && c.v === 1 && Array.isArray(c.events));
        S = Object.assign(fresh(), RV.empty ? {} : c, { panel: 'result', side: false }, again ? keep : {});
        if (OPEN) S.reqs = []; else if (!Array.isArray(S.reqs)) S.reqs = [];
        S.result = Object.assign(checkNow(), { at: new Date().toISOString() });
        if (!again) { S.anchor = S.today; S.mini = S.today.slice(0, 7); }
        closeAll(); render();
        if (again) snack('Their calendar is up to date');
    } catch (e) { $('#app').innerHTML = `<div class="sim-card" style="margin:20px"><p>${esc(e.message)}</p></div>`; }
}
// A trainer's view of a trainee's calendar (?trainee=): their scorecard to fill in and the automated check, below the calendar.
function liveScoresHTML() {
    const C = window.CalScorecard, last = RV.cards[RV.cards.length - 1], when = (t) => t ? new Date(t.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? '' : 'Z')).toLocaleString() : '';
    return `<h2>📊 Scores · ${esc(RV.name)}${RV.batch ? ' · ' + esc(RV.batch) : ''} · ${esc(CFG.label)}</h2>
        <p class="lead" style="margin:0 0 12px">${RV.empty ? 'Nothing saved to their account on this simulator yet.' : `Their calendar as they last saved it${RV.savedAt ? ', ' + esc(when(RV.savedAt)) : ''}. It’s above, read only.`}
            <button class="txt" data-a="tv-refresh">🔄 Refresh</button></p>
        <div class="sc-grid wide"><div class="res-r" id="tv-card"><h5><span>📋 Your scorecard</span><span>${last ? `${esc(last.average)}/5 · ${esc(last.pct)}%` : 'to score'}</span></h5>
            ${last ? `<p style="margin:0 0 6px;color:#70757a">Last saved ${esc(when(last.at))}${last.by ? ' by ' + esc(last.by) : ''}${RV.cards.length > 1 ? ` · ${RV.cards.length} scorecards` : ''}. Saving again keeps the earlier ones.</p>` : '<p style="margin:0 0 6px;color:#70757a">Score each metric 0 to 5 and add your feedback; the weighted average works itself out.</p>'}
            ${C ? C.formHTML(last) : '<p>The scorecard didn’t load. Refresh the page.</p>'}
            <div style="margin-top:8px"><button class="blue" data-a="tv-save">💾 Save scorecard</button></div>
            ${RV.cards.length > 1 ? `<div style="margin-top:10px"><b>Earlier scorecards</b><ul>${RV.cards.slice(0, -1).reverse().map(x => `<li><span>${esc(when(x.at))} · ${esc(x.by || '')} · ${esc(x.average)}/5 (${esc(x.pct)}%)</span></li>`).join('')}</ul></div>` : ''}</div>
        <div>${S.result ? liveCheckHTML() : ''}</div></div>`;
}
// The trainer's view of the automated check: without the appointments they took out of the review (a sample or test appointment that isn't a caller's
// request), the score worked out again from the rest; each removed one can be put back. Kept in the trainee's record (excluded[track]), never changed by their saves.
function liveCheckHTML() {
    const r0 = S.result, skip = RV.skip || new Set(), kept = r0.results.filter(x => !skip.has(x.id)), gone = r0.results.filter(x => skip.has(x.id));
    const got = kept.reduce((a, x) => a + x.pts, 0), max = kept.reduce((a, x) => a + x.max, 0);
    const r = Object.assign({}, r0, { results: kept, right: kept.filter(x => x.pts >= x.max - 0.01).length,
        score: r0.open ? (max ? Math.min(100, Math.round(got / max * 100)) : 0) : Math.max(0, Math.min(100, Math.round((max ? got / max * 100 : 100) - (r0.penalty || 0)))) });
    return checkSection(r, true).replace('Your calendar, checked', 'Their calendar, checked (automated)')
        + (gone.length ? `<div class="res-r" id="tv-removed"><h5><span>Removed from this review (${gone.length})</span><span></span></h5><ul>${gone.map(x => `<li><span>${esc(x.head)}</span> <button class="txt" data-a="tv-unskip" data-id="${esc(x.id)}">↩ Put back</button></li>`).join('')}</ul></div>` : '');
}
async function skipItem(id, on) {
    const was = new Set(RV.skip || []), next = new Set(was); if (on) next.add(id); else next.delete(id);
    RV.skip = next; renderScores();
    try { await recPost({ exclude: { user: RV.user, track: GT, ids: [...next] } }); snack(on ? 'Removed from this review. It stays removed until you put it back.' : 'Put back in the review.', true); }
    catch (e) { RV.skip = was; renderScores(); snack(e.message); }
}
// 📊 The scores, in a section of their own (not in the side panel; a trainee's at the bottom of the blue card on a wide
// screen, placeScores): the automated check (Check my calendar), the trainer's scorecard and what was submitted with its
// feedback. A trainer looking at a trainee's calendar (?trainee=) gets the scorecard to fill in there, and a review
// (?review=) the feedback form, both below the calendar.
function renderScores() {
    const box = $('#gc-scores'); if (!box || !S) return;
    if (RV && RV.sub) { box.innerHTML = reviewScoresHTML(); return; }
    if (RV && RV.live) { box.innerHTML = liveScoresHTML(); return; }
    if (RV) { box.innerHTML = ''; return; }   // (a review still loading)
    const side = myScorecardBox() + mySubBox();
    const btn = `<div style="margin:2px 0 10px"><button class="blue" data-a="check">Check my calendar</button></div>`;
    const check = S.result ? checkSection(S.result)
        : `<div id="gc-check"><h3 class="sc-h">Your calendar, checked</h3><p class="lead">Click <b>Check my calendar</b> to check ${OPEN ? 'your appointments' : 'what the callers asked for'} against the ${WW('attorney’s')} rules. Your score shows here.</p></div>`;
    box.innerHTML = `<h2>📊 Your scores</h2>${btn}<div class="sc-grid${side ? '' : ' one'}"><div>${check}</div>${side ? `<div>${side}</div>` : ''}</div>`;
}
async function saveScorecard() {
    const C = window.CalScorecard; if (!C) return;
    const got = C.read();
    if (got.error) { snack(got.error); return; }
    try {
        const out = await recPost({ scorecard: { user: RV.user, track: GT, rows: got.rows, calendarAt: RV.savedAt || '' } });
        RV.cards = out.scorecards || RV.cards.concat([out.scorecard]);
        snack('Scorecard saved: ' + out.scorecard.average + '/5 (' + out.scorecard.pct + '%)'); renderScores();
    } catch (e) { snack(e.message); }
}
// A trainee's own: their trainer's latest scorecard on this simulator.
function myScorecardBox() {
    const list = MINE.data && MINE.data.scorecards && Array.isArray(MINE.data.scorecards[GT]) ? MINE.data.scorecards[GT] : [], last = list[list.length - 1];
    if (!last || !window.CalScorecard) return '';
    return `<div class="rq" id="my-scorecard">${window.CalScorecard.sheetHTML(last, `👤 Your trainer’s scorecard · ${esc(last.average)}/5 (${esc(last.pct)}%)${last.by ? ' · ' + esc(last.by) : ''} · ${esc(new Date(last.at).toLocaleDateString())}`)}</div>`;
}
async function mineStart() {   // a signed-in trainee's submissions and the trainer's feedback (a guest has none)
    try { const j = await recFetch(); MINE.me = j.me; MINE.data = Object.assign(blankRec(), j.data || {}); if (S) renderPanel(); } catch (e) { /* not signed in on the Portal */ }
}

/* ---------- 📤 Submit for evaluation (functions/api/gcal-reviews.js) ----------
   The appointments, the requests, the attorney's rules and the automated check go to the trainer. The AI review is written on the
   server straight away; the trainer goes through it live (simulators/gcal-review.html), adds their own feedback and finalizes it.
   The trainee then sees the final report under My evaluations and can download it as a PDF. */
const EV = { list: [], open: null, ready: 0, timer: null, busy: false };
const EV_API = '/api/gcal-reviews';
const REVIEW_PAGE = '/simulators/gcal-review.html' + (TRK ? '?track=' + TRK : '');   // the trainer's live review
function evalPayload() {
    const r = checkNow();
    const all = instancesOf(S, addDays(S.today, -7), addDays(S.today, 42));
    const appointments = all.filter(e => !e.seed && e.cal !== 'holidays').map(e => ({ title: e.title, calendar: calOf(e.cal).name, date: e.date, day: DAYN[wd(e.date)],
        time: e.allDay ? 'all day' : span(mins(e.start), mins(e.end)), timeZone: (TZS.find(z => z[0] === (e.tz || ET)) || [0, e.tz])[1], location: e.location || '',
        googleMeet: !!e.meet, description: plain(e.desc).slice(0, 1500), guests: (e.guests || []).map(g => g.email || g).slice(0, 10),
        notifications: (e.notifs || []).map(n => `${n.m} ${n.v} ${n.u} before`) }));
    // The calendar itself, as the trainee left it, for the trainer's view: three weeks from this week's Monday,
    // the attorney's appointments (with this trainee's moves and cancellations) and the trainee's own events.
    const from = weekStart(S.today, true), to = addDays(from, 20);
    const week = { from, to, today: S.today, events: instancesOf(S, from, to).filter(e => e.cal !== 'holidays' && wd(e.date) >= 1 && wd(e.date) <= 5).slice(0, 220)
        .map(e => ({ t: String(e.title || '(No title)').slice(0, 90), d: e.date, s: e.allDay ? '' : e.start, e: e.allDay ? '' : e.end, c: colorOf(e), mine: !e.seed, cal: calOf(e.cal).name, meet: !!e.meet })) };
    return { track: GCAL_TRACK || 'standard', calendar: { week,
        program: CFG.label || 'Standard Training', today: longDate(S.today) + ' (Eastern)', score: r.score,
        rules: { collectFromEveryCaller: GCAL_RULES.collect.map(WW), title: WW(GCAL_RULES.title), scheduling: GCAL_RULES.scheduling.map(WW), notes: GCAL_RULES.notes.map(WW), office: GCAL_OFFICE },
        requests: S.reqs.map(q => { const R = reqDef(q.id) || {}; return { kind: R.kind, caller: R.name, type: R.type, callerSaid: R.said, canDo: R.kind === 'cancel' ? '' : availText(q, R) }; }),
        appointments,
        bookedFrom: OPEN ? 'the trainee\'s Calendar Management mock calls (no written requests): judge each appointment against the rules, and what the caller asked as far as the description shows it' : 'the calendar requests below',
        automatedCheck: { score: r.score, requestsFullyRight: `${r.right} of ${r.results.length}`, changedWithoutARequest: r.extra, attorneyAppointmentsChanged: r.changed || [],
            results: r.results.map(x => ({ request: x.head, points: `${Math.round(x.pts * 10) / 10}/${x.max}`, when: x.when || '', met: x.items.filter(i => i.ok).map(i => i.t), missed: x.items.filter(i => !i.ok).map(i => i.t) })) } } };
}
// The server keeps a submitted calendar up to 200000 characters; a Standard Training week with many appointments can pass that, so the parts that are
// only for the trainer's picture and the long texts are trimmed in steps (the automated check and the appointments' fields the AI judges stay).
function trimPayload(p) {
    const size = () => JSON.stringify(p).length, cal = p.calendar, LIMIT = 150000;
    if (size() <= LIMIT) return p;
    if (cal.week && cal.week.events) cal.week.events = cal.week.events.slice(0, 120);
    if (size() > LIMIT) cal.appointments.forEach(a => { a.description = String(a.description || '').slice(0, 500); a.guests = (a.guests || []).slice(0, 5); });
    if (size() > LIMIT && cal.week) cal.week.events = cal.week.events.slice(0, 40);
    if (size() > LIMIT) cal.appointments.forEach(a => { a.description = String(a.description || '').slice(0, 150); });
    if (size() > LIMIT) cal.appointments = cal.appointments.slice(0, 150);
    return p;
}
async function submitEval() {
    if (Sim.isAdmin()) { snack('Trainers review submissions in Trainee evaluations (in Settings).'); return; }
    if (EV.busy) return;
    const p = trimPayload(evalPayload());
    if (!p.calendar.appointments.length && !p.calendar.automatedCheck.results.some(x => x.met.length) && !(p.calendar.automatedCheck.attorneyAppointmentsChanged || []).length) { snack('Book the appointments first, then submit them.'); return; }
    dialog('Submit for evaluation?', `<p style="margin:0;color:#444746">${OPEN ? `Your ${p.calendar.appointments.length} appointment${p.calendar.appointments.length === 1 ? '' : 's'}` : `Your appointments for these ${S.reqs.length} requests`} go to your trainer. An AI review is written for them, your trainer goes through it with you and adds their own feedback, and then the final report shows under <b>My evaluations</b>.</p>`, async () => {
        EV.busy = true;
        save(true); cloudSave();
        try {
            const res = await Sim.fetchRetry(EV_API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action: 'submit' }, p)) });
            const d = await res.json().catch(() => ({}));
            if (res.status === 401) { snack('Sign in to the LSH Training Portal to submit.'); return; }
            if (!res.ok || !d.success) { snack(d.error || 'Could not submit. Try again.'); return; }
            S.panel = 'evals'; EV.open = null; save(); renderPanel(); renderRail(); snack('Submitted to your trainer'); loadEvals();
        } catch (e) { snack('Could not submit: check your connection.'); }
        finally { EV.busy = false; }
    }, 'Submit');
}
async function loadEvals() {
    clearTimeout(EV.timer);
    try {
        const res = await Sim.fetchRetry(EV_API, { credentials: 'include' }); const d = await res.json().catch(() => ({}));
        if (d.success) { EV.list = d.reviews || []; EV.ready = EV.list.filter(r => r.status === 'final' && !seenFinal(r.id)).length; }
    } catch (e) { /* offline: try again on the next look */ }
    if (S && S.panel === 'evals') renderPanel();
    renderRail();
    // While a submission is still with the trainer and the panel is open, look again every 20 seconds (not in a background tab).
    if (S && S.panel === 'evals' && EV.list.some(r => r.status !== 'final')) EV.timer = setTimeout(() => { if (!document.hidden) loadEvals(); else document.addEventListener('visibilitychange', function v() { if (!document.hidden) { document.removeEventListener('visibilitychange', v); loadEvals(); } }); }, 20000);
}
const SEEN = 'lsh_gcal_seen';
const seenFinal = (id) => { try { return (JSON.parse(localStorage.getItem(SEEN) || '[]')).includes(id); } catch (e) { return true; } };
const markSeen = (id) => { try { const a = JSON.parse(localStorage.getItem(SEEN) || '[]'); if (!a.includes(id)) { a.push(id); localStorage.setItem(SEEN, JSON.stringify(a.slice(-200))); } } catch (e) { /* storage blocked */ } };
const evWhen = (t) => { try { return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return t; } };
const list = (items, cls) => (items || []).length ? `<ul class="ev-l ${cls}">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="ev-none">None.</p>';
const reportHtml = (r) => EvalReport.html(r);
function evalsHtml() {
    if (EV.open != null) {
        const r = EV.list.find(x => x.id === EV.open);
        if (!r || r.status !== 'final') { EV.open = null; return evalsHtml(); }
        markSeen(r.id); EV.ready = EV.list.filter(x => x.status === 'final' && !seenFinal(x.id)).length;
        return `<button class="txt" data-a="eval-back" style="padding:0;margin-bottom:6px">← All evaluations</button><h4 style="margin:4px 0 8px">Final feedback report · ${esc(trackName(r))}</h4>${reportHtml(r)}
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="blue" data-a="eval-pdf" data-id="${r.id}">⬇ Download PDF</button></div>`;
    }
    const all = `<p style="margin:0 0 8px"><a href="/simulators/my-evaluations.html" target="_blank" rel="noopener">📋 Open My Evaluations (all my calendars and reports)</a></p>`;
    if (!EV.list.length) return all + `<p class="lead">Nothing submitted yet. When your appointments are on the calendar, click <b>📤 Submit for evaluation</b> on the requests. Your trainer goes through the AI review with you, adds their own feedback, and the final report shows here to keep and download.</p>`;
    return all + `<p class="lead">Your submitted calendars. Each report shows here once your trainer has sent it.</p>` + EV.list.map(r => {
        const st = r.status === 'final' ? `<button class="blue" data-a="eval-open" data-id="${r.id}">View report</button>`
            : `<span class="ev-st">${r.aiStatus === 'pending' ? '🤖 AI review being written…' : '👤 With your trainer for review'}</span>`;
        return `<div class="res-r"><h5><span>${esc(evWhen(r.submittedAt))} · ${esc(trackName(r))}</span><span>${r.checkScore == null ? '' : r.checkScore + '%'}</span></h5><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${st}${r.status === 'final' && !seenFinal(r.id) ? '<span class="ev-new">New</span>' : ''}</div></div>`;
    }).join('');
}
const TRACK_NAMES = { standard: 'Standard Training', cm: 'Litigation Week · Case Management', ea: 'Executive Week · EA / PA' };
const trackName = (r) => TRACK_NAMES[r && r.track] || CFG.label || 'Standard Training';
const reportPdf = (r) => EvalReport.pdf(r, trackName(r), snack);

/* ---------- events (one delegated handler each) ---------- */
const toScores = () => { const c = $('#gc-scores'); if (c && c.scrollIntoView) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
function bind() {
    const root = gc(), scores = $('#gc-scores');
    const onClick = (ev) => {
        const t = ev.target;
        const cal = t.closest('input[data-cal]'); if (cal) { S.hidden[cal.dataset.cal] = !cal.checked; save(); render(); return; }
        const done = t.closest('input[data-done]'); if (done) { const q = S.reqs.find(x => x.id === done.dataset.done); if (q) { q.done = done.checked; save(); renderRail(); renderPanel(); } return; }
        const cmd = t.closest('[data-cmd]');
        if (cmd) { ev.preventDefault(); const area = $('#ed-desc'); if (area) area.focus(); if (cmd.dataset.cmd === 'createLink') { const u = prompt('Link address (https://…)'); if (u && /^https?:\/\//i.test(u)) document.execCommand('createLink', false, u); } else document.execCommand(cmd.dataset.cmd, false, null); return; }
        const chip = t.closest('[data-iid]');
        if (chip && !t.closest('.wk-col')) { openDetail(chip.dataset.iid, chip.getBoundingClientRect()); return; }
        const a = t.closest('[data-a]'); if (!a) { if (G.menu && !t.closest('.gc-menu')) closeAll(true); return; }
        const A = a.dataset.a;
        const acts = {
            side: () => { S.side = !S.side; save(); render(); },
            today: () => { S.anchor = etNow().date; S.mini = S.anchor.slice(0, 7); G.q = ''; save(); closeAll(); render(); },
            prev: () => step(-1), next: () => step(1),
            'mini-prev': () => { const d = D(S.mini + '-01'); d.setUTCMonth(d.getUTCMonth() - 1); S.mini = iso(d).slice(0, 7); renderSide(); },
            'mini-next': () => { const d = D(S.mini + '-01'); d.setUTCMonth(d.getUTCMonth() + 1); S.mini = iso(d).slice(0, 7); renderSide(); },
            goday: () => { if (a.closest('.mini') && S.view !== 'day') { S.anchor = a.dataset.d; S.mini = S.anchor.slice(0, 7); save(); closeAll(); render(); } else goDay(a.dataset.d); },
            views: () => menu(a, VIEWS.map(v => `<button data-a="view" data-v="${v[0]}" role="menuitem">${v[1]}<kbd>${v[2]}</kbd></button>`).join('')),
            view: () => setView(a.dataset.v),
            search: () => { G.searching = true; renderHead(); setTimeout(() => { const q = $('#gc-q'); if (q) q.focus(); }, 10); },
            'search-x': () => { G.searching = false; G.q = ''; renderHead(); renderMain(); },
            help: () => shortcuts(), settings: () => settings(a),
            reset: () => dialog('Start over?', '<p style="margin:0;color:#444746">Your events and changes are cleared and a new set of requests comes in.</p>', () => { S = fresh(); save(); closeAll(); render(); }, 'Start over'),
            create: () => createAt(S.view === 'day' ? S.anchor : null),
            panel: () => { S.panel = a.dataset.p === S.panel ? '' : a.dataset.p; save(); renderPanel(); renderRail(); },
            check: () => doCheck(), 'rv-save': () => saveReview(), 'tv-save': () => saveScorecard(), 'tv-refresh': () => liveStart(true), 'tv-skip': () => skipItem(a.dataset.id, true), 'tv-unskip': () => skipItem(a.dataset.id, false), 'to-scores': () => { ev.preventDefault(); toScores(); },
            evals: () => { if (Sim.isAdmin()) { location.href = REVIEW_PAGE; return; } S.panel = S.panel === 'evals' ? '' : 'evals'; EV.open = null; save(); renderPanel(); renderRail(); if (S.panel === 'evals') loadEvals(); },
            'submit-eval': () => submitEval(),
            'cc-open': () => { closeAll(); colorDialog(); },
            'cloud-save': () => { save(true); cloudSave(); },
            'cloud-newer': () => { if (confirm('Open the newer copy saved to your account? The changes you made in this tab since then are replaced.')) cloudLoad(true); },
            'eval-open': () => { EV.open = +a.dataset.id; renderPanel(); },
            'eval-back': () => { EV.open = null; renderPanel(); },
            'eval-pdf': () => { const r = EV.list.find(x => x.id === +a.dataset.id); if (r) reportPdf(r); },
            'admin-edit': () => { if (!Sim.isAdmin()) return; G.admin = !G.admin; G.undo = null; closeAll(); render(); snack(G.admin ? 'Editing the weekly schedule for everyone' : 'Back to your practice calendar'); },
            'admin-reset': () => dialog('Restore the original schedule?', '<p style="margin:0;color:#444746">' + WW('The attorney’s week goes back to how it came, for everyone.') + '</p>', async () => {
                try { const res = await Sim.fetchRetry(API_SCHEDULE, { method: 'DELETE', credentials: 'include' }); const data = await res.json().catch(() => ({})); if (!data.success) { snack(data.error || 'Could not restore it.'); return; } } catch (e) { snack('Could not restore it (no connection).'); return; }
                ROWS = GCAL_ATTORNEY.map(r => Object.assign({}, r)); G.undo = null; render(); snack('The original schedule is back');
            }, 'Restore'),
            'new-set': () => dialog('A new set of requests?', '<p style="margin:0;color:#444746">New callers come in. Your calendar is cleared so you start fresh.</p>', () => { S = fresh(); save(); closeAll(); render(); snack('New requests are in'); }, 'New set'),
            'req-go': () => { const q = S.reqs.find(x => x.id === a.dataset.id); if (!q) return; const d = (q.orig || (q.dates || [])[0]); if (d) { S.anchor = d; S.mini = d.slice(0, 7); if (S.view === 'month' || S.view === 'agenda') S.view = 'week'; save(); closeAll(); render(); } },
            undo: () => undo(), 'snack-x': () => document.querySelectorAll('.gc-snack').forEach(n => n.remove()),
            'pop-x': () => closeAll(),
            'q-meet': () => { G.qmeet = meetCode(); $('#q-meet').innerHTML = `<button class="join" data-a="noop">${ic('video')}Join with Google Meet</button><div class="link">meet.google.com/${esc(G.qmeet)}</div>`; },
            'q-save': () => { const d = quickDraft(); G.qmeet = ''; createEvent(d); closeAll(); render(); snack('Event saved', true); },
            'q-more': () => { const d = quickDraft(); G.qmeet = ''; openEditor(d, null); },
            'd-edit': () => { const e = findInst(G.popIid); if (e) openEditor(e, e); },
            'd-del': () => { const e = findInst(G.popIid); if (!e) return; closeAll(); askScope(e, 'delete', (scope) => { removeInst(e, scope); render(); snack('Event deleted', true); }); },
            'd-mail': () => { const e = findInst(G.popIid); closeAll(); snack(e && (e.guests || []).length ? `Email to ${e.guests.length} guest${e.guests.length === 1 ? '' : 's'} drafted (practice: nothing is sent).` : 'This event has no guests to email.'); },
            'd-more': () => { const iid = G.popIid; menu(a, `<button data-a="dup" data-iid2="${esc(iid)}" role="menuitem">Duplicate</button><div class="gc-colors">${Object.keys(GCAL_COLORS).map(k => `<button data-a="recolor" data-c="${k}" data-iid2="${esc(iid)}" style="background:${GCAL_COLORS[k]}" aria-label="${k}" title="${k}"></button>`).join('')}</div>`); },
            dup: () => { const e = findInst(a.dataset.iid2); if (!e) return; const d = Object.assign({}, e, { title: e.title, cal: e.seed ? 'attorney' : e.cal, repeat: 'none' }); delete d.iid; openEditor(d, null); },
            recolor: () => { const e = findInst(a.dataset.iid2); if (!e) return; closeAll(); askScope(e, 'edit', (scope) => { applyChange(e, { color: a.dataset.c }, scope); render(); snack('Color changed', true); }); },
            join: () => { const e = findInst(G.popIid); if (e && e.meet) openMeet(e); },
            noop: () => {},
            'ed-x': () => { G.ed = null; const n = $('#gc-ed'); if (n) n.remove(); G.temp = null; renderMain(); },
            'ed-save': () => saveEditor(),
            'ed-tab': () => { edSync(); G.ed.tab = a.dataset.t; drawEditor(); },
            'ed-meet': () => { edSync(); G.ed.d.meet = meetCode(); drawEditor(); },
            'ed-unmeet': () => { edSync(); G.ed.d.meet = ''; drawEditor(); },
            'ed-copy': () => { try { navigator.clipboard.writeText('https://meet.google.com/' + G.ed.d.meet); } catch (e) { /* no clipboard */ } snack('Copied the link (practice)'); },
            'join-ed': () => { edSync(); openMeet(Object.assign({}, G.ed.d)); },
            'ed-ntf': () => { edSync(); G.ed.d.notifs.push({ m: 'popup', v: 30, u: 'minutes' }); drawEditor(); },
            'ed-unntf': () => { edSync(); G.ed.d.notifs.splice(+a.dataset.i, 1); drawEditor(); },
            'ed-ungu': () => { edSync(); G.ed.d.guests.splice(+a.dataset.i, 1); drawEditor(); }
        };
        if (acts[A]) { ev.preventDefault(); acts[A](); }
    };
    root.addEventListener('click', onClick);
    if (scores) scores.addEventListener('click', onClick);   // (the scores, wherever they sit: Save, Refresh)
    root.addEventListener('change', (ev) => {
        const t = ev.target;
        if (t.dataset.set) { S.set[t.dataset.set] = t.type === 'checkbox' ? t.checked : +t.value; save(); renderMain(); return; }
        if (G.ed && t.closest('#gc-ed') && ['ed-date', 'ed-start', 'ed-allday', 'ed-tz', 'ed-rep', 'ed-cal'].includes(t.id)) {
            const d = G.ed.d, oldS = d.start, oldE = d.end, oldTz = d.tz;
            edSync();
            if (t.id === 'ed-start') { const len = mins(oldE) - mins(oldS); d.end = hhmm(Math.min(mins(d.start) + (len > 0 ? len : S.set.dur), 1439)); }
            if (t.id === 'ed-allday' && !d.allDay && !d.start) { d.start = '09:00'; d.end = hhmm(9 * 60 + S.set.dur); }
            void oldTz;
            drawEditor();
        }
    });
    root.addEventListener('input', (ev) => { if (ev.target.id === 'gc-q') { G.q = ev.target.value.trim(); renderMain(); const t = $('.gc-title'); if (t) t.textContent = title(); } });
    root.addEventListener('keydown', (ev) => {
        if (ev.target.id === 'q-title' && ev.key === 'Enter') { ev.preventDefault(); const d = quickDraft(); G.qmeet = ''; createEvent(d); closeAll(); render(); snack('Event saved', true); }
        if (ev.target.id === 'ed-guest' && ev.key === 'Enter') {
            ev.preventDefault(); const v = ev.target.value.trim();
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { edSync(); if (!G.ed.d.guests.includes(v)) G.ed.d.guests.push(v); drawEditor(); setTimeout(() => { const g = $('#ed-guest'); if (g) g.focus(); }, 10); }
            else snack('Enter an email address, e.g. ' + (CFG.who ? 'name@example.com' : 'client@example.com'));
        }
        if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('.ev[data-iid], .ag-e[data-iid]')) { ev.preventDefault(); openDetail(ev.target.dataset.iid, ev.target.getBoundingClientRect()); }
    });
    root.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', (ev) => { if (G.pop && !ev.target.closest('.gc-pop') && !ev.target.closest('.wk-col') && !ev.target.closest('.gc-dlg') && !ev.target.closest('.gc-menu')) closeAll(); });
    addEventListener('resize', () => { if (S.view === 'week') renderMain(); });
}
function onKey(ev) {
    if (!S || !gc()) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || ev.target.isContentEditable;
    if (ev.key === 'Escape') { if (G.meet) return; if (document.querySelector('.gc-dlg')) { document.querySelector('.gc-dlg').remove(); return; } if (G.ed) { G.ed = null; $('#gc-ed').remove(); G.temp = null; renderMain(); return; } closeAll(); if (G.searching) { G.searching = false; G.q = ''; renderHead(); renderMain(); } return; }
    if (typing || G.ed || G.meet || document.querySelector('.gc-dlg') || document.getElementById('sim-who')) return;
    const k = ev.key;
    const map = { c: () => createAt(S.view === 'day' ? S.anchor : null), t: () => { S.anchor = etNow().date; save(); closeAll(); render(); }, j: () => step(1), n: () => step(1), k: () => step(-1), p: () => step(-1),
        d: () => setView('day'), w: () => setView('week'), m: () => setView('month'), a: () => setView('agenda'), '/': () => { G.searching = true; renderHead(); setTimeout(() => { const q = $('#gc-q'); if (q) q.focus(); }, 10); }, '?': () => shortcuts(),
        e: () => { if (G.pop && G.popIid) { const e = findInst(G.popIid); if (e && !e.readOnly) openEditor(e, e); } },
        Delete: () => { if (G.pop && G.popIid) { const e = findInst(G.popIid); if (e && !e.readOnly) { closeAll(); askScope(e, 'delete', (scope) => { removeInst(e, scope); render(); snack('Event deleted', true); }); } } } };
    if (k === 'Backspace') map.Backspace = map.Delete;
    if (map[k] && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { ev.preventDefault(); map[k](); }
}

/* ---------- drag: create a range, move an event, change its length ---------- */
const snap = (m, s) => Math.round(m / s) * s;
const yMin = (col, y) => Math.max(0, Math.min(24 * 60, (y - col.getBoundingClientRect().top) / HH * 60));
function onDown(ev) {
    if (ev.button !== 0) return;
    const col = ev.target.closest('.wk-col'); if (!col || col.closest('#ed-find')) return;
    const evEl = ev.target.closest('.ev');
    if (evEl && evEl.dataset.iid === 'temp') return;
    if (evEl) {
        const inst = findInst(evEl.dataset.iid); if (!inst) return;
        const resize = !!ev.target.closest('[data-rs]');
        G.drag = { kind: resize ? 'resize' : 'move', inst, el: evEl, x0: ev.clientX, y0: ev.clientY, off: yMin(col, ev.clientY) - mins(inst.start), moved: false, date: inst.date, start: mins(inst.start), end: mins(inst.end) };
    } else {
        if (RV) return;
        closeAll();
        const m = yMin(col, ev.clientY);
        G.drag = { kind: 'new', col, date: col.dataset.d, a: m, b: m, x0: ev.clientX, y0: ev.clientY, moved: false };
    }
    ev.preventDefault();
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
}
function onMove(ev) {
    const g = G.drag; if (!g) return;
    if (!g.moved && Math.abs(ev.clientX - g.x0) + Math.abs(ev.clientY - g.y0) < 5) return;
    g.moved = true;
    if (g.kind === 'new') {
        g.col = document.querySelector(`.wk-col[data-d="${g.date}"]`) || g.col;   // (the grid is redrawn on every move)
        g.b = yMin(g.col, ev.clientY);
        const s = snap(Math.min(g.a, g.b), 15), e = Math.max(snap(Math.max(g.a, g.b), 15), s + 15);
        G.temp = { date: g.date, start: hhmm(s), end: hhmm(Math.min(e, 1439)), cal: G.admin ? 'attorney' : 'lsh' };
        renderMain(); return;
    }
    if (g.inst.readOnly) return;
    const under = document.elementFromPoint(ev.clientX, ev.clientY), col = under && under.closest('.wk-col');
    if (!col || col.closest('#ed-find')) return;
    const len = g.end - g.start;
    if (g.kind === 'move') { g.ndate = col.dataset.d; g.ns = Math.max(0, Math.min(1440 - len, snap(yMin(col, ev.clientY) - g.off, 15))); g.ne = g.ns + len; }
    else { g.ndate = g.date; g.ns = g.start; g.ne = Math.max(g.start + 15, Math.min(1440, snap(yMin(col, ev.clientY), 15))); }
    document.querySelectorAll('.ev.ghost').forEach(n => n.remove());
    col.insertAdjacentHTML('beforeend', evHtml(Object.assign({}, g.inst, { iid: 'ghost', date: g.ndate, start: hhmm(g.ns), end: hhmm(Math.min(g.ne, 1439)), _n: 1, _c: 0 }), 'ghost'));
}
function onUp(ev) {
    document.removeEventListener('pointermove', onMove);
    const g = G.drag; G.drag = null; if (!g) return;
    if (g.kind === 'new') {
        if (!g.moved) { const s = Math.min(Math.floor(g.a / 30) * 30, 1440 - S.set.dur); G.temp = { date: g.date, start: hhmm(s), end: hhmm(Math.min(s + S.set.dur, 1439)), cal: G.admin ? 'attorney' : 'lsh' }; }
        renderMain();
        const el = document.querySelector('.ev.temp');
        openQuick(G.temp, el ? el.getBoundingClientRect() : null);
        return;
    }
    document.querySelectorAll('.ev.ghost').forEach(n => n.remove());
    if (!g.moved || g.ndate == null) { openDetail(g.inst.iid, g.el.getBoundingClientRect()); return; }
    if (g.ndate === g.date && g.ns === g.start && g.ne === g.end) return;
    const fields = { date: g.ndate, start: hhmm(g.ns), end: hhmm(Math.min(g.ne, 1439)) };
    askScope(g.inst, 'edit', (scope) => { applyChange(g.inst, scope === 'all' ? { start: fields.start, end: fields.end } : fields, scope); render(); snack('Event saved', true); });
}

/* ---------- start ---------- */
window.GCAL = { solve, checkPlan, checkOpen, slotProblems, concretize, instancesOf, dealRequests, simToday, trimPayload, datesIn, addDays, weekStart, lengthColor, mins, rows: () => ROWS, setRows: (r) => { ROWS = r; } };
async function start() {
    if (!document.getElementById('app')) return;
    await Sim.restore();   // opened in a new tab: the cookie says who is signed in (an admin must not be treated as a trainee), and the heartbeat starts
    const tb = document.getElementById('topbar'); if (tb) tb.innerHTML = Sim.topbar('gcal');
    if (TRK) document.title = 'Basic Calendaring · ' + CFG.label + ' — LSH Training Portal';
    if (TRK) { const eb = document.querySelector('.eyebrow'); if (eb) eb.textContent = 'Simulator · ' + CFG.scenario; }
    heroRules();
    if (RV) { if (RV.live) liveStart(); else reviewStart(); return; }
    S = load() || fresh(); save(true);   // (local only: the copy saved to their account may be newer, cloudLoad below)
    render();
    mineStart();
    if (!Sim.isAdmin()) { loadEvals(); cloudLoad(); }   // My evaluations (a badge when a final report is waiting); the calendar saved to their account
    // the weekly schedule as an Admin set it (if they did)
    Sim.fetchRetry(API_SCHEDULE, { credentials: 'include' }).then(r => r.json()).then(data => {
        let redraw = false;
        if (data && data.success && data.colors) { const was = JSON.stringify(CC); setCC(data.colors); redraw = JSON.stringify(CC) !== was; }   // 🎨 the trainer's color coding
        if (data && data.success && Array.isArray(data.rows) && data.rows.length && data.rows.every(r => r && r.id && r.title && /^\d\d:\d\d$/.test(r.start))) {
            ROWS = data.rows; S.reqs = S.reqs.filter(q => q && (q.row == null || rowById(q.row))); redraw = true;
        }
        if (redraw) render();
    }).catch(() => { /* the schedule as it came */ });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* 📝 Standard Training - Calendaring Activity: the scoring of the blank calendar (gcal.html?track=activity).
   This activity's own scoring, on the Portal: the Day 5 Attorney Calendar Management Activity's ten items (18 calendar entries with
   the court appearance's travel blocks and the networking dinner's travel, arrival and overnight stay), checked entry by entry.

   Every entry, each check counting one:
     • Title: names the appointment (a flight the right way round; a travel block the right leg), and with the client's name where the
       item gives one (item 1: Alyssa Lynn Arehart);
     • Date, Start time, End time: the item's, as a moment (so the same moment entered in another zone still has the right time);
     • Time zone: the item's own (PST Pacific Time - Los Angeles, MST Mountain Time - Denver, CST Central Time - Chicago, EST Eastern
       Time - New York); the overnight stay is all day;
     • Location: the item's (the Zoom link on item 3; Google Meet for the online meetings); a travel block's departure → destination;
     • Guests: exactly the item's, at their directory addresses (no one missing, no one extra; none where the item has none);
     • Notification: the reminder the item gives (its type and time; the trip's 1-day email on either leg of its travel block), and a
       notification on every entry (a travel block: a practical one, 30 minutes to a day before);
     • Notes: on every entry, and complete: every detail the item gives;
     • Color: changed from the calendar's default to its category's (Green client meetings, Blue internal meetings, Red court-related
       tasks, Purple external events, Yellow internal tasks, Orange personal wellness, Pink personal events);
     • Attorney's Calendar: on the Attorney's Calendar, not the default LSH Calendar.
   The whole calendar: the travel buffers (each travel block right against its appointment), no overlapping events, no duplicates.
   An entry not on the calendar misses every one of its checks. The score is the share of checks met (100% only when all are); 80% passes.

   The activity's dates: its own are July 6–15, 2026, moved by whole weeks to the trainee's batch: the first Monday on or after their
   Day 5 (the Batch ID is B + the start date, MMDDYY), as the Foundational Training gives them on the slides. A calendar built on other
   weeks is scored on the weeks that fit it best, so a trainee is never marked down for the whole set over the dates alone.

     GcalActivity.review(events, { batch, zone })   events: the calendar's own ({title, cal, color, location, meet, desc (text), guests[],
                                                     notifs[{m, v, u}], allDay, tz, date, start, end}, dates and times on the calendar's
                                                     clock `zone`) → { score, met, total, passed, right, entries, results[], extras[], key[], anchor, span }
     GcalActivity.KEY, GcalActivity.anchorForBatch(batch)
*/
const GcalActivity = (function () {
    const ZONE = { PST: 'America/Los_Angeles', MST: 'America/Denver', CST: 'America/Chicago', EST: 'America/New_York' };
    const ZNAME = { PST: 'Pacific Time - Los Angeles', MST: 'Mountain Time - Denver', CST: 'Central Time - Chicago', EST: 'Eastern Time - New York' };
    const CATS = {
        client: { name: 'Green', what: 'Client Meetings', colors: ['basil', 'sage'] }, internal: { name: 'Blue', what: 'Internal Meetings', colors: ['peacock', 'blueberry'] },
        court: { name: 'Red', what: 'Court-Related Tasks', colors: ['tomato'] }, external: { name: 'Purple', what: 'External Events', colors: ['grape'] },
        task: { name: 'Yellow', what: 'Internal Tasks', colors: ['banana'] }, wellness: { name: 'Orange', what: 'Personal Wellness', colors: ['tangerine'] },
        personal: { name: 'Pink', what: 'Personal Events', colors: ['flamingo'] }
    };
    const PEOPLE = { 'Martin Anthony': 'martin@legalsupporthelp.com', 'Michelle Velarde': 'michelle.velarde@legalsupporthelp.com',
        'John Michael Dela Cruz': 'john.delacruz@legalsupporthelp.com', 'Lei Lee Abut': 'team-litigation@legalsupporthelp.com' };
    const MA = 'Martin Anthony', MV = 'Michelle Velarde', TEAM = [MA, MV, 'John Michael Dela Cruz', 'Lei Lee Abut'];
    // The answer key, in the activity's own dates (July 2026). title: word groups the title holds (any phrase of each); name: the
    // client's name it must also hold; not: words that name the other leg; dir: a flight's from/to; loc: the location holds one of
    // these (meet: Google Meet counts); link: a link in the location or the notes; rem: the item's reminder (type, minutes);
    // pair: the travel block's other event (the trip's reminder and notes may sit on either); travel: a travel block (departure →
    // destination; eg: an example); notes: the details the notes hold (every group); cat / alt: the color's category, others accepted.
    const KEY = [
        { n: '1', name: 'Client Meeting', title: [['client meeting']], name2: ['alyssa lynn arehart', 'alyssa arehart'], date: '2026-07-06', start: '10:00', end: '11:00', tz: 'PST', cat: 'client',
            loc: ['conference room b'], locShow: 'Conference Room B', guests: [MA, MV], rem: { type: 'notification', m: 15 },
            notes: [['alyssa lynn arehart', 'alyssa arehart', 'arehart'], ['car accident'], ['case documents', 'documents']], notesShow: 'Alyssa Lynn Arehart · car accident case · case documents accessible during the meeting' },
        { n: '2', name: 'Team Meeting', title: [['team meeting']], date: '2026-07-07', start: '15:00', end: '16:00', tz: 'MST', cat: 'internal',
            loc: ['google meet', 'meet google com'], meet: true, locShow: 'Google Meet', guests: TEAM, rem: { type: 'email', m: 30 },
            notes: [['weekly'], ['check in', 'checkin']], notesShow: 'Weekly team check-in' },
        { n: '3', name: 'Deposition Meeting', title: [['deposition']], date: '2026-07-08', start: '11:00', end: '13:00', tz: 'EST', cat: 'court', alt: ['internal'],
            loc: ['attorneys office', 'attorney office'], locShow: 'Attorney’s Office (or Zoom for remote attendees: zoom.us/deposition-meeting-02-04-25)', link: 'zoom.us/deposition-meeting-02-04-25',
            guests: [MA, MV], rem: { type: 'email', m: 1440 },
            notes: [['deposition preparation', 'deposition prep', 'preparation', 'prepare'], ['another attorney', 'other attorney', 'opposing counsel']], notesShow: 'Deposition preparation with another attorney' },
        { n: '4', name: 'Gym Session', title: [['gym', 'workout', 'work out']], date: '2026-07-08', start: '06:30', end: '07:30', tz: 'EST', cat: 'wellness',
            loc: ['fitness center', 'fitness centre'], locShow: 'Downtown Seattle Fitness Center', rem: { type: 'notification', m: 10 },
            notes: [['workout', 'work out']], notesShow: 'Morning workout' },
        { n: '5', name: 'Doctor’s Appointment', title: [['doctors appointment', 'doctor appointment', 'doctors appt', 'doctor']], date: '2026-07-09', start: '09:00', end: '10:00', tz: 'PST', cat: 'wellness', alt: ['personal'],
            loc: ['central medical clinic'], locShow: 'Central Medical Clinic', rem: { type: 'email', m: 1440 },
            notes: [['check up', 'checkup'], ['documents', 'document'], ['insurance']], notesShow: 'Routine check-up · prepare the necessary documents and insurance details' },
        { n: '6.1', name: 'Court Appearance', title: [['court appearance', 'court hearing']], date: '2026-07-10', start: '09:00', end: '12:00', tz: 'PST', cat: 'court',
            loc: ['washington county court'], locShow: 'Washington County Court', rem: { type: 'notification', m: 30 },
            notes: [['hearing']], notesShow: 'The attorney’s scheduled court hearing' },
        { n: '6.2', name: 'Travel Block: travel to court', title: [['travel'], ['court']], not: ['return', 'from court'], date: '2026-07-10', start: '08:00', end: '09:00', tz: 'PST', cat: 'court', alt: ['external'],
            travel: true, eg: 'Office → Washington County Court' },
        { n: '6.3', name: 'Travel Block: return travel', title: [['travel'], ['return']], not: ['to court'], date: '2026-07-10', start: '12:00', end: '13:00', tz: 'PST', cat: 'court', alt: ['external'],
            travel: true, eg: 'Washington County Court → Office' },
        { n: '7', name: 'Recorded Statement Meeting', title: [['recorded statement']], date: '2026-07-10', start: '16:00', end: '17:00', tz: 'CST', cat: 'court', alt: ['client', 'external'],
            loc: ['google meet', 'meet google com'], meet: true, locShow: 'Google Meet', guests: TEAM, rem: { type: 'notification', m: 15 },
            notes: [['insurance adjuster', 'adjuster'], ['premises liability']], notesShow: 'With an insurance adjuster · premises liability case' },
        { n: '8.1', name: 'Networking Dinner Event', title: [['networking']], date: '2026-07-13', start: '18:00', end: '20:00', tz: 'PST', cat: 'external',
            loc: ['ritz carlton'], locShow: 'The Ritz-Carlton, San Francisco (600 Stockton St, San Francisco, CA 94108)', rem: { type: 'notification', m: 30 },
            notes: [['business cards', 'business card'], ['introduction', 'intro']], notesShow: 'Bring business cards · prepare a short personal introduction' },
        { n: '8.2', name: 'Transportation to Seattle Airport (SEA)', title: [['transportation', 'transport', 'travel', 'ride'], ['seattle', 'sea', 'airport']], date: '2026-07-13', start: '08:30', end: '09:00', tz: 'PST', cat: 'external',
            travel: true, eg: 'Home → Seattle-Tacoma International Airport (SEA)', pair: '8.3' },
        { n: '8.3', name: 'Flight from Seattle (SEA) to San Francisco (SFO)', title: [['flight'], ['san francisco', 'sfo']], dir: { from: ['seattle', 'sea'], to: ['san francisco', 'sfo'] }, date: '2026-07-13', start: '09:00', end: '12:00', tz: 'PST', cat: 'external',
            travel: true, eg: 'SEA → SFO', pair: '8.2', rem: { type: 'email', m: 1440 },
            notes: [['flight details', 'confirm flight', 'confirm the flight'], ['luggage', 'baggage'], ['travel documents'], ['business cards', 'business card'], ['attire']], notesShow: 'Confirm flight details · check in luggage · bring travel documents · bring business cards · prepare attire for the event' },
        { n: '8.4', name: 'Arrival block (early arrival at the event)', title: [['arrival', 'arrive']], date: '2026-07-13', start: '17:45', end: '18:00', tz: 'PST', cat: 'external' },
        { n: '8.5', name: 'Overnight Stay', title: [['overnight', 'hotel stay']], date: '2026-07-13', overnight: true, tz: 'PST', cat: 'external',
            notes: [['hotel'], ['transportation', 'transport', 'ride']], notesShow: 'Confirm hotel booking · plan transportation after the event' },
        { n: '8.6', name: 'Check out of the hotel and travel to the airport', title: [['check out', 'checkout', 'hotel'], ['airport', 'travel']], date: '2026-07-14', start: '08:00', end: '08:30', tz: 'PST', cat: 'external',
            travel: true, eg: 'The Ritz-Carlton, San Francisco → SFO', pair: '8.7', rem: { type: 'email', m: 1440 },
            notes: [['check out', 'checkout'], ['transportation', 'transport', 'airport']], notesShow: 'Confirm hotel check-out and transportation to the airport' },
        { n: '8.7', name: 'Flight from San Francisco (SFO) to Seattle (SEA)', title: [['flight'], ['seattle', 'sea']], dir: { from: ['san francisco', 'sfo'], to: ['seattle', 'sea'] }, date: '2026-07-14', start: '10:00', end: '13:00', tz: 'PST', cat: 'external',
            travel: true, eg: 'SFO → SEA', pair: '8.6' },
        { n: '9', name: 'Document Review Session', title: [['document review']], date: '2026-07-15', start: '13:30', end: '15:00', tz: 'CST', cat: 'task',
            loc: ['attorneys office', 'attorney office'], locShow: 'Attorney’s Office', rem: { type: 'notification', m: 30 },
            notes: [['high priority'], ['case file', 'case']], notesShow: 'Review a high-priority case file' },
        { n: '10', name: 'Family Dinner', title: [['family dinner']], date: '2026-07-15', start: '19:00', end: '21:00', tz: 'MST', cat: 'personal',
            loc: ['home'], locShow: 'Home', rem: { type: 'notification', m: 60 }, notes: [['groceries', 'grocery']], notesShow: 'Pick up groceries on the way home' }
    ];
    // the whole calendar's travel buffers: [travel block, where it sits, the appointment]
    const BUFFERS = [['6.2', 'before', '6.1'], ['6.3', 'after', '6.1'], ['8.2', 'before', '8.3'], ['8.4', 'before', '8.1'], ['8.6', 'earlier', '8.7']];
    const TRAVEL_MIN = 30, TRAVEL_MAX = 1440, BASE = '2026-07-06';

    /* ---------- dates, times, zones ---------- */
    const isoMs = (iso) => Date.parse(iso + 'T00:00:00Z');
    const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10);
    const addD = (iso, n) => isoOf(isoMs(iso) + n * 864e5);
    const mins = (t) => { const m = /^(\d{1,2}):(\d\d)/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
    function offset(tz, ms) {   // the zone's offset from UTC at an instant, in ms
        const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
            .formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
        return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - ms;
    }
    const at = (date, time, tz) => { const l = isoMs(date) + mins(time) * 60000; return l - offset(tz, l - offset(tz, l)); };   // a wall-clock date and time in a zone → ms
    const wallOf = (ms, tz) => { const w = new Date(ms + offset(tz, ms)).toISOString(); return { date: w.slice(0, 10), time: w.slice(11, 16) }; };
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dText = (iso) => `${DAY[new Date(isoMs(iso)).getUTCDay()]} ${MON[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`;
    const tText = (t) => { const m = mins(t), h = Math.floor(m / 60) % 24; return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
    const leadText = (m) => m % 1440 === 0 ? `${m / 1440} day${m === 1440 ? '' : 's'}` : m % 60 === 0 ? `${m / 60} hour${m === 60 ? '' : 's'}` : `${m} minutes`;
    const remText = (r) => `${r.type === 'email' ? 'Email' : 'Notification'} ${leadText(r.m)} before`;
    // the activity's Monday for a batch: Day 5 is the fifth weekday from the start (a weekend start counts from the Monday after); the
    // activity starts the first Monday on or after it
    function anchorForBatch(batch) {
        const m = /^b(\d{2})(\d{2})(\d{2})$/i.exec(String(batch || '').trim()); if (!m) return null;
        const start = `20${m[3]}-${m[1]}-${m[2]}`; if (!Number.isFinite(isoMs(start)) || isoOf(isoMs(start)) !== start) return null;
        let t = isoMs(start), n = 0;
        for (;;) { const d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6 && ++n === 5) break; t += 864e5; }
        const d = new Date(t).getUTCDay(), mon = isoOf(t + ((8 - d) % 7) * 864e5);
        return mon >= BASE ? mon : BASE;
    }
    const weeksOf = (anchor) => Math.round((isoMs(anchor) - isoMs(BASE)) / (7 * 864e5));
    // the key at an anchor: every date moved by its weeks, with each entry's moment
    function keyAt(anchor) {
        const w = weeksOf(anchor);
        return KEY.map(k => { const date = addD(k.date, 7 * w), o = Object.assign({}, k, { date });
            if (!k.overnight) { o.s = at(date, k.start, ZONE[k.tz]); o.e = at(date, k.end, ZONE[k.tz]); }
            return o; });
    }

    /* ---------- words ---------- */
    const words = (t) => ' ' + String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
    const has = (txt, p) => txt.includes(' ' + words(p).trim() + ' ');
    const groupsIn = (txt, gs) => gs.filter(g => g.some(p => has(txt, p)));
    function wrongWay(k, t) {
        if (k.not && k.not.some(p => has(t, p))) return true;
        if (!k.dir) return false;
        const cue = (pre, list) => list.some(p => has(t, pre + ' ' + p));
        if (cue('from', k.dir.to) || cue('to', k.dir.from)) return true;
        if (cue('from', k.dir.from) || cue('to', k.dir.to)) return false;
        const pos = (list) => Math.min(...list.map(p => { const i = t.indexOf(' ' + words(p).trim() + ' '); return i < 0 ? Infinity : i; }));
        const a = pos(k.dir.from), b = pos(k.dir.to); return a < Infinity && b < Infinity && a > b;
    }
    const route = (loc) => { const m = /\s*(?:→|➔|➝|⟶|➡|->|=>|—>|–>|>)\s*|\s+to\s+|\s+[-–—]\s+/i.exec(String(loc || '')); if (!m) return null;
        const from = loc.slice(0, m.index).trim(), to = loc.slice(m.index + m[0].length).trim(); return from && to ? { from, to } : null; };

    /* ---------- the calendar's events, as the scoring reads them ---------- */
    const UNIT = { minutes: 1, hours: 60, days: 1440, weeks: 10080 };
    function readEvents(list, zone) {
        return (Array.isArray(list) ? list : []).map((e, i) => {
            const tz = e.tz || zone, x = { id: 'e' + i, title: String(e.title || ''), cal: e.cal || '', color: e.color || '', loc: String(e.location || ''), meet: !!e.meet, desc: String(e.desc || ''),
                guests: (e.guests || []).map(g => String((g && g.email) || g || '').trim().toLowerCase()).filter(Boolean), allDay: !!e.allDay, tz,
                reminders: (e.notifs || []).map(n => ({ type: n.m === 'email' ? 'email' : 'notification', m: Math.round((+n.v || 0) * (UNIT[n.u] || 1)) })) };
            if (x.allDay) return Object.assign(x, { date: e.date, s: null, e: null });
            const s = at(e.date, e.start, zone), en = e.end === '23:59' ? at(e.date, '23:59', zone) + 60000 : at(e.date, e.end, zone);
            return Object.assign(x, { s, e: en > s ? en : en + 864e5, date: wallOf(s, tz).date });
        });
    }
    const evWhen = (x) => !x.allDay && (x.s == null || !x.tz) ? 'none' : x.allDay ? `${dText(x.date)}, all day` : (() => { const a = wallOf(x.s, x.tz), b = wallOf(x.e, x.tz);
        return `${dText(a.date)}, ${tText(a.time)} – ${tText(b.time)} (${x.tz.replace(/^.*\//, '').replace(/_/g, ' ')})`; })();
    const keyWhen = (k) => k.overnight ? `${dText(k.date)}, all day` : `${dText(k.date)}, ${tText(k.start)} – ${tText(k.end)} ${k.tz}`;
    const zName = (tz) => ({ 'America/Los_Angeles': 'Pacific Time - Los Angeles', 'America/Denver': 'Mountain Time - Denver', 'America/Chicago': 'Central Time - Chicago',
        'America/New_York': 'Eastern Time - New York', 'Asia/Manila': 'Philippine Time - Manila', UTC: 'Coordinated Universal Time' })[tz] || tz;
    const catText = (c) => `${CATS[c].name} (${CATS[c].what})`;
    const colorName = (c) => c ? c[0].toUpperCase() + c.slice(1) : 'the default (not changed)';

    /* ---------- one entry: every check, [label, ok, what the trainer reads when it isn't] ---------- */
    function entryChecks(k, x, K, M) {
        const out = [], add = (label, ok, why) => out.push({ label, ok: !!ok, why: ok ? '' : why });
        const t = words(x.title);
        add('Title', groupsIn(t, k.title).length === k.title.length && !wrongWay(k, t), `name it as the item does: “${k.name}”. Yours: “${x.title}”.`);
        if (k.name2) add('Title: with the client’s name', k.name2.some(p => has(t, p)), `add the client’s name: “${k.name} – Alyssa Lynn Arehart”. Yours: “${x.title}”.`);
        if (k.overnight) {
            add('Date', x.allDay ? x.date === k.date : x.s != null && wallOf(x.s, ZONE.PST).date === k.date, `${dText(k.date)} (the night of the networking dinner). Yours: ${evWhen(x)}.`);
            add('All day', x.allDay, `an all-day event on ${dText(k.date)}. Yours: ${evWhen(x)}.`);
        } else {
            const kz = ZONE[k.tz], when = keyWhen(k);
            add('Date', !x.allDay && x.s != null && wallOf(x.s, kz).date === k.date, `${dText(k.date)}. Yours: ${evWhen(x)}.`);
            add('Start time', !x.allDay && x.s === k.s, `${tText(k.start)} ${k.tz} (${when}). Yours: ${evWhen(x)}.`);
            add('End time', !x.allDay && x.e === k.e, `${tText(k.end)} ${k.tz} (${when}). Yours: ${evWhen(x)}.`);
            add('Time zone', !x.allDay && x.tz === kz, `${k.tz} is ${ZNAME[k.tz]}. Yours: ${x.allDay ? 'all day (no time zone)' : zName(x.tz)}.`);
        }
        // the location
        const lw = words(x.loc + ' ' + (x.meet ? 'google meet' : ''));
        if (k.travel) add('Location: departure → destination', !!route(x.loc), `where the attorney leaves from and where they go, e.g. “${k.eg}”. Yours: ${x.loc ? `“${x.loc}”` : 'empty'}.`);
        else if (k.loc) add('Location', k.loc.some(p => has(lw, p)), `“${k.locShow}”. Yours: ${x.loc ? `“${x.loc}”` : x.meet ? 'Google Meet' : 'empty'}.`);
        if (k.link) add('Location: the Zoom link for remote attendees', words(x.loc + ' ' + x.desc).includes(words(k.link)), `add ${k.link} to the location or the notes.`);
        // the guests: exactly the item's, at their directory addresses
        const want = (k.guests || []).map(n => PEOPLE[n]), have = x.guests, miss = want.filter(g => !have.includes(g)), extra = have.filter(g => !want.includes(g));
        add('Guests', !miss.length && !extra.length, (k.guests ? `invite ${k.guests.map(n => `${n} (${PEOPLE[n]})`).join(', ')}.` : 'this item has no guests.')
            + (miss.length ? ` Missing: ${miss.join(', ')}.` : '') + (extra.length ? ` Not on this item${extra.some(g => !Object.values(PEOPLE).includes(g)) ? ' (or not a directory address)' : ''}: ${extra.join(', ')}.` : ''));
        // the notifications
        const pairX = k.pair ? M[k.pair] : null, pairK = k.pair ? K.find(o => o.n === k.pair) : null, rem = k.rem || (pairK && pairK.rem), mine = x.reminders, yours = mine.length ? mine.map(remText).join(', ') : 'none';
        if (rem) { const hit = (list) => list.some(r => r.type === rem.type && r.m === rem.m), ok = hit(mine) || (!!k.pair && !!pairX && hit(pairX.reminders));
            add('Notification: the item’s reminder', ok, `${remText(rem)}${k.pair ? ` (the trip’s reminder: on ${[k.n, k.pair].sort().join(' or ')})` : ''}. Yours: ${yours}.`); }
        if (k.travel && !k.rem) add('Notification: a practical travel reminder', mine.some(r => r.m >= TRAVEL_MIN && r.m <= TRAVEL_MAX),
            `a reminder ${leadText(TRAVEL_MIN)} to ${leadText(TRAVEL_MAX)} before, so the attorney can leave without rushing (instruction 6). Yours: ${yours}.`);
        else if (!k.rem) add('Notification: set', mine.length > 0, 'add a reminder for this entry (instruction 5). Yours: none.');
        // the notes: there, and complete (a travel block's details on either of its events)
        add('Notes', !!x.desc.trim(), `this entry has no notes. Add ${k.notesShow || (pairK && pairK.notesShow) || 'what it is for, where from and where to'} (instruction 5).`);
        const groups = k.notes || (pairK && pairK.notes);
        if (groups) { const txt = words(x.desc + ' ' + (pairX ? pairX.desc : '')), got = groupsIn(txt, groups), gone = groups.filter(g => !got.includes(g));
            add('Notes: complete', !gone.length, `missing ${gone.map(g => `“${g[0]}”`).join(', ')}. The item asks for: ${k.notesShow || pairK.notesShow}${k.pair ? ` (on ${[k.n, k.pair].sort().join(' or ')})` : ''}.`); }
        // the color, changed to its category's
        const ok = (k.alt || []).concat(k.cat).some(c => CATS[c].colors.includes(x.color));
        add('Color: changed to its category', ok, `${catText(k.cat)}${k.alt ? `; ${k.alt.map(catText).join(' or ')} also accepted` : ''}. Yours: ${colorName(x.color)}.`);
        add('On the Attorney’s Calendar', x.cal === 'attorney', `move it to the Attorney’s Calendar (instruction 3). Yours: ${x.cal === 'lsh' ? 'the LSH Calendar' : x.cal || 'none'}.`);
        return out;
    }
    // the checks an entry has (for one that isn't on the calendar: each one missed)
    const blankEvent = { title: '', cal: '', color: '', loc: '', meet: false, desc: '', guests: [], allDay: false, tz: '', reminders: [], s: null, e: null, date: '' };

    /* ---------- the review at one anchor ---------- */
    function reviewAt(events, anchor) {
        const K = keyAt(anchor), M = {}, used = {};
        // each entry takes the event that fits it best and isn't taken: its title first, then its moment, then how many checks it meets
        const pairs = [];
        K.forEach(k => events.forEach(x => { const t = words(x.title), title = groupsIn(t, k.title).length === k.title.length && !wrongWay(k, t);
            const when = k.overnight ? x.allDay && x.date === k.date : x.s === k.s;
            if (title || when) pairs.push({ k, x, sc: (title ? 100 : 0) + (when ? 50 : 0) + entryChecks(k, x, K, {}).filter(c => c.ok).length }); }));
        pairs.sort((a, b) => b.sc - a.sc).forEach(p => { if (!M[p.k.n] && !used[p.x.id]) { M[p.k.n] = p.x; used[p.x.id] = 1; } });
        const results = K.map(k => { const x = M[k.n];
            const checks = x ? entryChecks(k, x, K, M) : entryChecks(k, blankEvent, K, M).map(c => ({ label: c.label, ok: false, why: 'not on the calendar' }));
            return { id: k.n, head: `${k.n} ${k.name}`, when: x ? evWhen(x) : 'Not on the calendar', found: !!x, checks }; });
        // the whole calendar: the travel buffers, overlaps, duplicates
        const buf = BUFFERS.map(([t, rel, a]) => { const kt = K.find(o => o.n === t), ka = K.find(o => o.n === a), x = M[t], y = M[a], name = `${t} ${kt.name}`;
            if (!x) return { label: name, ok: false, why: `not on the calendar: the attorney has no travel time ${rel === 'after' ? 'after' : 'before'} ${a} ${ka.name}.` };
            if (!y || x.allDay || y.allDay) return { label: name, ok: true, why: '' };
            const ok = rel === 'before' ? x.e === y.s : rel === 'after' ? x.s === y.e : x.e <= y.s;
            return { label: name, ok, why: ok ? '' : `it should ${rel === 'after' ? 'start when' : rel === 'before' ? 'end when' : 'end before'} ${a} ${ka.name} ${rel === 'after' ? 'ends' : 'starts'} (${keyWhen(kt)}). Yours: ${evWhen(x)}.` }; });
        results.push({ id: 'buffers', head: 'Travel buffers', when: '', found: true, checks: buf });
        const stay = M['8.5'] ? M['8.5'].id : null, timed = events.filter(x => !x.allDay && x.id !== stay), clashes = [];
        timed.forEach((a, i) => timed.slice(i + 1).forEach(b => { if (a.s < b.e && b.s < a.e) clashes.push(`“${a.title}” (${evWhen(a)}) overlaps “${b.title}” (${evWhen(b)}).`); }));
        const rest = events.filter(x => !used[x.id]), dupes = [], extras = [];
        rest.forEach(x => { const t = words(x.title), k = K.find(o => M[o.n] && groupsIn(t, o.title).length === o.title.length && !wrongWay(o, t)); (k ? dupes : extras).push({ x, k }); });
        results.push({ id: 'calendar', head: 'Whole calendar', when: '', found: true, checks: [
            { label: 'No overlapping events', ok: events.length > 0 && !clashes.length, why: events.length ? clashes.slice(0, 6).join(' ') : 'nothing on the calendar' },
            { label: 'No duplicate events', ok: events.length > 0 && !dupes.length, why: events.length ? dupes.map(d => `“${d.x.title}” (${evWhen(d.x)}) repeats ${d.k.n} ${d.k.name}: keep one event per entry.`).join(' ') : 'nothing on the calendar' }] });
        results.forEach(r => { r.max = r.checks.length; r.pts = r.checks.filter(c => c.ok).length; r.perfect = r.found && r.pts === r.max; });
        const met = results.reduce((n, r) => n + r.pts, 0), total = results.reduce((n, r) => n + r.max, 0);
        const score = met === total && !extras.length ? 100 : Math.min(99, Math.round(met / total * 100));
        return { anchor, score, met, total, passed: score >= 80, right: results.filter(r => r.perfect).length, entries: results.length, results,
            extras: extras.map(d => ({ title: d.x.title, when: evWhen(d.x) })),
            span: `${dText(K[0].date)} to ${dText(K[K.length - 1].date)}, ${K[0].date.slice(0, 4)}`,
            key: K.map(k => ({ n: k.n, title: `${k.n} ${k.name}`, expect: expectText(k) })) };
    }
    // what an entry should hold, in one line (the AI's answer key and the trainer's)
    const expectText = (k) => [keyWhen(k) + (k.overnight ? '' : ` (${ZNAME[k.tz]})`), k.travel ? `location: departure → destination, e.g. ${k.eg}` : k.loc ? `location: ${k.locShow}` : '',
        k.guests ? `guests: ${k.guests.map(n => `${n} (${PEOPLE[n]})`).join(', ')}` : 'no guests', k.rem ? `reminder: ${remText(k.rem)}${k.pair ? ` (on ${k.n} or ${k.pair})` : ''}` : k.travel ? 'a practical travel reminder' : 'a reminder',
        k.notesShow ? `notes: ${k.notesShow}` : 'notes', k.name2 ? 'title with the client’s name (Alyssa Lynn Arehart)' : '', `color ${catText(k.cat)}${k.alt ? ' (or ' + k.alt.map(catText).join(' / ') + ')' : ''}`,
        'on the Attorney’s Calendar'].filter(Boolean).join(' · ');

    // The review: on the batch's weeks, or the weeks the calendar fits best
    function review(list, opts) {
        opts = opts || {};
        const events = readEvents(list, opts.zone || 'America/New_York'), cands = [], add = (iso) => { if (iso && iso >= BASE && !cands.includes(iso)) cands.push(iso); };
        const batch = anchorForBatch(opts.batch); add(batch);
        events.forEach(x => { const d = x.allDay ? x.date : wallOf(x.s, ZONE.PST).date; if (!d) return; const t = isoMs(d), mon = isoOf(t - ((new Date(t).getUTCDay() + 6) % 7) * 864e5); add(mon); add(addD(mon, -7)); });
        if (!cands.length) add(BASE);
        let best = null;
        cands.slice(0, 30).forEach(a => { const r = reviewAt(events, a); if (!best || r.score > best.score || (r.score === best.score && r.met > best.met)) best = r; });
        best.batchAnchor = best.anchor === batch;
        return best;
    }
    return { KEY, CATS, PEOPLE, ZONE, anchorForBatch, keyAt, review };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = GcalActivity;

/* 📝 Standard Training - Calendaring Activity: the automated check of the blank calendar (gcal.html?track=activity).
   The Foundational Training grades the Day 5 Attorney Calendar Management Activity with its 📅 Calendar Activity Check and its
   Calendaring Simulator's activity review; this page grades the blank calendar with THE SAME CODE, so both platforms agree field by
   field. The two files are copied verbatim from the Foundational-Training repository (keep them in step with it):
     simulators/ft-activity/ft-calcheck.js     ← js/ft-calcheck.js      the answer key (18 events) and every field's check
     simulators/ft-activity/ft-calsim-core.js  ← js/ft-calsim-core.js   the activity review: colors, guests' emails, travel routes
                                                                         and reminders, overlaps, duplicates, and the dates (anchor)
   They were written for the Foundational Training's page (ft-calcheck.js also adds its own routes and styles there), so they run
   here in a sandbox of their own: a window and document that only they see, never this page's.

   What is checked, for every one of the activity's 18 events (1 … 10 with the court appearance's travel blocks 6.2/6.3 and the
   networking dinner's travel, arrival and overnight stay 8.2 … 8.7), and the whole calendar:
     the title; the start and end dates and times, in the event's own time zone (or the same moment in Pacific, the attorney's
     Seattle calendar); the end after the start; the time zone (the item's region: PST, MST, CST, EST); the location (and the Zoom
     link on item 3); the guests by name and their directory email addresses (instruction 9); the reminder's type and time; the key
     details in the description; the color for its kind (instruction 4); a travel block's from → to location (instruction 8) and
     its reminder (instruction 6); no overlapping events and no duplicates (instruction 7).
   Each field counts one; the score is the share of fields met (100% only when every one is). 80% passes.

   The activity's dates are July 6–15, 2026 moved by whole weeks to the trainee's own: the first Monday on or after their batch's
   Day 5 (the Batch ID is B + the start date, MMDDYY), as the Foundational Training gives them on the slides. A calendar built on
   other weeks is checked on the weeks that fit it best, so a trainee is never marked down for the whole set over the dates alone.

     GcalActivity.ready()                 loads the two files (once); resolves to true, or false when they couldn't be loaded
     GcalActivity.review(events, batch)   the review of the trainee's events (the Foundational Training's event shape:
                                          {id, title, date, allDay, span, start, dur, tz, loc, guests[], desc, meet, color, reminders[]})
*/
const GcalActivity = (function () {
    const FILES = ['/simulators/ft-activity/ft-calcheck.js', '/simulators/ft-activity/ft-calsim-core.js'];
    let box = null, loading = null;
    function sandbox() {
        const noop = () => {}, el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop });
        const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, head: { appendChild: noop }, body: { appendChild: noop }, addEventListener: noop };
        const sb = { document: doc, esc: (v) => String(v), state: {}, render: noop, toast: noop, goto: noop, ftAdminTab: noop, addEventListener: noop, console };
        sb.window = sb;
        return sb;
    }
    // each file runs with its own `window`, `document` and `globalThis` (the sandbox), and no `module`; the names it calls bare at load
    // (ftAdminTab, render, …) are the sandbox's too (`with`: the files' own code stays strict inside their functions)
    const run = (sb, code, name) => new Function('window', 'document', 'globalThis', 'module', 'self', '__sb', 'with (__sb) {\n' + code + '\n}\n//# sourceURL=' + name)(sb, sb.document, sb, undefined, sb, sb);
    function ready() {
        if (box) return Promise.resolve(true);
        if (!loading) loading = Promise.all(FILES.map(f => fetch(f, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.text(); })))
            .then(codes => { const sb = sandbox(); codes.forEach((c, i) => run(sb, c, FILES[i]));
                if (!sb.FTCalCheck || !sb.FTCalCore || !sb.FTCalCore.act) throw new Error('the activity check did not load');
                box = sb; return true; })
            .catch(e => { console.error('Calendaring Activity check:', e); loading = null; return false; });
        return loading;
    }
    const core = () => box.FTCalCore, A = () => box.FTCalCore.act, SCN = () => box.FTCalCore.SCENARIOS.find(s => s.id === 'attorney-activity');
    // the Mondays the calendar could be on: the batch's, and the week of every event and the one before it (the activity runs over two weeks)
    function anchors(events, batch) {
        const a = A(), out = [], add = (iso) => { if (iso && a.okAnchor(iso) && !out.includes(iso)) out.push(iso); };
        add(a.anchorForBatch(batch));
        events.forEach(x => { const t = Date.parse(String(x.date) + 'T12:00:00Z'); if (!Number.isFinite(t)) return;
            const mon = t - ((new Date(t).getUTCDay() + 6) % 7) * 864e5; [0, -7].forEach(k => add(new Date(mon + k * 864e5).toISOString().slice(0, 10))); });
        if (!out.length) add(a.anchorNow());
        return out.slice(0, 30);
    }
    function review(events, batch) {
        if (!box) return null;
        const a = A(), scn = SCN();
        let best = null;
        anchors(events, batch).forEach((iso, i) => {
            const r = a.withAnchor(iso, () => {
                const rv = a.review(scn, events);
                // what each expected event is, at this anchor (for the AI and the trainer: the answer key, in words)
                rv.key = a.keyList().map(o => ({ n: o.n, title: o.title, expect: a.noteOf(o) }));
                rv.span = a.spanText(a.LAST) + ', ' + a.dYear(a.LAST);
                // when each matched event is, on the attorney's Pacific calendar and in its own zone
                rv.items.forEach(it => { it.when = it.event ? a.whenOf(it.event) + ' Pacific' + (a.zoneText(it.event) ? ' · ' + a.zoneText(it.event) : '') : ''; });
                return rv;
            });
            r.anchor = iso; r.batchAnchor = i === 0 && iso === a.anchorForBatch(batch);
            if (!best || r.pct > best.pct || (r.pct === best.pct && r.score > best.score)) best = r;
        });
        return best;
    }
    return { ready, review, get loaded() { return !!box; }, get core() { return box ? core() : null; } };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = GcalActivity;

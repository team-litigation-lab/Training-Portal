/* LSH Training Portal — court deadline rules (shared by the Docket System and Court E-Filing).
   Dates are plain 'YYYY-MM-DD' strings, handled in UTC so time zones never shift a day.

   Two counting methods:
   - 'frcp'  Federal Rules of Civil Procedure 6: exclude the trigger day, count every day,
             and if the last day is a weekend or court holiday roll to the next business day
             (6(a)(1)). Service by mail adds 3 days AFTER that (6(d)); electronic service adds
             nothing. Periods counted backward roll to the previous business day (6(a)(5)).
   - 'state' The training state rules used in the Case Management course: the service days
             (mail +3, e-service +3) are added to the period first, then a weekend or holiday
             rolls forward once. */
const LR = (function () {
    // Federal court holidays (observed dates) for the training years.
    const HOLIDAYS = {
        '2026-01-01': "New Year's Day", '2026-01-19': 'Martin Luther King Jr. Day', '2026-02-16': "Washington's Birthday",
        '2026-05-25': 'Memorial Day', '2026-06-19': 'Juneteenth', '2026-07-03': 'Independence Day (observed)',
        '2026-09-07': 'Labor Day', '2026-10-12': 'Columbus Day', '2026-11-11': 'Veterans Day',
        '2026-11-26': 'Thanksgiving Day', '2026-12-25': 'Christmas Day',
        '2027-01-01': "New Year's Day", '2027-01-18': 'Martin Luther King Jr. Day', '2027-02-15': "Washington's Birthday",
        '2027-05-31': 'Memorial Day', '2027-06-18': 'Juneteenth (observed)', '2027-07-05': 'Independence Day (observed)',
        '2027-09-06': 'Labor Day', '2027-10-11': 'Columbus Day', '2027-11-11': 'Veterans Day',
        '2027-11-25': 'Thanksgiving Day', '2027-12-24': 'Christmas Day (observed)', '2027-12-31': "New Year's Day (observed)",
        '2028-01-17': 'Martin Luther King Jr. Day', '2028-02-21': "Washington's Birthday"
    };
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const toD = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
    const toS = (d) => d.toISOString().slice(0, 10);
    const add = (s, n) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return toS(d); };
    const dow = (s) => toD(s).getUTCDay();
    const why = (s) => HOLIDAYS[s] ? HOLIDAYS[s] : (dow(s) === 0 ? 'Sunday' : dow(s) === 6 ? 'Saturday' : '');
    const closed = (s) => !!why(s);
    const fmt = (s) => { if (!s) return ''; const d = toD(s); return `${DOW[d.getUTCDay()]} ${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`; };
    const short = (s) => { if (!s) return ''; const d = toD(s); return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`; };
    function roll(s, steps, dir) {
        let d = s;
        while (closed(d)) { const next = add(d, dir); steps.push(`${fmt(d)} is ${why(d)} → ${dir > 0 ? 'next' : 'previous'} court day`); d = next; }
        return d;
    }
    // The deadline rules the calculator knows. days: the period; dir: 'after' | 'before'.
    const RULES = {
        answer:        { label: 'Answer to complaint', days: 21, dir: 'after', cite: 'FRCP 12(a)(1)(A)(i)', from: 'service of the summons and complaint' },
        waiver:        { label: 'Answer after waiver of service', days: 60, dir: 'after', cite: 'FRCP 12(a)(1)(A)(ii)', from: 'the date the waiver request was sent' },
        amendedResp:   { label: 'Response to amended pleading', days: 14, dir: 'after', cite: 'FRCP 15(a)(3)', from: 'service of the amended pleading' },
        opposition:    { label: 'Opposition to a motion', days: 14, dir: 'after', cite: 'Local Rule 7.1(b) (training)', from: 'service of the motion' },
        reply:         { label: 'Reply in support of a motion', days: 7, dir: 'after', cite: 'Local Rule 7.1(c) (training)', from: 'service of the opposition' },
        discovery:     { label: 'Responses to interrogatories, document requests or requests for admission', days: 30, dir: 'after', cite: 'FRCP 33(b)(2), 34(b)(2)(A), 36(a)(3)', from: 'service of the requests' },
        amendByOrder:  { label: 'Amended pleading allowed by order', days: 14, dir: 'after', cite: 'Court order', from: 'entry of the order (the "Entered" date, not the signing date)' },
        serviceWindow: { label: 'Serve the defendant (service window)', days: 90, dir: 'after', cite: 'FRCP 4(m)', from: 'filing of the complaint' },
        appeal:        { label: 'Notice of appeal', days: 30, dir: 'after', cite: 'FRAP 4(a)(1)(A)', from: 'entry of the judgment' },
        initialDisc:   { label: 'Initial disclosures', days: 14, dir: 'after', cite: 'FRCP 26(a)(1)(C)', from: 'the Rule 26(f) conference' },
        expertsBefore: { label: 'Expert disclosures (absent an order)', days: 90, dir: 'before', cite: 'FRCP 26(a)(2)(D)(i)', from: 'the trial date' },
        sol:           { label: 'Statute of limitations (2 years, training state)', years: 2, dir: 'after', cite: 'State statute (training)', from: 'the date of the incident' },
        fixed:         { label: 'Date set by the court', fixed: true, cite: 'Court order or notice', from: '' }
    };
    const SERVICE = { personal: 'personal / hand delivery', electronic: 'electronic service (NEF / e-service)', mail: 'U.S. Mail' };

    // compute({ rule, trigger, service, method, days? }) → { due, steps[] }
    function compute(o) {
        const r = RULES[o.rule]; if (!r || !o.trigger) return { due: '', steps: [] };
        if (r.fixed) return { due: o.trigger, steps: [`Set by the court: ${fmt(o.trigger)}`] };
        const steps = [`Trigger: ${r.from || 'the event'} on ${fmt(o.trigger)}. Day 0 (not counted).`];
        const days = o.days != null ? Number(o.days) : r.days;
        let d;
        if (r.years) {
            const t = toD(o.trigger); t.setUTCFullYear(t.getUTCFullYear() + r.years); d = toS(t);
            steps.push(`+ ${r.years} years = ${fmt(d)}`);
            d = roll(d, steps, 1);
        } else if (r.dir === 'before') {
            d = add(o.trigger, -days); steps.push(`− ${days} days = ${fmt(d)} (counting backward)`);
            d = roll(d, steps, -1);
        } else if ((o.method || 'frcp') === 'frcp') {
            d = add(o.trigger, days); steps.push(`+ ${days} days = ${fmt(d)}`);
            d = roll(d, steps, 1);
            if (o.service === 'mail') { const e = add(d, 3); steps.push(`Served by mail: + 3 days after the period ends (FRCP 6(d)) = ${fmt(e)}`); d = roll(e, steps, 1); }
            else if (o.service === 'electronic') steps.push('Electronic service: no extra days (FRCP 6(d) since 2016).');
        } else {
            const extra = o.service === 'mail' || o.service === 'electronic' ? 3 : 0;
            d = add(o.trigger, days + extra);
            steps.push(extra ? `${days} days + ${extra} for ${o.service === 'mail' ? 'mail' : 'e-service'} = ${days + extra} days → ${fmt(d)}` : `+ ${days} days = ${fmt(d)}`);
            d = roll(d, steps, 1);
        }
        steps.push(`Due: ${fmt(d)}`);
        return { due: d, steps };
    }
    return { HOLIDAYS, RULES, SERVICE, compute, add, fmt, short, closed, why, dow, toD, toS };
})();

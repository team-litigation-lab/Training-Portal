/* Medical Records Requests — scenario data (John Doe v. Apex, from the Case Management course).
   Providers respond by rules in records.js; the planted problems match the CM course documents. */

/* ---------- the collection's clock ----------
   The collection always starts on the current system date, so every date a trainee works to is a
   real date: the MRR log, the follow-up dates, the attorney's date, and the dates on the documents
   produced. Nothing is read from a date typed in when this scenario was written.

   A weekend or a court holiday rolls to the next open day, because the whole simulation runs on
   business days (LR.closed, legal-rules.js) and a records department is not open on a Sunday.

   The case file moves with it. Every clinical date below is written as the date it was authored as
   and then shifted by one offset, so the accident always sits the same distance behind today: about
   five months, with treatment ending the week before the collection opens, which is the shape this
   job actually has. Without that the exercise would age — a demand going out on a two-year-old
   accident raises a statute-of-limitations problem the scenario does not teach.

   The offset is a whole number of WEEKS, so every weekday survives the move: the surgery stays on a
   Tuesday, the physical therapy sessions stay Monday/Wednesday/Friday, and no treatment lands on a
   Sunday. Relative gaps are exact, because every date is shifted by the same amount — the 14-day
   bed-rest order is still 14 days, the treatment gap the neuropsychological evaluation explains is
   still those weeks, and the prior injury is still the same years before the accident.

   Nothing downstream hard-codes a date: the prose of every chart and bill, the intake list, the
   brief and the planted findings are all built from the dates below, so they cannot drift out of
   agreement with the data the engine checks (a provider's dates of service, a bill's line dates). */
const MR_CLOCK = (function () {
    const d = new Date();
    const sys = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let start = sys, guard = 0;
    while (LR.closed(start) && guard++ < 14) start = LR.add(start, 1);     // open the collection on an open day
    let goal = start, open = 0;                                            // the attorney's date: 29 business days out
    while (open < 29) { goal = LR.add(goal, 1); if (!LR.closed(goal)) open++; }
    // The Monday the case file was authored around. Whole weeks from there to the day the collection
    // opens is the offset; it is never more than a week short, so nothing in the file is ever dated
    // in the future and the discharge always lands just before the collection starts.
    const BASE = '2026-07-06';
    const days = Math.round((LR.toD(start) - LR.toD(BASE)) / 86400000);
    /* ?anchor=authored pins the case file to the dates it was authored as, instead of moving it with
       the clock. The Case Management course hands out John Doe's actual documents as PDFs, and those
       carry the authored dates; a lesson that asks a trainee to read a date off the paper and find it
       here needs the two to agree. Everything else — the collection's own clock, the follow-up dates,
       the attorney's date, the request numbers — still runs on today either way. */
    const pinned = /(?:^|[?&])anchor=(authored|off|0)(?:&|$)/.test(location.search);
    const shift = pinned ? 0 : Math.floor(days / 7) * 7;
    return { system: sys, start, goal, shift, pinned, base: BASE, anchor: LR.add(BASE, shift) };
})();

/* Every date in the case file, moved with the case. `d` takes the date as authored and gives the
   date this run uses; the rest are the ways the chart, the bills and the findings say it. Only
   literal authored dates are ever passed in, so nothing is shifted twice. */
const MR_D = (function () {
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const d = (iso) => LR.add(iso, MR_CLOCK.shift);     // the date this run uses
    const mdy = (iso) => LR.short(d(iso));              // 02/14/2026
    const md = (iso) => LR.short(d(iso)).slice(0, 5);   // 02/14
    const yr = (iso) => d(iso).slice(0, 4);             // 2026
    const mon = (iso) => MONTHS[Number(d(iso).slice(5, 7)) - 1];
    return { d, mdy, md, yr, mon };
})();

/* The case file's own dates, as authored. Shifted through MR_D, never read raw. */
const MR_CASE = {
    dol: '2026-02-14',            // the collision: scene, transport, ER, CT, the bed-rest order
    bedRestTo: '2026-02-28',      // the 14-day strict bed-rest order runs to here
    emc: '2026-03-01',            // Dr. Spine's emergency-medical-condition attestation
    mri: '2026-03-15',            // the lumbar MRI (and the brain MRI that is not this accident's)
    chiro: ['2026-03-15', '2026-03-17', '2026-03-18', '2026-03-20', '2026-03-21', '2026-03-23', '2026-03-24',
        '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-04-02'],
    pt: ['2026-03-20', '2026-03-23', '2026-03-25', '2026-03-27', '2026-03-30', '2026-04-02'],
    gapFrom: '2026-04-01', gapTo: '2026-04-15',   // the treatment gap the evaluation explains
    neuroPsych: '2026-04-18',     // the neuropsychological evaluation
    emg: '2026-04-20',
    surgery: '2026-05-12', surgeryTo: '2026-05-13',
    postOp1: '2026-05-28', postOp2: '2026-06-24',
    riverview: '2026-06-24',      // the post-op imaging Dr. Spine ordered elsewhere
    permanency: '2026-06-15',
    discharge: '2026-07-01',      // treatment ends, with permanent restrictions
    rxDates: ['2026-02-14', '2026-02-28', '2026-05-13', '2026-05-13', '2026-06-10'],
    priorFrom: '2018-08-12', priorTo: '2018-09-15',       // the resolved lumbar strain the defense will use
    migFrom: '2021-03-10', migTo: '2021-11-22',           // the migraine history the brain MRI belongs to
    dermFrom: '2019-04-02', dermTo: '2019-06-10',         // unrelated: requesting it costs money and invites trouble
    dob: '1980-08-14'             // a birthday does not move with the case
};

const D = MR_D.d, MDY = MR_D.mdy, MD = MR_D.md, YR = MR_D.yr, MON = MR_D.mon, C = MR_CASE;

/* The date of birth the MRI report gets wrong: someone typed the date of loss into the date-of-birth
   box and kept the birth year, which is the error this plants. If the accident ever falls on the
   client's birthday the two would match and there would be nothing to spot, so the day before is
   used instead. */
const MR_WRONG_DOB = (function () {
    const dol = D(C.dol);                                      // the date of loss, as this run dates it
    const composed = C.dob.slice(0, 4) + dol.slice(4);         // its month and day, with the birth year
    return LR.short(composed === C.dob ? C.dob.slice(0, 4) + LR.add(dol, -1).slice(4) : composed);
})();

const MR_SCENARIO = {
    id: 'doe', title: 'John Doe v. Apex — collect records and bills for the demand',
    start: MR_CLOCK.start, goal: MR_CLOCK.goal, system: MR_CLOCK.system, shift: MR_CLOCK.shift,
    client: { name: 'John Doe', dob: C.dob, dol: D(C.dol), file: `MVA-JD-${YR(C.dol)}-001`, address: '4412 Oak Lane, Riverview Park, ST 90211' },
    brief: `Treatment has ended (discharged ${MDY(C.discharge)} with permanent restrictions). The attorney wants complete medical records AND `
        + `itemized bills from every accident-related provider, plus the ${YR(C.priorFrom)} prior-injury records, logged to the case file by `
        + `${LR.fmt(MR_CLOCK.goal)} so the demand can go out. Nothing has been requested yet.`,
    intake: [`Metro Center EMS (Medic 14): scene and transport, ${MDY(C.dol)}`,
        `Metro General Hospital: ER, CT, 14-day bed-rest order, and the ${MDY(C.surgery)} microdiscectomy`,
        `Metro Radiology & Imaging: lumbar MRI, ${MDY(C.mri)}`,
        'Dr. Sarah Spine (Spine & Ortho Associates): EMC attestation, surgery and follow-up',
        `Mark Motion, DPT (Motion Physical Therapy): PT, ${MD(C.pt[0])}–${MDY(C.pt[5])}`,
        `Dr. Al Lign, DC (Align Chiropractic): chiropractic, ${MON(C.chiro[0])}–${MON(C.chiro[13])} ${YR(C.chiro[13])}`,
        `Dr. Mindy Health, PhD: neuropsychological evaluation, ${MDY(C.neuroPsych)} (explains the treatment gap)`,
        `Dr. Neil Ron (Metro Neurology): EMG ${MDY(C.emg)} and permanency rating ${MDY(C.permanency)}`,
        `Prior injury: ${YR(C.priorFrom)} lumbar strain treated at Workplace Health Clinic (${MD(C.priorFrom)}–${MDY(C.priorTo)})`,
        `Prior history: chronic migraines diagnosed in ${YR(C.migFrom)} at Metro Headache Clinic (the defense will ask; the firm needs the records first)`]
};

// Record types a request can ask for.
const MR_TYPES = {
    records: 'Medical records (complete chart for the dates of service)',
    bill: 'Itemized billing statement (UB-04 / CMS-1500 with CPT codes)',
    images: 'Imaging on disc (DICOM)',
    psych: 'Psychotherapy notes',
    cert: 'Certification of records (custodian affidavit)'
};

// one itemized line of a bill, on a date from the case file
const L = (iso, code, desc, amount) => ({ dos: D(iso), code, desc, amount });

/* Providers. dos: the dates of service they hold. needs: which record types count toward the
   objectives. fee: how they charge. quirks drive the simulation (see records.js). */
const MR_PROVIDERS = [
    { id: 'ems', name: 'Metro Center EMS (Medic 14)', type: 'Ambulance', dept: 'Records Custodian', method: 'Fax (555) 310-2200', days: 4,
      dos: [D(C.dol), D(C.dol)], needs: ['records', 'bill'], fee: { flat: 150, pages: 6 }, excessive: true,
      delivered: { records: { pages: 6, text: 'Run report: GCS 14, 10/10 back pain, left-leg numbness; extrication by Jaws of Life (freed 15:05); ALS transport to Metro General Level 1 Trauma.' },
                   bill: { pages: 1, text: 'ALS emergency transport $1,850.00. (The draft demand calls this a "Fire Dept extrication" charge. It is the EMS ALS transport.)',
                           lines: [L(C.dol, 'A0427', 'ALS emergency transport, base rate (Medic 14)', 1450.00),
                                   L(C.dol, 'A0425', 'Ground mileage, 8 loaded miles', 400.00)] } } },
    { id: 'him', name: 'Metro General Hospital — Health Information Management (medical records)', type: 'Hospital (records)', dept: 'HIM / Release of Information', method: 'Online release-of-information portal', days: 6,
      dos: [D(C.dol), D(C.surgeryTo)], needs: ['records'], fee: { base: 25, perPage: 0.25, pages: 412 }, billsElsewhere: 'pfs',
      delivered: { records: { pages: 412, text: `ER record ${MD(C.dol)} (12 cm facial laceration, 42 sutures; CT C5-C6 disc displacement), 14-day strict bed-rest order (${MD(C.dol)}–${MD(C.bedRestTo)}), labs (negative BAC and drug screen), ${MD(C.surgery)} microdiscectomy operative record: surgeon Dr. Sarah Spine; anesthesia Dr. Victor Vapor, Independent Anesthesia Group #44.` } } },
    { id: 'pfs', name: 'Metro General Hospital — Patient Financial Services (billing)', type: 'Hospital (billing)', dept: 'Patient Financial Services', method: 'Fax (555) 310-4488', days: 5,
      dos: [D(C.dol), D(C.surgeryTo)], needs: ['bill'], fee: null,
      delivered: { bill: { pages: 14, text: `Itemized UB-04: ER ${MD(C.dol)} $12,700.00; surgical admission ${MD(C.surgery)}–${MD(C.surgeryTo)} facility charges $38,400.00. Note: professional services by independent providers (anesthesia: Independent Anesthesia Group #44) are billed separately and are not included.`,
                           lines: [L(C.dol, '0450', 'Emergency department, level 5', 4800.00),
                                   L(C.dol, '0320', 'CT cervical spine without contrast', 3100.00),
                                   L(C.dol, '0360', 'Laceration repair, 12 cm facial, 42 sutures', 2900.00),
                                   L(C.dol, '0300', 'Laboratory: CBC, metabolic panel, BAC, drug screen', 1900.00),
                                   L(C.surgery, '0360', 'Operating room services, lumbar microdiscectomy', 21400.00),
                                   L(C.surgery, '0370', 'Anesthesia facility services', 2800.00),
                                   L(C.surgery, '0250', 'Pharmacy and supplies', 4600.00),
                                   L(C.surgery, '0110', `Room and board, surgical, 1 night ${MD(C.surgery)}-${MD(C.surgeryTo)}`, 9600.00)] } } },
    { id: 'rad', name: 'Metro Radiology & Imaging', type: 'Imaging center', dept: 'Film Library / Records', method: 'Fax (555) 310-7710', days: 5,
      dos: [D(C.mri), D(C.mri)], needs: ['records', 'bill'], fee: { base: 25, perPage: 0.25, pages: 8 },
      delivered: { records: { pages: 4, text: `MRI lumbar spine ${MDY(C.mri)}: 5 mm L4-L5 protrusion impinging the left L5 nerve root. Patient DOB on report: ${MR_WRONG_DOB}. Referring: Dr. Aris Thorne.` },
                   bill: { pages: 2, text: `Invoice: MRI lumbar spine w/o contrast (CPT 72148) ${MDY(C.mri)} $1,850.00; MRI brain w/o contrast (CPT 70551) ${MDY(C.mri)} $2,100.00.`,
                           lines: [L(C.mri, '72148', 'MRI lumbar spine without contrast', 1850.00),
                                   L(C.mri, '70551', 'MRI brain without contrast', 2100.00)] },
                   images: { pages: 0, text: 'DICOM disc: lumbar MRI series (brain series excluded as not requested).' } } },
    { id: 'spine', name: 'Dr. Sarah Spine — Spine & Ortho Associates', type: 'Orthopedic spine surgeon', dept: 'Medical Records', method: 'Secure email', days: 5,
      dos: [D(C.emc), D(C.discharge)], needs: ['records', 'bill'], fee: { base: 25, perPage: 0.25, pages: 64 },
      delivered: { records: { pages: 64, text: `EMC attestation ${MD(C.emc)}; surgical consult; ${MD(C.surgery)} microdiscectomy; post-op visits; ${MD(C.riverview)} post-op follow-up imaging ordered at Riverview Radiology; discharge ${MD(C.discharge)} with permanent light-duty restrictions (≤20 lbs, 45-minute sitting). Return-to-work note on file.` },
                   bill: { pages: 3, text: `Itemized: EMC evaluation ${MD(C.emc)} $450.00; surgeon fee (CPT 63030) ${MD(C.surgery)} $9,800.00; post-op visits $900.00.`,
                           lines: [L(C.emc, '99204', 'EMC evaluation and attestation, new patient', 450.00),
                                   L(C.surgery, '63030', 'Lumbar microdiscectomy, surgeon fee', 9800.00),
                                   L(C.postOp1, '99213', 'Post-operative office visit', 300.00),
                                   L(C.postOp2, '99213', 'Post-operative office visit', 300.00),
                                   L(C.discharge, '99213', 'Discharge visit, permanent restrictions assessed', 300.00)] } } },
    { id: 'pt', name: 'Mark Motion, DPT — Motion Physical Therapy', type: 'Physical therapy', dept: 'Front Desk / Records', method: 'Fax (555) 310-9020', days: 4,
      dos: [D(C.pt[0]), D(C.pt[5])], needs: ['records', 'bill'], fee: null,
      delivered: { records: { pages: 22, text: `PT evaluation and sessions #1–#6: worsening radiculopathy; session #5 notes foot drop (hallux 3/5); session #6 notes clinical withdrawal before the ${MD(C.gapFrom)} gap.` },
                   bill: { pages: 2, text: 'Ledger: 6 sessions, $1,440.00 total.',
                           lines: C.pt.map((iso, i) => L(iso, i === 0 ? '97161' : '97110', i === 0 ? 'Physical therapy evaluation' : `Therapeutic exercise, session #${i + 1}`, 240.00)) } } },
    { id: 'chiro', name: 'Dr. Al Lign, DC — Align Chiropractic', type: 'Chiropractic', dept: 'Office Manager', method: 'Fax (555) 310-5566', days: 6, slow: true,
      dos: [D(C.chiro[0]), D(C.chiro[13])], needs: ['records', 'bill'], fee: null, partialLedger: true,
      delivered: { records: { pages: 18, text: `Chiropractic visits #1–#14, including visits #13 and #14 on ${MD(C.chiro[12])} and ${MDY(C.chiro[13])}; plateau noted at visit #12.` },
                   bill: { pages: 1, text: `Billing statement: ${MDY(C.chiro[0])} $160.00; ${MDY(C.chiro[1])} $160.00. Total $320.00. (Only 2 of 14 visits are listed.)`,
                           lines: C.chiro.slice(0, 2).map((iso, i) => L(iso, '98941', `Chiropractic manipulation, 3-4 regions, visit #${i + 1}`, 160.00)) },
                   billComplete: { pages: 2, text: `Complete ledger: 14 visits ${MD(C.chiro[0])}–${MDY(C.chiro[13])}, total $2,240.00.`,
                           lines: C.chiro.map((iso, i) => L(iso, '98941', `Chiropractic manipulation, visit #${i + 1}${i === 11 ? ', plateau noted' : ''}`, 160.00)) } } },
    { id: 'psych', name: 'Dr. Mindy Health, PhD — Mind & Health Psychology', type: 'Neuropsychology', dept: 'Records', method: 'Mail', days: 7,
      dos: [D(C.neuroPsych), D(C.neuroPsych)], needs: ['records', 'bill'], fee: { base: 25, perPage: 0.25, pages: 12 },
      delivered: { records: { pages: 12, text: `Neuropsychological evaluation ${MDY(C.neuroPsych)}: PTSD with acute dissociative withdrawal after suture removal; explains the ${MD(C.gapFrom)}–${MD(C.gapTo)} treatment gap.` },
                   bill: { pages: 1, text: 'Evaluation (CPT 96132/96133) $1,650.00.',
                           lines: [L(C.neuroPsych, '96132', 'Neuropsychological testing evaluation, first hour', 650.00),
                                   L(C.neuroPsych, '96133', 'Neuropsychological testing evaluation, each additional hour x2', 1000.00)] } } },
    { id: 'neuro', name: 'Dr. Neil Ron — Metro Neurology', type: 'Neurology', dept: 'Medical Records', method: 'Fax (555) 310-3344', days: 5,
      dos: [D(C.emg), D(C.permanency)], needs: ['records', 'bill'], fee: { base: 25, perPage: 0.25, pages: 16 },
      delivered: { records: { pages: 16, text: `EMG ${MDY(C.emg)}: active denervation, left L5. Permanency evaluation ${MDY(C.permanency)}: permanent L5/S1 deficit, 5% whole person impairment (AMA Guides, 6th ed.).` },
                   bill: { pages: 1, text: 'EMG/NCS $1,200.00; permanency evaluation $650.00.',
                           lines: [L(C.emg, '95886', 'Needle EMG with nerve conduction study, lower extremity', 1200.00),
                                   L(C.permanency, '99455', 'Permanency evaluation and impairment rating', 650.00)] } } },
    { id: 'anes', name: 'Independent Anesthesia Group #44', type: 'Anesthesia (independent)', dept: 'Billing Office', method: 'Fax (555) 310-6644', days: 4, hidden: 'him',
      dos: [D(C.surgery), D(C.surgery)], needs: ['bill'], fee: null,
      delivered: { bill: { pages: 1, text: `Anesthesia for lumbar microdiscectomy ${MDY(C.surgery)}, Dr. Victor Vapor: $3,150.00.`,
                           lines: [L(C.surgery, '00630', 'Anesthesia for lumbar laminectomy, 3.5 hours', 2950.00),
                                   L(C.surgery, '99100', 'Qualifying circumstance, monitored anesthesia', 200.00)] },
                   records: { pages: 3, text: `Anesthesia record ${MDY(C.surgery)}.` } } },
    { id: 'river', name: 'Riverview Radiology', type: 'Imaging center', dept: 'Records', method: 'Fax (555) 310-8800', days: 4, hidden: 'spine',
      dos: [D(C.riverview), D(C.riverview)], needs: ['records', 'bill'], fee: null,
      delivered: { records: { pages: 3, text: `Post-op lumbar imaging ${MDY(C.riverview)}, ordered by Dr. Sarah Spine.` },
                   bill: { pages: 1, text: 'Post-op imaging $1,200.00. (Not on the firm\'s ledger. Missing it would surface after settlement as a late bill the client owes.)',
                           lines: [L(C.riverview, '72148', 'MRI lumbar spine without contrast, post-operative', 1200.00)] } } },
    { id: 'whc', name: 'Workplace Health Clinic', type: 'Occupational health', dept: 'Records', method: 'Mail', days: 6, prior: true,
      dos: [D(C.priorFrom), D(C.priorTo)], needs: ['records'], fee: { base: 25, perPage: 0.25, pages: 9 },
      delivered: { records: { pages: 9, text: `${MDY(C.priorFrom)} L4-L5 lumbar strain lifting crates (6/10, radiating to left buttock); PT x4 weeks; ${MDY(C.priorTo)} resolved, discharged at MMI with no permanent restrictions; no MRI ever taken.` } } },
    { id: 'mig', name: 'Metro Headache Clinic', type: 'Neurology (headache)', dept: 'Medical Records', method: 'Fax (555) 310-2727', days: 5, prior: true,
      dos: [D(C.migFrom), D(C.migTo)], needs: ['records'], fee: { base: 25, perPage: 0.25, pages: 14 },
      delivered: { records: { pages: 14, text: `${YR(C.migFrom)}: chronic migraine diagnosed; prophylactic medication; brain MRI ${YR(C.migFrom)} normal. No neck or back complaints at any visit. (Supports keeping the ${YR(C.mri)} brain-MRI charge out of the accident specials.)` } } },
    { id: 'derm', name: 'Metro Dermatology', type: 'Dermatology', dept: 'Records', method: 'Fax (555) 310-1212', days: 5, unrelated: true,
      dos: [D(C.dermFrom), D(C.dermTo)], needs: [], fee: { base: 25, perPage: 0.25, pages: 11 },
      delivered: { records: { pages: 11, text: `${YR(C.dermFrom)} acne treatment. Unrelated to the accident.` } } },
    { id: 'pharm', name: 'City Pharmacy', type: 'Pharmacy', dept: 'Pharmacy Records', method: 'Fax (555) 310-4040', days: 3, optional: true,
      dos: [D(C.dol), D(C.discharge)], needs: [], fee: null,
      delivered: { records: { pages: 4, text: `Prescription history ${MD(C.dol)}–${MDY(C.discharge)}: pain management and muscle relaxants.` },
                   bill: { pages: 1, text: 'Out-of-pocket prescription costs $312.40.',
                           lines: [L(C.rxDates[0], 'J-RX', 'Hydrocodone-acetaminophen 5-325, 30 tablets', 48.20),
                                   L(C.rxDates[1], 'J-RX', 'Cyclobenzaprine 10 mg, 30 tablets', 36.00),
                                   L(C.rxDates[2], 'J-RX', 'Oxycodone 5 mg, 20 tablets, post-operative', 94.80),
                                   L(C.rxDates[3], 'J-RX', 'Methocarbamol 750 mg, 60 tablets', 52.60),
                                   L(C.rxDates[4], 'J-RX', 'Gabapentin 300 mg, 90 capsules', 80.80)] } } }
];

// What reviewers should flag in delivered records (the real problems), plus plausible decoys.
const MR_FINDINGS = [
    { id: 'dob', provider: 'rad', type: 'records', real: true, text: `The MRI report shows the wrong date of birth (${MR_WRONG_DOB}; John was born ${LR.short(C.dob)}).` },
    { id: 'brain', provider: 'rad', type: 'bill', real: true, text: `The invoice includes a brain MRI ($2,100), which relates to the ${YR(C.migFrom)} migraine history, not the accident.` },
    { id: 'ledger', provider: 'chiro', type: 'bill', real: true, text: 'The chiropractic ledger lists only 2 of 14 visits: request the complete ledger.' },
    { id: 'anes', provider: 'pfs', type: 'bill', real: true, text: 'The hospital bill excludes anesthesia: request the bill from Independent Anesthesia Group #44.' },
    { id: 'river', provider: 'spine', type: 'records', real: true, text: 'Dr. Spine ordered post-op imaging at Riverview Radiology: request those records and bills too.' },
    { id: 'thorne', provider: 'rad', type: 'records', real: true, text: 'The referring physician on the MRI (Dr. Aris Thorne) isn\'t one of John\'s treaters: verify.' },
    { id: 'x1', provider: 'pt', type: 'records', real: false, text: 'The PT notes are unsigned by the therapist.' },
    { id: 'x2', provider: 'neuro', type: 'records', real: false, text: 'The EMG date conflicts with the MRI date.' },
    { id: 'x3', provider: 'ems', type: 'records', real: false, text: 'The run report lists the wrong date of loss.' }
];

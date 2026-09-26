/* Medical Records Requests — scenario data (John Doe v. Apex, from the Case Management course).
   Providers respond by rules in records.js; the planted problems match the CM course documents. */
const MR_SCENARIO = {
    id: 'doe', title: 'John Doe v. Apex — collect records and bills for the demand',
    start: '2026-07-06', goal: '2026-08-14',
    client: { name: 'John Doe', dob: '1980-08-14', dol: '2026-02-14', file: 'MVA-JD-2026-001', address: '4412 Oak Lane, Riverview Park, ST 90211' },
    brief: 'Treatment has ended (discharged 07/01/2026 with permanent restrictions). The attorney wants complete medical records AND itemized bills from every accident-related provider, plus the 2018 prior-injury records, logged to the case file by Friday 08/14/2026 so the demand can go out. Nothing has been requested yet.',
    intake: ['Metro Center EMS (Medic 14): scene and transport, 02/14/2026', 'Metro General Hospital: ER, CT, 14-day bed-rest order, and the 05/12/2026 microdiscectomy',
        'Metro Radiology & Imaging: lumbar MRI, 03/15/2026', 'Dr. Sarah Spine (Spine & Ortho Associates): EMC attestation, surgery and follow-up', 'Mark Motion, DPT (Motion Physical Therapy): PT, 03/20–04/02/2026',
        'Dr. Al Lign, DC (Align Chiropractic): chiropractic, March–April 2026', 'Dr. Mindy Health, PhD: neuropsychological evaluation, 04/18/2026 (explains the treatment gap)',
        'Dr. Neil Ron (Metro Neurology): EMG 04/20/2026 and permanency rating 06/15/2026', 'Prior injury: 2018 lumbar strain treated at Workplace Health Clinic (08/12–09/15/2018)',
        'Prior history: chronic migraines diagnosed in 2021 at Metro Headache Clinic (the defense will ask; the firm needs the records first)']
};

// Record types a request can ask for.
const MR_TYPES = {
    records: 'Medical records (complete chart for the dates of service)',
    bill: 'Itemized billing statement (UB-04 / CMS-1500 with CPT codes)',
    images: 'Imaging on disc (DICOM)',
    psych: 'Psychotherapy notes',
    cert: 'Certification of records (custodian affidavit)'
};

/* Providers. dos: the dates of service they hold. needs: which record types count toward the
   objectives. fee: how they charge. quirks drive the simulation (see records.js). */
const MR_PROVIDERS = [
    { id: 'ems', name: 'Metro Center EMS (Medic 14)', type: 'Ambulance', dept: 'Records Custodian', method: 'Fax (555) 310-2200', days: 4,
      dos: ['2026-02-14', '2026-02-14'], needs: ['records', 'bill'], fee: { flat: 150, pages: 6 }, excessive: true,
      delivered: { records: { pages: 6, text: 'Run report: GCS 14, 10/10 back pain, left-leg numbness; extrication by Jaws of Life (freed 15:05); ALS transport to Metro General Level 1 Trauma.' },
                   bill: { pages: 1, text: 'ALS emergency transport $1,850.00. (The draft demand calls this a "Fire Dept extrication" charge. It is the EMS ALS transport.)' } } },
    { id: 'him', name: 'Metro General Hospital — Health Information Management (medical records)', type: 'Hospital (records)', dept: 'HIM / Release of Information', method: 'Online release-of-information portal', days: 6,
      dos: ['2026-02-14', '2026-05-13'], needs: ['records'], fee: { base: 25, perPage: 0.25, pages: 412 }, billsElsewhere: 'pfs',
      delivered: { records: { pages: 412, text: 'ER record 02/14 (12 cm facial laceration, 42 sutures; CT C5-C6 disc displacement), 14-day strict bed-rest order (02/14–02/28), labs (negative BAC and drug screen), 05/12 microdiscectomy operative record: surgeon Dr. Sarah Spine; anesthesia Dr. Victor Vapor, Independent Anesthesia Group #44.' } } },
    { id: 'pfs', name: 'Metro General Hospital — Patient Financial Services (billing)', type: 'Hospital (billing)', dept: 'Patient Financial Services', method: 'Fax (555) 310-4488', days: 5,
      dos: ['2026-02-14', '2026-05-13'], needs: ['bill'], fee: null,
      delivered: { bill: { pages: 14, text: 'Itemized UB-04: ER 02/14 $12,700.00; surgical admission 05/12–05/13 facility charges $38,400.00. Note: professional services by independent providers (anesthesia: Independent Anesthesia Group #44) are billed separately and are not included.' } } },
    { id: 'rad', name: 'Metro Radiology & Imaging', type: 'Imaging center', dept: 'Film Library / Records', method: 'Fax (555) 310-7710', days: 5,
      dos: ['2026-03-15', '2026-03-15'], needs: ['records', 'bill'], fee: { base: 25, perPage: 0.25, pages: 8 },
      delivered: { records: { pages: 4, text: 'MRI lumbar spine 03/15/2026: 5 mm L4-L5 protrusion impinging the left L5 nerve root. Patient DOB on report: 02/14/1980. Referring: Dr. Aris Thorne.' },
                   bill: { pages: 2, text: 'Invoice: MRI lumbar spine w/o contrast (CPT 72148) 03/15/2026 $1,850.00; MRI brain w/o contrast (CPT 70551) 03/15/2026 $2,100.00.' },
                   images: { pages: 0, text: 'DICOM disc: lumbar MRI series (brain series excluded as not requested).' } } },
    { id: 'spine', name: 'Dr. Sarah Spine — Spine & Ortho Associates', type: 'Orthopedic spine surgeon', dept: 'Medical Records', method: 'Secure email', days: 5,
      dos: ['2026-03-01', '2026-07-01'], needs: ['records', 'bill'], fee: { base: 25, perPage: 0.25, pages: 64 },
      delivered: { records: { pages: 64, text: 'EMC attestation 03/01; surgical consult; 05/12 microdiscectomy; post-op visits; 06/24 post-op follow-up imaging ordered at Riverview Radiology; discharge 07/01 with permanent light-duty restrictions (≤20 lbs, 45-minute sitting). Return-to-work note on file.' },
                   bill: { pages: 3, text: 'Itemized: EMC evaluation 03/01 $450.00; surgeon fee (CPT 63030) 05/12 $9,800.00; post-op visits $900.00.' } } },
    { id: 'pt', name: 'Mark Motion, DPT — Motion Physical Therapy', type: 'Physical therapy', dept: 'Front Desk / Records', method: 'Fax (555) 310-9020', days: 4,
      dos: ['2026-03-20', '2026-04-02'], needs: ['records', 'bill'], fee: null,
      delivered: { records: { pages: 22, text: 'PT evaluation and sessions #1–#6: worsening radiculopathy; session #5 notes foot drop (hallux 3/5); session #6 notes clinical withdrawal before the 04/01 gap.' },
                   bill: { pages: 2, text: 'Ledger: 6 sessions, $1,440.00 total.' } } },
    { id: 'chiro', name: 'Dr. Al Lign, DC — Align Chiropractic', type: 'Chiropractic', dept: 'Office Manager', method: 'Fax (555) 310-5566', days: 6, slow: true,
      dos: ['2026-03-15', '2026-04-02'], needs: ['records', 'bill'], fee: null, partialLedger: true,
      delivered: { records: { pages: 18, text: 'Chiropractic visits #1–#14, including visits #13 and #14 on 03/30 and 04/02/2026; plateau noted at visit #12.' },
                   bill: { pages: 1, text: 'Billing statement: 03/15/2026 $160.00; 03/17/2026 $160.00. Total $320.00. (Only 2 of 14 visits are listed.)' },
                   billComplete: { pages: 2, text: 'Complete ledger: 14 visits 03/15–04/02/2026, total $2,240.00.' } } },
    { id: 'psych', name: 'Dr. Mindy Health, PhD — Mind & Health Psychology', type: 'Neuropsychology', dept: 'Records', method: 'Mail', days: 7,
      dos: ['2026-04-18', '2026-04-18'], needs: ['records', 'bill'], fee: { base: 25, perPage: 0.25, pages: 12 },
      delivered: { records: { pages: 12, text: 'Neuropsychological evaluation 04/18/2026: PTSD with acute dissociative withdrawal after suture removal; explains the 04/01–04/15 treatment gap.' },
                   bill: { pages: 1, text: 'Evaluation (CPT 96132/96133) $1,650.00.' } } },
    { id: 'neuro', name: 'Dr. Neil Ron — Metro Neurology', type: 'Neurology', dept: 'Medical Records', method: 'Fax (555) 310-3344', days: 5,
      dos: ['2026-04-20', '2026-06-15'], needs: ['records', 'bill'], fee: { base: 25, perPage: 0.25, pages: 16 },
      delivered: { records: { pages: 16, text: 'EMG 04/20/2026: active denervation, left L5. Permanency evaluation 06/15/2026: permanent L5/S1 deficit, 5% whole person impairment (AMA Guides, 6th ed.).' },
                   bill: { pages: 1, text: 'EMG/NCS $1,200.00; permanency evaluation $650.00.' } } },
    { id: 'anes', name: 'Independent Anesthesia Group #44', type: 'Anesthesia (independent)', dept: 'Billing Office', method: 'Fax (555) 310-6644', days: 4, hidden: 'him',
      dos: ['2026-05-12', '2026-05-12'], needs: ['bill'], fee: null,
      delivered: { bill: { pages: 1, text: 'Anesthesia for lumbar microdiscectomy 05/12/2026, Dr. Victor Vapor: $3,150.00.' },
                   records: { pages: 3, text: 'Anesthesia record 05/12/2026.' } } },
    { id: 'river', name: 'Riverview Radiology', type: 'Imaging center', dept: 'Records', method: 'Fax (555) 310-8800', days: 4, hidden: 'spine',
      dos: ['2026-06-24', '2026-06-24'], needs: ['records', 'bill'], fee: null,
      delivered: { records: { pages: 3, text: 'Post-op lumbar imaging 06/24/2026, ordered by Dr. Sarah Spine.' },
                   bill: { pages: 1, text: 'Post-op imaging $1,200.00. (Not on the firm\'s ledger. Missing it would surface after settlement as a late bill the client owes.)' } } },
    { id: 'whc', name: 'Workplace Health Clinic', type: 'Occupational health', dept: 'Records', method: 'Mail', days: 6, prior: true,
      dos: ['2018-08-12', '2018-09-15'], needs: ['records'], fee: { base: 25, perPage: 0.25, pages: 9 },
      delivered: { records: { pages: 9, text: '08/12/2018 L4-L5 lumbar strain lifting crates (6/10, radiating to left buttock); PT x4 weeks; 09/15/2018 resolved, discharged at MMI with no permanent restrictions; no MRI ever taken.' } } },
    { id: 'mig', name: 'Metro Headache Clinic', type: 'Neurology (headache)', dept: 'Medical Records', method: 'Fax (555) 310-2727', days: 5, prior: true,
      dos: ['2021-03-10', '2021-11-22'], needs: ['records'], fee: { base: 25, perPage: 0.25, pages: 14 },
      delivered: { records: { pages: 14, text: '2021: chronic migraine diagnosed; prophylactic medication; brain MRI 2021 normal. No neck or back complaints at any visit. (Supports keeping the 2026 brain-MRI charge out of the accident specials.)' } } },
    { id: 'derm', name: 'Metro Dermatology', type: 'Dermatology', dept: 'Records', method: 'Fax (555) 310-1212', days: 5, unrelated: true,
      dos: ['2019-04-02', '2019-06-10'], needs: [], fee: { base: 25, perPage: 0.25, pages: 11 },
      delivered: { records: { pages: 11, text: '2019 acne treatment. Unrelated to the accident.' } } },
    { id: 'pharm', name: 'City Pharmacy', type: 'Pharmacy', dept: 'Pharmacy Records', method: 'Fax (555) 310-4040', days: 3, optional: true,
      dos: ['2026-02-14', '2026-07-01'], needs: [], fee: null,
      delivered: { records: { pages: 4, text: 'Prescription history 02/14–07/01/2026: pain management and muscle relaxants.' }, bill: { pages: 1, text: 'Out-of-pocket prescription costs $312.40.' } } }
];

// What reviewers should flag in delivered records (the real problems), plus plausible decoys.
const MR_FINDINGS = [
    { id: 'dob', provider: 'rad', type: 'records', real: true, text: 'The MRI report shows the wrong date of birth (02/14/1980; John was born 08/14/1980).' },
    { id: 'brain', provider: 'rad', type: 'bill', real: true, text: 'The invoice includes a brain MRI ($2,100), which relates to the 2021 migraine history, not the accident.' },
    { id: 'ledger', provider: 'chiro', type: 'bill', real: true, text: 'The chiropractic ledger lists only 2 of 14 visits: request the complete ledger.' },
    { id: 'anes', provider: 'pfs', type: 'bill', real: true, text: 'The hospital bill excludes anesthesia: request the bill from Independent Anesthesia Group #44.' },
    { id: 'river', provider: 'spine', type: 'records', real: true, text: 'Dr. Spine ordered post-op imaging at Riverview Radiology: request those records and bills too.' },
    { id: 'thorne', provider: 'rad', type: 'records', real: true, text: 'The referring physician on the MRI (Dr. Aris Thorne) isn\'t one of John\'s treaters: verify.' },
    { id: 'x1', provider: 'pt', type: 'records', real: false, text: 'The PT notes are unsigned by the therapist.' },
    { id: 'x2', provider: 'neuro', type: 'records', real: false, text: 'The EMG date conflicts with the MRI date.' },
    { id: 'x3', provider: 'ems', type: 'records', real: false, text: 'The run report lists the wrong date of loss.' }
];

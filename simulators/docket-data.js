/* Docket System data: the court records (practice cases, including the five from the LSH
   docket registry prototype) and the docketing assignments (an inbox of notices to docket). */
const DK_ATTORNEYS = ['A. Rivera (Lead Attorney)', 'M. Chen (Associate)', 'J. Patel (Paralegal)', 'Docketing Dept.'];

// Entry categories, as in the prototype's registry.
const DK_ENTRY_TYPES = {
    'Complaint': 'PLEADING', 'Amended Complaint': 'PLEADING', 'Answer': 'PLEADING', 'Answer to Amended Complaint': 'PLEADING', 'Counterclaim': 'PLEADING',
    'Summons Issued': 'NOTICE', 'Return of Service': 'NOTICE', 'Notice of Hearing': 'NOTICE', 'Notice of Appeal': 'NOTICE', 'Notice of Appearance': 'NOTICE', 'Notice of Deposition': 'NOTICE',
    'Motion to Dismiss': 'MOTION', 'Motion for Summary Judgment': 'MOTION', 'Motion to Compel': 'MOTION', 'Motion for Continuance': 'MOTION', 'Response in Opposition': 'MOTION', 'Reply Brief': 'MOTION',
    'Order': 'ORDER', 'Scheduling Order': 'ORDER', 'Protective Order': 'ORDER', 'Judgment': 'ORDER',
    'Stipulation of Dismissal': 'STIPULATION', 'Stipulation to Extend Time': 'STIPULATION',
    'Minute Entry': 'MINUTE'
};

const DK_CASES = [
    { id: 'harlow', caseNumber: '2:26-cv-00318-PI', court: 'U.S. District Court — District of Metro State (Training)', caption: 'Dana Harlow v. Tri-County Transit Authority',
      type: 'Civil — Personal Injury', nature: '350 Motor Vehicle', cause: '28:1332 Diversity — Personal Injury', jury: 'Plaintiff', judge: 'Hon. P. Ibarra', magistrate: 'Magistrate Judge L. Soto',
      filed: '2026-02-20', status: 'Active', ourClient: 'Dana Harlow (Plaintiff)', method: 'frcp',
      parties: [ { role: 'Plaintiff', name: 'Dana Harlow', counsel: 'A. Rivera, LSH Partner Firm — LEAD ATTORNEY, ATTORNEY TO BE NOTICED' },
                 { role: 'Defendant', name: 'Tri-County Transit Authority', counsel: 'Morgan Lee, Lee & Hart LLP — LEAD ATTORNEY, ATTORNEY TO BE NOTICED' } ],
      entries: [
        { seq: 1, date: '2026-02-20', type: 'Complaint', filedBy: 'Plaintiff', desc: 'COMPLAINT against Tri-County Transit Authority (Filing fee $405, receipt number AMSDC-4471902), filed by Dana Harlow. (Attachments: # 1 Civil Cover Sheet, # 2 Summons)' },
        { seq: 2, date: '2026-02-23', type: 'Summons Issued', filedBy: 'Clerk', desc: 'Summons Issued as to Tri-County Transit Authority.' }
      ] },
    { id: 'doe', caseNumber: 'CV-2026-004417', court: 'Metro County Superior Court (Training)', caption: 'John Doe v. Apex Delivery Services, Inc. & Robert W. Smith',
      type: 'Civil — Personal Injury (Motor Vehicle)', nature: 'Unlimited Civil — Auto Tort', cause: 'Negligence; vicarious liability', jury: 'Plaintiff', judge: 'Hon. M. Castillo', magistrate: '',
      filed: '2026-05-04', status: 'Active', ourClient: 'John Doe (Plaintiff)', method: 'state',
      parties: [ { role: 'Plaintiff', name: 'John Doe', counsel: 'LSH Partner Firm — attorney of record' },
                 { role: 'Defendant', name: 'Apex Delivery Services, Inc.', counsel: 'Defense counsel for Aggressive Casualty (insurer)' },
                 { role: 'Defendant', name: 'Robert W. Smith', counsel: 'Defense counsel for Aggressive Casualty (insurer)' } ],
      entries: [
        { seq: 1, date: '2026-05-04', type: 'Complaint', filedBy: 'Plaintiff', desc: 'COMPLAINT for Damages (Motor Vehicle — Personal Injury) filed by John Doe. Summons issued. (SUPERSEDED by the First Amended Complaint)' },
        { seq: 2, date: '2026-05-26', type: 'Answer', filedBy: 'Defendants', desc: 'ANSWER and Affirmative Defenses filed by Apex Delivery Services, Inc. and Robert W. Smith. No seatbelt defense pleaded.' }
      ] },
    // The five cases from the LSH docket registry prototype (practice records).
    { id: 'c1', caseNumber: '2:26-cv-01452-PI', court: 'U.S. District Court — District of Metro State (Training)', caption: 'Renfield Holdings LLC v. Marsh & Doyle Logistics, Inc.', type: 'Civil — Contract', nature: '190 Contract: Other', cause: '28:1332 Diversity — Breach of Contract', jury: 'Plaintiff', judge: 'Hon. P. Ibarra', filed: '2026-02-03', status: 'Active', method: 'frcp',
      parties: [ { role: 'Plaintiff', name: 'Renfield Holdings LLC', counsel: 'Plaintiff counsel' }, { role: 'Defendant', name: 'Marsh & Doyle Logistics, Inc.', counsel: 'Defense counsel' } ],
      entries: [
        { seq: 1, date: '2026-02-03', type: 'Complaint', filedBy: 'Plaintiff', desc: 'Complaint filed alleging breach of freight services agreement; jury demand endorsed.' },
        { seq: 2, date: '2026-02-04', type: 'Summons Issued', filedBy: 'Clerk', desc: 'Summons issued as to defendant Marsh & Doyle Logistics, Inc.' },
        { seq: 3, date: '2026-02-19', type: 'Return of Service', filedBy: 'Plaintiff', desc: 'Return of service executed 2/14/2026 on registered agent.' },
        { seq: 4, date: '2026-03-11', type: 'Answer', filedBy: 'Defendant', desc: 'Answer and affirmative defenses filed; counterclaim for setoff.' },
        { seq: 5, date: '2026-04-22', type: 'Scheduling Order', filedBy: 'Court', desc: 'Rule 16 scheduling order entered; discovery cutoff set for 10/16/2026.' } ] },
    { id: 'c2', caseNumber: '3:26-cr-00219-RC', court: 'U.S. District Court — District of Metro State (Training)', caption: 'State v. D. Okafor', type: 'Criminal — Felony', nature: 'Criminal', cause: 'Two counts, class 4 felony', jury: '', judge: 'Hon. R. Castellanos', filed: '2026-01-12', status: 'Active', method: 'frcp',
      parties: [ { role: 'Prosecution', name: 'State', counsel: 'Office of the Prosecutor' }, { role: 'Defendant', name: 'D. Okafor', counsel: 'Defense Counsel' } ],
      entries: [
        { seq: 1, date: '2026-01-12', type: 'Complaint', filedBy: 'State', desc: 'Criminal complaint filed; two counts, class 4 felony.' },
        { seq: 2, date: '2026-01-14', type: 'Notice of Appearance', filedBy: 'Defense Counsel', desc: 'Entry of appearance filed on behalf of defendant.' },
        { seq: 3, date: '2026-03-02', type: 'Motion to Compel', filedBy: 'Defense', desc: 'Motion to compel disclosure of body-camera footage.' },
        { seq: 4, date: '2026-03-20', type: 'Order', filedBy: 'Court', desc: 'Order granting motion to compel; disclosure due within 14 days.' },
        { seq: 5, date: '2026-05-06', type: 'Minute Entry', filedBy: 'Court', desc: 'Status conference held; trial set for 9/14/2026.' } ] },
    { id: 'c3', caseNumber: '1:25-pr-00087-TW', court: 'Metro County Probate Court (Training)', caption: 'In re Estate of Marguerite Voss', type: 'Probate', nature: 'Probate — Formal', cause: 'Petition for formal probate', jury: '', judge: 'Hon. T. Whitfield', filed: '2025-11-05', status: 'Stayed', method: 'state',
      parties: [ { role: 'Petitioner', name: 'Personal Representative (nominated)', counsel: 'Petitioner counsel' } ],
      entries: [
        { seq: 1, date: '2025-11-05', type: 'Complaint', filedBy: 'Petitioner', desc: 'Petition for formal probate of will and appointment of personal representative.' },
        { seq: 2, date: '2025-11-19', type: 'Notice of Hearing', filedBy: 'Clerk', desc: 'Notice of hearing on petition set for 12/17/2025.' },
        { seq: 3, date: '2025-12-30', type: 'Motion for Continuance', filedBy: 'Petitioner', desc: 'Unopposed motion to continue hearing pending heirship search.' },
        { seq: 4, date: '2026-01-08', type: 'Order', filedBy: 'Court', desc: 'Order staying proceedings 90 days pending completion of heirship investigation.' } ] },
    { id: 'c4', caseNumber: '2:25-cv-08890-PI', court: 'U.S. District Court — District of Metro State (Training)', caption: 'Priya Anand v. Blackstone Ridge Apartments LP', type: 'Civil — Landlord/Tenant', nature: '220 Real Property', cause: 'Security deposit', jury: '', judge: 'Hon. P. Ibarra', filed: '2025-09-14', status: 'Closed', method: 'frcp',
      parties: [ { role: 'Plaintiff', name: 'Priya Anand', counsel: 'Plaintiff counsel' }, { role: 'Defendant', name: 'Blackstone Ridge Apartments LP', counsel: 'Defense counsel' } ],
      entries: [
        { seq: 1, date: '2025-09-14', type: 'Complaint', filedBy: 'Plaintiff', desc: 'Complaint filed alleging wrongful withholding of security deposit.' },
        { seq: 2, date: '2025-10-02', type: 'Answer', filedBy: 'Defendant', desc: 'Answer filed denying material allegations.' },
        { seq: 3, date: '2025-11-18', type: 'Stipulation to Extend Time', filedBy: 'Both Parties', desc: 'Stipulation extending discovery deadline by 30 days.' },
        { seq: 4, date: '2026-01-09', type: 'Stipulation of Dismissal', filedBy: 'Both Parties', desc: 'Joint stipulation of dismissal with prejudice following settlement.' },
        { seq: 5, date: '2026-01-10', type: 'Order', filedBy: 'Court', desc: 'Order of dismissal entered; case closed.' } ] },
    { id: 'c5', caseNumber: '4:26-cv-00337-SB', court: 'U.S. District Court — District of Metro State (Training)', caption: 'Northfield Mutual Insurance Co. v. Calloway Roofing Co.', type: 'Civil — Subrogation', nature: '110 Insurance', cause: 'Subrogation', jury: '', judge: 'Hon. S. Beaumont', filed: '2026-03-28', status: 'Active', method: 'frcp',
      parties: [ { role: 'Plaintiff', name: 'Northfield Mutual Insurance Co.', counsel: 'Plaintiff counsel' }, { role: 'Defendant', name: 'Calloway Roofing Co.', counsel: 'Defense counsel' } ],
      entries: [
        { seq: 1, date: '2026-03-28', type: 'Complaint', filedBy: 'Plaintiff', desc: 'Subrogation complaint filed following fire-damage claim payout.' },
        { seq: 2, date: '2026-04-25', type: 'Motion to Dismiss', filedBy: 'Defendant', desc: 'Motion to dismiss for failure to state a claim.' },
        { seq: 3, date: '2026-05-09', type: 'Response in Opposition', filedBy: 'Plaintiff', desc: 'Response in opposition to motion to dismiss filed.' },
        { seq: 4, date: '2026-05-16', type: 'Reply Brief', filedBy: 'Defendant', desc: 'Reply brief in support of motion to dismiss.' } ] }
];

/* Assignments: an inbox of notices for one case. Each item says whether it belongs on the
   court docket (docket: {type, date}) or not (docket: null — e.g. discovery is served, not filed),
   and which deadlines it triggers. Rule-based deadlines are computed by LR, so the key and the
   explanation always agree. */
const DK_ASSIGNMENTS = [
    { id: 'harlow', caseId: 'harlow', program: '', title: 'Federal PI case: Harlow v. Tri-County Transit',
      intro: 'You docket for the firm representing the plaintiff, Dana Harlow, in federal court. Six items arrived over three months. For each one: decide whether it goes on the court docket, and calendar every deadline it triggers with the right date, a responsible attorney and reminders. Federal rules (FRCP 6) apply: count from the day after the trigger, roll weekends and court holidays forward, and add 3 days only for service by mail.',
      items: [
        { id: 'h1', kind: 'NEF', received: '2026-03-03', from: 'cmecf@metro.uscourts.training', subject: 'Activity in Case 2:26-cv-00318-PI Harlow v. Tri-County Transit Authority — Summons Returned Executed',
          body: 'This is an automatic e-mail message generated by the CM/ECF system.\n\nNotice of Electronic Filing\n\nThe following transaction was entered on 3/3/2026 at 10:14 AM CST and filed on 3/3/2026.\nCase Name: Harlow v. Tri-County Transit Authority\nCase Number: 2:26-cv-00318-PI\nDocument Number: 3\n\nDocket Text:\nSUMMONS Returned Executed by Dana Harlow. Tri-County Transit Authority served on 3/2/2026. (Rivera, A.)',
          docket: { type: 'Return of Service', date: '2026-03-03' },
          deadlines: [ { key: 'answer', label: "Defendant's answer due (watch for default)", rule: 'answer', trigger: '2026-03-02', service: 'personal' } ] },
        { id: 'h2', kind: 'NEF', received: '2026-04-03', from: 'cmecf@metro.uscourts.training', subject: 'Activity in Case 2:26-cv-00318-PI — Motion to Dismiss',
          body: 'Notice of Electronic Filing\n\nThe following transaction was entered by Lee, Morgan on 4/3/2026 at 4:52 PM CDT and filed on 4/3/2026.\nDocument Number: 4\n\nDocket Text:\nMOTION to Dismiss for Failure to State a Claim by Tri-County Transit Authority. (Attachments: # 1 Memorandum in Support, # 2 Proposed Order)(Lee, Morgan)\n\nNotice has been electronically mailed to: A. Rivera, Morgan Lee',
          docket: { type: 'Motion to Dismiss', date: '2026-04-03' },
          deadlines: [ { key: 'opp', label: 'Our opposition to the Motion to Dismiss', rule: 'opposition', trigger: '2026-04-03', service: 'electronic' } ] },
        { id: 'h3', kind: 'NEF', received: '2026-04-10', from: 'cmecf@metro.uscourts.training', subject: 'Activity in Case 2:26-cv-00318-PI — Notice of Hearing on Motion',
          body: 'Notice of Electronic Filing\n\nThe following transaction was entered on 4/10/2026 at 9:03 AM CDT.\nDocument Number: 5\n\nDocket Text:\nNOTICE OF HEARING ON MOTION re [4] MOTION to Dismiss for Failure to State a Claim: Motion Hearing set for 5/20/2026 09:30 AM in Courtroom 4B before Judge P. Ibarra. (jw)',
          docket: { type: 'Notice of Hearing', date: '2026-04-10' },
          deadlines: [ { key: 'hearing', label: 'Hearing on Motion to Dismiss (Courtroom 4B)', rule: 'fixed', trigger: '2026-05-20', time: '09:30' } ] },
        { id: 'h4', kind: 'Mail', received: '2026-05-04', from: 'U.S. Mail — Lee & Hart LLP', subject: "Defendant Tri-County Transit Authority's First Requests for Admission to Plaintiff",
          body: "DEFENDANT'S FIRST REQUESTS FOR ADMISSION TO PLAINTIFF DANA HARLOW\n\nPursuant to Fed. R. Civ. P. 36, Defendant requests that Plaintiff admit the truth of the following matters within the time allowed by the Rules…\n\n[12 requests]\n\nCERTIFICATE OF SERVICE\nI certify that on May 1, 2026, I served the foregoing on counsel for Plaintiff by first-class U.S. Mail, postage prepaid.\n/s/ Morgan Lee",
          docket: null, notDocketWhy: 'Discovery requests are served on the parties, not filed with the court (FRCP 5(d)(1)(A)), so they never appear on the court docket.',
          deadlines: [ { key: 'rfa', label: 'Responses to First Requests for Admission (unanswered RFAs are deemed admitted)', rule: 'discovery', trigger: '2026-05-01', service: 'mail' } ] },
        { id: 'h5', kind: 'NEF', received: '2026-05-22', from: 'cmecf@metro.uscourts.training', subject: 'Activity in Case 2:26-cv-00318-PI — Order on Motion to Dismiss',
          body: 'Notice of Electronic Filing\n\nThe following transaction was entered on 5/22/2026 at 8:41 AM CDT and filed on 5/21/2026.\nDocument Number: 9\n\nDocket Text:\nORDER granting in part and denying in part [4] Motion to Dismiss. Count II is dismissed without prejudice. Plaintiff may file an amended complaint within 14 days of the entry of this Order. Signed by Judge P. Ibarra on 5/21/2026. (jw) (Entered: 05/22/2026)',
          docket: { type: 'Order', date: '2026-05-22' },
          deadlines: [ { key: 'amend', label: 'Last day to file the amended complaint', rule: 'amendByOrder', trigger: '2026-05-22', service: 'electronic' } ] },
        { id: 'h6', kind: 'NEF', received: '2026-06-01', from: 'cmecf@metro.uscourts.training', subject: 'Activity in Case 2:26-cv-00318-PI — Scheduling Order',
          body: 'Notice of Electronic Filing\n\nThe following transaction was entered on 6/1/2026 at 2:16 PM CDT.\nDocument Number: 12\n\nDocket Text:\nSCHEDULING ORDER: Joinder of Parties and Amended Pleadings due by 7/31/2026. Plaintiff Expert Disclosures due by 9/15/2026. Defendant Expert Disclosures due by 10/15/2026. Discovery due by 11/30/2026. Dispositive Motions due by 12/18/2026. Final Pretrial Conference set for 2/8/2027 10:00 AM in Courtroom 4B before Judge P. Ibarra. Jury Trial set for 3/1/2027 09:00 AM in Courtroom 4B before Judge P. Ibarra. Signed by Judge P. Ibarra on 6/1/2026. (jw)',
          docket: { type: 'Scheduling Order', date: '2026-06-01' },
          deadlines: [
            { key: 'join', label: 'Joinder of parties / amended pleadings', rule: 'fixed', trigger: '2026-07-31' },
            { key: 'pexp', label: "Plaintiff's expert disclosures (ours)", rule: 'fixed', trigger: '2026-09-15' },
            { key: 'dexp', label: "Defendant's expert disclosures", rule: 'fixed', trigger: '2026-10-15' },
            { key: 'disc', label: 'Discovery closes', rule: 'fixed', trigger: '2026-11-30' },
            { key: 'disp', label: 'Dispositive motions due', rule: 'fixed', trigger: '2026-12-18' },
            { key: 'fptc', label: 'Final Pretrial Conference', rule: 'fixed', trigger: '2027-02-08', time: '10:00' },
            { key: 'trial', label: 'Jury trial', rule: 'fixed', trigger: '2027-03-01', time: '09:00' } ] }
      ] },
    { id: 'doe', caseId: 'doe', program: 'CM', title: 'CM case: John Doe v. Apex Delivery Services',
      intro: 'The John Doe file from the Case Management course is in litigation and heading to arbitration. Docket what came in, and calendar every deadline with a responsible attorney and reminders. This court uses the training state rules from the course: add the service days (mail +3, e-service +3) to the period, then roll a weekend or holiday forward.',
      items: [
        { id: 'd1', kind: 'Email', received: '2026-02-16', from: 'Intake — LSH', subject: 'New matter opened: John Doe (MVA 02/14/2026) — calendar the SOL',
          body: 'New matter: John Doe v. Apex Delivery Services & Robert W. Smith. Motor vehicle collision on Saturday, February 14, 2026. Personal injury. Retainer signed 02/15/2026.\n\nPer the Master Case Summary, the statute of limitations is two years from the date of the collision. Calendar it today, with long-range reminders.',
          docket: null, notDocketWhy: 'An internal intake email is not a court filing, so it never goes on the court docket; the deadline goes on the firm calendar.',
          deadlines: [ { key: 'sol', label: 'Statute of limitations — file suit by', rule: 'sol', trigger: '2026-02-14' } ] },
        { id: 'd2', kind: 'NEF', received: '2026-06-01', from: 'efile@metrocourt.training', subject: 'CV-2026-004417 — Stipulated Arbitration & Scheduling Order entered',
          body: 'Notice of Entry\n\nCase CV-2026-004417 Doe v. Apex Delivery Services, Inc., et al.\nSTIPULATED ARBITRATION & SCHEDULING ORDER (entered 06/01/2026)\n\n1. Arbitrator strike lists due June 8, 2026.\n2. Each side\'s arbitrator retainer deposit due June 16, 2026.\n3. Exhibit and witness lists exchanged by June 17, 2026.\n4. Arbitration briefs due June 18, 2026 by 5:00 PM.\n5. Arbitration hearing June 20, 2026 at 9:00 AM.\n\nIT IS SO ORDERED.',
          docket: { type: 'Scheduling Order', date: '2026-06-01' },
          deadlines: [
            { key: 'strike', label: 'Arbitrator strike list due', rule: 'fixed', trigger: '2026-06-08' },
            { key: 'deposit', label: 'Arbitrator retainer deposit due (ours is outstanding: route to accounting)', rule: 'fixed', trigger: '2026-06-16' },
            { key: 'lists', label: 'Exhibit & witness lists exchanged', rule: 'fixed', trigger: '2026-06-17' },
            { key: 'brief', label: 'Arbitration brief due', rule: 'fixed', trigger: '2026-06-18', time: '17:00' },
            { key: 'hearing', label: 'Arbitration hearing', rule: 'fixed', trigger: '2026-06-20', time: '09:00' } ] },
        { id: 'd3', kind: 'NEF', received: '2026-06-10', from: 'efile@metrocourt.training', subject: 'CV-2026-004417 — First Amended Complaint filed',
          body: 'Filing Accepted\n\nEnvelope 88213407 — FIRST AMENDED COMPLAINT for Damages filed by Plaintiff John Doe on 06/10/2026 in CV-2026-004417.\nStatus: Accepted. File-stamped copy attached.\n\nReminder: every newly named or amended defendant must be served within the service window.',
          docket: { type: 'Amended Complaint', date: '2026-06-10' },
          deadlines: [ { key: 'svc', label: 'Serve the First Amended Complaint (90-day service window)', rule: 'serviceWindow', trigger: '2026-06-10' } ] },
        { id: 'd4', kind: 'Mail', received: '2026-06-15', from: 'U.S. Mail — defense counsel', subject: "Defendant's First Requests for Admission",
          body: "DEFENDANT APEX DELIVERY SERVICES, INC.'S FIRST REQUESTS FOR ADMISSION\n\n… RFA No. 3: Admit that you were not wearing a seatbelt at the time of the collision.\nRFA No. 4: Admit that you did not suffer a permanent injury…\n\nPROOF OF SERVICE\nServed by first-class U.S. Mail on June 12, 2026.",
          docket: null, notDocketWhy: 'Requests for admission are served on the parties, not filed with the court, so they do not go on the court docket.',
          deadlines: [ { key: 'rfa', label: 'Responses to First RFAs (RFA #3 seatbelt and #4 permanency are deadly if deemed admitted)', rule: 'discovery', trigger: '2026-06-12', service: 'mail' } ] },
        { id: 'd3b', kind: 'NEF', received: '2026-06-16', from: 'efile@metrocourt.training', subject: 'CV-2026-004417 — Proof of Service filed (Robert W. Smith)',
          body: 'Filing Accepted\n\nPROOF OF SERVICE OF SUMMONS filed by Plaintiff John Doe on 06/16/2026 in CV-2026-004417.\nDefendant Robert W. Smith was personally served with the Summons and First Amended Complaint on 06/15/2026 at 6:40 PM by registered process server.',
          docket: { type: 'Return of Service', date: '2026-06-16' },
          deadlines: [ { key: 'answer', label: "Smith's answer due (watch for default)", rule: 'answer', trigger: '2026-06-15', service: 'personal' } ] },
        { id: 'd5', kind: 'NEF', received: '2026-07-01', from: 'efile@metrocourt.training', subject: 'CV-2026-004417 — Motion to Compel (e-served)',
          body: 'Service Notification\n\nDefendants\' MOTION TO COMPEL Plaintiff\'s Responses to Special Interrogatories, Set One, was filed and electronically served on 07/01/2026 in CV-2026-004417.\nUnder this court\'s local e-service rule, add 3 days to the response period.',
          docket: { type: 'Motion to Compel', date: '2026-07-01' },
          deadlines: [ { key: 'compel', label: 'Our opposition to the Motion to Compel', rule: 'opposition', trigger: '2026-07-01', service: 'electronic' } ] }
      ] }
];

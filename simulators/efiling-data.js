/* Court E-Filing — scenarios. Each has a filing folder (documents with properties the trainee
   inspects and fixes) and the answer the grader checks against (see efiling.js). */
const EF_LIMIT_MB = 35;
const EF_ATTACH_TYPES = ['Exhibit', 'Proposed Order', 'Memorandum in Support', 'Affidavit / Declaration', 'Certificate of Service', 'Civil Cover Sheet', 'Summons', 'Other'];

const EF_SCENARIOS = [
    { id: 'fed-opp', system: 'federal', title: 'Federal: file the Opposition to the Motion to Dismiss', short: 'Federal · Opposition brief',
      court: 'U.S. District Court — District of Metro State (Training)', when: 'Friday 04/17/2026, 10:48 PM Central — the opposition is due today (11:59 PM court time)',
      brief: 'Harlow v. Tri-County Transit Authority, 2:26-cv-00318-PI. The attorney signed off on the opposition to the defendant\'s Motion to Dismiss (docket #4). File it with its exhibits and the proposed order before midnight. You file as the attorney\'s filing agent under her login.',
      caseNumber: '2:26-cv-00318-PI', caption: 'Harlow v. Tri-County Transit Authority',
      parties: [ { id: 'p1', name: 'Dana Harlow', role: 'Plaintiff' }, { id: 'd1', name: 'Tri-County Transit Authority', role: 'Defendant' } ],
      docket: [ { n: 1, text: 'COMPLAINT against Tri-County Transit Authority filed by Dana Harlow.' }, { n: 3, text: 'SUMMONS Returned Executed by Dana Harlow.' },
                { n: 4, text: 'MOTION to Dismiss for Failure to State a Claim by Tri-County Transit Authority.' }, { n: 5, text: 'NOTICE OF HEARING ON MOTION re [4] MOTION to Dismiss.' } ],
      events: ['Answer to Complaint', 'Amended Complaint', 'Motion to Dismiss', 'Memorandum in Support of Motion', 'Response in Opposition to Motion', 'Reply to Response to Motion', 'Notice of Appearance', 'Notice (Other)'],
      recipients: ['A. Rivera (rivera@lshpartner.training)', 'Morgan Lee (mlee@leehart.training)'],
      folder: [
        { id: 'opp', name: 'Harlow_Opposition_to_MTD_FINAL.pdf', kind: 'pdf', what: 'Opposition to the Motion to Dismiss (final, approved)', pages: 18, sizeMB: 1.4, searchable: false, signed: false, cos: false, password: false, pii: [] },
        { id: 'exA', name: 'Exhibit_A_ER_Record.pdf', kind: 'pdf', what: 'Exhibit A: Metro General ER record (02/14/2026)', pages: 6, sizeMB: 2.1, searchable: true, signed: null, cos: null, password: false, pii: ['Full date of birth (03/22/1987)', 'Social Security number (412-55-8830)'] },
        { id: 'exB', name: 'Exhibit_B_Police_Report_with_photos.pdf', kind: 'pdf', what: 'Exhibit B: police report with scene photographs', pages: 41, sizeMB: 48, searchable: true, signed: null, cos: null, password: false, pii: [] },
        { id: 'po', name: 'Proposed_Order_Denying_MTD.pdf', kind: 'pdf', what: 'Proposed order denying the motion', pages: 1, sizeMB: 0.1, searchable: true, signed: null, cos: null, password: false, pii: [] },
        { id: 'memo', name: 'Internal_Settlement_Strategy_Memo.pdf', kind: 'pdf', what: 'Internal memo: settlement strategy (attorney work product)', pages: 3, sizeMB: 0.2, searchable: true, signed: null, cos: null, password: false, pii: [], privileged: true },
        { id: 'draft', name: 'Harlow_Opposition_DRAFT_v2.docx', kind: 'docx', what: 'Earlier Word draft of the opposition', pages: 17, sizeMB: 0.3, searchable: true, signed: false, cos: false, password: false, pii: [] }
      ] },
    { id: 'state-fac', system: 'state', title: 'State court: e-file the First Amended Complaint', short: 'State · Amended complaint',
      court: 'Metro County Superior Court (Training)', when: 'Wednesday 06/10/2026, 2:05 PM',
      brief: 'John Doe v. Apex Delivery Services, Inc. & Robert W. Smith, CV-2026-004417. The attorney approved the First Amended Complaint (JD35). File it in the existing case through the court\'s e-filing service provider and e-serve defense counsel.',
      caseNumber: 'CV-2026-004417', caption: 'Doe v. Apex Delivery Services, Inc., et al.',
      parties: [ { id: 'p1', name: 'John Doe', role: 'Plaintiff' }, { id: 'd1', name: 'Apex Delivery Services, Inc.', role: 'Defendant' }, { id: 'd2', name: 'Robert W. Smith', role: 'Defendant' } ],
      codes: [ { code: 'Complaint (initial)', fee: 435 }, { code: 'Amended Complaint', fee: 0 }, { code: 'Answer', fee: 435 }, { code: 'Motion (general)', fee: 60 }, { code: 'Proof of Service', fee: 0 }, { code: 'Request for Dismissal', fee: 0 } ],
      serviceContacts: [ { id: 'dc', name: 'Defense counsel for Apex & Smith (Aggressive Casualty panel)', email: 'defense@acpanel.training', required: true }, { id: 'adj', name: 'Aggressive Casualty — claims adjuster', email: 'claims@aggcas.training', notParty: true } ],
      efspFee: 4.95,
      folder: [
        { id: 'fac', name: 'JD35_First_Amended_Complaint.pdf', kind: 'pdf', what: 'First Amended Complaint (operative, approved by the attorney)', pages: 14, sizeMB: 0.9, searchable: true, signed: true, cos: null, password: true, pii: [] },
        { id: 'orig', name: 'JD34_Original_Complaint.pdf', kind: 'pdf', what: 'Original Complaint (superseded)', pages: 11, sizeMB: 0.7, searchable: true, signed: true, cos: null, password: false, pii: [], superseded: true },
        { id: 'mcs', name: 'JD04_Master_Case_Summary_ATTORNEY_ONLY.pdf', kind: 'pdf', what: 'Master Case Summary (internal, attorney only)', pages: 4, sizeMB: 0.3, searchable: true, signed: null, cos: null, password: false, pii: [], privileged: true },
        { id: 'facw', name: 'JD35_First_Amended_Complaint.docx', kind: 'docx', what: 'Word version of the First Amended Complaint', pages: 14, sizeMB: 0.1, searchable: true, signed: false, cos: null, password: false, pii: [] }
      ] },
    { id: 'state-new', system: 'state-new', title: 'State court: open a new case (complaint, cover sheet, summons)', short: 'State · New case',
      court: 'Metro County Superior Court (Training)', when: 'Monday 08/03/2026, 11:20 AM',
      brief: 'Maria Santos slipped on an unmarked wet floor at a Brightway Grocers store on 09/12/2025 and fractured her wrist (surgery). Damages sought: over $180,000. The attorney approved the complaint. Open the case: file the complaint with everything a new civil case needs, pay the first-paper fee, and get the summons issued so it can be served.',
      plaintiff: 'Maria Santos', defendant: 'Brightway Grocers, Inc.',
      caseTypes: [ { code: 'Auto (22)', kind: 'pi' }, { code: 'Premises liability — Other PI/PD/WD (23)', kind: 'premises' }, { code: 'Medical malpractice (45)', kind: 'medmal' }, { code: 'Breach of contract/warranty (06)', kind: 'contract' } ],
      fees: { unlimited: 435, limited: 225 },
      folder: [
        { id: 'cmp', name: 'Santos_v_Brightway_Complaint.pdf', kind: 'pdf', what: 'Complaint for Damages (premises liability), approved', pages: 9, sizeMB: 0.6, searchable: true, signed: true, cos: null, password: false, pii: [] },
        { id: 'ccs', name: 'Civil_Case_Cover_Sheet_CM-010.pdf', kind: 'pdf', what: 'Civil Case Cover Sheet (completed)', pages: 2, sizeMB: 0.2, searchable: true, signed: true, cos: null, password: false, pii: [] },
        { id: 'sum', name: 'Summons_SUM-100.pdf', kind: 'pdf', what: 'Summons (for the clerk to issue)', pages: 1, sizeMB: 0.1, searchable: true, signed: null, cos: null, password: false, pii: [] },
        { id: 'intake', name: 'Santos_Intake_Notes.pdf', kind: 'pdf', what: 'Client intake notes (internal: SSN, medical history, fee agreement)', pages: 5, sizeMB: 0.3, searchable: true, signed: null, cos: null, password: false, pii: ['Social Security number', 'Full date of birth'], privileged: true }
      ] }
];

/* Appellate E-Filing — scenarios. The appellate side of the house: a notice of appeal filed
   in the trial court, an opening brief filed in the court of appeals, and an emergency stay
   petition. Each has a filing folder the trainee inspects and fixes, and the answer the
   grader checks against (see appellate.js). State-specific numbers — deadlines, fees, word
   limits, cover colors — are not in here: they come from the state picked in the dropdown
   (filing-states.js), so one scenario teaches every state's version of the same filing. */

const AP_ATTACH_TYPES = ['Exhibit', 'Appendix / Excerpts of Record', 'Certificate of Word Count', 'Certificate of Interested Entities', 'Proof of Service', 'Declaration', 'Proposed Order', 'Designation of Record', 'Civil Case Information Statement', 'Other'];

const AP_SCENARIOS = [
    {
        id: 'ap-noa', stage: 'trial', title: 'File the Notice of Appeal after the summary judgment',
        short: 'Notice of appeal', icon: '📄',
        caseNumber: 'CV-2026-004417', caption: 'Doe v. Apex Delivery Services, Inc., et al.',
        appealNumber: null,
        judgmentEntered: '2026-07-06', noticeServed: '2026-07-08', today: '2026-08-17',
        when: 'Monday 08/17/2026, 9:40 AM',
        brief: 'The court granted Apex\'s motion for summary judgment and entered judgment against John Doe. The attorney decided to appeal. File the notice of appeal in the trial court, designate the record, and get it served — then check the deadline before you do anything else.',
        appellantId: 'p1', parties: [ { id: 'p1', name: 'John Doe', role: 'Plaintiff — appellant' }, { id: 'd1', name: 'Apex Delivery Services, Inc.', role: 'Defendant — respondent' }, { id: 'd2', name: 'Robert W. Smith', role: 'Defendant — respondent' } ],
        docket: [ { n: 41, text: 'ORDER granting Defendants\' Motion for Summary Judgment. Entered 07/02/2026.' },
                  { n: 42, text: 'JUDGMENT entered in favor of Defendants. Entered 07/06/2026.' },
                  { n: 43, text: 'NOTICE OF ENTRY OF JUDGMENT served on all parties 07/08/2026.' } ],
        docTypes: ['Notice of Appeal', 'Notice of Cross-Appeal', 'Motion for New Trial', 'Motion to Vacate Judgment', 'Petition for Writ of Mandate', 'Notice of Designation of Record'],
        answer: { docType: 'Notice of Appeal', appealsFrom: '42', record: true, svc: 'eserve' },
        serviceContacts: [ { id: 'dc', name: 'Defense counsel for Apex & Smith', email: 'defense@acpanel.training', required: true },
                           { id: 'clerk', name: 'Trial court clerk (appeals desk)', email: 'appeals@metrocourt.training', court: true },
                           { id: 'adj', name: 'Aggressive Casualty — claims adjuster', email: 'claims@aggcas.training', notParty: true } ],
        folder: [
            { id: 'noa', name: 'Doe_Notice_of_Appeal.pdf', kind: 'pdf', what: 'Notice of Appeal from the judgment entered 07/06/2026', pages: 2, sizeMB: 0.1, searchable: true, signed: false, cos: false, password: false, pii: [] },
            { id: 'dor', name: 'Designation_of_Record_on_Appeal.pdf', kind: 'pdf', what: 'Designation of the record on appeal (transcripts and clerk\'s record)', pages: 3, sizeMB: 0.2, searchable: true, signed: true, cos: null, password: false, pii: [] },
            { id: 'judg', name: 'Judgment_Entered_07-06-2026.pdf', kind: 'pdf', what: 'Conformed copy of the judgment appealed from', pages: 4, sizeMB: 0.3, searchable: true, signed: null, cos: null, password: false, pii: [] },
            { id: 'memo', name: 'Appeal_Merits_Assessment_ATTORNEY_ONLY.pdf', kind: 'pdf', what: 'Internal memo: odds on appeal and settlement posture', pages: 6, sizeMB: 0.4, searchable: true, signed: null, cos: null, password: false, pii: [], privileged: true },
            { id: 'mtn', name: 'Doe_Motion_for_New_Trial_DRAFT.docx', kind: 'docx', what: 'Abandoned draft motion for new trial', pages: 9, sizeMB: 0.2, searchable: true, signed: false, cos: false, password: false, pii: [] }
        ]
    },
    {
        id: 'ap-aob', stage: 'appellate', title: 'File the Appellant\'s Opening Brief in the court of appeals',
        short: 'Opening brief', icon: '📘',
        caseNumber: 'CV-2026-004417', caption: 'Doe v. Apex Delivery Services, Inc., et al.',
        appealNumber: 'A-26-0912', when: 'Thursday 11/19/2026, 3:15 PM — the brief is due today',
        brief: 'The appeal is docketed as A-26-0912 and the record has been filed. The attorney finished the Appellant\'s Opening Brief. File it in the court of appeals with the excerpts of record and the certificates the court requires — and check the brief against the court\'s length limit before you touch Submit.',
        appellantId: 'p1', parties: [ { id: 'p1', name: 'John Doe', role: 'Appellant' }, { id: 'd1', name: 'Apex Delivery Services, Inc.', role: 'Respondent' }, { id: 'd2', name: 'Robert W. Smith', role: 'Respondent' } ],
        docket: [ { n: 1, text: 'NOTICE OF APPEAL filed 08/17/2026. Appeal docketed A-26-0912.' },
                  { n: 4, text: 'RECORD ON APPEAL filed by the trial court clerk 10/05/2026.' },
                  { n: 6, text: 'ORDER setting the appellant\'s opening brief for 11/19/2026.' } ],
        docTypes: ['Appellant\'s Opening Brief', 'Respondent\'s Answering Brief', 'Appellant\'s Reply Brief', 'Motion to Extend Time', 'Request for Oral Argument', 'Notice of Related Case'],
        briefKind: 'opening',
        answer: { docType: 'Appellant\'s Opening Brief', svc: 'eserve' },
        serviceContacts: [ { id: 'dc', name: 'Respondents\' appellate counsel', email: 'appeals@acpanel.training', required: true },
                           { id: 'trial', name: 'Trial court clerk (copy of the brief, as the rules require)', email: 'clerk@metrocourt.training', required: true },
                           { id: 'adj', name: 'Aggressive Casualty — claims adjuster', email: 'claims@aggcas.training', notParty: true } ],
        folder: [
            { id: 'aob', name: 'Doe_Appellants_Opening_Brief.pdf', kind: 'pdf', what: 'Appellant\'s Opening Brief (approved by the attorney)', pages: 52, sizeMB: 2.2, searchable: true, signed: true, cos: false, password: false, pii: [], words: 16480, cover: 'white' },
            { id: 'eor', name: 'Excerpts_of_Record_Vol_I.pdf', kind: 'pdf', what: 'Excerpts of record, volume I (pleadings, judgment, MSJ papers)', pages: 180, sizeMB: 44, searchable: false, signed: null, cos: null, password: false, pii: [] },
            { id: 'cwc', name: 'Certificate_of_Word_Count.pdf', kind: 'pdf', what: 'Certificate of compliance with the length limit', pages: 1, sizeMB: 0.1, searchable: true, signed: true, cos: null, password: false, pii: [] },
            { id: 'cie', name: 'Certificate_of_Interested_Entities.pdf', kind: 'pdf', what: 'Certificate of interested entities or persons', pages: 1, sizeMB: 0.1, searchable: true, signed: true, cos: null, password: false, pii: [] },
            { id: 'med', name: 'Sealed_Medical_Records_Doe.pdf', kind: 'pdf', what: 'Plaintiff\'s medical records — SEALED by trial court order', pages: 22, sizeMB: 1.1, searchable: true, signed: null, cos: null, password: false, pii: ['Social Security number (402-11-9076)', 'Full date of birth (06/14/1979)'], sealed: true },
            { id: 'aobw', name: 'Doe_Appellants_Opening_Brief.docx', kind: 'docx', what: 'Word version of the opening brief', pages: 52, sizeMB: 0.6, searchable: true, signed: true, cos: false, password: false, pii: [], words: 16480 }
        ]
    },
    {
        id: 'ap-stay', stage: 'appellate', title: 'Emergency: petition for a stay before the sale goes through',
        short: 'Emergency stay', icon: '🚨',
        caseNumber: 'CV-2026-007781', caption: 'Santos v. Brightway Grocers, Inc.',
        appealNumber: 'A-26-1144', when: 'Friday 12/04/2026, 4:05 PM — the writ of execution levies Monday at 9:00 AM',
        brief: 'The trial court denied Ms. Santos\'s motion to stay enforcement, and the sheriff levies on her bank account Monday morning. The attorney drafted an emergency petition for a stay pending appeal. File it in the court of appeals today, with everything the court needs to rule over a weekend, and tell opposing counsel it is coming.',
        appellantId: 'p1', parties: [ { id: 'p1', name: 'Maria Santos', role: 'Appellant / petitioner' }, { id: 'd1', name: 'Brightway Grocers, Inc.', role: 'Respondent / real party in interest' } ],
        docket: [ { n: 2, text: 'NOTICE OF APPEAL filed 11/24/2026. Appeal docketed A-26-1144.' },
                  { n: 3, text: 'ORDER of the trial court denying the motion to stay enforcement. Entered 12/02/2026.' },
                  { n: 4, text: 'WRIT OF EXECUTION issued 12/03/2026; levy set for 12/07/2026.' } ],
        docTypes: ['Petition for Writ of Supersedeas / Emergency Stay', 'Appellant\'s Opening Brief', 'Motion to Extend Time', 'Notice of Appeal', 'Request for Oral Argument'],
        urgent: true,
        answer: { docType: 'Petition for Writ of Supersedeas / Emergency Stay', svc: 'eserve' },
        serviceContacts: [ { id: 'dc', name: 'Brightway\'s counsel of record', email: 'counsel@brightwaylaw.training', required: true },
                           { id: 'adj', name: 'Brightway risk management', email: 'risk@brightway.training', notParty: true } ],
        folder: [
            { id: 'pet', name: 'Santos_Petition_for_Stay.pdf', kind: 'pdf', what: 'Petition for writ of supersedeas and immediate stay', pages: 19, sizeMB: 1.0, searchable: true, signed: true, cos: false, password: true, pii: [] },
            { id: 'decl', name: 'Declaration_of_Counsel_Notice.pdf', kind: 'pdf', what: 'Declaration of counsel: notice to opposing counsel and the emergency', pages: 3, sizeMB: 0.2, searchable: true, signed: true, cos: null, password: false, pii: [] },
            { id: 'ord', name: 'Order_Denying_Stay_12-02-2026.pdf', kind: 'pdf', what: 'Trial court order denying the stay, with the writ of execution', pages: 7, sizeMB: 0.5, searchable: false, signed: null, cos: null, password: false, pii: [] },
            { id: 'po', name: 'Proposed_Order_Granting_Stay.pdf', kind: 'pdf', what: 'Proposed order granting the stay pending appeal', pages: 2, sizeMB: 0.1, searchable: true, signed: null, cos: null, password: false, pii: [] },
            { id: 'bank', name: 'Santos_Bank_Statements.pdf', kind: 'pdf', what: 'Client bank statements showing the account levied on', pages: 11, sizeMB: 0.6, searchable: true, signed: null, cos: null, password: false, pii: ['Full bank account number (…8842)', 'Social Security number (601-44-2210)'] },
            { id: 'notes', name: 'Santos_Fee_Agreement_and_Notes.pdf', kind: 'pdf', what: 'Fee agreement and client notes (internal)', pages: 5, sizeMB: 0.3, searchable: true, signed: null, cos: null, password: false, pii: [], privileged: true }
        ]
    }
];

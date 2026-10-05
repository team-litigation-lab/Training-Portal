/* Google Calendar Simulator: its data (simulators/gcal.html, gcal.js).
   • GCAL_ATTORNEY: the attorney's week for the Foundational Training's Calendar Management practice, the same
     every week (Monday to Friday): the firm's Google Calendar week (the owner's list), with the daily blocks
     (no schedule before 8 AM or after 5 PM, the daily case and email review, lunch). An Admin can change it for
     everyone in the simulator (Settings → Edit the weekly schedule); the change is kept by
     functions/api/gcal-schedule.js and this list is the schedule "as it came".
     A row: { id, wd (1 = Monday), start, end ('HH:MM', Eastern), type, title, location, notes, color }.
   • GCAL_REQUESTS: the Calendar Management mock-call requests (Day 6) a trainee puts on the attorney's calendar:
     who called, what they need, when they can do it. Existing clients are CMS Training Library files (name,
     callback, DOB, DOL and case number as in mock-cases.js); new clients are new; a move or a cancellation is
     one of the week's appointments (seed: its row id).
     kind: book | move | cancel.
     when: 0 = this week, 1 = next week; days: the weekdays the caller can do (1 = Mon … 5 = Fri; 8–12 are the
     week after's Mon–Fri); from/to: the caller's hours (Eastern). sameDay: the caller wants today.
   • GCAL_RULES: the attorney's scheduling rules (Day 6: Scheduling Rules and Additional Notes), which the
     check uses (gcal.js, checkPlan).
*/
const GCAL_ATTORNEY = [
    {"id": "mon-early", "wd": 1, "start": "00:00", "end": "08:00", "type": "Blocked Time", "title": "No Schedule Block", "location": "", "notes": "", "color": ""},
    {"id": "mon-review", "wd": 1, "start": "08:00", "end": "08:30", "type": "Blocked Time", "title": "Daily Case and Email Review", "location": "", "notes": "", "color": ""},
    {"id": "mon-anderson", "wd": 1, "start": "09:00", "end": "09:45", "type": "Client Meeting", "title": "Deposition Preparation: Gerald Anderson", "location": "", "notes": "Name: Gerald Anderson\nCB Number: 805-123-4567\nDOL: May 20, 2025\nSpecial Note: Preparation for Deposition", "color": ""},
    {"id": "mon-mitchell", "wd": 1, "start": "10:15", "end": "11:00", "type": "Client Meeting", "title": "Post-Settlement Meeting: Elizabeth Mitchell", "location": "", "notes": "Name: Elizabeth Mitchell\nCB Number: 805-123-4567\nDOL: August 23, 2025\nSpecial Note: Ensure full breakdown available.", "color": ""},
    {"id": "mon-lunch", "wd": 1, "start": "12:00", "end": "13:00", "type": "Blocked Time", "title": "Lunch Break", "location": "", "notes": "", "color": ""},
    {"id": "mon-boyle", "wd": 1, "start": "14:00", "end": "14:45", "type": "Client Meeting", "title": "Mediation Preparation Call: Susan Boyle", "location": "", "notes": "Name: Susan Boyle\nCB Number: 805-123-4567\nDOL: June 11, 2025\nSpecial Note: Review expectations and evidence list.", "color": ""},
    {"id": "mon-cowell", "wd": 1, "start": "15:15", "end": "15:45", "type": "Phone Call", "title": "Urgent Meeting Request: Simon Cowell", "location": "", "notes": "Name: Simon Cowell\nCB Number: 805-123-4567\nDOL: May 21, 2025\nSpecial Note: Urgent litigation update.", "color": ""},
    {"id": "mon-late", "wd": 1, "start": "17:00", "end": "23:59", "type": "Blocked Time", "title": "No Schedule Block", "location": "", "notes": "", "color": ""},
    {"id": "tue-early", "wd": 2, "start": "00:00", "end": "08:00", "type": "Blocked Time", "title": "No Schedule Block", "location": "", "notes": "", "color": ""},
    {"id": "tue-review", "wd": 2, "start": "08:00", "end": "08:30", "type": "Blocked Time", "title": "Daily Case and Email Review", "location": "", "notes": "", "color": ""},
    {"id": "tue-miller", "wd": 2, "start": "10:30", "end": "11:00", "type": "Phone Call", "title": "Client Consultation: New PI Case - Jenny Miller", "location": "", "notes": "Name: Jenny Miller\nCB Number: 805-123-4567\nDOL: April 15, 2026\nSpecial Note: New PI Case: Client seems upset from the accident.", "color": ""},
    {"id": "tue-manilow", "wd": 2, "start": "11:15", "end": "11:45", "type": "Phone Call", "title": "Missed Call Consultation: Barry Manilow", "location": "", "notes": "Name: Barry Manilow\nCB Number: 805-123-4567\nDOL: February 17, 2026\nSpecial Note: Contract Dispute", "color": ""},
    {"id": "tue-lunch", "wd": 2, "start": "12:00", "end": "13:00", "type": "Blocked Time", "title": "Lunch Break", "location": "", "notes": "", "color": ""},
    {"id": "tue-henderson", "wd": 2, "start": "13:00", "end": "13:30", "type": "Phone Call", "title": "Case Status Updates: Logan Henderson", "location": "", "notes": "Name: Logan Henderson\nCB Number: 805-123-4567\nDOL: November 18, 2025\nSpecial Note: Insurance update ready for review.", "color": ""},
    {"id": "tue-parker", "wd": 2, "start": "16:00", "end": "16:45", "type": "Client Meeting", "title": "Post-Settlement Meeting: Peter Parker", "location": "", "notes": "Name: Peter Parker\nCB Number: 805-123-4567\nDOL: October 18, 2025\nSpecial Note: Ensure full breakdown available.", "color": ""},
    {"id": "tue-late", "wd": 2, "start": "17:00", "end": "23:59", "type": "Blocked Time", "title": "No Schedule Block", "location": "", "notes": "", "color": ""},
    {"id": "wed-early", "wd": 3, "start": "00:00", "end": "08:00", "type": "Blocked Time", "title": "No Schedule Block", "location": "", "notes": "", "color": ""},
    {"id": "wed-review", "wd": 3, "start": "08:00", "end": "08:30", "type": "Blocked Time", "title": "Daily Case and Email Review", "location": "", "notes": "", "color": ""},
    {"id": "wed-shepherd", "wd": 3, "start": "09:30", "end": "10:00", "type": "Phone Call", "title": "Medical Records Review: Derek Shepherd", "location": "", "notes": "Name: Derek Shepherd\nCB Number: 805-123-4567\nDOL: January 14, 2026\nSpecial Note: Review new PT notes", "color": ""},
    {"id": "wed-walker", "wd": 3, "start": "10:15", "end": "10:45", "type": "Phone Call", "title": "New Intake Consultation: Amanda Walker", "location": "", "notes": "Name: Amanda Walker\nCB Number: 805-123-4567\nDOL: April 15, 2026\nSpecial Note: New Intake Consultation; client seems to be in a hurry.", "color": ""},
    {"id": "wed-lunch", "wd": 3, "start": "12:00", "end": "13:00", "type": "Blocked Time", "title": "Lunch Break", "location": "", "notes": "", "color": ""},
    {"id": "wed-montez", "wd": 3, "start": "14:00", "end": "14:45", "type": "Client Meeting", "title": "Deposition Preparation: Gabriella Montez", "location": "", "notes": "Name: Gabriella Montez\nCB Number: 805-123-4567\nDOL: May 16, 2025\nSpecial Note: Preparation for Deposition", "color": ""},
    {"id": "wed-magsaysay", "wd": 3, "start": "15:45", "end": "16:45", "type": "Internal Meeting", "title": "Discovery Conference: Ramon Magsaysay", "location": "", "notes": "Name: Ramon Magsaysay\nCB Number: 805-123-4567\nDOL: January 03, 2025\nSpecial Note: Review Interrogatories & RFPs", "color": ""},
    {"id": "wed-late", "wd": 3, "start": "17:00", "end": "23:59", "type": "Blocked Time", "title": "No Schedule Block", "location": "", "notes": "", "color": ""},
    {"id": "thu-early", "wd": 4, "start": "00:00", "end": "08:00", "type": "Blocked Time", "title": "No Schedule Block", "location": "", "notes": "", "color": ""},
    {"id": "thu-review", "wd": 4, "start": "08:00", "end": "08:30", "type": "Blocked Time", "title": "Daily Case and Email Review", "location": "", "notes": "", "color": ""},
    {"id": "thu-johnson", "wd": 4, "start": "09:30", "end": "10:00", "type": "Phone Call", "title": "Client Consultation: New PI Case - Magic Johnson", "location": "", "notes": "Name: Magic Johnson\nCB Number: 805-123-4567\nDOL: March 01, 2026\nSpecial Note: New PI Case: Client will be driving during the meeting.", "color": ""},
    {"id": "thu-curtis", "wd": 4, "start": "10:30", "end": "11:00", "type": "Phone Call", "title": "Document Review Follow-Up: Anne Curtis", "location": "", "notes": "Name: Anne Curtis\nCB Number: 805-123-4567\nDOL: February 20, 2026\nSpecial Note: Review Contract Documents: Zoom Meeting", "color": ""},
    {"id": "thu-lunch", "wd": 4, "start": "12:00", "end": "13:00", "type": "Blocked Time", "title": "Lunch Break", "location": "", "notes": "", "color": ""},
    {"id": "thu-stark", "wd": 4, "start": "14:30", "end": "15:00", "type": "Phone Call", "title": "Client Consultation: New PI Case - Tony Stark", "location": "", "notes": "Name: Tony Stark\nCB Number: 805-123-4567\nDOL: April 20, 2026\nSpecial Note: New PI Case: Client prefers to have meeting via Zoom.", "color": ""},
    {"id": "thu-blaire", "wd": 4, "start": "15:15", "end": "15:45", "type": "Phone Call", "title": "Case Review Consultation: Linda Blaire", "location": "", "notes": "Name: Linda Blaire\nCB Number: 805-123-4567\nDOL: March 08, 2026\nSpecial Note: Possible wrongful termination.", "color": ""},
    {"id": "thu-late", "wd": 4, "start": "17:00", "end": "23:59", "type": "Blocked Time", "title": "No Schedule Block", "location": "", "notes": "", "color": ""},
    {"id": "fri-early", "wd": 5, "start": "00:00", "end": "08:00", "type": "Blocked Time", "title": "No Schedule Block", "location": "", "notes": "", "color": ""},
    {"id": "fri-review", "wd": 5, "start": "08:00", "end": "08:30", "type": "Blocked Time", "title": "Daily Case and Email Review", "location": "", "notes": "", "color": ""},
    {"id": "fri-davidson", "wd": 5, "start": "09:00", "end": "09:45", "type": "Client Meeting", "title": "Case Strategy Meeting: Harley Davidson", "location": "", "notes": "Name: Harley Davidson\nCB Number: 805-123-4567\nDOL: December 20, 2025\nSpecial Note: Litigation Planning", "color": ""},
    {"id": "fri-hawkins", "wd": 5, "start": "11:00", "end": "11:30", "type": "Phone Call", "title": "Attorney Phone Consultation Meeting: Stephen Hawkins", "location": "", "notes": "Name: Stephen Hawkins\nCB Number: 805-123-4567\nDOL: November 11, 2025\nSpecial Note: Need clarification with Demand", "color": ""},
    {"id": "fri-lunch", "wd": 5, "start": "12:00", "end": "13:00", "type": "Blocked Time", "title": "Lunch Break", "location": "", "notes": "", "color": ""},
    {"id": "fri-charles", "wd": 5, "start": "13:00", "end": "13:30", "type": "Phone Call", "title": "Follow Up Call: Existing Client - Rupaul Charles", "location": "", "notes": "Name: Rupaul Charles\nCB Number: 805-123-4567\nDOL: February 17, 2026\nSpecial Note: Existing PI Client. Follow-up on insurance update.", "color": ""},
    {"id": "fri-bell", "wd": 5, "start": "14:30", "end": "15:00", "type": "Phone Call", "title": "Case Status Updates: Alexander Graham Bell", "location": "", "notes": "Name: Alexander Graham Bell\nCB Number: 805-123-4567\nDOL: November 08, 2025\nSpecial Note: Insurance update ready for review.", "color": ""},
    {"id": "fri-franklin", "wd": 5, "start": "15:30", "end": "16:00", "type": "Phone Call", "title": "Document Signing: Aretha Franklin", "location": "", "notes": "Name: Aretha Franklin\nCB Number: 805-123-4567\nDOL: June 02, 2025\nSpecial Note: Settlement Documents, in-office meeting.", "color": ""},
    {"id": "fri-late", "wd": 5, "start": "17:00", "end": "23:59", "type": "Blocked Time", "title": "No Schedule Block", "location": "", "notes": "", "color": ""}
];

// Google Calendar's event colors
const GCAL_COLORS = { tomato: '#d50000', flamingo: '#e67c73', tangerine: '#f4511e', banana: '#f6bf26', sage: '#33b679', basil: '#0b8043',
    peacock: '#039be5', blueberry: '#3f51b5', lavender: '#7986cb', grape: '#8e24aa', graphite: '#616161' };
const GCAL_CALENDARS = [
    { id: 'attorney', name: 'Attorney\'s Calendar', color: '#039be5', owner: 'Atty. (the firm\'s attorney)', mine: false },
    { id: 'lsh', name: 'LSH Calendar', color: '#f09300', owner: 'You', mine: true },
    { id: 'holidays', name: 'Holidays in United States', color: '#0b8043', other: true, readOnly: true }
];
// US holidays (all day, on the Holidays calendar)
const GCAL_HOLIDAYS = [['2026-09-07', 'Labor Day'], ['2026-10-12', 'Columbus Day'], ['2026-10-31', 'Halloween'], ['2026-11-03', 'Election Day'],
    ['2026-11-11', 'Veterans Day'], ['2026-11-26', 'Thanksgiving Day'], ['2026-11-27', 'Day after Thanksgiving'], ['2026-12-24', 'Christmas Eve'],
    ['2026-12-25', 'Christmas Day'], ['2026-12-31', 'New Year\'s Eve'], ['2027-01-01', 'New Year\'s Day'], ['2027-01-18', 'Martin Luther King Jr. Day'],
    ['2027-02-15', 'Presidents\' Day'], ['2027-05-31', 'Memorial Day'], ['2027-06-19', 'Juneteenth'], ['2027-07-04', 'Independence Day']];

const GCAL_OFFICE = '400 Commerce Street, Suite 1200';
const GCAL_RULES = {
    scheduling: [
        'Identify available slots only.',
        'Avoid lunch, buffer time, and blocked events.',
        'Offer 2–3 alternative times when a requested slot is unavailable.',
        'Clarify meeting type (phone, video, or in-person).',
        'Plot the appointment in the attorney’s calendar.',
        'Calendar should be in EST time zone.',
        'Set an email reminder a day before the event.'
    ],
    notes: [
        'The attorney does not take new client consults after 5:00 PM.',
        'New client consults are only scheduled on Tuesdays and Thursdays.',
        'The attorney accepts max 3 new client consults per day.',
        'Phone consults, status updates, follow up calls, review, regular and urgent meetings, and signing meetings are max 30 minutes.',
        'Follow-ups are not scheduled during mornings.',
        'All consultation meetings are phone consults only.',
        'Phone consults only between 9:30 AM – 3:00 PM; Attorney will call the client – VA must confirm callback number.',
        'Preparation, strategy, and settlement meetings are max 45 minutes.',
        'Conference meetings are max 1 hour.',
        'Attorney requires 15-minute buffer before and after every meeting.',
        'Same-day bookings require attorney approval.'
    ],
    collect: ['Name', 'Callback Number', 'Date of Birth (DOB)', 'Date of Loss (DOL)'],
    title: 'Use the request type and the client’s name, e.g. Client Consultation: New PI Case – Jane Doe.'
};
// What a request type is under the rules: its length cap, whether it's a (phone-only) consult, a new client
// consult (Tuesdays and Thursdays, 3 a day), a follow-up (afternoons only).
const GCAL_TYPES = {
    'Client Consultation: New PI Case': { max: 30, consult: true, newClient: true },
    'New Intake Consultation': { max: 30, consult: true, newClient: true },
    'Attorney Phone Consultation': { max: 30, consult: true },
    'Case Review Consultation': { max: 30, consult: true },
    'Missed Call Consultation': { max: 30, consult: true },
    'Document Review Follow-Up': { max: 30, followUp: true },
    'Follow-Up Call (Existing Client)': { max: 30, followUp: true },
    'Case Status Update': { max: 30 },
    'Medical Records Review': { max: 30 },
    'Urgent Meeting Request': { max: 30 },
    'Document Signing': { max: 30 },
    'Deposition Preparation': { max: 45 },
    'Mediation Preparation Call': { max: 45 },
    'Case Strategy Meeting': { max: 45 },
    'Post-Settlement Meeting': { max: 45 },
    'Discovery Conference': { max: 60 }
};

const GCAL_REQUESTS = [
    { id: 'new-ashford', kind: 'book', type: 'Client Consultation: New PI Case', name: 'Gabriel Ashford', newClient: true,
      cb: '(555) 010-7731', dob: '05/14/1988', dol: '09/30/2026', mood: 'Anxious',
      said: 'I was rear-ended at a red light on I-95 last Wednesday. My neck still hurts and the other driver’s insurance keeps calling me. Can the lawyer see me Monday morning? Honestly any day works, I just want to talk to someone soon.',
      when: 0, days: [1, 2, 3, 4, 5, 8, 9, 10, 11, 12], from: '09:00', to: '17:00', meeting: 'phone',
      notesNeed: [['new PI', 'new case', 'new client'], ['rear', 'I-95']] },
    { id: 'new-clarke', kind: 'book', type: 'New Intake Consultation', name: 'Imani Clarke', newClient: true,
      cb: '(555) 010-7745', dob: '12/02/1979', dol: '10/01/2026', mood: 'Easy-going',
      said: 'I slipped on a wet floor at a pharmacy and hurt my wrist. A friend told me to call you. Next week works, Thursday after lunch would be best. Please call my cell.',
      when: 1, days: [4], from: '13:00', to: '17:00', meeting: 'phone',
      notesNeed: [['new intake', 'intake'], ['slip', 'wet floor', 'pharmacy']] },
    { id: 'drf-lee', kind: 'book', type: 'Document Review Follow-Up', name: 'Marcus Lee', mc: 'MC-28', caseNo: 'LSH-2026-ESCO-901969',
      cb: '(555) 010-6660', dob: '05/19/2000', dol: '09/05/2026', mood: 'Impatient',
      said: 'I emailed my wage-loss letter and the ER bills last week. I want to go over them with the attorney on a video call, not just phone. This week, Wednesday or Thursday. I’m at work until noon.',
      when: 0, days: [3, 4], from: '12:00', to: '17:00', meeting: 'video',
      notesNeed: [['wage', 'bills', 'documents']] },
    { id: 'csm-donovan', kind: 'book', type: 'Case Strategy Meeting', name: 'Rachel Donovan', mc: 'MC-18', caseNo: 'LSH-2026-PROD-901476',
      cb: '(555) 010-6183', dob: '11/27/1986', dol: '07/04/2026', mood: 'Calm but worried',
      said: 'Atty. Brooks asked me to come in about the product defect case and plan next steps. I can come to the office next week, Monday to Wednesday, mornings only.',
      when: 1, days: [1, 2, 3], from: '08:00', to: '12:00', meeting: 'office',
      notesNeed: [['strategy', 'planning', 'next steps', 'product']] },
    { id: 'mrr-lewis', kind: 'book', type: 'Medical Records Review', name: 'Patricia Lewis', mc: 'MC-15', caseNo: 'LSH-2026-MVA-901688',
      cb: '(555) 010-5850', dob: '01/14/1946', dol: '08/03/2026', mood: 'Soft-spoken, a little hard of hearing',
      said: 'My physical therapist sent new notes. The attorney wanted to go over them with me by phone. Thursday or Friday this week, mornings are best for me. Please speak up when you call.',
      when: 0, days: [4, 5], from: '08:00', to: '12:00', meeting: 'phone',
      notesNeed: [['PT', 'physical therapy', 'therap']] },
    { id: 'apc-reed', kind: 'book', type: 'Attorney Phone Consultation', name: 'Tanya Reed', mc: 'MC-31', caseNo: 'LSH-2025-DOG-900722',
      cb: '(555) 010-6690', dob: '04/25/1990', dol: '04/12/2025', mood: 'Irritated',
      said: 'I don’t understand the counter-offer letter the insurance sent. I need the attorney to explain the demand and what happens now. Next week, Tuesday or Wednesday, between 10 and noon.',
      when: 1, days: [2, 3], from: '10:00', to: '12:00', meeting: 'phone',
      notesNeed: [['demand', 'offer', 'counter']] },
    { id: 'sign-jackson', kind: 'book', type: 'Document Signing', name: 'Latoya Jackson', mc: 'MC-33', caseNo: 'LSH-2024-MVA-900242',
      cb: '(555) 010-6710', dob: '01/09/1987', dol: '10/15/2024', mood: 'Happy, chatty',
      said: 'I got the email that my settlement papers are ready to sign! I can come to the office this Friday or next Monday, any time.',
      when: 0, days: [5, 8], from: '08:00', to: '17:00', meeting: 'office',
      notesNeed: [['settlement', 'sign']] },
    { id: 'post-okonkwo', kind: 'book', type: 'Post-Settlement Meeting', name: 'Ngozi Okonkwo', mc: 'MC-11', caseNo: 'LSH-2025-MVA-900639',
      cb: '(555) 010-5412', dob: '10/10/1979', dol: '04/02/2025', mood: 'Emotional',
      said: 'The case settled and I want to sit down with the attorney and see where all the money goes: the liens, the fees, everything. Next week, Wednesday or Thursday afternoon, in person.',
      when: 1, days: [3, 4], from: '13:00', to: '17:00', meeting: 'office',
      notesNeed: [['breakdown', 'liens', 'fees', 'disbursement']] },
    { id: 'fu-coleman', kind: 'book', type: 'Follow-Up Call (Existing Client)', name: 'Andre Coleman', mc: 'MC-17', caseNo: 'LSH-2026-BICY-901803',
      cb: '(555) 010-6071', dob: '09/03/1991', dol: '08/21/2026', mood: 'Easy-going',
      said: 'The insurance adjuster finally called me back about my bike claim. Can the attorney follow up with me? This week, Wednesday or Friday.',
      when: 0, days: [3, 5], from: '08:00', to: '17:00', meeting: 'phone',
      notesNeed: [['insurance', 'adjuster']] },
    { id: 'csu-boateng', kind: 'book', type: 'Case Status Update', name: 'Samuel Boateng', mc: 'MC-19', caseNo: 'LSH-2026-MVA-901409',
      cb: '(555) 010-6295', dob: '02/14/1970', dol: '06/30/2026', mood: 'Calm',
      said: 'I got a message that there’s an insurance update on my case. I’d like a call to go over it. Next week, Monday or Tuesday, any time.',
      when: 1, days: [1, 2], from: '08:00', to: '17:00', meeting: 'phone',
      notesNeed: [['insurance', 'update']] },
    { id: 'dc-shaughnessy', kind: 'book', type: 'Discovery Conference', name: 'Saoirse Shaughnessy', mc: 'MC-47', caseNo: 'LSH-2023-SNF-902517',
      cb: '(555) 010-6910', dob: '06/06/1955', dol: '09/29/2023', mood: 'Formal',
      said: 'Atty. Brooks’s office asked me to come in to go over the interrogatories and the requests for production. I can come in next week, Tuesday or Thursday, any time after 10.',
      when: 1, days: [2, 4], from: '10:00', to: '17:00', meeting: 'office',
      notesNeed: [['interrogator', 'RFP', 'requests for production']] },
    { id: 'urgent-beauchamp', kind: 'book', type: 'Urgent Meeting Request', name: 'Schuyler Beauchamp', mc: 'MC-37', caseNo: 'LSH-2025-MVA-902417',
      cb: '(555) 010-6810', dob: '01/03/2000', dol: '07/02/2025', mood: 'Upset, in a hurry',
      said: 'The other side’s adjuster called me directly and offered me money if I sign today. I need to talk to my attorney TODAY, at 3 if possible, on a video call.',
      when: 0, days: [0], from: '08:00', to: '17:00', meeting: 'video', sameDay: true,
      notesNeed: [['adjuster', 'offer', 'urgent']] },
    // already on the calendar: move it, or take it off
    { id: 'move-charles', kind: 'move', seed: 'fri-charles', name: 'Rupaul Charles', cb: '805-123-4567', dob: '11/17/1960', dol: '02/17/2026', mood: 'Apologetic',
      said: 'I have a follow-up call with the attorney on Friday at 1 about my insurance, but I have a doctor’s appointment then. Can we move it to Thursday afternoon instead?',
      when: 0, days: [4], from: '12:00', to: '17:00', type: 'Follow-Up Call (Existing Client)' },
    { id: 'move-henderson', kind: 'move', seed: 'tue-henderson', name: 'Logan Henderson', cb: '805-123-4567', dob: '08/09/1985', dol: '11/18/2025', mood: 'Polite',
      said: 'I’m booked for a status call on Tuesday at 1, but I can’t be on the phone then. Is Wednesday afternoon open?',
      when: 0, days: [3], from: '12:00', to: '17:00', type: 'Case Status Update' },
    { id: 'cancel-bell', kind: 'cancel', seed: 'fri-bell', name: 'Alexander Graham Bell', cb: '805-123-4567', dob: '03/03/1947', dol: '11/08/2025', mood: 'Busy',
      said: 'Please cancel my status call on Friday. I’ll call back next week to set a new time.' },
    { id: 'cancel-franklin', kind: 'cancel', seed: 'fri-franklin', name: 'Aretha Franklin', cb: '805-123-4567', dob: '03/25/1942', dol: '06/02/2025', mood: 'Apologetic',
      said: 'I’m so sorry, I’m out of town this Friday, so I can’t come in to sign my settlement documents. Can you cancel it? I’ll call to reschedule when I’m back.' }
];

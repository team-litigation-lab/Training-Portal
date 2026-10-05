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
   • TRACKS (GCAL_TRACKS): the same simulator for three programs, picked by gcal.html?track=standard|cm|ea.
     Standard Training (Foundational · Calendar Management) is the baseline above (GCAL_STD_*). The Case Management
     (Litigation Week) and EA / PA (Executive Week) simulators are clones of it: the same Google Calendar, the same
     way of putting a caller's appointment on the calendar and the same check, with their own week, callers, rules
     and request types (GCAL_CM_*, GCAL_EA_*). GCAL_CFG holds what the check reads from the track: the hours, the
     buffer, the consult window, the new-client days, the details a description needs, and the wording
     (who: the attorney or the executive).
*/
const GCAL_STD_ATTORNEY = [
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

const GCAL_STD_OFFICE = '400 Commerce Street, Suite 1200';
const GCAL_STD_RULES = {
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
const GCAL_STD_TYPES = {
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

const GCAL_STD_REQUESTS = [
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

/* ================= the tracks ================= */
// Standard Training: the Foundational Training baseline above, exactly as it was built.
const GCAL_STD_CFG = { who: null, open: 8 * 60, close: 17 * 60, buffer: 15, consultFrom: 9 * 60 + 30, consultTo: 15 * 60, newClientDays: [2, 4], newClientMax: 3,
    followUpFrom: 12 * 60, fields: ['dob', 'dol'], scenario: 'Calendar Management', label: 'Standard Training', lead: 'Calendar Management (Day 6).' };

/* ---------- Case Management: a litigation attorney's week (Litigation Week) ---------- */
const GCAL_CM_ATTORNEY = (() => {
    const note = (n, cb, dol, sp) => `Name: ${n}\nCB Number: ${cb}\nDOL: ${dol}\nSpecial Notes: ${sp}`;
    const blk = (id, wd, start, end, title) => ({ id, wd, start, end, type: 'Blocked Time', title, location: '', notes: '', color: '' });
    const row = (id, wd, start, end, type, title, notes) => ({ id, wd, start, end, type, title, location: '', notes: notes || '', color: '' });
    const out = [];
    [1, 2, 3, 4, 5].forEach((w, i) => { const d = ['mon', 'tue', 'wed', 'thu', 'fri'][i];
        out.push(blk(d + '-early', w, '00:00', '08:00', 'No Schedule Block'), blk(d + '-review', w, '08:00', '08:30', 'Daily Case and Email Review'),
            blk(d + '-lunch', w, '12:00', '13:00', 'Lunch Break'), blk(d + '-late', w, '17:00', '23:59', 'No Schedule Block')); });
    out.push(
        row('mon-team', 1, '09:00', '10:00', 'Internal Meeting', 'Litigation Team Meeting', 'Weekly case list with the paralegals.'),
        row('mon-pierce', 1, '10:30', '11:15', 'Client Meeting', 'Deposition Preparation: Dwayne Pierce', note('Dwayne Pierce', '805-123-4567', 'March 12, 2025', 'Prepare for his deposition on Thursday.')),
        row('mon-holt', 1, '14:00', '14:30', 'Phone Call', 'Adjuster Negotiation Call: Karen Holt', note('Karen Holt', '805-123-4567', 'June 03, 2025', 'Second counter-offer from the carrier.')),
        row('mon-haddad', 1, '15:15', '16:00', 'Client Meeting', 'Mediation Preparation Call: Omar Haddad', note('Omar Haddad', '805-123-4567', 'August 19, 2025', 'Mediation is in two weeks.')),
        blk('tue-court', 2, '09:00', '12:00', 'Court: Motion Hearing (travel included)'),
        row('tue-torres', 2, '13:00', '13:30', 'Phone Call', 'Treatment Status Call: Bianca Torres', note('Bianca Torres', '805-123-4567', 'January 22, 2026', 'Update on her physical therapy.')),
        row('tue-hargrove', 2, '14:30', '15:30', 'Internal Meeting', 'Discovery Conference: Hargrove Case', 'Interrogatories and requests for production.'),
        row('tue-calloway', 2, '16:00', '16:30', 'Phone Call', 'Case Status Update: Wes Calloway', note('Wes Calloway', '805-123-4567', 'November 02, 2025', 'Wants to know where the case stands.')),
        row('wed-reyes', 3, '09:30', '10:30', 'Phone Call', 'Expert Witness Call: Dr. Imani Reyes', 'Her report on the spinal injury.'),
        row('wed-whitfield', 3, '10:45', '11:30', 'Client Meeting', 'Demand Review Meeting: Paula Whitfield', note('Paula Whitfield', '805-123-4567', 'September 14, 2025', 'Go over the demand letter before it goes out.')),
        blk('wed-depoblock', 3, '14:00', '15:00', 'Deposition Block: Defendant Marsh (virtual)'),
        row('wed-pike', 3, '15:30', '16:00', 'Phone Call', 'Medical Records Review: Jonah Pike', note('Jonah Pike', '805-123-4567', 'December 08, 2025', 'New ER and MRI records came in.')),
        blk('thu-depo', 4, '08:30', '12:00', 'Deposition: Marsh v. Delta Freight (out of office)'),
        row('thu-walsh', 4, '13:30', '14:15', 'Client Meeting', 'Settlement Conference: Teresa Walsh', note('Teresa Walsh', '805-123-4567', 'July 07, 2025', 'Review the offer and the lien amounts.')),
        row('thu-vega', 4, '15:00', '15:30', 'Phone Call', 'Case Status Update: Mario Vega', note('Mario Vega', '805-123-4567', 'February 28, 2026', 'Wants an update after the carrier’s letter.')),
        row('fri-park', 5, '09:00', '09:30', 'Phone Call', 'Client Verification Call: Helen Park', note('Helen Park', '805-123-4567', 'October 30, 2025', 'Confirm her contact details and treatment.')),
        row('fri-strategy', 5, '10:00', '11:00', 'Internal Meeting', 'Weekly Case Strategy Meeting', 'The attorney and the case managers.'),
        blk('fri-focus', 5, '13:00', '14:00', 'Focus Block: Draft Motions (no meetings)'),
        row('fri-bell', 5, '14:30', '15:00', 'Phone Call', 'Treatment Status Call: Marcus Bell', note('Marcus Bell', '805-123-4567', 'April 09, 2026', 'Update on his treatment plan.')));
    return out;
})();
const GCAL_CM_OFFICE = '400 Commerce Street, Suite 1200';
const GCAL_CM_RULES = {
    scheduling: GCAL_STD_RULES.scheduling,
    notes: [
        'The attorney is in court or at depositions on the blocked days: never book over a hearing, a deposition or a focus block.',
        'Case status updates, treatment status calls, records reviews, verification calls, adjuster and expert calls are max 30 minutes.',
        'Treatment status calls and other follow-ups are not scheduled during mornings.',
        'Demand review and mediation preparation meetings are max 45 minutes.',
        'Deposition preparation, settlement conferences and discovery conferences are max 1 hour.',
        'Video calls (experts, mediation prep) need a Google Meet link; phone calls do not.',
        'Attorney requires 15-minute buffer before and after every meeting.',
        'Same-day bookings require attorney approval.'
    ],
    collect: GCAL_STD_RULES.collect,
    title: GCAL_STD_RULES.title
};
const GCAL_CM_TYPES = {
    'Case Status Update': { max: 30 },
    'Treatment Status Call': { max: 30, followUp: true },
    'Medical Records Review': { max: 30 },
    'Client Verification Call': { max: 30 },
    'Adjuster Negotiation Call': { max: 30 },
    'Expert Witness Call': { max: 30 },
    'Urgent Meeting Request': { max: 30 },
    'Demand Review Meeting': { max: 45 },
    'Mediation Preparation Call': { max: 45 },
    'Deposition Preparation': { max: 60 },
    'Settlement Conference': { max: 60 },
    'Discovery Conference': { max: 60 }
};
const GCAL_CM_REQUESTS = [
    { id: 'csu-diaz', kind: 'book', type: 'Case Status Update', name: 'Rosa Diaz', cb: '(555) 020-4410', dob: '03/18/1984', dol: '10/11/2025', mood: 'Calm',
      said: 'It’s been a month since I heard anything on my case. Could the attorney call me with an update? Any day this week works.',
      when: 0, days: [1, 2, 3, 4, 5], from: '08:00', to: '17:00', meeting: 'phone', notesNeed: [['status', 'update']] },
    { id: 'trt-okoye', kind: 'book', type: 'Treatment Status Call', name: 'Chinedu Okoye', cb: '(555) 020-4421', dob: '07/02/1990', dol: '12/19/2025', mood: 'Easy-going',
      said: 'I finished my third month of physical therapy and my doctor wants to talk about next steps. Wednesday or next Monday afternoon is best for me.',
      when: 1, days: [1, 3], from: '12:00', to: '17:00', meeting: 'phone', notesNeed: [['therapy', 'treatment', 'PT']] },
    { id: 'mrr-santos', kind: 'book', type: 'Medical Records Review', name: 'Elena Santos', cb: '(555) 020-4432', dob: '11/09/1972', dol: '09/04/2025', mood: 'Quiet',
      said: 'My new MRI report came in and the attorney wanted to go through it with me. I can do Wednesday or Friday this week, in the morning.',
      when: 0, days: [3, 5], from: '08:00', to: '12:00', meeting: 'phone', notesNeed: [['MRI', 'records']] },
    { id: 'dp-lamar', kind: 'book', type: 'Deposition Preparation', name: 'Tyrell Lamar', cb: '(555) 020-4443', dob: '05/30/1981', dol: '08/22/2025', mood: 'Nervous',
      said: 'My deposition is coming up and I’m nervous. I’d like to come in and practice with the attorney. Next Monday or Wednesday, any time.',
      when: 1, days: [1, 3], from: '08:00', to: '17:00', meeting: 'office', notesNeed: [['deposition']] },
    { id: 'mpc-ferris', kind: 'book', type: 'Mediation Preparation Call', name: 'Gwen Ferris', cb: '(555) 020-4454', dob: '02/14/1976', dol: '06/27/2025', mood: 'Determined',
      said: 'Our mediation is next week and I’d like a video call to go over what to expect. Thursday or Friday afternoon this week.',
      when: 0, days: [4, 5], from: '12:00', to: '17:00', meeting: 'video', notesNeed: [['mediation']] },
    { id: 'ewc-ahmed', kind: 'book', type: 'Expert Witness Call', name: 'Dr. Samir Ahmed', cb: '(555) 020-4465', dob: '09/21/1968', dol: '04/16/2025', mood: 'Formal',
      said: 'This is Dr. Ahmed, the orthopedic expert on the Valdez case. I can walk the attorney through my findings on a video call next Tuesday or Thursday, after 1.',
      when: 1, days: [2, 4], from: '13:00', to: '17:00', meeting: 'video', notesNeed: [['expert', 'orthopedic', 'findings']] },
    { id: 'dem-brooks', kind: 'book', type: 'Demand Review Meeting', name: 'Colin Brooks', cb: '(555) 020-4476', dob: '12/05/1985', dol: '07/13/2025', mood: 'Hopeful',
      said: 'I’d like to see the demand letter before it goes to the insurance company. I can come to the office Monday to Wednesday this week, afternoons.',
      when: 0, days: [1, 2, 3], from: '13:00', to: '17:00', meeting: 'office', notesNeed: [['demand']] },
    { id: 'adj-yoon', kind: 'book', type: 'Adjuster Negotiation Call', name: 'Min-jun Yoon', cb: '(555) 020-4487', dob: '04/08/1993', dol: '01/25/2026', mood: 'Businesslike',
      said: 'The adjuster called with a new offer and I want the attorney to handle it. Next Monday or Tuesday morning, please.',
      when: 1, days: [1, 2], from: '08:00', to: '12:00', meeting: 'phone', notesNeed: [['adjuster', 'offer']] },
    { id: 'cvc-novak', kind: 'book', type: 'Client Verification Call', name: 'Ivana Novak', cb: '(555) 020-4498', dob: '08/17/1979', dol: '11/30/2025', mood: 'Chatty',
      said: 'Your office asked me to confirm my address and my doctors. Any day this week, whenever the attorney has a few minutes.',
      when: 0, days: [1, 2, 3, 4, 5], from: '08:00', to: '17:00', meeting: 'phone', notesNeed: [['verify', 'verification', 'address']] },
    { id: 'sc-reilly', kind: 'book', type: 'Settlement Conference', name: 'Declan Reilly', cb: '(555) 020-4509', dob: '06/12/1970', dol: '03/05/2025', mood: 'Serious',
      said: 'The defense made a settlement offer and I need to sit down with the attorney. I can come in next Tuesday or Wednesday afternoon.',
      when: 1, days: [2, 3], from: '13:00', to: '17:00', meeting: 'office', notesNeed: [['settlement', 'offer']] },
    { id: 'urgent-quigley', kind: 'book', type: 'Urgent Meeting Request', name: 'Fiona Quigley', cb: '(555) 020-4520', dob: '01/20/1988', dol: '09/29/2025', mood: 'Upset, in a hurry',
      said: 'The insurance company sent me a letter saying they will close my claim today. I need to talk to my attorney TODAY, on a video call if possible.',
      when: 0, days: [0], from: '08:00', to: '17:00', meeting: 'video', sameDay: true, notesNeed: [['claim', 'closing', 'urgent']] },
    // already on the calendar: move it, or take it off
    { id: 'move-whitfield', kind: 'move', seed: 'wed-whitfield', name: 'Paula Whitfield', cb: '805-123-4567', dob: '04/22/1978', dol: '09/14/2025', mood: 'Apologetic',
      said: 'I have a demand review meeting with the attorney on Wednesday at 10:45, but I have a work conflict. Could we move it to Monday or Tuesday afternoon?',
      when: 0, days: [1, 2], from: '13:00', to: '17:00', type: 'Demand Review Meeting' },
    { id: 'move-walsh', kind: 'move', seed: 'thu-walsh', name: 'Teresa Walsh', cb: '805-123-4567', dob: '09/11/1969', dol: '07/07/2025', mood: 'Polite',
      said: 'My settlement conference is Thursday at 1:30, but my ride fell through. Is Friday afternoon, after 3, possible?',
      when: 0, days: [5], from: '15:00', to: '17:00', type: 'Settlement Conference' },
    { id: 'cancel-bell', kind: 'cancel', seed: 'fri-bell', name: 'Marcus Bell', cb: '805-123-4567', dob: '10/03/1983', dol: '04/09/2026', mood: 'Busy',
      said: 'Please cancel my treatment status call on Friday. I’m starting a new treatment plan and I’ll call back when I know more.' },
    { id: 'cancel-torres', kind: 'cancel', seed: 'tue-torres', name: 'Bianca Torres', cb: '805-123-4567', dob: '12/15/1991', dol: '01/22/2026', mood: 'Apologetic',
      said: 'I’m sorry, my therapist rescheduled me, so I can’t do the Tuesday call. Please cancel it, and I’ll call to set a new time.' }
];
const GCAL_CM_CFG = { who: null, open: 8 * 60, close: 17 * 60, buffer: 15, consultFrom: 0, consultTo: 24 * 60, newClientDays: null, newClientMax: 3,
    followUpFrom: 12 * 60, fields: ['dob', 'dol'], scenario: 'Litigation Week · Case Management', label: 'Litigation Week', lead: 'Case Management: the litigation attorney’s week.' };

/* ---------- EA / PA: the executive's week (Executive Week) ---------- */
const GCAL_EA_ATTORNEY = (() => {
    const note = (n, cb, org, sp) => `Name: ${n}\nCB Number: ${cb}\nCompany: ${org}\nPurpose: ${sp}`;
    const blk = (id, wd, start, end, title) => ({ id, wd, start, end, type: 'Blocked Time', title, location: '', notes: '', color: '' });
    const row = (id, wd, start, end, type, title, notes) => ({ id, wd, start, end, type, title, location: '', notes: notes || '', color: '' });
    const out = [];
    [1, 2, 3, 4, 5].forEach((w, i) => { const d = ['mon', 'tue', 'wed', 'thu', 'fri'][i];
        out.push(blk(d + '-early', w, '00:00', '08:00', 'No Schedule Block'), blk(d + '-review', w, '08:00', '08:30', 'Daily Briefing with the EA'),
            blk(d + '-lunch', w, '12:00', '13:00', 'Lunch Break'), blk(d + '-late', w, '18:00', '23:59', 'No Schedule Block')); });
    out.push(
        row('mon-standup', 1, '09:00', '10:00', 'Internal Meeting', 'Leadership Stand-up', 'The executive team.'),
        row('mon-northgate', 1, '10:30', '11:30', 'Client Meeting', 'Investor Update Call: Northgate Capital', note('Daniel Ortiz', '212-555-0100', 'Northgate Capital', 'Quarterly update.')),
        row('mon-cfo', 1, '14:00', '15:00', 'Internal Meeting', 'Board Prep with the CFO', 'Numbers for the board deck.'),
        blk('tue-focus', 2, '09:00', '11:00', 'Focus Time: Strategy Planning'),
        row('tue-apex', 2, '13:00', '14:00', 'Client Meeting', 'Vendor Review: Apex Legal Tech', note('Mei Lin', '212-555-0111', 'Apex Legal Tech', 'Contract renewal.')),
        row('tue-press', 2, '15:00', '15:45', 'Phone Call', 'Press Interview: Law360', note('Sarah Whitlock', '212-555-0122', 'Law360', 'Interview on firm growth.')),
        row('wed-heads', 3, '09:30', '10:30', 'Internal Meeting', 'Department Heads 1:1s', 'Back-to-back 1:1s.'),
        row('wed-raman', 3, '11:00', '11:45', 'Phone Call', 'Candidate Interview: Priya Raman, VP Marketing', note('Priya Raman', '212-555-0133', 'Candidate', 'Second-round interview.')),
        blk('wed-board', 3, '14:00', '16:00', 'Board Meeting'),
        blk('thu-travel', 4, '08:30', '10:00', 'Travel: Client Site Visit'),
        row('thu-harbor', 4, '10:00', '12:00', 'Client Meeting', 'Site Visit: Harbor Point Insurance', note('Gregory Shaw', '212-555-0144', 'Harbor Point Insurance', 'Walk the claims floor.')),
        row('thu-meridian', 4, '14:00', '14:45', 'Client Meeting', 'Contract Review: Meridian Group', note('Alicia Moreau', '212-555-0155', 'Meridian Group', 'Review the services agreement.')),
        row('thu-beck', 4, '16:00', '16:30', 'Phone Call', 'Donor Call: Beck Foundation', note('Thomas Beck', '212-555-0166', 'Beck Foundation', 'Thank-you and next gift.')),
        row('fri-allhands', 5, '09:00', '10:00', 'Internal Meeting', 'All-hands', 'The whole firm.'),
        row('fri-coo', 5, '11:00', '11:30', 'Phone Call', 'Weekly Check-in: Chief of Staff', 'Priorities for the week ahead.'),
        blk('fri-focus', 5, '13:00', '15:00', 'Focus Block: No Meetings'),
        row('fri-wrap', 5, '15:30', '16:00', 'Phone Call', 'Wrap-up with the EA', 'Open items for next week.'));
    return out;
})();
const GCAL_EA_OFFICE = '200 Park Avenue, 20th Floor (Executive Suite)';
const GCAL_EA_RULES = {
    scheduling: [
        'Identify available slots only.',
        'Avoid lunch, buffer time, focus blocks, travel and blocked events.',
        'Offer 2–3 alternative times when a requested slot is unavailable.',
        'Clarify meeting type (phone, video, or in-person).',
        'Plot the appointment in the executive’s calendar.',
        'Calendar should be in EST time zone.',
        'Set an email reminder a day before the event.'
    ],
    notes: [
        'The executive takes no meetings before 8:00 AM or after 6:00 PM.',
        'Never book over the board meeting, travel, focus time or the all-hands.',
        'Phone calls, check-ins, press and donor calls are max 30 minutes.',
        'Candidate interviews, investor updates, vendor and contract reviews are max 45 minutes.',
        'Strategy meetings are max 1 hour.',
        'Interviews and press calls are on video: add a Google Meet link.',
        'Executive requires 15-minute buffer before and after every meeting.',
        'Same-day bookings require the executive’s approval.'
    ],
    collect: ['Name', 'Callback Number', 'Company / Organization', 'Purpose of the meeting'],
    title: 'Use the request type and the person’s name, e.g. Candidate Interview – Jane Doe.'
};
const GCAL_EA_TYPES = {
    'Executive 1:1': { max: 30 },
    'Press Interview': { max: 30 },
    'Donor Call': { max: 30 },
    'Partner Introduction Call': { max: 30 },
    'Urgent Meeting Request': { max: 30 },
    'Candidate Interview': { max: 45 },
    'Investor Update Call': { max: 45 },
    'Vendor Review': { max: 45 },
    'Contract Review': { max: 45 },
    'Strategy Meeting': { max: 60 }
};
const GCAL_EA_REQUESTS = [
    { id: 'ea-ci-bennett', kind: 'book', type: 'Candidate Interview', name: 'Marcus Bennett', cb: '(555) 030-1101', org: 'Candidate: Director of Operations', mood: 'Professional',
      said: 'I’m the finalist for Director of Operations and was asked to interview with the executive. I can do a video call Thursday or Friday afternoon this week.',
      when: 0, days: [4, 5], from: '13:00', to: '17:00', meeting: 'video', notesNeed: [['interview', 'candidate', 'operations']] },
    { id: 'ea-inv-solis', kind: 'book', type: 'Investor Update Call', name: 'Camila Solis', cb: '(555) 030-1112', org: 'Solis Ventures', mood: 'Direct',
      said: 'Solis Ventures would like a short update call with the executive next Tuesday or Wednesday, mornings, before the markets get busy.',
      when: 1, days: [2, 3], from: '08:00', to: '12:00', meeting: 'video', notesNeed: [['investor', 'update', 'Solis']] },
    { id: 'ea-vr-kline', kind: 'book', type: 'Vendor Review', name: 'Nathan Kline', cb: '(555) 030-1123', org: 'Kline Office Systems', mood: 'Friendly',
      said: 'We’re up for renewal and I’d like 45 minutes with the executive to go over the new pricing. I can come to the office Monday or Wednesday this week, afternoons.',
      when: 0, days: [1, 3], from: '13:00', to: '17:00', meeting: 'office', notesNeed: [['renewal', 'pricing', 'vendor']] },
    { id: 'ea-press-ruiz', kind: 'book', type: 'Press Interview', name: 'Elena Ruiz', cb: '(555) 030-1134', org: 'Legal Business Weekly', mood: 'Brisk',
      said: 'I’m writing about law-firm growth and would love 30 minutes with the executive on a video call. Tuesday or Thursday next week, afternoons are best.',
      when: 1, days: [2, 4], from: '13:00', to: '17:00', meeting: 'video', notesNeed: [['press', 'interview', 'article', 'growth']] },
    { id: 'ea-donor-hale', kind: 'book', type: 'Donor Call', name: 'Priscilla Hale', cb: '(555) 030-1145', org: 'Hale Family Trust', mood: 'Warm',
      said: 'The trust would like to speak with the executive about this year’s gift. A phone call this week, Wednesday or Friday, any time in the afternoon.',
      when: 0, days: [3, 5], from: '12:00', to: '17:00', meeting: 'phone', notesNeed: [['gift', 'donor', 'trust']] },
    { id: 'ea-1on1-cfo', kind: 'book', type: 'Executive 1:1', name: 'Rajesh Patel', cb: '(555) 030-1156', org: 'CFO', mood: 'Easy-going',
      said: 'I need 30 minutes with the executive to go over the budget before the board. Anytime Monday or Tuesday next week.',
      when: 1, days: [1, 2], from: '08:00', to: '18:00', meeting: 'office', notesNeed: [['budget', 'board']] },
    { id: 'ea-strat-wong', kind: 'book', type: 'Strategy Meeting', name: 'Alice Wong', cb: '(555) 030-1167', org: 'Chief of Staff', mood: 'Focused',
      said: 'We need an hour with the executive to plan the second half of the year. I can do Tuesday or Friday next week, any time.',
      when: 1, days: [2, 5], from: '08:00', to: '18:00', meeting: 'office', notesNeed: [['strategy', 'plan']] },
    { id: 'ea-partner-nash', kind: 'book', type: 'Partner Introduction Call', name: 'Victor Nash', cb: '(555) 030-1178', org: 'Nash & Cole LLP', mood: 'Courteous',
      said: 'A mutual contact suggested I introduce Nash & Cole to the executive. A phone call Monday or Wednesday this week would be ideal.',
      when: 0, days: [1, 3], from: '08:00', to: '18:00', meeting: 'phone', notesNeed: [['introduction', 'Nash', 'partner']] },
    { id: 'ea-cr-moreau', kind: 'book', type: 'Contract Review', name: 'Lena Moreau', cb: '(555) 030-1189', org: 'Moreau Staffing', mood: 'Careful',
      said: 'Our staffing agreement needs the executive’s sign-off. Could we meet at the office next Wednesday or Thursday afternoon?',
      when: 1, days: [3, 4], from: '13:00', to: '18:00', meeting: 'office', notesNeed: [['staffing', 'agreement', 'sign']] },
    { id: 'ea-urgent-fox', kind: 'book', type: 'Urgent Meeting Request', name: 'Dana Fox', cb: '(555) 030-1190', org: 'Chief Legal Officer', mood: 'Urgent',
      said: 'A regulator has called and the executive needs to hear about it today. Can we do a quick video call this afternoon?',
      when: 0, days: [0], from: '08:00', to: '18:00', meeting: 'video', sameDay: true, notesNeed: [['regulator', 'urgent']] },
    { id: 'ea-move-raman', kind: 'move', seed: 'wed-raman', name: 'Priya Raman', cb: '212-555-0133', org: 'Candidate', mood: 'Apologetic',
      said: 'I have the second-round interview on Wednesday at 11, but my current employer has me in a meeting then. Could we move it to Monday or Tuesday afternoon?',
      when: 0, days: [1, 2], from: '13:00', to: '18:00', type: 'Candidate Interview' },
    { id: 'ea-move-meridian', kind: 'move', seed: 'thu-meridian', name: 'Alicia Moreau', cb: '212-555-0155', org: 'Meridian Group', mood: 'Polite',
      said: 'Our contract review is Thursday at 2, but our counsel is traveling. Would Friday afternoon, after 3, work?',
      when: 0, days: [5], from: '15:00', to: '18:00', type: 'Contract Review' },
    { id: 'ea-cancel-press', kind: 'cancel', seed: 'tue-press', name: 'Sarah Whitlock', cb: '212-555-0122', org: 'Law360', mood: 'Rushed',
      said: 'My editor pulled the story, so please cancel the Tuesday interview. I’ll reach out if it comes back.' },
    { id: 'ea-cancel-beck', kind: 'cancel', seed: 'thu-beck', name: 'Thomas Beck', cb: '212-555-0166', org: 'Beck Foundation', mood: 'Gracious',
      said: 'I’m traveling this week, so I have to cancel the Thursday call. I’ll get in touch when I’m back.' }
];
const GCAL_EA_CFG = { who: { noun: 'executive', cal: 'Executive’s Calendar' }, open: 8 * 60, close: 18 * 60, buffer: 15, consultFrom: 0, consultTo: 24 * 60, newClientDays: null, newClientMax: 3,
    followUpFrom: 0, fields: [], scenario: 'Executive Week · EA / PA', label: 'Executive Week', lead: 'EA / PA: the executive’s week.' };

// The track this page runs (gcal.html?track=standard|cm|ea): the original Google Calendar Simulator is "standard".
const GCAL_TRACKS = {
    standard: { attorney: GCAL_STD_ATTORNEY, requests: GCAL_STD_REQUESTS, rules: GCAL_STD_RULES, types: GCAL_STD_TYPES, office: GCAL_STD_OFFICE, cfg: GCAL_STD_CFG },
    cm: { attorney: GCAL_CM_ATTORNEY, requests: GCAL_CM_REQUESTS, rules: GCAL_CM_RULES, types: GCAL_CM_TYPES, office: GCAL_CM_OFFICE, cfg: GCAL_CM_CFG },
    ea: { attorney: GCAL_EA_ATTORNEY, requests: GCAL_EA_REQUESTS, rules: GCAL_EA_RULES, types: GCAL_EA_TYPES, office: GCAL_EA_OFFICE, cfg: GCAL_EA_CFG }
};
const GCAL_TRACK = (() => { try { const t = new URLSearchParams(location.search).get('track'); return GCAL_TRACKS[t] ? t : 'standard'; } catch (e) { return 'standard'; } })();
const GCAL_ATTORNEY = GCAL_TRACKS[GCAL_TRACK].attorney, GCAL_REQUESTS = GCAL_TRACKS[GCAL_TRACK].requests, GCAL_RULES = GCAL_TRACKS[GCAL_TRACK].rules,
    GCAL_TYPES = GCAL_TRACKS[GCAL_TRACK].types, GCAL_OFFICE = GCAL_TRACKS[GCAL_TRACK].office, GCAL_CFG = GCAL_TRACKS[GCAL_TRACK].cfg;
// The calendar's name for the executive's week; the CM requests all belong to files.
if (GCAL_CFG.who) { GCAL_CALENDARS[0].name = GCAL_CFG.who.cal; GCAL_CALENDARS[0].owner = 'Executive (the firm\u2019s executive)'; }
GCAL_CM_REQUESTS.forEach((r, i) => { if (r.kind === 'book' && !r.caseNo) r.caseNo = 'LSH-2026-CM-' + (902110 + i * 37); });

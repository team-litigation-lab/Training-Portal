/* LSH Training Portal — Call Simulator pack: Standard Foundational Training.
   The curriculum's mock calls (Reception, Calendar Management, Intake), played on the
   training CMS's Training Library cases (MC-01 … MC-20, CaseManagementTraining/mock-cases.js).
   Case facts, verification rules, extensions and routing below are the CMS's own; if a case
   changes there, update its CASES entry and its calls here.
   Each call carries caseDoc {id, title, text}: the call brief shows it with a link that opens
   the case in the CMS, and the grader reads it as what the trainee had in front of them.
   Loaded by /simulators/call.html; adds to window.EXTRA_CALLERS. Opens first with ?program=FT. */
(function () {
    const CMS = 'https://lshcasemanagementtraining-trainingcrm.pages.dev/';
    const FIRM = `FIRM: LSH Training Law Group (fictional)
Main line (555) 010-2000 · Fax (555) 010-2099 · Mon–Fri 8:30 AM – 5:30 PM Eastern
Directory: Atty. Marcus Reyes (Lead, Pre-Litigation) 201 · Atty. Elena Brooks (Lead, Litigation) 202 · Atty. David Okafor (Associate / Intake Attorney) 203 · Janelle Price (Litigation Paralegal) 221 · Priya Natarajan (CM) 311 · Tom Alvarez (CM) 312 · Grace Kim (CM) 313 · Luis Ortega (CM, bilingual English/Spanish) 314 · Sam Whitaker (Demand) 331 · Rosa Delgado (Lien Negotiator) 341 · Kevin Lam (Property Damage) 351 · Intake Team 100 · Records Team 400 · Accounting / Disbursements 500
Front-desk rules:
- Verify every caller who asks about a case: full name, date of birth, and one more identifier on file (home address, or the last 4 of the SSN). Never read an identifier out; ask the caller to give it.
- Only the client, or a person the file lists as authorized, gets case information. Everyone else: "I can take a message", and nothing more, not even whether the firm represents that person.
- No legal advice, case values, settlement opinions or deadlines to act on. Take a complete message and route it.
- Adjusters and opposing counsel go to the attorney or case manager on the file. Never agree to a recorded statement, confirm facts, or accept an offer.
- Media: "We have no comment. I can take your name and number for the attorney."
- A complete message: date and time, caller name and role, callback number, best time to call, case name, what they need, how urgent, and your initials. Log it as a Note on the case and route it.
- Urgent (route now, not by message): a client in danger, a deadline or court date in the next 7 days, a settlement offer with a time limit, a statute of limitations close, a subpoena or process server, or anyone threatening legal action against the firm.`;

    const CASES = {
        'MC-01': { title: 'MC-01 · Maria Santos (MVA, in treatment)', text: `Client: Maria Santos · DOB 03/22/1988 · 1187 Willow Bend Dr, Riverton, GA 30301 · SSN last 4: 4821 · (555) 010-4417
Authorized: ONLY the client (no communication authorization for anyone else).
Attorney: Atty. Marcus Reyes (201) · Case Manager: Priya Natarajan (311) · Phase: Treatment
Date of loss 06/09/2026 · rear-end collision; liability clear.
Treatment: City Spine & Rehab, chiropractor, next visit Tuesday 09/29/2026 at 10:30 AM; physical therapy Thursday 10/01/2026 at 4:00 PM. Clinic phone (555) 010-3345.
Tasks: next client check-in with Priya 10/20/2026. Records Specialist to request updated City Spine & Rehab records after 10/31/2026.
File note: the client keeps a mileage log for her appointments.` },
        'MC-02': { title: 'MC-02 · Derek Thompson (slip and fall, intake)', text: `Potential client: Derek Thompson · DOB 11/05/1975 · 52 Harbor View Rd, Apt 3B, Riverton, GA 30303 · SSN last 4: 1934 · (555) 010-4520 · d.thompson@example.com
Attorney: Atty. David Okafor (203) · Case Manager: not assigned yet · Phase: Intake
Incident 09/12/2026, about 6:15 PM: slipped on spilled liquid detergent in aisle 7 of FreshWay Market (Route 9 store). No warning cone. Right wrist fracture (cast), hip bruising. Store manager Alan Pruitt took an incident report; client photographed the spill; two witnesses gave their names to the store.
Treatment: St. Mary's Hospital (discharged), Riverton Orthopedic Associates (ongoing).
Store's insurer: Allied Retail Casualty, adjuster Brent Kowalski, claim ARC-26-44091.
Intake completed 09/18/2026. Retainer and HIPAA sent by e-sign 09/21/2026: NOT yet signed. Task: Intake to follow up on the unsigned retainer by 09/28/2026.
File note: the attorney asked him not to talk to the store or its insurer.` },
        'MC-04': { title: 'MC-04 · Robert "Bobby" Chen (MVA, policy-limits demand out)', text: `Client: Robert "Bobby" Chen · DOB 01/30/1969 · 88 Lantern Hill Rd, Riverton, GA 30307 · SSN last 4: 2208 · (555) 010-4741
Authorized: only the client. Wife Susan Chen is the emergency contact ONLY, not authorized.
Attorney: Atty. Marcus Reyes (201) · Case Manager: Grace Kim (313) · Phase: BI Demand
Policy-limits demand ($100,000) sent 09/08/2026 with a 30-day time limit: response due 10/08/2026.
At-fault carrier: Liberty Crest Insurance, adjuster Greg Hollis, claim LC-25-99812.` },
        'MC-05': { title: 'MC-05 · Linda Garcia (premises liability, in litigation)', text: `Client: Linda Garcia · DOB 05/09/1961 · 2200 Pine Ridge Blvd, Unit 14, Riverton, GA 30309 · SSN last 4: 7702 · (555) 010-4850
Authorized: son Marco Garcia (signed communication authorization 05/2026).
Attorney: Atty. Elena Brooks (202) · Paralegal: Janelle Price (221) · Case Manager: Tom Alvarez (312) · Phase: Litigation
Garcia v. Pine Ridge Property Management LLC, Riverton County State Court, No. 26-CV-01877. Defense counsel: Richard Voss, Voss & Tate LLP, (555) 010-7990.
Calendar: deposition prep with Atty. Brooks Friday 10/02/2026 at 2:00 PM at our office. Client's deposition Tuesday 10/06/2026 at 10:00 AM at defense counsel's office.
Rule: court dates and depositions are never agreed at the front desk.` },
        'MC-06': { title: 'MC-06 · James Wilson (MVA, settled, disbursement)', text: `Client: James Wilson · DOB 09/17/1983 · 17 Birchwood Lane, Riverton, GA 30311 · SSN last 4: 3390 · (555) 010-4962
Authorized: only the client.
Attorney: Atty. Marcus Reyes (201) · Case Manager: Priya Natarajan (311) · Lien Negotiator: Rosa Delgado (341) · Phase: Disbursement
Settled 08/28/2026 for $42,000; check deposited to trust. One provider's written lien reduction (Align Chiropractic) is still pending. After it arrives, the client signs the final settlement statement; the check is ready about 3 business days later.
Office procedure: settlement checks are released only to the client with photo ID, unless the attorney approves a signed written authorization. Accounting / Disbursements: 500.` },
        'MC-08': { title: 'MC-08 · Tomás Rivera (motorcycle crash, in treatment)', text: `Client: Tomás Rivera · DOB 04/18/1964 · 905 Mission Road, Riverton, GA 30314 · SSN last 4: 8043 · (555) 010-5188
Speaks Spanish; prefers Spanish. Authorized: daughter Daniela Rivera (communication authorization 07/24/2026).
Attorney: Atty. Marcus Reyes (201) · Case Manager: Luis Ortega (314, bilingual English/Spanish) · Phase: Treatment
Right tibia fracture. Knee surgery Wednesday 10/14/2026 at Northside Surgery Center, arrive 7:00 AM. Pre-op labs 10/07/2026.
Task: Luis Ortega to call the client after surgery (10/15/2026).
Rule: don't guess through a language barrier. Transfer Spanish-speaking callers to Luis; if he's unavailable, use the firm's interpreter line or take a message with a callback number.` },
        'MC-10': { title: 'MC-10 · Sofia Morales, a minor (dog bite, in treatment)', text: `Client: Sofia Morales (age 8, DOB 06/02/2018), by her father Frank Morales (primary custody; signed the retainer) · 14 Orchard Lane, Riverton, GA 30318 · (555) 010-5305
Verify with Sofia's name and DOB plus Frank's address. Authorized: Frank only. The file says: do NOT share information with the mother, Angela Ruiz, unless Frank authorizes it in writing. Anyone else (school, relatives) is not authorized.
Attorney: Atty. Marcus Reyes (201) · Case Manager: Priya Natarajan (311) · Phase: Treatment
Next appointment: Lakeside Plastic Surgery, 11/10/2026 at 3:30 PM.` },
        'MC-13': { title: 'MC-13 · Nicole Adams (premises liability, potential client)', text: `Potential client: Nicole Adams · DOB 03/03/1984 · 1520 Lakeshore Blvd, Riverton, GA 30324 · SSN last 4: 4470 · (555) 010-5634 · nicole.adams@example.com
Attorney: Atty. David Okafor (203) · Intake Team (100) · Phase: Intake (not a client yet; retainer not signed)
Incident 10/20/2024 at HomeMax (Route 12): boxed patio heaters fell from a top shelf onto her shoulder and head. Rotator cuff strain, concussion symptoms. Treated at Riverton Orthopedic Associates.
She dealt with the store's insurer herself for a year: National Claims Services (TPA), adjuster Pam Ortiz.
STATUTE OF LIMITATIONS 10/20/2026: urgent for attorney review. Task: attorney to accept or decline by 09/30/2026.
Rule: never answer deadline or SOL questions; route urgently to Atty. Okafor or Intake.` },
        'MC-14': { title: 'MC-14 · Carlos Mendoza (truck crash, in litigation)', text: `Client: Carlos Mendoza · DOB 12/19/1977 · 250 Ironwood Street, Riverton, GA 30326 · (555) 010-5745
Attorney: Atty. Elena Brooks (202) · Case Manager: Luis Ortega (314) · Phase: Litigation
Mendoza v. Redline Freight LLC and Toller, Riverton County Superior Court, No. 26-CV-00412. Local news covered the crash.
File note 09/10: media calls get "no comment"; take the name and number for Atty. Brooks. Confirm nothing, not even representation or dates.` }
    };
    const doc = id => ({ id, title: CASES[id].title, url: `${CMS}?program=reception&mock=${id}`, text: CASES[id].text + '\n\n' + FIRM });

    const NOTE_MSG = { title: 'Case note / message slip', template: 'DATE / TIME:\nCALLER NAME AND ROLE:\nVERIFIED? (how, or "not authorized"):\nCALLBACK NUMBER:\nBEST TIME TO CALL BACK:\nCASE (MC # / client):\nWHAT THEY NEED:\nURGENCY (routine / today / urgent) AND WHY:\nROUTED TO (name / ext) / ACTION TAKEN:\nYOUR INITIALS:' };
    const NOTE_CAL = { title: 'Calendar entry and case note', template: 'EVENT:\nDATE / TIME (time zone):\nLOCATION / DIAL-IN:\nWHO ATTENDS:\nCONFIRMED WITH (name / number):\nREMINDER / FOLLOW-UP:\nROUTED TO / ACTION TAKEN:\nCASE NOTE (what was said, by whom):\nYOUR INITIALS:' };
    const NOTE_INTAKE = { title: 'Intake note', template: 'DATE / TIME OF CALL:\nPOTENTIAL CLIENT (name / DOB / phone / email / address):\nDATE AND PLACE OF INCIDENT:\nWHAT HAPPENED:\nINJURIES / TREATMENT SO FAR:\nOTHER PARTIES (for the conflict check):\nINSURANCE / ADJUSTER CONTACTS:\nEVIDENCE (photos, reports, witnesses):\nDEADLINES / URGENCY:\nNEXT STEP / ROUTED TO:\nYOUR INITIALS:' };

    const R_RECEPTION = [
        'Greeting & Control: Greets with the firm name and their own name, calm and warm, controls the call and closes it properly.',
        'Verification & Confidentiality: Verifies with name, DOB and one more identifier before sharing anything; shares only with the client or an authorized person; never confirms representation to others; no legal advice or values.',
        'Accuracy from the case file: Anything they tell an authorized caller matches the CMS file exactly (dates, times, names, extensions).',
        'Routing & Message: Routes to the right person and extension with the right urgency; the note is complete (date/time, caller and role, callback number, best time, case, what they need, urgency, initials).'
    ];
    const R_CALENDAR = [
        'Greeting & Verification: Professional greeting; verifies the caller and that they are authorized before discussing any date.',
        'Calendar accuracy: Reads the right event from the file and states the date, day, time, time zone and location exactly; never invents availability.',
        'Scheduling boundaries: Doesn\'t agree to move court dates or depositions; offers only real options; confirms and reads back what was booked.',
        'Documentation & follow-up: The calendar entry and note are complete (event, date/time/time zone, location, attendees, who confirmed, reminder, routing).'
    ];
    const R_INTAKE = [
        'Rapport & Control: Warm, patient, guides the caller one question at a time and keeps the call on track.',
        'Complete intake: Collects contact details, DOB, date and place of the incident, what happened, injuries and treatment, other parties (for the conflict check), insurance contacts and evidence.',
        'Boundaries: No legal advice, no case value, no deadline or SOL answers; doesn\'t promise the firm will take the case.',
        'Urgency & next step: Spots deadlines and other urgent issues and routes them now; sets a clear next step; the intake note is complete and accurate.'
    ];
    const TIPS_RECEPTION = ['Firm name, your name, "how may I help you?"', 'Verify before you share: name, DOB, plus address or SSN last 4.', 'Not authorized? "I can take a message," and nothing more.', 'Read the callback number back.', 'Log a Note and route it to the person on the file.'];
    const TIPS_CAL = ['Always say the day, date, time and time zone.', 'Read the booking back to the caller.', 'Court dates and depositions are never agreed at the front desk.', 'Log the calendar entry and a Note.'];
    const TIPS_INTAKE = ['One question at a time; let them tell the story.', 'Get the other parties\' names for the conflict check.', 'Never answer "Do I have a case?" or "Is it too late?"', 'Anything with a deadline is urgent: route it now.'];

    const you = (role, id) => `You are the ${role} at LSH Training Law Group (fictional). The call is about ${CASES[id].title.replace(/ \(.*/, '')}: open the case in the CMS Training Library (link in your brief) or read the case file below it.`;

    const RC = { program: 'FT', line: 'Reception Mock Calls', lineIcon: '☎', dir: 'in', rubric: R_RECEPTION, tips: TIPS_RECEPTION, note: NOTE_MSG };
    const CAL = { program: 'FT', line: 'Calendar Management Mock Calls', lineIcon: '🗓', dir: 'in', rubric: R_CALENDAR, tips: TIPS_CAL, note: NOTE_CAL };
    const IN = { program: 'FT', line: 'Intake Mock Calls', lineIcon: '📋', dir: 'in', rubric: R_INTAKE, tips: TIPS_INTAKE, note: NOTE_INTAKE };

    const CALLS = [
        Object.assign({}, RC, {
            id: 'ft_rc_appt', caseDoc: doc('MC-01'), name: 'Maria Santos', role: 'Client (MC-01)', title: 'A Client Lost Her Appointment Card', level: 'Beginner', gender: 'f',
            you: you('receptionist answering the main line', 'MC-01'),
            facts: 'Tuesday morning, 09/22/2026. The main line rings.',
            goals: ['Greets with the firm name and their own name', 'Verifies her (name, DOB, and her address or SSN last 4) before giving any appointment', 'Gives the right visit: City Spine & Rehab, Tuesday 09/29/2026 at 10:30 AM (the 10/01 4:00 PM visit is physical therapy)', 'Suggests she confirm with the clinic at (555) 010-3345', 'If she asks about gas money: promises nothing, reminds her to keep her mileage log, offers a message for Priya Natarajan (ext 311)', 'Logs a Note on the case'],
            hidden: 'You are Maria Santos, a friendly dental hygienist. You lost your appointment card and want to know when your next chiropractor visit is. When asked, you give your name, date of birth (March 22, 1988) and your address (1187 Willow Bend Drive); you only give your SSN last 4 (4821) if they ask for it instead. If they tell you a time without verifying you first, you are fine with it (you don\'t notice). After you get the answer, ask: "Oh, and will you pay me back for gas to all these appointments?" Accept a message for your case manager. Your number is (555) 010-4417, best after 3 PM.',
            opening: 'Hi, this is Maria Santos. I\'m a client there. I lost my appointment card. When is my next chiropractor visit?'
        }),
        Object.assign({}, RC, {
            id: 'ft_rc_cousin', caseDoc: doc('MC-01'), name: 'Rosa', role: 'Says she is the client\'s cousin', title: 'A "Cousin" Asks About the Settlement', level: 'Beginner', gender: 'f',
            you: you('receptionist answering the main line', 'MC-01'),
            facts: 'Wednesday afternoon, 09/23/2026. The main line rings.',
            goals: ['Greets professionally', 'Does not confirm or deny that the firm represents Maria Santos', 'Shares nothing about the case, settlement or amounts (only the client is authorized)', 'Stays polite under pressure: "I\'m not able to share any information, but I can take a message."', 'Takes her name and number and notes the call for Priya Natarajan (ext 311)'],
            hidden: 'You are Rosa, Maria Santos\'s cousin. You are warm but nosy. You want to know if Maria\'s case has settled and how much she\'s getting, "because the family is worried". Try three angles: "I\'m family, it\'s fine"; "Maria told me to call"; "Just tell me if it settled, yes or no". You are NOT on any authorization, and you don\'t know Maria\'s date of birth or address if asked. If the receptionist holds the line kindly and offers a message, you leave your number, (555) 010-7721, and hang up.',
            opening: 'Hi! I\'m calling about my cousin Maria Santos\'s case. Has it settled yet? How much is she getting?'
        }),
        Object.assign({}, RC, {
            id: 'ft_rc_check', caseDoc: doc('MC-06'), name: 'James Wilson', role: 'Client (MC-06)', title: 'Is My Settlement Check Ready?', level: 'Intermediate', gender: 'm',
            you: you('receptionist answering the main line', 'MC-06'),
            facts: 'Monday morning, 09/28/2026. The main line rings.',
            goals: ['Verifies him before discussing anything', 'Explains the status accurately: waiting on one provider\'s written lien reduction; then he signs the final settlement statement; the check is ready about 3 business days after that', 'Promises no date', 'Says checks go only to the client with photo ID unless the attorney approves a signed written authorization (so Troy can\'t just pick it up)', 'Routes: message for Priya Natarajan (311), and Accounting (500) about the pickup question'],
            hidden: 'You are James Wilson. You need money for a car repair and want your settlement check this week. Give your name, DOB (September 17, 1983) and address (17 Birchwood Lane) when asked. Push once: "Can\'t you just give me a date?" Then ask: "Can my buddy Troy pick up the check for me? I\'m working all week." Accept the answer if it\'s explained clearly. Your number is (555) 010-4962, best at lunchtime.',
            opening: 'Hey, it\'s James Wilson. My case settled last month. Is my check ready? I really need it this week.'
        }),
        Object.assign({}, RC, {
            id: 'ft_rc_mother', caseDoc: doc('MC-10'), name: 'Angela Ruiz', role: 'The client\'s mother (not authorized)', title: 'A Parent Who Isn\'t on the File', level: 'Advanced', gender: 'f',
            you: you('receptionist answering the main line', 'MC-10'),
            facts: 'Thursday morning, 09/24/2026. The main line rings.',
            goals: ['Stays calm and respectful; doesn\'t argue about custody', 'Shares nothing, per the file: not even whether the firm represents Sofia', 'Doesn\'t confirm or deny any detail she mentions', 'Offers a message for Atty. Marcus Reyes (ext 201)', 'Logs the call on the case'],
            hidden: 'You are Angela Ruiz, Sofia Morales\'s mother. You and Frank are separated; he has primary custody. You heard from a neighbor that Frank hired lawyers after the dog bite and you are hurt nobody told you. You say "I\'m her mother, I have a right to know." You get emotional, then angry if the receptionist sounds robotic, and you calm down if they are kind and clear about what they can do. You give your number, (555) 010-5390, for a message to the attorney.',
            opening: 'Hi, I\'m Angela Ruiz. Sofia Morales is my daughter. I know you\'re handling her case, and I have a right to know what\'s happening.'
        }),
        Object.assign({}, RC, {
            id: 'ft_rc_offer', caseDoc: doc('MC-04'), name: 'Greg Hollis', role: 'Adjuster, Liberty Crest Insurance', title: 'An Offer With a Deadline', level: 'Advanced', gender: 'm',
            you: you('receptionist answering the main line', 'MC-04'),
            facts: 'Wednesday 09/30/2026, 3:40 PM. Atty. Reyes is in a deposition; Grace Kim is on another call.',
            goals: ['Recognizes it as URGENT (an offer with a time limit)', 'Tries Atty. Reyes (201) or Grace Kim (313) live before taking a message', 'Takes a priority message with the exact amount ($65,000), the deadline (Friday at 5:00 PM), the claim number LC-25-99812 and his direct number', 'Doesn\'t react to the offer, accept it, or say it will go to the client', 'Reads the details back and logs a Note'],
            hidden: 'You are Greg Hollis, an experienced, brisk adjuster at Liberty Crest Insurance. Your offer on Robert Chen\'s claim (LC-25-99812) is $65,000, open until this Friday at 5:00 PM. Your direct line is (555) 010-7788. Try: "Just tell Bobby, he\'ll want it." and "Can you tell me if they\'ll take it?" If the receptionist handles it well, you give everything clearly and say you\'ll also email it.',
            opening: 'Greg Hollis, Liberty Crest. I have an offer on Chen: sixty-five thousand, and it\'s only open until Friday at five.'
        }),
        Object.assign({}, RC, {
            id: 'ft_rc_reporter', caseDoc: doc('MC-14'), name: 'Dana Pierce', role: 'Reporter, Channel 8 News', title: 'A Reporter Wants Confirmation', level: 'Intermediate', gender: 'f',
            you: you('receptionist answering the main line', 'MC-14'),
            facts: 'Friday, 09/25/2026. The main line rings.',
            goals: ['Says "We have no comment" and offers to take her name and number for the attorney', 'Confirms nothing: not the representation, the trial date or any detail', 'Stays friendly and doesn\'t get drawn into "off the record" talk', 'Takes a complete message for Atty. Elena Brooks (ext 202) and logs it'],
            hidden: 'You are Dana Pierce, a reporter at Channel 8 News, following up on the Redline Freight truck crash on I-75. You\'re friendly and persistent: ask if the firm represents Carlos Mendoza, when the trial is, and whether he\'s "doing OK". Try "just off the record" once. If they hold firm, give your number, (555) 010-8800, and your deadline (6 PM today).',
            opening: 'Hi, Dana Pierce, Channel 8 News. We\'re following up on the Redline Freight crash. Can you confirm your firm represents Carlos Mendoza, and when\'s the trial?'
        }),
        Object.assign({}, RC, {
            id: 'ft_rc_spanish', caseDoc: doc('MC-08'), name: 'Tomás Rivera', role: 'Client (MC-08), speaks Spanish', title: 'A Caller Who Speaks Spanish', level: 'Beginner', gender: 'm',
            you: you('receptionist answering the main line', 'MC-08'),
            facts: 'Monday, 09/28/2026. Luis Ortega is in a client meeting until 2:00 PM.',
            goals: ['Stays patient and doesn\'t guess through the language barrier', 'Recognizes the client\'s name and tries to transfer to Luis Ortega (bilingual CM, ext 314)', 'With Luis unavailable: uses the interpreter line or takes a message with a callback number', 'Confirms the callback number clearly (repeating digits slowly)', 'Logs a Note for Luis'],
            hidden: 'You are Tomás Rivera. You speak Spanish and only a few words of English ("Luis", "my case", "yes", "number"). Speak Spanish, short and simple. You want to talk to Luis about your surgery date. If they say "Luis" and "call back", give your number slowly in Spanish and in digits: 555 010 5188. Say "gracias" and hang up when they confirm.',
            opening: 'Hola, buenos días. Llamo por mi caso… Tomás Rivera. ¿Está Luis?'
        }),
        Object.assign({}, CAL, {
            id: 'ft_cal_depo', caseDoc: doc('MC-05'), name: 'Karen Holt', role: 'Assistant to Richard Voss, Voss & Tate LLP (defense counsel)', title: 'Defense Counsel Wants to Move a Deposition', level: 'Intermediate', gender: 'f',
            you: you('front desk and calendar assistant', 'MC-05'),
            facts: 'Friday, 09/25/2026, 11:15 AM. Janelle Price and Atty. Brooks are both in a mediation until 1:00 PM.',
            goals: ['Doesn\'t agree to, or say they\'ll accept, a new deposition date', 'Knows the deposition is Tuesday 10/06/2026 at 10:00 AM, less than two weeks away, so it\'s a priority', 'Tries to transfer to Janelle Price (221) or Atty. Brooks (202); then takes a priority message', 'Gets the proposed date (10/13), the reason, and her direct number and email', 'Logs a Note and flags the calendar item for the paralegal'],
            hidden: 'You are Karen Holt, legal assistant to Richard Voss at Voss & Tate LLP, defense counsel in Garcia v. Pine Ridge Property Management. Mr. Voss has a trial that got moved and can\'t do Ms. Garcia\'s deposition on the 6th. You want to move it to Tuesday 10/13 at 10:00 AM. You push: "It\'s just a scheduling thing, can you pencil it in?" You accept a callback today. Your direct line is (555) 010-7991, email kholt@vosstate.example.',
            opening: 'Hi, this is Karen from Richard Voss\'s office at Voss & Tate. We need to move Ms. Garcia\'s deposition on the 6th. Can we do the 13th instead?'
        }),
        Object.assign({}, CAL, {
            id: 'ft_cal_prep', caseDoc: doc('MC-05'), name: 'Marco Garcia', role: 'Client\'s son (authorized)', title: 'What Time Is My Mom\'s Prep Meeting?', level: 'Beginner', gender: 'm',
            you: you('front desk and calendar assistant', 'MC-05'),
            facts: 'Monday, 09/28/2026. The main line rings.',
            goals: ['Verifies that he is Marco and that he is authorized (and checks the client\'s identifiers)', 'Gives the prep meeting correctly: Friday 10/02/2026 at 2:00 PM with Atty. Brooks at the firm\'s office', 'Distinguishes it from the deposition itself: Tuesday 10/06/2026 at 10:00 AM at defense counsel\'s office', 'Reads both back with day, date, time and place', 'Logs a Note'],
            hidden: 'You are Marco Garcia, Linda Garcia\'s son. You drive your mom to appointments. You are on the communication authorization. When asked to verify, give your name, your mom\'s name and DOB (May 9, 1961) and her address (2200 Pine Ridge Blvd, Unit 14). Ask what time you need to bring her in "on the 2nd", then ask "and the actual deposition is where again?" Confirm and thank them.',
            opening: 'Hi, this is Marco Garcia, Linda Garcia\'s son. What time do I need to bring my mom in on the 2nd?'
        }),
        Object.assign({}, CAL, {
            id: 'ft_cal_surgery', caseDoc: doc('MC-08'), name: 'Daniela Rivera', role: 'Client\'s daughter (authorized)', title: 'Surgery Day, and a Call With the Case Manager', level: 'Intermediate', gender: 'f',
            you: you('front desk and calendar assistant', 'MC-08'),
            facts: 'Tuesday, 09/29/2026. Luis Ortega\'s open times on Thursday 10/15/2026 (Eastern): 10:00 AM, 1:30 PM, 4:00 PM (each 20 minutes).',
            goals: ['Verifies Daniela and that she is authorized', 'Gives the surgery correctly: Wednesday 10/14/2026, Northside Surgery Center, arrive 7:00 AM; pre-op labs 10/07; suggests confirming with the surgeon\'s office', 'Books the post-surgery call with Luis Ortega from his real open times on Thursday 10/15 (no invented times)', 'Confirms the time zone, the number to call, and that the call will be in Spanish', 'Reads the booking back and logs the calendar entry and a Note for Luis'],
            hidden: 'You are Daniela Rivera, Tomás Rivera\'s daughter. You are authorized on his file. Verify with your name, your dad\'s DOB (April 18, 1964) and address (905 Mission Road). Ask when his surgery is and what time to be there. Then say Luis wanted to call your dad after the surgery: you\'d like the afternoon of the 15th, but not before 1 PM because of the hospital. Your dad will be home; call his number, (555) 010-5188, and the call should be in Spanish. Confirm what they offer.',
            opening: 'Hi, I\'m Daniela Rivera, Tomás Rivera\'s daughter. When is my dad\'s surgery, and what time do we need to be there?'
        }),
        Object.assign({}, CAL, {
            id: 'ft_cal_checkin', caseDoc: doc('MC-01'), name: 'Maria Santos', role: 'Client (MC-01)', title: 'Reschedule My Check-in Call', level: 'Intermediate', gender: 'f',
            you: you('front desk and calendar assistant', 'MC-01'),
            facts: 'Thursday, 10/15/2026. Priya Natarajan\'s check-in slots (Eastern, 15 minutes): Tuesday 10/20 at 9:00 AM (currently Maria\'s) · Tuesday 10/20 at 1:30 PM · Wednesday 10/21 at 11:00 AM · Thursday 10/22 at 3:00 PM.',
            goals: ['Verifies her before touching the appointment', 'Finds her current check-in (Tuesday 10/20 with Priya)', 'Offers only Priya\'s real open slots and checks them against her physical therapy (Thursdays at 4:00 PM)', 'Confirms the new day, date, time, time zone and the number Priya will call', 'Reads it back, updates the calendar and logs a Note for Priya (311)'],
            hidden: 'You are Maria Santos. You started a new work schedule and can\'t take calls on Tuesday mornings any more. You want to move your 10/20 check-in call with Priya. Verify with your name, DOB (March 22, 1988) and address (1187 Willow Bend Drive). You prefer late morning or early afternoon; Wednesday 11 AM is perfect. Priya should call your cell, (555) 010-4417. If they offer Thursday at 3 PM, say you have PT at 4 and would rather not.',
            opening: 'Hi, it\'s Maria Santos. I have a check-in call with Priya next Tuesday morning, but I can\'t do mornings anymore. Can we move it?'
        }),
        Object.assign({}, IN, {
            id: 'ft_in_derek', caseDoc: doc('MC-02'), name: 'Derek Thompson', role: 'Potential client (first call)', title: 'New Intake: A Grocery-Store Fall', level: 'Intermediate', gender: 'm',
            you: 'You are the intake specialist at LSH Training Law Group (fictional). This is Derek Thompson\'s FIRST call to the firm (09/18/2026): nothing is on file yet. Open the CMS Training Library case MC-02 to see how the finished intake should look, and fill the Intake tab as you go.',
            facts: 'Friday, 09/18/2026. A new caller on the intake line. Intake Attorney: Atty. David Okafor (ext 203).',
            goals: ['Warm opening; lets him tell it, then guides one question at a time', 'Collects his full name, DOB, phone, email and address', 'Captures the incident: 09/12/2026, about 6:15 PM, FreshWay Market (Route 9), aisle 7, spilled detergent, no warning cone', 'Captures injuries and treatment (right wrist fracture in a cast, hip bruising; St. Mary\'s, Riverton Orthopedic)', 'Gets the other parties for the conflict check (FreshWay, manager Alan Pruitt) and the evidence (incident report, his photos, two witnesses)', 'Gives no advice or value; sets the next step (attorney review, retainer by e-sign)'],
            hidden: 'You are Derek Thompson (DOB November 5, 1975), a warehouse supervisor. Phone (555) 010-4520, email d.thompson@example.com, address 52 Harbor View Rd, Apt 3B, Riverton. On Saturday 09/12 at about 6:15 PM you slipped on spilled liquid detergent in aisle 7 at the FreshWay Market on Route 9. There was no warning cone. You broke your right wrist (in a cast) and bruised your hip. You went to St. Mary\'s Hospital that night and now see Riverton Orthopedic. The store manager, Alan Pruitt, wrote an incident report. You took photos of the spill. Two other shoppers gave their names to the store. You\'re worried about missing work. Ask twice: "So do I have a case?" and "What\'s something like this worth?" Share details only when asked.',
            opening: 'Hi, um, I slipped and fell at the grocery store last weekend and broke my wrist. A friend said I should call a lawyer. Is this the right place?'
        }),
        Object.assign({}, IN, {
            id: 'ft_in_nicole', caseDoc: doc('MC-13'), name: 'Nicole Adams', role: 'Potential client (first call)', title: 'New Intake With a Deadline Close', level: 'Advanced', gender: 'f',
            you: 'You are the intake specialist at LSH Training Law Group (fictional). This is Nicole Adams\'s FIRST call to the firm (09/24/2026): nothing is on file yet. Open the CMS Training Library case MC-13 to see how the finished intake should look, and fill the Intake tab as you go.',
            facts: 'Thursday, 09/24/2026. A new caller on the intake line. Intake Attorney: Atty. David Okafor (ext 203); Intake Team ext 100.',
            goals: ['Collects her contact details and DOB', 'Captures the incident: 10/20/2024 at HomeMax (Route 12), boxed patio heaters fell from a top shelf onto her shoulder and head', 'Captures injuries and treatment (rotator cuff strain, concussion symptoms; Riverton Orthopedic) and the insurer contact (National Claims Services, Pam Ortiz)', 'Spots that the incident is almost 2 years ago and treats it as URGENT, without answering "is it too late?"', 'Routes now: transfer to Atty. Okafor (203) or Intake (100), or a priority message with her best number', 'Gives no advice; doesn\'t repeat the adjuster\'s "plenty of time"'],
            hidden: 'You are Nicole Adams (DOB March 3, 1984), a bank teller. Phone (555) 010-5634, email nicole.adams@example.com, address 1520 Lakeshore Blvd, Riverton. On October 20, 2024, boxed patio heaters fell from a top shelf at the HomeMax on Route 12 onto your shoulder and head. You have a rotator cuff strain and had concussion symptoms; you saw Riverton Orthopedic. For a year you dealt with the store\'s insurer yourself, National Claims Services (adjuster Pam Ortiz), and it stalled. Pam told you "there\'s plenty of time". Ask: "Is it too late for me to sue?" and "The adjuster says I have plenty of time, right?" Share details only when asked. You\'re available by phone all day.',
            opening: 'Hi. I got hurt at a HomeMax a while ago, and I\'ve been dealing with their insurance myself, but it\'s going nowhere. Is it too late for me to do something about it?'
        }),
        Object.assign({}, IN, {
            id: 'ft_in_retainer', caseDoc: doc('MC-02'), name: 'Derek Thompson', role: 'Potential client (MC-02), retainer unsigned', title: 'Did You Take My Case? (and the Store Called)', level: 'Intermediate', gender: 'm',
            you: 'You are the intake specialist at LSH Training Law Group (fictional). Derek Thompson (MC-02) is calling back: open his case in the CMS Training Library (link in your brief) or read the case file below it.',
            facts: 'Friday, 09/25/2026, 10:20 AM. Atty. Okafor is at his desk.',
            goals: ['Verifies him first', 'Explains accurately: the attorney accepted the case pending his signature; the retainer sent by e-sign on 09/21 is still unsigned; offers to resend the link', 'Doesn\'t say he "has a case" or what it\'s worth', 'Treats "the store manager wants me to come in and sign something" as URGENT: transfers to Atty. Okafor (203) now', 'May repeat the file note (the attorney asked him not to talk to the store or its insurer), with no other advice', 'Logs the call in the intake note'],
            hidden: 'You are Derek Thompson (DOB November 5, 1975, 52 Harbor View Rd, Apt 3B). You haven\'t signed anything because the email went to spam. Ask: "Did you guys take my case? Who\'s my lawyer?" Then mention: "Oh, and the store manager, Alan, called me yesterday. He wants me to come in and sign something so they can \'take care of my bills\'. Should I go?" You\'ll wait to be transferred if asked.',
            opening: 'Hey, it\'s Derek Thompson. I called last week about my fall at FreshWay. Did you guys take my case? Who\'s my lawyer?'
        })
    ];
    CALLS.forEach(c => {
        c.blurb = c.facts.length > 190 ? c.facts.slice(0, 187).replace(/\s+\S*$/, '') + '…' : c.facts;
    });
    window.EXTRA_CALLERS = (window.EXTRA_CALLERS || []).concat(CALLS);
})();

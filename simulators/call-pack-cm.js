/* LSH Training Portal — Call Simulator pack: Case Management (John Doe v. Apex and more).
   27 calls across six lines (Reception, Intake, Client Communication, Attorney Reporting,
   Adjusters & Carriers, Providers & Records). Each call ends with the documentation that
   call requires (note.template), which is graded with the call on the line's rubric.
   Loaded by /simulators/call.html before its caller library; adds to window.EXTRA_CALLERS. */
(function () {
    // The John Doe v. Apex case summary the AI caller draws on (same facts as the CM course's Case File).
    const CM_CASE = "## Case Snapshot\n- Case: John Doe v. Apex Delivery Services, Inc. & Robert W. Smith · LSH File # MVA-JD-2026-001 · Claim # 2026-0214-AX\n- Client: John Doe · DOB 08/14/1980 · 4412 Oak Lane, Riverview Park, ST 90211 · (555) 982-4410 · johndoe@gmail.com\n- Spouse / passenger: Jane Doe · (555) 982-4411 — front-seat passenger, soft-tissue injuries, refused EMS at scene (a potential second claimant — conflict-check both)\n- Date of loss: Saturday, February 14, 2026 (Valentine's Day) · 14:35 · Intersection of 4th Ave & Main St, Metro Center\n- Statute of Limitations: 02/14/2028 (per Master Case Summary) — docketed on day one\n- Retainer: signed 02/15/2026 · Fee 33⅓% pre-suit / 40% if a lawsuit is filed · authority to resolve prior counsel's lien\n\n## Facts of Loss — Police Report 2026-0214-AX (Sgt. A. Vance #1104)\n- John (Unit 02, 2023 Tesla Model Y) was southbound on Main St turning left onto 4th Ave on a GREEN ARROW.\n- Robert W. Smith (Unit 01, Apex Delivery Services' 2019 Ford F-150, commercial) was northbound, tried to “clear the intersection as the signal cycled to red,” and struck John's driver-side B-pillar.\n- Smith cited: Failure to Yield Right of Way + Disregarding Traffic Control Device.\n- Heavy T-bone intrusion; John trapped by dash/steering column — Jaws of Life extrication (freed at 15:05); airbags deployed; side-window glass shattered into his face.\n- Tesla declared a total loss ($42,500). F-150 remained functional (front bull-bar impact).\n\n## Injuries & Treatment Timeline\n- 02/14 — Metro Center EMS (Medic 14): GCS 14, 10/10 back pain, left-leg numbness → Metro General Level 1 Trauma (Dr. K. Miller).\n- 02/14 — ER: 12cm stellate facial laceration, 3 glass shards removed, 42 sutures (multi-layer); CT: C5-C6 disc displacement; lumbar loss of lordosis; discharged on 14-day strict bed rest.\n- 03/01 — Dr. Sarah Spine: Emergency Medical Condition (EMC) attestation.\n- 03/15 — MRI (Metro Radiology): 5mm L4-L5 protrusion impinging the left L5 nerve root (the Medical Chronology and demand email cite “3mm, 03/10” — reconcile).\n- 03/20 – 04/02 — PT (Mark Motion, DPT) and Chiro (Dr. Al Lign, DC): worsening radiculopathy, foot drop (hallux 3/5), plateau.\n- 04/01 – 04/15 — 14-DAY GAP: PTSD with Acute Dissociative Withdrawal after suture removal / seeing the scarring (Dr. Mindy Health, PhD, eval 04/18).\n- 04/20 — EMG: active denervation, left L5 — objective proof of nerve-root damage.\n- 05/12 — L4-L5 microdiscectomy (Dr. Sarah Spine; anesthesia Dr. Victor Vapor, Independent Group #44).\n- 06/15 — Dr. Neil Ron (neurology): permanent L5/S1 deficit, 5% Whole Person Impairment (AMA 6th Ed.).\n- 07/01 — Discharge: permanent light-duty restrictions (≤20 lbs, 45-min sitting, no climbing) — cannot return to Senior Logistics Manager duties; loss of future earning capacity.\n\n## Prior History — Disclose It, Don't Hide It\n- 08/12/2018 — Workplace Health Clinic: L4-L5 lumbar strain lifting crates (6/10, radiating to left buttock). PT x4 weeks.\n- 09/15/2018 — symptoms resolved; discharged at MMI, no permanent restrictions; no MRI ever taken.\n- Chronic migraines diagnosed 2021 (relevant to the brain MRI billed 03/15/2026).\n- Strategy: Aggravation of a Pre-existing Condition / Eggshell Plaintiff — asymptomatic ~8 years until the F-150 impact.\n\n## Coverage (verified from dec pages)\n- Defendant — Aggressive Casualty, Policy AC-99120-XCV (Apex Delivery Services): $1,000,000 CSL (BI active) · Property Damage DENIED under Exclusion 4.b · MedPay $5,000 (secondary).\n- Client — Local Farm Mutual, Policy LFM-4412-JD: PIP $10,000 (EXHAUSTED 02/14 per PIP log — adjuster Sarah Miller, claim LFM-99210-JD) · UM/UIM $250,000/$500,000 · Collision ACV, $1,000 deductible.\n- Health — BCBS (ERISA self-funded), Group BC-441-A · Subrogation agent: BlueCross Recovery Services.\n\n## Money on the File\n- Billed so far (provider statements): EMS $2,200 · Metro General ER/CT $12,700 · Dr. Spine EMC $1,200 · MRI $5,000 · Chiro $320 · PT $560 (statements are partial — request complete itemized bills).\n- PIP paid $10,000: EMS $2,200 + ER $4,800 + CT $3,000.\n- Lost wages verified: $15,900 (W-2 supported). Future care projection (Dr. Spine, 5-yr): $57,000.\n- Liens asserted: Metro General hospital lien $45,000 · BlueCross ERISA subrogation $20,000 · “Global Health Blue-Shield” statutory lien $11,200 · Prior counsel Barry Slow $1,200 ($400 costs + 8.0 hrs QM).\n- Negotiation history: prior firm pushed a $15,000 offer · LSH demand $250,000 (05/15/2026, 30-day clock) · Aggressive Casualty counter $45,000 (05/22/2026) · rejected (05/26/2026).\n\n## ⚠ Discrepancies a Case Manager Must Catch\n- DOB: 08/14/1980 on intake, retainer and HIPAA vs. 02/14/1980 on every provider bill and the MRI report.\n- Occupation: “Nurse” in the LSH/CMS intake vs. “Senior Logistics Manager” in the wage verification, discharge summary and demand.\n- Health plan identity: BCBS ERISA (BC-441-A) / BlueCross Recovery ($20,000) vs. a separate “Global Health Blue-Shield” statutory lien ($11,200) for the same dates of service.\n- Metro General's $45,000 lien vs. its own $12,700 ER billing statement — and PIP + health insurance already paid part of it.\n- Police report number “2026-0214-AX” vs. “1104” in the CMS intake (1104 is Sgt. Vance's badge number).\n- HIPAA authorization unsigned and undated.\n- MRI referred by an unknown “Dr. Aris Thorne”; MRI invoice includes a brain MRI ($2,100) that the demand labels as “spinal mapping.”\n- Demand specials table vs. actual bills: extrication “Fire Dept” $1,850 (really EMS transport), ER $12,400 (bill $12,700), chiro $8,400 (bill $320).\n\n## Key Contacts\n- Handling Attorney: LSH Law Group attorney of record (all legal advice and settlement authority)\n- Adjuster: Litigation Claims Adjuster, Aggressive Casualty Insurance · Defense counsel: Jane Vance, Esq. (Vance & Holt LLP)\n- Providers: Dr. Sarah Spine (ortho spine) · Dr. Neil Ron (neurology) · Dr. Mindy Health (neuropsych) · Dr. Al Lign (chiro) · Mark Motion, DPT\n- Lienholders: Metro General (Brenda Sterling, Revenue Recovery) · BlueCross Recovery Services · Barry Slow, Esq. (The Fast Settlement Firm)\n-";
    const CALLS = [
 {
  "id": "cm_rc_status",
  "program": "CM",
  "line": "Reception & Front Desk",
  "lineIcon": "☎",
  "dir": "in",
  "name": "Jane Doe",
  "role": "Spouse of client John Doe",
  "title": "Spouse Asks for a Case Update",
  "level": "Beginner",
  "gender": "f",
  "you": "You are the receptionist answering the firm's main line at LSH Law Group. You are answering this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "The main line is ringing. It's a Tuesday morning; the Case Manager on the Doe file is in a meeting until 11:30.",
  "goals": [
   "Greets professionally with the firm name",
   "Verifies who Jane is and does NOT share case/settlement details without John's authorization on file",
   "Flags Jane's own neck pain as a possible separate claim (conflict check) for the attorney/intake — without advising her",
   "Takes a complete message with callback number (555) 982-4411 and time (after 2 PM)",
   "Tells Jane who will call back and when"
  ],
  "hidden": "You are John's wife and were the front-seat passenger in the crash. John asked you to call because he's at physical therapy. Your number is (555) 982-4411. You want to know if the adjuster made a new offer. You also have neck pain that hasn't gone away and wonder if you should 'be part of the case'. You're not on the retainer. Best time to call back: after 2 PM. HOW YOU BEHAVE: Friendly but a bit anxious. If the receptionist gives case details without checking authority, happily take them. If they explain they need John's permission, accept it after mild disappointment.",
  "opening": "Hi, this is Jane Doe — my husband John is a client there. I've been trying to reach someone about his case. Is there any update on the settlement?",
  "note": {
   "title": "Message slip / routing note",
   "template": "CALLER NAME:\nCOMPANY / RELATIONSHIP:\nCALLBACK NUMBER:\nBEST TIME TO CALL BACK:\nREGARDING (client / case / claim #):\nMESSAGE:\nURGENCY (routine / today / urgent) AND WHY:\nROUTED TO / ACTION TAKEN:"
  },
  "rubric": [
   "Greeting & Professionalism: Firm greeting with name, warm and composed tone, controls the call, closes it properly.",
   "Caller ID & Purpose: Gets the caller's full name, organization, relationship to the matter, callback number, and the actual reason for the call.",
   "Confidentiality & Boundaries: Does not confirm or deny representation to third parties, discloses no case details, gives no legal advice, verifies identity before discussing anything.",
   "Routing & Message Accuracy: Routes correctly (or takes a message) with the right urgency; the message slip is complete and matches what the caller actually said."
  ],
  "tips": [
   "Greet with the firm name and your name.",
   "Get name, number and reason before anything else.",
   "Never confirm who the firm represents to a third party.",
   "Read the number back to the caller.",
   "Tell the caller exactly what happens next and when."
  ],
  "caseFile": true
 },
 {
  "id": "cm_rc_reporter",
  "program": "CM",
  "line": "Reception & Front Desk",
  "lineIcon": "☎",
  "dir": "in",
  "name": "Marcus Bell",
  "role": "Reporter, Metro Center Daily",
  "title": "A Reporter Wants Confirmation",
  "level": "Intermediate",
  "gender": "m",
  "you": "You are the receptionist answering the firm's main line at LSH Law Group. You are answering this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "The main line rings. The caller ID shows a local newspaper.",
  "goals": [
   "Neither confirms nor denies that the firm represents anyone",
   "Shares no facts about any client or crash, even 'off the record'",
   "Offers to take a message for the attorney (media inquiries go to the attorney)",
   "Captures name, outlet, number (555) 310-7788 and the 5 PM deadline",
   "Stays courteous — no 'no comment' hostility"
  ],
  "hidden": "You're working on a story about Apex Delivery trucks and crashes. You heard from a tow driver that LSH represents the Tesla driver. Your number is (555) 310-7788, deadline 5 PM today. You'll try several angles: 'just confirm off the record', 'the family already talked to me', 'is he going to sue Apex?'. HOW YOU BEHAVE: Polite, persistent, slightly pushy. Reword the question if blocked. If the receptionist stays firm and offers to pass a message to the attorney, accept it.",
  "opening": "Good afternoon, Marcus Bell with the Metro Center Daily. I'm writing about the Apex Delivery crash on Valentine's Day — I understand your firm represents the driver who got cut out of his Tesla. Can you confirm that and tell me how he's doing?",
  "note": {
   "title": "Message slip / routing note",
   "template": "CALLER NAME:\nCOMPANY / RELATIONSHIP:\nCALLBACK NUMBER:\nBEST TIME TO CALL BACK:\nREGARDING (client / case / claim #):\nMESSAGE:\nURGENCY (routine / today / urgent) AND WHY:\nROUTED TO / ACTION TAKEN:"
  },
  "rubric": [
   "Greeting & Professionalism: Firm greeting with name, warm and composed tone, controls the call, closes it properly.",
   "Caller ID & Purpose: Gets the caller's full name, organization, relationship to the matter, callback number, and the actual reason for the call.",
   "Confidentiality & Boundaries: Does not confirm or deny representation to third parties, discloses no case details, gives no legal advice, verifies identity before discussing anything.",
   "Routing & Message Accuracy: Routes correctly (or takes a message) with the right urgency; the message slip is complete and matches what the caller actually said."
  ],
  "tips": [
   "Greet with the firm name and your name.",
   "Get name, number and reason before anything else.",
   "Never confirm who the firm represents to a third party.",
   "Read the number back to the caller.",
   "Tell the caller exactly what happens next and when."
  ],
  "caseFile": true
 },
 {
  "id": "cm_rc_newlead",
  "program": "CM",
  "line": "Reception & Front Desk",
  "lineIcon": "☎",
  "dir": "in",
  "name": "Rosa Delgado",
  "role": "Potential new client",
  "title": "A Frightened New Caller",
  "level": "Beginner",
  "gender": "f",
  "you": "You are the receptionist answering the firm's main line at LSH Law Group. You are answering this call.",
  "facts": "The main line rings. The intake team is on another call.",
  "goals": [
   "Greets warmly and shows empathy",
   "Collects name, number and a one-line summary without running the full intake",
   "Does NOT evaluate the case or give legal advice ('do I have a case?') — explains intake/attorney will",
   "Flags the recorded-statement request as urgent for intake (without advising herself beyond 'the intake team will talk to you about that before you speak to anyone')",
   "Warm-transfers or schedules an intake callback with a specific time"
  ],
  "hidden": "Rear-ended at a red light on Harbor Blvd two days ago. Neck and lower back pain, went to urgent care yesterday. Police came (report number unknown). The other driver's insurer already called and asked for a recorded statement — you haven't given one. Number (555) 448-2090. Available anytime today. HOW YOU BEHAVE: Nervous and unsure. Asks 'Do I have a case?' and 'Should I talk to their insurance?'. Calms down if treated kindly.",
  "opening": "Hello? Um, I was in a car accident two days ago and my neighbor said I should call a lawyer. I don't really know how this works. Can someone help me?",
  "note": {
   "title": "Message slip / routing note",
   "template": "CALLER NAME:\nCOMPANY / RELATIONSHIP:\nCALLBACK NUMBER:\nBEST TIME TO CALL BACK:\nREGARDING (client / case / claim #):\nMESSAGE:\nURGENCY (routine / today / urgent) AND WHY:\nROUTED TO / ACTION TAKEN:"
  },
  "rubric": [
   "Greeting & Professionalism: Firm greeting with name, warm and composed tone, controls the call, closes it properly.",
   "Caller ID & Purpose: Gets the caller's full name, organization, relationship to the matter, callback number, and the actual reason for the call.",
   "Confidentiality & Boundaries: Does not confirm or deny representation to third parties, discloses no case details, gives no legal advice, verifies identity before discussing anything.",
   "Routing & Message Accuracy: Routes correctly (or takes a message) with the right urgency; the message slip is complete and matches what the caller actually said."
  ],
  "tips": [
   "Greet with the firm name and your name.",
   "Get name, number and reason before anything else.",
   "Never confirm who the firm represents to a third party.",
   "Read the number back to the caller.",
   "Tell the caller exactly what happens next and when."
  ]
 },
 {
  "id": "cm_rc_adjuster",
  "program": "CM",
  "line": "Reception & Front Desk",
  "lineIcon": "☎",
  "dir": "in",
  "name": "Tom Reeves",
  "role": "Adjuster, Aggressive Casualty Insurance",
  "title": "Adjuster With a Same-Day Offer",
  "level": "Intermediate",
  "gender": "m",
  "you": "You are the receptionist answering the firm's main line at LSH Law Group. You are answering this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "The main line rings. The Doe Case Manager is out today; the attorney is in a deposition.",
  "goals": [
   "Identifies the caller, company and claim number",
   "Discloses nothing about the client or treatment",
   "Does not accept, relay to the client, or comment on the offer",
   "Documents the exact offer ($52,000), the deadline (5 PM today) and the direct line with extension",
   "Marks it URGENT and routes to the Case Manager/attorney immediately (interrupt protocol / text), telling the adjuster when to expect a call"
  ],
  "hidden": "You're calling to put a $52,000 offer on the table, open until 5 PM today. You want a 'quick yes or no' and will try to get the receptionist to 'just pass it to the client directly'. Your direct line is (555) 700-1422, ext. 318. HOW YOU BEHAVE: Brusque and in a hurry. Pushes the deadline. Tries to get the receptionist to relay the offer to the client or confirm details about treatment.",
  "opening": "Yeah, Tom Reeves, Aggressive Casualty. I need to talk to whoever's handling John Doe — claim 2026-0214-AX. I've got a limited-time offer and I need an answer today.",
  "note": {
   "title": "Message slip / routing note",
   "template": "CALLER NAME:\nCOMPANY / RELATIONSHIP:\nCALLBACK NUMBER:\nBEST TIME TO CALL BACK:\nREGARDING (client / case / claim #):\nMESSAGE:\nURGENCY (routine / today / urgent) AND WHY:\nROUTED TO / ACTION TAKEN:"
  },
  "rubric": [
   "Greeting & Professionalism: Firm greeting with name, warm and composed tone, controls the call, closes it properly.",
   "Caller ID & Purpose: Gets the caller's full name, organization, relationship to the matter, callback number, and the actual reason for the call.",
   "Confidentiality & Boundaries: Does not confirm or deny representation to third parties, discloses no case details, gives no legal advice, verifies identity before discussing anything.",
   "Routing & Message Accuracy: Routes correctly (or takes a message) with the right urgency; the message slip is complete and matches what the caller actually said."
  ],
  "tips": [
   "Greet with the firm name and your name.",
   "Get name, number and reason before anything else.",
   "Never confirm who the firm represents to a third party.",
   "Read the number back to the caller.",
   "Tell the caller exactly what happens next and when."
  ],
  "caseFile": true
 },
 {
  "id": "cm_rc_angry",
  "program": "CM",
  "line": "Reception & Front Desk",
  "lineIcon": "☎",
  "dir": "in",
  "name": "Derek Owens",
  "role": "Existing client (a different file)",
  "title": "“Nobody Calls Me Back”",
  "level": "Advanced",
  "gender": "m",
  "you": "You are the receptionist answering the firm's main line at LSH Law Group. You are answering this call.",
  "facts": "The main line rings. Derek's Case Manager is on vacation this week; a backup CM is covering.",
  "goals": [
   "Stays calm; acknowledges the frustration without blaming colleagues",
   "Doesn't promise the attorney will pick up right now; offers the covering CM",
   "Gets the real issue: collections notice for the MRI bill ($1,850)",
   "Takes a complete, urgent message and gives a specific callback window",
   "Notes the 'fire the firm' statement for the attorney (client-relations risk)"
  ],
  "hidden": "Your case is a slip-and-fall at a grocery store last year. Your CM (Priya) went on vacation and you didn't know. You got a bill from a collections agency for your MRI ($1,850) and you're scared it will hurt your credit. Number (555) 227-6013. You'll calm down if someone takes ownership and gives you a real callback time. HOW YOU BEHAVE: Angry and loud at first, interrupts. De-escalates if heard and given a specific plan. Escalates if brushed off or told 'she's on vacation, call back next week'.",
  "opening": "This is Derek Owens. I have been calling for THREE weeks and nobody calls me back. I'm about ready to fire you people. Put me through to my lawyer right now.",
  "note": {
   "title": "Message slip / routing note",
   "template": "CALLER NAME:\nCOMPANY / RELATIONSHIP:\nCALLBACK NUMBER:\nBEST TIME TO CALL BACK:\nREGARDING (client / case / claim #):\nMESSAGE:\nURGENCY (routine / today / urgent) AND WHY:\nROUTED TO / ACTION TAKEN:"
  },
  "rubric": [
   "Greeting & Professionalism: Firm greeting with name, warm and composed tone, controls the call, closes it properly.",
   "Caller ID & Purpose: Gets the caller's full name, organization, relationship to the matter, callback number, and the actual reason for the call.",
   "Confidentiality & Boundaries: Does not confirm or deny representation to third parties, discloses no case details, gives no legal advice, verifies identity before discussing anything.",
   "Routing & Message Accuracy: Routes correctly (or takes a message) with the right urgency; the message slip is complete and matches what the caller actually said."
  ],
  "tips": [
   "Greet with the firm name and your name.",
   "Get name, number and reason before anything else.",
   "Never confirm who the firm represents to a third party.",
   "Read the number back to the caller.",
   "Tell the caller exactly what happens next and when."
  ]
 },
 {
  "id": "cm_in_rearend",
  "program": "CM",
  "line": "Intake Calls",
  "lineIcon": "📥",
  "dir": "in",
  "name": "Kevin Tran",
  "role": "New caller — rear-end collision",
  "title": "Rear-End Collision Intake",
  "level": "Beginner",
  "gender": "m",
  "you": "You are the intake specialist screening a new personal-injury inquiry at LSH Law Group. You are answering this call.",
  "facts": "A new inquiry is transferred to you from the front desk.",
  "goals": [
   "Captures date/time/location and mechanism (stopped at red, rear-ended)",
   "Gets the other driver's name, vehicle and insurer, the police report #, and all insurance (PIP, health)",
   "Identifies the treatment gap since urgent care and explains why consistent treatment matters (without medical advice)",
   "Asks about prior injuries and prior counsel; records the gym neck injury",
   "Declines to value the case; sets the next step (attorney review / sign-up) with a timeline"
  ],
  "hidden": "DOB 03/22/1991. Rear-ended 9 days ago (last Thursday ~5:40 PM) at Oak St & 12th while stopped at a red light. Other driver: Lisa Moore, driving a 2020 Honda Civic, insured by Summit Auto (claim number not yet). Police came: Metro PD report 2026-1109-KT. Went to urgent care the next day (neck strain, told to follow up with primary doctor) — hasn't gone back since. Your insurer: Coastline Mutual, has PIP. Health insurance through work (Aetna). No witnesses except a passerby who left. You took photos of the bumper. No prior attorney. Prior injury: 'tweaked my neck at the gym' 2 years ago, fully healed. Works as a warehouse supervisor, missed 4 days. Phone (555) 612-3390, kevin.tran91@gmail.com. HOW YOU BEHAVE: Cooperative, a little vague about details unless asked specifically. Asks 'How much do you think I could get?' at some point.",
  "opening": "Hi, yes, the lady at the front said you could help. I got rear-ended last week and my neck has been killing me.",
  "note": {
   "title": "Intake sheet",
   "template": "CALLER / CLIENT NAME:\nPHONE / EMAIL:\nDATE OF BIRTH:\nDATE & TIME OF INCIDENT:\nLOCATION:\nHOW IT HAPPENED:\nOTHER PARTIES (names / employer / vehicle):\nINJURIES:\nTREATMENT SO FAR (providers / dates):\nPOLICE REPORT / INCIDENT REPORT #:\nINSURANCE (client's / other party's / health):\nWITNESSES / PHOTOS:\nPRIOR ATTORNEY / PRIOR INJURIES:\nRED FLAGS (SOL, liability, gaps, conflicts):\nRECOMMENDATION (accept / escalate / decline) & NEXT STEP:"
  },
  "rubric": [
   "Empathy & Rapport: Acknowledges the injury and the stress, keeps the caller comfortable, explains the process in plain language.",
   "Fact Capture: Captures who/what/when/where/how, injuries, treatment, police report, insurance for all parties, witnesses, and contact details — and the intake sheet matches what the caller said.",
   "Screening & Red Flags: Spots SOL problems, prior counsel/liens, liability issues, treatment gaps, pre-existing conditions and conflict-check names; asks the follow-up questions they call for.",
   "Boundaries & Next Steps: No case valuation, no guarantees, no legal advice; clear next step (attorney review, sign-up, records) with a timeline; advises no recorded statements only as firm policy allows."
  ],
  "tips": [
   "Start with how they're doing, then 'walk me through what happened'.",
   "Ask the date early — it drives the SOL.",
   "Always ask: prior attorney? prior injuries? other people in the car?",
   "Get every insurer: theirs, the other side's, health.",
   "Never say what a case is worth."
  ]
 },
 {
  "id": "cm_in_sol",
  "program": "CM",
  "line": "Intake Calls",
  "lineIcon": "📥",
  "dir": "in",
  "name": "Linda Park",
  "role": "New caller — old accident",
  "title": "The Almost-Expired Claim",
  "level": "Advanced",
  "gender": "f",
  "you": "You are the intake specialist screening a new personal-injury inquiry at LSH Law Group. You are answering this call.",
  "facts": "A new inquiry comes in late on a Friday afternoon.",
  "goals": [
   "Gets the exact date early and recognizes the SOL is about a month away",
   "Identifies the government defendant (city bus) and the possible notice-of-claim issue",
   "Discovers the prior firm (Hughes & Partners) and asks for the withdrawal letter (possible lien, file transfer)",
   "Escalates to an attorney TODAY as urgent instead of scheduling routinely",
   "Stays empathetic; makes no promises about whether it's too late"
  ],
  "hidden": "The accident was 23 months ago (two years ago next month) — exact date: the 28th of that month, 23 months ago. T-boned by a city bus (Metro Transit) at 5th & Pine. Rotator cuff surgery 8 months ago. A different law firm (Hughes & Partners) handled it for 6 months then 'dropped' you by letter — you still have the letter. Never got a settlement. Metro Transit is a government entity (there may have been a short notice-of-claim deadline — you don't know if prior firm filed one). Phone (555) 901-4478. HOW YOU BEHAVE: Hesitant, apologetic about waiting. Only mentions the prior law firm and the bus being city-owned if asked (who hit you? did you ever talk to a lawyer?).",
  "opening": "Hi. I had a car accident a while back and I've been having surgery on my shoulder and I finally feel ready to deal with it. Is it too late to do something?",
  "note": {
   "title": "Intake sheet",
   "template": "CALLER / CLIENT NAME:\nPHONE / EMAIL:\nDATE OF BIRTH:\nDATE & TIME OF INCIDENT:\nLOCATION:\nHOW IT HAPPENED:\nOTHER PARTIES (names / employer / vehicle):\nINJURIES:\nTREATMENT SO FAR (providers / dates):\nPOLICE REPORT / INCIDENT REPORT #:\nINSURANCE (client's / other party's / health):\nWITNESSES / PHOTOS:\nPRIOR ATTORNEY / PRIOR INJURIES:\nRED FLAGS (SOL, liability, gaps, conflicts):\nRECOMMENDATION (accept / escalate / decline) & NEXT STEP:"
  },
  "rubric": [
   "Empathy & Rapport: Acknowledges the injury and the stress, keeps the caller comfortable, explains the process in plain language.",
   "Fact Capture: Captures who/what/when/where/how, injuries, treatment, police report, insurance for all parties, witnesses, and contact details — and the intake sheet matches what the caller said.",
   "Screening & Red Flags: Spots SOL problems, prior counsel/liens, liability issues, treatment gaps, pre-existing conditions and conflict-check names; asks the follow-up questions they call for.",
   "Boundaries & Next Steps: No case valuation, no guarantees, no legal advice; clear next step (attorney review, sign-up, records) with a timeline; advises no recorded statements only as firm policy allows."
  ],
  "tips": [
   "Start with how they're doing, then 'walk me through what happened'.",
   "Ask the date early — it drives the SOL.",
   "Always ask: prior attorney? prior injuries? other people in the car?",
   "Get every insurer: theirs, the other side's, health.",
   "Never say what a case is worth."
  ]
 },
 {
  "id": "cm_in_slipfall",
  "program": "CM",
  "line": "Intake Calls",
  "lineIcon": "📥",
  "dir": "in",
  "name": "Harold Jenkins",
  "role": "New caller — slip and fall (age 72)",
  "title": "Grocery-Store Slip and Fall",
  "level": "Intermediate",
  "gender": "m",
  "you": "You are the intake specialist screening a new personal-injury inquiry at LSH Law Group. You are answering this call.",
  "facts": "A caller's daughter set up this call; Harold is calling himself.",
  "goals": [
   "Captures store, location in store, hazard, lack of warning sign, and the incident report (employee 'Carl')",
   "Identifies evidence to preserve (store video, incident report, daughter's photos) — flags a preservation letter as urgent",
   "Gets Medicare as the health payer (Medicare lien/conditional payments)",
   "Records prior conditions (osteoporosis, 2019 hip) for the attorney",
   "Handles the daughter request properly (permission / authorization) and sets the next step"
  ],
  "hidden": "DOB 06/02/1953. Fell 3 weeks ago (a Saturday ~10 AM) in the produce aisle — there was water from the misting system on the floor, no wet-floor sign. A store employee (name tag 'Carl') helped you up and filled out an incident report; you didn't get a copy. Ambulance to St. Mary's; distal radius fracture, cast, now PT twice a week. Medicare + a Medicare supplement (AARP). Your daughter Ellen took photos of the wet floor on her phone that day. Prior: osteoporosis diagnosis, a hip replacement in 2019. Phone (555) 330-8812; daughter Ellen (555) 330-8845 (you want her on calls). HOW YOU BEHAVE: Polite, a little hard of hearing — asks the trainee to repeat things if they talk fast. Wants his daughter included.",
  "opening": "Good morning. I fell at the FreshWay grocery on Elm Street and broke my wrist. My daughter says I should talk to somebody.",
  "note": {
   "title": "Intake sheet",
   "template": "CALLER / CLIENT NAME:\nPHONE / EMAIL:\nDATE OF BIRTH:\nDATE & TIME OF INCIDENT:\nLOCATION:\nHOW IT HAPPENED:\nOTHER PARTIES (names / employer / vehicle):\nINJURIES:\nTREATMENT SO FAR (providers / dates):\nPOLICE REPORT / INCIDENT REPORT #:\nINSURANCE (client's / other party's / health):\nWITNESSES / PHOTOS:\nPRIOR ATTORNEY / PRIOR INJURIES:\nRED FLAGS (SOL, liability, gaps, conflicts):\nRECOMMENDATION (accept / escalate / decline) & NEXT STEP:"
  },
  "rubric": [
   "Empathy & Rapport: Acknowledges the injury and the stress, keeps the caller comfortable, explains the process in plain language.",
   "Fact Capture: Captures who/what/when/where/how, injuries, treatment, police report, insurance for all parties, witnesses, and contact details — and the intake sheet matches what the caller said.",
   "Screening & Red Flags: Spots SOL problems, prior counsel/liens, liability issues, treatment gaps, pre-existing conditions and conflict-check names; asks the follow-up questions they call for.",
   "Boundaries & Next Steps: No case valuation, no guarantees, no legal advice; clear next step (attorney review, sign-up, records) with a timeline; advises no recorded statements only as firm policy allows."
  ],
  "tips": [
   "Start with how they're doing, then 'walk me through what happened'.",
   "Ask the date early — it drives the SOL.",
   "Always ask: prior attorney? prior injuries? other people in the car?",
   "Get every insurer: theirs, the other side's, health.",
   "Never say what a case is worth."
  ]
 },
 {
  "id": "cm_in_represented",
  "program": "CM",
  "line": "Intake Calls",
  "lineIcon": "📥",
  "dir": "in",
  "name": "Brianna Scott",
  "role": "New caller — already has a lawyer",
  "title": "Already Has a Lawyer",
  "level": "Intermediate",
  "gender": "f",
  "you": "You are the intake specialist screening a new personal-injury inquiry at LSH Law Group. You are answering this call.",
  "facts": "A new inquiry. The front desk noted 'unhappy with current lawyer'.",
  "goals": [
   "Collects the incident facts and the current attorney's name/firm",
   "Explains that switching is the client's choice and the new firm will handle the substitution — does not disparage the other lawyer",
   "Flags the prior counsel's lien (quantum meruit / costs) for the attorney",
   "Doesn't promise the firm will take the case; routes to attorney review",
   "Does not contact the other attorney on the caller's behalf during the call"
  ],
  "hidden": "Motorcycle vs. car, 7 months ago. Current attorney: Barry Slow, The Fast Settlement Firm (the same prior counsel on the Doe file). He pushed you to take $8,000; you refused. You signed his contingency agreement. Injuries: broken collarbone, road rash, 2 months PT. Your insurer: Local Farm Mutual. Phone (555) 774-0021. HOW YOU BEHAVE: Frustrated with the current lawyer; wants a yes right now. Asks the intake specialist to 'just call Barry and tell him'.",
  "opening": "Hi, I already have a lawyer for my accident but he never calls me back and I want to switch to you guys. Can you just take over?",
  "note": {
   "title": "Intake sheet",
   "template": "CALLER / CLIENT NAME:\nPHONE / EMAIL:\nDATE OF BIRTH:\nDATE & TIME OF INCIDENT:\nLOCATION:\nHOW IT HAPPENED:\nOTHER PARTIES (names / employer / vehicle):\nINJURIES:\nTREATMENT SO FAR (providers / dates):\nPOLICE REPORT / INCIDENT REPORT #:\nINSURANCE (client's / other party's / health):\nWITNESSES / PHOTOS:\nPRIOR ATTORNEY / PRIOR INJURIES:\nRED FLAGS (SOL, liability, gaps, conflicts):\nRECOMMENDATION (accept / escalate / decline) & NEXT STEP:"
  },
  "rubric": [
   "Empathy & Rapport: Acknowledges the injury and the stress, keeps the caller comfortable, explains the process in plain language.",
   "Fact Capture: Captures who/what/when/where/how, injuries, treatment, police report, insurance for all parties, witnesses, and contact details — and the intake sheet matches what the caller said.",
   "Screening & Red Flags: Spots SOL problems, prior counsel/liens, liability issues, treatment gaps, pre-existing conditions and conflict-check names; asks the follow-up questions they call for.",
   "Boundaries & Next Steps: No case valuation, no guarantees, no legal advice; clear next step (attorney review, sign-up, records) with a timeline; advises no recorded statements only as firm policy allows."
  ],
  "tips": [
   "Start with how they're doing, then 'walk me through what happened'.",
   "Ask the date early — it drives the SOL.",
   "Always ask: prior attorney? prior injuries? other people in the car?",
   "Get every insurer: theirs, the other side's, health.",
   "Never say what a case is worth."
  ]
 },
 {
  "id": "cm_in_value",
  "program": "CM",
  "line": "Intake Calls",
  "lineIcon": "📥",
  "dir": "in",
  "name": "Andre Mills",
  "role": "New caller — wants a number",
  "title": "“What’s My Case Worth?”",
  "level": "Beginner",
  "gender": "m",
  "you": "You are the intake specialist screening a new personal-injury inquiry at LSH Law Group. You are answering this call.",
  "facts": "A new inquiry about a dog bite.",
  "goals": [
   "Declines to give any value/ballpark and explains why (the attorney evaluates after records)",
   "Captures owner, dog, prior-bite history, animal-control report # and the landlord question (possible insurance)",
   "Captures injuries/treatment and the upcoming wound check",
   "Asks about homeowner's/renter's insurance",
   "Clear next step with timeline"
  ],
  "hidden": "Bitten 5 days ago in front of your house by the neighbor's pit mix 'Rocco' (owner: Gary Hunt, next door, renter — landlord unknown). ER visit, 6 stitches, antibiotics; wound check in 2 days. Animal control came (report # AC-5521). The dog had bitten a delivery driver last year (you heard). Phone (555) 208-1175. You have photos of the wound. HOW YOU BEHAVE: Keeps pushing for a dollar figure (asks 2-3 times). Becomes cooperative once the process is explained confidently.",
  "opening": "Hey. My neighbor's dog bit me pretty bad on the leg. Before I waste my time — how much are these cases worth? Like, ballpark?",
  "note": {
   "title": "Intake sheet",
   "template": "CALLER / CLIENT NAME:\nPHONE / EMAIL:\nDATE OF BIRTH:\nDATE & TIME OF INCIDENT:\nLOCATION:\nHOW IT HAPPENED:\nOTHER PARTIES (names / employer / vehicle):\nINJURIES:\nTREATMENT SO FAR (providers / dates):\nPOLICE REPORT / INCIDENT REPORT #:\nINSURANCE (client's / other party's / health):\nWITNESSES / PHOTOS:\nPRIOR ATTORNEY / PRIOR INJURIES:\nRED FLAGS (SOL, liability, gaps, conflicts):\nRECOMMENDATION (accept / escalate / decline) & NEXT STEP:"
  },
  "rubric": [
   "Empathy & Rapport: Acknowledges the injury and the stress, keeps the caller comfortable, explains the process in plain language.",
   "Fact Capture: Captures who/what/when/where/how, injuries, treatment, police report, insurance for all parties, witnesses, and contact details — and the intake sheet matches what the caller said.",
   "Screening & Red Flags: Spots SOL problems, prior counsel/liens, liability issues, treatment gaps, pre-existing conditions and conflict-check names; asks the follow-up questions they call for.",
   "Boundaries & Next Steps: No case valuation, no guarantees, no legal advice; clear next step (attorney review, sign-up, records) with a timeline; advises no recorded statements only as firm policy allows."
  ],
  "tips": [
   "Start with how they're doing, then 'walk me through what happened'.",
   "Ask the date early — it drives the SOL.",
   "Always ask: prior attorney? prior injuries? other people in the car?",
   "Get every insurer: theirs, the other side's, health.",
   "Never say what a case is worth."
  ]
 },
 {
  "id": "cm_cl_pulse",
  "program": "CM",
  "line": "Client Communication",
  "lineIcon": "🤝",
  "dir": "out",
  "name": "John Doe",
  "role": "Client (you are calling him)",
  "title": "30-Day Client Pulse Call",
  "level": "Beginner",
  "gender": "m",
  "you": "You are the Case Manager on the client's file at LSH Law Group. You are placing this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "30-day client pulse call. John is post-microdiscectomy and doing PT. The demand is out; Aggressive Casualty countered $45,000 and the attorney rejected it. You're calling to check in.",
  "goals": [
   "Explains the status (demand, $45,000 counter rejected) accurately without predicting timing or value",
   "Captures the treatment update (foot drop symptoms, one missed PT) and encourages keeping appointments",
   "Asks for / takes the Global Health Blue-Shield letter and flags the plan-identity discrepancy",
   "Addresses social media: politely asks him to stop posting and flags to the attorney",
   "Documents it all in the CMS note with follow-ups"
  ],
  "hidden": "You're doing PT twice a week; your left foot still drags when you're tired. You got a letter from 'Global Health Blue-Shield' about a lien and you're confused (you thought you had BCBS). You missed one PT session last week because of a work meeting (you're on light duty). You want to know when it'll settle. You also mention you posted a photo of your scar on Facebook last week. HOW YOU BEHAVE: Tired but cooperative. Asks 'so when do I get my money?'. Mentions the Facebook post casually near the end, only if the call goes on or if asked about anything new.",
  "opening": "Hello? Oh — hi. Is this about my case?",
  "note": {
   "title": "CMS case note",
   "template": "DATE / TIME:\nCALL WITH:\nPURPOSE:\nWHAT THE CLIENT REPORTED (facts, treatment, concerns):\nWHAT I EXPLAINED:\nCOMMITMENTS MADE (by whom / by when):\nESCALATIONS TO ATTORNEY:\nFOLLOW-UP TASKS:"
  },
  "rubric": [
   "Empathy & Tone: Warm, patient, plain language; acknowledges emotion before information; no jargon or defensiveness.",
   "Accuracy & Clarity: Uses correct file facts; explains status, process and next steps clearly; checks understanding.",
   "Boundaries & Ethics: No legal advice or case valuation; no promises on outcome or timing; no cash advances; escalates decisions to the attorney.",
   "Action & Documentation: Concrete next steps with owners and dates; the CMS note is accurate, complete and objective."
  ],
  "tips": [
   "Open with why you're calling (or thank them for calling).",
   "Acknowledge feelings before facts.",
   "Say what you'll do and by when — then write it down.",
   "'That's a question for your attorney — I'll get you an answer by…'"
  ],
  "caseFile": true
 },
 {
  "id": "cm_cl_advance",
  "program": "CM",
  "line": "Client Communication",
  "lineIcon": "🤝",
  "dir": "in",
  "name": "Teresa Alvarez",
  "role": "Client — needs money",
  "title": "“Can the Firm Front Me Money?”",
  "level": "Intermediate",
  "gender": "f",
  "you": "You are the Case Manager on the client's file at LSH Law Group. You are answering this call.",
  "facts": "A client on a pending auto case calls your direct line. Her case is in negotiation.",
  "goals": [
   "Empathetic, non-judgmental",
   "Explains the firm cannot advance living expenses (ethics rule) without lecturing",
   "Does not advise on the pre-settlement loan or on accepting the offer — routes both to the attorney promptly",
   "Offers legitimate help (e.g., community resources, disability/wage-loss claim paperwork if applicable)",
   "Documents the settlement-authority question as an attorney escalation with a callback time"
  ],
  "hidden": "Case: rear-end, 10 months ago, in negotiation. You're out of work on doctor's orders. Rent is due in 5 days ($1,450). You've heard of 'lawsuit loan' companies from TV ads and ask about them. You also ask whether you should just take the last offer ($18,000) so you can pay rent. HOW YOU BEHAVE: Embarrassed, then desperate. Pushes twice for the advance.",
  "opening": "Hi, it's Teresa Alvarez. Look, I'm behind on rent because I can't work. Can the firm just front me like two thousand dollars from my settlement? I'll pay it back.",
  "note": {
   "title": "CMS case note",
   "template": "DATE / TIME:\nCALL WITH:\nPURPOSE:\nWHAT THE CLIENT REPORTED (facts, treatment, concerns):\nWHAT I EXPLAINED:\nCOMMITMENTS MADE (by whom / by when):\nESCALATIONS TO ATTORNEY:\nFOLLOW-UP TASKS:"
  },
  "rubric": [
   "Empathy & Tone: Warm, patient, plain language; acknowledges emotion before information; no jargon or defensiveness.",
   "Accuracy & Clarity: Uses correct file facts; explains status, process and next steps clearly; checks understanding.",
   "Boundaries & Ethics: No legal advice or case valuation; no promises on outcome or timing; no cash advances; escalates decisions to the attorney.",
   "Action & Documentation: Concrete next steps with owners and dates; the CMS note is accurate, complete and objective."
  ],
  "tips": [
   "Open with why you're calling (or thank them for calling).",
   "Acknowledge feelings before facts.",
   "Say what you'll do and by when — then write it down.",
   "'That's a question for your attorney — I'll get you an answer by…'"
  ]
 },
 {
  "id": "cm_cl_denial",
  "program": "CM",
  "line": "Client Communication",
  "lineIcon": "🤝",
  "dir": "out",
  "name": "John Doe",
  "role": "Client (you are calling him)",
  "title": "Delivering Bad News: PD Denied",
  "level": "Intermediate",
  "gender": "m",
  "you": "You are the Case Manager on the client's file at LSH Law Group. You are placing this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "You need to tell John that Aggressive Casualty DENIED the property-damage claim for his Tesla ($42,500 total loss) under Exclusion 4.b. His own collision coverage (Local Farm Mutual, ACV, $1,000 deductible) is the path. He doesn't know yet.",
  "goals": [
   "Leads with the bottom line kindly (BLUF) — the PD claim was denied under Exclusion 4.b",
   "Explains the next path: his collision coverage (ACV, $1,000 deductible) and that the deductible may be recovered later (attorney's call) — no promises",
   "Routes 'can we sue for the car' to the attorney",
   "Addresses the rental and loan concerns with concrete next steps (open the collision claim, gap insurance question)",
   "Documents the call and follow-ups"
  ],
  "hidden": "You were counting on Apex's insurance paying for the Tesla. You're still paying the car loan (~$700/month) and renting a car ($45/day) for three weeks. You're upset: 'Their guy ran a red light!'. Ask: 'Can we sue them for the car?' and 'Why do I have to pay a deductible?' HOW YOU BEHAVE: Frustrated, a bit angry at the unfairness; calms if the path forward is clear.",
  "opening": "Hey, this is John. What's going on?",
  "note": {
   "title": "CMS case note",
   "template": "DATE / TIME:\nCALL WITH:\nPURPOSE:\nWHAT THE CLIENT REPORTED (facts, treatment, concerns):\nWHAT I EXPLAINED:\nCOMMITMENTS MADE (by whom / by when):\nESCALATIONS TO ATTORNEY:\nFOLLOW-UP TASKS:"
  },
  "rubric": [
   "Empathy & Tone: Warm, patient, plain language; acknowledges emotion before information; no jargon or defensiveness.",
   "Accuracy & Clarity: Uses correct file facts; explains status, process and next steps clearly; checks understanding.",
   "Boundaries & Ethics: No legal advice or case valuation; no promises on outcome or timing; no cash advances; escalates decisions to the attorney.",
   "Action & Documentation: Concrete next steps with owners and dates; the CMS note is accurate, complete and objective."
  ],
  "tips": [
   "Open with why you're calling (or thank them for calling).",
   "Acknowledge feelings before facts.",
   "Say what you'll do and by when — then write it down.",
   "'That's a question for your attorney — I'll get you an answer by…'"
  ],
  "caseFile": true
 },
 {
  "id": "cm_cl_depo",
  "program": "CM",
  "line": "Client Communication",
  "lineIcon": "🤝",
  "dir": "in",
  "name": "John Doe",
  "role": "Client — deposition tomorrow",
  "title": "Night-Before-Deposition Panic",
  "level": "Advanced",
  "gender": "m",
  "you": "You are the Case Manager on the client's file at LSH Law Group. You are answering this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "The day before John's deposition. He calls you in the evening.",
  "goals": [
   "Calms him and insists on complete honesty — never suggests hiding anything",
   "Does not coach testimony or give legal advice; routes content questions to the attorney (offers to set a quick prep call tonight/in the morning)",
   "Confirms logistics (time, place, ID, dress, no documents unless the attorney says)",
   "Handles the 'bring Jane' question correctly (attorney decides; she may be a witness)",
   "Documents and notifies the attorney of his anxiety and the 2018 question"
  ],
  "hidden": "You're scared the 2018 lumbar strain will 'ruin' the case. You also forgot what time to be there and whether to bring anything. You want to know if you can bring Jane. HOW YOU BEHAVE: Anxious, rambling. Tests whether the CM will tell him what to say.",
  "opening": "Hey, sorry to call late. I'm freaking out about tomorrow. Honestly — do I have to tell them about my back thing in 2018? It was nothing.",
  "note": {
   "title": "CMS case note",
   "template": "DATE / TIME:\nCALL WITH:\nPURPOSE:\nWHAT THE CLIENT REPORTED (facts, treatment, concerns):\nWHAT I EXPLAINED:\nCOMMITMENTS MADE (by whom / by when):\nESCALATIONS TO ATTORNEY:\nFOLLOW-UP TASKS:"
  },
  "rubric": [
   "Empathy & Tone: Warm, patient, plain language; acknowledges emotion before information; no jargon or defensiveness.",
   "Accuracy & Clarity: Uses correct file facts; explains status, process and next steps clearly; checks understanding.",
   "Boundaries & Ethics: No legal advice or case valuation; no promises on outcome or timing; no cash advances; escalates decisions to the attorney.",
   "Action & Documentation: Concrete next steps with owners and dates; the CMS note is accurate, complete and objective."
  ],
  "tips": [
   "Open with why you're calling (or thank them for calling).",
   "Acknowledge feelings before facts.",
   "Say what you'll do and by when — then write it down.",
   "'That's a question for your attorney — I'll get you an answer by…'"
  ],
  "caseFile": true
 },
 {
  "id": "cm_cl_net",
  "program": "CM",
  "line": "Client Communication",
  "lineIcon": "🤝",
  "dir": "in",
  "name": "John Doe",
  "role": "Client — upset about his net",
  "title": "“Why Is My Check So Small?”",
  "level": "Intermediate",
  "gender": "m",
  "you": "You are the Case Manager on the client's file at LSH Law Group. You are answering this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "The settlement statement went out yesterday. Gross $150,000; attorney fee 40% of gross after costs; costs $2,090; liens negotiated down to $28,000; net to client $60,746.",
  "goals": [
   "Acknowledges the feeling before walking through the math",
   "Walks gross → costs → fee (40% because suit was filed, per the retainer) → liens → net accurately",
   "Points out the lien reductions already won (from the asserted amounts)",
   "Does not promise a date for the check; explains trust-account clearance and signatures",
   "Offers an attorney call if he still disputes the fee; documents it"
  ],
  "hidden": "You didn't realize the fee went to 40% when suit was filed. You think the lien reductions 'didn't happen'. You want the check this week. HOW YOU BEHAVE: Angry, feels cheated. Calms down when walked through the numbers line by line.",
  "opening": "I just looked at this statement. A hundred and fifty thousand dollars and I get sixty? How is that fair? Where did all my money go?",
  "note": {
   "title": "CMS case note",
   "template": "DATE / TIME:\nCALL WITH:\nPURPOSE:\nWHAT THE CLIENT REPORTED (facts, treatment, concerns):\nWHAT I EXPLAINED:\nCOMMITMENTS MADE (by whom / by when):\nESCALATIONS TO ATTORNEY:\nFOLLOW-UP TASKS:"
  },
  "rubric": [
   "Empathy & Tone: Warm, patient, plain language; acknowledges emotion before information; no jargon or defensiveness.",
   "Accuracy & Clarity: Uses correct file facts; explains status, process and next steps clearly; checks understanding.",
   "Boundaries & Ethics: No legal advice or case valuation; no promises on outcome or timing; no cash advances; escalates decisions to the attorney.",
   "Action & Documentation: Concrete next steps with owners and dates; the CMS note is accurate, complete and objective."
  ],
  "tips": [
   "Open with why you're calling (or thank them for calling).",
   "Acknowledge feelings before facts.",
   "Say what you'll do and by when — then write it down.",
   "'That's a question for your attorney — I'll get you an answer by…'"
  ],
  "caseFile": true
 },
 {
  "id": "cm_at_weekly",
  "program": "CM",
  "line": "Attorney Reporting",
  "lineIcon": "⚖",
  "dir": "out",
  "name": "Attorney Dana Carter",
  "role": "Handling attorney (you are calling her)",
  "title": "Weekly Status Report on Doe",
  "level": "Beginner",
  "gender": "f",
  "you": "You are the Case Manager reporting to the handling attorney at LSH Law Group. You are placing this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "Weekly status call on John Doe v. Apex. Current facts: demand $250,000 sent 05/15; counter $45,000 on 05/22; rejected 05/26. New since last week: Dr. Neil Ron's 5% WPI permanency report arrived; Metro General's lien ($45,000) is disputed against its $12,700 bill; John missed one PT session; the 30-day policy-limits clock is running. You need: approval to send the permanency report with a supplemental demand.",
  "goals": [
   "Opens with BLUF (new permanency report + the ask)",
   "States numbers correctly (5% WPI, $250,000 / $45,000, $45,000 lien vs $12,700 bill)",
   "Gives deadline dates rather than vague timing",
   "Gets a clear decision and repeats it back (supplemental demand draft by tomorrow noon)",
   "Recap email accurately reflects the instruction"
  ],
  "hidden": "You're busy and direct. You'll ask: 'What's the WPI number?', 'Did the adjuster respond to the rejection?', 'What's the Metro General issue exactly?', 'When does the policy-limits clock run?'. If the CM gives a clear ask, you approve the supplemental demand and ask for a draft by tomorrow noon. If they ramble, cut them off: 'Bottom line?' HOW YOU BEHAVE: Impatient with rambling, appreciative of crisp answers. Tests accuracy with one pointed question.",
  "opening": "Carter. I've got about three minutes before a call — what do you have on Doe?",
  "note": {
   "title": "Follow-up recap email to the attorney",
   "template": "SUBJECT:\nBLUF:\nKEY FACTS / NUMBERS:\nDEADLINES (date + time):\nDECISION / AUTHORITY NEEDED:\nWHAT I'VE DONE:\nNEXT STEPS (owner / date):"
  },
  "rubric": [
   "BLUF & Brevity: Leads with the bottom line in the first sentence; no rambling or background first; respects the attorney's time.",
   "Factual Accuracy: Correct names, numbers, dates and document references; answers the attorney's follow-up questions precisely or says 'I'll confirm by…' instead of guessing.",
   "Deadlines & Decision: States every deadline with date/time; asks clearly for the decision or authority needed; confirms the attorney's instruction back.",
   "Ownership & Documentation: Owns problems (including mistakes) without excuses; proposes a plan; the recap email accurately captures instructions."
  ],
  "tips": [
   "First sentence = the bottom line.",
   "Numbers and dates, not adjectives.",
   "Say what you need: 'I need your decision on X by Y.'",
   "Repeat the instruction back before hanging up."
  ],
  "caseFile": true
 },
 {
  "id": "cm_at_rfa",
  "program": "CM",
  "line": "Attorney Reporting",
  "lineIcon": "⚖",
  "dir": "out",
  "name": "Attorney Dana Carter",
  "role": "Handling attorney (you are calling her)",
  "title": "Urgent: RFAs Served",
  "level": "Intermediate",
  "gender": "f",
  "you": "You are the Case Manager reporting to the handling attorney at LSH Law Group. You are placing this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "URGENT: Defense served Requests for Admission on John Doe v. Apex by mail on 06/12/2026 (30 days + 3 for mail → responses due 07/15/2026). Several RFAs ask John to admit his injuries pre-existed the crash. The attorney is at the courthouse.",
  "goals": [
   "Leads with 'RFAs served — deemed admitted if we miss 07/15'",
   "Correct service method and calculation (mail +3 days)",
   "Confirms docketing with warning alerts",
   "Gets and repeats the instructions (drafts by 07/08, client meeting)",
   "Recap email with the exact dates"
  ],
  "hidden": "You'll ask: 'Served how and when?', 'What's the due date?', 'How many requests?' (say you don't have it in front of you if they ask you), 'Have you calendared it?'. You'll instruct: calendar a 7-day warning, send the draft responses to you by 07/08, and set a client meeting to review the RFAs. HOW YOU BEHAVE: Rushed but engaged once you hear 'RFAs'. Irritated by any wrong date.",
  "opening": "I'm between hearings — is this urgent?",
  "note": {
   "title": "Follow-up recap email to the attorney",
   "template": "SUBJECT:\nBLUF:\nKEY FACTS / NUMBERS:\nDEADLINES (date + time):\nDECISION / AUTHORITY NEEDED:\nWHAT I'VE DONE:\nNEXT STEPS (owner / date):"
  },
  "rubric": [
   "BLUF & Brevity: Leads with the bottom line in the first sentence; no rambling or background first; respects the attorney's time.",
   "Factual Accuracy: Correct names, numbers, dates and document references; answers the attorney's follow-up questions precisely or says 'I'll confirm by…' instead of guessing.",
   "Deadlines & Decision: States every deadline with date/time; asks clearly for the decision or authority needed; confirms the attorney's instruction back.",
   "Ownership & Documentation: Owns problems (including mistakes) without excuses; proposes a plan; the recap email accurately captures instructions."
  ],
  "tips": [
   "First sentence = the bottom line.",
   "Numbers and dates, not adjectives.",
   "Say what you need: 'I need your decision on X by Y.'",
   "Repeat the instruction back before hanging up."
  ],
  "caseFile": true
 },
 {
  "id": "cm_at_mistake",
  "program": "CM",
  "line": "Attorney Reporting",
  "lineIcon": "⚖",
  "dir": "out",
  "name": "Attorney Dana Carter",
  "role": "Handling attorney (you are calling her)",
  "title": "Owning a Missed Subpoena",
  "level": "Advanced",
  "gender": "f",
  "you": "You are the Case Manager reporting to the handling attorney at LSH Law Group. You are placing this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "You discovered that the Metro General subpoena was never served — it's been sitting in the outbox for 12 days (the subpoena audit should happen every 10 days). The mediation is in 3 weeks and the records are needed for the binder. You need to tell the attorney.",
  "goals": [
   "States the problem plainly up front (no burying it)",
   "Owns it without excuses or blaming a colleague",
   "Explains the impact (records for the mediation binder, timeline)",
   "Brings a concrete fix with dates (serve today, expedited production, custodian call, audit fix)",
   "Recap email is honest and complete"
  ],
  "hidden": "You'll ask: 'How did that happen?', 'What's the impact on mediation?', 'What's your fix?'. You respond well to ownership + a plan (serve today, request expedited production, call the records custodian, add a check to the audit). You react badly to blaming others or minimizing. HOW YOU BEHAVE: Calm but serious. Probes for ownership.",
  "opening": "Hi — what's up?",
  "note": {
   "title": "Follow-up recap email to the attorney",
   "template": "SUBJECT:\nBLUF:\nKEY FACTS / NUMBERS:\nDEADLINES (date + time):\nDECISION / AUTHORITY NEEDED:\nWHAT I'VE DONE:\nNEXT STEPS (owner / date):"
  },
  "rubric": [
   "BLUF & Brevity: Leads with the bottom line in the first sentence; no rambling or background first; respects the attorney's time.",
   "Factual Accuracy: Correct names, numbers, dates and document references; answers the attorney's follow-up questions precisely or says 'I'll confirm by…' instead of guessing.",
   "Deadlines & Decision: States every deadline with date/time; asks clearly for the decision or authority needed; confirms the attorney's instruction back.",
   "Ownership & Documentation: Owns problems (including mistakes) without excuses; proposes a plan; the recap email accurately captures instructions."
  ],
  "tips": [
   "First sentence = the bottom line.",
   "Numbers and dates, not adjectives.",
   "Say what you need: 'I need your decision on X by Y.'",
   "Repeat the instruction back before hanging up."
  ],
  "caseFile": true
 },
 {
  "id": "cm_at_offer",
  "program": "CM",
  "line": "Attorney Reporting",
  "lineIcon": "⚖",
  "dir": "out",
  "name": "Attorney Dana Carter",
  "role": "Handling attorney (you are calling her)",
  "title": "Conveying a New Offer",
  "level": "Intermediate",
  "gender": "f",
  "you": "You are the Case Manager reporting to the handling attorney at LSH Law Group. You are placing this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "Aggressive Casualty's adjuster just called with a new offer of $95,000 on John Doe, open until Friday 5 PM. The client asked you yesterday to 'get it done soon' but has not given any number. Liens asserted: $45,000 Metro General, $20,000 BlueCross ERISA, $11,200 Global Health, $1,200 prior counsel.",
  "goals": [
   "BLUF: new offer $95,000, deadline Friday 5 PM",
   "Accurate lien totals; any net estimate clearly labeled as preliminary",
   "Makes clear nothing was said to the client about accepting",
   "Gets and repeats instructions (client call Thu 10 AM, net sheets at 95k and 125k)",
   "Recap email with the offer, deadline and tasks"
  ],
  "hidden": "You'll ask: 'What did the adjuster say about the permanency report?', 'What's the client's net at 95?', 'What are the liens at right now?'. You want a quick net estimate, and you'll instruct the CM to schedule a client call Thursday at 10 and prepare a net sheet at 95k and at 125k. HOW YOU BEHAVE: Analytical. Expects the CM NOT to have discussed the offer's merits with the client.",
  "opening": "Carter. Go ahead.",
  "note": {
   "title": "Follow-up recap email to the attorney",
   "template": "SUBJECT:\nBLUF:\nKEY FACTS / NUMBERS:\nDEADLINES (date + time):\nDECISION / AUTHORITY NEEDED:\nWHAT I'VE DONE:\nNEXT STEPS (owner / date):"
  },
  "rubric": [
   "BLUF & Brevity: Leads with the bottom line in the first sentence; no rambling or background first; respects the attorney's time.",
   "Factual Accuracy: Correct names, numbers, dates and document references; answers the attorney's follow-up questions precisely or says 'I'll confirm by…' instead of guessing.",
   "Deadlines & Decision: States every deadline with date/time; asks clearly for the decision or authority needed; confirms the attorney's instruction back.",
   "Ownership & Documentation: Owns problems (including mistakes) without excuses; proposes a plan; the recap email accurately captures instructions."
  ],
  "tips": [
   "First sentence = the bottom line.",
   "Numbers and dates, not adjectives.",
   "Say what you need: 'I need your decision on X by Y.'",
   "Repeat the instruction back before hanging up."
  ],
  "caseFile": true
 },
 {
  "id": "cm_at_jordan",
  "program": "CM",
  "line": "Attorney Reporting",
  "lineIcon": "⚖",
  "dir": "out",
  "name": "Attorney Dana Carter",
  "role": "Handling attorney (you are calling her)",
  "title": "Jordan Davies Coverage Briefing",
  "level": "Advanced",
  "gender": "f",
  "you": "You are the Case Manager reporting to the handling attorney at LSH Law Group. You are placing this call.",
  "facts": "Jordan Davies file: the at-fault driver's policy is only $10,000 (State General), and State General is proposing a 50/50 liability split based only on its insured's statement. You found hidden coverage: Jordan's own Coastal Mutual UIM, plus Allied Mutual UIM through the household (his mother's policy). Summit Auto does NOT apply. CCTV at the Quick-Fuel station may be overwritten in ~30 days. Jordan stopped treatment 2 weeks ago because he's scared of the bills.",
  "goals": [
   "Leads with the coverage finding (UIM stack) and the liability-split threat",
   "Accurately explains Coastal + Allied (not Summit) and the need for notice/consent before any BI tender",
   "Proposes evidence preservation (Quick-Fuel CCTV, 911/CAD, bus-driver witness) with urgency",
   "Raises the treatment gap and an LOP solution",
   "Gets approvals and repeats them; recap email complete"
  ],
  "hidden": "You'll ask: 'How much UIM?', 'Have we sent notice to the UIM carriers?', 'Why not Summit?', 'What's the plan to fight the split?'. You'll approve preservation letters today and the notice letters, and ask about getting Jordan back into treatment (LOP). HOW YOU BEHAVE: Fast and strategic. Checks whether the CM understands consent-to-settle with UIM.",
  "opening": "I've got ten minutes. Davies — good news or bad news first?",
  "note": {
   "title": "Follow-up recap email to the attorney",
   "template": "SUBJECT:\nBLUF:\nKEY FACTS / NUMBERS:\nDEADLINES (date + time):\nDECISION / AUTHORITY NEEDED:\nWHAT I'VE DONE:\nNEXT STEPS (owner / date):"
  },
  "rubric": [
   "BLUF & Brevity: Leads with the bottom line in the first sentence; no rambling or background first; respects the attorney's time.",
   "Factual Accuracy: Correct names, numbers, dates and document references; answers the attorney's follow-up questions precisely or says 'I'll confirm by…' instead of guessing.",
   "Deadlines & Decision: States every deadline with date/time; asks clearly for the decision or authority needed; confirms the attorney's instruction back.",
   "Ownership & Documentation: Owns problems (including mistakes) without excuses; proposes a plan; the recap email accurately captures instructions."
  ],
  "tips": [
   "First sentence = the bottom line.",
   "Numbers and dates, not adjectives.",
   "Say what you need: 'I need your decision on X by Y.'",
   "Repeat the instruction back before hanging up."
  ]
 },
 {
  "id": "cm_ins_pip",
  "program": "CM",
  "line": "Adjusters & Carriers",
  "lineIcon": "🛡",
  "dir": "out",
  "name": "Sarah Miller",
  "role": "PIP adjuster, Local Farm Mutual",
  "title": "PIP Status & Coverage Check",
  "level": "Beginner",
  "gender": "f",
  "you": "You are the Case Manager calling or taking calls from insurers at LSH Law Group. You are placing this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "Call Local Farm Mutual (John Doe's own carrier) to confirm PIP status. Claim LFM-99210-JD. You need: the PIP payment ledger, confirmation PIP is exhausted, the UM/UIM limits ($250k/$500k) in writing, and the dec page.",
  "goals": [
   "Identifies self, firm, client, claim # and DOL",
   "Confirms PIP exhausted and gets the ledger breakdown",
   "Requests the dec page and UM/UIM limits in writing",
   "Declines the recorded statement (routes to the attorney) politely",
   "Call log with the direct line and follow-up date"
  ],
  "hidden": "PIP $10,000 is exhausted: EMS $2,200 + ER $4,800 + CT $3,000, all paid in February/March. You can email the ledger but need a letter of representation on file first (you have it). You will ask the CM to 'have Mr. Doe call me for a quick recorded statement on the UM side'. Direct line (555) 480-2200 ext. 44. HOW YOU BEHAVE: Friendly, procedural. Slips in the recorded-statement request as routine.",
  "opening": "Local Farm Mutual claims, this is Sarah Miller.",
  "note": {
   "title": "Call log (CMS note)",
   "template": "DATE / TIME:\nSPOKE WITH (name / title / direct line):\nCARRIER / CLAIM #:\nPURPOSE:\nINFORMATION OBTAINED:\nREQUESTS MADE / DOCUMENTS TO SEND:\nCARRIER'S POSITION / COMMITMENTS:\nCONFIRMATION LETTER SENT? (Y/N, date):\nFOLLOW-UP DATE:"
  },
  "rubric": [
   "Preparation & Identifiers: Has the claim #, insured, DOL, policy and client identifiers ready; confirms the adjuster's name, title and direct line.",
   "Assertiveness & Composure: Professional and firm; pushes for specific answers and dates; doesn't get rattled by stalls or pressure.",
   "Protecting the Client: No recorded statements, no blanket medical authorizations, no admissions or speculation; nothing that hurts liability or damages.",
   "Follow-Through: Gets commitments with dates, confirms everything in writing, and the call log is complete and accurate."
  ],
  "tips": [
   "Get the adjuster's full name and direct line first.",
   "Ask for specifics: amount, date, document.",
   "'I'll confirm our conversation in writing today.'",
   "Recorded statements and blanket authorizations: not without the attorney."
  ],
  "caseFile": true
 },
 {
  "id": "cm_ins_stall",
  "program": "CM",
  "line": "Adjusters & Carriers",
  "lineIcon": "🛡",
  "dir": "out",
  "name": "Tom Reeves",
  "role": "BI adjuster, Aggressive Casualty",
  "title": "Breaking an Adjuster’s Stall",
  "level": "Intermediate",
  "gender": "m",
  "you": "You are the Case Manager calling or taking calls from insurers at LSH Law Group. You are placing this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "You sent the supplemental demand with Dr. Neil Ron's permanency report (5% WPI) 21 days ago. No response. Claim 2026-0214-AX, insured Apex Delivery Services. The attorney wants a response date.",
  "goals": [
   "Identifies claim and the date the supplement was sent",
   "Doesn't argue the merits (pre-existing) — notes it and stays on the ask",
   "Gets a specific response date and the manager's name",
   "Confirms in writing",
   "Accurate call log with commitments"
  ],
  "hidden": "You haven't reviewed it: 'It's with my manager', 'We're waiting on a peer review of the medicals', 'The 2018 back injury is a real problem for you'. If pushed firmly and professionally, commit to a written response within 10 business days. HOW YOU BEHAVE: Stalls, deflects, tries to argue the pre-existing condition. Respects firmness; ignores pleading.",
  "opening": "Tom Reeves.",
  "note": {
   "title": "Call log (CMS note)",
   "template": "DATE / TIME:\nSPOKE WITH (name / title / direct line):\nCARRIER / CLAIM #:\nPURPOSE:\nINFORMATION OBTAINED:\nREQUESTS MADE / DOCUMENTS TO SEND:\nCARRIER'S POSITION / COMMITMENTS:\nCONFIRMATION LETTER SENT? (Y/N, date):\nFOLLOW-UP DATE:"
  },
  "rubric": [
   "Preparation & Identifiers: Has the claim #, insured, DOL, policy and client identifiers ready; confirms the adjuster's name, title and direct line.",
   "Assertiveness & Composure: Professional and firm; pushes for specific answers and dates; doesn't get rattled by stalls or pressure.",
   "Protecting the Client: No recorded statements, no blanket medical authorizations, no admissions or speculation; nothing that hurts liability or damages.",
   "Follow-Through: Gets commitments with dates, confirms everything in writing, and the call log is complete and accurate."
  ],
  "tips": [
   "Get the adjuster's full name and direct line first.",
   "Ask for specifics: amount, date, document.",
   "'I'll confirm our conversation in writing today.'",
   "Recorded statements and blanket authorizations: not without the attorney."
  ],
  "caseFile": true
 },
 {
  "id": "cm_ins_um",
  "program": "CM",
  "line": "Adjusters & Carriers",
  "lineIcon": "🛡",
  "dir": "out",
  "name": "Greg Patel",
  "role": "UM/UIM adjuster, Local Farm Mutual",
  "title": "UM Consent to Settle",
  "level": "Intermediate",
  "gender": "m",
  "you": "You are the Case Manager calling or taking calls from insurers at LSH Law Group. You are placing this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "The attorney wants written consent to settle the BI claim with Aggressive Casualty and a waiver of subrogation from the UM carrier (Local Farm Mutual) before accepting any BI tender.",
  "goals": [
   "Explains the consent-to-settle + waiver-of-subrogation request clearly",
   "Gets the UM claim opened / number assigned",
   "Agrees to send the request in writing with the BI offer documentation (not a blanket authorization)",
   "Declines the recorded statement",
   "Gets the response timeline and documents it"
  ],
  "hidden": "You haven't opened a UM file yet. You need: the BI offer amount, the tentative settlement documents, and 'your client's medicals'. Standard practice: 30 days to respond to a consent request. You'll ask for a recorded statement and a blanket medical authorization. HOW YOU BEHAVE: Slow, bureaucratic.",
  "opening": "UM claims, Greg Patel speaking.",
  "note": {
   "title": "Call log (CMS note)",
   "template": "DATE / TIME:\nSPOKE WITH (name / title / direct line):\nCARRIER / CLAIM #:\nPURPOSE:\nINFORMATION OBTAINED:\nREQUESTS MADE / DOCUMENTS TO SEND:\nCARRIER'S POSITION / COMMITMENTS:\nCONFIRMATION LETTER SENT? (Y/N, date):\nFOLLOW-UP DATE:"
  },
  "rubric": [
   "Preparation & Identifiers: Has the claim #, insured, DOL, policy and client identifiers ready; confirms the adjuster's name, title and direct line.",
   "Assertiveness & Composure: Professional and firm; pushes for specific answers and dates; doesn't get rattled by stalls or pressure.",
   "Protecting the Client: No recorded statements, no blanket medical authorizations, no admissions or speculation; nothing that hurts liability or damages.",
   "Follow-Through: Gets commitments with dates, confirms everything in writing, and the call log is complete and accurate."
  ],
  "tips": [
   "Get the adjuster's full name and direct line first.",
   "Ask for specifics: amount, date, document.",
   "'I'll confirm our conversation in writing today.'",
   "Recorded statements and blanket authorizations: not without the attorney."
  ],
  "caseFile": true
 },
 {
  "id": "cm_ins_inbound",
  "program": "CM",
  "line": "Adjusters & Carriers",
  "lineIcon": "🛡",
  "dir": "in",
  "name": "Nina Ross",
  "role": "Adjuster, Aggressive Casualty (calling the firm)",
  "title": "The Friendly Fishing Adjuster",
  "level": "Advanced",
  "gender": "f",
  "you": "You are the Case Manager calling or taking calls from insurers at LSH Law Group. You are answering this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "You pick up your direct line. You're the CM on the Doe file.",
  "goals": [
   "Does not answer fishing questions about work status or prior treatment",
   "Does not give the client's contact information; all contact goes through the firm",
   "Gets Nina's full name, title, direct line and confirms she's the new adjuster (and who replaced whom)",
   "Routes the IME request to the attorney",
   "Documents the call"
  ],
  "hidden": "You're fishing for damaging facts (return to work, prior treatment, social media). You'll also ask for John's cell number 'to schedule an IME directly'. HOW YOU BEHAVE: Friendly and chatty — a charm offensive.",
  "opening": "Hi there, Nina Ross from Aggressive Casualty. I'm new on the Doe file — just need to confirm a few things. Is Mr. Doe back at work full-time now? And he was treating with a chiropractor before this accident too, right?",
  "note": {
   "title": "Call log (CMS note)",
   "template": "DATE / TIME:\nSPOKE WITH (name / title / direct line):\nCARRIER / CLAIM #:\nPURPOSE:\nINFORMATION OBTAINED:\nREQUESTS MADE / DOCUMENTS TO SEND:\nCARRIER'S POSITION / COMMITMENTS:\nCONFIRMATION LETTER SENT? (Y/N, date):\nFOLLOW-UP DATE:"
  },
  "rubric": [
   "Preparation & Identifiers: Has the claim #, insured, DOL, policy and client identifiers ready; confirms the adjuster's name, title and direct line.",
   "Assertiveness & Composure: Professional and firm; pushes for specific answers and dates; doesn't get rattled by stalls or pressure.",
   "Protecting the Client: No recorded statements, no blanket medical authorizations, no admissions or speculation; nothing that hurts liability or damages.",
   "Follow-Through: Gets commitments with dates, confirms everything in writing, and the call log is complete and accurate."
  ],
  "tips": [
   "Get the adjuster's full name and direct line first.",
   "Ask for specifics: amount, date, document.",
   "'I'll confirm our conversation in writing today.'",
   "Recorded statements and blanket authorizations: not without the attorney."
  ],
  "caseFile": true
 },
 {
  "id": "cm_pr_records",
  "program": "CM",
  "line": "Providers & Records",
  "lineIcon": "🏥",
  "dir": "out",
  "name": "Grace Liu",
  "role": "Records department, Metro Radiology",
  "title": "Records Request With a DOB Mismatch",
  "level": "Beginner",
  "gender": "f",
  "you": "You are the Case Manager dealing with medical providers and records departments at LSH Law Group. You are placing this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "You need John Doe's MRI report and the itemized bill from Metro Radiology (DOS 03/15/2026). The MRI report on file shows DOB 02/14/1980 — wrong; John's DOB is 08/14/1980. The HIPAA authorization was signed last week.",
  "goals": [
   "Gives correct identifiers and spots the DOB mismatch",
   "Asks for both the report and the itemized bill (CPT codes) for DOS 03/15/2026",
   "Resolves the demographics correction (form/ID) instead of arguing",
   "Gets fees, turnaround and the rush option; decides based on the mediation timeline",
   "Documents a follow-up task with dates"
  ],
  "hidden": "Your system has John Doe with DOB 02/14/1980 (a registration error). You can't release anything unless the DOB matches the authorization — which says 08/14/1980. You need a corrected-demographics form from the patient or a copy of his ID. Fee: $25 for records, itemized bill free. Turnaround 10 business days; 3 days for rush ($15). HOW YOU BEHAVE: Helpful but strict on HIPAA.",
  "opening": "Metro Radiology, medical records, this is Grace.",
  "note": {
   "title": "Call log + follow-up task",
   "template": "DATE / TIME:\nPROVIDER / DEPARTMENT:\nSPOKE WITH (name / direct line / email / fax):\nPATIENT IDENTIFIERS USED (name / DOB / DOS):\nREQUEST:\nPROVIDER'S RESPONSE / COMMITMENT (date):\nFEES / FORMS REQUIRED:\nFOLLOW-UP TASK (owner / date):"
  },
  "rubric": [
   "Identifiers & HIPAA: Uses the correct patient identifiers (name, DOB, dates of service); has a signed HIPAA/authorization on file; doesn't over-share case details.",
   "Precise Request: Asks for exactly what's needed (complete records vs. itemized billing with CPT codes, date range, format, delivery method).",
   "Negotiation & Escalation: Professional persistence; escalates to a supervisor with a reason and a deadline; negotiates reductions with justification.",
   "Follow-Through: Gets a commitment date, confirms fees and forms, and documents a follow-up task."
  ],
  "tips": [
   "Have the DOB and dates of service ready.",
   "Records ≠ bills: ask for both, itemized with CPT codes.",
   "Ask for the name of the person and a date.",
   "Escalate politely: 'Who can help me meet this deadline?'"
  ],
  "caseFile": true
 },
 {
  "id": "cm_pr_lop",
  "program": "CM",
  "line": "Providers & Records",
  "lineIcon": "🏥",
  "dir": "in",
  "name": "Pam Whitfield",
  "role": "Office manager, Dr. Al Lign's chiropractic office (LOP provider)",
  "title": "LOP Provider Threatens to Stop Care",
  "level": "Intermediate",
  "gender": "f",
  "you": "You are the Case Manager dealing with medical providers and records departments at LSH Law Group. You are answering this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "Dr. Al Lign (chiropractor) treats John under an LOP. His office manager calls your direct line.",
  "goals": [
   "Doesn't disclose settlement value/timing or case details beyond what the LOP allows",
   "Asks for the itemized ledger to reconcile $8,400 vs the $320 statement",
   "Confirms the LOP and the firm's commitment in writing",
   "Protects continuity of care (flags any treatment interruption to the attorney)",
   "Documents the call and the reconciliation task"
  ],
  "hidden": "The actual chiro billing statement in your file is $320 — the $8,400 figure came from the demand draft and may be a projection. Pam's number (555) 519-2211. She'll consider continuing care if the firm confirms the LOP in writing and gives a status update. Will ask 'what's the case worth?'. HOW YOU BEHAVE: Businesslike, a little impatient.",
  "opening": "Hi, this is Pam from Dr. Lign's office. John Doe has a balance of eight thousand four hundred with us and we're thinking of stopping his care until something's paid. When's the case settling?",
  "note": {
   "title": "Call log + follow-up task",
   "template": "DATE / TIME:\nPROVIDER / DEPARTMENT:\nSPOKE WITH (name / direct line / email / fax):\nPATIENT IDENTIFIERS USED (name / DOB / DOS):\nREQUEST:\nPROVIDER'S RESPONSE / COMMITMENT (date):\nFEES / FORMS REQUIRED:\nFOLLOW-UP TASK (owner / date):"
  },
  "rubric": [
   "Identifiers & HIPAA: Uses the correct patient identifiers (name, DOB, dates of service); has a signed HIPAA/authorization on file; doesn't over-share case details.",
   "Precise Request: Asks for exactly what's needed (complete records vs. itemized billing with CPT codes, date range, format, delivery method).",
   "Negotiation & Escalation: Professional persistence; escalates to a supervisor with a reason and a deadline; negotiates reductions with justification.",
   "Follow-Through: Gets a commitment date, confirms fees and forms, and documents a follow-up task."
  ],
  "tips": [
   "Have the DOB and dates of service ready.",
   "Records ≠ bills: ask for both, itemized with CPT codes.",
   "Ask for the name of the person and a date.",
   "Escalate politely: 'Who can help me meet this deadline?'"
  ],
  "caseFile": true
 },
 {
  "id": "cm_pr_lien",
  "program": "CM",
  "line": "Providers & Records",
  "lineIcon": "🏥",
  "dir": "out",
  "name": "Brenda Sterling",
  "role": "Revenue Recovery Director, Metro General Hospital",
  "title": "Hospital Lien Negotiation",
  "level": "Advanced",
  "gender": "f",
  "you": "You are the Case Manager dealing with medical providers and records departments at LSH Law Group. You are placing this call. The matter is John Doe v. Apex Delivery Services (open the case summary in your brief).",
  "facts": "Negotiate Metro General's $45,000 hospital lien. Their own ER billing statement shows $12,700, and PIP paid $4,800 (ER) + $3,000 (CT). BCBS may also have paid. The attorney authorized you to propose a reduction and get the itemization first.",
  "goals": [
   "Requests a full itemization (CPT codes, payments, adjustments) before discussing numbers",
   "Raises the $45,000 vs $12,700 discrepancy and the PIP payments ($7,800) clearly",
   "Doesn't accept 'statutory' as the end of the conversation — asks for the basis and the payment ledger",
   "Gets a commitment and a date for the itemization/reduction response",
   "Documents the positions and the next step"
  ],
  "hidden": "The $45,000 includes 'anticipated future charges' and full chargemaster rates. You'll resist: 'The lien is statutory and it's first priority'. You'll agree to send an itemized statement and consider a reduction if shown the PIP payments and the double-billing issue. Direct line (555) 600-4410, email bsterling@metrogeneral.org. HOW YOU BEHAVE: Firm, experienced, not easily moved — but responds to documentation.",
  "opening": "Brenda Sterling, Revenue Recovery.",
  "note": {
   "title": "Call log + follow-up task",
   "template": "DATE / TIME:\nPROVIDER / DEPARTMENT:\nSPOKE WITH (name / direct line / email / fax):\nPATIENT IDENTIFIERS USED (name / DOB / DOS):\nREQUEST:\nPROVIDER'S RESPONSE / COMMITMENT (date):\nFEES / FORMS REQUIRED:\nFOLLOW-UP TASK (owner / date):"
  },
  "rubric": [
   "Identifiers & HIPAA: Uses the correct patient identifiers (name, DOB, dates of service); has a signed HIPAA/authorization on file; doesn't over-share case details.",
   "Precise Request: Asks for exactly what's needed (complete records vs. itemized billing with CPT codes, date range, format, delivery method).",
   "Negotiation & Escalation: Professional persistence; escalates to a supervisor with a reason and a deadline; negotiates reductions with justification.",
   "Follow-Through: Gets a commitment date, confirms fees and forms, and documents a follow-up task."
  ],
  "tips": [
   "Have the DOB and dates of service ready.",
   "Records ≠ bills: ask for both, itemized with CPT codes.",
   "Ask for the name of the person and a date.",
   "Escalate politely: 'Who can help me meet this deadline?'"
  ],
  "caseFile": true
 }
];
    // The card on the caller list shows the situation (the brief), not the role line every call in a line shares.
    CALLS.forEach(c => { c.blurb = c.facts.length > 190 ? c.facts.slice(0, 187).replace(/\s+\S*$/, '') + '…' : c.facts; });
    CALLS.forEach(c => { if (c.caseFile) c.hidden += '\n\nCASE FILE — background you know only as far as your role would:\n' + CM_CASE; });
    window.CM_CASE_SUMMARY = CM_CASE;
    window.EXTRA_CALLERS = (window.EXTRA_CALLERS || []).concat(CALLS);
})();

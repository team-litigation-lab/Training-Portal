/* LSH Training Portal — Call Simulator pack: Property Damage (the PD Claims course).
   16 calls on Angela Carter's property damage claim across five lines (Claim Setup,
   Coverage & Liability, Rental/Tow & Shop, Negotiation & Total Loss, Settlement & Close):
   opening the claims, spotting coverage, setting up rentals, the tow yard and the shop,
   negotiating the total loss, the payoff and the release. Each call ends with the note it
   requires (note.template), graded with the call on the line's rubric.
   The case summary is the PD course's Claim File (pd-training/build/pd_casefile.js in
   EA-PA-TRAINING) — keep them in step.
   Loaded by /simulators/call.html before its caller library; adds to window.EXTRA_CALLERS. */
(function () {
    // The Angela Carter claim summary the AI caller draws on (same facts as the PD course's Claim File).
    const PD_CASE = "## Claim Snapshot\n- Client: Angela Carter · DOB 03/22/1987 · 1820 Birchwood Dr, Riverview Park, ST 90214 · (555) 214-7730 · angela.carter@email.com · prefers texts before 5 PM (dental hygienist at Bright Smile Dental)\n- LSH PD File # PD-AC-2026-014 (property damage) · the bodily injury file MVA-AC-2026-014 is handled by BI Case Manager Rachel Owens · Handling Attorney: Michael Grant, Esq.\n- Date of loss: Friday, 09/18/2026 · 5:40 PM · Harbor Blvd & 9th St, Riverview Park, ST · clear and dry\n- Retainer: signed Monday 09/21/2026 · covers the bodily injury AND the property damage claims · all carrier contact goes through the firm\n- Training state (ST) rules used in this course: total loss when repairs reach 75% of the vehicle's actual cash value (ACV) · a third-party total-loss settlement includes sales tax (8.25%) and title, registration and plate-transfer fees ($356.00)\n\n## Facts of Loss — Police Report RPPD-26-091844 (Officer J. Morales #2217)\n- Angela (Unit 2, 2022 Toyota RAV4) was stopped at a red light southbound on Harbor Blvd at 9th St.\n- Kevin Hale (Unit 1, 2015 Ford Explorer, registered owner Linda Hale — his mother) struck the rear of the RAV4. Kevin told the officer he “looked down at the GPS.”\n- Kevin Hale cited: Following Too Closely.\n- Independent witness: Tom Nguyen, pedestrian at the corner, (555) 390-1142 — Angela had been stopped at the red light “for several seconds.”\n- The RAV4 was not drivable (rear crushed, liftgate jammed). Police rotation tow: A-1 Metro Towing & Storage.\n\n## Angela's Vehicle\n- 2022 Toyota RAV4 XLE Premium AWD · Weather Package · color Blueprint (blue) · plate 8KTR512 (ST)\n- VIN TRNG4RAV4XLE22014 (registration, title and Harbor Point dec page) · the A-1 tow invoice shows TRNG4RAV4XLE22041 — transposed, must be corrected\n- Odometer at loss: 28,412 miles (Angela's odometer photo 09/21)\n- Owner: Angela Carter · Lienholder: Riverbank Auto Finance, loan # RAF-5530981 · 10-day payoff $19,850.42 good through 10/15/2026, then $3.10 per day · no GAP coverage\n- Personal property in the vehicle: a rear-facing convertible child car seat bought 02/2026 for $289.99 (receipt on file) — the manufacturer says replace it after a moderate or severe crash\n\n## At-Fault Coverage — Crestline Mutual Insurance\n- Policy CMI-PA-7730215 · Named insured: Linda Hale · Listed drivers: Linda Hale, Kevin Hale · Vehicle: 2015 Ford Explorer (listed)\n- The dec page Angela got at the scene shows the term 03/01/2026–09/01/2026 — it ENDED before the date of loss. Crestline confirmed by phone (09/21) that the policy renewed 09/01/2026–03/01/2027 with the same limits.\n- Limits: Bodily Injury $25,000 / $50,000 · Property Damage $50,000 · (Crestline's MedPay covers its own car's occupants — not Angela)\n- Claim # CMI-26-0918-4471 · PD adjuster Derek Lawson, (555) 640-2280 ext 418, dlawson@crestlinemutual.example · Total-loss adjuster Priya Shah, ext 431\n- Liability: “under investigation” on 09/21 (Kevin now claims Angela “stopped short on a yellow”) → ACCEPTED 100% on 09/24 after the police report and the witness statement\n\n## Angela's Own Coverage — Harbor Point Insurance\n- Policy HPI-AU-4418-2207 · Named insured: Angela Carter · Term 06/15/2026–12/15/2026 · Agent: Paul Brennan, Brennan Insurance Agency, (555) 233-9001\n- Bodily Injury $100,000 / $300,000 · Property Damage $100,000 · Uninsured/Underinsured Motorist BI $50,000 / $100,000 · Medical Payments $5,000\n- Uninsured Motorist Property Damage $3,500 ($250 deductible) — only when the at-fault driver is uninsured or unidentified\n- Collision: ACV, $500 deductible (no deductible waiver) · Comprehensive: ACV, $250 deductible\n- Rental Reimbursement: $40 per day, $1,200 maximum · Towing & Labor: $100 per disablement · Loan/Lease Payoff (GAP): not purchased · Loss payee: Riverbank Auto Finance\n- First-party claim # HPI-26-55012 (opened 09/21 to use the rental coverage while Crestline investigated liability) · adjuster Nicole Ferris, (555) 700-5120\n\n## Claim Timeline\n- Fri 09/18 — Crash at 5:40 PM. The RAV4 is towed to A-1 Metro Towing & Storage (tow $325; storage $65 per day starting 09/18).\n- Sat 09/19 — Angela goes to urgent care for neck and back pain (BI file — MedPay and treatment go to Rachel Owens).\n- Mon 09/21 — Retainer signed; PD file opened; Crestline claim opened (liability under investigation); Harbor Point claim opened for rental; Angela rents a midsize SUV from Metro Car Rental on Harbor Point's $40/day direct bill.\n- Wed 09/23 — RAV4 moved from A-1 to Riverside Collision Center (Angela's choice of shop). Storage stops: 6 days (09/18–09/23) × $65 = $390 + tow $325 = $715.\n- Thu 09/24 — Crestline accepts liability 100%. Field appraiser writes $9,480.35 (repairable). Crestline takes over the rental on direct bill at $45/day (compact SUV, like kind); Angela upgrades to a standard SUV at $58/day and pays the $13/day difference.\n- Tue 09/29 — Teardown at Riverside finds a buckled left rear frame rail and rear floor pan: supplement $15,379.65 → repairs $24,860.00.\n- Thu 10/01 — Crestline declares the RAV4 a total loss (repairs are 75%+ of ACV).\n- Fri 10/02 — Crestline valuation report VR-26-18840: ACV $25,147.00.\n- Mon 10/05 — Crestline's written total-loss offer: $27,221.63 (ACV + 8.25% tax, no fees). Crestline's rule: rental ends 3 days after the offer (10/08).\n- Negotiation — LSH's counter (Day 4): ACV $31,181.67 from true comparables → $34,110.16 with tax and fees.\n- Agreed 10/09 — ACV $30,650.00 + tax $2,528.63 + fees $356.00 = $33,534.63. Payment issued 10/20 (payoff by then: $19,865.92).\n\n## Crestline's Valuation Report VR-26-18840 — What's Wrong With It\n- Vehicle listed as RAV4 XLE AWD — the car is an XLE Premium AWD with the Weather Package (options missing).\n- Mileage listed as 34,812 — the odometer read 28,412.\n- None of the three comparables is comparable: #1 is a lower-trim XLE with 41,300 miles, #2 an LE FWD (lower trim, different drivetrain), #3 a 2021 with 52,000 miles, 160 miles away.\n- Condition deduction −$620 (“interior below average”) — no inspection note or photo supports it.\n- Prior-damage deduction −$750 (“rear bumper scuffs”) — that is the damage from THIS crash.\n- Title, registration and plate-transfer fees ($356.00) left out.\n\n## Money on the PD File\n- Crestline's offer 10/05: $27,221.63 · LSH counter: $34,110.16 · Agreed 10/09: $33,534.63\n- Tow + storage: $715.00 (paid by Crestline directly to A-1) · Rental: 15 days × $45 = $675.00 on Crestline's direct bill (09/24–10/08); Angela's upgrade share 15 × $13 = $195.00\n- Harbor Point paid 3 rental days (09/21–09/23) × $40 = $120.00 → recovers it from Crestline by subrogation\n- Child car seat: $289.99 · Diminished value: not applicable (total loss) · Loss of use: not claimed (rental provided)\n- Payment (10/20): Riverbank Auto Finance payoff $19,865.92 · to Angela: vehicle equity $13,668.71 + car seat $289.99 = $13,958.70\n\n## Key Contacts\n- Handling Attorney: Michael Grant, Esq. (settlement authority, releases, anything over the policy limits) · BI Case Manager: Rachel Owens\n- Crestline Mutual: Derek Lawson (PD adjuster, ext 418) · Priya Shah (total loss, ext 431) · Crestline claims line (555) 640-2280\n- Harbor Point: Nicole Ferris (first-party adjuster) (555) 700-5120 · Harbor Point subrogation unit\n- A-1 Metro Towing & Storage, 4410 Industrial Way, (555) 318-6620 · Riverside Collision Center, estimator Dana Whitfield, (555) 455-0192\n- Metro Car Rental, Harbor Blvd branch, (555) 248-3100 · Riverbank Auto Finance, payoff department, (555) 800-4412\n\n## ⚠ What a PD Specialist Must Catch on This File\n- The VIN on the tow invoice is transposed (…22041 vs …22014).\n- The at-fault dec page from the scene is an expired term — coverage on the date of loss had to be confirmed.\n- Kevin Hale is not the named insured — he is a listed driver on his mother's policy, which is primary for the car he was driving.\n- Crestline's BI limits are only $25,000 / $50,000 — Angela's UM/UIM BI ($50,000 / $100,000) and MedPay ($5,000) go to the BI Case Manager right away.\n- Storage at A-1 costs $65 a day — move the car the first business day.\n- Crestline's valuation used the wrong trim, the wrong mileage, non-comparable comps and two unsupported deductions, and left out fees.\n- Crestline's release is titled “Release of All Claims” and includes bodily injury — it must be a property-damage-only release.\n- The payoff letter expires 10/15; payment on 10/20 needs an updated payoff.";
    const CALLS = [
 {
  "id": "pd_cs_openclaim",
  "program": "PD",
  "line": "Claim Setup",
  "lineIcon": "📋",
  "dir": "out",
  "name": "Derek Lawson",
  "role": "Property Damage Adjuster, Crestline Mutual Insurance",
  "title": "Open the Third-Party PD Claim",
  "level": "Beginner",
  "gender": "m",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are placing this call.",
  "facts": "Monday 09/21/2026, 10:15 AM. Retainer signed this morning. Crestline Mutual insures Linda Hale (owner of the 2015 Ford Explorer); her son Kevin Hale was driving. The only Crestline dec page in the file (from the scene) shows policy CMI-PA-7730215, term 03/01/2026–09/01/2026 — it ended before the 09/18 crash. Police report RPPD-26-091844: Kevin cited for Following Too Closely; witness Tom Nguyen. Angela's RAV4 (VIN TRNG4RAV4XLE22014) is at A-1 Metro Towing at $65/day. Crestline has called Angela twice for a recorded statement.",
  "goals": [
   "Identifies the firm, that it represents Angela for BI and PD, and that all contact goes through the firm",
   "Gives the loss facts (insured Linda Hale, driver Kevin Hale, 09/18/2026 5:40 PM, Harbor Blvd & 9th St, police report RPPD-26-091844) and the correct VIN …22014",
   "Gets and reads back the claim number CMI-26-0918-4471 and Derek's direct line (ext 418) and email",
   "Asks whether the policy was in force ON 09/18 (renewed 09/01/2026–03/01/2027) and whether Kevin is covered (listed driver)",
   "Declines the recorded statement (routes it to the attorney) and offers the police report, citation and witness instead",
   "Asks about liability timing (decision date), rental and inspection, and says the car is moving out of storage"
  ],
  "hidden": "You are Derek Lawson, PD adjuster at Crestline Mutual, (555) 640-2280 ext 418, dlawson@crestlinemutual.example. The claim number is CMI-26-0918-4471 (only give it when asked). Your system shows the policy RENEWED 09/01/2026–03/01/2027, same coverages; Kevin Hale is a listed driver — confirm only if asked specifically about the date of loss and the driver. Liability is 'under investigation': Kevin now says Angela 'stopped short on a yellow'. You haven't seen the police report yet. You want a recorded statement from Angela and her cell number, and you'll say you can't authorize a rental until liability is decided. You'll decide within 3 business days of receiving the police report and any witness info. If the trainee gives the police report number, the citation and the witness, you soften and promise a decision by Thursday 09/24. You don't disclose limits by phone without a written request. HOW YOU BEHAVE: Friendly, quick, a bit pushy about the statement. Back off professionally if the trainee firmly routes it to the attorney.",
  "opening": "Crestline Mutual, Derek Lawson speaking.",
  "note": {
   "title": "Claim note",
   "template": "DATE / TIME:\nCARRIER / CLAIM #:\nSPOKE WITH (name / direct line / email):\nCOVERAGE ON THE DATE OF LOSS:\nLIABILITY STATUS / DECISION DATE:\nRENTAL:\nVEHICLE LOCATION / INSPECTION:\nREQUESTS MADE / DOCUMENTS SENT:\nNEXT STEP (owner / date):"
  },
  "rubric": [
   "Identification & Representation: Identifies the firm and that it represents the claimant; gives the loss facts clearly (insured, date, place, police report); keeps all contact through the firm.",
   "Claim Details Captured: Gets and reads back the claim number, the adjuster's name, direct line and email; the facts match the documents (correct VIN).",
   "Coverage & Liability Questions: Asks whether the policy was in force on the date of loss, whether the vehicle and driver are covered, the liability status and what the carrier still needs — and gets a decision date.",
   "Next Steps & Protection of the Client: Declines recorded statements / direct contact, arranges rental, inspection and the vehicle move, and confirms everything in writing with a follow-up date."
  ],
  "tips": [
   "Have the police report, the registration VIN and the client's details in front of you.",
   "Read the claim number back digit by digit.",
   "Anchor coverage to the DATE OF LOSS.",
   "Recorded statements go to the attorney — never the client on the phone.",
   "End with the next step and a date."
  ],
  "caseFile": true
 },
 {
  "id": "pd_cs_firstparty",
  "program": "PD",
  "line": "Claim Setup",
  "lineIcon": "📋",
  "dir": "out",
  "name": "Nicole Ferris",
  "role": "First-Party Claims Adjuster, Harbor Point Insurance",
  "title": "Open the First-Party Rental Claim",
  "level": "Intermediate",
  "gender": "f",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are placing this call.",
  "facts": "Monday 09/21/2026, 11:30 AM. Crestline has NOT decided liability and won't authorize a rental. Angela's own policy with Harbor Point (HPI-AU-4418-2207) has collision ($500 deductible), rental reimbursement $40/day up to $1,200, towing & labor $100. Angela needs a car today. The plan: open a first-party claim so she can use her rental coverage now; Crestline takes over once it accepts liability.",
  "goals": [
   "Identifies the firm and that it represents Angela (the named insured)",
   "Explains the loss and that the at-fault carrier (Crestline, claim CMI-26-0918-4471) hasn't decided liability",
   "Opens the claim and gets the claim number HPI-26-55012 and Nicole's contact",
   "Confirms the rental coverage terms ($40/day, $1,200 max) and sets up direct billing with Metro Car Rental",
   "Clarifies that Angela isn't asking for a collision payout yet (no deductible now) and that Harbor Point can subrogate its rental days from Crestline",
   "Confirms the next step and asks for the rental authorization in writing"
  ],
  "hidden": "You are Nicole Ferris, first-party adjuster at Harbor Point Insurance, (555) 700-5120. You will open claim HPI-26-55012 when asked (give the number when asked). Rental reimbursement only applies with a covered collision or comprehensive loss, so you'll open it as a collision claim. You'll ask: 'Do you want us to handle the vehicle damage too? She'd pay the $500 deductible.' — a strong trainee says not yet, the third-party claim should pay the car, collision stays as the backup. You can direct-bill Metro Car Rental at $40/day, midsize SUV, starting today. You'll mention that Harbor Point will subrogate against Crestline once liability is accepted. If the trainee asks, Angela's policy also extends to rental cars, so she doesn't need the counter's damage waiver. HOW YOU BEHAVE: Helpful and procedural; you need the date of loss, the location and the other carrier's claim number.",
  "opening": "Harbor Point Insurance claims, this is Nicole. How can I help?",
  "note": {
   "title": "Claim note",
   "template": "DATE / TIME:\nCARRIER / CLAIM #:\nSPOKE WITH (name / direct line / email):\nCOVERAGE ON THE DATE OF LOSS:\nLIABILITY STATUS / DECISION DATE:\nRENTAL:\nVEHICLE LOCATION / INSPECTION:\nREQUESTS MADE / DOCUMENTS SENT:\nNEXT STEP (owner / date):"
  },
  "rubric": [
   "Identification & Representation: Identifies the firm and that it represents the claimant; gives the loss facts clearly (insured, date, place, police report); keeps all contact through the firm.",
   "Claim Details Captured: Gets and reads back the claim number, the adjuster's name, direct line and email; the facts match the documents (correct VIN).",
   "Coverage & Liability Questions: Asks whether the policy was in force on the date of loss, whether the vehicle and driver are covered, the liability status and what the carrier still needs — and gets a decision date.",
   "Next Steps & Protection of the Client: Declines recorded statements / direct contact, arranges rental, inspection and the vehicle move, and confirms everything in writing with a follow-up date."
  ],
  "tips": [
   "Have the police report, the registration VIN and the client's details in front of you.",
   "Read the claim number back digit by digit.",
   "Anchor coverage to the DATE OF LOSS.",
   "Recorded statements go to the attorney — never the client on the phone.",
   "End with the next step and a date."
  ],
  "caseFile": true
 },
 {
  "id": "pd_cs_intake",
  "program": "PD",
  "line": "Claim Setup",
  "lineIcon": "📋",
  "dir": "in",
  "name": "Angela Carter",
  "role": "Client (PD claim)",
  "title": "Angela's PD Intake Call",
  "level": "Beginner",
  "gender": "f",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are answering this call.",
  "facts": "Monday 09/21/2026, 12:10 PM. Angela calls you back after signing the retainer. The intake sheet has the VIN from the tow invoice (…22041 — wrong), trim 'not sure', mileage 'about 28,000', no loan details, no odometer photo. Her car is at A-1 Metro Towing ($65/day). Crestline has called her twice. She mentioned neck pain to intake.",
  "goals": [
   "Verifies Angela (DOB 03/22/1987) and confirms the best way to reach her (text before 5 PM)",
   "Asks for the registration VIN, trim/packages, an odometer photo and interior photos, and the window sticker if she has it",
   "Gets the lender and loan number and explains why the payoff letter matters",
   "Gets her authorization to move the car from A-1 to her chosen shop (Riverside Collision) and reminds her about the car seat and personal items",
   "Tells her not to talk to Crestline or give a recorded statement — send calls to the firm",
   "Routes her injury questions to the BI Case Manager (Rachel Owens) without giving medical or legal advice",
   "Explains today's plan (rental under her own coverage this afternoon) and when she'll hear next"
  ],
  "hidden": "You are Angela Carter, DOB 03/22/1987, (555) 214-7730. You're stressed: no car, two kids (the 18-month-old's car seat is still in the RAV4), work tomorrow. Your registration (in your glovebox photo) says VIN TRNG4RAV4XLE22014 — read it if asked. You think it's the 'XLE Premium with the heated steering wheel'. You can take an odometer photo at A-1 this afternoon (it's about 28,400). Your loan is with Riverbank Auto Finance, loan RAF-5530981, you don't know the balance. You want the car to go to Riverside Collision Center (your brother-in-law used them). Crestline called you twice — you ask: 'Should I just call them back?'. You ask: 'How much will I get if they total it?' and 'My neck still hurts, should I see a chiropractor?'. HOW YOU BEHAVE: Anxious but cooperative; you calm down when given a clear plan with times.",
  "opening": "Hi, it's Angela Carter — the intake lady said you're handling my car? I really need to know what's happening, I don't have a car and the tow place keeps calling me.",
  "note": {
   "title": "Client call note",
   "template": "DATE / TIME:\nCALLER (verified how):\nCLIENT'S CONCERN:\nWHAT WAS EXPLAINED:\nWHAT THE CLIENT WILL DO / SEND:\nESCALATED / ROUTED TO (BI team / attorney):\nNEXT UPDATE (date / channel):"
  },
  "rubric": [
   "Identification & Representation: Identifies the firm and that it represents the claimant; gives the loss facts clearly (insured, date, place, police report); keeps all contact through the firm.",
   "Claim Details Captured: Gets and reads back the claim number, the adjuster's name, direct line and email; the facts match the documents (correct VIN).",
   "Coverage & Liability Questions: Asks whether the policy was in force on the date of loss, whether the vehicle and driver are covered, the liability status and what the carrier still needs — and gets a decision date.",
   "Next Steps & Protection of the Client: Declines recorded statements / direct contact, arranges rental, inspection and the vehicle move, and confirms everything in writing with a follow-up date."
  ],
  "tips": [
   "Have the police report, the registration VIN and the client's details in front of you.",
   "Read the claim number back digit by digit.",
   "Anchor coverage to the DATE OF LOSS.",
   "Recorded statements go to the attorney — never the client on the phone.",
   "End with the next step and a date."
  ],
  "caseFile": true
 },
 {
  "id": "pd_cov_verify",
  "program": "PD",
  "line": "Coverage & Liability",
  "lineIcon": "🛡",
  "dir": "out",
  "name": "Marcus Webb",
  "role": "Policy Services Representative, Crestline Mutual",
  "title": "Verify the At-Fault Policy",
  "level": "Intermediate",
  "gender": "m",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are placing this call.",
  "facts": "Monday 09/21/2026, 2:00 PM. The only Crestline dec page you have (from the scene) shows policy CMI-PA-7730215, named insured Linda Hale, term 03/01/2026–09/01/2026, BI $25,000/$50,000, PD $50,000, listed drivers Linda and Kevin Hale, vehicle 2015 Ford Explorer. The crash was 09/18/2026. Claim CMI-26-0918-4471 is open with Derek Lawson.",
  "goals": [
   "Asks specifically whether the policy was in force on 09/18/2026 (not just 'is it active')",
   "Confirms the renewed term (09/01/2026–03/01/2027) and that the Explorer is a listed vehicle",
   "Confirms Kevin Hale is a listed driver (not excluded)",
   "Handles the renewal-payment question: asks for the carrier's coverage position in writing and whether there is any reservation of rights",
   "Asks how to get a written limits disclosure (written request / insured's consent)",
   "Documents who confirmed what, and flags the low BI limits for the BI team"
  ],
  "hidden": "You are Marcus Webb, Crestline Mutual policy services, (555) 640-2200. The policy renewed for 09/01/2026–03/01/2027 with the same coverages; the renewal payment posted on 08/28/2026 (on time) — but at first you say 'I see a renewal, the payment posted… let me check' to test whether the trainee asks about the date of loss. Kevin Hale is a listed household driver; no excluded drivers. You can't read limits over the phone without the insured's authorization — you tell them to send a written limits request to the adjuster, Derek Lawson. There is no reservation of rights. If asked for written confirmation, you say Derek will include it in his liability letter. HOW YOU BEHAVE: Neutral, careful, answers only what is asked — a vague question gets a vague answer.",
  "opening": "Crestline Mutual policy services, Marcus speaking.",
  "note": {
   "title": "Coverage note",
   "template": "DATE / TIME:\nSPOKE WITH (company / name / number):\nPOLICY / TERM CONFIRMED FOR THE DATE OF LOSS:\nCOVERAGES & LIMITS CONFIRMED:\nWHAT APPLIES TO THIS LOSS / WHAT DOESN'T:\nFLAGS FOR THE BI TEAM / ATTORNEY:\nIN WRITING? (requested / received):\nNEXT STEP (owner / date):"
  },
  "rubric": [
   "Date-of-Loss Precision: Every coverage question is anchored to the date of loss (not today); policy term, vehicle and driver are confirmed.",
   "Coverage Spotting: Identifies every coverage that can pay (and the ones that don't apply and why) — including coverages for other teams (MedPay, UIM → BI).",
   "Evidence & Persistence: Supplies the evidence that decides liability (police report, citation, witness), asks what else is needed, and gets a decision date without arguing fault beyond the evidence.",
   "Written Confirmation & Escalation: Asks for coverage/liability positions in writing and names what goes to the attorney or BI team."
  ],
  "tips": [
   "Ask “Was it in force on 09/18?” — not “Is there coverage?”",
   "Spot everything: PD, collision, rental, towing, UMPD, MedPay, UIM, GAP.",
   "MedPay and UIM are BI — route them.",
   "Evidence moves liability: citation, witness, photos.",
   "Ask for it in writing."
  ],
  "caseFile": true
 },
 {
  "id": "pd_cov_spot",
  "program": "PD",
  "line": "Coverage & Liability",
  "lineIcon": "🛡",
  "dir": "out",
  "name": "Paul Brennan",
  "role": "Insurance agent, Brennan Insurance Agency (Angela's agent)",
  "title": "Spot the Client's Coverage",
  "level": "Beginner",
  "gender": "m",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are placing this call.",
  "facts": "Monday 09/21/2026, 9:50 AM, before you open any claims. Angela gave you permission to call her agent. You have her Harbor Point dec page (HPI-AU-4418-2207) but want to confirm what it covers for this loss and what she might not know she has.",
  "goals": [
   "Identifies the firm and confirms Angela authorized the call",
   "Confirms the policy was in force on 09/18/2026",
   "Spots the rental reimbursement ($40/day, $1,200 max) and how to use it while liability is pending",
   "Confirms collision ($500 deductible) as the backup if liability is denied, and that UMPD doesn't apply (the at-fault driver is insured)",
   "Spots MedPay ($5,000) and UIM ($50,000/$100,000) and says they go to the BI team",
   "Asks about GAP (not purchased) and whether her policy extends to rental cars (damage waiver)"
  ],
  "hidden": "You are Paul Brennan, Angela's independent agent, (555) 233-9001. Angela's Harbor Point policy HPI-AU-4418-2207 (06/15–12/15/2026): BI 100/300, PD 100k, UM/UIM BI 50/100, UMPD $3,500 ($250 ded), MedPay $5,000, collision $500 (no deductible waiver), comprehensive $250, rental $40/day to $1,200, towing $100, no GAP, loss payee Riverbank. Her policy's liability and collision extend to a rental car, so she doesn't need the counter's damage waiver. Only answer what you're asked; if the trainee asks 'what else does she have?', walk through the list. You'll say 'Most people forget they have rental coverage.' HOW YOU BEHAVE: Friendly, chatty, helpful.",
  "opening": "Brennan Insurance, this is Paul.",
  "note": {
   "title": "Coverage note",
   "template": "DATE / TIME:\nSPOKE WITH (company / name / number):\nPOLICY / TERM CONFIRMED FOR THE DATE OF LOSS:\nCOVERAGES & LIMITS CONFIRMED:\nWHAT APPLIES TO THIS LOSS / WHAT DOESN'T:\nFLAGS FOR THE BI TEAM / ATTORNEY:\nIN WRITING? (requested / received):\nNEXT STEP (owner / date):"
  },
  "rubric": [
   "Date-of-Loss Precision: Every coverage question is anchored to the date of loss (not today); policy term, vehicle and driver are confirmed.",
   "Coverage Spotting: Identifies every coverage that can pay (and the ones that don't apply and why) — including coverages for other teams (MedPay, UIM → BI).",
   "Evidence & Persistence: Supplies the evidence that decides liability (police report, citation, witness), asks what else is needed, and gets a decision date without arguing fault beyond the evidence.",
   "Written Confirmation & Escalation: Asks for coverage/liability positions in writing and names what goes to the attorney or BI team."
  ],
  "tips": [
   "Ask “Was it in force on 09/18?” — not “Is there coverage?”",
   "Spot everything: PD, collision, rental, towing, UMPD, MedPay, UIM, GAP.",
   "MedPay and UIM are BI — route them.",
   "Evidence moves liability: citation, witness, photos.",
   "Ask for it in writing."
  ],
  "caseFile": true
 },
 {
  "id": "pd_cov_liability",
  "program": "PD",
  "line": "Coverage & Liability",
  "lineIcon": "🛡",
  "dir": "out",
  "name": "Derek Lawson",
  "role": "Property Damage Adjuster, Crestline Mutual Insurance",
  "title": "Liability Still Under Investigation",
  "level": "Advanced",
  "gender": "m",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are placing this call.",
  "facts": "Wednesday 09/23/2026, 9:00 AM. Crestline still hasn't decided liability on claim CMI-26-0918-4471. You sent the letter of representation Monday with the police report number. Police report RPPD-26-091844: Kevin Hale cited for Following Too Closely; witness Tom Nguyen (555) 390-1142 says Angela had been stopped at the red 'for several seconds'. Angela is in a Harbor Point rental at $40/day. The car moved to Riverside Collision Center this morning.",
  "goals": [
   "Asks exactly what Crestline still needs to decide liability",
   "Presents the evidence: citation, independent witness, rear-end impact photos — without arguing beyond it",
   "Declines the recorded statement again and offers the evidence in writing",
   "Gets a decision date (Thursday 09/24) and asks for the decision in writing",
   "Tells Derek the car is at Riverside and asks to schedule the inspection there",
   "States the plan if liability is denied or delayed (client's own coverage + escalate to the attorney)"
  ],
  "hidden": "You are Derek Lawson (Crestline). You now have the police report but haven't called the witness. Kevin insists Angela 'stopped short on a yellow'. You push again for Angela's recorded statement. If the trainee points to the citation and gives Tom Nguyen's number and says it's in writing too, you agree to call the witness today and commit to a decision by tomorrow (09/24). You'll also agree to schedule the field appraiser at Riverside for 09/24 at 2 PM if asked. If the trainee just says 'our client wasn't at fault' without evidence, you stay non-committal. HOW YOU BEHAVE: Busy, a little defensive, responds to specifics.",
  "opening": "Derek Lawson. Oh — the Carter file. I know, I know, I'm still working on liability.",
  "note": {
   "title": "Coverage note",
   "template": "DATE / TIME:\nSPOKE WITH (company / name / number):\nPOLICY / TERM CONFIRMED FOR THE DATE OF LOSS:\nCOVERAGES & LIMITS CONFIRMED:\nWHAT APPLIES TO THIS LOSS / WHAT DOESN'T:\nFLAGS FOR THE BI TEAM / ATTORNEY:\nIN WRITING? (requested / received):\nNEXT STEP (owner / date):"
  },
  "rubric": [
   "Date-of-Loss Precision: Every coverage question is anchored to the date of loss (not today); policy term, vehicle and driver are confirmed.",
   "Coverage Spotting: Identifies every coverage that can pay (and the ones that don't apply and why) — including coverages for other teams (MedPay, UIM → BI).",
   "Evidence & Persistence: Supplies the evidence that decides liability (police report, citation, witness), asks what else is needed, and gets a decision date without arguing fault beyond the evidence.",
   "Written Confirmation & Escalation: Asks for coverage/liability positions in writing and names what goes to the attorney or BI team."
  ],
  "tips": [
   "Ask “Was it in force on 09/18?” — not “Is there coverage?”",
   "Spot everything: PD, collision, rental, towing, UMPD, MedPay, UIM, GAP.",
   "MedPay and UIM are BI — route them.",
   "Evidence moves liability: citation, witness, photos.",
   "Ask for it in writing."
  ],
  "caseFile": true
 },
 {
  "id": "pd_rt_rentalauth",
  "program": "PD",
  "line": "Rental, Tow & Shop",
  "lineIcon": "🚙",
  "dir": "out",
  "name": "Derek Lawson",
  "role": "Property Damage Adjuster, Crestline Mutual Insurance",
  "title": "Rental Authorization After Liability",
  "level": "Intermediate",
  "gender": "m",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are placing this call.",
  "facts": "Thursday 09/24/2026, 10:30 AM. Derek emailed: Crestline accepts 100% liability. Angela is in a Harbor Point rental (midsize SUV, $40/day direct bill since 09/21, reservation RA-2026-88412 at Metro Car Rental). A-1's tow ($325) and storage (6 days × $65 = $390) are unpaid. The field appraiser is due at Riverside at 2 PM today.",
  "goals": [
   "Gets the rental authorized from 09/24: $45/day, compact SUV (like kind), direct bill to Metro Car Rental under CMI-26-0918-4471",
   "Asks how the rental end date will be set (repairs complete, or 3 days after a total-loss offer)",
   "Arranges for Harbor Point's 3 days (09/21–09/23, $120) to be handled by subrogation",
   "Asks Crestline to pay A-1's $715 tow and storage directly and gives the invoice number",
   "Confirms the 2 PM inspection at Riverside and asks for a copy of the estimate",
   "Asks for all of it in writing"
  ],
  "hidden": "You are Derek Lawson (Crestline). You'll authorize $45/day for a compact SUV, direct bill, from 09/24. The rule: rental ends when repairs are complete, or 3 days after a total-loss settlement offer — say it only if asked how the end date works. You'll pay 'reasonable' tow and storage directly on the final invoice (A1-26-7719) — you'll ask 'why did it sit six days?' and accept that it moved the first business day after the retainer. You won't pay Harbor Point's 3 days directly to Angela — 'Harbor Point can subrogate'. You mention that Angela asked Metro for a bigger SUV: 'anything over $45 is on her'. HOW YOU BEHAVE: Cooperative now that liability is accepted, brisk.",
  "opening": "Derek Lawson. You saw my email — we're accepting liability on Carter.",
  "note": {
   "title": "Rental / vehicle note",
   "template": "DATE / TIME:\nSPOKE WITH (company / name / number):\nCLAIM # / RESERVATION # / INVOICE #:\nWHAT WAS AUTHORIZED OR AGREED (rate, class, dates, amounts):\nWHAT THE CLIENT PAYS:\nEND DATE / PICKUP / RELEASE TIME:\nCONFIRMATION IN WRITING:\nNEXT STEP (owner / date):"
  },
  "rubric": [
   "Authorization Details: Gets exact terms — claim number, rate, class, start and end dates, direct billing, reservation/invoice numbers.",
   "Client Cost Clarity: Identifies what the client pays (upgrade difference, fuel, damage waiver, days after the end date) and doesn't commit the client's money without her OK.",
   "Cost Control: Moves quickly to stop avoidable costs (storage, rental overage), requests extensions before the end date with a reason, and keeps approvals moving.",
   "Follow-Through: Confirms in writing, sets the next step and date, and tells the client."
  ],
  "tips": [
   "Rate, class, start date, end-date rule, direct bill.",
   "Tell the client her costs before they happen.",
   "Storage runs every day — move the car.",
   "Ask for extensions BEFORE the end date, with a reason.",
   "Get a reservation or invoice number."
  ],
  "caseFile": true
 },
 {
  "id": "pd_rt_counter",
  "program": "PD",
  "line": "Rental, Tow & Shop",
  "lineIcon": "🚙",
  "dir": "in",
  "name": "Tina Morales",
  "role": "Counter agent, Metro Car Rental (Harbor Blvd branch)",
  "title": "The Rental Counter",
  "level": "Beginner",
  "gender": "f",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are answering this call.",
  "facts": "Thursday 09/24/2026, 4:40 PM. Angela is at the Metro Car Rental counter to switch her rental to Crestline's billing. Crestline authorized $45/day, compact SUV, direct bill from 09/24 under claim CMI-26-0918-4471 (Derek Lawson, ext 418). Her existing agreement is RA-2026-88412 (Harbor Point, $40/day). Angela told you this morning she wanted 'something bigger for the kids'.",
  "goals": [
   "Gives the Crestline claim number, the adjuster and the authorized rate/class so the branch can find the authorization",
   "Keeps the switch on the same agreement (RA-2026-88412) and confirms billing to Crestline from 09/24",
   "Explains the upgrade: a standard SUV at $58/day means Angela pays $13/day — and gets Angela's OK before agreeing",
   "Declines the damage waiver on the carrier's behalf only after confirming Angela's own policy covers rentals (it does) — it's Angela's choice",
   "Confirms fuel is Angela's and the end-date rule; gets the reservation/agreement number in writing"
  ],
  "hidden": "You are Tina Morales at Metro Car Rental, Harbor Blvd, (555) 248-3100. At first you can't see an authorization ('your insurance didn't authorize anything'). You find it if the trainee gives claim number CMI-26-0918-4471 or the adjuster's name. The only compact SUV is dirty and not ready until tomorrow; a standard SUV is $58/day. You'll offer the damage waiver at $18/day and ask 'does she want it?'. Angela is standing at the counter (you can say 'she says she wants the bigger one'). HOW YOU BEHAVE: Busy, a line behind the customer, helpful once you have what you need.",
  "opening": "Metro Car Rental, Harbor Boulevard, this is Tina. I've got Ms. Carter at the counter but I don't see any insurance authorization on our end.",
  "note": {
   "title": "Rental / vehicle note",
   "template": "DATE / TIME:\nSPOKE WITH (company / name / number):\nCLAIM # / RESERVATION # / INVOICE #:\nWHAT WAS AUTHORIZED OR AGREED (rate, class, dates, amounts):\nWHAT THE CLIENT PAYS:\nEND DATE / PICKUP / RELEASE TIME:\nCONFIRMATION IN WRITING:\nNEXT STEP (owner / date):"
  },
  "rubric": [
   "Authorization Details: Gets exact terms — claim number, rate, class, start and end dates, direct billing, reservation/invoice numbers.",
   "Client Cost Clarity: Identifies what the client pays (upgrade difference, fuel, damage waiver, days after the end date) and doesn't commit the client's money without her OK.",
   "Cost Control: Moves quickly to stop avoidable costs (storage, rental overage), requests extensions before the end date with a reason, and keeps approvals moving.",
   "Follow-Through: Confirms in writing, sets the next step and date, and tells the client."
  ],
  "tips": [
   "Rate, class, start date, end-date rule, direct bill.",
   "Tell the client her costs before they happen.",
   "Storage runs every day — move the car.",
   "Ask for extensions BEFORE the end date, with a reason.",
   "Get a reservation or invoice number."
  ],
  "caseFile": true
 },
 {
  "id": "pd_rt_towyard",
  "program": "PD",
  "line": "Rental, Tow & Shop",
  "lineIcon": "🚙",
  "dir": "out",
  "name": "Sal Romano",
  "role": "Yard manager, A-1 Metro Towing & Storage",
  "title": "The Tow-Yard Release",
  "level": "Intermediate",
  "gender": "m",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are placing this call.",
  "facts": "Tuesday 09/22/2026, 9:15 AM. Angela's RAV4 has been at A-1 since 09/18 at $65/day (tow $325). Liability is still pending with Crestline. Angela signed an authorization to release the car to Riverside Collision Center, which can pick it up tomorrow morning. The A-1 invoice lists the VIN as TRNG4RAV4XLE22041 — the registration says …22014.",
  "goals": [
   "Gets the release requirements (owner authorization, ID, who pays, hours)",
   "Arranges the release to Riverside for 09/23 and confirms the charges through that day (tow $325 + 6 days × $65 = $715)",
   "Arranges payment without Angela fronting it: Crestline to pay on the final invoice once liability is decided, or Riverside pays and adds it to the repair bill",
   "Gets the VIN corrected on the invoice (…22014)",
   "Asks for the final invoice (A1-26-7719) to reference Crestline claim CMI-26-0918-4471 and confirms by email"
  ],
  "hidden": "You are Sal Romano, A-1 Metro Towing & Storage, (555) 318-6620. Rules: release only to the owner or a licensed repair shop with the owner's signed authorization; the bill (tow + storage to the release day) must be paid or guaranteed. You'd prefer cash today. You'll accept: Riverside pays on pickup and bills it on the repair, OR an insurer's written guarantee. You didn't notice the VIN error; you'll fix it if asked. Storage counts calendar days including the day in. If the trainee is vague about payment, you say 'then it stays here and the meter keeps running'. HOW YOU BEHAVE: Gruff, practical, fair.",
  "opening": "A-1 Towing, Sal.",
  "note": {
   "title": "Rental / vehicle note",
   "template": "DATE / TIME:\nSPOKE WITH (company / name / number):\nCLAIM # / RESERVATION # / INVOICE #:\nWHAT WAS AUTHORIZED OR AGREED (rate, class, dates, amounts):\nWHAT THE CLIENT PAYS:\nEND DATE / PICKUP / RELEASE TIME:\nCONFIRMATION IN WRITING:\nNEXT STEP (owner / date):"
  },
  "rubric": [
   "Authorization Details: Gets exact terms — claim number, rate, class, start and end dates, direct billing, reservation/invoice numbers.",
   "Client Cost Clarity: Identifies what the client pays (upgrade difference, fuel, damage waiver, days after the end date) and doesn't commit the client's money without her OK.",
   "Cost Control: Moves quickly to stop avoidable costs (storage, rental overage), requests extensions before the end date with a reason, and keeps approvals moving.",
   "Follow-Through: Confirms in writing, sets the next step and date, and tells the client."
  ],
  "tips": [
   "Rate, class, start date, end-date rule, direct bill.",
   "Tell the client her costs before they happen.",
   "Storage runs every day — move the car.",
   "Ask for extensions BEFORE the end date, with a reason.",
   "Get a reservation or invoice number."
  ],
  "caseFile": true
 },
 {
  "id": "pd_rt_supplement",
  "program": "PD",
  "line": "Rental, Tow & Shop",
  "lineIcon": "🚙",
  "dir": "out",
  "name": "Derek Lawson",
  "role": "Property Damage Adjuster, Crestline Mutual Insurance",
  "title": "The Supplement Stall",
  "level": "Advanced",
  "gender": "m",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are placing this call.",
  "facts": "Wednesday 09/30/2026, 11:00 AM. Riverside sent Supplement S1 yesterday: buckled left rear frame rail, floor pan, quarter panel; OEM parts for the structural reinforcement and the bumper cover; pre/post scans and blind-spot radar calibration; labor-rate difference ($72 vs $58). Repairs now $24,860.00 (first estimate $9,480.35). Angela's rental is on Crestline's direct bill ($45/day, until repairs are complete). Training-state total-loss threshold: 75% of ACV.",
  "goals": [
   "Gets a review or reinspection date for Supplement S1",
   "Supports the OEM structural parts, the scans and the radar calibration as safety items; leaves the labor rate to the shop and adjuster",
   "Raises the total-loss question ($24,860 against a likely ACV around $25,000–$31,000) and asks when the valuation will be done",
   "Confirms the rental continues while the supplement is reviewed (the delay isn't Angela's)",
   "Asks for the decisions in writing and updates the plan"
  ],
  "hidden": "You are Derek Lawson (Crestline). You haven't opened the supplement. At first you say the rental will be cut off Friday 'no matter what'. You'll resist OEM parts ('aftermarket is like kind and quality') but agree to OEM for the structural reinforcement if the trainee cites safety and the vehicle's age. You agree scans and calibration are needed if asked. When the trainee raises the total-loss math, you admit 'yeah, this is probably a total — I'll send it to our total-loss unit (Priya Shah)' and agree the rental continues until a total-loss offer (then 3 days). HOW YOU BEHAVE: Overloaded, short, moves when pinned down with specifics.",
  "opening": "Derek Lawson. If this is about that supplement, I haven't gotten to it.",
  "note": {
   "title": "Rental / vehicle note",
   "template": "DATE / TIME:\nSPOKE WITH (company / name / number):\nCLAIM # / RESERVATION # / INVOICE #:\nWHAT WAS AUTHORIZED OR AGREED (rate, class, dates, amounts):\nWHAT THE CLIENT PAYS:\nEND DATE / PICKUP / RELEASE TIME:\nCONFIRMATION IN WRITING:\nNEXT STEP (owner / date):"
  },
  "rubric": [
   "Authorization Details: Gets exact terms — claim number, rate, class, start and end dates, direct billing, reservation/invoice numbers.",
   "Client Cost Clarity: Identifies what the client pays (upgrade difference, fuel, damage waiver, days after the end date) and doesn't commit the client's money without her OK.",
   "Cost Control: Moves quickly to stop avoidable costs (storage, rental overage), requests extensions before the end date with a reason, and keeps approvals moving.",
   "Follow-Through: Confirms in writing, sets the next step and date, and tells the client."
  ],
  "tips": [
   "Rate, class, start date, end-date rule, direct bill.",
   "Tell the client her costs before they happen.",
   "Storage runs every day — move the car.",
   "Ask for extensions BEFORE the end date, with a reason.",
   "Get a reservation or invoice number."
  ],
  "caseFile": true
 },
 {
  "id": "pd_ng_totalloss",
  "program": "PD",
  "line": "Negotiation & Total Loss",
  "lineIcon": "💵",
  "dir": "out",
  "name": "Priya Shah",
  "role": "Total Loss Adjuster, Crestline Mutual Insurance",
  "title": "Negotiate the Total Loss",
  "level": "Advanced",
  "gender": "f",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are placing this call.",
  "facts": "Wednesday 10/07/2026, 10:00 AM. Crestline's offer (10/05): ACV $25,147.00 + tax $2,074.63 = $27,221.63 from valuation VR-26-18840, which lists an XLE AWD with 34,812 miles, three non-comparable comps, a −$620 condition deduction, a −$750 prior-damage deduction and $0 fees. The car is an XLE Premium AWD with the Weather Package, 28,412 miles (odometer photo, window sticker). LSH counter (sent yesterday): comps A $31,495 / B $30,900 / C $31,150 → ACV $31,181.67 + tax $2,572.49 + fees $356.00 = $34,110.16. The rental ends 10/08 under the 3-days-after-offer rule. Car seat $289.99 receipt on file. Payoff $19,850.42 good through 10/15.",
  "goals": [
   "Walks through the documented errors in order: trim/options, mileage, comparables, the two deductions, the missing fees",
   "Asks for the basis of Crestline's numbers and for the valuation to be re-run with the correct vehicle",
   "Responds to 'dealer asking prices' without abandoning the documented counter; doesn't split the difference to finish",
   "Requests a rental extension because the offer was based on the wrong vehicle",
   "Keeps the car seat on the claim and confirms payment routing (payoff to Riverbank, balance to Angela)",
   "Does NOT accept any number on the call — takes it to the client through the attorney, with a response date"
  ],
  "hidden": "You are Priya Shah, Crestline total-loss adjuster, ext 431. Opening position: 'the vendor is independent' — you'll only add the $356 fees. With proof, you'll correct the trim and mileage and remove the prior-damage deduction; you'll remove the condition deduction only if asked for the basis (there's none). You argue the LSH comps are dealer asking prices and 'nobody pays sticker'. Your authority tops out at ACV $30,650.00 → $30,650.00 + tax $2,528.63 + fees $356.00 = $33,534.63; offer it only after the trainee has corrected at least trim, mileage and one deduction. You'll try 'Let's just meet in the middle at $31,000 total and close it today' first. On the rental: you'll say it ends Thursday per policy; if the trainee argues the offer was based on the wrong car, you agree to extend it to 3 days after your corrected offer. You pay the car seat with the receipt. HOW YOU BEHAVE: Professional, firm, respects preparation, tests for weakness.",
  "opening": "Priya Shah, total loss. I got your counter on Carter. Honestly, our valuation vendor is independent — I can't just override it.",
  "note": {
   "title": "Negotiation log",
   "template": "DATE / TIME:\nSPOKE WITH:\nTHEIR POSITION (number and basis):\nOUR POSITION (number and proof):\nPOINTS CORRECTED / CONCEDED:\nOPEN ITEMS:\nRENTAL / PAYOFF STATUS:\nNEXT STEP (owner / date) — and who must approve:"
  },
  "rubric": [
   "Preparation & Evidence: Leads with documented errors and proof (trim, options, mileage, comparables, deductions, tax and fees) and correct math.",
   "Negotiation Technique: Anchors on the documented counter, asks for the basis of the other side's numbers, concedes only what the documents don't support, doesn't split the difference to finish.",
   "Authority & Boundaries: Never accepts on the call; any figure goes to the client through the attorney; no legal advice or value promises to the client.",
   "Documentation: Summarizes positions, corrections and next steps accurately, with dates, and requests written confirmation."
  ],
  "tips": [
   "Lead with the biggest documented errors.",
   "Ask “What's the basis for that?” — then wait.",
   "Don't split the difference to end the call.",
   "Never accept on the call — the client decides with the attorney.",
   "Summarize in writing the same day."
  ],
  "caseFile": true
 },
 {
  "id": "pd_ng_rentalends",
  "program": "PD",
  "line": "Negotiation & Total Loss",
  "lineIcon": "💵",
  "dir": "in",
  "name": "Angela Carter",
  "role": "Client (PD claim)",
  "title": "“My Rental Ends Thursday”",
  "level": "Intermediate",
  "gender": "f",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are answering this call.",
  "facts": "Tuesday 10/06/2026, 5:20 PM. Metro Car Rental told Angela her rental ends Thursday 10/08. Crestline's total-loss offer came 10/05 ($27,221.63) based on the wrong trim and mileage; your counter ($34,110.16) went out today and you've asked Priya Shah to extend the rental because the offer used the wrong vehicle — no answer yet. Angela pays $13/day for her upgrade. Payoff to Riverbank is about $19,850.",
  "goals": [
   "Verifies Angela and acknowledges the stress",
   "Explains the rental end-date rule and the extension request already made (and why)",
   "Explains what she would pay if she keeps the car past 10/08 without an extension ($58/day) and what she already owes ($13/day upgrade)",
   "Explains the offer vs the counter and the payoff split in plain words — no promises about the final number",
   "Doesn't tell her whether to accept anything; says the decision is hers with the attorney",
   "Sets a specific update time (after the adjuster answers) and logs the call"
  ],
  "hidden": "You are Angela Carter. Metro Car Rental called: 'rental ends Thursday'. You don't have a new car and can't buy one until you know the money. You heard 'they offered twenty-seven thousand' — 'I owe almost twenty on the loan, so I get seven thousand?!' You're upset and ask: 'Should I just take their offer so this is over?' and 'Can you make them pay for the rental until I get a car?' You calm down if the trainee explains the counter and the extension request clearly and gives a time for the next update. HOW YOU BEHAVE: Upset, fast-talking, reasonable once she has a plan.",
  "opening": "Hi, it's Angela — the rental place just told me I have to bring the car back THURSDAY. I don't have a car! What am I supposed to do?",
  "note": {
   "title": "Client call note",
   "template": "DATE / TIME:\nCALLER (verified how):\nCLIENT'S CONCERN:\nWHAT WAS EXPLAINED:\nWHAT THE CLIENT WILL DO / SEND:\nESCALATED / ROUTED TO (BI team / attorney):\nNEXT UPDATE (date / channel):"
  },
  "rubric": [
   "Preparation & Evidence: Leads with documented errors and proof (trim, options, mileage, comparables, deductions, tax and fees) and correct math.",
   "Negotiation Technique: Anchors on the documented counter, asks for the basis of the other side's numbers, concedes only what the documents don't support, doesn't split the difference to finish.",
   "Authority & Boundaries: Never accepts on the call; any figure goes to the client through the attorney; no legal advice or value promises to the client.",
   "Documentation: Summarizes positions, corrections and next steps accurately, with dates, and requests written confirmation."
  ],
  "tips": [
   "Lead with the biggest documented errors.",
   "Ask “What's the basis for that?” — then wait.",
   "Don't split the difference to end the call.",
   "Never accept on the call — the client decides with the attorney.",
   "Summarize in writing the same day."
  ],
  "caseFile": true
 },
 {
  "id": "pd_ng_payoff",
  "program": "PD",
  "line": "Negotiation & Total Loss",
  "lineIcon": "💵",
  "dir": "out",
  "name": "Gloria Chen",
  "role": "Payoff Department, Riverbank Auto Finance",
  "title": "The Payoff Call",
  "level": "Intermediate",
  "gender": "f",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are placing this call.",
  "facts": "Friday 10/16/2026, 10:00 AM. The total loss was agreed at $33,534.63 (client authority on file). Crestline will issue payment on Tuesday 10/20. Riverbank's payoff letter: $19,850.42 good through 10/15/2026, then $3.10 per day. Angela authorized you to speak to her lender (signed authorization on file).",
  "goals": [
   "Identifies the firm, Angela's authorization and the loan (RAF-5530981, VIN …22014)",
   "Gets an updated payoff for the 10/20 payment date ($19,865.92) and the per diem",
   "Confirms the payment address, reference and accepted payment method",
   "Asks how and when the lien and title will be released to Crestline",
   "Asks for the updated payoff letter in writing and confirms Angela's equity is paid to her separately"
  ],
  "hidden": "You are Gloria Chen, Riverbank Auto Finance payoffs, (555) 800-4412. You need the borrower authorization (fax/email) — accept it's on file if the trainee says it was sent 10/05. Payoff good through 10/20/2026: $19,865.92 (per diem $3.10). Payment to: Riverbank Auto Finance, Attn: Payoffs, PO Box 4412, Metro Center, ST 90201, reference RAF-5530981; insurer checks accepted. Electronic lien released to the payor/insurer within 10 business days of full payment. You'll warn that a payment of the old amount will be returned. You can email an updated payoff letter today. HOW YOU BEHAVE: Precise, scripted, patient.",
  "opening": "Riverbank Auto Finance, payoff department. This is Gloria.",
  "note": {
   "title": "Negotiation log",
   "template": "DATE / TIME:\nSPOKE WITH:\nTHEIR POSITION (number and basis):\nOUR POSITION (number and proof):\nPOINTS CORRECTED / CONCEDED:\nOPEN ITEMS:\nRENTAL / PAYOFF STATUS:\nNEXT STEP (owner / date) — and who must approve:"
  },
  "rubric": [
   "Preparation & Evidence: Leads with documented errors and proof (trim, options, mileage, comparables, deductions, tax and fees) and correct math.",
   "Negotiation Technique: Anchors on the documented counter, asks for the basis of the other side's numbers, concedes only what the documents don't support, doesn't split the difference to finish.",
   "Authority & Boundaries: Never accepts on the call; any figure goes to the client through the attorney; no legal advice or value promises to the client.",
   "Documentation: Summarizes positions, corrections and next steps accurately, with dates, and requests written confirmation."
  ],
  "tips": [
   "Lead with the biggest documented errors.",
   "Ask “What's the basis for that?” — then wait.",
   "Don't split the difference to end the call.",
   "Never accept on the call — the client decides with the attorney.",
   "Summarize in writing the same day."
  ],
  "caseFile": true
 },
 {
  "id": "pd_cl_release",
  "program": "PD",
  "line": "Settlement & Close",
  "lineIcon": "✍️",
  "dir": "out",
  "name": "Derek Lawson",
  "role": "Property Damage Adjuster, Crestline Mutual Insurance",
  "title": "The “Standard Release”",
  "level": "Advanced",
  "gender": "m",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are placing this call.",
  "facts": "Monday 10/12/2026, 9:30 AM. Crestline's draft release arrived: titled 'Release of All Claims'; §1 releases 'any and all claims … including bodily injury, medical expenses, known or unknown injuries'; §3 one check jointly to Angela and Riverbank for $33,534.63; §4 indemnity/hold harmless; §5 confidentiality; the car seat ($289.99) isn't listed. Angela's BI claim is open (BI Case Manager Rachel Owens). The attorney, Michael Grant, reviews every release.",
  "goals": [
   "Refuses any release that includes bodily injury and asks for Crestline's property-damage-only release",
   "Asks for the car seat to be added and the amount confirmed ($33,534.63 for the vehicle)",
   "Asks for separate payments: the updated payoff to Riverbank, the balance to Angela",
   "Says the indemnity and confidentiality terms go to the attorney (no agreement on the call)",
   "Doesn't let 'it'll take another week' pressure change the answer; gets a date for the revised release in writing"
  ],
  "hidden": "You are Derek Lawson (Crestline). You say it's 'our standard form, everybody signs it, the BI language is just boilerplate'. You'll say a different form 'will take another week'. If the trainee holds firm and asks for the PD-only release, you admit Crestline has a 'Property Damage Release' form and can send it tomorrow. You'll agree to add the car seat. On payment, you say joint checks are policy — but you'll split it (payoff to Riverbank, balance to Angela) if the trainee gives you the updated payoff amount and the lender's address. You won't discuss the BI claim. HOW YOU BEHAVE: Impatient, wants to close his file today.",
  "opening": "Derek Lawson. Did you get the release? Just have her sign it and I'll cut the check today.",
  "note": {
   "title": "Closing note",
   "template": "DATE / TIME:\nSPOKE WITH:\nWHAT WAS DISCUSSED:\nRELEASE / PAYMENT STATUS:\nESCALATED TO THE ATTORNEY (what / when):\nCONFIRMATIONS RECEIVED:\nNEXT STEP (owner / date):"
  },
  "rubric": [
   "Release Protection: Refuses any release that goes beyond property damage (bodily injury, “all claims”); routes indemnity/confidentiality terms to the attorney.",
   "Payment Accuracy: Gets payees, amounts and dates right (updated payoff, client equity, vendors, subrogation).",
   "Client Communication: Explains in plain words without legal advice; the decision is the client's with the attorney.",
   "Close-Out Discipline: Confirms receipts in writing, tracks open items (subrogation), and documents the handoff."
  ],
  "tips": [
   "A PD payment never releases bodily injury.",
   "Payoff to the lender, balance to the client — separately.",
   "Check the payoff good-through date.",
   "No advice: explain the numbers, the attorney advises.",
   "Confirm, then close."
  ],
  "caseFile": true
 },
 {
  "id": "pd_cl_shouldtake",
  "program": "PD",
  "line": "Settlement & Close",
  "lineIcon": "✍️",
  "dir": "in",
  "name": "Angela Carter",
  "role": "Client (PD claim)",
  "title": "“Should I Take It?”",
  "level": "Intermediate",
  "gender": "f",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are answering this call.",
  "facts": "Friday 10/09/2026, 4:45 PM. Priya Shah's corrected offer just came in: ACV $30,650.00 + tax $2,528.63 + fees $356.00 = $33,534.63, plus the car seat ($289.99) on the receipt. Payoff to Riverbank about $19,850 (payment date not set). The attorney, Michael Grant, is available at 5:30 PM. Your counter was $34,110.16.",
  "goals": [
   "Verifies Angela and explains the new offer in plain words (what was corrected, what wasn't)",
   "Explains the split: payoff to Riverbank first, then her equity (about $13,700) plus the car seat",
   "Gives no opinion or recommendation — the decision is hers with the attorney's advice",
   "Sets the call with Michael Grant (5:30 PM) and explains written authority",
   "Explains the next steps (PD-only release, title paperwork, payment timing) and that it doesn't affect her injury claim"
  ],
  "hidden": "You are Angela Carter. You're relieved but unsure: 'Is thirty-three good? You said thirty-four. Should I hold out? What would you do?' You ask 'How much do I actually get?' and 'Does signing this end my injury case too?' You accept a call with the attorney if the trainee explains clearly. If the trainee gives an opinion ('I'd take it'), you say 'OK, so you think I should take it' and move on — that's a mistake the grader will catch. HOW YOU BEHAVE: Tired, trusting, wants it done.",
  "opening": "Hi, it's Angela. I got your message about a new offer? Is it good? Should I just take it?",
  "note": {
   "title": "Client call note",
   "template": "DATE / TIME:\nCALLER (verified how):\nCLIENT'S CONCERN:\nWHAT WAS EXPLAINED:\nWHAT THE CLIENT WILL DO / SEND:\nESCALATED / ROUTED TO (BI team / attorney):\nNEXT UPDATE (date / channel):"
  },
  "rubric": [
   "Release Protection: Refuses any release that goes beyond property damage (bodily injury, “all claims”); routes indemnity/confidentiality terms to the attorney.",
   "Payment Accuracy: Gets payees, amounts and dates right (updated payoff, client equity, vendors, subrogation).",
   "Client Communication: Explains in plain words without legal advice; the decision is the client's with the attorney.",
   "Close-Out Discipline: Confirms receipts in writing, tracks open items (subrogation), and documents the handoff."
  ],
  "tips": [
   "A PD payment never releases bodily injury.",
   "Payoff to the lender, balance to the client — separately.",
   "Check the payoff good-through date.",
   "No advice: explain the numbers, the attorney advises.",
   "Confirm, then close."
  ],
  "caseFile": true
 },
 {
  "id": "pd_cl_subro",
  "program": "PD",
  "line": "Settlement & Close",
  "lineIcon": "✍️",
  "dir": "out",
  "name": "Omar Haddad",
  "role": "Subrogation Specialist, Harbor Point Insurance",
  "title": "The Subrogation Follow-Up",
  "level": "Beginner",
  "gender": "m",
  "you": "You are the Property Damage (PD) Specialist at LSH Law Group, handling Angela Carter's property damage claim (her 2022 Toyota RAV4, rear-ended 09/18/2026). The firm represents Angela for bodily injury AND property damage. You can open claims, confirm coverage, arrange rentals and vehicle moves; you never give legal advice, predict values, or let the other carrier talk to the client. You are placing this call.",
  "facts": "Wednesday 10/28/2026, 2:00 PM. Angela's PD claim is paid (10/20). Harbor Point paid 3 rental days (09/21–09/23) × $40 = $120 on first-party claim HPI-26-55012 before Crestline accepted liability. Crestline confirmed it will pay subrogation demands with proof. Angela paid no deductible (no collision payout).",
  "goals": [
   "Identifies the firm and the claims (HPI-26-55012 and Crestline CMI-26-0918-4471)",
   "Confirms Harbor Point's subrogation demand to Crestline is only the $120 rental and that Angela owes no deductible",
   "Asks for the status and a date for Harbor Point to close its first-party claim",
   "Confirms nothing is owed by Angela and asks for written confirmation",
   "Documents the open item with an owner and a follow-up date"
  ],
  "hidden": "You are Omar Haddad, Harbor Point subrogation, (555) 700-5188. You sent Crestline a $120 demand on 10/22; no response yet. You'll ask 'Did your client pay a deductible? I don't see a collision payment' — the right answer is no collision payout, no deductible. You'll close the first-party claim once Crestline pays (expect 2–3 weeks). You can email written confirmation that Angela owes nothing. HOW YOU BEHAVE: Friendly, a bit disorganized; needs the claim numbers to find the file.",
  "opening": "Subrogation, this is Omar.",
  "note": {
   "title": "Closing note",
   "template": "DATE / TIME:\nSPOKE WITH:\nWHAT WAS DISCUSSED:\nRELEASE / PAYMENT STATUS:\nESCALATED TO THE ATTORNEY (what / when):\nCONFIRMATIONS RECEIVED:\nNEXT STEP (owner / date):"
  },
  "rubric": [
   "Release Protection: Refuses any release that goes beyond property damage (bodily injury, “all claims”); routes indemnity/confidentiality terms to the attorney.",
   "Payment Accuracy: Gets payees, amounts and dates right (updated payoff, client equity, vendors, subrogation).",
   "Client Communication: Explains in plain words without legal advice; the decision is the client's with the attorney.",
   "Close-Out Discipline: Confirms receipts in writing, tracks open items (subrogation), and documents the handoff."
  ],
  "tips": [
   "A PD payment never releases bodily injury.",
   "Payoff to the lender, balance to the client — separately.",
   "Check the payoff good-through date.",
   "No advice: explain the numbers, the attorney advises.",
   "Confirm, then close."
  ],
  "caseFile": true
 }
];
    // The card on the caller list shows the situation (the brief), not the role line every call in a line shares.
    CALLS.forEach(c => { c.blurb = c.facts.length > 190 ? c.facts.slice(0, 187).replace(/\s+\S*$/, '') + '…' : c.facts; });
    CALLS.forEach(c => { if (c.caseFile) { c.caseSummary = PD_CASE; c.caseLabel = 'Angela Carter — property damage claim (2022 RAV4)'; c.hidden += '\n\nCLAIM FILE — background you know only as far as your role would:\n' + PD_CASE; } });
    window.PD_CASE_SUMMARY = PD_CASE;
    window.EXTRA_CALLERS = (window.EXTRA_CALLERS || []).concat(CALLS);
})();

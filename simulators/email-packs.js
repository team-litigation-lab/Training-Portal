/* Email Workspace — built-in scenario packs (the "Any program" pack is generated live).
   Each email: from, subject, time, body ({{LINK:text}} marks a phishing link), label (correct label),
   decision: do | schedule | delegate | defer | report, needsReply, phishing, redFlags. */
const EMAIL_PACKS = {
 "cm": {
  "id": "cm",
  "program": "Case Management",
  "title": "John Doe v. Apex Delivery Services & Robert W. Smith — Monday inbox",
  "role": "You are the Case Manager on John Doe v. Apex Delivery Services, Inc. & Robert W. Smith (LSH File # MVA-JD-2026-001, claim 2026-0214-AX) at LSH Law Group; the handling attorney is Dana Carter. You handle client, provider, lienholder and carrier correspondence. Legal advice, settlement authority and case valuation belong to the attorney. This is the same case file you work in the CMS, the Email Replies, Medical Records and Docket simulators.",
  "labels": [
   {
    "name": "Clients",
    "color": "#DB8437"
   },
   {
    "name": "Insurance / Adjusters",
    "color": "#6B4FA0"
   },
   {
    "name": "Medical Providers & Records",
    "color": "#2C7A7B"
   },
   {
    "name": "Court & Filings",
    "color": "#B54A3F"
   },
   {
    "name": "Billing & Liens",
    "color": "#3F7D58"
   },
   {
    "name": "Internal / Team",
    "color": "#3C4268"
   },
   {
    "name": "Marketing / Newsletters",
    "color": "#A8ADBD"
   },
   {
    "name": "Security Alert",
    "color": "#4A2545"
   }
  ],
  "emails": [
   {
    "from": "John Doe <johndoe@gmail.com>",
    "subject": "any update?? bills keep coming",
    "time": "9:14 AM",
    "label": "Clients",
    "decision": "do",
    "needsReply": true,
    "body": "Hi,\n\nSorry to keep bugging you but I got another statement from Metro General this week and a collections letter about the ambulance. My PIP is supposed to be covering this stuff. Is there any update on my case? When will this be over?\n\nAlso my back is worse since the surgery follow up.\n\nThanks,\nJohn Doe"
   },
   {
    "from": "Tom Reeves <t.reeves@aggressive-casualty.example>",
    "subject": "Claim 2026-0214-AX — recorded statement from Mr. Doe",
    "time": "8:52 AM",
    "label": "Insurance / Adjusters",
    "decision": "delegate",
    "needsReply": false,
    "body": "Good morning,\n\nTo keep claim 2026-0214-AX (insured: Apex Delivery Services / Robert W. Smith) moving I would like a brief recorded statement from Mr. Doe this week. Please send me his direct cell number so I can set it up with him myself.\n\nRegards,\nTom Reeves\nBI Adjuster, Aggressive Casualty Insurance"
   },
   {
    "from": "Brenda Sterling <b.sterling@metrogeneral.example>",
    "subject": "Hospital lien $45,000 — patient John Doe, DOS 02/14/2026",
    "time": "8:31 AM",
    "label": "Billing & Liens",
    "decision": "do",
    "needsReply": true,
    "body": "Hello,\n\nMetro General Hospital asserts a lien of $45,000.00 against any recovery for patient John Doe, date of service 02/14/2026. Please confirm the lien in writing and advise on the status of the case.\n\nBrenda Sterling\nRevenue Recovery, Metro General Hospital"
   },
   {
    "from": "Superior Court e-Filing <efiling@metro-courts.example>",
    "subject": "NOTICE: Hearing set — Motion to Compel, Dept 14, Wed 9:00 AM",
    "time": "7:58 AM",
    "label": "Court & Filings",
    "decision": "do",
    "needsReply": false,
    "body": "NOTICE OF HEARING\n\nCase: Doe v. Apex Delivery Services, Inc. & Robert W. Smith\nLSH File # MVA-JD-2026-001\nMotion: Plaintiff's Motion to Compel Further Responses\nDate/Time: Wednesday, 9:00 AM, Department 14\n\nThis notice was served electronically on all parties of record."
   },
   {
    "from": "Settlement Funds Release <release@docusign-secure-funds.com>",
    "subject": "ACTION REQUIRED: Settlement funds release — DOE",
    "time": "9:40 AM",
    "label": "Security Alert",
    "decision": "report",
    "needsReply": false,
    "phishing": true,
    "body": "A settlement disbursement for DOE / MVA-JD-2026-001 is pending your approval. Confirm the receiving trust account within 24 hours or the funds will be returned to the payer.\n\n{{LINK:Review & Confirm Wire Details}}\n\nFunds Release Team",
    "redFlags": [
     "Sender domain is not docusign.com and is not the carrier's",
     "Settlement funds never move by a “confirm account” link in an email",
     "24-hour pressure to act",
     "Asks you to confirm wire / trust-account details",
     "No case is at the disbursement stage — the carrier's $45,000 counter was rejected 05/26/2026"
    ]
   },
   {
    "from": "Metro General Release of Information <roi@metrogeneral.example>",
    "subject": "Records request received — fee $38 due before release",
    "time": "8:05 AM",
    "label": "Medical Providers & Records",
    "decision": "delegate",
    "needsReply": false,
    "body": "Your request for the medical records of John Doe (DOS 02/14/2026) has been received. A processing fee of $38.00 is due before release. Payment can be made by firm check or through our release-of-information portal.\n\nNote: the authorization on file is unsigned and undated. We cannot release until a corrected authorization is received.\n\nMetro General Release of Information"
   },
   {
    "from": "Dana Carter <dcarter@lshlawgroup.example>",
    "subject": "Doe — medical chronology and specials by Thursday",
    "time": "7:45 AM",
    "label": "Internal / Team",
    "decision": "schedule",
    "needsReply": false,
    "body": "Hi,\n\nPlease put together the medical chronology and an updated specials table for Doe (providers, dates, billed totals, what PIP paid) by end of day Thursday. I want it before the settlement conference Friday.\n\nReconcile the MRI while you are in there — the chronology says 3mm on 03/10 and the radiology report says 5mm on 03/15.\n\nThanks,\nDana Carter\nHandling Attorney, LSH Law Group"
   },
   {
    "from": "PI Trial Report <news@pitrialreport.com>",
    "subject": "Top 10 personal-injury verdicts this quarter",
    "time": "6:30 AM",
    "label": "Marketing / Newsletters",
    "decision": "defer",
    "needsReply": false,
    "body": "This quarter's biggest verdicts, plus three trends every PI team should watch. Read the full report online."
   },
   {
    "from": "Jane Doe <jane.doe80@gmail.com>",
    "subject": "My own claim — was I ever signed up?",
    "time": "9:03 AM",
    "label": "Clients",
    "decision": "do",
    "needsReply": true,
    "body": "Hi,\n\nI was in the passenger seat when the truck hit us on February 14. I turned down the ambulance at the scene but my neck and shoulder have hurt ever since and I have never been seen for it.\n\nJohn says your firm handles everything. Am I signed up too, or is it only his case? Nobody has sent me anything to sign.\n\nJane Doe"
   },
   {
    "from": "IT Help Desk <it@lshlawgroup.example>",
    "subject": "Scheduled password reset — Friday (use the intranet as usual)",
    "time": "7:10 AM",
    "label": "Internal / Team",
    "decision": "schedule",
    "needsReply": false,
    "body": "Reminder: firm-wide password resets are scheduled for Friday. Please reset through the intranet self-service page as usual. IT will never email you a link or ask for your password.\n\nIT Help Desk"
   }
  ]
 },
 "ea": {
  "id": "ea",
  "program": "Executive Support (EA / PA)",
  "title": "Elias Thorne’s inbox — Monday morning",
  "role": "You are the Executive Assistant to Elias Thorne, Managing Owner & CEO of Thorne & Partners Law Group. You work his inbox with delegate access and reply to clients on his behalf (you sign as Ms. Chen, his EA).",
  "labels": [
   {
    "name": "Court / Filing",
    "color": "#B54A3F"
   },
   {
    "name": "Opposing Counsel",
    "color": "#6B4FA0"
   },
   {
    "name": "Client Communication",
    "color": "#DB8437"
   },
   {
    "name": "Trust & Billing",
    "color": "#3F7D58"
   },
   {
    "name": "Case Team / Co-Counsel",
    "color": "#3C4268"
   },
   {
    "name": "Compliance",
    "color": "#2C7A7B"
   },
   {
    "name": "Internal / Admin",
    "color": "#7C82A0"
   },
   {
    "name": "Marketing / Networking",
    "color": "#A8ADBD"
   },
   {
    "name": "Security Alert",
    "color": "#4A2545"
   }
  ],
  "emails": [
   {
    "from": "R. Alvarez, Client — Matter 24-0113",
    "subject": "Status update requested — Contract Review",
    "time": "9:02 AM",
    "body": "Ms. Chen,\n\nCould you please provide a status update on the contract review for Matter 24-0113? We are approaching our internal deadline and require confirmation of next steps.\n\nRegards,\nR. Alvarez",
    "label": "Client Communication",
    "decision": "do",
    "needsReply": true,
    "phishing": false,
    "redFlags": []
   },
   {
    "from": "LegalTech Weekly",
    "subject": "5 AI Tools Every Law Firm Should Know About",
    "time": "7:15 AM",
    "body": "This week's roundup of legal technology news and trends, curated for busy professionals. Read the top 5 tools changing how firms manage discovery...",
    "label": "Marketing / Networking",
    "decision": "defer",
    "needsReply": false,
    "phishing": false,
    "redFlags": []
   },
   {
    "from": "IT Security Team <security@lsh-support-verify.com>",
    "subject": "URGENT: Your Mailbox Storage Is Full",
    "time": "8:47 AM",
    "body": "Your mailbox has exceeded its storage limit. Click below immediately to verify your account, or you will lose access to your email within 24 hours.\n\n{{LINK:Verify My Account Now}}\n\nIT Security Team",
    "label": "Security Alert",
    "decision": "report",
    "needsReply": false,
    "phishing": true,
    "redFlags": [
     "Sender domain doesn't match the real company domain",
     "Manufactured urgency (a 24-hour countdown)",
     "Generic, impersonal greeting",
     "Pressures you to click a link immediately instead of verifying through a known channel"
    ]
   },
   {
    "from": "T. Whitfield, Client",
    "subject": "quick q about our meeting!!",
    "time": "9:20 AM",
    "body": "hi!! hope you're doing well :) quick question — any chance we could push our call from thursday to friday instead? also totally random but do you guys have a preferred format for sending over documents, pdf or word doc? no rush at all just wondering! thanks so much!!",
    "label": "Client Communication",
    "decision": "do",
    "needsReply": true,
    "phishing": false,
    "redFlags": []
   },
   {
    "from": "Continuing Education Network",
    "subject": "50% Off All CLE Webinars This Month Only!",
    "time": "6:30 AM",
    "body": "Don't miss our biggest sale of the year on continuing legal education courses. Browse our full catalog and register before the offer ends Friday.",
    "label": "Marketing / Networking",
    "decision": "defer",
    "needsReply": false,
    "phishing": false,
    "redFlags": []
   },
   {
    "from": "D. Osei, Client — Matter 24-0098",
    "subject": "Why haven't I received an update?",
    "time": "9:41 AM",
    "body": "This is the third time I'm reaching out. I was told two weeks ago that the invoice discrepancy would be resolved and I still have not heard anything. I need this addressed today. This is unacceptable.",
    "label": "Client Communication",
    "decision": "do",
    "needsReply": true,
    "phishing": false,
    "redFlags": []
   },
   {
    "from": "LinkedIn",
    "subject": "You have 12 new notifications",
    "time": "6:05 AM",
    "body": "See who's viewed your profile, plus new posts from your network this week.",
    "label": "Marketing / Networking",
    "decision": "defer",
    "needsReply": false,
    "phishing": false,
    "redFlags": []
   },
   {
    "from": "DocuSign Notifications <no-reply@docusign-secure-verify.net>",
    "subject": "Action Required: Confirm Wire Transfer Details",
    "time": "9:55 AM",
    "body": "A pending wire transfer requires verification before it can be processed. Please reply to this email with the account number and routing number on file to confirm the transaction before it is automatically canceled.",
    "label": "Security Alert",
    "decision": "report",
    "needsReply": false,
    "phishing": true,
    "redFlags": [
     "Legitimate parties never request account or routing numbers by email reply",
     "Suspicious, non-official sender domain",
     "Creates urgency around a financial transaction to short-circuit normal verification"
    ]
   },
   {
    "from": "M. Chen, Referred Prospect",
    "subject": "Documents needed for contract dispute intake",
    "time": "10:05 AM",
    "body": "Hello,\n\nFollowing our referral conversation, here is what I believe you'll need to get started:\n1. Signed copy of the original vendor agreement (2022)\n2. Email correspondence regarding the breach (attached separately)\n3. Invoice history for the last 12 months\n4. A list of all parties involved\n\nPlease let me know if anything else is required before we schedule an initial consultation.\n\nBest,\nM. Chen",
    "label": "Client Communication",
    "decision": "do",
    "needsReply": true,
    "phishing": false,
    "redFlags": []
   },
   {
    "from": "Office Events Committee",
    "subject": "Sign up for the Fall Potluck!",
    "time": "7:50 AM",
    "body": "It's that time of year again — please sign up for what dish you'll bring to this year's fall potluck. Sign-up sheet is on the shared drive.",
    "label": "Internal / Admin",
    "decision": "defer",
    "needsReply": false,
    "phishing": false,
    "redFlags": []
   }
  ]
 }
};

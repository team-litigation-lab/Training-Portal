/* Email Workspace — built-in scenario packs (the "Any program" pack is generated live).
   Each email: from, subject, time, body ({{LINK:text}} marks a phishing link), label (correct label),
   decision: do | schedule | delegate | defer | report, needsReply, phishing, redFlags. */
const EMAIL_PACKS = {
 "cm": {
  "id": "cm",
  "program": "Case Management",
  "title": "John Doe v. Robert Smith — Monday inbox",
  "role": "You are the Case Manager on John Doe v. Robert Smith (LSH matter LSH-2026-MVA-770412) at LSH Law Group. John Doe was the front-seat passenger in the host vehicle that Robert Smith hit on 02/06/2026. You handle client, provider, lienholder and carrier correspondence; legal advice, settlement authority and case valuation belong to the handling attorney, Atty. Elijah Thorne. This is the same case file you work in the CMS, the Email Replies, Medical Records and Docket simulators. File every email under a label, give each one decision, and reply where a reply is needed.",
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
    "from": "John Doe <john.doe@example.com>",
    "subject": "any update?? bills keep coming",
    "time": "9:14 AM",
    "label": "Clients",
    "decision": "do",
    "needsReply": true,
    "body": "Hi,\n\nSorry to keep bugging you but I got another statement from Riverton Spine & Rehab this week and a collections letter about the ambulance from the crash. I thought the insurance was covering this stuff. Is there any update on my case? When will this be over?\n\nAlso my neck is still stiff after PT.\n\nThanks,\nJohn Doe"
   },
   {
    "from": "Dana Whitfield <dana.whitfield@keystonemutual.example>",
    "subject": "Claim KM-26-440871 — recorded statement from Mr. Doe",
    "time": "8:52 AM",
    "label": "Insurance / Adjusters",
    "decision": "delegate",
    "needsReply": false,
    "body": "Good morning,\n\nTo keep claim KM-26-440871 (insured: Robert Smith) moving I would like a brief recorded statement from Mr. Doe this week. Please send me his direct cell number so I can set it up with him myself.\n\nRegards,\nDana Whitfield\nBodily Injury Adjuster, Keystone Mutual Insurance"
   },
   {
    "from": "Peach State Recovery Unit <recovery@peachstatehealth.example>",
    "subject": "Reimbursement claim $3,618.00 — member John Doe, PSH-55017742",
    "time": "8:31 AM",
    "label": "Billing & Liens",
    "decision": "do",
    "needsReply": true,
    "body": "Hello,\n\nPeach State Health Plan asserts a reimbursement right of $3,618.00 against any recovery for member John Doe (PSH-55017742), injuries of 02/06/2026. Please confirm the claim in writing and advise on the status of the case.\n\nRecovery Unit\nPeach State Health Plan"
   },
   {
    "from": "Riverton County e-Filing <efiling@riverton-courts.example>",
    "subject": "NOTICE: Case Management Conference set — Dept 4, Wed 9:00 AM",
    "time": "7:58 AM",
    "label": "Court & Filings",
    "decision": "do",
    "needsReply": false,
    "body": "NOTICE OF HEARING\n\nCase: John Doe v. Robert Smith\nLSH matter LSH-2026-MVA-770412\nHearing: Case Management Conference\nDate/Time: Wednesday, 9:00 AM, Department 4\n\nThis notice was served electronically on all parties of record, including Atty. Grant Mercer, Mercer & Hale LLP, for the defendant."
   },
   {
    "from": "Settlement Funds Release <release@docusign-secure-funds.com>",
    "subject": "ACTION REQUIRED: Settlement funds release — DOE",
    "time": "9:40 AM",
    "label": "Security Alert",
    "decision": "report",
    "needsReply": false,
    "phishing": true,
    "body": "A settlement disbursement for DOE / LSH-2026-MVA-770412 is pending your approval. Confirm the receiving trust account within 24 hours or the funds will be returned to the payer.\n\n{{LINK:Review & Confirm Wire Details}}\n\nFunds Release Team",
    "redFlags": [
     "Sender domain is not docusign.com and is not Keystone Mutual's",
     "Settlement funds never move by a “confirm account” link in an email",
     "24-hour pressure to act",
     "Asks you to confirm wire / trust-account details",
     "Keystone pays by check to the firm's IOLTA trust account, and only after the signed release"
    ]
   },
   {
    "from": "Summit Imaging Records <records@summitimaging.example>",
    "subject": "Records request received — fee $25 due before release",
    "time": "8:05 AM",
    "label": "Medical Providers & Records",
    "decision": "delegate",
    "needsReply": false,
    "body": "Your request for the records of John Doe (cervical MRI, DOS 03/13/2026) has been received. A processing fee of $25.00 is due before release. Payment can be made by firm check or through our records portal.\n\nNote: the authorization on file is unsigned and undated. We cannot release until a corrected authorization is received.\n\nSummit Imaging Center — Health Information Management"
   },
   {
    "from": "Atty. Elijah Thorne <ethorne@lshlawgroup.example>",
    "subject": "Doe — medical chronology and specials by Thursday",
    "time": "7:45 AM",
    "label": "Internal / Team",
    "decision": "schedule",
    "needsReply": false,
    "body": "Hi,\n\nPlease put together the medical chronology and an updated specials table for Doe (providers, dates, billed totals, what Harbor Point PIP paid) by end of day Thursday. I want it before the demand goes out.\n\nWhile you are in there, reconcile the MRI: the Summit report's history gives a different date of injury from 02/06/2026. We need the corrected addendum.\n\nThanks,\nElijah Thorne\nLead Counsel, LSH Law Group"
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
    "from": "Margaret Doe <margaret.doe@example.com>",
    "subject": "My Civic — is that part of John's case?",
    "time": "9:03 AM",
    "label": "Clients",
    "decision": "do",
    "needsReply": true,
    "body": "Hi,\n\nI'm John's mother. My Civic was parked outside when all this happened and it was damaged too. The insurance company keeps calling me about it.\n\nJohn says your firm handles everything. Is my car part of his case, or do I need to do something myself? Nobody has sent me anything to sign.\n\nMargaret Doe"
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

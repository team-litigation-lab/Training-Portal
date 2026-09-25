/* Email Workspace — built-in scenario packs (the "Any program" pack is generated live).
   Each email: from, subject, time, body ({{LINK:text}} marks a phishing link), label (correct label),
   decision: do | schedule | delegate | defer | report, needsReply, phishing, redFlags. */
const EMAIL_PACKS = {
 "cm": {
  "id": "cm",
  "program": "Case Management",
  "title": "Personal-injury team — Monday inbox",
  "role": "You are the case manager on a personal-injury team at Patel & Associates (attorney: Anita Patel). You handle client communication, providers, records and adjusters. Settlement values and legal advice are for the attorney.",
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
    "from": "Carla Nguyen <carla.nguyen88@gmail.com>",
    "subject": "any update?? bills keep coming",
    "time": "9:14 AM",
    "label": "Clients",
    "decision": "do",
    "needsReply": true,
    "body": "Hi,\n\nsorry to bother again but I got two more bills from Harbor PT this week and a collections letter from the ambulance company. Is there any update on my case? When will this be over? I just want to know what is going on.\n\nThanks,\nCarla"
   },
   {
    "from": "Jim Patel <jpatel@summitmutual.com>",
    "subject": "Recorded statement — Nguyen, claim SM-44821",
    "time": "8:52 AM",
    "label": "Insurance / Adjusters",
    "decision": "delegate",
    "needsReply": false,
    "body": "Good morning,\n\nFollowing up on claim SM-44821 (insured: Rapid Freight LLC). I would like to take a brief recorded statement from Ms. Nguyen this week. Please send me her direct cell so I can set it up with her.\n\nRegards,\nJim Patel\nSenior Claims Adjuster, Summit Mutual"
   },
   {
    "from": "Denise Ford <billing@harborpt.com>",
    "subject": "Balance $6,450 — patient Carla Nguyen",
    "time": "8:31 AM",
    "label": "Billing & Liens",
    "decision": "do",
    "needsReply": true,
    "body": "Hello,\n\nPatient Carla Nguyen has an outstanding balance of $6,450 with Harbor Physical Therapy. Please advise on the status of her case and when we can expect payment. We will consider sending the account to collections if we do not hear back.\n\nDenise Ford\nBilling Manager, Harbor Physical Therapy"
   },
   {
    "from": "County Superior Court e-Filing <efiling@county-courts.gov>",
    "subject": "NOTICE: Hearing set — Motion to Compel, Dept 14, Wed 9:00 AM",
    "time": "7:58 AM",
    "label": "Court & Filings",
    "decision": "do",
    "needsReply": false,
    "body": "NOTICE OF HEARING\n\nCase: Nguyen v. Rapid Freight LLC\nMotion: Plaintiff’s Motion to Compel Further Responses\nDate/Time: Wednesday, 9:00 AM, Department 14\n\nThis notice was served electronically on all parties of record."
   },
   {
    "from": "DocuSign Funds Release <release@docusign-secure-funds.com>",
    "subject": "ACTION REQUIRED: Settlement funds release — Nguyen",
    "time": "9:40 AM",
    "label": "Security Alert",
    "decision": "report",
    "needsReply": false,
    "phishing": true,
    "body": "A settlement disbursement for NGUYEN is pending your approval. Confirm the receiving account within 24 hours or the funds will be returned to the payer.\n\n{{LINK:Review & Confirm Wire Details}}\n\nDocuSign Funds Release Team",
    "redFlags": [
     "Sender domain is not docusign.com",
     "Settlement funds never move by a DocuSign “confirm account” link",
     "24-hour pressure to act",
     "Asks you to confirm wire/account details"
    ]
   },
   {
    "from": "Mercy Hospital Records <roi@mercyhealth.org>",
    "subject": "Records request received — fee $38 due before release",
    "time": "8:05 AM",
    "label": "Medical Providers & Records",
    "decision": "delegate",
    "needsReply": false,
    "body": "Your request for the medical records of Carla Nguyen (DOS 03/14) has been received. A processing fee of $38.00 is due before release. Payment can be made by firm check or through our release-of-information portal.\n\nMercy Hospital Release of Information"
   },
   {
    "from": "Anita Patel <apatel@patellaw.com>",
    "subject": "Nguyen — treatment summary by Thursday",
    "time": "7:45 AM",
    "label": "Internal / Team",
    "decision": "schedule",
    "needsReply": false,
    "body": "Hi,\n\nPlease put together a treatment summary for Nguyen (providers, dates, totals so far) by end of day Thursday. I want it before the settlement conference Friday.\n\nThanks,\nAnita"
   },
   {
    "from": "PI Trial Report <news@pitrialreport.com>",
    "subject": "Top 10 personal-injury verdicts this quarter",
    "time": "6:30 AM",
    "label": "Marketing / Newsletters",
    "decision": "defer",
    "needsReply": false,
    "body": "This quarter’s biggest verdicts, plus three trends every PI team should watch. Read the full report online."
   },
   {
    "from": "D. Osei <d.osei@oseiholdings.com>",
    "subject": "Third request — invoice discrepancy (Matter 24-0098)",
    "time": "9:03 AM",
    "label": "Clients",
    "decision": "do",
    "needsReply": true,
    "body": "This is my third request regarding the discrepancy on invoice #4471. I was told two weeks ago it would be corrected. I expect a written response today with a specific resolution date.\n\nD. Osei"
   },
   {
    "from": "IT Help Desk <it@patellaw.com>",
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

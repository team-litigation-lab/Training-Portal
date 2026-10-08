# cm-training-activity

## Trainee sign-in on the Main Portal (single sign-in)

Trainees log in once, here, and open each training program from the Training Directory. They aren't asked to sign in again inside the program.

- **Register:** `/registration.html` (Trainee is the default type). An admin approves the account and assigns the Batch ID, as for admins. **Batch IDs** are the batch's: `B` + MMDDYY of the training start date (an admin's: the day the account was made), e.g. `B100526` for 5 October 2026, shared by everyone in the batch (`nextBatchId`, `functions/_utils.js`). Batch IDs given out before October 2026 have a trainee number (`B30092026-LSHTRAINEE-004`): they keep it in storage, since the programs know those trainees by it, but the pages show only the batch (`B300926`, `batchLabel` in `app.js`), and an admin's edit box leaves it alone unless a new Batch ID is typed. Two trainees with the same first and last name in one batch would share a program record (the M.I. isn't sent): give one of them a different Batch ID before they open a program. **Log in:** `/trainee-login.html` with the username and password they registered with (`/api/login`, `portalMode: "Trainee"`). A name alone no longer works. Admins still use `/admin-login.html`; an admin account used on the trainee form is told to use the Admin Portal.
- **Open a program:** `/programs.html`. For a trainee whose access to the program is approved, the card's **Enter Program** goes to `/api/launch?program=<topic key>` (`functions/api/launch.js`), which checks the portal session and the approved access, then redirects to the program with a signed ticket (`?ticket=…`). The ticket carries the account's first name, last name and Batch ID, and is good for 5 minutes. Visitors who aren't logged in see **Log in to open** on those cards. Admins go through the same launch step: they signed in here with their admin password, so the program signs them in as an admin from an admin ticket (`{r: 'a', exp}`) and doesn't ask for the password again. Only someone who opens a program's own link directly is asked for it.
- **Which programs:** `SSO_PROGRAMS` in `programs.html` and `SSO_PROGRAMS` in `functions/api/launch.js` (keep them the same). Today **every program** (Standard Foundational Training, EA / PA, CM, PD Claims and Medsum & Demand) accepts tickets; the other programs still open directly and keep their own sign-in until they get the same change (`js/portal-gate.js` and the Worker endpoints in the Foundational-Training repo).
- **Sign-in check (admins):** `/api/sso-check` (no longer in the admin menus; open the address directly) signs a test ticket and tries it on every program, listing each as **OK**, **MISMATCH** (its `PORTAL_SSO_SECRET` differs from the Portal's), or **NOT LOCKED YET**. Reload it after changing a secret and redeploying the Portal. Nothing is stored.
- **Secret:** `PORTAL_SSO_SECRET` (Pages → Settings → Variables and Secrets, as a secret) must be the same value as the program's. Without it `/api/launch` answers "Not available yet". The ticket is `base64url(JSON {first, last, b, exp})` + `.` + `base64url(HMAC-SHA256(key = "portal-sso:" + secret, message = that text))`.
- **Simulators open signed in from a course.** A course (Foundational, CM) adds a fresh ticket to its links to the Portal's simulator pages (`?ticket=`, its `js/lsh-tool-links.js`, signed by the course Worker with the same `PORTAL_SSO_SECRET`). `functions/_middleware.js` signs the trainee in from it before the page is sent (`ticketSession` in `functions/api/ticket-login.js`: their Approved Portal account with that first and last name and Batch ID; the same session as `/api/login`) and reloads the address without the ticket, so they never see the sign-in page. A bad, expired, revoked or admin ticket doesn't sign anyone in, and a signed-in admin keeps their session. `/api/ticket-login` is the same step as an API. Test: `front-door.mjs`.
- **Whose results:** on the simulators, a signed-in trainee always practices as their account (*Practicing as <name> · <batch>*, not editable): a name typed earlier in that browser, or passed by a link (`?name=&batch=`), no longer replaces it (results were being saved under that other name). A course's link still passes `?program=`. **Results reach the course:** a signed-in trainee's result from a simulator a course opened (`program` FT, CM, PD or EA) is also written to that course's store, `<prefix>simresults:<the course's trainee id>` (`{traineeId, updatedAt, results (latest 60), best: {<simulator>: {score, count, at}}}`), which the course shows on its Scorecard. Test: `sim-results.mjs`.
- **Names must match the program's records.** The program makes a trainee's record id from the first name, last name and batch in the ticket, so a trainee already registered in a program keeps their progress only if their portal account has the same first name, last name and Batch ID they used there. (M.I. and suffix aren't sent.) Check this when creating accounts for existing trainees.

## Email Replies: inbox delivery setup

`/simulators/email-replies.html` works right away in **Answer here** mode. To also send practice emails to trainees' own inboxes and score the replies they send from there, connect [Postmark](https://postmarkapp.com), which handles both sending and receiving. No change to your domain's mail (MX) records is needed.

1. In Postmark, create a Server. Under **Sender Signatures**, verify the address the emails come from, e.g. `training@legalsupporthelp.com`, or verify the whole domain.
2. In that server's **Default Inbound Stream**, copy the inbound address (`…@inbound.postmarkapp.com`). Set its **Webhook URL** to
   `https://cm-training-activity.pages.dev/api/email-inbound?key=<EMAIL_INBOUND_SECRET>`.
3. In Cloudflare Pages → this project → **Settings → Variables and Secrets** (Production), add:
   - `POSTMARK_SERVER_TOKEN`: the server's API token (as a secret)
   - `EMAIL_FROM`: e.g. `LSH Training Portal <training@legalsupporthelp.com>` (must be verified in step 1)
   - `EMAIL_INBOUND_ADDRESS`: the inbound address from step 2
   - `EMAIL_INBOUND_SECRET`: a long random string, the same one used in the webhook URL (as a secret)
   - `EMAIL_DAILY_PER_ADDRESS` (optional): practice emails per address per day, default 5
4. Redeploy. **Send to my inbox** turns on automatically once all four required settings are present.

The portal only sends the fixed scenarios in `simulators/reply-packs/emails.json`. Sends are limited per connection (`SIM_RATE_LIMIT`) and per recipient address. Replies are matched to their practice email by a random token in the Reply-To address; only the first reply to each practice email is scored.


## Legal-work simulators: Docket, Medical Records, Court E-Filing

Three simulators on the Simulators hub (`/simulators.html`) train the paperwork side of case management. All three run in the browser (progress is saved in that browser) and send scores to the trainer like the other simulators (`Sim.saveResult`). Each shows a reference number (`DKT-…`, `MRR-2026-…`, `ECF-…` / `ENV-…`) that trainees log in the CM course's tool steps.

**⚖️ Docket System** (`/simulators/docket.html`), built from the LSH docket registry prototype:
- **Docketing Inbox**: notices of electronic filing, mail and emails for one case. For each item, the trainee decides whether it belongs on the court docket (discovery and internal emails don't), then calendars every deadline it triggers with a responsible person and reminders. **Check My Docketing** grades each item and shows the computation for anything wrong.
  - *Harlow v. Tri-County Transit* (federal): answer due after service, opposition to a motion, a hearing, RFAs served by mail, an order counted from its entry date, and a scheduling order.
  - *John Doe v. Apex* (CM course): SOL, the arbitration scheduling order, the amended complaint's service window, RFAs by mail and a motion to compel. These use the course's state method.
- **Court Records**: a federal-style docket report per case (court, case number, judge, nature of suit, parties and counsel, numbered entries), with filters, search, CSV export, new cases and entries. It includes the five cases from the prototype.
- **Firm Calendar**: every deadline, with Verified and Done checks and an `.ics` export.
- **Deadline Calculator**: `simulators/legal-rules.js` (`LR.compute`), a rules library (answer 21 days, opposition 14, discovery 30, FRCP 4(m) 90, appeal 30, expert disclosures 90 days before trial, SOL 2 years, and more) with federal court holidays for 2026–2027.
  - **Federal (FRCP 6):** roll a weekend or holiday forward, then add 3 days for mail service only.
  - **State method (CM course):** add the service days first, then roll once.
  - It unlocks for an assignment after the trainee checks it, so trainees count by hand first.

**🗂 Medical Records Requests** (`/simulators/records.html`): collecting John Doe's records and bills for the demand, from Monday 07/06/2026 to the attorney's date, 08/14/2026.
- **Authorization:** the HIPAA authorization is unsigned and undated; review it against 45 CFR 164.508 and send it for e-signature.
- **Requests:** go to the right department (hospital records vs. billing) for the right dates of service.
- **Business-day clock:** providers respond with acknowledgments, rejections (bad authorization, no records for those dates, psychotherapy notes without a separate authorization), invoices, and silence until someone follows up.
- **Fees:** the training fee cap is $25 + $0.25 per page. The EMS flat fee is over it, so dispute it.
- **Delivered records** reveal new providers (independent anesthesia, post-op radiology) and planted problems: the MRI's wrong DOB, the brain-MRI charge, and a partial chiropractic ledger.
- **Scoring (100 points):** authorization, 21 required record sets logged (including the 2018 and 2021 prior-history records), on time, psychotherapy notes, no unrelated providers, fees, follow-ups, and problems flagged. Data: `simulators/records-data.js`.

**🏛 Court E-Filing** (`/simulators/efiling.html`):
- **Federal, electronic-case-filing style:** event → case → filer → the entry it responds to → main document and typed, described attachments → docket text → a Notice of Electronic Filing.
- **State, e-filing-provider style:** existing or new case → filing code or case type and jurisdiction → parties → lead document and attachments → service contacts → fees and payment account → envelope → clerk accepts or rejects.
- **Filing folder:** the trainee inspects each file and fixes it (OCR, /s/ signature, certificate of service, FRCP 5.2 redaction, splitting a file over 35 MB, removing a password). The system blocks non-PDF, oversized and password-protected uploads.
- **Traps:** a privileged memo, the attorney-only case summary, a superseded complaint and private intake notes must never be filed.
- **Scenarios:** the Harlow opposition (federal), John Doe's First Amended Complaint (state), and opening Santos v. Brightway Grocers (civil cover sheet, summons, $435 unlimited-civil fee, personal service). Data: `simulators/efiling-data.js`.

## 🤝 Got a referral?

The **Got a referral?** button on the home page (in the hero, next to *See how it works*) opens a pop-up card. Anyone can use it to refer someone to LSH.

**What the form collects**
- The person's full name, email and phone. Optional: location, the role they're interested in, LinkedIn, and why they'd be a good fit.
- Their CV: PDF, DOC or DOCX, up to 10 MB.
- The referrer's name, plus an optional email or Batch ID.
- A consent box: the person agreed to share their details and CV.

**Admins: 🤝 Referrals** (`/referrals.html`, linked from Master Control and the Directory's admin bar) lists every referral. From there you can:
- download the CV;
- set a status (New, Contacted, Interviewing, Hired, Not a fit) and keep a note;
- filter, search and download a CSV;
- delete a referral, which removes its CV too.

**How it's stored and protected**
- Endpoint: `functions/api/referrals.js`.
- Sending is public, protected like the simulators: it only accepts requests from the portal's own pages, it's closed while the site is locked, it has a hidden anti-bot field, and each connection can send `REFERRAL_RATE_LIMIT` referrals per hour (default 5).
- The file's type is checked from its content, not just its name.
- Listing, downloading, updating and deleting are admin-only.
- Data is in D1 `TRAINING_DB`, created on first use: `referrals` holds the details, `referral_files` holds the CV in 1 MB parts (the portal has no file bucket, and a D1 value is capped at 2 MB), and `referral_rate` holds the rate limit.

## 🧭 Blueprint

**`/blueprint.html`** is the Platform Blueprint (formerly the Platform Orientation; `/orientation.html` forwards here): a slide deck made for screen sharing in Google Meet. It shows nothing private: no passwords, access codes or trainee data.

It has two tracks, switched at the top of the page:
- **Trainees** (8 slides): what the portal is, registering and the one log in, the Training Directory (Request Access, Enter Program, certificates), what's inside a program, the Simulators, the Knowledge Base, good habits, and first steps.
- **Trainers & Admins** (8 slides, signed-in admins only: trainees never see this track or its tab): the admin bar, the Directory's admin view (topic requests, Switch view), System Management, Trainee Monitoring, Attendance, program admin, Knowledge Base review / referrals / calendar reviews, and a daily checklist.

How to use it:
- Keys: ← → (or Page Up / Page Down / Space) change slides, and **F** toggles full screen.
- **⬇ Download PDF** saves the current track as a PDF, one page per slide (`lsh-blueprint.js`, the same file as on every LSH platform). The cover and each page carry the deployed version (the page's ETag) and the date, so it's always made from what's live: nothing to rebuild by hand after a deploy.
- **Numbering:** the PDF's cover is the Cover, then its pages are `1 / 8` to `8 / 8` (headed "1 of 8" to "8 of 8"), the same as the page's own counter. The cover isn't counted, so nothing says 9.
- **🖨 Print** prints the current track, one slide per page.
- Deep links: `?track=admin&slide=3`.
- Links to it: **Blueprint** in the main page header and in the admin bar on every main page. Signed-in admins get the admin track.

To change the content, edit `SLIDES` in `blueprint.html`; the PDF is made from the same slides. `.github/scripts/blueprint.cjs` checks it in CI: trainees get the Trainees track only, an admin gets both, and each track downloads as a PDF with every slide and the deploy stamp.

### 🔑 Admin accounts and Master Control

One sign-in opens everything: a trainer registers on the Portal as **Admin / Trainer**, an administrator approves the account, and they sign in at **Admin Login** with their own username and password. That session opens the Training Directory, every program's admin, the Simulators, the Knowledge Base, the Ring Channel, Trainee Monitoring, Attendance and Referrals, with no second password anywhere.

**Master Control** is the one exception. Its screens and APIs (users, registrations, program access, activity and server logs, Broadcast & Ping, the site lock, imports) are the master account's, `LSHADMIN123`, whose password is the `MASTER_ADMIN_PASSWORD` secret in Cloudflare — it has no row in the users table.

- Signed in as `LSHADMIN123`: Master Control opens straight away.
- Signed in with a trainer's own admin account: opening Master Control asks for the master password once. `POST /api/master-unlock` checks it and sets a signed `lsh_master` cookie naming that admin and that sign-in, so the rest of the session is open. A new sign-in, or another person in the same browser, types it again. Wrong tries count toward the same 10-in-10-minutes limit as the sign-in.
- On the server, those endpoints pass `{ adminOnly: true, master: true }` to `requireSession` and answer `403 MASTER_REQUIRED` without it, so hiding a button is never the only guard.
- A site with no `MASTER_ADMIN_PASSWORD` says so (`503 MASTER_NOT_SET`) instead of "incorrect password", on both the Admin Login and the unlock.
- `.github/scripts/master-control.mjs` checks all of this in CI.

### 🧭 The admin bar

Every main page (Training Directory, Blueprint, Trainee Monitoring, Attendance, Referrals, System Management) gives a signed-in admin the same top bar, from `PortalNav.adminHtml` in `portal-nav.js`: **Blueprint · System Management · Trainee Monitoring · Attendance · Referrals · Switch view · Logout**. **System Management** (`system.html`, admins only) is the Master Control of the platform: six cards — Access Management (Master Control, Registrations with the waiting count, the admin password check), AI Usage Monitoring, Platform Feedback and Update (feedback from trainees, Broadcast & Ping), Referrals, GitHub and Cloudflare Monitoring, and Blueprint Update / Platform Version Control. **Switch view** shows the Training Directory as a trainee sees it (this tab only); press it again to go back. Trainees get **Home · Blueprint · My Evaluations · Logout** on the Directory (`PortalNav.traineeHtml`). **Home** links go to `/index.html?stay=1`, so a signed-in person reaches the main page instead of being sent on to the Directory. The sign-in pages link back with **← Go to Main Portal**.

## Knowledge Base

**📚 Knowledge Base** is its own site ([LSH-Knowledge-Base](https://github.com/team-litigation-lab/LSH-Knowledge-Base), `https://lsh-knowledge-base.legalsupporthelp.workers.dev/`), the library of SOPs, videos and know-how for all LSH VAs. The Portal links to it from the home page, the Training Directory's menu, Orientation and Master Control, all through `/api/launch?tool=kb`.

- **Trainees** open it from the Portal and are signed in with a short-lived signed ticket (their name and batch from their Portal account). There is no second sign-in and no access code. Any signed-in, approved trainee can open it (no program access to request).
- **Admins** are sent to the site's **Admin Portal** tab and type the admin password there, like on every platform.
- The old Portal page (`/kb.html`, `/kb`) redirects to the new site. Its posts, replies, votes and views were imported into the new site (same D1 tables); the old code was removed.

## ☎ LSH Ring Channel

**☎ LSH Ring Channel** is its own site ([lshringchannel](https://github.com/team-litigation-lab/lshringchannel), `https://lshringchannel.legalsupporthelp.workers.dev/`): the training phone (VOIP in the browser) for trainer-led Reception, Calendar and Intake mock calls.
- The trainer dials the trainee's desk extension and plays the caller.
- Calls are recorded and graded on the program's Mock Calls Metrics.
- Trainees can also practice with an AI caller.

The Portal links to it from the Training Directory's banners, the home page's Simulators, the 🛠 Simulators hub and Master Control's menu, all through `/api/launch?tool=ringchannel`.

Ring Channel has **no sign-in of its own**: everyone opens it from here.
- **Trainees** land on their phone, signed in with the short-lived signed ticket (their name and batch). Any signed-in, approved trainee can open it (no program access to request).
- **🤖 AI calls:** `?to=aicall` lands a trainee on Ring Channel's 🎧 Practice (an AI caller rings them), and `?to=console` lands a trainer on the console, where **🤖 AI caller** on the dialer sends one to a trainee. The 🛠 Simulators hub links both, on the Ring Channel card and the Call Simulator card.
- **Admins** land on its console as trainers, under their Portal name, with a ticket `{ r: 'a', n: name }`. Ring Channel is the only place an admin ticket signs anyone in (`ADMIN_TICKET_TOOLS` in `functions/api/launch.js`); every other platform still asks admins for the admin password.
- **Checking tickets:** Ring Channel checks them with `PORTAL_SSO_SECRET` if it has the secret; otherwise it asks this Portal's `/api/verify-ticket` (which returns the admin's name), like the CMS. Each ticket works there only once.

## 🕘 Attendance (admin)

**Admin → 🕘 Attendance** (`/attendance.html`; linked from Master Control and the Directory's admin bar) is every program's attendance, batch by batch. It shows and edits the same records as each course's own **Admin → 🕘 Attendance** tab (`js/attendance.js`, the same file in every course), so trainers can take attendance in either place.

- **A tab per program**, then a day: today's date in Eastern time (EST, or EDT in summer), ◀ ▶ through the training days, or any date.
- **Each batch** lists its approved, active trainees. Each row has:
  - **Name**;
  - **Training**: the batch's training, as the course picks it. For Foundational, that's the latest lesson opened for the batch (its Open Lessons), else the orientation. For the other courses, it's the day most of the batch is on. It can be changed for the batch or for one trainee;
  - **Time In / Time Out** (Eastern time, typed or ⏱ Now). **Time In fills in on its own:** each course's Worker records it the first time a trainee opens the course that day (`/api/checkin`). It shows marked "auto" until a trainer sets one, and it's saved into the day when a trainer tags that trainee;
  - **Status**, from the attendance sheet's dropdown in its colors. **✓ Mark the rest Present** tags everyone not yet tagged;
  - **Notes**.

  The batch's **Day N** counts its days already logged.
- **Saving:** it saves as you go. The API re-reads the day and writes only the rows changed on screen, so trainers here and in the courses don't overwrite each other. Each row saved here records who saved it (`by`). Preview deployments don't save, since they share the live course data.
- **📊 Summary** per batch (each trainee's count of every status, the last 10 days as colored squares), and **⬇ CSV** for a day or a batch's history.
- **API:** `functions/api/attendance.js` (admin-only), with the shared rules in `functions/_attendance.js`. Records are `<course prefix>attendance:<batch key>:<YYYY-MM-DD>` in the courses' KV (`COURSE_KV`); the automatic Time Ins are `<course prefix>checkin:<YYYY-MM-DD>:<trainee id>` (each trainee's own key, with the time in its KV metadata so one list reads a whole day; kept 40 days). The Training list is each course's lessons, kept in `PROGRAMS` in `functions/_attendance.js`; update it when a course's lessons change. Medsum & Demand has none listed yet, so its Training is free text.

### The attendance Google Sheet

The attendance Google Sheet (linked from the page) gets a **Platform Attendance** tab that stays in step with the platform both ways: every program, one row per trainee per day, newest first, with the status dropdown and colors.

- **Platform → sheet:** `attendance-sync.gs` runs in the sheet (Apps Script). Every 15 minutes it reads `/api/attendance-feed` (`functions/api/attendance-feed.js`: the last 14 days of every program, automatic Time Ins included) with a key, adds new rows and updates changed ones. A row changes only when the platform has a newer update for it. Older days stay in the sheet.
- **Sheet → platform:** an edit to Training, Time In, Time Out, Status or Notes is sent straight away (an installable on-edit trigger → `POST /api/attendance-feed`), and changes only those fields of that trainee's day, recording `by: sheet:<editor>`. A time can be typed as 8:05 AM or 08:05. If an edit can't be sent, the row's **Sync note** says why and the edit stays in the sheet until that day changes on the platform. Date, Day, Program, Batch and Name come from the platform.
- **Set up (once):**
  1. In Cloudflare Pages → this project → **Settings → Variables and Secrets** (Production), add `ATTENDANCE_FEED_KEY` as a secret: a long random string. Redeploy. Until it's set, the feed is off.
  2. In the sheet: **Extensions → Apps Script**. Replace what's there with `attendance-sync.gs` (the page's **📋 Copy the sheet script** button copies it) and save.
  3. Reload the sheet. In the **🕘 Platform Attendance** menu, choose **Set up (feed key)…**, paste the key, and allow the permissions Google asks for. It syncs straight away, then every 15 minutes, and sends edits as they're made. **Sync now** syncs any time; **Turn off auto-sync** stops both directions.
- Each sync reads the courses' KV: per program, a list of its attendance keys and one of its automatic Time Ins, plus one read per batch per day in the window. The feed key can also write attendance (the sheet's edits), so keep it to the sheet.

## Trainee Progress & Feedback (admin)

**Admin → 📊 Progress & Feedback** (`/progress.html`, also linked from Master Control) is the central record of every trainee's training.

**A tab per program:** Standard Foundational Training, EA / PA Training, CM Training and PD Claims Training. Each tab loads only its own program, so one request's KV reads go to one program.

**👤 Trainees**, grouped into 📁 batch sections (count, average completion, last activity). For each trainee:
- status and days completed;
- Knowledge Check, practice (Skill Builder / Practice Lab) and random-task averages;
- the trainer's feedback: how many days were sent, drafts still to review, and the latest rating;
- the feedback they sent about the training (count and average stars);
- simulator practice and graded activities from this portal;
- when they were last active.

Click a trainee for everything on record: the day-by-day grid, every day's trainer feedback (rating, summary, strengths, areas to build, next focus, sent/read status and the private trainer note), their own feedback, simulator runs and portal activities with the grader's comments. Filter by status, sort (including "furthest behind" and "feedback drafts to review"), search, and **⬇ CSV** for the program.

**📦 Archive batch** hides a finished batch and keeps its records:
- It sets `archived: true` on the batch's trainee records in the course (the same flag the course's own "Archive batch" sets), and saves a snapshot of the batch (days, scores, trainer feedback) in D1 (`progress_archive`, created on first use).
- Archived trainees' trainer feedback isn't re-read from KV on later loads, so old batches stop using the read budget.
- **Archived batches** at the bottom of the tab: **Open** shows a snapshot, **↩ Restore** makes the batch active again here and in the course. Batches archived in the course show up there too.
- Pages preview deployments share the live bindings, so archiving is turned off on them.

**💬 Feedback from trainees**: what trainees sent about the program (star ratings by area and comments; anonymous ones stay anonymous), with average ratings by area, filters by day and status, search and CSV.

### Saving archived batches to Google Drive

With these set, archiving a batch also saves it (a CSV report and the full JSON snapshot) to `LSH Training Archives / <Program> / Batch <batch>` on a Shared Drive, and the archived batch links to its folder. **☁ Save to Drive** saves a batch archived before Drive was set up, or retries one that failed. A Drive problem never stops the archive itself.

1. In Google Cloud (any project): **IAM & Admin → Service Accounts → Create**, then **Keys → Add key → JSON**. Enable the **Google Drive API** for the project.
2. In Google Drive, use a **Shared Drive** (service accounts have no storage, so a folder in someone's My Drive won't work). Add the service account's email as a member with **Content manager**.
3. In Cloudflare Pages → this project → **Settings → Variables and Secrets** (Production), add as secrets:
   - `GDRIVE_SA_EMAIL`: the `client_email` from the JSON key
   - `GDRIVE_SA_KEY`: the `private_key` from the JSON key (the whole `-----BEGIN PRIVATE KEY-----…` value)
   - `GDRIVE_ARCHIVE_FOLDER`: the Shared Drive's id (or a folder in it), the last part of its URL
4. Redeploy. The page shows **☁ Save to Drive** on archived batches once Drive is set up.

Where the records come from:
- The programs keep their own trainees and sign-in. The portal reads their records from the course Workers' KV namespace through the `COURSE_KV` binding in `wrangler.toml`, which points at the same namespace as the courses' `LSH_KV`. EA/PA keys have no prefix (`trainee:*`, `feedback:*`, `tfeedback:*`); CM course keys start with `cm:`, PD Claims Training keys with `pd:`, Medsum & Demand Training keys with `md:`, Standard Foundational Training keys with `ft:`.
- Simulator results (`simulator_results`), portal activities (`submissions`) and archive snapshots (`progress_archive`) are in this portal's D1 database.
- Simulator and activity records are matched to trainees by name, because the programs have separate sign-ins.

The API (`/api/program-progress`) is admin-only. It writes only to archive and restore batches; feedback is written and marked reviewed in each course. It stays under Workers KV's 1,000-operations-per-request limit and says so on the page if a very large program doesn't fit. To add a program, add it to `PROGRAMS` in `functions/api/program-progress.js` with its key prefix, number of days and course address, and to `PROGRAM_ORDER` in `progress-records.js`.

## 📉 Server requests (every LSH site shares one monthly allowance)

Every request that runs a Pages Function counts toward the Cloudflare account's monthly requests, shared by every LSH site (the courses, the CMS, this portal, Ring Channel, the Knowledge Base): 10 million a billing month on the Workers Paid plan, then charged. So open pages ask sparingly:

| What | How often | Before |
|---|---|---|
| The lock and pause, the alert and new pings: **one** request, `/api/live` (`functions/api/live.js`, `pollLive` in `portal.js`) | every 20 s; 60 s in a background tab; at once when the tab comes back | three requests (`/api/site-state`, `/api/alert`, `/api/pings`) every 3 s |
| Heartbeat (`app.js`; the server allows 90 s between beats) | every 30 s, and when the tab comes back | every 2 s |
| Progress and the leaderboard | once a minute, only on a page that shows them, only while it's in view | every 15 s on every signed-in page |

About 98 requests a minute per signed-in tab became about 5. Pings are read from where the last one left off, so a slower check misses none. `/api/site-state`, `/api/alert` and `/api/pings` still answer on their own (Master Control uses them right after a change).

## Checks and uptime alerts (GitHub Actions)

**Checks** (`.github/workflows/checks.yml`) runs on every pull request and every push to `main`. A red status means something is broken, and the log says what:
- **Syntax, files and build:**
  - every JavaScript file and inline `<script>` must parse;
  - every local file a page loads must exist;
  - JSON must be valid;
  - the Pages Functions must build (nothing is deployed).
- **Server requests** (`.github/scripts/requests.cjs`): a signed-in page asks `/api/live` once on load and every 20 s, never `/api/site-state`, `/api/alert` or `/api/pings` on their own; a heartbeat every 30 s; progress once a minute; nothing in a background tab and both at once on coming back; the lock screen, the alert and a new ping from `/api/live` are shown, and the next check asks for pings since the last one; signed out, no pings are asked.
- **Smoke test in a browser:** opens every portal page and simulator at desktop and phone width (API calls answered with empty data). It fails on any page error or a page that scrolls sideways on a phone. New simulator pages go in `PAGES` in `.github/scripts/smoke.cjs`.

**Uptime** (`.github/workflows/uptime.yml`) checks every 30 minutes (at :07 and :37):
- the live portal, including its database (`/api/site-state`) and the Docket simulator;
- the CM, EA/PA and PD Claims courses;
- the CMS, including its database (`/api/state`).

Each failing check is retried once after 20 seconds.
- **When a site is down,** it opens an issue labelled **site-down** with a table of what failed, or adds a comment if one is already open. GitHub notifies everyone watching this repository: watch it with **Watch → All activity** or **Custom → Issues** to get the emails.
- **When everything passes again,** it closes the issue.
- **To run it now:** Actions → Uptime → Run workflow.
- **To add or change a site:** edit `.github/scripts/uptime.mjs`.

GitHub pauses scheduled workflows after 60 days without a commit to the repository. The Actions tab shows a button to turn it back on.

To run the checks locally: `node .github/scripts/check-site.mjs`, `node .github/scripts/smoke.cjs`, `node .github/scripts/requests.cjs` (need Playwright), `node .github/scripts/uptime.mjs`.

`_redirects` keeps `wrangler.toml`, the Markdown files, `topics_seed.sql`, `.github/` and the Functions source off the published site.

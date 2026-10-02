# cm-training-activity

## Trainee sign-in on the Main Portal (single sign-in)

Trainees log in once, here, and open each training program from the Training Directory. They aren't asked to sign in again inside the program.

- **Register:** `/registration.html` (Trainee is the default type). An admin approves the account and assigns the Batch ID, as for admins. **Log in:** `/trainee-login.html` with the username and password they registered with (`/api/login`, `portalMode: "Trainee"`). A name alone no longer works. Admins still use `/admin-login.html`; an admin account used on the trainee form is told to use the Admin Portal.
- **Open a program:** `/programs.html`. For a trainee whose access to the program is approved, the card's **Enter Program** goes to `/api/launch?program=<topic key>` (`functions/api/launch.js`), which checks the portal session and the approved access, then redirects to the program with a signed ticket (`?ticket=…`). The ticket carries the account's first name, last name and Batch ID, and is good for 5 minutes. Visitors who aren't logged in see **Log in to open** on those cards. Admins go through the same launch step: they signed in here with their admin password, so the program signs them in as an admin from an admin ticket (`{r: 'a', exp}`) and doesn't ask for the password again. Only someone who opens a program's own link directly is asked for it.
- **Which programs:** `SSO_PROGRAMS` in `programs.html` and `SSO_PROGRAMS` in `functions/api/launch.js` (keep them the same). Today **every program** (Standard Foundational Training, EA / PA, CM, PD Claims and Medsum & Demand) accepts tickets; the other programs still open directly and keep their own sign-in until they get the same change (`js/portal-gate.js` and the Worker endpoints in the Foundational-Training repo).
- **Secret:** `PORTAL_SSO_SECRET` (Pages → Settings → Variables and Secrets, as a secret) must be the same value as the program's. Without it `/api/launch` answers "Not available yet". The ticket is `base64url(JSON {first, last, b, exp})` + `.` + `base64url(HMAC-SHA256(key = "portal-sso:" + secret, message = that text))`.
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

## 🧭 Orientation

**`/orientation.html`** is the Platform Orientation for the portal: a slide deck made for screen sharing in Google Meet. It shows nothing private: no passwords, access codes or trainee data.

It has two tracks, switched at the top of the page:
- **Trainees** (8 slides): what the portal is, the Training Directory, signing in inside each program, what's inside a program, the Simulators, the Knowledge Base, good habits, and first steps.
- **Trainers & Admins** (8 slides): admin sign-in, the Directory's admin view (access queue, Mark Passed, Manually Grant Access), Master Control (monitoring, Broadcast & Ping, Access Control, activities and grading), Progress & Feedback, program admin, Knowledge Base review and simulator scores, and a daily checklist.

How to use it:
- Keys: ← → (or Page Up / Page Down / Space) change slides, and **F** toggles full screen.
- **🖨 Print** prints the current track, one slide per page (or saves it as a PDF).
- Deep links: `?track=admin&slide=3`.
- Links to it: **Orientation** in the home page menu, and **🧭 Orientation** in the Training Directory's top bar. Signed-in admins get the admin track.

To change the content, edit `SLIDES` in `orientation.html`.

## Knowledge Base

**📚 Knowledge Base** (`/kb.html`; linked from the home page, the Training Directory and Master Control) is where LSH VAs find the firm's official SOPs and resources and share their own know-how, separate from the course lessons.

**Who can open it.** It's for the team only:
- VAs enter the **team access code** with their name (and batch). The browser then stays signed in for 30 days.
- Signed-in admins get in without the code.
- An admin sets the code, and changes it, under **🛡 Review & settings → Team access code**. Changing the code signs everyone out. Until a code is set, VAs see "not open yet".
- 10 wrong tries per connection per 10 minutes, then a wait.

**What's in it.**
- **Official SOPs and resources** (marked *Official*): Markdown pages in `kb-files/sops/`, each with its original PDF or Word file for download. `kb-files/` is only served to readers with access (`functions/kb-files/[[path]].js`), so a direct link doesn't work without the code.
- **From the team**: tips, how-to guides, checklists, templates, lessons learned and questions written by VAs, with simple formatting (headings, lists, checklists, tables, links; `kb-md.js` escapes everything else, so a post can't run code on the page). Posts can link to a file, e.g. on Google Drive.
- Readers can search everything, filter by source, category and type, and sort by most helpful or most viewed. They can mark things 👍 Helpful and add their own experience as a reply. The sidebar shows the top contributors.

**Contributors and profiles.**
- **👤 My Profile**: each contributor can add a photo (resized to a small square), role or job title, team, years of experience, areas of expertise (the Knowledge Base categories), skills and tools, a short "about me" and a LinkedIn link.
- Profiles appear on their posts, in the **Top Contributors** sidebar and in the **👥 Contributors** directory (search by name, role or skill; filter by expertise). Each profile page lists their posts, helpful votes and what they were credited on.
- Posts have a **Contributors** field to credit teammates who helped write them. SOP pages can list `contributors:` in their header. Credited names link to their profiles.
- VAs sign in with only the team code and a name, so a VA's new profile or change waits for an admin, and the approved version stays visible until then. This way no one can change someone else's profile by signing in under their name. Admins' changes apply straight away. Admins can also edit or hide any profile.

**Review.** Every VA post, reply and profile change waits for an admin. In **🛡 Review & settings** an admin can:
- approve a post, or send it back with a note (the author sees it under **📂 My posts**, edits and resends it);
- feature, hide, edit or delete posts;
- approve or remove replies.

Admins' own posts and replies are published straight away.

**Adding official SOPs.**
1. Put `your-sop.md` (and its original file) in `kb-files/sops/`. The page starts with a short header (title, category, type, summary, tags, owner, version, updated, file); see `kb-files/build_library.py` or the example `using-the-knowledge-base.md`.
2. Run `python3 kb-files/build_library.py`. It checks every header and rebuilds `kb-files/library.json`, which holds the search text.
3. Commit and push.

**Data** (D1 `TRAINING_DB`, created on first use): `kb_articles`, `kb_comments`, `kb_profiles`, `kb_stats` (views, helpful), `kb_votes`, `kb_settings` (the code's hash and version), `kb_rate`. Code: `functions/_kb.js`, `functions/api/kb/`, `kb.html`, `kb.js`, `kb-md.js`.

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

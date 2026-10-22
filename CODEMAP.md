# Code map — LSH Training Portal

An inventory of every code file in this repository: what each one is for, at a glance.
Produced by the October 2026 full-repo audit (nine area reviews plus adversarial verification).
Line counts are refreshed by the weekly code inventory and are current as of 2026-10-16; the
descriptions are from the audit and are not re-verified by that refresh. The living feature docs are README.md and SIMULATORS.md —
this map answers "what is this file?", those answer "how does the feature work?".

## Public entry pages

The landing page, sign-in, registration, claim and referral pages, and their shared chrome.

| File | Lines | What it is |
|---|---|---|
| `_redirects` | 16 | Cloudflare Pages redirects: keeps repo files (wrangler.toml, *.md, topics_seed.sql, .github/, functions/) off the published site, forwards old KB URLs through /api/launch?tool=kb SSO (kb target exists in functions/api/launch.js), and bridges retired /bridge.html to /programs.html. |
| `auth.css` | 183 | Shared chrome of the two sign-in pages (split card, visual panel, form styles), extracted from the byte-identical blocks trainee-login.html and admin-login.html carried; registration.html keeps its own tuned variant. |
| `admin-login.html` | 97 | Admin sign-in page; during a site-wide lock portal.js swaps the login form for the Master-Account unlock form (admin-unlock-content); loads show-password.js. |
| `index.html` | 1052 | Public landing page: hero, team org chart, about/mission/values, FAQ, footer, the nav's 🧭 Blueprint menu (the Platform Blueprint, plus every program's and tool's own deck for a signed-in admin), plus the 'Got a referral?' modal that posts multipart form data to /api/referrals. |
| `referrals.html` | 163 | Admin-only referrals manager over /api/referrals: list/filter/search, status + admin note (PATCH), CV download (?cv=id), CSV export with formula-injection quoting, delete. |
| `registration.html` | 211 | New-account request form (Trainee/Admin) handled by portal.js submitRegistration() → POST /api/register; lock-aware via AUTH_PAGE_TYPE='registration'. |
| `show-password.js` | 37 | Injects a Show/Hide toggle into every password input, including ones added later, via a MutationObserver; loaded only by admin-login.html (per its own 'admin pages' comment). |
| `styles.css` | 512 | Shared app-shell stylesheet for core.html (sidebar, classification bar, modals, Master Control, lock/pause/alert overlays, toasts, auth gate); also loaded by the auth pages, which deliberately override its body height:100vh/overflow:hidden. |
| `theme.css` | 372 | The standard page style, loaded last on every page: the navy/orange gradients, the shared photo backdrop (now the default `body` background — `--portal-photo`/`--portal-wash`/`--portal-base` per page, `.portal-bg-dark` for white-copy pages, `.no-portal-bg` to opt out) and the translucent card surfaces that let it read through. See "The standard page style" in README.md. |
| `trainee-login.html` | 86 | Trainee sign-in page; wires portal.js attemptLogin() with currentPortalMode='Trainee' and is lock-aware via AUTH_PAGE_TYPE='trainee-login'. |

## Portal pages and shared scripts

The signed-in portal: Training Directory, dashboard, progress, attendance, orientation, simulators hub, and the shared runtime scripts.

| File | Lines | What it is |
|---|---|---|
| `app.js` | 2919 | Core dashboard script: session/heartbeat, view switching, Master Control (users, registrations, logs, monitoring, program access), activities/lectures/submissions CRUD, grading, PDF reports, leaderboard/progress, toasts, celebration. |
| `attendance.html` | 365 | The one place attendance is taken — admin attendance per program/batch/day: debounced autosave with retry, batch summaries, CSV export, Google Sheet sync setup helper. The courses' own Admin → 🕘 Attendance tabs were removed in favour of this page. |
| `core.html` | 1062 | Admin dashboard (CM Training workspace + Master Control): sidebars, views, modals, overlays (pause/alert/lock), deck/lecture viewer panes, hash deep links into Master Control tabs. |
| `blueprint.html` | 328 | Platform Blueprint: the two tracks, with the deck itself drawn by `lsh-blueprint.js` (the shared Blueprint engine) — the former Platform Orientation. |
| `orientation.html` | 15 | Stub pointing the old Orientation URL at /blueprint.html. |
| `system.html` | 120 | System Management page (admin). |
| `portal-nav.js` | 166 | Shared nav: PortalNav.html/adminHtml top bars, System Management menu, trainee-view switch, logout, injected styles, floating Back-button safety net. |
| `portal.js` | 835 | Public-portal runtime: registration/login, password validation, input filters, sound engine, full-screen alert, site lock/pause UI, pings, and the consolidated /api/live poller. |
| `programs.html` | 682 | Training Directory: grouped program cards with access request/approve flow, SSO launch wake-up, admin queue, client-side certificate PDF. |
| `progress.html` | 136 | Admin Trainee Progress & Feedback shell: admin gate, styles and hero; all rendering lives in progress-records.js. |
| `simulators.html` | 108 | Simulators hub: card grid from the SIMULATORS array plus recent results table (admin sees all trainees). |

## Data and deck scripts

Standalone data/deck modules and repo-level config.

| File | Lines | What it is |
|---|---|---|
| `README.md` | 306 | Full operator/developer documentation: SSO sign-in, email replies, simulators, referrals, orientation, admin bar, KB, Ring Channel, attendance (+Google Sheet), progress & feedback, Drive archiving, request budget, CI checks and uptime. |
| `SIMULATORS.md` | 102 | Simulator ownership/status table for parallel Claude chats, plus shared conventions (sim.js session handling, AI gateway, styles, navigation rules, smoke-test registration). |
| `attendance-sync.gs` | 236 | Google Apps Script pasted into the attendance spreadsheet: two-way sync between the 'Platform Attendance' tab and /api/attendance-feed (15-minute pull, installable on-edit push of Training/Time In/Time Out/Status/Notes). |
| `lsh-blueprint.js` | 519 | Shared LSH Blueprint slide-deck engine (trainee/trainer/admin decks from window.LSH_BLUEPRINT), with keyboard nav, screenshot zoom, auto-fit scaling, and a jsPDF-based real-text PDF export. |
| `progress-records.js` | 404 | Browser script for /progress.html: admin Trainee Progress & Feedback — per-program tabs, batch-grouped trainee table with detail rows, archived batches (open/restore/Save to Drive), trainee feedback pane, CSV exports, all against /api/program-progress. |
| `topics_seed.sql` | 23 | Seed INSERT for the D1 `topics` table: 22 training/reference topic keys with display names and sort_order. |
| `wrangler.toml` | 22 | Cloudflare Pages config: output dir = repo root, two D1 bindings (DB, TRAINING_DB) and the read-only COURSE_KV namespace for course progress. |

## Google Calendar Simulator

The Google Calendar look-alike, its data, the trainer review and the trainee evaluations.

| File | Lines | What it is |
|---|---|---|
| `simulators/cal-scorecard.js` | 75 | The CALENDAR MANAGEMENT MOCK CALL scorecard: the 7 weighted metrics, sheet and form HTML, read/validate and live weighted average; window.CalScorecard + CommonJS export for the server-side metric check. |
| `simulators/eval-report.js` | 53 | Shared EvalReport module: renders a finalized calendar evaluation as HTML and as a jsPDF download, plus shared esc/when/css used by my-evaluations.html and the simulator's panel. |
| `simulators/gcal-data.js` | 445 | Per-track data: the attorney's/executive's weekly schedule rows, Google colors, calendars, holidays, caller requests, rules, request types and GCAL_CFG for standard/cm/ea tracks. |
| `simulators/gcal-review.html` | 450 | Trainee Evaluations (trainers): live list of submissions, the submitted calendar week view, automated check, AI review, trainer feedback with autosave, finalize/reopen, and per-track AI-review rules. |
| `simulators/gcal.html` | 362 | The simulator page shell: Google-Calendar-look CSS, hero/intro, script includes (jsPDF, sim.js, eval-report.js, gcal-data.js, cal-scorecard.js, gcal.js). |
| `simulators/gcal.js` | 1591 | The Google Calendar Simulator: calendar views, event CRUD/drag, the attorney's rules engine (slotProblems/solve/checkPlan/checkOpen), cloud drafts, submit-for-evaluation, trainer review/live-view modes, and the window.GCAL test API. |
| `simulators/my-evaluations.html` | 131 | The trainee's My Evaluations page: drafts in progress per track, submitted calendars with status polling, and the final report view/PDF via EvalReport. |
| `simulators/trainees-calendars.js` | 65 | The 👥 Your trainees' calendars table on gcal-review.html: everyone with a saved draft or scorecard per track, with View & score links and search; TraineesCalendars.load/repaint API plus the legacy window.csFind shim. |

## Calendaring Simulators hub and scheduler

The hub page, the older drag-and-drop scheduler, the call entry page and the shared sim chrome.

| File | Lines | What it is |
|---|---|---|
| `simulators/calendar.html` | 299 | 'Conflicts week' Calendaring simulator: two self-contained scenarios (CM litigation week, EA/PA executive week) rendered as a read/edit week grid; rule-based checkPlan() scoring, Gemini coach feedback via Sim.ai, results via Sim.saveResult. |
| `simulators/call.html` | 19 | Thin redirect stub: forwards to /api/launch?tool=ringchannel&to=calls carrying the query string, so the Call Simulator opens on LSH Ring Channel through the Portal's sign-in. |
| `simulators/calsim-core.js` | 195 | Pure data + logic for the drag-and-drop scheduler: TRACKS (standard/litigation/executive), four SCENARIOS (fixed events, weighted tasks with rules), event sanitizer clean(), word-match task pairing, and the automated review() scored out of 100 (PASS 80). Node-loadable (module.exports) for tests. |
| `simulators/calsim.html` | 157 | Calendaring Simulators hub page: cards for the three Google Calendar tracks (standard/cm/ea), mock-call links via call.html, trainee review summaries, and the admin ?view=scores view (gsList of gcal submissions + the legacy drag-and-drop scheduler scores via calsim.js). |
| `simulators/calsim.js` | 506 | The earlier drag-and-drop weekly scheduler (Google Calendar style): trainee grid editor with pointer/keyboard drag, autosave to /api/calsim, automated review via FTCalCore, submissions, and the trainer's per-submission feedback UI (FTCalAdmin). Only used from calsim.html?view=scores now (per the page's own comment). |
| `simulators/legal-sim.css` | 155 | Shared styles for the legal-work simulators: common form/tab primitives (lx-/dk-), Docket System, Medical Records Requests and Court E-Filing sections. Linked only by docket.html, records.html and efiling.html. |
| `simulators/sim.css` | 52 | Shared simulator look: tokens, top bar, hero, cards, buttons, chips, tables, score pills, the 'who's practicing' dialog, and phone-width rules. |
| `simulators/sim.js` | 186 | Shared simulator helpers (global Sim object): esc, session restore/heartbeat re-seed (restore, fetchRetry), 'who's practicing' identity (who/setWho/fromQuery/claim with LSH_SIM_USER browser hand-off), topbar, Gemini proxy Sim.ai, and result saving (saveResult/results). |

## Office simulators

Docket, e-filing, records, email simulators and their data.

| File | Lines | What it is |
|---|---|---|
| `simulators/cm-case.js` | 6 | Sets window.CM_CASE_SUMMARY, the John Doe v. Apex case snapshot shown as a collapsible case file in email-replies.html for caseFile scenarios. |
| `simulators/docket-data.js` | 149 | Docket data: DK_ATTORNEYS, DK_ENTRY_TYPES, 7 cases (harlow, doe + 5 prototype cases) and 2 docketing assignments (federal Harlow, CM John Doe). |
| `simulators/docket.html` | 35 | Shell page for the Docket System simulator; loads sim shell plus legal-rules.js, docket-data.js, docket.js. |
| `simulators/docket.js` | 293 | Docket System simulator: docketing inbox with graded assignments, federal-style court records, firm calendar with .ics export, CSV export, and a rules-based deadline calculator (locked until the assignment is checked); state in localStorage (LSH_DOCKET_V1). |
| `simulators/efiling-data.js` | 50 | E-Filing scenario data: EF_LIMIT_MB (35), attachment types, and 3 scenarios (federal opposition, state amended complaint, state new case) with document folders carrying the planted defects. |
| `simulators/efiling.html` | 35 | Shell page for the Court E-Filing simulator; loads sim shell + efiling-data.js + efiling.js. |
| `simulators/efiling.js` | 331 | Court E-Filing simulator: federal CM/ECF-style and state EFSP-style wizards, a filing folder with inspect/fix tools (OCR, /s/, COS, redaction, split, unlock), fee/payment steps, grading, NEF/envelope receipts and clerk review; state in localStorage (LSH_EFILING_V1). |
| `simulators/email-packs.js` | 309 | Built-in Email Workspace packs: EMAIL_PACKS.cm (Case Management, 10 emails) and EMAIL_PACKS.ea (EA/PA, 10 emails), each with labels, decisions, one+ phishing emails with redFlags. |
| `simulators/email-replies.html` | 244 | Self-contained Email Replies simulator (all JS inline): one scenario email at a time from reply-packs/emails.json, answered on the page or delivered to the trainee's real inbox via /api/email-practice (Postmark, polled by token), with an AI-scored debrief per reply. |
| `simulators/email.html` | 150 | Shell page for the Email Workspace simulator with a large inline Gmail-look stylesheet; loads sim shell + email-packs.js + email.js. |
| `simulators/email.js` | 418 | Email Workspace: Gmail-style inbox with folders, nested labels, keyboard shortcuts, one-decision-per-email triage, phishing traps (link click / sensitive reply = instant fail), AI-generated inboxes for any program, and 4-part grading (filing, security, triage, AI-graded replies); per-person localStorage key. |
| `simulators/legal-rules.js` | 86 | LR: court deadline math shared by the Docket and Medical Records simulators — UTC date helpers, 2026–early-2028 federal holiday table, FRCP-6 and training-state counting methods, RULES library and compute() with step-by-step explanations. |
| `simulators/records-data.js` | 234 | Records scenario data: MR_CLOCK (the collection opens on the current system date, rolled to an open day; the attorney's date 29 business days out; a whole-week shift that moves the case file with it, or 0 under ?anchor=authored), MR_CASE (every clinical date as authored) and MR_D (the shift and the ways the prose says a date) — the brief, intake list, chart and bill prose, bill line dates and planted findings are all built from them; plus the John Doe scenario, MR_TYPES, 14 providers (incl. hidden anes/river, prior whc/mig, decoy derm/pharm) and MR_FINDINGS (6 real problems + 3 decoys). Each bill a provider produces carries its itemized `lines` (date of service, CPT code, description, charge), totalling to the figure the delivery states. |
| `simulators/records-docs.js` | 286 | What a produced records request is, and where it goes: builds the provider's certified records production and its itemized billing statement from the delivery (identifiers, dates of service, chart entries, CPT-coded lines and total, custodian certification), renders it on paper, saves it as a real PDF (jsPDF) named in the CMS's convention `<Case ID>_<Last-First>_<Type>_<YYYY-MM-DD>.pdf`, reads the platform the trainee came from (`?from=`/`?program=`/`?case=`), and files the PDF into that case through the CMS's own `cms-doc-file` protocol. |
| `simulators/drafting-docs.js` | 286 | Filing a drafted letter into the case file, and the grade for it: the Doc Hub tab the firm keeps each drafted letter in (1P/3P LOR and Lien Balance Verification under Others, Medical LOR and HITECH request under Medical Records), the firm's file name `<Case ID>_<Last-First>_<Type>_<YYYY-MM-DD>.pdf` (the same name `records-docs.js` produces, guarded against drift by its test), the letter as paper and as a real PDF (jsPDF) for ⬇ Download PDF, the destination read from `?from=`/`?program=`/`?case=`, the upload itself through the CMS's own `cms-doc-file` protocol — the tab checked here before anything is sent, the name checked by the CMS — and the score for what the filing took to get right, saved through `Sim.saveResult`. The shared drafting tool that will use it is not built yet. |
| `simulators/drafting-docx.js` | 593 | The Drafting tool's .docx layer: `fill` (the sketch's blanks into the highlighted runs), and for the editor `editMap` / `markEditXml` (bookmark markers naming every editable paragraph, text run and check box) and `applyEditsXml` (the trainee's edits written into the same document.xml run by run: untouched runs byte-for-byte, changed ones keep their rPr plus only what changed, in Word's property order; new and deleted paragraphs; section breaks and table cells kept; check boxes; bullets, numbering (each list from 1), indents and spacing), `pack` adding the editor's list definitions to numbering.xml only when used, `auditXml`, `pack`. |
| `simulators/drafting-editor.js` | 1086 | The Drafting tool's Word-style editor: the firm's .docx drawn by docx-preview with the whole letter editable, Word's ribbon (File · Home · Insert · Review · View: Paste with Word's Paste Options (Keep Source / Merge / Text Only, lists come in as lists), bullets, numbering, indents, line and paragraph spacing (written to the paragraph's pPr and drawn again from it), font, size, B/I/U/S, font colour, highlighter with No Color, alignment, Clear Formatting, Find & Replace, Symbol, Date, ¶ Show/Hide, zoom), Word's keys, its own undo (node copies, across redraws), Word's pages (the sheet cut at the bottom margin with the letterhead and footer on every page, lines carried over with widow/orphan control, Word's line heights), legacy check boxes, and `xml()`: the screen read back (text, formatting as displayed, alignment, paragraphs added or deleted) into an edit for `applyEditsXml`. |
| `simulators/records.html` | 37 | Shell page for the Medical Records Requests simulator; loads sim shell + jsPDF + legal-rules.js + records-data.js + records-docs.js + records.js. |
| `simulators/records.js` | 487 | Medical Records Requests simulator: a clock that tracks the system date (catching up when a collection is reopened later) and same-day receipt on by default (everything the provider's side and the client send arrives the same day, by the same rules; the firm's own deadlines stay real business days and scoring reads the order of the authorization rather than its date); HIPAA authorization review/e-signature, provider request engine with a business-day clock (LR.add/closed), acknowledgments/rejections/invoices vs the state fee cap, follow-ups, delivered records to review/flag/log, 100-point scoring; state in localStorage (LSH_RECORDS_V1). Each delivery is a real document (records-docs.js): open it on paper, download the PDF, or file it into the case file on the platform the trainee came from; the Case File tab names that destination, takes the Case ID and lists every document produced. |
| `simulators/reply-packs/emails.json` | 247 | Email Replies scenarios: 10 emails (8 CM on the John Doe file + 2 all-program, incl. a wire-instructions phish), each with role, facts, grading goals and optional caseFile flag. |

## API: sessions, users and site state

Login/session plumbing, user management, site lock/pause/alert, logs and monitoring.

| File | Lines | What it is |
|---|---|---|
| `functions/_middleware.js` | 91 | Pages middleware: front-door redirect for signed-in people, server-side gating of admin pages and /simulators/*, call-sim redirect to CMS launch. |
| `functions/_sim-guard.js` | 56 | Guard for simulator endpoints: requires a Portal session, site-lock check, same-origin check, per-IP rate limit; plus publicIdentity() for self-reported names. |
| `functions/_utils.js` | 510 | Shared helpers: json(), HMAC session tokens/cookies, heartbeat liveness, requireSession, site state, Master Account credentials, password hashing/normalizing, login throttle, batch IDs, tombstones, activity log, Gemini AI review. |
| `functions/access-control.js` | 168 | Server-rendered admin-only Pause/Lock page (HTML inlined in the Function so non-admins never receive the markup). |
| `functions/api/admin-password-check.js` | 87 | Admin-only GET/POST page that tests the typed admin password against every platform's admin sign-in. |
| `functions/api/alert.js` | 73 | GET active alert (public); POST set / DELETE stop an alert (admin), logged to env.DB activity_log. |
| `functions/api/announcement.js` | 60 | GET public announcement ticker text; POST/DELETE set or clear it (admin), stored in TRAINING_DB site_settings. |
| `functions/api/create-user.js` | 111 | POST /api/create-user (admin): a trainer makes an account for someone — same checks as registration, creates a Pending users row for an administrator to approve. |
| `functions/api/heartbeat.js` | 62 | GET who's-online list (admin); POST session heartbeat upsert with lighter-than-requireSession checks. |
| `functions/api/launch.js` | 176 | GET /api/launch: opens a program or tool for the signed-in person with a short-lived signed SSO ticket (trainee/admin/system variants), plus landing/?to= routing, callsQuery and messagesQuery (the CMS's 💬 Client Messaging). |
| `functions/api/live.js` | 22 | GET /api/live: one-request aggregation of site-state, alert and pings for every open page's 20s poll. |
| `functions/api/login.js` | 133 | POST /api/login for Trainee and Admin portals: password verify, legacy-hash upgrade, throttle, master-account path, status checks, session cookie + heartbeat seed. |
| `functions/api/logout.js` | 25 | POST /api/logout: logs the logout, deletes the heartbeat row, clears the cookie; deliberately skips requireSession. |
| `functions/api/me.js` | 19 | GET /api/me: who is signed in on this browser, restarts the heartbeat; special-cases the Master Account. |
| `functions/api/pings.js` | 68 | GET new pings for the signed-in user (poll with ?since); POST send a ping to all or named users (admin). |
| `functions/api/register.js` | 79 | POST /api/register: public self-registration, creates a Pending users row after field/password/tombstone checks. |
| `functions/api/revoke-user.js` | 47 | POST /api/revoke-user (admin): permanent revocation — tombstone, delete row, clear heartbeat and program access. |
| `functions/api/server-logs.js` | 45 | GET /api/server-logs (admin): the accounts DB's activity_log newest-first, with per-logout session duration computed from login pairs. |
| `functions/api/site-state.js` | 131 | GET public lock/pause state (+pause message); POST LOCK/UNLOCK/PAUSE/RESUME with master-credential re-verification. |
| `functions/api/sso-check.js` | 52 | Admin-only GET page that signs a test ticket and tries it on every program's /api/auth/portal. |
| `functions/api/ticket-login.js` | 45 | POST /api/ticket-login: signs a trainee in to the Portal from a course's signed ticket, so a simulator a course opens doesn't ask them to log in again — the same step _middleware.js does for a page's own ?ticket=. |
| `functions/api/update-access.js` | 42 | POST /api/update-access (admin): Suspend / Reactivate an approved account. |
| `functions/api/update-status.js` | 40 | POST /api/update-status (admin): Approve / Reject a pending registration, assigning a Batch ID on approval; an Admin / Trainer registration is the Master Account's to decide. |
| `functions/api/update-user.js` | 80 | POST /api/update-user (admin): edit batch/name/email/username/password; moves username-keyed data across TRAINING_DB tables and kills open sessions. |
| `functions/api/users.js` | 32 | GET /api/users (admin): all accounts without passwords, with formatted names. |
| `functions/api/verify-ticket.js` | 42 | POST /api/verify-ticket: verifies a Portal SSO ticket for sites that don't hold the shared secret (CMS, Ring Channel fallback). |

## API: simulators, progress and AI

Simulator results and reviews, program progress, attendance, the AI gateway and its budgets.

| File | Lines | What it is |
|---|---|---|
| `functions/_ai-gateway.js` | 265 | Shared AI gateway core: Gemini key pool with per-model resting, US relay, model fallback, live-token minting, and the D1 usage ledger/budget (admit/record/usageSummary/runAi/runLiveToken). |
| `functions/_attendance.js` | 151 | Attendance shared logic: PROGRAMS/lesson lists, batch-key slug rules matching the course Workers, budgeted KV reader (makeKv), check-in reads, field validation and saveRows merge-write. |
| `functions/_drive.js` | 89 | Google Drive service-account client for batch archives: JWT sign-in, folder/upload helpers, batchCsv and saveBatchToDrive. |
| `functions/_email.js` | 20 | Email Replies shared bits: deliveryConfigured(env) and the email_practice D1 table DDL. |
| `functions/api/activities-archive.js` | 15 | Admin-only list of archived activities. |
| `functions/api/activities.js` | 275 | Activities CRUD/lifecycle for admins (create/update/questions/publish/unpublish/close, lazy deadline close) and the trainee view with answer keys stripped; DELETE archives to activities_archive. |
| `functions/api/activity-logs.js` | 33 | Admin-only filtered view of activity_log (4 action kinds, optional LIKE search, latest 100). |
| `functions/api/ai-gateway.js` | 40 | Routed AI gateway for the CMS and course Workers: X-Gateway-Key (constant-time) → runAi/runLiveToken; GET is the admin usage summary. |
| `functions/api/ai-review.js` | 38 | Admin re-run of a submission's AI review via _utils.generateAiReview (same call submissions.js fires on submit). |
| `functions/api/ai-usage.js` | 29 | Admin-only server-rendered HTML page of today's shared AI budget per call flow, from usageSummary. |
| `functions/api/attendance-feed.js` | 86 | Google Sheet sync endpoint (Bearer ATTENDANCE_FEED_KEY, constant-time): GET rows for the last N days incl. untagged check-ins; POST a sheet edit back onto the platform record. |
| `functions/api/attendance.js` | 89 | Admin attendance page API: per-program day view (batches, check-ins, default training), batch history, and merge-writes via _attendance.saveRows; preview deployments can't write. |
| `functions/api/call-results.js` | 113 | Server-to-server intake of graded Call Simulator calls from Ring Channel (via=ringchannel) and the CMS's older panel, and graded Client Messaging conversations from the CMS (kind=message; MD conversations only) (X-Gateway-Key): writes simulator_results and the course's KV callsim record (courseTraineeId/addCall/courseSlot); admin GET lists the calls. |
| `functions/api/calsim.js` | 128 | Calendaring Simulators record store (D1 calsim_records): trainee saves, admin reviews, CALENDAR MANAGEMENT MOCK CALL scorecards and per-track exclusions; trainer-owned fields survive trainee saves. |
| `functions/api/email-inbound.js` | 36 | Postmark inbound webhook (keyed URL, constant-time compare): stores the first reply onto the matching email_practice row. |
| `functions/api/email-practice.js` | 123 | Email Replies delivery: sends a fixed scenario via Postmark with a tokenized Reply-To, per-address daily cap; GET polls a token's reply status, ?status=1 reports configuration. |
| `functions/api/drafting-drafts.js` | 74 | Drafting letters saved to the trainee's account (D1 `drafting_drafts`): GET mine / one letter (admins: a trainee's), POST a draft with `base` (409 DRAFT_NEWER: an older copy never replaces a newer one) or delete (Start over). |
| `functions/api/gcal-reviews.js` | 314 | Google Calendar Simulator submissions and drafts: submit → background AI review (waitUntil, retries, stale-run detection), trainer feedback, finalize/reopen/retry, per-track AI rules, 409-guarded draft saves. |
| `functions/api/gcal-schedule.js` | 158 | The attorney's editable weekly schedule per track (gcal_schedule / gcal_schedule_tracks) plus the trainers' color coding (gcal_schedule_colors); GET signed-in, PUT/DELETE admin-only. |
| `functions/api/leaderboard.js` | 66 | Ranks approved trainees by average graded score, ties broken by completed count. |
| `functions/api/lectures.js` | 60 | Lectures CRUD: GET for any session, POST/DELETE admin-only. |
| `functions/api/program-progress.js` | 401 | Admin cross-program progress: reads course KV trainee/feedback/tfeedback under a 950-op budget, merges D1 simulator/calsim/gcal-review/submission summaries; archive/restore/Save-to-Drive of batches with D1 snapshots. |
| `functions/api/progress.js` | 112 | Portal activity progress: per-trainee completion %, pending checks and average score; admin gets everyone, a trainee gets self + batch average. |
| `functions/api/referrals.js` | 197 | Public referral intake (honeypot, origin check, hourly per-IP limit, magic-byte CV validation, 1 MB D1 parts) plus admin list/download/status/delete. |
| `functions/api/sim-ai.js` | 29 | AI endpoint for the Portal's own simulators: session (or guardPublicSim) then runAi with the shared budget. |
| `functions/api/sim-results.js` | 86 | Simulator results store (D1 simulator_results): POST saves a run, GET returns admin's latest 200 or the user's own 50. |
| `functions/api/submissions.js` | 196 | Activity submissions: trainee SUBMIT with server-side objective grading (auto-finalize unless essay), waitUntil AI review, admin GRADE. |
| `functions/api/topics.js` | 134 | Topic/program access control: public topic list when signed out (unless locked), trainee REQUEST_ACCESS, admin GRANT/APPROVE/DENY/MARK_PASSED with upserts and logging. |

## CI tests and workflows

The Checks suite (node + Playwright) and the Uptime monitor.

| File | Lines | What it is |
|---|---|---|
| `.github/scripts/admin-approval.mjs` | 85 | functions/api/update-status.js + api/create-user.js: a trainer may set an Admin / Trainer account up but only the Master Account approves or rejects one; a trainer still approves a trainee, and the approval issues the Batch ID. |
| `.github/scripts/ai-gateway.mjs` | 186 | functions/_ai-gateway.js + api/ai-gateway.js: one shared ledger across flows, minute/daily/per-user/module-share limits, key-pool failover and rest, relay fallback, live-token cost, abort deadlines, review reserve, endpoint auth. |
| `.github/scripts/batch.mjs` | 42 | Batch IDs: nextBatchId (functions/_utils.js) mints B+MMDDYY; app.js batchLabel/batchCohort show and group older IDs. |
| `.github/scripts/blueprint.cjs` | 143 | Orientation decks and PDFs: trainee vs admin tracks, PDF page-per-slide with deploy stamp, consistent numbering across page counter, PDF footers/headers and the engine's own deck. |
| `.github/scripts/call-results.mjs` | 92 | functions/api/call-results.js: the gateway secret, Ring Channel's and the CMS's graded calls land in simulator_results and each course's KV store by lesson/line, EA/PA alias, admin listing; Client Messaging conversations on their own line, MD's under md:. |
| `.github/scripts/calls-route.mjs` | 66 | /simulators/call.html routes through /api/launch?tool=ringchannel&to=calls to Ring Channel's practice phone, with the link's line/program/graded call sanitized (callsQuery); signed-out and admin paths.; to=messages opens Ring Channel's Client Messaging with only its program, conversation and graded (messagesQuery). |
| `.github/scripts/calsim.mjs` | 58 | functions/api/calsim.js: trainee save/read, admin-only reviews/scorecards/exclusions kept through trainee saves, scorecard metrics match simulators/cal-scorecard.js. |
| `.github/scripts/check-site.mjs` | 86 | Static checks: syntax of every JS file and inline <script>, local file references in HTML exist, JSON parses. |
| `.github/scripts/front-door.mjs` | 126 | functions/_middleware.js + /api/me on node:sqlite: signed-in users redirected to /programs.html, signed-out/revoked/tampered/locked cases, heartbeat restart. |
| `.github/scripts/gcal-review-page.cjs` | 381 | Trainer's Trainee Evaluations page resilience: new-tab restore via /api/me, failed/lagging/expired API never wipes open feedback, 401/403/423/offline messaging, rules per track, retry stuck AI, hostile calendar shapes, phone width. |
| `.github/scripts/gcal-review.cjs` | 184 | Submit-to-trainer flow in the calendar look + calsim.html lists; trainer View & score with the CALENDAR MANAGEMENT MOCK CALL scorecard, exclusions, trainee sees feedback/scorecard. |
| `.github/scripts/drafting-drafts.mjs` | 57 | functions/api/drafting-drafts.js on SQLite: signed out nothing; saved and back; the list; DRAFT_NEWER; only their own (admins can open a trainee's); bad ids and oversized letters refused; Start over. |
| `.github/scripts/gcal-reviews.mjs` | 280 | functions/api/gcal-reviews.js: submit/AI review lifecycle (hangs, retries, zombies, D1 faults, malformed AI JSON), trainer finalize/reopen, drafts with DRAFT_NEWER conflict, hostile-calendar sanitizing, program-progress reads latest evaluation at scale. |
| `.github/scripts/gcal-schedule.mjs` | 68 | functions/api/gcal-schedule.js: per-track weekly schedule (standard vs cm/ea tables), color coding, admin-only, unknown tracks refused before the DB, bound statements only. |
| `.github/scripts/gcal-trainee-side.cjs` | 122 | Trainee side odds and ends: DRAFT_NEWER 409 handling, today follows the clock, trimPayload size cap, track names on evaluations/PDF, PDF accents, calsim cards show evaluation state, trainer new-tab view, single Trainee Evaluations link. |
| `.github/scripts/gcal.cjs` | 483 | Google Calendar Simulator end-to-end: the attorney's week, solvable requests, the grading rules (incl. the length-color rule), full page UI (create/edit/Meet/drag/undo/views/search), scores card placement, admin weekly-schedule and color edits, the cm/ea clones. |
| `.github/scripts/master-control.mjs` | 71 | One sign-in for admins: a trainer's own approved admin account opens Master Control's APIs and a trainee cannot; only the master account may LOCK, and UNLOCK takes the master password (and says so when the secret is missing). |
| `.github/scripts/my-evaluations.cjs` | 66 | Trainee's My Evaluations page: drafts with a way back in, submitted statuses, final report + PDF button, New flag clears, trainer and signed-out views, phone width. |
| `.github/scripts/requests.cjs` | 88 | Request budget from an open page: one /api/live per 20 s (none in a background tab), heartbeat per 30 s, lock/alert/ping from /api/live shown, since= cursor, signed-out asks no pings. |
| `.github/scripts/registration.mjs` | 77 | Registering on the Portal: any password of 8+ characters, the registration lands as Pending for Master Control → Registrations, the same password signs in once approved, and the claim-account feature stays gone. |
| `.github/scripts/ringchannel.mjs` | 92 | /api/launch?tool=ringchannel: trainee and admin tickets verified by verify-ticket, admins get tickets nowhere else, ?to=aicall/calls/console, portal pages link to it. |
| `.github/scripts/records-chain.cjs` | 197 | Manual (needs the CMS and CM course checked out; CMS_REPO / COURSE_REPO): filing a produced record end to end through the real files of all three repos — simulator -> the course's relay -> the CMS's bridge and its own caseFileName — asserting on the CMS's upload call and its answer rather than the Doc Hub rows. |
| `.github/scripts/records-clock.cjs` | 329 | The collection's clock and same-day receipt: every date tracks the system date, a reopened collection catches up without punishing the days away, a full collection is worked through in one sitting for 100%, and the rejections, fee cap, partial ledger, hidden providers, chase and scoring are all unchanged; with it off the business-day clock is back. |
| `.github/scripts/drafting-docs.cjs` | 188 | Drafting Activities filing (`simulators/drafting-docs.js`, on a fixture page, since the drafting tool itself is not built yet): destination and Case ID from the link, each letter's Doc Hub tab, the firm's file name and that it matches `records-docs.js` for the same inputs, a missing or wrong tab refused with the tab the firm uses and nothing sent, a wrong name refused by the CMS, the right tab and name filing the drafted letter's own PDF through `cms-doc-file`, the score by attempts, and no platform listening left ungraded. |
| `.github/scripts/drafting-editor.cjs` | 367 | The Drafting tool's Word-style editor, typed and clicked as a trainee: Word's ribbon; an untouched letter downloads byte-identical but for document.xml, which is the template's; typing over a placeholder keeps its run's font and highlight until No Color; Enter, a font and size, Ctrl+B, centring and a deleted line reach the .docx in Word's property order; Ctrl+Z; kept in the browser and on the trainee's account (another browser opens it); bullets, numbering, indent, line spacing and their list definitions in the download; Keep Source Formatting and Keep Text Only; three pages for the 3P as in Word, the letterhead on each and a page added as text grows; Check my letter; a Lien BV form check box ticks; no sideways scroll at phone width. |
| `.github/scripts/records-docs.cjs` | 153 | Medical Records Requests: a produced request is a real records document and itemized bill (identifiers, CPT-coded lines, total), a real PDF named the firm's way, filed into the case on the platform the trainee came from through the CMS's cms-doc-file protocol; with no platform, the download and NO-CASE-ID naming still work. |
| `.github/scripts/sim-identity.cjs` | 172 | Whose score is it: every simulator page records the signed-in trainee's score under their own account, never a name from the link or the browser — including the course-opened tab that holds the signed cookie before /api/me answers. |
| `.github/scripts/sim-results.mjs` | 64 | A simulator's result counts in the trainee's own record and, when a course opened the simulator, in that course's store with the best per simulator; a name typed in the browser never replaces the account's. |
| `.github/scripts/sim-session.cjs` | 187 | simulators/sim.js session keeping: heartbeat cadence, Sim.restore single /api/me, Sim.fetchRetry on SESSION_EXPIRED, second trainee on the same browser starts clean, no cross-trainee draft upload. |
| `.github/scripts/smoke.cjs` | 52 | Opens 24 portal/simulator pages at desktop and phone width; fails on page errors, sideways scroll, missing Back button, portal links opening new tabs. |
| `.github/scripts/trainees-on-evaluations.cjs` | 64 | 'Your trainees' calendars' table on Trainee Evaluations: per-track View & score links, search survives refresh, submission state per row, button opens the review, phone width. |
| `.github/scripts/uptime.mjs` | 45 | Fetches 11 live sites (portal, 4 course Workers, CMS, Knowledge Base, Ring Channel, 2 JSON APIs, docket page), one 20 s retry each, prints a Markdown table, exit 1 on failure. |
| `.github/workflows/checks.yml` | 116 | CI on every PR/push to main: 10 node API tests + wrangler build in one job, 10 Playwright browser tests in a second job. |
| `.github/workflows/uptime.yml` | 48 | Every 30 min (:07/:37) runs uptime.mjs against the live sites and opens/comments/closes a 'site-down' issue. |

**141 files, ~27,688 lines** (excluding images, node_modules and this map).

## Duplications kept on purpose

- Tiny helpers (`esc`, `$`, `render`, …) are re-declared per page by convention: the pages are standalone scripts with no module system.
- `PROGRAM_ORDER` + the program-label fallback (attendance.html ↔ progress-records.js), `ARCHIVED_TOPICS` (app.js ↔ programs.html) and `SSO_PROGRAMS` (programs.html ↔ functions/api/launch.js) are deliberate browser/server copies, each marked with a `keep in step` comment.
- `nameKey` and `csvq` exist once in the browser and once in Functions — the two runtimes can't share a module.

## Flagged for a decision (not changed by the audit)

- **`functions/_sim-guard.js` is effectively unused**: `sim-results.js` and `sim-ai.js` call `guardPublicSim` only when `requireSession` already failed, and the guard re-runs the same check and rejects — so its origin check and per-IP rate limit never apply to anyone, and the guest-identity branches behind it are unreachable. Either wire the guard in for signed-in non-admin sessions (activating the rate limit) or remove it; both change behavior, so neither was done here.
- **`functions/api/leaderboard.js`** re-implements `progress.js`'s submission aggregation; consolidating risks changing scores, so it stays, noted.
- **`functions/_attendance.js makeKv`** and **`program-progress.js`'s KV reader** are drifted siblings (throw-on-budget vs skip-and-note); merging them changes failure behavior.
- **Program-id → KV-prefix maps** exist in `_attendance.js`, `program-progress.js` and `call-results.js` with different shapes.
- **`functions/_utils.js generateAiReview`** keeps its own Gemini key/model fallback outside `_ai-gateway.js`'s budgeted pool.
- **`wrangler.toml name`** is the CM course's project name, not this Pages project's; renaming could detach the deployment, so it is only noted.
- **Test-harness duplication**: the D1-over-`node:sqlite` stub (6 node tests) and the static-server/Chromium boilerplate (10 browser tests) are copy-pasted with drift.
- **Coverage gaps**: no test signs in through `/trainee-login.html`/`/registration.html` end to end, and the Docket/Records/eFiling/Email simulators plus attendance are load-only tested.

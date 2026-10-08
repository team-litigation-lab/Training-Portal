# Code map — LSH Training Portal

An inventory of every code file in this repository: what each one is for, at a glance.
Produced by the October 2026 full-repo audit (nine area reviews plus adversarial verification);
sizes are lines of the file as of that audit. The living feature docs are README.md and SIMULATORS.md —
this map answers "what is this file?", those answer "how does the feature work?".

## Public entry pages

The landing page, sign-in, registration, claim and referral pages, and their shared chrome.

| File | Lines | What it is |
|---|---|---|
| `_redirects` | 16 | Cloudflare Pages redirects: keeps repo files (wrangler.toml, *.md, topics_seed.sql, .github/, functions/) off the published site, forwards old KB URLs through /api/launch?tool=kb SSO (kb target exists in functions/api/launch.js), and bridges retired /bridge.html to /programs.html. |
| `auth.css` | 91 | Shared chrome of the two sign-in pages (split card, visual panel, form styles), extracted from the byte-identical blocks trainee-login.html and admin-login.html carried; registration.html keeps its own tuned variant. |
| `admin-login.html` | 92 | Admin sign-in page; during a site-wide lock portal.js swaps the login form for the Master-Account unlock form (admin-unlock-content); loads show-password.js. |
| `claim.html` | 64 | Self-contained page where imported (CMS/program) trainees claim their pre-created account: POST /api/claim with firstName/lastName/batchId/username/email/password. |
| `index.html` | 622 | Public landing page: hero, team org chart, about/mission/values, FAQ, footer, plus the 'Got a referral?' modal that posts multipart form data to /api/referrals. |
| `referrals.html` | 162 | Admin-only referrals manager over /api/referrals: list/filter/search, status + admin note (PATCH), CV download (?cv=id), CSV export with formula-injection quoting, delete. |
| `registration.html` | 195 | New-account request form (Trainee/Admin) handled by portal.js submitRegistration() → POST /api/register; lock-aware via AUTH_PAGE_TYPE='registration'. |
| `show-password.js` | 37 | Injects a Show/Hide toggle into every password input, including ones added later, via a MutationObserver; loaded only by admin-login.html (per its own 'admin pages' comment). |
| `styles.css` | 507 | Shared app-shell stylesheet for core.html (sidebar, classification bar, modals, Master Control, lock/pause/alert overlays, toasts, auth gate); also loaded by the auth pages, which deliberately override its body height:100vh/overflow:hidden. |
| `trainee-login.html` | 83 | Trainee sign-in page; wires portal.js attemptLogin() with currentPortalMode='Trainee' and is lock-aware via AUTH_PAGE_TYPE='trainee-login'. |

## Portal pages and shared scripts

The signed-in portal: Training Directory, dashboard, progress, attendance, orientation, simulators hub, and the shared runtime scripts.

| File | Lines | What it is |
|---|---|---|
| `app.js` | 2853 | Core dashboard script: session/heartbeat, view switching, Master Control (users, registrations, logs, monitoring, program access), activities/lectures/submissions CRUD, grading, PDF reports, leaderboard/progress, toasts, celebration. |
| `attendance.html` | 364 | Admin attendance per program/batch/day: debounced autosave with retry, batch summaries, CSV export, Google Sheet sync setup helper. |
| `core.html` | 1058 | Admin dashboard (CM Training workspace + Master Control): sidebars, views, modals, overlays (pause/alert/lock), deck/lecture viewer panes, hash deep links into Master Control tabs. |
| `orientation.html` | 387 | Platform Orientation slide deck (trainee + admin tracks) for screen sharing, with print CSS and Blueprint PDF export. |
| `portal-nav.js` | 139 | Shared nav: PortalNav.html/adminHtml top bars, System Management menu, trainee-view switch, logout, injected styles, floating Back-button safety net. |
| `portal.js` | 843 | Public-portal runtime: registration/login, password validation, input filters, sound engine, full-screen alert, site lock/pause UI, pings, and the consolidated /api/live poller. |
| `programs.html` | 569 | Training Directory: grouped program cards with access request/approve flow, SSO launch wake-up, admin queue, client-side certificate PDF. |
| `progress.html` | 114 | Admin Trainee Progress & Feedback shell: admin gate, styles and hero; all rendering lives in progress-records.js. |
| `simulators.html` | 114 | Simulators hub: card grid from the SIMULATORS array plus recent results table (admin sees all trainees). |

## Data and deck scripts

Standalone data/deck modules and repo-level config.

| File | Lines | What it is |
|---|---|---|
| `README.md` | 242 | Full operator/developer documentation: SSO sign-in, email replies, simulators, referrals, orientation, admin bar, KB, Ring Channel, attendance (+Google Sheet), progress & feedback, Drive archiving, request budget, CI checks and uptime. |
| `SIMULATORS.md` | 93 | Simulator ownership/status table for parallel Claude chats, plus shared conventions (sim.js session handling, AI gateway, styles, navigation rules, smoke-test registration). |
| `attendance-sync.gs` | 236 | Google Apps Script pasted into the attendance spreadsheet: two-way sync between the 'Platform Attendance' tab and /api/attendance-feed (15-minute pull, installable on-edit push of Training/Time In/Time Out/Status/Notes). |
| `lsh-blueprint.js` | 487 | Shared LSH Blueprint slide-deck engine (trainee/trainer/admin decks from window.LSH_BLUEPRINT), with keyboard nav, screenshot zoom, auto-fit scaling, and a jsPDF-based real-text PDF export. |
| `progress-records.js` | 402 | Browser script for /progress.html: admin Trainee Progress & Feedback — per-program tabs, batch-grouped trainee table with detail rows, archived batches (open/restore/Save to Drive), trainee feedback pane, CSV exports, all against /api/program-progress. |
| `topics_seed.sql` | 23 | Seed INSERT for the D1 `topics` table: 22 training/reference topic keys with display names and sort_order. |
| `wrangler.toml` | 22 | Cloudflare Pages config: output dir = repo root, two D1 bindings (DB, TRAINING_DB) and the read-only COURSE_KV namespace for course progress. |

## Google Calendar Simulator

The Google Calendar look-alike, its data, the trainer review and the trainee evaluations.

| File | Lines | What it is |
|---|---|---|
| `simulators/cal-scorecard.js` | 75 | The CALENDAR MANAGEMENT MOCK CALL scorecard: the 7 weighted metrics, sheet and form HTML, read/validate and live weighted average; window.CalScorecard + CommonJS export for the server-side metric check. |
| `simulators/eval-report.js` | 53 | Shared EvalReport module: renders a finalized calendar evaluation as HTML and as a jsPDF download, plus shared esc/when/css used by my-evaluations.html and the simulator's panel. |
| `simulators/gcal-data.js` | 445 | Per-track data: the attorney's/executive's weekly schedule rows, Google colors, calendars, holidays, caller requests, rules, request types and GCAL_CFG for standard/cm/ea tracks. |
| `simulators/gcal-review.html` | 449 | Trainee Evaluations (trainers): live list of submissions, the submitted calendar week view, automated check, AI review, trainer feedback with autosave, finalize/reopen, and per-track AI-review rules. |
| `simulators/gcal.html` | 357 | The simulator page shell: Google-Calendar-look CSS, hero/intro, script includes (jsPDF, sim.js, eval-report.js, gcal-data.js, cal-scorecard.js, gcal.js). |
| `simulators/gcal.js` | 1537 | The Google Calendar Simulator: calendar views, event CRUD/drag, the attorney's rules engine (slotProblems/solve/checkPlan/checkOpen), cloud drafts, submit-for-evaluation, trainer review/live-view modes, and the window.GCAL test API. |
| `simulators/my-evaluations.html` | 130 | The trainee's My Evaluations page: drafts in progress per track, submitted calendars with status polling, and the final report view/PDF via EvalReport. |
| `simulators/trainees-calendars.js` | 65 | The 👥 Your trainees' calendars table on gcal-review.html: everyone with a saved draft or scorecard per track, with View & score links and search; TraineesCalendars.load/repaint API plus the legacy window.csFind shim. |

## Calendaring Simulators hub and scheduler

The hub page, the older drag-and-drop scheduler, the call entry page and the shared sim chrome.

| File | Lines | What it is |
|---|---|---|
| `simulators/calendar.html` | 296 | 'Conflicts week' Calendaring simulator: two self-contained scenarios (CM litigation week, EA/PA executive week) rendered as a read/edit week grid; rule-based checkPlan() scoring, Gemini coach feedback via Sim.ai, results via Sim.saveResult. |
| `simulators/call.html` | 18 | Thin redirect stub: forwards to /api/launch?tool=cms&to=calls carrying the query string, so the CMS Call Simulator opens through the Portal's sign-in. |
| `simulators/calsim-core.js` | 195 | Pure data + logic for the drag-and-drop scheduler: TRACKS (standard/litigation/executive), four SCENARIOS (fixed events, weighted tasks with rules), event sanitizer clean(), word-match task pairing, and the automated review() scored out of 100 (PASS 80). Node-loadable (module.exports) for tests. |
| `simulators/calsim.html` | 156 | Calendaring Simulators hub page: cards for the three Google Calendar tracks (standard/cm/ea), mock-call links via call.html, trainee review summaries, and the admin ?view=scores view (gsList of gcal submissions + the legacy drag-and-drop scheduler scores via calsim.js). |
| `simulators/calsim.js` | 506 | The earlier drag-and-drop weekly scheduler (Google Calendar style): trainee grid editor with pointer/keyboard drag, autosave to /api/calsim, automated review via FTCalCore, submissions, and the trainer's per-submission feedback UI (FTCalAdmin). Only used from calsim.html?view=scores now (per the page's own comment). |
| `simulators/legal-sim.css` | 155 | Shared styles for the legal-work simulators: common form/tab primitives (lx-/dk-), Docket System, Medical Records Requests and Court E-Filing sections. Linked only by docket.html, records.html and efiling.html. |
| `simulators/sim.css` | 49 | Shared simulator look: tokens, top bar, hero, cards, buttons, chips, tables, score pills, the 'who's practicing' dialog, and phone-width rules. |
| `simulators/sim.js` | 166 | Shared simulator helpers (global Sim object): esc, session restore/heartbeat re-seed (restore, fetchRetry), 'who's practicing' identity (who/setWho/fromQuery/claim with LSH_SIM_USER browser hand-off), topbar, Gemini proxy Sim.ai, and result saving (saveResult/results). |

## Office simulators

Docket, e-filing, records, email simulators and their data.

| File | Lines | What it is |
|---|---|---|
| `simulators/cm-case.js` | 6 | Sets window.CM_CASE_SUMMARY, the John Doe v. Apex case snapshot shown as a collapsible case file in email-replies.html for caseFile scenarios. |
| `simulators/docket-data.js` | 149 | Docket data: DK_ATTORNEYS, DK_ENTRY_TYPES, 7 cases (harlow, doe + 5 prototype cases) and 2 docketing assignments (federal Harlow, CM John Doe). |
| `simulators/docket.html` | 34 | Shell page for the Docket System simulator; loads sim shell plus legal-rules.js, docket-data.js, docket.js. |
| `simulators/docket.js` | 292 | Docket System simulator: docketing inbox with graded assignments, federal-style court records, firm calendar with .ics export, CSV export, and a rules-based deadline calculator (locked until the assignment is checked); state in localStorage (LSH_DOCKET_V1). |
| `simulators/efiling-data.js` | 50 | E-Filing scenario data: EF_LIMIT_MB (35), attachment types, and 3 scenarios (federal opposition, state amended complaint, state new case) with document folders carrying the planted defects. |
| `simulators/efiling.html` | 34 | Shell page for the Court E-Filing simulator; loads sim shell + efiling-data.js + efiling.js. |
| `simulators/efiling.js` | 329 | Court E-Filing simulator: federal CM/ECF-style and state EFSP-style wizards, a filing folder with inspect/fix tools (OCR, /s/, COS, redaction, split, unlock), fee/payment steps, grading, NEF/envelope receipts and clerk review; state in localStorage (LSH_EFILING_V1). |
| `simulators/email-packs.js` | 309 | Built-in Email Workspace packs: EMAIL_PACKS.cm (Case Management, 10 emails) and EMAIL_PACKS.ea (EA/PA, 10 emails), each with labels, decisions, one+ phishing emails with redFlags. |
| `simulators/email-replies.html` | 242 | Self-contained Email Replies simulator (all JS inline): one scenario email at a time from reply-packs/emails.json, answered on the page or delivered to the trainee's real inbox via /api/email-practice (Postmark, polled by token), with an AI-scored debrief per reply. |
| `simulators/email.html` | 138 | Shell page for the Email Workspace simulator with a large inline Gmail-look stylesheet; loads sim shell + email-packs.js + email.js. |
| `simulators/email.js` | 328 | Email Workspace: Gmail-style inbox with folders, nested labels, keyboard shortcuts, one-decision-per-email triage, phishing traps (link click / sensitive reply = instant fail), AI-generated inboxes for any program, and 4-part grading (filing, security, triage, AI-graded replies); per-person localStorage key. |
| `simulators/legal-rules.js` | 86 | LR: court deadline math shared by the Docket and Medical Records simulators — UTC date helpers, 2026–early-2028 federal holiday table, FRCP-6 and training-state counting methods, RULES library and compute() with step-by-step explanations. |
| `simulators/records-data.js` | 96 | Records scenario data: the John Doe scenario, MR_TYPES, 14 providers (incl. hidden anes/river, prior whc/mig, decoy derm/pharm) and MR_FINDINGS (6 real problems + 3 decoys). |
| `simulators/records.html` | 34 | Shell page for the Medical Records Requests simulator; loads sim shell + legal-rules.js + records-data.js + records.js. |
| `simulators/records.js` | 296 | Medical Records Requests simulator: HIPAA authorization review/e-signature, provider request engine with a business-day clock (LR.add/closed), acknowledgments/rejections/invoices vs the state fee cap, follow-ups, delivered records to review/flag/log, 100-point scoring; state in localStorage (LSH_RECORDS_V1). |
| `simulators/reply-packs/emails.json` | 247 | Email Replies scenarios: 10 emails (8 CM on the John Doe file + 2 all-program, incl. a wire-instructions phish), each with role, facts, grading goals and optional caseFile flag. |

## API: sessions, users and site state

Login/session plumbing, user management, site lock/pause/alert, logs and monitoring.

| File | Lines | What it is |
|---|---|---|
| `functions/_middleware.js` | 78 | Pages middleware: front-door redirect for signed-in people, server-side gating of admin pages and /simulators/*, call-sim redirect to CMS launch. |
| `functions/_sim-guard.js` | 56 | Guard for simulator endpoints: requires a Portal session, site-lock check, same-origin check, per-IP rate limit; plus publicIdentity() for self-reported names. |
| `functions/_utils.js` | 495 | Shared helpers: json(), HMAC session tokens/cookies, heartbeat liveness, requireSession, site state, Master Account credentials, password hashing/normalizing, login throttle, batch IDs, tombstones, activity log, Gemini AI review. |
| `functions/access-control.js` | 168 | Server-rendered admin-only Pause/Lock page (HTML inlined in the Function so non-admins never receive the markup). |
| `functions/api/admin-password-check.js` | 87 | Admin-only GET/POST page that tests the typed admin password against every platform's admin sign-in. |
| `functions/api/alert.js` | 73 | GET active alert (public); POST set / DELETE stop an alert (admin), logged to env.DB activity_log. |
| `functions/api/announcement.js` | 60 | GET public announcement ticker text; POST/DELETE set or clear it (admin), stored in TRAINING_DB site_settings. |
| `functions/api/heartbeat.js` | 62 | GET who's-online list (admin); POST session heartbeat upsert with lighter-than-requireSession checks. |
| `functions/api/import-registrations.js` | 164 | Admin-only GET page + POST importer: pulls registered trainees from the five programs and the CMS, creates unclaimed Portal accounts and program access. |
| `functions/api/launch.js` | 146 | GET /api/launch: opens a program or tool for the signed-in person with a short-lived signed SSO ticket (trainee/admin/system variants), plus landing/?to= routing and callsQuery. |
| `functions/api/live.js` | 22 | GET /api/live: one-request aggregation of site-state, alert and pings for every open page's 20s poll. |
| `functions/api/login.js` | 133 | POST /api/login for Trainee and Admin portals: password verify, legacy-hash upgrade, throttle, master-account path, status checks, session cookie + heartbeat seed. |
| `functions/api/logout.js` | 25 | POST /api/logout: logs the logout, deletes the heartbeat row, clears the cookie; deliberately skips requireSession. |
| `functions/api/me.js` | 19 | GET /api/me: who is signed in on this browser, restarts the heartbeat; special-cases the Master Account. |
| `functions/api/pings.js` | 68 | GET new pings for the signed-in user (poll with ?since); POST send a ping to all or named users (admin). |
| `functions/api/register.js` | 73 | POST /api/register: public self-registration, creates a Pending users row after field/password/tombstone checks. |
| `functions/api/revoke-user.js` | 47 | POST /api/revoke-user (admin): permanent revocation — tombstone, delete row, clear heartbeat and program access. |
| `functions/api/server-logs.js` | 45 | GET /api/server-logs (admin): the accounts DB's activity_log newest-first, with per-logout session duration computed from login pairs. |
| `functions/api/site-state.js` | 131 | GET public lock/pause state (+pause message); POST LOCK/UNLOCK/PAUSE/RESUME with master-credential re-verification. |
| `functions/api/sso-check.js` | 52 | Admin-only GET page that signs a test ticket and tries it on every program's /api/auth/portal. |
| `functions/api/update-access.js` | 42 | POST /api/update-access (admin): Suspend / Reactivate an approved account. |
| `functions/api/update-status.js` | 31 | POST /api/update-status (admin): Approve / Reject a pending registration, assigning a Batch ID on approval. |
| `functions/api/update-user.js` | 79 | POST /api/update-user (admin): edit batch/name/email/username/password; moves username-keyed data across TRAINING_DB tables and kills open sessions. |
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
| `functions/api/call-results.js` | 104 | Server-to-server intake of CMS-graded calls (X-Gateway-Key): writes simulator_results and the course's KV callsim record (courseTraineeId/addCall/courseSlot); admin GET lists CMS-graded calls. |
| `functions/api/calsim.js` | 128 | Calendaring Simulators record store (D1 calsim_records): trainee saves, admin reviews, CALENDAR MANAGEMENT MOCK CALL scorecards and per-track exclusions; trainer-owned fields survive trainee saves. |
| `functions/api/claim.js` | 67 | One-time claim of an admin-imported (unclaimed:) trainee account: name+batch match, per-IP fail throttle, atomic UPDATE guarded by the unclaimed marker, access-row carry-over. |
| `functions/api/email-inbound.js` | 36 | Postmark inbound webhook (keyed URL, constant-time compare): stores the first reply onto the matching email_practice row. |
| `functions/api/email-practice.js` | 123 | Email Replies delivery: sends a fixed scenario via Postmark with a tokenized Reply-To, per-address daily cap; GET polls a token's reply status, ?status=1 reports configuration. |
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
| `.github/scripts/ai-gateway.mjs` | 186 | functions/_ai-gateway.js + api/ai-gateway.js: one shared ledger across flows, minute/daily/per-user/module-share limits, key-pool failover and rest, relay fallback, live-token cost, abort deadlines, review reserve, endpoint auth. |
| `.github/scripts/batch.mjs` | 27 | Batch IDs: nextBatchId (functions/_utils.js) mints B+MMDDYY; app.js batchLabel/batchCohort show and group older IDs. |
| `.github/scripts/blueprint.cjs` | 139 | Orientation decks and PDFs: trainee vs admin tracks, PDF page-per-slide with deploy stamp, consistent numbering across page counter, PDF footers/headers and the engine's own deck. |
| `.github/scripts/call-results.mjs` | 70 | functions/api/call-results.js: CMS-only secret, graded calls land in simulator_results and each course's KV store by lesson/line, EA/PA alias, admin listing. |
| `.github/scripts/calls-route.mjs` | 56 | /simulators/call.html routes through /api/launch?tool=cms&to=calls with the link's tab/line sanitized (callsQuery); signed-out and admin paths. |
| `.github/scripts/calsim.mjs` | 58 | functions/api/calsim.js: trainee save/read, admin-only reviews/scorecards/exclusions kept through trainee saves, scorecard metrics match simulators/cal-scorecard.js. |
| `.github/scripts/check-site.mjs` | 86 | Static checks: syntax of every JS file and inline <script>, local file references in HTML exist, JSON parses. |
| `.github/scripts/front-door.mjs` | 93 | functions/_middleware.js + /api/me on node:sqlite: signed-in users redirected to /programs.html, signed-out/revoked/tampered/locked cases, heartbeat restart. |
| `.github/scripts/gcal-review-page.cjs` | 381 | Trainer's Trainee Evaluations page resilience: new-tab restore via /api/me, failed/lagging/expired API never wipes open feedback, 401/403/423/offline messaging, rules per track, retry stuck AI, hostile calendar shapes, phone width. |
| `.github/scripts/gcal-review.cjs` | 184 | Submit-to-trainer flow in the calendar look + calsim.html lists; trainer View & score with the CALENDAR MANAGEMENT MOCK CALL scorecard, exclusions, trainee sees feedback/scorecard. |
| `.github/scripts/gcal-reviews.mjs` | 280 | functions/api/gcal-reviews.js: submit/AI review lifecycle (hangs, retries, zombies, D1 faults, malformed AI JSON), trainer finalize/reopen, drafts with DRAFT_NEWER conflict, hostile-calendar sanitizing, program-progress reads latest evaluation at scale. |
| `.github/scripts/gcal-schedule.mjs` | 68 | functions/api/gcal-schedule.js: per-track weekly schedule (standard vs cm/ea tables), color coding, admin-only, unknown tracks refused before the DB, bound statements only. |
| `.github/scripts/gcal-trainee-side.cjs` | 122 | Trainee side odds and ends: DRAFT_NEWER 409 handling, today follows the clock, trimPayload size cap, track names on evaluations/PDF, PDF accents, calsim cards show evaluation state, trainer new-tab view, single Trainee Evaluations link. |
| `.github/scripts/gcal.cjs` | 457 | Google Calendar Simulator end-to-end: the attorney's week, solvable requests, the grading rules (incl. the length-color rule), full page UI (create/edit/Meet/drag/undo/views/search), scores card placement, admin weekly-schedule and color edits, the cm/ea clones. |
| `.github/scripts/my-evaluations.cjs` | 66 | Trainee's My Evaluations page: drafts with a way back in, submitted statuses, final report + PDF button, New flag clears, trainer and signed-out views, phone width. |
| `.github/scripts/requests.cjs` | 88 | Request budget from an open page: one /api/live per 20 s (none in a background tab), heartbeat per 30 s, lock/alert/ping from /api/live shown, since= cursor, signed-out asks no pings. |
| `.github/scripts/ringchannel.mjs` | 61 | /api/launch?tool=ringchannel: trainee and admin tickets verified by verify-ticket, admins get tickets nowhere else, ?to=aicall/console, portal pages link to it. |
| `.github/scripts/sim-session.cjs` | 177 | simulators/sim.js session keeping: heartbeat cadence, Sim.restore single /api/me, Sim.fetchRetry on SESSION_EXPIRED, second trainee on the same browser starts clean, no cross-trainee draft upload. |
| `.github/scripts/smoke.cjs` | 52 | Opens 24 portal/simulator pages at desktop and phone width; fails on page errors, sideways scroll, missing Back button, portal links opening new tabs. |
| `.github/scripts/trainees-on-evaluations.cjs` | 64 | 'Your trainees' calendars' table on Trainee Evaluations: per-track View & score links, search survives refresh, submission state per row, button opens the review, phone width. |
| `.github/scripts/uptime.mjs` | 42 | Fetches 9 live sites (portal, 4 course Workers, CMS, 2 JSON APIs, docket page), one 20 s retry each, prints a Markdown table, exit 1 on failure. |
| `.github/workflows/checks.yml` | 106 | CI on every PR/push to main: 10 node API tests + wrangler build in one job, 10 Playwright browser tests in a second job. |
| `.github/workflows/uptime.yml` | 48 | Every 30 min (:07/:37) runs uptime.mjs against the live sites and opens/comments/closes a 'site-down' issue. |

**133 files, ~25,528 lines** (excluding images, node_modules and this map).

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
- **Coverage gaps**: no test signs in through `/trainee-login.html`/`/registration.html`/`/claim.html` end to end, and the Docket/Records/eFiling/Email simulators plus attendance are load-only tested.

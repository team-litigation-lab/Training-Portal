# LSH platform standards

The standing rules we work to on the LSH web platform — the **LSH Training Portal**
(`team-litigation-lab/Training-Portal`) and the **LSH Knowledge Base**
(`team-litigation-lab/LSH-Knowledge-Base`). Each rule here is already implemented; this page only
collates them in one place. The detail stays where it lives: `README.md` and `SIMULATORS.md`
(Portal features and simulator conventions), `CODEMAP.md` (what each file is), the Knowledge Base
`README.md`, and `.claude/skills/weekly-code-inventory/` (the audit process).

---

## 1. Sign-in, sessions and access

- **One sign-in, on the Portal.** Trainees register and log in once on the Portal
  (`/trainee-login.html`, `portalMode: "Trainee"`) and open every program, simulator and the
  Knowledge Base from the Training Directory. A name alone never signs anyone in. Admins use
  `/admin-login.html`; an admin account used on the trainee form is told to use the Admin Portal.
- **Cross-platform SSO is a signed ticket, never a shared password.**
  `/api/launch` issues `base64url(JSON {first,last,b,exp})` + `.` + HMAC-SHA256 signed with
  `"portal-sso:" + PORTAL_SSO_SECRET`; a ticket is good for **5 minutes** and works **once** on the
  receiving platform. `SSO_PROGRAMS` in `programs.html` and in `functions/api/launch.js` must stay
  identical. The Knowledge Base verifies tickets by calling the Portal's `/api/verify-ticket`, so it
  holds no shared secret.
- **A ticket never signs in an admin**, except on LSH Ring Channel (`ADMIN_TICKET_TOOLS`). Every
  other platform lands an admin on its own admin prompt (`?admin=1`). Admins type the one shared
  `MASTER_ADMIN_PASSWORD` everywhere.
- **Batch IDs** are `B` + MMDDYY of the training start date, shared by the whole batch
  (`nextBatchId`, `functions/_utils.js`). Pre-October-2026 IDs keep their trainee number in storage
  but display as the batch alone.
- **Names must match the program's records.** A program keys a trainee record on first name, last
  name and Batch ID (no M.I., no suffix). Two trainees with the same first and last name in one batch
  get different Batch IDs before they open a program.
- **Server-side gating, not client-side.** `functions/_middleware.js` gates admin pages and
  `/simulators/*` before the markup is sent; admin-only pages that must not leak markup are rendered
  inside the Function (`functions/access-control.js`).
- **Heartbeat liveness.** A session with no heartbeat for **90 s** is expired (APIs answer
  `401 SESSION_EXPIRED`); pages beat every **30 s**.
- **Site-wide Lock belongs to the Master Account** (`LSHADMIN123`, no row in `users`). Only its
  session may LOCK; UNLOCK takes `MASTER_ADMIN_PASSWORD`. No secret set ⇒ `503 MASTER_NOT_SET`, not
  "incorrect password". The Portal's lock closes the Knowledge Base too. Enforced in CI by
  `.github/scripts/master-control.mjs`.

## 2. Simulators (`simulators/sim.js`, `simulators/sim.css`)

- **Page shell order:** `/app.js`, `/portal.js`, `/simulators/sim.js`, then the simulator's own
  scripts; `Sim.topbar('<id>')` into `#topbar`; `Sim.label(...)` for the heartbeat view label.
- **Identity before first paint.** Every page that decides anything by who is signed in awaits
  `Sim.restore()` / `Sim.ready` (one `/api/me`, started by `sim.js` itself) before rendering. The top
  bar, the "Who's practicing?" card and `Sim.saveResult` all wait on it.
- **A signed-in trainee always practices as their own account.** `Sim.who()` takes the name and batch
  from the session, not editable; a name typed earlier in the browser or passed as `?name=&batch=`
  never replaces it. Only `?program=` is honoured from a link. `LSH_SIM_USER` + `Sim.claim()` wipe the
  previous person's calendars and history on a shared machine.
- **`Sim.fetchRetry`** for Portal APIs: on `401 SESSION_EXPIRED` it re-asks `/api/me` once (re-seeding
  the heartbeat) and retries once.
- **Results** go through `Sim.saveResult({ simulator, scenario, score, summary, details })` →
  `/api/sim-results` (D1 `simulator_results`), plus a browser copy.
- **Graded calls and messages count in the course.** Ring Channel and the CMS post server-to-server to
  `/api/call-results` with header `X-Gateway-Key` = `AI_GATEWAY_SECRET` and a `via` field; the result
  is written to the Portal account *and* the course's KV store (`<prefix>callsim:<trainee id>`).
- **AI access is proxied, never keyed in the browser.** `Sim.ai(...)` → `/api/sim-ai` behind
  `functions/_sim-guard.js` (Portal session, same-origin, per-connection rate limit `SIM_RATE_LIMIT`,
  default 400 per 10 min). Gemini key pool with a US relay (`AI_RELAY_SECRET`) for blocked regions.
  **No Anthropic keys in the product.**
- **Scores are computed, never invented by the AI.** A scorecard's weighted metrics produce the
  percentage saved (e.g. the 7-metric calendar scorecard, the 5-metric EMAIL REPLY scorecard); the
  AI only supplies per-metric feedback and cites the scenario's `goals` as evidence.
- **Extend, don't multiply.** New program content goes in a pack file (a key in `email-packs.js`, a
  scenario in `efiling-data.js`, a track in `gcal-data.js`), not a new simulator. Calls go in Ring
  Channel's `SCENARIOS`.
- **Claim before you build.** More than one chat works here: read `SIMULATORS.md`, claim the
  simulator in its table, and update the row when you ship.
- **Shared code stays shared:** legal-work simulators use `simulators/legal-sim.css`; court deadline
  math lives only in `simulators/legal-rules.js` (`LR.compute`).
- **Trainee-facing text avoids the word "AI".** Simulators are described by what they do — never by
  the brand name of the commercial platform they imitate.

## 3. Navigation

- Every portal page uses `PortalNav.html(active, { back })` from `/portal-nav.js`; admins get the one
  shared `PortalNav.adminHtml` top bar, trainees `PortalNav.traineeHtml`.
- **Every new page must load `/portal-nav.js`** — a page without its own Back button gets the
  floating one.
- **Portal pages open in the same tab.** Only the training programs (separate sites with no way back)
  open in a new tab.
- Links to the landing page always go to `/index.html?stay=1`, so a signed-in person is not bounced
  on to the Directory by the middleware.
- CI fails any page with no visible "← Back" or with a portal link that opens a new tab.

## 4. The standard page style (`theme.css`)

- `theme.css` loads **last** on every page. The portal look is the default; a new page opts into
  nothing.
- The backdrop is a photo behind a wash, tuned only by three variables on the page's own `body`:
  `--portal-photo`, `--portal-wash`, `--portal-base`. White-copy pages add `class="portal-bg-dark"`;
  a page that genuinely must be flat adds `class="no-portal-bg"`. Both are exceptions.
- Panels are translucent: use `.sim-card`, `.topic-card`, `.pdf-card`, `.dash-card`,
  `.stat-card-v2`, `.admin-tile`; a new panel takes `background: var(--surface-glass)` +
  `backdrop-filter: var(--surface-blur)`. Declare `background` (the shorthand), **never**
  `background-image`.
- **Contrast is measured against the photo, not against a white card.** WCAG AA (4.5:1, or 3:1 at
  24px / 18.7px bold): muted text `--slate` / `#334155` (never `#64748b`), text straight on the
  backdrop `#1e293b`, orange as a **fill** (lettering on navy `#fdba74`; on paper `#9a3412` /
  `#c2410c`; a label on orange `#081226`, never white), and on dark surfaces "muted" means *lighter*
  (`#cbd5e1`, `#94a3b8`).
- Simulator chrome: `sim-wrap`, `sim-hero`, `sim-card`, `sim-btn`, `sim-chip`, `sim-table`; navy
  `#0f2148` + orange `#f97316`.
- **One Blueprint engine.** `lsh-blueprint.js` is byte-identical on every LSH platform — change it in
  one repo and copy it to all. Decks are data (`SLIDES` / `blueprint-content.js`); numbering is
  ★ Cover then 1…n; the PDF is admin/trainer-only and stamped with the deployed ETag and date.

## 5. Request budget (every LSH site shares one monthly allowance)

- All LSH sites share the Cloudflare account's monthly request allowance (10M on Workers Paid), so
  open pages ask sparingly:
  - **one** consolidated `/api/live` every 20 s (60 s in a background tab, immediately on return) —
    never `/api/site-state`, `/api/alert` or `/api/pings` separately from a page;
  - heartbeat every 30 s;
  - progress and leaderboard once a minute, only on a page that shows them and only while in view.
- Pings resume from where the last poll stopped, so a slower poll loses nothing.
- Admin APIs stay under Workers KV's 1,000-operations-per-request limit and say so on the page when a
  program is too large; each progress tab loads only its own program.
- `.github/scripts/requests.cjs` enforces all of this in CI.

## 6. Data, API and secrets

- `json()`, HMAC tokens/cookies, password hashing, login throttle, batch IDs, tombstones and the
  activity log live once, in `functions/_utils.js` (Portal) and `src/util.js` (Knowledge Base, in the
  same formats).
- **The databases are shared** (`TRAINING_DB`, `DB`, `COURSE_KV`, R2 `lshtraining`): a schema change
  must stay backward compatible, and course keys keep their prefixes (`ft:`, `cm:`, `pd:`, `md:`,
  EA/PA unprefixed).
- Admin-only APIs check the session server-side (`/api/program-progress`, `/api/attendance`,
  `/api/gcal-schedule`, `/api/calsim { exclude }`).
- **CSV exports quote against formula injection**; uploads are type-checked by content, not filename.
- Secrets live in Cloudflare Variables and Secrets — `PORTAL_SSO_SECRET`, `MASTER_ADMIN_PASSWORD`,
  `AI_GATEWAY_SECRET`, `AI_RELAY_SECRET`, `SESSION_SECRET`, the `GEMINI_API_KEY*` pool, `EMAIL_FROM`.
  Never in the repo, never in the client. A missing secret must produce a clear, specific message.
- `_redirects` keeps `wrangler.toml`, the Markdown files, `topics_seed.sql`, `.github/` and the
  Functions source off the published site; the Knowledge Base Worker answers 404 for `/seed/*` and
  runs first (`run_worker_first`).
- To add a program: `PROGRAMS` in `functions/api/program-progress.js`, `PROGRAM_ORDER` in
  `progress-records.js`, `PROGRAMS` in `functions/_attendance.js`, and both `SSO_PROGRAMS` lists.

## 7. Knowledge Base editorial rules

- **Nothing is overwritten.** Every save is a new version; history diffs word by word; removing
  archives; only an admin deletes permanently (by typing DELETE); Admin → Download a backup exports
  everything.
- **Every edit waits for approval** — new entries, edits to your own entry, restores, Glossary terms
  and "update current info" notes. Only an admin's own edit goes live at once; **nobody approves
  their own change**; an edit written against a stale version is refused (409); only admins mark
  Official, change settings, or un-archive.
- **Only tenured VAs, reviewers and admins edit.** Info Access readers read and search, nothing else.
- Safe Markdown only (`js/md.js`): text is HTML-escaped first, so nothing a VA types can execute.
- **Titles in sentence case**: ALL-CAPS titles are normalized (`fixTitle`, `scripts/sentence_case.py`),
  acronyms and proper nouns keep their capitals; each fix is a new version.
- **Scope: the law practice itself** (intake, claims, case work, bills and records, demands, medical
  summaries, liens, litigation, practice areas). Company-policy, VA-management and software-tutorial
  material is excluded (`EXCLUDE_CATEGORIES` / `EXCLUDE_TITLES`).
- **Source material is de-identified.** No firm name, address, phone, staff names, e-mail or web
  domain, no card digits, and **never** a username or password copied from a source (`FIXES` in
  `scripts/add_docx.py`). Imported pages carry no badge saying where they came from, and no link
  points back at the old system.
- **Imports are idempotent and keyed** by `legacy_ref` (`tettra:<id>`, `seed:<file>`,
  `train:<lesson>-T<topic>`), run in batches (12 pages / 15 images per call), skip what is unchanged,
  update what changed, and archive what the source no longer carries. Hand-edited terms
  (`edited = 1`) are never overwritten.
- **Content written from general knowledge is flagged for review** — state-specific law, insurance
  practice and damages valuation get a reviewer's or attorney's check; transcriptions are read against
  the originals.

## 8. CI and uptime

- **Checks run on every pull request and every push to the default branch**, in both repos. Red means
  broken, and the log says what.
  - Portal (`.github/workflows/checks.yml`): every JS file and inline `<script>` must parse; every
    local file a page loads must exist; JSON must be valid; the Pages Functions must build (nothing is
    deployed); the request-budget check; feature scripts (batch, registration, front-door,
    master-control, admin-approval, ai-gateway, blueprint, gcal, sim-session, sim-identity,
    sim-results, calls-route, call-results, email-scorecard); and a browser smoke test that opens
    **every** page and simulator at desktop and phone width — it fails on any page error or sideways
    scrolling at phone width.
  - Knowledge Base: `wrangler deploy --dry-run` plus the full end-to-end and unit suites against a
    local `wrangler dev` with fresh seeded data.
- **A new page or simulator must be added to `PAGES` in `.github/scripts/smoke.cjs`.**
- **Builds never deploy from CI** (`--dry-run` / `pages functions build --outdir`).
- **Uptime** (`.github/workflows/uptime.yml`) every 30 minutes at :07 and :37 across the portal and
  its database, the Docket simulator, the four courses, and the CMS; each failure retried once after
  20 s; a failure opens (or comments on) a **site-down** issue and a full pass closes it.
- Checks are runnable locally: `node .github/scripts/check-site.mjs`, `smoke.cjs`, `requests.cjs`,
  `uptime.mjs`.

## 9. Working practice

- **Work on the designated branch**, merged up from the default branch; never push to another
  branch without being asked. If the branch's PR is already merged, restart the branch from the
  default branch instead of stacking on merged history. No PR unless one is asked for.
- **Validate before pushing.** Run the repo's own checks, reproduce the failure a fix claims to fix,
  re-read the diff adversarially, and keep each fix minimal. A push that reddens CI costs more than
  the finding was worth.
- **Docs are part of the change.** `README.md` and `SIMULATORS.md` describe how features work,
  `CODEMAP.md` says what every file is (line counts refreshed by the weekly inventory) — update them
  in the same change.
- **Weekly code inventory** (`.claude/skills/weekly-code-inventory`): a Saturday sweep over bugs,
  dead code, conflicts, stale setups and repo hygiene. Every finding needs a `file:line` and a
  concrete failure path — "could be a problem" is not a finding; an identifier is only dead after a
  repo-wide grep (an `onclick=` or a string-built handler name counts as a caller). It ends with
  fixes pushed, a dated report under `reports/code-inventory/`, and the project Gantt / Milestone
  chart updated.

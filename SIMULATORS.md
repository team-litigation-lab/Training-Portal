# LSH Training Portal — Simulators

Shared simulators live on the main portal (not inside a single course) because every
program reuses them. More than one Claude chat builds here, so **read this file first,
claim a simulator below before starting it, and update it when you ship.**

## Status and ownership

| Simulator | Page | Status | Built by / notes |
|---|---|---|---|
| Hub | `/simulators.html` | Live | Card list in the `SIMULATORS` array |
| Call Simulator | `/simulators/call.html` | Live | Generic callers + CM pack `simulators/call-pack-cm.js` (27 John Doe calls) — CM chat · Foundational pack `simulators/call-pack-ft.js` (14 calls on the CMS Training Library cases: Reception, Calendar Management and Intake mock calls; `?program=FT`, `?line=<line>` opens one line; each call's `caseDoc` shows the case file and a link that opens it in the CMS) — Foundational chat |
| Calendaring | `/simulators/calendar.html` | Live | CM week + EA week — portal chat |
| Email Workspace | `/simulators/email.html` | Live | Gmail-style practice inbox, no real Gmail. Packs in `simulators/email-packs.js` (CM, EA) + "generate for any program" — portal chat |
| Email Replies | `/simulators/email-replies.html` | Live | One email at a time, answered on the portal or from the trainee's own inbox (Postmark delivery, off until configured; see README). Scenarios in `simulators/reply-packs/emails.json` (8 CM + 2 all programs); server: `functions/api/email-practice.js`, `email-inbound.js`, `_email.js` — CM chat |
| Chat Simulator | — | Next | Unclaimed |
| Docket System | `/simulators/docket.html` | Live | Docketing inbox (NEFs and mail to docket and calendar, graded), federal-style court docket reports (incl. the 5 cases from the LSH docket registry prototype), firm calendar (.ics export), rules-based deadline calculator. Data `docket-data.js`; rules `legal-rules.js` (FRCP 6 and the CM course's state method, 2026–27 court holidays). Assignments: federal Harlow case, CM John Doe case — CM chat |
| Medical Records Requests | `/simulators/records.html` | Live | Records request platform on the John Doe file: HIPAA authorization review and e-signature, provider directory, simulated business-day clock, rejections, invoices vs the state fee cap, follow-ups, delivered records to review/flag/log, 100-point objectives. Data `records-data.js`. Describe it by what it does; don't use the name of the commercial platform it imitates — CM chat |
| Court E-Filing | `/simulators/efiling.html` | Live | Federal CM/ECF-style and state e-filing-provider-style wizards with a filing folder to inspect and fix (OCR, /s/ signature, certificate of service, FRCP 5.2 redaction, 35 MB limit, passwords), clerk review and a graded receipt. Scenarios in `efiling-data.js` (federal opposition, John Doe amended complaint, new case) — CM chat |

**New simulator page?** Add it to `PAGES` in `.github/scripts/smoke.cjs`, so the **Checks** workflow opens it on every pull request (it fails on page errors and on sideways scrolling at phone width).

To add program content to an existing simulator, add a pack file (like
`call-pack-cm.js` or a new key in `email-packs.js`) instead of a new simulator.

## Shared conventions (`simulators/sim.js`, `simulators/sim.css`)

- Page shell: load `/app.js`, `/portal.js`, `/simulators/sim.js`, then the simulator's
  own scripts; put `Sim.topbar('<id>')` in `#topbar`; call `Sim.label(...)` for the
  heartbeat view label.
- Trainees don't sign in on the portal. Identity is `Sim.who()` → `{ name, batch, program }`
  (asked once by the "Who's practicing?" card, or passed as `?name=&batch=&program=`).
  Only admins have a session (`Sim.isAdmin()`).
- `?program=CM` / `?program=EA` should open that program's content first.
- Gemini: `Sim.ai({ system, messages:[{role:'user'|'model', text}], json, maxTokens })`
  → `/api/sim-ai` (GEMINI_API_KEY; grading of submitted activities uses GEMINI_API_KEY1 when it's set; public visitors go through `functions/_sim-guard.js`).
  No Anthropic keys.
- Results: `Sim.saveResult({ simulator, scenario, score, summary, details })` — keeps a
  browser copy and sends it to `/api/sim-results` (D1 `simulator_results`) when a name is set.
- Styles: `sim-wrap`, `sim-hero`, `sim-card`, `sim-btn` (primary / orange / ghost),
  `sim-chip`, `sim-table`; navy `#0f2148` + orange `#f97316`. `.sim-wrap` needs
  `width:100%` because the body is a flex container.
- Navigation: every portal page uses `PortalNav.html(active, { back })` from `/portal-nav.js`
  (Home · Training Directory · Simulators · Knowledge Base, plus **← Back**, which goes to the
  previous portal page or to `back` when the page was opened fresh). The simulator top bar
  already includes it. Portal pages open in the **same tab**; only the training programs
  (separate sites, no way back) open in a new tab.
  **Every new page must load `/portal-nav.js`** (a page without its own Back button gets a
  floating one) and must be added to `PAGES` in `.github/scripts/smoke.cjs`: the Checks
  workflow fails any page without a visible "← Back" or with a portal link that opens a new tab.
- Trainee-facing text avoids the word "AI".
- Legal-work simulators (Docket, Records, E-Filing) share `simulators/legal-sim.css`; court deadline math lives in `simulators/legal-rules.js` (`LR.compute`).

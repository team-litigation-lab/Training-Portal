# LSH Training Portal — Simulators

Shared simulators live on the main portal (not inside a single course) because every
program reuses them. More than one Claude chat builds here, so **read this file first,
claim a simulator below before starting it, and update it when you ship.**

## Status and ownership

| Simulator | Page | Status | Built by / notes |
|---|---|---|---|
| Hub | `/simulators.html` | Live | Card list in the `SIMULATORS` array |
| Call Simulator | `/simulators/call.html` → the CMS | Live | **Lives in the CMS** (its 📞 Call Simulator panel; the calls are in the CMS's `call-packs.js`). This address and the Simulators cards send the trainee there through the Portal's sign-in, so nobody signs in again: `functions/_middleware.js` → `/api/launch?tool=cms&to=calls`, carrying `?flow=` (standard, cms, reception, intake, calendaring, ea-pa, pd), `?program=`, `?line=` and `?random=1` (a line's graded call) (`callsQuery` in `functions/api/launch.js`). Every program's lines are there, each with Practice and Graded calls: Standard Training (Reception, Calendar Management, Intake Mock Calls), Case Management, Property Damage and EA / PA. |
| Calendaring | `/simulators/calendar.html` | Live | CM week + EA week — portal chat |
| Google Calendar Simulator | `/simulators/gcal.html` | Live | Foundational Training's Calendar Management (Day 6), in a Google Calendar look-alike (no real Google). The attorney's week (`simulators/gcal-data.js`, `GCAL_ATTORNEY`: the owner's Monday–Friday list with the daily blocks, every week); an Admin can change it for everyone (Settings → Edit the weekly schedule; `functions/api/gcal-schedule.js`, D1 `gcal_schedule`). A set of 7 caller requests (book, move, cancel) dealt so it can be done under the rules; Check my calendar marks each against the rules and saves the score as `Google Calendar`. Each trainee's calendar is kept in their browser. Test: `.github/scripts/gcal.cjs` — Foundational chat |
| Email Workspace | `/simulators/email.html` | Live | Gmail-style practice inbox, no real Gmail. Packs in `simulators/email-packs.js` (CM, EA) + "generate for any program" — portal chat |
| Email Replies | `/simulators/email-replies.html` | Live | One email at a time, answered on the portal or from the trainee's own inbox (Postmark delivery, off until configured; see README). Scenarios in `simulators/reply-packs/emails.json` (8 CM + 2 all programs); server: `functions/api/email-practice.js`, `email-inbound.js`, `_email.js` — CM chat |
| Chat Simulator | — | Next | Unclaimed |
| Docket System | `/simulators/docket.html` | Live | Docketing inbox (NEFs and mail to docket and calendar, graded), federal-style court docket reports (incl. the 5 cases from the LSH docket registry prototype), firm calendar (.ics export), rules-based deadline calculator. Data `docket-data.js`; rules `legal-rules.js` (FRCP 6 and the CM course's state method, 2026–27 court holidays). Assignments: federal Harlow case, CM John Doe case — CM chat |
| Medical Records Requests | `/simulators/records.html` | Live | Records request platform on the John Doe file: HIPAA authorization review and e-signature, provider directory, simulated business-day clock, rejections, invoices vs the state fee cap, follow-ups, delivered records to review/flag/log, 100-point objectives. Data `records-data.js`. Describe it by what it does; don't use the name of the commercial platform it imitates — CM chat |
| Court E-Filing | `/simulators/efiling.html` | Live | Federal CM/ECF-style and state e-filing-provider-style wizards with a filing folder to inspect and fix (OCR, /s/ signature, certificate of service, FRCP 5.2 redaction, 35 MB limit, passwords), clerk review and a graded receipt. Scenarios in `efiling-data.js` (federal opposition, John Doe amended complaint, new case) — CM chat |

**New simulator page?** Add it to `PAGES` in `.github/scripts/smoke.cjs`, so the **Checks** workflow opens it on every pull request (it fails on page errors and on sideways scrolling at phone width).

To add program content to an existing simulator, add a pack file (like a new key in `email-packs.js`) instead of a new
simulator. Calls go in the CMS's `call-packs.js`.

## Graded calls count in the course (`functions/api/call-results.js`)

The CMS Call Simulator sends each **graded** call here, server to server (header `X-Gateway-Key` = `AI_GATEWAY_SECRET`, the
AI gateway's shared secret). It's saved in `simulator_results` on the trainee's Portal account (found by first name, last name
and batch), so the progress page shows it, and in the course's own store, the KV namespace every course Worker shares
(`COURSE_KV`): `<prefix>callsim:<trainee id>` (FT `ft:`, CM `cm:`, PD `pd:`, EA / PA no prefix and its `trainee-alias:`),
with the id the course gives the trainee (the slug of "first last" and the batch). The course shows it on the trainee's
progress: Standard Training by lesson (Reception 4, Calendar Management 5, Intake 6), the others by line.

## Shared conventions (`simulators/sim.js`, `simulators/sim.css`)

- Page shell: load `/app.js`, `/portal.js`, `/simulators/sim.js`, then the simulator's
  own scripts; put `Sim.topbar('<id>')` in `#topbar`; call `Sim.label(...)` for the
  heartbeat view label.
- Trainees don't sign in on the portal. Identity is `Sim.who()` → `{ name, batch, program }`
  (asked once by the "Who's practicing?" card, or passed as `?name=&batch=&program=`).
  Only admins have a session (`Sim.isAdmin()`).
- `?program=CM` / `?program=EA` should open that program's content first.
- Gemini: `Sim.ai({ system, messages:[{role:'user'|'model', text}], json, maxTokens })`
  → `/api/sim-ai`. Public visitors go through `functions/_sim-guard.js` (same-origin only, `SIM_RATE_LIMIT`
  requests per connection per 10 minutes, default 400 — a whole class often shares one office connection).
  No Anthropic keys.
  - **US relay (recommended):** Gemini refuses some regions ("User location is not supported", e.g. Hong Kong),
    and Pages Functions run in the data centre nearest the trainee. Set the secret `AI_RELAY_SECRET` on this
    Pages project **and** the same value on the `ea-pa-training` Worker: `/api/sim-ai` then sends every AI call
    through the Worker's `/api/ai-relay`, which runs in the US (targeted placement) with the EA/PA key pool.
    `AI_RELAY_URL` overrides the relay address. If the relay fails (anything but a rate limit), it calls Gemini directly.
  - **Direct:** every `GEMINI_API_KEY`, `GEMINI_API_KEY1` … `GEMINI_API_KEY9` set here is in the pool (each
    request starts on a random key; a rate-limited or rejected key hands over), with Gemini 3.x "thinking" set
    to low so callers answer quickly.
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

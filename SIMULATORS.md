# LSH Training Portal — Simulators

Shared simulators live on the main portal (not inside a single course) because every
program reuses them. More than one Claude chat builds here, so **read this file first,
claim a simulator below before starting it, and update it when you ship.**

## Status and ownership

| Simulator | Page | Status | Built by / notes |
|---|---|---|---|
| Hub | `/simulators.html` | Live | Card list in the `SIMULATORS` array |
| Call Simulator | `/simulators/call.html` | Live | Generic callers + CM pack `simulators/call-pack-cm.js` (27 John Doe calls) — CM chat |
| Calendaring | `/simulators/calendar.html` | Live | CM week + EA week — portal chat |
| Email Workspace | `/simulators/email.html` | Live | Gmail-style practice inbox, no real Gmail. Packs in `simulators/email-packs.js` (CM, EA) + "generate for any program" — portal chat |
| Email Replies | `/simulators/email-replies.html` | Live | One email at a time, answered on the portal or from the trainee's own inbox (Postmark delivery, off until configured; see README). Scenarios in `simulators/reply-packs/emails.json` (8 CM + 2 all programs); server: `functions/api/email-practice.js`, `email-inbound.js`, `_email.js` — CM chat |
| Chat Simulator | — | Next | Unclaimed |
| Docket System | — | Planned | Unclaimed |
| Medical Records Requests | — | Planned | A medical records request platform (request records and itemized bills, signed HIPAA authorization, track fulfilment, fees and follow-ups, log results to the case file). Unclaimed. Describe it by what it does; don't use the name of the commercial platform it imitates. |

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
  → `/api/sim-ai` (GEMINI_API_KEY; public visitors go through `functions/_sim-guard.js`).
  No Anthropic keys.
- Results: `Sim.saveResult({ simulator, scenario, score, summary, details })` — keeps a
  browser copy and sends it to `/api/sim-results` (D1 `simulator_results`) when a name is set.
- Styles: `sim-wrap`, `sim-hero`, `sim-card`, `sim-btn` (primary / orange / ghost),
  `sim-chip`, `sim-table`; navy `#0f2148` + orange `#f97316`. `.sim-wrap` needs
  `width:100%` because the body is a flex container.
- Trainee-facing text avoids the word "AI".

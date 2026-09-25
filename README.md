# cm-training-activity

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

**Review.** Every VA post and reply waits for an admin. In **🛡 Review & settings** an admin can:
- approve a post, or send it back with a note (the author sees it under **📂 My posts**, edits and resends it);
- feature, hide, edit or delete posts;
- approve or remove replies.

Admins' own posts and replies are published straight away.

**Adding official SOPs.**
1. Put `your-sop.md` (and its original file) in `kb-files/sops/`. The page starts with a short header (title, category, type, summary, tags, owner, version, updated, file); see `kb-files/build_library.py` or the example `using-the-knowledge-base.md`.
2. Run `python3 kb-files/build_library.py`. It checks every header and rebuilds `kb-files/library.json`, which holds the search text.
3. Commit and push.

**Data** (D1 `TRAINING_DB`, created on first use): `kb_articles`, `kb_comments`, `kb_stats` (views, helpful), `kb_votes`, `kb_settings` (the code's hash and version), `kb_rate`. Code: `functions/_kb.js`, `functions/api/kb/`, `kb.html`, `kb.js`, `kb-md.js`.

## Trainee Progress & Feedback (admin)

**Admin → 📊 Progress & Feedback** (`/progress.html`, also linked from Master Control) is the central record of every trainee's training. It has two tabs.

**👤 Trainees**: one row per person, merging all their programs. For each trainee it shows:
- each program they're in, with status and days completed, and their overall completion;
- Knowledge Check, practice (Skill Builder / Practice Lab) and random-task averages;
- the trainer's feedback: how many days were sent, drafts still to review, and the latest rating;
- the feedback they sent about the training (count and average stars);
- simulator practice and graded activities from this portal;
- when they were last active.

Click a trainee for everything on record. Each program shows the day-by-day grid, then every day's trainer feedback: rating, summary, strengths, areas to build, next focus, sent/read status and the private trainer note. Then come their own feedback, simulator runs and portal activities with the grader's comments. Filters: program, status and batch. Sorts include "furthest behind" and "feedback drafts to review". **⬇ CSV** exports one line per trainee per program.

**💬 Feedback from trainees**: everything trainees sent about the programs (star ratings by area and comments; anonymous ones stay anonymous), with average ratings by area, filters by program, day and status, search and CSV.

Where the records come from:
- The programs keep their own trainees and sign-in. The portal reads their records from the course Workers' KV namespace through the `COURSE_KV` binding in `wrangler.toml`, which points at the same namespace as the EA/PA and CM Workers' `LSH_KV`. EA/PA keys have no prefix (`trainee:*`, `feedback:*`, `tfeedback:*`); CM course keys start with `cm:`.
- Simulator results (`simulator_results`) and portal activities (`submissions`) come from this portal's D1 database.
- A person's records are matched across programs, simulators and activities by name, because the programs have separate sign-ins.

The API (`/api/program-progress`) is admin-only and read-only; feedback is written and marked reviewed in each course. It stays under Workers KV's 1,000-operations-per-request limit and says so on the page if a very large roster doesn't fit. To add a program, add it to `PROGRAMS` in `functions/api/program-progress.js` with its key prefix, number of days and course address.

# cm-training-activity

## Email Practice: inbox delivery setup

`/simulators/email.html` works right away in **Answer here** mode. To also send practice emails to trainees' own inboxes and score the replies they send from there, connect [Postmark](https://postmarkapp.com), which handles both sending and receiving. No change to your domain's mail (MX) records is needed.

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

The portal only sends the fixed scenarios in `simulators/email-packs/emails.json`. Sends are limited per connection (`SIM_RATE_LIMIT`) and per recipient address. Replies are matched to their practice email by a random token in the Reply-To address; only the first reply to each practice email is scored.

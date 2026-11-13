# Training programs: what every program must do

Every LSH training program (Foundational, EA / PA, Case Management, PD Claims, Medsum & Demand, Lien Negotiator, and
every program built after them) is its own Cloudflare Worker. Its records are kept in the **shared course KV**, which the
Portal reads as `COURSE_KV`. When a trainer revokes a trainee on the Portal, the revocation has to reach every
program's scorecards. This file is the contract that makes that work. **A new program follows all of it before it goes live.**

## What the Portal does

| On the Portal | In every program |
|---|---|
| **Users → Revoke** (the whole account) | Their records in every program are filed (Drive, or downloaded) and then **deleted**: `<prefix>trainee:<id>` and every `<prefix><kind>:<id>` (`functions/_purge.js` `findCourseRecords`). With no record left, they are on no sheet. |
| **Program Access → Revoke / Suspend** (one program) | Their record id goes on that program's block list, `<prefix>access:blocked` (`functions/_ft-block.js` `programBlock`). |
| **Program Access → Grant / Approve / Restore / Mark Passed** | The Portal's entry comes off that list again (`programUnblock`): they are back on every sheet. |
| 🧹 buttons (Users, Program Access) and the background sweep | The same, for anyone revoked before. |

## A new program: the checklist

1. **Keys.** Keep the trainee at `<prefix>trainee:<id>`, where `<id>` is their name and batch slugged as `name--batch`
   (`candidateIds` in every course's `worker.js`). Keep everything else of theirs at `<prefix><kind>:<id>`, so the last
   `:`-part of a key is always the trainee id.
2. **Portal: the program list.** Add the program to `functions/_programs.js` (`topic`, `id`, `label`, `prefix`). That
   alone makes Revoke and Program Access reach it. Also add it to `functions/api/launch.js` (its URL),
   `programs.html`, `functions/api/program-progress.js` and `functions/_attendance.js` as for the others.
3. **The program's Worker honors `access:blocked`.** Copy the block below (it is the same in every course).
4. **The program's page shows the refusal.** On a `403` with `code: "access-offboarded"`, show an "Access revoked"
   screen, not an error (see Lien Negotiator's `index.html` `api()` and `viewPending()`).
5. Check it: put `{"ids": {"<a test trainee id>": {"why": "offboarded"}}}` at `<prefix>access:blocked`. The test trainee
   should be gone from the program's admin lists and `/api/storage/list`, and the trainee's own sign-in should be refused.

## The Worker code (copy into `worker.js`)

`kv` below is the program's own KV view (its `kvOf(env)`, which adds its prefix; EA / PA uses `env.LSH_KV` directly).

**a. After `listAll`** (every roster, Batch Sheet, ranking and scorecard is built from `listAll`):

```js
/* ---------- 🚫 trainees whose access the LSH Training Portal closed ----------
   access:blocked = {ids: {"<trainee id>": {why: "offboarded", name, batch, at, by: "portal", reason, portalUser}}}, written by the
   Portal (functions/_ft-block.js programBlock / programUnblock). A trainee on it leaves every list here (listAll drops every key of
   theirs), isn't signed in from a Portal ticket, and a session they already hold reads only their own record, shown not approved. */
const BLOCK_KEY = "access:blocked";
const BLOCK_MSG = "Your access to this program has been revoked. Contact your trainer if you believe this is a mistake.";
let BLOCKED = { at: 0, ids: {} };
async function blockedIds(env, fresh) {
  const kv = kvOf(env);
  if (!kv) return {};
  if (fresh || Date.now() - BLOCKED.at > 60000) {
    let v = null; try { v = JSON.parse((await kv.get(BLOCK_KEY)) || "null"); } catch (e) { v = null; }
    BLOCKED = { at: Date.now(), ids: (v && v.ids && typeof v.ids === "object") ? v.ids : {} };
  }
  return BLOCKED.ids;
}
const keyTrainee = (k) => String(k).slice(String(k).lastIndexOf(":") + 1);
async function withoutBlocked(env, keys) {
  const b = await blockedIds(env);
  return Object.keys(b).length ? keys.filter((k) => k === BLOCK_KEY || !b[keyTrainee(k)]) : keys;
}
```

and make `listAll` end with `return withoutBlocked(env, keys);`.

**b. In `traineeSession`**, just before it returns the token:

```js
        if ((await blockedIds(env, true))[chosen]) return json({ error: BLOCK_MSG, code: "access-offboarded" }, 403);
```

**c. In `/api/auth/portal`**, right after `const res = await traineeSession(...)`:

```js
        if (res.status !== 200) return res;   // 🚫 (blocked: access-offboarded)
```

**d. Right after `if (!tok) return json({ error: "Sign-in required" }, 401);`:**

```js
      if (tok.role === "t" && (await blockedIds(env))[tok.id]) {
        const b = await request.clone().json().catch(() => ({}));
        if (path === "/api/storage/get" && b.key === `trainee:${tok.id}`) {
          const rec = JSON.parse((await kvOf(env).get(b.key)) || "null");
          return json({ value: rec ? JSON.stringify(Object.assign({}, rec, { approved: false, rejected: true })) : null });
        }
        return json({ error: BLOCK_MSG, code: "access-offboarded" }, 403);
      }
```

Standard Foundational Training has its own, larger version of this (`blockedIds`, `js/ft-roster.js`); it reads the same list.

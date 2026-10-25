# Getting email working for real buyers

Right now Coverr can only email **you**. This is how to fix that.

Follow it in order. Steps 1–2 take a minute and may finish the whole thing; everything after
that is only needed if step 2 comes up empty.

---

## Where things actually stand

Verified, not assumed — each of these was checked against production or DNS:

| | |
|---|---|
| Your API key | Valid, and belongs to the **`mvillafranca98`** Resend team |
| `macawly.dev` on that team | **Claimed away by another team on 1 Oct.** Permanently frozen — it cannot be verified, reconnected or modified, however correct your DNS is |
| Emails you have been receiving | Sent from `onboarding@resend.dev`, Resend's own shared domain. Nothing to do with `macawly.dev` |
| Why only you get them | That shared sender delivers **only** to the address the Resend account is registered under — `mvillafranca98@gmail.com`. Aliases like `+qa` are rejected too |
| `EMAIL_FROM` in `wrangler.jsonc` | Deliberately removed, which is what switches on that fallback |

**So the product works for you and nobody else.** Fine for QA. Fatal the moment a stranger buys
a ticket: they get a QR on screen and no email, and nothing tells them — or you — that it failed.

**One clue matters more than the rest.** Your Cloudflare zone contains this TXT record on the
root domain:

```
resend-domain-verification=c010b7282c969f1dca71cadca04de017
```

A Resend claim only completes when someone proves they control the domain's DNS. Somebody added
that record to **your** zone — so the team now holding `macawly.dev` is almost certainly another
account of yours, not a stranger's.

---

## Step 1 · Look for your other Resend account

Open [resend.com/domains](https://resend.com/domains).

Top-left, click the **`mvillafranca98`** dropdown. That is the account and team switcher.

**What you are looking for:** any other team or account listed.

- **Something else is listed** → switch to it and go to **Step 2**.
- **Nothing else is listed** → it is a separate login, not a second team on this one. Sign out
  and sign in with your other address — most likely `a.mencias99@gmail.com`. Then **Step 2**.
- **You try both and find nothing** → skip to **Step 4**.

---

## Step 2 · Check whether that account owns the domain

In the other account, open **Domains** and look for `macawly.dev`.

- **It says `Verified`** → this is the account that holds it. Go to **Step 3**. You are about
  five minutes from done and you will not touch DNS at all.
- **It is not there, or says Failed** → go to **Step 4**.

---

## Step 3 · Use that account's key

Still in the account that owns the verified domain:

1. **API keys** → **Create API key**
2. Name it `coverr-production`. Permission: **Sending access** is enough.
3. Copy the key. You will only see it once.
4. In your terminal, in the project folder:

```bash
npx wrangler secret put RESEND_API_KEY
```

It prompts for the value — paste it there. Typing it into a prompt keeps it out of your shell
history and out of any transcript.

5. Tell me it is done. I will restore `EMAIL_FROM` and confirm from production that a send is
   accepted rather than 403'd.

**Then you are finished.** Skip the rest.

---

## Step 4 · Claim the domain back to this team

Only if steps 1–2 found nothing. This is the longer path, and it ends with a **completely new
set of DNS records** — including a new DKIM key that replaces the one you fixed on 25 Oct.

### 4a · Delete the dead entry

Resend → **Domains** → `macawly.dev` → **⋯** menu → **Delete**.

It is already frozen, so nothing is lost. This only clears the way to add it again.

### 4b · Add it back and start the claim

**Add domain** → `macawly.dev` → Region: **North Virginia (us-east-1)**, the same as before.

Because another team holds it, Resend will offer you a **claim** rather than a normal setup. It
will show you an **ownership TXT record**.

### 4c · Prove ownership in Cloudflare

Cloudflare → `macawly.dev` → **DNS → Records** → **Add record**.

Add exactly the TXT record Resend shows. Watch for:

- **Name** is just the label Resend gives — Cloudflare appends `.macawly.dev` itself. Paste the
  full hostname and you end up with `…macawly.dev.macawly.dev`.
- **No quotes.** Cloudflare adds them. Pasting `"abc"` makes the quotes part of the value.
- **No trailing space.** The classic one.
- TTL **Auto**. TXT records cannot be proxied, so there is no orange cloud to worry about.

There is already a `resend-domain-verification=c010b…` record on the root from the *previous*
claim. If Resend gives you a new value for the same name, **replace** it rather than adding a
second — two records at one name is ambiguous and fails.

Back in Resend, press **Verify**.

### 4d · Add the sending records

Once the claim completes, Resend shows the records it wants for sending. Expect DKIM plus SPF.

**Before adding them, delete the `send` CNAME.** Cloudflare currently has:

```
send.macawly.dev   CNAME → send.forge.rmta.net
```

That is the Resend Forge layout, and Forge is **Disabled** on this domain. More importantly, a
CNAME cannot coexist with other records at the same name — it is a DNS rule — so the MX and TXT
Resend asks for *cannot* be added while it is there. Delete it first.

Then add what Resend shows. It will look like:

| Type | Name | Content | Priority |
|---|---|---|---|
| `TXT` | `resend._domainkey` | the **new** `p=…` key Resend gives you | — |
| `MX` | `send` | `feedback-smtp.us-east-1.amazonses.com` | `10` |
| `TXT` | `send` | `v=spf1 include:amazonses.com ~all` | — |

**Use the values on your screen, not these.** The DKIM key will be new — the one you added on
25 Oct belonged to the old, dead entry and will not match.

Leave `_dmarc` alone; `v=DMARC1; p=reject` is already correct.

### 4e · Verify

Press **Verify DNS Records** in Resend. If it does not go green immediately, wait a few minutes
and press it again — your records have a 30-minute TTL, and Resend's resolver may still be
holding the old values.

Tell me when it is green and I will confirm from production.

---

## Step 5 · Restore `EMAIL_FROM` (I do this)

Once the domain is verified on the team that owns your API key, I put this line back in
`wrangler.jsonc` and redeploy:

```json
"EMAIL_FROM": "Coverr <coverr@macawly.dev>"
```

Then I run the live check: create a throwaway band pointing at `delivered@resend.dev` — Resend's
test recipient, which no human receives — trigger a send, read the worker logs, and delete the
band. A `403` means it still is not working. Silence means it is.

**That closes blocker B1**, and real buyers start getting their tickets.

---

## How to tell it worked

Three things should all be true:

1. Resend shows `macawly.dev` as **Verified** on the team your API key belongs to
2. Production logs show no `[email:resend] 403` and no `magic link failed`
3. A ticket sent to an address that is **not** `mvillafranca98@gmail.com` actually arrives

Only the third one proves it. The first two can both look fine while the shared sender is
quietly doing the work.

---

## If you get stuck

Tell me which step and what the screen says. The useful details are: which account you are in,
what Resend lists under Domains, and the exact error text. I can read your DNS directly, so I
can always tell you what Cloudflare is actually serving versus what Resend is asking for.

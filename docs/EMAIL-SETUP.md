# Email on coverr.live

How Coverr sends and receives email, what each DNS record is for, and how to check it still
works. Set up on 3 November 2026.

---

## At a glance

| | |
|---|---|
| Sends from | `Coverr <hola@coverr.live>` — `EMAIL_FROM` in `wrangler.jsonc` |
| Sending service | Resend, on the `mvillafranca98` team, domain `coverr.live` (Verified) |
| API key | The `RESEND_API_KEY` secret. *Sending access*, restricted to `coverr.live` |
| Receives at | `hola@coverr.live` → Cloudflare Email Routing → `mvillafranca98@gmail.com` |
| DMARC | `p=none`, reports in Cloudflare → `coverr.live` → **Email → DMARC Management** |
| Resend free plan | 100 emails a day, 3,000 a month, one domain |

Who a reply reaches depends on the email. A ticket email replies to the band's contact address,
and a band notification (a flagged order, a refund request) replies to the buyer. `hola@` gets
replies to sign-in emails and crash alerts, and anything people write from the legal pages.

`hola@` is also on `OPERATOR_EMAILS`, so it can sign in to `/operador`, and it gets the fee
alerts every operator gets. Whoever Email Routing forwards `hola@` to receives those sign-in
links: adding a destination there makes that person an operator.

---

## The DNS records

All in Cloudflare, zone `coverr.live`. Names are as Cloudflare shows them.

| Name | Type | Content | For |
|---|---|---|---|
| `coverr.live` | MX ×3 | `route1/2/3.mx.cloudflare.net` | Email Routing: receiving `hola@` |
| `coverr.live` | TXT | `v=spf1 include:_spf.mx.cloudflare.net ~all` | Email Routing |
| `cf2024-1._domainkey` | TXT | Cloudflare's DKIM key | Email Routing, for mail it forwards |
| `resend._domainkey` | TXT | `p=MIGf…` | Resend: signs every email Coverr sends |
| `send` | CNAME | `send.forge.rmta.net` | Resend's sending setup |
| `rsend` | CNAME | `rsend.forge.rmta.net` | Resend: the return path every email carries (`…@rsend.coverr.live`), and the SPF that passes for it |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:…@dmarc-reports.cloudflare.net` | DMARC |

Three rules that are easy to break by accident:

- **One SPF record on `coverr.live`, ever.** Two `v=spf1` records at one name make both fail. If
  another service needs SPF on the root, merge its `include:` into the existing record.
- **Nothing else can live at `send` or `rsend`.** Each is a CNAME, and a CNAME cannot share its
  name with any other record. Resend's SPF sits behind them, not beside them.
- **Leave the Email Routing records locked.** Cloudflare marks them *Locked* and re-adds them if
  they disappear; editing them by hand stops `hola@` receiving.

---

## Changing the sender or the key

`EMAIL_FROM` and `RESEND_API_KEY` change together. The key may only send from `coverr.live`, so
an `EMAIL_FROM` on any other domain, or no `EMAIL_FROM` at all, is refused with a `403`.

**To rotate the key:** Resend → **API keys** → **Create**, *Sending access*, domain
`coverr.live`. Then, in the project folder:

```bash
npx wrangler secret put RESEND_API_KEY
```

Paste the key at the prompt, which keeps it out of shell history. It takes effect immediately,
with no deploy. Then delete the old key in Resend.

**To send from another address on the domain:** any `…@coverr.live` works as a sender, but a
reply to it is dropped unless Email Routing has a rule for it — the catch-all is off on purpose.
Add the rule first, then change `EMAIL_FROM` and deploy. If it should also be the address on the
legal pages, change `CONTACT_EMAIL` in `src/views/legal/constants.ts` and both pages' dates.

---

## DMARC: tightening it later

`p=none` only watches. Once two weeks of reports in **DMARC Management** show Resend (and
Cloudflare's forwarding) as the only senders for `coverr.live`, and both passing, change the
policy to `p=quarantine` — on that page, or by editing the `_dmarc` record. Mail that pretends to
be from `coverr.live` then goes to spam instead of the inbox. Run `quarantine` for a while before
considering `reject`.

An unknown sender in the reports is either something legitimate that needs adding (a newsletter
tool, say) or somebody spoofing the domain. Find out which before tightening.

---

## How to tell it works

1. Resend → **Domains** → `coverr.live` says **Verified**.
2. Resend → **Emails** lists recent sends as **Delivered**, from `hola@coverr.live`.
3. A ticket or sign-in email reaches an address that is **not** `mvillafranca98@gmail.com`.
4. An email to `hola@coverr.live` from an outside address arrives in Gmail.

The third is the one that proves real buyers get their tickets. The first two can look fine while
something else is wrong.

The forwarded mail in the fourth can land in Gmail's Spam, as the first test did. A Gmail filter
on `to:hola@coverr.live` with **Never send it to Spam** fixes that for good.

---

## If sending breaks

- **`[email:resend] 403` in the logs.** The domain is no longer verified, or the key is not allowed
  to send from `EMAIL_FROM`'s domain. Check Resend → **Domains** first and press **Verify**; it
  usually means a DNS record above was changed or removed.
- **`[email:resend] 429`.** Too many emails a second, or the free plan's 100 a day is used up.
  Buyers still see their QR on screen right after paying, but the email does not come. A big
  presale day is reason enough for the paid plan.
- **Stopgap while it is fixed.** Unset `EMAIL_FROM` and deploy: the mailer falls back to Resend's
  test sender, `onboarding@resend.dev`, which delivers only to the address the Resend account is
  registered under. Enough for the operator to sign in; nobody else gets anything. It also needs a
  key that is not restricted to `coverr.live`.

---

## History

Until November 2026 Coverr was meant to send from `coverr@macawly.dev`. Another Resend team
claimed `macawly.dev` on 1 October 2026, and a claimed-away domain cannot be verified however
correct its DNS is, so production ran on Resend's test sender and only the account owner ever
received mail. Moving to `coverr.live` replaced that instead of reclaiming the old domain. If the
frozen `macawly.dev` entry is still listed in Resend, it can be deleted; nothing uses it.

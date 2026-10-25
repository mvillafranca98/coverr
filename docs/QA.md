# Production QA

Sign-off before any band outside this room touches Coverr. Every check has a pass condition
you can tick or fail — no "looks fine".

Run it against **production**, where Anthropic extraction, rate limiting and email are real.
Budget about an hour, plus a bank transfer.

State verified on 2026-10-24:

| | |
|---|---|
| Site | <https://coverr.a-mencias99.workers.dev> |
| Band | Daydrinking · `mvillafranca98@gmail.com` |
| Event | Masayoshi Takanaka Special · `/e/masayoshi-takanaka-special` · 5 Dec 2026 · cap 400 |
| Price now | **L1** presale (the L1 rule runs to 5 Dec 18:00) |
| Receiving account | BAC `751367661` · CRISTINA MARIA VILLAFRANCA ALTAMIRANO |

---

## Read this first — three constraints that will waste your time otherwise

**1. Only `mvillafranca98@gmail.com` receives email.** `EMAIL_FROM` is unset, so Resend sends
from its test sender, which refuses every other recipient. I tested `+qa` aliases: Resend
rejects those too, explicitly. So **every email field in this QA must be exactly that address**.
Use any other and the request succeeds, the QR still issues, and the mail silently never
arrives — which looks like a bug and isn't.

**2. Onboarding a new band can't be done here.** A new band needs a contact address that isn't
already in use, and any address other than the one above gets no login link. Signing up again
with the same address just logs you into Daydrinking — by design, so the page can't be used to
discover who has an account. **Do Part 1 locally**; everything else is production.

**3. Email is rate-limited to 5 per 60s per IP**, purchases to 20 per 60s. Real limits, live.
If you retry a login five times in a minute you will be throttled and conclude email is broken
again. Wait a minute between attempts.

---

## Part 1 — Onboarding · run LOCALLY

```bash
npm run dev
```

Magic links print in that terminal. Full detail in [TESTING.md](TESTING.md); this is the
sign-off list only. Stay on `localhost:8787` throughout — the session cookie is host-scoped and
switching to `127.0.0.1` silently logs you out.

- [ ] **1.1** `/registro` with a new band name + any email creates the band and shows *Revisá tu correo*
- [ ] **1.2** The magic link appears in the dev terminal and logs you in
- [ ] **1.3** The onboarding checklist shows three open items
- [ ] **1.4** Adding a bank account ticks item one
- [ ] **1.5** Members whose splits total 99 produce a **warning, not a block**
- [ ] **1.6** Creating an event ticks item three and lands you on the dashboard
- [ ] **1.7** Signing up again with the **same** email sends a login link instead of creating a second band

> Fails here are launch blockers: this is the first five minutes a stranger sees.

---

## Part 2 — Event creation · production

Log in at `/admin/acceso` with `mvillafranca98@gmail.com`.

- [ ] **2.1** The login email arrives within a minute
- [ ] **2.2** The link logs you in. It is **not** single-use — a stateless HMAC with a 15-minute
      expiry and no consumption store, so it can be replayed inside that window (deliberate; see
      `lib/auth.ts`). Check instead that an **expired** link shows *Ese enlace ya venció*
- [ ] **2.3** Dashboard shows the existing event and the real order from 15 Oct
- [ ] **2.4** Order `DAY-8FAT` → **Revisar** clears its stale `DATE_STALE` flag, and the open-flag count drops
- [ ] **2.5** Create a second event, then delete or leave it draft — confirm a draft is **not** publicly reachable at its slug

---

## Part 3 — Ticket buying · production · real money

Open `/e/masayoshi-takanaka-special` in a **private window** — buyers have no session.

- [ ] **3.1** Quantity controls update the total (2 × L1 = L2)
- [ ] **3.2** BAC shows the account number with a working copy button and **no** fee warning
- [ ] **3.3** Switching to another bank shows the **~L40 ACH fee** warning
- [ ] **3.4** Submitting with a missing required field keeps everything you typed — nothing is cleared
- [ ] **3.5** Make the real transfer (L1 or L2) to BAC `751367661`
- [ ] **3.6** Upload the real confirmation screenshot, consent, submit
- [ ] **3.7** **QR codes appear immediately**, before verification has run — the central invariant
- [ ] **3.8** The ticket page shows the short code and one QR per attendee
- [ ] **3.9** **Descargar** produces a composed PNG — event, venue, name, QR — not a bare code
- [ ] **3.10** On a phone, **Compartir** opens the share sheet with Save Image and WhatsApp

> **3.7 is the one that matters most.** If a flag, a slow API or a missing key can ever withhold
> a QR from someone who has paid, the product is broken regardless of everything else.

---

## Part 4 — Transfer verification · production · Anthropic live

Watch the order in **Órdenes**. Extraction reads fields **by label**, then eight fixed rules
decide. No model judges authenticity.

- [ ] **4.1** Within a minute the order shows extracted fields — bank, reference, amount, date
- [ ] **4.2** A correct transfer produces **no amber flag**
- [ ] **4.3** Re-upload the **same image** on a second order → `HASH_DUPLICATE`
- [ ] **4.4** Transfer less than the total → `AMOUNT_SHORT`, with both figures shown.
      **At the current L1 price you must buy at least 5 tickets** for this to fire: the amount
      tolerance is a flat L2, so on a 1–2 ticket order it exceeds the whole total and the check
      silently cannot trigger. See F6.
- [ ] **4.5** Upload a photo of something that isn't a receipt → `NOT_A_RECEIPT`
- [ ] **4.6** Every amber state **names its reason on screen**, in words staff could repeat
- [ ] **4.7** A BAC app screenshot (`15 octubre`, no year) does **not** raise `DATE_STALE` — this is the regression that bit before
- [ ] **4.8** `NAME_MISMATCH`, if raised, appears in admin and **never** at the door
- [ ] **4.9** **Revisar** clears a flag and the order reads as human-checked

> 4.7 and 4.8 are the two that have actually gone wrong. Check them properly.

---

## Part 5 — Email delivery · production

- [ ] **5.1** The ticket email arrives at `mvillafranca98@gmail.com` within a minute of purchase
- [ ] **5.2** QR codes **render in Gmail** — hosted PNGs, not blocked attachments
- [ ] **5.3** Scanning the QR **from the email** works at the door
- [ ] **5.4** `/recuperar` with that address re-sends the tickets
- [ ] **5.5** `/recuperar` with an address that has never bought answers **identically** — no membership leak
- [ ] **5.6** Sender reads sensibly in the inbox *(expect `onboarding@resend.dev` — that is the stopgap, see Blockers)*

---

## Part 6 — The door · production

Event → **Resumen** → *Entrada* → copy the staff link. Open on a phone.

- [ ] **6.1** Loads and reports **LISTA DESCARGADA · LISTO**
- [ ] **6.2** Scanning a valid QR goes **green** and names the attendee
- [ ] **6.3** Scanning the same QR again goes **red** and names the time of the first scan
- [ ] **6.4** With the phone in aeroplane mode a scan **still validates** and queues
- [ ] **6.5** Back online, the queue syncs and the counters correct themselves
- [ ] **6.6** Name search finds an attendee and checks them in
- [ ] **6.7** A cash sale appears in the counts immediately
- [ ] **6.8** A comp checks in, counts toward attendance, and adds **zero** revenue

> **6.4 is the one that decides whether this survives a real venue.** Aeroplane mode, not wifi
> off — and do it on the phone, not a laptop.

---

## Part 7 — Dashboard and settlement · production

- [ ] **7.1** Adentro / vendidos / brazaletes / bruto all move after each action in Part 6
- [ ] **7.2** Revenue by channel splits presale, door-transfer, cash and comps correctly
- [ ] **7.3** Per-account subtotals match what actually arrived in the bank
- [ ] **7.4** Wristbands expected vs actual reconciles
- [ ] **7.5** Adding costs in **Dinero** recomputes net and each member's share
- [ ] **7.6** Splits that don't total 100 **warn without blocking**
- [ ] **7.7** A refund **voids the QR** — that attendee now scans red — and writes a negative line
- [ ] **7.8** The refunded order drops out of revenue totals but **remains in history**
- [ ] **7.9** Band history shows the event with cost trends by category
- [ ] **7.10** Every figure traces to a record; nothing is a typed cell

---

## Blockers before any band is invited

Independent of the checks above. **All of these must be done.**

- [ ] **B1 — Restore `EMAIL_FROM`.** Right now only you receive mail. Every buyer who is not you
      gets a QR on screen and **no email**. Requires resolving the Resend domain claim: delete the
      `macawly.dev` entry on the team holding your API key, re-add it, complete the claim with the
      ownership TXT, then add the fresh DKIM + SPF records — and delete the `send` CNAME so the MX
      and TXT can exist beside it. Then put `EMAIL_FROM` back in `wrangler.jsonc`.
- [ ] **B2 — Restore real prices.** Presale is **L1** for testing. Put the real figure back, or the
      first band to use this sells its tickets for a lempira.
- [ ] **B3 — Restore the band's own bank account.** Money currently goes to BAC `751367661`
      (CRISTINA MARIA VILLAFRANCA ALTAMIRANO), which is a test arrangement, not Daydrinking's account.
- [ ] **B4 — Delete the QA orders** so the band's history and settlement start clean.
- [ ] **B5 — Spend caps** (audit LCH-03, still failing): a cap and low-balance alert on Anthropic, a
      budget alert on Cloudflare, and know your Resend plan limit. Every purchase is a vision call.
- [ ] **B6 — Age gate.** 18+ is stated in the terms and at checkout but enforced nowhere (LEG-11).
      Decide whether that is acceptable for launch.

---

## Recording the result

Date, who ran it, and for every failed check: the check number, what happened, and whether it
blocks launch. A check nobody can reproduce later is a check that was never run.

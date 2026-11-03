# Walking the product end to end

A full pass: create a band, set it up, sell a ticket to yourself, upload a proof, scan it at
the door, and close the books. Roughly 20 minutes.

Run it **locally**. Production works too but its admin is unreachable until the Resend domain
verifies — see *Production* at the bottom.

---

## Setup

```bash
npm run dev
```

Leave that terminal visible. **Every email the product sends prints there as a link**, because
with no `RESEND_API_KEY` locally the mailer falls back to a console transport. That is how you
get in — the admin has no password, only magic links.

```
[email:dev] to=vos@ejemplo.com subject="Entrar a Coverr" id=dev_mvh48niw
[email:dev]   http://localhost:8787/admin/entrar?t=eyJiIjoi...
```

**Stay on `localhost:8787` throughout.** The session cookie is scoped to the host in the link,
so switching to `127.0.0.1:8787` mid-flow silently logs you out and bounces you back to the
sign-in page as though the link had failed.

Optional, and only if you want the proof checks to actually run — add your Anthropic key:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .dev.vars
```

Without it the upload still works and the QR still issues; extraction is skipped and the order
stays `unmatched` with no flags. See *Part 4*.

---

## The data

Use these so the numbers below match what you see. Nothing here is real.

| Field | Value |
|---|---|
| **Band name** | `Los Últimos` |
| **Contact email** | `vos@ejemplo.com` |
| **Bank** | BAC |
| **Account number** | `000111222` |
| **Holder name** | `MARIA JOSE FLORES` |
| **Members** | Vos 30 · Dani 30 · Pato 20 · Chepe 20 |
| **Event name** | `Última Noche` |
| **Venue** | `El Barrio` |
| **Starts** | any Saturday ~3 weeks out, 21:00 |
| **Doors** | same day, 20:00 |
| **Capacity** | `180` |
| **Wristbands** | `180` |
| **Presale price** | `150` |
| **Presale max** | `100` |
| **Door price** | `200` |
| **Refund policy** | 24 horas |

Prices are entered in **lempiras**, not centavos — the form converts.

---

## Part 1 — Onboarding

1. Open <http://localhost:8787/> and hit **Crear mi banda**.
2. Band name and email from the table. Submit.
3. **Read the link out of the dev terminal** and open it. You are in.

You land on a checklist with three items open. Note what it did *not* ask for: no password, no
plan, no card. Two fields.

4. **Agregá tu cuenta bancaria** → bank, account number, holder name. Save.
5. **Agregá a los integrantes** → the four members and their percentages. They total 100; try
   99 and confirm it warns rather than blocks.
6. **Creá tu primer evento** → everything from the table. Save.

> **What to evaluate.** How many fields before the band can sell? Is anything asked for that
> could wait? The event form is the longest screen in the product — does it read as one page
> or as a wall?

---

## Part 2 — The buyer side

7. From the event, copy the public link (`/e/ultima-noche`) and open it in a **private window**
   — buyers have no session, and you want to see what they see.
8. Pick **2 boletos**. Watch the total: 2 × L150.
9. Choose **BAC**. The account number appears with a copy button and no transfer fee note.
   Switch to another bank and the ~L40 ACH fee warning appears — that is the product steering
   buyers to the same-bank account on purpose.
10. Fill in your name, email, phone, and the two attendee names.
11. Upload any image as the proof. Any screenshot works; it is stored either way.
12. Tick the refund consent and submit.

**The QR codes appear immediately.** That is the central invariant: verification has not run
yet and cannot withhold them. Note the short code — you need it later.

> **What to evaluate.** From opening the link to holding a QR, how many taps? Would somebody
> do this on venue wifi, standing up, before the band goes on?

13. Hit **Descargar**. The file is a composed PNG ticket — event, venue, attendee name and
    the QR — not a bare code. **Compartir** only appears where the browser can share files,
    which on desktop is Chrome and Edge but not Firefox; on a phone it opens the share sheet
    with *Save Image* and WhatsApp together.

---

## Part 3 — The door

14. Back in the admin, open the event. The staff scanner link is on **Resumen**, under
    *Entrada* (also in **Ajustes**). Copy it.
15. Open it in another private window. It says **LISTA DESCARGADA · LISTO** — the full attendee
    list is now cached in that browser.
16. Go offline **properly**. Switching off wifi will not do it — the dev server is on
    localhost and stays reachable. Open DevTools → **Network** → throttling → **Offline**.
    Then search a name under **Buscar** and tap **Marcar**.

It still works. The counter moves, the result goes green, and the scan queues. Set throttling
back to *No throttling* and it syncs. That is the offline invariant, and it is worth seeing
work once with your own eyes.

17. Scan the same person again → **red**, naming the time of the first scan.
18. Under **Efectivo**, sell a cash ticket and a comp. Both appear in the counts immediately.

> **What to evaluate.** Could a volunteer who has never seen this run the door with no
> training? Is the green/amber/red distinction readable at arm's length in a dark room?

---

## Part 4 — Transfer receipts

This is the part that needs `ANTHROPIC_API_KEY` set. Extraction reads fields **by label** —
never by position — and then eight fixed rules decide. No model judges authenticity.

Upload a proof and watch the order in **Órdenes**. What each flag means:

| Flag | Fires when | Reaches the door? |
|---|---|---|
| `AMOUNT_SHORT` | The transfer is less than the order total | Yes, amber |
| `AMOUNT_OVER` | More than the total | Yes, amber |
| `DATE_STALE` | Transfer dated well before the order was opened | Yes, amber |
| `DEST_MISMATCH` | Paid into an account that is not the band's | Yes, amber |
| `REF_DUPLICATE` | That reference number was already used | Yes, amber |
| `HASH_DUPLICATE` | That exact image file was already uploaded | Yes, amber |
| `NOT_A_RECEIPT` | The image is not a transfer confirmation | Yes, amber |
| `UNREADABLE` | The format cannot be read at all | Yes, amber |
| `NAME_MISMATCH` | Payer name differs from the buyer | **No — admin only** |

`NAME_MISMATCH` is deliberately invisible to the door. One person paying for four is the normal
case here, and flagging it at the entrance would stop real people getting in.

Things worth trying:

- **Upload the same image twice**, on two different orders → `HASH_DUPLICATE` on the second.
- **Pay the wrong amount** → `AMOUNT_SHORT` / `AMOUNT_OVER`, with the figures on screen.
- **A photo of something else entirely** → `NOT_A_RECEIPT`.
- **A BAC app screenshot**, if you have one. Their notification prints `15 octubre` with no
  year; the extractor returns `10-15` and a stale-date check once read that as 2001. That is
  guarded now, but it is the single most likely thing to regress.

Open the order and press **Revisar** to clear a flag. The order then reads as checked by a
human, and the door stops showing amber.

> **What to evaluate.** Does every amber state say *why*, in words staff could repeat to a
> buyer? An amber that sends somebody to phone you is the failure this is designed around.

---

## Part 5 — Closing the books

19. Event → **Dinero**. Add a few costs: Sonido 4500, Local 2000, Arte 1200.
20. The split appears: gross − costs = net, divided by member percentage, less any dated
    advances.

Every figure traces to a record. Nothing is typed into a cell — which is the whole reason this
exists, since the spreadsheet it replaces had `92` hardcoded and silently stopped updating.

21. **Eventos** → the band's history, with cost trends by category.

---

## What does not work locally

| | Why |
|---|---|
| Ticket email delivery | No `RESEND_API_KEY`. The mail prints in the terminal instead, and the HTML is stashed in local R2 under `outbox/`. |
| Proof extraction | Needs `ANTHROPIC_API_KEY` in `.dev.vars`. Without it the upload stores fine and no flags are produced. |
| Rate limiting | Cloudflare's limiter is a no-op in `wrangler dev`. |
| The nightly proof purge | Cron triggers do not fire locally. Run `purgeExpiredProofs` by hand if you need to see it. |

## Production

Production has all three secrets set, so extraction and rate limiting work there, and email
goes out from `hola@coverr.live`, so a sign-in link reaches any address.

If Resend ever stops accepting the domain, there is a stopgap: **unset `EMAIL_FROM`**. The
mailer then falls back to Resend's own test sender, which delivers *only* to the address the
Resend account is registered under. Enough to log in; useless for real buyers, who would get
nothing. It also needs a key that is not restricted to `coverr.live` — see
[`EMAIL-SETUP.md`](EMAIL-SETUP.md).

## Starting over

Each new email address creates a new band, so the simplest reset is signing up again with
`vos2@ejemplo.com`. To wipe everything and reload the Jungla seed:

```bash
npm run db:reset
```

On Windows that fails if `wrangler dev` is still holding the files — stop it first, and never
run it with its output suppressed, because the error it prints is the one worth reading.

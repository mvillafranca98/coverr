# Security review, November 2026

The owner reviewed coverr.live on 2026-11-06: first from the outside with read-only requests (no
accounts created, no emails sent), then against this repo. Each finding below was checked against
the code before anything was decided. Severity is the triage's own judgment, not the reviewer's
label. This file records what was found, what was fixed and what was decided against, so none of
it has to be re-derived.

Already checked and fine: security headers; no exposed files (`.env`, `.git`, source maps);
output escaping; band-scoped authorization on admin order routes; upload type sniffed from the
bytes; HMAC sessions; single-use 15-minute sign-in links; HttpOnly and SameSite=Lax cookies.

## Decisions

- **Turnstile is deferred** (2026-11-09). The natural place for the check is the final confirm,
  which comes after the buyer has already transferred, so a false block strands somebody who
  paid; doing it properly means checking before the account is shown and issuing a signed pass.
  It would also add a third-party script and iframe to the buy page, a call to Cloudflare in the
  purchase path, and a privacy-notice line, and in-app browsers (Instagram, WhatsApp) are where
  bot checks misfire most. The server-side fixes for S2 and S5 come first. Add it on the first
  sign of abuse: a run of `NOT_A_RECEIPT` or `HASH_DUPLICATE` orders, Resend answering 429, or
  an unexplained jump in Anthropic spend. If it comes earlier, start with `/registro`,
  `/admin/acceso` and `/recuperar`, where a false block costs a retry rather than a paid ticket.
- **Resend stays on the free plan** (2026-11-09) until three or more bands have an active event
  at the same time. Until then the 100 emails a day are a shared, exhaustible resource, so the
  fixes that save email (S5) come before anything that assumes a bigger quota.
- **No automatic voiding.** Voiding an order the model called "not a receipt" would break "the
  QR issues immediately, always" and would let a misread genuine receipt cost a buyer their
  ticket. Rejected for S2.
- **Order of work:** S1, S3, S5 and S2, S11, S4, S9 and S8, S7, S10. S6 is the owner's, with no
  code.

## Findings

| # | Finding | Severity | Status | STANDARDS |
|---|---|---|---|---|
| S1 | Receipt verification fails open | High | ✅ Fixed 2026-11-09 | AI-09 |
| S2 | Junk uploads can sell out an event | Medium | Planned | SEC-06 |
| S3 | A band session survives a change of the band's email | Medium | ✅ Fixed 2026-11-09 | SEC-12 |
| S4 | The door link never expires, and can still write | Low–medium | Planned | SEC-12 |
| S5 | Email limits are per IP only; recovery multiplies emails | Low–medium | Planned | SEC-05, SEC-06 |
| S6 | Operator access rests on personal Gmail inboxes | Low | Owner, no code | — |
| S7 | The CSP allows inline scripts | Hardening | Planned | SEC-10 |
| S8 | Order ids are weaker capabilities than QR tokens | Hardening | Planned | — |
| S9 | No Origin check; logout by GET; login CSRF on `/entrar` | Low | Planned | — |
| S10 | Internal comments ship in inlined CSS and scripts | Cosmetic | Planned, optional | — |
| S11 | Check-in sync queries in a loop | Low–medium (a bug) | Planned | PERF-02 |

---

## S1 · Receipt verification fails open

**Severity: high** — ✅ **FIXED 2026-11-09**

**What was true.** Missing evidence was treated as no problem:

- The rules only ran on fields that were read. A receipt that did not show the destination
  account or the amount raised nothing, and its order was `matched`.
- An illegible receipt, a failed read (timeout, API error, refusal) and an unreadable format each
  raised `UNREADABLE` at info severity. The panel showed those as "revisar", but the door dropped
  every info flag, so they were green.
- With the `proof_extraction` switch off, the key missing, the file missing from R2 or the job
  cut off, no flag was raised at all: "ok" in the panel and green at the door.
- The settlement counted every confirmed order as gross revenue, and the band guide said "OK:
  todo cuadra".

The cheapest exploit was not forgery. Crop the destination account and the date out of any old
BAC transfer for the right amount, upload it, and the order came back clean and green. Chained
with S2, spending the Anthropic limit first left every later receipt unread and green.

A convincing typed-up receipt with the band's account, the right amount and today's date still
passes every rule. That is the accepted cost of accepting screenshots without judging them, and
the band's check against it is the "Por cuenta" totals compared with what reached the bank.

**The fix.** One rule everywhere: every open flag except `NAME_MISMATCH` means a person should
look, whatever its severity. Severity decides who is interrupted (critical emails the band), not
whether the door sees it.

- `lib/verify.ts`: a new `MISSING_FIELDS` warning ("Faltan datos") when a legible receipt does not
  show the destination account or the amount. An account printed with fewer than four digits
  counts as not shown, not as somebody else's account, so it no longer raises a false
  `DEST_MISMATCH`. Not raised on an illegible receipt, where `UNREADABLE` already says why.
- `lib/verify.ts`, `routes/public/purchase.tsx`: the purchase writes `NOT_YET_READ`, an
  `UNREADABLE` flag reading "Todavía no se leyó el comprobante — revisar a mano". The first read
  that completes replaces it, so every path where no read completes leaves the order amber.
- `routes/scan.ts`: the door drops only `NAME_MISMATCH`, the same exception the panel and the
  dashboard already made.
- `jobs/verify-proof.ts`: `matched` only when no open flag other than `NAME_MISMATCH` remains,
  counted from the table so a `HASH_DUPLICATE` raised at upload counts too. It used to be set
  from the read's own flags and missed it. `worstSeverity` became unused and was deleted.
- `jobs/retry-proof-reads.ts`, hourly at :17 (`wrangler.jsonc`, `src/index.tsx`): reads again the
  proofs whose read failed or never ran, for events that started less than a day ago or have not
  started, 20 an hour, oldest first. It does nothing while the switch is off or the key is
  missing. It alerts the band only when its own read finds something critical, because a
  recycled file was already reported at purchase and the free mail plan has no room for the same
  alert twice.
- The money page says how much of the gross comes from orders still to review, with a link to
  them. It is a note, not a lock, so the paywall rule is untouched.
- Copy: the band guide says what OK means (the receipt shows your account and the right amount;
  that the money arrived you confirm in your bank) and lists "Faltan datos". The operator guide
  and the runbook say what the switch now does at the door.

**What changes for real buyers.** Nothing in the normal case: a receipt that is read and matches
stays green. BAC is about 99% of volume, and in the model eval Sonnet 5.5 read the account and
the amount on every BAC receipt. What turns amber is the orders bought during an outage or while
the switch is off, until the hourly retry reads them. Other banks are untested.

**Invariants.** All kept: the QR still issues immediately, the rules stay deterministic, amber
names its reason, and `NAME_MISMATCH` never reaches the door. The spec contradicted itself (its
flag table made `UNREADABLE` info, its door table listed "comprobante ilegible" as an amber
reason); both hold now, with no severity changed. CLAUDE.md gained the invariant "Missing
evidence is never a pass".

**Verified.**

- Unit tests for `MISSING_FIELDS`, the fewer-than-four-digits case, the illegible case, the free
  order and the band with no accounts (`tests/verify.test.ts`).
- The end-to-end run now asserts that an unread receipt is amber at the door with "Todavía no se
  leyó" and that staff can admit it; it used to expect green.
- Locally, against a stand-in vision API:
  - a read failing with 529 showed its reason in the door's attendee list;
  - the money page showed "L250.00 de este bruto viene de 1 orden por revisar";
  - firing the hourly cron read it, cleared the flag and set the order `matched`;
  - with the switch off, a purchase kept "Todavía no se leyó" and the retry left it alone; turned
    back on, the retry replaced it and kept the `HASH_DUPLICATE`, and the order stayed `flagged`;
  - a retry whose read found nothing critical sent no second alert.

  The local test orders, files and settings were removed afterwards.

**Existing orders.** Nothing was backfilled. An order bought before this change whose read never
completed carries no flag and stays green; **Volver a leer el comprobante** on its order page reads
it now. One already flagged `UNREADABLE` turns amber at the door on the next list download, and
the hourly retry picks it up if its read had failed.

## S2 · Junk uploads can sell out an event

**Severity: medium** — planned

Orders are written `confirmed` at upload, and the capacity check and the presale allocation count
every confirmed order whatever its flags (`db/queries/orders.ts`). The only limit is 20 purchases
a minute per IP, at up to 10 tickets each, so one IP with any valid image can fill a 300-person
show in about two minutes, or push real buyers onto the next, dearer price. Each junk order also
costs one vision call and sends one email to whatever address was typed: one IP can use up the
day's 100 Resend emails in about five minutes, which stops ticket emails and band sign-in links
for every band until 00:00 UTC (18:00 in Honduras). Mail to invented addresses bounces, and a
rising bounce rate can get the Resend account paused.

**Planned fix:** leave orders with an open `NOT_A_RECEIPT` or `HASH_DUPLICATE` flag out of the
capacity and allocation counts (the buyer keeps the QR, and a resolved flag puts the order back
in the count); add a second, per-event purchase limit. Turnstile is deferred (see Decisions).

## S3 · A band session survives a change of the band's email

**Severity: medium** — ✅ **FIXED 2026-11-09**

**What was true.** `requireSession` (`routes/admin/session.tsx`) checked that the band existed and
was not banned but never compared the session's email with `band.contactEmail`, and sessions
last 30 days. Moving the band to a new address changed only the band row. Losing control of the
old address is the usual reason to move, and whoever held it kept the panel.

**The fix.**

- `lib/sign-in.ts`: `bandSessionFrom` reads a session cookie as its band and the email it proved,
  and `sessionHoldsBand` says whether that email is still the band's, ignoring case and spaces.
- `requireSession` runs that check on every request, after the ban check. On a mismatch it
  clears the cookie and sends the person to `/admin/acceso?correo=1`, which says the band now
  signs in with another address. Every device signed in with the old address is out on its next
  click; the person who confirmed the move already holds a session for the new one.
- Sessions signed before 2026-11-04 carry no email, so there is nothing to hold them to. They are
  refused, and the legacy branch that kept them working is deleted, along with the "volvé a entrar"
  fallback on the bands page and the null checks in `routes/admin/bands.tsx`. Anyone still on
  one of those sessions signs in again once.
- Switching between bands (`POST /admin/bandas/cambiar`) uses the same `sessionHoldsBand` check.

Nothing here touches a buyer, the door or money, so no invariant is involved.

**Verified.** Unit tests for a held session, a moved band, case and spaces, and the refused old
sessions (`tests/sign-in.test.ts`). The end-to-end run moves band B to a new address from another
device, then checks that band B's first device lands on the "otro correo" note and stays signed
out.

**Still open:** a "sign out everywhere" for a band that suspects a copied cookie. It needs a
`session_epoch` on bands and a migration, so it is left for later (SEC-12).

## S4 · The door link never expires, and can still write

**Severity: low–medium** — planned

`eventForToken` (`routes/scan.ts`) has no time or status check. An old link still returns the
attendee list with names and notes, and still accepts cash sales, comps and check-ins, so it can
change a past event's gross and payouts. The `settled` status is enforced nowhere. The scanner
keeps the list in local storage, and the service worker caches the `/scan/<token>` page, on
volunteers' own phones. The token appears in Workers Logs request URLs, which only the Cloudflare
account can see; the error log strips it.

**Planned fix:** by date, not status, because "Venta cerrada" events still sell at the door.
Refuse the attendee list, cash sales and stats once the event's start is 24 hours past; keep
accepting check-in syncs for a few days so an offline device does not lose its queue; have the
scanner clear its storage and cached page when told the event is over.

## S5 · Email limits are per IP only; recovery multiplies emails

**Severity: low–medium** — planned

Every mail-sending form shares one per-IP key (`mail:${ip}`, 5 a minute). `/recuperar` sends one
email per live order on the address, so with 10 orders under one address a single IP sends 50
emails a minute. Cloudflare's rate-limit binding only counts per 10 or 60 seconds, so a daily
per-address cap would need a table.

**Planned fix:** also limit by recipient (`mail-to:${email}`, the same binding), and make
`/recuperar` send one email listing every order on the address.

## S6 · Operator access rests on personal Gmail inboxes

**Severity: low** — the owner's, no code

`OPERATOR_EMAILS` holds two personal Gmail addresses and `hola@coverr.live`, and every Email
Routing destination of `hola@` is an operator too (`wrangler.jsonc`). Whoever controls any of
those inboxes, or the Cloudflare account, has every band's buyers and settings. Put a passkey or
hardware key on both Google accounts and on Cloudflare, and trim the list to what is needed.

## S7 · The CSP allows inline scripts

**Hardening** — planned

`'unsafe-inline'` in `script-src` (`src/index.tsx`). There are about nine inline script blocks and
no inline event handlers, so a nonce covers everything. Three of the blocks carry band-provided
data (escaped by `lib/core.ts`), so SEC-10's condition for nonces is already met. Moving the
scripts to files would break the deliberate inlining for venue wifi; a nonce does not.

## S8 · Order ids are weaker capabilities than QR tokens

**Hardening** — planned

`/boletos/:orderId` and `/reembolso/:orderId` are protected by the order id alone, which carries
40 random bits against the QR tokens' 130. Not guessable online. **Planned fix:** a 26-character
random part for new order ids; old ids and links keep working and nothing parses the format.

## S9 · No Origin check, logout by GET, login CSRF

**Severity: low** — planned

No route checks the request's Origin, and every signed-in POST relies on SameSite=Lax alone. The
only GETs that change state are the two logouts. `POST /admin/entrar` and `/operador/entrar`
accept cross-site posts, so an attacker can post their own unused sign-in link and sign a victim
into the attacker's band. **Planned fix:** `hono/csrf` app-wide against `APP_ORIGIN` (it ships
with Hono, and the scanner's JSON requests are unaffected); logout by POST. `/health` stays as it
is: the uptime monitor needs it.

## S10 · Internal comments ship in inlined CSS and scripts

**Cosmetic** — planned, optional

Comments are about 21% of the stylesheet source (17.5 of 83.7 KB), and the landing page's HTML
mentions `DESIGN.md` four times. Strip CSS comments where the layouts inline them. The scripts
cannot be stripped safely by pattern; trim them by hand or leave them.

## S11 · Check-in sync queries in a loop

**Severity: low–medium, a bug** — planned

`routes/scan.ts` runs a SELECT and an UPDATE per scan. A full 500-scan sync is up to 1,002
queries, over D1's 1,000 per request on Workers Paid, so it fails after writing about 499; the
scanner retries and reports its own scans as already inside ("N ya estaban adentro — revisá
brazaletes"). The update has no condition, so two devices syncing the same ticket at once both get
"ok", which breaks "a cross-device double scan is flagged at sync". **Planned fix:** read the
tickets in chunks of at most 90 (D1 allows 100 bound parameters), then one `db.batch` of updates
conditioned on `checked_in_at IS NULL`.

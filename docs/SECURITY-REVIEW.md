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
- **No per-event purchase limit** (2026-11-09). Once junk stopped holding places, a per-event
  limit would mainly have let anyone with a script stop an event's sales for a minute at a time.
  Dropped from S2.
- **Order of work:** S1, S3, S5 and S2, S11, S4, S9 and S8, S7, S10. S6 is the owner's, with no
  code.

## Findings

| # | Finding | Severity | Status | STANDARDS |
|---|---|---|---|---|
| S1 | Receipt verification fails open | High | ✅ Fixed 2026-11-09 | AI-09 |
| S2 | Junk uploads can sell out an event | Medium | ✅ Fixed 2026-11-09 (capacity) | SEC-06 |
| S3 | A band session survives a change of the band's email | Medium | ✅ Fixed 2026-11-09 | SEC-12 |
| S4 | The door link never expires, and can still write | Low–medium | ✅ Fixed 2026-11-09 | SEC-12 |
| S5 | Email limits are per IP only; recovery multiplies emails | Low–medium | ✅ Fixed 2026-11-09 | SEC-05, SEC-06 |
| S6 | Operator access rests on personal Gmail inboxes | Low | Owner, no code | — |
| S7 | The CSP allows inline scripts | Hardening | Planned | SEC-10 |
| S8 | Order ids are weaker capabilities than QR tokens | Hardening | ✅ Fixed 2026-11-09 | — |
| S9 | No Origin check; logout by GET; login CSRF on `/entrar` | Low | ✅ Fixed 2026-11-09 | SEC-10, SEC-12 |
| S10 | Internal comments ship in inlined CSS and scripts | Cosmetic | Planned, optional | — |
| S11 | Check-in sync queries in a loop | Low–medium (a bug) | ✅ Fixed 2026-11-09 | PERF-02 |

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

**Severity: medium** — ✅ **FIXED 2026-11-09** (the capacity half; see "Still true")

**What was true.** Orders are written `confirmed` at upload, and the capacity check, the presale
allocation and the choice of which price is on sale all counted every confirmed order whatever
its flags. The only limit is 20 purchases a minute per IP, at up to 10 tickets each, so one IP
with any valid image could fill a 300-person show in about two minutes, or push real buyers onto
the next, dearer price. Each junk order also costs one vision call and sends one email to
whatever address was typed: one IP can use up the day's 100 Resend emails in about five minutes,
which stops ticket emails and band sign-in links for every band until 00:00 UTC (18:00 in
Honduras). Mail to invented addresses bounces, and a rising bounce rate can get the Resend
account paused.

**The fix.**

- `lib/verify.ts`: `FLAGS_THAT_FREE_A_PLACE` names the flags that are evidence an upload is not a
  payment for its order: `NOT_A_RECEIPT`, `HASH_DUPLICATE`, `REF_DUPLICATE` and `DEST_MISMATCH`.
- `db/queries/orders.ts`: `holdsAPlace` is the one condition for a ticket that occupies a place:
  live, on a confirmed order, with none of those flags open. The capacity check (`placesTaken`,
  was `confirmedTicketCount`), a price's allocation (`placesTakenUnderRule`, was
  `ticketsSoldUnderRule`) and the choice of which price is on sale (`resolveSellableRule`) all
  use it, so they cannot disagree. A repeated file is flagged at upload and frees its place
  at once; an image that is not a receipt frees it a few seconds later, when it is read.
- The buyer keeps the QR either way, so "the QR issues immediately, always" holds. Resolving the
  flag gives the place back, even when the event has filled in the meantime, which can oversell
  by that order; the band guide says so.
- `MISSING_FIELDS` and `UNREADABLE` keep their places on purpose: they are also what a genuine
  buyer's cropped screenshot, or an outage at the API, look like.

**Not done, deliberately.** The per-event purchase limit in the original plan was dropped. With
junk no longer holding places, its remaining effect would have been to give anyone with a script
a way to stop an event's sales for a minute at a time by using up its allowance — a cheaper
attack than the one it guards against. Turnstile stays deferred (see Decisions).

**Verified.** Unit tests pin which flags free a place and which do not (`tests/verify.test.ts`).
Locally, on the demo event set two places short of full: a first purchase took a place, a second
with the same file was accepted and flagged `HASH_DUPLICATE`, a third with another file was
accepted because the duplicate held no place (before, it would have been refused), and a fourth
was refused with "Ya no quedan boletos". The end-to-end run passes. The test orders were removed
and the event restored.

**Still true.**

- A junk order still costs one vision call and sends one ticket email before it is read.
  Sending the ticket email only after the read, and not at all for a repeated file or a
  non-receipt, would stop most of that mail; it changes F3 ("the codes arrive by email within a
  minute") for those orders, so it is left for the owner to decide.
- An attacker who first uses up the Anthropic limit leaves every later upload unread, and unread
  orders keep their places. Turnstile is the answer if that is ever seen.

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

**Severity: low–medium** — ✅ **FIXED 2026-11-09**

**What was true.** `eventForToken` (`routes/scan.ts`) had no time or status check. An old link
still returned the attendee list with names and notes, and still accepted cash sales, comps and
check-ins, so it could change a past event's gross and payouts. The `settled` status is enforced
nowhere. The scanner kept the list in local storage, and the service worker cached the
`/scan/<token>` page, on volunteers' own phones, forever. The token appears in Workers Logs
request URLs, which only the Cloudflare account can see; the error log strips it.

**The fix.** By date, never by status, because a "Venta cerrada" event still sells at the door.

- `lib/door-window.ts`: `doorAccess` says what a link may still do. Until a day after the start
  (`DOOR_OPEN_HOURS`) everything works. From then until a week after (`LATE_SYNC_DAYS`) only
  check-in syncs are taken, so a device that lost signal does not lose its scans. After that,
  nothing. A start time that cannot be read leaves the door open, so a bad date can never be what
  locks staff out on the night. Postponing the event moves the window with it.
- `routes/scan.ts`: the attendee list, cash sales and stats answer `410 event_over` once the door
  has closed; check-in syncs only once the week is over. The scanner page and its error reports
  are served until then, since the page is what sends a late sync, and after it the page says the
  link no longer works.
- `public/scanner.js`: on a `410` the list leaves the phone at once, scanning and cash sales say
  "El evento terminó", queued scans go out with the next sync, and then the scanner removes
  everything this link stored (list, queue, error reports, device name) and its cached page. A
  phone that opens the link offline after the night drops the list by its own clock, keeping only
  the unsent scans. A list the server still hands out reopens it, so a wrong clock cannot lock a
  working door. The closed page loads the same script only to clear what an earlier night left.
- `scripts/shoot.mjs`: the demo show stays dated 24 October 2026 so the landing page's shots never
  change; the scanner shot moves it to now while it is taken and puts it back. The README says how
  to do the same to try the demo scanner locally.

**Verified.** Unit tests for each window, a postponed event and an unreadable date
(`tests/door-window.test.ts`). Locally:

- The demo link (dated six weeks back) served the closed page with a 410, and opening it removed
  a list and device name planted in the phone's storage.
- With the show moved to 30 hours ago and one scan queued offline from that night, the scanner
  dropped the list, synced the scan (recorded with its original time and device), cleared its
  storage and said "los escaneos pendientes ya se registraron"; the list and a cash sale answered
  410.
- `npm run shots -- shot-scanner acople` produced a scanner shot byte-identical to the committed
  one, and left the demo's date as the seed has it.

The end-to-end run passes; its event is a month ahead.

## S5 · Email limits are per IP only; recovery multiplies emails

**Severity: low–medium** — ✅ **FIXED 2026-11-09**

**What was true.** Every mail-sending form shared one per-IP key (`mail:${ip}`, 5 a minute), so
anyone with a few connections could keep one inbox filling with sign-in links or tickets.
`/recuperar` resent each order's full ticket email, one by one, for every show the address had
ever bought: ten orders were ten emails per request, 50 a minute from one IP. With Resend on the
free plan (100 a day for the whole platform), that was the cheapest way to stop every band's
sign-in links for the rest of the day.

**The fix.**

- `lib/rate-limit.ts`: `withinMailLimit` checks the caller (`mail:${ip}`) and then the inbox
  (`mail-to:` plus a SHA-256 of the normalised address), on the same `EMAIL_LIMIT` binding, 5 a
  minute each. The address is hashed because `withinLimit` logs its key when the limiter fails,
  and an address does not belong in the logs. A caller already over its limit does not spend the
  inbox's allowance, and the inbox is counted whether or not the address is known, so a refusal
  reveals nothing about who has an account.
- Every form that sends mail uses it: band sign-in, operator sign-in, `/registro`, `/recuperar`,
  refund requests (keyed on the band's inbox, which is what they mail) and a band's email change
  (keyed on the new address). Sign-in and sign-up now validate the address before the limit, so a
  mistyped address no longer spends an attempt.
- `/recuperar` sends one email (`jobs/send-recovery.ts`, `recoveryEmailHtml`) listing every order
  on the address for events that started less than a day ago or have not started, up to 20, each
  with a "Ver mis boletos" link to its ticket page, where the QR codes are. Past shows are no
  longer resent. The lookup moved after the response, so its timing says nothing either.

**Verified.** Unit tests: an inbox refused from any number of callers once it is over, a caller
over its limit not spending the inbox's allowance, the key hashed and normalised with no address
in it (`tests/rate-limit.test.ts`); the recovery email links every order in both versions and
escapes what was typed (`tests/recovery-email.test.ts`). Locally, `/recuperar` for a demo buyer
with three orders on an upcoming event sent one email with three links, where it used to send
three.

**Still true.** The rate-limit binding counts per minute only, so it cannot hold an inbox to a
few emails a day, and many addresses from many IPs can still use up the daily 100. The real
ceiling is the Resend plan, which moves to paid once three or more bands have an active event at
once (see Decisions).

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

**Hardening** — ✅ **FIXED 2026-11-09**

`/boletos/:orderId` and `/reembolso/:orderId` are protected by the order id alone, which carried
40 random bits against the QR tokens' 130. Not guessable online, but the weakest key in the buyer's
hands.

**The fix.** `newOrderId` (`lib/core.ts`) gives every new order a 26-character random part, 130
bits like a QR token, for online, door, manual and cash orders alike. Old ids and the links already
mailed keep working: nothing reads the format, and the error reports already strip ids of any
length. **Verified:** unit tests for the length, the alphabet and uniqueness
(`tests/core.test.ts`); the end-to-end run's refund step opens `/reembolso/` with a new id.

## S9 · No Origin check, logout by GET, login CSRF

**Severity: low** — ✅ **FIXED 2026-11-09**

**What was true.** No route checked the request's Origin, and every signed-in POST relied on
SameSite=Lax alone. The only GETs that changed state were the two logouts. `POST /admin/entrar` and
`/operador/entrar` accepted cross-site posts, so an attacker could post their own unused sign-in
link and sign a victim into the attacker's band.

**The fix.**

- `src/index.tsx`: `hono/csrf`, which ships with Hono, on `/admin/*` and `/operador/*`. A form post
  passes when the browser says it is same-origin (`Sec-Fetch-Site`) or sends a matching `Origin`;
  anything else gets a 403 with a Spanish line, and `app.onError` treats that refusal as an answer,
  not a crash to report. JSON calls are untouched: a browser will not send one cross-site without a
  CORS preflight, which nothing here answers.
- **Scoped to the panels, not app-wide as planned.** The buyer's forms hold no session to abuse,
  and a purchase refused because an old browser or a privacy extension sent neither header would
  strand somebody who has already transferred.
- Signing out is a POST from the Salir button, in both panels (`endSession` in
  `routes/admin/session.tsx`, which every forced sign-out now goes through too). A GET to the old
  address only opens the panel. The button is styled exactly like the links beside it, at the same
  45px height.
- `/health` stays as it is: the uptime monitor needs it.

**Verified.** The end-to-end run posts to `/admin/crear` with a foreign `Origin` and gets 403, and
with its own origin reaches the route. Locally: a cross-site sign-in request and one with neither
header got 403, a same-origin one went through, a buyer's `/recuperar` with neither header still
worked, `GET /admin/salir` redirected to the panel, and Salir in the browser signed the demo band
out.

## S10 · Internal comments ship in inlined CSS and scripts

**Cosmetic** — planned, optional

Comments are about 21% of the stylesheet source (17.5 of 83.7 KB), and the landing page's HTML
mentions `DESIGN.md` four times. Strip CSS comments where the layouts inline them. The scripts
cannot be stripped safely by pattern; trim them by hand or leave them.

## S11 · Check-in sync queries in a loop

**Severity: low–medium, a bug** — ✅ **FIXED 2026-11-09**

**What was true.** `routes/scan.ts` ran a SELECT and an UPDATE per scan. A full 500-scan sync was
up to 1,002 queries, over D1's 1,000 per request on Workers Paid, so it failed after writing about
499; the scanner retried and reported its own scans as already inside ("N ya estaban adentro —
revisá brazaletes"). The update had no condition, so two devices syncing the same ticket at once
both got "ok" and the second overwrote the first, which broke "a cross-device double scan is
flagged at sync".

**The fix.**

- `db/queries/check-ins.ts`: `ticketsByToken` reads a sync's tickets in chunks of 90 tokens (D1
  binds at most 100 parameters, and the event id takes one); `checkInTickets` writes every
  check-in in one `db.batch`, each only while the ticket is still outside, and returns the ids it
  actually let in. A 500-scan sync is now about nine queries.
- `lib/check-in.ts`, pure: `decideCheckIns` gives each scan its result in the order the device
  made them, exactly as before (unknown, voided, already inside with who and when, or ok), and
  treats a second scan of one ticket in the same sync as a double scan.
  `settleLostClaims` turns a check-in another device wrote between this sync's read and its
  write into "already", naming that device.
- The scanner is unchanged: the response has the same shape.

**Verified.** Unit tests for every result, the double scan within one sync and a lost claim
(`tests/check-in.test.ts`). Locally, with the demo event's check-ins cleared: one 500-scan sync
(157 real tickets, 10 repeats, 333 unknown tokens) came back as 157 ok, 10 already inside naming
the first scan, 333 unknown, and 157 inside, in one request. Two devices syncing the same ticket
at the same moment, five times: each time exactly one was let in and the other was told who was
first. The end-to-end run's offline sync passes. The demo check-ins were restored exactly from a
backup afterwards.

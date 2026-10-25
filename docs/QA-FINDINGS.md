# QA findings

Raised during the production QA run. Each entry says what was observed, what the code actually
does, and what the decision is — so none of this has to be re-derived later.

Nothing here is fixed yet. Fix after the QA completes, not during: changing the product
mid-run invalidates the checks already ticked.

---

## Run log

| Part | Status | Date |
|---|---|---|
| 1 — Onboarding (local) | ✅ all checks passed | 2026-10-24 |
| 2 — Event creation | ✅ passed · `DAY-8FAT` flag cleared, draft slug confirmed 404 | 2026-10-24 |
| 3 — Ticket buying | ✅ passed · order `DAY-TA3Z`, L2, QR immediate, share + email confirmed | 2026-10-24 |
| 4 — Verification | ✅ 4.1–4.3, 4.5–4.9 passed · **4.4 retest needed**, see F6 | 2026-10-25 |
| 5 — Email | ✅ 5.1 confirmed; 5.2–5.6 outstanding | 2026-10-24 |
| 6 — Door | not started | |
| 7 — Dashboard | not started | |

Backend evidence for the Part 3 purchase:

```
[tickets] sent order=DAY-TA3Z to=mvillafranca98@gmail.com
[verify] DAY-TA3Z app_notification amount=2 ref=412447811 flags=none
```

Extraction classified a BAC app notification, read the amount and reference correctly, and
raised nothing. That quietly confirms **4.7** — the app notification carries a year-less date,
which is the exact case that used to false-flag `DATE_STALE`.

---

## F1 · Navigation conflates two different scopes

**Severity: medium · pre-launch**

**Observed.** The admin bar mixes tabs belonging to the *selected event* (`Resumen`, `Órdenes`,
`Venta`, `Dinero`, `Ajustes`) with tabs belonging to the *band* (`Eventos`, `+ Evento`,
`Banda`, `Salir`). They sit at one level and read as one menu, so it is not obvious which
options act on the event you are inside and which leave it.

**Also.** At phone width the same bar wraps to three lines, which is where it reads worst — and
a band checking numbers mid-gig is on a phone.

**Proposed fix.** Two levels. Band-scoped items stay in the top bar; event-scoped items become a
sub-bar that appears only inside an event, under the event's name so the scope is visually
owned. Collapses to a scrollable row on narrow screens rather than wrapping.

---

## F2 · The refund window runs from purchase, not from the show

**Severity: needs a product decision · pre-launch**

**Verified.** `src/lib/refund-policy.ts:37` —

```js
const age = Date.now() - new Date(order.createdAt).getTime();
if (age > REFUND_WINDOW_MS)   // 24h
```

The window is 24 hours from **when the order was created**. The show date is never consulted.
The policy is read off the order rather than the event, which is correct and deliberate — a band
editing the event later cannot close a window a buyer already agreed to.

Two consequences fall out:

**(a) Presale buyers lose the window almost immediately.** Someone buying three months ahead can
ask for a refund for one day, then cannot — even though the event is still a quarter away. Most
people would read "24h refund policy" as the opposite.

**(b) Door buyers can request a refund after attending.** A ticket bought at the door is 24 hours
old for the whole night and the next day. Nothing in `refundGate` excludes an attendee who has
already checked in, so someone can walk in, enjoy the show, and ask for their money back the
next morning. Requests are band-approved rather than automatic, so this is an awkward
conversation rather than automatic loss — but the product currently invites it.

**Decision needed.** Which does "24 horas" mean?

1. 24h from purchase (what it does now)
2. Open until 24h **before** the show — closes as the gig approaches, which is what a venue
   usually means
3. Whichever is sooner

And separately: **should a checked-in attendee be refundable at all?** A one-line guard in
`refundGate` on check-in status closes (b) independently of whichever option is chosen.

---

## F3 · The checkout form fails without saying which field is wrong

**Severity: high · pre-launch**

**Observed.** Deliberately submitting an incomplete form correctly refuses the purchase, but
nothing indicates *what* is missing. No field is marked, nothing scrolls, and the buyer is left
re-reading the form.

**What the code does.** A validation failure calls `backToForm(message)`, which redirects to
`/e/:slug?error=…`. The page shows that one message and re-enables the submit button. The draft
is preserved — that part works and was a deliberate fix — but the error is a single sentence
detached from any field.

**Why this one matters more than it looks.** The buyer has **already transferred the money**
before reaching this form. A buyer who cannot work out why the form will not submit is a buyer
who has paid and has no ticket. This is the worst possible place in the product for an unclear
error.

**Proposed fix.** Return which field failed, not just a message. Mark it with `aria-invalid`,
show the message against the field, scroll the first invalid one into view and focus it. The
focus and `aria-invalid` work also moves **FE-05** (keyboard and screen-reader basics) forward,
which is an open audit item.

---

## F4 · The proof upload is mandatory, and the ordering is the real risk

**Severity: needs a product decision · pre-launch**

**Verified.** `src/lib/purchase-form.ts:58` — a missing or zero-byte file is rejected with
*"Subí tu comprobante de pago."* Maximum 10 MB. There is no path to an order without a proof.

**Is that a blocker?** The requirement itself is sound: the proof is the entire basis of
verification, and an order without one cannot be checked by any rule. Keep it.

**The risk is the sequence, not the rule.** The page gives the buyer the account number, they
transfer, and *then* they are asked for a screenshot. Someone who has already sent the money and
cannot produce an image — deleted it, transferred from a desktop, shared a phone, banking app
that will not screenshot — is stuck having paid with no way to finish. They have no account, so
nothing is saved for them to come back to.

**Options.**

1. **Tell them earlier.** Say "tené lista la captura" *before* the account number, so the
   screenshot is taken while the confirmation is still on screen. Cheapest fix, no new paths.
2. **Let the order through without a proof**, flagged `UNREADABLE`/`NO_PROOF`, QR issued as
   normal, with the band chasing it. Preserves the "QR issues immediately, always" invariant and
   turns a dead end into an amber flag.
3. Leave as is and accept the edge case.

Option 1 regardless; option 2 is the question worth deciding.


---

## F5 · A critical flag notifies nobody

**Severity: medium · raised from the `HASH_DUPLICATE` test**

**Observed.** `DAY-B5Z1` came back flagged `HASH_DUPLICATE` **and** `REF_DUPLICATE`, both
critical, and the order correctly reads *Revisar*. But that state sits in the admin until
somebody happens to look. A recycled proof is the closest thing the product has to a
deliberate attempt to get in without paying, and it arrives silently.

**Proposed fix.** Email the band's contact address when verification raises a **critical** flag:
which order, which check failed, and a direct link to it. Warnings and info stay silent —
`NAME_MISMATCH` fires on ordinary group purchases and would train the band to ignore the alert.

Belongs in `src/jobs/` beside the existing verification job, since it reads the database and
runs after the response. Worth a per-event cap so a band running 300 orders cannot be mailed 300
times by one bad batch.

---

## F6 · The amount tolerance is fixed, and larger than a test ticket

**Severity: low as a bug · but it invalidated a QA check**

**Observed.** `DAY-YAAG` expected **L2.00**, the proof read **L1.00**, and the order came back
`matched` with no flag — reported as "4.4 failed".

**What the code does.** `src/lib/verify.ts:133` —

```js
const TOLERANCE = 200;        // centavos = L2.00
if (diff < -TOLERANCE)  → AMOUNT_SHORT
```

The shortfall was L1.00 against a L2.00 tolerance, so nothing fired. **The rule is correct.** At
real prices a L2 tolerance is right: it absorbs rounding rather than real shortfalls.

**The actual problem is that it is absolute.** While presale is set to L1 for testing, the
tolerance exceeds the entire order value, so the amount check cannot fire at all — paying
nothing on a L2 order would also pass. Any QA of the amount rules at test prices is measuring
nothing.

**Retest.** Buy **5 tickets (L5)** and upload the same L1 receipt. The L4 shortfall clears the
tolerance. No new transfer needed.

**Worth considering.** A proportional floor — `max(200, 1% of expected)` — would behave the same
at real prices and stop the check silently disabling itself at small totals. Also note L2 does
not cover the ~L40 ACH fee, so if any bank ever deducts the fee from the transferred amount
rather than charging the sender on top, every cross-bank payment would flag short.

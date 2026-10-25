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
| 6 — Door | ✅ passed · 4 door orders, 8/14 checked in · see F7–F10 | 2026-10-25 |
| 7 — Dashboard | ✅ passed · totals reconcile at L310.00 / 12 after refund · see F12–F14 | 2026-10-25 |

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

**Severity: high · pre-launch** — ✅ **FIXED 2026-10-25**

### Root cause, found by testing rather than reading

The form was not merely vague — for an empty submit it said **nothing at all**, and the reason
was not the server. Constraint validation reports only the **first** invalid control in DOM
order. That is `proof`, the file input, which `.drop input` styled to `width:0;height:0;opacity:0`
so a label could stand in for it. The browser tried to anchor *"Please select a file."* to a
zero-size invisible element, so no message appeared and the form simply refused to submit. Every
visible field below it would have shown a bubble, but none ever got the chance.

### What changed

- `.drop input` now fills the drop zone instead of collapsing to nothing, so the browser's own
  message has somewhere visible to anchor. `.drop` gained `position:relative` — load-bearing,
  since without a positioned ancestor the input sized against the viewport and covered the whole
  page, swallowing every click. Caught by testing reachability of the other fields.
- `readPurchaseForm` failures now carry a `field`, which `backToForm` passes as `&campo=`.
- The page marks that field `.invalid` and `aria-invalid`, puts the message against it, scrolls
  it into view and focuses it. For the file input the message and scroll target are the visible
  drop zone, not the invisible control.
- The capacity refusal now says how many remain — *"Sólo quedan 3 boletos"* rather than
  *"Ya no hay cupo suficiente"* (the sub-item noted in **F15**).

The `aria-invalid` and focus handling also move **FE-05** forward.

### Verified

Empty submit anchors to a 382×98 visible region; server rejections mark, annotate, scroll and
focus for both a visible field and the hidden file input; all other fields remain reachable; a
valid submit still completes to the ticket page.

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

**The same gap covers refund requests, and there it is worse.** During the Part 7 run a refund
request on `DAY-77NY` sat `open` and nothing told the band — it was found only by querying the
database. The buyer had been shown *"Le avisamos a Daydrinking. Te van a contactar al correo con
el que compraste."* Nobody was avisado. A promise was made on the band's behalf and silently not
kept, which is worse than an unnoticed flag.

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

### Where the number came from, and why it does not hold up

The commit that introduced it (`852d06f`) says *"Amounts tolerate L2 for rounding."* Neither
rounding nor fees can produce a gap that size:

- **Rounding cannot.** Both sides are integer centavos. Expected is `rule.amount × quantity`,
  exact. Extracted is `Math.round(fields.amount * 100)`, which absorbs sub-centavo float noise.
  The one real rounding case is a price carrying centavos — L166.67 × 3 = L500.01, where a
  buyer sending L500.00 is short **one centavo**. That justifies a few centavos, not two hundred.
- **Fees cannot.** The ACH fee is charged to the sender on top — the buy page says so:
  *"Tu banco te va a cobrar una comisión de ~L40"*. The band receives the full amount, nothing
  is deducted. And L2 would not cover L40 if a bank ever did deduct it, so every cross-bank
  transfer would flag short regardless.

So the value is defensive rather than derived. In production it is nearly harmless — L2 on a
L200 ticket masks a shortfall nobody would chase. Its real cost was disabling a whole class of
check during QA while prices are set to L1.

**Recommendation.** Reduce it to ~5 centavos, or remove it. `AMOUNT_SHORT` is a *warning*: the
QR still issues and the buyer is never stopped, so a false positive costs the band a glance. A
false negative means the band is quietly short-paid and never learns. The costs are asymmetric
and the current value is tuned for the wrong one.

If it stays absolute, note it should at minimum be smaller than the cheapest sellable ticket, or
it disables itself again the next time anyone tests at a low price.

### Decision — 2026-10-25: remove the tolerance

Agreed to drop it entirely rather than shrink it. The reasoning adds a case not considered
above: **a transfer funded in another currency** can convert to slightly more or less than the
quoted price, and that is precisely an order a band should look at — not one the system should
silently accept. `docs/SPEC.md` already lists a USD-converted transfer as an unsampled
extraction case, so this is a real path, not a hypothetical.

With the tolerance gone, any difference between quoted and received raises `AMOUNT_SHORT` or
`AMOUNT_OVER`. Both are warnings: the QR still issues, the buyer is never stopped, and the band
gets a line it can act on. The one-centavo case from a price carrying centavos would flag too —
acceptable, and avoidable by not pricing in centavos.

**To implement:** delete `TOLERANCE` in `src/lib/verify.ts` and compare `diff` against 0. Update
the test expectations and the comment, which currently explains a tolerance that no longer
exists.


---

## F7 · An amber scan admits the attendee before staff decide

**Severity: high** — ✅ **FIXED 2026-10-25**

**Observed.** Scanning `DAY-B5Z1` — the order carrying two critical flags — correctly showed
amber **and named the reason**. But the attendee was marked *adentro* in the same action. Staff
are told about the problem immediately after the person has already been admitted.

That is backwards for the case the flag exists to serve. `HASH_DUPLICATE` means the proof was
recycled from another order: the one scan where someone might reasonably be held at the door is
the one where the product has already let them in.

**Proposed.** A confirmation step before the check-in commits:

- **Green:** *"Comprobante verificado — confirmar asistencia"* · Aceptar / Cancelar
- **Amber or red:** *"Verificar y confirmar asistencia"* / *"Anular compra"*

**The tension worth deciding deliberately.** The scanner is built for a queue. The baseline
event put 229 people through a door, and a confirmation on *every* scan doubles the taps for the
~95% of scans that are clean. Three options:

1. Confirm on every scan — most control, slowest, as proposed
2. **Confirm only on amber and red** — green stays one tap, the exceptional case gets the stop.
   Keeps the fast path fast and puts friction exactly where judgement is needed
3. Keep auto-admit, add an **undo** on the result screen — fastest, but relies on staff noticing

Option 2 looks like the right shape, but this is a call about how a door actually runs, not a
technical one.

### Fixed — option 2

A flagged scan now stops and waits: amber, the reason, and two buttons — *Verificar y dejar
pasar* / *No dejar pasar*. Nothing is written until one is tapped. A clean scan is still a single
tap, so the queue never waits on the ~95% that are fine.

Three things fell out of building it:

- **`state.pending` blocks further scans while a decision is open.** Without it the next person
  in the queue wipes the decision off the screen before anybody has made it. Verified: with a
  confirmation open, checking somebody else in does nothing and the decision stays up.
- **`#result` had to move out of the tab panes.** It lived inside *escanear*, so a check-in
  driven from *buscar* rendered where nobody could see it. Harmless while a result was only
  informational — not harmless once it carries the buttons deciding whether somebody gets in. My
  first attempt shipped exactly that bug: the confirmation appeared, invisible, and the scan
  waited for a tap that could not happen. This also fixes the Part 4 observation that a green
  result was invisible when driven from search.
- **Door staff were deliberately *not* given "anular compra".** See below.

### Why the door cannot void an order

The original note asked for *"anular compra"* as the second option. It is not implemented, on
purpose:

- The scanner link is a **bearer token** (**F9**) — anyone holding it can act. Voiding an order
  is irreversible from the door's point of view and removes a paid ticket from a band's totals.
- The people holding it are volunteers on the night, tapping a phone in the dark, and the button
  would sit next to the one they press hundreds of times.
- Nothing is lost by withholding it. *No dejar pasar* already stops entry, which is the decision
  that has to be made in the moment. Voiding is an accounting decision the band makes in the
  admin, where `/anular` and `/reembolsar` already live (**F11**).

Worth revisiting if a band actually asks for it, with the reason recorded and the action
attributed to a device.

---

## F8 · Cash sales and comps commit with no confirmation

**Severity: medium** — ✅ **FIXED 2026-10-25**

Selling a cash ticket or issuing a comp writes the order immediately. Both create records that
affect attendance and settlement, and a misplaced tap on a phone at a dark door is easy. A comp
in particular is a free ticket that counts toward attendance and never toward revenue.

Same confirmation treatment as F7, but here it should be unconditional — there is no fast path
worth protecting, since these are typed rather than scanned.

### Fixed

Both now confirm, always. The F7 panel was generalised into `askConfirm({...})` rather than
copied, so the two cases where the device commits something on a person's behalf — admitting a
flagged ticket, and taking money — share one implementation.

The copy differs because the stakes do:

- **Cash** restates the amount before the tap — *"Cobrá L750 antes de confirmar"* — because the
  irreversible part happens off-screen, when the staff member takes the money. The button reads
  *Ya cobré — registrar*, which is the order the real action happens in.
- **Comp** says what a comp is: *"No se cobra nada. Cuenta para la asistencia y no suma a los
  ingresos."* A free ticket that moves the headcount and never the revenue is exactly the thing a
  volunteer would otherwise get wrong.

Cancelling writes nothing and says so. Verified: the first tap writes nothing and the counters
hold; confirming writes the order and moves them; F7 still behaves identically after the
refactor.

---

## F9 · Both shareable links need copy-to-clipboard, and they are easy to confuse

**Severity: medium**

The public sale link and the staff scanner link are both shown as plain text to be selected by
hand. Neither copies.

Worse, they are confusable, and the consequence is asymmetric: the scanner link is a bearer
token. **Anyone holding it can check people in.** Posting it where the sale link should have
gone hands door control to the public.

**Proposed.** Copy buttons on both. For the staff link specifically, a button that first warns —
*"este enlace es sólo para el personal de la puerta; quien lo tenga puede registrar entradas"* —
and copies only on acknowledgement. The warning is the point; the copy is the convenience.

---

## F10 · The door list is cached but cannot be browsed

**Severity: low · nice to have**

The scanner downloads the full attendee list on load and says so. **Buscar** uses it only for
lookup by typed name, so staff cannot simply read the list — useful when a name is misspelled,
misheard, or the buyer does not know which name the ticket is under.

**Proposed.** Show the cached list under **Buscar** when the search box is empty: a scrolling
list of names with their check-in state, filtering as you type. No new data and no network — it
is already on the device.


---

## F11 · A band cannot record a refund it gives

**Severity: medium** — ✅ **FIXED 2026-10-25**

> **The original finding was overstated and is corrected below.** It claimed a band could not
> stop an order at all. It can: `/anular` already existed and marks an order `void`. I had
> grepped for `insert(s.refundRequests)`, which only finds the buyer's page, and concluded too
> much from one search.

### What was actually true

Two distinct end states exist, and the band could only reach one of them:

| | Set by | Means | Reason recorded |
|---|---|---|---|
| `void` | `/anular`, already in the admin | This order should not exist | none |
| `refunded` | only an approved buyer request | Money is going back | the buyer's |

Both stop the QR codes and drop the order from every total, since the aggregates and the scanner
manifest all filter on `status = 'confirmed'`. So a band cancelling its gig was never stuck — it
could void every order and the tickets would stop working.

What it could not do was record a **refund**: no reason, no audit trail, no distinction between
"this was a mistake" and "I gave the money back". And since the buyer's own page is gated at 24
hours by `refundGate` (**F2**), a late request could not be honoured as a refund at all.

### Fixed

`/reembolsar` sits beside `/anular` on the order page, deliberately separate — the two actions
mean different things and the copy says so. It writes an approved `refund_requests` row carrying
the band's reason and the timestamp, then marks the order `refunded`.

Written as a request approved in the same breath rather than a second path mutating the order
directly, so every refund has one shape and one audit trail whoever began it. Idempotent —
verified that three further submits leave exactly one row. Hidden for comps, which have no money
to return. States that it voids all tickets on the order, since partial refunds are **F13**.


---

## F12 · A voided ticket tells the door it is for another event

**Severity: high** — ✅ **FIXED 2026-10-25**

**Observed.** Scanning a ticket from a refunded order correctly refuses entry, but reports
*"No encontrado · Este código no es de este evento"*.

**Why.** `public/scanner.js:197` shows that message whenever a token is absent from the cached
manifest, and the manifest excludes refunded and voided orders. A voided ticket is therefore
indistinguishable from a stranger's ticket for a different gig.

The server knows the difference — `src/routes/scan.ts:154` returns `status: "voided"` explicitly,
with a comment noting it refuses rather than trusting a stale client cache. But that verdict
arrives at sync, long after the person has been turned away with the wrong explanation.

**Why it matters.** Staff repeat what the screen says. "This isn't for this event" sends someone
away believing they are at the wrong venue, when the truth is their order was refunded —
information they can act on and probably already know. It also hides a real failure mode: a band
refunding the wrong order would hear "wrong event" complaints rather than "you refunded me".

### Fixed

The manifest now carries refunded and voided orders, flagged `v: 1` rather than dropped. The
scanner names the real reason — *"Boleto anulado · Esta compra fue reembolsada"* — and does it
offline, since the marker travels with the cached list.

Two consequences had to be handled, and the second was found only by testing:

- **Voided tickets must not inflate the counts.** `renderStats` filters them out of sold, inside
  and wristbands. Verified: 157 rows in the manifest, 155 counted.
- **Search had to keep finding them.** The first attempt excluded voided tickets from the door's
  name search, which reproduced the same failure in a different place — typing a refunded code
  answered *"Nadie con ese nombre."* They now appear struck through, labelled *reembolsado*, with
  the action button disabled and reading *Anulado*.

---

## F13 · Refunds are all or nothing

**Severity: medium**

**Verified.** The `attendees` table has no status or void column; voiding is driven entirely by
`orders.status`. Refunding an order voids every ticket on it.

The common case this misses: somebody buys four, two friends drop out, and they ask to return
two. Today the band must refund all four and have them buy two again — at whatever the price is
*now*, which after a price change may not be what they paid.

**Proposed.** Either a per-attendee void flag with a partial amount on the refund record, or an
explicit decision that refunds are whole-order only and the UI says so before the band approves.
The second is cheap and honest; the first is the real fix.

---

## F14 · Editing a price rule silently rewrites what past orders appear to have cost

**Severity: medium · the data is right, the presentation is not**

**Observed.** The door price was changed from L300 to L2 between two cash sales. `DAY-VABM`
charged L300 and `DAY-WJMM` charged L2, both pointing at the same `Taquilla` rule, which now
reads L2.

**The data is correct and should not change.** `expected_amount` is resolved server-side at
purchase and frozen onto the order, so editing a rule never rewrites history. Three reasons that
is the right behaviour, not a bug to fix:

1. **The bank statement is the referee.** L300 actually arrived. If the system retroactively
   said L2, check 7.3 — per-account subtotals matching what reached the bank — would fail *by
   design*.
2. **Verification would invert.** `AMOUNT_SHORT` / `AMOUNT_OVER` compare the proof against
   `expected_amount`. Repricing retroactively would re-flag every past order as wildly overpaid.
3. **It is the spreadsheet failure this product exists to replace.** A band's historical
   settlement changing after the fact, because somebody edited a field months later, is exactly
   the "a cell silently rewrote the totals" problem. The instinct that a price is "a cell other
   cells reference" is the right observation and the argument *against* linking them.

**What is actually wrong is the display.** The order shows the current rule's label beside a
frozen amount, so a historical order appears to say "Taquilla — L300" while the Taquilla rule
now reads L2. The number is right; the label describing it is not.

**Proposed.**

- Snapshot the rule's label and amount onto the order at purchase, and show that, so an order
  reads what it was actually sold under.
- Warn when editing a rule that already has sales against it: *"23 órdenes se vendieron con esta
  regla; sus montos no cambian."* Makes the freeze visible instead of surprising.


---

## F15 · A presale allocation can be oversold by one order

**Severity: medium** — ✅ **FIXED 2026-10-25**

The two limits behave differently, and only one of them accounts for how many tickets are being
bought.

**Event capacity — correct.** `src/routes/public/purchase.tsx:70` checks
`sold + quantity > event.capacityCap` and refuses the whole order. All-or-nothing: three left
and a buyer asking for five gets none.

**Per-rule allocation — not enforced against quantity.** `resolveSellableRule`
(`src/db/queries/price-rules.ts:43`) treats a rule as sold out only when:

```js
r.maxQty != null && (soldByRule.get(r.id) ?? 0) >= r.maxQty
```

The requested quantity never enters it. With 99 of a 100-ticket presale sold, a buyer taking ten
is served the presale rule and gets all ten at the presale price — 109 sold against an
allocation of 100. Bounded at **+9** by `MAX_TICKETS = 10`, and it happens silently.

At a realistic L200 presale against a L250 door that is ~L450 of margin per event, which is
small. The reason to fix it is not the money: a band that set a limit of 100 and finds 109 sold
has been told something untrue by its own tool.

**Proposed.** Apply the same shape as the capacity check — a rule is unavailable when
`sold + quantity > maxQty`. Then decide what happens to the overflow, because refusing outright
is harsh when the next tier would happily sell them:

1. Refuse, mirroring capacity: *"Sólo quedan 3 boletos en preventa."*
2. Fall through to the next rule and sell all ten at the door price
3. Split the order across rules — most correct, most complex, probably not worth it

Option 1 is consistent with how capacity already behaves and tells the buyer something true,
and is what was implemented: `ticketsSoldUnderRule` plus a guard in `purchase.tsx` that mirrors
the capacity check and refuses with the real remainder — *"Sólo quedan 3 boletos en Preventa."*

A fully sold-out tier still falls through to the next rule as before; the guard only fires when
a tier has room but not enough for this order. Verified both ways: 2 sold of 5, asking 4 is
refused with the count, asking 3 fits exactly and sells.

**Related.** The capacity message *"Ya no hay cupo suficiente"* never said how many **are** left.
Fixed in the same pass as **F3** — it now reads *"Sólo quedan 3 boletos."*

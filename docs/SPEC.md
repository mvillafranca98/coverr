# Coverr: spec

Status: v1 agreed; the operator panel is a draft · Last updated: 2026-11-03

The long-form product specification lives in `coverr-spec.html` at the repo root — it carries the
reasoning, the baseline event ledger and the decisions that are closed. This file is the short
version the standards expect: what v1 is, and how you know a feature works.

## Problem

A band posts a flyer with a phone number and a bank account. Buyers transfer, screenshot the
confirmation and send it over WhatsApp. Someone types every name into a spreadsheet by hand. On
the night, staff check printed lists, take cash and transfers at the door, photograph screens, and
tally headcount on paper. Wristbands, screenshots and the paper count never agree, so the band
recounts and averages.

Two numbers from the baseline event (Jungla, 01/08 — 229 people, L52,650) shaped everything:

- **39% of door sales were cash**, so a transfer-only product fixes the easy half and leaves the
  hard half broken.
- **84 × 250 = 21,000 exactly, and 53 × 250 = 13,250 exactly** — one figure was divided out of the
  other, so the reconciliation was never an independent check at all.

## Users

- **Primary:** independent bands in Honduras running their own gigs, and the door staff they hire
  for the night.
- **Also:** ticket buyers, who never make an account and may never visit the site twice.
- **Not for:** venues. The band holds the bank account and the pain; the venue holds neither. Not
  for promoters or ticketing resellers.

## v1 features

| # | Feature | Acceptance criteria (testable) | Status |
|---|---|---|---|
| F1 | Buy by bank transfer | A buyer picks a quantity, sees the band's account for their own bank, uploads a confirmation screenshot and reaches their QR codes without creating an account | live |
| F2 | QR issues immediately | The QR codes render on screen before verification has run, and no flag, failure or missing API key can withhold them | live |
| F3 | Ticket email | The same codes arrive by email within a minute, as hosted PNGs that Gmail will render | live since 2026-11-03, from `hola@coverr.live` (`docs/EMAIL-SETUP.md`). Gmail may file it under Promotions |
| F4 | Three ways to get a ticket back | On screen at purchase, `/recuperar` by email, and staff name-search at the door. `/recuperar` answers identically whether or not the address is registered | live |
| F5 | Deterministic verification | Vision extracts fields by label; the eight checks in `lib/verify.ts` are rules, each with a reason that can be said out loud. No model judges authenticity | live |
| F6 | Door scanning, offline | The scanner caches the full attendee list on load and validates locally. Scans queue and sync on reconnect. Verde names the attendee, ámbar names its reason, rojo names the time of the first scan | live |
| F7 | Cash and comps at the door | Staff record a cash sale in one tap; comps are orders at zero that count toward attendance and never toward revenue or a pricing bracket | live |
| F8 | Live dashboard | Sold, checked in, still outside; revenue by channel; per-account subtotals; wristbands expected vs actual; open flags. Free every time | live |
| F9 | Settlement | Gross − costs = net, split by member percentage, less dated advances that carry across events. Warns when percentages don't total 100, never blocks | live |
| F10 | Band home | Every event the band has run, with cost trends by category and a fan view built from normalised email and phone. Never gated | live |
| F11 | Refunds | A buyer can request one inside the policy frozen on their order; approving voids the QR and drops the order from every total | live |

## Out of scope for v1

- Card payments of any kind. Bank transfer only.
- Ticket tiers, VIP, early bird, assigned seating.
- Bank statement import — pinned until the export format is known.
- WhatsApp delivery.
- Multi-account ownership and inter-member settlement transfers.
- Milestone emails every *n* tickets.
- **AI authenticity scoring — deliberately excluded, not deferred.**
- Multi-band discovery, an events directory, anything social.

## Next: the operator panel (draft)

Coverr's own back office: the operator (Coverr, not a band) sees every band, decides which ones
may use the product and on what terms, and collects the settlement fee. Nothing here changes
what a band or a buyer can do, except where a row says so.

**Decided on 2026-11-03:**

- **"Permissions" means per-band status, set by the operator:** active, banned, or on a free
  pass. Not roles inside a band — a band still has one login, its contact email.
- **A fee payment unlocks the report immediately**, the same rule buyers get. The transfer
  screenshot is checked after the response, and any problem emails the operator, who reviews it
  and contacts the band. A band is never left waiting on the operator after a gig.

| # | Feature | Acceptance criteria (testable) | Status |
|---|---|---|---|
| F12 | Operator sign-in | `/operador` signs in by magic link, like a band, but only for the addresses in an `OPERATOR_EMAILS` setting. Every `/operador` route checks the operator session on the server; a band session never reaches one. Asking for a link with any other address answers exactly like a real one, and is rate-limited like band sign-in. The operator's own band keeps its ordinary band login | planned |
| F13 | Every band | One list of all bands, newest first and paginated: name, contact email, signup date, events, paid tickets, last activity, status and fees paid. Searchable by name or email. Each band opens to its events and its fee history | planned |
| F14 | Ban a band | The operator bans a band with a written reason, and can lift it. A banned band cannot sign in or create events, and its event pages stop taking new purchases. Tickets already sold keep working everywhere — ticket page, `/recuperar`, door scanner — because those buyers have paid the band. Every ban and unban is logged with who did it and when | planned |
| F15 | Free pass | The operator gives a band free reports, permanently or until a date, with a note ("la banda del operador"). An unlock under a pass costs nothing and records bracket `free_pass`; one outside its dates is charged normally | planned |
| F16 | Paying the fee | With billing on, a report that is not free shows the exact amount and Coverr's bank account for the band's own bank, so nobody pays an interbank fee. The band uploads its transfer screenshot and the report unlocks on that response. Extraction and the rules in `lib/verify.ts` run afterwards against Coverr's accounts and the bracket amount; any flag emails the operator with the band, the event, the reason and a link. The operator marks each flagged payment resolved, with a note | planned |
| F17 | Fees ledger | Fees by month: charged, received, flagged, and waived (free first event, free pass, promo), each total built from records and each row linking to its band and event. Paginated, with a CSV export | planned |
| F18 | Promo activations | To be defined — see the questions below | open |

**Questions before building:**

1. **What is a promo activation?** Three readings, each a different feature: a code a band types
   to get a report free or discounted; a one-off free report the operator grants a band; or
   extending the free first event for a band that missed 31 January.
2. **A fee that turns out unpaid.** A report the band has unlocked stays open — history is never
   gated. So what does an unpaid fee change? The proposal: the band's next report cannot be
   unlocked until it is settled, and the operator can ban if it is not.
3. **Coverr's receiving accounts.** Which banks, and in whose name — a person or a company? The
   fee page shows these to every band.
4. **Invoices.** A fee is Coverr's income. Honduras's SAR may require a fiscal invoice (factura
   with CAI) per payment, which is a feature of its own. Needs an answer from an accountant
   before billing goes on, not after.
5. **How long fee screenshots are kept.** A buyer's proof is deleted 30 days after the event
   because it carries a third party's account number. A fee screenshot carries a band member's,
   but it is also Coverr's payment record. The proposal: keep the extracted amount, reference
   and date in the ledger for good, and delete the image 90 days after the payment unless it is
   flagged.
6. **Who gets the operator's emails, and is anyone else an operator?** Flagged payments could go
   to `hola@coverr.live` (forwarded to the operator's Gmail) or to `ALERT_EMAIL`, where crashes
   go.

**Out of scope for this phase:** roles inside a band; levels among operators; automatic bank
reconciliation; anything that lets the operator see or move a band's ticket money, which never
passes through Coverr.

## Success metrics

- A band runs a full gig end to end without a spreadsheet.
- Presale share and no-show rate become real numbers. No-show rate has never been measured by
  anyone doing this manually — the printed list gets ticked and thrown away.
- Settlement is produced from records, never from a typed cell.

## Open questions

- **Year-less transfer dates.** BAC's app notification prints "15 octubre" with no year. The
  extractor returns `10-15`, which `new Date()` resolves to 2001 and the staleness check then
  flags. A correct payment is flagged on every real BAC purchase.
- **Non-BAC proof samples.** Extraction coverage beyond BAC is unproven — Ficohsa, Atlántida and
  a USD-converted transfer are all unsampled.
- **Bank statement export format.** Does the sender's name survive into a BAC export, or does it
  read `ACH CREDITO`? Blocks optional morning-after reconciliation.
- **Minimum age.** Decided as 18+, but stated nowhere in the product and enforced nowhere.

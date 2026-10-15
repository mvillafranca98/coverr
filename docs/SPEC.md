# Coverr: spec

Status: agreed · Last updated: 2026-10-15

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
| F3 | Ticket email | The same codes arrive by email within a minute, as hosted PNGs that Gmail will render | **failing** — Resend domain unverified, see Open questions |
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

## Success metrics

- A band runs a full gig end to end without a spreadsheet.
- Presale share and no-show rate become real numbers. No-show rate has never been measured by
  anyone doing this manually — the printed list gets ticked and thrown away.
- Settlement is produced from records, never from a typed cell.

## Open questions

- **Email deliverability.** The highest-risk dependency in the product. `macawly.dev` shows
  **Failed** in Resend, so no ticket email has ever been delivered. DNS records exist and were
  re-issued on 2026-10-15; the domain needs re-verifying in the Resend dashboard.
- **Year-less transfer dates.** BAC's app notification prints "15 octubre" with no year. The
  extractor returns `10-15`, which `new Date()` resolves to 2001 and the staleness check then
  flags. A correct payment is flagged on every real BAC purchase.
- **Non-BAC proof samples.** Extraction coverage beyond BAC is unproven — Ficohsa, Atlántida and
  a USD-converted transfer are all unsampled.
- **Bank statement export format.** Does the sender's name survive into a BAC export, or does it
  read `ACH CREDITO`? Blocks optional morning-after reconciliation.
- **Minimum age.** Decided as 18+, but stated nowhere in the product and enforced nowhere.

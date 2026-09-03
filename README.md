# Coverr

Presale, door check-in and settlement for independent bands in Honduras.

Buyers pay by bank transfer straight into the band's own account, upload the
confirmation, and get QR tickets immediately. Staff scan at the door from a
browser. The band gets accurate counts in real time and a settlement report
at the end — splits, expenses, advances, payouts.

The platform never touches the money.

## Status

Spec complete, not yet implemented. Read **[coverr-spec.html](coverr-spec.html)**
in a browser.

## Why

The current process is a flyer with a bank account on it, a WhatsApp thread full
of screenshots, and a spreadsheet typed by hand. On the night, staff check
printed lists by name, take cash and transfers at the door, and tally headcount
on paper. Wristbands, screenshots and the paper count never agree.

Baseline event used throughout the spec — 229 attendees, L52,650 gross:

| Channel            | People | Money    |
|--------------------|-------:|---------:|
| Presale            |     92 | L18,400  |
| Door — transfer    |     84 | L21,000  |
| Door — cash        |     53 | L13,250  |
| Comps              |      4 | L0       |

39% of door sales were cash, which is why cash is a first-class flow rather
than an afterthought.

## Key decisions

- Money never passes through the platform — each band collects into its own account
- No card processing; bank transfer only
- QR issues immediately, always — verification is internal bookkeeping, never a gate on the buyer
- Verification is deterministic (duplicate reference, wrong destination account,
  amount mismatch), not AI authenticity scoring
- Cash sales, comps and wristbands are all first-class
- The settlement report is the paywall; history stays free forever

## A note on test data

`screenshots/` is gitignored. Payment confirmations contain third parties' full
names, bank account numbers and email addresses. Keep them local.

# Coverr

Presale, door check-in and settlement for independent bands in Honduras.

A band posts a gig, buyers pay by bank transfer straight into the band's own account, and
everyone gets a QR code the moment they upload their receipt. On the night, staff scan
those codes on a phone that keeps working without signal, sell cash tickets and comps at
the door, and watch the room fill on a live dashboard. Afterwards the band gets a settlement:
gross, costs, net, and each member's share — produced from records, not from a spreadsheet
cell somebody typed.

**Coverr never touches the money.** Every lempira goes from the buyer's bank to the band's.
That is what keeps it a software tool rather than a money transmitter, and it shapes most of
the design below.

---

## Contents

- [Why it exists](#why-it-exists)
- [How it works](#how-it-works)
- [Principles that are not up for negotiation](#principles-that-are-not-up-for-negotiation)
- [Stack](#stack)
- [Running it locally](#running-it-locally)
- [Scripts](#scripts)
- [Project layout](#project-layout)
- [A purchase, through the code](#a-purchase-through-the-code)
- [Payment verification](#payment-verification)
- [Configuration](#configuration)
- [Database and migrations](#database-and-migrations)
- [Tests and checks](#tests-and-checks)
- [Deploying](#deploying)
- [Operating it](#operating-it)
- [Known limitations](#known-limitations)
- [Conventions](#conventions)
- [Documentation](#documentation)

---

## Why it exists

The way a gig works without it: a band posts a flyer with a phone number and a bank account.
Buyers transfer, screenshot the confirmation and send it over WhatsApp. Someone types every
name into a spreadsheet. On the night, staff tick a printed list, take cash and transfers at
the door and tally headcount on paper. Wristbands, screenshots and the paper count never agree,
so the band recounts and averages.

Two facts from the baseline gig the product was designed against decided a lot:

- **39% of door sales were cash.** A transfer-only product would fix the easy half and leave
  the hard half broken, so cash and comps are first-class.
- **The spreadsheet's reconciliation was circular** — one figure had been divided out of the
  other, so it never checked anything. Every count in Coverr comes from records.

The full reasoning, the baseline ledger and the decisions already closed live in
[`coverr-spec.html`](coverr-spec.html). The short version, with acceptance criteria for each
feature, is [`docs/SPEC.md`](docs/SPEC.md).

## How it works

**The band** signs up with an email address (no password — sign-in is a magic link), adds its
members with their split percentages and its bank accounts, then creates an event with a
venue, a date and price rules: for example a presale price that runs until a date or a
quantity, and a door price that takes over when presale ends or sells out.

**A buyer** opens the event link (`/e/<slug>`), picks a quantity and their bank, and sees the
band's account at that bank to transfer to. They upload the screenshot of the confirmation and
**get their QR codes on screen immediately** — before anything has checked the payment. The
same codes arrive by email. Buyers never create an account; a lost ticket comes back by email
from `/recuperar` or by name at the door.

**After the response has gone**, a background job reads the receipt with a vision model,
which extracts fields — amount, destination account, reference, date, sender — by their
labels. A fixed set of [deterministic rules](#payment-verification) then compares those
fields with the order. Anything suspicious becomes a flag the band sees with its reason
spelled out. Flags never take a QR away.

**At the door**, staff open a per-event scanner link on any phone. No account, no login —
the link is the credential. The scanner downloads the whole attendee list and validates
every scan on the device, so it keeps working when the venue's signal does not:

- **Green** names the person.
- **Amber** names the reason to look closer, and waits for a decision.
- **Red** says why not — already inside (and since when), refunded, or unknown.

Cash sales and comps are one tap each. Scans queue and sync when signal returns.

**During and after the night**, the band's dashboard shows sold, inside and still outside,
revenue by channel, per-bank subtotals to check against statements, and wristbands expected
against wristbands used. Settlement takes gross revenue, subtracts costs, splits the net by
member percentage and nets off dated advances that carry across events. The band home keeps
every past event and a view of returning fans built from normalised emails and phones.

**Refunds** are per ticket. A band can give back two of a four-ticket order: those two codes
stop working at the door and leave every total; the other two keep scanning.

**Leaving** is self-service. A band can delete its account from its settings: everything it has
in Coverr — events, orders, buyers' details, proof images — goes at once, after it has seen what
will go and typed its name. It is refused only while a buyer is still owed something: an event
that has not happened yet with live tickets, or an unanswered refund request.

## Principles that are not up for negotiation

These are product decisions, not implementation details. Breaking one breaks the product.
[`CLAUDE.md`](CLAUDE.md) has the full list with the reasoning.

- **The QR issues immediately, always.** Verification and email run after the response. A
  flag is internal bookkeeping; it never holds a buyer in a pending state.
- **Verification is deterministic.** The model reads fields; rules decide. No model ever
  judges whether a receipt is authentic — that is excluded from the product, not deferred.
- **Money is re-resolved on the server.** The client never states a price, a rule or an
  amount. Every order freezes the per-ticket price it was sold at.
- **The scanner works offline.** It validates locally from a cached list. A double scan
  across two offline devices is flagged at sync rather than prevented — the wristband is the
  real anti-passback control.
- **Proofs are personal data.** A bank screenshot can expose a third party's full account
  number. Proofs are admin-only and deleted 30 days after the event.
- **Public endpoints do not reveal who is registered.** Sign-in, sign-up and ticket recovery
  answer identically whether or not an address exists.
- **History is never deleted.** A refund voids the code and writes its own record.
- **Only the settlement report can ever be paid for.** Presale, delivery, check-in, cash sales,
  the live dashboard and a band's history stay free every time.

## Stack

| Layer | What | Why |
|---|---|---|
| Runtime | [Cloudflare Workers](https://developers.cloudflare.com/workers/) | One deploy, no servers, close to buyers |
| HTTP and views | [Hono](https://hono.dev) with `hono/jsx`, server-rendered HTML | Fast first paint on venue wifi; almost no client JavaScript outside the scanner |
| Database | [D1](https://developers.cloudflare.com/d1/) (SQLite) through [Drizzle](https://orm.drizzle.team) | Typed queries, generated SQL migrations |
| Files | [R2](https://developers.cloudflare.com/r2/) | Payment proofs, never stored in the database |
| Email | [Resend](https://resend.com) | Magic links, tickets, crash alerts |
| Receipt reading | Anthropic's vision API | Field extraction only — see the principles above |
| Scanner | A plain-JavaScript PWA in `public/` with [jsQR](https://github.com/cozmo/jsQR) as the fallback decoder | iOS Safari has no `BarcodeDetector` |
| Tooling | TypeScript, [Vitest](https://vitest.dev), [Biome](https://biomejs.dev), Wrangler | |

## Running it locally

### Prerequisites

- **Node.js 22 or newer.** `.nvmrc` pins 22; CI runs 24.
- npm, which comes with Node.
- No Cloudflare account is needed for local development. Wrangler simulates D1, R2 and the
  rate limiters on your machine.

### Set up

```bash
npm install
cp .dev.vars.example .dev.vars
```

Open `.dev.vars` and set **`SESSION_SECRET`** — without it, admin sign-in fails with an error
rather than signing sessions with a guessable key. Generate one with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Everything else in that file is optional locally:

| Variable | Without it |
|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | Email is not sent. A development transport prints each message, including any sign-in link, to the terminal as an `[email:dev]` line, and writes the rendered HTML to the local R2 bucket under `outbox/`. |
| `ANTHROPIC_API_KEY` | Receipts are not read. Orders still sell, QR codes still issue, and proofs wait for a human — exactly what production does if the vision call fails. |
| `APP_ORIGIN` | Keep it at `http://localhost:8787` so links in emails and QR codes point at your machine. |

### Create the database and start

```bash
npm run db:reset    # wipes local state, applies every migration, loads the seed
npm run dev         # http://localhost:8787
```

`db:reset` deletes `.wrangler/state` with `rm -rf`. On Windows, run it from Git Bash or WSL
if your shell has no `rm`.

The seed (`seed/seed.sql`) is the baseline gig, *Jungla 01/08*, reconstructed from the
spreadsheet it replaces: the band, its members and accounts, the event, its prices, expenses
and advances, with buyers on synthetic addresses.

### Sign in as a band

1. Go to <http://localhost:8787/admin/acceso> and enter `banda@ejemplo.com`.
2. The sign-in link appears in the terminal running `npm run dev`, on the line after
   `[email:dev]`. Open it.

### A fuller demo

For a populated dashboard, orders list and scanner, load the fabricated demo band on top of
the seed. Everything in it is invented — the band, the venue, every buyer and every figure:

```bash
npx wrangler d1 execute coverr-db --local --file=./seed/demo.sql
```

Sign in as `demo@ejemplo.com`. The event is at `/e/evento-de-ejemplo`, and its door scanner at
<http://localhost:8787/scan/demostaff00000000000000000000000>. Any event's scanner link is
also on its dashboard, under *Entrada*.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local server with simulated D1, R2 and rate limiters |
| `npm run check` | Typecheck, lint and test — the same three steps CI runs |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Biome lint and format check; `lint:fix` applies fixes, `fmt` formats |
| `npm test` | Vitest, once; `test:watch` keeps it running |
| `npm run db:generate` | Generates a SQL migration from changes to `src/db/schema.ts` |
| `npm run db:migrate:local` | Applies pending migrations to the local database |
| `npm run db:seed:local` | Loads `seed/seed.sql` into the local database |
| `npm run db:reset` | Deletes local state, migrates and seeds |
| `npm run db:migrate:remote` | Applies pending migrations to **production** |
| `npm run deploy` | Deploys to **production**, labelling the version with its commit |
| `npm run shots` | Regenerates the landing page's product screenshots: one set per invented show in `src/views/demo-shows.ts`, with the dev server running |
| `npm run brand` | Regenerates the favicons, app icons and link-preview image from the brand mark |
| `npm run cf-typegen` | Regenerates Wrangler's binding types |

## Project layout

```
src/
  index.tsx        entry point: builds the app, mounts every router, owns the 404,
                   the crash page and the nightly cron
  lib/             pure logic — money, verification rules, settlement, refunds,
                   feature flags, crawl rules. Never touches the database. Each
                   adapter here talks to exactly one outside service
                   (email.ts → Resend, extract.ts → the vision API)
  db/
    schema.ts      every table, with the reasoning behind non-obvious columns
    queries/       every database read and write
  jobs/            work that runs after the response has gone: reading a receipt,
                   sending tickets, notifying flags, reporting errors, purging
                   expired proofs and old error rows
  routes/
    public/        buyer-facing flows: event page, purchase, confirmation,
                   recovery, refunds, sign-up, legal pages, health, robots,
                   sitemap, and where pages report their own errors
    admin/         the band's side: sign-in, home, dashboard, orders, an order,
                   manual sales, money, event and band settings
    operator/      Coverr's back office at /operador: operator sign-in, every
                   band, bans, free passes and promos, Coverr's accounts, fee
                   payments and the monthly ledger
    scan.ts        the scanner's API: attendee list, check-in, cash, stats
    scan-errors.ts where the scanner reports its own failures
  views/           markup only — a view never touches the database
  styles/          stylesheets, imported as text and inlined into the page
migrations/        generated SQL, applied in order; never edited after it ships
public/            static files: the scanner PWA and its service worker, the one
                   self-hosted font, product shots, and the icons and link-preview
                   image generated by `npm run brand`
seed/              local data — the baseline gig and the fabricated demo band
scripts/           deploy, screenshots, brand images, and a D1 export fixer for restores
tests/             unit tests for src/lib
docs/              spec, standards audit, runbook, email setup, QA findings
```

The boundaries are enforced by convention and review, and they matter: business rules live in
`src/lib` where they can be tested without a database, a route handler reads as a sequence of
named steps, and anything that outlives the response is a job.

## A purchase, through the code

1. `GET /e/:slug` — `routes/public/buy.tsx` resolves which price rule is on sale
   (`resolveSellableRule`) and renders the form. If the `sales` kill switch is off it answers
   503 instead.
2. `POST /e/:slug/comprar` — `routes/public/purchase.tsx`:
   - rate-limits by IP, then validates the form (`lib/purchase-form.ts`);
   - re-resolves the price rule on the server and checks the rule's allocation and the
     event's capacity against live ticket counts;
   - decides what the uploaded file is from its bytes, not from what the browser claimed
     (`lib/file-type.ts`) — a file labelled as an image that is really HTML is refused;
   - hashes the file and flags it at once if the same file was already used on another order;
   - stores the proof in R2, then writes the order, one attendee row per ticket, and the proof
     record;
   - redirects to `/boletos/<order>`, where the QR codes are.
3. **After the response**, through `waitUntil`:
   - `jobs/send-tickets.ts` emails the codes as hosted PNGs, because Gmail renders neither SVG
     nor `data:` images;
   - `jobs/verify-proof.ts` reads the receipt (`lib/extract.ts`) and runs the rules in
     `lib/verify.ts`, and then `jobs/notify-flags.ts` emails the band about any critical flag
     on the order — including a recycled file caught at upload.

If anything here throws, `app.onError` serves a page telling the buyer what to do if they
already transferred, and `jobs/report-error.ts` records and emails the failure.

## Payment verification

The vision model only extracts fields, reading each one by its label rather than its position
on the screen. Rules decide what is flagged — the ones in [`src/lib/verify.ts`](src/lib/verify.ts)
run on those fields, and `HASH_DUPLICATE` is raised at upload from the file itself. Each has a
reason a person can say out loud:

| Flag | Raised when |
|---|---|
| `NOT_A_RECEIPT` | The upload does not look like a transfer confirmation |
| `UNREADABLE` | The receipt could not be read well enough — check it by hand |
| `HASH_DUPLICATE` | The exact same file was already uploaded for another order |
| `REF_DUPLICATE` | The transfer reference was already used on another purchase |
| `DEST_MISMATCH` | The money went to an account that is not the band's |
| `AMOUNT_SHORT` | Less was paid than the order costs |
| `AMOUNT_OVER` | More was paid — often someone covering a friend |
| `DATE_STALE` | The transfer is dated more than a day before the event went on sale |
| `NAME_MISMATCH` | The payer's name differs from the buyer's |

`NAME_MISMATCH` is deliberately weak: one person paying for four is the normal case. It is
shown to the band only and never reaches a buyer or the door. A date without a year — BAC's
app notification prints "15 octubre" — raises nothing, because a date that cannot be placed is
not evidence of an old one.

## Configuration

`wrangler.jsonc` is the source of truth. Bindings and variables:

| Name | Kind | Purpose |
|---|---|---|
| `DB` | D1 | The `coverr-db` database |
| `PROOFS` | R2 | The `coverr-proofs` bucket for payment screenshots |
| `ASSETS` | Static assets | Everything in `public/` |
| `PURCHASE_LIMIT` | Rate limiter | 20 purchases a minute per IP — loose on purpose, because walk-up buyers share the venue's wifi |
| `EMAIL_LIMIT` | Rate limiter | 5 a minute per IP for anything that sends email: sign-in, sign-up, ticket recovery, refund requests |
| `EXTRACT_LIMIT` | Rate limiter | 10 a minute per band for the order page's "read it again" button, a paid vision call per press |
| `APP_ORIGIN` | Variable | The canonical URL. Links in email and QR codes are built from it, and any other hostname is marked `noindex` |
| `REDIRECT_HOSTS` | Variable | Hostnames that redirect to `APP_ORIGIN`: `www.coverr.live`, and the `workers.dev` address every link sent before November 2026 points at. `/api/` and `/t/` are still served there — see `src/lib/host-redirect.ts` |
| `EMAIL_FROM` | Variable | The sender on every email, `Coverr <hola@coverr.live>`. Has to be on a domain verified in Resend, and changes together with `RESEND_API_KEY` — see [`docs/EMAIL-SETUP.md`](docs/EMAIL-SETUP.md) |
| `ALERT_EMAIL` | Variable | Where crash alerts go |
| `OPERATOR_EMAILS` | Variable | Who may sign in to `/operador`, Coverr's back office. Checked on every request, so removing an address ends that access at once |

Secrets, set in production with `npx wrangler secret put <NAME>`:

| Secret | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Yes | Signs admin sessions and magic links |
| `RESEND_API_KEY` | For email | Sends email through Resend |
| `ANTHROPIC_API_KEY` | For receipt reading | The vision call. Without it, orders still sell |

A cron trigger runs every day at 03:00 UTC: it deletes fee screenshots 90 days after the payment
unless it is still in question, and it deletes payment proofs 30 days after their
event and error-log rows after 90 days.

### Switches you can flip without deploying

Three flags live in the `platform_flags` table and take effect on the next request: `sales`
stops new purchases platform-wide (the door keeps working), `proof_extraction` stops the
vision spend, and `billing` turns on the paid settlement report. The commands are in the
runbook.

## Database and migrations

The schema lives in [`src/db/schema.ts`](src/db/schema.ts). To change it:

```bash
# 1. edit src/db/schema.ts
npm run db:generate          # writes migrations/NNNN_name.sql
# 2. read the generated SQL before going further
npm run db:migrate:local
```

Read the SQL every time. SQLite cannot add a `NOT NULL` column to a table that already has
rows unless it has a default, and the generator does not know your table has rows —
`migrations/0008_order_unit_amount.sql` shows the fix, with a backfill.

Every migration so far only adds. A migration that has shipped is never edited; write a new
one.

**In production, migrate before you deploy.** Code that expects a column the database does
not have yet fails on the first write. If it happens anyway, `/health` reports
`"database":"behind"` until the migration runs.

## Tests and checks

```bash
npm run check
```

Tests cover `src/lib`, deliberately: it is pure, it runs in milliseconds, and it is where the
decisions live that cost money or turn someone away at a door — the verification rules,
settlement, the refund gate, the per-ticket refund plan, file sniffing, the crash-alert
dedupe, the redaction of tokens from error reports, the crawl rules. Routes and views are
verified against a running worker rather than unit-tested.

CI ([`.github/workflows/check.yml`](.github/workflows/check.yml)) runs the same typecheck,
lint and tests on every push to `main` and every pull request.

## Deploying

```bash
npm run db:migrate:remote && npm run deploy
```

`npm run deploy` runs [`scripts/deploy.mjs`](scripts/deploy.mjs), which tags each Cloudflare
version with its short commit hash and writes the commit subject as its message — so the
deployment list reads like `git log` when you need to roll back. A deploy with uncommitted
changes says so in its label.

Then check it:

```bash
curl -s https://coverr.live/health
```

`{"ok":true,"database":"ok","proofs":"ok"}` means the worker is serving, D1 and R2 answer,
and the migration this code expects has been applied. In Windows PowerShell use `curl.exe`;
plain `curl` is an alias for `Invoke-WebRequest` there.

### On a new Cloudflare account

The ids in `wrangler.jsonc` belong to the account Coverr runs on today. To stand it up on
another one:

1. `npx wrangler login`, and put that account's id in `account_id`.
2. `npx wrangler d1 create coverr-db`, and paste the `database_id` it prints over the one in
   `wrangler.jsonc`.
3. `npx wrangler r2 bucket create coverr-proofs`.
4. Set `APP_ORIGIN` to the URL the worker will answer on, and `ALERT_EMAIL` to whoever should
   hear about crashes. `routes` names the custom domains, which have to be zones active on the
   new account; remove them, or add the domain to that account first. Update the
   `workers.dev` entry in `REDIRECT_HOSTS` to the new account's address. `EMAIL_FROM` has to
   be on a domain verified in the Resend account whose key you set in step 6 — see
   [docs/EMAIL-SETUP.md](docs/EMAIL-SETUP.md).
5. `npm run db:migrate:remote && npm run deploy`.
6. `npx wrangler secret put SESSION_SECRET`, with a value generated the way
   [Set up](#set-up) shows. Add `RESEND_API_KEY` and `ANTHROPIC_API_KEY` the same way when
   email and receipt reading should work. Each secret takes effect as soon as it is set.
7. Check `/health` on the new origin.

The rate limiters and the nightly cron need nothing created: they deploy with the worker,
and a limiter's `namespace_id` only has to be unique within the account.

## Operating it

[`docs/RUNBOOK.md`](docs/RUNBOOK.md) holds the procedures, and marks which ones have actually
been run against production:

- **Kill switches** — stopping sales or the vision spend without a deploy.
- **Health check** — what each `/health` state means and what to do about it.
- **Rolling back** — the commands, how to choose a version, and what an older version does
  to today's database. A rollback restores code only, never data, and two migrations have
  specific consequences while older code is live.
- **Backup and restore** — D1 Time Travel, exports, and why an export cannot be re-imported
  unmodified.

**The operator panel** is at `/operador`, signed into by magic link from an address in
`OPERATOR_EMAILS`. It lists every band and lets the operator suspend one, with a reason, give it a
free pass, or grant it a promo — a percentage off its next reports — and it logs who changed what
and when. A suspended band cannot sign in or
create events and its event pages stop selling; tickets it has already sold keep working at
the ticket page, `/recuperar` and the door. The operator session is its own cookie, sent only to
`/operador`, and lasts 12 hours.

**Fees.** With billing on, a report that is not free shows the band Coverr's account — one at the
band's own bank if there is one, else the main one, both entered at `/operador/cuentas` — and asks
for the transfer screenshot. The report opens on the upload. The screenshot is read afterwards with
the buyers' rules; anything off emails every operator, and the payment waits at
`/operador/pagos/<id>`. An operator can mark it unpaid, with a note, which stops that band creating
events until it is marked paid; nothing already on sale or unlocked closes. `/operador/cobros`
totals each month from the records and exports a CSV with the invoice number sent for each
payment.

Crashes reach the operator on their own. Unhandled errors in requests and the nightly jobs,
and JavaScript errors in the browser — the door scanner and every other page — are written to
the `error_log` table and emailed to `ALERT_EMAIL`, once per distinct error per hour. Each
source has its own budget of five alerts an hour, so a flood from a public page can never
silence a real outage. Tokens, ticket codes and order ids are stripped before anything is
stored or sent.

## Known limitations

The live, itemised status of security, privacy, performance and launch readiness is in
[`docs/STANDARDS.md`](docs/STANDARDS.md). The ones a developer trips over first:

- **18+ is stated, not enforced.** The terms and the checkout say so; nothing checks it.

## Conventions

- **Language.** Everything a buyer or door staff reads is Honduran Spanish with *vos* —
  "Subí tu comprobante", "Escribinos". Code, comments, commit messages and these docs are
  English.
- **Money** is stored as integer centavos and formatted only through `src/lib/core.ts`. Never
  build a currency string by hand.
- **Banks** are the ones listed in `src/lib/core.ts`; the product is Honduras-only and prices
  are in lempiras.
- **Design.** [`DESIGN.md`](DESIGN.md) is the reference: a neo-brutalist style built around
  the ticket, two surfaces and WCAG AA contrast on both. Light for anything a buyer sees, dark
  for anything the band sees — chosen by audience, never by a toggle. Because buyers open these
  pages on venue wifi moments before paying, nothing outside the landing page loads an
  animation library or an icon set, every page loads at most one font (Archivo Black,
  preloaded and never waited on), and the door scanner loads none at all so it works offline.
  The marketing landing page is the one place with motion.
- **Code.** Single-purpose files and functions, names that say what things are, comments that
  explain why, no dead code. [`CLAUDE.md`](CLAUDE.md) has the standards in full.

## Documentation

| File | Read it when |
|---|---|
| [`coverr-spec.html`](coverr-spec.html) | You want the full reasoning behind a product decision |
| [`docs/SPEC.md`](docs/SPEC.md) | Adding or changing a feature |
| [`DESIGN.md`](DESIGN.md) | Touching anything visual |
| [`CLAUDE.md`](CLAUDE.md) | Writing code here — layout, standards and invariants |
| [`docs/STANDARDS.md`](docs/STANDARDS.md) | Checking security, privacy or launch status, or adding a service |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Something is wrong in production, or before a backup, restore or rollback |
| [`docs/EMAIL-SETUP.md`](docs/EMAIL-SETUP.md) | Changing `EMAIL_FROM` or the Resend key |
| [`docs/QA-FINDINGS.md`](docs/QA-FINDINGS.md) | You want the history of a bug and how it was fixed |
| [`docs/QA-MULTIBAND.md`](docs/QA-MULTIBAND.md) | Testing on production with two bands, two buyers, the door and the operator |

## License

No license has been chosen. The code is not licensed for reuse.

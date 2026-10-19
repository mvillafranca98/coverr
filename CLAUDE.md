# Coverr

Presale, door check-in and settlement for independent bands in Honduras. Buyers pay by bank
transfer straight into the band's own account — **the platform never touches the money**, which
is what keeps this a SaaS tool rather than a money transmitter.

`coverr-spec.html` is the product specification. It is the source of truth for scope and for
decisions already settled; read it before proposing anything that contradicts it.

## Stack

Cloudflare Workers · Hono + `hono/jsx` server-rendered HTML · D1 (SQLite) via Drizzle ·
R2 for payment proofs · Resend for email · Anthropic vision for proof extraction.

```
src/lib/      pure logic — money, verification rules, settlement, formatting
src/db/       Drizzle schema and every query; migrations/ holds the generated SQL
src/jobs/     background work run from waitUntil, after the response has gone
src/routes/   HTTP — one router per flow, under public/ and admin/
src/views/    presentation only; a view must never touch the database
src/index.tsx the entry point: creates the app, mounts the routers, handles 404
public/       PWA scanner assets, service worker
```

Commands: `npm run dev`, `npm run typecheck`, `npm run db:generate`, `npm run db:reset`.

## Project docs
- `docs/SPEC.md`: what we're building, and the open questions. Read it before adding or changing
  features. The long-form reasoning stays in `coverr-spec.html`.
- `DESIGN.md`: tokens, the two surfaces and the contrast rules. Follow it for all UI work.
- `docs/STANDARDS.md`: which dev-standards items apply and their status. Update it when a change
  affects an item — a new service, a new paid API, auth, uploads, AI.

## Project rules
- **Honduras only.** Money is lempiras, copy is Honduran Spanish, banks are the six in
  `lib/core.ts`. No EU or UK users, so GDPR items are out of scope until that changes.
- **18+ only.** Stated in the terms and in the checkout acceptance line; still not *enforced*
  anywhere — there is no age gate. See LEG-11.
- **No animation library, no webfonts, no icon set.** Deliberate, not an oversight: buyers open
  these pages on venue wifi moments before paying. See DESIGN.md.
- **Light or dark is chosen by audience, not by preference.** Light for anything a buyer sees,
  dark for anything the band sees. There is no theme toggle and should not be one.

## Code standards

These are non-negotiable for every change in this repo.

1. **Single responsibility.** Each function, class, module and file does one thing. A route
   file that also formats messages and talks to an API is three files. Keep files small and
   focused — if you are scrolling to find a handler, split it.
2. **Readability and naming.** Descriptive, intention-revealing names. No cryptic
   abbreviations. `unavailableItemIds` beats `badIds`; `markAllAvailable` beats `reset`.
3. **Clean structure.** Group related functions. Separate business logic from I/O: pure logic
   belongs in `src/lib`, database access in `src/db/queries`, HTTP in `src/routes`, markup in
   `src/views`, and work that outlives the response in `src/jobs`. A route handler should read
   as a sequence of named steps, not an algorithm.

   The line between `lib` and `jobs`: `src/lib` never touches the database, and an adapter
   there speaks to exactly one outside thing (`email.ts` to Resend, `extract.ts` to the vision
   API). The moment something reads the database, coordinates two of those adapters, and runs
   after the response has been sent, it is a job.
4. **Documentation.** Comments explain *why*, not *what*. Document the non-obvious: an
   ordering that matters, a security boundary, a decision that looks wrong but is not. Public
   functions get a docstring. Do not narrate code that speaks for itself.
5. **Error handling.** Anticipate edge cases and fail with a clear, specific message. Prefer
   returning a typed result over throwing when the caller can reasonably recover. Never let a
   generic crash stand in for a handled case.
6. **No dead code.** No unused imports, no leftover debug logging, no commented-out blocks. If
   it is not used, delete it — git remembers.

## Invariants

Breaking one of these breaks the product, not just a test.

- **The QR issues immediately, always.** Verification and email run after the response
  (`waitUntil`). A flag is internal bookkeeping; it never holds a buyer in a pending state.
- **Verification is deterministic.** Vision extracts fields; the checks in `src/lib/verify.ts`
  are rules with a reason you can say out loud. No model ever judges authenticity — that is
  excluded from the product, not deferred. Extraction reads *by label, never by position*.
- **`NAME_MISMATCH` never reaches a buyer or the door.** One person paying for four is the
  common case. It is a weak admin-only signal.
- **Amber always names its reason on screen.** Staff resolving a flag in five seconds is the
  point; staff phoning the admin is the failure.
- **Money is re-resolved server-side.** The client never tells us a price, a rule id or an
  amount. See `resolveActiveRule`.
- **Cash and comps are first-class.** Cash was 39% of the door. Comps are orders with
  `channel = comp` and `expected_amount = 0`: they check in, they count toward attendance,
  they contribute nothing to revenue and never count toward a pricing bracket.
- **The scanner works offline.** It caches the full attendee list and validates locally. A
  cross-device double scan is flagged at sync, not prevented — the wristband is the real
  anti-passback control.
- **Public endpoints do not leak membership.** `/recuperar` and band signup answer identically
  whether or not the address exists.
- **Proofs are PII.** A `web_result` screenshot exposes a third party's full account number.
  Admin-only access, purge 30 days after the event.
- **A refund voids the QR and writes a negative line.** History is never deleted.
- **Ticket counts come from records, never a typed cell.** The spreadsheet this replaces
  hardcoded `92` and silently stopped updating.
- **The paywall is the settlement report only.** Presale, QR delivery, check-in, cash sales
  and the live dashboard stay free every time; band history is never gated. Locking the live
  dashboard would break the product on the night.

## Language

Buyer- and staff-facing copy is Honduran Spanish, informal *vos* ("Subí tu comprobante",
"Escribinos"). Code, comments, commit messages and identifiers are English. Money is stored in
centavos as integers and formatted through `src/lib/core.ts` — never build a currency string by
hand.

# Runbook

Operational procedures. Everything here has been run at least once against production —
a procedure nobody has executed is a guess.

## Kill switches

Three switches live in the `platform_flags` table. They take effect on the **next request** —
no deploy, no rebuild, no restart. An empty table is the normal state: every switch falls back
to its default in `src/lib/flags.ts`.

| Key | Default | Off means |
|---|---|---|
| `sales` | on | No new purchases anywhere. QR delivery, check-in, the scanner and the live dashboard are untouched. |
| `proof_extraction` | on | No vision call. Orders still sell, proofs still stored, a human reads them. |
| `billing` | **off** | The settlement report is free for everyone. Turning it on also rewrites the fee paragraph in `/terminos`. |

### Stop sales right now

```bash
npx wrangler d1 execute coverr-db --remote --command "INSERT INTO platform_flags (key, enabled, note, changed_at) VALUES ('sales', 0, 'wrong bank account on the Daydrinking event', datetime('now')) ON CONFLICT(key) DO UPDATE SET enabled=0, note=excluded.note, changed_at=excluded.changed_at"
```

Buyers then get a 503 saying the sale is paused and to keep their receipt. Turn it back on with
`enabled=1`, or delete the row.

### Stop the vision spend

Same statement with `'proof_extraction'`. Use this when the Anthropic bill is running away and
you want presale to keep working — the proofs wait in the bucket and the band reads them from
the order page.

Deleting the `ANTHROPIC_API_KEY` secret also stops the spend, but it is a worse tool: it is a
secret rotation, it affects nothing else you might want to keep, and putting it back means
having the key to hand.

### See what is set

```bash
npx wrangler d1 execute coverr-db --remote --command "SELECT * FROM platform_flags"
```

No rows means everything is at its default: sales on, extraction on, billing off.

### What a kill switch must never touch

The door. `sales` deliberately does not reach check-in, the scanner, the attendee list or the
live dashboard, because taking those down mid-gig is a worse failure than almost anything it
could be protecting against — a band standing at a door with 150 people outside and no list has
no fallback. The same reasoning is why `readFlags` fails **open**: if the table cannot be read,
sales keep running. Stopping has to be something somebody chose.

### Run against production on 2026-11-04

Thrown during the multi-band test (`docs/QA-MULTIBAND.md`, parts 7 and 8), with the commands
above:

- `billing` on and off again: `/terminos` dropped and then restored the "Por ahora el reporte
  también es gratis" line, and a band paid its fee by transfer in between.
- `sales` off for about two minutes: every sale page answered 503 "La venta está pausada", the
  real band's included, while `/health`, `/recuperar`, the dashboards and the door kept working.
  Back on, all of them sold again at once.

`proof_extraction` has still only been thrown locally (2026-10-28).

## Health check

`GET /health` answers 200 when everything a purchase needs is reachable, and 503 naming what
is not. It exists for an external monitor; `/` cannot do this job, because the landing page
renders without touching the database and stays green through a complete D1 outage.

```bash
curl -s https://coverr.live/health
```

```json
{"ok":true,"database":"ok","proofs":"ok"}
```

The body never carries error text. The detail is in the log as a `[health]` line — Workers
Logs in the dashboard, or `npx wrangler tail` while it is happening.

| Field | State | What it means | What to do |
|---|---|---|---|
| `database` | `behind` | D1 answers, but the migration this deploy was built against has not been applied. Pages load; **every purchase fails** on the missing column. | `npm run db:migrate:remote`. This is the deploy-before-migrate mistake, and running the migration is the fix. |
| `database` | `down` | D1 refused the query. Nothing loads that reads data. | Check the Cloudflare status page and the `[health]` log line. Nothing in Coverr fixes a D1 outage. Scanners that already cached the list keep checking people in offline. |
| `database` | `timeout` | D1 took longer than 5 seconds. | Same places as `down`. One slow answer can be noise; several in a row are not. |
| `proofs` | `down` or `timeout` | R2 is unreachable. The proof is stored before the order is written, so a buyer gets the crash page and **no order exists**. The crash page tells anyone who already transferred to write in. | Check the Cloudflare status page. Expect messages from buyers who paid and have no ticket; their transfers will be in the band's bank, not in Coverr. |

Email and proof extraction are deliberately not probed. Both run after the response, the QR
issues without them, and their failures already reach you through the crash alerts. Probing
the vision API here would also be a paid call every few minutes.

### The monitor

The worker cannot watch itself — if it is down, so is anything it would run — so this has to be
an outside service. Any uptime monitor works. What it needs:

- URL `https://coverr.live/health`
- Every 5 minutes or more often
- Alert on any status other than 200
- Alerts to your own inbox from the monitoring service itself — **not** through Coverr's Resend
  account, which is one of the things that can be broken when the alert fires

One monitor is enough. A 200 from `/health` already proves the worker is serving requests.

### Run against production

Verified locally on 2026-10-28 in all three states: healthy (200), the 0009 migration row
removed (503, `database: behind`) and the migrations table made unreadable (503,
`database: down`), with the local database restored afterwards. `HEAD` answers like `GET`, for
monitors that use it.

Live since 2026-10-28. Production answers `{"ok":true,"database":"ok","proofs":"ok"}`.
**No monitor is set up yet** — until one is, nothing calls this endpoint and an outage is still
noticed by whoever hits it first.

In Windows PowerShell, `curl` is an alias for `Invoke-WebRequest` and prompts for parameters;
use `curl.exe` for the command above.

## Rolling back

A rollback puts an earlier version's **code** live in seconds. It does not touch the database:
D1 keeps every migration and every row written since. So the question before a rollback is not
only "which version was good" but "what does that version do with today's database" — see the
table below before choosing.

### Do it

```bash
npx wrangler deployments list
npx wrangler rollback <version-id> --message "checkout broken since 21:10"
```

The dashboard does the same from the worker's **Deployments** tab. A rollback can reach any of the
100 most recent versions.

**Finding the right version.** Every deploy made with `npm run deploy` since 2026-10-28 carries
its commit: the tag is the short hash and the message is the commit subject, so the list reads
like `git log`. A message ending in *(+ uncommitted changes)* matches no commit. Versions from
before that show `-` for both; match their *Created* time against
`git log --format="%h %ci %s"`.

**Which versions predate a migration.** The unlabelled versions from 2026-10-28, matched by
creation time (UTC) against commit time. Inferred, not recorded — it assumes each was deployed
from `main` as committed at that moment:

| Version created | Code it runs | Rolling back to it |
|---|---|---|
| 18:22, 18:26 | `1b91269` | Neither migration problem below. Has `/health`; no sitemap or scanner error reporting. |
| 16:55 | `dfcc16c`, F13 without its follow-up | Nothing at the door, but after a partial refund some totals overcount and a sold-out presale tier stays closed. No `/health`. |
| 16:41 | `5bc95d5`, F14 but not F13 | The `0009` problem. |
| 16:28 and earlier | before F14 | Both the `0009` and `0008` problems. |

From `b91d16a` on every version is labelled, so this table does not need to grow.

**Undoing a rollback** is another rollback, to the newer version's id — or `npm run deploy` from
`main`.

**Checking it worked.** `curl -s https://coverr.live/health`. A version from
before LCH-06 has no `/health` and answers 404, so the uptime monitor goes red for as long as it
is live. That is the rollback, not an outage.

### What an older version does with today's database

Every migration so far only adds, so old code still runs against the new schema. It simply
ignores what it has never heard of, and each migration has one specific consequence while an
older version is live:

| Rolling back to before | While the old code is live | After rolling forward |
|---|---|---|
| `0009_partial_refunds` (F13) | Tickets refunded one at a time look live again: they **scan `ok` at the door** and count in the totals. Refunds go back to whole-order only. | Nothing to repair — the voids were never erased. |
| `0008_order_unit_amount` (F14) | New orders are written with `unit_amount = 0`. | **Revenue undercounts those orders.** Run the repair below. |
| `0007_platform_flags` (LCH-04) | The kill switches stop working; a switch you threw is ignored. | They take effect again. |
| `0006_error_log` (LCH-05) | Crashes stop alerting. | Alerting resumes; nothing from the gap is recovered. |

The repair after rolling forward past `0008`, safe to run whenever in doubt — it touches only rows
old code wrote, and is a no-op otherwise:

```bash
npx wrangler d1 execute coverr-db --remote --command "UPDATE orders SET unit_amount = expected_amount / quantity WHERE unit_amount = 0 AND expected_amount > 0 AND quantity > 0"
```

Exact for the same reason as the migration's own backfill: every write path sets
`expected_amount = unit_amount × quantity`. Comps stay at 0, which is right.

### When not to roll back

- **During a gig, to before `0009`**, if anyone has had part of an order refunded: their returned
  tickets would scan at the door. If you have to, every partly refunded order marks its returned
  tickets with a red *reembolsado* chip on the order page — tell the door who they are.
- **To undo a migration.** A rollback cannot. Time Travel can (see *Backup and restore*), but it
  rewinds every row: orders, check-ins and refunds made since that moment are gone, and on a sale
  day those are tickets people paid for. Fix forward instead.

### Not yet run against production

No rollback has ever been performed. Rehearse it once on a day with nothing on sale: roll back to
the previous version, check `/health` and a buy page, roll forward, then run the `0008` repair
above in case anything sold in between. About two minutes.

## Backup and restore

### What protects the data today

| Mechanism | Covers | Window |
|---|---|---|
| D1 Time Travel | Accidental writes, a bad migration, a dropped table | Cloudflare's retention for the account's D1 plan |
| Manual export | Everything, including losing the account | However long you keep the file |

Time Travel is automatic and needs no setup. It restores **in place**, so it undoes a mistake;
it is not an off-site copy.

### Taking a backup

```bash
npx wrangler d1 export coverr-db --remote --output ~/coverr-backups/coverr-$(date +%F).sql
```

Roughly 150 KB and about 4 seconds at 132 orders.

**The file is PII.** It holds every buyer's name, email and phone, and the extracted fields of
any payment proof not yet purged. Keep it outside the repo — `.gitignore` guards the obvious
names, but the real rule is "not in a directory git can see". Delete it when it is no longer
needed.

### Restoring

A D1 export **cannot be imported back into D1 as it stands.** Three things break, each only
visible once the previous one is fixed:

1. The dump is alphabetical, interleaving each table's `CREATE` with its `INSERT`s. `advances`
   sorts first and references `events`, which is not created until 300 lines later →
   `no such table: main.events`. The `PRAGMA defer_foreign_keys=TRUE` at the top of the dump is
   not honoured.
2. With the schema created first, the rows are still alphabetical, so children land before
   parents → `FOREIGN KEY constraint failed`.
3. The dump's `DELETE FROM sqlite_sequence` does not merely fail — it kills the import with
   `{"D1_RESET_DO":true}`, which looks like an outage rather than a bad statement.

`scripts/reorder-d1-export.mjs` fixes all three by reordering only — no statement is rewritten.

```bash
node scripts/reorder-d1-export.mjs ~/coverr-backups/coverr-2026-10-19.sql /tmp/importable.sql
npx wrangler d1 execute <target-db> --remote --file /tmp/importable.sql --yes
```

The target must be empty. Dropping tables first requires **children before parents**, the
reverse of the load order the script prints.

### Restoring onto production

Only when production is already broken, and never as a first move — try Time Travel first,
since it needs no file and no downtime:

```bash
npx wrangler d1 time-travel info coverr-db                       # current bookmark
npx wrangler d1 time-travel restore coverr-db --bookmark=<bookmark>
```

Take an export **before** restoring over anything. A failed restore on top of a broken database
leaves nothing to go back to.

**A restore brings deleted accounts back.** Rewinding D1 past the moment a band deleted its
account restores every row it had: buyers' names, emails and phones included. The proof images
stay gone, because R2 is not rewound. So after any restore, find the deletions made since the
restore point — search Workers Logs in the dashboard for `[account] deleted band=` — and repeat
each one:

```bash
npx wrangler d1 execute coverr-db --remote --command "DELETE FROM bands WHERE id = 'bnd_…'"
```

The foreign keys' cascade takes the rest, exactly as the app's own deletion does. Workers Logs
keep only a few days, which is one more reason Time Travel is for undoing minutes, not weeks. The
same applies to a manual export: one taken before a band left still holds everything it had.

### Restore test log

| Date | Rows | Export | Restore | Result |
|---|---|---|---|---|
| 2026-10-19 | 407 across 15 tables | 4s | 3s | Pass, after fixing the three issues above. Row counts, `sum(expected_amount)`, earliest order id, latest `created_at` and all 24 indexes identical to production |

Re-run after any schema change that adds a table or a foreign key — the load order changes with
it. `coverr-restore-test` (D1 `66b60b55-f17e-40ea-9266-80745caa349a`) exists as the scratch
target; it holds a copy of production data, so treat it as PII or drop its tables after a test.

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

### Not yet run against production

Verified end to end locally on 2026-10-28 — sales off returns 503 on the buy page and refuses
the POST, sales on sells normally, billing on rewrites `/terminos`. Not yet exercised against
production, which needs the migration deployed first.

## Health check

`GET /health` answers 200 when everything a purchase needs is reachable, and 503 naming what
is not. It exists for an external monitor; `/` cannot do this job, because the landing page
renders without touching the database and stays green through a complete D1 outage.

```bash
curl -s https://coverr.a-mencias99.workers.dev/health
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

- URL `https://coverr.a-mencias99.workers.dev/health` (update it when the custom domain lands, LCH-12)
- Every 5 minutes or more often
- Alert on any status other than 200
- Alerts to your own inbox from the monitoring service itself — **not** through Coverr's Resend
  account, which is one of the things that can be broken when the alert fires

One monitor is enough. A 200 from `/health` already proves the worker is serving requests.

### Not yet run against production

Verified locally on 2026-10-28 in all three states: healthy (200), the 0009 migration row
removed (503, `database: behind`) and the migrations table made unreadable (503,
`database: down`), with the local database restored afterwards. `HEAD` answers like `GET`, for
monitors that use it. Not yet deployed, and no monitor is set up.

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

### Restore test log

| Date | Rows | Export | Restore | Result |
|---|---|---|---|---|
| 2026-10-19 | 407 across 15 tables | 4s | 3s | Pass, after fixing the three issues above. Row counts, `sum(expected_amount)`, earliest order id, latest `created_at` and all 24 indexes identical to production |

Re-run after any schema change that adds a table or a foreign key — the load order changes with
it. `coverr-restore-test` (D1 `66b60b55-f17e-40ea-9266-80745caa349a`) exists as the scratch
target; it holds a copy of production data, so treat it as PII or drop its tables after a test.

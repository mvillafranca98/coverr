# Runbook

Operational procedures. Everything here has been run at least once against production —
a procedure nobody has executed is a guess.

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

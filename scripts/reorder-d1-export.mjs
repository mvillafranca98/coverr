#!/usr/bin/env node
/**
 * Makes a `wrangler d1 export` dump importable again.
 *
 * The problem this exists to solve, found by actually testing a restore on
 * 2026-10-19: **a D1 export cannot be imported back into D1 as it stands.**
 * Three separate things go wrong, and each one only surfaces once the last is
 * fixed:
 *
 *  1. The export is written in **alphabetical order**, interleaving each
 *     table's CREATE with its INSERTs. `advances` sorts first and carries
 *     `FOREIGN KEY (event_id) REFERENCES events(id)`, but `events` is not
 *     created until 300 lines later, so the import dies on the first data row
 *     with "no such table: main.events". The `PRAGMA defer_foreign_keys=TRUE`
 *     the export puts at the top is not honoured.
 *
 *  2. With every table created first, the rows are still alphabetical, so a
 *     child row lands before its parent and the import dies with
 *     "FOREIGN KEY constraint failed". Tables have to be loaded parents
 *     first, which is what the topological sort below is for.
 *
 *  3. The export ends with `DELETE FROM sqlite_sequence`. D1 will not let a
 *     query touch that table and does not merely reject the statement — it
 *     kills the import with `{"D1_RESET_DO":true}`, which reads like an
 *     infrastructure fault rather than a bad statement.
 *
 * So: Cloudflare's own backup format cannot be restored into Cloudflare's own
 * database without this step. Much better to know that now than on the night
 * it is needed.
 *
 * No statement is rewritten — this only reorders, and drops the
 * `sqlite_sequence` bookkeeping SQLite rebuilds by itself.
 *
 * Usage:
 *   node scripts/reorder-d1-export.mjs <export.sql> <importable.sql>
 *
 * Full procedure in docs/RUNBOOK.md.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);

if (!input || !output) {
  console.error("usage: node scripts/reorder-d1-export.mjs <export.sql> <importable.sql>");
  process.exit(1);
}

/**
 * Splits the dump into whole statements. A naive split on ";" would cut
 * through any semicolon inside a quoted value — a band called "Rock; Paper"
 * is enough to corrupt a restore — so quotes are tracked. SQLite escapes a
 * quote by doubling it, which this handles by simply toggling twice.
 */
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let quote = null;

  for (const char of sql) {
    current += char;
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === "'" || char === '"' || char === "`") {
      quote = char;
    } else if (char === ";") {
      statements.push(current.trim());
      current = "";
    }
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements.filter(Boolean);
}

/** The table a `CREATE TABLE` or `INSERT INTO` statement is about, or null. */
function tableOf(statement, keyword) {
  const pattern = new RegExp(`^${keyword}\\s+(?:IF NOT EXISTS\\s+)?["\`']?(\\w+)`, "i");
  const match = statement.match(pattern);
  return match ? match[1] : null;
}

/**
 * Orders tables so every parent is loaded before its children.
 *
 * Depth-first, and deliberately forgiving: a table in a reference cycle, or
 * one whose parent is missing from the dump, is still emitted rather than
 * dropped. A restore that fails loudly on one constraint can be worked
 * through; one that quietly leaves rows behind cannot.
 */
function parentsFirst(tables, dependencies) {
  const ordered = [];
  const done = new Set();
  const visiting = new Set();

  function visit(table) {
    if (done.has(table) || visiting.has(table)) return;
    visiting.add(table);
    for (const parent of dependencies.get(table) ?? []) {
      if (parent !== table && tables.includes(parent)) visit(parent);
    }
    visiting.delete(table);
    done.add(table);
    ordered.push(table);
  }

  for (const table of tables) visit(table);
  return ordered;
}

const statements = splitStatements(readFileSync(input, "utf8"));

const creates = [];
const indexes = [];
const others = [];
const insertsByTable = new Map();
const dependencies = new Map();
const tableOrder = [];

const TOUCHES_SEQUENCE = /sqlite_sequence/i;

for (const statement of statements) {
  // Before anything else: D1 kills the whole import over one of these.
  if (TOUCHES_SEQUENCE.test(statement)) continue;

  const head = statement.replace(/^\s+/, "").slice(0, 40).toUpperCase();

  if (head.startsWith("CREATE TABLE")) {
    const table = tableOf(statement, "CREATE TABLE");
    creates.push(statement);
    if (table) {
      tableOrder.push(table);
      dependencies.set(
        table,
        [...statement.matchAll(/REFERENCES\s+["`']?(\w+)/gi)].map((m) => m[1]),
      );
    }
  } else if (head.startsWith("CREATE INDEX") || head.startsWith("CREATE UNIQUE INDEX")) {
    indexes.push(statement);
  } else if (head.startsWith("INSERT INTO")) {
    const table = tableOf(statement, "INSERT INTO");
    if (!table) {
      others.push(statement);
    } else {
      if (!insertsByTable.has(table)) insertsByTable.set(table, []);
      insertsByTable.get(table).push(statement);
    }
  } else if (head.startsWith("PRAGMA")) {
    // Dropped deliberately: D1 ignores it on import, and keeping it implies a
    // guarantee that is the whole reason this script has to exist.
    continue;
  } else {
    others.push(statement);
  }
}

const loadOrder = parentsFirst(tableOrder, dependencies);

// Rows for a table with no CREATE in the dump would be dropped on the floor by
// the grouping above. That is exactly the quiet data loss a restore must never
// have, so stop instead.
for (const table of insertsByTable.keys()) {
  if (!loadOrder.includes(table)) {
    console.error(`refusing to continue: rows for "${table}" but no CREATE TABLE in the dump`);
    process.exit(1);
  }
}

const inserts = loadOrder.flatMap((table) => insertsByTable.get(table) ?? []);
const ordered = [...creates, ...others, ...inserts, ...indexes];
writeFileSync(output, ordered.join("\n") + "\n", "utf8");

console.log(
  `reordered ${statements.length} statements -> ${ordered.length} written\n` +
    `  tables   ${creates.length}\n` +
    `  rows     ${inserts.length}\n` +
    `  indexes  ${indexes.length}\n` +
    `  other    ${others.length}\n` +
    `  load order: ${loadOrder.join(" -> ")}\n` +
    `  -> ${output}`,
);

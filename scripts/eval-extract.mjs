/**
 * Reads real payment proofs with several models and grades every read against
 * what a person saw on the receipt, to choose the model buyers' proofs go to.
 *
 * It calls the production extractor (src/lib/extract.ts) with only the model
 * swapped, so the prompt, schema, effort, max_tokens and timeouts are exactly
 * what a purchase gets. Every call is billed to the key in ANTHROPIC_API_KEY.
 *
 *   node scripts/eval-extract.mjs <folder> [--runs 3] [--models claude-opus-5,claude-haiku-5-5]
 *
 * The folder lives outside the repo, because proofs are PII. Beside the images
 * it holds expected.json, one entry per file:
 *
 *   { "receipt.jpg": { "receipt": true, "amount": 250, "reference": "123456789",
 *                      "destLast4": "1234", "sentOn": "2026-10-15", "yearPrinted": true },
 *     "ticket.webp": { "receipt": false } }
 *
 * Accounts are kept as their last four digits: that is all verify.ts compares,
 * and it keeps full account numbers out of one more file. Results are written
 * to <folder>/results/ with accounts cut the same way.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { parseArgs } from "node:util";
import { extractProof, PROOF_MODEL } from "../src/lib/extract.ts";

/** USD per million tokens. A receipt stays far below Haiku's 100K-token rate break. */
const PRICE_PER_MTOK = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

/** Production's model first, then every other model we can put a price on. */
const DEFAULT_MODELS = [
  PROOF_MODEL,
  ...Object.keys(PRICE_PER_MTOK).filter((model) => model !== PROOF_MODEL),
];

/** The Anthropic spend limit the projection is measured against. */
const MONTHLY_LIMIT_USD = 25;

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

/** The same test verify.ts applies before it trusts a date. */
const HAS_FULL_YEAR = /^\d{4}-\d{2}-\d{2}/;

const digits = (value) => String(value ?? "").replace(/\D/g, "");
const lastFour = (value) => digits(value).slice(-4);

/**
 * Which of the fields the checks depend on were read right, compared the way
 * verify.ts compares them, so a difference that changes no flag is no miss.
 * On a receipt with no year printed, the right read is no year at all.
 */
function grade(fields, expected) {
  if (!expected.receipt) return { notReceipt: fields.is_payment_confirmation === false };
  const datetime = fields.datetime ?? "";
  return {
    receipt: fields.is_payment_confirmation === true,
    legible: fields.legible === true,
    amount:
      fields.amount != null &&
      Math.round(fields.amount * 100) === Math.round(expected.amount * 100),
    reference: digits(fields.reference) === expected.reference,
    account: lastFour(fields.dest_account) === expected.destLast4,
    date: expected.yearPrinted
      ? datetime.startsWith(expected.sentOn)
      : !HAS_FULL_YEAR.test(datetime),
  };
}

/** What a model read instead, for each field it got wrong. */
const DESCRIBE_MISS = {
  notReceipt: () => "took it for a receipt",
  receipt: () => "said it is not a receipt",
  legible: () => "said it is unreadable",
  amount: (fields) => `amount ${fields.amount}`,
  reference: (fields) => `reference ${fields.reference}`,
  account: (fields) => `account …${lastFour(fields.dest_account) || "(none)"}`,
  date: (fields) => `date ${fields.datetime}`,
};

function misses(record) {
  return Object.entries(record.grades)
    .filter(([, right]) => !right)
    .map(([field]) => DESCRIBE_MISS[field](record.fields));
}

function withAccountsCut(fields) {
  const cut = (account) => (account ? `…${lastFour(account)}` : account);
  return {
    ...fields,
    sender_account: cut(fields.sender_account),
    dest_account: cut(fields.dest_account),
  };
}

function costUsd(model, usage) {
  const price = PRICE_PER_MTOK[model];
  if (!price) return null;
  return (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1e6;
}

async function loadReceipts(folder) {
  const expected = JSON.parse(await readFile(join(folder, "expected.json"), "utf8"));
  const names = (await readdir(folder)).filter(
    (name) => CONTENT_TYPES[extname(name).toLowerCase()],
  );
  const unlisted = names.filter((name) => !(name in expected));
  const missing = Object.keys(expected).filter((name) => !names.includes(name));
  if (unlisted.length) throw new Error(`expected.json has no entry for: ${unlisted.join(", ")}`);
  if (missing.length)
    throw new Error(`expected.json lists files not in the folder: ${missing.join(", ")}`);
  return Promise.all(
    names.map(async (name) => {
      const bytes = await readFile(join(folder, name));
      return {
        name,
        expected: expected[name],
        file: {
          bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          contentType: CONTENT_TYPES[extname(name).toLowerCase()],
        },
      };
    }),
  );
}

async function readOnce(apiKey, receipt, model, run) {
  const started = performance.now();
  const result = await extractProof(apiKey, receipt.file, model);
  const seconds = (performance.now() - started) / 1000;
  const base = { model, receipt: receipt.name, run, seconds };
  if (!result.ok) return { ...base, ok: false, error: result.error };
  return {
    ...base,
    ok: true,
    costUsd: costUsd(model, result.usage),
    usage: result.usage,
    grades: grade(result.fields, receipt.expected),
    fields: withAccountsCut(result.fields),
  };
}

function progressLine(record) {
  const head = `${record.model.padEnd(18)} ${record.receipt.padEnd(30)} run ${record.run}  ${record.seconds.toFixed(1)}s`;
  if (!record.ok) return `${head}  FAILED  ${record.error}`;
  const wrong = misses(record);
  const cost = record.costUsd == null ? "" : `$${record.costUsd.toFixed(4)}`;
  return `${head}  ${cost.padEnd(8)} ${wrong.length ? `✗ ${wrong.join("; ")}` : "✓"}`;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function summarize(model, records) {
  const reads = records.filter((record) => record.model === model);
  const answered = reads.filter((record) => record.ok);
  const grades = answered.flatMap((record) => Object.values(record.grades));
  const allRight = answered.filter((record) => Object.values(record.grades).every(Boolean));
  const costs = answered.map((record) => record.costUsd).filter((cost) => cost != null);
  const costPerRead = costs.length
    ? costs.reduce((sum, cost) => sum + cost, 0) / costs.length
    : null;
  const seconds = reads.map((record) => record.seconds);
  return {
    model,
    "no answer": reads.length - answered.length,
    "fields right": `${grades.filter(Boolean).length}/${grades.length}`,
    "receipts all right": `${allRight.length}/${reads.length}`,
    "median s": Number(median(seconds).toFixed(1)),
    "slowest s": Number(Math.max(...seconds).toFixed(1)),
    "$ per read": costPerRead == null ? "?" : Number(costPerRead.toFixed(4)),
    [`reads per $${MONTHLY_LIMIT_USD}`]: costPerRead
      ? Math.floor(MONTHLY_LIMIT_USD / costPerRead)
      : "?",
  };
}

function receiptGrid(receipts, models, records) {
  return Object.fromEntries(
    receipts.map(({ name }) => [
      name,
      Object.fromEntries(
        models.map((model) => {
          const reads = records.filter(
            (record) => record.model === model && record.receipt === name,
          );
          const right = reads.filter((record) => record.ok && misses(record).length === 0);
          return [model, `${right.length}/${reads.length}`];
        }),
      ),
    ]),
  );
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      runs: { type: "string", default: "1" },
      models: { type: "string", default: DEFAULT_MODELS.join(",") },
    },
  });
  const folder = positionals[0];
  const runs = Number(values.runs);
  const models = values.models
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!folder)
    throw new Error("Usage: node scripts/eval-extract.mjs <folder> [--runs N] [--models a,b]");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in this terminal.");
  if (!Number.isInteger(runs) || runs < 1)
    throw new Error("--runs must be a whole number of 1 or more.");

  const receipts = await loadReceipts(folder);
  console.log(
    `${receipts.length} files × ${models.length} models × ${runs} runs = ${receipts.length * models.length * runs} reads\n`,
  );

  // One read at a time, so a model's latency is its own and not the queue's.
  const records = [];
  for (let run = 1; run <= runs; run++) {
    for (const receipt of receipts) {
      for (const model of models) {
        const record = await readOnce(apiKey, receipt, model, run);
        records.push(record);
        console.log(progressLine(record));
      }
    }
  }

  const summary = models.map((model) => summarize(model, records));
  const grid = receiptGrid(receipts, models, records);
  console.log("\nBy model");
  // biome-ignore lint/suspicious/noConsole: the tables are this script's report.
  console.table(summary);
  console.log("Reads with every field right, by file");
  // biome-ignore lint/suspicious/noConsole: the tables are this script's report.
  console.table(grid);

  const spent = records.reduce((sum, record) => sum + (record.costUsd ?? 0), 0);
  console.log(`Spent about $${spent.toFixed(2)}.`);

  const resultsFolder = join(folder, "results");
  await mkdir(resultsFolder, { recursive: true });
  const resultsFile = join(resultsFolder, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(resultsFile, JSON.stringify({ models, runs, summary, grid, records }, null, 2));
  console.log(`Every read is in ${resultsFile}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

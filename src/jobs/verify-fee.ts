import { drizzle } from "drizzle-orm/d1";
import {
  feeEvidenceSeenBefore,
  feePaymentWithContext,
  listPlatformAccounts,
  recordFeeCheck,
} from "../db/queries/fees";
import { readFlags } from "../db/queries/flags";
import * as s from "../db/schema";
import { isReadableProof } from "../lib/core";
import { makeTransport } from "../lib/email";
import { extractProof } from "../lib/extract";
import { feeCheckOutcome } from "../lib/fees";
import { type Flag, verifyProof } from "../lib/verify";
import { feeAlertEmailHtml, feeAlertEmailSubject, feeAlertEmailText } from "../views/email";

type Env = {
  DB: D1Database;
  PROOFS: R2Bucket;
  ANTHROPIC_API_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_ORIGIN: string;
  OPERATOR_EMAILS?: string[];
};

/** Why a screenshot went to a person unread: the operator reads it instead. */
const NOT_READ: Flag = {
  code: "UNREADABLE",
  severity: "info",
  detail: "No se pudo leer la captura automáticamente: revisala a mano",
};

/**
 * Reads a band's fee screenshot after the response and decides whether a
 * person needs to look at it.
 *
 * The report opened the moment the band uploaded, and nothing here can close
 * it again; the same rule buyers get. The checks are the buyers' own rules,
 * run against Coverr's accounts and the amount the band was asked for. Any
 * flag, even one that only says the screenshot could not be read, emails
 * every operator — this is Coverr's own money.
 */
export async function runFeeVerification(env: Env, feePaymentId: string): Promise<void> {
  const db = drizzle(env.DB, { schema: s });
  const found = await feePaymentWithContext(db, feePaymentId);
  if (!found) return;
  const { fee, band, event } = found;

  const checked = await checkScreenshot(env, db, fee, event);
  const outcome = feeCheckOutcome(checked.flags);
  await recordFeeCheck(db, fee.id, { ...outcome, read: checked.read });
  console.log(
    `[fee] ${fee.id} ${outcome.status} flags=${outcome.flags.map((f) => f.code).join(",") || "none"}`,
  );

  if (outcome.status === "flagged") {
    await alertOperators(env, {
      band,
      event,
      amount: fee.amount,
      flags: outcome.flags,
      url: `${env.APP_ORIGIN}/operador/pagos/${fee.id}`,
    });
  }
}

type FeeRow = NonNullable<Awaited<ReturnType<typeof feePaymentWithContext>>>["fee"];
type EventRow = NonNullable<Awaited<ReturnType<typeof feePaymentWithContext>>>["event"];

async function checkScreenshot(
  env: Env,
  db: ReturnType<typeof drizzle<typeof s>>,
  fee: FeeRow,
  event: EventRow,
): Promise<{ flags: Flag[]; read?: Parameters<typeof recordFeeCheck>[2]["read"] }> {
  if (!env.ANTHROPIC_API_KEY || !fee.fileKey || !isReadableProof(fee.contentType)) {
    return { flags: [NOT_READ] };
  }
  // The switch for a runaway vision bill applies here too; a person reads it instead.
  if (!(await readFlags(db)).proof_extraction) return { flags: [NOT_READ] };

  const object = await env.PROOFS.get(fee.fileKey);
  if (!object) {
    console.error(`[fee] screenshot missing: ${fee.fileKey}`);
    return { flags: [NOT_READ] };
  }

  const result = await extractProof(env.ANTHROPIC_API_KEY, {
    bytes: await object.arrayBuffer(),
    contentType: fee.contentType,
  });
  if (!result.ok) {
    console.error(`[fee] extraction failed for ${fee.id}: ${result.error}`);
    return { flags: [NOT_READ] };
  }

  const f = result.fields;
  // Digits only, the same normalisation the duplicate-reference rule compares with.
  const reference = f.reference ? f.reference.replace(/\D/g, "") : null;
  const seen = await feeEvidenceSeenBefore(db, {
    feePaymentId: fee.id,
    reference,
    sha256: fee.sha256,
  });
  // Every account Coverr has ever collected into, retired ones included: a
  // transfer made just before an account was retired is still a payment.
  const accounts = await listPlatformAccounts(db);

  const flags = verifyProof({
    fields: f,
    expectedAmount: fee.amount,
    // Whoever in the band pays, pays from their own account; the sender's
    // name is not a check here (see feeCheckOutcome).
    payerName: "",
    bandAccounts: accounts.map((account) => account.accountNumber),
    eventCreatedAt: event.createdAt,
    knownReferences: seen.sameReference && reference ? new Set([reference]) : new Set(),
  });
  if (seen.sameFile) {
    flags.push({
      code: "HASH_DUPLICATE",
      severity: "critical",
      detail: "Esta misma captura ya se usó para pagar otro reporte",
    });
  }

  return {
    flags,
    read: {
      amount: f.amount == null ? null : Math.round(f.amount * 100),
      destAccount: f.dest_account,
      reference,
      datetime: f.datetime,
      senderName: f.sender_name,
      bank: f.bank,
    },
  };
}

/** One email per operator, each with its own address. A failed one is logged, never thrown. */
async function alertOperators(
  env: Env,
  alert: Parameters<typeof feeAlertEmailHtml>[0],
): Promise<void> {
  const transport = makeTransport(env);
  await Promise.all(
    (env.OPERATOR_EMAILS ?? []).map(async (to) => {
      const result = await transport.send({
        to,
        subject: feeAlertEmailSubject(alert),
        html: feeAlertEmailHtml(alert),
        text: feeAlertEmailText(alert),
        replyTo: alert.band.contactEmail,
      });
      if (!result.ok) console.error(`[fee] operator alert failed: ${result.error}`);
    }),
  );
}

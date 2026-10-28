import type { ClientErrorReport } from "../lib/client-error";
import { type ErrorKind, reportError } from "./report-error";

type Env = Parameters<typeof reportError>[0];

/**
 * Records what a browser reported, through the same reporter as the server's
 * own crashes. Run after the response.
 *
 * One at a time — never more than five — so a burst is a handful of small
 * writes rather than a fan-out.
 */
export async function reportClientErrors(
  env: Env,
  input: {
    kind: Extract<ErrorKind, "scanner" | "page">;
    path: string;
    reports: ClientErrorReport[];
  },
): Promise<void> {
  for (const report of input.reports) {
    await reportError(env, { kind: input.kind, error: asError(report), path: input.path });
  }
}

/**
 * The reporter reads message and stack off an Error. The stack a fresh Error
 * gets here would point at this file, so it is replaced with the browser's —
 * or emptied, which the reporter stores as no stack at all.
 */
function asError(report: ClientErrorReport): Error {
  const error = new Error(report.message);
  error.stack = report.stack ?? "";
  return error;
}

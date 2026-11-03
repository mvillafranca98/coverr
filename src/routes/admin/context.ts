import type { Context } from "hono";
import type { Limiter } from "../../lib/rate-limit";

export type Bindings = {
  DB: D1Database;
  PROOFS: R2Bucket;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  SESSION_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
  /** Who may sign in to /operador, and who is told about a fee to review. See `lib/operator.ts`. */
  OPERATOR_EMAILS?: string[];
  /** Rate limiters. Optional: `unsafe` bindings may be absent in local dev. */
  PURCHASE_LIMIT?: Limiter;
  EMAIL_LIMIT?: Limiter;
  EXTRACT_LIMIT?: Limiter;
};

/** Set by the session middleware; every handler below it can rely on it. */
export type Vars = { bandId: string };

export type AdminEnv = { Bindings: Bindings; Variables: Vars };

export type AdminContext = Context<AdminEnv>;

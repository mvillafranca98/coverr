import type { Limiter } from "../../lib/rate-limit";
/**
 * The worker's bindings, shared by every public router and by the root app in
 * `src/index.tsx`. `/admin` layers its own session variables on top of the same
 * bindings — see `routes/admin/context.ts`.
 */
export type Bindings = {
  DB: D1Database;
  PROOFS: R2Bucket;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  /** Hostnames that redirect to APP_ORIGIN. See `lib/host-redirect.ts`. */
  REDIRECT_HOSTS?: string[];
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  SESSION_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
  /** Where crash alerts go — the operator's address, never a band's. */
  ALERT_EMAIL?: string;
  /** Rate limiters. Optional: `unsafe` bindings may be absent in local dev. */
  PURCHASE_LIMIT?: Limiter;
  EMAIL_LIMIT?: Limiter;
};

/** Nothing public runs behind middleware, so there are no context variables. */
export type PublicEnv = { Bindings: Bindings };

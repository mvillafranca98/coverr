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
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  SESSION_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
};

/** Nothing public runs behind middleware, so there are no context variables. */
export type PublicEnv = { Bindings: Bindings };

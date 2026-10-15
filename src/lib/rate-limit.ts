import type { Context } from "hono";

/**
 * Cloudflare's rate limiter binding, narrowed to what we use.
 *
 * Optional everywhere it is passed: `unsafe` bindings are not always present
 * in local dev, and a missing one must not take the buyer flow down with it.
 */
export type Limiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

/**
 * The caller's IP, as Cloudflare sees it. Falls back to a single shared bucket
 * rather than to a per-request unique value — an unknown caller should be
 * rationed with the other unknown callers, not handed a fresh allowance.
 */
export function clientIp(c: Context): string {
  return c.req.header("CF-Connecting-IP") ?? "unknown";
}

/**
 * True when the caller may proceed.
 *
 * **Fails open.** A missing binding or a throwing limiter allows the request.
 * This guards a cost ceiling and an email flood, and the thing it guards sits
 * in front of someone who has already transferred money — refusing a real
 * buyer because the limiter is unavailable is a worse failure than the one
 * being prevented. The same reasoning as the QR issuing before verification.
 */
export async function withinLimit(
  limiter: Limiter | undefined,
  key: string,
): Promise<boolean> {
  if (!limiter) return true;
  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch (err) {
    console.error(`[rate-limit] limiter threw for key=${key}:`, err);
    return true;
  }
}

/** Shown whenever a limit is hit. Vague on purpose — it is not a diagnosis. */
export const TOO_MANY_REQUESTS =
  "Demasiados intentos seguidos. Esperá un minuto y volvé a probar.";

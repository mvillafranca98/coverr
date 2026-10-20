export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

export interface EmailTransport {
  send(msg: EmailMessage): Promise<SendResult>;
}

/**
 * Used until RESEND_API_KEY exists. Logs the message and stashes it so the
 * rendering can be checked locally — the alternative is either blocking the
 * build on account setup or silently dropping mail in dev, and silently
 * dropping ticket mail is the exact bug this feature exists to prevent.
 */
export class ConsoleTransport implements EmailTransport {
  constructor(private readonly sink?: R2Bucket) {}

  async send(msg: EmailMessage): Promise<SendResult> {
    const id = `dev_${Date.now().toString(36)}`;
    console.log(`[email:dev] to=${msg.to} subject="${msg.subject}" id=${id}`);

    // Magic links are the only way into the admin, so without this the whole
    // band flow is untestable until a sending domain verifies. Safe to print:
    // this transport is constructed only when RESEND_API_KEY is absent, which
    // never happens in production.
    for (const link of msg.text.match(/https?:\/\/\S+/g) ?? []) {
      console.log(`[email:dev]   ${link}`);
    }
    if (this.sink) {
      await this.sink.put(`outbox/${id}.html`, msg.html, {
        httpMetadata: { contentType: "text/html; charset=utf-8" },
        customMetadata: { to: msg.to, subject: msg.subject },
      });
    }
    return { ok: true, id };
  }
}

export class ResendTransport implements EmailTransport {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(msg: EmailMessage): Promise<SendResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error(`[email:resend] ${res.status} ${detail}`);
        return { ok: false, error: `resend ${res.status}: ${detail.slice(0, 300)}` };
      }
      const body = (await res.json()) as { id?: string };
      return { ok: true, id: body.id ?? "unknown" };
    } catch (err) {
      console.error("[email:resend] threw", err);
      return { ok: false, error: String(err) };
    }
  }
}

/**
 * Resend's shared sender. Works with no domain and no DNS, but only delivers to
 * the address the Resend account was verified with — fine for proving the
 * pipeline, useless for real buyers.
 */
const RESEND_TEST_FROM = "Coverr <onboarding@resend.dev>";

export function makeTransport(env: {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  PROOFS?: R2Bucket;
}): EmailTransport {
  if (!env.RESEND_API_KEY) return new ConsoleTransport(env.PROOFS);

  if (!env.EMAIL_FROM) {
    console.warn(
      "[email] EMAIL_FROM unset — using Resend's test sender. Delivers ONLY to the " +
        "address this Resend account was verified with. Set EMAIL_FROM once a " +
        "sending domain is verified.",
    );
    return new ResendTransport(env.RESEND_API_KEY, RESEND_TEST_FROM);
  }
  return new ResendTransport(env.RESEND_API_KEY, env.EMAIL_FROM);
}

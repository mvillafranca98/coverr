import type { FC } from "hono/jsx";
import { bankLabel, formatEventDate, formatEventTime, formatLpsShort } from "../../lib/core";
import { Wordmark } from "../brand";
import { InlineScript } from "../inline-script";
import { Layout } from "../layout";
import { LegalLinks } from "../legal/links";
import { buyFormScript } from "./form-script";
import {
  AttendeesStep,
  type BankAccount,
  BankStep,
  ConsentStep,
  PayerStep,
  ProofStep,
  QuantityStep,
} from "./steps";

export type BuyProps = {
  band: { name: string; slug: string };
  event: {
    name: string;
    slug: string;
    venue: string;
    startsAt: string;
    doorsAt: string | null;
    description: string | null;
    musicType: string | null;
    refundPolicy: string;
    refundPolicyText: string | null;
  };
  rule: { id: string; label: string; amount: number };
  accounts: BankAccount[];
  shortCode: string;
  origin: string;
  error?: string;
};

/**
 * The whole buyer flow: one page, one scroll, no account. This link is what
 * goes in the flyer and the venue's repost, which is what takes the venue out
 * of the conversation.
 *
 * The five numbered steps below are the order the buyer actually moves in —
 * decide how many, transfer, prove it, say who you are, say who is coming.
 */
export const BuyPage: FC<BuyProps> = ({
  band,
  event,
  rule,
  accounts,
  shortCode,
  origin,
  error,
}) => {
  // "Otro banco" falls back to the default account, so there is always one to show.
  const defaultAccount = accounts.find((a) => a.isDefault === 1) ?? accounts[0]!;
  const banksWithAccounts = new Set(accounts.map((a) => a.bank));

  const title = `${event.name} — ${band.name}`;
  const description = `${formatEventDate(event.startsAt)} · ${event.venue} · ${rule.label} ${formatLpsShort(rule.amount)}`;

  return (
    <Layout title={title} description={description} ogUrl={`${origin}/e/${event.slug}`}>
      {/* Drawn as the ticket the buyer is about to get, price in the band. */}
      <header class="flyer">
        <div class="flyer__band">
          <span>{band.name}</span>
          <span>
            {rule.label} · {formatLpsShort(rule.amount)}
          </span>
        </div>
        <div class="flyer__body">
          <h1>{event.name}</h1>
          <dl class="flyer__facts">
            <div class="wide">
              <dt>Fecha</dt>
              <dd>{formatEventDate(event.startsAt)}</dd>
            </div>
            <div class={event.doorsAt ? "" : "wide"}>
              <dt>Hora</dt>
              <dd>{formatEventTime(event.startsAt)}</dd>
            </div>
            {event.doorsAt ? (
              <div>
                <dt>Puertas</dt>
                <dd>{formatEventTime(event.doorsAt)}</dd>
              </div>
            ) : null}
            <div class="wide">
              <dt>Lugar</dt>
              <dd>{event.venue}</dd>
            </div>
            {event.musicType ? (
              <div class="wide">
                <dt>Música</dt>
                <dd>{event.musicType}</dd>
              </div>
            ) : null}
          </dl>
          {event.description ? <p class="blurb">{event.description}</p> : null}
        </div>
      </header>

      {error ? <div class="err">{error}</div> : null}

      <form
        id="buyForm"
        method="post"
        action={`/e/${event.slug}/comprar`}
        enctype="multipart/form-data"
      >
        <input type="hidden" name="short_code" value={shortCode} />
        <input type="hidden" name="price_rule_id" value={rule.id} />

        <QuantityStep rule={rule} />
        <BankStep
          defaultAccount={defaultAccount}
          banksWithAccounts={banksWithAccounts}
          shortCode={shortCode}
        />
        <ProofStep />
        <PayerStep />
        <AttendeesStep />
        <ConsentStep refundPolicy={event.refundPolicy} refundPolicyText={event.refundPolicyText} />
      </form>

      <footer>
        <Wordmark size={20} />
        <div>{band.name} · Coverr</div>
        <LegalLinks />
      </footer>

      <InlineScript
        code={buyFormScript({
          eventSlug: event.slug,
          defaultBank: defaultAccount.bank,
          shortCode,
          unitAmount: rule.amount,
          accountsByBank: Object.fromEntries(
            accounts.map((a) => [
              a.bank,
              { n: a.accountNumber, h: a.holderName, b: bankLabel(a.bank) },
            ]),
          ),
        })}
      />
    </Layout>
  );
};

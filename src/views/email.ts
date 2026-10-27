import { escapeHtml, formatEventDate, formatEventTime, formatLpsShort } from "../lib/core";

type TicketEmailInput = {
  band: { name: string; contactEmail: string };
  event: {
    name: string;
    venue: string;
    startsAt: string;
    thankYouNote: string | null;
  };
  order: {
    id: string;
    shortCode: string;
    quantity: number;
    expectedAmount: number;
    /** The policy this order was sold under, not the event's current one. */
    refundPolicy: string;
  };
  attendees: { name: string; note: string | null; qrToken: string }[];
  origin: string;
};

/**
 * Email HTML is not web HTML. Constraints driving every choice below:
 *  - Gmail strips <style> blocks and refuses SVG and data: URIs, so QR codes
 *    are hosted PNGs and every rule is an inline style attribute.
 *  - Outlook ignores flexbox and grid, so layout is tables.
 *  - Dark mode is not reliably controllable, so the ticket panel is explicitly
 *    light with dark text rather than inheriting anything.
 */
export function ticketEmailHtml(i: TicketEmailInput): string {
  const when = `${formatEventDate(i.event.startsAt)} · ${formatEventTime(i.event.startsAt)}`;

  const tickets = i.attendees
    .map(
      (a, n) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:0 0 16px">
        <tr><td style="background:#ffffff;border:1px solid #ddd8cf;border-radius:12px;padding:20px">
          <div style="font:600 17px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#191713">
            ${escapeHtml(a.name)}
          </div>
          <div style="font:400 13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#6f6a60;padding-top:3px">
            Boleto ${n + 1} de ${i.attendees.length}
          </div>
          ${
            a.note
              ? `<div style="font:italic 400 13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#a8701f;padding-top:5px">${escapeHtml(a.note)}</div>`
              : ""
          }
          <div style="padding:16px 0 6px;text-align:center">
            <img src="${i.origin}/t/${a.qrToken}.png"
                 width="220" height="220" alt="Código QR de ${escapeHtml(a.name)}"
                 style="display:block;margin:0 auto;width:220px;height:220px;border:0" />
          </div>
          <div style="font:600 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;color:#9a948a;text-align:center;text-transform:uppercase">
            ${escapeHtml(i.order.shortCode)}
          </div>
          <div style="text-align:center;padding-top:12px">
            <a href="${i.origin}/boletos/${i.order.id}"
               style="display:inline-block;padding:9px 18px;border-radius:8px;background:#f5efe2;border:1px solid #e0d3b4;color:#8a5a12;font:600 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;text-decoration:none">
              ¿No ves el código? Abrilo aquí
            </a>
          </div>
        </td></tr>
      </table>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tus boletos</title></head>
<body style="margin:0;padding:0;background:#f3f1ea">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Tus ${i.order.quantity === 1 ? "boleto" : `${i.order.quantity} boletos`} para ${escapeHtml(i.event.name)} — ${when}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1ea;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;text-align:left">

      <tr><td style="padding:0 0 20px">
        <div style="font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:#b0651a">
          ${escapeHtml(i.band.name)}
        </div>
        <h1 style="font:700 25px/1.15 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#191713;margin:10px 0 8px;letter-spacing:-.02em">
          ${escapeHtml(i.event.name)}
        </h1>
        <div style="font:400 15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#57534b">
          ${when}<br>${escapeHtml(i.event.venue)}
        </div>
      </td></tr>

      <tr><td style="padding:0 0 18px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:#fbf6e8;border:1px solid #e4d5ab;border-radius:9px;padding:13px 15px;font:400 14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#6d5518">
            Guardá este correo. En la entrada te escanean el código desde el teléfono — no necesitás imprimir nada.
          </td></tr>
        </table>
      </td></tr>

      <tr><td>${tickets}</td></tr>

      <tr><td style="padding:6px 0 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #ddd8cf;border-radius:12px">
          <tr><td style="padding:16px 20px;font:400 14px/1.9 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#57534b">
            <b style="color:#191713">Boletos:</b> ${i.order.quantity}<br>
            <b style="color:#191713">Total:</b> ${formatLpsShort(i.order.expectedAmount)}<br>
            <b style="color:#191713">Código:</b> ${escapeHtml(i.order.shortCode)}
          </td></tr>
        </table>
      </td></tr>

      ${
        i.event.thankYouNote
          ? `<tr><td style="padding:18px 4px 0;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#57534b">
               ${escapeHtml(i.event.thankYouNote)}
             </td></tr>`
          : ""
      }

      <tr><td style="padding:22px 4px 0;border-top:1px solid #ddd8cf;margin-top:20px;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#8a857b">
        ¿Perdiste tus boletos? Recuperalos en
        <a href="${i.origin}/recuperar" style="color:#b0651a">${i.origin.replace(/^https?:\/\//, "")}/recuperar</a><br>
        ${i.order.refundPolicy === "none" ? "" : `¿Necesitás un reembolso? <a href="${i.origin}/reembolso/${i.order.id}" style="color:#b0651a">Solicitalo aquí</a><br>`}
        ¿Algún problema? Escribinos a
        <a href="mailto:${escapeHtml(i.band.contactEmail)}" style="color:#b0651a">${escapeHtml(i.band.contactEmail)}</a>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Plain-text alternative. Improves deliverability and is what a screen reader gets. */
export function ticketEmailText(i: TicketEmailInput): string {
  const when = `${formatEventDate(i.event.startsAt)} · ${formatEventTime(i.event.startsAt)}`;
  const lines = [
    `${i.band.name} — ${i.event.name}`,
    `${when}`,
    `${i.event.venue}`,
    "",
    `Tus ${i.order.quantity === 1 ? "boleto" : `${i.order.quantity} boletos`}:`,
    "",
  ];
  i.attendees.forEach((a, n) => {
    lines.push(`  ${n + 1}. ${a.name}${a.note ? ` (${a.note})` : ""}`);
    lines.push(`     ${i.origin}/t/${a.qrToken}.png`);
  });
  lines.push(
    "",
    `Total: ${formatLpsShort(i.order.expectedAmount)}`,
    `Código: ${i.order.shortCode}`,
    "",
    `Ver tus boletos: ${i.origin}/boletos/${i.order.id}`,
    "",
    "En la entrada te escanean el código desde el teléfono.",
    "",
    `¿Perdiste tus boletos? ${i.origin}/recuperar`,
    ...(i.order.refundPolicy === "none"
      ? []
      : [`¿Necesitás un reembolso? ${i.origin}/reembolso/${i.order.id}`]),
    `¿Algún problema? ${i.band.contactEmail}`,
  );
  return lines.join("\n");
}

export function ticketEmailSubject(i: TicketEmailInput): string {
  return `Tus ${i.order.quantity === 1 ? "boleto" : `${i.order.quantity} boletos`} — ${i.event.name}`;
}

// ------------------------------------------------------------ admin sign-in

type LoginEmailInput = { bandName: string; url: string; minutes: number };

/**
 * The magic link that signs a band admin in. Kept to one button and one
 * sentence: anything longer reads like a phishing attempt, which is exactly
 * what an unexpected "click here to sign in" mail looks like.
 */
export function loginEmailHtml(i: LoginEmailInput): string {
  const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f3f1ea;padding:28px 14px;font-family:${sans}">
<table role="presentation" width="100%"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:440px;text-align:left">
<tr><td style="font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:#b0651a;padding-bottom:10px">Coverr</td></tr>
<tr><td style="font:700 22px/1.2 inherit;color:#191713;padding-bottom:10px">Entrar al panel de ${escapeHtml(i.bandName)}</td></tr>
<tr><td style="font:400 15px/1.5 inherit;color:#57534b;padding-bottom:20px">Tocá el botón para entrar. El enlace vence en ${i.minutes} minutos.</td></tr>
<tr><td><a href="${i.url}" style="display:inline-block;padding:13px 22px;border-radius:9px;background:#191713;color:#fff;font:600 15px/1 inherit;text-decoration:none">Entrar</a></td></tr>
<tr><td style="font:400 12px/1.6 inherit;color:#8a857b;padding-top:22px">Si no pediste esto, ignoralo — nadie puede entrar sin este correo.</td></tr>
</table></td></tr></table></body></html>`;
}

export function loginEmailText(i: LoginEmailInput): string {
  return `Entrar al panel de ${i.bandName}:\n\n${i.url}\n\nEl enlace vence en ${i.minutes} minutos. Si no pediste esto, ignoralo.`;
}

export const LOGIN_EMAIL_SUBJECT = "Entrar a Coverr";

// ------------------------------------------------------------- band sign-up

type SignupEmailInput = { bandName: string; url: string };

/**
 * The link that puts a brand-new band into its panel. It repeats most of the
 * sign-in mail above; the two are kept apart because sign-up names the band in
 * the subject line, which the sign-in mail does not.
 */
export function signupEmailHtml(i: SignupEmailInput): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f3f1ea;padding:28px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:440px;text-align:left">
<tr><td style="font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:#b0651a;padding-bottom:10px">Coverr</td></tr>
<tr><td style="font:700 22px/1.2 inherit;color:#191713;padding-bottom:10px">Entrar al panel de ${escapeHtml(i.bandName)}</td></tr>
<tr><td style="font:400 15px/1.5 inherit;color:#57534b;padding-bottom:20px">Tocá el botón para entrar. El enlace vence en 15 minutos.</td></tr>
<tr><td><a href="${i.url}" style="display:inline-block;padding:13px 22px;border-radius:9px;background:#191713;color:#fff;font:600 15px/1 inherit;text-decoration:none">Entrar</a></td></tr>
<tr><td style="font:400 12px/1.6 inherit;color:#8a857b;padding-top:22px">Si no pediste esto, ignoralo — nadie puede entrar sin este correo.</td></tr>
</table></td></tr></table></body></html>`;
}

export function signupEmailText(i: SignupEmailInput): string {
  return `Entrar al panel de ${i.bandName}:\n\n${i.url}\n\nEl enlace vence en 15 minutos.`;
}

export function signupEmailSubject(i: SignupEmailInput): string {
  return `Entrar a Coverr — ${i.bandName}`;
}

// ------------------------------------------------------------ refund request

type FlagAlertInput = {
  event: { name: string; slug: string };
  order: {
    id: string;
    shortCode: string;
    payerName: string;
    payerEmail: string;
    quantity: number;
    expectedAmount: number;
  };
  /** Only the critical ones. A warning does not earn an interruption. */
  flags: { code: string; detail: string }[];
  origin: string;
};

/**
 * Tells the band a purchase failed a check that cannot be explained away.
 *
 * Critical means the proof was recycled or the money went somewhere else —
 * the two cases where somebody may be getting in without paying. The buyer
 * already has their QR codes and keeps them; this is so the band finds out
 * tonight rather than while reconciling next week.
 *
 * Each flag's own detail is quoted verbatim, because those strings are written
 * to be said out loud to a buyer standing at a door.
 */
export function flagAlertEmailHtml(i: FlagAlertInput): string {
  const rows = i.flags
    .map(
      (f) =>
        `<tr><td style="background:#fff;border:1px solid #ddd8cf;border-radius:10px;padding:14px 16px;font:400 15px/1.6 inherit;color:#57534b;margin-bottom:8px">
<b style="color:#8a1c0f;font:600 12px/1 inherit;letter-spacing:.08em">${escapeHtml(f.code)}</b><br>
${escapeHtml(f.detail)}
</td></tr><tr><td style="height:8px"></td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="es"><body style="margin:0;background:#f3f1ea;padding:26px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:460px;text-align:left">
<tr><td style="font:700 20px/1.25 inherit;color:#191713;padding-bottom:12px">Una compra necesita revisión</td></tr>
<tr><td style="font:400 15px/1.7 inherit;color:#57534b;padding-bottom:16px">
<b style="color:#191713">Orden:</b> ${escapeHtml(i.order.shortCode)}<br>
<b style="color:#191713">Evento:</b> ${escapeHtml(i.event.name)}<br>
<b style="color:#191713">Compró:</b> ${escapeHtml(i.order.payerName)} (${escapeHtml(i.order.payerEmail)})<br>
<b style="color:#191713">Boletos:</b> ${i.order.quantity} · ${formatLpsShort(i.order.expectedAmount)}
</td></tr>
${rows}
<tr><td style="padding-top:10px"><a href="${i.origin}/admin/e/${i.event.slug}/orden/${i.order.id}" style="display:inline-block;padding:12px 20px;border-radius:9px;background:#191713;color:#fff;font:600 15px/1 inherit;text-decoration:none">Ver la orden</a></td></tr>
<tr><td style="font:400 12px/1.6 inherit;color:#8a857b;padding-top:20px">Los códigos QR ya se entregaron y siguen sirviendo — esto es para que lo revisés, no para frenar a nadie en la puerta. Respondé este correo para escribirle a quien compró.</td></tr>
</table></td></tr></table></body></html>`;
}

export function flagAlertEmailText(i: FlagAlertInput): string {
  const lines = i.flags.map((f) => `- ${f.code}: ${f.detail}`).join("\n");
  return `Una compra necesita revisión — ${i.order.shortCode}

Evento: ${i.event.name}
Compró: ${i.order.payerName} (${i.order.payerEmail})
Boletos: ${i.order.quantity} · ${formatLpsShort(i.order.expectedAmount)}

${lines}

Ver la orden: ${i.origin}/admin/e/${i.event.slug}/orden/${i.order.id}

Los códigos QR ya se entregaron y siguen sirviendo.`;
}

export function flagAlertEmailSubject(i: FlagAlertInput): string {
  return `Revisar ${i.order.shortCode} — ${i.event.name}`;
}

type RefundAlertInput = {
  event: { name: string; slug: string };
  order: {
    id: string;
    shortCode: string;
    payerName: string;
    payerEmail: string;
    quantity: number;
    expectedAmount: number;
  };
  reason: string;
  origin: string;
};

/**
 * Tells the band someone wants their money back. The band decides and moves the
 * money themselves, so this only has to reach them — hence the reply-to the
 * caller sets to the buyer and the direct link to the order.
 */
export function refundAlertEmailHtml(i: RefundAlertInput): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f3f1ea;padding:26px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:460px;text-align:left">
<tr><td style="font:700 20px/1.25 inherit;color:#191713;padding-bottom:12px">Solicitud de reembolso</td></tr>
<tr><td style="font:400 15px/1.7 inherit;color:#57534b;padding-bottom:16px">
<b style="color:#191713">Orden:</b> ${escapeHtml(i.order.shortCode)}<br>
<b style="color:#191713">Evento:</b> ${escapeHtml(i.event.name)}<br>
<b style="color:#191713">Compró:</b> ${escapeHtml(i.order.payerName)} (${escapeHtml(i.order.payerEmail)})<br>
<b style="color:#191713">Boletos:</b> ${i.order.quantity} · ${formatLpsShort(i.order.expectedAmount)}
</td></tr>
<tr><td style="background:#fff;border:1px solid #ddd8cf;border-radius:10px;padding:14px 16px;font:400 15px/1.6 inherit;color:#57534b">
${escapeHtml(i.reason)}
</td></tr>
<tr><td style="padding-top:18px"><a href="${i.origin}/admin/e/${i.event.slug}/orden/${i.order.id}" style="display:inline-block;padding:12px 20px;border-radius:9px;background:#191713;color:#fff;font:600 15px/1 inherit;text-decoration:none">Ver la orden</a></td></tr>
<tr><td style="font:400 12px/1.6 inherit;color:#8a857b;padding-top:20px">Respondé este correo para contactar directamente a quien compró.</td></tr>
</table></td></tr></table></body></html>`;
}

export function refundAlertEmailText(i: RefundAlertInput): string {
  return `Solicitud de reembolso — ${i.order.shortCode}\n\nEvento: ${i.event.name}\nCompró: ${i.order.payerName} (${i.order.payerEmail})\nBoletos: ${i.order.quantity} · ${formatLpsShort(i.order.expectedAmount)}\n\n${i.reason}\n\nVer la orden: ${i.origin}/admin/e/${i.event.slug}/orden/${i.order.id}`;
}

export function refundAlertEmailSubject(i: RefundAlertInput): string {
  return `Solicitud de reembolso — ${i.order.shortCode}`;
}

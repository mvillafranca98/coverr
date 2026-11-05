import { escapeHtml, formatEventDate, formatEventTime, formatLpsShort } from "../lib/core";
import { flagLabel } from "../lib/verify";
import { CONTACT_EMAIL } from "./legal/constants";

/*
 * Every mail is drawn on the buyer surface (src/styles/buyer.css): cream
 * page, black ink, 3px outlines, hard shadows, sticker colours with black ink
 * on them. Written out as inline styles because that is all a mail client
 * keeps. No webfont: headings are the system sans at its heaviest weight.
 * Every pair is measured in DESIGN.md.
 */
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const CREAM = "#fff4de";
const INK = "#111111";
const MUTED = "#3b372f";
const DIM = "#57524a";
const LIME = "#b8f35a";
const YELLOW = "#ffd43b";
const PINK = "#ff6ec7";
const CRIT = "#b0102a";
const CRIT_BG = "#ffd6df";

/** A white card. Outlook drops the shadow and the corners and keeps the outline. */
const CARD = `background:#ffffff;border:3px solid ${INK};border-radius:18px;box-shadow:5px 5px 0 ${INK}`;
/** A mail's one action, styled as the buy page's pink submit button. */
const BUTTON = `display:inline-block;padding:14px 24px;border:3px solid ${INK};border-radius:12px;background:${PINK};box-shadow:4px 4px 0 ${INK};color:${INK};font:900 16px/1 ${SANS};text-decoration:none`;
const HEADING = `font:900 24px/1.15 ${SANS};letter-spacing:-.02em;color:${INK}`;
const BODY_TEXT = `font:400 15px/1.7 ${SANS};color:${MUTED}`;
const FINE_PRINT = `font:400 12px/1.6 ${SANS};color:${DIM}`;
/**
 * A pill in a sticker colour: the band's name on a ticket mail, "Coverr" on a
 * sign-in. `html` goes in as-is, so escape anything somebody typed.
 */
function sticker(html: string, background: string): string {
  return `<span style="display:inline-block;padding:4px 10px;border:2px solid ${INK};border-radius:999px;background:${background};font:700 11px/1.2 ${MONO};letter-spacing:.12em;text-transform:uppercase;color:${INK}">${html}</span>`;
}

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
 *  - Dark mode is not reliably controllable, so every surface sets its own
 *    background and ink rather than inheriting anything.
 *
 * Each ticket is the stub from the ticket page: lime, a black head band, a
 * dashed perforation, and the QR below it on pure white, because a dark code
 * on white is what scans.
 */
export function ticketEmailHtml(i: TicketEmailInput): string {
  const when = `${formatEventDate(i.event.startsAt)} · ${formatEventTime(i.event.startsAt)}`;

  const tickets = i.attendees
    .map(
      (a, n) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:0 0 28px;background:${LIME};border:3px solid ${INK};border-radius:18px;box-shadow:9px 9px 0 ${INK}">
        <tr><td style="background:${INK};border-radius:15px 15px 0 0;padding:11px 18px;font:700 11px/1.2 ${MONO};letter-spacing:.12em;text-transform:uppercase;color:${LIME}">
          Boleto ${n + 1} de ${i.attendees.length}
        </td></tr>
        <tr><td style="padding:18px 18px 20px">
          <div style="font:900 24px/1.1 ${SANS};letter-spacing:-.03em;color:${INK}">
            ${escapeHtml(a.name)}
          </div>
          ${
            a.note
              ? `<div style="font:italic 500 14px/1.4 ${SANS};color:${INK};padding-top:6px">${escapeHtml(a.note)}</div>`
              : ""
          }
        </td></tr>
        <tr><td style="background:#ffffff;border-top:3px dashed ${INK};border-radius:0 0 15px 15px;padding:22px 20px 22px;text-align:center">
          <img src="${i.origin}/t/${a.qrToken}.png"
               width="220" height="220" alt="Código QR de ${escapeHtml(a.name)}"
               style="display:block;margin:0 auto;width:220px;height:220px;border:0" />
          <div style="display:inline-block;margin-top:14px;padding:6px 13px;border:2px solid ${INK};border-radius:8px;background:${YELLOW};font:700 15px/1.2 ${MONO};letter-spacing:.18em;text-transform:uppercase;color:${INK}">
            ${escapeHtml(i.order.shortCode)}
          </div>
          <div style="padding-top:18px">
            <a href="${i.origin}/boletos/${i.order.id}"
               style="display:inline-block;padding:11px 18px;border:3px solid ${INK};border-radius:12px;background:#ffffff;box-shadow:3px 3px 0 ${INK};color:${INK};font:800 14px/1 ${SANS};text-decoration:none">
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
<body style="margin:0;padding:0;background:${CREAM}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Tus ${i.order.quantity === 1 ? "boleto" : `${i.order.quantity} boletos`} para ${escapeHtml(i.event.name)} — ${when}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;text-align:left">

      <tr><td style="padding:0 0 22px">
        ${sticker(escapeHtml(i.band.name), LIME)}
        <h1 style="font:900 28px/1.1 ${SANS};color:${INK};margin:14px 0 8px;letter-spacing:-.03em">
          ${escapeHtml(i.event.name)}
        </h1>
        <div style="font:400 15px/1.5 ${SANS};color:${MUTED}">
          ${when}<br>${escapeHtml(i.event.venue)}
        </div>
      </td></tr>

      <tr><td style="padding:0 0 26px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:${YELLOW};border:3px solid ${INK};border-radius:12px;padding:14px 16px;font:500 14px/1.5 ${SANS};color:${INK}">
            Guardá este correo. En la entrada te escanean el código desde el teléfono — no necesitás imprimir nada.
          </td></tr>
        </table>
      </td></tr>

      <tr><td>${tickets}</td></tr>

      <tr><td style="padding:2px 0 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${CARD}">
          <tr><td style="padding:16px 20px;font:400 14px/1.9 ${SANS};color:${MUTED}">
            <b style="color:${INK}">Boletos:</b> ${i.order.quantity}<br>
            <b style="color:${INK}">Total:</b> ${formatLpsShort(i.order.expectedAmount)}<br>
            <b style="color:${INK}">Código:</b> ${escapeHtml(i.order.shortCode)}
          </td></tr>
        </table>
      </td></tr>

      ${
        i.event.thankYouNote
          ? `<tr><td style="padding:22px 4px 0;font:400 14px/1.6 ${SANS};color:${MUTED}">
               ${escapeHtml(i.event.thankYouNote)}
             </td></tr>`
          : ""
      }

      <tr><td style="padding:24px 0 0">
        <div style="border-top:3px solid ${INK};padding:18px 4px 0;${FINE_PRINT}">
          ¿Perdiste tus boletos? Recuperalos en
          <a href="${i.origin}/recuperar" style="color:${INK}">${i.origin.replace(/^https?:\/\//, "")}/recuperar</a><br>
          ${i.order.refundPolicy === "none" ? "" : `¿Necesitás un reembolso? <a href="${i.origin}/reembolso/${i.order.id}" style="color:${INK}">Solicitalo aquí</a><br>`}
          ¿Algún problema? Escribinos a
          <a href="mailto:${escapeHtml(i.band.contactEmail)}" style="color:${INK}">${escapeHtml(i.band.contactEmail)}</a>
        </div>
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
  return `${i.order.quantity === 1 ? "Tu boleto" : `Tus ${i.order.quantity} boletos`} — ${i.event.name}`;
}

// ------------------------------------------------------------ admin sign-in

type LoginEmailInput = { bandName: string; url: string; minutes: number };

/**
 * The magic link that signs a band admin in. Kept to one button and one
 * sentence: anything longer reads like a phishing attempt, which is exactly
 * what an unexpected "click here to sign in" mail looks like.
 */
export function loginEmailHtml(i: LoginEmailInput): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:${CREAM};padding:28px 14px;font-family:${SANS}">
<table role="presentation" width="100%"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:440px;text-align:left">
<tr><td style="padding-bottom:16px">${sticker("Coverr", YELLOW)}</td></tr>
<tr><td style="${HEADING};padding-bottom:10px">Entrar al panel de ${escapeHtml(i.bandName)}</td></tr>
<tr><td style="font:400 15px/1.5 ${SANS};color:${MUTED};padding-bottom:22px">Tocá el botón para entrar. El enlace sirve una sola vez y vence en ${i.minutes} minutos.</td></tr>
<tr><td><a href="${i.url}" style="${BUTTON}">Entrar</a></td></tr>
<tr><td style="${FINE_PRINT};padding-top:26px">Si no pediste esto, ignoralo — nadie puede entrar sin este correo.</td></tr>
</table></td></tr></table></body></html>`;
}

export function loginEmailText(i: LoginEmailInput): string {
  return `Entrar al panel de ${i.bandName}:\n\n${i.url}\n\nEl enlace sirve una sola vez y vence en ${i.minutes} minutos. Si no pediste esto, ignoralo.`;
}

export const LOGIN_EMAIL_SUBJECT = "Entrar a Coverr";

// ------------------------------------------------------------- band sign-up

type CreateBandEmailInput = { bandName: string; url: string; minutes: number };

/**
 * The link that creates a band, sent from /registro. The band does not exist
 * until it is opened, so the mail asks for exactly that — create it — rather
 * than reading like a sign-in to something already there.
 */
export function createBandEmailHtml(i: CreateBandEmailInput): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:${CREAM};padding:28px 14px;font-family:${SANS}">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:440px;text-align:left">
<tr><td style="padding-bottom:16px">${sticker("Coverr", YELLOW)}</td></tr>
<tr><td style="${HEADING};padding-bottom:10px">Crear ${escapeHtml(i.bandName)}</td></tr>
<tr><td style="font:400 15px/1.5 ${SANS};color:${MUTED};padding-bottom:22px">Tocá el botón para crear la banda y entrar a su panel. El enlace sirve una sola vez y vence en ${i.minutes} minutos.</td></tr>
<tr><td><a href="${i.url}" style="${BUTTON}">Crear la banda</a></td></tr>
<tr><td style="${FINE_PRINT};padding-top:26px">Si no pediste esto, ignoralo — no se crea nada sin este correo.</td></tr>
</table></td></tr></table></body></html>`;
}

export function createBandEmailText(i: CreateBandEmailInput): string {
  return `Crear ${i.bandName} en Coverr:

${i.url}

El enlace sirve una sola vez y vence en ${i.minutes} minutos. Si no pediste esto, ignoralo.`;
}

export function createBandEmailSubject(i: CreateBandEmailInput): string {
  return `Crear ${i.bandName} en Coverr`;
}

// ------------------------------------------------------- band email change

type EmailChangeEmailInput = { bandName: string; url: string; minutes: number };

/**
 * Sent to the address a band wants to move to. The band's email is who signs
 * in and who answers for it, so it only changes once that address says yes.
 */
export function emailChangeEmailHtml(i: EmailChangeEmailInput): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:${CREAM};padding:28px 14px;font-family:${SANS}">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:440px;text-align:left">
<tr><td style="padding-bottom:16px">${sticker("Coverr", YELLOW)}</td></tr>
<tr><td style="${HEADING};padding-bottom:10px">Confirmá el correo de ${escapeHtml(i.bandName)}</td></tr>
<tr><td style="font:400 15px/1.5 ${SANS};color:${MUTED};padding-bottom:22px">Pidieron que ${escapeHtml(i.bandName)} entre a Coverr con este correo. Tocá el botón para confirmarlo. El enlace sirve una sola vez y vence en ${i.minutes} minutos.</td></tr>
<tr><td><a href="${i.url}" style="${BUTTON}">Confirmar el correo</a></td></tr>
<tr><td style="${FINE_PRINT};padding-top:26px">Si no pediste esto, ignoralo — el correo de la banda no cambia sin este enlace.</td></tr>
</table></td></tr></table></body></html>`;
}

export function emailChangeEmailText(i: EmailChangeEmailInput): string {
  return `Pidieron que ${i.bandName} entre a Coverr con este correo. Para confirmarlo:

${i.url}

El enlace sirve una sola vez y vence en ${i.minutes} minutos. Si no pediste esto, ignoralo: el correo de la banda no cambia sin este enlace.`;
}

export function emailChangeEmailSubject(i: EmailChangeEmailInput): string {
  return `Confirmá el correo de ${i.bandName} en Coverr`;
}

// ----------------------------------------------------------- suspended band

type SuspendedEmailInput = { bandName: string };

/**
 * Sent in place of a sign-in link when a banned band asks for one, so the band
 * learns why it cannot get in instead of waiting for a link that never comes.
 * It only ever goes to that band's own address, and the page that asked
 * answers exactly as it always does.
 */
export function suspendedEmailHtml(i: SuspendedEmailInput): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:${CREAM};padding:28px 14px;font-family:${SANS}">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:440px;text-align:left">
<tr><td style="padding-bottom:16px">${sticker("Coverr", YELLOW)}</td></tr>
<tr><td style="${HEADING};padding-bottom:10px">La cuenta de ${escapeHtml(i.bandName)} está suspendida</td></tr>
<tr><td style="font:400 15px/1.5 ${SANS};color:${MUTED};padding-bottom:14px">Por ahora no podés entrar al panel ni crear eventos. Los boletos que ya vendiste siguen funcionando: tus compradores pueden verlos y la entrada los sigue escaneando.</td></tr>
<tr><td style="font:400 15px/1.5 ${SANS};color:${MUTED}">Si creés que es un error, escribinos a <a href="mailto:${CONTACT_EMAIL}" style="color:${INK}">${CONTACT_EMAIL}</a>.</td></tr>
</table></td></tr></table></body></html>`;
}

export function suspendedEmailText(i: SuspendedEmailInput): string {
  return `La cuenta de ${i.bandName} está suspendida.\n\nPor ahora no podés entrar al panel ni crear eventos. Los boletos que ya vendiste siguen funcionando.\n\nSi creés que es un error, escribinos a ${CONTACT_EMAIL}.`;
}

export const SUSPENDED_EMAIL_SUBJECT = "Tu cuenta de Coverr está suspendida";

// ------------------------------------------------------- fee needs a review

type FeeAlertInput = {
  band: { name: string; contactEmail: string };
  event: { name: string };
  amount: number;
  flags: { code: string; detail: string }[];
  /** The payment's page in the operator panel. */
  url: string;
};

/**
 * To every operator, when a band's fee screenshot does not pass the checks.
 * The report is already open; this asks a person to look and, if need be,
 * write to the band — a reply goes straight to the band's contact address.
 */
export function feeAlertEmailHtml(i: FeeAlertInput): string {
  const rows = i.flags
    .map(
      (f) =>
        `<tr><td style="background:${CRIT_BG};border:3px solid ${INK};border-radius:12px;padding:14px 16px;font:400 15px/1.6 ${SANS};color:${INK}">
<b style="color:${CRIT};font:700 12px/1.4 ${MONO};letter-spacing:.08em">${escapeHtml(flagLabel(f.code))}</b><br>
${escapeHtml(f.detail)}
</td></tr><tr><td style="height:10px"></td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="es"><body style="margin:0;background:${CREAM};padding:26px 14px;font-family:${SANS}">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:460px;text-align:left">
<tr><td style="${HEADING};padding-bottom:12px">Un pago de reporte necesita revisión</td></tr>
<tr><td style="${BODY_TEXT};padding-bottom:16px">
<b style="color:${INK}">Banda:</b> ${escapeHtml(i.band.name)} (${escapeHtml(i.band.contactEmail)})<br>
<b style="color:${INK}">Evento:</b> ${escapeHtml(i.event.name)}<br>
<b style="color:${INK}">Monto:</b> ${formatLpsShort(i.amount)}
</td></tr>
${rows}
<tr><td style="padding-top:12px"><a href="${i.url}" style="${BUTTON}">Ver el pago</a></td></tr>
<tr><td style="${FINE_PRINT};padding-top:26px">El reporte ya está abierto para la banda. Respondé este correo para escribirle.</td></tr>
</table></td></tr></table></body></html>`;
}

export function feeAlertEmailText(i: FeeAlertInput): string {
  const lines = i.flags.map((f) => `- ${flagLabel(f.code)}: ${f.detail}`).join("\n");
  return `Un pago de reporte necesita revisión\n\nBanda: ${i.band.name} (${i.band.contactEmail})\nEvento: ${i.event.name}\nMonto: ${formatLpsShort(i.amount)}\n\n${lines}\n\nVer el pago: ${i.url}`;
}

export function feeAlertEmailSubject(i: FeeAlertInput): string {
  return `Pago por revisar — ${i.band.name}`;
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
        `<tr><td style="background:${CRIT_BG};border:3px solid ${INK};border-radius:12px;padding:14px 16px;font:400 15px/1.6 ${SANS};color:${INK}">
<b style="color:${CRIT};font:700 12px/1.4 ${MONO};letter-spacing:.08em">${escapeHtml(flagLabel(f.code))}</b><br>
${escapeHtml(f.detail)}
</td></tr><tr><td style="height:10px"></td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="es"><body style="margin:0;background:${CREAM};padding:26px 14px;font-family:${SANS}">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:460px;text-align:left">
<tr><td style="${HEADING};padding-bottom:12px">Una compra necesita revisión</td></tr>
<tr><td style="${BODY_TEXT};padding-bottom:16px">
<b style="color:${INK}">Orden:</b> ${escapeHtml(i.order.shortCode)}<br>
<b style="color:${INK}">Evento:</b> ${escapeHtml(i.event.name)}<br>
<b style="color:${INK}">Compró:</b> ${escapeHtml(i.order.payerName)} (${escapeHtml(i.order.payerEmail)})<br>
<b style="color:${INK}">Boletos:</b> ${i.order.quantity} · ${formatLpsShort(i.order.expectedAmount)}
</td></tr>
${rows}
<tr><td style="padding-top:12px"><a href="${i.origin}/admin/e/${i.event.slug}/orden/${i.order.id}" style="${BUTTON}">Ver la orden</a></td></tr>
<tr><td style="${FINE_PRINT};padding-top:26px">Los códigos QR ya se entregaron y siguen sirviendo — esto es para que lo revisés, no para frenar a nadie en la puerta. Respondé este correo para escribirle a quien compró.</td></tr>
</table></td></tr></table></body></html>`;
}

export function flagAlertEmailText(i: FlagAlertInput): string {
  const lines = i.flags.map((f) => `- ${flagLabel(f.code)}: ${f.detail}`).join("\n");
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
  return `<!doctype html><html lang="es"><body style="margin:0;background:${CREAM};padding:26px 14px;font-family:${SANS}">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:460px;text-align:left">
<tr><td style="${HEADING};padding-bottom:12px">Solicitud de reembolso</td></tr>
<tr><td style="${BODY_TEXT};padding-bottom:16px">
<b style="color:${INK}">Orden:</b> ${escapeHtml(i.order.shortCode)}<br>
<b style="color:${INK}">Evento:</b> ${escapeHtml(i.event.name)}<br>
<b style="color:${INK}">Compró:</b> ${escapeHtml(i.order.payerName)} (${escapeHtml(i.order.payerEmail)})<br>
<b style="color:${INK}">Boletos:</b> ${i.order.quantity} · ${formatLpsShort(i.order.expectedAmount)}
</td></tr>
<tr><td style="${CARD};padding:14px 16px;font:400 15px/1.6 ${SANS};color:${INK}">
${escapeHtml(i.reason)}
</td></tr>
<tr><td style="padding-top:22px"><a href="${i.origin}/admin/e/${i.event.slug}/orden/${i.order.id}" style="${BUTTON}">Ver la orden</a></td></tr>
<tr><td style="${FINE_PRINT};padding-top:26px">Respondé este correo para contactar directamente a quien compró.</td></tr>
</table></td></tr></table></body></html>`;
}

export function refundAlertEmailText(i: RefundAlertInput): string {
  return `Solicitud de reembolso — ${i.order.shortCode}\n\nEvento: ${i.event.name}\nCompró: ${i.order.payerName} (${i.order.payerEmail})\nBoletos: ${i.order.quantity} · ${formatLpsShort(i.order.expectedAmount)}\n\n${i.reason}\n\nVer la orden: ${i.origin}/admin/e/${i.event.slug}/orden/${i.order.id}`;
}

export function refundAlertEmailSubject(i: RefundAlertInput): string {
  return `Solicitud de reembolso — ${i.order.shortCode}`;
}

type ErrorAlertInput = {
  at: string;
  /** request | scheduled */
  kind: string;
  /** The matched route pattern, never a real path. See the error_log schema. */
  path: string | null;
  method: string | null;
  message: string;
  stack: string | null;
  /** How long the same error can stay quiet after this one, in minutes. */
  quietMinutes: number;
};

/**
 * Tells the operator the worker crashed. The only mail in here not addressed
 * to a band or a buyer, so it is the only one in English and the only one that
 * prints a stack trace: nobody but whoever maintains this receives it.
 *
 * It carries no band, order or buyer data on purpose — a crash in the buy flow
 * would otherwise mail out a name, an email and a bank screenshot.
 */
export function errorAlertEmailHtml(i: ErrorAlertInput): string {
  const where = [i.method, i.path].filter(Boolean).join(" ") || i.kind;

  return `<!doctype html><html lang="en"><body style="margin:0;background:${CREAM};padding:26px 14px;font-family:${SANS}">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:560px;text-align:left">
<tr><td style="${HEADING};padding-bottom:12px">Coverr crashed</td></tr>
<tr><td style="${BODY_TEXT};padding-bottom:16px">
<b style="color:${INK}">When:</b> ${escapeHtml(i.at)}<br>
<b style="color:${INK}">Where:</b> ${escapeHtml(where)}<br>
<b style="color:${INK}">Kind:</b> ${escapeHtml(i.kind)}
</td></tr>
<tr><td style="${CARD};padding:14px 16px;font:400 15px/1.6 ${SANS};color:${INK}">
${escapeHtml(i.message)}
</td></tr>
${
  i.stack
    ? `<tr><td style="height:16px"></td></tr>
<tr><td style="background:${INK};border:3px solid ${INK};border-radius:12px;padding:14px 16px;font:400 12px/1.6 ${MONO};color:${CREAM};white-space:pre-wrap;word-break:break-word">${escapeHtml(i.stack)}</td></tr>`
    : ""
}
<tr><td style="${FINE_PRINT};padding-top:26px">The same error stays quiet for up to the next ${i.quietMinutes} minutes so a crash loop cannot fill this mailbox. Every occurrence is still in the error_log table and in the Cloudflare logs.</td></tr>
</table></td></tr></table></body></html>`;
}

export function errorAlertEmailText(i: ErrorAlertInput): string {
  const where = [i.method, i.path].filter(Boolean).join(" ") || i.kind;
  return `Coverr crashed

When:  ${i.at}
Where: ${where}
Kind:  ${i.kind}

${i.message}

${i.stack ?? "(no stack)"}

The same error stays quiet for up to the next ${i.quietMinutes} minutes. Every occurrence is still in the error_log table and in the Cloudflare logs.`;
}

export function errorAlertEmailSubject(i: ErrorAlertInput): string {
  // One line, and short enough that a phone notification shows the message
  // rather than the word "error" four times.
  const [firstLine = ""] = i.message.split("\n");
  const first = firstLine.slice(0, 80);
  return `Coverr error — ${first}`;
}

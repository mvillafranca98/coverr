/** Money is centavos everywhere. L200.00 -> 20000. Never floats. */
export function formatLps(centavos: number): string {
  const sign = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  return `${sign}L${whole.toLocaleString("en-US")}.${String(cents).padStart(2, "0")}`;
}

/** "L200" when the centavos are zero — cleaner on the buyer page. */
export function formatLpsShort(centavos: number): string {
  return centavos % 100 === 0
    ? `L${Math.floor(centavos / 100).toLocaleString("en-US")}`
    : formatLps(centavos);
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomBase32(chars: number): string {
  const bytes = new Uint8Array(chars);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += CROCKFORD[b % 32];
  return out;
}

/** Sortable id: base36 millis + random suffix. Readable in a DB browser. */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomBase32(8).toLowerCase()}`;
}

/** 128-bit random, Crockford base32. This is the QR payload. */
export function newQrToken(): string {
  return randomBase32(26);
}

/**
 * Buyer-facing order code, e.g. JGL-4827. Doubles as the optional "Detalle"
 * value the buyer can paste into their bank transfer. Deliberately short and
 * unambiguous — no I, L, O, U.
 */
export function newShortCode(bandSlug: string): string {
  const prefix = bandSlug.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  return `${prefix}-${randomBase32(4)}`;
}

export const BANKS = [
  { code: "BAC", label: "BAC Credomatic" },
  { code: "FICOHSA", label: "Ficohsa" },
  { code: "ATLANTIDA", label: "Banco Atlántida" },
  { code: "OCCIDENTE", label: "Banco de Occidente" },
  { code: "BANPAIS", label: "Banpaís" },
  { code: "OTHER", label: "Otro banco" },
] as const;

export type BankCode = (typeof BANKS)[number]["code"];

export function bankLabel(code: string): string {
  return BANKS.find((b) => b.code === code)?.label ?? code;
}

/**
 * Sending cross-bank via ACH Pronto costs the BUYER a commission (~L40 at BAC).
 * Receiving is free by law — CNBS banned charging to receive in 2022. So we warn
 * the buyer, and only when their bank differs from every account we hold.
 */
export const ACH_FEE_CENTAVOS = 4000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Strips everything but digits, drops a Honduran +504 country prefix. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("504") && digits.length > 8 ? digits.slice(3) : digits;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Proofs carry third-party banking details — purge 30 days after the event. */
export function purgeAfter(eventStartsAt: string): string {
  const d = new Date(eventStartsAt);
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  // Honduras is UTC-6 year round, no DST.
  const local = new Date(d.getTime() - 6 * 3600 * 1000);
  return `${days[local.getUTCDay()]} ${local.getUTCDate()} de ${months[local.getUTCMonth()]}`;
}

export function formatEventTime(iso: string): string {
  const local = new Date(new Date(iso).getTime() - 6 * 3600 * 1000);
  let h = local.getUTCHours();
  const m = local.getUTCMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return m === 0 ? `${h}${ampm}` : `${h}:${String(m).padStart(2, "0")}${ampm}`;
}

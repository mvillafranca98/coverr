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

/**
 * Proofs carry third-party banking details, so they do not outlive the event by
 * long. Exported because the privacy notice states this number to the people
 * whose data it is — the two must never disagree.
 */
export const PROOF_RETENTION_DAYS = 30;

/** The instant a proof uploaded for this event becomes due for deletion. */
export function purgeAfter(eventStartsAt: string): string {
  const d = new Date(eventStartsAt);
  d.setDate(d.getDate() + PROOF_RETENTION_DAYS);
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

/** Door-staff scanner credential. Long enough that guessing is hopeless. */
export function newStaffToken(): string {
  return randomBase32(18);
}

/**
 * URL slug from an event name. Honduras writes accents; strip them so the link
 * stays typable and shareable.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "evento";
}

/**
 * Honduras is UTC-6 all year — no daylight saving — so a `datetime-local`
 * value can be pinned to that offset without a timezone library.
 */
export const HN_OFFSET = "-06:00";

export function localInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return `${value}:00${HN_OFFSET}`;
}

/** Back to the `YYYY-MM-DDTHH:MM` shape a datetime-local input expects. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]}T${m[2]}` : "";
}

/** Lempiras typed into a form -> centavos. Money never round-trips as a float. */
/**
 * Lempiras as typed into a form, to centavos. Null when the input is not a
 * usable amount, so the caller can say which field to fix.
 *
 * Blank is rejected before Number() ever sees it, because `Number("")` and
 * `Number("   ")` are both 0 — an empty price field would otherwise parse as a
 * free ticket rather than as a mistake. An explicit "0" is still accepted:
 * a manual sale priced at zero is how a comp gets issued.
 */
export function lpsToCentavos(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/**
 * Formats we can both send to the vision model and render in an <img> for a
 * human to check. HEIC is the notable exclusion: iPhone photos default to it,
 * the vision API rejects it, and Chrome and Firefox cannot display it — so a
 * HEIC proof breaks the automatic path *and* the manual fallback.
 */
const READABLE_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function isReadableProof(contentType: string): boolean {
  const t = contentType.toLowerCase().split(";")[0]!.trim();
  return t === "application/pdf" || READABLE_IMAGE.includes(t);
}

export function isRenderableImage(contentType: string): boolean {
  return READABLE_IMAGE.includes(contentType.toLowerCase().split(";")[0]!.trim());
}

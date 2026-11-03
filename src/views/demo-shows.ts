/**
 * The invented gigs Coverr shows off with: the landing page's hero ticket and
 * product screenshots, and the examples inside empty form fields. One is picked
 * at random on every page view, so the joke changes on refresh.
 *
 * Every band, event and venue here is made up, and has to stay that way: no
 * name a San Pedro Sula or Tegucigalpa audience could tie to a real band or
 * venue. The people are famous musicians, as an obvious joke rather than a
 * claim that any of them bought a ticket — the page captions these as examples.
 *
 * `scripts/shoot.mjs` reads this list too and takes one set of screenshots per
 * show, named by `key`. Adding or renaming a show means re-running
 * `npm run shots`; a test fails until its screenshots exist. Names are kept
 * short because the screenshots' crops assume nothing wraps onto a second line,
 * and the script refuses to shoot a show whose names do.
 *
 * No imports, on purpose: Node runs this file directly for the scripts.
 */

export type DemoShow = {
  /** Names this show's screenshots: `/img/shot-ticket-<key>.webp`. */
  key: string;
  band: string;
  event: string;
  venue: string;
  /** Whose name is on the ticket screenshot. */
  ticketHolder: string;
  /** Who the door scanner screenshot lets in. */
  checkedIn: string;
};

export const DEMO_SHOWS: readonly DemoShow[] = [
  {
    key: "acople",
    band: "Acople Eterno",
    event: "Probando, 1, 2",
    venue: "Cochera del Tío",
    ticketHolder: "Freddie Mercury",
    checkedIn: "Celia Cruz",
  },
  {
    key: "baleada",
    band: "Baleada Punk",
    event: "Doble Aguacate",
    venue: "Patio de la Pila",
    ticketHolder: "Gustavo Cerati",
    checkedIn: "Juan Gabriel",
  },
  {
    key: "volumen",
    band: "Volumen 11",
    event: "Se Fue la Luz",
    venue: "Garaje Ajeno",
    ticketHolder: "Jimi Hendrix",
    checkedIn: "Chavela Vargas",
  },
  {
    key: "afinador",
    band: "Sin Afinador",
    event: "Último Ensayo",
    venue: "Salón Comunal",
    ticketHolder: "Bob Marley",
    checkedIn: "Mercedes Sosa",
  },
  {
    key: "covers",
    band: "Cuerda Rota",
    event: "Solo Covers",
    venue: "Casa de Tu Ex",
    ticketHolder: "David Bowie",
    checkedIn: "Héctor Lavoe",
  },
  {
    key: "fiado",
    band: "Pulpería Funk",
    event: "Noche de Fiado",
    venue: "Bajo la Lámina",
    ticketHolder: "Janis Joplin",
    checkedIn: "Elvis Presley",
  },
];

/** One show, chosen with `random` (0 inclusive to 1 exclusive, like Math.random). */
export function pickDemoShow(random: () => number = Math.random): DemoShow {
  const index = Math.min(Math.floor(random() * DEMO_SHOWS.length), DEMO_SHOWS.length - 1);
  // The list is a non-empty literal, and the index is clamped into it.
  return DEMO_SHOWS[index] as DemoShow;
}

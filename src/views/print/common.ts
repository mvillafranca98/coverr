/**
 * What every printout shares: the event it is for, and the page's margins.
 *
 * All three printouts are black on white with no grey and no large black
 * fills: they get photocopied at a corner shop, often more than once, and
 * grey turns to mottle while big fills smear and cost toner. Weight and size
 * carry the design instead.
 */

/** The event as every printout names it, already formatted for reading. */
export type PrintEvent = {
  bandName: string;
  eventName: string;
  /** "sábado 24 de octubre · 9pm" */
  when: string;
  venue: string;
};

/** Points from each edge. Wide enough for any office printer's unprintable border. */
export const MARGIN = 48;

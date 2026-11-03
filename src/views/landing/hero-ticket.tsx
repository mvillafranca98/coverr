import type { FC } from "hono/jsx";
import { qrDataUri } from "../../lib/qr";
import type { DemoShow } from "../demo-shows";

/**
 * The hero object: a ticket stub drawn as a sticker — flat colour, heavy
 * outline, hard shadow — with a round sticker slapped on its corner.
 *
 * Everything on it is one of the invented shows in views/demo-shows.ts, the
 * same one the screenshots further down show, and the caption says it is an
 * example. The QR is real and encodes this page's own
 * address, so anyone who scans it out of curiosity lands back here rather
 * than on a dead code.
 *
 * Decorative to assistive tech: the headline beside it carries the message,
 * and a stub read aloud field by field would only be noise.
 */
export const HeroTicket: FC<{ origin: string; show: DemoShow }> = ({ origin, show }) => (
  <figure class="stage" data-rise>
    <div class="tix-tilt" data-tilt>
      <div class="tix-float" data-float>
        <div class="tix" aria-hidden="true">
          {/* One label only: the sticker sits over the right end of this band. */}
          <div class="tix__head">
            <span>Preventa · Admite 1</span>
          </div>
          <div class="tix__body">
            <p class="tix__band">{show.band}</p>
            <p class="tix__event">{show.event}</p>
            <dl class="tix__meta">
              <div>
                <dt>Fecha</dt>
                <dd>Sáb 24 oct</dd>
              </div>
              <div>
                <dt>Puertas</dt>
                <dd>8:00 pm</dd>
              </div>
              <div>
                <dt>Lugar</dt>
                <dd>{show.venue}</dd>
              </div>
            </dl>
          </div>
          <div class="tix__perf" />
          <div class="tix__stub">
            <img src={qrDataUri(origin, 240)} alt="" width="104" height="104" />
            <div class="tix__stubtext">
              <span class="tix__code">7QKG3F</span>
              <span>Boleto 1 de 1</span>
            </div>
          </div>
        </div>
        <span class="tix__sticker" aria-hidden="true">
          ¡QR al instante!
        </span>
      </div>
    </div>
    <figcaption>Boleto de ejemplo · el QR abre esta página</figcaption>
  </figure>
);

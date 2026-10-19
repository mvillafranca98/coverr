import type { FC } from "hono/jsx";
import { LegalDoc } from "./doc";
import { CONTACT_EMAIL, PROOF_RETENTION_DAYS, UPDATED } from "./constants";

/**
 * The privacy notice.
 *
 * Every factual claim on this page is checked against the code, because a
 * policy that overstates what the product does is worse than none — it is the
 * one document a reader is entitled to rely on. In particular:
 *
 *  - the retention window comes from `lib/core.ts#purgeAfter` and is actually
 *    executed by `jobs/purge-proofs.ts` on the nightly cron;
 *  - the list of third parties is the Data inventory in docs/STANDARDS.md,
 *    which is built from the code rather than from memory (LEG-02);
 *  - the "no cookies for buyers" claim holds because the only `Set-Cookie` in
 *    the product is the band session in `routes/admin/session.tsx`.
 *
 * If any of those change, this page changes in the same commit.
 */
export const PrivacyPage: FC<{ origin: string }> = ({ origin }) => (
  <LegalDoc
    title="Aviso de privacidad — Coverr"
    description="Qué datos guarda Coverr, con quién se comparten, cuánto tiempo se conservan y cómo pedir que los borremos."
    heading="Aviso de privacidad"
    updated={UPDATED}
    canonical={`${origin}/privacidad`}
  >
    <p>
      Coverr es la herramienta que usa una banda para vender los boletos de su propio toque.{" "}
      <b>El dinero nunca pasa por Coverr</b>: vos transferís directo a la cuenta bancaria de la
      banda. Eso cambia qué datos existen y quién los ve, así que vale la pena leer esto.
    </p>
    <p>
      Coverr lo opera macawly.dev. Cuando comprás un boleto, la banda que organiza el evento
      también ve tus datos: es ella la que te recibe en la puerta.
    </p>

    <h2>Qué guardamos y para qué</h2>

    <h3>Si comprás un boleto</h3>
    <ul>
      <li>
        <b>Tu nombre, tu correo y tu teléfono</b> (el teléfono es opcional). Para emitir tus
        códigos QR, mandártelos por correo y que puedas recuperarlos si los perdés.
      </li>
      <li>
        <b>El nombre de cada asistente</b> y una nota opcional. Es lo que lee el personal en la
        puerta cuando te escanean.
      </li>
      <li>
        <b>Tu comprobante de transferencia.</b> Tiene su propia sección más abajo, porque es el
        dato más delicado del producto.
      </li>
      <li>
        <b>Cuántos boletos, el monto y la hora.</b> Es el registro de la venta, y de ahí sale el
        reparto de la banda al final del evento.
      </li>
      <li>
        <b>Cuándo te registraron en la puerta</b>, y en qué dispositivo.
      </li>
    </ul>

    <h3>Si creás una banda</h3>
    <ul>
      <li>El nombre de la banda y un correo de contacto.</li>
      <li>
        Las cuentas bancarias donde querés recibir el dinero, con el nombre del titular.{" "}
        <b>Estas se le muestran a cualquiera que abra tu página de venta</b> — es el punto del
        producto, pero conviene saberlo antes de escribirlas.
      </li>
      <li>Tus integrantes, sus porcentajes de reparto, los costos del evento y los adelantos.</li>
    </ul>

    <h3>Lo que se guarda solo</h3>
    <p>
      Tu dirección IP, que Cloudflare usa como llave para limitar intentos repetidos en el
      formulario de compra y en el acceso de bandas. Nada más.
    </p>
    <p>
      No hay analítica, ni píxeles, ni publicidad, ni rastreadores de terceros en ninguna página
      de Coverr. No vendemos datos, no los alquilamos y no los usamos para perfilar a nadie.
    </p>

    <h2>El comprobante de pago</h2>
    <div class="callout">
      Cuando subís la captura de tu transferencia, esa imagen casi siempre trae el nombre y el
      número de cuenta completo de <b>quien pagó</b> — que muchas veces no sos vos, porque una
      persona paga por cuatro. Es información bancaria de un tercero y la tratamos como tal.
    </div>
    <ul>
      <li>
        Se guarda privada en Cloudflare R2. Sólo quien administra la banda de ese evento puede
        abrirla, con sesión iniciada.
      </li>
      <li>
        Se manda a Anthropic (Claude) para leer los campos por su etiqueta: banco, referencia,
        monto, fecha y nombre. Nada más.{" "}
        <b>Ningún modelo decide si tu comprobante es auténtico</b> — eso lo hacen reglas fijas y
        escritas, cada una con un motivo que se puede decir en voz alta.
      </li>
      <li>
        <b>Se borra {PROOF_RETENTION_DAYS} días después del evento</b>, automáticamente, todas
        las noches. Con la imagen se borran también de la base el nombre y el número de cuenta de
        quien pagó y de quien recibió.
      </li>
      <li>
        Quedan guardados el número de referencia y una huella digital del archivo. Sirven para
        detectar el mismo comprobante usado dos veces; por sí solos no identifican a nadie.
      </li>
    </ul>

    <h2>Con quién lo compartimos</h2>
    <p>
      Sólo con los servicios que hacen funcionar el producto. Esta lista está completa: si algún
      día se agrega otro, se agrega acá en el mismo cambio.
    </p>
    <ul class="rows">
      <li>
        <strong>Cloudflare — Workers</strong>
        <span>
          Atiende cada visita. Recibe los datos de la solicitud, incluida tu IP, que se usa como
          llave para limitar intentos repetidos.
        </span>
      </li>
      <li>
        <strong>Cloudflare — D1</strong>
        <span>
          La base de datos. Guarda tu nombre, correo y teléfono, los nombres de los asistentes,
          las órdenes, los registros de entrada y los datos de la banda.
        </span>
      </li>
      <li>
        <strong>Cloudflare — R2</strong>
        <span>
          Guarda la imagen de tu comprobante, privada, hasta que se borra{" "}
          {PROOF_RETENTION_DAYS} días después del evento.
        </span>
      </li>
      <li>
        <strong>Anthropic</strong>
        <span>
          Recibe la imagen del comprobante para leer sus campos por etiqueta, y por lo tanto los
          datos bancarios que aparecen en ella.
        </span>
      </li>
      <li>
        <strong>Resend</strong>
        <span>
          Manda los correos: tus boletos a tu dirección, y el enlace de acceso al correo de
          contacto de la banda.
        </span>
      </li>
      <li>
        <strong>WhatsApp</strong>
        <span>
          Sólo si quien administra la banda toca el botón para escribirte: se abre WhatsApp con tu
          número. Coverr no le manda nada a WhatsApp por su cuenta.
        </span>
      </li>
    </ul>
    <p>
      Fuera de eso, compartimos datos únicamente si una autoridad hondureña competente lo exige
      por escrito.
    </p>

    <h2>Cuánto tiempo lo guardamos</h2>
    <ul class="rows">
      <li>
        <strong>Comprobantes: la imagen y los datos bancarios que trae</strong>
        <span>{PROOF_RETENTION_DAYS} días después del evento, y se borran solos.</span>
      </li>
      <li>
        <strong>Órdenes, boletos y registros de entrada</strong>
        <span>
          Mientras la banda exista. Es su historial, y es la única fuente del reparto — por eso un
          reembolso no borra la orden: la anula y escribe una línea negativa.
        </span>
      </li>
      <li>
        <strong>Sesión de banda</strong>
        <span>30 días. El enlace de acceso que llega por correo vence en 15 minutos.</span>
      </li>
    </ul>

    <h2>Tus derechos</h2>
    <p>
      En Honduras podés pedir ver, corregir o eliminar tus datos personales — es el{" "}
      <i>habeas data</i> del artículo 182 de la Constitución. Escribinos a{" "}
      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> y te respondemos.
    </p>
    <p>
      Si querés que borremos tu nombre y tu correo de una orden, decilo y lo hacemos conservando
      el registro de la venta sin tus datos, para que el reparto de la banda siga cuadrando.
    </p>
    <p>
      Lo que no podemos hacer es esconderte de la banda mientras tengas un boleto válido: la banda
      es quien te recibe en la puerta, y necesita tu nombre para hacerlo.
    </p>

    <h2>Cookies</h2>
    <p>
      Una sola, y sólo para bandas: la que te mantiene con sesión abierta después de entrar por el
      enlace. Dura 30 días y no sirve para nada más.
    </p>
    <p>
      <b>Si venís a comprar un boleto, Coverr no te deja ninguna cookie.</b> No hay cookies de
      terceros, ni de analítica, ni de publicidad, en ninguna página.
    </p>

    <h2>Seguridad</h2>
    <p>
      Todo el sitio va por HTTPS y una visita por HTTP se redirige antes de que viaje cualquier
      dato. Los comprobantes no son públicos ni tienen enlace adivinable: se sirven sólo detrás de
      una sesión de banda y sólo para los eventos de esa banda. Las páginas que muestran datos de
      una persona — tu boleto, la cuenta bancaria de la banda — están marcadas para que no
      aparezcan en buscadores.
    </p>
    <p>
      Ningún sistema es perfecto. Si encontrás algo que no debería ser accesible, escribinos a{" "}
      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> antes de publicarlo y lo arreglamos.
    </p>

    <h2>Menores de edad</h2>
    <p>
      Coverr es para personas de 18 años o más. No pedimos ni queremos datos de menores. Si creés
      que tenemos datos de alguien menor de edad, escribinos y los borramos.
    </p>

    <h2>Cambios</h2>
    <p>
      Si esto cambia, cambia la fecha de arriba. Un cambio que afecte lo que ya compraste no se
      aplica hacia atrás: la política que valía el día de tu compra es la que te corresponde.
    </p>

    <h2>Contacto</h2>
    <p>
      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> — Coverr, un producto de{" "}
      <a href="https://macawly.dev">macawly.dev</a>, Honduras.
    </p>
    <p>
      Para algo del evento en sí — un cobro mal hecho, un reembolso, tu nombre mal escrito —
      escribile directo a la banda: es ella la que vendió el boleto y la que tiene el dinero.
    </p>
  </LegalDoc>
);

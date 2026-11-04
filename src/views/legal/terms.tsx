import type { FC } from "hono/jsx";
import { formatLpsShort } from "../../lib/core";
import { freeFirstEventLastDay, priceBracket } from "../../lib/settlement";
import { CONTACT_EMAIL, TERMS_UPDATED } from "./constants";
import { LegalDoc } from "./doc";

/**
 * The terms of service.
 *
 * The one clause that matters more than the rest: Coverr never holds the
 * money. Everything a buyer could want from a ticketing company — a refund, a
 * chargeback, somebody to blame for a cancelled gig — has to point at the band,
 * because the band is who received the transfer. Saying so plainly is both
 * honest and the thing that keeps this a SaaS tool rather than a money
 * transmitter.
 *
 * The fee table is derived from `priceBracket` rather than typed out, so the
 * published price cannot drift from the charged one.
 *
 * The "hoy no se cobra" paragraph is driven by the `billing` switch rather
 * than written as fact. It used to be prose with a comment asking whoever
 * flipped billing to remember to edit it — which nobody would, and the
 * published terms would then be a lie. Throwing the switch now rewrites this
 * page in the same instant.
 */
const REPORT_TIERS: { range: string; amount: number }[] = [
  { range: "1 – 60 boletos vendidos", amount: priceBracket(60).amount },
  { range: "61 – 150", amount: priceBracket(150).amount },
  { range: "151 – 300", amount: priceBracket(300).amount },
  { range: "301 o más", amount: priceBracket(301).amount },
];

export const TermsPage: FC<{ origin: string; billingEnabled: boolean }> = ({
  origin,
  billingEnabled,
}) => (
  <LegalDoc
    title="Términos del servicio — Coverr"
    description="Qué hace Coverr, qué no hace, quién responde por el dinero y qué pasa con un reembolso."
    heading="Términos del servicio"
    updated={TERMS_UPDATED}
    canonical={`${origin}/terminos`}
  >
    <p>
      Esto aplica para todos: para la banda que vende y para la persona que compra. Está escrito
      para leerse, no para esconder nada.
    </p>

    <h2>Lo más importante: el dinero no pasa por acá</h2>
    <div class="callout">
      <b>Coverr nunca recibe, retiene ni mueve tu dinero.</b> Vos transferís de tu banco al banco de
      la banda, directo. Coverr es la herramienta que registra esa venta, te manda el código QR y lo
      valida en la puerta.
    </div>
    <p>
      De ahí se desprende casi todo lo demás. Coverr no puede devolverte plata que nunca tuvo, no
      puede retener el pago de la banda y no puede hacer un contracargo. Si querés un reembolso,
      quien lo autoriza y quien lo transfiere es la banda.
    </p>

    <h2>Si comprás un boleto</h2>
    <ul>
      <li>
        <b>Tu contrato por el evento es con la banda</b>, no con Coverr. Ella fija el precio, las
        condiciones, la hora y si el evento se hace o no.
      </li>
      <li>
        <b>El código QR es el boleto.</b> Vale un ingreso. Si lo compartís, entra quien lo escanee
        primero y vos te quedás afuera — no hay forma de distinguirlos.
      </li>
      <li>
        <b>Los códigos se emiten en el momento</b>, en pantalla, antes de que verifiquemos nada. Si
        tu comprobante queda marcado para revisión, eso lo resuelve la banda; tu boleto no queda en
        espera.
      </li>
      <li>
        <b>El reembolso se rige por la política que estaba vigente el día de tu compra</b>, que
        queda congelada en tu orden y se te muestra antes de pagar. Un cambio posterior no te
        afecta. Aprobado un reembolso, tu QR se anula.
      </li>
      <li>
        <b>Subí sólo tu propio comprobante.</b> Usar el de otra persona, o el mismo dos veces, es
        algo que el sistema detecta y la banda puede anular la orden.
      </li>
      <li>
        <b>Dale bien tu correo.</b> Es la única forma de recuperar tus boletos si cerrás la página,
        y no podemos mandarlos a una dirección equivocada.
      </li>
    </ul>

    <h2>Si vendés con Coverr</h2>
    <ul>
      <li>
        <b>La cuenta bancaria que publicás es tuya y respondés por ella.</b> Coverr la muestra tal
        como la escribiste; un dígito mal escrito manda el dinero de tus compradores a otra persona,
        y eso no lo podemos revertir.
      </li>
      <li>
        <b>Honrás los boletos que vendiste.</b> Si cancelás o movés el evento, resolvés con tus
        compradores: tenés sus datos en el panel justamente para eso.
      </li>
      <li>
        <b>Los comprobantes que ves son datos bancarios de terceros.</b> No los compartás ni los
        publiques. Se borran solos, pero mientras existen son tu responsabilidad también.
      </li>
      <li>
        <b>Los datos de tus compradores son para tu evento</b>, no para revenderlos ni para
        mandarles publicidad de nadie más.
      </li>
      <li>
        <b>Vos declarás los costos, los porcentajes y los adelantos.</b> Coverr hace la aritmética y
        la muestra; no audita tus números ni media entre integrantes.
      </li>
    </ul>

    <h2>Edad mínima</h2>
    <p>
      <b>Coverr es para personas de 18 años o más</b>, tanto para comprar como para crear una banda.
      Si sos menor de edad, no uses el servicio. Esto es sobre el uso de la plataforma; el ingreso a
      un evento lo define la banda y el local.
    </p>

    <h2>Qué cuesta</h2>
    <p>
      La preventa, la emisión de códigos QR, el envío por correo, el registro en la puerta, las
      ventas en efectivo, las cortesías y el resumen en vivo son <b>gratis, siempre</b>. El
      historial de una banda nunca se bloquea.
    </p>
    <p>
      Lo único que se cobra es el <b>reporte de reparto</b> al final de cada evento, cuando el toque
      ya pasó y el dinero ya está en la cuenta de la banda. El primer evento de cada banda es
      gratis, sin importar su tamaño, si se realiza a más tardar el{" "}
      {freeFirstEventLastDay({ year: true })}. Las cortesías no cuentan para el tramo.
    </p>
    <p>
      El reporte se paga por transferencia a la cuenta de Coverr que muestra la página, subiendo la
      captura. El reporte se abre en cuanto se sube y no se vuelve a cerrar. Si después la
      transferencia no aparece y no se resuelve hablándolo, la banda no puede crear eventos nuevos
      hasta pagarlo; los que ya están a la venta siguen vendiendo.
    </p>
    <ul class="rows">
      {REPORT_TIERS.map((tier) => (
        <li key={tier.range}>
          <strong>{tier.range}</strong>
          <span>{formatLpsShort(tier.amount)} por evento</span>
        </li>
      ))}
    </ul>
    {billingEnabled ? (
      <p>
        Se avisa con antelación y nunca de forma retroactiva: un evento ya desbloqueado queda
        desbloqueado. No hay suscripción ni plan mensual.
      </p>
    ) : (
      <p>
        <b>Por ahora el reporte también es gratis:</b> mientras Coverr se gana su lugar en la
        escena, todas las bandas lo ven completo sin pagar. Antes de empezar a cobrarlo se avisa con
        antelación, y nunca de forma retroactiva: un evento ya desbloqueado queda desbloqueado. No
        hay suscripción ni plan mensual.
      </p>
    )}

    <h2>Qué no prometemos</h2>
    <p>
      Coverr se ofrece tal como está. No prometemos que esté disponible sin interrupciones: la noche
      de un toque depende también del wifi del local, de la señal del teléfono y de servicios de
      terceros que no controlamos.
    </p>
    <p>
      Por eso el escáner de la puerta <b>funciona sin internet</b> — guarda la lista completa en el
      teléfono y valida localmente — y por eso los códigos QR quedan en pantalla y se pueden
      descargar. Si algo nuestro falla esa noche, el boleto sigue siendo verificable.
    </p>
    <p>
      Coverr no responde por el evento en sí: ni por que se haga, ni por el local, ni por lo que
      pase adentro. Responde por la herramienta.
    </p>

    <h2>Suspensión</h2>
    <p>
      Podemos suspender una cuenta que use Coverr para cobrar por algo que no es un evento, que
      publique una cuenta bancaria que no le pertenece, o que exponga los datos de sus compradores.
      Si pasa, lo decimos y explicamos por qué.
    </p>
    <p>
      Una banda puede borrar su cuenta cuando quiera, desde Ajustes, y con ella se borra todo lo que
      tiene en Coverr; no se puede deshacer. Mientras tenga un evento por realizarse con boletos
      vendidos, o una solicitud de reembolso sin responder, la cuenta no se puede borrar: primero
      hay que cumplirle a quien compró.
    </p>

    <h2>Ley aplicable</h2>
    <p>
      Estos términos se rigen por las leyes de la República de Honduras, y cualquier disputa se ve
      ante los tribunales competentes de Honduras. Coverr se ofrece únicamente en Honduras, en
      lempiras.
    </p>

    <h2>Cambios</h2>
    <p>
      Si estos términos cambian, cambia la fecha de arriba. Lo que valía el día de tu compra es lo
      que te corresponde.
    </p>

    <h2>Contacto</h2>
    <p>
      <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> — Coverr, un producto de{" "}
      <a href="https://macawly.dev">macawly.dev</a>, Honduras. Para lo que tenga que ver con un
      evento, escribile a la banda.
    </p>
    <p>
      Cómo tratamos tus datos está en el <a href="/privacidad">aviso de privacidad</a>, que es parte
      de estos términos.
    </p>
  </LegalDoc>
);

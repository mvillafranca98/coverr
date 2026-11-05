import type { FC } from "hono/jsx";
import { formatLpsShort } from "../../lib/core";
import { LARGE_SHOW_FROM, LARGE_SHOW_PER_TICKET, priceBracket } from "../../lib/settlement";
import { OperatorLayout } from "./layout";

/** One switch's commands, as they are typed in the project folder. */
const switchCommand = (key: string, enabled: 0 | 1, note: string) =>
  `npx wrangler d1 execute coverr-db --remote --command "INSERT INTO platform_flags (key, enabled, note, changed_at) VALUES ('${key}', ${enabled}, '${note}', datetime('now')) ON CONFLICT(key) DO UPDATE SET enabled=${enabled}, note=excluded.note, changed_at=excluded.changed_at"`;

const Command: FC<{ text: string }> = ({ text }) => (
  <pre class="guide__cmd">
    <code>{text}</code>
  </pre>
);

/**
 * How to run Coverr's back office, for whoever is on the operator list: every
 * screen under /operador, the switches, and what to say to a band in the usual
 * situations. The band guide is public at /guia and linked from here, so the
 * operator can send it instead of answering from memory.
 */
export const OperatorGuidePage: FC<{ origin: string }> = ({ origin }) => {
  const sections: [string, string][] = [
    ["acceso", "Quién entra y cómo"],
    ["bandas", "Bandas: suspender, pase libre, promo"],
    ["cobros", "Cobros: el libro del mes"],
    ["pagos", "Revisar un pago"],
    ["no-pagado", "Un pago que no llegó"],
    ["cuentas", "Cuentas de cobro"],
    ["interruptores", "Los interruptores"],
    ["correos", "Los correos que te llegan"],
    ["situaciones", "Situaciones comunes"],
    ["privacidad", "Privacidad"],
  ];
  return (
    <OperatorLayout title="Guía de operación — Coverr" signedIn active="guide">
      <h1>Guía de operación</h1>
      <div class="note ok">
        <b>Guía para bandas:</b> <a href={`${origin}/guia`}>{`${origin}/guia`}</a>
        <p style="margin:8px 0 0">
          Todo lo que una banda necesita, de crear su cuenta al reparto. Mandales ese enlace antes
          de contestar de memoria.
        </p>
      </div>
      <article class="guide">
        <ol>
          {sections.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`}>{label}</a>
            </li>
          ))}
        </ol>

        <h2 id="acceso">Quién entra y cómo</h2>
        <p>
          Entran solo los correos de la lista de operadores: hoy <b>hola@coverr.live</b>, Armando y
          Alexis. La lista vive en <code>wrangler.jsonc</code> (<code>OPERATOR_EMAILS</code>);
          cambiarla es editar ese archivo y desplegar. Quitar un correo le corta el acceso en su
          próximo clic.
        </p>
        <p>
          Para entrar: <a href="/operador/acceso">coverr.live/operador/acceso</a>, tu correo,{" "}
          <b>Enviar enlace</b>, y en la página que abre el correo, <b>Entrar</b>. El enlace sirve
          una sola vez y vence en 15 minutos; la sesión dura 12 horas. Lo que hagás entrando como{" "}
          <b>hola@</b> queda en el historial como hola@, no con tu nombre: para los cambios que
          importan, entrá con tu propio correo.
        </p>

        <h2 id="bandas">Bandas: suspender, pase libre, promo</h2>
        <p>
          <b>Bandas</b> lista todas, de la más nueva a la más vieja: alta, eventos, boletos pagados,
          última actividad, reportes y estado. El buscador encuentra por nombre o correo. Al tocar
          una banda ves:
        </p>
        <ul>
          <li>
            <b>Suspensión</b>: con un <b>Motivo</b>, <b>Suspender banda</b>. No puede entrar ni
            crear eventos, y sus eventos dejan de vender en línea. Los boletos que ya vendió siguen
            funcionando, porque esa gente ya le pagó. Si intenta entrar, le llega un correo de que
            su cuenta está suspendida. <b>Reactivar banda</b> lo deshace.
          </li>
          <li>
            <b>Pase libre</b>: sus reportes no se cobran, sin fecha de fin o hasta una fecha. Cuenta
            la fecha del evento, no la del desbloqueo. Siempre con una nota de para qué es.
          </li>
          <li>
            <b>Promo</b>: un descuento tuyo (1 a 100%) para sus próximos reportes cobrados, para uno
            o varios reportes y opcionalmente hasta una fecha. Se aplica sola. No se suma: si un
            reporte ya es gratis por el pase o por su primer evento, la promo queda para el
            siguiente.
          </li>
          <li>
            <b>Eventos</b>: cada uno con su estado y, si ya abrió el reporte, cómo va su pago.
          </li>
          <li>
            <b>El mismo correo también lleva</b>: las otras bandas de esa persona, si tiene. Un
            correo puede llevar varias bandas. Suspender una impide que ese correo cree bandas
            nuevas, pero las otras siguen funcionando hasta que las suspendás también. Un pago no
            pagado bloquea los eventos nuevos de todas sus bandas.
          </li>
          <li>
            <b>Historial</b>: cada cambio, con fecha, nota y quién lo hizo.
          </li>
        </ul>

        <h2 id="cobros">Cobros: el libro del mes</h2>
        <p>
          <b>Cobros</b> muestra los reportes abiertos en el mes, con <b>← Anterior</b> y{" "}
          <b>Siguiente →</b> para moverte. Arriba: <b>Cobrado</b>, <b>Recibido</b>,{" "}
          <b>Por revisar</b>, <b>No pagado</b> y cuántos fueron <b>Gratis</b>. <b>Descargar CSV</b>{" "}
          baja el mes completo para la contabilidad, con descuento y número de factura.
        </p>
        <p>Los estados de un pago:</p>
        <ul>
          <li>
            <b>Leyendo</b>: la captura se está revisando (un par de minutos).
          </li>
          <li>
            <b>Recibido</b>: la captura cuadró con el monto y con una de nuestras cuentas.
          </li>
          <li>
            <b>Por revisar</b>: algo no cuadró. Te llega un correo.
          </li>
          <li>
            <b>Revisado</b>: alguien de nosotros lo revisó y está bien.
          </li>
          <li>
            <b>No pagado</b>: confirmamos que no pagó.
          </li>
          <li>
            <b>Gratis · primer evento / pase libre / promo</b>: no se cobró, y por qué.
          </li>
        </ul>
        <p>
          Un reporte cuesta de {formatLpsShort(priceBracket(1).amount)} a{" "}
          {formatLpsShort(priceBracket(LARGE_SHOW_FROM).amount)} según los boletos pagados, y arriba
          de {LARGE_SHOW_FROM} boletos se suman {formatLpsShort(LARGE_SHOW_PER_TICKET)} por cada
          uno. Las cortesías nunca cuentan. La tabla completa está en{" "}
          <a href="/terminos">Términos</a>.
        </p>

        <h2 id="pagos">Revisar un pago</h2>
        <p>Tocá el estado de un pago en Cobros (o en la ficha de la banda):</p>
        <ul>
          <li>
            <b>Lo que no cuadró</b>: el motivo, si hubo alguno.
          </li>
          <li>
            <b>Lo que se leyó</b>: monto, cuenta destino, referencia, fecha, quién transfirió y
            banco. Las notificaciones de BAC no traen año, así que la fecha sale vacía: es normal.
          </li>
          <li>
            <b>Captura</b>: la imagen que subió la banda.
          </li>
          <li>
            <b>Revisión</b>: <b>El pago está bien</b> (nota opcional) o, después de hablar con la
            banda, <b>Marcar no pagado</b> con una nota de qué pasó. Si después paga,{" "}
            <b>Marcar pagado</b>.
          </li>
          <li>
            <b>Factura</b>: el número de la factura que le mandaste, y <b>Guardar</b>.
          </li>
        </ul>
        <p>
          Antes de marcar algo como no pagado, revisá la cuenta de destino en el banco: a veces la
          transferencia llega tarde o a otra de nuestras cuentas.
        </p>

        <h2 id="no-pagado">Un pago que no llegó</h2>
        <p>
          El reporte de la banda se abre al subir la captura y no se vuelve a cerrar. Si marcás el
          pago como no pagado, mientras siga así la banda no puede crear ni publicar eventos, ni
          abrir otro reporte pagado. Lo que ya está a la venta sigue vendiendo y su puerta sigue
          funcionando: no castigamos a los fans.
        </p>
        <p>
          Si después de hablarlo sigue sin pagar (unos 15 días), suspendé la banda desde su ficha.
          Nada se suspende solo: es tu decisión.
        </p>

        <h2 id="cuentas">Cuentas de cobro</h2>
        <p>
          <b>Cuentas</b> lista las cuentas donde las bandas pagan su reporte. A cada banda le
          mostramos la cuenta de Coverr en su mismo banco (para que no pague comisión) y, si no hay,
          la <b>Principal</b>. La principal debe ser la de la empresa,{" "}
          <b>INVERSIONES ALFRAM S. DE R.L.</b>
        </p>
        <ul>
          <li>
            <b>Hacer principal</b> cambia cuál es la principal.
          </li>
          <li>
            <b>Retirar</b> deja de mostrar una cuenta sin borrarla: un pago que ya se hizo a ella se
            sigue reconociendo.
          </li>
          <li>
            <b>Agregar una cuenta</b>: banco, a nombre de, número, y si es la principal.
          </li>
        </ul>

        <h2 id="interruptores">Los interruptores</h2>
        <p>
          Tres interruptores cambian Coverr al instante, sin desplegar. Se usan desde la terminal,
          en la carpeta del proyecto, con la sesión de Cloudflare iniciada (
          <code>npx wrangler login</code>). Para ver cómo están:
        </p>
        <Command
          text={`npx wrangler d1 execute coverr-db --remote --command "SELECT * FROM platform_flags"`}
        />
        <p>
          Sin filas quiere decir todo normal: ventas encendidas, lectura encendida, cobro apagado.
        </p>

        <h3>Pausar todas las ventas</h3>
        <p>
          Para emergencias, por ejemplo una cuenta bancaria equivocada en un evento a la venta.
          Nadie puede comprar en ningún evento de ninguna banda; los boletos vendidos, la puerta y
          los paneles siguen funcionando. Apagar y volver a encender:
        </p>
        <Command text={switchCommand("sales", 0, "motivo")} />
        <Command text={switchCommand("sales", 1, "listo")} />

        <h3>Apagar la lectura de comprobantes</h3>
        <p>
          Si la factura de la lectura automática se dispara. Las compras siguen, las capturas se
          guardan y las bandas las revisan a mano. Los mismos comandos con{" "}
          <code>proof_extraction</code> en vez de <code>sales</code>.
        </p>

        <h3>Encender el cobro de reportes</h3>
        <p>
          Antes: la principal es la cuenta de la empresa, la facturación ante el SAR está resuelta y
          las bandas fueron avisadas con tiempo. Al encenderlo, la página de Términos deja de decir
          que el reporte es gratis por ahora.
        </p>
        <Command text={switchCommand("billing", 1, "cobro encendido")} />

        <h2 id="correos">Los correos que te llegan</h2>
        <ul>
          <li>
            <b>"Pago por revisar — banda"</b>: a todos los operadores, cuando una captura de cobro
            no cuadra. Responder ese correo le escribe directo a la banda.
          </li>
          <li>
            <b>Errores del sistema</b>: le llegan a Alexis, con lo que falló.
          </li>
          <li>
            <b>hola@coverr.live</b>: lo que escriben bandas y compradores. Llega al correo de
            Armando.
          </li>
        </ul>

        <h2 id="situaciones">Situaciones comunes</h2>
        <h3>"No me llega el correo para entrar."</h3>
        <p>
          Que revise Promociones y Spam, que use el mismo correo con que creó la banda, y que espere
          un minuto entre pedidos. Si nada, revisá en su ficha qué correo tiene.
        </p>
        <h3>"Puse mal la cuenta en un evento que ya está vendiendo."</h3>
        <p>
          Que cierre la venta en Ajustes, corrija la cuenta en Banda y la vuelva a abrir. Si no
          puede hacerlo ya, pausá todas las ventas un momento con el interruptor.
        </p>
        <h3>"Un fan pagó y no tiene su QR."</h3>
        <p>
          El QR sale siempre al confirmar y por correo. Que use{" "}
          <a href="/recuperar">coverr.live/recuperar</a>, o que lo busquen por nombre en la puerta.
        </p>
        <h3>"¿Cuánto me van a cobrar?"</h3>
        <p>
          Solo el reporte de reparto de cada evento, según cuántos boletos pagados vendió. Su primer
          evento es gratis si es a más tardar el 31 de enero de 2027. Mandale la{" "}
          <a href={`${origin}/guia#dinero`}>guía</a>.
        </p>
        <h3>"Me suspendieron."</h3>
        <p>
          Revisá el motivo en su ficha y su historial. Si se resolvió, <b>Reactivar banda</b>.
        </p>
        <h3>"Quiero borrar mi cuenta."</h3>
        <p>
          Lo hace la banda desde Banda → Borrar la cuenta. No puede mientras tenga un evento por
          venir con boletos vendidos o un reembolso sin responder. Borrar la cuenta borra también
          sus pagos de reporte de Cobros: si la contabilidad los necesita, bajá el CSV antes.
        </p>

        <h2 id="privacidad">Privacidad</h2>
        <ul>
          <li>
            Las capturas de los compradores muestran cuentas de terceros: se borran solas 30 días
            después del evento. Solo las ve la banda.
          </li>
          <li>
            Las capturas de cobro de las bandas se borran a los 90 días, salvo las que están por
            revisar. Lo que se leyó de ellas queda en el libro.
          </li>
          <li>
            Nunca mandés capturas, números de cuenta ni datos de compradores por WhatsApp o fuera
            del panel.
          </li>
        </ul>
      </article>
    </OperatorLayout>
  );
};

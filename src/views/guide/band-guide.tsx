import type { FC } from "hono/jsx";
import { formatLpsShort } from "../../lib/core";
import {
  freeFirstEventLastDay,
  LARGE_SHOW_FROM,
  LARGE_SHOW_PER_TICKET,
  priceBracket,
} from "../../lib/settlement";
import { CONTACT_EMAIL } from "../legal/constants";
import { LegalDoc } from "../legal/doc";

/** Bumped whenever the guide's content changes. */
export const BAND_GUIDE_UPDATED = "4 de noviembre de 2026";

/**
 * Every part of Coverr a band touches, in the order a band meets it, written
 * to be sent as a link (coverr.live/guia) instead of answered one question at
 * a time. Public and light like the terms: it is a document, read by people who
 * may not have an account yet.
 *
 * Prices come from the same function that charges them, and the billing line
 * follows the live switch, so the guide cannot promise what the product does
 * not do.
 */
export const BandGuidePage: FC<{ origin: string; billingEnabled: boolean }> = ({
  origin,
  billingEnabled,
}) => {
  const bracket = (tickets: number) => formatLpsShort(priceBracket(tickets).amount);
  const sections: [string, string][] = [
    ["que-es", "Qué es Coverr"],
    ["empezar", "Crear tu banda y entrar"],
    ["cuentas", "Tus cuentas bancarias"],
    ["integrantes", "Integrantes, reparto y adelantos"],
    ["evento", "Crear y publicar un evento"],
    ["comprador", "Lo que ve quien compra"],
    ["ordenes", "Órdenes: OK y REVISAR"],
    ["venta", "Ventas manuales y cortesías"],
    ["puerta", "La puerta"],
    ["resumen", "El resumen en vivo"],
    ["reembolsos", "Reembolsos"],
    ["dinero", "Dinero, costos y el reporte"],
    ["historial", "Tu historial"],
    ["varias", "¿Tocás en más de una banda?"],
    ["borrar", "Borrar la cuenta"],
    ["preguntas", "Preguntas frecuentes"],
  ];
  return (
    <LegalDoc
      title="Guía para bandas — Coverr"
      description="Cómo usar Coverr de principio a fin: crear tu banda, vender la preventa, la puerta, reembolsos y el reparto al final de la noche."
      heading="Guía para bandas"
      updated={BAND_GUIDE_UPDATED}
      canonical={`${origin}/guia`}
    >
      <p>
        Todo lo que necesitás para vender tu próximo toque con Coverr, de la preventa a la plata
        repartida. Si algo no está aquí, escribinos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      <ol>
        {sections.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`}>{label}</a>
          </li>
        ))}
      </ol>

      <h2 id="que-es">Qué es Coverr</h2>
      <p>
        Coverr es la preventa, la entrada y el reparto de tu banda en un solo lugar. Tus fans
        compran por transferencia <b>directo a tu cuenta</b>, suben la captura y reciben su código
        QR al instante. En la puerta, tu staff escanea los códigos con el teléfono, aunque no haya
        señal. Al final de la noche, Coverr suma todo y te dice cuánto le toca a cada integrante.
      </p>
      <p>
        <b>Coverr nunca toca tu dinero.</b> Cada lempira va de tu fan a tu cuenta. Nosotros solo
        llevamos el registro.
      </p>

      <h2 id="empezar">Crear tu banda y entrar</h2>
      <ol>
        <li>
          Entrá a <a href="/registro">coverr.live/registro</a>, escribí el nombre de tu banda y tu
          correo, y tocá <b>Crear</b>.
        </li>
        <li>
          Te llega un correo <b>"Crear … en Coverr"</b>, con el nombre de tu banda. Tocá{" "}
          <b>Crear la banda</b> en el correo y otra vez en la página que se abre: ahí se crea la
          banda y entrás a su panel. El enlace sirve una sola vez y vence en 15 minutos.
        </li>
        <li>
          No hay contraseña. Para volver a entrar otro día, andá a{" "}
          <a href="/admin/acceso">coverr.live/admin/acceso</a> y pedí un enlace nuevo.
        </li>
      </ol>
      <p>
        ¿No llega el correo? Revisá <b>Promociones</b> y <b>Spam</b> en Gmail. Si pedís muchos
        enlaces seguidos, esperá un minuto: por seguridad hay un límite.
      </p>
      <p>
        Arriba de tu panel siempre vas a ver <b>Eventos · + Evento · Banda · Ayuda · Salir</b>.
        Dentro de un evento aparece una segunda barra:{" "}
        <b>Resumen · Órdenes · Venta · Dinero · Ajustes</b>.
      </p>

      <h2 id="cuentas">Tus cuentas bancarias</h2>
      <p>
        En <b>Banda → Cuentas bancarias</b>, elegí el banco, escribí el número de cuenta y el
        titular, y tocá <b>Agregar</b>.
      </p>
      <ul>
        <li>
          <b>Agregá una cuenta por banco.</b> Al comprador le mostramos la cuenta de su mismo banco,
          así no paga comisión por transferir a otro banco.
        </li>
        <li>
          La primera cuenta que agregás es la <b>principal</b>: es la que ve quien paga desde un
          banco donde no tenés cuenta.
        </li>
        <li>Revisá bien el número: es lo que tus fans van a copiar para pagarte.</li>
      </ul>

      <h2 id="integrantes">Integrantes, reparto y adelantos</h2>
      <p>
        En <b>Banda → Integrantes y reparto</b> ponés quién está en la banda y qué porcentaje le
        toca del neto de cada evento.
      </p>
      <ul>
        <li>
          Escribí cada nombre con su porcentaje en una fila y tocá <b>Guardar reparto</b>. Si
          necesitás más filas, tocá <b>+ Otra fila</b>.
        </li>
        <li>
          <b>Tiene que sumar 100%.</b> Si una parte se queda para la banda (para equipo, gasolina,
          lo que sea), agregá una fila <b>"Fondo de la banda"</b> con ese porcentaje.
        </li>
        <li>
          Para sacar a alguien, marcá <b>Quitar</b> en su fila y guardá. Si esa persona tiene
          adelantos anotados, primero quitá los adelantos.
        </li>
      </ul>
      <p>
        <b>Adelantos:</b> si a alguien ya le diste plata antes del reparto, anotalo en{" "}
        <b>Adelantos</b> (integrante, evento y monto). Se le descuenta de su parte cuando se
        reparte.
      </p>

      <h2 id="evento">Crear y publicar un evento</h2>
      <p>
        Tocá <b>+ Evento</b> y llená:
      </p>
      <ul>
        <li>
          <b>Nombre</b> y <b>Lugar</b> del toque.
        </li>
        <li>
          <b>Empieza</b> (fecha y hora) y <b>Puertas</b> (opcional). Puertas tiene que ser antes de
          que empiece, y como mucho 12 horas antes.
        </li>
        <li>
          <b>Preventa (L)</b> y <b>Taquilla (L)</b>: los dos precios, mayores que cero.{" "}
          <b>La preventa se acaba sola</b> cuando llega la hora de puertas o cuando se vende el{" "}
          <b>Límite de preventa</b> (si pusiste uno). Desde ahí el enlace cobra el precio de
          taquilla.
        </li>
        <li>
          <b>Brazaletes que llevás</b> y <b>Cupo máximo</b> (opcionales): sirven para cuadrar en la
          puerta y para no vender de más.
        </li>
        <li>
          <b>Política</b>: <b>Sin reembolsos</b> o <b>Reembolso dentro de 24 horas</b>. El comprador
          la ve antes de pagar y queda guardada en su compra.
        </li>
        <li>
          <b>Mensaje de agradecimiento</b> (opcional): sale en la confirmación de compra y en el
          correo del boleto.
        </li>
      </ul>
      <p>
        Tocá <b>Crear evento</b>. Se crea como <b>borrador</b>: nadie puede comprar todavía. En{" "}
        <b>Ajustes → Estado y enlaces</b>, tocá <b>Publicar y abrir la venta</b> y copiá el enlace
        con <b>Copiar</b>. Ese enlace es el que va en el flyer, la bio y WhatsApp.
      </p>

      <h2 id="comprador">Lo que ve quien compra</h2>
      <p>Tus fans no crean cuenta. En el enlace del evento:</p>
      <ol>
        <li>Eligen cuántos boletos.</li>
        <li>Eligen su banco y ven tu cuenta, lista para copiar.</li>
        <li>Transfieren desde su app del banco y suben la captura o el PDF del comprobante.</li>
        <li>Ponen su nombre, correo y teléfono, y el nombre de cada persona que entra.</li>
        <li>
          Tocan <b>Confirmar compra</b> y <b>reciben su QR al instante</b>, en pantalla y por correo
          ("Tu boleto — …", a veces en Promociones).
        </li>
      </ol>
      <p>
        Si alguien pierde su boleto, lo recupera en <a href="/recuperar">coverr.live/recuperar</a>{" "}
        con el correo con que compró.
      </p>

      <h2 id="ordenes">Órdenes: OK y REVISAR</h2>
      <p>
        En <b>Órdenes</b> ves cada compra. Unos segundos después de cada compra, Coverr lee el
        comprobante y lo compara con lo que esperaba: tu cuenta, el monto y que no se haya usado
        antes.
      </p>
      <ul>
        <li>
          <b>OK</b>: todo cuadra.
        </li>
        <li>
          <b>REVISAR</b>: algo no cuadra. El QR ya se entregó igual (el comprador nunca se queda
          esperando); esto es para que vos lo revisés. Tocá la orden y vas a ver el motivo:
          <ul>
            <li>
              <b>Pagó de menos</b> o <b>Pagó de más</b>: el monto no coincide.
            </li>
            <li>
              <b>Comprobante repetido</b> o <b>Referencia repetida</b>: esa misma transferencia ya
              se usó en otra compra.
            </li>
            <li>
              <b>Otra cuenta</b>: la transferencia fue a una cuenta que no es tuya.
            </li>
            <li>
              <b>Transferencia vieja</b>, <b>No se pudo leer</b> o <b>No es un comprobante</b>:
              revisalo a mano.
            </li>
          </ul>
        </li>
        <li>
          <b>"Pagó otra persona"</b> es solo una nota, no un problema: es normal que alguien pague
          por un grupo.
        </li>
      </ul>
      <p>
        Por los dos casos graves (comprobante o referencia repetidos, y plata a otra cuenta) te
        llega además un correo <b>"Revisar …"</b>. Cuando ya lo revisaste en tu banco, tocá{" "}
        <b>Revisado y resuelto</b>. Si una orden nunca se pagó, <b>Anular esta orden</b> invalida
        sus QR y la saca de los totales.
      </p>
      <p>
        <b>Para pasarle un boleto a otra persona</b>, cambiá el nombre en <b>Asistentes</b> y tocá{" "}
        <b>Guardar</b>. El QR sigue siendo el mismo.
      </p>

      <h2 id="venta">Ventas manuales y cortesías</h2>
      <p>
        En <b>Venta</b> registrás lo que vendiste fuera del enlace: en el ensayo, a un amigo, a
        cuenta del sonido. Escribí quiénes entran (un nombre por línea), cuánto cobraste y tocá{" "}
        <b>Registrar venta</b>. Con <b>Ver los códigos QR</b> los podés mostrar o compartir, y si
        ponés un correo en <b>Contacto</b>, se los mandamos.
      </p>
      <p>
        <b>Cortesías:</b> poné el precio en <b>0</b>. Cuentan para la asistencia pero no para la
        plata, y nunca suben tu tramo de cobro.
      </p>

      <h2 id="puerta">La puerta</h2>
      <p>
        Cada evento ya trae su enlace de puerta. En <b>Ajustes → Enlace del personal de puerta</b>,
        tocá <b>Copiar</b>. Mandáselo solo a tu staff: quien lo tenga puede registrar entradas. Si
        alguien deja de trabajar con vos, tocá <b>Generar uno nuevo</b> y el anterior deja de
        servir.
      </p>
      <p>
        Abrilo en el teléfono de la puerta <b>antes de que empiece</b>, con señal: descarga la lista
        completa y desde ahí <b>funciona sin internet</b>. Arriba ves si está <b>Sincronizado</b> o{" "}
        <b>Sin conexión</b>, y los contadores <b>Adentro</b>, <b>Vendidos</b> y <b>Brazaletes</b>.
      </p>
      <ul>
        <li>
          <b>Escanear</b>: tocá <b>Abrir cámara</b> y apuntá al QR.
          <ul>
            <li>
              <b>Verde, Adelante</b>: puede pasar.
            </li>
            <li>
              <b>Rojo, Ya entró</b>: ese boleto ya se escaneó, y te dice a qué hora. Revisá el
              brazalete.
            </li>
            <li>
              <b>Rojo, No encontrado</b>: el código no es de este evento.
            </li>
            <li>
              <b>Rojo, Boleto anulado</b>: esa compra se reembolsó o se anuló.
            </li>
            <li>
              <b>Amarillo, Revisar antes de dejar pasar</b>: la compra tiene algo por revisar y te
              dice qué. Pedile a la persona que te muestre su transferencia en la app del banco. Si
              está bien, <b>Verificar y dejar pasar</b>; si no, <b>No dejar pasar</b> (puede comprar
              en la puerta).
            </li>
          </ul>
        </li>
        <li>
          <b>Buscar</b>: para quien no encuentra su QR. Buscá su nombre y registralo.
        </li>
        <li>
          <b>Efectivo</b>: <b>Registrar venta</b> y confirmá con <b>Ya cobré — registrar</b>. Para
          alguien que entra gratis, <b>Registrar cortesía</b>.
        </li>
      </ul>
      <p>
        Si dos teléfonos sin señal escanean el mismo boleto, se marca cuando vuelven a tener
        internet. Por eso el brazalete sigue siendo el control de verdad en la puerta.
      </p>

      <h2 id="resumen">El resumen en vivo</h2>
      <p>
        <b>Resumen</b> te muestra la noche mientras pasa: cuántos están adentro, cuántos boletos se
        vendieron, los brazaletes y el bruto. Abajo, cuánto entró por cada canal (preventa, taquilla
        por transferencia, efectivo, ventas manuales, cortesías) y por cada banco, para cuadrar con
        lo que llegó a tus cuentas. Si hay comprobantes por revisar, te avisa arriba.
      </p>

      <h2 id="reembolsos">Reembolsos</h2>
      <p>
        Si tu evento tiene <b>Reembolso dentro de 24 horas</b>, el comprador puede pedirlo desde su
        boleto o su correo. Te llega un correo <b>"Solicitud de reembolso"</b>. En la orden, tocá{" "}
        <b>Aprobar y anular los boletos</b> o <b>Rechazar</b>.
      </p>
      <p>
        También podés reembolsar vos desde la orden, marcando los boletos y escribiendo el motivo.
        El boleto deja de servir en la puerta y la orden queda en tu historial como{" "}
        <b>REEMBOLSADA</b>. <b>La plata la devolvés vos desde tu banco</b>: Coverr nunca la tuvo.
      </p>

      <h2 id="dinero">Dinero, costos y el reporte</h2>
      <p>
        En <b>Dinero</b>, anotá cada costo del evento (sonido, local, arte…) con <b>Agregar</b>.
        Coverr calcula el <b>Bruto</b> (todo lo que entró), los <b>Costos</b> y el <b>Neto</b>, y lo
        reparte según los porcentajes de tus integrantes, descontando adelantos.
      </p>
      <p>
        <b>Lo único que se cobra es ese reporte de reparto</b>, una vez por evento y cuando el toque
        ya pasó. La preventa, los QR, la puerta, el efectivo, el resumen en vivo y tu historial son
        gratis, siempre.
      </p>
      <ul class="rows">
        <li>
          <strong>Tu primer evento</strong>
          <span>gratis, si es a más tardar el {freeFirstEventLastDay({ year: true })}</span>
        </li>
        <li>
          <strong>1 – 60 boletos</strong>
          <span>{bracket(60)}</span>
        </li>
        <li>
          <strong>61 – 150</strong>
          <span>{bracket(150)}</span>
        </li>
        <li>
          <strong>151 – 300</strong>
          <span>{bracket(300)}</span>
        </li>
        <li>
          <strong>301 – {LARGE_SHOW_FROM}</strong>
          <span>{bracket(LARGE_SHOW_FROM)}</span>
        </li>
        <li>
          <strong>{LARGE_SHOW_FROM + 1} o más</strong>
          <span>
            {bracket(LARGE_SHOW_FROM)}, más {formatLpsShort(LARGE_SHOW_PER_TICKET)} por cada boleto
            arriba de {LARGE_SHOW_FROM}
          </span>
        </li>
      </ul>
      {billingEnabled ? null : (
        <p>
          <b>Por ahora el reporte también es gratis</b>: lo ves completo sin pagar. Cuando empecemos
          a cobrarlo te avisamos con tiempo, y funciona como sigue.
        </p>
      )}
      <p>
        Para abrir un reporte que se cobra, transferí el monto a la cuenta de Coverr que te muestra
        la página y subí la captura. <b>El reporte se abre en ese momento</b> y no se vuelve a
        cerrar. Si después la transferencia no aparece y no se resuelve hablándolo, no vas a poder
        crear ni publicar eventos, ni abrir otro reporte pagado, hasta pagarlo. Lo que ya está a la
        venta sigue vendiendo.
      </p>

      <h2 id="historial">Tu historial</h2>
      <p>
        <b>Eventos</b>, la primera página de tu panel, junta todo lo que has hecho: el acumulado,
        gráficas de cómo vienen tus eventos (personas, bruto, costos y neto), el último evento
        contra el anterior, cada evento con sus números, en qué gastás más, y <b>Tu gente</b>:
        cuántas personas distintas te han visto y cuántas repiten. Nunca se bloquea.
      </p>

      <h2 id="varias">¿Tocás en más de una banda?</h2>
      <p>
        Con un mismo correo podés llevar varias bandas. Cada una tiene sus propios eventos, cuentas,
        integrantes y plata; no se mezclan.
      </p>
      <ul>
        <li>
          Para crear otra, tocá el <b>nombre de tu banda</b> arriba a la izquierda del panel: ahí
          está <b>Tus bandas</b>, con <b>Crear otra banda</b>. También podés registrarla en{" "}
          <a href="/registro">coverr.live/registro</a> con el mismo correo y otro nombre.
        </li>
        <li>
          Para pasar de una a otra, entrá a <b>Tus bandas</b> y tocá <b>Entrar</b> en la que querés.
          Cuando pedís un enlace para entrar, te lleva directo a esa lista.
        </li>
        <li>
          Si una de tus bandas tiene un pago de reporte pendiente, ninguna puede crear eventos
          nuevos hasta pagarlo. Y si una banda tuya está suspendida, ese correo no puede crear
          bandas nuevas; las otras siguen funcionando.
        </li>
      </ul>

      <h2 id="borrar">Borrar la cuenta</h2>
      <p>
        En <b>Banda → Borrar la cuenta…</b> te mostramos exactamente qué se borra (eventos, órdenes,
        boletos y comprobantes) y lo confirmás escribiendo el nombre de la banda. No se puede
        deshacer.
      </p>
      <p>
        Mientras tengas un evento que todavía no pasó con boletos vendidos, o una solicitud de
        reembolso sin responder, no se puede borrar: esa gente ya te pagó. Un evento cuenta como
        pasado 12 horas después de que empieza.
      </p>

      <h2 id="preguntas">Preguntas frecuentes</h2>
      <h3>¿Coverr se queda con parte de la venta?</h3>
      <p>
        No. La plata va directo de tu fan a tu cuenta. Solo se cobra el reporte de reparto, con los
        precios de arriba.
      </p>
      <h3>Un fan dice que pagó y no tiene su QR.</h3>
      <p>
        El QR sale en pantalla apenas confirma la compra, y le llega por correo. Mandalo a{" "}
        <a href="/recuperar">coverr.live/recuperar</a>. En la puerta también lo pueden encontrar por
        nombre con <b>Buscar</b>.
      </p>
      <h3>Alguien pagó de menos.</h3>
      <p>
        La orden sale en <b>REVISAR</b> con "Pagó de menos" y cuánto falta. Escribile (el correo y
        el teléfono están en la orden) y, cuando lo resuelvan, tocá <b>Revisado y resuelto</b>.
      </p>
      <h3>¿Necesito internet en la puerta?</h3>
      <p>
        Solo para abrir el enlace de la puerta antes de empezar. Después funciona sin señal y se
        sincroniza cuando vuelve.
      </p>
      <h3>Me equivoqué en la cuenta bancaria de un evento que ya está a la venta.</h3>
      <p>
        En <b>Ajustes</b>, tocá <b>Cerrar la venta</b>, corregí la cuenta en <b>Banda</b> y volvé a
        abrirla con <b>Publicar y abrir la venta</b>. Escribinos si alguien ya pagó a la cuenta
        equivocada.
      </p>
      <h3>¿Puedo cambiar el precio después de publicar?</h3>
      <p>
        Sí, en <b>Ajustes</b>. Solo afecta a las compras nuevas: quien ya compró pagó lo que vio.
      </p>
      <h3>¿A quién le escribo?</h3>
      <p>
        A <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Respondemos personas, no un
        robot.
      </p>
    </LegalDoc>
  );
};

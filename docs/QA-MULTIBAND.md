# Multi-band test

Two bands, two buyers, a door and the operator, all on **production** (`coverr.live`), so that
email, receipt reading, rate limits and the bank transfers are all real. Every step says
**where** to go, what to **do**, and what you should **see**. Tick a step only when you saw
exactly that; otherwise write down what happened instead.

The point is what a one-band test cannot show: that bands never see each other, that the door
only knows its own event, and that the operator's switches act on the right band.

- **People:** Armando and Alexis, each with a phone; one laptop for the operator. A third phone
  for the door helps but is not required.
- **Time:** about two hours.
- **Money:** four L1 transfers and one L5, all between your own two BAC accounts.
- **Leave alone:** your real band (Daydrinking). Everything here uses two new test bands, deleted
  at the end.

## Cast

| Role | Who | Email | Bank account |
|---|---|---|---|
| **Banda A** — "Prueba A" | Armando | `mvillafranca98+bandaa@gmail.com` | Alexis's BAC |
| **Banda B** — "Prueba B" | Alexis | `a.mencias99+bandab@gmail.com` | Alexis's BAC |
| Buyer of Banda A | Armando | `mvillafranca98+compraa@gmail.com` | pays from Armando's BAC |
| Buyer of Banda B | Armando | `mvillafranca98+comprab@gmail.com` | pays from Armando's BAC |
| Door staff, Banda A | whoever has the spare phone | — | — |
| Operator | Armando, on the laptop | `mvillafranca98@gmail.com` at `/operador` | — |

A `+something` alias lands in the same Gmail inbox but counts as a different address to Coverr,
which is what lets one person run a band and buy from another. Both bands collect into Alexis's
BAC account, so every buyer transfer goes from Armando's BAC to Alexis's, and Armando buys from
both bands with a different alias for each.

**Three habits for the whole test:**

- **Check Promotions.** Gmail often files Coverr's mail there. Look in Promotions and Spam before
  failing an email step.
- **Go slowly with emails.** Coverr allows 5 emails a minute per network. Wait about 15 seconds
  between sign-in links or purchases on the same wifi, or you will see "Demasiados intentos
  seguidos" and think something broke.
- **Where things live in the band panel.** The top bar has **Eventos · + Evento · Banda · Ayuda · Salir**.
  Inside an event, a second bar has **Resumen · Órdenes · Venta · Dinero · Ajustes**.

---

## Part 0 — Before you start (Armando, laptop)

- [ ] **0.1 Coverr's accounts are ready**
  - **Where:** `coverr.live/operador/acceso` → type `mvillafranca98@gmail.com` → **Enviar
    enlace** → open the email "Entrar a Coverr" → **Entrar** → **Entrar** again on the page it
    opens. Then **Cuentas** in the top bar.
  - **Do:** make sure all three accounts are listed: the company's (INVERSIONES ALFRAM S. DE
    R.L.), Armando's and Alexis's. If the company's doesn't say **PRINCIPAL**, tap **Hacer
    principal** on it.
  - **See:** three rows, the company's marked **PRINCIPAL**. This matters in Part 7: a band is
    shown the Coverr account at its own bank, and with several there, the main one. Banda B
    banks at BAC, so it must be shown the company's account, not Alexis's own.
- [ ] **0.2 Billing is off**
  - **Where:** `coverr.live/terminos`, section **Qué cuesta**.
  - **See:** a paragraph starting "**Por ahora el reporte también es gratis**". Leave it off until Part 7.

## Part 1 — Two bands sign up (each on their own phone)

- [ ] **1.1 Sign up**
  - **Where:** `coverr.live/registro`.
  - **Do:** band name "Prueba A" (Armando) or "Prueba B" (Alexis), your band's alias, **Crear**.
  - **See:** a page "Revisá tu correo". Within a minute an email from **Coverr
    &lt;hola@coverr.live&gt;** with the subject "Crear Prueba A en Coverr" (or B). Its **Crear
    la banda** button opens a page with one more **Crear la banda**, which creates the band and
    opens its panel. The band does not exist until that tap. Note which Gmail tab it landed in.
- [ ] **1.2 The welcome box reads well**
  - **Where:** the panel's first page (**Eventos**).
  - **See:** a yellow box "Te falta poco para vender" with three steps: Agregá tu cuenta
    bancaria, Agregá a los integrantes, Creá tu primer evento. Each explanation after the dash is
    in **black**, easy to read.
- [ ] **1.3 Bank account and members**
  - **Where:** **Banda** in the top bar.
  - **Do:**
    - Under **Cuentas bancarias**: Banco "BAC Credomatic", **Alexis's** account number and name
      on both bands, so buyer transfers go from Armando's BAC to Alexis's → **Agregar**.
    - Under **Integrantes y reparto**: one member at 60 and one at 40 in the empty rows →
      **Guardar reparto**. Try 60 and 30 first: it's refused with "Los porcentajes suman 90%…"
      and the rows keep what you typed.
  - **See:** the account listed, and the two members saved with the footer reading **100%**.
- [ ] **1.4 Create and publish the event**
  - **Where:** **+ Evento**.
  - **Do:** fill in **Nombre**, **Lugar**, **Empieza**, **Preventa (L)** `1`, **Taquilla (L)**
    `2`, capacity `20`, and **Política** "Reembolso dentro de 24 horas". Then **Crear evento**.
    - **Banda A, Empieza:** today, a few hours from now.
    - **Banda B, Empieza:** **Saturday 6 February 2027, 8:00pm**. It has to be after January 31
      so the free first-event offer doesn't cover it; Part 7 needs it to cost something.
  - **See:** you land on the event's **Ajustes**, under **Estado y enlaces**, with "Todavía no
    está publicado". Tap **Publicar y abrir la venta**. It now says "La venta está abierta. Este
    es el enlace que va en el flyer o la bio", with a **Copiar** button. Copy the link and send
    it to the other person on WhatsApp.
- [ ] **1.5 Signing up twice with the same name doesn't make a twin**
  - **Where:** `coverr.live/registro` again, same alias, the **same** band name.
  - **See:** the same "Revisá tu correo" page, and a sign-in email "Entrar a Coverr" for your
    existing band, not a creation link. (A **different** name would create a second band under
    the same email, which is allowed: see the band guide, "¿Tocás en más de una banda?".)
    In Part 6 the operator list must show only one "Prueba A" and one "Prueba B".

## Part 2 — Buying (buyers on their phones)

Armando buys from both bands, each with its own link and its own buyer alias from the Cast
table, paying from Armando's BAC into Alexis's account. Do 2.1 to 2.3 **for both bands**; 2.4
and 2.5 only on Banda A.

- [ ] **2.1 A normal purchase**
  - **Where:** the sale link from 1.4.
  - **Do:**
    - **¿Cuántos boletos?** 1.
    - **¿Con qué banco vas a pagar?** BAC. The page shows the band's account: copy it, and in
      your BAC app transfer **L1** to it.
    - **Subí tu comprobante:** the screenshot of that transfer.
    - **Tus datos:** your name, the buyer alias from the Cast table, your phone.
    - **¿Quiénes entran?** your name.
    - Tick the terms box → **Confirmar compra**.
  - **See:** straight away, a page "¡Listo, ya estás adentro!" with the QR, a short code,
    **Compartir** and **Descargar**, and a link "Solicitar un reembolso". The QR appears before
    any checking happens, by design.
- [ ] **2.2 The ticket email**
  - **Where:** the buyer's inbox (check Promotions).
  - **See:** within a minute, "Tu boleto — <event name>" (or "Tus 2 boletos — …") from Coverr,
    with the QR **image showing** in Gmail.
- [ ] **2.3 The band sees the order as clean**
  - **Where:** the band's phone → the event → **Órdenes**.
  - **See:** the order's row with a green **OK** chip. It shows OK from the start, because
    nothing has been flagged yet: refresh after two minutes, once the receipt has been read, and
    it should still say OK.
- [ ] **2.4 Banda A only: paying too little**
  - **Do:** buy **2** tickets, but transfer and upload only **L1**.
  - **See:**
    - The buyer still gets the QRs immediately.
    - In **Órdenes**, within two minutes, that order shows a yellow **REVISAR** chip. Tapping it
      shows "Faltan L1 — pagó L1 de L2".
    - **No email.** A short payment is a warning, shown only in the panel; only a critical
      problem (a reused receipt, money sent to another account) emails the band.
- [ ] **2.5 Banda A only: reusing a screenshot**
  - **Do:** buy 1 ticket and upload **the same screenshot file as 2.1**, not a new screenshot of
    it. No new transfer.
  - **See:** the QR still appears. Within two minutes Armando gets an email "Revisar <code> —
    <event>" at Banda A's address, saying that receipt was already received on the 2.1 order, and
    the order shows **REVISAR**.
- [ ] **2.6 Getting tickets back**
  - **Where:** `coverr.live/recuperar`.
  - **Do:**
    1. The buyer alias → submit.
    2. Then an address that never bought, e.g. `mvillafranca98+nadie@gmail.com`.
  - **See:** both times, the same message "Si ese correo tiene boletos, ya te los enviamos…".
    Only the first one gets an email with the tickets.

## Part 3 — Bands cannot see each other (the most important part)

**Alexis**, in Banda B's panel, copies three addresses from the browser's address bar and sends
them to Armando:

- the event's **Resumen**: `coverr.live/admin/e/<slug-B>`;
- one order: tap a row in **Órdenes** to get `…/orden/<id>`;
- that order's receipt image: on the order page, under "Lo que dice el comprobante", open the
  image on its own and copy its address, ending in `/comprobante`.

- [ ] **3.1 Banda A can't open Banda B's pages**
  - **Where:** Armando, **signed in as Banda A**, pastes each address into the browser. Then
    takes the event address and adds each ending in turn: `/ordenes`, `/ordenes.csv`,
    `/dinero`, `/ajustes`, `/venta`.
  - **See:** **every one** shows "**No encontramos esta página**". Never Banda B's name, buyers,
    numbers or receipt.
- [ ] **3.2 Mixing an id into Banda A's own event doesn't work either**
  - **Do:** take Banda A's own event address and add `/orden/<id-from-Banda-B>`.
  - **See:** "No encontramos esta página".
- [ ] **3.3 Same thing the other way**
  - **Do:** Armando sends Alexis Banda A's event address; Alexis, as Banda B, opens it and adds
    `/ordenes`.
  - **See:** "No encontramos esta página".
- [ ] **3.4 The door only knows its own event** (do this during Part 4)
  - **Do:** with Banda A's door link, scan **Banda B's QR** (from Armando's 2.1 purchase).
  - **See:** red, "**No encontrado** — Este código no es de este evento". Also, searching Banda
    B's buyer by name in **Buscar** finds nothing.
- [ ] **3.5 A band can't reach the operator panel**
  - **Do:** on a band's phone, open `coverr.live/operador`.
  - **See:** the operator sign-in page ("Operación"), never the list of bands.

## Part 4 — The door (Banda A, door phone)

- [ ] **4.1 Open the door scanner**
  - **Where:** Banda A → event → **Ajustes** → "Enlace del personal de puerta" → **Copiar**
    (every event is created with its door link). It warns that the link is only for staff;
    accept. Open that link on the door phone.
  - **See:**
    - the event name, with venue · band underneath;
    - a status badge reading "Lista descargada · listo", then **Sincronizado**;
    - three counters: **Adentro**, **Vendidos**, **Brazaletes**;
    - three tabs: **Escanear**, **Buscar**, **Efectivo**.
- [ ] **4.2 A good ticket**
  - **Do:** **Escanear → Abrir cámara**, allow the camera, then scan the QR from 2.1 off the
    buyer's phone.
  - **See:** green, "**Adelante**" and the buyer's name. **Adentro** goes up by one.
- [ ] **4.3 The same ticket twice**
  - **Do:** scan the same QR again.
  - **See:** red, "**Ya entró**", the name, and "Registrado a las HH:MM · revisá el brazalete".
- [ ] **4.4 A ticket under review**
  - **Do:** scan a QR from 2.4 or 2.5.
  - **See:** a screen "**Revisar antes de dejar pasar**" showing the **reason** (short payment or
    reused receipt), with buttons **Verificar y dejar pasar** and **No dejar pasar**. Choose
    **Verificar y dejar pasar**.
- [ ] **4.5 Finding someone by name**
  - **Do:** **Buscar** → type the buyer's name → tap the button on an unscanned ticket.
  - **See:** it registers, and **Adentro** goes up.
- [ ] **4.6 Cash at the door**
  - **Do:** **Efectivo** → leave 1 → **Registrar venta** → confirm **Ya cobré — registrar**.
  - **See:** a confirmation line under the buttons; **Vendidos** and **Adentro** go up by one.
- [ ] **4.7 A comp**
  - **Do:** **Efectivo** → **Registrar cortesía** → confirm.
  - **See:** **Adentro** goes up. Later, Resumen counts it under Cortesías with **L0**.
- [ ] **4.8 Offline**
  - **Do:**
    1. Turn on airplane mode. The badge changes to "Sin conexión…".
    2. Scan a ticket not yet scanned: green **Adelante** anyway.
    3. Turn airplane mode off.
  - **See:** within a minute the badge goes back to **Sincronizado**, and Banda A's Resumen
    counts that entry.
- [ ] **4.9 The numbers add up**
  - **Where:** Banda A → event → **Resumen**.
  - **See:** **Adentro** equals every person let in during 4.2 to 4.8. Under **Ingresos por
    canal**, Preventa shows the online tickets, "Taquilla — efectivo" shows 1 person / L2, and
    Cortesías shows 1 / L0. Nothing typed by hand; it's all from the scans.

## Part 5 — Money and refunds (Banda A)

- [ ] **5.1 The report**
  - **Where:** event → **Dinero**.
  - **Do:** under **Costos**, add "Sonido", category Sonido, `2` → **Agregar**. Keep it small:
    the test only took in a few lempiras, and a bigger cost makes every share negative.
  - **See:** under **Reparto**, **Bruto** minus **Costos** (−L2) equals **Neto**, and the two
    members at 60% and 40% split Neto with no "Sin asignar" row. Billing is off, so nothing is
    locked.
- [ ] **5.2 A refund**
  - **Do:**
    1. On the buyer's ticket page from 2.1 (the link is in the ticket email too), tap
       **Solicitar un reembolso**, write a reason, **Enviar solicitud**.
    2. Armando gets "Solicitud de reembolso — <code>". On that order, under "Solicitud de
       reembolso", tap **Aprobar y anular los boletos**.
  - **See:**
    - that ticket now scans red at the door: "**Boleto anulado** — Esta compra fue reembolsada"
      (reload the door link first);
    - Resumen's totals drop by L1;
    - the order is still listed in **Órdenes**, with a red **REEMBOLSADA** chip, not deleted.

## Part 6 — The operator (Armando, laptop, `coverr.live/operador`)

- [ ] **6.1 Both bands are listed**
  - **Where:** **Bandas**.
  - **See:** "Prueba A" and "Prueba B" once each, with their aliases, 1 event each, their paid
    tickets, and today's date as last activity. Typing "prueba" in the search box finds both.
- [ ] **6.2 Free pass for Banda A**
  - **Where:** tap "Prueba A" → **Pase libre**.
  - **Do:** leave **Hasta** empty, write a note in **Para qué es** → **Dar pase libre**.
  - **See:** "Pase libre guardado.", a green **PASE LIBRE** chip by the name, and a line in
    **Historial** with your address.
- [ ] **6.3 Promo for Banda B**
  - **Where:** "Prueba B" → **Promo**.
  - **Do:** **Descuento (%)** `99`, **Para cuántos reportes** `1`, leave the date empty, a note
    → **Dar promo**.
  - **See:** "Promo guardada…", a chip "PROMO 99% · 1", and a line in Historial.
- [ ] **6.4 Suspending Banda B**
  - **Do:** "Prueba B" → **Suspensión** → a **Motivo** → **Suspender banda**.
  - **See (Alexis):**
    - The next tap in Banda B's panel signs out, with "**Esta cuenta está suspendida.** Si
      creés que es un error, escribinos a hola@coverr.live".
    - Asking for a sign-in link at `coverr.live/admin/acceso` brings an email "Tu cuenta de
      Coverr está suspendida" instead of a link.
    - Banda B's sale link now shows "Esta venta no está abierta".
  - **See (still working):** Armando's ticket for Banda B, and Banda B's door link, if one was
    made.
- [ ] **6.5 Reactivating**
  - **Do:** "Prueba B" → **Reactivar banda**.
  - **See:** Alexis can sign in again and Banda B's sale link sells again. **Historial** shows
    every change from 6.2 to 6.5 with your address.

## Part 7 — Paying the fee (billing on for about 15 minutes)

- [ ] **7.1 Turn billing on**
  - **Where:** the terminal on your laptop, in the project folder.
  - **Do:**
    ```bash
    npx wrangler d1 execute coverr-db --remote --command "INSERT INTO platform_flags (key, enabled, note, changed_at) VALUES ('billing', 1, 'multi-band test', datetime('now')) ON CONFLICT(key) DO UPDATE SET enabled=1, note=excluded.note, changed_at=excluded.changed_at"
    ```
  - **See:** `/terminos` no longer says "Por ahora el reporte también es gratis".
- [ ] **7.2 Banda A: free thanks to the pass**
  - **Where:** Banda A → event → **Dinero**.
  - **See:** the **Bruto / Costos / Neto** cards still show, and the member table is replaced by
    a yellow box saying the split costs L500 "(pero tenés pase libre, así que no pagás)".
    **Desbloquear gratis** opens the member table.
- [ ] **7.3 Banda B pays L5**
  - **Where:** Banda B → event → **Dinero**.
  - **See:** the yellow box: "…cuesta L500 — con tu promo del 99%, **L5**". Under it, "Transferí
    L5 a esta cuenta y subí la captura", with **Banco** BAC Credomatic, **A nombre de**
    INVERSIONES ALFRAM S. DE R.L., **Monto** L5, and the company's account number with
    **Copiar**.
  - **Do:** Alexis transfers **L5** to that account, then **Captura de la transferencia** → the
    screenshot → **Subir y desbloquear**.
  - **See:** the member table opens straight away, under a green note "Recibimos la captura de
    tu pago y el reporte ya está abierto…".
- [ ] **7.4 The payment in the ledger**
  - **Where:** laptop → **Cobros**.
  - **See:**
    - Banda B's row reads **L5 (−99%)**; Banda A's row reads "Gratis · pase libre".
    - Within two minutes, Banda B's status is either **RECIBIDO** (the receipt checked out) or
      **POR REVISAR**, with an email "Pago por revisar — Prueba B" to every operator naming the
      reason (Armando gets it twice: once directly and once through `hola@`). Write down which one, and the reason if any.
- [ ] **7.5 The payment's own page**
  - **Do:** tap Banda B's status chip.
  - **See:** under "Lo que se leyó", the amount L5, the company's account, a reference and the date;
    under "Captura", the screenshot itself. Type an invoice number under **Factura** →
    **Guardar** → "Factura guardada." Back on **Cobros**, **Descargar CSV** contains that number.
- [ ] **7.6 Marking it unpaid, then paid**
  - **Do:** on the payment page, under "No se pagó: qué pasó", write a note → **Marcar no
    pagado**.
  - **See (Alexis):** **+ Evento** now shows "**Tenés un pago pendiente.** El reporte de <event>
    (L5) todavía no está pagado…" and no form. Banda B's sale link still sells, and its Dinero
    report stays open.
  - **Then:** **Marcar pagado**. Alexis's **+ Evento** shows the form again.
- [ ] **7.7 Turn billing off again**
  - **Do:**
    ```bash
    npx wrangler d1 execute coverr-db --remote --command "INSERT INTO platform_flags (key, enabled, note, changed_at) VALUES ('billing', 0, 'multi-band test done', datetime('now')) ON CONFLICT(key) DO UPDATE SET enabled=0, note=excluded.note, changed_at=excluded.changed_at"
    ```
  - **See:** `/terminos` says "Por ahora el reporte también es gratis" again.

## Part 8 (optional) — The sales kill switch

The runbook notes this has never been thrown in production. A quiet test window is the time.

- [ ] **8.1 Pause sales**
  - **Do:**
    ```bash
    npx wrangler d1 execute coverr-db --remote --command "INSERT INTO platform_flags (key, enabled, note, changed_at) VALUES ('sales', 0, 'kill switch test', datetime('now')) ON CONFLICT(key) DO UPDATE SET enabled=0, note=excluded.note, changed_at=excluded.changed_at"
    ```
  - **See:** Banda A's sale link says the sale is paused. Banda A's door link still scans.
- [ ] **8.2 Turn sales back on**
  - **Do:**
    ```bash
    npx wrangler d1 execute coverr-db --remote --command "INSERT INTO platform_flags (key, enabled, note, changed_at) VALUES ('sales', 1, 'kill switch test done', datetime('now')) ON CONFLICT(key) DO UPDATE SET enabled=1, note=excluded.note, changed_at=excluded.changed_at"
    ```
  - **See:** the sale link sells again.

## Part 9 — Clean up

- [ ] **9.1 Remove the pass and the promo**
  - **Where:** `/operador` → each band.
  - **Do:** **Quitar pase** on Prueba A, **Quitar promo** on Prueba B if it's still there (it was
    used up in 7.3).
- [ ] **9.2 Delete the test bands** (Prueba A, Prueba B, and any other you made, such as
  "prueba 4" from the several-bands check — never Daydrinking)
  - **Do:**
    1. Each band: event → **Ajustes** → set **Empieza** to **two days ago** and clear
       **Puertas** → **Guardar cambios**. An event with live tickets blocks deletion until 12
       hours after it starts, so "yesterday evening" may not be enough yet.
    2. Any open refund request: open the order → **Rechazar** (or **Aprobar**). An unanswered
       one blocks deletion too.
    3. Then **Banda** → **Borrar la cuenta…** → type the band's name to confirm → delete. A
       band with no event, or none with tickets, skips straight to this step.
  - **See:** a page confirming the account is gone. Opening an old sign-in link only leads back
    to the sign-in page.
- [ ] **9.3 Nothing is left behind**
  - **Where:** `/operador`.
  - **See:** neither test band in **Bandas**, and Banda B's L5 row gone from **Cobros**: deleting
    a band deletes its fee history with it.
- [ ] **9.4** Send the L1s and the L5 back between yourselves, if you like.

---

## What to send me

For anything that failed: the step number, what you expected, what happened, and a screenshot.
Also note how long the emails in 1.1, 2.2 and 7.4 took, and which Gmail tab each landed in.

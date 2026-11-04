# Multi-band test

Two bands, two buyers, a door and the operator, all on **production** (`coverr.live`), so that
email, receipt reading, rate limits and the bank transfers are all real. Every check has a pass
condition: tick it or write down what happened instead.

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
| **Banda A** — "Prueba A" | Armando | `mvillafranca98+bandaa@gmail.com` | Armando's BAC |
| **Banda B** — "Prueba B" | Alexis | `a.mencias99+bandab@gmail.com` | Alexis's BAC |
| Buyer of Banda A | Alexis | `a.mencias99+compra@gmail.com` | pays from Alexis's BAC |
| Buyer of Banda B | Armando | `mvillafranca98+compra@gmail.com` | pays from Armando's BAC |
| Door staff, Banda A | whoever has the spare phone | — | — |
| Operator | Armando, on the laptop | `mvillafranca98@gmail.com` at `/operador` | — |

A `+something` alias lands in the same Gmail inbox but counts as a different address to Coverr,
which is what lets one person run a band and buy from another. Gmail may file Coverr's mail
under **Promotions**: look there before failing a step.

Don't request sign-in links or purchases faster than one every 15 seconds: email is limited to
5 a minute per network and you will be throttled into thinking something broke.

---

## Part 0 — Before you start

- [ ] **0.1** In `/operador/cuentas`, both BAC accounts are entered and **Armando's is the main
      one**. In Part 7 Banda B (Alexis) must be shown Armando's account; Alexis cannot pay
      himself.
- [ ] **0.2** Billing is **off**: `/terminos` says "Hoy el cobro está desactivado". It stays off
      until Part 7.

## Part 1 — Two bands sign up (each on their own phone)

- [ ] **1.1** At `coverr.live/registro`, sign up with your band's alias. The email arrives from
      **Coverr &lt;hola@coverr.live&gt;** within a minute, and its link opens the panel.
- [ ] **1.2** The yellow "Te falta poco para vender" box is readable: three steps, each with its
      explanation in black.
- [ ] **1.3** In **Banda**: add your own BAC account, and two members at 60% and 40%.
- [ ] **1.4** **+ Evento**, refund policy "24 horas", presale **L1**, door **L2**, capacity 20:
      - Banda A: **today**, a few hours from now.
      - Banda B: **Saturday 6 February 2027, 8pm** — after the free first-event offer ends, which
        Part 7 needs.

      Then **Ajustes → Publicar y abrir la venta**, and copy the sale link.
- [ ] **1.5** Sign up again with the same alias: the page says the same as before, a sign-in link
      arrives, and no second band appears in `/operador`.

## Part 2 — Buying (buyers on their phones)

Alexis buys from Banda A; Armando buys from Banda B. Do 2.1–2.3 for both bands.

- [ ] **2.1** Open the sale link, buy **1** ticket, transfer **L1** to the account the page shows,
      upload the screenshot. The QR is on screen **straight away**, before anything is checked.
- [ ] **2.2** The ticket email arrives within a minute, and its QR image shows in Gmail.
- [ ] **2.3** Within two minutes the band's **Órdenes** list shows the order as checked, with no
      flag.
- [ ] **2.4** On Banda A only: buy **2** tickets but transfer just **L1**. The QR still appears.
      Armando gets "Una compra necesita revisión" naming the short amount, and the order is
      flagged.
- [ ] **2.5** On Banda A only: buy again and upload **the screenshot from 2.1**. The QR still
      appears; the order is flagged as a reused screenshot.
- [ ] **2.6** `/recuperar` with the buyer's alias emails the tickets. With an address that never
      bought, the page says exactly the same and no email comes.

## Part 3 — Bands cannot see each other (the most important part)

Alexis sends Armando three links from Banda B's panel: the event (`/admin/e/<slug-B>`), one order
(`.../orden/<id>`), and that order's receipt image (`.../orden/<id>/comprobante`).

- [ ] **3.1** Signed in as **Banda A**, Armando opens each, plus `<slug-B>` followed by `/ordenes`,
      `/ordenes.csv`, `/dinero`, `/ajustes` and `/venta`. **Every one says "No encontramos esta
      página"**, never Banda B's data.
- [ ] **3.2** Banda A's own slug with Banda B's order id (`/admin/e/<slug-A>/orden/<id-B>`) also
      says "No encontramos esta página".
- [ ] **3.3** Reversed: Alexis, as Banda B, opens Banda A's event the same way and gets the same
      page.
- [ ] **3.4** Banda A's door link (Part 4) lists only Banda A's buyers; searching Banda B's buyer
      finds nothing.
- [ ] **3.5** A band's browser opening `/operador` gets the operator sign-in page, not the panel.

## Part 4 — The door (Banda A)

- [ ] **4.1** Banda A → event **Ajustes → Generar enlace**; open it on the door phone. The list
      loads and the status reads **SINCRONIZADO**.
- [ ] **4.2** Scan the QR from 2.1: green **Adelante**, with the buyer's name.
- [ ] **4.3** Scan it again: red, with the time of the first scan.
- [ ] **4.4** Scan a QR from 2.4 or 2.5: amber, with the reason written on screen.
- [ ] **4.5** **Buscar** by the buyer's name and let a ticket in from the list.
- [ ] **4.6** **Efectivo**: record one cash ticket at L2.
- [ ] **4.7** **Registrar cortesía**: record one comp.
- [ ] **4.8** Airplane mode on the door phone; scan a ticket not yet scanned: green. Airplane
      mode off: it syncs, and the dashboard counts that entry.
- [ ] **4.9** Banda A's **Resumen** matches what you did: tickets sold, inside, cash L2, one comp.

## Part 5 — Money and refunds (Banda A)

- [ ] **5.1** **Dinero**: add a cost. Gross, costs and net add up, and the split shows the two
      members at 60/40. Billing is off, so the whole report is open.
- [ ] **5.2** On the buyer's ticket page, **Solicitar un reembolso**. Armando gets the email.
      Approving it on the order voids that QR — the door now scans it red — and the totals drop.
      The order is still listed, with a negative line, not deleted.

## Part 6 — The operator (Armando, laptop, `/operador`)

- [ ] **6.1** **Bandas** lists both test bands, with the right events, paid tickets and last
      activity.
- [ ] **6.2** Banda A: **Dar pase libre**, no end date, with a note.
- [ ] **6.3** Banda B: **Dar promo**, 99%, 1 report, with a note.
- [ ] **6.4** Banda B: **Suspender** with a reason. Then, for Alexis:
      - his next click in the panel signs him out with "Esta cuenta está suspendida";
      - asking for a sign-in link brings the suspension email instead;
      - Banda B's sale link says "Esta venta no está abierta";
      - Armando's ticket for Banda B and Banda B's door link still work.
- [ ] **6.5** **Reactivar**. Sign-in and the sale link work again, and **Historial** shows every
      change with your address.

## Part 7 — Paying the fee (billing on for about 15 minutes)

- [ ] **7.1** Turn billing on, in the project folder:
      ```bash
      npx wrangler d1 execute coverr-db --remote --command "INSERT INTO platform_flags (key, enabled, note, changed_at) VALUES ('billing', 1, 'multi-band test', datetime('now')) ON CONFLICT(key) DO UPDATE SET enabled=1, note=excluded.note, changed_at=excluded.changed_at"
      ```
      `/terminos` no longer says "Hoy el cobro está desactivado".
- [ ] **7.2** Banda A, **Dinero**: "tenés pase libre, así que no pagás" and **Desbloquear
      gratis**. It opens the member split.
- [ ] **7.3** Banda B, **Dinero**: "con tu promo del 99%, L5", showing **Armando's** account.
      Alexis transfers **L5** and uploads the screenshot. The split opens at once, with
      "Recibimos la captura de tu pago".
- [ ] **7.4** `/operador/cobros`: Banda B's row reads **L5 (−99%)**. Within two minutes its status
      is **Recibido**, or **Por revisar** with an email to both of you naming the reason. Write
      down which, and the reason if any.
- [ ] **7.5** Open the payment: what was read matches the screenshot, and the screenshot itself
      shows. Save an invoice number; it appears in **Descargar CSV**.
- [ ] **7.6** **Marcar no pagado** with a note. Alexis's **+ Evento** now says "Tenés un pago
      pendiente" and offers no form, while Banda B's sale link still sells and its report stays
      open. **Marcar pagado**: the form is back.
- [ ] **7.7** Turn billing off again:
      ```bash
      npx wrangler d1 execute coverr-db --remote --command "INSERT INTO platform_flags (key, enabled, note, changed_at) VALUES ('billing', 0, 'multi-band test done', datetime('now')) ON CONFLICT(key) DO UPDATE SET enabled=0, note=excluded.note, changed_at=excluded.changed_at"
      ```
      `/terminos` says "Hoy el cobro está desactivado" again.

## Part 8 (optional) — The sales kill switch

The runbook notes this has never been thrown in production. A quiet test window is the time.

- [ ] **8.1** Pause sales:
      ```bash
      npx wrangler d1 execute coverr-db --remote --command "INSERT INTO platform_flags (key, enabled, note, changed_at) VALUES ('sales', 0, 'kill switch test', datetime('now')) ON CONFLICT(key) DO UPDATE SET enabled=0, note=excluded.note, changed_at=excluded.changed_at"
      ```
      Banda A's sale link now says the sale is paused, and the door link still scans.
- [ ] **8.2** Turn sales back on, and the sale link sells again:
      ```bash
      npx wrangler d1 execute coverr-db --remote --command "INSERT INTO platform_flags (key, enabled, note, changed_at) VALUES ('sales', 1, 'kill switch test done', datetime('now')) ON CONFLICT(key) DO UPDATE SET enabled=1, note=excluded.note, changed_at=excluded.changed_at"
      ```

## Part 9 — Clean up

- [ ] **9.1** `/operador`: **Quitar pase** on Banda A, **Quitar promo** on Banda B.
- [ ] **9.2** Each band moves its event's date to **yesterday** in Ajustes — an upcoming event
      with tickets blocks deletion — then **Banda → Borrar la cuenta…**. The account goes, and an
      old sign-in link only leads back to the sign-in page.
- [ ] **9.3** `/operador` no longer lists the two test bands, and Banda B's L5 row is gone from
      **Cobros**: deleting a band deletes its fee history with it.
- [ ] **9.4** Send the L1s and the L5 back between yourselves, if you like.

---

## What to send me

For anything that failed: the step number, what you expected, what happened, and a screenshot.
Also note how long the emails in 1.1, 2.2 and 7.4 took, and which Gmail tab each landed in.

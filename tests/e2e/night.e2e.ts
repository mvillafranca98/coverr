import type { Browser, BrowserContext, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { launchBrowser, localDateTime, mailedLinkCount, nextMailedLink } from "./helpers";

/**
 * One whole night, through the real pages of a local Coverr: a band signs up
 * and sets up, publishes an event, a fan buys two tickets with a receipt, the
 * door lets one in online and one offline, the fan asks for a refund and the
 * band gives it in two parts, the same person starts a second band and moves
 * between them, another band cannot see the first, and the operator suspends
 * it — which follows the person.
 *
 * The steps share state and run in order. A failure names the step, and the
 * local server's log is in .wrangler/e2e-state/server.log.
 */

const baseUrl = inject("baseUrl");
const logPath = inject("logPath");

/** Any real image passes the upload's checks; the receipt is never read in a test. */
const RECEIPT = "public/og-event.png";

const BAND_A = { name: "Banda E2E", email: "banda-e2e@ejemplo.com" };
const BAND_B = { name: "Otra Banda E2E", email: "otra-e2e@ejemplo.com" };
const OPERATOR = "hola@coverr.live";
const SECOND_BAND = "Segunda Banda E2E";

let browser: Browser;
let bandA: Page;
let bandASignInLink = "";
let eventSlug = "";
let scanLink = "";

let peopleSoFar = 0;

/**
 * A fresh browser profile: its own cookies, as a different person on a
 * different phone — and its own address. Every email-sending form shares a
 * per-address budget of five a minute, which one address doing the whole night
 * would outrun, failing a step only when the run happened not to cross a
 * minute boundary.
 */
async function newPerson(): Promise<{ context: BrowserContext; page: Page }> {
  peopleSoFar += 1;
  const context = await browser.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: { "CF-Connecting-IP": `203.0.113.${peopleSoFar}` },
  });
  return { context, page: await context.newPage() };
}

/** Signs a band up at /registro; the band exists once its mailed link is opened and tapped. */
async function signUpBand(page: Page, band: { name: string; email: string }) {
  const known = mailedLinkCount(logPath, band.email, "/admin/crear");
  await page.goto("/registro");
  await page.fill('input[name="name"]', band.name);
  await page.fill('input[name="email"]', band.email);
  await page.click('button[type="submit"]');
  await page.getByRole("heading", { name: "Revisá tu correo" }).waitFor();

  const link = await nextMailedLink(logPath, band.email, "/admin/crear", known);
  await page.goto(link);
  await page.getByRole("heading", { name: `Crear ${band.name}` }).waitFor();
  await page.getByRole("button", { name: "Crear la banda" }).click();
  await page.waitForURL("**/admin");
  return link;
}

/** The name in the panel's top bar: which band the session is in. */
const bandInTopBar = (page: Page) => page.locator("nav.band .brand").textContent();

beforeAll(async () => {
  browser = await launchBrowser();
  bandA = (await newPerson()).page;
});

afterAll(async () => {
  await browser?.close();
});

describe("a night with Coverr", () => {
  it("signs a band up through a mailed link", async () => {
    bandASignInLink = await signUpBand(bandA, BAND_A);
    await expect(bandA.getByText("Te falta poco para vender").count()).resolves.toBe(1);
  });

  it("refuses the same creation link a second time, opened or submitted", async () => {
    const { context, page } = await newPerson();
    await page.goto(bandASignInLink);
    await expect(page.getByText("Ese enlace ya se usó").count()).resolves.toBe(1);

    // Opening a used link hides the button, but nothing stops a direct submit.
    const token = new URL(bandASignInLink, baseUrl).searchParams.get("t") ?? "";
    const resubmit = await page.request.post("/admin/crear", { form: { t: token } });
    expect(resubmit.status()).toBe(400);
    await expect(resubmit.text()).resolves.toContain("Ese enlace ya se usó");
    await context.close();
  });

  it("saves a bank account and a split that totals 100%", async () => {
    await bandA.goto("/admin/banda");
    const account = bandA.locator('form[action="/admin/banda/cuenta"]');
    await account.locator("#acc_bank").selectOption("BAC");
    await account.locator("#acc_number").fill("123456789");
    await account.locator("#acc_holder").fill("BANDA E2E");
    await account.getByRole("button", { name: "Agregar" }).click();
    await bandA.getByText("Guardado.").waitFor();

    await bandA.fill('[name="member_name_0"]', "Uno");
    await bandA.fill('[name="member_pct_0"]', "60");
    await bandA.fill('[name="member_name_1"]', "Dos");
    await bandA.fill('[name="member_pct_1"]', "30");
    await bandA.getByRole("button", { name: "Guardar reparto" }).click();
    await bandA.getByText("Los porcentajes suman 90%").waitFor();

    await bandA.fill('[name="member_pct_1"]', "40");
    await bandA.getByRole("button", { name: "Guardar reparto" }).click();
    await bandA.getByText("Guardado.").waitFor();
  });

  it("creates and publishes an event", async () => {
    await bandA.goto("/admin/nuevo");
    await bandA.fill("#name", "Noche E2E");
    await bandA.fill("#venue", "Local de prueba");
    await bandA.fill("#starts_at", localDateTime(30, 21));
    await bandA.fill("#doors_at", localDateTime(30, 20));
    await bandA.fill("#presale_amount", "100");
    await bandA.fill("#door_amount", "150");
    await bandA.selectOption("#refund_policy", "24h");
    await bandA.getByRole("button", { name: "Crear evento" }).click();
    await bandA.waitForURL("**/ajustes?saved=1");
    eventSlug = new URL(bandA.url()).pathname.split("/")[3] ?? "";
    expect(eventSlug).not.toBe("");

    await bandA.getByRole("button", { name: "Publicar y abrir la venta" }).click();
    await bandA.getByText("La venta está abierta").waitFor();

    // Every event is created with its door link; Ajustes shows it ready to copy.
    scanLink = (await bandA.locator("code", { hasText: "/scan/" }).first().textContent()) ?? "";
    expect(scanLink).toContain("/scan/");
  });

  it("sells two tickets to a fan who uploads a receipt, and shows the QR at once", async () => {
    const { context, page } = await newPerson();
    await page.goto(`/e/${eventSlug}`);
    await page.getByText("Preventa · L100").first().waitFor();
    await page.click("#plus");
    await page.check('input[name="bank"][value="BAC"]', { force: true });
    await page.setInputFiles("#proof", RECEIPT);
    await page.fill("#payer_name", "Ana Prueba");
    await page.fill("#payer_email", "ana-e2e@ejemplo.com");
    await page.fill("#attendee_name_1", "Ana Prueba");
    await page.fill("#attendee_name_2", "Beto Prueba");
    await page.check('input[name="consent"]');
    await page.click("#submitBtn");
    await page.getByText("¡Listo, ya estás adentro!").waitFor();
    await context.close();

    await bandA.goto(`/admin/e/${eventSlug}/ordenes`);
    await bandA.getByText("Ana Prueba").first().waitFor();
  });

  it("lets one person in online and one offline, and syncs the offline one", async () => {
    const { context, page } = await newPerson();
    await page.goto(new URL(scanLink).pathname);
    await page.locator("#net", { hasText: /listo|Sincronizado/ }).waitFor();
    await page.click("#tab-buscar");

    await page.fill("#searchInput", "Ana");
    await page.locator(".srow", { hasText: "Ana Prueba" }).getByRole("button").click();
    await page.locator("#result .r-title", { hasText: "Adelante" }).waitFor();
    await expect(page.locator("#statInside").textContent()).resolves.toBe("1");

    await context.setOffline(true);
    await page.fill("#searchInput", "Beto");
    await page.locator(".srow", { hasText: "Beto Prueba" }).getByRole("button").click();
    await page.locator("#result .r-title", { hasText: "Adelante" }).waitFor();
    await page.locator("#queueRow").waitFor({ state: "visible" });

    await context.setOffline(false);
    await page.locator("#queueRow").waitFor({ state: "hidden", timeout: 60_000 });
    await context.close();

    await bandA.goto(`/admin/e/${eventSlug}`);
    await expect(bandA.locator(".card b").first().textContent()).resolves.toBe("2");
  });

  it("refunds the order a fan asked back, keeps it in history and voids its tickets", async () => {
    await bandA.goto(`/admin/e/${eventSlug}/ordenes`);
    const orderPath =
      (await bandA.locator('a[href*="/orden/"]').first().getAttribute("href")) ?? "";
    const { context, page } = await newPerson();
    await page.goto(`/reembolso/${orderPath.split("/").pop()}`);
    await page.fill("#reason", "No puedo ir");
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await page.getByText(`Le avisamos a ${BAND_A.name}`).waitFor();
    await context.close();

    // An unanswered request blocks deleting the account, and the page says which order.
    await bandA.goto("/admin/banda/borrar");
    await bandA.getByRole("link", { name: /^Orden / }).click();
    await bandA.getByText("pendiente").waitFor();

    // A partial refund is recorded as a newer request; the fan's must stay answerable.
    await bandA.locator('input[name="boleto"]').nth(1).uncheck();
    await bandA.fill("#motivo", "Prueba automática");
    await bandA.getByRole("button", { name: "Reembolsar los boletos marcados" }).click();
    await bandA.getByText("1 reembolsado").waitFor();
    await bandA.getByRole("button", { name: "Aprobar y anular los boletos" }).waitFor();

    // Refunding the rest is what the fan asked for, so it answers the request.
    await bandA.fill("#motivo", "Prueba automática");
    await bandA.getByRole("button", { name: "Reembolsar los boletos marcados" }).click();
    await bandA.getByText("2 reembolsados").waitFor();
    await expect(bandA.getByText("pendiente").count()).resolves.toBe(0);

    await bandA.goto(`/admin/e/${eventSlug}/ordenes`);
    await bandA.getByText("reembolsada").first().waitFor();
    await bandA.goto("/admin/banda/borrar");
    await bandA.getByText("Para confirmar, escribí el nombre de la banda").waitFor();
  });

  it("lets the same person start a second band and move between the two", async () => {
    await bandA.goto("/admin/bandas");
    await bandA.fill("#new_band_name", SECOND_BAND);
    await bandA.getByRole("button", { name: "Crear banda" }).click();
    await bandA.waitForURL("**/admin");
    await expect(bandInTopBar(bandA)).resolves.toContain(SECOND_BAND);

    await bandA.goto("/admin/bandas");
    const firstRow = bandA.locator("tr", { hasText: BAND_A.name }).first();
    await firstRow.getByRole("button", { name: "Entrar" }).click();
    await bandA.waitForURL("**/admin");
    await expect(bandInTopBar(bandA)).resolves.toContain(BAND_A.name);
  });

  it("signs a person with two bands in to a list of both", async () => {
    const { context, page } = await newPerson();
    const known = mailedLinkCount(logPath, BAND_A.email, "/admin/entrar");
    await page.goto("/admin/acceso");
    await page.fill('input[name="email"]', BAND_A.email);
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await page.goto(await nextMailedLink(logPath, BAND_A.email, "/admin/entrar", known));
    await page.getByRole("heading", { name: "Entrar a tus bandas" }).waitFor();
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("**/admin/bandas");
    await expect(page.locator("tr", { hasText: SECOND_BAND }).count()).resolves.toBe(1);
    await context.close();
  });

  it("keeps a second band out of the first band's pages", async () => {
    const { context, page } = await newPerson();
    await signUpBand(page, BAND_B);
    for (const path of ["", "/ordenes", "/dinero", "/ajustes"]) {
      await page.goto(`/admin/e/${eventSlug}${path}`);
      await expect(page.getByText("No encontramos esta página").count()).resolves.toBe(1);
    }
    await context.close();
  });

  it("lets the operator suspend a band, which signs it out on its next click", async () => {
    const { context, page } = await newPerson();
    const known = mailedLinkCount(logPath, OPERATOR, "/operador/entrar");
    await page.goto("/operador/acceso");
    await page.fill('input[name="email"]', OPERATOR);
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await page.goto(await nextMailedLink(logPath, OPERATOR, "/operador/entrar", known));
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("**/operador");

    // Two bands share this email now, and "Banda E2E" sits inside the other names too.
    await page.locator("a.cell-link", { hasText: new RegExp(`^${BAND_A.name}`) }).click();
    await page.getByText(`El mismo correo también lleva: ${SECOND_BAND}`).waitFor();
    await page.fill("#reason", "Prueba automática");
    await page.getByRole("button", { name: "Suspender banda" }).click();
    await page.getByText("Banda suspendida").first().waitFor();
    await context.close();

    await bandA.goto("/admin");
    await bandA.waitForURL("**/admin/acceso?suspendida=1");
    await bandA.getByText("Esta cuenta está suspendida").waitFor();
  });

  it("refuses the suspended band's person a new band, mailing the reason instead", async () => {
    const { context, page } = await newPerson();
    const known = mailedLinkCount(logPath, BAND_A.email, "/admin/crear");
    await page.goto("/registro");
    await page.fill('input[name="name"]', "Una Banda Nueva");
    await page.fill('input[name="email"]', BAND_A.email);
    await page.click('button[type="submit"]');
    // The page answers exactly as it always does; only the mail differs.
    await page.getByRole("heading", { name: "Revisá tu correo" }).waitFor();
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(mailedLinkCount(logPath, BAND_A.email, "/admin/crear")).toBe(known);
    await context.close();
  });
});

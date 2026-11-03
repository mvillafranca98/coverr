#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
/**
 * Takes the product screenshots on the landing page.
 *
 * Exists because the alternative was capturing them by hand out of a browser
 * pane, which caps resolution at the pane's own width and cannot be repeated.
 * Everything here is reproducible: the demo band is regenerated from a fixed
 * seed, the viewports are fixed, and the same command six months from now
 * produces the same images.
 *
 *   npm run dev          # in another terminal
 *   node scripts/shoot.mjs                 # every shot of every show
 *   node scripts/shoot.mjs acople          # one show
 *   node scripts/shoot.mjs shot-ticket     # one shot, for every show
 *
 * One set per invented show in src/views/demo-shows.ts, saved as
 * `<shot>-<show key>.webp`; the landing page picks a show per visit and shows
 * its set. Before each set the demo is reseeded and renamed to that show, and
 * a show whose names wrap onto a second line is refused, because every crop
 * below is measured for names that sit on one.
 *
 * Drives the Chrome already installed on the machine through playwright-core,
 * so nothing downloads a second browser. Captures at deviceScaleFactor 2 and
 * downscales, which is what makes the text crisp — a 1x capture of a 1360px
 * viewport is soft the moment it is displayed at any size.
 *
 * WebP encoding happens in the browser, via canvas. Chrome already has the
 * encoder and the alternative was another dependency for one call.
 *
 * Each surface is shot at the device it is actually used on. The dashboard is
 * a laptop screen — a band doing the accounts after the gig. The scanner is a
 * phone held at a door, and the ticket is a phone in a queue. Shooting the
 * scanner at 1360px wide would be a picture of something nobody sees.
 */
import { chromium } from "playwright-core";
import { DEMO_SHOWS } from "../src/views/demo-shows.ts";

const ORIGIN = "http://127.0.0.1:8787";
const OUT = "public/img";
const BAND = "bnd_demo";
const EVENT = "evt_demo";
/** The first ticket on /boletos/ord_demo_002, the one the ticket shot frames. */
const TICKET_ATTENDEE = "att_demo_002";

const PHONE = { width: 390, height: 844 };
const LAPTOP = { width: 1360, height: 960 };

/**
 * `scroll` drops the page down before the shot — usually to take a wrapped
 * nav or a redundant heading out of frame. `height` crops the capture to
 * something tighter than the viewport.
 */
const SHOTS = [
  // First: it checks somebody in, and the dashboard after it has to count
  // that person, or the two pictures on the landing page disagree by one.
  {
    name: "shot-scanner",
    url: "/scan/demostaff00000000000000000000000",
    viewport: PHONE,
    height: 600,
    prepare: checkSomebodyIn,
  },
  {
    name: "shot-dashboard",
    url: "/admin/e/evento-de-ejemplo",
    viewport: LAPTOP,
    auth: true,
    // Measured, not guessed: the income table ends at 895 and the next
    // heading starts at 933, so this lands in the gap. Cutting through a
    // table header reads as a broken screenshot rather than a cropped one.
    height: 914,
  },
  {
    name: "shot-ticket",
    url: "/boletos/ord_demo_002",
    viewport: PHONE,
    // Measured: the first ticket starts at 406 and its hard shadow ends at
    // 1130, so this frames exactly one whole ticket with a little paper round it.
    scroll: 390,
    height: 754,
  },
];

/**
 * The door flow, driven the way staff actually drive it. Whoever is next in
 * the queue takes the show's name first, so the green result names them.
 */
async function checkSomebodyIn(page, show) {
  const who = show.checkedIn;
  d1(`update attendees set name = '${esc(who)}' where id = '${notYetCheckedIn()}'`);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Buscar" }).click();
  await page.getByPlaceholder("Nombre o código").fill(who);
  await page.getByRole("button", { name: "Marcar" }).first().click();
  await page.waitForTimeout(600);
  // The green result lives in the scan panel, not the search panel.
  await page.getByRole("tab", { name: "Escanear" }).click();
  await page.waitForTimeout(400);
}

/**
 * Wrangler is invoked as plain JavaScript on the current Node rather than
 * through npx, which fails twice on Windows: `npx.cmd` cannot be spawned
 * without a shell since Node 20.12, and through a shell the arguments get
 * re-parsed, so a SQL string with spaces reaches wrangler in pieces and it
 * reports a missing --command. This way argv is passed verbatim.
 */
const WRANGLER = "node_modules/wrangler/bin/wrangler.js";

function wrangler(args, opts = {}) {
  return execFileSync(process.execPath, [WRANGLER, ...args], opts);
}

function d1(sql) {
  const out = wrangler(["d1", "execute", "coverr-db", "--local", "--json", "--command", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}

function notYetCheckedIn() {
  const rows = d1(
    "select a.id from attendees a join orders o on a.order_id = o.id" +
      ` where o.event_id = '${EVENT}' and a.checked_in_at is null limit 1`,
  );
  if (!rows.length) throw new Error("every demo attendee is already checked in — reseed first");
  return rows[0].id;
}

/** A value for inside single quotes in SQL. */
const esc = (text) => text.replace(/'/g, "''");

/**
 * Renames the freshly reseeded demo to `show`: the band, the event and its
 * venue, and the buyer on the ticket shot. The scanner's person is renamed in
 * checkSomebodyIn, the one place that knows who is next.
 */
function becomeShow(show) {
  d1(
    `update bands set name = '${esc(show.band)}' where id = '${BAND}';` +
      ` update events set name = '${esc(show.event)}', venue = '${esc(show.venue)}' where id = '${EVENT}';` +
      ` update attendees set name = '${esc(show.ticketHolder)}' where id = '${TICKET_ATTENDEE}';`,
  );
}

/**
 * Refuses a show whose names wrap or are cut off on this screen. Each crop is
 * measured for names on one line; a second line pushes everything under it
 * down, and the crop then cuts through a table or a button.
 */
async function assertNamesFit(page, show) {
  const names = [show.band, show.event, show.venue, show.ticketHolder, show.checkedIn];
  const problems = await page.evaluate((names) => {
    const found = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? "").trim();
      // Long text is a sentence that happens to mention a name, and may wrap.
      if (text.length > 60 || !names.some((name) => text.includes(name))) continue;
      const box = node.parentElement;
      // Not on screen: a hidden panel, or a screen-reader-only box clipped to 1px.
      const shown = box?.getBoundingClientRect();
      if (!box || !shown || shown.width < 2 || shown.height < 2) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
      if (lines > 1) found.push(`"${text}" wraps onto ${lines} lines`);
      else if (box.scrollWidth > box.clientWidth + 1) found.push(`"${text}" is cut off`);
    }
    return found;
  }, names);
  if (problems.length) {
    throw new Error(`${show.key}: ${problems.join("; ")}. Shorten it in src/views/demo-shows.ts.`);
  }
}

/** Same HMAC the worker uses; see src/lib/auth.ts. */
async function signSession() {
  const vars = readFileSync(".dev.vars", "utf8");
  const secret = vars
    .match(/^SESSION_SECRET=(.*)$/m)?.[1]
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!secret) throw new Error("SESSION_SECRET missing from .dev.vars");

  const enc = new TextEncoder();
  const b64url = (bytes) =>
    Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const body = b64url(
    enc.encode(JSON.stringify({ b: BAND, exp: Math.floor(Date.now() / 1000) + 600 })),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

/**
 * Re-applies the demo seed so every set starts from the same 151 checked in,
 * rather than one more each time the scanner shot is retaken, and from the
 * seed's own names.
 */
function reseed() {
  wrangler(["d1", "execute", "coverr-db", "--local", "--file=./seed/demo.sql", "--yes"], {
    stdio: ["ignore", "ignore", "inherit"],
  });
}

/** PNG buffer in, WebP buffer out, encoded by the browser already running. */
async function toWebp(page, png, width, height) {
  const dataUrl = await page.evaluate(
    async ({ b64, w, h }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      return c.toDataURL("image/webp", 0.86);
    },
    { b64: png.toString("base64"), w: width, h: height },
  );
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const onlyShots = only.filter((a) => SHOTS.some((shot) => shot.name === a));
const onlyShows = only.filter((a) => DEMO_SHOWS.some((show) => show.key === a));
const unknown = only.filter((a) => !onlyShots.includes(a) && !onlyShows.includes(a));
if (unknown.length) throw new Error(`not a shot or a show key: ${unknown.join(", ")}`);

const token = await signSession();
const browser = await chromium.launch({ channel: "chrome" });

// A scratch tab that only ever holds a blank page, used as the WebP encoder.
const encoderPage = await (await browser.newContext()).newPage();

try {
  for (const show of DEMO_SHOWS) {
    if (onlyShows.length && !onlyShows.includes(show.key)) continue;
    console.log(`${show.key}: ${show.band} · ${show.event} · ${show.venue}`);
    reseed();
    becomeShow(show);
    await shootShow(show);
  }
} finally {
  await browser.close();
  // Leaves the local demo as the seed has it, not as the last show.
  reseed();
}

async function shootShow(show) {
  for (const shot of SHOTS) {
    if (onlyShots.length && !onlyShots.includes(shot.name)) continue;

    const context = await browser.newContext({
      viewport: shot.viewport,
      deviceScaleFactor: 2,
      locale: "es-HN",
      timezoneId: "America/Tegucigalpa",
      reducedMotion: "reduce", // no half-finished transitions in a still
    });
    const page = await context.newPage();

    if (shot.auth) {
      await page.goto(`${ORIGIN}/admin/entrar?t=${encodeURIComponent(token)}`);
    }
    await page.goto(ORIGIN + shot.url, { waitUntil: "networkidle" });
    if (shot.prepare) await shot.prepare(page, show);
    if (shot.scroll) await page.evaluate((y) => window.scrollTo(0, y), shot.scroll);
    await page.waitForTimeout(500);
    await assertNamesFit(page, show);

    const height = shot.height ?? shot.viewport.height;
    const png = await page.screenshot({
      clip: { x: 0, y: 0, width: shot.viewport.width, height, scale: "css" },
    });

    const webp = await toWebp(encoderPage, png, shot.viewport.width * 2, height * 2);
    const file = `${shot.name}-${show.key}.webp`;
    writeFileSync(join(OUT, file), webp);
    console.log(
      `  ${file}  ${shot.viewport.width * 2}x${height * 2}  ${Math.round(webp.length / 1024)} KB`,
    );

    await context.close();
  }
}

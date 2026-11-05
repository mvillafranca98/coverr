import { readFileSync } from "node:fs";
import { type Browser, chromium } from "playwright-core";

/**
 * What the end-to-end scenario needs besides a browser: the links Coverr would
 * have emailed, read back from the local server's log, where the stand-in mail
 * transport writes every message (src/lib/email.ts).
 */

/** The Chrome already on this machine, as the screenshot script uses it: nothing to download. */
export function launchBrowser(): Promise<Browser> {
  return chromium.launch({ channel: "chrome" });
}

/**
 * Every link mailed to `to` whose path starts with `pathPrefix`, oldest first,
 * as a path and query, so it opens against whichever port the test server is
 * on whatever origin the mail was written for.
 */
function linksMailedTo(logPath: string, to: string, pathPrefix: string): string[] {
  const links: string[] = [];
  let recipient: string | null = null;
  for (const line of readFileSync(logPath, "utf8").split(/\r?\n/)) {
    const header = line.match(/\[email:dev\] to=(\S+)/);
    if (header) {
      recipient = header[1] ?? null;
      continue;
    }
    const link = line.match(/\[email:dev\]\s+(https?:\/\/\S+)/);
    if (link?.[1] && recipient === to) {
      const url = new URL(link[1]);
      if (url.pathname.startsWith(pathPrefix)) links.push(url.pathname + url.search);
    }
  }
  return links;
}

/**
 * The newest link mailed to `to` since `knownCount` had been seen. Mail goes
 * out after the response (waitUntil), so this waits a little for it.
 */
export async function nextMailedLink(
  logPath: string,
  to: string,
  pathPrefix: string,
  knownCount = 0,
): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const links = linksMailedTo(logPath, to, pathPrefix);
    if (links.length > knownCount) return links[links.length - 1] as string;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`No ${pathPrefix} link was mailed to ${to}`);
}

/** How many such links have been mailed so far, to tell a new one from an old one. */
export function mailedLinkCount(logPath: string, to: string, pathPrefix: string): number {
  return linksMailedTo(logPath, to, pathPrefix).length;
}

/** "2026-12-05T21:00" for a datetime-local field, `days` from now at `hour`, local time. */
export function localDateTime(days: number, hour: number): string {
  const day = new Date(Date.now() + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(hour)}:00`;
}

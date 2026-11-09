import type { FC } from "hono/jsx";
import { InlineScript } from "./inline-script";

/**
 * The script itself, kept small because it ships inline on every page.
 *
 *  - Errors from another origin are skipped. Browser extensions inject
 *    scripts into the page, and their failures are not ours to chase.
 *    "Script error." is all a browser says about one, so that goes too.
 *  - Each distinct message is sent once, five at most per page load, so a
 *    failure inside an animation frame cannot become a flood.
 *  - Nothing is queued. A report that cannot be sent now is dropped: these
 *    pages are not used offline the way the scanner is, and the same failure
 *    on the next buyer's phone will report it.
 *
 * ES5 on purpose, so it runs on the old phones that most need watching.
 */
const ERROR_REPORTER_SCRIPT = `(function () {
  if (!window.fetch) return;
  var seen = {};
  var budget = 5;
  function send(message, stack) {
    if (!message || message === "Script error." || seen[message] || budget <= 0) return;
    seen[message] = true;
    budget -= 1;
    fetch("/api/page-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: location.pathname,
        reports: [{ message: String(message), stack: stack ? String(stack) : "", at: new Date().toISOString() }]
      }),
      keepalive: true
    }).catch(function () { /* dropped on purpose: see views/error-reporter.tsx */ });
  }
  addEventListener("error", function (e) {
    if (e.filename && e.filename.indexOf(location.origin) !== 0) return;
    send(e.message, e.error && e.error.stack);
  });
  addEventListener("unhandledrejection", function (e) {
    var reason = e.reason;
    send(reason && reason.message ? reason.message : String(reason), reason && reason.stack);
  });
})();`;

/**
 * Reports this page's uncaught JavaScript errors to the operator, through
 * `POST /api/page-error` and the same alert email as the server's crashes.
 *
 * Belongs first in `<head>`, before any other script, so it is already
 * listening when they run. Every document but the scanner's includes it; the
 * scanner has its own reporter in public/scanner.js, which queues offline.
 */
export const ErrorReporter: FC = () => <InlineScript code={ERROR_REPORTER_SCRIPT} />;

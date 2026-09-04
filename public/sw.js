/* Caches the scanner shell so it opens at a venue with no signal.
   The attendee manifest lives in localStorage, not here — it changes as
   tickets sell, and a stale cached list at the door would be worse than none. */
var CACHE = "coverr-scan-v1";
var SHELL = ["/scanner.js", "/vendor/jsQR.js", "/scanner.css"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
      return caches.delete(k);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Never cache API calls — check-in state must always come from the network
  // when there is one, and the client handles the offline case itself.
  if (url.pathname.indexOf("/api/") === 0) return;

  if (SHELL.indexOf(url.pathname) >= 0 || url.pathname.indexOf("/scan/") === 0) {
    e.respondWith(
      fetch(e.request)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
          return res;
        })
        .catch(function () { return caches.match(e.request); })
    );
  }
});

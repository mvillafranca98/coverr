/**
 * Scroll motion for the landing page, and only the landing page.
 *
 * GSAP is vendored in `public/vendor` rather than pulled from a CDN, the same
 * way `jsQR.js` already is: it keeps the CSP at `'self'` with no third-party
 * origin to trust, and it is the only reason this page can have motion without
 * loosening a header that protects the pages where money changes hands.
 *
 * The hard problem here is the start state, and there are only bad answers
 * until you add a failsafe:
 *
 *  - Animate with `gsap.from` and hide nothing. Safe if a script dies, but an
 *    element renders visible and then *blinks* — GSAP snaps it to zero as it
 *    crosses the trigger and fades it back in. This is what shipped first and
 *    it looked broken.
 *  - Hide with CSS and reveal with JS. No blink, but a failed script leaves
 *    the page blank forever. The Comseid mockup does exactly this: 18 of its
 *    20 elements never get revealed and the site shows nothing.
 *
 * So: hide from JavaScript, and arm a deadman. `revealGuardScript` adds the
 * class that hides, then starts a timer that strips it again unless the motion
 * script confirms it has taken over. Scripts blocked, a 404 on the vendor
 * bundle, a parse error on a browser nobody tested — every one of those ends
 * with a complete page about two seconds later instead of an empty one.
 *
 * `prefers-reduced-motion` means none of it runs, not a gentler version.
 * Someone who sets that switch is often telling their browser that motion
 * makes them ill, so the guard never arms and nothing is ever hidden.
 */

/**
 * Runs synchronously in `<head>`, before the body paints — which is the whole
 * point, since a class added after first paint is a flash of its own.
 */
export function revealGuardScript(): string {
  return `
(function(){
  var root = document.documentElement;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('js-reveal');
  window.setTimeout(function(){
    if (!root.hasAttribute('data-reveal-ready')) root.classList.remove('js-reveal');
  }, 2000);
})();`;
}

/** The reveals themselves, once the deferred vendor scripts have run. */
export function landingMotionScript(): string {
  return `
document.addEventListener('DOMContentLoaded', function(){
  var root = document.documentElement;

  // The guard did not arm: reduced motion, or no matchMedia. Nothing is
  // hidden, so there is nothing to reveal.
  if (!root.classList.contains('js-reveal')) return;

  // Vendor scripts missing. Undo the hiding immediately rather than waiting
  // out the deadman — the page is already parsed and we know it failed.
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js-reveal');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  root.setAttribute('data-reveal-ready', '');   // disarm the failsafe

  // No clearProps anywhere below: stripping the inline styles would hand the
  // element back to the .js-reveal rule that hides it, and it would vanish on
  // completion. The inline opacity/transform is what keeps it visible.
  gsap.to('[data-hero] > *', {
    y: 0, opacity: 1, duration: .75, stagger: .085, ease: 'power2.out'
  });

  // Everything below: reveal as it arrives, once. Batched so a screen holding
  // four cards animates them together instead of four separate triggers
  // firing a frame apart.
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: function(batch){
      gsap.to(batch, { y: 0, opacity: 1, duration: .7, stagger: .06, ease: 'power2.out' });
    }
  });
});`;
}

/**
 * Scroll motion for the landing page, and only the landing page.
 *
 * GSAP is vendored in `public/vendor` rather than pulled from a CDN, the same
 * way `jsQR.js` already is: it keeps the CSP at `'self'` with no third-party
 * origin to trust, and it is the only reason this page can have motion without
 * loosening a header that protects the pages where money changes hands.
 *
 * Two rules hold throughout:
 *
 *  - **Nothing is hidden by CSS.** Every reveal is a `gsap.from`, so the page
 *    renders complete without JavaScript and stays complete if either script
 *    fails to load. A missed animation is a smaller failure than a blank page.
 *  - **`prefers-reduced-motion` means none of it runs**, not a gentler version.
 *    Someone who sets that switch is often telling their browser that motion
 *    makes them ill.
 */
export function landingMotionScript(): string {
  return `
document.addEventListener('DOMContentLoaded', function(){
  if (!window.gsap || !window.ScrollTrigger) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);

  // Masthead: one staggered rise on load. Runs immediately rather than on a
  // trigger, because it is already in view.
  gsap.from('[data-hero] > *', {
    y: 20, opacity: 0, duration: .75, stagger: .085, ease: 'power2.out', clearProps: 'all'
  });

  // Everything below: reveal as it arrives, once. Batched so a screen holding
  // four cards animates them together instead of four separate triggers
  // firing a frame apart.
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 86%',
    once: true,
    onEnter: function(batch){
      gsap.from(batch, {
        y: 18, opacity: 0, duration: .7, stagger: .06, ease: 'power2.out', clearProps: 'all'
      });
    }
  });

});`;
}

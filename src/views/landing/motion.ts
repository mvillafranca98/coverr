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

  // The hero, in order: the headline pops up word by word, the rest of the
  // copy follows, and the ticket is slapped onto the stage, unwinding its
  // tilt as it lands. back.out overshoots a little: stickers bounce.
  gsap.timeline({ defaults: { ease: 'back.out(1.6)' } })
    .to('.hero__title .w', { y: 0, rotation: 0, opacity: 1, duration: .7, stagger: .04 })
    .to('.hero [data-rise]:not(.stage)', { y: 0, opacity: 1, duration: .6, stagger: .07 }, '-=.5')
    .to('.stage', { y: 0, rotation: 0, scale: 1, opacity: 1, duration: .9, ease: 'back.out(1.4)' }, '-=.8');

  // The ticket bobs and its sticker wobbles. Float and tilt live on
  // different elements so the pointer never fights the idle motion.
  gsap.to('[data-float]', {
    y: -10, rotation: 1.5, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1
  });
  gsap.to('.tix__sticker', {
    rotation: 4, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1
  });

  // Tilt toward the pointer — only where there is a real pointer.
  var tilt = document.querySelector('[data-tilt]');
  var hero = document.querySelector('.hero');
  if (tilt && hero && window.matchMedia('(pointer: fine)').matches) {
    var turnX = gsap.quickTo(tilt, 'rotationX', { duration: .7, ease: 'power3' });
    var turnY = gsap.quickTo(tilt, 'rotationY', { duration: .7, ease: 'power3' });
    hero.addEventListener('pointermove', function(e){
      var box = hero.getBoundingClientRect();
      var px = (e.clientX - box.left) / box.width - .5;
      var py = (e.clientY - box.top) / box.height - .5;
      turnY(px * 18);
      turnX(-py * 14);
    });
    hero.addEventListener('pointerleave', function(){
      turnX(0);
      turnY(0);
    });
  }

  // Everything below the hero: reveal as it arrives, once. Batched so a
  // screen holding four cards animates them together instead of four
  // separate triggers firing a frame apart.
  // Starts as the element's top edge comes onto the screen: on a slow phone
  // a later start left whole headings blank for a moment after they arrived.
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 96%',
    once: true,
    onEnter: function(batch){
      gsap.to(batch, { y: 0, opacity: 1, duration: .7, stagger: .07, ease: 'back.out(1.4)' });
    }
  });

  // The offer's sticker lands once, just after its card: one bounce and done.
  // A loop here would read as an ad blinking at the reader, not a sticker.
  // It starts hidden with its card, so the from-state never flashes.
  gsap.from('.tier__sticker', {
    scale: 1.8, rotation: -24, opacity: 0, duration: .55, delay: .2, ease: 'back.out(2.4)',
    scrollTrigger: { trigger: '.tier--free', start: 'top 88%', once: true }
  });

  // Tabbing jumps straight to a link that may not have been revealed yet, and
  // focus on something invisible is focus nobody can see. Whatever holds the
  // focused element is shown at once, without the animation.
  document.addEventListener('focusin', function(e){
    var hidden = e.target.closest && e.target.closest('[data-reveal]');
    if (hidden) gsap.set(hidden, { y: 0, opacity: 1 });
  });

  // Each of today's habits is struck out as it scrolls into the middle.
  gsap.utils.toArray('.today__text').forEach(function(line){
    gsap.to(line, {
      backgroundSize: '100% 5px', duration: .7, ease: 'power2.inOut',
      scrollTrigger: { trigger: line, start: 'top 72%', once: true }
    });
  });

  // The accounts drawing fills each bar to its share.
  gsap.utils.toArray('.sv-bars i').forEach(function(bar, i){
    var share = parseFloat(getComputedStyle(bar).getPropertyValue('--w')) || 1;
    gsap.to(bar, {
      scaleX: share, duration: 1.2, delay: i * .12, ease: 'power3.out',
      scrollTrigger: { trigger: bar, start: 'top 92%', once: true }
    });
  });

  // Device frames drift at their own speed against the scroll. Wide screens
  // only: on a phone the frames stack and parallax just reads as jitter.
  gsap.matchMedia().add('(min-width: 900px)', function(){
    gsap.utils.toArray('[data-drift]').forEach(function(frame){
      var by = Number(frame.getAttribute('data-drift')) || 0;
      gsap.fromTo(frame, { y: by }, {
        y: -by, ease: 'none',
        scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  });
});`;
}

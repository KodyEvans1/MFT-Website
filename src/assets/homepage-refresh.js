/* Progressive enhancement: content is never hidden, including without JavaScript. */
(() => {
  'use strict';
  if (!document.body.hasAttribute('data-home-refresh')) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches || !('IntersectionObserver' in window) || !Element.prototype.animate) return;
  const active = new Set();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (reduced.matches) continue;
      const animation = entry.target.animate([
        { opacity: .8, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 480, easing: 'cubic-bezier(.2,.7,.3,1)' });
      active.add(animation);
      animation.finished.then(() => active.delete(animation)).catch(() => active.delete(animation));
    }
  }, { threshold: .12 });
  document.querySelectorAll('.mh-path,.mh-person,.mh-thoughts li,.home-steps article').forEach(node => observer.observe(node));
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    observer.disconnect();
    for (const animation of active) animation.cancel();
    active.clear();
  });
})();

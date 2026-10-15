'use strict';
// Same-page navigation only: no tracking, email, appointment or form interception.
(() => {
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('main a[href^="#"]');
    if (!link || link.hasAttribute('download') || link.target === '_blank') return;
    let id;
    try { id = decodeURIComponent(link.getAttribute('href').slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    if (location.hash !== link.getAttribute('href')) history.pushState(null, '', link.getAttribute('href'));
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const button = document.querySelector('.menu-button[aria-expanded="true"]');
    if (button) { button.click(); button.focus(); }
  });
})();

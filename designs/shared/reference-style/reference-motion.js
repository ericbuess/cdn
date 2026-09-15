/* Signal Sweep's bounded reveal/progress vocabulary, with progressive enhancement.
   No network, storage, user tracking, speech changes or automatic navigation. */
(() => {
  'use strict';
  const body = document.body;
  if (!body?.hasAttribute('data-reference-style') || body.dataset.referenceEnhanced) return;
  body.dataset.referenceEnhanced = 'true';
  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let ticking = false;
  function progress() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = root.scrollHeight - innerHeight;
      const value = max > 0 ? Math.max(0, Math.min(1, scrollY / max)) : 0;
      body.style.setProperty('--reference-progress', value.toFixed(4));
      ticking = false;
    });
  }
  addEventListener('scroll', progress, { passive: true });
  addEventListener('resize', progress, { passive: true });
  addEventListener('pageshow', progress);
  document.fonts?.ready.then(progress);
  if ('ResizeObserver' in window) new ResizeObserver(progress).observe(body);
  progress();
  if (body.dataset.referenceStyle === 'paper') {
    const mast = document.querySelector('.mast');
    if (mast && !mast.querySelector('.reference-orbit')) {
      const orbit = document.createElement('div');
      orbit.className = 'reference-orbit'; orbit.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 4; i++) orbit.append(document.createElement('span'));
      mast.prepend(orbit);
    }
  }
  const selector = 'main > h2, main > p, main > blockquote, main > .cards > .status-card, main > .grid > .card, main .section-head, main > section .card, main > section .steps > li, main > .source-notes';
  const items = [...document.querySelectorAll(selector)];
  const reveal = el => el.classList.remove('reference-pending');
  const showAll = () => items.forEach(reveal);
  let observer;
  if (!motion.matches && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(({isIntersecting, target}) => {
        if (isIntersecting) { reveal(target); observer.unobserve(target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .1 });
    items.forEach(el => {
      // Initial and fragment-linked viewport text never disappears after load.
      if (el.getBoundingClientRect().top > innerHeight) {
        el.classList.add('reference-reveal', 'reference-pending'); observer.observe(el);
      }
    });
  }
  // Keyboard, Find, browser fragments and printing must never expose invisible text.
  document.addEventListener('focusin', e => {
    const target = e.target.closest('.reference-pending'); if (target) reveal(target);
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') showAll();
  });
  addEventListener('hashchange', showAll);
  addEventListener('beforeprint', showAll);
  motion.addEventListener?.('change', () => { if (motion.matches) { showAll(); observer?.disconnect(); } });
})();

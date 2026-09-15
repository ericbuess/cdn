/* Home-only decorative enhancement. Content stays visible without JavaScript.
   No timers, recurring frame loop, network, state storage or speech changes. */
(() => {
  'use strict';
  const body=document.body;
  if(!body?.hasAttribute('data-homepage-paper') || body.dataset.readerMotif!=='home' || body.dataset.homepagePaperReady)return;
  body.dataset.homepagePaperReady='true';
  const orbit=body.querySelector('.hero > .homepage-orbit');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  if(orbit && !motion.matches && !location.hash && scrollY<10)orbit.dataset.enter='true';
  const stop=()=>orbit?.removeAttribute('data-enter');
  motion.addEventListener?.('change',e=>{if(e.matches)stop();});
  addEventListener('beforeprint',stop);
})();

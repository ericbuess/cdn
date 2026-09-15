/* Optional presentation enhancement. No network, storage, speech, navigation or claims changes. */
(() => {
 'use strict';
 const body=document.body;
 if(!body?.hasAttribute('data-reader-cohesion') || body.dataset.cohesionEnhanced) return;
 body.dataset.cohesionEnhanced='true';
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 // Anchor headings stay below navigation even when its links wrap on a phone.
 const readerNav=document.querySelector('nav');
 const updateNavOffset=()=>body.style.setProperty('--reader-nav-offset',`${Math.ceil(readerNav?.getBoundingClientRect().height||72)+16}px`);
 updateNavOffset();
 if(readerNav&&'ResizeObserver' in window)new ResizeObserver(updateNavOffset).observe(readerNav);
 addEventListener('resize',updateNavOffset);document.fonts?.ready.then(updateNavOffset);
 // Preserve a separate reading-position indicator on the Alignment research page.
 if(body.dataset.readerMotif==='alignment') {
  const nav=document.querySelector('nav'),progress=document.createElement('div');
  progress.className='reader-progress';progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','Reading position on this page');progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax','100');progress.setAttribute('aria-valuenow','0');nav?.append(progress);
  let queued=false,last=-1;
  function update(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;const max=document.documentElement.scrollHeight-innerHeight;const p=max>0?Math.max(0,Math.min(1,scrollY/max)):0;const percent=Math.round(p*100);if(percent!==last){progress.setAttribute('aria-valuenow',String(percent));last=percent;}});}
  addEventListener('scroll',update,{passive:true});addEventListener('resize',update);addEventListener('pageshow',update);document.fonts?.ready.then(update);if('ResizeObserver' in window)new ResizeObserver(update).observe(body);update();
 }
 // Approval documents reveal short headings/items, never a whole long document block.
 if(body.dataset.readerMotif==='approval' && !motion.matches && 'IntersectionObserver' in window){
  const items=[...document.querySelectorAll('.approval-item,.document-section > h2,.document-section > h3')];
  const showAll=()=>items.forEach(e=>e.classList.remove('reference-pending'));
  const observer=new IntersectionObserver(entries=>entries.forEach(({isIntersecting,target})=>{if(isIntersecting){target.classList.remove('reference-pending');observer.unobserve(target);}}),{rootMargin:'0px 0px -8% 0px',threshold:.1});
  items.forEach(e=>{if(e.getBoundingClientRect().top>innerHeight){e.classList.add('reference-reveal','reference-pending');observer.observe(e);}});
  addEventListener('hashchange',showAll);addEventListener('beforeprint',showAll);
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='f')showAll();});
  motion.addEventListener?.('change',()=>{if(motion.matches){showAll();observer.disconnect();}});
 }
 // Only the existing Home principles strip moves; same original strings, no invented ticker feed.
 if(body.dataset.readerMotif==='home') {
  const ticker=document.querySelector('.ticker'),track=ticker?.querySelector('.track');
  if(ticker&&track){
   ticker.classList.add('cohesion-marquee');ticker.removeAttribute('aria-hidden');
   const group=document.createElement('div');group.className='marquee-group';while(track.firstChild)group.append(track.firstChild);track.append(group);
   const clone=group.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.inert=true;track.append(clone);
   const toggle=document.createElement('button');toggle.type='button';toggle.className='marquee-toggle';toggle.setAttribute('aria-label','Pause moving principles');toggle.setAttribute('aria-pressed','false');toggle.textContent='Pause motion';ticker.append(toggle);
   let pausedByUser=false;
   const sync=()=>{ticker.dataset.paused=String(pausedByUser||document.hidden||motion.matches);toggle.textContent=pausedByUser?'Resume motion':'Pause motion';toggle.setAttribute('aria-label',pausedByUser?'Resume moving principles':'Pause moving principles');toggle.setAttribute('aria-pressed',String(pausedByUser));};
   toggle.addEventListener('click',()=>{pausedByUser=!pausedByUser;sync();});document.addEventListener('visibilitychange',sync);motion.addEventListener?.('change',sync);sync();
  }
 }
})();

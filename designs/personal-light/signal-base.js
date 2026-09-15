/* Signal Sweep: original decorative motion/compass, scoped progress and one-time reveals. */
(() => {
  const body = document.querySelector('body[data-signal-base]');
  if (!body) return;
  const nav = body.querySelector('nav'), bar = nav?.querySelector('.progress');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let scheduled = false;
  function measure() {
    scheduled = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    body.style.setProperty('--signal-progress', progress.toFixed(4));
    body.style.setProperty('--signal-nav-offset', `${Math.ceil(nav?.getBoundingClientRect().height || 0) + 16}px`);
    if (bar) bar.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(measure); } }
  addEventListener('scroll', schedule, {passive:true});
  addEventListener('resize', schedule, {passive:true});
  document.fonts?.ready.then(schedule);
  if ('ResizeObserver' in window) { const observer = new ResizeObserver(schedule); observer.observe(body); if (nav) observer.observe(nav); }
  measure();
  let reveal;
  function clearPending() { body.querySelectorAll('.signal-pending').forEach(el=>el.classList.remove('signal-pending')); reveal?.disconnect(); }
  if (!motion.matches && 'IntersectionObserver' in window) {
    reveal = new IntersectionObserver(entries=>entries.forEach(entry=>{
      if (entry.isIntersecting) { entry.target.classList.add('signal-revealed'); entry.target.classList.remove('signal-pending'); reveal.unobserve(entry.target); }
    }), {rootMargin:'0px 0px -5% 0px',threshold:.04});
    body.querySelectorAll('main > section > .section-head, main .card, main .steps > li, .selected-media__card, main > .signal').forEach(el=>{
      if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('signal-pending'); reveal.observe(el); }
    });
  }
  motion.addEventListener('change',()=>{ if(motion.matches)clearPending();schedule(); });
  body.addEventListener('focusin',event=>event.target.closest('.signal-pending')?.classList.remove('signal-pending'));
  addEventListener('hashchange',()=>{ const id=decodeURIComponent(location.hash.slice(1)); document.getElementById(id)?.closest('.signal-pending')?.classList.remove('signal-pending'); schedule(); });
  /* ---- (4) Interactive Life Domains Radar Target ---- */
  var radar = document.getElementById('radar-target');
  var dots = document.querySelectorAll('.radar-dot-wrap');
  var cursorPing = document.getElementById('cursor-ping');
  var activeBar = document.getElementById('active-domain-bar');
  var chips = document.querySelectorAll('.target-chip');
  var fullCards = document.querySelectorAll('.domain-card-full');

  function activateDomain(domainKey) {
    var matchedDot = null;
    dots.forEach(function (d) {
      if (d.getAttribute('data-domain') === domainKey) {
        d.classList.add('active');
        matchedDot = d;
      } else {
        d.classList.remove('active');
      }
    });

    dots.forEach(d=>d.querySelector('.blip')?.setAttribute('aria-pressed',String(d.getAttribute('data-domain')===domainKey)));
    chips.forEach(function (c) {
      c.setAttribute('aria-pressed',String(c.getAttribute('data-target-domain')===domainKey));
      if (c.getAttribute('data-target-domain') === domainKey) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });

    fullCards.forEach(function (fc) {
      if (fc.getAttribute('data-domain-key') === domainKey) {
        fc.classList.add('highlight');
      } else {
        fc.classList.remove('highlight');
      }
    });

    if (matchedDot && radar) {
      var ringNum = matchedDot.getAttribute('data-ring');
      var rings = radar.querySelectorAll('.ring');
      rings.forEach(function (r) {
        if (r.getAttribute('data-ring') === ringNum) {
          r.classList.add('ring-highlight');
        } else {
          r.classList.remove('ring-highlight');
        }
      });

      if (activeBar) {
        var dTitle = matchedDot.querySelector('.dc-title');
        var dTag = matchedDot.querySelector('.dc-tag');
        var dDesc = matchedDot.querySelector('.dc-desc');
        var titleText = dTitle ? dTitle.textContent : domainKey;
        var tagText = dTag ? dTag.textContent : ('Ring ' + ringNum);
        var descText = dDesc ? dDesc.textContent : '';
        const tag = document.createElement('span'); tag.className='aid-tag'; tag.textContent=tagText; const title=document.createElement('strong'); title.textContent=titleText; activeBar.replaceChildren(tag, document.createTextNode(' '), title, document.createTextNode(': '+descText));
      }
    }
  }


  if (radar && dots.length > 0) {
    // Proximity on mousemove
    radar.addEventListener('mousemove', function (e) {
      var rect = radar.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;

      if (cursorPing) {
        cursorPing.style.left = mx + 'px';
        cursorPing.style.top = my + 'px';
        cursorPing.classList.add('visible');
      }

      dots.forEach(function (dot) {
        var dotX = (parseFloat(dot.style.left) / 100) * rect.width;
        var dotY = (parseFloat(dot.style.top) / 100) * rect.height;
        var dx = dotX - mx;
        var dy = dotY - my;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 85) {
          var factor = 1 + (1 - dist / 85) * 0.35;
          dot.style.setProperty('--proximity-scale', factor.toFixed(3));
          dot.classList.add('near');
        } else {
          dot.style.setProperty('--proximity-scale', '1');
          dot.classList.remove('near');
        }
      });
    });

    radar.addEventListener('mouseleave', function () {
      if (cursorPing) cursorPing.classList.remove('visible');
      dots.forEach(function (dot) {
        dot.style.setProperty('--proximity-scale', '1');
        dot.classList.remove('near');
      });
    });

    // Dot hover & click triggers
    dots.forEach(function (dot) {
      var key = dot.getAttribute('data-domain');
      dot.addEventListener('mouseenter', function () { activateDomain(key); });
      dot.addEventListener('focusin', function () { activateDomain(key); });
      dot.addEventListener('click', function (e) {
        e.stopPropagation();
        activateDomain(key);
      });
    });

    // Chip triggers
    chips.forEach(function (chip) {
      var key = chip.getAttribute('data-target-domain');
      chip.addEventListener('mouseenter', function () { activateDomain(key); });
      chip.addEventListener('click', function (e) {
        e.preventDefault();
        activateDomain(key);
      });
    });

    // Full card hover triggers
    fullCards.forEach(function (card) {
      var key = card.getAttribute('data-domain-key');
      card.addEventListener('mouseenter', function () { activateDomain(key); });
    });

    activateDomain('alignment');
  }

  const typed=body.querySelector('[data-typewriter]'), text=typed?.querySelector('[data-typed-text]');
  const lines=(typed?.dataset.lines||'').split('|').filter(Boolean);
  const toggle=body.querySelector('[data-motion-toggle]');
  let paused=false, timer=0, index=0, char=lines[0]?.length||0, deleting=true;
  function canAnimate(){return !paused&&!motion.matches&&!document.hidden;}
  function step(){
    if(!canAnimate()||!text||lines.length<2)return;
    const line=lines[index]; char+=deleting?-1:1; text.textContent=line.slice(0,Math.max(0,char));
    let delay=deleting?16:36;
    if(char<=0){deleting=false;index=(index+1)%lines.length;char=0;delay=350;}
    else if(!deleting&&char>=line.length){deleting=true;delay=2800;}
    timer=setTimeout(step,delay);
  }
  function reconcileMotion(){
    clearTimeout(timer);body.classList.toggle('motion-paused',!canAnimate());
    if(toggle){toggle.hidden=motion.matches;toggle.textContent=paused?'Resume animation':'Pause animation';toggle.setAttribute('aria-pressed',String(paused));}
    if(motion.matches&&text){text.textContent=lines[0];index=0;char=lines[0].length;deleting=true;}
    if(canAnimate())timer=setTimeout(step,2800);
  }
  toggle?.addEventListener('click',()=>{paused=!paused;reconcileMotion();});
  document.addEventListener('visibilitychange',reconcileMotion);motion.addEventListener('change',reconcileMotion);
  reconcileMotion();
})();

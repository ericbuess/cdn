/* One page player. Speech engine and voice helpers are exact, pinned imports
 * from Go Screenless; see reader-upstream.json and scripts/sync-reader-engine.mjs.
 * No automatic play, remote generation, API keys or time estimates. */
import { ReaderSpeech } from './speech.mjs';
import { localVoices, resolveVoice } from './voices.mjs';

const PAGE_AUDIO_ENABLED = false;

function hideExistingAudioControls() {
 document.querySelectorAll('.page-audio, [data-speech-overview], [data-speech], .speech-overview, h2#listen').forEach(el => {
  el.hidden = true;
  el.setAttribute('hidden', '');
  el.setAttribute('aria-hidden', 'true');
  el.style.setProperty('display', 'none', 'important');
 });
 document.body?.classList.remove('has-page-audio');
}

if (!PAGE_AUDIO_ENABLED) {
 hideExistingAudioControls();
 document.body?.style.removeProperty('--page-audio-height');
} else {
 const icons = {
  play: '<path d="m9 5 11 7-11 7z"/>',
  pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>',
  previous: '<path d="M6 5v14m13-14L8 12l11 7z"/>',
  next: '<path d="M18 5v14M5 5l11 7-11 7z"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
 };
 const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
 const root = document.createElement('section');
 root.className = 'page-audio';
 root.setAttribute('aria-label', 'Page audio player');
 root.dataset.provider = 'browser';
 root.innerHTML = `<div class="page-audio-progress" role="progressbar" aria-label="Spoken page progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
  <div class="page-audio-row">
   <div class="page-audio-title"><span class="page-audio-label">Listen to this page</span><strong></strong></div>
   <div class="page-audio-transport">
    <button type="button" data-audio="previous" aria-label="Previous passage">${svg('previous')}</button>
    <button type="button" data-audio="play" class="page-audio-play" aria-label="Read this page">${svg('play')}</button>
    <button type="button" data-audio="next" aria-label="Next passage">${svg('next')}</button>
   </div>
   <button type="button" data-audio="more" aria-label="Audio settings" aria-expanded="false" aria-controls="page-audio-settings">${svg('more')}</button>
  </div>
  <p class="page-audio-error" role="status" aria-live="polite"></p>
  <div id="page-audio-settings" class="page-audio-settings" hidden>
   <div class="page-audio-settings-head"><strong>Listening settings</strong><button type="button" data-audio="close" aria-label="Close audio settings">×</button></div>
   <label>Passage<select data-audio="passage"></select></label>
   <div class="page-audio-settings-grid"><label>Speed<select data-audio="rate"><option value="0.8">0.8×</option><option value="1" selected>1×</option><option value="1.2">1.2×</option><option value="1.5">1.5×</option><option value="1.8">1.8×</option><option value="2">2×</option></select></label><label>Voice<select data-audio="voice"><option value="auto">Automatic browser voice</option><option value="browser">Browser default</option></select></label></div>
   <p class="page-audio-voice-note">Using browser speech. Available voices depend on your device.</p>
   <div class="page-audio-actions"><button type="button" data-audio="restart">Start over</button><button type="button" data-audio="stop">Stop</button></div>
  </div>`;
 document.body.append(root);
 document.body.classList.add('has-page-audio');
 const get = name => root.querySelector(`[data-audio="${name}"]`);
 const title = root.querySelector('strong');
 const label = root.querySelector('.page-audio-label');
 const error = root.querySelector('.page-audio-error');
 const progress = root.querySelector('[role="progressbar"]');
 const settings = root.querySelector('.page-audio-settings');
 const sourceRoot = '.hero,.mast,.page-head,main,body > header,body[data-reader-motif="approval"],body[data-page-reading]';
 const blocks = 'h1,h2,h3,h4,p,li,dt,dd,th,td,blockquote,pre';
 const skip = 'nav,footer,script,style,svg,button,select,[aria-hidden="true"],[hidden],[inert],.page-audio,.speech-overview,#overview-text,[data-reader-skip],.ticker,.wall,.preview';
 const paragraphs = [];
 const spokenHeadings = new Set();
 let section = document.querySelector('h1')?.textContent.trim() || document.title;
 for (const element of document.querySelectorAll(blocks)) {
  if (!element.closest(sourceRoot) || element.closest(skip)) continue;
  // Nested list/paragraph markup is read once, in document order.
  if (element.parentElement.closest(blocks)?.closest(sourceRoot)) continue;
  const copy = element.cloneNode(true);
  copy.querySelectorAll(skip).forEach(item => item.remove());
  const text = copy.textContent.replace(/\s+/gu, ' ').trim();
  if (!text) continue;
  if (/^H[1-4]$/.test(element.tagName)) {
   if (spokenHeadings.has(text)) continue;
   spokenHeadings.add(text); section = text;
  }
  paragraphs.push({ id: `passage-${paragraphs.length}`, text, section, element });
 }
 const pageTitle = document.querySelector('h1')?.textContent.replace(/\s+/gu, ' ').trim() || document.title;
 title.textContent = pageTitle;
 const options = paragraphs.map((p, i) => new Option(`${i + 1}. ${p.text.slice(0, 88)}`, String(i)));
 get('passage').append(...options);
 let reader, started = false, activeElement, voiceChoice = 'auto', startTimer;
 const clearStart = () => { clearTimeout(startTimer); startTimer = undefined; };
 function armStart() {
  clearStart(); started = false; label.textContent = 'Starting…';
  startTimer = setTimeout(() => {
   if (!started && reader?.state.status === 'playing') {
    reader.pause();
    error.textContent = 'The browser did not report speech starting. Tap Play to retry, or choose another voice.';
   }
  }, 8000);
 }
 function update(state) {
  const playing = state.status === 'playing';
  if (!playing) clearStart();
  root.dataset.state = state.status;
  get('play').innerHTML = svg(playing ? 'pause' : 'play');
  get('play').setAttribute('aria-label', playing ? 'Pause reading' : state.status === 'paused' ? 'Resume reading' : state.status === 'finished' ? 'Read page again' : 'Read this page');
  label.textContent = playing ? (started ? 'Reading' : 'Starting…') : state.status === 'paused' ? 'Paused' : state.status === 'finished' ? 'Page finished' : 'Listen to this page';
  const p = paragraphs[state.index];
  title.textContent = state.status === 'idle' ? pageTitle : p?.section || pageTitle;
  title.title = title.textContent;
  get('previous').disabled = !paragraphs.length || state.index === 0;
  get('next').disabled = !paragraphs.length || state.index >= paragraphs.length - 1;
  get('passage').value = String(state.index);
  const percent = state.status === 'finished' ? 100 : Math.round(state.index / Math.max(1, paragraphs.length) * 100);
  progress.setAttribute('aria-valuenow', String(percent));
  progress.setAttribute('aria-valuetext', `Passage ${Math.min(state.index + 1, paragraphs.length)} of ${paragraphs.length}${state.status === 'finished' ? ', finished' : ''}`);
  progress.firstElementChild.style.width = `${percent}%`;
  error.textContent = state.error ? 'Playback stopped. Try Play again or choose another browser voice.' : '';
  const nextElement = ['playing', 'paused'].includes(state.status) ? p?.element : null;
  if (activeElement !== nextElement) { activeElement?.classList.remove('page-audio-current'); nextElement?.classList.add('page-audio-current'); activeElement = nextElement; }
 }
 function setSettings(open) {
  settings.hidden = !open;
  get('more').setAttribute('aria-expanded', String(open));
  if (open) get('passage').focus(); else get('more').focus();
 }
 get('more').addEventListener('click', () => setSettings(settings.hidden));
 get('close').addEventListener('click', () => setSettings(false));
 root.addEventListener('keydown', event => { if (event.key === 'Escape' && !settings.hidden) setSettings(false); });
 if (window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function' && paragraphs.length) {
  reader = new ReaderSpeech({ synth: speechSynthesis, makeUtterance: text => new SpeechSynthesisUtterance(text), onChange: update, onStart: () => { started = true; clearStart(); label.textContent = 'Reading'; } });
  reader.setParagraphs(paragraphs);
  const play = () => { if (reader.state.status === 'playing') reader.pause(); else { armStart(); reader.play(); } };
  get('play').addEventListener('click', play);
  const move = action => { if (reader.state.status === 'playing') armStart(); action(); };
  get('previous').addEventListener('click', () => move(() => reader.previous()));
  get('next').addEventListener('click', () => move(() => reader.next()));
  get('restart').addEventListener('click', () => { reader.stop(); reader.seek(0); armStart(); reader.play(); });
  get('stop').addEventListener('click', () => { reader.stop(); reader.seek(0); });
  get('passage').addEventListener('change', event => move(() => reader.seek(Number(event.target.value))));
  get('rate').addEventListener('change', event => move(() => reader.configure({ rate: Number(event.target.value) })));
  function voices(defer = true) {
   const list = speechSynthesis.getVoices();
   const choices = [new Option('Automatic browser voice', 'auto'), new Option('Browser default', 'browser'), ...localVoices(list).map(v => new Option(`${v.name} · ${v.lang}`, v.voiceURI))];
   get('voice').replaceChildren(...choices);
   if (!choices.some(o => o.value === voiceChoice)) voiceChoice = 'auto';
   get('voice').value = voiceChoice;
   const voice = resolveVoice(list, voiceChoice);
   if (!defer && reader.state.status === 'playing' && reader.voice !== voice) armStart();
   reader.configure({ voice, deferVoice: defer });
   root.querySelector('.page-audio-voice-note').textContent = voice ? `${voice.name} · Browser speech on this device.` : 'Browser default voice. It may use a network voice service.';
  }
  get('voice').addEventListener('change', event => { voiceChoice = event.target.value; voices(false); });
  speechSynthesis.addEventListener?.('voiceschanged', () => voices()); voices();
  document.querySelectorAll('[data-speech-overview]').forEach(widget => {
   const trigger = widget.querySelector('[data-speech="play"]');
   widget.querySelectorAll('[data-speech="pause"],[data-speech="stop"],.speech-status').forEach(e => e.remove());
   if (trigger) { trigger.textContent = 'Listen to this page'; trigger.addEventListener('click', () => { if (reader.state.status !== 'playing') play(); }); }
  });
  // Suspend on actual page exit; visibility changes alone must not stop background speech.
  addEventListener('pagehide', () => reader.stop());
 } else {
  error.textContent = 'Browser speech is unavailable here. You can still read every page.';
  root.querySelectorAll('button:not([data-audio="more"]):not([data-audio="close"]),select').forEach(e => e.disabled = true);
  document.querySelectorAll('[data-speech-overview] button').forEach(e => e.disabled = true);
 }
 function measure() { document.body.style.setProperty('--page-audio-height', `${Math.ceil(root.getBoundingClientRect().height)}px`); }
 new ResizeObserver(measure).observe(root); measure();
}

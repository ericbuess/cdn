/* Bottom player for pre-rendered Leo clips. Renders only when
 * <page-dir>/audio/manifest.json exists and lists clips for this page.
 * No listen buttons, no browser synthesis, no automatic play. */
const icons = {
 play: '<path d="m9 5 11 7-11 7z"/>',
 pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z"/>',
 previous: '<path d="M6 5v14m13-14L8 12l11 7z"/>',
 next: '<path d="M18 5v14M5 5l11 7-11 7z"/>',
 more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
};
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

function pageName() {
 const path = location.pathname;
 if (path.endsWith('/')) return 'index.html';
 const leaf = decodeURIComponent(path.split('/').pop() || '');
 return leaf || 'index.html';
}

function clipsForPage(manifest, page) {
 if (!manifest || typeof manifest !== 'object') return [];
 if (Array.isArray(manifest.pages?.[page]) && manifest.pages[page].length) return manifest.pages[page];
 if (manifest.pages?.[page]?.clips?.length) return manifest.pages[page].clips;
 if (manifest.page === page && Array.isArray(manifest.clips) && manifest.clips.length) return manifest.clips;
 if (Array.isArray(manifest.clips) && manifest.clips.length && !manifest.page) {
  const matched = manifest.clips.filter(clip => !clip.page || clip.page === page);
  if (matched.length) return matched;
 }
 return [];
}

function mountPlayer(clips, pageDir) {
 const root = document.createElement('section');
 root.className = 'page-audio';
 root.setAttribute('aria-label', 'Page audio player');
 root.dataset.provider = 'leo';
 root.innerHTML = `<div class="page-audio-progress" role="progressbar" aria-label="Spoken page progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
  <div class="page-audio-row">
   <div class="page-audio-title"><span class="page-audio-label">Ready</span><strong></strong></div>
   <div class="page-audio-transport">
    <button type="button" data-audio="previous" aria-label="Previous section">${svg('previous')}</button>
    <button type="button" data-audio="play" class="page-audio-play" aria-label="Play page audio">${svg('play')}</button>
    <button type="button" data-audio="next" aria-label="Next section">${svg('next')}</button>
   </div>
   <button type="button" data-audio="more" aria-label="Audio settings" aria-expanded="false" aria-controls="page-audio-settings">${svg('more')}</button>
  </div>
  <p class="page-audio-error" role="status" aria-live="polite"></p>
  <div id="page-audio-settings" class="page-audio-settings" hidden>
   <div class="page-audio-settings-head"><strong>Audio settings</strong><button type="button" data-audio="close" aria-label="Close audio settings">×</button></div>
   <label>Section<select data-audio="passage"></select></label>
   <div class="page-audio-settings-grid"><label>Speed<select data-audio="rate"><option value="0.8">0.8×</option><option value="1" selected>1×</option><option value="1.2">1.2×</option><option value="1.5">1.5×</option><option value="1.8">1.8×</option><option value="2">2×</option></select></label></div>
   <p class="page-audio-voice-note">Leo voice · pre-rendered sections for this page.</p>
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
 const pageTitle = document.querySelector('h1')?.textContent.replace(/\s+/gu, ' ').trim() || document.title;
 const options = clips.map((clip, i) => new Option(`${i + 1}. ${clip.title || 'Section'}`, String(i)));
 get('passage').append(...options);
 const audio = new Audio();
 audio.preload = 'auto';
 let index = 0;
 let status = 'idle';
 const srcFor = clip => new URL(`audio/${clip.file}`, pageDir).href;
 function setIndex(next) {
  index = Math.max(0, Math.min(clips.length - 1, next));
  audio.src = srcFor(clips[index]);
  audio.load();
 }
 function fraction() {
  if (!audio.duration || !Number.isFinite(audio.duration)) return 0;
  return Math.min(1, Math.max(0, audio.currentTime / audio.duration));
 }
 function update() {
  const playing = status === 'playing';
  root.dataset.state = status;
  get('play').innerHTML = svg(playing ? 'pause' : 'play');
  get('play').setAttribute('aria-label', playing ? 'Pause' : status === 'paused' ? 'Resume' : status === 'finished' ? 'Play page again' : 'Play page audio');
  label.textContent = playing ? 'Playing' : status === 'paused' ? 'Paused' : status === 'finished' ? 'Page finished' : 'Ready';
  const clip = clips[index];
  title.textContent = status === 'idle' ? pageTitle : clip?.title || pageTitle;
  title.title = title.textContent;
  get('previous').disabled = !clips.length || index === 0;
  get('next').disabled = !clips.length || index >= clips.length - 1;
  get('passage').value = String(index);
  const percent = status === 'finished' ? 100 : Math.round((index + (status === 'idle' ? 0 : fraction())) / Math.max(1, clips.length) * 100);
  progress.setAttribute('aria-valuenow', String(percent));
  progress.setAttribute('aria-valuetext', `Section ${Math.min(index + 1, clips.length)} of ${clips.length}${status === 'finished' ? ', finished' : ''}`);
  progress.firstElementChild.style.width = `${percent}%`;
 }
 function playFrom(next, { restart = false } = {}) {
  error.textContent = '';
  if (next !== index || restart || !audio.src) setIndex(next);
  const run = audio.play();
  status = 'playing';
  update();
  if (run && typeof run.catch === 'function') {
   run.catch(() => {
    status = 'idle';
    error.textContent = 'Playback could not start. Try Play again.';
    update();
   });
  }
 }
 get('play').addEventListener('click', () => {
  if (status === 'playing') { audio.pause(); status = 'paused'; update(); return; }
  if (status === 'finished') { playFrom(0, { restart: true }); return; }
  playFrom(index);
 });
 get('previous').addEventListener('click', () => playFrom(index - 1, { restart: true }));
 get('next').addEventListener('click', () => playFrom(index + 1, { restart: true }));
 get('restart').addEventListener('click', () => playFrom(0, { restart: true }));
 get('stop').addEventListener('click', () => { audio.pause(); setIndex(0); status = 'idle'; update(); });
 get('passage').addEventListener('change', event => playFrom(Number(event.target.value), { restart: true }));
 get('rate').addEventListener('change', event => { audio.playbackRate = Number(event.target.value); });
 audio.addEventListener('timeupdate', () => { if (status === 'playing') update(); });
 audio.addEventListener('ended', () => {
  if (index < clips.length - 1) playFrom(index + 1, { restart: true });
  else { status = 'finished'; update(); }
 });
 audio.addEventListener('error', () => {
  error.textContent = 'This section could not be loaded.';
  if (status === 'playing') status = 'paused';
  update();
 });
 addEventListener('pagehide', () => { audio.pause(); });
 function setSettings(open) {
  settings.hidden = !open;
  get('more').setAttribute('aria-expanded', String(open));
  if (open) get('passage').focus(); else get('more').focus();
 }
 get('more').addEventListener('click', () => setSettings(settings.hidden));
 get('close').addEventListener('click', () => setSettings(false));
 root.addEventListener('keydown', event => { if (event.key === 'Escape' && !settings.hidden) setSettings(false); });
 setIndex(0);
 status = 'idle';
 update();
 function measure() { document.body.style.setProperty('--page-audio-height', `${Math.ceil(root.getBoundingClientRect().height)}px`); }
 new ResizeObserver(measure).observe(root); measure();
}

const pageDir = new URL('.', location.href);
fetch(new URL('audio/manifest.json', pageDir), { cache: 'no-cache' })
 .then(res => (res.ok ? res.json() : null))
 .then(manifest => {
  const clips = clipsForPage(manifest, pageName()).filter(clip => clip && clip.file);
  if (clips.length) mountPlayer(clips, pageDir);
 })
 .catch(() => {});

// Browser voice metadata has no standardized quality score. These are selection
// hints, not a promise about sound quality; the reader can audition and override.
const english = voice => /^en(?:[-_]|$)/i.test(voice.lang);
const novelty = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Hysterical|Jester|Junior|Organ|Trinoids|Whisper|Zarvox)(?:\b|$)/i;
function preference(voice) {
  return (english(voice) ? 1000 : 0)
    + (/premium|enhanced|natural|neural/i.test(voice.name) ? 200 : 0)
    + (/siri/i.test(voice.name) ? 100 : 0)
    + (/^Alex\b/i.test(voice.name) ? 50 : 0)
    - (/^Samantha\b/i.test(voice.name) ? 20 : 0)
    - (novelty.test(voice.name) ? 400 : 0);
}
export function localVoices(voices) {
  const seen = new Set();
  return voices.filter(voice => {
    if (!voice.localService || !voice.voiceURI || seen.has(voice.voiceURI)) return false;
    seen.add(voice.voiceURI); return true;
  }).sort((a, b) => preference(b) - preference(a) || a.name.localeCompare(b.name) || a.voiceURI.localeCompare(b.voiceURI));
}
export function resolveVoice(voices, choice = 'auto') {
  if (choice === 'browser') return null;
  const local = localVoices(voices);
  return local.find(voice => voice.voiceURI === choice) || local.find(english) || null;
}
export function canUseVoice(voices, choice = 'auto') {
  return choice === 'browser' || resolveVoice(voices, choice) !== null;
}
export function voiceStatus(voices, choice = 'auto') {
  const local = localVoices(voices), voice = resolveVoice(voices, choice);
  if (choice === 'browser') return 'Using the browser default. It may use a network voice service.';
  if (!voice) return `${local.length ? 'No local English voices are listed.' : 'No local voices are listed yet.'} Choose an available local voice, or explicitly select Browser default, which may use a network voice service. Playback waits for your choice.`;
  const missing = choice !== 'auto' && !local.some(item => item.voiceURI === choice);
  const prefix = missing ? 'Your saved voice is unavailable here. Using ' : choice === 'auto' ? 'Automatic choice: ' : 'Using ';
  const englishVoices = local.filter(english);
  if (englishVoices.length === 1 && /^Samantha\b/i.test(voice.name)) {
    return `${prefix}${voice.name}. Samantha is the only local English voice this browser exposes; this page cannot supply a better one. Try the sample or another voice if one becomes available.`;
  }
  return `${prefix}${voice.name} (${voice.lang}). ${english(voice) ? 'Voice quality depends on your device; use the sample to choose.' : 'This voice is listed for another language; sample its English pronunciation.'}`;
}

/** Browser speech state machine. Construction and data loading never start audio.
 * Boundary offsets use UTF-16 indices, as SpeechSynthesisEvent.charIndex does.
 * No-boundary engines still expose the current paragraph for highlighting.
 */
export class ReaderSpeech {
  constructor({ synth, makeUtterance, onChange = () => {}, onParagraphEnd = () => {}, onStart = () => {} }) {
    this.synth = synth;
    this.makeUtterance = makeUtterance;
    this.onChange = onChange;
    this.onParagraphEnd = onParagraphEnd;
    this.onStart = onStart;
    this.paragraphs = [];
    this.rate = 1;
    this.voice = null;
    this.pendingVoice = undefined;
    this.generation = 0;
    this.cursor = 0;
    this.utterances = [];
    this.activeOrder = 0;
    this.unconfirmedStarts = new Map();
    this.disposed = false;
    this.state = { status: 'idle', index: 0, wordStart: -1, wordLength: 0, error: null };
  }

  _emit(changes = {}) {
    this.state = { ...this.state, ...changes };
    if (!this.disposed) this.onChange({ ...this.state });
  }

  _cancel() {
    // Fence BEFORE cancel: some engines synchronously dispatch end/error here.
    this.generation += 1;
    // cancel() is global, not scoped to this reader. An idle reader/sample has
    // nothing to cancel. Besides interrupting another reader, redundant stops
    // can race a subsequent speak() in WebKit's asynchronous native backend.
    if (this.utterances.length) {
      try { this.synth?.cancel(); } catch { /* A new speak may still work. */ }
    }
    this.utterances = [];
  }

  _index(index) {
    return Math.max(0, Math.min(this.paragraphs.length - 1,
      Number.isFinite(index) ? Math.trunc(index) : 0));
  }

  setParagraphs(paragraphs) {
    if (this.disposed) return;
    const playing = this.state.status === 'playing';
    this._cancel();
    this.unconfirmedStarts.clear();
    this.paragraphs = paragraphs.filter(p => typeof p.text === 'string' && p.text.trim()).map(p => ({ ...p }));
    this.cursor = 0;
    this._emit({ status: 'idle', index: 0, wordStart: -1, wordLength: 0, error: null });
    if (playing && this.paragraphs.length) this.play();
  }

  // Browser speech queues cannot delete a future utterance. Cancel and rebuild
  // from the last trustworthy position, fencing all callbacks from the old run.
  replaceRemaining(paragraphs) {
    if (this.disposed) return;
    const prior = this.state.status;
    const id = this.paragraphs[this.state.index]?.id;
    const cursor = Math.min(this.cursor, this.unconfirmedStarts.get(this.state.index) ?? this.cursor);
    this._cancel();
    this.unconfirmedStarts.clear();
    this.paragraphs = paragraphs.filter(p => typeof p.text === 'string' && p.text.trim()).map(p => ({ ...p }));
    const retained = this.paragraphs.findIndex(p => p.id === id);
    const index = Math.max(0, retained);
    this.cursor = retained >= 0 ? cursor : 0;
    this._emit({ index, wordStart: retained >= 0 ? this.state.wordStart : -1,
      wordLength: retained >= 0 ? this.state.wordLength : 0, error: null,
      status: !this.paragraphs.length ? 'finished' : prior === 'playing' ? 'playing' : 'paused' });
    if (this.state.status === 'playing') this._speak();
  }

  play(index) {
    if (this.disposed) return;
    if (!this.paragraphs.length) {
      this._cancel();
      this._emit({ status: 'idle', index: 0, wordStart: -1, wordLength: 0, error: null });
      return;
    }
    if (index === undefined && this.state.status === 'playing') return;
    this._cancel();
    if (index !== undefined || this.state.status === 'finished') {
      this.cursor = 0;
      this.state = { ...this.state, index: this._index(index ?? 0), wordStart: -1, wordLength: 0 };
    }
    this._emit({ status: 'playing', error: null });
    this._speak();
  }

  pause() {
    if (this.disposed || this.state.status !== 'playing') return;
    this._cancel();
    // cursor is the last trustworthy word boundary, or the chunk beginning.
    this._emit({ status: 'paused' });
  }

  seek(index) {
    if (this.disposed) return;
    const prior = this.state.status;
    this._cancel();
    this.cursor = 0;
    this._emit({ index: this._index(index), wordStart: -1, wordLength: 0, error: null,
      status: this.paragraphs.length && prior === 'playing' ? 'playing' :
        this.paragraphs.length && prior === 'paused' ? 'paused' : 'idle' });
    if (this.state.status === 'playing') this._speak();
  }

  next() { this.seek(this.state.index + 1); }
  previous() { this.seek(this.state.index - 1); }

  configure({ rate, voice, deferVoice = false } = {}) {
    if (this.disposed) return;
    const newRate = typeof rate === 'number' && Number.isFinite(rate) ? Math.max(0.1, Math.min(10, rate)) : this.rate;
    const queueVoice = deferVoice && this.state.status === 'playing' && voice !== undefined;
    if (queueVoice) this.pendingVoice = voice;
    else if (voice !== undefined) this.pendingVoice = undefined;
    const newVoice = voice === undefined || queueVoice ? this.voice : voice;
    if (newRate === this.rate && newVoice === this.voice) return;
    this.rate = newRate;
    this.voice = newVoice;
    if (this.state.status === 'playing') {
      this._cancel();
      this._speak();
    }
  }

  stop() {
    if (this.disposed) return;
    this._cancel();
    this.cursor = 0;
    this._emit({ status: 'idle', wordStart: -1, wordLength: 0, error: null });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._cancel();
    this.paragraphs = [];
    this.onChange = () => {};
    this.onParagraphEnd = () => {};
    this.onStart = () => {};
  }

  _speak() {
    if (this.disposed || this.state.status !== 'playing') return;
    // The native queue has already been submitted, so automatic voice discovery
    // takes effect on the next playback action, without interrupting this run.
    if (this.pendingVoice !== undefined) {
      this.voice = this.pendingVoice;
      this.pendingVoice = undefined;
    }
    const unconfirmedStart = this.unconfirmedStarts.get(this.state.index);
    if (unconfirmedStart !== undefined) this.cursor = Math.min(this.cursor, unconfirmedStart);
    this.unconfirmedStarts.clear();
    const generation = ++this.generation;
    const current = () => !this.disposed && this.generation === generation && this.state.status === 'playing';
    const records = [];
    this.activeOrder = 0;
    const fail = error => {
      if (!current()) return;
      this._cancel();
      this._emit({ status: 'error', error });
    };
    try {
      if (!this.synth || typeof this.synth.speak !== 'function' || typeof this.makeUtterance !== 'function') {
        throw new Error('Speech synthesis is unavailable in this browser.');
      }
      for (let index = this.state.index; index < this.paragraphs.length; index++) {
        const paragraph = this.paragraphs[index];
        let start = index === this.state.index ? this.cursor : 0;
        while (start < paragraph.text.length) {
          const end = chunkEnd(paragraph.text, start);
          const text = paragraph.text.slice(start, end);
          const utterance = this.makeUtterance(text);
          const record = { utterance, paragraph, index, start, end, order: records.length, completed: false };
          records.push(record);
          utterance.rate = this.rate;
          utterance.voice = this.voice;
          if (this.voice?.lang) utterance.lang = this.voice.lang;
          const relevant = () => current() && !record.completed && record.order >= this.activeOrder;
          const activate = () => {
            if (!relevant()) return false;
            if (record.order > this.activeOrder || this.state.index !== record.index) {
              for (const skipped of records.slice(this.activeOrder, record.order)) {
                if (!skipped.completed && !this.unconfirmedStarts.has(skipped.index)) {
                  this.unconfirmedStarts.set(skipped.index, skipped.start);
                }
              }
              this.activeOrder = record.order;
              this.cursor = record.start;
              this._emit({ index: record.index, wordStart: -1, wordLength: 0 });
            }
            return current();
          };
          utterance.onstart = () => { if (activate()) this.onStart(); };
          utterance.onboundary = event => {
            if (!activate() || (event.name && event.name !== 'word' && event.name !== 'sentence')) return;
            this.onStart();
            const offset = event.charIndex;
            if (!Number.isInteger(offset) || offset < 0 || offset >= text.length) return;
            const absolute = record.start + offset;
            if (absolute < this.cursor || /\s/u.test(text[offset])) return;
            const remaining = text.slice(offset);
            const supplied = event.charLength;
            const length = Number.isInteger(supplied) && supplied > 0
              ? Math.min(supplied, remaining.length) : (event.name === 'sentence' ? (remaining.match(/^.*?[.!?](?:\s|$)/u)?.[0].length ?? remaining.length) : (remaining.match(/^\S+/u)?.[0].length ?? 0));
            this.cursor = absolute;
            this._emit({ wordStart: absolute, wordLength: length });
          };
          utterance.onend = () => {
            if (!activate()) return;
            record.completed = true;
            // A missing earlier end event is not evidence that a paragraph was
            // fully heard, even when a later native utterance has finished.
            if (record.end === paragraph.text.length && records.filter(item => item.index === record.index).every(item => item.completed)) {
              this.onParagraphEnd(paragraph, record.index);
              if (!current()) return;
            }
            const next = records[record.order + 1];
            if (next) {
              this.activeOrder = next.order;
              this.cursor = next.start;
              this._emit({ index: next.index, wordStart: -1, wordLength: 0 });
            } else {
              this.generation += 1;
              this.cursor = 0;
              this.utterances = [];
              this._emit({ status: 'finished', wordStart: -1, wordLength: 0 });
            }
          };
          utterance.onerror = event => {
            if (relevant()) fail(String(event.error || 'Speech playback failed.'));
          };
          start = end;
        }
      }
      // Retain every native utterance and submit the whole run synchronously.
      // The browser, rather than an end callback, owns the audio handoff from
      // attribution to body, between chunks, and into the following update.
      this.utterances = records.map(record => record.utterance);
      for (const record of records) {
        if (!current()) break;
        this.synth.speak(record.utterance);
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
  }

}

/** Keep every code unit and whole words. An indivisible long token may exceed
 * the soft cap. Prefer sentence boundaries, then whitespace; never split emoji.
 */
function chunkEnd(text, start, cap = 240) {
  if (text.length - start <= cap) return text.length;
  const window = text.slice(start, start + cap);
  const sentences = [...window.matchAll(/[.!?]["'”’)]*\s+/gu)];
  const sentence = sentences.at(-1);
  if (sentence) return start + sentence.index + sentence[0].length;
  const spaces = [...window.matchAll(/\s+/gu)];
  const last = spaces.at(-1);
  if (last && last.index > 0) return start + last.index + last[0].length;
  const nextSpace = text.slice(start + cap).search(/\s/u);
  return nextSpace < 0 ? text.length : start + cap + nextSpace + 1;
}

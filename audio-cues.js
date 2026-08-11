(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZaeraAudioCues = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Audio/haptic cue service (docs/WORKOUT_RUNNER_SPEC.md Phase 4) ──────
  // Deliberately dumb and side-effect-only: it has no idea what a "workout"
  // is, no timing logic, no dedup logic (that's workout-runner.js's job --
  // this module trusts every cue it's handed is meant to play). Its only
  // two jobs are "say this out loud, safely" and "buzz the phone, safely."
  // Speech/vibration/network/cache/audio APIs are all injectable so this is
  // fully unit-testable in Node without a real browser -- same pattern as
  // workout-runner.js's injectable clock.
  //
  // Platform-availability note (docs/WORKOUT_RUNNER_SPEC.md §2): the Web
  // Speech API used here is on-device/local (no network call, no paid
  // service), which is reliable while the tab is foregrounded. It is NOT
  // guaranteed to keep working once the screen locks or the app is
  // backgrounded on Android -- see the spec doc for why, and why that's a
  // platform limitation, not a bug in this module. Per the approved
  // requirement, audio availability must never gate workout timing or
  // completion -- this module is intentionally fire-and-forget and never
  // blocks or delays the caller.
  //
  // ── Neural TTS (docs/COACHING_ENGINE_SPEC.md follow-up) ──────────────────
  // Optional second delivery path via netlify/functions/tts.js (OpenAI TTS,
  // server-side key, never exposed to the client). Disabled by default --
  // this is a real per-character cost on the app owner's OpenAI key with no
  // spending cap today, so it's opt-in, not silently on. When enabled:
  //   1. Check the injected audioCache for this exact (voice, text) pair.
  //   2. On a cache miss, fetch it from the proxy with a bounded timeout.
  //   3. On ANY failure (offline, timeout, proxy error, playback error),
  //      fall straight through to the existing Web Speech path for that
  //      cue -- never silence, never a delay that blocks the workout.
  // The cue catalog is a small, bounded, mostly-repeated set of phrases
  // (docs/COACHING_ENGINE_SPEC.md), so after the first time any exact
  // phrase is spoken on a device it's free and instant from the cache for
  // every future workout -- only genuinely new text (a new pace number, a
  // new interval count) ever hits the network again.

  function createCueService(opts) {
    opts = opts || {};
    var speechApi = opts.speechApi !== undefined ? opts.speechApi : (typeof window !== 'undefined' ? window.speechSynthesis : null);
    var UtteranceCtor = opts.SpeechSynthesisUtterance !== undefined ? opts.SpeechSynthesisUtterance : (typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : null);
    var vibrateFn = opts.vibrate !== undefined ? opts.vibrate : (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' ? navigator.vibrate.bind(navigator) : null);

    var speechAvailable = !!(speechApi && UtteranceCtor);
    var enabled = opts.enabled !== false; // default ON -- audio cues are the whole point of this feature, unlike the app's other opt-in notifications
    var volume = opts.volume != null ? Math.max(0, Math.min(1, opts.volume)) : 1;
    // voiceURI identifies a specific installed Web Speech voice (matched
    // against speechSynthesis.getVoices()' own .voiceURI at speak time, not
    // cached -- the voice list can arrive asynchronously after the engine
    // loads, so re-resolving on every utterance is deliberate, not
    // wasteful). null means "let the platform pick its own default," same
    // as before this feature existed -- never a hard requirement.
    var voiceURI = opts.voiceURI || null;

    // Neural TTS wiring -- every dependency injectable, all optional. If
    // fetchFn/AudioCtor aren't available (older browser, or simply not
    // supplied), neural mode silently behaves as disabled regardless of
    // neuralEnabled, falling through to Web Speech every time.
    var neuralEnabled = !!opts.neuralEnabled;
    var ttsVoice = opts.ttsVoice || 'nova';
    var ttsEndpoint = opts.ttsEndpoint || '/.netlify/functions/tts';
    var ttsTimeoutMs = opts.ttsTimeoutMs != null ? opts.ttsTimeoutMs : 4000;
    var fetchFn = opts.fetchFn !== undefined ? opts.fetchFn : (typeof fetch !== 'undefined' ? fetch : null);
    var AudioCtor = opts.AudioCtor !== undefined ? opts.AudioCtor : (typeof Audio !== 'undefined' ? Audio : null);
    var createObjectURL = opts.createObjectURL !== undefined ? opts.createObjectURL : (typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL.bind(URL) : null);
    // audioCache: { get(key) -> Promise<Blob|null>, put(key, blob) -> Promise }
    // Browser implementation (wrapping the real Cache Storage API) lives in
    // app.js; tests inject a simple in-memory fake. null/absent just means
    // "no caching," not an error -- every cue would hit the network fresh,
    // which still works, just isn't free after the first time.
    var audioCache = opts.audioCache || null;
    var neuralAvailable = function () { return neuralEnabled && !!fetchFn && !!AudioCtor && !!createObjectURL; };
    var nowFn = opts.now || function () { return Date.now(); };

    var queue = [];      // priority-aware sequential queue; each item carries expiry metadata
    var speaking = false;
    var currentItem = null;
    var sequence = 0;
    var currentAudioEl = null; // the in-flight neural <audio> element, if any -- tracked so stopAll() can actually silence it
    var stopToken = 0;         // bumped by stopAll() -- invalidates any in-flight neural fetch/cache lookup so a late response can't start playing after the workout it belonged to has already stopped

    function setEnabled(v) { enabled = !!v; if (!enabled) stopAll(); }
    function setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (currentAudioEl) currentAudioEl.volume = volume; }
    function setVoice(uri) { voiceURI = uri || null; }
    function setNeuralEnabled(v) { neuralEnabled = !!v; }
    function setTtsVoice(v) { ttsVoice = v || 'nova'; }
    // Delegates straight to the engine -- deliberately not cached here,
    // since Chrome/Android commonly returns an empty list until the async
    // 'voiceschanged' event fires once after the engine finishes loading
    // its voice roster. Callers needing to react to that should listen for
    // 'voiceschanged' on the injected speechApi themselves (app.js does,
    // for the Settings voice picker).
    function getVoices() { return (speechApi && typeof speechApi.getVoices === 'function') ? speechApi.getVoices() : []; }
    // Resolves the currently-selected voiceURI to a real voice object, or
    // null if unset/not found (e.g. not loaded yet, or the device no
    // longer has it) -- callers never need to handle "found but stale."
    function resolveVoice() {
      if (!voiceURI) return null;
      var match = getVoices().filter(function (v) { return v.voiceURI === voiceURI; });
      return match[0] || null;
    }

    function vibrate(pattern) {
      if (!vibrateFn || !pattern) return false;
      try { vibrateFn(pattern); return true; } catch (e) { return false; }
    }

    function speakNext() {
      if (speaking) return;
      while (queue.length && queue[0].expiresAt <= nowFn()) queue.shift();
      if (!queue.length) return;
      if (!enabled) { queue = []; return; }
      if (!speechAvailable && !neuralAvailable()) { queue = []; return; }
      var item = queue.shift();
      if (item.expiresAt <= nowFn()) { speakNext(); return; }
      speaking = true;
      currentItem = item;
      var myToken = stopToken;

      if (neuralAvailable()) {
        speakViaNeural(item, myToken).then(function (played) {
          if (myToken !== stopToken) return; // stopAll() happened while this was in flight -- do not resume a queue that's already been cleared
          if (played) { speaking = false; currentItem = null; speakNext(); }
          else speakViaWebSpeech(item, myToken);
        });
      } else {
        speakViaWebSpeech(item, myToken);
      }
    }

    function speakViaWebSpeech(item, myToken) {
      if (item.expiresAt <= nowFn()) { speaking = false; currentItem = null; speakNext(); return; }
      if (!speechAvailable) { speaking = false; currentItem = null; speakNext(); return; }
      try {
        var utt = new UtteranceCtor(item.text);
        utt.volume = volume;
        // A voice that isn't found (unset, not loaded yet, or removed from
        // the device) just falls through to the platform's own default --
        // never an error, never blocks speech.
        var resolvedVoice = resolveVoice();
        if (resolvedVoice) utt.voice = resolvedVoice;
        utt.onend = function () { if (myToken !== stopToken) return; speaking = false; currentItem = null; speakNext(); };
        // A speech engine error must never hang the queue or block the
        // workout -- move on exactly as if it had spoken successfully.
        utt.onerror = function () { if (myToken !== stopToken) return; speaking = false; currentItem = null; speakNext(); };
        speechApi.speak(utt);
      } catch (e) {
        speaking = false;
        currentItem = null;
        speakNext();
      }
    }

    // Cache key includes the voice, since the same text rendered by two
    // different OpenAI voices is two different audio files.
    function cacheKeyFor(text) { return ttsVoice + '::' + text; }

    // Returns a Promise<boolean> -- true if the cue was actually played via
    // neural TTS, false if the caller should fall back to Web Speech for
    // this cue. Never rejects -- every failure mode (cache error, network
    // error, timeout, playback error) resolves false instead.
    //
    // myToken is re-checked against the live stopToken at EVERY async
    // resumption point, not just once when the whole chain finishes --
    // stopAll() can happen while a cache lookup or network fetch is still
    // in flight, and without re-checking right before the side-effecting
    // playBlob() call, a stop could still be "raced" by a fetch that
    // resolves moments later, starting audio for a workout that already
    // ended (found by the test suite, not assumed safe).
    function speakViaNeural(item, myToken) {
      var key = cacheKeyFor(item.text);
      var cacheGet = (audioCache && typeof audioCache.get === 'function')
        ? audioCache.get(key).catch(function () { return null; })
        : Promise.resolve(null);

      return cacheGet.then(function (cachedBlob) {
        if (myToken !== stopToken || item.expiresAt <= nowFn()) return false;
        if (cachedBlob) return playBlob(cachedBlob, myToken);
        return fetchBlob(item.text).then(function (blob) {
          if (myToken !== stopToken || item.expiresAt <= nowFn()) return false;
          if (!blob) return false;
          if (audioCache && typeof audioCache.put === 'function') {
            try { audioCache.put(key, blob); } catch (e) { /* caching is best-effort -- a failed write must never block playback */ }
          }
          return playBlob(blob, myToken);
        });
      });
    }

    // Fetches one rendered cue from the TTS proxy, bounded by ttsTimeoutMs
    // -- a slow/hanging network call must never delay a coaching cue
    // indefinitely; it just falls back to Web Speech as if the network
    // request had failed outright.
    function fetchBlob(text) {
      var fetchPromise = fetchFn(ttsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, voice: ttsVoice })
      }).then(function (res) {
        if (!res || !res.ok) return null;
        return res.blob();
      }).catch(function () { return null; });

      var timeoutPromise = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, ttsTimeoutMs); });
      return Promise.race([fetchPromise, timeoutPromise]);
    }

    function playBlob(blob, myToken) {
      if (myToken !== undefined && myToken !== stopToken) return Promise.resolve(false);
      return new Promise(function (resolve) {
        var url;
        try { url = createObjectURL(blob); } catch (e) { resolve(false); return; }
        try {
          var el = new AudioCtor(url);
          el.volume = volume;
          currentAudioEl = el;
          el.onended = function () { if (currentAudioEl === el) currentAudioEl = null; resolve(true); };
          el.onerror = function () { if (currentAudioEl === el) currentAudioEl = null; resolve(false); };
          var playResult = el.play();
          if (playResult && typeof playResult.catch === 'function') {
            playResult.catch(function () { if (currentAudioEl === el) currentAudioEl = null; resolve(false); });
          }
        } catch (e) {
          resolve(false);
        }
      });
    }

    // Plays one already-deduped cue (workout-runner.js is the sole source
    // of truth for whether a cue should fire at all -- this function never
    // re-checks that). Speaks it (if enabled and available) and vibrates
    // (if available) -- vibration fires independently of the audio on/off
    // preference, so a muted runner still gets haptic feedback, matching
    // the requirement for a non-audio cue channel.
    function playCue(text, hapticPattern, meta) {
      meta = meta || {};
      if (enabled && (speechAvailable || neuralAvailable()) && text) {
        var item = {
          text: text,
          priority: meta.priority != null ? meta.priority : 99,
          expiresAt: meta.expiresAt != null ? meta.expiresAt : Infinity,
          sequence: sequence++
        };
        if (item.expiresAt > nowFn()) {
          if (meta.replaceLowerPriority) queue = queue.filter(function (queued) { return queued.priority <= item.priority && queued.expiresAt > nowFn(); });
          queue.push(item);
          queue.sort(function (a, b) { return a.priority - b.priority || a.sequence - b.sequence; });
          if (meta.interrupt && currentItem && item.priority < currentItem.priority) interruptCurrent();
          speakNext();
        }
      }
      if (hapticPattern) vibrate(hapticPattern);
    }

    function interruptCurrent() {
      stopToken++;
      if (speechApi && typeof speechApi.cancel === 'function') { try { speechApi.cancel(); } catch (e) {} }
      if (currentAudioEl) { try { currentAudioEl.pause(); } catch (e) {} currentAudioEl = null; }
      speaking = false;
      currentItem = null;
    }

    // Called on pause and on workout end (completed/ended_early) -- clears
    // anything still queued, cancels Web Speech, AND stops/silences any
    // in-flight neural playback or pending fetch (via stopToken) so a cue
    // never speaks after the workout it belonged to has already stopped.
    function stopAll() {
      queue = [];
      stopToken++;
      if (speechApi && typeof speechApi.cancel === 'function') { try { speechApi.cancel(); } catch (e) {} }
      if (currentAudioEl) { try { currentAudioEl.pause(); } catch (e) {} currentAudioEl = null; }
      speaking = false;
      currentItem = null;
    }

    return {
      get enabled() { return enabled; },
      get volume() { return volume; },
      get voiceURI() { return voiceURI; },
      get speechAvailable() { return speechAvailable; },
      get neuralEnabled() { return neuralEnabled; },
      get neuralAvailable() { return neuralAvailable(); },
      get ttsVoice() { return ttsVoice; },
      setEnabled: setEnabled, setVolume: setVolume, setVoice: setVoice, getVoices: getVoices,
      setNeuralEnabled: setNeuralEnabled, setTtsVoice: setTtsVoice,
      playCue: playCue, vibrate: vibrate, stopAll: stopAll
    };
  }

  // Short, distinct haptic patterns per cue type -- conservative by design
  // (a supplement, never spam). navigator.vibrate has no iOS Safari support
  // at all; on unsupported platforms these are simply no-ops (vibrate()
  // returns false), never an error.
  var HAPTIC_PATTERNS = {
    segment_start: [80],
    warning_10s: [40, 40, 40],
    halfway: [60],
    final_third: [60, 60],
    final_interval: [60, 40, 60],
    paused: [30],
    resumed: [30, 30, 30],
    complete: [100, 60, 100]
  };

  // OpenAI's documented TTS voice set, mirrored from netlify/functions/tts.js
  // so app.js's Settings picker can list them without a network round-trip
  // just to discover what's available.
  var NEURAL_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'];

  return { createCueService: createCueService, HAPTIC_PATTERNS: HAPTIC_PATTERNS, NEURAL_VOICES: NEURAL_VOICES };
});

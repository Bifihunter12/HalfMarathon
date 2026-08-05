(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RACRAudioCues = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Audio/haptic cue service (docs/WORKOUT_RUNNER_SPEC.md Phase 4) ──────
  // Deliberately dumb and side-effect-only: it has no idea what a "workout"
  // is, no timing logic, no dedup logic (that's workout-runner.js's job --
  // this module trusts every cue it's handed is meant to play). Its only
  // two jobs are "say this out loud, safely" and "buzz the phone, safely."
  // Speech and vibration APIs are injectable (opts.speechApi/opts.vibrate/
  // opts.SpeechSynthesisUtterance) so this is fully unit-testable in Node
  // without a real browser -- same pattern as workout-runner.js's
  // injectable clock.
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

  function createCueService(opts) {
    opts = opts || {};
    var speechApi = opts.speechApi !== undefined ? opts.speechApi : (typeof window !== 'undefined' ? window.speechSynthesis : null);
    var UtteranceCtor = opts.SpeechSynthesisUtterance !== undefined ? opts.SpeechSynthesisUtterance : (typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : null);
    var vibrateFn = opts.vibrate !== undefined ? opts.vibrate : (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' ? navigator.vibrate.bind(navigator) : null);

    var speechAvailable = !!(speechApi && UtteranceCtor);
    var enabled = opts.enabled !== false; // default ON -- audio cues are the whole point of this feature, unlike the app's other opt-in notifications
    var volume = opts.volume != null ? Math.max(0, Math.min(1, opts.volume)) : 1;

    var queue = [];      // sequential speak queue -- overlapping cues never clobber each other
    var speaking = false;

    function setEnabled(v) { enabled = !!v; if (!enabled) stopAll(); }
    function setVolume(v) { volume = Math.max(0, Math.min(1, v)); }

    function vibrate(pattern) {
      if (!vibrateFn || !pattern) return false;
      try { vibrateFn(pattern); return true; } catch (e) { return false; }
    }

    function speakNext() {
      if (speaking || !queue.length) return;
      if (!enabled || !speechAvailable) { queue = []; return; }
      var text = queue.shift();
      speaking = true;
      try {
        var utt = new UtteranceCtor(text);
        utt.volume = volume;
        utt.onend = function () { speaking = false; speakNext(); };
        // A speech engine error must never hang the queue or block the
        // workout -- move on exactly as if it had spoken successfully.
        utt.onerror = function () { speaking = false; speakNext(); };
        speechApi.speak(utt);
      } catch (e) {
        speaking = false;
      }
    }

    // Plays one already-deduped cue (workout-runner.js is the sole source
    // of truth for whether a cue should fire at all -- this function never
    // re-checks that). Speaks it (if enabled and available) and vibrates
    // (if available) -- vibration fires independently of the audio on/off
    // preference, so a muted runner still gets haptic feedback, matching
    // the requirement for a non-audio cue channel.
    function playCue(text, hapticPattern) {
      if (enabled && speechAvailable && text) { queue.push(text); speakNext(); }
      if (hapticPattern) vibrate(hapticPattern);
    }

    // Called on pause and on workout end (completed/ended_early) -- clears
    // anything still queued so a cue never speaks after the workout it
    // belonged to has already stopped.
    function stopAll() {
      queue = [];
      if (speechApi && typeof speechApi.cancel === 'function') { try { speechApi.cancel(); } catch (e) {} }
      speaking = false;
    }

    return {
      get enabled() { return enabled; },
      get volume() { return volume; },
      get speechAvailable() { return speechAvailable; },
      setEnabled: setEnabled, setVolume: setVolume, playCue: playCue, vibrate: vibrate, stopAll: stopAll
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
    final_interval: [60, 40, 60],
    paused: [30],
    resumed: [30, 30, 30],
    complete: [100, 60, 100]
  };

  return { createCueService: createCueService, HAPTIC_PATTERNS: HAPTIC_PATTERNS };
});

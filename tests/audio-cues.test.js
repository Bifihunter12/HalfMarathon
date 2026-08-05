const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const AudioCues = require(path.join(__dirname, '..', 'audio-cues.js'));

// ── Fake Web Speech API -- records every utterance spoken, in order, and
// fires onend asynchronously (via a manual `flush()`) so tests can assert
// queue ordering deterministically without real timers. ──────────────────
function fakeSpeechApi() {
  var spoken = [];
  var pending = [];
  var api = {
    speak: function (utt) { spoken.push(utt.text); pending.push(utt); },
    cancel: function () { pending = []; },
    spoken: spoken,
    flush: function () { // simulate the current utterance finishing normally
      var utt = pending.shift();
      if (utt && utt.onend) utt.onend();
    },
    flushWithError: function () { // simulate the current utterance failing
      var utt = pending.shift();
      if (utt && utt.onerror) utt.onerror(new Error('speech engine failure'));
    }
  };
  return api;
}
function fakeUtteranceCtor() {
  return function (text) { this.text = text; this.volume = 1; this.onend = null; this.onerror = null; };
}

function makeService(overrides) {
  var speechApi = fakeSpeechApi();
  var UtteranceCtor = fakeUtteranceCtor();
  var vibrated = [];
  var svc = AudioCues.createCueService(Object.assign({
    speechApi: speechApi,
    SpeechSynthesisUtterance: UtteranceCtor,
    vibrate: function (pattern) { vibrated.push(pattern); }
  }, overrides || {}));
  return { svc: svc, speechApi: speechApi, vibrated: vibrated };
}

test('cues are spoken in the order they were played, one at a time (sequential queue)', function () {
  var t = makeService();
  t.svc.playCue('Begin warm-up', null);
  t.svc.playCue('Start running', null);
  assert.deepEqual(t.speechApi.spoken, ['Begin warm-up'], 'the second cue must wait for the first to finish, not speak simultaneously');
  t.speechApi.flush();
  assert.deepEqual(t.speechApi.spoken, ['Begin warm-up', 'Start running']);
});

test('audio-disabled preference: no speech is queued while disabled', function () {
  var t = makeService({ enabled: false });
  t.svc.playCue('Start running', null);
  assert.deepEqual(t.speechApi.spoken, []);
});

test('setEnabled(false) stops anything currently queued/speaking', function () {
  var t = makeService();
  t.svc.playCue('one', null);
  t.svc.playCue('two', null);
  t.svc.setEnabled(false);
  t.speechApi.flush(); // "one" finishes -- queue should now be empty, "two" must not speak
  assert.deepEqual(t.speechApi.spoken, ['one']);
});

test('vibration fires independently of the audio on/off preference', function () {
  var t = makeService({ enabled: false });
  t.svc.playCue('muted cue', [80]);
  assert.deepEqual(t.vibrated, [[80]], 'a muted runner must still get haptic feedback');
});

test('pause and resume cues play like any other cue, through the same queue', function () {
  var t = makeService();
  t.svc.playCue('Workout paused', AudioCues.HAPTIC_PATTERNS.paused);
  assert.deepEqual(t.speechApi.spoken, ['Workout paused']);
  t.speechApi.flush();
  t.svc.playCue('Workout resumed', AudioCues.HAPTIC_PATTERNS.resumed);
  assert.deepEqual(t.speechApi.spoken, ['Workout paused', 'Workout resumed']);
});

test('stopAll clears the queue and cancels in-progress speech -- no cue plays after workout termination', function () {
  var t = makeService();
  t.svc.playCue('one', null);
  t.svc.playCue('two', null); // queued behind "one"
  t.svc.stopAll();
  t.speechApi.flush(); // even if the underlying engine still fires onend late, nothing further should speak
  assert.deepEqual(t.speechApi.spoken, ['one'], 'only what had already started speaking before stopAll should ever have played');
});

test('when speech is unavailable, playCue never throws and vibration still works', function () {
  var vibrated = [];
  var svc = AudioCues.createCueService({ speechApi: null, SpeechSynthesisUtterance: null, vibrate: function (p) { vibrated.push(p); } });
  assert.equal(svc.speechAvailable, false);
  assert.doesNotThrow(function () { svc.playCue('Start running', [80]); });
  assert.deepEqual(vibrated, [[80]]);
});

test('when vibration is unavailable, playCue never throws and speech still works', function () {
  var t = makeService({ vibrate: null });
  assert.doesNotThrow(function () { t.svc.playCue('Start running', [80]); });
  assert.deepEqual(t.speechApi.spoken, ['Start running']);
});

test('a speech engine error does not hang the queue -- the next cue still plays', function () {
  var t = makeService();
  t.svc.playCue('one', null);
  t.svc.playCue('two', null); // queued behind "one"
  t.speechApi.flushWithError(); // "one" fails instead of completing normally
  assert.deepEqual(t.speechApi.spoken, ['one', 'two'], 'an engine error must move on to the next queued cue, not hang forever');
});

test('volume is clamped to [0, 1]', function () {
  var t = makeService({ volume: 5 });
  assert.equal(t.svc.volume, 1);
  t.svc.setVolume(-2);
  assert.equal(t.svc.volume, 0);
});

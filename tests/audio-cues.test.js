const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const AudioCues = require(path.join(__dirname, '..', 'audio-cues.js'));

// ── Fake Web Speech API -- records every utterance spoken, in order, and
// fires onend asynchronously (via a manual `flush()`) so tests can assert
// queue ordering deterministically without real timers. ──────────────────
function fakeSpeechApi(voices) {
  var spoken = [];
  var pending = [];
  var voiceList = voices || [];
  var api = {
    speak: function (utt) { spoken.push(utt.text); pending.push(utt); },
    cancel: function () { pending = []; },
    getVoices: function () { return voiceList; },
    setVoiceList: function (v) { voiceList = v; }, // test helper -- simulates the async voice list arriving late
    spoken: spoken,
    flush: function () { // simulate the current utterance finishing normally
      var utt = pending.shift();
      if (utt && utt.onend) utt.onend();
    },
    flushWithError: function () { // simulate the current utterance failing
      var utt = pending.shift();
      if (utt && utt.onerror) utt.onerror(new Error('speech engine failure'));
    },
    lastUtterance: function () { return pending[pending.length - 1]; }
  };
  return api;
}
function fakeUtteranceCtor() {
  return function (text) { this.text = text; this.volume = 1; this.voice = undefined; this.onend = null; this.onerror = null; };
}

function makeService(overrides, voices) {
  var speechApi = fakeSpeechApi(voices);
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

// ═══════════════════════════════════════════════════════════════════════
// Voice selection
// ═══════════════════════════════════════════════════════════════════════

var VOICE_A = { voiceURI: 'a', name: 'Voice A', lang: 'en-US' };
var VOICE_B = { voiceURI: 'b', name: 'Voice B', lang: 'en-GB' };

test('getVoices delegates to the underlying speech engine', function () {
  var t = makeService({}, [VOICE_A, VOICE_B]);
  assert.deepEqual(t.svc.getVoices(), [VOICE_A, VOICE_B]);
});

test('getVoices returns an empty array when the engine has none loaded yet (not an error)', function () {
  var t = makeService({}, []);
  assert.deepEqual(t.svc.getVoices(), []);
});

test('a selected voice is applied to the spoken utterance', function () {
  var t = makeService({ voiceURI: 'b' }, [VOICE_A, VOICE_B]);
  t.svc.playCue('Start running', null);
  assert.equal(t.speechApi.lastUtterance().voice, VOICE_B);
});

test('setVoice changes which voice future utterances use', function () {
  var t = makeService({}, [VOICE_A, VOICE_B]);
  t.svc.setVoice('a');
  t.svc.playCue('one', null);
  assert.equal(t.speechApi.lastUtterance().voice, VOICE_A);
  t.speechApi.flush();
  t.svc.setVoice('b');
  t.svc.playCue('two', null);
  assert.equal(t.speechApi.lastUtterance().voice, VOICE_B);
});

test('an unset voice leaves the platform default (utterance.voice stays unset), never throws', function () {
  var t = makeService({}, [VOICE_A, VOICE_B]);
  assert.doesNotThrow(function () { t.svc.playCue('Start running', null); });
  assert.equal(t.speechApi.lastUtterance().voice, undefined);
});

test('a voiceURI that does not match any loaded voice falls back to the platform default instead of throwing', function () {
  var t = makeService({ voiceURI: 'does-not-exist' }, [VOICE_A]);
  assert.doesNotThrow(function () { t.svc.playCue('Start running', null); });
  assert.equal(t.speechApi.lastUtterance().voice, undefined);
});

test('the voice is re-resolved on every utterance, so a voice list that arrives late (async voiceschanged) is picked up without re-selecting', function () {
  var t = makeService({ voiceURI: 'a' }, []); // not loaded yet when the service was created
  t.svc.playCue('one', null);
  assert.equal(t.speechApi.lastUtterance().voice, undefined, 'no matching voice yet -- falls back gracefully');
  t.speechApi.flush();
  t.speechApi.setVoiceList([VOICE_A, VOICE_B]); // voice list "arrives" (simulates voiceschanged firing)
  t.svc.playCue('two', null);
  assert.equal(t.speechApi.lastUtterance().voice, VOICE_A, 'now resolves correctly without any setVoice() call needed');
});

test('voiceURI getter reflects the current selection', function () {
  var t = makeService({}, [VOICE_A]);
  assert.equal(t.svc.voiceURI, null);
  t.svc.setVoice('a');
  assert.equal(t.svc.voiceURI, 'a');
  t.svc.setVoice(null);
  assert.equal(t.svc.voiceURI, null);
});

// ═══════════════════════════════════════════════════════════════════════
// Neural TTS (docs/COACHING_ENGINE_SPEC.md follow-up)
// ═══════════════════════════════════════════════════════════════════════

function fakeAudioEl() {
  return {
    volume: 1, onended: null, onerror: null, paused: false,
    play: function () { return Promise.resolve(); },
    pause: function () { this.paused = true; }
  };
}
function fakeAudioCtor(created) {
  return function (url) {
    var el = fakeAudioEl();
    el.src = url;
    created.push(el);
    return el;
  };
}
function fakeCache() {
  var store = {};
  return {
    store: store,
    get: function (key) { return Promise.resolve(Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null); },
    put: function (key, blob) { store[key] = blob; return Promise.resolve(); }
  };
}
function fakeBlob(id) { return { id: id || 'blob' }; }

function makeNeuralService(overrides) {
  var speechApi = fakeSpeechApi();
  var UtteranceCtor = fakeUtteranceCtor();
  var created = [];
  var vibrated = [];
  var fetchCalls = [];
  var opts = Object.assign({
    speechApi: speechApi, SpeechSynthesisUtterance: UtteranceCtor,
    vibrate: function (p) { vibrated.push(p); },
    neuralEnabled: true,
    AudioCtor: fakeAudioCtor(created),
    createObjectURL: function (blob) { return 'blob://' + blob.id; },
    fetchFn: function (url, reqOpts) {
      fetchCalls.push({ url: url, body: JSON.parse(reqOpts.body) });
      return Promise.resolve({ ok: true, blob: function () { return Promise.resolve(fakeBlob('fetched')); } });
    },
    audioCache: fakeCache()
  }, overrides || {});
  var svc = AudioCues.createCueService(opts);
  return { svc: svc, speechApi: speechApi, created: created, vibrated: vibrated, fetchCalls: fetchCalls, cache: opts.audioCache };
}

test('neural TTS: a cache hit plays immediately without calling fetch', async function () {
  var t = makeNeuralService();
  t.cache.store['nova::Start running'] = fakeBlob('cached');
  t.svc.playCue('Start running', null);
  await new Promise(function (r) { setTimeout(r, 10); });
  assert.equal(t.fetchCalls.length, 0, 'a cached phrase must never hit the network');
  assert.equal(t.created.length, 1, 'exactly one audio element played');
  assert.equal(t.created[0].src, 'blob://cached');
});

test('neural TTS: a cache miss fetches, plays, and stores the result for next time', async function () {
  var t = makeNeuralService();
  t.svc.playCue('Begin your warm-up', null);
  await new Promise(function (r) { setTimeout(r, 10); });
  assert.equal(t.fetchCalls.length, 1);
  assert.equal(t.fetchCalls[0].body.text, 'Begin your warm-up');
  assert.equal(t.fetchCalls[0].body.voice, 'nova');
  assert.equal(t.created[0].src, 'blob://fetched');
  assert.deepEqual(t.cache.store['nova::Begin your warm-up'], fakeBlob('fetched'), 'must be cached for future workouts');
});

test('neural TTS: a network failure falls back to Web Speech for that cue, never silence', async function () {
  var t = makeNeuralService({ fetchFn: function () { return Promise.reject(new Error('offline')); } });
  t.svc.playCue('Start running', null);
  await new Promise(function (r) { setTimeout(r, 10); });
  assert.equal(t.created.length, 0, 'no neural audio should have played');
  assert.deepEqual(t.speechApi.spoken, ['Start running'], 'must fall back to Web Speech instead of going silent');
});

test('neural TTS: a slow response past the timeout falls back to Web Speech instead of waiting indefinitely', async function () {
  var t = makeNeuralService({
    ttsTimeoutMs: 15,
    fetchFn: function () { return new Promise(function (resolve) { setTimeout(function () { resolve({ ok: true, blob: function () { return Promise.resolve(fakeBlob('late')); } }); }, 500); }); }
  });
  t.svc.playCue('Start running', null);
  await new Promise(function (r) { setTimeout(r, 40); });
  assert.deepEqual(t.speechApi.spoken, ['Start running'], 'must fall back once the timeout elapses, not wait for the slow response');
});

test('neural TTS: an upstream error response (ok:false) falls back to Web Speech', async function () {
  var t = makeNeuralService({ fetchFn: function () { return Promise.resolve({ ok: false }); } });
  t.svc.playCue('Start running', null);
  await new Promise(function (r) { setTimeout(r, 10); });
  assert.deepEqual(t.speechApi.spoken, ['Start running']);
});

test('neural TTS: an audio playback error falls back to Web Speech', async function () {
  var created = [];
  var AudioCtorWithError = function (url) {
    var el = fakeAudioEl();
    el.src = url;
    created.push(el);
    setTimeout(function () { if (el.onerror) el.onerror(); }, 5);
    return el;
  };
  var t = makeNeuralService({ AudioCtor: AudioCtorWithError });
  t.svc.playCue('Start running', null);
  await new Promise(function (r) { setTimeout(r, 20); });
  assert.deepEqual(t.speechApi.spoken, ['Start running'], 'a playback error must still fall back, not go silent');
});

test('neural TTS: cues are still sequential -- the second cue does not start until the first finishes', async function () {
  var t = makeNeuralService();
  t.svc.playCue('one', null);
  t.svc.playCue('two', null);
  await new Promise(function (r) { setTimeout(r, 10); });
  assert.equal(t.created.length, 1, 'only the first cue should have started playing so far');
  t.created[0].onended();
  await new Promise(function (r) { setTimeout(r, 10); });
  assert.equal(t.created.length, 2);
});

test('neural TTS: stopAll pauses in-flight playback and prevents a late-arriving fetch from playing', async function () {
  var resolveFetch;
  var t = makeNeuralService({
    fetchFn: function () { return new Promise(function (resolve) { resolveFetch = resolve; }); }
  });
  t.svc.playCue('Start running', null);
  await new Promise(function (r) { setTimeout(r, 5); }); // fetch is now in flight, nothing played yet
  t.svc.stopAll();
  resolveFetch({ ok: true, blob: function () { return Promise.resolve(fakeBlob('late-after-stop')); } });
  await new Promise(function (r) { setTimeout(r, 10); });
  assert.equal(t.created.length, 0, 'a fetch that resolves after stopAll() must never start playing');
  assert.deepEqual(t.speechApi.spoken, [], 'must not fall back to Web Speech either -- the workout already ended');
});

test('neural TTS: different tts voices use different cache entries for the same text', async function () {
  var t = makeNeuralService();
  t.cache.store['nova::Start running'] = fakeBlob('nova-cached');
  t.svc.setTtsVoice('shimmer');
  t.svc.playCue('Start running', null);
  await new Promise(function (r) { setTimeout(r, 10); });
  assert.equal(t.fetchCalls.length, 1, 'a different voice must not reuse another voice\'s cached audio');
  assert.equal(t.fetchCalls[0].body.voice, 'shimmer');
});

test('neural TTS: neuralEnabled false uses Web Speech even when fetch/Audio are available', async function () {
  var t = makeNeuralService({ neuralEnabled: false });
  t.svc.playCue('Start running', null);
  await new Promise(function (r) { setTimeout(r, 10); });
  assert.equal(t.fetchCalls.length, 0);
  assert.deepEqual(t.speechApi.spoken, ['Start running']);
});

test('neural TTS: neuralAvailable is false when required dependencies are missing, even if enabled', function () {
  var t = makeNeuralService({ fetchFn: null });
  assert.equal(t.svc.neuralAvailable, false);
});

test('neural TTS: vibration still fires alongside a neural cue', async function () {
  var t = makeNeuralService();
  t.svc.playCue('Start running', [80]);
  assert.deepEqual(t.vibrated, [[80]]);
});

test('neural TTS: setNeuralEnabled/setTtsVoice getters reflect current state', function () {
  var t = makeNeuralService({ neuralEnabled: false });
  assert.equal(t.svc.neuralEnabled, false);
  t.svc.setNeuralEnabled(true);
  assert.equal(t.svc.neuralEnabled, true);
  assert.equal(t.svc.ttsVoice, 'nova');
  t.svc.setTtsVoice('shimmer');
  assert.equal(t.svc.ttsVoice, 'shimmer');
});

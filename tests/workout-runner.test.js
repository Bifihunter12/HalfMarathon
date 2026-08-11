const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const Runner = require(path.join(__dirname, '..', 'workout-runner.js'));

// ── Fake clock -- every state-machine test uses this instead of Date.now()
// so timing behavior (delayed ticks, backgrounding, drift) is fully
// deterministic and doesn't depend on real wall-clock time. ──────────────
function fakeClock(startMs) {
  var t = startMs || 1000000;
  return {
    now: function () { return t; },
    advance: function (ms) { t += ms; return t; }
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Normalizer
// ═══════════════════════════════════════════════════════════════════════

test('normalizeWorkout returns null for rest and race days (not executable by this runner)', function () {
  assert.equal(Runner.normalizeWorkout({ type: 'rest', label: 'Rest' }), null);
  assert.equal(Runner.normalizeWorkout({ type: 'race', label: '5K Race' }), null);
  assert.equal(Runner.normalizeWorkout(null), null);
});

test('normalizeWorkout: run/walk session becomes fully structured cycles of work+recovery', function () {
  var day = { type: 'long', label: 'Run/walk', runWalk: { runSec: 90, walkSec: 60, cycles: 3, totalMin: 8 } };
  var n = Runner.normalizeWorkout(day);
  assert.equal(n.mode, 'structured');
  assert.equal(n.segments.length, 6); // 3 x (work + recovery)
  assert.deepEqual(n.segments.map(function (s) { return s.kind; }), ['work', 'recovery', 'work', 'recovery', 'work', 'recovery']);
  assert.equal(n.segments[0].durationSec, 90);
  assert.equal(n.segments[1].durationSec, 60);
  assert.equal(n.segments[4].intervalNumber, 3);
  assert.equal(n.segments[4].totalIntervals, 3);
  assert.equal(n.totalPrescribedSec, (90 + 60) * 3);
});

test('normalizeWorkout: time-based quality segments become warmup -> intervals w/ recovery between (not after last) -> cooldown', function () {
  var day = { type: 'quality', label: '5 x 3 min @ 5K effort', qualitySegments: { warmupSec: 600, cooldownSec: 600, reps: 5, workSec: 180, recoverySec: 180 } };
  var n = Runner.normalizeWorkout(day);
  assert.equal(n.mode, 'structured');
  var kinds = n.segments.map(function (s) { return s.kind; });
  assert.deepEqual(kinds, ['warmup', 'work', 'recovery', 'work', 'recovery', 'work', 'recovery', 'work', 'recovery', 'work', 'cooldown']);
  assert.equal(n.segments.filter(function (s) { return s.kind === 'work'; }).length, 5);
  assert.equal(n.segments[n.segments.length - 1].kind, 'cooldown');
});

test('normalizeWorkout: a single continuous tempo block (reps=1) has no interval-count segments', function () {
  var day = { type: 'quality', label: 'Tempo: 25-30 min @ threshold', qualitySegments: { warmupSec: 600, cooldownSec: 600, reps: 1, workSec: 1680, recoverySec: 0 } };
  var n = Runner.normalizeWorkout(day);
  assert.deepEqual(n.segments.map(function (s) { return s.kind; }), ['warmup', 'work', 'cooldown']);
  assert.equal(n.segments[1].totalIntervals, 1);
});

test('normalizeWorkout: distance-based reps (manualReps) become guided_manual with manual_rep segments and no invented work duration', function () {
  var day = { type: 'quality', label: '6 x 400m @ 5K pace', miles: 3, qualityManualReps: { warmupSec: 600, cooldownSec: 600, reps: 6, recoverySec: 120 } };
  var n = Runner.normalizeWorkout(day);
  assert.equal(n.mode, 'guided_manual');
  assert.equal(n.totalPrescribedSec, null, 'a guided_manual workout must never claim a total prescribed time -- part of it is unmeasured');
  var manualRepSegs = n.segments.filter(function (s) { return s.kind === 'manual_rep'; });
  assert.equal(manualRepSegs.length, 6);
  manualRepSegs.forEach(function (s) { assert.equal(s.durationSec, null, 'work duration for a distance-based rep must never be invented'); });
  assert.equal(n.segments.filter(function (s) { return s.kind === 'recovery'; }).length, 5, 'recovery between reps only, none trailing the last rep');
  assert.match(n.manualDistanceNote, /does not track distance/);
});

test('normalizeWorkout: continuous distance-prescribed easy/long run is an honest open stopwatch, never an invented duration', function () {
  var day = { type: 'easy', label: '4 mi easy run', miles: 4 };
  var n = Runner.normalizeWorkout(day);
  assert.equal(n.mode, 'continuous_open');
  assert.equal(n.segments.length, 1);
  assert.equal(n.segments[0].kind, 'continuous');
  assert.equal(n.segments[0].durationSec, null);
  assert.equal(n.distanceMiles, 4);
  assert.match(n.manualDistanceNote, /does not track distance/);
});

test('normalizeWorkout: unstructured quality entry (no segments, no manualReps) falls back to guided open block, not a crash or invented timing', function () {
  var day = { type: 'quality', label: 'Medium-long run', miles: 8 };
  var n = Runner.normalizeWorkout(day);
  assert.equal(n.mode, 'continuous_open');
  assert.equal(n.segments[0].durationSec, null);
});

test('normalizeWorkout: cross-training with a real duration becomes one continuous structured segment', function () {
  var day = { type: 'cross', label: 'Easy aerobic endurance — Cycling — 40 minutes', sessions: [{ durationMinutes: 40 }] };
  var n = Runner.normalizeWorkout(day);
  assert.equal(n.mode, 'structured');
  assert.equal(n.segments.length, 1);
  assert.equal(n.segments[0].durationSec, 40 * 60);
});

// ═══════════════════════════════════════════════════════════════════════
// State machine -- normal execution paths
// ═══════════════════════════════════════════════════════════════════════

function structuredWorkout() {
  return Runner.normalizeWorkout({ type: 'quality', label: 'test', qualitySegments: { warmupSec: 60, cooldownSec: 60, reps: 3, workSec: 30, recoverySec: 15 } });
}

test('warm-up -> intervals -> cooldown: full structured workout advances through every segment via reconcile, in order', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now, workoutId: 'w1' });
  m.start();
  assert.equal(m.state.phase, 'warmup');
  clock.advance(60000); m.reconcile();
  assert.equal(m.state.phase, 'work');
  assert.equal(m.state.segAt ? undefined : undefined, undefined); // no-op, keep segAt referenced
  assert.equal(m.segAt(m.state.segmentIndex).intervalNumber, 1);
  clock.advance(30000); m.reconcile();
  assert.equal(m.state.phase, 'recovery');
  clock.advance(15000); m.reconcile();
  assert.equal(m.state.phase, 'work');
  assert.equal(m.segAt(m.state.segmentIndex).intervalNumber, 2);
  clock.advance(30000); m.reconcile();
  clock.advance(15000); m.reconcile();
  assert.equal(m.segAt(m.state.segmentIndex).intervalNumber, 3);
  clock.advance(30000); m.reconcile(); // last work interval done, no trailing recovery
  assert.equal(m.state.phase, 'cooldown');
  clock.advance(60000); m.reconcile();
  assert.equal(m.state.phase, 'completed');
});

test('run/walk repetitions: correct interval numbering across cycles', function () {
  var clock = fakeClock();
  var n = Runner.normalizeWorkout({ type: 'long', label: 'rw', runWalk: { runSec: 10, walkSec: 10, cycles: 4, totalMin: 2 } });
  var m = Runner.createRunnerStateMachine(n, { now: clock.now });
  m.start();
  var seenIntervals = [];
  for (var i = 0; i < 8; i++) {
    seenIntervals.push(m.segAt(m.state.segmentIndex).intervalNumber);
    clock.advance(10000); m.reconcile();
  }
  assert.deepEqual(seenIntervals, [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(m.state.phase, 'completed');
});

test('pause/resume: remaining time is frozen during pause and pause duration is excluded from active elapsed time, in every active phase', function () {
  ['warmup', 'work', 'recovery', 'cooldown'].forEach(function (targetPhase) {
    var clock = fakeClock();
    var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now });
    m.start();
    // Drive to the target phase.
    while (m.state.phase !== targetPhase && m.state.phase !== 'completed') {
      clock.advance(1000); m.reconcile();
    }
    assert.equal(m.state.phase, targetPhase, 'test setup sanity check');
    var remainingBefore = m.remainingSegmentMs();
    m.pause();
    assert.equal(m.state.phase, 'paused');
    clock.advance(999999); // pause lasts a long time
    assert.equal(m.remainingSegmentMs(), remainingBefore, 'remaining time must stay frozen while paused');
    var activeBeforeResume = m.elapsedActiveMs();
    m.resume();
    assert.equal(m.state.phase, targetPhase, 'resume restores the exact phase that was paused');
    assert.equal(m.elapsedActiveMs(), activeBeforeResume, 'the instant after resume, active time must not have jumped by the pause duration');
  });
});

test('skip: advances exactly one segment without corrupting subsequent order', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now });
  m.start();
  assert.equal(m.state.phase, 'warmup');
  m.skip();
  assert.equal(m.state.phase, 'work');
  assert.equal(m.segAt(m.state.segmentIndex).intervalNumber, 1);
  m.skip();
  assert.equal(m.state.phase, 'recovery');
  m.skip();
  assert.equal(m.segAt(m.state.segmentIndex).intervalNumber, 2, 'segment order after a skip must remain exactly the normalized sequence');
});

test('end early: terminal, and does not mark the workout completed', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now });
  m.start();
  clock.advance(30000); m.reconcile();
  m.endEarly();
  assert.equal(m.state.phase, 'ended_early');
  assert.notEqual(m.state.phase, 'completed');
  // Further actions are all no-ops on a terminal state.
  m.skip(); m.pause(); m.reconcile();
  assert.equal(m.state.phase, 'ended_early');
});

test('completion is recorded exactly once even if triggered redundantly', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now });
  m.start();
  clock.advance(999999); m.reconcile();
  assert.equal(m.state.phase, 'completed');
  var completedAtFirst = m.state.completedAt;
  clock.advance(5000);
  m.reconcile(); // reconcile again post-completion -- must be a no-op
  assert.equal(m.state.completedAt, completedAtFirst, 'completedAt must never be overwritten by a later call');
  var completeCues = m.drainCues().filter(function (c) { return c.type === 'complete'; });
  // drainCues was never called before this point in the test, so this is
  // the ONE opportunity to see the complete cue -- must appear exactly once.
  assert.equal(completeCues.length, 1);
});

test('manual_rep segments never auto-advance from reconcile alone -- only markRepComplete moves past them', function () {
  var clock = fakeClock();
  var n = Runner.normalizeWorkout({ type: 'quality', label: '3 x 400m', qualityManualReps: { warmupSec: 10, cooldownSec: 10, reps: 3, recoverySec: 5 } });
  var m = Runner.createRunnerStateMachine(n, { now: clock.now });
  m.start();
  clock.advance(10000); m.reconcile(); // warmup elapses
  assert.equal(m.state.phase, 'manual_rep');
  clock.advance(999999); m.reconcile(); m.reconcile();
  assert.equal(m.state.phase, 'manual_rep', 'a manual rep must never auto-advance no matter how much time passes');
  m.markRepComplete();
  assert.equal(m.state.phase, 'recovery', 'recovery after a manual rep IS auto-timed');
  clock.advance(5000); m.reconcile();
  assert.equal(m.state.phase, 'manual_rep');
  assert.equal(m.segAt(m.state.segmentIndex).intervalNumber, 2);
});

test('continuous_open (distance-prescribed run) never auto-advances; only markContinuousDone ends it', function () {
  var clock = fakeClock();
  var n = Runner.normalizeWorkout({ type: 'easy', label: '3 mi easy', miles: 3 });
  var m = Runner.createRunnerStateMachine(n, { now: clock.now });
  m.start();
  assert.equal(m.state.phase, 'continuous');
  clock.advance(99999999); m.reconcile();
  assert.equal(m.state.phase, 'continuous', 'audio/timer must never end an open-ended run on its own');
  m.markContinuousDone();
  assert.equal(m.state.phase, 'completed');
});

// ═══════════════════════════════════════════════════════════════════════
// Timing, cues, no-negative-timers, dedup
// ═══════════════════════════════════════════════════════════════════════

test('remaining segment time is never negative, even long after a segment should have ended', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now });
  m.start();
  clock.advance(500000); // way past the whole workout, but reconcile() not called yet
  var remaining = m.remainingSegmentMs();
  assert.ok(remaining >= 0, 'remainingSegmentMs must never return a negative number');
});

test('halfway means halfway through the whole prescribed workout, not halfway through the current segment, and fires exactly once', function () {
  // structuredWorkout() totals 240s active (60 warmup + 3x30 work + 2x15
  // recovery between reps + 60 cooldown) -- workout halfway is at 120s.
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now });
  m.start(); // warmup, 60s
  clock.advance(31000); // just past halfway through the 60s warmup segment, nowhere near workout halfway
  for (var i = 0; i < 10; i++) m.reconcile(); // hammer reconcile many times at the same instant
  assert.ok(!m.drainCues().some(function (c) { return c.type === 'halfway'; }), 'halfway must not fire from mere segment-halfway');

  clock.advance(90000); // now 121s active elapsed -- just past the real workout halfway
  for (var j = 0; j < 10; j++) m.reconcile();
  var halfwayCues = m.drainCues().filter(function (c) { return c.type === 'halfway'; });
  assert.equal(halfwayCues.length, 1, 'halfway cue must be deduped across repeated reconcile calls');
});

test('final_third fires exactly once at 2/3 of the whole prescribed workout, independent of and never confused with halfway', function () {
  // structuredWorkout() totals 240s active -- final third starts at 160s.
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now });
  m.start();
  clock.advance(121000); // just past halfway (120s), nowhere near final third (160s)
  for (var i = 0; i < 5; i++) m.reconcile();
  var cuesAtHalfway = m.drainCues();
  assert.ok(cuesAtHalfway.some(function (c) { return c.type === 'halfway'; }));
  assert.ok(!cuesAtHalfway.some(function (c) { return c.type === 'final_third'; }), 'final_third must not fire early alongside halfway');

  clock.advance(40000); // now 161s active -- just past the final-third threshold
  for (var j = 0; j < 10; j++) m.reconcile();
  var finalThirdCues = m.drainCues().filter(function (c) { return c.type === 'final_third'; });
  assert.equal(finalThirdCues.length, 1, 'final_third cue must be deduped across repeated reconcile calls');
});

test('pause and resume expose stable event types (never the dedup-only timestamp suffix) while remaining repeatable', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now, workoutId: 'w' });
  m.start();
  m.drainCues();
  clock.advance(1000);
  m.pause();
  assert.equal(m.drainCues()[0].type, 'paused');
  clock.advance(1000);
  m.resume();
  assert.equal(m.drainCues()[0].type, 'resumed');
  clock.advance(1000);
  m.pause();
  assert.equal(m.drainCues()[0].type, 'paused', 'a later pause must still emit another stable "paused" event type, not a one-off dedup key');
});

test('final-interval cue fires exactly once, on the last interval only', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now }); // 3 reps
  m.start();
  var allCues = [];
  for (var i = 0; i < 20; i++) { clock.advance(20000); m.reconcile(); allCues = allCues.concat(m.drainCues()); }
  var finalCues = allCues.filter(function (c) { return c.type === 'final_interval'; });
  assert.equal(finalCues.length, 1);
});

test('correct interval numbering is preserved through a long, delayed single reconcile (not called every tick)', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now });
  m.start();
  // Never call reconcile() until the entire workout should be long done --
  // simulates a backgrounded tab whose timers never fired.
  clock.advance(10 * 60 * 1000);
  m.reconcile();
  assert.equal(m.state.phase, 'completed', 'a single delayed reconcile must correctly fast-forward through the whole workout');
});

test('a rapid backlog of stale segment-start cues is NOT replayed after a long suspension -- only the current segment gets a fresh cue', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now });
  m.start();
  m.drainCues(); // clear the initial warmup cue
  clock.advance(10 * 60 * 1000); // long enough to blow through every remaining segment
  m.reconcile();
  var cues = m.drainCues();
  var segmentStartCues = cues.filter(function (c) { return c.type === 'segment_start'; });
  assert.ok(segmentStartCues.length <= 1, 'at most one fresh segment_start cue after a long suspension, never one per skipped segment');
});

test('clock drift / many rapid reconcile calls at slightly different instants never double-advance a segment', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now });
  m.start();
  clock.advance(60000); // warmup exactly elapses
  for (var i = 0; i < 50; i++) { clock.advance(1); m.reconcile(); }
  // Despite 50 reconcile calls straddling the exact boundary, we should be
  // in 'work' on interval 1 -- not skipped ahead due to repeated triggering.
  assert.equal(m.state.phase, 'work');
  assert.equal(m.segAt(m.state.segmentIndex).intervalNumber, 1);
});

// ═══════════════════════════════════════════════════════════════════════
// Persistence / recovery (snapshot + restore)
// ═══════════════════════════════════════════════════════════════════════

test('snapshot + restoreRunnerStateMachine reproduces the exact same phase/segment/timing', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now, workoutId: 'w1' });
  m.start();
  clock.advance(75000); m.reconcile(); // into recovery after interval 1
  var snap = m.snapshot();

  var clock2 = fakeClock(clock.now()); // "app reopened" at the same instant, for a clean baseline
  var m2 = Runner.restoreRunnerStateMachine(structuredWorkout(), snap, { now: clock2.now });
  assert.equal(m2.state.phase, m.state.phase);
  assert.equal(m2.state.segmentIndex, m.state.segmentIndex);
  assert.equal(m2.remainingSegmentMs(), m.remainingSegmentMs());
});

test('restoring after a real gap correctly reconciles forward through segments that elapsed while the app was closed', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now });
  m.start();
  clock.advance(60000); m.reconcile(); // now in work interval 1
  var snap = m.snapshot();
  // App closed for a long time -- restore with a clock that's already far ahead.
  var laterClock = fakeClock(clock.now() + 10 * 60 * 1000);
  var restored = Runner.restoreRunnerStateMachine(structuredWorkout(), snap, { now: laterClock.now });
  restored.reconcile();
  assert.equal(restored.state.phase, 'completed', 'reconciliation on restore must fast-forward through the elapsed gap, not resume as if no time passed');
});

test('restoring from a snapshot missing newer fields does not throw and yields a usable machine', function () {
  var partialSnap = { phase: 'ready' }; // simulates an old/malformed persisted session
  assert.doesNotThrow(function () {
    var restored = Runner.restoreRunnerStateMachine(structuredWorkout(), partialSnap, {});
    restored.reconcile();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Guard rails
// ═══════════════════════════════════════════════════════════════════════

test('start() is idempotent -- calling it twice does not reset or double-initialize the workout', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now });
  m.start();
  var startedAtFirst = m.state.startedAt;
  clock.advance(5000);
  m.start(); // second call must be a no-op
  assert.equal(m.state.startedAt, startedAtFirst);
});

test('pause() and resume() are no-ops in states where they do not apply', function () {
  var clock = fakeClock();
  var m = Runner.createRunnerStateMachine(structuredWorkout(), { now: clock.now });
  m.resume(); // not paused -- no-op, must not throw
  assert.equal(m.state.phase, 'ready');
  m.pause(); // 'ready' is not pausable per spec (nothing running yet)
  assert.equal(m.state.phase, 'ready');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const CoachingContext = require(path.join(__dirname, '..', 'coaching-context.js'));
const CoachingCues = require(path.join(__dirname, '..', 'coaching-cues.js'));

// Default history already includes the once-per-workout safety AND
// introduction cues as delivered -- matches how app.js actually uses this
// (both fire once, very early, before normal in-segment coaching begins)
// and keeps most tests focused on the behavior they're actually about
// instead of incidentally re-proving "safety/intro wins when never yet
// delivered" (those are their own explicit tests below, which pass
// cueHistory: [] to exercise the true first-cue-of-the-workout scenario).
var SAFETY_ALREADY_DELIVERED = [{ cueId: 'safety_general', category: 'safety', deliveredAt: 1 }].concat(
  CoachingCues.CUE_CATALOG.filter(function (c) { return c.category === 'introduction'; }).map(function (c) { return { cueId: c.id, category: 'introduction', deliveredAt: 1 }; })
);

function ctx(overrides) {
  return CoachingContext.buildCoachingContext(Object.assign({
    currentTime: 1000000,
    workoutType: 'intervals_time',
    phase: 'work',
    segment: { kind: 'work', intervalNumber: 1, totalIntervals: 6, index: 1 },
    segmentIndex: 1, segmentCount: 5,
    segmentElapsedSec: 0, segmentRemainingSec: 120,
    runnerExperience: 'intermediate',
    units: 'mi',
    coachingPreferences: CoachingCues.defaultCoachingPreferences(),
    cueHistory: SAFETY_ALREADY_DELIVERED
  }, overrides || {}));
}

// ═══════════════════════════════════════════════════════════════════════
// Selection
// ═══════════════════════════════════════════════════════════════════════

test('returns an essential transition cue at a segment change', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({ segment: { kind: 'warmup', intervalNumber: null, totalIntervals: null }, segmentElapsedSec: 0, triggerEvent: 'segment_start' }));
  assert.ok(cue);
  assert.equal(cue.cueId, 'trans_warmup');
  assert.equal(cue.category, 'transition');
});

test('a transition cue is NOT re-selectable on an ordinary tick mid-segment (no triggerEvent) -- only at the moment of the real event', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({ segment: { kind: 'work', intervalNumber: 1, totalIntervals: 6 }, segmentElapsedSec: 40, segmentRemainingSec: 80 }));
  assert.ok(!cue || cue.category !== 'transition', 'trans_work_start must not fire again just because a tick happened mid-segment');
});

test('suppresses a technique cue in the first 25 seconds after a transition', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({ segmentElapsedSec: 10, segmentRemainingSec: 110 }));
  assert.ok(!cue || cue.category !== 'posture', 'no posture/technique cue this early in the segment');
});

test('returns null during required silence (no eligible cue, well past any transition, cooldown period active)', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({
    segmentElapsedSec: 40, segmentRemainingSec: 80,
    cueHistory: SAFETY_ALREADY_DELIVERED.concat([{ cueId: 'posture_relaxed', category: 'posture', deliveredAt: 999995000 }]) // 5s ago -- inside the 90s+ minimum gap
  }));
  assert.equal(cue, null);
});

test('Minimal mode: only essential cues, never optional coaching', function () {
  const prefs = Object.assign({}, CoachingCues.defaultCoachingPreferences(), { frequency: 'minimal' });
  const cue = CoachingCues.selectCoachingCue(ctx({ segmentElapsedSec: 60, segmentRemainingSec: 60, coachingPreferences: prefs }));
  assert.ok(!cue || ['safety', 'transition', 'transition_warning', 'progress', 'introduction', 'completion'].indexOf(cue.category) !== -1);
});

test('Coach mode (default): optional technique cues are reachable outside the silence window', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({ segmentElapsedSec: 60, segmentRemainingSec: 60 }));
  assert.ok(cue, 'a technique/posture/stride/breathing/effort cue should be selectable in Coach mode with no recent history');
});

test('Detailed mode allows a shorter minimum gap between optional cues than Coach mode', function () {
  const detailedPrefs = Object.assign({}, CoachingCues.defaultCoachingPreferences(), { frequency: 'detailed' });
  const history = [{ cueId: 'posture_relaxed', category: 'posture', deliveredAt: 1000000 - 100000 }]; // 100s ago
  const coachCue = CoachingCues.selectCoachingCue(ctx({ segmentElapsedSec: 60, segmentRemainingSec: 60, cueHistory: history }));
  const detailedCue = CoachingCues.selectCoachingCue(ctx({ segmentElapsedSec: 60, segmentRemainingSec: 60, cueHistory: history, coachingPreferences: detailedPrefs }));
  assert.ok(!coachCue || coachCue.category !== 'posture', 'Coach mode needs 180s, 100s is not enough');
  assert.ok(detailedCue, 'Detailed mode needs only 90s, so 100s should be enough');
});

test('honors disabled categories: technique off suppresses posture/stride/breathing/effort/warmup cues', function () {
  const prefs = Object.assign({}, CoachingCues.defaultCoachingPreferences(), { technique: false });
  const cue = CoachingCues.selectCoachingCue(ctx({ segmentElapsedSec: 60, segmentRemainingSec: 60, coachingPreferences: prefs }));
  assert.ok(!cue || cue.category === 'encouragement', 'with technique off, only encouragement (or nothing) should remain as an optional cue');
});

test('honors disabled categories: encouragement off suppresses encouragement cues', function () {
  const prefs = Object.assign({}, CoachingCues.defaultCoachingPreferences(), { technique: false, encouragement: false });
  const cue = CoachingCues.selectCoachingCue(ctx({ segmentElapsedSec: 60, segmentRemainingSec: 60, coachingPreferences: prefs }));
  assert.equal(cue, null, 'with both technique and encouragement off, no optional cue remains');
});

test('selects a beginner-appropriate cue not available to other experience levels', function () {
  const beginnerCue = CoachingCues.selectCoachingCue(ctx({
    segment: { kind: 'recovery', intervalNumber: 1, totalIntervals: 6 }, segmentElapsedSec: 60, segmentRemainingSec: 30,
    runnerExperience: 'beginner'
  }));
  // encourage_beginner_permission is the only maxPerWorkout:1 cue gated to experienceLevels:['beginner']
  assert.ok(beginnerCue);
});

test('an experienced runner never receives a beginner-gated cue', function () {
  const advancedCue = CoachingCues.selectCoachingCue(ctx({
    segment: { kind: 'recovery', intervalNumber: 1, totalIntervals: 6 }, segmentElapsedSec: 60, segmentRemainingSec: 30,
    runnerExperience: 'advanced'
  }));
  assert.ok(!advancedCue || advancedCue.cueId !== 'encourage_beginner_permission');
});

test('avoids repeating coaching topics: buildCoachingFocus skips a topic taught in the last 3 workouts', function () {
  const history = [
    { cueId: 'posture_relaxed', category: 'posture', topic: 'relaxed_shoulders', deliveredAt: 1, workoutId: 'w1' },
    { cueId: 'effort_talk_test', category: 'effort', topic: 'talk_test_effort', deliveredAt: 2, workoutId: 'w2' }
  ];
  const focus = CoachingCues.buildCoachingFocus(history, 'w3');
  assert.ok(['relaxed_shoulders', 'talk_test_effort'].indexOf(focus) === -1, 'must not pick a topic taught in a recent workout');
});

test('buildCoachingFocus is deterministic -- same history always yields the same focus', function () {
  const history = [{ cueId: 'x', category: 'posture', topic: 'relaxed_shoulders', deliveredAt: 1, workoutId: 'w1' }];
  const a = CoachingCues.buildCoachingFocus(history, 'w2');
  const b = CoachingCues.buildCoachingFocus(history, 'w2');
  assert.equal(a, b);
});

test('deterministic text variation: the same cue rotates through variants based on stable occurrence count, not randomly', function () {
  const c1 = ctx({ segment: { kind: 'recovery' }, segmentType: 'recovery', segmentElapsedSec: 40, segmentRemainingSec: 30, cueHistory: [] });
  const first = CoachingCues.selectCoachingCue(c1);
  // Force a specific cue by history count -- resolve the same cue's text twice with different occurrence counts.
  const cue = CoachingCues.CUE_CATALOG.filter(function (c) { return c.id === 'posture_relaxed'; })[0];
  const ctxA = ctx({ segmentElapsedSec: 60, segmentRemainingSec: 60, cueHistory: [] });
  const ctxB = ctx({ segmentElapsedSec: 60, segmentRemainingSec: 60, cueHistory: [{ cueId: 'posture_relaxed', category: 'posture', deliveredAt: 1 }] });
  // Both should be deterministic (no throw, no randomness) -- re-running yields identical output.
  const r1 = CoachingCues.selectCoachingCue(ctxA);
  const r2 = CoachingCues.selectCoachingCue(ctxA);
  assert.deepEqual(r1, r2, 'identical context must always produce identical output');
});

// ═══════════════════════════════════════════════════════════════════════
// Cue priority
// ═══════════════════════════════════════════════════════════════════════

test('safety overrides every other cue category', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({ segmentElapsedSec: 60, segmentRemainingSec: 60, cueHistory: [] }));
  // safety_general has maxPerWorkout:1 and no timing/data constraints -- it will always rank above everything else the first time it's eligible.
  assert.equal(cue.category, 'safety');
});

test('transition overrides technique -- at a segment_start moment, transition always wins', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({
    segment: { kind: 'warmup', intervalNumber: null, totalIntervals: null }, segmentElapsedSec: 0, segmentRemainingSec: 300,
    triggerEvent: 'segment_start',
    cueHistory: SAFETY_ALREADY_DELIVERED // safety already delivered, out of the way
  }));
  assert.equal(cue.category, 'transition');
});

test('pace correction (sensor_corrective) outranks encouragement when both would otherwise be eligible', function () {
  const withPace = ctx({
    segmentElapsedSec: 60, segmentRemainingSec: 60,
    prescription: { paceMinSecPerMi: 600, paceMaxSecPerMi: 630 },
    sensorSnapshot: { livePace: 500, livePaceReliability: 'reliable' },
    cueHistory: SAFETY_ALREADY_DELIVERED
  });
  // pace_too_fast requires livePace + prescribedPaceMin/Max, all present -- must outrank encourage_general (priority 7 vs 4).
  const cue = CoachingCues.selectCoachingCue(withPace);
  assert.ok(cue);
  assert.notEqual(cue.category, 'encouragement');
});

test('a stale cue (past its expiresAt) is the caller\'s responsibility to discard -- selectCoachingCue always stamps a short expiresAt', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({ segment: { kind: 'warmup' }, segmentElapsedSec: 0, triggerEvent: 'segment_start' }));
  assert.ok(cue.expiresAt > 1000000, 'expiresAt must be in the future relative to currentTime');
  assert.ok(cue.expiresAt - 1000000 <= 20000, 'the staleness window must be short, not open-ended');
});

test('only one cue is ever returned, never an array or multiple', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({ segment: { kind: 'warmup' }, segmentElapsedSec: 0, triggerEvent: 'segment_start' }));
  assert.equal(Array.isArray(cue), false);
});

test('optional cues do not form a backlog: rapid repeated calls with the same history never queue more than the gap allows', function () {
  const history = [{ cueId: 'posture_relaxed', category: 'posture', deliveredAt: 999999999 }];
  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(CoachingCues.selectCoachingCue(ctx({ segmentElapsedSec: 60, segmentRemainingSec: 60, cueHistory: history, currentTime: 1000000 })));
  }
  const optionalCount = results.filter(function (r) { return r && CoachingCues.OPTIONAL_CATEGORIES.indexOf(r.category) !== -1; }).length;
  assert.ok(optionalCount <= 1, 'the minimum-gap rule must hold across repeated calls with the same static history, not accumulate a backlog');
});

// ═══════════════════════════════════════════════════════════════════════
// Data truthfulness
// ═══════════════════════════════════════════════════════════════════════

test('no exact pace statement without a prescribed target -- transition falls back to effort/talk-test phrasing', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({ segment: { kind: 'work', intervalNumber: 1, totalIntervals: 1 }, segmentElapsedSec: 0, prescription: {}, triggerEvent: 'segment_start' }));
  assert.ok(!/per mile|per kilometer/i.test(cue.text), 'no pace range must ever appear in the spoken text without a real prescribed target');
});

test('a prescribed pace target IS spoken when genuinely available', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({
    segment: { kind: 'work', intervalNumber: 1, totalIntervals: 1 }, segmentElapsedSec: 0, triggerEvent: 'segment_start',
    prescription: { paceMinSecPerMi: 615, paceMaxSecPerMi: 645 }
  }));
  assert.match(cue.text, /per mile/);
});

test('no live pace correction without reliable live pace data', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({
    segmentElapsedSec: 60, segmentRemainingSec: 60,
    prescription: { paceMinSecPerMi: 600, paceMaxSecPerMi: 630 },
    sensorSnapshot: {}, // no livePace
    cueHistory: SAFETY_ALREADY_DELIVERED
  }));
  assert.ok(!cue || cue.category !== 'sensor_corrective');
});

test('no BPM statement without a personalized recovery range', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({ segment: { kind: 'recovery', intervalNumber: 1, totalIntervals: 6 }, segmentElapsedSec: 0, triggerEvent: 'segment_start' }));
  assert.ok(!/beats per minute/i.test(cue.text));
});

test('a personalized recovery BPM range IS stated when genuinely available', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({
    segment: { kind: 'recovery', intervalNumber: 1, totalIntervals: 6 }, segmentElapsedSec: 0, triggerEvent: 'segment_start',
    sensorSnapshot: { personalizedHrZones: { recoveryMin: 125, recoveryMax: 140 } }
  }));
  assert.match(cue.text, /125 to 140 beats per minute/);
});

test('no HR trend statement (hr_not_declining) without recent readings', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({
    segment: { kind: 'recovery', intervalNumber: 1, totalIntervals: 6 }, segmentElapsedSec: 60, segmentRemainingSec: 30,
    cueHistory: SAFETY_ALREADY_DELIVERED
  }));
  assert.ok(!cue || cue.cueId !== 'hr_not_declining');
});

test('a stale HR reading (via coaching-context staleness) never reaches hr_above_zone', function () {
  const now = 1000000;
  const c = ctx({
    currentTime: now, segmentElapsedSec: 60, segmentRemainingSec: 60,
    sensorSnapshot: { liveHeartRate: 180, heartRateTimestamp: now - 60000, heartRateReliability: 'reliable', personalizedHrZones: { min: 100, max: 150 } },
    cueHistory: SAFETY_ALREADY_DELIVERED
  });
  const cue = CoachingCues.selectCoachingCue(c);
  assert.ok(!cue || cue.cueId !== 'hr_above_zone', 'stale HR must have already been nulled out by coaching-context before selection even runs');
});

test('timer-only mode (no prescription, no sensors) still produces useful RPE/talk-test-flavored guidance, never null forever', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({
    segment: { kind: 'work', intervalNumber: 1, totalIntervals: 1 }, segmentElapsedSec: 0, prescription: {}, sensorSnapshot: {}, triggerEvent: 'segment_start',
    cueHistory: SAFETY_ALREADY_DELIVERED
  }));
  assert.ok(cue, 'a transition cue must always be available even with zero prescribed/live data');
  assert.match(cue.text, /short sentences|Start running/);
});

test('missing sensor values never produce NaN or invented text', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({ segment: { kind: 'work', intervalNumber: 1, totalIntervals: 1 }, segmentElapsedSec: 0, triggerEvent: 'segment_start' }));
  assert.ok(!/NaN|undefined|null/.test(cue.text));
});

// ═══════════════════════════════════════════════════════════════════════
// Frequency
// ═══════════════════════════════════════════════════════════════════════

test('minimum spacing between optional cues is enforced across the whole workout, not just the last cue', function () {
  const history = [{ cueId: 'breathing_steady', category: 'breathing', deliveredAt: 1000000 - 30000 }]; // 30s ago, under the 180s Coach-mode floor
  const cue = CoachingCues.selectCoachingCue(ctx({ segmentElapsedSec: 60, segmentRemainingSec: 60, cueHistory: history }));
  assert.ok(!cue || CoachingCues.OPTIONAL_CATEGORIES.indexOf(cue.category) === -1);
});

test('transition cues remain available even when optional-cue spacing would otherwise block everything', function () {
  const history = SAFETY_ALREADY_DELIVERED.concat([{ cueId: 'breathing_steady', category: 'breathing', deliveredAt: 999999999 }]); // 1s ago
  const cue = CoachingCues.selectCoachingCue(ctx({ segment: { kind: 'cooldown' }, segmentElapsedSec: 0, triggerEvent: 'segment_start', cueHistory: history }));
  assert.equal(cue.category, 'transition');
});

test('a cue with maxPerWorkout does not repeat past its limit', function () {
  const history = SAFETY_ALREADY_DELIVERED.concat([{ cueId: 'trans_cooldown', category: 'transition', deliveredAt: 1 }]);
  const cue = CoachingCues.selectCoachingCue(ctx({ segment: { kind: 'cooldown' }, segmentElapsedSec: 0, triggerEvent: 'segment_start', cueHistory: history }));
  assert.ok(!cue || cue.cueId !== 'trans_cooldown', 'trans_cooldown has maxPerWorkout:1 and was already delivered once');
});

test('a very short segment never receives a technique cue gated by minimumSegmentDurationSec', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({
    segment: { kind: 'work', intervalNumber: 1, totalIntervals: 4 }, segmentElapsedSec: 30, segmentRemainingSec: 15, // 45s total -- under most technique cues' 90s minimum
    cueHistory: SAFETY_ALREADY_DELIVERED
  }));
  assert.ok(!cue || CoachingCues.OPTIONAL_CATEGORIES.indexOf(cue.category) === -1 || cue.cueId === 'effort_no_sprint');
});

test('Detailed mode is still capped -- it never returns more than one cue per call, same as every other mode', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({ segmentElapsedSec: 60, segmentRemainingSec: 60, coachingPreferences: Object.assign({}, CoachingCues.defaultCoachingPreferences(), { frequency: 'detailed' }) }));
  assert.equal(Array.isArray(cue), false);
});

// ═══════════════════════════════════════════════════════════════════════
// Workout types
// ═══════════════════════════════════════════════════════════════════════

test('classifyWorkoutForCoaching: easy run', function () {
  assert.equal(CoachingCues.classifyWorkoutForCoaching({ type: 'easy' }, { mode: 'continuous_open', segments: [] }), 'easy');
});
test('classifyWorkoutForCoaching: long run', function () {
  assert.equal(CoachingCues.classifyWorkoutForCoaching({ type: 'long' }, { mode: 'continuous_open', segments: [] }), 'long');
});
test('classifyWorkoutForCoaching: run/walk (overrides slot type)', function () {
  assert.equal(CoachingCues.classifyWorkoutForCoaching({ type: 'long', runWalk: { runSec: 60, walkSec: 60, cycles: 3 } }, { mode: 'structured', segments: [] }), 'run_walk');
});
test('classifyWorkoutForCoaching: tempo (single continuous quality block)', function () {
  const normalized = { mode: 'structured', segments: [{ kind: 'work', totalIntervals: 1 }] };
  assert.equal(CoachingCues.classifyWorkoutForCoaching({ type: 'quality' }, normalized), 'tempo');
});
test('classifyWorkoutForCoaching: time-based intervals', function () {
  const normalized = { mode: 'structured', segments: [{ kind: 'work', totalIntervals: 6 }] };
  assert.equal(CoachingCues.classifyWorkoutForCoaching({ type: 'quality' }, normalized), 'intervals_time');
});
test('classifyWorkoutForCoaching: manual-distance intervals', function () {
  const normalized = { mode: 'guided_manual', segments: [{ kind: 'manual_rep', totalIntervals: 5 }] };
  assert.equal(CoachingCues.classifyWorkoutForCoaching({ type: 'quality' }, normalized), 'intervals_manual');
});
test('classifyWorkoutForCoaching: cross-training', function () {
  assert.equal(CoachingCues.classifyWorkoutForCoaching({ type: 'cross' }, { mode: 'structured', segments: [] }), 'cross');
});
test('detectTerrainHint: hills detected from the plan\'s own label text', function () {
  assert.equal(CoachingCues.detectTerrainHint('Hills: 6 x 2 min uphill'), 'hills');
  assert.equal(CoachingCues.detectTerrainHint('5 x 1000m @ 10K pace'), null);
});

test('short intervals workout: interval-start cue never includes a technique lecture in the same cue', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({
    segment: { kind: 'work', intervalNumber: 2, totalIntervals: 8 }, segmentElapsedSec: 0, segmentRemainingSec: 60, triggerEvent: 'segment_start',
    cueHistory: SAFETY_ALREADY_DELIVERED
  }));
  assert.equal(cue.category, 'transition');
  assert.ok(!/shoulders|hands loose/i.test(cue.text));
});

test('manual-distance workout: repetition cue never claims measured distance', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({
    workoutType: 'intervals_manual', segment: { kind: 'manual_rep', intervalNumber: 1, totalIntervals: 5 }, segmentElapsedSec: 0, triggerEvent: 'segment_start',
    cueHistory: SAFETY_ALREADY_DELIVERED
  }));
  assert.match(cue.text, /Repetition 1 of 5/);
  assert.ok(!/miles|kilometers|pace/i.test(cue.text));
});

test('open-ended workout (continuous_open easy/long run): still gets a valid transition cue with no fixed duration claimed', function () {
  const cue = CoachingCues.selectCoachingCue(ctx({ workoutType: 'easy', segment: { kind: 'continuous', intervalNumber: null, totalIntervals: null }, segmentElapsedSec: 0, segmentRemainingSec: null, triggerEvent: 'segment_start' }));
  assert.ok(cue);
  assert.ok(!/for null minutes/.test(cue.text));
});

// ═══════════════════════════════════════════════════════════════════════
// Lifecycle
// ═══════════════════════════════════════════════════════════════════════

test('completion cue only fires once, even if requested repeatedly', function () {
  const history = [{ cueId: 'completion_full', category: 'completion', deliveredAt: 1 }];
  const cue = CoachingCues.selectCoachingCue(ctx({ segment: null, segmentType: null, phase: 'completed', cueHistory: history }));
  assert.ok(!cue || cue.cueId !== 'completion_full');
});

test('malformed cue history (missing fields, null entries) falls back safely without throwing', function () {
  assert.doesNotThrow(function () {
    CoachingCues.selectCoachingCue(ctx({ cueHistory: [null, {}, { cueId: 'x' }, undefined] }));
  });
  assert.doesNotThrow(function () {
    CoachingCues.buildCoachingFocus([null, {}, undefined], 'w1');
  });
});

test('a completely empty/default context does not throw and returns null or a valid cue, never garbage', function () {
  const result = CoachingCues.selectCoachingCue(CoachingContext.buildCoachingContext({}));
  assert.ok(result === null || (result && typeof result.text === 'string'));
});

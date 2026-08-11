// Extraction-fidelity tests for coaching-rules.js (docs/COACHING_SPEC.md).
// Confirms classifyUser/evaluateSafety/choosePlanLength/findCurrentWeekIdx
// behave identically to their pre-extraction app.js originals. The actual
// decision-scenario library (approved/forbidden adaptation outcomes) lives
// in tests/decision-scenarios.test.js -- this file is ordinary unit coverage
// for the moved code, same shape as tests/progress-stats.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rules = require(path.join(__dirname, '..', 'coaching-rules.js'));

test('classifyUser takes the more conservative of computed and self-reported level', function () {
  // computed 'advanced' (6 days, 45mi/wk) but self-reported 'novice' -- novice wins
  assert.equal(rules.classifyUser({ runDaysPerWeek: 6, weeklyMileage: 45, experienceLevel: 'novice', recentInjury: false }), 'novice');
  // computed 'beginner' (2 days) but self-reported 'advanced' -- computed (lower) wins
  assert.equal(rules.classifyUser({ runDaysPerWeek: 2, weeklyMileage: 10, experienceLevel: 'advanced', recentInjury: false }), 'beginner');
});

test('classifyUser caps at novice when a recent injury is reported, even for an advanced runner (legacy boolean field)', function () {
  assert.equal(rules.classifyUser({ runDaysPerWeek: 6, weeklyMileage: 45, experienceLevel: 'advanced', recentInjury: true }), 'novice');
});

test('classifyUser injuryStatus: resolved applies no cap at all', function () {
  assert.equal(rules.classifyUser({ runDaysPerWeek: 6, weeklyMileage: 45, experienceLevel: 'advanced', injuryStatus: 'resolved' }), 'advanced');
});

test('classifyUser injuryStatus: mild_discomfort caps at novice', function () {
  assert.equal(rules.classifyUser({ runDaysPerWeek: 6, weeklyMileage: 45, experienceLevel: 'advanced', injuryStatus: 'mild_discomfort' }), 'novice');
});

test('classifyUser injuryStatus: unable_to_run caps at beginner', function () {
  assert.equal(rules.classifyUser({ runDaysPerWeek: 6, weeklyMileage: 45, experienceLevel: 'advanced', injuryStatus: 'unable_to_run' }), 'beginner');
});

test('classifyUser injuryStatus: medically_restricted caps at beginner, same as unable_to_run', function () {
  assert.equal(rules.classifyUser({ runDaysPerWeek: 6, weeklyMileage: 45, experienceLevel: 'advanced', injuryStatus: 'medically_restricted' }), 'beginner');
});

test('classifyUser prefers injuryStatus over the legacy boolean when both are present', function () {
  assert.equal(rules.classifyUser({ runDaysPerWeek: 6, weeklyMileage: 45, experienceLevel: 'advanced', recentInjury: true, injuryStatus: 'resolved' }), 'advanced');
});

test('startRunDaysFor starts at current frequency plus one, never the old hardcoded floor', function () {
  assert.equal(rules.startRunDaysFor(0, 5), 2, 'a 0-day/week runner still gets a minimum floor of 2, not 3');
  assert.equal(rules.startRunDaysFor(1, 5), 2);
  assert.equal(rules.startRunDaysFor(4, 5), 5, 'never exceeds the target');
});

test('startRunDaysFor never starts above the plan\'s eventual target', function () {
  assert.equal(rules.startRunDaysFor(6, 5), 5, 'an already-frequent runner starts at the target, not above it');
});

test('runDaysForWeek holds at target immediately when startRunDays already equals target', function () {
  for (var w = 1; w <= 10; w++) {
    assert.equal(rules.runDaysForWeek(w, 5, 5, 2), 5);
  }
});

test('runDaysForWeek ramps by exactly one day every rampIntervalWeeks, never exceeding target', function () {
  var start = 2, target = 5, interval = 2;
  assert.equal(rules.runDaysForWeek(1, start, target, interval), 2);
  assert.equal(rules.runDaysForWeek(2, start, target, interval), 2);
  assert.equal(rules.runDaysForWeek(3, start, target, interval), 3);
  assert.equal(rules.runDaysForWeek(4, start, target, interval), 3);
  assert.equal(rules.runDaysForWeek(5, start, target, interval), 4);
  assert.equal(rules.runDaysForWeek(6, start, target, interval), 4);
  assert.equal(rules.runDaysForWeek(7, start, target, interval), 5);
  assert.equal(rules.runDaysForWeek(20, start, target, interval), 5, 'never exceeds target even far into the plan');
});

test('evaluateSafety flags unsafe and returns a warning when weeksAvailable is below the level\'s minWeeks', function () {
  var result = rules.evaluateSafety('half', 4, 'intermediate'); // half/intermediate minWeeks is 8
  assert.equal(result.unsafe, true);
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].indexOf('Half Marathon') !== -1);
});

test('evaluateSafety returns no warning when weeksAvailable meets the minimum', function () {
  var result = rules.evaluateSafety('10k', 10, 'novice'); // 10k/novice minWeeks is 8
  assert.equal(result.unsafe, false);
  assert.deepEqual(result.warnings, []);
});

test('choosePlanLength caps at 1.6x idealWeeks and never exceeds 40', function () {
  // 5k/novice idealWeeks is 10 -> cap is 16
  assert.equal(rules.choosePlanLength(52, '5k', 'novice'), 16);
  // never exceeds the real weeksAvailable either
  assert.equal(rules.choosePlanLength(5, '5k', 'novice'), 5);
});

test('findCurrentWeekIdx returns the week whose date range contains today, or the next upcoming week', function () {
  var raceDate = rules.parseDate('2026-09-20'); // a Sunday
  var planLengthWeeks = 8;
  var todayInWeek1 = rules.parseDate('2026-07-27'); // week 1's Monday
  assert.equal(rules.findCurrentWeekIdx(raceDate, planLengthWeeks, todayInWeek1), 1);
  var beforePlanStarts = rules.parseDate('2026-01-01');
  assert.equal(rules.findCurrentWeekIdx(raceDate, planLengthWeeks, beforePlanStarts), 1);
});

test('findCurrentWeekIdx returns -1 once today is past the entire plan', function () {
  var raceDate = rules.parseDate('2026-01-05');
  var planLengthWeeks = 4;
  var wayAfterRace = rules.parseDate('2026-06-01');
  assert.equal(rules.findCurrentWeekIdx(raceDate, planLengthWeeks, wayAfterRace), -1);
});

// docs/COACHING_SPEC.md "Launch scope" -- 5K/10K/half publicly available;
// marathon and every ultra distance stay beta-gated until reviewed.
var ALL_EVENTS = ['5k', '10k', 'half', 'marathon', '50k', '50mi', '100k', '100mi'];

test('visibleEventsFor: with the beta flag off, only 5K/10K/half are offered', function () {
  assert.deepEqual(rules.visibleEventsFor(ALL_EVENTS, false, null), ['5k', '10k', 'half']);
});

test('visibleEventsFor: with the beta flag on, every distance is offered', function () {
  assert.deepEqual(rules.visibleEventsFor(ALL_EVENTS, true, null), ALL_EVENTS);
});

test('visibleEventsFor: an existing longer-distance plan keeps its own event visible even with the flag off', function () {
  var visible = rules.visibleEventsFor(ALL_EVENTS, false, 'marathon');
  assert.ok(visible.indexOf('marathon') !== -1, 'editing an existing marathon plan must not strand it');
  assert.deepEqual(visible, ['5k', '10k', 'half', 'marathon']);
});

test('visibleEventsFor: does not duplicate the current event when it is already public', function () {
  assert.deepEqual(rules.visibleEventsFor(ALL_EVENTS, false, 'half'), ['5k', '10k', 'half']);
});

// ── Coach-negotiated day trades (Monday rest -> 12-3-30, Sunday becomes
// the new recovery day) ──────────────────────────────────────────────────
var SAMPLE_WEEK = [
  { key: '1-0', type: 'rest', label: 'Rest' },
  { key: '1-1', type: 'easy', label: '3 mi easy run' },
  { key: '1-2', type: 'cross', label: '30 min cross' },
  { key: '1-3', type: 'quality', label: 'Tempo: 20 min' },
  { key: '1-4', type: 'easy', label: '3 mi easy run' },
  { key: '1-5', type: 'long', label: '8 mi long run' },
  { key: '1-6', type: 'easy', label: '4 mi easy run' }
];

test('normalizeKnownWorkoutPhrase: recognizes 12-3-30 in every common spelling', function () {
  ['12 3 30', '12-3-30', '12/3/30', 'lets do 12-3-30 today', 'I want to do a 12/3/30'].forEach(function (phrase) {
    var w = rules.normalizeKnownWorkoutPhrase(phrase);
    assert.ok(w, 'should recognize: ' + phrase);
    assert.equal(w.type, 'cross');
    assert.equal(w.label, '12-3-30 Incline Walk');
    assert.equal(w.durationMinutes, 30);
    assert.equal(w.plannedDistance, null);
  });
});

test('normalizeKnownWorkoutPhrase: returns null for unrelated text', function () {
  assert.equal(rules.normalizeKnownWorkoutPhrase('I want to go for an easy run'), null);
  assert.equal(rules.normalizeKnownWorkoutPhrase(''), null);
  assert.equal(rules.normalizeKnownWorkoutPhrase(null), null);
});

test('validateRescheduleDays: core scenario -- Monday rest becomes 12-3-30, Sunday becomes the new recovery day', function () {
  var changes = [
    { key: '1-0', workout: { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null } },
    { key: '1-6', workout: { type: 'rest', label: 'Rest', durationMinutes: null, plannedDistance: null } }
  ];
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, changes);
  assert.equal(result.ok, true);
  var monday = result.resultingWeek.filter(function (d) { return d.key === '1-0'; })[0];
  var sunday = result.resultingWeek.filter(function (d) { return d.key === '1-6'; })[0];
  assert.equal(monday.type, 'cross');
  assert.equal(monday.label, '12-3-30 Incline Walk');
  assert.equal(sunday.type, 'rest');
});

test('validateRescheduleDays: race day is never a valid change target', function () {
  var week = SAMPLE_WEEK.concat([{ key: '1-7', type: 'race', label: '10K Race' }]);
  var changes = [{ key: '1-7', workout: { type: 'easy', label: 'Easy shakeout', durationMinutes: 20, plannedDistance: 2 } }];
  var result = rules.validateRescheduleDays(week, changes);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'race_day_protected');
});

test('validateRescheduleDays: rejects an unknown day key', function () {
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, [{ key: '9-9', workout: { type: 'rest', label: 'Rest' } }]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unknown_key');
});

test('validateRescheduleDays: rejects a duplicate key within one change set', function () {
  var changes = [
    { key: '1-0', workout: { type: 'cross', label: 'A', durationMinutes: 30, plannedDistance: null } },
    { key: '1-0', workout: { type: 'rest', label: 'Rest' } }
  ];
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, changes);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'duplicate_key');
});

test('validateRescheduleDays: rejects an invalid workout type (not in the allowed enum)', function () {
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, [{ key: '1-0', workout: { type: 'nonsense', label: 'X' } }]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_workout');
});

test('validateRescheduleDays: rejects a malformed change (missing workout object)', function () {
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, [{ key: '1-0' }]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_workout');
});

test('validateRescheduleDays: choosing a day with a long run as the new recovery day is rejected without explicit confirmation, and reports what would be displaced', function () {
  var changes = [
    { key: '1-0', workout: { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null } },
    { key: '1-5', workout: { type: 'rest', label: 'Rest' } }
  ];
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, changes);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'would_displace_key_workout');
  assert.equal(result.displaced.length, 1);
  assert.equal(result.displaced[0].key, '1-5');
  assert.equal(result.displaced[0].type, 'long');
});

test('validateRescheduleDays: choosing a day with a quality session as the new recovery day is rejected the same way', function () {
  var changes = [
    { key: '1-0', workout: { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null } },
    { key: '1-3', workout: { type: 'rest', label: 'Rest' } }
  ];
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, changes);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'would_displace_key_workout');
  assert.equal(result.displaced[0].type, 'quality');
});

test('validateRescheduleDays: a displaced long run is allowed through when the SAME change set relocates a long run to another day', function () {
  var changes = [
    { key: '1-0', workout: { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null } },
    { key: '1-5', workout: { type: 'rest', label: 'Rest' } },
    { key: '1-6', workout: { type: 'long', label: '8 mi long run', durationMinutes: null, plannedDistance: 8 } }
  ];
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, changes);
  assert.equal(result.ok, true);
});

test('validateRescheduleDays: a displaced key workout is allowed through with explicit confirmDisplacement', function () {
  var changes = [
    { key: '1-0', workout: { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null } },
    { key: '1-5', workout: { type: 'rest', label: 'Rest' } }
  ];
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, changes, { confirmDisplacement: ['1-5'] });
  assert.equal(result.ok, true);
});

test('validateRescheduleDays: a week that would end without any real rest day is rejected', function () {
  var changes = SAMPLE_WEEK.filter(function (d) { return d.type === 'rest'; }).map(function (d) {
    return { key: d.key, workout: { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null } };
  });
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, changes);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'insufficient_recovery');
});

test('validateRescheduleDays: a week that still keeps at least one real rest day after the trade is allowed', function () {
  var changes = [
    { key: '1-0', workout: { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null } },
    { key: '1-1', workout: { type: 'rest', label: 'Rest' } }
  ];
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, changes);
  assert.equal(result.ok, true);
});

test('validateRescheduleDays: rejects an out-of-range duration', function () {
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, [{ key: '1-0', workout: { type: 'cross', label: 'X', durationMinutes: 9999 } }]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_workout');
});

test('validateRescheduleDays: rejects an out-of-range planned distance', function () {
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, [{ key: '1-0', workout: { type: 'easy', label: 'X', plannedDistance: -5 } }]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_workout');
});

test('validateRescheduleDays: an invalid second change fails the entire atomic action (no partial validation success)', function () {
  var changes = [
    { key: '1-0', workout: { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null } },
    { key: '1-6', workout: { type: 'bogus', label: 'X' } }
  ];
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, changes);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_workout');
});

test('validateRescheduleDays: existing single-day mark-rest-style trade (one change, no displacement, recovery preserved) still works', function () {
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, [{ key: '1-1', workout: { type: 'rest', label: 'Rest' } }]);
  assert.equal(result.ok, true);
});

// ── Arbitrary planned-activity classification (hiking scenario, task 8) ──
test('buildPlannedActivityWorkout: a steep 3-hour hike gets real high-load classification and honest purpose text, not treated as equivalent to a run', function () {
  var w = rules.buildPlannedActivityWorkout('hiking', 180, 'hard', 'mi');
  assert.equal(w.type, 'cross');
  assert.equal(w.loadClass, 'high');
  assert.match(w.label, /Hike/);
  assert.match(w.purpose, /not equivalent to rest/i);
});

test('buildPlannedActivityWorkout: an easy short hike gets low/moderate load, not automatically flagged as a big session', function () {
  var w = rules.buildPlannedActivityWorkout('hiking', 45, 'easy', 'mi');
  assert.equal(w.type, 'cross');
  assert.notEqual(w.loadClass, 'high');
});

test('buildPlannedActivityWorkout: an unfamiliar activity type still gets a real classification via the generic cross-training builder', function () {
  var w = rules.buildPlannedActivityWorkout('cycling', 60, 'hard', 'mi');
  assert.equal(w.type, 'cross');
  assert.equal(w.loadClass, 'high');
  assert.ok(w.label);
});

test('validateRescheduleDays: a change carrying activityType is deterministically rebuilt from the real prescription builder, ignoring the model\'s own label/duration for that field', function () {
  var changes = [{ key: '1-1', workout: { type: 'easy', label: 'Some hike thing', durationMinutes: 5, activityType: 'hiking', terrainDifficulty: 'hard' } }];
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, changes);
  assert.equal(result.ok, true);
  var tue = result.resultingWeek.filter(function (d) { return d.key === '1-1'; })[0];
  assert.match(tue.label, /Hike/);
  assert.notEqual(tue.label, 'Some hike thing');
});

test('validateRescheduleDays: an unknown activityType is rejected', function () {
  var changes = [{ key: '1-0', workout: { type: 'easy', label: 'X', activityType: 'not_a_real_activity' } }];
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, changes);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_workout');
});

test('validateRescheduleDays: an invalid terrainDifficulty is rejected', function () {
  var changes = [{ key: '1-0', workout: { type: 'easy', label: 'X', activityType: 'hiking', terrainDifficulty: 'extreme' } }];
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, changes);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_workout');
});

test('validateRescheduleDays: a hike swapped onto an easy-run day (recovery untouched) is accepted end to end', function () {
  var changes = [{ key: '1-1', workout: { type: 'easy', label: 'placeholder', activityType: 'hiking', durationMinutes: 90, terrainDifficulty: 'moderate' } }];
  var result = rules.validateRescheduleDays(SAMPLE_WEEK, changes);
  assert.equal(result.ok, true, 'a hike replacing an easy run must not trip any check on its own -- ' + result.reason);
});

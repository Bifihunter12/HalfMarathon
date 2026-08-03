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

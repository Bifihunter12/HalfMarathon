// Extraction-fidelity tests for coaching-rules.js (docs/COACHING_SPEC.md).
// Confirms classifyUser/evaluateSafety/choosePlanLength/findCurrentWeekIdx
// behave identically to their pre-extraction app.js originals. The actual
// decision-scenario library (approved/forbidden adaptation outcomes) lives
// in tests/decision-scenarios.test.js -- this file is ordinary unit coverage
// for the moved code, same shape as tests/xp-system.test.js.

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

test('classifyUser caps at novice when a recent injury is reported, even for an advanced runner', function () {
  assert.equal(rules.classifyUser({ runDaysPerWeek: 6, weeklyMileage: 45, experienceLevel: 'advanced', recentInjury: true }), 'novice');
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

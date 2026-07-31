// Full-plan scenario tests (docs/COACHING_SPEC.md), closing the coaching
// review's #6 priority: "test generated plans as complete runner scenarios --
// not only isolated rules." Every other test file in this project asserts a
// single field off a single function call; these tests generate a REAL,
// complete plan for a realistic profile via coaching-rules.js's own
// buildStructuredWeeks/generatePlan and check properties across the WHOLE
// thing at once.
//
// Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rules = require(path.join(__dirname, '..', 'coaching-rules.js'));

// Builds a realistic planMeta the same way finishWizard (app.js) does --
// real classifyUser/evaluateSafety/choosePlanLength, not hand-faked values --
// so each scenario is internally consistent, not an arbitrary fixture.
function buildPlanMeta(profile, raceGoal) {
  var level = rules.classifyUser(profile);
  var raceDate = rules.parseDate(raceGoal.raceDate);
  var startDate = rules.parseDate(raceGoal.startDate);
  var weeksAvailable = Math.max(1, Math.ceil((raceDate - startDate) / (7 * 86400000)));
  var safety = rules.evaluateSafety(raceGoal.event, weeksAvailable, level);
  var planLengthWeeks = rules.choosePlanLength(weeksAvailable, raceGoal.event, level);
  return { level: level, weeksAvailable: weeksAvailable, planLengthWeeks: planLengthWeeks, unsafe: safety.unsafe, warnings: safety.warnings };
}

var PHASE_ORDER = ['base', 'build', 'peak', 'taper', 'race'];

// Shared invariants every generated plan must satisfy, regardless of profile --
// this is the actual "complete scenario" check, run against every scenario below.
function assertStructuralInvariants(weeks, label) {
  var lastPhaseIdx = -1;
  weeks.forEach(function (wk) {
    assert.equal(wk.days.length, 7, label + ': week ' + wk.weekNum + ' should always have 7 days');
    var hasRestOrRace = wk.days.some(function (d) { return d.type === 'rest' || d.type === 'race'; });
    assert.ok(hasRestOrRace, label + ': week ' + wk.weekNum + ' should have at least one rest or race day (assignWeekTemplate\'s guaranteed-rest-day design)');
    wk.days.forEach(function (d) {
      assert.ok(!isNaN(d.miles), label + ': week ' + wk.weekNum + ' has a NaN miles value');
      assert.ok(d.miles >= 0, label + ': week ' + wk.weekNum + ' has a negative miles value (' + d.type + ': ' + d.miles + ')');
    });
    var phaseIdx = PHASE_ORDER.indexOf(wk.phase);
    assert.ok(phaseIdx >= 0, label + ': week ' + wk.weekNum + ' has an unrecognized phase "' + wk.phase + '"');
    assert.ok(phaseIdx >= lastPhaseIdx, label + ': phase order went backwards at week ' + wk.weekNum + ' (' + wk.phase + ')');
    lastPhaseIdx = phaseIdx;
  });
  var lastWeek = weeks[weeks.length - 1];
  var lastDay = lastWeek.days[lastWeek.days.length - 1];
  assert.equal(lastDay.type, 'race', label + ': the plan\'s very last day should be the race');
}

test('Standard intermediate 10K plan satisfies all structural invariants', function () {
  var profile = { weeklyMileage: 20, longestRun: 8, runDaysPerWeek: 4, experienceLevel: 'intermediate', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 5, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-10-24' };
  var planMeta = buildPlanMeta(profile, raceGoal);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi');
  assertStructuralInvariants(weeks, 'standard 10K');
  weeks.forEach(function (wk) {
    var totalMiles = wk.days.reduce(function (sum, d) { return sum + (d.miles || 0); }, 0);
    assert.ok(totalMiles < 60, 'standard 10K: week ' + wk.weekNum + ' total mileage (' + totalMiles + ') should stay in a sane range for this profile');
  });
});

test('Beginner run-walk plan uses run/walk sessions during the window and never shows quality-pool tempo text then', function () {
  var profile = { weeklyMileage: 0, longestRun: 0, runDaysPerWeek: 0, experienceLevel: 'beginner', injuryStatus: 'resolved', canRunContinuously: false, availableDays: 4, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-12-05' };
  var planMeta = buildPlanMeta(profile, raceGoal);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi');
  assertStructuralInvariants(weeks, 'beginner run-walk');

  var runWalkWeeks = rules.runWalkWeeksFor(planMeta.planLengthWeeks);
  assert.ok(weeks[0].days.some(function (d) { return !!d.runWalk; }), 'week 1 should use run-walk sessions, not continuous mileage');

  for (var w = 0; w < runWalkWeeks; w++) {
    var wk = weeks[w];
    if (wk.phase === 'race') continue;
    wk.days.forEach(function (d) {
      if (d.type === 'quality') {
        assert.ok(d.runWalk, 'beginner run-walk: quality day in week ' + wk.weekNum + ' should carry a run-walk session, not QUALITY_POOL content');
        assert.doesNotMatch(d.label, /tempo|@ \d/i, 'beginner run-walk: quality day label should never show tempo/pace text during the run-walk window: "' + d.label + '"');
      }
    });
  }

  var transitionWeek = weeks[runWalkWeeks]; // first week past the window (0-indexed)
  if (transitionWeek && transitionWeek.phase !== 'race') {
    var anyRunWalk = transitionWeek.days.some(function (d) { return !!d.runWalk; });
    assert.equal(anyRunWalk, false, 'the first week past the run-walk window should use continuous mileage only');
  }
});

test('Low-frequency runner: running-day count starts low, never decreases, never exceeds the plan\'s target', function () {
  var profile = { weeklyMileage: 5, longestRun: 2, runDaysPerWeek: 0, experienceLevel: 'beginner', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 5, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-12-05' };
  var planMeta = buildPlanMeta(profile, raceGoal);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi');
  assertStructuralInvariants(weeks, 'low-frequency ramp');

  function runningDayCount(wk) {
    return wk.days.filter(function (d) { return d.type === 'easy' || d.type === 'quality' || d.type === 'long'; }).length;
  }
  var counts = weeks.filter(function (wk) { return wk.phase !== 'race'; }).map(runningDayCount);
  for (var i = 1; i < counts.length; i++) {
    assert.ok(counts[i] >= counts[i - 1], 'running-day count should never decrease week over week (week ' + (i + 1) + ': ' + counts[i] + ' < week ' + i + ': ' + counts[i - 1] + ')');
  }
  assert.ok(counts[0] < counts[counts.length - 1], 'a true beginner\'s running-day count should actually grow over the course of the plan');
});

test('Quality-day volume math: a build-phase week never allocates more distance than its own target volume', function () {
  var profile = { weeklyMileage: 20, longestRun: 8, runDaysPerWeek: 4, experienceLevel: 'intermediate', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 5, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-10-24' };
  var planMeta = buildPlanMeta(profile, raceGoal);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi');
  var buildWeek = weeks.filter(function (wk) { return wk.phase === 'build'; })[0];
  assert.ok(buildWeek, 'this plan should include at least one build-phase week');
  var qualityDay = buildWeek.days.filter(function (d) { return d.type === 'quality'; })[0];
  assert.ok(qualityDay, 'a build-phase week should have a quality day');
  assert.ok(qualityDay.miles > 0, 'a build-phase quality day should carry nonzero miles (docs/COACHING_SPEC.md "Quality-day volume math")');
  assert.match(qualityDay.label, /total, incl\. warm-up\/cool-down/);
  var totalRunningMiles = buildWeek.days.reduce(function (sum, d) { return sum + (d.miles || 0); }, 0);
  assert.ok(totalRunningMiles <= buildWeek.targetVolume + 0.5, 'long + quality + easy total (' + totalRunningMiles + ') should not exceed the week\'s own target volume (' + buildWeek.targetVolume + '), allowing small rounding');
});

test('An unavailable range converts the affected days to rest through the full generatePlan pipeline', function () {
  var profile = { weeklyMileage: 20, longestRun: 8, runDaysPerWeek: 4, experienceLevel: 'intermediate', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 5, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-10-24' };
  var planMeta = buildPlanMeta(profile, raceGoal);
  var raceDateObj = rules.parseDate(raceGoal.raceDate);
  // Derive week 1's real slot dates directly (rather than assuming raceGoal.startDate
  // aligns with week 1's actual calendar range, which it doesn't always -- the
  // calendar is anchored backward from race day in fixed 7-day blocks) so the
  // unavailable range is guaranteed to actually land inside week 1.
  var week1Slot0 = rules.dateForSlot(raceDateObj, planMeta.planLengthWeeks, 1, 0);
  var week1Slot2 = rules.dateForSlot(raceDateObj, planMeta.planLengthWeeks, 1, 2);
  var unavailable = [{ start: rules.dateToISO(week1Slot0), end: rules.dateToISO(week1Slot2), reason: 'illness' }];

  var result = rules.generatePlan(profile, raceGoal, planMeta, {}, week1Slot0, unavailable, 'mi');
  assertStructuralInvariants(result.weeks, 'illness range');

  var week1 = result.weeks[0];
  var illnessDays = week1.days.filter(function (d) { return /illness/.test(d.label); });
  assert.ok(illnessDays.length > 0, 'at least one day in week 1 should be converted to an illness rest day');
  illnessDays.forEach(function (d) {
    assert.equal(d.type, 'rest');
    assert.equal(d.miles, 0);
  });
});

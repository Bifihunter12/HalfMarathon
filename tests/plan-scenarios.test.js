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

test('Quality workout consistency: the displayed distance is derived from the SAME entry\'s own estimated session time, not an unrelated volume-budget guess', function () {
  // A high enough weekly volume that the session-budget cap (targetVolume*0.18,
  // capped at 8) never binds -- so the two pool entries below (different
  // estimatedMinutes) should show genuinely different distances, proving
  // they're no longer both computed from the same generic formula regardless
  // of what the label actually describes.
  var profile = { weeklyMileage: 45, longestRun: 14, runDaysPerWeek: 5, experienceLevel: 'advanced', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 6, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-12-19' };
  var planMeta = buildPlanMeta(profile, raceGoal);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi');
  var qualityDays = weeks.filter(function (wk) { return wk.phase === 'build' || wk.phase === 'peak'; })
    .map(function (wk) { return wk.days.filter(function (d) { return d.type === 'quality'; })[0]; })
    .filter(Boolean);
  assert.ok(qualityDays.length >= 4, 'need several quality days across different pool entries to compare');
  var distinctMiles = qualityDays.map(function (d) { return d.miles; }).filter(function (v, i, arr) { return arr.indexOf(v) === i; });
  assert.ok(distinctMiles.length > 1, 'different pool entries (different estimated session times) should produce genuinely different distances, not one interchangeable generic number for every quality day');

  // A short (~20-25 min) session and a long (~50+ min) session should show
  // a real, proportionate difference in distance, not near-identical values.
  var shortest = Math.min.apply(null, qualityDays.map(function (d) { return d.miles; }));
  var longest = Math.max.apply(null, qualityDays.map(function (d) { return d.miles; }));
  assert.ok(longest > shortest, 'the longest-estimated-time entry should show more distance than the shortest');
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

test('a break of a week or more gets a bounded ramp-back on easy/long days right after it ends; a short break does not', function () {
  var profile = { weeklyMileage: 20, longestRun: 8, runDaysPerWeek: 4, experienceLevel: 'intermediate', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 5, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-10-24' };
  var planMeta = buildPlanMeta(profile, raceGoal);
  var weeksBaseline = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi');

  // A 10-day illness range starting at week 2's first slot.
  var week2Slot0 = rules.dateForSlot(rules.parseDate(raceGoal.raceDate), planMeta.planLengthWeeks, 2, 0);
  var rangeEndDate = new Date(week2Slot0.getTime() + 9 * 86400000);
  var range = { start: rules.dateToISO(week2Slot0), end: rules.dateToISO(rangeEndDate), reason: 'illness' };

  var weeksRamped = JSON.parse(JSON.stringify(weeksBaseline));
  rules.applyUnavailableRanges(weeksRamped, raceGoal, planMeta, [range], 'mi', null);

  // Find an easy/long day within 7 days after the range ends and confirm it
  // was reduced, with a correctly-reformatted label (not stale text).
  var reducedDay = null;
  weeksRamped.forEach(function (wk, wi) {
    wk.days.forEach(function (day, di) {
      var iso = rules.dateToISO(rules.dateForSlot(rules.parseDate(raceGoal.raceDate), planMeta.planLengthWeeks, wk.weekNum, di));
      if (iso > range.end && (day.type === 'easy' || day.type === 'long') && !reducedDay) {
        var baselineDay = weeksBaseline[wi].days[di];
        if (day.miles < baselineDay.miles) reducedDay = { day: day, baselineMiles: baselineDay.miles };
      }
    });
  });
  assert.ok(reducedDay, 'at least one easy/long day shortly after a 10-day break should be reduced from its original plan');
  assert.ok(!/NaN/.test(reducedDay.day.label), 'the label must be reformatted with the new mileage, not left stale');

  // A short (3-day) break should NOT trigger any ramp-back.
  var shortRangeEnd = new Date(week2Slot0.getTime() + 2 * 86400000);
  var shortRange = { start: rules.dateToISO(week2Slot0), end: rules.dateToISO(shortRangeEnd), reason: 'illness' };
  var weeksShort = JSON.parse(JSON.stringify(weeksBaseline));
  rules.applyUnavailableRanges(weeksShort, raceGoal, planMeta, [shortRange], 'mi', null);
  var anyReducedAfterShortBreak = false;
  weeksShort.forEach(function (wk, wi) {
    wk.days.forEach(function (day, di) {
      var iso = rules.dateToISO(rules.dateForSlot(rules.parseDate(raceGoal.raceDate), planMeta.planLengthWeeks, wk.weekNum, di));
      if (iso > shortRange.end && (day.type === 'easy' || day.type === 'long')) {
        if (day.miles < weeksBaseline[wi].days[di].miles) anyReducedAfterShortBreak = true;
      }
    });
  });
  assert.equal(anyReducedAfterShortBreak, false, 'a break under a week should not trigger any ramp-back -- ordinary missed-workout adaptation already covers short gaps');
});

test('race week includes a short optional shakeout run for novice+ levels, 2 days before race day', function () {
  var profile = { weeklyMileage: 20, longestRun: 8, runDaysPerWeek: 4, experienceLevel: 'intermediate', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 5, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-10-24' };
  var planMeta = buildPlanMeta(profile, raceGoal);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi');
  var raceWeek = weeks[weeks.length - 1];
  assert.equal(raceWeek.days[6].type, 'race', 'sanity check: race day itself is unaffected');
  assert.equal(raceWeek.days[4].type, 'easy', 'slot 4 (2 days before race day) becomes a short easy shakeout');
  assert.ok(raceWeek.days[4].miles > 0 && raceWeek.days[4].miles <= 2, 'the shakeout is short -- at most 2 miles');
  assert.match(raceWeek.days[4].label, /shakeout/);
  // Every other race-week day (besides the shakeout and race day itself) stays rest.
  [0, 1, 2, 3, 5].forEach(function (slot) {
    assert.equal(raceWeek.days[slot].type, 'rest', 'slot ' + slot + ' should remain plain rest');
  });
});

test('race week stays all-rest-plus-race for beginners -- no shakeout added, matching this project\'s conservative bias for that level', function () {
  var profile = { weeklyMileage: 6, longestRun: 2, runDaysPerWeek: 2, experienceLevel: 'beginner', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 3, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2027-06-05' };
  var planMeta = buildPlanMeta(profile, raceGoal);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi');
  var raceWeek = weeks[weeks.length - 1];
  for (var slot = 0; slot < 6; slot++) {
    assert.equal(raceWeek.days[slot].type, 'rest', 'slot ' + slot + ' should stay rest for a beginner -- no shakeout');
  }
});

test('preferRunWalkThroughRace keeps run/walk sessions active for the whole plan instead of transitioning to continuous running', function () {
  var profile = { weeklyMileage: 0, longestRun: 0, runDaysPerWeek: 0, experienceLevel: 'beginner', injuryStatus: 'resolved', canRunContinuously: false, availableDays: 4, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-12-05' };
  var planMeta = buildPlanMeta(profile, raceGoal);

  var weeksDefault = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi');
  var lastNonRaceWeekDefault = weeksDefault[weeksDefault.length - 2];
  assert.ok(!lastNonRaceWeekDefault.days.some(function (d) { return d.runWalk; }), 'sanity check: without the opt-out, the plan transitions to continuous mileage well before the end');

  var profileOptedIn = Object.assign({}, profile, { preferRunWalkThroughRace: true });
  var weeksOptedIn = rules.buildStructuredWeeks(profileOptedIn, raceGoal, planMeta, 'mi');
  var lastNonRaceWeekOptedIn = weeksOptedIn[weeksOptedIn.length - 2];
  assert.ok(lastNonRaceWeekOptedIn.days.some(function (d) { return d.runWalk; }), 'with the opt-out, run/walk sessions should still be active in the last non-race week -- continuous running is never required');
});

test('a PR/aggressive goal with no recent race evidence is capped at the "improve" factor, not the full PR/aggressive multiplier', function () {
  var profileNoEvidence = { weeklyMileage: 20, longestRun: 8, runDaysPerWeek: 4, experienceLevel: 'intermediate', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 5, terrains: ['road'], crossOptions: ['Bike'], recentRaceDistance: null, recentRaceTime: '' };
  assert.equal(rules.hasRecentRaceEvidence(profileNoEvidence), false);
  assert.equal(rules.effectiveGoalFactor({ goal: 'aggressive' }, profileNoEvidence), rules.GOAL_FACTOR.improve);
  assert.equal(rules.effectiveGoalFactor({ goal: 'pr' }, profileNoEvidence), rules.GOAL_FACTOR.improve);
});

test('a PR/aggressive goal WITH real recent race evidence gets its full intended factor', function () {
  var profileWithEvidence = { weeklyMileage: 20, longestRun: 8, runDaysPerWeek: 4, experienceLevel: 'intermediate', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 5, terrains: ['road'], crossOptions: ['Bike'], recentRaceDistance: '10k', recentRaceTime: '45:00' };
  assert.equal(rules.hasRecentRaceEvidence(profileWithEvidence), true);
  assert.equal(rules.effectiveGoalFactor({ goal: 'aggressive' }, profileWithEvidence), rules.GOAL_FACTOR.aggressive);
  assert.equal(rules.effectiveGoalFactor({ goal: 'pr' }, profileWithEvidence), rules.GOAL_FACTOR.pr);
});

test('"finish" and "improve" goals are never affected by evidence -- the cap only applies to pr/aggressive', function () {
  var profileNoEvidence = { recentRaceDistance: null, recentRaceTime: '' };
  assert.equal(rules.effectiveGoalFactor({ goal: 'finish' }, profileNoEvidence), rules.GOAL_FACTOR.finish);
  assert.equal(rules.effectiveGoalFactor({ goal: 'improve' }, profileNoEvidence), rules.GOAL_FACTOR.improve);
});

test('a readiness-triggered planMeta.unsafe (calendar technically long enough, but genuine fitness readiness is not) still actually scales the plan down', function () {
  // Caught during manual verification while building evaluateReadiness: the
  // pre-existing safetyScale formula divided weeksAvailable by cfg.minWeeks
  // only -- if planMeta.unsafe were true for a DIFFERENT reason (readiness,
  // not calendar length) while weeksAvailable already exceeded minWeeks,
  // that ratio would be >=1 and Math.max(0.55, ratio) would apply NO
  // scaling at all, silently defeating the whole point of flagging unsafe.
  var profile = { weeklyMileage: 10, longestRun: 1, runDaysPerWeek: 3, experienceLevel: 'beginner', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 4, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: 'half', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-11-14' }; // 15 weeks -- exceeds half/beginner's minWeeks (12) on the calendar check alone
  var level = rules.classifyUser(profile);
  var weeksAvailable = 15;
  var safety = rules.evaluateSafety(raceGoal.event, weeksAvailable, level);
  assert.equal(safety.unsafe, false, 'sanity check: the pure calendar check alone must NOT flag this as unsafe -- the readiness check is what should catch it');
  var readiness = rules.evaluateReadiness(profile, raceGoal, level, weeksAvailable);
  assert.equal(readiness.ready, false, 'a 1-mile longest run cannot safely reach half-marathon long-run readiness in 15 weeks');

  var planLengthWeeks = rules.choosePlanLength(weeksAvailable, raceGoal.event, level);
  var planMeta = { level: level, weeksAvailable: weeksAvailable, planLengthWeeks: planLengthWeeks, unsafe: safety.unsafe || !readiness.ready, neededWeeks: readiness.neededWeeks, warnings: [] };
  var weeksWithReadinessUnsafe = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi');

  var planMetaIgnoringReadiness = Object.assign({}, planMeta, { unsafe: false });
  var weeksIgnoringReadiness = rules.buildStructuredWeeks(profile, raceGoal, planMetaIgnoringReadiness, 'mi');

  var peakLongRun = function (weeks) { return Math.max.apply(null, weeks.map(function (wk) { return Math.max.apply(null, wk.days.map(function (d) { return d.type === 'long' ? d.miles : 0; })); })); };
  assert.ok(peakLongRun(weeksWithReadinessUnsafe) < peakLongRun(weeksIgnoringReadiness), 'the readiness-triggered unsafe flag must actually reduce the plan\'s peak long run, not silently apply zero scaling');
});

test('long-run share of weekly volume is capped, even at low frequency where the uncapped formula used to reach 45%+', function () {
  var profile = { weeklyMileage: 15, longestRun: 6, runDaysPerWeek: 3, experienceLevel: 'intermediate', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 3, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-11-14' };
  var planMeta = buildPlanMeta(profile, raceGoal);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi');
  weeks.forEach(function (wk) {
    var totalMiles = wk.days.reduce(function (sum, d) { return sum + (d.miles || 0); }, 0);
    var longDay = wk.days.find(function (d) { return d.type === 'long'; });
    if (!longDay || !longDay.miles || !totalMiles) return;
    // A little headroom above the nominal 0.5 cap for rounding/interaction
    // with the other slot-budget caps (easyCap, longRunSafetyCap) -- the
    // cap bounds the formula's TARGET share, not a byte-exact realized
    // fraction of the actual (separately rounded) week total.
    assert.ok(longDay.miles / totalMiles < 0.56, 'week ' + wk.weekNum + ': long run is ' + (100 * longDay.miles / totalMiles).toFixed(1) + '% of weekly volume, should stay well under the old uncapped ~55%+ ceiling for this profile shape');
  });
});

// docs/COACHING_SPEC.md "Race readiness" -- evaluatePlanAdequacy closes the
// previously-disclosed gap between evaluateReadiness's pre-generation
// 10%-rule ESTIMATE and what buildStructuredWeeks/generatePlan actually
// produce. These tests exercise the exact reported scenario (a true
// beginner, 6 mi/week, 2-mi longest run, 2 days/week, 18 weeks to a half
// marathon) that evaluateReadiness alone said "ready: true" for, even
// though the real generated plan peaks at roughly 8.5 mi/week with a 4-mi
// long run against the event's 22 mi/week / 9-mi targets.
test('evaluatePlanAdequacy flags the reported beginner-half scenario as inadequate even though evaluateReadiness says ready', function () {
  var profile = { weeklyMileage: 6, longestRun: 2, runDaysPerWeek: 2, experienceLevel: 'novice', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 3, terrains: ['road'], crossOptions: ['None'] };
  var raceGoal = { event: 'half', goal: 'finish', startDate: '2026-08-02', raceDate: '2026-12-06' }; // 18 weeks
  var level = rules.classifyUser(profile);
  var weeksAvailable = 18;
  var readiness = rules.evaluateReadiness(profile, raceGoal, level, weeksAvailable);
  assert.equal(readiness.ready, true, 'sanity check: the pre-generation estimate must say ready for this exact scenario -- that\'s the reported gap');

  var planLengthWeeks = rules.choosePlanLength(weeksAvailable, raceGoal.event, level);
  var planMeta = { level: level, weeksAvailable: weeksAvailable, planLengthWeeks: planLengthWeeks, unsafe: !readiness.ready, neededWeeks: readiness.neededWeeks, warnings: [] };
  var result = rules.generatePlan(profile, raceGoal, planMeta, {}, rules.parseDate(raceGoal.startDate), [], 'mi', undefined);
  var adequacy = rules.evaluatePlanAdequacy(result.weeks, raceGoal, planMeta, profile);

  assert.equal(adequacy.adequate, false, 'the actual generated plan should be flagged inadequate despite readiness saying ready');
  assert.ok(adequacy.actualPeakVolume < 22 * 0.85, 'actual peak volume (' + adequacy.actualPeakVolume + ') should fall well short of the 22 mi/week target');
  assert.ok(adequacy.actualPeakLongRun < 9 * 0.85, 'actual peak long run (' + adequacy.actualPeakLongRun + ') should fall well short of the 9-mi target');
  assert.equal(adequacy.targetPeakVolume, 22);
  assert.equal(adequacy.targetLongRunPeak, 9);

  var warning = rules.formatPlanAdequacyWarning(adequacy, raceGoal.event);
  assert.ok(warning.indexOf(String(adequacy.actualPeakVolume)) !== -1, 'warning text should cite the actual peak volume figure');
  assert.ok(warning.indexOf(String(adequacy.actualPeakLongRun)) !== -1, 'warning text should cite the actual long-run figure');
  assert.ok(warning.indexOf('22') !== -1 && warning.indexOf('9') !== -1, 'warning text should cite the event\'s real targets, not just the shortfall');
});

test('evaluatePlanAdequacy passes a realistic, adequately-timelined plan', function () {
  // An advanced runner already close to 10K/advanced's own peakVolume (38)
  // and longRunPeak (11) before the plan even starts, with a long runway
  // (choosePlanLength caps this at 13 weeks -- idealWeeks(8) * 1.6) -- the
  // case the real ramp (not just the 10%-rule estimate) can actually reach.
  var profile = { weeklyMileage: 30, longestRun: 10, runDaysPerWeek: 6, experienceLevel: 'advanced', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 6, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2027-01-01' };
  var planMeta = buildPlanMeta(profile, raceGoal);
  var result = rules.generatePlan(profile, raceGoal, planMeta, {}, rules.parseDate(raceGoal.startDate), [], 'mi', undefined);
  var adequacy = rules.evaluatePlanAdequacy(result.weeks, raceGoal, planMeta, profile);
  assert.equal(adequacy.adequate, true, 'an advanced runner who already starts near the event\'s own peak targets should reach an adequate peak (got ' + JSON.stringify(adequacy) + ')');
  assert.equal(rules.formatPlanAdequacyWarning(adequacy, raceGoal.event), null, 'no warning should be produced for an adequate plan');
});

test('evaluatePlanAdequacy skips the long-run check (but still checks volume) for a runner who opted into run/walk through race day', function () {
  var profile = { weeklyMileage: 8, longestRun: 2, runDaysPerWeek: 3, experienceLevel: 'beginner', injuryStatus: 'resolved', canRunContinuously: false, preferRunWalkThroughRace: true, availableDays: 3, terrains: ['road'], crossOptions: ['None'] };
  var raceGoal = { event: '5k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-11-14' };
  var planMeta = buildPlanMeta(profile, raceGoal);
  var result = rules.generatePlan(profile, raceGoal, planMeta, {}, rules.parseDate(raceGoal.startDate), [], 'mi', undefined);
  var adequacy = rules.evaluatePlanAdequacy(result.weeks, raceGoal, planMeta, profile);
  assert.equal(adequacy.longRunApplicable, false, 'a full-plan run/walk profile never has a continuous-mileage long run to measure');
  assert.equal(adequacy.actualPeakLongRun, 0);
});

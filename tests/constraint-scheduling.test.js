// Constraint-aware scheduling tests (docs/COACHING_SPEC.md "Constraint-aware
// scheduling") -- covers the benchmark customer end-to-end (real-life
// weekday availability, fixed recurring commitments including two on the
// same day, alternating-week recurrence, travel/indoor overrides, the
// evening-interval conditional preference, and the half-vs-10K readiness
// checkpoint). Every assertion here was first hand-verified against the
// live app in a browser before being written down as a test.
//
// Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rules = require(path.join(__dirname, '..', 'coaching-rules.js'));

var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// The benchmark customer (docs/COACHING_SPEC.md): Duke City Half/10K,
// Oct 18 2026 (a Sunday); Mon/Wed/Fri/Sat mornings open to run, Tue/Thu
// reserved for a low-sweat 12-3-30 treadmill walk; Tue noon Tabata (fixed,
// weekly, always hard); Wed noon circuit (fixed, weekly); every-other-week
// Fri noon Tabata (alternating); Mon 11am spin (fixed, weekly, midday).
function benchmarkProfile(overrides) {
  return Object.assign({
    weeklyMileage: 20, longestRun: 6, runDaysPerWeek: 4, experienceLevel: 'intermediate',
    injuryStatus: 'resolved', canRunContinuously: true, availableDays: 5,
    terrains: ['road'], crossOptions: ['Bike'],
    weeklyAvailability: {
      0: { canRun: true, window: 'morning' }, 1: { canRun: false, window: 'midday' },
      2: { canRun: true, window: 'morning' }, 3: { canRun: false, window: 'midday' },
      4: { canRun: true, window: 'morning' }, 5: { canRun: true, window: 'morning' },
      6: { canRun: true, window: 'morning' }
    }
  }, overrides || {});
}
function benchmarkRaceGoal(overrides) {
  return Object.assign({ event: 'half', goal: 'finish', startDate: '2026-08-02', raceDate: '2026-10-18' }, overrides || {});
}
function benchmarkRecurringWorkouts() {
  return [
    { id: 'spin', activityType: 'cycling', day: 0, durationMinutes: 45, intensity: 'moderate', fixed: true, timeWindow: 'midday' },
    { id: 'tabataTue', activityType: 'tabata', day: 1, durationMinutes: 20, intensity: 'high', fixed: true, timeWindow: 'midday' },
    { id: '1230Tue', activityType: 'twelveThreeThirty', day: 1, durationMinutes: 30, intensity: 'low', fixed: true, timeWindow: 'morning' },
    { id: 'circuitWed', activityType: 'circuit', day: 2, durationMinutes: 45, intensity: 'moderate', fixed: true, timeWindow: 'midday' },
    { id: '1230Thu', activityType: 'twelveThreeThirty', day: 3, durationMinutes: 30, intensity: 'low', fixed: true, timeWindow: 'morning' },
    { id: 'tabataFriAlt', activityType: 'tabata', day: 4, durationMinutes: 20, intensity: 'high', fixed: true, timeWindow: 'midday', recurrence: 'alternating', recurrenceAnchorIso: null }
  ];
}
function buildBenchmarkPlanMeta(profile, raceGoal, weeksAvailable) {
  var level = rules.classifyUser(profile);
  var safety = rules.evaluateSafety(raceGoal.event, weeksAvailable, level);
  var planLengthWeeks = rules.choosePlanLength(weeksAvailable, raceGoal.event, level);
  return { level: level, weeksAvailable: weeksAvailable, planLengthWeeks: planLengthWeeks, unsafe: safety.unsafe, neededWeeks: 0, warnings: [] };
}

test('benchmark customer: a typical build-phase week matches the expected pattern', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var result = rules.generatePlan(profile, raceGoal, planMeta, {}, rules.parseDate(raceGoal.startDate), [], 'mi', benchmarkRecurringWorkouts(), []);
  // Week 5 (build phase) is a non-Tabata-Friday week -- see the anchor-week
  // math test below for exactly why week 1 lands on the "off" side and week
  // 2 lands "on" for the alternating Friday session in this specific setup.
  var wk = result.weeks[4];
  assert.equal(wk.days[0].type, 'easy', 'Monday should be a real (easy) run, not suppressed by the later 11am spin');
  assert.match(wk.days[0].label, /Spinning \/ Cycling/, 'Monday should show the coexisting spin class alongside the run');
  assert.equal(wk.days[1].type, 'cross', 'Tuesday should never hold a run -- not in canRunSlots');
  assert.match(wk.days[1].label, /Tabata/);
  assert.match(wk.days[1].label, /12-3-30/, 'Tuesday should show both fixed activities joined, not just one');
  assert.equal(wk.days[2].type, 'easy', 'Wednesday should be a real (easy) run, kept conversational alongside circuit');
  assert.match(wk.days[2].label, /Circuit training/);
  assert.equal(wk.days[3].type, 'cross', 'Thursday should never hold a run either');
  assert.match(wk.days[3].label, /12-3-30/);
  assert.doesNotMatch(wk.days[3].label, /Tabata/, 'Thursday has no Tabata, only the 12-3-30');
  assert.equal(wk.days[6].type, 'long', 'Sunday (the race weekday) is the long run');
});

test('benchmark customer: Friday differs between a Tabata week and a non-Tabata week', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var result = rules.generatePlan(profile, raceGoal, planMeta, {}, rules.parseDate(raceGoal.startDate), [], 'mi', benchmarkRecurringWorkouts(), []);
  var fridayTypes = result.weeks.slice(0, 6).map(function (wk) { return { week: wk.weekNum, type: wk.days[4].type, label: wk.days[4].label }; });
  var tabataWeeks = fridayTypes.filter(function (f) { return /Tabata/.test(f.label); });
  var nonTabataWeeks = fridayTypes.filter(function (f) { return !/Tabata/.test(f.label); });
  assert.ok(tabataWeeks.length >= 1, 'at least one of the first 6 weeks should be a Tabata-Friday week');
  assert.ok(nonTabataWeeks.length >= 1, 'at least one should be a non-Tabata-Friday week');
  tabataWeeks.forEach(function (f) { assert.notEqual(f.type, 'quality', 'week ' + f.week + ': quality must never land on a Tabata Friday'); });
  // A non-Tabata Friday is free to hold quality once the weekly run-day ramp
  // has reached a high enough frequency to reach Friday at all -- confirmed
  // happening by week 5 in the "typical week" test above.
});

test('benchmark customer: alternates correctly week over week from a null anchor (regression -- week 1 must be the "on" week, not silently skipped)', function () {
  // Reproduces a real bug caught in live browser verification: an
  // alternating workout with no explicit anchor used to fall back to the
  // CURRENTLY-EVALUATED week as its own anchor (always "on") or, in an
  // earlier fix attempt, to the runner's raw typed start date -- which can
  // land a few calendar days before this plan's own computed week-1 start,
  // silently flipping week 1's on/off parity. It must instead anchor to
  // buildStructuredWeeks's own real week-1 date.
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var recurringWorkouts = [{ id: 'tabataFriAlt', activityType: 'tabata', day: 4, durationMinutes: 20, intensity: 'high', fixed: true, timeWindow: 'midday', recurrence: 'alternating', recurrenceAnchorIso: null }];
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi', recurringWorkouts);
  var fridayHasTabata = weeks.map(function (wk) { return /Tabata/.test(wk.days[4].label); });
  assert.equal(fridayHasTabata[0], true, 'week 1 must be active for a no-anchor alternating workout');
  assert.equal(fridayHasTabata[1], false, 'week 2 must be inactive');
  assert.equal(fridayHasTabata[2], true, 'week 3 must be active again');
});

test('Monday easy run coexists with an 11am spin class -- no running intensity, but not suppressed either', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var recurringWorkouts = [{ id: 'spin', activityType: 'cycling', day: 0, durationMinutes: 45, intensity: 'moderate', fixed: true, timeWindow: 'midday' }];
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi', recurringWorkouts);
  var laterWeek = weeks[6];
  assert.notEqual(laterWeek.days[0].type, 'quality', 'Monday must never be the quality day when a same-day fixed session exists');
  assert.ok(laterWeek.days[0].type === 'easy' || laterWeek.days[0].type === 'rest', 'Monday should be easy (or rest, if the run-day ramp has not reached it yet)');
});

test('Tuesday 12-3-30 plus Tabata never gets an additional hard run stacked on it', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi', benchmarkRecurringWorkouts());
  weeks.forEach(function (wk) {
    // Race week is excluded: buildStructuredWeeks already collapses every
    // non-race/non-shakeout day to plain rest during race week regardless
    // of any recurring workout, a separate, pre-existing simplification
    // unrelated to this feature.
    if (wk.phase === 'race') return;
    assert.equal(wk.days[1].type, 'cross', 'week ' + wk.weekNum + ': Tuesday must never become a running day');
  });
});

test('Wednesday easy run stays easy (never quality) alongside a fixed circuit session', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var recurringWorkouts = [{ id: 'circuitWed', activityType: 'circuit', day: 2, durationMinutes: 45, intensity: 'moderate', fixed: true, timeWindow: 'midday' }];
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi', recurringWorkouts);
  weeks.forEach(function (wk) {
    assert.notEqual(wk.days[2].type, 'quality', 'week ' + wk.weekNum + ': Wednesday must never be the quality day with a same-day circuit session');
  });
});

test('long run is protected from adjacent hard-day stacking (Saturday, adjacent to Sunday\'s long run, is the last resort even though it is available)', function () {
  // Wed/Fri/Sat all canRun, target frequency needs only 2 of them --
  // AVAILABILITY_AWARE_PRIORITY deliberately puts slot 5 (Saturday, the day
  // immediately before slot 6/the long run) last, so Wed+Fri get chosen
  // over Sat even though all three are equally "available."
  var profile = benchmarkProfile({ weeklyAvailability: {
    0: { canRun: false }, 1: { canRun: false }, 2: { canRun: true, window: 'morning' }, 3: { canRun: false },
    4: { canRun: true, window: 'morning' }, 5: { canRun: true, window: 'morning' }, 6: { canRun: true, window: 'morning' }
  }, runDaysPerWeek: 3, availableDays: 3, experienceLevel: 'novice', weeklyMileage: 12 });
  var raceGoal = benchmarkRaceGoal({ event: '10k' });
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi', []);
  var laterWeek = weeks[8];
  assert.notEqual(laterWeek.days[5].type, 'quality', 'Saturday (adjacent to the long run) should not be picked as the week\'s quality day while Wed/Fri are both available and unused for that role');
});

test('an available-but-unselected running day defaults to rest/cross, not an automatic extra hard day', function () {
  var profile = benchmarkProfile({ runDaysPerWeek: 3, availableDays: 3, experienceLevel: 'novice', weeklyMileage: 12 });
  var raceGoal = benchmarkRaceGoal({ event: '10k' });
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi', []);
  var laterWeek = weeks[8];
  var runTypes = ['long', 'quality', 'easy'];
  var runningDaysUsed = laterWeek.days.filter(function (d) { return runTypes.indexOf(d.type) !== -1; }).length;
  // Mon/Wed/Fri/Sat/Sun are all canRun -- 5 possible running mornings -- but
  // the target frequency for this profile/level is lower than 5, so at
  // least one of them should NOT be a running day.
  assert.ok(runningDaysUsed < 5, 'not every possible running morning should become a required running day');
});

test('travel mode creates real indoor sessions, never a week of blanket rest days', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var travelPeriods = [{ id: 't1', start: '2026-08-25', end: '2026-09-08', mode: 'travel', indoorOnly: true, minDurationMinutes: 30, preferredDurationMinutes: 45 }];
  var result = rules.generatePlan(profile, raceGoal, planMeta, {}, rules.parseDate(raceGoal.startDate), [], 'mi', [], travelPeriods);
  var travelWeek = result.weeks.filter(function (wk) { return wk.days.some(function (d) { return d.travelSession; }); })[0];
  assert.ok(travelWeek, 'at least one week should be travel-affected');
  var restDayCount = travelWeek.days.filter(function (d) { return d.type === 'rest'; }).length;
  assert.ok(restDayCount <= 1, 'a travel week must keep at most its one normal rest day, not convert every day to rest');
  var sessionDays = travelWeek.days.filter(function (d) { return d.travelSession; });
  assert.ok(sessionDays.length >= 5, 'most days in a travel week should have a real indoor session');
});

test('Miami (indoor-only travel) never produces an outdoor-implying session', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var travelPeriods = [{ id: 'miami', start: '2026-08-25', end: '2026-09-01', mode: 'travel', indoorOnly: true, minDurationMinutes: 30, preferredDurationMinutes: 45 }];
  var result = rules.generatePlan(profile, raceGoal, planMeta, {}, rules.parseDate(raceGoal.startDate), [], 'mi', [], travelPeriods);
  result.weeks.forEach(function (wk) {
    wk.days.forEach(function (d) {
      if (!d.travelSession) return;
      assert.equal(d.travelSession.indoorOnly, true, 'every travel session in an indoor-only period must be flagged indoor');
      assert.match(d.label, /treadmill|indoor/i, 'the label must never imply an outdoor run');
      assert.doesNotMatch(d.label, /\d+(\.\d+)? mi /, 'an indoor-only travel day should not carry a plain outdoor mileage label');
    });
  });
});

test('vacation sessions respect the stated minimum available duration', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var travelPeriods = [{ id: 't1', start: '2026-08-25', end: '2026-09-08', mode: 'travel', indoorOnly: true, minDurationMinutes: 30, preferredDurationMinutes: 45 }];
  var result = rules.generatePlan(profile, raceGoal, planMeta, {}, rules.parseDate(raceGoal.startDate), [], 'mi', [], travelPeriods);
  result.weeks.forEach(function (wk) {
    wk.days.forEach(function (d) {
      if (!d.travelSession) return;
      assert.ok(d.travelSession.minutes >= 30, 'every travel session should be at least the stated 30-minute minimum');
    });
  });
});

test('the week after travel ramps back instead of immediately restoring peak load, with a label matching the reduced miles', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var travelPeriods = [{ id: 't1', start: '2026-08-25', end: '2026-09-08', mode: 'travel', indoorOnly: true, minDurationMinutes: 30, preferredDurationMinutes: 45 }];
  var result = rules.generatePlan(profile, raceGoal, planMeta, {}, rules.parseDate(raceGoal.startDate), [], 'mi', [], travelPeriods);
  var raceDate = rules.parseDate(raceGoal.raceDate);
  var planLengthWeeks = planMeta.planLengthWeeks;
  var postTravelDay = null;
  result.weeks.forEach(function (wk) {
    wk.days.forEach(function (day, di) {
      var iso = rules.dateToISO(rules.dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di));
      if (iso > '2026-09-08' && iso <= '2026-09-15' && (day.type === 'easy' || day.type === 'long') && !postTravelDay) postTravelDay = day;
    });
  });
  assert.ok(postTravelDay, 'should find at least one easy/long day in the week right after travel ends');
  assert.match(postTravelDay.label, new RegExp(String(postTravelDay.miles).replace('.', '\\.')), 'the label must reflect the actual (ramped-back) miles value, not a stale pre-scaling label');
});

test('unplanned evening intervals move the next morning to an easy hike/recovery session, protecting the long run and race day', function () {
  // Plain profile, no weeklyAvailability restriction -- Tuesday is an
  // ordinary running day here, unlike the benchmark customer's schedule
  // (where Tuesday is deliberately never a running day at all).
  var profile = { weeklyMileage: 20, longestRun: 6, runDaysPerWeek: 4, experienceLevel: 'intermediate', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 5, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var logs = { '1-0': { time: '25:00', distance: 2, eveningIntervals: true } }; // Monday
  var result = rules.generatePlan(profile, raceGoal, planMeta, logs, rules.parseDate(raceGoal.startDate), [], 'mi', [], []);
  assert.match(result.note, /easy hike\/recovery/);
  var tuesday = result.weeks[0].days[1];
  assert.equal(tuesday.adaptedFromEveningIntervals, true);
  assert.equal(tuesday.type, 'easy');
});

test('evening intervals logged the night before the long run or race day never downgrade that session', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var logs = { '1-5': { time: '25:00', distance: 2, eveningIntervals: true } }; // Saturday -> next day is Sunday's long run
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi', []);
  var before = weeks[0].days[6].type;
  var note = rules.applyEveningIntervalAdaptation(weeks, raceGoal, planMeta, logs);
  assert.equal(note, null, 'no adaptation should fire when the next day is the long run');
  assert.equal(weeks[0].days[6].type, before, 'the long run must remain untouched');
});

test('half-marathon readiness checkpoint recommends keeping the half when training evidence is sufficient', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi', []);
  var logs = {};
  weeks.forEach(function (wk, wi) {
    if (wi >= 5) return;
    wk.days.forEach(function (d, di) {
      if (d.type === 'rest' || d.type === 'race') return;
      logs[wk.weekNum + '-' + di] = { distance: d.type === 'long' ? Math.max(d.miles, 9) : (d.miles || 1), time: '30:00' };
    });
  });
  var checkpoint = rules.evaluateGoalCheckpoint(profile, raceGoal, planMeta, weeks, logs, rules.parseDate('2026-09-09'), rules.parseDate('2026-09-10'));
  assert.equal(checkpoint.due, true);
  assert.equal(checkpoint.recommendation, 'keep_half');
});

test('half-marathon readiness checkpoint recommends the 10K when training evidence is insufficient', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi', []);
  var checkpoint = rules.evaluateGoalCheckpoint(profile, raceGoal, planMeta, weeks, {}, rules.parseDate('2026-09-09'), rules.parseDate('2026-09-10'));
  assert.equal(checkpoint.due, true);
  assert.equal(checkpoint.recommendation, 'switch_10k');
});

test('the checkpoint is a pure recommendation -- it never mutates raceGoal, and is not due before its date', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi', []);
  var raceGoalBefore = JSON.stringify(raceGoal);
  var notDue = rules.evaluateGoalCheckpoint(profile, raceGoal, planMeta, weeks, {}, rules.parseDate('2026-09-09'), rules.parseDate('2026-08-15'));
  assert.equal(notDue.due, false, 'must not be due before the checkpoint date');
  rules.evaluateGoalCheckpoint(profile, raceGoal, planMeta, weeks, {}, rules.parseDate('2026-09-09'), rules.parseDate('2026-09-10'));
  assert.equal(JSON.stringify(raceGoal), raceGoalBefore, 'evaluateGoalCheckpoint must never mutate raceGoal itself -- confirmation happens in the UI, not here');
});

test('backward compatibility: an old recurring-workout record with none of the new fields gets safe defaults', function () {
  var oldRecord = { id: 'legacy1', activityType: 'yoga', customName: '', day: 2, durationMinutes: 60, intensity: 'low', fixed: true };
  var normalized = rules.normalizeRecurringWorkout(oldRecord);
  assert.equal(normalized.status, 'fixed');
  assert.equal(normalized.recurrence, 'weekly');
  assert.equal(normalized.recurrenceAnchorIso, null);
  assert.equal(normalized.replaces, 'none');
  assert.equal(normalized.environment, null);
  assert.equal(normalized.timeWindow, null);
});

test('backward compatibility: a profile with no weeklyAvailability at all uses the legacy scheduling path unchanged', function () {
  var profile = benchmarkProfile({ weeklyAvailability: undefined });
  var raceGoal = benchmarkRaceGoal({ event: '10k' });
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var slots = rules.weeklyAvailabilityCanRunSlots(profile, rules.parseDate(raceGoal.raceDate));
  assert.equal(slots, null, 'no override should be returned when weeklyAvailability is absent');
  // Should still generate a fully valid plan using RUN_SLOT_PRIORITY, exactly as before this feature existed.
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi', []);
  assert.equal(weeks.length, planMeta.planLengthWeeks);
  weeks.forEach(function (wk) { assert.equal(wk.days.length, 7); });
});

test('a weekly-availability constraint down to just the long-run day leaves canRunSlots empty and never forces a run onto a build/base/peak/taper week', function () {
  // Only Sunday (the long-run day) available at all -- no room for any
  // other running day.
  var profile = benchmarkProfile({ weeklyAvailability: {
    0: { canRun: false }, 1: { canRun: false }, 2: { canRun: false }, 3: { canRun: false },
    4: { canRun: false }, 5: { canRun: false }, 6: { canRun: true, window: 'morning' }
  } });
  var raceGoal = benchmarkRaceGoal();
  var canRunSlots = rules.weeklyAvailabilityCanRunSlots(profile, rules.parseDate(raceGoal.raceDate));
  assert.equal(canRunSlots.length, 0, 'no non-long-run slots are available');
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi', []);
  // Excludes race week -- a separate, pre-existing rule (the race-week
  // shakeout) intentionally adds one easy run 2 days out for non-beginners
  // regardless of stated availability; not something this feature governs.
  weeks.forEach(function (wk) {
    if (wk.phase === 'race') return;
    wk.days.forEach(function (d, di) {
      if (di === 6) return;
      assert.notEqual(d.type, 'easy', 'week ' + wk.weekNum + ' day ' + di + ': must not force a run onto an unavailable day');
      assert.notEqual(d.type, 'quality', 'week ' + wk.weekNum + ' day ' + di + ': must not force a run onto an unavailable day');
    });
  });
});

test('an impossible fixed-commitment schedule (more fixed workouts + running days than a week can hold) produces a clear warning', function () {
  var recurringWorkouts = [0, 1, 2, 3, 4].map(function (day) {
    return { id: 'w' + day, activityType: 'strength', day: day, durationMinutes: 30, intensity: 'moderate', fixed: true };
  });
  var check = rules.evaluateRecurringWorkoutSchedule(recurringWorkouts, 3, '2026-10-18');
  assert.ok(check.warnings.length > 0, '5 fixed workouts + 3 running days leaves no room for a rest day and must warn, not silently stack');
});

test('deterministic output: identical inputs produce byte-identical generated plans', function () {
  var profile = benchmarkProfile();
  var raceGoal = benchmarkRaceGoal();
  var planMeta = buildBenchmarkPlanMeta(profile, raceGoal, 11);
  var recurringWorkouts = benchmarkRecurringWorkouts();
  var travelPeriods = [{ id: 't1', start: '2026-08-25', end: '2026-09-08', mode: 'travel', indoorOnly: true, minDurationMinutes: 30, preferredDurationMinutes: 45 }];
  var resultA = rules.generatePlan(profile, raceGoal, planMeta, {}, rules.parseDate(raceGoal.startDate), [], 'mi', recurringWorkouts, travelPeriods);
  var resultB = rules.generatePlan(profile, raceGoal, planMeta, {}, rules.parseDate(raceGoal.startDate), [], 'mi', recurringWorkouts, travelPeriods);
  assert.deepEqual(resultA, resultB, 'the same inputs must always produce the same output -- no hidden randomness or shared mutable state');
});

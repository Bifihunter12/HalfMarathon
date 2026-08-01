// Recurring workouts / existing commitments (docs/COACHING_SPEC.md).
// Covers classification, the schedule-safety warning check, and
// buildStructuredWeeks's scheduling integration -- placement, hard-day
// stacking avoidance, strength double-credit avoidance, and backward
// compatibility (the parameter is purely additive).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rules = require(path.join(__dirname, '..', 'coaching-rules.js'));

function buildPlanMeta(profile, raceGoal) {
  var level = rules.classifyUser(profile);
  var raceDate = rules.parseDate(raceGoal.raceDate);
  var startDate = rules.parseDate(raceGoal.startDate);
  var weeksAvailable = Math.max(1, Math.ceil((raceDate - startDate) / (7 * 86400000)));
  var safety = rules.evaluateSafety(raceGoal.event, weeksAvailable, level);
  var planLengthWeeks = rules.choosePlanLength(weeksAvailable, raceGoal.event, level);
  return { level: level, weeksAvailable: weeksAvailable, planLengthWeeks: planLengthWeeks, unsafe: safety.unsafe, warnings: safety.warnings };
}

var BASE_PROFILE = { weeklyMileage: 20, longestRun: 8, runDaysPerWeek: 4, experienceLevel: 'intermediate', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 5, terrains: ['road'], crossOptions: ['Bike'] };
var BASE_RACE_GOAL = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-10-24' };

// ── classifyRecurringWorkout ──────────────────────────────────────────
// One test per worked example from docs/COACHING_SPEC.md, hand-verified
// against the master prompt's own examples before implementation.

test('an easy spin is aerobic-contributing but never a hard day, regardless of cycling\'s high maxHardness', function () {
  var result = rules.classifyRecurringWorkout({ activityType: 'cycling', intensity: 'low' });
  assert.equal(result.aerobicContribution, 'high');
  assert.equal(result.isHardDay, false);
});

test('a hard spin/interval session is a hard day', function () {
  var result = rules.classifyRecurringWorkout({ activityType: 'cycling', intensity: 'high' });
  assert.equal(result.isHardDay, true);
});

test('gentle yoga is mobility-contributing and not a hard day', function () {
  var result = rules.classifyRecurringWorkout({ activityType: 'yoga', intensity: 'low' });
  assert.equal(result.mobilityContribution, 'high');
  assert.equal(result.isHardDay, false);
});

test('hot/power yoga (reported high intensity) becomes a hard day, despite yoga\'s normally-gentle nature', function () {
  var result = rules.classifyRecurringWorkout({ activityType: 'yoga', intensity: 'high' });
  assert.equal(result.isHardDay, true);
});

test('walking never becomes a hard day, even at self-reported high intensity -- a deliberate conservative cap', function () {
  var result = rules.classifyRecurringWorkout({ activityType: 'walking', intensity: 'high' });
  assert.equal(result.isHardDay, false);
});

test('strength training contributes real strength credit regardless of reported intensity', function () {
  assert.equal(rules.classifyRecurringWorkout({ activityType: 'strength', intensity: 'low' }).strengthContribution, 'high');
  assert.equal(rules.classifyRecurringWorkout({ activityType: 'strength', intensity: 'high' }).strengthContribution, 'high');
});

test('an unrecognized activity type falls back to the conservative "other" default', function () {
  var result = rules.classifyRecurringWorkout({ activityType: 'made_up_activity', intensity: 'low' });
  var otherResult = rules.classifyRecurringWorkout({ activityType: 'other', intensity: 'low' });
  assert.deepEqual(result, otherResult);
});

// ── evaluateRecurringWorkoutSchedule ──────────────────────────────────

test('warns when fixed workouts plus running days would leave no room for a rest day', function () {
  var workouts = [
    { fixed: true, day: 0 }, { fixed: true, day: 1 }, { fixed: true, day: 2 }
  ];
  var result = rules.evaluateRecurringWorkoutSchedule(workouts, 5); // 3 fixed + 5 running = 8 > 6
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /no room for a rest day/);
});

test('no warning when the schedule fits comfortably', function () {
  var workouts = [{ fixed: true, day: 1 }];
  var result = rules.evaluateRecurringWorkoutSchedule(workouts, 3);
  assert.deepEqual(result.warnings, []);
});

test('warns when a fixed workout targets the long-run day (the race\'s own weekday, not always Sunday)', function () {
  // BASE_RACE_GOAL's race (2026-10-24) is a Saturday, so slot 6 -- the
  // long-run slot -- falls on Saturday (day:5 in Mon=0..Sun=6 encoding),
  // not day:6 (Sunday). See slotForFixedDay's doc comment in coaching-rules.js.
  var workouts = [{ fixed: true, day: 5 }];
  var result = rules.evaluateRecurringWorkoutSchedule(workouts, 3, BASE_RACE_GOAL.raceDate);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /long-run day/);
});

test('does not warn about the long-run day when raceDateIso is omitted (can\'t determine the mapping without it)', function () {
  var workouts = [{ fixed: true, day: 5 }];
  var result = rules.evaluateRecurringWorkoutSchedule(workouts, 3);
  assert.deepEqual(result.warnings, []);
});

test('movable workouts (fixed: false) never trigger the rest-day warning, regardless of count', function () {
  var workouts = [{ fixed: false, day: null }, { fixed: false, day: null }, { fixed: false, day: null }];
  var result = rules.evaluateRecurringWorkoutSchedule(workouts, 5);
  assert.deepEqual(result.warnings, []);
});

// ── buildStructuredWeeks scheduling integration ───────────────────────

test('a fixed workout is placed on its exact designated weekday, wherever that weekday actually falls in the plan\'s slot numbering', function () {
  // BASE_RACE_GOAL's race (2026-10-24) is a Saturday, so slot 6 = Saturday
  // and the weekdays shift accordingly: Tuesday (day:1) lands on slot 2, not
  // slot 1 (slot 1 would only be Tuesday if the race itself were on Sunday).
  var planMeta = buildPlanMeta(BASE_PROFILE, BASE_RACE_GOAL);
  var workouts = [{ id: 'rw1', activityType: 'cycling', day: 1, durationMinutes: 45, intensity: 'high', fixed: true }];
  var weeks = rules.buildStructuredWeeks(BASE_PROFILE, BASE_RACE_GOAL, planMeta, 'mi', workouts);
  var raceDateObj = rules.parseDate(BASE_RACE_GOAL.raceDate);
  var actualDate = rules.dateForSlot(raceDateObj, planMeta.planLengthWeeks, 1, 2);
  assert.equal(actualDate.getDay(), 2, 'sanity check: slot 2 must actually fall on a Tuesday for this race date');
  var day = weeks[0].days[2];
  assert.equal(day.type, 'cross');
  assert.equal(day.label, '45 min Spinning / Cycling');
  assert.equal(day.recurringWorkout.id, 'rw1');
  assert.equal(day.recurringWorkout.fixed, true);
  assert.equal(weeks[0].days[1].recurringWorkout, undefined, 'must not also/instead land on slot 1 -- that would be the pre-fix bug (assuming slot index == weekday)');
});

test('the same weekday chip maps to a different slot depending on what weekday the race itself falls on', function () {
  // Race on a Sunday: this is the one case where slot 0 really is Monday,
  // so day:1 (Tuesday) lands on slot 1 as the naive assumption would expect.
  var sundayRaceGoal = { event: '10k', goal: 'finish', startDate: '2026-06-01', raceDate: '2026-08-02' };
  var sundayPlanMeta = buildPlanMeta(BASE_PROFILE, sundayRaceGoal);
  var tuesdayWorkout = [{ id: 'rw1', activityType: 'cycling', day: 1, durationMinutes: 45, intensity: 'high', fixed: true }];
  var sundayWeeks = rules.buildStructuredWeeks(BASE_PROFILE, sundayRaceGoal, sundayPlanMeta, 'mi', tuesdayWorkout);
  assert.equal(sundayWeeks[0].days[1].recurringWorkout.id, 'rw1', 'race on Sunday: Tuesday (day:1) lands on slot 1');

  // Race on a Saturday (BASE_RACE_GOAL): the identical day:1 workout must
  // land on a different slot, since slot 6 now means Saturday, not Sunday.
  var satPlanMeta = buildPlanMeta(BASE_PROFILE, BASE_RACE_GOAL);
  var satWeeks = rules.buildStructuredWeeks(BASE_PROFILE, BASE_RACE_GOAL, satPlanMeta, 'mi', tuesdayWorkout);
  assert.equal(satWeeks[0].days[2].recurringWorkout.id, 'rw1', 'race on Saturday: the same day:1 (Tuesday) lands on slot 2 instead');
});

test('a fixed workout targeting the long-run weekday is never placed there -- the real long run is preserved', function () {
  // day:5 (Saturday) is BASE_RACE_GOAL's actual race weekday -- the weekday
  // that maps to slot 6 for this specific plan.
  var planMeta = buildPlanMeta(BASE_PROFILE, BASE_RACE_GOAL);
  var workouts = [{ id: 'rw1', activityType: 'cycling', day: 5, durationMinutes: 30, intensity: 'low', fixed: true }];
  var weeks = rules.buildStructuredWeeks(BASE_PROFILE, BASE_RACE_GOAL, planMeta, 'mi', workouts);
  var longDay = weeks[0].days[6];
  assert.equal(longDay.type, 'long');
  assert.ok(longDay.miles > 0);
  assert.equal(longDay.recurringWorkout, undefined);
});

test('a movable workout consumes one of the plan\'s own auto-generated cross slots instead of the generic label', function () {
  var planMeta = buildPlanMeta(BASE_PROFILE, BASE_RACE_GOAL);
  var workouts = [{ id: 'rw1', activityType: 'yoga', day: null, durationMinutes: 60, intensity: 'low', fixed: false }];
  var weeks = rules.buildStructuredWeeks(BASE_PROFILE, BASE_RACE_GOAL, planMeta, 'mi', workouts);
  var crossDays = weeks[0].days.filter(function (d) { return d.type === 'cross'; });
  var yogaDay = crossDays.filter(function (d) { return d.recurringWorkout && d.recurringWorkout.id === 'rw1'; })[0];
  assert.ok(yogaDay, 'the movable yoga session should occupy one of the week\'s cross slots');
  assert.equal(yogaDay.label, '60 min Yoga');
});

test('a fixed hard workout on a different day than the plan\'s own quality slot demotes that week\'s quality session to easy (no hard-day stacking)', function () {
  var planMeta = buildPlanMeta(BASE_PROFILE, BASE_RACE_GOAL);
  // Base profile's week 1 template puts quality on slot 1 (Tuesday); placing
  // the hard fixed workout on slot 0 (Monday) tests the "different day" case.
  var workouts = [{ id: 'hiit1', activityType: 'hiit', day: 0, durationMinutes: 30, intensity: 'high', fixed: true }];
  var weeks = rules.buildStructuredWeeks(BASE_PROFILE, BASE_RACE_GOAL, planMeta, 'mi', workouts);
  var qualityDays = weeks[0].days.filter(function (d) { return d.type === 'quality'; });
  assert.equal(qualityDays.length, 0, 'no quality/hard running session should exist the same week as a fixed hard workout');
});

test('a recurring strength workout suppresses the plan\'s own auto "+ Strength" bonus so the weekly total never exceeds STRENGTH_SESSIONS budget', function () {
  var profile = { weeklyMileage: 12, longestRun: 5, runDaysPerWeek: 3, experienceLevel: 'novice', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 3, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-10-24' };
  var planMeta = buildPlanMeta(profile, raceGoal);
  var workouts = [{ id: 'str1', activityType: 'strength', day: 1, durationMinutes: 40, intensity: 'moderate', fixed: true }];
  var weeks = rules.buildStructuredWeeks(profile, raceGoal, planMeta, 'mi', workouts);
  var strengthLabeledCount = weeks[0].days.filter(function (d) { return /[Ss]trength/.test(d.label); }).length;
  assert.equal(strengthLabeledCount, 2, 'base phase budget is 2 -- 1 fixed workout + 1 remaining auto-bonus, never 3 even with 3 cross slots available');
});

test('backward compatibility: omitting recurringWorkouts entirely produces the exact same plan as passing an empty array', function () {
  var planMeta = buildPlanMeta(BASE_PROFILE, BASE_RACE_GOAL);
  var weeksOmitted = rules.buildStructuredWeeks(BASE_PROFILE, BASE_RACE_GOAL, planMeta, 'mi');
  var weeksEmpty = rules.buildStructuredWeeks(BASE_PROFILE, BASE_RACE_GOAL, planMeta, 'mi', []);
  assert.deepEqual(weeksOmitted, weeksEmpty);
});

test('generatePlan accepts and threads recurringWorkouts through the full pipeline', function () {
  var planMeta = buildPlanMeta(BASE_PROFILE, BASE_RACE_GOAL);
  var raceDateObj = rules.parseDate(BASE_RACE_GOAL.raceDate);
  var today = rules.dateForSlot(raceDateObj, planMeta.planLengthWeeks, 1, 0);
  // day:1 (Tuesday) lands on slot 2 for this race date -- see slotForFixedDay.
  var workouts = [{ id: 'rw1', activityType: 'cycling', day: 1, durationMinutes: 45, intensity: 'high', fixed: true }];
  var result = rules.generatePlan(BASE_PROFILE, BASE_RACE_GOAL, planMeta, {}, today, [], 'mi', workouts);
  assert.equal(result.weeks[0].days[2].recurringWorkout.id, 'rw1');
});

// ── Quality-slot conflict "smart" handling (product decision, 2026-07-31) ──

test('a HARD fixed workout landing on the quality slot substitutes for it -- no relocation, quality is simply not duplicated', function () {
  var planMeta = buildPlanMeta(BASE_PROFILE, BASE_RACE_GOAL);
  // day:0 (Monday) lands on slot 1 (the quality slot) for this Saturday race.
  var workouts = [{ id: 'hiit1', activityType: 'hiit', day: 0, durationMinutes: 30, intensity: 'high', fixed: true }];
  var weeks = rules.buildStructuredWeeks(BASE_PROFILE, BASE_RACE_GOAL, planMeta, 'mi', workouts);
  var types = weeks[0].days.map(function (d) { return d.type; });
  assert.equal(types.indexOf('quality'), -1, 'no separate quality session should exist -- the hard fixed workout covers that role');
  assert.equal(weeks[0].days[1].recurringWorkout.id, 'hiit1', 'the hard workout still lands on its real weekday');
});

test('a non-hard (easy) fixed workout landing on the quality slot gets relocated to a different day, not silently dropped', function () {
  var planMeta = buildPlanMeta(BASE_PROFILE, BASE_RACE_GOAL);
  // day:0 (Monday) lands on slot 1 (the quality slot); low intensity -> not hard.
  var workouts = [{ id: 'rw1', activityType: 'cycling', day: 0, durationMinutes: 30, intensity: 'low', fixed: true }];
  var weeks = rules.buildStructuredWeeks(BASE_PROFILE, BASE_RACE_GOAL, planMeta, 'mi', workouts);
  var types = weeks[0].days.map(function (d) { return d.type; });
  assert.notEqual(types.indexOf('quality'), -1, 'quality must still exist somewhere this week, just not on the conflicting day');
  assert.notEqual(types.indexOf('quality'), 1, 'quality must have moved off slot 1, where the fixed workout now sits');
  assert.equal(weeks[0].days[1].recurringWorkout.id, 'rw1', 'the fixed workout still lands on its real weekday');
});

test('when a week has no spare easy slot to relocate quality to (very low run-day count), evaluateRecurringWorkoutSchedule warns instead of silently dropping speed work', function () {
  var lowFreqProfile = { weeklyMileage: 8, longestRun: 3, runDaysPerWeek: 1, experienceLevel: 'beginner', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 2, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '5k', goal: 'finish', startDate: '2026-08-01', raceDate: '2026-10-24' };
  var level = rules.classifyUser(lowFreqProfile);
  var targetRunDays = rules.targetRunDaysFor(lowFreqProfile, raceGoal.event, level);
  var workouts = [{ id: 'rw1', activityType: 'walking', day: 0, durationMinutes: 20, intensity: 'low', fixed: true }];
  var result = rules.evaluateRecurringWorkoutSchedule(workouts, targetRunDays, raceGoal.raceDate);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /speed-work day/);
});

test('no quality-conflict warning when the conflicting workout is hard (it substitutes fine, no relocation needed)', function () {
  var level = rules.classifyUser({ weeklyMileage: 8, longestRun: 3, runDaysPerWeek: 1, experienceLevel: 'beginner', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 2, terrains: ['road'], crossOptions: ['Bike'] });
  var targetRunDays = rules.targetRunDaysFor({ weeklyMileage: 8, longestRun: 3, runDaysPerWeek: 1, experienceLevel: 'beginner', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 2, terrains: ['road'], crossOptions: ['Bike'] }, '5k', level);
  var workouts = [{ id: 'rw1', activityType: 'hiit', day: 0, durationMinutes: 20, intensity: 'high', fixed: true }];
  var result = rules.evaluateRecurringWorkoutSchedule(workouts, targetRunDays, '2026-10-24');
  assert.deepEqual(result.warnings, []);
});

// ── Plan explanations (generateRecurringWorkoutNotes) ─────────────────────

test('a movable workout gets a positive cross-training note', function () {
  var notes = rules.generateRecurringWorkoutNotes([{ id: 'rw1', activityType: 'yoga', day: null, durationMinutes: 60, intensity: 'low', fixed: false }], '2026-10-24');
  assert.equal(notes.length, 1);
  assert.match(notes[0], /counts as this week's cross-training/);
});

test('a fixed strength workout gets a "fulfills strength session" note', function () {
  // day:2 (Wednesday) -> slot 3 for the Saturday race, not the quality/long-run slot.
  var notes = rules.generateRecurringWorkoutNotes([{ id: 'rw1', activityType: 'strength', day: 2, durationMinutes: 40, intensity: 'moderate', fixed: true }], '2026-10-24');
  assert.equal(notes.length, 1);
  assert.match(notes[0], /fulfills this week's main strength session/);
});

test('a fixed mobility (yoga) workout gets a "supports mobility and recovery" note', function () {
  var notes = rules.generateRecurringWorkoutNotes([{ id: 'rw1', activityType: 'yoga', day: 2, durationMinutes: 60, intensity: 'low', fixed: true }], '2026-10-24');
  assert.equal(notes.length, 1);
  assert.match(notes[0], /supports mobility and recovery/);
});

test('a fixed hard workout on the quality slot gets the "covers this week\'s hard session" note', function () {
  var notes = rules.generateRecurringWorkoutNotes([{ id: 'rw1', activityType: 'hiit', day: 0, durationMinutes: 30, intensity: 'high', fixed: true }], '2026-10-24');
  assert.equal(notes.length, 1);
  assert.match(notes[0], /covers this week's hard session/);
});

test('a fixed easy workout on the quality slot gets the "scheduled on a different day" relocation note', function () {
  var notes = rules.generateRecurringWorkoutNotes([{ id: 'rw1', activityType: 'cycling', day: 0, durationMinutes: 30, intensity: 'low', fixed: true }], '2026-10-24');
  assert.equal(notes.length, 1);
  assert.match(notes[0], /scheduled on a different day this week/);
});

test('a fixed workout on the long-run day gets no positive note (that case is already a warning, not a note)', function () {
  var notes = rules.generateRecurringWorkoutNotes([{ id: 'rw1', activityType: 'cycling', day: 5, durationMinutes: 30, intensity: 'low', fixed: true }], '2026-10-24');
  assert.deepEqual(notes, []);
});

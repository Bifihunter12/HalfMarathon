// Tests for applyDayAdjustments/applyShortenAdjustment/applyMoveAdjustment
// (docs/COACHING_SPEC.md "Today screen actions") -- the runner's own
// explicit Shorten/Postpone/Reschedule decisions, applied as the final step
// of the generatePlan pipeline. Skip itself has no pipeline function (it's
// a plain completionType on the existing log entry, see app.js skipWorkout)
// so it isn't covered here.
//
// Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rules = require(path.join(__dirname, '..', 'coaching-rules.js'));

function profile(overrides) {
  return Object.assign({
    weeklyMileage: 15, longestRun: 6, runDaysPerWeek: 4, experienceLevel: 'novice',
    injuryStatus: 'resolved', canRunContinuously: true, availableDays: 4,
    terrains: ['road'], crossOptions: ['Bike']
  }, overrides || {});
}
function raceGoal() { return { event: 'half', goal: 'finish', startDate: '2026-08-02', raceDate: '2026-10-18' }; }
function planMetaFor(p, rg, weeksAvailable) {
  var level = rules.classifyUser(p);
  var safety = rules.evaluateSafety(rg.event, weeksAvailable, level);
  var planLengthWeeks = rules.choosePlanLength(weeksAvailable, rg.event, level);
  return { level: level, weeksAvailable: weeksAvailable, planLengthWeeks: planLengthWeeks, unsafe: safety.unsafe, neededWeeks: 0, warnings: safety.warnings };
}
function generate(p, rg, pm, dayAdjustments, recurringWorkouts) {
  return rules.generatePlan(p, rg, pm, {}, rules.parseDate(rg.startDate), [], 'mi', recurringWorkouts || [], [], {}, dayAdjustments);
}

test('shorten: an easy day reduces miles by the given factor and flags itself shortened', function () {
  var p = profile(), rg = raceGoal(), pm = planMetaFor(p, rg, 11);
  var base = generate(p, rg, pm, {});
  var easyIdx = base.weeks[0].days.findIndex(function (d) { return d.type === 'easy'; });
  assert.ok(easyIdx !== -1, 'benchmark week 1 should have an easy day to test against');
  var baseMiles = base.weeks[0].days[easyIdx].miles;
  var result = generate(p, rg, pm, { ['1-' + easyIdx]: { action: 'shortened', factor: 0.7 } });
  var day = result.weeks[0].days[easyIdx];
  assert.equal(day.type, 'easy');
  assert.ok(day.miles < baseMiles, 'shortened miles must be less than the original');
  assert.match(day.label, /\(shortened\)$/);
  assert.equal(day.adjustedByUser, true);
});

test('shorten: keeps day.sessions[] in sync with the new label/distance (no stale primary session)', function () {
  var p = profile(), rg = raceGoal(), pm = planMetaFor(p, rg, 11);
  var base = generate(p, rg, pm, {});
  var easyIdx = base.weeks[0].days.findIndex(function (d) { return d.type === 'easy'; });
  var result = generate(p, rg, pm, { ['1-' + easyIdx]: { action: 'shortened', factor: 0.7 } });
  var day = result.weeks[0].days[easyIdx];
  var primary = day.sessions.filter(function (s) { return s.role === 'primary'; })[0];
  assert.equal(primary.label, day.label, 'the primary session label must match the day label exactly, not a stale pre-shorten value');
  assert.equal(primary.distanceMiles, day.miles);
});

test('shorten: a quality day keeps its structured prescription and adds a clear reduce-by-percentage instruction instead of guessing new intervals', function () {
  var p = profile(), rg = raceGoal(), pm = planMetaFor(p, rg, 11);
  var base = generate(p, rg, pm, {});
  var qualityIdx = base.weeks[0].days.findIndex(function (d) { return d.type === 'quality'; });
  var originalLabel = base.weeks[0].days[qualityIdx].label;
  var result = generate(p, rg, pm, { ['1-' + qualityIdx]: { action: 'shortened', factor: 0.7 } });
  var day = result.weeks[0].days[qualityIdx];
  assert.ok(day.label.indexOf(originalLabel) === 0, 'the original prescription text must still be present, not replaced');
  assert.match(day.label, /shortened: cut the reps\/intervals by about 30%, same pace\/effort/);
});

test('shorten: a cross (recurring-workout) day reduces its stated duration and updates the primary session in place', function () {
  var p = profile(), rg = raceGoal(), pm = planMetaFor(p, rg, 11);
  var recurringWorkouts = [{ id: 'spin', activityType: 'cycling', day: 0, durationMinutes: 45, intensity: 'moderate', fixed: true, timeWindow: 'midday' }];
  // Monday (day 0) has no running day in this legacy (no weeklyAvailability)
  // profile at low frequency, so the fixed spin overrides it outright --
  // exactly the kind of plain cross day this branch targets.
  var base = generate(p, rg, pm, {}, recurringWorkouts);
  assert.equal(base.weeks[0].days[0].type, 'cross');
  var result = generate(p, rg, pm, { '1-0': { action: 'shortened', factor: 0.5 } }, recurringWorkouts);
  var day = result.weeks[0].days[0];
  assert.match(day.label, /\(shortened\)$/);
  var primary = day.sessions.filter(function (s) { return s.role === 'primary'; })[0];
  assert.equal(primary.durationMinutes, Math.round(45 * 0.5));
});

test('shorten: race day is never touched', function () {
  var p = profile(), rg = raceGoal(), pm = planMetaFor(p, rg, 11);
  var raceWeekIdx = pm.planLengthWeeks - 1;
  var result = generate(p, rg, pm, { [(raceWeekIdx + 1) + '-6']: { action: 'shortened', factor: 0.5 } });
  var day = result.weeks[raceWeekIdx].days[6];
  assert.equal(day.type, 'race');
  assert.equal(day.adjustedByUser, undefined);
});

// Matches tests/constraint-scheduling.test.js's own benchmarkProfile() --
// novice-level + this weeklyAvailability shape leaves Monday deprioritized
// behind Wed/Fri (see that file's comments); intermediate + a 5-day target
// is the combination that actually keeps Monday a real running day
// alongside its same-day fixed spin class.
test('move: relocates a real running day\'s content to the target day, using the clean pre-suffix label', function () {
  var p = profile({ experienceLevel: 'intermediate', weeklyMileage: 20, availableDays: 5, weeklyAvailability: {
    0: { canRun: true, window: 'morning' }, 1: { canRun: false }, 2: { canRun: true, window: 'morning' },
    3: { canRun: false }, 4: { canRun: true, window: 'morning' }, 5: { canRun: true, window: 'morning' }, 6: { canRun: true, window: 'morning' }
  } });
  var rg = raceGoal(), pm = planMetaFor(p, rg, 11);
  var recurringWorkouts = [{ id: 'spin', activityType: 'cycling', day: 0, durationMinutes: 45, intensity: 'moderate', fixed: true, timeWindow: 'midday' }];
  var base = generate(p, rg, pm, {}, recurringWorkouts);
  assert.equal(base.weeks[0].days[0].type, 'easy', 'Monday should be a real easy run coexisting with the spin class');
  assert.match(base.weeks[0].days[0].label, /Spinning/);

  var result = generate(p, rg, pm, { '1-0': { action: 'moved', targetKey: '1-3' } }, recurringWorkouts); // Mon -> Thu (a plain rest day)
  var target = result.weeks[0].days[3];
  assert.equal(target.type, 'easy');
  assert.match(target.label, /\(moved\)$/);
  assert.doesNotMatch(target.label, /Spinning/, 'the moved label must not carry the source day\'s secondary-session suffix');
});

test('move: the source day becomes rest, and its own secondary session (the spin class) stays behind, not moved', function () {
  var p = profile({ experienceLevel: 'intermediate', weeklyMileage: 20, availableDays: 5, weeklyAvailability: {
    0: { canRun: true, window: 'morning' }, 1: { canRun: false }, 2: { canRun: true, window: 'morning' },
    3: { canRun: false }, 4: { canRun: true, window: 'morning' }, 5: { canRun: true, window: 'morning' }, 6: { canRun: true, window: 'morning' }
  } });
  var rg = raceGoal(), pm = planMetaFor(p, rg, 11);
  var recurringWorkouts = [{ id: 'spin', activityType: 'cycling', day: 0, durationMinutes: 45, intensity: 'moderate', fixed: true, timeWindow: 'midday' }];
  var result = generate(p, rg, pm, { '1-0': { action: 'moved', targetKey: '1-3' } }, recurringWorkouts);
  var source = result.weeks[0].days[0];
  assert.equal(source.type, 'rest');
  assert.match(source.label, /^Moved to /);
  var secondary = source.sessions.filter(function (s) { return s.role === 'secondary'; })[0];
  assert.ok(secondary, 'the spin class session must still be present on the source day');
  assert.match(secondary.label, /Spinning/);
});

test('move: is a no-op for a cross (recurring-workout) day -- out of scope this pass, source/target stay untouched', function () {
  var p = profile();
  var rg = raceGoal(), pm = planMetaFor(p, rg, 11);
  var recurringWorkouts = [{ id: 'spin', activityType: 'cycling', day: 0, durationMinutes: 45, intensity: 'moderate', fixed: true, timeWindow: 'midday' }];
  var base = generate(p, rg, pm, {}, recurringWorkouts);
  assert.equal(base.weeks[0].days[0].type, 'cross');
  var result = generate(p, rg, pm, { '1-0': { action: 'moved', targetKey: '1-3' } }, recurringWorkouts);
  assert.equal(result.weeks[0].days[0].type, 'cross', 'a cross day must not be moveable this pass');
  assert.equal(result.weeks[0].days[0].label, base.weeks[0].days[0].label);
});

test('move: race day can never be a source or a target', function () {
  var p = profile(), rg = raceGoal(), pm = planMetaFor(p, rg, 11);
  var raceWeekIdx = pm.planLengthWeeks - 1;
  var raceKey = (raceWeekIdx + 1) + '-6';
  // Try moving something ONTO race day.
  var easyIdx = generate(p, rg, pm, {}).weeks[0].days.findIndex(function (d) { return d.type === 'easy'; });
  var result = generate(p, rg, pm, { ['1-' + easyIdx]: { action: 'moved', targetKey: raceKey } });
  assert.equal(result.weeks[raceWeekIdx].days[6].type, 'race', 'race day must never be overwritten by an incoming move');
  assert.equal(result.weeks[0].days[easyIdx].type, 'easy', 'and the attempted source is left alone since the move was rejected');
});

test('deterministic: identical dayAdjustments input produces byte-identical generated plans', function () {
  var p = profile(), rg = raceGoal(), pm = planMetaFor(p, rg, 11);
  var adj = { '1-3': { action: 'shortened', factor: 0.7 } };
  var a = JSON.stringify(generate(p, rg, pm, adj));
  var b = JSON.stringify(generate(p, rg, pm, adj));
  assert.equal(a, b);
});

test('backward compatibility: omitting dayAdjustments entirely produces the exact same plan as an empty object', function () {
  var p = profile(), rg = raceGoal(), pm = planMetaFor(p, rg, 11);
  var withEmpty = JSON.stringify(generate(p, rg, pm, {}));
  var withUndefined = JSON.stringify(rules.generatePlan(p, rg, pm, {}, rules.parseDate(rg.startDate), [], 'mi', [], [], {}));
  assert.equal(withEmpty, withUndefined);
});

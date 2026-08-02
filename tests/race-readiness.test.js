// Race readiness (docs/COACHING_SPEC.md). evaluateSafety alone only checks
// calendar length against EVENT_TABLE.minWeeks -- it never reads the
// runner's own current fitness, so a true beginner and an already-fit
// runner pass the identical check. evaluateReadiness adds a genuine
// minimum-readiness check based on the runner's own longest run, using the
// standard "10% rule" real-world progression heuristic. Deliberately
// advisory only -- never blocks generation, per this pass's "warn, don't
// gate" decision.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rules = require(path.join(__dirname, '..', 'coaching-rules.js'));

var BASE_PROFILE = { weeklyMileage: 10, longestRun: 3, runDaysPerWeek: 3, experienceLevel: 'beginner', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 4, terrains: ['road'], crossOptions: ['Bike'] };

test('weeksToGrowDistance: already at or past the target needs zero weeks', function () {
  assert.equal(rules.weeksToGrowDistance(9, 9, 0.1), 0);
  assert.equal(rules.weeksToGrowDistance(10, 9, 0.1), 0);
});

test('weeksToGrowDistance: a true zero starting point does not divide by zero or return Infinity', function () {
  var weeks = rules.weeksToGrowDistance(0, 9, 0.1);
  assert.ok(Number.isFinite(weeks) && weeks > 0);
});

test('weeksToGrowDistance matches a hand-computed value for a real case', function () {
  // ceil(ln(3/2) / ln(1.1)) = ceil(0.405 / 0.0953) = ceil(4.26) = 5
  assert.equal(rules.weeksToGrowDistance(2, 3, 0.1), 5);
});

test('a runner already at or beyond the event\'s long-run peak is ready given only the calendar minimum', function () {
  var profile = { weeklyMileage: 25, longestRun: 8, runDaysPerWeek: 4, experienceLevel: 'intermediate', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 5, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: 'half', goal: 'finish' };
  var level = rules.classifyUser(profile);
  var result = rules.evaluateReadiness(profile, raceGoal, level, 12);
  assert.equal(result.ready, true);
  assert.equal(result.alternatives, null);
});

test('a true beginner (1 mi longest run) is not ready for a half marathon in 6 weeks', function () {
  var profile = Object.assign({}, BASE_PROFILE, { longestRun: 1 });
  var raceGoal = { event: 'half', goal: 'finish' };
  var level = rules.classifyUser(profile);
  var result = rules.evaluateReadiness(profile, raceGoal, level, 6);
  assert.equal(result.ready, false);
  assert.ok(result.neededWeeks > 6);
  assert.ok(result.alternatives.extraWeeksNeeded > 0);
});

test('when no shorter event fits either (extremely short timeline), shorterEvent is null rather than a false suggestion', function () {
  var profile = Object.assign({}, BASE_PROFILE, { longestRun: 1 });
  var raceGoal = { event: 'half', goal: 'finish' };
  var level = rules.classifyUser(profile);
  var result = rules.evaluateReadiness(profile, raceGoal, level, 6);
  assert.equal(result.alternatives.shorterEvent, null);
});

test('when a shorter event genuinely fits the timeline, it is suggested', function () {
  var profile = Object.assign({}, BASE_PROFILE, { longestRun: 1 });
  var raceGoal = { event: 'half', goal: 'finish' };
  var level = rules.classifyUser(profile);
  var result = rules.evaluateReadiness(profile, raceGoal, level, 18);
  assert.equal(result.alternatives.shorterEvent, '10k');
});

test('a true beginner IS ready for a 5K given a realistic (couch-to-5k-scale) timeline', function () {
  var profile = Object.assign({}, BASE_PROFILE, { longestRun: 2 });
  var raceGoal = { event: '5k', goal: 'finish' };
  var level = rules.classifyUser(profile);
  var result = rules.evaluateReadiness(profile, raceGoal, level, 8);
  assert.equal(result.ready, true);
});

test('formatReadinessWarning returns null when ready, and never claims a shorter event exists when none was found', function () {
  var readyResult = { ready: true, neededWeeks: 8, alternatives: null };
  assert.equal(rules.formatReadinessWarning(readyResult, '5k'), null);

  var notReadyNoAlt = { ready: false, neededWeeks: 26, alternatives: { extraWeeksNeeded: 20, shorterEvent: null } };
  var text = rules.formatReadinessWarning(notReadyNoAlt, 'half');
  assert.match(text, /26 weeks/);
  assert.doesNotMatch(text, /would comfortably fit/);
  assert.match(text, /still generates as requested/);
});

test('formatReadinessWarning mentions the suggested shorter event when one exists', function () {
  var notReadyWithAlt = { ready: false, neededWeeks: 26, alternatives: { extraWeeksNeeded: 8, shorterEvent: '10k' } };
  var text = rules.formatReadinessWarning(notReadyWithAlt, 'half');
  assert.match(text, /10K would comfortably fit/);
});

test('evaluateReadiness never returns a neededWeeks below the event\'s own calendar minWeeks, even for an already-fit runner', function () {
  var profile = { weeklyMileage: 30, longestRun: 12, runDaysPerWeek: 5, experienceLevel: 'advanced', injuryStatus: 'resolved', canRunContinuously: true, availableDays: 6, terrains: ['road'], crossOptions: ['Bike'] };
  var raceGoal = { event: '10k', goal: 'finish' };
  var level = rules.classifyUser(profile);
  var result = rules.evaluateReadiness(profile, raceGoal, level, 20);
  assert.ok(result.neededWeeks >= rules.EVENT_TABLE['10k'][level].minWeeks);
});

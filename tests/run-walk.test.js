// Run/walk beginner progression tests (docs/COACHING_SPEC.md "Run-walk
// programming"). Covers coaching-rules.js's run-walk stage-selection and
// session-building logic -- the genuinely new piece of the beginner engine.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rules = require(path.join(__dirname, '..', 'coaching-rules.js'));

test('runWalkWeeksFor floors at 4 weeks even for a very short plan', function () {
  assert.equal(rules.runWalkWeeksFor(4), 4);
  assert.equal(rules.runWalkWeeksFor(6), 4); // ceil(6*0.6)=4, still hits the floor exactly
});

test('runWalkWeeksFor spends roughly 60% of a longer plan progressing', function () {
  assert.equal(rules.runWalkWeeksFor(10), 6); // ceil(10*0.6)=6
  assert.equal(rules.runWalkWeeksFor(20), 12); // ceil(20*0.6)=12
});

test('runWalkStageForWeek maps week 1 to the first stage', function () {
  var stage = rules.runWalkStageForWeek(1, 12);
  assert.equal(stage, rules.RUN_WALK_STAGES[0]);
});

test('runWalkStageForWeek clamps to the last stage once past the run-walk window', function () {
  var stage = rules.runWalkStageForWeek(50, 12); // week far beyond the 12-week run-walk window
  assert.equal(stage, rules.RUN_WALK_STAGES[rules.RUN_WALK_STAGES.length - 1]);
});

test('runWalkStageForWeek advances monotonically as weeks progress within the window', function () {
  var runWalkWeeks = 14;
  var lastIdx = -1;
  for (var w = 1; w <= runWalkWeeks; w++) {
    var stage = rules.runWalkStageForWeek(w, runWalkWeeks);
    var idx = rules.RUN_WALK_STAGES.indexOf(stage);
    assert.ok(idx >= lastIdx, 'the stage index must never go backwards as weeks increase');
    lastIdx = idx;
  }
});

test('the interval-building stages (before the final graduation stage) increase in total session time', function () {
  // Stage 7 (the graduation/near-continuous stage) is deliberately shorter than the
  // peak interval stage -- a beginner's first continuous-ish effort is realistically
  // shorter than their longest interval session, not longer. Monotonicity is only
  // asserted across the interval-building stages, not through graduation.
  var buildingStages = rules.RUN_WALK_STAGES.slice(0, -1);
  for (var i = 1; i < buildingStages.length; i++) {
    assert.ok(buildingStages[i].totalMin > buildingStages[i - 1].totalMin, 'stage ' + i + ' should take longer than stage ' + (i - 1));
  }
});

test('buildRunWalkSession keeps the same run:walk ratio for the easy/quality slots as the base stage', function () {
  var stage = rules.RUN_WALK_STAGES[2];
  var session = rules.buildRunWalkSession(stage, false);
  assert.equal(session.runSec, stage.runSec);
  assert.equal(session.walkSec, stage.walkSec);
  assert.equal(session.cycles, stage.cycles);
});

test('buildRunWalkSession gives the long-day slot more cycles (more total time) than the base stage, never a different ratio', function () {
  var stage = rules.RUN_WALK_STAGES[2];
  var base = rules.buildRunWalkSession(stage, false);
  var long = rules.buildRunWalkSession(stage, true);
  assert.equal(long.runSec, stage.runSec, 'the run/walk ratio itself never changes for the long variant');
  assert.equal(long.walkSec, stage.walkSec);
  assert.ok(long.cycles > base.cycles, 'the long variant must have more cycles than the base session');
  assert.ok(long.totalMin > base.totalMin, 'more cycles means more total time');
});

test('buildRunWalkSession never produces zero extra cycles even on the smallest (single-cycle) stage', function () {
  var lastStage = rules.RUN_WALK_STAGES[rules.RUN_WALK_STAGES.length - 1]; // cycles: 1
  var long = rules.buildRunWalkSession(lastStage, true);
  assert.ok(long.cycles > lastStage.cycles, 'even a 1-cycle stage must get at least one extra cycle for the long slot');
});

test('formatRunWalkLabel produces a clear, time-based label with no distance/pace units', function () {
  var label = rules.formatRunWalkLabel({ runSec: 180, walkSec: 90, cycles: 7, totalMin: 32 });
  assert.equal(label, 'Run 3 min / walk 1:30 min ×7 (32 min)');
});

test('formatRunWalkLabel formats whole-minute seconds without a colon', function () {
  var label = rules.formatRunWalkLabel({ runSec: 60, walkSec: 120, cycles: 8, totalMin: 24 });
  assert.equal(label, 'Run 1 min / walk 2 min ×8 (24 min)');
});

// Decision-scenario library (docs/COACHING_SPEC.md "Adaptation rules").
// Each test below documents one disrupted-training-week scenario against
// coaching-rules.js's REAL applyMissedAdjustment/applyDifficultyAdjustment --
// not a reimplementation -- following the master prompt's own schema:
// Context / Approved outcome / Forbidden outcomes / Status. This is the
// project's defensible coaching asset per that prompt's own framing ("the
// decision library -- not the marketing copy -- is the defensible coaching
// asset"), not just incidental unit coverage.
//
// Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rules = require(path.join(__dirname, '..', 'coaching-rules.js'));

// Fixed race date/plan length shared by every scenario -- the exact date
// doesn't matter, only the relative week math does. "Today" is always the
// Monday of week 3, so week 3 is "current," week 2 is "last week" (the one
// whose completion decides this week's adjustment), and weeks 4-6 are future.
const RACE_DATE = rules.parseDate('2026-12-06');
const PLAN_LENGTH = 6;
const TODAY = rules.dateForSlot(RACE_DATE, PLAN_LENGTH, 3, 0);
const RACE_GOAL = { raceDate: '2026-12-06' };
const PLAN_META = { planLengthWeeks: PLAN_LENGTH };
const UNITS = 'mi';

function day(type, miles) { return { type: type, miles: miles, label: type + ' ' + miles }; }

// A realistic week: easy, quality, easy, rest, cross, easy, long (7 slots).
function standardWeek(weekNum, phase) {
  return {
    weekNum: weekNum, phase: phase, targetVolume: 0,
    days: [day('easy', 4), day('quality', 0), day('easy', 4), day('rest', 0), day('cross', 0), day('easy', 4), day('long', 6)]
  };
}

function sixWeekPlan() {
  return [
    standardWeek(1, 'base'), standardWeek(2, 'base'), standardWeek(3, 'build'),
    standardWeek(4, 'build'), standardWeek(5, 'peak'), Object.assign(standardWeek(6, 'race'), { days: standardWeek(6, 'race').days.map(function (d, i) { return i === 6 ? day('race', 0) : d; }) })
  ];
}

test('Context: only one easy run missed last week, everything else logged. Approved outcome: preserve the whole plan, no adjustment at all.', function () {
  var weeks = sixWeekPlan();
  var logs = { '2-0': null, '2-1': { effort: 4 }, '2-2': { effort: 4 }, '2-5': { effort: 4 }, '2-6': { effort: 4 } }; // slot 0 (easy) missed; quality/easy/easy/long logged; rest (slot 3) and cross (slot 4) don't need logs to count as "handled" for this scenario
  logs['2-4'] = { effort: 3 }; // log the cross day too, so only the one easy run (slot 0) is actually missed
  var result = rules.applyMissedAdjustment(weeks, RACE_GOAL, PLAN_META, logs, TODAY, null, UNITS);
  assert.equal(result.note, null, 'a single missed easy run, with everything else logged, must not trigger any adjustment note');
  assert.equal(weeks[2].days[6].miles, 6, 'this week\'s long run stays exactly as planned');
  assert.equal(weeks[3].days[6].miles, 6, 'future weeks stay exactly as planned');
});

test('Context: only one quality session missed last week (the master prompt\'s own worked example). Approved outcome: preserve Thursday\'s quality slot and Saturday\'s long run.', function () {
  var weeks = sixWeekPlan();
  var logs = { '2-0': { effort: 4 }, '2-2': { effort: 4 }, '2-4': { effort: 3 }, '2-5': { effort: 4 }, '2-6': { effort: 4 } }; // slot 1 (quality) missed, everything else logged
  var result = rules.applyMissedAdjustment(weeks, RACE_GOAL, PLAN_META, logs, TODAY, null, UNITS);
  assert.equal(result.note, null, 'one missed quality session with a low overall ratio must not trigger any adjustment');
  assert.equal(weeks[2].days[6].miles, 6, 'the long run is untouched');
});

test('Context: only the long run itself was missed last week; everything else logged. Approved outcome: shorten (not remove) just this week\'s long run; forbidden: touching any other day.', function () {
  var weeks = sixWeekPlan();
  var logs = { '2-0': { effort: 4 }, '2-1': { effort: 4 }, '2-2': { effort: 4 }, '2-4': { effort: 3 }, '2-5': { effort: 4 } }; // slot 6 (long) missed, everything else logged
  var result = rules.applyMissedAdjustment(weeks, RACE_GOAL, PLAN_META, logs, TODAY, null, UNITS);
  assert.match(result.note, /long run was shortened/);
  assert.equal(weeks[2].days[6].miles, 5, 'this week\'s long run shortens ~20% (6mi -> 5mi), it is not skipped/removed');
  assert.equal(weeks[2].days[0].miles, 4, 'forbidden outcome check: the easy run days are untouched');
  assert.equal(weeks[2].days[1].label, 'quality 0', 'forbidden outcome check: the quality day is untouched');
});

test('Context: most of last week was missed (>60%). Approved outcome: future volume dampens ~15% to rebuild gradually; forbidden outcomes: no day\'s mileage ever increases, the current in-progress week is left alone, race week is never touched.', function () {
  var weeks = sixWeekPlan();
  var logs = { '2-6': { effort: 4 } }; // only the long run logged; everything else (3 easy + 1 quality + 1 cross) missed -> missedRatio = 1 - 1/6 = 0.833
  var result = rules.applyMissedAdjustment(weeks, RACE_GOAL, PLAN_META, logs, TODAY, null, UNITS);
  assert.match(result.note, /reduced about 15%/);
  // Forbidden: current week (week 3, index 2) is untouched by the ratio-dampening branch (only future weeks 4-6 are).
  assert.equal(weeks[2].days[0].miles, 4, 'forbidden outcome: the current in-progress week is never retroactively dampened');
  // Future weeks dampen, never increase.
  assert.equal(weeks[3].days[0].miles, 3.5, 'week 4\'s easy run dampens ~15% (4mi -> 3.5mi after round5)');
  assert.equal(weeks[3].days[6].miles, 5, 'week 4\'s long run dampens the same way (6mi -> 5mi after round5)');
  assert.ok(weeks[3].days[0].miles <= 4 && weeks[3].days[6].miles <= 6, 'forbidden outcome: no day\'s mileage ever increases');
  // Forbidden: race week (week 6) is never touched.
  assert.equal(weeks[5].days[0].miles, 4, 'forbidden outcome: race week is never dampened');
});

test('Partial-session credit: stopped-early/partial entries count as HALF credit, not full credit -- can flip the missed-ratio threshold versus the old bare-truthiness check', function () {
  var weeks = sixWeekPlan();
  // 5 loggable slots (0,1,2,5,6). Only slots 0/1 have entries at all, both
  // stopped_early. Under the OLD bare-truthiness check, 2 logged entries
  // out of 5 gives missedRatio = 1 - 2/5 = 0.6 -- NOT > 0.6, so the old code
  // would never dampen here. With half credit for stopped_early, the real
  // credited total is 1.0 (0.5 + 0.5), giving missedRatio = 1 - 1/5 = 0.8,
  // correctly crossing the 0.6 threshold -- two stopped-early sessions
  // shouldn't count the same as two fully completed ones.
  var logs = {
    '2-0': { effort: 4, completionType: 'stopped_early' },
    '2-1': { effort: 4, completionType: 'partial' }
  };
  var result = rules.applyMissedAdjustment(weeks, RACE_GOAL, PLAN_META, logs, TODAY, null, UNITS);
  assert.match(result.note, /reduced about 15%/, 'partial credit correctly reveals a real >60% miss the old bare-truthiness check would have hidden');
});

test('Partial-session credit: a stopped-early long run (something WAS logged) still triggers the same "shorten next long run" treatment as a fully missed one', function () {
  var weeks = sixWeekPlan();
  var logs = {
    '2-0': { effort: 4 }, '2-1': { effort: 4 }, '2-2': { effort: 4 }, '2-5': { effort: 4 },
    '2-6': { effort: 6, completionType: 'stopped_early', distance: 2 } // the long run itself was logged, but stopped early
  };
  var result = rules.applyMissedAdjustment(weeks, RACE_GOAL, PLAN_META, logs, TODAY, null, UNITS);
  assert.match(result.note, /long run was shortened/, 'a stopped-early long run must not be silently treated as a full completion just because something was logged');
  assert.equal(weeks[2].days[6].miles, 5, 'this week\'s long run shortens ~20% (6mi -> 5mi), same treatment as a fully missed long run');
});

test('Context: last week had several illness/away days already converted to rest (simulating applyUnavailableRanges). Approved outcome (docs/SAFETY_POLICY.md): illness time never counts against the runner, even when only a few loggable days remained.', function () {
  var weeks = sixWeekPlan();
  weeks[1].days[0] = day('rest', 0); // illness-converted easy day
  weeks[1].days[2] = day('rest', 0); // illness-converted easy day
  weeks[1].days[4] = day('rest', 0); // illness-converted cross day
  // Only quality/easy(slot5)/long remain loggable -- log all 3.
  var logs = { '2-1': { effort: 4 }, '2-5': { effort: 4 }, '2-6': { effort: 4 } };
  var result = rules.applyMissedAdjustment(weeks, RACE_GOAL, PLAN_META, logs, TODAY, null, UNITS);
  assert.equal(result.note, null, 'illness-converted rest days must never inflate the missed-workout ratio');
});

test('Context: easy/long RPE has averaged >=7 across the last two weeks. Approved outcome: future easy/long volume eases back ~10%; forbidden: quality/cross/rest days are never touched by this adjustment.', function () {
  var weeks = sixWeekPlan();
  var logs = {
    '1-0': { effort: 8 }, '1-2': { effort: 8 }, '1-6': { effort: 7 },
    '2-0': { effort: 8 }, '2-2': { effort: 7 }
  };
  var note = rules.applyDifficultyAdjustment(weeks, RACE_GOAL, PLAN_META, logs, TODAY, null, UNITS);
  assert.match(note, /eased back about 10%/);
  // The adjustment applies from the week AFTER current onward (weeks[currentWeekIdx] as an
  // array index = weekNum 4, same off-by-one convention as applyMissedAdjustment's dampening branch).
  assert.equal(weeks[3].days[0].miles, 3.5, 'week 4\'s easy runs ease back ~10% (4mi -> 3.5mi after round5)');
  assert.equal(weeks[3].days[6].miles, 5.5, 'week 4\'s long run eases back the same way (6mi -> 5.5mi after round5)');
  assert.equal(weeks[3].days[1].label, 'quality 0', 'forbidden outcome: the quality day is untouched');
  assert.equal(weeks[3].days[4].label, 'cross 0', 'forbidden outcome: the cross day is untouched');
  assert.equal(weeks[2].days[0].miles, 4, 'forbidden outcome: the current in-progress week (week 3) is never retroactively adjusted');
});

test('Context: easy/long RPE has averaged <=2 across the last two weeks (feels too easy). Approved outcome: future easy/long volume nudges up ~5%; forbidden: quality/cross are never touched.', function () {
  var weeks = sixWeekPlan();
  var logs = {
    '1-0': { effort: 1 }, '1-2': { effort: 2 }, '1-6': { effort: 1 },
    '2-0': { effort: 2 }
  };
  var note = rules.applyDifficultyAdjustment(weeks, RACE_GOAL, PLAN_META, logs, TODAY, null, UNITS);
  assert.match(note, /nudged up about 5%/);
  assert.equal(weeks[3].days[0].miles, 4, 'round5(4 * 1.05) rounds back down to 4 -- still a real, if small, nudge up');
  assert.equal(weeks[3].days[6].miles, 6.5, 'week 4\'s long run nudges up ~5% (6mi -> 6.5mi after round5)');
});

test('Context: fewer than 3 logged RPE samples exist in the lookback window. Approved outcome: never guess -- no adjustment at all (insufficient evidence).', function () {
  var weeks = sixWeekPlan();
  var logs = { '1-0': { effort: 8 }, '2-0': { effort: 8 } }; // only 2 samples
  var note = rules.applyDifficultyAdjustment(weeks, RACE_GOAL, PLAN_META, logs, TODAY, null, UNITS);
  assert.equal(note, null, 'fewer than 3 samples must never produce a volume adjustment');
  assert.equal(weeks[2].days[0].miles, 4, 'nothing is touched');
});

test('Adjustment re-capping: a low-RPE nudge never pushes a day past the event\'s own long-run peak, even from an already-at-peak starting point', function () {
  // Neither applyMissedAdjustment nor applyDifficultyAdjustment previously
  // re-checked their result against ANY safety ceiling -- this uses a real
  // event/level (unlike RACE_GOAL/PLAN_META above, which deliberately omit
  // them to test pure week-math) so adjustmentCaps has a real cap to enforce.
  var level = 'intermediate';
  var cfg = rules.EVENT_TABLE['10k'][level];
  var raceGoal = { raceDate: RACE_GOAL.raceDate, event: '10k', goal: 'finish' };
  var planMeta = { planLengthWeeks: PLAN_LENGTH, level: level, unsafe: false };
  var weeks = sixWeekPlan();
  weeks[3].days[6].miles = cfg.longRunPeak; // already at the cap
  var logs = { '1-0': { effort: 1 }, '1-2': { effort: 2 }, '1-6': { effort: 1 }, '2-0': { effort: 2 } }; // triggers the +5% nudge
  var note = rules.applyDifficultyAdjustment(weeks, raceGoal, planMeta, logs, TODAY, null, UNITS);
  assert.match(note, /nudged up about 5%/, 'sanity check: the nudge really did fire');
  assert.ok(weeks[3].days[6].miles <= cfg.longRunPeak, 'the long run must never be pushed past the event\'s own long-run peak cap (' + cfg.longRunPeak + '), got ' + weeks[3].days[6].miles);
});

// ── Formerly a known gap, fixed (docs/COACHING_SPEC.md "Adaptation rules") ──
// Master-prompt worked example: miss ONLY Tuesday's easy run; Thursday's
// quality session and Saturday's long run should stay untouched. The engine
// used to decide off a whole-week aggregate ratio that counted cross-training
// as equally diagnostic as real running work, so enough unlogged cross-
// training days could trip the same 60% threshold and dampen quality/long
// too. Fixed by excluding cross-training from the missed-ratio entirely
// (coaching-rules.js), the same treatment rest/race days already got.
test('Context: only Tuesday\'s easy run and several lower-stakes cross-training days were missed; the quality session and long run were both completed. Approved outcome: preserve the quality session and long run untouched, since the real miss was one easy run plus optional cross-training, not core running work.', function () {
  var weeks = sixWeekPlan();
  weeks[1].days[3] = day('cross', 0); // extra cross-training slot, missed
  weeks[1].days[4] = day('cross', 0); // extra cross-training slot, missed
  // Logged: quality (slot 1) and long (slot 6). Missed: easy(0), the 2 cross slots, easy(2), easy(5) -- 5 of 7 missed.
  var logs = { '2-1': { effort: 4 }, '2-6': { effort: 4 } };
  var result = rules.applyMissedAdjustment(weeks, RACE_GOAL, PLAN_META, logs, TODAY, null, UNITS);
  assert.equal(result.note, null, 'excluding cross-training from the ratio means only 1 of 5 core running slots was missed -- well under the 60% threshold');
  assert.equal(weeks[3].days[1].label, 'quality 0', 'the quality session stays untouched');
  assert.equal(weeks[3].days[6].miles, 6, 'the future long run stays untouched -- fixed: previously failed here, whole-week dampening used to reduce it instead');
});

test('Context: only cross-training days were missed last week; every actual running session (easy/quality/long) was logged. Approved outcome: no adjustment at all, no matter how many cross-training days were skipped.', function () {
  var weeks = sixWeekPlan();
  weeks[1].days[3] = day('cross', 0);
  var logs = { '2-0': { effort: 4 }, '2-1': { effort: 4 }, '2-2': { effort: 4 }, '2-5': { effort: 4 }, '2-6': { effort: 4 } }; // every easy/quality/long slot logged; both cross slots (3 and 4) left unlogged
  var result = rules.applyMissedAdjustment(weeks, RACE_GOAL, PLAN_META, logs, TODAY, null, UNITS);
  assert.equal(result.note, null, 'cross-training misses alone, regardless of count, must never trigger any adjustment');
  assert.equal(weeks[3].days[6].miles, 6, 'nothing changes');
});

test('Context: most of last week\'s core running work was missed -- including both the quality session and the long run, not just cross-training. Approved outcome: future volume still dampens ~15% -- confirms the cross-training exclusion only removes false positives, not real core-running disruption.', function () {
  var weeks = sixWeekPlan();
  var logs = { '2-0': { effort: 4 } }; // only one easy run logged; the other easy, quality(1), and long(6) all missed (4 of 5 core slots missed)
  var result = rules.applyMissedAdjustment(weeks, RACE_GOAL, PLAN_META, logs, TODAY, null, UNITS);
  assert.match(result.note, /reduced about 15%/, 'missing most core running work -- including both quality and the long run -- is a real disruption, cross-training exclusion does not mask it');
  assert.equal(weeks[3].days[0].miles, 3.5, 'week 4\'s easy run dampens ~15% (4mi -> 3.5mi after round5)');
});

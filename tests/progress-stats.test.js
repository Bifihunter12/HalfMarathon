// Progress stats / weight tracking (docs/PROGRESS_SPEC.md). Pure data-shaping
// and calculation functions -- no DOM, no dates-from-strings beyond what's
// passed in, matching this project's other domain-module test files.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const stats = require(path.join(__dirname, '..', 'progress-stats.js'));

// ── computeThisWeekStats ─────────────────────────────────────────────────

test('cross-training and rest days never contribute to weekly running distance or run count', function () {
  var days = [
    { type: 'easy', plannedMiles: 3, loggedMiles: 3 },
    { type: 'cross', plannedMiles: 0, loggedMiles: 40 }, // e.g. minutes mis-logged as distance -- must still be excluded by type
    { type: 'rest', plannedMiles: 0, loggedMiles: null }
  ];
  var result = stats.computeThisWeekStats(days);
  assert.equal(result.completedMiles, 3);
  assert.equal(result.plannedMiles, 3);
  assert.equal(result.runsCompleted, 1);
});

test('race day counts as real running distance', function () {
  var days = [{ type: 'race', plannedMiles: 6.2, loggedMiles: 6.2 }];
  var result = stats.computeThisWeekStats(days);
  assert.equal(result.completedMiles, 6.2);
  assert.equal(result.runsCompleted, 1);
});

test('an unlogged run day contributes to planned distance but not completed distance or run count', function () {
  var days = [{ type: 'long', plannedMiles: 8, loggedMiles: null }];
  var result = stats.computeThisWeekStats(days);
  assert.equal(result.plannedMiles, 8);
  assert.equal(result.completedMiles, 0);
  assert.equal(result.runsCompleted, 0);
});

test('a planned distance of 0 (e.g. a cross/rest-heavy week) never fabricates a nonzero total', function () {
  var result = stats.computeThisWeekStats([{ type: 'cross', plannedMiles: 0, loggedMiles: null }]);
  assert.equal(result.plannedMiles, 0);
  assert.equal(result.completedMiles, 0);
});

// ── computeMonthlyTotals ─────────────────────────────────────────────────

test('monthly totals group by calendar month and exclude cross-training', function () {
  var records = [
    { dateIso: '2026-07-05', type: 'easy', loggedMiles: 3 },
    { dateIso: '2026-07-12', type: 'long', loggedMiles: 8 },
    { dateIso: '2026-07-20', type: 'cross', loggedMiles: 40 },
    { dateIso: '2026-08-02', type: 'easy', loggedMiles: 4 }
  ];
  var totals = stats.computeMonthlyTotals(records);
  assert.deepEqual(totals, [{ monthKey: '2026-07', totalMiles: 11 }, { monthKey: '2026-08', totalMiles: 4 }]);
});

test('unlogged days never appear in monthly totals', function () {
  var records = [{ dateIso: '2026-07-05', type: 'easy', loggedMiles: null }];
  assert.deepEqual(stats.computeMonthlyTotals(records), []);
});

// ── computeWeeklyMileageSeries ───────────────────────────────────────────

function makeWeek(weekNum, plannedEach, completedEach) {
  return { weekNum: weekNum, days: [{ type: 'easy', plannedMiles: plannedEach, loggedMiles: completedEach }] };
}

test('returns a trailing window ending at the current week, never a future week', function () {
  var weeks = [makeWeek(1, 3, 3), makeWeek(2, 3, 3), makeWeek(3, 4, null), makeWeek(4, 4, null)];
  var series = stats.computeWeeklyMileageSeries(weeks, 2, 8);
  assert.deepEqual(series.map(function (w) { return w.weekNum; }), [1, 2]);
  assert.equal(series[1].isCurrent, true);
  assert.equal(series[0].isCurrent, false);
});

test('window is clamped to windowSize and never goes below week 1', function () {
  var weeks = [];
  for (var i = 1; i <= 12; i++) weeks.push(makeWeek(i, 3, 3));
  var series = stats.computeWeeklyMileageSeries(weeks, 10, 8);
  assert.equal(series.length, 8);
  assert.equal(series[0].weekNum, 3);
  assert.equal(series[series.length - 1].weekNum, 10);
});

// ── computeProgressInsight ───────────────────────────────────────────────

test('a new longest run takes priority over every other insight', function () {
  var result = stats.computeProgressInsight({
    longestRunMiles: 5.5, previousLongestRunMiles: 4,
    thisWeek: { plannedMiles: 10, completedMiles: 2, runsCompleted: 1 }
  });
  assert.equal(result.text, 'Your longest run increased from 4 to 5.5 mi.');
});

test('falls through to this-week progress when there is no new longest run', function () {
  var result = stats.computeProgressInsight({
    thisWeek: { plannedMiles: 16, completedMiles: 12.4, runsCompleted: 2 }
  });
  assert.equal(result.text, 'You have completed 12.4 of 16 mi this week.');
});

test('falls through to highest-volume-month only when it is genuinely the highest of multiple months', function () {
  var result = stats.computeProgressInsight({
    thisWeek: { plannedMiles: 0, completedMiles: 0, runsCompleted: 0 },
    monthlyTotals: [{ monthKey: '2026-06', totalMiles: 20 }, { monthKey: '2026-07', totalMiles: 35 }],
    currentMonthKey: '2026-07'
  });
  assert.equal(result.text, 'This is your highest-volume month so far.');
});

test('does not claim "highest volume month" when there is only one month of data (nothing to compare against)', function () {
  var result = stats.computeProgressInsight({
    thisWeek: { plannedMiles: 0, completedMiles: 0, runsCompleted: 2 },
    monthlyTotals: [{ monthKey: '2026-07', totalMiles: 35 }],
    currentMonthKey: '2026-07'
  });
  assert.equal(result.text, 'You completed 2 runs this week.');
});

test('falls through to run count when nothing else is comparable', function () {
  var result = stats.computeProgressInsight({ thisWeek: { plannedMiles: 0, completedMiles: 0, runsCompleted: 3 } });
  assert.equal(result.text, 'You completed 3 runs this week.');
});

test('returns null rather than fabricate an insight when there is truly nothing to report', function () {
  var result = stats.computeProgressInsight({ thisWeek: { plannedMiles: 0, completedMiles: 0, runsCompleted: 0 } });
  assert.equal(result, null);
});

// ── weight unit conversion ───────────────────────────────────────────────

test('toWeightUnit/fromWeightUnit round-trip between lb and kg, canonical storage stays lb', function () {
  assert.equal(stats.toWeightUnit(150, 'lb'), 150);
  assert.equal(stats.toWeightUnit(150, 'kg'), 68.0);
  assert.equal(stats.weightUnitLabel('kg'), 'kg');
  assert.equal(stats.weightUnitLabel('lb'), 'lb');
  var enteredKg = 68;
  var storedLb = stats.fromWeightUnit(enteredKg, 'kg');
  assert.ok(Math.abs(stats.toWeightUnit(storedLb, 'kg') - enteredKg) < 0.15, 'round-trip should return close to the original entered value');
});

// ── computeWeightTrend ───────────────────────────────────────────────────

test('fewer than 2 entries: not enough data, no forced trend', function () {
  assert.equal(stats.computeWeightTrend([]).status, 'not_enough_data');
  assert.equal(stats.computeWeightTrend([{ dateIso: '2026-07-01', weightLb: 150 }]).status, 'not_enough_data');
});

test('a small fluctuation under the threshold reports stable, not up/down', function () {
  var entries = [
    { dateIso: '2026-07-01', weightLb: 150 },
    { dateIso: '2026-07-08', weightLb: 150.8 }
  ];
  assert.equal(stats.computeWeightTrend(entries).status, 'stable');
});

test('a genuine multi-pound change over the recent window reports the correct direction', function () {
  var down = [
    { dateIso: '2026-07-01', weightLb: 160 },
    { dateIso: '2026-07-08', weightLb: 159 },
    { dateIso: '2026-07-15', weightLb: 156 },
    { dateIso: '2026-07-22', weightLb: 155 }
  ];
  assert.equal(stats.computeWeightTrend(down).status, 'down');

  var up = down.map(function (e) { return { dateIso: e.dateIso, weightLb: 320 - e.weightLb }; }).reverse();
  // constructs a mirrored, increasing series from the same numbers
  assert.equal(stats.computeWeightTrend(up).status, 'up');
});

test('only the most recent window (6 entries) drives the trend, not the entire history', function () {
  var entries = [
    { dateIso: '2026-01-01', weightLb: 200 }, // old outlier, must fall outside the trailing window
    { dateIso: '2026-02-01', weightLb: 200 }, // second old outlier -- with the window at 6, need 2 pushed out by 6 recent entries
    { dateIso: '2026-07-01', weightLb: 150 },
    { dateIso: '2026-07-08', weightLb: 150.2 },
    { dateIso: '2026-07-15', weightLb: 149.8 },
    { dateIso: '2026-07-22', weightLb: 150.1 },
    { dateIso: '2026-07-24', weightLb: 149.9 },
    { dateIso: '2026-07-29', weightLb: 150 }
  ];
  assert.equal(stats.computeWeightTrend(entries).status, 'stable');
});

test('entries out of date order are sorted before computing the trend', function () {
  var entries = [
    { dateIso: '2026-07-22', weightLb: 155 },
    { dateIso: '2026-07-01', weightLb: 160 }
  ];
  var result = stats.computeWeightTrend(entries);
  assert.equal(result.latestLb, 155, 'latest must be the most recent date, regardless of array order');
});

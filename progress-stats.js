(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZaeraProgressStats = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // docs/PROGRESS_SPEC.md -- deterministic weekly/monthly running stats,
  // mileage-chart data shaping, progress insight selection, and weight-trend
  // calculation. Pure functions only: plain records in, plain numbers/strings
  // out, no DOM/localStorage/date-formatting -- app.js owns turning this data
  // into markup, the same separation coaching-rules.js already keeps.

  // "What counts as a run" (docs/PROGRESS_SPEC.md) -- cross-training and rest
  // days are real training but not running distance, so they're excluded from
  // every distance/run-count stat below. Race day counts: it's still a real
  // running effort for that week.
  var RUN_TYPES = ['easy', 'long', 'quality', 'race'];
  function isRunType(type) { return RUN_TYPES.indexOf(type) !== -1; }

  function round1(n) { return Math.round(n * 10) / 10; }

  // ── This week's stats ──────────────────────────────────────────────────
  // days: the current plan week's 7 day records, each { type, plannedMiles,
  // loggedMiles (number or null/undefined if not logged) }.
  function computeThisWeekStats(days) {
    var plannedMiles = 0, completedMiles = 0, runsCompleted = 0;
    (days || []).forEach(function (d) {
      if (!isRunType(d.type)) return;
      plannedMiles += d.plannedMiles || 0;
      if (d.loggedMiles != null) {
        completedMiles += d.loggedMiles;
        runsCompleted++;
      }
    });
    return { plannedMiles: round1(plannedMiles), completedMiles: round1(completedMiles), runsCompleted: runsCompleted };
  }

  // ── Monthly totals ─────────────────────────────────────────────────────
  // dayRecords: every day across the whole plan that has already happened,
  // each { dateIso ('YYYY-MM-DD'), type, loggedMiles }. Returns every
  // calendar month (by 'YYYY-MM' key) that has at least one logged run mile,
  // sorted ascending -- lets the caller both look up "this month" and find
  // the highest-volume month so far without a second pass.
  function computeMonthlyTotals(dayRecords) {
    var byMonth = {};
    (dayRecords || []).forEach(function (d) {
      if (!isRunType(d.type) || d.loggedMiles == null) return;
      var monthKey = (d.dateIso || '').slice(0, 7);
      if (!monthKey) return;
      byMonth[monthKey] = (byMonth[monthKey] || 0) + d.loggedMiles;
    });
    return Object.keys(byMonth).sort().map(function (k) { return { monthKey: k, totalMiles: round1(byMonth[k]) }; });
  }

  // ── Weekly mileage series (chart data) ─────────────────────────────────
  // weeks: [{ weekNum, days: [{type, plannedMiles, loggedMiles}] }] for the
  // WHOLE plan. Returns the trailing window of up to windowSize weeks ending
  // at currentWeekNum (never centered -- future weeks have no completed data
  // worth charting), each { weekNum, plannedMiles, completedMiles, isCurrent }.
  function computeWeeklyMileageSeries(weeks, currentWeekNum, windowSize) {
    var size = windowSize || 8;
    var startWeek = Math.max(1, currentWeekNum - size + 1);
    return (weeks || [])
      .filter(function (w) { return w.weekNum >= startWeek && w.weekNum <= currentWeekNum; })
      .map(function (w) {
        var stats = computeThisWeekStats(w.days);
        return { weekNum: w.weekNum, plannedMiles: stats.plannedMiles, completedMiles: stats.completedMiles, isCurrent: w.weekNum === currentWeekNum };
      });
  }

  // ── Progress insight (one at a time, docs/PROGRESS_SPEC.md priority order) ─
  // Only ever reports a comparison backed by real, comparable data -- returns
  // null (no insight) rather than force a claim when there isn't enough.
  function computeProgressInsight(ctx) {
    ctx = ctx || {};
    if (ctx.longestRunMiles != null && ctx.previousLongestRunMiles != null && ctx.longestRunMiles > ctx.previousLongestRunMiles) {
      return { text: 'Your longest run increased from ' + ctx.previousLongestRunMiles + ' to ' + ctx.longestRunMiles + ' ' + (ctx.unitLabel || 'mi') + '.' };
    }
    if (ctx.thisWeek && ctx.thisWeek.plannedMiles > 0) {
      return { text: 'You have completed ' + ctx.thisWeek.completedMiles + ' of ' + ctx.thisWeek.plannedMiles + ' ' + (ctx.unitLabel || 'mi') + ' this week.' };
    }
    if (ctx.monthlyTotals && ctx.monthlyTotals.length && ctx.currentMonthKey) {
      var current = ctx.monthlyTotals.filter(function (m) { return m.monthKey === ctx.currentMonthKey; })[0];
      var isHighest = current && ctx.monthlyTotals.every(function (m) { return m.monthKey === ctx.currentMonthKey || m.totalMiles <= current.totalMiles; });
      // Only meaningful once there's at least one prior month to beat.
      if (isHighest && ctx.monthlyTotals.length > 1) {
        return { text: 'This is your highest-volume month so far.' };
      }
    }
    if (ctx.thisWeek && ctx.thisWeek.runsCompleted > 0) {
      return { text: 'You completed ' + ctx.thisWeek.runsCompleted + ' run' + (ctx.thisWeek.runsCompleted === 1 ? '' : 's') + ' this week.' };
    }
    return null;
  }

  // ── Weight tracking ────────────────────────────────────────────────────
  var KG_PER_LB = 0.453592;
  function toWeightUnit(lb, units) { return units === 'kg' ? round1(lb * KG_PER_LB) : round1(lb); }
  function fromWeightUnit(displayVal, units) { return units === 'kg' ? displayVal / KG_PER_LB : displayVal; }
  function weightUnitLabel(units) { return units === 'kg' ? 'kg' : 'lb'; }

  // docs/PROGRESS_SPEC.md -- a deliberately desensitized threshold (1.5 lb /
  // ~0.68 kg) so ordinary daily water-weight fluctuation never gets reported
  // as a real trend. Compares the average of the most-recent half of a short
  // recent window against the average of the older half -- not a single
  // point-to-point comparison, which would be far too reactive.
  var WEIGHT_TREND_THRESHOLD_LB = 1.5;
  var WEIGHT_TREND_WINDOW = 6;

  function computeWeightTrend(entries) {
    var sorted = (entries || []).slice().sort(function (a, b) { return a.dateIso < b.dateIso ? -1 : a.dateIso > b.dateIso ? 1 : 0; });
    if (sorted.length < 2) return { status: 'not_enough_data' };
    var recent = sorted.slice(-WEIGHT_TREND_WINDOW);
    var mid = Math.floor(recent.length / 2);
    var older = recent.slice(0, mid);
    var newer = recent.slice(mid);
    function mean(arr) { return arr.reduce(function (s, e) { return s + e.weightLb; }, 0) / arr.length; }
    var diff = mean(newer) - mean(older);
    var status = diff > WEIGHT_TREND_THRESHOLD_LB ? 'up' : diff < -WEIGHT_TREND_THRESHOLD_LB ? 'down' : 'stable';
    return { status: status, diffLb: round1(diff), latestLb: sorted[sorted.length - 1].weightLb };
  }

  return {
    RUN_TYPES: RUN_TYPES,
    isRunType: isRunType,
    computeThisWeekStats: computeThisWeekStats,
    computeMonthlyTotals: computeMonthlyTotals,
    computeWeeklyMileageSeries: computeWeeklyMileageSeries,
    computeProgressInsight: computeProgressInsight,
    toWeightUnit: toWeightUnit,
    fromWeightUnit: fromWeightUnit,
    weightUnitLabel: weightUnitLabel,
    computeWeightTrend: computeWeightTrend
  };
});

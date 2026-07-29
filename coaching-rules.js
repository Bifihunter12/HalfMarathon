(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RACRCoachingRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Coaching rules (docs/COACHING_SPEC.md) ──────────────────────────────
  // Extracted verbatim from app.js (no behavior change to production, see
  // the two exceptions noted below) so the rules governing runner
  // classification, goal feasibility, and missed-workout/difficulty
  // adaptation -- documented in docs/COACHING_SPEC.md -- can have real,
  // automated decision-scenario test coverage (tests/decision-scenarios.test.js)
  // instead of only ever being spot-checked by hand in a browser. Mirrors the
  // exact UMD pattern already used by merge-state.js/side-quests.js/etc.
  //
  // Two intentional, behavior-preserving exceptions to "verbatim":
  //  1. applyMissedAdjustment/applyDifficultyAdjustment now take an explicit
  //     `units` parameter instead of reading module-level state.units (via
  //     app.js's toUnit/unitLabel) -- needed for these to be pure functions
  //     of their inputs. app.js's one call site (generateAll) now passes
  //     state.units through.
  //  2. applyDifficultyAdjustment now reads `logs[key]` directly instead of
  //     calling app.js's getLog(key) (which secretly reads module-level
  //     state.logs, ignoring the logs parameter this function was already
  //     given). This was a real latent bug -- every current caller happens
  //     to pass state.logs as `logs` anyway, so production behavior is
  //     unchanged, but the parameter was dead code and the function wasn't
  //     actually pure. Fixed here, matching how applyMissedAdjustment
  //     already correctly reads its own `logs` parameter.

  var LEVELS = ['beginner', 'novice', 'intermediate', 'advanced'];

  var EVENT_LABEL = { '5k': '5K', '10k': '10K', half: 'Half Marathon', marathon: 'Marathon', '50k': '50K', '50mi': '50 Mile', '100k': '100K', '100mi': '100 Mile' };

  // { idealWeeks, minWeeks, longRunPeak (mi), peakVolume (mi/wk), taperWeeks }
  var EVENT_TABLE = {
    '5k': {
      beginner: { idealWeeks: 12, minWeeks: 8, longRunPeak: 3, peakVolume: 12, taperWeeks: 1 },
      novice: { idealWeeks: 10, minWeeks: 8, longRunPeak: 4, peakVolume: 15, taperWeeks: 1 },
      intermediate: { idealWeeks: 8, minWeeks: 6, longRunPeak: 6, peakVolume: 22, taperWeeks: 1 },
      advanced: { idealWeeks: 6, minWeeks: 4, longRunPeak: 8, peakVolume: 30, taperWeeks: 1 }
    },
    '10k': {
      beginner: { idealWeeks: 12, minWeeks: 8, longRunPeak: 5, peakVolume: 16, taperWeeks: 1 },
      novice: { idealWeeks: 10, minWeeks: 8, longRunPeak: 6, peakVolume: 20, taperWeeks: 1 },
      intermediate: { idealWeeks: 8, minWeeks: 6, longRunPeak: 9, peakVolume: 28, taperWeeks: 1 },
      advanced: { idealWeeks: 8, minWeeks: 6, longRunPeak: 11, peakVolume: 38, taperWeeks: 1 }
    },
    half: {
      beginner: { idealWeeks: 18, minWeeks: 12, longRunPeak: 9, peakVolume: 22, taperWeeks: 2 },
      novice: { idealWeeks: 14, minWeeks: 10, longRunPeak: 10, peakVolume: 28, taperWeeks: 2 },
      intermediate: { idealWeeks: 12, minWeeks: 8, longRunPeak: 12, peakVolume: 38, taperWeeks: 2 },
      advanced: { idealWeeks: 10, minWeeks: 6, longRunPeak: 15, peakVolume: 50, taperWeeks: 2 }
    },
    marathon: {
      beginner: { idealWeeks: 22, minWeeks: 16, longRunPeak: 18, peakVolume: 35, taperWeeks: 3 },
      novice: { idealWeeks: 18, minWeeks: 14, longRunPeak: 20, peakVolume: 42, taperWeeks: 3 },
      intermediate: { idealWeeks: 16, minWeeks: 12, longRunPeak: 20, peakVolume: 52, taperWeeks: 3 },
      advanced: { idealWeeks: 14, minWeeks: 10, longRunPeak: 22, peakVolume: 65, taperWeeks: 3 }
    },
    '50k': {
      beginner: { idealWeeks: 24, minWeeks: 16, longRunPeak: 22, peakVolume: 35, taperWeeks: 2 },
      novice: { idealWeeks: 20, minWeeks: 14, longRunPeak: 24, peakVolume: 42, taperWeeks: 2 },
      intermediate: { idealWeeks: 16, minWeeks: 12, longRunPeak: 26, peakVolume: 50, taperWeeks: 2 },
      advanced: { idealWeeks: 14, minWeeks: 10, longRunPeak: 28, peakVolume: 60, taperWeeks: 2 }
    },
    '50mi': {
      beginner: { idealWeeks: 28, minWeeks: 20, longRunPeak: 28, peakVolume: 45, taperWeeks: 3 },
      novice: { idealWeeks: 24, minWeeks: 18, longRunPeak: 30, peakVolume: 52, taperWeeks: 3 },
      intermediate: { idealWeeks: 20, minWeeks: 14, longRunPeak: 32, peakVolume: 60, taperWeeks: 3 },
      advanced: { idealWeeks: 16, minWeeks: 12, longRunPeak: 34, peakVolume: 70, taperWeeks: 3 }
    },
    '100k': {
      beginner: { idealWeeks: 28, minWeeks: 20, longRunPeak: 28, peakVolume: 45, taperWeeks: 3 },
      novice: { idealWeeks: 24, minWeeks: 18, longRunPeak: 30, peakVolume: 52, taperWeeks: 3 },
      intermediate: { idealWeeks: 20, minWeeks: 14, longRunPeak: 32, peakVolume: 60, taperWeeks: 3 },
      advanced: { idealWeeks: 16, minWeeks: 12, longRunPeak: 34, peakVolume: 70, taperWeeks: 3 }
    },
    '100mi': {
      beginner: { idealWeeks: 36, minWeeks: 24, longRunPeak: 32, peakVolume: 55, taperWeeks: 4 },
      novice: { idealWeeks: 30, minWeeks: 20, longRunPeak: 34, peakVolume: 62, taperWeeks: 4 },
      intermediate: { idealWeeks: 24, minWeeks: 16, longRunPeak: 36, peakVolume: 72, taperWeeks: 4 },
      advanced: { idealWeeks: 20, minWeeks: 14, longRunPeak: 38, peakVolume: 80, taperWeeks: 4 }
    }
  };

  var RPE_TARGET = { easy: [3, 4], long: [4, 5] };

  function round5(n) { return Math.round(n * 2) / 2; }

  function parseDate(iso) {
    var p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  // slot index within a week: 0..6, slot 6 always lands on the real race weekday
  function dateForSlot(raceDate, planLengthWeeks, week, slot) {
    var slotNum = (week - 1) * 7 + slot;
    var raceSlotNum = (planLengthWeeks - 1) * 7 + 6;
    var d = new Date(raceDate.getTime());
    d.setDate(d.getDate() + (slotNum - raceSlotNum));
    return d;
  }

  function findCurrentWeekIdx(raceDate, planLengthWeeks, today) {
    for (var w = 1; w <= planLengthWeeks; w++) {
      var wkStart = dateForSlot(raceDate, planLengthWeeks, w, 0);
      var wkEnd = dateForSlot(raceDate, planLengthWeeks, w, 6);
      if (today >= wkStart && today <= wkEnd) return w;
      if (today < wkStart) return w;
    }
    return -1;
  }

  // ── Classification + safety ──────────────────────────────────────────
  function classifyUser(profile) {
    var freq = profile.runDaysPerWeek, mileage = profile.weeklyMileage;
    var computed;
    if (freq <= 2 || mileage < 8) computed = 'beginner';
    else if (freq === 3 && mileage < 20) computed = 'novice';
    else if (freq <= 5 && mileage < 40) computed = 'intermediate';
    else computed = 'advanced';
    var selfRank = LEVELS.indexOf(profile.experienceLevel);
    var compRank = LEVELS.indexOf(computed);
    var rank = Math.min(selfRank >= 0 ? selfRank : compRank, compRank);
    if (profile.recentInjury) rank = Math.min(rank, LEVELS.indexOf('novice'));
    return LEVELS[rank];
  }

  function evaluateSafety(event, weeksAvailable, level) {
    var cfg = EVENT_TABLE[event][level];
    var unsafe = weeksAvailable < cfg.minWeeks;
    var warnings = [];
    if (unsafe) {
      warnings.push('You have ' + weeksAvailable + ' week' + (weeksAvailable === 1 ? '' : 's') + ' until race day, but a safe ' + EVENT_LABEL[event] + ' build at your current level needs at least ' + cfg.minWeeks + '. This plan scales volume and long runs down to reduce injury risk given the shorter runway — consider a later race date or a shorter distance for a safer build.');
    }
    return { unsafe: unsafe, warnings: warnings };
  }

  function choosePlanLength(weeksAvailable, event, level) {
    var idealWeeks = EVENT_TABLE[event][level].idealWeeks;
    return Math.min(weeksAvailable, Math.round(idealWeeks * 1.6), 40);
  }

  // ── units-parameterized label helpers (see exception #1 above) ──
  var KM_PER_MI = 1.60934;
  function round1(n) { return Math.round(n * 10) / 10; }
  function unitLabel(units) { return units === 'km' ? 'km' : 'mi'; }
  function toUnit(mi, units) { return units === 'km' ? round1(mi * KM_PER_MI) : mi; }
  function formatLongRunLabel(miles, terrainNote, units) {
    return toUnit(miles, units) + ' ' + unitLabel(units) + ' long run' + (terrainNote ? ' (' + terrainNote + ')' : '') + (miles * 11 >= 90 ? ' + fueling practice' : '');
  }
  function formatEasyRunLabel(miles, units) { return toUnit(miles, units) + ' ' + unitLabel(units) + ' easy run'; }

  // ── Adaptive layer: dampen future weeks if recent training was mostly missed ──
  function applyMissedAdjustment(weeks, raceGoal, planMeta, logs, today, terrainNote, units) {
    var raceDate = parseDate(raceGoal.raceDate);
    var planLengthWeeks = planMeta.planLengthWeeks;
    var currentWeekIdx = findCurrentWeekIdx(raceDate, planLengthWeeks, today);
    if (currentWeekIdx <= 1) return { weeks: weeks, note: null };

    var lastWeek = weeks[currentWeekIdx - 2]; // the fully-completed week before current
    var loggableCount = 0, loggedCount = 0, longRunMissed = false;
    lastWeek.days.forEach(function (day, di) {
      // Cross-training is optional supportive work, not core running stimulus --
      // excluded from the missed-ratio the same way rest/race already are, so
      // several unlogged cross-training days can never trip the same dampening
      // threshold as actually missed running work (docs/COACHING_SPEC.md
      // "Adaptation rules" -- the fix that closed decision-scenarios.test.js's
      // one, now-removed, todo scenario).
      if (day.type === 'rest' || day.type === 'race' || day.type === 'cross') return;
      loggableCount++;
      var key = lastWeek.weekNum + '-' + di;
      if (logs[key]) loggedCount++;
      else if (day.type === 'long') longRunMissed = true;
    });
    var missedRatio = loggableCount ? 1 - loggedCount / loggableCount : 0;
    var note = null;
    if (missedRatio > 0.6) {
      var dampen = 0.85;
      for (var i = currentWeekIdx; i < weeks.length; i++) {
        var wk = weeks[i];
        if (wk.phase === 'race') continue;
        wk.days.forEach(function (day) {
          if (day.miles) {
            day.miles = round5(day.miles * dampen);
            if (day.type === 'long') day.label = formatLongRunLabel(day.miles, terrainNote, units);
            else if (day.type === 'easy') day.label = formatEasyRunLabel(day.miles, units);
          }
        });
      }
      note = 'You missed most of last week’s sessions, so upcoming volume was reduced about 15% to rebuild gradually.';
    } else if (longRunMissed) {
      var wkNext = weeks[currentWeekIdx - 1];
      if (wkNext) {
        wkNext.days.forEach(function (day) {
          if (day.type === 'long' && day.miles) {
            day.miles = round5(day.miles * 0.8);
            day.label = formatLongRunLabel(day.miles, terrainNote, units);
          }
        });
      }
      note = 'Last week’s long run was missed, so this week’s long run was shortened.';
    }
    return { weeks: weeks, note: note };
  }

  // ── Adaptive layer: nudge future volume if easy/long RPE has been consistently
  // off-target for a couple of weeks (doesn't run in the same week a missed-
  // workout adjustment already fired -- one adaptive story per render, not two) ──
  function applyDifficultyAdjustment(weeks, raceGoal, planMeta, logs, today, terrainNote, units) {
    var raceDate = parseDate(raceGoal.raceDate);
    var planLengthWeeks = planMeta.planLengthWeeks;
    var currentWeekIdx = findCurrentWeekIdx(raceDate, planLengthWeeks, today);
    if (currentWeekIdx <= 1) return null;

    var samples = [];
    for (var w = Math.max(1, currentWeekIdx - 2); w < currentWeekIdx; w++) {
      var wk = weeks[w - 1];
      if (!wk) continue;
      wk.days.forEach(function (day, di) {
        if (day.type !== 'easy' && day.type !== 'long') return;
        var entry = logs[wk.weekNum + '-' + di];
        if (typeof entry === 'string') entry = { time: entry };
        if (entry && entry.effort) samples.push(entry.effort);
      });
    }
    if (samples.length < 3) return null;
    var avg = samples.reduce(function (a, b) { return a + b; }, 0) / samples.length;

    var factor = null, note = null;
    if (avg <= RPE_TARGET.easy[0] - 1) {
      factor = 1.05;
      note = 'Your easy running has felt too easy lately, so upcoming volume was nudged up about 5%.';
    } else if (avg >= RPE_TARGET.easy[1] + 3) {
      factor = 0.9;
      note = 'Your easy running has felt harder than it should lately, so upcoming volume was eased back about 10%.';
    }
    if (!factor) return null;

    for (var i = currentWeekIdx; i < weeks.length; i++) {
      var wk2 = weeks[i];
      if (wk2.phase === 'race') continue;
      wk2.days.forEach(function (day) {
        if (day.miles && (day.type === 'easy' || day.type === 'long')) {
          day.miles = round5(day.miles * factor);
          day.label = day.type === 'long' ? formatLongRunLabel(day.miles, terrainNote, units) : formatEasyRunLabel(day.miles, units);
        }
      });
    }
    return note;
  }

  // ── Run/walk beginner progression (docs/COACHING_SPEC.md "Run-walk
  // programming") -- own synthesis, a standard progressive run/walk
  // structure, not any single trademarked program's exact schedule. Used
  // only when the runner has explicitly said they can't yet run
  // continuously (state.profile.canRunContinuously === false); everyone
  // else keeps the existing continuous-mileage generator untouched.
  var RUN_WALK_STAGES = [
    { runSec: 60, walkSec: 120, cycles: 8, totalMin: 24 },   // run 1min / walk 2min x8
    { runSec: 90, walkSec: 90, cycles: 9, totalMin: 27 },    // run 1:30 / walk 1:30 x9
    { runSec: 180, walkSec: 90, cycles: 7, totalMin: 32 },   // run 3min / walk 1:30 x7
    { runSec: 300, walkSec: 90, cycles: 5, totalMin: 33 },   // run 5min / walk 1:30 x5
    { runSec: 420, walkSec: 90, cycles: 4, totalMin: 34 },   // run 7min / walk 1:30 x4
    { runSec: 600, walkSec: 90, cycles: 3, totalMin: 35 },   // run 10min / walk 1:30 x3
    { runSec: 1500, walkSec: 60, cycles: 1, totalMin: 26 }   // run 25min / walk 1min x1 -- graduation stage, near-continuous
  ];

  function runWalkWeeksFor(planLengthWeeks) {
    return Math.max(4, Math.ceil(planLengthWeeks * 0.6));
  }

  function runWalkStageForWeek(week, runWalkWeeks) {
    var idx = Math.floor((week - 1) / (runWalkWeeks / RUN_WALK_STAGES.length));
    return RUN_WALK_STAGES[Math.max(0, Math.min(RUN_WALK_STAGES.length - 1, idx))];
  }

  // The long-day slot gets more cycles (more total time) than the same
  // stage's easy/quality sessions -- never a different run:walk ratio,
  // just more of it.
  function buildRunWalkSession(stage, isLong) {
    var cycles = isLong ? Math.max(stage.cycles + 1, Math.round(stage.cycles * 1.4)) : stage.cycles;
    var totalSec = (stage.runSec + stage.walkSec) * cycles;
    return { runSec: stage.runSec, walkSec: stage.walkSec, cycles: cycles, totalMin: Math.round(totalSec / 60) };
  }

  function fmtMinSec(sec) {
    if (sec % 60 === 0) return (sec / 60) + ' min';
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') + ' min';
  }

  function formatRunWalkLabel(session) {
    return 'Run ' + fmtMinSec(session.runSec) + ' / walk ' + fmtMinSec(session.walkSec) + ' ×' + session.cycles + ' (' + session.totalMin + ' min)';
  }

  return {
    LEVELS: LEVELS,
    EVENT_TABLE: EVENT_TABLE,
    EVENT_LABEL: EVENT_LABEL,
    RPE_TARGET: RPE_TARGET,
    parseDate: parseDate,
    dateForSlot: dateForSlot,
    findCurrentWeekIdx: findCurrentWeekIdx,
    classifyUser: classifyUser,
    evaluateSafety: evaluateSafety,
    choosePlanLength: choosePlanLength,
    applyMissedAdjustment: applyMissedAdjustment,
    applyDifficultyAdjustment: applyDifficultyAdjustment,
    RUN_WALK_STAGES: RUN_WALK_STAGES,
    runWalkWeeksFor: runWalkWeeksFor,
    runWalkStageForWeek: runWalkStageForWeek,
    buildRunWalkSession: buildRunWalkSession,
    formatRunWalkLabel: formatRunWalkLabel
  };
});

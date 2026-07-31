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

  // docs/COACHING_SPEC.md "Weekly structure" -- buildStructuredWeeks's own
  // constants, moved here alongside it so the whole plan generator is
  // testable in one place (tests/plan-scenarios.test.js).
  var GOAL_FACTOR = { finish: 0.85, improve: 1.0, pr: 1.05, aggressive: 1.12 };
  var RUN_DAYS_DEFAULT = { beginner: 3, novice: 3, intermediate: 5, advanced: 6 };
  var LONG_RUN_SHARE = { '5k': 0.32, '10k': 0.30, half: 0.30, marathon: 0.28, '50k': 0.35, '50mi': 0.38, '100k': 0.38, '100mi': 0.40 };
  var STRENGTH_SESSIONS = { base: 2, build: 2, peak: 1, taper: 0, race: 0 };
  var INCREASE_PCT = { beginner: 0.04, novice: 0.06, intermediate: 0.08, advanced: 0.10 };
  var CUTBACK_PCT = { beginner: 0.20, novice: 0.17, intermediate: 0.15, advanced: 0.12 };
  var CUTBACK_INTERVAL = { beginner: 3, novice: 3, intermediate: 4, advanced: 4 };
  var TERRAIN_LABEL = { road: 'Road', trail: 'Trail', hills: 'Hills', mountain: 'Mountain', treadmill: 'Treadmill' };
  var RACE_LABEL = { '5k': '5K Race', '10k': '10K Race', half: 'Half Marathon', marathon: 'Marathon', '50k': '50K', '50mi': '50 Mile', '100k': '100K', '100mi': '100 Mile' };
  var RUN_SLOT_PRIORITY = [1, 3, 5, 0, 2, 4]; // Tue, Thu, Sat, Mon, Wed, Fri (slot 6 = long, fixed)

  var QUALITY_POOL = {
    '5k': { entry: ['Easy + 4-6 x 20 sec strides'], trained: ['6 x 400m @ 5K pace', '5 x 3 min @ 5K effort', '4 x 5 min @ 10K effort', 'Fartlek: 8 x 1 min hard / 1 min easy'] },
    '10k': { entry: ['Easy + strides', '20 min tempo, comfortably hard'], trained: ['Tempo: 25-30 min @ threshold', '5 x 1000m @ 10K pace', '6 x 800m @ 10K pace', 'Hills: 6 x 2 min uphill'] },
    half: { entry: ['Easy + strides', '15-20 min tempo'], trained: ['Tempo: 3 x 10 min @ threshold', '4-6 mi @ half-marathon pace', '5 x 1 mi @ 10K pace'] },
    marathon: { entry: ['Medium-long run', 'Easy + strides'], trained: ['8 mi w/ 4 mi @ marathon pace', '2 x 4 mi @ marathon pace', 'Medium-long run'] },
    '50k': { entry: ['Hill repeats: 5 x 3 min uphill', 'Trail long run w/ climbing'], trained: ['Back-to-back long runs', 'Long climb + descent conditioning'] },
    '50mi': { entry: ['Back-to-back long runs', 'Time-on-feet long run'], trained: ['Back-to-back long runs', 'Long climb + descent conditioning', 'Night run rehearsal'] },
    '100k': { entry: ['Back-to-back long runs', 'Time-on-feet long run'], trained: ['Back-to-back long runs', 'Long climb + descent conditioning', 'Night run rehearsal'] },
    '100mi': { entry: ['Back-to-back long runs', 'Time-on-feet long run', 'Gear + fueling rehearsal'], trained: ['Back-to-back long runs', 'Night run rehearsal', 'Downhill conditioning', 'Gear + fueling rehearsal'] }
  };

  function round5(n) { return Math.round(n * 2) / 2; }

  function parseDate(iso) {
    var p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function dateToISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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
  // docs/COACHING_SPEC.md "Runner classification" -- injury/return-to-running
  // status, keyed by profile.injuryStatus. `resolved` has no cap value (no
  // classification constraint). Falls back to the legacy boolean
  // profile.recentInjury for profiles created before this enum existed
  // (true -> same cap as 'mild_discomfort', matching the old behavior exactly).
  var INJURY_CAP = { resolved: null, mild_discomfort: 'novice', unable_to_run: 'beginner', medically_restricted: 'beginner' };

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
    var injuryStatus = profile.injuryStatus || (profile.recentInjury ? 'mild_discomfort' : 'resolved');
    var cap = INJURY_CAP[injuryStatus];
    if (cap) rank = Math.min(rank, LEVELS.indexOf(cap));
    return LEVELS[rank];
  }

  // docs/COACHING_SPEC.md "Weekly structure" -- frequency-aware opening
  // schedule. Starts at the runner's actual current frequency plus one
  // (never the old hardcoded floor of 3), then ramps by one running day
  // every `rampIntervalWeeks` until reaching the plan's eventual target.
  function startRunDaysFor(runDaysPerWeek, targetRunDays) {
    return Math.max(2, Math.min(targetRunDays, (runDaysPerWeek || 0) + 1));
  }

  function runDaysForWeek(week, startRunDays, targetRunDays, rampIntervalWeeks) {
    if (targetRunDays <= startRunDays) return targetRunDays;
    var stepsElapsed = Math.floor((week - 1) / rampIntervalWeeks);
    return Math.min(targetRunDays, startRunDays + stepsElapsed);
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

  // ── Weekly template: which of the 7 slots are long/quality/easy/cross/rest ──
  function assignWeekTemplate(runDays, wantCross) {
    // capped at 5 (not 6) so one of the 6 non-long slots is always structurally
    // left as 'rest' below, satisfying the "at least one rest day" rule without
    // ever having to overwrite an already-assigned run day after the fact
    var additional = Math.max(0, Math.min(5, runDays - 1));
    var slots = ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'long'];
    var chosen = RUN_SLOT_PRIORITY.slice(0, additional);
    chosen.forEach(function (idx, i) { slots[idx] = i === 0 ? 'quality' : 'easy'; });
    var restPref = [4, 0, 2, 3, 5, 1];
    var restSlot = restPref.filter(function (i) { return slots[i] === 'rest'; })[0];
    for (var j = 0; j < 6; j++) {
      if (slots[j] === 'rest' && j !== restSlot && wantCross) slots[j] = 'cross';
    }
    return slots;
  }

  // ── Phase assignment across the whole plan ──────────────────────────
  function assignPhases(planLengthWeeks, taperWeeksCfg) {
    var taperWeeks = Math.max(0, Math.min(taperWeeksCfg, Math.floor(planLengthWeeks / 3)));
    var raceWeek = planLengthWeeks;
    var phases = [];
    for (var w = 1; w <= planLengthWeeks; w++) {
      if (w === raceWeek) phases.push('race');
      else if (w > raceWeek - 1 - taperWeeks) phases.push('taper');
      else phases.push(null); // filled below
    }
    var buildEnd = raceWeek - 1 - taperWeeks;
    var baseCount = Math.round(buildEnd * 0.35);
    var buildCount = Math.round(buildEnd * 0.40);
    for (var w2 = 1; w2 <= buildEnd; w2++) {
      if (w2 <= baseCount) phases[w2 - 1] = 'base';
      else if (w2 <= baseCount + buildCount) phases[w2 - 1] = 'build';
      else phases[w2 - 1] = 'peak';
    }
    return phases; // index 0 = week 1
  }

  function taperFraction(taperWeeks, idx) {
    var curves = { 1: [0.55], 2: [0.65, 0.45], 3: [0.75, 0.55, 0.40], 4: [0.80, 0.65, 0.50, 0.38] };
    var curve = curves[taperWeeks] || curves[3];
    return curve[Math.min(idx, curve.length - 1)];
  }

  // ── Volume progression per week ──────────────────────────────────────
  function computeWeeklyVolumes(planLengthWeeks, phases, startVolume, peakVolume, level, taperWeeks) {
    var vols = [];
    var blockPeak = startVolume;
    var cutbackInterval = CUTBACK_INTERVAL[level];
    var buildWeekCounter = 0;
    var taperIdx = 0;
    for (var i = 0; i < planLengthWeeks; i++) {
      var phase = phases[i];
      if (phase === 'race') {
        vols.push(round5(blockPeak * 0.15));
      } else if (phase === 'taper') {
        vols.push(round5(blockPeak * taperFraction(taperWeeks, taperIdx)));
        taperIdx++;
      } else {
        buildWeekCounter++;
        var isCutback = buildWeekCounter % cutbackInterval === 0;
        if (isCutback) {
          vols.push(round5(blockPeak * (1 - CUTBACK_PCT[level])));
        } else {
          var candidate = Math.min(blockPeak * (1 + INCREASE_PCT[level]), peakVolume);
          if (i === 0) candidate = startVolume;
          blockPeak = candidate;
          vols.push(round5(candidate));
        }
      }
    }
    return vols;
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

  // Small pure helper, duplicated rather than shared across a module boundary
  // (same reasoning as round5's existing duplication) -- app.js's generateAll
  // needs its own callable copy independent of buildStructuredWeeks.
  function terrainNoteFrom(terrains) {
    var extra = (terrains || []).filter(function (t) { return t !== 'road'; }).map(function (t) { return TERRAIN_LABEL[t]; });
    return extra.length ? extra.join('/') : null;
  }

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

  // ── Structured per-day generation (numeric, pre-formatting) ──────────
  // docs/COACHING_SPEC.md "Weekly structure" -- moved from app.js so the
  // whole plan generator is testable (tests/plan-scenarios.test.js), the
  // same "add a units parameter" treatment as applyMissedAdjustment/
  // applyDifficultyAdjustment (see exception #1 at the top of this file).
  function buildStructuredWeeks(profile, raceGoal, planMeta, units) {
    var event = raceGoal.event;
    var level = planMeta.level;
    var cfg = EVENT_TABLE[event][level];
    var planLengthWeeks = planMeta.planLengthWeeks;
    var safetyScale = planMeta.unsafe ? Math.max(0.55, planMeta.weeksAvailable / cfg.minWeeks) : 1.0;
    var goalFactor = GOAL_FACTOR[raceGoal.goal] || 1.0;

    var peakVolume = cfg.peakVolume * goalFactor * safetyScale;
    var longRunPeak = cfg.longRunPeak * safetyScale;
    var startVolume = Math.max(profile.weeklyMileage, level === 'beginner' ? 4 : 6);
    if (startVolume > peakVolume * 0.6) startVolume = peakVolume * 0.6;

    var phases = assignPhases(planLengthWeeks, cfg.taperWeeks);
    var volumes = computeWeeklyVolumes(planLengthWeeks, phases, startVolume, peakVolume, level, cfg.taperWeeks);
    // docs/COACHING_SPEC.md "Weekly structure" -- frequency-aware opening
    // schedule. targetRunDays is the plan's eventual day count (same formula
    // as before, just without the old hardcoded Math.max(3, ...) floor);
    // startRunDays begins at the runner's actual current frequency plus one
    // and ramps up week by week (see the per-week loop below) rather than
    // jumping straight to the target on day one.
    var targetRunDays = Math.min(profile.availableDays || RUN_DAYS_DEFAULT[level], RUN_DAYS_DEFAULT[level] + (event === '5k' || event === '10k' || event === 'half' || event === 'marathon' ? 0 : 1));
    var startRunDays = startRunDaysFor(profile.runDaysPerWeek, targetRunDays);
    var wantCross = !(profile.crossOptions && profile.crossOptions.length === 1 && profile.crossOptions[0] === 'None');
    var qualityPool = QUALITY_POOL[event];
    var longRunSafetyCap = Math.max(profile.longestRun * 1.15, 2);
    var terrainNote = terrainNoteFrom(profile.terrains);

    // docs/COACHING_SPEC.md "Run-walk programming" -- only when the runner
    // explicitly said they can't yet run continuously. Spends roughly the
    // first 60% of the plan on a time-based run/walk progression, then falls
    // through to the normal continuous-mileage generation below unchanged,
    // so the runner arrives at race day already running continuously.
    var useRunWalk = profile.canRunContinuously === false;
    var runWalkWeeks = useRunWalk ? runWalkWeeksFor(planLengthWeeks) : 0;

    var weeks = [];
    for (var w = 1; w <= planLengthWeeks; w++) {
      var phase = phases[w - 1];
      var targetVolume = volumes[w - 1];
      var weekRunDays = runDaysForWeek(w, startRunDays, targetRunDays, 2);
      var longShare = LONG_RUN_SHARE[event] + (weekRunDays <= 3 ? 0.15 : weekRunDays === 4 ? 0.05 : 0);
      var template = assignWeekTemplate(weekRunDays, wantCross);
      var inRunWalkWindow = useRunWalk && phase !== 'race' && w <= runWalkWeeks;
      var runWalkStage = inRunWalkWindow ? runWalkStageForWeek(w, runWalkWeeks) : null;
      var isEntry = (level === 'beginner') || (level === 'novice' && phase === 'base');
      var pool = isEntry ? qualityPool.entry : qualityPool.trained;
      var qualityText = pool[(w - 1) % pool.length];
      var strengthBudget = STRENGTH_SESSIONS[phase] != null ? STRENGTH_SESSIONS[phase] : 1;

      var days = [];
      var longRunCap = phase === 'base' ? Math.min(longRunPeak, longRunSafetyCap) : longRunPeak;
      var longRunMiles = phase === 'race' ? 0 : round5(Math.min(longRunCap, targetVolume * longShare));
      var qualityMiles = (phase === 'base' || phase === 'race') ? 0 : round5(Math.min(targetVolume * 0.18, 8));
      var remaining = Math.max(0, targetVolume - longRunMiles - qualityMiles);
      var easySlotCount = template.filter(function (t) { return t === 'easy'; }).length;
      var easyCap = longRunMiles > 0 ? longRunMiles * 0.85 : remaining;
      var easyEach = easySlotCount ? round5(Math.min(remaining / easySlotCount, easyCap)) : 0;

      var strengthAssigned = 0;
      var crossPref = profile.crossOptions && profile.crossOptions.length && profile.crossOptions[0] !== 'None' ? profile.crossOptions[0] : 'Cross-train';

      for (var slot = 0; slot < 7; slot++) {
        var tok = template[slot];
        var day = { type: tok, miles: 0, label: '' };
        if (phase === 'race' && slot === 6) {
          day.type = 'race'; day.label = RACE_LABEL[event];
        } else if (phase === 'race') {
          day.type = 'rest'; day.label = 'Rest';
        } else if (tok === 'long') {
          day.type = 'long';
          if (runWalkStage) {
            day.runWalk = buildRunWalkSession(runWalkStage, true);
            day.label = formatRunWalkLabel(day.runWalk);
          } else {
            day.miles = longRunMiles;
            day.label = formatLongRunLabel(longRunMiles, terrainNote, units);
          }
        } else if (tok === 'quality') {
          day.type = 'quality';
          if (runWalkStage) {
            // Never hand a true beginner a tempo/interval prescription
            // (QUALITY_POOL's entry text, e.g. "20 min tempo, comfortably
            // hard") before they can run continuously at all -- another
            // gentle run/walk session instead.
            day.runWalk = buildRunWalkSession(runWalkStage, false);
            day.label = formatRunWalkLabel(day.runWalk);
          } else {
            // docs/COACHING_SPEC.md "Quality-day volume math" -- qualityMiles
            // is already a holistic session-distance budget (see where it's
            // computed above), not a parse of the label's interval structure,
            // so it's framed here as an approximate total including
            // warm-up/cool-down rather than a precise breakdown.
            day.miles = qualityMiles;
            day.label = qualityMiles > 0 ? qualityText + ' (~' + toUnit(qualityMiles, units) + ' ' + unitLabel(units) + ' total, incl. warm-up/cool-down)' : qualityText;
          }
        } else if (tok === 'easy') {
          day.type = 'easy';
          if (runWalkStage) {
            day.runWalk = buildRunWalkSession(runWalkStage, false);
            day.label = formatRunWalkLabel(day.runWalk);
          } else {
            day.miles = easyEach;
            day.label = formatEasyRunLabel(easyEach, units);
          }
        } else if (tok === 'cross') {
          var addStrength = strengthAssigned < strengthBudget;
          if (addStrength) strengthAssigned++;
          day.type = 'cross';
          day.label = (30 + Math.min(30, Math.round(targetVolume))) + ' min cross' + (crossPref !== 'Cross-train' ? ' · ' + crossPref : '') + (addStrength ? ' + Strength' : '');
        } else {
          day.type = 'rest'; day.label = 'Rest';
        }
        days.push(day);
      }

      weeks.push({ weekNum: w, phase: phase, targetVolume: targetVolume, days: days });
    }
    return weeks;
  }

  // ── Adaptive layer: pause days the user marked unavailable (illness/travel) ──
  // Already fully pure -- ranges is an explicit parameter, never reads any
  // external state (docs/SAFETY_POLICY.md "Illness & interruption handling").
  function applyUnavailableRanges(weeks, raceGoal, planMeta, ranges) {
    if (!ranges || !ranges.length) return weeks;
    var raceDate = parseDate(raceGoal.raceDate);
    var planLengthWeeks = planMeta.planLengthWeeks;
    weeks.forEach(function (wk) {
      wk.days.forEach(function (day, di) {
        if (day.type === 'race') return;
        var iso = dateToISO(dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di));
        var hit = ranges.filter(function (r) { return iso >= r.start && iso <= r.end; })[0];
        if (hit) {
          day.type = 'rest';
          day.miles = 0;
          day.label = 'Rest — ' + (hit.reason === 'vacation' ? 'away' : 'illness');
        }
      });
    });
    return weeks;
  }

  // ── Full generation pipeline (docs/COACHING_SPEC.md) -- mirrors app.js's
  // generateAll exactly: build -> exclude unavailable days -> adapt to a
  // missed week -> (if nothing was already adapted) adapt to an RPE trend.
  // Lets tests/plan-scenarios.test.js exercise the real end-to-end pipeline
  // instead of a hand-reconstructed approximation of it.
  function generatePlan(profile, raceGoal, planMeta, logs, today, unavailable, units) {
    var weeks = buildStructuredWeeks(profile, raceGoal, planMeta, units);
    weeks = applyUnavailableRanges(weeks, raceGoal, planMeta, unavailable);
    var terrainNote = terrainNoteFrom(profile.terrains);
    var adjusted = applyMissedAdjustment(weeks, raceGoal, planMeta, logs, today, terrainNote, units);
    if (!adjusted.note) {
      var diffNote = applyDifficultyAdjustment(adjusted.weeks, raceGoal, planMeta, logs, today, terrainNote, units);
      if (diffNote) adjusted.note = diffNote;
    }
    return adjusted;
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
    GOAL_FACTOR: GOAL_FACTOR,
    RUN_DAYS_DEFAULT: RUN_DAYS_DEFAULT,
    LONG_RUN_SHARE: LONG_RUN_SHARE,
    STRENGTH_SESSIONS: STRENGTH_SESSIONS,
    INCREASE_PCT: INCREASE_PCT,
    CUTBACK_PCT: CUTBACK_PCT,
    CUTBACK_INTERVAL: CUTBACK_INTERVAL,
    TERRAIN_LABEL: TERRAIN_LABEL,
    RACE_LABEL: RACE_LABEL,
    QUALITY_POOL: QUALITY_POOL,
    parseDate: parseDate,
    dateToISO: dateToISO,
    dateForSlot: dateForSlot,
    findCurrentWeekIdx: findCurrentWeekIdx,
    classifyUser: classifyUser,
    evaluateSafety: evaluateSafety,
    choosePlanLength: choosePlanLength,
    startRunDaysFor: startRunDaysFor,
    runDaysForWeek: runDaysForWeek,
    assignWeekTemplate: assignWeekTemplate,
    assignPhases: assignPhases,
    computeWeeklyVolumes: computeWeeklyVolumes,
    terrainNoteFrom: terrainNoteFrom,
    applyMissedAdjustment: applyMissedAdjustment,
    applyDifficultyAdjustment: applyDifficultyAdjustment,
    buildStructuredWeeks: buildStructuredWeeks,
    applyUnavailableRanges: applyUnavailableRanges,
    generatePlan: generatePlan,
    RUN_WALK_STAGES: RUN_WALK_STAGES,
    runWalkWeeksFor: runWalkWeeksFor,
    runWalkStageForWeek: runWalkStageForWeek,
    buildRunWalkSession: buildRunWalkSession,
    formatRunWalkLabel: formatRunWalkLabel
  };
});

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

  // docs/COACHING_SPEC.md "PR/aggressive evidence" -- a PR or aggressive-PR
  // goal without any recent race result to calibrate against is really just
  // an ambitious "finish" goal wearing a bigger multiplier. Capped at the
  // 'improve' factor instead when there's no real evidence behind it --
  // advisory (a warning, not a block), so the goal choice itself is never
  // refused, matching this pass's "warn, don't gate" decisions elsewhere.
  function hasRecentRaceEvidence(profile) {
    return !!(profile.recentRaceDistance && profile.recentRaceDistance !== 'none' && profile.recentRaceTime);
  }
  function effectiveGoalFactor(raceGoal, profile) {
    var factor = GOAL_FACTOR[raceGoal.goal] || 1.0;
    if ((raceGoal.goal === 'pr' || raceGoal.goal === 'aggressive') && !hasRecentRaceEvidence(profile)) {
      return Math.min(factor, GOAL_FACTOR.improve);
    }
    return factor;
  }
  var RUN_DAYS_DEFAULT = { beginner: 3, novice: 3, intermediate: 5, advanced: 6 };
  var LONG_RUN_SHARE = { '5k': 0.32, '10k': 0.30, half: 0.30, marathon: 0.28, '50k': 0.35, '50mi': 0.38, '100k': 0.38, '100mi': 0.40 };
  var STRENGTH_SESSIONS = { base: 2, build: 2, peak: 1, taper: 0, race: 0 };
  var INCREASE_PCT = { beginner: 0.04, novice: 0.06, intermediate: 0.08, advanced: 0.10 };
  var CUTBACK_PCT = { beginner: 0.20, novice: 0.17, intermediate: 0.15, advanced: 0.12 };
  var CUTBACK_INTERVAL = { beginner: 3, novice: 3, intermediate: 4, advanced: 4 };
  var TERRAIN_LABEL = { road: 'Road', trail: 'Trail', hills: 'Hills', mountain: 'Mountain', treadmill: 'Treadmill' };
  var RACE_LABEL = { '5k': '5K Race', '10k': '10K Race', half: 'Half Marathon', marathon: 'Marathon', '50k': '50K', '50mi': '50 Mile', '100k': '100K', '100mi': '100 Mile' };
  var RUN_SLOT_PRIORITY = [1, 3, 5, 0, 2, 4]; // Tue, Thu, Sat, Mon, Wed, Fri (slot 6 = long, fixed)

  // docs/COACHING_SPEC.md "Quality workout consistency" -- each entry is now
  // { label, estimatedMinutes } instead of a bare string. estimatedMinutes
  // is a real (if approximate) session-time total mechanically built from
  // the entry's OWN stated structure (10 min warmup + reps x (work + jog
  // recovery) + 10 min cooldown for interval/tempo sessions; the ultra
  // events' entries are continuous long efforts/rehearsals, not interval
  // sessions, so they get a flat representative time instead of a
  // warmup/work/recovery/cooldown breakdown). This closes the gap where the
  // displayed distance used to be computed completely independently of what
  // the label actually described -- see formatQualityLabel below, which now
  // derives distance FROM this same number rather than a second, unrelated
  // guess. Own synthesis (same standing as RUN_WALK_STAGES elsewhere in this
  // file), not a lab-measured figure -- a reasonable, documented estimate.
  var QUALITY_POOL = {
    '5k': {
      entry: [{ label: 'Easy + 4-6 x 20 sec strides', estimatedMinutes: 30 }],
      trained: [
        { label: '6 x 400m @ 5K pace', estimatedMinutes: 10 + 6 * (2 + 2) + 10 },
        { label: '5 x 3 min @ 5K effort', estimatedMinutes: 10 + 5 * (3 + 3) + 10 },
        { label: '4 x 5 min @ 10K effort', estimatedMinutes: 10 + 4 * (5 + 3) + 10 },
        { label: 'Fartlek: 8 x 1 min hard / 1 min easy', estimatedMinutes: 10 + 8 * (1 + 1) + 10 }
      ]
    },
    '10k': {
      entry: [
        { label: 'Easy + strides', estimatedMinutes: 30 },
        { label: '20 min tempo, comfortably hard', estimatedMinutes: 10 + 20 + 10 }
      ],
      trained: [
        { label: 'Tempo: 25-30 min @ threshold', estimatedMinutes: 10 + 28 + 10 },
        { label: '5 x 1000m @ 10K pace', estimatedMinutes: 10 + 5 * (4 + 2) + 10 },
        { label: '6 x 800m @ 10K pace', estimatedMinutes: 10 + 6 * (3 + 2) + 10 },
        { label: 'Hills: 6 x 2 min uphill', estimatedMinutes: 10 + 6 * (2 + 2) + 10 }
      ]
    },
    half: {
      entry: [
        { label: 'Easy + strides', estimatedMinutes: 30 },
        { label: '15-20 min tempo', estimatedMinutes: 10 + 18 + 10 }
      ],
      trained: [
        { label: 'Tempo: 3 x 10 min @ threshold', estimatedMinutes: 10 + 3 * 10 + 2 * 3 + 10 },
        { label: '4-6 mi @ half-marathon pace', estimatedMinutes: 10 + 5 * 8 + 10 },
        { label: '5 x 1 mi @ 10K pace', estimatedMinutes: 10 + 5 * (7 + 2) + 10 }
      ]
    },
    marathon: {
      entry: [
        { label: 'Medium-long run', estimatedMinutes: 60 },
        { label: 'Easy + strides', estimatedMinutes: 30 }
      ],
      trained: [
        { label: '8 mi w/ 4 mi @ marathon pace', estimatedMinutes: 70 },
        { label: '2 x 4 mi @ marathon pace', estimatedMinutes: 10 + 2 * 34 + 3 + 10 },
        { label: 'Medium-long run', estimatedMinutes: 60 }
      ]
    },
    // Ultra events' pool entries are continuous long efforts or logistics
    // rehearsals, not interval/tempo sessions -- a flat representative
    // session time, not a warmup/work/recovery/cooldown breakdown.
    '50k': {
      entry: [{ label: 'Hill repeats: 5 x 3 min uphill', estimatedMinutes: 10 + 5 * (3 + 3) + 10 }, { label: 'Trail long run w/ climbing', estimatedMinutes: 120 }],
      trained: [{ label: 'Back-to-back long runs', estimatedMinutes: 100 }, { label: 'Long climb + descent conditioning', estimatedMinutes: 100 }]
    },
    '50mi': {
      entry: [{ label: 'Back-to-back long runs', estimatedMinutes: 110 }, { label: 'Time-on-feet long run', estimatedMinutes: 130 }],
      trained: [{ label: 'Back-to-back long runs', estimatedMinutes: 120 }, { label: 'Long climb + descent conditioning', estimatedMinutes: 110 }, { label: 'Night run rehearsal', estimatedMinutes: 90 }]
    },
    '100k': {
      entry: [{ label: 'Back-to-back long runs', estimatedMinutes: 110 }, { label: 'Time-on-feet long run', estimatedMinutes: 130 }],
      trained: [{ label: 'Back-to-back long runs', estimatedMinutes: 120 }, { label: 'Long climb + descent conditioning', estimatedMinutes: 110 }, { label: 'Night run rehearsal', estimatedMinutes: 90 }]
    },
    '100mi': {
      entry: [{ label: 'Back-to-back long runs', estimatedMinutes: 120 }, { label: 'Time-on-feet long run', estimatedMinutes: 150 }, { label: 'Gear + fueling rehearsal', estimatedMinutes: 90 }],
      trained: [{ label: 'Back-to-back long runs', estimatedMinutes: 130 }, { label: 'Night run rehearsal', estimatedMinutes: 100 }, { label: 'Downhill conditioning', estimatedMinutes: 90 }, { label: 'Gear + fueling rehearsal', estimatedMinutes: 90 }]
    }
  };
  // Deliberately generic -- not the runner's own actual pace, which isn't
  // reliably known without a recent race result to calibrate against (see
  // hasRecentRaceEvidence above). A consistent, documented basis for turning
  // a session's estimated time into an approximate distance, nothing more.
  var QUALITY_DEFAULT_PACE_MIN_PER_MI = 10;

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

  // docs/COACHING_SPEC.md "Recurring workouts" -- a recurring workout's `day`
  // is a real calendar weekday (Mon=0...Sun=6, matching app.js's DOW_SHORT
  // labels), NOT a slot index. Since dateForSlot anchors slot 6 to whatever
  // weekday the race itself falls on, slot 0 is only Monday when the race is
  // on a Sunday -- for any other race weekday, the slot each weekday lands on
  // shifts accordingly. This inverts dateForSlot's math to find which slot a
  // given weekday occupies for THIS plan's race date.
  function slotForFixedDay(raceDate, day) {
    var raceWeekdayMon0 = (raceDate.getDay() + 6) % 7;
    return ((day - raceWeekdayMon0 - 1) % 7 + 7) % 7;
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

  // docs/SAFETY_POLICY.md "Pain reporting" -- per-workout, transient symptom
  // triage. Never diagnoses -- only routes toward "keep going / back off /
  // get it checked," same three-level shape as before. Extracted here (was
  // previously app.js-only, untestable) specifically because a coaching
  // review found a real bug in the old positional-argument version: it only
  // went urgent when `worsens && !canWalk` together, so "can't walk
  // normally" alone (worsens:false) fell through to "mild, okay to
  // continue." Fixed below -- inability to walk normally, a form/gait
  // change, or suspected bone tenderness are now each independently
  // sufficient for urgent, matching how the AI coach's own (richer) chat
  // triage in netlify/functions/coach.js already treats them.
  //
  // `details`: { severity (1-10, required), worsens (bool, required),
  // canWalk (bool, required), onsetDuringRun, suddenOnset, formChange,
  // restPain, boneTenderness, swelling, recurrent -- all optional bools,
  // undefined/null is treated as "not reported" (never elevates guidance on
  // its own), so legacy pain reports saved before these fields existed still
  // evaluate correctly using just severity/worsens/canWalk.
  function painGuidance(details) {
    var d = details || {};
    var suddenDuringRun = !!(d.onsetDuringRun && d.suddenOnset);
    if (d.severity >= 7 || !d.canWalk || d.formChange || d.boneTenderness) {
      return { level: 'urgent', text: "This sounds like it needs a professional evaluation before you keep training. Consider resting from running until you've been checked out." };
    }
    if ((d.severity >= 4 && d.worsens) || d.swelling || d.recurrent || d.restPain || suddenDuringRun) {
      return { level: 'caution', text: "Consider replacing today's run with cross-training or rest, and keep an eye on it. If it's still there in a few days or gets worse, get it checked out." };
    }
    return { level: 'mild', text: 'Mild and not worsening — okay to continue cautiously, but back off if anything changes.' };
  }

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

  // The plan's eventual (steady-state) running-day count -- extracted so
  // app.js's finishWizard can run evaluateRecurringWorkoutSchedule against
  // the same real target buildStructuredWeeks itself will use, instead of
  // duplicating this formula.
  function targetRunDaysFor(profile, event, level) {
    return Math.min(profile.availableDays || RUN_DAYS_DEFAULT[level], RUN_DAYS_DEFAULT[level] + (event === '5k' || event === '10k' || event === 'half' || event === 'marathon' ? 0 : 1));
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

  // Shortest-to-longest, used only to search for a shorter alternative event
  // when the current one doesn't fit the runner's timeline/fitness.
  var EVENT_ORDER = ['5k', '10k', 'half', 'marathon', '50k', '50mi', '100k', '100mi'];

  // docs/COACHING_SPEC.md "Race readiness" -- mirrors computeWeeklyVolumes's
  // exact per-level growth rate/cutback pattern (INCREASE_PCT/CUTBACK_PCT/
  // CUTBACK_INTERVAL, same constants, not separately invented) to estimate
  // how many weeks it actually takes to ramp from a starting weekly mileage
  // to a target peak. Deliberately simplified versus the real plan generator
  // -- no phase/taper modeling -- since this is only a feasibility screen,
  // not a plan.
  // docs/COACHING_SPEC.md "Race readiness" -- how many weeks it takes to
  // safely grow a starting distance to a target distance using the
  // standard, well-established "10% rule" (a widely-used real-world
  // long-run progression heuristic, not a number invented for this app).
  // Deliberately NOT based on computeWeeklyVolumes's own weekly-volume ramp
  // (INCREASE_PCT/CUTBACK_PCT) -- hand-testing this while building it
  // surfaced that that ramp's cutback weeks don't reset the growth
  // baseline but the net rate is still slow enough that a realistic
  // beginner profile essentially never reaches EVENT_TABLE's nominal
  // peakVolume even across a full idealWeeks-length plan (a separate,
  // deeper finding, flagged to the user rather than silently patched here
  // since it's a much bigger change to the core ramp formula). The long
  // run specifically, using the 10% rule, is both the more standard
  // real-world readiness signal and avoids that dependency entirely.
  function weeksToGrowDistance(startDistance, targetDistance, weeklyGrowthRate) {
    var start = Math.max(startDistance || 0, 0.5); // avoid log(0)/divide-by-zero for a true zero starting point
    if (start >= targetDistance) return 0;
    return Math.ceil(Math.log(targetDistance / start) / Math.log(1 + weeklyGrowthRate));
  }

  var LONG_RUN_GROWTH_RATE = 0.10; // the standard "10% rule"

  // docs/COACHING_SPEC.md "Race readiness" -- a genuine minimum-readiness
  // check, not just evaluateSafety's calendar-length check (which never
  // reads the runner's own current longest run at all -- a true beginner
  // starting from 1 mile and one already running 8 miles pass the
  // identical weeksAvailable<minWeeks test today). Checks whether the
  // runner's OWN current long run can safely reach the event's expected
  // long-run peak in the time available. When infeasible, computes concrete
  // alternatives instead of a vague "consider a later date or shorter
  // distance" sentence. Deliberately advisory only, never a block -- the
  // runner decides what to do with the information, matching this pass's
  // "warn, don't gate" decision for injury status too.
  function evaluateReadiness(profile, raceGoal, level, weeksAvailable) {
    var event = raceGoal.event;
    var cfg = EVENT_TABLE[event][level];
    var startLongRun = profile.longestRun || 0;
    var neededWeeks = Math.max(cfg.minWeeks, weeksToGrowDistance(startLongRun, cfg.longRunPeak, LONG_RUN_GROWTH_RATE) + cfg.taperWeeks);
    if (weeksAvailable >= neededWeeks) return { ready: true, neededWeeks: neededWeeks, alternatives: null };

    var extraWeeksNeeded = neededWeeks - weeksAvailable;
    var shorterEvent = null;
    var idx = EVENT_ORDER.indexOf(event);
    for (var i = idx - 1; i >= 0; i--) {
      var candCfg = EVENT_TABLE[EVENT_ORDER[i]][level];
      var candNeeded = Math.max(candCfg.minWeeks, weeksToGrowDistance(startLongRun, candCfg.longRunPeak, LONG_RUN_GROWTH_RATE) + candCfg.taperWeeks);
      if (weeksAvailable >= candNeeded) { shorterEvent = EVENT_ORDER[i]; break; }
    }
    return { ready: false, neededWeeks: neededWeeks, alternatives: { extraWeeksNeeded: extraWeeksNeeded, shorterEvent: shorterEvent } };
  }

  function formatReadinessWarning(readiness, event) {
    if (!readiness || readiness.ready) return null;
    var parts = ['Based on your current weekly mileage, a fully safe ' + EVENT_LABEL[event] + ' build at your level would take about ' + readiness.neededWeeks + ' week' + (readiness.neededWeeks === 1 ? '' : 's') + ' -- this timeline is shorter than that, so the plan is more compressed than ideal.'];
    var extraWeeks = Math.ceil(readiness.alternatives.extraWeeksNeeded);
    parts.push('A race about ' + extraWeeks + ' more week' + (extraWeeks === 1 ? '' : 's') + ' out would give you a safer runway at this same distance.');
    if (readiness.alternatives.shorterEvent) {
      parts.push(EVENT_LABEL[readiness.alternatives.shorterEvent] + ' would comfortably fit your current timeline instead.');
    }
    parts.push("This plan still generates as requested -- these are just options worth considering, not a requirement.");
    return parts.join(' ');
  }

  function choosePlanLength(weeksAvailable, event, level) {
    var idealWeeks = EVENT_TABLE[event][level].idealWeeks;
    return Math.min(weeksAvailable, Math.round(idealWeeks * 1.6), 40);
  }

  // ── Recurring workouts / existing commitments (docs/COACHING_SPEC.md) ──
  // Two independent axes per activity type, deliberately kept separate:
  // `contribution` (aerobic/strength/mobility) is inherent to the activity,
  // independent of how hard the runner does it -- used only to avoid
  // double-crediting strength/aerobic work the runner already gets elsewhere.
  // `maxHardness` is the ceiling of how hard this activity type can
  // realistically get; combined with the runner's own reported `intensity`,
  // this (not `contribution`) is what decides `isHardDay`. Conflating the two
  // breaks real cases: an easy spin is aerobic-contributing but not a hard
  // day, while hot/power yoga is a hard day despite yoga's normally-gentle
  // nature. Provisional coaching judgment, not clinically reviewed --
  // documented as such in docs/COACHING_SPEC.md.
  var RECURRING_ACTIVITY_TYPES = ['cycling', 'yoga', 'strength', 'pilates', 'swimming', 'hiking', 'walking', 'hiit', 'sport', 'other'];
  // Same Mon=0...Sun=6 encoding as a recurring workout's `day` field (see
  // app.js's DOW_SHORT/DOW_CHIP_LABEL) -- full names here since these feed
  // full-sentence plan explanations, not compact chip labels.
  var DOW_LABEL = { 0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 4: 'Friday', 5: 'Saturday', 6: 'Sunday' };
  var RECURRING_ACTIVITY_LABEL = {
    cycling: 'Spinning / Cycling', yoga: 'Yoga', strength: 'Strength training', pilates: 'Pilates',
    swimming: 'Swimming', hiking: 'Hiking', walking: 'Walking', hiit: 'HIIT', sport: 'Recreational sport', other: 'Other'
  };
  var RECURRING_ACTIVITY_PROFILE = {
    cycling: { aerobic: 'high', strength: 'none', mobility: 'none', maxHardness: 'high' },
    yoga: { aerobic: 'none', strength: 'low', mobility: 'high', maxHardness: 'high' },
    strength: { aerobic: 'none', strength: 'high', mobility: 'low', maxHardness: 'high' },
    pilates: { aerobic: 'low', strength: 'moderate', mobility: 'high', maxHardness: 'moderate' },
    swimming: { aerobic: 'high', strength: 'low', mobility: 'none', maxHardness: 'high' },
    hiking: { aerobic: 'moderate', strength: 'low', mobility: 'none', maxHardness: 'moderate' },
    walking: { aerobic: 'low', strength: 'none', mobility: 'none', maxHardness: 'low' },
    hiit: { aerobic: 'high', strength: 'moderate', mobility: 'none', maxHardness: 'high' },
    sport: { aerobic: 'moderate', strength: 'low', mobility: 'none', maxHardness: 'high' },
    other: { aerobic: 'moderate', strength: 'low', mobility: 'low', maxHardness: 'moderate' } // unknown activity -- conservative default
  };

  function classifyRecurringWorkout(workout) {
    var profile = RECURRING_ACTIVITY_PROFILE[workout.activityType] || RECURRING_ACTIVITY_PROFILE.other;
    var isHardDay = workout.intensity === 'high' && profile.maxHardness !== 'low';
    return {
      aerobicContribution: profile.aerobic,
      strengthContribution: profile.strength,
      mobilityContribution: profile.mobility,
      isHardDay: isHardDay
    };
  }

  // Deterministic schedule-safety check (docs/COACHING_SPEC.md) -- warns
  // rather than silently overloading the runner, reusing the exact
  // planMeta.warnings mechanism evaluateSafety already populates.
  function evaluateRecurringWorkoutSchedule(recurringWorkouts, targetRunDays, raceDateIso) {
    var warnings = [];
    var list = recurringWorkouts || [];
    var fixedCount = list.filter(function (w) { return w.fixed && w.day != null; }).length;
    if (fixedCount + targetRunDays > 6) {
      warnings.push('Your fixed weekly workouts (' + fixedCount + ') plus your running days (' + targetRunDays + ') leave no room for a rest day. Consider making one of your fixed sessions movable, or reducing running days available.');
    }
    // slotForFixedDay needs a real race date to know which weekday slot 6
    // (the long run) falls on -- if it's not available yet (e.g. mid-wizard,
    // before a race date is chosen), skip this specific check rather than
    // guessing.
    var raceDate = raceDateIso ? parseDate(raceDateIso) : null;
    var onLongRunDay = raceDate ? list.filter(function (w) { return w.fixed && w.day != null && slotForFixedDay(raceDate, w.day) === 6; }) : [];
    if (onLongRunDay.length) {
      warnings.push('A fixed workout is scheduled on your long-run day. Cross-training can\'t replace the running-specific benefit of your long run, so this day still needs to be resolved manually.');
    }
    // Quality/speed-work slot conflict (docs/COACHING_SPEC.md "Recurring
    // workouts smart relocation") -- the quality slot is always slot 1
    // whenever a week has >=2 running days (see assignWeekTemplate's
    // RUN_SLOT_PRIORITY). buildStructuredWeeks relocates quality to a
    // different day automatically whenever that week has a spare easy slot
    // to move it to -- but at targetRunDays<=2, a week never has a spare
    // easy slot (only quality+rest+long exist), so relocation is never
    // possible there. A HARD fixed workout on that slot is a fine
    // substitution (no warning needed, see classifyRecurringWorkout), so
    // this only fires for a non-hard one.
    var nonHardFixedOnSpeedDaySlot = raceDate ? list.filter(function (w) {
      return w.fixed && w.day != null && slotForFixedDay(raceDate, w.day) === 1 && !classifyRecurringWorkout(w).isHardDay;
    }) : [];
    if (nonHardFixedOnSpeedDaySlot.length && targetRunDays <= 2) {
      warnings.push('A fixed workout falls on your plan\'s usual speed-work day, and your running frequency is low enough that there\'s no other day to move it to. Some weeks may not include a separate structured speed session.');
    }
    // Hard-day adjacency (docs/COACHING_SPEC.md "Hard-day spacing") -- a
    // fixed hard workout landing the day immediately before/after the long
    // run (slot 6) or the plan's own quality slot (always slot 1, same fact
    // slotForFixedDay's other checks rely on) risks stacking a demanding
    // effort right next to another one with no recovery buffer. Detected
    // and warned, not rescheduled -- a fixed workout's day can't be moved
    // by this app (it's fixed by definition), same reasoning as the
    // long-run-day conflict warning above.
    var adjacentHardFixed = raceDate ? list.filter(function (w) {
      if (!w.fixed || w.day == null || !classifyRecurringWorkout(w).isHardDay) return false;
      var slot = slotForFixedDay(raceDate, w.day);
      return slot === 5 || slot === 0 || slot === 2; // day before the long run, or either side of the quality slot
    }) : [];
    if (adjacentHardFixed.length) {
      warnings.push('A fixed hard workout falls right before or after your long run or speed-work day, with no rest day between them. Consider spacing it out if you can.');
    }
    // Weekly hard-day load (docs/COACHING_SPEC.md "Hard-day spacing") --
    // total hard days (recurring hard workouts + the plan's own quality
    // session) capped at 2/week. A static, plan-wide check rather than a
    // per-week simulation, since the inputs here don't vary week to week.
    var hardRecurringCount = list.filter(function (w) { return classifyRecurringWorkout(w).isHardDay; }).length;
    var likelyHasQuality = targetRunDays >= 2;
    if (hardRecurringCount + (likelyHasQuality ? 1 : 0) > 2) {
      warnings.push('Between your fixed hard workouts and the plan\'s own speed session, some weeks may have more than 2 genuinely hard days. Consider making one of your hard workouts easier or movable.');
    }
    return { warnings: warnings };
  }

  // docs/COACHING_SPEC.md "Plan Explanations" -- short, positive, specific
  // notes about how an existing commitment changed the plan, shown next to
  // the runner's recurring-workout list rather than buried in the schedule.
  // Deliberately plain language, no workload-scoring jargon. Static (not
  // simulated week-by-week) since every effect described here recurs
  // identically for the whole plan -- a fixed workout's real weekday maps to
  // the same slot in every week (the race date never changes mid-plan), so
  // one note per workout is accurate without walking the actual weeks array.
  function generateRecurringWorkoutNotes(recurringWorkouts, raceDateIso) {
    var list = recurringWorkouts || [];
    var raceDate = raceDateIso ? parseDate(raceDateIso) : null;
    var notes = [];
    list.forEach(function (w) {
      var c = classifyRecurringWorkout(w);
      // Plain activity name only (no duration) -- these are short prose
      // sentences, not the structured day-card label formatRecurringWorkoutLabel builds.
      var label = (w.activityType === 'other' || w.activityType === 'sport') && w.customName
        ? w.customName
        : RECURRING_ACTIVITY_LABEL[w.activityType] || RECURRING_ACTIVITY_LABEL.other;
      var dayLabel = w.fixed && w.day != null ? DOW_LABEL[w.day] : null;
      if (!w.fixed) {
        notes.push('Your ' + label + ' counts as this week\'s cross-training.');
        return;
      }
      if (raceDate == null || w.day == null) return;
      var slot = slotForFixedDay(raceDate, w.day);
      if (slot === 6) return; // already covered by the long-run-day warning, not a "positive" note
      if (slot === 1) {
        notes.push(c.isHardDay
          ? 'Your ' + dayLabel + ' ' + label + ' covers this week\'s hard session, so a separate speed workout isn\'t scheduled.'
          : 'Your speed session is scheduled on a different day this week to avoid overlapping with your fixed ' + dayLabel + ' ' + label + '.');
        return;
      }
      if (c.strengthContribution === 'moderate' || c.strengthContribution === 'high') {
        notes.push('Your ' + dayLabel + ' ' + label + ' fulfills this week\'s main strength session.');
      } else if (c.mobilityContribution === 'moderate' || c.mobilityContribution === 'high') {
        notes.push(dayLabel + ' ' + label + ' supports mobility and recovery.');
      } else {
        notes.push('Your ' + dayLabel + ' ' + label + ' counts as this week\'s cross-training.');
      }
    });
    return notes;
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

  // docs/COACHING_SPEC.md "Adjustment re-capping" -- neither applyMissedAdjustment's
  // dampening nor applyDifficultyAdjustment's RPE nudge previously re-checked
  // the result against ANY safety ceiling -- repeated +5% nudges across many
  // renders could compound indefinitely with no cap at all. Re-derives the
  // same event-level longRunPeak/safetyScale buildStructuredWeeks itself
  // uses. Known, disclosed simplification: doesn't replicate the tighter
  // base-phase longRunSafetyCap (profile.longestRun*1.15), since these
  // adjustment functions don't receive `profile` -- the event-level peak is
  // still a real, meaningful ceiling, just not the tightest one possible.
  function adjustmentCaps(raceGoal, planMeta) {
    var cfg = EVENT_TABLE[raceGoal.event] && EVENT_TABLE[raceGoal.event][planMeta.level];
    // Degrade gracefully (no cap, i.e. a no-op clamp) rather than throw when
    // called with a minimal/partial raceGoal-planMeta shape that doesn't
    // carry a real event/level -- callers that only care about the week-math
    // (not full plan-generation context) shouldn't be forced to fabricate one.
    if (!cfg) return { long: Infinity, easy: Infinity };
    var effectiveMinWeeks = Math.max(cfg.minWeeks, planMeta.neededWeeks || 0);
    var safetyScale = planMeta.unsafe ? Math.max(0.55, (planMeta.weeksAvailable || 0) / effectiveMinWeeks) : 1.0;
    var longRunPeakCap = cfg.longRunPeak * safetyScale;
    return { long: longRunPeakCap, easy: round5(longRunPeakCap * 0.85) };
  }
  function clampAdjustedMiles(day, caps) {
    if (day.type === 'long') day.miles = Math.min(day.miles, caps.long);
    else if (day.type === 'easy') day.miles = Math.min(day.miles, caps.easy);
  }

  // ── Adaptive layer: dampen future weeks if recent training was mostly missed ──
  function applyMissedAdjustment(weeks, raceGoal, planMeta, logs, today, terrainNote, units) {
    var raceDate = parseDate(raceGoal.raceDate);
    var planLengthWeeks = planMeta.planLengthWeeks;
    var caps = adjustmentCaps(raceGoal, planMeta);
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
      var entry = logs[key];
      if (entry) {
        // docs/COACHING_SPEC.md "Partial-session credit" -- a stopped-early
        // or partially-completed session is real evidence of SOME training
        // stimulus, but treating it identically to a fully completed one
        // would let a week of half-finished runs pass the 60% missed-ratio
        // threshold as if nothing were wrong. Half credit reflects that
        // without also treating it as a full miss.
        var credit = (entry.completionType === 'stopped_early' || entry.completionType === 'partial') ? 0.5 : 1;
        loggedCount += credit;
        if (day.type === 'long' && credit < 1) longRunMissed = true; // a stopped-early/partial long run still deserves next week's shortening, not silent full credit
      } else if (day.type === 'long') {
        longRunMissed = true;
      }
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
            clampAdjustedMiles(day, caps);
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
            clampAdjustedMiles(day, caps);
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
    var caps = adjustmentCaps(raceGoal, planMeta);
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
          clampAdjustedMiles(day, caps);
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
  function formatRecurringWorkoutLabel(workout) {
    var name = (workout.activityType === 'other' || workout.activityType === 'sport') && workout.customName
      ? workout.customName
      : RECURRING_ACTIVITY_LABEL[workout.activityType] || RECURRING_ACTIVITY_LABEL.other;
    return workout.durationMinutes + ' min ' + name;
  }

  function buildStructuredWeeks(profile, raceGoal, planMeta, units, recurringWorkouts) {
    var event = raceGoal.event;
    var level = planMeta.level;
    var cfg = EVENT_TABLE[event][level];
    var planLengthWeeks = planMeta.planLengthWeeks;
    // docs/COACHING_SPEC.md "Race readiness" -- planMeta.unsafe can now be
    // true for two different reasons (calendar too short, OR genuine
    // fitness-based readiness too short even with a technically-adequate
    // calendar -- see evaluateReadiness). The scale-down denominator has to
    // use whichever bar is actually stricter for THIS runner, or a
    // readiness-only "unsafe" would compute a ratio >=1 and silently apply
    // no scaling at all.
    var effectiveMinWeeks = Math.max(cfg.minWeeks, planMeta.neededWeeks || 0);
    var safetyScale = planMeta.unsafe ? Math.max(0.55, planMeta.weeksAvailable / effectiveMinWeeks) : 1.0;
    var goalFactor = effectiveGoalFactor(raceGoal, profile);

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
    var targetRunDays = targetRunDaysFor(profile, event, level);
    var startRunDays = startRunDaysFor(profile.runDaysPerWeek, targetRunDays);
    var wantCross = !(profile.crossOptions && profile.crossOptions.length === 1 && profile.crossOptions[0] === 'None');
    var qualityPool = QUALITY_POOL[event];
    var longRunSafetyCap = Math.max(profile.longestRun * 1.15, 2);
    var terrainNote = terrainNoteFrom(profile.terrains);

    // docs/COACHING_SPEC.md "Run-walk programming" -- only when the runner
    // explicitly said they can't yet run continuously. Spends roughly the
    // first 60% of the plan on a time-based run/walk progression, then falls
    // through to the normal continuous-mileage generation below unchanged,
    // so the runner arrives at race day already running continuously --
    // UNLESS they've explicitly opted to keep using run/walk intervals
    // through race day (profile.preferRunWalkThroughRace), in which case
    // the window spans the whole plan instead of just the first ~60%.
    // Continuous running is a default graduation, never a requirement.
    var useRunWalk = profile.canRunContinuously === false;
    var runWalkWeeks = useRunWalk ? (profile.preferRunWalkThroughRace ? planLengthWeeks : runWalkWeeksFor(planLengthWeeks)) : 0;

    // docs/COACHING_SPEC.md "Recurring workouts" -- existing commitments the
    // runner already does. `w.day` is a calendar weekday (Mon=0...Sun=6), not
    // a slot index -- slotForFixedDay converts it to this plan's actual slot
    // using the race date, since slot 6 (the long run) lands on whatever
    // weekday the race itself falls on, not always Sunday. Fixed workouts
    // whose slot is 6 are excluded here -- that's a real conflict, surfaced
    // as a warning (evaluateRecurringWorkoutSchedule), never silently
    // resolved by overriding the long run. Movable ones consume the plan's
    // own auto-generated cross-training slots instead of occupying a
    // specific day.
    var raceDate = parseDate(raceGoal.raceDate);
    var allRecurring = recurringWorkouts || [];
    var fixedWorkouts = allRecurring.filter(function (w) { return w.fixed && w.day != null && slotForFixedDay(raceDate, w.day) !== 6; });
    var movableWorkouts = allRecurring.filter(function (w) { return !w.fixed; });

    var weeks = [];
    for (var w = 1; w <= planLengthWeeks; w++) {
      var phase = phases[w - 1];
      var targetVolume = volumes[w - 1];
      var weekRunDays = runDaysForWeek(w, startRunDays, targetRunDays, 2);
      // docs/COACHING_SPEC.md "Long-run share cap" -- uncapped, this reaches
      // 45% of weekly volume for a 3-day/week 10K runner (0.30 base + 0.15
      // low-frequency bump), and could exceed 50% for ultra events whose own
      // baseline share is already high (e.g. 100mi's 0.40 + 0.15 = 0.55).
      // Capped at 50% regardless of event/frequency -- high, but still a
      // real ceiling, and ultra events legitimately run a higher baseline
      // share than road races.
      var longShare = Math.min(0.5, LONG_RUN_SHARE[event] + (weekRunDays <= 3 ? 0.15 : weekRunDays === 4 ? 0.05 : 0));
      var template = assignWeekTemplate(weekRunDays, wantCross);

      // Existing-commitments quality-slot conflict, "make it smart" per the
      // product decision in docs/COACHING_SPEC.md -- the quality/speed slot
      // is structurally always slot 1 whenever a week has >=2 running days
      // (RUN_SLOT_PRIORITY's first entry), so a fixed workout landing there
      // isn't a one-off fluke, it recurs every such week for the whole plan.
      // A HARD fixed workout there is a fine substitution for that week's
      // hard-day role -- handled by the existing demotion guard just below,
      // no relocation needed. A non-hard one (easy spin, gentle yoga) would
      // otherwise silently and permanently erase structured speed work for
      // the entire plan, so if this week's template has a spare 'easy'
      // slot, swap the two labels (one deterministic swap, not a general
      // optimizer) so quality moves to a different day instead of just
      // disappearing. If there's no spare 'easy' slot this week (only
      // possible at very low run-day counts), there's nowhere to move it --
      // evaluateRecurringWorkoutSchedule surfaces that as an explicit
      // warning rather than solving it here.
      var qualitySlotIdx = template.indexOf('quality');
      if (qualitySlotIdx !== -1) {
        var conflictingEasyFixed = fixedWorkouts.filter(function (fw) {
          return slotForFixedDay(raceDate, fw.day) === qualitySlotIdx && !classifyRecurringWorkout(fw).isHardDay;
        })[0];
        if (conflictingEasyFixed) {
          var altEasyIdx = template.indexOf('easy');
          if (altEasyIdx !== -1) {
            template[qualitySlotIdx] = 'easy';
            template[altEasyIdx] = 'quality';
            qualitySlotIdx = altEasyIdx;
          }
        }
      }

      // Hard-day stacking guard: if a fixed workout this week is classified
      // hard, don't also add the plan's own quality/interval session --
      // checked against qualitySlotIdx as of the relocation above (before
      // fixed-workout slot overrides below), so it correctly covers both a
      // hard fixed workout landing on a different day than quality (real
      // stacking, avoided by demoting quality to easy) and landing on the
      // same day as quality (the demotion is moot there since the
      // fixed-workout override below replaces that slot anyway -- either
      // way, no doubling).
      var hasFixedHardWorkoutThisWeek = fixedWorkouts.some(function (w) { return classifyRecurringWorkout(w).isHardDay; });
      if (qualitySlotIdx !== -1 && hasFixedHardWorkoutThisWeek) template[qualitySlotIdx] = 'easy';

      // Fixed workouts override their designated weekday's slot (never slot 6 --
      // filtered out of fixedWorkouts already).
      fixedWorkouts.forEach(function (w) { template[slotForFixedDay(raceDate, w.day)] = 'recurring'; });

      // Strength double-credit guard: reduce this week's auto "+ Strength"
      // budget by however many recurring workouts (fixed, always placed; and
      // movable, only the ones that will actually fit this week's remaining
      // cross-slot capacity) already provide real strength contribution --
      // computed up front, before the day loop, so the reduction applies
      // regardless of slot iteration order.
      var crossSlotCount = template.filter(function (t) { return t === 'cross'; }).length;
      var placedMovable = movableWorkouts.slice(0, crossSlotCount);
      var recurringStrengthCount = fixedWorkouts.concat(placedMovable).filter(function (w) {
        var c = classifyRecurringWorkout(w);
        return c.strengthContribution === 'moderate' || c.strengthContribution === 'high';
      }).length;
      var movableIdx = 0;

      var inRunWalkWindow = useRunWalk && phase !== 'race' && w <= runWalkWeeks;
      var runWalkStage = inRunWalkWindow ? runWalkStageForWeek(w, runWalkWeeks) : null;
      var isEntry = (level === 'beginner') || (level === 'novice' && phase === 'base');
      var pool = isEntry ? qualityPool.entry : qualityPool.trained;
      var qualityEntry = pool[(w - 1) % pool.length];
      var strengthBudget = Math.max(0, (STRENGTH_SESSIONS[phase] != null ? STRENGTH_SESSIONS[phase] : 1) - recurringStrengthCount);

      var days = [];
      var longRunCap = phase === 'base' ? Math.min(longRunPeak, longRunSafetyCap) : longRunPeak;
      var longRunMiles = phase === 'race' ? 0 : round5(Math.min(longRunCap, targetVolume * longShare));
      // docs/COACHING_SPEC.md "Quality workout consistency" -- derived from
      // this specific entry's own estimatedMinutes (via a documented,
      // generic pace assumption) instead of an unrelated volume-budget
      // guess, then still capped against the week's own volume budget so a
      // long structured session never exceeds what the week can safely
      // hold ("reject or adjust workouts whose components cannot fit within
      // the assigned session budget").
      var qualityMiles = (phase === 'base' || phase === 'race') ? 0 : round5(Math.min(qualityEntry.estimatedMinutes / QUALITY_DEFAULT_PACE_MIN_PER_MI, targetVolume * 0.18, 8));
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
        } else if (phase === 'race' && slot === 4 && level !== 'beginner') {
          // docs/COACHING_SPEC.md "Race-week shakeout" -- a short, easy
          // shakeout run 2 days before race day is standard practice for
          // most runners, instead of automatically prescribing only rest
          // and the race. Reserved for novice+ -- a true beginner's race
          // week stays simple rest, matching this project's existing
          // conservative bias for that level elsewhere (e.g. INJURY_CAP).
          day.type = 'easy';
          day.miles = round5(Math.min(2, targetVolume * 0.5));
          day.label = formatEasyRunLabel(day.miles, units) + ' (shakeout)';
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
            // docs/COACHING_SPEC.md "Quality workout consistency" --
            // qualityMiles is now derived from this same entry's own
            // estimatedMinutes (see where it's computed above), so the
            // label and the distance describe the same session instead of
            // two independently-computed guesses.
            day.miles = qualityMiles;
            day.label = qualityMiles > 0 ? qualityEntry.label + ' (~' + toUnit(qualityMiles, units) + ' ' + unitLabel(units) + ' total, incl. warm-up/cool-down)' : qualityEntry.label;
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
        } else if (tok === 'recurring') {
          var fixedWorkoutHere = fixedWorkouts.filter(function (w) { return slotForFixedDay(raceDate, w.day) === slot; })[0];
          day.type = 'cross';
          day.label = formatRecurringWorkoutLabel(fixedWorkoutHere);
          day.recurringWorkout = { id: fixedWorkoutHere.id, activityType: fixedWorkoutHere.activityType, fixed: true };
        } else if (tok === 'cross') {
          var movableWorkoutHere = movableIdx < placedMovable.length ? placedMovable[movableIdx] : null;
          if (movableWorkoutHere) {
            movableIdx++;
            day.type = 'cross';
            day.label = formatRecurringWorkoutLabel(movableWorkoutHere);
            day.recurringWorkout = { id: movableWorkoutHere.id, activityType: movableWorkoutHere.activityType, fixed: false };
          } else {
            var addStrength = strengthAssigned < strengthBudget;
            if (addStrength) strengthAssigned++;
            day.type = 'cross';
            day.label = (30 + Math.min(30, Math.round(targetVolume))) + ' min cross' + (crossPref !== 'Cross-train' ? ' · ' + crossPref : '') + (addStrength ? ' + Strength' : '');
          }
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
  function applyUnavailableRanges(weeks, raceGoal, planMeta, ranges, units, terrainNote) {
    if (!ranges || !ranges.length) return weeks;
    var raceDate = parseDate(raceGoal.raceDate);
    var planLengthWeeks = planMeta.planLengthWeeks;
    var allDays = [];
    weeks.forEach(function (wk) {
      wk.days.forEach(function (day, di) {
        var iso = dateToISO(dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di));
        if (day.type !== 'race') {
          var hit = ranges.filter(function (r) { return iso >= r.start && iso <= r.end; })[0];
          if (hit) {
            day.type = 'rest';
            day.miles = 0;
            day.label = 'Rest — ' + (hit.reason === 'vacation' ? 'away' : 'illness');
          }
        }
        allDays.push({ day: day, iso: iso });
      });
    });

    // docs/COACHING_SPEC.md "Return-to-training ramp-back" -- a break of a
    // week or more gets a bounded, proportional easing-back period right
    // after it ends (only easy/long days, same scope applyDifficultyAdjustment
    // already uses -- never quality/cross/rest/race). Shorter gaps are left
    // alone: the existing missed-workout/RPE adjustments already handle
    // ordinary disruption, and not every missed day needs a special ramp.
    // `units`/`terrainNote` are optional (this function predates them) --
    // without them the miles still adjust correctly, just the label text
    // stays stale; every real call site (generatePlan) always supplies both.
    ranges.forEach(function (r) {
      var startD = parseDate(r.start), endD = parseDate(r.end);
      var breakDays = Math.round((endD - startD) / 86400000) + 1;
      if (breakDays < 7) return;
      var rampFactor = Math.max(0.6, 1 - breakDays / 60);
      var rampEndIso = dateToISO(new Date(endD.getTime() + 7 * 86400000));
      allDays.forEach(function (rec) {
        if (rec.iso <= r.end || rec.iso > rampEndIso) return;
        if (rec.day.type === 'easy' || rec.day.type === 'long') {
          rec.day.miles = round5(rec.day.miles * rampFactor);
          if (units) {
            rec.day.label = rec.day.type === 'long' ? formatLongRunLabel(rec.day.miles, terrainNote, units) : formatEasyRunLabel(rec.day.miles, units);
          }
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
  function generatePlan(profile, raceGoal, planMeta, logs, today, unavailable, units, recurringWorkouts) {
    var weeks = buildStructuredWeeks(profile, raceGoal, planMeta, units, recurringWorkouts);
    var terrainNote = terrainNoteFrom(profile.terrains);
    weeks = applyUnavailableRanges(weeks, raceGoal, planMeta, unavailable, units, terrainNote);
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
    slotForFixedDay: slotForFixedDay,
    findCurrentWeekIdx: findCurrentWeekIdx,
    painGuidance: painGuidance,
    classifyUser: classifyUser,
    evaluateSafety: evaluateSafety,
    evaluateReadiness: evaluateReadiness,
    hasRecentRaceEvidence: hasRecentRaceEvidence,
    effectiveGoalFactor: effectiveGoalFactor,
    weeksToGrowDistance: weeksToGrowDistance,
    formatReadinessWarning: formatReadinessWarning,
    choosePlanLength: choosePlanLength,
    RECURRING_ACTIVITY_TYPES: RECURRING_ACTIVITY_TYPES,
    RECURRING_ACTIVITY_LABEL: RECURRING_ACTIVITY_LABEL,
    RECURRING_ACTIVITY_PROFILE: RECURRING_ACTIVITY_PROFILE,
    classifyRecurringWorkout: classifyRecurringWorkout,
    evaluateRecurringWorkoutSchedule: evaluateRecurringWorkoutSchedule,
    generateRecurringWorkoutNotes: generateRecurringWorkoutNotes,
    formatRecurringWorkoutLabel: formatRecurringWorkoutLabel,
    startRunDaysFor: startRunDaysFor,
    runDaysForWeek: runDaysForWeek,
    targetRunDaysFor: targetRunDaysFor,
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

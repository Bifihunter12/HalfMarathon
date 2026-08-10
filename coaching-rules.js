(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZaeraCoachingRules = factory();
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
  // docs/COACHING_SPEC.md "Launch scope" -- 5K/10K/half are publicly
  // available without the beta flag; marathon and every ultra distance stay
  // gated until each is separately reviewed.
  var PUBLIC_EVENTS = ['5k', '10k', 'half'];
  function visibleEventsFor(allEvents, enableLongerDistances, currentEvent) {
    if (enableLongerDistances) return allEvents.slice();
    // The `|| e === currentEvent` clause keeps an existing longer-distance
    // plan's own event selectable when editing, even with the flag off, so
    // toggling it (or a fresh install that never enabled it) never strands
    // that plan -- its event stays visible until the runner picks a
    // different one.
    return allEvents.filter(function (e) { return PUBLIC_EVENTS.indexOf(e) !== -1 || e === currentEvent; });
  }

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
  // docs/COACHING_SPEC.md "Weekly availability" -- used instead of
  // RUN_SLOT_PRIORITY (unchanged, still the legacy default) whenever the
  // runner has stated explicit weekday availability. Same slot positions,
  // different preference: slot 5 (the day immediately before the long run
  // at slot 6) is deliberately LAST here rather than 3rd, protecting the
  // long run from avoidable hard-session stacking the day before it --
  // RUN_SLOT_PRIORITY's own 3rd-priority placement of slot 5 predates that
  // rule and stays as-is for the legacy path since changing it would alter
  // already-tested, already-shipped plan output for every existing user.
  var AVAILABILITY_AWARE_PRIORITY = [1, 3, 0, 2, 4, 5];

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
        // manualReps: the work itself (400m at a real pace) can't be timed
        // without inventing a pace, but the recovery between reps IS
        // legitimately time-prescribed regardless of how fast the interval
        // was run (a standard real-world prescription: "400m hard, then 2
        // min easy jog" -- the jog is timed on the clock either way). The
        // runner announces each rep, lets the runner mark it done manually,
        // then times the recovery automatically -- see
        // docs/WORKOUT_RUNNER_SPEC.md's approved guided-manual-advance mode.
        // recoverySec/warmupSec/cooldownSec mirror this entry's own
        // estimatedMinutes formula -- no new numbers invented.
        { label: '6 x 400m @ 5K pace', estimatedMinutes: 10 + 6 * (2 + 2) + 10, manualReps: { warmupSec: 600, cooldownSec: 600, reps: 6, recoverySec: 120 } },
        // segments: workout-runner.js's normalizer consumes this to run the
        // session automatically (docs/WORKOUT_RUNNER_SPEC.md Phase 1) -- only
        // added to entries whose reps are already stated in TIME. Distance-
        // based entries (400m/800m/1000m/1mi reps, above/below) deliberately
        // have no segments field: turning them into timed intervals would
        // require inventing a pace, which this app has always refused to do
        // (see QUALITY_DEFAULT_PACE_MIN_PER_MI's own comment) -- they get
        // manualReps instead (see above). warmupSec/cooldownSec/reps/
        // workSec/recoverySec mirror the exact numbers already baked into
        // this entry's own estimatedMinutes formula -- no new numbers invented.
        { label: '5 x 3 min @ 5K effort', estimatedMinutes: 10 + 5 * (3 + 3) + 10, segments: { warmupSec: 600, cooldownSec: 600, reps: 5, workSec: 180, recoverySec: 180 } },
        { label: '4 x 5 min @ 10K effort', estimatedMinutes: 10 + 4 * (5 + 3) + 10, segments: { warmupSec: 600, cooldownSec: 600, reps: 4, workSec: 300, recoverySec: 180 } },
        { label: 'Fartlek: 8 x 1 min hard / 1 min easy', estimatedMinutes: 10 + 8 * (1 + 1) + 10, segments: { warmupSec: 600, cooldownSec: 600, reps: 8, workSec: 60, recoverySec: 60 } }
      ]
    },
    '10k': {
      entry: [
        { label: 'Easy + strides', estimatedMinutes: 30 },
        // A single continuous work block is modeled as reps:1, recoverySec:0
        // -- the normalizer treats reps===1 as one continuous segment (no
        // "interval N of M" cue), not a 1-rep interval set.
        { label: '20 min tempo, comfortably hard', estimatedMinutes: 10 + 20 + 10, segments: { warmupSec: 600, cooldownSec: 600, reps: 1, workSec: 1200, recoverySec: 0 } }
      ],
      trained: [
        { label: 'Tempo: 25-30 min @ threshold', estimatedMinutes: 10 + 28 + 10, segments: { warmupSec: 600, cooldownSec: 600, reps: 1, workSec: 1680, recoverySec: 0 } },
        { label: '5 x 1000m @ 10K pace', estimatedMinutes: 10 + 5 * (4 + 2) + 10, manualReps: { warmupSec: 600, cooldownSec: 600, reps: 5, recoverySec: 120 } },
        { label: '6 x 800m @ 10K pace', estimatedMinutes: 10 + 6 * (3 + 2) + 10, manualReps: { warmupSec: 600, cooldownSec: 600, reps: 6, recoverySec: 120 } },
        { label: 'Hills: 6 x 2 min uphill', estimatedMinutes: 10 + 6 * (2 + 2) + 10, segments: { warmupSec: 600, cooldownSec: 600, reps: 6, workSec: 120, recoverySec: 120 } }
      ]
    },
    half: {
      entry: [
        { label: 'Easy + strides', estimatedMinutes: 30 },
        { label: '15-20 min tempo', estimatedMinutes: 10 + 18 + 10, segments: { warmupSec: 600, cooldownSec: 600, reps: 1, workSec: 1080, recoverySec: 0 } }
      ],
      trained: [
        { label: 'Tempo: 3 x 10 min @ threshold', estimatedMinutes: 10 + 3 * 10 + 2 * 3 + 10, segments: { warmupSec: 600, cooldownSec: 600, reps: 3, workSec: 600, recoverySec: 120 } },
        // "4-6 mi @ half-marathon pace" is one continuous distance block, not
        // discrete reps -- no manualReps (guided single-block, same as a
        // continuous easy/long run), unlike the genuinely rep-based entries.
        { label: '4-6 mi @ half-marathon pace', estimatedMinutes: 10 + 5 * 8 + 10 },
        { label: '5 x 1 mi @ 10K pace', estimatedMinutes: 10 + 5 * (7 + 2) + 10, manualReps: { warmupSec: 600, cooldownSec: 600, reps: 5, recoverySec: 120 } }
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

  // Every mileage figure the plan generator produces flows through this
  // function before it's ever shown to a runner, so it's the one place that
  // can guarantee a bad upstream number (NaN from an unparsed/omitted
  // profile field, e.g. when a plan is seeded directly rather than built via
  // the guarded onboarding form) never surfaces as a literal "NaN mi" label
  // -- clamp to 0 instead of ever propagating NaN into a day's distance.
  function round5(n) { return isFinite(n) ? Math.round(n * 2) / 2 : 0; }

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
    // Wording fix: this estimate is driven by profile.longestRun (via the
    // 10% rule), never weekly mileage -- the text previously claimed
    // otherwise, misdescribing which input actually produced the number.
    var parts = ['Based on your current longest run, a fully safe ' + EVENT_LABEL[event] + ' build at your level would take about ' + readiness.neededWeeks + ' week' + (readiness.neededWeeks === 1 ? '' : 's') + ' -- this timeline is shorter than that, so the plan is more compressed than ideal.'];
    var extraWeeks = Math.ceil(readiness.alternatives.extraWeeksNeeded);
    parts.push('A race about ' + extraWeeks + ' more week' + (extraWeeks === 1 ? '' : 's') + ' out would give you a safer runway at this same distance.');
    if (readiness.alternatives.shorterEvent) {
      parts.push(EVENT_LABEL[readiness.alternatives.shorterEvent] + ' would comfortably fit your current timeline instead.');
    }
    parts.push("This plan still generates as requested -- these are just options worth considering, not a requirement.");
    return parts.join(' ');
  }

  // docs/COACHING_SPEC.md "Race readiness" -- evaluateReadiness (above) is a
  // PRE-generation estimate: it asks whether the runner's current long run
  // could theoretically grow to the event's long-run peak using the 10%
  // rule, in the time available. It never looks at what buildStructuredWeeks
  // actually produces, and that real weekly-volume ramp grows slower than
  // the 10%-rule estimate assumes (see weeksToGrowDistance's comment) -- so
  // a runner can be told "ready: true" and still be handed a plan whose
  // actual peak volume and long run fall well short of EVENT_TABLE's own
  // targets, silently, with no warning at all. This is the gap a prior
  // review flagged as the central unresolved issue in this feature.
  //
  // evaluatePlanAdequacy closes it by inspecting the ACTUAL generated weeks
  // (post buildStructuredWeeks/generatePlan) instead of a projection of what
  // could theoretically happen. Tolerance (85% of nominal peakVolume/
  // longRunPeak) is a coaching judgment call, not clinically reviewed: a
  // plan landing close to but not exactly at its nominal peak (rounding, a
  // taper phase, a slightly-early plan end) shouldn't itself be flagged --
  // only a material shortfall should. Frequency (actualPeakRunDays vs.
  // targetRunDaysFor) is reported but deliberately NOT part of the
  // adequate/inadequate verdict -- a fixed recurring workout can legitimately
  // occupy what would otherwise be a running slot (see "Recurring workouts"),
  // so a lower running-day count doesn't by itself signal an inadequate
  // plan the way a shortfall in volume or long run does.
  //
  // A runner who opted into run/walk through race day
  // (profile.preferRunWalkThroughRace) never has a continuous-mileage long
  // run to measure at all -- an intentional, separately-disclosed choice
  // (see "Run-walk programming"), not a plan defect -- so the long-run
  // portion of the check is skipped (longRunApplicable: false) rather than
  // always failing it; the volume check still applies.
  var PLAN_ADEQUACY_TOLERANCE = 0.85;

  function evaluatePlanAdequacy(weeks, raceGoal, planMeta, profile) {
    var event = raceGoal.event;
    var level = planMeta.level;
    var cfg = EVENT_TABLE[event][level];
    var targetRunDays = targetRunDaysFor(profile, event, level);

    var actualPeakVolume = 0, actualPeakLongRun = 0, actualPeakRunDays = 0;
    var anyContinuousLongRun = false;
    weeks.forEach(function (wk) {
      if (wk.phase === 'race') return; // taper/race week is intentionally reduced, not a peak
      if (wk.targetVolume > actualPeakVolume) actualPeakVolume = wk.targetVolume;
      var runDaysThisWeek = 0;
      wk.days.forEach(function (day) {
        if (day.type === 'long' || day.type === 'quality' || day.type === 'easy') runDaysThisWeek++;
        if (day.type === 'long' && !day.runWalk) {
          anyContinuousLongRun = true;
          if (day.miles > actualPeakLongRun) actualPeakLongRun = day.miles;
        }
      });
      if (runDaysThisWeek > actualPeakRunDays) actualPeakRunDays = runDaysThisWeek;
    });

    var volumeRatio = cfg.peakVolume > 0 ? actualPeakVolume / cfg.peakVolume : 1;
    var longRunRatio = anyContinuousLongRun && cfg.longRunPeak > 0 ? actualPeakLongRun / cfg.longRunPeak : 1;
    var adequate = volumeRatio >= PLAN_ADEQUACY_TOLERANCE && longRunRatio >= PLAN_ADEQUACY_TOLERANCE;

    return {
      adequate: adequate,
      actualPeakVolume: round5(actualPeakVolume),
      targetPeakVolume: cfg.peakVolume,
      actualPeakLongRun: round5(actualPeakLongRun),
      targetLongRunPeak: cfg.longRunPeak,
      actualPeakRunDays: actualPeakRunDays,
      targetRunDays: targetRunDays,
      longRunApplicable: anyContinuousLongRun
    };
  }

  function formatPlanAdequacyWarning(adequacy, event) {
    if (!adequacy || adequacy.adequate) return null;
    var parts = ["This plan's actual peak -- " + adequacy.actualPeakVolume + ' mi/week' +
      (adequacy.longRunApplicable ? ' with a ' + adequacy.actualPeakLongRun + '-mi long run' : '') +
      ' -- falls short of the ' + adequacy.targetPeakVolume + ' mi/week' +
      (adequacy.longRunApplicable ? ' and ' + adequacy.targetLongRunPeak + '-mi long run' : '') +
      ' a ' + EVENT_LABEL[event] + ' build at your level is designed around, given your current fitness and timeline.'];
    parts.push('This is a genuine gap between what this plan actually reaches and what the event calls for -- not just a compressed-but-adequate build. More weeks before race day, or a shorter-distance goal, would let the plan actually reach an adequate peak instead of stopping short of it.');
    parts.push('This plan still generates as requested -- this is information worth weighing, not a requirement.');
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
  // 'tabata'/'circuit'/'twelveThreeThirty' added (docs/COACHING_SPEC.md
  // "Constraint-aware scheduling") -- the original 10 types didn't cover the
  // low-sweat/high-intensity workday vocabulary a constraint-aware schedule
  // needs (a 12-3-30 treadmill session vs. a Tabata circuit are physiologically
  // very different, and conflating either with 'walking'/'hiit' produced
  // wrong load classifications).
  var RECURRING_ACTIVITY_TYPES = ['cycling', 'yoga', 'strength', 'pilates', 'swimming', 'hiking', 'walking', 'hiit', 'tabata', 'circuit', 'twelveThreeThirty', 'sport', 'other'];
  // Same Mon=0...Sun=6 encoding as a recurring workout's `day` field (see
  // app.js's DOW_SHORT/DOW_CHIP_LABEL) -- full names here since these feed
  // full-sentence plan explanations, not compact chip labels.
  var DOW_LABEL = { 0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 4: 'Friday', 5: 'Saturday', 6: 'Sunday' };
  var RECURRING_ACTIVITY_LABEL = {
    cycling: 'Spinning / Cycling', yoga: 'Yoga', strength: 'Strength training', pilates: 'Pilates',
    swimming: 'Swimming', hiking: 'Hiking', walking: 'Walking', hiit: 'HIIT', tabata: 'Tabata', circuit: 'Circuit training',
    twelveThreeThirty: '12-3-30', sport: 'Recreational sport', other: 'Other'
  };
  // `defaultReplaces` ('easy'|'cross'|'recovery'|'none') -- which planned
  // session TYPE this activity can stand in for when it's the runner's own
  // instance-level `replaces` field isn't set (old records, or a new one
  // left at its default). Matches the training-load rules this pass
  // documents: 12-3-30 and hiking are real aerobic work that can cover an
  // easy/recovery slot; Tabata/circuit/strength are their own load, not a
  // substitute for running-specific work, so they default to 'none' (pure
  // addition, never a replacement).
  var RECURRING_ACTIVITY_PROFILE = {
    cycling: { aerobic: 'high', strength: 'none', mobility: 'none', maxHardness: 'high', defaultReplaces: 'cross' },
    yoga: { aerobic: 'none', strength: 'low', mobility: 'high', maxHardness: 'high', defaultReplaces: 'none' },
    strength: { aerobic: 'none', strength: 'high', mobility: 'low', maxHardness: 'high', defaultReplaces: 'none' },
    pilates: { aerobic: 'low', strength: 'moderate', mobility: 'high', maxHardness: 'moderate', defaultReplaces: 'none' },
    swimming: { aerobic: 'high', strength: 'low', mobility: 'none', maxHardness: 'high', defaultReplaces: 'cross' },
    hiking: { aerobic: 'moderate', strength: 'low', mobility: 'none', maxHardness: 'moderate', defaultReplaces: 'easy' },
    walking: { aerobic: 'low', strength: 'none', mobility: 'none', maxHardness: 'low', defaultReplaces: 'recovery' },
    hiit: { aerobic: 'high', strength: 'moderate', mobility: 'none', maxHardness: 'high', defaultReplaces: 'none' },
    // Tabata is always treated as high intensity regardless of the runner's
    // own self-reported `intensity` field -- the spec explicitly names this
    // categorically ("Tabata counts as high intensity"), unlike every other
    // type here where intensity is self-reported and maxHardness is only a
    // ceiling on how hard that TYPE can get.
    tabata: { aerobic: 'high', strength: 'moderate', mobility: 'none', maxHardness: 'high', alwaysHard: true, defaultReplaces: 'none' },
    // Circuit training contributes real strength/fatigue load (per spec)
    // without being categorically "always hard" the way Tabata is -- still
    // driven by the runner's own reported intensity, same as cycling/hiit.
    circuit: { aerobic: 'low', strength: 'high', mobility: 'low', maxHardness: 'moderate', defaultReplaces: 'none' },
    // "12-3-30" (12% incline, 3 mph, 30 min) -- low-impact aerobic work, not
    // a rest day, but gentle enough that it's never a hard day and can
    // stand in for an easy run or cross-training session (per spec: "may
    // replace certain easy aerobic or cross-training sessions").
    twelveThreeThirty: { aerobic: 'moderate', strength: 'low', mobility: 'none', maxHardness: 'low', defaultReplaces: 'easy' },
    sport: { aerobic: 'moderate', strength: 'low', mobility: 'none', maxHardness: 'high', defaultReplaces: 'none' },
    other: { aerobic: 'moderate', strength: 'low', mobility: 'low', maxHardness: 'moderate', defaultReplaces: 'none' } // unknown activity -- conservative default
  };

  // docs/COACHING_SPEC.md "Constraint-aware scheduling" -- safe-default
  // normalizer for a recurring-workout record, applied at READ time (never
  // mutates/migrates stored data) so old records saved before these fields
  // existed keep working unchanged: a record with no `status` derives it
  // from the legacy boolean `fixed` (true -> 'fixed', false -> 'optional');
  // `replaces` falls back to the activity type's own defaultReplaces;
  // `recurrence` defaults to 'weekly' (i.e. every week, matching every
  // record's only possible prior behavior); `environment` defaults to null
  // (unknown/unspecified).
  function normalizeRecurringWorkout(w) {
    var profile = RECURRING_ACTIVITY_PROFILE[w.activityType] || RECURRING_ACTIVITY_PROFILE.other;
    return {
      id: w.id, activityType: w.activityType, customName: w.customName, day: w.day,
      durationMinutes: w.durationMinutes, intensity: w.intensity,
      fixed: !!w.fixed,
      status: w.status || (w.fixed ? 'fixed' : 'optional'),
      recurrence: w.recurrence || 'weekly',
      recurrenceAnchorIso: w.recurrenceAnchorIso || null,
      replaces: w.replaces || profile.defaultReplaces || 'none',
      environment: w.environment || null,
      // docs/COACHING_SPEC.md "Recurring activities" -- 'morning'|'midday'|
      // 'evening'|'flexible'|null (unset, the only possible value for any
      // record saved before this field existed). A fixed workout with no
      // stated window is treated as potentially conflicting with a morning
      // run -- the same "occupies the whole day" behavior every existing
      // record already has -- so old data's plan output is byte-identical.
      // Only an EXPLICIT non-morning window (midday/evening) lets a fixed
      // workout coexist with a same-day morning run instead of replacing it.
      timeWindow: w.timeWindow || null,
      // docs/COACHING_SPEC.md "Weekend hikes" -- only meaningful when
      // activityType==='hiking'; null/low defaults for every record that
      // predates these fields (a hike with no stated terrain/elevation is
      // treated as the least-demanding case, never assumed to be strenuous).
      terrainDifficulty: w.terrainDifficulty || 'easy', // 'easy'|'moderate'|'hard'
      elevationGainFt: w.elevationGainFt || 0,
      distanceMiles: w.distanceMiles || null,
      // docs/COACHING_SPEC.md "12-3-20 and 12-3-30" -- only meaningful when
      // activityType==='twelveThreeThirty'; falls back to the classic
      // 12-3-30 parameters (12% incline, 3 mph, 30 min) for any record that
      // predates named templates, which is exactly what this app already
      // assumed implicitly before this field existed.
      inclineWalk: w.inclineWalk || { template: '12-3-30', inclinePct: 12, speedMph: 3, durationMinutes: w.durationMinutes || 30 }
    };
  }

  // Whether an alternating-recurrence workout is active for the week whose
  // first day (slot 0) is `weekStartDate` -- a plain weekly workout is
  // always active. Alternates every 7 days from `recurrenceAnchorIso`
  // (defaults to `weekStartDate` itself if no anchor was ever set, meaning
  // "active starting the first week the plan generates," a safe default for
  // a record that predates this field). The week CONTAINING the anchor date
  // counts as the first "on" week.
  // `planStartDate` (this plan's own week-1 slot-0 date, from
  // buildStructuredWeeks) is the fallback anchor when the workout has none
  // of its own -- NOT `weekStartDate` (the week currently being evaluated).
  // Using the current week as its own anchor would make weeksSinceAnchor
  // always 0 (every week "active"), silently defeating alternation
  // entirely. Using the runner's raw typed start-date input (what an
  // earlier version of this did) is also wrong: `dateForSlot` anchors
  // backward from the race date, so a plan's real week-1 can land a few
  // days before or after whatever the runner literally typed, and that
  // mismatch flips week 1's parity unpredictably. Anchoring to
  // buildStructuredWeeks's own computed week-1 date guarantees week 1 is
  // always the "on" week for a no-anchor alternating workout, regardless
  // of any such calendar-arithmetic offset.
  function isRecurringWorkoutActiveInWeek(workout, weekStartDate, planStartDate) {
    if (workout.recurrence !== 'alternating') return true;
    var anchor = workout.recurrenceAnchorIso ? parseDate(workout.recurrenceAnchorIso) : planStartDate;
    var weeksSinceAnchor = Math.floor((weekStartDate.getTime() - anchor.getTime()) / (7 * 86400000));
    return ((weeksSinceAnchor % 2) + 2) % 2 === 0;
  }

  function classifyRecurringWorkout(workout) {
    var profile = RECURRING_ACTIVITY_PROFILE[workout.activityType] || RECURRING_ACTIVITY_PROFILE.other;
    var isHardDay = profile.alwaysHard || (workout.intensity === 'high' && profile.maxHardness !== 'low');
    return {
      aerobicContribution: profile.aerobic,
      strengthContribution: profile.strength,
      mobilityContribution: profile.mobility,
      isHardDay: isHardDay,
      replaces: workout.replaces || profile.defaultReplaces || 'none'
    };
  }

  // ── Named incline-walk templates (docs/COACHING_SPEC.md "12-3-20 and
  // 12-3-30") -- real, editable parameters (not just a bare activity name).
  // "12-3-30" is the well-known public protocol (12% incline, 3 mph, 30
  // min); "12-3-20" is the same incline/speed at a shorter 20-minute
  // duration, a common lower-fatigue variant. Neither is assumed universal
  // -- evaluateInclineWalkSafety below flags a combination that's unusually
  // demanding for a given profile so the runner (or the app) can dial it
  // back, rather than silently prescribing 12% incline to everyone.
  var INCLINE_WALK_TEMPLATES = {
    '12-3-30': { inclinePct: 12, speedMph: 3, durationMinutes: 30 },
    '12-3-20': { inclinePct: 12, speedMph: 3, durationMinutes: 20 },
    custom: null // caller supplies inclinePct/speedMph/durationMinutes directly
  };
  function inclineWalkParams(templateName, overrides) {
    var base = INCLINE_WALK_TEMPLATES[templateName] || INCLINE_WALK_TEMPLATES['12-3-30'];
    return Object.assign({ template: templateName || '12-3-30' }, base, overrides || {});
  }
  // Conservative, deterministic check -- never a hard block, matching this
  // app's established "warn, don't gate" posture elsewhere. A true beginner
  // or anyone with an active injury cap attempting the full 12% incline is
  // flagged with a concrete, easy-to-apply adjustment (reduce incline
  // first, then speed) instead of a vague "be careful."
  function evaluateInclineWalkSafety(params, level) {
    if (!params || params.inclinePct == null) return null;
    var demanding = params.inclinePct >= 10 && params.speedMph >= 2.8;
    if (demanding && (level === 'beginner')) {
      return 'This is a demanding incline/speed combination for a beginner level -- consider starting around 6-8% incline at the same speed, or the same incline at a slightly slower pace, and increasing from there.';
    }
    return null;
  }

  // ── Purposeful cross-training prescriptions (docs/COACHING_SPEC.md
  // "Purposeful cross-training prescriptions") -- "Bike" or "Cross-training"
  // alone is never a complete workout. Every prescription names a purpose,
  // a simple structure, an RPE range, and the training effect, matching the
  // spec's own worked example almost exactly ("Easy endurance bike -- 35
  // minutes: 5 min easy, 25 min conversational RPE 3-4, 5 min easy").
  // Deterministic and pure -- no AI call, matching this project's
  // established pattern for every other coaching-rule generator.
  var CROSS_PURPOSE_LABEL = {
    recovery: 'Recovery', easy: 'Easy aerobic endurance', steady: 'Steady endurance',
    aerobic_intervals: 'Aerobic intervals', threshold: 'Threshold intervals',
    strength: 'Strength / hill resistance', technique: 'Technique',
    free: 'Free ride / class', race_supporting: 'Race-supporting low-impact volume'
  };
  function buildCrossTrainingPrescription(activityType, purpose, durationMinutes) {
    var actName = RECURRING_ACTIVITY_LABEL[activityType] || 'Cross-training';
    var dur = Math.max(10, durationMinutes || 30);
    var warmCool = Math.min(5, Math.round(dur * 0.15));
    var mainMin = Math.max(0, dur - warmCool * 2);
    var structure, rpeRange, trainingEffect;
    switch (purpose) {
      case 'recovery':
        structure = 'Entirely easy, conversational effort throughout -- ' + dur + ' min.';
        rpeRange = [1, 2]; trainingEffect = 'Promotes blood flow and recovery without adding fatigue.';
        break;
      case 'steady':
        structure = warmCool + ' min easy, ' + mainMin + ' min steady at RPE 4-5, ' + warmCool + ' min easy.';
        rpeRange = [4, 5]; trainingEffect = 'Builds aerobic capacity at a sustainable, controlled effort.';
        break;
      case 'aerobic_intervals':
        structure = warmCool + ' min warm-up, then alternating 4 min moderate / 2 min easy for ' + mainMin + ' min, ' + warmCool + ' min cool-down.';
        rpeRange = [5, 6]; trainingEffect = 'Raises the aerobic ceiling without running-specific impact.';
        break;
      case 'threshold':
        structure = warmCool + ' min warm-up, then 3 x 8 min at threshold effort (RPE 7) with 2 min easy between, ' + warmCool + ' min cool-down.';
        rpeRange = [7, 8]; trainingEffect = 'Raises lactate threshold -- a genuinely hard session, not a recovery day.';
        break;
      case 'strength':
        structure = warmCool + ' min easy, ' + mainMin + ' min at high resistance/incline (RPE 6-7), ' + warmCool + ' min easy.';
        rpeRange = [6, 7]; trainingEffect = 'Builds muscular strength/endurance that supports running economy.';
        break;
      case 'technique':
        structure = dur + ' min focused on form/technique at an easy, controlled effort.';
        rpeRange = [2, 3]; trainingEffect = 'Improves movement efficiency without adding physiological load.';
        break;
      case 'race_supporting':
        structure = dur + ' min easy, low-impact aerobic volume.';
        rpeRange = [2, 3]; trainingEffect = 'Adds aerobic volume with minimal impact stress, supporting race fitness.';
        break;
      case 'free':
        structure = 'Whatever feels right -- free ride/class, no prescribed structure.';
        rpeRange = null; trainingEffect = 'Maintains enjoyment and consistency.';
        break;
      default: // 'easy'
        structure = warmCool + ' min easy, ' + mainMin + ' min conversational at RPE 3-4, ' + warmCool + ' min easy.';
        rpeRange = [3, 4]; trainingEffect = 'Supplements aerobic training without adding another run.';
    }
    return {
      activityType: activityType, purpose: CROSS_PURPOSE_LABEL[purpose] || CROSS_PURPOSE_LABEL.easy,
      label: (CROSS_PURPOSE_LABEL[purpose] || CROSS_PURPOSE_LABEL.easy) + ' — ' + actName + ' — ' + dur + ' minutes',
      structure: structure, rpeRange: rpeRange, trainingEffect: trainingEffect, durationMinutes: dur
    };
  }

  // ── Hikes as a legitimate planned activity, not an emergency fallback
  // (docs/COACHING_SPEC.md "Weekend hikes") -- load is driven by duration
  // AND terrain difficulty (elevation-gain-aware, not just time on feet), so
  // a long, steep hike is never silently treated as equivalent to rest.
  var HIKE_LOAD_ORDER = ['low', 'moderate', 'high'];
  function classifyHikeLoad(durationMinutes, terrainDifficulty) {
    var dur = durationMinutes || 0;
    var base = dur >= 180 ? 2 : dur >= 90 ? 1 : 0;
    var bump = terrainDifficulty === 'hard' ? 1 : 0;
    return HIKE_LOAD_ORDER[Math.min(HIKE_LOAD_ORDER.length - 1, base + bump)];
  }
  function buildHikePrescription(hike, units) {
    var dur = hike.durationMinutes || 60;
    var distText = hike.distanceMiles ? ', ' + toUnit(hike.distanceMiles, units) + ' ' + unitLabel(units) : '';
    var elevText = hike.elevationGainFt ? ', ~' + hike.elevationGainFt + ' ft gain' : '';
    var terrainText = { easy: 'easy terrain', moderate: 'moderate terrain', hard: 'difficult/steep terrain' }[hike.terrainDifficulty || 'easy'];
    var loadClass = classifyHikeLoad(dur, hike.terrainDifficulty);
    return {
      activityType: 'hiking', purpose: 'Aerobic volume, time on feet, and (on harder terrain) real musculoskeletal/climbing load',
      label: 'Hike — ' + dur + ' min' + distText + elevText + ' (' + terrainText + ')',
      structure: 'Sustained aerobic effort at a natural hiking pace over ' + terrainText + '.',
      rpeRange: hike.terrainDifficulty === 'hard' ? [5, 7] : hike.terrainDifficulty === 'moderate' ? [4, 6] : [3, 5],
      trainingEffect: loadClass === 'high'
        ? 'Significant aerobic and climbing load with real recovery demand -- not equivalent to rest.'
        : 'Meaningful aerobic volume and time on feet, supporting race fitness with low impact stress.',
      durationMinutes: dur, loadClass: loadClass
    };
  }

  // docs/COACHING_SPEC.md "Weekly availability" -- profile.weeklyAvailability
  // is an OPTIONAL new profile field: { [weekday 0-6]: { canRun: bool,
  // window: 'morning'|'midday'|'evening'|'flexible' } }. When present, it
  // overrides the static RUN_SLOT_PRIORITY ordering with the runner's own
  // stated possible running days, converted from weekday to this plan's
  // actual slot index via slotForFixedDay (slot 6/the long-run day is
  // handled separately by buildStructuredWeeks and excluded here). Returns
  // null (meaning "no override, use legacy behavior") when the field is
  // absent -- profile.availableDays remains a fallback for the COUNT of
  // running days elsewhere (targetRunDaysFor), but never overrides which
  // specific weekdays are used once weeklyAvailability exists, per the
  // explicit backward-compatibility requirement.
  // docs/COACHING_SPEC.md "Preferred weekly rhythm" -- `entry.preference`
  // ('preferred'|'possible', defaults to 'preferred' when absent -- the
  // only possible value before this field existed) distinguishes "I want
  // this to be one of my normal running days" from "I can run here if
  // another session must move." Returns { preferred, possible, all } (slot
  // index arrays, long-run slot 6 excluded) instead of a flat list so
  // buildStructuredWeeks can exhaust preferred days before ever touching a
  // possible-only day, rather than treating every canRun day identically.
  function weeklyAvailabilityCanRunSlots(profile, raceDate) {
    if (!profile.weeklyAvailability) return null;
    var preferred = [], possible = [];
    for (var day = 0; day <= 6; day++) {
      var entry = profile.weeklyAvailability[day];
      if (!entry || !entry.canRun) continue;
      var slot = slotForFixedDay(raceDate, day);
      if (slot === 6) continue;
      if (entry.preference === 'possible') possible.push(slot); else preferred.push(slot);
    }
    return { preferred: preferred, possible: possible, all: preferred.concat(possible) };
  }

  // Deterministic schedule-safety check (docs/COACHING_SPEC.md) -- warns
  // rather than silently overloading the runner, reusing the exact
  // planMeta.warnings mechanism evaluateSafety already populates.
  function evaluateRecurringWorkoutSchedule(recurringWorkouts, targetRunDays, raceDateIso, preferredLongRunDay) {
    var warnings = [];
    var list = recurringWorkouts || [];
    var fixedCount = list.filter(function (w) { return w.fixed && w.day != null; }).length;
    if (fixedCount + targetRunDays > 6) {
      warnings.push('Your fixed weekly workouts (' + fixedCount + ') plus your running days (' + targetRunDays + ') leave no room for a rest day. Consider making one of your fixed sessions movable, or reducing running days available.');
    }
    // slotForFixedDay needs a real race date to know which weekday the long
    // run falls on -- if it's not available yet (e.g. mid-wizard, before a
    // race date is chosen), skip this specific check rather than guessing.
    // docs/COACHING_SPEC.md "Preferred weekly rhythm" -- preferredLongRunDay
    // (optional) moves this check off slot 6 the same way buildStructuredWeeks
    // itself does, so a fixed Sunday hike isn't wrongly flagged as "on your
    // long-run day" once Friday, not Sunday, is where the long run actually is.
    var raceDate = raceDateIso ? parseDate(raceDateIso) : null;
    var longRunSlot = (raceDate && preferredLongRunDay != null) ? slotForFixedDay(raceDate, preferredLongRunDay) : 6;
    var onLongRunDay = raceDate ? list.filter(function (w) { return w.fixed && w.day != null && slotForFixedDay(raceDate, w.day) === longRunSlot; }) : [];
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

  // docs/COACHING_SPEC.md "Key-session conflict" -- a fixed/alternating hard
  // commitment landing on the SAME weekday as this week's long/key run (see
  // profile.preferredLongRunDay) is a genuine tradeoff between two things the
  // runner values, not something safe to resolve silently one way or the
  // other. Pure detection only -- returns the conflicting workouts and a
  // fixed set of 2-4 safe resolution options for each, described in plain
  // language; buildStructuredWeeks applies whichever option (if any) is
  // recorded in state.scheduleChoices[workout.id], and otherwise falls back
  // to a visible, flagged coexistence (never a silent drop, never a silent
  // override) until the runner actually picks one.
  function buildKeySessionConflictOptions(workout) {
    var name = (workout.activityType === 'other' || workout.activityType === 'sport') && workout.customName
      ? workout.customName
      : RECURRING_ACTIVITY_LABEL[workout.activityType] || RECURRING_ACTIVITY_LABEL.other;
    return [
      { id: 'keep_long_easy', label: 'Keep the long run, skip ' + name + ' those weeks', description: 'Your long run stays on this day every week; ' + name + ' is skipped whenever the two land on the same day.' },
      { id: 'move_long_run', label: 'Move the long run to the weekend', description: 'The long run shifts to Saturday or Sunday instead (replacing that day’s hike or rest); ' + name + ' stays on its usual day.' },
      { id: 'keep_long_reduce', label: 'Keep both, mark ' + name + ' reduced', description: 'The long run stays as planned; ' + name + ' still happens but is flagged as reduced, so the day isn’t treated as double-hard.' },
      { id: 'coexist', label: 'Keep both as scheduled', description: name + ' and the long run both happen that day, back to back, unchanged.' }
    ];
  }
  function detectKeySessionConflict(recurringWorkouts, raceDateIso, preferredLongRunDay) {
    if (!raceDateIso) return [];
    var raceDate = parseDate(raceDateIso);
    var longRunSlot = preferredLongRunDay != null ? slotForFixedDay(raceDate, preferredLongRunDay) : 6;
    var list = (recurringWorkouts || []).map(normalizeRecurringWorkout);
    var conflicting = list.filter(function (w) { return w.fixed && w.day != null && slotForFixedDay(raceDate, w.day) === longRunSlot; });
    return conflicting.map(function (w) {
      return { workoutId: w.id, activityType: w.activityType, customName: w.customName, options: buildKeySessionConflictOptions(w) };
    });
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
  // `priorityOverride` (docs/COACHING_SPEC.md "Weekly availability") lets a
  // caller substitute its own slot-preference ordering (e.g. the runner's
  // stated canRun weekdays, or those weekdays with same-day-fixed-workout
  // conflicts pushed to the back so quality lands on a clean day first) in
  // place of the static RUN_SLOT_PRIORITY -- optional and purely additive,
  // every existing call site that omits it gets byte-identical behavior.
  // `longSlot` (docs/COACHING_SPEC.md "Preferred weekly rhythm") lets a
  // caller move which slot holds 'long' away from the default (slot 6,
  // the actual race weekday) -- e.g. a runner whose intended rhythm puts
  // her long/key run on Friday and reserves the weekend for hikes rather
  // than running at all. Omitted (or null), every existing call site gets
  // byte-identical behavior to before this parameter existed. Race week
  // itself is unaffected either way -- slot 6 always becomes 'race' there
  // regardless of longSlot, since that's a real calendar fact, not a
  // preference (see buildStructuredWeeks's race-phase branch).
  function assignWeekTemplate(runDays, wantCross, priorityOverride, longSlot) {
    var LONG_SLOT = longSlot != null ? longSlot : 6;
    // capped at 5 (not 6) so one of the 6 non-long slots is always structurally
    // left as 'rest' below, satisfying the "at least one rest day" rule without
    // ever having to overwrite an already-assigned run day after the fact
    var additional = Math.max(0, Math.min(5, runDays - 1));
    var slots = ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest'];
    slots[LONG_SLOT] = 'long';
    var priority = (priorityOverride || RUN_SLOT_PRIORITY).filter(function (s) { return s !== LONG_SLOT; });
    var chosen = priority.slice(0, additional);
    chosen.forEach(function (idx, i) { slots[idx] = i === 0 ? 'quality' : 'easy'; });
    var restPref = [4, 0, 2, 3, 5, 1].filter(function (s) { return s !== LONG_SLOT; });
    var restSlot = restPref.filter(function (i) { return slots[i] === 'rest'; })[0];
    for (var j = 0; j < 7; j++) {
      if (j === LONG_SLOT) continue;
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
    var label = workout.durationMinutes + ' min ' + name;
    // docs/COACHING_SPEC.md "Key-session conflict" -- flags set by the
    // long-run-day conflict resolution above (reduced/pendingConflict are
    // never present on a normal recurring-workout record).
    if (workout.reduced) label += ' (reduced)';
    if (workout.pendingConflict) label += ' — conflicts with your long run, choose how to handle it';
    return label;
  }
  // docs/COACHING_SPEC.md "Constraint-aware scheduling" -- more than one
  // fixed workout can now share a weekday (e.g. a morning 12-3-30 and a
  // noon Tabata class both fixed on the same Tuesday); joins their labels
  // into one line ("12-3-30 · Tabata") instead of the day only ever
  // reflecting a single activity. A single-workout day renders identically
  // to formatRecurringWorkoutLabel alone -- strict superset, no visual
  // change for every existing one-fixed-workout-per-day record.
  function formatRecurringWorkoutsLabel(workouts) {
    return workouts.map(formatRecurringWorkoutLabel).join(' · ');
  }

  // ── First-class multi-session model (docs/COACHING_SPEC.md "Multiple
  // workouts per day") -- built ADDITIVELY alongside the existing
  // day.type/miles/label fields (never replacing them, so every existing
  // renderer/logger call site keeps working unchanged). day.sessions[]
  // holds 1-2 structured session objects (a day can have a primary run/
  // hike/rest/cross session and, when a fixed workout coexists with a
  // morning run, one secondary session) -- each with its own stable id,
  // purpose, structure, RPE range, load classification, and status, so a
  // run and a same-day spin class are never merged into one ambiguous
  // entry the way a bare "+ 45 min Spinning" label suffix was before this.
  var RUN_SESSION_META = {
    long: { subtype: 'long', purpose: "This week's primary endurance session -- builds the aerobic and musculoskeletal durability the race distance demands.", loadClass: 'high' },
    quality: { subtype: 'quality', purpose: "Race-specific intensity -- this week's key hard running stimulus.", loadClass: 'high' },
    easy: { subtype: 'easy', purpose: 'Easy aerobic run -- supports weekly volume without adding meaningful fatigue.', loadClass: 'low' },
    race: { subtype: 'race', purpose: 'Race day.', loadClass: 'high' },
    rest: { subtype: 'rest', purpose: 'Full day off running -- adaptation happens here.', loadClass: 'none' }
  };
  function sessionIdFor(weekNum, slot, role, suffix) {
    return 'sess_' + weekNum + '_' + slot + '_' + role + (suffix ? '_' + suffix : '');
  }
  function buildRunSession(day, weekNum, slot) {
    var meta = RUN_SESSION_META[day.type] || { subtype: day.type, purpose: null, loadClass: 'none' };
    return {
      id: sessionIdFor(weekNum, slot, 'primary'), role: 'primary', activityType: 'run', subtype: meta.subtype,
      purpose: meta.purpose, structure: day.runWalk ? null : null, rpeRange: RPE_TARGET[day.type] || null,
      durationMinutes: null, distanceMiles: day.miles || null, intensity: null, loadClass: meta.loadClass,
      status: 'planned', isRaceSpecific: ['long', 'quality', 'easy', 'race'].indexOf(day.type) !== -1,
      replaces: null, source: 'generated', explanation: meta.purpose, label: day.label
    };
  }
  // A recurring-workout-driven session (fixed or movable, primary or
  // secondary) -- routes to the purposeful hike/incline-walk/cross-training
  // prescription builders above instead of a bare activity name.
  function buildRecurringSession(workout, weekNum, slot, role, units) {
    var presc;
    if (workout.activityType === 'hiking') {
      presc = buildHikePrescription(workout, units);
    } else if (workout.activityType === 'twelveThreeThirty') {
      var iw = workout.inclineWalk || inclineWalkParams('12-3-30');
      presc = {
        label: (iw.template === 'custom' ? 'Custom incline walk' : iw.template) + ' — ' + iw.inclinePct + '% @ ' + iw.speedMph + ' mph, ' + iw.durationMinutes + ' min',
        structure: iw.durationMinutes + ' min continuous at ' + iw.inclinePct + '% incline, ' + iw.speedMph + ' mph.',
        rpeRange: [3, 4], trainingEffect: 'Deliberate low-sweat aerobic work -- a genuine training stimulus, not a rest day.',
        durationMinutes: iw.durationMinutes, loadClass: 'low'
      };
    } else {
      var purposeGuess = classifyRecurringWorkout(workout).isHardDay ? 'threshold' : (workout.intensity === 'low' ? 'recovery' : 'steady');
      presc = buildCrossTrainingPrescription(workout.activityType, purposeGuess, workout.durationMinutes);
      presc.loadClass = classifyRecurringWorkout(workout).isHardDay ? 'high' : (workout.intensity === 'low' ? 'low' : 'moderate');
    }
    // docs/COACHING_SPEC.md "Key-session conflict" -- reduced/pendingConflict
    // are set only on the copy detectKeySessionConflict resolution attaches
    // when this workout coexists with the long run on its own day; a normal
    // recurring-workout record never carries them.
    var loadClass = workout.reduced ? 'low' : (presc.loadClass || 'low');
    var status = workout.pendingConflict ? 'pending_conflict' : (workout.status || (workout.fixed ? 'fixed' : 'optional'));
    var explanation = presc.trainingEffect || null;
    if (workout.reduced) explanation = (explanation ? explanation + ' ' : '') + 'Kept, but reduced since it falls on your long-run day.';
    if (workout.pendingConflict) explanation = (explanation ? explanation + ' ' : '') + 'Falls on your long-run day -- choose how to handle this in the app.';
    return {
      id: sessionIdFor(weekNum, slot, role, workout.id), role: role, activityType: workout.activityType, subtype: null,
      purpose: presc.trainingEffect || null, structure: presc.structure || null, rpeRange: presc.rpeRange || null,
      durationMinutes: presc.durationMinutes || workout.durationMinutes, distanceMiles: workout.distanceMiles || null,
      intensity: workout.intensity, loadClass: loadClass, status: status,
      isRaceSpecific: false, replaces: workout.replaces, source: 'recurring', recurringWorkoutId: workout.id,
      explanation: explanation, label: presc.label
    };
  }
  function buildGenericCrossSession(day, weekNum, slot, crossPref, addStrength) {
    var purpose = addStrength ? 'strength' : 'easy';
    var presc = buildCrossTrainingPrescription(crossPref !== 'Cross-train' ? crossPref.toLowerCase() : 'cycling', purpose, Math.round(day.miles ? 0 : 30));
    return {
      id: sessionIdFor(weekNum, slot, 'primary'), role: 'primary', activityType: 'cross', subtype: null,
      purpose: presc.trainingEffect, structure: presc.structure, rpeRange: presc.rpeRange,
      durationMinutes: presc.durationMinutes, distanceMiles: null, intensity: null,
      loadClass: addStrength ? 'moderate' : 'low', status: 'planned', isRaceSpecific: false,
      replaces: null, source: 'generated', explanation: presc.trainingEffect, label: day.label
    };
  }
  // Combined daily load (docs/COACHING_SPEC.md "Multiple workouts per
  // day") -- two sessions are fine; two independently-hard sessions
  // accidentally stacked are flagged. 'high'+'high' -> flagged; anything
  // else combines to the higher of the two (a 'high' + 'low' day is still
  // just a hard day with an easy add-on, not double-hard).
  var LOAD_ORDER = { none: 0, low: 1, moderate: 2, high: 3 };
  function computeCombinedDailyLoad(day) {
    var sessions = (day && day.sessions) || [];
    if (!sessions.length) return { combinedLoadClass: 'none', accidentalDoubleHard: false };
    var maxLoad = sessions.reduce(function (m, s) { return (LOAD_ORDER[s.loadClass] || 0) > (LOAD_ORDER[m] || 0) ? s.loadClass : m; }, 'none');
    var hardCount = sessions.filter(function (s) { return s.loadClass === 'high'; }).length;
    return { combinedLoadClass: maxLoad, accidentalDoubleHard: hardCount >= 2 };
  }

  function buildStructuredWeeks(profile, raceGoal, planMeta, units, recurringWorkouts, scheduleChoices) {
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
    var longRunSafetyCap = Math.max((profile.longestRun || 0) * 1.15, 2);
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
    // docs/COACHING_SPEC.md "Constraint-aware scheduling" -- normalized once
    // up front (safe defaults applied, never mutating the caller's records)
    // so every check below can rely on recurrence/status/replaces/environment
    // always being present, whether or not this particular record predates
    // those fields.
    var allRecurring = (recurringWorkouts || []).map(normalizeRecurringWorkout);
    // docs/COACHING_SPEC.md "Weekly availability" -- null when the runner
    // hasn't set explicit weekday availability (100% legacy behavior below);
    // an array of allowed slot indices otherwise.
    var canRunSlots = weeklyAvailabilityCanRunSlots(profile, raceDate);
    // Fixed reference for alternating-recurrence workouts with no anchor of
    // their own -- this plan's own week-1 slot-0 date, not whatever the
    // runner separately typed as a start date (see isRecurringWorkoutActiveInWeek).
    var planStartDate = dateForSlot(raceDate, planLengthWeeks, 1, 0);
    // docs/COACHING_SPEC.md "Preferred weekly rhythm" -- optional. Defaults
    // to slot 6 (the actual race weekday), unchanged from before this field
    // existed. When set, the long/key run moves to a different weekday for
    // every non-race week (e.g. Friday, with the weekend reserved for
    // hikes) -- race week itself is unaffected regardless (slot 6 is always
    // 'race' there, a calendar fact, not a preference).
    var longRunSlot = profile.preferredLongRunDay != null ? slotForFixedDay(raceDate, profile.preferredLongRunDay) : 6;

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

      // docs/COACHING_SPEC.md "Alternating recurrence" -- re-evaluated every
      // week (not once for the whole plan) since an alternating workout
      // (e.g. every-other-week Friday Tabata) is only actually present on
      // half of them. `weekStartDate` is this week's own slot-0 date, used
      // both as the alternating-recurrence reference and to convert a fixed
      // workout's weekday into this plan's slot index (unchanged from
      // before -- the race date, and therefore every slot's weekday, never
      // changes week to week).
      var weekStartDate = dateForSlot(raceDate, planLengthWeeks, w, 0);
      var activeRecurring = allRecurring.filter(function (rw) { return isRecurringWorkoutActiveInWeek(rw, weekStartDate, planStartDate); });
      // docs/COACHING_SPEC.md "Key-session conflict" -- a fixed workout whose
      // day maps to longRunSlot is no longer silently excluded from the plan
      // (that used to make it vanish from the calendar entirely, invisible
      // to the runner). It's still tracked separately from the "normal"
      // override-or-coexist handling below, since the resolution for a
      // conflict with THE LONG RUN specifically depends on scheduleChoices,
      // not the generic timeWindow coexistence rule.
      var allFixedWorkouts = activeRecurring.filter(function (rw) { return rw.fixed && rw.day != null; });
      var fixedWorkouts = allFixedWorkouts.filter(function (rw) { return slotForFixedDay(raceDate, rw.day) !== longRunSlot; });
      var longRunConflictWorkouts = allFixedWorkouts.filter(function (rw) { return slotForFixedDay(raceDate, rw.day) === longRunSlot; });
      var movableWorkouts = activeRecurring.filter(function (rw) { return !rw.fixed; });

      // docs/COACHING_SPEC.md "Weekly availability" -- when the runner has
      // stated explicit weekday availability, build this week's own slot
      // priority order from it (restricted + reordered, never the static
      // RUN_SLOT_PRIORITY) so quality/easy running days land on mornings
      // she actually said she runs, not a generic Tue/Thu/Sat default that
      // may directly contradict her stated schedule. Slots with a same-day
      // fixed commitment (any status, any hardness -- e.g. an 11am spin
      // class on an otherwise-runnable Monday morning) are pushed to the
      // back of the order rather than excluded outright: the day can still
      // hold an EASY run (there's no conflict with the morning itself), it
      // just never becomes the week's QUALITY day (chosen[0]), satisfying
      // "keep it easy before a same-day hard commitment" without blocking
      // the morning run entirely.
      var sameDayFixedSlots = fixedWorkouts.map(function (rw) { return slotForFixedDay(raceDate, rw.day); });
      // docs/COACHING_SPEC.md "Preferred weekly rhythm" -- preferred days
      // are exhausted (in AVAILABILITY_AWARE_PRIORITY order) before a
      // possible-only day is ever chosen, so "I could run here if needed"
      // only actually gets used as a genuine fallback, never as an
      // automatic extra running day just because the calendar has room.
      var basePriority = canRunSlots
        ? AVAILABILITY_AWARE_PRIORITY.filter(function (s) { return canRunSlots.preferred.indexOf(s) !== -1; })
            .concat(canRunSlots.preferred.filter(function (s) { return AVAILABILITY_AWARE_PRIORITY.indexOf(s) === -1; }))
            .concat(AVAILABILITY_AWARE_PRIORITY.filter(function (s) { return canRunSlots.possible.indexOf(s) !== -1; }))
            .concat(canRunSlots.possible.filter(function (s) { return AVAILABILITY_AWARE_PRIORITY.indexOf(s) === -1; }))
        : RUN_SLOT_PRIORITY;
      var priorityOverride = basePriority.filter(function (s) { return sameDayFixedSlots.indexOf(s) === -1; })
        .concat(basePriority.filter(function (s) { return sameDayFixedSlots.indexOf(s) !== -1; }));
      var template = assignWeekTemplate(weekRunDays, wantCross, priorityOverride, longRunSlot);

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

      // Hard-day stacking guard, two different rules depending on whether
      // the runner has stated explicit weekly availability:
      //
      // WITHOUT it (legacy behavior, unchanged, still covered by
      // tests/recurring-workouts.test.js): any hard fixed workout ANYWHERE
      // that week suppresses the plan's own quality session outright -- a
      // conservative default from when a runner had at most one recurring
      // workout in mind, so "a hard fixed workout exists this week" was
      // itself a reasonable proxy for "this week already has its hard day."
      //
      // WITH explicit availability (docs/COACHING_SPEC.md "Constraint-aware
      // scheduling"): that blanket rule would wrongly suppress quality
      // every single week for a runner with an every-week hard commitment
      // on a day she never runs anyway (e.g. a Tuesday Tabata class, when
      // Tuesday isn't one of her running mornings at all) -- there's no
      // real stacking there. Same-day conflicts are already handled above
      // by priorityOverride (quality never lands on a day with a same-day
      // fixed workout in the first place). What's left to guard here is
      // the total weekly hard-day COUNT: if this week's fixed hard workouts
      // plus the plan's own quality session would exceed 2 genuinely hard
      // days, demote quality to easy instead of stacking a 3rd.
      var qualitySlotIsSameDayConflict = qualitySlotIdx !== -1 && sameDayFixedSlots.indexOf(qualitySlotIdx) !== -1;
      var fixedHardCount = fixedWorkouts.filter(function (fw) { return classifyRecurringWorkout(fw).isHardDay; }).length;
      var suppressQuality;
      if (canRunSlots) {
        suppressQuality = qualitySlotIdx !== -1 && (qualitySlotIsSameDayConflict || (fixedHardCount + 1 > 2));
      } else {
        suppressQuality = qualitySlotIdx !== -1 && fixedHardCount > 0;
      }
      if (suppressQuality) template[qualitySlotIdx] = 'easy';

      // Fixed workouts override their designated weekday's slot (never slot 6 --
      // filtered out of fixedWorkouts already) -- UNLESS the workout has an
      // explicit non-morning timeWindow (midday/evening) AND that slot is
      // already a running day (long/quality/easy), in which case the two
      // coexist (docs/COACHING_SPEC.md "Recurring activities" -- a morning
      // run followed by an 11am spin class is one day, not a conflict). A
      // workout with no stated timeWindow (every record predating this
      // field) still always overrides, matching 100% of prior behavior.
      // Tracked in sameDaySecondary so the day-building loop below can
      // append the coexisting workout's label rather than losing it.
      // More than one fixed workout can now share a weekday (e.g. a 12-3-30
      // session AND a noon Tabata class both fixed the same Tuesday);
      // formatRecurringWorkoutsLabel joins them into one label.
      var sameDaySecondary = {};
      fixedWorkouts.forEach(function (w) {
        var slot = slotForFixedDay(raceDate, w.day);
        var coexists = (w.timeWindow === 'midday' || w.timeWindow === 'evening') &&
          (template[slot] === 'long' || template[slot] === 'quality' || template[slot] === 'easy');
        if (coexists) {
          sameDaySecondary[slot] = (sameDaySecondary[slot] || []).concat([w]);
        } else {
          template[slot] = 'recurring';
        }
      });

      // docs/COACHING_SPEC.md "Key-session conflict" -- a fixed workout on
      // the SAME day as this week's long run is resolved per
      // scheduleChoices[workout.id] (set by the runner via the app's
      // conflict-resolution prompt, see detectKeySessionConflict). Race week
      // itself is never touched by any choice -- that slot is the actual
      // race day, a calendar fact, not a preference.
      if (longRunConflictWorkouts.length && phase !== 'race') {
        longRunConflictWorkouts.forEach(function (cw) {
          var choice = (scheduleChoices || {})[cw.id];
          if (choice === 'keep_long_easy') {
            // Long run stays; this commitment is skipped whenever the two
            // land on the same day -- an explicit, informed choice, unlike
            // the old behavior of silently dropping it every time.
            return;
          }
          if (choice === 'move_long_run') {
            var satSlot = slotForFixedDay(raceDate, 5), sunSlot = slotForFixedDay(raceDate, 6);
            var altSlot = [satSlot, sunSlot].filter(function (s) { return s !== longRunSlot && template[s] !== 'long'; })[0];
            if (altSlot != null) {
              template[altSlot] = 'long';
              template[longRunSlot] = 'recurring';
            } else {
              // No free weekend slot this week (e.g. long run already there) --
              // fall back to visible coexistence rather than losing either session.
              sameDaySecondary[longRunSlot] = (sameDaySecondary[longRunSlot] || []).concat([cw]);
            }
            return;
          }
          if (choice === 'keep_long_reduce') {
            sameDaySecondary[longRunSlot] = (sameDaySecondary[longRunSlot] || []).concat([Object.assign({}, cw, { reduced: true })]);
            return;
          }
          if (choice === 'coexist') {
            sameDaySecondary[longRunSlot] = (sameDaySecondary[longRunSlot] || []).concat([cw]);
            return;
          }
          // No choice recorded yet -- never silently drop it (the old bug)
          // and never silently override the long run either. Surface it as
          // a flagged secondary session so it's visible on the calendar,
          // and leave the actual decision to the runner (planMeta surfaces
          // the pending conflict via evaluateRecurringWorkoutSchedule / the
          // app's conflict-resolution prompt).
          sameDaySecondary[longRunSlot] = (sameDaySecondary[longRunSlot] || []).concat([Object.assign({}, cw, { pendingConflict: true })]);
        });
      }

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
            // workout-runner.js's normalizer reads these directly instead of
            // re-parsing `day.label` text -- see QUALITY_POOL's own comments
            // on `segments`/`manualReps` above. undefined (not present) for
            // every entry that has neither, which the normalizer treats as
            // a single guided open block, never a silent auto-timed guess.
            if (qualityEntry.segments) day.qualitySegments = qualityEntry.segments;
            if (qualityEntry.manualReps) day.qualityManualReps = qualityEntry.manualReps;
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
          // docs/COACHING_SPEC.md "Key-session conflict" -- a 'move_long_run'
          // choice can put a longRunConflictWorkouts entry onto this exact
          // slot (see above), so both lists need to be searched here, not
          // just the normal fixedWorkouts set.
          var fixedWorkoutsHere = fixedWorkouts.concat(longRunConflictWorkouts).filter(function (w) { return slotForFixedDay(raceDate, w.day) === slot; });
          day.type = 'cross';
          day.label = formatRecurringWorkoutsLabel(fixedWorkoutsHere);
          day.recurringWorkout = { id: fixedWorkoutsHere[0].id, activityType: fixedWorkoutsHere[0].activityType, fixed: true };
          if (fixedWorkoutsHere.length > 1) day.recurringWorkoutIds = fixedWorkoutsHere.map(function (w) { return w.id; });
          day.sessions = fixedWorkoutsHere.map(function (fw, fwi) { return buildRecurringSession(fw, w, slot, fwi === 0 ? 'primary' : 'secondary', units); });
        } else if (tok === 'cross') {
          var movableWorkoutHere = movableIdx < placedMovable.length ? placedMovable[movableIdx] : null;
          if (movableWorkoutHere) {
            movableIdx++;
            day.type = 'cross';
            day.label = formatRecurringWorkoutLabel(movableWorkoutHere);
            day.recurringWorkout = { id: movableWorkoutHere.id, activityType: movableWorkoutHere.activityType, fixed: false };
            day.sessions = [buildRecurringSession(movableWorkoutHere, w, slot, 'primary', units)];
          } else {
            var addStrength = strengthAssigned < strengthBudget;
            if (addStrength) strengthAssigned++;
            day.type = 'cross';
            day.label = (30 + Math.min(30, Math.round(targetVolume))) + ' min cross' + (crossPref !== 'Cross-train' ? ' · ' + crossPref : '') + (addStrength ? ' + Strength' : '');
            day.sessions = [buildGenericCrossSession(day, w, slot, crossPref, addStrength)];
          }
        } else {
          day.type = 'rest'; day.label = 'Rest';
        }
        // Every run/rest/race day (everything not already given a
        // recurring-driven day.sessions above) gets its own structured
        // primary session too, matching the day's already-computed type/
        // miles/label -- built last so runWalk/shakeout overrides above are
        // reflected in the session's own label.
        if (!day.sessions) day.sessions = [buildRunSession(day, w, slot)];
        // docs/COACHING_SPEC.md "Recurring activities" -- a same-day
        // coexisting fixed workout (see sameDaySecondary above) rides along
        // on the running day's own label AND as its own independently
        // loggable secondary session (not just a label suffix).
        if (sameDaySecondary[slot]) {
          day.label += ' + ' + formatRecurringWorkoutsLabel(sameDaySecondary[slot]);
          day.secondaryRecurringWorkoutIds = sameDaySecondary[slot].map(function (w) { return w.id; });
          sameDaySecondary[slot].forEach(function (sw) {
            day.sessions.push(buildRecurringSession(sw, w, slot, 'secondary', units));
          });
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

  // ── Travel / temporary schedule overrides (docs/COACHING_SPEC.md
  // "Constraint-aware scheduling") -- deliberately separate from
  // applyUnavailableRanges above (illness/away, which blanks a day to full
  // rest): travel reduces complexity and expectations without erasing
  // training. A travel period record: { start, end, mode
  // ('travel'|'reduced'|'custom'), indoorOnly, minDurationMinutes,
  // preferredDurationMinutes }. Every day inside the range keeps its
  // original TYPE (long/quality/easy/rest) as a hint for how demanding it
  // should feel, but gets a travel-appropriate indoor session in place of
  // its normal mileage -- at most one quality/"controlled" session per
  // travel week (spec: "no more than one controlled quality session per
  // week unless existing fitness clearly supports more" -- this pass
  // doesn't yet attempt that fitness-based exception, so the cap is
  // unconditional), and at least one real rest day preserved per week
  // (the first day inside the range each week that was already 'rest'),
  // with every other day -- including days that would otherwise be 'rest'
  // -- becoming a real, if short, indoor session, matching "most vacation
  // mornings," not literally every single one, and never the whole range
  // silently converted to a week of rest days.
  function travelDayLabel(kind, minutes, indoorOnly) {
    var envNote = indoorOnly ? 'treadmill/indoor' : 'indoor-friendly';
    var kindText = { long: 'longer treadmill effort', quality: 'controlled treadmill effort', easy: 'easy indoor movement' }[kind];
    return minutes + ' min ' + envNote + ' ' + kindText + ' (travel)';
  }

  // docs/COACHING_SPEC.md "Session-level architecture" -- a travel override
  // replaces day.sessions[] with a single real travel session matching the
  // new label/duration, instead of leaving the pre-travel sessions (e.g. a
  // Tuesday Tabata class) stale underneath a day whose label/type already
  // correctly say "easy indoor movement (travel)". Home recurring classes
  // are dropped entirely for the day, not just hidden -- "Do not expect
  // absent home classes to be completed while traveling."
  function buildTravelSession(day, weekNum, slot, kind) {
    return {
      id: sessionIdFor(weekNum, slot, 'primary', 'travel'), role: 'primary', activityType: 'cross', subtype: 'travel',
      purpose: 'Keeps training active while away from your normal routine, matched to what travel actually allows.',
      structure: null, rpeRange: kind === 'quality' ? [5, 7] : [3, 4],
      durationMinutes: day.travelSession ? day.travelSession.minutes : null, distanceMiles: null,
      intensity: kind === 'quality' ? 'moderate' : 'low', loadClass: kind === 'quality' ? 'moderate' : 'low',
      status: 'planned', isRaceSpecific: false, replaces: null, source: 'travel', recurringWorkoutId: null,
      explanation: 'Keeps training active while away from your normal routine, matched to what travel actually allows.',
      label: day.label
    };
  }
  function applyTravelDayOverride(day, travel, keepAsRest, weekNum, slot) {
    if (keepAsRest) return; // this week's one preserved rest day -- left untouched
    var minDur = Math.max(10, travel.minDurationMinutes || 30);
    var prefDur = Math.max(minDur, travel.preferredDurationMinutes || 45);
    var kind = day.type === 'long' ? 'long' : (day.type === 'quality' ? 'quality' : 'easy');
    var minutes = kind === 'long' ? Math.round(prefDur * 1.3) : (kind === 'quality' ? prefDur : minDur);
    if (day.type === 'rest') day.type = 'easy';
    day.miles = 0;
    day.travelSession = { minutes: minutes, indoorOnly: !!travel.indoorOnly };
    day.label = travelDayLabel(kind, minutes, travel.indoorOnly);
    day.sessions = [buildTravelSession(day, weekNum, slot, kind)];
  }

  function applyTravelPeriods(weeks, raceGoal, planMeta, travelPeriods, units, terrainNote) {
    if (!travelPeriods || !travelPeriods.length) return weeks;
    var raceDate = parseDate(raceGoal.raceDate);
    var planLengthWeeks = planMeta.planLengthWeeks;
    var allDays = [];
    weeks.forEach(function (wk) {
      var qualityUsedThisWeek = false;
      var restKeptThisWeek = false;
      wk.days.forEach(function (day, di) {
        var iso = dateToISO(dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di));
        if (day.type !== 'race') {
          var hit = travelPeriods.filter(function (t) { return iso >= t.start && iso <= t.end; })[0];
          if (hit) {
            if (day.type === 'quality' && qualityUsedThisWeek) day.type = 'easy';
            else if (day.type === 'quality') qualityUsedThisWeek = true;
            var keepAsRest = day.type === 'rest' && !restKeptThisWeek;
            if (keepAsRest) restKeptThisWeek = true;
            applyTravelDayOverride(day, hit, keepAsRest, wk.weekNum, di);
          }
        }
        allDays.push({ day: day, iso: iso });
      });
    });

    // docs/COACHING_SPEC.md "First week after travel" -- recalculated from
    // the ACTUAL travel-period dates (not from whether anything was
    // logged), same ramp-back mechanic as applyUnavailableRanges's illness
    // return -- ensures the week right after a trip transitions back
    // instead of immediately restoring peak load.
    travelPeriods.forEach(function (t) {
      var startD = parseDate(t.start), endD = parseDate(t.end);
      var travelDays = Math.round((endD - startD) / 86400000) + 1;
      var rampFactor = Math.max(0.6, 1 - travelDays / 60);
      var rampEndIso = dateToISO(new Date(endD.getTime() + 7 * 86400000));
      allDays.forEach(function (rec) {
        if (rec.iso <= t.end || rec.iso > rampEndIso) return;
        if (rec.day.type === 'easy' || rec.day.type === 'long') {
          rec.day.miles = round5(rec.day.miles * rampFactor);
          if (units) {
            rec.day.label = rec.day.type === 'long' ? formatLongRunLabel(rec.day.miles, terrainNote, units) : formatEasyRunLabel(rec.day.miles, units);
          }
          // Keep the primary session's own distance/label in sync with the
          // day-level ramp-back, same reasoning as the travel override above --
          // a session detail screen must never show a stale pre-ramp value.
          var primarySession = (rec.day.sessions || []).filter(function (s) { return s.role === 'primary'; })[0];
          if (primarySession) { primarySession.distanceMiles = rec.day.miles; primarySession.label = rec.day.label; }
        }
      });
    });
    return weeks;
  }

  // ── Conditional preference: unplanned evening intervals -> next-morning
  // hike/recovery (docs/COACHING_SPEC.md "Conditional preferences") --
  // deliberately one small, named, deterministic rule, not a general
  // natural-language rules engine (explicitly out of scope). Triggered by
  // a log entry's `eveningIntervals: true` flag (set by the runner when
  // logging an unplanned evening session, see app.js's log form) --
  // AI/free text never decides this. Protects the long run and race day
  // outright (never silently downgraded); a quality or easy run the very
  // next calendar day is swapped to a shortened easy/recovery session
  // instead. Returns a short explanation string (or null) for the plan's
  // existing warnings/notes surface -- no separate "adaptation essay."
  function applyEveningIntervalAdaptation(weeks, raceGoal, planMeta, logs) {
    var raceDate = parseDate(raceGoal.raceDate);
    var planLengthWeeks = planMeta.planLengthWeeks;
    var byIso = {};
    weeks.forEach(function (wk) {
      wk.days.forEach(function (day, di) {
        var iso = dateToISO(dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di));
        byIso[iso] = day;
      });
    });
    var note = null;
    Object.keys(logs || {}).forEach(function (key) {
      var entry = logs[key];
      if (!entry || !entry.eveningIntervals) return;
      var parts = key.split('-');
      var wkNum = parseInt(parts[0], 10), di = parseInt(parts[1], 10);
      var loggedIso = dateToISO(dateForSlot(raceDate, planLengthWeeks, wkNum, di));
      // docs/COACHING_SPEC.md "Unplanned hard-workout adaptation" -- inspect
      // the full 48-72 hour window (the next 3 calendar days), not just the
      // next morning; stop at the FIRST genuinely conflicting hard day found
      // (a stacked recovery day for every day in the window would be
      // over-correcting for one unplanned session). Long run/race day are
      // never touched regardless of where they fall in the window.
      for (var offsetDays = 1; offsetDays <= 3; offsetDays++) {
        var candidateIso = dateToISO(new Date(parseDate(loggedIso).getTime() + offsetDays * 86400000));
        var target = byIso[candidateIso];
        if (!target || target.type === 'long' || target.type === 'race') continue;
        if (target.type === 'rest') continue; // already the lightest possible day -- nothing to downgrade
        if (target.type === 'quality') {
          target.type = 'easy';
          target.miles = round5((target.miles || 0) * 0.6);
          target.label = 'Easy recovery hike or walk';
          target.adaptedFromEveningIntervals = true;
          note = "Moved your " + (offsetDays === 1 ? 'next' : offsetDays + '-days-out') + " hard session to an easy hike/recovery pace after your unplanned evening intervals -- protects recovery without dropping the day entirely.";
          break;
        }
        // A fixed/recurring hard commitment (e.g. a Tabata class) inside the
        // window -- reduce it in place rather than skipping it outright, the
        // same 'reduced' treatment already used for a key-session conflict.
        var hardSession = (target.sessions || []).filter(function (s) { return s.loadClass === 'high'; })[0];
        if (hardSession) {
          hardSession.loadClass = 'moderate';
          hardSession.label += ' (reduced)';
          hardSession.explanation = (hardSession.explanation ? hardSession.explanation + ' ' : '') + 'Reduced after your unplanned evening intervals.';
          target.adaptedFromEveningIntervals = true;
          note = "Marked your " + (offsetDays === 1 ? 'next' : offsetDays + '-days-out') + " hard commitment reduced after your unplanned evening intervals -- your call whether to still do it at full intensity.";
          break;
        }
        if (target.type === 'easy') {
          target.miles = round5((target.miles || 0) * 0.6);
          target.label = 'Easy recovery hike or walk';
          target.adaptedFromEveningIntervals = true;
          note = "Moved your " + (offsetDays === 1 ? 'next' : offsetDays + '-days-out') + " session to an easy hike/recovery pace after your evening intervals -- protects recovery without dropping the day entirely.";
          break;
        }
      }
    });
    return note;
  }

  // ── Manual day adjustments: Shorten and Move (docs/COACHING_SPEC.md "Today
  // screen actions") -- the runner's own explicit, in-the-moment decisions
  // (make today easier, push it to another day), applied as the FINAL step
  // in the pipeline so they're never silently re-adjusted by an automatic
  // rule (missed-week dampening, evening-interval adaptation, etc.). Keyed
  // by day-key ("weekNum-dayIdx"), same identifier app.js already uses for
  // state.logs/overrides. Race day is never touched by either action.
  //
  // Scope, stated plainly: Move only applies to real running days (easy/
  // quality/long) -- a recurring-workout ('cross') day has its own separate
  // recurrence rules and moving it is a materially harder problem, not
  // built this pass. Shorten applies to any non-race day with real content.
  function applyShortenAdjustment(day, factor, units, terrainNote, weekNum, slot) {
    if (day.type === 'long') {
      day.miles = round5(Math.max(0.5, day.miles * factor));
      day.label = formatLongRunLabel(day.miles, terrainNote, units) + ' (shortened)';
    } else if (day.type === 'easy') {
      day.miles = round5(Math.max(0.5, day.miles * factor));
      day.label = formatEasyRunLabel(day.miles, units) + ' (shortened)';
    } else if (day.type === 'quality') {
      // A quality session's label is a structured prescription (e.g. "Tempo:
      // 3 x 10 min @ threshold") that can't be safely rescaled by percentage
      // without inventing a new workout -- instead give the runner a clear,
      // honest instruction to reduce it themselves, at the same pace/effort.
      day.miles = day.miles ? round5(Math.max(0.5, day.miles * factor)) : day.miles;
      day.label = day.label + ' — shortened: cut the reps/intervals by about ' + Math.round((1 - factor) * 100) + '%, same pace/effort';
    } else if (day.type === 'cross') {
      var durMatch = /(\d+)\s*min/.exec(day.label);
      if (durMatch) {
        var newMin = Math.max(10, Math.round(parseInt(durMatch[1], 10) * factor));
        day.label = day.label.replace(/\d+\s*min/, newMin + ' min') + ' (shortened)';
      } else {
        day.label = day.label + ' (shortened)';
      }
    } else {
      return false; // rest/race -- nothing to shorten
    }
    day.adjustedByUser = true;
    // Keep day.sessions[] in sync with the shortened label/miles -- same
    // staleness fix already applied to travel overrides (docs/COACHING_SPEC.md
    // "Session-level architecture"). A running-type day's primary session is
    // always 'generated' (buildRunSession reads day.type/miles/label
    // directly, safe to rebuild outright); a 'cross' day's primary session
    // may be recurring-workout-driven and isn't safely reconstructable
    // without its original workout record, so its label/duration are updated
    // in place instead.
    var primaryIdx = (day.sessions || []).findIndex(function (s) { return s.role === 'primary'; });
    if (primaryIdx !== -1) {
      if (day.type === 'cross') {
        var durM = /(\d+)\s*min/.exec(day.label);
        if (durM) day.sessions[primaryIdx].durationMinutes = parseInt(durM[1], 10);
        day.sessions[primaryIdx].label = day.label;
      } else {
        day.sessions[primaryIdx] = buildRunSession(day, weekNum, slot);
      }
    }
    return true;
  }
  function applyMoveAdjustment(source, target, units, terrainNote) {
    // Only running-type days are moveable this pass (see scope note above).
    if (['easy', 'quality', 'long'].indexOf(source.day.type) === -1) return false;
    // day.label can carry a same-day secondary session's suffix (e.g. "4.5 mi
    // easy run + 45 min Spinning / Cycling") appended AFTER the primary
    // session was built -- since only the primary content moves (a
    // coexisting secondary session, like a spin class, stays on its own
    // day), the moved label must be the primary session's own clean label,
    // not the combined day.label, or the destination day would claim to
    // include a class that never actually happens there.
    var sourcePrimary = (source.day.sessions || []).filter(function (s) { return s.role === 'primary'; })[0];
    var movedType = source.day.type, movedMiles = source.day.miles, movedLabel = (sourcePrimary && sourcePrimary.label) || source.day.label, movedRunWalk = source.day.runWalk;

    target.day.type = movedType;
    target.day.miles = movedMiles;
    target.day.label = movedLabel + ' (moved)';
    target.day.runWalk = movedRunWalk;
    target.day.movedFromKey = source.weekNum + '-' + source.slot;
    var targetPrimaryIdx = (target.day.sessions || []).findIndex(function (s) { return s.role === 'primary'; });
    var newTargetSession = buildRunSession(target.day, target.weekNum, target.slot);
    if (targetPrimaryIdx !== -1) target.day.sessions[targetPrimaryIdx] = newTargetSession;
    else target.day.sessions = [newTargetSession].concat(target.day.sessions || []);

    source.day.type = 'rest';
    source.day.miles = 0;
    source.day.runWalk = null;
    source.day.label = 'Moved to ' + target.dateLabel;
    source.day.movedToKey = target.weekNum + '-' + target.slot;
    var sourcePrimaryIdx = (source.day.sessions || []).findIndex(function (s) { return s.role === 'primary'; });
    var newSourceSession = buildRunSession(source.day, source.weekNum, source.slot);
    if (sourcePrimaryIdx !== -1) source.day.sessions[sourcePrimaryIdx] = newSourceSession;
    else source.day.sessions = [newSourceSession];
    return true;
  }
  function applyDayAdjustments(weeks, raceGoal, planMeta, dayAdjustments, units, terrainNote) {
    if (!dayAdjustments || !Object.keys(dayAdjustments).length) return weeks;
    var raceDate = parseDate(raceGoal.raceDate);
    var planLengthWeeks = planMeta.planLengthWeeks;
    var byKey = {};
    weeks.forEach(function (wk) {
      wk.days.forEach(function (day, di) {
        var d = dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di);
        byKey[wk.weekNum + '-' + di] = { day: day, weekNum: wk.weekNum, slot: di, dateLabel: DOW_LABEL[(d.getDay() + 6) % 7] + ' (' + dateToISO(d) + ')' };
      });
    });
    // 'shortened' first (self-contained, one day each) ...
    Object.keys(dayAdjustments).forEach(function (key) {
      var adj = dayAdjustments[key];
      var entry = byKey[key];
      if (!entry || !adj || entry.day.type === 'race' || adj.action !== 'shortened') return;
      applyShortenAdjustment(entry.day, adj.factor || 0.7, units, terrainNote, entry.weekNum, entry.slot);
    });
    // ... then 'moved' (touches two days, so it must see shortened values first).
    Object.keys(dayAdjustments).forEach(function (key) {
      var adj = dayAdjustments[key];
      var source = byKey[key];
      if (!adj || adj.action !== 'moved' || !source) return;
      var target = byKey[adj.targetKey];
      if (!target || source.day.type === 'race' || target.day.type === 'race') return;
      applyMoveAdjustment(source, target, units, terrainNote);
    });
    return weeks;
  }

  // ── Goal decision checkpoint: half marathon vs. 10K (docs/COACHING_SPEC.md
  // "Goal decision checkpoints") -- a dated, deterministic evidence check,
  // never a silent race change. Evaluates real signals already available in
  // this app's own data (logged long runs, weekly volume/consistency, pain
  // reports, time remaining) against the SAME EVENT_TABLE targets
  // evaluatePlanAdequacy already uses -- a checkpoint that invented its own
  // separate bar would risk disagreeing with the plan's own adequacy check.
  // Returns a recommendation the caller must explicitly confirm (see
  // app.js's goal-change-confirm screen, the same pattern already used for
  // any other mid-plan goal edit) -- never applied automatically.
  function evaluateGoalCheckpoint(profile, raceGoal, planMeta, weeks, logs, checkpointDate, today) {
    if (today < checkpointDate) return { due: false };
    var event = raceGoal.event;
    var level = planMeta.level;
    var cfg = EVENT_TABLE[event][level];

    var raceDateForCheckpoint = parseDate(raceGoal.raceDate);
    var planLengthWeeksForCheckpoint = planMeta.planLengthWeeks;
    var loggedLongRuns = [], loggedEasyOrLong = 0, totalLoggableSoFar = 0, painFlags = 0;
    weeks.forEach(function (wk) {
      wk.days.forEach(function (day, di) {
        // Only days up to and including today count toward consistency --
        // future weeks have no logs yet by definition, and counting them as
        // "loggable but missed" would artificially tank consistency for
        // every checkpoint regardless of how well the runner actually did.
        var d = dateForSlot(raceDateForCheckpoint, planLengthWeeksForCheckpoint, wk.weekNum, di);
        if (d > today) return;
        var key = wk.weekNum + '-' + di;
        var entry = logs[key];
        if (day.type === 'rest' || day.type === 'race') return;
        totalLoggableSoFar++;
        if (!entry) return;
        loggedEasyOrLong++;
        if (day.type === 'long' && entry.distance != null) loggedLongRuns.push(entry.distance);
        if (entry.pain && (entry.pain.severity >= 4 || entry.pain.recurrent)) painFlags++;
      });
    });
    var bestLongRun = loggedLongRuns.length ? Math.max.apply(null, loggedLongRuns) : 0;
    var consistency = totalLoggableSoFar ? loggedEasyOrLong / totalLoggableSoFar : 0;
    var weeksRemaining = Math.max(0, Math.round((parseDate(raceGoal.raceDate) - today) / (7 * 86400000)));

    var halfCfg = EVENT_TABLE.half[level];
    var tenkCfg = EVENT_TABLE['10k'][level];
    // Deliberately conservative bar, matching evaluatePlanAdequacy's own
    // tolerance philosophy: real evidence of a long run reaching most of
    // the half's target, reasonable consistency, no recent recurring/
    // severe pain, and enough weeks left for taper.
    var halfReady = bestLongRun >= halfCfg.longRunPeak * 0.7 && consistency >= 0.7 && painFlags === 0 && weeksRemaining >= halfCfg.taperWeeks + 1;

    var recommendation = halfReady ? 'keep_half' : 'switch_10k';
    return {
      due: true,
      recommendation: recommendation,
      evidence: { bestLongRun: round5(bestLongRun), consistency: Math.round(consistency * 100), painFlags: painFlags, weeksRemaining: weeksRemaining, halfLongRunTarget: halfCfg.longRunPeak, tenkLongRunTarget: tenkCfg.longRunPeak }
    };
  }

  function formatGoalCheckpointMessage(checkpoint, currentEvent) {
    if (!checkpoint || !checkpoint.due) return null;
    var ev = checkpoint.evidence;
    if (checkpoint.recommendation === 'keep_half') {
      return 'Your training since the checkpoint supports staying with the half marathon: a ' + ev.bestLongRun + '-mi long run logged, ' + ev.consistency + '% of sessions completed, and no recent pain flags, with ' + ev.weeksRemaining + ' weeks still ahead for a proper taper.';
    }
    return "Based on what's actually been logged since the checkpoint -- longest run so far is " + ev.bestLongRun + ' mi (the half\'s build targets around ' + ev.halfLongRunTarget + ' mi), ' + ev.consistency + '% of sessions completed' + (ev.painFlags ? ', and ' + ev.painFlags + ' recent pain report(s) worth factoring in' : '') + ' -- a 10K would let your training actually catch up to the goal instead of racing underprepared. This isn\'t a setback, just matching the race to where your training actually is right now. You decide -- this never changes automatically.';
  }

  // ── Full generation pipeline (docs/COACHING_SPEC.md) -- mirrors app.js's
  // generateAll exactly: build -> exclude unavailable days -> adapt to a
  // missed week -> (if nothing was already adapted) adapt to an RPE trend.
  // Lets tests/plan-scenarios.test.js exercise the real end-to-end pipeline
  // instead of a hand-reconstructed approximation of it.
  function generatePlan(profile, raceGoal, planMeta, logs, today, unavailable, units, recurringWorkouts, travelPeriods, scheduleChoices, dayAdjustments) {
    var weeks = buildStructuredWeeks(profile, raceGoal, planMeta, units, recurringWorkouts, scheduleChoices);
    var terrainNote = terrainNoteFrom(profile.terrains);
    weeks = applyTravelPeriods(weeks, raceGoal, planMeta, travelPeriods, units, terrainNote);
    weeks = applyUnavailableRanges(weeks, raceGoal, planMeta, unavailable, units, terrainNote);
    var adjusted = applyMissedAdjustment(weeks, raceGoal, planMeta, logs, today, terrainNote, units);
    if (!adjusted.note) {
      var diffNote = applyDifficultyAdjustment(adjusted.weeks, raceGoal, planMeta, logs, today, terrainNote, units);
      if (diffNote) adjusted.note = diffNote;
    }
    if (!adjusted.note) {
      var eveningNote = applyEveningIntervalAdaptation(adjusted.weeks, raceGoal, planMeta, logs);
      if (eveningNote) adjusted.note = eveningNote;
    }
    // docs/COACHING_SPEC.md "Today screen actions" -- the runner's own
    // explicit Shorten/Move decisions are the final word, applied after
    // every automatic adaptation so nothing silently re-adjusts a choice
    // the runner just made themselves.
    adjusted.weeks = applyDayAdjustments(adjusted.weeks, raceGoal, planMeta, dayAdjustments, units, terrainNote);
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

  // ── Coach-negotiated day trades (recovery is a weekly requirement, not an
  // immovable calendar date) ────────────────────────────────────────────
  // A day's TYPE is still always one of these -- the same enum
  // buildStructuredWeeks/normalizeWorkout already use everywhere else.
  // What's new is that the coach can now propose a *typed* override (real
  // type + label + duration/distance, not just a label string) for one or
  // more days at once, and this module is the single place that decides
  // whether that proposal is actually allowed -- the AI proposes, this
  // decides (never the reverse).
  var ALLOWED_OVERRIDE_TYPES = ['easy', 'long', 'quality', 'cross', 'rest'];

  // A week must always keep at least this many real rest days -- matches
  // assignWeekTemplate's own guaranteed-rest-day design (it deliberately
  // caps run/cross slots at 6 of 7 so one day is always structurally left
  // as 'rest'). Recovery is enforced at this granularity (a whole day),
  // not partial credit for an easy or cross day -- moving the day is fine,
  // dropping it to zero recovery days is not.
  var REQUIRED_RECOVERY_DAYS_PER_WEEK = 1;

  // Days that represent real, race-specific training the plan is actually
  // built around -- silently losing one of these to a rest-day swap is
  // exactly the "silently discard a protected workout" failure this whole
  // feature exists to prevent.
  var KEY_WORKOUT_TYPES = ['long', 'quality'];

  function isRaceDay(day) { return !!day && day.type === 'race'; }
  function isKeyWorkoutType(type) { return KEY_WORKOUT_TYPES.indexOf(type) !== -1; }

  // ── Known custom-workout phrase table (task 14: "the same architecture
  // must support running, hiking, cycling, fitness classes, strength,
  // incline walking, and other custom workouts -- not only 12-3-30"). This
  // is deliberately a data table, not one-off string matching, so adding a
  // new recognized phrase later is one array entry, not new logic. Each
  // entry's `pattern` is tested against the runner's raw free-text request
  // so the effective workout is always a deterministic, known-good object --
  // never trusted from the AI's own wording for a phrase this table already
  // recognizes.
  var KNOWN_WORKOUT_PHRASES = [
    {
      // Matches "12 3 30", "12-3-30", "12/3/30" (any separator, optional
      // "incline walk"/"treadmill" suffix words), case-insensitive.
      pattern: /\b12[\s\-\/]?3[\s\-\/]?30\b/i,
      workout: { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null }
    }
  ];

  function normalizeKnownWorkoutPhrase(text) {
    if (typeof text !== 'string' || !text) return null;
    for (var i = 0; i < KNOWN_WORKOUT_PHRASES.length; i++) {
      if (KNOWN_WORKOUT_PHRASES[i].pattern.test(text)) {
        // Shallow copy -- callers may attach extra fields (e.g. source)
        // without mutating the shared table entry.
        var w = KNOWN_WORKOUT_PHRASES[i].workout;
        return { type: w.type, label: w.label, durationMinutes: w.durationMinutes, plannedDistance: w.plannedDistance };
      }
    }
    return null;
  }

  // Applies `changes` ({key, workout:{type,label,durationMinutes,
  // plannedDistance}}) to `weekDays` (a plain array of {key, type, label}
  // covering every day currently visible to the coach, already excluding
  // race days at the caller's level) and decides whether the resulting
  // week is allowed. Pure and deterministic -- same inputs, same verdict,
  // every time. Returns:
  //   { ok: true, resultingWeek: [...] }
  //   { ok: false, reason: '<code>', displaced: [...] } -- reason is one of
  //     'no_changes' | 'unknown_key' | 'duplicate_key' | 'race_day_protected'
  //     | 'invalid_workout' | 'would_displace_key_workout' | 'insufficient_recovery'
  // `options.confirmDisplacement` (array of day keys) lets a change that
  // would otherwise displace a long/quality day through anyway -- set only
  // when the runner has explicitly agreed the displaced workout is skipped
  // or the proposed changes themselves relocate it to another day in the
  // SAME change set (checked automatically, no confirmation needed for
  // that case).
  function validateRescheduleDays(weekDays, changes, options) {
    options = options || {};
    var confirmDisplacement = {};
    (options.confirmDisplacement || []).forEach(function (k) { confirmDisplacement[k] = true; });

    if (!Array.isArray(changes) || !changes.length) return { ok: false, reason: 'no_changes', displaced: [] };

    var byKey = {};
    (weekDays || []).forEach(function (d) { if (d && d.key != null) byKey[d.key] = d; });

    var seenKeys = {};
    for (var i = 0; i < changes.length; i++) {
      var change = changes[i];
      if (!change || change.key == null || !change.workout || typeof change.workout !== 'object') {
        return { ok: false, reason: 'invalid_workout', displaced: [] };
      }
      if (seenKeys[change.key]) return { ok: false, reason: 'duplicate_key', displaced: [] };
      seenKeys[change.key] = true;

      var currentDay = byKey[change.key];
      if (!currentDay) return { ok: false, reason: 'unknown_key', displaced: [] };
      if (isRaceDay(currentDay)) return { ok: false, reason: 'race_day_protected', displaced: [] };

      var w = change.workout;
      if (ALLOWED_OVERRIDE_TYPES.indexOf(w.type) === -1) return { ok: false, reason: 'invalid_workout', displaced: [] };
      if (typeof w.label !== 'string' || !w.label.trim() || w.label.length > 80) return { ok: false, reason: 'invalid_workout', displaced: [] };
      if (w.durationMinutes != null && (typeof w.durationMinutes !== 'number' || !isFinite(w.durationMinutes) || w.durationMinutes < 0 || w.durationMinutes > 600)) {
        return { ok: false, reason: 'invalid_workout', displaced: [] };
      }
      if (w.plannedDistance != null && (typeof w.plannedDistance !== 'number' || !isFinite(w.plannedDistance) || w.plannedDistance < 0 || w.plannedDistance > 200)) {
        return { ok: false, reason: 'invalid_workout', displaced: [] };
      }
    }

    // Displacement check: any change that moves a currently long/quality
    // day to a different type loses that key workout unless the SAME
    // change set relocates a matching type to another day, or the caller
    // explicitly confirmed the skip for that key.
    var incomingKeyTypes = {}; // type -> count of changes introducing that type
    changes.forEach(function (c) { incomingKeyTypes[c.workout.type] = (incomingKeyTypes[c.workout.type] || 0) + 1; });
    var displaced = [];
    changes.forEach(function (c) {
      var currentDay = byKey[c.key];
      if (!isKeyWorkoutType(currentDay.type) || currentDay.type === c.workout.type) return;
      if (confirmDisplacement[c.key]) return;
      // Relocated within this same change set? (e.g. the long run's slot
      // becomes recovery, and another change in this same set gives a
      // different day type 'long') -- consumes one relocation credit so
      // two displaced long runs can't both claim the same single relocation.
      if (incomingKeyTypes[currentDay.type] > 0) { incomingKeyTypes[currentDay.type]--; return; }
      displaced.push({ key: c.key, type: currentDay.type, label: currentDay.label });
    });
    if (displaced.length) return { ok: false, reason: 'would_displace_key_workout', displaced: displaced };

    // Recovery-sufficiency check: apply the changes to a copy of the week
    // and count real 'rest' days left. Never hard-codes which day -- only
    // the resulting weekly structure matters.
    var resultingWeek = (weekDays || []).map(function (d) {
      var change = changes.filter(function (c) { return c.key === d.key; })[0];
      return change ? { key: d.key, type: change.workout.type, label: change.workout.label } : { key: d.key, type: d.type, label: d.label };
    });
    var restDaysLeft = resultingWeek.filter(function (d) { return d.type === 'rest'; }).length;
    if (restDaysLeft < REQUIRED_RECOVERY_DAYS_PER_WEEK) return { ok: false, reason: 'insufficient_recovery', displaced: [] };

    return { ok: true, resultingWeek: resultingWeek };
  }

  return {
    LEVELS: LEVELS,
    EVENT_TABLE: EVENT_TABLE,
    EVENT_LABEL: EVENT_LABEL,
    PUBLIC_EVENTS: PUBLIC_EVENTS,
    visibleEventsFor: visibleEventsFor,
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
    evaluatePlanAdequacy: evaluatePlanAdequacy,
    formatPlanAdequacyWarning: formatPlanAdequacyWarning,
    choosePlanLength: choosePlanLength,
    RECURRING_ACTIVITY_TYPES: RECURRING_ACTIVITY_TYPES,
    RECURRING_ACTIVITY_LABEL: RECURRING_ACTIVITY_LABEL,
    RECURRING_ACTIVITY_PROFILE: RECURRING_ACTIVITY_PROFILE,
    classifyRecurringWorkout: classifyRecurringWorkout,
    evaluateRecurringWorkoutSchedule: evaluateRecurringWorkoutSchedule,
    detectKeySessionConflict: detectKeySessionConflict,
    applyDayAdjustments: applyDayAdjustments,
    generateRecurringWorkoutNotes: generateRecurringWorkoutNotes,
    formatRecurringWorkoutLabel: formatRecurringWorkoutLabel,
    formatRecurringWorkoutsLabel: formatRecurringWorkoutsLabel,
    INCLINE_WALK_TEMPLATES: INCLINE_WALK_TEMPLATES,
    inclineWalkParams: inclineWalkParams,
    evaluateInclineWalkSafety: evaluateInclineWalkSafety,
    buildCrossTrainingPrescription: buildCrossTrainingPrescription,
    classifyHikeLoad: classifyHikeLoad,
    buildHikePrescription: buildHikePrescription,
    computeCombinedDailyLoad: computeCombinedDailyLoad,
    normalizeRecurringWorkout: normalizeRecurringWorkout,
    isRecurringWorkoutActiveInWeek: isRecurringWorkoutActiveInWeek,
    weeklyAvailabilityCanRunSlots: weeklyAvailabilityCanRunSlots,
    applyTravelPeriods: applyTravelPeriods,
    applyEveningIntervalAdaptation: applyEveningIntervalAdaptation,
    evaluateGoalCheckpoint: evaluateGoalCheckpoint,
    formatGoalCheckpointMessage: formatGoalCheckpointMessage,
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
    formatRunWalkLabel: formatRunWalkLabel,
    ALLOWED_OVERRIDE_TYPES: ALLOWED_OVERRIDE_TYPES,
    REQUIRED_RECOVERY_DAYS_PER_WEEK: REQUIRED_RECOVERY_DAYS_PER_WEEK,
    KEY_WORKOUT_TYPES: KEY_WORKOUT_TYPES,
    isRaceDay: isRaceDay,
    isKeyWorkoutType: isKeyWorkoutType,
    normalizeKnownWorkoutPhrase: normalizeKnownWorkoutPhrase,
    validateRescheduleDays: validateRescheduleDays
  };
});

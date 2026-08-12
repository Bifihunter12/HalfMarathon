(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZaeraCoachingCues = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Deterministic coaching-cue engine (docs/COACHING_ENGINE_SPEC.md) ────
  // This module owns: the structured cue catalog, cue eligibility rules,
  // priority-based selection, and frequency/silence scheduling. It does
  // NOT own timing or transitions -- workout-runner.js's state machine
  // remains sole authority for those; this module only ever reads a
  // coaching-context snapshot (coaching-context.js) built from it and
  // decides what, if anything, is worth saying right now. It never
  // mutates workout state, never advances a segment, never completes a
  // workout. audio-cues.js remains the only thing that actually speaks.
  //
  // Data truthfulness is structural, not a runtime check sprinkled around:
  // every cue that would require live pace/heart-rate data has
  // requiresData naming the exact context field(s) it needs, and step 2 of
  // selectCoachingCue removes any cue whose required field is null before
  // anything else runs. Since coaching-context.js can only ever produce a
  // null sensor snapshot in this app (docs/COACHING_ENGINE_SPEC.md's
  // audit -- no GPS, no heart-rate capability exists anywhere in this
  // codebase), every pace/HR-gated cue below is real, tested, correctly
  // wired code that is nonetheless permanently inert until a real sensor
  // integration exists. That is intentional, not a bug -- see the final
  // report for why this is not "pretending" live coaching exists.

  var PRIORITY = { SAFETY: 1, TRANSITION: 2, TRANSITION_WARNING: 3, SENSOR_CORRECTIVE: 4, PROGRESS: 5, TECHNIQUE: 6, ENCOURAGEMENT: 7 };
  // 'introduction' and 'completion' are pinned to TRANSITION's priority --
  // both are essential, always-say-it moments (the task's priority table
  // only lists 7 categories; these two are the "always happens once"
  // bookends of a workout, so they get the same non-optional standing as a
  // segment transition, never competing with optional coaching).
  var CATEGORY_PRIORITY = {
    safety: PRIORITY.SAFETY,
    introduction: PRIORITY.TRANSITION,
    transition: PRIORITY.TRANSITION,
    completion: PRIORITY.TRANSITION,
    transition_warning: PRIORITY.TRANSITION_WARNING,
    sensor_corrective: PRIORITY.SENSOR_CORRECTIVE,
    progress: PRIORITY.PROGRESS,
    technique: PRIORITY.TECHNIQUE,
    effort: PRIORITY.TECHNIQUE,
    posture: PRIORITY.TECHNIQUE,
    stride: PRIORITY.TECHNIQUE,
    breathing: PRIORITY.TECHNIQUE,
    recovery_guidance: PRIORITY.TECHNIQUE,
    warmup_guidance: PRIORITY.TECHNIQUE,
    encouragement: PRIORITY.ENCOURAGEMENT
  };
  // Every "optional" (non-essential-transition) category, for frequency
  // gating -- these are the ones subject to minimum-gap/frequency-mode
  // suppression. Safety/transition/transition_warning/progress/
  // introduction/completion always get a chance to speak regardless of
  // frequency mode (per "Speak every segment transition... Provide one
  // halfway update... Announce the final interval" being true even in
  // Minimal mode).
  var OPTIONAL_CATEGORIES = ['sensor_corrective', 'technique', 'effort', 'posture', 'stride', 'breathing', 'recovery_guidance', 'warmup_guidance', 'encouragement'];

  var FREQUENCY_PRESETS = {
    // Minimal: essentials only, zero optional coaching.
    minimal: { allowedOptionalCategories: [], minOptionalGapSec: Infinity },
    // Coach (default): the task's own default numbers -- one optional cue
    // roughly every 3-5 min, never closer than 90s apart.
    coach: { allowedOptionalCategories: ['sensor_corrective', 'technique', 'effort', 'posture', 'stride', 'breathing', 'recovery_guidance', 'warmup_guidance', 'encouragement'], minOptionalGapSec: 180 },
    // Detailed: more frequent, but the task is explicit that even Detailed
    // "must preserve meaningful silence" -- 90s is the floor used
    // elsewhere in this file (post-transition silence window), so Detailed
    // never goes below it either.
    detailed: { allowedOptionalCategories: ['sensor_corrective', 'technique', 'effort', 'posture', 'stride', 'breathing', 'recovery_guidance', 'warmup_guidance', 'encouragement'], minOptionalGapSec: 90 }
  };

  // No optional cue may ever fire in the first ~25s of a segment (task:
  // "Do not speak during the first 20-30 seconds after a transition unless
  // required" -- 25 is the midpoint of that range, used consistently).
  var POST_TRANSITION_SILENCE_SEC = 25;

  function defaultCoachingPreferences() {
    return { frequency: 'coach', technique: true, encouragement: true, paceFeedback: true, heartRateFeedback: true };
  }

  // ── Workout-type classification (pure, from data this app actually has) ─
  // Derives a semantic coaching workoutType from the plan engine's day
  // object + the workout-runner normalizer's output -- never a new field
  // invented on `day` itself. 'recovery' is deliberately NOT a distinct
  // type here: nothing in this app's data model marks a day as a distinct
  // "recovery run" (only day.type: easy/long/quality/cross/rest/race
  // exists) -- see docs/COACHING_ENGINE_SPEC.md's audit. Recovery-run
  // phrasing is folded into 'easy' instead of invented from an unreliable
  // signal.
  function classifyWorkoutForCoaching(day, normalized) {
    if (!day || !normalized) return null;
    if (day.runWalk) return 'run_walk';
    if (day.type === 'cross') return 'cross';
    if (day.type === 'quality') {
      // Entry-tier quality entries like "Easy + strides" carry no
      // qualitySegments/qualityManualReps (no pace is ever invented for
      // them -- see QUALITY_POOL's own comment), so normalizeWorkout falls
      // all the way through to the honest open-stopwatch fallback
      // (mode === 'continuous_open'). That's genuinely an easy effort, not
      // a tempo -- coach it as 'easy' so the intro/transition language
      // matches what's actually on screen instead of defaulting to tempo.
      if (normalized.mode === 'continuous_open') return 'easy';
      var workSegs = normalized.segments.filter(function (s) { return s.kind === 'work' || s.kind === 'manual_rep'; });
      var totalIntervals = workSegs.length ? (workSegs[0].totalIntervals || 1) : 1;
      if (normalized.mode === 'guided_manual') return 'intervals_manual';
      if (totalIntervals > 1) return 'intervals_time';
      return 'tempo';
    }
    if (day.type === 'easy') return 'easy';
    if (day.type === 'long') return 'long';
    return null;
  }

  // 'hills' terrain hint -- based on the plan's own fixed catalog label
  // text (e.g. "Hills: 6 x 2 min uphill"), never invented/guessed from
  // elevation data this app doesn't have.
  function detectTerrainHint(label) {
    return (label && /\bhill/i.test(label)) ? 'hills' : null;
  }

  // ── Progressive teaching focus (docs/COACHING_ENGINE_SPEC.md) ───────────
  // Deterministically rotates through a fixed topic list, skipping any
  // topic already taught in the last N workouts (by distinct workoutId in
  // cueHistory) so the same lesson doesn't repeat every session. Pure and
  // stable -- same history in, same focus out, no randomness.
  var TEACHING_TOPICS = ['talk_test_effort', 'relaxed_shoulders', 'short_light_stride', 'controlled_breathing', 'pacing_first_interval', 'hill_effort'];
  // Human-readable label for the pre-workout preview's "Today's focus" line
  // -- co-located with TEACHING_TOPICS so the two can never drift apart.
  var TOPIC_LABEL = {
    talk_test_effort: 'easy effort and the talk test',
    relaxed_shoulders: 'relaxed shoulders and hands',
    short_light_stride: 'short, light strides',
    controlled_breathing: 'controlled breathing',
    pacing_first_interval: 'pacing the first interval',
    hill_effort: 'controlling effort on hills'
  };
  var TOPIC_LOOKBACK_WORKOUTS = 3; // don't repeat a topic taught in the last 3 distinct workouts

  function availableTeachingTopics(workoutType, terrainHint) {
    var topics = ['relaxed_shoulders', 'short_light_stride', 'controlled_breathing'];
    if (workoutType === 'easy' || workoutType === 'long' || workoutType === 'run_walk') topics.unshift('talk_test_effort');
    if (workoutType === 'intervals_time' || workoutType === 'intervals_manual') topics.unshift('pacing_first_interval');
    if (terrainHint === 'hills') topics.unshift('hill_effort');
    return topics;
  }

  function buildCoachingFocus(cueHistory, workoutId, availableTopics) {
    cueHistory = cueHistory || [];
    var topicPool = (availableTopics && availableTopics.length ? availableTopics : TEACHING_TOPICS).filter(function (t) { return TEACHING_TOPICS.indexOf(t) !== -1; });
    if (!topicPool.length) return null;
    var recentWorkoutIds = [];
    var taughtByWorkout = {};
    cueHistory.forEach(function (h) {
      if (!h || !h.topic || !h.workoutId || h.workoutId === workoutId) return;
      if (recentWorkoutIds.indexOf(h.workoutId) === -1) recentWorkoutIds.push(h.workoutId);
      taughtByWorkout[h.workoutId] = taughtByWorkout[h.workoutId] || [];
      taughtByWorkout[h.workoutId].push(h.topic);
    });
    var recentTopics = recentWorkoutIds.slice(-TOPIC_LOOKBACK_WORKOUTS).reduce(function (acc, wid) {
      return acc.concat(taughtByWorkout[wid] || []);
    }, []);
    var candidate = topicPool.filter(function (t) { return recentTopics.indexOf(t) === -1; })[0];
    if (candidate) return candidate;
    // Every topic was taught recently -- fall back to a deterministic
    // rotation by total distinct-workout count instead of repeating the
    // very last one taught.
    return topicPool[recentWorkoutIds.length % topicPool.length];
  }

  // ── Deterministic text-variant rotation ─────────────────────────────────
  // No Math.random() anywhere (task: "do not use randomness that makes
  // tests unreliable") -- rotates through a cue's textVariants based on how
  // many times that exact cueId already appears in the full workout
  // history, so the same context always yields the same variant, but a
  // cue repeated across a longer workout doesn't say the identical
  // sentence every time either.
  function pickVariant(cue, context) {
    var timesUsed = (context.fullCueHistory || []).filter(function (h) { return h.cueId === cue.id; }).length;
    var variants = cue.textVariants || [cue.text];
    return variants[timesUsed % variants.length];
  }

  function resolveText(cue, context) {
    if (typeof cue.buildText === 'function') return cue.buildText(context);
    return pickVariant(cue, context);
  }

  // ── Cue catalog ──────────────────────────────────────────────────────
  // Every entry's fields match docs/COACHING_ENGINE_SPEC.md's schema.
  // applicableWorkoutTypes/applicableSegmentTypes: null means "any".
  var UNITS_LABEL = { mi: 'mile', km: 'kilometer' };
  function fmtPace(secPerMi, units) {
    var sec = units === 'km' ? secPerMi / 1.60934 : secPerMi;
    var m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }
  function fmtDuration(sec) {
    sec = Math.max(1, Math.round(sec));
    if (sec < 60) return sec + ' second' + (sec === 1 ? '' : 's');
    var minutes = Math.floor(sec / 60), remainder = sec % 60;
    var text = minutes + ' minute' + (minutes === 1 ? '' : 's');
    if (remainder) text += ' ' + remainder + ' second' + (remainder === 1 ? '' : 's');
    return text;
  }
  function phaseCue(ctx) {
    switch (ctx.trainingPhase) {
      case 'base': return 'This is base work: patient, repeatable, and almost boring when done right.';
      case 'build': return 'This is build work: enough stress to adapt, not so much that tomorrow falls apart.';
      case 'peak': return 'This is peak work: protect the key stimulus and leave the extras alone.';
      case 'taper': return 'This is taper work: stay sharp, stay fresh, and do not test fitness today.';
      case 'race': return 'This is race-week work: calm, short, and nothing new.';
      default: return null;
    }
  }
  function workoutPurpose(ctx) {
    switch (ctx.workoutType) {
      case 'easy': return 'You are building the aerobic engine today. If it feels almost too easy, that is usually right.';
      case 'long': return 'The long run is about steady time on feet. Spend energy slowly so you still own the finish.';
      case 'tempo': return 'Tempo work should feel controlled-hard. You are practicing pressure, not strain.';
      case 'intervals_time':
      case 'intervals_manual': return 'Intervals teach speed and economy. The first reps should feel controlled enough to match later.';
      case 'run_walk': return 'Run-walk is real training. Keep the run portions easy enough that the walk breaks stay calm.';
      case 'cross': return 'Cross-training supports the running plan without adding the same impact load.';
      default: return null;
    }
  }
  function introLine(ctx, base) {
    var phase = phaseCue(ctx);
    return base + (phase ? ' ' + phase : '');
  }
  function postRunLine(ctx) {
    switch (ctx.workoutType) {
      case 'long': return ' Walk a few minutes, get fluids and food in, and note any hot spots before they become problems.';
      case 'tempo':
      case 'intervals_time':
      case 'intervals_manual': return ' Take the recovery seriously: easy movement, fluids, carbs, and protein will help this workout land.';
      case 'run_walk': return ' Log how it felt, especially whether the run portions stayed relaxed.';
      case 'cross': return ' Log the effort honestly so the plan can respect the load.';
      default: return ' Log how it felt. No need to judge it from one run.';
    }
  }

  var CUE_CATALOG = [
    // ── Safety (priority 1) -- always eligible, no data requirements ──
    {
      id: 'safety_general', category: 'safety', applicableWorkoutTypes: null, applicableSegmentTypes: null,
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      textVariants: ['Stop the workout if you feel chest pain, faintness, unusual shortness of breath, or feel unsafe.']
    },

    // ── Introduction (once, at workout start) ──
    {
      id: 'intro_easy', category: 'introduction', applicableWorkoutTypes: ['easy'], applicableSegmentTypes: null,
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      buildText: function (ctx) { return introLine(ctx, 'Today is an easy run. Keep it conversational; the easy feeling is the point.'); }
    },
    {
      id: 'intro_long', category: 'introduction', applicableWorkoutTypes: ['long'], applicableSegmentTypes: null,
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      buildText: function (ctx) { return introLine(ctx, 'Today is your long run. Start calm; finishing steady matters more than proving speed early.'); }
    },
    {
      id: 'intro_tempo', category: 'introduction', applicableWorkoutTypes: ['tempo'], applicableSegmentTypes: null,
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      buildText: function (ctx) { return introLine(ctx, 'Today is a tempo effort. Find controlled-hard, then hold it without forcing.'); }
    },
    {
      id: 'intro_intervals', category: 'introduction', applicableWorkoutTypes: ['intervals_time', 'intervals_manual'], applicableSegmentTypes: null,
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      buildText: function (ctx) { return introLine(ctx, 'Today is ' + (ctx.segmentCount ? Math.max(1, Math.round((ctx.segmentCount - 1) / 2)) : 'several') + ' intervals with recovery between. Earn the last rep by keeping the first one controlled.'); }
    },
    {
      id: 'intro_run_walk', category: 'introduction', applicableWorkoutTypes: ['run_walk'], applicableSegmentTypes: null,
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      buildText: function (ctx) { return introLine(ctx, 'Today is run-walk. The walk breaks are part of the workout, not a backup plan.'); }
    },
    {
      id: 'intro_cross', category: 'introduction', applicableWorkoutTypes: ['cross'], applicableSegmentTypes: null,
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      buildText: function (ctx) { return introLine(ctx, 'Today is purposeful cross-training. Build fitness while giving your running legs a break.'); }
    },

    // ── Immediate transitions (priority 2) -- one per segment kind ──
    {
      id: 'trans_warmup', category: 'transition', applicableWorkoutTypes: null, applicableSegmentTypes: ['warmup'],
      triggerEvents: ['segment_start'],
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      buildText: function (ctx) { return 'Begin your warm-up.' + (ctx.segmentRemainingSec ? ' Walk comfortably for ' + fmtDuration(ctx.segmentRemainingSec) + '.' : ' Walk comfortably to start.'); }
    },
    {
      id: 'trans_work_start', category: 'transition', applicableWorkoutTypes: null, applicableSegmentTypes: ['work', 'continuous'],
      triggerEvents: ['segment_start', 'final_interval'],
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: null,
      buildText: function (ctx) {
        if (ctx.isFinalInterval) return 'Final running interval. Strong and smooth, not desperate.';
        var intervalPart = ctx.segmentTotalIntervals > 1 ? 'Interval ' + ctx.segmentIntervalNumber + ' of ' + ctx.segmentTotalIntervals + '. ' : '';
        var durationPart = ctx.segmentRemainingSec ? ' for ' + fmtDuration(ctx.segmentRemainingSec) : '';
        var effort = ctx.prescribedPaceMin != null && ctx.prescribedPaceMax != null
          ? ' Settle into your planned pace of ' + fmtPace(ctx.prescribedPaceMin, ctx.units) + ' to ' + fmtPace(ctx.prescribedPaceMax, ctx.units) + ' per ' + UNITS_LABEL[ctx.units] + durationPart + '.'
          : ctx.workoutType === 'tempo'
            ? ' Settle into a comfortably hard, controlled effort' + durationPart + '.'
            : (ctx.workoutType === 'intervals_time' || ctx.workoutType === 'intervals_manual')
              ? ' Run strong but controlled' + durationPart + '. Save enough to make the last rep look like this one.'
              : ctx.workoutType === 'cross'
                ? ' Keep this session controlled' + durationPart + '.'
                : ' Keep an easy, conversational effort' + durationPart + '. If it feels too easy, good.';
        return 'Start running.' + (intervalPart ? ' ' + intervalPart.trim() : '') + effort;
      }
    },
    {
      id: 'trans_manual_rep_start', category: 'transition', applicableWorkoutTypes: null, applicableSegmentTypes: ['manual_rep'],
      triggerEvents: ['segment_start', 'final_interval'],
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: null,
      buildText: function (ctx) {
        if (ctx.isFinalInterval) return 'Final repetition. Run it strong and controlled, then mark it done when you finish.';
        return 'Repetition ' + ctx.segmentIntervalNumber + ' of ' + ctx.segmentTotalIntervals + '. Match the planned effort, then mark it done when you finish.';
      }
    },
    {
      id: 'trans_recovery_start', category: 'transition', applicableWorkoutTypes: null, applicableSegmentTypes: ['recovery'],
      triggerEvents: ['segment_start'],
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: null,
      buildText: function (ctx) {
        // Personalized HR recovery target only if genuinely available --
        // this app has no HR capability at all, so this branch is real,
        // tested code that never actually executes yet (see audit).
        if (ctx.personalizedHrZones && ctx.personalizedHrZones.recoveryMin != null && ctx.personalizedHrZones.recoveryMax != null) {
          return 'Your recovery range is ' + ctx.personalizedHrZones.recoveryMin + ' to ' + ctx.personalizedHrZones.recoveryMax + ' beats per minute. Keep walking and let your heart rate come down gradually.';
        }
        return 'Begin walking recovery. Let your breathing settle.';
      }
    },
    {
      id: 'trans_cooldown', category: 'transition', applicableWorkoutTypes: null, applicableSegmentTypes: ['cooldown'],
      triggerEvents: ['segment_start'],
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      buildText: function (ctx) { return 'Begin your cooldown. Walk easily and allow your breathing to settle.'; }
    },
    {
      id: 'trans_paused', category: 'transition', applicableWorkoutTypes: null, applicableSegmentTypes: null,
      triggerEvents: ['paused'],
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: null,
      textVariants: ['Workout paused.']
    },
    {
      id: 'trans_resumed', category: 'transition', applicableWorkoutTypes: null, applicableSegmentTypes: null,
      triggerEvents: ['resumed'],
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: null,
      textVariants: ['Workout resumed.']
    },

    // ── Transition warning (priority 3) ──
    {
      id: 'warn_10s', category: 'transition_warning', applicableWorkoutTypes: null, applicableSegmentTypes: null,
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: null,
      textVariants: ['Ten seconds.', 'Ten seconds until your next interval.']
    },

    // ── Progress (priority 5) ──
    {
      id: 'progress_halfway', category: 'progress', applicableWorkoutTypes: null, applicableSegmentTypes: null,
      triggerEvents: ['halfway'],
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      // docs section 15.2 -- "one cue is better than five instructions" but
      // also "vary wording naturally": this fires on essentially every
      // workout with a real duration, so a single fixed sentence would be
      // the single most-repeated line in the whole app. pickVariant already
      // rotates deterministically by how many times this exact cueId
      // appears in the runner's full cue history -- these three just give
      // it real variety to rotate through.
      textVariants: [
        'You\'re halfway. Stay relaxed; this should still feel sustainable.',
        'Halfway there. Do not spend energy you will want later.',
        'That is the halfway point. Keep doing exactly what today asks for.'
      ]
    },
    {
      id: 'progress_final_third', category: 'progress', applicableWorkoutTypes: null, applicableSegmentTypes: null,
      triggerEvents: ['final_third'],
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      textVariants: [
        'You\'re into the final third. Stay smooth and finish this the way you started.',
        'Final stretch now. Keep the effort honest, not heroic.',
        'You are in the closing third. Hold the same effort; do not chase the finish.'
      ]
    },

    // ── Completion (once, terminal) ──
    {
      id: 'completion_full', category: 'completion', applicableWorkoutTypes: null, applicableSegmentTypes: null,
      experienceLevels: null, minimumSegmentDurationSec: 0, earliestSegmentOffsetSec: 0, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      // buildText bypasses pickVariant's automatic rotation entirely (see
      // resolveText), so this cue -- heard at the end of literally every
      // workout -- picks its own opener the same deterministic way
      // pickVariant does (rotate by how many times this exact cueId
      // already appears in the runner's full history), so "Mission
      // complete." isn't the identical sentence hundreds of workouts in a
      // row (docs 15.2's own explicit anti-repetition requirement).
      buildText: function (ctx) {
        var openers = ['Mission complete.', 'Workout complete. You showed up and did the work.', 'That\'s a wrap — nice work out there.'];
        var timesUsed = (ctx.fullCueHistory || []).filter(function (h) { return h.cueId === 'completion_full'; }).length;
        var opener = openers[timesUsed % openers.length];
        var intervalNote = ctx.completedIntervalCount ? ' You completed all ' + ctx.completedIntervalCount + ' running intervals.' : '';
        return opener + intervalNote + postRunLine(ctx);
      }
    },

    // ── Sensor-corrective (priority 4) -- requires live pace/HR, so these
    // are permanently inert in this app today (requiresData enforced at
    // step 2 of selectCoachingCue) -- kept here because the ARCHITECTURE
    // must be ready for Tier 2/3, per the task, without ever firing early. ──
    {
      id: 'pace_too_fast', category: 'sensor_corrective', applicableWorkoutTypes: null, applicableSegmentTypes: ['work', 'continuous'],
      experienceLevels: null, minimumSegmentDurationSec: 60, earliestSegmentOffsetSec: 30, latestSegmentOffsetSec: null,
      minimumGapSec: 100, requiresData: ['livePace', 'prescribedPaceMin', 'prescribedPaceMax'], conflictsWith: ['encouragement'], maxPerWorkout: null,
      textVariants: ['You\'re a little faster than today\'s target. Ease back and stay controlled.']
    },
    {
      id: 'pace_too_slow', category: 'sensor_corrective', applicableWorkoutTypes: null, applicableSegmentTypes: ['work', 'continuous'],
      experienceLevels: null, minimumSegmentDurationSec: 60, earliestSegmentOffsetSec: 30, latestSegmentOffsetSec: null,
      minimumGapSec: 100, requiresData: ['livePace', 'prescribedPaceMin', 'prescribedPaceMax'], conflictsWith: ['encouragement'], maxPerWorkout: null,
      textVariants: ['You\'re below the planned pace. If the effort still feels right, gradually pick it up.']
    },
    {
      id: 'hr_above_zone', category: 'sensor_corrective', applicableWorkoutTypes: null, applicableSegmentTypes: ['work', 'continuous'],
      experienceLevels: null, minimumSegmentDurationSec: 60, earliestSegmentOffsetSec: 30, latestSegmentOffsetSec: null,
      minimumGapSec: 100, requiresData: ['liveHeartRate', 'heartRateTimestamp', 'personalizedHrZones'], conflictsWith: ['encouragement'], maxPerWorkout: null,
      textVariants: ['Your heart rate is above today\'s target zone. Ease back and let the effort settle.']
    },
    {
      id: 'hr_not_declining', category: 'sensor_corrective', applicableWorkoutTypes: null, applicableSegmentTypes: ['recovery'],
      experienceLevels: null, minimumSegmentDurationSec: 60, earliestSegmentOffsetSec: 30, latestSegmentOffsetSec: null,
      minimumGapSec: 100, requiresData: ['liveHeartRate', 'heartRateTimestamp', 'heartRateTrendBpmPerMin', 'personalizedHrZones'], conflictsWith: ['encouragement'], maxPerWorkout: null,
      textVariants: ['Your heart rate is still elevated. Continue walking and focus on relaxed breathing.']
    },

    // ── Warm-up guidance ──
    {
      id: 'warmup_easy_start', category: 'warmup_guidance', applicableWorkoutTypes: null, applicableSegmentTypes: ['warmup'],
      experienceLevels: null, minimumSegmentDurationSec: 120, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      textVariants: ['Start the first minute especially easy while your body warms up.']
    },
    {
      id: 'warmup_hip_circles', category: 'warmup_guidance', applicableWorkoutTypes: null, applicableSegmentTypes: ['warmup'],
      experienceLevels: null, minimumSegmentDurationSec: 180, earliestSegmentOffsetSec: 60, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      textVariants: ['If you have a safe place to stand, try five gentle hip circles in each direction.']
    },
    {
      id: 'warmup_arms', category: 'warmup_guidance', applicableWorkoutTypes: null, applicableSegmentTypes: ['warmup'],
      experienceLevels: null, minimumSegmentDurationSec: 180, earliestSegmentOffsetSec: 60, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      textVariants: ['Walk tall and let your arms swing naturally.']
    },

    // ── Effort coaching ──
    {
      id: 'purpose_easy', category: 'effort', applicableWorkoutTypes: ['easy'], applicableSegmentTypes: ['work', 'continuous'],
      experienceLevels: null, minimumSegmentDurationSec: 120, earliestSegmentOffsetSec: 90, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1, topic: 'talk_test_effort',
      buildText: workoutPurpose
    },
    {
      id: 'purpose_long', category: 'effort', applicableWorkoutTypes: ['long'], applicableSegmentTypes: ['work', 'continuous'],
      experienceLevels: null, minimumSegmentDurationSec: 180, earliestSegmentOffsetSec: 120, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1, topic: 'talk_test_effort',
      buildText: workoutPurpose
    },
    {
      id: 'purpose_quality', category: 'effort', applicableWorkoutTypes: ['tempo', 'intervals_time', 'intervals_manual'], applicableSegmentTypes: ['work', 'continuous', 'manual_rep'],
      experienceLevels: null, minimumSegmentDurationSec: 90, earliestSegmentOffsetSec: 45, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1, topic: 'pacing_first_interval',
      buildText: workoutPurpose
    },
    {
      id: 'purpose_run_walk', category: 'effort', applicableWorkoutTypes: ['run_walk'], applicableSegmentTypes: ['work', 'continuous'],
      experienceLevels: null, minimumSegmentDurationSec: 90, earliestSegmentOffsetSec: 45, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1, topic: 'talk_test_effort',
      buildText: workoutPurpose
    },
    {
      id: 'purpose_cross', category: 'effort', applicableWorkoutTypes: ['cross'], applicableSegmentTypes: ['work', 'continuous'],
      experienceLevels: null, minimumSegmentDurationSec: 120, earliestSegmentOffsetSec: 60, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1, topic: 'controlled_breathing',
      buildText: workoutPurpose
    },
    {
      id: 'effort_talk_test', category: 'effort', applicableWorkoutTypes: ['easy', 'long', 'run_walk'], applicableSegmentTypes: ['work', 'continuous'],
      experienceLevels: null, minimumSegmentDurationSec: 90, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 2, topic: 'talk_test_effort',
      textVariants: ['You should be able to speak in complete sentences.', 'Run easy and controlled. You should feel like you could continue longer.', 'This is not a test of toughness. Keep the effort honest and easy.']
    },
    {
      id: 'effort_rpe', category: 'effort', applicableWorkoutTypes: ['tempo', 'intervals_time', 'intervals_manual'], applicableSegmentTypes: ['work', 'continuous', 'manual_rep'],
      experienceLevels: null, minimumSegmentDurationSec: 90, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: ['prescribedRpe'], conflictsWith: [], maxPerWorkout: 2,
      buildText: function (ctx) { return 'Aim for an effort around ' + ctx.prescribedRpe + ' out of ten. Work, but do not strain.'; }
    },
    {
      id: 'effort_no_sprint', category: 'effort', applicableWorkoutTypes: ['intervals_time', 'intervals_manual'], applicableSegmentTypes: ['work', 'manual_rep'],
      experienceLevels: null, minimumSegmentDurationSec: 45, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      textVariants: ['Stay smooth; there is no need to sprint.']
    },
    {
      id: 'effort_first_interval_control', category: 'effort', applicableWorkoutTypes: ['intervals_time', 'intervals_manual'], applicableSegmentTypes: ['work', 'manual_rep'],
      experienceLevels: null, minimumSegmentDurationSec: 45, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1, topic: 'pacing_first_interval', firstIntervalOnly: true,
      textVariants: ['Keep this first interval controlled. Earn the last one.', 'First rep sets the ceiling. Smooth now, strong later.']
    },

    // ── Posture coaching ──
    {
      id: 'posture_relaxed', category: 'posture', applicableWorkoutTypes: null, applicableSegmentTypes: ['work', 'continuous', 'manual_rep'],
      experienceLevels: null, minimumSegmentDurationSec: 90, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 2, topic: 'relaxed_shoulders',
      textVariants: ['Relax your shoulders and keep your hands loose.', 'Check your shoulders — let them drop away from your ears.', 'Keep your hands loose, as if you were holding something delicate.']
    },
    {
      id: 'posture_tall', category: 'posture', applicableWorkoutTypes: null, applicableSegmentTypes: ['work', 'continuous'],
      experienceLevels: null, minimumSegmentDurationSec: 90, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 2,
      textVariants: ['Run tall and relaxed. Let your gaze fall naturally ahead.']
    },

    // ── Stride coaching ──
    {
      id: 'stride_light', category: 'stride', applicableWorkoutTypes: null, applicableSegmentTypes: ['work', 'continuous', 'manual_rep'],
      experienceLevels: null, minimumSegmentDurationSec: 90, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 2, topic: 'short_light_stride',
      textVariants: ['Keep your steps light and comfortable.', 'Try to land beneath your body instead of reaching forward.']
    },
    {
      id: 'stride_hills_up', category: 'stride', applicableWorkoutTypes: null, applicableSegmentTypes: ['work', 'manual_rep'],
      experienceLevels: null, minimumSegmentDurationSec: 60, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 2, topic: 'hill_effort', terrainHint: 'hills',
      textVariants: ['Shorten your stride and maintain your effort on this climb.']
    },
    {
      id: 'stride_hills_down', category: 'stride', applicableWorkoutTypes: null, applicableSegmentTypes: ['recovery'],
      experienceLevels: null, minimumSegmentDurationSec: 60, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1, terrainHint: 'hills',
      textVariants: ['Quick, controlled steps on the way down.']
    },

    // ── Breathing coaching ──
    {
      id: 'breathing_steady', category: 'breathing', applicableWorkoutTypes: null, applicableSegmentTypes: ['work', 'continuous', 'manual_rep'],
      experienceLevels: null, minimumSegmentDurationSec: 90, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 2, topic: 'controlled_breathing',
      textVariants: ['Let your breathing stay steady and relaxed.', 'Focus on a complete exhale — the next breath will follow naturally.']
    },

    // ── Recovery guidance (beyond the transition cue itself) ──
    {
      id: 'recovery_breathing_only', category: 'recovery_guidance', applicableWorkoutTypes: null, applicableSegmentTypes: ['recovery'],
      experienceLevels: null, minimumSegmentDurationSec: 45, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: null,
      textVariants: ['Keep walking until your breathing feels controlled again.', 'This recovery is part of the workout. Let it do its job.']
    },
    {
      id: 'recovery_prepare_next', category: 'recovery_guidance', applicableWorkoutTypes: null, applicableSegmentTypes: ['recovery'],
      experienceLevels: null, minimumSegmentDurationSec: 30, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      earliestSegmentRemainingSec: 12, latestSegmentRemainingSec: 35,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: null, timeCritical: true,
      buildText: function (ctx) { return ctx.segmentRemainingSec ? Math.round(ctx.segmentRemainingSec) + ' seconds until the next interval. Stay relaxed.' : 'Stay relaxed — the next interval is coming up.'; }
    },

    // ── Encouragement (priority 7, first to suppress) ──
    {
      id: 'encourage_general', category: 'encouragement', applicableWorkoutTypes: null, applicableSegmentTypes: ['work', 'continuous', 'manual_rep'],
      experienceLevels: null, minimumSegmentDurationSec: 60, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 2,
      textVariants: ['Good. Keep this effort controlled.', 'That was controlled. Keep the next piece the same.', 'You are doing the job this session asked for.']
    },
    {
      id: 'encourage_beginner_permission', category: 'encouragement', applicableWorkoutTypes: null, applicableSegmentTypes: ['recovery', 'manual_rep'],
      experienceLevels: ['beginner'], minimumSegmentDurationSec: 30, earliestSegmentOffsetSec: POST_TRANSITION_SILENCE_SEC, latestSegmentOffsetSec: null,
      minimumGapSec: 0, requiresData: [], conflictsWith: [], maxPerWorkout: 1,
      textVariants: [
        'Controlled effort like this is successful training.',
        'This is exactly what building a running habit looks like.',
        'Walking here is the plan working, not you falling behind it.'
      ]
    }
  ];

  // Event-driven categories only ever fire in direct response to a real
  // workout-runner.js transition event (or the synthetic 'workout_start'
  // app.js fires once before the first tick) -- never merely because a
  // voluntary/no-event tick happened to land mid-segment. Without this,
  // e.g. a "Start running..." transition cue would be re-selectable on
  // every single tick for the rest of that work segment, not just once at
  // its start. Optional (technique/encouragement/etc.) categories are
  // deliberately NOT gated this way -- they're meant to be considered on
  // ordinary no-event ticks.
  var EVENT_GATED_CATEGORIES = { introduction: true, transition: true, transition_warning: true, progress: true, completion: true };
  var TRIGGER_TO_CATEGORIES = {
    workout_start: ['introduction'],
    segment_start: ['transition'],
    final_interval: ['transition'], // folds into the transition cue's text via context.isFinalInterval, not a separate cue
    warning_10s: ['transition_warning'],
    halfway: ['progress'],
    final_third: ['progress'],
    paused: ['transition'],
    resumed: ['transition'],
    complete: ['completion']
  };

  // ── Deterministic selection ──────────────────────────────────────────
  function selectCoachingCue(context) {
    if (!context) return null;
    var prefs = context.coachingPreferences || defaultCoachingPreferences();
    var preset = FREQUENCY_PRESETS[prefs.frequency] || FREQUENCY_PRESETS.coach;

    // Step 1: context is already built by the caller (coaching-context.js).

    var candidates = CUE_CATALOG.slice();

    // An event-gated category is only in play at all when the current tick
    // is actually that kind of event -- checked once, up front, since it
    // determines eligibility for five whole categories at once.
    var eligibleEventCategories = context.triggerEvent ? (TRIGGER_TO_CATEGORIES[context.triggerEvent] || []) : [];
    candidates = candidates.filter(function (cue) {
      if (!EVENT_GATED_CATEGORIES[cue.category]) return true; // optional categories are never event-gated
      return eligibleEventCategories.indexOf(cue.category) !== -1;
    });

    // Step 2: remove cues whose required data is unavailable.
    candidates = candidates.filter(function (cue) {
      return (cue.requiresData || []).every(function (field) { return context[field] != null; });
    });

    // Step 3: remove cues that don't apply to this workout/segment/experience/terrain.
    candidates = candidates.filter(function (cue) {
      if (cue.applicableWorkoutTypes && context.workoutType && cue.applicableWorkoutTypes.indexOf(context.workoutType) === -1) return false;
      if (cue.triggerEvents && cue.triggerEvents.indexOf(context.triggerEvent) === -1) return false;
      if (cue.applicableSegmentTypes && context.segmentType && cue.applicableSegmentTypes.indexOf(context.segmentType) === -1) return false;
      if (cue.experienceLevels && context.runnerExperience && cue.experienceLevels.indexOf(context.runnerExperience) === -1) return false;
      if (cue.terrainHint && cue.terrainHint !== context.terrainHint) return false;
      if (cue.firstIntervalOnly && context.segmentIntervalNumber !== 1) return false;
      if ((context.segmentCount || 0) && cue.minimumSegmentDurationSec) {
        var segDur = (context.segmentElapsedSec != null && context.segmentRemainingSec != null) ? context.segmentElapsedSec + context.segmentRemainingSec : null;
        if (segDur != null && segDur < cue.minimumSegmentDurationSec) return false;
      }
      return true;
    });

    // Step 4: remove cues outside their allowed timing window within the segment.
    candidates = candidates.filter(function (cue) {
      if (context.segmentElapsedSec == null) return true; // no timing info (e.g. manual/open segment) -- window checks don't apply
      if (cue.earliestSegmentOffsetSec != null && context.segmentElapsedSec < cue.earliestSegmentOffsetSec) return false;
      if (cue.latestSegmentOffsetSec != null && context.segmentElapsedSec > cue.latestSegmentOffsetSec) return false;
      if (context.segmentRemainingSec != null) {
        if (cue.earliestSegmentRemainingSec != null && context.segmentRemainingSec < cue.earliestSegmentRemainingSec) return false;
        if (cue.latestSegmentRemainingSec != null && context.segmentRemainingSec > cue.latestSegmentRemainingSec) return false;
      }
      return true;
    });

    // Sensor fields being present is not enough: the measured condition
    // must actually be true. These guards keep future integrations from
    // turning every valid reading into a corrective cue.
    candidates = candidates.filter(function (cue) {
      if (cue.id === 'pace_too_fast') return context.livePaceReliability === 'reliable' && context.livePace < context.prescribedPaceMin;
      if (cue.id === 'pace_too_slow') return context.livePaceReliability === 'reliable' && context.livePace > context.prescribedPaceMax;
      if (cue.id === 'hr_above_zone') {
        var targetMax = context.prescribedHrZone && context.prescribedHrZone.max;
        if (targetMax == null && context.personalizedHrZones) targetMax = context.personalizedHrZones.targetMax;
        return context.heartRateReliability === 'reliable' && targetMax != null && context.liveHeartRate > targetMax;
      }
      if (cue.id === 'hr_not_declining') {
        var recoveryMax = context.personalizedHrZones && context.personalizedHrZones.recoveryMax;
        return context.heartRateReliability === 'reliable' && recoveryMax != null && context.heartRateTrendBpmPerMin != null && context.heartRateTrendBpmPerMin >= -1 && context.liveHeartRate > recoveryMax;
      }
      return true;
    });

    // Step 5: remove cues already delivered beyond their per-workout limit.
    candidates = candidates.filter(function (cue) {
      if (cue.maxPerWorkout == null) return true;
      var used = (context.workoutCueHistory || context.fullCueHistory || []).filter(function (h) { return h.cueId === cue.id; }).length;
      return used < cue.maxPerWorkout;
    });

    // Step 6: remove cues conflicting with a recent higher-priority cue.
    candidates = candidates.filter(function (cue) {
      return !(cue.conflictsWith || []).some(function (conflictCat) { return context.recentCueCategories.indexOf(conflictCat) !== -1; });
    });

    // Step 7: apply frequency/category preferences.
    candidates = candidates.filter(function (cue) {
      if (CATEGORY_PRIORITY[cue.category] !== PRIORITY.SAFETY &&
          cue.category !== 'transition' && cue.category !== 'transition_warning' &&
          cue.category !== 'progress' && cue.category !== 'introduction' && cue.category !== 'completion') {
        // optional category -- must be allowed by frequency preset AND any explicit per-category toggle
        if (preset.allowedOptionalCategories.indexOf(cue.category) === -1) return false;
        if (cue.category === 'technique' || cue.category === 'posture' || cue.category === 'stride' || cue.category === 'breathing' || cue.category === 'warmup_guidance' || cue.category === 'effort') {
          if (prefs.technique === false) return false;
        }
        if (cue.category === 'encouragement' && prefs.encouragement === false) return false;
        if (cue.category === 'sensor_corrective') {
          var isPaceCue = cue.id.indexOf('pace_') === 0;
          var isHrCue = cue.id.indexOf('hr_') === 0;
          if (isPaceCue && prefs.paceFeedback === false) return false;
          if (isHrCue && prefs.heartRateFeedback === false) return false;
        }
      }
      return true;
    });

    // Step 8: minimum-silence requirements for optional cues (does not
    // apply to essential categories -- those must always be able to speak).
    candidates = candidates.filter(function (cue) {
      if (OPTIONAL_CATEGORIES.indexOf(cue.category) === -1) return true;
      if (cue.timeCritical) return true;
      var lastOptionalAt = null;
      (context.workoutCueHistory || context.fullCueHistory || []).forEach(function (h) {
        if (OPTIONAL_CATEGORIES.indexOf(h.category) !== -1 && (lastOptionalAt == null || h.deliveredAt > lastOptionalAt)) lastOptionalAt = h.deliveredAt;
      });
      if (lastOptionalAt != null && preset.minOptionalGapSec !== Infinity) {
        var elapsedSinceLastOptional = (context.currentTime - lastOptionalAt) / 1000;
        if (elapsedSinceLastOptional < preset.minOptionalGapSec) return false;
      }
      if (preset.minOptionalGapSec === Infinity) return false; // Minimal mode -- no optional cues at all
      if (cue.minimumGapSec) {
        var lastSameCue = (context.workoutCueHistory || context.fullCueHistory || []).filter(function (h) { return h.cueId === cue.id; }).sort(function (a, b) { return b.deliveredAt - a.deliveredAt; })[0];
        if (lastSameCue && (context.currentTime - lastSameCue.deliveredAt) / 1000 < cue.minimumGapSec) return false;
      }
      return true;
    });

    // Step 9: rank by priority (lower number = higher priority), then by
    // catalog order (stable, deterministic) as the tiebreak.
    var focusAlreadyDelivered = context.focusTopic && (context.workoutCueHistory || []).some(function (h) { return h.topic === context.focusTopic; });
    candidates.sort(function (a, b) {
      var priorityDiff = (CATEGORY_PRIORITY[a.category] || 99) - (CATEGORY_PRIORITY[b.category] || 99);
      if (priorityDiff) return priorityDiff;
      if (context.focusTopic && !focusAlreadyDelivered) {
        if (a.topic === context.focusTopic && b.topic !== context.focusTopic) return -1;
        if (b.topic === context.focusTopic && a.topic !== context.focusTopic) return 1;
      }
      if (a.timeCritical && !b.timeCritical) return -1;
      if (b.timeCritical && !a.timeCritical) return 1;
      return 0;
    });

    // Step 10: select no more than one.
    var winner = candidates[0];
    if (!winner) return null; // Step 12: silence is a valid, expected outcome.

    return {
      cueId: winner.id,
      category: winner.category,
      priority: CATEGORY_PRIORITY[winner.category] || 99,
      text: resolveText(winner, context),
      reason: 'selected by priority ' + (CATEGORY_PRIORITY[winner.category] || 99) + ' (' + winner.category + ')',
      expiresAt: context.currentTime + 15000, // a cue not spoken within 15s of selection is considered stale by the caller
      topic: winner.topic || null
    };
  }

  return {
    PRIORITY: PRIORITY,
    CATEGORY_PRIORITY: CATEGORY_PRIORITY,
    FREQUENCY_PRESETS: FREQUENCY_PRESETS,
    OPTIONAL_CATEGORIES: OPTIONAL_CATEGORIES,
    CUE_CATALOG: CUE_CATALOG,
    TEACHING_TOPICS: TEACHING_TOPICS,
    TOPIC_LABEL: TOPIC_LABEL,
    defaultCoachingPreferences: defaultCoachingPreferences,
    classifyWorkoutForCoaching: classifyWorkoutForCoaching,
    detectTerrainHint: detectTerrainHint,
    availableTeachingTopics: availableTeachingTopics,
    buildCoachingFocus: buildCoachingFocus,
    selectCoachingCue: selectCoachingCue
  };
});

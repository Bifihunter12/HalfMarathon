(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZaeraCoachingContext = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Coaching context normalizer (docs/COACHING_ENGINE_SPEC.md) ──────────
  // Pure function, no DOM, no sensor access -- it only reshapes whatever
  // the caller (app.js) already knows into the flat, verified shape
  // coaching-cues.js's selectCoachingCue() consumes. It never invents a
  // value: a field the caller didn't supply (because the data genuinely
  // doesn't exist -- no GPS, no heart-rate sensor, no recent race result to
  // calibrate pace from) comes through as null/'unavailable', never a
  // guess. See coaching-cues.js's own header comment for why this
  // separation matters (data truthfulness is enforced at the selection
  // layer by simply never having a non-null value to react to).

  var UNAVAILABLE_SENSOR = { livePace: null, livePaceReliability: 'unavailable', liveHeartRate: null, heartRateTimestamp: null, heartRateReliability: 'unavailable', personalizedHrZones: null, currentElevationOrGrade: null };

  // A heart-rate reading older than this is treated as if it never arrived
  // (task: "Treat stale data as unavailable" / "timestamped readings...
  // staleness detection"). Enforced here, structurally, rather than left as
  // a rule callers might forget -- no caller can pass a heartRateTimestamp
  // and have it treated as live if it's actually old.
  var HR_STALE_THRESHOLD_MS = 30 * 1000;
  // A reading outside plausible human range is rejected outright (task:
  // "implausible-reading rejection"), same effect as no reading at all.
  var HR_PLAUSIBLE_MIN = 30, HR_PLAUSIBLE_MAX = 230;

  // inputs: { workoutType, workoutGoal, phase, segment, segmentIndex,
  // segmentCount, segmentElapsedSec, segmentRemainingSec, workoutElapsedSec,
  // workoutRemainingSec, prescription: {rpe, paceMinSecPerMi, paceMaxSecPerMi,
  // hrZone}, runnerExperience, units, indoorOutdoor, sensorSnapshot (partial,
  // merged over the all-unavailable default), cueHistory: [{cueId, category,
  // topic, deliveredAt, workoutId}], coachingPreferences, currentTime,
  // triggerEvent (one of workout-runner.js's drained cue types, or null for
  // a voluntary/no-event tick) }
  function buildCoachingContext(inputs) {
    inputs = inputs || {};
    var segment = inputs.segment || null;
    var prescription = inputs.prescription || {};
    var sensor = Object.assign({}, UNAVAILABLE_SENSOR, inputs.sensorSnapshot || {});
    // Sanitized once, here -- every downstream consumer (coaching-cues.js's
    // selectCoachingCue/buildCoachingFocus) can then assume every entry is
    // a real object, never a null/undefined slot from corrupted/malformed
    // persisted history (task: "malformed cue history falls back safely").
    var cueHistory = (inputs.cueHistory || []).filter(function (h) { return h && typeof h === 'object'; });
    var now = inputs.currentTime != null ? inputs.currentTime : Date.now();

    // Staleness/plausibility enforcement -- runs regardless of what the
    // caller claims about reliability, so a caller can never accidentally
    // (or a future integration can never carelessly) present old or
    // physiologically impossible readings as live.
    if (sensor.liveHeartRate != null) {
      var hrStale = sensor.heartRateTimestamp == null || (now - sensor.heartRateTimestamp) > HR_STALE_THRESHOLD_MS;
      var hrImplausible = sensor.liveHeartRate < HR_PLAUSIBLE_MIN || sensor.liveHeartRate > HR_PLAUSIBLE_MAX;
      if (hrStale || hrImplausible) {
        sensor.liveHeartRate = null;
        sensor.heartRateReliability = hrStale ? 'stale' : 'implausible';
        sensor.personalizedHrZones = null; // fall back to effort/breathing guidance entirely, per the task's HR rules
      }
    }

    // recentCueCategories/recentCueIds: only cues from the last 10 minutes
    // count as "recent" for spacing/dedup purposes -- an old workout's
    // history shouldn't suppress today's cues forever.
    var RECENT_WINDOW_MS = 10 * 60 * 1000;
    var recent = cueHistory.filter(function (h) { return h && typeof h.deliveredAt === 'number' && (now - h.deliveredAt) <= RECENT_WINDOW_MS; });

    return {
      workoutType: inputs.workoutType || null,
      workoutGoal: inputs.workoutGoal || null,
      phase: inputs.phase || null,
      segmentType: segment ? segment.kind : null,
      // Interval numbering/final-interval detection -- read straight off
      // workout-runner.js's own normalized segment object (it already
      // carries intervalNumber/totalIntervals; see workout-runner.js), so
      // this is never independently recomputed or guessed.
      segmentIntervalNumber: segment ? segment.intervalNumber : null,
      segmentTotalIntervals: segment ? segment.totalIntervals : null,
      // totalIntervals > 1 guard is deliberate: a single continuous tempo
      // block is represented as intervalNumber:1/totalIntervals:1 (see
      // workout-runner.js buildFromSegments), which would otherwise satisfy
      // intervalNumber===totalIntervals and wrongly announce "final
      // interval" for a workout that never had multiple intervals at all.
      isFinalInterval: !!(segment && segment.totalIntervals && segment.totalIntervals > 1 && segment.intervalNumber === segment.totalIntervals),
      // Only meaningful at workout completion -- how many work/manual_rep
      // segments existed in the normalized workout, for the completion cue's
      // "you completed all N intervals" line. null for non-interval workouts.
      completedIntervalCount: inputs.completedIntervalCount != null ? inputs.completedIntervalCount : null,
      segmentIndex: inputs.segmentIndex != null ? inputs.segmentIndex : null,
      segmentCount: inputs.segmentCount != null ? inputs.segmentCount : null,
      segmentElapsedSec: inputs.segmentElapsedSec != null ? inputs.segmentElapsedSec : null,
      segmentRemainingSec: inputs.segmentRemainingSec != null ? inputs.segmentRemainingSec : null,
      workoutElapsedSec: inputs.workoutElapsedSec != null ? inputs.workoutElapsedSec : null,
      workoutRemainingSec: inputs.workoutRemainingSec != null ? inputs.workoutRemainingSec : null,
      // Prescribed values: real only when the plan engine/profile actually
      // supplied them (e.g. computeEasyPaceRange requires a recent race
      // result) -- null otherwise, never derived from a generic formula
      // during the workout itself.
      prescribedRpe: prescription.rpe != null ? prescription.rpe : null,
      prescribedPaceMin: prescription.paceMinSecPerMi != null ? prescription.paceMinSecPerMi : null,
      prescribedPaceMax: prescription.paceMaxSecPerMi != null ? prescription.paceMaxSecPerMi : null,
      prescribedHrZone: prescription.hrZone != null ? prescription.hrZone : null, // always null in this app -- no HR prescription model exists
      runnerExperience: inputs.runnerExperience || null,
      units: inputs.units || 'mi',
      indoorOutdoor: inputs.indoorOutdoor != null ? inputs.indoorOutdoor : null, // always null -- not tracked anywhere in this app
      livePace: sensor.livePace,
      livePaceReliability: sensor.livePaceReliability,
      liveHeartRate: sensor.liveHeartRate,
      heartRateTimestamp: sensor.heartRateTimestamp,
      heartRateReliability: sensor.heartRateReliability,
      personalizedHrZones: sensor.personalizedHrZones,
      currentElevationOrGrade: sensor.currentElevationOrGrade,
      sensorAvailability: { pace: sensor.livePaceReliability === 'reliable', heartRate: sensor.heartRateReliability === 'reliable', gps: false },
      recentCueCategories: recent.map(function (h) { return h.category; }),
      recentCueIds: recent.map(function (h) { return h.cueId; }),
      // Full (not just 10-min-window) history is still exposed for
      // maxPerWorkout / topic-repetition checks that must span the whole
      // workout, not just a recent window.
      fullCueHistory: cueHistory,
      coachingPreferences: inputs.coachingPreferences || null,
      terrainHint: inputs.terrainHint || null, // 'hills' | null -- derived from the workout label, see coaching-cues.js classifyWorkoutForCoaching
      triggerEvent: inputs.triggerEvent || null,
      currentTime: now
    };
  }

  return { buildCoachingContext: buildCoachingContext };
});

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZaeraWorkoutRunner = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Workout Runner V1 (docs/WORKOUT_RUNNER_SPEC.md) ─────────────────────
  // Pure, DOM-free module (UMD, same pattern as coaching-rules.js/
  // merge-state.js) so the normalizer and state machine -- the two most
  // safety/correctness-critical pieces of the whole feature -- can be
  // fully unit tested outside the browser. app.js is a thin consumer:
  // it renders whatever this module says the current state is and forwards
  // user actions (pause/resume/skip/end/markRepComplete) into it. It never
  // reimplements timing or transition logic itself.

  // ── Segment kinds ────────────────────────────────────────────────────
  // 'warmup'/'work'/'recovery'/'cooldown' -- the task's named phases, used
  // for auto-timed structured segments (runWalk, time-based quality
  // intervals/tempo, continuous cross-training).
  // 'continuous' -- an open-ended block with NO fixed duration: either a
  // distance-prescribed easy/long run (never converted to a fake duration
  // from an invented pace) or a single unstructured quality entry (e.g.
  // "Easy + strides", "Medium-long run", an ultra pool entry, or a whole-
  // block distance prescription like "4-6 mi @ half-marathon pace"). Ends
  // only when the runner explicitly marks it done.
  // 'manual_rep' -- a distance-based repeat (e.g. "6 x 400m @ 5K pace")
  // whose WORK duration can't be timed without inventing a pace, so the
  // runner announces it and waits for an explicit "rep done" action; the
  // recovery that follows it (if any) IS auto-timed, since recovery is
  // legitimately time-prescribed regardless of how fast the rep was run.

  function segment(kind, label, durationSec, extra) {
    return Object.assign({ kind: kind, label: label, durationSec: durationSec == null ? null : durationSec, intervalNumber: null, totalIntervals: null }, extra || null);
  }

  // ── Normalizer ───────────────────────────────────────────────────────
  // day: a single day object as produced by coaching-rules.js's
  // buildStructuredWeeks (type/label/miles/runWalk?/qualitySegments?/
  // qualityManualReps?/sessions?). Returns null for workout types this
  // runner doesn't execute (rest -- nothing to run; race -- out of scope,
  // race day isn't run through this runner).
  function normalizeWorkout(day, opts) {
    opts = opts || {};
    if (!day) return null;
    if (day.type === 'rest' || day.type === 'race') return null;

    var title = opts.label || day.label || '';

    // Run/walk programming takes priority whenever present, regardless of
    // which slot (easy/long/quality) it landed in -- it's always fully
    // structured real data, never guesswork.
    if (day.runWalk) return buildFromRunWalk(day.runWalk, title);

    if (day.type === 'quality' && day.qualitySegments) return buildFromSegments(day.qualitySegments, title);
    if (day.type === 'quality' && day.qualityManualReps) return buildFromManualReps(day.qualityManualReps, title, day.miles || null);

    if (day.type === 'cross' && day.sessions && day.sessions[0] && day.sessions[0].durationMinutes) {
      return buildContinuousStructured(day.sessions[0].durationMinutes * 60, title);
    }

    // Continuous distance-prescribed run, or any quality entry with no
    // structured/manual-reps data at all -- honest open stopwatch. Never
    // invents a duration from distance + an assumed pace.
    return buildOpen(title, day.miles || null);
  }

  function buildFromRunWalk(rw, title) {
    var segs = [];
    for (var i = 1; i <= rw.cycles; i++) {
      segs.push(segment('work', 'Run', rw.runSec, { intervalNumber: i, totalIntervals: rw.cycles }));
      segs.push(segment('recovery', 'Walk', rw.walkSec, { intervalNumber: i, totalIntervals: rw.cycles }));
    }
    return finalize('structured', title, segs, null);
  }

  function buildFromSegments(s, title) {
    var segs = [];
    if (s.warmupSec > 0) segs.push(segment('warmup', 'Warm-up', s.warmupSec));
    if (s.reps <= 1) {
      // A single continuous work block (e.g. a tempo run) -- no interval
      // count, no per-rep recovery.
      segs.push(segment('work', 'Tempo', s.workSec, { intervalNumber: 1, totalIntervals: 1 }));
    } else {
      for (var i = 1; i <= s.reps; i++) {
        segs.push(segment('work', 'Interval', s.workSec, { intervalNumber: i, totalIntervals: s.reps }));
        // Recovery only between reps, never a trailing one after the final
        // rep -- cooldown follows the last work interval directly.
        if (s.recoverySec > 0 && i < s.reps) segs.push(segment('recovery', 'Recovery', s.recoverySec, { intervalNumber: i, totalIntervals: s.reps }));
      }
    }
    if (s.cooldownSec > 0) segs.push(segment('cooldown', 'Cool-down', s.cooldownSec));
    return finalize('structured', title, segs, null);
  }

  function buildFromManualReps(m, title, distanceMiles) {
    var segs = [];
    if (m.warmupSec > 0) segs.push(segment('warmup', 'Warm-up', m.warmupSec));
    for (var i = 1; i <= m.reps; i++) {
      segs.push(segment('manual_rep', 'Repetition', null, { intervalNumber: i, totalIntervals: m.reps }));
      if (m.recoverySec > 0 && i < m.reps) segs.push(segment('recovery', 'Recovery', m.recoverySec, { intervalNumber: i, totalIntervals: m.reps }));
    }
    if (m.cooldownSec > 0) segs.push(segment('cooldown', 'Cool-down', m.cooldownSec));
    return finalize('guided_manual', title, segs, distanceMiles);
  }

  function buildContinuousStructured(durationSec, title) {
    return finalize('structured', title, [segment('continuous', 'Session', durationSec, { intervalNumber: 1, totalIntervals: 1 })], null);
  }

  function buildOpen(title, distanceMiles) {
    return finalize('continuous_open', title, [segment('continuous', 'Run', null)], distanceMiles);
  }

  function finalize(mode, title, segs, distanceMiles) {
    segs.forEach(function (s, i) { s.index = i; });
    var totalPrescribedSec = null;
    if (mode === 'structured') {
      totalPrescribedSec = segs.reduce(function (sum, s) { return sum + (s.durationSec || 0); }, 0);
    }
    return {
      mode: mode, // 'structured' | 'guided_manual' | 'continuous_open'
      title: title,
      segments: segs,
      totalPrescribedSec: totalPrescribedSec,
      distanceMiles: distanceMiles,
      // Never claim measurement -- shown verbatim by the UI whenever mode
      // isn't 'structured' with zero manual segments, i.e. whenever any
      // part of execution depends on the runner's own honesty, not GPS.
      manualDistanceNote: (mode === 'guided_manual' || mode === 'continuous_open')
        ? 'This app does not track distance or pace automatically. Log your actual distance after finishing.'
        : null
    };
  }

  // ── Deterministic state machine ─────────────────────────────────────
  // `now` is injectable for tests (defaults to Date.now); nothing in here
  // reads a live clock except through this one function, so tests can
  // simulate delayed ticks, backgrounding, and clock drift deterministically.
  function createRunnerStateMachine(normalized, opts) {
    opts = opts || {};
    var now = opts.now || function () { return Date.now(); };
    var segments = normalized.segments;

    var s = {
      workoutId: opts.workoutId || null,
      mode: normalized.mode,
      title: normalized.title,
      startedAt: null,
      completedAt: null,
      endedAt: null,
      segmentIndex: -1,          // -1 = not started yet (phase 'ready')
      segmentStartedAt: null,
      pausedMs: 0,
      pauseStartedAt: null,
      previousPhase: null,
      phase: 'ready',            // ready|warmup|work|recovery|cooldown|continuous|manual_rep|paused|completed|ended_early
      playedCues: {},            // { "idx_cueType": true } -- dedup ledger
      pendingCues: [],           // cue events not yet drained by the caller
      totalIntervals: segmentsMaxIntervals(segments)
    };

    function segmentsMaxIntervals(segs) {
      var max = 0;
      segs.forEach(function (seg) { if (seg.totalIntervals) max = Math.max(max, seg.totalIntervals); });
      return max || null;
    }

    function segAt(i) { return segments[i] || null; }

    function phaseForKind(kind) {
      if (kind === 'continuous') return 'continuous';
      if (kind === 'manual_rep') return 'manual_rep';
      return kind; // warmup|work|recovery|cooldown map 1:1
    }

    function cueKey(idx, type) { return idx + '_' + type; }

    function pushCue(idx, type, text) {
      var key = cueKey(idx, type);
      if (s.playedCues[key]) return; // hard dedup -- never fires twice, ever
      s.playedCues[key] = true;
      s.pendingCues.push({ key: key, type: type, text: text, segmentIndex: idx });
    }

    // silent=true suppresses the segment's own "entering" cue -- used while
    // reconcile() fast-forwards through segments that already fully elapsed
    // while the app was suspended, so a long backgrounding never replays a
    // backlog of stale cues (only the segment the runner is ACTUALLY in
    // right now gets a fresh cue).
    function advanceTo(index, silent) {
      if (index >= segments.length) { complete(); return; }
      s.segmentIndex = index;
      s.segmentStartedAt = now();
      var seg = segments[index];
      s.phase = phaseForKind(seg.kind);
      if (silent) return;
      announceSegment(seg);
    }

    function announceSegment(seg) {
      var idx = seg.index;
      if (seg.kind === 'warmup') pushCue(idx, 'segment_start', 'Begin warm-up');
      else if (seg.kind === 'cooldown') pushCue(idx, 'segment_start', 'Begin cooldown');
      else if (seg.kind === 'work' || seg.kind === 'manual_rep') {
        if (seg.totalIntervals && seg.totalIntervals > 1) {
          pushCue(idx, 'segment_start', 'Interval ' + seg.intervalNumber + ' of ' + seg.totalIntervals);
          if (seg.intervalNumber === seg.totalIntervals) pushCue(idx, 'final_interval', 'Final interval');
        } else {
          pushCue(idx, 'segment_start', 'Start running');
        }
      } else if (seg.kind === 'recovery') {
        pushCue(idx, 'segment_start', s.mode === 'guided_manual' || (segAt(idx - 1) && segAt(idx - 1).kind === 'manual_rep') ? 'Begin recovery' : 'Start walking');
      } else if (seg.kind === 'continuous') {
        pushCue(idx, 'segment_start', 'Start running');
      }
    }

    function start() {
      if (s.phase !== 'ready') return; // idempotent -- can't start twice
      s.startedAt = now();
      advanceTo(0, false);
    }

    function complete() {
      if (s.phase === 'completed' || s.phase === 'ended_early') return; // prevents double completion
      s.phase = 'completed';
      s.completedAt = now();
      pushCue(s.segmentIndex >= 0 ? s.segmentIndex : 0, 'complete', 'Workout complete');
    }

    function endEarly() {
      if (s.phase === 'completed' || s.phase === 'ended_early') return;
      s.phase = 'ended_early';
      s.endedAt = now();
    }

    function pause() {
      if (s.phase === 'paused' || s.phase === 'completed' || s.phase === 'ended_early' || s.phase === 'ready') return;
      s.previousPhase = s.phase;
      s.pauseStartedAt = now();
      s.phase = 'paused';
      pushCue(s.segmentIndex, 'paused_' + s.pauseStartedAt, 'Workout paused'); // keyed per-pause so pause/resume/pause again still dedups within THIS pause only
    }

    function resume() {
      if (s.phase !== 'paused') return;
      var pausedFor = now() - s.pauseStartedAt;
      s.pausedMs += pausedFor;
      // Shift the segment's own start point forward by exactly how long the
      // pause lasted, so remaining segment time is unaffected by pause
      // duration (pause time is never counted as active/elapsed time).
      if (s.segmentStartedAt != null) s.segmentStartedAt += pausedFor;
      var resumedPhase = s.previousPhase;
      pushCue(s.segmentIndex, 'resumed_' + s.pauseStartedAt, 'Workout resumed');
      s.phase = resumedPhase;
      s.previousPhase = null;
      s.pauseStartedAt = null;
    }

    function skip() {
      if (s.phase === 'paused' || s.phase === 'completed' || s.phase === 'ended_early' || s.phase === 'ready') return;
      advanceTo(s.segmentIndex + 1, false);
    }

    // Explicit "this repetition is done" action -- only valid during a
    // manual_rep segment (distance-based interval work can't be auto-timed).
    function markRepComplete() {
      if (s.phase !== 'manual_rep') return;
      advanceTo(s.segmentIndex + 1, false);
    }

    // Explicit "I'm done" action for an open-ended continuous segment
    // (distance-prescribed run, or a single unstructured block) -- there is
    // no auto-transition for these; audio availability and timers never
    // decide when this ends, only the runner does.
    function markContinuousDone() {
      if (s.phase !== 'continuous') return;
      advanceTo(s.segmentIndex + 1, false);
    }

    // Timestamp-based reconciliation -- the AUTHORITATIVE correctness
    // mechanism (task requirement: do not depend on setInterval remaining
    // continuously active). Safe to call as often as desired (every tick,
    // on visibilitychange, on app resume, on load) -- always recomputes
    // from real timestamps, never accumulates drift from being called late
    // or being skipped for a while.
    function reconcile() {
      if (s.phase === 'paused' || s.phase === 'ready' || s.phase === 'completed' || s.phase === 'ended_early') return;
      var seg = segAt(s.segmentIndex);
      if (!seg || seg.durationSec == null) { maybeWarnings(seg); return; } // manual/continuous segments never auto-advance
      var elapsed = now() - s.segmentStartedAt;
      var advancedAny = false;
      while (seg && seg.durationSec != null && elapsed >= seg.durationSec * 1000) {
        elapsed -= seg.durationSec * 1000;
        advancedAny = true;
        var nextIndex = s.segmentIndex + 1;
        if (nextIndex >= segments.length) { complete(); return; }
        // Only the FINAL segment landed on after this catch-up loop gets a
        // real cue -- every intermediate one silently elapsed while
        // suspended, which is exactly the "don't replay a stale backlog"
        // requirement. segmentStartedAt is backdated by the overshoot so
        // remaining time in the new segment is still accurate.
        s.segmentIndex = nextIndex;
        seg = segAt(nextIndex);
        s.phase = seg ? phaseForKind(seg.kind) : s.phase;
      }
      if (advancedAny && seg) {
        s.segmentStartedAt = now() - elapsed;
        announceSegment(seg);
      }
      maybeWarnings(seg);
    }

    // 10-second warning and halfway cues -- computed from real elapsed
    // time each call, deduped per-segment via playedCues so they can never
    // fire twice even across many reconcile() calls within the same segment.
    function maybeWarnings(seg) {
      if (!seg || seg.durationSec == null || s.segmentStartedAt == null) return;
      var elapsedMs = now() - s.segmentStartedAt;
      var remainingMs = seg.durationSec * 1000 - elapsedMs;
      if (seg.durationSec > 20 && remainingMs <= 10000 && remainingMs > 0) {
        pushCue(seg.index, 'warning_10s', 'Ten seconds');
      }
      if (elapsedMs >= (seg.durationSec * 1000) / 2) {
        pushCue(seg.index, 'halfway', 'Halfway');
      }
    }

    function remainingSegmentMs() {
      var seg = segAt(s.segmentIndex);
      if (!seg || seg.durationSec == null) return null;
      var refNow = s.phase === 'paused' ? s.pauseStartedAt : now();
      var elapsed = refNow - s.segmentStartedAt;
      return Math.max(0, seg.durationSec * 1000 - elapsed);
    }

    // Active elapsed time -- pause time is always excluded (task
    // requirement: pause time must never count as active workout time).
    function elapsedActiveMs() {
      if (!s.startedAt) return 0;
      var end = (s.phase === 'completed' || s.phase === 'ended_early') ? (s.completedAt || s.endedAt) : now();
      var pausedTotal = s.pausedMs + (s.phase === 'paused' ? (now() - s.pauseStartedAt) : 0);
      return Math.max(0, end - s.startedAt - pausedTotal);
    }

    function drainCues() {
      var out = s.pendingCues;
      s.pendingCues = [];
      return out;
    }

    // Serializable snapshot for persistence (app.js writes this into
    // state.activeWorkoutSession). Excludes functions/closures -- plain
    // data only, safe for JSON.stringify/localStorage.
    function snapshot() {
      return {
        workoutId: s.workoutId, mode: s.mode, title: s.title,
        startedAt: s.startedAt, completedAt: s.completedAt, endedAt: s.endedAt,
        segmentIndex: s.segmentIndex, segmentStartedAt: s.segmentStartedAt,
        pausedMs: s.pausedMs, pauseStartedAt: s.pauseStartedAt, previousPhase: s.previousPhase,
        phase: s.phase, playedCues: s.playedCues, totalIntervals: s.totalIntervals
      };
    }

    return {
      state: s, start: start, pause: pause, resume: resume, skip: skip, endEarly: endEarly,
      markRepComplete: markRepComplete, markContinuousDone: markContinuousDone,
      reconcile: reconcile, remainingSegmentMs: remainingSegmentMs, elapsedActiveMs: elapsedActiveMs,
      drainCues: drainCues, snapshot: snapshot, segAt: segAt, segments: segments
    };
  }

  // Rehydrates a state machine from a persisted snapshot (see
  // app.js's activeWorkoutSession recovery flow). `normalized` must be
  // recomputed fresh from the current plan (never persisted verbatim,
  // matching how the rest of this app's plan data works) and must match
  // the snapshot's workoutId or the caller should treat it as stale/unusable.
  function restoreRunnerStateMachine(normalized, snapshot, opts) {
    var m = createRunnerStateMachine(normalized, opts);
    Object.assign(m.state, snapshot);
    m.state.pendingCues = []; // never replay cues from before a restore
    return m;
  }

  return {
    normalizeWorkout: normalizeWorkout,
    createRunnerStateMachine: createRunnerStateMachine,
    restoreRunnerStateMachine: restoreRunnerStateMachine
  };
});

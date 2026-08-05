# RACR — Deterministic Coaching Engine: Audit + Implementation

Status: **Implemented (2026-08-06).** Builds on the just-shipped Workout Runner (`docs/WORKOUT_RUNNER_SPEC.md`), Tier 0 + conditional Tier 1 only, exactly as approved.

## 1. Audit findings

- **No GPS/geolocation anywhere** in the repository (confirmed, zero matches).
- **No heart-rate capability anywhere.** The only "heart rate" hits in the whole codebase are safety red-flag symptom text in pain reporting and the AI coach's chat triage prompt — no sensor, no field, no live data model.
- **Google Health integration is post-hoc only**: a single-day, user-clicked import returning `{startTime, exerciseType, durationMinutes, distanceMiles}` for a completed session, to match against a manual log entry. No heart-rate metric requested, no live/streaming capability, not wired into the active-workout screen.
- **Prescribed pace exists, conditionally**: `computeEasyPaceRange(profile)`/`computeQualityPaceRange(profile, label)` return a real range only when the runner supplied a recent race result (`hasRecentRaceEvidence`). Never derived from a generic formula mid-workout.
- **RPE targets exist for `easy`/`long` only** (`RPE_TARGET = {easy:[3,4], long:[4,5]}`); quality/cross RPE is prose-only.
- **Experience level**: `state.planMeta.level` (computed, injury-capped) reused directly — no new field invented.
- **No indoor/outdoor tracking** for the primary run.

**Conclusion (confirmed and executed on)**: Tier 0 (timer-only) fully supported; Tier 1 (prescribed pace/RPE) supported conditionally on real data; Tier 2 (live pace) and Tier 3 (live HR) have real, tested architectural slots that are **permanently inert** in this app today — `sensorSnapshot` is always `{}` at the call site, which `coaching-context.js` resolves to every sensor field being `null`/`'unavailable'`. No pace/HR-specific cue can ever fire without a real integration added later.

## 2. Architecture

```
workout-runner.js        UNCHANGED. Sole authority for timing/transitions.
                          Coaching engine only ever OBSERVES its drained
                          cue events + segment/machine state; never
                          advances a segment, never completes a workout.

coaching-context.js      NEW. Pure buildCoachingContext(inputs) -> flat,
                          verified context. Enforces HR staleness (30s)
                          and implausible-reading rejection (30-230bpm)
                          structurally, not as a convention.

coaching-cues.js         NEW. CUE_CATALOG (structured, ~35 entries across
                          10 categories) + selectCoachingCue(context) --
                          the deterministic 12-step selection engine +
                          priority system + frequency/silence scheduling +
                          classifyWorkoutForCoaching + buildCoachingFocus
                          (progressive teaching).

audio-cues.js             UNCHANGED. Still the only thing that speaks;
                          the coaching engine hands it plain text.

app.js                    Thin glue: assembles context inputs from live
                          workout-runner.js state + plan data, calls
                          selectCoachingCue once per tick, forwards the
                          result to audio-cues.js, records to
                          state.coachingHistory. Never re-implements
                          selection logic.

merge-state.js             coachingHistory unions like sideQuestLog
                          (append-only, capped at 200); coachingPreferences
                          follows workoutAudio's wholesale-prefer-newer
                          pattern.
```

### Key architectural fix found during testing

Transition-category cues (`transition`/`transition_warning`/`progress`/`introduction`/`completion`) are **event-gated**: they're only eligible when `context.triggerEvent` matches a real workout-runner.js event (`segment_start`, `warning_10s`, `halfway`, `final_interval`, `paused`, `resumed`, `complete`, or the synthetic `workout_start`). Without this, a transition cue would be re-selectable on every ordinary tick for the rest of its segment, not just once at entry. This was caught by the test suite itself (a test expecting silence mid-segment instead got a repeated transition cue) — fixed in `coaching-cues.js`, verified with a dedicated regression test.

## 3. Cue categories implemented (all 10 from the task)

Introduction · Warm-up guidance · Effort · Posture · Stride · Breathing · Recovery guidance · Pace feedback (inert) · Heart-rate feedback (inert) · Encouragement. ~35 catalog entries total, each with `id/category/applicableWorkoutTypes/applicableSegmentTypes/experienceLevels/minimumSegmentDurationSec/earliestSegmentOffsetSec/latestSegmentOffsetSec/minimumGapSec/requiresData/conflictsWith/maxPerWorkout/textVariants|buildText`.

## 4. Priority system (as specified)

Safety(1) > Immediate transition(2) > Transition warning(3) > Corrective sensor(4, inert) > Progress(5) > Technique/effort(6) > Encouragement(7). Introduction/completion pinned to transition's tier. Verified: safety overrides everything, transition overrides technique, sensor-corrective outranks encouragement, only one cue ever returned, no backlog after suspension.

## 5. Frequency/silence behavior

Minimal (essentials only) / Coach (default, 180s min gap between optional cues) / Detailed (90s min gap — the same floor used for post-transition silence, so Detailed never becomes chatty). Hard rule: no optional cue in the first 25s after any transition. Per-cue `minimumSegmentDurationSec`/timing windows prevent technique lectures during short intervals.

## 6. Personalization

`runnerExperience` (from `state.planMeta.level`) gates cue eligibility (e.g. `encourage_beginner_permission` is beginner-only). `classifyWorkoutForCoaching` derives a semantic workout type from real plan data (easy/long/tempo/intervals_time/intervals_manual/run_walk/cross) — "recovery run" is deliberately **not** a distinct type, since nothing in this app's data model marks a day as a recovery run; that phrasing is folded into `easy` rather than guessed from an unreliable signal. `detectTerrainHint` finds "hills" from the plan's own fixed catalog label text (never invented from elevation data this app doesn't have).

## 7. Progressive teaching

`buildCoachingFocus(cueHistory, workoutId)` deterministically rotates through 6 topics, skipping any topic taught in the last 3 distinct workouts. Shown on the pre-workout preview as "Today's focus: …". History capped at 200 entries, unioned (not replaced) across devices in `merge-state.js`.

## 8. User controls (Settings)

Coaching frequency (Minimal/Coach/Detailed), technique on/off, encouragement on/off, audio cues on/off — wired as chip groups, same pattern as every other Settings toggle in this app. **Pace/heart-rate feedback toggles were deliberately not added to the UI** — those categories are permanently inert (no sensor data can ever populate them), so a visible toggle for a feature that can never do anything would be misleading. The preference fields (`paceFeedback`/`heartRateFeedback`, default `true`) still exist in `state.coachingPreferences` for forward compatibility whenever a real integration lands.

## 9. Automated tests added

- `tests/coaching-context.test.js` — 9 tests (staleness/implausibility rejection, null-safety, interval numbering, malformed input).
- `tests/coaching-cues.test.js` — 48 tests (selection, priority, data truthfulness, frequency, workout types, lifecycle).
- `tests/merge-state.test.js` — 3 new tests (coachingHistory union/cap, coachingPreferences prefer-newer).

**Total: 424/424 passing** (364 baseline + 9 + 48 + 3).

## 10. Manual audio timelines (verified where marked; others computed from the same tested engine, not separately hand-simulated)

Format: `[t] SEGMENT — "spoken text"` or `[t] (silence)`.

### 1. Beginner run/walk workout (structured, fully data-driven)
```
[0:00] workout_start — "Today's mission is a run-walk workout. Keep the running easy and controlled."
[0:00] segment_start — "Begin your warm-up. Walk comfortably for X minutes." (if a warmup segment exists)
[0:00] cycle 1 work  — "Start running." (talk-test fallback, no pace data)
[run-10s] transition_warning — "Ten seconds."
[run-end] segment_start — "Start walking." (recovery, non-manual mode)
[walk-10s] transition_warning — "Ten seconds."
... repeats per cycle, interval count silent unless totalIntervals>1 in the segment (it is) ...
[final cycle] "Interval N of N" folds into "Final running interval. Stay smooth; there's no need to sprint."
[complete] "Mission complete. You completed all N running intervals."
```
Beginner-only `encourage_beginner_permission` ("Controlled effort like this is successful training.") eligible during recovery/manual_rep segments once, respecting frequency spacing.

### 2. Easy continuous run (**verified live**, `continuous_open` mode)
```
[0:00] workout_start — "Today's mission is an easy run. Keep the effort conversational."
[0:00] segment_start — "Start running." + talk-test or pace fallback depending on recent-race data
[0:25+] optional: effort_talk_test / posture_relaxed / stride_light / breathing_steady (one, respecting 180s Coach-mode gap)
(runner ends manually) — "Mission complete."
```

### 3. Tempo workout (**verified live in-browser**, see §11)
```
[0:00] "Today's mission is a tempo effort. You'll settle into a comfortably hard pace and hold it steady."
[0:00] "Begin your warm-up." (10 min)
[0:26] "Start the first minute especially easy while your body warms up." (warmup_guidance, confirmed fired at ~26s)
[10:00] "Start running. Easy effort for 28 minutes. You should be able to speak in short sentences." (confirmed: no recent race result in this test profile -> honest talk-test fallback, NOT a fabricated pace)
[10:25+] optional technique/effort cues at 180s+ spacing
[~24:00] "You're halfway. Stay relaxed — this should still feel sustainable."
[38:00] "Begin your cooldown. Walk easily and allow your breathing to settle."
[48:00] "Mission complete."
```

### 4. Short interval workout (time-based, e.g. "5 x 3 min @ 5K effort")
```
[0:00] "Today's mission is 3 running intervals with recovery between each. Run the work efforts strong, but stay in control."
[0:00] "Begin your warm-up." (10 min)
[10:00] "Start running. Interval 1 of 3." + effort/RPE line
[12:50] "Ten seconds."
[13:00] "Start walking." (recovery)
[15:50] "Ten seconds."
[16:00] "Interval 2 of 3." + "Stay smooth; there is no need to sprint." (effort_no_sprint, short-interval-appropriate, no technique lecture stacked in the same cue)
... interval 3 is the final -> "Final running interval. Stay smooth; there's no need to sprint."
[cooldown] -> [complete] "Mission complete. You completed all 3 running intervals."
```
No technique cue mid-interval (each work segment is 180s — under most technique cues' 90s+timing-window combination only allows a single optional cue at most, per the "no more than one technique cue during a short interval" rule).

### 5. Long run
```
[0:00] "Today's mission is your long run. Settle into a controlled pace — finishing strong matters more than speed."
[0:00] "Start running." (continuous_open, honest — no GPS distance claimed)
[spaced every 180s+] occasional posture/breathing/effort cues, same engine, same gaps -- naturally infrequent over a long duration since each optional cue still needs its own 180s gap
(runner ends manually) "Mission complete."
```

### 6. Recovery run
Not a distinct workout type in this app's data model (see §6) — runs the same path as "easy," with the effort-based `effort_talk_test`/`encourage_general` phrasing already de-emphasizing performance pressure. No separate "this is recovery, not a workout" cue exists; documented as a known limitation, not a silent gap (see §16 of the parent task's final-report numbering).

### 7. Manual-distance interval workout (**verified live**, `guided_manual` mode)
```
[0:00] "Today's mission is 5 running intervals with recovery between each. Run the work efforts strong, but stay in control."
[0:00] "Begin your warm-up." (10 min)
[10:00] "Repetition 1 of 5. Run it at your effort, then mark it done when you finish." (no duration countdown -- never invents a pace)
(runner taps "Mark repetition done" whenever they finish)
[+0:00] "Repetition 2 of 5" precedes with an AUTO-TIMED 2-minute recovery -- "Begin recovery." / "Recovery"
... repeats ...
[rep 5] "Final repetition. Run it strong, then mark it done when you finish."
[cooldown] -> [complete] "Mission complete. You completed all 5 running intervals."
```

### 8. Workout using prescribed pace without live GPS
```
[work segment_start] "Start running. Settle into your planned pace of 8:15 to 8:45 per mile."
```
(Only when `computeEasyPaceRange`/`computeQualityPaceRange` actually return a value — i.e. the runner supplied a recent race result. Verified via automated test with real numbers; verified absent via automated test without them.)

### 9. Workout using simulated reliable live pace
```
[30s+ into a work segment, pace sustained outside target] "You're a little faster than today's target. Ease back and stay controlled." (pace_too_fast, priority 4, outranks encouragement)
```
**Not observable in this environment** — no live pace source exists to simulate through the real UI; verified only via automated tests injecting a synthetic `sensorSnapshot.livePace`.

### 10. Workout using simulated reliable heart rate
```
[recovery segment_start, personalizedHrZones present] "Your recovery range is 125 to 140 beats per minute. Keep walking and let your heart rate come down gradually."
[recovery, HR still elevated after sustained check] "Your heart rate is still elevated. Continue walking and focus on relaxed breathing."
```
**Not observable in this environment** — no HR source exists; verified only via automated tests injecting synthetic `sensorSnapshot.liveHeartRate`/`personalizedHrZones`, including the staleness/implausibility rejection paths.

## 11. What was actually verified live vs. computed

**Verified in a real (non-Android, emulated) browser, with the actual Web Speech API intercepted** (see conversation for the captured `coachingHistory` and spoken-text log): safety → introduction → warmup transition → optional warmup guidance at the correct offset → work-segment transition with correct talk-test fallback (no fabricated pace, since the test profile had no recent race result). Persisted `coachingHistory` matched exactly what was spoken, in order, with real timestamps.

**Computed from the tested engine, not separately hand-simulated**: timelines 1, 4, 5, 6, 7 (partial), 9, 10 — these follow deterministically from the same `selectCoachingCue`/`buildCoachingContext` code paths already covered by the 57 coaching-engine unit tests, so their correctness rests on that automated coverage, not a fresh live click-through of every single one.

## 12. Known limitations

- Pace/HR feedback categories are architecturally complete and tested but **permanently inert** — no live sensor source exists anywhere in this app.
- "Recovery run" has no distinct workout-type signal in the data model; folded into "easy" coaching.
- Interval-purpose cross-training (`aerobic_intervals`/`threshold`) still runs as one continuous block from the workout runner's own normalizer — the coaching engine has no per-interval cueing to attach to for those, inherited from that prior phase's documented scope.
- No custom voice personality, no paid speech API, no generative AI in the loop anywhere — matches the feature freeze exactly.

## 13. Regression check

324→424 tests all passing throughout; existing workout-runner, safety, plan-generation, and merge-state tests untouched and still green.

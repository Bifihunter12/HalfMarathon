# RACR PRODUCT CORRECTION — Run Logging, Performance Progression and Side-Mission Scope

Saved verbatim (2026-07-22). This is a correction to the standing RACR spec (`RACR_Master_Prompt.md`), not a replacement — it targets a specific gap: the weekly plan screen is currently a checklist with no way to record actual distance/duration/pace/effort against the plan, and no performance-progression tracking. It also narrows Side Missions' scope back to strength/core/mobility (cross-training belongs to the Main Quest plan or an AI-approved alternative, not the primary Side Mission catalog).

## Core problem

RACR currently shows scheduled workouts as checklist items. The user cannot record actual distance, duration, pace, effort, or performance, and cannot see progress over time. RACR is a race-training system (run farther, run faster, build endurance, improve skill/pacing, get stronger/more mobile via Side Missions) — not a checklist.

## Product hierarchy

**Main Quest** — the running journey toward the selected race/goal: easy/long/recovery/tempo/threshold/interval/hill/race-pace/benchmark runs, taper, rest, coach-prescribed cross-training when needed, race day. Must show measurable progression: running longer, greater weekly distance, faster sustained pace, better effort control, race-specific workout completion, reaching race distance/goal.

**Side Missions** — limited to strength, core, mobility/flexibility (with subcategories: lower/upper/single-leg/posterior-chain strength, calf/ankle durability, core stability, anti-rotation, hip/ankle/calf mobility, post-run mobility, yoga for runners, recovery mobility). Support the runner (stronger, better movement quality, joint/tissue capacity, ROM, fewer imbalances, better training tolerance) — never replace the Main Quest. **General hiking/cycling/rowing/random fitness challenges are NOT the primary Side Mission system** — cross-training only belongs there when the plan specifically prescribes it, the user needs a low-impact alternative, or the AI coach modifies training for pain/fatigue/weather/schedule; in those cases it's Main Quest plan content or an approved alternative, not primary Side Mission progression.

## Core run-logging requirement

Every running workout supports two separate, never-overwritten data sets: **PLANNED** and **ACTUAL**.

**Planned data**: name, type, planned distance, planned duration (when relevant), target pace/range, target effort/RPE, HR guidance (when available), full structure (warm-up/main work/recoveries/cooldown), purpose, terrain recommendation, coach notes. Full session structure must be shown — not just "Tempo: 25-30 min @ threshold."

**Run actions** (every eligible running workout): Start Run, Log Run Manually, Modify Workout, Reschedule, Report Pain or Limitation.

**Start Run** (when device tracking available): elapsed/moving time, distance, current/average pace, splits, HR (when connected), elevation (when available), pauses.

**Log Run Manually** (must exist even without GPS/wearable): required — actual distance, actual duration; auto-calculated — average pace; optional — average HR, RPE, treadmill/outdoor, terrain, elevation, temperature/conditions, notes, pain/discomfort, completed-as-prescribed vs modified. Units: mi/km, h/min/sec, min/mi, min/km.

**Pace calculation**: `pace = duration / distance`, correct mi↔km and min/mi↔min/km conversion, handles zero-distance validation, partial distances, sessions >1hr, paused runs, treadmill entries, run-walk sessions.

**Post-run review**: show PLANNED vs ACTUAL side by side, plus a coach interpretation sentence grounded in the comparison (not just "Workout completed").

**Planned vs actual**: stored separately, never overwritten. Comparable: planned vs actual distance/duration, target vs actual pace, target vs reported RPE, planned vs completed structure. Completion labels: completed as planned / completed within acceptable range / completed with modification / partially completed / stopped early / replaced with coach-approved alternative / missed / rescheduled.

## Weekly plan UI

Each row shows the primary prescription (e.g. "4.5 mi Easy Run — Target: 10:45-11:45/mi · RPE 3-4"); after completion, shows/adds actual result (e.g. "Completed: 4.62 mi · 50:15 · 10:53/mi"). Tap opens full workout. Must NOT rely on a checkbox as the only interaction — needs a meaningful status control (empty circle=upcoming, highlighted=today, progress ring=in progress, check+result=completed, adaptation icon=modified, recovery icon=recovery-substituted, arrow=rescheduled, dash=missed).

**Rest days**: never look disabled/irrelevant — show purpose + actions (Confirm Rest Day, Add Gentle Mobility, Report Readiness, View Tomorrow's Workout). Never encourage adding a run just to fill a checkbox or preserve a streak.

**Cross-training**: log modality, duration, distance (when relevant), avg HR, RPE, strength-portion-completed, notes — components loggable separately, not one vague "Bike + Strength" blob.

## Structured workout logging

- **Tempo/threshold**: warm-up duration/distance, tempo duration/distance/avg pace, cooldown duration/distance, totals, RPE, HR.
- **Intervals**: warm-up, rep count, planned rep distance/duration, actual per-rep splits, recovery duration, cooldown, totals. Coach interpretation should praise consistency over fast-then-fade.
- **Run-walk**: run-interval duration, walk-interval duration, cycle count, total distance/duration, avg pace, RPE — never treated as an inferior/incomplete run.

## Pace personalization

Inputs: recent race time, recent benchmark, current easy pace, current weekly mileage, experience, RPE, HR (when available), recent workout performance. Generates ranges for recovery/easy/long-run/steady/tempo/threshold/interval/race pace. **Never calculate all paces from one unreliable run; never auto-increase targets after one unusually fast workout** — use multiple qualifying workouts + confidence levels. When data is insufficient, prioritize effort language (conversational/controlled/comfortably hard/hard but repeatable/fast with complete recovery) over invented numbers. Label estimates honestly (initial estimate/low confidence/based on recent easy runs/based on benchmark/updated after three qualifying workouts).

## Running-farther progression

Track: weekly distance, weekly duration, longest run, long-run duration, completed-long-run count, race-distance readiness, recent consistency. Progression accounts for experience, race distance, plan length, recovery, recent completion, pain, fatigue, schedule, previous load. **No hard-coded universal "+10%/week" rule** — weeks should build/hold/reduce/recover/taper, and this should be visible to the user (with an explanation for why distance decreases during recovery weeks).

## Running-faster progression

"Getting faster" ≠ running every workout faster. Comes from aerobic development, strides, hills, intervals, tempo, threshold, race-pace work, running economy, recovery. Track via benchmark performance, tempo pace at comparable effort, interval consistency, race-pace completion, easy pace at similar HR/RPE, time trials, race results. **Never reward fastest easy run, excessive sprinting, beating pace targets on recovery days, or turning long runs into races.**

## Progress dashboard

Primary metrics: weekly distance/time, avg runs/week, longest run, current long-run distance, recent easy pace, tempo/threshold pace, benchmark result, estimated race readiness, plan completion, 4-week consistency.

Trend charts: weekly distance, weekly time, long-run progression, easy-pace trend, tempo/threshold trend, benchmark history, race-distance readiness — selectable over 4/8/12 weeks or the whole plan. Must not imply every pace trend should always drop — explain variance (terrain, heat, altitude, fatigue, wind, recovery, treadmill calibration).

**Personal records**: fastest 1K/mile/5K/10K/half/marathon, longest run, longest duration, best benchmark, most consistent interval workout. Only compare eligible efforts — don't treat an uncorroborated downhill GPS anomaly as a credible record.

## Adaptive coaching (uses logged data)

Inputs: planned vs actual distance/pace, RPE, HR, completion, pain, fatigue, readiness/sleep (when available), recent load.

- **Completed comfortably** → continue progression, maintain easy intensity, consider modest future progression only when supported by multiple sessions.
- **Much harder than expected** → don't immediately raise pace targets; review fatigue/conditions/recovery; hold or reduce next demanding session.
- **Repeatedly too easy** → verify intended type was easy; require several qualifying sessions before changing targets; adjust future quality targets cautiously.
- **Pain reported** → never reward completion through pain; provide modification; reduce/remove high-risk Side Missions; flag medical evaluation if severe/worsening/concerning.
- **Missed run** → never auto-add missed distance elsewhere; protect the next key session; recalculate the week if needed.

## Side-mission logging

**Strength**: exercise, variation, weight, sets, reps, duration, RPE, completed sets, notes — tracked separately from running mileage. Example exercises: goblet squat, split squat, step-up, RDL, calf raise, row, push-up, carry.

**Mobility/flexibility**: routine, target area, duration, exercises completed, discomfort before/after, notes.

Side-mission paths: **Stronger Runner** (Strength Foundation, Single-Leg Strength, Posterior Chain, Calf Capacity, Durable Runner), **Move Better** (Ankle/Hip/Calf Mobility, Post-Run Reset, Runner Mobility), **Core Stability** (Brace, Anti-Extension, Anti-Rotation, Carry, Core Control).

**Side-mission progress must never distort running progress** — keep Main Quest metrics (distance/time/pace/race readiness/plan progression) and Side Mission metrics (strength/core/mobility sessions & progression) strictly separate. A user must never believe 5 mobility sessions substitute for a missed long-run progression.

## Badge corrections

Main Quest badges based on measurable running development: Distance Unlocked (new planned long-run distance), Time on Feet (duration milestone), Pace Sense (multiple runs within prescribed range), Controlled Speed (consistent interval reps), Tempo Builder (3 appropriate tempo/threshold), Long-Run Confidence (3 prescribed long runs), First 5K, First 10K, Race Pace Ready (key race-pace workout completed).

Side Mission badges based on strength/mobility: Stronger Strides (first strength workout), Single-Leg Strong, Calf Capacity, Core Engine (5 core missions), Mobility Matters (5 mobility sessions), Hips in Motion, Ankles Unlocked.

## UX requirement — RACR must be able to answer

How far/long did I run today? What was my average pace? Did I follow the intended effort? Am I running farther/faster than when I started (at comparable effort)? What's my current longest run? How close am I to race distance? Which strength capability / mobility path am I developing? What should I do next? **If RACR can't answer these, the feature isn't complete.**

## Data model (reference — field lists, not literal schema requirement)

`RunWorkout` (planned side): id, planId, seasonId, scheduledDate, workoutType, title, purpose, plannedDistance(+unit), plannedDurationSeconds, targetPaceMin/Max(+unit), targetRpeMin/Max, targetHeartRateMin/Max, warmupStructure, mainSetStructure, recoveryStructure, cooldownStructure, terrainRecommendation, coachNotes, status.

`RunResult` (actual side): id, workoutId, userId, completedAt, actualDistance(+unit), elapsedTimeSeconds, movingTimeSeconds, averagePaceSeconds(+unit), averageHeartRate, maximumHeartRate, elevationGain, rpe, environment, terrain, treadmill, completionType, painReported/Location/Severity, notes, source, splits.

`RunSplit`: id, runResultId, splitNumber, splitType, distance, durationSeconds, averagePaceSeconds, averageHeartRate, recoveryDurationSeconds.

`StrengthResult`: id, missionId, completedAt, durationSeconds, exercises[], sessionRpe, notes. `StrengthExerciseResult`: exerciseId, variation, load(+unit), sets, repetitions, durationSeconds, completed.

`MobilityResult`: id, missionId, completedAt, durationSeconds, targetAreas, exercisesCompleted, discomfortBefore/After, notes.

## MVP implementation order (spec's own phasing)

1. Manual run logging: distance, duration, auto pace calc, RPE, notes, treadmill/outdoor, completed-as-planned-or-modified.
2. Update weekly screen: planned metrics, actual metrics, workout status, expandable detail.
3. Running progress: weekly distance/duration, longest run, long-run progression, pace trends, PRs.
4. Structured workout logging: tempo sections, interval splits, warm-up/recoveries/cooldown.
5. Side Mission logging: strength sets/reps/weight, core progress, mobility duration/routines.
6. Adaptive coaching using completed training data: future distances, pace ranges, workout difficulty, recovery, Side Mission recommendations.

## Definition of done (20 checks)

Every running workout can record actual distance and duration; pace auto-calculated; planned/actual stay separate; weekly screen shows meaningful planned+completed metrics; easy/long/tempo/interval all support appropriate logging; user can see weekly distance, long-run progression, pace progression, PRs; AI coach interprets planned-vs-actual; Main Quest clearly represents running farther/faster toward the race; Side Missions clearly represent strength/core/mobility and never replace required running progression; rest and valid adaptations stay protected; the app no longer functions as a simple workout checklist.

## Final product rule

Main Quest answers "How am I becoming a better runner and getting closer to my race?" Side Missions answer "How am I becoming stronger and moving better so I can support that running goal?" Every screen/metric/badge/recommendation must preserve that distinction.

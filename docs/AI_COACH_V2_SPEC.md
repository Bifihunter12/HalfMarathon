# Zaera — Flexible AI Coach (V2): Implementation Record

Status: **Partially implemented**, on branch `agent/whole-week-adaptive-coach` (not merged to `main`). This document describes what is actually built and tested as of that branch, not the full ambition of the originating master prompt — see "Not built" at the end for the honest gap list.

## 1. What this adds

Before this work, a runner could only negotiate a single-day, single-field change with the coach (`mark_rest`, `substitute_workout`, `reduce_intensity`, `substitute_side_quest`, `log_unplanned_activity`). This branch adds:

- **Conversational planned-activity capture** — "I'm hiking Saturday, 3 hours, lots of climbing" is understood, classified by real duration/terrain (never the AI's own guess), and incorporated into the week via one atomic confirmation.
- **Recovery-as-a-weekly-requirement negotiation** — a rest-day workout request is negotiated (which day becomes the new recovery day) instead of refused, reusing the same atomic multi-day action.
- **Weekly-job priorities by phase** — a deterministic ideal/minimum-viable-week brief the coach is grounded in, not left to guess.
- **One-time vs. recurring scope** — a trade defaults to "this week only"; explicit recurrence creates a real recurring-workout record so future weeks pick it up automatically.
- **One-step undo** for a confirmed trade.
- **In-workout feedback controls** — too easy / too hard / pain, with bounded deterministic reactions.
- **A real safety gap closed** in the pre-existing auto-adjustment engine (pain now suppresses auto volume-increases).
- **Phrase variety** on the two most-repeated coaching lines (workout completion, halfway).
- **Stale-plan-revision protection** on the multi-day action.

## 2. Architecture boundary (unchanged principle, extended surface)

Deterministic code (`coaching-rules.js`, `workout-runner.js`) still owns every fact: clocks, structure, validation, safety gates. The AI (`netlify/functions/coach.js` → OpenAI) proposes; deterministic code decides. Nothing new here changes that boundary — it's the same `reschedule_days` action from the earlier rest-day-swap feature, generalized.

## 3. The `reschedule_days` action (extended)

```js
{
  type: 'reschedule_days',
  changes: [
    {
      key: '1-3',              // 'weekNum-dayIdx', a real key from the day list the client sent
      workout: {
        type: 'cross',         // easy | long | quality | cross | rest
        label: 'placeholder',  // ignored/overwritten when activityType is set
        durationMinutes: 180,
        plannedDistance: null,
        activityType: 'hiking',        // optional -- any RECURRING_ACTIVITY_LABEL key
        terrainDifficulty: 'hard'      // optional -- easy | moderate | hard, only meaningful with activityType
      }
    }
  ],
  scope: 'once',    // 'once' (default) | 'recurring'
  note: '...'
}
```

When `activityType` is present, `coaching-rules.js`'s `validateRescheduleDays` **deterministically rebuilds** `type`/`label`/`durationMinutes`/`loadClass`/`purpose` via `buildPlannedActivityWorkout`, which reuses the exact same prescription builders the Recurring Workouts settings form already uses (`buildHikePrescription`, `buildCrossTrainingPrescription`, `classifyHikeLoad`). The model's own wording for that field is discarded unconditionally — never trusted, the same way the pre-existing `normalizeKnownWorkoutPhrase` (12-3-30) already worked, just generalized to any named activity instead of one hardcoded phrase.

Validation (`validateRescheduleDays`, unchanged core + new checks):
- Unknown/duplicate/race-day keys rejected (pre-existing).
- Long/quality-run displacement detection with same-set relocation credit, or explicit `confirmDisplacement` (pre-existing).
- Minimum-recovery enforcement (pre-existing, `REQUIRED_RECOVERY_DAYS_PER_WEEK = 1`).
- **New:** unknown `activityType` rejected; invalid `terrainDifficulty` rejected.
- Out-of-range duration/distance bounds (pre-existing).

Client-side (`app.js`, `applyRescheduleDays`):
- Re-validates with the identical deterministic function before ever touching state (never trusts that server-side validation is still current by the time Confirm is tapped).
- **New:** rejects if `state.lastModified` has changed since this chat screen was rendered (stale-revision protection).
- Applies every change atomically (all-or-nothing) via `state.workoutOverrides[key]`.
- **New:** when `scope === 'recurring'` and a change carries `activityType`, also creates a real `recurringWorkout` record (`fixed: true`, pinned to the real calendar weekday) so future weeks incorporate it via the normal plan generator — not just the current week's override.
- **New:** snapshots the pre-change state of every touched key (plus any created recurring-workout id) into an in-memory `lastRescheduleUndo`, enabling one-step Undo.

## 4. Weekly-job priorities (`coaching-rules.js`, `weeklyJobPriorityBrief(phase, level)`)

A small, deterministic, testable brief — `idealJobs` / `minimumViableJobs` (from `long_endurance`, `quality_stimulus`, `easy_volume`, `consistency`, `recovery`, `race`), varying by training phase (base/build/peak/taper/race) and, for beginners, dropping `quality_stimulus` entirely (matching how the plan generator itself never assigns true quality work during the run-walk window). Sent to the coach as real context (`plan.weeklyJobPriorities`) so "I only have 3 days" is answered against real priorities, not a guess.

**Scope note:** the taxonomy is bounded to the training jobs this app's own plan generator actually produces — not the master prompt's full aspirational job list (skill/terrain prep, fueling rehearsal, etc. are not modeled, since nothing in this codebase generates data for them).

## 5. Pending intent (unchanged from the earlier rest-day-swap feature)

`coachPendingIntent` (in-memory, never synced/persisted) still carries an unresolved "which day should become recovery?" question across a short follow-up message ("Sunday"). Extended prompt guidance teaches the coach to use the same mechanism for planned-activity follow-ups (duration/terrain), not a second mechanism.

## 6. In-workout feedback controls (`app.js`, `renderActiveWorkout`)

Three buttons, reusing the existing state-machine methods (`machine.skip()`, `machine.pause()`, `machine.resume()`) rather than any new mutation path:

- **Too easy** — logged only (`state.inWorkoutFeedback`), never escalates mid-session.
- **Too hard** — during an actual `work`/`manual_rep` segment, ends just that interval early (bounded); otherwise logged only, with a pointer to the existing Skip/End controls.
- **Pain** — pauses immediately, shows a plain Stop/Continue-carefully choice. Never diagnoses; the app's existing pain-report flow (workout detail screen, AI coach triage) remains where real severity/location triage happens.

Every action logs `{ workoutId, segmentIndex, segmentKind, type, actionTaken, at }` to `state.inWorkoutFeedback` (append-only, capped at 200).

## 7. Post-workout adaptation (audit finding, not new)

`applyMissedAdjustment` and `applyDifficultyAdjustment` (`coaching-rules.js`) already existed before this branch and already cover most of the deterministic adaptation triggers a fresh build would have needed: missed-week volume dampening, missed-long-run shortening, low/high-RPE volume nudges. One real gap was found and fixed: the low-RPE "felt too easy, nudge volume up" branch never checked for a recently logged pain report, contradicting the standing "never add intensity when the runner reports pain" rule enforced everywhere else. Fixed with the same pain-severity threshold already used elsewhere (`evaluateGoalCheckpoint`).

These two functions apply **automatically** (not via a propose/confirm step) — narrowly scoped (only easy/long mileage, bounded percentage, quality/cross/rest never touched, always paired with an explanatory note shown on the plan screen). Treated here as the "narrowly defined safe auto-adjust mode" the master prompt's confirmation requirement explicitly carves out as acceptable, rather than retrofitted into a confirm flow — changing that would be a real UX behavior change to an established feature, not something this pass should do unprompted.

## 8. Notifications (audit finding, no change needed)

`Notifications.check()` is a pull-based rule engine: it recomputes today/tomorrow's effective label live (via `effectiveWorkoutForDay`, already override-aware) every time it runs, deduplicated by a date-keyed log rather than per-session scheduled notification objects. A confirmed trade is reflected automatically with no separate "reschedule" or "cancel" step required, and nothing can ever notify about an unconfirmed proposal since `workoutOverrides` only exists after Confirm. No change made here.

## 9. State / persistence

`state.workoutOverrides[key]` gained optional `activityType`/`terrainDifficulty`/`purpose`/`loadClass` fields (all additive, backward compatible — an old saved override without them still loads and behaves identically). `state.inWorkoutFeedback` is a new append-only array with standard migration (`if (!s.inWorkoutFeedback) s.inWorkoutFeedback = [];`). Neither required a merge-state.js change beyond what the earlier rest-day-swap feature already added for `workoutOverrides` (tombstone-aware `mergeMapT`, same as `overrides`/`dayAdjustments`).

## 10. Tests

All in the existing `node --test tests/` suite, zero network calls, deterministic stubs for the model:
- `tests/coaching-rules.test.js` — `buildPlannedActivityWorkout`, `weeklyJobPriorityBrief`, activityType/terrainDifficulty validation branches.
- `tests/coach.test.js` — hiking classification end-to-end through the handler, `scope` sanitization, `weeklyJobPriorities` prompt forwarding.
- `tests/decision-scenarios.test.js` — pain suppressing the auto volume-increase.
- `tests/coaching-cues.test.js` — completion/halfway phrase rotation.

527/527 passing as of the last commit on this branch. UI-only wiring (undo, in-workout buttons, confirm-screen rendering) has no DOM test harness in this repo's existing convention — verified live via the Claude Browser tool instead, documented in each commit message.

## 11. Not built (honest gap list)

- Full session-level data model migration (`day.sessions[]` split/combine as first-class chat operations) — the pre-existing `day.sessions[]` infrastructure (found during audit, predates this branch) supports rendering/logging multiple sessions per day, but chat can't yet propose a split/combine.
- Deeper motivational-audio milestones beyond what already existed (first successful rep, final-third framing, "hardest block complete") — only phrase *variety* was added to existing milestones (halfway, completion), not new milestone types.
- Confirm-before-applying flow for the pre-existing automatic weekly adjustments (see §7 — deliberately not changed, treated as the doc's own allowed "safe auto-adjust mode" exception).
- Real-device QA for any of this — everything above is unit-tested and browser-verified against a local static server, never a real phone.
- Full accessibility audit beyond spot-checking the new controls (which already meet the bar: visible text labels, `role="group"`/`role="alert"`, `aria-live` status).

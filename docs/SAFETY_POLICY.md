# RACR — Safety & Escalation Policy

**Version:** 1.0 (2026-07-29) · **Status:** Internally documented, describing behavior already implemented in code. Not yet reviewed by a qualified clinical or sports-medicine professional. **This document does not constitute that review**, and nothing in it should be treated as production-approved safety guidance until a qualified reviewer signs off.

Companion to `docs/COACHING_SPEC.md` (training-progression rules) — this document covers the other half of the Zaera Labs Running master prompt's governance model: symptom routing, escalation, and the boundaries around what the app is and isn't allowed to do with a runner's reported pain, illness, or distress.

RACR is a general training-guidance product. It does not diagnose injury or illness, does not prescribe treatment, and does not override a runner's own medical care. Everything below describes how the app currently behaves when a runner reports something concerning — not what it should eventually become.

## AI-coach red-flag routing — documented

`netlify/functions/coach.js`. Every coach-chat response is validated server-side against a fixed shape: `{ message, riskLevel, decision, avoidToday, redFlags, action }`. `riskLevel` is constrained to a known enum (falls back to `'green'` if the model returns anything else); `decision` is likewise constrained (falls back to `'keep_plan'`). The critical rule is enforced in code, not just requested via the prompt (`coach.js:225-227`):

> A response with `riskLevel:"red"` or `decision:"seek_medical_evaluation"` can **never** carry a workout action, regardless of what the model itself returned — `action` is hard-set to `null` server-side in that case.

Every other action type the model can propose (`reduce_intensity`, `substitute_workout`, `substitute_side_quest`, etc.) is independently re-validated server-side against the real day list it was given — the model's own claim is never trusted blindly (`coach.js:236-249`). `redFlags` (the specific symptom terms the runner used) are surfaced back through to the client rather than silently discarded, so the coaching-chat UI can display them.

## In-app structured pain triage — documented

`painGuidance(severity, worsens, canWalk)` (`app.js:666`), surfaced through a "Report pain or discomfort" toggle inside `renderWorkoutDetail`. Collects severity (1-10), whether it worsens while running, and whether the runner can walk normally, and returns one of three non-diagnostic guidance levels (mild / caution / urgent). It never names a condition or suggests a cause — only a behavioral response (continue carefully / modify / stop and consider professional care).

## Illness & interruption handling — documented

`state.unavailable` (`{start, end, reason}` ranges, editable in Settings) + `applyUnavailableRanges(weeks, raceGoal, planMeta, ranges)` (`app.js:1807`). Days inside a reported unavailable range are converted to `type:'rest'` with a label reflecting the reason (illness/away), which also automatically excludes them from the missed-workout ratio in `applyMissedAdjustment` (see `docs/COACHING_SPEC.md`) — a runner recovering from illness is never penalized by the adaptation layer for the days they were told to rest.

## Explicit gaps — provisional, not fixed this pass

- **No dedicated deterministic escalation state machine.** The master prompt describes a fuller, named symptom taxonomy (ordinary soreness / localized discomfort / pain worsening during the run / pain persisting after / pain changing gait / pain affecting daily movement / acute injury / chest symptoms / severe breathing difficulty / fainting / neurologic symptoms / severe or rapidly worsening symptoms) with a defined decision per state. Today, red-flag detection for anything outside the structured pain-triage form happens entirely inside the AI coach's own judgment during a chat conversation (`coach.js`'s prompt-level red-flag list) — there is no hardcoded, testable rule list living outside the model for the fuller symptom set. This is the single largest gap in this document and the natural next step once a clinical reviewer is engaged.
- **No separate refusal-language specification.** The exact wording used when the app declines to give training guidance and instead recommends professional care is currently just whatever `coach.js`'s prompt produces — not a separately versioned, reviewer-approved set of fixed strings.
- **No professional-care escalation outside the chat flow.** A runner using the structured pain-report form (not the chat) who reports a severe symptom currently only sees the deterministic `painGuidance()` triage level — there's no equivalent hard "seek medical evaluation" surfacing outside of talking to the AI coach directly.

## Non-negotiable, restated

Safety behavior in this document is **not** approved production truth. It is what the code currently does, made inspectable and versioned so a qualified clinical or sports-medicine professional can review it — per the release gates in the master prompt, RACR should not expand public reach or add new distance families (beyond the current 5K/10K launch scope, see `docs/COACHING_SPEC.md`) until that review has actually happened.

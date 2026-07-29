# RACR — Coaching Specification

**Version:** 1.0 (2026-07-29) · **Status:** Internally documented, describing behavior already implemented in code. Not yet reviewed by a qualified running coach or sports-science professional — nothing in this document is "coach-approved," and it must not be treated as production-approved coaching truth until that review happens.

This document is the coaching-rules half of the lightweight governance structure adopted from the Zaera Labs Running master prompt (see `docs/RACR_Master_Prompt.md` for the underlying product/behavioral-design spec, and `docs/SAFETY_POLICY.md` for the safety/escalation half). Its job is narrow: make the rules that already govern plan generation and adaptation *inspectable and versioned*, and honestly flag where they fall short of the fuller philosophy, rather than leaving that logic implicit and undocumented inside `app.js`.

Each section below cites the real function and location that implements it today, and carries its own status — **documented** (accurately describes shipped behavior) or **provisional** (a known, named gap against the target philosophy, not yet built). Runner classification, goal feasibility, and the two adaptation functions now live in `coaching-rules.js` (extracted 2026-07-29 from `app.js` for real automated test coverage — see `tests/coaching-rules.test.js` for extraction-fidelity checks and `tests/decision-scenarios.test.js` for the actual approved/forbidden-outcome decision library referenced throughout this document).

## Runner classification — documented

`classifyUser(profile)` (`coaching-rules.js`). Computes a level from recent behavior (`runDaysPerWeek`, `weeklyMileage`) via fixed thresholds (beginner ≤2 days or <8mi/wk; novice 3 days and <20mi/wk; intermediate ≤5 days and <40mi/wk; advanced otherwise), then takes the **more conservative** of that computed level and the runner's self-reported experience level, and caps the result at `novice` if a recent injury was reported. This already matches the master prompt's "primarily recent behavior, not a self-selected label" principle — self-report can only pull the classification down, never up.

## Goal feasibility & plan length — documented, with a provisional gap

`evaluateSafety(event, weeksAvailable, level)` and `choosePlanLength(weeksAvailable, event, level)` (both `coaching-rules.js`). A per-event/per-level table (`EVENT_TABLE`) defines `minWeeks`/`idealWeeks`/`longRunPeak`/`peakVolume`/`taperWeeks`. If the runner's actual weeks-until-race is below `minWeeks` for their level, the plan is marked `unsafe` and a warning is surfaced recommending a later race date or shorter distance — the plan itself is never silently padded to look safer than it is.

**Provisional gap:** this is a binary outcome (unsafe warning, or not) rather than the master prompt's fuller feasibility taxonomy — there is no distinct "supported goal / unsupported goal / insufficient evidence / later-race recommended" output, and no separation between *completion* feasibility and *target-time* feasibility. Today a runner can get a plan generated even when only completion (not their stated goal time) is realistically supported, with no explicit call-out of that distinction. Not fixed in this pass — logged as the clearest next step for this section.

## Weekly structure — documented

`assignWeekTemplate(runDays, wantCross)` (`app.js:1647`) assigns long/quality/easy/cross/rest to the week's 7 slots, always leaving at least one structural rest day. Phase progression (base → build → peak → taper → race) and numeric weekly-volume progression are computed in `buildStructuredWeeks()` before being formatted into label strings, specifically so the adaptive layer below can scale real numbers rather than re-parsing text.

## Adaptation rules — documented, one gap fixed, several actions still unbuilt

`applyMissedAdjustment(weeks, raceGoal, planMeta, logs, today, terrainNote, units)` and `applyDifficultyAdjustment(...)` (both `coaching-rules.js`). Today's adaptation logic works at a **whole-week aggregate level over core running sessions**: if more than 60% of last week's easy/quality/long sessions went unlogged, all future non-race weeks are dampened ~15%; if specifically the long run was missed, only the next long run is shortened ~20%. Neither ever adds make-up mileage or doubles a future session to compensate for a miss — that non-negotiable already holds.

**Fixed (2026-07-29):** the ratio used to count cross-training days as equally diagnostic as real running work, so several unlogged cross-training sessions alone could trip the same 60% threshold as actually missed running — incorrectly dampening the quality session and long run over what was really just skipped optional supportive work. Cross-training is now excluded from the missed-ratio entirely, the same treatment `rest`/`race` days already got — matching the master prompt's own worked example (miss Tuesday's easy run, plus some optional cross-training; Thursday's quality and Saturday's long run stay untouched) exactly. `tests/decision-scenarios.test.js` covers this directly: an isolated cross-training-only miss never triggers anything, while a genuine core-running disruption (several easy/quality/long sessions actually missed) still correctly triggers the dampen — confirming the fix removed false positives without making the engine too lenient.

**Still not built, honestly:** this remains a *corrected ratio*, not the master prompt's full per-session action model. The engine only ever does three things — `preserve` (no-op), `shorten` (next long run, on an isolated long-run miss), or `reduce` (future volume dampening, on real core-running disruption). The other six named actions (`move` / `substitute` / `remove` / `rebuild` / `pause` / `escalate`) don't exist here: there's no rescheduling, no side-quest substitution offered automatically, no distinct "extended interruption" rebuild mode, and `pause`/`escalate` are deliberately left to the separate pain-triage/illness system (`docs/SAFETY_POLICY.md`) rather than duplicated in this engine. Building those remains a real, larger future option, not attempted in this pass.

## Launch scope — documented (new, this pass)

Public launch is scoped to **5K and 10K** only, for first-time and comeback runners. Half marathon is the first planned controlled-beta expansion. Marathon/50K/50-mile/100K/100-mile plan generation remains fully implemented and tested in the codebase (unchanged, not deleted) but is held behind the `state.flags.enableLongerDistances` feature flag (see the app's Settings → Beta features), hidden from the public onboarding wizard's event picker by default until each distance family has been separately reviewed. See `docs/SAFETY_POLICY.md` for the corresponding safety-review gate.

## Run-walk programming — missing entirely (provisional)

Confirmed via repository-wide search: no run-walk interval structure (alternating run/walk durations, progression, or race-day run-walk execution) exists anywhere in the codebase today. This is a real gap specifically for the target 5K/10K first-time/comeback runner the master prompt is built around, who may not yet be able to run continuously. Not scheduled in this pass — flagged here so it isn't silently forgotten.

## Strength / mobility, environmental conditions, race execution — partially documented elsewhere

Strength/mobility content lives in the separate Side Missions system (`side-quests.js`, `docs/RACR_SideMission_Expansion.md`) rather than this document, since it's a distinct catalog with its own equipment/difficulty/safety-gating logic. Environmental-conditions handling (heat/altitude/terrain substitutions) and detailed race-week execution guidance are not yet formally specified anywhere beyond `WORKOUT_DETAIL`'s per-type descriptions — out of scope for this pass, not claimed as complete.

# RACR — Workout Runner V1: Audit + Implementation Plan

Status: **Implemented (2026-08-06), phases 1-7 of §6 below.** This document was written as a plan before implementation began; the sections below are left as originally written except where explicitly marked "As built" with what changed. See the final report delivered in-conversation for the complete verification breakdown (automated vs. manually browser-tested vs. still requiring a real Android device).

## As-built deltas from this plan

- **Distance-based intervals got a third, more precise mode than originally sketched**: `manualReps` (separate from `segments`) — announces each repetition, waits for an explicit "mark done," THEN auto-times the recovery between reps. The original plan draft undersold this as flat "guided-manual-advance"; the approved requirement was more specific ("then begin any time-based recovery automatically") and the implementation matches that exactly, verified live in-browser.
- **`buildRunSession`'s dead `structure: day.runWalk ? null : null` stub was intentionally left alone**, not fixed. It's unreachable (only cross-training sessions ever populate `structure`, never primary run sessions) and the normalizer never reads it — fixing it would be an unrelated, unnecessary change outside this task's scope.
- **Recovery credibility heuristic, concretely**: same calendar day AND under 6 hours old. Anything else is offered as save-partial-or-discard only, never auto-resumable.
- `state.workoutAudio = { enabled: true, volume: 1 }` defaults ON (unlike the app's other opt-in notification preferences) since audio cues are this feature's entire purpose.
- `activeWorkoutSession` is excluded from cross-device merge by always taking the LOCAL device's value in `mergeRunnerState` (never remote's), protecting an in-progress session from being dropped by a same-device cloud sync pull. Verified with a dedicated merge-state.js test.

---

## 1. Repository audit findings

### 1.1 Architecture (verified, not assumed)

- Confirmed vanilla JS PWA. `package.json` has zero dependencies and no build step (`"test": "node --test"` only). No bundler, no framework, no TypeScript.
- Single-page app: `index.html` loads `app.js` (5,800+ lines, one IIFE) plus sibling modules `coaching-rules.js`, `merge-state.js`, `side-quests.js`, `path-system.js`, `progress-stats.js` — each a self-contained UMD module (`window.RACR*`), require()-able from Node tests without a DOM. This is the established pattern for testable logic in this codebase, and the one the runner's state machine must follow.
- `netlify/functions/*.js` — small serverless functions, only used for AI calls (coach chat, celebrate, why-workout, weekly-recap) and a minimal telemetry endpoint. Not relevant to the runner except optionally for telemetry events.
- **No Android/iOS/Capacitor/Cordova/TWA/native-shell configuration exists anywhere in the repo.** Confirmed via search for `android/`, `capacitor.config.*`, `*.gradle`, `AndroidManifest.xml`, `twa-manifest.json` — zero matches.
- Service worker (`sw.js`): network-first fetch strategy, cache-busting via a shared `APP_VERSION` string that must be bumped in `app-version.json` + `index.html` + `sw.js` together (established, proven pattern from this session's earlier fixes).
- `manifest.json`: `"display": "standalone"`, real installable PWA, PNG+SVG icons present (fixed this session).

### 1.2 Subscription/entitlement code

**Fully removed.** Confirmed via grep — the freemium gating feature (built, then explicitly removed at the user's request in commit `f0e5d49`) left no gating logic, no entitlement checks, no paywall UI. `state.subscription` is actively deleted from legacy state on load (defensive cleanup only). **There is no billing system to inspect for "fake checkout" risk — there is nothing at all.** This app is currently free/unlocked for every feature. Billing is a from-scratch future item, not something this task could accidentally fake, since nothing billing-shaped exists to misrepresent.

### 1.3 Workout data model (the critical finding)

The plan is **not stored** — it's regenerated deterministically on every render from small persisted inputs:

```
generateAll(profile, raceGoal, planMeta, logs, today)
  → CoachingRulesDomain.generatePlan(profile, raceGoal, planMeta, logs, today,
      unavailable, units, recurringWorkouts, travelPeriods, scheduleChoices, dayAdjustments)
  → { weeks: [ { weekNum, days: [ day, day, ... ] }, ... ] }
```

This matters enormously for backward compatibility: **extending the workout data model (e.g. adding structured interval data) requires no migration of existing user data**, because the shape is produced by code, not stored. Only `state.profile`/`state.raceGoal`/`state.planMeta` (small summary objects) and the runner's own new active-session state need migration-safe defaults.

Each `day` object:

```js
{
  type: 'easy' | 'long' | 'quality' | 'cross' | 'rest' | 'race',
  label: string,           // human-readable, always present
  miles: number,           // prescribed distance (0 for rest/cross-only days)
  runWalk: { runSec, walkSec, cycles, totalMin } | undefined,
  sessions: [ SessionObject, ... ] | undefined   // 1-2 entries, primary + optional secondary
}
```

`SessionObject` (from `coaching-rules.js`'s `buildRunSession`/`buildRecurringSession`/`buildGenericCrossSession`):
```js
{
  id, role: 'primary'|'secondary', activityType, subtype, purpose,
  structure: string|null,   // human text, only populated for cross-training/incline-walk
  rpeRange: [lo, hi]|null, durationMinutes: number|null, distanceMiles: number|null,
  intensity, loadClass, status, isRaceSpecific, replaces, source, explanation, label
}
```

**Key gap found:** `buildRunSession`'s `structure` field is hardcoded `day.runWalk ? null : null` — i.e. always `null` regardless of branch, a dead stub. The runner cannot rely on `session.structure` for primary run days; it must read `day.runWalk` directly.

### 1.4 What's actually machine-parseable vs. free text (this determines V1 scope)

| Workout shape | Data available | Timer-executable in V1? |
|---|---|---|
| `runWalk` sessions (`day.runWalk`) | **Fully structured**: `{runSec, walkSec, cycles, totalMin}` | **Yes, cleanly.** Zero parsing needed. |
| Continuous `easy`/`long` (no `runWalk`) | `day.miles` (distance target), no duration | **Yes, as open-ended stopwatch** — never GPS distance, never an invented pace-to-time conversion. User ends manually when done. |
| `quality` (interval/tempo) | **Free-text label only** (e.g. `"6 x 400m @ 5K pace"`, `"5 x 3 min @ 5K effort"`, `"Tempo: 25-30 min @ threshold"`, `"Fartlek: 8 x 1 min hard / 1 min easy"`) from `QUALITY_POOL` in `coaching-rules.js` (~30 entries across event types). No structured segment array exists today. | **Split**: entries whose reps are already stated in **time** (most 5K/10K/half "trained" entries) can be made executable by adding an *additive* `segments` field to those specific `QUALITY_POOL` entries (new field, old plans unaffected since nothing is stored). Entries whose reps are stated in **distance** (`400m`, `800m`, `1000m`, `1 mi`) **cannot** be executed accurately without GPS or an invented pace — the task explicitly forbids inventing one. These stay **label-only / guided-manual-advance** in V1: full text shown, user taps "next" themselves, no auto-timing. |
| `cross` (recurring or generic) | `durationMinutes` + a **human-text** `structure` string (from `buildCrossTrainingPrescription`) | **Continuous purposes** (`recovery`, `steady`, `technique`, `race_supporting`, `easy`) are effectively one segment for `durationMinutes` — executable as a single continuous timed segment. **Interval purposes** (`aerobic_intervals`, `threshold`) describe repeats only in the text string (e.g. "3 x 8 min at threshold... 2 min easy between") — same free-text gap as quality workouts; same additive-`segments` fix, out of scope to force in V1 unless trivial. |
| Incline walk (`twelveThreeThirty`) | `{inclinePct, speedMph, durationMinutes}` — **fully structured**, single continuous segment | **Yes, trivially.** |
| Hikes | `buildHikePrescription` — not yet inspected in detail; likely duration-based, same family as cross-training. | To confirm in Phase 1. |
| `race` day | Special-cased, not a training execution target for this runner. | **Out of scope** — race day isn't run through this runner. |

**Conclusion:** V1 can reliably execute *continuous runs (stopwatch mode)*, *run/walk programs*, *incline walks*, and *continuous-purpose cross-training* out of the box. *Interval/tempo quality workouts* and *interval-purpose cross-training* need one small, additive, non-destructive data extension (`segments` on select `QUALITY_POOL`/cross-purpose entries) to become fully executable — the rest stay honest label-only/guided mode rather than inventing timing.

### 1.5 Completion/logging (already has the vocabulary I need)

`state.logs[key] = { time, distance, effort, notes, pain, completionType, eveningIntervals }`, written via `setLog(key, patch)` (already fixed this session to carry deletion tombstones for sync). Critically:

```js
var COMPLETION_TYPES = ['planned', 'modified', 'partial', 'stopped_early'];
```

**`partial` and `stopped_early` already exist in the schema.** No new completion vocabulary needs inventing — the runner just needs to populate `entry.completionType` correctly (`'partial'`/`'stopped_early'` when ended early and saved, `'planned'`/`'modified'` on natural completion) and write real `entry.time` (elapsed active duration, formatted mm:ss/h:mm:ss to match `parseDurationToSeconds`'s existing parser). Secondary sessions use the parallel `state.sessionLogs`/`setSessionLog` (already tombstone-fixed this session).

### 1.6 Pre-run clarity content already exists

`WORKOUT_DETAIL` (`app.js`) has `what`/`why`/`howHard`/`ifCant`/`mistakes` copy per workout type, already shown on `renderWorkoutDetail` before any logging UI. This is most of what the task's "pre-run clarity" hierarchy needs — it just currently has no "Start Workout" action attached to it. `renderWorkoutDetail` (line ~3994) is the correct integration point.

### 1.7 Audio/background infrastructure

- **Zero existing usage** of `SpeechSynthesis`, `Audio`/`AudioContext`, `WakeLock`, or `MediaSession` anywhere in the codebase. This is a genuinely new capability, not a conflict with anything existing.
- Existing precedent for background-reliability honesty: the Notification system (`Notifications` object, `app.js`) already documents its own limitation plainly — reminders "only fire while Runner is open or running in the background," a `setInterval` at 30 minutes, no real push. The project has an established pattern of shipping an honest best-effort web feature rather than overclaiming, which this plan follows for audio.

### 1.8 Test baseline

```
npm test
ℹ tests 326
ℹ pass 326
ℹ fail 0
```
All passing, verified before any changes. No uncommitted worktree changes existed before this audit (`git status` clean).

---

## 2. Platform/architecture decision

### 2.1 Can a pure PWA meet the requirements reliably?

**Partially, and only for some of them — this needs to be stated honestly, not asserted as solved.**

| Requirement | PWA-only outlook |
|---|---|
| Foreground audio cues, screen on | **Reliable.** `SpeechSynthesis` works consistently while the page is visible/foregrounded. This is the easy, well-supported case. |
| Screen locked, audio continuing | **Unreliable, platform-limited.** Android Chrome aggressively suspends/throttles background tabs; `SpeechSynthesis.speak()` while backgrounded is inconsistently honored across Android/Chrome versions and OEM battery managers (Samsung/Xiaomi/Huawei in particular are known to kill background web content regardless of any web API used). This is a documented, widely-known constraint of web content — not something fixable by better code. The best mitigating combination available to a PWA is: **Wake Lock API** (keeps the screen from turning off *while foregrounded* — note this actually works against "lock the screen," it just keeps the display on) + **Media Session API** + a continuously-playing `<audio>` element (the standard trick Chrome uses to grant a tab "active media playback" background privileges, similar to how a web-based podcast player keeps playing with the screen off) + **Vibration API** as a non-audio fallback channel. None of these are guaranteed; Vibration also stops once a tab is fully suspended. |
| Bluetooth headphone output | Should work when audio is actually playing (standard OS audio routing, not something the web page controls or can break), but **must be verified on a real device** — cannot be asserted from source inspection alone. |
| Recovery after interruption/backgrounding | **Achievable reliably in a PWA** via timestamp-based reconciliation (see §3) — this does NOT depend on background execution continuing; it depends on correctly recomputing elapsed time from saved timestamps when the page becomes active again. This part of the requirement is fully solvable without native code. |
| Google Play packaging, real billing | Requires an actual native/TWA shell and a real Play Console + billing library integration — **out of scope for this cycle** regardless of audio approach (no Android project exists yet at all, confirmed §1.1). |

### 2.2 Recommendation: PWA-first V1, native shell deferred and conditional

Build V1 entirely inside the existing PWA:
- Best-effort audio via Web Speech API + Media Session/Wake Lock/silent-audio-keepalive technique, clearly documented as **best-effort, not guaranteed, while the tab/PWA is backgrounded or the screen is locked**.
- Fully reliable persistence/recovery regardless of background execution (timestamp-based, not `setInterval`-dependent for correctness).
- Vibration as a redundant, more battery/OS-independent cue channel where available.

**Do not build Capacitor/native shell in this cycle.** Per the task's own instruction ("stop and explain if a decision would create a major architectural commitment," "do not migrate... without explicit approval"), this is exactly that kind of decision. My recommendation: ship V1 as PWA-only, get real-device test results against the matrix in §9, and **only then** decide whether a Capacitor wrapper (thin native shell around the *unchanged* existing web app, adding a foreground Android service + native Android `TextToSpeech` for guaranteed locked-screen audio — the standard pattern real running apps use) is actually needed. This keeps the current cycle small and reviewable and avoids committing to native tooling before there's real evidence the PWA approach falls short.

**This is the one decision I'm flagging for explicit confirmation before proceeding**, since it affects how much confidence to put in the audio requirement for this cycle.

### 2.3 Speech technology: Web Speech API, not pre-recorded/paid TTS

Per the task's own preference ("avoid external paid speech services... prefer dependable local or device-native speech"), `SpeechSynthesis` (browser-native, on-device, free, no network call) is the correct V1 choice. I do not have a way to record real human voice audio or generate production-quality pre-rendered speech files in this environment, and doing so would require an external paid TTS service to pre-render assets — exactly what's discouraged. Web Speech API's actual limitation is background reliability (§2.1), not cost or dependency weight, so switching technology wouldn't fix the real gap; only a native TTS engine running inside a foreground service would.

---

## 3. Proposed architecture (clean separation, per the task's own boundary list)

```
workout-runner.js          NEW — pure module (UMD, like coaching-rules.js), zero DOM.
  ├─ normalizeWorkout(day, sessions)   Workout definition/normalization
  ├─ createRunnerStateMachine(...)     Deterministic state machine
  └─ reconcileElapsedTime(...)         Time reconciliation (timestamp-based)

audio-cues.js               NEW — pure-ish module, isolated from state machine.
  ├─ speak(text, opts)                 Web Speech wrapper, mute-aware
  ├─ vibrate(pattern)                  Vibration API wrapper
  └─ CueDeduper                        Prevents re-firing a cue already played this session

app.js                      MODIFIED — thin glue only:
  ├─ renderWorkoutDetail(): add "Start Workout" action + pre-run summary
  ├─ renderActiveWorkout(): NEW screen, driven by the state machine, renders current
  │    instruction/remaining time/progress; wires Pause/Resume/Skip/End controls
  ├─ persistActiveSession()/loadActiveSession(): localStorage via existing saveState pattern
  └─ completeWorkoutRun()/endWorkoutEarly(): writes into existing setLog/setSessionLog

merge-state.js               MODIFIED (small) — active-session state is device-local scratch,
                              NOT synced (see §4); only completed-workout writes (already-covered
                              logs/sessionLogs fields) participate in cross-device merge.
```

The state machine and normalizer are `require()`-able and fully testable headlessly, matching the project's own established pattern (`coaching-rules.js`, `merge-state.js`) — this satisfies "the core state machine must remain testable outside the UI."

### 3.1 State machine states (as specified)

`ready → warmup → work → recovery → cooldown → completed`, with `paused` and `ended_early` as cross-cutting states (paused remembers `previousState` to resume into; ended_early is terminal like completed).

The machine holds exactly the fields the task lists: workout id, start timestamp, current/next segment, segment duration, remaining time, elapsed active time (**pause time explicitly excluded** — tracked via a running `pausedMs` accumulator subtracted from wall-clock elapsed), interval index/total, active/paused/completed/ended flags, and a `playedCues: Set` for dedup.

### 3.2 Timestamp-based reconciliation (not `setInterval`-dependent)

Every tick recomputes `remainingSegmentTime` from `segmentStartedAt` (a real timestamp) and `now`, never by decrementing a counter per tick. This means:
- A delayed/throttled `setInterval` tick just recomputes correctly next time it fires — no drift accumulates.
- On resume (page becomes visible again, or app reopens), the same recomputation runs once immediately, correctly fast-forwarding through however many segments elapsed while suspended (task requirement: "several segments elapsed while suspended").
- `Page Visibility API` (`visibilitychange`) triggers an immediate reconciliation + persistence write on backgrounding and on foregrounding, independent of whether the timer kept running.

### 3.3 Persistence & recovery strategy

- `state.activeWorkoutSession` (new field, safe-defaulted to `null` in `loadState`, matching this session's established migration pattern) holds: workout id/key, normalized workout snapshot, current machine state, `segmentStartedAt`, `pausedMs`, `playedCues` (array, not Set, for JSON), started-at timestamp.
- Written on every state transition and periodically (e.g. every 15s while active) — not just on pause, so a hard app kill loses at most a few seconds, not the whole session.
- **This field is intentionally excluded from `mergeRunnerState`** (not added to the cross-device tombstone system built this session) — an in-progress workout is inherently single-device, ephemeral scratch state, not something meaningful to reconcile across two phones. On reopening on a *different* device, no active session is found, which is correct.
- On app load, if `state.activeWorkoutSession` exists: compute how much real time has passed since the last saved timestamp. If it's small/credible (e.g. under a generous threshold — needs a product decision, default proposal: same day and under ~4x the workout's total prescribed duration), offer **Resume**. Otherwise offer **save recoverable portion as partial** or **discard** — never silently resume a stale session, never fabricate completion.

---

## 4. Audio cues — behavior specification

Cue list matches the task's required set exactly (Begin warm-up, Start running, Start/Begin recovery, "Interval N of M", 10-second warning, halfway, final interval, Begin cooldown, paused, resumed, complete). Each cue fires from an explicit state-machine transition, never from a render pass, and is recorded in `playedCues` keyed by `segmentIndex + cueType` so re-renders or reconciliation replays can never re-speak it. Mute preference (`state.notifications`-adjacent new setting, e.g. `state.workoutAudio = { enabled: true, volume: ... }`) is checked before every `speak()` call, consistent with the existing "opt-in, never on by default"-except-obviously-workout-audio-should-default-on-since-it's-the-feature's-whole-point — default proposed **on**, with an obvious in-workout mute toggle. Vibration fires alongside every cue as a supplement where `navigator.vibrate` exists, and as the sole channel when audio is muted or `speechSynthesis` is unavailable.

---

## 5. Files expected to change

| File | Change |
|---|---|
| `workout-runner.js` | **New.** Normalizer + state machine, UMD module, fully unit-testable. |
| `audio-cues.js` | **New.** Speech/vibration wrapper + dedup ledger. |
| `coaching-rules.js` | **Additive only.** New optional `segments` field on select `QUALITY_POOL` entries and cross-training interval purposes; the dead `structure: day.runWalk ? null : null` stub in `buildRunSession` gets a real value. No existing field removed or renamed. |
| `app.js` | New `renderActiveWorkout()` screen; "Start Workout" wiring in `renderWorkoutDetail()`; `state.activeWorkoutSession`/`state.workoutAudio` defaults in `loadState`; completion writes into existing `setLog`/`setSessionLog`. |
| `merge-state.js` | Explicit exclusion note/handling for `activeWorkoutSession` (device-local, not merged). |
| `index.html`, `sw.js`, `app-version.json` | Cache-busting version bump (established pattern), new files added to `APP_FILES`. |
| `tests/workout-runner.test.js` | **New.** State machine + normalizer unit tests. |
| `tests/audio-cues.test.js` | **New.** Cue ordering/dedup/mute tests (mocked speech API). |
| `docs/WORKOUT_RUNNER_SPEC.md` | This document; updated as implementation proceeds. |

No changes planned to: XP/badges/Path (`side-quests.js`, `path-system.js`), weight tracking, progress stats, AI coach chat, subscription (doesn't exist), race distances, or any frozen feature listed in the task.

---

## 6. Phased implementation (each phase completed and tested before the next starts)

1. **Normalizer** (`workout-runner.js: normalizeWorkout`) — pure function, `day`+`sessions` in, a normalized segment list out. Tests: every workout shape in §1.4, including the "no structured data available" fallback path.
2. **State machine** (`workout-runner.js: createRunnerStateMachine`) — pure, no timers, no DOM, driven by an injected clock for testability. Tests: exactly the state-machine test list in the task brief (pause/resume in every state, skip, end early, dedup, no negative timers, single completion, etc).
3. **Persistence + recovery** — `state.activeWorkoutSession` wiring, reconciliation on load/visibilitychange, migration defaults. Tests: save/restore, stale-session handling, migration idempotency.
4. **Audio/haptic cue service** — isolated module, mute-aware, dedup-integrated with the state machine's `playedCues`. Tests: cue order, dedup, muted preference, unavailable-speech fallback.
5. **UI** — active-workout screen, Today/WorkoutDetail pre-run integration, controls, accessibility labeling. No new automated tests here beyond what a headless DOM test can reasonably assert (manual test matrix carries the real weight, §9).
6. **Completion/logging integration** — writes into existing schema, partial-save flow, regression tests confirming plan generation/logging/merge/XP-credit/subscription-absence/accessibility are all unaffected.
7. **(Conditional, separate approval)** Capacitor native shell — only if real-device testing shows the PWA audio/background approach is insufficient.

---

## 7. Safety boundary (explicitly preserved, not touched)

No changes to `coaching-rules.js`'s actual coaching logic — `evaluateSafety`, `painGuidance`, volume/long-run caps, run/walk progression tables, missed-workout handling, race-readiness logic. The runner *executes* whatever the plan engine already prescribed; it never alters what gets prescribed. No LLM involvement in timing, transitions, completion status, or any safety-relevant decision — the state machine and cue triggers are 100% deterministic, matching the project's existing "never AI for deterministic rules" convention (already true of `coaching-rules.js`, `painGuidance`, etc.).

---

## 8. Data migration

Because the plan is derived (not stored, §1.3), the only real migration surface is:
- `state.activeWorkoutSession` — new field, defaults to `null`, safe-absent for all existing users (matches this session's established `loadState` defaults pattern exactly).
- `state.workoutAudio` — new field, defaults to `{enabled: true, volume: 1}` or similar.
- The `deletedKeys` tombstone system built this session already establishes the exact idempotent-migration/safe-default pattern to reuse; no new pattern needs inventing.
- Existing completed workouts, logs, XP/badges, weight entries, subscription-absence, preferences — **untouched**, no schema change to any of them.

---

## 9. Manual real-world test matrix (to be executed on a real Android device — not simulated)

| # | Test | Device/Android ver | Audio output | Expected | Actual | Pass/Fail |
|---|---|---|---|---|---|---|
| 1 | Continuous easy run | Browser (emulated, not real Android) | — | Open stopwatch, no false distance claims | Verified via automated tests only (shares identical code path with #cross-training continuous, manually verified below) | Automated only |
| 2 | Beginner run/walk workout | | | Correct run/walk cue cadence per `runSec`/`walkSec`/`cycles` | Automated tests pass (interval numbering across cycles) | Automated only |
| 3 | Short intervals (time-based quality entry) | | | Correct interval numbering, 10s warning, halfway, final-interval cue | Automated tests pass | Automated only |
| 4 | Long intervals | | | Same as above at longer durations, no drift | Automated tests pass (clock-drift test) | Automated only |
| 5 | Tempo workout | | | Single continuous timed segment, correct cues | Automated tests pass | Automated only |
| 6 | Warm-up and cooldown | Browser (emulated) | — (visual) | Correct "Begin warm-up"/"Begin cooldown" cue timing | **Manually verified in-browser**: warm-up countdown, skip, correct segment transition into manual_rep with recovery auto-timing | Pass (browser) |
| 7 | Paused during work segment | Browser (emulated) | — | Pause freezes remaining time, resume continues correctly | **Manually verified in-browser**: paused at 29:32, held 3s, remained frozen, resumed to 29:29 | Pass (browser) |
| 8 | Paused during recovery | | | Same, correct segment type preserved | Automated test covers this (all 4 phases); not separately browser-clicked | Automated only |
| 9 | Segment skipped | Browser (emulated) | — | Next segment starts cleanly, no order corruption | **Manually verified in-browser**: skipped warm-up, correctly landed on Repetition 1 of 5 | Pass (browser) |
| 10 | Ended early | | | Partial/discard prompt, correct partial save | Automated tests pass; end-workout confirm dialog not manually clicked (uses window.confirm, same pattern as existing reset/delete buttons) | Automated only |
| 11 | Screen locked full workout | — | — | **Unverified — expected weak point per §2.1** | Not tested — requires real Android device | **Not tested** |
| 12 | Music playing in background | — | — | Ducking/interaction documented honestly per findings | Not tested — requires real Android device | **Not tested** |
| 13 | Podcast playing in background | — | — | Same | Not tested — requires real Android device | **Not tested** |
| 14 | Bluetooth headphones | — | — | Cues route to Bluetooth output | Not tested — requires real Android device | **Not tested** |
| 15 | Incoming call interruption | — | — | Audio resumes or state recovers cleanly after | Not tested — requires real Android device | **Not tested** |
| 16 | App backgrounded and returned | Browser (emulated) | — | Reconciliation correctly fast-forwards | **Manually verified via page reload** (closest browser-testable proxy): session persisted, recovery prompt shown, resume reconnected correctly with accurate elapsed time | Pass (browser proxy) |
| 17 | App terminated and recovered | Browser (emulated) | — | Resume/partial-save/discard prompt on reopen | **Manually verified in-browser**: reload mid-workout → "Unfinished workout" prompt → Resume → correct state restored | Pass (browser) |
| 18 | Offline execution | | | Runner works fully offline (no network dependency) | Not explicitly tested with network disabled, but the runner makes zero network calls by design (pure local state machine + Web Speech API) | Untested but architecturally offline-safe |
| 19 | Partial-workout logging | | | Correct `completionType: 'partial'`/`'stopped_early'`, no false full-completion | Automated tests pass; live end-early-and-save flow not manually clicked (completion flow WAS verified, see #20) | Automated only |
| 20 | Completion then reopening app | Browser (emulated) | — | Completed workout stays completed, no duplicate credit | **Manually verified in-browser**: completed workout, `logs['1-0'] = {time:'1:15', completionType:'planned'}`, `activeWorkoutSession` correctly cleared to null | Pass (browser) |

**Tests 11-15 (locked-screen, music/podcast ducking, Bluetooth, call interruption) categorically cannot be verified in this environment** — no real Android device is available here. Everything else has either automated unit-test coverage (workout-runner.js/audio-cues.js, 37 new tests) or was manually clicked through in a real (if emulated/non-Android) browser session, with actual localStorage/DOM output inspected, not assumed.

---

## 10. Decisions (approved 2026-08-05)

1. **PWA-first, Capacitor deferred** (§2.2) — approved. No native/Capacitor code was added.
2. **Additive `segments`/`manualReps` fields on `QUALITY_POOL`** (§1.4) — approved and implemented for 7 time-based entries (`segments`) and 4 distance-based entries (`manualReps`, recovery-only auto-timing).
3. **Screen-lock reality check** — approved. V1 ships with locked-screen/backgrounded audio explicitly documented as unverified/best-effort (§9 above), never claimed as reliable.

# Zaera — Coaching Engine Real-Device QA

Companion to `docs/COACHING_ENGINE_SPEC.md` and `docs/WORKOUT_RUNNER_SPEC.md`. Everything in those two docs was verified either by automated test (424 tests) or a single browser session with the real Web Speech API intercepted — **neither is a substitute for hearing the coach on a real phone, in your ear, while moving.** This doc is that pass: three real workouts, on a real Android device, with a concrete recording template so findings become evidence, not vibes.

Do not change cue timing, wording, or spacing before running these. Findings here are what should drive a small audio-polish phase — not a reason to touch the deterministic engine's architecture.

## Before you start: seed a plan without clicking through onboarding

Same technique already established in `docs/TEST_PLAN_ANDROID.md` — paste into the browser console (or run via remote debugging from desktop Chrome attached to the Android device) to skip the wizard:

```js
localStorage.setItem('training_plan_v1', JSON.stringify({
  lastModified: Date.now(),
  userName: 'QA', units: 'mi',
  raceGoal: { event: '10k', raceDate: '2026-09-16', goal: 'finish' },
  profile: { experienceLevel: 'beginner', runDaysPerWeek: 3, weeklyMileage: 8, injuryStatus: 'resolved', crossOptions: ['Cycling'], terrains: ['road'], availableDays: 4, canRunContinuously: false },
  planMeta: { level: 'beginner', weeksAvailable: 20, planLengthWeeks: 12, unsafe: false, warnings: [], checkpointDateIso: null },
  logs: {}, overrides: {}, crossType: {}, sessionLogs: {}, sessionOverrides: {}, dayAdjustments: {},
  unavailable: [], sideQuestLog: [], runningFeelingLog: [], recurringWorkouts: [], travelPeriods: [],
  weightTrackingEnabled: false, weightUnits: 'lb', weightEntries: [],
  scheduleChoices: {}, badges: [], sideQuestCalendar: {}, completedQuestTracks: [],
  activeQuestTrack: null, activeWeeklyChallenge: null, sideQuestOnboarding: null,
  path: null, pathNodes: [], notifications: { enabled: false }, flags: { enableLongerDistances: false },
  goalCheckpointResolved: false
}));
location.reload();
```

Then open Settings → Coach and set the frequency mode called for by each session below before tapping Start Workout. To reach a real interval/tempo day for Session 3, either wait until the plan naturally reaches a Build-phase week, or edit `raceGoal.raceDate` in the snippet above to roughly 6 weeks out with `profile.experienceLevel: 'intermediate'`/`canRunContinuously: true`/`planMeta.level: 'intermediate'` and reload — Today will land on a Build week with a real "N x [time] @ effort" or "Tempo: … @ threshold" session.

## The three required sessions

| # | Workout | Coaching mode | What it's testing |
|---|---|---|---|
| 1 | Beginner run/walk | Coach | Fully structured cues, run/walk transition cadence, beginner-only encouragement |
| 2 | Continuous easy run | Coach | Open-ended stopwatch honesty, optional cue spacing over an unstructured duration |
| 3 | Tempo or intervals | Detailed | Denser optional coaching, interval numbering, final-interval framing, pace fallback when no recent race result exists |

Run all three for real — start to finish, phone in pocket or armband exactly as a runner actually would, not propped on a table.

## Device/condition matrix

For at least Session 1, cover as many of these as practical in one outing (you don't need 3 separate runs per condition — combine within a session where it makes sense, e.g. lock the screen for the first half, put on Bluetooth for the second):

- [ ] Screen awake, phone in hand
- [ ] Screen locked, phone in pocket/armband
- [ ] App backgrounded (switched to another app) for at least 2 minutes, then returned to
- [ ] Bluetooth headphones (not phone speaker)
- [ ] Music playing underneath (a real music app, not silence)
- [ ] A phone call or notification arrives mid-workout
- [ ] Pause, wait 30+ seconds, resume
- [ ] Weak/lost connectivity for at least part of the run (airplane mode toggle mid-run is a reasonable stand-in for a dead zone)
- [ ] App suspended/killed by Android (not you force-quitting — let a locked screen + backgrounding for 10+ minutes trigger it naturally if possible) and reopened

## Recording template — fill this out per session, during or immediately after

```
Session #: ___   Date: ___   Device: ___   Android version: ___
Workout type: ___   Coaching mode: Minimal / Coach / Detailed
Screen state during run: awake / locked / mixed
Audio output: phone speaker / wired / Bluetooth (model: ___)
Music/podcast underneath: yes/no, app: ___
Interruptions encountered: none / call / notification / app switch / other: ___

Every cue actually heard (in order, approximate timestamp):
1.
2.
3.
...

Missed or noticeably delayed cues (expected but never heard, or heard very late):


Interruption/recovery behavior observed (what happened to the coach/timer after the interruption):


Phrases that felt too long / repetitive / unclear / unnatural / robotic:


Did you always know what to do next, without looking at the screen? Y/N — if no, where did it break down:


Was "Mission complete" heard exactly once, at the right moment?  Y/N


Anything that felt shaming, childish, or medically overconfident?  Y/N — quote it:


Overall: did this feel like a coach accompanying you, or a timer narrating at you?
```

## Specific things to listen for (from the spec's own intent, not just "did it work")

- Can every instruction be understood while moving, without re-reading it?
- Is the voice loud enough over music/wind/Bluetooth compression?
- Are any phrases too long to process while breathing hard?
- Does the coach talk too often — or go quiet for too long with nothing useful said?
- Are the 10-second transition warnings actually ~10 seconds before the transition, not late or early?
- Does coaching feel personalized to the workout (not the same 2-3 lines every single session)?
- After a pause/interruption, does the session pick back up correctly — right segment, right remaining time, no repeated or skipped cues?

## A known open question to specifically evaluate, not assume

The spec's default spacing is 25s of post-transition silence and 90–180s between optional cues. That's deliberately conservative for longer segments, but on a **60-second running interval in a run/walk workout**, that spacing alone could mean an interval never gets a single teaching cue during it. That may be *correct* (a 60-second interval may genuinely not need one), but confirm that judgment by listening to Session 1 specifically, rather than assuming either way. If the whole workout still feels like it taught the runner something by the end (the progressive-teaching focus line, effort/breathing cues during warmup and recovery, etc.), the spacing is fine as-is. If it feels empty end-to-end, that's real signal for a follow-up — but only after this pass confirms it, not before.

## What NOT to do based on this pass alone

- Don't add GPS, live pace, heart-rate, or wearable integration — that's a separate, larger decision gated on its own approval, not something this QA pass should motivate.
- Don't add new coaching categories.
- Don't touch the deterministic selection engine's architecture (`coaching-cues.js`'s priority/eligibility/scheduling logic) — if something's wrong, it's much more likely to be wording or timing constants than the engine shape itself.
- Do treat specific, quoted findings ("the interval-start cue for the 6th rep ran 4 seconds into the next segment on Bluetooth" / "'Begin walking recovery, let your breathing settle' was hard to parse while breathing hard, consider shortening") as the actual deliverable of this pass — vague impressions aren't actionable.

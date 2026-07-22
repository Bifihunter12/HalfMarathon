# RACR Side-Mission Expansion — Bodyweight Challenges, Equipment Personalization, Flexible Strength Support

Saved verbatim/condensed (2026-07-22). Expands `docs/RACR_Master_Prompt.md`'s Side Mission section with a full equipment-personalization model, a named bodyweight-challenge library, mission substitution/recommendation logic, and Side-Mission-specific XP/badge rules. **No explicit build instruction attached — spec only, matching how every other large drop this session (Side Quest spec, Quests Tab spec, RACR master prompts) was saved first and scoped via its own Plan Mode pass only when asked.**

**Important connection to prior work**: the run-logging correction's plan (2026-07-22, earlier today) flagged a deferred item — "the Side Mission catalog re-scope (demoting hike/cycling/rowing out of the primary Side Mission browsing experience)" — as a distinct correction not yet done. **This spec effectively resolves that ambiguity**: its entire MVP library (bodyweight/dumbbells/kettlebells/bands/mobility, listed below) contains zero hike/cross/cycling entries. Whenever this gets built, it should be read as the concrete version of that earlier deferred re-scope, not a separate additional pass.

## What already exists (`side-quests.js`, `app.js`) — must be reused, not rebuilt

- `state.sideQuestOnboarding` **already has** an `equipment` array field, `preferredDuration`, and `interest` array (see `loadState()`) — the onboarding flow this spec wants isn't starting from zero, it needs its option lists (equipment/location/duration/goal) reconciled with whatever the current onboarding screen already asks.
- `side-quests.js`'s `MISSION_CATALOG` already has per-mission `equipmentOptions`, `difficultyLevels`, `trainingPurpose`, `xpReward`, `avoidBeforeWorkoutTypes`/`avoidWhen`/`requiresCoachWarning` fields, plus `filterMissionsByEquipment`/`filterMissionsByExperience`/`filterMissionsByLimitations`/`recommendMissions` functions — this is already a real equipment-aware filtering engine, just with a smaller catalog (~5 missions explored earlier this session: Strong Runner 20, Upper Body 20, Core 10, Trail 90, plus others) than this spec's ~35-mission MVP library.
- `MOVEMENT_VARIANTS` (in both `side-quests.js` and a legacy copy in `app.js`) already implements "one movement, several difficulty-scaled exercise names" — the exact mechanism this spec calls "equipment-adaptive missions" (squat/hinge/push/pull each with foundation/base/strong/advanced variants). The new bodyweight-challenge library extends this same idea to named, progression-tracked challenges (Squat Century, Lunge Ladder, etc.) rather than single-session missions.
- `humanizeSlug()` (added this session) already fixes raw-slug display for `trainingPurpose`/badge ids — any new tag/category vocabulary this spec introduces should route through the same helper rather than needing its own fix later.
- The reward system's Phase 1 (`xp-system.js`, shipped this session) already has a Side Mission weekly XP cap (30% of that week's Main Quest XP) and reuses each mission's own `xpReward` field rather than a second table — this spec's XP rules (20-70 base, capped, no per-rep XP, no unlimited-repeat farming) are consistent with what's already built, not a contradiction.

## Core scope boundary

Side Missions give runners: an alternative to another run, short satisfying wins, basic supporting strength, mobility/movement quality, variety, equipment-appropriate options, home/outdoor/gym flexibility. **RACR must not become**: a bodybuilding/powerlifting app, a 1RM tracker, a detailed exercise-library product, or a replacement for real strength coaching. Main Quest stays running; Side Missions only support it.

## Equipment onboarding (4 questions, editable later)

1. **Equipment** (multi-select): bodyweight only, exercise mat, resistance bands, mini bands, dumbbells, kettlebells, bench/sturdy box, step/stairs, pull-up bar, suspension trainer/TRX, barbell+plates, cable machines, full gym, other, not sure yet.
2. **Where you train**: home / outside / gym / a mix.
3. **Preferred Side Mission duration**: 5-10 / 10-20 / 20-30 / up to 45 min.
4. **What Side Missions should help with**: stronger legs, stronger upper body, core, mobility, calf/ankle durability, general fitness, variety/fun, injury-resistant habits, "let RACR choose".

Never force a detailed gym assessment; all four answers editable later.

## Equipment-adaptive missions (one movement, several equipment-scaled versions)

Worked examples given for squat/hinge/push/pull missions, each with bodyweight → dumbbell → kettlebell → full-gym versions (e.g. Squat: bodyweight squat → goblet/two-dumbbell squat → kettlebell goblet squat → goblet/front squat/leg press). User can always pick a different equivalent variation; RACR may recommend one but never lock it.

## Bodyweight challenge library (12 named challenges — the spec's centerpiece)

Each defined with a rep/time progression, beginner and advanced variants, and an explicit "don't reward speed/poor form over quality" rule:

1. **Squat Century** — 100 controlled squats, any set structure (10×10, 5×20, personalized, accumulated). Beginner: chair/partial-range/supported squat. Advanced: tempo/pause/goblet squat.
2. **Lunge Ladder** — personalized reverse-lunge progression, 20→40→60→80→100 total reps across 5 levels (reverse lunges preferred as the default over forward lunges — easier to control). Alternatives: supported/stationary split squat, walking lunge, step-up, dumbbell/kettlebell lunge variants.
3. **Push-Up Progress** — establishes a suitable variation first (wall/counter/bench/knees/floor/feet-elevated), then 15→25→40→60→100 accumulated reps across 5 levels within that variation. Explicitly: moving from 20 incline push-ups to 5 controlled floor push-ups is itself a meaningful win, not a step backward.
4. **Glute-Bridge Builder** — 30→50→75→100, plus single-leg and weighted progressions.
5. **Calf Capacity** — 40→60→80→100, single-leg and loaded progressions, straight-knee/bent-knee variants, slow controlled lowering — never prescribe high calf volume right before a key run.
6. **Wall-Sit Builder** — accumulated time (not one max hold): 60s→2min→3min→5min, multiple sets allowed. Never reward shaking through pain or loss of position.
7. **Plank Accumulator** — accumulated quality sets: 2→4→6→8→10 min, with elevated/knee/standard/side plank, dead bug, bird dog as alternatives. Never a 20-min continuous plank as the goal.
8. **Step-Up Summit** — needs a step/stair/box; 50→100→150→200 total, accounting for step height/balance/knee comfort/proximity to running workouts.
9. **Single-Leg Stability** — progression from single-leg stand → stand with head turns → reach → supported single-leg deadlift → loaded. Rewards control, not just duration.
10. **Core Control** — a short combined mission (e.g. 3 rounds: 8 dead bugs/side, 8 bird dogs/side, 20s side plank/side, 12 glute bridges).
11. **Upper-Body Armor** — bodyweight (push-ups, prone Y-T-W, plank shoulder taps, bear-position hold) with equipment add-ons (dumbbell/kettlebell row, overhead press, band pull-apart, cable row).
12. **Runner's Leg Circuit** — a concise repeatable circuit (3 rounds: 12 squats, 8 reverse lunges/side, 12 glute bridges, 15 calf raises, 20s single-leg balance/side).

## Equipment-based challenge sets (beyond bodyweight)

**Dumbbell**: Goblet Squat Builder, Dumbbell Lunge Ladder, Romanian Deadlift Builder, Upper-Body Armor, Carry Strong, Dumbbell Full-Body Circuit.
**Kettlebell**: Kettlebell Foundation, Goblet Squat Builder, Deadlift Builder, Swing 100/250/500-accumulated, Carry Strong, Kettlebell Full-Body Circuit. **High-rep kettlebell swings must gate behind a technique intro + deadlift foundation + low-volume start + a back-pain screening question** for inexperienced users — never jump straight to high volume.
**Full gym**: kept deliberately simple — Runner Strength A/B, Lower-Body Foundation, Upper-Body Support, Full-Body Strength, Calf and Ankle Builder. No bodybuilding splits, no forced detailed logging (simple mode: completed/duration/effort/exercises/notes; detailed mode: exercise/sets/reps/weight/variation/effort — **simple is the default**).

## Mission formats (4 durations)

Quick (5-10 min, e.g. 50 squats/20 lunges/15 push-ups/2-min plank/5-min mobility) · Standard (10-20 min, e.g. Runner's Leg Circuit, Upper-Body Armor, Core Control, Post-Run Mobility, Calf Capacity) · Full Support Session (20-30 min, e.g. full-body/dumbbell/kettlebell runner strength, complete mobility) · Multi-Day Challenge (e.g. 500 squats/7 days, 300 lunges/2 weeks, 100 push-ups/1 week, 500 kettlebell swings across approved sessions, 7-day mobility streak — **must account for running load, never high lower-body volume during peak weeks**).

## Recommendation logic (recommended / optional / not-recommended-today / temporarily unavailable / needs-easier-variation)

Inputs: today's + tomorrow's Main Quest workout, recent training load, reported fatigue/pain, race phase, equipment, available time, completed Side Missions, user preference. Worked examples given for after-easy-run (recommend short core/upper-body/mobility/light calf; not high-volume lunge/squat before tomorrow's intervals), before-long-run (recommend mobility/short core/light upper; never Squat Century/Lunge Ladder/heavy lower-body/high-volume swings), after-long-run (recommend gentle mobility/recovery movement; never high-volume step-ups/heavy lower-body/jumping/hard lunges), and during-taper (recommend short maintenance strength/mobility/core/light movement; never new exercises/high-volume challenges/soreness-producing missions/max-rep tests).

## Flexible substitutions

Every mission needs listed alternatives (e.g. Squat Century → chair squat/supported squat/goblet squat/leg press/step-up mission). A "Give me another version" action must explain what changed, why the substitute is equivalent, whether difficulty changed, and whether XP stays the same.

## XP rules for bodyweight challenges (stays below Main Quest XP, matches this session's already-shipped weekly cap)

Quick bodyweight mission 20-30 · Standard bodyweight circuit 35-50 · Full strength-support session 50-70 · First completion of a named challenge: +50 bonus · Completing a full progression: +75-125 bonus. Named examples: Squat Century 40, Lunge Ladder 40, Push-Up Progress 35, Runner's Leg Circuit 50, Full Runner Strength 65, Mobility Reset 20, Mobility Progression +75 bonus. **Never per-repetition XP. Never unlimited XP for repeating the same challenge** — full XP once per recommended recovery window, reduced/zero for unsafe repetition, weekly cap (already shipped), no extra XP past the programmed target.

## Badges (small, meaningful set)

Squat Century, Lunge Builder, Push-Up Progress (new milestone/variation), Stronger Strides (5 running-support strength missions), Single-Leg Strong, Calf Capacity, Core Engine (5 core missions), Bodyweight Builder (squat+hinge+push+core+single-leg all touched), Home Base (10 approved at-home missions), Equipment Explorer (3 different equipment categories used). Never reward unsafe max-rep attempts.

## Smaller accomplishments (frequent, sit below badges)

First squat/lunge/push-up/strength/mobility/dumbbell/kettlebell/gym mission, first 10-min strength session, first complete bodyweight circuit, new push-up variation, increased squat load, completed all planned sets, four weeks of Side Mission consistency.

## Progression discipline (stay a running app, not a strength app)

Progress **one variable at a time**: reps, sets, duration, exercise variation, resistance, movement control, range of motion. **Explicitly do not implement**: periodization, 1RM prediction, bodybuilding volume analysis, powerlifting totals, hypertrophy dashboards, competitive leaderboards, advanced programming.

## Side Mission home screen

Sections: recommended today, quick missions, strength, core, mobility, challenges, current progressions, recently completed, not-recommended-today. Filters: equipment (no-equipment/dumbbells/kettlebells/bands/full gym), time (5/10/20 min), focus (upper/lower/core/mobility). Each card shows: name, duration, equipment, difficulty, training effect, XP, progress, why-it-supports-running, today's recommendation status.

## Mission completion experience (7 elements)

Mission result → what was completed → why it supports running → XP earned → badge progress → progression level → impact on upcoming running (e.g. "Your long run is in two days, so no additional lower-body challenge is recommended tomorrow").

## Safety / red-flag logic

Before lower-body missions, let the user report knee/hip/back/ankle pain, significant soreness, or unusual fatigue — never recommend a mission that would aggravate reported pain. Stop/modify on sharp pain, increasing joint pain, loss of control, dizziness, chest pain, severe shortness of breath, or neurological symptoms — direct toward medical evaluation for concerning symptoms. Never encourage finishing a rep target through worsening pain.

## MVP library (~35 missions across 5 equipment categories)

**Bodyweight** (12, listed above in full) · **Dumbbells** (6: Dumbbell Runner Strength, Goblet Squat Builder, Dumbbell Lunge Ladder, Romanian Deadlift Builder, Carry Strong, Dumbbell Upper Body) · **Kettlebells** (6: Kettlebell Foundation, Goblet Squat Builder, Kettlebell Deadlift, Swing Progression, Carry Strong, Kettlebell Runner Circuit) · **Bands** (6: Band Strength, Glute Activation, Band Row, Pallof Press, Hip Stability, Ankle and Calf Support) · **Mobility** (7: Five-Minute Reset, Post-Run Reset, Hip Mobility, Ankle Mobility, Calf Mobility, Back-Friendly Mobility, Full Runner Mobility).

## 20-point Definition of Done

Equipment selectable + editable later; bodyweight-only/dumbbell/kettlebell/full-gym users all get appropriate complete experiences; every mission explains its running benefit; squat/lunge/push-up challenges included with beginner→advanced scaling; time+equipment filtering; running-schedule-aware recommendations; lower-body challenges never recommended before key runs; mission XP stays below Main Quest XP; no unlimited XP farming via repeated short missions; missions award accomplishments/badge-progress/XP; simple+detailed logging modes; easy substitutions; never pressure training through pain; Side Missions add flexibility without replacing running; the product still feels like a running app, not a strength app.

## Final product rule

Main Quest builds the runner; Side Missions build the support system around the runner. No-equipment users need meaningful options; dumbbell/kettlebell users need useful variations; full-gym users should be able to use their gym without RACR becoming a gym-programming app. The system must stay simple enough to start, flexible enough to personalize, challenging enough to feel rewarding, safe enough to support the running plan, and focused enough to remain unmistakably RACR.

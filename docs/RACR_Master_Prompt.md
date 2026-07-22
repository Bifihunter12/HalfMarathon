# MASTER PROMPT — RACR Main Quest, Side Missions, Path & Badge System

**Brand:** RACR — "Your race. Your plan."

Full product/behavioral-design spec for RACR's three connected systems: **Main Quest** (the race-training plan), **Side Missions** (optional strength/mobility/hiking/cross-training/recovery), and **Path** (a visual journey timeline with phase gates, badges, and milestones). Supersedes/formalizes the direction already underway in `side-quests.js` and `path-system.js`.

## Core product identity

Main Quest always remains the central objective. Side Missions support it — never encourage undermining the running plan, skipping recovery, or turning optional training into guilt. Path makes progress tangible: user should always know where they are, what they've completed, what phase they're in, what capability they've built, their next milestone, race-day proximity, and which Side Missions are currently safe.

**North star:** reinforce real evidence of showing up, learning to train, becoming more capable, adapting without quitting, self-trust — never daily-open compulsion, meaningless points, random extra mileage, streak preservation at any cost, or exercising through pain.

## Behavioral design foundation (10 principles)

Meaning (connect actions to identity/race, not "workout complete"), specific target, clear/timely prompts, feasible action (every workout needs a planned + coach-approved-alternative + minimum + skip/recovery option), reduced friction, immediate specific feedback, visible progress across multiple layers (not just points/miles), flexible identity framing, adaptive difficulty, rapid recovery after a miss (never punishment workouts or make-up mileage).

## Information architecture — ⚠ conflicts with an existing decision

Spec calls for **three primary tabs**: Main Quest / Side Missions / Path. **This directly conflicts with the "top header icon, not a bottom tab bar" decision made earlier in this app's build** (confirmed twice already — Codex's own `primaryNavHtml`/`wirePrimaryNav` bottom-tab-bar code has been removed twice for this exact reason). Needs an explicit decision before implementing this part: either the reasoning for avoiding bottom tabs no longer holds now that there are genuinely 3 co-equal destinations, or the spec's "3 tabs" should be read as "3 primary sections" reachable via the existing header-icon pattern rather than literal bottom nav. Not resolved in this doc — flagged for the next actual build session.

**Tab 1 — Main Quest**: race name/distance/date/countdown, phase, today's session (purpose, effort/pace target, warm-up, main set, cooldown, coach guidance, alternatives, completion action), 7-day upcoming schedule, phase progress, relevant milestone. Stays the primary daily interface.

**Tab 2 — Side Missions**: categories (strength, core, mobility, hiking, cross-training, technique, recovery, race prep, mental resilience, fun challenges). Each mission shows name/category/description/why-it-helps/duration/difficulty/equipment/progress/completion requirements/timing/contraindications/badge progress/recommended-neutral-not-recommended status. Dynamically filtered by training context (never recommend hard lower-body before intervals/long run, recommend mobility during high load, hide high-load missions during injury mod).

**Tab 3 — Path**: vertical/winding route, Main Quest route central and dominant, Side Missions branch off relevant nodes, phase milestones larger than workout nodes, badges appear beside their point in the journey, completed nodes visually resolved, current node prominent, near-future visible, distant nodes simplified, race day is the visible destination. Must feel like a journey, not a calendar.

## Phases

START → BASE → BUILD → ENDURE → SHARPEN → TAPER → RACE. Exact count/naming may adapt to short plans; psychological journey must stay coherent. (Note: differs from the currently-shipped `path-system.js`, which uses base/build/peak/taper/race phase names matching the existing plan engine — reconciling naming is part of any real implementation pass.)

## Node types

Standard workout, key workout (visually larger — long run/intervals/threshold/race-pace/rehearsal), week checkpoint, phase gate, side-mission branch, badge node, race-day destination.

## Workout completion states

Upcoming, available, in progress, completed as planned, completed with coach-approved adaptation, minimum completed, recovery substituted, skipped, rescheduled, locked, missed-but-recoverable. Each has defined credit/messaging rules (see full spec below) — critically: **adaptation ≠ failure**, **minimum completion still counts**, **a miss never erases prior progress or triggers make-up mileage**.

## Side-mission completion states

Available, recommended, optional, not-recommended-today, locked-until-prerequisite, in progress, completed, mastered, temporarily paused.

## Reward hierarchy (5 levels)

1. Immediate completion feedback (specific, not generic "Awesome job!")
2. Accomplishments (factual milestones — first continuous mile, first 20-min run, etc. — not necessarily badges)
3. Badges (meaningful behavior/capability/identity evidence)
4. Phase badges (major Main Quest transitions)
5. Race artifact (permanent "RACR Season Card" after race day: race/distance/date/finish time/goal/plan length/completed+adapted workouts/longest run/key capability/favorite badge/collection/photo/title/coach reflection)

## Badges

Full data model: id/slug/name/descriptions/category/subcategory/tierModel/currentTier/maxTier/iconKey/hidden/repeatable/primaryBehavior/whyItMatters/unlockRules/progressRules/contraindications/phaseEligibility/planEligibility/raceDistanceEligibility/userLevelEligibility/earned/earnedAt/progress/relatedWorkoutIds/relatedMissionIds/relatedSeasonId/nextMilestoneId.

**13 categories**: Main Quest, Identity/consistency, Running mastery, Endurance, Speed/pace, Recovery/adaptation, Strength, Core, Mobility, Hiking, Cross-training, Race prep, Hidden discovery.

**MVP set: ~30 badges**, spelled out in full in the source spec — 10 Main Quest (Laced Up, Week One, Base Builder, Long Run Unlocked, Halfway There, Peak Week, Taper Trust, Race Ready, Start Line, RACR Finisher), 6 Identity (Runner by Action, Kept the Promise, Momentum, Hard-Day Win, Never Miss Twice, Self-Trust), 6 Running Mastery (Easy Means Easy, Pace Sense, Interval Apprentice, Precision, Long-Run Confidence, Fuel Tested), 5 Recovery (Rest Is Training, Smart Swap, Body Listener, Deload Discipline, Comeback), 5 Side-Mission (Stronger Strides, Core Engine, Mobility Matters, Hiker's Detour, Quest Collector). Post-MVP list is much longer (running skill/strength/mobility/cross-training/exploration/discipline categories).

**Tiers**: Discovered → Built → Proven → Mastered, same icon evolving through tiers rather than 4 separate badges (example: Easy Means Easy 1/5/15 runs → full phase).

**Hidden discovery badges** (limited, "now-that" recognition): Perfectly Boring, Negative Split, No Watch No Problem, New Ground, Quiet Confidence, Coach's Choice. Explicitly never for extreme distance/danger/ignoring pain/illness/sleep deprivation/excessive volume.

**Explicitly forbidden** (badges and mechanics): No Rest Days, Pain Is Weakness, 7-runs-in-7-days universal challenge, calorie burn, fastest easy run, ran-while-sick, ran-through-pain, beat-everyone, perfect-plan-no-mods, streak-saved-at-any-cost, sleep-is-for-the-weak, double-workout-redemption, make-up-mileage, punishment-run. Never remove earned badges after a miss, reset the whole Path, shame publicly, require social sharing, use deceptive countdowns/fake scarcity.

## Progress system

7 layers (plan/phase/weekly-adherence/mastery/side-mission/badge/race-readiness progress) — points/XP are an optional light layer only, never the primary meaning, never awarded for exceeding prescribed mileage, never determine coaching decisions.

**Weekly adherence, not daily streaks** — states: on course / adapted intelligently / partially completed / recovery week / needs recalibration. A user who did 3 planned + 2 valid adaptations may be more "adherent" than one who ran extra unplanned mileage.

## Side-mission safety logic

Each mission needs: min training-phase requirement, equipment, duration, muscle groups, recovery cost, impact level, running-interference risk, contraindications, recommended days, incompatible adjacent workouts. Specific rules given for lower-body strength (never before intervals/long run), upper-body (more flexible but still fatigue-aware), hiking (real endurance work, not "free recovery" — account for elevation/terrain/downhill damage/pack weight), kettlebell swings (technique-gated), plank challenges (accumulated quality sets, never a 20-min continuous hold).

## Data models

`Badge`, `PathNode`, `SideMission` — full field lists in the source spec. Badge evaluation must be event-driven (workout completed/adapted/skipped, recovery selected, weekly review, phase completed, mission completed, PR, race rehearsal, race completed, pain warning, return-to-running progression), idempotent, non-duplicating, retroactively re-evaluable, and never award a badge based solely on self-reported unsafe behavior.

## Race seasons

Each training plan = a season (goal/distance/date/phases/path/missions/accomplishments/badges/season card). Ending a season preserves its Path, badges, and card; some mastery badges persist across seasons as lifetime badges (e.g. "Easy Means Easy — Mastered"), while season-specific ones reset appropriately.

## Recovery-safe language

Explicit approved phrases ("The plan changed because your conditions changed," "You did not lose the workout, you protected the larger goal," "Rest is part of the plan") vs. forbidden phrases ("You failed," "Streak broken," "No excuses," "Push through," "Make up the miles tomorrow").

## MVP implementation order

Phase 1 Foundation (3-tab IA, Path data structure, Main Quest nodes, phase gates, completion states, basic mission model, badge model, event-driven evaluation) → Phase 2 Core Experience (vertical Path UI, branches, node states, phase transitions, badge reveal/cabinet, weekly checkpoint) → Phase 3 Adaptation (coach-approved alternatives, minimum completion, recovery substitution, rescheduling, miss recovery, recovery badges, context-aware recommendations) → Phase 4 Personalization (thresholds by race distance/experience/plan length/preferences) → Phase 5 Season Completion (race-day destination, Finisher badge, Season Card, archived Path, lifetime vs. season badges).

## 20-point Definition of Done

See source spec — covers: plan→Path coherence, node status clarity, key-workout/phase-gate visual distinction, mission branching without competing with Main Quest, all 6 completion paths (complete/adapt/minimize/recover/reschedule/skip) working, miss-doesn't-erase-progress, rest producing positive feedback, MVP badges covering starting/consistency/mastery/recovery/missions, transparent non-hidden requirements, no unsafe-behavior rewards, visible next-milestone, race day as Path destination, permanent Season Card, accessibility, persistence correctness, duplicate-award prevention, automated test coverage for unlock/recovery logic.

## Coding instructions (from the spec, worth repeating)

Inspect existing architecture before changing code; reuse existing components/conventions; don't rebuild unrelated sections; keep badge logic separate from visual presentation; keep coaching logic separate from reward logic; make unlock requirements data-driven, not hard-coded in UI; seed MVP badge data; add tests for the evaluation engine; no placeholder interactions; no mock data where production data exists.

## Ethics test (apply before implementing any reward)

12 questions, most load-bearing: does this reward a real behavior that supports the race goal? Can it be gamed unsafely? Does it make rest look like failure? Would a qualified running coach approve it? If the answer reveals unsafe/meaningless behavior, don't implement it.

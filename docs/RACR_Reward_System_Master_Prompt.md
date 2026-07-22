# MASTER PROMPT — RACR Reward System, XP Economy, Achievements, Badges and Levels

**Brand:** RACR — "Your race. Your plan."

Saved verbatim/reformatted (2026-07-22). **This is the authoritative, engineering-grade version of the reward system** — it supersedes `docs/RACR_Leveling_System.md` (2026-07-22's earlier narrative addendum, kept for history/context but no longer the reference to build from) and completes the reward-system gaps flagged in `docs/RACR_Master_Prompt.md`. Must integrate with Main Quest, Side Missions, the race-training Path, workout logging, running-performance tracking, badges, XP, RACR Levels, Race Readiness, and completed race seasons — never implement isolated points/badges/levels disconnected from meaningful training behavior.

## Core product truth (unchanged from the standing spec)

Main Quest: run farther, faster, better endurance/pace-control, appropriate speed work, race prep, healthy start line, intelligent race-day execution. Side Missions: strength, core stability, mobility/useful ROM, tissue/joint capacity, better training tolerance. **Main Quest must remain more valuable than Side Missions** — a user must never be able to ignore the running plan, stack small mobility sessions, and progress faster than someone following the Main Quest.

## Reward system must answer six separate questions — never merge into one number

1. **Path progress** — "How close am I to completing this race-training journey?" (season-specific)
2. **Running progress** — "Am I running farther, faster, or with better control?"
3. **Achievements** — "What meaningful things have I done?"
4. **XP** — "How much valid training experience did I earn from this action?"
5. **RACR Level** — "How much experience have I accumulated as a runner across all training seasons?" (permanent, cross-season)
6. **Race Readiness** — "How prepared am I for my current target race?" (current-season only, never combined with RACR Level — a high-level user can have low readiness after a break; a brand-new low-level user can arrive readier if they joined with existing fitness)

## Six connected reward layers

1. **Immediate feedback** — every valid completed action gets specific feedback: completed result + coach interpretation + XP earned + badge progress + Path advancement + next meaningful action. Never bare "Great job!"/"Amazing!"/"You crushed it!" — generic encouragement may *accompany* specifics, never replace them.
2. **Micro-wins** — small meaningful actions shown post-workout, not permanently collected as individual badges ("Showed up," "First run of the week," "Warm-up completed," "Easy effort held," "All intervals completed," "Fueling practiced," "Safer choice made," "Rest day respected," "Returned after disruption," "Strength/mobility session completed"). Can award XP and feed badge progress without cluttering the cabinet.
3. **Accomplishments** — factual personal milestones stored in history (first completed run/continuous mile/20-min run/30-min run/5K/10K/complete training week/long run, longest run, first tempo/interval/hill/race-pace session, first fueling rehearsal, four consistent weeks, first completed strength/mobility progression, first completed race season). Not every accomplishment needs a badge.
4. **Badges** — meaningful patterns/skills/behaviors/milestones/phase-completions/recovery-decisions/Side-Mission-progressions/race achievements. Award bonus XP. Must stay less frequent and more prestigious than micro-wins.
5. **RACR Level** — permanent across seasons, represents accumulated valid experience. Never represents race readiness, current fitness, speed, athletic superiority, medical clearance, or permission for advanced training.
6. **Season artifact** — every completed race season creates a permanent Season Card: race name/distance/date/finish result/goal type/plan duration/Main Quest completion/total distance trained/longest run/key workout accomplishments/Side Missions completed/badges earned/final RACR Level/favorite achievement/coach summary/optional race photo.

## Main Quest vs. Side Missions economy

Target **70–80% of weekly XP from Main Quest, 20–30% from Side Missions**. Main Quest actions: easy/recovery/long/tempo/threshold/interval/hill/race-pace/benchmark/race-rehearsal runs, prescribed cross-training, planned rest, taper actions, race day. Side Missions: running-specific strength, general strength, core, mobility, flexibility, yoga for runners, calf/ankle capacity, single-leg strength, post-run mobility. **Cross-training is not automatically a Side Mission** — cycling/rowing/walking/other aerobic work belongs to the Main Quest when it's plan-prescribed, replaces a run via coach-approved modification, or is part of injury/fatigue management.

## XP's three functions / what XP must never do

1. Immediate reinforcement (today's correct action has evidence now, race outcome is weeks away).
2. Permanent experience (accumulates across seasons, feeds RACR Level).
3. Optional unlocks (personalization, historical insights, optional content).

Must never: replace training metrics, determine medical/safety decisions, encourage unnecessary mileage, punish missed days, make users exercise through pain, let users buy race readiness, give speed bonuses on easy runs, or function as a social status score across unlike runners.

## Main Quest XP values (store in configuration, not hard-coded in the UI)

Easy run 100 · Recovery run 90 · Long run 175 · Tempo 150 · Threshold 150 · Interval 150 · Hill 140 · Race-pace 160 · Benchmark 175 · Race rehearsal 200 · Prescribed aerobic cross-training 80 · Rest day followed appropriately 40 · Taper action 60 · Race-day prep checklist 75 · Race completed 500 · Goal result achieved: +250 bonus.

**Never award more for exceeding planned distance** — example: planned 5mi easy, actual 7mi → still 100 base XP, not +40%. Coaching feedback (not a bonus) is the right response to inappropriate extra mileage.

## Side Mission XP values (must stay lower than comparable Main Quest XP)

Short mobility 20–25 · Complete mobility routine 30–35 · Core session 35–40 · Upper-body strength 45–50 · Running-specific strength 55–60 · Complete full-body strength 60–70 · Strength progression completed: +100 bonus · Mobility progression completed: +75 bonus · Side Mission series completed: +100 bonus.

## Side Mission weekly XP cap

Repeatable Side Mission XP ≤ **30% of that week's available Main Quest XP** (e.g. 600 Main Quest XP available → max 180 repeatable Side Mission XP). User may still log Side Missions past the cap, just without unlimited repeatable XP; badge bonuses may be handled separately from the cap. Prevents mobility/strength farming, repeated trivial actions, Side Missions replacing running, and over-training beyond what the plan supports.

## Completion modifiers (depend on whether the workout's *purpose* was achieved, not raw compliance)

Completed as prescribed / within accepted range: 100%. Coach-approved adaptation preserving intended purpose: 85–100%. Coach-approved alternative partially preserving purpose: 65–85%. Partial for a legitimate reason: 40–75%. Hard-day minimum: 35–50%. Recovery substituted because training was inappropriate: 60–100%. Missed: 0%. Unapproved extra volume: 0 bonus. Unsafe continuation through a serious pain warning: no bonus. Returned at next valid opportunity: recovery bonus may apply.

Worked examples: 45-min easy run → 45-min easy bike for impact discomfort = 85–100% if aerobic purpose preserved. 10mi long run → 9.5mi because of an emerging pain signal, stopped appropriately = potentially 90–100% + progress toward *Body Listener*. 10mi long run → 13mi "for extra XP" = no extra XP, no additional Path advancement.

## Quality bonuses (small, occasional, tied to correct execution — never unlimited)

Correct easy effort +10 · Controlled interval execution +15 · Successful fueling rehearsal +15 · Warm-up/cooldown completed +5 each (reasonable limits) · Appropriate pace consistency +10 · Race rehearsal completed correctly +25. **Never** for: running an easy run faster than prescribed, exceeding distance, ignoring recovery, completing through meaningful pain, unplanned extra reps, excessive calorie burn, or finishing exhausted when that wasn't the goal.

## Badge XP

Small milestone 50 · Standard behavior 100 · Recovery/comeback 125–150 · Side Mission progression 100 · Mastery 175 · Major distance 200 · Main Quest phase 250 · Race Ready 300 · Start Line 300 · RACR Finisher 500 · Goal result achieved: +250 additional. Must feel meaningful but accumulated training work must remain worth more collectively than a single badge.

## "Showed Up" progressive mastery badge

First Step (1 valid scheduled run) → Showing Up (5) → Building the Pattern (15) → Runner by Action (30). Valid = completed as planned/within range/coach-approved modification/legitimate minimum. Never counts: random unplanned mileage, duplicate entries, unsafe workouts, farmed edits. Hard-day-minimum message: *"You completed the version that fit today. The full training stimulus was reduced, but your return pattern remains intact."* → partial XP + Showing-Up progress + Hard-Day-Win progress, never a false "full workout completed" claim.

## Long-run rewards

First Long Run · Long-Run Confidence (3 prescribed long runs) · Long-Run Discipline (multiple long runs inside intended effort range) · Distance Unlocked (new planned long-run distance — only plan-relevant milestones: 5K/5mi/10K/8mi/10mi/half/15mi/18mi/20mi; never push a 5K trainee toward marathon-distance badges) · Time on Feet (personalized: 45/60/75/90/120/150 min) · Strong Finish (only for an explicitly prescribed progression long run executed correctly — never for racing the end of an ordinary easy long run).

## Fast-run rewards (control, never recklessness — never a fastest-easy-run bonus)

Speed Session (first interval/hill/speed workout) · Interval Apprentice (first structured interval within accepted execution range) · Controlled Speed (all prescribed reps, no significant pacing collapse) · Precision (eligible reps within configured consistency range) · Threshold Builder (3 threshold sessions at intended effort) · Tempo Progress (improved pace at comparable duration/effort across multiple qualifying workouts) · Race-Pace Ready (key race-pace workout in prescribed range) · Personal Best (only via benchmark/race/eligible time trial/verified effort). Evaluation weighs workout type, target vs. actual pace, RPE, rep consistency, recovery completion, terrain, conditions, HR (when available), and whether it stayed safe.

## Side Mission progressions

**Strength**: Strength Foundation → Stronger Strides → Single-Leg Strength → Posterior-Chain Builder → Calf Capacity → Durable Runner. Considers sessions/exercises completed, load/rep/variation progression, technical consistency, phase consistency — never extra XP just for heaviest-possible weight.
**Core**: Brace → Anti-Extension → Anti-Rotation → Carry Strong → Core Engine. Avoid extreme continuous plank-duration challenges; reward quality/progression/control/appropriate accumulated duration.
**Mobility**: Mobility Started → Post-Run Reset → Ankles Unlocked → Hips in Motion → Move Better. Reward consistency/routine completion/appropriate progression — never claim objective flexibility improvement absent a real assessment.

## Badge categories (15) and tiers

Categories: Main Quest, Showing Up, Consistency, Distance, Endurance, Speed, Pace Control, Recovery, Adaptation, Strength, Core, Mobility, Race Preparation, Race Completion, Hidden Discovery.

Tiers for long-term mastery badges: Discovered → Built → Proven → Mastered (one evolving badge, not four separate ones). Example — **Easy Means Easy**: Discovered = 1 easy run in range; Built = 5; Proven = 15; Mastered = an entire phase with consistently appropriate easy-run effort.

### Badge-completion experience (what to show when earned)
Badge name, icon, tier, what the user did, why it matters, bonus XP, location on the Path, next related milestone. Example — **Long-Run Confidence**: *"You completed three prescribed long runs. Long runs gradually increase your endurance and confidence for the target race. +175 Badge XP. Next: complete the next planned distance progression while keeping the effort controlled."*

### Hidden badges (limited, unannounced)
Perfectly Boring (easy run almost exactly as intended) · No Watch, No Problem (effort-based workout accurate without repeatedly checking pace) · Negative Split (eligible workout, controlled negative split) · New Ground (new running route) · Quiet Confidence (key workout without repeatedly checking projected race results) · Coach's Choice (followed a coach-recommended adaptation differing from the original schedule). **Never** for extreme volume, dangerous weather, running while sick, ignoring pain, sleep deprivation, daily training, or excessive calorie burn.

## RACR Level system — permanent 50-level structure

Represents accumulated valid experience across all seasons; advances quickly at first, slower over time. Cumulative-XP calibration table (store as editable config, not hard-coded — must be tested against 4/6/12/20-week plans, beginner/advanced, and multiple completed seasons before finalizing): L1 0 · L2 200 · L3 500 · L4 850 · L5 1,250 · L10 4,500 · L15 9,000 · L20 15,000 · L30 31,000 · L40 52,000 · L50 80,000 (interpolate between). Expected pacing: L2 ≈ 2 valid workouts, L3 ≈ first week, L5 ≈ 2–3 weeks, L10 ≈ a meaningful training block, L20 ≈ 1+ substantial seasons, L50 ≈ multi-season long-term.

### Rank titles
1–4 In Motion · 5–9 Building · 10–14 Grounded · 15–19 Enduring · 20–24 Advancing · 25–29 Racecraft · 30–39 Seasoned · 40–49 Proven · 50 RACR. Never "Elite"/"Professional"/"Expert athlete"/"Olympian" unless a verified athletic classification — this measures RACR experience, not competitive rank.

### What leveling up unlocks (examples)
L2: select first profile title. L3: choose preferred completion animation. L5: first Path theme. L7: first badge frame. L10: advanced 8-week trend comparison. L15: custom Season Card layout. L20: multi-season comparison. L25: Racecraft title + race-execution summary. L30: lifetime Path view. L40: legacy badge frame + custom crest options. L50: RACR lifetime crest + permanent Level-50 profile treatment. Broader unlock categories: profile titles/frames, Path themes/accents, celebration styles, Season Card layouts, badge-cabinet customization, historical/multi-season comparison views, lifetime timeline, advanced benchmark insights, additional Side Mission variations, advanced optional challenges, custom crest, annual summary, milestone-display settings.

### Never level-gate
Manual run logging, distance/time tracking, pace calculations, safety information, pain reporting, recovery substitutions, training-plan explanations, rescheduling, core progress metrics, essential strength/mobility, workout modifications, race-readiness information, accessibility, user data export.

### Level-up experience
Explain *why* the level matters, don't just show a number. Example — **Level 10 — Grounded**: *"You have built enough valid training experience for running to become a repeatable pattern rather than a one-time effort."* Then show: total Main Quest workouts, total completed runs, longest run, current consistency, meaningful badges, new unlock, progress to next level. No huge interruptive celebration every level — reserve stronger presentation for milestone levels 5/10/15/20/25/30/40/50.

## Race Readiness — a fully separate system

RACR Level = permanent accumulated experience. Race Readiness = current preparation for the *selected* race, considering recent consistency, long-run progression, current weekly volume, key-workout execution, race-pace workouts, recovery, pain status, training interruptions, fueling rehearsal, taper completion, race-specific prep. A high-level user can have low readiness after a long break; a low-level user can have high readiness if they joined with existing fitness. **Never combine the two values.**

## Post-run reward flow (8 steps, dismissible quickly, no blocking multi-screen chain)

1. **Result** (e.g. "4.62 miles · 50:15 · 10:53/mi · RPE 4")
2. **Planned vs. actual** (target block vs. actual block)
3. **Coach interpretation** (e.g. "You completed the intended aerobic work and kept your effort within the correct range")
4. **Micro-wins** (e.g. "Easy effort held," "Warm-up completed," "First run of the week")
5. **XP** (e.g. "+100 Main Quest XP, +10 Execution Bonus, Total +110 XP")
6. **Level progress** (e.g. "Level 7: 620/850 XP")
7. **Badge progress** (e.g. "Easy Means Easy: 4 of 5," "Showing Up: 13 of 15")
8. **Path advancement** (resolve the completed node, reveal/emphasize the next one)

**Already partially shipped (2026-07-22, same day)**: steps 1 and 3 (result + a deterministic one-sentence coach interpretation) via the run-logging correction's `interpretRunResult`/Planned-vs-Actual block — step 2 (explicit planned-vs-actual side-by-side) also already shipped there. Steps 4–8 (micro-wins/XP/level/badge-progress/Path-advancement) require the XP/level data model below and are **not yet built**.

## Post-Side-Mission reward flow

Result (exercises completed) → coach interpretation connecting it to running capability → XP → badge progress (two counters, e.g. "Stronger Strides: 3 of 5," "Durable Runner: 3 of 12") → explicit Main Quest connection line (e.g. "Tomorrow's easy run remains unchanged").

## Weekly / phase / season reward summaries

**Weekly**: Main Quest XP, Side Mission XP, badge XP, total, current Level, completed runs/key workouts, long-run result, speed-work result, recovery adherence, Side Missions, personal milestones, badge progress, current Race Readiness, next week's focus. Example format: "Week 4 Complete — Main Quest 540 XP, Side Missions 105 XP, Badge bonus 100 XP, Total 745 XP — What improved: ... — Next focus: ...".

**Phase**: phase badge, phase XP bonus, distance progression, pace-control development, long-run progression, key skills developed, strength/mobility support completed, current Race Readiness, next-phase preview. Example: "Base Phase Complete" → Base Builder badge + 250 XP + Build Phase unlocked on the Path.

**Season**: race badge, race XP, archive the completed Path, preserve lifetime XP + lifetime badge progress, reset only season-specific progress, generate the Season Card, show the user's development story. **Season badges** (one season, e.g. Base Builder) vs. **lifetime badges** (multi-season progress, e.g. "Easy Means Easy — Mastered") vs. **per-race badges tied to that race's details** (e.g. RACR Finisher) are three distinct categories.

## Social comparison (if ever added)

Never use lifetime XP as a global athletic ranking. If built: compare only appropriately matched users, prefer cooperative goals, allow private participation, never publicly shame low-level users, never imply higher XP = better/faster runner, never reward unsafe competitive volume. Possible safe forms: team contribution, shared mission completion, encouragement, similar-plan cohorts, distance-specific communities, season completion.

## Anti-gaming rules

No extra XP for distance beyond the prescribed range · no bonus for faster-than-target easy runs · no repeated XP from delete-and-relog · no duplicated imported activities · no unlimited XP from very short mobility sessions · no multiple rest-day XP awards on one date · no XP for toggling completion states repeatedly · no XP for viewing content, opening the app, or notification clicks · no bonus for exercising through pain · no bonus for unapproved double workouts · no XP multiplier from calories burned · Side Mission weekly cap · idempotent badge awards · valid personal-record rules only · an audit trail for XP adjustments · honest edits never automatically punished (correcting a logging mistake must never strip legitimately earned XP).

## XP event system (must be event-driven)

Events: workout completed/adapted/partially completed, minimum completed, recovery substituted, rest day completed, workout missed, user returned after a miss, Side Mission completed, weekly review completed, training phase completed, badge earned, badge tier upgraded, personal record achieved, race preparation completed, race completed, goal achieved. Each event stores: event ID, user ID, season ID, workout/mission ID, event type, base XP, modifier, bonus XP, final XP, reason, timestamp, source, idempotency key, validation status.

## Data models (reference — field lists, not a literal required schema)

`XpEvent` {id, userId, seasonId, workoutId, missionId, badgeId, eventType, baseXp, modifier, executionBonus, badgeBonus, totalXp, reason, source, idempotencyKey, validated, createdAt}

`UserXpProfile` {userId, lifetimeXp, currentLevel, currentLevelXp, nextLevelXp, currentRankTitle, lastLevelUpAt, selectedProfileTitle, selectedPathTheme, selectedBadgeFrame}

`SeasonXpSummary` {seasonId, userId, mainQuestXp, sideMissionXp, badgeXp, recoveryXp, totalXp, sideMissionWeeklyCap, startedAt, completedAt}

`Achievement` {id, userId, seasonId, achievementType, name, description, value, unit, relatedWorkoutId, earnedAt, isPersonalRecord, previousValue}

`Badge` {id, slug, name, category, description, whyItMatters, iconKey, tierModel, currentTier, maxTier, hidden, seasonSpecific, lifetime, unlockRules, progressRules, xpBonus, earned, earnedAt, nextMilestoneId}

`LevelDefinition` {level, cumulativeXpRequired, rankTitle, unlocks, milestoneLevel, displayTreatment}

`RewardSummary` {activityId, resultSummary, coachInterpretation, microWins, baseXp, bonusXp, totalXp, levelBefore, levelAfter, levelProgress, badgeProgress, badgesEarned, pathNodeAdvanced, nextAction}

## Engine requirements

Event-driven, configurable, idempotent, testable, independent from UI components, independent from training-plan generation, independent from coaching safety logic, capable of retroactive evaluation, personalized badge thresholds, tier upgrades, season-specific + lifetime progress, duplicate-XP prevention, recalculation after valid edits. **The training engine decides what is appropriate; the reward engine only recognizes appropriate execution — never the reverse, never overruling safety/coaching decisions.**

## Analytics — measure whether the reward system improves real training

Track: first workout completion, first-week completion, three-week adherence, return after a missed workout, easy-run effort adherence, long-run completion, appropriate speed-work execution, valid adaptation use, rest-day compliance, Side Mission completion, Side-Mission-interference-with-Main-Quest, badge completion/engagement, level-up frequency/retention, race-plan completion, start-line arrival, race completion, unsafe volume behavior, pain reported before stopping, user-reported pressure/guilt, user understanding of XP and of Race-Readiness-vs.-RACR-Level. **Do not evaluate success by app opens, screen time, notification clicks, badges viewed, or logging volume alone** — success means better training behavior, not more engagement.

## MVP implementation order (7 phases)

1. **Reward foundation**: XP event model, user lifetime XP profile, level definitions, Main Quest XP rules, Side Mission XP rules, completion modifiers, duplicate protection, configurable XP values.
2. **Post-workout reward**: result summary, planned-vs-actual, specific coach interpretation, micro-wins, XP calculation, level progress, badge progress, Path advancement.
3. **Badges and achievements**: accomplishment history, badge cabinet, badge progress/tiers/XP, hidden badges, Main Quest + Side Mission badges.
4. **Level system**: 50-level structure, rank titles, level-up experience, cosmetic/insight unlocks, lifetime XP persistence, multi-season progression.
5. **Weekly and phase rewards**: weekly summary, phase completion summary, phase badge/XP, capability summary, next-phase preview.
6. **Race seasons**: race-completion reward, Season Card, archived Path, season-specific badges, lifetime badge progress, multi-season history.
7. **Calibration**: test XP pacing, Side Mission cap, level speed, badge frequency, reward comprehension, anti-gaming protections, pressure/guilt, beginner-vs-advanced experience.

**Already shipped toward Phase 2, ahead of Phase 1**: the run-logging correction's Planned-vs-Actual block + `interpretRunResult` (result + coach interpretation, no XP/level/badge/Path plumbing yet) — worth noting Phase 2 can't fully complete before Phase 1's data model exists, so Phase 1 is the real next dependency despite this partial head start.

## 30-point Definition of Done

Every valid workout can produce an XP event · Main Quest awards more XP than Side Missions · Main Quest ≈70–80% of weekly XP · Side Mission repeatable XP capped · small actions get immediate feedback · ordinary actions don't clutter the badge cabinet · achievements record factual milestones · badges recognize meaningful skills/patterns/accomplishments · badges award bonus XP · long runs have meaningful reward progression · speed workouts reward control not recklessness · showing up has its own progressive recognition · strength/core/mobility have Side Mission progressions · rest and safe adaptation can receive meaningful credit · extra mileage creates no extra XP · easy-run speed creates no bonus XP · lifetime XP persists across seasons · RACR Level is separate from Race Readiness · leveling unlocks personalization/insight only · essential coaching/safety never level-gated · level-up screens explain what was built · weekly summaries explain XP sources · completed seasons generate a permanent Season Card · duplicate XP/badge awards prevented · reward calculations have automated tests · users understand what XP means · users understand what RACR Level means · users understand why Side Missions earn less · the system rewards better training, not just more training · the system stays motivating without guilt/punishment/unsafe pressure.

## Final product rule

Main Quest: "How am I becoming a better runner and moving toward my race?" Side Missions: "How am I becoming stronger and moving better so I can support that running goal?" XP: "How much valid training experience did this action contribute?" Badges: "What meaningful capability, pattern, or milestone did I achieve?" RACR Level: "How much meaningful RACR experience have I accumulated over time?" Race Readiness: "How prepared am I for my current race?" **Never merge these meanings.** Target user feeling: "I showed up. I did the right training. I am improving. I can see what I have accomplished. I know what comes next. I am becoming a runner."

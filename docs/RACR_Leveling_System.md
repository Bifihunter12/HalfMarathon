# RACR Leveling System — XP, RACR Level, Badges, PRs

Saved verbatim/condensed (2026-07-22). This completes the reward architecture the RACR Master Prompt only partially specified — it answers *why XP matters, what leveling up means, what a level unlocks,* and *how small wins feel rewarding between major milestones.* Builds on, does not replace, `RACR_Master_Prompt.md`'s existing Badges/Progress-system/Reward-hierarchy sections. **Spec only — no code changes made from this doc; see the Master Prompt's own "Next action" note for what to build first.**

## Four distinct progression systems (each answers a different question)

1. **Main Quest Path** — "How close am I to my race?" Season-specific: completed weeks, current phase, long-run progression, key workouts, race prep, race day. Resets each new season; completed season archives.
2. **XP + RACR Level** — "How much experience have I built as a runner?" Permanent, carries across seasons. Reflects running, plan adherence, appropriate effort, recovery, strength, mobility, returning after disruption, race completion.
3. **Badges** — "What specific things have I accomplished?" Named achievements (first long run, five controlled easy runs, first interval session, new distance, strength progression completed, returned after illness, race completed). Award bonus XP, but the achievement itself is the primary value.
4. **Personal Records & Milestones** — "What can I do now that I couldn't before?" (longest run, fastest mile/5K, first continuous 30-min run, best controlled tempo, most consistent intervals, heaviest technically-sound split squat, longest mobility-consistency streak). Not all become badges — some stay PRs/accomplishments; only the most meaningful graduate to permanent badges.

**Critical, repeated throughout the source spec: never combine these four.** Race Readiness (prep for *this* race) must stay separate from RACR Level (permanent identity) — a high-level user can have low current readiness after a break; a brand-new low-level user can arrive race-ready with existing fitness.

## What XP is for (three jobs) / what XP is NOT

1. Makes small actions immediately visible (the race result is weeks/months away; XP gives today's correct action immediate evidence it mattered).
2. Builds a permanent runner identity ("I am 42% through this plan" vs. "I've accumulated meaningful running experience across all my seasons").
3. Unlocks meaningful personalization (never basic safety/coaching/logging/recovery — those stay free to everyone).

XP is explicitly **not**: money, a punishment mechanism, race readiness, proof of being faster than another user, permission to train harder, or a reason to add mileage.

## Main Quest must dominate XP

Target **70–80% of weekly XP from Main Quest, 20–30% from Side Missions**. A runner who skips runs but does mobility daily must not out-level someone following the actual plan.

### Main Quest XP (base values — never increase for exceeding prescribed distance)
Easy run 100 · Recovery run 90 · Long run 175 · Tempo/threshold 150 · Interval 150 · Hill 140 · Race-pace 160 · Benchmark run 175 · Race rehearsal 200 · Prescribed cross-training 80 · Rest day followed correctly 40 · Race completed 500.

### Side Mission XP (Main Quest should normally award ~2–3x a Side Mission)
Short mobility 25 · Full mobility routine 35 · Core session 40 · Upper-body strength 50 · Running-specific strength 60 · Full strength progression workout 70 · Optional recovery routine 25 · Side Mission series completed: +100 bonus.

### Completion modifiers (depends on whether the session's *purpose* was preserved, not raw compliance)
Completed as prescribed / within acceptable range: 100%. Coach-approved adaptation that met the purpose: 85–100%. Partial with legitimate reason: 40–75%. Hard-day minimum: 35–50%. Prescribed recovery substitution: 60–100%. Unapproved extra mileage: 0 bonus. Exercising through a pain warning: no bonus. Missed: 0. Returned at next valid opportunity: recovery bonus.

Examples from the spec: an easy run swapped for 45 min easy cycling due to impact discomfort → ~85%. A long run cut from 10mi to 9.5mi because the runner correctly stopped at an emerging pain signal → still near-full XP, possibly the *Body Listener* badge. Running 13mi instead of the prescribed 10 → **not** 30% more XP.

## Small-win reward hierarchy (so XP isn't the only reinforcement)

- **Micro-wins** (shown, not permanently collected as badges): "You showed up," "Easy effort held," "Warm-up completed," "Cooldown completed," "Fueling practiced," "First run of the week," "Returned after a missed day," "Chose the safer adaptation," "Stopped at the right time," "Completed the final interval," "Rested before tomorrow's key workout." Each gives XP + immediate feedback + a small animation + progress toward a larger badge, without cluttering the badge cabinet.
- **Accomplishments** (displayed in history, more meaningful): first 20-min run, first 30-min run, first 5K distance, longest run, first complete training week, first tempo/interval workout, four consecutive consistent weeks, first strength progression completed.
- **Badges** — permanent evidence of a meaningful pattern/milestone.
- **Phase achievements** — major Main Quest transitions.
- **Race artifact** — the season's final reward.

### "Showed Up" progressive identity badge (pace-blind, planned-running-only — never farmed via random mileage)
First Step (any valid scheduled run) → Showing Up (5 runs) → Building the Pattern (15 runs) → Runner by Action (30 runs). Hard-day-minimum version: partial Main Quest XP + "showed up" progress + possible *Hard-Day Win* — never falsely claims the full workout was completed.

### Long-run rewards (multiple dimensions, not just distance)
First Long Run · Long-Run Confidence (3 prescribed long runs) · Distance Unlocked (new planned long-run distance, plan-relevant milestones only: 5mi/10K/8mi/10mi/half/15mi/18mi/20mi) · Time on Feet (60/90/120/150 min) · Long-Run Discipline (multiple long runs at intended easy effort — prevents rewarding distance while ignoring pacing) · Strong Finish (only for an explicitly prescribed progression long run executed correctly, never for racing the end of an ordinary easy long run).

### Fast-run rewards (only when speed was the workout's actual purpose — never "fastest easy run")
Speed Session (first interval/hill session) · Controlled Speed (prescribed reps without large pacing collapse) · Precision (eligible reps within a defined consistency range) · Threshold Builder (3 threshold sessions at intended effort) · Tempo Progress (faster at comparable duration/effort across multiple qualifying sessions) · Race-Pace Ready (key race-pace session inside prescribed range) · New Personal Best (only via eligible benchmark/race/verified effort). Considers workout type, target vs. actual pace, RPE, rep consistency, conditions, and safety — a runner who blows up after an over-fast first interval should score lower on mastery than one who executes consistently.

### Side Mission paths (subordinate visually/numerically, but with real progression)
**Strength**: Strength Foundation → Stronger Strides → Single-Leg Strength → Posterior-Chain Builder → Calf Capacity → Durable Runner. Rewards sessions/technical progression/weight/reps/harder variation/phase-consistency — never careless volume.
**Core**: Brace → Anti-Extension → Anti-Rotation → Carry Strong → Core Engine.
**Mobility**: Mobility Started → Post-Run Reset → Ankles Unlocked → Hips in Motion → Move Better. Rewards consistency/progression — never claims to objectively measure "flexibility" absent a real assessment.

### Badge XP bonus table
Small milestone 50 · Standard behavior 100 · Mastery 175 · Side Mission progression 100 · Main Quest phase 250 · Major distance 200 · Comeback/recovery 150 · Race Ready 300 · RACR Finisher 500 · Goal time achieved: +250 additional. Badge XP must not dominate the economy — months of training should collectively outweigh the one race-day award.

## Weekly Side Mission XP cap

Side Mission XP capped at **30% of that week's available Main Quest XP**. User may still do extra strength/mobility when safe, it just doesn't accelerate leveling — prevents farming 5-minute mobility sessions, excessive strength volume, or treating Side Missions as the "real game." No cap on meaningful accomplishment records — only repeatable XP is controlled.

## RACR Level (permanent, cross-season)

Represents training experience, consistency, running mastery, recovery intelligence, supporting strength/mobility, completed race journeys. **Does not mean**: faster than others, ready for a marathon, medically fit, or advanced enough for any workout. A Level 25 recreational runner may be slower than a Level 3 former collegiate runner.

### 50-level structure with periodic titles
1–4 In Motion (began acting) · 5–9 Building (consistency/capacity developing) · 10–14 Grounded (repeatable training system built) · 15–19 Enduring (long-run capacity/resilience developing) · 20–24 Advancing (broader running mastery) · 25–29 Racecraft (pacing/prep/execution improving) · 30–39 Seasoned (substantial training experience) · 40–49 Proven (durable training behavior demonstrated) · 50 RACR (top long-term identity milestone). Avoid ranks like "Elite" absent actual elite performance — the level is behavioral, not a physiological classification.

### Pacing (fast early reinforcement, slower long-term, no post-one-season inflation)
Level 2 ≈ after ~2 workouts · Level 3 ≈ first training week · Level 5 ≈ weeks 2–3 · Level 10 ≈ after a meaningful training block · Level 20 ≈ after 1+ full seasons · Level 50 ≈ long-term multi-season achievement.

Example cumulative XP (needs testing against real plan XP before implementation — not final):
L1: 0 · L2: 200 · L3: 500 · L4: 850 · L5: 1,250 · L10: 4,500 · L15: 9,000 · L20: 15,000 · L30: 31,000 · L40: 52,000 · L50: 80,000.

### What leveling up unlocks
**Early levels**: profile title, first badge frame, additional Path accent, preferred celebration style, choose a Side Mission focus.
**Middle levels**: more Side Mission variations, advanced history views, custom Season Card formats, additional path environments, custom milestone display, advanced benchmark comparisons, additional profile titles.
**Higher levels**: multi-season trophy cabinet, legacy badge frames, advanced Path themes, lifetime running timeline, custom RACR crest, season comparison, personalized "year in running," optional advanced challenges.

**Never level-gated** (available to every user regardless of level): manual run logging, pace calculation, injury modification, recovery options, training-plan explanations, essential progress data, basic strength/mobility, safety warnings, ability to reschedule, core coaching.

### Level-up experience (not a giant generic celebration every time)
Format: **"LEVEL 10 — GROUNDED"** + one sentence of meaning ("You've built enough experience to make training a pattern rather than a one-time effort") + a small stats recap (total Main Quest workouts, longest run, current consistency, key badges earned) + explicit unlock lines ("Path theme unlocked: Ridgeline" / "New title unlocked: Base Builder" / "Season comparison available").

## Reward sequence after every run (6 steps)
1. Result (e.g. "4.62 miles · 50:15 · 10:53/mi")
2. Coaching meaning (e.g. "You completed the intended aerobic work and kept the effort controlled")
3. XP (e.g. "+100 Main Quest XP")
4. Level progress (e.g. "Level 7: 620 / 850 XP")
5. Achievement progress (e.g. "Easy Means Easy: 4 of 5 runs")
6. Path movement (completed node resolves, next node becomes visible)

**Already partially shipped**: steps 1–2 (result + deterministic coaching interpretation) shipped 2026-07-22 as the run-logging correction's `interpretRunResult`/Planned-vs-Actual block (see [[project_halfmarathon]]). Steps 3–6 (XP/level/badge-progress/Path-movement) are **not yet built** — no XP/level data model exists in `app.js` yet.

## Reward sequence after a Side Mission
Result summary (e.g. exercises completed) → Side Mission XP → progression counters (e.g. "Stronger Strides: 3 of 5", "Durable Runner: 3 of 12") → an explicit sentence connecting it back to the Main Quest (e.g. "This session supports lower-body strength and running durability. Tomorrow's easy run remains unchanged.").

## Anti-gaming rules
No extra XP for mileage beyond the prescribed range · no repeat XP from delete-and-relog · no unlimited XP from very short mobility sessions · no multiple rest-day rewards same date · no repeated manual logging of the same workout · Side Mission weekly XP cap (above) · badge awards idempotent · PRs require eligible activities only · easy-run speed never generates a speed bonus · pain tolerance never generates XP · unplanned double workouts get no bonus · imported activities checked for duplicates · honest-mistake edits never lose legitimate rewards already earned.

## Completed reward architecture (target state)
Every workout: feedback + XP + level progress + badge progress + Path advancement. Every week: recap (Main Quest XP, Side Mission XP, long-run progress, speed-work progress, consistency, recovery behavior, next milestone). Every phase: phase badge + bonus XP + capability summary + new Path chapter. Every level: identity milestone + personalization unlock + long-term progress. Every season: race artifact + archived Path + season badges + permanent lifetime XP + reflection/next-journey prompt.

## Priorities called out by the spec itself
1. Separate Path progress / XP level / badges / race readiness so each has one clear purpose.
2. Make Main Quest workouts ~70–80% of weekly XP.
3. Define meaningful level unlocks *before* ever displaying a level number to the user.
- **"Start today"** (the spec's own suggested first build step): the post-run reward sequence, result → coaching meaning → XP → badge progress → Path advancement. Steps 1–2 of this already shipped via the run-logging correction; XP/level/badge/Path plumbing is the real remaining gap.
- **"Stop doing"**: awarding points without showing what they represent or unlock.

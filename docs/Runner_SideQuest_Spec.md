# RACR Side Quests — Adaptive Substitution System

> Build it as a **Side Quest system inside the running plan**, not as a separate library of random workouts.

**Core promise:** "Still train for your race, but temporarily shift the experience when running feels stale."

## 1. "Not Feeling This Run?" button

On every scheduled running workout, include: **Not feeling this run?**

When tapped, asks one quick question: **Why do you want to change today's workout?**

- I'm mentally tired of running
- My legs feel physically tired
- I'm short on time
- I want to hike instead
- I want to strength train
- I have pain or discomfort
- I just want something different

The answer determines what the coach is allowed to offer.

**Example** — Scheduled: *Easy Run — 40 minutes*. User picks *Mentally tired of running*. Coach: "Let's protect your training without forcing another run. Choose today's side quest." Options: 75-minute trail hike / 35-minute incline walk / Upper Body Builder / Kettlebell 100 / Core Armor / Keep the run, but change the route.

This gives the user autonomy while the coach still controls training load.

## 2. Three challenge types

**A. Daily Side Quests** — completed in one workout. E.g. 100 Kettlebell Swings, 100 Squats, Push-Up Ladder, 20 Minutes of Core, 5K Row, 1,000 Vertical Feet, 60-Minute Hike, Farmer Carry Challenge, Stair Climb, Mobility Reset. Can replace an easy run or be added to a rest day when appropriate.

**B. Weekly Challenges** — completed across seven days. E.g. 300 kettlebell swings, 200 push-ups, 500 squats, 60 minutes of core, 3 strength workouts, 3,000 feet of elevation, 4 hours of hiking, 7-day mobility streak, 100 minutes of upper-body strength. Creates repeated wins without one huge workout.

**C. Multiweek Quest Tracks** — run alongside the race plan. E.g. Upper Body Builder (4wk), Core Armor (4wk), Kettlebell Engine (4wk), Trail Explorer (4wk), Push-Up Progression (6wk), Strong Runner (8wk), Hiking Endurance (6wk). Onboarding asks: "What else would you like to accomplish during this race journey?" — the race is the primary goal, the quest is the secondary/emotional goal.

## 3. Challenge object schema

```json
{
  "id": "kb_swing_100",
  "name": "Kettlebell 100",
  "category": "strength",
  "duration_type": "single_session",
  "description": "Complete 100 controlled kettlebell swings.",
  "completion_metric": "repetitions",
  "target": 100,
  "estimated_minutes": 15,
  "training_load": 2,
  "impact_level": "low",
  "muscle_groups": ["glutes", "hamstrings", "core", "back"],
  "equipment": ["kettlebell"],
  "skill_level": "intermediate",
  "can_replace": ["easy_run", "recovery_run"],
  "cannot_replace": ["long_run", "race_specific_workout"],
  "avoid_when": ["lower_back_pain", "hamstring_pain", "poor_swing_technique", "high_fatigue"],
  "progression_options": [100, 150, 200, 300],
  "reward_points": 100
}
```

Every challenge needs: training category, time requirement, equipment, difficulty, impact level, training load, muscle groups, injury/symptom exclusions, workout types it may replace, progression level, completion metric, reward value. This lets the app *filter* a catalog instead of asking the AI to invent challenges from scratch.

## 4. Replaceability score per scheduled workout

- **Easily replaceable:** recovery run, short easy run, optional cross-training, general aerobic run
- **Sometimes replaceable:** medium easy run, hill workout, steady run
- **Protected:** long run, race-pace session, threshold workout, critical interval session, race simulation

```json
{ "workout_type": "easy_run", "priority": 2, "replaceable": true,
  "acceptable_substitutions": ["hike", "incline_walk", "cycling", "rowing", "strength_upper_body"] }
```
```json
{ "workout_type": "threshold_intervals", "priority": 5, "replaceable": false, "movable": true }
```

Coach: "Today's workout is important, but you don't have to do it today. We can move it to Thursday and give you a trail hike today." Smarter than deleting it.

## 5. Substitution matrix (hard-coded, before AI)

| Planned workout | Good substitute | Partial substitute | Poor substitute |
|---|---|---|---|
| Recovery run | Walk, mobility, easy cycle | Upper-body strength | Hard leg workout |
| Easy run | Hike, incline walk, easy cycling | Full-body strength | HIIT |
| Long run | Long hike occasionally | Long bike ride | 100 squats |
| Intervals | Row/bike intervals | Hill hike | Mobility |
| Rest day | Mobility, easy walk | Upper-body strength | Hard intervals |
| Strength day | Similar strength session | Calisthenics | Long hard run |

The AI chooses from approved substitutions only — it never invents arbitrary swaps.

## 6. "Running Fatigue" state

Track: skipped runs, replaced runs, enjoyment score, motivation score, physical fatigue, soreness, sleep, pain, training completion, chat statements like "I'm tired of running."

Weekly check-in: **How are you feeling about running this week?** Excited / Fine / Neutral / Getting bored / Dreading it / Physically exhausted / In pain.

Two consecutive "getting bored"/"dreading it" answers activate a **Variety Week**: one important running workout, one short easy run, one long hike, two strength sessions, one optional cross-training challenge, one full recovery day. Then automatically ramps back to normal volume.

## 7. Training Focus Weeks

Label weeks instead of making every week identical: Race Builder Week, Strength Quest Week, Trail Week, Recovery and Reset Week, Speed Week, Adventure Week. Makes a 12-week plan feel like chapters, not repetition. (See original spec for a full 12-week example table.)

## 8. Onboarding: journey style

"What should your race journey include besides running?" — Just the running plan / Strength and muscle building / Hiking and outdoor adventures / Core strength / Kettlebells / General fitness variety / Surprise me when I get bored. Plan generator attaches suitable quest tracks from the start.

## 9. Challenge card design

Shows: name, description, estimated time, difficulty, training effect, what it replaces, what it does *not* replace, suggested format, rest guidance, reward (XP). Buttons: Start challenge / Replace today's workout / Add without replacing / Save for later / Show alternative. User should always understand what happens to the original run.

## 10. Challenge progression

Levels 1–5 per quest track (e.g. Kettlebell Engine: 100 → 150 → 200 → 10-min density → heavier bell). Same pattern for Core Armor, Trail Explorer, etc. Creates completion, leveling, identity.

## 11. Separate boredom from fatigue from pain

Ask: "Is this mental boredom, physical fatigue, or pain?"

- **Mental boredom** → hike, new route, strength quest, cross-training, shortened fun run, social challenge
- **Physical fatigue** → walking, easy cycling, mobility, rest, reduced workout, deload. Never: 500 squats, hard kettlebell challenge, HIIT, long weighted hike.
- **Pain** → ask location, severity 0–10, gait change, sharp/worsening/at-rest — then conservative rules. Never frame an injury substitution as a "challenge" when rest or medical evaluation is appropriate.

## 12. AI coach decision flow (deterministic first, AI language second)

```
1. Read scheduled workout.
2. Read race distance and weeks remaining.
3. Read workout priority.
4. Read user fatigue, soreness, pain, sleep, motivation.
5. Identify why the user wants a change.
6. Determine whether the workout can be replaced / moved / shortened / must remain protected.
7. Filter challenge catalog: equipment, training load, injury conflicts, interests, time.
8. Offer 2–4 valid options.
9. Explain the tradeoff.
10. Update the remainder of the week.
```

Never: "Sure, do 100 squats instead." Always: "We can replace today's easy run with the Upper Body Builder challenge because your long run and threshold session are still protected this week. I wouldn't add a high-volume squat challenge today because your interval workout is tomorrow."

## 13. Coach system-prompt addition

```
When a user expresses boredom, loss of motivation, or fatigue with running,
do not automatically tell them to push through or abandon the plan.
First determine whether the issue is:
1. Mental boredom  2. General physical fatigue  3. Local muscle soreness
4. Pain or possible injury  5. Time constraints  6. Preference for another activity

For mental boredom, preserve the minimum race-specific training needed that
week and offer approved substitutions such as hiking, incline walking,
cycling, rowing, strength training, mobility, or a structured side quest.
Prefer replacing low-priority easy or recovery runs. Protect long runs,
race-pace workouts, threshold sessions, and key intervals unless moving or
reducing them is justified.

Do not stack every replacement on top of the existing plan. Maintain an
appropriate weekly training load.

When offering a challenge:
- State whether it replaces, moves, or supplements the scheduled workout.
- Explain the training purpose.
- Give a clear completion target.
- Adjust the remainder of the week.
- Avoid high-volume lower-body challenges near hard runs or long runs.
- Do not prescribe challenging exercise when pain, illness, or excessive
  fatigue indicates recovery or medical evaluation.
```

## 14. Challenge recommendation scoring

```
Challenge Score = interest match + equipment match + time match + training-goal match
                + novelty score + completion likelihood
                - injury conflict - muscle overlap penalty
                - weekly load penalty - proximity-to-race penalty
```

## 15. Weekly load protection

Load scores: mobility 1, easy walk 1, upper-body strength 2, easy run 2, Kettlebell 100 2–3, moderate hike 3, hard strength 4, intervals 5, long run 5. If replacing a load-2 easy run with a load-5 challenge would blow the week's total, the coach reduces something else, picks a lighter challenge, warns the user, or moves the challenge instead.

## 16. Gamification

XP, levels, badges, quest chains, personal records, completion streaks, unlockable advanced challenges. Example badges: Swing Initiate, Iron Engine, Trailbreaker, Core Armor, Upper Body Builder, Running Rebel (complete a Variety Week while keeping all key race sessions), Still on Track (replace three workouts without losing plan consistency). A valid replacement counts as plan completion — never punish a substitution.

## 17. Dashboard changes

Show runs completed, key sessions completed, hiking time, strength sessions, side quests completed, elevation, core minutes, weekly consistency, race readiness, enjoyment trend — not just mileage. E.g. "You completed both key runs, one long hike, and two strength sessions. Your race preparation remains on track." instead of "You completed only 63% of your runs."

## 18. MVP phasing

**Phase 1:** "Not feeling this run?" button, six replacement reasons, 15 side quests, fixed substitution rules, replace/move/shorten options, quest completion tracking, XP + one badge per category.

Starter 15: 60-min hike, 90-min hike, incline walk, Upper Body Builder, Core 10, Core 20, Kettlebell 100, Push-Up Ladder, Squat Century, 5K row, easy cycle, mobility reset, farmer carry, stair climb, new-route run.

**Phase 2:** weekly challenges, 4–8 week quest tracks, running-boredom detection, Variety Week, personalized recommendations, automatic weekly plan adjustment.

**Phase 3:** adaptive challenge difficulty, wearable data, recovery scoring, user-created challenges, community challenges, seasonal quests.

## Terminology

- **Side Quests** — single challenges
- **Quest Track** — 4–8 week secondary goals
- **Switch It Up** — the button on today's workout ("Not excited about today's run? Switch it up without abandoning your race goal.")
- **Variety Week** — temporary reduction in running monotony

## Brutally honest take

This can become one of the app's strongest differentiators, but only if it actually adjusts the plan. A pile of "100 squats" cards is easy to copy and will feel gimmicky. The valuable part is knowing which workout can be replaced, knowing what can safely replace it, protecting race readiness, updating the rest of the week, and giving the user a new accomplishment. That's the difference between a fitness-challenge app and an intelligent coach.

**Top 3 priorities:** (1) the workout substitution matrix, (2) the first 15 structured side quests, (3) the "Switch It Up" flow on every daily workout.

**Start today:** define every existing workout as protected / movable / replaceable / optional.

**Stop doing:** letting AI invent substitutions without deterministic training rules.

**Metric to track:** percentage of substituted workouts that still preserve the week's key sessions.

**Next action:** build the Side Quest data object and implement one complete flow — easy run → mental boredom → choose hike or upper-body challenge → update the weekly plan.

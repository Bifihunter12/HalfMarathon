(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RACRSideQuests = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MOVEMENT_VARIANTS = {
    squat: { foundation: 'Chair squat', base: 'Bodyweight squat', strong: 'Goblet squat', advanced: 'Weighted squat' },
    push: { foundation: 'Wall push-up', base: 'Counter push-up', strong: 'Bench or floor push-up', advanced: 'Weighted or decline push-up' },
    pull: { foundation: 'Band row', base: 'Supported dumbbell row', strong: 'One-arm row', advanced: 'Renegade row or pull-up progression' },
    hinge: { foundation: 'Supported hip hinge', base: 'Dumbbell deadlift', strong: 'Romanian deadlift', advanced: 'Kettlebell swing' },
    single_leg: { foundation: 'Supported split squat', base: 'Reverse lunge', strong: 'Weighted split squat', advanced: 'Bulgarian split squat' },
    core: { foundation: 'Dead bug', base: 'Bird dog', strong: 'Side plank', advanced: 'Loaded carry or anti-rotation press' }
  };

  var MISSION_CATALOG = [
    {
      id: 'strong_runner_20', name: 'Strong Runner 20', slug: 'strong-runner-20', category: 'strength', subcategory: 'runner_strength',
      missionType: 'single_session', description: 'Full-body durability work for stronger, more resilient running.',
      trainingPurpose: ['runner_strength', 'durability', 'general_strength'], durationMinutesMin: 20, durationMinutesMax: 25,
      difficultyLevels: ['foundation', 'base', 'strong'], equipmentOptions: ['bodyweight', 'chair_or_bench', 'resistance_bands', 'dumbbells', 'kettlebells', 'gym_access'],
      impactLevel: 'low', trainingLoad: 3, lowerBodyFatigue: 3, upperBodyFatigue: 2, coreFatigue: 2, runningInterference: 'moderate',
      relationshipLabel: 'Supports your Main Quest', completionMetric: 'workout_complete', targetValue: 1,
      canReplaceWorkoutTypes: [], canComplementWorkoutTypes: ['easy', 'recovery', 'rest'], avoidBeforeWorkoutTypes: ['quality', 'long'],
      avoidWhen: ['severe_fatigue', 'relevant_pain', 'acute_illness'], requiresExperience: false, requiresCoachWarning: false, xpReward: 120,
      badgeId: null, progression: 'Add reps first, then resistance or one extra set.', logicalNextStep: 'Strong Runner track',
      warmup: ['Easy walk or march 2 minutes', 'Hip hinges x 8', 'Bodyweight squats x 8'],
      exercises: [
        { pattern: 'squat', sets: 3, reps: '8-12', restSeconds: 45, rpe: '6-7', cues: 'Smooth depth, whole foot grounded.' },
        { pattern: 'hinge', sets: 3, reps: '8-12', restSeconds: 45, rpe: '6-7', cues: 'Hips back, long spine.' },
        { pattern: 'push', sets: 3, reps: '6-12', restSeconds: 45, rpe: '6-7', cues: 'Stop before form breaks.' },
        { pattern: 'pull', sets: 3, reps: '8-12 per side', restSeconds: 45, rpe: '6-7', cues: 'Pull shoulder blade toward back pocket.' },
        { fixed: 'Calf raise', sets: 3, reps: '15-20', restSeconds: 30, rpe: '6', cues: 'Control the lower.' },
        { pattern: 'core', sets: 3, reps: '8 per side', restSeconds: 30, rpe: '5-6', cues: 'Slow, quiet trunk.' }
      ]
    },
    {
      id: 'upper_body_20', name: 'Upper Body 20', slug: 'upper-body-20', category: 'strength', subcategory: 'upper_body',
      missionType: 'single_session', description: 'Build upper-body strength with minimal interference to running.',
      trainingPurpose: ['upper_body_strength', 'posture', 'general_strength'], durationMinutesMin: 20, durationMinutesMax: 25,
      difficultyLevels: ['foundation', 'base', 'strong', 'advanced'], equipmentOptions: ['bodyweight', 'resistance_bands', 'dumbbells', 'kettlebells', 'cable_machine', 'trx', 'gym_access'],
      impactLevel: 'low', trainingLoad: 2, lowerBodyFatigue: 1, upperBodyFatigue: 3, coreFatigue: 2, runningInterference: 'low',
      relationshipLabel: 'Supports your Main Quest', completionMetric: 'workout_complete', targetValue: 1,
      canReplaceWorkoutTypes: [], canComplementWorkoutTypes: ['easy', 'recovery', 'rest'], avoidBeforeWorkoutTypes: [],
      avoidWhen: ['severe_fatigue', 'relevant_pain', 'acute_illness'], requiresExperience: false, requiresCoachWarning: false, xpReward: 100,
      badgeId: null, progression: 'Improve reps or resistance on one push and one pull movement.', logicalNextStep: 'Upper Body Builder',
      warmup: ['Shoulder circles x 10 each way', 'Band pull-aparts or scap squeezes x 12'],
      exercises: [
        { pattern: 'push', sets: 3, reps: '6-12', restSeconds: 45, rpe: '6-7', cues: 'Quality reps, stop before technical failure.' },
        { pattern: 'pull', sets: 3, reps: '8-12', restSeconds: 45, rpe: '6-7', cues: 'Pause briefly at the top.' },
        { fixed: 'Overhead press', sets: 3, reps: '8-12', restSeconds: 45, rpe: '6-7', cues: 'Ribs down, controlled path.' },
        { fixed: 'Pullover or pulldown', sets: 3, reps: '8-12', restSeconds: 45, rpe: '6-7', cues: 'No low-back arching.' },
        { fixed: 'Biceps curl', sets: 2, reps: '10-15', restSeconds: 30, rpe: '6', cues: 'Steady tempo.' },
        { fixed: 'Triceps exercise', sets: 2, reps: '10-15', restSeconds: 30, rpe: '6', cues: 'Elbows comfortable.' },
        { fixed: 'Suitcase carry', sets: 2, reps: '30-45 sec per side', restSeconds: 30, rpe: '6', cues: 'Walk tall, no leaning.' }
      ]
    },
    {
      id: 'core_10', name: 'Core 10', slug: 'core-10', category: 'core', subcategory: 'core_stability',
      missionType: 'single_session', description: 'Ten minutes of controlled trunk work that supports running form.',
      trainingPurpose: ['core_stability', 'running_form', 'recovery'], durationMinutesMin: 10, durationMinutesMax: 10,
      difficultyLevels: ['foundation', 'base', 'strong'], equipmentOptions: ['bodyweight', 'resistance_bands', 'cable_machine'],
      impactLevel: 'low', trainingLoad: 1, lowerBodyFatigue: 1, upperBodyFatigue: 1, coreFatigue: 2, runningInterference: 'low',
      relationshipLabel: 'Complements today\'s Main Mission', completionMetric: 'minutes', targetValue: 10,
      canReplaceWorkoutTypes: [], canComplementWorkoutTypes: ['easy', 'quality', 'long', 'recovery', 'rest'], avoidBeforeWorkoutTypes: [],
      avoidWhen: ['sharp_pain', 'acute_illness'], requiresExperience: false, requiresCoachWarning: false, xpReward: 60,
      badgeId: null, progression: 'Add control or one extra round before adding harder variations.', logicalNextStep: 'Core Armor',
      warmup: ['Easy breathing x 5 breaths', 'Cat-cow x 6'],
      exercises: [
        { pattern: 'core', fixed: 'Dead bug', sets: 2, reps: '8 per side', restSeconds: 20, rpe: '5', cues: 'Low back quiet.' },
        { fixed: 'Side plank', sets: 2, reps: '20-30 sec per side', restSeconds: 20, rpe: '5-6', cues: 'Straight line, no sagging.' },
        { fixed: 'Bird dog', sets: 2, reps: '8 per side', restSeconds: 20, rpe: '5', cues: 'Move slowly.' },
        { fixed: 'Glute bridge march', sets: 2, reps: '10 per side', restSeconds: 20, rpe: '5', cues: 'Keep hips level.' },
        { fixed: 'Pallof press or no-equipment anti-rotation hold', sets: 2, reps: '10 per side', restSeconds: 20, rpe: '5-6', cues: 'Resist twisting.' }
      ]
    },
    {
      id: 'trail_90', name: 'Trail 90', slug: 'trail-90', category: 'hike', subcategory: 'adventure',
      missionType: 'single_session', description: 'Ninety minutes of easy-to-moderate hiking for aerobic variety.',
      trainingPurpose: ['aerobic_base', 'variety', 'trail_confidence'], durationMinutesMin: 90, durationMinutesMax: 90,
      difficultyLevels: ['foundation', 'base', 'strong'], equipmentOptions: ['no_equipment', 'treadmill', 'gym_access'],
      impactLevel: 'moderate', trainingLoad: 3, lowerBodyFatigue: 2, upperBodyFatigue: 0, coreFatigue: 1, runningInterference: 'moderate',
      relationshipLabel: 'Can replace an easy Main Mission', completionMetric: 'minutes', targetValue: 90,
      canReplaceWorkoutTypes: ['easy', 'cross'], canComplementWorkoutTypes: ['rest'], avoidBeforeWorkoutTypes: ['long', 'quality'],
      avoidWhen: ['severe_fatigue', 'sharp_pain', 'acute_illness'], requiresExperience: false, requiresCoachWarning: false, xpReward: 150,
      badgeId: 'trailbreaker', progression: 'Add elevation or new terrain later, not speed today.', logicalNextStep: 'Trail Explorer',
      warmup: ['Start with 10 easy minutes before climbing.'],
      exercises: [{ fixed: 'Hike or outdoor walk', sets: 1, reps: '90 minutes', restSeconds: 0, rpe: '3-5', cues: 'Conversational effort.' }]
    },
    {
      id: 'carry_10', name: 'Carry 10', slug: 'carry-10', category: 'strength', subcategory: 'carry',
      missionType: 'single_session', description: 'Accumulate ten minutes of loaded carries for grip, trunk, and posture.',
      trainingPurpose: ['core_stability', 'posture', 'general_strength'], durationMinutesMin: 10, durationMinutesMax: 15,
      difficultyLevels: ['foundation', 'base', 'strong', 'advanced'], equipmentOptions: ['dumbbells', 'kettlebells', 'backpack', 'gym_access'],
      impactLevel: 'low', trainingLoad: 2, lowerBodyFatigue: 1, upperBodyFatigue: 2, coreFatigue: 3, runningInterference: 'low',
      relationshipLabel: 'Best completed on a rest or easy day', completionMetric: 'carry_minutes', targetValue: 10,
      canReplaceWorkoutTypes: [], canComplementWorkoutTypes: ['easy', 'recovery', 'rest'], avoidBeforeWorkoutTypes: [],
      avoidWhen: ['severe_fatigue', 'back_pain', 'shoulder_pain', 'wrist_pain', 'acute_illness'], requiresExperience: false, requiresCoachWarning: false, xpReward: 90,
      badgeId: 'carry_strong', progression: 'Add total carry time before adding load.', logicalNextStep: 'Upper Body 20',
      warmup: ['Unloaded walk 2 minutes', 'Light carry 30 seconds each side'],
      exercises: [{ fixed: 'Farmer, suitcase, front-rack, or backpack carry', sets: 'as needed', reps: '10 total carry minutes', restSeconds: 30, rpe: '6-7', cues: 'Tall posture, controlled steps.' }]
    },
    {
      id: 'single_leg_stability', name: 'Single-Leg Stability', slug: 'single-leg-stability', category: 'strength', subcategory: 'single_leg',
      missionType: 'single_session', description: 'A short progression of single-leg balance and control work.',
      trainingPurpose: ['single_leg_strength', 'balance', 'injury_resistance'], durationMinutesMin: 10, durationMinutesMax: 15,
      difficultyLevels: ['foundation', 'base', 'strong', 'advanced'], equipmentOptions: ['bodyweight', 'dumbbells', 'kettlebells'],
      impactLevel: 'low', trainingLoad: 2, lowerBodyFatigue: 2, upperBodyFatigue: 0, coreFatigue: 1, runningInterference: 'low',
      relationshipLabel: 'Supports your Main Quest', completionMetric: 'workout_complete', targetValue: 1,
      canReplaceWorkoutTypes: [], canComplementWorkoutTypes: ['easy', 'recovery', 'rest'], avoidBeforeWorkoutTypes: [],
      avoidWhen: ['severe_fatigue', 'relevant_pain', 'acute_illness'], requiresExperience: false, requiresCoachWarning: false, xpReward: 70,
      badgeId: 'single_leg_strong', progression: 'Advance one level at a time: stand, then head turns, then reach, then a supported single-leg deadlift, then loaded.', logicalNextStep: 'Single-Leg Strength',
      warmup: ['Ankle circles x 10 each way', 'Easy marching in place 30 seconds'],
      exercises: [
        { fixed: 'Single-leg stand', sets: 2, reps: '20-30 sec per side', restSeconds: 20, rpe: '4-5', cues: 'Soft knee, steady gaze.' },
        { fixed: 'Single-leg stand with head turns', sets: 2, reps: '15-20 sec per side', restSeconds: 20, rpe: '5', cues: 'Keep hips level while turning.' },
        { fixed: 'Single-leg reach', sets: 2, reps: '6-8 per side', restSeconds: 20, rpe: '5-6', cues: 'Control the return, no wobble.' },
        { fixed: 'Supported single-leg deadlift', sets: 2, reps: '8 per side', restSeconds: 30, rpe: '5-6', cues: 'Long spine, hips square.' }
      ]
    },
    {
      id: 'core_control', name: 'Core Control', slug: 'core-control', category: 'core', subcategory: 'core_stability',
      missionType: 'single_session', description: 'A short combined core circuit that supports running posture and stability.',
      trainingPurpose: ['core_stability', 'running_form'], durationMinutesMin: 10, durationMinutesMax: 15,
      difficultyLevels: ['foundation', 'base', 'strong'], equipmentOptions: ['bodyweight', 'resistance_bands'],
      impactLevel: 'low', trainingLoad: 2, lowerBodyFatigue: 1, upperBodyFatigue: 1, coreFatigue: 3, runningInterference: 'low',
      relationshipLabel: 'Complements today\'s Main Mission', completionMetric: 'workout_complete', targetValue: 1,
      canReplaceWorkoutTypes: [], canComplementWorkoutTypes: ['easy', 'quality', 'long', 'recovery', 'rest'], avoidBeforeWorkoutTypes: [],
      avoidWhen: ['sharp_pain', 'acute_illness'], requiresExperience: false, requiresCoachWarning: false, xpReward: 65,
      badgeId: null, progression: 'Add a round or hold each position slightly longer before adding harder variations.', logicalNextStep: 'Core 10',
      warmup: ['Easy breathing x 5 breaths', 'Cat-cow x 6'],
      exercises: [
        { pattern: 'core', fixed: 'Dead bug', sets: 3, reps: '8 per side', restSeconds: 20, rpe: '5', cues: 'Low back quiet.' },
        { fixed: 'Bird dog', sets: 3, reps: '8 per side', restSeconds: 20, rpe: '5', cues: 'Move slowly.' },
        { fixed: 'Side plank', sets: 3, reps: '20 sec per side', restSeconds: 20, rpe: '5-6', cues: 'Straight line, no sagging.' },
        { fixed: 'Glute bridge', sets: 3, reps: '12', restSeconds: 20, rpe: '5', cues: 'Keep hips level.' }
      ]
    },
    {
      id: 'upper_body_armor', name: 'Upper-Body Armor', slug: 'upper-body-armor', category: 'strength', subcategory: 'upper_body',
      missionType: 'single_session', description: 'A bodyweight-first upper-body circuit for posture and pull-side strength.',
      trainingPurpose: ['upper_body_strength', 'posture', 'general_strength'], durationMinutesMin: 15, durationMinutesMax: 20,
      difficultyLevels: ['foundation', 'base', 'strong', 'advanced'], equipmentOptions: ['bodyweight', 'resistance_bands', 'dumbbells', 'kettlebells', 'cable_machine'],
      impactLevel: 'low', trainingLoad: 2, lowerBodyFatigue: 0, upperBodyFatigue: 3, coreFatigue: 2, runningInterference: 'low',
      relationshipLabel: 'Supports your Main Quest', completionMetric: 'workout_complete', targetValue: 1,
      canReplaceWorkoutTypes: [], canComplementWorkoutTypes: ['easy', 'recovery', 'rest'], avoidBeforeWorkoutTypes: [],
      avoidWhen: ['severe_fatigue', 'shoulder_pain', 'wrist_pain', 'acute_illness'], requiresExperience: false, requiresCoachWarning: false, xpReward: 70,
      badgeId: null, progression: 'Add reps first, then an equipment version of the same movement.', logicalNextStep: 'Upper Body 20',
      warmup: ['Shoulder circles x 10 each way', 'Band pull-aparts or scap squeezes x 12'],
      exercises: [
        { pattern: 'push', sets: 3, reps: '6-15', restSeconds: 40, rpe: '6-7', cues: 'Quality reps, stop before technical failure.' },
        { fixed: 'Prone Y-T-W raises', sets: 2, reps: '8 per position', restSeconds: 30, rpe: '5', cues: 'Small controlled range.' },
        { fixed: 'Plank shoulder taps', sets: 2, reps: '10 per side', restSeconds: 30, rpe: '5-6', cues: 'Hips stay still.' },
        { fixed: 'Bear-position hold', sets: 2, reps: '20-30 sec', restSeconds: 30, rpe: '6', cues: 'Knees hover, back flat.' }
      ]
    },
    {
      id: 'runners_leg_circuit', name: 'Runner\'s Leg Circuit', slug: 'runners-leg-circuit', category: 'strength', subcategory: 'runner_strength',
      missionType: 'single_session', description: 'A concise, repeatable lower-body circuit built for runners.',
      trainingPurpose: ['runner_strength', 'durability', 'balance'], durationMinutesMin: 12, durationMinutesMax: 18,
      difficultyLevels: ['foundation', 'base', 'strong'], equipmentOptions: ['bodyweight'],
      impactLevel: 'low', trainingLoad: 3, lowerBodyFatigue: 3, upperBodyFatigue: 0, coreFatigue: 1, runningInterference: 'moderate',
      relationshipLabel: 'Supports your Main Quest', completionMetric: 'workout_complete', targetValue: 1,
      canReplaceWorkoutTypes: [], canComplementWorkoutTypes: ['easy', 'recovery', 'rest'], avoidBeforeWorkoutTypes: ['quality', 'long'],
      avoidWhen: ['severe_fatigue', 'relevant_pain', 'acute_illness'], requiresExperience: false, requiresCoachWarning: false, xpReward: 70,
      badgeId: null, progression: 'Add a round before adding harder variations of each movement.', logicalNextStep: 'Strong Runner 20',
      warmup: ['Easy marching in place 30 seconds', 'Leg swings x 8 each way'],
      exercises: [
        { pattern: 'squat', sets: 3, reps: '12', restSeconds: 30, rpe: '6', cues: 'Smooth depth, whole foot grounded.' },
        { fixed: 'Reverse lunge', sets: 3, reps: '8 per side', restSeconds: 30, rpe: '6', cues: 'Controlled descent.' },
        { fixed: 'Glute bridge', sets: 3, reps: '12', restSeconds: 20, rpe: '5', cues: 'Keep hips level.' },
        { fixed: 'Calf raise', sets: 3, reps: '15', restSeconds: 20, rpe: '5', cues: 'Slow lowering.' },
        { fixed: 'Single-leg balance', sets: 3, reps: '20 sec per side', restSeconds: 20, rpe: '4-5', cues: 'Soft knee, steady gaze.' }
      ]
    }
  ];

  // ── Bodyweight Challenge Library (docs/RACR_SideMission_Expansion.md) ──
  // Distinct from MISSION_CATALOG (single-session, complete/not-complete) and
  // from QUEST_TRACKS (session-count progress) -- a challenge accumulates a
  // numeric quantity (reps or seconds) toward a target across multiple
  // sessions, e.g. logging 30 squats today and 70 more next week both count
  // toward Squat Century's 100. Progress is never stored as its own counter
  // (see challengeProgressFromLog below) -- it's derived from tagged
  // state.sideQuestLog entries, which already merge safely across devices.
  // Not to be confused with the app's separate, unrelated "Weekly Challenge"
  // feature (WEEKLY_QUICK_QUESTS above / state.activeWeeklyChallenge in
  // app.js) -- that's a weekly session-count target, a different concept.
  var CHALLENGE_CATALOG = [
    {
      id: 'squat_century', name: 'Squat Century', category: 'strength', unit: 'reps', levels: [100],
      description: 'Complete 100 controlled squats, in any structure that works for you.',
      variants: { beginner: 'Chair squat', standard: 'Bodyweight squat', advanced: 'Goblet squat' },
      badgeId: 'squat_century', xpReward: 40, equipmentOptions: ['bodyweight', 'dumbbells'],
      avoidBeforeWorkoutTypes: ['quality', 'long'], lowerBodyFatigue: 3
    },
    {
      id: 'lunge_ladder', name: 'Lunge Ladder', category: 'strength', unit: 'reps', levels: [20, 40, 60, 80, 100],
      description: 'A personalized reverse-lunge progression, counted across both legs.',
      variants: { beginner: 'Supported split squat', standard: 'Reverse lunge', advanced: 'Weighted reverse lunge' },
      badgeId: 'lunge_builder', xpReward: 40, equipmentOptions: ['bodyweight', 'dumbbells', 'kettlebells'],
      avoidBeforeWorkoutTypes: ['quality', 'long'], lowerBodyFatigue: 3
    },
    {
      id: 'pushup_progress', name: 'Push-Up Progress', category: 'strength', unit: 'reps', levels: [15, 25, 40, 60, 100],
      description: 'Progress within whichever push-up variation fits you today.',
      variants: { beginner: 'Wall push-up', standard: 'Incline push-up', advanced: 'Floor push-up' },
      badgeId: 'pushup_progress', xpReward: 35, equipmentOptions: ['bodyweight'],
      avoidBeforeWorkoutTypes: [], lowerBodyFatigue: 0
    },
    {
      id: 'glute_bridge_builder', name: 'Glute-Bridge Builder', category: 'strength', unit: 'reps', levels: [30, 50, 75, 100],
      description: 'Build accumulated glute-bridge volume at a controlled tempo.',
      variants: { beginner: 'Supported glute bridge', standard: 'Glute bridge', advanced: 'Single-leg glute bridge' },
      badgeId: null, xpReward: 35, equipmentOptions: ['bodyweight'],
      avoidBeforeWorkoutTypes: ['long'], lowerBodyFatigue: 2
    },
    {
      id: 'calf_capacity', name: 'Calf Capacity', category: 'strength', unit: 'reps', levels: [40, 60, 80, 100],
      description: 'Build calf and ankle durability with slow, controlled repetitions.',
      variants: { beginner: 'Supported calf raise', standard: 'Calf raise', advanced: 'Single-leg calf raise' },
      badgeId: 'calf_capacity', xpReward: 35, equipmentOptions: ['bodyweight'],
      avoidBeforeWorkoutTypes: ['quality', 'long'], lowerBodyFatigue: 2
    },
    {
      id: 'wall_sit_builder', name: 'Wall-Sit Builder', category: 'strength', unit: 'seconds', levels: [60, 120, 180, 300],
      description: 'Accumulate wall-sit time across one or more sets -- quality over one maximum hold.',
      variants: { beginner: 'Supported wall sit', standard: 'Wall sit', advanced: 'Single-leg wall sit' },
      badgeId: null, xpReward: 30, equipmentOptions: ['bodyweight'],
      avoidBeforeWorkoutTypes: ['long'], lowerBodyFatigue: 2
    },
    {
      id: 'plank_accumulator', name: 'Plank Accumulator', category: 'core', unit: 'seconds', levels: [120, 240, 360, 480, 600],
      description: 'Accumulate quality plank time across sets -- never a single continuous maximum hold.',
      variants: { beginner: 'Knee plank', standard: 'Standard plank', advanced: 'Side plank' },
      badgeId: null, xpReward: 30, equipmentOptions: ['bodyweight'],
      avoidBeforeWorkoutTypes: [], lowerBodyFatigue: 0
    },
    {
      id: 'step_up_summit', name: 'Step-Up Summit', category: 'strength', unit: 'reps', levels: [50, 100, 150, 200],
      description: 'Accumulate controlled step-ups using a safe step, stair, or box.',
      variants: { beginner: 'Low step-up', standard: 'Step-up', advanced: 'Weighted step-up' },
      badgeId: null, xpReward: 35, equipmentOptions: ['bodyweight', 'chair_or_bench'],
      avoidBeforeWorkoutTypes: ['quality', 'long'], lowerBodyFatigue: 3
    }
  ];

  var QUEST_TRACKS = [
    {
      id: 'strong_runner_4_week', name: 'Strong Runner', questType: 'progressive_track', category: 'strength',
      durationWeeks: 4, missionsPerWeek: 2, estimatedMinutesPerMission: { min: 20, max: 30 },
      runningInterference: 'moderate', beginnerFriendly: true, equipmentRequired: false,
      equipmentOptions: ['bodyweight', 'chair_or_bench', 'resistance_bands', 'dumbbells', 'kettlebells', 'gym_access'],
      goal: 'Complete 8 runner-strength missions and progress at least one movement.',
      missionIds: ['strong_runner_20', 'core_10', 'strong_runner_20', 'carry_10', 'strong_runner_20', 'core_10', 'strong_runner_20', 'strong_runner_20'],
      missionNames: ['Full Body Foundation', 'Core Armor', 'Single-Leg Strength', 'Carry Strength', 'Posterior Chain', 'Running Durability', 'Full Body Progression', 'Final Benchmark'],
      benchmark: { type: 'user_selected', options: ['quality_pushups', 'single_leg_calf_raises', 'carry_duration', 'split_squat_repetitions'] }
    }
  ];

  var WEEKLY_QUICK_QUESTS = [
    { id: 'weekly_core_60', name: '60 Core Minutes', target: 60, metric: 'minutes', matchCategories: ['core'] },
    { id: 'weekly_strength_3', name: 'Three Strength Workouts', target: 3, metric: 'sessions', matchCategories: ['strength'] },
    { id: 'weekly_hike_4h', name: 'Four Hours of Hiking', target: 240, metric: 'minutes', matchCategories: ['hike'] }
  ];

  var CATEGORY_SECTIONS = [
    { id: 'recommended', name: 'Recommended for you', missionIds: ['upper_body_20', 'core_10', 'trail_90'] },
    { id: 'build_strength', name: 'Build Strength', missionIds: ['strong_runner_20', 'upper_body_20', 'core_10', 'carry_10', 'single_leg_stability', 'core_control', 'upper_body_armor', 'runners_leg_circuit'] },
    { id: 'go_explore', name: 'Go Explore', missionIds: ['trail_90'] },
    { id: 'quick_wins', name: 'Quick Wins', missionIds: ['core_10', 'carry_10', 'core_control'] },
    { id: 'cross_training', name: 'Cross-Training', missionIds: ['trail_90'] },
    { id: 'recovery_mobility', name: 'Recovery and Mobility', missionIds: ['core_10'] }
  ];

  var EQUIPMENT_ALIASES = {
    no_equipment: ['bodyweight', 'no_equipment'],
    chair_or_bench: ['chair_or_bench'],
    resistance_bands: ['resistance_bands'],
    dumbbells: ['dumbbells'],
    kettlebells: ['kettlebells'],
    barbell_and_rack: ['gym_access'],
    cable_machine: ['cable_machine', 'gym_access'],
    pull_up_bar: ['gym_access'],
    trx: ['trx', 'gym_access'],
    gym_access: ['gym_access', 'dumbbells', 'kettlebells', 'cable_machine', 'trx'],
    treadmill: ['treadmill'],
    stationary_bike: ['stationary_bike'],
    rowing_machine: ['rowing_machine'],
    stair_machine: ['stair_machine'],
    pool: ['pool']
  };

  function uniq(list) {
    var seen = {};
    return list.filter(function (x) { if (seen[x]) return false; seen[x] = true; return true; });
  }

  function normalizeEquipment(equipment) {
    var items = Array.isArray(equipment) ? equipment : [];
    var out = ['bodyweight', 'no_equipment'];
    items.forEach(function (item) {
      out = out.concat(EQUIPMENT_ALIASES[item] || [item]);
    });
    return uniq(out);
  }

  function missionById(id) {
    return MISSION_CATALOG.filter(function (m) { return m.id === id; })[0] || null;
  }

  function questTrackById(id) {
    return QUEST_TRACKS.filter(function (t) { return t.id === id; })[0] || null;
  }

  function questTrackTotalMissions(track) {
    return track ? track.durationWeeks * track.missionsPerWeek : 0;
  }

  function canStartSideQuest(state, trackId) {
    if (state && state.activeQuestTrack && state.activeQuestTrack.trackId && state.activeQuestTrack.trackId !== trackId) {
      return { ok: false, reason: 'one_active_side_quest' };
    }
    return { ok: true, reason: null };
  }

  function filterMissionsByEquipment(missions, equipment) {
    var normalized = normalizeEquipment(equipment);
    return missions.filter(function (m) {
      return (m.equipmentOptions || []).some(function (opt) { return normalized.indexOf(opt) !== -1; });
    });
  }

  function filterMissionsByExperience(missions, experience) {
    return missions.filter(function (m) {
      return !m.requiresExperience || experience === 'experienced_kettlebells' || experience === 'barbells_kettlebells';
    });
  }

  function filterMissionsByLimitations(missions, limitations) {
    var limits = Array.isArray(limitations) ? limitations : [];
    if (limits.indexOf('no_current_limitations') !== -1) return missions.slice();
    return missions.filter(function (m) {
      if (limits.indexOf('back_pain') !== -1 && (m.avoidWhen || []).indexOf('back_pain') !== -1) return false;
      if (limits.indexOf('shoulder_pain') !== -1 && (m.avoidWhen || []).indexOf('shoulder_pain') !== -1) return false;
      if (limits.indexOf('wrist_pain') !== -1 && (m.avoidWhen || []).indexOf('wrist_pain') !== -1) return false;
      if ((limits.indexOf('knee_pain') !== -1 || limits.indexOf('ankle_foot_pain') !== -1 || limits.indexOf('hip_pain') !== -1) && m.lowerBodyFatigue >= 3) return false;
      return true;
    });
  }

  function workoutClassification(type, label) {
    label = label || '';
    if (type === 'race' || /race/i.test(label)) return { priority: 5, classification: 'protected', movable: false };
    if (type === 'long') return { priority: 5, classification: 'protected', movable: true };
    if (type === 'quality') return { priority: 5, classification: 'protected', movable: true };
    if (type === 'easy') return { priority: 2, classification: 'replaceable', movable: true };
    if (type === 'cross') return { priority: 2, classification: 'movable', movable: true };
    if (type === 'rest') return { priority: 1, classification: 'optional', movable: false };
    return { priority: 2, classification: 'movable', movable: true };
  }

  function trainingLoadForWorkout(type) {
    if (type === 'long' || type === 'quality' || type === 'race') return 5;
    if (type === 'cross' || type === 'easy') return 2;
    return 0;
  }

  function weeklyLoad(days, missions) {
    var total = 0;
    (days || []).forEach(function (day) { total += trainingLoadForWorkout(day.type); });
    (missions || []).forEach(function (mission) { total += mission.trainingLoad || 0; });
    return total;
  }

  function substitutionValue(workoutType, mission) {
    if (!mission) return 'none';
    if ((mission.canReplaceWorkoutTypes || []).indexOf(workoutType) !== -1) return 'full_replacement';
    if (workoutType === 'easy' && (mission.category === 'strength' || mission.category === 'core')) return 'partial_credit';
    if ((mission.canComplementWorkoutTypes || []).indexOf(workoutType) !== -1) return 'complementary';
    return 'none';
  }

  function detectCalendarConflict(mission, dayIndex, weekDays) {
    if (!mission) return { ok: false, reason: 'missing_mission' };
    var next = weekDays && weekDays[dayIndex + 1];
    if (next && (mission.avoidBeforeWorkoutTypes || []).indexOf(next.type) !== -1) {
      return { ok: false, reason: 'avoid_before_' + next.type };
    }
    if (next && mission.lowerBodyFatigue >= 3 && (next.type === 'long' || next.type === 'quality')) {
      return { ok: false, reason: 'lower_body_fatigue_before_' + next.type };
    }
    return { ok: true, reason: null };
  }

  function recommendMissions(context) {
    var onboarding = (context && context.onboarding) || {};
    var missions = MISSION_CATALOG.slice();
    missions = filterMissionsByEquipment(missions, onboarding.equipment || []);
    missions = filterMissionsByExperience(missions, onboarding.strengthExperience || 'new');
    missions = filterMissionsByLimitations(missions, onboarding.limitations || []);
    if (context && (context.feeling === 'bored' || context.feeling === 'dreading')) {
      missions.sort(function (a, b) {
        var as = (a.category === 'hike' ? 3 : a.category === 'strength' ? 2 : 1);
        var bs = (b.category === 'hike' ? 3 : b.category === 'strength' ? 2 : 1);
        return bs - as;
      });
    }
    return missions.slice(0, 4);
  }

  function missionSummaryForCoach(mission) {
    return {
      id: mission.id, name: mission.name, category: mission.category, description: mission.description,
      estimatedMinutes: mission.durationMinutesMax, trainingLoad: mission.trainingLoad,
      replaces: mission.canReplaceWorkoutTypes || []
    };
  }

  function resolveExercise(exercise, difficulty) {
    if (exercise.pattern && MOVEMENT_VARIANTS[exercise.pattern]) {
      return MOVEMENT_VARIANTS[exercise.pattern][difficulty || 'base'] || MOVEMENT_VARIANTS[exercise.pattern].base;
    }
    return exercise.fixed || '';
  }

  function challengeById(id) {
    return CHALLENGE_CATALOG.filter(function (c) { return c.id === id; })[0] || null;
  }

  // Pure -- takes the log array as a parameter rather than touching any
  // stored state directly, matching this module's existing convention
  // (e.g. weeklyLoad(days, missions)). `level` is 1-indexed count of levels
  // reached (0 = none yet); `complete` is true only once every level,
  // including the final one, has been reached.
  function challengeProgressFromLog(challengeId, sideQuestLog) {
    var challenge = challengeById(challengeId);
    if (!challenge) return { accumulated: 0, level: 0, levelTarget: 0, complete: false };
    var accumulated = (sideQuestLog || [])
      .filter(function (e) { return e && e.challengeId === challengeId; })
      .reduce(function (sum, e) { return sum + (e.amount || 0); }, 0);
    var level = 0;
    for (var i = 0; i < challenge.levels.length; i++) {
      if (accumulated >= challenge.levels[i]) level = i + 1; else break;
    }
    var complete = level >= challenge.levels.length;
    var levelTarget = challenge.levels[Math.min(level, challenge.levels.length - 1)];
    return { accumulated: accumulated, level: level, levelTarget: levelTarget, complete: complete };
  }

  return {
    MOVEMENT_VARIANTS: MOVEMENT_VARIANTS,
    MISSION_CATALOG: MISSION_CATALOG,
    CHALLENGE_CATALOG: CHALLENGE_CATALOG,
    QUEST_TRACKS: QUEST_TRACKS,
    WEEKLY_QUICK_QUESTS: WEEKLY_QUICK_QUESTS,
    CATEGORY_SECTIONS: CATEGORY_SECTIONS,
    missionById: missionById,
    questTrackById: questTrackById,
    questTrackTotalMissions: questTrackTotalMissions,
    canStartSideQuest: canStartSideQuest,
    filterMissionsByEquipment: filterMissionsByEquipment,
    filterMissionsByExperience: filterMissionsByExperience,
    filterMissionsByLimitations: filterMissionsByLimitations,
    workoutClassification: workoutClassification,
    trainingLoadForWorkout: trainingLoadForWorkout,
    weeklyLoad: weeklyLoad,
    substitutionValue: substitutionValue,
    detectCalendarConflict: detectCalendarConflict,
    recommendMissions: recommendMissions,
    missionSummaryForCoach: missionSummaryForCoach,
    resolveExercise: resolveExercise,
    challengeById: challengeById,
    challengeProgressFromLog: challengeProgressFromLog
  };
});

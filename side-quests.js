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
      relationshipLabel: 'Supports Main Quest', completionMetric: 'workout_complete', targetValue: 1,
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
      relationshipLabel: 'Complements today\'s workout', completionMetric: 'workout_complete', targetValue: 1,
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
      relationshipLabel: 'Does not replace a run', completionMetric: 'minutes', targetValue: 10,
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
      relationshipLabel: 'Can replace an easy run', completionMetric: 'minutes', targetValue: 90,
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
      relationshipLabel: 'Best on a rest or easy day', completionMetric: 'carry_minutes', targetValue: 10,
      canReplaceWorkoutTypes: [], canComplementWorkoutTypes: ['easy', 'recovery', 'rest'], avoidBeforeWorkoutTypes: [],
      avoidWhen: ['severe_fatigue', 'back_pain', 'shoulder_pain', 'wrist_pain', 'acute_illness'], requiresExperience: false, requiresCoachWarning: false, xpReward: 90,
      badgeId: 'carry_strong', progression: 'Add total carry time before adding load.', logicalNextStep: 'Upper Body 20',
      warmup: ['Unloaded walk 2 minutes', 'Light carry 30 seconds each side'],
      exercises: [{ fixed: 'Farmer, suitcase, front-rack, or backpack carry', sets: 'as needed', reps: '10 total carry minutes', restSeconds: 30, rpe: '6-7', cues: 'Tall posture, controlled steps.' }]
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
    { id: 'build_strength', name: 'Build Strength', missionIds: ['strong_runner_20', 'upper_body_20', 'core_10', 'carry_10'] },
    { id: 'go_explore', name: 'Go Explore', missionIds: ['trail_90'] },
    { id: 'quick_wins', name: 'Quick Wins', missionIds: ['core_10', 'carry_10'] },
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

  return {
    MOVEMENT_VARIANTS: MOVEMENT_VARIANTS,
    MISSION_CATALOG: MISSION_CATALOG,
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
    resolveExercise: resolveExercise
  };
});

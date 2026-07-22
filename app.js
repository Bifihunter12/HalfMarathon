(function () {
  'use strict';

  var STORAGE_KEY = 'training_plan_v1';
  var SideQuestDomain = window.RACRSideQuests || {};
  var PathDomain = window.RACRPath || {};
  var XpDomain = window.RACRXp || {};
  var DOW_FULL = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  // ── Event + level tables (own synthesis, not any coach's copyrighted schedule) ──
  var EVENTS = ['5k', '10k', 'half', 'marathon', '50k', '50mi', '100k', '100mi'];
  var EVENT_LABEL = { '5k': '5K', '10k': '10K', half: 'Half Marathon', marathon: 'Marathon', '50k': '50K', '50mi': '50 Mile', '100k': '100K', '100mi': '100 Mile' };
  var RACE_LABEL = { '5k': '5K Race', '10k': '10K Race', half: 'Half Marathon', marathon: 'Marathon', '50k': '50K', '50mi': '50 Mile', '100k': '100K', '100mi': '100 Mile' };
  var RACE_LABEL_SET = {};
  EVENTS.forEach(function (e) { RACE_LABEL_SET[RACE_LABEL[e].toLowerCase()] = true; });
  // legacy labels from the original Higdon-only version, kept recognizable for old overrides
  ['5-k race', '10-k race'].forEach(function (l) { RACE_LABEL_SET[l] = true; });

  var LEVELS = ['beginner', 'novice', 'intermediate', 'advanced'];
  var LEVEL_LABEL = { beginner: 'Beginner', novice: 'Novice', intermediate: 'Intermediate', advanced: 'Advanced' };
  var GOALS = ['finish', 'improve', 'pr', 'aggressive'];
  var GOAL_LABEL = { finish: 'Finish', improve: 'Improve', pr: 'PR', aggressive: 'Aggressive PR' };
  var GOAL_FACTOR = { finish: 0.85, improve: 1.0, pr: 1.05, aggressive: 1.12 };
  var TERRAINS = ['road', 'trail', 'hills', 'mountain', 'treadmill'];
  var TERRAIN_LABEL = { road: 'Road', trail: 'Trail', hills: 'Hills', mountain: 'Mountain', treadmill: 'Treadmill' };
  var CROSS_OPTIONS = ['Bike', 'Swim', 'Elliptical', 'Row', 'Hike', 'Strength', 'Yoga', 'Other', 'None'];
  var RACE_RESULT_DISTANCES = ['none', '5k', '10k', 'half', 'marathon'];
  var RACE_RESULT_LABEL = { none: 'None', '5k': '5K', '10k': '10K', half: 'Half', marathon: 'Marathon' };

  var INCREASE_PCT = { beginner: 0.04, novice: 0.06, intermediate: 0.08, advanced: 0.10 };
  var CUTBACK_PCT = { beginner: 0.20, novice: 0.17, intermediate: 0.15, advanced: 0.12 };
  var CUTBACK_INTERVAL = { beginner: 3, novice: 3, intermediate: 4, advanced: 4 };
  var RUN_DAYS_DEFAULT = { beginner: 3, novice: 3, intermediate: 5, advanced: 6 };
  var STRENGTH_SESSIONS = { base: 2, build: 2, peak: 1, taper: 0, race: 0 };

  // { idealWeeks, minWeeks, longRunPeak (mi), peakVolume (mi/wk), taperWeeks }
  var EVENT_TABLE = {
    '5k': {
      beginner: { idealWeeks: 12, minWeeks: 8, longRunPeak: 3, peakVolume: 12, taperWeeks: 1 },
      novice: { idealWeeks: 10, minWeeks: 8, longRunPeak: 4, peakVolume: 15, taperWeeks: 1 },
      intermediate: { idealWeeks: 8, minWeeks: 6, longRunPeak: 6, peakVolume: 22, taperWeeks: 1 },
      advanced: { idealWeeks: 6, minWeeks: 4, longRunPeak: 8, peakVolume: 30, taperWeeks: 1 }
    },
    '10k': {
      beginner: { idealWeeks: 12, minWeeks: 8, longRunPeak: 5, peakVolume: 16, taperWeeks: 1 },
      novice: { idealWeeks: 10, minWeeks: 8, longRunPeak: 6, peakVolume: 20, taperWeeks: 1 },
      intermediate: { idealWeeks: 8, minWeeks: 6, longRunPeak: 9, peakVolume: 28, taperWeeks: 1 },
      advanced: { idealWeeks: 8, minWeeks: 6, longRunPeak: 11, peakVolume: 38, taperWeeks: 1 }
    },
    half: {
      beginner: { idealWeeks: 18, minWeeks: 12, longRunPeak: 9, peakVolume: 22, taperWeeks: 2 },
      novice: { idealWeeks: 14, minWeeks: 10, longRunPeak: 10, peakVolume: 28, taperWeeks: 2 },
      intermediate: { idealWeeks: 12, minWeeks: 8, longRunPeak: 12, peakVolume: 38, taperWeeks: 2 },
      advanced: { idealWeeks: 10, minWeeks: 6, longRunPeak: 15, peakVolume: 50, taperWeeks: 2 }
    },
    marathon: {
      beginner: { idealWeeks: 22, minWeeks: 16, longRunPeak: 18, peakVolume: 35, taperWeeks: 3 },
      novice: { idealWeeks: 18, minWeeks: 14, longRunPeak: 20, peakVolume: 42, taperWeeks: 3 },
      intermediate: { idealWeeks: 16, minWeeks: 12, longRunPeak: 20, peakVolume: 52, taperWeeks: 3 },
      advanced: { idealWeeks: 14, minWeeks: 10, longRunPeak: 22, peakVolume: 65, taperWeeks: 3 }
    },
    '50k': {
      beginner: { idealWeeks: 24, minWeeks: 16, longRunPeak: 22, peakVolume: 35, taperWeeks: 2 },
      novice: { idealWeeks: 20, minWeeks: 14, longRunPeak: 24, peakVolume: 42, taperWeeks: 2 },
      intermediate: { idealWeeks: 16, minWeeks: 12, longRunPeak: 26, peakVolume: 50, taperWeeks: 2 },
      advanced: { idealWeeks: 14, minWeeks: 10, longRunPeak: 28, peakVolume: 60, taperWeeks: 2 }
    },
    '50mi': {
      beginner: { idealWeeks: 28, minWeeks: 20, longRunPeak: 28, peakVolume: 45, taperWeeks: 3 },
      novice: { idealWeeks: 24, minWeeks: 18, longRunPeak: 30, peakVolume: 52, taperWeeks: 3 },
      intermediate: { idealWeeks: 20, minWeeks: 14, longRunPeak: 32, peakVolume: 60, taperWeeks: 3 },
      advanced: { idealWeeks: 16, minWeeks: 12, longRunPeak: 34, peakVolume: 70, taperWeeks: 3 }
    },
    '100k': {
      beginner: { idealWeeks: 28, minWeeks: 20, longRunPeak: 28, peakVolume: 45, taperWeeks: 3 },
      novice: { idealWeeks: 24, minWeeks: 18, longRunPeak: 30, peakVolume: 52, taperWeeks: 3 },
      intermediate: { idealWeeks: 20, minWeeks: 14, longRunPeak: 32, peakVolume: 60, taperWeeks: 3 },
      advanced: { idealWeeks: 16, minWeeks: 12, longRunPeak: 34, peakVolume: 70, taperWeeks: 3 }
    },
    '100mi': {
      beginner: { idealWeeks: 36, minWeeks: 24, longRunPeak: 32, peakVolume: 55, taperWeeks: 4 },
      novice: { idealWeeks: 30, minWeeks: 20, longRunPeak: 34, peakVolume: 62, taperWeeks: 4 },
      intermediate: { idealWeeks: 24, minWeeks: 16, longRunPeak: 36, peakVolume: 72, taperWeeks: 4 },
      advanced: { idealWeeks: 20, minWeeks: 14, longRunPeak: 38, peakVolume: 80, taperWeeks: 4 }
    }
  };

  var LONG_RUN_SHARE = { '5k': 0.32, '10k': 0.30, half: 0.30, marathon: 0.28, '50k': 0.35, '50mi': 0.38, '100k': 0.38, '100mi': 0.40 };

  var QUALITY_POOL = {
    '5k': { entry: ['Easy + 4-6 x 20 sec strides'], trained: ['6 x 400m @ 5K pace', '5 x 3 min @ 5K effort', '4 x 5 min @ 10K effort', 'Fartlek: 8 x 1 min hard / 1 min easy'] },
    '10k': { entry: ['Easy + strides', '20 min tempo, comfortably hard'], trained: ['Tempo: 25-30 min @ threshold', '5 x 1000m @ 10K pace', '6 x 800m @ 10K pace', 'Hills: 6 x 2 min uphill'] },
    half: { entry: ['Easy + strides', '15-20 min tempo'], trained: ['Tempo: 3 x 10 min @ threshold', '4-6 mi @ half-marathon pace', '5 x 1 mi @ 10K pace'] },
    marathon: { entry: ['Medium-long run', 'Easy + strides'], trained: ['8 mi w/ 4 mi @ marathon pace', '2 x 4 mi @ marathon pace', 'Medium-long run'] },
    '50k': { entry: ['Hill repeats: 5 x 3 min uphill', 'Trail long run w/ climbing'], trained: ['Back-to-back long runs', 'Long climb + descent conditioning'] },
    '50mi': { entry: ['Back-to-back long runs', 'Time-on-feet long run'], trained: ['Back-to-back long runs', 'Long climb + descent conditioning', 'Night run rehearsal'] },
    '100k': { entry: ['Back-to-back long runs', 'Time-on-feet long run'], trained: ['Back-to-back long runs', 'Long climb + descent conditioning', 'Night run rehearsal'] },
    '100mi': { entry: ['Back-to-back long runs', 'Time-on-feet long run', 'Gear + fueling rehearsal'], trained: ['Back-to-back long runs', 'Night run rehearsal', 'Downhill conditioning', 'Gear + fueling rehearsal'] }
  };

  var RED_FLAGS = [
    'Chest pain', 'Fainting', 'Severe shortness of breath', 'Severe dizziness',
    'Neurological symptoms (numbness, slurred speech, vision loss)', 'Unexplained rapid heart rate',
    'Severe or worsening pain', 'Sharp, focal bone pain that worsens with impact (possible stress fracture)',
    'Blood in stool or urine', 'Unexplained weight loss', 'Persistent extreme fatigue',
    'Eating-disorder behaviors'
  ];

  // Short inline hints for calendar labels that read as cryptic on their own
  // (unlike e.g. "6 x 400m @ 5K pace", which already explains itself). Matched
  // by substring so they still show up if the label is combined with a
  // terrain note. Deliberately much shorter than GLOSSARY_WORKOUTS' full
  // paragraphs -- those are for the dedicated Glossary screen, this is a
  // one-line hint that fits the calendar row.
  var CALENDAR_HINTS = [
    // Most-specific labels first -- first substring match wins, so generic
    // ones like "easy run"/"long run" have to come after every label that
    // contains those words but means something more specific.
    ['Easy + strides', 'Easy pace, then 4-6 x ~20 sec quick-but-controlled pickups, full recovery between'],
    ['Medium-long run', 'Longer than an easy run, shorter than your weekly long run'],
    ['Back-to-back long runs', 'Two long-ish runs on consecutive days, to train running on tired legs'],
    ['Time-on-feet long run', 'Paced by duration, not distance -- hiking the tough parts is fine'],
    ['Trail long run w/ climbing', 'A long run on the hilliest terrain you have access to'],
    ['Long climb + descent conditioning', 'Sustained uphill and downhill running to condition legs for race terrain'],
    ['Night run rehearsal', 'Practice running in the dark -- test your lights/gear before race day'],
    ['Downhill conditioning', 'Repeated descents to condition your legs for the pounding of downhill running'],
    ['Gear + fueling rehearsal', 'Practice your actual race-day gear, food, and drink on this run'],
    ['Fartlek', '"Speed play" -- unstructured faster bursts mixed into an easy run, by feel not exact pace'],
    ['Hill repeats', 'Hard uphill efforts, jogging or walking back down as recovery between each'],
    ['Hills:', 'Hard uphill efforts, jogging or walking back down as recovery between each'],
    ['@ half-marathon pace', 'Miles at your actual goal race pace, so it feels familiar on race day'],
    ['@ marathon pace', 'Miles at your actual goal race pace, so it feels familiar on race day'],
    ['@ 5K pace', 'Fast reps at your goal 5K race pace, with recovery jogs between'],
    ['@ 5K effort', 'Hard, sustained reps around 5K effort -- go by feel, not a watch'],
    ['@ 10K pace', 'Reps at your goal 10K race pace, with recovery jogs between'],
    ['@ 10K effort', 'Sustained, controlled reps around 10K effort -- harder than tempo, not all-out'],
    ['Tempo', 'A "comfortably hard" sustained effort -- faster than easy, controlled, not a sprint'],
    ['long run', 'Your longest effort of the week, done slower than race pace'],
    ['easy run', 'Comfortable, conversational pace -- most of your running should feel like this'],
    ['cross', 'Non-running aerobic work -- builds fitness while giving your running muscles a break'],
    ['Rest', 'A full day off running -- this is when your body actually adapts and gets stronger']
  ];
  function calendarHint(label) {
    for (var i = 0; i < CALENDAR_HINTS.length; i++) {
      if (label.indexOf(CALENDAR_HINTS[i][0]) !== -1) return CALENDAR_HINTS[i][1];
    }
    return null;
  }

  var GLOSSARY_WORKOUTS = [
    ['Easy run', 'Comfortable, conversational pace. Most of your weekly running should feel like this — it\'s not a warm-up, it\'s the actual point.'],
    ['Long run', 'Your longest run of the week, done slower than race pace. Builds the endurance and mental toughness that shorter runs can\'t.'],
    ['Easy + strides', 'An easy run finished with 4-6 short ~20 second pickups to a quick but controlled pace, with a full walk/jog recovery between each. Works on form and leg speed without adding real fatigue.'],
    ['Tempo run', 'A sustained "comfortably hard" effort — faster than easy, but controlled, not all-out — usually bracketed by easy warm-up and cool-down miles.'],
    ['Intervals (e.g. "6 x 400m")', 'Repeated fast segments at a specific pace, with recovery jogs or walks in between. Builds speed and running economy.'],
    ['Fartlek', 'Swedish for "speed play" — unstructured bursts of faster running mixed into an easy run, by feel rather than exact distances or paces.'],
    ['Hill repeats', 'Repeated hard efforts running uphill, with an easy jog or walk back down as recovery. Builds strength with less impact than flat sprinting.'],
    ['Race-pace run (e.g. "4 mi @ half pace")', 'Miles run at the exact pace you\'re targeting for race day, so your body and mind learn what that effort actually feels like.'],
    ['Medium-long run', 'Shorter than your weekly long run but longer than a typical easy run — extra time on your feet without the full long-run fatigue.'],
    ['Back-to-back long runs', 'Two long-ish runs on consecutive days (e.g. Saturday and Sunday), used in ultra training to practice running on already-tired legs.'],
    ['Cross-training', 'Non-running aerobic exercise (bike, swim, elliptical, etc.) that builds fitness while giving your running muscles a break.'],
    ['Strength', 'Resistance training (squats, lunges, core work) to build durability and reduce injury risk — not meant to leave you sore for your next run.'],
    ['Fueling practice', 'A reminder tag on long runs over about 90 minutes — practice eating and drinking exactly what you plan to use on race day.'],
    ['Rest', 'A full day off running. Not optional — this is when your body actually adapts and gets stronger.']
  ];
  var GLOSSARY_PHASES = [
    ['Base', 'Early weeks focused on easy aerobic mileage — building a foundation before anything harder.'],
    ['Build', 'Weekly volume (and a little intensity) increases as your base solidifies.'],
    ['Peak', 'Your hardest, highest-volume weeks — closest to what race day will actually demand.'],
    ['Taper', 'The final weeks before race day, where mileage drops sharply so you arrive rested, not just fit.'],
    ['Race', 'Race week itself — minimal, easy running to stay loose, then the race.'],
    ['Cutback week', 'A deliberately lighter week built in every few weeks so your body can absorb the training instead of just accumulating fatigue.']
  ];

  // Workout detail content, keyed by the generator's structural day.type — not by label
  // text, so an edited label doesn't break which explanation shows.
  var WORKOUT_DETAIL = {
    easy: {
      what: 'An easy-paced run.',
      why: 'Builds your aerobic base without adding fatigue — most of your training should be this.',
      howHard: 'Conversational pace. RPE 3-4 out of 10 — you should be able to talk in full sentences.',
      ifCant: "Shorten it or walk portions. An easy run doesn't need to be perfect, just consistent.",
      mistakes: 'Running it too fast is the #1 mistake — easy should feel almost too slow.'
    },
    long: {
      what: 'Your longest run of the week.',
      why: "Builds the endurance and durability shorter runs can't.",
      howHard: 'Comfortable, slower than race pace. RPE 4-5.',
      ifCant: 'Cut it short rather than skip it entirely — a partial long run still counts.',
      mistakes: 'Starting too fast, and skipping fluids or fuel on runs over 90 minutes.'
    },
    quality: {
      what: "Today's key workout — tempo, intervals, hills, or race-pace work (see the label above for specifics).",
      why: 'This is the one effort each week that actually raises your fitness ceiling.',
      howHard: 'Follow the effort described in the label. Usually RPE 6-8.',
      ifCant: "Drop to an easy run instead of forcing it — one missed quality session won't hurt your race.",
      mistakes: 'Skipping the warm-up, or going out too hard in the first rep.'
    },
    cross: {
      what: 'Non-running aerobic work.',
      why: 'Builds fitness while giving your running muscles a break.',
      howHard: 'Easy-to-moderate effort unless the label says otherwise.',
      ifCant: 'Swap for any aerobic activity you have access to, or just rest.',
      mistakes: "Treating it as optional — it's protecting your running legs from overuse."
    },
    rest: {
      what: 'A full day off running.',
      why: 'This is when your body actually adapts and gets stronger.',
      howHard: 'N/A — rest.',
      ifCant: 'If you must move, keep it very light — a walk, not a workout.',
      mistakes: "Feeling guilty about it. Rest is part of the plan, not a gap in it."
    },
    race: {
      what: 'Race day.',
      why: "The goal you've been building toward.",
      howHard: 'Your target effort for the distance — start controlled, not fast.',
      ifCant: "If you're sick or injured, it's OK to defer — check the safety panel.",
      mistakes: "Trying anything new on race day — gear, food, pace — that you haven't practiced in training."
    }
  };

  // ── Side Quests (docs/Runner_SideQuest_Spec.md) ─────────────────────────
  // Deterministic substitution catalog for "Not feeling this run?" -- the
  // filter picks from this fixed list by reason + day type; nothing here is
  // AI-generated or AI-invented, matching the spec's "deterministic rules
  // first" principle.
  var SIDE_QUEST_REASONS = ['mental_boredom', 'physical_fatigue', 'short_on_time', 'want_hike', 'want_strength', 'pain', 'want_different'];
  var SIDE_QUEST_REASON_LABEL = {
    mental_boredom: "I'm mentally tired of running", physical_fatigue: 'My legs feel physically tired',
    short_on_time: "I'm short on time", want_hike: 'I want to hike instead', want_strength: 'I want to strength train',
    pain: 'I have pain or discomfort', want_different: 'I just want something different'
  };
  // trainingLoad is a rough 1-5 scale (spec §15); replaces lists which day
  // types this quest may stand in for -- kept intentionally trimmed vs. the
  // spec's full schema (no equipment/muscle_groups/progression yet -- that's
  // Phase 2 territory once quest tracks exist).
  var SIDE_QUESTS = [
    { id: 'hike_60', name: '60-Minute Hike', category: 'hike', description: 'An easy-paced hike, roughly an hour.', estimatedMinutes: 60, trainingLoad: 3, rewardPoints: 120, replaces: ['easy', 'cross'] },
    { id: 'hike_90', name: '90-Minute Hike', category: 'hike', description: 'A longer hike on easier terrain than a run.', estimatedMinutes: 90, trainingLoad: 4, rewardPoints: 160, replaces: ['easy', 'cross'] },
    { id: 'incline_walk', name: '35-Minute Incline Walk', category: 'hike', description: 'A brisk walk on an incline or treadmill grade -- low-impact aerobic work.', estimatedMinutes: 35, trainingLoad: 1, rewardPoints: 60, replaces: ['easy', 'cross'] },
    { id: 'upper_body_builder', name: 'Upper Body Builder', category: 'strength', description: 'A full upper-body strength session -- push, pull, and core.', estimatedMinutes: 30, trainingLoad: 2, rewardPoints: 100, replaces: ['easy', 'cross'] },
    { id: 'core_10', name: 'Core 10', category: 'core', description: '10 minutes of focused core work.', estimatedMinutes: 10, trainingLoad: 1, rewardPoints: 50, replaces: ['easy', 'cross'] },
    { id: 'core_20', name: 'Core 20', category: 'core', description: '20 minutes of focused core work.', estimatedMinutes: 20, trainingLoad: 2, rewardPoints: 90, replaces: ['easy', 'cross'] },
    { id: 'kb_swing_100', name: 'Kettlebell 100', category: 'strength', description: 'Complete 100 controlled kettlebell swings.', estimatedMinutes: 15, trainingLoad: 2, rewardPoints: 100, replaces: ['easy', 'cross'] },
    { id: 'pushup_ladder', name: 'Push-Up Ladder', category: 'strength', description: 'A push-up ladder set -- build to your max in rungs.', estimatedMinutes: 15, trainingLoad: 2, rewardPoints: 90, replaces: ['easy', 'cross'] },
    { id: 'squat_century', name: 'Squat Century', category: 'strength', description: '100 bodyweight squats, broken into manageable sets.', estimatedMinutes: 20, trainingLoad: 3, rewardPoints: 100, replaces: ['cross'] },
    { id: 'row_5k', name: '5K Row', category: 'cross', description: 'Row 5,000 meters at a steady effort.', estimatedMinutes: 25, trainingLoad: 3, rewardPoints: 110, replaces: ['easy', 'cross'] },
    { id: 'easy_cycle', name: 'Easy 30-Minute Cycle', category: 'cross', description: 'A relaxed, conversational-pace bike ride.', estimatedMinutes: 30, trainingLoad: 2, rewardPoints: 80, replaces: ['easy', 'cross'] },
    { id: 'mobility_reset', name: 'Mobility Reset', category: 'mobility', description: '15 minutes of hips, ankles, and thoracic mobility work.', estimatedMinutes: 15, trainingLoad: 1, rewardPoints: 60, replaces: ['easy', 'cross'] },
    { id: 'farmer_carry', name: 'Farmer Carry Challenge', category: 'strength', description: 'Loaded carries for distance or time -- grip, core, and legs.', estimatedMinutes: 15, trainingLoad: 2, rewardPoints: 90, replaces: ['easy', 'cross'] },
    { id: 'stair_climb', name: 'Stair Climb', category: 'cross', description: 'Repeated stair or step climbing at a steady effort.', estimatedMinutes: 20, trainingLoad: 2, rewardPoints: 90, replaces: ['easy', 'cross'] },
    { id: 'new_route_run', name: 'New-Route Run', category: 'run', description: "Keep the run, but explore a route you haven't tried before.", estimatedMinutes: 30, trainingLoad: 2, rewardPoints: 70, replaces: ['easy'] }
  ];
  var SIDE_QUEST_LOAD_LABEL = { 1: 'Very light', 2: 'Light', 3: 'Moderate', 4: 'Moderate-hard', 5: 'Hard' };

  // Reason -> filter. Never returns an unsafe pairing (e.g. hard strength
  // when physically fatigued) -- these guardrails are the point, not the
  // catalog itself.
  function questsForReason(reason, dayType) {
    var pool = SIDE_QUESTS.filter(function (q) { return q.replaces.indexOf(dayType) !== -1; });
    if (reason === 'physical_fatigue') {
      pool = pool.filter(function (q) { return q.trainingLoad <= 2 && q.category !== 'strength'; });
    } else if (reason === 'short_on_time') {
      pool = pool.filter(function (q) { return q.estimatedMinutes <= 20; });
    } else if (reason === 'want_hike') {
      pool = pool.filter(function (q) { return q.category === 'hike'; });
    } else if (reason === 'want_strength') {
      pool = pool.filter(function (q) { return q.category === 'strength'; });
    } else {
      // mental_boredom / want_different -- a broad variety mix, deliberately
      // excluding the "run" category since the point is a break from running.
      pool = pool.filter(function (q) { return q.category !== 'run'; });
    }
    return pool.slice(0, 4);
  }

  function applySideQuest(key, quest, baseLabel) {
    if (quest.name === baseLabel) delete state.overrides[key]; else state.overrides[key] = quest.name;
    state.sideQuestLog.push({ id: quest.id, key: key, date: dateToISO(new Date()), category: quest.category, rewardPoints: quest.rewardPoints });
    // Previously never awarded XP at all (a pre-existing inconsistency vs.
    // completeMission/applySideQuestChat, found while scoping the reward
    // system's Phase 1) -- now routed through the same shared path as every
    // other Side Mission completion.
    awardSideMissionXp('sidemission|' + quest.id + '|' + key + '|' + dateToISO(new Date()), quest.rewardPoints, { key: key });
    refreshPathProgress();
  }

  // ── Quest Tracks (docs/Runner_Quests_Tab_Spec.md) ───────────────────────
  // Multiweek strength programs, separate from the single-session
  // SIDE_QUESTS catalog above. Core idea: "every body can strength train,
  // every exercise can be scaled" -- movements with a real beginner/
  // standard/advanced version are named once here and reused across tracks,
  // never duplicated per track.
  var MOVEMENT_VARIANTS = {
    squat: { beginner: 'Chair squat', standard: 'Bodyweight squat', advanced: 'Goblet squat' },
    push: { beginner: 'Wall push-up', standard: 'Incline push-up', advanced: 'Floor push-up' },
    pull: { beginner: 'Band row', standard: 'Dumbbell row', advanced: 'Renegade row' },
    hinge: { beginner: 'Supported hip hinge', standard: 'Dumbbell deadlift', advanced: 'Kettlebell swing' },
    core: { beginner: 'Dead bug', standard: 'Side plank', advanced: 'Loaded carry' },
    lunge: { beginner: 'Supported split squat', standard: 'Reverse lunge', advanced: 'Weighted lunge' }
  };
  var DIFFICULTY_LEVELS = ['beginner', 'standard', 'advanced'];
  var DIFFICULTY_LABEL = { beginner: 'Beginner', standard: 'Standard', advanced: 'Advanced' };

  var QUEST_TRACKS = [
    {
      id: 'strong_start', name: 'Strong Start', hasDifficulty: false, weeks: 4, sessionsPerWeek: 2, sessionMinutes: 20,
      equipment: 'None required', runningInterference: 'Low', beginnerFriendly: true,
      description: 'A gentle intro to strength training -- no experience needed.',
      exercises: [{ fixed: 'Chair Squat' }, { fixed: 'Wall Push-Up' }, { fixed: 'Band or Dumbbell Row' }, { fixed: 'Glute Bridge' }, { fixed: 'Dead Bug' }, { fixed: 'Farmer Carry' }]
    },
    {
      id: 'upper_body_builder_track', name: 'Upper Body Builder', hasDifficulty: true, weeks: 4, sessionsPerWeek: 2, sessionMinutes: 28,
      equipment: 'Optional dumbbells or bands', runningInterference: 'Low', beginnerFriendly: true,
      description: 'Build stronger shoulders, arms, chest, and back without exhausting your running legs.',
      exercises: [{ movement: 'push' }, { movement: 'pull' }, { fixed: 'Overhead Press' }, { fixed: 'Lat Pull or Pullover' }, { fixed: 'Biceps & Triceps Finisher' }, { fixed: 'Carry' }, { movement: 'core' }]
    },
    {
      id: 'strong_runner_track', name: 'Strong Runner', hasDifficulty: true, weeks: 4, sessionsPerWeek: 2, sessionMinutes: 25,
      equipment: 'Optional dumbbells', runningInterference: 'Low', beginnerFriendly: true,
      description: 'The default strength track for runners -- durability without exhaustion.',
      exercises: [{ movement: 'squat' }, { movement: 'hinge' }, { fixed: 'Step-Up' }, { fixed: 'Calf Raise' }, { movement: 'pull' }, { movement: 'push' }, { fixed: 'Carry' }, { movement: 'core', label: 'Anti-rotation core' }]
    }
  ];

  function resolveExercise(ex, difficulty) {
    if (ex.fixed) return ex.fixed;
    return ex.label ? ex.label + ' (' + MOVEMENT_VARIANTS[ex.movement][difficulty || 'standard'] + ')' : MOVEMENT_VARIANTS[ex.movement][difficulty || 'standard'];
  }
  function questTrackById(id) { return QUEST_TRACKS.filter(function (t) { return t.id === id; })[0] || null; }
  function questTrackTotalSessions(track) { return track.weeks * track.sessionsPerWeek; }

  // Removes any calendar placements the currently-active track scheduled --
  // needed before both stopping and (re)starting a track, otherwise
  // restarting/switching leaves the old placements sitting in
  // sideQuestCalendar untouched while scheduleActiveQuestTrack just finds
  // new empty slots for the new run, silently doubling up stale entries
  // (confirmed live: 8 real placements became 16 after one restart).
  function clearScheduledQuestTrackCalendar() {
    var active = state.activeQuestTrack;
    if (!active || !active.scheduledMissionKeys) return;
    Object.keys(active.scheduledMissionKeys).forEach(function (key) {
      if (state.sideQuestCalendar && state.sideQuestCalendar[key] === active.scheduledMissionKeys[key]) {
        delete state.sideQuestCalendar[key];
      }
    });
  }

  function startQuestTrack(trackId, difficulty) {
    var domainTrack = SideQuestDomain.questTrackById && SideQuestDomain.questTrackById(trackId);
    var gate = SideQuestDomain.canStartSideQuest ? SideQuestDomain.canStartSideQuest(state, trackId) : { ok: true };
    if (!gate.ok) {
      showToast('Finish or stop your active Mission Track before starting another track.');
      return false;
    }
    clearScheduledQuestTrackCalendar();
    if (domainTrack) {
      state.activeQuestTrack = {
        trackId: trackId,
        difficulty: difficulty || 'base',
        startedDate: dateToISO(new Date()),
        completedSessions: 0,
        scheduledMissionKeys: {}
      };
      scheduleActiveQuestTrack(new Date());
    } else {
      state.activeQuestTrack = { trackId: trackId, difficulty: difficulty || 'standard', startedDate: dateToISO(new Date()), completedSessions: 0 };
    }
    saveState(state);
    return true;
  }
  function stopQuestTrack() {
    clearScheduledQuestTrackCalendar();
    state.activeQuestTrack = null;
    saveState(state);
  }
  // Reuses the same sideQuestLog ledger the single-session quests use, so
  // the Progress panel's existing "Side quests completed" count picks up
  // quest-track sessions automatically -- no separate ledger to keep in sync.
  function completeQuestTrackSession(key) {
    var active = state.activeQuestTrack;
    var domainTrack = active && SideQuestDomain.questTrackById && SideQuestDomain.questTrackById(active.trackId);
    if (domainTrack) {
      var domainTotal = SideQuestDomain.questTrackTotalMissions(domainTrack);
      if (active.completedSessions >= domainTotal) return;
      var missionId = domainTrack.missionIds[active.completedSessions] || domainTrack.missionIds[domainTrack.missionIds.length - 1];
      var mission = SideQuestDomain.missionById(missionId);
      active.completedSessions++;
      state.sideQuestLog.push({
        id: missionId,
        trackId: domainTrack.id,
        key: null,
        date: dateToISO(new Date()),
        category: mission ? mission.category : domainTrack.category,
        rewardPoints: mission ? mission.xpReward : 80,
        relationship: mission ? mission.relationshipLabel : 'Supports your Main Quest'
      });
      awardSideMissionXp('sidemission|' + domainTrack.id + '|' + missionId + '|' + dateToISO(new Date()), mission ? mission.xpReward : 80, { key: key });
      if (key && state.sideQuestCalendar[key] === missionId) delete state.sideQuestCalendar[key];
      if (active.completedSessions >= domainTotal) {
        state.completedQuestTracks.push({ trackId: domainTrack.id, date: dateToISO(new Date()), badgeId: 'strong_runner' });
        if (state.badges.indexOf('Strong Runner') === -1) state.badges.push('Strong Runner');
      }
      saveState(state);
      refreshPathProgress();
      return;
    }
    var track = active && questTrackById(active.trackId);
    if (!track) return;
    var total = questTrackTotalSessions(track);
    if (active.completedSessions >= total) return;
    active.completedSessions++;
    state.sideQuestLog.push({ id: track.id + '-session-' + active.completedSessions, key: null, date: dateToISO(new Date()), category: 'strength', rewardPoints: 40 });
    awardSideMissionXp('sidemission|' + track.id + '|session' + active.completedSessions, 40, { key: key });
    saveState(state);
    refreshPathProgress();
  }

  function missionById(id) {
    return SideQuestDomain.missionById ? SideQuestDomain.missionById(id) : SIDE_QUESTS.filter(function (q) { return q.id === id; })[0] || null;
  }

  function completionCategory(mission) {
    if (!mission) return 'quest';
    return mission.category || mission.subcategory || 'quest';
  }

  function completeMission(missionId, key, feedback) {
    var mission = missionById(missionId);
    if (!mission) return false;
    state.sideQuestLog.push({
      id: mission.id,
      key: key || null,
      date: dateToISO(new Date()),
      category: completionCategory(mission),
      rewardPoints: mission.xpReward || mission.rewardPoints || 0,
      relationship: mission.relationshipLabel || '',
      difficulty: feedback && feedback.difficulty || null,
      pain: feedback && feedback.pain || null
    });
    var xpResult = awardSideMissionXp('sidemission|' + mission.id + '|' + (key || 'none') + '|' + dateToISO(new Date()), mission.xpReward || mission.rewardPoints || 0, { key: key });
    if (mission.badgeId && state.badges.indexOf(mission.badgeId) === -1) state.badges.push(mission.badgeId);
    if (key && state.sideQuestCalendar[key] === mission.id) delete state.sideQuestCalendar[key];
    saveState(state);
    refreshPathProgress();
    showToast('Side Mission complete: ' + mission.name + '.' + xpToastSuffix(xpResult));
    return true;
  }

  function buildCurrentWeeks() {
    if (!state.raceGoal || !state.profile || !state.planMeta) return [];
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return generateAll(state.profile, state.raceGoal, state.planMeta, state.logs, today).weeks;
  }

  function findCalendarDayByKey(key, weeks) {
    var parts = String(key || '').split('-');
    var weekNum = parseInt(parts[0], 10), dayIdx = parseInt(parts[1], 10);
    if (!weekNum || isNaN(dayIdx)) return null;
    var week = weeks[weekNum - 1];
    return week && week.days[dayIdx] ? { week: week, day: week.days[dayIdx], dayIdx: dayIdx, key: key } : null;
  }

  function addMissionToCalendar(missionId, key) {
    var mission = missionById(missionId);
    var weeks = buildCurrentWeeks();
    var found = findCalendarDayByKey(key, weeks);
    if (!mission || !found) return { ok: false, reason: 'missing' };
    var classInfo = SideQuestDomain.workoutClassification ? SideQuestDomain.workoutClassification(found.day.type, found.day.label) : { classification: 'movable' };
    var subValue = SideQuestDomain.substitutionValue ? SideQuestDomain.substitutionValue(found.day.type, mission) : 'complementary';
    var conflict = SideQuestDomain.detectCalendarConflict ? SideQuestDomain.detectCalendarConflict(mission, found.dayIdx, found.week.days) : { ok: true };
    if (classInfo.classification === 'protected' && subValue === 'full_replacement') return { ok: false, reason: 'protected' };
    if (!conflict.ok) return conflict;
    state.sideQuestCalendar[key] = mission.id;
    saveState(state);
    return { ok: true, reason: null };
  }

  function scheduleActiveQuestTrack(startDate) {
    if (!state.activeQuestTrack || !SideQuestDomain.questTrackById) return;
    var track = SideQuestDomain.questTrackById(state.activeQuestTrack.trackId);
    if (!track) return;
    var weeks = buildCurrentWeeks();
    var missionIdx = 0;
    state.sideQuestCalendar = state.sideQuestCalendar || {};
    weeks.forEach(function (week) {
      if (missionIdx >= track.missionIds.length) return;
      var placedThisWeek = 0;
      week.days.forEach(function (day, di) {
        if (missionIdx >= track.missionIds.length || placedThisWeek >= track.missionsPerWeek) return;
        var mission = missionById(track.missionIds[missionIdx]);
        var date = dateForSlot(parseDate(state.raceGoal.raceDate), state.planMeta.planLengthWeeks, week.weekNum, di);
        if (startDate && date < startDate) return;
        if (day.type !== 'rest' && day.type !== 'easy' && day.type !== 'cross') return;
        var conflict = SideQuestDomain.detectCalendarConflict ? SideQuestDomain.detectCalendarConflict(mission, di, week.days) : { ok: true };
        if (!conflict.ok) return;
        var key = week.weekNum + '-' + di;
        if (state.sideQuestCalendar[key]) return;
        state.sideQuestCalendar[key] = mission.id;
        state.activeQuestTrack.scheduledMissionKeys[key] = mission.id;
        missionIdx++;
        placedThisWeek++;
      });
    });
  }

  // ── Weekly Challenges (docs/Runner_SideQuest_Spec.md §2B) ───────────────
  // Session-COUNT targets within the current Mon-Sun week, not raw rep/
  // distance totals (those need per-log quantity tracking sideQuestLog
  // doesn't have yet). Progress is always computed from the existing log,
  // never stored separately -- it can't drift out of sync.
  var WEEKLY_CHALLENGES = [
    { id: 'weekly_strength_3', name: '3 Strength Sessions', description: 'Complete 3 strength-category sessions this week.', target: 3, matchCategories: ['strength'] },
    { id: 'weekly_quests_5', name: '5 Side Missions This Week', description: 'Complete any 5 Side Missions this week.', target: 5, matchCategories: null },
    { id: 'weekly_hike_2', name: '2 Hikes This Week', description: 'Log 2 hikes this week.', target: 2, matchCategories: ['hike'] },
    { id: 'weekly_core_3', name: '3 Core/Mobility Sessions', description: 'Complete 3 core or mobility sessions this week.', target: 3, matchCategories: ['core', 'mobility'] }
  ];
  function weeklyChallengeById(id) { return WEEKLY_CHALLENGES.filter(function (c) { return c.id === id; })[0] || null; }
  function weeklyChallengeProgress(challenge, weekStartIso) {
    var weekStart = parseDate(weekStartIso);
    var weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
    var count = state.sideQuestLog.filter(function (entry) {
      var d = parseDate(entry.date);
      if (d < weekStart || d > weekEnd) return false;
      return !challenge.matchCategories || challenge.matchCategories.indexOf(entry.category) !== -1;
    }).length;
    return Math.min(count, challenge.target);
  }
  // Clears a challenge that's rolled past its own week -- no silent carry-over.
  function expireWeeklyChallengeIfStale() {
    var active = state.activeWeeklyChallenge;
    if (!active) return;
    var todayMonday = dateToISO(mondayOfWeek(new Date()));
    if (todayMonday !== active.weekStartIso) { state.activeWeeklyChallenge = null; saveState(state); }
  }
  function startWeeklyChallenge(challengeId) {
    state.activeWeeklyChallenge = { challengeId: challengeId, weekStartIso: dateToISO(mondayOfWeek(new Date())) };
    saveState(state);
  }
  function dropWeeklyChallenge() {
    state.activeWeeklyChallenge = null;
    saveState(state);
  }

  // ── Boredom detection / Variety Week suggestion (§6/§7) ─────────────────
  // A plain weekly feeling check-in -- deliberately separate from physical
  // fatigue/pain, which are already handled elsewhere (painGuidance, the AI
  // coach's fatigue triage). Only mental staleness (bored/dreading) two
  // weeks running suggests a Variety Week; exhausted/pain are recorded but
  // never trigger it, matching the spec's own boredom-vs-fatigue split.
  var RUNNING_FEELINGS = ['excited', 'fine', 'neutral', 'bored', 'dreading', 'exhausted', 'pain'];
  var RUNNING_FEELING_LABEL = {
    excited: 'Excited', fine: 'Fine', neutral: 'Neutral', bored: 'Getting bored',
    dreading: 'Dreading it', exhausted: 'Physically exhausted', pain: 'In pain'
  };
  function currentWeekFeelingEntry() {
    var weekStartIso = dateToISO(mondayOfWeek(new Date()));
    return state.runningFeelingLog.filter(function (e) { return e.weekStartIso === weekStartIso; })[0] || null;
  }
  function saveRunningFeeling(feeling) {
    var weekStartIso = dateToISO(mondayOfWeek(new Date()));
    var existing = state.runningFeelingLog.filter(function (e) { return e.weekStartIso === weekStartIso; })[0];
    if (existing) existing.feeling = feeling;
    else state.runningFeelingLog.push({ weekStartIso: weekStartIso, feeling: feeling });
    saveState(state);
  }
  // The two most recent DISTINCT weeks on record, both bored/dreading.
  function varietyWeekSuggested() {
    var sorted = state.runningFeelingLog.slice().sort(function (a, b) { return a.weekStartIso < b.weekStartIso ? 1 : -1; });
    if (sorted.length < 2) return false;
    var isStale = function (e) { return e.feeling === 'bored' || e.feeling === 'dreading'; };
    return isStale(sorted[0]) && isStale(sorted[1]);
  }

  // Replaces the old boolean `done` flag on a log entry -- lets the weekly
  // row and post-run review show *how* a workout was completed, not just
  // whether it was. `coach_alternative` and `rescheduled` from the source
  // spec are deliberately not separate values here: a coach-approved swap
  // already shows up via state.overrides/sideQuestLog, and a reschedule via
  // the existing inline label-edit -- adding overlapping status values for
  // those would just be two ways to represent the same fact.
  var COMPLETION_TYPES = ['planned', 'modified', 'partial', 'stopped_early'];
  var COMPLETION_TYPE_LABEL = { planned: 'Completed as planned', modified: 'Modified', partial: 'Partially completed', stopped_early: 'Stopped early' };

  var PAIN_LOCATIONS = ['Foot', 'Ankle', 'Shin', 'Knee', 'Hip', 'Hamstring', 'Calf', 'Back', 'Other'];
  // Never diagnoses -- only routes toward "keep going / back off / get it checked."
  function painGuidance(severity, worsens, canWalk) {
    if (severity >= 7 || (worsens && !canWalk)) {
      return { level: 'urgent', text: "This sounds like it needs a professional evaluation before you keep training. Consider resting from running until you've been checked out." };
    }
    if (severity >= 4 && worsens) {
      return { level: 'caution', text: "Consider replacing today's run with cross-training or rest, and keep an eye on it. If it's still there in a few days or gets worse, get it checked out." };
    }
    return { level: 'mild', text: 'Mild and not worsening — okay to continue cautiously, but back off if anything changes.' };
  }

  function isRest(label) { return /^rest\b/i.test(label.trim()); }
  function isLoggable(label) { return !isRest(label); }
  function isRace(label) { return !!RACE_LABEL_SET[label.trim().toLowerCase()]; }
  function hasCross(label) { return /\bcross\b/i.test(label); }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function round5(n) { return Math.round(n * 2) / 2; }
  function round1(n) { return Math.round(n * 10) / 10; }

  // Distances are always stored internally in miles; convert only at the
  // input/display boundary so the generator's tables never need two versions.
  var KM_PER_MI = 1.60934;
  function unitLabel() { return state.units === 'km' ? 'km' : 'mi'; }
  function toUnit(mi) { return state.units === 'km' ? round1(mi * KM_PER_MI) : mi; }
  function fromUnit(displayVal) { return state.units === 'km' ? displayVal / KM_PER_MI : displayVal; }
  function terrainNoteFrom(terrains) {
    var extra = (terrains || []).filter(function (t) { return t !== 'road'; }).map(function (t) { return TERRAIN_LABEL[t]; });
    return extra.length ? extra.join('/') : null;
  }
  function formatLongRunLabel(miles, terrainNote) {
    // fueling-practice threshold is a duration estimate, so it's computed from the
    // internal mile value (11 min/mi assumption) regardless of the display unit
    return toUnit(miles) + ' ' + unitLabel() + ' long run' + (terrainNote ? ' (' + terrainNote + ')' : '') + (miles * 11 >= 90 ? ' + fueling practice' : '');
  }
  function formatEasyRunLabel(miles) { return toUnit(miles) + ' ' + unitLabel() + ' easy run'; }

  // ── Pace guidance from a real recent race result (roadmap §10) ─────────
  // Only ever surfaced when the runner actually supplied a recent race
  // distance + time -- otherwise pace guidance stays RPE/talk-test-only
  // everywhere else in the app. Never a single falsely-precise number: a
  // wide, clearly-labeled range, since one data point can't support more
  // than that (§4.5).
  var RACE_DISTANCE_MILES = { '5k': 3.10686, '10k': 6.21371, half: 13.10938, marathon: 26.21875 };
  // mm:ss or h:mm:ss (races 10K and up are commonly reported with an hour part).
  function parseRaceTimeToMinutes(str) {
    if (!str) return null;
    var m = str.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    var hours = m[1] ? parseInt(m[1], 10) : 0;
    var mins = parseInt(m[2], 10), secs = parseInt(m[3], 10);
    return hours * 60 + mins + secs / 60;
  }
  function formatPace(secPerMi) {
    var m = Math.floor(secPerMi / 60), s = Math.round(secPerMi % 60);
    if (s === 60) { m++; s = 0; }
    return m + ':' + String(s).padStart(2, '0');
  }
  // Actual-run duration input, same mm:ss / h:mm:ss shape as
  // parseRaceTimeToMinutes but returns whole seconds (not minutes) since
  // that's the natural unit for a logged run's elapsed time and for the
  // pace math below -- kept as a separate function rather than reusing
  // parseRaceTimeToMinutes directly so the two independent input surfaces
  // (recent race result vs. a logged run) can't accidentally couple.
  function parseDurationToSeconds(str) {
    if (!str) return null;
    var m = str.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    var hours = m[1] ? parseInt(m[1], 10) : 0;
    var mins = parseInt(m[2], 10), secs = parseInt(m[3], 10);
    return hours * 3600 + mins * 60 + secs;
  }
  // pace = duration / distance (spec's own formula) -- null on zero/missing
  // distance or an unparseable duration, never a divide-by-zero or NaN pace.
  function computeActualPaceSecPerMi(distanceMiles, durationSeconds) {
    if (!distanceMiles || distanceMiles <= 0 || !durationSeconds) return null;
    return durationSeconds / distanceMiles;
  }
  // Projects the runner's real result onto an equivalent time at any other
  // distance via Riegel's race-time-prediction formula (T2 = T1*(D2/D1)^1.06
  // -- a standard, openly-published exercise-science formula, not any
  // specific coach's proprietary calculator). Returns per-mile seconds at
  // `targetMiles`, or null if no valid recent race result exists.
  function computeEquivalentPaceSecPerMi(profile, targetMiles) {
    if (!profile || !profile.recentRaceDistance || !profile.recentRaceTime) return null;
    var fromMiles = RACE_DISTANCE_MILES[profile.recentRaceDistance];
    var raceMins = parseRaceTimeToMinutes(profile.recentRaceTime);
    if (!fromMiles || !raceMins) return null;
    var projectedMins = raceMins * Math.pow(targetMiles / fromMiles, 1.06);
    return (projectedMins * 60) / targetMiles;
  }
  // Easy/long-run pace: a conservative, widely used rule of thumb that this
  // effort runs well behind current 5K race pace. Returns per-mile seconds
  // regardless of display unit -- convert at render time the same way
  // distances do.
  function computeEasyPaceRange(profile) {
    var refSecPerMi = computeEquivalentPaceSecPerMi(profile, RACE_DISTANCE_MILES['5k']);
    if (!refSecPerMi) return null;
    return { loSecPerMi: Math.round(refSecPerMi + 90), hiSecPerMi: Math.round(refSecPerMi + 135) };
  }

  // Quality/interval pace zones -- matched by the same kind of label
  // substring the calendar already uses (see CALENDAR_HINTS/calendarHint).
  // Deliberately excludes effort-based work (Fartlek, hill repeats) since
  // those are "by feel," never a pace target, per GLOSSARY_WORKOUTS/roadmap
  // §10. "threshold" has no single real race distance behind it, so it's
  // approximated as the midpoint between equivalent 10K and half-marathon
  // pace -- a common, generic coaching rule of thumb, not a precise value;
  // still surfaced only as a range, same as everywhere else pace shows up.
  var QUALITY_PACE_ZONE_MATCHERS = [
    ['@ 5K pace', '5k'], ['@ 5K effort', '5k'],
    ['@ 10K pace', '10k'], ['@ 10K effort', '10k'],
    ['@ half-marathon pace', 'half'],
    ['@ marathon pace', 'marathon'],
    ['threshold', 'threshold'], ['Tempo', 'threshold']
  ];
  var QUALITY_PACE_ZONE_LABEL = { '5k': '5K', '10k': '10K', half: 'half-marathon', marathon: 'marathon', threshold: 'threshold' };

  function paceZoneForLabel(label) {
    for (var i = 0; i < QUALITY_PACE_ZONE_MATCHERS.length; i++) {
      if (label.indexOf(QUALITY_PACE_ZONE_MATCHERS[i][0]) !== -1) return QUALITY_PACE_ZONE_MATCHERS[i][1];
    }
    return null;
  }
  function computeZonePaceSecPerMi(profile, zone) {
    if (zone === 'threshold') {
      var tenK = computeEquivalentPaceSecPerMi(profile, RACE_DISTANCE_MILES['10k']);
      var half = computeEquivalentPaceSecPerMi(profile, RACE_DISTANCE_MILES.half);
      if (!tenK || !half) return null;
      return (tenK + half) / 2;
    }
    if (!RACE_DISTANCE_MILES[zone]) return null;
    return computeEquivalentPaceSecPerMi(profile, RACE_DISTANCE_MILES[zone]);
  }
  // A narrower band than easy/long's -- these are already a specific goal
  // pace named in the label itself, not a broad effort zone -- but still a
  // range, never one falsely-precise number.
  function computeQualityPaceRange(profile, label) {
    var zone = paceZoneForLabel(label);
    if (!zone) return null;
    var refSecPerMi = computeZonePaceSecPerMi(profile, zone);
    if (!refSecPerMi) return null;
    return { zone: zone, loSecPerMi: Math.round(refSecPerMi - 8), hiSecPerMi: Math.round(refSecPerMi + 8) };
  }
  // All named zones at once, for contexts (the AI coach) that need to match
  // a zone against whichever day's label comes up, not just one known day.
  function computeAllQualityPaceZones(profile) {
    var out = {};
    ['5k', '10k', 'half', 'marathon', 'threshold'].forEach(function (zone) {
      var ref = computeZonePaceSecPerMi(profile, zone);
      if (ref) out[zone] = [Math.round(ref - 8), Math.round(ref + 8)];
    });
    return Object.keys(out).length ? out : null;
  }

  // ── State ──────────────────────────────────────────────────────────────
  function loadState() {
    var s = null;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) {}
    if (!s) s = {};
    if (!s.userName) s.userName = '';
    if (!s.units) s.units = 'mi';
    if (!s.unavailable) s.unavailable = []; // [{ start, end, reason }] -- illness/vacation mode
    if (!s.raceGoal) s.raceGoal = null; // { event, raceDate, goal }
    if (!s.profile) s.profile = null;
    if (!s.planMeta) s.planMeta = null; // { level, weeksAvailable, planLengthWeeks, unsafe, warnings }
    if (!s.logs) s.logs = {};
    if (!s.overrides) s.overrides = {};
    if (!s.crossType) s.crossType = {};
    if (!s.notifications) s.notifications = { enabled: false }; // opt-in, never on by default
    if (!s.sideQuestLog) s.sideQuestLog = []; // [{ id, key, date, category, rewardPoints }]
    if (s.activeQuestTrack === undefined) s.activeQuestTrack = null; // { trackId, difficulty, startedDate, completedSessions }
    if (s.activeWeeklyChallenge === undefined) s.activeWeeklyChallenge = null; // { challengeId, weekStartIso }
    if (!s.sideQuestOnboarding) s.sideQuestOnboarding = null; // { completed, strengthExperience, equipment, preferredDuration, interest, limitations }
    if (!s.sideQuestCalendar) s.sideQuestCalendar = {}; // { dayKey: missionId }
    if (!s.completedQuestTracks) s.completedQuestTracks = []; // [{ trackId, date, badgeId }]
    if (!s.badges) s.badges = [];
    if (!s.path) s.path = null; // { id, mainQuestId, currentNodeId, nodeIds }
    if (!s.pathNodes) s.pathNodes = [];
    if (!s.xp) s.xp = 0; // derived -- always recomputed from xpEvents by awardXp()/mergeRunnerState, never incremented directly
    if (!s.xpEvents) s.xpEvents = []; // [{ idempotencyKey, source, xpType, baseXp, modifier, totalXp, date, key }]
    if (!s.xpProfile) s.xpProfile = { lastLevelUpAt: null, selectedProfileTitle: null, selectedPathTheme: null, selectedBadgeFrame: null };
    if (!s.runningFeelingLog) s.runningFeelingLog = []; // [{ weekStartIso, feeling }]
    if (!s.lastModified) s.lastModified = 0;
    return s;
  }
  function saveState(state) {
    state.lastModified = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!_skipCloudPush && CloudSync.isSignedIn) {
      clearTimeout(_cloudPushTimer);
      _cloudPushTimer = setTimeout(function () { CloudSync.push(); }, 5000);
    }
  }

  // logs[key] is a structured entry ({time, distance, effort, notes}) but may still be
  // a bare string for anything saved before logging fields existed — normalize on read.
  function getLog(key) {
    var v = state.logs[key];
    if (!v) return null;
    if (typeof v === 'string') return { time: v };
    return v;
  }
  function setLog(key, patch) {
    var next = Object.assign({}, getLog(key), patch);
    var hasContent = !!(next.time || next.distance || next.effort || next.notes || next.pain || next.completionType);
    if (hasContent) state.logs[key] = next;
    else delete state.logs[key];
    saveState(state);
  }

  // ── Completion celebration -- personal bests get an AI-phrased note, everything else gets a quick local one ──
  // "TIME" is free text (e.g. "32:10" or plain minutes), so this is a lenient
  // parse, not strict validation -- unparseable values just skip milestone
  // detection rather than blocking the log.
  function parseTimeToMinutes(str) {
    if (!str) return null;
    var m = str.trim().match(/^(\d+):(\d{1,2})$/);
    if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
    var n = parseFloat(str);
    return isNaN(n) ? null : n;
  }

  function pastRunStats(weeks, excludeKey, type) {
    var stats = [];
    weeks.forEach(function (wk) {
      wk.days.forEach(function (dd, di) {
        var k = wk.weekNum + '-' + di;
        if (k === excludeKey || dd.type !== type) return;
        var e = getLog(k);
        if (!e || e.distance == null || !e.time) return;
        var mins = parseTimeToMinutes(e.time);
        if (!mins) return;
        stats.push({ distance: e.distance, pace: mins / e.distance });
      });
    });
    return stats;
  }

  // Only meaningful for actual runs (not cross/rest/race) with both a
  // distance and a parseable time logged -- compared only against the same
  // structural type, since an easy day's deliberately slow pace isn't a fair
  // comparison against a quality day's.
  function checkForMilestone(key, dayType, entry, weeks) {
    if (['easy', 'long', 'quality'].indexOf(dayType) === -1) return null;
    if (entry.distance == null || !entry.time) return null;
    var mins = parseTimeToMinutes(entry.time);
    if (!mins) return null;
    var pace = mins / entry.distance;
    var past = pastRunStats(weeks, key, dayType);
    if (!past.length) return null; // first one of this type ever -- a baseline, not a "best"

    if (dayType === 'long') {
      var maxDist = past.reduce(function (m, s) { return Math.max(m, s.distance); }, 0);
      if (entry.distance > maxDist) {
        return { kind: 'longest_run', distance: toUnit(entry.distance), previousBest: toUnit(maxDist), unit: unitLabel() };
      }
    }
    var bestPace = past.reduce(function (m, s) { return Math.min(m, s.pace); }, Infinity);
    if (pace < bestPace) {
      return { kind: 'fastest_pace', workoutType: dayType, distance: toUnit(entry.distance), unit: unitLabel(), paceMinPerUnit: Math.round(pace * 100) / 100 };
    }
    return null;
  }

  // Deterministic (no AI call) comparison of a logged run against the day's
  // own planned distance / target pace range -- satisfies the "coach
  // interpretation" requirement from docs/RACR_RunLogging_Correction.md
  // without a new AI dependency, matching this app's established
  // deterministic-first pattern (see logAndCelebrate's local-message
  // fallback and the SIDE_QUESTS reason-based filtering).
  function interpretRunResult(dayData, entry, targetPaceRange) {
    if (!entry || (entry.distance == null && !entry.time)) return null;
    var distanceRatio = (dayData.miles && entry.distance != null) ? entry.distance / dayData.miles : null;
    var actualPace = computeActualPaceSecPerMi(entry.distance, parseDurationToSeconds(entry.time));
    var paceFast = !!(targetPaceRange && actualPace && actualPace < targetPaceRange.loSecPerMi - 5);
    var paceSlow = !!(targetPaceRange && actualPace && actualPace > targetPaceRange.hiSecPerMi + 5);
    var paceInRange = !!(targetPaceRange && actualPace && !paceFast && !paceSlow);

    if (distanceRatio != null && distanceRatio < 0.85) {
      return 'You came up short of the planned distance -- a partial session still counts toward your training, just keep an eye on why (time, fatigue, or how you felt).';
    }
    if (distanceRatio != null && distanceRatio > 1.3 && (dayData.type === 'easy' || dayData.type === 'long')) {
      return "You ran notably farther than planned. That's fine as a one-off, but keep an eye on cumulative fatigue if it becomes a pattern -- especially heading into a key workout.";
    }
    if (paceFast && (dayData.type === 'easy' || dayData.type === 'long')) {
      return "You ran faster than the target range for this effort. That's fine occasionally, but easy days work best when they stay easy -- save the faster pace for your key workouts.";
    }
    if (paceFast && dayData.type === 'quality') {
      return 'You pushed faster than the target zone for this workout. Strong effort -- just make sure it was sustainable, not an all-out sprint.';
    }
    if (paceSlow && dayData.type === 'quality') {
      return "You didn't quite reach the target pace zone for this workout. It still counts -- fatigue, conditions, or an off day can all explain it.";
    }
    // A slower-than-range easy/long pace is never flagged -- easy days are
    // meant to be conservative, and the range is a floor to avoid, not a
    // ceiling to hit (matches the spec's "don't reward beating the pace
    // target on easy days" rule from the other direction).
    if (distanceRatio != null && distanceRatio >= 0.85 && paceInRange) {
      return 'You completed the intended work and kept the effort inside the assigned target. No adjustment needed.';
    }
    if (distanceRatio != null && distanceRatio >= 0.85) {
      return 'You covered the intended distance for this session.';
    }
    return 'Logged -- nice work keeping track of the actual result.';
  }

  var CELEBRATE_MESSAGES = [
    'Logged — nice work.',
    "Another one in the books, keep it up.",
    'Showing up consistently is what actually builds fitness.',
    'Done and dusted. Great job today.'
  ];
  var _celebrateMsgIdx = 0;

  function showToast(text) {
    var existing = document.querySelector('.app-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'app-toast';
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(function () { toast.classList.add('app-toast--out'); }, 3200);
    setTimeout(function () { toast.remove(); }, 3700);
  }

  // ── XP awarding (docs/RACR_Reward_System_Master_Prompt.md, Phase 1) ──
  // The one place state.xpEvents/state.xp/state.xpProfile get written.
  // Upserts by idempotencyKey -- honest re-edits (re-saving a day after
  // changing effort/completionType, or re-completing the same Side Mission
  // slot) correct that one ledger entry instead of farming a duplicate.
  // source:'side_mission' additionally clamps through the weekly cap before
  // being recorded; state.xp is always the ledger's own sum afterward, never
  // an independently-incremented counter (see mergeRunnerState's comment on
  // why that matters for cross-device merges).
  function awardXp(idempotencyKey, source, xpType, baseXp, modifier, meta) {
    var totalXp = Math.round((baseXp || 0) * (modifier != null ? modifier : 1));

    if (source === 'side_mission') {
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var weekStart = mondayOfWeek(today);
      var weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
      var thisWeekEvents = state.xpEvents.filter(function (e) {
        if (e.idempotencyKey === idempotencyKey) return false; // exclude the entry being replaced, if any
        var d = parseDate(e.date);
        return d >= weekStart && d <= weekEnd;
      });
      var sideMissionSoFar = thisWeekEvents.filter(function (e) { return e.source === 'side_mission'; })
        .reduce(function (sum, e) { return sum + (e.totalXp || 0); }, 0);
      var mainQuestThisWeek = thisWeekEvents.filter(function (e) { return e.source === 'main_quest'; })
        .reduce(function (sum, e) { return sum + (e.totalXp || 0); }, 0);
      if (XpDomain.applySideMissionWeeklyCap) {
        totalXp = XpDomain.applySideMissionWeeklyCap(sideMissionSoFar, mainQuestThisWeek, totalXp);
      }
    }

    var event = {
      idempotencyKey: idempotencyKey, source: source, xpType: xpType,
      baseXp: baseXp || 0, modifier: modifier != null ? modifier : 1, totalXp: totalXp,
      date: dateToISO(new Date()), key: (meta && meta.key) || null
    };
    var idx = -1;
    for (var i = 0; i < state.xpEvents.length; i++) {
      if (state.xpEvents[i].idempotencyKey === idempotencyKey) { idx = i; break; }
    }
    if (idx === -1) state.xpEvents.push(event); else state.xpEvents[idx] = event;

    var levelBefore = XpDomain.levelForTotalXp ? XpDomain.levelForTotalXp(state.xp).level : 1;
    state.xp = state.xpEvents.reduce(function (sum, e) { return sum + (e.totalXp || 0); }, 0);
    var levelAfterInfo = XpDomain.levelForTotalXp ? XpDomain.levelForTotalXp(state.xp) : { level: levelBefore, rankTitle: '' };
    if (levelAfterInfo.level > levelBefore) state.xpProfile.lastLevelUpAt = Date.now();
    saveState(state);
    return { totalXp: totalXp, levelBefore: levelBefore, levelAfter: levelAfterInfo.level, rankTitle: levelAfterInfo.rankTitle };
  }

  // Thin wrapper shared by every Side Mission completion path (single-session
  // quests, quest-track sessions, the AI-chat substitute flow) -- unifies
  // what used to be three inconsistent `state.xp +=` lines (and one path,
  // applySideQuest, that never awarded XP at all) into one call.
  function awardSideMissionXp(idempotencyKey, baseXp, meta) {
    var calc = XpDomain.xpForSideMission ? XpDomain.xpForSideMission(baseXp) : { baseXp: baseXp || 0, modifier: 1 };
    return awardXp(idempotencyKey, 'side_mission', 'side_mission', calc.baseXp, calc.modifier, meta);
  }

  // Minimal Phase 1 surfacing of an awardXp() result -- appended to whichever
  // toast logAndCelebrate/completeMission were already going to show. The
  // full 8-step reward sequence (micro-wins/level bar/badge progress/Path
  // emphasis) is explicitly Phase 2+ work, not built here.
  function xpToastSuffix(xpResult) {
    if (!xpResult || !xpResult.totalXp) return '';
    var suffix = ' +' + xpResult.totalXp + ' XP';
    if (xpResult.levelAfter > xpResult.levelBefore) {
      suffix += ' · Level up! Now Level ' + xpResult.levelAfter + (xpResult.rankTitle ? ' — ' + xpResult.rankTitle : '');
    }
    return suffix;
  }

  // Shared by the quick calendar row, its done-checkbox, and the workout
  // detail Save button -- one place decides whether a log is an ordinary
  // completion (free local message) or an actual personal best (worth a
  // real AI-phrased note, since those are rare enough that the API call is
  // cheap and the moment deserves more than a canned line).
  function logAndCelebrate(key, patch, dayType, weeks, dayData, label) {
    setLog(key, patch);
    refreshPathProgress(weeks);
    var entry = getLog(key);
    if (!entry) return;

    var xpResult = null;
    if (dayData && XpDomain.xpForMainQuestWorkout) {
      var xpCalc = XpDomain.xpForMainQuestWorkout(dayData, label || dayData.label, entry.completionType);
      if (xpCalc.totalXp > 0) {
        xpResult = awardXp('mainquest|' + key, 'main_quest', xpCalc.xpType, xpCalc.baseXp, xpCalc.modifier, { key: key });
      }
    }
    var xpSuffix = xpToastSuffix(xpResult);

    var milestone = checkForMilestone(key, dayType, entry, weeks);
    if (milestone) {
      fetch('/.netlify/functions/celebrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact: milestone, plan: { event: state.raceGoal.event, goal: state.raceGoal.goal } })
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (result) {
        showToast(((result.ok && result.data.message) || 'That’s a personal best — nice work!') + xpSuffix);
      }).catch(function () {
        showToast('That’s a personal best — nice work!' + xpSuffix);
      });
    } else {
      showToast(CELEBRATE_MESSAGES[_celebrateMsgIdx % CELEBRATE_MESSAGES.length] + xpSuffix);
      _celebrateMsgIdx++;
    }
  }

  // ── Cloud sync (Supabase, fully optional -- app works entirely offline without it) ──
  var SUPABASE_URL = 'https://ssqdkituquloolgtlfpl.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_OGz777pTa7ISrm5J6xhZpQ_nCaVAROF';
  var _sbClient = null;
  function _sb() {
    if (!window.supabase) throw new Error('Supabase library failed to load');
    if (!_sbClient) _sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return _sbClient;
  }
  var _skipCloudPush = false;
  var _cloudPushTimer = null;

  // Same lastModified-wins-for-scalars / union-merge-for-collections pattern as
  // Conqur's CloudSync, adapted to this app's shape -- logs/overrides/crossType
  // are keyed by "weekNum-dayIdx" so they union the same way Conqur unions by id.
  function mergeRunnerState(local, remote) {
    var localNewer = (local.lastModified || 0) >= (remote.lastModified || 0);
    var prefer = localNewer ? local : remote;

    function mergeMap(localMap, remoteMap) {
      var out = {};
      Object.keys(localMap || {}).concat(Object.keys(remoteMap || {})).forEach(function (k) {
        if (out.hasOwnProperty(k)) return;
        var lv = (localMap || {})[k], rv = (remoteMap || {})[k];
        out[k] = (lv !== undefined && rv !== undefined) ? (localNewer ? lv : rv) : (lv !== undefined ? lv : rv);
      });
      return out;
    }

    var unavailableMap = {};
    (remote.unavailable || []).concat(local.unavailable || []).forEach(function (r) {
      unavailableMap[r.start + '|' + r.end + '|' + r.reason] = r;
    });

    var sideQuestMap = {};
    (remote.sideQuestLog || []).concat(local.sideQuestLog || []).forEach(function (r) {
      sideQuestMap[r.date + '|' + r.key + '|' + r.id] = r;
    });

    // Unlike unavailable/sideQuestLog (append-only), a week's feeling can be
    // overwritten via "Change" -- so this needs real last-write-wins per
    // week key, not just "whichever side happened to list it," hence
    // reusing mergeMap's local-newer-wins logic instead of a plain union.
    function toWeekMap(arr) {
      var out = {};
      (arr || []).forEach(function (e) { out[e.weekStartIso] = e; });
      return out;
    }
    var feelingMap = mergeMap(toWeekMap(local.runningFeelingLog), toWeekMap(remote.runningFeelingLog));

    // Same union-by-natural-key treatment as unavailable/sideQuestLog above --
    // these are append-only records too, never overwritten in place.
    var completedTracksMap = {};
    (remote.completedQuestTracks || []).concat(local.completedQuestTracks || []).forEach(function (r) {
      completedTracksMap[r.trackId + '|' + r.date] = r;
    });
    var badgesUnion = (local.badges || []).concat(remote.badges || []).filter(function (b, i, arr) { return arr.indexOf(b) === i; });
    // sideQuestCalendar is a plain dayKey->missionId map, same shape as
    // logs/overrides/crossType above -- reuse mergeMap directly.
    var sideQuestCalendarMerged = mergeMap(local.sideQuestCalendar, remote.sideQuestCalendar);
    var pathNodeMap = {};
    (remote.pathNodes || []).concat(local.pathNodes || []).forEach(function (n) {
      if (!n || !n.id) return;
      if (!pathNodeMap[n.id] || n.status === 'completed') pathNodeMap[n.id] = n;
    });

    // XP events are append-only and idempotency-keyed (docs/RACR_Reward_System_Master_Prompt.md
    // Phase 1) -- union by key like sideQuestLog/completedQuestTracks above,
    // not a scalar merge. `xp` itself is then recomputed as the ledger's sum
    // rather than merged independently, which is what actually fixes the
    // fragility the old scalar-xp merge (still shown further down) had to
    // work around: two devices earning XP offline can no longer silently
    // lose one side's events, since both sides' events survive the union.
    var xpEventMap = {};
    (remote.xpEvents || []).concat(local.xpEvents || []).forEach(function (e) {
      if (!e || !e.idempotencyKey) return;
      xpEventMap[e.idempotencyKey] = e;
    });
    var xpEventsMerged = Object.keys(xpEventMap).map(function (k) { return xpEventMap[k]; });
    var xpTotalFromLedger = xpEventsMerged.reduce(function (sum, e) { return sum + (e.totalXp || 0); }, 0);

    return {
      userName: prefer.userName,
      units: prefer.units,
      notifications: prefer.notifications || { enabled: false },
      activeQuestTrack: prefer.activeQuestTrack !== undefined ? prefer.activeQuestTrack : null,
      activeWeeklyChallenge: prefer.activeWeeklyChallenge !== undefined ? prefer.activeWeeklyChallenge : null,
      sideQuestOnboarding: prefer.sideQuestOnboarding !== undefined ? prefer.sideQuestOnboarding : null,
      sideQuestCalendar: sideQuestCalendarMerged,
      completedQuestTracks: Object.keys(completedTracksMap).map(function (k) { return completedTracksMap[k]; }),
      path: prefer.path || local.path || remote.path || null,
      pathNodes: Object.keys(pathNodeMap).map(function (k) { return pathNodeMap[k]; }),
      badges: badgesUnion,
      // Derived from xpEventsMerged above, not merged as its own scalar --
      // see the xpEventMap comment above for why this replaced the old
      // prefer-newer-scalar approach (kept working, but was a documented
      // known-fragile pattern, not one to extend further).
      xp: xpTotalFromLedger,
      xpEvents: xpEventsMerged,
      xpProfile: prefer.xpProfile || { lastLevelUpAt: null, selectedProfileTitle: null, selectedPathTheme: null, selectedBadgeFrame: null },
      raceGoal: prefer.raceGoal,
      profile: prefer.profile,
      planMeta: prefer.planMeta,
      logs: mergeMap(local.logs, remote.logs),
      overrides: mergeMap(local.overrides, remote.overrides),
      crossType: mergeMap(local.crossType, remote.crossType),
      unavailable: Object.keys(unavailableMap).map(function (k) { return unavailableMap[k]; }),
      sideQuestLog: Object.keys(sideQuestMap).map(function (k) { return sideQuestMap[k]; }),
      runningFeelingLog: Object.keys(feelingMap).map(function (k) { return feelingMap[k]; }),
      lastModified: Math.max(local.lastModified || 0, remote.lastModified || 0)
    };
  }

  var CloudSync = {
    _user: null,
    syncing: false,
    lastError: null,

    get isSignedIn() { return !!this._user; },
    get userEmail() { return this._user ? this._user.email : null; },
    get uid() { return this._user ? this._user.id : null; },

    async init() {
      if (!window.supabase) return; // CDN blocked/offline -- app still works fully offline
      try {
        var sessionRes = await _sb().auth.getSession();
        this._user = (sessionRes.data.session && sessionRes.data.session.user) || null;
        if (this._user) await this.pull();
      } catch (e) { this.lastError = String((e && e.message) || e); }
      _sb().auth.onAuthStateChange(function (_event, session) {
        var wasSignedIn = CloudSync.isSignedIn;
        CloudSync._user = (session && session.user) || null;
        if (!wasSignedIn && CloudSync.isSignedIn) CloudSync.pull();
        if (document.getElementById('accountSection')) renderSettings();
      });
    },

    async sendMagicLink(email) {
      try {
        var res = await _sb().auth.signInWithOtp({
          email: email,
          options: { emailRedirectTo: window.location.origin + window.location.pathname }
        });
        if (res.error) return { error: res.error.message };
        return {};
      } catch (e) { return { error: String((e && e.message) || e) }; }
    },

    async signOut() {
      try { await _sb().auth.signOut(); } catch (e) {}
      this._user = null;
    },

    async push() {
      if (!this.isSignedIn) return;
      this.syncing = true;
      try {
        var res = await _sb().from('user_data').upsert({
          user_id: this.uid,
          state_json: state,
          updated_at: new Date().toISOString()
        });
        this.lastError = res.error ? res.error.message : null;
      } catch (e) { this.lastError = String((e && e.message) || e); }
      this.syncing = false;
    },

    async pull() {
      if (!this.isSignedIn) return;
      this.syncing = true;
      try {
        var res = await _sb().from('user_data').select('state_json').eq('user_id', this.uid).maybeSingle();
        if (res.error) { this.lastError = res.error.message; this.syncing = false; return; }
        if (!res.data || !res.data.state_json) {
          // No cloud copy yet -- this device's local state becomes the first one.
          this.syncing = false;
          await this.push();
          return;
        }
        var merged = mergeRunnerState(state, res.data.state_json);
        _skipCloudPush = true;
        state = merged;
        saveState(state);
        _skipCloudPush = false;
        renderMain();
        await this.push();
      } catch (e) { this.lastError = String((e && e.message) || e); }
      this.syncing = false;
    },

    async deleteCloudData() {
      if (!this.isSignedIn) return { error: 'Not signed in' };
      try {
        var res = await _sb().from('user_data').delete().eq('user_id', this.uid);
        if (res.error) return { error: res.error.message };
        return {};
      } catch (e) { return { error: String((e && e.message) || e) }; }
    },

    // Full account deletion (not just the data row) -- needs the service-role
    // key, so it goes through a Netlify function rather than running here.
    async deleteAccountPermanently() {
      if (!this.isSignedIn) return { error: 'Not signed in' };
      try {
        var sessionRes = await _sb().auth.getSession();
        var token = sessionRes.data.session && sessionRes.data.session.access_token;
        if (!token) return { error: 'No active session' };
        var res = await fetch('/.netlify/functions/delete-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token })
        });
        var data = await res.json();
        if (!res.ok || data.error) return { error: (data && data.error) || 'Request failed' };
        await _sb().auth.signOut();
        this._user = null;
        return {};
      } catch (e) { return { error: String((e && e.message) || e) }; }
    }
  };

  // ── Google Health (formerly Fitbit) activity import, fully optional ──
  // Tokens are stored in their own localStorage key, deliberately NOT on
  // `state` -- so they never ride along in CloudSync's synced blob (per
  // user's explicit choice: this stays device-only, even when signed in).
  var GOOGLE_HEALTH_CLIENT_ID = '1024548053353-3u3n0g1hekthin8p39054bo2imbgds87.apps.googleusercontent.com';
  var GOOGLE_HEALTH_SCOPE = 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly';
  var GH_TOKEN_KEY = 'runner_google_health_tokens';
  var GH_OAUTH_STATE_KEY = 'runner_gh_oauth_state';

  function ghRedirectUri() { return window.location.origin + window.location.pathname; }
  function loadGHTokens() {
    try { return JSON.parse(localStorage.getItem(GH_TOKEN_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveGHTokens(tokens) { localStorage.setItem(GH_TOKEN_KEY, JSON.stringify(tokens)); }
  function clearGHTokens() { localStorage.removeItem(GH_TOKEN_KEY); }

  var GoogleHealth = {
    get isConnected() { return !!loadGHTokens(); },

    connect() {
      var oauthState = Math.random().toString(36).slice(2);
      sessionStorage.setItem(GH_OAUTH_STATE_KEY, oauthState);
      var params = new URLSearchParams({
        client_id: GOOGLE_HEALTH_CLIENT_ID,
        redirect_uri: ghRedirectUri(),
        response_type: 'code',
        scope: GOOGLE_HEALTH_SCOPE,
        access_type: 'offline',
        prompt: 'consent',
        state: oauthState
      });
      window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
    },

    disconnect() { clearGHTokens(); },

    // Handles the ?code=&state= redirect back from Google -- called once at
    // boot. Cleans the URL afterward either way so a refresh doesn't
    // re-trigger the exchange.
    async handleOAuthRedirect() {
      var url = new URL(window.location.href);
      var code = url.searchParams.get('code');
      var returnedState = url.searchParams.get('state');
      if (!code) return;
      var expectedState = sessionStorage.getItem(GH_OAUTH_STATE_KEY);
      sessionStorage.removeItem(GH_OAUTH_STATE_KEY);
      window.history.replaceState({}, '', ghRedirectUri());
      if (!expectedState || returnedState !== expectedState) return; // CSRF check failed -- silently drop

      try {
        var res = await fetch('/.netlify/functions/google-health-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code, redirect_uri: ghRedirectUri() })
        });
        var data = await res.json();
        if (!res.ok || data.error) return;
        saveGHTokens({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000
        });
      } catch (e) { /* silent -- Settings will just still show "not connected" */ }
    },

    async getValidAccessToken() {
      var tokens = loadGHTokens();
      if (!tokens) return null;
      if (tokens.expiresAt && Date.now() < tokens.expiresAt - 60000) return tokens.accessToken;
      try {
        var res = await fetch('/.netlify/functions/google-health-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken })
        });
        var data = await res.json();
        if (!res.ok || data.error) { clearGHTokens(); return null; }
        var next = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || tokens.refreshToken,
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000
        };
        saveGHTokens(next);
        return next.accessToken;
      } catch (e) { return null; }
    },

    // dateStr: 'YYYY-MM-DD'. Returns { sessions } or { error }.
    async fetchActivitiesForDate(dateStr) {
      var accessToken = await this.getValidAccessToken();
      if (!accessToken) return { error: 'Not connected' };
      try {
        var res = await fetch('/.netlify/functions/google-health-activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: accessToken, date: dateStr })
        });
        var data = await res.json();
        if (!res.ok || data.error) return { error: (data && data.error) || 'Request failed' };
        return { sessions: data.sessions || [] };
      } catch (e) { return { error: String((e && e.message) || e) }; }
    }
  };

  // ── Rule-based notifications (roadmap §18) ────────────────────────────
  // Deliberately local-only, no push server: this fires while the app/PWA is
  // open or briefly resumed in the background, never while fully closed --
  // an honest limitation of a local-first app with no backend to hold push
  // subscriptions. Every rule here is deterministic (never AI, per §18/§27)
  // and every kind is deduped in its own bookkeeping log so re-running this
  // constantly -- every render, plus a timer -- can't double-fire the same
  // real-world event twice.
  var NOTIF_LOG_KEY = 'runner_notif_log';
  function loadNotifLog() {
    try { return JSON.parse(localStorage.getItem(NOTIF_LOG_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveNotifLog(log) { localStorage.setItem(NOTIF_LOG_KEY, JSON.stringify(log)); }

  function showAppNotification(title, body, tag) {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(function (reg) {
      reg.showNotification(title, { body: body, tag: tag, icon: 'icons/icon-192.svg', badge: 'icons/icon-192.svg' });
    }).catch(function () {});
  }

  var Notifications = {
    get supported() { return 'Notification' in window && 'serviceWorker' in navigator; },
    get permission() { return this.supported ? Notification.permission : 'unsupported'; },

    async requestPermission() {
      if (!this.supported) return 'unsupported';
      return Notification.requestPermission();
    },

    // Called right when the user flips the Settings toggle on -- marks
    // "already seen" for anything that could otherwise dump a backlog of
    // stale-feeling notifications (e.g. a weekly recap from several weeks
    // ago) the moment permission is granted, without suppressing same-day
    // info like today's workout or the plan's current adjustment note.
    markBaseline() {
      if (!state.raceGoal || !state.planMeta) return;
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var raceDate = parseDate(state.raceGoal.raceDate);
      var currentWeekIdx = findCurrentWeekIdx(raceDate, state.planMeta.planLengthWeeks, today);
      var log = loadNotifLog();
      log.lastRecapNotifiedWeek = currentWeekIdx - 1;
      saveNotifLog(log);
    },

    // Runs on every app render/boot, plus a periodic timer while the tab or
    // installed PWA stays open. Every branch below is a plain rule over data
    // the plan engine already computed -- nothing here is AI-generated.
    check() {
      if (!state.notifications || !state.notifications.enabled) return;
      if (this.permission !== 'granted') return;
      if (!state.raceGoal || !state.profile || !state.planMeta) return;

      var today = new Date(); today.setHours(0, 0, 0, 0);
      var todayIso = dateToISO(today);
      var yesterday = new Date(today.getTime() - 86400000);
      var tomorrow = new Date(today.getTime() + 86400000);
      var raceDate = parseDate(state.raceGoal.raceDate);
      var planLengthWeeks = state.planMeta.planLengthWeeks;
      var result = generateAll(state.profile, state.raceGoal, state.planMeta, state.logs, today);
      var weeks = result.weeks;
      var log = loadNotifLog();
      var changed = false;

      var todayKey = null, todayLabel = null;
      var yesterdayKey = null, yesterdayLabel = null;
      var tomorrowLabel = null, tomorrowDay = null;
      weeks.forEach(function (wk) {
        wk.days.forEach(function (day, di) {
          var d = dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di);
          var key = wk.weekNum + '-' + di;
          var label = state.overrides[key] || day.label;
          if (sameDate(d, today)) { todayKey = key; todayLabel = label; }
          if (sameDate(d, yesterday)) { yesterdayKey = key; yesterdayLabel = label; }
          if (sameDate(d, tomorrow)) { tomorrowLabel = label; tomorrowDay = day; }
        });
      });
      var hour = new Date().getHours();

      // Today's workout reminder, or a gentle rest-day note -- evening only, once a day.
      if (todayKey && hour >= 17 && log.lastTodayNoteDate !== todayIso) {
        if (isLoggable(todayLabel)) {
          if (!getLog(todayKey)) showAppNotification("Today's run", "Haven't logged it yet: " + todayLabel + '.', 'today-reminder');
        } else {
          showAppNotification('Rest day', "Today's a scheduled rest day -- that's part of the plan, not a gap in it.", 'rest-reminder');
        }
        log.lastTodayNoteDate = todayIso;
        changed = true;
      }

      // Missed-workout check-in -- gentle, once per missed day, checked any time the day after.
      if (yesterdayKey && isLoggable(yesterdayLabel) && !getLog(yesterdayKey) && log.lastMissedCheckinDate !== todayIso) {
        showAppNotification('Yesterday', "Looks like yesterday's session didn't happen -- no problem. Tell the coach what's going on if you want the plan to adjust.", 'missed-checkin');
        log.lastMissedCheckinDate = todayIso;
        changed = true;
      }

      // Hydration/prep reminder for tomorrow's long run, evening before -- same >=90min
      // threshold buildStructuredWeeks already uses for the "+ fueling practice" label.
      if (tomorrowDay && tomorrowDay.type === 'long' && tomorrowDay.miles * 11 >= 90 && hour >= 17 && log.lastHydrationReminderDate !== todayIso) {
        showAppNotification('Tomorrow: long run', 'Hydrate today and lay out your gear -- ' + tomorrowLabel + '.', 'hydration-reminder');
        log.lastHydrationReminderDate = todayIso;
        changed = true;
      }

      // Race countdown -- fire once per milestone, not every day.
      var daysToRace = daysBetween(today, raceDate);
      if ([14, 7, 3, 1, 0].indexOf(daysToRace) !== -1) {
        var announcedCountdowns = log.announcedCountdowns || [];
        if (announcedCountdowns.indexOf(daysToRace) === -1) {
          var countdownText = daysToRace === 0 ? 'Race day is today.' : daysToRace + ' day' + (daysToRace === 1 ? '' : 's') + ' to race day.';
          showAppNotification('Race countdown', countdownText, 'race-countdown-' + daysToRace);
          announcedCountdowns.push(daysToRace);
          log.announcedCountdowns = announcedCountdowns;
          changed = true;
        }
      }

      // Plan-adjustment alert -- mirrors the in-app warning banner, fired once per distinct note.
      if (result.note && log.lastPlanAdjustmentNote !== result.note) {
        showAppNotification('Plan updated', result.note, 'plan-adjustment');
        log.lastPlanAdjustmentNote = result.note;
        changed = true;
      }

      // Return-after-break -- once per unavailable range, the day after it ends.
      (state.unavailable || []).forEach(function (r) {
        if (r.end !== dateToISO(yesterday)) return;
        var rangeId = r.start + '|' + r.end;
        var announcedBreaks = log.announcedBreakEnds || [];
        if (announcedBreaks.indexOf(rangeId) === -1) {
          showAppNotification('Welcome back', "Your plan's been adjusted for the time off -- today picks back up gently.", 'return-from-break');
          announcedBreaks.push(rangeId);
          log.announcedBreakEnds = announcedBreaks;
          changed = true;
        }
      });

      // Weekly recap ready -- once per week transition, not every render.
      var currentWeekIdx = findCurrentWeekIdx(raceDate, planLengthWeeks, today);
      if (currentWeekIdx > 1 && log.lastRecapNotifiedWeek !== currentWeekIdx - 1) {
        showAppNotification('Weekly recap ready', 'Week ' + (currentWeekIdx - 1) + ' wrapped up -- see how it went.', 'weekly-recap');
        log.lastRecapNotifiedWeek = currentWeekIdx - 1;
        changed = true;
      }

      // Variety Week suggestion -- once when two consecutive bored/dreading
      // check-ins first appear, not every render (dedup'd on the week key
      // itself, same as the other notifications above).
      var thisMonday = dateToISO(mondayOfWeek(today));
      if (varietyWeekSuggested() && log.lastVarietyWeekNotifiedWeek !== thisMonday) {
        showAppNotification('Consider a Variety Week', "You've mentioned feeling bored of running two weeks running -- check Side Missions for a change of pace.", 'variety-week');
        log.lastVarietyWeekNotifiedWeek = thisMonday;
        changed = true;
      }

      if (changed) saveNotifLog(log);
    }
  };

  var state = loadState();
  var didAutoScroll = false;
  var deferredInstallPrompt = null;
  // Coach chat is deliberately in-memory only -- resets on reload, never
  // synced/persisted. It's a live conversation about right now, not training
  // history worth backing up, and keeping it out of `state` avoids bloating
  // the synced state blob with chat transcripts.
  var coachHistory = [];
  var coachWaiting = false;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    var btn = document.getElementById('installBtn');
    if (btn) btn.style.display = 'inline-block';
  });
  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    var btn = document.getElementById('installBtn');
    if (btn) btn.style.display = 'none';
  });

  // ── Date helpers ───────────────────────────────────────────────────────
  function parseDate(iso) {
    var p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function dateToISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function daysBetween(a, b) {
    var A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    var B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((B - A) / 86400000);
  }
  function weeksBetween(today, raceDate) {
    // +1 because the plan must cover both endpoints (start day through race day
    // inclusive), not just the gap between them -- otherwise a start-to-race
    // span that's an exact multiple of 7 comes out one day short, and since
    // dateForSlot anchors the calendar to race day, the dropped day is the
    // first one: the runner's chosen start date.
    return Math.max(1, Math.ceil((daysBetween(today, raceDate) + 1) / 7));
  }
  function sameDate(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  // A plain Monday-anchored calendar week -- deliberately independent of the
  // race plan's race-day-anchored weeks (weeksBetween/dateForSlot). Weekly
  // challenges and the running-feeling check-in are a personal habit-tracking
  // week, not a training week.
  function mondayOfWeek(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var diff = (d.getDay() + 6) % 7; // 0 for Monday ... 6 for Sunday
    d.setDate(d.getDate() - diff);
    return d;
  }
  function fmtRange(d1, d2) {
    return MONTHS[d1.getMonth()] + ' ' + d1.getDate() + ' – ' + MONTHS[d2.getMonth()] + ' ' + d2.getDate();
  }

  // slot index within a week: 0..6, slot 6 always lands on the real race weekday
  function dateForSlot(raceDate, planLengthWeeks, week, slot) {
    var slotNum = (week - 1) * 7 + slot;
    var raceSlotNum = (planLengthWeeks - 1) * 7 + 6;
    var d = new Date(raceDate.getTime());
    d.setDate(d.getDate() + (slotNum - raceSlotNum));
    return d;
  }

  // ── Classification + safety ──────────────────────────────────────────
  function classifyUser(profile) {
    var freq = profile.runDaysPerWeek, mileage = profile.weeklyMileage;
    var computed;
    if (freq <= 2 || mileage < 8) computed = 'beginner';
    else if (freq === 3 && mileage < 20) computed = 'novice';
    else if (freq <= 5 && mileage < 40) computed = 'intermediate';
    else computed = 'advanced';
    var selfRank = LEVELS.indexOf(profile.experienceLevel);
    var compRank = LEVELS.indexOf(computed);
    var rank = Math.min(selfRank >= 0 ? selfRank : compRank, compRank);
    if (profile.recentInjury) rank = Math.min(rank, LEVELS.indexOf('novice'));
    return LEVELS[rank];
  }

  function evaluateSafety(event, weeksAvailable, level) {
    var cfg = EVENT_TABLE[event][level];
    var unsafe = weeksAvailable < cfg.minWeeks;
    var warnings = [];
    if (unsafe) {
      warnings.push('You have ' + weeksAvailable + ' week' + (weeksAvailable === 1 ? '' : 's') + ' until race day, but a safe ' + EVENT_LABEL[event] + ' build at your current level needs at least ' + cfg.minWeeks + '. This plan scales volume and long runs down to reduce injury risk given the shorter runway — consider a later race date or a shorter distance for a safer build.');
    }
    return { unsafe: unsafe, warnings: warnings };
  }

  function choosePlanLength(weeksAvailable, event, level) {
    var idealWeeks = EVENT_TABLE[event][level].idealWeeks;
    return Math.min(weeksAvailable, Math.round(idealWeeks * 1.6), 40);
  }

  // ── Weekly template: which of the 7 slots are long/quality/easy/cross/rest ──
  var RUN_SLOT_PRIORITY = [1, 3, 5, 0, 2, 4]; // Tue, Thu, Sat, Mon, Wed, Fri (slot 6 = long, fixed)
  function assignWeekTemplate(runDays, wantCross) {
    // capped at 5 (not 6) so one of the 6 non-long slots is always structurally
    // left as 'rest' below, satisfying the "at least one rest day" rule without
    // ever having to overwrite an already-assigned run day after the fact
    var additional = Math.max(0, Math.min(5, runDays - 1));
    var slots = ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'long'];
    var chosen = RUN_SLOT_PRIORITY.slice(0, additional);
    chosen.forEach(function (idx, i) { slots[idx] = i === 0 ? 'quality' : 'easy'; });
    var restPref = [4, 0, 2, 3, 5, 1];
    var restSlot = restPref.filter(function (i) { return slots[i] === 'rest'; })[0];
    for (var j = 0; j < 6; j++) {
      if (slots[j] === 'rest' && j !== restSlot && wantCross) slots[j] = 'cross';
    }
    return slots;
  }

  // ── Phase assignment across the whole plan ──────────────────────────
  function assignPhases(planLengthWeeks, taperWeeksCfg) {
    var taperWeeks = Math.max(0, Math.min(taperWeeksCfg, Math.floor(planLengthWeeks / 3)));
    var raceWeek = planLengthWeeks;
    var phases = [];
    for (var w = 1; w <= planLengthWeeks; w++) {
      if (w === raceWeek) phases.push('race');
      else if (w > raceWeek - 1 - taperWeeks) phases.push('taper');
      else phases.push(null); // filled below
    }
    var buildEnd = raceWeek - 1 - taperWeeks;
    var baseCount = Math.round(buildEnd * 0.35);
    var buildCount = Math.round(buildEnd * 0.40);
    for (var w2 = 1; w2 <= buildEnd; w2++) {
      if (w2 <= baseCount) phases[w2 - 1] = 'base';
      else if (w2 <= baseCount + buildCount) phases[w2 - 1] = 'build';
      else phases[w2 - 1] = 'peak';
    }
    return phases; // index 0 = week 1
  }

  function taperFraction(taperWeeks, idx) {
    var curves = { 1: [0.55], 2: [0.65, 0.45], 3: [0.75, 0.55, 0.40], 4: [0.80, 0.65, 0.50, 0.38] };
    var curve = curves[taperWeeks] || curves[3];
    return curve[Math.min(idx, curve.length - 1)];
  }

  // ── Volume progression per week ──────────────────────────────────────
  function computeWeeklyVolumes(planLengthWeeks, phases, startVolume, peakVolume, level, taperWeeks) {
    var vols = [];
    var blockPeak = startVolume;
    var cutbackInterval = CUTBACK_INTERVAL[level];
    var buildWeekCounter = 0;
    var taperIdx = 0;
    for (var i = 0; i < planLengthWeeks; i++) {
      var phase = phases[i];
      if (phase === 'race') {
        vols.push(round5(blockPeak * 0.15));
      } else if (phase === 'taper') {
        vols.push(round5(blockPeak * taperFraction(taperWeeks, taperIdx)));
        taperIdx++;
      } else {
        buildWeekCounter++;
        var isCutback = buildWeekCounter % cutbackInterval === 0;
        if (isCutback) {
          vols.push(round5(blockPeak * (1 - CUTBACK_PCT[level])));
        } else {
          var candidate = Math.min(blockPeak * (1 + INCREASE_PCT[level]), peakVolume);
          if (i === 0) candidate = startVolume;
          blockPeak = candidate;
          vols.push(round5(candidate));
        }
      }
    }
    return vols;
  }

  // ── Structured per-day generation (numeric, pre-formatting) ──────────
  function buildStructuredWeeks(profile, raceGoal, planMeta) {
    var event = raceGoal.event;
    var level = planMeta.level;
    var cfg = EVENT_TABLE[event][level];
    var planLengthWeeks = planMeta.planLengthWeeks;
    var safetyScale = planMeta.unsafe ? Math.max(0.55, planMeta.weeksAvailable / cfg.minWeeks) : 1.0;
    var goalFactor = GOAL_FACTOR[raceGoal.goal] || 1.0;

    var peakVolume = cfg.peakVolume * goalFactor * safetyScale;
    var longRunPeak = cfg.longRunPeak * safetyScale;
    var startVolume = Math.max(profile.weeklyMileage, level === 'beginner' ? 4 : 6);
    if (startVolume > peakVolume * 0.6) startVolume = peakVolume * 0.6;

    var phases = assignPhases(planLengthWeeks, cfg.taperWeeks);
    var volumes = computeWeeklyVolumes(planLengthWeeks, phases, startVolume, peakVolume, level, cfg.taperWeeks);
    var runDays = Math.max(3, Math.min(profile.availableDays || RUN_DAYS_DEFAULT[level], RUN_DAYS_DEFAULT[level] + (event === '5k' || event === '10k' || event === 'half' || event === 'marathon' ? 0 : 1)));
    var wantCross = !(profile.crossOptions && profile.crossOptions.length === 1 && profile.crossOptions[0] === 'None');
    var qualityPool = QUALITY_POOL[event];
    var longShare = LONG_RUN_SHARE[event] + (runDays <= 3 ? 0.15 : runDays === 4 ? 0.05 : 0);
    var longRunSafetyCap = Math.max(profile.longestRun * 1.15, 2);
    var terrainNote = terrainNoteFrom(profile.terrains);

    var weeks = [];
    for (var w = 1; w <= planLengthWeeks; w++) {
      var phase = phases[w - 1];
      var targetVolume = volumes[w - 1];
      var template = assignWeekTemplate(runDays, wantCross);
      var isEntry = (level === 'beginner') || (level === 'novice' && phase === 'base');
      var pool = isEntry ? qualityPool.entry : qualityPool.trained;
      var qualityText = pool[(w - 1) % pool.length];
      var strengthBudget = STRENGTH_SESSIONS[phase] != null ? STRENGTH_SESSIONS[phase] : 1;

      var days = [];
      var longRunCap = phase === 'base' ? Math.min(longRunPeak, longRunSafetyCap) : longRunPeak;
      var longRunMiles = phase === 'race' ? 0 : round5(Math.min(longRunCap, targetVolume * longShare));
      var qualityMiles = (phase === 'base' || phase === 'race') ? 0 : round5(Math.min(targetVolume * 0.18, 8));
      var remaining = Math.max(0, targetVolume - longRunMiles - qualityMiles);
      var easySlotCount = template.filter(function (t) { return t === 'easy'; }).length;
      var easyCap = longRunMiles > 0 ? longRunMiles * 0.85 : remaining;
      var easyEach = easySlotCount ? round5(Math.min(remaining / easySlotCount, easyCap)) : 0;

      var strengthAssigned = 0;
      var crossPref = profile.crossOptions && profile.crossOptions.length && profile.crossOptions[0] !== 'None' ? profile.crossOptions[0] : 'Cross-train';

      for (var slot = 0; slot < 7; slot++) {
        var tok = template[slot];
        var day = { type: tok, miles: 0, label: '' };
        if (phase === 'race' && slot === 6) {
          day.type = 'race'; day.label = RACE_LABEL[event];
        } else if (phase === 'race') {
          day.type = 'rest'; day.label = 'Rest';
        } else if (tok === 'long') {
          day.type = 'long'; day.miles = longRunMiles;
          day.label = formatLongRunLabel(longRunMiles, terrainNote);
        } else if (tok === 'quality') {
          day.type = 'quality'; day.label = qualityText;
        } else if (tok === 'easy') {
          day.type = 'easy'; day.miles = easyEach;
          day.label = formatEasyRunLabel(easyEach);
        } else if (tok === 'cross') {
          var addStrength = strengthAssigned < strengthBudget;
          if (addStrength) strengthAssigned++;
          day.type = 'cross';
          day.label = (30 + Math.min(30, Math.round(targetVolume))) + ' min cross' + (crossPref !== 'Cross-train' ? ' · ' + crossPref : '') + (addStrength ? ' + strength' : '');
        } else {
          day.type = 'rest'; day.label = 'Rest';
        }
        days.push(day);
      }

      weeks.push({ weekNum: w, phase: phase, targetVolume: targetVolume, days: days });
    }
    return weeks;
  }

  function findCurrentWeekIdx(raceDate, planLengthWeeks, today) {
    for (var w = 1; w <= planLengthWeeks; w++) {
      var wkStart = dateForSlot(raceDate, planLengthWeeks, w, 0);
      var wkEnd = dateForSlot(raceDate, planLengthWeeks, w, 6);
      if (today >= wkStart && today <= wkEnd) return w;
      if (today < wkStart) return w;
    }
    return -1;
  }

  // ── Adaptive layer: pause days the user marked unavailable (illness/travel) ──
  function applyUnavailableRanges(weeks, raceGoal, planMeta, ranges) {
    if (!ranges || !ranges.length) return weeks;
    var raceDate = parseDate(raceGoal.raceDate);
    var planLengthWeeks = planMeta.planLengthWeeks;
    weeks.forEach(function (wk) {
      wk.days.forEach(function (day, di) {
        if (day.type === 'race') return;
        var iso = dateToISO(dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di));
        var hit = ranges.filter(function (r) { return iso >= r.start && iso <= r.end; })[0];
        if (hit) {
          day.type = 'rest';
          day.miles = 0;
          day.label = 'Rest — ' + (hit.reason === 'vacation' ? 'away' : 'illness');
        }
      });
    });
    return weeks;
  }

  // ── Adaptive layer: dampen future weeks if recent training was mostly missed ──
  function applyMissedAdjustment(weeks, raceGoal, planMeta, logs, today, terrainNote) {
    var raceDate = parseDate(raceGoal.raceDate);
    var planLengthWeeks = planMeta.planLengthWeeks;
    var currentWeekIdx = findCurrentWeekIdx(raceDate, planLengthWeeks, today);
    if (currentWeekIdx <= 1) return { weeks: weeks, note: null };

    var lastWeek = weeks[currentWeekIdx - 2]; // the fully-completed week before current
    var loggableCount = 0, loggedCount = 0, longRunMissed = false;
    lastWeek.days.forEach(function (day, di) {
      if (day.type === 'rest' || day.type === 'race') return;
      loggableCount++;
      var key = lastWeek.weekNum + '-' + di;
      if (logs[key]) loggedCount++;
      else if (day.type === 'long') longRunMissed = true;
    });
    var missedRatio = loggableCount ? 1 - loggedCount / loggableCount : 0;
    var note = null;
    if (missedRatio > 0.6) {
      var dampen = 0.85;
      for (var i = currentWeekIdx; i < weeks.length; i++) {
        var wk = weeks[i];
        if (wk.phase === 'race') continue;
        wk.days.forEach(function (day) {
          if (day.miles) {
            day.miles = round5(day.miles * dampen);
            if (day.type === 'long') day.label = formatLongRunLabel(day.miles, terrainNote);
            else if (day.type === 'easy') day.label = formatEasyRunLabel(day.miles);
          }
        });
      }
      note = 'You missed most of last week’s sessions, so upcoming volume was reduced about 15% to rebuild gradually.';
    } else if (longRunMissed) {
      var wkNext = weeks[currentWeekIdx - 1];
      if (wkNext) {
        wkNext.days.forEach(function (day) {
          if (day.type === 'long' && day.miles) {
            day.miles = round5(day.miles * 0.8);
            day.label = formatLongRunLabel(day.miles, terrainNote);
          }
        });
      }
      note = 'Last week’s long run was missed, so this week’s long run was shortened.';
    }
    return { weeks: weeks, note: note };
  }

  // ── Adaptive layer: nudge future volume if easy/long RPE has been consistently
  // off-target for a couple of weeks (doesn't run in the same week a missed-
  // workout adjustment already fired -- one adaptive story per render, not two) ──
  var RPE_TARGET = { easy: [3, 4], long: [4, 5] };
  function applyDifficultyAdjustment(weeks, raceGoal, planMeta, logs, today, terrainNote) {
    var raceDate = parseDate(raceGoal.raceDate);
    var planLengthWeeks = planMeta.planLengthWeeks;
    var currentWeekIdx = findCurrentWeekIdx(raceDate, planLengthWeeks, today);
    if (currentWeekIdx <= 1) return null;

    var samples = [];
    for (var w = Math.max(1, currentWeekIdx - 2); w < currentWeekIdx; w++) {
      var wk = weeks[w - 1];
      if (!wk) continue;
      wk.days.forEach(function (day, di) {
        if (day.type !== 'easy' && day.type !== 'long') return;
        var entry = getLog(wk.weekNum + '-' + di);
        if (entry && entry.effort) samples.push(entry.effort);
      });
    }
    if (samples.length < 3) return null;
    var avg = samples.reduce(function (a, b) { return a + b; }, 0) / samples.length;

    var factor = null, note = null;
    if (avg <= RPE_TARGET.easy[0] - 1) {
      factor = 1.05;
      note = 'Your easy running has felt too easy lately, so upcoming volume was nudged up about 5%.';
    } else if (avg >= RPE_TARGET.easy[1] + 3) {
      factor = 0.9;
      note = 'Your easy running has felt harder than it should lately, so upcoming volume was eased back about 10%.';
    }
    if (!factor) return null;

    for (var i = currentWeekIdx; i < weeks.length; i++) {
      var wk2 = weeks[i];
      if (wk2.phase === 'race') continue;
      wk2.days.forEach(function (day) {
        if (day.miles && (day.type === 'easy' || day.type === 'long')) {
          day.miles = round5(day.miles * factor);
          day.label = day.type === 'long' ? formatLongRunLabel(day.miles, terrainNote) : formatEasyRunLabel(day.miles);
        }
      });
    }
    return note;
  }

  function generateAll(profile, raceGoal, planMeta, logs, today) {
    var weeks = buildStructuredWeeks(profile, raceGoal, planMeta);
    weeks = applyUnavailableRanges(weeks, raceGoal, planMeta, state.unavailable);
    var terrainNote = terrainNoteFrom(profile.terrains);
    var adjusted = applyMissedAdjustment(weeks, raceGoal, planMeta, logs, today, terrainNote);
    if (!adjusted.note) {
      var diffNote = applyDifficultyAdjustment(adjusted.weeks, raceGoal, planMeta, logs, today, terrainNote);
      if (diffNote) adjusted.note = diffNote;
    }
    return adjusted;
  }

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function chipsHtml(name, options, labelMap, selected, multi) {
    return options.map(function (opt) {
      var isSel = multi ? selected.indexOf(opt) !== -1 : selected === opt;
      return '<button type="button" class="chip' + (isSel ? ' selected' : '') + '" data-group="' + name + '" data-value="' + opt + '">' + (labelMap ? labelMap[opt] : opt) + '</button>';
    }).join('');
  }

  // ── Personal intro (shown once before a fresh plan, skipped when editing) ──
  function renderIntro() {
    var app = document.getElementById('app');
    app.innerHTML = '';
    var wrap = el(
      '<div class="ob intro">' +
        '<div class="brand-mark">Runner</div>' +
        '<div class="intro-title">Hi.</div>' +
        '<div class="intro-body">I built this because I was training for my own half marathon and got tired of static PDF plans that didn\'t adapt to real life — a run moved to another day, a missed week, wanting to log how it actually went instead of just checking a box.</div>' +
        '<div class="intro-body">So this builds a real plan around wherever you\'re actually starting from — not just the race distance — and adjusts if life gets in the way. Works for anything from a 5K to a 100-miler.</div>' +
        '<div class="ob-label">What\'s your name?</div>' +
        '<input class="ob-input" type="text" id="introName" placeholder="e.g. Sarah" value="' + escapeHtml(state.userName || '') + '">' +
        '<button class="ob-btn" id="introStartBtn">Build My Plan</button>' +
        '<div class="intro-footer">No account required, no ads — your data stays on this device unless you turn on sync.</div>' +
        '<div class="intro-disclaimer">Runner is a training tool, not a medical provider — it doesn\'t diagnose injuries or illness. See the shield icon for when to stop and see a doctor.</div>' +
      '</div>'
    );
    app.appendChild(wrap);
    var nameInput = document.getElementById('introName');
    document.getElementById('introStartBtn').addEventListener('click', function () {
      var name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      state.userName = name;
      saveState(state);
      renderWizard(null);
    });
  }

  // ── Intake wizard ──────────────────────────────────────────────────────
  function renderWizard(prefill) {
    var app = document.getElementById('app');
    app.innerHTML = '';
    var isEdit = !!prefill;
    var draft = prefill || { event: null, raceDate: '', startDate: dateToISO(new Date()), goal: 'finish', weeklyMileage: 10, longestRun: 4, runDaysPerWeek: 3, experienceLevel: 'novice', recentInjury: false, availableDays: 4, terrains: ['road'], crossOptions: ['Bike'], recentRaceDistance: 'none', recentRaceTime: '', userName: state.userName };
    var step = 0;
    var steps = ['event', 'race', 'fitness', 'logistics'];

    function renderStep() {
      app.innerHTML = '';
      var body = '';
      if (steps[step] === 'event') {
        body =
          '<div class="ob-title">New Training Plan</div>' +
          '<div class="ob-sub">Step 1 of 4 · Event</div>' +
          '<div class="ob-label">What are you training for?</div>' +
          '<div class="chip-grid">' + chipsHtml('event', EVENTS, EVENT_LABEL, draft.event, false) + '</div>';
      } else if (steps[step] === 'race') {
        body =
          '<div class="ob-title">Race details</div>' +
          '<div class="ob-sub">Step 2 of 4 · ' + EVENT_LABEL[draft.event] + '</div>' +
          '<div class="ob-label">Race date</div>' +
          '<input class="ob-input" type="date" id="f_raceDate" value="' + escapeHtml(draft.raceDate) + '">' +
          '<div class="ob-label">When do you want to start training?</div>' +
          '<input class="ob-input" type="date" id="f_startDate" value="' + escapeHtml(draft.startDate) + '">' +
          '<div class="ob-label">Goal</div>' +
          '<div class="chip-grid">' + chipsHtml('goal', GOALS, GOAL_LABEL, draft.goal, false) + '</div>';
      } else if (steps[step] === 'fitness') {
        body =
          '<div class="ob-title">Current fitness</div>' +
          '<div class="ob-sub">Step 3 of 4 · Be honest — this sets your safe starting point</div>' +
          '<div class="ob-label">Current weekly distance (' + unitLabel() + ')</div>' +
          '<input class="ob-input" type="number" min="0" step="0.5" id="f_weeklyMileage" value="' + toUnit(draft.weeklyMileage) + '">' +
          '<div class="ob-label">Longest run in the last 4 weeks (' + unitLabel() + ')</div>' +
          '<input class="ob-input" type="number" min="0" step="0.5" id="f_longestRun" value="' + toUnit(draft.longestRun) + '">' +
          '<div class="ob-label">Runs per week right now</div>' +
          '<input class="ob-input" type="number" min="0" max="7" step="1" id="f_runDaysPerWeek" value="' + draft.runDaysPerWeek + '">' +
          '<div class="ob-label">Experience level</div>' +
          '<div class="chip-grid">' + chipsHtml('experienceLevel', LEVELS, LEVEL_LABEL, draft.experienceLevel, false) + '</div>' +
          '<div class="ob-label" style="margin-top:18px">Recent race result (optional)</div>' +
          '<div class="chip-grid">' + chipsHtml('recentRaceDistance', RACE_RESULT_DISTANCES, RACE_RESULT_LABEL, draft.recentRaceDistance || 'none', false) + '</div>' +
          '<input class="ob-input" type="text" id="f_recentRaceTime" placeholder="Finish time, e.g. 24:30 or 1:45:30" value="' + escapeHtml(draft.recentRaceTime || '') + '">' +
          '<p class="ob-hint">Used only to suggest an easy-pace range &mdash; skip it and the app sticks to effort/RPE guidance instead.</p>';
      } else if (steps[step] === 'logistics') {
        body =
          '<div class="ob-title">Logistics</div>' +
          '<div class="ob-sub">Step 4 of 4</div>' +
          '<div class="ob-label">Days per week you can train</div>' +
          '<input class="ob-input" type="number" min="3" max="7" step="1" id="f_availableDays" value="' + draft.availableDays + '">' +
          '<div class="ob-label">Terrain</div>' +
          '<div class="chip-grid">' + chipsHtml('terrains', TERRAINS, TERRAIN_LABEL, draft.terrains, true) + '</div>' +
          '<div class="ob-label">Cross-training available</div>' +
          '<div class="chip-grid">' + chipsHtml('crossOptions', CROSS_OPTIONS, null, draft.crossOptions, true) + '</div>' +
          '<div class="ob-label">Recent injury or pain (last 3 months)?</div>' +
          '<div class="chip-grid">' + chipsHtml('recentInjury', ['no', 'yes'], { no: 'No', yes: 'Yes' }, draft.recentInjury ? 'yes' : 'no', false) + '</div>' +
          '<div class="ob-label">Your name</div>' +
          '<input class="ob-input" type="text" id="f_userName" value="' + escapeHtml(draft.userName || '') + '">';
      }
      var nav =
        '<div class="step-nav">' +
          (step > 0 ? '<button class="ob-btn ob-btn-secondary" id="backBtn">Back</button>' : '<div></div>') +
          '<button class="ob-btn" id="nextBtn">' + (step === steps.length - 1 ? (isEdit ? 'Save' : 'Generate Plan') : 'Next') + '</button>' +
        '</div>' +
        (isEdit ? '<div class="ob-cancel" id="cancelWizardBtn">Cancel</div>' : '');
      var wrap = el('<div class="ob">' + body + nav + '</div>');
      app.appendChild(wrap);
      var cancelBtn = document.getElementById('cancelWizardBtn');
      if (cancelBtn) cancelBtn.addEventListener('click', renderMain);

      function syncFieldsToDraft() {
        var dateInput = document.getElementById('f_raceDate');
        if (dateInput) draft.raceDate = dateInput.value;
        var startInput = document.getElementById('f_startDate');
        if (startInput) draft.startDate = startInput.value;
        var wm = document.getElementById('f_weeklyMileage');
        if (wm) draft.weeklyMileage = fromUnit(parseFloat(wm.value) || 0);
        var lr = document.getElementById('f_longestRun');
        if (lr) draft.longestRun = fromUnit(parseFloat(lr.value) || 0);
        var rdpw = document.getElementById('f_runDaysPerWeek');
        if (rdpw) draft.runDaysPerWeek = parseInt(rdpw.value, 10) || 0;
        var ad = document.getElementById('f_availableDays');
        if (ad) draft.availableDays = parseInt(ad.value, 10) || 4;
        var un = document.getElementById('f_userName');
        if (un) draft.userName = un.value;
        var rrt = document.getElementById('f_recentRaceTime');
        if (rrt) draft.recentRaceTime = rrt.value.trim();
      }
      wrap.querySelectorAll('.ob-input').forEach(function (input) {
        input.addEventListener('input', syncFieldsToDraft);
      });

      var MULTI_GROUPS = { crossOptions: 'None', terrains: null };
      wrap.querySelectorAll('.chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          var group = chip.getAttribute('data-group');
          var value = chip.getAttribute('data-value');
          if (MULTI_GROUPS.hasOwnProperty(group)) {
            var sentinel = MULTI_GROUPS[group];
            var idx = draft[group].indexOf(value);
            if (sentinel && value === sentinel) {
              draft[group] = idx !== -1 ? [] : [sentinel];
            } else {
              var arr = sentinel ? draft[group].filter(function (v) { return v !== sentinel; }) : draft[group].slice();
              var idx2 = arr.indexOf(value);
              if (idx2 !== -1) arr.splice(idx2, 1);
              else arr.push(value);
              draft[group] = arr;
            }
          } else if (group === 'recentInjury') {
            draft.recentInjury = value === 'yes';
          } else {
            draft[group] = value;
          }
          wrap.querySelectorAll('.chip[data-group="' + group + '"]').forEach(function (c) {
            var v = c.getAttribute('data-value');
            var sel = MULTI_GROUPS.hasOwnProperty(group) ? draft[group].indexOf(v) !== -1
              : group === 'recentInjury' ? (draft.recentInjury ? 'yes' : 'no') === v
              : draft[group] === v;
            c.classList.toggle('selected', sel);
          });
        });
      });
      var backBtn = document.getElementById('backBtn');
      if (backBtn) backBtn.addEventListener('click', function () { syncFieldsToDraft(); step--; renderStep(); });
      document.getElementById('nextBtn').addEventListener('click', function () {
        syncFieldsToDraft();
        if (steps[step] === 'event') {
          if (!draft.event) return;
        } else if (steps[step] === 'race') {
          if (!draft.raceDate) { document.getElementById('f_raceDate').focus(); return; }
          if (!draft.startDate) { document.getElementById('f_startDate').focus(); return; }
          if (parseDate(draft.startDate) >= parseDate(draft.raceDate)) { document.getElementById('f_startDate').focus(); return; }
          // A start date already in the past has no real meaning -- clamp to
          // today so plan length/calendar placement are computed from where
          // training actually begins, not a stale date. Otherwise choosePlanLength's
          // cap (at ~1.6x the event's ideal weeks) can make the real plan far
          // shorter than the raw start-to-race gap, and since the calendar
          // anchors to race day and counts backward by that (uncapped) gap,
          // week 1 silently lands on some date with no relation to either
          // today or what the runner actually typed.
          (function () {
            var todayClamp = new Date(); todayClamp.setHours(0, 0, 0, 0);
            if (parseDate(draft.startDate) < todayClamp) draft.startDate = dateToISO(todayClamp);
          })();
        } else if (steps[step] === 'logistics') {
          var goalChanged = isEdit && (draft.event !== state.raceGoal.event || draft.raceDate !== state.raceGoal.raceDate || draft.startDate !== state.raceGoal.startDate);
          if (goalChanged) renderGoalChangeConfirm(draft);
          else finishWizard(draft, isEdit);
          return;
        }
        step++;
        renderStep();
      });
    }
    renderStep();
  }

  // ── Guided goal-change: shown when editing settings changes the race itself,
  // since that's the one edit that resets logged history -- never silent. ──
  function renderGoalChangeConfirm(draft) {
    var app = document.getElementById('app');
    app.innerHTML = '';

    var oldGoal = state.raceGoal, oldMeta = state.planMeta;
    var previewProfile = {
      weeklyMileage: draft.weeklyMileage, longestRun: draft.longestRun, runDaysPerWeek: draft.runDaysPerWeek,
      experienceLevel: draft.experienceLevel, recentInjury: draft.recentInjury, availableDays: draft.availableDays
    };
    var level = classifyUser(previewProfile);
    var weeksAvailable = weeksBetween(parseDate(draft.startDate), parseDate(draft.raceDate));
    var safety = evaluateSafety(draft.event, weeksAvailable, level);
    var planLengthWeeks = choosePlanLength(weeksAvailable, draft.event, level);

    var changes = [];
    if (draft.event !== oldGoal.event) changes.push('Event: ' + EVENT_LABEL[oldGoal.event] + ' &rarr; ' + EVENT_LABEL[draft.event]);
    if (draft.raceDate !== oldGoal.raceDate) changes.push('Race date: ' + oldGoal.raceDate + ' &rarr; ' + draft.raceDate);
    if (draft.startDate !== oldGoal.startDate) changes.push('Start date: ' + (oldGoal.startDate || '&mdash;') + ' &rarr; ' + draft.startDate);
    changes.push('Plan length: ' + oldMeta.planLengthWeeks + ' weeks &rarr; ' + planLengthWeeks + ' weeks');

    var wrap = el(
      '<div class="ob">' +
        '<div class="ob-title">Confirm the change</div>' +
        '<div class="ob-sub">What changes</div>' +
        '<ul class="recap-list">' + changes.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul>' +
        '<div class="ob-sub" style="margin-top:20px">What stays the same</div>' +
        '<p class="recap-empty" style="font-style:normal">Your fitness profile, terrain, cross-training preferences, and name.</p>' +
        (safety.unsafe ? '<div class="warn-banner" style="margin-top:16px"><i class="ti ti-alert-triangle"></i><span>' + escapeHtml(safety.warnings[0]) + '</span></div>' : '') +
        '<div class="warn-banner warn-banner--info" style="margin-top:16px"><i class="ti ti-info-circle"></i><span>Because the race itself is changing, your logged workouts and any day edits will be cleared &mdash; the calendar dates are shifting under them.</span></div>' +
        '<button class="ob-btn" id="confirmGoalChangeBtn">Confirm changes</button>' +
        '<div class="ob-cancel" id="cancelGoalChangeBtn">Go back</div>' +
      '</div>'
    );
    app.appendChild(wrap);
    document.getElementById('confirmGoalChangeBtn').addEventListener('click', function () {
      finishWizard(draft, true);
    });
    document.getElementById('cancelGoalChangeBtn').addEventListener('click', function () {
      renderWizard(draft);
    });
  }

  function finishWizard(draft, isEdit) {
    // Only kept if it actually parses -- a distance picked with an unparseable
    // or blank time is the same as not having supplied a result at all.
    var raceResultValid = draft.recentRaceDistance && draft.recentRaceDistance !== 'none' && parseRaceTimeToMinutes(draft.recentRaceTime);
    var profile = {
      weeklyMileage: draft.weeklyMileage, longestRun: draft.longestRun, runDaysPerWeek: draft.runDaysPerWeek,
      experienceLevel: draft.experienceLevel, recentInjury: draft.recentInjury, availableDays: draft.availableDays,
      terrains: draft.terrains && draft.terrains.length ? draft.terrains : ['road'], crossOptions: draft.crossOptions.length ? draft.crossOptions : ['None'],
      recentRaceDistance: raceResultValid ? draft.recentRaceDistance : null,
      recentRaceTime: raceResultValid ? draft.recentRaceTime.trim() : ''
    };
    var raceGoal = { event: draft.event, raceDate: draft.raceDate, startDate: draft.startDate, goal: draft.goal };
    var raceUnchanged = isEdit && state.raceGoal && state.raceGoal.event === raceGoal.event
      && state.raceGoal.raceDate === raceGoal.raceDate && state.raceGoal.startDate === raceGoal.startDate;
    var level = classifyUser(profile);
    var weeksAvailable = weeksBetween(parseDate(raceGoal.startDate), parseDate(raceGoal.raceDate));
    var safety = evaluateSafety(raceGoal.event, weeksAvailable, level);
    state.userName = (draft.userName || '').trim();
    state.profile = profile;
    state.raceGoal = raceGoal;
    if (raceUnchanged) {
      state.planMeta = { level: level, weeksAvailable: state.planMeta.weeksAvailable, planLengthWeeks: state.planMeta.planLengthWeeks, unsafe: safety.unsafe, warnings: safety.warnings };
    } else {
      var planLengthWeeks = choosePlanLength(weeksAvailable, raceGoal.event, level);
      state.planMeta = { level: level, weeksAvailable: weeksAvailable, planLengthWeeks: planLengthWeeks, unsafe: safety.unsafe, warnings: safety.warnings };
      state.logs = {}; state.overrides = {}; state.crossType = {};
    }
    saveState(state);
    didAutoScroll = false;
    renderMain();
  }

  // ── Main calendar (reuses the original edit / cross-select / time-log UI) ──
  // Shared icon strip so Progress/Glossary/Safety/Edit/Settings are reachable
  // from any subscreen, not just the main plan view -- avoids forcing a detour
  // through "Back to plan" just to switch between them.
  function headerIconsHtml(activeId) {
    function cls(id) { return 'ti hd-install' + (id === activeId ? ' active' : ''); }
    return (
      '<div class="hd-actions">' +
        '<i class="' + cls('progressBtn') + ' ti-chart-line" id="progressBtn" title="Progress"></i>' +
        '<i class="' + cls('glossaryBtn') + ' ti-book-2" id="glossaryBtn" title="What this all means"></i>' +
        '<i class="' + cls('safetyBtn') + ' ti-shield-check" id="safetyBtn" title="Safety info"></i>' +
        '<i class="ti ti-download hd-install" id="installBtn" style="display:none" title="Install app"></i>' +
        '<i class="' + cls('editPlanBtn') + ' ti-edit" id="editPlanBtn" title="Edit plan"></i>' +
        '<i class="ti hd-gear' + (activeId === 'gearBtn' ? ' active' : '') + ' ti-settings" id="gearBtn" title="Settings"></i>' +
      '</div>'
    );
  }
  function wireHeaderIcons() {
    document.getElementById('editPlanBtn').addEventListener('click', function () {
      renderWizard({
        event: state.raceGoal.event, raceDate: state.raceGoal.raceDate, startDate: state.raceGoal.startDate || dateToISO(new Date()), goal: state.raceGoal.goal,
        weeklyMileage: state.profile.weeklyMileage, longestRun: state.profile.longestRun, runDaysPerWeek: state.profile.runDaysPerWeek,
        experienceLevel: state.profile.experienceLevel, recentInjury: state.profile.recentInjury, availableDays: state.profile.availableDays,
        terrains: (state.profile.terrains || ['road']).slice(), crossOptions: state.profile.crossOptions.slice(),
        recentRaceDistance: state.profile.recentRaceDistance || 'none', recentRaceTime: state.profile.recentRaceTime || '',
        userName: state.userName
      });
    });
    document.getElementById('gearBtn').addEventListener('click', renderSettings);
    document.getElementById('safetyBtn').addEventListener('click', renderSafetyPanel);
    document.getElementById('glossaryBtn').addEventListener('click', renderGlossaryPanel);
    document.getElementById('progressBtn').addEventListener('click', renderProgressPanel);
    var installBtn = document.getElementById('installBtn');
    if (deferredInstallPrompt) installBtn.style.display = 'inline-block';
    installBtn.addEventListener('click', function () {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(function () {
        deferredInstallPrompt = null;
        installBtn.style.display = 'none';
      });
    });
  }

  // ── Primary bottom tab bar (docs/RACR_Master_Prompt.md) -- exactly the 3
  // co-equal primary destinations the spec calls out, not a catch-all nav.
  // Utility screens (Progress/Glossary/Safety/Edit/Settings) stay on the top
  // header icon row above; Coach stays reached via the Today card button.
  function bottomTabsHtml(active) {
    var items = [
      ['main', 'Main Quest', 'ti-flag'],
      ['side', 'Side Missions', 'ti-trophy'],
      ['path', 'Path', 'ti-route']
    ];
    return '<div class="bottom-tabs">' + items.map(function (item) {
      return '<button type="button" class="bottom-tab' + (active === item[0] ? ' active' : '') + '" data-tab="' + item[0] + '">' +
        '<i class="ti ' + item[2] + '"></i><span>' + item[1] + '</span></button>';
    }).join('') + '</div>';
  }
  function wireBottomTabs(scope) {
    (scope || document).querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');
        if (tab === 'side') renderQuestsHome();
        else if (tab === 'path') renderPathWindow();
        else renderMain();
      });
    });
  }

  // ── Quests home (docs/Runner_Quests_Tab_Spec.md) ──────────────────────

  var SQ_EXPERIENCE_LABEL = {
    new_strength: 'I am new to strength training',
    occasional: 'I train occasionally',
    regular: 'I strength train regularly',
    barbells_kettlebells: 'I am experienced with barbells or kettlebells'
  };
  var SQ_EQUIPMENT_LABEL = {
    no_equipment: 'No equipment',
    chair_or_bench: 'Chair or bench',
    resistance_bands: 'Resistance bands',
    dumbbells: 'Dumbbells',
    kettlebells: 'Kettlebells',
    barbell_and_rack: 'Barbell and rack',
    cable_machine: 'Cable machine',
    pull_up_bar: 'Pull-up bar',
    trx: 'TRX or suspension trainer',
    gym_access: 'Gym access',
    rowing_machine: 'Rowing machine',
    stationary_bike: 'Stationary bike',
    treadmill: 'Treadmill',
    stair_machine: 'Stair machine',
    pool: 'Pool'
  };
  var SQ_DURATION_LABEL = { short: '10-15 minutes', medium: '20-30 minutes', long: '30-45 minutes', extended: '45-60 minutes' };
  var SQ_INTEREST_LABEL = { strength: 'Build strength', upper_body: 'Build upper-body strength', core: 'Improve core strength', running: 'Support my running', explore: 'Hike and explore', kettlebells: 'Learn kettlebells', mobility: 'Improve mobility', cross_training: 'Try cross-training', variety: 'Give me variety' };
  var SQ_LIMITATION_LABEL = { knee_pain: 'Knee pain', back_pain: 'Back pain', hip_pain: 'Hip pain', ankle_foot_pain: 'Ankle or foot pain', shoulder_pain: 'Shoulder pain', wrist_pain: 'Wrist pain', no_current_limitations: 'No current limitations' };

  function durationText(mission) {
    if (!mission) return '';
    if (mission.durationMinutesMin === mission.durationMinutesMax) return mission.durationMinutesMin + ' min';
    return mission.durationMinutesMin + '-' + mission.durationMinutesMax + ' min';
  }

  function renderSideQuestOnboarding() {
    var app = document.getElementById('app');
    var draft = { strengthExperience: 'new_strength', equipment: ['no_equipment'], preferredDuration: 'medium', interest: 'running', limitations: ['no_current_limitations'] };
    function renderStep(step) {
      app.innerHTML = '';
      app.appendChild(el('<div class="subnav">' + headerIconsHtml(null) + '</div>'));
      wireHeaderIcons();
      var titles = ['Strength experience', 'Available equipment', 'Mission duration', 'Primary interest', 'Limitations'];
      var body = '';
      if (step === 0) body = '<div class="chip-grid" id="sqPick">' + chipsHtml('sqExperience', Object.keys(SQ_EXPERIENCE_LABEL), SQ_EXPERIENCE_LABEL, draft.strengthExperience, false) + '</div>';
      if (step === 1) body = '<div class="chip-grid" id="sqPick">' + chipsHtml('sqEquipment', Object.keys(SQ_EQUIPMENT_LABEL), SQ_EQUIPMENT_LABEL, draft.equipment, true) + '</div>';
      if (step === 2) body = '<div class="chip-grid" id="sqPick">' + chipsHtml('sqDuration', Object.keys(SQ_DURATION_LABEL), SQ_DURATION_LABEL, draft.preferredDuration, false) + '</div>';
      if (step === 3) body = '<div class="chip-grid" id="sqPick">' + chipsHtml('sqInterest', Object.keys(SQ_INTEREST_LABEL), SQ_INTEREST_LABEL, draft.interest, false) + '</div>';
      if (step === 4) body = '<div class="chip-grid" id="sqPick">' + chipsHtml('sqLimitations', Object.keys(SQ_LIMITATION_LABEL), SQ_LIMITATION_LABEL, draft.limitations, true) + '</div>';
      var wrap = el('<div class="ob sidequest-screen"><div class="brand-mark">Side Missions</div><div class="ob-title">' + titles[step] + '</div><p class="intro-body">Every body can strength train. Every exercise can be scaled.</p>' + body + '<div class="step-nav">' + (step ? '<button type="button" class="ob-btn ob-btn-secondary" id="sqBack">Back</button>' : '') + '<button type="button" class="ob-btn" id="sqNext">' + (step === 4 ? 'Finish' : 'Next') + '</button></div></div>');
      app.appendChild(wrap);
      wrap.querySelectorAll('.chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          var value = chip.getAttribute('data-value');
          if (step === 0) draft.strengthExperience = value;
          if (step === 1) {
            if (value === 'no_equipment') draft.equipment = ['no_equipment'];
            else {
              draft.equipment = draft.equipment.filter(function (x) { return x !== 'no_equipment'; });
              if (draft.equipment.indexOf(value) === -1) draft.equipment.push(value);
              else draft.equipment = draft.equipment.filter(function (x) { return x !== value; });
              if (!draft.equipment.length) draft.equipment = ['no_equipment'];
            }
          }
          if (step === 2) draft.preferredDuration = value;
          if (step === 3) draft.interest = value;
          if (step === 4) {
            if (value === 'no_current_limitations') draft.limitations = ['no_current_limitations'];
            else {
              draft.limitations = draft.limitations.filter(function (x) { return x !== 'no_current_limitations'; });
              if (draft.limitations.indexOf(value) === -1) draft.limitations.push(value);
              else draft.limitations = draft.limitations.filter(function (x) { return x !== value; });
              if (!draft.limitations.length) draft.limitations = ['no_current_limitations'];
            }
          }
          renderStep(step);
        });
      });
      var back = document.getElementById('sqBack');
      if (back) back.addEventListener('click', function () { renderStep(step - 1); });
      document.getElementById('sqNext').addEventListener('click', function () {
        if (step < 4) renderStep(step + 1);
        else {
          draft.completed = true;
          draft.completedDate = dateToISO(new Date());
          state.sideQuestOnboarding = draft;
          saveState(state);
          renderQuestsHome();
        }
      });
    }
    renderStep(0);
  }

  function renderMissionCard(mission, actionLabel, actionAttr) {
    return '<div class="quest-card mission-card"><div class="quest-name">' + escapeHtml(mission.name) + '</div><div class="quest-desc">' + escapeHtml(mission.description) + '</div><div class="mission-tags"><span>' + durationText(mission) + '</span><span>Load ' + mission.trainingLoad + '</span><span>' + escapeHtml(mission.runningInterference) + ' interference</span></div><div class="quest-meta">' + escapeHtml(mission.relationshipLabel) + ' &middot; ' + mission.xpReward + ' XP</div><button type="button" class="ob-btn ob-btn-secondary quest-btn" ' + actionAttr + '="' + mission.id + '">' + actionLabel + '</button></div>';
  }

  function renderSideQuestsHomeNew() {
    if (!state.sideQuestOnboarding || !state.sideQuestOnboarding.completed) { renderSideQuestOnboarding(); return; }
    var app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(el('<div class="subnav">' + headerIconsHtml(null) + '</div>'));
    wireHeaderIcons();
    var sideTabs = el(bottomTabsHtml('side'));
    app.appendChild(sideTabs);
    wireBottomTabs(sideTabs);
    var active = state.activeQuestTrack;
    var activeTrack = active && SideQuestDomain.questTrackById ? SideQuestDomain.questTrackById(active.trackId) : null;
    var activeHtml = '';
    if (activeTrack) {
      var total = SideQuestDomain.questTrackTotalMissions(activeTrack);
      var weekNum = Math.min(activeTrack.durationWeeks, Math.floor(active.completedSessions / activeTrack.missionsPerWeek) + 1);
      var nextMission = missionById(activeTrack.missionIds[Math.min(active.completedSessions, activeTrack.missionIds.length - 1)]);
      activeHtml = '<div class="quest-card active-quest-card"><div class="quest-name">' + escapeHtml(activeTrack.name) + '</div><div class="quest-meta">Week ' + weekNum + ' of ' + activeTrack.durationWeeks + ' &middot; ' + active.completedSessions + ' of ' + total + ' missions complete</div><div class="progress-track"><div class="progress-fill" style="width:' + (total ? Math.round(100 * active.completedSessions / total) : 0) + '%"></div></div><div class="quest-desc">' + (nextMission ? 'Next: ' + escapeHtml(nextMission.name) + ' &middot; ' + durationText(nextMission) : 'Quest Complete') + '</div>' + (nextMission ? '<button type="button" class="ob-btn quest-btn" id="resumeTrackBtn">Resume</button>' : '') + '<div class="ob-cancel" id="stopQuestBtn">Stop this quest</div></div>';
    } else {
      activeHtml = '<div class="quest-card"><div class="quest-name">No active Mission Track</div><div class="quest-desc">Start one progressive Side Mission track. Your Main Quest keeps scheduling priority.</div></div>';
    }

    // Weekly challenge (docs/Runner_SideQuest_Spec.md §2B) -- restored here
    // after this screen was rebuilt; see weeklyChallengeProgress/etc. above.
    expireWeeklyChallengeIfStale();
    var activeChallenge = state.activeWeeklyChallenge;
    var challenge = activeChallenge ? weeklyChallengeById(activeChallenge.challengeId) : null;
    var weeklyChallengeHtml;
    if (activeChallenge && challenge) {
      var wcProgress = weeklyChallengeProgress(challenge, activeChallenge.weekStartIso);
      weeklyChallengeHtml =
        '<div class="quest-card">' +
          '<div class="quest-name">' + escapeHtml(challenge.name) + '</div>' +
          '<div class="quest-meta">' + wcProgress + ' of ' + challenge.target + ' this week</div>' +
          '<div class="progress-track" style="margin:10px 0"><div class="progress-fill" id="weeklyChallengeFill"></div></div>' +
          (wcProgress >= challenge.target ? '<p class="recap-empty">Challenge complete -- nice work.</p>' : '') +
          '<div class="ob-cancel" id="dropChallengeBtn">Drop this challenge</div>' +
        '</div>';
    } else {
      weeklyChallengeHtml = '<div class="quest-card">' +
        '<p class="recap-empty" style="margin-bottom:10px">No weekly challenge active.</p>' +
        WEEKLY_CHALLENGES.map(function (c) {
          return '<button type="button" class="ob-btn ob-btn-secondary quest-btn" style="margin-bottom:8px" data-weekly-id="' + c.id + '">' + escapeHtml(c.name) + '</button>';
        }).join('') +
      '</div>';
    }

    var recommendations = SideQuestDomain.recommendMissions ? SideQuestDomain.recommendMissions({ onboarding: state.sideQuestOnboarding, feeling: currentWeekFeelingEntry() && currentWeekFeelingEntry().feeling }) : [];
    var recommendedHtml = recommendations.map(function (m) { return renderMissionCard(m, 'Preview', 'data-mission-id'); }).join('');
    var tracksHtml = (SideQuestDomain.QUEST_TRACKS || []).map(function (track) {
      return '<div class="quest-card"><div class="quest-name">' + escapeHtml(track.name) + '</div><div class="quest-desc">' + escapeHtml(track.goal) + '</div><div class="quest-meta">' + track.durationWeeks + ' weeks &middot; ' + track.missionsPerWeek + 'x/week &middot; ' + track.estimatedMinutesPerMission.min + '-' + track.estimatedMinutesPerMission.max + ' min &middot; ' + escapeHtml(track.runningInterference) + ' interference</div><button type="button" class="ob-btn ob-btn-secondary quest-btn" data-start-track="' + track.id + '">Start track</button></div>';
    }).join('');
    var sectionsHtml = (SideQuestDomain.CATEGORY_SECTIONS || []).filter(function (section) { return section.id !== 'recommended'; }).map(function (section) {
      var cards = section.missionIds.map(missionById).filter(Boolean).map(function (m) { return renderMissionCard(m, 'Preview', 'data-mission-id'); }).join('');
      return '<div class="ob-sub" style="margin-top:20px">' + escapeHtml(section.name) + '</div>' + cards;
    }).join('');
    var completedHtml = state.completedQuestTracks.length || state.sideQuestLog.length ? '<dl class="wd-info"><dt>XP</dt><dd>' + state.xp + '</dd><dt>Side Missions</dt><dd>' + state.sideQuestLog.length + '</dd><dt>Badges</dt><dd>' + (state.badges.length ? state.badges.map(escapeHtml).join(', ') : 'None yet') + '</dd></dl>' : '<p class="recap-empty">Completed Side Missions, badges, personal records, and lifetime totals will appear here.</p>';
    var wrap = el('<div class="ob sidequest-screen"><div class="brand-mark">Side Missions</div><div class="ob-title">Side Missions</div><p class="intro-body">Your run is the Main Quest. Side Missions make the journey stronger, broader, and more enjoyable.</p><div class="ob-sub">Active Mission Track</div>' + activeHtml + '<div class="ob-sub" style="margin-top:20px">Weekly challenge</div>' + weeklyChallengeHtml + '<div class="ob-sub" style="margin-top:20px">Recommended for you</div>' + recommendedHtml + '<div class="ob-sub" style="margin-top:20px">Mission Tracks</div>' + tracksHtml + sectionsHtml + '<div class="ob-sub" style="margin-top:20px">Completed Side Missions</div>' + completedHtml + '</div>');
    app.appendChild(wrap);
    var resume = document.getElementById('resumeTrackBtn');
    if (resume && activeTrack) resume.addEventListener('click', function () { renderMissionDetail(activeTrack.missionIds[Math.min(active.completedSessions, activeTrack.missionIds.length - 1)], null); });
    var stop = document.getElementById('stopQuestBtn');
    if (stop) stop.addEventListener('click', function () { stopQuestTrack(); renderQuestsHome(); });
    wrap.querySelectorAll('[data-start-track]').forEach(function (btn) {
      btn.addEventListener('click', function () { if (startQuestTrack(btn.getAttribute('data-start-track'), 'base')) renderQuestsHome(); });
    });
    wrap.querySelectorAll('[data-mission-id]').forEach(function (btn) {
      btn.addEventListener('click', function () { renderMissionDetail(btn.getAttribute('data-mission-id'), null); });
    });
    if (activeChallenge && challenge) {
      var weeklyFillEl = document.getElementById('weeklyChallengeFill');
      if (weeklyFillEl) {
        var progressNow = weeklyChallengeProgress(challenge, activeChallenge.weekStartIso);
        weeklyFillEl.style.width = (challenge.target ? 100 * progressNow / challenge.target : 0) + '%';
      }
      document.getElementById('dropChallengeBtn').addEventListener('click', function () { dropWeeklyChallenge(); renderQuestsHome(); });
    } else {
      wrap.querySelectorAll('[data-weekly-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          startWeeklyChallenge(btn.getAttribute('data-weekly-id'));
          renderQuestsHome();
        });
      });
    }
  }

  function renderMissionDetail(missionId, key) {
    var mission = missionById(missionId);
    if (!mission) return renderQuestsHome();
    var app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(el('<div class="subnav">' + headerIconsHtml(null) + '</div>'));
    wireHeaderIcons();
    var exercisesHtml = '<dl class="mission-exercises">' + (mission.exercises || []).map(function (ex) {
      var variation = SideQuestDomain.resolveExercise ? SideQuestDomain.resolveExercise(ex, 'base') : (ex.fixed || '');
      var name = ex.fixed || variation;
      return '<dt>' + escapeHtml(name) + '</dt><dd>' + escapeHtml(String(ex.sets || '')) + ' sets &middot; ' + escapeHtml(String(ex.reps || '')) + ' &middot; RPE ' + escapeHtml(String(ex.rpe || 'easy-moderate')) + '<div class="quest-meta">Scale: ' + escapeHtml(variation) + '</div>' + (ex.cues ? '<div class="quest-meta">' + escapeHtml(ex.cues) + '</div>' : '') + '</dd>';
    }).join('') + '</dl>';
    var scheduleOptions = '';
    if (!key) {
      var weeks = buildCurrentWeeks();
      var options = [];
      weeks.slice(0, 2).forEach(function (week) {
        week.days.forEach(function (day, di) {
          if (options.length >= 5) return;
          var candidateKey = week.weekNum + '-' + di;
          var conflict = SideQuestDomain.detectCalendarConflict ? SideQuestDomain.detectCalendarConflict(mission, di, week.days) : { ok: true };
          if ((day.type === 'rest' || day.type === 'easy' || day.type === 'cross') && conflict.ok) {
            var date = dateForSlot(parseDate(state.raceGoal.raceDate), state.planMeta.planLengthWeeks, week.weekNum, di);
            options.push('<button type="button" class="ob-btn ob-btn-secondary" data-add-key="' + candidateKey + '">' + DOW_FULL[date.getDay()] + ' &middot; ' + escapeHtml(day.label) + '</button>');
          }
        });
      });
      scheduleOptions = options.length ? '<div class="ob-sub" style="margin-top:18px">Add to Calendar</div>' + options.join('') : '';
    }
    var safetyText = (mission.avoidBeforeWorkoutTypes.length ? 'Avoid before ' + mission.avoidBeforeWorkoutTypes.join(' or ') + '. ' : '') + 'Stop for sharp, worsening, or unusual pain.';
    var wrap = el('<div class="ob sidequest-screen"><div class="brand-mark">Side Mission</div><div class="ob-title">' + escapeHtml(mission.name) + '</div><p class="intro-body">' + escapeHtml(mission.description) + '</p><div class="mission-tags"><span>' + durationText(mission) + '</span><span>' + escapeHtml(mission.relationshipLabel) + '</span><span>' + mission.xpReward + ' XP</span></div><dl class="wd-info"><dt>Training effect</dt><dd>' + escapeHtml(mission.trainingPurpose.join(', ')) + '</dd><dt>Running interference</dt><dd>' + escapeHtml(mission.runningInterference) + '</dd><dt>Progression</dt><dd>' + escapeHtml(mission.progression) + '</dd><dt>Safety notes</dt><dd>' + escapeHtml(safetyText) + '</dd></dl><div class="ob-sub">Workout</div>' + exercisesHtml + '<button type="button" class="ob-btn" id="startMissionBtn">Start Mission</button>' + (key ? '' : '<button type="button" class="ob-btn ob-btn-secondary" id="completeNowBtn">Complete now</button>') + scheduleOptions + '<div class="ob-cancel" id="missionBackBtn">Back to Side Missions</div></div>');
    app.appendChild(wrap);
    document.getElementById('startMissionBtn').addEventListener('click', function () { renderMissionPlayer(mission.id, key); });
    var completeNow = document.getElementById('completeNowBtn');
    if (completeNow) completeNow.addEventListener('click', function () { completeMission(mission.id, key, { difficulty: 'about_right', pain: 'no' }); renderQuestsHome(); });
    wrap.querySelectorAll('[data-add-key]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var res = addMissionToCalendar(mission.id, btn.getAttribute('data-add-key'));
        showToast(res.ok ? 'Added to calendar.' : 'That conflicts with a protected Main Mission.');
        renderMain();
      });
    });
    document.getElementById('missionBackBtn').addEventListener('click', renderQuestsHome);
  }

  function renderMissionPlayer(missionId, key) {
    var mission = missionById(missionId);
    if (!mission) return renderQuestsHome();
    var app = document.getElementById('app');
    app.innerHTML = '';
    var exerciseRows = (mission.exercises || []).map(function (ex, i) {
      var name = ex.fixed || (SideQuestDomain.resolveExercise ? SideQuestDomain.resolveExercise(ex, 'base') : '');
      return '<label class="mission-step"><input type="checkbox" data-step="' + i + '"><span><strong>' + escapeHtml(name) + '</strong><br>' + escapeHtml((ex.sets || '') + ' sets, ' + (ex.reps || '') + ', rest ' + (ex.restSeconds || 0) + ' sec') + '</span></label>';
    }).join('');
    var wrap = el('<div class="ob sidequest-screen"><div class="brand-mark">Mission Player</div><div class="ob-title">' + escapeHtml(mission.name) + '</div><div class="ob-sub">Warm-up</div><ul class="recap-list">' + (mission.warmup || []).map(function (w) { return '<li>' + escapeHtml(w) + '</li>'; }).join('') + '</ul><div class="ob-sub" style="margin-top:18px">Exercises</div>' + exerciseRows + '<div class="ob-sub" style="margin-top:18px">How difficult was this?</div><div class="chip-grid" id="missionDifficulty">' + chipsHtml('missionDifficulty', ['too_easy', 'about_right', 'hard', 'too_hard'], { too_easy: 'Too easy', about_right: 'About right', hard: 'Hard', too_hard: 'Too hard' }, 'about_right', false) + '</div><div class="ob-sub" style="margin-top:18px">Any pain or unusual discomfort?</div><div class="chip-grid" id="missionPain">' + chipsHtml('missionPain', ['no', 'yes'], { no: 'No', yes: 'Yes' }, 'no', false) + '</div><button type="button" class="ob-btn" id="finishMissionBtn">Complete Mission</button><button type="button" class="ob-btn ob-btn-secondary danger-btn" id="stopPainBtn">Stop because of pain</button></div>');
    app.appendChild(wrap);
    var difficulty = 'about_right';
    var pain = 'no';
    document.getElementById('missionDifficulty').querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        difficulty = chip.getAttribute('data-value');
        document.getElementById('missionDifficulty').querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('selected', c === chip); });
      });
    });
    document.getElementById('missionPain').querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        pain = chip.getAttribute('data-value');
        document.getElementById('missionPain').querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('selected', c === chip); });
      });
    });
    document.getElementById('finishMissionBtn').addEventListener('click', function () {
      var activeTrack = state.activeQuestTrack && SideQuestDomain.questTrackById && SideQuestDomain.questTrackById(state.activeQuestTrack.trackId);
      var expectedMissionId = activeTrack ? activeTrack.missionIds[Math.min(state.activeQuestTrack.completedSessions, activeTrack.missionIds.length - 1)] : null;
      if (activeTrack && expectedMissionId === mission.id) completeQuestTrackSession(key);
      else completeMission(mission.id, key, { difficulty: difficulty, pain: pain });
      renderQuestsHome();
    });
    document.getElementById('stopPainBtn').addEventListener('click', function () {
      state.sideQuestLog.push({ id: mission.id, key: key || null, date: dateToISO(new Date()), category: mission.category, rewardPoints: 0, stopped: true, reason: 'pain' });
      saveState(state);
      showToast('Mission stopped. Do not train through sharp or worsening pain.');
      renderQuestsHome();
    });
  }

  function renderQuestsHome() {
    renderSideQuestsHomeNew();
  }

  function mainQuestId() {
    if (!state.raceGoal) return 'main_quest';
    return 'main_quest_' + state.raceGoal.event + '_' + (state.raceGoal.raceDate || '').replace(/[^0-9]/g, '');
  }

  function generateCurrentPath(weeks) {
    if (!PathDomain.generatePath) return null;
    var generated = PathDomain.generatePath({
      mainQuestId: mainQuestId(),
      mainQuestActive: !!state.raceGoal,
      planLengthWeeks: state.planMeta ? state.planMeta.planLengthWeeks : (weeks ? weeks.length : 12),
      weeks: weeks || buildCurrentWeeks(),
      logs: state.logs,
      sideMissionLog: state.sideQuestLog,
      earnedBadges: state.badges
    });
    var previous = state.path ? { id: state.path.id, earnedBadges: state.badges || [], nodes: state.pathNodes || [] } : null;
    var next = PathDomain.preserveCompletedAchievements ? PathDomain.preserveCompletedAchievements(previous, generated) : generated;
    var badges = (state.badges || []).concat(next.earnedBadges || []).filter(function (b, i, arr) { return arr.indexOf(b) === i; });
    var pathSummary = {
      id: next.id,
      mainQuestId: next.mainQuestId,
      currentNodeId: next.currentNodeId,
      nodeIds: next.nodeIds,
      updatedAt: dateToISO(new Date())
    };
    var changed = JSON.stringify(state.path || null) !== JSON.stringify(pathSummary) ||
      JSON.stringify(state.pathNodes || []) !== JSON.stringify(next.nodes || []) ||
      JSON.stringify(state.badges || []) !== JSON.stringify(badges);
    if (changed) {
      state.path = pathSummary;
      state.pathNodes = next.nodes;
      state.badges = badges;
      saveState(state);
    }
    return next;
  }

  function refreshPathProgress(weeks) {
    if (!state.raceGoal || !state.profile || !state.planMeta || !PathDomain.generatePath) return null;
    return generateCurrentPath(weeks || buildCurrentWeeks());
  }

  function pathNodeIcon(node) {
    if (node.nodeType === 'race') return 'ti-flag-check';
    if (node.nodeType === 'side_mission_achievement') return 'ti-diamond';
    if (node.nodeType === 'major_badge') return 'ti-star';
    return 'ti-point-filled';
  }

  function pathStatusText(status) {
    return { completed: 'Completed', current: 'Current', available: 'Available', locked: 'Locked', optional: 'Optional' }[status] || status;
  }

  function renderPathWindow(selectedNodeId) {
    if (!state.raceGoal || !state.profile || !state.planMeta) { renderIntro(); return; }
    var app = document.getElementById('app');
    app.innerHTML = '';
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var raceDate = parseDate(state.raceGoal.raceDate);
    var weeks = generateAll(state.profile, state.raceGoal, state.planMeta, state.logs, today).weeks;
    var pathModel = generateCurrentPath(weeks);
    if (!pathModel) {
      app.appendChild(el('<div class="ob"><div class="ob-title">Path</div><p class="intro-body">Path is unavailable because the Path engine did not load.</p></div>'));
      return;
    }
    app.appendChild(el('<div class="subnav">' + headerIconsHtml(null) + '</div>'));
    wireHeaderIcons();
    var pathTabs = el(bottomTabsHtml('path'));
    app.appendChild(pathTabs);
    wireBottomTabs(pathTabs);

    var totalRequired = pathModel.nodes.filter(function (n) { return n.required; }).length;
    var completeRequired = pathModel.nodes.filter(function (n) { return n.required && n.status === 'completed'; }).length;
    var selected = pathModel.nodes.filter(function (n) { return n.id === selectedNodeId; })[0] ||
      pathModel.nodes.filter(function (n) { return n.id === pathModel.currentNodeId; })[0];
    var selectedHtml = selected ? '<div class="path-detail">' +
      '<div class="quest-name">' + escapeHtml(selected.title) + '</div>' +
      '<div class="quest-desc">' + escapeHtml(selected.description) + '</div>' +
      '<dl class="wd-info">' +
        '<dt>Status</dt><dd>' + escapeHtml(pathStatusText(selected.status)) + (selected.optional ? ' Side Mission achievement' : ' Main Quest milestone') + '</dd>' +
        '<dt>Why it matters</dt><dd>' + escapeHtml(selected.whyItMatters || 'This marks meaningful progress along your running journey.') + '</dd>' +
        '<dt>Requirement</dt><dd>' + escapeHtml(selected.requirements) + '</dd>' +
        '<dt>Progress</dt><dd>' + selected.progressCurrent + ' of ' + selected.progressTarget + '</dd>' +
        (selected.badgeId ? '<dt>Badge</dt><dd>' + escapeHtml(selected.badgeId.replace(/^badge_/, '').replace(/_/g, ' ')) + '</dd>' : '') +
      '</dl>' +
    '</div>' : '';
    var nodesHtml = pathModel.nodes.map(function (node) {
      var sr = PathDomain.accessibilityLabel ? PathDomain.accessibilityLabel(node, state.planMeta.planLengthWeeks) : node.title;
      return '<button type="button" class="path-node path-node--' + node.status + ' path-node--' + node.nodeType + '" data-node-id="' + node.id + '" aria-label="' + escapeHtml(sr) + '">' +
        '<span class="path-node-marker"><i class="ti ' + pathNodeIcon(node) + '"></i></span>' +
        '<span class="path-node-card">' +
          '<span class="path-node-kicker">' + (node.optional ? 'Optional Side Mission' : (node.nodeType === 'race' ? 'Final Main Mission' : 'Main Quest')) + ' · Week ' + node.week + '</span>' +
          '<span class="path-node-title">' + escapeHtml(node.title) + '</span>' +
          '<span class="path-node-desc">' + escapeHtml(node.description) + '</span>' +
          '<span class="path-node-status">' + escapeHtml(pathStatusText(node.status)) + (node.badgeId && node.status === 'completed' ? ' · Badge earned' : '') + '</span>' +
        '</span>' +
      '</button>';
    }).join('');
    var wrap = el(
      '<div class="ob path-screen">' +
        '<div class="brand-mark">Path</div>' +
        '<div class="ob-title">Your Path</div>' +
        '<p class="intro-body">Your run is the Main Quest. Side Missions make the journey stronger, broader, and more enjoyable. The Path shows how far you have come.</p>' +
        '<dl class="wd-info path-summary">' +
          '<dt>Main Quest</dt><dd>' + escapeHtml(EVENT_LABEL[state.raceGoal.event]) + ' · Week ' + (findCurrentWeekIdx(raceDate, state.planMeta.planLengthWeeks, today) + 1) + ' of ' + state.planMeta.planLengthWeeks + '</dd>' +
          '<dt>Main Quest milestones</dt><dd>' + completeRequired + ' of ' + totalRequired + '</dd>' +
          '<dt>Badges</dt><dd>' + (state.badges.length ? state.badges.length + ' earned' : 'None yet') + '</dd>' +
        '</dl>' +
        selectedHtml +
        '<div class="path-timeline" id="pathTimeline">' + nodesHtml + '</div>' +
        '<div class="ob-cancel" id="pathBackBtn">Back to plan</div>' +
      '</div>'
    );
    app.appendChild(wrap);
    document.getElementById('pathBackBtn').addEventListener('click', renderMain);
    wrap.querySelectorAll('[data-node-id]').forEach(function (btn) {
      btn.addEventListener('click', function () { renderPathWindow(btn.getAttribute('data-node-id')); });
    });
    setTimeout(function () {
      var currentEl = wrap.querySelector('[data-node-id="' + pathModel.currentNodeId + '"]');
      if (currentEl) currentEl.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }, 80);
  }

  // ── Weekly row: meaningful status + planned/actual summaries ───────────
  // Replaces the old plain checkbox -- a status glyph reflecting
  // completionType (or missed/today/upcoming when unlogged), matching
  // docs/RACR_RunLogging_Correction.md's "don't use a checkbox as the only
  // interaction" requirement. Tapping the date (existing behavior) still
  // opens the full detail view to actually log or edit a run.
  function dayStatusHtml(loggable, entry, isToday, isPast) {
    if (!loggable) return '';
    if (entry && entry.completionType) {
      if (entry.completionType === 'planned') {
        return '<span class="day-status day-status--done" title="Completed as planned"><i class="ti ti-check"></i></span>';
      }
      return '<span class="day-status day-status--modified" title="' + escapeHtml(COMPLETION_TYPE_LABEL[entry.completionType] || 'Modified') + '">~</span>';
    }
    if (isPast) return '<span class="day-status day-status--missed" title="Missed">&ndash;</span>';
    if (isToday) return '<span class="day-status day-status--today" title="Today"></span>';
    return '<span class="day-status day-status--upcoming" title="Upcoming"></span>';
  }
  // Target line: planned distance + (when a recent race result supports it)
  // a target pace range -- reuses the exact same range helpers renderWorkoutDetail
  // already calls, so the two screens can never disagree about the target.
  function targetSummaryHtml(dayData, label) {
    var range = null;
    if (dayData.type === 'easy' || dayData.type === 'long') range = computeEasyPaceRange(state.profile);
    else if (dayData.type === 'quality') range = computeQualityPaceRange(state.profile, label);
    var parts = [];
    if (dayData.miles) parts.push(toUnit(dayData.miles) + ' ' + unitLabel());
    if (range) {
      var lo = state.units === 'km' ? range.loSecPerMi / KM_PER_MI : range.loSecPerMi;
      var hi = state.units === 'km' ? range.hiSecPerMi / KM_PER_MI : range.hiSecPerMi;
      parts.push(formatPace(lo) + '&ndash;' + formatPace(hi) + '/' + unitLabel());
    }
    return parts.length ? '<div class="day-target">Target: ' + parts.join(' &middot; ') + '</div>' : '';
  }
  // Actual result, appended alongside (never replacing) the target line above.
  function completedSummaryHtml(entry) {
    if (!entry || (entry.distance == null && !entry.time)) return '';
    var pace = computeActualPaceSecPerMi(entry.distance, parseDurationToSeconds(entry.time));
    var parts = [];
    if (entry.distance != null) parts.push(toUnit(entry.distance) + ' ' + unitLabel());
    if (entry.time) parts.push(escapeHtml(entry.time));
    if (pace) parts.push(formatPace(state.units === 'km' ? pace / KM_PER_MI : pace) + '/' + unitLabel());
    return parts.length ? '<div class="day-completed">Completed: ' + parts.join(' &middot; ') + '</div>' : '';
  }

  function renderMain() {
    if (!state.raceGoal || !state.profile || !state.planMeta) { renderIntro(); return; }

    var app = document.getElementById('app');
    app.innerHTML = '';

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var raceDate = parseDate(state.raceGoal.raceDate);
    var planLengthWeeks = state.planMeta.planLengthWeeks;
    var result = generateAll(state.profile, state.raceGoal, state.planMeta, state.logs, today);
    var weeks = result.weeks;

    var totalLoggable = 0, totalLogged = 0, currentWeek = 1, todayDayIdx = -1;
    weeks.forEach(function (wk) {
      wk.days.forEach(function (day, di) {
        var d = dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di);
        var key = wk.weekNum + '-' + di;
        var effectiveLabel = state.overrides[key] || day.label;
        if (isLoggable(effectiveLabel)) {
          totalLoggable++;
          if (state.logs[key]) totalLogged++;
        }
        if (sameDate(d, today)) { currentWeek = wk.weekNum; todayDayIdx = di; }
      });
    });

    var remaining = daysBetween(today, raceDate);
    var countdownText = remaining > 0 ? remaining + ' DAYS TO RACE' : (remaining === 0 ? 'RACE DAY' : 'RACE COMPLETE');

    var warningsHtml = '';
    if (state.planMeta.unsafe) {
      warningsHtml += state.planMeta.warnings.map(function (w) { return '<div class="warn-banner"><i class="ti ti-alert-triangle"></i><span>' + escapeHtml(w) + '</span></div>'; }).join('');
    }
    if (result.note) {
      warningsHtml += '<div class="warn-banner warn-banner--info"><i class="ti ti-info-circle"></i><span>' + escapeHtml(result.note) + '</span></div>';
    }

    var header = el(
      '<div>' +
        '<div class="hd">' +
          '<div>' +
            '<div class="brand-mark">Runner</div>' +
            '<div class="hd-title">' + (state.userName ? escapeHtml(state.userName) + '&rsquo;s ' : '') + EVENT_LABEL[state.raceGoal.event] + ' Training</div>' +
            '<div class="hd-sub">' + LEVEL_LABEL[state.planMeta.level] + ' · ' + GOAL_LABEL[state.raceGoal.goal] + '</div>' +
          '</div>' +
          headerIconsHtml(null) +
        '</div>' +
        '<div class="stat-line">' +
          '<span class="accent">WEEK ' + currentWeek + ' OF ' + planLengthWeeks + '</span>' +
          '<span class="stat-dot">·</span>' +
          '<span>' + countdownText + '</span>' +
          '<span class="stat-dot">·</span>' +
          '<i class="ti ti-check"></i>' +
          '<span id="loggedCount">' + totalLogged + ' / ' + totalLoggable + ' LOGGED</span>' +
        '</div>' +
        '<div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>' +
        warningsHtml +
      '</div>'
    );
    app.appendChild(header);
    document.getElementById('progressFill').style.width = (totalLoggable ? (100 * totalLogged / totalLoggable) : 0) + '%';
    wireHeaderIcons();
    var mainTabs = el(bottomTabsHtml('main'));
    app.appendChild(mainTabs);
    wireBottomTabs(mainTabs);

    if (todayDayIdx !== -1) {
      var todayKey = currentWeek + '-' + todayDayIdx;
      var todayDayData = weeks[currentWeek - 1].days[todayDayIdx];
      var todayLabel = state.overrides[todayKey] || todayDayData.label;
      var todayMission = missionById(state.sideQuestCalendar[todayKey]);
      var todayLoggable = isLoggable(todayLabel);
      var todayEntry = getLog(todayKey);
      var todayLogged = !!todayEntry;

      var todayStatusHtml;
      if (!todayLoggable) {
        todayStatusHtml = '<div class="today-status">Nothing scheduled &mdash; recover well.</div>';
      } else if (todayLogged) {
        todayStatusHtml = '<div class="today-status today-status--done"><i class="ti ti-check"></i> Logged' +
          (todayEntry.time ? ' &middot; ' + escapeHtml(todayEntry.time) : '') +
          (todayEntry.distance ? ' &middot; ' + toUnit(todayEntry.distance) + ' ' + unitLabel() : '') + '</div>';
      } else {
        todayStatusHtml = '<div class="today-status today-status--pending">Not logged yet</div>';
      }

      var todayCard = el(
        '<div class="today-card' + (!todayLoggable ? ' is-rest' : '') + '">' +
          '<div class="today-eyebrow">TODAY</div>' +
          '<div class="mission-label">Main Mission</div>' +
          '<div class="today-plan">' + escapeHtml(todayLabel) + '</div>' +
          todayStatusHtml +
          (todayMission ? '<div class="today-side"><div class="mission-label">Side Mission</div><button type="button" class="side-mission-link" id="todaySideMissionBtn">' + escapeHtml(todayMission.name) + ' &middot; ' + todayMission.durationMinutesMin + '-' + todayMission.durationMinutesMax + ' min</button></div>' : '') +
          (todayLoggable ? '<button class="ob-btn today-btn" id="todayDetailBtn">' + (todayLogged ? 'View / Edit' : 'Log it') + '</button>' : '') +
          '<div class="ai-coach">' +
            '<div class="pain-toggle" id="aiCoachOpenBtn">Ask your coach</div>' +
          '</div>' +
        '</div>'
      );
      app.appendChild(todayCard);
      if (todayLoggable) {
        document.getElementById('todayDetailBtn').addEventListener('click', function () {
          renderWorkoutDetail(currentWeek, todayDayIdx);
        });
      }
      if (todayMission) {
        document.getElementById('todaySideMissionBtn').addEventListener('click', function () {
          renderMissionDetail(todayMission.id, todayKey);
        });
      }
      document.getElementById('aiCoachOpenBtn').addEventListener('click', renderCoachChat);
    }

    var list = el('<div id="weekList"></div>');
    app.appendChild(list);

    weeks.forEach(function (wk) {
      var weekNum = wk.weekNum;
      var firstDate = dateForSlot(raceDate, planLengthWeeks, weekNum, 0);
      var lastDate = dateForSlot(raceDate, planLengthWeeks, weekNum, 6);

      var block = el(
        '<div class="week-block">' +
          '<div class="week-head">' +
            '<div class="week-num">WEEK ' + (weekNum < 10 ? '0' + weekNum : weekNum) + ' <span class="phase-tag">' + wk.phase.toUpperCase() + '</span></div>' +
            '<div class="week-range">' + fmtRange(firstDate, lastDate) + '</div>' +
          '</div>' +
          '<div class="day-list"></div>' +
        '</div>'
      );
      var dayList = block.querySelector('.day-list');

      wk.days.forEach(function (dayData, di) {
        var d = dateForSlot(raceDate, planLengthWeeks, weekNum, di);
        var key = weekNum + '-' + di;
        var baseLabel = dayData.label;
        var label = state.overrides[key] || baseLabel;
        var loggable = isLoggable(label);
        var race = isRace(label);
        var cross = hasCross(label);
        var isToday = sameDate(d, today);
        var isPast = d < today;
        var entry = getLog(key);
        var crossValue = state.crossType[key] || '';
        var scheduledMission = missionById(state.sideQuestCalendar[key]);

        var classes = 'day-row';
        if (isToday) classes += ' is-today';
        if (race) classes += ' is-race';
        if (!loggable) classes += ' is-rest';

        var row = el(
          '<div class="' + classes + '">' +
            dayStatusHtml(loggable, entry, isToday, isPast) +
            '<div class="day-date"><span class="day-dow">' + DOW_FULL[d.getDay()] + '</span><span class="day-dom">' + d.getDate() + '</span></div>' +
            '<div class="day-main">' +
              '<div class="day-plan">' + escapeHtml(label) + '</div>' +
              (calendarHint(label) ? '<div class="day-hint">' + escapeHtml(calendarHint(label)) + '</div>' : '') +
              (loggable ? targetSummaryHtml(dayData, label) + completedSummaryHtml(entry) : '') +
              (scheduledMission ? '<button type="button" class="calendar-side-mission" data-mission-id="' + scheduledMission.id + '">Side Mission: ' + escapeHtml(scheduledMission.name) + '</button>' : '') +
              (cross ? '<select class="cross-select' + (crossValue ? ' chosen' : '') + '">' + crossOptionsHtml(crossValue) + '</select>' : '') +
            '</div>' +
          '</div>'
        );

        row.querySelector('.day-date').addEventListener('click', function () {
          renderWorkoutDetail(weekNum, di);
        });

        if (cross) {
          var selectEl = row.querySelector('.cross-select');
          selectEl.addEventListener('change', function () {
            if (selectEl.value) {
              state.crossType[key] = selectEl.value;
              selectEl.classList.add('chosen');
            } else {
              delete state.crossType[key];
              selectEl.classList.remove('chosen');
            }
            saveState(state);
          });
        }

        var planDiv = row.querySelector('.day-plan');
        planDiv.addEventListener('click', function () {
          var currentText = planDiv.textContent;
          var inputEl = document.createElement('input');
          inputEl.className = 'day-plan-edit';
          inputEl.value = currentText;
          planDiv.replaceWith(inputEl);
          inputEl.focus();
          inputEl.select();
          var committed = false;
          function commit() {
            if (committed) return;
            committed = true;
            var val = inputEl.value.trim();
            if (!val || val === baseLabel) delete state.overrides[key];
            else state.overrides[key] = val;
            saveState(state);
            renderMain();
          }
          inputEl.addEventListener('blur', commit);
          inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); inputEl.blur(); }
            else if (e.key === 'Escape') { inputEl.value = currentText; inputEl.blur(); }
          });
        });

        var scheduledBtn = row.querySelector('.calendar-side-mission');
        if (scheduledBtn) {
          scheduledBtn.addEventListener('click', function () {
            renderMissionDetail(scheduledMission.id, key);
          });
        }

        dayList.appendChild(row);
      });

      list.appendChild(block);
    });

    if (!didAutoScroll) {
      didAutoScroll = true;
      var todayRow = document.querySelector('.day-row.is-today');
      if (todayRow) {
        setTimeout(function () { todayRow.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 150);
      }
    }

    Notifications.check();
  }

  // ── AI coach chat -- a real multi-turn conversation, not a single ask-and-forget box ──
  function renderCoachChat() {
    var app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(el('<div class="subnav">' + headerIconsHtml(null) + '</div>'));
    wireHeaderIcons();

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var raceDate = parseDate(state.raceGoal.raceDate);
    var planLengthWeeks = state.planMeta.planLengthWeeks;
    var result = generateAll(state.profile, state.raceGoal, state.planMeta, state.logs, today);
    var weeks = result.weeks;

    var currentWeek = 1;
    weeks.forEach(function (wk) {
      wk.days.forEach(function (dd, di) {
        var d = dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di);
        if (sameDate(d, today)) currentWeek = wk.weekNum;
      });
    });

    var daysByKey = {};
    var daysPayload = [];
    [currentWeek - 1, currentWeek].forEach(function (wIdx) {
      if (wIdx < 0 || wIdx >= weeks.length) return;
      var wk = weeks[wIdx];
      wk.days.forEach(function (dd, di) {
        if (dd.type === 'race') return; // never let chat touch race day
        var dt = dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di);
        var key = wk.weekNum + '-' + di;
        var effectiveLabel = state.overrides[key] || dd.label;
        var logEntry = getLog(key);
        daysByKey[key] = { effectiveLabel: effectiveLabel, baseLabel: dd.label, type: dd.type, date: dt, miles: dd.miles || null };
        daysPayload.push({
          key: key, dow: DOW_FULL[dt.getDay()], date: dateToISO(dt), label: effectiveLabel, type: dd.type,
          plannedDistance: dd.miles || null, log: logEntry
        });
      });
    });

    function findSourceKey(excludeKey, type) {
      return Object.keys(daysByKey).filter(function (k) { return k !== excludeKey && daysByKey[k].type === type; })[0];
    }
    function applyMarkRest(key, note) {
      var day = daysByKey[key];
      var label = 'Rest' + (note ? ' — ' + note : '');
      if (day && label === day.baseLabel) delete state.overrides[key]; else state.overrides[key] = label;
      saveState(state);
    }
    function applySubstitute(key, newType) {
      var day = daysByKey[key];
      var sourceKey = findSourceKey(key, newType);
      if (!sourceKey) return false;
      var newLabel = daysByKey[sourceKey].effectiveLabel;
      if (newLabel === day.baseLabel) delete state.overrides[key]; else state.overrides[key] = newLabel;
      saveState(state);
      return true;
    }
    function applyLogUnplanned(key, note) {
      setLog(key, { notes: note || null });
    }
    function applyReduceIntensity(key, factor) {
      var day = daysByKey[key];
      if (!day || day.miles == null || (day.type !== 'easy' && day.type !== 'long')) return false;
      var newMiles = round1(day.miles * factor);
      var terrainNote = terrainNoteFrom(state.profile.terrains);
      var newLabel = day.type === 'long' ? formatLongRunLabel(newMiles, terrainNote) : formatEasyRunLabel(newMiles);
      if (newLabel === day.baseLabel) delete state.overrides[key]; else state.overrides[key] = newLabel;
      saveState(state);
      return true;
    }
    // Reuses the same applySideQuest the deterministic "Not feeling this
    // run?" button flow uses -- one shared apply path for both, not two.
    function applySideQuestChat(key, sideQuestId) {
      var day = daysByKey[key];
      var quest = missionById(sideQuestId);
      var replaces = quest && (quest.replaces || quest.canReplaceWorkoutTypes || []);
      if (!day || !quest || replaces.indexOf(day.type) === -1) return false;
      if (quest.name === day.baseLabel) delete state.overrides[key]; else state.overrides[key] = quest.name;
      state.sideQuestLog.push({ id: quest.id, key: key, date: dateToISO(new Date()), category: completionCategory(quest), rewardPoints: quest.xpReward || quest.rewardPoints || 0, relationship: quest.relationshipLabel || 'Can replace an easy Main Mission' });
      awardSideMissionXp('sidemission|' + quest.id + '|' + key + '|' + dateToISO(new Date()), quest.xpReward || quest.rewardPoints || 0, { key: key });
      refreshPathProgress();
      return true;
    }

    // Returns { text, confirmable } -- confirmable:false means show the text
    // as an explanatory note with no Confirm button, since acting on it would
    // either do nothing or isn't something this action type can actually do.
    function actionConfirmText(action, day) {
      if (action.type === 'mark_rest') {
        return { text: 'Mark ' + DOW_FULL[day.date.getDay()] + ' as rest' + (action.note ? ' — ' + escapeHtml(action.note) : '') + '?', confirmable: true };
      }
      if (action.type === 'substitute_workout') {
        var sourceKey = findSourceKey(action.key, action.newType);
        if (!sourceKey) return null;
        var newLabel = daysByKey[sourceKey].effectiveLabel;
        if (newLabel === day.effectiveLabel) {
          return { text: DOW_FULL[day.date.getDay()] + ' is already ' + escapeHtml(newLabel) + ' — nothing to change there. If you need a specific distance, tap the workout text on that day to edit it directly.', confirmable: false };
        }
        return { text: 'Change ' + DOW_FULL[day.date.getDay()] + ' (' + escapeHtml(day.effectiveLabel) + ') to ' + escapeHtml(newLabel) + '?', confirmable: true };
      }
      if (action.type === 'log_unplanned_activity') {
        return { text: 'Log &ldquo;' + escapeHtml(action.note || '') + '&rdquo; for ' + DOW_FULL[day.date.getDay()] + ' instead of the scheduled workout? The plan itself won’t change.', confirmable: true };
      }
      if (action.type === 'reduce_intensity') {
        if (day.miles == null) return { text: "Can't scale that day down — it doesn't have a plain distance to reduce.", confirmable: false };
        var newMiles = round1(day.miles * action.factor);
        return { text: 'Cut ' + DOW_FULL[day.date.getDay()] + ' from ' + toUnit(day.miles) + ' to about ' + toUnit(newMiles) + ' ' + unitLabel() + (action.note ? ' — ' + escapeHtml(action.note) : '') + '?', confirmable: true };
      }
      if (action.type === 'substitute_side_quest') {
        var quest = missionById(action.sideQuestId);
        var replaces = quest && (quest.replaces || quest.canReplaceWorkoutTypes || []);
        if (!quest || replaces.indexOf(day.type) === -1) {
          return { text: "That option doesn't fit today's workout — tap Not feeling this run? on the day itself to see real options.", confirmable: false };
        }
        if (quest.name === day.effectiveLabel) {
          return { text: DOW_FULL[day.date.getDay()] + ' is already ' + escapeHtml(quest.name) + ' — nothing to change there.', confirmable: false };
        }
        return { text: 'Swap ' + DOW_FULL[day.date.getDay()] + ' (' + escapeHtml(day.effectiveLabel) + ') for ' + escapeHtml(quest.name) + (action.note ? ' — ' + escapeHtml(action.note) : '') + '?', confirmable: true };
      }
      return null;
    }

    var messagesHtml = coachHistory.map(function (turn, idx) {
      if (turn.role === 'user') {
        return '<div class="coach-turn coach-turn--user">' + escapeHtml(turn.text) + '</div>';
      }
      var actionHtml = '';
      if (turn.action && !turn.resolved) {
        var day = daysByKey[turn.action.key];
        var confirm = day ? actionConfirmText(turn.action, day) : null;
        if (confirm && confirm.confirmable) {
          actionHtml = '<div class="coach-action">' +
            '<div style="margin-bottom:8px">' + confirm.text + '</div>' +
            '<button type="button" class="ob-btn" data-confirm-idx="' + idx + '" style="margin-bottom:6px">Confirm</button>' +
            '<div class="ob-cancel" data-cancel-idx="' + idx + '">Cancel</div>' +
          '</div>';
        } else if (confirm) {
          actionHtml = '<div class="coach-action-status">' + confirm.text + '</div>';
        }
      } else if (turn.action && turn.resolved) {
        actionHtml = '<div class="coach-action-status">' + (turn.resolved === 'confirmed' ? '✓ Done' : 'Cancelled') + '</div>';
      }
      var redFlagHtml = (turn.redFlags && turn.redFlags.length) || turn.riskLevel === 'red'
        ? '<div class="coach-redflag">⚠ Please stop training and see a doctor' + (turn.redFlags && turn.redFlags.length ? ' — mentioned: ' + turn.redFlags.map(escapeHtml).join(', ') : '') + '. This isn’t something a training app should manage.</div>'
        : '';
      var avoidHtml = (turn.avoidToday && turn.avoidToday.length)
        ? '<div class="coach-avoid">Avoid today: ' + turn.avoidToday.map(escapeHtml).join(', ') + '</div>'
        : '';
      return '<div class="coach-turn coach-turn--coach">' + redFlagHtml + escapeHtml(turn.text) + avoidHtml + actionHtml + '</div>';
    }).join('');

    var wrap = el(
      '<div class="ob coach-screen">' +
        '<div class="ob-title">Ask your coach</div>' +
        '<div class="coach-thread" id="coachThread">' + (messagesHtml || '<p class="recap-empty">Ask about today\'s workout, how you\'re feeling, or anything training-related.</p>') + '</div>' +
        (coachWaiting ? '<div class="coach-turn coach-turn--coach coach-turn--waiting">Thinking...</div>' : '') +
        '<div class="coach-input-row">' +
          '<input class="ob-input" type="text" id="coachInput" placeholder="e.g. My back hurts a little">' +
          '<button type="button" class="ob-btn" id="coachSendBtn" style="margin-top:8px">Send</button>' +
        '</div>' +
        '<div class="ob-cancel" id="coachBackBtn" style="margin-top:14px">Back to plan</div>' +
      '</div>'
    );
    app.appendChild(wrap);
    document.getElementById('coachBackBtn').addEventListener('click', renderMain);

    var thread = document.getElementById('coachThread');
    thread.scrollTop = thread.scrollHeight;

    wrap.querySelectorAll('[data-confirm-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var turn = coachHistory[parseInt(btn.getAttribute('data-confirm-idx'), 10)];
        var ok = true;
        if (turn.action.type === 'mark_rest') applyMarkRest(turn.action.key, turn.action.note);
        else if (turn.action.type === 'substitute_workout') ok = applySubstitute(turn.action.key, turn.action.newType);
        else if (turn.action.type === 'log_unplanned_activity') applyLogUnplanned(turn.action.key, turn.action.note);
        else if (turn.action.type === 'reduce_intensity') ok = applyReduceIntensity(turn.action.key, turn.action.factor);
        else if (turn.action.type === 'substitute_side_quest') ok = applySideQuestChat(turn.action.key, turn.action.sideQuestId);
        turn.resolved = ok ? 'confirmed' : 'failed';
        renderCoachChat();
      });
    });
    wrap.querySelectorAll('[data-cancel-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        coachHistory[parseInt(btn.getAttribute('data-cancel-idx'), 10)].resolved = 'cancelled';
        renderCoachChat();
      });
    });

    var input = document.getElementById('coachInput');
    var sendBtn = document.getElementById('coachSendBtn');
    if (coachWaiting) { sendBtn.disabled = true; input.disabled = true; }
    input.focus();

    function send() {
      var req = input.value.trim();
      if (!req || coachWaiting) return;

      var history = coachHistory.slice(-10).map(function (t) {
        return { role: t.role === 'user' ? 'user' : 'assistant', content: t.text };
      });

      coachHistory.push({ role: 'user', text: req });
      coachWaiting = true;
      renderCoachChat();

      fetch('/.netlify/functions/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: req,
          today: dateToISO(today),
          days: daysPayload,
          plan: (function () {
            var p = {
              event: state.raceGoal.event, goal: state.raceGoal.goal, experienceLevel: state.planMeta.level,
              phase: weeks[currentWeek - 1] ? weeks[currentWeek - 1].phase : null,
              currentWeek: currentWeek, totalWeeks: planLengthWeeks
            };
            // Real pace data, only when the runner actually supplied a recent race
            // result -- coach.js is instructed to use this instead of guessing at
            // a pace, and to stay RPE-only when it's absent (roadmap §10).
            var paceRange = computeEasyPaceRange(state.profile);
            if (paceRange) p.easyPaceRangeSecPerMi = [paceRange.loSecPerMi, paceRange.hiSecPerMi];
            // All named quality/interval pace zones at once (5K/10K/half/
            // marathon/threshold) -- the model matches a zone against
            // whichever day's own label it's discussing, it never picks one
            // itself, so this isn't tied to any single day in the payload.
            var qualityZones = computeAllQualityPaceZones(state.profile);
            if (qualityZones) p.qualityPaceZonesSecPerMi = qualityZones;
            return p;
          })(),
          sideQuests: SideQuestDomain.MISSION_CATALOG && SideQuestDomain.missionSummaryForCoach ? SideQuestDomain.MISSION_CATALOG.map(SideQuestDomain.missionSummaryForCoach) : SIDE_QUESTS,
          history: history
        })
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (result2) {
        if (!result2.ok || result2.data.error) {
          coachHistory.push({ role: 'coach', text: (result2.data && result2.data.error) || "Couldn't reach the AI coach right now.", action: null, resolved: null });
        } else {
          coachHistory.push({
            role: 'coach', text: result2.data.message || '', action: result2.data.action || null, resolved: null,
            riskLevel: result2.data.riskLevel || 'green', avoidToday: result2.data.avoidToday || [], redFlags: result2.data.redFlags || []
          });
        }
      }).catch(function () {
        coachHistory.push({ role: 'coach', text: "Couldn't reach the AI coach right now.", action: null, resolved: null });
      }).finally(function () {
        coachWaiting = false;
        renderCoachChat();
      });
    }

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  }

  function crossOptionsHtml(selected) {
    var html = '<option value=""' + (!selected ? ' selected' : '') + '>Cross-train</option>';
    CROSS_OPTIONS.filter(function (t) { return t !== 'None'; }).forEach(function (t) {
      html += '<option value="' + t + '"' + (selected === t ? ' selected' : '') + '>' + t + '</option>';
    });
    return html;
  }

  function renderSafetyPanel() {
    var app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(el('<div class="subnav">' + headerIconsHtml('safetyBtn') + '</div>'));
    wireHeaderIcons();
    var wrap = el(
      '<div class="ob">' +
        '<div class="ob-title">When to stop and see a doctor</div>' +
        '<div class="ob-sub">Seek medical evaluation if you experience any of these</div>' +
        '<ul class="red-flag-list">' +
          RED_FLAGS.map(function (f) { return '<li>' + escapeHtml(f) + '</li>'; }).join('') +
        '</ul>' +
        '<div class="legal-notice">' +
          '<p><strong>Runner is not a medical provider.</strong> It does not diagnose injuries, illness, or any medical condition, and nothing in this app — including the AI coach — is medical advice. Seek care from a qualified professional for any concerning symptom.</p>' +
          '<p>A training plan, even one that adjusts carefully to how you\'re doing, cannot eliminate the risk of injury. You\'re responsible for choosing safe routes and environments — outdoor conditions and traffic require your own judgment.</p>' +
          '<p>Data imported from wearables can be inaccurate, and AI coaching recommendations may occasionally be imperfect. When in doubt, choose the more conservative option or see a doctor.</p>' +
        '</div>' +
        '<button class="ob-btn" id="safetyBackBtn">Back to plan</button>' +
      '</div>'
    );
    app.appendChild(wrap);
    document.getElementById('safetyBackBtn').addEventListener('click', renderMain);
  }

  function renderGlossaryPanel() {
    var app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(el('<div class="subnav">' + headerIconsHtml('glossaryBtn') + '</div>'));
    wireHeaderIcons();
    function defList(entries) {
      return '<dl class="glossary-list">' + entries.map(function (e) {
        return '<dt>' + escapeHtml(e[0]) + '</dt><dd>' + escapeHtml(e[1]) + '</dd>';
      }).join('') + '</dl>';
    }
    var wrap = el(
      '<div class="ob">' +
        '<div class="ob-title">What this all means</div>' +
        '<div class="ob-sub">Workout types</div>' +
        defList(GLOSSARY_WORKOUTS) +
        '<div class="ob-sub" style="margin-top:14px">Plan phases</div>' +
        defList(GLOSSARY_PHASES) +
        '<button class="ob-btn" id="glossaryBackBtn">Back to plan</button>' +
      '</div>'
    );
    app.appendChild(wrap);
    document.getElementById('glossaryBackBtn').addEventListener('click', renderMain);
  }

  function renderWorkoutDetail(weekNum, dayIdx) {
    var app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(el('<div class="subnav">' + headerIconsHtml(null) + '</div>'));
    wireHeaderIcons();

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var raceDate = parseDate(state.raceGoal.raceDate);
    var planLengthWeeks = state.planMeta.planLengthWeeks;
    var result = generateAll(state.profile, state.raceGoal, state.planMeta, state.logs, today);
    var dayData = result.weeks[weekNum - 1].days[dayIdx];
    var key = weekNum + '-' + dayIdx;
    var d = dateForSlot(raceDate, planLengthWeeks, weekNum, dayIdx);
    var label = state.overrides[key] || dayData.label;
    var loggable = isLoggable(label);
    var race = isRace(label);
    var detail = WORKOUT_DETAIL[dayData.type] || null;
    var entry = getLog(key) || {};

    // Only shown when the runner actually supplied a recent race result --
    // otherwise this stays RPE/talk-test-only like every other workout type,
    // per the roadmap's "avoid false precision" rule. `targetPaceRange` is
    // kept (not just the formatted string) so the Planned vs. Actual block
    // and interpretRunResult below can compare a logged run against it.
    var paceRow = '';
    var targetPaceRange = null;
    if (dayData.type === 'easy' || dayData.type === 'long') {
      targetPaceRange = computeEasyPaceRange(state.profile);
      if (targetPaceRange) {
        var loDisplay = state.units === 'km' ? targetPaceRange.loSecPerMi / KM_PER_MI : targetPaceRange.loSecPerMi;
        var hiDisplay = state.units === 'km' ? targetPaceRange.hiSecPerMi / KM_PER_MI : targetPaceRange.hiSecPerMi;
        paceRow = '<dt>Estimated pace</dt><dd>' + formatPace(loDisplay) + '&ndash;' + formatPace(hiDisplay) + ' /' + unitLabel() +
          ' &mdash; a range from your recent ' + RACE_RESULT_LABEL[state.profile.recentRaceDistance] + ' time, not a target. Go by feel first.</dd>';
      }
    } else if (dayData.type === 'quality') {
      // Only for labels that actually name a pace zone (e.g. "@ 10K pace",
      // "Tempo: ... @ threshold") -- effort-based work like Fartlek or hill
      // repeats never gets a pace quoted, matching GLOSSARY_WORKOUTS' own
      // description of those as "by feel," not a pace target.
      targetPaceRange = computeQualityPaceRange(state.profile, label);
      if (targetPaceRange) {
        var qLoDisplay = state.units === 'km' ? targetPaceRange.loSecPerMi / KM_PER_MI : targetPaceRange.loSecPerMi;
        var qHiDisplay = state.units === 'km' ? targetPaceRange.hiSecPerMi / KM_PER_MI : targetPaceRange.hiSecPerMi;
        paceRow = '<dt>Estimated pace</dt><dd>' + formatPace(qLoDisplay) + '&ndash;' + formatPace(qHiDisplay) + ' /' + unitLabel() +
          ' &mdash; estimated ' + QUALITY_PACE_ZONE_LABEL[targetPaceRange.zone] + ' pace from your recent ' + RACE_RESULT_LABEL[state.profile.recentRaceDistance] + ' time, not a target. Go by feel first.</dd>';
      }
    }

    // ── Planned vs. Actual review (docs/RACR_RunLogging_Correction.md) ──
    // Only shown once something's actually been logged -- planned data is
    // never overwritten by the actual result, both stay visible together.
    var plannedVsActualHtml = '';
    if (loggable && (entry.distance != null || entry.time)) {
      var actualSecs = parseDurationToSeconds(entry.time);
      var actualPaceSecPerMi = computeActualPaceSecPerMi(entry.distance, actualSecs);
      var actualPaceDisplay = actualPaceSecPerMi ?
        formatPace(state.units === 'km' ? actualPaceSecPerMi / KM_PER_MI : actualPaceSecPerMi) + ' /' + unitLabel() : '&mdash;';
      var interpretation = interpretRunResult(dayData, entry, targetPaceRange);
      plannedVsActualHtml =
        '<div class="wd-review">' +
          '<div class="wd-review-col">' +
            '<div class="wd-review-label">Planned</div>' +
            '<dl class="wd-info">' +
              (dayData.miles ? '<dt>Distance</dt><dd>' + toUnit(dayData.miles) + ' ' + unitLabel() + '</dd>' : '') +
              (targetPaceRange ? '<dt>Target pace</dt><dd>' + formatPace(state.units === 'km' ? targetPaceRange.loSecPerMi / KM_PER_MI : targetPaceRange.loSecPerMi) + '&ndash;' + formatPace(state.units === 'km' ? targetPaceRange.hiSecPerMi / KM_PER_MI : targetPaceRange.hiSecPerMi) + ' /' + unitLabel() + '</dd>' : '') +
            '</dl>' +
          '</div>' +
          '<div class="wd-review-col">' +
            '<div class="wd-review-label">Actual</div>' +
            '<dl class="wd-info">' +
              (entry.distance != null ? '<dt>Distance</dt><dd>' + toUnit(entry.distance) + ' ' + unitLabel() + '</dd>' : '') +
              (entry.time ? '<dt>Duration</dt><dd>' + escapeHtml(entry.time) + '</dd>' : '') +
              '<dt>Pace</dt><dd>' + actualPaceDisplay + '</dd>' +
              (entry.effort ? '<dt>Effort</dt><dd>RPE ' + entry.effort + '</dd>' : '') +
            '</dl>' +
          '</div>' +
        '</div>' +
        (interpretation ? '<p class="wd-interpretation">' + escapeHtml(interpretation) + '</p>' : '');
    }

    var detailHtml = detail ? (
      '<dl class="wd-info">' +
        '<dt>What</dt><dd>' + escapeHtml(detail.what) + '</dd>' +
        '<dt>Why</dt><dd>' + escapeHtml(detail.why) + '</dd>' +
        '<dt>How hard</dt><dd>' + escapeHtml(detail.howHard) + '</dd>' +
        paceRow +
        '<dt>If I can&rsquo;t</dt><dd>' + escapeHtml(detail.ifCant) + '</dd>' +
        '<dt>Common mistake</dt><dd>' + escapeHtml(detail.mistakes) + '</dd>' +
      '</dl>'
    ) : '';

    var rpeChips = '';
    for (var i = 1; i <= 10; i++) {
      rpeChips += '<button type="button" class="rpe-chip" data-rpe="' + i + '">' + i + '</button>';
    }

    var completionSelected = entry.completionType || 'planned';

    var logHtml = loggable ? (
      '<div class="wd-log">' +
        (GoogleHealth.isConnected ? '<div class="pain-toggle" id="ghImportBtn">Import from Google Health</div><div class="ai-why-result" id="ghImportResult" style="display:none"></div>' : '') +
        '<div class="ob-label">Duration</div>' +
        '<input class="ob-input" type="text" id="wd_time" placeholder="e.g. 32:10 or 1:15:00" value="' + escapeHtml(entry.time || '') + '">' +
        '<div class="ob-label">Distance (' + unitLabel() + ')</div>' +
        '<input class="ob-input" type="number" min="0" step="0.1" id="wd_distance" value="' + (entry.distance != null ? toUnit(entry.distance) : '') + '">' +
        '<div class="ob-label">Pace</div>' +
        '<div class="wd-computed-pace" id="wd_pace_display">&mdash;</div>' +
        '<div class="ob-label">Effort (RPE 1&ndash;10)</div>' +
        '<div class="chip-grid" id="wd_rpe">' + rpeChips + '</div>' +
        '<div class="ob-label">Completion</div>' +
        '<div class="chip-grid" id="wd_completion">' + chipsHtml('completion', COMPLETION_TYPES, COMPLETION_TYPE_LABEL, completionSelected, false) + '</div>' +
        '<div class="ob-label">Notes</div>' +
        '<textarea class="ob-input wd-notes" id="wd_notes" rows="3" placeholder="How did it feel?">' + escapeHtml(entry.notes || '') + '</textarea>' +
        '<div class="pain-toggle" id="painToggle">' + (entry.pain ? 'Update pain report' : 'Report pain or discomfort') + '</div>' +
        '<div class="pain-form" id="painForm" style="display:' + (entry.pain ? 'block' : 'none') + '">' +
          '<div class="ob-label">Where?</div>' +
          '<div class="chip-grid" id="pain_location">' + chipsHtml('painLoc', PAIN_LOCATIONS, null, entry.pain ? entry.pain.location : null, false) + '</div>' +
          '<div class="ob-label">Severity (1&ndash;10)</div>' +
          '<div class="chip-grid" id="pain_severity">' + rpeChips.replace(/rpe-chip/g, 'rpe-chip pain-chip') + '</div>' +
          '<div class="ob-label">Gets worse while running?</div>' +
          '<div class="chip-grid" id="pain_worsens">' + chipsHtml('painWorsens', ['no', 'yes'], { no: 'No', yes: 'Yes' }, entry.pain ? (entry.pain.worsens ? 'yes' : 'no') : null, false) + '</div>' +
          '<div class="ob-label">Can you walk normally?</div>' +
          '<div class="chip-grid" id="pain_walk">' + chipsHtml('painWalk', ['yes', 'no'], { yes: 'Yes', no: 'No' }, entry.pain ? (entry.pain.canWalk ? 'yes' : 'no') : null, false) + '</div>' +
          '<div class="pain-guidance" id="painGuidance" style="display:none"></div>' +
        '</div>' +
      '</div>'
    ) : '';

    var wrap = el(
      '<div class="ob wd">' +
        '<div class="wd-date mono">' + DOW_FULL[d.getDay()] + ' &middot; ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + '</div>' +
        '<div class="ob-title wd-title' + (race ? ' is-race' : '') + '">' + escapeHtml(label) + '</div>' +
        detailHtml +
        plannedVsActualHtml +
        (detail ? '<div class="ai-why"><button type="button" class="ai-why-btn" id="aiWhyBtn">Ask AI: why this workout?</button><div class="ai-why-result" id="aiWhyResult" style="display:none"></div></div>' : '') +
        ((dayData.type === 'easy' || dayData.type === 'cross') ? '<div class="pain-toggle" id="switchItUpBtn">Not feeling this run?</div>' : '') +
        logHtml +
        (loggable ? '<button class="ob-btn" id="wdSaveBtn">Save</button>' : '') +
        '<div class="ob-cancel" id="wdBackBtn">Back to plan</div>' +
      '</div>'
    );
    app.appendChild(wrap);

    var switchItUpBtn = document.getElementById('switchItUpBtn');
    if (switchItUpBtn) {
      switchItUpBtn.addEventListener('click', function () { renderSwitchItUp(weekNum, dayIdx); });
    }

    if (detail) {
      var aiWhyBtn = document.getElementById('aiWhyBtn');
      var aiWhyResult = document.getElementById('aiWhyResult');
      aiWhyBtn.addEventListener('click', function () {
        aiWhyBtn.disabled = true;
        aiWhyBtn.textContent = 'Asking...';
        aiWhyResult.style.display = 'block';
        aiWhyResult.className = 'ai-why-result';
        aiWhyResult.textContent = '';
        var context = {
          day: {
            type: dayData.type,
            label: label,
            plannedDistance: dayData.miles ? toUnit(dayData.miles) : null,
            unit: unitLabel()
          },
          plan: {
            event: state.raceGoal.event,
            goal: state.raceGoal.goal,
            experienceLevel: state.planMeta.level,
            weekNum: weekNum,
            totalWeeks: planLengthWeeks,
            phase: result.weeks[weekNum - 1].phase,
            isUnsafe: !!state.planMeta.unsafe
          }
        };
        fetch('/.netlify/functions/why-workout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(context)
        }).then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        }).then(function (result2) {
          if (!result2.ok || !result2.data.explanation) {
            throw new Error((result2.data && result2.data.error) || 'Request failed');
          }
          aiWhyResult.textContent = result2.data.explanation;
        }).catch(function () {
          aiWhyResult.className = 'ai-why-result ai-why-error';
          aiWhyResult.textContent = "Couldn't reach the AI coach right now -- the explanation above still applies.";
        }).finally(function () {
          aiWhyBtn.disabled = false;
          aiWhyBtn.textContent = 'Ask AI: why this workout?';
        });
      });
    }

    if (loggable) {
      if (GoogleHealth.isConnected) {
        var ghImportBtn = document.getElementById('ghImportBtn');
        var ghImportResult = document.getElementById('ghImportResult');
        ghImportBtn.addEventListener('click', function () {
          ghImportBtn.textContent = 'Checking...';
          ghImportResult.style.display = 'none';
          GoogleHealth.fetchActivitiesForDate(dateToISO(d)).then(function (result) {
            ghImportBtn.textContent = 'Import from Google Health';
            if (result.error || !result.sessions.length) {
              ghImportResult.style.display = 'block';
              ghImportResult.className = 'ai-why-result ai-why-error';
              ghImportResult.textContent = result.error ? "Couldn't reach Google Health right now." : 'No activity found for this day.';
              return;
            }
            ghImportResult.style.display = 'block';
            ghImportResult.className = 'ai-why-result';
            ghImportResult.innerHTML = '';
            result.sessions.forEach(function (s, i) {
              var summary = (s.displayName || s.exerciseType) +
                (s.distanceMiles ? ' &middot; ' + toUnit(s.distanceMiles) + ' ' + unitLabel() : '') +
                (s.durationMinutes ? ' &middot; ' + s.durationMinutes + ' min' : '');
              var row = el('<button type="button" class="ob-btn ob-btn-secondary" style="margin-top:' + (i ? '8px' : '0') + '">' + summary + '</button>');
              row.addEventListener('click', function () {
                if (s.distanceMiles != null) document.getElementById('wd_distance').value = toUnit(s.distanceMiles);
                if (s.durationMinutes != null) document.getElementById('wd_time').value = s.durationMinutes + ':00';
                ghImportResult.style.display = 'none';
              });
              ghImportResult.appendChild(row);
            });
          });
        });
      }

      var effortSelected = entry.effort || null;
      var rpeWrap = document.getElementById('wd_rpe');
      function paintRpe() {
        rpeWrap.querySelectorAll('.rpe-chip').forEach(function (c) {
          c.classList.toggle('selected', parseInt(c.getAttribute('data-rpe'), 10) === effortSelected);
        });
      }
      paintRpe();
      rpeWrap.querySelectorAll('.rpe-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          var v = parseInt(chip.getAttribute('data-rpe'), 10);
          effortSelected = effortSelected === v ? null : v;
          paintRpe();
        });
      });

      // Live pace = duration / distance as the runner types, matching the
      // spec's "automatically calculate average pace" requirement -- not
      // just a post-save review, but visible while filling in the form.
      var wdTimeInput = document.getElementById('wd_time');
      var wdDistanceInput = document.getElementById('wd_distance');
      var wdPaceDisplay = document.getElementById('wd_pace_display');
      function updateComputedPaceDisplay() {
        var distMiles = wdDistanceInput.value !== '' ? fromUnit(parseFloat(wdDistanceInput.value)) : null;
        var secs = parseDurationToSeconds(wdTimeInput.value.trim());
        var pace = computeActualPaceSecPerMi(distMiles, secs);
        wdPaceDisplay.textContent = pace ? formatPace(state.units === 'km' ? pace / KM_PER_MI : pace) + ' /' + unitLabel() : '—';
      }
      updateComputedPaceDisplay();
      wdTimeInput.addEventListener('input', updateComputedPaceDisplay);
      wdDistanceInput.addEventListener('input', updateComputedPaceDisplay);

      var completionWrap = document.getElementById('wd_completion');
      completionWrap.querySelectorAll('.chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          completionSelected = chip.getAttribute('data-value');
          completionWrap.querySelectorAll('.chip').forEach(function (c) {
            c.classList.toggle('selected', c.getAttribute('data-value') === completionSelected);
          });
        });
      });

      var painToggle = document.getElementById('painToggle');
      var painForm = document.getElementById('painForm');
      painToggle.addEventListener('click', function () {
        painForm.style.display = painForm.style.display === 'none' ? 'block' : 'none';
      });

      var painLocation = entry.pain ? entry.pain.location : null;
      var painSeverity = entry.pain ? entry.pain.severity : null;
      var painWorsens = entry.pain ? entry.pain.worsens : null;
      var painCanWalk = entry.pain ? entry.pain.canWalk : null;
      var painGuidanceEl = document.getElementById('painGuidance');

      function updatePainGuidance() {
        if (painSeverity == null || painWorsens == null || painCanWalk == null) {
          painGuidanceEl.style.display = 'none';
          return;
        }
        var g = painGuidance(painSeverity, painWorsens, painCanWalk);
        painGuidanceEl.className = 'pain-guidance pain-guidance--' + g.level;
        painGuidanceEl.textContent = g.text;
        painGuidanceEl.style.display = 'block';
      }
      updatePainGuidance();
      document.querySelectorAll('#pain_severity .rpe-chip').forEach(function (c) {
        c.classList.toggle('selected', parseInt(c.getAttribute('data-rpe'), 10) === painSeverity);
      });

      document.querySelectorAll('#pain_location .chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          var v = chip.getAttribute('data-value');
          painLocation = painLocation === v ? null : v;
          document.querySelectorAll('#pain_location .chip').forEach(function (c) {
            c.classList.toggle('selected', c.getAttribute('data-value') === painLocation);
          });
        });
      });
      document.querySelectorAll('#pain_severity .rpe-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          var v = parseInt(chip.getAttribute('data-rpe'), 10);
          painSeverity = painSeverity === v ? null : v;
          document.querySelectorAll('#pain_severity .rpe-chip').forEach(function (c) {
            c.classList.toggle('selected', parseInt(c.getAttribute('data-rpe'), 10) === painSeverity);
          });
          updatePainGuidance();
        });
      });
      document.querySelectorAll('#pain_worsens .chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          painWorsens = chip.getAttribute('data-value') === 'yes';
          document.querySelectorAll('#pain_worsens .chip').forEach(function (c) {
            c.classList.toggle('selected', c.getAttribute('data-value') === (painWorsens ? 'yes' : 'no'));
          });
          updatePainGuidance();
        });
      });
      document.querySelectorAll('#pain_walk .chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          painCanWalk = chip.getAttribute('data-value') === 'yes';
          document.querySelectorAll('#pain_walk .chip').forEach(function (c) {
            c.classList.toggle('selected', c.getAttribute('data-value') === (painCanWalk ? 'yes' : 'no'));
          });
          updatePainGuidance();
        });
      });

      document.getElementById('wdSaveBtn').addEventListener('click', function () {
        var time = document.getElementById('wd_time').value.trim();
        var distanceRaw = document.getElementById('wd_distance').value;
        var notes = document.getElementById('wd_notes').value.trim();
        // only persist a pain report once the three fields the guidance depends on
        // are all answered -- a partial report can't be shown back unambiguously
        var pain = (painSeverity != null && painWorsens != null && painCanWalk != null) ?
          { location: painLocation, severity: painSeverity, worsens: painWorsens, canWalk: painCanWalk } : null;
        logAndCelebrate(key, {
          time: time || null,
          distance: distanceRaw !== '' ? fromUnit(parseFloat(distanceRaw)) : null,
          effort: effortSelected,
          notes: notes || null,
          pain: pain,
          completionType: completionSelected
        }, dayData.type, result.weeks, dayData, label);
        renderMain();
      });
    }
    document.getElementById('wdBackBtn').addEventListener('click', renderMain);
  }

  // ── Side Quests: "Not feeling this run?" flow (docs/Runner_SideQuest_Spec.md) ──
  // Fully deterministic -- no AI call. Ask why, filter the fixed catalog by
  // reason + day type, offer real substitutions, apply one if chosen.
  function renderSwitchItUp(weekNum, dayIdx) {
    var app = document.getElementById('app');
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var raceDate = parseDate(state.raceGoal.raceDate);
    var planLengthWeeks = state.planMeta.planLengthWeeks;
    var result = generateAll(state.profile, state.raceGoal, state.planMeta, state.logs, today);
    var dayData = result.weeks[weekNum - 1].days[dayIdx];
    var key = weekNum + '-' + dayIdx;
    var baseLabel = state.overrides[key] || dayData.label;
    var selectedReason = null;
    var showingOptions = false;

    function render() {
      app.innerHTML = '';
      app.appendChild(el('<div class="subnav">' + headerIconsHtml(null) + '</div>'));
      wireHeaderIcons();

      var body;
      if (!showingOptions) {
        body =
          '<div class="ob-title">Not feeling this run?</div>' +
          '<div class="ob-sub">Why do you want to change today&rsquo;s workout?</div>' +
          '<div class="chip-grid">' + chipsHtml('switchReason', SIDE_QUEST_REASONS, SIDE_QUEST_REASON_LABEL, selectedReason, false) + '</div>' +
          '<button class="ob-btn" id="seeOptionsBtn"' + (selectedReason ? '' : ' disabled') + '>See options</button>' +
          '<div class="ob-cancel" id="switchBackBtn">Never mind, keep today&rsquo;s run</div>';
      } else if (selectedReason === 'pain') {
        body =
          '<div class="ob-title">Let&rsquo;s log that properly</div>' +
          '<div class="ob-sub">Pain and discomfort get a real pain report, not a Side Mission swap.</div>' +
          '<button class="ob-btn" id="goToPainBtn">Report pain or discomfort</button>' +
          '<div class="ob-cancel" id="switchBackBtn">Never mind, keep today&rsquo;s run</div>';
      } else {
        var quests = questsForReason(selectedReason, dayData.type);
        body =
          '<div class="ob-title">Choose today&rsquo;s Side Mission</div>' +
          '<div class="ob-sub">Still training for your race &mdash; just a different way today.</div>' +
          (quests.length ? quests.map(function (q, i) {
            return '<div class="quest-card">' +
              '<div class="quest-name">' + escapeHtml(q.name) + '</div>' +
              '<div class="quest-desc">' + escapeHtml(q.description) + '</div>' +
              '<div class="quest-meta">' + q.estimatedMinutes + ' min &middot; ' + (SIDE_QUEST_LOAD_LABEL[q.trainingLoad] || '') + ' effort &middot; ' + q.rewardPoints + ' pts</div>' +
              '<div class="quest-replaces">Replaces: today&rsquo;s ' + escapeHtml(baseLabel) + '</div>' +
              '<button type="button" class="ob-btn ob-btn-secondary quest-btn" data-quest-idx="' + i + '">Replace today&rsquo;s workout</button>' +
            '</div>';
          }).join('') : '<p class="recap-empty">No good options for that reason right now &mdash; keeping today as scheduled is the safest call.</p>') +
          '<div class="ob-cancel" id="switchBackBtn">Never mind, keep today&rsquo;s run</div>';
      }

      var wrap = el('<div class="ob">' + body + '</div>');
      app.appendChild(wrap);

      var backBtn = document.getElementById('switchBackBtn');
      if (backBtn) backBtn.addEventListener('click', function () { renderWorkoutDetail(weekNum, dayIdx); });

      if (!showingOptions) {
        wrap.querySelectorAll('.chip[data-group="switchReason"]').forEach(function (chip) {
          chip.addEventListener('click', function () {
            selectedReason = chip.getAttribute('data-value');
            render();
          });
        });
        var seeOptionsBtn = document.getElementById('seeOptionsBtn');
        if (seeOptionsBtn) seeOptionsBtn.addEventListener('click', function () {
          if (!selectedReason) return;
          showingOptions = true;
          render();
        });
      } else if (selectedReason === 'pain') {
        document.getElementById('goToPainBtn').addEventListener('click', function () {
          renderWorkoutDetail(weekNum, dayIdx);
          var toggle = document.getElementById('painToggle');
          var form = document.getElementById('painForm');
          if (toggle && form) { form.style.display = 'block'; toggle.textContent = 'Update pain report'; }
          showToast("Let's log that as pain instead.");
        });
      } else {
        var quests2 = questsForReason(selectedReason, dayData.type);
        wrap.querySelectorAll('.quest-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var quest = quests2[parseInt(btn.getAttribute('data-quest-idx'), 10)];
            applySideQuest(key, quest, baseLabel);
            renderMain();
            showToast('Swapped in: ' + quest.name + '.');
          });
        });
      }
    }

    render();
  }

  function renderSettings() {
    var app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(el('<div class="subnav">' + headerIconsHtml('gearBtn') + '</div>'));
    wireHeaderIcons();
    var wrap = el(
      '<div class="ob">' +
        '<div class="ob-title">Settings</div>' +
        '<div class="ob-label">Your name</div>' +
        '<input class="ob-input" type="text" id="set_name" value="' + escapeHtml(state.userName || '') + '">' +
        '<div class="ob-label">Units</div>' +
        '<div class="chip-grid" id="set_units">' + chipsHtml('units', ['mi', 'km'], { mi: 'Miles', km: 'Kilometers' }, state.units, false) + '</div>' +
        '<div class="ob-label" style="margin-top:26px">Time off</div>' +
        (state.unavailable.length ? '<div class="timeoff-list" id="timeoff_list">' + state.unavailable.map(function (r, i) {
          return '<div class="timeoff-row"><span>' + (r.reason === 'vacation' ? 'Away' : 'Illness') + ' &middot; ' + r.start + ' &ndash; ' + r.end + '</span><button type="button" class="timeoff-remove" data-idx="' + i + '">Remove</button></div>';
        }).join('') + '</div>' : '<p class="recap-empty">No time off marked.</p>') +
        '<input class="ob-input" type="date" id="set_toStart" style="margin-top:10px">' +
        '<input class="ob-input" type="date" id="set_toEnd" style="margin-top:8px">' +
        '<div class="chip-grid" id="set_toReason" style="margin-top:8px">' + chipsHtml('toReason', ['illness', 'vacation'], { illness: 'Illness', vacation: 'Away' }, 'illness', false) + '</div>' +
        '<button class="ob-btn ob-btn-secondary" id="markUnavailableBtn" style="margin-top:8px">Mark unavailable</button>' +
        '<div class="ob-label" style="margin-top:26px">Account &amp; sync</div>' +
        '<div id="accountSection">' + (CloudSync.isSignedIn ?
          '<p class="recap-empty">Signed in as ' + escapeHtml(CloudSync.userEmail || '') + '</p>' +
          (CloudSync.lastError ? '<div class="ai-why-result ai-why-error">' + escapeHtml(CloudSync.lastError) + '</div>' : '') +
          '<button class="ob-btn ob-btn-secondary" id="syncNowBtn">' + (CloudSync.syncing ? 'Syncing...' : 'Sync now') + '</button>' +
          '<button class="ob-btn ob-btn-secondary" id="signOutBtn" style="margin-top:8px">Sign out</button>' +
          '<button class="ob-btn ob-btn-secondary danger-btn" id="deleteCloudBtn" style="margin-top:14px">Delete my cloud data</button>' +
          '<button class="ob-btn ob-btn-secondary danger-btn" id="deleteAccountBtn" style="margin-top:8px">Delete my account permanently</button>'
          :
          '<p class="recap-empty">Sign in to back up your plan and sync it across devices. Fully optional &mdash; everything already works without it.</p>' +
          '<input class="ob-input" type="email" id="magicLinkEmail" placeholder="you@example.com">' +
          '<button class="ob-btn ob-btn-secondary" id="sendMagicLinkBtn" style="margin-top:8px">Send sign-in link</button>' +
          '<div class="ai-why-result" id="magicLinkStatus" style="display:none"></div>'
        ) + '</div>' +
        '<div class="ob-label" style="margin-top:26px">Fitness tracker</div>' +
        '<div id="googleHealthSection">' + (GoogleHealth.isConnected ?
          '<p class="recap-empty">Connected &mdash; workout detail screens can now offer to import a matching activity.</p>' +
          '<button class="ob-btn ob-btn-secondary" id="ghDisconnectBtn">Disconnect</button>'
          :
          '<p class="recap-empty">Connect Google Health (Fitbit) to import completed runs into your log. Fully optional &mdash; read-only, and the connection stays on this device only.</p>' +
          '<button class="ob-btn ob-btn-secondary" id="ghConnectBtn">Connect Google Health</button>'
        ) + '</div>' +
        '<div class="ob-label" style="margin-top:26px">Notifications</div>' +
        '<div id="notificationsSection">' + (
          !Notifications.supported ?
            '<p class="recap-empty">Not supported in this browser.</p>'
          : Notifications.permission === 'denied' ?
            '<p class="recap-empty">Notifications are blocked for this site in your browser settings &mdash; enable them there to turn this on.</p>'
          : (state.notifications.enabled && Notifications.permission === 'granted') ?
            '<p class="recap-empty">On &mdash; today\'s workout reminders, missed-workout check-ins, race countdown, and plan updates. Rule-based, never AI. Only fires while Runner is open or running in the background &mdash; exact timing depends on your browser.</p>' +
            '<button class="ob-btn ob-btn-secondary" id="notifDisableBtn">Turn off</button>'
          :
            '<p class="recap-empty">Get a nudge for today\'s workout, a missed-session check-in, race countdown, and plan updates. Fully optional and rule-based &mdash; never AI &mdash; and only fires while Runner is open or running in the background.</p>' +
            '<button class="ob-btn ob-btn-secondary" id="notifEnableBtn">Enable notifications</button>'
        ) + '</div>' +
        '<div class="ob-label" style="margin-top:26px">Your data</div>' +
        '<button class="ob-btn ob-btn-secondary" id="exportBtn">Export data (.json)</button>' +
        '<button class="ob-btn ob-btn-secondary" id="importBtn">Import data (.json)</button>' +
        '<input type="file" id="importFile" accept="application/json" style="display:none">' +
        '<div class="ob-label danger-label" style="margin-top:26px">Danger zone</div>' +
        '<button class="ob-btn ob-btn-secondary danger-btn" id="resetPlanBtn">Start a new plan</button>' +
        '<button class="ob-btn ob-btn-secondary danger-btn" id="deleteAllBtn">Delete all data</button>' +
        '<div class="ob-cancel" id="settingsBackBtn">Back to plan</div>' +
      '</div>'
    );
    app.appendChild(wrap);

    document.getElementById('set_name').addEventListener('change', function (e) {
      state.userName = e.target.value.trim();
      saveState(state);
    });

    wrap.querySelectorAll('#set_units .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.units = chip.getAttribute('data-value');
        saveState(state);
        wrap.querySelectorAll('#set_units .chip').forEach(function (c) {
          c.classList.toggle('selected', c.getAttribute('data-value') === state.units);
        });
      });
    });

    var toReason = 'illness';
    wrap.querySelectorAll('#set_toReason .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        toReason = chip.getAttribute('data-value');
        wrap.querySelectorAll('#set_toReason .chip').forEach(function (c) {
          c.classList.toggle('selected', c.getAttribute('data-value') === toReason);
        });
      });
    });
    document.getElementById('markUnavailableBtn').addEventListener('click', function () {
      var startVal = document.getElementById('set_toStart').value;
      var endVal = document.getElementById('set_toEnd').value;
      if (!startVal || !endVal || startVal > endVal) { window.alert('Pick a valid start and end date.'); return; }
      state.unavailable.push({ start: startVal, end: endVal, reason: toReason });
      saveState(state);
      renderSettings();
    });
    wrap.querySelectorAll('.timeoff-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.unavailable.splice(parseInt(btn.getAttribute('data-idx'), 10), 1);
        saveState(state);
        renderSettings();
      });
    });

    if (CloudSync.isSignedIn) {
      document.getElementById('signOutBtn').addEventListener('click', function () {
        CloudSync.signOut().then(renderSettings);
      });
      document.getElementById('syncNowBtn').addEventListener('click', function () {
        var btn = document.getElementById('syncNowBtn');
        btn.disabled = true; btn.textContent = 'Syncing...';
        CloudSync.pull().then(function () { renderSettings(); });
      });
      document.getElementById('deleteCloudBtn').addEventListener('click', function () {
        if (!window.confirm('This permanently deletes your synced backup from the cloud. Your local data on this device is not affected. Continue?')) return;
        CloudSync.deleteCloudData().then(function (res) {
          if (res.error) { window.alert('Could not delete cloud data: ' + res.error); return; }
          window.alert('Cloud data deleted.');
        });
      });
      document.getElementById('deleteAccountBtn').addEventListener('click', function () {
        if (!window.confirm('This permanently deletes your account and cloud backup. Your local data on this device is not affected. This cannot be undone. Continue?')) return;
        CloudSync.deleteAccountPermanently().then(function (res) {
          if (res.error) { window.alert('Could not delete account: ' + res.error); return; }
          window.alert('Account deleted.');
          renderSettings();
        });
      });
    } else {
      document.getElementById('sendMagicLinkBtn').addEventListener('click', function () {
        var email = document.getElementById('magicLinkEmail').value.trim();
        if (!email) return;
        var btn = document.getElementById('sendMagicLinkBtn');
        var statusEl = document.getElementById('magicLinkStatus');
        btn.disabled = true; btn.textContent = 'Sending...';
        CloudSync.sendMagicLink(email).then(function (res) {
          statusEl.style.display = 'block';
          if (res.error) {
            statusEl.className = 'ai-why-result ai-why-error';
            statusEl.textContent = res.error;
          } else {
            statusEl.className = 'ai-why-result';
            statusEl.textContent = 'Check ' + email + ' for a sign-in link.';
          }
        }).finally(function () {
          btn.disabled = false; btn.textContent = 'Send sign-in link';
        });
      });
    }

    if (GoogleHealth.isConnected) {
      document.getElementById('ghDisconnectBtn').addEventListener('click', function () {
        GoogleHealth.disconnect();
        renderSettings();
      });
    } else {
      document.getElementById('ghConnectBtn').addEventListener('click', function () {
        GoogleHealth.connect();
      });
    }

    var notifEnableBtn = document.getElementById('notifEnableBtn');
    if (notifEnableBtn) {
      notifEnableBtn.addEventListener('click', function () {
        notifEnableBtn.disabled = true;
        notifEnableBtn.textContent = 'Requesting...';
        Notifications.requestPermission().then(function (perm) {
          if (perm === 'granted') {
            state.notifications.enabled = true;
            saveState(state);
            Notifications.markBaseline();
            Notifications.check();
          }
          renderSettings();
        });
      });
    }
    var notifDisableBtn = document.getElementById('notifDisableBtn');
    if (notifDisableBtn) {
      notifDisableBtn.addEventListener('click', function () {
        state.notifications.enabled = false;
        saveState(state);
        renderSettings();
      });
    }

    document.getElementById('exportBtn').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'runner-backup-' + dateToISO(new Date()) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    var importFile = document.getElementById('importFile');
    document.getElementById('importBtn').addEventListener('click', function () { importFile.click(); });
    importFile.addEventListener('change', function () {
      var file = importFile.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var parsed;
        try { parsed = JSON.parse(reader.result); } catch (e) { window.alert("That file isn't valid JSON."); return; }
        if (!parsed || typeof parsed !== 'object' || !parsed.raceGoal || !parsed.profile) {
          window.alert("That doesn't look like a Runner backup file.");
          return;
        }
        if (!window.confirm('This replaces everything currently saved in the app with the imported file. Continue?')) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        window.location.reload();
      };
      reader.readAsText(file);
    });

    document.getElementById('resetPlanBtn').addEventListener('click', function () {
      if (!window.confirm('This clears your current plan and all logged workouts, but keeps your name and units. Start a new plan?')) return;
      state.raceGoal = null;
      state.profile = null;
      state.planMeta = null;
      state.logs = {};
      state.overrides = {};
      state.crossType = {};
      saveState(state);
      didAutoScroll = false;
      renderMain();
    });

    document.getElementById('deleteAllBtn').addEventListener('click', function () {
      if (!window.confirm('This permanently deletes everything — your plan, logs, and name. This cannot be undone. Continue?')) return;
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    });

    document.getElementById('settingsBackBtn').addEventListener('click', renderMain);
  }

  function renderProgressPanel() {
    var app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(el('<div class="subnav">' + headerIconsHtml('progressBtn') + '</div>'));
    wireHeaderIcons();

    // Boredom detection / Variety Week (docs/Runner_SideQuest_Spec.md §6/§7) --
    // a plain weekly check-in, answered at most once per Monday-week. Both
    // the answered-summary and the form render into the DOM together and
    // toggle visibility on click, same pattern as the pain-report toggle in
    // renderWorkoutDetail (painToggle/painForm) -- no extra render() closure needed.
    var existingFeeling = currentWeekFeelingEntry();
    var feelingSummaryHtml = existingFeeling ?
      '<p class="recap-empty" id="feelingSummary">This week: ' + escapeHtml(RUNNING_FEELING_LABEL[existingFeeling.feeling]) + ' &mdash; <span class="pain-toggle" id="changeFeelingBtn" style="display:inline">change</span></p>' : '';
    var feelingFormHtml =
      '<div id="feelingForm" style="display:' + (existingFeeling ? 'none' : 'block') + '">' +
        '<div class="ob-label">How are you feeling about running this week?</div>' +
        '<div class="chip-grid" id="feelingChips">' + chipsHtml('feeling', RUNNING_FEELINGS, RUNNING_FEELING_LABEL, existingFeeling ? existingFeeling.feeling : null, false) + '</div>' +
        '<button type="button" class="ob-btn ob-btn-secondary" id="saveFeelingBtn" style="margin-top:8px">Save</button>' +
      '</div>';
    var varietyBannerHtml = varietyWeekSuggested() ?
      '<div class="warn-banner warn-banner--info"><i class="ti ti-info-circle"></i><span>You\'ve mentioned feeling bored of running two weeks running. Consider a Variety Week -- swap an easy Main Mission for a Side Mission, add strength carefully, and keep your long run and key workout as-is. <span class="pain-toggle" id="varietyOpenQuestsBtn" style="display:inline">Open Side Missions</span></span></div>' : '';

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var raceDate = parseDate(state.raceGoal.raceDate);
    var planLengthWeeks = state.planMeta.planLengthWeeks;
    var result = generateAll(state.profile, state.raceGoal, state.planMeta, state.logs, today);
    var weeks = result.weeks;

    var totalDistance = 0, longestRun = 0, completedCount = 0, scheduledSoFar = 0;
    var currentWeekIdx = -1;
    weeks.forEach(function (wk) {
      wk.days.forEach(function (day, di) {
        var d = dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di);
        var key = wk.weekNum + '-' + di;
        var label = state.overrides[key] || day.label;
        if (d <= today && isLoggable(label)) {
          scheduledSoFar++;
          var entry = getLog(key);
          if (entry) {
            completedCount++;
            if (entry.distance) {
              totalDistance += entry.distance;
              if (entry.distance > longestRun) longestRun = entry.distance;
            }
          }
        }
        if (sameDate(d, today)) currentWeekIdx = wk.weekNum;
      });
    });
    if (currentWeekIdx === -1) {
      for (var w = 1; w <= planLengthWeeks; w++) {
        if (today < dateForSlot(raceDate, planLengthWeeks, w, 0)) { currentWeekIdx = w; break; }
      }
      if (currentWeekIdx === -1) currentWeekIdx = planLengthWeeks;
    }
    var pathModel = refreshPathProgress(weeks);
    var pathCompleted = pathModel ? pathModel.nodes.filter(function (n) { return n.status === 'completed'; }).length : 0;
    var pathTotal = pathModel ? pathModel.nodes.length : 0;
    var badgesEarned = state.badges ? state.badges.length : 0;

    var lastWeek = currentWeekIdx >= 2 ? weeks[currentWeekIdx - 2] : null;
    var nextWeek = currentWeekIdx <= planLengthWeeks - 1 ? weeks[currentWeekIdx] : null;

    var overallHtml =
      '<dl class="wd-info">' +
        '<dt>Distance so far</dt><dd>' + toUnit(round1(totalDistance)) + ' ' + unitLabel() + '</dd>' +
        '<dt>Longest run</dt><dd>' + (longestRun ? toUnit(longestRun) + ' ' + unitLabel() : '&mdash;') + '</dd>' +
        '<dt>Main Missions completed</dt><dd>' + completedCount + ' of ' + scheduledSoFar + ' scheduled so far</dd>' +
        '<dt>Side Missions completed</dt><dd>' + state.sideQuestLog.length + '</dd>' +
        '<dt>Path milestones</dt><dd>' + pathCompleted + ' of ' + pathTotal + '</dd>' +
        '<dt>Badges earned</dt><dd>' + badgesEarned + '</dd>' +
      '</dl>';

    var lastWeekHtml = '<p class="recap-empty">No completed week yet.</p>';
    var aiRecapContext = null;
    if (lastWeek) {
      var planned = 0, completed = 0, plannedDist = 0, doneDist = 0, hardestLabel = null, hardestRpe = -1;
      lastWeek.days.forEach(function (day, di) {
        var key = lastWeek.weekNum + '-' + di;
        var label = state.overrides[key] || day.label;
        if (!isLoggable(label)) return;
        planned++;
        if (day.miles) plannedDist += day.miles;
        var entry = getLog(key);
        if (entry) {
          completed++;
          if (entry.distance) doneDist += entry.distance;
          if (entry.effort && entry.effort > hardestRpe) { hardestRpe = entry.effort; hardestLabel = label; }
        }
      });
      var consistency = planned ? Math.round(100 * completed / planned) : 0;
      lastWeekHtml =
        '<dl class="wd-info">' +
          '<dt>Sessions</dt><dd>' + completed + ' of ' + planned + ' completed (' + consistency + '%)</dd>' +
          '<dt>Distance</dt><dd>' + toUnit(round1(doneDist)) + ' of ' + toUnit(round1(plannedDist)) + ' ' + unitLabel() + ' planned</dd>' +
          '<dt>Hardest session</dt><dd>' + (hardestLabel ? escapeHtml(hardestLabel) + ' (RPE ' + hardestRpe + ')' : '&mdash;') + '</dd>' +
        '</dl>';
      aiRecapContext = {
        week: {
          phase: lastWeek.phase,
          sessionsCompleted: completed,
          sessionsPlanned: planned,
          consistencyPercent: consistency,
          distanceCompleted: toUnit(round1(doneDist)),
          distancePlanned: toUnit(round1(plannedDist)),
          unit: unitLabel(),
          hardestSessionLabel: hardestLabel,
          hardestSessionRpe: hardestRpe > 0 ? hardestRpe : null
        },
        plan: {
          event: state.raceGoal.event,
          goal: state.raceGoal.goal,
          experienceLevel: state.planMeta.level
        }
      };
    }

    var nextWeekHtml = '<p class="recap-empty">Nothing scheduled after this.</p>';
    if (nextWeek) {
      var items = nextWeek.days.map(function (day, di) {
        var key = nextWeek.weekNum + '-' + di;
        var label = state.overrides[key] || day.label;
        var d = dateForSlot(raceDate, planLengthWeeks, nextWeek.weekNum, di);
        if (!isLoggable(label)) return null;
        return '<li>' + DOW_FULL[d.getDay()] + ' &middot; ' + escapeHtml(label) + '</li>';
      }).filter(Boolean);
      nextWeekHtml = items.length ? '<ul class="recap-list">' + items.join('') + '</ul>' : '<p class="recap-empty">Rest week.</p>';
    }

    var wrap = el(
      '<div class="ob">' +
        '<div class="ob-title">Progress</div>' +
        varietyBannerHtml +
        feelingSummaryHtml +
        feelingFormHtml +
        '<div class="ob-sub" style="margin-top:20px">This far</div>' +
        overallHtml +
        '<div class="ob-sub" style="margin-top:20px">Last week</div>' +
        lastWeekHtml +
        (aiRecapContext ? '<div class="ai-why"><button type="button" class="ai-why-btn" id="aiRecapBtn">Ask AI for a recap</button><div class="ai-why-result" id="aiRecapResult" style="display:none"></div></div>' : '') +
        '<div class="ob-sub" style="margin-top:20px">Next week</div>' +
        nextWeekHtml +
        '<button class="ob-btn" id="progressBackBtn">Back to plan</button>' +
      '</div>'
    );
    app.appendChild(wrap);

    var chosenFeeling = existingFeeling ? existingFeeling.feeling : null;
    wrap.querySelectorAll('#feelingChips .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        chosenFeeling = chip.getAttribute('data-value');
        wrap.querySelectorAll('#feelingChips .chip').forEach(function (c) {
          c.classList.toggle('selected', c.getAttribute('data-value') === chosenFeeling);
        });
      });
    });
    document.getElementById('saveFeelingBtn').addEventListener('click', function () {
      if (!chosenFeeling) return;
      saveRunningFeeling(chosenFeeling);
      renderProgressPanel();
    });
    var changeFeelingBtn = document.getElementById('changeFeelingBtn');
    if (changeFeelingBtn) {
      changeFeelingBtn.addEventListener('click', function () {
        document.getElementById('feelingSummary').style.display = 'none';
        document.getElementById('feelingForm').style.display = 'block';
      });
    }
    var varietyOpenQuestsBtn = document.getElementById('varietyOpenQuestsBtn');
    if (varietyOpenQuestsBtn) varietyOpenQuestsBtn.addEventListener('click', renderQuestsHome);

    if (aiRecapContext) {
      var aiRecapBtn = document.getElementById('aiRecapBtn');
      var aiRecapResult = document.getElementById('aiRecapResult');
      aiRecapBtn.addEventListener('click', function () {
        aiRecapBtn.disabled = true;
        aiRecapBtn.textContent = 'Asking...';
        aiRecapResult.style.display = 'block';
        aiRecapResult.className = 'ai-why-result';
        aiRecapResult.textContent = '';
        fetch('/.netlify/functions/weekly-recap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiRecapContext)
        }).then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        }).then(function (result2) {
          if (!result2.ok || !result2.data.recap) {
            throw new Error((result2.data && result2.data.error) || 'Request failed');
          }
          aiRecapResult.textContent = result2.data.recap;
        }).catch(function () {
          aiRecapResult.className = 'ai-why-result ai-why-error';
          aiRecapResult.textContent = "Couldn't reach the AI coach right now -- the stats above still apply.";
        }).finally(function () {
          aiRecapBtn.disabled = false;
          aiRecapBtn.textContent = 'Ask AI for a recap';
        });
      });
    }

    document.getElementById('progressBackBtn').addEventListener('click', renderMain);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  renderMain();
  CloudSync.init();
  GoogleHealth.handleOAuthRedirect().then(function () {
    if (document.getElementById('googleHealthSection')) renderSettings();
  });

  // Re-check notification rules periodically while the tab/installed PWA
  // stays open -- catches e.g. the evening today's-workout reminder even if
  // the runner doesn't reopen the app between morning and evening. Has no
  // effect once the app is fully closed; there's no push server behind this.
  setInterval(function () { Notifications.check(); }, 30 * 60 * 1000);
})();

(function () {
  'use strict';

  var STORAGE_KEY = 'training_plan_v1';
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
  var TERRAINS = ['road', 'trail', 'hills', 'mountain'];
  var TERRAIN_LABEL = { road: 'Road', trail: 'Trail', hills: 'Hills', mountain: 'Mountain' };
  var CROSS_OPTIONS = ['Bike', 'Swim', 'Elliptical', 'Row', 'Hike', 'Strength', 'Yoga', 'Other', 'None'];

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
    var hasContent = !!(next.time || next.distance || next.effort || next.notes || next.pain || next.done);
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

  // Shared by the quick calendar row, its done-checkbox, and the workout
  // detail Save button -- one place decides whether a log is an ordinary
  // completion (free local message) or an actual personal best (worth a
  // real AI-phrased note, since those are rare enough that the API call is
  // cheap and the moment deserves more than a canned line).
  function logAndCelebrate(key, patch, dayType, weeks) {
    setLog(key, patch);
    var entry = getLog(key);
    if (!entry) return;
    var milestone = checkForMilestone(key, dayType, entry, weeks);
    if (milestone) {
      fetch('/.netlify/functions/celebrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact: milestone, plan: { event: state.raceGoal.event, goal: state.raceGoal.goal } })
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (result) {
        showToast((result.ok && result.data.message) || 'That’s a personal best — nice work!');
      }).catch(function () {
        showToast('That’s a personal best — nice work!');
      });
    } else {
      showToast(CELEBRATE_MESSAGES[_celebrateMsgIdx % CELEBRATE_MESSAGES.length]);
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

    return {
      userName: prefer.userName,
      units: prefer.units,
      raceGoal: prefer.raceGoal,
      profile: prefer.profile,
      planMeta: prefer.planMeta,
      logs: mergeMap(local.logs, remote.logs),
      overrides: mergeMap(local.overrides, remote.overrides),
      crossType: mergeMap(local.crossType, remote.crossType),
      unavailable: Object.keys(unavailableMap).map(function (k) { return unavailableMap[k]; }),
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
  var GOOGLE_HEALTH_CLIENT_ID = 'YOUR-GOOGLE-HEALTH-CLIENT-ID.apps.googleusercontent.com';
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
    var draft = prefill || { event: null, raceDate: '', startDate: dateToISO(new Date()), goal: 'finish', weeklyMileage: 10, longestRun: 4, runDaysPerWeek: 3, experienceLevel: 'novice', recentInjury: false, availableDays: 4, terrains: ['road'], crossOptions: ['Bike'], userName: state.userName };
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
          '<div class="chip-grid">' + chipsHtml('experienceLevel', LEVELS, LEVEL_LABEL, draft.experienceLevel, false) + '</div>';
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
    var profile = {
      weeklyMileage: draft.weeklyMileage, longestRun: draft.longestRun, runDaysPerWeek: draft.runDaysPerWeek,
      experienceLevel: draft.experienceLevel, recentInjury: draft.recentInjury, availableDays: draft.availableDays,
      terrains: draft.terrains && draft.terrains.length ? draft.terrains : ['road'], crossOptions: draft.crossOptions.length ? draft.crossOptions : ['None'], recentRaceTime: ''
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
        terrains: (state.profile.terrains || ['road']).slice(), crossOptions: state.profile.crossOptions.slice(), userName: state.userName
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

  function renderMain() {
    if (!state.raceGoal || !state.profile || !state.planMeta) { renderIntro(); return; }

    var app = document.getElementById('app');
    app.innerHTML = '';

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var raceDate = parseDate(state.raceGoal.raceDate);
    var planLengthWeeks = state.planMeta.planLengthWeeks;
    var result = generateAll(state.profile, state.raceGoal, state.planMeta, state.logs, today);
    var weeks = result.weeks;
    // The calendar grid is always whole 7-day weeks anchored to race day (see
    // weeksBetween's comment) -- week 1 can include a few lead-in slots before
    // the runner's actual chosen start date. Those are excluded everywhere
    // below (stats, "today" detection, and the rendered day list further
    // down) so a lead-in slot can never masquerade as "today" or count toward
    // logged/scheduled totals.
    var planStartDate = state.raceGoal.startDate ? parseDate(state.raceGoal.startDate) : null;

    var totalLoggable = 0, totalLogged = 0, currentWeek = 1, todayDayIdx = -1;
    weeks.forEach(function (wk) {
      wk.days.forEach(function (day, di) {
        var d = dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di);
        if (planStartDate && d < planStartDate) return;
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

    if (todayDayIdx !== -1) {
      var todayKey = currentWeek + '-' + todayDayIdx;
      var todayDayData = weeks[currentWeek - 1].days[todayDayIdx];
      var todayLabel = state.overrides[todayKey] || todayDayData.label;
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
          '<div class="today-plan">' + escapeHtml(todayLabel) + '</div>' +
          todayStatusHtml +
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
      document.getElementById('aiCoachOpenBtn').addEventListener('click', renderCoachChat);
    }

    var list = el('<div id="weekList"></div>');
    app.appendChild(list);

    weeks.forEach(function (wk) {
      var weekNum = wk.weekNum;
      var firstDate = dateForSlot(raceDate, planLengthWeeks, weekNum, 0);
      var lastDate = dateForSlot(raceDate, planLengthWeeks, weekNum, 6);
      var visibleFirstDate = (planStartDate && planStartDate > firstDate) ? planStartDate : firstDate;

      var block = el(
        '<div class="week-block">' +
          '<div class="week-head">' +
            '<div class="week-num">WEEK ' + (weekNum < 10 ? '0' + weekNum : weekNum) + ' <span class="phase-tag">' + wk.phase.toUpperCase() + '</span></div>' +
            '<div class="week-range">' + fmtRange(visibleFirstDate, lastDate) + '</div>' +
          '</div>' +
          '<div class="day-list"></div>' +
        '</div>'
      );
      var dayList = block.querySelector('.day-list');

      wk.days.forEach(function (dayData, di) {
        var d = dateForSlot(raceDate, planLengthWeeks, weekNum, di);
        if (planStartDate && d < planStartDate) return;
        var key = weekNum + '-' + di;
        var baseLabel = dayData.label;
        var label = state.overrides[key] || baseLabel;
        var loggable = isLoggable(label);
        var race = isRace(label);
        var cross = hasCross(label);
        var isToday = sameDate(d, today);
        var entry = getLog(key);
        var value = entry ? (entry.time || '') : '';
        var hasEntry = !!entry;
        var crossValue = state.crossType[key] || '';

        var classes = 'day-row';
        if (isToday) classes += ' is-today';
        if (race) classes += ' is-race';
        if (!loggable) classes += ' is-rest';

        var row = el(
          '<div class="' + classes + '">' +
            (loggable ? '<input type="checkbox" class="day-done-check" title="Mark done"' + (entry && entry.done ? ' checked' : '') + '>' : '') +
            '<div class="day-date"><span class="day-dow">' + DOW_FULL[d.getDay()] + '</span><span class="day-dom">' + d.getDate() + '</span></div>' +
            '<div class="day-main">' +
              '<div class="day-plan">' + escapeHtml(label) + '</div>' +
              (cross ? '<select class="cross-select' + (crossValue ? ' chosen' : '') + '">' + crossOptionsHtml(crossValue) + '</select>' : '') +
            '</div>' +
            (loggable ? '<input class="day-time' + (hasEntry ? ' has-value' : '') + '" placeholder="' + (race ? 'FINISH' : 'TIME') + '" value="' + escapeHtml(value) + '">' : '') +
          '</div>'
        );

        row.querySelector('.day-date').addEventListener('click', function () {
          renderWorkoutDetail(weekNum, di);
        });

        function refreshLoggedCount() {
          var loggedNow = Object.keys(state.logs).length;
          document.getElementById('progressFill').style.width = (totalLoggable ? (100 * loggedNow / totalLoggable) : 0) + '%';
          document.getElementById('loggedCount').textContent = loggedNow + ' / ' + totalLoggable + ' LOGGED';
        }

        if (loggable) {
          var input = row.querySelector('.day-time');
          input.addEventListener('change', function () {
            logAndCelebrate(key, { time: input.value.trim() || null }, dayData.type, weeks);
            input.classList.toggle('has-value', !!getLog(key));
            refreshLoggedCount();
          });

          var doneCheck = row.querySelector('.day-done-check');
          doneCheck.addEventListener('change', function () {
            logAndCelebrate(key, { done: doneCheck.checked ? true : null }, dayData.type, weeks);
            input.classList.toggle('has-value', !!getLog(key));
            refreshLoggedCount();
          });
        }

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
        daysByKey[key] = { effectiveLabel: effectiveLabel, baseLabel: dd.label, type: dd.type, date: dt };
        daysPayload.push({ key: key, dow: DOW_FULL[dt.getDay()], date: dateToISO(dt), label: effectiveLabel, type: dd.type });
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
      return '<div class="coach-turn coach-turn--coach">' + escapeHtml(turn.text) + actionHtml + '</div>';
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
          plan: { event: state.raceGoal.event, goal: state.raceGoal.goal, experienceLevel: state.planMeta.level },
          history: history
        })
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (result2) {
        if (!result2.ok || result2.data.error) {
          coachHistory.push({ role: 'coach', text: (result2.data && result2.data.error) || "Couldn't reach the AI coach right now.", action: null, resolved: null });
        } else {
          coachHistory.push({ role: 'coach', text: result2.data.message || '', action: result2.data.action || null, resolved: null });
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

    var detailHtml = detail ? (
      '<dl class="wd-info">' +
        '<dt>What</dt><dd>' + escapeHtml(detail.what) + '</dd>' +
        '<dt>Why</dt><dd>' + escapeHtml(detail.why) + '</dd>' +
        '<dt>How hard</dt><dd>' + escapeHtml(detail.howHard) + '</dd>' +
        '<dt>If I can&rsquo;t</dt><dd>' + escapeHtml(detail.ifCant) + '</dd>' +
        '<dt>Common mistake</dt><dd>' + escapeHtml(detail.mistakes) + '</dd>' +
      '</dl>'
    ) : '';

    var rpeChips = '';
    for (var i = 1; i <= 10; i++) {
      rpeChips += '<button type="button" class="rpe-chip" data-rpe="' + i + '">' + i + '</button>';
    }

    var logHtml = loggable ? (
      '<div class="wd-log">' +
        (GoogleHealth.isConnected ? '<div class="pain-toggle" id="ghImportBtn">Import from Google Health</div><div class="ai-why-result" id="ghImportResult" style="display:none"></div>' : '') +
        '<div class="ob-label">Time</div>' +
        '<input class="ob-input" type="text" id="wd_time" placeholder="e.g. 32:10" value="' + escapeHtml(entry.time || '') + '">' +
        '<div class="ob-label">Distance (' + unitLabel() + ')</div>' +
        '<input class="ob-input" type="number" min="0" step="0.1" id="wd_distance" value="' + (entry.distance != null ? toUnit(entry.distance) : '') + '">' +
        '<div class="ob-label">Effort (RPE 1&ndash;10)</div>' +
        '<div class="chip-grid" id="wd_rpe">' + rpeChips + '</div>' +
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
        (detail ? '<div class="ai-why"><button type="button" class="ai-why-btn" id="aiWhyBtn">Ask AI: why this workout?</button><div class="ai-why-result" id="aiWhyResult" style="display:none"></div></div>' : '') +
        logHtml +
        (loggable ? '<button class="ob-btn" id="wdSaveBtn">Save</button>' : '') +
        '<div class="ob-cancel" id="wdBackBtn">Back to plan</div>' +
      '</div>'
    );
    app.appendChild(wrap);

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
          done: true
        }, dayData.type, result.weeks);
        renderMain();
      });
    }
    document.getElementById('wdBackBtn').addEventListener('click', renderMain);
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

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var raceDate = parseDate(state.raceGoal.raceDate);
    var planLengthWeeks = state.planMeta.planLengthWeeks;
    var result = generateAll(state.profile, state.raceGoal, state.planMeta, state.logs, today);
    var weeks = result.weeks;

    // See renderMain's matching comment -- week 1 can include lead-in slots
    // before the runner's actual chosen start date; those must never count as
    // scheduled/completed or be mistaken for "today".
    var planStartDate = state.raceGoal.startDate ? parseDate(state.raceGoal.startDate) : null;

    var totalDistance = 0, longestRun = 0, completedCount = 0, scheduledSoFar = 0;
    var currentWeekIdx = -1;
    weeks.forEach(function (wk) {
      wk.days.forEach(function (day, di) {
        var d = dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di);
        if (planStartDate && d < planStartDate) return;
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

    var lastWeek = currentWeekIdx >= 2 ? weeks[currentWeekIdx - 2] : null;
    var nextWeek = currentWeekIdx <= planLengthWeeks - 1 ? weeks[currentWeekIdx] : null;

    var overallHtml =
      '<dl class="wd-info">' +
        '<dt>Distance so far</dt><dd>' + toUnit(round1(totalDistance)) + ' ' + unitLabel() + '</dd>' +
        '<dt>Longest run</dt><dd>' + (longestRun ? toUnit(longestRun) + ' ' + unitLabel() : '&mdash;') + '</dd>' +
        '<dt>Sessions completed</dt><dd>' + completedCount + ' of ' + scheduledSoFar + ' scheduled so far</dd>' +
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
        '<div class="ob-sub">This far</div>' +
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
})();

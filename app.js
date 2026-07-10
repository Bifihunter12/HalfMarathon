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

  function isRest(label) { return label.trim().toLowerCase() === 'rest'; }
  function isLoggable(label) { return !isRest(label); }
  function isRace(label) { return !!RACE_LABEL_SET[label.trim().toLowerCase()]; }
  function hasCross(label) { return /\bcross\b/i.test(label); }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function round5(n) { return Math.round(n * 2) / 2; }
  function formatLongRunLabel(miles, terrain) {
    return miles + ' mi long run' + (terrain && terrain !== 'road' ? ' (' + TERRAIN_LABEL[terrain] + ')' : '') + (miles * 11 >= 90 ? ' + fueling practice' : '');
  }
  function formatEasyRunLabel(miles) { return miles + ' mi easy run'; }

  // ── State ──────────────────────────────────────────────────────────────
  function loadState() {
    var s = null;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) {}
    if (!s) s = {};
    if (!s.userName) s.userName = '';
    if (!s.raceGoal) s.raceGoal = null; // { event, raceDate, goal }
    if (!s.profile) s.profile = null;
    if (!s.planMeta) s.planMeta = null; // { level, weeksAvailable, planLengthWeeks, unsafe, warnings }
    if (!s.logs) s.logs = {};
    if (!s.overrides) s.overrides = {};
    if (!s.crossType) s.crossType = {};
    return s;
  }
  function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  var state = loadState();
  var didAutoScroll = false;
  var deferredInstallPrompt = null;

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
  function daysBetween(a, b) {
    var A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    var B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((B - A) / 86400000);
  }
  function weeksBetween(today, raceDate) {
    return Math.max(1, Math.ceil(daysBetween(today, raceDate) / 7));
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
          day.label = formatLongRunLabel(longRunMiles, profile.terrain);
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

  // ── Adaptive layer: dampen future weeks if recent training was mostly missed ──
  function applyMissedAdjustment(weeks, raceGoal, planMeta, logs, today, terrain) {
    var raceDate = parseDate(raceGoal.raceDate);
    var planLengthWeeks = planMeta.planLengthWeeks;
    var currentWeekIdx = -1;
    for (var w = 1; w <= planLengthWeeks; w++) {
      var wkStart = dateForSlot(raceDate, planLengthWeeks, w, 0);
      var wkEnd = dateForSlot(raceDate, planLengthWeeks, w, 6);
      if (today >= wkStart && today <= wkEnd) { currentWeekIdx = w; break; }
      if (today < wkStart && currentWeekIdx === -1) { currentWeekIdx = w; break; }
    }
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
            if (day.type === 'long') day.label = formatLongRunLabel(day.miles, terrain);
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
            day.label = formatLongRunLabel(day.miles, terrain);
          }
        });
      }
      note = 'Last week’s long run was missed, so this week’s long run was shortened.';
    }
    return { weeks: weeks, note: note };
  }

  function generateAll(profile, raceGoal, planMeta, logs, today) {
    var weeks = buildStructuredWeeks(profile, raceGoal, planMeta);
    var adjusted = applyMissedAdjustment(weeks, raceGoal, planMeta, logs, today, profile.terrain);
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
        '<div class="intro-title">Hi, I\'m Carolin.</div>' +
        '<div class="intro-body">I built this because I was training for my own half marathon and got tired of static PDF plans that didn\'t adapt to real life — a run moved to another day, a missed week, wanting to log how it actually went instead of just checking a box.</div>' +
        '<div class="intro-body">So this builds a real plan around wherever you\'re actually starting from — not just the race distance — and adjusts if life gets in the way. Works for anything from a 5K to a 100-miler.</div>' +
        '<div class="ob-label">What\'s your name?</div>' +
        '<input class="ob-input" type="text" id="introName" placeholder="e.g. Sarah" value="' + escapeHtml(state.userName || '') + '">' +
        '<button class="ob-btn" id="introStartBtn">Build My Plan</button>' +
        '<div class="intro-footer">No account, no ads — everything stays on your device.</div>' +
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
    var draft = prefill || { event: null, raceDate: '', goal: 'finish', weeklyMileage: 10, longestRun: 4, runDaysPerWeek: 3, experienceLevel: 'novice', recentInjury: false, availableDays: 4, terrain: 'road', crossOptions: ['Bike'], userName: state.userName };
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
          '<div class="ob-label">Goal</div>' +
          '<div class="chip-grid">' + chipsHtml('goal', GOALS, GOAL_LABEL, draft.goal, false) + '</div>';
      } else if (steps[step] === 'fitness') {
        body =
          '<div class="ob-title">Current fitness</div>' +
          '<div class="ob-sub">Step 3 of 4 · Be honest — this sets your safe starting point</div>' +
          '<div class="ob-label">Current weekly mileage (mi)</div>' +
          '<input class="ob-input" type="number" min="0" step="0.5" id="f_weeklyMileage" value="' + draft.weeklyMileage + '">' +
          '<div class="ob-label">Longest run in the last 4 weeks (mi)</div>' +
          '<input class="ob-input" type="number" min="0" step="0.5" id="f_longestRun" value="' + draft.longestRun + '">' +
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
          '<div class="chip-grid">' + chipsHtml('terrain', TERRAINS, TERRAIN_LABEL, draft.terrain, false) + '</div>' +
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
        var wm = document.getElementById('f_weeklyMileage');
        if (wm) draft.weeklyMileage = parseFloat(wm.value) || 0;
        var lr = document.getElementById('f_longestRun');
        if (lr) draft.longestRun = parseFloat(lr.value) || 0;
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

      wrap.querySelectorAll('.chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          var group = chip.getAttribute('data-group');
          var value = chip.getAttribute('data-value');
          if (group === 'crossOptions') {
            var idx = draft.crossOptions.indexOf(value);
            if (value === 'None') draft.crossOptions = idx !== -1 ? [] : ['None'];
            else {
              draft.crossOptions = draft.crossOptions.filter(function (v) { return v !== 'None'; });
              if (idx !== -1) draft.crossOptions.splice(draft.crossOptions.indexOf(value), 1);
              else draft.crossOptions.push(value);
            }
          } else if (group === 'recentInjury') {
            draft.recentInjury = value === 'yes';
          } else {
            draft[group] = value;
          }
          wrap.querySelectorAll('.chip[data-group="' + group + '"]').forEach(function (c) {
            var v = c.getAttribute('data-value');
            var sel = group === 'crossOptions' ? draft.crossOptions.indexOf(v) !== -1
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
        } else if (steps[step] === 'logistics') {
          finishWizard(draft, isEdit);
          return;
        }
        step++;
        renderStep();
      });
    }
    renderStep();
  }

  function finishWizard(draft, isEdit) {
    var profile = {
      weeklyMileage: draft.weeklyMileage, longestRun: draft.longestRun, runDaysPerWeek: draft.runDaysPerWeek,
      experienceLevel: draft.experienceLevel, recentInjury: draft.recentInjury, availableDays: draft.availableDays,
      terrain: draft.terrain, crossOptions: draft.crossOptions.length ? draft.crossOptions : ['None'], recentRaceTime: ''
    };
    var raceGoal = { event: draft.event, raceDate: draft.raceDate, goal: draft.goal };
    var raceUnchanged = isEdit && state.raceGoal && state.raceGoal.event === raceGoal.event && state.raceGoal.raceDate === raceGoal.raceDate;
    var level = classifyUser(profile);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var weeksAvailable = weeksBetween(today, parseDate(raceGoal.raceDate));
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
  function renderMain() {
    if (!state.raceGoal || !state.profile || !state.planMeta) { renderIntro(); return; }

    var app = document.getElementById('app');
    app.innerHTML = '';

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var raceDate = parseDate(state.raceGoal.raceDate);
    var planLengthWeeks = state.planMeta.planLengthWeeks;
    var result = generateAll(state.profile, state.raceGoal, state.planMeta, state.logs, today);
    var weeks = result.weeks;

    var totalLoggable = 0, totalLogged = 0, currentWeek = 1;
    weeks.forEach(function (wk) {
      wk.days.forEach(function (day, di) {
        var d = dateForSlot(raceDate, planLengthWeeks, wk.weekNum, di);
        var key = wk.weekNum + '-' + di;
        var effectiveLabel = state.overrides[key] || day.label;
        if (isLoggable(effectiveLabel)) {
          totalLoggable++;
          if (state.logs[key]) totalLogged++;
        }
        if (sameDate(d, today)) currentWeek = wk.weekNum;
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
            '<div class="hd-title">' + (state.userName ? escapeHtml(state.userName) + '&rsquo;s ' : '') + EVENT_LABEL[state.raceGoal.event] + ' Training</div>' +
            '<div class="hd-sub">' + LEVEL_LABEL[state.planMeta.level] + ' · ' + GOAL_LABEL[state.raceGoal.goal] + '</div>' +
          '</div>' +
          '<div class="hd-actions">' +
            '<i class="ti ti-shield-check hd-install" id="safetyBtn" title="Safety info"></i>' +
            '<i class="ti ti-download hd-install" id="installBtn" style="display:none" title="Install app"></i>' +
            '<i class="ti ti-settings hd-gear" id="gearBtn"></i>' +
          '</div>' +
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
    document.getElementById('gearBtn').addEventListener('click', function () {
      renderWizard({
        event: state.raceGoal.event, raceDate: state.raceGoal.raceDate, goal: state.raceGoal.goal,
        weeklyMileage: state.profile.weeklyMileage, longestRun: state.profile.longestRun, runDaysPerWeek: state.profile.runDaysPerWeek,
        experienceLevel: state.profile.experienceLevel, recentInjury: state.profile.recentInjury, availableDays: state.profile.availableDays,
        terrain: state.profile.terrain, crossOptions: state.profile.crossOptions.slice(), userName: state.userName
      });
    });
    document.getElementById('safetyBtn').addEventListener('click', renderSafetyPanel);
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
        var value = state.logs[key] || '';
        var crossValue = state.crossType[key] || '';

        var classes = 'day-row';
        if (isToday) classes += ' is-today';
        if (race) classes += ' is-race';
        if (!loggable) classes += ' is-rest';

        var row = el(
          '<div class="' + classes + '">' +
            '<div class="day-date"><span class="day-dow">' + DOW_FULL[d.getDay()] + '</span><span class="day-dom">' + d.getDate() + '</span></div>' +
            '<div class="day-main">' +
              '<div class="day-plan">' + escapeHtml(label) + '</div>' +
              (cross ? '<select class="cross-select' + (crossValue ? ' chosen' : '') + '">' + crossOptionsHtml(crossValue) + '</select>' : '') +
            '</div>' +
            (loggable ? '<input class="day-time' + (value ? ' has-value' : '') + '" placeholder="' + (race ? 'FINISH' : 'TIME') + '" value="' + escapeHtml(value) + '">' : '') +
          '</div>'
        );

        if (loggable) {
          var input = row.querySelector('.day-time');
          input.addEventListener('change', function () {
            if (input.value.trim()) {
              state.logs[key] = input.value.trim();
              input.classList.add('has-value');
            } else {
              delete state.logs[key];
              input.classList.remove('has-value');
            }
            saveState(state);
            var loggedNow = Object.keys(state.logs).length;
            document.getElementById('progressFill').style.width = (totalLoggable ? (100 * loggedNow / totalLoggable) : 0) + '%';
            document.getElementById('loggedCount').textContent = loggedNow + ' / ' + totalLoggable + ' LOGGED';
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

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  renderMain();
})();

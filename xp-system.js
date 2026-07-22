(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RACRXp = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── docs/RACR_Reward_System_Master_Prompt.md, Phase 1: Reward Foundation ──
  // Pure, DOM-free domain module (mirrors side-quests.js/path-system.js) --
  // no localStorage, no state mutation. app.js owns state.xpEvents/state.xp/
  // state.xpProfile; this module only computes numbers from inputs it's given.

  // Base XP per Main Quest workout type. The plan generator's own day.type is
  // only easy/long/quality/cross/rest/race (no separate recovery/tempo/
  // threshold/interval/hill/race-pace/benchmark fields exist there -- rebuilding
  // the generator to carry those is out of scope), so `quality` is further
  // split by a label-substring classifier below, same technique app.js's own
  // paceZoneForLabel() already uses for pace-zone detection. easy/recovery
  // aren't distinguished by the generator either -- both are plan type 'easy'.
  var MAIN_QUEST_XP = {
    easy: 100, recovery: 90, long: 175, tempo: 150, threshold: 150, interval: 150,
    hill: 140, race_pace: 160, benchmark: 175, race_rehearsal: 200,
    cross: 80, rest: 40, race: 500
  };

  // Fallback only -- real Side Mission XP normally comes from the mission's
  // own existing xpReward/rewardPoints field (already defined per-mission in
  // side-quests.js's MISSION_CATALOG and app.js's legacy SIDE_QUESTS catalog).
  // Reusing that per-mission value instead of a second parallel table avoids
  // two sources of truth silently disagreeing about the same mission's XP.
  var SIDE_MISSION_XP_DEFAULT = {
    mobility_short: 25, mobility_full: 35, core: 40,
    strength_upper: 50, strength_running: 60, strength_full: 70
  };

  // One concrete multiplier per completionType (docs/RACR_RunLogging_Correction.md's
  // shipped taxonomy), picking one number from each of the spec's ranges since
  // a deterministic award needs one number, not a range (e.g. "coach-approved
  // adaptation 85-100%" -> 0.9). 'missed' isn't a stored completionType (it's
  // inferred from an absent log entry), so it never reaches this table --
  // there's simply no XP event for a day nobody logged.
  var COMPLETION_MODIFIERS = { planned: 1.0, modified: 0.9, partial: 0.6, stopped_early: 0.4 };

  var SIDE_MISSION_WEEKLY_CAP_RATIO = 0.3; // spec: Side Mission XP <= 30% of that week's Main Quest XP

  var QUALITY_XP_ZONE_MATCHERS = [
    ['@ 5K pace', 'race_pace'], ['@ 5K effort', 'race_pace'],
    ['@ 10K pace', 'race_pace'], ['@ 10K effort', 'race_pace'],
    ['@ half-marathon pace', 'race_pace'], ['@ marathon pace', 'race_pace'],
    ['threshold', 'threshold'], ['Tempo', 'threshold'],
    ['hill', 'hill'], ['Hill', 'hill']
  ];

  // Rank titles (docs/RACR_Reward_System_Master_Prompt.md's 50-level structure).
  var RANK_TITLE_RANGES = [
    [1, 4, 'In Motion'], [5, 9, 'Building'], [10, 14, 'Grounded'], [15, 19, 'Enduring'],
    [20, 24, 'Advancing'], [25, 29, 'Racecraft'], [30, 39, 'Seasoned'], [40, 49, 'Proven'], [50, 50, 'RACR']
  ];

  // Cumulative XP required to REACH each level. Anchor points are the spec's
  // own worked examples (L1/2/3/4/5/10/15/20/30/40/50); everything between is
  // linearly interpolated -- the spec itself flags this curve as needing
  // testing against real plan XP before final tuning, so this is a first pass,
  // not a claimed-precise economy.
  var LEVEL_ANCHORS = [
    [1, 0], [2, 200], [3, 500], [4, 850], [5, 1250], [10, 4500], [15, 9000],
    [20, 15000], [30, 31000], [40, 52000], [50, 80000]
  ];
  var XP_LEVELS = buildLevelTable();

  function buildLevelTable() {
    var table = [];
    for (var i = 0; i < LEVEL_ANCHORS.length - 1; i++) {
      var fromLevel = LEVEL_ANCHORS[i][0], fromXp = LEVEL_ANCHORS[i][1];
      var toLevel = LEVEL_ANCHORS[i + 1][0], toXp = LEVEL_ANCHORS[i + 1][1];
      var span = toLevel - fromLevel;
      var perLevel = (toXp - fromXp) / span;
      for (var lvl = fromLevel; lvl < toLevel; lvl++) {
        table.push({ level: lvl, cumulativeXpRequired: Math.round(fromXp + perLevel * (lvl - fromLevel)) });
      }
    }
    table.push({ level: 50, cumulativeXpRequired: 80000 });
    table.forEach(function (row) { row.rankTitle = rankTitleForLevel(row.level); });
    return table;
  }

  function rankTitleForLevel(level) {
    for (var i = 0; i < RANK_TITLE_RANGES.length; i++) {
      if (level >= RANK_TITLE_RANGES[i][0] && level <= RANK_TITLE_RANGES[i][1]) return RANK_TITLE_RANGES[i][2];
    }
    return RANK_TITLE_RANGES[RANK_TITLE_RANGES.length - 1][2];
  }

  // Highest level whose cumulative requirement the total XP has met/exceeded.
  function levelForTotalXp(totalXp) {
    var xp = totalXp || 0;
    var current = XP_LEVELS[0];
    for (var i = 0; i < XP_LEVELS.length; i++) {
      if (xp >= XP_LEVELS[i].cumulativeXpRequired) current = XP_LEVELS[i];
      else break;
    }
    var next = XP_LEVELS[current.level] || null; // XP_LEVELS is 0-indexed but level is 1-indexed, so XP_LEVELS[current.level] is the next level's row
    return {
      level: current.level,
      rankTitle: current.rankTitle,
      currentLevelXp: xp - current.cumulativeXpRequired,
      nextLevelXp: next ? next.cumulativeXpRequired - current.cumulativeXpRequired : null
    };
  }

  // Classifies a 'quality' day's XP subtype from its label text -- the same
  // substring-matching technique app.js's paceZoneForLabel() already uses for
  // pace-zone detection, kept as a small local copy here (not a shared import)
  // so this module stays dependency-free and independently testable, per the
  // spec's own "engine must be independent from UI/plan-generation" requirement.
  function mainQuestXpType(dayData, label) {
    if (!dayData) return null;
    if (dayData.type !== 'quality') return dayData.type; // easy/long/cross/rest/race map 1:1
    var text = label || '';
    for (var i = 0; i < QUALITY_XP_ZONE_MATCHERS.length; i++) {
      if (text.indexOf(QUALITY_XP_ZONE_MATCHERS[i][0]) !== -1) return QUALITY_XP_ZONE_MATCHERS[i][1];
    }
    return 'interval'; // effort-based quality work with no matched zone (e.g. Fartlek)
  }

  function xpForMainQuestWorkout(dayData, label, completionType) {
    var xpType = mainQuestXpType(dayData, label);
    var base = MAIN_QUEST_XP[xpType];
    if (base == null) return { xpType: xpType, baseXp: 0, modifier: 0, totalXp: 0 };
    var modifier = COMPLETION_MODIFIERS[completionType] != null ? COMPLETION_MODIFIERS[completionType] : COMPLETION_MODIFIERS.planned;
    return { xpType: xpType, baseXp: base, modifier: modifier, totalXp: Math.round(base * modifier) };
  }

  // `baseXp` should normally be the mission/quest's own existing xpReward or
  // rewardPoints field -- see the module comment above. `completionType` is
  // optional (Side Missions don't have the modified/partial/stopped_early
  // taxonomy Main Quest logging does yet) and defaults to full credit.
  function xpForSideMission(baseXp, completionType) {
    var modifier = completionType && COMPLETION_MODIFIERS[completionType] != null ? COMPLETION_MODIFIERS[completionType] : COMPLETION_MODIFIERS.planned;
    var base = baseXp || 0;
    return { baseXp: base, modifier: modifier, totalXp: Math.round(base * modifier) };
  }

  // Clamps a new Side Mission XP award so that week's repeatable Side Mission
  // total never exceeds 30% of that week's Main Quest XP. Returns the amount
  // actually awardable (may be less than requested, never negative).
  function applySideMissionWeeklyCap(sideMissionXpSoFarThisWeek, mainQuestXpThisWeek, newSideMissionXp) {
    var cap = Math.floor((mainQuestXpThisWeek || 0) * SIDE_MISSION_WEEKLY_CAP_RATIO);
    var remaining = cap - (sideMissionXpSoFarThisWeek || 0);
    if (remaining <= 0) return 0;
    return Math.min(newSideMissionXp || 0, remaining);
  }

  return {
    MAIN_QUEST_XP: MAIN_QUEST_XP,
    SIDE_MISSION_XP_DEFAULT: SIDE_MISSION_XP_DEFAULT,
    COMPLETION_MODIFIERS: COMPLETION_MODIFIERS,
    SIDE_MISSION_WEEKLY_CAP_RATIO: SIDE_MISSION_WEEKLY_CAP_RATIO,
    XP_LEVELS: XP_LEVELS,
    rankTitleForLevel: rankTitleForLevel,
    levelForTotalXp: levelForTotalXp,
    mainQuestXpType: mainQuestXpType,
    xpForMainQuestWorkout: xpForMainQuestWorkout,
    xpForSideMission: xpForSideMission,
    applySideMissionWeeklyCap: applySideMissionWeeklyCap
  };
});

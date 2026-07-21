(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RACRPath = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var REQUIRED_NODE_IDS = [
    'main_quest_started',
    'first_main_mission',
    'first_week_complete',
    'first_speed_mission',
    'first_long_run',
    'recovery_week_complete',
    'halfway_point',
    'longest_run_yet',
    'peak_week_complete',
    'taper_begins',
    'ready_to_race',
    'race_day',
    'main_quest_complete'
  ];

  function isMainMission(day) {
    return day && (day.type === 'easy' || day.type === 'long' || day.type === 'quality' || day.type === 'race');
  }

  function isCompletedLog(logs, key) {
    var entry = logs && logs[key];
    return !!(entry && (entry.done || entry.time || entry.distance || entry.notes));
  }

  function weekRequiredKeys(weeks, weekNum) {
    var week = weeks.filter(function (w) { return w.weekNum === weekNum; })[0];
    if (!week) return [];
    return week.days.map(function (day, di) {
      return isMainMission(day) ? week.weekNum + '-' + di : null;
    }).filter(Boolean);
  }

  function allKeysCompleted(logs, keys) {
    return !!keys.length && keys.every(function (key) { return isCompletedLog(logs, key); });
  }

  function firstWeekWithPhase(weeks, phase) {
    var match = weeks.filter(function (w) { return w.phase === phase; })[0];
    return match ? match.weekNum : null;
  }

  function longestRunWeek(weeks) {
    var best = { weekNum: Math.max(1, weeks.length - 3), miles: -1, key: null };
    weeks.forEach(function (week) {
      week.days.forEach(function (day, di) {
        if (day.type === 'long' && (day.miles || 0) > best.miles) {
          best = { weekNum: week.weekNum, miles: day.miles || 0, key: week.weekNum + '-' + di };
        }
      });
    });
    return best;
  }

  function completedType(logs, weeks, type) {
    return weeks.some(function (week) {
      return week.days.some(function (day, di) {
        return day.type === type && isCompletedLog(logs, week.weekNum + '-' + di);
      });
    });
  }

  function completedAnyMainMission(logs, weeks) {
    return weeks.some(function (week) {
      return week.days.some(function (day, di) {
        return isMainMission(day) && isCompletedLog(logs, week.weekNum + '-' + di);
      });
    });
  }

  function completedWeekWithPhase(logs, weeks, phase) {
    return weeks.some(function (week) {
      return week.phase === phase && allKeysCompleted(logs, weekRequiredKeys(weeks, week.weekNum));
    });
  }

  function sideMissionCount(sideMissionLog, category) {
    return (sideMissionLog || []).filter(function (entry) {
      return !entry.stopped && (!category || entry.category === category);
    }).length;
  }

  function sideMissionCompleted(sideMissionLog, id) {
    return (sideMissionLog || []).some(function (entry) { return !entry.stopped && entry.id === id; });
  }

  function node(id, week, nodeType, title, description, required, completed, badgeId, opts) {
    opts = opts || {};
    return {
      id: id,
      week: week,
      order: opts.order || 0,
      nodeType: nodeType,
      title: title,
      description: description,
      whyItMatters: opts.whyItMatters || '',
      requirements: opts.requirements || description,
      required: !!required,
      optional: !required,
      status: completed ? 'completed' : 'locked',
      progressCurrent: completed ? (opts.progressTarget || 1) : (opts.progressCurrent || 0),
      progressTarget: opts.progressTarget || 1,
      badgeId: badgeId || null,
      relatedMissionId: opts.relatedMissionId || null,
      completionDate: opts.completionDate || null
    };
  }

  function generatePath(input) {
    input = input || {};
    var weeks = input.weeks || [];
    var logs = input.logs || {};
    var sideMissionLog = input.sideMissionLog || [];
    var planLength = input.planLengthWeeks || weeks.length || 12;
    var halfwayWeek = Math.max(1, Math.ceil(planLength / 2));
    var taperWeek = firstWeekWithPhase(weeks, 'taper') || Math.max(1, planLength - 1);
    var peakWeek = firstWeekWithPhase(weeks, 'peak') || Math.max(1, taperWeek - 1);
    var longest = longestRunWeek(weeks);
    var raceWeek = planLength;
    var raceComplete = completedType(logs, weeks, 'race');
    var firstWeekComplete = allKeysCompleted(logs, weekRequiredKeys(weeks, 1));
    var firstMainComplete = completedAnyMainMission(logs, weeks);
    var firstSpeedComplete = completedType(logs, weeks, 'quality');
    var firstLongComplete = completedType(logs, weeks, 'long');
    var recoveryComplete = allKeysCompleted(logs, weekRequiredKeys(weeks, Math.min(4, planLength)));
    var peakComplete = completedWeekWithPhase(logs, weeks, 'peak') || allKeysCompleted(logs, weekRequiredKeys(weeks, peakWeek));
    var taperStarted = weeks.some(function (w) {
      return w.weekNum >= taperWeek && w.days.some(function (day, di) { return isCompletedLog(logs, w.weekNum + '-' + di); });
    });
    var longestComplete = longest.key ? isCompletedLog(logs, longest.key) : false;

    var nodes = [
      node('main_quest_started', 1, 'running_milestone', 'Main Quest Started', 'Your running goal is set and the Path begins.', true, !!input.mainQuestActive, 'badge_quest_accepted', { order: 1, whyItMatters: 'This anchors every Main Mission and every optional Side Mission.' }),
      node('first_main_mission', 1, 'running_milestone', 'First Main Mission', 'Complete your first scheduled running workout.', true, firstMainComplete, 'badge_first_mile', { order: 2 }),
      node('first_week_complete', 2, 'running_milestone', 'First Week Complete', 'Complete all required Main Missions in week 1.', true, firstWeekComplete, 'badge_first_week', { order: 1 }),
      node('first_speed_mission', Math.min(3, planLength), 'running_milestone', 'First Speed Mission', 'Complete your first interval, tempo, or race-pace Main Mission.', true, firstSpeedComplete, 'badge_speed_initiate', { order: 1 }),
      node('first_long_run', Math.min(3, planLength), 'running_milestone', 'First Long Run', 'Complete your first scheduled long run.', true, firstLongComplete, 'badge_long_run_builder', { order: 2 }),
      node('recovery_week_complete', Math.min(4, planLength), 'running_milestone', 'Recovery Week Complete', 'Complete the required Main Missions in an early lighter week.', true, recoveryComplete, 'badge_recovery_done_right', { order: 1 }),
      node('halfway_point', halfwayWeek, 'running_milestone', 'Halfway Point', 'Reach the middle of the Main Quest with required running progress intact.', true, firstWeekComplete && firstMainComplete, 'badge_halfway_there', { order: 1 }),
      node('longest_run_yet', longest.weekNum, 'running_milestone', 'Longest Run Yet', 'Complete the longest scheduled long run in the plan.', true, longestComplete, 'badge_durable_runner', { order: 1, relatedMissionId: longest.key }),
      node('peak_week_complete', peakWeek, 'running_milestone', 'Peak Week Complete', 'Complete the key Main Missions in peak week.', true, peakComplete, 'badge_peak_week', { order: 1 }),
      node('taper_begins', taperWeek, 'running_milestone', 'Taper Begins', 'Enter the final reduced-volume phase before race day.', true, taperStarted, 'badge_ready_to_race', { order: 1 }),
      node('ready_to_race', Math.max(taperWeek, planLength - 1), 'major_badge', 'Ready to Race', 'Protect recovery and complete the final key Main Missions.', true, taperStarted, 'badge_ready_to_race', { order: 2 }),
      node('race_day', raceWeek, 'race', 'Race Day', 'The final Main Mission.', true, raceComplete, null, { order: 1 }),
      node('main_quest_complete', raceWeek, 'major_badge', 'Main Quest Complete', 'Finish the race or final goal event.', true, raceComplete, 'badge_race_finisher', { order: 2 })
    ];

    nodes = nodes.concat([
      node('first_strength_mission', 1, 'side_mission_achievement', 'First Strength Mission', 'Complete any strength Side Mission.', false, sideMissionCount(sideMissionLog, 'strength') >= 1, 'badge_strength_initiate', { order: 3, progressCurrent: Math.min(sideMissionCount(sideMissionLog, 'strength'), 1) }),
      node('core_10_completed', Math.min(3, planLength), 'side_mission_achievement', 'Core 10 Completed', 'Complete the Core 10 Side Mission.', false, sideMissionCompleted(sideMissionLog, 'core_10'), 'badge_core_armor', { order: 3 }),
      node('trail_90_completed', Math.min(5, planLength), 'side_mission_achievement', 'Trail 90 Completed', 'Complete Trail 90 as an aerobic Side Mission.', false, sideMissionCompleted(sideMissionLog, 'trail_90'), 'badge_trail_90', { order: 3 }),
      node('upper_body_builder_completed', halfwayWeek, 'side_mission_achievement', 'Upper Body Builder Completed', 'Complete the Upper Body Builder Mission Track.', false, sideMissionCompleted(sideMissionLog, 'upper_body_builder_track'), 'badge_upper_body_builder', { order: 3 }),
      node('strong_runner_badge', Math.min(7, planLength), 'major_badge', 'Strong Runner Badge', 'Complete four strength Side Missions while protecting key Main Missions.', false, sideMissionCount(sideMissionLog, 'strength') >= 4, 'badge_strong_runner', { order: 3, progressCurrent: Math.min(sideMissionCount(sideMissionLog, 'strength'), 4), progressTarget: 4 })
    ]);

    nodes.sort(function (a, b) {
      if (a.week !== b.week) return a.week - b.week;
      if (a.required !== b.required) return a.required ? -1 : 1;
      return a.order - b.order;
    });

    var current = firstIncompleteRequired(nodes);
    var currentIdx = nodeIndex(nodes, current.id);
    nodes.forEach(function (n) {
      if (n.status === 'completed') return;
      if (n.id === current.id) n.status = 'current';
      else if (!n.required) n.status = 'optional';
      else n.status = nodeIndex(nodes, n.id) === currentIdx + 1 ? 'available' : 'locked';
    });

    return {
      id: 'path_' + (input.mainQuestId || 'main_quest'),
      mainQuestId: input.mainQuestId || 'main_quest',
      currentNodeId: current.id,
      nodeIds: nodes.map(function (n) { return n.id; }),
      nodes: nodes,
      earnedBadges: earnedBadges(nodes, input.earnedBadges || [])
    };
  }

  function nodeIndex(nodes, id) {
    for (var i = 0; i < nodes.length; i++) if (nodes[i].id === id) return i;
    return -1;
  }

  function firstIncompleteRequired(nodes) {
    return nodes.filter(function (n) { return n.required && n.status !== 'completed'; })[0] || nodes[nodes.length - 1];
  }

  function earnedBadges(nodes, existing) {
    var out = {};
    (existing || []).forEach(function (badge) { out[badge] = true; });
    nodes.forEach(function (n) {
      if (n.status === 'completed' && n.badgeId) out[n.badgeId] = true;
    });
    return Object.keys(out);
  }

  function preserveCompletedAchievements(previousPath, nextPath) {
    var completed = {};
    var badges = {};
    ((previousPath && previousPath.nodes) || []).forEach(function (n) {
      if (n.status === 'completed') completed[n.id] = n;
    });
    ((previousPath && previousPath.earnedBadges) || []).forEach(function (b) { badges[b] = true; });
    nextPath.nodes.forEach(function (n) {
      if (completed[n.id]) {
        n.status = 'completed';
        n.completionDate = n.completionDate || completed[n.id].completionDate || null;
      }
      if (n.status === 'completed' && n.badgeId) badges[n.badgeId] = true;
    });
    nextPath.currentNodeId = firstIncompleteRequired(nextPath.nodes).id;
    nextPath.earnedBadges = Object.keys(badges);
    return nextPath;
  }

  function accessibilityLabel(node, totalWeeks) {
    var kind = node.nodeType === 'side_mission_achievement' ? 'Optional Side Mission achievement' :
      node.nodeType === 'race' ? 'Race node' :
      node.nodeType === 'major_badge' ? 'Major badge node' : 'Main Quest milestone';
    return node.title + '. ' + node.status + ' ' + kind + '. Week ' + node.week + ' of ' + totalWeeks + '. ' +
      node.progressCurrent + ' of ' + node.progressTarget + ' complete.';
  }

  return {
    REQUIRED_NODE_IDS: REQUIRED_NODE_IDS,
    generatePath: generatePath,
    preserveCompletedAchievements: preserveCompletedAchievements,
    accessibilityLabel: accessibilityLabel,
    isMainMission: isMainMission
  };
});

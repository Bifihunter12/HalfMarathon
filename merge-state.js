(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RACRMergeState = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Cross-device state reconciliation (docs/RELEASE_BLOCKERS.md CRITICAL-1) ──
  // Extracted verbatim from app.js (no behavior change) so this, the single
  // most safety-critical function in the app, can finally have automated
  // test coverage -- it has been the source of at least 3 real data-loss
  // bugs across this project's history, none of them caught by a test
  // because none could exist for code living inside the browser-only
  // app.js IIFE. Pure function: no localStorage/DOM access, just local/remote
  // state objects in, one merged object out. Mirrors the exact UMD pattern
  // already used by side-quests.js/path-system.js/xp-system.js.
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

  return {
    mergeRunnerState: mergeRunnerState
  };
});

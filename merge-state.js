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
  // already used by side-quests.js/path-system.js.
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

    // Tombstone-aware variant of mergeMap, for fields where a deletion must
    // itself survive merging with a device that never saw it (plain mergeMap
    // can't tell "deleted on the newer device" from "never synced to this
    // device" -- an absent key is silently treated as a union gap either
    // way, so a stale device's still-present value wins back). localDeleted/
    // remoteDeleted are {key: true} tombstone sets alongside each map. A key
    // only disappears from the output when the newer of the two devices that
    // *touched* it (real value or tombstone) chose deletion; a key untouched
    // by one side still passes through from the other exactly like mergeMap.
    // Currently wired for `logs` only (see app.js setLog) -- the proven
    // worst case (a deleted workout log reappearing). overrides/crossType/
    // sessionLogs/sessionOverrides/dayAdjustments/scheduleChoices/
    // sideQuestCalendar share the exact same mergeMap-by-presence gap and
    // can reuse this helper directly; not yet wired at their (more scattered)
    // app.js call sites -- cataloged as follow-up, not fixed here.
    function mergeMapT(localMap, remoteMap, localDeleted, remoteDeleted) {
      var out = {}, outDeleted = {}, keys = {};
      Object.keys(localMap || {}).forEach(function (k) { keys[k] = 1; });
      Object.keys(remoteMap || {}).forEach(function (k) { keys[k] = 1; });
      Object.keys(localDeleted || {}).forEach(function (k) { keys[k] = 1; });
      Object.keys(remoteDeleted || {}).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (k) {
        var lHas = Object.prototype.hasOwnProperty.call(localMap || {}, k);
        var rHas = Object.prototype.hasOwnProperty.call(remoteMap || {}, k);
        var lDel = !!(localDeleted || {})[k], rDel = !!(remoteDeleted || {})[k];
        var lTouched = lHas || lDel, rTouched = rHas || rDel;
        if (lTouched && rTouched) {
          if (localNewer) { if (lHas) out[k] = localMap[k]; else outDeleted[k] = true; }
          else { if (rHas) out[k] = remoteMap[k]; else outDeleted[k] = true; }
        } else if (lHas) {
          out[k] = localMap[k];
        } else if (rHas) {
          out[k] = remoteMap[k];
        } else if (lDel || rDel) {
          outDeleted[k] = true;
        }
      });
      return { value: out, deleted: outDeleted };
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

    // Every dict/id-map-shaped field a user can explicitly delete a key from
    // (logs/overrides/crossType/sessionLogs/sessionOverrides/dayAdjustments/
    // scheduleChoices/sideQuestCalendar/recurringWorkouts/travelPeriods) goes
    // through mergeMapT with a matching app.js deletedKeys.<field> tombstone
    // set -- see app.js setLog/setOverride/setCrossType/setSessionLog/
    // setSessionOverride/setDayAdjustment/setScheduleChoice/
    // setSideQuestCalendarEntry/recurring-workout & travel-period removal.
    // Without the tombstone, a deletion is indistinguishable from "this
    // device never synced that key," so a stale device's still-present value
    // would win the key back on merge (the audit's original `logs` finding,
    // now fixed the same way for all nine of these).
    var localDK = local.deletedKeys || {}, remoteDK = remote.deletedKeys || {};

    // Recurring workouts (docs/COACHING_SPEC.md) need real edit-in-place
    // (changing a workout's duration/intensity later shouldn't orphan the old
    // entry under a content-derived key the way unavailable/sideQuestLog's
    // union would) -- same reasoning and same mergeMapT-by-real-id pattern as
    // runningFeelingLog above, just keyed by `id` instead of `weekStartIso`.
    // Previously used plain mergeMap (a pure map merge can't distinguish
    // "deleted locally" from "never synced from this device" -- a workout
    // removed on one device could reappear after syncing from another that
    // never saw the deletion); now uses the same mergeMapT + app.js
    // deletedKeys.recurringWorkouts tombstone fix as logs/overrides/etc.
    function toIdMap(arr) {
      var out = {};
      (arr || []).forEach(function (e) { out[e.id] = e; });
      return out;
    }
    var recurringWorkoutsMerged = mergeMapT(
      toIdMap(local.recurringWorkouts), toIdMap(remote.recurringWorkouts),
      localDK.recurringWorkouts, remoteDK.recurringWorkouts
    );

    // docs/COACHING_SPEC.md "Travel / temporary schedule overrides" -- same
    // real-edit-in-place reasoning and same mergeMapT-by-id pattern as
    // recurringWorkouts above (a trip's dates/mode can be edited after
    // creation; a content-key union would orphan the old entry on edit).
    var travelPeriodsMerged = mergeMapT(
      toIdMap(local.travelPeriods), toIdMap(remote.travelPeriods),
      localDK.travelPeriods, remoteDK.travelPeriods
    );

    // docs/PROGRESS_SPEC.md "Weight tracking" -- same real-edit-in-place
    // reasoning as recurringWorkouts/runningFeelingLog above, keyed by
    // `dateIso` instead of `id`/`weekStartIso`: a weigh-in is upserted by
    // date (adding again for the same date is how a runner "corrects" an
    // entry), so the merge must let the newer device's edit win outright
    // rather than union both into two entries for the same day.
    function toDateMap(arr) {
      var out = {};
      (arr || []).forEach(function (e) { out[e.dateIso] = e; });
      return out;
    }
    var weightEntriesMap = mergeMap(toDateMap(local.weightEntries), toDateMap(remote.weightEntries));

    // Same union-by-natural-key treatment as unavailable/sideQuestLog above --
    // these are append-only records too, never overwritten in place.
    var completedTracksMap = {};
    (remote.completedQuestTracks || []).concat(local.completedQuestTracks || []).forEach(function (r) {
      completedTracksMap[r.trackId + '|' + r.date] = r;
    });
    var badgesUnion = (local.badges || []).concat(remote.badges || []).filter(function (b, i, arr) { return arr.indexOf(b) === i; });
    var pathNodeMap = {};
    (remote.pathNodes || []).concat(local.pathNodes || []).forEach(function (n) {
      if (!n || !n.id) return;
      if (!pathNodeMap[n.id] || n.status === 'completed') pathNodeMap[n.id] = n;
    });

    var logsMerged = mergeMapT(local.logs, remote.logs, localDK.logs, remoteDK.logs);
    var overridesMerged = mergeMapT(local.overrides, remote.overrides, localDK.overrides, remoteDK.overrides);
    var crossTypeMerged = mergeMapT(local.crossType, remote.crossType, localDK.crossType, remoteDK.crossType);
    var sessionLogsMerged = mergeMapT(local.sessionLogs, remote.sessionLogs, localDK.sessionLogs, remoteDK.sessionLogs);
    var sessionOverridesMerged = mergeMapT(local.sessionOverrides, remote.sessionOverrides, localDK.sessionOverrides, remoteDK.sessionOverrides);
    var dayAdjustmentsMerged = mergeMapT(local.dayAdjustments, remote.dayAdjustments, localDK.dayAdjustments, remoteDK.dayAdjustments);
    var scheduleChoicesMerged = mergeMapT(local.scheduleChoices, remote.scheduleChoices, localDK.scheduleChoices, remoteDK.scheduleChoices);
    var sideQuestCalendarMerged = mergeMapT(local.sideQuestCalendar, remote.sideQuestCalendar, localDK.sideQuestCalendar, remoteDK.sideQuestCalendar);

    return {
      userName: prefer.userName,
      units: prefer.units,
      notifications: prefer.notifications || { enabled: false },
      flags: prefer.flags || { enableLongerDistances: false },
      weightTrackingEnabled: prefer.weightTrackingEnabled || false,
      weightUnits: prefer.weightUnits || (prefer.units === 'km' ? 'kg' : 'lb'),
      activeQuestTrack: prefer.activeQuestTrack !== undefined ? prefer.activeQuestTrack : null,
      activeWeeklyChallenge: prefer.activeWeeklyChallenge !== undefined ? prefer.activeWeeklyChallenge : null,
      sideQuestOnboarding: prefer.sideQuestOnboarding !== undefined ? prefer.sideQuestOnboarding : null,
      sideQuestCalendar: sideQuestCalendarMerged.value,
      completedQuestTracks: Object.keys(completedTracksMap).map(function (k) { return completedTracksMap[k]; }),
      // Audit finding: this used to be `prefer.path || local.path ||
      // remote.path || null`, which fell through to a stale device's path
      // whenever the newer device's own path was falsy (including a real,
      // deliberate null) -- the same wholesale-prefer-newer pattern as
      // raceGoal/profile/planMeta/activeQuestTrack above, just missing the
      // undefined check that lets an explicit null actually win.
      path: prefer.path !== undefined ? prefer.path : null,
      pathNodes: Object.keys(pathNodeMap).map(function (k) { return pathNodeMap[k]; }),
      badges: badgesUnion,
      raceGoal: prefer.raceGoal,
      profile: prefer.profile,
      planMeta: prefer.planMeta,
      logs: logsMerged.value,
      overrides: overridesMerged.value,
      crossType: crossTypeMerged.value,
      // docs/COACHING_SPEC.md "Session-level architecture" -- a secondary
      // same-day session's log/override, keyed by its own stable session id
      // (coaching-rules.js sessionIdFor) instead of a day key. Same
      // mergeMapT semantics as logs/overrides above -- two sessions on one
      // date never collide because they're different keys entirely, and
      // this reuses the exact same merge function rather than a new one.
      sessionLogs: sessionLogsMerged.value,
      sessionOverrides: sessionOverridesMerged.value,
      // docs/COACHING_SPEC.md "Today screen actions" -- same day-key shape
      // and merge semantics as logs/overrides above.
      dayAdjustments: dayAdjustmentsMerged.value,
      unavailable: Object.keys(unavailableMap).map(function (k) { return unavailableMap[k]; }),
      sideQuestLog: Object.keys(sideQuestMap).map(function (k) { return sideQuestMap[k]; }),
      runningFeelingLog: Object.keys(feelingMap).map(function (k) { return feelingMap[k]; }),
      recurringWorkouts: Object.keys(recurringWorkoutsMerged.value).map(function (k) { return recurringWorkoutsMerged.value[k]; }),
      travelPeriods: Object.keys(travelPeriodsMerged.value).map(function (k) { return travelPeriodsMerged.value[k]; }),
      // docs/COACHING_SPEC.md "Key-session conflict" -- a workoutId->optionId
      // map, same shape as logs/overrides/crossType above -- reuse mergeMapT
      // directly (real per-key last-write-wins, matching how a runner
      // changing their mind about a conflict resolution should behave).
      scheduleChoices: scheduleChoicesMerged.value,
      weightEntries: Object.keys(weightEntriesMap).map(function (k) { return weightEntriesMap[k]; }),
      deletedKeys: {
        logs: logsMerged.deleted,
        overrides: overridesMerged.deleted,
        crossType: crossTypeMerged.deleted,
        sessionLogs: sessionLogsMerged.deleted,
        sessionOverrides: sessionOverridesMerged.deleted,
        dayAdjustments: dayAdjustmentsMerged.deleted,
        scheduleChoices: scheduleChoicesMerged.deleted,
        sideQuestCalendar: sideQuestCalendarMerged.deleted,
        recurringWorkouts: recurringWorkoutsMerged.deleted,
        travelPeriods: travelPeriodsMerged.deleted
      },
      lastModified: Math.max(local.lastModified || 0, remote.lastModified || 0)
    };
  }

  return {
    mergeRunnerState: mergeRunnerState
  };
});

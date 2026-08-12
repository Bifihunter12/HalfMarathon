const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const mergeState = require(path.join(__dirname, '..', 'merge-state.js'));

function baseState(overrides) {
  return Object.assign({
    lastModified: 0,
    userName: '', units: 'mi', notifications: { enabled: false },
    activeQuestTrack: null, activeWeeklyChallenge: null, sideQuestOnboarding: null,
    sideQuestCalendar: {}, completedQuestTracks: [], path: null, pathNodes: [],
    badges: [],
    raceGoal: null, profile: null, planMeta: null,
    logs: {}, overrides: {}, crossType: {},
    unavailable: [], sideQuestLog: [], runningFeelingLog: [], recurringWorkouts: [],
    weightTrackingEnabled: false, weightUnits: 'lb', weightEntries: [],
    sessionLogs: {}, sessionOverrides: {}, dayAdjustments: {}
  }, overrides || {});
}

// docs/COACHING_SPEC.md "Achievements" -- XP/generic player levels were
// removed from V1. merge-state.js no longer reads, merges, or emits
// xp/xpEvents/xpProfile at all -- these regression tests prove a legacy
// device carrying that old data can't make the removed XP UI reappear via
// a cross-device sync (a device that upgraded first syncing with one that
// hasn't yet must never resurrect XP for either side).
test('regression: legacy xp/xpEvents/xpProfile fields on either device never appear in the merged output', function () {
  const local = baseState({
    lastModified: 2000,
    xp: 999, xpEvents: [{ idempotencyKey: 'mainquest|1-1', totalXp: 100 }], xpProfile: { lastLevelUpAt: 123 }
  });
  const remote = baseState({
    lastModified: 1000,
    xp: 20, xpEvents: [{ idempotencyKey: 'mainquest|2-2', totalXp: 200 }], xpProfile: { lastLevelUpAt: 456 }
  });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.xp, undefined, 'xp must not be carried into the merged state');
  assert.equal(merged.xpEvents, undefined, 'xpEvents must not be carried into the merged state');
  assert.equal(merged.xpProfile, undefined, 'xpProfile must not be carried into the merged state');
});

test('sideQuestLog, completedQuestTracks, unavailable, and pathNodes union by natural key without duplication', function () {
  const local = baseState({
    lastModified: 2000,
    sideQuestLog: [{ id: 'm1', key: '1-1', date: '2026-07-20' }],
    completedQuestTracks: [{ trackId: 't1', date: '2026-07-20' }],
    unavailable: [{ start: '2026-07-01', end: '2026-07-05', reason: 'travel' }],
    pathNodes: [{ id: 'n1', status: 'in_progress' }]
  });
  const remote = baseState({
    lastModified: 1000,
    sideQuestLog: [{ id: 'm2', key: '1-2', date: '2026-07-21' }],
    completedQuestTracks: [{ trackId: 't2', date: '2026-07-21' }],
    unavailable: [{ start: '2026-08-01', end: '2026-08-05', reason: 'illness' }],
    pathNodes: [{ id: 'n1', status: 'completed' }] // same node, remote says completed
  });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.sideQuestLog.length, 2);
  assert.equal(merged.completedQuestTracks.length, 2);
  assert.equal(merged.unavailable.length, 2);
  // "completed" is sticky -- a node marked completed on either device should
  // never revert to a lesser status on merge.
  assert.equal(merged.pathNodes.find((n) => n.id === 'n1').status, 'completed');
});

test('badges union by value with no duplicates', function () {
  const local = baseState({ lastModified: 2000, badges: ['a', 'b'] });
  const remote = baseState({ lastModified: 1000, badges: ['b', 'c'] });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.deepEqual(merged.badges.slice().sort(), ['a', 'b', 'c']);
});

// docs/COACHING_ENGINE_SPEC.md -- coachingHistory unions like sideQuestLog
// (append-only, a delivered cue stays delivered on both devices), and
// coachingPreferences is a simple settings object that follows the same
// wholesale-prefer-newer pattern as workoutAudio/notifications.
test('coachingHistory unions by natural key (workoutId|cueId|deliveredAt) without duplication, sorted and capped', function () {
  const local = baseState({ lastModified: 2000, coachingHistory: [{ cueId: 'safety_general', category: 'safety', deliveredAt: 100, workoutId: 'w1' }] });
  const remote = baseState({ lastModified: 1000, coachingHistory: [{ cueId: 'intro_easy', category: 'introduction', deliveredAt: 50, workoutId: 'w1' }] });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.coachingHistory.length, 2, 'both devices\' delivered cues must survive the union');
  assert.deepEqual(merged.coachingHistory.map((h) => h.cueId), ['intro_easy', 'safety_general'], 'sorted chronologically by deliveredAt');
});

// Regression: acknowledgedAdjustmentNotes/acknowledgedPlanWarnings (app.js
// renderMain "Got it" acknowledge-gates), autoAdjustMode, and
// goalCheckpointResolved were previously absent from mergeRunnerState's
// return object entirely -- any cloud sync pull silently dropped them back
// to undefined, so a dismissed warning card reappeared on the very next
// sync (reported live: clicking "Got it" appeared to do nothing because a
// pull raced the dismissal). Union + dedupe for the ack lists, same
// append-only treatment as badges/sideQuestLog above, so an ack made on
// either device survives merging with the other.
test('acknowledgedAdjustmentNotes and acknowledgedPlanWarnings survive merge, unioned without duplication', function () {
  const local = baseState({
    lastModified: 2000,
    acknowledgedAdjustmentNotes: ['note-a'],
    acknowledgedPlanWarnings: ['warning-a']
  });
  const remote = baseState({
    lastModified: 1000,
    acknowledgedAdjustmentNotes: ['note-a', 'note-b'],
    acknowledgedPlanWarnings: ['warning-b']
  });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.deepEqual(merged.acknowledgedAdjustmentNotes.slice().sort(), ['note-a', 'note-b'], 'an ack made on either device must survive, deduplicated');
  assert.deepEqual(merged.acknowledgedPlanWarnings.slice().sort(), ['warning-a', 'warning-b']);
});

test('autoAdjustMode and goalCheckpointResolved survive merge via the same wholesale-prefer-newer pattern as other settings', function () {
  const local = baseState({ lastModified: 2000, autoAdjustMode: 'auto', goalCheckpointResolved: true });
  const remote = baseState({ lastModified: 1000, autoAdjustMode: 'confirm', goalCheckpointResolved: false });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.autoAdjustMode, 'auto', 'newer (local) device\'s setting wins');
  assert.equal(merged.goalCheckpointResolved, true);
});

test('inWorkoutFeedback unions by natural key (workoutId|segmentIndex|type|at) without duplication', function () {
  const local = baseState({ lastModified: 2000, inWorkoutFeedback: [{ workoutId: 'w1', segmentIndex: 2, type: 'pain', at: 200 }] });
  const remote = baseState({ lastModified: 1000, inWorkoutFeedback: [{ workoutId: 'w1', segmentIndex: 0, type: 'too_easy', at: 100 }] });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.inWorkoutFeedback.length, 2, 'both devices\' feedback entries must survive the union');
  assert.deepEqual(merged.inWorkoutFeedback.map((f) => f.type), ['too_easy', 'pain'], 'sorted chronologically by at');
});

test('coachingHistory is capped to the most recent 200 entries after merging', function () {
  const many = [];
  for (let i = 0; i < 150; i++) many.push({ cueId: 'x' + i, category: 'encouragement', deliveredAt: i, workoutId: 'w1' });
  const local = baseState({ lastModified: 2000, coachingHistory: many });
  const moreMany = [];
  for (let i = 150; i < 300; i++) moreMany.push({ cueId: 'x' + i, category: 'encouragement', deliveredAt: i, workoutId: 'w1' });
  const remote = baseState({ lastModified: 1000, coachingHistory: moreMany });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.coachingHistory.length, 200, 'a merge combining 300 entries across two devices must still cap at 200');
  assert.equal(merged.coachingHistory[merged.coachingHistory.length - 1].cueId, 'x299', 'the cap keeps the most RECENT entries, not the first 200');
});

test('coachingPreferences prefers the newer device wholesale, like workoutAudio/notifications', function () {
  const local = baseState({ lastModified: 2000, coachingPreferences: { frequency: 'minimal', technique: false, encouragement: true, paceFeedback: true, heartRateFeedback: true } });
  const remote = baseState({ lastModified: 1000, coachingPreferences: { frequency: 'detailed', technique: true, encouragement: true, paceFeedback: true, heartRateFeedback: true } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.coachingPreferences.frequency, 'minimal');
});

test('logs/overrides/crossType merge per-key, newer device wins only for keys both sides touched', function () {
  const local = baseState({ lastModified: 2000, logs: { '1-1': { distance: 5 } }, crossType: { '1-2': 'Bike' } });
  const remote = baseState({ lastModified: 1000, logs: { '1-1': { distance: 4 }, '1-3': { distance: 3 } }, crossType: { '1-2': 'Row' } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.logs['1-1'].distance, 5, 'the newer (local) device wins for a key both sides touched');
  assert.equal(merged.logs['1-3'].distance, 3, 'a remote-only key must still survive the merge');
  assert.equal(merged.crossType['1-2'], 'Bike', 'newer device wins for crossType too, same mergeMap logic');
});

test('a week\'s runningFeelingLog entry can be overwritten, not just unioned, by the newer device', function () {
  const local = baseState({ lastModified: 2000, runningFeelingLog: [{ weekStartIso: '2026-07-20', feeling: 'bored' }] });
  const remote = baseState({ lastModified: 1000, runningFeelingLog: [{ weekStartIso: '2026-07-20', feeling: 'excited' }] });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.runningFeelingLog.length, 1);
  assert.equal(merged.runningFeelingLog[0].feeling, 'bored', 'newer device\'s answer for the same week replaces the older one');
});

// Regression for the audit's second landmine: `path` used to fall through
// to a stale device's path object whenever the newer device's own path was
// falsy, instead of respecting an explicit null like its sibling fields.
test('path prefers the newer device wholesale, including an explicit null (no stale fallback)', function () {
  const local = baseState({ lastModified: 2000, path: null });
  const remote = baseState({ lastModified: 1000, path: { id: 'p1', currentNodeId: 'old-node' } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.path, null, 'the newer device\'s explicit null must win, not the stale device\'s path');
});

test('path still falls back correctly when the newer device genuinely has no path field at all', function () {
  const local = { lastModified: 2000, units: 'mi' };
  const remote = baseState({ lastModified: 1000, path: { id: 'p1', currentNodeId: 'old-node' } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.path, null, 'a legacy state with no path key at all safely defaults to null, not undefined');
});

test('path from the newer device survives when it has a real value', function () {
  const local = baseState({ lastModified: 2000, path: { id: 'p2', currentNodeId: 'new-node' } });
  const remote = baseState({ lastModified: 1000, path: { id: 'p1', currentNodeId: 'old-node' } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.path.id, 'p2');
});

test('scalar fields (raceGoal/profile/planMeta) prefer the newer device wholesale', function () {
  const local = baseState({ lastModified: 2000, raceGoal: { event: '10k' }, profile: { p: 1 }, planMeta: { m: 1 } });
  const remote = baseState({ lastModified: 1000, raceGoal: { event: 'half' }, profile: { p: 2 }, planMeta: { m: 2 } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.raceGoal.event, '10k');
  assert.equal(merged.profile.p, 1);
  assert.equal(merged.planMeta.m, 1);
});

// docs/WORKOUT_RUNNER_SPEC.md -- an in-progress workout session is
// single-device scratch state. Unlike every other field, it must ALWAYS
// come from local, never remote, regardless of which side is newer --
// otherwise an active workout could be silently dropped (if local is
// older) or resurrect a stale/foreign in-progress session (if remote is
// newer) purely from a routine cloud sync.
test('activeWorkoutSession always comes from local, never remote, regardless of which device is newer', function () {
  const localWithSession = baseState({ lastModified: 1000, activeWorkoutSession: { key: '1-2', segmentIndex: 3 } });
  const remoteNewerNoSession = baseState({ lastModified: 5000, activeWorkoutSession: null });
  const merged1 = mergeState.mergeRunnerState(localWithSession, remoteNewerNoSession);
  assert.deepEqual(merged1.activeWorkoutSession, { key: '1-2', segmentIndex: 3 }, 'local session must survive even when remote is newer and has none');

  const localNoSession = baseState({ lastModified: 5000, activeWorkoutSession: null });
  const remoteWithSession = baseState({ lastModified: 1000, activeWorkoutSession: { key: '2-4', segmentIndex: 1 } });
  const merged2 = mergeState.mergeRunnerState(localNoSession, remoteWithSession);
  assert.equal(merged2.activeWorkoutSession, null, "remote's session must never resurrect on local, even as the older side");
});

test('flags (beta feature toggles) prefer the newer device wholesale, defaulting safely when absent', function () {
  const local = baseState({ lastModified: 2000, flags: { enableLongerDistances: true } });
  const remote = baseState({ lastModified: 1000, flags: { enableLongerDistances: false } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.flags.enableLongerDistances, true, 'newer (local) device wins for flags, same prefer-newer pattern as notifications');

  const localNoFlags = baseState({ lastModified: 2000 });
  const remoteNoFlags = baseState({ lastModified: 1000 });
  const mergedDefaults = mergeState.mergeRunnerState(localNoFlags, remoteNoFlags);
  assert.deepEqual(mergedDefaults.flags, { enableLongerDistances: false }, 'missing flags on both sides falls back to the safe default, not undefined');
});

test('recurringWorkouts added on different devices both survive the merge (union by id)', function () {
  const local = baseState({ lastModified: 2000, recurringWorkouts: [{ id: 'rw1', activityType: 'cycling', day: 1, durationMinutes: 45, intensity: 'high', fixed: true }] });
  const remote = baseState({ lastModified: 1000, recurringWorkouts: [{ id: 'rw2', activityType: 'yoga', day: null, durationMinutes: 60, intensity: 'low', fixed: false }] });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.recurringWorkouts.length, 2);
  assert.ok(merged.recurringWorkouts.some((w) => w.id === 'rw2'), 'the older/remote-only workout must not be dropped');
});

test('editing the same recurringWorkout id on the newer device replaces it, not just unions -- unlike unavailable/sideQuestLog\'s append-only union', function () {
  const local = baseState({ lastModified: 2000, recurringWorkouts: [{ id: 'rw1', activityType: 'cycling', day: 1, durationMinutes: 60, intensity: 'high', fixed: true }] });
  const remote = baseState({ lastModified: 1000, recurringWorkouts: [{ id: 'rw1', activityType: 'cycling', day: 1, durationMinutes: 45, intensity: 'moderate', fixed: true }] });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.recurringWorkouts.length, 1, 'editing the same workout must not create a duplicate entry');
  assert.equal(merged.recurringWorkouts[0].durationMinutes, 60, 'the newer device\'s edit wins');
});

// Regression: recurringWorkouts/travelPeriods used to merge by plain
// mergeMap (id-keyed), same resurrection gap as logs/overrides -- a workout
// removed on the newer device (app.js's recurring-workout-remove handler)
// could reappear from a stale device that still had it. Now wired through
// mergeMapT + deletedKeys.recurringWorkouts/travelPeriods like every other
// field this audit fixed.
test('a recurringWorkout removed on the newer device is NOT resurrected by a stale device that still has it', function () {
  const local = baseState({ lastModified: 3000, recurringWorkouts: [], deletedKeys: { recurringWorkouts: { rw1: true } } });
  const remote = baseState({ lastModified: 1000, recurringWorkouts: [{ id: 'rw1', activityType: 'cycling', day: 1, durationMinutes: 45, intensity: 'high', fixed: true }] });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.ok(!merged.recurringWorkouts.some((w) => w.id === 'rw1'), 'the removal on the newer device must win, not the stale device\'s copy');
  assert.equal(merged.deletedKeys.recurringWorkouts.rw1, true, 'the tombstone survives for a later third-device sync');
});

test('a travelPeriod removed on the newer device is NOT resurrected by a stale device that still has it', function () {
  const local = baseState({ lastModified: 3000, travelPeriods: [], deletedKeys: { travelPeriods: { tp1: true } } });
  const remote = baseState({ lastModified: 1000, travelPeriods: [{ id: 'tp1', start: '2026-08-25', end: '2026-09-08', mode: 'travel', indoorOnly: true }] });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.ok(!merged.travelPeriods.some((t) => t.id === 'tp1'), 'the removal on the newer device must win, not the stale device\'s copy');
  assert.equal(merged.deletedKeys.travelPeriods.tp1, true, 'the tombstone survives for a later third-device sync');
});

// Regression for the resurrection bug found in the launch audit: mergeMap
// merged `logs` purely by key presence, so a log deleted on the newer
// device (key simply absent) was indistinguishable from "this device never
// saw that key" -- a stale device that still had the entry would win it
// back. mergeMapT + deletedKeys.logs fixes this; these tests prove it.
test('a log deleted on the newer device is NOT resurrected by a stale device that still has it', function () {
  const local = baseState({ lastModified: 3000, logs: {}, deletedKeys: { logs: { '2-3': true } } });
  const remote = baseState({ lastModified: 1000, logs: { '2-3': { distance: 6.2, completionType: 'as_planned' } } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.logs['2-3'], undefined, 'the deletion on the newer device must win, not the stale device\'s copy');
  assert.equal(merged.deletedKeys.logs['2-3'], true, 'the tombstone itself must survive this merge for a later third-device sync');
});

test('a log deleted on the OLDER device does not clobber a real edit made later on the newer device', function () {
  const local = baseState({ lastModified: 3000, logs: { '2-3': { distance: 7, completionType: 'as_planned' } } });
  const remote = baseState({ lastModified: 1000, logs: {}, deletedKeys: { logs: { '2-3': true } } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.logs['2-3'].distance, 7, 'the newer device\'s real entry wins over an older device\'s stale deletion');
});

test('a log key untouched by one device still passes through from the other (plain union still works)', function () {
  const local = baseState({ lastModified: 2000, logs: { '1-1': { distance: 5 } } });
  const remote = baseState({ lastModified: 1000, logs: { '1-2': { distance: 3 } } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.logs['1-1'].distance, 5);
  assert.equal(merged.logs['1-2'].distance, 3, 'a key the newer device never touched at all -- no tombstone, no value -- must still survive');
});

// The same tombstone fix, wired identically for the other seven dict-shaped
// fields (see app.js setOverride/setCrossType/setSessionLog/
// setSessionOverride/setDayAdjustment/setScheduleChoice/
// setSideQuestCalendar) -- one compact resurrection-proof test per field
// rather than repeating all three logs-style variations for each.
[
  { field: 'overrides', key: '3-1', staleValue: 'Bike', newValue: 'Rest day' },
  { field: 'crossType', key: '3-1', staleValue: 'Row', newValue: 'Swim' },
  { field: 'sessionLogs', key: 'sess_1_0_secondary_spin1', staleValue: { time: '45' }, newValue: { time: '50' } },
  { field: 'sessionOverrides', key: 'sess_1_4_secondary_tabataFriAlt', staleValue: { skipped: true }, newValue: { skipped: false } },
  { field: 'dayAdjustments', key: '3-2', staleValue: { action: 'shortened', factor: 0.7 }, newValue: { action: 'moved', targetKey: '3-3' } },
  { field: 'scheduleChoices', key: 'tabataFriAlt', staleValue: 'move_long_run', newValue: 'keep_long_easy' },
  { field: 'sideQuestCalendar', key: '2026-08-10', staleValue: 'mission_1', newValue: 'mission_2' }
].forEach(function (c) {
  test('a deleted ' + c.field + ' key on the newer device is NOT resurrected by a stale device that still has it', function () {
    const localOverrides = { lastModified: 3000, deletedKeys: {} };
    localOverrides[c.field] = {};
    localOverrides.deletedKeys[c.field] = {};
    localOverrides.deletedKeys[c.field][c.key] = true;
    const remoteOverrides = { lastModified: 1000 };
    remoteOverrides[c.field] = {};
    remoteOverrides[c.field][c.key] = c.staleValue;
    const merged = mergeState.mergeRunnerState(baseState(localOverrides), baseState(remoteOverrides));
    assert.equal(merged[c.field][c.key], undefined, 'the deletion on the newer device must win, not the stale device\'s copy');
    assert.equal(merged.deletedKeys[c.field][c.key], true, 'the tombstone survives for a later third-device sync');
  });

  test(c.field + ' still merges a real edit on the newer device over an older, untouched value (existing behavior preserved)', function () {
    const localOverrides = { lastModified: 2000 };
    localOverrides[c.field] = {};
    localOverrides[c.field][c.key] = c.newValue;
    const remoteOverrides = { lastModified: 1000 };
    remoteOverrides[c.field] = {};
    remoteOverrides[c.field][c.key] = c.staleValue;
    const merged = mergeState.mergeRunnerState(baseState(localOverrides), baseState(remoteOverrides));
    assert.deepEqual(merged[c.field][c.key], c.newValue, 'the newer device\'s real value still wins, same as before this fix');
  });
});

test('legacy states missing deletedKeys entirely still merge logs correctly (no tombstone tracking, old behavior)', function () {
  const local = { lastModified: 2000, units: 'mi', logs: { '1-1': { distance: 5 } } };
  const remote = { lastModified: 1000, units: 'mi', logs: {} };
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.logs['1-1'].distance, 5);
  assert.deepEqual(merged.deletedKeys, {
    logs: {}, overrides: {}, workoutOverrides: {}, chatSessions: {}, crossType: {}, sessionLogs: {}, sessionOverrides: {},
    dayAdjustments: {}, scheduleChoices: {}, sideQuestCalendar: {},
    recurringWorkouts: {}, travelPeriods: {}
  });
});

test('lastModified in the merged result is always the max of both sides', function () {
  const local = baseState({ lastModified: 2000 });
  const remote = baseState({ lastModified: 5000 });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.lastModified, 5000);
});

test('weigh-ins logged on different devices on different dates both survive the merge (union by date)', function () {
  const local = baseState({ lastModified: 2000, weightEntries: [{ dateIso: '2026-07-20', weightLb: 160 }] });
  const remote = baseState({ lastModified: 1000, weightEntries: [{ dateIso: '2026-07-15', weightLb: 162 }] });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.weightEntries.length, 2);
  assert.ok(merged.weightEntries.some((w) => w.dateIso === '2026-07-15'), 'the older/remote-only entry must not be dropped');
});

test('two weigh-ins on the same date (a correction) resolve to one entry, the newer device\'s value -- not a duplicate for that day', function () {
  const local = baseState({ lastModified: 2000, weightEntries: [{ dateIso: '2026-07-20', weightLb: 159 }] });
  const remote = baseState({ lastModified: 1000, weightEntries: [{ dateIso: '2026-07-20', weightLb: 161 }] });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.weightEntries.length, 1, 'same-date entries must not create a duplicate');
  assert.equal(merged.weightEntries[0].weightLb, 159, 'the newer device\'s correction wins');
});

test('weightTrackingEnabled/weightUnits prefer the newer device wholesale, same pattern as flags/units', function () {
  const local = baseState({ lastModified: 2000, weightTrackingEnabled: true, weightUnits: 'kg' });
  const remote = baseState({ lastModified: 1000, weightTrackingEnabled: false, weightUnits: 'lb' });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.weightTrackingEnabled, true);
  assert.equal(merged.weightUnits, 'kg');
});

test('legacy states missing weight fields entirely still merge to safe defaults', function () {
  const local = { lastModified: 2000, units: 'km' };
  const remote = { lastModified: 1000, units: 'km' };
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.weightTrackingEnabled, false);
  assert.equal(merged.weightUnits, 'kg', 'falls back to a units-consistent default, not undefined');
  assert.deepEqual(merged.weightEntries, []);
});

// docs/COACHING_SPEC.md "Travel / temporary schedule overrides" -- same
// upsert-by-id semantics as recurringWorkouts, verified independently here.
test('travelPeriods from both devices survive the merge, upserted by id like recurringWorkouts', function () {
  const local = baseState({ lastModified: 2000, travelPeriods: [{ id: 'tp1', start: '2026-08-25', end: '2026-09-08', mode: 'travel', indoorOnly: true }] });
  const remote = baseState({ lastModified: 1000, travelPeriods: [{ id: 'tp2', start: '2026-11-01', end: '2026-11-05', mode: 'travel', indoorOnly: false }] });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.travelPeriods.length, 2, 'both devices\' travel periods must survive the union');
  assert.ok(merged.travelPeriods.some((t) => t.id === 'tp2'), 'the older/remote-only period must not be dropped');
});

test('editing a travel period\'s dates on the newer device wins outright, not a duplicate entry', function () {
  const local = baseState({ lastModified: 2000, travelPeriods: [{ id: 'tp1', start: '2026-08-25', end: '2026-09-10', mode: 'travel', indoorOnly: true }] });
  const remote = baseState({ lastModified: 1000, travelPeriods: [{ id: 'tp1', start: '2026-08-25', end: '2026-09-08', mode: 'travel', indoorOnly: true }] });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.travelPeriods.length, 1, 'editing in place must not orphan the old version under the same id');
  assert.equal(merged.travelPeriods[0].end, '2026-09-10', 'the newer device\'s edit wins');
});

test('legacy states missing travelPeriods entirely still merge to a safe empty array', function () {
  const local = { lastModified: 2000, units: 'mi' };
  const remote = { lastModified: 1000, units: 'mi' };
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.deepEqual(merged.travelPeriods, []);
});

// docs/COACHING_SPEC.md "Key-session conflict" -- scheduleChoices is a plain
// workoutId->optionId map, same shape/merge semantics as logs/overrides/
// crossType (mergeMap: per-key newer-device-wins, union of untouched keys).
test('scheduleChoices made on different devices for different workouts both survive the merge', function () {
  const local = baseState({ lastModified: 2000, scheduleChoices: { tabataFriAlt: 'move_long_run' } });
  const remote = baseState({ lastModified: 1000, scheduleChoices: { yogaFri: 'coexist' } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.deepEqual(merged.scheduleChoices, { tabataFriAlt: 'move_long_run', yogaFri: 'coexist' });
});

test('changing the same workout\'s schedule choice on the newer device wins, not a merge of both values', function () {
  const local = baseState({ lastModified: 2000, scheduleChoices: { tabataFriAlt: 'keep_long_easy' } });
  const remote = baseState({ lastModified: 1000, scheduleChoices: { tabataFriAlt: 'move_long_run' } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.scheduleChoices.tabataFriAlt, 'keep_long_easy');
});

test('legacy states missing scheduleChoices entirely still merge to a safe empty object', function () {
  const local = { lastModified: 2000, units: 'mi' };
  const remote = { lastModified: 1000, units: 'mi' };
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.deepEqual(merged.scheduleChoices, {});
});

// docs/COACHING_SPEC.md "Session-level architecture" -- sessionLogs/
// sessionOverrides are keyed by stable session id (not by day key), so two
// sessions on the same date get independent entries that can never collide
// or overwrite one another during merge -- same mergeMap semantics as
// logs/overrides, just proven here on session ids specifically.
test('two sessions on the same date (a run and a spin class) merge independently without overwriting each other', function () {
  const local = baseState({
    lastModified: 2000,
    sessionLogs: { sess_1_0_primary: { distance: 3.5, completionType: 'as_planned' } }
  });
  const remote = baseState({
    lastModified: 1000,
    sessionLogs: { sess_1_0_secondary_spin1: { time: '45', completionType: 'as_planned' } }
  });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.sessionLogs.sess_1_0_primary.distance, 3.5, 'the run log survives');
  assert.equal(merged.sessionLogs.sess_1_0_secondary_spin1.time, '45', 'the spin log survives too, not overwritten by the run');
});

test('editing the same session id on the newer device wins outright, matching logs/overrides', function () {
  const local = baseState({ lastModified: 2000, sessionLogs: { sess_1_0_secondary_spin1: { time: '50' } } });
  const remote = baseState({ lastModified: 1000, sessionLogs: { sess_1_0_secondary_spin1: { time: '45' } } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.sessionLogs.sess_1_0_secondary_spin1.time, '50');
});

test('a skipped-session tombstone survives merge instead of being silently resurrected by an older remote copy', function () {
  const local = baseState({ lastModified: 2000, sessionOverrides: { sess_1_4_secondary_tabataFriAlt: { skipped: true } } });
  const remote = baseState({ lastModified: 1000, sessionOverrides: {} });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.sessionOverrides.sess_1_4_secondary_tabataFriAlt.skipped, true, 'the tombstone (a real key, not an absence) always wins per normal mergeMap rules');
});

test('legacy states missing sessionLogs/sessionOverrides entirely still merge to safe empty objects', function () {
  const local = { lastModified: 2000, units: 'mi' };
  const remote = { lastModified: 1000, units: 'mi' };
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.deepEqual(merged.sessionLogs, {});
  assert.deepEqual(merged.sessionOverrides, {});
});

// docs/COACHING_SPEC.md "Today screen actions" -- dayAdjustments (shorten/
// move) merges exactly like logs/overrides: per-key newer-device-wins,
// union of untouched keys, safe empty default for legacy states.
test('dayAdjustments made on different devices for different days both survive the merge', function () {
  const local = baseState({ lastModified: 2000, dayAdjustments: { '3-2': { action: 'shortened', factor: 0.7 } } });
  const remote = baseState({ lastModified: 1000, dayAdjustments: { '4-6': { action: 'moved', targetKey: '4-5' } } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.deepEqual(merged.dayAdjustments, { '3-2': { action: 'shortened', factor: 0.7 }, '4-6': { action: 'moved', targetKey: '4-5' } });
});

test('editing the same day\'s adjustment on the newer device wins, matching logs/overrides', function () {
  const local = baseState({ lastModified: 2000, dayAdjustments: { '3-2': { action: 'shortened', factor: 0.7 } } });
  const remote = baseState({ lastModified: 1000, dayAdjustments: { '3-2': { action: 'moved', targetKey: '3-3' } } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.deepEqual(merged.dayAdjustments['3-2'], { action: 'shortened', factor: 0.7 });
});

test('legacy states missing dayAdjustments entirely still merge to a safe empty object', function () {
  const local = { lastModified: 2000, units: 'mi' };
  const remote = { lastModified: 1000, units: 'mi' };
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.deepEqual(merged.dayAdjustments, {});
});

// ── Typed schedule overrides (coach-negotiated day trades, app.js
// setWorkoutOverride/clearWorkoutOverride) -- same mergeMapT-by-day-key
// pattern and tombstone protection as `overrides`/`dayAdjustments` above.
test('typed workoutOverrides made on different devices for different days both survive the merge (two devices, two different day trades)', function () {
  const local = baseState({
    lastModified: 2000,
    workoutOverrides: { '1-0': { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null, source: 'coach' } }
  });
  const remote = baseState({
    lastModified: 1000,
    workoutOverrides: { '2-3': { type: 'rest', label: 'Rest', durationMinutes: null, plannedDistance: null, source: 'coach' } }
  });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.deepEqual(merged.workoutOverrides, {
    '1-0': { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null, source: 'coach' },
    '2-3': { type: 'rest', label: 'Rest', durationMinutes: null, plannedDistance: null, source: 'coach' }
  });
});

test('two devices editing the same day\'s typed workoutOverride: the newer device\'s trade wins outright, matching logs/overrides', function () {
  const local = baseState({
    lastModified: 2000,
    workoutOverrides: { '1-0': { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null, source: 'coach' } }
  });
  const remote = baseState({
    lastModified: 1000,
    workoutOverrides: { '1-0': { type: 'easy', label: '2 mi easy shakeout', durationMinutes: null, plannedDistance: 2, source: 'coach' } }
  });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.deepEqual(merged.workoutOverrides['1-0'], { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null, source: 'coach' });
});

test('a workoutOverride deleted on the newer device stays deleted (tombstone) rather than resurrected by a stale remote copy', function () {
  const local = baseState({ lastModified: 2000, workoutOverrides: {}, deletedKeys: { workoutOverrides: { '1-0': true } } });
  const remote = baseState({ lastModified: 1000, workoutOverrides: { '1-0': { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null, source: 'coach' } } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.workoutOverrides['1-0'], undefined);
});

test('legacy states missing workoutOverrides entirely still merge to a safe empty object (old saved states load normally)', function () {
  const local = { lastModified: 2000, units: 'mi' };
  const remote = { lastModified: 1000, units: 'mi' };
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.deepEqual(merged.workoutOverrides, {});
});

test('legacy label-only overrides and new typed workoutOverrides merge independently, side by side, without interfering with each other', function () {
  const local = baseState({
    lastModified: 2000,
    overrides: { '1-1': 'Easy 3 mi (feeling great)' },
    workoutOverrides: { '1-0': { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null, source: 'coach' } }
  });
  const remote = baseState({ lastModified: 1000 });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.overrides['1-1'], 'Easy 3 mi (feeling great)');
  assert.deepEqual(merged.workoutOverrides['1-0'], { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null, source: 'coach' });
});

// ── Chat-added secondary sessions (split/combine) -- same mergeMapT-by-
// day-key pattern as workoutOverrides above.
test('chatSessions added on different devices for different days both survive the merge', function () {
  const local = baseState({ lastModified: 2000, chatSessions: { '1-1': [{ id: 'sess_chat_1-1_1', role: 'secondary', label: 'Yoga' }] } });
  const remote = baseState({ lastModified: 1000, chatSessions: { '2-3': [{ id: 'sess_chat_2-3_1', role: 'secondary', label: 'Hike — 90 min' }] } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.chatSessions['1-1'][0].label, 'Yoga');
  assert.equal(merged.chatSessions['2-3'][0].label, 'Hike — 90 min');
});

test('a chatSessions entry combined (deleted) on the newer device stays deleted rather than resurrected by a stale remote copy', function () {
  const local = baseState({ lastModified: 2000, chatSessions: {}, deletedKeys: { chatSessions: { '1-1': true } } });
  const remote = baseState({ lastModified: 1000, chatSessions: { '1-1': [{ id: 'sess_chat_1-1_1', role: 'secondary', label: 'Yoga' }] } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.chatSessions['1-1'], undefined);
});

test('legacy states missing chatSessions entirely still merge to a safe empty object', function () {
  const local = { lastModified: 2000, units: 'mi' };
  const remote = { lastModified: 1000, units: 'mi' };
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.deepEqual(merged.chatSessions, {});
});


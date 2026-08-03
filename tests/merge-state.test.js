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

test('scalar fields (raceGoal/profile/planMeta) prefer the newer device wholesale', function () {
  const local = baseState({ lastModified: 2000, raceGoal: { event: '10k' }, profile: { p: 1 }, planMeta: { m: 1 } });
  const remote = baseState({ lastModified: 1000, raceGoal: { event: 'half' }, profile: { p: 2 }, planMeta: { m: 2 } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.raceGoal.event, '10k');
  assert.equal(merged.profile.p, 1);
  assert.equal(merged.planMeta.m, 1);
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


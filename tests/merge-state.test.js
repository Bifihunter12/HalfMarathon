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
    badges: [], xp: 0, xpEvents: [], xpProfile: null,
    raceGoal: null, profile: null, planMeta: null,
    logs: {}, overrides: {}, crossType: {},
    unavailable: [], sideQuestLog: [], runningFeelingLog: []
  }, overrides || {});
}

test('regression: an offline-only xpEvents entry on one device survives the merge', function () {
  // This is the exact historical bug shape this project hit and fixed --
  // state.xp used to be a bare prefer-newer scalar, so whichever device's
  // lastModified lost would have its entire XP gain silently discarded.
  const local = baseState({
    lastModified: 2000,
    xpEvents: [{ idempotencyKey: 'mainquest|1-1', source: 'main_quest', totalXp: 100, date: '2026-07-20' }],
    xp: 100
  });
  const remote = baseState({
    lastModified: 1000, // older -- simulates a device that synced less recently but earned XP while offline
    xpEvents: [{ idempotencyKey: 'mainquest|2-2', source: 'main_quest', totalXp: 200, date: '2026-07-21' }],
    xp: 200
  });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.xpEvents.length, 2, 'both devices\' events must survive the union, not just the newer device\'s');
  assert.ok(merged.xpEvents.some((e) => e.idempotencyKey === 'mainquest|2-2'), 'the older/remote-only event must not be dropped');
});

test('regression: state.xp always equals the sum of the merged ledger, never an independently-carried value', function () {
  const local = baseState({
    lastModified: 2000,
    xpEvents: [{ idempotencyKey: 'a', totalXp: 50 }, { idempotencyKey: 'b', totalXp: 30 }],
    xp: 999 // deliberately wrong/stale -- must be ignored and recomputed from the ledger
  });
  const remote = baseState({ lastModified: 1000, xpEvents: [{ idempotencyKey: 'c', totalXp: 20 }], xp: 20 });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.xp, 100, 'xp must be recomputed as the sum of the merged xpEvents (50+30+20), not carried from either side\'s stale scalar');
});

test('a conflicting edit to the same xpEvents idempotencyKey resolves to one entry, not two', function () {
  const local = baseState({ lastModified: 2000, xpEvents: [{ idempotencyKey: 'x', totalXp: 100 }], xp: 100 });
  const remote = baseState({ lastModified: 1000, xpEvents: [{ idempotencyKey: 'x', totalXp: 90 }], xp: 90 });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.xpEvents.length, 1);
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

test('scalar fields (raceGoal/profile/planMeta/xpProfile) prefer the newer device wholesale', function () {
  const local = baseState({ lastModified: 2000, raceGoal: { event: '10k' }, profile: { p: 1 }, planMeta: { m: 1 }, xpProfile: { lastLevelUpAt: 5 } });
  const remote = baseState({ lastModified: 1000, raceGoal: { event: 'half' }, profile: { p: 2 }, planMeta: { m: 2 }, xpProfile: { lastLevelUpAt: 9 } });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.raceGoal.event, '10k');
  assert.equal(merged.profile.p, 1);
  assert.equal(merged.planMeta.m, 1);
  assert.equal(merged.xpProfile.lastLevelUpAt, 5);
});

test('lastModified in the merged result is always the max of both sides', function () {
  const local = baseState({ lastModified: 2000 });
  const remote = baseState({ lastModified: 5000 });
  const merged = mergeState.mergeRunnerState(local, remote);
  assert.equal(merged.lastModified, 5000);
});

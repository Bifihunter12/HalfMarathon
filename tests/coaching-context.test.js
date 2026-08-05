const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const CoachingContext = require(path.join(__dirname, '..', 'coaching-context.js'));

test('missing/unavailable data comes through as null, never invented', function () {
  const ctx = CoachingContext.buildCoachingContext({});
  assert.equal(ctx.livePace, null);
  assert.equal(ctx.livePaceReliability, 'unavailable');
  assert.equal(ctx.liveHeartRate, null);
  assert.equal(ctx.heartRateReliability, 'unavailable');
  assert.equal(ctx.personalizedHrZones, null);
  assert.equal(ctx.prescribedPaceMin, null);
  assert.equal(ctx.prescribedHrZone, null);
  assert.equal(ctx.indoorOutdoor, null);
  assert.deepEqual(ctx.sensorAvailability, { pace: false, heartRate: false, gps: false });
});

test('a heart-rate reading older than the staleness threshold is treated as unavailable, not live', function () {
  const now = 1000000;
  const ctx = CoachingContext.buildCoachingContext({
    currentTime: now,
    sensorSnapshot: { liveHeartRate: 145, heartRateTimestamp: now - 40000, heartRateReliability: 'reliable', personalizedHrZones: { recoveryMin: 120, recoveryMax: 140 } }
  });
  assert.equal(ctx.liveHeartRate, null, 'a 40s-old reading must not be treated as live (30s threshold)');
  assert.equal(ctx.heartRateReliability, 'stale');
  assert.equal(ctx.personalizedHrZones, null, 'zones must not be usable alongside a stale reading');
});

test('a fresh heart-rate reading within the staleness threshold is preserved', function () {
  const now = 1000000;
  const ctx = CoachingContext.buildCoachingContext({
    currentTime: now,
    sensorSnapshot: { liveHeartRate: 145, heartRateTimestamp: now - 5000, heartRateReliability: 'reliable', personalizedHrZones: { recoveryMin: 120, recoveryMax: 140 } }
  });
  assert.equal(ctx.liveHeartRate, 145);
  assert.equal(ctx.sensorAvailability.heartRate, true);
});

test('an implausible heart-rate reading is rejected outright', function () {
  const now = 1000000;
  const ctx = CoachingContext.buildCoachingContext({
    currentTime: now,
    sensorSnapshot: { liveHeartRate: 9, heartRateTimestamp: now - 1000, heartRateReliability: 'reliable' }
  });
  assert.equal(ctx.liveHeartRate, null);
  assert.equal(ctx.heartRateReliability, 'implausible');
});

test('interval numbering is read straight from the normalized segment, not recomputed', function () {
  const ctx = CoachingContext.buildCoachingContext({ segment: { kind: 'work', intervalNumber: 3, totalIntervals: 6 } });
  assert.equal(ctx.segmentIntervalNumber, 3);
  assert.equal(ctx.segmentTotalIntervals, 6);
  assert.equal(ctx.isFinalInterval, false);
});

test('isFinalInterval is true only when intervalNumber equals totalIntervals', function () {
  const ctx = CoachingContext.buildCoachingContext({ segment: { kind: 'work', intervalNumber: 6, totalIntervals: 6 } });
  assert.equal(ctx.isFinalInterval, true);
});

test('recentCueCategories/recentCueIds only include history within the 10-minute window', function () {
  const now = 1000000;
  const ctx = CoachingContext.buildCoachingContext({
    currentTime: now,
    cueHistory: [
      { cueId: 'old_one', category: 'encouragement', deliveredAt: now - 20 * 60 * 1000 },
      { cueId: 'recent_one', category: 'technique', deliveredAt: now - 60 * 1000 }
    ]
  });
  assert.deepEqual(ctx.recentCueIds, ['recent_one']);
  assert.deepEqual(ctx.recentCueCategories, ['technique']);
  // fullCueHistory still carries everything, for maxPerWorkout/topic checks that must span the whole workout.
  assert.equal(ctx.fullCueHistory.length, 2);
});

test('prescription fields only appear when genuinely supplied, matching the plan engine (no formula derived here)', function () {
  const withPace = CoachingContext.buildCoachingContext({ prescription: { paceMinSecPerMi: 600, paceMaxSecPerMi: 630 } });
  assert.equal(withPace.prescribedPaceMin, 600);
  const withoutPace = CoachingContext.buildCoachingContext({ prescription: {} });
  assert.equal(withoutPace.prescribedPaceMin, null);
  assert.equal(withoutPace.prescribedPaceMax, null);
});

test('does not throw on a fully empty/malformed input object', function () {
  assert.doesNotThrow(function () { CoachingContext.buildCoachingContext(); });
  assert.doesNotThrow(function () { CoachingContext.buildCoachingContext({ cueHistory: null, segment: undefined, sensorSnapshot: null }); });
});

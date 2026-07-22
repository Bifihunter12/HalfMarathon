const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const sideQuests = require(path.join(__dirname, '..', 'side-quests.js'));

test('only one active progressive side quest can be active', function () {
  assert.equal(sideQuests.canStartSideQuest({ activeQuestTrack: null }, 'strong_runner_4_week').ok, true);
  const result = sideQuests.canStartSideQuest({ activeQuestTrack: { trackId: 'strong_runner_4_week' } }, 'other_track');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'one_active_side_quest');
});

test('mission filtering respects available equipment', function () {
  const filtered = sideQuests.filterMissionsByEquipment(sideQuests.MISSION_CATALOG, ['no_equipment']);
  assert.ok(filtered.some((m) => m.id === 'core_10'));
  assert.ok(!filtered.some((m) => m.id === 'carry_10'));
});

test('mission filtering removes painful limitation conflicts', function () {
  const filtered = sideQuests.filterMissionsByLimitations(sideQuests.MISSION_CATALOG, ['back_pain']);
  assert.ok(!filtered.some((m) => m.id === 'carry_10'));
  assert.ok(filtered.some((m) => m.id === 'upper_body_20'));
});

test('training load calculation includes main workouts and side missions', function () {
  const load = sideQuests.weeklyLoad(
    [{ type: 'easy' }, { type: 'quality' }, { type: 'long' }, { type: 'rest' }],
    [sideQuests.missionById('core_10'), sideQuests.missionById('upper_body_20')]
  );
  assert.equal(load, 15);
});

test('protected workouts are classified and not easy-run replaceable', function () {
  assert.equal(sideQuests.workoutClassification('long', '10 mi long run').classification, 'protected');
  assert.equal(sideQuests.substitutionValue('long', sideQuests.missionById('trail_90')), 'none');
  assert.equal(sideQuests.substitutionValue('easy', sideQuests.missionById('trail_90')), 'full_replacement');
});

test('calendar conflict catches lower-body fatigue before intervals and long runs', function () {
  const mission = sideQuests.missionById('strong_runner_20');
  assert.equal(sideQuests.detectCalendarConflict(mission, 0, [{ type: 'easy' }, { type: 'quality' }]).reason, 'avoid_before_quality');
  assert.equal(sideQuests.detectCalendarConflict(mission, 0, [{ type: 'easy' }, { type: 'long' }]).reason, 'avoid_before_long');
});

test('core work earns complementary partial credit but does not replace a run', function () {
  assert.equal(sideQuests.substitutionValue('easy', sideQuests.missionById('core_10')), 'partial_credit');
  assert.equal(sideQuests.substitutionValue('quality', sideQuests.missionById('core_10')), 'complementary');
});

test('quest progression and benchmark storage are explicit', function () {
  const track = sideQuests.questTrackById('strong_runner_4_week');
  assert.equal(sideQuests.questTrackTotalMissions(track), 8);
  assert.ok(track.benchmark.options.includes('single_leg_calf_raises'));
  assert.equal(track.missionIds[0], 'strong_runner_20');
});

test('xp rewards are present for the first five complete missions', function () {
  ['strong_runner_20', 'upper_body_20', 'core_10', 'trail_90', 'carry_10'].forEach((id) => {
    assert.ok(sideQuests.missionById(id).xpReward > 0);
  });
});

test('the four new bodyweight-first missions filter correctly by equipment', function () {
  const bodyweightOnly = sideQuests.filterMissionsByEquipment(sideQuests.MISSION_CATALOG, ['no_equipment']);
  ['single_leg_stability', 'core_control', 'upper_body_armor', 'runners_leg_circuit'].forEach((id) => {
    assert.ok(bodyweightOnly.some((m) => m.id === id), id + ' should be available with no equipment');
  });
});

test('challengeProgressFromLog accumulates reps across multiple sessions, not just the latest one', function () {
  const log = [
    { challengeId: 'squat_century', amount: 30, date: '2026-07-20' },
    { challengeId: 'squat_century', amount: 40, date: '2026-07-22' }
  ];
  const progress = sideQuests.challengeProgressFromLog('squat_century', log);
  assert.equal(progress.accumulated, 70);
  assert.equal(progress.complete, false);
});

test('challengeProgressFromLog reports level-crossing correctly for a multi-level ladder', function () {
  const log = [{ challengeId: 'lunge_ladder', amount: 45, date: '2026-07-22' }];
  const progress = sideQuests.challengeProgressFromLog('lunge_ladder', log);
  // 45 reps crosses the first level (20) and the second (40); levelTarget is
  // the NEXT target to reach (60), useful for a progress bar's "45 of 60".
  assert.equal(progress.level, 2);
  assert.equal(progress.levelTarget, 60);
  assert.equal(progress.complete, false);
});

test('challengeProgressFromLog only reports complete once the final level is reached', function () {
  const partial = sideQuests.challengeProgressFromLog('lunge_ladder', [{ challengeId: 'lunge_ladder', amount: 80 }]);
  assert.equal(partial.complete, false);
  const full = sideQuests.challengeProgressFromLog('lunge_ladder', [{ challengeId: 'lunge_ladder', amount: 100 }]);
  assert.equal(full.complete, true);
  assert.equal(full.level, 5);
});

test('challengeProgressFromLog ignores log entries for other challenges', function () {
  const log = [
    { challengeId: 'squat_century', amount: 100 },
    { challengeId: 'pushup_progress', amount: 15 }
  ];
  assert.equal(sideQuests.challengeProgressFromLog('pushup_progress', log).accumulated, 15);
});

test('two same-day contributions to the same challenge both survive (no natural-key collision)', function () {
  // Simulates app.js's unique-per-log id scheme (challenge_<id>_<timestamp>) --
  // distinct ids for the same challenge/date must both count, unlike reusing
  // the static challenge id which would collide in mergeRunnerState's dedup key.
  const log = [
    { id: 'challenge_squat_century_1000', challengeId: 'squat_century', amount: 30, date: '2026-07-22' },
    { id: 'challenge_squat_century_2000', challengeId: 'squat_century', amount: 40, date: '2026-07-22' }
  ];
  assert.equal(sideQuests.challengeProgressFromLog('squat_century', log).accumulated, 70);
});

test('all 8 bodyweight challenges are registered with a positive final-level XP reward', function () {
  const ids = ['squat_century', 'lunge_ladder', 'pushup_progress', 'glute_bridge_builder', 'calf_capacity', 'wall_sit_builder', 'plank_accumulator', 'step_up_summit'];
  ids.forEach((id) => {
    const challenge = sideQuests.challengeById(id);
    assert.ok(challenge, id + ' should exist in CHALLENGE_CATALOG');
    assert.ok(challenge.xpReward > 0);
    assert.ok(challenge.levels.length >= 1);
  });
});

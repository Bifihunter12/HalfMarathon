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

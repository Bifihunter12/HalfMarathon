const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const pathSystem = require(path.join(__dirname, '..', 'path-system.js'));

function sampleWeeks() {
  return Array.from({ length: 12 }, (_, i) => {
    const weekNum = i + 1;
    const phase = weekNum >= 11 ? 'taper' : weekNum >= 9 ? 'peak' : weekNum <= 4 ? 'base' : 'build';
    return {
      weekNum,
      phase,
      days: [
        { type: 'rest', label: 'Rest' },
        { type: 'easy', label: '3 mi easy run', miles: 3 },
        { type: weekNum >= 3 ? 'quality' : 'easy', label: weekNum >= 3 ? 'Intervals' : '3 mi easy run', miles: 3 },
        { type: 'rest', label: 'Rest' },
        { type: 'easy', label: '3 mi easy run', miles: 3 },
        { type: 'rest', label: 'Rest' },
        { type: weekNum === 12 ? 'race' : 'long', label: weekNum === 12 ? 'Half Marathon Race' : `${weekNum + 3} mi long run`, miles: weekNum + 3 }
      ]
    };
  });
}

test('Main Quest remains the only primary quest on the Path', function () {
  const pathModel = pathSystem.generatePath({ mainQuestActive: true, planLengthWeeks: 12, weeks: sampleWeeks(), logs: {}, sideMissionLog: [] });
  assert.equal(pathModel.nodes.filter((n) => n.required).every((n) => n.nodeType !== 'side_mission_achievement'), true);
  assert.equal(pathModel.nodes.filter((n) => n.nodeType === 'side_mission_achievement').every((n) => n.optional), true);
});

test('running milestones render chronologically and race remains final required node', function () {
  const pathModel = pathSystem.generatePath({ mainQuestActive: true, planLengthWeeks: 12, weeks: sampleWeeks(), logs: {}, sideMissionLog: [] });
  const required = pathModel.nodes.filter((n) => n.required);
  assert.deepEqual(required.map((n) => n.week), required.map((n) => n.week).slice().sort((a, b) => a - b));
  assert.equal(required.at(-1).id, 'main_quest_complete');
  assert.equal(required.at(-2).id, 'race_day');
});

test('optional Side Mission nodes do not block Main Quest progress', function () {
  const logs = { '1-1': { done: true } };
  const pathModel = pathSystem.generatePath({ mainQuestActive: true, planLengthWeeks: 12, weeks: sampleWeeks(), logs, sideMissionLog: [] });
  assert.notEqual(pathModel.currentNodeId, 'first_strength_mission');
  assert.equal(pathModel.nodes.find((n) => n.id === 'first_strength_mission').status, 'optional');
});

test('current node is the first incomplete required milestone', function () {
  const pathModel = pathSystem.generatePath({ mainQuestActive: true, planLengthWeeks: 12, weeks: sampleWeeks(), logs: { '1-1': { done: true } }, sideMissionLog: [] });
  assert.equal(pathModel.currentNodeId, 'first_week_complete');
});

test('locked future nodes cannot be falsely completed', function () {
  const pathModel = pathSystem.generatePath({ mainQuestActive: true, planLengthWeeks: 12, weeks: sampleWeeks(), logs: {}, sideMissionLog: [] });
  const race = pathModel.nodes.find((n) => n.id === 'race_day');
  assert.equal(race.status, 'locked');
  assert.equal(race.progressCurrent, 0);
});

test('Side Mission completion updates the Path and earns a badge', function () {
  const pathModel = pathSystem.generatePath({
    mainQuestActive: true,
    planLengthWeeks: 12,
    weeks: sampleWeeks(),
    logs: {},
    sideMissionLog: [{ id: 'core_10', category: 'core', date: '2026-07-21' }]
  });
  assert.equal(pathModel.nodes.find((n) => n.id === 'core_10_completed').status, 'completed');
  assert.ok(pathModel.earnedBadges.includes('badge_core_armor'));
});

test('Main Mission completion updates the Path', function () {
  const pathModel = pathSystem.generatePath({ mainQuestActive: true, planLengthWeeks: 12, weeks: sampleWeeks(), logs: { '1-1': { done: true } }, sideMissionLog: [] });
  assert.equal(pathModel.nodes.find((n) => n.id === 'first_main_mission').status, 'completed');
  assert.ok(pathModel.earnedBadges.includes('badge_first_mile'));
});

test('completed badges remain after plan changes and future nodes recalculate', function () {
  const previous = pathSystem.generatePath({
    mainQuestActive: true,
    planLengthWeeks: 12,
    weeks: sampleWeeks(),
    logs: { '1-1': { done: true } },
    sideMissionLog: [{ id: 'core_10', category: 'core' }]
  });
  const next = pathSystem.generatePath({ mainQuestActive: true, planLengthWeeks: 10, weeks: sampleWeeks().slice(0, 10), logs: {}, sideMissionLog: [] });
  const preserved = pathSystem.preserveCompletedAchievements(previous, next);
  assert.equal(preserved.nodes.find((n) => n.id === 'first_main_mission').status, 'completed');
  assert.ok(preserved.earnedBadges.includes('badge_core_armor'));
});

test('Path accessibility labels are present', function () {
  const pathModel = pathSystem.generatePath({ mainQuestActive: true, planLengthWeeks: 12, weeks: sampleWeeks(), logs: {}, sideMissionLog: [] });
  const label = pathSystem.accessibilityLabel(pathModel.nodes[0], 12);
  assert.match(label, /Main Quest milestone/);
  assert.match(label, /Week 1 of 12/);
});

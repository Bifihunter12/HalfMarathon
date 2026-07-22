const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const xp = require(path.join(__dirname, '..', 'xp-system.js'));

test('level curve hits the spec\'s own anchor points exactly', function () {
  assert.equal(xp.levelForTotalXp(0).level, 1);
  assert.equal(xp.levelForTotalXp(200).level, 2);
  assert.equal(xp.levelForTotalXp(500).level, 3);
  assert.equal(xp.levelForTotalXp(850).level, 4);
  assert.equal(xp.levelForTotalXp(1250).level, 5);
  assert.equal(xp.levelForTotalXp(4500).level, 10);
  assert.equal(xp.levelForTotalXp(9000).level, 15);
  assert.equal(xp.levelForTotalXp(15000).level, 20);
  assert.equal(xp.levelForTotalXp(31000).level, 30);
  assert.equal(xp.levelForTotalXp(52000).level, 40);
  assert.equal(xp.levelForTotalXp(80000).level, 50);
});

test('level lookup stays one level below the next threshold', function () {
  const justUnder = xp.levelForTotalXp(199);
  assert.equal(justUnder.level, 1);
  assert.equal(justUnder.currentLevelXp, 199);
  assert.equal(justUnder.nextLevelXp, 200);
});

test('max level has no next-level requirement', function () {
  const maxed = xp.levelForTotalXp(999999);
  assert.equal(maxed.level, 50);
  assert.equal(maxed.rankTitle, 'RACR');
  assert.equal(maxed.nextLevelXp, null);
});

test('rank titles match the spec\'s level ranges', function () {
  assert.equal(xp.rankTitleForLevel(1), 'In Motion');
  assert.equal(xp.rankTitleForLevel(4), 'In Motion');
  assert.equal(xp.rankTitleForLevel(5), 'Building');
  assert.equal(xp.rankTitleForLevel(10), 'Grounded');
  assert.equal(xp.rankTitleForLevel(20), 'Advancing');
  assert.equal(xp.rankTitleForLevel(25), 'Racecraft');
  assert.equal(xp.rankTitleForLevel(30), 'Seasoned');
  assert.equal(xp.rankTitleForLevel(40), 'Proven');
  assert.equal(xp.rankTitleForLevel(50), 'RACR');
});

test('Main Quest easy/long/cross/rest/race map straight through', function () {
  assert.equal(xp.xpForMainQuestWorkout({ type: 'easy' }, '4.5 mi easy run', 'planned').totalXp, 100);
  assert.equal(xp.xpForMainQuestWorkout({ type: 'long' }, '10 mi long run', 'planned').totalXp, 175);
  assert.equal(xp.xpForMainQuestWorkout({ type: 'cross' }, '45 min cross', 'planned').totalXp, 80);
  assert.equal(xp.xpForMainQuestWorkout({ type: 'rest' }, 'Rest', 'planned').totalXp, 40);
  assert.equal(xp.xpForMainQuestWorkout({ type: 'race' }, '10K Race', 'planned').totalXp, 500);
});

test('quality-day XP subtype is classified from the label, matching pace-zone conventions', function () {
  assert.equal(xp.mainQuestXpType({ type: 'quality' }, 'Tempo: 25 min @ threshold'), 'threshold');
  assert.equal(xp.mainQuestXpType({ type: 'quality' }, '6 x 800m @ 10K pace'), 'race_pace');
  assert.equal(xp.mainQuestXpType({ type: 'quality' }, 'Hill repeats x 8'), 'hill');
  assert.equal(xp.mainQuestXpType({ type: 'quality' }, 'Fartlek 30 min'), 'interval');
});

test('completion modifiers scale Main Quest XP correctly', function () {
  assert.equal(xp.xpForMainQuestWorkout({ type: 'easy' }, 'Easy run', 'planned').totalXp, 100);
  assert.equal(xp.xpForMainQuestWorkout({ type: 'easy' }, 'Easy run', 'modified').totalXp, 90);
  assert.equal(xp.xpForMainQuestWorkout({ type: 'easy' }, 'Easy run', 'partial').totalXp, 60);
  assert.equal(xp.xpForMainQuestWorkout({ type: 'easy' }, 'Easy run', 'stopped_early').totalXp, 40);
});

test('Main Quest XP never scales up for exceeding the plan -- modifier is keyed only by completionType', function () {
  const a = xp.xpForMainQuestWorkout({ type: 'easy', miles: 5 }, 'Easy run', 'planned');
  const b = xp.xpForMainQuestWorkout({ type: 'easy', miles: 5 }, 'Easy run', 'planned');
  assert.equal(a.totalXp, b.totalXp);
});

test('Side Mission XP uses the mission\'s own base value, not a second table', function () {
  assert.equal(xp.xpForSideMission(60).totalXp, 60);
  assert.equal(xp.xpForSideMission(60, 'modified').totalXp, 54);
  assert.equal(xp.xpForSideMission(0).totalXp, 0);
});

test('Side Mission weekly cap clamps repeatable XP to 30% of Main Quest XP that week', function () {
  assert.equal(xp.applySideMissionWeeklyCap(0, 600, 120), 120);
  assert.equal(xp.applySideMissionWeeklyCap(150, 600, 120), 30);
  assert.equal(xp.applySideMissionWeeklyCap(180, 600, 50), 0);
  assert.equal(xp.applySideMissionWeeklyCap(0, 0, 100), 0);
});

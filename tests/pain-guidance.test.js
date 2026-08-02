// Pain-report triage rubric (docs/SAFETY_POLICY.md). Never diagnoses -- only
// routes toward "keep going / back off / get it checked." Extracted from
// app.js specifically to fix a real bug this pass: the old version only went
// urgent on `worsens && !canWalk` together, so "can't walk normally" alone
// fell through to "mild, okay to continue."

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rules = require(path.join(__dirname, '..', 'coaching-rules.js'));

test('the bug this pass fixes: inability to walk normally alone (not worsening) is urgent, not mild', function () {
  var result = rules.painGuidance({ severity: 3, worsens: false, canWalk: false });
  assert.equal(result.level, 'urgent');
});

test('severity 7+ alone is always urgent', function () {
  var result = rules.painGuidance({ severity: 7, worsens: false, canWalk: true });
  assert.equal(result.level, 'urgent');
});

test('a form/gait change alone is urgent, even at low severity and not worsening', function () {
  var result = rules.painGuidance({ severity: 2, worsens: false, canWalk: true, formChange: true });
  assert.equal(result.level, 'urgent');
});

test('suspected bone tenderness alone is urgent', function () {
  var result = rules.painGuidance({ severity: 2, worsens: false, canWalk: true, boneTenderness: true });
  assert.equal(result.level, 'urgent');
});

test('moderate severity plus worsening is caution', function () {
  var result = rules.painGuidance({ severity: 4, worsens: true, canWalk: true });
  assert.equal(result.level, 'caution');
});

test('swelling alone bumps an otherwise-mild report to caution', function () {
  var result = rules.painGuidance({ severity: 2, worsens: false, canWalk: true, swelling: true });
  assert.equal(result.level, 'caution');
});

test('recurrence across several runs alone bumps to caution', function () {
  var result = rules.painGuidance({ severity: 2, worsens: false, canWalk: true, recurrent: true });
  assert.equal(result.level, 'caution');
});

test('pain present at rest alone bumps to caution', function () {
  var result = rules.painGuidance({ severity: 2, worsens: false, canWalk: true, restPain: true });
  assert.equal(result.level, 'caution');
});

test('sudden onset during the run itself bumps to caution', function () {
  var result = rules.painGuidance({ severity: 2, worsens: false, canWalk: true, onsetDuringRun: true, suddenOnset: true });
  assert.equal(result.level, 'caution');
});

test('gradual onset after running does not trigger the sudden-onset caution bump', function () {
  var result = rules.painGuidance({ severity: 2, worsens: false, canWalk: true, onsetDuringRun: false, suddenOnset: false });
  assert.equal(result.level, 'mild');
});

test('mild, not worsening, can walk normally, no optional fields answered: mild', function () {
  var result = rules.painGuidance({ severity: 2, worsens: false, canWalk: true });
  assert.equal(result.level, 'mild');
  assert.match(result.text, /okay to continue cautiously/);
});

test('legacy pain reports saved before the optional fields existed still evaluate correctly', function () {
  // Exactly the old 3-field shape, no new keys at all.
  var legacy = rules.painGuidance({ severity: 3, worsens: true, canWalk: true });
  assert.equal(legacy.level, 'mild');
  var legacyUrgent = rules.painGuidance({ severity: 8, worsens: true, canWalk: true });
  assert.equal(legacyUrgent.level, 'urgent');
});

test('missing/undefined details object does not throw', function () {
  assert.doesNotThrow(function () { rules.painGuidance(undefined); });
  assert.equal(rules.painGuidance(undefined).level, 'urgent'); // !canWalk defaults true when canWalk is undefined -- conservative by default
});

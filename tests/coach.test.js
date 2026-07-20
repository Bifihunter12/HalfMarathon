// Regression tests for netlify/functions/coach.js's safety invariants --
// this is the server-side validation that runs *after* the OpenAI call
// returns, which is what actually enforces "the AI never invents a number"
// (see coach.js's own header comment). No network call is made: global.fetch
// is mocked to return a crafted OpenAI-shaped response per test, so these
// run fast, free, and deterministic against the REAL exported handler,
// completely unmodified.
//
// Run with: node --test tests/          (Node 18.17+/20+, zero npm deps)
//
// This is the concrete regression coverage flagged missing in the 2026-07-14
// audit (docs/Runner_Audit_2026-07-14.html) -- the AI coach's hard safety
// invariants (red flags, never-invent-numbers, catalog-only substitutions)
// were only ever manually spot-checked before this file existed.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.OPENAI_API_KEY = 'test-key';
const { handler } = require(path.join(__dirname, '..', 'netlify', 'functions', 'coach.js'));

// Stubs global.fetch to answer like the OpenAI chat-completions endpoint.
// Pass `rawOverride` to simulate the model returning non-JSON garbage;
// otherwise `modelJson` is what the (fake) model "decided".
function mockOpenAI(modelJson, opts) {
  opts = opts || {};
  global.fetch = async function () {
    if (opts.upstreamError) return { ok: false, text: async function () { return 'upstream broke'; } };
    return {
      ok: true,
      json: async function () {
        return { choices: [{ message: { content: opts.rawOverride !== undefined ? opts.rawOverride : JSON.stringify(modelJson) } }] };
      }
    };
  };
}

// A small, realistic day list -- deliberately has no 'quality' day, so tests
// can confirm the app never lets the model conjure a type that isn't there.
var BASE_DAYS = [
  { key: '1-0', dow: 'MON', date: '2026-07-20', type: 'easy', label: '4 mi easy run', plannedDistance: 4 },
  { key: '1-1', dow: 'TUE', date: '2026-07-21', type: 'cross', label: '30 min cross', plannedDistance: null },
  { key: '1-2', dow: 'WED', date: '2026-07-22', type: 'long', label: '8 mi long run', plannedDistance: 8 }
];
var BASE_QUESTS = [
  { id: 'hike_60', name: '60-Minute Hike', category: 'hike', description: 'An easy hike.', estimatedMinutes: 60, trainingLoad: 3, replaces: ['easy', 'cross'] }
];

function basePayload(overrides) {
  return Object.assign({
    request: 'test message', today: '2026-07-20', days: BASE_DAYS, plan: {}, sideQuests: BASE_QUESTS
  }, overrides || {});
}

async function callHandler(bodyOverrides) {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify(basePayload(bodyOverrides)) });
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

test('red flag response always nulls the action, regardless of what the model attached', async function () {
  mockOpenAI({ message: 'Please stop and see a doctor.', riskLevel: 'red', decision: 'keep_plan', avoidToday: [], redFlags: ['chest pain'], action: { type: 'mark_rest', key: '1-0', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
  assert.equal(result.body.riskLevel, 'red');
});

test('seek_medical_evaluation decision nulls the action even when riskLevel says green', async function () {
  mockOpenAI({ message: 'Please get checked out.', riskLevel: 'green', decision: 'seek_medical_evaluation', avoidToday: [], redFlags: [], action: { type: 'mark_rest', key: '1-0', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('reduce_intensity factor below 0.5 is rejected', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'modify_workout', avoidToday: [], redFlags: [], action: { type: 'reduce_intensity', key: '1-0', factor: 0.3, note: 'tired' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('reduce_intensity factor above 0.9 is rejected', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'modify_workout', avoidToday: [], redFlags: [], action: { type: 'reduce_intensity', key: '1-0', factor: 1.2, note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('reduce_intensity within range on an easy day is accepted', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'modify_workout', avoidToday: [], redFlags: [], action: { type: 'reduce_intensity', key: '1-0', factor: 0.7, note: 'tired' } });
  var result = await callHandler();
  assert.equal(result.body.action.type, 'reduce_intensity');
  assert.equal(result.body.action.factor, 0.7);
});

test('reduce_intensity is rejected on a cross day (only easy/long are scalable)', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'modify_workout', avoidToday: [], redFlags: [], action: { type: 'reduce_intensity', key: '1-1', factor: 0.7, note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('substitute_workout is rejected when the requested type is not present among the given days', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [], action: { type: 'substitute_workout', key: '1-0', newType: 'quality', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('substitute_workout is accepted when the requested type exists among the given days', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [], action: { type: 'substitute_workout', key: '1-0', newType: 'cross', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action.type, 'substitute_workout');
  assert.equal(result.body.action.newType, 'cross');
});

test('substitute_side_quest is rejected for an id not in the provided catalog', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [], action: { type: 'substitute_side_quest', key: '1-0', sideQuestId: 'made_up_quest', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('substitute_side_quest is rejected when the quest does not replace this day type', async function () {
  // '1-2' is a long-run day; hike_60 only replaces easy/cross.
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [], action: { type: 'substitute_side_quest', key: '1-2', sideQuestId: 'hike_60', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('substitute_side_quest is accepted for a valid id/day-type match', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [], action: { type: 'substitute_side_quest', key: '1-0', sideQuestId: 'hike_60', note: 'bored' } });
  var result = await callHandler();
  assert.equal(result.body.action.type, 'substitute_side_quest');
  assert.equal(result.body.action.sideQuestId, 'hike_60');
});

test('an unrecognized action type is rejected', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'modify_workout', avoidToday: [], redFlags: [], action: { type: 'add_intervals', key: '1-0', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('an action referencing a day key not in the provided list is rejected', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'modify_workout', avoidToday: [], redFlags: [], action: { type: 'mark_rest', key: '9-9', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('malformed JSON from the model returns a 502, not a crash', async function () {
  mockOpenAI(null, { rawOverride: 'this is not json' });
  var result = await callHandler();
  assert.equal(result.status, 502);
  assert.ok(result.body.error);
});

test('a model response missing "message" returns a 502', async function () {
  mockOpenAI({ riskLevel: 'green', decision: 'keep_plan', avoidToday: [], redFlags: [], action: null });
  var result = await callHandler();
  assert.equal(result.status, 502);
});

test('missing required request fields returns a 400', async function () {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({}) });
  assert.equal(res.statusCode, 400);
});

test('a non-POST method returns a 405', async function () {
  var res = await handler({ httpMethod: 'GET', body: '{}' });
  assert.equal(res.statusCode, 405);
});

test('missing OPENAI_API_KEY returns a 500', async function () {
  var saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify(basePayload()) });
  process.env.OPENAI_API_KEY = saved;
  assert.equal(res.statusCode, 500);
});

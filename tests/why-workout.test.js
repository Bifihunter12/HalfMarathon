// Contract tests for netlify/functions/why-workout.js -- this function only
// explains an existing workout (never modifies the plan), so the risk
// surface is smaller than coach.js: mainly "does it fail closed on bad
// input/config" rather than a decision tree to validate.
//
// Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.OPENAI_API_KEY = 'test-key';
const { handler } = require(path.join(__dirname, '..', 'netlify', 'functions', 'why-workout.js'));

function mockOpenAI(text) {
  global.fetch = async function () {
    return { ok: true, json: async function () { return { choices: [{ message: { content: text } }] }; } };
  };
}

test('a non-POST method returns a 405', async function () {
  var res = await handler({ httpMethod: 'GET', body: '{}' });
  assert.equal(res.statusCode, 405);
});

test('invalid JSON body returns a 400', async function () {
  var res = await handler({ httpMethod: 'POST', body: 'not json' });
  assert.equal(res.statusCode, 400);
});

test('missing OPENAI_API_KEY returns a 500', async function () {
  var saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ day: {}, plan: {} }) });
  process.env.OPENAI_API_KEY = saved;
  assert.equal(res.statusCode, 500);
});

test('a successful model response is passed through as { explanation }', async function () {
  mockOpenAI('This easy run builds your aerobic base.');
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ day: { type: 'easy', label: '4 mi easy run', plannedDistance: 4, unit: 'mi' }, plan: { event: '10k', goal: 'finish' } }) });
  var body = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(body.explanation, 'This easy run builds your aerobic base.');
});

test('an empty model response returns a 502', async function () {
  mockOpenAI('');
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ day: {}, plan: {} }) });
  assert.equal(res.statusCode, 502);
});

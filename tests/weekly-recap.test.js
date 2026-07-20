// Contract tests for netlify/functions/weekly-recap.js -- narrates stats the
// client already computed deterministically; same "fail closed" risk
// surface as why-workout.js.
//
// Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.OPENAI_API_KEY = 'test-key';
const { handler } = require(path.join(__dirname, '..', 'netlify', 'functions', 'weekly-recap.js'));

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
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ week: {}, plan: {} }) });
  process.env.OPENAI_API_KEY = saved;
  assert.equal(res.statusCode, 500);
});

test('a successful model response is passed through as { recap }', async function () {
  mockOpenAI('You completed both key runs this week.');
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ week: { sessionsCompleted: 3, sessionsPlanned: 4 }, plan: { event: '10k' } }) });
  var body = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(body.recap, 'You completed both key runs this week.');
});

test('an upstream OpenAI error is surfaced as a 502', async function () {
  global.fetch = async function () {
    return { ok: false, text: async function () { return 'rate limited'; } };
  };
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ week: {}, plan: {} }) });
  assert.equal(res.statusCode, 502);
});

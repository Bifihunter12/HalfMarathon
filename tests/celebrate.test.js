// Contract tests for netlify/functions/celebrate.js -- phrases a genuine,
// deterministically-detected personal best. The "fact" itself is never
// AI-generated (checked in app.js before this is ever called), so the tests
// here focus on the same fail-closed contract as the other proxies, plus the
// JSON response-format parsing this one relies on.
//
// Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.OPENAI_API_KEY = 'test-key';
const { handler } = require(path.join(__dirname, '..', 'netlify', 'functions', 'celebrate.js'));

function mockOpenAI(rawContent) {
  global.fetch = async function () {
    return { ok: true, json: async function () { return { choices: [{ message: { content: rawContent } }] }; } };
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

test('a missing fact returns a 400', async function () {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ plan: {} }) });
  assert.equal(res.statusCode, 400);
});

test('missing OPENAI_API_KEY returns a 500', async function () {
  var saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ fact: { kind: 'longest_run' }, plan: {} }) });
  process.env.OPENAI_API_KEY = saved;
  assert.equal(res.statusCode, 500);
});

test('malformed JSON from the model returns a 502', async function () {
  mockOpenAI('not json');
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ fact: { kind: 'longest_run' }, plan: {} }) });
  assert.equal(res.statusCode, 502);
});

test('a model response missing "message" returns a 502', async function () {
  mockOpenAI(JSON.stringify({}));
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ fact: { kind: 'longest_run' }, plan: {} }) });
  assert.equal(res.statusCode, 502);
});

test('a successful model response is passed through as { message }', async function () {
  mockOpenAI(JSON.stringify({ message: 'That\'s your longest run yet -- nice work.' }));
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ fact: { kind: 'longest_run', distance: 10 }, plan: { event: '10k' } }) });
  var body = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(body.message, 'That\'s your longest run yet -- nice work.');
});

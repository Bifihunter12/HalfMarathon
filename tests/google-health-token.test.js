// Contract tests for netlify/functions/google-health-token.js -- OAuth
// token exchange/refresh. Keeps the Client Secret server-side; these tests
// check the request-shape validation and that both grant types are wired
// to the right required fields.
//
// Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.GOOGLE_HEALTH_CLIENT_ID = 'client-id';
process.env.GOOGLE_HEALTH_CLIENT_SECRET = 'client-secret';
const { handler } = require(path.join(__dirname, '..', 'netlify', 'functions', 'google-health-token.js'));

function mockToken(data, ok) {
  global.fetch = async function () { return { ok: ok !== false, json: async function () { return data; } }; };
}

test('a non-POST method returns a 405', async function () {
  var res = await handler({ httpMethod: 'GET', body: '{}' });
  assert.equal(res.statusCode, 405);
});

test('missing Google client env vars returns a 500', async function () {
  var saved = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
  delete process.env.GOOGLE_HEALTH_CLIENT_SECRET;
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ code: 'x', redirect_uri: 'y' }) });
  process.env.GOOGLE_HEALTH_CLIENT_SECRET = saved;
  assert.equal(res.statusCode, 500);
});

test('invalid JSON body returns a 400', async function () {
  var res = await handler({ httpMethod: 'POST', body: 'not json' });
  assert.equal(res.statusCode, 400);
});

test('the initial exchange requires code and redirect_uri', async function () {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({}) });
  assert.equal(res.statusCode, 400);
});

test('a refresh_token grant requires refresh_token', async function () {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ grant_type: 'refresh_token' }) });
  assert.equal(res.statusCode, 400);
});

test('a successful exchange returns the token fields', async function () {
  mockToken({ access_token: 'a1', refresh_token: 'r1', expires_in: 3600 });
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ code: 'c1', redirect_uri: 'https://example.com' }) });
  var body = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(body.access_token, 'a1');
  assert.equal(body.expires_in, 3600);
});

test('a failed exchange is surfaced as a 502', async function () {
  mockToken({ error: 'invalid_grant' }, false);
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ code: 'bad', redirect_uri: 'https://example.com' }) });
  assert.equal(res.statusCode, 502);
});

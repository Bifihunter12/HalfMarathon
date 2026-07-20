// Contract tests for netlify/functions/delete-account.js -- the two-step
// "verify the token, then delete the real user id it resolves to" flow.
// The invariant worth guarding here isn't a training-safety one, it's
// "never trust a client-supplied user id" -- the function always re-derives
// the id from Supabase's own /auth/v1/user before deleting anything.
//
// Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
const { handler } = require(path.join(__dirname, '..', 'netlify', 'functions', 'delete-account.js'));

// mockFn maps a request URL to a fake Response-shaped object.
function mockFetch(mockFn) {
  global.fetch = async function (url) { return mockFn(String(url)); };
}

test('a non-POST method returns a 405', async function () {
  var res = await handler({ httpMethod: 'GET', body: '{}' });
  assert.equal(res.statusCode, 405);
});

test('missing Supabase env vars returns a 500', async function () {
  var saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ access_token: 'x' }) });
  process.env.SUPABASE_SERVICE_ROLE_KEY = saved;
  assert.equal(res.statusCode, 500);
});

test('missing access_token returns a 400', async function () {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({}) });
  assert.equal(res.statusCode, 400);
});

test('an invalid/expired session returns a 401 and never calls the delete endpoint', async function () {
  var deleteCalled = false;
  mockFetch(function (url) {
    if (url.indexOf('/auth/v1/user') !== -1) return { ok: false };
    deleteCalled = true;
    return { ok: true, json: async function () { return {}; } };
  });
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ access_token: 'bad-token' }) });
  assert.equal(res.statusCode, 401);
  assert.equal(deleteCalled, false);
});

test('a valid session deletes the real resolved user id, not a client-supplied one', async function () {
  var deletedUrl = null;
  mockFetch(function (url) {
    if (url.indexOf('/auth/v1/user') !== -1) return { ok: true, json: async function () { return { id: 'real-user-id-from-supabase' }; } };
    deletedUrl = url;
    return { ok: true, json: async function () { return {}; } };
  });
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ access_token: 'good-token' }) });
  var body = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(body.deleted, true);
  assert.ok(deletedUrl.indexOf('real-user-id-from-supabase') !== -1);
});

test('a failed delete call is surfaced as a 502', async function () {
  mockFetch(function (url) {
    if (url.indexOf('/auth/v1/user') !== -1) return { ok: true, json: async function () { return { id: 'u1' }; } };
    return { ok: false, text: async function () { return 'admin delete failed'; } };
  });
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ access_token: 'good-token' }) });
  assert.equal(res.statusCode, 502);
});

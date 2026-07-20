// Contract tests for netlify/functions/google-health-activities.js -- a
// read-only fetch + reshape of one day's exercise sessions. The one bit of
// real logic worth regression-testing is the unit math (millimeters ->
// miles, start/end timestamps -> duration minutes).
//
// Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { handler } = require(path.join(__dirname, '..', 'netlify', 'functions', 'google-health-activities.js'));

function mockApi(data, ok, status) {
  global.fetch = async function () { return { ok: ok !== false, status: status || 200, json: async function () { return data; } }; };
}

test('a non-POST method returns a 405', async function () {
  var res = await handler({ httpMethod: 'GET', body: '{}' });
  assert.equal(res.statusCode, 405);
});

test('invalid JSON body returns a 400', async function () {
  var res = await handler({ httpMethod: 'POST', body: 'not json' });
  assert.equal(res.statusCode, 400);
});

test('missing accessToken or date returns a 400', async function () {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ accessToken: 'a1' }) });
  assert.equal(res.statusCode, 400);
});

test('an expired token (401 from Google) is passed through as a 401', async function () {
  mockApi({ error: { message: 'invalid credentials' } }, false, 401);
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ accessToken: 'expired', date: '2026-07-20' }) });
  assert.equal(res.statusCode, 401);
});

test('a non-401 upstream failure is surfaced as a 502', async function () {
  mockApi({ error: { message: 'server error' } }, false, 500);
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ accessToken: 'a1', date: '2026-07-20' }) });
  assert.equal(res.statusCode, 502);
});

test('a real session is correctly converted to minutes and miles', async function () {
  mockApi({
    dataPoints: [{
      exercise: {
        exerciseType: 'RUNNING', displayName: 'Morning Run',
        interval: { startTime: '2026-07-20T08:00:00Z', endTime: '2026-07-20T09:00:00Z' },
        metricsSummary: { distanceMillimeters: 1609344 } // exactly 1 mile
      }
    }]
  });
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ accessToken: 'a1', date: '2026-07-20' }) });
  var body = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(body.sessions.length, 1);
  assert.equal(body.sessions[0].durationMinutes, 60);
  assert.equal(body.sessions[0].distanceMiles, 1);
});

test('a session with no data points returns an empty array, not an error', async function () {
  mockApi({ dataPoints: [] });
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ accessToken: 'a1', date: '2026-07-20' }) });
  var body = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(body.sessions, []);
});

// Contract tests for netlify/functions/log-telemetry.js (docs/RELEASE_BLOCKERS.md
// CRITICAL-2 + CRITICAL-3). This endpoint must never surface its own error
// to the caller -- every path returns 204, including malformed input --
// since a telemetry pipeline breaking shouldn't ever become a second,
// user-visible failure on top of whatever it was trying to log.
//
// Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { handler } = require(path.join(__dirname, '..', 'netlify', 'functions', 'log-telemetry.js'));

test('a non-POST method still returns 204, never an error status', async function () {
  var res = await handler({ httpMethod: 'GET', body: '{}' });
  assert.equal(res.statusCode, 204);
});

test('invalid JSON body returns 204, not a 400', async function () {
  var res = await handler({ httpMethod: 'POST', body: 'not json' });
  assert.equal(res.statusCode, 204);
});

test('a missing name returns 204 without logging anything', async function () {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ kind: 'event' }) });
  assert.equal(res.statusCode, 204);
});

test('a valid error event is accepted', async function () {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ kind: 'error', name: 'TypeError', detail: 'x is not a function', timestamp: Date.now() }) });
  assert.equal(res.statusCode, 204);
});

test('a valid named event is accepted', async function () {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ kind: 'event', name: 'workout_logged', detail: 'easy' }) });
  assert.equal(res.statusCode, 204);
});

test('an unrecognized kind falls back to logging as "event", not "error"', async function () {
  var originalLog = console.log, originalError = console.error;
  var logged = null, errored = null;
  console.log = function (line) { logged = line; };
  console.error = function (line) { errored = line; };
  try {
    var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ kind: 'bogus', name: 'something' }) });
    assert.equal(res.statusCode, 204);
    assert.ok(logged && logged.indexOf('event') !== -1, 'should have logged via console.log as an event');
    assert.equal(errored, null, 'should not have logged via console.error');
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});

test('an oversized detail field is clipped before being logged, not rejected', async function () {
  var originalError = console.error;
  var errored = null;
  console.error = function (line) { errored = line; };
  try {
    var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ kind: 'error', name: 'huge', detail: 'x'.repeat(10000) }) });
    assert.equal(res.statusCode, 204);
    assert.ok(errored, 'the error should still have been logged');
    assert.ok(errored.length < 10000, 'the oversized detail must be clipped, not logged in full');
  } finally {
    console.error = originalError;
  }
});

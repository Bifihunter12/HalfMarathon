// Contract tests for netlify/functions/tts.js -- renders already-decided
// cue text to speech via OpenAI's TTS API. This function never generates
// content (see its own header comment); tests focus on the same fail-closed
// contract as the other OpenAI proxies, plus the binary-response shape.
//
// Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.OPENAI_API_KEY = 'test-key';
const { handler } = require(path.join(__dirname, '..', 'netlify', 'functions', 'tts.js'));

function mockOpenAI(bytes) {
  global.fetch = async function (url, opts) {
    return {
      ok: true,
      arrayBuffer: async function () { return bytes || new Uint8Array([1, 2, 3]).buffer; },
      _requestBody: opts && opts.body
    };
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

test('missing text returns a 400', async function () {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({}) });
  assert.equal(res.statusCode, 400);
});

test('empty/whitespace-only text returns a 400', async function () {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ text: '   ' }) });
  assert.equal(res.statusCode, 400);
});

test('text over the length limit returns a 400', async function () {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ text: 'a'.repeat(501) }) });
  assert.equal(res.statusCode, 400);
});

test('missing OPENAI_API_KEY returns a 500', async function () {
  var saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ text: 'Start running.' }) });
  process.env.OPENAI_API_KEY = saved;
  assert.equal(res.statusCode, 500);
});

test('an upstream OpenAI error is surfaced as a 502', async function () {
  global.fetch = async function () { return { ok: false, text: async function () { return 'rate limited'; } }; };
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ text: 'Start running.' }) });
  assert.equal(res.statusCode, 502);
});

test('a successful response returns base64-encoded audio bytes with the right content type', async function () {
  mockOpenAI(new Uint8Array([10, 20, 30]).buffer);
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({ text: 'Start running.' }) });
  assert.equal(res.statusCode, 200);
  assert.equal(res.isBase64Encoded, true);
  assert.equal(res.headers['Content-Type'], 'audio/mpeg');
  assert.equal(Buffer.from(res.body, 'base64').toString('hex'), Buffer.from(new Uint8Array([10, 20, 30])).toString('hex'));
});

test('an invalid/unrecognized voice falls back to the default instead of passing it through raw', async function () {
  var sentBody = null;
  global.fetch = async function (url, opts) {
    sentBody = JSON.parse(opts.body);
    return { ok: true, arrayBuffer: async function () { return new Uint8Array([1]).buffer; } };
  };
  await handler({ httpMethod: 'POST', body: JSON.stringify({ text: 'Start running.', voice: 'not-a-real-voice' }) });
  assert.equal(sentBody.voice, 'nova');
});

test('a valid voice is passed through to the upstream call', async function () {
  var sentBody = null;
  global.fetch = async function (url, opts) {
    sentBody = JSON.parse(opts.body);
    return { ok: true, arrayBuffer: async function () { return new Uint8Array([1]).buffer; } };
  };
  await handler({ httpMethod: 'POST', body: JSON.stringify({ text: 'Start running.', voice: 'shimmer' }) });
  assert.equal(sentBody.voice, 'shimmer');
});

test('the API key never appears in the response body on success or failure', async function () {
  mockOpenAI();
  var res1 = await handler({ httpMethod: 'POST', body: JSON.stringify({ text: 'Start running.' }) });
  assert.ok(!String(res1.body).includes('test-key'));
  global.fetch = async function () { return { ok: false, text: async function () { return 'error'; } }; };
  var res2 = await handler({ httpMethod: 'POST', body: JSON.stringify({ text: 'Start running.' }) });
  assert.ok(!String(res2.body).includes('test-key'));
});

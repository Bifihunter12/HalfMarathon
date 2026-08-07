// Text-to-speech proxy for the coach's audio cues -- calls OpenAI's TTS
// endpoint server-side so the API key never reaches the frontend, same
// pattern as celebrate.js/coach.js/why-workout.js/weekly-recap.js.
//
// This endpoint renders TEXT TO SPEECH ONLY -- it never generates content.
// `text` is always an already-selected, deterministic cue string from
// coaching-cues.js's selectCoachingCue() (see docs/COACHING_ENGINE_SPEC.md);
// this function has no idea what a workout or a cue even is, it just turns
// whatever string it's handed into audio. The coaching engine's
// data-truthfulness/safety rules are enforced upstream of this call, not here.
//
// Response is raw audio bytes (base64-encoded per Netlify's binary-response
// contract), not JSON -- the client plays it directly, no parsing needed.

var OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
var MODEL = 'tts-1';
// OpenAI's documented TTS voice set as of this integration -- kept as an
// explicit allowlist (not passed through raw) so a malformed/unexpected
// `voice` value can never reach the upstream API call.
var VALID_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'];
var DEFAULT_VOICE = 'nova';
var MAX_TEXT_LENGTH = 500; // generous for any single coaching cue; guards against abuse of this proxy

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  var apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: missing OPENAI_API_KEY' }) };
  }

  var payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  var text = typeof payload.text === 'string' ? payload.text.trim() : '';
  if (!text) return { statusCode: 400, body: JSON.stringify({ error: 'Missing text' }) };
  if (text.length > MAX_TEXT_LENGTH) return { statusCode: 400, body: JSON.stringify({ error: 'Text too long' }) };

  var voice = VALID_VOICES.indexOf(payload.voice) !== -1 ? payload.voice : DEFAULT_VOICE;

  try {
    var res = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: MODEL, input: text, voice: voice, response_format: 'mp3' })
    });

    if (!res.ok) {
      var errText = await res.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Upstream error', detail: errText.slice(0, 300) }) };
    }

    var arrayBuffer = await res.arrayBuffer();
    var base64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      statusCode: 200,
      // Identical (text, voice) always renders the same audio, so this is
      // safely cacheable long-term at the HTTP layer too, complementing the
      // client's own Cache Storage layer (audio-cues.js).
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
      body: base64,
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Proxy failure', detail: String((err && err.message) || err) }) };
  }
};

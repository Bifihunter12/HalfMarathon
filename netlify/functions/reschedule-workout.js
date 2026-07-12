// Conversational day-swap ("I want to run today instead of tomorrow").
// The AI's only job is picking WHICH two already-scheduled days the user
// means -- it never invents a workout or a label. The actual label swap is
// done client-side with the plan's own existing data, so nothing the AI
// hallucinates can end up in the plan.

var OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
var MODEL = 'gpt-4o-mini';

var SYSTEM_PROMPT = [
  'You are a scheduling assistant for a running training plan.',
  'You are given the real-world "today" date, and a JSON list of upcoming days, each with a "key", day-of-week ("dow"), "date", and its currently scheduled "label".',
  'Resolve relative terms in the user\'s request (e.g. "today", "tomorrow", "this weekend") against the given "today" date -- never guess at what day the user means without anchoring to it.',
  'Read the user\'s natural-language request and identify EXACTLY TWO keys from the provided list whose workouts the user wants swapped with each other.',
  'You may ONLY return keys that appear in the provided list -- never invent a day, a key, or a workout label.',
  'If the request does not clearly resolve to a swap between two of the provided days (ambiguous, needs more than a swap, or refers to a day not in the list), respond with an error instead.',
  'Respond ONLY with minified JSON, no other text: either {"keys": ["<key>", "<key>"]} or {"error": "<short reason, one sentence>"}.'
].join(' ');

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

  var request = typeof payload.request === 'string' ? payload.request.slice(0, 300) : '';
  var today = typeof payload.today === 'string' ? payload.today.slice(0, 10) : '';
  var days = Array.isArray(payload.days) ? payload.days.slice(0, 21) : [];

  if (!request || !today || !days.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing request, today, or days' }) };
  }

  // Only forward the fields the prompt is built around.
  var cleanDays = days.map(function (d) {
    return { key: String(d.key), dow: d.dow, date: d.date, label: d.label };
  });

  var validKeys = {};
  cleanDays.forEach(function (d) { validKeys[d.key] = true; });

  var userPrompt = 'Today\'s date: ' + today + '\n\nUpcoming days (JSON): ' + JSON.stringify(cleanDays) + '\n\nUser request: ' + request;

  try {
    var res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 150,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      var errText = await res.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Upstream error', detail: errText.slice(0, 300) }) };
    }

    var data = await res.json();
    var raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!raw) {
      return { statusCode: 502, body: JSON.stringify({ error: 'No content in AI response' }) };
    }

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { statusCode: 502, body: JSON.stringify({ error: 'AI response was not valid JSON' }) };
    }

    if (parsed.error) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: parsed.error }) };
    }

    // Hard server-side validation -- never trust the model's keys blindly.
    var keys = Array.isArray(parsed.keys) ? parsed.keys : [];
    if (keys.length !== 2 || keys[0] === keys[1] || !validKeys[keys[0]] || !validKeys[keys[1]]) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: "Couldn't match that to two of the upcoming days." }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: keys })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Proxy failure', detail: String((err && err.message) || err) }) };
  }
};

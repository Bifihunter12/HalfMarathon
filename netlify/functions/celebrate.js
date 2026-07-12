// Phrases a genuine personal-best moment warmly. Only called for actual
// milestones (detected deterministically client-side) -- ordinary log
// completions get a free local message instead, so this stays cheap and the
// AI call is reserved for moments that actually deserve one.

var OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
var MODEL = 'gpt-4o-mini';

var SYSTEM_PROMPT = [
  'You are a supportive running coach. The runner just logged a genuine personal best, described in the JSON fact below.',
  'Write ONE short, warm, specific celebration -- 1-2 sentences, plain language, no exclamation-point overload.',
  'Ground every number ONLY in the given fact -- never invent or round differently than what is given.',
  'Never use guilt, pressure, or imply they need to keep beating this every time -- celebrate the moment itself.',
  'Respond ONLY with minified JSON: {"message": "<celebration>"}.'
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

  var fact = payload.fact && typeof payload.fact === 'object' ? payload.fact : null;
  if (!fact || !fact.kind) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing fact' }) };
  }
  var plan = payload.plan && typeof payload.plan === 'object' ? payload.plan : {};

  var userPrompt = 'Milestone (JSON): ' + JSON.stringify(fact) + '\n\nRunner\'s plan: ' + JSON.stringify({ event: plan.event, goal: plan.goal });

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
        temperature: 0.7,
        max_tokens: 120,
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

    if (!parsed.message) {
      return { statusCode: 502, body: JSON.stringify({ error: 'AI response missing a message' }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: parsed.message }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Proxy failure', detail: String((err && err.message) || err) }) };
  }
};

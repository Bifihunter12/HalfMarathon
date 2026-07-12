// AI weekly recap -- a natural-language layer over the T0 recap data
// (renderProgressPanel's "Last week" numbers). Grounded only in the stats
// the client already computed deterministically; never a replacement for
// them -- the numbers still render even if this call fails.

var OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
var MODEL = 'gpt-4o-mini';

var SYSTEM_PROMPT = [
  'You are a running coach giving a short recap of the runner\'s most recently completed training week.',
  'Ground every statement ONLY in the JSON stats provided by the user message -- never invent a session, distance, or number that is not present in it.',
  'Never diagnose an injury or medical condition and never give medical advice.',
  'Never use guilt, shame, or fear-based motivation -- a missed session is not a failure, do not scold or use words like "should have".',
  'Never suggest increasing volume, intensity, or frequency beyond what the plan already specifies -- you are recapping the past week, not modifying the plan ahead.',
  'Keep the answer to 2-4 short sentences, warm and plain-language, addressed directly to the runner.'
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

  var week = payload.week || {};
  var plan = payload.plan || {};

  var context = {
    event: plan.event,
    goal: plan.goal,
    experienceLevel: plan.experienceLevel,
    phase: week.phase,
    sessionsCompleted: week.sessionsCompleted,
    sessionsPlanned: week.sessionsPlanned,
    consistencyPercent: week.consistencyPercent,
    distanceCompleted: week.distanceCompleted,
    distancePlanned: week.distancePlanned,
    unit: week.unit,
    hardestSessionLabel: week.hardestSessionLabel,
    hardestSessionRpe: week.hardestSessionRpe
  };

  var userPrompt = 'Last week\'s stats (JSON): ' + JSON.stringify(context) +
    '\n\nGive a short, encouraging recap of how last week went.';

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
        temperature: 0.6,
        max_tokens: 220
      })
    });

    if (!res.ok) {
      var errText = await res.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Upstream error', detail: errText.slice(0, 300) }) };
    }

    var data = await res.json();
    var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) {
      return { statusCode: 502, body: JSON.stringify({ error: 'No content in AI response' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recap: text.trim() })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Proxy failure', detail: String((err && err.message) || err) }) };
  }
};

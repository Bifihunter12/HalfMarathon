// Serverless proxy so the OpenAI key never sits in client code.
// Grounds the explanation only in the plan/day context the client sends --
// never lets the model invent training load, and hard-blocks diagnosis /
// guilt-based framing via the system prompt (see docs/execution-plan.html T2).

var OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
var MODEL = 'gpt-4o-mini';

var SYSTEM_PROMPT = [
  'You are a running coach explaining ONE workout inside a training plan that already exists.',
  'Ground every statement ONLY in the JSON context provided by the user message -- never invent a distance, pace, time, or instruction that is not present in it.',
  'Never diagnose an injury or medical condition and never give medical advice -- if pain or injury comes up, point back to the app\'s own pain-report feature instead of speculating.',
  'Never use guilt, shame, or fear-based motivation (no "you failed", no "you\'re falling behind", no comparisons to other runners).',
  'Never suggest increasing volume, intensity, or frequency beyond what the plan already specifies -- you explain the plan, you do not modify it.',
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

  var day = payload.day || {};
  var plan = payload.plan || {};

  // Only forward the specific fields the prompt is designed around -- never
  // pass arbitrary client data straight into the prompt.
  var context = {
    event: plan.event,
    goal: plan.goal,
    experienceLevel: plan.experienceLevel,
    weekNum: plan.weekNum,
    totalWeeks: plan.totalWeeks,
    phase: plan.phase,
    isCutbackWeek: !!plan.isCutbackWeek,
    isCompressedUnsafeTimeline: !!plan.isUnsafe,
    dayType: day.type,
    label: day.label,
    plannedDistance: day.plannedDistance,
    unit: day.unit
  };

  var userPrompt = 'Plan/workout context (JSON): ' + JSON.stringify(context) +
    '\n\nExplain why this specific workout is placed here in the plan.';

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
      body: JSON.stringify({ explanation: text.trim() })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Proxy failure', detail: String((err && err.message) || err) }) };
  }
};

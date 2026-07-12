// The AI coach -- replaces the narrower day-swap-only assistant. Handles
// free-form requests ("today is a rest day, I don't feel great", "I don't
// feel like biking, I want to run", "I did tabata instead", "how do I train
// VO2 max") with a single response shape: { message, action }.
//
// `action` is null for anything that isn't a concrete, agreed-to change to
// one specific day (general questions, motivation, injury talk on its own).
// When present, it's always validated server-side against the real day list
// the client sent -- the AI can never invent a day, key, or a training
// number. For substitute_workout specifically, `newType` must be a type that
// already exists among the provided days, so the client can reuse that
// day's real label/distance rather than the AI inventing one.

var OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
var MODEL = 'gpt-4o-mini';
var VALID_TYPES = ['easy', 'long', 'quality', 'cross', 'rest'];
var VALID_ACTIONS = ['mark_rest', 'substitute_workout', 'log_unplanned_activity'];

var SYSTEM_PROMPT = [
  'You are a supportive running coach chatting with a runner inside their training app.',
  'You are given the real-world "today" date, the runner\'s plan summary, and a JSON list of upcoming days, each with a "key", day-of-week ("dow"), "date", structural workout "type" (one of easy/long/quality/cross/rest), and its currently scheduled "label".',
  'Resolve relative terms ("today", "tomorrow") against the given "today" date.',

  'Decide whether the runner is clearly requesting or agreeing to a concrete change to ONE specific day from the list. If so, include an "action". Otherwise action must be null -- general questions, motivation, venting, or a bare symptom mention with no requested change are NOT actions.',
  'Allowed action types: "mark_rest" (runner wants a specific day to become a rest day -- include a short "note" with their stated reason), "substitute_workout" (runner wants to swap what TYPE of session happens on a day, e.g. cross-train instead of a run, or vice versa -- "newType" MUST be one of the types that already appears among the provided days, since the app reuses that real day\'s numbers rather than inventing new ones; never propose a type absent from the list), "log_unplanned_activity" (runner did something different than scheduled and wants it recorded, e.g. "I did tabata instead" -- include what they actually did as "note"; this only logs reality, it never changes the future plan).',
  'An action always needs a "key" from the provided list -- never invent one. If the runner\'s intent doesn\'t map cleanly to exactly one of these three action types and one day, set action to null and just respond conversationally.',

  'Never diagnose an injury or medical condition and never give medical advice. If the runner mentions pain, soreness, or an injury without explicitly asking for a schedule change, respond with brief, general, non-diagnostic guidance (e.g. keep effort easy, see how it feels over the next day or two) and mention the app\'s Safety panel covers when to see a doctor -- do NOT set an action from a bare symptom mention alone. If they mention pain AND explicitly ask for a change (e.g. "my back hurts, let\'s make today rest"), the action is fine.',
  'Never invent specific paces, VO2 max numbers, or other personalized metrics you don\'t actually have -- for training-knowledge questions (VO2 max, running faster, etc.) give general, evidence-based, safe guidance in plain language instead of fabricated personal numbers.',
  'Never suggest increasing volume or intensity beyond what the plan already contains, and never use guilt or shame -- this app\'s house rule is support, not pressure.',
  'Keep the "message" short: 2-4 sentences, warm, plain language, always written directly to the runner regardless of whether there\'s an action.',

  'Respond ONLY with minified JSON, no other text: {"message": "<reply>", "action": null} or {"message": "<reply>", "action": {"type": "<mark_rest|substitute_workout|log_unplanned_activity>", "key": "<key>", "newType": "<only for substitute_workout>", "note": "<short reason/description>"}}.'
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

  var request = typeof payload.request === 'string' ? payload.request.slice(0, 500) : '';
  var today = typeof payload.today === 'string' ? payload.today.slice(0, 10) : '';
  var days = Array.isArray(payload.days) ? payload.days.slice(0, 21) : [];
  var plan = payload.plan && typeof payload.plan === 'object' ? payload.plan : {};

  if (!request || !today || !days.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing request, today, or days' }) };
  }

  var cleanDays = days.map(function (d) {
    return { key: String(d.key), dow: d.dow, date: d.date, type: d.type, label: d.label };
  });

  var validKeys = {};
  var typesPresent = {};
  cleanDays.forEach(function (d) {
    validKeys[d.key] = true;
    typesPresent[d.type] = true;
  });

  var context = {
    event: plan.event, goal: plan.goal, experienceLevel: plan.experienceLevel
  };

  var userPrompt = 'Today\'s date: ' + today +
    '\n\nRunner\'s plan: ' + JSON.stringify(context) +
    '\n\nUpcoming days (JSON): ' + JSON.stringify(cleanDays) +
    '\n\nRunner\'s message: ' + request;

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
        temperature: 0.4,
        max_tokens: 300,
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

    var message = typeof parsed.message === 'string' ? parsed.message : '';
    if (!message) {
      return { statusCode: 502, body: JSON.stringify({ error: 'AI response missing a message' }) };
    }

    var action = parsed.action;
    if (!action || typeof action !== 'object') {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: message, action: null }) };
    }

    // Hard server-side validation -- never trust the model's action blindly.
    if (VALID_ACTIONS.indexOf(action.type) === -1 || !validKeys[action.key]) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: message, action: null }) };
    }
    if (action.type === 'substitute_workout' && (VALID_TYPES.indexOf(action.newType) === -1 || !typesPresent[action.newType])) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: message, action: null }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        action: {
          type: action.type,
          key: String(action.key),
          newType: action.type === 'substitute_workout' ? action.newType : undefined,
          note: typeof action.note === 'string' ? action.note.slice(0, 200) : ''
        }
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Proxy failure', detail: String((err && err.message) || err) }) };
  }
};

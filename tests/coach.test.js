// Regression tests for netlify/functions/coach.js's safety invariants --
// this is the server-side validation that runs *after* the OpenAI call
// returns, which is what actually enforces "the AI never invents a number"
// (see coach.js's own header comment). No network call is made: global.fetch
// is mocked to return a crafted OpenAI-shaped response per test, so these
// run fast, free, and deterministic against the REAL exported handler,
// completely unmodified.
//
// Run with: node --test tests/          (Node 18.17+/20+, zero npm deps)
//
// This is the concrete regression coverage flagged missing in the 2026-07-14
// audit (docs/Runner_Audit_2026-07-14.html) -- the AI coach's hard safety
// invariants (red flags, never-invent-numbers, catalog-only substitutions)
// were only ever manually spot-checked before this file existed.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.OPENAI_API_KEY = 'test-key';
const { handler } = require(path.join(__dirname, '..', 'netlify', 'functions', 'coach.js'));

// Stubs global.fetch to answer like the OpenAI chat-completions endpoint.
// Pass `rawOverride` to simulate the model returning non-JSON garbage;
// otherwise `modelJson` is what the (fake) model "decided".
function mockOpenAI(modelJson, opts) {
  opts = opts || {};
  global.fetch = async function () {
    if (opts.upstreamError) return { ok: false, text: async function () { return 'upstream broke'; } };
    return {
      ok: true,
      json: async function () {
        return { choices: [{ message: { content: opts.rawOverride !== undefined ? opts.rawOverride : JSON.stringify(modelJson) } }] };
      }
    };
  };
}

// A one-shot successful OpenAI-shaped response wrapping plain text content --
// used by the repetition-repair tests below, where the "model" is asked to
// return a rewritten sentence rather than JSON.
function okResponse(content) {
  return {
    ok: true,
    json: async function () {
      return { choices: [{ message: { content: content } }] };
    }
  };
}

// A small, realistic day list -- deliberately has no 'quality' day, so tests
// can confirm the app never lets the model conjure a type that isn't there.
var BASE_DAYS = [
  { key: '1-0', dow: 'MON', date: '2026-07-20', type: 'easy', label: '4 mi easy run', plannedDistance: 4 },
  { key: '1-1', dow: 'TUE', date: '2026-07-21', type: 'cross', label: '30 min cross', plannedDistance: null },
  { key: '1-2', dow: 'WED', date: '2026-07-22', type: 'long', label: '8 mi long run', plannedDistance: 8 }
];
var BASE_QUESTS = [
  { id: 'hike_60', name: '60-Minute Hike', category: 'hike', description: 'An easy hike.', estimatedMinutes: 60, trainingLoad: 3, replaces: ['easy', 'cross'] }
];

function basePayload(overrides) {
  return Object.assign({
    request: 'test message', today: '2026-07-20', days: BASE_DAYS, plan: {}, sideQuests: BASE_QUESTS
  }, overrides || {});
}

async function callHandler(bodyOverrides) {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify(basePayload(bodyOverrides)) });
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

test('red flag response always nulls the action, regardless of what the model attached', async function () {
  mockOpenAI({ message: 'Please stop and see a doctor.', riskLevel: 'red', decision: 'keep_plan', avoidToday: [], redFlags: ['chest pain'], action: { type: 'mark_rest', key: '1-0', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
  assert.equal(result.body.riskLevel, 'red');
});

test('seek_medical_evaluation decision nulls the action even when riskLevel says green', async function () {
  mockOpenAI({ message: 'Please get checked out.', riskLevel: 'green', decision: 'seek_medical_evaluation', avoidToday: [], redFlags: [], action: { type: 'mark_rest', key: '1-0', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('reduce_intensity factor below 0.5 is rejected', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'modify_workout', avoidToday: [], redFlags: [], action: { type: 'reduce_intensity', key: '1-0', factor: 0.3, note: 'tired' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('reduce_intensity factor above 0.9 is rejected', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'modify_workout', avoidToday: [], redFlags: [], action: { type: 'reduce_intensity', key: '1-0', factor: 1.2, note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('reduce_intensity within range on an easy day is accepted', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'modify_workout', avoidToday: [], redFlags: [], action: { type: 'reduce_intensity', key: '1-0', factor: 0.7, note: 'tired' } });
  var result = await callHandler();
  assert.equal(result.body.action.type, 'reduce_intensity');
  assert.equal(result.body.action.factor, 0.7);
});

test('reduce_intensity is rejected on a cross day (only easy/long are scalable)', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'modify_workout', avoidToday: [], redFlags: [], action: { type: 'reduce_intensity', key: '1-1', factor: 0.7, note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('substitute_workout is rejected when the requested type is not present among the given days', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [], action: { type: 'substitute_workout', key: '1-0', newType: 'quality', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('substitute_workout is accepted when the requested type exists among the given days', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [], action: { type: 'substitute_workout', key: '1-0', newType: 'cross', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action.type, 'substitute_workout');
  assert.equal(result.body.action.newType, 'cross');
});

test('substitute_side_quest is rejected for an id not in the provided catalog', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [], action: { type: 'substitute_side_quest', key: '1-0', sideQuestId: 'made_up_quest', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('substitute_side_quest is rejected when the quest does not replace this day type', async function () {
  // '1-2' is a long-run day; hike_60 only replaces easy/cross.
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [], action: { type: 'substitute_side_quest', key: '1-2', sideQuestId: 'hike_60', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('substitute_side_quest is accepted for a valid id/day-type match', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [], action: { type: 'substitute_side_quest', key: '1-0', sideQuestId: 'hike_60', note: 'bored' } });
  var result = await callHandler();
  assert.equal(result.body.action.type, 'substitute_side_quest');
  assert.equal(result.body.action.sideQuestId, 'hike_60');
});

test('an unrecognized action type is rejected', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'modify_workout', avoidToday: [], redFlags: [], action: { type: 'add_intervals', key: '1-0', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('an action referencing a day key not in the provided list is rejected', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'modify_workout', avoidToday: [], redFlags: [], action: { type: 'mark_rest', key: '9-9', note: 'x' } });
  var result = await callHandler();
  assert.equal(result.body.action, null);
});

test('a well-formed qualityPaceZonesSecPerMi is accepted without error', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'keep_plan', avoidToday: [], redFlags: [], action: null });
  var result = await callHandler({ plan: { qualityPaceZonesSecPerMi: { '10k': [420, 436], threshold: [430, 446] } } });
  assert.equal(result.status, 200);
});

test('a malformed qualityPaceZonesSecPerMi (wrong shape) is ignored, not a crash', async function () {
  mockOpenAI({ message: 'ok', riskLevel: 'green', decision: 'keep_plan', avoidToday: [], redFlags: [], action: null });
  var result1 = await callHandler({ plan: { qualityPaceZonesSecPerMi: 'not an object' } });
  assert.equal(result1.status, 200);
  var result2 = await callHandler({ plan: { qualityPaceZonesSecPerMi: { '10k': ['not', 'numbers'], madeUpZone: [1, 2] } } });
  assert.equal(result2.status, 200);
});

test('malformed JSON from the model returns a 502, not a crash', async function () {
  mockOpenAI(null, { rawOverride: 'this is not json' });
  var result = await callHandler();
  assert.equal(result.status, 502);
  assert.ok(result.body.error);
});

test('a model response missing "message" returns a 502', async function () {
  mockOpenAI({ riskLevel: 'green', decision: 'keep_plan', avoidToday: [], redFlags: [], action: null });
  var result = await callHandler();
  assert.equal(result.status, 502);
});

test('missing required request fields returns a 400', async function () {
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify({}) });
  assert.equal(res.statusCode, 400);
});

test('a non-POST method returns a 405', async function () {
  var res = await handler({ httpMethod: 'GET', body: '{}' });
  assert.equal(res.statusCode, 405);
});

test('missing OPENAI_API_KEY returns a 500', async function () {
  var saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  var res = await handler({ httpMethod: 'POST', body: JSON.stringify(basePayload()) });
  process.env.OPENAI_API_KEY = saved;
  assert.equal(res.statusCode, 500);
});

// ── reschedule_days / recovery negotiation (Monday rest -> 12-3-30, Sunday
// becomes the new recovery day) ──────────────────────────────────────────
var RESCHEDULE_DAYS = [
  { key: '1-0', dow: 'MON', date: '2026-07-20', type: 'rest', label: 'Rest', plannedDistance: null },
  { key: '1-1', dow: 'TUE', date: '2026-07-21', type: 'easy', label: '3 mi easy run', plannedDistance: 3 },
  { key: '1-2', dow: 'WED', date: '2026-07-22', type: 'quality', label: 'Tempo: 20 min', plannedDistance: null },
  { key: '1-5', dow: 'SAT', date: '2026-07-25', type: 'long', label: '8 mi long run', plannedDistance: 8 },
  { key: '1-6', dow: 'SUN', date: '2026-07-26', type: 'easy', label: '4 mi easy run', plannedDistance: 4 }
];
var TWELVE_THREE_THIRTY = { type: 'cross', label: '12-3-30 Incline Walk', durationMinutes: 30, plannedDistance: null };

test('reschedule_days: core scenario -- Monday rest becomes 12-3-30, Sunday becomes the new recovery day', async function () {
  mockOpenAI({
    message: 'Absolutely -- 12-3-30 today, and Sunday becomes your recovery day.', riskLevel: 'green', decision: 'replace_with_cross_training',
    avoidToday: [], redFlags: [],
    action: { type: 'reschedule_days', changes: [{ key: '1-0', workout: TWELVE_THREE_THIRTY }, { key: '1-6', workout: { type: 'rest', label: 'Rest', durationMinutes: null, plannedDistance: null } }], note: 'moved recovery to Sunday' }
  });
  var result = await callHandler({ request: 'I want to do 12-3-30 today and make Sunday rest', days: RESCHEDULE_DAYS });
  assert.equal(result.body.action.type, 'reschedule_days');
  assert.equal(result.body.action.changes.length, 2);
  var monday = result.body.action.changes.filter(function (c) { return c.key === '1-0'; })[0];
  var sunday = result.body.action.changes.filter(function (c) { return c.key === '1-6'; })[0];
  assert.equal(monday.workout.type, 'cross');
  assert.equal(monday.workout.label, '12-3-30 Incline Walk');
  assert.equal(monday.workout.durationMinutes, 30);
  assert.equal(sunday.workout.type, 'rest');
  assert.equal(result.body.pendingIntent, null);
});

test('reschedule_days: a known workout phrase (12-3-30) is forced to its canonical deterministic workout even if the model got the type wrong', async function () {
  mockOpenAI({
    message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [],
    // Model wrongly calls it an easy run named "Walk" -- must be corrected.
    action: { type: 'reschedule_days', changes: [{ key: '1-0', workout: { type: 'easy', label: 'Walk', durationMinutes: 30, plannedDistance: null } }, { key: '1-6', workout: { type: 'rest', label: 'Rest' } }], note: '' }
  });
  var result = await callHandler({ request: 'lets do 12/3/30 today', days: RESCHEDULE_DAYS });
  var monday = result.body.action.changes.filter(function (c) { return c.key === '1-0'; })[0];
  assert.equal(monday.workout.type, 'cross');
  assert.equal(monday.workout.label, '12-3-30 Incline Walk');
});

test('reschedule_days: displacing a long run without relocating it is rejected (action nulled)', async function () {
  mockOpenAI({
    message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [],
    action: { type: 'reschedule_days', changes: [{ key: '1-0', workout: TWELVE_THREE_THIRTY }, { key: '1-5', workout: { type: 'rest', label: 'Rest' } }], note: '' }
  });
  var result = await callHandler({ request: '12-3-30 today, make Saturday rest', days: RESCHEDULE_DAYS });
  assert.equal(result.body.action, null);
});

test('reschedule_days: a change targeting a race day is rejected', async function () {
  var withRace = RESCHEDULE_DAYS.concat([{ key: '1-7', dow: 'MON', date: '2026-07-27', type: 'race', label: '10K Race', plannedDistance: 6.2 }]);
  mockOpenAI({
    message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [],
    action: { type: 'reschedule_days', changes: [{ key: '1-0', workout: TWELVE_THREE_THIRTY }, { key: '1-7', workout: { type: 'rest', label: 'Rest' } }], note: '' }
  });
  var result = await callHandler({ request: '12-3-30 today', days: withRace });
  assert.equal(result.body.action, null);
});

test('reschedule_days: a malformed change (missing workout) is rejected', async function () {
  mockOpenAI({
    message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [],
    action: { type: 'reschedule_days', changes: [{ key: '1-0' }], note: '' }
  });
  var result = await callHandler({ request: '12-3-30 today', days: RESCHEDULE_DAYS });
  assert.equal(result.body.action, null);
});

test('reschedule_days: a week that would end without a real rest day is rejected', async function () {
  mockOpenAI({
    message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [],
    action: { type: 'reschedule_days', changes: [{ key: '1-0', workout: TWELVE_THREE_THIRTY }], note: '' }
  });
  var result = await callHandler({ request: '12-3-30 today', days: RESCHEDULE_DAYS });
  assert.equal(result.body.action, null);
});

test('reschedule_days: existing safety net still applies -- a red-flag response nulls a reschedule_days action too', async function () {
  mockOpenAI({
    message: 'Please stop and see a doctor.', riskLevel: 'red', decision: 'seek_medical_evaluation', avoidToday: [], redFlags: ['chest pain'],
    action: { type: 'reschedule_days', changes: [{ key: '1-0', workout: TWELVE_THREE_THIRTY }, { key: '1-6', workout: { type: 'rest', label: 'Rest' } }], note: '' }
  });
  var result = await callHandler({ request: '12-3-30 today, chest pain though', days: RESCHEDULE_DAYS });
  assert.equal(result.body.action, null);
  assert.equal(result.body.riskLevel, 'red');
});

// ── Pending scheduling intent ("which day should become recovery?") ──────
test('pendingIntent: passed through when the coach asks which day should become recovery (no action yet)', async function () {
  mockOpenAI({
    message: 'Absolutely -- you can do 12-3-30 today. Which day would you like to keep free for recovery?', riskLevel: 'green', decision: 'modify_workout',
    avoidToday: [], redFlags: [], action: null,
    pendingIntent: { type: 'move_recovery', sourceKey: '1-0', requestedWorkout: TWELVE_THREE_THIRTY }
  });
  var result = await callHandler({ request: 'I want to do 12-3-30 today', days: RESCHEDULE_DAYS });
  assert.equal(result.body.action, null);
  assert.deepEqual(result.body.pendingIntent, { type: 'move_recovery', sourceKey: '1-0', requestedWorkout: TWELVE_THREE_THIRTY });
});

test('pendingIntent: a forged/stale sourceKey not in the current day list is dropped, not passed through', async function () {
  mockOpenAI({
    message: 'ok', riskLevel: 'green', decision: 'keep_plan', avoidToday: [], redFlags: [], action: null,
    pendingIntent: { type: 'move_recovery', sourceKey: '9-9', requestedWorkout: TWELVE_THREE_THIRTY }
  });
  var result = await callHandler({ request: 'ok', days: RESCHEDULE_DAYS });
  assert.equal(result.body.pendingIntent, null);
});

test('pendingIntent: never sent alongside a real action, even if the model returned both', async function () {
  mockOpenAI({
    message: 'ok', riskLevel: 'green', decision: 'rest', avoidToday: [], redFlags: [],
    action: { type: 'mark_rest', key: '1-1', note: 'tired' },
    pendingIntent: { type: 'move_recovery', sourceKey: '1-0', requestedWorkout: TWELVE_THREE_THIRTY }
  });
  var result = await callHandler({ request: 'ok', days: RESCHEDULE_DAYS });
  assert.notEqual(result.body.action, null);
  assert.equal(result.body.pendingIntent, null);
});

test('pendingIntent: the request payload accepts and forwards a client-supplied pendingIntent to the model prompt', async function () {
  var sentBody = null;
  global.fetch = async function (url, opts) {
    sentBody = JSON.parse(opts.body);
    var modelContent = JSON.stringify({ message: 'ok', riskLevel: 'green', decision: 'keep_plan', avoidToday: [], redFlags: [], action: null });
    return {
      ok: true,
      json: async function () { return { choices: [{ message: { content: modelContent } }] }; }
    };
  };
  await callHandler({
    request: 'Sunday', days: RESCHEDULE_DAYS,
    pendingIntent: { type: 'move_recovery', sourceKey: '1-0', requestedWorkout: TWELVE_THREE_THIRTY }
  });
  var userMsg = sentBody.messages[sentBody.messages.length - 1].content;
  assert.ok(userMsg.indexOf('move_recovery') !== -1, 'the pending intent should be forwarded into the prompt');
  assert.ok(userMsg.indexOf('1-0') !== -1);
});

// ── Server-side repetition guard ──────────────────────────────────────────
const { _internal } = require(path.join(__dirname, '..', 'netlify', 'functions', 'coach.js'));

// ── Planned-activity discovery (arbitrary activities via chat, task 8) ───
test('reschedule_days: a hike named with activityType/terrainDifficulty gets its real deterministic classification, not the model\'s own wording', async function () {
  mockOpenAI({
    message: "I'll add that hike and keep your easy run day free.", riskLevel: 'green', decision: 'replace_with_cross_training',
    avoidToday: [], redFlags: [],
    action: { type: 'reschedule_days', changes: [{ key: '1-1', workout: { type: 'easy', label: 'a hike I guess', durationMinutes: 5, activityType: 'hiking', terrainDifficulty: 'hard' } }], note: '' }
  });
  var result = await callHandler({ request: "I'm hiking Saturday, about 3 hours with a lot of climbing", days: RESCHEDULE_DAYS });
  var change = result.body.action.changes[0];
  assert.equal(change.workout.type, 'cross');
  assert.match(change.workout.label, /Hike/);
  assert.notEqual(change.workout.label, 'a hike I guess');
});

test('reschedule_days: an unknown activityType is rejected server-side even if everything else about the change is valid', async function () {
  mockOpenAI({
    message: 'ok', riskLevel: 'green', decision: 'replace_with_cross_training', avoidToday: [], redFlags: [],
    action: { type: 'reschedule_days', changes: [{ key: '1-1', workout: { type: 'easy', label: 'Trapeze practice', activityType: 'trapeze' } }], note: '' }
  });
  var result = await callHandler({ request: 'trapeze class Saturday', days: RESCHEDULE_DAYS });
  assert.equal(result.body.action, null);
});

test('isRepeatedMessage: true when a real (>=8-word) sentence exactly matches a recent assistant sentence, modulo case/punctuation', function () {
  var prior = ["We need to stick with the rest day to protect your recovery this week."];
  var candidate = "We need to stick with the rest day to protect your recovery this week!";
  assert.equal(_internal.isRepeatedMessage(candidate, prior), true);
  assert.equal(_internal.isRepeatedMessage(candidate.toUpperCase(), prior), true);
});

test('isRepeatedMessage: false when the overlapping sentence is too short to count (fragments do not trigger it)', function () {
  var prior = ['Got it.', 'Sounds good.'];
  assert.equal(_internal.isRepeatedMessage('Got it.', prior), false);
});

test('isRepeatedMessage: false when there is no real overlap', function () {
  var prior = ["Let's keep today easy and reassess tomorrow morning before your next session."];
  var candidate = "Sure, 12-3-30 works well today as a light recovery-friendly option.";
  assert.equal(_internal.isRepeatedMessage(candidate, prior), false);
});

test('isRepeatedMessage: false with no prior assistant messages at all', function () {
  assert.equal(_internal.isRepeatedMessage('Any long enough sentence should still return false with nothing to compare against.', []), false);
  assert.equal(_internal.isRepeatedMessage('Any long enough sentence should still return false with nothing to compare against.', null), false);
});

test('repairRepeatedMessage: returns the rewritten text on a successful, sufficiently different rewrite', async function () {
  var rewritten = "Sure thing -- let's get that scheduled and keep your recovery day intact elsewhere this week.";
  global.fetch = async function () { return okResponse('"' + rewritten + '"'); };
  var text = await _internal.repairRepeatedMessage('We need to stick with the rest day to protect your recovery this week.', ['We need to stick with the rest day to protect your recovery this week.'], 'k', global.fetch);
  assert.equal(text, rewritten);
});

test('repairRepeatedMessage: returns null when the upstream call fails', async function () {
  global.fetch = async function () { return { ok: false, text: async function () { return 'boom'; } }; };
  var text = await _internal.repairRepeatedMessage('some message', [], 'k', global.fetch);
  assert.equal(text, null);
});

test('repairRepeatedMessage: returns null when the rewrite itself is still a repeat', async function () {
  var priorSentence = 'We need to stick with the rest day to protect your recovery this week.';
  global.fetch = async function () { return okResponse(priorSentence); };
  var text = await _internal.repairRepeatedMessage(priorSentence, [priorSentence], 'k', global.fetch);
  assert.equal(text, null);
});

test('handler: a repeated message is rewritten via the repair path, and the validated action is preserved unchanged', async function () {
  var priorSentence = 'We need to stick with the rest day to protect your recovery this week.';
  var callCount = 0;
  global.fetch = async function () {
    callCount++;
    if (callCount === 1) {
      // Primary decision call -- returns the exact prior sentence again, plus a real action.
      return {
        ok: true,
        json: async function () {
          return { choices: [{ message: { content: JSON.stringify({ message: priorSentence, riskLevel: 'green', decision: 'rest', avoidToday: [], redFlags: [], action: { type: 'mark_rest', key: '1-1', note: 'tired' } }) } }] };
        }
      };
    }
    // Repair call -- a genuinely different rewrite.
    return okResponse("Recovery still matters this week, so let's keep today light and easy instead.");
  };
  var history = [{ role: 'assistant', content: priorSentence }];
  var result = await callHandler({ request: 'can I run today', days: RESCHEDULE_DAYS, history: history });
  assert.notEqual(result.body.message, priorSentence);
  assert.equal(callCount, 2, 'a repeated message must trigger exactly one repair attempt');
  assert.deepEqual(result.body.action, { type: 'mark_rest', key: '1-1', note: 'tired' });
});

test('handler: when the repair attempt itself fails, a concise deterministic fallback is used instead of the duplicate sentence', async function () {
  var priorSentence = 'We need to stick with the rest day to protect your recovery this week.';
  var callCount = 0;
  global.fetch = async function () {
    callCount++;
    if (callCount === 1) {
      return {
        ok: true,
        json: async function () {
          return { choices: [{ message: { content: JSON.stringify({ message: priorSentence, riskLevel: 'green', decision: 'keep_plan', avoidToday: [], redFlags: [], action: null }) } }] };
        }
      };
    }
    return { ok: false, text: async function () { return 'upstream broke'; } };
  };
  var history = [{ role: 'assistant', content: priorSentence }];
  var result = await callHandler({ request: 'can I run today', days: RESCHEDULE_DAYS, history: history });
  assert.notEqual(result.body.message, priorSentence);
  assert.equal(result.body.message, "Got it -- let's take this one step at a time. What would help most right now?");
});

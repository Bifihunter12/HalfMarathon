const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.OPENAI_API_KEY = 'test-key';

const identity = require(path.join(__dirname, '..', 'netlify', 'functions', 'coach-identity.js'));
const coach = require(path.join(__dirname, '..', 'netlify', 'functions', 'coach.js'));
const whyWorkout = require(path.join(__dirname, '..', 'netlify', 'functions', 'why-workout.js'));
const weeklyRecap = require(path.join(__dirname, '..', 'netlify', 'functions', 'weekly-recap.js'));
const celebrate = require(path.join(__dirname, '..', 'netlify', 'functions', 'celebrate.js'));

function captureSystemPrompt(replyContent) {
  var captured = null;
  global.fetch = async function (_url, options) {
    var body = JSON.parse(options.body);
    captured = body.messages[0].content;
    return { ok: true, json: async function () { return { choices: [{ message: { content: replyContent } }] }; } };
  };
  return function () { return captured; };
}

test('shared coach identity includes the master prompt pillars', function () {
  var prompt = identity.buildPrompt([]);
  assert.match(prompt, /Canonical coach identity/);
  assert.match(prompt, /health is more important than completing a workout/);
  assert.match(prompt, /Never promote punishment, guilt/);
  assert.match(prompt, /Fueling and recovery guidance/);
});

test('all AI coach endpoints include the shared coach identity in their system prompt', async function () {
  var getCoachPrompt = captureSystemPrompt(JSON.stringify({
    message: 'Keep this easy and controlled today.',
    riskLevel: 'green',
    decision: 'keep_plan',
    avoidToday: [],
    redFlags: [],
    action: null,
    pendingIntent: null
  }));
  await coach.handler({ httpMethod: 'POST', body: JSON.stringify({
    request: 'What should I do today?',
    today: '2026-08-12',
    days: [{ key: '1-1', dow: 'Tue', date: '2026-08-12', type: 'easy', label: '3 mi easy run', plannedDistance: 3 }]
  }) });
  assert.match(getCoachPrompt(), /Canonical coach identity/);

  var getWhyPrompt = captureSystemPrompt('This easy run builds aerobic fitness.');
  await whyWorkout.handler({ httpMethod: 'POST', body: JSON.stringify({
    day: { type: 'easy', label: '3 mi easy run', plannedDistance: 3, unit: 'mi' },
    plan: { event: '5k', goal: 'finish' }
  }) });
  assert.match(getWhyPrompt(), /Canonical coach identity/);

  var getRecapPrompt = captureSystemPrompt('You completed the key work and kept the week steady.');
  await weeklyRecap.handler({ httpMethod: 'POST', body: JSON.stringify({
    week: { phase: 'base', sessionsCompleted: 3, sessionsPlanned: 4, consistencyPercent: 75, unit: 'mi' },
    plan: { event: '10k', goal: 'finish' }
  }) });
  assert.match(getRecapPrompt(), /Canonical coach identity/);

  var getCelebratePrompt = captureSystemPrompt(JSON.stringify({ message: 'That is a real personal best. Nice work.' }));
  await celebrate.handler({ httpMethod: 'POST', body: JSON.stringify({
    fact: { kind: 'longest_run', distance: 6, unit: 'mi' },
    plan: { event: 'half', goal: 'finish' }
  }) });
  assert.match(getCelebratePrompt(), /Canonical coach identity/);
});

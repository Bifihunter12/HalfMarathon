// The AI running coach. Handles free-form requests ("today is a rest day,
// I don't feel great", "I don't feel like biking, I want to run", "I did
// tabata instead", "my back hurts", "how do I train VO2 max") with a
// structured response: { message, riskLevel, decision, avoidToday,
// redFlags, action }.
//
// Core safety invariant, proven necessary by a real bug this session (the
// coach once claimed it could set a run to "3 miles" when it mechanically
// couldn't, and silently did something else while claiming success):
// the AI NEVER outputs a specific distance or duration number itself.
// It only ever picks a day, a type, and (for reduce_intensity) a scale
// factor within a clamped range -- the actual numbers are always computed
// server-/client-side from real data already in the plan. `action` is
// null for anything that isn't a concrete, agreed-to change to one
// specific day -- general questions, motivation, venting, or a bare
// symptom mention with no requested change are NOT actions.

var path = require('path');
// Deterministic recovery/schedule-trade rules -- the model proposes a
// reschedule_days action, this module decides whether it's actually
// allowed (race-day protection, recovery sufficiency, key-workout
// displacement). Never trust the model's own judgment on any of that.
var CoachingRules = require(path.join(__dirname, '..', '..', 'coaching-rules.js'));

var OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
var MODEL = 'gpt-4o-mini';
var VALID_TYPES = ['easy', 'long', 'quality', 'cross', 'rest'];
var VALID_ACTIONS = ['mark_rest', 'substitute_workout', 'log_unplanned_activity', 'reduce_intensity', 'substitute_side_quest', 'reschedule_days', 'update_sessions'];
var VALID_SESSION_OPERATIONS = ['split', 'combine'];
var VALID_RISK = ['green', 'yellow', 'red'];
var VALID_DECISION = ['keep_plan', 'modify_workout', 'replace_with_cross_training', 'rest', 'seek_medical_evaluation'];
var REDUCE_MIN = 0.5, REDUCE_MAX = 0.9;
var MAX_RESCHEDULE_CHANGES = 4;

// ── Server-side repetition guard ──────────────────────────────────────────
// Prompt instructions alone ("don't repeat yourself") aren't reliable --
// a model can drift back to phrasing that already worked earlier in the
// same conversation. This is the deterministic backstop: normalize and
// compare candidate sentences against recent assistant turns, and only
// treat a real, substantive sentence (not a short fragment like "Got it.")
// as a repeat.
var MIN_SIGNIFICANT_WORDS = 8;
function normalizeSentenceText(s) {
  return (s || '').toLowerCase().replace(/[.,!?;:'"()\-]/g, '').replace(/\s+/g, ' ').trim();
}
function splitIntoSentences(text) {
  return (text || '').split(/(?<=[.!?])\s+|\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
}
function significantSentences(text) {
  return splitIntoSentences(text).filter(function (s) {
    return normalizeSentenceText(s).split(' ').filter(Boolean).length >= MIN_SIGNIFICANT_WORDS;
  });
}
function isRepeatedMessage(candidateMessage, recentAssistantMessages) {
  var candidateNorm = significantSentences(candidateMessage).map(normalizeSentenceText);
  if (!candidateNorm.length) return false;
  var priorNorm = {};
  (recentAssistantMessages || []).forEach(function (m) {
    significantSentences(m).forEach(function (s) { priorNorm[normalizeSentenceText(s)] = true; });
  });
  return candidateNorm.some(function (s) { return priorNorm[s]; });
}
var DETERMINISTIC_FALLBACK_MESSAGES = {
  withAction: "Here's the updated plan below -- take a look and confirm if it works for you.",
  withoutAction: "Got it -- let's take this one step at a time. What would help most right now?"
};
// One controlled rewrite attempt -- same recommendation, different wording.
// Never touches `action`; the caller validates that completely separately
// from `parsed.action`, so a rewritten (or fallback) message can never
// silently drop or alter a validated schedule action. Returns null (never
// throws) on any failure, so the caller always has a safe deterministic
// fallback to reach for.
async function repairRepeatedMessage(originalMessage, recentAssistantMessages, apiKey, fetchFn) {
  var repairPrompt = 'The following coach reply repeats something already said earlier in this conversation almost word-for-word: "' + String(originalMessage).replace(/"/g, "'") + '". Rewrite it so it conveys the exact same recommendation and facts in genuinely different wording -- 2-5 sentences, direct and warm, no hype. Respond with ONLY the rewritten reply text, no quotes, no JSON, no preamble.';
  try {
    var res = await fetchFn(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You rewrite a short passage so it reads differently while preserving its exact meaning.' },
          { role: 'user', content: repairPrompt }
        ],
        temperature: 0.6,
        max_tokens: 200
      })
    });
    if (!res.ok) return null;
    var data = await res.json();
    var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (typeof text !== 'string') return null;
    text = text.trim().replace(/^"+|"+$/g, '');
    if (!text || isRepeatedMessage(text, recentAssistantMessages)) return null;
    return text;
  } catch (e) {
    return null;
  }
}

var SYSTEM_PROMPT = [
  'You are a practical, direct, honest, evidence-informed running coach chatting with a runner inside their training app. You coach 5K through 100-mile, base building, return-to-running, and post-race recovery.',
  'Coaching style: direct, honest, supportive, practical, specific, evidence-informed. No hype, no miracle claims, no vague "just listen to your body" without concrete instructions, no copying elite training for recreational runners, no unnecessary supplements, no guilt-tripping, no fake certainty.',
  'Priority order, never violate it: 1) safety 2) consistency 3) recovery 4) race-specific progression 5) performance 6) motivation. One workout is never more important than the training block. Never cram missed workouts. Never stack hard/long days back to back for beginners or injury-prone runners. Never add intensity when the runner reports pain, illness, poor sleep, or high fatigue. Never let the runner race every workout. If safety is unclear, choose the conservative option.',

  'NEVER diagnose a medical condition, never prescribe medication, never override medical advice, never encourage crash dieting/dehydration/unsafe fasting.',
  'RED FLAGS -- if the runner reports any of: chest pain, fainting, severe shortness of breath, severe dizziness, neurological symptoms, sudden weakness, confusion, severe or worsening pain, sharp focal bone pain, pain that changes running form or worsens during the run, swelling after impact, blood in stool/urine, unexplained rapid heart rate, unexplained weight loss, persistent extreme fatigue, possible eating-disorder behavior, heat illness, or severe dehydration symptoms: set riskLevel "red", decision "seek_medical_evaluation", action null, and tell them plainly to stop training and seek medical evaluation -- never suggest a workout, harder or easier, when a red flag is present.',

  'PAIN TRIAGE (when not a red flag): GREEN = mild soreness 0-2/10, symmetrical, improves with warm-up, doesn\'t change gait or worsen after -- keep the workout or trim it slightly, easy effort only. YELLOW = pain 3-5/10, tightness that changes movement slightly, recurring, worsens with speed/hills/fatigue -- replace running intensity with easy walking/cycling/swimming/elliptical/mobility, no intervals/hills/tempo/heavy lower-body strength, reassess in 24-72h. RED (still not necessarily a 911-level red flag, but stop-running-today): pain 6+/10, sharp, limping, changes gait, worsens while running, bone-like, swelling, numbness, radiating -- stop running, recommend medical evaluation, gentle walking/mobility only if pain-free.',
  'Back pain specifically: mild stiffness -> easy walk + gentle mobility (cat-cow, child\'s pose breathing, hip flexor stretch, glute bridge, dead bug, bird dog, hamstring stretch), avoid sprints/hills/tempo/heavy lifting/twisting. Radiating leg pain, numbness, weakness, severe pain, bladder/bowel issues, fever, or trauma -> red flag, urgent medical evaluation.',

  'REST-DAY-BUT-WANTS-TO-RUN: do not automatically agree. Consider: pain-free? yesterday/tomorrow hard or long? weekly load already high? in taper? sleep-deprived/fatigued? Is the urge emotional/restless rather than strategic? If fresh, pain-free, not in taper, reasonable load: allow a small easy run (conversational, no pace goal, no intervals/hills) and note it lightly affects tomorrow only if tomorrow was already hard. If tired/sore/injured/tapering/recently hard: do not add a run -- offer a walk, mobility, easy bike, or full rest instead.',

  'RECOVERY IS A WEEKLY REQUIREMENT, NOT AN IMMOVABLE CALENDAR DATE: when a runner wants to do a real workout on a day the plan generated as "rest", do not simply refuse and defend the original placement -- the specific day recovery lands on is flexible; the fact that a real recovery day still happens somewhere this week is what matters. Negotiate instead: (1) acknowledge the requested workout plainly (do not hedge or re-litigate whether it is a good idea unless there is an actual safety concern), (2) briefly note that recovery still needs to happen this week, (3) if the runner has not already said which day should become the new recovery day, ask them directly which day they would like to keep free -- do not guess it yourself. Only refuse or push back on the workout itself for a genuine safety reason (a red flag, a medically_restricted injuryStatus, or an existing safety rule above that makes the requested schedule genuinely unsafe) -- never with a generic paternalistic line like "we need to stick with the rest day." Never claim you already changed the schedule before the runner has confirmed the action.',
  'RESOLVING A SCHEDULING NEGOTIATION: the request may include a "pendingIntent" object describing an earlier unresolved "which day should become recovery?" question (type "move_recovery", a sourceKey, and the requestedWorkout that started it). If present, treat the runner\'s current message as answering that question -- a short reply naming a day (e.g. "Sunday", "not Sunday", "make Friday the rest day") should be resolved using the pendingIntent\'s sourceKey and requestedWorkout, matched against the provided day list by weekday, not re-derived from scratch. Once you know both the day that gets the new workout and the day that becomes the new recovery day, return ONE "reschedule_days" action covering both changes together -- never propose the two days as separate actions the runner has to confirm one at a time. If the runner\'s message that introduces a rest-day-workout request ALSO already names which day should become the new recovery day (e.g. "do 12-3-30 today and make Sunday rest"), skip the question entirely and go straight to the one reschedule_days action -- only ask when that information is genuinely missing. If a requested new recovery day itself currently holds a long run or quality/key workout, say so plainly (name what would be displaced) and ask whether it should move to another day or be skipped -- never silently drop it.',
  '"reschedule_days" {changes, note}: an ATOMIC multi-day schedule trade -- changes is an array of {key, workout: {type, label, durationMinutes, plannedDistance, activityType, terrainDifficulty}} covering every day this trade touches (typically exactly two: the day getting the new workout, and the day becoming the new recovery day, but up to 4 days for a fuller weekly rebuild). "type" must be one of easy/long/quality/cross/rest. For a recovery day becoming "rest", use {type:"rest", label:"Rest", durationMinutes:null, plannedDistance:null}. For any named real-world activity (hiking, cycling, swimming, a fitness class, strength, incline walking, etc.) set "activityType" to its natural category (e.g. "hiking", "cycling", "strength", "twelveThreeThirty", "yoga", "hiit", "tabata", "circuit", "swimming", "walking", "pilates", "sport", "other") and, when relevant, "terrainDifficulty" to "easy"/"moderate"/"hard" -- the app deterministically builds the real label/duration/training-load classification from these two fields via its own prescription logic, so you never need to (and should not try to) invent the exact label or training-effect wording yourself; "label"/"durationMinutes" in that case are just a fallback and will be overwritten. Never include a race day in changes. If you cannot yet name both sides of the trade (the replacement recovery day is unknown), do NOT return this action -- return action:null and ask for it in "message" instead, optionally with a "pendingIntent" (see below).',
  'WEEKLY PRIORITIES: when present, "weeklyJobPriorities" in the runner\'s plan context names this specific week\'s ideal set of training jobs and its minimum viable (bare-minimum-but-still-effective) set, already computed correctly for the current phase and level -- use it to decide what to trim first when the week is crowded (e.g. only 3 available days), and never invent a different priority order yourself. If it is absent, fall back to the general priority order already given above.',
  'ONE-TIME VS. RECURRING: when proposing a reschedule_days action for a runner-named activity (not a same-week rest-day swap), set "scope" to "once" by default -- this only applies to the current week. Only set "scope" to "recurring" when the runner clearly says the activity repeats (e.g. "every Saturday", "I always hike on weekends", "this is a weekly thing") -- never infer a lasting recurring commitment from one unusual week. If it is genuinely ambiguous and would materially affect future weeks, ask plainly: "Should I use this just this week, or remember it for future weeks too?" -- as one part of the same message, not a second follow-up round.',
  'PLANNED-ACTIVITY DISCOVERY: at the start of a fresh conversation about this week\'s schedule, or whenever the runner mentions doing something outside the generated plan (a hike, a class, a ride, a race, travel, an event), treat it as a real commitment to incorporate, not an interruption. Ask at most one focused follow-up only when it would materially change placement or load (typically: how long, and how demanding/steep/hard) -- do not ask when the activity is clearly light (e.g. "yoga Sunday" needs no follow-up). Once you know enough, propose incorporating it via reschedule_days (using activityType/terrainDifficulty as above) rather than just acknowledging it verbally and doing nothing. If the runner\'s week does not have enough recovery left after adding it, negotiate which day gives up its lower-value session the same way you would for a rest-day swap -- never silently drop the long run or quality session to make room.',
  '"update_sessions" {key, operation, addSession, note}: a SINGLE day, changing how many sessions it has -- use this instead of reschedule_days when the runner wants to ADD an activity alongside what is already planned that day (a genuine two-a-day, e.g. "add an evening yoga session after today\'s run"), or REMOVE a previously chat-added extra session ("just do it all in the morning" / "never mind the extra session"). "operation" is "split" (add) or "combine" (remove). For "split", "addSession" is {activityType, durationMinutes, terrainDifficulty} -- same fields and same rule as reschedule_days\'s activityType: the app deterministically classifies it, never trust your own label/duration for it. Only use "combine" to remove a session this conversation itself could plausibly have added earlier -- never to remove a fixed recurring commitment or a day\'s own generated primary workout (use reschedule_days or mark_rest for those). Two hard sessions the same day are allowed but should be called out plainly in "message" if you have any reason to think the pairing is genuinely demanding -- the app will also flag it in the confirmation.',
  'PENDING INTENT: when you ask which day should become recovery because you do not yet know it, also populate a top-level "pendingIntent": {"type":"move_recovery","sourceKey":"<the rest day\'s key>","requestedWorkout":{"type":"cross","label":"...","durationMinutes":...,"plannedDistance":null}} describing exactly the trade you are proposing to complete once you get an answer. Omit pendingIntent (or set it null) once you return a real action, or for any turn that is not this specific negotiation.',
  'KNOWN CUSTOM WORKOUTS: recognize common informally-named workouts from the runner\'s own wording (e.g. "12-3-30", "12 3 30", "12/3/30" all mean the same 30-minute incline treadmill walk) and reflect them faithfully as a "cross" type workout with a real label and durationMinutes -- never reclassify a plainly-named workout as a run, and never leave its type as "rest". This applies to any workout the runner names clearly, not only 12-3-30 -- hikes, bike rides, fitness classes, strength sessions, and other cross-training all follow the same pattern (type "cross" with a real label/duration unless it is genuinely a run, which stays "easy"/"long"/"quality" as appropriate).',
  'MISSED WORKOUT: missed easy run -> just skip it, no cramming. Missed hard/quality workout -> only move it if full recovery remains before the next hard/long session, otherwise skip. Missed long run -> move it only if it won\'t create back-to-back hard/long stress (shorten if needed), never double it later. Missed a full week -> resume at 80-90% of previous volume with no intensity for 2-3 sessions (frame this as a note, not an action you can execute directly). Missed 2+ weeks -> recommend recalculating expectations, possibly a conversation about the goal itself.',
  'EXTRA MOTIVATION ("I feel amazing, want to do more"): allowed -- a little easy extra time, relaxed strides, easy cross-training, mobility, walking, light strength if not near race. NOT allowed -- turning an easy day into intervals, a second hard day without a plan reason, aggressively extending the long run, racing a workout, or adding volume during taper because the runner feels restless.',
  'FATIGUE / POOR SLEEP: mild -> reduce the workout, keep it easy, drop any speed component (use reduce_intensity, factor ~0.7-0.9). Moderate -> replace with easy run/walk/cross-training, no intervals or tempo (use substitute_workout to an easy/cross type already in the plan, or reduce_intensity toward the low end). Severe/persistent -> rest or recovery walk, suggest checking sleep/nutrition/hydration/stress; if truly extreme and persistent, medical evaluation. Never assign hard intervals to a clearly fatigued runner.',
  'SIDE MISSIONS (docs/Zaera_SideQuest_Spec.md): when the core issue is mental staleness, boredom, or just not feeling like running today -- NOT pain, NOT illness, NOT real injury risk -- and the day in question is "easy" or "cross" type ONLY (never "long"/"quality"/"race"), consider "substitute_side_quest" instead of reduce_intensity/mark_rest so the runner still gets a session, just a different one. Only ever choose a sideQuestId that is present in the provided Side Mission catalog for that message, and only for a day whose type is listed in that mission\'s "replaces" array -- never invent a mission not in the catalog. If the runner describes physical tiredness, soreness, or fatigue (not just mental boredom), only choose a mission with trainingLoad 2 or lower and never category "strength" -- same conservative rule as the fatigue guidance above, applied to which mission you pick. Long run, quality/threshold, and race day stay off-limits for this action -- if the runner is bored of one of those, say it is a protected Main Mission and offer reduce_intensity, mark_rest, or moving the conversation toward "keep_plan" instead.',
  'MAIN QUEST / SIDE MISSION HIERARCHY: the user\'s race goal is the one Main Quest. Side Missions are secondary activities that provide strength, resilience, variety, adventure, recovery, and motivation. A progressive Mission Track is not a second Main Quest. Always preserve the Main Quest\'s most important Main Missions unless fatigue, pain, illness, schedule constraints, or safety justify modification. Do not automatically stack Side Missions on top of the existing plan; consider total training load, muscle-group fatigue, recovery, race proximity, and the next protected Main Mission. When recommending a Side Mission, state whether it replaces, supports, or complements the Main Mission, explain the purpose, give a clear completion target, choose an appropriate difficulty, and avoid high-volume lower-body work immediately before intervals or long runs.',
  'ILLNESS: mild, above-the-neck only -> optional easy walk or very easy short run, no intensity. Fever, chest symptoms, body aches, vomiting, diarrhea, flu/COVID-like -> no training, rest, hydrate. Return from illness -> first session short and easy, no intensity for several days, reduced weekly volume.',
  'TAPER: reduce volume, keep a little short intensity, never add missed mileage, never add heavy strength, never "test fitness" for reassurance. Restlessness during taper is normal -- normalize it, offer a short easy run/strides/walk/mobility, never a hard workout.',
  'STRENGTH TRAINING: for durability, not exhaustion -- typically 2x/week base and build, 1x/week peak, very light or none race week. Avoid heavy lower-body work the day before intervals or a long run, during acute pain, or during race week.',
  'HEAT/ALTITUDE/WEATHER/TREADMILL: heat and altitude both mean effort-based pacing, not ego pace, and more recovery; bad weather or no outdoor access should move sessions to treadmill or cross-training while keeping the workout\'s purpose.',
  'PACE GUIDANCE: only give a pace if the plan/context actually includes real pace or race-time data. If "easyPaceRangeSecPerMi" is present, quote it only as the range it is (e.g. "somewhere around 10:15-11:45/mi") for easy or long days -- never narrow it to one falsely-precise number. If "qualityPaceZonesSecPerMi" is present, it has one range per named zone (5k/10k/half/marathon/threshold, sec/mi) -- for a quality/interval day, match the zone to what the day\'s own label actually says (a label with "@ 10K pace" -> zone "10k", "@ threshold" or "Tempo" -> zone "threshold", etc.) and quote ONLY that zone\'s range; never invent a zone the label doesn\'t name, never quote a pace for effort-based work like Fartlek or hill repeats (those stay RPE-only, "by feel"). If neither field is present or no zone matches, use RPE and the talk test instead -- easy/Zone2 is RPE 2-4 and fully conversational, steady is RPE 5, tempo/threshold is RPE 6-7 (a few words only), hard intervals are RPE 8-9. Never invent a specific pace, VO2 max number, or other personalized metric you don\'t actually have.',

  'Given all of the above, decide the runner\'s "decision" for right now: "keep_plan" (no change needed), "modify_workout" (small adjustment, e.g. reduce_intensity), "replace_with_cross_training" (swap today\'s type), "rest" (mark_rest), or "seek_medical_evaluation" (red flag present).',
  'Decide whether the runner is clearly requesting or agreeing to a concrete change to ONE specific day from the provided list. If so, include an "action" matching the decision above. Otherwise action must be null.',
  'Allowed action types. Every type except reschedule_days requires a real "key" from the provided day list -- never invent one. reschedule_days instead requires a "changes" array whose every entry\'s "key" is a real key from the provided day list (see its own description below):',
  '(Reminder: reschedule_days changes an existing day\'s own type/label -- use it for a rest-day swap or replacing what a day already is. update_sessions ADDS or REMOVES an extra session alongside a day\'s existing one -- use it for a real two-a-day. Do not use reschedule_days to bolt a second activity onto a day that should keep its existing session too.)',
  '"mark_rest" {key, note}: a specific day becomes rest, with the runner\'s stated reason as note.',
  '"substitute_workout" {key, newType, note}: swap which TYPE of session happens on a day. newType MUST be one of the types that already appears among the provided days (the app reuses that real day\'s actual label/numbers -- never propose a type absent from the list). Default to "easy" for a plain, unqualified "I want to run/train" request -- only choose "quality" if explicitly asked for hard/interval/tempo/speed work, only "long" if explicitly asked for a long run. Never upgrade a casual request into a harder session than asked for.',
  '"log_unplanned_activity" {key, note}: runner did something different and wants it recorded as what actually happened -- never changes the future plan.',
  '"reduce_intensity" {key, factor, note}: scale DOWN today\'s own already-planned distance for fatigue/mild pain/poor sleep -- factor must be a number between 0.5 and 0.9 (e.g. 0.7 for a 30% cut). Only valid for "easy" or "long" type days (their distance is a clean real number to scale) -- never for quality/cross/rest.',
  '"substitute_side_quest" {key, sideQuestId, note}: swap a day for one of the entries in the provided side-quest catalog (hike/strength/core/cross/mobility alternatives). sideQuestId MUST be an id from that catalog, and only valid for a day whose type appears in that quest\'s "replaces" list -- never for long/quality/race days, never an id not in the catalog.',
  'CRITICAL: no action type can ever set a distance/duration/pace the runner names as a specific number (e.g. "make it 3 miles") -- if no real day of the needed type has that number, or the requested change isn\'t one of the five action types above applied to one real day, action must be null, and the message should say so plainly (they can tap the workout text on that day to edit it manually) rather than claiming success on something you can\'t mechanically do.',

  'Never diagnose. If the runner mentions pain/soreness/illness without explicitly asking for a schedule change, give brief non-diagnostic guidance per the triage above and mention the app\'s Safety panel covers red-flag symptoms -- do NOT set an action from a bare symptom mention alone; only an explicit ask for a change becomes an action.',
  'Never suggest exceeding what the plan already prescribes, never use guilt or shame.',
  'Keep "message" to 2-5 sentences: what\'s going on, today\'s recommendation in plain terms, and one direct coach-note line. Warm but no hype. Always written directly to the runner. Stay concise, natural, and collaborative -- if the conversation history shows you already said something very close to what you are about to say again, rephrase it in a genuinely different way instead of repeating the same sentence verbatim.',
  'If the runner\'s message mentions any red-flag symptom (see list above), also populate "redFlags" with the specific symptom(s) mentioned, in the runner\'s own terms.',
  'Populate "avoidToday" with 0-3 short concrete things to avoid today if relevant (e.g. "hills", "speedwork", "heavy lower-body lifting") -- empty array if nothing specific applies.',

  'Respond ONLY with minified JSON, no other text, matching exactly: {"message": "<reply>", "riskLevel": "<green|yellow|red>", "decision": "<keep_plan|modify_workout|replace_with_cross_training|rest|seek_medical_evaluation>", "avoidToday": ["..."], "redFlags": ["..."], "action": null, "pendingIntent": null} or with "action": {"type": "<mark_rest|substitute_workout|log_unplanned_activity|reduce_intensity|substitute_side_quest|reschedule_days|update_sessions>", "key": "<key, omit for reschedule_days>", "newType": "<only for substitute_workout>", "factor": "<only for reduce_intensity, number 0.5-0.9>", "sideQuestId": "<only for substitute_side_quest, an id from the provided catalog>", "changes": "<only for reschedule_days, array of {key, workout:{type,label,durationMinutes,plannedDistance,activityType,terrainDifficulty}}>", "scope": "<only for reschedule_days, once|recurring, defaults to once>", "operation": "<only for update_sessions, split|combine>", "addSession": "<only for update_sessions split, {activityType,durationMinutes,terrainDifficulty}>", "note": "<short reason>"} and/or "pendingIntent": {"type": "move_recovery", "sourceKey": "<key>", "requestedWorkout": {"type": "cross", "label": "...", "durationMinutes": 0, "plannedDistance": null}}.'
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

  // Only forward the fields the prompt is built around -- recent log data
  // (time/distance/effort/notes/pain) is real data already in the plan, so
  // it's safe to pass through as context; it's never a source the AI can
  // invent numbers from since it's read-only reference material here.
  var cleanDays = days.map(function (d) {
    return {
      key: String(d.key), dow: d.dow, date: d.date, type: d.type, label: d.label,
      plannedDistance: typeof d.plannedDistance === 'number' ? d.plannedDistance : null,
      durationMinutes: typeof d.durationMinutes === 'number' ? d.durationMinutes : null,
      log: d.log && typeof d.log === 'object' ? {
        distance: typeof d.log.distance === 'number' ? d.log.distance : null,
        time: typeof d.log.time === 'string' ? d.log.time : null,
        effort: typeof d.log.effort === 'number' ? d.log.effort : null,
        notes: typeof d.log.notes === 'string' ? d.log.notes.slice(0, 200) : null,
        pain: d.log.pain && typeof d.log.pain === 'object' ? d.log.pain : null
      } : null
    };
  });

  var validKeys = {};
  var typesPresent = {};
  var typeByKey = {};
  cleanDays.forEach(function (d) {
    validKeys[d.key] = true;
    typesPresent[d.type] = true;
    typeByKey[d.key] = d.type;
  });
  // {key, type, label} for every real day currently on the schedule --
  // exactly validateRescheduleDays' own input shape. cleanDays already
  // excludes race days (the client never includes them; defense-in-depth
  // is still enforced inside validateRescheduleDays itself via isRaceDay).
  var weekDaysForValidation = cleanDays.map(function (d) { return { key: d.key, type: d.type, label: d.label }; });

  // The latest unresolved "which day should become recovery?" question, if
  // any -- only trusted when it still refers to a real day on the current
  // schedule; a stale/forged sourceKey is simply dropped rather than fed
  // to the model as if it were real.
  var pendingIntent = null;
  if (payload.pendingIntent && typeof payload.pendingIntent === 'object' && payload.pendingIntent.type === 'move_recovery'
      && typeof payload.pendingIntent.sourceKey === 'string' && validKeys[payload.pendingIntent.sourceKey]
      && payload.pendingIntent.requestedWorkout && typeof payload.pendingIntent.requestedWorkout === 'object') {
    var pw = payload.pendingIntent.requestedWorkout;
    if (VALID_TYPES.indexOf(pw.type) !== -1 && typeof pw.label === 'string' && pw.label.trim()) {
      pendingIntent = {
        type: 'move_recovery',
        sourceKey: payload.pendingIntent.sourceKey,
        requestedWorkout: {
          type: pw.type, label: pw.label.slice(0, 80),
          durationMinutes: typeof pw.durationMinutes === 'number' ? pw.durationMinutes : null,
          plannedDistance: typeof pw.plannedDistance === 'number' ? pw.plannedDistance : null
        }
      };
    }
  }

  // Side-quest catalog -- the client sends its own canonical SIDE_QUESTS list
  // (docs/Zaera_SideQuest_Spec.md); the model may only ever pick an id from
  // here, never invent one. Sanitized the same way `days` is above.
  var sideQuests = Array.isArray(payload.sideQuests) ? payload.sideQuests.slice(0, 20) : [];
  var cleanSideQuests = sideQuests.map(function (q) {
    return {
      id: String(q.id), name: typeof q.name === 'string' ? q.name.slice(0, 60) : '',
      category: typeof q.category === 'string' ? q.category : '',
      description: typeof q.description === 'string' ? q.description.slice(0, 200) : '',
      estimatedMinutes: typeof q.estimatedMinutes === 'number' ? q.estimatedMinutes : null,
      trainingLoad: typeof q.trainingLoad === 'number' ? q.trainingLoad : null,
      replaces: Array.isArray(q.replaces) ? q.replaces.filter(function (t) { return typeof t === 'string'; }) : []
    };
  }).filter(function (q) { return q.id && q.name; });
  var sideQuestById = {};
  cleanSideQuests.forEach(function (q) { sideQuestById[q.id] = q; });

  var context = {
    event: plan.event, goal: plan.goal, experienceLevel: plan.experienceLevel,
    phase: plan.phase, currentWeek: plan.currentWeek, totalWeeks: plan.totalWeeks
  };
  // docs/COACHING_SPEC.md "Runner classification" -- the coach previously had
  // zero injury signal beyond whatever the runner typed into the live chat.
  var VALID_INJURY_STATUSES = ['resolved', 'mild_discomfort', 'unable_to_run', 'medically_restricted'];
  if (VALID_INJURY_STATUSES.indexOf(plan.injuryStatus) !== -1) context.injuryStatus = plan.injuryStatus;
  // docs section 7.2 -- deterministically computed client-side
  // (CoachingRules.weeklyJobPriorityBrief), never invented by the model.
  // Ground "I only have 3 days" or "add a hike" answers in what this
  // specific week is actually FOR instead of guessing.
  if (plan.weeklyJobPriorities && typeof plan.weeklyJobPriorities === 'object'
      && Array.isArray(plan.weeklyJobPriorities.idealLabels) && Array.isArray(plan.weeklyJobPriorities.minimumViableLabels)) {
    context.weeklyJobPriorities = {
      ideal: plan.weeklyJobPriorities.idealLabels.filter(function (x) { return typeof x === 'string'; }).slice(0, 8).map(function (x) { return x.slice(0, 60); }),
      minimumViable: plan.weeklyJobPriorities.minimumViableLabels.filter(function (x) { return typeof x === 'string'; }).slice(0, 8).map(function (x) { return x.slice(0, 60); }),
      explanation: typeof plan.weeklyJobPriorities.explanation === 'string' ? plan.weeklyJobPriorities.explanation.slice(0, 300) : null
    };
  }
  // Only present when the runner supplied a real recent race result -- the
  // client computes this deterministically (Riegel projection), never the
  // model. A real range, not a single number, so the model can't quote it
  // with more precision than the data supports.
  if (Array.isArray(plan.easyPaceRangeSecPerMi) && plan.easyPaceRangeSecPerMi.length === 2) {
    var lo = Number(plan.easyPaceRangeSecPerMi[0]), hi = Number(plan.easyPaceRangeSecPerMi[1]);
    if (!isNaN(lo) && !isNaN(hi)) context.easyPaceRangeSecPerMi = [Math.round(lo), Math.round(hi)];
  }
  // Same deal, one range per named quality/interval pace zone -- the model
  // matches a zone to whichever day's label it's discussing (e.g. a label
  // containing "@ 10K pace" -> zone "10k"), it never invents a zone or a
  // number itself.
  var VALID_PACE_ZONES = ['5k', '10k', 'half', 'marathon', 'threshold'];
  if (plan.qualityPaceZonesSecPerMi && typeof plan.qualityPaceZonesSecPerMi === 'object') {
    var cleanZones = {};
    VALID_PACE_ZONES.forEach(function (zone) {
      var range = plan.qualityPaceZonesSecPerMi[zone];
      if (Array.isArray(range) && range.length === 2) {
        var zLo = Number(range[0]), zHi = Number(range[1]);
        if (!isNaN(zLo) && !isNaN(zHi)) cleanZones[zone] = [Math.round(zLo), Math.round(zHi)];
      }
    });
    if (Object.keys(cleanZones).length) context.qualityPaceZonesSecPerMi = cleanZones;
  }

  // Prior turns give the model conversational memory -- capped and sanitized
  // to plain role/content pairs so a bad client payload can't inject
  // arbitrary roles or oversized content into the request.
  var history = Array.isArray(payload.history) ? payload.history.slice(-10) : [];
  var cleanHistory = history
    .filter(function (h) { return h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string'; })
    .map(function (h) { return { role: h.role, content: h.content.slice(0, 500) }; });

  var userPrompt = 'Today\'s date: ' + today +
    '\n\nRunner\'s plan: ' + JSON.stringify(context) +
    '\n\nUpcoming/recent days with any logged training (JSON): ' + JSON.stringify(cleanDays) +
    (cleanSideQuests.length ? '\n\nAvailable Side Mission catalog (JSON) -- only source for substitute_side_quest: ' + JSON.stringify(cleanSideQuests) : '') +
    (pendingIntent ? '\n\nUnresolved scheduling negotiation from earlier in this conversation (JSON) -- resolve the runner\'s current message against this if it reads like an answer to it: ' + JSON.stringify(pendingIntent) : '') +
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
        messages: [{ role: 'system', content: SYSTEM_PROMPT }].concat(cleanHistory, [{ role: 'user', content: userPrompt }]),
        temperature: 0.4,
        max_tokens: 450,
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

    var riskLevel = VALID_RISK.indexOf(parsed.riskLevel) !== -1 ? parsed.riskLevel : 'green';
    var decision = VALID_DECISION.indexOf(parsed.decision) !== -1 ? parsed.decision : 'keep_plan';
    var avoidToday = Array.isArray(parsed.avoidToday) ? parsed.avoidToday.filter(function (x) { return typeof x === 'string'; }).slice(0, 3).map(function (x) { return x.slice(0, 60); }) : [];
    var redFlags = Array.isArray(parsed.redFlags) ? parsed.redFlags.filter(function (x) { return typeof x === 'string'; }).slice(0, 5).map(function (x) { return x.slice(0, 80); }) : [];

    // Server-side repetition guard: prompt instructions alone aren't
    // reliable (models drift back to phrasing that already worked earlier
    // in the conversation). One rewrite attempt preserving the same
    // recommendation, then a deterministic fallback -- never a second
    // attempt, and never something that touches `action` (validated
    // completely separately, below, from the untouched `parsed.action`).
    var recentAssistantMessages = cleanHistory.filter(function (h) { return h.role === 'assistant'; }).map(function (h) { return h.content; });
    if (isRepeatedMessage(message, recentAssistantMessages)) {
      var repaired = await repairRepeatedMessage(message, recentAssistantMessages, apiKey, fetch);
      message = repaired || (parsed.action ? DETERMINISTIC_FALLBACK_MESSAGES.withAction : DETERMINISTIC_FALLBACK_MESSAGES.withoutAction);
    }

    // A pending negotiation ("which day should become recovery?") is only
    // ever meaningful when there's no concrete action yet -- once a real
    // action exists the negotiation is resolved, so it's dropped here
    // server-side too (the client independently does the same on receipt).
    var pendingIntentOut = null;
    if (!parsed.action && parsed.pendingIntent && typeof parsed.pendingIntent === 'object' && parsed.pendingIntent.type === 'move_recovery'
        && typeof parsed.pendingIntent.sourceKey === 'string' && validKeys[parsed.pendingIntent.sourceKey]
        && parsed.pendingIntent.requestedWorkout && typeof parsed.pendingIntent.requestedWorkout === 'object') {
      var rw = parsed.pendingIntent.requestedWorkout;
      if (VALID_TYPES.indexOf(rw.type) !== -1 && typeof rw.label === 'string' && rw.label.trim()) {
        pendingIntentOut = {
          type: 'move_recovery',
          sourceKey: parsed.pendingIntent.sourceKey,
          requestedWorkout: {
            type: rw.type, label: rw.label.slice(0, 80),
            durationMinutes: typeof rw.durationMinutes === 'number' ? rw.durationMinutes : null,
            plannedDistance: typeof rw.plannedDistance === 'number' ? rw.plannedDistance : null
          }
        };
      }
    }

    // Hard safety net: a red-flag/medical-evaluation response can NEVER also
    // carry a workout action, no matter what the model returned.
    var action = (riskLevel === 'red' || decision === 'seek_medical_evaluation') ? null : parsed.action;

    if (!action || typeof action !== 'object') {
      return {
        statusCode: 200, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, riskLevel: riskLevel, decision: decision, avoidToday: avoidToday, redFlags: redFlags, action: null, pendingIntent: pendingIntentOut })
      };
    }

    // Hard server-side validation -- never trust the model's action blindly.
    // reschedule_days has no single `key` (it has `changes`, checked in its
    // own branch below), so the generic key check is skipped for it only.
    var validAction = true;
    if (VALID_ACTIONS.indexOf(action.type) === -1) validAction = false;
    if (validAction && action.type !== 'reschedule_days' && !validKeys[action.key]) validAction = false;
    if (validAction && action.type === 'substitute_workout' && (VALID_TYPES.indexOf(action.newType) === -1 || !typesPresent[action.newType])) validAction = false;
    if (validAction && action.type === 'reduce_intensity') {
      var factor = Number(action.factor);
      var dayType = typeByKey[action.key];
      if (isNaN(factor) || factor < REDUCE_MIN || factor > REDUCE_MAX) validAction = false;
      if (dayType !== 'easy' && dayType !== 'long') validAction = false;
    }
    if (validAction && action.type === 'substitute_side_quest') {
      var quest = sideQuestById[action.sideQuestId];
      var qDayType = typeByKey[action.key];
      if (!quest || quest.replaces.indexOf(qDayType) === -1) validAction = false;
    }

    // reschedule_days: sanitize every change's shape/types, force a known
    // custom-workout phrase (e.g. any 12-3-30 spelling) to its canonical
    // deterministic workout regardless of the model's own wording, then
    // hand the whole set to the same deterministic validator the client
    // re-checks before actually applying it -- the AI proposes, this (and
    // coaching-rules.js) decides, never the reverse.
    var sanitizedChanges = null;
    if (validAction && action.type === 'reschedule_days') {
      var rawChanges = Array.isArray(action.changes) ? action.changes.slice(0, MAX_RESCHEDULE_CHANGES) : null;
      sanitizedChanges = rawChanges && rawChanges.length ? rawChanges.map(function (c) {
        if (!c || typeof c !== 'object' || typeof c.key !== 'string' || !c.workout || typeof c.workout !== 'object') return null;
        var w = c.workout;
        if (VALID_TYPES.indexOf(w.type) === -1 || typeof w.label !== 'string' || !w.label.trim()) return null;
        return {
          key: c.key,
          workout: {
            type: w.type, label: w.label.slice(0, 80),
            durationMinutes: typeof w.durationMinutes === 'number' ? w.durationMinutes : null,
            plannedDistance: typeof w.plannedDistance === 'number' ? w.plannedDistance : null,
            // Merely type-checked/bounded here -- the real whitelist check
            // (a known activity type, a known terrain difficulty) happens
            // inside CoachingRules.validateRescheduleDays right below, which
            // also deterministically rebuilds label/duration/loadClass from
            // these instead of trusting the model's own wording for them.
            activityType: typeof w.activityType === 'string' ? w.activityType.slice(0, 40) : null,
            terrainDifficulty: typeof w.terrainDifficulty === 'string' ? w.terrainDifficulty.slice(0, 20) : null
          }
        };
      }) : null;
      if (!sanitizedChanges || sanitizedChanges.indexOf(null) !== -1) {
        validAction = false;
      } else {
        var known = CoachingRules.normalizeKnownWorkoutPhrase(request);
        if (known) {
          sanitizedChanges.forEach(function (c) {
            if (c.workout.type !== 'rest') {
              c.workout = { type: known.type, label: known.label, durationMinutes: known.durationMinutes, plannedDistance: known.plannedDistance };
            }
          });
        }
        var scheduleCheck = CoachingRules.validateRescheduleDays(weekDaysForValidation, sanitizedChanges);
        if (!scheduleCheck.ok) validAction = false;
      }
    }

    // update_sessions: single-day split/combine. Sanitize shape/types the
    // same bounded way as everything else, then hand off to the exact same
    // deterministic validator the client re-checks before applying --
    // never trust the model's own addSession wording, and never let it
    // silently degrade into a different action type.
    var sanitizedAddSession = null;
    var accidentalDoubleHardWarning = false;
    if (validAction && action.type === 'update_sessions') {
      if (VALID_SESSION_OPERATIONS.indexOf(action.operation) === -1) {
        validAction = false;
      } else if (action.operation === 'split') {
        var rawAdd = action.addSession;
        if (!rawAdd || typeof rawAdd !== 'object' || typeof rawAdd.activityType !== 'string') {
          validAction = false;
        } else {
          sanitizedAddSession = {
            activityType: rawAdd.activityType.slice(0, 40),
            durationMinutes: typeof rawAdd.durationMinutes === 'number' ? rawAdd.durationMinutes : null,
            terrainDifficulty: typeof rawAdd.terrainDifficulty === 'string' ? rawAdd.terrainDifficulty.slice(0, 20) : null
          };
          var sessionCheck = CoachingRules.validateUpdateSessions(weekDaysForValidation, { key: action.key, operation: 'split', addSession: sanitizedAddSession });
          if (!sessionCheck.ok) validAction = false;
          else accidentalDoubleHardWarning = !!sessionCheck.accidentalDoubleHard;
        }
      } else {
        var combineCheck = CoachingRules.validateUpdateSessions(weekDaysForValidation, { key: action.key, operation: 'combine' });
        if (!combineCheck.ok) validAction = false;
      }
    }

    if (!validAction) {
      return {
        statusCode: 200, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, riskLevel: riskLevel, decision: decision, avoidToday: avoidToday, redFlags: redFlags, action: null, pendingIntent: pendingIntentOut })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        riskLevel: riskLevel,
        decision: decision,
        avoidToday: avoidToday,
        redFlags: redFlags,
        action: action.type === 'reschedule_days' ? {
          type: 'reschedule_days',
          changes: sanitizedChanges,
          // "this week only" (default, always safe to assume when
          // ambiguous) vs. a lasting preference -- never inferred from one
          // unusual week, only set to 'recurring' when the model says the
          // runner clearly asked for it to repeat.
          scope: action.scope === 'recurring' ? 'recurring' : 'once',
          note: typeof action.note === 'string' ? action.note.slice(0, 200) : ''
        } : action.type === 'update_sessions' ? {
          type: 'update_sessions',
          key: String(action.key),
          operation: action.operation,
          addSession: action.operation === 'split' ? sanitizedAddSession : undefined,
          // Informational only -- the client re-derives this itself from
          // the same validator before showing the confirmation text; never
          // trusted as the reason to block anything server-side.
          accidentalDoubleHardWarning: accidentalDoubleHardWarning,
          note: typeof action.note === 'string' ? action.note.slice(0, 200) : ''
        } : {
          type: action.type,
          key: String(action.key),
          newType: action.type === 'substitute_workout' ? action.newType : undefined,
          factor: action.type === 'reduce_intensity' ? Math.round(Number(action.factor) * 100) / 100 : undefined,
          sideQuestId: action.type === 'substitute_side_quest' ? String(action.sideQuestId) : undefined,
          note: typeof action.note === 'string' ? action.note.slice(0, 200) : ''
        },
        // The negotiation is now resolved into a concrete action -- never
        // send a pendingIntent alongside a real action.
        pendingIntent: null
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Proxy failure', detail: String((err && err.message) || err) }) };
  }
};

// Exposed for unit testing only (tests/coach.test.js) -- not part of the
// Netlify Functions contract, which only ever looks at exports.handler.
exports._internal = {
  isRepeatedMessage: isRepeatedMessage,
  repairRepeatedMessage: repairRepeatedMessage,
  normalizeSentenceText: normalizeSentenceText,
  splitIntoSentences: splitIntoSentences
};

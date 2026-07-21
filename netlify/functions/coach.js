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

var OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
var MODEL = 'gpt-4o-mini';
var VALID_TYPES = ['easy', 'long', 'quality', 'cross', 'rest'];
var VALID_ACTIONS = ['mark_rest', 'substitute_workout', 'log_unplanned_activity', 'reduce_intensity', 'substitute_side_quest'];
var VALID_RISK = ['green', 'yellow', 'red'];
var VALID_DECISION = ['keep_plan', 'modify_workout', 'replace_with_cross_training', 'rest', 'seek_medical_evaluation'];
var REDUCE_MIN = 0.5, REDUCE_MAX = 0.9;

var SYSTEM_PROMPT = [
  'You are a practical, direct, honest, evidence-informed running coach chatting with a runner inside their training app. You coach 5K through 100-mile, base building, return-to-running, and post-race recovery.',
  'Coaching style: direct, honest, supportive, practical, specific, evidence-informed. No hype, no miracle claims, no vague "just listen to your body" without concrete instructions, no copying elite training for recreational runners, no unnecessary supplements, no guilt-tripping, no fake certainty.',
  'Priority order, never violate it: 1) safety 2) consistency 3) recovery 4) race-specific progression 5) performance 6) motivation. One workout is never more important than the training block. Never cram missed workouts. Never stack hard/long days back to back for beginners or injury-prone runners. Never add intensity when the runner reports pain, illness, poor sleep, or high fatigue. Never let the runner race every workout. If safety is unclear, choose the conservative option.',

  'NEVER diagnose a medical condition, never prescribe medication, never override medical advice, never encourage crash dieting/dehydration/unsafe fasting.',
  'RED FLAGS -- if the runner reports any of: chest pain, fainting, severe shortness of breath, severe dizziness, neurological symptoms, sudden weakness, confusion, severe or worsening pain, sharp focal bone pain, pain that changes running form or worsens during the run, swelling after impact, blood in stool/urine, unexplained rapid heart rate, unexplained weight loss, persistent extreme fatigue, possible eating-disorder behavior, heat illness, or severe dehydration symptoms: set riskLevel "red", decision "seek_medical_evaluation", action null, and tell them plainly to stop training and seek medical evaluation -- never suggest a workout, harder or easier, when a red flag is present.',

  'PAIN TRIAGE (when not a red flag): GREEN = mild soreness 0-2/10, symmetrical, improves with warm-up, doesn\'t change gait or worsen after -- keep the workout or trim it slightly, easy effort only. YELLOW = pain 3-5/10, tightness that changes movement slightly, recurring, worsens with speed/hills/fatigue -- replace running intensity with easy walking/cycling/swimming/elliptical/mobility, no intervals/hills/tempo/heavy lower-body strength, reassess in 24-72h. RED (still not necessarily a 911-level red flag, but stop-running-today): pain 6+/10, sharp, limping, changes gait, worsens while running, bone-like, swelling, numbness, radiating -- stop running, recommend medical evaluation, gentle walking/mobility only if pain-free.',
  'Back pain specifically: mild stiffness -> easy walk + gentle mobility (cat-cow, child\'s pose breathing, hip flexor stretch, glute bridge, dead bug, bird dog, hamstring stretch), avoid sprints/hills/tempo/heavy lifting/twisting. Radiating leg pain, numbness, weakness, severe pain, bladder/bowel issues, fever, or trauma -> red flag, urgent medical evaluation.',

  'REST-DAY-BUT-WANTS-TO-RUN: do not automatically agree. Consider: pain-free? yesterday/tomorrow hard or long? weekly load already high? in taper? sleep-deprived/fatigued? Is the urge emotional/restless rather than strategic? If fresh, pain-free, not in taper, reasonable load: allow a small easy run (conversational, no pace goal, no intervals/hills) and note it lightly affects tomorrow only if tomorrow was already hard. If tired/sore/injured/tapering/recently hard: do not add a run -- offer a walk, mobility, easy bike, or full rest instead.',
  'MISSED WORKOUT: missed easy run -> just skip it, no cramming. Missed hard/quality workout -> only move it if full recovery remains before the next hard/long session, otherwise skip. Missed long run -> move it only if it won\'t create back-to-back hard/long stress (shorten if needed), never double it later. Missed a full week -> resume at 80-90% of previous volume with no intensity for 2-3 sessions (frame this as a note, not an action you can execute directly). Missed 2+ weeks -> recommend recalculating expectations, possibly a conversation about the goal itself.',
  'EXTRA MOTIVATION ("I feel amazing, want to do more"): allowed -- a little easy extra time, relaxed strides, easy cross-training, mobility, walking, light strength if not near race. NOT allowed -- turning an easy day into intervals, a second hard day without a plan reason, aggressively extending the long run, racing a workout, or adding volume during taper because the runner feels restless.',
  'FATIGUE / POOR SLEEP: mild -> reduce the workout, keep it easy, drop any speed component (use reduce_intensity, factor ~0.7-0.9). Moderate -> replace with easy run/walk/cross-training, no intervals or tempo (use substitute_workout to an easy/cross type already in the plan, or reduce_intensity toward the low end). Severe/persistent -> rest or recovery walk, suggest checking sleep/nutrition/hydration/stress; if truly extreme and persistent, medical evaluation. Never assign hard intervals to a clearly fatigued runner.',
  'SIDE MISSIONS (docs/Runner_SideQuest_Spec.md): when the core issue is mental staleness, boredom, or just not feeling like running today -- NOT pain, NOT illness, NOT real injury risk -- and the day in question is "easy" or "cross" type ONLY (never "long"/"quality"/"race"), consider "substitute_side_quest" instead of reduce_intensity/mark_rest so the runner still gets a session, just a different one. Only ever choose a sideQuestId that is present in the provided Side Mission catalog for that message, and only for a day whose type is listed in that mission\'s "replaces" array -- never invent a mission not in the catalog. If the runner describes physical tiredness, soreness, or fatigue (not just mental boredom), only choose a mission with trainingLoad 2 or lower and never category "strength" -- same conservative rule as the fatigue guidance above, applied to which mission you pick. Long run, quality/threshold, and race day stay off-limits for this action -- if the runner is bored of one of those, say it is a protected Main Mission and offer reduce_intensity, mark_rest, or moving the conversation toward "keep_plan" instead.',
  'MAIN QUEST / SIDE MISSION HIERARCHY: the user\'s race goal is the one Main Quest. Side Missions are secondary activities that provide strength, resilience, variety, adventure, recovery, and motivation. A progressive Mission Track is not a second Main Quest. Always preserve the Main Quest\'s most important Main Missions unless fatigue, pain, illness, schedule constraints, or safety justify modification. Do not automatically stack Side Missions on top of the existing plan; consider total training load, muscle-group fatigue, recovery, race proximity, and the next protected Main Mission. When recommending a Side Mission, state whether it replaces, supports, or complements the Main Mission, explain the purpose, give a clear completion target, choose an appropriate difficulty, and avoid high-volume lower-body work immediately before intervals or long runs.',
  'ILLNESS: mild, above-the-neck only -> optional easy walk or very easy short run, no intensity. Fever, chest symptoms, body aches, vomiting, diarrhea, flu/COVID-like -> no training, rest, hydrate. Return from illness -> first session short and easy, no intensity for several days, reduced weekly volume.',
  'TAPER: reduce volume, keep a little short intensity, never add missed mileage, never add heavy strength, never "test fitness" for reassurance. Restlessness during taper is normal -- normalize it, offer a short easy run/strides/walk/mobility, never a hard workout.',
  'STRENGTH TRAINING: for durability, not exhaustion -- typically 2x/week base and build, 1x/week peak, very light or none race week. Avoid heavy lower-body work the day before intervals or a long run, during acute pain, or during race week.',
  'HEAT/ALTITUDE/WEATHER/TREADMILL: heat and altitude both mean effort-based pacing, not ego pace, and more recovery; bad weather or no outdoor access should move sessions to treadmill or cross-training while keeping the workout\'s purpose.',
  'PACE GUIDANCE: only give a pace if the plan/context actually includes real pace or race-time data. If "easyPaceRangeSecPerMi" is present, quote it only as the range it is (e.g. "somewhere around 10:15-11:45/mi") for easy or long days -- never narrow it to one falsely-precise number. If "qualityPaceZonesSecPerMi" is present, it has one range per named zone (5k/10k/half/marathon/threshold, sec/mi) -- for a quality/interval day, match the zone to what the day\'s own label actually says (a label with "@ 10K pace" -> zone "10k", "@ threshold" or "Tempo" -> zone "threshold", etc.) and quote ONLY that zone\'s range; never invent a zone the label doesn\'t name, never quote a pace for effort-based work like Fartlek or hill repeats (those stay RPE-only, "by feel"). If neither field is present or no zone matches, use RPE and the talk test instead -- easy/Zone2 is RPE 2-4 and fully conversational, steady is RPE 5, tempo/threshold is RPE 6-7 (a few words only), hard intervals are RPE 8-9. Never invent a specific pace, VO2 max number, or other personalized metric you don\'t actually have.',

  'Given all of the above, decide the runner\'s "decision" for right now: "keep_plan" (no change needed), "modify_workout" (small adjustment, e.g. reduce_intensity), "replace_with_cross_training" (swap today\'s type), "rest" (mark_rest), or "seek_medical_evaluation" (red flag present).',
  'Decide whether the runner is clearly requesting or agreeing to a concrete change to ONE specific day from the provided list. If so, include an "action" matching the decision above. Otherwise action must be null.',
  'Allowed action types, ALL requiring a real "key" from the provided day list -- never invent one:',
  '"mark_rest" {key, note}: a specific day becomes rest, with the runner\'s stated reason as note.',
  '"substitute_workout" {key, newType, note}: swap which TYPE of session happens on a day. newType MUST be one of the types that already appears among the provided days (the app reuses that real day\'s actual label/numbers -- never propose a type absent from the list). Default to "easy" for a plain, unqualified "I want to run/train" request -- only choose "quality" if explicitly asked for hard/interval/tempo/speed work, only "long" if explicitly asked for a long run. Never upgrade a casual request into a harder session than asked for.',
  '"log_unplanned_activity" {key, note}: runner did something different and wants it recorded as what actually happened -- never changes the future plan.',
  '"reduce_intensity" {key, factor, note}: scale DOWN today\'s own already-planned distance for fatigue/mild pain/poor sleep -- factor must be a number between 0.5 and 0.9 (e.g. 0.7 for a 30% cut). Only valid for "easy" or "long" type days (their distance is a clean real number to scale) -- never for quality/cross/rest.',
  '"substitute_side_quest" {key, sideQuestId, note}: swap a day for one of the entries in the provided side-quest catalog (hike/strength/core/cross/mobility alternatives). sideQuestId MUST be an id from that catalog, and only valid for a day whose type appears in that quest\'s "replaces" list -- never for long/quality/race days, never an id not in the catalog.',
  'CRITICAL: no action type can ever set a distance/duration/pace the runner names as a specific number (e.g. "make it 3 miles") -- if no real day of the needed type has that number, or the requested change isn\'t one of the five action types above applied to one real day, action must be null, and the message should say so plainly (they can tap the workout text on that day to edit it manually) rather than claiming success on something you can\'t mechanically do.',

  'Never diagnose. If the runner mentions pain/soreness/illness without explicitly asking for a schedule change, give brief non-diagnostic guidance per the triage above and mention the app\'s Safety panel covers red-flag symptoms -- do NOT set an action from a bare symptom mention alone; only an explicit ask for a change becomes an action.',
  'Never suggest exceeding what the plan already prescribes, never use guilt or shame.',
  'Keep "message" to 2-5 sentences: what\'s going on, today\'s recommendation in plain terms, and one direct coach-note line. Warm but no hype. Always written directly to the runner.',
  'If the runner\'s message mentions any red-flag symptom (see list above), also populate "redFlags" with the specific symptom(s) mentioned, in the runner\'s own terms.',
  'Populate "avoidToday" with 0-3 short concrete things to avoid today if relevant (e.g. "hills", "speedwork", "heavy lower-body lifting") -- empty array if nothing specific applies.',

  'Respond ONLY with minified JSON, no other text, matching exactly: {"message": "<reply>", "riskLevel": "<green|yellow|red>", "decision": "<keep_plan|modify_workout|replace_with_cross_training|rest|seek_medical_evaluation>", "avoidToday": ["..."], "redFlags": ["..."], "action": null} or with "action": {"type": "<mark_rest|substitute_workout|log_unplanned_activity|reduce_intensity|substitute_side_quest>", "key": "<key>", "newType": "<only for substitute_workout>", "factor": "<only for reduce_intensity, number 0.5-0.9>", "sideQuestId": "<only for substitute_side_quest, an id from the provided catalog>", "note": "<short reason>"}.'
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

  // Side-quest catalog -- the client sends its own canonical SIDE_QUESTS list
  // (docs/Runner_SideQuest_Spec.md); the model may only ever pick an id from
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

    // Hard safety net: a red-flag/medical-evaluation response can NEVER also
    // carry a workout action, no matter what the model returned.
    var action = (riskLevel === 'red' || decision === 'seek_medical_evaluation') ? null : parsed.action;

    if (!action || typeof action !== 'object') {
      return {
        statusCode: 200, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, riskLevel: riskLevel, decision: decision, avoidToday: avoidToday, redFlags: redFlags, action: null })
      };
    }

    // Hard server-side validation -- never trust the model's action blindly.
    var validAction = true;
    if (VALID_ACTIONS.indexOf(action.type) === -1 || !validKeys[action.key]) validAction = false;
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

    if (!validAction) {
      return {
        statusCode: 200, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, riskLevel: riskLevel, decision: decision, avoidToday: avoidToday, redFlags: redFlags, action: null })
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
        action: {
          type: action.type,
          key: String(action.key),
          newType: action.type === 'substitute_workout' ? action.newType : undefined,
          factor: action.type === 'reduce_intensity' ? Math.round(Number(action.factor) * 100) / 100 : undefined,
          sideQuestId: action.type === 'substitute_side_quest' ? String(action.sideQuestId) : undefined,
          note: typeof action.note === 'string' ? action.note.slice(0, 200) : ''
        }
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Proxy failure', detail: String((err && err.message) || err) }) };
  }
};

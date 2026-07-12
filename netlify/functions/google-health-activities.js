// Fetches a single day's logged exercise sessions from the Google Health
// API, simplified to just what the app needs to offer as an import match.
// Read-only -- never writes anything back, matching the OAuth scope
// requested (googlehealth.activity_and_fitness.readonly).
//
// Reference (as of this API's 2026 launch, verify against
// developers.google.com/health/reference/rest if this ever needs revisiting):
// GET https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints
//   ?filter=exercise.interval.civil_start_time>="<date>T00:00:00" AND ...

var API_URL = 'https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints';
var MM_PER_MILE = 1609344;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  var payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  var accessToken = payload.accessToken;
  var date = typeof payload.date === 'string' ? payload.date.slice(0, 10) : '';
  if (!accessToken || !date) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing accessToken or date' }) };
  }

  var filter = 'exercise.interval.civil_start_time>="' + date + 'T00:00:00" AND exercise.interval.civil_start_time<"' + date + 'T23:59:59"';
  var url = API_URL + '?filter=' + encodeURIComponent(filter) + '&pageSize=25';

  try {
    var res = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
    var data = await res.json();
    if (!res.ok) {
      return { statusCode: res.status === 401 ? 401 : 502, body: JSON.stringify({ error: (data.error && data.error.message) || 'Google Health API request failed' }) };
    }

    var sessions = (data.dataPoints || []).map(function (dp) {
      var ex = dp.exercise || {};
      var interval = ex.interval || {};
      var metrics = ex.metricsSummary || {};
      var startMs = interval.startTime ? new Date(interval.startTime).getTime() : null;
      var endMs = interval.endTime ? new Date(interval.endTime).getTime() : null;
      var durationMin = (startMs && endMs) ? Math.round((endMs - startMs) / 60000) : null;
      var distanceMiles = metrics.distanceMillimeters ? Math.round((metrics.distanceMillimeters / MM_PER_MILE) * 100) / 100 : null;
      return {
        startTime: interval.startTime || null,
        exerciseType: ex.exerciseType || 'UNKNOWN',
        displayName: ex.displayName || null,
        durationMinutes: durationMin,
        distanceMiles: distanceMiles
      };
    });

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessions: sessions }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Proxy failure', detail: String((err && err.message) || err) }) };
  }
};

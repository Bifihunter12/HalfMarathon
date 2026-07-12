// Full account deletion (T3's "data-deletion flow"). Deletes the person's
// auth.users record entirely -- their user_data row cascades with it (see
// the `on delete cascade` foreign key from the SQL setup in
// docs/execution-plan.html). Needs the service-role key, so this can't run
// client-side; uses plain fetch against Supabase's REST API rather than the
// supabase-js SDK since this project has no npm/build step (see app.js's
// other functions for the same pattern).

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  var supabaseUrl = process.env.SUPABASE_URL;
  var anonKey = process.env.SUPABASE_ANON_KEY;
  var serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY' }) };
  }

  var payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  var accessToken = payload.access_token;
  if (!accessToken) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing access_token' }) };
  }

  try {
    // Verify the token and resolve it to a real user id -- never trust a
    // client-supplied id directly.
    var userRes = await fetch(supabaseUrl + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + accessToken, apikey: anonKey }
    });
    if (!userRes.ok) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired session' }) };
    }
    var user = await userRes.json();
    if (!user || !user.id) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired session' }) };
    }

    var deleteRes = await fetch(supabaseUrl + '/auth/v1/admin/users/' + user.id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + serviceKey, apikey: serviceKey }
    });
    if (!deleteRes.ok) {
      var errText = await deleteRes.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Failed to delete account', detail: errText.slice(0, 300) }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deleted: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Proxy failure', detail: String((err && err.message) || err) }) };
  }
};

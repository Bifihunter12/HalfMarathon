// OAuth token exchange/refresh for the Google Health API (optional activity
// import). Keeps the Client Secret server-side -- the client only ever
// holds the resulting access/refresh tokens, stored locally on-device only
// (see app.js's GoogleHealth object), never synced to Supabase.

var TOKEN_URL = 'https://oauth2.googleapis.com/token';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  var clientId = process.env.GOOGLE_HEALTH_CLIENT_ID;
  var clientSecret = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: missing GOOGLE_HEALTH_CLIENT_ID / GOOGLE_HEALTH_CLIENT_SECRET' }) };
  }

  var payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  var params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);

  if (payload.grant_type === 'refresh_token') {
    if (!payload.refresh_token) return { statusCode: 400, body: JSON.stringify({ error: 'Missing refresh_token' }) };
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', payload.refresh_token);
  } else {
    if (!payload.code || !payload.redirect_uri) return { statusCode: 400, body: JSON.stringify({ error: 'Missing code or redirect_uri' }) };
    params.set('grant_type', 'authorization_code');
    params.set('code', payload.code);
    params.set('redirect_uri', payload.redirect_uri);
  }

  try {
    var res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    var data = await res.json();
    if (!res.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: data.error_description || data.error || 'Token exchange failed' }) };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token, // only present on the very first exchange
        expires_in: data.expires_in
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Proxy failure', detail: String((err && err.message) || err) }) };
  }
};

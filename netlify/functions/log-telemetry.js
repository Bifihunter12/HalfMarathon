// Minimal, self-hosted crash/event logging (docs/RELEASE_BLOCKERS.md
// CRITICAL-2 + CRITICAL-3). Deliberately does NOT integrate a third-party
// service (Sentry, Mixpanel, etc.) -- those require creating a new account,
// which isn't something to do on the user's behalf. This gets errors and a
// small set of named events into Netlify's own function logs (already
// visible in the Netlify dashboard, no new signup) as a real first step,
// not a full observability platform. Swap in a real service later if
// deeper triage/dashboards are wanted.
//
// A telemetry endpoint must never itself become a second source of errors
// for the caller -- always returns 204, even when the payload is invalid,
// and the client-side caller (app.js) never awaits or surfaces its result.

var MAX_FIELD_LENGTH = 500; // caps abuse/accidental huge payloads (e.g. a giant stack trace)
var VALID_KINDS = ['error', 'event'];

function clip(value) {
  if (typeof value !== 'string') return '';
  return value.length > MAX_FIELD_LENGTH ? value.slice(0, MAX_FIELD_LENGTH) + '…' : value;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 204, body: '' };
  }

  var payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 204, body: '' };
  }

  var kind = VALID_KINDS.indexOf(payload.kind) !== -1 ? payload.kind : 'event';
  var name = clip(payload.name);
  var detail = clip(payload.detail);
  var timestamp = typeof payload.timestamp === 'number' ? payload.timestamp : Date.now();

  if (!name) return { statusCode: 204, body: '' };

  var line = '[racr-telemetry] ' + kind + ' | ' + name + (detail ? ' | ' + detail : '') + ' | ' + new Date(timestamp).toISOString();
  if (kind === 'error') console.error(line); else console.log(line);

  return { statusCode: 204, body: '' };
};

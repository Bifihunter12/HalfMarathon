// Tests for subscription.js -- freemium entitlement/lock logic
// (docs/COACHING_SPEC.md "Subscription / premium features"). Pure functions
// only: no real purchase flow exists yet, this just decides whether a
// feature should currently show as locked given a stored entitlement record.
//
// Run with: node --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const sub = require(path.join(__dirname, '..', 'subscription.js'));

function freeState() { return { tier: 'free', productId: null, source: null, expiresAtIso: null, willRenew: null, lastVerifiedIso: null }; }
function premiumState(overrides) {
  return Object.assign({ tier: 'premium', productId: 'runner_premium_annual', source: 'ios', expiresAtIso: '2027-01-01T00:00:00.000Z', willRenew: true, lastVerifiedIso: '2026-08-01T00:00:00.000Z' }, overrides || {});
}

test('hasActiveEntitlement: a free-tier record is never active', function () {
  assert.equal(sub.hasActiveEntitlement(freeState()), false);
});

test('hasActiveEntitlement: null/undefined subscription is never active', function () {
  assert.equal(sub.hasActiveEntitlement(null), false);
  assert.equal(sub.hasActiveEntitlement(undefined), false);
});

test('hasActiveEntitlement: a premium record with a future expiresAtIso is active', function () {
  assert.equal(sub.hasActiveEntitlement(premiumState(), '2026-08-03T00:00:00.000Z'), true);
});

test('hasActiveEntitlement: a premium record with a past expiresAtIso is not active', function () {
  const expired = premiumState({ expiresAtIso: '2020-01-01T00:00:00.000Z' });
  assert.equal(sub.hasActiveEntitlement(expired, '2026-08-03T00:00:00.000Z'), false);
});

test('hasActiveEntitlement: a premium record with no expiresAtIso on record is treated as active, not locked out', function () {
  const noExpiry = premiumState({ expiresAtIso: null });
  assert.equal(sub.hasActiveEntitlement(noExpiry, '2026-08-03T00:00:00.000Z'), true);
});

test('isFeatureLocked: an unknown feature id is never locked', function () {
  assert.equal(sub.isFeatureLocked(freeState(), 'somethingThatDoesNotExist'), false);
});

test('isFeatureLocked: aiCoachChat is locked on the free tier', function () {
  assert.equal(sub.isFeatureLocked(freeState(), 'aiCoachChat'), true);
});

test('isFeatureLocked: googleHealthSync is locked on the free tier', function () {
  assert.equal(sub.isFeatureLocked(freeState(), 'googleHealthSync'), true);
});

test('isFeatureLocked: both premium features unlock with an active subscription', function () {
  assert.equal(sub.isFeatureLocked(premiumState(), 'aiCoachChat', '2026-08-03T00:00:00.000Z'), false);
  assert.equal(sub.isFeatureLocked(premiumState(), 'googleHealthSync', '2026-08-03T00:00:00.000Z'), false);
});

test('isFeatureLocked: an expired premium record re-locks premium features', function () {
  const expired = premiumState({ expiresAtIso: '2020-01-01T00:00:00.000Z' });
  assert.equal(sub.isFeatureLocked(expired, 'aiCoachChat', '2026-08-03T00:00:00.000Z'), true);
});

test('PREMIUM_FEATURES exposes exactly the two gated feature ids', function () {
  assert.deepEqual(Object.keys(sub.PREMIUM_FEATURES).sort(), ['aiCoachChat', 'googleHealthSync']);
});

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RACRSubscription = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // docs/COACHING_SPEC.md "Subscription / premium features" -- Runner is
  // freemium: the core coaching plan, safety guidance, logging, calendar,
  // recurring workouts/travel mode, and progress tracking stay free for
  // everyone, no matter what. Only the two features that cost real per-use
  // backend spend are gated. Pure functions only, same separation as
  // progress-stats.js -- app.js owns turning a lock check into
  // markup and the real store purchase flow (not yet built, see that doc).
  var PREMIUM_FEATURES = {
    aiCoachChat: 'AI coach chat',
    googleHealthSync: 'Google Health / Fitbit sync'
  };

  // state.subscription shape: { tier: 'free'|'premium', productId,
  // source: 'ios'|'android'|null, expiresAtIso, willRenew, lastVerifiedIso }
  function hasActiveEntitlement(subscription, nowIso) {
    if (!subscription || subscription.tier !== 'premium') return false;
    // No expiry on record yet (e.g. verified but the store hasn't reported
    // a renewal date) -- treat as active rather than locking someone out
    // who's already paid.
    if (!subscription.expiresAtIso) return true;
    return subscription.expiresAtIso > (nowIso || new Date().toISOString());
  }

  function isFeatureLocked(subscription, featureId, nowIso) {
    if (!PREMIUM_FEATURES.hasOwnProperty(featureId)) return false; // unknown/free feature -- never locked
    return !hasActiveEntitlement(subscription, nowIso);
  }

  return {
    PREMIUM_FEATURES: PREMIUM_FEATURES,
    hasActiveEntitlement: hasActiveEntitlement,
    isFeatureLocked: isFeatureLocked
  };
});

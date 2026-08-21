export const AUDIENCE_PROFILES = Object.freeze({
  child: Object.freeze({
    label: 'Child',
    personalizedAds: false,
    contextualAdsOnly: true,
    allowedPlacements: Object.freeze(['level-end']),
    maxInterstitialsPerDay: 3,
    rewardedAds: 'parent-approved-virtual-reward-only',
    cashReferralVisible: false,
    openChatAllowed: false
  }),
  teen: Object.freeze({
    label: 'Teen',
    personalizedAds: false,
    contextualAdsOnly: true,
    allowedPlacements: Object.freeze(['level-end', 'optional-rewarded']),
    maxInterstitialsPerDay: 5,
    rewardedAds: 'optional-virtual-reward-only',
    cashReferralVisible: false,
    openChatAllowed: false
  }),
  adult: Object.freeze({
    label: 'Adult / Parent',
    personalizedAds: false,
    contextualAdsOnly: true,
    allowedPlacements: Object.freeze(['level-end', 'optional-rewarded', 'lobby-banner']),
    maxInterstitialsPerDay: 8,
    rewardedAds: 'optional-virtual-reward-only',
    cashReferralVisible: false,
    openChatAllowed: false
  })
});

export const AD_PROVIDER_STATE = Object.freeze({
  provider: 'not-connected',
  liveServingEnabled: false,
  testModeRequiredBeforeLaunch: true,
  providerAccountOwner: 'Aarulya',
  settlementRequiredForRewardPool: true
});

const BLOCKED_PLACEMENTS = new Set([
  'app-launch',
  'active-gameplay',
  'forced-mid-match',
  'pause-button',
  'error-screen',
  'child-cash-screen'
]);

export function normalizeAudience(value) {
  return Object.hasOwn(AUDIENCE_PROFILES, value) ? value : 'child';
}

export function getAudiencePolicy(value) {
  return AUDIENCE_PROFILES[normalizeAudience(value)];
}

export function canShowAd({ audience, placement, activeGameplay = false, adsShownToday = 0 } = {}) {
  const policy = getAudiencePolicy(audience);

  if (!AD_PROVIDER_STATE.liveServingEnabled) {
    return { allowed: false, reason: 'provider-not-connected' };
  }
  if (activeGameplay || BLOCKED_PLACEMENTS.has(placement)) {
    return { allowed: false, reason: 'disruptive-placement-blocked' };
  }
  if (!policy.allowedPlacements.includes(placement)) {
    return { allowed: false, reason: 'placement-not-allowed-for-audience' };
  }
  if (adsShownToday >= policy.maxInterstitialsPerDay) {
    return { allowed: false, reason: 'daily-frequency-cap-reached' };
  }
  return { allowed: true, reason: 'policy-approved' };
}

export function getPublicMonetizationStatus(audience) {
  const mode = normalizeAudience(audience);
  const policy = getAudiencePolicy(mode);
  return {
    audience: mode,
    label: policy.label,
    provider: AD_PROVIDER_STATE.liveServingEnabled ? AD_PROVIDER_STATE.provider : 'Not connected',
    placement: policy.allowedPlacements.join(', '),
    rewardType: 'Virtual coins / non-cash items only',
    cashReferral: policy.cashReferralVisible ? 'Eligible after funded campaign approval' : 'Disabled'
  };
}

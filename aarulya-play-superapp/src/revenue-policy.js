export const REVENUE_ALLOCATION = Object.freeze({
  operations: 55,
  gameContent: 20,
  referralCampaigns: 10,
  marketing: 10,
  reserve: 5
});

const ALLOWED_REVENUE_SOURCES = new Set([
  'ads',
  'subscriptions',
  'cosmetics',
  'sponsorships',
  'licensing'
]);

function safePaise(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

export function validateAllocation(allocation = REVENUE_ALLOCATION) {
  const total = Object.values(allocation).reduce((sum, value) => sum + Number(value || 0), 0);
  if (total !== 100) throw new Error('Revenue allocation must equal 100%.');
  return true;
}

export function allocateSettledRevenue({ source, grossPaise, feesPaise = 0, taxesPaise = 0, verified = false }) {
  validateAllocation();
  if (!verified) throw new Error('Only verified and settled income can be allocated.');
  if (!ALLOWED_REVENUE_SOURCES.has(source)) throw new Error('Unsupported revenue source.');

  const netPaise = Math.max(0, safePaise(grossPaise) - safePaise(feesPaise) - safePaise(taxesPaise));
  const buckets = {};
  let assigned = 0;
  const entries = Object.entries(REVENUE_ALLOCATION);

  entries.forEach(([name, percent], index) => {
    const value = index === entries.length - 1
      ? netPaise - assigned
      : Math.floor(netPaise * percent / 100);
    buckets[name] = value;
    assigned += value;
  });

  return Object.freeze({
    source,
    grossPaise: safePaise(grossPaise),
    feesPaise: safePaise(feesPaise),
    taxesPaise: safePaise(taxesPaise),
    netPaise,
    buckets: Object.freeze(buckets)
  });
}

export function canCreateReferralCampaign({
  adultOnly = false,
  kycAndFraudControlsReady = false,
  publishedTermsReady = false,
  fundedReferralBucketPaise = 0,
  requestedBudgetPaise = 0
} = {}) {
  const requested = safePaise(requestedBudgetPaise);
  const funded = safePaise(fundedReferralBucketPaise);

  if (!adultOnly) return { allowed: false, reason: 'adult-only-required' };
  if (!kycAndFraudControlsReady) return { allowed: false, reason: 'verification-controls-not-ready' };
  if (!publishedTermsReady) return { allowed: false, reason: 'campaign-terms-not-ready' };
  if (requested <= 0 || requested > funded) return { allowed: false, reason: 'insufficient-settled-revenue-pool' };
  return { allowed: true, reason: 'funded-campaign-approved' };
}

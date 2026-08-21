const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export const CHART_RULES = Object.freeze({
  paidPlacementAffectsOrganicRank: false,
  sponsoredItemsRequireLabel: true,
  verifiedInstallsOnly: true,
  botAndDuplicateInstallsExcluded: true,
  childChartsUseSeparateEligibility: true,
  minimumQualityGateRequired: true
});

export function isChartEligible(app) {
  if (!app || app.status !== 'published') return { eligible: false, reason: 'not-published' };
  if (app.releaseVerification !== 'passed') return { eligible: false, reason: 'release-not-verified' };
  if (app.malwareScan !== 'passed') return { eligible: false, reason: 'security-gate-not-passed' };
  if (app.crashFreeSessionsPercent < 97) return { eligible: false, reason: 'quality-floor-not-met' };
  if (app.policyStanding !== 'good') return { eligible: false, reason: 'policy-standing-required' };
  return { eligible: true, reason: 'eligible' };
}

export function calculateOrganicChartScore(metrics = {}) {
  const verifiedInstalls7d = clamp(metrics.verifiedInstalls7d, 0, 10_000_000);
  const verifiedUpdates7d = clamp(metrics.verifiedUpdates7d, 0, 10_000_000);
  const retention7dPercent = clamp(metrics.retention7dPercent, 0, 100);
  const crashFreeSessionsPercent = clamp(metrics.crashFreeSessionsPercent, 0, 100);
  const ratingAverage = clamp(metrics.ratingAverage, 0, 5);
  const verifiedRatingCount = clamp(metrics.verifiedRatingCount, 0, 10_000_000);
  const uninstallRatePercent = clamp(metrics.uninstallRatePercent, 0, 100);
  const abusePenalty = clamp(metrics.abusePenalty, 0, 100);

  const adoption = Math.log10(verifiedInstalls7d + 1) * 22;
  const updates = Math.log10(verifiedUpdates7d + 1) * 5;
  const retention = retention7dPercent * 0.28;
  const quality = crashFreeSessionsPercent * 0.2;
  const ratingConfidence = Math.min(1, verifiedRatingCount / 500);
  const satisfaction = ratingAverage * 6 * ratingConfidence;
  const churnPenalty = uninstallRatePercent * 0.22;

  return Number(Math.max(0,
    adoption + updates + retention + quality + satisfaction - churnPenalty - abusePenalty
  ).toFixed(4));
}

export function buildOrganicChart(apps = []) {
  return apps
    .map((app) => ({ app, eligibility: isChartEligible(app) }))
    .filter((entry) => entry.eligibility.eligible)
    .map(({ app }) => ({
      appId: app.id,
      score: calculateOrganicChartScore(app.metrics),
      chartLabel: 'Organic',
      sponsored: false
    }))
    .sort((a, b) => b.score - a.score || a.appId.localeCompare(b.appId));
}

export function createSponsoredPlacement(appId, campaign = {}) {
  if (!appId) throw new Error('app-id-required');
  if (!campaign.approved || !campaign.disclosureText) throw new Error('approved-labelled-campaign-required');
  return Object.freeze({
    appId,
    placementType: 'sponsored',
    label: campaign.disclosureText,
    affectsOrganicRank: false
  });
}

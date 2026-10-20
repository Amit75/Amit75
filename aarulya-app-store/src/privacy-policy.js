const PASS_VALUES = new Set(['passed', 'verified', 'approved', true]);
const SENSITIVE_TYPES = new Set(['precise-location', 'contacts', 'messages', 'photos', 'microphone', 'camera', 'financial', 'health', 'biometric', 'government-id', 'children-data']);

export const PRIVACY_CONSTITUTION = Object.freeze({
  sellPersonalDataAllowed: false,
  hiddenCollectionAllowed: false,
  unrelatedSecondaryUseAllowed: false,
  indefiniteRetentionAllowed: false,
  darkPatternConsentAllowed: false,
  childBehavioralAdvertisingAllowed: false,
  preciseLocationForChildrenAllowed: false,
  denyServiceForOptionalConsentAllowed: false,
  privacyReviewRequiredBeforeRelease: true
});

function passed(value) {
  return PASS_VALUES.has(value) || (typeof value === 'string' && value.startsWith('verified:'));
}

function requireCheck(errors, condition, code) {
  if (!condition) errors.push(code);
}

function validRetentionDays(value) {
  return Number.isInteger(value) && value > 0 && value <= 3650;
}

export function evaluatePrivacy(app = {}) {
  const evidence = app.privacyEvidence || {};
  const dataTypes = Array.isArray(app.dataTypesCollected) ? app.dataTypesCollected : [];
  const processors = Array.isArray(app.dataProcessors) ? app.dataProcessors : [];
  const errors = [];

  requireCheck(errors, passed(evidence.completeDataInventory), 'privacy:complete-data-inventory-required');
  requireCheck(errors, passed(evidence.purposeLimitationReview), 'privacy:purpose-limitation-review-required');
  requireCheck(errors, passed(evidence.dataMinimizationReview), 'privacy:data-minimization-review-required');
  requireCheck(errors, passed(evidence.collectionDisclosureMatchesRuntime), 'privacy:runtime-disclosure-consistency-required');
  requireCheck(errors, passed(evidence.consentIsSpecificAndUnbundledOrNotRequired), 'privacy:specific-unbundled-consent-required');
  requireCheck(errors, passed(evidence.optionalConsentCanBeDeclined), 'privacy:optional-consent-decline-required');
  requireCheck(errors, passed(evidence.retentionScheduleImplemented), 'privacy:retention-schedule-required');
  requireCheck(errors, validRetentionDays(app.maximumPersonalDataRetentionDays), 'privacy:valid-maximum-retention-required');
  requireCheck(errors, passed(evidence.deletionWorkflowTested), 'privacy:deletion-workflow-test-required');
  requireCheck(errors, passed(evidence.exportWorkflowTestedOrNotApplicable), 'privacy:data-export-workflow-required');
  requireCheck(errors, passed(evidence.processorRegistryReviewed), 'privacy:processor-registry-review-required');
  requireCheck(errors, passed(evidence.crossBorderAndHostingReview), 'privacy:hosting-transfer-review-required');
  requireCheck(errors, passed(evidence.analyticsIsNecessaryOrOptOutAvailable), 'privacy:analytics-necessity-or-optout-required');
  requireCheck(errors, passed(evidence.noDarkPatternsReview), 'privacy:no-dark-pattern-review-required');
  requireCheck(errors, passed(evidence.privacyNoticeReadableAndVersioned), 'privacy:readable-versioned-notice-required');
  requireCheck(errors, passed(evidence.privacyContactVerified), 'privacy:verified-contact-required');

  if (dataTypes.some((type) => SENSITIVE_TYPES.has(type))) {
    requireCheck(errors, passed(evidence.sensitiveDataNecessityReview), 'privacy:sensitive-data-necessity-review-required');
    requireCheck(errors, passed(evidence.sensitiveDataAccessRestricted), 'privacy:sensitive-data-access-restriction-required');
    requireCheck(errors, passed(evidence.sensitiveDataDeletionSlaTested), 'privacy:sensitive-data-deletion-sla-required');
  }

  if (processors.length > 0) {
    const invalidProcessors = processors.filter((processor) => !processor || processor.contractReview !== 'passed' || processor.securityReview !== 'passed' || !processor.purpose);
    if (invalidProcessors.length) errors.push('privacy:unreviewed-data-processors-present');
  }

  if (app.childDirected === true) {
    requireCheck(errors, passed(evidence.childDataMinimized), 'privacy:child-data-minimization-required');
    requireCheck(errors, passed(evidence.parentalControlAndDeletionWorkflow), 'privacy:child-parental-control-required');
    requireCheck(errors, passed(evidence.noBehavioralAdvertisingToChildren), 'privacy:child-behavioral-ads-prohibited');
    requireCheck(errors, passed(evidence.noPreciseLocationForChildren), 'privacy:child-precise-location-prohibited');
    requireCheck(errors, passed(evidence.ageAppropriatePrivacyNotice), 'privacy:age-appropriate-notice-required');
  }

  if (app.sellsPersonalData === true) errors.push('privacy:personal-data-sale-prohibited');
  if (app.hiddenDataCollection === true) errors.push('privacy:hidden-data-collection-prohibited');
  if (app.unrelatedSecondaryUse === true) errors.push('privacy:unrelated-secondary-use-prohibited');
  if (app.indefiniteRetention === true) errors.push('privacy:indefinite-retention-prohibited');
  if (app.consentDarkPatternsPresent === true) errors.push('privacy:consent-dark-patterns-prohibited');
  if (app.childDirected === true && app.personalizedAdsEnabled === true) errors.push('privacy:personalized-child-ads-prohibited');

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
    dataTypes: Object.freeze([...dataTypes]),
    processorCount: processors.length
  });
}

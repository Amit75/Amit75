const SENSITIVE_OR_HIGH_RISK = new Set([
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.READ_CONTACTS',
  'android.permission.WRITE_CONTACTS',
  'android.permission.READ_SMS',
  'android.permission.SEND_SMS',
  'android.permission.READ_CALL_LOG',
  'android.permission.WRITE_CALL_LOG',
  'android.permission.MANAGE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.BIND_ACCESSIBILITY_SERVICE',
  'android.permission.BIND_DEVICE_ADMIN',
  'android.permission.REQUEST_INSTALL_PACKAGES'
]);

const PROHIBITED_FOR_STORE = new Set([
  'android.permission.READ_SMS',
  'android.permission.SEND_SMS',
  'android.permission.READ_CALL_LOG',
  'android.permission.WRITE_CALL_LOG',
  'android.permission.MANAGE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.BIND_ACCESSIBILITY_SERVICE',
  'android.permission.BIND_DEVICE_ADMIN'
]);

function unique(values) {
  return [...new Set(values)];
}

export const ANDROID_PERMISSION_PRIVACY_POLICY = Object.freeze({
  requestAtFirstLaunchAllowed: false,
  requestBeforeUserActionAllowed: false,
  forcedConsentAllowed: false,
  precheckedConsentAllowed: false,
  denyBlocksUnrelatedFeatures: false,
  repeatedPermissionNaggingAllowed: false,
  broadStoragePermissionAllowed: false,
  useSystemPhotoPickerWhenPossible: true,
  useStorageAccessFrameworkWhenPossible: true,
  notificationPermissionOptional: true,
  installPermissionOnlyForStoreInstaller: true,
  privacyCenterRequired: true,
  consentRevocationRequired: true,
  localizedRationaleRequired: true,
  deniedFlowTestingRequired: true
});

export function evaluateAndroidPermissionPrivacy(app = {}) {
  const errors = [];
  const declared = Array.isArray(app.androidDeclaredPermissions) ? app.androidDeclaredPermissions : [];
  const evidence = app.androidPermissionPrivacyEvidence || {};
  const isStoreInstaller = app.isStoreInstaller === true || app.id === 'aarulya-store';

  if (app.permissionPromptAtFirstLaunch === true) errors.push('android-privacy:first-launch-permission-prompt-prohibited');
  if (app.permissionRequestedBeforeFeatureAction === true) errors.push('android-privacy:permission-must-be-just-in-time');
  if (app.forcedConsent === true) errors.push('android-privacy:forced-consent-prohibited');
  if (app.precheckedConsent === true) errors.push('android-privacy:prechecked-consent-prohibited');
  if (app.permissionDenialBlocksUnrelatedFeatures === true) errors.push('android-privacy:denial-must-not-block-unrelated-features');
  if (app.repeatedPermissionNagging === true) errors.push('android-privacy:repeated-permission-nagging-prohibited');
  if (app.privacyCenterAvailable !== true) errors.push('android-privacy:privacy-center-required');
  if (app.consentRevocationAvailable !== true) errors.push('android-privacy:consent-revocation-required');
  if (app.permissionPurposeInventoryComplete !== true) errors.push('android-privacy:permission-purpose-inventory-required');
  if (app.dataCollectionMatchesDisclosure !== true) errors.push('android-privacy:data-disclosure-match-required');

  for (const permission of declared) {
    if (PROHIBITED_FOR_STORE.has(permission) && isStoreInstaller) {
      errors.push(`android-privacy:store-permission-prohibited:${permission}`);
    }
    if (permission === 'android.permission.REQUEST_INSTALL_PACKAGES' && !isStoreInstaller) {
      errors.push('android-privacy:install-packages-restricted-to-store-installer');
    }
  }

  if (declared.includes('android.permission.MANAGE_EXTERNAL_STORAGE')) {
    errors.push('android-privacy:broad-storage-prohibited');
  }
  if (app.usesSystemPhotoPickerWhenApplicable !== true) errors.push('android-privacy:system-photo-picker-required');
  if (app.usesStorageAccessFrameworkWhenApplicable !== true) errors.push('android-privacy:storage-access-framework-required');
  if (app.notificationPermissionRequestedOnlyAfterOptIn !== true) errors.push('android-privacy:notification-permission-must-follow-opt-in');

  const declaredSensitive = declared.filter((permission) => SENSITIVE_OR_HIGH_RISK.has(permission));
  const reviewedSensitive = new Set(Array.isArray(evidence.reviewedSensitivePermissions) ? evidence.reviewedSensitivePermissions : []);
  declaredSensitive.forEach((permission) => {
    if (!reviewedSensitive.has(permission)) errors.push(`android-privacy:sensitive-permission-not-reviewed:${permission}`);
  });

  if (evidence.manifestPermissionDiffReview !== 'passed') errors.push('android-privacy:manifest-permission-diff-review-required');
  if (evidence.justInTimePermissionFlowTest !== 'passed') errors.push('android-privacy:just-in-time-flow-test-required');
  if (evidence.deniedAndPermanentlyDeniedFlowTest !== 'passed') errors.push('android-privacy:denied-flow-test-required');
  if (evidence.localizedRationaleReview !== 'passed') errors.push('android-privacy:localized-rationale-review-required');
  if (evidence.privacyCenterFunctionalTest !== 'passed') errors.push('android-privacy:privacy-center-test-required');
  if (evidence.consentRevocationTest !== 'passed') errors.push('android-privacy:consent-revocation-test-required');
  if (evidence.installUnknownAppsFlowTest !== 'passed' && isStoreInstaller) errors.push('android-privacy:install-source-flow-test-required');
  if (evidence.noUndeclaredSdkPermissionsTest !== 'passed') errors.push('android-privacy:sdk-permission-inheritance-test-required');

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(unique(errors)),
    declaredPermissions: Object.freeze([...declared]),
    sensitivePermissions: Object.freeze(declaredSensitive),
    policy: ANDROID_PERMISSION_PRIVACY_POLICY
  });
}

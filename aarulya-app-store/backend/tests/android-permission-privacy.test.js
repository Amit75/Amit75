import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAndroidPermissionPrivacy } from '../../src/android-permission-privacy.js';

function safeStore(overrides = {}) {
  return {
    id: 'aarulya-store',
    isStoreInstaller: true,
    androidDeclaredPermissions: [
      'android.permission.INTERNET',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.REQUEST_INSTALL_PACKAGES'
    ],
    permissionPromptAtFirstLaunch: false,
    permissionRequestedBeforeFeatureAction: false,
    forcedConsent: false,
    precheckedConsent: false,
    permissionDenialBlocksUnrelatedFeatures: false,
    repeatedPermissionNagging: false,
    privacyCenterAvailable: true,
    consentRevocationAvailable: true,
    permissionPurposeInventoryComplete: true,
    dataCollectionMatchesDisclosure: true,
    usesSystemPhotoPickerWhenApplicable: true,
    usesStorageAccessFrameworkWhenApplicable: true,
    notificationPermissionRequestedOnlyAfterOptIn: true,
    androidPermissionPrivacyEvidence: {
      reviewedSensitivePermissions: ['android.permission.REQUEST_INSTALL_PACKAGES'],
      manifestPermissionDiffReview: 'passed',
      justInTimePermissionFlowTest: 'passed',
      deniedAndPermanentlyDeniedFlowTest: 'passed',
      localizedRationaleReview: 'passed',
      privacyCenterFunctionalTest: 'passed',
      consentRevocationTest: 'passed',
      installUnknownAppsFlowTest: 'passed',
      noUndeclaredSdkPermissionsTest: 'passed'
    },
    ...overrides
  };
}

test('accepts minimum Store permissions with just-in-time flows', () => {
  const result = evaluateAndroidPermissionPrivacy(safeStore());
  assert.equal(result.valid, true);
});

test('blocks permission prompts on first launch', () => {
  const result = evaluateAndroidPermissionPrivacy(safeStore({ permissionPromptAtFirstLaunch: true }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('android-privacy:first-launch-permission-prompt-prohibited'));
});

test('blocks broad storage and unrelated high-risk permissions', () => {
  const result = evaluateAndroidPermissionPrivacy(safeStore({
    androidDeclaredPermissions: [
      'android.permission.INTERNET',
      'android.permission.REQUEST_INSTALL_PACKAGES',
      'android.permission.MANAGE_EXTERNAL_STORAGE'
    ]
  }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('broad-storage-prohibited')));
});

test('blocks installer permission in non-store applications', () => {
  const result = evaluateAndroidPermissionPrivacy(safeStore({
    id: 'photo-editor',
    isStoreInstaller: false
  }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('android-privacy:install-packages-restricted-to-store-installer'));
});

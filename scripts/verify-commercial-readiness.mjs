import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? 'commercial-readiness/product-readiness.v1.json';
const statuses = new Set(['PASS', 'PARTIAL', 'MISSING', 'BLOCKED', 'NOT_APPLICABLE']);
const marketStates = new Set(['BLOCKED', 'PILOT', 'LAUNCH_APPROVED']);
const gates = ['exactHeadCI','dependencyAudit','securityReview','stagingDeployment','backupRestore','rollback','privacyPack','legalTerms','pricingBilling','supportSLA','customerPilot','indiaCountryPack','internationalCountryPack'];
const distributionGates = ['offlineSigningCeremony','androidBuild','physicalDeviceAcceptance','independentRebuild','malwareAndSecurityTesting','penetrationAndReverseEngineeringAssessment','keyCompromiseRecovery','disasterRecovery','finalSignedEvidence'];

function fail(code) {
  console.error(`COMMERCIAL_READINESS_RADAR_FAIL:${code}`);
  process.exit(1);
}
function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
function rejectSecretKeys(value, location = 'manifest') {
  if (Array.isArray(value)) return value.forEach((item, index) => rejectSecretKeys(item, `${location}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (/^(password|secret|token|privateKey|credential)$/i.test(key)) fail(`SECRET_LIKE_KEY_DENIED:${location}.${key}`);
    rejectSecretKeys(child, `${location}.${key}`);
  }
}

if (Number(process.versions.node.split('.')[0]) < 20) fail('NODE_20_OR_NEWER_REQUIRED');
let manifest;
try {
  manifest = JSON.parse(readFileSync(path, 'utf8'));
} catch (error) {
  fail(`MANIFEST_READ_OR_PARSE_ERROR:${error instanceof Error ? error.message : String(error)}`);
}
rejectSecretKeys(manifest);
if (manifest.schemaVersion !== '1.0.0') fail('UNSUPPORTED_SCHEMA_VERSION');
for (const key of ['productId','productName','productRole']) if (!nonEmpty(manifest[key])) fail(`${key}_REQUIRED`);
if (manifest.productId !== 'aarulya-store') fail('UNEXPECTED_PRODUCT_ID');
if (!Number.isInteger(manifest.commercialPriority) || manifest.commercialPriority < 1) fail('INVALID_COMMERCIAL_PRIORITY');
if (!Array.isArray(manifest.revenueModels) || manifest.revenueModels.length === 0) fail('REVENUE_MODELS_REQUIRED');
if (!Array.isArray(manifest.boundary?.owns) || manifest.boundary.owns.length === 0) fail('BOUNDARY_OWNS_REQUIRED');
if (!Array.isArray(manifest.boundary?.mustNotOwn) || manifest.boundary.mustNotOwn.length === 0) fail('BOUNDARY_MUST_NOT_OWN_REQUIRED');

for (const marketName of ['india','international']) {
  const market = manifest.markets?.[marketName];
  if (!market || !marketStates.has(market.state)) fail(`INVALID_MARKET_STATE:${marketName}`);
  if (!statuses.has(market.countryPack)) fail(`INVALID_COUNTRY_PACK:${marketName}`);
  if (market.state !== 'BLOCKED' && market.countryPack !== 'PASS') fail(`COUNTRY_PACK_MUST_PASS:${marketName}`);
}
for (const gate of gates) if (!statuses.has(manifest.gates?.[gate])) fail(`INVALID_GATE:${gate}`);
for (const [flag, value] of Object.entries(manifest.launchFlags ?? {})) if (typeof value !== 'boolean') fail(`INVALID_LAUNCH_FLAG:${flag}`);
const launchFlags = manifest.launchFlags ?? {};
const anyLaunch = Object.values(launchFlags).some(Boolean);
const allCoreGatesPass = gates.every((gate) => ['PASS','NOT_APPLICABLE'].includes(manifest.gates[gate]));
if (anyLaunch && !allCoreGatesPass) fail('LAUNCH_DENIED_UNTIL_CORE_GATES_PASS');
if (launchFlags.indiaCommercial && manifest.markets.india.state !== 'LAUNCH_APPROVED') fail('INDIA_MARKET_NOT_APPROVED');
if (launchFlags.internationalCommercial && manifest.markets.international.state !== 'LAUNCH_APPROVED') fail('INTERNATIONAL_MARKET_NOT_APPROVED');

for (const field of ['actualIncomeRequiresSettledEvidence','invoiceIsNotCash','contractIsNotCash','pipelineIsNotCash','estimatedRevenueIsNotCash']) {
  if (manifest.revenueTruth?.[field] !== true) fail(`REVENUE_TRUTH_REQUIRED:${field}`);
}
if (manifest.dataGovernance?.crossBorderTransferDefault !== 'BLOCKED') fail('CROSS_BORDER_TRANSFER_MUST_DEFAULT_BLOCKED');
if (manifest.dataGovernance?.retentionPolicyRequired !== true) fail('RETENTION_REQUIRED');
if (manifest.dataGovernance?.deletionAndExportWorkflowRequired !== true) fail('EXPORT_DELETION_REQUIRED');
if (manifest.approval?.ownerApprovalRequired !== true) fail('OWNER_APPROVAL_REQUIRED');
if (!Array.isArray(manifest.approval?.approvalEvidence)) fail('APPROVAL_EVIDENCE_ARRAY_REQUIRED');
if (anyLaunch && manifest.approval.approvalEvidence.length === 0) fail('LAUNCH_REQUIRES_APPROVAL_EVIDENCE');

const safety = manifest.distributionSafety;
if (!safety || typeof safety !== 'object') fail('DISTRIBUTION_SAFETY_REQUIRED');
for (const field of [
  'firstPartyAarulyaAppsOnly','thirdPartyApkImportDenied','thirdPartyApkModificationDenied','thirdPartyApkResigningDenied',
  'silentInstallDenied','androidUserConfirmationRequired','signingAuthorityOutsidePublicServices','signingMaterialOutsideRepository',
  'packageVersionDigestAndCertificateContinuityRequired','v1SigningDisabled','v2AndV3SigningRequired','releaseEnvelopeKeyFingerprintPinningRequired'
]) {
  if (safety[field] !== true) fail(`DISTRIBUTION_SAFETY_REQUIRED:${field}`);
}
for (const gate of distributionGates) if (!statuses.has(safety[gate])) fail(`INVALID_DISTRIBUTION_GATE:${gate}`);
const allDistributionGatesPass = distributionGates.every((gate) => ['PASS','NOT_APPLICABLE'].includes(safety[gate]));
if (anyLaunch && !allDistributionGatesPass) fail('STORE_LAUNCH_DENIED_UNTIL_DISTRIBUTION_GATES_PASS');

console.log(`COMMERCIAL_READINESS_RADAR_PASS:${manifest.productId}`);
console.log(`ALL_REQUIRED_GATES_PASS:${allCoreGatesPass && allDistributionGatesPass}`);
console.log('STORE_DISTRIBUTION_DEFAULT:BLOCKED');

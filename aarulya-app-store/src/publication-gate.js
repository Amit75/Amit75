import { validateRelease } from './release-policy.js';
import { evaluateAndroidPermissionPrivacy } from './android-permission-privacy.js';
import { buildReleaseEvidenceReport, validateSignedReport } from './release-evidence-report.js';

export function evaluatePublicationGate(app = {}, options = {}) {
  const release = validateRelease(app);
  const androidPrivacy = evaluateAndroidPermissionPrivacy(app);
  const evidenceReport = buildReleaseEvidenceReport(app, options);
  const signedReport = validateSignedReport(app.signedReleaseEvidenceReport || {});

  const errors = [
    ...release.errors,
    ...androidPrivacy.errors,
    ...(evidenceReport.reportReady ? [] : evidenceReport.blockers),
    ...signedReport.errors
  ];

  return Object.freeze({
    allowed: app.status === 'published' && errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
    release,
    androidPrivacy,
    evidenceReport,
    signedReport
  });
}

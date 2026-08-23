import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { findActions } from '../../src/action-discovery.js';
import { canServeDownload, verifyInstallCandidate } from '../../src/store-integrity.js';
import { canTransition, terminalState, validateJobDefinition } from '../../src/durable-jobs.js';

const DOWNLOAD_TTL_MS = 5 * 60 * 1000;
const DOWNLOAD_ORIGIN = 'https://downloads.store.aarulya.com';
const MAX_PAGE_SIZE = 100;

function digest(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function clone(value) {
  return structuredClone(value);
}

function fail(code, status = 400, details = undefined) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  if (details) error.details = details;
  return error;
}

function requireActor(context = {}) {
  if (!context.actorId) throw fail('authentication-required', 401);
  if (!context.requestId) throw fail('request-id-required', 400);
  return context.actorId;
}

function publicApp(app) {
  return Object.freeze({
    id: app.id,
    name: app.name,
    category: app.category,
    description: app.description,
    age: app.age,
    packageId: app.packageId,
    status: app.status,
    publisher: app.publisher || 'Aarulya'
  });
}

export function createStoreService({
  catalog = [],
  now = () => Date.now(),
  issueId = () => randomUUID(),
  issueSecret = () => randomBytes(32).toString('base64url')
} = {}) {
  const appsById = new Map(catalog.map((app) => [app.id, clone(app)]));
  const downloadGrantsByDigest = new Map();
  const installReceipts = new Map();
  const jobs = new Map();
  const jobEvents = new Map();

  function appendJobEvent(jobId, event) {
    const events = jobEvents.get(jobId) || [];
    const record = Object.freeze({
      eventId: issueId(),
      jobId,
      recordedAt: new Date(now()).toISOString(),
      ...event
    });
    events.push(record);
    jobEvents.set(jobId, events);
    return record;
  }

  return Object.freeze({
    listCatalog({ category = null, query = '', limit = 50, offset = 0 } = {}) {
      const pageSize = Math.max(1, Math.min(Number(limit) || 50, MAX_PAGE_SIZE));
      const start = Math.max(0, Number(offset) || 0);
      const normalized = String(query).trim().toLocaleLowerCase('en-IN');
      const visible = [...appsById.values()].filter((app) => {
        if (category && app.category !== category) return false;
        if (!normalized) return true;
        return [app.name, app.category, app.description]
          .join(' ')
          .toLocaleLowerCase('en-IN')
          .includes(normalized);
      });
      return Object.freeze({
        total: visible.length,
        offset: start,
        limit: pageSize,
        apps: Object.freeze(visible.slice(start, start + pageSize).map(publicApp))
      });
    },

    getApp(appId) {
      const app = appsById.get(appId);
      if (!app) throw fail('app-not-found', 404);
      return publicApp(app);
    },

    resolveAction(query) {
      return Object.freeze(findActions(String(query || ''), 8));
    },

    authorizeDownload(context, { release, catalogManifest, packageKillSwitch = false, globalKillSwitch = false } = {}) {
      const actorId = requireActor(context);
      const decision = canServeDownload({ release, packageKillSwitch, globalKillSwitch });
      if (!decision.allowed) throw fail(decision.reason, 403, decision.details);

      const token = issueSecret();
      const tokenDigest = digest(token);
      const expiresAtMs = now() + DOWNLOAD_TTL_MS;
      const grant = Object.freeze({
        grantId: issueId(),
        actorId,
        requestId: context.requestId,
        packageId: release.packageId,
        versionCode: release.versionCode,
        apkSha256: release.apkSha256 || release.sha256,
        signerFingerprint: release.signerFingerprint,
        signingKeyId: release.signingKeyId,
        catalogVersion: catalogManifest?.catalogVersion || null,
        createdAt: new Date(now()).toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString(),
        consumedAt: null
      });
      downloadGrantsByDigest.set(tokenDigest, grant);
      return Object.freeze({
        token,
        expiresAt: grant.expiresAt,
        grantId: grant.grantId,
        downloadUrl: `${DOWNLOAD_ORIGIN}/v1/grants/${grant.grantId}/apk`
      });
    },

    consumeDownloadGrant(context, token) {
      const actorId = requireActor(context);
      const tokenDigest = digest(token || '');
      const grant = downloadGrantsByDigest.get(tokenDigest);
      if (!grant) throw fail('download-grant-not-found', 404);
      if (grant.actorId !== actorId) throw fail('download-grant-owner-mismatch', 403);
      if (grant.consumedAt) throw fail('download-grant-already-consumed', 409);
      if (Date.parse(grant.expiresAt) <= now()) throw fail('download-grant-expired', 410);

      const consumed = Object.freeze({ ...grant, consumedAt: new Date(now()).toISOString() });
      downloadGrantsByDigest.set(tokenDigest, consumed);
      return clone(consumed);
    },

    reportInstall(context, { installed = null, candidate, downloadedSha256, catalogManifest, deviceId } = {}) {
      const actorId = requireActor(context);
      if (!deviceId) throw fail('device-id-required', 400);
      const decision = verifyInstallCandidate({ installed, candidate, downloadedSha256, catalogManifest });
      if (!decision.allowed) throw fail('install-verification-failed', 422, decision.errors);

      const receipt = Object.freeze({
        receiptId: issueId(),
        actorId,
        deviceId,
        packageId: candidate.packageId,
        versionCode: candidate.versionCode,
        apkSha256: downloadedSha256.toLowerCase(),
        signerFingerprint: candidate.signerFingerprint,
        signingKeyId: candidate.signingKeyId,
        installedAt: new Date(now()).toISOString(),
        requestId: context.requestId
      });
      installReceipts.set(receipt.receiptId, receipt);
      return clone(receipt);
    },

    createJob(context, input = {}) {
      const actorId = requireActor(context);
      const job = {
        id: input.id || issueId(),
        ownerId: actorId,
        type: input.type,
        state: input.runAt && Date.parse(input.runAt) > now() ? 'scheduled' : 'queued',
        idempotencyKey: input.idempotencyKey,
        maxAttempts: input.maxAttempts ?? 5,
        createdAt: new Date(now()).toISOString(),
        runAt: input.runAt || null,
        sensitive: input.sensitive === true,
        approvalPolicy: input.sensitive === true ? 'explicit-user-or-authorized-owner' : 'not-required',
        payload: clone(input.payload || {}),
        payloadContainsSecrets: input.payloadContainsSecrets === true,
        unboundedExecution: input.unboundedExecution === true,
        attempt: 0,
        cancelledAt: null,
        completedAt: null
      };
      const validation = validateJobDefinition(job);
      if (!validation.valid) throw fail('invalid-job-definition', 422, validation.errors);

      const duplicate = [...jobs.values()].find((existing) =>
        existing.ownerId === actorId && existing.idempotencyKey === job.idempotencyKey
      );
      if (duplicate) return clone(duplicate);

      jobs.set(job.id, Object.freeze(job));
      appendJobEvent(job.id, { type: 'job-created', actorId, state: job.state });
      return clone(job);
    },

    getJob(context, jobId) {
      const actorId = requireActor(context);
      const job = jobs.get(jobId);
      if (!job) throw fail('job-not-found', 404);
      if (job.ownerId !== actorId && context.authorizedOwner !== true) throw fail('job-owner-mismatch', 403);
      return Object.freeze({ job: clone(job), events: Object.freeze(clone(jobEvents.get(jobId) || [])) });
    },

    transitionJob(context, jobId, nextState, metadata = {}) {
      const actorId = requireActor(context);
      const current = jobs.get(jobId);
      if (!current) throw fail('job-not-found', 404);
      if (current.ownerId !== actorId && context.authorizedOwner !== true) throw fail('job-owner-mismatch', 403);
      if (terminalState(current.state)) throw fail('job-already-terminal', 409);
      if (!canTransition(current.state, nextState)) throw fail('invalid-job-transition', 409);

      const updated = Object.freeze({
        ...current,
        state: nextState,
        cancelledAt: nextState === 'cancelled' ? new Date(now()).toISOString() : current.cancelledAt,
        completedAt: ['succeeded', 'failed', 'dead-lettered'].includes(nextState)
          ? new Date(now()).toISOString()
          : current.completedAt
      });
      jobs.set(jobId, updated);
      appendJobEvent(jobId, { type: 'job-transition', actorId, state: nextState, metadata: clone(metadata) });
      return clone(updated);
    }
  });
}

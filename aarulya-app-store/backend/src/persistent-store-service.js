import { randomUUID } from 'node:crypto';
import { createStoreService } from './store-service.js';
import { canServeDownload, verifyInstallCandidate } from '../../src/store-integrity.js';
import { canTransition, terminalState, validateJobDefinition } from '../../src/durable-jobs.js';

function fail(code, status = 400, details = undefined) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  if (details) error.details = details;
  return error;
}

function requireContext(context = {}) {
  if (!context.actorId) throw fail('authentication-required', 401);
  if (!context.requestId) throw fail('request-id-required');
  return context;
}

export function createPersistentStoreService({ catalog, storeRepository, jobRepository, now = () => Date.now() } = {}) {
  if (!storeRepository || !jobRepository) throw new Error('persistent-repositories-required');
  const actionService = createStoreService({ catalog, now });

  return Object.freeze({
    listCatalog: (input) => storeRepository.listCatalog(input),
    getApp: (appId) => storeRepository.getApp(appId),
    resolveAction: (query) => actionService.resolveAction(query),

    async authorizeDownload(context, { release, catalogManifest, packageKillSwitch, globalKillSwitch } = {}) {
      requireContext(context);
      const decision = canServeDownload({ release, packageKillSwitch, globalKillSwitch });
      if (!decision.allowed) throw fail(decision.reason, 403, decision.details);
      if (!context.idempotencyKey) throw fail('valid-idempotency-key-required');
      return storeRepository.createDownloadGrant({
        userId: context.actorId,
        devicePublicId: context.deviceId || null,
        release,
        requestId: context.requestId,
        idempotencyKey: context.idempotencyKey
      });
    },

    async consumeDownloadGrant(context, grantId, token) {
      requireContext(context);
      return storeRepository.consumeDownloadGrant({
        userId: context.actorId,
        grantId,
        token
      });
    },

    async reportInstall(context, {
      installed = null,
      candidate,
      downloadedSha256,
      catalogManifest,
      deviceId,
      idempotencyKey
    } = {}) {
      requireContext(context);
      if (!deviceId) throw fail('device-id-required');
      const decision = verifyInstallCandidate({ installed, candidate, downloadedSha256, catalogManifest });
      if (!decision.allowed) throw fail('install-verification-failed', 422, decision.errors);
      return storeRepository.recordInstall({
        userId: context.actorId,
        devicePublicId: deviceId,
        release: candidate,
        requestId: context.requestId,
        idempotencyKey,
        downloadedSha256: downloadedSha256.toLowerCase(),
        signerFingerprint: candidate.signerFingerprint
      });
    },

    async checkUpdate(context, input = {}) {
      requireContext(context);
      if (!input.deviceId || !input.packageId || !Number.isInteger(Number(input.installedVersionCode))) {
        throw fail('valid-update-check-required');
      }
      const packageKillSwitch = await storeRepository.isPackageDownloadDisabled(input.packageId);
      const globalKillSwitch = await storeRepository.isGlobalDownloadDisabled();
      if (packageKillSwitch || globalKillSwitch) {
        return Object.freeze({ decision: 'blocked', release: null });
      }
      const result = await storeRepository.checkUpdate({
        userId: context.actorId,
        devicePublicId: input.deviceId,
        packageId: input.packageId,
        installedVersionCode: Number(input.installedVersionCode),
        requestId: context.requestId
      });
      if (result.release) {
        const decision = canServeDownload({ release: result.release });
        if (!decision.allowed) return Object.freeze({ decision: 'blocked', release: null });
      }
      return result;
    },

    async createJob(context, input = {}) {
      requireContext(context);
      const job = {
        id: input.id || randomUUID(),
        ownerId: context.actorId,
        type: input.type,
        state: input.runAt && Date.parse(input.runAt) > now() ? 'scheduled' : 'queued',
        idempotencyKey: input.idempotencyKey,
        maxAttempts: input.maxAttempts ?? 5,
        createdAt: new Date(now()).toISOString(),
        runAt: input.runAt || null,
        sensitive: input.sensitive === true,
        approvalPolicy: input.sensitive === true ? 'explicit-user-or-authorized-owner' : 'not-required',
        payload: structuredClone(input.payload || {}),
        payloadContainsSecrets: input.payloadContainsSecrets === true,
        unboundedExecution: input.unboundedExecution === true,
        attempt: 0
      };
      const validation = validateJobDefinition(job);
      if (!validation.valid) throw fail('invalid-job-definition', 422, validation.errors);
      return jobRepository.create(context.actorId, job, context.requestId);
    },

    async getJob(context, jobId) {
      requireContext(context);
      return jobRepository.get(context.actorId, jobId);
    },

    async transitionJob(context, jobId, nextState, metadata = {}) {
      requireContext(context);
      const current = await jobRepository.get(context.actorId, jobId);
      if (terminalState(current.job.state)) throw fail('job-already-terminal', 409);
      if (!canTransition(current.job.state, nextState)) throw fail('invalid-job-transition', 409);
      return jobRepository.transition(context.actorId, jobId, nextState, context.requestId, metadata);
    }
  });
}

import { createServer } from 'node:http';
import { APP_CATALOG } from '../../src/catalog.js';
import { createHttpHandler } from './http-app.js';
import { createProductionComposition } from './production-composition.js';

const CANONICAL_API_ORIGIN = 'https://api.store.aarulya.com';
const CANONICAL_STOREFRONT_ORIGIN = 'https://store.aarulya.com';
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '127.0.0.1';
const publicOrigin = String(process.env.AARULYA_PUBLIC_ORIGIN || '').replace(/\/$/, '');
const privateContainerNetwork = process.env.AARULYA_PRIVATE_CONTAINER_NETWORK === 'true';

if (process.env.NODE_ENV !== 'production') {
  throw new Error('Aarulya Store API entrypoint is production-only; use tests for local validation');
}
if (publicOrigin !== CANONICAL_API_ORIGIN) throw new Error('canonical-api-origin-mismatch');
const allowedBind = host === '127.0.0.1' || host === '::1' || (privateContainerNetwork && host === '0.0.0.0');
if (!allowedBind) throw new Error('api-bind-must-be-loopback-or-declared-private-container-network');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('valid-api-port-required');

const composition = createProductionComposition({ catalog: APP_CATALOG });
const handler = createHttpHandler({
  service: composition.service,
  authenticate: composition.authenticate,
  releaseRepository: composition.storeRepository,
  releaseEnvelopeRepository: composition.releaseEnvelopeRepository,
  publicationService: composition.publicationService,
  allowedOrigins: [CANONICAL_STOREFRONT_ORIGIN]
});

const server = createServer(handler);
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;

server.listen(port, host, () => {
  console.log(`Aarulya Store API listening on ${host}:${port}`);
  console.log(`Canonical API origin: ${publicOrigin}`);
  console.log(`Allowed Store origin: ${CANONICAL_STOREFRONT_ORIGIN}`);
});

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`Received ${signal}; stopping Store API.`);
  const forceTimer = setTimeout(() => {
    console.error('Forced shutdown after grace period.');
    process.exit(1);
  }, 10_000).unref();

  server.close(async (error) => {
    try {
      await composition.close();
    } finally {
      clearTimeout(forceTimer);
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
    }
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

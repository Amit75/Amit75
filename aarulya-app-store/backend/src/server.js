import { createServer } from 'node:http';
import { APP_CATALOG } from '../../src/catalog.js';
import { createHttpHandler } from './http-app.js';
import { createStoreService } from './store-service.js';

const CANONICAL_API_ORIGIN = 'https://api.store.aarulya.com';
const CANONICAL_STOREFRONT_ORIGIN = 'https://store.aarulya.com';
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '127.0.0.1';
const production = process.env.NODE_ENV === 'production';
const publicOrigin = String(process.env.AARULYA_PUBLIC_ORIGIN || CANONICAL_API_ORIGIN).replace(/\/$/, '');

if (production && publicOrigin !== CANONICAL_API_ORIGIN) {
  throw new Error('canonical-api-origin-mismatch');
}

const configuredOrigins = String(process.env.AARULYA_ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);
const allowedOrigins = production
  ? [...new Set([CANONICAL_STOREFRONT_ORIGIN, ...configuredOrigins])]
  : configuredOrigins;

const service = createStoreService({ catalog: APP_CATALOG });

// Protected endpoints intentionally fail closed until a production identity verifier
// and release repository are injected by the deployment composition root.
const handler = createHttpHandler({
  service,
  allowedOrigins,
  authenticate: async () => null,
  releaseRepository: null
});

const server = createServer(handler);
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;

server.listen(port, host, () => {
  console.log(`Aarulya Store API foundation listening on ${host}:${port}`);
  console.log(`Canonical API origin: ${publicOrigin}`);
  console.log(`Allowed Store origin: ${CANONICAL_STOREFRONT_ORIGIN}`);
  console.log('Protected routes remain fail-closed until production auth and release repositories are configured.');
});

function shutdown(signal) {
  console.log(`Received ${signal}; stopping HTTP server.`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
  setTimeout(() => {
    console.error('Forced shutdown after grace period.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

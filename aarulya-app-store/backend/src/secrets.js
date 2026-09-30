import { readFileSync } from 'node:fs';

export function readSecret({ env = process.env, directName, fileName, minimumBytes = 1, maximumBytes = 64 * 1024 } = {}) {
  if (!directName || !fileName) throw new Error('secret-environment-names-required');
  const direct = String(env[directName] || '').trim();
  const file = String(env[fileName] || '').trim();
  if (direct && file) throw new Error(`${directName}-and-${fileName}-mutually-exclusive`);
  if (env.NODE_ENV === 'production' && direct) throw new Error(`${directName}-inline-production-secret-prohibited`);
  if (!direct && !file) throw new Error(`${directName}-or-${fileName}-required`);

  const value = file
    ? readFileSync(file, { encoding: 'utf8', flag: 'r' }).trim()
    : direct;
  const size = Buffer.byteLength(value, 'utf8');
  if (size < minimumBytes) throw new Error(`${fileName}-secret-too-short`);
  if (size > maximumBytes) throw new Error(`${fileName}-secret-too-large`);
  if (/\r|\n|\0/.test(value)) throw new Error(`${fileName}-single-line-secret-required`);
  return value;
}

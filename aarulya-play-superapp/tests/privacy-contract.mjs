import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const privacyPath = join(root, 'privacy.html');
assert.ok((await stat(privacyPath)).isFile(), 'privacy.html must exist.');

const [privacy, index, serviceWorker] = await Promise.all([
  readFile(privacyPath, 'utf8'),
  readFile(join(root, 'index.html'), 'utf8'),
  readFile(join(root, 'sw.js'), 'utf8')
]);

assert.match(index, /href="privacy\.html"/, 'The game arena must link to privacy and child-safety information.');
assert.match(serviceWorker, /\.\/privacy\.html/, 'The privacy page must be available in the offline app shell.');
assert.match(privacy, /Privacy & Child Safety/);
assert.match(privacy, /final production legal notice नहीं है/);
assert.match(privacy, /local storage/i);
assert.match(privacy, /backend user account, cloud sync/);
assert.match(privacy, /live advertising provider, analytics SDK/);
assert.match(privacy, /Precise location, contacts, camera, microphone/);
assert.match(privacy, /Virtual coins केवल non-cash/);
assert.match(privacy, /owner approval, test mode, age-aware consent/);
assert.match(privacy, /Final legal text को owner approval/);
assert.doesNotMatch(privacy, /(?:src|href)="https?:\/\//i, 'Privacy page must not require a remote runtime asset.');

console.log('Aarulya Play privacy and child-safety contract verification passed.');

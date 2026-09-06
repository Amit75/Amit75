import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const requiredFiles = [
  'index.html', 'learning.html', 'learning.css', 'manifest.webmanifest', 'sw.js',
  'src/learning-games.js', 'src/learning-app.js', 'src/pwa.js', 'scripts/serve.mjs'
];
for (const file of requiredFiles) assert.ok((await stat(join(root, file))).isFile(), `Missing required file: ${file}`);

const learningHtml = await readFile(join(root, 'learning.html'), 'utf8');
assert.match(learningHtml, /src\/learning-app\.js/);
assert.match(learningHtml, /manifest\.webmanifest/);
assert.doesNotMatch(learningHtml, /https?:\/\//i, 'Learning page must not require remote runtime assets.');

const manifest = JSON.parse(await readFile(join(root, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.categories.includes('education'));
assert.ok(manifest.categories.includes('games'));

const serviceWorker = await readFile(join(root, 'sw.js'), 'utf8');
for (const file of ['learning.html', 'src/learning-games.js', 'src/learning-app.js']) assert.ok(serviceWorker.includes(file));

console.log('Aarulya Play local/offline platform contract verification passed.');

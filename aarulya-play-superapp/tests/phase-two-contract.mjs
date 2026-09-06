import assert from 'node:assert/strict';
import { GAME_CATALOG } from '../src/game-catalog.js';
import { createPhaseTwoStarters } from '../src/phase-two-games.js';

const expectedPhaseTwo = [
  'block-puzzle',
  'goal-master',
  'color-dash',
  'memory-battle',
  'bubble-arena'
];

assert.equal(GAME_CATALOG.length, 40, 'The catalog must contain exactly 40 games.');

for (const gameId of expectedPhaseTwo) {
  const game = GAME_CATALOG.find((item) => item.id === gameId);
  assert.ok(game, `Missing game catalog entry: ${gameId}`);
  assert.equal(game.status, 'foundation', `${gameId} must be playable in this milestone.`);
}

const starters = createPhaseTwoStarters({
  battle: {},
  stage: {},
  footer: {},
  $: () => null,
  $$: () => [],
  setScores: () => {},
  finishBattle: () => {},
  startCountdown: () => () => {},
  setCleanup: () => {}
});

assert.deepEqual(Object.keys(starters).sort(), [...expectedPhaseTwo].sort());
for (const starter of Object.values(starters)) assert.equal(typeof starter, 'function');

console.log('Aarulya Play phase-two contract verification passed.');

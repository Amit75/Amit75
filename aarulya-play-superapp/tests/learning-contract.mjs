import assert from 'node:assert/strict';
import { LEARNING_GAMES, createLearningRound, getLearningGame, gradeAnswer } from '../src/learning-games.js';

const expected = ['quiz-junior', 'math-adventure', 'word-builder', 'robot-lab', 'school-adventure'];
assert.equal(LEARNING_GAMES.length, expected.length, 'Exactly five learning modules are required in this batch.');
assert.deepEqual(LEARNING_GAMES.map((game) => game.id).sort(), [...expected].sort());
assert.equal(new Set(LEARNING_GAMES.map((game) => game.id)).size, LEARNING_GAMES.length, 'Learning game IDs must be unique.');

for (const game of LEARNING_GAMES) {
  assert.equal(game.localOnly, true, `${game.id} must remain laptop/local capable.`);
  assert.equal(game.rewardType, 'virtual', `${game.id} must not promise cash rewards.`);
  assert.ok(game.questions.length >= 8, `${game.id} needs at least eight questions.`);
  for (const question of game.questions) {
    assert.ok(question.prompt.length >= 5, `${game.id} contains an invalid prompt.`);
    assert.equal(question.options.length, 4, `${game.id} questions must have four options.`);
    assert.ok(Number.isInteger(question.answerIndex) && question.answerIndex >= 0 && question.answerIndex < 4);
    assert.ok(question.explanation.length >= 5, `${game.id} needs an explanation for each answer.`);
    assert.equal(gradeAnswer(question, question.answerIndex).correct, true);
  }
  const round = createLearningRound(game.id, 5, () => 0.5);
  assert.equal(round.length, 5);
  assert.equal(getLearningGame(game.id)?.id, game.id);
}

console.log('Aarulya Play learning contract verification passed.');

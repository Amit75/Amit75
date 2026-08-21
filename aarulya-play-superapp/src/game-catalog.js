export const GAME_CATALOG = Object.freeze([
  { id: 'metro-dash', name: 'Aarulya Metro Dash', engine: 'runner', flagship: true, status: 'foundation', age: '7+', mode: 'solo-battle', durationSeconds: 90 },
  { id: 'cricket-strike', name: 'Aarulya Cricket Strike', engine: 'sports', flagship: true, status: 'foundation', age: '7+', mode: 'score-battle', durationSeconds: 120 },
  { id: 'hill-rider', name: 'Aarulya Hill Rider', engine: 'physics-racing', flagship: true, status: 'foundation', age: '7+', mode: 'time-trial', durationSeconds: 120 },
  { id: 'chaupar-battle', name: 'Aarulya Chaupar Battle', engine: 'board', flagship: true, status: 'foundation', age: '7+', mode: 'turn-battle', durationSeconds: 240 },
  { id: 'carrom-strike', name: 'Aarulya Carrom Strike', engine: 'physics-aim', flagship: true, status: 'foundation', age: '7+', mode: 'score-battle', durationSeconds: 150 },
  { id: 'block-puzzle', name: 'Aarulya Block Puzzle', engine: 'puzzle', flagship: false, status: 'planned', age: '5+', mode: 'score-battle', durationSeconds: 180 },
  { id: 'goal-master', name: 'Aarulya Goal Master', engine: 'sports', flagship: false, status: 'planned', age: '7+', mode: 'five-round-battle', durationSeconds: 90 },
  { id: 'neon-stack', name: 'Aarulya Neon Stack', engine: 'timing', flagship: false, status: 'planned', age: '5+', mode: 'score-battle', durationSeconds: 90 },
  { id: 'color-dash', name: 'Aarulya Color Dash', engine: 'reflex', flagship: false, status: 'planned', age: '5+', mode: 'round-battle', durationSeconds: 75 },
  { id: 'memory-battle', name: 'Aarulya Memory Battle', engine: 'memory', flagship: false, status: 'planned', age: '5+', mode: 'time-battle', durationSeconds: 120 },
  { id: 'bubble-arena', name: 'Aarulya Bubble Arena', engine: 'aim-match', flagship: false, status: 'planned', age: '5+', mode: 'score-battle', durationSeconds: 150 },
  { id: 'quiz-junior', name: 'Aarulya Quiz Junior', engine: 'quiz', flagship: false, status: 'planned', age: '7+', mode: 'ten-question-battle', durationSeconds: 180 },
  { id: 'snake-ladder-adventure', name: 'Aarulya Snake Ladder Adventure', engine: 'board-adventure', flagship: false, status: 'planned', age: '5+', mode: 'turn-battle', durationSeconds: 240 },
  { id: 'traffic-escape', name: 'Aarulya Traffic Escape', engine: 'traffic-puzzle', flagship: false, status: 'planned', age: '7+', mode: 'time-battle', durationSeconds: 150 },
  { id: 'fruit-blast', name: 'Aarulya Fruit Blast', engine: 'match', flagship: false, status: 'planned', age: '5+', mode: 'score-battle', durationSeconds: 120 },
  { id: 'number-merge', name: 'Aarulya Number Merge', engine: 'number-puzzle', flagship: false, status: 'planned', age: '7+', mode: 'score-battle', durationSeconds: 180 },
  { id: 'basketball-shot', name: 'Aarulya Basketball Shot', engine: 'sports-aim', flagship: false, status: 'planned', age: '7+', mode: 'ten-shot-battle', durationSeconds: 90 },
  { id: 'treasure-tower', name: 'Aarulya Treasure Tower', engine: 'risk-puzzle', flagship: false, status: 'planned', age: '7+', mode: 'level-battle', durationSeconds: 150 },
  { id: 'pattern-recall', name: 'Aarulya Pattern Recall', engine: 'memory-reflex', flagship: false, status: 'planned', age: '5+', mode: 'round-battle', durationSeconds: 90 },
  { id: 'mini-bike-sprint', name: 'Aarulya Mini Bike Sprint', engine: 'racing', flagship: false, status: 'planned', age: '7+', mode: 'time-trial', durationSeconds: 120 }
]);

export function getGame(gameId) {
  return GAME_CATALOG.find((game) => game.id === gameId) ?? null;
}

export function getFlagshipGames() {
  return GAME_CATALOG.filter((game) => game.flagship);
}

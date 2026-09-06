export const GAME_CATALOG = Object.freeze([
  { id: 'metro-dash', name: 'Aarulya Metro Dash', engine: 'runner', flagship: true, status: 'foundation', age: '7+', mode: 'solo-battle', durationSeconds: 90 },
  { id: 'cricket-strike', name: 'Aarulya Cricket Strike', engine: 'sports', flagship: true, status: 'foundation', age: '7+', mode: 'score-battle', durationSeconds: 120 },
  { id: 'hill-rider', name: 'Aarulya Hill Rider', engine: 'physics-racing', flagship: true, status: 'foundation', age: '7+', mode: 'time-trial', durationSeconds: 120 },
  { id: 'chaupar-battle', name: 'Aarulya Chaupar Battle', engine: 'board', flagship: true, status: 'foundation', age: '7+', mode: 'turn-battle', durationSeconds: 240 },
  { id: 'carrom-strike', name: 'Aarulya Carrom Strike', engine: 'physics-aim', flagship: true, status: 'foundation', age: '7+', mode: 'score-battle', durationSeconds: 150 },
  { id: 'block-puzzle', name: 'Aarulya Block Puzzle', engine: 'puzzle', flagship: false, status: 'foundation', age: '5+', mode: 'score-battle', durationSeconds: 180 },
  { id: 'goal-master', name: 'Aarulya Goal Master', engine: 'sports', flagship: false, status: 'foundation', age: '7+', mode: 'five-round-battle', durationSeconds: 90 },
  { id: 'neon-stack', name: 'Aarulya Neon Stack', engine: 'timing', flagship: false, status: 'planned', age: '5+', mode: 'score-battle', durationSeconds: 90 },
  { id: 'color-dash', name: 'Aarulya Color Dash', engine: 'reflex', flagship: false, status: 'foundation', age: '5+', mode: 'round-battle', durationSeconds: 75 },
  { id: 'memory-battle', name: 'Aarulya Memory Battle', engine: 'memory', flagship: false, status: 'foundation', age: '5+', mode: 'time-battle', durationSeconds: 120 },
  { id: 'bubble-arena', name: 'Aarulya Bubble Arena', engine: 'aim-match', flagship: false, status: 'foundation', age: '5+', mode: 'score-battle', durationSeconds: 150 },
  { id: 'quiz-junior', name: 'Aarulya Quiz Junior', engine: 'quiz', flagship: false, status: 'planned', age: '7+', mode: 'ten-question-battle', durationSeconds: 180 },
  { id: 'snake-ladder-adventure', name: 'Aarulya Snake Ladder Adventure', engine: 'board-adventure', flagship: false, status: 'planned', age: '5+', mode: 'turn-battle', durationSeconds: 240 },
  { id: 'traffic-escape', name: 'Aarulya Traffic Escape', engine: 'traffic-puzzle', flagship: false, status: 'planned', age: '7+', mode: 'time-battle', durationSeconds: 150 },
  { id: 'fruit-blast', name: 'Aarulya Fruit Blast', engine: 'match', flagship: false, status: 'planned', age: '5+', mode: 'score-battle', durationSeconds: 120 },
  { id: 'number-merge', name: 'Aarulya Number Merge', engine: 'number-puzzle', flagship: false, status: 'planned', age: '7+', mode: 'score-battle', durationSeconds: 180 },
  { id: 'basketball-shot', name: 'Aarulya Basketball Shot', engine: 'sports-aim', flagship: false, status: 'planned', age: '7+', mode: 'ten-shot-battle', durationSeconds: 90 },
  { id: 'treasure-tower', name: 'Aarulya Treasure Tower', engine: 'risk-puzzle', flagship: false, status: 'planned', age: '7+', mode: 'level-battle', durationSeconds: 150 },
  { id: 'pattern-recall', name: 'Aarulya Pattern Recall', engine: 'memory-reflex', flagship: false, status: 'planned', age: '5+', mode: 'round-battle', durationSeconds: 90 },
  { id: 'mini-bike-sprint', name: 'Aarulya Mini Bike Sprint', engine: 'racing', flagship: false, status: 'planned', age: '7+', mode: 'time-trial', durationSeconds: 120 },
  { id: 'craft-world', name: 'Aarulya Craft World', engine: 'sandbox-builder', flagship: false, status: 'planned', age: '7+', mode: 'creative-missions', durationSeconds: 300 },
  { id: 'obstacle-party', name: 'Aarulya Obstacle Party', engine: 'party-platformer', flagship: false, status: 'planned', age: '7+', mode: 'elimination-rounds', durationSeconds: 180 },
  { id: 'pet-town', name: 'Aarulya Pet Town', engine: 'pet-simulation', flagship: false, status: 'planned', age: '5+', mode: 'care-missions', durationSeconds: 180 },
  { id: 'farm-builder', name: 'Aarulya Farm Builder', engine: 'farm-simulation', flagship: false, status: 'planned', age: '7+', mode: 'build-missions', durationSeconds: 240 },
  { id: 'cooking-rush', name: 'Aarulya Cooking Rush', engine: 'time-management', flagship: false, status: 'planned', age: '7+', mode: 'order-challenge', durationSeconds: 150 },
  { id: 'fashion-studio', name: 'Aarulya Fashion Studio', engine: 'customization', flagship: false, status: 'planned', age: '7+', mode: 'design-challenge', durationSeconds: 180 },
  { id: 'drawing-quest', name: 'Aarulya Drawing Quest', engine: 'creative-drawing', flagship: false, status: 'planned', age: '5+', mode: 'drawing-missions', durationSeconds: 180 },
  { id: 'math-adventure', name: 'Aarulya Math Adventure', engine: 'learning-puzzle', flagship: false, status: 'planned', age: '7+', mode: 'level-challenge', durationSeconds: 150 },
  { id: 'hide-seek-party', name: 'Aarulya Hide & Seek Party', engine: 'party-stealth', flagship: false, status: 'planned', age: '7+', mode: 'bot-party', durationSeconds: 180 },
  { id: 'monster-merge', name: 'Aarulya Monster Merge', engine: 'merge-puzzle', flagship: false, status: 'planned', age: '5+', mode: 'score-battle', durationSeconds: 150 },
  { id: 'water-sort', name: 'Aarulya Water Sort', engine: 'sorting-puzzle', flagship: false, status: 'planned', age: '7+', mode: 'level-puzzle', durationSeconds: 150 },
  { id: 'word-builder', name: 'Aarulya Word Builder', engine: 'word-learning', flagship: false, status: 'planned', age: '7+', mode: 'word-challenge', durationSeconds: 150 },
  { id: 'space-explorer', name: 'Aarulya Space Explorer', engine: 'space-arcade', flagship: false, status: 'planned', age: '7+', mode: 'mission-run', durationSeconds: 180 },
  { id: 'robot-lab', name: 'Aarulya Robot Lab', engine: 'logic-coding', flagship: false, status: 'planned', age: '7+', mode: 'logic-missions', durationSeconds: 180 },
  { id: 'city-driver', name: 'Aarulya City Driver', engine: 'driving-simulation', flagship: false, status: 'planned', age: '7+', mode: 'delivery-missions', durationSeconds: 240 },
  { id: 'school-adventure', name: 'Aarulya School Adventure', engine: 'school-simulation', flagship: false, status: 'planned', age: '7+', mode: 'safe-story-missions', durationSeconds: 240 },
  { id: 'music-beat', name: 'Aarulya Music Beat', engine: 'rhythm', flagship: false, status: 'planned', age: '7+', mode: 'beat-challenge', durationSeconds: 120 },
  { id: 'home-designer', name: 'Aarulya Home Designer', engine: 'interior-design', flagship: false, status: 'planned', age: '7+', mode: 'design-missions', durationSeconds: 240 },
  { id: 'rescue-heroes', name: 'Aarulya Rescue Heroes', engine: 'rescue-simulation', flagship: false, status: 'planned', age: '7+', mode: 'team-missions', durationSeconds: 180 },
  { id: 'dino-park', name: 'Aarulya Dino Park', engine: 'park-management', flagship: false, status: 'planned', age: '7+', mode: 'care-and-build', durationSeconds: 240 }
]);

export function getGame(gameId) {
  return GAME_CATALOG.find((game) => game.id === gameId) ?? null;
}

export function getFlagshipGames() {
  return GAME_CATALOG.filter((game) => game.flagship);
}

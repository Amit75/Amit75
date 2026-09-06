import { LEARNING_GAMES, createLearningRound, gradeAnswer } from './learning-games.js';

const STORAGE_KEY = 'aarulya-play-learning-progress-v1';
const grid = document.querySelector('#learningGrid');
const dialog = document.querySelector('#learningDialog');
const title = document.querySelector('#learningTitle');
const category = document.querySelector('#learningCategory');
const questionText = document.querySelector('#questionText');
const optionGrid = document.querySelector('#optionGrid');
const feedback = document.querySelector('#learningFeedback');
const scoreText = document.querySelector('#learningScore');
const progressText = document.querySelector('#learningProgress');
const closeButton = document.querySelector('#closeLearning');
const nextButton = document.querySelector('#nextQuestion');
const resetButton = document.querySelector('#resetLearningProgress');
const summary = document.querySelector('#learningSummary');

let activeGame = null;
let round = [];
let questionIndex = 0;
let roundScore = 0;
let answered = false;

function loadProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      completedRounds: Math.max(0, Number(value.completedRounds) || 0),
      totalCorrect: Math.max(0, Number(value.totalCorrect) || 0),
      bestScores: value.bestScores && typeof value.bestScores === 'object' ? value.bestScores : {}
    };
  } catch {
    return { completedRounds: 0, totalCorrect: 0, bestScores: {} };
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function renderSummary() {
  const progress = loadProgress();
  summary.textContent = `${progress.completedRounds} rounds • ${progress.totalCorrect} correct answers`;
}

function renderCards() {
  const progress = loadProgress();
  grid.innerHTML = LEARNING_GAMES.map((game) => `
    <article class="learning-card">
      <span class="learning-icon" aria-hidden="true">${game.icon}</span>
      <p class="eyebrow">${game.category.toUpperCase()} • ${game.age}</p>
      <h2>${game.name}</h2>
      <p>${game.description}</p>
      <div class="learning-card-meta"><span>${game.questions.length} questions</span><span>Best ${progress.bestScores[game.id] || 0}/100</span></div>
      <button type="button" class="primary" data-learning-game="${game.id}">Start learning round</button>
    </article>`).join('');

  document.querySelectorAll('[data-learning-game]').forEach((button) => {
    button.addEventListener('click', () => startRound(button.dataset.learningGame));
  });
}

function startRound(gameId) {
  activeGame = LEARNING_GAMES.find((game) => game.id === gameId);
  if (!activeGame) return;
  round = [...createLearningRound(gameId, 5)];
  questionIndex = 0;
  roundScore = 0;
  answered = false;
  title.textContent = activeGame.name;
  category.textContent = activeGame.category;
  dialog.showModal();
  renderQuestion();
}

function renderQuestion() {
  const question = round[questionIndex];
  answered = false;
  feedback.textContent = 'एक उत्तर चुनें।';
  feedback.className = 'learning-feedback';
  nextButton.hidden = true;
  questionText.textContent = question.prompt;
  scoreText.textContent = `${roundScore} points`;
  progressText.textContent = `${questionIndex + 1} / ${round.length}`;
  optionGrid.innerHTML = question.options.map((option, index) => `
    <button type="button" class="answer-option" data-answer-index="${index}">${option}</button>`).join('');

  optionGrid.querySelectorAll('[data-answer-index]').forEach((button) => {
    button.addEventListener('click', () => answerQuestion(Number(button.dataset.answerIndex)));
  });
}

function answerQuestion(selectedIndex) {
  if (answered) return;
  answered = true;
  const question = round[questionIndex];
  const result = gradeAnswer(question, selectedIndex);
  roundScore += result.points;
  scoreText.textContent = `${roundScore} points`;

  optionGrid.querySelectorAll('[data-answer-index]').forEach((button) => {
    const index = Number(button.dataset.answerIndex);
    button.disabled = true;
    if (index === result.correctIndex) button.classList.add('correct');
    if (index === selectedIndex && !result.correct) button.classList.add('wrong');
  });

  feedback.textContent = `${result.correct ? 'सही उत्तर।' : 'यह उत्तर सही नहीं है।'} ${result.explanation}`;
  feedback.className = `learning-feedback ${result.correct ? 'success' : 'error'}`;
  nextButton.textContent = questionIndex + 1 === round.length ? 'Finish round' : 'Next question';
  nextButton.hidden = false;
}

function finishRound() {
  const progress = loadProgress();
  const correct = Math.round(roundScore / 20);
  progress.completedRounds += 1;
  progress.totalCorrect += correct;
  progress.bestScores[activeGame.id] = Math.max(progress.bestScores[activeGame.id] || 0, roundScore);
  saveProgress(progress);

  questionText.textContent = 'Round completed';
  optionGrid.innerHTML = '';
  feedback.textContent = `${correct}/${round.length} सही • ${roundScore}/100 points. Progress इस laptop/browser में सुरक्षित है।`;
  feedback.className = 'learning-feedback success';
  progressText.textContent = 'Complete';
  nextButton.textContent = 'Close';
  nextButton.hidden = false;
  renderCards();
  renderSummary();
}

nextButton.addEventListener('click', () => {
  if (questionIndex + 1 < round.length) {
    questionIndex += 1;
    renderQuestion();
    return;
  }
  if (progressText.textContent === 'Complete') dialog.close();
  else finishRound();
});

closeButton.addEventListener('click', () => dialog.close());
resetButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  renderCards();
  renderSummary();
});

dialog.addEventListener('close', () => {
  activeGame = null;
  round = [];
});

renderCards();
renderSummary();

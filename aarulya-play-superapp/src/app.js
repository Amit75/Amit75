import { GAME_CATALOG, getGame } from './game-catalog.js';
import { BattleEngine } from './battle-engine.js';
import { createPhaseTwoStarters } from './phase-two-games.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const battle = new BattleEngine();

const art = {
  runner: ['#0f2a5f', '#6d28d9', '🏃'],
  sports: ['#075985', '#065f46', '🏏'],
  'physics-racing': ['#7c2d12', '#1e3a8a', '🏍️'],
  board: ['#78350f', '#7e22ce', '🎲'],
  'physics-aim': ['#92400e', '#0f766e', '◉'],
  puzzle: ['#3730a3', '#0f766e', '▦'],
  timing: ['#581c87', '#1e293b', '▰'],
  reflex: ['#be123c', '#1d4ed8', '◆'],
  memory: ['#166534', '#4338ca', '🧠'],
  'aim-match': ['#0369a1', '#9333ea', '●'],
  quiz: ['#9a3412', '#1d4ed8', '?'],
  'board-adventure': ['#4d7c0f', '#7c2d12', '↗'],
  'traffic-puzzle': ['#991b1b', '#1e40af', '🚦'],
  match: ['#be123c', '#ca8a04', '✦'],
  'number-puzzle': ['#115e59', '#4338ca', '2048'],
  'sports-aim': ['#c2410c', '#1e3a8a', '🏀'],
  'risk-puzzle': ['#854d0e', '#6b21a8', '🏰'],
  'memory-reflex': ['#0f766e', '#7e22ce', '◎'],
  racing: ['#9f1239', '#1d4ed8', '🏁']
};

const descriptions = {
  'metro-dash': 'तीन lanes में dodge करें, city obstacles बचाएँ और bot से ज्यादा score बनाएँ।',
  'cricket-strike': 'Timing meter पर सही hit लगाकर छह balls में highest score बनाएँ।',
  'hill-rider': 'Speed और balance संभालते हुए hill track पूरा करें।',
  'chaupar-battle': 'Quick board race में dice roll करके bot से पहले finish तक पहुँचें।',
  'carrom-strike': 'Aim और power balance करके पांच shots में pockets score करें।',
  'block-puzzle': 'Pieces रखें, rows और columns clear करें और bot score को beat करें।',
  'goal-master': 'पांच penalty shots में सही goal zones चुनकर match जीतें।',
  'color-dash': 'Hindi colour prompt देखकर सही tile पर तेज tap करें।',
  'memory-battle': 'Cards पलटकर matching pairs खोजें और समय के भीतर board पूरा करें।',
  'bubble-arena': 'एक जैसे जुड़े bubbles pop करके combo score बनाएँ।'
};

const arena = $('#arena');
const stage = $('#gameStage');
const footer = $('#arenaFooter');
const timerEl = $('#timer');
const playerScoreEl = $('#playerScore');
const botScoreEl = $('#botScore');
const toastEl = $('#toast');
let cleanup = () => {};

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  window.setTimeout(() => toastEl.classList.remove('show'), 1900);
}

function renderProfile() {
  const profile = battle.getProfile();
  $('#rank').textContent = profile.rank;
  $('#coins').textContent = profile.virtualCoins.toLocaleString('en-IN');
  $('#xp').textContent = profile.xp.toLocaleString('en-IN');
  $('#wins').textContent = profile.wins;
  $('#losses').textContent = profile.losses;
  $('#matches').textContent = profile.completedMatches;
  const daily = Math.min(profile.dailyCompleted, 3);
  $('#missionText').textContent = `${daily} / 3`;
  $('#missionBar').style.width = `${daily / 3 * 100}%`;
}

function renderCatalog(filter = 'all') {
  const grid = $('#gameGrid');
  const games = GAME_CATALOG.filter((game) => {
    if (filter === 'flagship') return game.flagship;
    if (filter === 'planned') return game.status === 'planned';
    return true;
  });

  grid.innerHTML = games.map((game) => {
    const [c1, c2, symbol] = art[game.engine] || ['#1e293b', '#4c1d95', 'A'];
    const playable = game.status === 'foundation';
    return `
      <article class="game-card ${playable ? '' : 'coming'}">
        <div class="game-art" style="--art1:${c1};--art2:${c2}"><span class="game-symbol">${symbol}</span></div>
        <div class="game-body">
          <div class="game-meta"><span>${game.engine.toUpperCase()}</span><span>${game.durationSeconds / 60} MIN</span></div>
          <h3>${game.name}</h3>
          <p>${descriptions[game.id] || 'Original Aarulya game module with independent rules, levels and visual identity.'}</p>
          <button class="play-button" data-open-game="${game.id}" ${playable ? '' : 'disabled'}>${playable ? 'Battle शुरू करें' : 'Production queue'}</button>
        </div>
      </article>`;
  }).join('');

  $$('[data-open-game]').forEach((button) => button.addEventListener('click', () => openGame(button.dataset.openGame)));
}

function setScores(player, bot) {
  playerScoreEl.textContent = String(Math.max(0, Math.floor(player)));
  botScoreEl.textContent = String(Math.max(0, Math.floor(bot)));
}

function openGame(gameId) {
  const game = getGame(gameId);
  if (!game || game.status !== 'foundation') return;

  cleanup();
  battle.activeMatch = null;
  $('#arenaTitle').textContent = game.name;
  $('#arenaEngine').textContent = `${game.engine.toUpperCase()} • BOT BATTLE`;
  setScores(0, 0);
  timerEl.textContent = 'Ready';
  stage.innerHTML = '';
  footer.innerHTML = '';
  arena.showModal();

  const phaseTwo = createPhaseTwoStarters({
    battle,
    stage,
    footer,
    $,
    $$,
    setScores,
    finishBattle,
    startCountdown,
    setCleanup: (handler) => { cleanup = handler; }
  });

  const starters = {
    'metro-dash': startMetroDash,
    'cricket-strike': startCricketStrike,
    'hill-rider': startHillRider,
    'chaupar-battle': startChaupar,
    'carrom-strike': startCarrom,
    ...phaseTwo
  };

  const starter = starters[gameId];
  if (!starter) {
    toast('यह game अभी production queue में है।');
    arena.close();
    return;
  }
  starter(game);
}

function finishBattle(playerScore, botScore, message) {
  if (!battle.activeMatch) return;
  battle.activeMatch.playerScore = Math.max(0, Math.floor(playerScore));
  battle.setOpponentScore(botScore);
  setScores(playerScore, botScore);
  const receipt = battle.finishMatch();
  timerEl.textContent = receipt.result.toUpperCase();
  stage.innerHTML = `
    <div class="battle-card">
      <p class="eyebrow">MATCH ${receipt.result.toUpperCase()}</p>
      <h3>${playerScore} — ${botScore}</h3>
      <p>${message}</p>
      <p>+${receipt.rewards.xp} XP • +${receipt.rewards.virtualCoins} virtual coins${receipt.rewards.dailyMissionReward ? ` • Daily bonus +${receipt.rewards.dailyMissionReward}` : ''}</p>
    </div>`;
  footer.innerHTML = '<button type="button" class="action-button" id="closeResult">Arena बंद करें</button>';
  $('#closeResult').addEventListener('click', () => arena.close());
  renderProfile();
}

function startCountdown(seconds, onTick, onEnd) {
  let left = seconds;
  timerEl.textContent = `${left}s`;
  const id = window.setInterval(() => {
    left -= 1;
    timerEl.textContent = `${Math.max(left, 0)}s`;
    onTick?.(left);
    if (left <= 0) {
      window.clearInterval(id);
      onEnd();
    }
  }, 1000);
  return () => window.clearInterval(id);
}

function startMetroDash(game) {
  battle.startMatch({ gameId: game.id, durationSeconds: 30 });
  let playerLane = 1;
  let obstacleLane = -1;
  let score = 0;
  let botScore = 0;
  let ended = false;

  stage.innerHTML = `
    <div class="battle-card">
      <p>Obstacle जिस lane में आए, उससे अलग lane tap करें।</p>
      <div class="tap-grid" id="laneGrid">
        <button data-lane="0">LEFT</button><button data-lane="1">CENTER</button><button data-lane="2">RIGHT</button>
      </div>
      <p id="dashStatus">Race शुरू हो गई</p>
    </div>`;

  const laneButtons = $$('[data-lane]', stage);
  const status = $('#dashStatus');
  laneButtons[1].style.outline = '3px solid #67e8f9';

  laneButtons.forEach((button) => button.addEventListener('click', () => {
    playerLane = Number(button.dataset.lane);
    laneButtons.forEach((item) => item.style.outline = 'none');
    button.style.outline = '3px solid #67e8f9';
  }));

  const obstacleTimer = window.setInterval(() => {
    if (ended) return;
    obstacleLane = Math.floor(Math.random() * 3);
    laneButtons.forEach((button, index) => {
      button.textContent = index === obstacleLane ? '🚧' : ['LEFT', 'CENTER', 'RIGHT'][index];
      button.style.background = index === obstacleLane ? '#fb718533' : '#ffffff0b';
    });

    window.setTimeout(() => {
      if (ended) return;
      if (playerLane === obstacleLane) {
        score = Math.max(0, score - 7);
        status.textContent = 'Obstacle hit: -7';
      } else {
        score += 10;
        status.textContent = 'Clean dodge: +10';
      }
      botScore += 5 + Math.floor(Math.random() * 8);
      setScores(score, botScore);
    }, 500);
  }, 950);

  const stopClock = startCountdown(30, null, () => {
    ended = true;
    window.clearInterval(obstacleTimer);
    finishBattle(score, botScore, 'Metro Dash quick battle पूरा हुआ।');
  });

  cleanup = () => { ended = true; stopClock(); window.clearInterval(obstacleTimer); battle.activeMatch = null; };
}

function startCricketStrike(game) {
  battle.startMatch({ gameId: game.id, durationSeconds: 90 });
  let ball = 0;
  let player = 0;
  let bot = 0;
  let pin = 0;
  let direction = 1;
  let raf = 0;

  stage.innerHTML = `
    <div class="battle-card">
      <p>Yellow pin को green timing zone में रोकें। कुल 6 balls.</p>
      <div class="meter"><i class="meter-zone"></i><i class="meter-pin" id="cricketPin"></i></div>
      <h3 id="ballText">Ball 1 / 6</h3>
      <button type="button" class="primary" id="hitBall">HIT</button>
      <p id="shotText">Perfect timing पर 6 runs</p>
    </div>`;

  const pinEl = $('#cricketPin');
  const shotText = $('#shotText');
  function animate() {
    pin += direction * 1.45;
    if (pin >= 98 || pin <= 0) direction *= -1;
    pinEl.style.left = `${pin}%`;
    raf = requestAnimationFrame(animate);
  }
  animate();

  $('#hitBall').addEventListener('click', () => {
    if (ball >= 6) return;
    const distance = Math.abs(pin - 50);
    const runs = distance <= 5 ? 6 : distance <= 11 ? 4 : distance <= 20 ? 2 : distance <= 30 ? 1 : 0;
    player += runs;
    bot += [0, 1, 2, 4, 6][Math.floor(Math.random() * 5)];
    ball += 1;
    setScores(player, bot);
    shotText.textContent = runs ? `${runs} RUNS!` : 'Dot ball';
    $('#ballText').textContent = ball < 6 ? `Ball ${ball + 1} / 6` : 'Innings complete';
    if (ball === 6) {
      cancelAnimationFrame(raf);
      window.setTimeout(() => finishBattle(player, bot, 'Six-ball Cricket Strike battle पूरा हुआ।'), 500);
    }
  });

  cleanup = () => { cancelAnimationFrame(raf); battle.activeMatch = null; };
}

function startHillRider(game) {
  battle.startMatch({ gameId: game.id, durationSeconds: 35 });
  let distance = 0;
  let botDistance = 0;
  let speed = 0;
  let balance = 50;
  let ended = false;
  let accelerate = false;
  let brake = false;

  stage.innerHTML = `
    <div class="race-track">
      <p>Accelerate करें, लेकिन balance 15–85 के बीच रखें।</p>
      <div class="track"><i class="racer" id="youRider">🏍️</i></div>
      <div class="track"><i class="racer" id="botRider">🤖</i></div>
      <div class="meter"><i class="meter-zone" style="left:15%;width:70%"></i><i class="meter-pin" id="balancePin"></i></div>
      <p>Speed: <b id="speedText">0</b> • Balance: <b id="balanceText">50</b></p>
    </div>`;
  footer.innerHTML = '<button type="button" class="action-button" id="brake">Brake</button><button type="button" class="primary" id="accelerate">Accelerate</button>';

  const bindHold = (element, setter) => {
    element.addEventListener('pointerdown', () => setter(true));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((event) => element.addEventListener(event, () => setter(false)));
  };
  bindHold($('#accelerate'), (value) => accelerate = value);
  bindHold($('#brake'), (value) => brake = value);

  const physics = window.setInterval(() => {
    if (ended) return;
    speed += accelerate ? 3.1 : -1.25;
    if (brake) speed -= 4;
    speed = Math.max(0, Math.min(38, speed));
    balance += (Math.random() - .5) * (2 + speed / 7) + (brake ? (50 - balance) * .08 : 0);
    if (balance < 15 || balance > 85) {
      speed *= .5;
      balance = Math.max(10, Math.min(90, balance));
    }
    distance += speed * .095;
    botDistance += 2.25 + Math.random() * 1.2;
    const youPercent = Math.min(91, distance / 100 * 91);
    const botPercent = Math.min(91, botDistance / 100 * 91);
    $('#youRider').style.left = `${youPercent}%`;
    $('#botRider').style.left = `${botPercent}%`;
    $('#balancePin').style.left = `${balance}%`;
    $('#speedText').textContent = speed.toFixed(0);
    $('#balanceText').textContent = balance.toFixed(0);
    setScores(distance, botDistance);
    if (distance >= 100 || botDistance >= 100) end();
  }, 180);

  const stopClock = startCountdown(35, null, () => end());
  function end() {
    if (ended) return;
    ended = true;
    window.clearInterval(physics);
    stopClock();
    finishBattle(Math.floor(distance), Math.floor(botDistance), 'Hill Rider distance battle पूरा हुआ।');
  }

  cleanup = () => { ended = true; window.clearInterval(physics); stopClock(); battle.activeMatch = null; };
}

function startChaupar(game) {
  battle.startMatch({ gameId: game.id, durationSeconds: 120 });
  let player = 0;
  let bot = 0;
  let locked = false;
  const target = 30;

  stage.innerHTML = `
    <div class="board-progress">
      <p>30 घरों की quick Chaupar race. पहले finish पर पहुँचने वाला winner.</p>
      <div class="board-row"><b>You</b><span class="board-line"><i id="playerLine" style="width:0"></i></span><strong id="playerPos">0</strong></div>
      <div class="board-row"><b>Bot</b><span class="board-line"><i id="botLine" style="width:0"></i></span><strong id="botPos">0</strong></div>
      <div class="battle-card"><h3 id="diceResult">🎲</h3><button type="button" class="primary" id="rollDice">ROLL DICE</button></div>
    </div>`;

  $('#rollDice').addEventListener('click', () => {
    if (locked || player >= target || bot >= target) return;
    locked = true;
    const playerDice = 1 + Math.floor(Math.random() * 6);
    player = Math.min(target, player + playerDice);
    $('#diceResult').textContent = `You rolled ${playerDice}`;
    update();

    window.setTimeout(() => {
      const botDice = 1 + Math.floor(Math.random() * 6);
      bot = Math.min(target, bot + botDice);
      $('#diceResult').textContent += ` • Bot ${botDice}`;
      update();
      locked = false;
      if (player >= target || bot >= target) finishBattle(player, bot, 'Quick Chaupar race पूरी हुई।');
    }, 550);
  });

  function update() {
    $('#playerLine').style.width = `${player / target * 100}%`;
    $('#botLine').style.width = `${bot / target * 100}%`;
    $('#playerPos').textContent = player;
    $('#botPos').textContent = bot;
    setScores(player, bot);
  }

  cleanup = () => { battle.activeMatch = null; };
}

function startCarrom(game) {
  battle.startMatch({ gameId: game.id, durationSeconds: 90 });
  let shots = 0;
  let player = 0;
  let bot = 0;
  let aim = 50;
  let direction = 1;
  let raf = 0;

  stage.innerHTML = `
    <div class="battle-card">
      <p>Moving aim pin को center pocket line के पास रोकें। पांच shots.</p>
      <div class="carrom-board"><i class="pocket p1"></i><i class="pocket p2"></i><i class="pocket p3"></i><i class="pocket p4"></i><i class="coin-dot"></i><i class="striker" id="striker"></i></div>
      <div class="meter" style="margin:18px auto"><i class="meter-zone"></i><i class="meter-pin" id="aimPin"></i></div>
      <p id="carromText">Shot 1 / 5</p>
      <button type="button" class="primary" id="takeShot">STRIKE</button>
    </div>`;

  const aimPin = $('#aimPin');
  function animate() {
    aim += direction * 1.25;
    if (aim >= 98 || aim <= 0) direction *= -1;
    aimPin.style.left = `${aim}%`;
    raf = requestAnimationFrame(animate);
  }
  animate();

  $('#takeShot').addEventListener('click', () => {
    if (shots >= 5) return;
    const distance = Math.abs(aim - 50);
    const score = distance <= 5 ? 20 : distance <= 12 ? 10 : distance <= 22 ? 5 : 0;
    player += score;
    bot += [0, 5, 10, 20][Math.floor(Math.random() * 4)];
    shots += 1;
    setScores(player, bot);
    $('#striker').style.transform = `translate(${(aim - 50) * 2}px,-150px)`;
    window.setTimeout(() => $('#striker').style.transform = 'translate(0,0)', 350);
    $('#carromText').textContent = shots < 5 ? `Shot ${shots + 1} / 5 • Last +${score}` : `Five shots complete • Last +${score}`;
    if (shots === 5) {
      cancelAnimationFrame(raf);
      window.setTimeout(() => finishBattle(player, bot, 'Five-shot Carrom Strike battle पूरा हुआ।'), 500);
    }
  });

  cleanup = () => { cancelAnimationFrame(raf); battle.activeMatch = null; };
}

$$('.filter').forEach((button) => button.addEventListener('click', () => {
  $$('.filter').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  renderCatalog(button.dataset.filter);
}));

$('#playFeatured').addEventListener('click', () => openGame('metro-dash'));
arena.addEventListener('close', () => { cleanup(); cleanup = () => {}; stage.innerHTML = ''; footer.innerHTML = ''; });

renderCatalog();
renderProfile();

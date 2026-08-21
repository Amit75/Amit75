export function createPhaseTwoStarters({
  battle,
  stage,
  footer,
  $,
  $$,
  setScores,
  finishBattle,
  startCountdown,
  setCleanup
}) {
  function startBlockPuzzle(game) {
    battle.startMatch({ gameId: game.id, durationSeconds: 60 });
    const size = 6;
    const board = Array.from({ length: size }, () => Array(size).fill(0));
    const shapes = [
      [[0, 0]],
      [[0, 0], [0, 1]],
      [[0, 0], [1, 0]],
      [[0, 0], [0, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1]],
      [[0, 0], [0, 1], [1, 0], [1, 1]]
    ];
    let activeShape = shapes[Math.floor(Math.random() * shapes.length)];
    let player = 0;
    let bot = 0;
    let ended = false;

    stage.innerHTML = `
      <div class="battle-card">
        <p>Piece को grid पर रखें। पूरी row या column clear होने पर bonus मिलेगा।</p>
        <div class="piece-preview" id="piecePreview"></div>
        <div class="block-board" id="blockBoard"></div>
        <p id="blockStatus">खाली cell चुनें</p>
      </div>`;

    const boardEl = $('#blockBoard');
    const preview = $('#piecePreview');
    const status = $('#blockStatus');

    function chooseShape() {
      activeShape = shapes[Math.floor(Math.random() * shapes.length)];
      preview.innerHTML = activeShape.map(() => '<i></i>').join('');
      preview.style.setProperty('--piece-count', String(activeShape.length));
    }

    function clearLines() {
      let cleared = 0;
      for (let row = 0; row < size; row += 1) {
        if (board[row].every(Boolean)) {
          board[row].fill(0);
          cleared += 1;
        }
      }
      for (let col = 0; col < size; col += 1) {
        if (board.every((row) => row[col])) {
          for (let row = 0; row < size; row += 1) board[row][col] = 0;
          cleared += 1;
        }
      }
      if (cleared) player += cleared * 40;
      return cleared;
    }

    function render() {
      boardEl.innerHTML = board.flatMap((row, r) => row.map((value, c) =>
        `<button type="button" class="block-cell ${value ? 'filled' : ''}" data-row="${r}" data-col="${c}" aria-label="Block cell ${r + 1}, ${c + 1}"></button>`
      )).join('');
      $$('[data-row]', boardEl).forEach((button) => button.addEventListener('click', () => place(
        Number(button.dataset.row),
        Number(button.dataset.col)
      )));
      setScores(player, bot);
    }

    function place(row, col) {
      if (ended) return;
      const cells = activeShape.map(([dr, dc]) => [row + dr, col + dc]);
      const valid = cells.every(([r, c]) => r >= 0 && r < size && c >= 0 && c < size && !board[r][c]);
      if (!valid) {
        status.textContent = 'यहाँ piece fit नहीं होगा';
        return;
      }
      cells.forEach(([r, c]) => { board[r][c] = 1; });
      player += activeShape.length * 5;
      bot += 5 + Math.floor(Math.random() * 14);
      const lines = clearLines();
      status.textContent = lines ? `${lines} line clear!` : `+${activeShape.length * 5} points`;
      chooseShape();
      render();
    }

    const stopClock = startCountdown(60, null, () => {
      ended = true;
      finishBattle(player, bot, 'Block Puzzle score battle पूरा हुआ।');
    });

    chooseShape();
    render();
    setCleanup(() => { ended = true; stopClock(); battle.activeMatch = null; });
  }

  function startGoalMaster(game) {
    battle.startMatch({ gameId: game.id, durationSeconds: 90 });
    const zones = ['↖', '↑', '↗', '←', '●', '→', '↙', '↓', '↘'];
    let shots = 0;
    let player = 0;
    let bot = 0;
    let locked = false;

    stage.innerHTML = `
      <div class="battle-card">
        <p>Goal zone चुनें। पांच penalties में bot से ज्यादा goals करें।</p>
        <div class="goal-grid">${zones.map((zone, index) => `<button type="button" data-goal-zone="${index}">${zone}</button>`).join('')}</div>
        <p id="goalMessage">Shot 1 / 5</p>
      </div>`;

    const message = $('#goalMessage');
    $$('[data-goal-zone]', stage).forEach((button) => button.addEventListener('click', () => {
      if (locked || shots >= 5) return;
      locked = true;
      const shot = Number(button.dataset.goalZone);
      const keeper = Math.floor(Math.random() * zones.length);
      const botShot = Math.random() > 0.34;
      const scored = shot !== keeper;
      if (scored) player += 1;
      if (botShot) bot += 1;
      shots += 1;
      setScores(player, bot);
      message.textContent = scored
        ? `GOAL! Keeper ${zones[keeper]} गया • ${shots}/5`
        : `SAVED! Keeper ने ${zones[keeper]} cover किया • ${shots}/5`;
      button.classList.add(scored ? 'success' : 'miss');
      window.setTimeout(() => {
        button.classList.remove('success', 'miss');
        locked = false;
        if (shots === 5) finishBattle(player, bot, 'Five-shot Goal Master battle पूरा हुआ।');
      }, 480);
    }));

    setCleanup(() => { battle.activeMatch = null; });
  }

  function startColorDash(game) {
    battle.startMatch({ gameId: game.id, durationSeconds: 45 });
    const palette = [
      { name: 'लाल', value: '#fb7185' },
      { name: 'नीला', value: '#38bdf8' },
      { name: 'हरा', value: '#4ade80' },
      { name: 'पीला', value: '#fde047' },
      { name: 'बैंगनी', value: '#c084fc' },
      { name: 'नारंगी', value: '#fb923c' }
    ];
    let target = palette[0];
    let player = 0;
    let bot = 0;
    let ended = false;

    stage.innerHTML = `
      <div class="battle-card">
        <p>ऊपर लिखा colour पहचानकर सही tile tap करें।</p>
        <h3 id="colorTarget" class="color-target"></h3>
        <div id="colorGrid" class="color-grid"></div>
        <p id="colorMessage">सही colour चुनें</p>
      </div>`;

    function nextRound() {
      target = palette[Math.floor(Math.random() * palette.length)];
      const displayInk = palette[Math.floor(Math.random() * palette.length)].value;
      $('#colorTarget').textContent = target.name;
      $('#colorTarget').style.color = displayInk;
      $('#colorGrid').innerHTML = [...palette]
        .sort(() => Math.random() - .5)
        .map((color) => `<button type="button" data-color="${color.name}" style="--tile:${color.value}" aria-label="${color.name}"></button>`)
        .join('');
      $$('[data-color]', stage).forEach((button) => button.addEventListener('click', () => {
        if (ended) return;
        if (button.dataset.color === target.name) {
          player += 10;
          $('#colorMessage').textContent = 'Correct +10';
        } else {
          player = Math.max(0, player - 4);
          $('#colorMessage').textContent = 'Wrong -4';
        }
        bot += 5 + Math.floor(Math.random() * 7);
        setScores(player, bot);
        nextRound();
      }));
    }

    const stopClock = startCountdown(45, null, () => {
      ended = true;
      finishBattle(player, bot, 'Color Dash reflex battle पूरा हुआ।');
    });

    nextRound();
    setCleanup(() => { ended = true; stopClock(); battle.activeMatch = null; });
  }

  function startMemoryBattle(game) {
    battle.startMatch({ gameId: game.id, durationSeconds: 75 });
    const symbols = ['🐯', '🦚', '🐘', '🦋', '🚀', '⭐', '🍉', '🎨'];
    const deck = [...symbols, ...symbols].sort(() => Math.random() - .5);
    let open = [];
    const matched = new Set();
    let player = 0;
    let bot = 0;
    let locked = false;
    let ended = false;

    stage.innerHTML = `
      <div class="battle-card">
        <p>दो समान cards मिलाएँ। सभी pairs मिलने या समय पूरा होने पर result आएगा।</p>
        <div id="memoryGrid" class="memory-grid"></div>
        <p id="memoryMessage">पहला card चुनें</p>
      </div>`;

    function render() {
      $('#memoryGrid').innerHTML = deck.map((symbol, index) => {
        const visible = matched.has(index) || open.includes(index);
        return `<button type="button" data-memory="${index}" class="${matched.has(index) ? 'matched' : ''}">${visible ? symbol : 'A'}</button>`;
      }).join('');
      $$('[data-memory]', stage).forEach((button) => button.addEventListener('click', () => flip(Number(button.dataset.memory))));
    }

    function flip(index) {
      if (ended || locked || open.includes(index) || matched.has(index)) return;
      open.push(index);
      render();
      if (open.length < 2) return;
      locked = true;
      const [a, b] = open;
      if (deck[a] === deck[b]) {
        matched.add(a);
        matched.add(b);
        player += 20;
        bot += 6 + Math.floor(Math.random() * 10);
        $('#memoryMessage').textContent = 'Pair matched +20';
        open = [];
        locked = false;
        setScores(player, bot);
        render();
        if (matched.size === deck.length) {
          ended = true;
          stopClock();
          finishBattle(player + 25, bot, 'Memory Battle के सभी pairs पूरे हुए।');
        }
      } else {
        $('#memoryMessage').textContent = 'Pair नहीं मिला';
        window.setTimeout(() => {
          open = [];
          locked = false;
          bot += 8;
          setScores(player, bot);
          render();
        }, 650);
      }
    }

    const stopClock = startCountdown(75, null, () => {
      if (ended) return;
      ended = true;
      finishBattle(player, bot, 'Memory Battle समय पूरा हुआ।');
    });

    render();
    setCleanup(() => { ended = true; stopClock(); battle.activeMatch = null; });
  }

  function startBubbleArena(game) {
    battle.startMatch({ gameId: game.id, durationSeconds: 60 });
    const rows = 7;
    const cols = 7;
    const colors = ['pink', 'cyan', 'green', 'yellow', 'violet'];
    const grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => colors[Math.floor(Math.random() * colors.length)])
    );
    let player = 0;
    let bot = 0;
    let ended = false;

    stage.innerHTML = `
      <div class="battle-card">
        <p>एक ही colour के जुड़े bubbles का group tap करें। दो या अधिक bubbles पर score मिलेगा।</p>
        <div id="bubbleGrid" class="bubble-grid"></div>
        <p id="bubbleMessage">Group चुनें</p>
      </div>`;

    function neighbours(r, c) {
      return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([nr, nc]) => nr >= 0 && nr < rows && nc >= 0 && nc < cols);
    }

    function groupAt(row, col) {
      const color = grid[row][col];
      if (!color) return [];
      const stack = [[row, col]];
      const seen = new Set([`${row}:${col}`]);
      while (stack.length) {
        const [r, c] = stack.pop();
        neighbours(r, c).forEach(([nr, nc]) => {
          const key = `${nr}:${nc}`;
          if (!seen.has(key) && grid[nr][nc] === color) {
            seen.add(key);
            stack.push([nr, nc]);
          }
        });
      }
      return [...seen].map((key) => key.split(':').map(Number));
    }

    function collapse() {
      for (let c = 0; c < cols; c += 1) {
        const values = [];
        for (let r = rows - 1; r >= 0; r -= 1) if (grid[r][c]) values.push(grid[r][c]);
        for (let r = rows - 1, i = 0; r >= 0; r -= 1, i += 1) {
          grid[r][c] = values[i] || colors[Math.floor(Math.random() * colors.length)];
        }
      }
    }

    function render() {
      $('#bubbleGrid').innerHTML = grid.flatMap((row, r) => row.map((color, c) =>
        `<button type="button" class="bubble ${color}" data-bubble-row="${r}" data-bubble-col="${c}" aria-label="${color} bubble"></button>`
      )).join('');
      $$('[data-bubble-row]', stage).forEach((button) => button.addEventListener('click', () => pop(
        Number(button.dataset.bubbleRow),
        Number(button.dataset.bubbleCol)
      )));
    }

    function pop(row, col) {
      if (ended) return;
      const group = groupAt(row, col);
      if (group.length < 2) {
        $('#bubbleMessage').textContent = 'कम से कम 2 जुड़े bubbles चाहिए';
        return;
      }
      group.forEach(([r, c]) => { grid[r][c] = null; });
      const points = group.length * group.length;
      player += points;
      bot += 5 + Math.floor(Math.random() * 18);
      $('#bubbleMessage').textContent = `${group.length} bubbles • +${points}`;
      collapse();
      setScores(player, bot);
      render();
    }

    const stopClock = startCountdown(60, null, () => {
      ended = true;
      finishBattle(player, bot, 'Bubble Arena score battle पूरा हुआ।');
    });

    render();
    setCleanup(() => { ended = true; stopClock(); battle.activeMatch = null; });
  }

  return {
    'block-puzzle': startBlockPuzzle,
    'goal-master': startGoalMaster,
    'color-dash': startColorDash,
    'memory-battle': startMemoryBattle,
    'bubble-arena': startBubbleArena
  };
}

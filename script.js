const DIFFICULTIES = {
  rookie: { label: "Rookie", max: 25, lives: 6, baseScore: 900 },
  classic: { label: "Classic", max: 100, lives: 7, baseScore: 1800 },
  expert: { label: "Expert", max: 500, lives: 8, baseScore: 3600 },
  nightmare: { label: "Nightmare", max: 1000, lives: 9, baseScore: 7000 }
};

const ACHIEVEMENTS = [
  { id: "firstWin", icon: "🏁", title: "First Victory", desc: "Win your first round." },
  { id: "sharp", icon: "🎯", title: "Sharp Shooter", desc: "Win in 3 attempts or fewer." },
  { id: "survivor", icon: "🔥", title: "Last Heart", desc: "Win with only 1 energy left." },
  { id: "streak3", icon: "⚡", title: "Triple Streak", desc: "Win 3 games in a row." },
  { id: "nightmare", icon: "👑", title: "Nightmare Crown", desc: "Beat Nightmare mode." }
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const els = {
  body: document.body,
  guessInput: $("#guessInput"),
  guessBtn: $("#guessBtn"),
  resetBtn: $("#resetBtn"),
  hintBtn: $("#hintBtn"),
  revealBtn: $("#revealBtn"),
  themeToggle: $("#themeToggle"),
  musicToggle: $("#musicToggle"),
  soundToggle: $("#soundToggle"),
  bgMusic: $("#bgMusic"),
  clickSound: $("#clickSound"),
  winSound: $("#winSound"),
  rangeText: $("#rangeText"),
  rangeMin: $("#rangeMin"),
  rangeMax: $("#rangeMax"),
  rangeWindow: $("#rangeWindow"),
  guessMarker: $("#guessMarker"),
  livesContainer: $("#livesContainer"),
  attemptsText: $("#attemptsText"),
  accuracyText: $("#accuracyText"),
  liveScore: $("#liveScore"),
  message: $("#message"),
  hint: $("#hint"),
  messageBox: $("#messageBox"),
  heatFill: $("#heatFill"),
  oracleLine: $("#oracleLine"),
  coreSymbol: $("#coreSymbol"),
  coreStatus: $("#coreStatus"),
  possibleRange: $("#possibleRange"),
  bestNextGuess: $("#bestNextGuess"),
  patternText: $("#patternText"),
  confidenceText: $("#confidenceText"),
  riskTag: $("#riskTag"),
  aiInsight: $("#aiInsight"),
  guessHistory: $("#guessHistory"),
  historyCount: $("#historyCount"),
  achievements: $("#achievements"),
  achievementProgress: $("#achievementProgress"),
  leaderboardList: $("#leaderboardList"),
  clearLeaderboard: $("#clearLeaderboard"),
  gamesPlayed: $("#gamesPlayed"),
  winsCount: $("#winsCount"),
  winStreak: $("#winStreak"),
  bestScore: $("#bestScore"),
  winModal: $("#winModal"),
  closeModal: $("#closeModal"),
  finalResult: $("#finalResult"),
  playerName: $("#playerName"),
  saveScoreBtn: $("#saveScoreBtn")
};

let state = {
  difficulty: "classic",
  secret: 0,
  attempts: 0,
  lives: 7,
  maxLives: 7,
  max: 100,
  gameOver: false,
  hasWon: false,
  lowBound: 1,
  highBound: 100,
  guesses: [],
  soundOn: true,
  musicOn: false,
  currentScore: 0
};

let stats = JSON.parse(localStorage.getItem("neonOracleStats")) || {
  games: 0,
  wins: 0,
  streak: 0,
  bestScore: 0,
  achievements: {}
};

let leaderboard = JSON.parse(localStorage.getItem("neonOracleLeaderboard")) || [];

function saveStats() {
  localStorage.setItem("neonOracleStats", JSON.stringify(stats));
}

function saveLeaderboard() {
  localStorage.setItem("neonOracleLeaderboard", JSON.stringify(leaderboard));
}

function play(sound) {
  if (!state.soundOn || !sound) return;
  try {
    sound.currentTime = 0;
    sound.play().catch(() => {});
  } catch (_) {}
}

function randomSecret(max) {
  return Math.floor(Math.random() * max) + 1;
}

function setupDifficulty(difficulty) {
  const config = DIFFICULTIES[difficulty];
  state.difficulty = difficulty;
  state.max = config.max;
  state.maxLives = config.lives;
  state.lives = config.lives;
  state.lowBound = 1;
  state.highBound = config.max;

  els.guessInput.min = 1;
  els.guessInput.max = config.max;
  els.guessInput.placeholder = `1–${config.max}`;
  els.rangeMin.textContent = "1";
  els.rangeMax.textContent = config.max;
  els.rangeText.textContent = `Number range: 1–${config.max}`;

  $$(".difficulty-card").forEach(card => {
    card.classList.toggle("active", card.dataset.difficulty === difficulty);
  });
}

function resetGame() {
  setupDifficulty(state.difficulty);
  state.secret = randomSecret(state.max);
  state.attempts = 0;
  state.gameOver = false;
  state.hasWon = false;
  state.guesses = [];
  state.currentScore = 0;

  els.guessInput.value = "";
  els.message.textContent = "Ready.";
  els.hint.textContent = "The Oracle is waiting for your first move.";
  els.oracleLine.textContent = "Choose your number and launch your first guess.";
  els.coreSymbol.textContent = "?";
  els.coreStatus.textContent = "LOCKED";
  els.heatFill.style.width = "0%";
  els.guessMarker.style.opacity = "0";
  els.messageBox.classList.remove("shake");
  closeModal();
  renderAll();
  els.guessInput.focus();
}

function getScore() {
  if (!state.hasWon) return 0;
  const config = DIFFICULTIES[state.difficulty];
  const efficiency = Math.max(0, config.baseScore - (state.attempts - 1) * 125);
  const lifeBonus = state.lives * 140;
  const difficultyBonus = Math.round(Math.log10(state.max) * 250);
  return Math.max(100, efficiency + lifeBonus + difficultyBonus);
}

function checkGuess() {
  if (state.gameOver) return;

  const guess = Number(els.guessInput.value);
  if (!Number.isInteger(guess) || guess < 1 || guess > state.max) {
    showMessage("Invalid launch.", `Enter a whole number between 1 and ${state.max}.`, true);
    return;
  }

  if (state.guesses.some(item => item.value === guess)) {
    showMessage("Duplicate signal.", "You already tried that number. Choose a different one.", true);
    return;
  }

  play(els.clickSound);

  state.attempts += 1;
  const relation = guess === state.secret ? "correct" : guess < state.secret ? "low" : "high";
  const distance = Math.abs(state.secret - guess);
  const heat = calculateHeat(distance);
  state.guesses.push({ value: guess, relation, heat });

  if (guess < state.secret) state.lowBound = Math.max(state.lowBound, guess + 1);
  if (guess > state.secret) state.highBound = Math.min(state.highBound, guess - 1);

  updateGuessMarker(guess);
  els.heatFill.style.width = `${heat}%`;

  if (relation === "correct") {
    winGame();
  } else {
    state.lives -= 1;
    const direction = relation === "low" ? "Too low." : "Too high.";
    if (state.lives <= 0) {
      loseGame();
    } else {
      showMessage(`${relation === "low" ? "📉" : "📈"} ${direction}`, buildSmartHint(guess, relation, distance));
      els.oracleLine.textContent = heat >= 80 ? "The Oracle is burning hot. You are close." :
        heat >= 45 ? "Signal detected. Keep narrowing the range." :
        "Cold signal. Recalculate your next move.";
    }
  }

  els.guessInput.value = "";
  renderAll();
}

function calculateHeat(distance) {
  const normalized = Math.max(0, 1 - distance / state.max);
  return Math.round(normalized * 100);
}

function showMessage(title, text, bad = false) {
  els.message.textContent = title;
  els.hint.textContent = text;
  if (bad) {
    els.messageBox.classList.remove("shake");
    void els.messageBox.offsetWidth;
    els.messageBox.classList.add("shake");
  }
}

function buildSmartHint(guess, relation, distance) {
  const clues = [];
  clues.push(`AI range narrowed: ${state.lowBound}–${state.highBound}.`);

  if (distance <= Math.max(3, Math.round(state.max * 0.04))) {
    clues.push("Heat level: extremely close.");
  } else if (distance <= Math.max(8, Math.round(state.max * 0.12))) {
    clues.push("Heat level: warm.");
  } else {
    clues.push("Heat level: cold.");
  }

  if (state.attempts >= 2) {
    const lastTwo = state.guesses.slice(-2);
    const pattern = lastTwo.map(g => g.relation).join(" → ");
    clues.push(`Pattern: ${pattern}.`);
  }

  if (state.attempts >= 3) {
    clues.push(state.secret % 2 === 0 ? "Secret parity: even." : "Secret parity: odd.");
  }

  if (state.attempts >= 4) {
    if (state.secret % 5 === 0) clues.push("Secret is divisible by 5.");
    else clues.push("Secret is not divisible by 5.");
  }

  const best = bestNextGuess();
  clues.push(`Recommended next guess: ${best}.`);
  return clues.join(" ");
}

function askOracle() {
  play(els.clickSound);
  if (state.gameOver) {
    showMessage("Round ended.", "Start a new round to ask the Oracle again.");
    return;
  }

  const best = bestNextGuess();
  const width = state.highBound - state.lowBound + 1;
  let clue = `The smartest next guess is ${best}. Current possible zone is ${state.lowBound}–${state.highBound}.`;

  if (state.attempts >= 1) {
    clue += state.secret > best ? " My hidden signal is above that midpoint." : " My hidden signal is below or near that midpoint.";
  }

  if (width <= Math.max(5, Math.ceil(state.max * 0.08))) {
    clue += " The search zone is tiny now. Make a precise move.";
  }

  showMessage("🧠 Oracle Hint", clue);
  els.oracleLine.textContent = "The Oracle has calculated your next best move.";
}

function bestNextGuess() {
  return Math.floor((state.lowBound + state.highBound) / 2);
}

function winGame() {
  state.gameOver = true;
  state.hasWon = true;
  state.currentScore = getScore();
  stats.games += 1;
  stats.wins += 1;
  stats.streak += 1;
  stats.bestScore = Math.max(stats.bestScore, state.currentScore);
  unlock("firstWin");
  if (state.attempts <= 3) unlock("sharp");
  if (state.lives === 1) unlock("survivor");
  if (stats.streak >= 3) unlock("streak3");
  if (state.difficulty === "nightmare") unlock("nightmare");
  saveStats();

  els.coreSymbol.textContent = state.secret;
  els.coreStatus.textContent = "UNLOCKED";
  showMessage("🎉 Correct! You cracked the Oracle.", `Score ${state.currentScore}. Attempts ${state.attempts}. Energy left ${state.lives}.`);
  els.oracleLine.textContent = "Victory signal confirmed. The hidden number has been revealed.";
  play(els.winSound);
  launchConfetti();
  document.querySelector(".game-card").classList.add("win-flash");
  setTimeout(() => document.querySelector(".game-card").classList.remove("win-flash"), 1300);
  openModal();
}

function loseGame() {
  state.gameOver = true;
  state.hasWon = false;
  stats.games += 1;
  stats.streak = 0;
  saveStats();

  els.coreSymbol.textContent = state.secret;
  els.coreStatus.textContent = "REVEALED";
  showMessage("💀 Energy depleted.", `The hidden number was ${state.secret}. Start a new round and defeat the Oracle.`);
  els.oracleLine.textContent = "Signal failed. The Oracle has revealed the answer.";
}

function revealNumber() {
  if (state.gameOver) return;
  play(els.clickSound);
  state.lives = 0;
  loseGame();
  renderAll();
}

function unlock(id) {
  stats.achievements[id] = true;
}

function openModal() {
  els.finalResult.textContent = `Score: ${state.currentScore} • ${DIFFICULTIES[state.difficulty].label} • ${state.attempts} attempts`;
  els.winModal.classList.add("show");
  els.winModal.setAttribute("aria-hidden", "false");
  setTimeout(() => els.playerName.focus(), 50);
}

function closeModal() {
  els.winModal.classList.remove("show");
  els.winModal.setAttribute("aria-hidden", "true");
}

function saveScore() {
  const name = els.playerName.value.trim() || "Anonymous";
  leaderboard.push({
    name,
    score: state.currentScore,
    attempts: state.attempts,
    difficulty: DIFFICULTIES[state.difficulty].label,
    date: new Date().toLocaleDateString()
  });
  leaderboard.sort((a, b) => b.score - a.score || a.attempts - b.attempts);
  leaderboard = leaderboard.slice(0, 12);
  saveLeaderboard();
  closeModal();
  renderLeaderboard();
}

function clearLeaderboard() {
  play(els.clickSound);
  leaderboard = [];
  saveLeaderboard();
  renderLeaderboard();
}

function updateGuessMarker(guess) {
  const percent = ((guess - 1) / (state.max - 1)) * 100;
  els.guessMarker.style.left = `${Math.min(100, Math.max(0, percent))}%`;
  els.guessMarker.style.opacity = "1";
}

function renderAll() {
  renderLives();
  renderStats();
  renderRangeWindow();
  renderAI();
  renderHistory();
  renderAchievements();
  renderLeaderboard();
}

function renderLives() {
  els.livesContainer.innerHTML = "";
  for (let i = 0; i < state.maxLives; i += 1) {
    const dot = document.createElement("span");
    if (i >= state.lives) dot.classList.add("lost");
    els.livesContainer.appendChild(dot);
  }
  els.attemptsText.textContent = state.attempts;
  const total = state.attempts + state.lives;
  els.accuracyText.textContent = total ? `${Math.round((state.lives / total) * 100)}%` : "—";
  els.liveScore.textContent = state.hasWon ? state.currentScore : Math.max(0, DIFFICULTIES[state.difficulty].baseScore - state.attempts * 125 + state.lives * 80);
}

function renderStats() {
  els.gamesPlayed.textContent = stats.games;
  els.winsCount.textContent = stats.wins;
  els.winStreak.textContent = stats.streak;
  els.bestScore.textContent = stats.bestScore;
}

function renderRangeWindow() {
  const left = ((state.lowBound - 1) / (state.max - 1)) * 100;
  const right = ((state.highBound - 1) / (state.max - 1)) * 100;
  els.rangeWindow.style.left = `${Math.max(0, left)}%`;
  els.rangeWindow.style.width = `${Math.max(1, right - left)}%`;
  els.possibleRange.textContent = `${state.lowBound}–${state.highBound}`;
  els.rangeMin.textContent = state.lowBound;
  els.rangeMax.textContent = state.highBound;
}

function renderAI() {
  const width = state.highBound - state.lowBound + 1;
  const confidence = Math.round((1 - (width / state.max)) * 100);
  const last = state.guesses[state.guesses.length - 1];
  let pattern = "None";
  if (state.guesses.length >= 2) {
    pattern = state.guesses.slice(-3).map(g => g.relation === "low" ? "Low" : g.relation === "high" ? "High" : "Hit").join(" → ");
  } else if (last) {
    pattern = last.relation === "low" ? "Low" : last.relation === "high" ? "High" : "Hit";
  }

  els.bestNextGuess.textContent = bestNextGuess();
  els.patternText.textContent = pattern;
  els.confidenceText.textContent = `${confidence}%`;

  if (confidence >= 80) {
    els.riskTag.textContent = "Locked In";
    els.aiInsight.textContent = "The possible range is very small. Use the midpoint strategy and finish the round.";
  } else if (confidence >= 45) {
    els.riskTag.textContent = "Tracking";
    els.aiInsight.textContent = "The Oracle is narrowing the target. Your next guess should split the remaining range.";
  } else {
    els.riskTag.textContent = "Scanning";
    els.aiInsight.textContent = "Early stage. Use broad midpoint guesses to cut the search space quickly.";
  }
}

function renderHistory() {
  els.guessHistory.innerHTML = "";
  els.historyCount.textContent = `${state.guesses.length} move${state.guesses.length === 1 ? "" : "s"}`;

  if (!state.guesses.length) {
    const empty = document.createElement("span");
    empty.className = "guess-chip";
    empty.textContent = "No moves yet";
    els.guessHistory.appendChild(empty);
    return;
  }

  state.guesses.forEach(item => {
    const chip = document.createElement("span");
    chip.className = `guess-chip ${item.relation}`;
    const arrow = item.relation === "low" ? "↑" : item.relation === "high" ? "↓" : "✓";
    chip.textContent = `${item.value} ${arrow}`;
    chip.title = `Heat ${item.heat}%`;
    els.guessHistory.appendChild(chip);
  });
}

function renderAchievements() {
  els.achievements.innerHTML = "";
  let unlocked = 0;

  ACHIEVEMENTS.forEach(achievement => {
    const isUnlocked = Boolean(stats.achievements[achievement.id]);
    if (isUnlocked) unlocked += 1;

    const item = document.createElement("div");
    item.className = `achievement ${isUnlocked ? "unlocked" : ""}`;
    item.innerHTML = `
      <div class="achievement-icon">${achievement.icon}</div>
      <div>
        <strong>${achievement.title}</strong>
        <small>${achievement.desc}</small>
      </div>
    `;
    els.achievements.appendChild(item);
  });

  els.achievementProgress.textContent = `${unlocked}/${ACHIEVEMENTS.length}`;
}

function renderLeaderboard() {
  els.leaderboardList.innerHTML = "";
  if (!leaderboard.length) {
    const empty = document.createElement("div");
    empty.className = "leaderboard-item";
    empty.innerHTML = `<div class="rank">—</div><div><strong>No scores yet</strong><small>Win a round to appear here.</small></div><div class="leaderboard-score">0</div>`;
    els.leaderboardList.appendChild(empty);
    return;
  }

  leaderboard.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-item";
    row.innerHTML = `
      <div class="rank">${index + 1}</div>
      <div>
        <strong>${escapeHTML(entry.name)}</strong>
        <small>${entry.difficulty} • ${entry.attempts} attempts • ${entry.date}</small>
      </div>
      <div class="leaderboard-score">${entry.score}</div>
    `;
    els.leaderboardList.appendChild(row);
  });
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function toggleTheme() {
  const isLight = els.body.classList.toggle("light");
  els.body.classList.toggle("dark", !isLight);
  els.themeToggle.textContent = isLight ? "☀️" : "🌙";
  localStorage.setItem("neonOracleTheme", isLight ? "light" : "dark");
}

function toggleMusic() {
  state.musicOn = !state.musicOn;
  if (state.musicOn) {
    els.bgMusic.volume = 0.38;
    els.bgMusic.play().catch(() => {});
    els.musicToggle.textContent = "🔊";
  } else {
    els.bgMusic.pause();
    els.musicToggle.textContent = "🔇";
  }
}

function toggleSound() {
  state.soundOn = !state.soundOn;
  els.soundToggle.textContent = state.soundOn ? "🔔" : "🔕";
}

function launchConfetti() {
  const canvas = $("#confettiCanvas");
  const ctx = canvas.getContext("2d");
  const pieces = Array.from({ length: 180 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.3,
    size: 5 + Math.random() * 8,
    speed: 2 + Math.random() * 6,
    rot: Math.random() * 360,
    rotSpeed: -8 + Math.random() * 16,
    color: ["#7cf8ff", "#ff3df2", "#4cff9b", "#ffe066", "#ff416d"][Math.floor(Math.random() * 5)]
  }));

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.y += p.speed;
      p.x += Math.sin((frame + p.y) * 0.02) * 1.4;
      p.rot += p.rotSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });

    frame += 1;
    if (frame < 190) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

function startStarfield() {
  const canvas = $("#starsCanvas");
  const ctx = canvas.getContext("2d");
  const stars = Array.from({ length: 90 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random() * 0.9 + 0.1,
    speed: Math.random() * 0.0008 + 0.00025
  }));

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [canvas, $("#confettiCanvas")]) {
      c.width = window.innerWidth * ratio;
      c.height = window.innerHeight * ratio;
      c.style.width = `${window.innerWidth}px`;
      c.style.height = `${window.innerHeight}px`;
      c.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
    }
  }

  function animate() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const star of stars) {
      star.y += star.speed;
      if (star.y > 1) {
        star.y = 0;
        star.x = Math.random();
      }
      const size = star.z * 2.2;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${0.18 + star.z * 0.5})`;
      ctx.arc(star.x * window.innerWidth, star.y * window.innerHeight, size, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  resize();
  animate();
}

function bindEvents() {
  els.guessBtn.addEventListener("click", checkGuess);
  els.resetBtn.addEventListener("click", () => { play(els.clickSound); resetGame(); });
  els.hintBtn.addEventListener("click", askOracle);
  els.revealBtn.addEventListener("click", revealNumber);
  els.themeToggle.addEventListener("click", toggleTheme);
  els.musicToggle.addEventListener("click", toggleMusic);
  els.soundToggle.addEventListener("click", toggleSound);
  els.saveScoreBtn.addEventListener("click", saveScore);
  els.closeModal.addEventListener("click", closeModal);
  els.clearLeaderboard.addEventListener("click", clearLeaderboard);

  els.playerName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveScore();
  });

  els.guessInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") checkGuess();
  });

  $$(".difficulty-card").forEach(card => {
    card.addEventListener("click", () => {
      play(els.clickSound);
      setupDifficulty(card.dataset.difficulty);
      resetGame();
    });
  });

  els.winModal.addEventListener("click", (event) => {
    if (event.target === els.winModal) closeModal();
  });
}

function initTheme() {
  const saved = localStorage.getItem("neonOracleTheme");
  if (saved === "light") {
    els.body.classList.add("light");
    els.body.classList.remove("dark");
    els.themeToggle.textContent = "☀️";
  } else {
    els.body.classList.add("dark");
    els.body.classList.remove("light");
    els.themeToggle.textContent = "🌙";
  }
}

function init() {
  bindEvents();
  initTheme();
  startStarfield();
  resetGame();
}

init();

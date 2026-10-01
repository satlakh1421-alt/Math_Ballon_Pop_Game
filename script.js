const saveKey = "balloonPopMathGame";

const el = {
  playfield: document.getElementById("playfield"),
  level: document.getElementById("level"),
  score: document.getElementById("score"),
  goal: document.getElementById("goal"),
  lives: document.getElementById("lives"),
  equation: document.getElementById("equation"),
  message: document.getElementById("message"),

  menuScreen: document.getElementById("menuScreen"),
  settingsPanel: document.getElementById("settingsPanel"),
  rulesScreen: document.getElementById("rulesScreen"),
  pauseScreen: document.getElementById("pauseScreen"),
  levelCompleteScreen: document.getElementById("levelCompleteScreen"),
  gameOverScreen: document.getElementById("gameOverScreen"),
  countdown: document.getElementById("countdown"),
  countNumber: document.getElementById("countNumber"),

  bestScore: document.getElementById("bestScore"),
  bestLevel: document.getElementById("bestLevel"),
  finalScore: document.getElementById("finalScore"),
  finalLevel: document.getElementById("finalLevel"),
  levelScore: document.getElementById("levelScore"),
  nextLevelDisplay: document.getElementById("nextLevelDisplay"),
  levelCompleteTitle: document.getElementById("levelCompleteTitle"),

  musicToggle: document.getElementById("musicToggle"),
  effectsToggle: document.getElementById("effectsToggle"),
  soundBtn: document.getElementById("soundBtn")
};

let saveData = JSON.parse(localStorage.getItem(saveKey) || "{}");

saveData = {
  bestScore: saveData.bestScore || 0,
  bestLevel: saveData.bestLevel || 1,
  savedGame: saveData.savedGame || null,
  music: saveData.music !== false,
  effects: saveData.effects !== false
};

let game = {
  mode: "menu",
  level: 1,
  score: 0,
  lives: 3,
  correctCount: 0,
  target: 6,
  equation: null,
  answer: 0,
  balloons: new Map(),
  timers: [],
  settingOpenedFromGame: false
};

let audioCtx = null;
let musicTimer = null;

const balloonColors = [
  "#ff5b7f",
  "#2f8cff",
  "#ffb53d",
  "#8d64ff",
  "#21bf73",
  "#f16fd4"
];

function saveProgress() {
  localStorage.setItem(saveKey, JSON.stringify(saveData));
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addTimer(callback, delay) {
  const timer = setTimeout(callback, delay);
  game.timers.push(timer);
  return timer;
}

function clearGameTimers() {
  game.timers.forEach(timer => clearTimeout(timer));
  game.timers = [];
}

function targetForLevel(level) {
  return Math.min(6 + level, 12);
}

function makeEquation() {
  let a;
  let b;
  let useSubtraction = false;

  if (game.level === 1) {
    a = randomNumber(1, 4);
    b = randomNumber(1, 4);
  } else if (game.level === 2) {
    a = randomNumber(1, 7);
    b = randomNumber(1, 7);
  } else if (game.level === 3) {
    useSubtraction = true;
    a = randomNumber(4, 10);
    b = randomNumber(1, a);
  } else if (game.level <= 5) {
    useSubtraction = Math.random() < 0.45;
    a = randomNumber(2, 12);
    b = randomNumber(1, 8);
  } else {
    useSubtraction = Math.random() < 0.5;
    a = randomNumber(3, 15);
    b = randomNumber(1, 10);
  }

  if (useSubtraction) {
    if (b > a) {
      const oldA = a;
      a = b;
      b = oldA;
    }

    return {
      text: `${a} - ${b} = ?`,
      answer: a - b
    };
  }

  return {
    text: `${a} + ${b} = ?`,
    answer: a + b
  };
}

function updateScreen() {
  el.level.textContent = game.level;
  el.score.textContent = game.score;
  el.goal.textContent = `${game.correctCount}/${game.target}`;
  el.lives.textContent = "♥".repeat(game.lives) + "♡".repeat(3 - game.lives);
  el.equation.textContent = game.equation ? game.equation.text : "Ready?";

  el.bestScore.textContent = saveData.bestScore;
  el.bestLevel.textContent = saveData.savedGame ? saveData.savedGame.level : saveData.bestLevel;

  el.musicToggle.checked = saveData.music;
  el.effectsToggle.checked = saveData.effects;
  el.soundBtn.textContent = saveData.music || saveData.effects ? "♪" : "○";
}

function hideAllScreens() {
  el.menuScreen.classList.add("hidden");
  el.settingsPanel.classList.add("hidden");
  el.rulesScreen.classList.add("hidden");
  el.pauseScreen.classList.add("hidden");
  el.levelCompleteScreen.classList.add("hidden");
  el.gameOverScreen.classList.add("hidden");
}

function startGame() {
  initAudio();

  const saved = saveData.savedGame;

  game.level = saved ? saved.level : 1;
  game.score = saved ? saved.score : 0;
  game.lives = saved ? saved.lives : 3;
  game.correctCount = saved ? saved.correctCount : 0;
  game.target = targetForLevel(game.level);
  game.equation = saved && saved.equation ? saved.equation : makeEquation();
  game.answer = game.equation.answer;

  clearGameTimers();
  clearBalloons();
  hideAllScreens();
  updateScreen();
  startCountdown();
}

function startCountdown() {
  game.mode = "countdown";
  el.countdown.classList.remove("hidden");

  let number = 3;
  el.countNumber.textContent = number;
  playCountdownSound();

  const countdownTimer = setInterval(() => {
    number--;

    if (number > 0) {
      el.countNumber.textContent = number;
      el.countNumber.style.animation = "none";
      void el.countNumber.offsetWidth;
      el.countNumber.style.animation = "";
      playCountdownSound();
    } else {
      clearInterval(countdownTimer);
      el.countNumber.textContent = "Go";

      addTimer(() => {
        el.countdown.classList.add("hidden");
        game.mode = "playing";
        startMusic();
        spawnAnswerBalloons();
      }, 500);
    }
  }, 750);
}

function spawnAnswerBalloons() {
  if (game.mode !== "playing") return;

  clearBalloons();

  const choices = makeChoices(game.answer);
  const lanes = choices.length === 3 ? [18, 50, 82] : [12, 36, 64, 88];

  choices.forEach((answer, index) => {
    addTimer(() => {
      if (game.mode === "playing") {
        createBalloon(answer, answer === game.answer, false, lanes[index]);
      }
    }, index * 220);
  });

  if (game.level >= 4 && game.lives < 3 && Math.random() < 0.35) {
    addTimer(() => {
      if (game.mode === "playing") {
        createBalloon("♥", false, true, 50);
      }
    }, 1000);
  }

  saveCurrentGame();
}

function makeChoices(correctAnswer) {
  const amount = game.level >= 4 ? 4 : 3;
  const choices = new Set([correctAnswer]);

  while (choices.size < amount) {
    let wrong = correctAnswer + randomNumber(-3, 3);

    if (wrong < 0) {
      wrong = Math.abs(wrong);
    }

    if (wrong !== correctAnswer) {
      choices.add(wrong);
    }
  }

  return Array.from(choices).sort(() => Math.random() - 0.5);
}

function balloonSpeed() {
  return Math.max(4200, 8500 - game.level * 450);
}

function createBalloon(answer, isCorrect, isLife, laneX) {
  if (game.mode !== "playing") return;

  const id = Date.now() + Math.random();
  const balloon = document.createElement("button");

  balloon.className = isLife ? "balloon life" : "balloon";
  balloon.innerHTML = `<span class="balloon-number">${answer}</span>`;
  balloon.style.setProperty("--x", laneX + "vw");
  balloon.style.setProperty("--speed", balloonSpeed() + "ms");
  balloon.style.setProperty("--color", balloonColors[randomNumber(0, balloonColors.length - 1)]);

  balloon.onclick = () => popBalloon(id);

  balloon.addEventListener("animationend", event => {
    if (event.animationName === "flyUp") {
      balloonEscaped(id);
    }
  });

  el.playfield.appendChild(balloon);
  game.balloons.set(id, { element: balloon, answer, isCorrect, isLife });
}

function popBalloon(id) {
  if (game.mode !== "playing") return;

  const data = game.balloons.get(id);
  if (!data) return;

  data.element.classList.add("pop");
  addTimer(() => data.element.remove(), 250);
  game.balloons.delete(id);

  if (data.isLife) {
    game.lives = Math.min(3, game.lives + 1);
    showMessage("Life back!");
    playLifeGainSound();
    updateScreen();
    saveCurrentGame();
    return;
  }

  if (data.isCorrect) {
    correctAnswer();
  } else {
    wrongAnswer();
  }
}

function correctAnswer() {
  game.score += 10 + game.level * 2;
  game.correctCount++;

  showMessage("Correct!");
  playCorrectSound();

  if (game.correctCount >= game.target) {
    addTimer(showLevelComplete, 500);
  } else {
    game.equation = makeEquation();
    game.answer = game.equation.answer;
    updateScreen();
    addTimer(spawnAnswerBalloons, 650);
  }

  updateScreen();
  saveCurrentGame();
}

function wrongAnswer() {
  loseLife("Try again!");

  if (game.lives > 0) {
    addTimer(spawnAnswerBalloons, 700);
  }
}

function balloonEscaped(id) {
  const data = game.balloons.get(id);
  if (!data) return;

  data.element.remove();
  game.balloons.delete(id);

  if (game.mode === "playing" && data.isCorrect) {
    loseLife("It flew away!");

    if (game.lives > 0) {
      addTimer(spawnAnswerBalloons, 800);
    }
  }
}

function loseLife(text) {
  game.lives--;
  showMessage(text);
  playWrongSound();
  updateScreen();
  saveCurrentGame();

  if (game.lives <= 0) {
    addTimer(endGame, 500);
  }
}

function showLevelComplete() {
  game.mode = "levelComplete";
  stopMusic();
  clearGameTimers();
  clearBalloons();

  saveData.bestScore = Math.max(saveData.bestScore, game.score);
  saveData.bestLevel = Math.max(saveData.bestLevel, game.level + 1);
  saveData.savedGame = {
    level: game.level + 1,
    score: game.score,
    lives: 3,
    correctCount: 0,
    equation: null
  };

  saveProgress();

  el.levelCompleteTitle.textContent = `Level ${game.level} Complete!`;
  el.levelScore.textContent = game.score;
  el.nextLevelDisplay.textContent = game.level + 1;

  el.levelCompleteScreen.classList.remove("hidden");
  updateScreen();
  playLevelSound();
}

function startNextLevel() {
  game.level++;
  game.lives = 3;
  game.correctCount = 0;
  game.target = targetForLevel(game.level);
  game.equation = makeEquation();
  game.answer = game.equation.answer;

  hideAllScreens();
  updateScreen();
  saveCurrentGame();
  startCountdown();
}

function pauseGame() {
  if (game.mode !== "playing") return;

  game.mode = "paused";
  stopMusic();
  clearGameTimers();

  document.querySelectorAll(".balloon").forEach(balloon => {
    balloon.classList.add("paused");
  });

  el.pauseScreen.classList.remove("hidden");
  saveCurrentGame();
}

function resumeGame() {
  if (game.mode !== "paused" && game.mode !== "settingsFromGame") return;

  game.mode = "playing";

  document.querySelectorAll(".balloon").forEach(balloon => {
    balloon.classList.remove("paused");
  });

  el.pauseScreen.classList.add("hidden");
  el.settingsPanel.classList.add("hidden");
  startMusic();
}

function openSettings() {
  if (game.mode === "playing") {
    game.settingOpenedFromGame = true;
    game.mode = "settingsFromGame";
    stopMusic();
    clearGameTimers();

    document.querySelectorAll(".balloon").forEach(balloon => {
      balloon.classList.add("paused");
    });

    el.settingsPanel.classList.remove("hidden");
  } else {
    game.settingOpenedFromGame = false;
    hideAllScreens();
    el.settingsPanel.classList.remove("hidden");
  }
}

function closeSettings() {
  if (game.settingOpenedFromGame) {
    game.settingOpenedFromGame = false;
    resumeGame();
  } else {
    goToMainMenu();
  }
}

function goToMainMenu() {
  game.mode = "menu";
  game.settingOpenedFromGame = false;
  stopMusic();
  clearGameTimers();
  clearBalloons();
  hideAllScreens();
  el.menuScreen.classList.remove("hidden");
  updateScreen();
}

function endGame() {
  game.mode = "gameover";
  stopMusic();
  clearGameTimers();
  clearBalloons();

  const savedLevel = Math.max(1, game.level - 1);

  saveData.bestScore = Math.max(saveData.bestScore, game.score);
  saveData.bestLevel = Math.max(saveData.bestLevel, savedLevel);
  saveData.savedGame = {
    level: savedLevel,
    score: game.score,
    lives: 3,
    correctCount: 0,
    equation: null
  };

  saveProgress();

  el.finalScore.textContent = game.score;
  el.finalLevel.textContent = game.level;

  el.gameOverScreen.classList.remove("hidden");
  updateScreen();
}

function saveCurrentGame() {
  if (game.mode === "gameover") return;

  saveData.bestScore = Math.max(saveData.bestScore, game.score);
  saveData.bestLevel = Math.max(saveData.bestLevel, game.level);

  saveData.savedGame = {
    level: game.level,
    score: game.score,
    lives: Math.max(1, game.lives),
    correctCount: game.correctCount,
    equation: game.equation
  };

  saveProgress();
}

function clearBalloons() {
  game.balloons.clear();
  el.playfield.innerHTML = "";
}

function showMessage(text) {
  el.message.textContent = text;
  el.message.classList.remove("hidden");

  clearTimeout(el.message.timer);

  el.message.timer = setTimeout(() => {
    el.message.classList.add("hidden");
  }, 1100);
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playTone(freq, time, type, volume) {
  if (!saveData.effects || !audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + time);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + time);
}

function playCorrectSound() {
  playTone(650, 0.12, "triangle", 0.18);
  setTimeout(() => playTone(900, 0.14, "triangle", 0.14), 80);
}

function playWrongSound() {
  playTone(160, 0.22, "sawtooth", 0.12);
}

function playLifeGainSound() {
  playTone(520, 0.1, "sine", 0.16);
  setTimeout(() => playTone(760, 0.14, "sine", 0.14), 90);
}

function playCountdownSound() {
  playTone(520, 0.1, "square", 0.12);
}

function playLevelSound() {
  playTone(450, 0.1, "triangle", 0.15);
  setTimeout(() => playTone(650, 0.1, "triangle", 0.15), 90);
  setTimeout(() => playTone(850, 0.15, "triangle", 0.15), 180);
}

function startMusic() {
  if (!saveData.music || musicTimer || !audioCtx) return;

  const notes = [392, 440, 494, 523, 494, 440];
  let index = 0;

  musicTimer = setInterval(() => {
    if (game.mode !== "playing" || !saveData.music) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.value = notes[index % notes.length];
    gain.gain.value = 0.035;
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.28);

    index++;
  }, 390);
}

function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

document.getElementById("playBtn").onclick = startGame;
document.getElementById("mainSettingsBtn").onclick = openSettings;
document.getElementById("settingsBtn").onclick = openSettings;
document.getElementById("closeSettingsBtn").onclick = closeSettings;

document.getElementById("rulesBtn").onclick = () => {
  hideAllScreens();
  el.rulesScreen.classList.remove("hidden");
};

document.getElementById("closeRulesBtn").onclick = goToMainMenu;

document.getElementById("pauseBtn").onclick = pauseGame;
document.getElementById("resumeBtn").onclick = resumeGame;
document.getElementById("pauseMenuBtn").onclick = goToMainMenu;

document.getElementById("nextLevelBtn").onclick = startNextLevel;
document.getElementById("levelMenuBtn").onclick = goToMainMenu;

document.getElementById("playAgainBtn").onclick = () => {
  startGame();
};

document.getElementById("backMenuBtn").onclick = goToMainMenu;

document.getElementById("soundBtn").onclick = () => {
  saveData.music = !saveData.music;
  saveData.effects = saveData.music;
  saveProgress();
  updateScreen();

  if (!saveData.music) {
    stopMusic();
  } else if (game.mode === "playing") {
    startMusic();
  }
};

el.musicToggle.onchange = () => {
  saveData.music = el.musicToggle.checked;
  saveProgress();
  updateScreen();

  if (!saveData.music) {
    stopMusic();
  } else if (game.mode === "playing") {
    startMusic();
  }
};

el.effectsToggle.onchange = () => {
  saveData.effects = el.effectsToggle.checked;
  saveProgress();
  updateScreen();
};

document.getElementById("resetBtn").onclick = () => {
  saveData.bestScore = 0;
  saveData.bestLevel = 1;
  saveData.savedGame = null;
  saveProgress();
  updateScreen();
  showMessage("Progress reset!");
};

document.addEventListener("keydown", event => {
  if (event.key === "Escape" || event.key.toLowerCase() === "p") {
    if (game.mode === "playing") {
      pauseGame();
    } else if (game.mode === "paused") {
      resumeGame();
    }
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.mode === "playing") {
    pauseGame();
  }
});

updateScreen();
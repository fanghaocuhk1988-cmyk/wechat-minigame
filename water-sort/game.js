const capacity = 4;
const storageKey = "water-sort-prototype-v1";

const levels = [
  {
    target: 10,
    bottles: [
      ["red", "blue", "blue", "red"],
      ["blue", "red", "red", "blue"],
      [],
      [],
    ],
  },
  {
    target: 10,
    bottles: [
      ["yellow", "green", "green", "yellow"],
      ["green", "yellow", "yellow", "green"],
      [],
      [],
    ],
  },
  {
    target: 12,
    bottles: [
      ["red", "red", "blue", "blue"],
      ["yellow", "yellow", "red", "red"],
      ["blue", "blue", "yellow", "yellow"],
      [],
      [],
    ],
  },
  {
    target: 15,
    bottles: [
      ["green", "blue", "blue", "green"],
      ["purple", "green", "green", "purple"],
      ["blue", "purple", "purple", "blue"],
      [],
      [],
    ],
  },
  {
    target: 18,
    bottles: [
      ["orange", "orange", "blue", "green"],
      ["blue", "green", "orange", "blue"],
      ["green", "blue", "green", "orange"],
      [],
      [],
    ],
  },
];

let saved = readSaved();
let levelIndex = saved.levelIndex || 0;
let bottles = clone(levels[levelIndex].bottles);
let selected = null;
let moves = 0;
let history = [];
let soundOn = saved.soundOn !== false;
let startedAt = Date.now();
let timerId;
let audioContext;
let toastTimer;

const nodes = {
  board: document.getElementById("board"),
  statusText: document.getElementById("statusText"),
  levelText: document.getElementById("levelText"),
  moveText: document.getElementById("moveText"),
  timeText: document.getElementById("timeText"),
  targetText: document.getElementById("targetText"),
  undoBtn: document.getElementById("undoBtn"),
  restartBtn: document.getElementById("restartBtn"),
  nextBtn: document.getElementById("nextBtn"),
  soundBtn: document.getElementById("soundBtn"),
  toast: document.getElementById("toast"),
};

nodes.undoBtn.addEventListener("click", undo);
nodes.restartBtn.addEventListener("click", restartLevel);
nodes.nextBtn.addEventListener("click", nextLevel);
nodes.soundBtn.addEventListener("click", toggleSound);

render();
startTimer();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

function savePrefs() {
  localStorage.setItem(storageKey, JSON.stringify({ levelIndex, soundOn }));
}

function startTimer() {
  clearInterval(timerId);
  startedAt = Date.now();
  timerId = setInterval(() => {
    nodes.timeText.textContent = `${Math.floor((Date.now() - startedAt) / 1000)}s`;
  }, 250);
}

function render() {
  nodes.board.innerHTML = "";
  nodes.board.className = `board bottles-${bottles.length}`;
  nodes.levelText.textContent = String(levelIndex + 1);
  nodes.moveText.textContent = String(moves);
  nodes.targetText.textContent = `${levels[levelIndex].target}s`;
  nodes.undoBtn.disabled = history.length === 0;
  nodes.nextBtn.disabled = !isSolved();
  nodes.soundBtn.textContent = soundOn ? "声音" : "静音";

  bottles.forEach((bottle, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bottle";
    button.setAttribute("aria-label", bottleLabel(index, bottle));
    if (selected === index) button.classList.add("selected");
    if (isBottleComplete(bottle)) button.classList.add("complete");
    button.addEventListener("click", () => handleBottleClick(index));

    const neck = document.createElement("span");
    neck.className = "neck";
    const glass = document.createElement("span");
    glass.className = "glass";

    bottle.forEach((color, layerIndex) => {
      const liquid = document.createElement("span");
      liquid.className = `liquid ${color}`;
      liquid.style.bottom = `${layerIndex * 25}%`;
      glass.appendChild(liquid);
    });

    button.append(neck, glass);
    nodes.board.appendChild(button);
  });
}

function bottleLabel(index, bottle) {
  if (bottle.length === 0) return `第 ${index + 1} 个空瓶`;
  return `第 ${index + 1} 个瓶子，顶部颜色 ${bottle[bottle.length - 1]}`;
}

function topColor(bottle) {
  return bottle[bottle.length - 1];
}

function topRunLength(bottle) {
  if (!bottle.length) return 0;
  const color = topColor(bottle);
  let count = 0;
  for (let i = bottle.length - 1; i >= 0; i -= 1) {
    if (bottle[i] !== color) break;
    count += 1;
  }
  return count;
}

function canPour(fromIndex, toIndex) {
  if (fromIndex === toIndex) return false;
  const from = bottles[fromIndex];
  const to = bottles[toIndex];
  if (from.length === 0) return false;
  if (to.length >= capacity) return false;
  return to.length === 0 || topColor(from) === topColor(to);
}

function pourAmount(fromIndex, toIndex) {
  const run = topRunLength(bottles[fromIndex]);
  const room = capacity - bottles[toIndex].length;
  return Math.min(run, room);
}

function handleBottleClick(index) {
  if (isSolved()) return;

  if (selected === null) {
    if (bottles[index].length === 0) {
      setStatus("空瓶不能作为源瓶");
      showToast("先点有液体的瓶子");
      playSound("bad");
      return;
    }
    selected = index;
    setStatus("再点一个空瓶，或顶部同色的瓶子");
    playSound("pick");
    render();
    return;
  }

  if (selected === index) {
    selected = null;
    setStatus("已取消选择");
    playSound("pick");
    render();
    return;
  }

  if (!canPour(selected, index)) {
    setStatus("只能倒到空瓶，或同色液体顶部");
    showToast("倒错了，换一个目标瓶");
    playSound("bad");
    selected = null;
    render();
    return;
  }

  doPour(selected, index);
}

function doPour(fromIndex, toIndex) {
  history.push({ bottles: clone(bottles), moves, selected });
  const amount = pourAmount(fromIndex, toIndex);
  const from = bottles[fromIndex];
  const to = bottles[toIndex];
  for (let i = 0; i < amount; i += 1) {
    to.push(from.pop());
  }
  moves += 1;

  const fromButton = nodes.board.children[fromIndex];
  if (fromButton) fromButton.classList.add("pour");

  selected = null;
  setStatus(`倒入 ${amount} 层，手感不错`);
  playSound("pour");
  render();

  if (isSolved()) {
    clearInterval(timerId);
    setStatus("完成！前期关卡就该这么轻快");
    showToast(`完成关卡，用了 ${moves} 步`);
    playSound("win");
  }
}

function undo() {
  const last = history.pop();
  if (!last) return;
  bottles = clone(last.bottles);
  moves = last.moves;
  selected = null;
  setStatus("已撤销一步");
  playSound("undo");
  render();
}

function restartLevel() {
  bottles = clone(levels[levelIndex].bottles);
  selected = null;
  moves = 0;
  history = [];
  setStatus("重新开始，先点源瓶");
  playSound("pick");
  startTimer();
  render();
}

function nextLevel() {
  levelIndex = (levelIndex + 1) % levels.length;
  savePrefs();
  restartLevel();
  setStatus(`第 ${levelIndex + 1} 关，继续轻松倒水`);
}

function toggleSound() {
  soundOn = !soundOn;
  savePrefs();
  render();
  if (soundOn) playSound("pick");
}

function isBottleComplete(bottle) {
  if (bottle.length === 0) return true;
  if (bottle.length !== capacity) return false;
  return bottle.every((color) => color === bottle[0]);
}

function isSolved() {
  return bottles.every(isBottleComplete);
}

function setStatus(text) {
  nodes.statusText.textContent = text;
}

function showToast(text) {
  clearTimeout(toastTimer);
  nodes.toast.textContent = text;
  nodes.toast.classList.add("show");
  toastTimer = setTimeout(() => nodes.toast.classList.remove("show"), 1500);
}

function playSound(kind) {
  if (!soundOn) return;
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioContext.currentTime;
  const notes = {
    pick: [[520, 0, 0.035, "sine"]],
    pour: [
      [430, 0, 0.045, "triangle"],
      [540, 0.045, 0.045, "triangle"],
      [650, 0.09, 0.05, "sine"],
    ],
    bad: [[160, 0, 0.08, "sawtooth"]],
    undo: [
      [460, 0, 0.045, "triangle"],
      [340, 0.055, 0.05, "triangle"],
    ],
    win: [
      [523, 0, 0.06, "triangle"],
      [659, 0.07, 0.07, "triangle"],
      [784, 0.15, 0.09, "triangle"],
      [1047, 0.25, 0.12, "sine"],
    ],
  }[kind];

  notes.forEach(([frequency, delay, duration, type]) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now + delay);
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.075, now + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + duration + 0.02);
  });
}

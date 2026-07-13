const storeKey = "pet-yard-prototype-v1";
const todayKey = new Date().toISOString().slice(0, 10);

const defaultState = {
  hearts: 0,
  materials: 8,
  inventory: {
    catFood: 1,
    dogFood: 1,
    water: 1,
    toy: 1,
  },
  caredToday: 0,
  surpriseDate: "",
  sound: true,
  visits: 1,
};

const careCopy = {
  catFood: {
    target: "cat",
    empty: "先合成一份猫粮，栗子会等你的",
    speech: "栗子吃得很认真，尾巴轻轻晃了一下",
    gain: 4,
    sound: "cat",
  },
  dogFood: {
    target: "dog",
    empty: "先合成一份狗粮，豆包已经坐好了",
    speech: "豆包开心地蹭了蹭你的手",
    gain: 4,
    sound: "dog",
  },
  water: {
    target: "both",
    empty: "水碗空了，先装满一碗清水",
    speech: "小院安静下来，只听见轻轻喝水声",
    gain: 3,
    sound: "water",
  },
  toy: {
    target: "both",
    empty: "做一个小玩具，再陪它们玩一会儿",
    speech: "玩具滚过草地，猫和狗都凑了过来",
    gain: 5,
    sound: "toy",
  },
};

const recipeCost = {
  catFood: 2,
  dogFood: 2,
  water: 1,
  toy: 3,
};

let state = loadState();
let audioContext;
let toastTimer;

const nodes = {
  heartCount: document.getElementById("heartCount"),
  materialCount: document.getElementById("materialCount"),
  catFoodCount: document.getElementById("catFoodCount"),
  dogFoodCount: document.getElementById("dogFoodCount"),
  waterCount: document.getElementById("waterCount"),
  toyCount: document.getElementById("toyCount"),
  speech: document.getElementById("speech"),
  dailyLine: document.getElementById("dailyLine"),
  goalText: document.getElementById("goalText"),
  toast: document.getElementById("toast"),
  soundBtn: document.getElementById("soundBtn"),
  catPet: document.getElementById("catPet"),
  dogPet: document.getElementById("dogPet"),
  surpriseBtn: document.getElementById("surpriseBtn"),
  collectBtn: document.getElementById("collectBtn"),
  adMockBtn: document.getElementById("adMockBtn"),
};

document.querySelectorAll("[data-care]").forEach((button) => {
  button.addEventListener("click", () => useCare(button.dataset.care));
});

document.querySelectorAll("[data-make]").forEach((button) => {
  button.addEventListener("click", () => craftItem(button.dataset.make));
});

nodes.catPet.addEventListener("click", () => useCare("catFood"));
nodes.dogPet.addEventListener("click", () => useCare("dogFood"));
nodes.collectBtn.addEventListener("click", collectMaterials);
nodes.adMockBtn.addEventListener("click", claimAdMock);
nodes.surpriseBtn.addEventListener("click", claimSurprise);
nodes.soundBtn.addEventListener("click", toggleSound);

render();

function loadState() {
  try {
    const raw = localStorage.getItem(storeKey);
    if (!raw) return { ...defaultState };
    const saved = JSON.parse(raw);
    return {
      ...defaultState,
      ...saved,
      inventory: {
        ...defaultState.inventory,
        ...(saved.inventory || {}),
      },
    };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

function render() {
  nodes.heartCount.textContent = state.hearts;
  nodes.materialCount.textContent = state.materials;
  nodes.catFoodCount.textContent = state.inventory.catFood;
  nodes.dogFoodCount.textContent = state.inventory.dogFood;
  nodes.waterCount.textContent = state.inventory.water;
  nodes.toyCount.textContent = state.inventory.toy;
  nodes.soundBtn.classList.toggle("off", !state.sound);
  nodes.soundBtn.textContent = state.sound ? "声" : "静";
  nodes.dailyLine.textContent = state.surpriseDate === todayKey ? "今天的小惊喜已收好" : "小院角落有一点动静";

  const left = Math.max(0, 3 - state.caredToday);
  nodes.goalText.textContent = left > 0 ? `再照顾 ${left} 次完成今日小目标` : "今日小院已经暖起来了";

  document.querySelectorAll(".merge-btn").forEach((button) => {
    const cost = recipeCost[button.dataset.make];
    button.disabled = state.materials < cost;
    button.style.opacity = state.materials < cost ? "0.58" : "1";
  });
}

function craftItem(type) {
  const cost = recipeCost[type];
  if (state.materials < cost) {
    speak("材料不够，先整理一下小篮子");
    playSound("nope");
    return;
  }

  state.materials -= cost;
  state.inventory[type] += 1;
  saveState();
  render();
  playSound("craft");
  popFloat("+1", type === "dogFood" ? nodes.dogPet : nodes.catPet);

  const names = {
    catFood: "猫粮",
    dogFood: "狗粮",
    water: "清水",
    toy: "玩具",
  };
  speak(`${names[type]}准备好了，马上就能用`);
}

function useCare(type) {
  const item = careCopy[type];
  if (state.inventory[type] <= 0) {
    speak(item.empty);
    playSound("nope");
    return;
  }

  state.inventory[type] -= 1;
  state.hearts += item.gain;
  state.materials += type === "toy" ? 1 : 2;
  state.caredToday += 1;

  saveState();
  render();
  speak(item.speech);
  playSound(item.sound);
  animatePet(item.target);
  popFloat(`+${item.gain} 爱心`, item.target === "dog" ? nodes.dogPet : nodes.catPet);
}

function collectMaterials() {
  const gain = 3 + Math.floor(Math.random() * 3);
  state.materials += gain;
  saveState();
  render();
  playSound("collect");
  speak(`小篮子里翻到了 ${gain} 份材料`);
  popFloat(`+${gain} 材料`, nodes.collectBtn);
}

function claimAdMock() {
  state.materials += 6;
  saveState();
  render();
  playSound("reward");
  speak("广告奖励模拟：多拿了 6 份材料");
  showToast("正式接入微信激励视频后，这里会等成功回调再发奖励");
}

function claimSurprise() {
  if (state.surpriseDate === todayKey) {
    speak("今天的小惊喜已经收好，明天再来看看");
    playSound("nope");
    return;
  }

  const surprises = [
    { text: "栗子从纸箱里推出来一朵小花", hearts: 6, materials: 2 },
    { text: "豆包叼回一只干净的小碗", hearts: 5, materials: 3 },
    { text: "小院角落多了一串轻轻响的风铃", hearts: 8, materials: 1 },
  ];
  const surprise = surprises[Math.floor(Math.random() * surprises.length)];
  state.hearts += surprise.hearts;
  state.materials += surprise.materials;
  state.surpriseDate = todayKey;
  saveState();
  render();
  playSound("reward");
  speak(surprise.text);
  showToast(`获得 ${surprise.hearts} 爱心和 ${surprise.materials} 材料`);
}

function toggleSound() {
  state.sound = !state.sound;
  saveState();
  render();
  if (state.sound) playSound("collect");
}

function speak(text) {
  nodes.speech.textContent = text;
}

function animatePet(target) {
  const pets = target === "both" ? [nodes.catPet, nodes.dogPet] : [target === "dog" ? nodes.dogPet : nodes.catPet];
  pets.forEach((pet) => {
    pet.classList.add("happy");
    setTimeout(() => pet.classList.remove("happy"), 420);
  });
}

function popFloat(text, anchor) {
  const rect = anchor.getBoundingClientRect();
  const float = document.createElement("div");
  float.className = "float";
  float.textContent = text;
  float.style.left = `${rect.left + rect.width / 2 - 24}px`;
  float.style.top = `${rect.top + rect.height / 2}px`;
  document.body.appendChild(float);
  setTimeout(() => float.remove(), 980);
}

function showToast(text) {
  clearTimeout(toastTimer);
  nodes.toast.textContent = text;
  nodes.toast.classList.add("show");
  toastTimer = setTimeout(() => nodes.toast.classList.remove("show"), 2400);
}

function playSound(kind) {
  if (!state.sound) return;
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  const now = audioContext.currentTime;
  const patterns = {
    craft: [
      [520, 0, 0.045, "triangle"],
      [740, 0.045, 0.055, "sine"],
    ],
    collect: [
      [660, 0, 0.05, "sine"],
      [880, 0.06, 0.06, "sine"],
    ],
    reward: [
      [523, 0, 0.06, "triangle"],
      [659, 0.07, 0.06, "triangle"],
      [784, 0.14, 0.08, "triangle"],
    ],
    cat: [
      [640, 0, 0.08, "sine"],
      [760, 0.07, 0.08, "sine"],
    ],
    dog: [
      [220, 0, 0.08, "square"],
      [260, 0.09, 0.07, "square"],
    ],
    water: [
      [980, 0, 0.035, "sine"],
      [760, 0.045, 0.045, "sine"],
      [900, 0.105, 0.04, "sine"],
    ],
    toy: [
      [440, 0, 0.045, "triangle"],
      [610, 0.05, 0.045, "triangle"],
      [390, 0.1, 0.055, "triangle"],
    ],
    nope: [[180, 0, 0.07, "sawtooth"]],
  };

  const notes = patterns[kind] || patterns.collect;
  notes.forEach(([frequency, delay, duration, type]) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now + delay);
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.08, now + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + duration + 0.02);
  });
}

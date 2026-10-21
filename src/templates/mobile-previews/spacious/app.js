// 息间 · Spacious — 页面交互
// 状态栏时间逻辑来自 mobile-frame，原样保留。

const statusTime = document.getElementById("statusTime");

function updateStatusTime() {
  if (!statusTime) return;

  const now = new Date();
  statusTime.textContent = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

updateStatusTime();
setInterval(updateStatusTime, 30000);

/* ===== toast ===== */
const toast = document.getElementById("toast");
let toastTimer = null;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-show"), 1800);
}

/* ===== 通用：data-toast 按钮 ===== */
document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== chip 筛选 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏这节练习" : "已取消收藏");
  });
});

/* ===== 呼吸练习：4-4-6 节奏 ===== */
const breath = document.getElementById("breathWidget");
const phaseEl = document.getElementById("breathPhase");
const clockEl = document.getElementById("breathClock");
const sessionBtn = document.getElementById("sessionBtn");
const quickInput = document.getElementById("quickInput");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const PHASES = [
  { key: "in", label: "吸气", secs: 4 },
  { key: "hold", label: "屏息", secs: 4 },
  { key: "out", label: "呼气", secs: 6 }
];

let running = false;
let phaseIndex = -1;
let phaseTimer = null;
let elapsed = 0;
let clockTimer = null;

function pad(n) {
  return String(n).padStart(2, "0");
}

function renderClock() {
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  clockEl.textContent = `${pad(m)}:${pad(s)}`;
}

function setPhase(index) {
  phaseIndex = index;
  const phase = PHASES[index];
  breath.classList.remove("is-in", "is-hold", "is-out");
  breath.classList.add(`is-${phase.key}`);
  phaseEl.textContent = `${phase.label} · ${phase.secs} 拍`;
  phaseTimer = setTimeout(() => setPhase((index + 1) % PHASES.length), phase.secs * 1000);
}

function stopSession(silent) {
  running = false;
  clearTimeout(phaseTimer);
  clearInterval(clockTimer);
  breath.classList.remove("is-in", "is-hold", "is-out");
  phaseEl.textContent = "练习暂停";
  sessionBtn.textContent = "继续练习";
  if (!silent) showToast("已暂停，随时回来");
}

function startSession() {
  running = true;
  sessionBtn.textContent = "暂停";
  setPhase(phaseIndex < 0 ? 0 : phaseIndex);
  clockTimer = setInterval(() => {
    elapsed += 1;
    renderClock();
  }, 1000);
  const name = (quickInput.value || "").trim();
  showToast(name ? `开始「${name}」· 跟着圆环呼吸` : "开始 · 跟着圆环呼吸");
}

sessionBtn.addEventListener("click", () => {
  if (running) {
    stopSession(false);
  } else {
    startSession();
  }
});

quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (!running) startSession();
    quickInput.blur();
  }
});

if (reduceMotion) {
  // 降级：不缩放圆环，只切换文字与计时
  breath.classList.add("is-plain");
}

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "今天") {
      document.querySelector(".hero").scrollIntoView({ behavior: "smooth" });
    } else if (name === "练习") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

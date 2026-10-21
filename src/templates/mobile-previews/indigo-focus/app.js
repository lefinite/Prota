// 心流时钟 · Indigo Focus — 页面交互
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

/* ===== 圆环计时器：真正的倒计时 ===== */
const DIAL = 527.79; // 2π × 84
const dialProgress = document.getElementById("dialProgress");
const ringTime = document.getElementById("ringTime");
const ringNote = document.getElementById("ringNote");
const phaseLabel = document.getElementById("phaseLabel");
const startBtn = document.getElementById("startBtn");
const heroEl = document.querySelector(".focus-hero");

const timer = {
  duration: 25 * 60, // 秒
  left: 25 * 60,
  running: false,
  id: null
};

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderRing() {
  ringTime.textContent = fmt(timer.left);
  if (dialProgress) {
    const ratio = timer.duration > 0 ? timer.left / timer.duration : 0;
    dialProgress.style.strokeDashoffset = String(DIAL * (1 - ratio));
  }
}

function renderPhase() {
  phaseLabel.textContent = timer.running
    ? "专注中"
    : timer.left === timer.duration
      ? "准备开始"
      : "已暂停";
  phaseLabel.classList.toggle("is-running", timer.running);
}

function renderButton() {
  startBtn.innerHTML = timer.running
    ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="5" width="4" height="14" rx="1"></rect><rect x="13" y="5" width="4" height="14" rx="1"></rect></svg>暂停'
    : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>' +
      (timer.left === timer.duration ? "开始专注" : "继续专注");
}

function stopTicking() {
  if (timer.id) {
    clearInterval(timer.id);
    timer.id = null;
  }
  heroEl.classList.remove("is-animating");
}

function tick() {
  timer.left -= 1;
  if (timer.left <= 0) {
    timer.left = 0;
    renderRing();
    stopTicking();
    timer.running = false;
    renderPhase();
    renderButton();
    completePomodoro();
    showToast("一颗番茄完成 · 休息 5 分钟");
    return;
  }
  renderRing();
}

function toggleTimer() {
  if (timer.running) {
    timer.running = false;
    stopTicking();
    renderPhase();
    renderButton();
    showToast("计时已暂停，随时回来");
    return;
  }
  if (timer.left === 0) {
    timer.left = timer.duration; // 完成后再按 = 新一轮
  }
  timer.running = true;
  renderPhase();
  renderButton();
  heroEl.classList.add("is-animating"); // 圆环随秒平滑走动
  timer.id = setInterval(tick, 1000);
  showToast(`专注开始 · ${timer.duration / 60} 分钟`);
}

startBtn.addEventListener("click", toggleTimer);
renderRing();
renderPhase();
renderButton();

/* ===== 时长 chips：切换 25 / 50 / 90 分钟 ===== */
const durChips = document.querySelectorAll(".dur-chip");

durChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    durChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const min = Number(chip.dataset.min);
    stopTicking();
    timer.running = false;
    timer.duration = min * 60;
    timer.left = min * 60;
    ringNote.textContent = `${min} 分钟 · 一颗番茄`;
    renderRing();
    renderPhase();
    renderButton();
    showToast(`已切换到 ${min} 分钟专注`);
  });
});

/* ===== 番茄点：完成一颗点亮 ===== */
function completePomodoro() {
  const dots = document.querySelectorAll(".focus-hero__dots i");
  const next = Array.from(dots).find((d) => !d.classList.contains("is-done"));
  if (next) next.classList.add("is-done");
}

/* ===== 白噪音 chips：单选切换 ===== */
const noiseChips = document.querySelectorAll(".noise-chip");

noiseChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    noiseChips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-pressed", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-pressed", "true");
    showToast(`白噪音已切换：${chip.textContent.trim()}`);
  });
});

/* ===== chip 筛选：会话状态 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".feed .chip");

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

/* ===== 会话命名：回车写入 Hero ===== */
const quickInput = document.getElementById("quickInput");
const sessionName = document.getElementById("sessionName");

quickInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = quickInput.value.trim();
  if (!text) {
    showToast("先给这轮专注起个名字吧");
    quickInput.focus();
    return;
  }
  sessionName.textContent = text;
  quickInput.value = "";
  showToast(`下一轮专注：${text}`);
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "新建") {
      quickInput.focus();
      showToast("命名后按开始，即刻进入心流");
    } else if (name === "统计") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

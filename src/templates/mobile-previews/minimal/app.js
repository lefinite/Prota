// 此刻 · Minimal — 页面交互
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

/* ===== 专注计时：真实的分秒倒数 ===== */
const timerDisplay = document.getElementById("timerDisplay");
const timerFill = document.getElementById("timerFill");
const timerState = document.getElementById("timerState");
const timerBtn = document.getElementById("timerBtn");
const timerIcon = document.getElementById("timerIcon");

let remaining = 24 * 60 + 37;          // 24:37
let total = remaining;
let running = true;
let tick = null;

const ICON_PAUSE = '<rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />';
const ICON_PLAY = '<path d="M8 5.5v13l11-6.5z" />';

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderTimer() {
  timerDisplay.textContent = fmt(remaining);
  const pct = Math.max(0, Math.round(((total - remaining) / total) * 100));
  timerFill.style.setProperty("--w", `${pct}%`);
}

function setRunning(on) {
  running = on;
  if (on) {
    timerIcon.innerHTML = ICON_PAUSE;
    timerBtn.setAttribute("aria-label", "暂停专注");
    timerState.textContent = "进行中 · 第 2 个番茄";
    clearInterval(tick);
    tick = setInterval(() => {
      if (remaining > 0) {
        remaining -= 1;
        renderTimer();
      }
      if (remaining === 0) {
        clearInterval(tick);
        running = false;
        timerIcon.innerHTML = ICON_PLAY;
        timerState.textContent = "本块已完成 · 休息 5 分钟";
        showToast("专注块完成 · 休息 5 分钟");
      }
    }, 1000);
  } else {
    timerIcon.innerHTML = ICON_PLAY;
    timerBtn.setAttribute("aria-label", "继续专注");
    timerState.textContent = "已暂停 · 随时继续";
    clearInterval(tick);
  }
}

timerBtn.addEventListener("click", () => {
  setRunning(!running);
  showToast(running ? "专注继续" : "专注已暂停");
});

/* ===== 操作区：开始专注 / 时长切换 ===== */
document.getElementById("startBtn").addEventListener("click", () => {
  const minutes = Number(document.querySelector(".chip--dur.is-active").dataset.min);
  total = minutes * 60;
  remaining = total;
  renderTimer();
  setRunning(true);
  showToast(`专注开始 · ${minutes} 分钟`);
});

document.querySelectorAll(".chip--dur").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip--dur").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const minutes = Number(chip.dataset.min);
    total = minutes * 60;
    remaining = total;
    renderTimer();
    showToast(`已设为 ${minutes} 分钟 · 点击开始专注`);
  });
});

/* ===== 任务勾选 toggle（划线状态 + 筛选联动）===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));

feedItems.forEach((item) => {
  const check = item.querySelector(".check");
  check.addEventListener("click", () => {
    const done = item.classList.toggle("is-done");
    item.dataset.kind = done ? "done" : "open";
    check.setAttribute("aria-pressed", String(done));
    showToast(done ? "已完成一项" : "已恢复为未完成");
  });
});

/* ===== chip 筛选 ===== */
const chips = document.querySelectorAll('.feed__head .chip');

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

/* ===== 新任务：写入列表 ===== */
const taskInput = document.getElementById("taskInput");
const feedList = document.getElementById("feedList");

function addTask() {
  const text = taskInput.value.trim();
  if (!text) {
    showToast("先写一个任务名");
    taskInput.focus();
    return;
  }
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "open";
  li.innerHTML = `
    <button class="check" type="button" aria-pressed="false" aria-label="勾选"><i></i></button>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">稍后 · 新任务</span>
    </div>
    <b class="feed-item__time">—</b>`;
  li.querySelector(".feed-item__name").textContent = text;
  li.querySelector(".check").addEventListener("click", () => {
    const done = li.classList.toggle("is-done");
    li.dataset.kind = done ? "done" : "open";
    li.querySelector(".check").setAttribute("aria-pressed", String(done));
  });
  feedList.appendChild(li);
  taskInput.value = "";
  showToast("任务已添加");
}

taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTask();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "新建") {
      taskInput.focus();
      showToast("写下任务，回车保存");
    } else if (name === "任务") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

// 便当 · Bento — 页面交互
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

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===== 步数环：入场画到 80% ===== */
const RING_CIRC = 163.4;
const stepsRing = document.getElementById("stepsRing");
const STEP_TARGET = 0.8;

requestAnimationFrame(() => {
  stepsRing.style.strokeDashoffset = String(RING_CIRC * (1 - STEP_TARGET));
});

/* ===== 水杯格：点一下 +1 ===== */
const WATER_GOAL = 8;
let waterCount = 5;

const waterTile = document.getElementById("waterTile");
const waterCountEl = document.getElementById("waterCount");
const waterDots = document.getElementById("waterDots");

function paintWater() {
  waterCountEl.textContent = String(waterCount);
  Array.from(waterDots.children).forEach((dot, i) => {
    dot.classList.toggle("is-full", i < waterCount);
  });
}

waterTile.addEventListener("click", () => {
  waterCount = waterCount >= WATER_GOAL ? 0 : waterCount + 1;
  paintWater();
  if (waterCount === WATER_GOAL) {
    showToast("今日 8 杯达成 · 格子已点亮");
  } else if (waterCount === 0) {
    showToast("已清零，明天再来");
  }
});

/* ===== 音乐格：播放 / 进度 ===== */
const MUSIC_TOTAL = 3 * 60 + 45;
let musicSec = 1 * 60 + 12;
let musicPlaying = false;
let musicTimer = null;

const musicBtn = document.getElementById("musicBtn");
const musicFill = document.getElementById("musicFill");
const musicNow = document.getElementById("musicNow");

function paintMusic() {
  const pct = Math.min(100, (musicSec / MUSIC_TOTAL) * 100);
  musicFill.style.width = `${pct}%`;
  const m = Math.floor(musicSec / 60);
  const s = musicSec % 60;
  musicNow.textContent = `${m}:${String(s).padStart(2, "0")}`;
}

function setMusicPlaying(on) {
  musicPlaying = on;
  musicBtn.classList.toggle("is-playing", on);
  musicBtn.setAttribute("aria-pressed", String(on));
  musicBtn.setAttribute("aria-label", on ? "暂停" : "播放");
  clearInterval(musicTimer);
  if (on) {
    musicTimer = setInterval(() => {
      if (musicSec >= MUSIC_TOTAL) {
        musicSec = 0;
        setMusicPlaying(false);
        paintMusic();
        showToast("《夏日晚风》播完 · 已切到下一首");
        return;
      }
      musicSec += 1;
      paintMusic();
    }, 1000);
  }
}

musicBtn.addEventListener("click", () => {
  setMusicPlaying(!musicPlaying);
});

paintMusic();

/* ===== 待办勾选：完成计数联动 ===== */
const todoItems = Array.from(document.querySelectorAll(".todo"));
const todoCount = document.getElementById("todoCount");

function paintTodoCount() {
  const done = todoItems.filter((item) => item.classList.contains("is-done")).length;
  todoCount.textContent = `${done} / ${todoItems.length}`;
}

todoItems.forEach((item) => {
  const check = item.querySelector(".todo__check");
  check.addEventListener("click", () => {
    const on = check.classList.toggle("is-on");
    check.setAttribute("aria-pressed", String(on));
    item.classList.toggle("is-done", on);
    const meta = item.querySelector(".todo__meta");
    meta.textContent = meta.textContent.replace(/ · 已完成$/, "");
    if (on) meta.textContent += " · 已完成";
    paintTodoCount();
    const left = todoItems.length - todoItems.filter((i) => i.classList.contains("is-done")).length;
    showToast(on ? `已完成 · 还剩 ${left} 件` : "已恢复待办");
  });
});

paintTodoCount();

/* ===== chip 筛选 ===== */
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    todoItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 新建待办 ===== */
const todoInput = document.getElementById("todoInput");
const addTodoBtn = document.getElementById("addTodoBtn");
const feedList = document.getElementById("feedList");

function addTodo() {
  const text = (todoInput.value || "").trim();
  if (!text) {
    showToast("先写点什么，再放进格子");
    return;
  }
  const li = document.createElement("li");
  li.className = "todo";
  li.dataset.kind = "life";
  li.innerHTML = `
    <button class="todo__check" type="button" aria-label="完成状态" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </button>
    <div class="todo__body">
      <span class="todo__name"></span>
      <span class="todo__meta">生活 · 刚加入</span>
    </div>
    <em class="time-chip">今天</em>`;
  li.querySelector(".todo__name").textContent = text;
  li.querySelector(".todo__check").addEventListener("click", (e) => {
    const check = e.currentTarget;
    const on = check.classList.toggle("is-on");
    check.setAttribute("aria-pressed", String(on));
    li.classList.toggle("is-done", on);
    showToast(on ? "已完成 · 干得漂亮" : "已恢复待办");
  });
  const activeFilter = document.querySelector(".chip.is-active");
  const filter = activeFilter ? activeFilter.dataset.filter : "all";
  li.hidden = filter !== "all" && filter !== "life";
  feedList.prepend(li);
  todoItems.unshift(li);
  paintTodoCount();
  todoInput.value = "";
  showToast("已加入「生活」格");
}

addTodoBtn.addEventListener("click", addTodo);

todoInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTodo();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");
const bentoGrid = document.querySelector(".bento-grid");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "添加") {
      todoInput.focus();
      showToast("写一句待办，回车放进今天的格子");
    } else if (name === "格盘" || name === "首页") {
      bentoGrid.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

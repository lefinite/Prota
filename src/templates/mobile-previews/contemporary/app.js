// 拾光 · Contemporary — 页面交互
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

/* ===== 圆环专注计时器 ===== */
const RING_C = 377; // 与 styles.css --ring-circumference 保持一致
const heroFocus = document.querySelector(".hero-focus");
const ringWrap = document.querySelector(".hero-focus__ring");
const ringFill = document.getElementById("ringFill");
const timerText = document.getElementById("timerText");
const timerBtn = document.getElementById("timerBtn");
const timerBtnText = document.getElementById("timerBtnText");
const timerIcon = document.getElementById("timerIcon");
const focusBtn = document.getElementById("focusBtn");
const ICON_PLAY = '<path d="M7 5l12 7-12 7V5z" />';
const ICON_PAUSE = '<path d="M8 5v14M16 5v14" />';

let total = 25 * 60;
let remain = 25 * 60 - 2; // 初始 24:58
let running = false;
let tick = null;

function pad(n) {
  return String(n).padStart(2, "0");
}

function renderTimer() {
  timerText.textContent = `${pad(Math.floor(remain / 60))}:${pad(remain % 60)}`;
  const progress = total > 0 ? 1 - remain / total : 1;
  ringFill.style.strokeDashoffset = String(RING_C * (1 - progress));
  const min = Math.floor(remain / 60);
  const sec = remain % 60;
  ringWrap.setAttribute(
    "aria-label",
    `本次专注剩余 ${min} 分 ${sec} 秒，进度 ${Math.round(progress * 100)}%`
  );
}

function setRunningUI() {
  heroFocus.classList.toggle("is-running", running);
  timerBtnText.textContent = running ? "暂停专注" : remain < total ? "继续专注" : "开始专注";
  timerIcon.innerHTML = running ? ICON_PAUSE : ICON_PLAY;
  focusBtn.textContent = running ? "暂停专注" : "开始专注";
}

function stopTimer(done) {
  running = false;
  clearInterval(tick);
  tick = null;
  setRunningUI();
  if (done) {
    showToast("专注完成 · 记得休息 5 分钟");
  }
}

function toggleTimer() {
  if (running) {
    stopTimer(false);
    showToast("已暂停 · 进度已保留");
    return;
  }
  running = true;
  setRunningUI();
  showToast("专注已开始 · 手机放远一点");
  tick = setInterval(() => {
    remain -= 1;
    if (remain <= 0) {
      remain = 0;
      renderTimer();
      stopTimer(true);
      return;
    }
    renderTimer();
  }, 1000);
}

timerBtn.addEventListener("click", toggleTimer);
focusBtn.addEventListener("click", () => {
  toggleTimer();
  if (running) heroFocus.scrollIntoView({ behavior: "smooth", block: "center" });
});

/* 时长切换：重置计时器 */
document.querySelectorAll(".mini-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".mini-chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    total = parseInt(chip.dataset.min, 10) * 60;
    remain = total;
    if (running) stopTimer(false);
    renderTimer();
    setRunningUI();
    showToast(`已切换为 ${chip.dataset.min} 分钟专注`);
  });
});

renderTimer();
setRunningUI();

/* ===== chip 筛选（任务状态） ===== */
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

/* ===== 完成 toggle ===== */
document.querySelectorAll(".feed-item__check").forEach((check) => {
  check.addEventListener("click", () => {
    const item = check.closest(".feed-item");
    const on = check.classList.toggle("is-on");
    check.setAttribute("aria-pressed", String(on));
    item.classList.toggle("is-done", on);
    item.dataset.kind = on ? "done" : "todo";
    const chipEl = item.querySelector(".feed-item__chip");
    chipEl.textContent = on ? "已完成" : "待办";
    if (on) {
      chipEl.dataset.level = "ok";
      item.querySelector(".feed-item__eta").textContent = "100%";
    } else {
      delete chipEl.dataset.level;
      item.querySelector(".feed-item__eta").textContent = "—";
    }
    showToast(on ? "已完成 · 干得漂亮" : "已重新打开任务");
  });
});

/* ===== 添加任务 ===== */
const taskInput = document.getElementById("taskInput");
const feedList = document.getElementById("feedList");
const CHECK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11" /></svg>';

function addTask() {
  const text = (taskInput.value || "").trim();
  if (!text) {
    taskInput.focus();
    showToast("先写点什么，再添加");
    return;
  }
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "todo";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">🆕</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 新任务 <em class="feed-item__chip">待办</em></span>
    </div>
    <b class="feed-item__eta">—</b>
    <button class="feed-item__check" type="button" aria-label="标记完成" aria-pressed="false">${CHECK_SVG}</button>`;
  li.querySelector(".feed-item__name").textContent = text;
  li.querySelector(".feed-item__check").addEventListener("click", (e) => {
    const check = e.currentTarget;
    const item = check.closest(".feed-item");
    const on = check.classList.toggle("is-on");
    check.setAttribute("aria-pressed", String(on));
    item.classList.toggle("is-done", on);
  });
  feedList.prepend(li);
  taskInput.value = "";
  showToast("任务已添加 · 待办");
}

document.getElementById("taskInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTask();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "专注") {
      toggleTimer();
    } else if (name === "统计") {
      document.querySelector(".bento-grid").scrollIntoView({ behavior: "smooth" });
    } else if (name === "习惯") {
      document.querySelector(".bento-grid").scrollIntoView({ behavior: "smooth" });
      showToast("习惯打卡：今日 3/4，还差早睡");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

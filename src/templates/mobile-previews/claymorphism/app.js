// 爪爪日记 · Claymorphism 设计系统 — 页面交互
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

/* ===== 动态类型 chip 筛选 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".feed__head .chip");

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

/* ===== 完成 toggle：按压态 + 状态 chip 联动 ===== */
const statusText = {
  done: "已完成",
  todo: "待办",
  late: "逾期"
};

document.querySelectorAll(".feed-item__check").forEach((check) => {
  check.addEventListener("click", () => {
    const item = check.closest(".feed-item");
    const wasDone = item.classList.contains("is-done");
    const wasLate = item.classList.contains("is-late");
    const done = item.classList.toggle("is-done", !wasDone);
    item.classList.toggle("is-late", wasLate && !done);
    check.setAttribute("aria-pressed", String(done));
    const label = item.querySelector(".feed-item__status");
    if (label) label.textContent = done ? statusText.done : wasLate ? statusText.late : statusText.todo;
    showToast(done ? "已打卡，豆豆很开心" : "已恢复为待办");
  });
});

/* ===== 快速记录类型 chip 单选 ===== */
const quickChips = document.querySelectorAll(".quick-chip");
let activeType = { type: "喂养", glyph: "🍖" };

quickChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    quickChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    activeType = { type: chip.dataset.type, glyph: chip.dataset.glyph };
    showToast(`已选「${chip.textContent.trim()}」`);
  });
});

/* ===== 记一次：写入今日动态顶部 ===== */
const feedList = document.getElementById("feedList");

function logActivity() {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const li = document.createElement("li");
  li.className = "feed-item is-done";
  li.dataset.kind = activeType.type === "喂养" ? "feed" : activeType.type === "外出" ? "walk" : "health";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">${activeType.glyph}</span>
    <div class="feed-item__body">
      <span class="feed-item__name">${activeType.type}记录</span>
      <span class="feed-item__meta">${time} · ${activeType.type} <em class="feed-item__status">已完成</em></span>
    </div>
    <button class="feed-item__check" type="button" aria-label="标记完成" aria-pressed="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__check").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const item = btn.closest(".feed-item");
    const done = item.classList.toggle("is-done");
    btn.setAttribute("aria-pressed", String(done));
    const label = item.querySelector(".feed-item__status");
    if (label) label.textContent = done ? statusText.done : statusText.todo;
  });
  feedList.prepend(li);
  showToast(`已记录一次${activeType.type}`);
}

document.getElementById("logBtn").addEventListener("click", logActivity);

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "今日") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else if (name === "动态") {
      document.getElementById("feedSection").scrollIntoView({ behavior: "smooth" });
    } else if (name === "记录") {
      logActivity();
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

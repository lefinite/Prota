// 豆历 · Modern — 页面交互
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

document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

/* ===== 冲煮流程推进 ===== */
const steps = ["焖蒸 30s", "第一段注水至 120g", "第二段注水至 200g", "第三段注水至 240g", "完成 · 静置 1 分钟"];
let stepIdx = 0;

document.getElementById("brewBtn").addEventListener("click", () => {
  if (stepIdx >= steps.length) {
    stepIdx = 0;
  }
  showToast(steps[stepIdx]);
  stepIdx += 1;
});

/* ===== 冲煮方式 chip ===== */
const methodChips = document.querySelectorAll(".chips--method .chip");
methodChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    methodChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`已选器具：${chip.textContent}`);
  });
});

/* ===== Feed 筛选 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 收藏笔记 ===== */
document.querySelectorAll(".star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.textContent = on ? "★" : "☆";
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "笔记已收藏" : "已取消收藏");
  });
});

/* ===== 记一杯 ===== */
const noteInput = document.getElementById("noteInput");
const feedList = document.querySelector(".feed__list");

function logCup() {
  const text = (noteInput.value || "").trim() || "这一杯很干净";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "filter";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">☕</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">V60 · 刚刚 · 待评分</span>
    </div>
    <button class="star" type="button" aria-label="收藏笔记" aria-pressed="false">☆</button>`;
  li.querySelector(".feed-item__name").textContent = text;
  const star = li.querySelector(".star");
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.textContent = on ? "★" : "☆";
  });
  feedList.prepend(li);
  noteInput.value = "";
  showToast("已记录第 8 杯，离本月纪录还差 3 杯");
}

document.getElementById("logBtn").addEventListener("click", logCup);
noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") logCup();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "记一杯") {
      noteInput.focus();
      showToast("写下这一杯的风味关键词");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

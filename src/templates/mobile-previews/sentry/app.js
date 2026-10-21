// 哨站 · Sentry 风格 — 页面交互
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

/* ===== Resolve ===== */
let resolved = false;

document.getElementById("resolveBtn").addEventListener("click", () => {
  if (resolved) {
    showToast("该问题已在观察期");
    return;
  }
  resolved = true;
  showToast("已 Resolve · 若 v2.14.1 复发将自动重开");
});

/* ===== Feed 筛选 + 搜索 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const filterChips = document.querySelectorAll(".feed .chip");
const searchInput = document.getElementById("searchInput");

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

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  feedItems.forEach((item) => {
    item.hidden = q && !item.textContent.toLowerCase().includes(q.toLowerCase());
  });
});

/* ===== 环境 chip ===== */
const envChips = document.querySelectorAll(".chips--env .chip");
envChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    envChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`环境：${chip.textContent}`);
  });
});

/* ===== 行点击：趋势重放 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    showToast(`打开问题：${item.querySelector(".feed-item__name").textContent.slice(0, 22)}…`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "告警") {
      showToast("告警规则 3 条 · 静默 1 条（发版窗口）");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

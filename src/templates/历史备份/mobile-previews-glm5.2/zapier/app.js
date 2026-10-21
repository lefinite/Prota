// mobile-previews/zapier — Automation Workspace
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / Zap 筛选 / 应用点击 / Toast

const statusTime = document.getElementById("statusTime");
function updateStatusTime() {
  if (!statusTime) return;
  const now = new Date();
  statusTime.textContent = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
updateStatusTime();
setInterval(updateStatusTime, 30000);

// Toast
const toastEl = document.getElementById("toast");
let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 1800);
}

// 任何带 data-toast 的按钮点击反馈
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// 底部 Tab 切换（仅本 Demo 的视觉高亮）
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) return; // FAB 走 toast
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// Zap 筛选
const filters = document.querySelectorAll("#zapFilters .filter-tab");
const zapItems = document.querySelectorAll("#zapList .zap-item");
filters.forEach((tab) => {
  tab.addEventListener("click", () => {
    filters.forEach((t) => {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    const filter = tab.dataset.filter;
    zapItems.forEach((item) => {
      let show = true;
      if (filter === "active") show = item.dataset.type === "active";
      if (filter === "paused") show = item.dataset.type === "paused";
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 应用卡片点击
const appCards = document.querySelectorAll(".app-card");
appCards.forEach((card) => {
  card.addEventListener("click", () => {
    const name = card.querySelector(".app-card__name");
    showToast(name ? name.textContent : "打开应用");
  });
});

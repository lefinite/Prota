// mobile-previews/ollama — Model Runner
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 模型筛选 / 复制命令 Toast

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
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 1400);
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
    showToast(label ? `Switched to ${label.textContent}` : "Switched");
  });
});

// 模型分类筛选
const tabPills = document.querySelectorAll("#modelTabs .tab-pill");
const modelItems = document.querySelectorAll("#modelList .model");
tabPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    tabPills.forEach((p) => {
      p.classList.remove("is-active");
      p.setAttribute("aria-selected", "false");
    });
    pill.classList.add("is-active");
    pill.setAttribute("aria-selected", "true");
    const tab = pill.dataset.tab;
    modelItems.forEach((item) => {
      const category = item.dataset.category;
      const show = tab === "all" || category === tab;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 复制命令功能
document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const terminalItem = btn.closest(".terminal-item");
    const code = terminalItem.querySelector(".terminal-code").textContent;
    // 模拟复制
    navigator.clipboard?.writeText(code).catch(() => {});
    showToast("Command copied");
  });
});

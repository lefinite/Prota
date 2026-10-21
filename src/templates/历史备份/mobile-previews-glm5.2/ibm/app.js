// mobile-previews/ibm — Carbon Task · IBM Design System
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 任务筛选 / 按钮 Toast / 输入框 focus

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

// 底部 Tab 切换（仅本 Demo 的视觉高亮 + underline 动画）
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) return;
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `已切换到「${label.textContent}」` : "已切换");
  });
});

// 任务筛选
const chips = document.querySelectorAll("#filterChips .chip");
const taskItems = document.querySelectorAll("#taskList .task");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    taskItems.forEach((item) => {
      const status = item.dataset.status;
      const show = filter === "all" ||
        (filter === "pending" && status === "pending") ||
        (filter === "done" && status === "done");
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 输入框搜索交互
const inputField = document.querySelector(".input-field");
const searchBtn = document.querySelector(".btn--icon");
if (inputField && searchBtn) {
  searchBtn.addEventListener("click", () => {
    const query = inputField.value.trim();
    showToast(query ? `搜索「${query}」` : "请输入搜索关键词");
  });
  inputField.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const query = inputField.value.trim();
      showToast(query ? `搜索「${query}」` : "请输入搜索关键词");
    }
  });
}

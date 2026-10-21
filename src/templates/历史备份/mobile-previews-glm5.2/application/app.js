// mobile-previews/application — 开发者工作台 · Application Design System
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 任务筛选 / 复选框交互 / 按钮 Toast

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
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 1600);
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

// 任务筛选
const filterChips = document.querySelectorAll("#filterChips .filter-chip");
const taskItems = document.querySelectorAll("#taskItems .task-item");
filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    taskItems.forEach((item) => {
      const type = item.dataset.type;
      const show = filter === "all" || type === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 复选框状态切换
document.querySelectorAll(".task-item__check input").forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    const taskItem = checkbox.closest(".task-item");
    const title = taskItem.querySelector(".task-item__title").textContent;
    if (checkbox.checked) {
      taskItem.style.opacity = "0.6";
      showToast(`已完成「${title}」`);
    } else {
      taskItem.style.opacity = "1";
      showToast(`已恢复「${title}」`);
    }
  });
});

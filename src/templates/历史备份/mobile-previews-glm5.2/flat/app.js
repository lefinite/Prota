// mobile-previews/flat — TaskFlow · Flat Design
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 任务筛选 / 按钮 Toast

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

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--add")) return;
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--add")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 任务筛选
const chips = document.querySelectorAll("#filterChips .chip");
const taskItems = document.querySelectorAll("#taskList .task-item");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    taskItems.forEach((item) => {
      const priority = item.dataset.priority;
      const show = filter === "all" ||
                   (filter === "high" && priority === "high") ||
                   (filter === "today" && priority === "high");
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 任务完成复选框
document.querySelectorAll(".task-check").forEach((check) => {
  check.addEventListener("click", (e) => {
    const taskItem = check.closest(".task-item");
    if (taskItem) {
      // 简单的完成动画
      check.style.background = "var(--accent)";
      check.style.color = "var(--accent-on)";
      check.style.borderColor = "var(--accent)";
      setTimeout(() => {
        taskItem.style.opacity = "0.5";
        taskItem.querySelector(".task-title").style.textDecoration = "line-through";
      }, 200);
    }
  });
});

// mobile-previews/minimal — Minimal Tasks
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 任务筛选 / 任务完成 toggle / Toast

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

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 任务筛选
const filterChips = document.querySelectorAll("#filterChips .filter-chip");
const taskItems = document.querySelectorAll("#taskList .task-item");
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
      const status = item.dataset.status;
      let show = filter === "all";
      if (filter === "pending") show = status === "pending";
      if (filter === "done") show = status === "done";
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 任务完成 toggle
const taskChecks = document.querySelectorAll(".task-check");
taskChecks.forEach((check) => {
  check.addEventListener("click", () => {
    const isChecked = check.classList.contains("is-checked");
    check.classList.toggle("is-checked");
    const taskItem = check.closest(".task-item");
    const taskTitle = taskItem.querySelector(".task-title");
    taskItem.dataset.status = isChecked ? "pending" : "done";
    taskTitle.classList.toggle("is-done", !isChecked);
    showToast(isChecked ? "任务已重新打开" : "任务已完成");
  });
});

// 添加新任务
const addTaskBtn = document.querySelector(".add-task-btn");
const addTaskInput = document.querySelector(".add-task-input");
if (addTaskBtn && addTaskInput) {
  addTaskBtn.addEventListener("click", () => {
    const text = addTaskInput.value.trim();
    if (text) {
      showToast("新任务已添加");
      addTaskInput.value = "";
    }
  });
  addTaskInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addTaskBtn.click();
    }
  });
}

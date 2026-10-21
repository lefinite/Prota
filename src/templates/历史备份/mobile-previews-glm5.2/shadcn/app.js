// mobile-previews/shadcn — TaskFlow · Task Management
// 保留：状态栏时间逻辑
// 页面：任务筛选 / Tab 切换 / 复选框交互 / Toast

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

// 今日日期
const todayDate = document.getElementById("todayDate");
if (todayDate) {
  const now = new Date();
  const options = { month: "long", day: "numeric" };
  todayDate.textContent = now.toLocaleDateString("en-US", options);
}

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

// 任务筛选 Tabs
const filterTabs = document.querySelectorAll("#taskFilter .filter-tab");
const taskItems = document.querySelectorAll("#taskList .task-item");
filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    filterTabs.forEach((t) => {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    const filter = tab.dataset.filter;
    taskItems.forEach((item) => {
      const status = item.dataset.status;
      const show = filter === "all" || status === filter || (filter === "completed" && status === "completed");
      item.classList.toggle("is-hidden", !show);
    });
    showToast(`Showing ${tab.textContent} tasks`);
  });
});

// 复选框交互
document.querySelectorAll(".task-checkbox input").forEach((checkbox) => {
  checkbox.addEventListener("change", (e) => {
    const taskItem = e.target.closest(".task-item");
    const taskTitle = taskItem.querySelector(".task-title");
    if (e.target.checked) {
      taskItem.classList.add("completed");
      taskTitle.classList.add("task-title--done");
      showToast("Task completed!");
    } else {
      taskItem.classList.remove("completed");
      taskTitle.classList.remove("task-title--done");
      showToast("Task reopened");
    }
  });
});

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `${label.textContent}` : "Switched");
  });
});

// mobile-previews/clean — 清简清单 · Clean
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 任务筛选 / 复选框 Toggle / Toast

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

// 更新日期显示
const brandDate = document.getElementById("brandDate");
if (brandDate) {
  const now = new Date();
  brandDate.textContent = now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).replace(/\//g, ".");
}

// Toast
const toastEl = document.getElementById("toast");
let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 1500);
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
const filterTabs = document.querySelectorAll("#filterTabs .filter-tab");
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
      let show = false;
      if (filter === "all") show = true;
      else if (filter === "pending") show = status === "pending";
      else if (filter === "done") show = status === "done";
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 复选框 Toggle
const checkboxes = document.querySelectorAll(".task-checkbox input");
checkboxes.forEach((cb) => {
  cb.addEventListener("change", () => {
    const taskItem = cb.closest(".task-item");
    if (taskItem) {
      const isChecked = cb.checked;
      taskItem.classList.toggle("task-item--done", isChecked);
      taskItem.dataset.status = isChecked ? "done" : "pending";
      showToast(isChecked ? "任务已完成" : "任务已恢复");
    }
  });
});

// 快速添加任务
const taskInput = document.getElementById("taskInput");
const addBtn = document.querySelector(".add-btn");
const taskList = document.getElementById("taskList");

function addTask() {
  const text = taskInput?.value.trim();
  if (!text) return;

  const newTask = document.createElement("li");
  newTask.className = "task-item";
  newTask.dataset.status = "pending";
  newTask.innerHTML = `
    <label class="task-checkbox">
      <input type="checkbox" aria-label="标记为完成" />
      <span class="checkbox-mark"></span>
    </label>
    <span class="task-text">${text}</span>
    <span class="task-tag task-tag--medium">中</span>
  `;

  // 绑定新任务的事件
  const newCheckbox = newTask.querySelector("input");
  newCheckbox.addEventListener("change", () => {
    newTask.classList.toggle("task-item--done", newCheckbox.checked);
    newTask.dataset.status = newCheckbox.checked ? "done" : "pending";
  });

  taskList?.prepend(newTask);
  taskInput.value = "";
  showToast("任务已添加");
}

addBtn?.addEventListener("click", addTask);
taskInput?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") addTask();
});

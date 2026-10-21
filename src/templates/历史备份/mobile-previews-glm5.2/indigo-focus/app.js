// mobile-previews/indigo-focus — FlowSync
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 任务筛选 / 任务切换 / 按钮 Toast

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
    if (tab.classList.contains("tab--fab")) {
      showToast("添加新任务");
      return;
    }
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
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
      const state = item.dataset.state;
      const show = filter === "all" ||
                   (filter === "active" && state === "active") ||
                   (filter === "done" && state === "done");
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 任务切换（点击圆形复选框）
document.querySelectorAll(".task__check").forEach((check) => {
  check.addEventListener("click", () => {
    const task = check.closest(".task");
    const isDone = task.classList.contains("task--done");

    if (isDone) {
      // 取消完成
      task.classList.remove("task--done");
      task.dataset.state = "active";
      check.classList.remove("task__check--checked");
      check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
      task.querySelector(".task__title").classList.remove("task__title--done");
      const priority = task.querySelector(".task__priority");
      if (priority) {
        priority.classList.remove("task__priority--done");
        priority.classList.add("task__priority--high");
        priority.textContent = "高";
      }
      showToast("任务已恢复");
    } else {
      // 标记完成
      task.classList.add("task--done");
      task.dataset.state = "done";
      check.classList.add("task__check--checked");
      check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>';
      task.querySelector(".task__title").classList.add("task__title--done");
      const priority = task.querySelector(".task__priority");
      if (priority) {
        priority.classList.remove("task__priority--high", "task__priority--normal");
        priority.classList.add("task__priority--done");
        priority.textContent = "完成";
      }
      showToast("任务已完成！");
    }
  });
});

// 快速添加任务
const quickInput = document.querySelector(".quick-input");
const addBtn = document.querySelector(".btn--icon");
if (quickInput && addBtn) {
  const addTask = () => {
    const text = quickInput.value.trim();
    if (!text) {
      showToast("请输入任务内容");
      return;
    }

    const taskList = document.getElementById("taskList");
    const newTask = document.createElement("li");
    newTask.className = "task";
    newTask.dataset.state = "active";
    newTask.innerHTML = `
      <span class="task__check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
      </span>
      <div class="task__main">
        <span class="task__title">${text}</span>
        <span class="task__sub">刚刚 · 待办</span>
      </div>
      <div class="task__right">
        <span class="task__priority task__priority--normal">中</span>
      </div>
    `;

    // 添加切换事件
    const check = newTask.querySelector(".task__check");
    check.addEventListener("click", () => {
      const task = check.closest(".task");
      task.classList.toggle("task--done");
      task.dataset.state = task.classList.contains("task--done") ? "done" : "active";
      check.classList.toggle("task__check--checked");
      check.innerHTML = task.classList.contains("task--done")
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
      task.querySelector(".task__title").classList.toggle("task__title--done");
      const priority = task.querySelector(".task__priority");
      if (priority) {
        priority.classList.toggle("task__priority--done");
        priority.classList.toggle("task__priority--normal");
        priority.textContent = task.classList.contains("task--done") ? "完成" : "中";
      }
      showToast(task.classList.contains("task--done") ? "任务已完成！" : "任务已恢复");
    });

    taskList.insertBefore(newTask, taskList.firstChild);
    quickInput.value = "";
    showToast("任务已添加");
  };

  addBtn.addEventListener("click", addTask);
  quickInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addTask();
  });
}

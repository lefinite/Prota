// mobile-previews/material — TaskFlow · Material Design
// 保留：状态栏时间逻辑
// 页面：任务 Checkbox 切换 / 筛选 Chip / 底部 Nav / Snackbar

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

// Snackbar (Material Design Toast)
const snackbarEl = document.getElementById("snackbar");
const snackbarText = snackbarEl?.querySelector(".snackbar__text");
const snackbarAction = snackbarEl?.querySelector(".snackbar__action");
let snackbarTimer = null;
let snackbarActionCallback = null;

function showSnackbar(msg, actionText = null, actionCallback = null) {
  if (!snackbarEl || !snackbarText) return;
  snackbarText.textContent = msg;
  if (actionText && snackbarAction) {
    snackbarAction.textContent = actionText;
    snackbarAction.style.display = "block";
    snackbarActionCallback = actionCallback;
  } else if (snackbarAction) {
    snackbarAction.style.display = "none";
    snackbarActionCallback = null;
  }
  snackbarEl.classList.add("is-show");
  clearTimeout(snackbarTimer);
  snackbarTimer = setTimeout(() => {
    snackbarEl.classList.remove("is-show");
    snackbarActionCallback = null;
  }, 4000);
}

// Snackbar action click
if (snackbarAction) {
  snackbarAction.addEventListener("click", () => {
    if (snackbarActionCallback) {
      snackbarActionCallback();
    }
    snackbarEl.classList.remove("is-show");
  });
}

// 任何带 data-toast 的按钮点击反馈
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => {
    showSnackbar(el.dataset.toast);
  });
});

// 任务 Checkbox 切换
const taskCheckboxes = document.querySelectorAll(".task-checkbox");
taskCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("click", (e) => {
    const taskItem = checkbox.closest(".task-item");
    const isCompleted = taskItem.classList.toggle("task-item--completed");
    const taskTitle = taskItem.querySelector(".task-title")?.textContent || "任务";

    if (isCompleted) {
      showSnackbar(`已完成：${taskTitle}`, "撤销", () => {
        taskItem.classList.remove("task-item--completed");
      });
    } else {
      showSnackbar(`已恢复：${taskTitle}`);
    }
  });
});

// 筛选 Chips
const chips = document.querySelectorAll(".chips-row .chip");
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
      const show = filter === "all" || item.dataset.category === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 底部 Nav 切换（仅视觉高亮）
const navItems = document.querySelectorAll(".bottom-nav .nav-item");
navItems.forEach((nav) => {
  nav.addEventListener("click", () => {
    navItems.forEach((n) => n.classList.remove("is-active"));
    nav.classList.add("is-active");
    const label = nav.querySelector("span");
    showSnackbar(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// mobile-previews/contemporary — WorkGrid · 现代项目协作
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 任务筛选 / 复选框交互 / Toast

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
    if (tab.classList.contains("tab--fab")) return;
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 任务筛选
const chips = document.querySelectorAll("#taskChips .chip");
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
      const isChecked = item.querySelector(".task-check").classList.contains("is-checked");
      const isDone = item.dataset.type === "done";
      let show = filter === "all";
      if (filter === "todo") show = !isDone;
      if (filter === "done") show = isDone;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 任务复选框交互
document.querySelectorAll(".task-check").forEach((check) => {
  check.addEventListener("click", (e) => {
    e.stopPropagation();
    const isChecked = check.classList.contains("is-checked");
    check.classList.toggle("is-checked");
    const taskItem = check.closest(".task");
    const taskTitle = taskItem.querySelector(".task-title");
    const taskTag = taskItem.querySelector(".task-tag");
    const taskMeta = taskItem.querySelector(".task-meta");

    if (!isChecked) {
      taskTitle.classList.add("task-title--done");
      taskItem.dataset.type = "done";
      taskMeta.textContent = taskMeta.textContent.replace("· 高优先级", "· 已完成").replace("· 中优先级", "· 已完成").replace("· 今天截止", "· 已完成");
      if (taskTag) {
        taskTag.textContent = "完成";
        taskTag.className = "task-tag task-tag--done";
      }
      showToast("任务已标记完成");
    } else {
      taskTitle.classList.remove("task-title--done");
      taskItem.dataset.type = "todo";
      showToast("任务已重新打开");
    }
  });
});

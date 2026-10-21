// mobile-previews/simple — 简事 · Simple Design System
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 任务筛选 / 任务完成 toggle / 按钮 Toast

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
    if (tab.classList.contains("tab--fab")) {
      showToast("新建任务");
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
      const status = item.dataset.status;
      const show = filter === "all" || status === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 任务完成 toggle
document.querySelectorAll(".task__check input").forEach((checkbox) => {
  checkbox.addEventListener("change", (e) => {
    const taskItem = e.target.closest(".task");
    const taskTitle = taskItem.querySelector(".task__title");
    if (e.target.checked) {
      taskTitle.classList.add("task__title--done");
      taskItem.dataset.status = "done";
      showToast("任务已完成");
    } else {
      taskTitle.classList.remove("task__title--done");
      taskItem.dataset.status = "pending";
      showToast("任务标记为待办");
    }
  });
});

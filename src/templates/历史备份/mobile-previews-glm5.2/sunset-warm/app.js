// mobile-previews/sunset-warm — 橘光生活
// 保留：状态栏时间逻辑
// 页面：心情选择 / 任务勾选 / Tab 切换

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

// 任何带 data-toast 的元素点击反馈
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// 心情选择
const moodEmojis = document.querySelectorAll(".mood-emoji");
moodEmojis.forEach((emoji) => {
  emoji.addEventListener("click", () => {
    moodEmojis.forEach((e) => e.classList.remove("is-active"));
    emoji.classList.add("is-active");
  });
});

// 底部 Tab 切换（仅本 Demo 的视觉高亮）
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) return;
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span:last-child");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 任务勾选
const taskCheckboxes = document.querySelectorAll(".task__checkbox input");
taskCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    const taskItem = checkbox.closest(".task");
    const taskTitle = taskItem.querySelector(".task__title");
    if (checkbox.checked) {
      taskTitle.classList.add("completed");
    } else {
      taskTitle.classList.remove("completed");
    }
    // 更新进度
    const total = taskCheckboxes.length;
    const completed = document.querySelectorAll(".task__checkbox input:checked").length;
    const progressFill = document.querySelector(".progress-bar__fill");
    if (progressFill) {
      const percentage = (completed / total) * 100;
      progressFill.style.setProperty("--progress", `${percentage}%`);
    }
    // 更新计数
    const taskCount = document.querySelector(".task-count");
    if (taskCount) {
      taskCount.textContent = `${completed}/${total} 完成`;
    }
  });
});

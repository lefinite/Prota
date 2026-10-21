// mobile-previews/bold — BOLD WORKSPACE
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
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 1800);
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
      showToast("创建新任务");
      return;
    }
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `已切换到「${label.textContent}」` : "已切换");
  });
});

// 任务筛选
const chips = document.querySelectorAll("#filterChips .chip");
const taskItems = document.querySelectorAll("#taskList .task-item");
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
      if (filter === "all") {
        item.classList.toggle("is-hidden", false);
      } else if (filter === "todo") {
        item.classList.toggle("is-hidden", item.dataset.type !== "todo");
      } else if (filter === "done") {
        item.classList.toggle("is-hidden", item.dataset.type !== "done");
      }
    });
  });
});

// 任务完成 toggle
document.querySelectorAll(".task-item__check").forEach((checkBtn) => {
  checkBtn.addEventListener("click", () => {
    const item = checkBtn.closest(".task-item");
    const title = item.querySelector(".task-item__title");
    const badge = item.querySelector(".task-item__badge");

    if (checkBtn.classList.contains("task-item__check--checked")) {
      // 取消完成
      checkBtn.classList.remove("task-item__check--checked");
      checkBtn.setAttribute("aria-label", "标记完成");
      title.classList.remove("task-item__title--done");
      item.dataset.type = "todo";
      badge.className = "task-item__badge task-item__badge--high";
      badge.textContent = "HIGH";
      showToast("任务已恢复");
    } else {
      // 标记完成
      checkBtn.classList.add("task-item__check--checked");
      checkBtn.setAttribute("aria-label", "标记未完成");
      title.classList.add("task-item__title--done");
      item.dataset.type = "done";
      badge.className = "task-item__badge task-item__badge--done";
      badge.textContent = "DONE";
      showToast("任务已完成");
    }

    // 如果当前筛选器不是"全部"，需要更新可见性
    const activeChip = document.querySelector("#filterChips .chip.is-active");
    if (activeChip && activeChip.dataset.filter !== "all") {
      const filter = activeChip.dataset.filter;
      item.classList.toggle("is-hidden", item.dataset.type !== filter);
    }
  });
});

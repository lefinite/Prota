// mobile-previews/claymorphism — 泥泥星球 · Claymorphism
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 任务按钮 / 好友互动 / Toast

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
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 2000);
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

// 任务按钮点击
const taskBtns = document.querySelectorAll(".task-btn");
taskBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    // 找到对应的任务项
    const taskItem = btn.closest(".task-item");
    if (taskItem && !taskItem.classList.contains("task-item--done")) {
      showToast(btn.dataset.toast || "任务进行中...");
    }
  });
});

// 好友互动
const friendActions = document.querySelectorAll(".friend-action");
friendActions.forEach((btn) => {
  btn.addEventListener("click", () => {
    const friendCard = btn.closest(".friend-card");
    const friendName = friendCard?.querySelector(".friend-name")?.textContent || "好友";
    showToast(`向 ${friendName} 打了招呼`);
    // 添加一个小动画
    btn.style.transform = "scale(1.2)";
    setTimeout(() => btn.style.transform = "", 200);
  });
});

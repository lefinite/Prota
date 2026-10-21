// mobile-previews/duolingo — 多语鸟
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 课程节点点击 / 按钮 Toast

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

// 课程节点点击
const lessonNodes = document.querySelectorAll(".lesson-node");
lessonNodes.forEach((node) => {
  node.addEventListener("click", () => {
    if (node.classList.contains("lesson-node--locked")) {
      showToast("先完成前面的课程解锁！");
      return;
    }
    if (node.classList.contains("lesson-node--done")) {
      showToast("查看课程回顾");
    } else if (node.classList.contains("lesson-node--active")) {
      showToast("开始学习！");
    }
  });
});

// 连续打卡互动
const streakPill = document.querySelector(".streak-pill");
if (streakPill) {
  streakPill.addEventListener("click", () => {
    showToast("🔥 已连续打卡 7 天！");
  });
}

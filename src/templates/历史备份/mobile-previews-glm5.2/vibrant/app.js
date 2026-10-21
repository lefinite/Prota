// mobile-previews/vibrant — Creative Hub
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 收藏 toggle / 按钮 Toast

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
      showToast("开始新创作 ✨");
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

// 灵感收藏 toggle
const ideaActions = document.querySelectorAll(".idea-action");
ideaActions.forEach((btn) => {
  btn.addEventListener("click", () => {
    const isActive = btn.classList.contains("idea-action--active");
    const svg = btn.querySelector("svg");

    if (isActive) {
      btn.classList.remove("idea-action--active");
      svg.setAttribute("fill", "none");
      showToast("取消收藏");
    } else {
      btn.classList.add("idea-action--active");
      svg.setAttribute("fill", "currentColor");
      showToast("已收藏 💫");
    }
  });
});

// 查看全部按钮
const seeAllBtn = document.querySelector(".see-all");
if (seeAllBtn) {
  seeAllBtn.addEventListener("click", () => {
    showToast("查看所有进行中的创作");
  });
}

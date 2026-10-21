// mobile-previews/miro — IdeaBoard · Miro
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 便签互动 / 按钮 Toast

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
      showToast("创建新画板");
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

// 便签点击互动
document.querySelectorAll(".sticky-note").forEach((note) => {
  note.addEventListener("click", () => {
    const text = note.querySelector(".sticky-note__text").textContent;
    showToast(`编辑便签：${text.substring(0, 8)}...`);
  });
});

// 画板卡片点击
document.querySelectorAll(".board").forEach((board) => {
  board.addEventListener("click", () => {
    const title = board.querySelector(".board__title").textContent;
    showToast(`打开画板：${title}`);
  });
});

// 头像点击（模拟查看用户信息）
document.querySelectorAll(".avatar").forEach((avatar) => {
  avatar.addEventListener("click", (e) => {
    e.stopPropagation();
    showToast("查看用户信息");
  });
});

// 活动项点击
document.querySelectorAll(".activity-item").forEach((item) => {
  item.addEventListener("click", () => {
    showToast("查看相关画板");
  });
});

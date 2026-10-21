// mobile-previews/discord — Gaming Voice Lounge
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 成员筛选 / 服务器点击 / 按钮 Toast

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
    if (tab.classList.contains("tab--fab")) return; // FAB 走 toast
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 成员筛选
const memberChips = document.querySelectorAll("#memberFilterChips .chip");
const memberItems = document.querySelectorAll("#memberList .member-item");
memberChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    memberChips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    memberItems.forEach((item) => {
      const show = filter === "all" || item.dataset.type === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 服务器项交互（圆角方形 → 圆形过渡）
const serverItems = document.querySelectorAll(".server-item:not(.server-item--home):not(.server-item--add)");
serverItems.forEach((item) => {
  item.addEventListener("mouseenter", () => {
    // 视觉效果已在 CSS 中通过 hover 实现
  });
  // 点击服务器时的状态切换
  if (!item.dataset.toast) {
    item.addEventListener("click", () => {
      serverItems.forEach(si => si.classList.remove("server-item--active"));
      item.classList.add("server-item--active");
    });
  }
});

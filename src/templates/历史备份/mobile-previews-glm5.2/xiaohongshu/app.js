// mobile-previews/xiaohongshu — 小红书
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 点赞收藏 / 话题点击 / Toast

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

// 话题点击
const topicChips = document.querySelectorAll(".topic-chip");
topicChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const text = chip.textContent.replace("HOT", "").trim();
    showToast(`查看话题「${text}」`);
  });
});

// 收藏按钮切换
const likeBtns = document.querySelectorAll(".like-btn");
likeBtns.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const svg = btn.querySelector("svg");
    const isLiked = svg.getAttribute("fill") === "currentColor";

    if (isLiked) {
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      showToast("已取消收藏");
    } else {
      svg.setAttribute("fill", "currentColor");
      svg.setAttribute("stroke", "none");
      showToast("已收藏");
    }
  });
});

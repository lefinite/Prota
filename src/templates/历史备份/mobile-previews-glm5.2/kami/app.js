// mobile-previews/kami — 晨间阅读 · Kami
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 文章收藏 / Toast

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

// 底部 Tab 切换（视觉高亮）
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 文章卡片点击模拟
document.querySelectorAll(".article-card").forEach((card) => {
  card.addEventListener("click", () => {
    const title = card.querySelector(".article-card__title")?.textContent || "文章";
    showToast(`正在打开「${title.slice(0, 8)}...」`);
  });
});

// 文章列表项点击
document.querySelectorAll(".article-item").forEach((item) => {
  item.addEventListener("click", () => {
    const title = item.querySelector(".article-item__title")?.textContent || "文章";
    const isRead = item.querySelector(".tag--read");
    if (!isRead) {
      // 标记为已读
      const tag = item.querySelector(".tag");
      if (tag) {
        tag.textContent = "已读";
        tag.classList.add("tag--read");
      }
      showToast(`已标记「${title.slice(0, 6)}...」为已读`);
    } else {
      showToast(`打开「${title.slice(0, 6)}...」`);
    }
  });
});

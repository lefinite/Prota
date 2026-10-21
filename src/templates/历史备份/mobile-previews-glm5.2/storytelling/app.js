// mobile-previews/storytelling — 故事集 · Narrative & Content
// 保留：状态栏时间逻辑
// 页面：故事筛选 / 收藏 toggle / Tab 切换 / Toast

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

// 故事类型筛选
const storyChips = document.querySelectorAll("#storyChips .chip");
const feedItems = document.querySelectorAll("#feedList .feed-item");
storyChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    storyChips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      const show = filter === "all" || item.dataset.category === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 收藏 toggle
document.querySelectorAll(".bookmark-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const isActive = btn.classList.contains("bookmark-btn--active");
    const svg = btn.querySelector("svg");

    if (isActive) {
      btn.classList.remove("bookmark-btn--active");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      showToast("已取消收藏");
    } else {
      btn.classList.add("bookmark-btn--active");
      svg.setAttribute("fill", "currentColor");
      svg.setAttribute("stroke", "currentColor");
      showToast("已收藏");
    }
  });
});

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--create")) return;
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--create")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

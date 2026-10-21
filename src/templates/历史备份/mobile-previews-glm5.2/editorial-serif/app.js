// mobile-previews/editorial-serif — 墨香阅读 · Editorial Serif
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 分类筛选 / 收藏 toggle / 按钮 Toast

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

// 分类筛选
const categoryChips = document.querySelectorAll(".category-chips .category-chip");
const articleItems = document.querySelectorAll(".article-item");
categoryChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    categoryChips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const category = chip.dataset.category;
    articleItems.forEach((item) => {
      const itemCategory = item.dataset.category || "culture";
      const show = category === "all" || itemCategory === category;
      item.classList.toggle("is-hidden", !show);
    });
    showToast(`筛选：${chip.textContent}`);
  });
});

// 收藏按钮 toggle
document.querySelectorAll(".bookmark-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const isBookmarked = btn.getAttribute("data-bookmark") === "true";
    const newState = !isBookmarked;
    btn.setAttribute("data-bookmark", String(newState));
    btn.setAttribute("aria-label", newState ? "收藏已" : "收藏");

    if (newState) {
      btn.style.color = "var(--accent)";
      btn.querySelector("svg").style.fill = "currentColor";
      showToast("已收藏");
    } else {
      btn.style.color = "var(--border)";
      btn.querySelector("svg").style.fill = "none";
      showToast("取消收藏");
    }
  });
});

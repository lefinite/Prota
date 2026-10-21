// mobile-previews/modern — 晨光阅读 · Modern
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 文章筛选 / 收藏按钮 / Toast

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

// 文章筛选
const chips = document.querySelectorAll("#filterChips .chip");
const articleItems = document.querySelectorAll("#articleList .article");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    articleItems.forEach((item) => {
      const show = filter === "all" || item.dataset.type === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 收藏按钮切换
const saveBtns = document.querySelectorAll(".save-btn");
saveBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const isSaved = btn.classList.contains("is-saved");
    btn.classList.toggle("is-saved");
    // 触发 data-toast 消息
    if (isSaved) {
      showToast("已取消收藏");
    } else {
      showToast("已收藏");
    }
  });
});

// 分类卡片点击（仅 Demo 效果）
const categoryCards = document.querySelectorAll(".category-card");
categoryCards.forEach((card) => {
  card.addEventListener("click", () => {
    const label = card.querySelector("span");
    showToast(label ? `浏览「${label.textContent}」分类` : "切换分类");
  });
});

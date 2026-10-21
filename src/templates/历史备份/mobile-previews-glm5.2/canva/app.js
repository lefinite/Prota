// mobile-previews/canva — Creative Studio
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 分类筛选 / 收藏 Toggle / Toast

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

// 分类芯片筛选
const catChips = document.querySelectorAll(".category-row .cat-chip");
const templateCards = document.querySelectorAll(".template-card");
catChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    catChips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const cat = chip.dataset.cat;
    templateCards.forEach((card) => {
      const show = cat === "all" || card.dataset.type === cat;
      card.style.display = show ? "" : "none";
    });
    const label = chip.textContent;
    showToast(`筛选：${label}`);
  });
});

// 收藏 Toggle
const likeBtns = document.querySelectorAll(".template-card__like");
likeBtns.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isLiked = btn.classList.toggle("is-liked");
    const card = btn.closest(".template-card");
    const title = card.querySelector(".template-card__title").textContent;
    showToast(isLiked ? `已收藏「${title}」` : `取消收藏`);
  });
});

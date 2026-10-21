// mobile-previews/kraken — 深海交易 · Kraken
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 市场卡片 / 交易列表 / Toast

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

// 底部 Tab 切换（视觉高亮）
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) return;
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// FAB 交易按钮
const fabBtn = document.querySelector(".tab--fab");
if (fabBtn) {
  fabBtn.addEventListener("click", () => {
    showToast("打开交易面板");
  });
}

// 市场卡片点击
document.querySelectorAll(".market-card").forEach((card) => {
  card.addEventListener("click", () => {
    const name = card.querySelector(".market-card__name")?.textContent || "市场";
    const price = card.querySelector(".market-card__price")?.textContent || "";
    showToast(`${name}: ${price}`);
  });
});

// 交易列表项点击
document.querySelectorAll(".tx").forEach((item) => {
  item.addEventListener("click", () => {
    const title = item.querySelector(".tx__title")?.textContent || "交易";
    showToast(`查看详情：${title}`);
  });
});

// 筛选按钮
const filterBtn = document.querySelector(".filter-btn");
if (filterBtn) {
  filterBtn.addEventListener("click", () => {
    showToast("打开筛选器");
  });
}

// 价格预警卡片
const alertCard = document.querySelector(".alert-card");
if (alertCard) {
  alertCard.addEventListener("click", () => {
    showToast("管理价格预警");
  });
}

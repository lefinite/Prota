// mobile-previews/uber — City Go
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 分类导航 / 车型选择 / 按钮 Toast

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

// Button Toast Feedback
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// Tab Navigation
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

// Category Pill Navigation (Signature: Inversion on active)
const categoryPills = document.querySelectorAll(".category-pill");
categoryPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    categoryPills.forEach((p) => p.classList.remove("is-active"));
    pill.classList.add("is-active");
    const category = pill.dataset.category;
    const categoryNames = { ride: "出行", package: "快递", food: "外卖", reserve: "预约" };
    showToast(`切换到「${categoryNames[category] || category}」`);
  });
});

// Ride Card Selection
const rideCards = document.querySelectorAll(".ride-card");
rideCards.forEach((card) => {
  card.addEventListener("click", () => {
    rideCards.forEach((c) => c.classList.remove("ride-card--selected"));
    card.classList.add("ride-card--selected");
    const rideName = card.querySelector(".ride-name").textContent;
    showToast(`已选择「${rideName}」`);
  });
});

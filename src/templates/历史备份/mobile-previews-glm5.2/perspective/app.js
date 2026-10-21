// mobile-previews/perspective — 视角空间 · Perspective
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 购物车操作 / 产品 Toast

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

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) {
      showToast("购物车 · 3 件商品");
      return;
    }
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 分类卡片点击
document.querySelectorAll(".category-card").forEach((card) => {
  card.addEventListener("click", () => {
    const name = card.querySelector(".category-card__name")?.textContent || "分类";
    showToast(`浏览「${name}」`);
  });
});

// 产品列表项点击
document.querySelectorAll(".product-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    if (e.target.closest(".add-btn")) return;
    const title = item.querySelector(".product-item__title")?.textContent || "产品";
    showToast(`查看「${title}」`);
  });
});

// 闪购卡片点击
document.querySelector(".flash-card")?.addEventListener("click", () => {
  showToast("查看闪购详情");
});

// 倒计时动态效果
function updateTimer() {
  const timerBlocks = document.querySelectorAll(".timer-block");
  if (timerBlocks.length < 3) return;

  // 模拟倒计时递减
  let hours = parseInt(timerBlocks[0].textContent) || 2;
  let minutes = parseInt(timerBlocks[1].textContent) || 48;
  let seconds = parseInt(timerBlocks[2].textContent) || 36;

  seconds--;
  if (seconds < 0) {
    seconds = 59;
    minutes--;
    if (minutes < 0) {
      minutes = 59;
      hours--;
      if (hours < 0) {
        hours = 2;
        minutes = 48;
        seconds = 36;
      }
    }
  }

  timerBlocks[0].textContent = String(hours).padStart(2, "0");
  timerBlocks[1].textContent = String(minutes).padStart(2, "0");
  timerBlocks[2].textContent = String(seconds).padStart(2, "0");
}

// 每秒更新倒计时
setInterval(updateTimer, 1000);

// 购物车数量更新动画
let cartCount = 3;
function updateCartCount(change) {
  const badge = document.querySelector(".tab-badge");
  if (!badge) return;

  cartCount += change;
  if (cartCount < 0) cartCount = 0;
  badge.textContent = cartCount;

  // 添加缩放动画
  badge.style.animation = "badge-bump 300ms ease-out";
  setTimeout(() => badge.style.animation = "", 300);
}

// 为添加按钮绑定购物车更新
document.querySelectorAll(".add-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    updateCartCount(1);
  });
});

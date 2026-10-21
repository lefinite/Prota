// mobile-previews/trading-terminal — Crypto Pro Trading Terminal
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 订单簿筛选 / 按钮 Toast / 价格闪烁

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

// Order Book Filter
const chips = document.querySelectorAll("#orderBookChips .chip");
const orderRows = document.querySelectorAll(".order-row");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    orderRows.forEach((row) => {
      const show = filter === "both" || row.dataset.type === filter;
      row.style.display = show ? "grid" : "none";
    });
  });
});

// Price Flash Animation (Simulated)
const priceElements = document.querySelectorAll("[data-flash]");
function flashPrices() {
  priceElements.forEach((el) => {
    const flashType = el.dataset.flash;
    const animation = flashType === "gain" ? "flash-gain" : "flash-loss";
    el.style.animation = "none";
    el.offsetHeight; // Trigger reflow
    el.style.animation = `${animation} 0.6s ease-out`;
  });
}

// Simulate price updates every 5 seconds
setInterval(() => {
  // Flash animation only
  flashPrices();
}, 5000);

// mobile-previews/futuristic — Orbit 币 · Futuristic Design System
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 行情筛选 / 按钮 Toast / 实时数据模拟

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

// 底部 Tab 切换（仅本 Demo 的视觉高亮）
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) {
      showToast("进入交易页面");
      return;
    }
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 行情筛选
const chips = document.querySelectorAll("#marketChips .chip");
const marketItems = document.querySelectorAll("#marketList .market-item");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    marketItems.forEach((item) => {
      const show = filter === "all" || item.dataset.type === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 模拟实时价格更新（微动画效果）
function simulatePriceUpdate() {
  const priceElements = document.querySelectorAll(".market-item__price .price");
  priceElements.forEach(el => {
    // 随机选择部分价格进行"闪烁"更新效果
    if (Math.random() > 0.7) {
      el.style.opacity = "0.6";
      setTimeout(() => {
        el.style.opacity = "1";
      }, 200);
    }
  });
}

// 每5秒模拟一次价格更新
setInterval(simulatePriceUpdate, 5000);

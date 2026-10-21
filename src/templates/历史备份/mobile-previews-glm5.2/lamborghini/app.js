// mobile-previews/lamborghini — 终极座驾 · Lamborghini
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 驾驶模式 / 行程记录 / Toast

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

// 驾驶模式切换
const modeBtns = document.querySelectorAll(".mode-btn");
modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeBtns.forEach((b) => b.classList.remove("mode-btn--active"));
    btn.classList.add("mode-btn--active");
    const mode = btn.dataset.mode;
    const label = btn.querySelector(".mode-btn__name")?.textContent || mode;
    showToast(`${label} 模式已激活`);
  });
});

// Hero CTA 按钮
const ctaGold = document.querySelector(".cta-gold");
if (ctaGold) {
  ctaGold.addEventListener("click", () => {
    showToast("正在加载配置页面...");
  });
}

// 行程列表项点击
document.querySelectorAll(".drive-item").forEach((item) => {
  item.addEventListener("click", () => {
    const title = item.querySelector(".drive-item__title")?.textContent || "行程";
    const stat = item.querySelector(".drive-item__stat")?.textContent || "";
    showToast(`${title} · ${stat}`);
  });
});

// 车辆提醒卡片
const alertCard = document.querySelector(".alert-card");
if (alertCard) {
  alertCard.addEventListener("click", () => {
    showToast("预约服务中心");
  });
}

// 状态卡片点击
document.querySelectorAll(".status-card").forEach((card) => {
  card.addEventListener("click", () => {
    const label = card.querySelector(".status-card__label")?.textContent || "";
    const value = card.querySelector(".status-card__value")?.textContent || "";
    showToast(`${label}: ${value}`);
  });
});

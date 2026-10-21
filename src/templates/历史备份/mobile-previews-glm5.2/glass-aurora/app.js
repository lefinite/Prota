// mobile-previews/glass-aurora — 极光助手 AI
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 对话筛选 / 功能卡片 / 按钮 Toast

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

// 任何带 data-toast 的元素点击反馈
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

// 对话筛选
const chips = document.querySelectorAll(".chips .chip");
const chatItems = document.querySelectorAll("#chatList .chat-item");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    chatItems.forEach((item) => {
      const show = filter === "all" || item.dataset.time === filter || (filter === "week" && item.dataset.time !== "today");
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 功能卡片点击
const featureCards = document.querySelectorAll(".feature-card");
featureCards.forEach((card) => {
  card.addEventListener("click", () => {
    const feature = card.dataset.feature;
    const featureNames = {
      chat: "智能对话",
      write: "写作助手",
      code: "代码助手",
      image: "图像生成"
    };
    showToast(featureNames[feature] || "功能即将上线");
  });
});

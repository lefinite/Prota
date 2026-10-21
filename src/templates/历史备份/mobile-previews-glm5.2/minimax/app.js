// mobile-previews/minimax — 海螺 AI
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 模型选择 / 对话切换 / Toast

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
    if (tab.classList.contains("tab--fab")) return;
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// FAB 按钮单独处理
const fabTab = document.querySelector(".tab--fab");
if (fabTab) {
  fabTab.addEventListener("click", () => {
    showToast("开始新对话");
  });
}

// 模型卡片选择
const modelCards = document.querySelectorAll(".model-card");
modelCards.forEach((card) => {
  card.addEventListener("click", () => {
    const model = card.dataset.model;
    const modelName = card.querySelector(".model-card__name").textContent;
    showToast(`已选择 ${modelName}`);
  });
});

// 对话标签切换
const chatTabs = document.querySelectorAll("#chatTabs .chat-tab");
chatTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    chatTabs.forEach((t) => {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    showToast(tab.dataset.tab === "recent" ? "最近对话" : "已收藏");
  });
});

// 消息点击交互
const messages = document.querySelectorAll(".message");
messages.forEach((msg) => {
  msg.addEventListener("click", () => {
    if (msg.classList.contains("message--user")) {
      showToast("用户消息");
    } else {
      showToast("AI 回复");
    }
  });
});

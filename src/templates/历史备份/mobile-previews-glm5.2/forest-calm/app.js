// mobile-previews/forest-calm — ForestMind · 森系自然
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 声音播放 / 呼吸动画 / 按钮 Toast

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
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 2000);
}

// 任何带 data-toast 的按钮点击反馈
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// 声音卡片切换
const soundCards = document.querySelectorAll(".sound-card");
soundCards.forEach((card) => {
  card.addEventListener("click", () => {
    soundCards.forEach((c) => c.classList.remove("sound-card--active"));
    card.classList.add("sound-card--active");
  });
});

// 呼吸引导文字更新
const breathLabel = document.getElementById("breathLabel");
if (breathLabel) {
  let isInhale = true;
  setInterval(() => {
    isInhale = !isInhale;
    breathLabel.textContent = isInhale ? "吸气" : "呼气";
  }, 4000);
}

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

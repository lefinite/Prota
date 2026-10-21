// mobile-previews/warm-editorial — Warm Editorial 阅读空间
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 文章筛选 / 按钮 Toast

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

// 文章分类筛选
const chips = document.querySelectorAll(".chips .chip");
const articleCards = document.querySelectorAll(".article-card");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("chip--active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("chip--active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    articleCards.forEach((card) => {
      const show = filter === "all" || card.dataset.category === filter;
      card.classList.toggle("is-hidden", !show);
    });
  });
});

// 模拟阅读进度动画更新
const progressBar = document.querySelector(".progress-card__bar-fill");
if (progressBar) {
  // 每次更新时触发动画
  function updateProgress() {
    const currentWidth = parseFloat(progressBar.style.getPropertyValue("--p")) || 65;
    const newWidth = Math.min(currentWidth + Math.random() * 2, 100);
    progressBar.style.setProperty("--p", `${newWidth}%`);
  }

  // 每 5 秒小幅增加进度
  setInterval(updateProgress, 5000);
}

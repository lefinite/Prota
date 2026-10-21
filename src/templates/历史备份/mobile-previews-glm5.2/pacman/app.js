// mobile-previews/pacman — Arcade Arena
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 排行榜筛选 / 按钮 Toast / 分数动画

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
  el.addEventListener("click", () => {
    showToast(el.dataset.toast);
    // 添加街机风格音效反馈（视觉上的闪烁）
    document.body.style.filter = "brightness(1.2)";
    setTimeout(() => {
      document.body.style.filter = "";
    }, 50);
  });
});

// 底部 Tab 切换（仅本 Demo 的视觉高亮）
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

// 排行榜筛选
const chips = document.querySelectorAll("#filterChips .chip");
const rankItems = document.querySelectorAll("#rankList .rank-item");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    rankItems.forEach((item) => {
      const show = filter === "all" || item.dataset.type === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 分数滚动动画效果
const scoreValue = document.getElementById("scoreValue");
if (scoreValue) {
  let currentScore = 1247800;
  const targetScores = [1247800, 1247900, 1248000];
  let scoreIndex = 0;

  // 模拟分数增加（街机游戏感）
  setInterval(() => {
    if (Math.random() > 0.7) { // 30% 概率增加分数
      currentScore += Math.floor(Math.random() * 200) + 50;
      scoreValue.textContent = currentScore.toLocaleString();
      // 闪烁效果
      scoreValue.style.color = "var(--success)";
      setTimeout(() => {
        scoreValue.style.color = "";
      }, 150);
    }
  }, 3000);
}

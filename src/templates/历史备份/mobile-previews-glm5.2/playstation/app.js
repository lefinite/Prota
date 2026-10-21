// mobile-previews/playstation — PlayStation 游戏
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 购物车交互 / 按钮 Toast / 1.2x 悬停缩放

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

// PlayStation 签名交互：悬停时 scale(1.2) + 青色背景 + 白色边框 + 蓝色外圈
function applyPlayStationHover(btn) {
  btn.addEventListener("mouseenter", function() {
    if (window.matchMedia("(hover: hover)").matches) {
      this.style.transform = "scale(1.2)";
      if (this.classList.contains("cta-commerce")) {
        this.style.background = "var(--accent-hover)";
        this.style.boxShadow = "0 0 0 2px #ffffff, 0 0 0 4px var(--commerce)";
      } else if (this.classList.contains("cta-secondary")) {
        this.style.background = "var(--accent-hover)";
        this.style.borderColor = "#ffffff";
        this.style.boxShadow = "0 0 0 2px #ffffff, 0 0 0 4px var(--accent)";
      } else if (this.classList.contains("btn-mini")) {
        this.style.background = "var(--accent-hover)";
        this.style.boxShadow = "0 0 0 2px #ffffff, 0 0 0 4px var(--accent)";
      } else if (this.classList.contains("tab--fab")) {
        this.style.background = "var(--accent-hover)";
        this.style.transform = "scale(1.2)";
        this.style.boxShadow = "0 0 0 2px #ffffff, 0 0 0 4px var(--accent)";
      }
    }
  });

  btn.addEventListener("mouseleave", function() {
    this.style.transform = "";
    this.style.background = "";
    this.style.borderColor = "";
    this.style.boxShadow = "";
  });

  btn.addEventListener("touchstart", function() {
    this.style.transform = "scale(1.15)";
  });

  btn.addEventListener("touchend", function() {
    this.style.transform = "";
  });
}

// 应用签名交互到所有按钮
document.querySelectorAll(".cta-commerce, .cta-secondary, .btn-mini, .tab--fab").forEach(applyPlayStationHover);

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

// 游戏卡片点击
document.querySelectorAll(".game-card, .promo-item").forEach((card) => {
  card.addEventListener("click", () => {
    const title = card.querySelector(".game-card__title, .promo-item__title")?.textContent;
    if (title) {
      showToast(`查看「${title.slice(0, 8)}...」详情`);
    }
  });
});

// mobile-previews/ferrari — Cavallino Control · Ferrari
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 驾驶模式选择 / 按钮 Toast

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
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 驾驶模式选择
const modeChips = document.querySelectorAll(".mode-chips .mode-chip");
modeChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    modeChips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-checked", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-checked", "true");
    const mode = chip.dataset.mode;
    const modeName = chip.textContent;

    // 模拟不同模式的反馈
    let feedback = "";
    switch (mode) {
      case "comfort":
        feedback = "舒适模式已激活";
        break;
      case "sport":
        feedback = "运动模式已激活";
        break;
      case "race":
        feedback = "赛道模式已激活";
        break;
      default:
        feedback = `${modeName}模式已激活`;
    }
    showToast(feedback);

    // 模拟速度表变化
    const speedValue = document.querySelector(".speedo-value");
    const speedArc = document.querySelector(".speedo-arc-active");
    if (speedValue && speedArc) {
      const speeds = { comfort: 120, sport: 187, race: 240 };
      const newSpeed = speeds[mode] || 187;
      speedValue.textContent = newSpeed;

      // 计算新的 dashoffset
      const maxOffset = 251;
      const percentage = newSpeed / 300; // 假设最大300
      const newOffset = maxOffset * (1 - percentage);
      speedArc.style.strokeDashoffset = newOffset;
    }
  });
});

// 速度表实时模拟（可选：让速度轻微波动）
setInterval(() => {
  const speedValue = document.querySelector(".speedo-value");
  if (speedValue) {
    const currentSpeed = parseInt(speedValue.textContent);
    const fluctuation = Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0;
    const newSpeed = Math.max(0, currentSpeed + fluctuation);
    speedValue.textContent = newSpeed;
  }
}, 3000);

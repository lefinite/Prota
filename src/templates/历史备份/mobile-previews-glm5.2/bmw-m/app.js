// mobile-previews/bmw-m — M PERFORMANCE
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 圈速筛选 / 按钮 Toast / 模拟遥测更新

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
      showToast("开始记录圈速");
      return;
    }
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `已切换到「${label.textContent}」` : "已切换");
  });
});

// 圈速筛选
const chips = document.querySelectorAll("#filterChips .chip");
const lapItems = document.querySelectorAll("#lapList .lap-item");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    lapItems.forEach((item) => {
      if (filter === "all") {
        item.classList.toggle("is-hidden", false);
      } else if (filter === "fast") {
        item.classList.toggle("is-hidden", item.dataset.type !== "fast");
      } else if (filter === "sector") {
        // 模拟显示分段详情
        showToast("分段分析视图");
      }
    });
  });
});

// 模拟遥测数据更新（仅在 demo 环境中展示动态效果）
const motionFast = 130;
const motionBase = 220;
const easeStandard = "cubic-bezier(0.16, 1, 0.3, 1)";

// 模拟 G 值进度条动态
function simulateTelemetry() {
  const lateralBar = document.querySelector(".telem-card__bar-fill--left");
  const speedBar = document.querySelector(".telem-card--speed .telem-card__bar-fill");
  if (!lateralBar || !speedBar) return;

  // 随机波动模拟真实遥测
  const lateralValue = 65 + Math.random() * 10;
  const speedValue = 75 + Math.random() * 8;

  lateralBar.style.setProperty("--p", `${lateralValue}%`);
  speedBar.style.setProperty("--p", `${speedValue}%`);
}

// 每 3 秒更新一次遥测数据
setInterval(simulateTelemetry, 3000);

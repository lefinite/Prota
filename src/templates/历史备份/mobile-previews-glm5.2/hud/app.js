// mobile-previews/hud — Telemetry · HUD Design System
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 警报筛选 / 按钮 Toast / 实时数据更新

const statusTime = document.getElementById("statusTime");
function updateStatusTime() {
  if (!statusTime) return;
  const now = new Date();
  statusTime.textContent = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
updateStatusTime();
setInterval(updateStatusTime, 1000);

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

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `${label.textContent} MODE` : "MODE CHANGED");
  });
});

// 警报筛选
const alertFilters = document.querySelectorAll("#alertFilters .alert-filter");
const alertItems = document.querySelectorAll("#alertList .alert-item");
alertFilters.forEach((filter) => {
  filter.addEventListener("click", () => {
    alertFilters.forEach((f) => f.classList.remove("is-active"));
    filter.classList.add("is-active");
    const filterType = filter.dataset.filter;
    alertItems.forEach((item) => {
      const show = filterType === "all" || item.dataset.level === filterType;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 实时遥测数据模拟更新
const altitudeEl = document.getElementById("altitude");
const speedEl = document.getElementById("speed");
const headingEl = document.getElementById("heading");
const vspeedEl = document.getElementById("vspeed");

let altitude = 2847;
let speed = 142;
let heading = 237;
let vspeed = -450;

function updateTelemetry() {
  // 小幅随机波动模拟真实数据
  altitude += Math.floor(Math.random() * 5) - 2;
  speed += Math.floor(Math.random() * 3) - 1;
  heading = (heading + Math.floor(Math.random() * 3) - 1 + 360) % 360;
  vspeed += Math.floor(Math.random() * 7) - 3;

  if (altitudeEl) altitudeEl.textContent = altitude.toLocaleString();
  if (speedEl) speedEl.textContent = speed;
  if (headingEl) headingEl.textContent = heading.toString().padStart(3, "0");
  if (vspeedEl) {
    vspeedEl.textContent = (vspeed >= 0 ? "+" : "") + vspeed;
    vspeedEl.classList.toggle("data-value--warn", Math.abs(vspeed) > 400);
  }
}

setInterval(updateTelemetry, 2000);

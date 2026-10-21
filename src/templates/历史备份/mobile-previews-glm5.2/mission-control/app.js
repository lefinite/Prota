// mobile-previews/mission-control — 天弓任务控制台
// 保留：状态栏时间逻辑
// 页面：倒计时更新 / 遥测数据模拟 / 筛选 Chip / Tab 切换 / Toast

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

// T-Minus 倒计时更新
const countdownTime = document.getElementById("countdownTime");
let remainingSeconds = 2 * 3600 + 14 * 60 + 36; // 02:14:36

function updateCountdown() {
  if (!countdownTime) return;
  if (remainingSeconds <= 0) {
    countdownTime.textContent = "00:00:00";
    return;
  }
  remainingSeconds--;
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  countdownTime.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
setInterval(updateCountdown, 1000);

// 遥测数据实时模拟更新
const altValue = document.getElementById("altValue");
const velValue = document.getElementById("velValue");
let altitude = 124820;
let velocity = 7842;

function updateTelemetry() {
  // 模拟高度增加（上升阶段）
  altitude += Math.floor(Math.random() * 50) + 20;
  if (altValue) {
    altValue.textContent = altitude.toLocaleString();
  }

  // 模拟速度波动
  velocity += Math.floor(Math.random() * 20) - 10;
  velocity = Math.max(7000, Math.min(8500, velocity));
  if (velValue) {
    velValue.textContent = velocity.toLocaleString();
  }
}
setInterval(updateTelemetry, 2000);

// 筛选 Chips（子系统状态）
const chips = document.querySelectorAll(".chips .chip");
const systemItems = document.querySelectorAll("#systemList .system-item");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    systemItems.forEach((item) => {
      const show = filter === "all" || item.dataset.type === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 底部 Tab 切换（仅视觉高亮）
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」面板` : "已切换");
  });
});

// 系统状态项点击反馈
const systemItemsList = document.querySelectorAll(".system-item");
systemItemsList.forEach((item) => {
  item.addEventListener("click", () => {
    const systemName = item.querySelector(".system-title")?.textContent || "系统";
    const statusBadge = item.querySelector(".status-badge");
    const statusText = statusBadge?.textContent || "";
    showToast(`${systemName} · ${statusText}`);
  });
});

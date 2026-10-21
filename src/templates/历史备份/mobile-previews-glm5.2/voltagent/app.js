// mobile-previews/voltagent — VoltAgent AI 控制台
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 按钮 Toast / 实时更新模拟

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

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `Switched to ${label.textContent}` : "已切换");
  });
});

// 模拟实时更新 - Agent 状态
const agentCards = document.querySelectorAll(".agent-card");
function updateAgentStatus() {
  agentCards.forEach((card) => {
    const status = card.querySelector(".agent-card__status");
    const metric = card.querySelector(".agent-card__metric");
    if (!status || !metric) return;

    // 随机更新状态
    const isRunning = Math.random() > 0.3;
    if (isRunning) {
      status.textContent = "RUNNING";
      card.classList.add("agent-card--active");
      card.classList.remove("agent-card--idle");
      metric.textContent = (Math.random() * 10).toFixed(1) + "s";
    } else {
      status.textContent = "IDLE";
      card.classList.remove("agent-card--active");
      card.classList.add("agent-card--idle");
      metric.textContent = "--";
    }
  });
}

// 每 5 秒更新一次 Agent 状态
setInterval(updateAgentStatus, 5000);

// 模拟日志添加
const logList = document.querySelector(".log-list");
if (logList) {
  const logTemplates = [
    { cmd: "[DataProcessor] Batch processed", meta: "240 records", status: "✓", type: "success" },
    { cmd: "[APIScanner] Health check passed", meta: "All endpoints OK", status: "✓", type: "success" },
    { cmd: "[RateLimiter] Warning threshold", meta: "85% capacity", status: "!", type: "warn" },
    { cmd: "[LogAnalyzer] Processing logs...", meta: "In progress", status: "●", type: "running" },
  ];

  function addLogEntry() {
    const template = logTemplates[Math.floor(Math.random() * logTemplates.length)];
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);

    const entry = document.createElement("div");
    entry.className = `log-entry log-entry--${template.type}`;
    entry.innerHTML = `
      <span class="log-entry__time">${timeStr}</span>
      <div class="log-entry__content">
        <span class="log-entry__cmd">${template.cmd}</span>
        <span class="log-entry__meta">${template.meta}</span>
      </div>
      <span class="log-entry__status ${template.type === 'running' ? 'log-entry__status--pulse' : ''}">${template.status}</span>
    `;

    logList.insertBefore(entry, logList.firstChild);

    // 保持最多 6 条日志
    while (logList.children.length > 6) {
      logList.removeChild(logList.lastChild);
    }
  }

  // 每 3 秒添加一条新日志
  setInterval(addLogEntry, 3000);
}

// 模拟指标更新
const metricValues = document.querySelectorAll(".metric-card__value");
const metricBars = document.querySelectorAll(".metric-card__bar-fill");

function updateMetrics() {
  metricValues.forEach((val, i) => {
    const isPercent = val.querySelector(".metric-card__unit")?.textContent === "%";
    const isGB = val.querySelector(".metric-card__unit")?.textContent === "GB";
    const isReq = val.querySelector(".metric-card__unit")?.textContent === "k/s";

    let newValue;
    if (isPercent) {
      newValue = Math.floor(Math.random() * 60 + 20);
      val.innerHTML = `${newValue}<span class="metric-card__unit">%</span>`;
      if (metricBars[i]) metricBars[i].style.setProperty("--p", `${newValue}%`);
    } else if (isGB) {
      newValue = (Math.random() * 2 + 1).toFixed(1);
      val.innerHTML = `${newValue}<span class="metric-card__unit">GB</span>`;
      if (metricBars[i]) metricBars[i].style.setProperty("--p", `${newValue * 25}%`);
    } else if (isReq) {
      newValue = (Math.random() * 3 + 1).toFixed(1);
      val.innerHTML = `${newValue}<span class="metric-card__unit">k/s</span>`;
      if (metricBars[i]) metricBars[i].style.setProperty("--p", `${newValue * 20}%`);
    }
  });
}

// 每 2 秒更新指标
setInterval(updateMetrics, 2000);

// mobile-previews/midnight-terminal — DevTerm · 暗夜终端
// 保留：状态栏时间逻辑
// 页面：快捷命令 / Tab 切换 / Toast

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

// 终端输入框回车执行
const terminalField = document.querySelector(".terminal-field");
if (terminalField) {
  terminalField.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const cmd = terminalField.value.trim();
      if (cmd) {
        showToast(`执行: ${cmd}`);
        terminalField.value = "";
      }
    }
  });
}

// 终端提交按钮
const terminalSubmit = document.querySelector(".terminal-submit");
if (terminalSubmit) {
  terminalSubmit.addEventListener("click", () => {
    const cmd = terminalField?.value.trim();
    if (cmd) {
      showToast(`执行: ${cmd}`);
      if (terminalField) terminalField.value = "";
    } else {
      showToast("请输入命令");
    }
  });
}

// 底部 Tab 切换（仅视觉高亮）
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 模拟实时数据更新（CPU/MEM 波动效果）
const sysValues = document.querySelectorAll(".sys-card__value");
function updateTelemetry() {
  sysValues.forEach((val) => {
    const text = val.textContent;
    if (text.includes("%")) {
      const current = parseInt(text);
      const variation = Math.floor(Math.random() * 5) - 2;
      const newValue = Math.max(0, Math.min(100, current + variation));
      val.textContent = `${newValue}%`;
      val.style.color = newValue > 80 ? "var(--danger)" : "";
    }
  });
}

// 每3秒更新一次遥测数据
setInterval(updateTelemetry, 3000);

// 任务控制 · Mission Control — 页面交互
// 状态栏时间逻辑来自 mobile-frame，原样保留。

const statusTime = document.getElementById("statusTime");

function updateStatusTime() {
  if (!statusTime) return;

  const now = new Date();
  statusTime.textContent = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

updateStatusTime();
setInterval(updateStatusTime, 30000);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ===== toast ===== */
const toast = document.getElementById("toast");
let toastTimer = null;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-show"), 1800);
}

/* ===== 通用：data-toast 按钮 ===== */
document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== 飞控主时钟：T 倒计时 ===== */
const countdownEl = document.getElementById("countdown");
const phaseLabel = document.getElementById("phaseLabel");
let tSeconds = 14 * 60 + 32;

function formatT(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `T-${h}:${m}:${s}`;
}

function tickCountdown() {
  if (tSeconds > 0) {
    tSeconds -= 1;
  }
  countdownEl.textContent = formatT(tSeconds);
  if (tSeconds === 0 && !countdownEl.classList.contains("is-zero")) {
    countdownEl.classList.add("is-zero");
    phaseLabel.textContent = "T-0 · 主发动机点火";
    showToast("T-0 · 点火，遥测进入实时峰值");
  }
}

tickCountdown();
setInterval(tickCountdown, 1000);

/* ===== 遥测抖动：数值随机游走 + 读数刷新闪光 ===== */
const telVel = document.getElementById("telVel");
const telAlt = document.getElementById("telAlt");
const telFuel = document.getElementById("telFuel");

let vel = 7.66;
let alt = 214.3;
let fuel = 68;

function jitter(el, value, digits, unit) {
  el.innerHTML = "";
  el.append(value.toFixed(digits));
  const unitEl = document.createElement("span");
  unitEl.className = "data-tile__unit";
  unitEl.textContent = unit;
  el.append(unitEl);
  if (!reduceMotion.matches) {
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
  }
}

setInterval(() => {
  vel = Math.min(7.9, Math.max(7.4, vel + (Math.random() - 0.5) * 0.04));
  alt = Math.min(240, Math.max(190, alt + (Math.random() - 0.5) * 1.6));
  if (tSeconds < 300) fuel = Math.max(1, fuel - 0.1);
  jitter(telVel, vel, 2, "km/s");
  jitter(telAlt, alt, 1, "km");
  jitter(telFuel, fuel, 0, "%");
}, 2000);

/* ===== 告警确认 ===== */
const alertBanner = document.getElementById("alertBanner");
const ackBtn = document.getElementById("ackBtn");

ackBtn.addEventListener("click", () => {
  alertBanner.classList.add("is-acked");
  ackBtn.textContent = "已确认";
  ackBtn.disabled = true;
  showToast("告警已确认 · 移交热控席位");
});

/* ===== 批准点火序列 ===== */
const armBtn = document.getElementById("armBtn");
let armed = false;

armBtn.addEventListener("click", () => {
  if (armed) return;
  armed = true;
  armBtn.textContent = "序列已批准 · ARMED";
  armBtn.disabled = true;
  phaseLabel.textContent = "点火序列已批准 · 等待 T-0";
  showToast("点火序列已批准 · 双人规则满足");
});

/* ===== chip 筛选 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 指令输入 ===== */
const cmdInput = document.getElementById("cmdInput");

function sendCommand() {
  const code = (cmdInput.value || "").trim().toUpperCase();
  if (!code) {
    cmdInput.focus();
    showToast("输入指令码后发送");
    return;
  }
  cmdInput.value = "";
  showToast(`指令 ${code} 已发送 · 等待握手`);
}

document.getElementById("cmdInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendCommand();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "遥测") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "指令") {
      cmdInput.focus();
      showToast("指令台就绪 · 回车发送");
    } else {
      showToast(`已切换到「${name}」面板`);
    }
  });
});

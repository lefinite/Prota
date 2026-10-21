// MY BMW · 车主 — 页面交互
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

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

/* ===== 常用路线 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已设为常用路线" : "已取消常用");
  });
});

/* ===== 立即充电：进度条按秒推进 ===== */
const chargeLink = document.getElementById("chargeLink");
const chargeFill = document.getElementById("chargeFill");
const chargeMeta = document.getElementById("chargeMeta");
const batteryFill = document.getElementById("batteryFill");
const batteryText = document.getElementById("batteryText");
let chargeLevel = 12;
let charging = false;

function renderCharge() {
  chargeFill.style.setProperty("--w", chargeLevel + "%");
  batteryFill.style.setProperty("--w", Math.min(100, 78 + Math.round((chargeLevel - 12) * 0.22)) + "%");
  batteryText.textContent = batteryFill.style.getPropertyValue("--w");
  chargeMeta.textContent = charging
    ? `充电中 ${chargeLevel}% · 剩余 ${Math.max(1, Math.round((100 - chargeLevel) * 0.6))} min`
    : `已充 ${chargeLevel}% · 谷段 0.31 元/kWh`;
}

chargeLink.addEventListener("click", () => {
  charging = !charging;
  chargeLink.textContent = charging ? "停止充电" : "立即充电";
  showToast(charging ? "家充桩已启动 · 11 kW" : "充电已暂停");
  if (charging) {
    const timer = setInterval(() => {
      if (!charging || chargeLevel >= 100) {
        clearInterval(timer);
        if (chargeLevel >= 100) {
          charging = false;
          chargeLink.textContent = "立即充电";
          showToast("充电完成 · 100%");
        }
        return;
      }
      chargeLevel = Math.min(100, chargeLevel + 1);
      renderCharge();
    }, reduceMotion ? 1200 : 700);
  }
  renderCharge();
});

/* ===== 发送到车辆 ===== */
const destInput = document.getElementById("destInput");
const sendBtn = document.getElementById("sendBtn");

function sendToCar() {
  const dest = (destInput.value || "").trim();
  showToast(dest ? `「${dest}」已发送至车辆` : "请先输入目的地");
  if (dest) destInput.value = "";
}

sendBtn.addEventListener("click", sendToCar);
destInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendToCar();
});

/* ===== 远程空调 ===== */
document.getElementById("climateBtn").addEventListener("click", () => {
  showToast("远程空调已开启 · 21°C · 15 分钟后自动关闭");
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "行程") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "充电") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth" });
      showToast("家充桩 · 谷时 23:00 开始最省");
    } else if (name === "车辆") {
      document.querySelector(".app-content").scrollTo({ top: 0, behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

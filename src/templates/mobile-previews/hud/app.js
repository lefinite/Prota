// STRATUS 飞行台 · HUD — 页面交互
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

/* ===== 遥测数据：小步漂移，HUD 的“活着”的感觉 ===== */
const altVal = document.getElementById("altVal");
const spdVal = document.getElementById("spdVal");
const hdgVal = document.getElementById("hdgVal");
const tapeTrack = document.getElementById("tapeTrack");

const telemetry = { alt: 3240, spd: 142, hdg: 267 };
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function renderTelemetry() {
  if (altVal) altVal.textContent = telemetry.alt;
  if (spdVal) spdVal.textContent = telemetry.spd;
  if (hdgVal) hdgVal.textContent = telemetry.hdg;
  if (tapeTrack) {
    // 1° = 4px；270° 是带的中心，把当前航向推到指针下
    tapeTrack.style.transform = `translateX(${-(telemetry.hdg - 270) * 4}px)`;
  }
}

function driftTelemetry() {
  telemetry.alt += Math.round(Math.random() * 8 - 3);
  telemetry.spd += Math.round(Math.random() * 3 - 1);
  telemetry.hdg += Math.round(Math.random() * 2 - 1);
  renderTelemetry();
}

renderTelemetry();
if (!reduceMotion) {
  setInterval(driftTelemetry, 1600);
}

/* ===== chip 筛选：按航点状态过滤 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      const kinds = (item.dataset.kind || "").split(" ");
      item.hidden = filter !== "all" && !kinds.includes(filter);
    });
  });
});

/* ===== 记录航迹：开 / 关 ===== */
const recBtn = document.getElementById("recBtn");

recBtn.addEventListener("click", () => {
  const recording = recBtn.classList.toggle("is-rec");
  recBtn.setAttribute("aria-pressed", String(recording));
  recBtn.innerHTML = recording
    ? '<i class="btn-primary__led" aria-hidden="true"></i>记录航迹 · REC'
    : "已暂停 · 等待恢复";
  showToast(recording ? "航迹记录已恢复" : "航迹记录已暂停");
});

/* ===== 航点备注：回车附加到当前航点 ===== */
const quickInput = document.getElementById("quickInput");

quickInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = quickInput.value.trim();
  showToast(text ? `备注已附加至 WP03：${text}` : "请先输入备注内容");
  if (text) quickInput.value = "";
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "标记") {
      showToast("已在当前位置放置标记 M-04");
    } else if (name === "日志") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」视图`);
    }
  });
});

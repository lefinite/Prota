// 跃马 · Ferrari 风格 — 页面交互
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

document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

/* ===== 速度表：随模式波动的读数 ===== */
const speedNum = document.getElementById("speedNum");
const gearNum = document.getElementById("gearNum");
let maxSpeed = 218;
let engineOn = true;

setInterval(() => {
  if (!engineOn) return;
  const jitter = (Math.random() - 0.5) * 14;
  const v = Math.max(0, Math.min(maxSpeed, maxSpeed * 0.86 + jitter));
  speedNum.textContent = String(Math.round(v));
  gearNum.textContent = v > 240 ? "7" : v > 190 ? "6" : v > 140 ? "5" : v > 90 ? "4" : v > 50 ? "3" : v > 20 ? "2" : "1";
}, 1600);

/* ===== ENGINE START ===== */
const engineBtn = document.getElementById("engineBtn");

engineBtn.addEventListener("click", () => {
  engineOn = !engineOn;
  engineBtn.classList.toggle("is-on", !engineOn);
  engineBtn.textContent = engineOn ? "ENGINE START" : "ENGINE OFF";
  if (engineOn) {
    maxSpeed = 218;
    showToast("V8 Hybrid 点火 · 排气阀已开启");
  } else {
    speedNum.textContent = "0";
    showToast("发动机已熄火 · 车辆上锁");
  }
});

/* ===== MANETTINO 模式切换 ===== */
const modes = document.querySelectorAll(".mode");
const modeLabel = document.getElementById("modeLabel");

modes.forEach((mode) => {
  mode.addEventListener("click", () => {
    modes.forEach((m) => m.classList.remove("is-active"));
    mode.classList.add("is-active");
    maxSpeed = parseInt(mode.dataset.max, 10);
    modeLabel.textContent = "MANETTINO · " + mode.dataset.mode;
    showToast(`已切换 ${mode.dataset.mode} 模式 · 限速 ${maxSpeed} km/h`);
  });
});

/* ===== Feed 筛选 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 目的地发送 ===== */
const addrInput = document.getElementById("addrInput");
addrInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && addrInput.value.trim()) {
    showToast(`「${addrInput.value.trim()}」已发送到车机导航`);
    addrInput.value = "";
  }
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    showToast(`已切换到「${tab.dataset.tab}」`);
  });
});

// 踏点 · Flat — 页面交互
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

/* ===== 骑行计时（真走秒）===== */
const rideCard = document.getElementById("rideCard");
const rideState = document.getElementById("rideState");
const rideTimer = document.getElementById("rideTimer");
const rideBtn = document.getElementById("rideBtn");

let rideSeconds = 26 * 60 + 14;
let riding = true;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

setInterval(() => {
  if (!riding) return;
  if (rideSeconds < 99 * 60 + 59) rideSeconds += 1;
  rideTimer.textContent = fmt(rideSeconds);
}, 1000);

/* ===== 速度分段条：骑行中轻微闪动 ===== */
const segs = Array.from(document.querySelectorAll(".ride-card__speed i"));

function flickerSpeed() {
  if (!riding) return;
  const lit = 4 + Math.floor(Math.random() * 5);
  segs.forEach((seg, i) => seg.classList.toggle("is-on", i < lit));
}

if (!reduceMotion) setInterval(flickerSpeed, 1800);

/* ===== 结束 / 重开骑行 ===== */
function endRide() {
  riding = false;
  rideCard.classList.add("is-idle");
  rideState.textContent = `行程已结束 · ${fmt(rideSeconds)}`;
  rideBtn.textContent = "重新开锁";
  rideBtn.classList.add("is-idle");
  showToast("行程结束 · 已扣费 ¥6.50，发票已发送");
}

function resumeRide() {
  riding = true;
  rideCard.classList.remove("is-idle");
  rideState.textContent = "骑行中 · SC-4821";
  rideBtn.textContent = "结束骑行 · 预计 ¥6.50";
  rideBtn.classList.remove("is-idle");
  showToast("SC-4821 已开锁 · 计费开始");
}

rideBtn.addEventListener("click", () => {
  if (riding) endRide();
  else resumeRide();
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

/* ===== 收藏车辆 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏这台车，开锁时优先推荐" : "已取消收藏");
  });
});

/* ===== 目的地输入 ===== */
const destInput = document.getElementById("destInput");

function routeToDest() {
  const text = (destInput.value || "").trim() || "地铁 B 口";
  destInput.value = "";
  showToast(`已规划到「${text}」的骑行路线 · 1.2 km`);
}

destInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") routeToDest();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "首页") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    } else if (name === "骑行") {
      destInput.focus();
      showToast("输入目的地，或扫码开一台新车");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

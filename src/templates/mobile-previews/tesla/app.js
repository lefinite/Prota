// 特站 · Tesla 风格 — 页面交互
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

/* ===== 充电模拟 ===== */
const batteryNum = document.getElementById("batteryNum");
const chargeEta = document.getElementById("chargeEta");
const chargeFill = document.getElementById("chargeFill");
const chargeBtn = document.getElementById("chargeBtn");
let battery = 68;
let charging = true;

function renderBattery() {
  batteryNum.innerHTML = battery + "<i>%</i>";
  const remain = 100 - battery;
  const h = Math.floor(remain / 9);
  const m = Math.round(((remain % 9) / 9) * 60);
  chargeEta.textContent = charging
    ? `预计 ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} 充满`
    : "充电已暂停";
  chargeFill.style.setProperty("--w", battery + "%");
}

renderBattery();

setInterval(() => {
  if (!charging || battery >= 100) return;
  battery = Math.min(100, battery + 1);
  renderBattery();
  if (battery === 100) {
    showToast("充电完成 · 已达 100%");
    charging = false;
    chargeBtn.textContent = "停止充电";
  }
}, 4000);

chargeBtn.addEventListener("click", () => {
  charging = !charging;
  chargeBtn.textContent = charging ? "停止充电" : "开始充电";
  showToast(charging ? "充电已恢复 · 7.2 kW" : "充电已暂停");
  renderBattery();
});

/* ===== 快捷控制 toggle ===== */
document.querySelectorAll(".controls__btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const wasOn = btn.classList.contains("is-on");
    btn.classList.toggle("is-on");
    if (!btn.dataset.toast.includes("已开启")) {
      btn.dataset.toast = btn.dataset.toast.replace("已开启", "已关闭");
    }
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

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    showToast(`已切换到「${tab.dataset.tab}」`);
  });
});

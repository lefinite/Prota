// 闪电站 · Renault E-Tech — 页面交互
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

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function smoothScrollTo(target) {
  target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
}

/* ===== 立即充电：电量进度模拟 ===== */
const chargeBtn = document.getElementById("chargeBtn");
const socNum = document.getElementById("socNum");
const socFill = document.getElementById("socFill");
const rangeNum = document.getElementById("rangeNum");
const heroStatus = document.getElementById("heroStatus");
let chargeTimer = null;

function renderSoc(soc) {
  socNum.textContent = String(soc);
  socFill.style.setProperty("--w", soc + "%");
  rangeNum.textContent = String(Math.round(soc * 5.28));
}

function finishCharge() {
  clearInterval(chargeTimer);
  chargeTimer = null;
  heroStatus.textContent = "已完成 · 100%";
  chargeBtn.textContent = "已充满 · 拔枪结算";
  showToast("充电完成 · 谷时充电节省 ¥8.4");
}

chargeBtn.addEventListener("click", () => {
  if (chargeTimer) return;
  let soc = Number(socNum.textContent);
  if (soc >= 100) {
    showToast("电量已满 · 拔枪后将自动结算");
    return;
  }
  heroStatus.textContent = "充电中 · 11 kW";
  chargeBtn.textContent = "充电中…";
  if (prefersReducedMotion) {
    renderSoc(100);
    finishCharge();
    return;
  }
  chargeTimer = setInterval(() => {
    soc = Math.min(100, soc + 1);
    renderSoc(soc);
    if (soc >= 100) finishCharge();
  }, 70);
});

/* ===== 谷时预约开关 ===== */
const scheduleToggle = document.getElementById("scheduleToggle");

scheduleToggle.addEventListener("click", () => {
  const on = scheduleToggle.getAttribute("aria-checked") === "true";
  scheduleToggle.setAttribute("aria-checked", String(!on));
  scheduleToggle.classList.toggle("is-on", !on);
  showToast(on ? "已关闭谷时预约" : "谷时预约已开启 · 23:00 自动开始");
});

/* ===== chip 筛选充电站 ===== */
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

/* ===== 收藏充电站 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏 · 低电量时将提醒" : "已取消收藏");
  });
});

/* ===== 规划路线与搜索 ===== */
const siteInput = document.getElementById("siteInput");

document.getElementById("planBtn").addEventListener("click", () => {
  showToast("已规划路线 · 途经国家电网世纪公园站 · 全程 38 分钟");
});

siteInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const value = siteInput.value.trim();
  if (!value) {
    siteInput.focus();
    return;
  }
  showToast(`正在搜索「${value}」附近的充电站`);
  siteInput.value = "";
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");
const feedSection = document.querySelector(".feed");
const heroSection = document.querySelector(".charge-hero");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "车况") {
      smoothScrollTo(heroSection);
    } else if (name === "充电") {
      chargeBtn.focus();
      showToast("一键开始谷时充电");
    } else if (name === "电站") {
      smoothScrollTo(feedSection);
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

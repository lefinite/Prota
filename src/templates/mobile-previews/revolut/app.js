// 寰旅钱包 · Revolut — 页面交互
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

/* ===== 汇率换算器：输入 + 币种 chip 联动 ===== */
const convInput = document.getElementById("convInput");
const convCode = document.getElementById("convCode");
const convOut = document.getElementById("convOut");
const convChips = document.querySelectorAll(".conv-card .chip");
let currentRate = 7.82;
let currentCode = "EUR";

function renderConvert() {
  const amount = Number(convInput.value) || 0;
  const out = amount * currentRate;
  convOut.textContent = out.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

convChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    convChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    currentRate = Number(chip.dataset.rate);
    currentCode = chip.dataset.code;
    convCode.textContent = currentCode;
    renderConvert();
  });
});

convInput.addEventListener("input", renderConvert);

/* ===== 兑换货币 ===== */
document.getElementById("swapBtn").addEventListener("click", () => {
  const amount = Number(convInput.value) || 0;
  const out = amount * currentRate;
  showToast(
    `已兑换 ${amount} ${currentCode} → ¥${out.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  );
});

/* ===== 关注货币对 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已关注 · 到价将提醒" : "已取消关注");
  });
});

/* ===== chip 筛选行情 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const filterChips = document.querySelectorAll(".feed__head .chip");

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
const heroSection = document.querySelector(".wallet-hero");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "首页") {
      heroSection.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
    } else if (name === "兑换") {
      convInput.focus();
      showToast("输入金额，选择币种即可换算");
    } else if (name === "行情") {
      document.querySelector(".feed").scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth"
      });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

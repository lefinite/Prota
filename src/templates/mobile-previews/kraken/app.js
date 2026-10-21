// KRAKEN Pro · kraken — 页面交互
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

/* ===== 行情状态 ===== */
const LOW = 63911;
const HIGH = 68940;

const state = {
  price: 67412.5,
  pct: 4.28
};

const priceEl = document.getElementById("btcPrice");
const deltaChip = document.getElementById("deltaChip");
const rangeMarker = document.getElementById("rangeMarker");
const btcFeedPrices = document.querySelectorAll("[data-btc-price]");

function fmtPrice(v) {
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderTicker() {
  priceEl.textContent = fmtPrice(state.price);
  const trend = state.pct >= 0 ? "up" : "down";
  deltaChip.dataset.trend = trend;
  deltaChip.textContent = `${state.pct >= 0 ? "+" : "−"}${Math.abs(state.pct).toFixed(2)}%`;
  const x = Math.min(97, Math.max(3, ((state.price - LOW) / (HIGH - LOW)) * 100));
  rangeMarker.style.setProperty("--x", `${x.toFixed(1)}%`);
  rangeMarker.classList.toggle("is-down", trend === "down");
  btcFeedPrices.forEach((el) => {
    el.textContent = state.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });
}

/* 实时跳动：轻量模拟价格流 */
setInterval(() => {
  const drift = (Math.random() - 0.47) * 90;
  state.price = Math.min(HIGH, Math.max(LOW, state.price + drift));
  state.pct += (drift / state.price) * 100;
  renderTicker();
}, 2600);

/* 刷新按钮：立刻抖一下价格并提示 */
document.getElementById("refreshBtn").addEventListener("click", () => {
  state.price = Math.min(HIGH, Math.max(LOW, state.price + (Math.random() - 0.5) * 220));
  renderTicker();
  showToast("行情已刷新 · " + fmtPrice(state.price));
});

/* ===== chip 筛选（全部 / 上涨 / 下跌 / 自选星标）===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");
let activeFilter = "all";

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    activeFilter = chip.dataset.filter;
    applyFilter();
  });
});

function applyFilter() {
  feedItems.forEach((item) => {
    let show = true;
    if (activeFilter === "star") {
      show = item.querySelector(".feed-item__star").classList.contains("is-on");
    } else if (activeFilter !== "all") {
      show = item.dataset.kind === activeFilter;
    }
    item.hidden = !show;
  });
}

/* ===== 星标自选 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入自选" : "已移出自选");
    if (activeFilter === "star") applyFilter();
  });
});

/* ===== 快捷交易 ===== */
const amountInput = document.getElementById("amountInput");
const btcPreview = document.getElementById("btcPreview");

function currentAmount() {
  const v = parseFloat(amountInput.value);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

amountInput.addEventListener("input", () => {
  const usdt = currentAmount();
  btcPreview.textContent = usdt
    ? `≈ ${(usdt / state.price).toFixed(6)} BTC`
    : "≈ 0.000000 BTC";
});

document.getElementById("buyBtn").addEventListener("click", () => {
  const usdt = currentAmount() || 500;
  showToast(`限价买单已提交 · ${fmtPrice(usdt)} USDT`);
});

document.getElementById("sellBtn").addEventListener("click", () => {
  showToast(`市价卖出已提交 · 以 ${fmtPrice(state.price)} 成交`);
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "闪电下单") {
      amountInput.focus();
      showToast("闪电下单已就绪 · 输入金额回车");
    } else if (name === "行情") {
      document.getElementById("appContent").scrollTo({ top: 0, behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

amountInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("buyBtn").click();
});

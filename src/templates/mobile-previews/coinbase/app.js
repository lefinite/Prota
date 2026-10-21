// coinbook · Inspired by Coinbase — 页面交互
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

/* ===== chip 筛选（行情） ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");
let activeFilter = "all";

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    activeFilter = chip.dataset.filter;
    feedItems.forEach((item) => {
      const pass =
        activeFilter === "all" ||
        (activeFilter === "fav" && item.dataset.fav === "true") ||
        (activeFilter === "up" && item.dataset.kind === "up") ||
        (activeFilter === "down" && item.dataset.kind === "down");
      item.hidden = !pass;
    });
  });
});

/* ===== 自选 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const item = star.closest(".feed-item");
    const on = star.classList.toggle("is-on");
    item.dataset.fav = String(on);
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入自选" : "已移出自选");
  });
});

/* ===== 行情闪烁：随机刷新一行价格（行情盘手感） ===== */
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function tickRandomRow() {
  const visible = feedItems.filter((i) => !i.hidden);
  if (!visible.length) return;
  const row = visible[Math.floor(Math.random() * visible.length)];
  const priceEl = row.querySelector(".feed-item__price");
  const deltaEl = row.querySelector(".feed-item__delta");
  const base = parseFloat(priceEl.dataset.base || priceEl.textContent.replace(/[^\d.]/g, ""));
  priceEl.dataset.base = String(base);

  const drift = (Math.random() - 0.45) * base * 0.004;
  const next = Math.max(base + drift, 0.01);
  const pretty = next >= 1000 ? Math.round(next).toLocaleString("zh-CN") : next.toFixed(2);
  priceEl.textContent = "¥" + pretty;

  const pct = ((next - base) / base) * 100;
  if (pct > 0.02) {
    deltaEl.dataset.kind = "up";
    deltaEl.textContent = "+" + Math.abs(pct).toFixed(2) + "%";
  } else if (pct < -0.02) {
    deltaEl.dataset.kind = "down";
    deltaEl.textContent = "-" + Math.abs(pct).toFixed(2) + "%";
  }

  if (!reducedMotion) {
    row.classList.add("is-flash");
    window.setTimeout(() => row.classList.remove("is-flash"), 450);
  }
}

setInterval(tickRandomRow, 4000);

/* ===== 买入 ===== */
document.getElementById("buyBtn").addEventListener("click", () => {
  showToast("买单已提交 · 以最优价成交（演示）");
});

/* ===== 兑换：读取金额 ===== */
const amountInput = document.getElementById("amountInput");

function convert() {
  const raw = (amountInput.value || "").trim();
  const amount = parseFloat(raw);
  if (!raw || Number.isNaN(amount) || amount <= 0) {
    amountInput.focus();
    showToast("请输入有效的兑换金额");
    return;
  }
  showToast(`已兑换 ¥${amount} → ${(amount / 7.21).toFixed(2)} USDC`);
  amountInput.value = "";
}

document.getElementById("convertBtn").addEventListener("click", convert);
amountInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") convert();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "行情") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "扫码") {
      showToast("扫码转账已打开（演示）");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

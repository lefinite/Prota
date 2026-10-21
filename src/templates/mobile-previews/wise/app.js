// 直兑 · Wise — 页面交互
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

/* ===== 汇率计算 ===== */
const RATE = 0.128642;
const FEE_RATE = 0.000421; // 约 4.21 CNY / 万
const amountIn = document.getElementById("amountIn");
const amountOut = document.getElementById("amountOut");
const sumLine = document.getElementById("sumLine");
const rateLine = document.querySelectorAll(".hero__fees b")[0];
const feeLine = document.querySelectorAll(".hero__fees b")[1];

function fmt(n, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function calc() {
  const v = parseFloat(amountIn.value.replace(/,/g, "")) || 0;
  const fee = Math.max(1.2, v * FEE_RATE);
  const out = (v - fee) * RATE;
  amountOut.textContent = fmt(out);
  sumLine.textContent = fmt(out) + " EUR";
  feeLine.textContent = fmt(fee) + " CNY";
}

amountIn.addEventListener("input", calc);
calc();

/* ===== 汇率微波动 ===== */
let rate = RATE;

setInterval(() => {
  rate = Math.max(0.12, rate + (Math.random() - 0.5) * 0.00008);
  rateLine.textContent = `1 CNY = ${rate.toFixed(6)} EUR`;
}, 3000);

/* ===== 交换币种 ===== */
document.getElementById("swapBtn").addEventListener("click", () => {
  const cur1 = document.querySelector(".calc__row .chip-ghost");
  const cur2 = document.querySelector(".calc__row--out .chip-ghost");
  const tmp = cur1.textContent;
  cur1.textContent = cur2.textContent;
  cur2.textContent = tmp;
  showToast("已交换方向（演示：CNY/EUR 对）");
});

/* ===== Feed 筛选 ===== */
const txs = Array.from(document.querySelectorAll(".tx"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    txs.forEach((tx) => {
      tx.hidden = filter !== "all" && tx.dataset.kind !== filter;
    });
  });
});

/* ===== 转账完成推进 ===== */
txs.forEach((tx) => {
  tx.addEventListener("click", () => {
    if (tx.dataset.kind === "pend") {
      tx.dataset.kind = "done";
      tx.querySelector(".tx__meta").textContent = tx.querySelector(".tx__meta").textContent.replace("处理中", "刚刚到账");
      showToast("到账成功 ✓（演示）");
    } else {
      showToast("转账回执已生成 PDF");
    }
  });
});

/* ===== 收款别名 ===== */
const aliasInput = document.getElementById("aliasInput");
aliasInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && aliasInput.value.trim()) {
    showToast(`别名已保存：${aliasInput.value.trim()}`);
    aliasInput.value = "";
  }
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "转账") {
      amountIn.focus();
      amountIn.select();
      showToast("输入金额，实时按中间价换算");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

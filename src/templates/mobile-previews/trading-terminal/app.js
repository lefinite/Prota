// 盘房 · Trading Terminal — 页面交互
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

/* ===== 终端时钟 ===== */
const clockLine = document.getElementById("clockLine");

setInterval(() => {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  clockLine.textContent = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())} CST`;
}, 1000);

/* ===== 行情跳动 ===== */
const bigPrice = document.getElementById("bigPrice");
const bigChg = document.getElementById("bigChg");
const priceInput = document.getElementById("priceInput");
let price = 67418.5;
let base = 65833;

function tick() {
  const dir = Math.random();
  price = dir > 0.5 ? price + Math.random() * 6 : price - Math.random() * 6;
  const chg = ((price - base) / base) * 100;
  const up = chg >= 0;
  bigPrice.textContent = price.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  bigChg.textContent = (up ? "+" : "") + chg.toFixed(2) + "%";
  bigPrice.className = "hero__price " + (up ? "up" : "down");
  bigChg.className = "hero__chg mono " + (up ? "up" : "down");
}

setInterval(tick, 1600);

/* ===== Feed 筛选 ===== */
const rows = Array.from(document.querySelectorAll(".row"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    rows.forEach((row) => {
      row.hidden = filter !== "all" && row.dataset.kind !== filter;
    });
  });
});

/* ===== 仓位 chip ===== */
const sizeChips = document.querySelectorAll(".chips--size .chip");
let size = 0.05;

sizeChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    sizeChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const pct = { "25%": 0.025, "50%": 0.05, "75%": 0.075, MAX: 0.1 }[chip.textContent] || 0.05;
    size = pct;
    document.getElementById("buyBtn").textContent = `BUY ${size}`;
    document.getElementById("sellBtn").textContent = `SELL ${size}`;
  });
});

/* ===== 下单 ===== */
function order(side) {
  const p = price.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  showToast(`${side === "buy" ? "BUY" : "SELL"} 已提交：${p} × ${size} 限价`);
}

document.getElementById("buyBtn").addEventListener("click", () => order("buy"));
document.getElementById("sellBtn").addEventListener("click", () => order("sell"));

priceInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    showToast(`改价：${priceInput.value} · 双击 BUY/SELL 提交`);
  }
});

/* ===== 行点击切换标的 ===== */
rows.forEach((row) => {
  row.addEventListener("click", () => {
    const sym = row.querySelector(".row__sym").textContent.replace("/USDT", "");
    document.querySelector(".hero__sym").firstChild.textContent = sym + "-USDT ";
    showToast(`已切换主力合约：${sym}-USDT PERP`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "下单") {
      priceInput.focus();
      showToast("限价单 · 输入价格回车改价");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

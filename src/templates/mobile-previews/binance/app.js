// 币簿 CoinBook — Binance-Inspired 页面交互
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

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

/* ===== 收藏 toggle ===== */
function bindStar(star) {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏该记录" : "已取消收藏");
  });
}

document.querySelectorAll(".feed-item__star").forEach(bindStar);

/* ===== 买入：把快捷单写进成交记录顶部 ===== */
const tradeInput = document.getElementById("tradeInput");
const feedList = document.getElementById("feedList");

function logQuickBuy() {
  const raw = (tradeInput.value || "").trim();
  const usdt = raw && !Number.isNaN(Number(raw)) ? Number(raw) : 100;
  const btc = (usdt / 67412.5).toFixed(4);
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "buy";
  li.innerHTML = `
    <span class="feed-item__glyph feed-item__glyph--btc" aria-hidden="true">₿</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 市价 ${btc} BTC</span>
    </div>
    <b class="feed-item__amount">-${usdt.toFixed(2)}</b>
    <button class="feed-item__star" type="button" aria-label="收藏该记录" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = "买入 BTC";
  bindStar(li.querySelector(".feed-item__star"));
  feedList.prepend(li);
  tradeInput.value = "";
  showToast(`市价买单已提交 · ${usdt.toFixed(2)} USDT`);
}

document.getElementById("buyBtn").addEventListener("click", logQuickBuy);
tradeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") logQuickBuy();
});

/* ===== 卖出：切到「卖出」筛选 ===== */
const sellBtn = document.getElementById("sellBtn");
sellBtn.addEventListener("click", () => {
  const sellChip = document.querySelector('.chip[data-filter="sell"]');
  if (sellChip) sellChip.click();
  showToast("已切至卖出记录 · 下单面板在交易页");
});

/* ===== 行情微跳动（尊重 reduced-motion）===== */
const marketCards = document.querySelectorAll(".market-card");
const flashTimer = new WeakMap();

if (!reduceMotion && marketCards.length) {
  setInterval(() => {
    marketCards.forEach((card) => {
      const priceEl = card.querySelector("[data-price]");
      const deltaEl = card.querySelector("[data-delta]");
      if (!priceEl || !deltaEl) return;

      const price = Number(priceEl.textContent.replace(/,/g, ""));
      if (!price) return;

      const drift = (Math.random() - 0.48) * price * 0.0018;
      const next = price + drift;
      priceEl.textContent = next.toLocaleString("en-US", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      });

      const up = drift >= 0;
      deltaEl.classList.toggle("is-up", up);
      deltaEl.classList.toggle("is-down", !up);
      deltaEl.textContent = (up ? "+" : "-") + (Math.random() * 2.4 + 0.2).toFixed(2) + "%";

      priceEl.classList.remove("is-flash-up", "is-flash-down");
      void priceEl.offsetWidth; /* 重启动画类 */
      priceEl.classList.add(up ? "is-flash-up" : "is-flash-down");
      clearTimeout(flashTimer.get(priceEl));
      flashTimer.set(priceEl, setTimeout(() => {
        priceEl.classList.remove("is-flash-up", "is-flash-down");
      }, 600));
    });
  }, 2400);
}

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "行情") {
      document.querySelector(".market-trio").scrollIntoView({ behavior: "smooth" });
    } else if (name === "交易") {
      tradeInput.focus();
      showToast("已进入 BTC/USDT 交易面板");
    } else if (name === "充提") {
      showToast("充币地址已复制 · 请核对网络");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

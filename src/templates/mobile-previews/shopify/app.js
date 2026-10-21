// 夜市集 · Shopify 风格 — 页面交互
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

/* ===== GMV 实时滚动 ===== */
const gmvEl = document.querySelector(".hero__num");
let gmv = 86420;

setInterval(() => {
  gmv += Math.round(Math.random() * 900 + 60);
  gmvEl.textContent = "¥" + gmv.toLocaleString("zh-CN");
}, 2600);

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

/* ===== 活动类型 chip ===== */
const promoChips = document.querySelectorAll(".chips--promo .chip");
promoChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    promoChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`营销工具：${chip.textContent}`);
  });
});

/* ===== 搜索 ===== */
const productInput = document.getElementById("productInput");
productInput.addEventListener("input", () => {
  const q = productInput.value.trim();
  feedItems.forEach((item) => {
    item.hidden = q && !item.textContent.includes(q);
  });
});

/* ===== 订单点击：放行风控 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    if (item.dataset.kind === "risk") {
      const badge = item.querySelector(".state");
      badge.textContent = "PAID";
      badge.className = "state st-ok";
      item.dataset.kind = "paid";
      showToast("已人工放行 · 记入风控白名单");
    } else {
      showToast("订单详情已打开");
    }
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "上新") {
      productInput.focus();
      showToast("输入商品名，3 步完成上新");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

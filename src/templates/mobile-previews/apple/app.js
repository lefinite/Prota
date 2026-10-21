// 果拾 · Apple Store 风格 — 页面交互
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

/* ===== 购物袋计数 ===== */
const bagCount = document.getElementById("bagCount");
let bag = 2;

function addToBag(name) {
  bag += 1;
  bagCount.textContent = bag;
  bagCount.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.5)" }, { transform: "scale(1)" }],
    { duration: 320, easing: "ease-out" }
  );
  showToast(`已将「${name}」加入购物袋`);
}

document.querySelectorAll(".feed-item").forEach((item) => {
  item.querySelector(".feed-item__add").addEventListener("click", () => {
    addToBag(item.querySelector(".feed-item__name").textContent);
  });
});

/* ===== 机型切换 + 合计联动 ===== */
const modelChips = document.querySelectorAll("[data-price]");
const sumLine = document.getElementById("sumLine");
let price = 8999;

modelChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    modelChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    price = parseInt(chip.dataset.price, 10);
    sumLine.textContent = `合计 RMB ${price.toLocaleString("zh-CN")} · 或月付 RMB ${Math.round(price / 12).toLocaleString("zh-CN")} × 12 期`;
  });
});

document.getElementById("addBagBtn").addEventListener("click", () => {
  addToBag("iPhone 17 Pro（已选配置）");
});

document.getElementById("buyBtn").addEventListener("click", () => {
  addToBag("iPhone 17 Pro");
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

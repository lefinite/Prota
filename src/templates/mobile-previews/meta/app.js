// 视界商城 · Meta — 页面交互
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

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ===== 收藏 toggle（卡片与列表共用样式钩子）===== */
function bindHeart(btn) {
  btn.addEventListener("click", () => {
    const on = btn.classList.toggle("is-on");
    btn.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入心愿单" : "已从心愿单移除");
  });
}

document.querySelectorAll(".heart, .feed-item__heart").forEach(bindHeart);

/* ===== 加入购物车（Hero + 操作区）===== */
let cartCount = 2;

function addToCart(name, price) {
  cartCount += 1;
  const badge = document.querySelector(".brand-bar__badge");
  if (badge) badge.textContent = String(cartCount);
  showToast(`已加入购物车：${name} · 合计 ${cartCount} 件`);
}

document.getElementById("heroBuy").addEventListener("click", () => {
  addToCart("Meta Quest 3S", "¥2,899");
});

document.getElementById("cartBtn").addEventListener("click", () => {
  addToCart("Ray-Ban Meta 智能眼镜", "¥2,999");
});

/* ===== 订阅首发提醒（简单校验 + toast）===== */
const subscribeInput = document.getElementById("subscribeInput");

subscribeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitSubscribe();
});

function submitSubscribe() {
  const value = subscribeInput.value.trim();
  if (!value || !value.includes("@")) {
    showToast("请输入有效邮箱，例如 name@mail.com");
    subscribeInput.focus();
    return;
  }
  subscribeInput.value = "";
  showToast(`订阅成功：${value} 将在首发日收到提醒`);
}

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

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "商店") {
      window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
      document.querySelector(".app-content").scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    } else if (name === "搜索") {
      subscribeInput.focus();
      showToast("输入型号或品类，快速找货");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

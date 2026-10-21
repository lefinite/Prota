// 栖游 · Airbnb 风格 — 页面交互
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

document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== 三选 Tab ===== */
const triTabs = document.querySelectorAll(".tri-tabs__item");
const feedNames = ["附近好宿", "热门体验", "本地服务"];

triTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    triTabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const idx = Array.from(triTabs).indexOf(tab);
    document.querySelector(".feed__title").textContent = feedNames[idx];
    showToast(`已切换到「${tab.textContent.trim().slice(2)}」`);
  });
});

/* ===== 心愿单 toggle（hero + 列表）===== */
function bindHeart(btn, name) {
  btn.addEventListener("click", () => {
    const on = btn.classList.toggle("is-on");
    btn.setAttribute("aria-pressed", String(on));
    showToast(on ? `已把「${name}」加入心愿单` : "已从心愿单移除");
  });
}

bindHeart(document.getElementById("heroHeart"), "洱海畔的白族老宅");

document.querySelectorAll(".feed-item").forEach((item) => {
  bindHeart(item.querySelector(".feed-item__heart"), item.querySelector(".feed-item__name").textContent);
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

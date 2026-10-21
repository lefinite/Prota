// 画板 · Figma 风格 — 页面交互
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

/* ===== 设计/原型/Dev Mode 切换 ===== */
const heroTabs = document.querySelectorAll(".hero-tab");
const layerInfo = {
  设计: "画布包含 42 帧 · 18 组件实例",
  原型: "3 条交互流 · 触发 6 处",
  代码: "已生成 CSS / iOS / Android 三套规格"
};

heroTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    heroTabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    showToast(layerInfo[tab.dataset.layer]);
  });
});

/* ===== 工具 chip ===== */
const toolChips = document.querySelectorAll("[data-tool]");
toolChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    toolChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`筛选：${chip.dataset.tool} 文件`);
  });
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

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收藏到精选集" : "已取消收藏");
  });
});

/* ===== 搜索 ===== */
const fileSearch = document.getElementById("fileSearch");
fileSearch.addEventListener("input", () => {
  const q = fileSearch.value.trim();
  feedItems.forEach((item) => {
    item.hidden = q && !item.textContent.includes(q);
  });
});

/* ===== 缩放 ===== */
let zoom = 100;
const zoomLabel = document.querySelector(".hero__zoom");

document.querySelectorAll(".circle-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const plus = btn.getAttribute("aria-label") === "放大";
    zoom = Math.min(400, Math.max(25, zoom + (plus ? 25 : -25)));
    zoomLabel.textContent = zoom + "%";
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "创建") {
      showToast("新建：Design / FigJam / Slides");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

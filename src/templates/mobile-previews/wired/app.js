// 連線 · WIRED — 页面交互
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

/* ===== 订阅（校验）===== */
const subInput = document.getElementById("subInput");

document.getElementById("subBtn").addEventListener("click", () => {
  const v = subInput.value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
    showToast("请输入有效邮箱地址");
    return;
  }
  showToast("订阅成功 · 明早七点见");
  subInput.value = "";
});

subInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("subBtn").click();
});

/* ===== Feed 筛选 ===== */
const stories = Array.from(document.querySelectorAll(".story"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    stories.forEach((story) => {
      story.hidden = filter !== "all" && story.dataset.kind !== filter;
    });
  });
});

/* ===== 行情波动 ===== */
const tickers = document.querySelectorAll(".ticker__row span");

setInterval(() => {
  tickers.forEach((t) => {
    const up = Math.random() > 0.5;
    const delta = (Math.random() * 1.2).toFixed(1);
    t.textContent = t.textContent.replace(/([▲▼])(-?[\d.]+)%/, `${up ? "▲" : "▼"}${delta}%`);
  });
}, 2500);

/* ===== 文章点击 ===== */
stories.forEach((story) => {
  story.addEventListener("click", () => {
    showToast(`阅读：${story.querySelector(".story__head").textContent.slice(0, 14)}…`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "搜索") {
      subInput.focus();
      showToast("搜索 42,000 篇档案");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

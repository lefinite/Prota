// 生活簿 · 小红书 — 页面交互
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
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    showToast(el.dataset.toast);
  });
});

/* ===== 顶栏切换 ===== */
const topTabs = document.querySelectorAll(".topbar__tab");

topTabs.forEach((tab) => {
  if (tab.classList.contains("is-active")) return; // “发现” 无需重复处理
  tab.addEventListener("click", () => {
    topTabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    showToast(`已切换到「${tab.textContent}」`);
  });
});

/* ===== 分类 chip ===== */
const catChips = document.querySelectorAll(".chips .chip");

catChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    catChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`频道：${chip.textContent}`);
  });
});

/* ===== 点赞 toggle ===== */
document.querySelectorAll(".like").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const on = btn.classList.toggle("is-on");
    btn.setAttribute("aria-pressed", String(on));
    const num = btn.lastChild.textContent || "0";
    const v = parseInt(num.replace(/[k,]/g, ""), 10) || 0;
    const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));
    btn.lastChild.textContent = on ? fmt(v + 1) : fmt(Math.max(0, v - 1));
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "发布") {
      showToast("记录你的生活 ✨ 拍照或选模板");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

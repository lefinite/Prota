// 承运链 · Enterprise — 页面交互
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

/* ===== 推进班次节点 ===== */
document.getElementById("advanceBtn").addEventListener("click", () => {
  const current = document.querySelector(".timeline li.is-current");
  if (!current) {
    showToast("本班次已全部完成");
    return;
  }
  current.classList.remove("is-current");
  current.classList.add("is-done");
  current.querySelector("span").textContent = "已完成";
  const next = current.nextElementSibling;
  if (next) {
    next.classList.add("is-current");
    showToast(`已推进节点：${next.querySelector("b").textContent}`);
  } else {
    showToast("班次 SH-1027 全部节点完成，已签收");
  }
});

/* ===== 温控类 chip ===== */
const opsChips = document.querySelectorAll(".chips--ops .chip");
opsChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    opsChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`筛选温区：${chip.textContent}`);
  });
});

/* ===== Feed 筛选 + 搜索 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const filterChips = document.querySelectorAll(".feed .chip");
const waybillInput = document.getElementById("waybillInput");

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

waybillInput.addEventListener("input", () => {
  const q = waybillInput.value.trim();
  feedItems.forEach((item) => {
    item.hidden = q && !item.textContent.includes(q);
  });
});

/* ===== 新建调度单 ===== */
document.getElementById("createBtn").addEventListener("click", () => {
  const id = "WB-" + (33000 + Math.floor(Math.random() * 999));
  showToast(`调度单 ${id} 已创建，待指派车辆`);
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

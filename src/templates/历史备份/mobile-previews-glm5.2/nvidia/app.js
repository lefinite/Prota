// mobile-previews/nvidia — GPU Monitor
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 任务筛选 / 按钮 Toast

const statusTime = document.getElementById("statusTime");
function updateStatusTime() {
  if (!statusTime) return;
  const now = new Date();
  statusTime.textContent = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
updateStatusTime();
setInterval(updateStatusTime, 30000);

// Toast
const toastEl = document.getElementById("toast");
let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 1600);
}

// 任何带 data-toast 的按钮点击反馈
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// 底部 Tab 切换（仅本 Demo 的视觉高亮）
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) return; // FAB 走 toast
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `SWITCHED TO ${label.textContent}` : "SWITCHED");
  });
});

// 任务筛选
const chips = document.querySelectorAll("#filterChips .chip");
const taskItems = document.querySelectorAll("#taskList .task");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    taskItems.forEach((item) => {
      const type = item.dataset.type;
      const show = filter === "all" || type === filter;
      item.classList.toggle("is-hidden", !show);
    });
    showToast(`FILTER: ${filter.toUpperCase()}`);
  });
});

// 性能图动画 - 模拟实时更新
const graphBars = document.querySelectorAll(".graph-bar");
setInterval(() => {
  graphBars.forEach((bar, index) => {
    if (!bar.classList.contains("graph-bar--active")) {
      const randomHeight = Math.floor(Math.random() * 40) + 50;
      bar.style.setProperty("--h", `${randomHeight}%`);
      bar.style.height = `${randomHeight}%`;
    }
  });
}, 3000);

// mobile-previews/spacex — MISSION CONTROL
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 发射筛选 / 按钮 Toast / 倒计时

const statusTime = document.getElementById("statusTime");
function updateStatusTime() {
  if (!statusTime) return;
  const now = new Date();
  statusTime.textContent = now.toLocaleTimeString("en-US", {
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
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 2000);
}

// 任何带 data-toast 的按钮点击反馈
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// 底部 Tab 切换
const tabs = document.querySelectorAll(".mission-tabbar .mission-tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? label.textContent : "SWITCHED");
  });
});

// 发射筛选
const filters = document.querySelectorAll("#filterChips .launch-filter");
const launchItems = document.querySelectorAll("#launchList .launch-item");
filters.forEach((filter) => {
  filter.addEventListener("click", () => {
    filters.forEach((f) => {
      f.classList.remove("is-active");
      f.setAttribute("aria-selected", "false");
    });
    filter.classList.add("is-active");
    filter.setAttribute("aria-selected", "true");
    const filterType = filter.dataset.filter;
    launchItems.forEach((item) => {
      const show = filterType === "all" || item.dataset.type === filterType;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

// 倒计时模拟
const countdownVals = document.querySelectorAll(".countdown__val");
let seconds = 52;
setInterval(() => {
  seconds--;
  if (seconds < 0) seconds = 59;
  const secVal = document.querySelector('.countdown__val[data-val="52"]');
  if (secVal) secVal.textContent = seconds.toString().padStart(2, '0');
}, 1000);

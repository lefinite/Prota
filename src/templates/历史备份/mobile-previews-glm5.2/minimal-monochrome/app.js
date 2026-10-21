// mobile-previews/minimal-monochrome — Pure Reader
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 视图切换 / 文章选项 / Toast

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

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 视图切换（列表/网格）
const viewBtns = document.querySelectorAll("#viewToggle .view-btn");
viewBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    viewBtns.forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("is-active");
    btn.setAttribute("aria-selected", "true");
    const view = btn.dataset.view;
    showToast(view === "list" ? "列表视图" : "网格视图");
  });
});

// 文章点击
const articleItems = document.querySelectorAll(".article-item");
articleItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    if (!e.target.closest(".article-action")) {
      const title = item.querySelector(".article-title").textContent;
      showToast(`打开「${title.slice(0, 8)}…」`);
    }
  });
});

// 文章选项按钮
const articleActions = document.querySelectorAll(".article-action");
articleActions.forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    showToast("文章选项");
  });
});

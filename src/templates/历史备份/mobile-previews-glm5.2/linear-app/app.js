// mobile-previews/linear-app — Linear Issue Tracker
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / Issue 筛选 / 按钮 Toast

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

// Issue 筛选
const chips = document.querySelectorAll(".chips .chip");
const issues = document.querySelectorAll("#issueList .issue");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;

    issues.forEach((issue) => {
      const status = issue.dataset.status;
      let show = filter === "all";

      if (filter === "active") {
        show = status === "active";
      } else if (filter === "backlog") {
        show = status === "backlog";
      } else if (filter === "mine") {
        // Demo: 随机显示一些 issue 模拟"我的"
        show = Math.random() > 0.5;
      }

      issue.classList.toggle("is-hidden", !show);
    });

    const count = document.querySelectorAll("#issueList .issue:not(.is-hidden)").length;
    showToast(`显示 ${count} 个 issue`);
  });
});

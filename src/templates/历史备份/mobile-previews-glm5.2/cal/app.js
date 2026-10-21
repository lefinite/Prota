// mobile-previews/cal — Schedule · Minimal & Clean
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 视图切换 / 快速添加任务 / Toast

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
    showToast(label ? `已切换到「${label.textContent}」` : "已切换");
  });
});

// 视图切换
const viewBtns = document.querySelectorAll(".view-toggle .view-btn");
viewBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    viewBtns.forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("is-active");
    btn.setAttribute("aria-selected", "true");
    const view = btn.dataset.view;
    showToast(view === "calendar" ? "切换到日历视图" : "切换到时间线视图");
  });
});

// 快速添加任务
const addInput = document.querySelector(".add-input");
const addSubmit = document.querySelector(".add-submit");
if (addInput && addSubmit) {
  addSubmit.addEventListener("click", () => {
    const text = addInput.value.trim();
    if (text) {
      showToast(`已添加：${text}`);
      addInput.value = "";
    } else {
      showToast("请输入任务内容");
      addInput.focus();
    }
  });

  addInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addSubmit.click();
    }
  });
}

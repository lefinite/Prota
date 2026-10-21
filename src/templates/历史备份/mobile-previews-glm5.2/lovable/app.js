// mobile-previews/lovable — AI 构建器 · Lovable
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 项目筛选 / 模板选择 / Toast

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
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 2200);
}

// 任何带 data-toast 的按钮点击反馈
document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--create")) return;
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--create")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 项目筛选
const projectTabs = document.querySelectorAll("#projectTabs .filter-tab");
const projectCards = document.querySelectorAll("#projectList .project-card");
projectTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    projectTabs.forEach((t) => {
      t.classList.remove("is-active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    const filter = tab.dataset.filter;
    projectCards.forEach((card) => {
      const show = filter === "all" || card.dataset.filter === filter;
      card.classList.toggle("is-hidden", !show);
    });
  });
});

// 输入区域交互
const inputArea = document.querySelector(".input-area");
const inputPlaceholder = document.querySelector(".input-placeholder");

if (inputArea && inputPlaceholder) {
  inputArea.addEventListener("focus", () => {
    inputPlaceholder.style.display = "none";
  });

  inputArea.addEventListener("blur", () => {
    if (!inputArea.textContent.trim()) {
      inputPlaceholder.style.display = "block";
    }
  });

  inputArea.addEventListener("input", () => {
    if (inputArea.textContent.trim()) {
      inputPlaceholder.style.display = "none";
    }
  });
}

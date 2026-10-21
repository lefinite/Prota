// mobile-previews/raycast — Raycast Command · Developer Tools
// 保留：状态栏时间逻辑
// 页面：命令面板输入 / 扩展筛选 / Tab 切换 / Toast

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

// 命令面板输入
const commandInput = document.getElementById("commandInput");
if (commandInput) {
  commandInput.addEventListener("focus", () => {
    commandInput.parentElement.style.borderColor = "rgba(85, 179, 255, 0.3)";
  });
  commandInput.addEventListener("blur", () => {
    commandInput.parentElement.style.borderColor = "rgba(255, 255, 255, 0.08)";
  });
  commandInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && commandInput.value.trim()) {
      showToast(`执行命令: ${commandInput.value}`);
      commandInput.value = "";
    }
  });
}

// 底部 Tab 切换
const tabs = document.querySelectorAll(".tabbar .tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("tab--fab")) {
      showToast("打开命令面板");
      if (commandInput) commandInput.focus();
      return;
    }
    tabs.forEach((t) => {
      if (!t.classList.contains("tab--fab")) t.classList.remove("is-active");
    });
    tab.classList.add("is-active");
    const label = tab.querySelector("span");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 扩展筛选
const chips = document.querySelectorAll("#filterChips .chip");
const extItems = document.querySelectorAll("#extList .ext");
chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const filter = chip.dataset.filter;
    extItems.forEach((item) => {
      const show = filter === "all" || item.dataset.type === filter;
      item.classList.toggle("is-hidden", !show);
    });
  });
});

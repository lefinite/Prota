// mobile-previews/tetris — Tetris Block Levels
// 保留：状态栏时间逻辑
// 页面：Tab 切换 / 难度筛选 / 关卡锁定 / Toast 反馈

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
    const label = tab.querySelector("span:last-child");
    showToast(label ? `切换到「${label.textContent}」` : "已切换");
  });
});

// 难度筛选
const diffChips = document.querySelectorAll("#difficultyChips .chip");
const levels = document.querySelectorAll("#levelList .level");
diffChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    diffChips.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-selected", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-selected", "true");
    const diff = chip.dataset.diff;

    levels.forEach((level) => {
      const isLocked = level.dataset.locked === "true";
      const show = diff === "easy" && !isLocked ||
                   diff === "normal" && level.dataset.type !== "hard" ||
                   diff === "hard";
      level.classList.toggle("is-hidden", !show);
    });

    showToast(`${diff.toUpperCase()} 模式已选择`);
  });
});

// 关卡点击反馈
document.querySelectorAll(".level:not([data-locked='true'])").forEach((level) => {
  level.addEventListener("click", () => {
    const title = level.querySelector(".level__title").textContent;
    showToast(`进入关卡：${title}`);
  });
});

// 锁定关卡点击提示
document.querySelectorAll(".level[data-locked='true']").forEach((level) => {
  level.addEventListener("click", () => {
    showToast("🔒 关卡未解锁");
  });
});

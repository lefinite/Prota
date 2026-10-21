// 随行 · Cursor — 页面交互
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

/* ===== 通用：data-toast 按钮 ===== */
document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== chip 筛选 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 已审 toggle ===== */
document.querySelectorAll(".feed-item__check").forEach((check) => {
  check.addEventListener("click", () => {
    const on = check.classList.toggle("is-on");
    check.setAttribute("aria-pressed", String(on));
    showToast(on ? "已标记已审" : "已取消已审");
  });
});

/* ===== 批准全部修改：全部事件标记已审 + 进度推进 ===== */
const quickInput = document.getElementById("quickInput");
const progressFill = document.querySelector(".progress__fill");
const progressAria = document.querySelector(".progress");

document.getElementById("approveBtn").addEventListener("click", () => {
  document.querySelectorAll(".feed-item__check:not(.is-on)").forEach((check) => {
    check.classList.add("is-on");
    check.setAttribute("aria-pressed", "true");
  });
  if (progressFill) {
    progressFill.style.setProperty("--w", "92%");
  }
  if (progressAria) {
    progressAria.setAttribute("aria-valuenow", "92");
    progressAria.setAttribute("aria-label", "会话进度 92%");
  }
  showToast("已批准 3 处修改 · Agent 继续执行");
});

quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const text = quickInput.value.trim();
    if (!text) return;
    quickInput.value = "";
    showToast("指令已发送给 Agent");
  }
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "会话") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "指令") {
      quickInput.focus();
      showToast("输入补充要求，回车发送");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

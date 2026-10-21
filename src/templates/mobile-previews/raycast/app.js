// 闪启 · Raycast — 页面交互
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

/* ===== 固定置顶 toggle（交互蓝，非品牌红）===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已固定到命令面板顶部" : "已取消固定");
  });
});

/* ===== 立即执行：计数 + 新建命令 ===== */
const runBtn = document.getElementById("runBtn");
const runCountEl = document.getElementById("runCount");
const cmdInput = document.getElementById("cmdInput");
let runCount = 326;

function runCommand() {
  const text = cmdInput.value.trim();
  if (text) {
    cmdInput.value = "";
    showToast(`已创建并执行「${text}」`);
  } else {
    showToast("已执行：静音模式 · 45 分钟");
  }
  runCount += 1;
  runCountEl.textContent = String(runCount);
}

runBtn.addEventListener("click", runCommand);
cmdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runCommand();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "命令") {
      document.querySelector(".hero-card").scrollIntoView({ behavior: "smooth" });
    } else if (name === "剪贴板") {
      showToast("剪贴板历史已加密保存 30 天");
    } else if (name === "窗口") {
      showToast("当前 3 个窗口组，⌘⇧N 新建");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

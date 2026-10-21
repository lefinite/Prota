// 码房 · OpenCode 风格 — 页面交互
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

document.querySelectorAll("[data-toast]").forEach((el) => {
  el.addEventListener("click", () => showToast(el.dataset.toast));
});

/* ===== 接受修改 ===== */
document.getElementById("acceptBtn").addEventListener("click", () => {
  const pending = document.querySelector(".st-warn");
  if (pending) {
    pending.textContent = "MERGED";
    pending.className = "feed-item__state st-ok";
    showToast("3 个文件已写入工作区 · git add 待你确认");
  } else {
    showToast("没有待接受的修改");
  }
});

/* ===== Feed 筛选 ===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const filterChips = document.querySelectorAll(".feed .chip");

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      item.hidden = filter !== "all" && item.dataset.kind !== filter;
    });
  });
});

/* ===== 命令面板 ===== */
const cmdInput = document.getElementById("cmdInput");
const term = document.querySelector(".hero__term");
const cmdResults = {
  "/review": "✓ review: 2 处建议 —— 事务粒度可以更小、注释补一行",
  "/test": "✓ vitest run · 12 passed · 1.8s",
  "/commit": "✓ committed: fix(order): 库存扣减加事务锁 [a41c2]",
  "/undo": "↺ 已回滚最近一次编辑"
};

function runCmd(text) {
  const line = document.createElement("p");
  line.className = "line c-blue";
  line.textContent = "» " + text;
  term.insertBefore(line, term.lastElementChild);
  const out = cmdResults[text.split(" ")[0]] || `✓ 已执行：${text} · 3 步完成`;
  setTimeout(() => {
    const res = document.createElement("p");
    res.className = "line c-green";
    res.textContent = out;
    term.insertBefore(res, term.lastElementChild);
    term.scrollTop = term.scrollHeight;
  }, 500);
  showToast(`执行 ${text}`);
}

document.querySelectorAll("[data-cmd]").forEach((chip) => {
  chip.addEventListener("click", () => {
    cmdInput.value = chip.dataset.cmd;
    runCmd(chip.dataset.cmd);
    cmdInput.value = "";
  });
});

cmdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && cmdInput.value.trim()) {
    runCmd(cmdInput.value.trim());
    cmdInput.value = "";
  }
});

/* ===== 会话点击 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    showToast(`已载入会话 ${item.querySelector(".feed-item__meta").textContent.split(" ·")[0]}`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "新任务") {
      cmdInput.focus();
      showToast("描述任务，或输入 / 命令");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

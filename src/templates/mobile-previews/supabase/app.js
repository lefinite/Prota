// 绿盒 · Supabase 风格 — 页面交互
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

/* ===== 运行查询 ===== */
const rowNum = document.getElementById("rowNum");
const runTime = document.getElementById("runTime");
const bars = document.querySelectorAll(".hero__bars i");

function runQuery() {
  runTime.textContent = "RUN …";
  const ms = 20 + Math.round(Math.random() * 60);
  const rows = 9000 + Math.round(Math.random() * 6000);
  setTimeout(() => {
    runTime.textContent = `RUN ${ms}MS`;
    rowNum.textContent = rows.toLocaleString("en-US");
    bars.forEach((b) => {
      b.style.setProperty("--h", 30 + Math.round(Math.random() * 60) + "%");
    });
    showToast(`查询完成 · ${rows.toLocaleString("en-US")} 行 · ${ms}ms`);
  }, 450);
}

document.getElementById("runBtn").addEventListener("click", runQuery);
document.getElementById("run2Btn").addEventListener("click", runQuery);

/* ===== 模板 chip ===== */
const tplChips = document.querySelectorAll(".chips--tpl .chip");
tplChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    tplChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`已载入片段「${chip.textContent}」`);
  });
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

/* ===== 行点击：复制日志 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    showToast("日志详情已复制到剪贴板");
  });
});

/* ===== SQL 输入回车 ===== */
const sqlInput = document.getElementById("sqlInput");
sqlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runQuery();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "运行") {
      sqlInput.focus();
      showToast("输入 SQL，回车即运行");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

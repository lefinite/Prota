// 蜂格 · Airtable 风格 — 页面交互
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

document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== 表格行选中 ===== */
const rows = document.querySelectorAll(".hero__row:not(.hero__row--head)");
const countEl = document.querySelector(".hero__count");

rows.forEach((row) => {
  row.addEventListener("click", () => {
    row.classList.toggle("is-sel");
    const n = document.querySelectorAll(".hero__row.is-sel").length;
    countEl.textContent = `已选 ${n} / 86`;
    if (row.classList.contains("is-sel")) {
      showToast(`已选中「${row.querySelector(".c1").textContent}」`);
    }
  });
});

/* ===== 字段类型 chip ===== */
const picks = document.querySelectorAll("[data-pick]");
picks.forEach((chip) => {
  chip.addEventListener("click", () => {
    picks.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
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

/* ===== 新增记录：插入表格首行 ===== */
const recordInput = document.getElementById("recordInput");
const table = document.querySelector(".hero__table");
const today = new Date();
const stamp = `${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

function addRecord() {
  const text = (recordInput.value || "").trim() || "未命名记录";
  const row = document.createElement("div");
  row.className = "hero__row";
  row.setAttribute("role", "row");
  row.innerHTML = `
    <span class="c1"></span>
    <span class="c2"><em class="tag tag--wait">待排期</em></span>
    <span class="c3">我</span>
    <span class="c4">${stamp}</span>`;
  row.querySelector(".c1").textContent = text;
  row.addEventListener("click", () => {
    row.classList.toggle("is-sel");
    const n = document.querySelectorAll(".hero__row.is-sel").length;
    countEl.textContent = `已选 ${n} / 87`;
  });
  table.insertBefore(row, table.children[1]);
  recordInput.value = "";
  showToast(`已新增记录「${text}」`);
}

document.getElementById("addBtn").addEventListener("click", addRecord);
recordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addRecord();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "新增") {
      recordInput.focus();
      showToast("输入标题，回车即新增");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

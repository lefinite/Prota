// 工作室档案 · Atelier Zero — 页面交互
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

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

/* ===== 书签 toggle ===== */
document.querySelectorAll(".feed-item__mark").forEach((mark) => {
  mark.addEventListener("click", () => {
    const on = mark.classList.toggle("is-on");
    mark.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加书签 · 索引页同步" : "已移除书签");
  });
});

/* ===== 新建条目：编号顺延 ===== */
const newEntryBtn = document.getElementById("newEntryBtn");
const entryInput = document.getElementById("entryInput");
const feedList = document.getElementById("feedList");

function createEntry() {
  const text = (entryInput.value || "").trim() || "未命名现场条目";
  const numbers = feedItems
    .map((item) => Number(item.querySelector(".feed-item__num").textContent))
    .filter((n) => !Number.isNaN(n));
  const nextNum = Math.max(7, ...numbers.map((n) => n + 1));
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "active";
  li.innerHTML = `
    <span class="feed-item__num mono"></span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta mono">08-15 · ATELIER</span>
    </div>
    <em class="idx-chip" data-kind="active">进行中</em>
    <button class="feed-item__mark" type="button" aria-label="加书签" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 3h12v18l-6-4.5L6 21V3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__num").textContent = String(nextNum).padStart(2, "0");
  li.querySelector(".feed-item__name").textContent = text;
  li.querySelector(".feed-item__mark").addEventListener("click", (e) => {
    const mark = e.currentTarget;
    const on = mark.classList.toggle("is-on");
    mark.setAttribute("aria-pressed", String(on));
  });
  const activeFilter = document.querySelector(".chip.is-active");
  const filter = activeFilter ? activeFilter.dataset.filter : "all";
  li.hidden = filter !== "all" && filter !== "active";
  feedList.prepend(li);
  entryInput.value = "";
  showToast(`条目 Nº ${String(nextNum).padStart(2, "0")} 已建立`);
}

newEntryBtn.addEventListener("click", createEntry);

entryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createEntry();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");
const plateSection = document.querySelector(".plate-section");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "索引" || name === "图版") {
      plateSection.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      if (name === "图版") showToast("PLATE Nº 08 · 004 / 008");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

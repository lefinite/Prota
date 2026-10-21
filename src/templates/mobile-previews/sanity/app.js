// 结绳 · Sanity 风格 — 页面交互
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

/* ===== 发布 ===== */
document.getElementById("publishBtn").addEventListener("click", () => {
  const dot = document.querySelector(".hero__status .dot");
  const label = document.querySelectorAll(".hero__status span")[1];
  if (label.textContent.includes("DRAFT")) {
    dot.style.background = "var(--green)";
    label.textContent = "PUBLISHED · rev 4,183";
    showToast("已发布 · CDN 正在预热 12 处边缘节点");
  } else {
    showToast("该文档已是最新发布状态");
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

/* ===== 类型 chip → GROQ 模板 ===== */
const typeChips = document.querySelectorAll(".chips--type .chip");
const groqInput = document.getElementById("groqInput");

typeChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    typeChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    groqInput.placeholder = `*[_type == "${chip.textContent}"]`;
  });
});

/* ===== 查询 ===== */
document.getElementById("runBtn").addEventListener("click", () => {
  showToast("查询中……");
  setTimeout(() => {
    showToast(`返回 ${20 + Math.floor(Math.random() * 300)} 个文档 · 41ms`);
  }, 600);
});

groqInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("runBtn").click();
});

/* ===== 行点击 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    showToast(`打开文档：${item.querySelector(".feed-item__name").textContent}`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "新建") {
      showToast("新文档已创建：untitled");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

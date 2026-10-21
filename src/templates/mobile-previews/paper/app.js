// 纸间 · Paper — 页面交互
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

/* ===== 折角 toggle ===== */
document.querySelectorAll(".fold").forEach((fold) => {
  fold.addEventListener("click", () => {
    const on = fold.classList.toggle("is-on");
    fold.setAttribute("aria-pressed", String(on));
    showToast(on ? "已折角，方便回看" : "已抚平折角");
  });
});

/* ===== 墨水选择 ===== */
const inkChips = document.querySelectorAll(".chips--ink .chip");
inkChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    inkChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`换用：${chip.textContent}`);
  });
});

/* ===== 落笔：写进今日页 ===== */
const jotInput = document.getElementById("jotInput");
const heroBody = document.querySelector(".hero__body");

document.getElementById("writeBtn").addEventListener("click", () => {
  const text = (jotInput.value || "").trim();
  if (!text) {
    showToast("先写一句，再落笔");
    return;
  }
  heroBody.textContent += " " + text;
  jotInput.value = "";
  showToast("已写入今日页 · 第 85 页");
});

jotInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("writeBtn").click();
});

/* ===== 行点击：翻到那页 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    showToast(`翻到「${item.querySelector(".feed-item__name").textContent}」`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "落笔") {
      jotInput.focus();
      showToast("笔已蘸好，随时落笔");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

// روزنامہ · Urdu Modern — 页面交互
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

/* ===== 阅读进度（开始阅读）===== */
const readBtn = document.getElementById("readBtn");
const stages = ["پڑھائی جاری… 25%", "پڑھائی جاری… 60%", "پڑھائی جاری… 100% · مکمل"];
let si = 0;

readBtn.addEventListener("click", () => {
  if (si >= stages.length) {
    showToast("已读完今日一文 · 明天见");
    return;
  }
  showToast(stages[si]);
  si += 1;
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

/* ===== 难度 chip ===== */
const levelChips = document.querySelectorAll(".chips--level .chip");
levelChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    levelChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    showToast(`难度：${chip.textContent}`);
  });
});

/* ===== 搜索 ===== */
const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  feedItems.forEach((item) => {
    item.hidden = q && !item.textContent.includes(q);
  });
});

/* ===== 行点击：加入生词/阅读 ===== */
feedItems.forEach((item) => {
  item.addEventListener("click", () => {
    showToast(`کھول رہا ہے · 打开：${item.querySelector(".feed-item__meta").textContent.split(" ·")[0]}`);
  });
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "朗读") {
      showToast("آواز: آج کا مضمون · 正在朗读今日文章");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

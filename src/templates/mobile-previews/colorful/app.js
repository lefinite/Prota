// 夏日现场 · Colorful — 页面交互
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

/* ===== 开票倒计时（每秒真实递减） ===== */
const countdownEl = document.getElementById("countdown");
let remainSeconds = 2 * 3600 + 14 * 60 + 36; // 02:14:36

function pad(n) {
  return String(n).padStart(2, "0");
}

function renderCountdown() {
  if (!countdownEl) return;
  if (remainSeconds <= 0) {
    countdownEl.textContent = "开票中！";
    return;
  }
  const h = Math.floor(remainSeconds / 3600);
  const m = Math.floor((remainSeconds % 3600) / 60);
  const s = remainSeconds % 60;
  countdownEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
}

renderCountdown();
setInterval(() => {
  remainSeconds = Math.max(0, remainSeconds - 1);
  renderCountdown();
}, 1000);

/* ===== 抢票：售出进度 +1~2% ===== */
const grabBtn = document.getElementById("grabBtn");
const soldNum = document.getElementById("soldNum");
const soldFill = document.getElementById("soldFill");
let sold = 78;

grabBtn.addEventListener("click", () => {
  sold = Math.min(100, sold + (Math.random() > 0.5 ? 2 : 1));
  const display = Math.round(sold);
  soldNum.textContent = String(display);
  soldFill.style.setProperty("--w", display + "%");
  soldFill.style.width = display + "%";
  soldFill.closest(".hero-ticket__track").setAttribute("aria-label", `预售已售 ${display}%`);
  showToast(
    display >= 100
      ? "已售罄 · 你已进入候补队列"
      : `已加入抢票队列 · 当前已售 ${display}%`
  );
});

/* ===== chip 筛选（流派） ===== */
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

/* ===== 收藏 toggle ===== */
document.querySelectorAll(".feed-item__heart").forEach((heart) => {
  heart.addEventListener("click", () => {
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    const name = heart.closest(".feed-item").querySelector(".feed-item__name").textContent;
    showToast(on ? `已收藏「${name.split(" ·")[0]}」` : "已取消收藏");
  });
});

/* ===== 搜索 ===== */
const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = searchInput.value.trim();
  if (!text) {
    showToast("输入艺人、场馆或流派试试");
    return;
  }
  const hit = feedItems.find((item) =>
    item.querySelector(".feed-item__name").textContent.includes(text) ||
    item.querySelector(".feed-item__meta").textContent.includes(text)
  );
  if (hit) {
    hit.hidden = false;
    hit.scrollIntoView({ behavior: "smooth", block: "center" });
    showToast(`找到相关演出：${hit.querySelector(".feed-item__name").textContent.split(" ·")[0]}`);
  } else {
    showToast(`没有找到「${text}」相关演出`);
  }
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "购票") {
      grabBtn.scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("热门场次余票紧张，建议立即锁定");
    } else if (name === "发现") {
      searchInput.focus();
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

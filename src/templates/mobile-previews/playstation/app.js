// 游戏库 · PlayStation — 页面交互
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

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

/* ===== 平台 chip 筛选 ===== */
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

/* ===== 收藏游戏 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入收藏夹" : "已从收藏夹移除");
  });
});

/* ===== 启动游戏：奖杯进度条重放（power-on 动效）===== */
const heroTrophyFill = document.getElementById("heroTrophyFill");
let playCount = 0;

function replayTrophyProgress() {
  playCount += 1;
  if (heroTrophyFill) {
    const next = Math.min(62 + playCount, 100);
    heroTrophyFill.style.setProperty("--w", `${next}%`);
    heroTrophyFill.style.animation = "none";
    void heroTrophyFill.offsetWidth;
    heroTrophyFill.style.animation = "";
  }
  showToast(playCount === 1 ? "已启动 星海旅人 II" : `本局 +${playCount * 2}% 奖杯进度`);
}

document.getElementById("playBtn").addEventListener("click", replayTrophyProgress);
document.getElementById("resumeBtn").addEventListener("click", replayTrophyProgress);

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "商店") {
      showToast("PlayStation Store · 本周特惠已更新");
    } else if (name === "Plus") {
      showToast("Plus 会员：本月免费游戏 3 款待领取");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

// 一隅画廊 · Artistic — 页面交互
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

/* ===== 语音导览（signature 交互）=====
 * 起点 2:31 / 总长 8:00，播放时进度条与时间同步前进。 */
const GUIDE_TOTAL = 8 * 60;
let guideSec = 2 * 60 + 31;
let guidePlaying = false;
let guideTimer = null;

const guideBtn = document.getElementById("guideBtn");
const guideFill = document.getElementById("guideFill");
const guideNow = document.getElementById("guideNow");
const guideCta = document.getElementById("guideCta");

function paintGuide() {
  const pct = Math.min(100, (guideSec / GUIDE_TOTAL) * 100);
  guideFill.style.width = `${pct}%`;
  const m = Math.floor(guideSec / 60);
  const s = guideSec % 60;
  guideNow.textContent = `${m}:${String(s).padStart(2, "0")}`;
}

function setGuidePlaying(on) {
  guidePlaying = on;
  guideBtn.classList.toggle("is-playing", on);
  guideBtn.setAttribute("aria-pressed", String(on));
  guideBtn.setAttribute("aria-label", on ? "暂停语音导览" : "播放语音导览");
  guideCta.textContent = on ? "暂停语音导览" : "继续语音导览";
  clearInterval(guideTimer);
  if (on) {
    guideTimer = setInterval(() => {
      if (guideSec >= GUIDE_TOTAL) {
        setGuidePlaying(false);
        guideSec = 0;
        paintGuide();
        showToast("导览 04 播完，已进入 05 · 天青的来历");
        return;
      }
      guideSec += 1;
      paintGuide();
    }, 1000);
  }
}

guideBtn.addEventListener("click", () => {
  setGuidePlaying(!guidePlaying);
});

guideCta.addEventListener("click", () => {
  if (guideSec >= GUIDE_TOTAL) guideSec = 0;
  setGuidePlaying(!guidePlaying);
  showToast(guidePlaying ? "正在播放 · 导览 04" : "已暂停 · 导览 04");
});

paintGuide();

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

/* ===== 喜欢 toggle ===== */
document.querySelectorAll(".feed-item__heart").forEach((heart) => {
  heart.addEventListener("click", () => {
    const on = heart.classList.toggle("is-on");
    heart.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入本次观展的心愿" : "已从心愿移除");
  });
});

/* ===== 今日一作 · 心愿单 ===== */
const wishBtn = document.getElementById("wishBtn");

wishBtn.addEventListener("click", () => {
  const on = wishBtn.classList.toggle("is-on");
  wishBtn.setAttribute("aria-pressed", String(on));
  wishBtn.querySelector("span").textContent = on ? "已在心愿单" : "加入心愿单";
  showToast(on ? "《驼铃》已加入心愿单" : "已从心愿单移除");
});

/* ===== 检索 ===== */
const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const text = searchInput.value.trim();
    showToast(text ? `在馆藏中检索「${text}」· 3 件相关` : "输入艺术家、作品名或图版号");
    searchInput.blur();
  }
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");
const heroCard = document.querySelector(".hero-card");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "展览") {
      heroCard.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

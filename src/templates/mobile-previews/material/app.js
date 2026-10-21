// 活力 · Material — 页面交互
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

/* ===== Hero：步数数字滚动（reduced-motion 直接落值）===== */
const stepCount = document.getElementById("stepCount");
const STEP_TARGET = 8432;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function countUpSteps() {
  if (!stepCount) return;
  if (reducedMotion) {
    stepCount.textContent = STEP_TARGET.toLocaleString("zh-CN");
    return;
  }
  const start = performance.now();
  const dur = 1000;
  function tick(t) {
    const p = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    stepCount.textContent = Math.round(STEP_TARGET * eased).toLocaleString("zh-CN");
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

countUpSteps();

/* ===== Material 开关：就寝提醒 ===== */
const bedSwitch = document.getElementById("bedSwitch");
if (bedSwitch) {
  bedSwitch.addEventListener("click", () => {
    const on = bedSwitch.classList.toggle("is-on");
    bedSwitch.setAttribute("aria-checked", String(on));
    showToast(on ? "就寝提醒已开启 · 23:00" : "就寝提醒已关闭");
  });
}

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

/* ===== 常用标记 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已加入常用运动" : "已取消常用");
  });
});

/* ===== 记录运动：写入 Feed 顶部 ===== */
const quickInput = document.getElementById("quickInput");
const feedList = document.getElementById("feedList");

function logActivity() {
  const text = (quickInput.value || "").trim() || "步行 20 分钟";
  const kcal = Math.round(Math.random() * 60 + 20);
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "sport";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">📍</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚 · 快速记录<em class="state-chip is-live">进行中</em></span>
    </div>
    <b class="feed-item__value">+${kcal}</b>
    <button class="feed-item__star" type="button" aria-label="标记为常用" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = text;
  li.querySelector(".feed-item__star").addEventListener("click", (e) => {
    const star = e.currentTarget;
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  li.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  quickInput.value = "";
  showToast(`已开始记录：${text}`);
}

document.getElementById("logBtn").addEventListener("click", logActivity);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") logActivity();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "统计") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
      showToast("统计：本周日均 7,930 步");
    } else if (name === "记录") {
      quickInput.focus();
      showToast("输入活动内容，回车即刻记录");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

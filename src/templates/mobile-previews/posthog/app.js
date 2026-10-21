// 刺猬分析 · PostHog — 页面交互
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

/* ===== 通用：data-toast 按钮（含漏斗步骤）===== */
document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== 功能开关 toggle（真实开关交互）===== */
const flagNames = {
  "新手引导开关": "beta-onboarding",
  "内测入口开关": "labs-menu",
  "新版仪表盘开关": "dash-v2"
};

document.querySelectorAll(".switch").forEach((sw) => {
  sw.addEventListener("click", () => {
    const on = sw.classList.toggle("is-on");
    sw.setAttribute("aria-checked", String(on));
    const key = flagNames[sw.getAttribute("aria-label")] || sw.getAttribute("aria-label");
    showToast(on ? `${key} 已对全量用户开启` : `${key} 已关闭`);
  });
});

/* ===== 趋势折线描线动画（reduced-motion 时直接显示）===== */
const sparkLine = document.getElementById("sparkLine");

if (sparkLine) {
  if (reduceMotion || typeof sparkLine.getTotalLength !== "function") {
    /* 直接显示 */
  } else {
    const len = sparkLine.getTotalLength();
    sparkLine.style.strokeDasharray = String(len);
    sparkLine.style.strokeDashoffset = String(len);
    sparkLine.style.transition = "stroke-dashoffset 1.1s cubic-bezier(0.2, 0, 0, 1) 260ms";
    requestAnimationFrame(() => {
      sparkLine.style.strokeDashoffset = "0";
    });
  }
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

/* ===== 订阅事件 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已订阅，异常时会提醒你" : "已取消订阅");
  });
});

/* ===== 查询事件 ===== */
const queryInput = document.getElementById("queryInput");
const feedList = document.getElementById("feedList");

queryInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = queryInput.value.trim();
  if (text) {
    showToast(`已查询 ${text} · 近 7 天 1,204 次`);
  } else {
    showToast("输入事件名，如：signup_completed");
  }
});

/* ===== 新建洞察：写入动态顶部 ===== */
function createInsight() {
  const name = queryInput.value.trim() || "trend_custom";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "on";
  li.innerHTML = `
    <span class="feed-item__glyph mono" aria-hidden="true">ƒ</span>
    <div class="feed-item__body">
      <span class="feed-item__name mono"></span>
      <span class="feed-item__meta">自定义洞察 · 刚刚 <em class="tag tag--on">启用中</em></span>
    </div>
    <button class="feed-item__star" type="button" aria-label="订阅事件" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">
        <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" />
      </svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = `insight_${name.replace(/\s+/g, "_")}`;
  li.querySelector(".feed-item__star").addEventListener("click", (e) => {
    const star = e.currentTarget;
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  queryInput.value = "";
  li.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  showToast("洞察已创建，默认按天聚合");
}

document.getElementById("insightBtn").addEventListener("click", createInsight);

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "事件") {
      queryInput.focus();
      showToast("输入事件名，回车查询");
    } else if (name === "新建") {
      queryInput.focus();
      showToast("输入事件名，一键生成洞察");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

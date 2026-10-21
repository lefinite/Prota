// 云哨 · Dashboard — 页面交互
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

/* ===== chip 筛选（按健康状态）===== */
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

/* ===== 告警静默 toggle ===== */
document.querySelectorAll(".feed-item__mute").forEach((mute) => {
  mute.addEventListener("click", () => {
    const on = mute.classList.toggle("is-on");
    mute.setAttribute("aria-pressed", String(on));
    showToast(on ? "已静默 30 分钟" : "已恢复提醒");
  });
});

/* ===== 触发灰度演练 + 阈值校验 ===== */
const quickInput = document.getElementById("quickInput");
const drillBtn = document.getElementById("drillBtn");

function runDrill() {
  const raw = (quickInput.value || "").trim();
  if (raw) {
    const hit = raw.match(/(\d{2,4})/);
    if (hit) {
      showToast(`演练开始 · 阈值 ${hit[1]}ms，影响 2% 流量`);
      return;
    }
  }
  showToast("已发起 5 分钟灰度演练 · 影响范围 2%");
}

drillBtn.addEventListener("click", runDrill);
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runDrill();
});

/* ===== 模拟实时刷新：P95 轻微波动 ===== */
const chartValue = document.querySelector(".chart-card__value");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let p95 = 182;

if (!reduced && chartValue) {
  setInterval(() => {
    p95 = Math.max(140, Math.min(240, p95 + (Math.random() * 24 - 12)));
    chartValue.innerHTML = `${Math.round(p95)}<span class="chart-card__unit">ms</span>`;
  }, 4000);
}

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "服务") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else if (name === "演练") {
      quickInput.focus();
      showToast("输入阈值后回车，即可发起演练");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

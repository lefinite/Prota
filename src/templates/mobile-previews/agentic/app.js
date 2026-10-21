// 蜂巢 · Agentic — 页面交互
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

document.querySelectorAll("[data-toast]").forEach((btn) => {
  btn.addEventListener("click", () => showToast(btn.dataset.toast));
});

/* ===== 委托类型 chip ===== */
let pickKind = "调研";
const picks = document.querySelectorAll("[data-pick]");
picks.forEach((chip) => {
  chip.addEventListener("click", () => {
    picks.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    pickKind = chip.dataset.pick;
  });
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

/* ===== 关注任务 toggle ===== */
document.querySelectorAll(".feed-item__toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const on = btn.classList.toggle("is-on");
    btn.setAttribute("aria-pressed", String(on));
    showToast(on ? "已关注，完成后提醒你" : "已取消关注");
  });
});

/* ===== 派出 Agent：新任务进入列表 ===== */
const delegateInput = document.getElementById("delegateInput");
const feedList = document.querySelector(".feed__list");

function dispatch() {
  const text = (delegateInput.value || "").trim() || `进行一次${pickKind}委托`;
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "running";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">🐝</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">侦察蜂 · 刚刚派出</span>
    </div>
    <em class="feed-item__badge feed-item__badge--run">0%</em>
    <button class="feed-item__toggle" type="button" aria-label="关注此任务" aria-pressed="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;
  li.querySelector(".feed-item__name").textContent = `${pickKind} · ${text}`;
  const badge = li.querySelector(".feed-item__badge");
  const toggle = li.querySelector(".feed-item__toggle");
  toggle.addEventListener("click", () => {
    const on = toggle.classList.toggle("is-on");
    toggle.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  delegateInput.value = "";

  /* 模拟进度推进 */
  let p = 0;
  const timer = setInterval(() => {
    p = Math.min(100, p + Math.round(Math.random() * 18 + 6));
    badge.textContent = p + "%";
    if (p >= 100) {
      clearInterval(timer);
      badge.textContent = "完成";
      badge.className = "feed-item__badge feed-item__badge--ok";
      li.dataset.kind = "done";
      showToast("委托已完成，摘要已推送");
    }
  }, 700);
  showToast(`已派出「${pickKind}蜂」，任务开始执行`);
}

document.getElementById("dispatchBtn").addEventListener("click", dispatch);
delegateInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") dispatch();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "新委托") {
      delegateInput.focus();
      showToast("描述目标，Agent 会拆解执行");
    } else if (name === "日志") {
      showToast("执行日志共 14 条");
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

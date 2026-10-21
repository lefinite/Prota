// 智远交付 · Professional — 页面交互
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

/* ===== chip 筛选（待处理 = 待客户确认 + 进行中）===== */
const feedItems = Array.from(document.querySelectorAll(".feed-item"));
const chips = document.querySelectorAll(".chip");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    feedItems.forEach((item) => {
      const kind = item.dataset.kind;
      const match =
        filter === "all"
          ? true
          : filter === "pending"
            ? kind === "pending" || kind === "progress"
            : kind === filter;
      item.hidden = !match;
    });
  });
});

/* ===== 标记重点 toggle ===== */
function bindStar(star) {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已标记为重点事项" : "已取消重点标记");
  });
}

document.querySelectorAll(".feed-item__star").forEach(bindStar);

/* ===== 提交周报：写入审批流顶部 ===== */
const noteInput = document.getElementById("noteInput");
const feedList = document.getElementById("feedList");
const starSvg =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" /></svg>';

function submitReport() {
  const text = (noteInput.value || "").trim() || "本周周报 · 摘要待补充";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "progress";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">我</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">刚刚提交 · <em class="status-chip" data-tone="accent">进行中</em></span>
    </div>
    <b class="feed-item__code">D-244</b>
    <button class="feed-item__star" type="button" aria-label="标记重点" aria-pressed="false">${starSvg}</button>`;
  li.querySelector(".feed-item__name").textContent = text;
  bindStar(li.querySelector(".feed-item__star"));
  feedList.prepend(li);
  noteInput.value = "";
  showToast("周报已提交，项目经理已收到");
}

document.getElementById("reportBtn").addEventListener("click", submitReport);
noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitReport();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "项目") {
      document.querySelector(".hero-card").scrollIntoView({ behavior: "smooth" });
    } else if (name === "日程") {
      document.getElementById("scheduleCard").scrollIntoView({ behavior: "smooth" });
    } else if (name === "审批") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});

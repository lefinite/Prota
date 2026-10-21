// 一盏 · Refined — 页面交互
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

/* ===== 本泡计时：45s 出汤倒计时 ===== */
const steepLeft = document.getElementById("steepLeft");
const steepFill = document.getElementById("steepFill");
let steepSeconds = 45;
const steepTotal = 45;

function renderSteep() {
  if (!steepLeft || !steepFill) return;
  const m = "0";
  const s = String(steepSeconds).padStart(2, "0");
  steepLeft.textContent = `${m}:${s}`;
  steepFill.style.setProperty("--w", `${(steepSeconds / steepTotal) * 100}%`);
}

renderSteep();
const steepTimer = setInterval(() => {
  if (steepSeconds > 0) {
    steepSeconds -= 1;
    renderSteep();
  } else {
    clearInterval(steepTimer);
    showToast("出汤 · 先闻杯底香，再品汤");
  }
}, 1000);

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

/* ===== 收藏手记 toggle ===== */
document.querySelectorAll(".feed-item__star").forEach((star) => {
  star.addEventListener("click", () => {
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
    showToast(on ? "已收进「回甘集」" : "已移出收藏");
  });
});

/* ===== 记一盏：写入手记顶部 ===== */
const noteInput = document.getElementById("noteInput");
const feedList = document.getElementById("feedList");
const starSvg =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3z" /></svg>';

function logBrew() {
  const text = (noteInput.value || "").trim() || "白鸡冠 · 第三泡";
  const li = document.createElement("li");
  li.className = "feed-item";
  li.dataset.kind = "rock";
  li.innerHTML = `
    <span class="feed-item__glyph" aria-hidden="true">白</span>
    <div class="feed-item__body">
      <span class="feed-item__name"></span>
      <span class="feed-item__meta">今天 · 95°C <em class="status-chip" data-tone="accent">兰花香</em></span>
    </div>
    <b class="feed-item__time">45s</b>
    <button class="feed-item__star" type="button" aria-label="收藏手记" aria-pressed="false">${starSvg}</button>`;
  li.querySelector(".feed-item__name").textContent = text;
  li.querySelector(".feed-item__star").addEventListener("click", (e) => {
    const star = e.currentTarget;
    const on = star.classList.toggle("is-on");
    star.setAttribute("aria-pressed", String(on));
  });
  feedList.prepend(li);
  noteInput.value = "";
  showToast("已记下这一盏");
}

document.getElementById("logBtn").addEventListener("click", logBrew);
noteInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") logBrew();
});

/* ===== 底部 Tab ===== */
const tabs = document.querySelectorAll(".tabbar__item");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const name = tab.dataset.tab;
    if (name === "茶席") {
      document.querySelector(".hero-card").scrollIntoView({ behavior: "smooth" });
    } else if (name === "茶柜") {
      document.querySelector(".duo-grid").scrollIntoView({ behavior: "smooth" });
    } else if (name === "手记") {
      document.querySelector(".feed").scrollIntoView({ behavior: "smooth" });
    } else {
      showToast(`已切换到「${name}」`);
    }
  });
});
